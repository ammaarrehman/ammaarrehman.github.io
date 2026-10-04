#!/usr/bin/env node
/* map-compile (MAP-B B1): compiles the authored source of the redesigned home island,
   tools/maps/home.src.mjs, into the staged map, tools/maps/staged/home.js.

   STAGED. The output is a draft of map format 2 and nothing in the game reads it: js/world.js reads
   format 1 only (format 2 support begins in B2), and the staged file registers
   window.ISLAND_MAPS_STAGED, never window.ISLAND_MAPS. Production keeps the 100 x 80 island in
   js/maps/home.js, which this tool never writes: it refuses any path under js/, and writes only under
   tools/maps/staged/ or tools/out/.

   Deterministic: no randomness, no clock, keys in a fixed order, fixed curve sampling, so two runs give
   the same bytes. The source's own SHA-256 is written into the output, so a stale staged file is caught.

   What it compiles:
   - B1a (locked): the canvas, the coast (land is every tile whose centre is inside the closed coast
     spline), and the sea (shallow within sea.shallowWithin steps of land, deep beyond);
   - B1b: the levels (each land tile takes the highest level of the elevation regions its centre is in,
     else 0), the beach (the coastal band of levels 0 and 1 becomes sand at level 0), the solid regions
     (the volcano mass), and the cliff rims: wherever walkable land meets land a level lower, the higher
     tile is solid, unless both tiles are inside one ramp and are that ramp's two levels. So a level can
     change only inside a ramp, one level at a time.
   The exits, sea lanes and satellites in the source are metadata for tools/map-lint.mjs; nothing is
   built from them yet.

     node tools/map-compile.mjs            compile and write tools/maps/staged/home.js
     node tools/map-compile.mjs --check    compile and compare with the tracked file, write nothing
     node tools/map-compile.mjs --stdout   compile and print the staged file (map-lint's determinism check)
     node tools/map-compile.mjs --preview  also draw review images into tools/out/mapb/ (needs Playwright's
                                           Chromium; images are review aids, never test fixtures) */
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hermiteLoop, ellipsePoly, inside, raster, stepsFrom } from "./maps/geom.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_PATH = join(ROOT, "tools/maps/home.src.mjs");
export const STAGED_PATH = join(ROOT, "tools/maps/staged/home.js");
export const PREVIEW_DIR = join(ROOT, "tools/out/mapb");
export const STAGE = "B1b";
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/* ════════ the source: schema and the coordinate convention ════════ */
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AMBIGUOUS = /^(rect|rects|rectangle|bounds|span|area|region|box|tiles)$|Rect$|Rects$|Bounds$|Span$|Area$/;   // "tile" alone is the px size
export function validateSource(src) {
  const bad = (m) => { throw new Error("home.src.mjs: " + m); };
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
  const only = (o, f, keys, req = keys) => {
    if (!isObj(o)) bad(`${f} must be an object`);
    for (const k of Object.keys(o)) if (!keys.includes(k)) bad(`${f} has an unknown field ${k}`);
    for (const k of req) if (o[k] === undefined) bad(`${f} needs ${k}`);
  };
  const int = (v, f, lo, hi) => { if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) bad(`${f} must be a whole number from ${lo} to ${hi}, not ${JSON.stringify(v)}`); };
  const str = (v, f) => { if (typeof v !== "string" || !v) bad(`${f} must be text`); };
  const id = (v, f) => { if (typeof v !== "string" || !ID.test(v)) bad(`${f} must be an id (lowercase words joined by hyphens), not ${JSON.stringify(v)}`); };
  only(src, "the source", ["schema", "id", "w", "h", "tile", "coast", "sea", "elevation", "features", "exits", "seaLanes", "satellites"]);
  if (src.schema !== "mapb-source-1") bad(`schema must be "mapb-source-1"`);
  if (src.id !== "home") bad(`id must be "home" (the redesigned island keeps the home id)`);
  int(src.w, "w", 1, 256); int(src.h, "h", 1, 256);
  if (src.tile !== 16) bad("tile must be 16");
  const W = src.w, H = src.h;

  /* the convention, checked over the whole source by field name, so a rectangle can't slip in under a
     schema that forgets it: ...Box is an inclusive tile box object, ...Tile one tile, ...Tiles a list of
     tiles; rect, bounds, span and area are refused as ambiguous; and a bare list of four numbers is
     refused as a rectangle written the wrong way */
  const tile = (v, f) => {
    if (!Array.isArray(v) || v.length !== 2) bad(`${f} must be a tile [x, y]`);
    int(v[0], `${f} x`, 0, W - 1); int(v[1], `${f} y`, 0, H - 1);
  };
  const box = (v, f) => {
    if (!isObj(v)) bad(`${f} must be an inclusive tile box { x0, y0, x1, y1 }${Array.isArray(v) ? ", not a list" : ""}`);
    only(v, f, ["x0", "y0", "x1", "y1"]);
    int(v.x0, `${f}.x0`, 0, W - 1); int(v.x1, `${f}.x1`, 0, W - 1); int(v.y0, `${f}.y0`, 0, H - 1); int(v.y1, `${f}.y1`, 0, H - 1);
    if (v.x0 > v.x1 || v.y0 > v.y1) bad(`${f} must have x0 <= x1 and y0 <= y1 (both corners are inside an inclusive box)`);
  };
  (function scan(v, f) {
    if (Array.isArray(v)) {
      if (v.length === 4 && v.every((q) => typeof q === "number")) bad(`${f} is a list of four numbers; a rectangle must be an inclusive ...Box { x0, y0, x1, y1 }`);
      v.forEach((q, i) => scan(q, `${f}[${i}]`));
      return;
    }
    if (!isObj(v)) return;
    for (const [k, q] of Object.entries(v)) {
      const g = `${f}.${k}`;
      if (AMBIGUOUS.test(k)) bad(`${g}: "${k}" is ambiguous; use ...Box (an inclusive tile box), ...Tile or ...Tiles`);
      if (k.endsWith("Box")) box(q, g);
      else if (k.endsWith("Tiles")) { if (!Array.isArray(q)) bad(`${g} must be a list of tiles`); q.forEach((t, i) => tile(t, `${g}[${i}]`)); }
      else if (k.endsWith("Tile")) tile(q, g);
      else scan(q, g);
    }
  })(src, "source");

  // the coast
  only(src.coast, "coast", ["samplesPerSegment", "points"]);
  if (![4, 8, 16, 32].includes(src.coast.samplesPerSegment)) bad("coast.samplesPerSegment must be 4, 8, 16 or 32 (a power of two keeps the samples exact)");
  if (!Array.isArray(src.coast.points) || src.coast.points.length < 3) bad("coast.points needs at least 3 points");
  const pointIds = new Set();
  src.coast.points.forEach((p, i) => {
    const f = `coast.points[${i}]${p && p.id ? " (" + p.id + ")" : ""}`;
    only(p, f, ["id", "x", "y", "corner"], ["id", "x", "y"]);
    id(p.id, `${f}.id`);
    if (pointIds.has(p.id)) bad(`coast point ${p.id} appears twice`);
    pointIds.add(p.id);
    for (const [k, hi] of [["x", W], ["y", H]]) if (typeof p[k] !== "number" || !Number.isFinite(p[k]) || p[k] < 0 || p[k] > hi) bad(`${f}.${k} must be a position from 0 to ${hi} (outside the canvas: ${JSON.stringify(p[k])})`);
    if (p.corner !== undefined && p.corner !== true) bad(`${f}.corner is true or left out`);
  });
  only(src.sea, "sea", ["shallowWithin"]);
  int(src.sea.shallowWithin, "sea.shallowWithin", 0, 20);
  // elevation: regions (an outline or an ellipse, each with its level 0 to 3), the beach, the ramps
  const E = src.elevation;
  only(E, "elevation", ["regions", "beach", "ramps"]);
  if (!Array.isArray(E.regions) || !E.regions.length) bad("elevation.regions must be a list");
  const rIds = new Set();
  E.regions.forEach((r, i) => {
    const f = `elevation.regions[${i}]${r && r.id ? " (" + r.id + ")" : ""}`;
    only(r, f, ["id", "level", "solid", "reservedFor", "outline", "ellipse"], ["id", "level"]);
    id(r.id, `${f}.id`);
    if (rIds.has(r.id)) bad(`elevation region ${r.id} appears twice`);
    rIds.add(r.id);
    int(r.level, `${f}.level`, 0, 3);
    if (r.solid !== undefined && r.solid !== true) bad(`${f}.solid is true or left out`);
    if (r.solid && (typeof r.reservedFor !== "string" || !r.reservedFor)) bad(`${f}: a solid region says what it's kept for (reservedFor)`);
    if (!r.solid && r.reservedFor !== undefined) bad(`${f}.reservedFor only goes with solid: true`);
    if ((r.outline === undefined) === (r.ellipse === undefined)) bad(`${f} needs exactly one of outline or ellipse`);
    if (r.outline) {
      only(r.outline, `${f}.outline`, ["samplesPerSegment", "points"]);
      if (![4, 8, 16, 32].includes(r.outline.samplesPerSegment)) bad(`${f}.outline.samplesPerSegment must be 4, 8, 16 or 32`);
      if (!Array.isArray(r.outline.points) || r.outline.points.length < 3) bad(`${f}.outline needs at least 3 points`);
      r.outline.points.forEach((p, k) => {
        const g = `${f}.outline.points[${k}]${p && p.id ? " (" + p.id + ")" : ""}`;
        only(p, g, ["id", "x", "y", "corner"], ["id", "x", "y"]);
        id(p.id, `${g}.id`);
        if (pointIds.has(p.id)) bad(`point ${p.id} appears twice (point ids are unique across the whole file)`);
        pointIds.add(p.id);
        for (const [k2, hi] of [["x", W], ["y", H]]) if (typeof p[k2] !== "number" || !Number.isFinite(p[k2]) || p[k2] < -10 || p[k2] > hi + 10) bad(`${g}.${k2} must be a position from -10 to ${hi + 10} (an outline may run up to 10 tiles off the map), not ${JSON.stringify(p[k2])}`);
        if (p.corner !== undefined && p.corner !== true) bad(`${g}.corner is true or left out`);
      });
    } else {
      only(r.ellipse, `${f}.ellipse`, ["cx", "cy", "rx", "ry", "sides"]);
      for (const k2 of ["cx", "cy", "rx", "ry"]) if (typeof r.ellipse[k2] !== "number" || !Number.isFinite(r.ellipse[k2])) bad(`${f}.ellipse.${k2} must be a number`);
      if (r.ellipse.cx < 0 || r.ellipse.cx > W || r.ellipse.cy < 0 || r.ellipse.cy > H) bad(`${f}.ellipse centre must be on the map`);
      if (!(r.ellipse.rx > 0 && r.ellipse.ry > 0)) bad(`${f}.ellipse radii must be above 0`);
      int(r.ellipse.sides, `${f}.ellipse.sides`, 8, 256);
    }
  });
  only(E.beach, "elevation.beach", ["level0Within", "level1Within"]);
  int(E.beach.level0Within, "elevation.beach.level0Within", 0, 10); int(E.beach.level1Within, "elevation.beach.level1Within", 0, 10);
  if (!Array.isArray(E.ramps)) bad("elevation.ramps must be a list");
  const rampIds = new Set(), rampNums = new Set();
  E.ramps.forEach((r, i) => {
    const f = `elevation.ramps[${i}]${r && r.id ? " (" + r.id + ")" : ""}`;
    only(r, f, ["id", "number", "levels", "rampBox"]);
    id(r.id, `${f}.id`);
    if (rampIds.has(r.id)) bad(`ramp ${r.id} appears twice`);
    rampIds.add(r.id);
    int(r.number, `${f}.number`, 1, 99);
    if (rampNums.has(r.number)) bad(`ramp number ${r.number} appears twice`);
    rampNums.add(r.number);
    if (!Array.isArray(r.levels) || r.levels.length !== 2) bad(`${f}.levels must be [lower, upper]`);
    int(r.levels[0], `${f}.levels[0]`, 0, 3); int(r.levels[1], `${f}.levels[1]`, 0, 3);
    if (r.levels[0] >= r.levels[1]) bad(`${f}.levels must be [lower, upper], lower first`);
  });
  // features: tiles that must be land or sea, and the points that shape them
  const fIds = new Set();
  if (!Array.isArray(src.features)) bad("features must be a list");
  src.features.forEach((ft, i) => {
    const f = `features[${i}]`;
    only(ft, f, ["id", "points", "landTiles", "seaTiles"]);
    id(ft.id, `${f}.id`);
    if (fIds.has(ft.id)) bad(`feature ${ft.id} appears twice`);
    fIds.add(ft.id);
    if (!Array.isArray(ft.points) || !ft.points.length) bad(`feature ${ft.id}: points must name at least one coast point`);
    ft.points.forEach((q) => { if (!src.coast.points.some((p) => p.id === q)) bad(`feature ${ft.id}: no coast point ${q}`); });
    if (!ft.landTiles.length && !ft.seaTiles.length) bad(`feature ${ft.id} needs at least one land or sea tile`);
  });
  // the exits: exactly three, each concept in its own field
  only(src.exits, "exits", ["south", "west", "northwest"]);
  only(src.exits.south, "exits.south", ["leadsTo", "arrivalPlazaBox", "ferryTerminalReserveBox", "quayBox", "ferryPierBox", "berthTile", "routeMarkerTile"]);
  only(src.exits.west, "exits.west", ["leadsTo", "jettyBox", "routeMarkerTile"]);
  only(src.exits.northwest, "exits.northwest", ["leadsTo", "capePoint", "landingBox", "routeMarkerTile"]);
  for (const e of ["south", "west", "northwest"]) str(src.exits[e].leadsTo, `exits.${e}.leadsTo`);
  if (!src.coast.points.some((p) => p.id === src.exits.northwest.capePoint)) bad(`exits.northwest.capePoint: no coast point ${src.exits.northwest.capePoint}`);
  // sea lanes and satellites
  const lIds = new Set();
  if (!Array.isArray(src.seaLanes)) bad("seaLanes must be a list");
  src.seaLanes.forEach((l, i) => {
    only(l, `seaLanes[${i}]`, ["id", "toward", "laneBox"]);
    id(l.id, `seaLanes[${i}].id`); str(l.toward, `seaLanes[${i}].toward`);
    if (lIds.has(l.id)) bad(`sea lane ${l.id} appears twice`);
    lIds.add(l.id);
  });
  if (!Array.isArray(src.satellites)) bad("satellites must be a list");
  src.satellites.forEach((s, i) => {
    only(s, `satellites[${i}]`, ["id", "direction", "exit", "lanes"]);
    id(s.id, `satellites[${i}].id`); str(s.direction, `satellites[${i}].direction`);
    if (!["south", "west", "northwest"].includes(s.exit)) bad(`satellite ${s.id}: exit must be south, west or northwest`);
    if (!Array.isArray(s.lanes) || !s.lanes.length) bad(`satellite ${s.id} needs its sea lanes`);
    s.lanes.forEach((q) => { if (!lIds.has(q)) bad(`satellite ${s.id}: no sea lane ${q}`); });
  });
  return src;
}

