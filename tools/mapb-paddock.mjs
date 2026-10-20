#!/usr/bin/env node
/* mapb-paddock (MAP-B B3d2): the T. rex holding paddock's fence (format 1's t-rex paddock; temporary, until Ironwood), the
   record holding-paddock, kind fence, the same fence as B3d1's raptor yard: the ring round the B1e habitat holding-paddock (an
   outline, not a box: the box 106,10 to 117,17), 36 tiles, every one drawn, no openings, its 35-tile inside closed in on
   purpose. And the lane between the two paddocks: column 118, one tile wide at rows 12 to 15, between the paddock's east
   fence (x 117) and the yard's west fence (x 119). Real content, served through the content preview (tools/mapb-preview.mjs
   --content); nothing synthetic is written anywhere.

   1. Node, the content and its compiler:
      - the tracked content file is the current compile and holds B3c's records, B3d1's raptor yard exactly as approved, and
        the holding paddock's fence (and since B3d3 the koi garden's wall and the park gate, tools/mapb-koi-gate.mjs, and B3d4a's landmark bases,
        tools/mapb-landmarks.mjs; nothing else);
      - the record against B1e (the habitat's own outline points, contained, temporary until Ironwood), B3a (ring 36, inside
        35, the T. rex roam box 108,11 to 116,16 and its spawn 112,14, the viewing place 112,19) and format 1 (a closed ring,
        no gate, the roam box its inside); its ring and inside, tile by tile; each fence tile drawn and nothing else;
      - the ground under it, the ring closed and joined, its runs, corners and signs, the inside cut off and nothing else
        (both insides now: 42 and 35), the outside all round it, the lane, trails, route ends, viewing place and relief;
      - malformed holding-paddock records, each caught by its rule.
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - both locked painter digests; the layers; both fences' pieces; the art piece by piece and on screen;
      - collision pixel by pixel; the tiles; pi pushed into the fence from every tile touching it, inside and outside, along
        every direction that meets it (every corner, both sides), on the real update loop (move(), the creatures' too);
      - the planner round, along, into and up to the fence; trapped ground;
      - the lane: keyboard entries across its whole mouth from both ends, diagonals, side pushes inside it, the planner
        through it, the touch joystick, phone taps, how well pi shows in it, and helicopter landings over it;
      - the helicopter (every 4 px, drifting descents, a real flight); phones; completeness; storage; decoder refusals;
        two code mutations (Chromium); performance;
      - review screenshots (not baselines) into tools/out/mapb/b3d2/, with a labelled diagnostic overlay the test draws over
        the page (never the game).

     node tools/mapb-paddock.mjs
     ENGINES=chromium node tools/mapb-paddock.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, habitatMask, ContentError } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// its review screenshots go to tools/out/mapb/b3d2/; MAPB_SHOTS names another folder under tools/out/ (a later batch's regression run)
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3d2");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], lane = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

/* the approved geometry. B1e's habitat holding-paddock (an outline through six named points, checked against the source below),
   rastered as the B1e lint and the compiler raster it, and its ring (its tiles with any of their 8 neighbours outside): B3a's
   counts, 36 and 35. Written out row by row so a change anywhere shows */
const HP = "holding-paddock", YARD = "raptor-yard";
const OUTLINE = [["holding-paddock-west", 107, 13], ["holding-paddock-north", 112, 10.5], ["holding-paddock-north-east", 117, 11], ["holding-paddock-east", 118, 16], ["holding-paddock-south", 113, 17.5], ["holding-paddock-south-west", 107, 17]];
const rows = (o) => Object.entries(o).flatMap(([y, xs]) => xs.map((x) => [x, +y]));
const span = (a, b) => { const o = []; for (let x = a; x <= b; x++) o.push(x); return o; };
const RING = rows({ 10: span(112, 115), 11: [109, 110, 111, 112, 115, 116], 12: [108, 109, 116, 117], 13: [107, 108, 117], 14: [106, 107, 117], 15: [106, 107, 116, 117], 16: [107, 108, 109, 112, 113, 114, 115, 116], 17: span(109, 112) });
const INNER = rows({ 11: [113, 114], 12: span(110, 115), 13: span(109, 116), 14: span(108, 116), 15: span(108, 115), 16: [110, 111] });
const BOX = { x0: 106, y0: 10, x1: 117, y1: 17 }, ROAM = { x0: 108, y0: 11, x1: 116, y1: 16 }, TREX = [112, 14], PLACE = [112, 19];
// the pieces B3d1's renderer makes of it (the corners where its steps turn, the runs between), and the warning signs on the
// middle of each east-west run
const SIGNS = [[113, 10], [110, 11], [108, 16], [114, 16], [110, 17]];
// the raptor yard, as B3d1 approved it
const YBOX = { x0: 119, y0: 10, x1: 127, y1: 17 };
const inBox = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const YRING = [], YINNER = []; for (let y = YBOX.y0; y <= YBOX.y1; y++) for (let x = YBOX.x0; x <= YBOX.x1; x++) (x === YBOX.x0 || x === YBOX.x1 || y === YBOX.y0 || y === YBOX.y1 ? YRING : YINNER).push([x, y]);
// the lane: column 118, one tile between the two fences at rows 12 to 15; its mouths (rows 10 and 11, 16 and 17) are two tiles wide
const LANE = [[118, 12], [118, 13], [118, 14], [118, 15]], LANE_PX = [118 * T, 118 * T + T - 1];
const key = (l) => (l || []).map((p) => p.join()).sort().join(" ");
const S = (l) => new Set(l.map((p) => p.join()));
const isRing = S(RING), isInner = S(INNER), isYRing = S(YRING), isYInner = S(YINNER);
const pxOf = (b) => ({ px0: b.x0 * T, py0: b.y0 * T, px1: b.x1 * T + T - 1, py1: b.y1 * T + T - 1 });
const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]], N4 = N8.slice(0, 4);
const KEYS = { "0,-1": ["ArrowUp"], "1,0": ["ArrowRight"], "0,1": ["ArrowDown"], "-1,0": ["ArrowLeft"], "1,-1": ["ArrowRight", "ArrowUp"], "1,1": ["ArrowRight", "ArrowDown"], "-1,1": ["ArrowLeft", "ArrowDown"], "-1,-1": ["ArrowLeft", "ArrowUp"] };
// one step out all round (the 8 neighbours of the ring that are neither ring nor inside)
const OUTSIDE = []; for (const [x, y] of RING) for (const [dx, dy] of N8) { const k = `${x + dx},${y + dy}`; if (!isRing.has(k) && !isInner.has(k) && !OUTSIDE.some((q) => q.join() === k)) OUTSIDE.push([x + dx, y + dy]); }
OUTSIDE.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
// pi walked into the fence: from every tile touching it, inside and outside, along every direction (4 straight, 4 diagonal)
// whose next tile is fence
const PUSHES = [];
for (const [from, list] of [["inside", INNER], ["outside", OUTSIDE]]) for (const [x, y] of list) for (const [dx, dy] of N8) if (isRing.has(`${x + dx},${y + dy}`)) PUSHES.push({ from, at: [x, y], d: [dx, dy], hit: [x + dx, y + dy] });

