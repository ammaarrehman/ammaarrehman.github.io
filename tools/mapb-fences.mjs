#!/usr/bin/env node
/* mapb-fences (MAP-B B3d1): the paddock fences in the content layer, starting with the raptor yard's (format 1's raptor
   pen), the record raptor-yard, kind fence: the ring round the B1e habitat raptor-yard (119,10 to 127,17), 30 tiles, every
   one drawn, no openings, its 42-tile inside closed in on purpose. Real content, served through the content preview
   (tools/mapb-preview.mjs --content); a few synthetic variants are built here in memory (never written anywhere), among
   them, in B3d1, the same fence renderer on the holding paddock's outline (B3a's next fence: proof the art and collision
   were reusable). B3d2 built that fence (tools/mapb-paddock.mjs tests it): the checks here that used the synthetic one now
   run on the real content, the yard's west side is the lane between the two paddocks (column 118), and the ground cut off
   is both insides. B3d3 adds the koi garden's wall and the park gate (tools/mapb-koi-gate.mjs tests them): this suite
   expects the two records too, and nothing here changes. So for B3d4a's landmark bases (tools/mapb-landmarks.mjs).

   1. Node, the content and its compiler:
      - the tracked content file is the current compile, bound to the current terrain, and holds the fence beside B3c's
        three buildings and the compound wall;
      - the record against B1e and the B3a plan (not inferred from a spawn): the habitat's own box, contained; its ring,
        30 tiles, each drawn and nothing else; no openings, as format 1's pen has none; its inside, 42 tiles, exactly B3a's
        raptor roam box, as format 1's roam box is its pen's inside;
      - the ground under it (open level-2 grass, no foot-blocking pixel, no path), the ring closed and joined (each tile
        two neighbours along it, so no corner touches only diagonally), the inside cut off and nothing else, a walkable loop
        all round the outside, every trail, route end and the B3a viewing place still reached, the raptor house reserve
        untouched, the nearest cliff and the sea;
      - the holding paddock's fence beside it (real since B3d2): both insides are the only ground cut off, and the
        one-tile lane between them (column 118) stays open;
      - malformed fence records, one fault at a time, each caught by its rule (schema, fences, pockets); an opening
        authored in a straight run passes (the format allows one, the yard has none).
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - the content preview with the fence: both locked painter digests, the painter's reports as on the terrain preview,
        the content layer exactly the compiler's, the buildings and the compound wall as B3c left them;
      - the art: one opaque 16 x 16 piece on each of the 30 tiles (corners, runs, the two warning signs), drawn at its own
        tile; on screen it changes the picture over every fence tile and over no open tile beside it;
      - collision, pixel by pixel; the tiles (fence: not walkable, not safe; inside: walkable ground that is not safe;
        outside: safe); pi pushed into each side from outside and from inside, and diagonally into each corner from both
        sides, on the real update loop (move(), the same as the creatures'): stopped flush, never through, feet never on a
        solid pixel, still on the side it started;
      - the planner: round the yard, along each side, never into it, a walk to a fence tile stopping beside it, the spawn
        to the viewing place; no trapped ground outside it; its inside reached by nothing (on the terrain preview it was);
      - the helicopter: no landing on the fence or inside (every 4 px), drifting descents parking clear of both, and a real
        flight refused over the yard and landing beside it;
      - phones (390 x 844 and 375 x 667, touch): a tap inside from outside never walks pi in;
      - the completeness report, storage untouched, the terrain preview and production with no fence;
      - the decoder refuses malformed fences, one fault at a time; code mutations each caught;
      - the holding paddock beside the yard (real since B3d2): drawn the same way, and pi walks the lane between them;
      - performance: the fence's draw cost and the frame work walking round it beside the terrain preview, planning round
        it, decoding;
      - review screenshots (not baselines) into tools/out/mapb/b3d1/, with a labelled diagnostic overlay the test draws over
        the page (never the game).

     node tools/mapb-fences.mjs
     ENGINES=chromium node tools/mapb-fences.mjs
     MAPB_SHOTS=mapb/b3d2/regress-fences node tools/mapb-fences.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, compileContent, contentLayers, habitatMask, ContentError } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// its review screenshots go to tools/out/mapb/b3d1/ (B3d1's); MAPB_SHOTS names another folder under tools/out/ for a later
// batch's regression run, so B3d1's approved evidence stays as it was
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3d1");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

// the approved geometry: the B1e habitat raptor-yard's box (checked against the source below) and B3a's plan for it (ring 30,
// inside 42, the raptors' roam box the inside, the viewing place two rows below the south fence, as format 1's is)
const FENCE_ID = "raptor-yard", BOX = { x0: 119, y0: 10, x1: 127, y1: 17 }, ROAM = { x0: 120, y0: 11, x1: 126, y1: 16 }, PLACE = [123, 19];
const inBox = (x, y, b = BOX) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const onRing = (x, y) => inBox(x, y) && (x === BOX.x0 || x === BOX.x1 || y === BOX.y0 || y === BOX.y1);
const inside = (x, y) => inBox(x, y) && !onRing(x, y);
const RING = [], INNER = []; for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) (onRing(x, y) ? RING : INNER).push([x, y]);
const CORNERS = [[119, 10], [127, 10], [119, 17], [127, 17]], SIGNS = [[123, 10], [123, 17]];
// the walkable loop all round the outside: the tiles one step out from the box (118 to 128, 9 to 18)
const LOOP = []; for (let y = BOX.y0 - 1; y <= BOX.y1 + 1; y++) for (let x = BOX.x0 - 1; x <= BOX.x1 + 1; x++) if (!inBox(x, y)) LOOP.push([x, y]);
// format 1's raptor pen and its raptors' roam box (js/maps/home.js), for the comparison
const F1PEN = [60, 30, 70, 38], F1ROAM = [61, 31, 69, 37];
// pi walked into the fence: [side, from, the tile pi starts on, the keys held]; each side from outside and from inside (pi is
// put inside with the debug teleport only: nothing in the game reaches it), then diagonally into each corner from both. Since
// B3d2 the outside of the west side is the lane between the paddocks (118,13; 117,13 is the holding paddock's fence)
const PUSH = [["north", "outside", [123, 8], ["ArrowDown"]], ["north", "inside", [123, 13], ["ArrowUp"]], ["south", "outside", [123, 19], ["ArrowUp"]], ["south", "inside", [123, 13], ["ArrowDown"]],
  ["west", "outside", [118, 13], ["ArrowRight"]], ["west", "inside", [123, 13], ["ArrowLeft"]], ["east", "outside", [129, 13], ["ArrowLeft"]], ["east", "inside", [123, 13], ["ArrowRight"]]];
const CPUSH = [["north-west", "outside", [117, 9], ["ArrowRight", "ArrowDown"]], ["north-east", "outside", [128, 9], ["ArrowLeft", "ArrowDown"]], ["south-west", "outside", [117, 19], ["ArrowRight", "ArrowUp"]], ["south-east", "outside", [129, 19], ["ArrowLeft", "ArrowUp"]],
  ["north-west", "inside", [121, 12], ["ArrowLeft", "ArrowUp"]], ["north-east", "inside", [125, 12], ["ArrowRight", "ArrowUp"]], ["south-west", "inside", [121, 15], ["ArrowLeft", "ArrowDown"]], ["south-east", "inside", [125, 15], ["ArrowRight", "ArrowDown"]]];
const key = (l) => (l || []).map((p) => p.join()).sort().join(" ");
const pxOf = (b) => ({ px0: b.x0 * T, py0: b.y0 * T, px1: b.x1 * T + T - 1, py1: b.y1 * T + T - 1 });

/* ════════ 1. Node: the record and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H), F = RECS.find((r) => r.id === FENCE_ID);
check("node", "the content holds B3c's three buildings and compound wall as before, B3d1's raptor-yard fence, B3d2's holding-paddock fence, B3d3's koi garden wall and park gate and B3d4a's tower and lighthouse bases (nothing else)", RECS.map((r) => `${r.id}:${r.kind}`).join() === "visitor:building,depot:building,bunker:building,bunker-compound:wall,raptor-yard:fence,holding-paddock:fence,koi-garden:wall,park-gate:gate,tower-base:landmark,lighthouse-base:landmark", RECS.map((r) => `${r.id} (${r.kind})`).join(", "));
check("node", "the content passes every rule", contentProblems(RECS, src, m).length === 0, `${built.compiled.solidTiles} solid tiles (154 before B3d1, 30 more, then B3d2's 36, B3d3's 55 and B3d4a's 13), ${built.compiled.footPixels} foot pixels`);
const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
{
  const hab = src.habitats.find((q) => q.id === FENCE_ID);
  check("node", "B1e: the habitat raptor-yard is contained, with the box 119,10 to 127,17 (9 x 8): the approved enclosure, from the source (not inferred from the raptors' spawn)",
    hab && hab.containment === "contained" && JSON.stringify(hab.habitatBox) === JSON.stringify(BOX), hab ? `${hab.containment}, ${JSON.stringify(hab.habitatBox)}` : "no such habitat");
  check("node", "fence: the record raptor-yard is a fence round that habitat (ringOfHabitat), with placeholder art, closing it in (encloses), no openings, no door, reserve, room, compound or foot box",
    F && F.kind === "fence" && F.art === "placeholder" && F.encloses === true && !F.gapTiles && !F.doorTiles.length && !F.reserve && !F.room && !F.compound && !F.footPxBoxes.length && REAL.records.find((r) => r.id === FENCE_ID).solid.ringOfHabitat.habitat === FENCE_ID,
    F ? JSON.stringify({ kind: F.kind, art: F.art, encloses: F.encloses, gaps: F.gapTiles || [], doors: F.doorTiles.length }) : "no record");
  check("node", "fence: its solid is the habitat's ring, the box's edge: 30 tiles (B3a's count), and its drawn boxes are those 30 tiles exactly, one each (art on every solid tile, none over open ground)",
    F && key(F.tiles) === key(RING) && F.tiles.length === 30 && F.drawnPxBoxes.length === 30 && key(F.drawnPxBoxes.map((b) => [b.px0, b.py0, b.px1, b.py1])) === key(RING.map(([x, y]) => [x * T, y * T, x * T + T - 1, y * T + T - 1])), F ? `${F.tiles.length} tiles, ${F.drawnPxBoxes.length} boxes` : "");
  const inner = F ? F.inner : [];
  check("node", "fence: its inside is 120,11 to 126,16, 42 tiles (B3a's count), exactly B3a's roam box for the three raptors (roam-03, shared): as format 1's raptor roam box is its pen's inside",
    key(inner) === key(INNER) && INNER.length === 42 && INNER.every(([x, y]) => inBox(x, y, ROAM)) && (ROAM.x1 - ROAM.x0 + 1) * (ROAM.y1 - ROAM.y0 + 1) === 42, `${inner.length} inside`);
}
{ // format 1, for the comparison (js/maps/home.js): its raptor pen is a closed box ring on land, its roam box the inside
  const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); const F1 = c.window.ISLAND_MAPS.home;
  const pen = F1.regions.paddocks.find((p) => p[0] === "raptor pen"), roam = F1.regions.roamAreas.find((r) => r.id === "roam-03"), raptors = F1.spawns.filter((s) => s.kind === "raptor");
  check("node", "format 1: the raptor pen (60,30 to 70,38) has no gate (a paddock is a box and a name, nothing more); its three raptors share roam-03, exactly its inside (61,31 to 69,37), and start inside it",
    pen && pen.length === 5 && pen.slice(1).join() === F1PEN.join() && roam && roam.box.join() === F1ROAM.join() && raptors.length === 3 && raptors.every((s) => s.roam === "roam-03" && s.at[0] > F1PEN[0] && s.at[0] < F1PEN[2] && s.at[1] > F1PEN[1] && s.at[1] < F1PEN[3]),
    `${JSON.stringify(pen)}, roam-03 ${roam && roam.box}, raptors at ${raptors.map((s) => s.at).join(" ")}`);
}
{ // the ground under it and inside it
  const bad = RING.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.ground[y * W + x] !== 3 || m.height[y * W + x] !== 2 || foot(x, y) || m.pathClass[y * W + x] >= 0);
  const badIn = INNER.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.ground[y * W + x] !== 3 || m.height[y * W + x] !== 2 || foot(x, y));
  check("node", "fence: every fence tile is open grass on the level-2 highland (no terrain flag, no path, no bridge, dock or pad), with no foot-blocking pixel; so is every tile inside", bad.length === 0 && badIn.length === 0, `${bad.length} fence tiles, ${badIn.length} inside tiles not open grass`);
  // closed and joined: each fence tile has exactly two neighbours along the ring, and the ring is one 4-connected line
  const isF = new Set(F.tiles.map((p) => p.join())), joins = F.tiles.map(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isF.has(`${x + dx},${y + dy}`)).length);
  const seen = new Set([F.tiles[0].join()]), q = [F.tiles[0]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (isF.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); } } }
  check("node", "fence: closed and joined: every one of its 30 tiles is joined to exactly two others along the ring (4-connected: no corner touching only diagonally, no gap a foot could slip through), one line, all four corners fence",
    joins.every((n) => n === 2) && seen.size === 30 && CORNERS.every(([x, y]) => isF.has(`${x},${y}`)), `joins ${[...new Set(joins)].join("/")}, ${seen.size} in one line`);
}
const bfs = (from, block) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
const SPAWN = m.anchors.spawnTile, before = bfs(SPAWN, (i) => m.coll[i] !== 0), after = bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1);
// B3d2: the holding paddock's fence (real) and its inside, the other ground the content closes in
const HP_REC = RECS.find((r) => r.id === "holding-paddock"), HP_INNER = HP_REC ? HP_REC.inner : [], isHPIn = new Set(HP_INNER.map((p) => p.join()));
{
  const lost = []; for (let i = 0; i < W * H; i++) if (before[i] >= 0 && after[i] < 0 && !LAYER.tiles[i]) lost.push([i % W, (i / W) | 0]);
  check("node", "the inside is closed in on purpose, and with the holding paddock's (B3d2, 35) it is all that is: on the terrain alone the spawn reached all 42 inside tiles; with the content it reaches none, and every other tile it reached it still does",
    INNER.every(([x, y]) => before[y * W + x] >= 0 && after[y * W + x] < 0) && key(lost) === key(INNER.concat(HP_INNER)) && HP_INNER.length === 35, `${lost.length} cut off, ${lost.filter(([x, y]) => !inside(x, y) && !isHPIn.has(`${x},${y}`)).length} of them outside both paddocks`);
  // the outside: one step out all round, walkable, reached, and a loop on its own (pi can walk all the way round)
  const isL = new Set(LOOP.map((p) => p.join())), lseen = new Set([LOOP[0].join()]), q = [LOOP[0]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (isL.has(k) && !lseen.has(k)) { lseen.add(k); q.push([x + dx, y + dy]); } } }
  const lbad = LOOP.filter(([x, y]) => m.coll[y * W + x] !== 0 || LAYER.tiles[y * W + x] || after[y * W + x] < 0 || foot(x, y));
  check("node", "outside: the 38 tiles one step out all round (118 to 128, 9 to 18) are open ground with no foot-blocking pixel, reached from the spawn, and join up into one loop round the yard",
    LOOP.length === 38 && lbad.length === 0 && lseen.size === 38, lbad.length ? lbad.slice(0, 6).join(" ") : `${LOOP.length} tiles, ${lseen.size} in one loop`);
  // roads, trails and route ends
  const trails = ["paddock-fence-walk", "raptor-yard-walk", "research-station-door"].map((id) => { const k = src.corridors.paths.findIndex((p) => p.id === id); const tiles = []; for (let i = 0; i < W * H; i++) if (m.pathOf[i] === k) tiles.push([i % W, (i / W) | 0]); return { id, n: tiles.length, bad: tiles.filter(([x, y]) => after[y * W + x] < 0 || LAYER.tiles[y * W + x]) }; });
  const ends = (src.corridors.routeEnds || []).filter((e) => after[e.endTile[1] * W + e.endTile[0]] < 0);
  check("node", "roads: no fence tile is a path; the three trails round it (the paddock fence walk, which ends at 118,18 to 118,19 by the yard's south-west corner, the raptor yard walk, the research station's) are open and reached, every tile; all route ends still reached",
    RING.every(([x, y]) => m.pathClass[y * W + x] < 0) && trails.every((q2) => q2.n > 0 && !q2.bad.length) && m.ground[18 * W + 118] === 4 && m.ground[19 * W + 118] === 4 && ends.length === 0 && (src.corridors.routeEnds || []).length === 17,
    trails.map((q2) => `${q2.id} ${q2.n} tiles${q2.bad.length ? " (" + q2.bad.length + " blocked)" : ""}`).join("; ") + `; route ends cut off: ${ends.map((e) => e.id).join(", ") || "none"}`);
  const house = src.reserves.footprints.find((q2) => q2.id === "raptor-house"), hb = house && house.footprintBox; let houseSolid = 0;
  if (hb) for (let y = hb.y0; y <= hb.y1; y++) for (let x = hb.x0; x <= hb.x1; x++) houseSolid += LAYER.tiles[y * W + x];
  check("node", "B3a's viewing place for the raptors, 123,19 (two rows below the south fence, as format 1's 64,40 is below its pen's), is open ground reached from the spawn; the raptor house reserve (121,20 to 125,21, a later batch) stays empty",
    m.coll[PLACE[1] * W + PLACE[0]] === 0 && !LAYER.tiles[PLACE[1] * W + PLACE[0]] && after[PLACE[1] * W + PLACE[0]] >= 0 && hb && JSON.stringify(hb) === '{"x0":121,"y0":20,"x1":125,"y1":21}' && houseSolid === 0,
    `${after[PLACE[1] * W + PLACE[0]]} steps from the spawn; raptor house ${JSON.stringify(hb)}, ${houseSolid} solid`);
  // the relief round it: how far the nearest other level, cliff rim or water is
  let lv = 99, wet = 99;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.max(Math.max(BOX.x0 - x, x - BOX.x1, 0), Math.max(BOX.y0 - y, y - BOX.y1, 0)); if (!d) continue; const i = y * W + x; if (m.coll[i] & 6) wet = Math.min(wet, d); else if (m.land[i] && m.height[i] !== 2) lv = Math.min(lv, d); }
  check("node", "relief: the yard and its surroundings are one level (2, the highland): the nearest other level is well away (no cliff beside it), and the nearest water (the sea, off its north-east corner) is 2 tiles out",
    lv >= 10 && wet === 2, `nearest other level ${lv} tiles out, nearest water ${wet}`);
  perf.push(`node: the fence's ground: the nearest other level is ${lv} tiles from the yard, the nearest water ${wet}; the spawn to the viewing place ${after[PLACE[1] * W + PLACE[0]]} steps`);
}
{ // the holding paddock's fence beside it (synthetic in B3d1; real since B3d2): both insides alone cut off, and the lane between
  // them (column 118, rows 12 to 15: one tile between the two rings) stays open
  let ok = null, err = null; try { ok = compileContent(REAL, src, m); } catch (e) { err = e.message; }
  const hp = ok && ok.records.find((r) => r.id === "holding-paddock"), HL = ok && contentLayers(ok.records, W, H);
  const aft = HL && bfs(SPAWN, (i) => m.coll[i] !== 0 || HL.tiles[i] === 1), lost = []; if (aft) for (let i = 0; i < W * H; i++) if (before[i] >= 0 && aft[i] < 0 && !HL.tiles[i]) lost.push([i % W, (i / W) | 0]);
  const lane = []; for (let y = 9; y <= 18; y++) lane.push([118, y]);
  const laneOpen = aft && lane.every(([x, y]) => !HL.tiles[y * W + x] && aft[y * W + x] >= 0), between = hp && [12, 13, 14, 15].every((y) => hp.tiles.some((p) => p[0] === 117 && p[1] === y));
  check("node", "reuse (real since B3d2): the holding paddock's fence (the ring round its B1e outline, 36 tiles, 35 inside, as B3a counts) compiles beside the yard's with no problem; the two insides are the only ground cut off; column 118 between the two rings (one tile wide at rows 12 to 15) stays open and reached from 9 to 18",
    !!ok && hp.tiles.length === 36 && hp.inner.length === 35 && key(lost) === key(INNER.concat(hp.inner)) && laneOpen && between, err || `${hp.tiles.length} tiles, ${hp.inner.length} inside, ${lost.length} cut off; lane ${laneOpen ? "open" : "BLOCKED"}`);
}
// malformed fence records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const FR = (o) => o.records.find((r) => r.id === FENCE_ID);
const FBAD = [
  ["a fence with no art", "fences", (o) => { delete FR(o).art; }],
  ["an art kind the game doesn't draw", "schema", (o) => { FR(o).art = "sprite"; }],
  ["a fence round a box, not a B1e habitat (the same box: still refused)", "fences", (o) => { FR(o).solid = { ringOfBox: { ...BOX } }; }],
  ["a fence round its habitat with more tiles besides", "fences", (o) => { FR(o).solid.tiles = [[123, 19]]; }],
  ["a fence round an open habitat", "fences", (o) => { const r = FR(o); r.id = "pachy-heath"; r.solid.ringOfHabitat.habitat = "pachy-heath"; }],
  ["a fence named for something else than its habitat", "fences", (o) => { FR(o).id = "raptor-pen"; }],
  ["a drawn box of its own", "fences", (o) => { FR(o).drawnPxBoxes = [pxOf({ x0: 123, y0: 18, x1: 123, y1: 18 })]; }],
  ["a door", "fences", (o) => { FR(o).doorTiles = [[123, 18]]; }],
  ["a foot box", "fences", (o) => { FR(o).solid.footPxBoxes = [{ px0: 123 * T + 2, py0: 19 * T + 2, px1: 123 * T + 5, py1: 19 * T + 5 }]; FR(o).drawnPxBoxes = [pxOf({ x0: 123, y0: 19, x1: 123, y1: 19 })]; }],
  ["a reserve", "fences", (o) => { FR(o).reserve = "raptor-house"; }],
  ["no openings and no encloses", "fences", (o) => { delete FR(o).encloses; }],
  ["an opening and encloses", "fences", (o) => { FR(o).solid.ringOfHabitat.gapTiles = [[123, 17]]; }],
  ["an opening at a corner", "fences", (o) => { delete FR(o).encloses; FR(o).solid.ringOfHabitat.gapTiles = [[127, 17]]; }],
  ["an opening that isn't on the ring", "schema", (o) => { FR(o).solid.ringOfHabitat.gapTiles = [[123, 13]]; }],
  ["a room", "schema", (o) => { FR(o).room = "bunker"; }],
  ["a compound", "schema", (o) => { FR(o).compound = "bunker-compound"; }],
  ["no encloses and nothing else said (the inside cut off unsaid)", "pockets", (o) => { delete FR(o).encloses; }]
];
for (const [label, rule, fn] of FBAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => q[0]) : []; }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed fence: ${label} is caught by rule ${rule}`, caught.includes(rule), caught.join(", ") || "NOT caught");
}
{ // an opening authored in a straight run, with encloses left out: allowed (the yard has none; the format can)
  let p = null; try { p = contentProblems(resolveContent(realWith((o) => { delete FR(o).encloses; FR(o).solid.ringOfHabitat.gapTiles = [[123, 17]]; }), src, m), src, m); } catch (e) { p = [[e.rule, e.message]]; }
  check("node", "an opening in a straight run (123,17), encloses left out: passes every rule (the inside is then reached through it)", p && p.length === 0, p && p.length ? p.map((q) => q.join(": ")).join("; ") : "");
}

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const REAL_DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// the real content with the holding paddock's fence (synthetic in B3d1; real since B3d2), the renderer on an outline that isn't a box
const HPC = built.compiled, HPL = contentLayers(HPC.records, W, H);
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
// the decoder's refusals, on the content preview: [label, change to the compiled content, message]
const cWith = (fn, base = REAL_DATA) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(base) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const dropTile = (r, x, y) => { r.tiles = r.tiles.filter((p) => !(p[0] === x && p[1] === y)); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === x * T && b.py0 === y * T)); };
const REFUSE = [
  ["a fence with no art", (c) => { delete DR(c, FENCE_ID).art; }, /^content record raptor-yard is a fence with no art/],
  ["an art kind the game doesn't draw", (c) => { DR(c, FENCE_ID).art = "sprite"; }, /^content record raptor-yard\.art "sprite" isn't one of placeholder$/],
  ["a fence tile with no art over it", (c) => { const r = DR(c, FENCE_ID); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === 123 * T && b.py0 === 17 * T)); }, /no invisible collision/],
  ["fence art on a tile it doesn't block", (c) => { DR(c, FENCE_ID).drawnPxBoxes.push(pxOf({ x0: 123, y0: 18, x1: 123, y1: 18 })); }, /its placeholder art is one tile on each of its solid tiles and nowhere else/],
  ["fence art reaching above its tile", (c) => { DR(c, FENCE_ID).drawnPxBoxes[0].py0 -= 4; }, /its placeholder art is one tile on each of its solid tiles and nowhere else/],
  ["a hole in the fence that isn't an opening", (c) => { dropTile(DR(c, FENCE_ID), 123, 17); c.solidTiles--; }, /don't close round: 12(2|4),17 joins 1 \(a hole in it isn't one of its openings\)/],
  ["a foot box on a fence", (c) => { const r = DR(c, FENCE_ID); r.footPxBoxes.push({ px0: 123 * T + 2, py0: 17 * T + 2, px1: 123 * T + 5, py1: 17 * T + 5 }); c.footPixels += 16; }, /is a fence with foot boxes/],
  ["a closed fence that doesn't say it encloses", (c) => { delete DR(c, FENCE_ID).encloses; }, /^content record raptor-yard is a fence with no openings, so it closes its ground in: it must say so \(encloses\)$/],
  ["a fence with an opening that says it encloses", (c) => { const r = DR(c, FENCE_ID); dropTile(r, 123, 17); r.gapTiles = [[123, 17]]; c.solidTiles--; }, /^content record raptor-yard is a fence with 1 opening\(s\), so it doesn't close its ground in/],
  ["an opening on its own fence", (c) => { const r = DR(c, FENCE_ID); r.gapTiles = [[123, 17]]; delete r.encloses; }, /its opening 123,17 is one of its own solid tiles/],
  ["a compound on a fence", (c) => { DR(c, FENCE_ID).compound = "bunker-compound"; }, /^content record raptor-yard\.compound "bunker-compound": only a wall walls in a compound$/],
  ["a room on a fence", (c) => { DR(c, FENCE_ID).room = "bunker"; }, /^content record raptor-yard\.room "bunker": only a building has a room$/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  fencesUndrawn: ["the fences left out of the scene (their collision with no art)", (s) => s.replace("if (FENCEAT && fx >= 0", "if (false && FENCEAT && fx >= 0")],
  fenceArtShort: ["a fence piece's art one row short of its tile", (s) => s.replace("var P = FENCE_STYLE[pc.fence.id] || FENCE_STYLE.other, c = mkCanvas(); c.width = T; c.height = T;", "var P = FENCE_STYLE[pc.fence.id] || FENCE_STYLE.other, c = mkCanvas(); c.width = T; c.height = T - 1;")],
  noFenceShape: ["the decoder's fence checks removed", (s) => s.replace('if (r.kind === "fence") fenceShape(r, f, drawn);', "")],
  fenceOpen: ["the fence's tiles left out of the content collision (art with no collision)", (s) => s.replace("owner[i] = r.id; cc[i] = C_SOLID; nT++;", "owner[i] = r.id; if (r.kind !== \"fence\") cc[i] = C_SOLID; nT++;")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlay and its legend are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3d1-(overlay|legend)/.test(WORLD));

const port = 9600 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), plain = await serve(port + 3);
mkdirSync(join(OUT, "dev"), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Q = "?debug=1&step=1&islandhour=11#island";
const onFence = (seen, layer = LAYER) => seen.filter(([x, y]) => layer.tiles[y * W + x]);

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
    const plan = I2.walkTo(tt[0], tt[1], lo); if (plan === null) return { plan: null };
    const seen = []; let n = 0;
    for (; n < 4000; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
    const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], px: [p.x, p.y], seen };
  }, [from, to, loose]);
  const tilePx = (p) => [p[0] * T + 8, p[1] * T + 10];
  const cardAway = async (P) => { const go = await P.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { const bb = await go.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(200); } };
  const settle = (P, at) => P.I(([x, y]) => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(x, y); let c0 = ""; for (let i = 0; i < 600; i++) { I2.step(1); const c = I2.preview().camera.join(); if (c === c0 && i > 30) break; c0 = c; } }, at);
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });

  // 2a. the terrain preview and production: no fence
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => window.__island.preview()) : null;
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;
  check(name, "terrain preview: no content, no fence, no wall; both locked painter digests", tp.loaded && !tp.errs.length && tv.previewMode === "terrain" && tv.content === null && tv.fences.length === 0 && tv.walls.length === 0 && tDig.td === TERRAIN_SHA && tDig.gd === GROUND_SHA,
    tv ? `fences ${tv.fences.length}, terrain ${tDig.td.slice(0, 12)}, ground ${tDig.gd.slice(0, 12)}` : tp.errs.join("; "));
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`); const v = P.loaded ? await P.I(() => window.__island.preview()) : null;
    check(name, "production: format 1, 100 x 80, no preview, no content, no MAP-B fence or wall (format 1's own paddock fences draw as before; map-parity checks them)", P.loaded && !P.errs.length && v.format === 1 && v.w === 100 && v.h === 80 && v.previewMode === null && v.content === null && v.fences.length === 0 && v.walls.length === 0 && !v.saveLocked,
      v ? `format ${v.format}, ${v.w} x ${v.h}, fences ${v.fences.length}` : P.errs.join("; ")); await P.ctx.close(); }

  // 2b. the content preview with the fence
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const sortK = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k2) => [k2, o[k2]]));
  const cf = cv && cv.fences.find((f) => f.id === FENCE_ID);
  check(name, "content preview: loads with the ten records (288 solid tiles, B3d2's holding paddock, B3d3's koi garden wall and park gate and B3d4a's landmark bases among them), only the buildings system on; the yard's fence as its record says: 30 tiles, no openings, closing its ground in, 4 corners and 26 runs, warning signs on the middle of the north and south runs",
    cp.loaded && !cp.errs.length && cv.content.records === 10 && cv.content.solidTiles === 288 && cv.sys.buildings === true && cv.fences.map((f) => f.id).join() === "raptor-yard,holding-paddock" && cf.tiles === 30 && cf.encloses === true && !cf.gaps.length && sortK(cf.kinds) === sortK({ corner: 4, run: 26 }) && key(cf.signs) === key(SIGNS),
    cv ? JSON.stringify(cf) : cp.errs.join("; "));
  check(name, "content preview: B3c's buildings and the compound wall as they were (three buildings; the wall's 53 tiles, its three gates, 40 runs, 7 piers, 4 corners, 2 posts; B3d3's koi garden wall after it)",
    cv && cv.buildings.map((b) => b.id).join() === "visitor,depot,bunker" && cv.walls.map((q) => q.id).join() === "bunker-compound,koi-garden" && cv.walls[0].tiles === 53 && sortK(cv.walls[0].kinds) === sortK({ corner: 4, run: 40, pier: 7, post: 2 }), cv ? `${cv.buildings.length} buildings, wall ${JSON.stringify(cv.walls[0] && cv.walls[0].kinds)}` : "");
  if (cp.loaded) {
    // the painter, with the fence drawn (on screen: pi beside it)
    await cp.I(() => { const I2 = window.__island; I2.teleport(123 * 16 + 8, 19 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, the fence drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview (the fence is drawn in the object layer, never the ground)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the compiler's (288 tiles, the fence's 30 among them), kept apart from the terrain's (the compiler's, untouched); gameplay is their union", lay && LAYER.tiles.reduce((a, v) => a + v, 0) === 288 && RING.every(([x, y]) => L.k[y * W + x] !== 0));
    // the art: one opaque tile per fence tile
    const art = await cp.I((id) => { const a = window.__island.fenceArt(id); delete a.png; return a; }, FENCE_ID);
    const pieceAt = (x, y) => art.pieces.find((q) => q.tile[0] === x && q.tile[1] === y) || {};
    check(name, "art: one piece on each of the 30 fence tiles, each 16 x 16 with all 256 pixels fully opaque; the corners are corner pieces, the signs where the record's runs put them",
      art.pieces.length === 30 && art.pieces.every((q) => q.w === T && q.h === T && q.opaque === 256) && RING.every(([x, y]) => pieceAt(x, y).kind) && CORNERS.every(([x, y]) => pieceAt(x, y).kind === "corner") && SIGNS.every(([x, y]) => pieceAt(x, y).mark === "sign"),
      `${art.pieces.length} pieces, ${art.pieces.filter((q) => q.opaque === 256).length} fully opaque; corners ${CORNERS.map((c) => pieceAt(...c).kind).join("/")}`);
    // collision, pixel by pixel
    const pc = await cp.I(([ring, inner, loop]) => {
      const I2 = window.__island, isR = new Set(ring.map((p) => p.join()));
      let n = 0, open = 0, under = 0, rim = 0, rimBad = 0, inBlocked = 0;
      for (const [x, y] of ring) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) { n++; if (!I2.blocked(px, py)) open++; if (I2.terrainBlocked(px, py)) under++; }
      for (const [x, y] of inner) for (let py = y * 16; py < y * 16 + 16; py += 3) for (let px = x * 16; px < x * 16 + 16; px += 3) if (I2.blocked(px, py)) inBlocked++;
      for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (isR.has(nx + "," + ny)) continue;
        for (let k = 0; k < 16; k++) { const px = dx ? (dx > 0 ? nx * 16 : nx * 16 + 15) : x * 16 + k, py = dy ? (dy > 0 ? ny * 16 : ny * 16 + 15) : y * 16 + k; rim++; if (I2.blocked(px, py) !== I2.terrainBlocked(px, py)) rimBad++; }
      }
      const tiles = { fence: ring.filter(([x, y]) => { const q = I2.tile(x, y); return q.walkable || !q.content || I2.safe(x, y); }).length, inner: inner.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || I2.safe(x, y); }).length, loop: loop.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || !I2.safe(x, y); }).length };
      return { n, open, under, rim, rimBad, inBlocked, tiles };
    }, [RING, INNER, LOOP]);
    check(name, `collision: all ${pc.n} pixels of the 30 fence tiles block feet (none would on the terrain alone); the ${pc.rim} pixels touching the fence from outside and inside answer exactly as the terrain does; no pixel inside it is blocked (it is open ground, closed in)`,
      pc.n === 30 * 256 && pc.open === 0 && pc.under === 0 && pc.rimBad === 0 && pc.inBlocked === 0, JSON.stringify({ open: pc.open, under: pc.under, rimBad: pc.rimBad, inBlocked: pc.inBlocked }));
    check(name, "tiles: the fence's are content, not walkable, not safe ground; the 42 inside are walkable ground with no content, and not safe (closed in: no landing, no restored position); the 38 round the outside are safe ground",
      pc.tiles.fence === 0 && pc.tiles.inner === 0 && pc.tiles.loop === 0, JSON.stringify(pc.tiles));
    // pushed into the fence on the real update loop (move(), the same as the creatures'): flush, never through, feet never on solid
    const pushed = async (at, keys) => {
      await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(1); }, at);
      for (const k2 of keys) await cp.page.keyboard.down(k2);
      const r = await cp.I(() => { const I2 = window.__island; let bad = 0, worst = null; const tiles = new Set(); for (let f = 0; f < 150; f += 2) { I2.step(2); const p = I2.getState().pi; tiles.add(Math.floor(p.x / 16) + "," + Math.floor(p.y / 16)); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) { bad++; worst = [p.x, p.y]; } } return { p: I2.getState().pi, bad, worst, tiles: [...tiles] }; });
      for (const k2 of keys) await cp.page.keyboard.up(k2);
      return r;
    };
    for (const [side, from, at, keys] of PUSH) {
      const r = await pushed(at, keys), p = r.p;
      const gap = side === "north" ? (from === "outside" ? BOX.y0 * T - (p.y + 1) : (p.y - 2) - (BOX.y0 * T + T - 1)) : side === "south" ? (from === "outside" ? (p.y - 2) - (BOX.y1 * T + T - 1) : BOX.y1 * T - (p.y + 1))
        : side === "west" ? (from === "outside" ? BOX.x0 * T - (p.x + 4) : (p.x - 4) - (BOX.x0 * T + T - 1)) : (from === "outside" ? (p.x - 4) - (BOX.x1 * T + T - 1) : BOX.x1 * T - (p.x + 4));
      const stayed = r.tiles.every((q) => { const [x, y] = q.split(",").map(Number); return from === "inside" ? inside(x, y) : !inBox(x, y); });
      check(name, `containment: pi walked into the ${side} side from ${from} stops flush against it (feet within 3 px), never on a solid pixel, never across (every tile on the way ${from})`, gap > 0 && gap <= 3 && r.bad === 0 && stayed,
        `pi at ${p.x.toFixed(2)},${p.y.toFixed(2)}, ${gap.toFixed(2)} px from the fence${r.bad ? `; feet on solid ${r.bad} times, at ${r.worst}` : ""}${stayed ? "" : "; CROSSED: " + r.tiles.join(" ")}`);
    }
    for (const [corner, from, at, keys] of CPUSH) {
      const r = await pushed(at, keys), stayed = r.tiles.every((q) => { const [x, y] = q.split(",").map(Number); return from === "inside" ? inside(x, y) : !inBox(x, y); });
      check(name, `containment: pi walked diagonally into the ${corner} corner from ${from} slides or stops there: never through the corner, feet never on a solid pixel, every tile on the way ${from}`,
        r.bad === 0 && stayed, `ended ${Math.floor(r.p.x / 16)},${Math.floor(r.p.y / 16)}${r.bad ? `; feet on solid ${r.bad} times` : ""}${stayed ? "" : "; CROSSED: " + r.tiles.join(" ")}`);
    }
    // the planner: round it, along it, never into it
    { const r = await walk(cp, tilePx([118, 13]), [129, 13]);
      check(name, "planner: from the west side (the lane, 118,13) to the east side (129,13), pi goes round the yard on the update loop, never on a fence or inside", r.plan !== null && r.at.join() === "129,13" && !onFence(r.seen).length && !r.seen.some(([x, y]) => inside(x, y) || isHPIn.has(`${x},${y}`)) && r.plan > 11 + 6,
        r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight would be 11), ${r.seen.length} tiles walked`); }
    for (const [side, a, b] of [["north", [118, 9], [128, 9]], ["east", [128, 9], [128, 18]], ["south", [128, 18], [118, 18]], ["west", [118, 18], [118, 9]]]) {
      const r = await walk(cp, tilePx(a), b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      check(name, `outside: pi walks the length of the ${side} side outside the fence (${a} to ${b}) on the update loop, beside it all the way, never on it`, r.plan !== null && r.at.join() === b.join() && !onFence(r.seen).length && r.seen.every(([x, y]) => !inBox(x, y)) && r.plan <= straight + 2,
        r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight ${straight}), ended ${r.at}`);
    }
    for (const loose of [false, true]) {
      const r = await walk(cp, tilePx(PLACE), [123, 13], loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} from outside to the middle of the yard (123,13) never gets in: no plan, or one that ends outside, never on the fence`, r.plan === null || (!onFence(r.seen).length && !r.seen.some(([x, y]) => inside(x, y)) && !inBox(...r.at)),
        r.plan === null ? "no path planned" : `ended ${r.at}`);
      const f = await walk(cp, tilePx(PLACE), [123, 17], loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} to a fence tile (123,17) from outside ends on open ground beside it, never on the fence`, f.plan === null ? false : !onFence(f.seen).length && !inBox(...f.at) && Math.abs(f.at[0] - 123) + Math.abs(f.at[1] - 17) <= 2, f.plan === null ? "no path" : `ended ${f.at}`);
    }
    { await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(1); }, SPAWN);
      const r = await walk(cp, null, PLACE);
      check(name, "planner: from the spawn to B3a's viewing place below the south fence (123,19), pi walks there on the update loop, never on content", r.plan !== null && r.at.join() === PLACE.join() && !onFence(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan, ended ${r.at}`); }
    // trapped ground: from every walkable tile in and within 3 of the yard, pi standing there: outside, a path to the spawn; inside, none
    // (closed in on purpose); on the terrain preview, the same inside tiles had one
    // (since B3d2 the holding paddock's inside, closed in too, reaches into the scan at 116,13 and 116,14: it is left out here)
    const trapScan = (P) => P.I(([b2, hpIn]) => {
      const I2 = window.__island, cut = [], hp = new Set(hpIn.map((p) => p.join())); let n = 0, inReached = 0, inClosed = 0;
      for (let y = b2.y0 - 3; y <= b2.y1 + 3; y++) for (let x = b2.x0 - 3; x <= b2.x1 + 3; x++) {
        if (!I2.tile(x, y).walkable || hp.has(x + "," + y)) continue; n++;
        I2.teleport(x * 16 + 8, y * 16 + 10); const ok = I2.walkTo(79, 79, false) !== null;
        if (x > b2.x0 && x < b2.x1 && y > b2.y0 && y < b2.y1) { if (ok) inReached++; else inClosed++; } else if (!ok) cut.push(x + "," + y);
      }
      return { n, cut, inReached, inClosed };
    }, [BOX, HP_INNER]);
    const ct = await trapScan(cp), tt = tp.loaded ? await trapScan(tp) : null;
    check(name, `trapped ground: from all ${ct.n} walkable tiles in and within 3 of the yard, pi has a path to the spawn from every one outside it and from none of the 42 inside (on the terrain preview, before the fence, from all ${tt ? tt.n : "?"}, the inside too)`,
      ct.n > 150 && ct.cut.length === 0 && ct.inClosed === 42 && ct.inReached === 0 && tt && tt.cut.length === 0 && tt.inReached === 42 && tt.inClosed === 0,
      `content: outside cut off ${ct.cut.length ? ct.cut.slice(0, 6).join(" ") : "none"}, inside ${ct.inClosed} closed in / ${ct.inReached} reaching the spawn; terrain preview: outside cut off ${tt ? tt.cut.length : "-"}, inside ${tt ? tt.inReached : "-"} reaching the spawn / ${tt ? tt.inClosed : "-"} closed in`);
    // the helicopter
    const hl = await cp.I(([ring, inner, place]) => {
      const I2 = window.__island, isRI = new Set(ring.concat(inner).map((p) => p.join()));
      let pts = 0, ok = 0; for (const [x, y] of ring.concat(inner)) for (let py = y * 16; py < y * 16 + 16; py += 4) for (let px = x * 16; px < x * 16 + 16; px += 4) { pts++; if (I2.canLand(px, py)) ok++; }
      const foot = (h) => [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].map(([dx, dy]) => [Math.floor((h[0] + dx) / 16), Math.floor((h[1] + dy) / 16)]);
      // (each begun where E may land; since B3d2 the west one starts in the lane's two-tile south mouth, 117.5,17, the only ground
      // west of the yard with room for the skids, and drifts east at the fence)
      const runs = [[123, 20, 0, -150], [123, 8, 0, 150], [117.5, 17, 150, 0], [129, 14, -150, 0]].map(([x, y, vx, vy]) => { const ok0 = I2.canLand(x * 16 + 8, y * 16 + 8), r = I2.landingFrom(x * 16 + 8, y * 16 + 8, vx, vy), pt = [Math.floor(r.pi[0] / 16), Math.floor(r.pi[1] / 16)]; return { from: [x, y], ok0, state: r.state, heli: r.heli.map(Math.round), over: foot(r.heli).filter((q) => isRI.has(q.join())).length, pi: pt, piSafe: I2.safe(pt[0], pt[1]), piIn: isRI.has(pt.join()) }; });
      return { pts, ok, outside: I2.canLand(place[0] * 16 + 8, (place[1] + 2) * 16 + 8), runs };
    }, [RING, INNER, PLACE]);
    check(name, `helicopter: it can't set down anywhere on the fence or inside it (${hl.pts} spots, every 4 px), can just outside (123,21); four descents begun where E may land, drifting at the fence from each side, park with no part over the fence or the inside, pi out on safe ground`,
      hl.ok === 0 && hl.pts === 72 * 16 && hl.outside && hl.runs.every((r) => r.ok0 && r.state === "parked" && r.over === 0 && r.piSafe && !r.piIn), `${hl.ok} of ${hl.pts} allow a landing; ` + hl.runs.map((r) => `from ${r.from}: ${r.state} at ${r.heli}, pi on ${r.pi}${r.over ? " OVER THE YARD" : ""}`).join("; "));
    // the completeness report and storage
    const comp = await cp.I(() => window.__island.completeness());
    check(name, "completeness: a normal format-2 home made of this content would still be refused; with B3d2's holding paddock its paddock fences item is gone", comp && !comp.complete && !comp.missing.some((q) => /^paddock fences/.test(q)),
      comp ? (comp.missing.filter((q) => /^paddock fences/.test(q)).join() || "no paddock fences item") + `; ${comp.missing.length} items missing` : "");
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the pushes, walks, landings and a reload)", (await storeOf(cp)) === JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]])));
    // the decoder refuses malformed fences
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    { const msg = await refusedHere(cWith((c) => { const r = DR(c, FENCE_ID); dropTile(r, 123, 17); r.gapTiles = [[123, 17]]; delete r.encloses; c.solidTiles--; }));
      check(name, "decoder: an opening authored in a straight run (123,17), encloses left out, decodes (the format allows one; the yard has none)", msg === null, msg || ""); }
  }
  if (cp.loaded) await cp.ctx.close();

  // 2c. a real flight: E over the yard is refused; beside it the helicopter lands and pi hops out on safe ground
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
      const over = await fly(123 * 16 + 8, 13 * 16 + 8);
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(30));
      const after2 = (await P.I(() => window.__island.getState())).heli.state;
      check(name, "in flight: E over the middle of the yard (123,13) doesn't land: the helicopter keeps flying", up === "flying" && after2 === "flying", `took off: ${up}, over ${Math.round(over.x)},${Math.round(over.y)}, after E: ${after2}`);
      await fly(123 * 16 + 8, 21 * 16 + 8); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const l = await P.I(() => { const I2 = window.__island, s = I2.getState(), tx = Math.floor(s.pi.x / 16), ty = Math.floor(s.pi.y / 16); return { state: s.heli.state, heli: [Math.round(s.heli.x), Math.round(s.heli.y)], pi: [tx, ty], safe: I2.safe(tx, ty), clear: [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(s.pi.x + dx, s.pi.y + dy)) }; });
      check(name, "in flight: beside the yard, just south of it (123,21), it lands and pi hops out clear, on safe ground, outside the fence", l.state === "parked" && l.safe && l.clear && !inBox(...l.pi) && !P.errs.length, JSON.stringify(l) + (P.errs.length ? " errors " + P.errs.join("; ") : ""));
    } else check(name, "in flight", false, "didn't load");
    await P.ctx.close(); }

  // 2d. the fence on screen, against the terrain preview at the same spot, step and size (1280 x 560: scale 2, pi in the east lane
  // beside the yard's middle, the whole yard and the tiles round it in the frame). Over each fence tile the frame must differ; over
  // the open tiles touching it, outside and inside, it must not (no art over walkable ground)
  { const vp = { viewport: { width: 1280, height: 560 } }, A2 = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: vp }), B2 = await open(`http://127.0.0.1:${port}/${Q}`, { ctxOpts: vp });
    if (A2.loaded && B2.loaded) {
      for (const P of [A2, B2]) await settle(P, [129 * 16 + 8, 13 * 16 + 10]);
      { const ta = await A2.I(() => window.__island.getState().t), tb = await B2.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await B2.I((n) => window.__island.step(n), k); else if (k < 0) await A2.I((n) => window.__island.step(n), -k); }
      const isR = new Set(RING.map((q) => q.join())), NEAR = [];
      for (const [x, y] of RING) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = [x + dx, y + dy]; if (!isR.has(q.join()) && !NEAR.some((o) => o.join() === q.join()) && m.coll[q[1] * W + q[0]] === 0 && !(Math.abs(q[0] - 129) <= 1 && Math.abs(q[1] - 13) <= 2)) NEAR.push(q); }
      const grab = (P) => P.I(([ring, near]) => {
        const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const tile = ([x, y]) => { const x0 = Math.ceil((x * 16 - v.camera[0]) * E), y0 = Math.ceil((y * 16 - v.camera[1]) * E), x1 = Math.floor(((x + 1) * 16 - v.camera[0]) * E) - 1, y1 = Math.floor(((y + 1) * 16 - v.camera[1]) * E) - 1;
          if (x0 < 0 || y0 < 0 || x1 >= c.width || y1 >= c.height) return null; const o = []; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = (yy * c.width + xx) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; };
        const fa = I2.fenceArt("raptor-yard");
        return { cam: v.camera, ring: ring.map(tile), near: near.map(tile), at: fa ? fa.pieces.map((q) => q.at) : null };
      }, [RING, NEAR]);
      const a = await grab(A2), b = await grab(B2);
      const frac = (x, y) => { if (!x || !y || x.length !== y.length) return null; let dd = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) dd++; return dd / (x.length / 3); };
      const rf = RING.map((q, i) => frac(a.ring[i], b.ring[i])), nf = NEAR.map((q, i) => frac(a.near[i], b.near[i]));
      const sameCam = a.cam.join() === b.cam.join(), allIn = rf.every((v) => v !== null) && nf.every((v) => v !== null);
      const rMin = Math.min(...rf.filter((v) => v !== null)), rAll = rf.filter((v) => v !== null).reduce((x, y) => x + y, 0) / Math.max(1, rf.filter((v) => v !== null).length);
      const low = RING.filter((q, i) => rf[i] !== null && rf[i] < 0.95).map((q) => q.join());
      check(name, "fence on screen (1280 x 560, the whole yard in the frame): against the terrain preview's frame, the picture differs over every fence tile (each at least 95% of its pixels, 99.5% overall): the art is visible over every solid pixel",
        sameCam && allIn && rMin >= 0.95 && rAll >= 0.995, `camera ${sameCam ? "same" : "differs"}; per tile min ${(100 * rMin).toFixed(1)}%, mean ${(100 * rAll).toFixed(2)}%${low.length ? "; under 95%: " + low.join(" ") : ""}`);
      const nMax = Math.max(...nf.filter((v) => v !== null)), nHi = NEAR.filter((q, i) => nf[i] !== null && nf[i] > 0.02).map((q) => q.join());
      check(name, `the ${NEAR.length} open tiles touching the fence, outside and inside, look exactly as on the terrain preview (at most 2% of a tile's pixels differ: no art over walkable ground, no gap drawn shut)`, allIn && nMax <= 0.02,
        `max ${(100 * nMax).toFixed(2)}% differ${nHi.length ? " (over 2%: " + nHi.slice(0, 6).join(" ") + ")" : ""}`);
      check(name, "art: each of the 30 pieces was drawn at its own tile's origin (world px), and nowhere else", a.at && a.at.length === 30 && a.at.every((q, i) => q && q[0] === RING[i][0] * T && q[1] === RING[i][1] * T), a.at ? `${a.at.filter(Boolean).length} drawn` : "no fence");
    } else check(name, "fence on screen", false, "didn't load");
    await A2.ctx.close(); await B2.ctx.close(); }

  // 2e. phones (390 x 844 and 375 x 667, touch): from below the yard, a tap on the ground inside it never walks pi in
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}: the yard`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    await settle(P, tilePx(PLACE));
    const sc = await P.I(() => { const v = window.__island.preview(), E = v.ui.scale * v.zoom; return { sx: (123 * 16 + 8 - v.camera[0]) * E, sy: (15 * 16 + 8 - v.camera[1]) * E }; });
    await P.page.touchscreen.tap(sc.sx, sc.sy);
    const r = await P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 1500; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen }; });
    check(name, `phone ${vw} x ${vh}: from below the yard (123,19), a tap on the ground inside it (123,15) never walks pi in: pi stays outside, never on the fence`,
      sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh && !inBox(...r.at) && !r.seen.some(([x, y]) => inBox(x, y)) && !P.errs.length, `tap at ${sc.sx.toFixed(0)},${sc.sy.toFixed(0)}; pi ended ${r.at} via ${r.seen.join(" ")}${P.errs.length ? "; errors " + P.errs.join("; ") : ""}`);
    await P.ctx.close();
  }

  // 2f. reuse (real since B3d2): the holding paddock's fence beside the yard, drawn the same way, and the lane between the two
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      const v = await P.I(() => window.__island.preview()), ha = await P.I(() => { const a = window.__island.fenceArt("holding-paddock"); delete a.png; return a; });
      const kinds = v.fences.find((f) => f.id === "holding-paddock");
      check(name, "reuse (real since B3d2): the holding paddock's fence (its B1e outline, not a box) loads beside the yard's: 36 pieces, every one a full opaque 16 x 16 tile on its own tile, its corners and runs from the same renderer, closing its ground in",
        !P.errs.length && v.fences.length === 2 && kinds && kinds.tiles === 36 && kinds.encloses && ha.pieces.length === 36 && ha.pieces.every((q) => q.w === T && q.h === T && q.opaque === 256) && key(ha.pieces.map((q) => q.tile)) === key(HP_REC.tiles) && kinds.kinds.corner > 4,
        kinds ? JSON.stringify(kinds.kinds) : P.errs.join("; "));
      const r = await walk(P, tilePx([118, 9]), [118, 18]);
      check(name, "reuse (real since B3d2): pi walks the lane between the two fences (column 118, one tile wide at rows 12 to 15) from 118,9 to 118,18 on the update loop, never on either fence", r.plan !== null && r.at.join() === "118,18" && !onFence(r.seen, HPL).length && r.seen.every(([x]) => x === 118),
        r.plan === null ? "no path" : `a ${r.plan}-tile plan through ${r.seen.join(" ")}`);
      if (name !== "firefox") { await P.I(() => window.__island.play()); await P.I(() => window.__island.teleport(118 * 16 + 8, 13 * 16 + 10)); await P.page.waitForTimeout(1200); await P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; }); await shoot(P, `dev/${name}-holding-paddock.png`); }
    } else check(name, "reuse (real since B3d2)", false, "didn't load");
    await P.ctx.close(); }

  // 2g. performance: the fence's draw cost and the frame work walking round it on the live loop, beside the terrain preview; planning
  // round it; decoding
  if (tp.loaded) {
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.fenceMs, v.fenceDraws]; });
      await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[118, 9], "ArrowRight"], [[128, 9], "ArrowDown"], [[128, 18], "ArrowLeft"], [[118, 18], "ArrowUp"]]) {
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
    perf.push(`${name}: live frame work walking round the yard: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; one fence piece ${(per * 1000).toFixed(2)} us a draw (${lc ? lc.fn : 0} draws, ${lc ? lc.fms.toFixed(1) : 0} ms in all)`);
    check(name, "performance: walking round the yard on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const P2 = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P2.loaded) {
      const across = (P) => P.I(() => { const I2 = window.__island; I2.teleport(118 * 16 + 8, 13 * 16 + 10); let a = performance.now(); const n = I2.walkTo(129, 13, false); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(129, 13, false); const warm = (performance.now() - a) / 20; a = performance.now(); const n2 = I2.walkTo(123, 13, false); return [cold, warm, n, performance.now() - a, n2]; });
      const xc = await across(P2), xt = await across(tp);
      perf.push(`${name}: path planning across the yard (118,13 to 129,13; ms first / warm, tiles): content ${xc[0].toFixed(2)} / ${xc[1].toFixed(2)}, ${xc[2]} tiles; terrain preview ${xt[0].toFixed(2)} / ${xt[1].toFixed(2)}, ${xt[2]} tiles; a walk to the yard's middle: content ${xc[3].toFixed(2)} ms (${xc[4] === null ? "no path" : xc[4] + " tiles"}), terrain preview ${xt[3].toFixed(2)} ms`);
      /* a walk (a tap) to the closed-in middle, strict and loose, first and warm, from below the yard; and format 1's own raptor pen in
         production (65,34 from its viewing place 64,40), which has always been closed in the same way: what planning to ground that
         can't be reached costs */
      const toMiddle = (P, from, to) => P.I(([f, tt2]) => { const I2 = window.__island, o = {}; for (const lo of [false, true]) { I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); let a = performance.now(); const n = I2.walkTo(tt2[0], tt2[1], lo); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 10; i++) { I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); I2.walkTo(tt2[0], tt2[1], lo); } o[lo ? "loose" : "strict"] = [cold, (performance.now() - a) / 10, n]; } return o; }, [from, to]);
      const mc = await toMiddle(P2, PLACE, [123, 13]), PP = await open(`http://127.0.0.1:${port + 3}/${Q}`), mp = PP.loaded ? await toMiddle(PP, [64, 40], [65, 34]) : null; await PP.ctx.close();
      const mf = (o) => o ? ["strict", "loose"].map((k2) => `${k2} ${o[k2][0].toFixed(2)} / ${o[k2][1].toFixed(2)} ms (${o[k2][2] === null ? "no path" : o[k2][2] + " tiles"})`).join(", ") : "didn't load";
      perf.push(`${name}: a walk to the closed-in middle (first / warm): MAP-B yard (123,19 to 123,13) ${mf(mc)}; format 1's raptor pen in production (64,40 to 65,34) ${mf(mp)}`);
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
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.fencesUndrawn[1](WORLD) }); const a = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(123 * 16 + 8, 19 * 16 + 10); for (let i = 0; i < 10; i++) I2.step(1); return I2.fenceArt("raptor-yard").pieces.filter((q) => q.at).length; }) : null;
      caught(MUT.fencesUndrawn[0], a === 0, `${a} fence pieces drawn`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.fenceArtShort[1](WORLD) }); const a = P.loaded ? await P.I(() => window.__island.fenceArt("raptor-yard").pieces.filter((q) => q.h !== 16 || q.opaque !== 256).length) : null;
      caught(MUT.fenceArtShort[0], a > 0, `${a} pieces not a full opaque tile`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noFenceShape[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, FENCE_ID).drawnPxBoxes.push(pxOf({ x0: 123, y0: 18, x1: 123, y1: 18 })); })) : "didn't load";
      caught(MUT.noFenceShape[0], r === null, r === null ? "fence art over a walkable tile decoded" : r); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.fenceOpen[1](WORLD) }); const r = P.loaded ? await P.I(() => { const I2 = window.__island; return { walk: I2.tile(123, 17).walkable, safe: I2.safe(123, 13) }; }) : null;
      caught(MUT.fenceOpen[0], r && (r.walk || r.safe), r ? JSON.stringify(r) : "didn't load"); await P.ctx.close(); }
  }

  // 2i. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    const at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
    const hideDbg = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; });
    const wide = { viewport: { width: 1280, height: 560 } };
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: wide, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await at(P, 129, 13, 1500);
        await shoot(P, `${name}-enclosure-${tag === "day" ? "overhead" : "night"}.png`);
        if (tag === "day") {
          // the diagnostic overlay: what blocks (the game's own content collision, read tile by tile) over the art, the closed-in inside,
          // the safe ground round it, and the viewing place; its legend clear of the island's interface and left of the yard
          const clear = await P.I(([box, place]) => {
            const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
            c.id = "b3d1-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
            const g = c.getContext("2d"), X = (tx) => (tx * 16 - v.camera[0]) * E, Y = (ty) => (ty * 16 - v.camera[1]) * E, S = 16 * E; let solid = 0, closed = 0, safe = 0;
            for (let y = box.y0 - 1; y <= box.y1 + 1; y++) for (let x = box.x0 - 1; x <= box.x1 + 1; x++) {
              const q = I2.tile(x, y);
              if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.42)"; g.fillRect(X(x), Y(y), S, S); g.strokeStyle = "#ff4040"; g.lineWidth = 1; g.strokeRect(X(x) + 0.5, Y(y) + 0.5, S - 1, S - 1); }
              else if (q.walkable && !I2.safe(x, y)) { closed++; g.fillStyle = "rgba(77,150,255,.30)"; g.fillRect(X(x), Y(y), S, S); }
              else if (I2.safe(x, y)) { safe++; g.strokeStyle = "rgba(74,222,128,.9)"; g.lineWidth = 1; g.strokeRect(X(x) + 2.5, Y(y) + 2.5, S - 5, S - 5); }
            }
            g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(X(place[0]), Y(place[1]), S, S);
            cvs.parentElement.insertBefore(c, cvs.nextSibling);
            const L = document.createElement("div"); L.id = "b3d1-legend";
            L.textContent = `B3d1 diagnostic (test overlay)\nred: fence collision, read\n     from the game (${solid} tiles)\n     over the fence art\nblue: inside, closed in\n     (${closed} tiles, not safe)\ngreen: safe ground round it\nwhite: viewing place 123,19\nno openings`;
            Object.assign(L.style, { position: "absolute", left: "12px", top: "128px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "16px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
            document.body.appendChild(L);
            const lr = L.getBoundingClientRect(), hits = [];
            for (const el of cvs.parentElement.querySelectorAll("*")) {
              if (el === L || el === c || el === cvs || L.contains(el) || el.contains(L)) continue;
              const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none" || +st.opacity === 0) continue;
              const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
              if (r.left < lr.right && r.right > lr.left && r.top < lr.bottom && r.bottom > lr.top && (el.children.length === 0 || el.tagName === "CANVAS")) hits.push((el.className || el.tagName) + "");
            }
            return { rect: [lr.left, lr.top, lr.width, lr.height].map(Math.round), hits, yardLeft: Math.round(cvs.getBoundingClientRect().left + X(box.x0 - 1)), solid, closed, safe };
          }, [BOX, PLACE]);
          check(name, "diagnostic overlay (review screenshot only): the game's own collision shows exactly the 30 fence tiles and 42 closed-in tiles, every other tile round it safe; its legend is on screen, clear of the island's interface, left of the yard",
            clear.solid === 30 && clear.closed === 42 && clear.safe === 38 && clear.rect[0] >= 0 && clear.rect[1] >= 0 && clear.rect[0] + clear.rect[2] <= 1280 && clear.rect[1] + clear.rect[3] <= 560 && clear.hits.length === 0 && clear.rect[0] + clear.rect[2] < clear.yardLeft,
            `${clear.solid} solid, ${clear.closed} closed in, ${clear.safe} safe; legend at ${clear.rect}, the yard from x ${clear.yardLeft}; under it: ${clear.hits.join(", ") || "nothing"}`);
          await shoot(P, `${name}-enclosure-diagnostic.png`);
        }
      }
      await P.ctx.close();
    }
    // close-ups at 1280 x 800: each side and corner from outside, pi beside the fence, pi pushing into it
    const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { wait: 2600 });
    if (P.loaded) {
      await hideDbg(P);
      for (const [f, x, y] of [["side-north", 123, 8], ["side-south", 123, 19], ["side-west", 118, 13], ["side-east", 129, 13], ["corner-nw", 117, 9], ["corner-ne", 128, 9], ["corner-sw", 117, 19], ["corner-se", 129, 19], ["pi-beside", 121, 18]]) { await at(P, x, y); await shoot(P, `${name}-${f}.png`); }
      await at(P, 125, 19, 600); await P.page.keyboard.down("ArrowUp"); await P.page.waitForTimeout(1000);
      await shoot(P, `${name}-pi-push.png`); await P.page.keyboard.up("ArrowUp");
      await at(P, 129, 15, 600); await P.page.keyboard.down("ArrowLeft"); await P.page.keyboard.down("ArrowUp"); await P.page.waitForTimeout(1000);
      await shoot(P, `${name}-pi-push-east.png`); await P.page.keyboard.up("ArrowLeft"); await P.page.keyboard.up("ArrowUp");
    }
    await P.ctx.close();
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
      const Q2 = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (Q2.loaded) { await cardAway(Q2); await at(Q2, 123, 19, 1200); await shoot(Q2, `${name}-${tag}-yard.png`); }
      await Q2.ctx.close();
    }
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); plain.close();
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