/* ════════ compile ════════ */
export const GROUND = { deep: 0, shallow: 1, sand: 2, land: 3 }; // the format's ground codes (land is grass, the beach sand)
export const COLL = { none: 0, solid: 1, shallow: 2, deep: 4 };   // the game's collision flags: C_SOLID 1, C_SHALLOW 2, C_DEEP 4
export const WHY = { none: 0, rim: 1, blocked: 2 };                 // why a land tile is solid: a cliff rim, or a solid region
/* a region's polygon: an outline's spline samples, or an ellipse's corners */
export function regionPoly(r) {
  return r.outline ? hermiteLoop(r.outline.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]), r.outline.samplesPerSegment)
    : ellipsePoly(r.ellipse.cx, r.ellipse.cy, r.ellipse.rx, r.ellipse.ry, r.ellipse.sides);
}
export function compile(src, sourceSha256) {
  validateSource(src);
  const W = src.w, H = src.h, n = src.coast.samplesPerSegment;
  const pts = src.coast.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]);
  const samples = hermiteLoop(pts, n);
  const land = raster(samples, W, H);
  const steps = stepsFrom(land, W, H);
  const ground = new Uint8Array(W * H), coll = new Uint16Array(W * H), height = new Uint8Array(W * H), why = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (land[i]) { ground[i] = GROUND.land; coll[i] = COLL.none; }
    else if (steps[i] <= src.sea.shallowWithin) { ground[i] = GROUND.shallow; coll[i] = COLL.shallow; }
    else { ground[i] = GROUND.deep; coll[i] = COLL.deep; }
  }
  // B1b. the levels: the highest region each land tile's centre is in
  const E = src.elevation, polys = E.regions.map(regionPoly), inRegion = E.regions.map(() => new Uint8Array(W * H));
  E.regions.forEach((r, k) => { const g = raster(polys[k], W, H); for (let i = 0; i < W * H; i++) if (land[i] && g[i]) { inRegion[k][i] = 1; if (r.level > height[i]) height[i] = r.level; } });
  // the beach: the coastal band of levels 0 and 1 is sand, at level 0
  const fromSea = stepsFrom(land.map((v) => 1 - v), W, H);
  for (let i = 0; i < W * H; i++) if (land[i] && height[i] < 2 && fromSea[i] <= (height[i] === 0 ? E.beach.level0Within : E.beach.level1Within)) { ground[i] = GROUND.sand; height[i] = 0; }
  // solid regions (the volcano mass): blocked ground
  E.regions.forEach((r, k) => { if (r.solid) for (let i = 0; i < W * H; i++) if (inRegion[k][i]) { coll[i] = COLL.solid; why[i] = WHY.blocked; } });
  // cliff rims: the higher of two neighbouring land tiles is solid unless both are inside one ramp, as its two levels
  const rampOf = new Int16Array(W * H).fill(-1);
  E.ramps.forEach((r, k) => { const b = r.rampBox; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (rampOf[y * W + x] < 0) rampOf[y * W + x] = k; });
  const rampJoins = (a, b) => rampOf[a] >= 0 && rampOf[a] === rampOf[b] && E.ramps[rampOf[a]].levels[0] === height[b] && E.ramps[rampOf[a]].levels[1] === height[a];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = y * W + x;
    if (!land[a] || coll[a] & COLL.solid) continue;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const b = ny * W + nx;
      if (land[b] && height[b] < height[a] && !rampJoins(a, b)) { coll[a] = COLL.solid; why[a] = WHY.rim; break; }
    }
  }
  return { id: src.id, w: W, h: H, tile: src.tile, n, pts, samples, land, ground, height, coll, why, steps, polys, rampOf, sourceSha256 };
}

