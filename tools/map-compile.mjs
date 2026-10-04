#!/usr/bin/env node
/* map-compile (MAP-B B1a): compiles the authored source of the redesigned home island,
   tools/maps/home.src.mjs, into the staged map, tools/maps/staged/home.js.

   STAGED. The output is a draft of map format 2 and nothing in the game reads it: js/world.js reads
   format 1 only (format 2 support begins in B2), and the staged file registers
   window.ISLAND_MAPS_STAGED, never window.ISLAND_MAPS. Production keeps the 100 x 80 island in
   js/maps/home.js, which this tool never writes: it refuses any path under js/, and writes only under
   tools/maps/staged/ or tools/out/.

   Deterministic: no randomness, no clock, keys in a fixed order, fixed curve sampling, so two runs give
   the same bytes. The source's own SHA-256 is written into the output, so a stale staged file is caught.

   What B1a compiles: the canvas, the coast (land is every tile whose centre is inside the closed coast
   spline), and the sea (shallow within sea.shallowWithin steps of land, deep beyond). Land is ground 3
   (grass) and height 0 until B1b adds levels and beaches. The exits, sea lanes and satellites in the
   source are metadata for tools/map-lint.mjs; nothing is built from them yet.

     node tools/map-compile.mjs            compile and write tools/maps/staged/home.js
     node tools/map-compile.mjs --check    compile and compare with the tracked file, write nothing
     node tools/map-compile.mjs --stdout   compile and print the staged file (map-lint's determinism check)
     node tools/map-compile.mjs --preview  also draw review images into tools/out/mapb/ (needs Playwright's
                                           Chromium; images are review aids, never test fixtures) */
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hermiteLoop, raster, stepsFrom } from "./maps/geom.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_PATH = join(ROOT, "tools/maps/home.src.mjs");
export const STAGED_PATH = join(ROOT, "tools/maps/staged/home.js");
export const PREVIEW_DIR = join(ROOT, "tools/out/mapb");
export const STAGE = "B1a";
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
  only(src, "the source", ["schema", "id", "w", "h", "tile", "coast", "sea", "features", "exits", "seaLanes", "satellites"]);
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
    ft.points.forEach((q) => { if (!pointIds.has(q)) bad(`feature ${ft.id}: no coast point ${q}`); });
    if (!ft.landTiles.length && !ft.seaTiles.length) bad(`feature ${ft.id} needs at least one land or sea tile`);
  });
  // the exits: exactly three, each concept in its own field
  only(src.exits, "exits", ["south", "west", "northwest"]);
  only(src.exits.south, "exits.south", ["leadsTo", "arrivalPlazaBox", "ferryTerminalReserveBox", "quayBox", "ferryPierBox", "berthTile", "routeMarkerTile"]);
  only(src.exits.west, "exits.west", ["leadsTo", "jettyBox", "routeMarkerTile"]);
  only(src.exits.northwest, "exits.northwest", ["leadsTo", "capePoint", "landingBox", "routeMarkerTile"]);
  for (const e of ["south", "west", "northwest"]) str(src.exits[e].leadsTo, `exits.${e}.leadsTo`);
  if (!pointIds.has(src.exits.northwest.capePoint)) bad(`exits.northwest.capePoint: no coast point ${src.exits.northwest.capePoint}`);
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
export const GROUND = { deep: 0, shallow: 1, land: 3 };          // the format's ground codes (land stays grass until B1b)
export const COLL = { none: 0, shallow: 2, deep: 4 };             // the game's collision flags: C_SHALLOW 2, C_DEEP 4
export function compile(src, sourceSha256) {
  validateSource(src);
  const W = src.w, H = src.h, n = src.coast.samplesPerSegment;
  const pts = src.coast.points.map((p) => [p.x, p.y, p.corner ? 0 : 1]);
  const samples = hermiteLoop(pts, n);
  const land = raster(samples, W, H);
  const steps = stepsFrom(land, W, H);
  const ground = new Uint8Array(W * H), coll = new Uint16Array(W * H), height = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (land[i]) { ground[i] = GROUND.land; coll[i] = COLL.none; }
    else if (steps[i] <= src.sea.shallowWithin) { ground[i] = GROUND.shallow; coll[i] = COLL.shallow; }
    else { ground[i] = GROUND.deep; coll[i] = COLL.deep; }
  }
  return { id: src.id, w: W, h: H, tile: src.tile, n, pts, samples, land, ground, height, coll, steps, sourceSha256 };
}

/* the staged file's text. Everything that decides a byte is here, in a fixed order */
export function serialize(m) {
  const rows = (arr, ch) => { const out = []; for (let y = 0; y < m.h; y++) { let r = ""; for (let x = 0; x < m.w; x++) r += ch(arr[y * m.w + x]); out.push(`    "${r}"`); } return out.join(",\n"); };
  const values = [COLL.none, COLL.shallow, COLL.deep];
  const num = (v) => JSON.stringify(v);
  return [
    `/* STAGED MAP-B home island ("Harbour Crescent", r2.1), stage ${STAGE}. Generated by tools/map-compile.mjs from`,
    `   tools/maps/home.src.mjs: regenerate it, never edit it. NOT RUNTIME-SUPPORTED: this is a draft of map`,
    `   format 2, which the game can't read yet (js/world.js reads format 1; format 2 support begins in B2). It`,
    `   registers window.ISLAND_MAPS_STAGED, never window.ISLAND_MAPS, it is never loaded by a page, and tools/`,
    `   is never deployed. Production runs the 100 x 80 island in js/maps/home.js until an approved switch-over.`,
    `   ground: a hex digit per tile (0 deep, 1 shallow, 3 land; land is grass until B1b adds levels, beaches and`,
    `   water bodies). height: 0 everywhere until B1b. coll: a base-36 index into coll.values (the game's flags:`,
    `   2 shallow, 4 deep). footBlock: none yet. shapes.coast: the closed Hermite spline the land is filled from,`,
    `   [x, y, tangent] per control point (tangent 0 at a corner), samplesPerSegment samples per segment. */`,
    `(window.ISLAND_MAPS_STAGED = window.ISLAND_MAPS_STAGED || {}).home = {`,
    `  "format": 2, "staged": true, "runtimeSupported": false, "stage": ${num(STAGE)}, "id": ${num(m.id)}, "generator": "tools/map-compile.mjs",`,
    `  "source": "tools/maps/home.src.mjs", "sourceSha256": ${num(m.sourceSha256)}, "tile": ${m.tile}, "w": ${m.w}, "h": ${m.h},`,
    `  "ground": [`, rows(m.ground, (v) => v.toString(16)), `  ],`,
    `  "height": [`, rows(m.height, (v) => v.toString(36)), `  ],`,
    `  "coll": { "values": ${num(values)}, "rows": [`, rows(m.coll, (v) => values.indexOf(v).toString(36)), `  ] },`,
    `  "footBlock": [],`,
    `  "shapes": {`,
    `    "coast": { "type": "hermite-loop", "samplesPerSegment": ${m.n}, "pts": ${num(m.pts)} }`,
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
const COLOR = { deep: "#1e4062", shallow: "#346c8c", land: "#709c5c" };
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
const terrainColor = (m) => (i) => m.land[i] ? COLOR.land : m.ground[i] === GROUND.shallow ? COLOR.shallow : COLOR.deep;
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
    out["terrain"] = frame(w, h, "MAP-B B1a terrain: land, shallow sea, deep sea (6 px a tile)", tilesSvg(m, P, M, T0, terrainColor(m)));
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
  const text = serialize(m);
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
