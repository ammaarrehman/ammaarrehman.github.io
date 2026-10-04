#!/usr/bin/env node
/* map-lint (MAP-B B1): the checks on the redesigned home island's authored source
   (tools/maps/home.src.mjs) and its staged map (tools/maps/staged/home.js). Pure Node, no browser.

   B1a proves:
   - the source keeps one coordinate convention (tools/maps/home.src.mjs, header): ...Box is an inclusive
     tile box inside 0-149 x 0-119, ...Tile a tile, ...Tiles a list of them; ambiguous names (rect,
     bounds, span, area) and rectangles written as lists are refused;
   - the map is 150 x 120; its land is exactly the frozen r2.1 mask (tools/fixtures/mapb-r21.json):
     10,257 tiles, x 6-143, y 5-107; the coast curve never crosses itself; each named feature's tiles are
     land or sea as they should be; the map's border is sea; shallow and deep sea follow their rule; the
     open sea lanes the satellites need hold no land; the three exits' concepts are separate and where
     they belong;
   - the staged file is current (map-compile --check), carries the source's SHA-256, is marked staged and
     never registers window.ISLAND_MAPS; two separate compiler runs give the same bytes; the build is the
     accepted one (tools/fixtures/mapb-staged.json);
   - the compiler can't write under js/, and production js/maps/home.js is still the 100 x 80 island;
   B1b adds: the coast's control points and the sea are exactly B1a's (the coast is locked); the levels
   are exactly the frozen r2.1 level mask (tools/fixtures/mapb-r21-levels.json: 3,413 / 4,111 / 2,225 /
   508 tiles at levels 0 / 1 / 2 / 3), only 0 to 3, all four present; there are eight ramps, each holding
   exactly its two neighbouring levels and really joining them; every pair of neighbouring walkable tiles
   on different levels is inside one ramp, as that ramp's two levels (so no walkable 0-2, 0-3 or 1-3 step
   anywhere); every walkable tile is reachable from the arrival plaza, and the same with level changes
   allowed only in ramps (the cliffs are sealed); the volcano mass is solid; the shrine knoll is
   reachable, and only by its stairs.
   - then self-tests: each guard is broken on purpose (in memory, or in tools/out/) and must fail.

   The frozen r2.1 fixture is never rewritten by any tool; this file checks it against hashes in its own
   code. A deliberate reshape later is accepted into tools/fixtures/mapb-staged.json with a reason; from
   then the r2.1 check passes only if the drift is exactly the accepted drift, and still reports it.

     node tools/map-lint.mjs                              every check and self-test
     node tools/map-lint.mjs --accept --reason="..."      accept the current build (mapb-staged.json only)

   Exit 1 if anything fails. */
import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import vm from "node:vm";
import { ROOT, SOURCE_PATH, STAGED_PATH, STAGE, loadSource, compile, serialize, guardOut, regionPoly, GROUND, COLL, WHY } from "./map-compile.mjs";
import { selfIntersections, flood, raster } from "./maps/geom.mjs";

const R21_PATH = join(ROOT, "tools/fixtures/mapb-r21.json");
const R21_LEVELS_PATH = join(ROOT, "tools/fixtures/mapb-r21-levels.json");
export const ACCEPTED_PATH = join(ROOT, "tools/fixtures/mapb-staged.json");
const PROD_MAP = join(ROOT, "js/maps/home.js");
// the frozen r2.1 record's own hashes: changing the fixture without changing this code fails the lint
const R21_LAND_SHA256 = "c884c9bb4a649c2cbadba50d415b00410d058f61264afe538377445911d96e6d";
const R21_POINTS_SHA256 = "b4492659c3084f9ed00014ee8f58b4782708f64cc6d98c6ba67f4a22ed5882a1";
const R21_LEVELS_SHA256 = "d51d351b0cc30bede012b28c43ccc1f5c43a72309a7045e1aac2ef54c75bcb64";
// B1a's sea, from the committed B1a staged map (9968f1a): rows of L land, s shallow, d deep. The coast is locked
const B1A_SEA_SHA256 = "5a93c8be99d153945ae7cabb434de9a2a6b05cd7b2222ae284b1dbb72fc400a3";
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const rel = (p) => p.replace(ROOT + "/", "");

/* ════════ what a build is ════════ */
function seaRows(m) { const r = []; for (let y = 0; y < m.h; y++) { let s = ""; for (let x = 0; x < m.w; x++) { const i = y * m.w + x; s += m.land[i] ? "L" : m.ground[i] === GROUND.shallow ? "s" : "d"; } r.push(s); } return r; }
function levelRows(m) { const r = []; for (let y = 0; y < m.h; y++) { let s = ""; for (let x = 0; x < m.w; x++) { const i = y * m.w + x; s += m.land[i] ? String(m.height[i]) : "."; } r.push(s); } return r; }
function landRows(m) { const r = []; for (let y = 0; y < m.h; y++) { let s = ""; for (let x = 0; x < m.w; x++) s += m.land[y * m.w + x] ? "1" : "0"; r.push(s); } return r; }
function layerSha(m, arr) { return sha256(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)) + ":" + m.w + "x" + m.h; }
function summary(m) {
  let land = 0, shallow = 0, deep = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x;
    if (m.land[i]) { land++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    else if (m.ground[i] === GROUND.shallow) shallow++; else deep++;
  }
  return { w: m.w, h: m.h, landTiles: land, shallowTiles: shallow, deepTiles: deep, landBox: { x0, y0, x1, y1 },
    levelTiles: [0, 1, 2, 3].map((l) => { let n = 0; for (let i = 0; i < m.w * m.h; i++) if (m.land[i] && m.height[i] === l) n++; return n; }),
    digests: { land: sha256(landRows(m).join("\n")), sea: sha256(seaRows(m).join("\n")), levels: sha256(levelRows(m).join("\n")), ground: layerSha(m, m.ground), height: layerSha(m, m.height), coll: layerSha(m, m.coll), coast: sha256(JSON.stringify([m.n, m.pts])) } };
}
function levelDrift(m, lv) {
  const d = [];
  if (m.w !== lv.w || m.h !== lv.h) return { tiles: -1, sha256: null, list: [] };
  const rows = levelRows(m);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (rows[y][x] !== lv.rows[y][x]) d.push(`${x},${y}:${lv.rows[y][x]}>${rows[y][x]}`);
  return { tiles: d.length, sha256: d.length ? sha256(d.join(";")) : null, list: d };
}
function drift(m, r21) {
  const d = [];
  if (m.w !== r21.w || m.h !== r21.h) return { tiles: -1, sha256: null, list: [] };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const a = !!m.land[y * m.w + x], b = r21.rows[y][x] === "1";
    if (a !== b) d.push(`${x},${y},${a ? "+" : "-"}`);
  }
  return { tiles: d.length, sha256: d.length ? sha256(d.join(";")) : null, list: d };
}

