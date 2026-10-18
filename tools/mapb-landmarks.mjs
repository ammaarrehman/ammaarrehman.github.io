#!/usr/bin/env node
/* mapb-landmarks (MAP-B B3d4a): the two landmark bases, the tower's and the lighthouse's, each the body of its landmark on
   its approved B1e landmark footprint: the records tower-base (94,25 to 96,27, 3 x 3) and lighthouse-base (139,42 to
   140,43, 2 x 2), kind landmark, the whole footprint solid and drawn over (placeholder art in format 1's look, rising above
   the footprint), approached from the middle of the front (95,28 and 140,44). Structure only: the stations (the log, the
   tour, the links, the map pins, the tower's trace, the lighthouse's turning beam) are a later batch's and stay off.
   Real content, served through the content preview (tools/mapb-preview.mjs --content); nothing synthetic is written anywhere.

   1. Node, the content and its compiler:
      - the tracked content file is the current compile: the eight earlier records exactly as committed at B3d3 (their
        compiled bytes pinned), then the two bases; 288 solid tiles, no foot pixel;
      - each base against B1e (its footprint, kind, front; the log site), the r2.1 study and B3a (the stand in front), and
        format 1 (a one-tile station with a sprite); the ground under it and round it; its approach; roads, route ends and
        markers near it; no ground cut off;
      - malformed records, each caught by its rule (the new landmarks rule, positive and negative).
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - both locked painter digests; the layers; the bases as the game builds them; their art opaque over the footprint;
      - collision pixel by pixel; tiles; pi pushed into each base from every tile touching it, every direction that meets it,
        on the real update loop;
      - the planner to each approach, round each base, onto it (stops beside); trapped ground against the terrain preview;
      - the stations stay off: no [E] at the approach, no card, no log, nothing stored;
      - the helicopter (every 4 px, drifting descents, a real flight); see-through when pi is behind; the screen against the
        terrain preview; phones (taps, the joystick); completeness; storage; decoder refusals; three code mutations
        (Chromium); performance;
      - review screenshots (not baselines) into tools/out/mapb/b3d4a/, with a labelled diagnostic overlay the test draws over
        the page (never the game).

     node tools/mapb-landmarks.mjs
     ENGINES=chromium node tools/mapb-landmarks.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, ContentError } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// its review screenshots go to tools/out/mapb/b3d4a/; MAPB_SHOTS names another folder under tools/out/ (a later batch's regression run)
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3d4a");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;
const PLAN = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-r21-plan.json"), "utf8")).plan;

/* the approved geometry, written out so a change anywhere shows */
const LM = {
  "tower-base": { reserve: "tower", box: { x0: 94, y0: 25, x1: 96, y1: 27 }, approach: [95, 28], site: [95, 28], art: { px0: 94 * T, py0: 27 * T + T - 80, px1: 96 * T + T - 1, py1: 27 * T + T - 1 }, f1: { station: "tower", at: [58, 21], sprite: [24, 40] }, look: [95, 29] },
  "lighthouse-base": { reserve: "lighthouse", box: { x0: 139, y0: 42, x1: 140, y1: 43 }, approach: [140, 44], site: [140, 45], art: { px0: 139 * T, py0: 43 * T + T - 96, px1: 140 * T + T - 1, py1: 43 * T + T - 1 }, f1: { station: "lighthouse", at: [89, 37], sprite: [20, 50] }, look: [139, 45] }
};
const IDS = Object.keys(LM);
const tilesOf = (b) => { const o = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) o.push([x, y]); return o; };
const key = (l) => (l || []).map((p) => p.join()).sort().join(" ");
const inBox = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]], N4 = N8.slice(0, 4);
const KEYS = { "0,-1": ["ArrowUp"], "1,0": ["ArrowRight"], "0,1": ["ArrowDown"], "-1,0": ["ArrowLeft"], "1,-1": ["ArrowRight", "ArrowUp"], "1,1": ["ArrowRight", "ArrowDown"], "-1,1": ["ArrowLeft", "ArrowDown"], "-1,-1": ["ArrowLeft", "ArrowUp"] };
const pxOf = (b) => ({ px0: b.x0 * T, py0: b.y0 * T, px1: b.x1 * T + T - 1, py1: b.y1 * T + T - 1 });
const SOLID = new Set(IDS.flatMap((id) => tilesOf(LM[id].box).map((p) => p.join())));
const onBase = (seen) => seen.filter((q) => SOLID.has(q.join()));