/* the staged file's text. Everything that decides a byte is here, in a fixed order */
export function serialize(m, src) {
  const rows = (arr, ch) => { const out = []; for (let y = 0; y < m.h; y++) { let r = ""; for (let x = 0; x < m.w; x++) r += ch(arr[y * m.w + x]); out.push(`    "${r}"`); } return out.join(",\n"); };
  const values = [COLL.none, COLL.solid, COLL.shallow, COLL.deep];
  const E = src.elevation;
  const levels = E.regions.map((r) => {
    const o = { id: r.id, level: r.level };
    if (r.solid) o.solid = true;
    if (r.outline) { o.type = "hermite-loop"; o.samplesPerSegment = r.outline.samplesPerSegment; o.pts = r.outline.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]); }
    else { o.type = "ellipse"; o.cx = r.ellipse.cx; o.cy = r.ellipse.cy; o.rx = r.ellipse.rx; o.ry = r.ellipse.ry; o.sides = r.ellipse.sides; }
    return o;
  });
  const ramps = E.ramps.map((r) => ({ id: r.id, levels: r.levels, x0: r.rampBox.x0, y0: r.rampBox.y0, x1: r.rampBox.x1, y1: r.rampBox.y1 }));
  const num = (v) => JSON.stringify(v);
  return [
    `/* STAGED MAP-B home island ("Harbour Crescent", r2.1), stage ${STAGE}. Generated by tools/map-compile.mjs from`,
    `   tools/maps/home.src.mjs: regenerate it, never edit it. NOT RUNTIME-SUPPORTED: this is a draft of map`,
    `   format 2, which the game can't read yet (js/world.js reads format 1; format 2 support begins in B2). It`,
    `   registers window.ISLAND_MAPS_STAGED, never window.ISLAND_MAPS, it is never loaded by a page, and tools/`,
    `   is never deployed. Production runs the 100 x 80 island in js/maps/home.js until an approved switch-over.`,
    `   ground: a hex digit per tile (0 deep, 1 shallow, 2 sand (the beach), 3 grass). height: the level, 0 to 3 (sea`,
    `   0). coll: a base-36 index into coll.values (the game's flags: 1 solid, the cliff rims and the volcano mass;`,
    `   2 shallow; 4 deep). footBlock: none yet. shapes.coast: the closed Hermite spline the land is filled from,`,
    `   [x, y, tangent] per control point (tangent 0 at a corner), samplesPerSegment samples per segment.`,
    `   shapes.levels: the elevation regions in order (a land tile takes the highest level it is in, then the`,
    `   beach rule makes the coastal band of levels 0 and 1 sand at level 0); shapes.beach: that rule;`,
    `   shapes.ramps: the only places a level changes, inclusive tile boxes (x0..x1, y0..y1) and their two levels. */`,
    `(window.ISLAND_MAPS_STAGED = window.ISLAND_MAPS_STAGED || {}).home = {`,
    `  "format": 2, "staged": true, "runtimeSupported": false, "stage": ${num(STAGE)}, "id": ${num(m.id)}, "generator": "tools/map-compile.mjs",`,
    `  "source": "tools/maps/home.src.mjs", "sourceSha256": ${num(m.sourceSha256)}, "tile": ${m.tile}, "w": ${m.w}, "h": ${m.h},`,
    `  "ground": [`, rows(m.ground, (v) => v.toString(16)), `  ],`,
    `  "height": [`, rows(m.height, (v) => v.toString(36)), `  ],`,
    `  "coll": { "values": ${num(values)}, "rows": [`, rows(m.coll, (v) => values.indexOf(v).toString(36)), `  ] },`,
    `  "footBlock": [],`,
    `  "shapes": {`,
    `    "coast": { "type": "hermite-loop", "samplesPerSegment": ${m.n}, "pts": ${num(m.pts)} },`,
    `    "levels": [`, levels.map((o) => `      ${num(o)}`).join(",\n"), `    ],`,
    `    "beach": ${num(E.beach)},`,
    `    "ramps": [`, ramps.map((o) => `      ${num(o)}`).join(",\n"), `    ]`,
    `  }`,
    `};`,
    ``
  ].join("\n");
}