/* ════════ the checks on a build (pure: the self-tests run them on broken copies) ════════ */
export function runChecks(src, m, { r21, r21Levels, accepted }) {
  const out = [], add = (name, ok, detail) => out.push({ name, ok: !!ok, detail });
  const W = m.w, H = m.h, isLand = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.land[y * W + x] === 1;
  const sum = summary(m), acc = accepted && accepted.accepted, intended = acc && acc.driftFromR21 && acc.driftFromR21.tiles > 0 ? acc : null;

  add("dimensions", src.w === 150 && src.h === 120 && W === 150 && H === 120 && m.land.length === 18000 && m.ground.length === 18000 && m.coll.length === 18000 && m.height.length === 18000,
    `${W} x ${H} (must be 150 x 120)`);

  // the frozen record itself
  {
    const rowsOk = Array.isArray(r21.rows) && r21.rows.length === 120 && r21.rows.every((r) => typeof r === "string" && /^[01]{150}$/.test(r));
    const landSha = rowsOk ? sha256(r21.rows.join("\n")) : null, ptsSha = sha256(JSON.stringify(r21.coastPoints));
    const n = rowsOk ? r21.rows.join("").split("").filter((c) => c === "1").length : -1;
    add("r21-fixture-frozen", rowsOk && landSha === R21_LAND_SHA256 && r21.landSha256 === R21_LAND_SHA256 && ptsSha === R21_POINTS_SHA256 && r21.coastPointsSha256 === R21_POINTS_SHA256 && n === 10257 && r21.landTiles === 10257,
      `land sha ${landSha && landSha.slice(0, 16)} (code expects ${R21_LAND_SHA256.slice(0, 16)}), points sha ${ptsSha.slice(0, 16)} (expects ${R21_POINTS_SHA256.slice(0, 16)}), ${n} land tiles`);
  }
  // the land against r2.1
  {
    const d = drift(m, r21);
    const ok = d.tiles === 0 || (intended && d.tiles === intended.driftFromR21.tiles && d.sha256 === intended.driftFromR21.sha256);
    add("r21-land-mask", ok, d.tiles < 0 ? "sizes differ from r2.1's 150 x 120" : d.tiles === 0 ? "identical to the frozen r2.1 mask (0 of 18,000 tiles differ)" :
      `${d.tiles} tiles differ from r2.1${intended ? (ok ? " (the accepted, intended drift)" : ` (accepted drift is ${intended.driftFromR21.tiles})`) : ""}: ${d.list.slice(0, 8).join(" ")}${d.list.length > 8 ? " ..." : ""} (+ land only now, - land only in r2.1)`);
  }
  const want = intended ? { landTiles: acc.landTiles, landBox: acc.landBox } : { landTiles: r21.landTiles, landBox: r21.landBox };
  add("land-count", sum.landTiles === want.landTiles, `${sum.landTiles} land tiles (expected ${want.landTiles})`);
  add("land-bounds", JSON.stringify(sum.landBox) === JSON.stringify(want.landBox),
    `x ${sum.landBox.x0}-${sum.landBox.x1}, y ${sum.landBox.y0}-${sum.landBox.y1} (expected x ${want.landBox.x0}-${want.landBox.x1}, y ${want.landBox.y0}-${want.landBox.y1})`);

  // the coast curve
  {
    const hits = selfIntersections(m.samples), per = src.coast.samplesPerSegment;
    add("coast-no-self-intersection", hits.length === 0, hits.length ? `${hits.length} crossing(s), first between the segments after ${src.coast.points[(hits[0][0] / per) | 0].id} and after ${src.coast.points[(hits[0][1] / per) | 0].id}` :
      `${m.samples.length} samples, no crossings`);
    const seen = new Map(), dup = [];
    src.coast.points.forEach((p) => { const k = p.x + "," + p.y; if (seen.has(k)) dup.push(`${seen.get(k)} and ${p.id} at ${k}`); else seen.set(k, p.id); });
    add("coast-points-distinct", dup.length === 0, dup.length ? dup.join("; ") : `${src.coast.points.length} points, all at different positions`);
  }
  // named features
  {
    const bad = [];
    for (const f of src.features) {
      f.landTiles.forEach(([x, y]) => { if (!isLand(x, y)) bad.push(`${f.id}: ${x},${y} should be land (points ${f.points.join(", ")})`); });
      f.seaTiles.forEach(([x, y]) => { if (isLand(x, y)) bad.push(`${f.id}: ${x},${y} should be sea (points ${f.points.join(", ")})`); });
    }
    const n = src.features.reduce((a, f) => a + f.landTiles.length + f.seaTiles.length, 0);
    add("features", bad.length === 0, bad.length ? bad.join("; ") : `${src.features.length} features, ${n} tiles each land or sea as named`);
  }
  // the border and the sea's two depths
  {
    let land = 0, deep = 0, n = 0;
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { n++; if (isLand(x, y)) land++; else if (m.ground[y * W + x] === GROUND.deep) deep++; }
    for (let y = 1; y < H - 1; y++) for (const x of [0, W - 1]) { n++; if (isLand(x, y)) land++; else if (m.ground[y * W + x] === GROUND.deep) deep++; }
    add("border-sea", land === 0, `${n} border tiles: ${land} land, ${deep} deep sea, ${n - land - deep} shallow`);
    const k = src.sea.shallowWithin, wrong = [];
    for (let y = 0; y < H && wrong.length < 5; y++) for (let x = 0; x < W && wrong.length < 5; x++) {
      const i = y * W + x;
      let near = false;
      for (let dy = -k; dy <= k && !near; dy++) for (let dx = -k; dx <= k && !near; dx++) if (isLand(x + dx, y + dy)) near = true;
      const g = m.ground[i], c = m.coll[i];
      const okT = m.land[i] ? (g === GROUND.land || g === GROUND.sand) && (c === COLL.none || c === COLL.solid) : near ? g === GROUND.shallow && c === COLL.shallow : g === GROUND.deep && c === COLL.deep;
      if (!okT) wrong.push(`${x},${y} ground ${g} coll ${c}`);
    }
    add("sea-depths-and-collision", wrong.length === 0, wrong.length ? wrong.join("; ") : `land: grass or sand, open or solid; shallow (within ${k} of land): ground 1, flag 2; deep: ground 0, flag 4`);
  }
  // the open sea the satellites need
  {
    const bad = [], info = [];
    for (const l of src.seaLanes) {
      const b = l.laneBox; let land = 0, deep = 0, n = 0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { n++; if (isLand(x, y)) land++; else if (m.ground[y * W + x] === GROUND.deep) deep++; }
      if (land) bad.push(`${l.id} has ${land} land tile(s)`);
      info.push(`${l.id} ${n} sea (${deep} deep)`);
    }
    add("sea-lanes-open", bad.length === 0, bad.length ? bad.join("; ") : info.join(", "));
  }
  // the exits: each concept in its place, none sharing a tile
  {
    const bad = [], E = src.exits, S = E.south, Wx = E.west, N = E.northwest;
    const tiles = (b) => { const t = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) t.push([x, y]); return t; };
    const allLand = (b, nm) => { const n = tiles(b).filter(([x, y]) => !isLand(x, y)).length; if (n) bad.push(`${nm}: ${n} tile(s) aren't land`); };
    const allSea = (b, nm) => { const n = tiles(b).filter(([x, y]) => isLand(x, y)).length; if (n) bad.push(`${nm}: ${n} tile(s) aren't sea`); };
    const isDeep = (t) => !isLand(t[0], t[1]) && m.ground[t[1] * W + t[0]] === GROUND.deep;
    const inBox = (t, b) => t[0] >= b.x0 && t[0] <= b.x1 && t[1] >= b.y0 && t[1] <= b.y1;
    const overlap = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
    const seaReach = (from, to) => flood([from[1] * W + from[0]], (i) => !m.land[i], W, H)[to[1] * W + to[0]] === 1;
    const lanesOf = (exit) => src.satellites.filter((s) => s.exit === exit).flatMap((s) => s.lanes).map((id) => src.seaLanes.find((l) => l.id === id).laneBox);
    // south: plaza, terminal reserve and quay on land; the pier over the sea, rooted on land; the berth in deep
    // water just past the pier's end; the route marker in deep water further out, in a ferry lane
    allLand(S.arrivalPlazaBox, "south arrivalPlazaBox"); allLand(S.ferryTerminalReserveBox, "south ferryTerminalReserveBox"); allLand(S.quayBox, "south quayBox");
    if (!tiles({ ...S.quayBox, y0: S.quayBox.y1 + 1, y1: S.quayBox.y1 + 1 }).some(([x, y]) => !isLand(x, y))) bad.push("south quayBox doesn't border the harbour water");
    allSea(S.ferryPierBox, "south ferryPierBox");
    if (!isLand((S.ferryPierBox.x0 + S.ferryPierBox.x1) >> 1, S.ferryPierBox.y0 - 1)) bad.push("south ferryPierBox isn't rooted on land at its north end");
    if (!isDeep(S.berthTile)) bad.push(`south berthTile ${S.berthTile} isn't deep sea`);
    if (!(S.berthTile[1] === S.ferryPierBox.y1 + 1 && S.berthTile[0] >= S.ferryPierBox.x0 && S.berthTile[0] <= S.ferryPierBox.x1)) bad.push("south berthTile isn't just past the pier's end");
    if (!isDeep(S.routeMarkerTile)) bad.push(`south routeMarkerTile ${S.routeMarkerTile} isn't deep sea`);
    if (!(S.routeMarkerTile[1] > S.berthTile[1])) bad.push("south routeMarkerTile isn't further out than the berth");
    if (!seaReach(S.berthTile, S.routeMarkerTile)) bad.push("south: no open water from the berth to the route marker");
    if (!lanesOf("south").some((b) => inBox(S.routeMarkerTile, b))) bad.push("south routeMarkerTile isn't in a lane of a satellite reached from the south");
    const sBoxes = [["arrivalPlazaBox", S.arrivalPlazaBox], ["ferryTerminalReserveBox", S.ferryTerminalReserveBox], ["quayBox", S.quayBox], ["ferryPierBox", S.ferryPierBox]];
    for (let i = 0; i < sBoxes.length; i++) for (let j = i + 1; j < sBoxes.length; j++) if (overlap(sBoxes[i][1], sBoxes[j][1])) bad.push(`south ${sBoxes[i][0]} and ${sBoxes[j][0]} overlap`);
    for (const [k, t] of [["berthTile", S.berthTile], ["routeMarkerTile", S.routeMarkerTile]]) for (const [bn, b] of sBoxes) if (inBox(t, b)) bad.push(`south ${k} is inside ${bn}`);
    // west: the jetty crosses the shore; its route marker is in the barge's lane, reached by open water
    const jt = tiles(Wx.jettyBox), jl = jt.filter(([x, y]) => isLand(x, y)), js = jt.filter(([x, y]) => !isLand(x, y));
    if (!jl.length || !js.length) bad.push(`west jettyBox should cross the shore (${jl.length} land, ${js.length} sea tiles)`);
    if (isLand(...Wx.routeMarkerTile)) bad.push(`west routeMarkerTile ${Wx.routeMarkerTile} isn't sea`);
    else if (js.length && !seaReach(js[0], Wx.routeMarkerTile)) bad.push("west: no open water from the jetty to its route marker");
    if (!lanesOf("west").some((b) => inBox(Wx.routeMarkerTile, b))) bad.push("west routeMarkerTile isn't in a lane of a satellite reached from the west");
    // northwest: the landing on land behind the cape's tip (a corner); the gap the bridge crosses is sea, in Ashpine's lane
    allLand(N.landingBox, "northwest landingBox");
    const cape = src.coast.points.find((p) => p.id === N.capePoint);
    if (!cape.corner) bad.push(`northwest capePoint ${cape.id} isn't a corner`);
    const nearest = Math.min(...tiles(N.landingBox).map(([x, y]) => Math.hypot(x + 0.5 - cape.x, y + 0.5 - cape.y)));
    if (nearest > 3) bad.push(`northwest landingBox is ${nearest.toFixed(1)} tiles from ${cape.id} (at most 3)`);
    if (isLand(...N.routeMarkerTile)) bad.push(`northwest routeMarkerTile ${N.routeMarkerTile} isn't sea`);
    if (!lanesOf("northwest").some((b) => inBox(N.routeMarkerTile, b))) bad.push("northwest routeMarkerTile isn't in a lane of a satellite reached from the north-west");
    // no tile means two things
    const named = [["south.berthTile", S.berthTile], ["south.routeMarkerTile", S.routeMarkerTile], ["west.routeMarkerTile", Wx.routeMarkerTile], ["northwest.routeMarkerTile", N.routeMarkerTile]];
    for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) if (named[i][1][0] === named[j][1][0] && named[i][1][1] === named[j][1][1]) bad.push(`${named[i][0]} and ${named[j][0]} are the same tile`);
    for (const e of ["south", "west", "northwest"]) if (!src.satellites.some((s) => s.exit === e)) bad.push(`no satellite uses the ${e} exit`);
    add("exits", bad.length === 0, bad.length ? bad.join("; ") : "south: plaza, terminal reserve and quay on land, pier over water rooted on land, berth 79,97 deep, route marker 79,101 deep and further out; west: jetty across the shore, marker in Ironwood's lane; north-west: landing behind the cape tip, gap in Ashpine's lane");
  }
  /* ════════ B1b: the coast is locked, and the levels ════════ */
  add("coast-locked", JSON.stringify(m.pts) === JSON.stringify(r21.coastPoints) && m.n === r21.coastSamplesPerSegment,
    JSON.stringify(m.pts) === JSON.stringify(r21.coastPoints) ? `the ${m.pts.length} coast control points and their corners are r2.1's (and B1a's), ${m.n} samples a segment` : "the coast control points differ from r2.1 / B1a");
  { const sh = sha256(seaRows(m).join("\n")); add("sea-unchanged", sh === B1A_SEA_SHA256, `land, shallow and deep tiles ${sh === B1A_SEA_SHA256 ? "are exactly B1a's" : "DIFFER from B1a's"} (sha256 ${sh.slice(0, 16)}, B1a ${B1A_SEA_SHA256.slice(0, 16)})`); }
  {
    const ok = Array.isArray(r21Levels.rows) && sha256(r21Levels.rows.join("\n")) === R21_LEVELS_SHA256 && r21Levels.levelsSha256 === R21_LEVELS_SHA256 && JSON.stringify(r21Levels.levelTiles) === "[3413,4111,2225,508]";
    add("r21-levels-fixture-frozen", ok, `level mask sha ${Array.isArray(r21Levels.rows) ? sha256(r21Levels.rows.join("\n")).slice(0, 16) : "?"} (code expects ${R21_LEVELS_SHA256.slice(0, 16)}), ${JSON.stringify(r21Levels.levelTiles)}`);
  }
  const intendedLv = acc && acc.levelDriftFromR21 && acc.levelDriftFromR21.tiles > 0 ? acc : null;
  {
    const d = levelDrift(m, r21Levels);
    const ok = d.tiles === 0 || (intendedLv && d.tiles === intendedLv.levelDriftFromR21.tiles && d.sha256 === intendedLv.levelDriftFromR21.sha256);
    add("r21-level-mask", ok, d.tiles < 0 ? "sizes differ from r2.1" : d.tiles === 0 ? "identical to the frozen r2.1 level mask (0 of 18,000 tiles differ)" :
      `${d.tiles} tiles differ from the r2.1 levels: ${d.list.slice(0, 8).join(" ")}${d.list.length > 8 ? " ..." : ""} (x,y:r2.1>now)`);
    const want = intendedLv ? acc.levelTiles : r21Levels.levelTiles;
    add("level-counts", JSON.stringify(sum.levelTiles) === JSON.stringify(want), `levels 0 / 1 / 2 / 3: ${sum.levelTiles.join(" / ")} tiles (expected ${want.join(" / ")})`);
  }
  {
    let bad = 0, seaBad = 0; const seen = new Set();
    for (let i = 0; i < W * H; i++) { if (m.land[i]) { if (m.height[i] > 3) bad++; else seen.add(m.height[i]); } else if (m.height[i] !== 0) seaBad++; }
    add("levels-0-to-3", !bad && !seaBad && seen.size === 4, `land levels used: ${[...seen].sort().join(", ")}${bad ? `; ${bad} land tile(s) above 3` : ""}${seaBad ? `; ${seaBad} sea tile(s) not at 0` : ""} (all four of 0-3 must occur, nothing else)`);
  }
  const walk = (i) => i >= 0 && i < W * H && m.land[i] === 1 && !(m.coll[i] & (COLL.solid | COLL.shallow | COLL.deep));
  const ramps = src.elevation.ramps, rampAt = (x, y) => ramps.findIndex((r) => x >= r.rampBox.x0 && x <= r.rampBox.x1 && y >= r.rampBox.y0 && y <= r.rampBox.y1);
  // every walkable step between levels, and where it is
  const crossings = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
    if (nx >= W || ny >= H) continue;
    const a = y * W + x, b = ny * W + nx;
    if (walk(a) && walk(b) && m.height[a] !== m.height[b]) crossings.push({ x, y, nx, ny, lo: Math.min(m.height[a], m.height[b]), hi: Math.max(m.height[a], m.height[b]), ra: rampAt(x, y), rb: rampAt(nx, ny) });
  }
  {
    const bad = [], steps = new Map();
    if (ramps.length !== 8) bad.push(`${ramps.length} ramps (the plan has 8)`);
    ramps.forEach((r, k) => {
      const b = r.rampBox, lv = new Set();
      if (r.levels[1] - r.levels[0] !== 1) bad.push(`${r.id} joins levels ${r.levels[0]} and ${r.levels[1]}, which aren't neighbours`);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (m.land[y * W + x]) lv.add(m.height[y * W + x]);
      const got = [...lv].sort().join(",");
      if (got !== r.levels.join(",")) bad.push(`${r.id}'s box holds levels ${got || "none"}, not ${r.levels.join(" and ")}`);
      const n = crossings.filter((c) => c.ra === k && c.rb === k).length;
      if (!n) bad.push(`${r.id} has no walkable step between its levels`);
      steps.set(r.id, n);
      ramps.forEach((q, j) => { if (j > k && b.x0 <= q.rampBox.x1 && q.rampBox.x0 <= b.x1 && b.y0 <= q.rampBox.y1 && q.rampBox.y0 <= b.y1) bad.push(`${r.id} and ${q.id} overlap`); });
    });
    add("ramps", bad.length === 0, bad.length ? bad.join("; ") : ramps.map((r) => `${r.number} ${r.id} ${r.levels.join("-")} (${steps.get(r.id)} steps)`).join(", "));
  }
  {
    const bad = crossings.filter((c) => c.hi - c.lo !== 1 || c.ra < 0 || c.ra !== c.rb || ramps[c.ra].levels[0] !== c.lo || ramps[c.ra].levels[1] !== c.hi);
    const big = crossings.filter((c) => c.hi - c.lo > 1).length;
    add("level-crossings-only-in-ramps", bad.length === 0, bad.length ? `${bad.length} walkable step(s) between levels outside a ramp${big ? `, ${big} of them two or more levels` : ""}: ${bad.slice(0, 6).map((c) => `${c.x},${c.y}-${c.nx},${c.ny} (${c.lo}-${c.hi})`).join(" ")}` :
      `${crossings.length} walkable steps between levels, every one inside a ramp as its two levels; none of 0-2, 0-3 or 1-3`);
  }
  // reachability from the arrival plaza: by collision alone, and with level changes allowed only in ramps
  const pb = src.exits.south.arrivalPlazaBox, starts = [];
  for (let y = pb.y0; y <= pb.y1; y++) for (let x = pb.x0; x <= pb.x1; x++) starts.push(y * W + x);
  const reach = (skipRamp) => {
    const seen = new Uint8Array(W * H), q = [];
    for (const i of starts) if (walk(i) && !seen[i]) { seen[i] = 1; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % W, y = (i - x) / W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (seen[j] || !walk(j)) continue;
        if (skipRamp !== undefined && m.height[i] !== m.height[j]) { const r = rampAt(x, y); if (r < 0 || r !== rampAt(nx, ny) || r === skipRamp) continue; }
        seen[j] = 1; q.push(j);
      }
    }
    return seen;
  };
  const byColl = reach(), byLevels = reach(-1);
  {
    let walkable = 0, reached = 0, same = true; const left = [];
    for (let i = 0; i < W * H; i++) { if (walk(i)) { walkable++; if (byColl[i]) reached++; else left.push(i); } if (byColl[i] !== byLevels[i]) same = false; }
    const plazaOk = starts.every((i) => walk(i) && m.height[i] === 0);
    const pockets = []; const seenP = new Uint8Array(W * H);
    for (const i of left) if (!seenP[i]) { const g = flood([i], (j) => walk(j) && !byColl[j], W, H); let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; for (let j = 0; j < W * H; j++) if (g[j]) { seenP[j] = 1; n++; const x = j % W, y = (j - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } pockets.push(`${n} tiles x ${x0}-${x1}, y ${y0}-${y1}`); }
    add("connected", plazaOk && reached === walkable && same, `${walkable} walkable tiles, ${reached} reachable from the arrival plaza${pockets.length ? `; ${pockets.length} cut-off pocket(s): ${pockets.slice(0, 5).join("; ")}` : ", no pockets"}; ${same ? "the same" : "NOT the same"} when levels may change only in ramps${plazaOk ? "" : "; the arrival plaza isn't all walkable level 0"}`);
  }
  // the volcano mass: every land tile of it solid, and no walkable level 3 but the shrine knoll's
  const regionTiles = (id) => { const r = src.elevation.regions.find((q) => q.id === id); if (!r) return null; const g = raster(regionPoly(r), W, H); const t = []; for (let i = 0; i < W * H; i++) if (g[i] && m.land[i]) t.push(i); return { r, t }; };
  {
    const v = regionTiles("volcano-mass"), k = regionTiles("shrine-knoll");
    const bad = [];
    if (!v || !v.r.solid) bad.push("the volcano-mass region is missing or isn't solid");
    if (v) { const open = v.t.filter((i) => !(m.coll[i] & COLL.solid)).length; if (open) bad.push(`${open} volcano-mass tile(s) aren't solid`); if (v.t.some((i) => m.height[i] !== 3)) bad.push("volcano-mass tiles below level 3"); }
    const stray = []; for (let i = 0; i < W * H; i++) if (walk(i) && m.height[i] === 3 && !(k && k.t.includes(i))) stray.push(i);
    if (stray.length) bad.push(`${stray.length} walkable level-3 tile(s) outside the shrine knoll`);
    add("volcano-blocked", bad.length === 0, bad.length ? bad.join("; ") : `${v.t.length} volcano-mass land tiles, all solid (reserved: ${v.r.reservedFor}); the only walkable level 3 is the shrine knoll`);
  }
  // the shrine knoll: walkable, reachable, and only by its stairs
  {
    const k = regionTiles("shrine-knoll"), stairs = ramps.findIndex((r) => r.id === "shrine-stairs"), bad = [];
    const open = k ? k.t.filter((i) => walk(i) && m.height[i] === 3) : [];
    if (!open.length) bad.push("no walkable level-3 tile on the shrine knoll");
    const reached = open.filter((i) => byColl[i]).length;
    if (open.length && !reached) bad.push("the shrine knoll can't be reached from the arrival plaza");
    if (stairs < 0) bad.push("there is no shrine-stairs ramp");
    else { const without = reach(stairs); if (open.some((i) => without[i])) bad.push("the knoll can be reached without its stairs"); }
    const into3 = crossings.filter((c) => c.hi === 3);
    if (into3.some((c) => c.ra !== stairs)) bad.push("a step up to level 3 outside the shrine stairs");
    const lb = src.exits.northwest.landingBox; let landing = 0, landingOk = 0;
    for (let y = lb.y0; y <= lb.y1; y++) for (let x = lb.x0; x <= lb.x1; x++) { landing++; if (walk(y * W + x) && byColl[y * W + x]) landingOk++; }
    if (landingOk !== landing) bad.push(`the rope-bridge landing has ${landing - landingOk} tile(s) not walkable and reachable`);
    add("shrine-knoll-by-its-stairs", bad.length === 0, bad.length ? bad.join("; ") : `${open.length} walkable level-3 tiles on the knoll, ${reached} reachable, none without the shrine stairs (${into3.length} steps up to level 3, all on the stairs); the bridge landing (${landing} tiles) is on it and reachable`);
  }
  // the exits' land: reachable on foot
  {
    const bad = [], S = src.exits.south;
    const all = (b, nm, f) => { for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (!f(y * W + x)) { bad.push(nm); return; } };
    all(S.quayBox, "the quay's land isn't all walkable and reachable", (i) => walk(i) && byColl[i]);
    all(S.ferryTerminalReserveBox, "the ferry terminal reserve isn't all walkable and reachable", (i) => walk(i) && byColl[i]);
    const jb = src.exits.west.jettyBox; let jl = 0; all(jb, "", (i) => { if (m.land[i]) { jl++; if (!(walk(i) && byColl[i])) return false; } return true; });
    if (bad.includes("")) { bad.splice(bad.indexOf(""), 1); bad.push("the west jetty's root isn't walkable and reachable"); }
    add("exits-reachable", bad.length === 0, bad.length ? bad.join("; ") : `quay, ferry terminal reserve and the west jetty's root (${jl} land tiles) walkable and reachable from the plaza`);
  }

  // the accepted build
  {
    if (!acc) add("accepted-build", false, `no accepted build in ${rel(ACCEPTED_PATH)} (run map-lint --accept --reason="...")`);
    else {
      const diffs = Object.keys(sum.digests).filter((k) => sum.digests[k] !== acc.digests[k]);
      add("accepted-build", diffs.length === 0 && sum.landTiles === acc.landTiles && JSON.stringify(sum.levelTiles) === JSON.stringify(acc.levelTiles), diffs.length ? `differs from the accepted build in ${diffs.join(", ")} (accept a deliberate change with --accept --reason="...")` :
        `matches accepted build ${accepted.history.length}, stage ${acc.stage}: "${accepted.history[accepted.history.length - 1].reason}"`);
    }
  }
  return out;
}