/* ════════ 1. Node: the records and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// B3d3's eight compiled records, as committed at 1e76536 (the sha256 of their JSON, in order)
const EIGHT = "88535843d65793827a2727326b9f53b524104427c8c71ce44a6d802fcbb8aa38";
check("node", "the content: B3c's, B3d1's, B3d2's and B3d3's eight records exactly as committed (their compiled records byte for byte), then B3d4a's tower and lighthouse bases; nothing else",
  RECS.map((r) => `${r.id}:${r.kind}`).join() === "visitor:building,depot:building,bunker:building,bunker-compound:wall,raptor-yard:fence,holding-paddock:fence,koi-garden:wall,park-gate:gate,tower-base:landmark,lighthouse-base:landmark" && createHash("sha256").update(JSON.stringify(DATA.records.slice(0, 8))).digest("hex") === EIGHT,
  RECS.map((r) => r.id).join(", "));
check("node", "the content passes every rule: 288 solid tiles (275 before B3d4a, then the tower's 9 and the lighthouse's 4), no foot pixel", contentProblems(RECS, src, m).length === 0 && built.compiled.solidTiles === 288 && built.compiled.footPixels === 0, `${built.compiled.solidTiles} solid tiles, ${built.compiled.footPixels} foot pixels`);
const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
const pathId = (x, y) => { const k = m.pathOf[y * W + x]; return k >= 0 ? src.corridors.paths[k].id : null; };
const bfs = (from, block) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of N4) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
const SPAWN = m.anchors.spawnTile, before = bfs(SPAWN, (i) => m.coll[i] !== 0), after = bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1);
const PAST = (() => { const L2 = contentLayers(RECS.slice(0, 8), W, H); return bfs(SPAWN, (i) => m.coll[i] !== 0 || L2.tiles[i] === 1); })();
const R = (p) => after[p[1] * W + p[0]] >= 0;
// the ring of tiles one step out round each base (8 neighbours), and which of them are walkable
const RINGS = {}; for (const id of IDS) { const b = LM[id].box, o = []; for (let y = b.y0 - 1; y <= b.y1 + 1; y++) for (let x = b.x0 - 1; x <= b.x1 + 1; x++) if (!inBox(x, y, b)) o.push([x, y]); RINGS[id] = o; }
{ // format 1, for the comparison (js/maps/home.js): each a one-tile station, solid in its collision, with a sprite
  const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); const F1 = c.window.ISLAND_MAPS.home;
  const v1 = F1.coll.values, coll1 = (x, y) => v1[parseInt(F1.coll.rows[y][x], 36)], world = readFileSync(join(ROOT, "js/world.js"), "utf8");
  check("node", "format 1: the tower (58,21) and the lighthouse (89,37) are one-tile stations, each solid in its collision, drawn from a sprite (24 x 40 and 20 x 50 px) by the station code, which also runs their live details and their [E] (the log, the tour, the links): nothing format 1 calls a base",
    IDS.every((id) => { const f = LM[id].f1; return JSON.stringify(F1.stations[f.station]) === JSON.stringify(f.at) && coll1(f.at[0], f.at[1]) === 1; }) && world.includes('"tower":[73,63,24,40]') && world.includes('"lighthouse":[179,0,20,50]'),
    IDS.map((id) => `${LM[id].f1.station} ${JSON.stringify(F1.stations[LM[id].f1.station])}`).join("; "));
}
for (const id of IDS) {
  const A = LM[id], r = RECS.find((q) => q.id === id), fp = src.reserves.footprints.find((q) => q.id === A.reserve);
  const logSite = src.planningMarkers.logSites.find((q) => q.id === A.reserve);
  const b = A.box, w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, tiles = tilesOf(b);
  check("node", `${id}: B1e's landmark footprint ${A.reserve} is ${b.x0},${b.y0} to ${b.x1},${b.y1} (${w} x ${h}), kind landmark, front south; the r2.1 study's base for it starts at the same corner (${JSON.stringify(PLAN.landmarkBases[A.reserve])}, ${A.reserve === "lighthouse" ? "3 x 3 there, 2 x 2 as approved" : "the same size"})`,
    fp && JSON.stringify(fp.footprintBox) === JSON.stringify(b) && fp.kind === "landmark" && fp.front === "south" && PLAN.landmarkBases[A.reserve][0] === b.x0 && PLAN.landmarkBases[A.reserve][1] === b.y0, fp ? JSON.stringify(fp) : "no footprint");
  check("node", `${id}: the record is a landmark base on that footprint (reserve ${A.reserve}), named for it, placeholder art; its solid the footprint exactly (${tiles.length} tiles), its one drawn box as wide as the footprint and standing on its front edge, ${A.art.py1 - A.art.py0 + 1} px tall; no door, foot box, opening, room, compound or marker`,
    r && r.kind === "landmark" && r.reserve === A.reserve && r.art === "placeholder" && key(r.tiles) === key(tiles) && r.drawnPxBoxes.length === 1 && JSON.stringify(r.drawnPxBoxes[0]) === JSON.stringify(A.art) && !r.doorTiles.length && !r.footPxBoxes.length && !r.gapTiles && !r.room && !r.compound && !r.marker && !r.encloses,
    r ? JSON.stringify({ tiles: r.tiles.length, art: r.drawnPxBoxes[0] }) : "no record");
  const bad = tiles.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.height[y * W + x] !== 2 || m.ground[y * W + x] !== 3 || foot(x, y) || pathId(x, y) || m.rampOf[y * W + x] >= 0);
  check("node", `${id}: every footprint tile is open level-2 grass (no terrain flag, path, ramp or foot-blocking pixel): the base stands on open ground`, bad.length === 0, bad.length ? bad.join(" ") : `${tiles.length} tiles`);
  const [ax, ay] = A.approach;
  check("node", `${id}: its approach ${ax},${ay} is the middle of its front (floor(x0 + w / 2), y1 + 1), B3a's stand for its station, open ground with no foot-blocking pixel, reached from the spawn (${after[ay * W + ax]} steps, as before B3d4a: ${PAST[ay * W + ax]}); B1e's log site ${A.site} reached`,
    ax === Math.floor(b.x0 + w / 2) && ay === b.y1 + 1 && m.coll[ay * W + ax] === 0 && !foot(ax, ay) && !LAYER.tiles[ay * W + ax] && R(A.approach) && after[ay * W + ax] === PAST[ay * W + ax] && logSite && logSite.siteTile.join() === A.site.join() && R(A.site), `${pathId(ax, ay) || "grass"}; the study's station ${JSON.stringify(PLAN.stations[A.reserve])}`);
  const ring = RINGS[id], walk = ring.filter(([x, y]) => m.coll[y * W + x] === 0), unreached = walk.filter((p) => !R(p) || LAYER.tiles[p[1] * W + p[0]]);
  check("node", `${id}: round it, the ${walk.length} walkable tiles of the ${ring.length} one step out are open (no content) and reached from the spawn`, walk.length > 0 && unreached.length === 0, `not walkable: ${ring.filter(([x, y]) => m.coll[y * W + x] !== 0).map((p) => p.join()).join(" ") || "none"}`);
  notes.push(`node: ${id}: ${walk.length} walkable of the ${ring.length} tiles round it (${ring.filter(([x, y]) => m.coll[y * W + x] !== 0).length} water or rim); ${ring.filter(([x, y]) => foot(x, y)).length} of them with foot-blocking pixels`);
}
{
  const lost = [], closed = new Set(RECS.filter((r) => r.encloses).flatMap((r) => r.inner.map(([x, y]) => y * W + x)));
  for (let i = 0; i < W * H; i++) if (before[i] >= 0 && after[i] < 0 && !LAYER.tiles[i] && !closed.has(i)) lost.push(`${i % W},${(i / W) | 0}`);
  const ends = (src.corridors.routeEnds || []).filter((e) => !R(e.endTile)), mk = src.reserves.markers.filter((q) => !R(q.approachTile || q.markerTile));
  const trail = (id) => { const k = src.corridors.paths.findIndex((p) => p.id === id), o = []; for (let i = 0; i < W * H; i++) if (m.pathOf[i] === k && m.coll[i] === 0) o.push([i % W, (i / W) | 0]); return o; };
  const ts = ["tower-trail", "koi-headland-road", "keeper-cottage-door"].map((id) => { const o = trail(id); return { id, n: o.length, bad: o.filter((p) => !R(p) || LAYER.tiles[p[1] * W + p[0]]) }; });
  const kc = src.reserves.footprints.find((q) => q.id === "keeper-cottage"); let kcSolid = 0; for (const [x, y] of tilesOf(kc.footprintBox)) kcSolid += LAYER.tiles[y * W + x];
  check("node", "no ground cut off (every tile the spawn reached on the terrain alone it still reaches, but for content tiles and the paddocks' insides, 77); the tower trail, the koi-headland road and the keeper cottage's door trail open every walkable tile; all 17 route ends and every B1e marker reached; the keeper cottage's reserve (134,40 to 137,41) unused",
    lost.length === 0 && closed.size === 77 && ends.length === 0 && mk.length === 0 && ts.every((q) => q.n > 0 && !q.bad.length) && kcSolid === 0, `${lost.length} cut off; ${ts.map((q) => `${q.id} ${q.n}`).join(", ")}; route ends cut off: ${ends.map((e) => e.id).join(", ") || "none"}`);
  perf.push(`node: walking distance from the spawn (tiles): the tower's approach ${after[28 * W + 95]} (before B3d4a ${PAST[28 * W + 95]}); the lighthouse's ${after[44 * W + 140]} (${PAST[44 * W + 140]}); the route end lighthouse-headland ${after[45 * W + 140]} (${PAST[45 * W + 140]}); the research forecourt ${after[26 * W + 110]} (${PAST[26 * W + 110]})`);
}
// malformed records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const TR = (o) => o.records.find((r) => r.id === "tower-base"), LR = (o) => o.records.find((r) => r.id === "lighthouse-base");
const BAD = [
  ["the tower base with no art", "landmarks", (o) => { delete TR(o).art; }],
  ["the tower base naming no footprint", "landmarks", (o) => { delete TR(o).reserve; }],
  ["the tower base on a building's footprint (the visitor centre's)", "landmarks", (o) => { TR(o).reserve = "visitor-centre"; }],
  ["the tower base named for something else", "landmarks", (o) => { TR(o).id = "watchtower"; }],
  ["the tower base one row short of its footprint", "landmarks", (o) => { TR(o).solid.tileBoxes[0].y1 = 26; }],
  ["the tower base a row beyond its footprint", "reserve", (o) => { TR(o).solid.tileBoxes[0].y1 = 28; TR(o).drawnPxBoxes[0].py1 += 16; }],
  ["the tower base's footprint as a list of tiles", "landmarks", (o) => { TR(o).solid = { tiles: tilesOf(LM["tower-base"].box) }; }],
  ["the tower's art wider than its footprint", "landmarks", (o) => { TR(o).drawnPxBoxes[0].px1 += 16; }],
  ["the tower's art below its footprint", "landmarks", (o) => { TR(o).drawnPxBoxes[0].py1 += 4; }],
  ["the tower's art short of its footprint's top (collision outside the art)", "drawn", (o) => { TR(o).drawnPxBoxes[0].py0 = 25 * T + 4; }],
  ["a door on the lighthouse base", "landmarks", (o) => { LR(o).doorTiles = [[140, 44]]; }],
  ["a foot box on the lighthouse base", "landmarks", (o) => { LR(o).solid.footPxBoxes = [{ px0: 140 * T + 2, py0: 44 * T + 2, px1: 140 * T + 5, py1: 44 * T + 5 }]; }],
  ["a marker on the lighthouse base", "schema", (o) => { LR(o).marker = "park-gate"; }],
  ["something solid on the lighthouse's approach (a crate on 140,44)", "landmarks", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 140, y0: 44, x1: 140, y1: 44 })], solid: { tiles: [[140, 44]] } }); }],
  ["a second base on the tower's footprint", "schema", (o) => { o.records.push(copy(TR(o))); }],
  ["something else solid inside the tower's footprint", "overlap", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 95, y0: 27, x1: 95, y1: 27 })], solid: { tiles: [[95, 27]] } }); }]
];
for (const [label, rule, fn] of BAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => q[0]) : []; }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed: ${label} is caught by rule ${rule}`, caught.includes(rule), caught.join(", ") || "NOT caught");
}
// pi walked into each base: from every walkable tile touching it, every direction whose next tile is the base
const PUSHES = [];
for (const id of IDS) for (const [x, y] of RINGS[id]) { if (m.coll[y * W + x] !== 0) continue; for (const [dx, dy] of N8) if (inBox(x + dx, y + dy, LM[id].box)) PUSHES.push({ id, at: [x, y], d: [dx, dy], hit: [x + dx, y + dy] }); }
check("node", "B3d4a's own test geometry: pushes into each base from every walkable tile round it, every direction that meets it (straight and diagonal, every corner)", IDS.every((id) => PUSHES.filter((p) => p.id === id).length > 10),
  IDS.map((id) => `${id} ${PUSHES.filter((p) => p.id === id).length}`).join(", "));

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const REFUSE = [
  ["the tower base with no art", (c) => { delete DR(c, "tower-base").art; }, /^content record tower-base is a landmark with no art/],
  ["the tower base's footprint not a rectangle", (c) => { const r = DR(c, "tower-base"); r.tiles.pop(); c.solidTiles--; }, /^content record tower-base: a landmark base's solid must be one full rectangle/],
  ["the tower's art wider than its footprint", (c) => { DR(c, "tower-base").drawnPxBoxes[0].px1 += 16; }, /its placeholder art is one box as wide as its footprint, standing on its front edge/],
  ["the tower's art below its footprint", (c) => { DR(c, "tower-base").drawnPxBoxes[0].py1 += 4; }, /its placeholder art is one box as wide as its footprint/],
  ["the tower's art short of its footprint (collision outside it)", (c) => { DR(c, "tower-base").drawnPxBoxes[0].py0 = 25 * T + 4; }, /is solid outside what it draws .*no invisible collision/],
  ["a door on the lighthouse base", (c) => { DR(c, "lighthouse-base").doorTiles = [[140, 44]]; }, /^content record lighthouse-base is a landmark base: it blocks whole tiles, and it has no foot box, door/],
  ["a foot box on the lighthouse base", (c) => { DR(c, "lighthouse-base").footPxBoxes = [{ px0: 140 * T + 2, py0: 44 * T + 2, px1: 140 * T + 5, py1: 44 * T + 5 }]; c.footPixels += 16; }, /is a landmark base: it blocks whole tiles/],
  ["a marker on the lighthouse base", (c) => { DR(c, "lighthouse-base").marker = "park-gate"; }, /^content record lighthouse-base\.marker "park-gate": only a gate stands on a marker$/],
  ["something solid on the lighthouse's approach", (c) => { c.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 140, y0: 44, x1: 140, y1: 44 })], tiles: [[140, 44]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; }, /^content record lighthouse-base: its approach 140,44 \(the middle of its front\) isn't open ground$/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  undrawn: ["the landmark bases left out of the scene (their collision with no art)", (s) => s.replace("LANDMARKS.forEach(function (lm) { if (lm.x1 >= x0 - 4", "LANDMARKS.forEach(function (lm) { if (false && lm.x1 >= x0 - 4")],
  open: ["the landmark bases left out of the content collision (art with no collision)", (s) => s.replace("owner[i] = r.id; cc[i] = C_SOLID; nT++;", "owner[i] = r.id; if (r.kind !== \"landmark\") cc[i] = C_SOLID; nT++;")],
  noShape: ["the decoder's landmark shape checks removed", (s) => s.replace('if (r.kind === "landmark") landmarkShape(r, f, drawn);', "")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlay and its legend are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3d4a-(overlay|legend)/.test(WORLD));

const port = 9760 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11#island";

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const open = async (url, { world, store, ctxOpts, wait = 0 } = {}) => {
    const ctx = await browser.newContext(ctxOpts || { viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (msg) => { if (msg.type() === "error" && !page.__shooting) errs.push(msg.text()); });
    if (store) await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, store);
    if (world) await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: world }));
    await page.goto(url);
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => true, () => false);
    if (loaded && wait) await page.waitForTimeout(wait);
    return { ctx, page, errs, loaded, I: (fn, a) => page.evaluate(fn, a) };
  };
  const shoot = async (P, f) => { P.page.__shooting = true; await P.page.screenshot({ path: join(OUT, f) }); await P.page.waitForTimeout(50); P.page.__shooting = false; };
  const walk = (P, from, to, loose = false) => P.I(([f, tt, lo]) => {
    const I2 = window.__island; if (f) { I2.teleport(f[0], f[1]); I2.step(1); }
    const s0 = I2.getState().pi.stalls, plan = I2.walkTo(tt[0], tt[1], lo); if (plan === null) return { plan: null };
    const seen = []; let n = 0;
    for (; n < 8000; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
    const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], px: [p.x, p.y], seen, frames: n, stalls: p.stalls - s0 };
  }, [from, to, loose]);
  const tilePx = (p) => [p[0] * T + 8, p[1] * T + 10];
  // held keys on the update loop (as in tools/mapb-koi-gate.mjs): pi at the nearest spot in the tile where its feet are clear, the keys
  // held for n frames; every tile it stands on, and any frame its feet touch a solid pixel
  const hold = async (P, keys, at, n = 150) => {
    const start = await P.I(([x, y]) => { const I2 = window.__island, clear = (a, b) => [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(a + dx, b + dy));
      let s = [x, y]; if (!clear(x, y)) { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); let best = null; for (let b = ty * 16 + 2; b < ty * 16 + 15; b++) for (let a = tx * 16 + 4; a < tx * 16 + 12; a++) if (clear(a, b) && (!best || Math.hypot(a - x, b - y) < Math.hypot(best[0] - x, best[1] - y))) best = [a, b]; s = best; }
      if (!s) return null; I2.teleport(s[0], s[1]); I2.step(1); return s; }, at);
    if (!start) return null;
    for (const k of keys) await P.page.keyboard.down(k);
    const r = await P.I((nn) => { const I2 = window.__island; let bad = 0; const tiles = []; for (let f = 0; f < nn; f += 2) { I2.step(2); const p = I2.getState().pi, q = Math.floor(p.x / 16) + "," + Math.floor(p.y / 16); if (tiles[tiles.length - 1] !== q) tiles.push(q); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) bad++; } const p = I2.getState().pi; return { x: p.x, y: p.y, bad, tiles: tiles.map((s) => s.split(",").map(Number)) }; }, n);
    for (const k of keys) await P.page.keyboard.up(k);
    return Object.assign(r, { start });
  };
  const cardAway = async (P) => { const go = await P.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { const bb = await go.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(200); } };
  const settle = (P, at) => P.I(([x, y]) => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(x, y); let c0 = ""; for (let i = 0; i < 600; i++) { I2.step(1); const c = I2.preview().camera.join(); if (c === c0 && i > 30) break; c0 = c; } }, at);
  const screenOf = (P, wx, wy) => P.I(([a, b]) => { const v = window.__island.preview(), E = v.ui.scale * v.zoom; return { sx: (a - v.camera[0]) * E, sy: (b - v.camera[1]) * E, tile: 16 * E }; }, [wx, wy]);
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });
  const hideDbg = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; });
  const sortK = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k2) => [k2, o[k2]]));

  // 2a. the terrain preview and production: no landmark base
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => window.__island.preview()) : null;
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;
  check(name, "terrain preview: no content, no landmark base; both locked painter digests", tp.loaded && !tp.errs.length && tv.previewMode === "terrain" && tv.content === null && tv.landmarks.length === 0 && tDig.td === TERRAIN_SHA && tDig.gd === GROUND_SHA,
    tv ? `landmarks ${tv.landmarks.length}, terrain ${tDig.td.slice(0, 12)}, ground ${tDig.gd.slice(0, 12)}` : tp.errs.join("; "));
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`); const v = P.loaded ? await P.I(() => window.__island.preview()) : null;
    check(name, "production: format 1, 100 x 80, no preview, no content, no MAP-B landmark base; its stations run as before (13: the 11 outdoor ones, the tower and the lighthouse among them, and the bunker room's rack and desk; map-parity checks them)", P.loaded && !P.errs.length && v.format === 1 && v.w === 100 && v.h === 80 && v.previewMode === null && v.content === null && v.landmarks.length === 0 && v.systems.stations === 13 && v.sys.stations === true && !v.saveLocked,
      v ? `format ${v.format}, ${v.w} x ${v.h}, landmarks ${v.landmarks.length}, stations ${v.systems.stations}` : P.errs.join("; ")); await P.ctx.close(); }

  // 2b. the content preview
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  check(name, "content preview: loads with the ten records (288 solid tiles), only the buildings system on (the stations off: no station, log or tour); both bases as their records say (footprint, approach, art box)",
    cp.loaded && !cp.errs.length && cv.content.records === 10 && cv.content.solidTiles === 288 && cv.sys.buildings === true && cv.sys.stations === false && cv.systems.stations === 0 && cv.landmarks.length === 2 &&
      IDS.every((id) => { const v = cv.landmarks.find((q) => q.id === id), A = LM[id]; return v && v.reserve === A.reserve && v.box.join() === [A.box.x0, A.box.y0, A.box.x1, A.box.y1].join() && v.approach.join() === A.approach.join() && v.art.join() === [A.art.px0, A.art.py0, A.art.px1, A.art.py1].join(); }),
    cv ? JSON.stringify(cv.landmarks) : cp.errs.join("; "));
  check(name, "content preview: everything B3c to B3d3 built exactly as before (three buildings; the compound wall 53 tiles, sandbags; the koi garden wall 53, garden; both paddock fences closing their insides; the park gate)",
    cv && cv.buildings.map((b) => b.id).join() === "visitor,depot,bunker" && cv.walls.map((q) => `${q.id}:${q.tiles}:${q.look}`).join() === "bunker-compound:53:sandbags,koi-garden:53:garden" && sortK(cv.walls[0].kinds) === sortK({ corner: 4, run: 40, pier: 7, post: 2 }) && sortK(cv.walls[1].kinds) === sortK({ corner: 4, run: 32, pier: 9, post: 6, end: 2 }) &&
      cv.fences.map((f) => `${f.id}:${f.tiles}:${f.encloses}`).join() === "raptor-yard:30:true,holding-paddock:36:true" && cv.gates.map((g) => `${g.id}:${g.posts.map((p) => p.join(".")).join("+")}`).join() === "park-gate:72.38+76.38", cv ? "" : "");
  if (cp.loaded) {
    await cp.I(() => { const I2 = window.__island; I2.teleport(95 * 16 + 8, 29 * 16 + 10); I2.step(4); I2.teleport(140 * 16 + 8, 45 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, both bases drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview (the bases are drawn in the object layer, never the ground)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the compiler's (288 tiles, the bases' 9 and 4 among them), kept apart from the terrain's (the compiler's, untouched); gameplay is their union", lay && [...SOLID].every((k) => { const [x, y] = k.split(",").map(Number); return L.k[y * W + x] !== 0; }));
    for (const id of IDS) {
      const a = await cp.I((i2) => { const q = window.__island.landmarkArt(i2); delete q.png; return q; }, id), A = LM[id];
      check(name, `${id}: its art is ${A.art.px1 - A.art.px0 + 1} x ${A.art.py1 - A.art.py0 + 1} px (its box), opaque over all ${tilesOf(A.box).length * 256} pixels of its footprint`, a && a.w === A.art.px1 - A.art.px0 + 1 && a.h === A.art.py1 - A.art.py0 + 1 && a.opaque === a.footprint && a.footprint === tilesOf(A.box).length * 256, a ? `${a.opaque} of ${a.footprint}` : "none");
    }
    // collision, pixel by pixel; tiles
    const pc = await cp.I(([lms]) => {
      const I2 = window.__island, o = {};
      for (const [id, b, ring, ap] of lms) {
        let n = 0, bad = 0, rim = 0, rimBad = 0;
        for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) { n++; if (!I2.blocked(px, py) || I2.terrainBlocked(px, py)) bad++; }
        for (let k = 0; k < (b.x1 - b.x0 + 1) * 16; k++) { for (const py of [b.y0 * 16 - 1, b.y1 * 16 + 16]) { rim++; if (I2.blocked(b.x0 * 16 + k, py) !== I2.terrainBlocked(b.x0 * 16 + k, py)) rimBad++; } }
        for (let k = 0; k < (b.y1 - b.y0 + 1) * 16; k++) { for (const px of [b.x0 * 16 - 1, b.x1 * 16 + 16]) { rim++; if (I2.blocked(px, b.y0 * 16 + k) !== I2.terrainBlocked(px, b.y0 * 16 + k)) rimBad++; } }
        const solidTiles = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const q = I2.tile(x, y); if (q.walkable || !q.content || I2.safe(x, y)) solidTiles.push(x + "," + y); }
        const openRing = ring.filter(([x, y]) => I2.tile(x, y).walkable && (I2.tile(x, y).content || !I2.safe(x, y))).map((p) => p.join());
        o[id] = { n, bad, rim, rimBad, solidTiles, openRing, ap: I2.safe(ap[0], ap[1]) && !I2.tile(ap[0], ap[1]).content };
      }
      return o;
    }, [IDS.map((id) => [id, LM[id].box, RINGS[id], LM[id].approach])]);
    for (const id of IDS) {
      const q = pc[id];
      check(name, `${id}: all ${q.n} pixels of its footprint block feet, by the content alone; the ${q.rim} pixels touching it from outside answer exactly as the terrain does; its tiles are content, not walkable, not safe; every walkable tile round it, and its approach, safe ground`,
        q.bad === 0 && q.rimBad === 0 && q.solidTiles.length === 0 && q.openRing.length === 0 && q.ap, JSON.stringify({ bad: q.bad, rimBad: q.rimBad, solid: q.solidTiles, open: q.openRing, approach: q.ap }));
    }
    // pushes on the real update loop
    const res = [];
    for (const p of PUSHES) {
      const r = await hold(cp, KEYS[p.d.join()], tilePx(p.at), 120);
      if (!r) { res.push({ p, bad: 1, crossed: ["no clear start"], gap: null }); continue; }
      let gap = null;
      if (!p.d[0] || !p.d[1]) { const [hx, hy] = p.hit; gap = p.d[1] > 0 ? hy * T - (r.y + 1) : p.d[1] < 0 ? (r.y - 2) - (hy * T + T - 1) : p.d[0] > 0 ? hx * T - (r.x + 4) : (r.x - 4) - (hx * T + T - 1); }
      res.push({ p, bad: r.bad, crossed: onBase(r.tiles).map((q) => q.join()), gap, end: [Math.floor(r.x / T), Math.floor(r.y / T)] });
    }
    for (const id of IDS) {
      const mine = res.filter((q) => q.p.id === id), straight = mine.filter((q) => q.gap !== null), diag = mine.filter((q) => q.gap === null);
      const badS = straight.filter((q) => q.bad || q.crossed.length || !(q.gap > 0 && q.gap <= 3)), badD = diag.filter((q) => q.bad || q.crossed.length);
      const sides = ["n", "e", "s", "w"].filter((sd) => straight.some((q) => ({ n: q.p.d[1] > 0, s: q.p.d[1] < 0, w: q.p.d[0] > 0, e: q.p.d[0] < 0 })[sd]));
      check(name, `${id}: pi walked straight into it from every walkable tile round it (${straight.length} pushes, against its ${sides.join(", ")} sides) stops flush (feet within 3 px), never on a solid pixel, never on it`, straight.length > 0 && badS.length === 0,
        badS.length ? badS.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: gap ${q.gap === null ? "-" : q.gap.toFixed(2)}${q.bad ? ", feet on solid " + q.bad : ""}${q.crossed.length ? ", ON IT " + q.crossed.join(" ") : ""}`).join("; ") : `gaps ${Math.min(...straight.map((q) => q.gap)).toFixed(2)} to ${Math.max(...straight.map((q) => q.gap)).toFixed(2)} px`);
      check(name, `${id}: pi walked diagonally into it (${diag.length} pushes, at every corner) slides or stops: never onto it, feet never on a solid pixel`, diag.length > 0 && badD.length === 0,
        badD.length ? badD.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: ended ${q.end}${q.bad ? ", feet on solid " + q.bad : ""}`).join("; ") : `${diag.length} pushes`);
      notes.push(`${name}: ${id}: ${mine.length} pushes on the update loop (${straight.length} straight, against its ${sides.join(", ")} sides; ${diag.length} diagonal)`);
    }
    // the planner: from the spawn to each approach; round each; onto each (stops beside)
    const pw = [];
    for (const [lab, a, b] of [["the spawn to the tower's approach", SPAWN, [95, 28]], ["the spawn to the lighthouse's approach", SPAWN, [140, 44]], ["round the tower, west to east (93,26 to 97,26)", [93, 26], [97, 26]], ["round the tower, south to north (95,28 to 95,24)", [95, 28], [95, 24]],
      ["round the lighthouse, its approach to its north side (140,44 to 139,41)", [140, 44], [139, 41]], ["round the lighthouse, west to east (138,43 to 141,43)", [138, 43], [141, 43]], ["the lighthouse's approach to the route end lighthouse-headland", [140, 44], [140, 45]]]) {
      const r = await walk(cp, tilePx(a), b); pw.push({ lab, a, b, r });
    }
    check(name, "planner: walks to each approach from the spawn, round each base (never over it), and on to the route end, on the update loop with no stall, never on a base",
      pw.every((q) => q.r.plan !== null && q.r.at.join() === q.b.join() && q.r.stalls === 0 && !onBase(q.r.seen).length), pw.map((q) => `${q.lab}: ${q.r.plan === null ? "no path" : `${q.r.plan} tiles, ended ${q.r.at}, ${q.r.stalls} stalls`}`).join("; "));
    for (const loose of [false, true]) {
      const f = await walk(cp, tilePx([95, 30]), [95, 26], loose), g2 = await walk(cp, tilePx([140, 45]), [140, 42], loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} onto a base (the tower's middle, 95,26; the lighthouse's 140,42) ends on open ground beside it, never on it`,
        f.plan !== null && g2.plan !== null && !onBase(f.seen).length && !onBase(g2.seen).length && Math.abs(f.at[0] - 95) + Math.abs(f.at[1] - 26) <= 3 && Math.abs(g2.at[0] - 140) + Math.abs(g2.at[1] - 42) <= 3, `ended ${f.at} and ${g2.at}`);
    }
    // trapped ground, pi's own planner, against the terrain preview
    const trapScan = (P) => P.I(([boxes]) => { const I2 = window.__island, cut = []; let n = 0;
      for (const [b, to] of boxes) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { if (!I2.tile(x, y).walkable) continue; n++; I2.teleport(x * 16 + 8, y * 16 + 10); if (I2.walkTo(to[0], to[1], false) === null) cut.push(x + "," + y); }
      return { n, cut }; }, [[[{ x0: 90, y0: 21, x1: 100, y1: 31 }, [95, 29]], [{ x0: 135, y0: 38, x1: 144, y1: 47 }, [138, 45]]]]);
    const trap = await trapScan(cp), trapT = tp.loaded ? await trapScan(tp) : null;
    check(name, `trapped ground: from all ${trap.n} walkable tiles within 4 of each base, pi's planner finds a path (to the trail by the tower, the road by the lighthouse) from every one it finds it from on the terrain preview, before the bases (the same tiles without one, and no more)`,
      trap.n > 100 && trapT && key(trap.cut.map((q) => [q])) === key(trapT.cut.map((q) => [q])), `content: ${trap.cut.length} without a path${trap.cut.length ? " (" + trap.cut.slice(0, 8).join(" ") + ")" : ""}; terrain preview: ${trapT ? trapT.cut.length : "-"}`);
    // the stations stay off: at each approach, no [E] and no card; nothing found, nothing stored
    const st = [];
    for (const id of IDS) {
      const [ax, ay] = LM[id].approach;
      await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 6); I2.step(4); }, [ax, ay]);
      const nb = await cp.I(() => window.__island.preview().nearby);
      // the cards on the page (the intro card may still be up in step mode), before and after [E]
      const cards = () => cp.page.evaluate(() => [...document.querySelectorAll(".w-card")].filter((c) => !c.hidden && getComputedStyle(c).display !== "none" && c.getBoundingClientRect().height > 0).map((c) => c.textContent.replace(/\s+/g, " ").trim()));
      const c0 = await cards();
      await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(30));
      const c1 = await cards(), s = await cp.I(() => window.__island.getState().room);
      st.push({ id, nb, same: JSON.stringify(c0) === JSON.stringify(c1), station: c1.some((x) => /watchtower|lighthouse|monitoring|Cyber Ready/i.test(x)), room: s, cards: c1.map((x) => x.slice(0, 30)) });
    }
    check(name, "the stations stay off in the content preview: standing at each base's approach there is nothing to use ([E] offers nothing), and [E] opens no card or room (the cards on the page are the same before and after it, none of them a station's)", st.every((q) => q.nb === null && q.same && !q.station && !q.room), JSON.stringify(st));
    // the helicopter
    const hh = await cp.I(([lms]) => {
      const I2 = window.__island; let pts = 0, ok = 0; const isS = new Set();
      for (const [, b] of lms) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { isS.add(x + "," + y); for (let py = y * 16; py < y * 16 + 16; py += 4) for (let px = x * 16; px < x * 16 + 16; px += 4) { pts++; if (I2.canLand(px, py)) ok++; } }
      const foot = (h) => [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].map(([dx, dy]) => [Math.floor((h[0] + dx) / 16), Math.floor((h[1] + dy) / 16)]);
      const runs = [[95, 31, 0, -150], [91, 26, 150, 0], [99, 26, -150, 0], [95, 22, 0, 150], [140, 47, 0, -150], [136, 43, 150, 0]].map(([x, y, vx, vy]) => { const ok0 = I2.canLand(x * 16 + 8, y * 16 + 8), r = I2.landingFrom(x * 16 + 8, y * 16 + 8, vx, vy), pt = [Math.floor(r.pi[0] / 16), Math.floor(r.pi[1] / 16)]; return { from: [x, y], ok0, state: r.state, heli: r.heli.map(Math.round), over: foot(r.heli).filter((q) => isS.has(q.join())).length, pi: pt, piSafe: I2.safe(pt[0], pt[1]), piOn: isS.has(pt.join()) }; });
      return { pts, ok, runs };
    }, [IDS.map((id) => [id, LM[id].box])]);
    check(name, `helicopter: it can't set down on either base (${hh.pts} spots, every 4 px); six descents begun where E may land, drifting at the bases from every side, park with no part over a base, pi out on safe ground`,
      hh.ok === 0 && hh.pts === 13 * 16 && hh.runs.every((r) => r.ok0 && r.state === "parked" && r.over === 0 && r.piSafe && !r.piOn), `${hh.ok} of ${hh.pts} allow a landing; ` + hh.runs.map((r) => `from ${r.from}${r.ok0 ? "" : " (E REFUSED THERE)"}: ${r.state} at ${r.heli}, pi on ${r.pi}${r.over ? " OVER A BASE" : ""}`).join("; "));
    // completeness and storage
    const comp = await cp.I(() => window.__island.completeness());
    check(name, "completeness: with both landmark bases there (each with its art) the landmark bases item is gone; a normal format-2 home made of this content would still be refused (8 items: the stations, and the sections not in the format yet)",
      comp && !comp.complete && comp.missing.length === 8 && !comp.missing.some((q) => /^(landmark bases|compound walls|the park gate|paddock fences|buildings)/.test(q)) && comp.missing.some((q) => /^stations/.test(q)), comp ? `${comp.missing.length} items missing, first: ${comp.missing.slice(0, 2).join(" | ")}` : "");
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the pushes, walks, [E] at both approaches, landings and a reload)", (await storeOf(cp)) === JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]])));
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    { const msg = await refusedHere(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
  }
  if (cp.loaded) await cp.ctx.close();

  // 2c. a real flight: E over each base is refused; beside it the helicopter lands and pi hops out on safe ground
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      await P.page.focus(".w-cv");
      const fly = async (tx, ty, tol = 6) => {
        for (let i = 0; i < 400; i++) {
          const h = (await P.I(() => window.__island.getState())).heli, dx = tx - h.x, dy = ty - h.y, dist = Math.hypot(dx, dy);
          if (Math.abs(dx) < tol && Math.abs(dy) < tol) { await P.I(() => window.__island.step(150)); const h2 = (await P.I(() => window.__island.getState())).heli; if (Math.hypot(tx - h2.x, ty - h2.y) < tol + 2) return h2; continue; }
          const ks = []; if (dx > tol) ks.push("ArrowRight"); if (dx < -tol) ks.push("ArrowLeft"); if (dy > tol) ks.push("ArrowDown"); if (dy < -tol) ks.push("ArrowUp");
          for (const k of ks) await P.page.keyboard.down(k);
          await P.I((n) => window.__island.step(n), dist > 80 ? 12 : dist > 24 ? 4 : 1);
          for (const k of ks) await P.page.keyboard.up(k);
          await P.I((n) => window.__island.step(n), dist > 24 ? 6 : 20);
        }
        return (await P.I(() => window.__island.getState())).heli;
      };
      await P.I(() => { const I2 = window.__island; I2.step(300); const h = I2.getState().heli; I2.teleport(h.x + 20, h.y + 4); I2.step(5); });
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const up = (await P.I(() => window.__island.getState())).heli.state, res2 = [];
      for (const [lab, x, y] of [["the tower's middle (95,26)", 95 * 16 + 8, 26 * 16 + 8], ["the lighthouse (140,43)", 140 * 16, 43 * 16]]) {
        const ov = await fly(x, y, 4), can = await P.I(([a, b]) => window.__island.canLand(a, b), [ov.x, ov.y]);
        await P.page.keyboard.press("e"); await P.I(() => window.__island.step(30));
        res2.push({ lab, over: [Math.round(ov.x), Math.round(ov.y)], near: Math.abs(ov.x - x) <= 8 && Math.abs(ov.y - y) <= 8, can, st: (await P.I(() => window.__island.getState())).heli.state });
      }
      check(name, "in flight: E over the tower and over the lighthouse (within 8 px of the target, where no landing fits) doesn't land: it keeps flying", up === "flying" && res2.every((q) => q.near && !q.can && q.st === "flying"), `took off: ${up}; ` + res2.map((q) => `${q.lab}: over ${q.over}, a landing ${q.can ? "fits" : "doesn't fit"}, after E ${q.st}`).join("; "));
      await fly(137 * 16 + 8, 44 * 16 + 8); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const l = await P.I(() => { const I2 = window.__island, s = I2.getState(), tx = Math.floor(s.pi.x / 16), ty = Math.floor(s.pi.y / 16); return { state: s.heli.state, heli: [Math.round(s.heli.x), Math.round(s.heli.y)], pi: [tx, ty], safe: I2.safe(tx, ty), clear: [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(s.pi.x + dx, s.pi.y + dy)) }; });
      check(name, "in flight: beside the lighthouse (137,44, on the headland road) it lands and pi hops out clear, on safe ground, off the base", l.state === "parked" && l.safe && l.clear && !SOLID.has(l.pi.join()) && !P.errs.length, JSON.stringify(l) + (P.errs.length ? " errors " + P.errs.join("; ") : ""));
    } else check(name, "in flight", false, "didn't load");
    await P.ctx.close(); }

  // 2d. on screen, against the terrain preview at the same spot, step and size (1280 x 1000; pi south of each, the whole structure in the frame,
  // the minimap folded with the game's own click): the picture differs over every footprint tile; the open tiles beside and in front
  // of it, outside its art box, look exactly as on the terrain preview
  for (const id of IDS) {
    const A = LM[id], b = A.box, artTop = Math.floor(A.art.py0 / T);
    const near = []; for (let y = b.y0; y <= b.y1 + 1; y++) for (const x of [b.x0 - 1, b.x1 + 1]) if (m.coll[y * W + x] === 0) near.push([x, y]);
    for (let x = b.x0; x <= b.x1; x++) if (m.coll[(b.y1 + 1) * W + x] === 0) near.push([x, b.y1 + 1]);
    const at = [A.look[0] * 16 + 8, A.look[1] * 16 + 10];
    const vp = { viewport: { width: 1280, height: 1000 } }, A2 = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: vp }), B2 = await open(`http://127.0.0.1:${port}/${Q}`, { ctxOpts: vp });
    if (A2.loaded && B2.loaded) {
      for (const P of [A2, B2]) await settle(P, at);
      { const ta = await A2.I(() => window.__island.getState().t), tb = await B2.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await B2.I((n) => window.__island.step(n), k); else if (k < 0) await A2.I((n) => window.__island.step(n), -k); }
      for (const P of [A2, B2]) { const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); await P.I(() => window.__island.step(1)); }
      for (const P of [A2, B2]) await P.page.waitForFunction(() => { const c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return d[0] + d[1] + d[2] > 0; }, null, { timeout: 8000 }).catch(() => {});
      for (const P of [A2, B2]) await P.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const grab = (P) => P.I(([sol, nr, i2]) => {
        const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const tile = ([x, y]) => { const x0 = Math.ceil((x * 16 - v.camera[0]) * E), y0 = Math.ceil((y * 16 - v.camera[1]) * E), x1 = Math.floor(((x + 1) * 16 - v.camera[0]) * E) - 1, y1 = Math.floor(((y + 1) * 16 - v.camera[1]) * E) - 1;
          if (x0 < 0 || y0 < 0 || x1 >= c.width || y1 >= c.height) return null; const o = []; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = (yy * c.width + xx) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; };
        const lm = v.landmarks.find((q) => q.id === i2);
        return { cam: v.camera, miniOn: v.ui.miniOn, sol: sol.map(tile), near: nr.map(tile), drawn: lm ? lm.drawn : null, artTopOnScreen: lm ? (lm.art[1] - v.camera[1]) * E : null };
      }, [tilesOf(b), near, id]);
      const a = await grab(A2), bb = await grab(B2);
      const frac = (x, y) => { if (!x || !y || x.length !== y.length) return null; let dd = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) dd++; return dd / (x.length / 3); };
      const sf = tilesOf(b).map((q, i) => frac(a.sol[i], bb.sol[i])), nf = near.map((q, i) => frac(a.near[i], bb.near[i]));
      const black = (q) => !q || q.every((v) => v === 0), drawn = !a.sol.concat(a.near).some(black) && !bb.sol.concat(bb.near).some(black);
      const same = a.cam.join() === bb.cam.join() && drawn, allIn = sf.every((v) => v !== null) && nf.every((v) => v !== null);
      const sMin = Math.min(...sf.filter((v) => v !== null)), nMax = Math.max(...nf.filter((v) => v !== null));
      check(name, `${id} on screen (1280 x 1000, scale 4, the whole structure in the frame, the minimap folded): against the terrain preview's frame, the picture differs over every footprint tile (each at least 95% of its pixels): its art is visible over every solid pixel`, same && allIn && !a.miniOn && a.artTopOnScreen >= 0 && sMin >= 0.95,
        `camera ${a.cam.join() === bb.cam.join() ? "same" : "differs"}; ${drawn ? "both drawn" : "a page NOT DRAWN"}; art top on screen at ${a.artTopOnScreen && a.artTopOnScreen.toFixed(0)} px; min ${(100 * sMin).toFixed(1)}%`);
      check(name, `${id}: the ${near.length} open tiles beside and in front of it (outside its art box) look exactly as on the terrain preview (at most 2% of a tile's pixels differ: nothing drawn on the ground round it)`, same && allIn && nMax <= 0.02,
        `max ${(100 * nMax).toFixed(2)}% differ${nf.some((v) => v > 0.02) ? " (over 2%: " + near.filter((q, i) => nf[i] > 0.02).slice(0, 6).join(" ") + ")" : ""}`);
      check(name, `${id}: drawn at its art box's origin (world px), opaque with pi in front of it`, a.drawn && a.drawn[0] === A.art.px0 && a.drawn[1] === A.art.py0 && a.drawn[4] === false, JSON.stringify(a.drawn));
    } else check(name, `${id} on screen`, false, "didn't load");
    await A2.ctx.close(); await B2.ctx.close();
  }

  // 2e. behind: walking along the row behind each base (north of it, under its art), the base is drawn see-through every frame pi is
  // behind it and its art reaches pi, and opaque once pi is in front
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      const out = [];
      for (const [id, from, to] of [["tower-base", [92, 24], [98, 24]], ["lighthouse-base", [138, 41], [139, 41]]]) {
        const r = await P.I(([i2, f, tt]) => { const I2 = window.__island; I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); I2.step(2); I2.walkTo(tt[0], tt[1], false); const o = []; for (let i = 0; i < 400; i++) { I2.step(1); const p = I2.getState().pi, lm = I2.preview().landmarks.find((q) => q.id === i2); o.push([p.x, p.y, lm.drawn ? lm.drawn[4] : null]); if (!p.path) break; } return o; }, [id, from, to]);
        const A = LM[id], sortY = (A.box.y1 + 1) * T - 2, under = r.filter(([x, y]) => y < sortY && y > A.art.py0 + 6 && x > A.art.px0 - 6 && x < A.art.px1 + 6);
        out.push({ id, frames: r.length, under: under.length, seeThrough: under.filter((q) => q[2] === true).length });
      }
      check(name, "behind: walking along the row behind each base (under its rising art), every frame pi is behind it the base is drawn see-through (pi never hidden), as a format-1 building is", out.every((q) => q.under > 5 && q.seeThrough === q.under), JSON.stringify(out));
    } else check(name, "behind", false, "didn't load");
    await P.ctx.close(); }

  // 2f. phones (390 x 844 and 375 x 667, touch): taps to each approach; a tap on a base stops pi beside it; the joystick into the tower stops
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const follow = () => P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 3000; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen, stalls: p.stalls }; });
    const taps = [];
    for (const [lab, from, to, exact] of [["to the tower's approach", [90, 30], [95, 28], true], ["onto the tower (95,26)", [95, 31], [95, 26], false], ["to the lighthouse's approach", [136, 45], [140, 44], true], ["onto the lighthouse (140,43)", [140, 46], [140, 43], false]]) {
      await settle(P, tilePx(from)); const s0 = await P.I(() => window.__island.getState().pi.stalls);
      const sc = await screenOf(P, to[0] * 16 + 8, to[1] * 16 + 8); await P.page.touchscreen.tap(sc.sx, sc.sy); const r = await follow();
      taps.push({ lab, to, exact, sc, r, stalls: r.stalls - s0, onScreen: sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh });
    }
    check(name, `phone ${vw} x ${vh}: taps walk pi to each approach with no stall; a tap on a base stops pi beside it; never on a base (a tile is ${taps[0].sc.tile.toFixed(0)} CSS px on screen)`,
      taps.every((q) => q.onScreen && !onBase(q.r.seen).length && q.stalls === 0 && (q.exact ? q.r.at.join() === q.to.join() : Math.abs(q.r.at[0] - q.to[0]) + Math.abs(q.r.at[1] - q.to[1]) <= 3)) && !P.errs.length,
      taps.map((q) => `${q.lab}: ended ${q.r.at}, ${q.stalls} stalls`).join("; ") + (P.errs.length ? "; errors " + P.errs.join("; ") : ""));
    const joy = async (from, ang, ms = 2000) => {
      await settle(P, from);
      const at = { x: Math.round(vw * 0.3), y: Math.round(vh * 0.75) };
      await P.page.evaluate(([x, y]) => { const cv = document.querySelector(".w-cv"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true })); }, [at.x, at.y]);
      await P.page.evaluate(([x, y, a]) => { const cv = document.querySelector(".w-cv"); for (let k = 1; k <= 6; k++) cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x + Math.sin(a) * 10 * k, clientY: y + Math.cos(a) * 10 * k, bubbles: true })); }, [at.x, at.y, ang]);
      const out = await P.I((n) => { const I2 = window.__island, seen = []; let bad = 0; for (let f = 0; f < n; f += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) bad++; } return { seen, bad }; }, Math.round(ms / 1000 * 60));
      await P.page.evaluate(() => { document.querySelector(".w-cv").dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, pointerType: "touch", isPrimary: true, bubbles: true })); });
      return out;
    };
    const j1 = await joy(tilePx([95, 30]), Math.PI), j2 = await joy(tilePx([140, 46]), Math.PI);
    check(name, `phone ${vw} x ${vh}: the touch joystick dragged straight up at each base from below stops pi at its front edge (row 28 at the tower, row 44 at the lighthouse), never a foot on solid, never on a base`,
      [j1, j2].every((j) => j.bad === 0 && !onBase(j.seen).length) && j1.seen[j1.seen.length - 1][1] === 28 && j2.seen[j2.seen.length - 1][1] === 44, `tower: ended ${j1.seen[j1.seen.length - 1]}; lighthouse: ended ${j2.seen[j2.seen.length - 1]}`);
    await P.ctx.close();
  }

  // 2g. performance: the bases' draw cost and the frame work walking round both on the live loop, beside the terrain preview; decoding
  if (tp.loaded) {
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.landmarkMs || 0, v.landmarkDraws || 0]; });
      await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[92, 24], "ArrowRight"], [[98, 23], "ArrowDown"], [[98, 29], "ArrowLeft"], [[137, 41], "ArrowRight"], [[141, 46], "ArrowLeft"]]) {
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at);
        await P.page.keyboard.down(k2); await P.page.waitForTimeout(1800); await P.page.keyboard.up(k2);
      }
      const r = await P.I(() => ({ f: window.__island.frames(true), v: window.__island.preview() }));
      await P.ctx.close();
      const f = r.f.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], ms: (r.v.landmarkMs || 0) - b0[0], nd: (r.v.landmarkDraws || 0) - b0[1], errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    perf.push(`${name}: live frame work walking round the tower and the lighthouse: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; one landmark base ${lc && lc.nd ? (lc.ms / lc.nd * 1000).toFixed(2) : "-"} us a draw (${lc ? lc.nd : 0} draws)`);
    check(name, "performance: walking round both bases on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const P2 = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P2.loaded) {
      const plan = (P, a, b) => P.I(([f, tt]) => { const I2 = window.__island; I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); let s = performance.now(); const n = I2.walkTo(tt[0], tt[1], false); const cold = performance.now() - s; s = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(tt[0], tt[1], false); return [cold, (performance.now() - s) / 20, n]; }, [a, b]);
      for (const [lab, a, b] of [["round the tower (93,26 to 97,26)", [93, 26], [97, 26]], ["the spawn to the lighthouse's approach", SPAWN, [140, 44]]]) {
        const xc = await plan(P2, a, b), xt = await plan(tp, a, b);
        perf.push(`${name}: path planning ${lab} (ms first / warm, tiles): content ${xc[0].toFixed(2)} / ${xc[1].toFixed(2)}, ${xc[2]}; terrain preview ${xt[0].toFixed(2)} / ${xt[1].toFixed(2)}, ${xt[2]}`);
      }
      const dec = await P2.I(([mm]) => { const I2 = window.__island; for (let i = 0; i < 3; i++) I2.decodeMap(mm); const a = performance.now(); for (let i = 0; i < 10; i++) I2.decodeMap(mm); return (performance.now() - a) / 10; }, [cWith(() => {})]);
      const decT = await tp.I(([mm]) => { const I2 = window.__island; for (let i = 0; i < 3; i++) I2.decodeMap(mm); const a = performance.now(); for (let i = 0; i < 10; i++) I2.decodeMap(mm); return (performance.now() - a) / 10; }, [STAGED_MAP]);
      perf.push(`${name}: decoding the staged map (warm, 10): ${dec.toFixed(1)} ms with the content layer (${DATA.records.length} records), ${decT.toFixed(1)} ms without (terrain preview)`);
    }
    await P2.ctx.close();
  }
  if (tp.loaded) await tp.ctx.close();

  // 2h. code mutations (Chromium only: each is a whole load)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.undrawn[1](WORLD) }); const a = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(95 * 16 + 8, 29 * 16 + 10); for (let i = 0; i < 10; i++) I2.step(1); return I2.preview().landmarks.find((q) => q.id === "tower-base").drawn; }) : "didn't load";
      caught(MUT.undrawn[0], a === null, `drawn ${JSON.stringify(a)}`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.open[1](WORLD) }); const r = P.loaded ? await P.I(() => { const I2 = window.__island; return { walk: I2.tile(95, 26).walkable, blocked: I2.blocked(95 * 16 + 8, 26 * 16 + 8) }; }) : null;
      caught(MUT.open[0], r && (r.walk || !r.blocked), r ? JSON.stringify(r) : "didn't load"); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noShape[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, "tower-base").drawnPxBoxes[0].px1 += 16; })) : "didn't load";
      caught(MUT.noShape[0], r === null, r === null ? "the tower's art wider than its footprint decoded" : r); await P.ctx.close(); }
  }

  // 2i. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    const at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
    const foldMini = async (P) => { const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); };
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: { viewport: { width: 1280, height: 1000 } }, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await foldMini(P);
        for (const id of IDS) {
          const nm = id.replace("-base", ""), A = LM[id];
          await at(P, A.look[0], A.look[1], 1500); await shoot(P, `${name}-${nm}-${tag}.png`);
          if (tag === "day") {
            // the diagnostic overlay: what blocks (the game's own content collision, read tile by tile), the art box, the approach, the
            // log site and safe ground round it
            const d = await P.I(([b, art, ap, site, idd]) => {
              const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
              c.id = "b3d4a-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
              const g = c.getContext("2d"), X = (px) => (px - v.camera[0]) * E, Y = (py) => (py - v.camera[1]) * E, Sz = 16 * E; let solid = 0;
              for (let y = b.y0 - 3; y <= b.y1 + 3; y++) for (let x = b.x0 - 3; x <= b.x1 + 3; x++) {
                const q = I2.tile(x, y);
                if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.45)"; g.fillRect(X(x * 16), Y(y * 16), Sz, Sz); g.strokeStyle = "#ff4040"; g.lineWidth = 1; g.strokeRect(X(x * 16) + 0.5, Y(y * 16) + 0.5, Sz - 1, Sz - 1); }
                else if (I2.safe(x, y)) { g.strokeStyle = "rgba(74,222,128,.75)"; g.lineWidth = 1; g.strokeRect(X(x * 16) + 2.5, Y(y * 16) + 2.5, Sz - 5, Sz - 5); }
              }
              g.setLineDash([6, 4]); g.strokeStyle = "#7dd3fc"; g.lineWidth = 2; g.strokeRect(X(art.px0), Y(art.py0), (art.px1 - art.px0 + 1) * E, (art.py1 - art.py0 + 1) * E); g.setLineDash([]);
              g.strokeStyle = "#ffd166"; g.lineWidth = 3; g.strokeRect(X(ap[0] * 16) + 1, Y(ap[1] * 16) + 1, Sz - 2, Sz - 2);
              g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.setLineDash([3, 3]); g.strokeRect(X(site[0] * 16) + 4, Y(site[1] * 16) + 4, Sz - 8, Sz - 8); g.setLineDash([]);
              cvs.parentElement.insertBefore(c, cvs.nextSibling);
              const L = document.createElement("div"); L.id = "b3d4a-legend";
              L.textContent = `B3d4a diagnostic (test overlay)\n${idd}\nred: collision, read from the\n     game (its footprint)\nblue dashed: its art box\nyellow: approach ${ap.join(",")}\nwhite dashed: B1e log site ${site.join(",")}\ngreen: safe ground\nno station: [E] does nothing`;
              Object.assign(L.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "15px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
              document.body.appendChild(L);
              return { solid };
            }, [A.box, A.art, A.approach, A.site, id]);
            check(name, `diagnostic overlay, ${id} (review screenshot only): the game's own collision within 3 tiles of it shows exactly its ${tilesOf(A.box).length} footprint tiles`, d.solid === tilesOf(A.box).length, `${d.solid} solid`);
            await shoot(P, `${name}-${nm}-diagnostic.png`);
            await P.page.evaluate(() => { for (const i3 of ["b3d4a-overlay", "b3d4a-legend"]) { const e = document.getElementById(i3); if (e) e.remove(); } });
          }
        }
      }
      await P.ctx.close();
    }
    // close-ups (1500 x 1100: scale 5), every side with pi pushing against it, pi on its way, pi behind
    { const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: 1500, height: 1100 } }, wait: 2600 });
      if (P.loaded) { await hideDbg(P); await at(P, 95, 29, 1200); await shoot(P, `${name}-tower-closeup.png`); await at(P, 140, 44, 1200); await shoot(P, `${name}-lighthouse-closeup.png`); }
      await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: 1280, height: 1000 } }, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await foldMini(P);
        const pushes = [["tower", "south", [95, 28], "ArrowUp"], ["tower", "north", [95, 24], "ArrowDown"], ["tower", "west", [93, 26], "ArrowRight"], ["tower", "east", [97, 26], "ArrowLeft"],
          ["lighthouse", "south", [140, 44], "ArrowUp"], ["lighthouse", "north", [139, 41], "ArrowDown"], ["lighthouse", "west", [138, 43], "ArrowRight"], ["lighthouse", "east", [141, 43], "ArrowLeft"]];
        for (const [nm, side, [x, y], k] of pushes) { await at(P, x, y, 600); await P.page.keyboard.down(k); await P.page.waitForTimeout(900); await shoot(P, `${name}-${nm}-push-${side}.png`); await P.page.keyboard.up(k); }
        await at(P, 90, 30, 600); await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(1100); await shoot(P, `${name}-tower-approach.png`); await P.page.keyboard.up("ArrowRight");
        await at(P, 134, 45, 600); await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(1100); await shoot(P, `${name}-lighthouse-approach.png`); await P.page.keyboard.up("ArrowRight");
        await at(P, 95, 24, 800); await shoot(P, `${name}-tower-behind.png`);
      }
      await P.ctx.close(); }
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
      const Q2 = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (Q2.loaded) { await cardAway(Q2); await hideDbg(Q2); await at(Q2, 95, 29, 1200); await shoot(Q2, `${name}-${tag}-tower.png`); await at(Q2, 140, 45, 1200); await shoot(Q2, `${name}-${tag}-lighthouse.png`); }
      await Q2.ctx.close();
    }
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); plain.close();
if (notes.length) { console.log("\nmeasured, for the record:"); notes.forEach((l) => console.log("  " + l)); }
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