/* only tools/maps/staged/ and tools/out/ may be written, and never anything under js/ (resolved through
   symlinks, .. and letter case, since the Mac's disk ignores case) */
export function guardOut(p) {
  const abs = resolve(ROOT, p);
  let probe = abs, rest = [];
  while (!existsSync(probe)) { rest.unshift(basename(probe)); probe = dirname(probe); }
  const real = join(realpathSync(probe), ...rest).toLowerCase();
  const root = realpathSync(ROOT).toLowerCase();
  const under = (d) => real === d || real.startsWith(d + "/");
  if (under(join(root, "js"))) throw new Error(`refusing to write ${p}: it is under js/, the game's own files (production js/maps/home.js stays the 100 x 80 island until the approved switch-over)`);
  if (![join(root, "tools/maps/staged"), join(root, "tools/out")].some(under)) throw new Error(`refusing to write ${p}: map-compile writes only under tools/maps/staged/ or tools/out/`);
  return abs;
}
export function writeOut(p, text) {
  const abs = guardOut(p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  return abs;
}

export async function loadSource(path = SOURCE_PATH) {
  const text = readFileSync(path, "utf8");
  const mod = await import(pathToFileURL(path).href + "?sha=" + sha256(text));
  return { src: mod.default, sourceSha256: sha256(text) };
}

/* ════════ review images (tools/out/mapb/, ignored) ════════ */
const COLOR = { deep: "#1e4062", shallow: "#346c8c", land: "#709c5c", sand: "#d8c48e" };
const LEVEL = ["#a8c97a", "#5f9a4e", "#9a7f5c", "#c9b8e8"];        // levels 0 to 3: pale green, green, brown, lavender
// orientation labels for the previews only (district bounds come in B1e; nothing reads these)
const ORIENT = [["harbour", 79, 79], ["village", 46, 86], ["ops", 112, 86], ["commons", 76, 52], ["riverlands", 44, 47], ["delta", 17, 80],
  ["koi garden", 109, 63], ["headland", 136, 44], ["research", 116, 19], ["highland", 40, 21], ["volcano", 72, 15], ["shrine knoll", 13, 19], ["brachio meadow", 20, 42]];
function tilesSvg(m, P, ox, oy, colorOf) {
  let s = "";
  for (let y = 0; y < m.h; y++) {
    let x = 0;
    while (x < m.w) {
      const c = colorOf(y * m.w + x); let e = x + 1;
      while (e < m.w && colorOf(y * m.w + e) === c) e++;
      if (c) s += `<rect x="${ox + x * P}" y="${oy + y * P}" width="${(e - x) * P}" height="${P}" fill="${c}"/>`;
      x = e;
    }
  }
  return s;
}
const terrainColor = (m) => (i) => m.land[i] ? (m.ground[i] === GROUND.sand ? COLOR.sand : COLOR.land) : m.ground[i] === GROUND.shallow ? COLOR.shallow : COLOR.deep;
const levelColor = (m) => (i) => m.land[i] ? LEVEL[m.height[i]] : m.ground[i] === GROUND.shallow ? "#2c5068" : "#1c3550";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Helvetica, Arial, sans-serif"><rect width="${w}" height="${h}" fill="#14161c"/>` +
    `<text x="16" y="24" fill="#eee" font-size="16" font-weight="bold">${esc(title)}</text>${body}</svg>`;
}
function axes(m, P, ox, oy, every, strongEvery) {
  let s = "";
  for (let i = 0; i <= m.w; i += every) {
    const strong = i % strongEvery === 0;
    s += `<line x1="${ox + i * P}" y1="${oy}" x2="${ox + i * P}" y2="${oy + m.h * P}" stroke="#fff" stroke-opacity="${strong ? 0.4 : 0.12}" stroke-width="1"/>`;
    if (strong) s += `<text x="${ox + i * P}" y="${oy - 6}" fill="#ccc" font-size="11" text-anchor="middle">${i}</text><text x="${ox + i * P}" y="${oy + m.h * P + 14}" fill="#ccc" font-size="11" text-anchor="middle">${i}</text>`;
  }
  for (let i = 0; i <= m.h; i += every) {
    const strong = i % strongEvery === 0;
    s += `<line x1="${ox}" y1="${oy + i * P}" x2="${ox + m.w * P}" y2="${oy + i * P}" stroke="#fff" stroke-opacity="${strong ? 0.4 : 0.12}" stroke-width="1"/>`;
    if (strong) s += `<text x="${ox - 6}" y="${oy + i * P + 4}" fill="#ccc" font-size="11" text-anchor="end">${i}</text><text x="${ox + m.w * P + 6}" y="${oy + i * P + 4}" fill="#ccc" font-size="11">${i}</text>`;
  }
  return s;
}
export function previewSvgs(m, src, r21) {
  const out = {}, M = 44, T0 = 40;
  // 1. clean terrain
  {
    const P = 6, w = m.w * P + 2 * M, h = m.h * P + T0 + M;
    out["terrain"] = frame(w, h, "MAP-B terrain: grass, beach, shallow sea, deep sea (6 px a tile)", tilesSvg(m, P, M, T0, terrainColor(m)));
  }
  // 2. coast with numbered, named control points
  {
    const P = 8, legW = 560, w = m.w * P + 2 * M + legW, h = Math.max(m.h * P + T0 + M, 40 + src.coast.points.length / 2 * 15 + 60);
    let b = tilesSvg(m, P, M, T0, (i) => m.land[i] ? "#5a7550" : m.ground[i] === GROUND.shallow ? "#2c5068" : "#1c3550");
    b += `<polygon points="${m.samples.map((p) => `${(M + p[0] * P).toFixed(2)},${(T0 + p[1] * P).toFixed(2)}`).join(" ")}" fill="none" stroke="#ffe08a" stroke-width="1.5"/>`;
    src.coast.points.forEach((p, i) => {
      const x = M + p.x * P, y = T0 + p.y * P;
      b += p.corner ? `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#ff6b6b" stroke="#111"/>` : `<circle cx="${x}" cy="${y}" r="4" fill="#7ee0ff" stroke="#111"/>`;
      b += `<text x="${x + 6}" y="${y - 5}" fill="#fff" font-size="10" font-weight="bold" stroke="#111" stroke-width="2.5" paint-order="stroke">${i + 1}</text>`;
    });
    const lx = M * 2 + m.w * P - 20, half = Math.ceil(src.coast.points.length / 2);
    b += `<text x="${lx}" y="${T0}" fill="#ddd" font-size="12">red square: corner (sharp); blue circle: smooth. n, id, x,y</text>`;
    src.coast.points.forEach((p, i) => {
      const col = i < half ? 0 : 1, row = i < half ? i : i - half;
      b += `<text x="${lx + col * 280}" y="${T0 + 20 + row * 15}" fill="${p.corner ? "#ffb0b0" : "#bfefff"}" font-size="11">${i + 1}. ${esc(p.id)} ${p.x},${p.y}</text>`;
    });
    out["coast-points"] = frame(w, h, `MAP-B B1a coast: ${src.coast.points.length} control points, ${m.samples.length} samples (8 px a tile)`, b);
  }
  // 3. drift from the frozen r2.1 mask
  {
    const P = 6, w = m.w * P + 2 * M, h = m.h * P + T0 + M + 30;
    let add = 0, lost = 0;
    const col = (i) => {
      const a = m.land[i] === 1, r = r21.rows[(i / m.w) | 0] ? r21.rows[(i / m.w) | 0][i % m.w] === "1" : false;
      if (a && r) return "#6a8a5e"; if (a) { add++; return "#3a8dff"; } if (r) { lost++; return "#ff4040"; } return "#1c3550";
    };
    const tiles = tilesSvg(m, P, M, T0, col);
    out["drift-r21"] = frame(w, h, `MAP-B B1a vs the frozen r2.1 land mask: ${add + lost} tiles differ (${add} land only now, ${lost} land only in r2.1)`,
      tiles + `<text x="${M}" y="${T0 + m.h * P + 24}" fill="#ccc" font-size="12">green: land in both; blue: land only now; red: land only in r2.1; dark: sea in both</text>`);
  }
  // 4. coordinate grid
  {
    const P = 10, w = m.w * P + 2 * M + 20, h = m.h * P + T0 + M + 20;
    out["grid"] = frame(w, h, "MAP-B B1a grid, 10 px a tile: numbers sit on tile edges (positions, as control points use); tile x spans x to x + 1, so tiles run 0-149 and 0-119",
      tilesSvg(m, P, M, T0 + 10, terrainColor(m)) + axes(m, P, M, T0 + 10, 1, 10));
  }
  // 5. exits, sea lanes and feature checks
  {
    const P = 8, w = m.w * P + 2 * M + 20, h = m.h * P + T0 + M + 20, oy = T0 + 10;
    let b = tilesSvg(m, P, M, oy, terrainColor(m)) + axes(m, P, M, oy, 10, 10);
    const rect = (bx, stroke, fill, label, dash) => `<rect x="${M + bx.x0 * P}" y="${oy + bx.y0 * P}" width="${(bx.x1 - bx.x0 + 1) * P}" height="${(bx.y1 - bx.y0 + 1) * P}" fill="${fill}" stroke="${stroke}" stroke-width="2"${dash ? ' stroke-dasharray="5 3"' : ""}/>` +
      (label ? `<text x="${M + bx.x0 * P + 3}" y="${oy + bx.y0 * P + 11}" fill="${stroke}" font-size="10" font-weight="bold" stroke="#111" stroke-width="2.5" paint-order="stroke">${esc(label)}</text>` : "");
    const dot = (t, fill, label) => `<rect x="${M + t[0] * P + 1}" y="${oy + t[1] * P + 1}" width="${P - 2}" height="${P - 2}" fill="${fill}" stroke="#111"/>` +
      (label ? `<text x="${M + t[0] * P + P + 2}" y="${oy + t[1] * P + 8}" fill="#fff" font-size="10" stroke="#111" stroke-width="2.5" paint-order="stroke">${esc(label)}</text>` : "");
    for (const l of src.seaLanes) b += rect(l.laneBox, "#9fd3ff", "rgba(159,211,255,0.10)", "lane: " + l.id, true);
    const S = src.exits.south, Wx = src.exits.west, N = src.exits.northwest;
    b += rect(S.arrivalPlazaBox, "#ffd166", "rgba(255,209,102,0.25)", "arrival plaza");
    b += rect(S.ferryTerminalReserveBox, "#f4a261", "rgba(244,162,97,0.3)", "terminal reserve");
    b += rect(S.quayBox, "#e9c46a", "rgba(233,196,106,0.3)", "");
    b += `<text x="${M + S.quayBox.x0 * P}" y="${oy + S.quayBox.y1 * P + 20}" fill="#e9c46a" font-size="10" stroke="#111" stroke-width="2.5" paint-order="stroke">quay</text>`;
    b += rect(S.ferryPierBox, "#c8a27a", "rgba(200,162,122,0.4)", "");
    b += `<text x="${M + (S.ferryPierBox.x1 + 1) * P + 3}" y="${oy + (S.ferryPierBox.y0 + 4) * P}" fill="#c8a27a" font-size="10" stroke="#111" stroke-width="2.5" paint-order="stroke">ferry pier</text>`;
    b += dot(S.berthTile, "#ffffff", "berth"); b += dot(S.routeMarkerTile, "#ff5fd2", "south route exit (marker)");
    b += rect(Wx.jettyBox, "#c8a27a", "rgba(200,162,122,0.4)", "jetty"); b += dot(Wx.routeMarkerTile, "#ff5fd2", "west route exit");
    b += rect(N.landingBox, "#c8a27a", "rgba(200,162,122,0.4)", ""); b += dot(N.routeMarkerTile, "#ff5fd2", "rope bridge gap");
    b += `<text x="${M + N.landingBox.x0 * P}" y="${oy + (N.landingBox.y1 + 2) * P + 4}" fill="#c8a27a" font-size="10" stroke="#111" stroke-width="2.5" paint-order="stroke">bridge landing</text>`;
    for (const f of src.features) {
      f.landTiles.forEach((t) => { b += `<circle cx="${M + (t[0] + 0.5) * P}" cy="${oy + (t[1] + 0.5) * P}" r="2.6" fill="#0b3d0b" stroke="#b6ff9e"/>`; });
      f.seaTiles.forEach((t) => { b += `<circle cx="${M + (t[0] + 0.5) * P}" cy="${oy + (t[1] + 0.5) * P}" r="2.6" fill="#fff" stroke="#111"/>`; });
    }
    out["exits-lanes"] = frame(w, h, "MAP-B B1a exits, sea lanes (dashed), feature checks (green ring: land; white: sea); numbers on tile edges", b);
  }
  /* B1b: elevation */
  const label = (x, y, t, fill, size = 11) => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="bold" stroke="#111" stroke-width="3" paint-order="stroke">${esc(t)}</text>`;
  const legend = (x, y, rows) => rows.map(([c, t], k) => `<rect x="${x}" y="${y + k * 18}" width="12" height="12" fill="${c}" stroke="#111"/><text x="${x + 18}" y="${y + k * 18 + 11}" fill="#ddd" font-size="12">${esc(t)}</text>`).join("");
  const counts = [0, 1, 2, 3].map((l) => { let n = 0; for (let i = 0; i < m.w * m.h; i++) if (m.land[i] && m.height[i] === l) n++; return n; });
  const lvLegend = [[LEVEL[0], `level 0: lowland and beaches (${counts[0]} tiles)`], [LEVEL[1], `level 1: meadow terrace (${counts[1]})`], [LEVEL[2], `level 2: highland, headland plateau (${counts[2]})`], [LEVEL[3], `level 3: volcano mass, shrine knoll (${counts[3]})`]];
  // 6. the four levels, with orientation labels
  {
    const P = 8, legW = 330, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, levelColor(m));
    for (const [t, x, y] of ORIENT) b += `<text x="${M + x * P}" y="${T0 + y * P}" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle" stroke="#111" stroke-width="3" paint-order="stroke">${esc(t)}</text>`;
    b += legend(M * 2 + m.w * P - 20, T0, lvLegend) + `<text x="${M * 2 + m.w * P - 20}" y="${T0 + 90}" fill="#aaa" font-size="11">place names: orientation only (districts come in B1e)</text>`;
    out["elevation"] = frame(w, h, "MAP-B B1b elevation: the four levels (8 px a tile)", b);
  }
  // 7. levels with the coast and the named elevation outlines
  {
    const P = 8, legW = 330, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, levelColor(m));
    b += `<polygon points="${m.samples.map((p) => `${(M + p[0] * P).toFixed(2)},${(T0 + p[1] * P).toFixed(2)}`).join(" ")}" fill="none" stroke="#ffe08a" stroke-width="1.6"/>`;
    b += `<clipPath id="map"><rect x="${M}" y="${T0}" width="${m.w * P}" height="${m.h * P}"/></clipPath><g clip-path="url(#map)">`;
    src.elevation.regions.forEach((r, k) => {
      const col = ["#ffffff", "#ff9f6b", "#ff9f6b", "#e0d0ff", "#e0d0ff"][k] || "#fff";
      b += `<polygon points="${m.polys[k].map((p) => `${(M + p[0] * P).toFixed(2)},${(T0 + p[1] * P).toFixed(2)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="6 3"/>`;
      if (r.outline) for (const p of r.outline.points) if (p.x >= 0 && p.x <= m.w && p.y >= 0 && p.y <= m.h) b += `<circle cx="${M + p.x * P}" cy="${T0 + p.y * P}" r="3" fill="${col}" stroke="#111"/>`;
    });
    b += `</g>`;
    for (const r of src.elevation.regions) {
      const at = r.ellipse ? [r.ellipse.cx, r.ellipse.cy - r.ellipse.ry - 0.6] : r.id === "meadow-terrace" ? [52, 66] : r.id === "highland" ? [40, 31] : [137, 37.6];
      b += label(M + at[0] * P - 30, T0 + at[1] * P, r.id + ` (level ${r.level}${r.solid ? ", solid" : ""})`, "#fff", 11);
    }
    b += legend(M * 2 + m.w * P - 20, T0, lvLegend.concat([["#ffe08a", "the coast (locked, B1a)"], ["#ffffff", "meadow-terrace outline"], ["#ff9f6b", "highland and headland-plateau outlines"], ["#e0d0ff", "level-3 ellipses"]]));
    b += `<text x="${M * 2 + m.w * P - 20}" y="${T0 + 160}" fill="#aaa" font-size="11">dots: named outline points (in home.src.mjs)</text>`;
    out["elevation-coast"] = frame(w, h, "MAP-B B1b elevation with the coast and the named outlines the levels are filled from", b);
  }
  // 8. the eight ramps
  {
    const P = 8, legW = 360, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, (i) => m.coll[i] & COLL.solid && m.land[i] ? "#3a2c28" : levelColor(m)(i));
    for (const r of src.elevation.ramps) {
      const bx = r.rampBox;
      b += `<rect x="${M + bx.x0 * P}" y="${T0 + bx.y0 * P}" width="${(bx.x1 - bx.x0 + 1) * P}" height="${(bx.y1 - bx.y0 + 1) * P}" fill="rgba(80,255,160,0.18)" stroke="#50ffa0" stroke-width="2"/>`;
      b += `<circle cx="${M + (bx.x0 + bx.x1 + 1) / 2 * P}" cy="${T0 + (bx.y0 + bx.y1 + 1) / 2 * P}" r="9" fill="#50ffa0" stroke="#111"/><text x="${M + (bx.x0 + bx.x1 + 1) / 2 * P}" y="${T0 + (bx.y0 + bx.y1 + 1) / 2 * P + 4}" fill="#111" font-size="12" font-weight="bold" text-anchor="middle">${r.number}</text>`;
    }
    const lx = M * 2 + m.w * P - 20;
    b += legend(lx, T0, lvLegend.concat([["#3a2c28", "solid: cliff rims and the volcano mass"], ["#50ffa0", "ramp (the only level changes)"]]));
    src.elevation.ramps.forEach((r, k) => { const bx = r.rampBox; b += `<text x="${lx}" y="${T0 + 130 + k * 18}" fill="#bfffd9" font-size="12">${r.number}. ${esc(r.id)}: levels ${r.levels[0]}-${r.levels[1]}, x ${bx.x0}-${bx.x1}, y ${bx.y0}-${bx.y1}</text>`; });
    out["ramps"] = frame(w, h, "MAP-B B1b: the eight ramps (inclusive tile boxes), the only places a level changes", b);
  }
  // 9. collision: walkable ground by level, cliff rims, the blocked volcano, the sea
  {
    const P = 8, legW = 330, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    const shade = ["#cfe3b0", "#9cc78a", "#c2ae92", "#e3d9f5"];
    let rims = 0, blocked = 0;
    for (let i = 0; i < m.w * m.h; i++) { if (m.why[i] === WHY.rim) rims++; else if (m.why[i] === WHY.blocked) blocked++; }
    const col = (i) => {
      if (!m.land[i]) return m.coll[i] & COLL.shallow ? "#2c5068" : "#1c3550";
      if (m.why[i] === WHY.rim) return "#d2442f";
      if (m.why[i] === WHY.blocked) return "#2b2b33";
      return shade[m.height[i]];
    };
    let b = tilesSvg(m, P, M, T0, col);
    b += legend(M * 2 + m.w * P - 20, T0, [[shade[0], "walkable, level 0"], [shade[1], "walkable, level 1"], [shade[2], "walkable, level 2"], [shade[3], "walkable, level 3 (shrine knoll)"],
      ["#d2442f", `cliff rim, solid (${rims} tiles)`], ["#2b2b33", `volcano mass, solid (${blocked} tiles)`], ["#2c5068", "shallow sea (flag 2)"], ["#1c3550", "deep sea (flag 4)"]]);
    out["collision"] = frame(w, h, "MAP-B B1b collision: walkable ground, cliff rims and the blocked volcano mass (8 px a tile)", b);
  }
  return out;
}
async function writePreviews(m, src) {
  const r21 = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-r21.json"), "utf8"));
  const svgs = previewSvgs(m, src, r21);
  mkdirSync(PREVIEW_DIR, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(); const page = await browser.newPage();
  const files = [];
  for (const [name, svg] of Object.entries(svgs)) {
    writeOut(join(PREVIEW_DIR, name + ".svg"), svg);
    const [w, h] = [+/width="(\d+)"/.exec(svg)[1], +/height="(\d+)"/.exec(svg)[1]];
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><body style="margin:0;background:#14161c">${svg}</body>`);
    const png = join(PREVIEW_DIR, name + ".png"); guardOut(png);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
    files.push(png);
  }
  await browser.close();
  return files;
}