/* the staged file is marked staged and can't replace the game's island even if something loaded it: it
   registers window.ISLAND_MAPS_STAGED, and its code never names the game's registry */
function stagedNotRuntime(text) {
  const ctx = { window: {} };
  try {
    vm.runInNewContext(text, ctx);
    const s = ctx.window.ISLAND_MAPS_STAGED && ctx.window.ISLAND_MAPS_STAGED.home;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "");            // the code, not the header that explains it
    const ok = !!s && s.format === 2 && s.staged === true && s.runtimeSupported === false && ctx.window.ISLAND_MAPS === undefined && !/ISLAND_MAPS(?!_STAGED)/.test(code);
    return { ok, why: `${s ? `registers ISLAND_MAPS_STAGED.home (format ${s.format}, staged ${s.staged}, runtimeSupported ${s.runtimeSupported})` : "no ISLAND_MAPS_STAGED.home"}; window.ISLAND_MAPS ${ctx.window.ISLAND_MAPS === undefined ? "untouched" : "SET"}` };
  } catch (e) { return { ok: false, why: e.message }; }
}

/* ════════ accepting a build: mapb-staged.json, and nothing else ════════ */
export function acceptTo(path, record) {
  const real = (p) => (existsSync(p) ? realpathSync(p) : p).toLowerCase();
  if (real(path) !== real(ACCEPTED_PATH)) throw new Error(`refusing to accept into ${rel(path)}: --accept writes only ${rel(ACCEPTED_PATH)}; the frozen r2.1 fixture is never rewritten`);
  writeFileSync(ACCEPTED_PATH, record);
}
function acceptedRecord(m, r21, r21Levels, prev, reason) {
  const s = summary(m), d = drift(m, r21), dl = levelDrift(m, r21Levels);
  const history = (prev ? prev.history : []).concat([{ n: (prev ? prev.history.length : 0) + 1, stage: STAGE, reason, landTiles: s.landTiles, levelTiles: s.levelTiles, driftFromR21Tiles: d.tiles, levelDriftFromR21Tiles: dl.tiles, landSha256: s.digests.land, levelsSha256: s.digests.levels }]);
  const acc = { stage: STAGE, ...s, driftFromR21: { tiles: d.tiles, sha256: d.sha256 }, levelDriftFromR21: { tiles: dl.tiles, sha256: dl.sha256 } };
  return JSON.stringify({
    about: "The accepted current build of the staged MAP-B home island (tools/maps/staged/home.js). map-lint compares every build with it; change it only with node tools/map-lint.mjs --accept --reason=\"...\". The approved r2.1 record is tools/fixtures/mapb-r21.json, which is frozen and never written by any tool.",
    accepted: acc, history }, null, 2) + "\n";
}