/* ════════ 1. Node: the record and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H), F = RECS.find((r) => r.id === HP), Y = RECS.find((r) => r.id === YARD);
// B3d3 adds the koi garden's wall and the park gate after this batch's record (tools/mapb-koi-gate.mjs tests them)
check("node", "the content holds B3c's three buildings and compound wall, B3d1's raptor-yard fence, B3d2's holding-paddock fence, B3d3's koi garden wall and park gate, B3d4a's tower and lighthouse bases, B3d4b's eleven stations and B3e1's two roam areas (nothing else)", RECS.map((r) => `${r.id}:${r.kind}`).join() === "visitor:building,depot:building,bunker:building,bunker-compound:wall,raptor-yard:fence,holding-paddock:fence,koi-garden:wall,park-gate:gate,tower-base:landmark,lighthouse-base:landmark,sign:station,uplink:station,tower:station,lighthouse:station,macbook:station,tablet:station,mailbox:station,drink:station,shrine:station,cave:station,boat:station,roam-09:roam,roam-10:roam", RECS.map((r) => `${r.id} (${r.kind})`).join(", "));
check("node", "the content passes every rule: 288 solid tiles (184 before B3d2, its 36, then B3d3's 53 + 2 and B3d4a's 9 + 4; B3d4b's stations add none), no foot pixel", contentProblems(RECS, src, m).length === 0 && built.compiled.solidTiles === 288 && built.compiled.footPixels === 0, `${built.compiled.solidTiles} solid tiles, ${built.compiled.footPixels} foot pixels`);
const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
{
  const hab = src.habitats.find((q) => q.id === HP), pts = hab && hab.outline ? hab.outline.points.map((p) => [p.id, p.x, p.y]) : [];
  check("node", "B1e: the habitat holding-paddock is contained, temporary until Ironwood, and its outline is the approved six points (a closed smooth curve, 8 samples a segment): the enclosure from the source, not from a spawn",
    hab && hab.containment === "contained" && hab.planningLabels.some((l) => /until Ironwood/.test(l)) && JSON.stringify(pts) === JSON.stringify(OUTLINE) && hab.outline.samplesPerSegment === 8, hab ? `${hab.containment}; ${pts.map((p) => `${p[0].replace("holding-paddock-", "")} ${p[1]},${p[2]}`).join("; ")}` : "no such habitat");
  const mask = habitatMask(src, HP, W, H), mt = []; for (let i = 0; i < W * H; i++) if (mask[i]) mt.push([i % W, (i / W) | 0]);
  check("node", "B1e: rastered (tile centres inside the outline), the habitat is 71 tiles, exactly the ring and the inside here (B3a's 'outline, 71 tiles')", mt.length === 71 && key(mt) === key(RING.concat(INNER)), `${mt.length} tiles`);
  check("node", "fence: the record holding-paddock is a fence round that habitat (ringOfHabitat), with placeholder art, closing it in (encloses), no openings, no door, reserve, room, compound or foot box",
    F && F.kind === "fence" && F.art === "placeholder" && F.encloses === true && !F.gapTiles && !F.doorTiles.length && !F.reserve && !F.room && !F.compound && !F.footPxBoxes.length && REAL.records.find((r) => r.id === HP).solid.ringOfHabitat.habitat === HP && !REAL.records.find((r) => r.id === HP).solid.ringOfHabitat.gapTiles,
    F ? JSON.stringify({ kind: F.kind, art: F.art, encloses: F.encloses, gaps: F.gapTiles || [], doors: F.doorTiles.length }) : "no record");
  check("node", "fence: its solid is the habitat's ring, 36 tiles (B3a's count), row by row as written here, within the box 106,10 to 117,17; its drawn boxes are those 36 tiles exactly, one each (art on every solid tile, none over open ground)",
    F && key(F.tiles) === key(RING) && RING.length === 36 && RING.every(([x, y]) => inBox(x, y, BOX)) && [BOX.x0, BOX.x1].every((x) => RING.some((p) => p[0] === x)) && [BOX.y0, BOX.y1].every((y) => RING.some((p) => p[1] === y)) && F.drawnPxBoxes.length === 36 && key(F.drawnPxBoxes.map((b) => [b.px0, b.py0, b.px1, b.py1])) === key(RING.map(([x, y]) => [x * T, y * T, x * T + T - 1, y * T + T - 1])),
    F ? `${F.tiles.length} tiles, ${F.drawnPxBoxes.length} boxes` : "");
  check("node", "fence: its inside is 35 tiles (B3a's count), row by row as written here, all within B3a's T. rex roam box (roam-02, 108,11 to 116,16, touching each of its edges) and holding B3a's T. rex spawn 112,14",
    F && key(F.inner) === key(INNER) && INNER.length === 35 && INNER.every(([x, y]) => inBox(x, y, ROAM)) && [ROAM.x0, ROAM.x1].every((x) => INNER.some((p) => p[0] === x)) && [ROAM.y0, ROAM.y1].every((y) => INNER.some((p) => p[1] === y)) && isInner.has(TREX.join()), F ? `${F.inner.length} inside` : "");
  const yard = REAL.records.find((r) => r.id === YARD);
  check("node", "B3d1's raptor yard as approved: the same record (ringOfHabitat raptor-yard, placeholder art, encloses, no openings), its 30 tiles the box 119,10 to 127,17's ring, its 42 inside",
    yard && JSON.stringify(yard) === JSON.stringify({ id: YARD, kind: "fence", art: "placeholder", encloses: true, solid: { ringOfHabitat: { habitat: YARD } } }) && Y && key(Y.tiles) === key(YRING) && key(Y.inner) === key(YINNER) && YRING.length === 30 && YINNER.length === 42 && Y.drawnPxBoxes.length === 30, Y ? `${Y.tiles.length} tiles, ${Y.inner.length} inside` : "no record");
}
{ // format 1, for the comparison (js/maps/home.js): its t-rex paddock is a closed box ring on land, its roam box the inside
  const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); const F1 = c.window.ISLAND_MAPS.home;
  const pen = F1.regions.paddocks.find((p) => p[0] === "t-rex paddock"), rex = F1.spawns.filter((s) => s.kind === "trex"), roam = rex.length && F1.regions.roamAreas.find((r) => r.id === rex[0].roam);
  check("node", "format 1: the t-rex paddock (27,43 to 39,54: a 46-tile ring, 110 inside) has no gate (a paddock is a box and a name); its one T. rex roams roam-02, exactly its inside, and starts inside it; its roar zone wraps it",
    pen && pen.slice(1).join() === "27,43,39,54" && rex.length === 1 && roam && roam.id === "roam-02" && roam.box.join() === "28,44,38,53" && rex[0].at.join() === "33,48" && JSON.stringify(F1.regions.zones["trex-roar"]) === "[25,41.5,42,56]",
    `${JSON.stringify(pen)}, ${roam && roam.id} ${roam && roam.box}, the T. rex at ${rex.map((s) => s.at)}`);
}
{ // the ground under it and inside it
  const bad = RING.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.ground[y * W + x] !== 3 || m.height[y * W + x] !== 2 || foot(x, y) || m.pathClass[y * W + x] >= 0);
  const badIn = INNER.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.ground[y * W + x] !== 3 || m.height[y * W + x] !== 2 || foot(x, y) || m.pathClass[y * W + x] >= 0);
  check("node", "fence: every fence tile is open grass on the level-2 highland (no terrain flag, no path, no bridge, dock or pad), with no foot-blocking pixel; so is every tile inside", bad.length === 0 && badIn.length === 0, `${bad.length} fence tiles, ${badIn.length} inside tiles not open grass`);
  const joins = F.tiles.map(([x, y]) => N4.filter(([dx, dy]) => isRing.has(`${x + dx},${y + dy}`)).length);
  const seen = new Set([F.tiles[0].join()]), q = [F.tiles[0]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of N4) { const k = `${x + dx},${y + dy}`; if (isRing.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); } } }
  // its pieces as B3d1's renderer names them: a corner where a north-south and an east-west neighbour meet, else a run
  const pieces = RING.map(([x, y]) => { const n = isRing.has(`${x},${y - 1}`), s = isRing.has(`${x},${y + 1}`), e = isRing.has(`${x + 1},${y}`), w = isRing.has(`${x - 1},${y}`); return (n || s) && (e || w) ? "corner" : "run"; });
  // closed even to a diagonal step: from the inside, stepping to any of the 8 neighbours, nothing outside is reached
  const dseen = new Set([INNER[0].join()]), dq = [INNER[0]], leak = [];
  while (dq.length) { const [x, y] = dq.pop(); for (const [dx, dy] of N8) { const k = `${x + dx},${y + dy}`; if (isRing.has(k) || dseen.has(k)) continue; if (!isInner.has(k)) { leak.push(k); continue; } dseen.add(k); dq.push([x + dx, y + dy]); } }
  const three = F.tiles.filter((p, i) => joins[i] === 3).map((p) => p.join());
  check("node", "fence: closed and joined: one 4-connected line of 36 tiles, every tile joined to two others along it, but for the west tip, where the outline's raster puts a 2 x 2 block of fence (106 to 107, 14 to 15: 107,14 and 107,15 join three); even stepping diagonally the inside reaches nothing outside; 24 corners (each step turns twice) and 12 runs",
    seen.size === 36 && joins.every((n) => n >= 2 && n <= 3) && three.join(" ") === "107,14 107,15" && ["106,14", "107,14", "106,15", "107,15"].every((k) => isRing.has(k)) && dseen.size === 35 && leak.length === 0 && pieces.filter((k) => k === "corner").length === 24 && pieces.filter((k) => k === "run").length === 12,
    `joins ${[...new Set(joins)].join("/")} (three at ${three.join(" ") || "none"}), ${seen.size} in one line, inside ${dseen.size} reached diagonally with ${leak.length} leaks, ${pieces.filter((k) => k === "corner").length} corners`);
}
const bfs = (from, block) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of N4) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
const SPAWN = m.anchors.spawnTile, before = bfs(SPAWN, (i) => m.coll[i] !== 0), after = bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1);
{
  const lost = []; for (let i = 0; i < W * H; i++) if (before[i] >= 0 && after[i] < 0 && !LAYER.tiles[i]) lost.push([i % W, (i / W) | 0]);
  check("node", "both insides are closed in on purpose, and they are all that is: on the terrain alone the spawn reached all 35 + 42; with the content it reaches none of them, and every other tile it reached it still does",
    INNER.every(([x, y]) => before[y * W + x] >= 0 && after[y * W + x] < 0) && key(lost) === key(INNER.concat(YINNER)), `${lost.length} cut off, ${lost.filter(([x, y]) => !isInner.has(`${x},${y}`) && !isYInner.has(`${x},${y}`)).length} of them anything else`);
  // the outside: one step out all round, walkable, reached, joined up into a loop (pi can walk all the way round)
  const isO = S(OUTSIDE), oseen = new Set([OUTSIDE[0].join()]), q = [OUTSIDE[0]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of N4) { const k = `${x + dx},${y + dy}`; if (isO.has(k) && !oseen.has(k)) { oseen.add(k); q.push([x + dx, y + dy]); } } }
  const obad = OUTSIDE.filter(([x, y]) => m.coll[y * W + x] !== 0 || LAYER.tiles[y * W + x] || after[y * W + x] < 0), ofoot = OUTSIDE.filter(([x, y]) => foot(x, y)).map(([x, y]) => `${x},${y} (${foot(x, y)} px)`);
  check("node", "outside: the 44 tiles one step out all round are open ground, reached from the spawn, no content on any, and join up into one loop round the paddock (the only foot-blocking pixels among them are the coast's 6 on 108,10)",
    OUTSIDE.length === 44 && obad.length === 0 && oseen.size === 44 && ofoot.join() === "108,10 (6 px)", obad.length ? obad.slice(0, 6).join(" ") : `${OUTSIDE.length} tiles, ${oseen.size} in one loop; foot pixels on ${ofoot.join(", ") || "none"}`);
  // the lane: column 118 between the two fences
  const laneT = []; for (let y = 9; y <= 18; y++) laneT.push([118, y]);
  const one = LANE.every(([x, y]) => isRing.has(`${x - 1},${y}`) && isYRing.has(`${x + 1},${y}`)), mouths = [[117, 10], [118, 10], [117, 11], [118, 11], [117, 16], [118, 16], [117, 17], [118, 17]].every(([x, y]) => !LAYER.tiles[y * W + x] && after[y * W + x] >= 0);
  check("node", "the lane: column 118 is open and reached from row 9 to row 18, with no path, no content and no foot-blocking pixel; one tile wide at rows 12 to 15 (the paddock's fence at x 117, the yard's at x 119), two wide at its mouths (117 to 118 at rows 10, 11, 16 and 17)",
    laneT.every(([x, y]) => m.coll[y * W + x] === 0 && !LAYER.tiles[y * W + x] && after[y * W + x] >= 0 && !foot(x, y) && (y >= 18 || m.pathClass[y * W + x] < 0)) && one && mouths && !isRing.has("117,11") && !isRing.has("117,16"), `one tile wide at rows 12 to 15: ${one}; mouths open: ${mouths}`);
  // roads, trails and route ends
  const trails = ["paddock-fence-walk", "raptor-yard-walk", "research-station-door"].map((id) => { const k = src.corridors.paths.findIndex((p) => p.id === id); const tiles = []; for (let i = 0; i < W * H; i++) if (m.pathOf[i] === k) tiles.push([i % W, (i / W) | 0]); return { id, n: tiles.length, bad: tiles.filter(([x, y]) => after[y * W + x] < 0 || LAYER.tiles[y * W + x]) }; });
  const ends = (src.corridors.routeEnds || []).filter((e) => after[e.endTile[1] * W + e.endTile[0]] < 0);
  check("node", "roads: no fence tile is a path; the paddock fence walk (a trail along the south fence, rows 18 and 19, from 106,26 to 118,19), the raptor yard walk and the research station's are open and reached, every tile; all 17 route ends still reached",
    RING.every(([x, y]) => m.pathClass[y * W + x] < 0) && trails.every((q2) => q2.n > 0 && !q2.bad.length) && ends.length === 0 && (src.corridors.routeEnds || []).length === 17,
    trails.map((q2) => `${q2.id} ${q2.n} tiles${q2.bad.length ? " (" + q2.bad.length + " blocked)" : ""}`).join("; ") + `; route ends cut off: ${ends.map((e) => e.id).join(", ") || "none"}`);
  check("node", "B3a's viewing place for the T. rex, 112,19 (the goto place 'paddock', on the fence walk two rows below the south fence, as format 1's 41,51 is beside its paddock), is open ground reached from the spawn",
    m.coll[PLACE[1] * W + PLACE[0]] === 0 && !LAYER.tiles[PLACE[1] * W + PLACE[0]] && after[PLACE[1] * W + PLACE[0]] >= 0 && m.pathClass[PLACE[1] * W + PLACE[0]] >= 0, `${after[PLACE[1] * W + PLACE[0]]} steps from the spawn`);
  // the relief round it
  let lv = 99, wet = 99;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = `${x},${y}`; if (isRing.has(k) || isInner.has(k)) continue; let d = 99; for (const [rx, ry] of RING) d = Math.min(d, Math.max(Math.abs(rx - x), Math.abs(ry - y))); const i = y * W + x; if (m.coll[i] & 6) wet = Math.min(wet, d); else if (m.land[i] && m.height[i] !== 2) lv = Math.min(lv, d); }
  check("node", "relief: the paddock and its surroundings are one level (2, the highland): the nearest other level is well away (no cliff beside it); the sea is 2 tiles off its north-west side (the coast round it)", lv >= 10 && wet === 2, `nearest other level ${lv} tiles out, nearest water ${wet}`);
  perf.push(`node: the paddock's ground: the nearest other level is ${lv} tiles from its fence, the nearest water ${wet}; the spawn to the viewing place ${after[PLACE[1] * W + PLACE[0]]} steps`);
}
// malformed holding-paddock records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const FR = (o) => o.records.find((r) => r.id === HP);
const FBAD = [
  ["the paddock's fence with no art", "fences", (o) => { delete FR(o).art; }],
  ["the paddock's fence round its box, not its outline", "fences", (o) => { FR(o).solid = { ringOfBox: { ...BOX } }; }],
  ["the paddock's fence named for the raptor yard too (two fences one id)", "schema", (o) => { FR(o).id = YARD; }],
  ["the paddock's fence named for something else than its habitat", "fences", (o) => { FR(o).id = "trex-paddock"; }],
  ["a second fence round the paddock's habitat", "schema", (o) => { o.records.push(copy(FR(o))); }],
  ["no openings and no encloses", "fences", (o) => { delete FR(o).encloses; }],
  ["an opening at one of its steps (a corner, 112,10)", "fences", (o) => { delete FR(o).encloses; FR(o).solid.ringOfHabitat.gapTiles = [[112, 10]]; }],
  ["an opening that isn't on its ring (the inside, 112,14)", "schema", (o) => { FR(o).solid.ringOfHabitat.gapTiles = [[112, 14]]; }],
  ["an opening and encloses", "fences", (o) => { FR(o).solid.ringOfHabitat.gapTiles = [[114, 16]]; }],
  ["a door into it", "fences", (o) => { FR(o).doorTiles = [[112, 18]]; }],
  ["no encloses and nothing else said (the inside cut off unsaid)", "pockets", (o) => { delete FR(o).encloses; }]
];
for (const [label, rule, fn] of FBAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => q[0]) : []; }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed: ${label} is caught by rule ${rule}`, caught.includes(rule), caught.join(", ") || "NOT caught");
}
{ // an opening in a straight run (the middle of its south-east run, 114,16), encloses left out: allowed by the format (the paddock has none)
  let p = null; try { p = contentProblems(resolveContent(realWith((o) => { delete FR(o).encloses; FR(o).solid.ringOfHabitat.gapTiles = [[114, 16]]; }), src, m), src, m); } catch (e) { p = [[e.rule, e.message]]; }
  check("node", "an opening in a straight run of the paddock's (114,16), encloses left out: passes every rule (the inside is then reached through it; the paddock has none)", p && p.length === 0, p && p.length ? p.map((q) => q.join(": ")).join("; ") : "");
}
// the fence tiles that touch the inside (all but the west tip's outer two, 106,14 and 106,15, which stand behind 107,14 and 107,15)
const FACING = RING.filter(([x, y]) => N8.some(([dx, dy]) => isInner.has(`${x + dx},${y + dy}`)));
check("node", "B3d2's own test geometry: 44 tiles one step out; every one of the 36 fence tiles is walked into from outside, and every one of the 34 touching the inside (all but 106,14 and 106,15, behind the west tip's inner two) from inside",
  OUTSIDE.length === 44 && FACING.length === 34 && key(RING.filter((p) => !FACING.includes(p))) === "106,14 106,15" && RING.every(([x, y]) => PUSHES.some((p) => p.from === "outside" && p.hit.join() === `${x},${y}`)) && FACING.every(([x, y]) => PUSHES.some((p) => p.from === "inside" && p.hit.join() === `${x},${y}`)),
  `${PUSHES.filter((p) => p.from === "inside").length} pushes from inside, ${PUSHES.filter((p) => p.from === "outside").length} from outside`);

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const REAL_DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(REAL_DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const dropTile = (r, x, y) => { r.tiles = r.tiles.filter((p) => !(p[0] === x && p[1] === y)); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === x * T && b.py0 === y * T)); };
const REFUSE = [
  ["a paddock fence tile with no art over it (112,17)", (c) => { const r = DR(c, HP); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === 112 * T && b.py0 === 17 * T)); }, /no invisible collision/],
  ["paddock fence art on a tile it doesn't block (the lane, 118,13)", (c) => { DR(c, HP).drawnPxBoxes.push(pxOf({ x0: 118, y0: 13, x1: 118, y1: 13 })); }, /its placeholder art is one tile on each of its solid tiles and nowhere else/],
  ["a hole at one of its steps that isn't an opening (116,15)", (c) => { dropTile(DR(c, HP), 116, 15); c.solidTiles--; }, /don't close round: 11[67],1[56] joins 1 \(a hole in it isn't one of its openings\)/],
  ["the closed paddock fence not saying it encloses", (c) => { delete DR(c, HP).encloses; }, /^content record holding-paddock is a fence with no openings, so it closes its ground in: it must say so \(encloses\)$/],
  ["a foot box on the paddock fence", (c) => { const r = DR(c, HP); r.footPxBoxes.push({ px0: 112 * T + 2, py0: 17 * T + 2, px1: 112 * T + 5, py1: 17 * T + 5 }); c.footPixels += 16; }, /is a fence with foot boxes/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  fencesUndrawn: ["the fences left out of the scene (their collision with no art)", (s) => s.replace("if (FENCEAT && fx >= 0", "if (false && FENCEAT && fx >= 0")],
  fenceOpen: ["the fences' tiles left out of the content collision (art with no collision)", (s) => s.replace("owner[i] = r.id; cc[i] = C_SOLID; nT++;", "owner[i] = r.id; if (r.kind !== \"fence\") cc[i] = C_SOLID; nT++;")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlay and its legend are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3d2-(overlay|legend)/.test(WORLD));

const port = 9600 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11#island";
const onFence = (seen) => seen.filter(([x, y]) => LAYER.tiles[y * W + x]);
const inside = ([x, y]) => isInner.has(`${x},${y}`) || isYInner.has(`${x},${y}`);
const fenced = ([x, y]) => isRing.has(`${x},${y}`) || isYRing.has(`${x},${y}`);

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
    for (; n < 6000; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
    const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], px: [p.x, p.y], seen, frames: n, stalls: p.stalls - s0 };
  }, [from, to, loose]);
  const tilePx = (p) => [p[0] * T + 8, p[1] * T + 10];
  // held keys on the update loop: pi put at a spot (the tile's middle, or the nearest spot in it where its feet are clear), the keys
  // held for n frames; every tile it stands on, and any frame its feet touch a solid pixel
  const hold = async (P, keys, at, n = 150, exact = false) => {
    const start = await P.I(([x, y, ex]) => { const I2 = window.__island, clear = (a, b) => [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(a + dx, b + dy));
      let s = [x, y]; if (!ex && !clear(x, y)) { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); let best = null; for (let b = ty * 16 + 2; b < ty * 16 + 15; b++) for (let a = tx * 16 + 4; a < tx * 16 + 12; a++) if (clear(a, b) && (!best || Math.hypot(a - x, b - y) < Math.hypot(best[0] - x, best[1] - y))) best = [a, b]; s = best; }
      if (!s) return null; I2.teleport(s[0], s[1]); I2.step(1); return s; }, [at[0], at[1], exact]);
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

  // 2a. the terrain preview and production: no fence
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => window.__island.preview()) : null;
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;
  check(name, "terrain preview: no content, no fence; both locked painter digests", tp.loaded && !tp.errs.length && tv.previewMode === "terrain" && tv.content === null && tv.fences.length === 0 && tDig.td === TERRAIN_SHA && tDig.gd === GROUND_SHA,
    tv ? `fences ${tv.fences.length}, terrain ${tDig.td.slice(0, 12)}, ground ${tDig.gd.slice(0, 12)}` : tp.errs.join("; "));
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`); const v = P.loaded ? await P.I(() => window.__island.preview()) : null;
    check(name, "production: format 1, 100 x 80, no preview, no content, no MAP-B fence (format 1's own t-rex paddock fence draws as before; map-parity checks it)", P.loaded && !P.errs.length && v.format === 1 && v.w === 100 && v.h === 80 && v.previewMode === null && v.content === null && v.fences.length === 0 && v.walls.length === 0 && !v.saveLocked,
      v ? `format ${v.format}, ${v.w} x ${v.h}, fences ${v.fences.length}` : P.errs.join("; ")); await P.ctx.close(); }

  // 2b. the content preview with both fences
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const sortK = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k2) => [k2, o[k2]]));
  const fv = cv && cv.fences.find((f) => f.id === HP), yv = cv && cv.fences.find((f) => f.id === YARD);
  check(name, "content preview: loads with the 23 records (288 solid tiles, B3d3's, B3d4a's and B3d4b's among them); the paddock's fence as its record says: 36 tiles, no openings, closing its ground in, 24 corners and 12 runs, a warning sign on the middle of each of its five east-west runs",
    cp.loaded && !cp.errs.length && cv.content.records === 23 && cv.content.solidTiles === 288 && cv.sys.buildings === true && cv.fences.length === 2 && fv && fv.tiles === 36 && fv.encloses === true && !fv.gaps.length && sortK(fv.kinds) === sortK({ corner: 24, run: 12 }) && key(fv.signs) === key(SIGNS),
    cv ? JSON.stringify(fv) : cp.errs.join("; "));
  check(name, "content preview: B3d1's raptor yard exactly as approved (30 tiles, 4 corners and 26 runs, signs at 123,10 and 123,17, closing its ground in), and B3c's buildings and compound wall as they were (B3d3's koi garden wall beside it)",
    yv && yv.tiles === 30 && yv.encloses === true && !yv.gaps.length && sortK(yv.kinds) === sortK({ corner: 4, run: 26 }) && key(yv.signs) === "123,10 123,17" && cv.buildings.map((b) => b.id).join() === "visitor,depot,bunker" && cv.walls.map((q) => q.id).join() === "bunker-compound,koi-garden" && cv.walls[0].tiles === 53,
    yv ? JSON.stringify(yv) : "");
  if (cp.loaded) {
    await cp.I(() => { const I2 = window.__island; I2.teleport(112 * 16 + 8, 19 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, both fences drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview (the fences are drawn in the object layer, never the ground)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the compiler's (288 tiles, the paddock's 36 among them), kept apart from the terrain's (the compiler's, untouched); gameplay is their union", lay && LAYER.tiles.reduce((a, v) => a + v, 0) === 288 && RING.every(([x, y]) => L.k[y * W + x] !== 0));
    // the art: one opaque tile per fence tile
    const art = await cp.I((id) => { const a = window.__island.fenceArt(id); delete a.png; return a; }, HP);
    const pieceAt = (x, y) => art.pieces.find((q) => q.tile[0] === x && q.tile[1] === y) || {};
    check(name, "art: one piece on each of the 36 fence tiles, each 16 x 16 with all 256 pixels fully opaque, from the raptor yard's renderer and style; the signs where its runs put them",
      art.pieces.length === 36 && art.pieces.every((q) => q.w === T && q.h === T && q.opaque === 256) && RING.every(([x, y]) => pieceAt(x, y).kind) && SIGNS.every(([x, y]) => pieceAt(x, y).mark === "sign") && art.pieces.filter((q) => q.mark === "sign").length === 5,
      `${art.pieces.length} pieces, ${art.pieces.filter((q) => q.opaque === 256).length} fully opaque, ${new Set(art.pieces.map((q) => q.sig.split(":").slice(1).join(":"))).size} kinds of piece`);
    // collision, pixel by pixel
    const pc = await cp.I(([ring, inner, outside, laneT]) => {
      const I2 = window.__island, isR = new Set(ring.map((p) => p.join()));
      let n = 0, open = 0, under = 0, rim = 0, rimBad = 0, inBlocked = 0;
      for (const [x, y] of ring) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) { n++; if (!I2.blocked(px, py)) open++; if (I2.terrainBlocked(px, py)) under++; }
      for (const [x, y] of inner) for (let py = y * 16; py < y * 16 + 16; py += 3) for (let px = x * 16; px < x * 16 + 16; px += 3) if (I2.blocked(px, py)) inBlocked++;
      for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (isR.has(nx + "," + ny)) continue;
        for (let k = 0; k < 16; k++) { const px = dx ? (dx > 0 ? nx * 16 : nx * 16 + 15) : x * 16 + k, py = dy ? (dy > 0 ? ny * 16 : ny * 16 + 15) : y * 16 + k; rim++; if (I2.blocked(px, py) !== I2.terrainBlocked(px, py)) rimBad++; }
      }
      const tiles = { fence: ring.filter(([x, y]) => { const q = I2.tile(x, y); return q.walkable || !q.content || I2.safe(x, y); }).length, inner: inner.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || I2.safe(x, y); }).length,
        outside: outside.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || !I2.safe(x, y); }).length, lane: laneT.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || !I2.safe(x, y); }).length };
      return { n, open, under, rim, rimBad, inBlocked, tiles };
    }, [RING, INNER, OUTSIDE, [[118, 9], [118, 10], [118, 11], ...LANE, [118, 16], [118, 17], [118, 18]]]);
    check(name, `collision: all ${pc.n} pixels of the 36 fence tiles block feet (none would on the terrain alone); the ${pc.rim} pixels touching it from outside and inside answer exactly as the terrain does; no pixel inside it is blocked (open ground, closed in)`,
      pc.n === 36 * 256 && pc.open === 0 && pc.under === 0 && pc.rimBad === 0 && pc.inBlocked === 0, JSON.stringify({ open: pc.open, under: pc.under, rimBad: pc.rimBad, inBlocked: pc.inBlocked }));
    check(name, "tiles: the fence's are content, not walkable, not safe ground; the 35 inside are walkable ground with no content, and not safe (closed in: no landing, no restored position); the 44 round the outside and the lane's 10 (118,9 to 118,18) are safe ground",
      pc.tiles.fence === 0 && pc.tiles.inner === 0 && pc.tiles.outside === 0 && pc.tiles.lane === 0, JSON.stringify(pc.tiles));

    // containment: pi walked into the fence on the real update loop from every tile touching it, inside and outside, every direction
    // that meets it; never through, feet never on a solid pixel; a straight push stops flush (feet within 3 px of the fence)
    const res = [];
    for (const p of PUSHES) {
      const r = await hold(cp, KEYS[p.d.join()], tilePx(p.at), 120);
      if (!r) { res.push({ p, bad: 1, crossed: ["no clear start"], gap: null }); continue; }
      const crossed = r.tiles.filter((q) => p.from === "inside" ? !isInner.has(q.join()) : (fenced(q) || inside(q)));
      let gap = null;
      if (!p.d[0] || !p.d[1]) {
        const [hx, hy] = p.hit;
        gap = p.d[1] > 0 ? hy * T - (r.y + 1) : p.d[1] < 0 ? (r.y - 2) - (hy * T + T - 1) : p.d[0] > 0 ? hx * T - (r.x + 4) : (r.x - 4) - (hx * T + T - 1);
      }
      res.push({ p, bad: r.bad, crossed: crossed.map((q) => q.join()), gap, end: [Math.floor(r.x / T), Math.floor(r.y / T)] });
    }
    for (const from of ["inside", "outside"]) {
      const mine = res.filter((q) => q.p.from === from), straight = mine.filter((q) => q.gap !== null), diag = mine.filter((q) => q.gap === null);
      const badS = straight.filter((q) => q.bad || q.crossed.length || !(q.gap > 0 && q.gap <= 3)), badD = diag.filter((q) => q.bad || q.crossed.length);
      const corners = RING.filter(([x, y]) => { const n = isRing.has(`${x},${y - 1}`), s = isRing.has(`${x},${y + 1}`), e = isRing.has(`${x + 1},${y}`), w = isRing.has(`${x - 1},${y}`); return (n || s) && (e || w); });
      const hitCorners = corners.filter(([x, y]) => mine.some((q) => q.p.hit.join() === `${x},${y}`)), want = from === "inside" ? corners.filter((c) => FACING.includes(c)).length : corners.length;
      check(name, `containment from ${from}: pi walked straight into the fence from every tile ${from} it (${straight.length} pushes) stops flush against it (feet within 3 px), never on a solid pixel, never across`, badS.length === 0,
        badS.length ? badS.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: gap ${q.gap === null ? "-" : q.gap.toFixed(2)}${q.bad ? ", feet on solid " + q.bad : ""}${q.crossed.length ? ", CROSSED " + q.crossed.join(" ") : ""}`).join("; ") : `gaps ${Math.min(...straight.map((q) => q.gap)).toFixed(2)} to ${Math.max(...straight.map((q) => q.gap)).toFixed(2)} px`);
      check(name, `containment from ${from}: pi walked diagonally into the fence from every tile ${from} it (${diag.length} pushes, into ${hitCorners.length} of its ${corners.length} corners, all that face the ${from}, and along every step) slides or stops: never through a corner, feet never on a solid pixel, every tile on the way ${from}`,
        badD.length === 0 && hitCorners.length === want && want === (from === "inside" ? 22 : 24), badD.length ? badD.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: ended ${q.end}${q.bad ? ", feet on solid " + q.bad : ""}${q.crossed.length ? ", CROSSED " + q.crossed.join(" ") : ""}`).join("; ") : `${diag.length} pushes, none through`);
    }

    // the planner: round it, along it, never into it
    { const r = await walk(cp, tilePx([105, 14]), [118, 14]);
      check(name, "planner: from the west side (105,14) to the lane on the east side (118,14), pi goes round the paddock on the update loop, never on a fence or inside either paddock", r.plan !== null && r.at.join() === "118,14" && !onFence(r.seen).length && !r.seen.some(inside) && r.plan > 13,
        r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight would be 13), ${r.seen.length} tiles walked, ${r.stalls} stalls`); }
    for (const [side, a, b] of [["north", [111, 9], [116, 9]], ["north-west", [105, 13], [108, 11]], ["west", [105, 13], [105, 16]], ["south", [108, 18], [113, 18]], ["south-east", [113, 17], [117, 17]], ["east (the lane)", [118, 11], [118, 16]]]) {
      const r = await walk(cp, tilePx(a), b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      check(name, `outside: pi walks the ${side} side outside the fence (${a} to ${b}) on the update loop, beside it all the way, never on it`, r.plan !== null && r.at.join() === b.join() && !onFence(r.seen).length && !r.seen.some(inside) && r.plan <= straight + 3 && r.stalls === 0,
        r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight ${straight}), ended ${r.at}, ${r.stalls} stalls`);
    }
    for (const loose of [false, true]) {
      const r = await walk(cp, tilePx(PLACE), TREX, loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} from the viewing place to the T. rex's spot in the middle (112,14) never gets in: no plan, or one that ends outside, never on the fence`, r.plan === null || (!onFence(r.seen).length && !r.seen.some(inside) && !inside(r.at)),
        r.plan === null ? "no path planned" : `ended ${r.at}`);
      const f = await walk(cp, tilePx(PLACE), [112, 17], loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} to a fence tile (112,17) from outside ends on open ground beside it, never on the fence`, f.plan === null ? false : !onFence(f.seen).length && !inside(f.at) && Math.abs(f.at[0] - 112) + Math.abs(f.at[1] - 17) <= 2, f.plan === null ? "no path" : `ended ${f.at}`);
    }
    { await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(1); }, SPAWN);
      const r = await walk(cp, null, PLACE);
      check(name, "planner: from the spawn to B3a's viewing place below the south fence (112,19), pi walks there on the update loop, never on content", r.plan !== null && r.at.join() === PLACE.join() && !onFence(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan, ended ${r.at}`); }
    // trapped ground: from every walkable tile in and within 3 of the paddock, a path to the spawn from every one outside both paddocks and from
    // none inside them (closed in on purpose); on the terrain preview, the paddock's inside had one
    const trapScan = (P) => P.I(([b2, inner, yinner]) => {
      const I2 = window.__island, cut = [], isI = new Set(inner.map((p) => p.join())), isY = new Set(yinner.map((p) => p.join())); let n = 0, inReached = 0, inClosed = 0;
      for (let y = b2.y0 - 3; y <= b2.y1 + 3; y++) for (let x = b2.x0 - 3; x <= b2.x1 + 3; x++) {
        if (!I2.tile(x, y).walkable) continue; n++;
        I2.teleport(x * 16 + 8, y * 16 + 10); const ok = I2.walkTo(79, 79, false) !== null;
        if (isI.has(x + "," + y)) { if (ok) inReached++; else inClosed++; } else if (!isY.has(x + "," + y) && !ok) cut.push(x + "," + y);
      }
      return { n, cut, inReached, inClosed };
    }, [BOX, INNER, YINNER]);
    const ct = await trapScan(cp), tt = tp.loaded ? await trapScan(tp) : null;
    check(name, `trapped ground: from all ${ct.n} walkable tiles in and within 3 of the paddock, pi has a path to the spawn from every one outside both paddocks and from none of the 35 inside (on the terrain preview, before the fence, from all ${tt ? tt.n : "?"}, the inside too)`,
      ct.n > 150 && ct.cut.length === 0 && ct.inClosed === 35 && ct.inReached === 0 && tt && tt.cut.length === 0 && tt.inReached === 35 && tt.inClosed === 0,
      `content: outside cut off ${ct.cut.length ? ct.cut.slice(0, 6).join(" ") : "none"}, inside ${ct.inClosed} closed in / ${ct.inReached} reaching the spawn; terrain preview: outside cut off ${tt ? tt.cut.length : "-"}, inside ${tt ? tt.inReached : "-"} reaching the spawn`);

    // the lane (column 118, rows 12 to 15). Keyboard: pi going straight in from each end, at every whole pixel across the two-tile
    // mouth (117 and 118): where it gets through, where it stops at the fence's end, never a foot on solid, never on a fence
    const scan = [];
    for (const [dir, row, k] of [["south from row 10", 10, "ArrowDown"], ["north from row 17", 17, "ArrowUp"]]) {
      const through = [], stopped = []; let bad = 0, onF = 0;
      for (let x = 117 * T + 4; x <= 119 * T - 5; x++) {
        const r = await hold(cp, [k], [x, row * T + 10], 120, true);
        bad += r.bad; onF += r.tiles.filter(fenced).length;
        const yEnd = Math.floor(r.y / T); if (k === "ArrowDown" ? yEnd >= 16 : yEnd <= 11) through.push(x); else stopped.push([x, yEnd]);
      }
      scan.push({ dir, through, stopped, bad, onF });
    }
    const win = (s) => s.through.length ? `${s.through[0]} to ${s.through[s.through.length - 1]}` : "none";
    check(name, "the lane, keyboard: going straight in from either end, pi gets through when its middle is within the lane's 8 px window (x 1892 to 1899: its 9 px feet inside the 16 px lane); from anywhere else across the 24 px mouth it stops at the end of the fence (row 11 or 16), never a foot on solid, never on a fence",
      scan.every((s) => s.through.length === 8 && s.through[0] === 1892 && s.through[7] === 1899 && s.bad === 0 && s.onF === 0 && s.stopped.every(([, y]) => y === (s.dir.startsWith("south") ? 11 : 16))),
      scan.map((s) => `${s.dir}: through at ${win(s)} (${s.through.length} of ${s.through.length + s.stopped.length} px), stopped at rows ${[...new Set(s.stopped.map((q) => q[1]))].join(",")}`).join("; "));
    lane.push(`${name}: keyboard straight in: ${scan.map((s) => `${s.dir} through at x ${win(s)} (${s.through.length} of ${s.through.length + s.stopped.length} px across the mouth)`).join("; ")}`);
    // diagonals: toward the yard's straight west fence, pi slides along it into the lane and through; toward the paddock it stops at the step
    const DIAG = [["down and right from 117,10", ["ArrowDown", "ArrowRight"], [117, 10], true], ["down and right from 114,9", ["ArrowDown", "ArrowRight"], [114, 9], true], ["up and right from 117,17", ["ArrowUp", "ArrowRight"], [117, 17], true], ["up and right from 114,17", ["ArrowUp", "ArrowRight"], [114, 17], true],
      ["down and left from 118,10", ["ArrowDown", "ArrowLeft"], [118, 10], false], ["up and left from 118,17", ["ArrowUp", "ArrowLeft"], [118, 17], false]];
    const dr = [];
    for (const [lab, keys, at, through] of DIAG) {
      const r = await hold(cp, keys, tilePx(at), 240), went = r.tiles.some((q) => q.join() === "118,12") && r.tiles.some((q) => q.join() === "118,15");
      dr.push({ lab, through, went, bad: r.bad, onF: r.tiles.filter(fenced).length, inI: r.tiles.filter(inside).length, end: [Math.floor(r.x / T), Math.floor(r.y / T)] });
    }
    check(name, "the lane, diagonals: held toward the yard's straight west fence (down and right, up and right), pi slides along it into the lane and through, from beside the mouth and from 4 tiles off; held toward the paddock (down and left, up and left) it stops at the paddock's step; never a foot on solid, never on a fence or inside",
      dr.every((q) => q.went === q.through && q.bad === 0 && q.onF === 0 && q.inI === 0), dr.map((q) => `${q.lab}: ${q.went ? "through" : "not through"}, ended ${q.end}`).join("; "));
    lane.push(`${name}: diagonals: ${dr.map((q) => `${q.lab} ${q.went ? "through" : "stops at " + q.end}`).join("; ")}`);
    // in the lane: pushed at each side, and its clearance (pi's feet are 9 px wide in a 16 px lane)
    const side = [];
    for (const [lab, keys] of [["left", ["ArrowLeft"]], ["right", ["ArrowRight"]]]) for (const row of [12, 13, 14, 15]) { const r = await hold(cp, keys, tilePx([118, row]), 90); side.push({ lab, row, x: r.x, bad: r.bad, onF: r.tiles.filter(fenced).length, left: (r.x - 4) - LANE_PX[0], right: LANE_PX[1] - Math.floor(r.x + 4) }); }
    const lmin = Math.min(...side.filter((q) => q.lab === "left").map((q) => q.x)), rmax = Math.max(...side.filter((q) => q.lab === "right").map((q) => q.x));
    check(name, "the lane, inside it: pushed left and right at each of its 4 rows, pi stops flush against each fence (its feet' edge on the lane's first or last pixel), never a foot on solid, never on a fence; side to side it has 7 px of room (pi's middle from x 1892 to 1899)",
      side.every((q) => q.bad === 0 && q.onF === 0) && side.filter((q) => q.lab === "left").every((q) => q.left >= 0 && q.left < 1) && side.filter((q) => q.lab === "right").every((q) => q.right === 0) && Math.floor(lmin) === 1892 && Math.floor(rmax) === 1899,
      `left stops at x ${lmin.toFixed(2)}, right at ${rmax.toFixed(2)}`);
    lane.push(`${name}: inside the lane pi's middle ranges x ${lmin.toFixed(2)} to ${rmax.toFixed(2)} (7 px of play); in the middle its feet clear each fence by 3 to 4 px`);
    // the planner through the lane, both ways and across, on the update loop
    const lw = [];
    for (const [a, b] of [[[118, 9], [118, 18]], [[118, 18], [118, 9]], [[113, 8], [121, 19]], [[121, 19], [113, 8]], [[106, 18], [118, 9]], [[124, 8], [114, 18]]]) { const r = await walk(cp, tilePx(a), b); lw.push({ a, b, r, used: r.plan !== null && LANE.every((q) => r.seen.some((s) => s.join() === q.join())) }); }
    check(name, "the lane, the planner: a tap from one end to the other (118,9 to 118,18, both ways) and across between the two paddocks (113,8 to 121,19 both ways, 106,18 to 118,9, 124,8 to 114,18) walks through the lane on the update loop with no stall, never on a fence",
      lw.every((q) => q.r.plan !== null && q.r.at.join() === q.b.join() && q.used && q.r.stalls === 0 && !onFence(q.r.seen).length), lw.map((q) => `${q.a} to ${q.b}: ${q.r.plan === null ? "no path" : `${q.r.plan} tiles, ${q.r.frames} frames, ${q.r.stalls} stalls${q.used ? "" : ", NOT through the lane"}`}`).join("; "));
    // the helicopter over the lane: never sets down where any of it would be over a fence
    const hl = await cp.I(([laneR]) => { const I2 = window.__island; let n = 0, ok = 0; const rowsOk = new Set(); for (let y = 9; y <= 18; y++) for (let py = y * 16; py < y * 16 + 16; py += 2) for (let px = 117 * 16; px < 119 * 16; px += 2) { if (!I2.tile(Math.floor(px / 16), y).walkable) continue; n++; if (I2.canLand(px, py)) { ok++; rowsOk.add(y); } }
      let inLane = 0; for (const [x, y] of laneR) for (let py = y * 16; py < y * 16 + 16; py += 2) for (let px = x * 16; px < x * 16 + 16; px += 2) if (I2.canLand(px, py)) inLane++; return { n, ok, rows: [...rowsOk].sort((a, b) => a - b), inLane }; }, [LANE]);
    check(name, "the lane, the helicopter: it can't set down anywhere in the one-tile lane (rows 12 to 15, every 2 px: its skids would be over a fence); it can only where the lane opens out (the two-tile mouths, rows 11 and 16 to 17, and beyond), with all of it clear of both fences", hl.inLane === 0 && hl.rows.every((y) => y <= 11 || y >= 16),
      `${hl.ok} of ${hl.n} spots in column 117 to 118 allow a landing, rows ${hl.rows.join(",") || "none"}; in the lane ${hl.inLane}`);

    // the helicopter
    const hh = await cp.I(([ring, inner, yring, yinner]) => {
      const I2 = window.__island, isRI = new Set(ring.concat(inner, yring, yinner).map((p) => p.join()));
      let pts = 0, ok = 0; for (const [x, y] of ring.concat(inner)) for (let py = y * 16; py < y * 16 + 16; py += 4) for (let px = x * 16; px < x * 16 + 16; px += 4) { pts++; if (I2.canLand(px, py)) ok++; }
      const foot = (h) => [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].map(([dx, dy]) => [Math.floor((h[0] + dx) / 16), Math.floor((h[1] + dy) / 16)]);
      const runs = [[112, 20, 0, -150], [112, 8, 0, 150], [103, 14, 150, 0], [118, 9, 0, 150]].map(([x, y, vx, vy]) => { const ok0 = I2.canLand(x * 16 + 8, y * 16 + 8), r = I2.landingFrom(x * 16 + 8, y * 16 + 8, vx, vy), pt = [Math.floor(r.pi[0] / 16), Math.floor(r.pi[1] / 16)]; return { from: [x, y], ok0, state: r.state, heli: r.heli.map(Math.round), over: foot(r.heli).filter((q) => isRI.has(q.join())).length, pi: pt, piSafe: I2.safe(pt[0], pt[1]), piIn: isRI.has(pt.join()) }; });
      return { pts, ok, runs };
    }, [RING, INNER, YRING, YINNER]);
    check(name, `helicopter: it can't set down anywhere on the paddock's fence or inside it (${hh.pts} spots, every 4 px); four descents begun where E may land and drifting at the paddock from each side (the east one from the lane's north mouth, down the lane) park with no part over either paddock, pi out on safe ground`,
      hh.ok === 0 && hh.pts === 71 * 16 && hh.runs.every((r) => r.ok0 && r.state === "parked" && r.over === 0 && r.piSafe && !r.piIn), `${hh.ok} of ${hh.pts} allow a landing; ` + hh.runs.map((r) => `from ${r.from}: ${r.state} at ${r.heli}, pi on ${r.pi}${r.over ? " OVER A PADDOCK" : ""}`).join("; "));
    // the completeness report and storage
    const comp = await cp.I(() => window.__island.completeness());
    check(name, "completeness: with both paddock fences there (each enclosing, with its art) the paddock fences item is gone; a normal format-2 home made of this content would still be refused (the creatures and the rest; B3d3's koi garden wall and park gate and B3d4b's stations have left the list)",
      comp && !comp.complete && !comp.missing.some((q) => /^paddock fences/.test(q)) && !comp.missing.some((q) => /^(compound walls|the park gate)/.test(q)) && comp.missing.some((q) => /^spawns and roam areas/.test(q)), comp ? `${comp.missing.length} items missing, first: ${comp.missing.slice(0, 2).join(" | ")}` : "");
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the pushes, walks, landings and a reload)", (await storeOf(cp)) === JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]])));
    // the decoder refuses a malformed paddock fence
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
  }
  if (cp.loaded) await cp.ctx.close();

  // 2c. a real flight: E over the paddock is refused; beside it the helicopter lands and pi hops out on safe ground
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      await P.page.focus(".w-cv");
      const fly = async (tx, ty) => {
        for (let i = 0; i < 260; i++) {
          const h = (await P.I(() => window.__island.getState())).heli, dx = tx - h.x, dy = ty - h.y;
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { await P.I(() => window.__island.step(150)); const h2 = (await P.I(() => window.__island.getState())).heli; if (Math.hypot(tx - h2.x, ty - h2.y) < 10) return h2; continue; }
          const ks = []; if (dx > 6) ks.push("ArrowRight"); if (dx < -6) ks.push("ArrowLeft"); if (dy > 6) ks.push("ArrowDown"); if (dy < -6) ks.push("ArrowUp");
          for (const k of ks) await P.page.keyboard.down(k);
          await P.I((n) => window.__island.step(n), Math.hypot(dx, dy) > 80 ? 12 : 4);
          for (const k of ks) await P.page.keyboard.up(k);
          await P.I(() => window.__island.step(6));
        }
        return (await P.I(() => window.__island.getState())).heli;
      };
      await P.I(() => { const I2 = window.__island; I2.step(300); const h = I2.getState().heli; I2.teleport(h.x + 20, h.y + 4); I2.step(5); });
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const up = (await P.I(() => window.__island.getState())).heli.state;
      const over = await fly(TREX[0] * 16 + 8, TREX[1] * 16 + 8);
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(30));
      const after2 = (await P.I(() => window.__island.getState())).heli.state;
      check(name, "in flight: E over the T. rex's spot in the middle of the paddock (112,14) doesn't land: the helicopter keeps flying", up === "flying" && after2 === "flying", `took off: ${up}, over ${Math.round(over.x)},${Math.round(over.y)}, after E: ${after2}`);
      const overL = await fly(118 * 16 + 8, 13 * 16 + 8);
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(30));
      const afterL = (await P.I(() => window.__island.getState())).heli.state;
      check(name, "in flight: E over the lane between the paddocks (118,13) doesn't land either (no room for the skids between the fences): the helicopter keeps flying", afterL === "flying", `over ${Math.round(overL.x)},${Math.round(overL.y)}, after E: ${afterL}`);
      await fly(112 * 16 + 8, 21 * 16 + 8); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const l = await P.I(() => { const I2 = window.__island, s = I2.getState(), tx = Math.floor(s.pi.x / 16), ty = Math.floor(s.pi.y / 16); return { state: s.heli.state, heli: [Math.round(s.heli.x), Math.round(s.heli.y)], pi: [tx, ty], safe: I2.safe(tx, ty), clear: [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(s.pi.x + dx, s.pi.y + dy)) }; });
      check(name, "in flight: beside the paddock, just south of the fence walk (112,21), it lands and pi hops out clear, on safe ground, outside the fence", l.state === "parked" && l.safe && l.clear && !inside(l.pi) && !fenced(l.pi) && !P.errs.length, JSON.stringify(l) + (P.errs.length ? " errors " + P.errs.join("; ") : ""));
    } else check(name, "in flight", false, "didn't load");
    await P.ctx.close(); }

  // 2d. the fence on screen, against the terrain preview at the same spot, step and size (1280 x 560: scale 2, pi in the lane, both
  // paddocks in the frame). Over each fence tile the frame must differ; over the open tiles touching it, outside and inside, it must not
  // (the tiles beside pi, where its sprite is, are left out)
  { const vp = { viewport: { width: 1280, height: 560 } }, A2 = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: vp }), B2 = await open(`http://127.0.0.1:${port}/${Q}`, { ctxOpts: vp });
    if (A2.loaded && B2.loaded) {
      for (const P of [A2, B2]) await settle(P, [118 * 16 + 8, 13 * 16 + 10]);
      { const ta = await A2.I(() => window.__island.getState().t), tb = await B2.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await B2.I((n) => window.__island.step(n), k); else if (k < 0) await A2.I((n) => window.__island.step(n), -k); }
      const NEAR = []; for (const [x, y] of RING) for (const [dx, dy] of N4) { const q = [x + dx, y + dy]; if (!isRing.has(q.join()) && !NEAR.some((o) => o.join() === q.join()) && m.coll[q[1] * W + q[0]] === 0 && !(Math.abs(q[0] - 118) <= 1 && Math.abs(q[1] - 13) <= 2)) NEAR.push(q); }
      const grab = (P) => P.I(([ring, near]) => {
        const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const tile = ([x, y]) => { const x0 = Math.ceil((x * 16 - v.camera[0]) * E), y0 = Math.ceil((y * 16 - v.camera[1]) * E), x1 = Math.floor(((x + 1) * 16 - v.camera[0]) * E) - 1, y1 = Math.floor(((y + 1) * 16 - v.camera[1]) * E) - 1;
          if (x0 < 0 || y0 < 0 || x1 >= c.width || y1 >= c.height) return null; const o = []; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = (yy * c.width + xx) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; };
        const fa = I2.fenceArt("holding-paddock");
        return { cam: v.camera, ring: ring.map(tile), near: near.map(tile), at: fa ? fa.pieces.map((q) => [q.tile, q.at]) : null };
      }, [RING, NEAR]);
      const a = await grab(A2), b = await grab(B2);
      const frac = (x, y) => { if (!x || !y || x.length !== y.length) return null; let dd = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) dd++; return dd / (x.length / 3); };
      const rf = RING.map((q, i) => frac(a.ring[i], b.ring[i])), nf = NEAR.map((q, i) => frac(a.near[i], b.near[i]));
      const sameCam = a.cam.join() === b.cam.join(), allIn = rf.every((v) => v !== null) && nf.every((v) => v !== null);
      const rMin = Math.min(...rf.filter((v) => v !== null)), rAll = rf.filter((v) => v !== null).reduce((x, y) => x + y, 0) / Math.max(1, rf.filter((v) => v !== null).length);
      const low = RING.filter((q, i) => rf[i] !== null && rf[i] < 0.95).map((q) => q.join());
      check(name, "fence on screen (1280 x 560, the whole paddock in the frame): against the terrain preview's frame, the picture differs over every fence tile (each at least 95% of its pixels, 99.5% overall): the art is visible over every solid pixel",
        sameCam && allIn && rMin >= 0.95 && rAll >= 0.995, `camera ${sameCam ? "same" : "differs"}; per tile min ${(100 * rMin).toFixed(1)}%, mean ${(100 * rAll).toFixed(2)}%${low.length ? "; under 95%: " + low.join(" ") : ""}`);
      const nMax = Math.max(...nf.filter((v) => v !== null)), nHi = NEAR.filter((q, i) => nf[i] !== null && nf[i] > 0.02).map((q) => q.join());
      check(name, `the ${NEAR.length} open tiles touching the paddock's fence, outside, inside and in the lane, look exactly as on the terrain preview (at most 2% of a tile's pixels differ: no art over walkable ground, no gap drawn shut)`, allIn && nMax <= 0.02,
        `max ${(100 * nMax).toFixed(2)}% differ${nHi.length ? " (over 2%: " + nHi.slice(0, 6).join(" ") + ")" : ""}`);
      check(name, "art: each of the 36 pieces was drawn at its own tile's origin (world px), and nowhere else", a.at && a.at.length === 36 && a.at.every(([tl, q]) => q && q[0] === tl[0] * T && q[1] === tl[1] * T), a.at ? `${a.at.filter((q) => q[1]).length} drawn` : "no fence");
    } else check(name, "fence on screen", false, "didn't load");
    await A2.ctx.close(); await B2.ctx.close(); }

  // 2e. how well pi shows in the lane: pi's light pixels on screen (its white body) in the lane's middle, against pi on open grass
  // beside the paddock (116,9), same camera offset (pi centred), same frame of its idle loop
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: 1280, height: 800 } } });
    if (P.loaded) {
      const lit = (at) => P.I(([x, y]) => { const I2 = window.__island; I2.teleport(x, y); for (let i = 0; i < 90; i++) I2.step(1); const st = I2.getState().t; I2.step(Math.round((Math.ceil(st) - st) * 60)); const v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), g = c.getContext("2d");
        const sx = Math.round((x - v.camera[0]) * E), sy = Math.round((y - v.camera[1]) * E), r = Math.round(14 * E), d = g.getImageData(sx - r, sy - r * 2, r * 2, r * 2 + Math.round(4 * E)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] >= 236 && d[i + 1] >= 236 && d[i + 2] >= 236) n++; return n; }, at);
      const inLane = [], onGrass = [];
      for (const row of [12, 13, 14, 15]) inLane.push(await lit([118 * 16 + 8, row * 16 + 10]));
      for (const at of [[116, 9], [111, 9], [113, 17]]) onGrass.push(await lit(tilePx(at)));
      const g0 = Math.max(...onGrass), ratio = Math.min(...inLane) / g0;
      check(name, "the lane, visibility: pi in the lane (each of its 4 rows) shows at least 90% as much of its white body on screen as on open grass beside the paddock: nothing of the fences hides it", g0 > 50 && ratio >= 0.9, `pi's light pixels: in the lane ${inLane.join(", ")}; on open grass ${onGrass.join(", ")} (${(100 * ratio).toFixed(0)}%)`);
      lane.push(`${name}: visibility: pi's light pixels in the lane ${inLane.join("/")}, on open grass ${onGrass.join("/")}: ${(100 * ratio).toFixed(0)}%`);
    } else check(name, "the lane, visibility", false, "didn't load");
    await P.ctx.close(); }

  // 2f. phones (390 x 844 and 375 x 667, touch): a tap inside the paddock never walks pi in; taps in and through the lane walk pi there;
  // the touch joystick (a drag) takes pi through the lane
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const follow = () => P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 2000; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen, stalls: p.stalls }; });
    await settle(P, tilePx(PLACE));
    let sc = await screenOf(P, TREX[0] * 16 + 8, TREX[1] * 16 + 8);
    await P.page.touchscreen.tap(sc.sx, sc.sy);
    let r = await follow();
    check(name, `phone ${vw} x ${vh}: from the viewing place (112,19), a tap on the ground inside the paddock (the T. rex's spot, 112,14) never walks pi in: pi stays outside, never on the fence`,
      sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh && !inside(r.at) && !r.seen.some(inside) && !onFence(r.seen).length && !P.errs.length, `tap at ${sc.sx.toFixed(0)},${sc.sy.toFixed(0)}; pi ended ${r.at} via ${r.seen.join(" ")}${P.errs.length ? "; errors " + P.errs.join("; ") : ""}`);
    const taps = [];
    for (const [from, to] of [[[118, 9], [118, 13]], [[118, 9], [118, 18]], [[118, 18], [118, 10]]]) {
      await settle(P, tilePx(from)); const s0 = (await P.I(() => window.__island.getState().pi.stalls));
      sc = await screenOf(P, to[0] * 16 + 8, to[1] * 16 + 8); await P.page.touchscreen.tap(sc.sx, sc.sy); r = await follow();
      taps.push({ from, to, sc, r, stalls: r.stalls - s0, onScreen: sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh });
    }
    check(name, `phone ${vw} x ${vh}: taps on the lane (from 118,9 to its middle 118,13; from 118,9 to 118,18 at its far end; from 118,18 to 118,10) walk pi there through it with no stall, never on a fence; the lane is ${taps[0].sc.tile.toFixed(0)} CSS px wide on screen`,
      taps.every((q) => q.onScreen && q.r.at.join() === q.to.join() && q.stalls === 0 && !onFence(q.r.seen).length) && !P.errs.length, taps.map((q) => `${q.from} to ${q.to}: ended ${q.r.at}, ${q.stalls} stalls`).join("; "));
    lane.push(`${name}: phone ${vw} x ${vh}: the lane is ${taps[0].sc.tile.toFixed(0)} CSS px wide (a tile); taps ${taps.map((q) => `${q.from} to ${q.to} ended ${q.r.at}`).join(", ")}`);
    // the joystick: a touch held and dragged (pointer events, as a finger makes them), straight down from the lane's north end, and a
    // little to the right of straight down from the mouth's west tile (117,10)
    const joy = async (from, ang, ms = 2400) => {
      await settle(P, from);
      const at = { x: Math.round(vw * 0.3), y: Math.round(vh * 0.75) };
      await P.page.evaluate(([x, y]) => { const cv = document.querySelector(".w-cv"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true })); }, [at.x, at.y]);
      await P.page.evaluate(([x, y, a]) => { const cv = document.querySelector(".w-cv"); for (let k = 1; k <= 6; k++) cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x + Math.sin(a) * 10 * k, clientY: y + Math.cos(a) * 10 * k, bubbles: true })); }, [at.x, at.y, ang]);
      const out = await P.I((n) => { const I2 = window.__island, seen = []; let bad = 0; for (let f = 0; f < n; f += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) bad++; } return { seen, bad }; }, Math.round(ms / 1000 * 60));
      await P.page.evaluate(() => { document.querySelector(".w-cv").dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, pointerType: "touch", isPrimary: true, bubbles: true })); });
      return out;
    };
    const j1 = await joy(tilePx([118, 10]), 0), j2 = await joy(tilePx([117, 10]), 0.35), j3 = await joy([117 * 16 + 8, 10 * 16 + 10], 0);
    const thru = (j) => LANE.every((q) => j.seen.some((s) => s.join() === q.join())) && j.seen.some((s) => s[1] >= 17);
    check(name, `phone ${vw} x ${vh}: the touch joystick: dragged straight down from the lane's north end (118,10), pi walks through it; dragged a little right of straight down from the mouth's west tile (117,10), pi slides along the yard's fence into it and through; dragged straight down from 117,10 pi stops at the paddock's fence end; never a foot on solid, never on a fence`,
      thru(j1) && thru(j2) && !thru(j3) && [j1, j2, j3].every((j) => j.bad === 0 && !onFence(j.seen).length && !j.seen.some(inside)), [["straight from 118,10", j1], ["right of straight from 117,10", j2], ["straight from 117,10", j3]].map(([k2, j]) => `${k2}: ${thru(j) ? "through" : "not through"}, ended ${j.seen[j.seen.length - 1]}`).join("; "));
    lane.push(`${name}: phone ${vw} x ${vh}: joystick straight down from 118,10 ${thru(j1) ? "through" : "NOT through"}; a little right of straight from 117,10 ${thru(j2) ? "through" : "NOT through"}; straight down from 117,10 ${thru(j3) ? "through" : "stops at " + j3.seen[j3.seen.length - 1]}`);
    await P.ctx.close();
  }

  // 2g. performance: the fences' draw cost and the frame work walking round the paddock and through the lane on the live loop, beside
  // the terrain preview; planning round it; a walk to its closed-in middle; decoding
  if (tp.loaded) {
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.fenceMs, v.fenceDraws]; });
      await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[111, 9], "ArrowRight"], [[118, 9], "ArrowDown"], [[117, 18], "ArrowLeft"], [[105, 17], "ArrowUp"]]) {
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at);
        await P.page.keyboard.down(k2); await P.page.waitForTimeout(2200); await P.page.keyboard.up(k2);
      }
      const r = await P.I(() => ({ f: window.__island.frames(true), v: window.__island.preview() }));
      await P.ctx.close();
      const f = r.f.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], fms: r.v.fenceMs - b0[0], fn: r.v.fenceDraws - b0[1], errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    const per = lc && lc.fn ? lc.fms / lc.fn : 0;
    perf.push(`${name}: live frame work walking round the paddock and down the lane: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; one fence piece ${(per * 1000).toFixed(2)} us a draw (${lc ? lc.fn : 0} draws, ${lc ? lc.fms.toFixed(1) : 0} ms in all)`);
    check(name, "performance: walking round the paddock and down the lane on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const P2 = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P2.loaded) {
      const across = (P) => P.I(() => { const I2 = window.__island; I2.teleport(105 * 16 + 8, 14 * 16 + 10); let a = performance.now(); const n = I2.walkTo(118, 14, false); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(118, 14, false); return [cold, (performance.now() - a) / 20, n]; });
      const xc = await across(P2), xt = await across(tp);
      perf.push(`${name}: path planning across the paddock (105,14 to 118,14; ms first / warm, tiles): content ${xc[0].toFixed(2)} / ${xc[1].toFixed(2)}, ${xc[2]} tiles; terrain preview ${xt[0].toFixed(2)} / ${xt[1].toFixed(2)}, ${xt[2]} tiles`);
      const toMiddle = (P, from, to) => P.I(([f, tt2]) => { const I2 = window.__island, o = {}; for (const lo of [false, true]) { I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); let a = performance.now(); const n = I2.walkTo(tt2[0], tt2[1], lo); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 10; i++) { I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); I2.walkTo(tt2[0], tt2[1], lo); } o[lo ? "loose" : "strict"] = [cold, (performance.now() - a) / 10, n]; } return o; }, [from, to]);
      const mc = await toMiddle(P2, PLACE, TREX), PP = await open(`http://127.0.0.1:${port + 3}/${Q}`), mp = PP.loaded ? await toMiddle(PP, [41, 51], [33, 48]) : null; await PP.ctx.close();
      const mf = (o) => o ? ["strict", "loose"].map((k2) => `${k2} ${o[k2][0].toFixed(2)} / ${o[k2][1].toFixed(2)} ms (${o[k2][2] === null ? "no path" : o[k2][2] + " tiles"})`).join(", ") : "didn't load";
      perf.push(`${name}: a walk to the closed-in middle (first / warm): MAP-B paddock (112,19 to 112,14) ${mf(mc)}; format 1's t-rex paddock in production (41,51 to 33,48) ${mf(mp)}`);
      const dec = await P2.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [cWith(() => {})]);
      const decT = await tp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [STAGED_MAP]);
      perf.push(`${name}: decoding the staged map: ${dec.toFixed(1)} ms with the content layer (${REAL_DATA.records.length} records), ${decT.toFixed(1)} ms without (terrain preview)`);
    }
    await P2.ctx.close();
  }
  if (tp.loaded) await tp.ctx.close();

  // 2h. code mutations (Chromium only: each is a whole load)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.fencesUndrawn[1](WORLD) }); const a = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(112 * 16 + 8, 19 * 16 + 10); for (let i = 0; i < 10; i++) I2.step(1); return I2.fenceArt("holding-paddock").pieces.filter((q) => q.at).length; }) : null;
      caught(MUT.fencesUndrawn[0], a === 0, `${a} paddock fence pieces drawn`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.fenceOpen[1](WORLD) }); const r = P.loaded ? await P.I(() => { const I2 = window.__island; return { walk: I2.tile(112, 17).walkable, safe: I2.safe(112, 14) }; }) : null;
      caught(MUT.fenceOpen[0], r && (r.walk || r.safe), r ? JSON.stringify(r) : "didn't load"); await P.ctx.close(); }
  }

  // 2i. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    const at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
    const wide = { viewport: { width: 1280, height: 560 } };
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: wide, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await at(P, 118, 13, 1500);
        await shoot(P, `${name}-paddocks-${tag}.png`);
        if (tag === "day") {
          // the diagnostic overlay: what blocks (the game's own content collision, read tile by tile) over the art, the closed-in insides,
          // the safe ground round them, the lane and the viewing place; its legend clear of the island's interface, left of the paddock
          const clear = await P.I(([box, place, laneR]) => {
            const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
            c.id = "b3d2-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
            const g = c.getContext("2d"), X = (tx) => (tx * 16 - v.camera[0]) * E, Y = (ty) => (ty * 16 - v.camera[1]) * E, Sz = 16 * E, isL = new Set(laneR.map((p) => p.join())); let solid = 0, closed = 0, safe = 0;
            for (let y = box.y0 - 1; y <= box.y1 + 1; y++) for (let x = box.x0 - 1; x <= 128; x++) {
              const q = I2.tile(x, y);
              if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.42)"; g.fillRect(X(x), Y(y), Sz, Sz); g.strokeStyle = "#ff4040"; g.lineWidth = 1; g.strokeRect(X(x) + 0.5, Y(y) + 0.5, Sz - 1, Sz - 1); }
              else if (q.walkable && !I2.safe(x, y)) { closed++; g.fillStyle = "rgba(77,150,255,.30)"; g.fillRect(X(x), Y(y), Sz, Sz); }
              else if (isL.has(x + "," + y)) { g.fillStyle = "rgba(255,209,102,.45)"; g.fillRect(X(x), Y(y), Sz, Sz); }
              else if (I2.safe(x, y)) { safe++; g.strokeStyle = "rgba(74,222,128,.9)"; g.lineWidth = 1; g.strokeRect(X(x) + 2.5, Y(y) + 2.5, Sz - 5, Sz - 5); }
            }
            g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(X(place[0]), Y(place[1]), Sz, Sz);
            cvs.parentElement.insertBefore(c, cvs.nextSibling);
            const L = document.createElement("div"); L.id = "b3d2-legend";
            L.textContent = `B3d2 diagnostic (test overlay)\nred: fence collision, read\n     from the game\n     (36 + 30 tiles)\nblue: insides, closed in\n     (35 + 42, not safe)\nyellow: the lane, 118,12-15\ngreen: safe ground\nwhite: viewing place 112,19\nno openings`;
            Object.assign(L.style, { position: "absolute", right: "12px", top: "64px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "16px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
            document.body.appendChild(L);
            const lr = L.getBoundingClientRect(), hits = [];
            for (const el of cvs.parentElement.querySelectorAll("*")) {
              if (el === L || el === c || el === cvs || L.contains(el) || el.contains(L)) continue;
              const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none" || +st.opacity === 0) continue;
              const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
              if (r.left < lr.right && r.right > lr.left && r.top < lr.bottom && r.bottom > lr.top && (el.children.length === 0 || el.tagName === "CANVAS")) hits.push((el.className || el.tagName) + "");
            }
            return { rect: [lr.left, lr.top, lr.width, lr.height].map(Math.round), hits, right: Math.round(cvs.getBoundingClientRect().left + X(129)), solid, closed, safe };
          }, [BOX, PLACE, LANE]);
          check(name, "diagnostic overlay (review screenshot only): the game's own collision shows exactly both fences' 66 tiles and both insides' 77 closed-in tiles in the frame, the lane open; its legend is on screen, clear of the island's interface, right of the raptor yard",
            clear.solid === 66 && clear.closed === 77 && clear.rect[0] >= 0 && clear.rect[1] >= 0 && clear.rect[0] + clear.rect[2] <= 1280 && clear.rect[1] + clear.rect[3] <= 560 && clear.hits.length === 0 && clear.rect[0] > clear.right,
            `${clear.solid} solid, ${clear.closed} closed in, ${clear.safe} safe; legend at ${clear.rect}, the yard to x ${clear.right}; under it: ${clear.hits.join(", ") || "nothing"}`);
          await shoot(P, `${name}-paddock-diagnostic.png`);
        }
      }
      await P.ctx.close();
    }
    // close-ups at 1280 x 800 (scale 3): its sides and steps from outside, the lane, pi beside the fence and pushing into it; and at night
    for (const [hour, tag] of [[11, ""], [22, "-night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { wait: 2600 });
      if (P.loaded) {
        await hideDbg(P);
        const shots = tag ? [["passage", 118, 13], ["corner-ne", 117, 10]] : [["side-north", 112, 9], ["side-west", 105, 14], ["side-south", 112, 19], ["corner-nw", 108, 11], ["corner-ne", 117, 10], ["corner-sw", 106, 17], ["corner-se", 117, 17], ["passage", 118, 13], ["passage-north", 118, 10], ["passage-south", 118, 17]];
        for (const [f, x, y] of shots) { await at(P, x, y); await shoot(P, `${name}-${f}${tag}.png`); }
        if (!tag) {
          await at(P, 112, 19, 600); await P.page.keyboard.down("ArrowUp"); await P.page.waitForTimeout(1000);
          await shoot(P, `${name}-collision-push.png`); await P.page.keyboard.up("ArrowUp");
          await at(P, 117, 10, 600); await P.page.keyboard.down("ArrowDown"); await P.page.waitForTimeout(1000);
          await shoot(P, `${name}-passage-blocked.png`); await P.page.keyboard.up("ArrowDown");
        }
      }
      await P.ctx.close();
    }
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
      const Q2 = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (Q2.loaded) { await cardAway(Q2); await at(Q2, 112, 19, 1200); await shoot(Q2, `${name}-${tag}-paddock.png`); await at(Q2, 118, 13, 1200); await shoot(Q2, `${name}-${tag}-passage.png`); }
      await Q2.ctx.close();
    }
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); plain.close();
if (lane.length) { console.log("\nthe lane (measured, for the record):"); lane.forEach((l) => console.log("  " + l)); }
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