/* ════════ the command line ════════ */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const { src, sourceSha256 } = await loadSource();
  const m = compile(src, sourceSha256);
  const text = serialize(m, src);
  if (args.includes("--stdout")) process.stdout.write(text);
  else if (args.includes("--check")) {
    const cur = existsSync(STAGED_PATH) ? readFileSync(STAGED_PATH, "utf8") : null;
    if (cur !== text) { console.error(`map-compile --check: ${STAGED_PATH.replace(ROOT + "/", "")} is ${cur === null ? "missing" : "stale"}; run node tools/map-compile.mjs`); process.exit(1); }
    console.log(`map-compile --check: tools/maps/staged/home.js is current (${Buffer.byteLength(text)} bytes, sha256 ${sha256(text).slice(0, 16)})`);
  } else {
    const outArg = args.find((a) => a.startsWith("--out="));
    const p = writeOut(outArg ? outArg.slice(6) : STAGED_PATH, text);
    let land = 0; for (const v of m.land) land += v;
    console.log(`map-compile: wrote ${p.replace(ROOT + "/", "")} (${Buffer.byteLength(text)} bytes; ${m.w} x ${m.h}, ${land} land tiles, ${src.coast.points.length} coast points)`);
  }
  if (args.includes("--preview")) for (const f of await writePreviews(m, src)) console.log("preview: " + f.replace(ROOT + "/", ""));
}
