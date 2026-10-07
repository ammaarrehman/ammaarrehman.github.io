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
   - B1d: the corridors and the infrastructure, in the study's order: the plazas pave grass and beach;
     the paths pave grass and beach within their class's half-width of their polyline, and turn river
     under them into bridge (walkable); the docks (the quay, the ferry pier, the west jetty, from the
     exits' boxes) are dock over land or water (walkable); the helipad is pad. Paths and pad keep any
     cliff rim under them solid (map-lint proves there is none);
   - B1c: the water and the volcano's terrain: the bodies (pond, tarn, lagoon, marsh: ground pond), then
     the rivers (ground river), both shallow water that can't be walked, on land tiles only, never
     changing a tile's level; the crater (ground lava, solid and lava); the waterfalls, derived wherever
     two neighbouring river tiles are on different levels. Water and lava are never cliff rims;
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
import { hermiteLoop, hermiteOpen, segDist, ellipsePoly, inside, raster, stepsFrom } from "./maps/geom.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_PATH = join(ROOT, "tools/maps/home.src.mjs");
export const STAGED_PATH = join(ROOT, "tools/maps/staged/home.js");
export const PREVIEW_DIR = join(ROOT, "tools/out/mapb");
export const STAGE = "B1d";
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
  only(src, "the source", ["schema", "id", "w", "h", "tile", "coast", "sea", "elevation", "water", "corridors", "infrastructure", "features", "exits", "seaLanes", "satellites"]);
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
  // water: bodies, rivers, the volcano's terrain, the planned crossings
  const ellipse = (e, f) => {
    only(e, f, ["cx", "cy", "rx", "ry", "sides"]);
    for (const k2 of ["cx", "cy", "rx", "ry"]) if (typeof e[k2] !== "number" || !Number.isFinite(e[k2])) bad(`${f}.${k2} must be a number`);
    if (e.cx < 0 || e.cx > W || e.cy < 0 || e.cy > H) bad(`${f} centre must be on the map`);
    if (!(e.rx > 0 && e.ry > 0)) bad(`${f} radii must be above 0`);
    int(e.sides, `${f}.sides`, 8, 256);
  };
  const onMapPoint = (p, g) => {
    only(p, g, ["id", "x", "y", "corner"], ["id", "x", "y"]);
    id(p.id, `${g}.id`);
    if (pointIds.has(p.id)) bad(`point ${p.id} appears twice (point ids are unique across the whole file)`);
    pointIds.add(p.id);
    for (const [k2, hi] of [["x", W], ["y", H]]) if (typeof p[k2] !== "number" || !Number.isFinite(p[k2]) || p[k2] < 0 || p[k2] > hi) bad(`${g}.${k2} must be a position from 0 to ${hi}, not ${JSON.stringify(p[k2])}`);
    if (p.corner !== undefined && p.corner !== true) bad(`${g}.corner is true or left out`);
  };
  const Wt = src.water;
  only(Wt, "water", ["bodies", "rivers", "volcano", "crossings"]);
  const wIds = new Set();
  const wid = (v, f) => { id(v, f); if (wIds.has(v) || rIds.has(v)) bad(`${f}: ${v} is already used`); wIds.add(v); };
  if (!Array.isArray(Wt.bodies)) bad("water.bodies must be a list");
  Wt.bodies.forEach((b, i) => {
    const f = `water.bodies[${i}]${b && b.id ? " (" + b.id + ")" : ""}`;
    only(b, f, ["id", "kind", "meetsSea", "ellipse", "outline", "withinBox"], ["id", "kind", "withinBox"]);
    wid(b.id, `${f}.id`);
    if (!["pond", "tarn", "lagoon", "marsh"].includes(b.kind)) bad(`${f}.kind must be pond, tarn, lagoon or marsh`);
    if (b.meetsSea !== undefined && b.meetsSea !== true) bad(`${f}.meetsSea is true or left out`);
    if ((b.ellipse === undefined) === (b.outline === undefined)) bad(`${f} needs exactly one of ellipse or outline`);
    if (b.ellipse) ellipse(b.ellipse, `${f}.ellipse`);
    else {
      only(b.outline, `${f}.outline`, ["samplesPerSegment", "points"]);
      if (![4, 8, 16, 32].includes(b.outline.samplesPerSegment)) bad(`${f}.outline.samplesPerSegment must be 4, 8, 16 or 32`);
      if (!Array.isArray(b.outline.points) || b.outline.points.length < 3) bad(`${f}.outline needs at least 3 points`);
      b.outline.points.forEach((p, k) => onMapPoint(p, `${f}.outline.points[${k}]`));
    }
  });
  if (!Array.isArray(Wt.rivers) || !Wt.rivers.length) bad("water.rivers must be a list");
  Wt.rivers.forEach((r, i) => {
    const f = `water.rivers[${i}]${r && r.id ? " (" + r.id + ")" : ""}`;
    only(r, f, ["id", "samplesPerSegment", "halfWidth", "points"]);
    wid(r.id, `${f}.id`);
    int(r.samplesPerSegment, `${f}.samplesPerSegment`, 2, 32);
    if (typeof r.halfWidth === "number") { if (!(r.halfWidth > 0)) bad(`${f}.halfWidth must be above 0`); }
    else { only(r.halfWidth, `${f}.halfWidth`, ["base", "gain", "power"]); for (const k2 of ["base", "gain", "power"]) if (typeof r.halfWidth[k2] !== "number" || !Number.isFinite(r.halfWidth[k2])) bad(`${f}.halfWidth.${k2} must be a number`); if (!(r.halfWidth.base > 0)) bad(`${f}.halfWidth.base must be above 0`); }
    if (!Array.isArray(r.points) || r.points.length < 2) bad(`${f} needs at least 2 points`);
    r.points.forEach((p, k) => onMapPoint(p, `${f}.points[${k}]`));
  });
  only(Wt.volcano, "water.volcano", ["mass", "cone", "crater"]);
  const massR = E.regions.find((r) => r.id === Wt.volcano.mass);
  if (!massR || !massR.solid) bad(`water.volcano.mass must name a solid elevation region, not ${JSON.stringify(Wt.volcano.mass)}`);
  ellipse(Wt.volcano.cone, "water.volcano.cone"); ellipse(Wt.volcano.crater, "water.volcano.crater");
  if (!Array.isArray(Wt.crossings)) bad("water.crossings must be a list");
  Wt.crossings.forEach((c, i) => { only(c, `water.crossings[${i}]`, ["id", "crossingBox"]); wid(c.id, `water.crossings[${i}].id`); });
  // corridors: half-widths, plazas, paths, route ends
  const C = src.corridors;
  only(C, "corridors", ["halfWidths", "plazas", "paths", "routeEnds"]);
  only(C.halfWidths, "corridors.halfWidths", ["main", "secondary", "service", "trail"]);
  for (const k2 of ["main", "secondary", "service", "trail"]) if (typeof C.halfWidths[k2] !== "number" || !(C.halfWidths[k2] > 0 && C.halfWidths[k2] < 4)) bad(`corridors.halfWidths.${k2} must be a number above 0 and below 4`);
  const cIds = new Set(), cid = (v, f) => { id(v, f); if (cIds.has(v)) bad(`${f}: ${v} appears twice`); cIds.add(v); };
  if (!Array.isArray(C.plazas)) bad("corridors.plazas must be a list");
  C.plazas.forEach((pz, i) => {
    const f = `corridors.plazas[${i}]${pz && pz.id ? " (" + pz.id + ")" : ""}`;
    only(pz, f, ["id", "plazaBox", "ellipse", "sameAs"], ["id"]);
    cid(pz.id, `${f}.id`);
    if ([pz.plazaBox, pz.ellipse, pz.sameAs].filter((v) => v !== undefined).length !== 1) bad(`${f} needs exactly one of plazaBox, ellipse or sameAs`);
    if (pz.ellipse) ellipse(pz.ellipse, `${f}.ellipse`);
    if (pz.sameAs !== undefined && pz.sameAs !== "exits.south.arrivalPlazaBox") bad(`${f}.sameAs can only be "exits.south.arrivalPlazaBox"`);
  });
  if (!Array.isArray(C.paths) || !C.paths.length) bad("corridors.paths must be a list");
  C.paths.forEach((pa, i) => {
    const f = `corridors.paths[${i}]${pa && pa.id ? " (" + pa.id + ")" : ""}`;
    only(pa, f, ["id", "class", "line"]);
    cid(pa.id, `${f}.id`);
    if (!["main", "secondary", "service", "trail"].includes(pa.class)) bad(`${f}.class must be main, secondary, service or trail`);
    if (!Array.isArray(pa.line) || pa.line.length < 2) bad(`${f}.line needs at least 2 positions`);
    pa.line.forEach((q, k) => { if (!Array.isArray(q) || q.length !== 2 || q.some((v) => typeof v !== "number" || !Number.isFinite(v))) bad(`${f}.line[${k}] must be a position [x, y]`); if (q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H) bad(`${f}.line[${k}] must be on the map (x 0 to ${W}, y 0 to ${H}), not ${JSON.stringify(q)}`); });
  });
  if (!Array.isArray(C.routeEnds) || !C.routeEnds.length) bad("corridors.routeEnds must be a list");
  const reIds = new Set();                                          // route ends name destinations, in their own namespace
  C.routeEnds.forEach((r, i) => { only(r, `corridors.routeEnds[${i}]`, ["id", "endTile"]); id(r.id, `corridors.routeEnds[${i}].id`); if (reIds.has(r.id)) bad(`route end ${r.id} appears twice`); reIds.add(r.id); });
  only(src.infrastructure, "infrastructure", ["helipadBox"]);
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
export const GROUND = { deep: 0, shallow: 1, sand: 2, land: 3, path: 4, pond: 5, dock: 6, lava: 7, pad: 8, river: 9, bridge: 10 }; // the format's ground codes
export const COLL = { none: 0, solid: 1, shallow: 2, deep: 4, lava: 257 };   // the game's flags: C_SOLID 1, C_SHALLOW 2, C_DEEP 4, C_LAVA 256 (lava is solid too)
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
  const beach = new Uint8Array(W * H);                              // the beach before any water (map-lint accounts for it)
  for (let i = 0; i < W * H; i++) if (land[i] && height[i] < 2 && fromSea[i] <= (height[i] === 0 ? E.beach.level0Within : E.beach.level1Within)) { ground[i] = GROUND.sand; height[i] = 0; beach[i] = 1; }
  // solid regions (the volcano mass): blocked ground
  E.regions.forEach((r, k) => { if (r.solid) for (let i = 0; i < W * H; i++) if (inRegion[k][i]) { coll[i] = COLL.solid; why[i] = WHY.blocked; } });
  // B1c. water: the bodies in order, then the rivers (a later one wins a tile); land tiles only, levels unchanged
  const Wt = src.water, water = new Int8Array(W * H).fill(-1), waterIds = Wt.bodies.map((b) => b.id).concat(Wt.rivers.map((r) => r.id));
  const bodyPolys = Wt.bodies.map((b) => b.ellipse ? ellipsePoly(b.ellipse.cx, b.ellipse.cy, b.ellipse.rx, b.ellipse.ry, b.ellipse.sides)
    : hermiteLoop(b.outline.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]), b.outline.samplesPerSegment));
  Wt.bodies.forEach((b, k) => { const g = raster(bodyPolys[k], W, H); for (let i = 0; i < W * H; i++) if (land[i] && g[i]) { ground[i] = GROUND.pond; coll[i] = COLL.shallow; why[i] = WHY.none; water[i] = k; } });
  const riverLines = Wt.rivers.map((r) => hermiteOpen(r.points.map((p) => [p.x, p.y]), r.samplesPerSegment));
  Wt.rivers.forEach((r, k) => {
    const line = riverLines[k], n = line.length - 1;
    const hw = (j) => typeof r.halfWidth === "number" ? r.halfWidth : r.halfWidth.base + r.halfWidth.gain * Math.pow(j / n, r.halfWidth.power);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      let best = 0, bd = Infinity;
      for (let j = 0; j < n; j++) { const d = segDist(x + 0.5, y + 0.5, line[j], line[j + 1]); if (d < bd) { bd = d; best = j; } }
      if (bd <= hw(best)) { ground[i] = GROUND.river; coll[i] = COLL.shallow; why[i] = WHY.none; water[i] = Wt.bodies.length + k; }
    }
  });
  // the volcano: the cone and the crater, inside the solid mass; the crater is lava (solid and lava)
  const conePoly = ellipsePoly(Wt.volcano.cone.cx, Wt.volcano.cone.cy, Wt.volcano.cone.rx, Wt.volcano.cone.ry, Wt.volcano.cone.sides);
  const craterPoly = ellipsePoly(Wt.volcano.crater.cx, Wt.volcano.crater.cy, Wt.volcano.crater.rx, Wt.volcano.crater.ry, Wt.volcano.crater.sides);
  const cone = raster(conePoly, W, H), crater = raster(craterPoly, W, H);
  for (let i = 0; i < W * H; i++) if (land[i] && crater[i]) { ground[i] = GROUND.lava; coll[i] = COLL.lava; why[i] = WHY.blocked; }
  const isWet = (i) => ground[i] === GROUND.river || ground[i] === GROUND.pond || ground[i] === GROUND.lava;
  // cliff rims: the higher of two neighbouring land tiles is solid unless both are inside one ramp, as its two levels
  const rampOf = new Int16Array(W * H).fill(-1);
  E.ramps.forEach((r, k) => { const b = r.rampBox; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (rampOf[y * W + x] < 0) rampOf[y * W + x] = k; });
  const rampJoins = (a, b) => rampOf[a] >= 0 && rampOf[a] === rampOf[b] && E.ramps[rampOf[a]].levels[0] === height[b] && E.ramps[rampOf[a]].levels[1] === height[a];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = y * W + x;
    if (!land[a] || coll[a] & COLL.solid || isWet(a)) continue;     // water and lava are never rims
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const b = ny * W + nx;
      if (land[b] && height[b] < height[a] && !rampJoins(a, b)) { coll[a] = COLL.solid; why[a] = WHY.rim; break; }
    }
  }
  // B1d. corridors and infrastructure, in the study's order: plazas, paths (river under them is bridge), docks, the pad
  const C = src.corridors, CLASS = ["main", "secondary", "service", "trail"], pathClass = new Int8Array(W * H).fill(-1), pathOf = new Int16Array(W * H).fill(-1);
  const paveable = (i) => ground[i] === GROUND.land || ground[i] === GROUND.sand;
  const plazaTiles = C.plazas.map((pz) => {
    const g = new Uint8Array(W * H);
    if (pz.ellipse) { const r = raster(ellipsePoly(pz.ellipse.cx, pz.ellipse.cy, pz.ellipse.rx, pz.ellipse.ry, pz.ellipse.sides), W, H); for (let i = 0; i < W * H; i++) g[i] = r[i]; }
    else { const b = pz.sameAs ? src.exits.south.arrivalPlazaBox : pz.plazaBox; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) g[y * W + x] = 1; }
    for (let i = 0; i < W * H; i++) if (g[i] && land[i] && paveable(i)) ground[i] = GROUND.path;
    return g;
  });
  C.paths.forEach((pa, k) => {
    const hw = C.halfWidths[pa.class], xs = pa.line.map((q) => q[0]), ys = pa.line.map((q) => q[1]);
    for (let y = Math.max(0, Math.trunc(Math.min(...ys)) - 3); y < Math.min(H, Math.trunc(Math.max(...ys)) + 4); y++)
      for (let x = Math.max(0, Math.trunc(Math.min(...xs)) - 3); x < Math.min(W, Math.trunc(Math.max(...xs)) + 4); x++) {
        let d = Infinity; for (let j = 0; j < pa.line.length - 1; j++) d = Math.min(d, segDist(x + 0.5, y + 0.5, pa.line[j], pa.line[j + 1]));
        if (d > hw) continue;
        const i = y * W + x;
        if (pathClass[i] < 0) { pathClass[i] = CLASS.indexOf(pa.class); pathOf[i] = k; }
        if (ground[i] === GROUND.river) { ground[i] = GROUND.bridge; coll[i] = COLL.none; }
        else if (paveable(i)) ground[i] = GROUND.path;
      }
  });
  const dockBoxes = [["harbour-quay", src.exits.south.quayBox], ["ferry-pier", src.exits.south.ferryPierBox], ["west-service-jetty", src.exits.west.jettyBox]];
  for (const [, b] of dockBoxes) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = y * W + x; ground[i] = GROUND.dock; coll[i] = COLL.none; why[i] = WHY.none; }
  { const b = src.infrastructure.helipadBox; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) ground[y * W + x] = GROUND.pad; }
  // the waterfalls: neighbouring river tiles on different levels, grouped by the levels they join and by touch
  const fallAt = new Uint8Array(W * H), fallPairs = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
    if (nx >= W || ny >= H) continue;
    const a = y * W + x, b = ny * W + nx;
    if (ground[a] === GROUND.river && ground[b] === GROUND.river && height[a] !== height[b]) { fallAt[a] = fallAt[b] = 1; fallPairs.push([a, b]); }
  }
  const falls = [], seenF = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!fallAt[i] || seenF[i]) continue;
    const q = [i]; seenF[i] = 1;
    for (let k = 0; k < q.length; k++) { const c = q[k], cx = c % W, cy = (c - cx) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy, j = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && fallAt[j] && !seenF[j]) { seenF[j] = 1; q.push(j); } } }
    q.sort((p1, p2) => p1 - p2);
    const lv = q.map((c) => height[c]);
    falls.push({ upper: Math.max(...lv), lower: Math.min(...lv), tiles: q.map((c) => [c % W, (c - c % W) / W]) });
  }
  return { id: src.id, w: W, h: H, tile: src.tile, n, pts, samples, land, ground, height, coll, why, steps, polys, rampOf, water, waterIds, bodyPolys, riverLines, cone, crater, conePoly, craterPoly, falls, beach, pathClass, pathOf, plazaTiles, dockBoxes, shallowWithin: src.sea.shallowWithin, sourceSha256 };
}