/* ════════ the run ════════ */
const args = process.argv.slice(2);
const r21 = JSON.parse(readFileSync(R21_PATH, "utf8"));
const r21Levels = JSON.parse(readFileSync(R21_LEVELS_PATH, "utf8"));
const accepted = existsSync(ACCEPTED_PATH) ? JSON.parse(readFileSync(ACCEPTED_PATH, "utf8")) : null;
let fails = 0;
const say = (ok, name, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };

let src, sourceSha256, m;
try {
  ({ src, sourceSha256 } = await loadSource());
  m = compile(src, sourceSha256);
  say(true, "source-convention", `${rel(SOURCE_PATH)} follows the schema and the coordinate convention (inclusive ...Box, ...Tile, ...Tiles; nothing ambiguous)`);
} catch (e) { say(false, "source-convention", e.message); console.log("1 failed"); process.exit(1); }

if (args.includes("--accept")) {
  const reason = (args.find((a) => a.startsWith("--reason=")) || "").slice(9).trim();
  if (reason.length < 10) { console.error('map-lint --accept needs --reason="why this build is the intended one" (10 characters or more)'); process.exit(1); }
  const res = runChecks(src, m, { r21, r21Levels, accepted }).filter((c) => !c.ok && !["r21-land-mask", "land-count", "land-bounds", "r21-level-mask", "level-counts", "accepted-build"].includes(c.name));
  if (res.length) { res.forEach((c) => say(false, c.name, c.detail)); console.error("map-lint --accept: refusing, the build fails the checks above"); process.exit(1); }
  if (readFileSync(STAGED_PATH, "utf8") !== serialize(m, src)) { console.error("map-lint --accept: refusing, tools/maps/staged/home.js is stale (run node tools/map-compile.mjs)"); process.exit(1); }
  acceptTo(ACCEPTED_PATH, acceptedRecord(m, r21, r21Levels, accepted, reason));
  console.log(`map-lint: accepted the current build into ${rel(ACCEPTED_PATH)} (drift from r2.1: land ${drift(m, r21).tiles} tiles, levels ${levelDrift(m, r21Levels).tiles} tiles). Run map-lint again to check it.`);
  process.exit(0);
}