/* the staged file's text. Everything that decides a byte is here, in a fixed order */
export function serialize(m, src) {
  const rows = (arr, ch) => { const out = []; for (let y = 0; y < m.h; y++) { let r = ""; for (let x = 0; x < m.w; x++) r += ch(arr[y * m.w + x]); out.push(`    "${r}"`); } return out.join(",\n"); };
  const values = [COLL.none, COLL.solid, COLL.shallow, COLL.deep, COLL.lava];
  const E = src.elevation;
  const levels = E.regions.map((r) => {
    const o = { id: r.id, level: r.level };
    if (r.solid) o.solid = true;
    if (r.outline) { o.type = "hermite-loop"; o.samplesPerSegment = r.outline.samplesPerSegment; o.pts = r.outline.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]); }
    else { o.type = "ellipse"; o.cx = r.ellipse.cx; o.cy = r.ellipse.cy; o.rx = r.ellipse.rx; o.ry = r.ellipse.ry; o.sides = r.ellipse.sides; }
    return o;
  });
  const ramps = E.ramps.map((r) => ({ id: r.id, levels: r.levels, x0: r.rampBox.x0, y0: r.rampBox.y0, x1: r.rampBox.x1, y1: r.rampBox.y1 }));
  const Wt = src.water, ell = (e) => ({ cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, sides: e.sides });
  const bodies = Wt.bodies.map((b) => {
    const o = { id: b.id, kind: b.kind };
    if (b.meetsSea) o.meetsSea = true;
    if (b.ellipse) Object.assign(o, { type: "ellipse" }, ell(b.ellipse));
    else Object.assign(o, { type: "hermite-loop", samplesPerSegment: b.outline.samplesPerSegment, pts: b.outline.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]) });
    return o;
  });
  const rivers = Wt.rivers.map((r) => ({ id: r.id, type: "hermite-open", samplesPerSegment: r.samplesPerSegment, halfWidth: r.halfWidth, pts: r.points.map((p) => [p.x, p.y]) }));
  const num = (v) => JSON.stringify(v);
  return [
    `/* STAGED MAP-B home island ("Harbour Crescent", r2.1), stage ${STAGE}. Generated by tools/map-compile.mjs from`,
    `   tools/maps/home.src.mjs: regenerate it, never edit it. NOT RUNTIME-SUPPORTED: this is a draft of map`,
    `   format 2, which the game can't read yet (js/world.js reads format 1; format 2 support begins in B2). It`,
    `   registers window.ISLAND_MAPS_STAGED, never window.ISLAND_MAPS, it is never loaded by a page, and tools/`,
    `   is never deployed. Production runs the 100 x 80 island in js/maps/home.js until an approved switch-over.`,
    `   ground: a hex digit per tile (0 deep, 1 shallow, 2 sand (the beach), 3 grass, 4 path, 5 still water, 6 dock,`,
    `   7 lava, 8 pad, 9 river, a bridge). Paths, plazas, bridges, docks and the pad can be walked.`,
    `   height: the level, 0 to 3 (the sea 0; water keeps the level of the land it lies on). coll: a base-36 index`,
    `   into coll.values (the game's flags: 1 solid, the cliff rims and the volcano mass; 2 shallow, the sea's`,
    `   shallows, rivers and still water; 4 deep; 257 solid and lava, the crater). footBlock: none yet.`,
    `   shapes.coast: the closed Hermite spline the land is filled from, [x, y, tangent] per control point (tangent`,
    `   0 at a corner). shapes.levels: the elevation regions in order (a land tile takes the highest level it is`,
    `   in, then the beach rule makes the coastal band of levels 0 and 1 sand at level 0); shapes.beach: that rule;`,
    `   shapes.ramps: the only places a level changes, inclusive tile boxes (x0..x1, y0..y1) and their two levels.`,
    `   shapes.water: the still water in order (kind pond, tarn, lagoon or marsh); shapes.rivers: open Hermite`,
    `   centre lines and their half-widths; shapes.volcano: the cone and crater ellipses inside the solid mass;`,
    `   shapes.falls: derived, where the river drops a level (its tiles, and the two levels). shapes.corridors:`,
    `   the half-width per class, the plazas, and each path's class and polyline; shapes.docks and shapes.helipad:`,
    `   inclusive tile boxes. A dock over water keeps the sea's level, 0. */`,
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
    `    "ramps": [`, ramps.map((o) => `      ${num(o)}`).join(",\n"), `    ],`,
    `    "water": [`, bodies.map((o) => `      ${num(o)}`).join(",\n"), `    ],`,
    `    "rivers": [`, rivers.map((o) => `      ${num(o)}`).join(",\n"), `    ],`,
    `    "volcano": ${num({ mass: Wt.volcano.mass, cone: ell(Wt.volcano.cone), crater: ell(Wt.volcano.crater) })},`,
    `    "falls": [`, m.falls.map((f) => `      ${num(f)}`).join(",\n"), `    ],`,
    `    "corridors": {`,
    `      "halfWidths": ${num(src.corridors.halfWidths)},`,
    `      "plazas": [`, src.corridors.plazas.map((pz) => `        ${num(pz.ellipse ? { id: pz.id, type: "ellipse", ...pz.ellipse } : { id: pz.id, type: "box", ...(pz.sameAs ? src.exits.south.arrivalPlazaBox : pz.plazaBox) })}`).join(",\n"), `      ],`,
    `      "paths": [`, src.corridors.paths.map((pa) => `        ${num({ id: pa.id, class: pa.class, line: pa.line })}`).join(",\n"), `      ]`,
    `    },`,
    `    "docks": [`, m.dockBoxes.map(([id, b]) => `      ${num({ id, ...b })}`).join(",\n"), `    ],`,
    `    "helipad": ${num(src.infrastructure.helipadBox)}`,
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
const WCOL = { river: "#3d8fd6", pond: "#4fb0cf", tarn: "#6cc3dd", lagoon: "#58b6b0", marsh: "#6f9f86", lava: "#f06a28", cone: "#4b4242", scree: "#7a6c62" };
const waterColor = (m, i) => { if (m.water[i] < 0) return null; const id = m.waterIds[m.water[i]], b = WATER_KIND[id]; return b ? WCOL[b] : WCOL.river; };
let WATER_KIND = {};
const terrainColor = (m) => (i) => m.land[i] ? (m.ground[i] === GROUND.lava ? WCOL.lava : waterColor(m, i) || (m.ground[i] === GROUND.sand ? COLOR.sand : COLOR.land)) : m.ground[i] === GROUND.shallow ? COLOR.shallow : COLOR.deep;
const levelColor = (m) => (i) => m.land[i] ? LEVEL[m.height[i]] : m.ground[i] === GROUND.shallow ? "#2c5068" : "#1c3550";
const levelWaterColor = (m) => (i) => m.land[i] && m.ground[i] === GROUND.lava ? WCOL.lava : (m.land[i] && waterColor(m, i)) || levelColor(m)(i);
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
  WATER_KIND = {}; src.water.bodies.forEach((b) => (WATER_KIND[b.id] = b.kind));
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
  /* B1c: water and the volcano */
  const wcount = {}; for (let i = 0; i < m.w * m.h; i++) if (m.water[i] >= 0) { const id = m.waterIds[m.water[i]]; wcount[id] = (wcount[id] || 0) + 1; }
  const waterLegend = [[WCOL.river, `river: main-river ${wcount["main-river"]} tiles, delta-branch ${wcount["delta-branch"]}`], [WCOL.pond, `koi-pond ${wcount["koi-pond"]}`], [WCOL.tarn, `tarn (the source) ${wcount["tarn"]}`],
    [WCOL.lagoon, `delta-lagoon ${wcount["delta-lagoon"]}`], [WCOL.marsh, `delta-reed-marsh ${wcount["delta-reed-marsh"]} (meets the sea)`], [WCOL.lava, "lava (the crater)"], [COLOR.shallow, "shallow sea"], [COLOR.deep, "deep sea"]];
  const line = (pts, P, ox, oy, stroke, wdt, dash) => `<polyline points="${pts.map((p) => `${(ox + p[0] * P).toFixed(2)},${(oy + p[1] * P).toFixed(2)}`).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${wdt}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const mouthTiles = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (m.ground[i] === GROUND.river && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !m.land[(y + dy) * m.w + x + dx])) mouthTiles.push([x, y]); }
  // 10. the water
  {
    const P = 8, legW = 380, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, (i) => m.land[i] ? (m.ground[i] === GROUND.lava ? WCOL.lava : waterColor(m, i) || "#8aa977") : m.ground[i] === GROUND.shallow ? COLOR.shallow : COLOR.deep);
    m.riverLines.forEach((l) => (b += line(l, P, M, T0, "#cfe9ff", 1, "3 2")));
    b += legend(M * 2 + m.w * P - 20, T0, waterLegend.concat([["#8aa977", "land"], ["#cfe9ff", "river centre lines (dashed)"]]));
    for (const [t, x, y] of [["tarn", 54, 10], ["main-river", 41, 38], ["delta-branch", 21, 92], ["koi-pond", 111, 57.5], ["lagoon", 15, 71.5], ["marsh", 7, 92]]) b += label(M + x * P, T0 + y * P, t, "#fff", 11);
    out["water"] = frame(w, h, `MAP-B B1c water: the river from the tarn to two mouths, the koi pond, the lagoon and the reed marsh (${Object.values(wcount).reduce((a, c) => a + c, 0)} tiles)`, b);
  }
  // 11. water over the four levels, with the falls
  {
    const P = 8, legW = 380, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, levelWaterColor(m));
    m.falls.forEach((f, k) => { const cx = f.tiles.reduce((a, t) => a + t[0], 0) / f.tiles.length + 0.5, cy = f.tiles.reduce((a, t) => a + t[1], 0) / f.tiles.length + 0.5; b += `<circle cx="${M + cx * P}" cy="${T0 + cy * P}" r="13" fill="none" stroke="#fff" stroke-width="2.5"/>` + label(M + cx * P + 16, T0 + cy * P + 4, `fall ${k + 1}: level ${f.upper} to ${f.lower}`, "#fff", 12); });
    b += legend(M * 2 + m.w * P - 20, T0, lvLegend.concat(waterLegend.slice(0, 6)));
    out["water-elevation"] = frame(w, h, "MAP-B B1c water over the four levels (white rings: the two waterfalls, where the river drops a level)", b);
  }
  // 12. the delta, zoomed
  {
    const P = 22, x0 = 3, y0 = 64, x1 = 35, y1 = 101, legW = 420, w = (x1 - x0) * P + 2 * M + legW, h = (y1 - y0) * P + T0 + M + 10;
    const sub = { w: x1 - x0, h: y1 - y0 };
    let b = "";
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * m.w + x; const c = terrainColor(m)(i); b += `<rect x="${M + (x - x0) * P}" y="${T0 + (y - y0) * P}" width="${P}" height="${P}" fill="${c}" stroke="#000" stroke-opacity="0.12"/>`; }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * m.w + x; if (m.why[i] === WHY.rim) b += `<rect x="${M + (x - x0) * P + 3}" y="${T0 + (y - y0) * P + 3}" width="${P - 6}" height="${P - 6}" fill="none" stroke="#d2442f" stroke-width="2"/>`; }
    for (const [x, y] of mouthTiles) if (x >= x0 && x < x1 && y >= y0 && y < y1) b += `<rect x="${M + (x - x0) * P + 2}" y="${T0 + (y - y0) * P + 2}" width="${P - 4}" height="${P - 4}" fill="none" stroke="#ffffff" stroke-width="3"/>`;
    b += `<clipPath id="dz"><rect x="${M}" y="${T0}" width="${(x1 - x0) * P}" height="${(y1 - y0) * P}"/></clipPath><g clip-path="url(#dz)">`;
    m.riverLines.forEach((l) => (b += line(l.map(([px, py]) => [px - x0, py - y0]), P, M, T0, "#e6f4ff", 1.5, "4 3")));
    b += `</g>`;
    const cb = src.water.crossings.find((c) => c.id === "delta-bridge").crossingBox;
    b += `<rect x="${M + (cb.x0 - x0) * P}" y="${T0 + (cb.y0 - y0) * P}" width="${(cb.x1 - cb.x0 + 1) * P}" height="${(cb.y1 - cb.y0 + 1) * P}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="8 5"/>` + label(M + (cb.x0 - x0) * P + 4, T0 + (cb.y0 - y0) * P - 6, "delta-bridge (planned, B1d)", "#ffd166", 12);
    for (let x = x0; x <= x1; x += 5) b += `<text x="${M + (x - x0) * P}" y="${T0 - 6}" fill="#ccc" font-size="11" text-anchor="middle">${x}</text>`;
    for (let y = y0 + 1; y <= y1; y += 5) b += `<text x="${M - 6}" y="${T0 + (y - y0) * P + 4}" fill="#ccc" font-size="11" text-anchor="end">${y}</text>`;
    for (const [t, x, y] of [["main mouth", 6.5, 85.5], ["second mouth", 7.2, 96.6], ["fork", 22, 81.5], ["lobe (marsh fronts the sea)", 3.5, 90.8], ["delta-lagoon", 13, 72.4], ["delta-branch", 19.5, 91], ["main-river", 26, 72]]) b += label(M + (x - x0) * P, T0 + (y - y0) * P, t, "#fff", 13);
    b += legend(M * 2 + (x1 - x0) * P - 20, T0, waterLegend.slice(0, 5).concat([[COLOR.sand, "beach"], [COLOR.land, "grass"], [COLOR.shallow, "shallow sea"], ["#ffffff", "white outline: a river mouth tile (beside the sea)"], ["#d2442f", "red outline: a cliff rim"], ["#ffd166", "dashed: the planned delta bridge (B1d)"]]));
    out["delta"] = frame(w, h, `MAP-B B1c the south-west delta (x ${x0}-${x1 - 1}, y ${y0}-${y1 - 1}, ${P} px a tile): two mouths, the lobe, the lagoon and the reed marsh`, b);
  }
  // 13. the waterfalls, zoomed side by side
  {
    const P = 22, boxes = [[38, 22, 52, 36, "fall 1"], [24, 53, 38, 67, "fall 2"]], pw = 14 * P, legW = 340, w = 2 * pw + 3 * M + legW, h = 14 * P + T0 + M + 46;
    let b = "";
    boxes.forEach(([x0, y0, x1, y1, nm], k) => {
      const ox = M + k * (pw + M);
      b += `<clipPath id="fz${k}"><rect x="${ox}" y="${T0}" width="${pw}" height="${14 * P}"/></clipPath><g clip-path="url(#fz${k})">`;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * m.w + x; b += `<rect x="${ox + (x - x0) * P}" y="${T0 + (y - y0) * P}" width="${P}" height="${P}" fill="${levelWaterColor(m)(i)}" stroke="#000" stroke-opacity="0.12"/>`;
        if (m.ground[i] === GROUND.river || m.land[i]) b += `<text x="${ox + (x - x0) * P + P / 2}" y="${T0 + (y - y0) * P + P / 2 + 4}" fill="#111" fill-opacity="0.55" font-size="10" text-anchor="middle">${m.height[i]}</text>`;
        if (m.why[i] === WHY.rim) b += `<rect x="${ox + (x - x0) * P + 3}" y="${T0 + (y - y0) * P + 3}" width="${P - 6}" height="${P - 6}" fill="none" stroke="#d2442f" stroke-width="2"/>`; }
      const f = m.falls[k];
      for (const [x, y] of f.tiles) b += `<rect x="${ox + (x - x0) * P + 1}" y="${T0 + (y - y0) * P + 1}" width="${P - 2}" height="${P - 2}" fill="none" stroke="#fff" stroke-width="3"/>`;
      m.riverLines.forEach((l) => (b += line(l.map(([px, py]) => [px - x0, py - y0]), P, ox, T0, "#e6f4ff", 1.5, "4 3")));
      b += `</g>`;
      b += `<text x="${ox}" y="${T0 + 14 * P + 18}" fill="#eee" font-size="13" font-weight="bold">${nm}: level ${f.upper} to ${f.lower} (x ${x0}-${x1 - 1}, y ${y0}-${y1 - 1})</text>`;
      b += `<text x="${ox}" y="${T0 + 14 * P + 36}" fill="#ccc" font-size="12">tiles ${f.tiles.map((t) => t.join(",")).join("  ")}</text>`;
    });
    b += legend(3 * M + 2 * pw - 20, T0, lvLegend.concat([[WCOL.river, "river (the digit is its level)"], ["#ffffff", "white outline: the fall's tiles"], ["#d2442f", "red outline: a cliff rim"]]));
    out["waterfalls"] = frame(w, h, "MAP-B B1c the two waterfalls, derived where neighbouring river tiles are on different levels (22 px a tile; digits are levels)", b);
  }
  // 14. the volcano, zoomed
  {
    const P = 20, x0 = 50, y0 = 1, x1 = 94, y1 = 30, legW = 360, w = (x1 - x0) * P + 2 * M + legW, h = (y1 - y0) * P + T0 + M + 10;
    const massR = src.elevation.regions.find((r) => r.id === src.water.volcano.mass), mg = raster(regionPoly(massR), m.w, m.h);
    let b = "", n = { cone: 0, scree: 0, lava: 0 };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * m.w + x;
      let c = terrainColor(m)(i);
      if (m.land[i] && mg[i]) c = m.ground[i] === GROUND.lava ? WCOL.lava : m.cone[i] ? WCOL.cone : WCOL.scree;
      else if (m.land[i] && m.ground[i] !== GROUND.lava && !waterColor(m, i)) c = LEVEL[m.height[i]];
      b += `<rect x="${M + (x - x0) * P}" y="${T0 + (y - y0) * P}" width="${P}" height="${P}" fill="${c}" stroke="#000" stroke-opacity="0.12"/>`;
      if (m.land[i] && (m.coll[i] & COLL.solid)) b += `<line x1="${M + (x - x0) * P + 3}" y1="${T0 + (y - y0 + 1) * P - 3}" x2="${M + (x - x0 + 1) * P - 3}" y2="${T0 + (y - y0) * P + 3}" stroke="#000" stroke-opacity="0.35"/>`;
    }
    for (let i = 0; i < m.w * m.h; i++) if (m.land[i] && mg[i]) { if (m.ground[i] === GROUND.lava) n.lava++; else if (m.cone[i]) n.cone++; else n.scree++; }
    for (const e of [src.water.volcano.cone, src.water.volcano.crater]) b += `<ellipse cx="${M + (e.cx - x0) * P}" cy="${T0 + (e.cy - y0) * P}" rx="${e.rx * P}" ry="${e.ry * P}" fill="none" stroke="#ffe08a" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    const me = massR.ellipse; b += `<ellipse cx="${M + (me.cx - x0) * P}" cy="${T0 + (me.cy - y0) * P}" rx="${me.rx * P}" ry="${me.ry * P}" fill="none" stroke="#e0d0ff" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    for (let x = x0; x <= x1; x += 5) b += `<text x="${M + (x - x0) * P}" y="${T0 - 6}" fill="#ccc" font-size="11" text-anchor="middle">${x}</text>`;
    for (let y = y0 + 4; y <= y1; y += 5) b += `<text x="${M - 6}" y="${T0 + (y - y0) * P + 4}" fill="#ccc" font-size="11" text-anchor="end">${y}</text>`;
    b += legend(M * 2 + (x1 - x0) * P - 20, T0, [[WCOL.cone, `cone, solid (${n.cone} tiles)`], [WCOL.scree, `scree, solid (${n.scree}; kept for Cinder Reach)`], [WCOL.lava, `crater lava, solid + lava (${n.lava})`],
      [LEVEL[2], "highland, level 2"], [WCOL.tarn, "the tarn (the river's source)"], [WCOL.river, "river"], ["#e0d0ff", "dashed lavender: the volcano mass (level 3)"], ["#ffe08a", "dashed yellow: cone and crater"], ["#555", "diagonal stroke: solid (can't be walked)"]]);
    out["volcano"] = frame(w, h, `MAP-B B1c the volcano (x ${x0}-${x1 - 1}, y ${y0}-${y1 - 1}, ${P} px a tile): cone, scree and crater, all solid; no way in`, b);
  }

  /* B1d: corridors and infrastructure */
  const ICOL = { main: "#f4e7c2", secondary: "#dcc08a", service: "#a7acc0", trail: "#b98f5c", plaza: "#e9dcb8", bridge: "#9a6a3c", dock: "#7d5430", pad: "#cfcfd6" };
  const CLS = ["main", "secondary", "service", "trail"];
  const infraColor = (i) => m.ground[i] === GROUND.bridge ? ICOL.bridge : m.ground[i] === GROUND.dock ? ICOL.dock : m.ground[i] === GROUND.pad ? ICOL.pad : m.ground[i] === GROUND.path ? (m.pathClass[i] >= 0 ? ICOL[CLS[m.pathClass[i]]] : ICOL.plaza) : null;
  const muted = (i) => { if (!m.land[i]) return m.ground[i] === GROUND.dock ? ICOL.dock : m.ground[i] === GROUND.shallow ? "#2c5068" : "#1c3550"; if (m.ground[i] === GROUND.lava) return WCOL.lava; const wc = waterColor(m, i); if (wc && m.ground[i] !== GROUND.bridge) return wc; return ["#9db87e", "#6f9a5a", "#9a845f", "#b8acd2"][m.height[i]]; };
  const fullColor = (i) => infraColor(i) || (m.why[i] === WHY.rim ? "#5a4038" : muted(i));
  const infraLegend = [[ICOL.main, "main path (about 3 wide)"], [ICOL.secondary, "secondary path (about 2)"], [ICOL.service, "service road (about 2)"], [ICOL.trail, "trail (1 to 2)"], [ICOL.plaza, "plaza"], [ICOL.bridge, "bridge"], [ICOL.dock, "dock: quay, ferry pier, west jetty"], [ICOL.pad, "helipad"]];
  const zoom = (x0, y0, x1, y1, P, color, extra, title, rows, name) => {
    const legW = 400, w = (x1 - x0) * P + 2 * M + legW, h = Math.max((y1 - y0) * P + T0 + M + 10, T0 + rows.length * 18 + 40);
    let b = "";
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * m.w + x; b += `<rect x="${M + (x - x0) * P}" y="${T0 + (y - y0) * P}" width="${P}" height="${P}" fill="${color(i)}" stroke="#000" stroke-opacity="0.12"/>`; }
    for (let x = x0; x <= x1; x += 5) b += `<text x="${M + (x - x0) * P}" y="${T0 - 6}" fill="#ccc" font-size="11" text-anchor="middle">${x}</text>`;
    for (let y = y0; y <= y1; y += 5) b += `<text x="${M - 6}" y="${T0 + (y - y0) * P + 4}" fill="#ccc" font-size="11" text-anchor="end">${y}</text>`;
    const X = (x) => M + (x - x0) * P, Y = (y) => T0 + (y - y0) * P;
    b += `<clipPath id="z${name}"><rect x="${M}" y="${T0}" width="${(x1 - x0) * P}" height="${(y1 - y0) * P}"/></clipPath><g clip-path="url(#z${name})">${extra(X, Y, P)}</g>`;
    b += legend(M * 2 + (x1 - x0) * P - 20, T0, rows);
    out[name] = frame(w, h, title, b);
  };
  const boxOutline = (X, Y, P, bx, stroke, lbl, dash) => `<rect x="${X(bx.x0)}" y="${Y(bx.y0)}" width="${(bx.x1 - bx.x0 + 1) * P}" height="${(bx.y1 - bx.y0 + 1) * P}" fill="none" stroke="${stroke}" stroke-width="2.5"${dash ? ' stroke-dasharray="7 4"' : ""}/>` + (lbl ? label(X(bx.x0) + 2, Y(bx.y0) - 5, lbl, stroke, 12) : "");
  const tileMark = (X, Y, P, t, fill, lbl) => `<rect x="${X(t[0]) + 2}" y="${Y(t[1]) + 2}" width="${P - 4}" height="${P - 4}" fill="${fill}" stroke="#111" stroke-width="2"/>` + (lbl ? label(X(t[0]) + P + 3, Y(t[1]) + P - 4, lbl, "#fff", 12) : "");
  // 15. corridors over terrain
  {
    const P = 8, legW = 380, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, fullColor);
    const named = src.corridors.paths.filter((pa) => pa.class !== "trail" || ["shrine-trail", "tower-trail", "riverlands-delta-trail", "bridgehead-trail", "cave-spur"].includes(pa.id));
    for (const pa of named) { const mid = pa.line[Math.floor((pa.line.length - 1) / 2)]; b += label(M + mid[0] * P + 4, T0 + mid[1] * P - 4, pa.id, "#fff", 10); }
    const cnt = { main: 0, secondary: 0, service: 0, trail: 0, plaza: 0 }; for (let i = 0; i < m.w * m.h; i++) if (m.ground[i] === GROUND.path || m.ground[i] === GROUND.bridge) { if (m.pathClass[i] >= 0) cnt[CLS[m.pathClass[i]]]++; else cnt.plaza++; }
    b += legend(M * 2 + m.w * P - 20, T0, infraLegend.concat([["#5a4038", "cliff rim"]]));
    b += `<text x="${M * 2 + m.w * P - 20}" y="${T0 + 190}" fill="#ccc" font-size="12">tiles: main ${cnt.main}, secondary ${cnt.secondary}, service ${cnt.service}, trail ${cnt.trail}, plaza ${cnt.plaza}</text>`;
    b += `<text x="${M * 2 + m.w * P - 20}" y="${T0 + 208}" fill="#aaa" font-size="11">${src.corridors.paths.length} paths and ${src.corridors.plazas.length} plazas; labels on the main, secondary,</text><text x="${M * 2 + m.w * P - 20}" y="${T0 + 222}" fill="#aaa" font-size="11">service and long trails</text>`;
    out["corridors"] = frame(w, h, "MAP-B B1d corridors: main, secondary, service and trail paths, plazas, bridges, docks and the helipad over the terrain", b);
  }
  // 16. the three bridges, zoomed side by side
  {
    const P = 24, wins = src.water.crossings.map((c) => ({ c, x0: c.crossingBox.x0 - 4, y0: c.crossingBox.y0 - 4, x1: c.crossingBox.x1 + 5, y1: c.crossingBox.y1 + 5 }));
    const panelW = Math.max(...wins.map((q) => (q.x1 - q.x0) * P)), panelH = Math.max(...wins.map((q) => (q.y1 - q.y0) * P)), legW = 330;
    const w = wins.length * (panelW + M) + M + legW, h = panelH + T0 + M + 40;
    let b = "";
    wins.forEach((q, k) => {
      const ox = M + k * (panelW + M);
      b += `<clipPath id="bz${k}"><rect x="${ox}" y="${T0}" width="${(q.x1 - q.x0) * P}" height="${(q.y1 - q.y0) * P}"/></clipPath><g clip-path="url(#bz${k})">`;
      for (let y = q.y0; y < q.y1; y++) for (let x = q.x0; x < q.x1; x++) { const i = y * m.w + x; b += `<rect x="${ox + (x - q.x0) * P}" y="${T0 + (y - q.y0) * P}" width="${P}" height="${P}" fill="${fullColor(i)}" stroke="#000" stroke-opacity="0.12"/>`;
        if (m.ground[i] === GROUND.bridge) b += `<rect x="${ox + (x - q.x0) * P + 2}" y="${T0 + (y - q.y0) * P + 2}" width="${P - 4}" height="${P - 4}" fill="none" stroke="#fff" stroke-width="2.5"/>`; }
      const cb = q.c.crossingBox; b += `<rect x="${ox + (cb.x0 - q.x0) * P}" y="${T0 + (cb.y0 - q.y0) * P}" width="${(cb.x1 - cb.x0 + 1) * P}" height="${(cb.y1 - cb.y0 + 1) * P}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="7 4"/></g>`;
      let n = 0; for (let i = 0; i < m.w * m.h; i++) if (m.ground[i] === GROUND.bridge && i % m.w >= cb.x0 && i % m.w <= cb.x1 && ((i / m.w) | 0) >= cb.y0 && ((i / m.w) | 0) <= cb.y1) n++;
      b += `<text x="${ox}" y="${T0 + panelH + 18}" fill="#eee" font-size="13" font-weight="bold">${q.c.id}: ${n} bridge tiles</text><text x="${ox}" y="${T0 + panelH + 34}" fill="#ccc" font-size="12">approved crossing x ${cb.x0}-${cb.x1}, y ${cb.y0}-${cb.y1}</text>`;
    });
    b += legend(wins.length * (panelW + M) + M - 20, T0, [[ICOL.bridge, "bridge (white outline)"], [WCOL.river, "river"], ["#ffd166", "dashed: the approved crossing box"]].concat(infraLegend.slice(0, 4)));
    out["bridges"] = frame(w, h, "MAP-B B1d the three bridges, each inside its approved crossing (24 px a tile)", b);
  }
  // 17. the harbour
  {
    const S = src.exits.south;
    zoom(60, 70, 100, 106, 18, fullColor, (X, Y, P) => boxOutline(X, Y, P, S.arrivalPlazaBox, "#ffd166", "arrival plaza") + boxOutline(X, Y, P, S.ferryTerminalReserveBox, "#f4a261", "ferry terminal reserve", true) + boxOutline(X, Y, P, S.quayBox, "#e9c46a", "") + label(X(S.quayBox.x0), Y(S.quayBox.y1 + 1) + 14, "quay", "#e9c46a", 12) +
      boxOutline(X, Y, P, S.ferryPierBox, "#c8a27a", "") + label(X(S.ferryPierBox.x1 + 1) + 4, Y(S.ferryPierBox.y0 + 6), "ferry pier", "#c8a27a", 12) + tileMark(X, Y, P, S.berthTile, "#ffffff", "deep-water berth") + tileMark(X, Y, P, S.routeMarkerTile, "#ff5fd2", "south route marker (not a building)") +
      boxOutline(X, Y, P, { x0: 76, y0: 97, x1: 82, y1: 105 }, "#9fd3ff", "harbour channel (open)", true),
      "MAP-B B1d the harbour (x 60-99, y 70-105, 18 px a tile): plaza, terminal reserve, quay, ferry pier, berth, route marker", infraLegend.concat([[COLOR.shallow, "shallow sea"], [COLOR.deep, "deep sea"]]), "harbour");
  }
  // 18. the west jetty
  {
    const Wx = src.exits.west;
    zoom(0, 58, 32, 80, 22, fullColor, (X, Y, P) => boxOutline(X, Y, P, Wx.jettyBox, "#c8a27a", "west service jetty (restricted)") + tileMark(X, Y, P, Wx.routeMarkerTile, "#ff5fd2", "barge route (Ironwood)") +
      boxOutline(X, Y, P, src.seaLanes.find((l) => l.id === "ironwood-west").laneBox, "#9fd3ff", "open water west (Ironwood lane)", true),
      "MAP-B B1d the west service jetty (x 0-31, y 58-79, 22 px a tile), reached by the village road over the delta bridge", infraLegend.concat([[WCOL.lagoon, "delta lagoon"], [COLOR.shallow, "shallow sea"]]), "west-jetty");
  }
  // 19. the north-west bridgehead
  {
    const N = src.exits.northwest, st = src.elevation.ramps.find((r) => r.id === "shrine-stairs").rampBox;
    zoom(0, 10, 28, 32, 24, fullColor, (X, Y, P) => boxOutline(X, Y, P, N.landingBox, "#ffffff", "rope-bridge landing (bridgehead)") + boxOutline(X, Y, P, st, "#50ffa0", "shrine stairs (level 2 to 3)", true) + tileMark(X, Y, P, N.routeMarkerTile, "#ff5fd2", "the gap to Ashpine") +
      boxOutline(X, Y, P, src.seaLanes.find((l) => l.id === "ashpine-strait").laneBox, "#9fd3ff", "", true),
      "MAP-B B1d the north-west bridgehead on the shrine cape (x 0-27, y 10-31, 24 px a tile); the bridge itself is a later phase", infraLegend.slice(3, 4).concat([["#b8acd2", "level 3, the shrine knoll"], ["#9a845f", "level 2, the highland"], ["#5a4038", "cliff rim"], ["#9fd3ff", "dashed blue: the Ashpine strait (open sea)"]]), "nw-bridgehead");
  }
  // 20. connectivity: walking distance from the arrival, one piece
  {
    const P = 8, legW = 400, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    const walkT = (i) => (m.land[i] || m.ground[i] === GROUND.dock) && !(m.coll[i] & 7);
    const A = src.corridors.routeEnds.find((r) => r.id === "arrival").endTile, D = new Int32Array(m.w * m.h).fill(-1), q = [A[1] * m.w + A[0]]; D[q[0]] = 0;
    for (let k = 0; k < q.length; k++) { const i = q[k], x = i % m.w, y = (i - x) / m.w; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = ny * m.w + nx; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && D[j] < 0 && walkT(j)) { D[j] = D[i] + 1; q.push(j); } } }
    let far = 0, n = 0, un = 0; for (let i = 0; i < m.w * m.h; i++) { if (D[i] > far) far = D[i]; if (walkT(i)) { n++; if (D[i] < 0) un++; } }
    const heat = (d) => { const t = d / far, r = Math.round(40 + 215 * t), g = Math.round(200 - 120 * t), bl = Math.round(120 - 80 * t); return `rgb(${r},${g},${bl})`; };
    let b = tilesSvg(m, P, M, T0, (i) => walkT(i) ? (D[i] < 0 ? "#ff00ff" : (m.ground[i] === GROUND.path || m.ground[i] === GROUND.bridge || m.ground[i] === GROUND.dock || m.ground[i] === GROUND.pad) ? "#f0f0f0" : heat(D[i])) : !m.land[i] ? (m.ground[i] === GROUND.shallow ? "#24384a" : "#18263a") : "#333");
    for (const r of src.corridors.routeEnds) { const [x, y] = r.endTile, d = D[y * m.w + x]; b += `<circle cx="${M + (x + 0.5) * P}" cy="${T0 + (y + 0.5) * P}" r="5" fill="#111" stroke="#fff" stroke-width="2"/>` + label(M + (x + 1) * P + 4, T0 + (y + 0.5) * P + 4, `${r.id}${r.id === "arrival" ? "" : ` ${(d / (54 / 14.9)).toFixed(0)} s`}`, "#fff", 10); }
    b += legend(M * 2 + m.w * P - 20, T0, [["#f0f0f0", "paved: paths, plazas, bridges, docks, pad"], [heat(0), "open ground near the arrival"], [heat(far / 2), `halfway (${Math.round(far / 2)} tiles)`], [heat(far), `farthest (${far} tiles, ${Math.round(far / (54 / 14.9))} s walking)`], ["#333", "solid or water on land"], ["#ff00ff", "walkable but cut off (none)"]]);
    b += `<text x="${M * 2 + m.w * P - 20}" y="${T0 + 130}" fill="#ccc" font-size="12">${n} walkable tiles, one piece, ${un} cut off; times are walking</text>`;
    out["connectivity"] = frame(w, h, "MAP-B B1d connectivity: walking distance from the arrival over the whole island (one piece), with the route ends", b);
  }
  // 21. the whole blockout
  {
    const P = 8, legW = 400, w = m.w * P + 2 * M + legW, h = m.h * P + T0 + M;
    let b = tilesSvg(m, P, M, T0, fullColor);
    const S = src.exits.south, Wx = src.exits.west, N = src.exits.northwest;
    for (const [t, lbl] of [[S.routeMarkerTile, "1 south exit: ferries, Server Key, the site"], [Wx.routeMarkerTile, "2 west exit: Ironwood (restricted)"], [N.routeMarkerTile, "3 north-west exit: Ashpine bridge"]]) b += `<circle cx="${M + (t[0] + 0.5) * P}" cy="${T0 + (t[1] + 0.5) * P}" r="9" fill="none" stroke="#ff5fd2" stroke-width="3"/>` + label(M + (t[0] + 1.5) * P + 4, T0 + (t[1] + 0.5) * P + 4, lbl, "#ffb3ee", 11);
    for (const [t, x, y] of ORIENT) b += `<text x="${M + x * P}" y="${T0 + y * P}" fill="#fff" font-size="11" text-anchor="middle" stroke="#111" stroke-width="3" paint-order="stroke">${esc(t)}</text>`;
    m.falls.forEach((f) => { const cx = f.tiles.reduce((a, t) => a + t[0], 0) / f.tiles.length + 0.5, cy = f.tiles.reduce((a, t) => a + t[1], 0) / f.tiles.length + 0.5; b += `<circle cx="${M + cx * P}" cy="${T0 + cy * P}" r="7" fill="none" stroke="#fff" stroke-width="2"/>`; });
    b += legend(M * 2 + m.w * P - 20, T0, [["#9db87e", "level 0"], ["#6f9a5a", "level 1"], ["#9a845f", "level 2"], ["#b8acd2", "level 3"], ["#5a4038", "cliff rim"]].concat(infraLegend, [[WCOL.river, "river"], [WCOL.pond, "still water"], [WCOL.lava, "lava"], ["#ff5fd2", "pink rings: the three exits"], ["#ffffff", "white rings: the two waterfalls"]]));
    out["blockout"] = frame(w, h, "MAP-B B1d blockout: terrain, water, corridors, harbour, jetty, bridgehead and helipad (staged; nothing in the game reads it yet)", b);
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