console.log(`map-lint ${STAGE}: ${rel(SOURCE_PATH)} -> ${rel(STAGED_PATH)}`);
for (const c of runChecks(src, m, { r21, r21Levels, accepted })) say(c.ok, c.name, c.detail);

// the staged file: current, hashed, staged, never the game's registry
const staged = existsSync(STAGED_PATH) ? readFileSync(STAGED_PATH, "utf8") : "";
const fresh = serialize(m, src);
say(staged === fresh, "staged-current", staged === fresh ? `${rel(STAGED_PATH)} equals a fresh compile (${Buffer.byteLength(staged)} bytes, sha256 ${sha256(staged).slice(0, 16)})` : `${rel(STAGED_PATH)} is ${staged ? "stale" : "missing"}: run node tools/map-compile.mjs`);
{
  const mm = /"sourceSha256": "([0-9a-f]{64})"/.exec(staged);
  const fileSha = sha256(readFileSync(SOURCE_PATH, "utf8"));
  say(!!mm && mm[1] === fileSha, "staged-source-hash", mm ? `staged ${mm[1].slice(0, 16)}, source file ${fileSha.slice(0, 16)}` : "no sourceSha256 in the staged file");
  const r = stagedNotRuntime(staged);
  say(r.ok, "staged-not-runtime", r.why);
}
// determinism: two separate compiler processes, byte for byte
{
  const run = () => execFileSync(process.execPath, [join(ROOT, "tools/map-compile.mjs"), "--stdout"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
  const a = run(), b = run();
  say(a === b && a === fresh && a === staged, "deterministic", `two compiler processes: ${a === b ? "identical" : "DIFFERENT"} (sha256 ${sha256(a).slice(0, 16)}, ${sha256(b).slice(0, 16)}); ${a === staged ? "equal to" : "NOT equal to"} the tracked file`);
  let check = "";
  try { check = execFileSync(process.execPath, [join(ROOT, "tools/map-compile.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" }).trim(); say(true, "map-compile --check", check); }
  catch (e) { say(false, "map-compile --check", (e.stderr || e.message).trim()); }
}
// the compiler can't reach js/, and production's map is the 100 x 80 island, unchanged
{
  const before = sha256(readFileSync(PROD_MAP));
  const tries = ["js/maps/home.js", "./tools/../js/maps/home.js", "JS/Maps/home.js", join(ROOT, "js/maps/home.js"), "js/maps/new.js", "js/world.js", "index.html", "tools/maps/home.src.mjs"];
  const refused = tries.filter((p) => { try { guardOut(p); return false; } catch (e) { return true; } });
  let cli = "";
  try { execFileSync(process.execPath, [join(ROOT, "tools/map-compile.mjs"), "--out=js/maps/home.js"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); cli = "the compiler EXITED 0"; }
  catch (e) { cli = /refusing to write js\/maps\/home\.js: it is under js\//.test(e.stderr) ? "map-compile --out=js/maps/home.js refused (exit " + e.status + ")" : "failed for another reason: " + (e.stderr || "").split("\n")[0]; }
  const after = sha256(readFileSync(PROD_MAP));
  say(refused.length === tries.length && /refused/.test(cli) && before === after, "output-guard", `${refused.length} of ${tries.length} forbidden paths refused (js/ in four spellings, two other js files, index.html, the source); ${cli}; js/maps/home.js ${before === after ? "unchanged" : "CHANGED"}`);
  const ctx = { window: {} }; vm.runInNewContext(readFileSync(PROD_MAP, "utf8"), ctx);
  const P = ctx.window.ISLAND_MAPS && ctx.window.ISLAND_MAPS.home;
  let clean = false; try { execFileSync("git", ["diff", "--quiet", "HEAD", "--", "js/maps/home.js"], { cwd: ROOT }); clean = true; } catch (e) { clean = false; }
  say(!!P && P.format === 1 && P.id === "home" && P.w === 100 && P.h === 80 && /^715450d/.test(P.source) && clean, "production-map",
    `js/maps/home.js: format ${P && P.format}, ${P && P.w} x ${P && P.h}, from ${P && P.source && P.source.slice(0, 7)}, ${clean ? "no change against HEAD" : "CHANGED against HEAD"}`);
}

/* ════════ self-tests: break each guard on purpose; each must be caught ════════ */
const copy = () => JSON.parse(JSON.stringify(src));
const pt = (s, id) => s.coast.points.find((p) => p.id === id);
const validate = (s) => compile(s, "self-test");                  // compile validates the source first
function expectThrow(name, fn, re) {
  try { fn(); say(false, "self-test " + name, "NOT refused"); }
  catch (e) { say(re.test(e.message), "self-test " + name, re.test(e.message) ? `refused: ${e.message.replace(/^home\.src\.mjs: /, "")}` : `refused for the wrong reason: ${e.message}`); }
}
function expectFail(name, s, checks, ctx = { r21, r21Levels, accepted }, alter) {
  let mm; try { mm = compile(s, "self-test"); } catch (e) { say(false, "self-test " + name, "didn't compile: " + e.message); return; }
  if (alter) alter(mm);                                            // break the compiled map itself, past the compiler
  const res = runChecks(s, mm, ctx), failed = res.filter((c) => !c.ok).map((c) => c.name);
  const missed = checks.filter((c) => !failed.includes(c));
  say(!missed.length, "self-test " + name, missed.length ? `NOT caught by ${missed.join(", ")}` : `caught: ${checks.map((c) => `${c} (${res.find((r) => r.name === c).detail})`).join("; ")}`);
}
console.log("self-tests (each breaks something on purpose):");
{ const s = copy(); const a = pt(s, "ash-cove-inner"), b = pt(s, "village-south-shore"); [a.x, a.y, b.x, b.y] = [b.x, b.y, a.x, a.y]; expectFail("coast self-intersection", s, ["coast-no-self-intersection", "r21-land-mask"]); }
expectThrow("control point outside the canvas", () => { const s = copy(); pt(s, "lighthouse-headland-tip").x = 151; validate(s); }, /outside the canvas/);
expectThrow("box ending at x1 = 150", () => { const s = copy(); s.seaLanes.find((l) => l.id === "east-channel").laneBox.x1 = 150; validate(s); }, /x1 must be a whole number from 0 to 149, not 150/);
expectThrow("box written as a list", () => { const s = copy(); s.exits.south.quayBox = [66, 82, 93, 83]; validate(s); }, /a rectangle must be an inclusive|must be an inclusive tile box/);
expectThrow("box with x0 > x1", () => { const s = copy(); s.exits.west.jettyBox = { x0: 19, y0: 66, x1: 17, y1: 70 }; validate(s); }, /x0 <= x1/);
expectThrow("half-open rectangle under an ambiguous name", () => { const s = copy(); s.exits.south.harbourBounds = { x0: 64, y0: 66, x1: 98, y1: 108 }; validate(s); }, /ambiguous/);
expectThrow("box with w and h instead of x1 and y1", () => { const s = copy(); s.exits.northwest.landingBox = { x0: 9, y0: 21, w: 6, h: 1 }; validate(s); }, /unknown field w/);
expectThrow("tile off the map", () => { const s = copy(); s.exits.south.routeMarkerTile = [79, 120]; validate(s); }, /y must be a whole number from 0 to 119, not 120/);
{ const s = copy(); s.w = 160; expectFail("wrong dimensions (160 x 120)", s, ["dimensions", "r21-land-mask"]); }
{ const s = copy(); pt(s, "ash-cove-inner").x -= 2; expectFail("ash-cove-inner moved 2 tiles west", s, ["r21-land-mask", "accepted-build"]); }
{ const s = copy(); pt(s, "koi-bay-inner").x = 128; expectFail("koi bay filled in", s, ["features", "r21-land-mask"]); }
{ const s = copy(); pt(s, "lighthouse-headland-tip").x = 147; expectFail("headland pushed into the east channel", s, ["sea-lanes-open", "land-bounds"]); }
{ const s = copy(); s.exits.south.routeMarkerTile = [79, 97]; expectFail("route marker on the berth tile", s, ["exits"]); }
{ const s = copy(); s.exits.south.ferryTerminalReserveBox = { x0: 82, y0: 77, x1: 87, y1: 80 }; expectFail("terminal reserve overlapping the arrival plaza", s, ["exits"]); }
{ const s = copy(); const p = pt(s, "delta-lobe"); s.coast.points.splice(s.coast.points.indexOf(p) + 1, 0, { id: "delta-lobe-copy", x: p.x, y: p.y }); expectFail("two control points at one position", s, ["coast-points-distinct"]); }
{ const t = JSON.parse(JSON.stringify(r21)); t.rows[50] = t.rows[50].slice(0, 75) + (t.rows[50][75] === "1" ? "0" : "1") + t.rows[50].slice(76);
  expectFail("frozen r2.1 fixture tampered with (one tile flipped)", copy(), ["r21-fixture-frozen", "r21-land-mask"], { r21: t, r21Levels, accepted }); }
expectThrow("--accept aimed at the frozen r2.1 fixture", () => acceptTo(R21_PATH, "{}"), /never rewritten/);
{ const r = stagedNotRuntime(staged.replace(/ISLAND_MAPS_STAGED/g, "ISLAND_MAPS")); say(!r.ok, "self-test staged file registering window.ISLAND_MAPS", r.ok ? "NOT caught" : `caught: ${r.why}`); }
{ const r = stagedNotRuntime(staged.replace('"runtimeSupported": false', '"runtimeSupported": true')); say(!r.ok, "self-test staged file claiming runtime support", r.ok ? "NOT caught" : `caught: ${r.why}`); }
// B1b: the elevation guards
const ramp = (s, id) => s.elevation.ramps.find((r) => r.id === id);
const region = (s, id) => s.elevation.regions.find((r) => r.id === id);
{ const s = copy(); s.elevation.ramps = s.elevation.ramps.filter((r) => r.id !== "shrine-stairs"); expectFail("shrine stairs ramp removed", s, ["ramps", "shrine-knoll-by-its-stairs", "connected"]); }
{ const s = copy(); ramp(s, "main-path").rampBox = { x0: 40, y0: 80, x1: 46, y1: 84 }; expectFail("main-path ramp moved off its level boundary", s, ["ramps"]); }
{ const s = copy(); ramp(s, "headland-stairs").levels = [0, 2]; expectFail("headland stairs declared as levels 0-2", s, ["ramps", "connected"]); }
{ const s = copy(); s.elevation.regions.push({ id: "test-mesa", level: 2, ellipse: { cx: 85, cy: 55, rx: 4, ry: 3, sides: 48 } }); expectFail("a level-2 mesa with no ramp (cliffs cut off its top)", s, ["connected", "r21-level-mask"]); }
{ // an unapproved crossing: a cliff rim opened in the compiled map, past the compiler
  expectFail("a cliff rim opened outside any ramp", copy(), ["level-crossings-only-in-ramps"], undefined, (mm) => {
    for (let i = 0; i < mm.w * mm.h; i++) if (mm.why[i] === WHY.rim) { const x = i % mm.w, y = (i - x) / mm.w; if (x > 40 && x < 60 && y > 60) { mm.coll[i] = COLL.none; return; } }
  });
}
{ expectFail("a walkable 0-2 step forced in the compiled map", copy(), ["level-crossings-only-in-ramps"], undefined, (mm) => {
    for (let i = 0; i < mm.w * mm.h; i++) if (mm.why[i] === WHY.rim && mm.height[i] === 1) { mm.coll[i] = COLL.none; mm.height[i] = 2; return; }
  });
}
expectThrow("a region at level 4", () => { const s = copy(); region(s, "shrine-knoll").level = 4; validate(s); }, /level must be a whole number from 0 to 3, not 4/);
expectFail("level 4 written into the compiled map", copy(), ["levels-0-to-3", "r21-level-mask"], undefined, (mm) => { mm.height[mm.land.indexOf(1)] = 4; });
{ const s = copy(); ramp(s, "shrine-stairs").rampBox = { x0: 30, y0: 40, x1: 36, y1: 44 }; expectFail("shrine knoll made unreachable (its stairs moved away)", s, ["shrine-knoll-by-its-stairs", "ramps"]); }
{ const s = copy(); region(s, "volcano-mass").ellipse.rx = 12; expectFail("volcano mass shrunk", s, ["r21-level-mask", "level-counts"]); }
{ const s = copy(); const v = region(s, "volcano-mass"); delete v.solid; delete v.reservedFor; expectFail("volcano mass no longer solid", s, ["volcano-blocked", "accepted-build"]); }
{ const s = copy(); pt(s, "west-coast-westmost").x = 4; expectFail("coast point moved while editing elevation", s, ["coast-locked", "r21-land-mask", "sea-unchanged"]); }
{ const s = copy(); s.sea.shallowWithin = 4; expectFail("sea rule changed while editing elevation", s, ["sea-unchanged", "accepted-build"]); }
{ const t = JSON.parse(JSON.stringify(r21Levels)); t.rows[60] = t.rows[60].slice(0, 70) + "2" + t.rows[60].slice(71);
  expectFail("frozen r2.1 level fixture tampered with", copy(), ["r21-levels-fixture-frozen", "r21-level-mask"], { r21, r21Levels: t, accepted }); }
{ // the guard isn't simply refusing everything: a write it allows (into tools/out/) happens, with the tracked file's bytes
  const p = join(ROOT, "tools/out/mapb/selftest/home.js");
  try {
    execFileSync(process.execPath, [join(ROOT, "tools/map-compile.mjs"), "--out=" + rel(p)], { cwd: ROOT, encoding: "utf8" });
    say(readFileSync(p, "utf8") === staged, "self-test allowed write into tools/out/", `${rel(p)} written, identical to the tracked staged file`);
  } catch (e) { say(false, "self-test allowed write into tools/out/", e.message); }
}

console.log(fails ? `${fails} failed` : "all map-lint checks and self-tests passed");
process.exit(fails ? 1 : 0);
