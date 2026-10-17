#!/usr/bin/env node
/* mapb-koi-gate (MAP-B B3d3): the koi garden's wall and the park gate, the last structures B3a planned for B3d.
   - The koi garden's wall: the record koi-garden, kind wall, the ring round the B1e compound koi-garden's box 103,54 to
     119,70 with exactly its seven gate tiles open (three openings: north 110 to 112,54; west 103,61 to 62; east 119,63 to
     64); on the east side the terrace's cliff rim (119,56 to 59) closes it (terrainTiles), so no wall stands there. 53
     solid tiles, each drawn, in a garden wall's look (not the outpost's sandbags).
   - The park gate: the record park-gate, kind gate, on the B1e marker park-gate (74,38), format 1's park gate: an arch over
     the main walk with two solid posts 2 tiles either side of it (72,38 and 76,38) and the road open between them (73 to
     75,38). Decorative, as format 1's is: nothing opens, closes or locks, and the ground either side of it stays open.
   Real content, served through the content preview (tools/mapb-preview.mjs --content); nothing synthetic is written anywhere.

   1. Node, the content and its compiler:
      - the tracked content file is the current compile: B3c's and B3d1-B3d2's six records exactly as they were (their
        compiled bytes pinned), then the two new ones; 275 solid tiles, no foot pixel;
      - the wall against B1e (the compound, its box and gates, the r2.1 study's "garden wall") and the terrain (the four rim
        tiles, every other edge tile open ground), tile by tile; its art one tile on each solid tile; closed and joined
        (wall, cliff and openings one loop), closed even to a diagonal step with its openings shut, every inside tile reached
        with them open; each opening straight through;
      - access: the koi garden's trails, the loop path, its route end, B3a's places by it (the pond, the macbook's stand and
        log site, the cats' roam box, the koi pavilion's reserve and front), every spot beside the koi pond's water, the koi
        bay overlook; no ground cut off anywhere;
      - the gate against B1e (the marker, the park-gate ramp, the main walk) and format 1 (its anchor and posts), its
        opening the road's three paved tiles, the road through it, the ground beside it;
      - malformed records, each caught by its rule (the new terrainTiles and gates rules, positive and negative).
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - both locked painter digests; the layers; the wall's pieces and the gate as the game builds them; their art;
      - collision pixel by pixel; tiles; pi pushed into the wall (and the cliff stretch) from every tile touching it, inside
        and outside, every direction that meets it, and into each gate post, on the real update loop;
      - every opening, keyboard straight through at every pixel across it; the gate likewise, across the road and beside it;
      - the planner into the garden, out of it, across it, to its access points, through the gate, round the posts; trapped
        ground; the three buildings' doors and rooms; the bunker compound and both paddocks as they were;
      - the helicopter (every 4 px, drifting descents, a real flight); phones (taps, the joystick); completeness; storage;
        decoder refusals; three code mutations (Chromium); performance;
      - review screenshots (not baselines) into tools/out/mapb/b3d3/, with a labelled diagnostic overlay the test draws over
        the page (never the game).

     node tools/mapb-koi-gate.mjs
     ENGINES=chromium node tools/mapb-koi-gate.mjs */
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
// its review screenshots go to tools/out/mapb/b3d3/; MAPB_SHOTS names another folder under tools/out/ (a later batch's regression run)
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3d3");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;
const PLAN = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-r21-plan.json"), "utf8")).plan;

/* the approved geometry, written out so a change anywhere shows */
const KOI = "koi-garden", GATE = "park-gate";
const BOX = { x0: 103, y0: 54, x1: 119, y1: 70 };
const GAPS = [[110, 54], [111, 54], [112, 54], [103, 61], [103, 62], [119, 63], [119, 64]];
const OPENINGS = { north: [[110, 54], [111, 54], [112, 54]], west: [[103, 61], [103, 62]], east: [[119, 63], [119, 64]] };
const TERR = [[119, 56], [119, 57], [119, 58], [119, 59]];               // the cliff rim the terrain closes the ring with
const CORNERS = [[103, 54], [119, 54], [103, 70], [119, 70]];
const POSTS = [[109, 54], [113, 54], [103, 60], [103, 63], [119, 62], [119, 65]];   // either side of each opening
const ENDS = [[119, 55], [119, 60]];                                      // where the wall stops at the cliff
const key = (l) => (l || []).map((p) => p.join()).sort().join(" ");
const S = (l) => new Set(l.map((p) => p.join()));
const inBox = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const EDGE = []; for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) if (x === BOX.x0 || x === BOX.x1 || y === BOX.y0 || y === BOX.y1) EDGE.push([x, y]);
const isGap = S(GAPS), isTerr = S(TERR);
const RING = EDGE.filter((p) => !isGap.has(p.join()) && !isTerr.has(p.join()));
const isRing = S(RING), isLine = S(EDGE);
const INSIDE = []; for (let y = BOX.y0 + 1; y < BOX.y1; y++) for (let x = BOX.x0 + 1; x < BOX.x1; x++) INSIDE.push([x, y]);
const isIn = S(INSIDE);
const PAVILION = { x0: 113, y0: 66, x1: 116, y1: 68 }, ROUTE_END = [108, 68], OVERLOOK = [120, 63], POND_PLACE = [110, 57], MAC = [105, 57], MAC_STAND = [105, 58], LOG_SITE = [106, 58], CATS = { x0: 105, y0: 56, x1: 117, y1: 68 };
// the park gate: the marker, format 1's posts 2 either side, the road between them, the ramp it stands at the foot of
const MARK = [74, 38], GPOSTS = [[72, 38], [76, 38]], GOPEN = [[73, 38], [74, 38], [75, 38]], RAMP = { x0: 71, y0: 34, x1: 77, y1: 39 }, GBOX = { px0: 72 * T, py0: 38 * T + T - 60, px1: 76 * T + T - 1, py1: 38 * T + T - 1 };
const GPLACE = [74, 40], GLAMP = [78, 38], JUNCTION = [73, 33];
const isGPost = S(GPOSTS);
const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]], N4 = N8.slice(0, 4);
const KEYS = { "0,-1": ["ArrowUp"], "1,0": ["ArrowRight"], "0,1": ["ArrowDown"], "-1,0": ["ArrowLeft"], "1,-1": ["ArrowRight", "ArrowUp"], "1,1": ["ArrowRight", "ArrowDown"], "-1,1": ["ArrowLeft", "ArrowDown"], "-1,-1": ["ArrowLeft", "ArrowUp"] };
const pxOf = (b) => ({ px0: b.x0 * T, py0: b.y0 * T, px1: b.x1 * T + T - 1, py1: b.y1 * T + T - 1 });

/* ════════ 1. Node: the records and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H), K = RECS.find((r) => r.id === KOI), G = RECS.find((r) => r.id === GATE);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// B3d2's six compiled records, as committed at 16b0e47 (the sha256 of their JSON, in order)
const SIX = "65125cd792117f2acb8ff68df9d767da18478a8c482356095784f9c1efd94413";
check("node", "the content: B3c's three buildings and compound wall, B3d1's raptor yard and B3d2's holding paddock exactly as committed (their compiled records byte for byte), then B3d3's koi garden wall and park gate; nothing else",
  RECS.map((r) => `${r.id}:${r.kind}`).join() === "visitor:building,depot:building,bunker:building,bunker-compound:wall,raptor-yard:fence,holding-paddock:fence,koi-garden:wall,park-gate:gate" && createHash("sha256").update(JSON.stringify(DATA.records.slice(0, 6))).digest("hex") === SIX,
  RECS.map((r) => r.id).join(", "));
check("node", "the content passes every rule: 275 solid tiles (220 before B3d3, then 53 of wall and 2 posts), no foot pixel", contentProblems(RECS, src, m).length === 0 && built.compiled.solidTiles === 275 && built.compiled.footPixels === 0, `${built.compiled.solidTiles} solid tiles, ${built.compiled.footPixels} foot pixels`);
const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
const pathId = (x, y) => { const k = m.pathOf[y * W + x]; return k >= 0 ? src.corridors.paths[k].id : null; };
{ // the wall against B1e and the study
  const c = src.reserves.compounds.find((q) => q.id === KOI), hab = src.habitats.find((q) => q.id === KOI), study = PLAN.walls.find((q) => q[2] === "garden wall");
  check("node", "B1e: the compound koi-garden is walled, its box 103,54 to 119,70 and its seven gate tiles exactly these (the r2.1 study's \"garden wall\", the same box and gates); the habitat koi-garden (a walled garden) and the koi pond lie inside it",
    c && c.walled === true && JSON.stringify(c.compoundBox) === JSON.stringify(BOX) && key(c.gateTiles) === key(GAPS) && study && study[0].join() === "103,54,119,70" && key(study[1]) === key(GAPS) && hab && hab.containment === "walled garden" && inBox(hab.habitatBox.x0, hab.habitatBox.y0, BOX) && inBox(hab.habitatBox.x1, hab.habitatBox.y1, BOX),
    c ? `${JSON.stringify(c.compoundBox)}, gates ${key(c.gateTiles)}; habitat ${hab && hab.containment} ${hab && JSON.stringify(hab.habitatBox)} (its label: ${hab && hab.planningLabels.join("; ")})` : "no compound");
  const pond = []; for (let i = 0; i < W * H; i++) if (m.water[i] === 0) pond.push([i % W, (i / W) | 0]);   // water body 0, koi-pond (m.waterIds)
  check("node", "the koi pond: B1e's koi-pond body, 52 tiles, every one inside the compound's box (one tile or more in from its edge)", pond.length === 52 && pond.every(([x, y]) => isIn.has(`${x},${y}`)), `${pond.length} tiles`);
  check("node", "wall: the record koi-garden is a wall round the compound's box (ringOfBox), walling in the compound koi-garden, with placeholder art; its openings exactly the seven gates; the four tiles of cliff rim listed as closed by the terrain; no door, reserve, foot box or enclosure",
    K && K.kind === "wall" && K.compound === KOI && K.art === "placeholder" && key(K.gapTiles) === key(GAPS) && key(K.terrainTiles) === key(TERR) && !K.doorTiles.length && !K.reserve && !K.encloses && !K.footPxBoxes.length,
    K ? JSON.stringify({ gaps: K.gapTiles, terrain: K.terrainTiles }) : "no record");
  check("node", "wall: its solid is the box's 64 edge tiles less the 7 gates and the 4 rim tiles: 53 (B3a's count), every one drawn with one box on its own tile and nothing else",
    K && EDGE.length === 64 && key(K.tiles) === key(RING) && RING.length === 53 && K.drawnPxBoxes.length === 53 && key(K.drawnPxBoxes.map((b) => [b.px0, b.py0, b.px1, b.py1])) === key(RING.map(([x, y]) => [x * T, y * T, x * T + T - 1, y * T + T - 1])),
    K ? `${K.tiles.length} tiles, ${K.drawnPxBoxes.length} boxes` : "");
  // the ground under it
  const rimOk = TERR.every(([x, y]) => m.coll[y * W + x] === 1 && m.why[y * W + x] === 1 && m.height[y * W + x] === 1 && m.coll[y * W + x + 1] === 0 && m.height[y * W + x + 1] === 0);
  const ringBad = RING.filter(([x, y]) => m.coll[y * W + x] !== 0 || m.height[y * W + x] !== 1 || foot(x, y) || pathId(x, y) || m.rampOf[y * W + x] >= 0);
  check("node", "terrain: the 4 rim tiles (119,56 to 59) are the meadow terrace's cliff rim, solid in the terrain (coll 1, why rim, level 1) with the koi bay's beach below them (level 0, open); every one of the 53 wall tiles is open level-1 ground: no terrain flag, no path, no ramp, no foot-blocking pixel",
    rimOk && ringBad.length === 0, `rim ${rimOk ? "as stated" : "NOT"}; ${ringBad.length} wall tiles not open ground${ringBad.length ? ": " + ringBad.slice(0, 6).join(" ") : ""}`);
  const gapInfo = GAPS.map(([x, y]) => `${x},${y} ${pathId(x, y) || "grass"}`);
  check("node", "openings: the 7 gate tiles are open level-1 ground with no foot-blocking pixel; the edge's 4 path tiles are all gates (110,54 and 111,54 the koi-north-gate trail, 103,61 the koi-west-gate trail, 119,63 the koi bay overlook trail)",
    GAPS.every(([x, y]) => m.coll[y * W + x] === 0 && m.height[y * W + x] === 1 && !foot(x, y)) && EDGE.filter(([x, y]) => pathId(x, y)).every((p) => isGap.has(p.join())) && pathId(110, 54) === "koi-north-gate" && pathId(111, 54) === "koi-north-gate" && pathId(103, 61) === "koi-west-gate" && pathId(119, 63) === "koi-bay-overlook",
    gapInfo.join("; "));
  // closed and joined: the wall, the cliff and the openings make one loop round the box
  const joins = EDGE.map(([x, y]) => N4.filter(([dx, dy]) => isLine.has(`${x + dx},${y + dy}`)).length);
  const kinds = RING.map(([x, y]) => { const n = isRing.has(`${x},${y - 1}`), s = isRing.has(`${x},${y + 1}`), e = isRing.has(`${x + 1},${y}`), w = isRing.has(`${x - 1},${y}`); return (n || s) && (e || w) ? "corner" : "line"; });
  check("node", "closed and joined: wall, cliff and openings are one loop of 64 tiles round the box (every tile joined to exactly two); the wall's own tiles meet at its 4 corners", joins.every((n) => n === 2) && kinds.filter((k) => k === "corner").length === 4 && CORNERS.every((p) => isRing.has(p.join())),
    `joins ${[...new Set(joins)].join("/")}`);
  // closed to a diagonal step with the openings shut; every inside tile reached with them open
  const walk0 = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.coll[y * W + x] === 0;
  const flood = (start, n8, blocked) => { const seen = new Set([start.join()]), q = [start]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of n8 ? N8 : N4) { const k = `${x + dx},${y + dy}`; if (seen.has(k) || !walk0(x + dx, y + dy) || blocked(x + dx, y + dy)) continue; seen.add(k); q.push([x + dx, y + dy]); } } return seen; };
  const shut = flood([108, 68], true, (x, y) => isRing.has(`${x},${y}`) || isGap.has(`${x},${y}`)), leak = [...shut].filter((k) => !isIn.has(k));
  const inWalk = INSIDE.filter(([x, y]) => walk0(x, y)), open4 = flood([79, 79], false, (x, y) => isRing.has(`${x},${y}`));
  check("node", `closed: with its openings shut, even stepping diagonally, the inside (from the route end 108,68) reaches nothing outside: ${shut.size} tiles; with them open, all ${inWalk.length} walkable inside tiles are reached from the spawn`,
    leak.length === 0 && shut.size === inWalk.length && inWalk.every(([x, y]) => open4.has(`${x},${y}`)), `${leak.length} leaks${leak.length ? ": " + leak.slice(0, 6).join(" ") : ""}; ${inWalk.filter(([x, y]) => open4.has(`${x},${y}`)).length} of ${inWalk.length} reached`);
}
const bfs = (from, block) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of N4) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
const SPAWN = m.anchors.spawnTile, before = bfs(SPAWN, (i) => m.coll[i] !== 0), after = bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1);
const R = (p) => after[p[1] * W + p[0]] >= 0, B4 = (p) => before[p[1] * W + p[0]];
const PASTB3D2 = (() => { const L2 = contentLayers(RECS.slice(0, 6), W, H); return bfs(SPAWN, (i) => m.coll[i] !== 0 || L2.tiles[i] === 1); })();
{
  // each opening straight through: from the tile outside to the tile inside, the steps the shortest walk takes
  const through = { north: [[111, 53], [111, 55]], west: [[102, 61], [104, 61]], east: [[120, 63], [118, 63]] };
  const tw = Object.entries(through).map(([k, [a, b]]) => { const d = bfs(a, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1); return [k, d[b[1] * W + b[0]]]; });
  const outIn = Object.entries(OPENINGS).every(([k, l]) => l.every(([x, y]) => { const o = k === "north" ? [x, y - 1] : k === "west" ? [x - 1, y] : [x + 1, y], i2 = k === "north" ? [x, y + 1] : k === "west" ? [x + 1, y] : [x - 1, y]; return R(o) && R(i2) && R([x, y]); }));
  check("node", "each opening is straight through: every gate tile, the tile outside it and the tile inside it are reached from the spawn; outside to inside is 2 steps at each (north 111,53 to 111,55, west 102,61 to 104,61, east 120,63 to 118,63)",
    outIn && tw.every(([, n]) => n === 2), tw.map(([k, n]) => `${k} ${n}`).join(", "));
  // trails, the loop, route ends, places
  // a path's walkable tiles (its raster also runs over a few tiles of water: the loop's 6 at the pond's south edge)
  const trailOf = (id) => { const k = src.corridors.paths.findIndex((p) => p.id === id), tl = []; for (let i = 0; i < W * H; i++) if (m.pathOf[i] === k && m.coll[i] === 0) tl.push([i % W, (i / W) | 0]); return tl; };
  const trails = ["koi-north-gate", "koi-west-gate", "koi-garden-loop", "koi-bay-overlook", "koi-headland-road"].map((id) => { const tl = trailOf(id); return { id, n: tl.length, bad: tl.filter((p) => !R(p) || LAYER.tiles[p[1] * W + p[0]]) }; });
  const ends = (src.corridors.routeEnds || []).filter((e) => !R(e.endTile));
  check("node", "trails: the koi garden's (its north and west gate trails, the loop round the pond, the bay overlook) and the koi-headland road past it are open and reached, every tile, none walled; all 17 route ends still reached",
    trails.every((q) => q.n > 0 && !q.bad.length) && ends.length === 0 && (src.corridors.routeEnds || []).length === 17, trails.map((q) => `${q.id} ${q.n}${q.bad.length ? " (" + q.bad.length + " blocked)" : ""}`).join("; ") + `; route ends cut off: ${ends.map((e) => e.id).join(", ") || "none"}`);
  const fronts = []; for (let x = PAVILION.x0; x <= PAVILION.x1; x++) fronts.push([x, PAVILION.y1 + 1]);
  let pavSolid = 0; for (let y = PAVILION.y0; y <= PAVILION.y1; y++) for (let x = PAVILION.x0; x <= PAVILION.x1; x++) pavSolid += LAYER.tiles[y * W + x];
  check("node", "access points: the route end koi-garden (108,68) and B3a's places in the garden (the goto place pond 110,57; the macbook's stand 105,58 below its tile 105,57; the log site 106,58) are open ground reached from the spawn; the koi pavilion's reserve (113,66 to 116,68) is unused, its front row (69) open and reached; the cats' roam box (105,56 to 117,68) lies wholly inside the wall",
    [ROUTE_END, POND_PLACE, MAC, MAC_STAND, LOG_SITE, ...fronts].every((p) => R(p) && !LAYER.tiles[p[1] * W + p[0]]) && pavSolid === 0 && inBox(CATS.x0, CATS.y0, { x0: 104, y0: 55, x1: 118, y1: 69 }) && inBox(CATS.x1, CATS.y1, { x0: 104, y0: 55, x1: 118, y1: 69 }),
    `spawn to the route end ${after[ROUTE_END[1] * W + ROUTE_END[0]]} steps (before B3d3 ${PASTB3D2[ROUTE_END[1] * W + ROUTE_END[0]]}, on the terrain alone ${B4(ROUTE_END)})`);
  perf.push(`node: walking distance from the spawn (tiles): the koi garden's route end ${after[ROUTE_END[1] * W + ROUTE_END[0]]} (before B3d3 ${PASTB3D2[ROUTE_END[1] * W + ROUTE_END[0]]}); the pond place ${after[POND_PLACE[1] * W + POND_PLACE[0]]} (${PASTB3D2[POND_PLACE[1] * W + POND_PLACE[0]]}); the overlook ${after[OVERLOOK[1] * W + OVERLOOK[0]]} (${PASTB3D2[OVERLOOK[1] * W + OVERLOOK[0]]}); the highland junction ${after[JUNCTION[1] * W + JUNCTION[0]]} (${PASTB3D2[JUNCTION[1] * W + JUNCTION[0]]})`);
  // the koi pond's edge: every open tile beside its water (format 1 offers "feed the koi" next to the pond's water)
  const edge = []; for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (m.coll[i] !== 0) continue; if (N4.some(([dx, dy]) => m.water[(y + dy) * W + x + dx] === 0)) edge.push([x, y]); }
  check("node", `the koi pond: all ${edge.length} open tiles beside its water (where format 1 offers feeding) are reached from the spawn, none solid, all inside the wall`,
    edge.length > 20 && edge.every((p) => R(p) && !LAYER.tiles[p[1] * W + p[0]] && isIn.has(p.join())), `${edge.filter((p) => R(p)).length} reached`);
  check("node", "the koi bay overlook (120,63, the r2.1 study's target, the overlook trail's end) is reached through the east opening and only through it: its only way in from the spawn crosses 119,63 or 119,64",
    R(OVERLOOK) && PLAN.targets["koi bay overlook"].join() === "120,63" && bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1 || i === 63 * W + 119 || i === 64 * W + 119)[63 * W + 120] < 0, `${after[63 * W + 120]} steps from the spawn`);
  // nothing cut off: what the spawn reached on the terrain alone it still reaches, but for content tiles and the two paddocks' insides
  const closed = new Set(RECS.filter((r) => r.encloses).flatMap((r) => r.inner.map(([x, y]) => y * W + x))), lost = [];
  for (let i = 0; i < W * H; i++) if (before[i] >= 0 && after[i] < 0 && !LAYER.tiles[i] && !closed.has(i)) lost.push(`${i % W},${(i / W) | 0}`);
  check("node", "no ground cut off: every tile the spawn reached on the terrain alone it still reaches, but for content tiles and the paddocks' closed-in insides (77, as before); the wall and the gate close nothing in", lost.length === 0 && closed.size === 77, `${lost.length} cut off${lost.length ? ": " + lost.slice(0, 6).join(" ") : ""}`);
}
{ // the gate against B1e, the study and format 1
  const mk = src.reserves.markers.find((q) => q.id === GATE);
  check("node", "B1e: the marker park-gate is 74,38 (the r2.1 study's gate anchor), the main walk's gate between the commons and the highland, at the foot of the park-gate ramp (71,34 to 77,39)",
    mk && mk.markerTile.join() === MARK.join() && PLAN.anchors.gate.join() === MARK.join() && JSON.stringify(src.elevation.ramps.find((q) => q.id === GATE).rampBox) === JSON.stringify(RAMP), mk ? `marker ${mk.markerTile}` : "no marker");
  const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); const F1 = c.window.ISLAND_MAPS.home;
  const v1 = F1.coll.values, coll1 = (x, y) => v1[parseInt(F1.coll.rows[y][x], 36)], g1 = (x, y) => parseInt(F1.ground[y][x], 36), a1 = F1.anchors.gate;
  check("node", "format 1: its park gate (anchor 48,33) has its posts 2 tiles either side (46,33 and 50,33) solid in its collision, the road open between them (47 to 49) and through it (48,32 and 48,34): what the gate keeps",
    a1.join() === "48,33" && coll1(46, 33) === 1 && coll1(50, 33) === 1 && [47, 48, 49].every((x) => coll1(x, 33) === 0) && coll1(48, 32) === 0 && coll1(48, 34) === 0 && g1(47, 33) === 4 && g1(48, 33) === 4, `posts ${coll1(46, 33)},${coll1(50, 33)}; between ${[47, 48, 49].map((x) => coll1(x, 33)).join(",")}; beside ${coll1(45, 33)},${coll1(51, 33)}`);
  check("node", "gate: the record park-gate is a gate on the marker park-gate, named for it, with placeholder art; its solid exactly its two posts 72,38 and 76,38 (the marker's x - 2 and x + 2, format 1's rule); its one drawn box from 72,38's west edge to 76,38's east edge, standing on their bottom edge, 60 px tall; no door, foot box, openings list or reserve",
    G && G.kind === "gate" && G.marker === GATE && G.art === "placeholder" && key(G.tiles) === key(GPOSTS) && G.drawnPxBoxes.length === 1 && JSON.stringify(G.drawnPxBoxes[0]) === JSON.stringify(GBOX) && !G.doorTiles.length && !G.footPxBoxes.length && !G.gapTiles && !G.reserve,
    G ? JSON.stringify({ tiles: G.tiles, box: G.drawnPxBoxes }) : "no record");
  const tiles = (l) => l.map(([x, y]) => `${x},${y} ${m.ground[y * W + x] === 4 ? "paved" : "grass"}${m.rampOf[y * W + x] >= 0 ? " (ramp)" : ""}${pathId(x, y) ? " " + pathId(x, y) : ""}`);
  check("node", "gate: both posts stand on open ground on the ramp's foot (level 1, no path, no foot-blocking pixel, inside the park-gate ramp's box); its opening is the main walk's three paved tiles (73 to 75,38); the road runs on through it (74,37 and 74,39 the main walk too)",
    GPOSTS.every(([x, y]) => m.coll[y * W + x] === 0 && m.height[y * W + x] === 1 && !pathId(x, y) && !foot(x, y) && inBox(x, y, RAMP)) && GOPEN.every(([x, y]) => m.coll[y * W + x] === 0 && pathId(x, y) === "main-walk" && !foot(x, y) && !LAYER.tiles[y * W + x]) && pathId(74, 37) === "main-walk" && pathId(74, 39) === "main-walk",
    `posts: ${tiles(GPOSTS).join("; ")}; opening: ${tiles(GOPEN).join("; ")}`);
  const beside = [[71, 38], [77, 38], [70, 38], [78, 38], [72, 37], [72, 39], [76, 37], [76, 39]];
  check("node", "gate: decorative, as format 1's: the ground either side of it stays open and reached (71,38 and 77,38 inside the ramp, 70,38 and 78,38 beyond it, and before and behind each post); B3a's lamp place 78,38 and the goto place 'gate' (74,40) clear",
    beside.every((p) => R(p) && !LAYER.tiles[p[1] * W + p[0]]) && R(GLAMP) && R(GPLACE), beside.filter((p) => !R(p)).join(" ") || "all open");
  const mw = (() => { const k = src.corridors.paths.findIndex((p) => p.id === "main-walk"), o = []; for (let i = 0; i < W * H; i++) if (m.pathOf[i] === k && m.coll[i] === 0) o.push([i % W, (i / W) | 0]); return o; })();
  check("node", `gate: the main walk (its ${mw.length} walkable tiles, the ferry pier to the highland junction) is open and reached every tile; the spawn to the highland junction is as far as before (${after[JUNCTION[1] * W + JUNCTION[0]]} steps): the posts are off the road`,
    mw.every((p) => R(p) && !LAYER.tiles[p[1] * W + p[0]]) && after[JUNCTION[1] * W + JUNCTION[0]] === PASTB3D2[JUNCTION[1] * W + JUNCTION[0]], `${mw.filter((p) => !R(p)).length} unreached`);
}
// malformed records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const KR = (o) => o.records.find((r) => r.id === KOI), GR = (o) => o.records.find((r) => r.id === GATE);
const KBAD = [
  ["the koi garden wall with no art", "walls", (o) => { delete KR(o).art; }],
  ["the rim tiles not listed (a wall built on the cliff)", "terrain", (o) => { delete KR(o).solid.ringOfBox.terrainTiles; }],
  ["one rim tile not listed (119,58)", "terrain", (o) => { KR(o).solid.ringOfBox.terrainTiles = TERR.filter((p) => p.join() !== "119,58"); }],
  ["an open wall tile listed as closed by the terrain (119,60)", "walls", (o) => { KR(o).solid.ringOfBox.terrainTiles.push([119, 60]); }],
  ["a tile listed as closed by the terrain that isn't on the ring (118,58)", "schema", (o) => { KR(o).solid.ringOfBox.terrainTiles.push([118, 58]); }],
  ["a tile listed as closed by the terrain and as an opening (119,63)", "schema", (o) => { KR(o).solid.ringOfBox.terrainTiles.push([119, 63]); }],
  ["the east opening left out", "walls", (o) => { const b = KR(o).solid.ringOfBox; b.gapTiles = b.gapTiles.filter((p) => p[0] !== 119); }],
  ["an extra opening (106,70)", "walls", (o) => { KR(o).solid.ringOfBox.gapTiles.push([106, 70]); }],
  ["the wall naming another compound (the bunker's)", "walls", (o) => { KR(o).compound = "bunker-compound"; }],
  ["the wall closed all round (no openings), closing the garden in", "walls", (o) => { KR(o).encloses = true; delete KR(o).solid.ringOfBox.gapTiles; }],
  ["the gate with no art", "gates", (o) => { delete GR(o).art; }],
  ["the gate on no marker", "gates", (o) => { delete GR(o).marker; }],
  ["the gate on a marker B1e doesn't have", "schema", (o) => { GR(o).marker = "north-gate"; }],
  ["a marker on a wall", "schema", (o) => { KR(o).marker = GATE; }],
  ["the gate named for something else than its marker", "gates", (o) => { GR(o).id = "main-gate"; }],
  ["the gate's posts one tile in (73,38 and 75,38)", "gates", (o) => { GR(o).solid.tiles = [[73, 38], [75, 38]]; }],
  ["a third post (the road blocked at 74,38)", "gates", (o) => { GR(o).solid.tiles.push([74, 38]); }],
  ["the gate's posts as a box", "gates", (o) => { GR(o).solid = { tileBoxes: [{ x0: 72, y0: 38, x1: 72, y1: 38 }, { x0: 76, y0: 38, x1: 76, y1: 38 }] }; }],
  ["a foot box on the gate", "gates", (o) => { GR(o).solid.footPxBoxes = [{ px0: 74 * T + 2, py0: 38 * T + 2, px1: 74 * T + 5, py1: 38 * T + 5 }]; }],
  ["the gate's art wider than its posts", "gates", (o) => { GR(o).drawnPxBoxes[0].px1 += 16; }],
  ["the gate's art below its posts", "gates", (o) => { GR(o).drawnPxBoxes[0].py1 += 4; }],
  ["the gate's art short of its posts' top (collision outside the art)", "drawn", (o) => { GR(o).drawnPxBoxes[0].py0 = 38 * T + 4; }],
  ["a door on the gate", "gates", (o) => { GR(o).doorTiles = [[74, 39]]; }],
  ["something solid in the gate's opening (a crate on 74,38)", "gates", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 74, y0: 38, x1: 74, y1: 38 })], solid: { tiles: [[74, 38]] } }); }],
  ["something solid on the road behind it (74,37)", "gates", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 74, y0: 37, x1: 74, y1: 37 })], solid: { tiles: [[74, 37]] } }); }],
  ["a second gate on the same marker", "schema", (o) => { o.records.push(copy(GR(o))); }]
];
for (const [label, rule, fn] of KBAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => q[0]) : []; }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed: ${label} is caught by rule ${rule}`, caught.includes(rule), caught.join(", ") || "NOT caught");
}
{ // allowed by the format: a gate on another B1e marker whose ground fits (the research gate, 101,29) passes every rule (B3d3 builds only the park gate)
  let p = null; try { p = contentProblems(resolveContent(realWith((o) => { o.records.push({ id: "research-gate", kind: "gate", marker: "research-gate", art: "placeholder", drawnPxBoxes: [{ px0: 99 * T, py0: 29 * T + T - 60, px1: 103 * T + T - 1, py1: 29 * T + T - 1 }], solid: { tiles: [[99, 29], [103, 29]] } }); }), src, m), src, m); } catch (e) { p = [[e.rule, e.message]]; }
  check("node", "the format allows a gate on any B1e marker with room for it: a synthetic one on the research gate (101,29) passes every rule (none is built: B3d3 builds the park gate alone)", p && p.length === 0, p && p.length ? p.map((q) => q.join(": ")).join("; ") : "");
}
const PUSHES = [];
// pi walked into the wall: from every walkable tile touching it, inside and outside, every direction whose next tile is wall (or, from
// inside, the cliff that closes it)
for (const [from, list] of [["inside", INSIDE], ["outside", []]]) for (const [x, y] of list) {
  if (m.coll[y * W + x] !== 0) continue;
  for (const [dx, dy] of N8) { const k = `${x + dx},${y + dy}`; if (isRing.has(k) || isTerr.has(k)) PUSHES.push({ what: "wall", from, at: [x, y], d: [dx, dy], hit: [x + dx, y + dy] }); }
}
{ const seen = new Set(); for (const [rx, ry] of RING) for (const [dx, dy] of N8) { const x = rx + dx, y = ry + dy, k = `${x},${y}`; if (inBox(x, y, BOX) || seen.has(k) || m.coll[y * W + x] !== 0) continue; seen.add(k);
  for (const [ex, ey] of N8) if (isRing.has(`${x + ex},${y + ey}`)) PUSHES.push({ what: "wall", from: "outside", at: [x, y], d: [ex, ey], hit: [x + ex, y + ey] }); } }
for (const [px, py] of GPOSTS) for (const [dx, dy] of N8) { const x = px - dx, y = py - dy; if (m.coll[y * W + x] === 0 && !isGPost.has(`${x},${y}`)) PUSHES.push({ what: "gate", from: "beside", at: [x, y], d: [dx, dy], hit: [px, py] }); }
check("node", "B3d3's own test geometry: pushes into the wall from inside (into every wall tile and rim tile that faces it) and outside (every wall tile with open ground beside it), and into each gate post from all 8 sides",
  PUSHES.filter((p) => p.what === "wall" && p.from === "inside").length > 150 && PUSHES.filter((p) => p.what === "gate").length === 16,
  `${PUSHES.filter((p) => p.from === "inside").length} from inside, ${PUSHES.filter((p) => p.from === "outside").length} from outside, ${PUSHES.filter((p) => p.what === "gate").length} at the gate's posts`);

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const moveTerr = (c, x, y) => { const r = DR(c, KOI); r.tiles = r.tiles.filter((p) => !(p[0] === x && p[1] === y)); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === x * T && b.py0 === y * T)); r.terrainTiles.push([x, y]); c.solidTiles--; };
const REFUSE = [
  ["the koi garden wall with no art", (c) => { delete DR(c, KOI).art; }, /^content record koi-garden is a wall with no art/],
  ["the rim tiles dropped (the wall's line has two loose ends at the cliff)", (c) => { delete DR(c, KOI).terrainTiles; }, /don't close round: 119,(55|60) joins 1/],
  ["an open wall tile listed as closed by the terrain (119,60, its wall taken off)", (c) => moveTerr(c, 119, 60), /119,60 is listed as closed by the terrain, but the terrain there isn't solid land \(a foot could cross it\)/],
  ["a rim tile that is a wall tile too", (c) => { DR(c, KOI).terrainTiles.push([119, 55]); }, /119,55 is closed by the terrain and is one of its own solid tiles too/],
  ["a rim tile that is an opening too", (c) => { DR(c, KOI).terrainTiles.push([119, 63]); }, /119,63 is closed by the terrain and is one of its openings too/],
  ["tiles closed by the terrain on a fence", (c) => { DR(c, "raptor-yard").terrainTiles = [[118, 10]]; }, /^content record raptor-yard\.terrainTiles: only a wall's ring is closed by the terrain$/],
  ["the gate with no art", (c) => { delete DR(c, GATE).art; }, /^content record park-gate is a gate with no art/],
  ["the gate on no marker", (c) => { delete DR(c, GATE).marker; }, /^content record park-gate is a gate, so it stands on a marker and is named for it/],
  ["a marker on a wall", (c) => { DR(c, KOI).marker = GATE; }, /^content record koi-garden\.marker "park-gate": only a gate stands on a marker$/],
  ["the gate's posts 2 apart", (c) => { DR(c, GATE).tiles = [[73, 38], [75, 38]]; DR(c, GATE).drawnPxBoxes[0].px0 = 73 * T; DR(c, GATE).drawnPxBoxes[0].px1 = 75 * T + T - 1; }, /a gate's solid is its two posts, two tiles in one row with three between them/],
  ["a third post", (c) => { DR(c, GATE).tiles.push([74, 38]); c.solidTiles++; }, /a gate's solid is its two posts/],
  ["the gate's posts in two rows", (c) => { DR(c, GATE).tiles[1] = [76, 37]; }, /a gate's solid is its two posts/],
  ["the gate's art wider than its posts", (c) => { DR(c, GATE).drawnPxBoxes[0].px1 += 16; }, /its placeholder art is one box from its west post's west edge to its east post's east edge/],
  ["the gate's art below its posts", (c) => { DR(c, GATE).drawnPxBoxes[0].py1 += 4; }, /its placeholder art is one box from its west post's west edge/],
  ["the gate's art short of its posts (collision outside it)", (c) => { DR(c, GATE).drawnPxBoxes[0].py0 = 38 * T + 4; }, /is solid outside what it draws .*no invisible collision/],
  ["a foot box on the gate", (c) => { DR(c, GATE).footPxBoxes = [{ px0: 74 * T + 2, py0: 38 * T + 2, px1: 74 * T + 5, py1: 38 * T + 5 }]; c.footPixels += 16; }, /is a gate: its posts block whole tiles/],
  ["openings listed on the gate", (c) => { DR(c, GATE).gapTiles = [[74, 38]]; }, /is a gate: its posts block whole tiles, and it has no foot box, door, opening list/],
  ["something solid in the gate's opening", (c) => { c.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 74, y0: 38, x1: 74, y1: 38 })], tiles: [[74, 38]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; }, /^content record park-gate: its opening at 74,38 isn't open ground \(solid content\)$/],
  ["something solid on the road behind it", (c) => { c.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 74, y0: 37, x1: 74, y1: 37 })], tiles: [[74, 37]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; }, /^content record park-gate: the road behind it at 74,37 isn't open ground \(solid content\)$/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  gateUndrawn: ["the gate left out of the scene (its posts' collision with no art)", (s) => s.replace("GATES.forEach(function (gt) { if (gt.x >= x0 - 6", "GATES.forEach(function (gt) { if (false && gt.x >= x0 - 6")],
  gateOpen: ["the gate's posts left out of the content collision (art with no collision)", (s) => s.replace("owner[i] = r.id; cc[i] = C_SOLID; nT++;", "owner[i] = r.id; if (r.kind !== \"gate\") cc[i] = C_SOLID; nT++;")],
  cliffIgnored: ["the decoder's check that a wall's terrain tiles are solid land removed", (s) => s.replace("if (D.coll[i] !== C_SOLID) bad(f + \": \" + p + \" is listed as closed by the terrain", "if (false) bad(f + \": \" + p + \" is listed as closed by the terrain")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlays and their legends are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3d3-(overlay|legend)/.test(WORLD));

const port = 9680 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11#island";
const onWall = (seen) => seen.filter(([x, y]) => isRing.has(`${x},${y}`) || isTerr.has(`${x},${y}`));
const onPost = (seen) => seen.filter((q) => isGPost.has(q.join()));
const onSolid = (seen) => seen.filter(([x, y]) => LAYER.tiles[y * W + x] || m.coll[y * W + x] !== 0);
const inside = ([x, y]) => isIn.has(`${x},${y}`);

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
  // held keys on the update loop (as in tools/mapb-paddock.mjs): pi put at a spot (the tile's middle, or the nearest spot in it where
  // its feet are clear), the keys held for n frames; every tile it stands on, and any frame its feet touch a solid pixel
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 2a. the terrain preview and production: neither has the wall or the content gate
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => window.__island.preview()) : null;
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;
  check(name, "terrain preview: no content, no wall, no gate; both locked painter digests", tp.loaded && !tp.errs.length && tv.previewMode === "terrain" && tv.content === null && tv.walls.length === 0 && tv.gates.length === 0 && tDig.td === TERRAIN_SHA && tDig.gd === GROUND_SHA,
    tv ? `walls ${tv.walls.length}, gates ${tv.gates.length}, terrain ${tDig.td.slice(0, 12)}, ground ${tDig.gd.slice(0, 12)}` : tp.errs.join("; "));
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`); const v = P.loaded ? await P.I(() => window.__island.preview()) : null;
    check(name, "production: format 1, 100 x 80, no preview, no content: no MAP-B wall or gate (format 1's own park gate, the anchor gate, draws as before; map-parity checks it)", P.loaded && !P.errs.length && v.format === 1 && v.w === 100 && v.h === 80 && v.previewMode === null && v.content === null && v.walls.length === 0 && v.gates.length === 0 && v.systems.gate === true && !v.saveLocked,
      v ? `format ${v.format}, ${v.w} x ${v.h}, walls ${v.walls.length}, gates ${v.gates.length}, format 1's gate ${v.systems.gate}` : P.errs.join("; ")); await P.ctx.close(); }

  // 2b. the content preview
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const sortK = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k2) => [k2, o[k2]]));
  const kv = cv && cv.walls.find((q) => q.id === KOI), gv = cv && cv.gates.find((q) => q.id === GATE);
  check(name, "content preview: loads with the eight records (275 solid tiles), only the buildings system on; the koi garden's wall as its record says: 53 tiles, its 7 gates as openings, the 4 rim tiles closing it, the garden look; 32 runs, 9 piers, 4 corners, 6 posts (either side of each opening) and 2 ends (at the cliff)",
    cp.loaded && !cp.errs.length && cv.content.records === 8 && cv.content.solidTiles === 275 && cv.sys.buildings === true && kv && kv.compound === KOI && kv.tiles === 53 && key(kv.gaps) === key(GAPS) && key(kv.terrain) === key(TERR) && kv.look === "garden" && sortK(kv.kinds) === sortK({ corner: 4, run: 32, pier: 9, post: 6, end: 2 }),
    kv ? JSON.stringify({ kinds: kv.kinds, look: kv.look }) : cp.errs.join("; "));
  check(name, "content preview: the park gate as its record says (on the marker 74,38, posts 72,38 and 76,38, its opening 73 to 75,38, its box), alone; format 1's anchor gate isn't there (systems.gate false)",
    cv && cv.gates.length === 1 && gv && gv.marker === GATE && gv.at.join() === "74,38" && key(gv.posts) === key(GPOSTS) && key(gv.opening) === key(GOPEN) && gv.box.join() === [GBOX.px0, GBOX.py0, GBOX.px1, GBOX.py1].join() && cv.systems.gate === false,
    gv ? JSON.stringify(gv) : "");
  check(name, "content preview: B3c's buildings and compound wall, and both paddock fences, exactly as before (the compound's 53 tiles, 40 runs, 7 piers, 4 corners, 2 posts, sandbags; the yard's 30 and the paddock's 36, both closing their insides in)",
    cv && cv.buildings.map((b) => b.id).join() === "visitor,depot,bunker" && cv.walls[0].id === "bunker-compound" && cv.walls[0].tiles === 53 && sortK(cv.walls[0].kinds) === sortK({ corner: 4, run: 40, pier: 7, post: 2 }) && cv.walls[0].look === "sandbags" && !cv.walls[0].terrain.length &&
      cv.fences.map((f) => `${f.id}:${f.tiles}:${f.encloses}:${f.gaps.length}`).join() === "raptor-yard:30:true:0,holding-paddock:36:true:0", cv ? `${cv.walls.map((q) => q.id).join(", ")}; ${cv.fences.map((f) => f.id + " " + f.tiles).join(", ")}` : "");
  if (cp.loaded) {
    await cp.I(() => { const I2 = window.__island; I2.teleport(111 * 16 + 8, 66 * 16 + 10); I2.step(4); I2.teleport(74 * 16 + 8, 40 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, the wall and the gate drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview (both are drawn in the object layer, never the ground)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the compiler's (275 tiles: the wall's 53 and the gate's 2 among them, nothing on the rim tiles, the openings or between the posts), kept apart from the terrain's (the compiler's, untouched); gameplay is their union",
      lay && RING.every(([x, y]) => L.k[y * W + x] !== 0) && GPOSTS.every(([x, y]) => L.k[y * W + x] !== 0) && TERR.concat(GAPS, GOPEN).every(([x, y]) => L.k[y * W + x] === 0) && TERR.every(([x, y]) => L.t[y * W + x] === 1));
    // the art
    const art = await cp.I((id) => { const a = window.__island.wallArt(id); delete a.png; return a; }, KOI);
    const kindAt = (x, y) => (art.pieces.find((q) => q.tile[0] === x && q.tile[1] === y) || {}).kind;
    check(name, "wall art: one piece on each of the 53 wall tiles, each 16 x 16 with all 256 pixels fully opaque; the corners are corner blocks, the tiles either side of each opening its gateposts, the tiles beside the cliff its ends",
      art.pieces.length === 53 && art.pieces.every((q) => q.w === T && q.h === T && q.opaque === 256) && RING.every(([x, y]) => kindAt(x, y)) && CORNERS.every(([x, y]) => kindAt(x, y) === "corner") && POSTS.every(([x, y]) => kindAt(x, y) === "post") && ENDS.every(([x, y]) => kindAt(x, y) === "end"),
      `${art.pieces.length} pieces, ${art.pieces.filter((q) => q.opaque === 256).length} fully opaque, ${new Set(art.pieces.map((q) => q.sig.split(":").slice(1).join(":"))).size} kinds of piece`);
    const ga = await cp.I((id) => { const a = window.__island.gateArt(id); delete a.png; return a; }, GATE);
    check(name, "gate art: 80 x 60 px (its box); both posts' tiles covered by it opaquely, all 256 pixels each (each post as wide as its tile); nothing of it drawn on the three tiles of the opening (open down to the road)",
      ga && ga.w === 80 && ga.h === 60 && ga.posts.every((q) => q.opaque === 256) && ga.opening.every((q) => q.drawn === 0), ga ? JSON.stringify({ posts: ga.posts.map((q) => q.opaque), opening: ga.opening.map((q) => q.drawn) }) : "none");
    // collision, pixel by pixel
    const pc = await cp.I(([ring, terr, gaps, posts, gopen]) => {
      const I2 = window.__island, all = (l, fn) => { let n = 0, bad = 0; for (const [x, y] of l) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) { n++; if (!fn(px, py)) bad++; } return [n, bad]; };
      const isR = new Set(ring.concat(posts).map((p) => p.join())); let rim = 0, rimBad = 0;
      for (const [x, y] of ring.concat(posts)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (isR.has(nx + "," + ny)) continue;
        for (let k = 0; k < 16; k++) { const px = dx ? (dx > 0 ? nx * 16 : nx * 16 + 15) : x * 16 + k, py = dy ? (dy > 0 ? ny * 16 : ny * 16 + 15) : y * 16 + k; rim++; if (I2.blocked(px, py) !== I2.terrainBlocked(px, py)) rimBad++; }
      }
      const tiles = (l, want) => l.filter(([x, y]) => { const q = I2.tile(x, y); return want === "solid" ? (q.walkable || !q.content || I2.safe(x, y)) : (!q.walkable || q.content || !I2.safe(x, y)); }).map((p) => p.join());
      return { wall: all(ring, (px, py) => I2.blocked(px, py) && !I2.terrainBlocked(px, py)), posts: all(posts, (px, py) => I2.blocked(px, py) && !I2.terrainBlocked(px, py)), terr: all(terr, (px, py) => I2.blocked(px, py) && I2.terrainBlocked(px, py)),
        gaps: all(gaps, (px, py) => !I2.blocked(px, py)), gopen: all(gopen, (px, py) => !I2.blocked(px, py)), rim, rimBad, solidTiles: tiles(ring.concat(posts), "solid"), openTiles: tiles(gaps.concat(gopen), "open") };
    }, [RING, TERR, GAPS, GPOSTS, GOPEN]);
    check(name, `collision: all ${pc.wall[0]} pixels of the wall's 53 tiles and all ${pc.posts[0]} of the gate's posts block feet, by the content alone; the rim's ${pc.terr[0]} block by the terrain; none of the openings' ${pc.gaps[0]} or the gate's opening's ${pc.gopen[0]} does; the ${pc.rim} pixels touching wall and posts from any side answer exactly as the terrain does`,
      pc.wall[1] === 0 && pc.posts[1] === 0 && pc.terr[1] === 0 && pc.gaps[1] === 0 && pc.gopen[1] === 0 && pc.rimBad === 0, JSON.stringify({ wall: pc.wall[1], posts: pc.posts[1], terr: pc.terr[1], gaps: pc.gaps[1], gopen: pc.gopen[1], rimBad: pc.rimBad }));
    check(name, "tiles: the wall's and the posts' are content, not walkable, not safe ground; the 7 openings and the gate's 3 opening tiles are walkable, no content, safe ground", pc.solidTiles.length === 0 && pc.openTiles.length === 0, JSON.stringify({ solid: pc.solidTiles, open: pc.openTiles }));

    // pushes: pi walked into the wall (and the cliff stretch) and into each post on the real update loop, every direction that meets it
    const res = [];
    for (const p of PUSHES) {
      const r = await hold(cp, KEYS[p.d.join()], tilePx(p.at), 120);
      if (!r) { res.push({ p, bad: 1, crossed: ["no clear start"], gap: null }); continue; }
      // crossing: from inside, any tile outside the box reached without going through an opening first; from outside, any inside tile reached
      // that way; on a wall, rim or post tile at all
      let viaGap = false; const crossed = [];
      for (const q of r.tiles) { const k = q.join(); if (isGap.has(k)) viaGap = true; if (isRing.has(k) || isTerr.has(k) || isGPost.has(k)) crossed.push(k); else if (p.what === "wall" && !viaGap && (p.from === "inside" ? !isIn.has(k) : isIn.has(k))) crossed.push(k); }
      let gap = null;
      if (!p.d[0] || !p.d[1]) { const [hx, hy] = p.hit; gap = p.d[1] > 0 ? hy * T - (r.y + 1) : p.d[1] < 0 ? (r.y - 2) - (hy * T + T - 1) : p.d[0] > 0 ? hx * T - (r.x + 4) : (r.x - 4) - (hx * T + T - 1); }
      res.push({ p, bad: r.bad, crossed, gap, end: [Math.floor(r.x / T), Math.floor(r.y / T)] });
    }
    for (const [what, from] of [["wall", "inside"], ["wall", "outside"], ["gate", "beside"]]) {
      const mine = res.filter((q) => q.p.what === what && q.p.from === from), straight = mine.filter((q) => q.gap !== null), diag = mine.filter((q) => q.gap === null);
      const badS = straight.filter((q) => q.bad || q.crossed.length || !(q.gap > 0 && q.gap <= 3)), badD = diag.filter((q) => q.bad || q.crossed.length);
      const lab = what === "gate" ? "the gate's posts from every side" : `the wall from ${from}${from === "inside" ? " (the cliff stretch too)" : ""}`;
      check(name, `pushes: pi walked straight into ${lab} (${straight.length} pushes) stops flush against it (feet within 3 px), never on a solid pixel, never across`, straight.length > 0 && badS.length === 0,
        badS.length ? badS.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: gap ${q.gap === null ? "-" : q.gap.toFixed(2)}${q.bad ? ", feet on solid " + q.bad : ""}${q.crossed.length ? ", CROSSED " + q.crossed.join(" ") : ""}`).join("; ") : `gaps ${Math.min(...straight.map((q) => q.gap)).toFixed(2)} to ${Math.max(...straight.map((q) => q.gap)).toFixed(2)} px`);
      check(name, `pushes: pi walked diagonally into ${lab} (${diag.length} pushes${what === "wall" ? ", every corner among them" : ""}) slides or stops: never through a corner, feet never on a solid pixel, never across`, diag.length > 0 && badD.length === 0,
        badD.length ? badD.slice(0, 4).map((q) => `${q.p.at} going ${q.p.d}: ended ${q.end}${q.bad ? ", feet on solid " + q.bad : ""}${q.crossed.length ? ", CROSSED " + q.crossed.join(" ") : ""}`).join("; ") : `${diag.length} pushes, none through`);
    }
    notes.push(`${name}: ${res.length} pushes on the update loop: ${res.filter((q) => q.p.what === "wall" && q.p.from === "inside").length} into the wall and cliff from inside, ${res.filter((q) => q.p.from === "outside").length} from outside, ${res.filter((q) => q.p.what === "gate").length} into the gate's posts`);

    // every opening, straight through on the keyboard at every whole pixel across it: through where pi's feet fit (9 px wide, 4 tall)
    const scans = [];
    for (const [nm, tiles, k, from, axis] of [["north", OPENINGS.north, "ArrowDown", 52, "x"], ["west", OPENINGS.west, "ArrowRight", 101, "y"], ["east", OPENINGS.east, "ArrowLeft", 120, "y"]]) {
      const lo = axis === "x" ? tiles[0][0] * T : tiles[0][1] * T, hi = axis === "x" ? tiles[tiles.length - 1][0] * T + T - 1 : tiles[tiles.length - 1][1] * T + T - 1;
      const wantLo = axis === "x" ? lo + 4 : lo + 2, wantHi = axis === "x" ? hi - 4 : hi - 1, through = [], stopped = [], cant = []; let bad = 0, onW = 0;
      for (let v = lo - 6; v <= hi + 6; v++) {
        const at = axis === "x" ? [v, from * T + 10] : [from * T + 8, v];
        // a start where pi's feet can't stand (the cliff rim beside the east opening's approach) is skipped, and counted
        if (!(await cp.I(([a, b]) => [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !window.__island.blocked(a + dx, b + dy)), at))) { cant.push(v); continue; }
        const r = await hold(cp, [k], at, 150, true); if (!r) { stopped.push(v); continue; }
        bad += r.bad; onW += onWall(r.tiles).length;
        if (r.tiles.some(inside)) through.push(v); else stopped.push(v);
      }
      scans.push({ nm, through, stopped, cant, bad, onW, want: [wantLo, wantHi], ok: through.length === wantHi - wantLo + 1 && through[0] === wantLo && through[through.length - 1] === wantHi && bad === 0 && onW === 0 && cant.every((v) => v < wantLo || v > wantHi) });
    }
    check(name, "openings, keyboard: going straight in at every whole pixel across each opening (and 6 px beyond each side, wherever pi can stand to start), pi gets in exactly where its feet fit between the gateposts (north: its middle x 1764 to 1803, 40 px; west and east: its middle's y 978 to 1006 and 1010 to 1038, 29 px), never a foot on solid, never on the wall",
      scans.every((s) => s.ok), scans.map((s) => `${s.nm}: in at ${s.through.length ? s.through[0] + " to " + s.through[s.through.length - 1] : "none"} (want ${s.want.join(" to ")}), stopped at ${s.stopped.length}, ${s.cant.length} starts on the rim skipped, ${s.bad} solid, ${s.onW} on the wall`).join("; "));
    notes.push(`${name}: openings, keyboard: ${scans.map((s) => `${s.nm} in at ${s.through.length} positions (${s.through[0]} to ${s.through[s.through.length - 1]})`).join("; ")}`);
    // the gate, keyboard: up the main walk at every pixel across the road and past each post: through between the posts and beside them
    // (the same scan on the terrain preview, where the ramp's own edges stop pi too: the posts must add exactly the pixels where pi's feet
    // meet one, stopped flush below it)
    { const scanUp = async (P) => { const o = new Map(); let bad = 0, onP = 0; for (let x = 70 * T; x <= 78 * T + 15; x++) { const r = await hold(P, ["ArrowUp"], [x, 40 * T + 10], 150, true); if (!r) continue; bad += r.bad; onP += onPost(r.tiles).length; o.set(x, r.y < 36 * T ? "through" : [Math.floor(r.y / T), r.y]); } return { o, bad, onP }; };
      const sc = await scanUp(cp), st = tp.loaded ? await scanUp(tp) : null;
      const hitsPost = (x) => (x + 4 >= 72 * T && x - 4 <= 72 * T + 15) || (x + 4 >= 76 * T && x - 4 <= 76 * T + 15);
      const diff = [], flushBad = []; let opening = 0;
      for (const [x, v] of sc.o) { const tv2 = st && st.o.get(x); if (hitsPost(x)) { if (!(Array.isArray(v) && v[0] === 39 && (v[1] - 2) - (38 * T + 15) > 0 && (v[1] - 2) - (38 * T + 15) <= 3)) flushBad.push(x); } else if (JSON.stringify(v) !== JSON.stringify(tv2)) diff.push(x); if (v === "through" && x >= 73 * T + 4 && x <= 75 * T + 11) opening++; }
      const tThrough = st ? [...st.o.values()].filter((v) => v === "through").length : 0, cThrough = [...sc.o.values()].filter((v) => v === "through").length;
      check(name, "the gate, keyboard: going straight up the road at every whole pixel from x 1120 to 1263 (from 70,40), wherever pi's feet meet a post it stops flush below it (row 39, within 3 px); everywhere else it goes exactly as on the terrain preview: through the opening at all 40 px of its middle's width (x 1172 to 1211), and beside the posts as far as the ramp's own edges let it; never a foot on solid, never on a post",
        st && diff.length === 0 && flushBad.length === 0 && opening === 40 && sc.bad === 0 && sc.onP === 0, `through at ${cThrough} px (terrain preview ${tThrough}); the opening ${opening} of 40; stopped by a post at ${[...sc.o.keys()].filter(hitsPost).length} px, ${flushBad.length} not flush; ${diff.length} differ from the terrain preview elsewhere${diff.length ? " (" + diff.slice(0, 6).join(" ") + ")" : ""}; ${sc.bad} solid, ${sc.onP} on a post`);
      notes.push(`${name}: the gate, keyboard: up the road at 144 px across: through ${cThrough} (terrain preview ${tThrough}), the opening all 40 px, stopped below a post at ${[...sc.o.keys()].filter(hitsPost).length} px`); }

    // the planner: into the garden, out of it, across it, to its access points; through and round the gate
    const pw = [];
    for (const [lab, a, b] of [["the spawn to the route end koi-garden", SPAWN, ROUTE_END], ["the koi-headland road (111,52) to the macbook's stand", [111, 52], MAC_STAND], ["the west trail (99,61) to the pond place", [99, 61], POND_PLACE],
      ["the overlook to the route end", OVERLOOK, ROUTE_END], ["inside (104,57) to outside across the west wall (102,57)", [104, 57], [102, 57]], ["outside (110,53) to the pavilion's front (114,69)", [110, 53], [114, 69]],
      ["the commons (76,54) to the highland junction, up the main walk through the gate", [76, 54], JUNCTION], ["the highland junction back down to the gate's goto place", JUNCTION, GPLACE], ["beside the gate (70,39) to behind it (71,36), round the west post", [70, 39], [71, 36]]]) {
      const r = await walk(cp, tilePx(a), b); pw.push({ lab, a, b, r });
    }
    const gp = pw.find((q) => /through the gate/.test(q.lab));
    check(name, "planner: walks into the garden (from the spawn, the road and the west trail), out of it (to the overlook through the east opening), across its wall (round through an opening, never over it), to the pavilion's front, up and down the main walk through the gate and round a post, all on the update loop with no stall, never on the wall, the cliff or a post",
      pw.every((q) => q.r.plan !== null && q.r.at.join() === q.b.join() && q.r.stalls === 0 && !onSolid(q.r.seen).length) && gp.r.seen.some((q) => q.join() === "74,38" || q.join() === "73,38" || q.join() === "75,38"),
      pw.map((q) => `${q.lab}: ${q.r.plan === null ? "no path" : `${q.r.plan} tiles, ended ${q.r.at}, ${q.r.stalls} stalls`}`).join("; "));
    { const across = pw.find((q) => /across the west wall/.test(q.lab));
      check(name, "planner: from just inside the west wall to just outside it (104,57 to 102,57, 2 tiles apart), pi goes round through an opening (the west one), not through the wall", across.r.plan > 2 && across.r.seen.some((q) => isGap.has(q.join())), `${across.r.plan} tiles via ${across.r.seen.filter((q) => isGap.has(q.join())).join(" ")}`); }
    for (const loose of [false, true]) {
      const f = await walk(cp, tilePx([106, 57]), [103, 57], loose), g2 = await walk(cp, tilePx(GPLACE), GPOSTS[0], loose);
      check(name, `planner: a walk${loose ? " (loose)" : ""} to a wall tile (103,57, from inside) or a gate post (72,38, from its goto place) ends on open ground beside it, never on it`,
        f.plan !== null && g2.plan !== null && !onSolid(f.seen).length && !onSolid(g2.seen).length && Math.abs(f.at[0] - 103) + Math.abs(f.at[1] - 57) <= 2 && Math.abs(g2.at[0] - 72) + Math.abs(g2.at[1] - 38) <= 2, `ended ${f.at} and ${g2.at}`);
    }
    // trapped ground: from every walkable tile in and within 3 of the garden, and within 4 of the gate, a path to the spawn
    // (pi's own planner, with its feet; the same scan on the terrain preview shows what the terrain alone leaves without a path)
    const trapScan = (P) => P.I(([boxes]) => { const I2 = window.__island, cut = []; let n = 0;
      for (const [b, to] of boxes) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { if (!I2.tile(x, y).walkable) continue; n++; I2.teleport(x * 16 + 8, y * 16 + 10); if (I2.walkTo(to[0], to[1], false) === null) cut.push(x + "," + y); }
      return { n, cut }; }, [[[{ x0: BOX.x0 - 3, y0: BOX.y0 - 3, x1: BOX.x1 + 3, y1: BOX.y1 + 3 }, [111, 52]], [{ x0: 68, y0: 33, x1: 80, y1: 43 }, [74, 44]]]]);
    const trap = await trapScan(cp), trapT = tp.loaded ? await trapScan(tp) : null;
    check(name, `trapped ground: from all ${trap.n} walkable tiles in and within 3 of the garden (toward the road at 111,52) and within 4 of the gate (toward 74,44), pi's planner finds a path from every one that it finds on the terrain preview, before the wall and the gate (the same tiles without one, and no more)`,
      trap.n > 400 && trapT && key(trap.cut.map((q) => [q])) === key(trapT.cut.map((q) => [q])), `content: ${trap.cut.length} without a path${trap.cut.length ? " (" + trap.cut.slice(0, 8).join(" ") + ")" : ""}; terrain preview: ${trapT ? trapT.cut.length : "-"} of ${trapT ? trapT.n : "-"}`);
    if (trap.cut.length) notes.push(`${name}: trapped ground: ${trap.cut.length} walkable tiles near the garden have no path for pi's feet on the terrain preview as on the content preview (the terrain's, not B3d3's): ${trap.cut.join(" ")}`);
    // the three buildings: their doors from the spawn, and in and out of each room
    const dr = [];
    for (const [id, d] of [["visitor", [84, 74]], ["depot", [104, 77]], ["bunker", [116, 83]]]) {
      const w2 = await walk(cp, tilePx(SPAWN), d);
      await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 14); I2.step(2); }, d);
      await cp.page.keyboard.press("e");
      let rm = null; for (let k = 0; k < 20 && !rm; k++) { await sleep(60); rm = await cp.I(() => { window.__island.step(1); return window.__island.getState().room; }); }
      await sleep(250); const room = await cp.I(() => { window.__island.step(1); const r = window.__island.room(); return r ? r.id : null; });
      let out = null;
      if (room) { await cp.I(() => { const I2 = window.__island, R2 = I2.room(); I2.teleport(R2.door * 16 + 8, (R2.h - 2) * 16 + 10); I2.step(1); }); await cp.page.keyboard.down("ArrowDown");
        for (let k = 0; k < 60 && !out; k++) { out = await cp.I(() => { const I2 = window.__island; I2.step(1); return I2.getState().room ? null : true; }); if (!out) await sleep(25); } await cp.page.keyboard.up("ArrowDown"); }
      dr.push({ id, walked: w2.plan !== null && w2.at.join() === d.join(), room, out: !!out });
    }
    check(name, "the three buildings: from the spawn pi walks to each door on the update loop, [E] there enters its room, and it walks out again (B3c's, unchanged by the wall and the gate)", dr.every((q) => q.walked && q.room === q.id && q.out), dr.map((q) => `${q.id}: walked ${q.walked}, room ${q.room}, out ${q.out}`).join("; "));

    // the helicopter
    const hh = await cp.I(([ring, posts, terr]) => {
      const I2 = window.__island; let pts = 0, ok = 0;
      for (const [x, y] of ring.concat(posts, terr)) for (let py = y * 16; py < y * 16 + 16; py += 4) for (let px = x * 16; px < x * 16 + 16; px += 4) { pts++; if (I2.canLand(px, py)) ok++; }
      const isS = new Set(ring.concat(posts).map((p) => p.join())), foot = (h) => [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].map(([dx, dy]) => [Math.floor((h[0] + dx) / 16), Math.floor((h[1] + dy) / 16)]);
      const runs = [[108, 67, -150, 0], [100, 58, 150, 0], [111, 51, 0, 150], [115, 72, 0, -150], [74, 41, 0, -150], [69, 38, 150, 0]].map(([x, y, vx, vy]) => { const ok0 = I2.canLand(x * 16 + 8, y * 16 + 8), r = I2.landingFrom(x * 16 + 8, y * 16 + 8, vx, vy), pt = [Math.floor(r.pi[0] / 16), Math.floor(r.pi[1] / 16)]; return { from: [x, y], ok0, state: r.state, heli: r.heli.map(Math.round), over: foot(r.heli).filter((q) => isS.has(q.join())).length, pi: pt, piSafe: I2.safe(pt[0], pt[1]), piOn: isS.has(pt.join()) }; });
      return { pts, ok, inGarden: I2.canLand(109 * 16 + 8, 67 * 16 + 8), runs };
    }, [RING, GPOSTS, TERR]);
    check(name, `helicopter: it can't set down on any of the wall's, the rim's or the posts' tiles (${hh.pts} spots, every 4 px); it can inside the garden (109,67, open ground); six descents begun where E may land, drifting at the wall from inside and outside and at the gate up the road and from the side, park with no part over the wall or a post, pi out on safe ground`,
      hh.ok === 0 && hh.pts === (53 + 2 + 4) * 16 && hh.inGarden && hh.runs.every((r) => r.ok0 && r.state === "parked" && r.over === 0 && r.piSafe && !r.piOn), `${hh.ok} of ${hh.pts} allow a landing; ` + hh.runs.map((r) => `from ${r.from}${r.ok0 ? "" : " (E REFUSED THERE)"}: ${r.state} at ${r.heli}, pi on ${r.pi}${r.over ? " OVER A SOLID" : ""}`).join("; "));
    // completeness and storage
    const comp = await cp.I(() => window.__island.completeness());
    check(name, "completeness: with the koi garden's wall and the park gate there (each with its art) neither item is left; a normal format-2 home made of this content would still be refused (9 items: the landmark bases, the stations, and the sections not in the format yet)",
      comp && !comp.complete && comp.missing.length === 9 && !comp.missing.some((q) => /^(compound walls|the park gate|paddock fences|buildings)/.test(q)) && comp.missing.some((q) => /^landmark bases/.test(q)) && comp.missing.some((q) => /^stations/.test(q)), comp ? `${comp.missing.length} items missing, first: ${comp.missing.slice(0, 2).join(" | ")}` : "");
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the pushes, walks, rooms, landings and a reload)", (await storeOf(cp)) === JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]])));
    // the decoder refuses malformed walls and gates
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    { const msg = await refusedHere(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
  }
  if (cp.loaded) await cp.ctx.close();

  // 2c. a real flight: E over the wall and over a gate post is refused; inside the garden it lands and pi hops out on safe ground
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      await P.page.focus(".w-cv");
      // fly to a spot: hold the keys toward it in shorter bursts the nearer it is, and let the helicopter settle once it's close
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
      for (const [lab, x, y] of [["the koi garden's west wall (103,58)", 103, 58], ["the park gate's west post (72,38)", 72, 38]]) {
        const ov = await fly(x * 16 + 8, y * 16 + 8, 4), can = await P.I(([a, b]) => window.__island.canLand(a, b), [ov.x, ov.y]);
        await P.page.keyboard.press("e"); await P.I(() => window.__island.step(30));
        res2.push({ lab, over: [Math.round(ov.x), Math.round(ov.y)], near: Math.abs(ov.x - (x * 16 + 8)) <= 8 && Math.abs(ov.y - (y * 16 + 8)) <= 8, can, st: (await P.I(() => window.__island.getState())).heli.state });
      }
      check(name, "in flight: E over the koi garden's wall and over a gate post (the helicopter within 8 px of the tile's middle, where no landing fits) doesn't land: it keeps flying", up === "flying" && res2.every((q) => q.near && !q.can && q.st === "flying"), `took off: ${up}; ` + res2.map((q) => `${q.lab}: over ${q.over}${q.near ? "" : " (NOT over it)"}, a landing ${q.can ? "fits" : "doesn't fit"}, after E ${q.st}`).join("; "));
      await fly(109 * 16 + 8, 67 * 16 + 8); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(240));
      const l = await P.I(() => { const I2 = window.__island, s = I2.getState(), tx = Math.floor(s.pi.x / 16), ty = Math.floor(s.pi.y / 16); return { state: s.heli.state, heli: [Math.round(s.heli.x), Math.round(s.heli.y)], pi: [tx, ty], safe: I2.safe(tx, ty), clear: [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(s.pi.x + dx, s.pi.y + dy)) }; });
      check(name, "in flight: inside the garden (109,67) it lands and pi hops out clear, on safe ground, inside the wall", l.state === "parked" && l.safe && l.clear && inside(l.pi) && !P.errs.length, JSON.stringify(l) + (P.errs.length ? " errors " + P.errs.join("; ") : ""));
    } else check(name, "in flight", false, "didn't load");
    await P.ctx.close(); }

  // 2d. on screen, against the terrain preview at the same spot, step and size: the whole garden in the frame (1000 x 1010: scale 3), then
  // the gate. Over each wall tile and each post the frame must differ; over the open tiles touching the wall (outside, inside, the
  // openings) and the gate's opening it must not (the tiles round pi, where its sprite is, are left out)
  for (const [lab, vp, at, solid, near] of [
    // (pi stands on the pond's middle, 111,62, so the camera frames the whole garden; nothing there is near the wall)
    ["the koi garden's wall", { width: 1000, height: 1010 }, [111 * 16 + 8, 62 * 16 + 10], RING, (() => { const o = []; for (const [x, y] of RING) for (const [dx, dy] of N4) { const q = [x + dx, y + dy]; if (!isRing.has(q.join()) && !o.some((p) => p.join() === q.join()) && m.coll[q[1] * W + q[0]] === 0) o.push(q); } return o; })()],
    ["the park gate", { width: 1280, height: 800 }, [74 * 16 + 8, 42 * 16 + 10], GPOSTS, GOPEN.concat([[71, 38], [77, 38], [72, 39], [76, 39], [73, 39], [75, 39]])]]) {
    const A2 = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: vp } }), B2 = await open(`http://127.0.0.1:${port}/${Q}`, { ctxOpts: { viewport: vp } });
    if (A2.loaded && B2.loaded) {
      for (const P of [A2, B2]) await settle(P, at);
      { const ta = await A2.I(() => window.__island.getState().t), tb = await B2.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await B2.I((n) => window.__island.step(n), k); else if (k < 0) await A2.I((n) => window.__island.step(n), -k); }
      // the minimap is drawn on the same canvas (bottom right, over the garden's south-east corner here): folded away in both, with the
      // game's own click on it; then both pages draw a frame of that moment before it is read (a page that hasn't drawn yet reads black)
      for (const P of [A2, B2]) { const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); await P.I(() => window.__island.step(1)); }
      for (const P of [A2, B2]) await P.page.waitForFunction(() => { const c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return d[0] + d[1] + d[2] > 0; }, null, { timeout: 8000 }).catch(() => {});
      for (const P of [A2, B2]) await P.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const grab = (P) => P.I(([sol, nr]) => {
        const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const tile = ([x, y]) => { const x0 = Math.ceil((x * 16 - v.camera[0]) * E), y0 = Math.ceil((y * 16 - v.camera[1]) * E), x1 = Math.floor(((x + 1) * 16 - v.camera[0]) * E) - 1, y1 = Math.floor(((y + 1) * 16 - v.camera[1]) * E) - 1;
          if (x0 < 0 || y0 < 0 || x1 >= c.width || y1 >= c.height) return null; const o = []; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = (yy * c.width + xx) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; };
        // a tile under the (folded) minimap's box isn't compared
        const mr = v.ui.mini, under = ([x, y]) => mr && (x + 1) * 16 > v.camera[0] + (mr[0] - 4) / v.ui.scale / v.zoom && x * 16 < v.camera[0] + (mr[0] + mr[2] + 4) / v.ui.scale / v.zoom && (y + 1) * 16 > v.camera[1] + (mr[1] - 4) / v.ui.scale / v.zoom && y * 16 < v.camera[1] + (mr[1] + mr[3] + 4) / v.ui.scale / v.zoom;
        return { cam: v.camera, miniOn: v.ui.miniOn, sol: sol.map(tile), near: nr.map((q) => under(q) ? "under" : tile(q)), solUnder: sol.filter(under).length, gate: v.gates.map((g) => g.drawn), walls: (I2.wallArt("koi-garden") || { pieces: [] }).pieces.map((q) => [q.tile, q.at]) };
      }, [solid, near]);
      const a = await grab(A2), b = await grab(B2);
      const frac = (x, y) => { if (!x || !y || x.length !== y.length) return null; let dd = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) dd++; return dd / (x.length / 3); };
      const sf = solid.map((q, i) => frac(a.sol[i], b.sol[i])), nf = near.map((q, i) => a.near[i] === "under" ? 0 : frac(a.near[i], b.near[i])), nUnder = a.near.filter((q) => q === "under").length;
      const black = (q) => !q || (q !== "under" && q.every((v) => v === 0)), drawn = !a.sol.concat(a.near).some(black) && !b.sol.concat(b.near).some(black);
      const same = a.cam.join() === b.cam.join() && drawn, allIn = sf.every((v) => v !== null) && nf.every((v) => v !== null);
      const sMin = Math.min(...sf.filter((v) => v !== null)), nMax = Math.max(...nf.filter((v) => v !== null));
      check(name, `${lab} on screen (${vp.width} x ${vp.height}, all of it in the frame, the minimap folded): against the terrain preview's frame, the picture differs over every ${lab === "the park gate" ? "post" : "wall tile"} (each at least 95% of its pixels): its art is visible over every solid pixel`, same && allIn && !a.miniOn && a.solUnder === 0 && sMin >= 0.95,
        `camera ${a.cam.join() === b.cam.join() ? "same" : "differs"}; ${drawn ? "both drawn" : "a page NOT DRAWN (black)"}; minimap ${a.miniOn ? "OPEN" : "folded"} (${a.solUnder} solid tiles under its box); ${allIn ? "all in frame" : "NOT all in frame"}; min ${(100 * sMin).toFixed(1)}%`);
      check(name, `${lab}: the ${near.length} open tiles ${lab === "the park gate" ? "of its opening and beside and in front of its posts" : "touching the wall, outside, inside and in its openings,"} look exactly as on the terrain preview (at most 2% of a tile's pixels differ: no art on walkable ground, no opening drawn shut)`, same && allIn && nMax <= 0.02,
        `max ${(100 * nMax).toFixed(2)}% differ${nf.some((v) => v > 0.02) ? " (over 2%: " + near.filter((q, i) => nf[i] > 0.02).slice(0, 6).join(" ") + ")" : ""}${nUnder ? `; ${nUnder} under the folded minimap, not compared` : ""}`);
      if (lab === "the park gate") check(name, "the park gate was drawn at its box's origin (world px), opaque with pi in front of it", a.gate.length === 1 && a.gate[0] && a.gate[0][0] === GBOX.px0 && a.gate[0][1] === GBOX.py0 && a.gate[0][4] === false, JSON.stringify(a.gate));
      else check(name, "the wall's art: each of its 53 pieces was drawn at its own tile's origin (world px), and nowhere else", a.walls.length === 53 && a.walls.every(([tl, q]) => q && q[0] === tl[0] * T && q[1] === tl[1] * T), `${a.walls.filter((q) => q[1]).length} drawn`);
    } else check(name, `${lab} on screen`, false, "didn't load");
    await A2.ctx.close(); await B2.ctx.close();
  }

  // 2e. under the arch: walking up the road through the gate, wherever pi is north of the gate's foot and under its art, the gate is
  // drawn see-through (pi never hidden behind it), and opaque again once pi is in front
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      const r = await P.I(([b]) => { const I2 = window.__island; I2.teleport(74 * 16 + 8, 41 * 16 + 10); I2.step(2); I2.walkTo(74, 35, false); const out = []; for (let i = 0; i < 400; i++) { I2.step(1); const p = I2.getState().pi, g = I2.preview().gates[0].drawn; out.push([p.x, p.y, g ? g[4] : null]); if (!p.path) break; } return out; }, [[GBOX.px0, GBOX.py0, GBOX.px1, GBOX.py1]]);
      const sortY = 38 * T + 14, under = r.filter(([x, y]) => y < sortY && y > GBOX.py0 + 6 && x > GBOX.px0 - 6 && x < GBOX.px1 + 6), front = r.filter(([, y]) => y >= sortY);
      check(name, "under the arch: walking up the road through the gate (74,41 to 74,35), every frame pi is behind it (north of its foot, under its art) the gate is drawn see-through, and every frame pi is in front it is opaque",
        under.length > 10 && front.length > 10 && under.every((q) => q[2] === true) && front.every((q) => q[2] === false), `${under.length} frames behind (${under.filter((q) => q[2] === true).length} see-through), ${front.length} in front (${front.filter((q) => q[2] === false).length} opaque)`);
    } else check(name, "under the arch", false, "didn't load");
    await P.ctx.close(); }

  // 2f. phones (390 x 844 and 375 x 667, touch): a tap inside the garden walks pi in through an opening; a tap on the wall stops beside it;
  // a tap beyond the gate walks pi through it; the touch joystick takes pi in through the north opening and up through the gate
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const follow = () => P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 3000; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen, stalls: p.stalls }; });
    const taps = [];
    for (const [lab, from, to] of [["into the garden through the north opening", [111, 51], [111, 57]], ["into the garden through the west opening", [100, 61], [105, 64]], ["onto the wall (107,54) from inside", [107, 57], [107, 54]], ["up through the gate", [74, 42], [74, 35]], ["down through the gate", [74, 34], [74, 41]]]) {
      await settle(P, tilePx(from)); const s0 = await P.I(() => window.__island.getState().pi.stalls);
      const sc = await screenOf(P, to[0] * 16 + 8, to[1] * 16 + 8); await P.page.touchscreen.tap(sc.sx, sc.sy); const r = await follow();
      taps.push({ lab, to, sc, r, stalls: r.stalls - s0, onScreen: sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh });
    }
    const wallTap = taps[2];
    check(name, `phone ${vw} x ${vh}: taps walk pi into the garden through its north and west openings, up and down through the gate, with no stall, never on the wall or a post; a tap on the wall from inside stops pi beside it (an opening is ${(3 * taps[0].sc.tile).toFixed(0)} CSS px wide on screen, the gate's ${(3 * taps[0].sc.tile).toFixed(0)})`,
      taps.every((q) => q.onScreen && !onSolid(q.r.seen).length) && taps.filter((q) => q !== wallTap).every((q) => q.r.at.join() === q.to.join() && q.stalls === 0) && Math.abs(wallTap.r.at[0] - 107) + Math.abs(wallTap.r.at[1] - 54) <= 2 && !P.errs.length,
      taps.map((q) => `${q.lab}: ended ${q.r.at}, ${q.stalls} stalls`).join("; ") + (P.errs.length ? "; errors " + P.errs.join("; ") : ""));
    const joy = async (from, ang, ms = 2400) => {
      await settle(P, from);
      const at = { x: Math.round(vw * 0.3), y: Math.round(vh * 0.75) };
      await P.page.evaluate(([x, y]) => { const cv = document.querySelector(".w-cv"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true })); }, [at.x, at.y]);
      await P.page.evaluate(([x, y, a]) => { const cv = document.querySelector(".w-cv"); for (let k = 1; k <= 6; k++) cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, pointerType: "touch", isPrimary: true, clientX: x + Math.sin(a) * 10 * k, clientY: y + Math.cos(a) * 10 * k, bubbles: true })); }, [at.x, at.y, ang]);
      const out = await P.I((n) => { const I2 = window.__island, seen = []; let bad = 0; for (let f = 0; f < n; f += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) bad++; } return { seen, bad }; }, Math.round(ms / 1000 * 60));
      await P.page.evaluate(() => { document.querySelector(".w-cv").dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, pointerType: "touch", isPrimary: true, bubbles: true })); });
      return out;
    };
    const j1 = await joy(tilePx([111, 52]), 0), j2 = await joy(tilePx([74, 41]), Math.PI), j3 = await joy(tilePx([108, 52]), 0);
    check(name, `phone ${vw} x ${vh}: the touch joystick: dragged straight down from the road above the north opening (111,52), pi walks in; dragged straight up from 74,41, pi walks up through the gate; dragged straight down at 108,52 (above the wall), pi stops at the wall; never a foot on solid, never on the wall or a post`,
      j1.seen.some(inside) && j2.seen.some((q) => q[1] <= 36) && !j3.seen.some(inside) && [j1, j2, j3].every((j) => j.bad === 0 && !onSolid(j.seen).length), [["down at 111,52", j1], ["up at 74,41", j2], ["down at 108,52", j3]].map(([k2, j]) => `${k2}: ended ${j.seen[j.seen.length - 1]}`).join("; "));
    await P.ctx.close();
  }

  // 2g. performance: the draw cost of the wall's pieces and the gate, and the frame work walking round the garden and through the gate on
  // the live loop, beside the terrain preview; planning; decoding
  if (tp.loaded) {
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.wallMs, v.wallDraws, v.gateMs, v.gateDraws]; });
      await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[104, 53], "ArrowRight"], [[120, 66], "ArrowUp"], [[111, 52], "ArrowDown"], [[102, 66], "ArrowUp"], [[74, 42], "ArrowUp"]]) {
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at);
        await P.page.keyboard.down(k2); await P.page.waitForTimeout(2200); await P.page.keyboard.up(k2);
      }
      const r = await P.I(() => ({ f: window.__island.frames(true), v: window.__island.preview() }));
      await P.ctx.close();
      const f = r.f.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], wms: r.v.wallMs - b0[0], wn: r.v.wallDraws - b0[1], gms: (r.v.gateMs || 0) - (b0[2] || 0), gn: (r.v.gateDraws || 0) - (b0[3] || 0), errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    perf.push(`${name}: live frame work walking round the koi garden, in through its north opening and up through the gate: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; one wall piece ${lc && lc.wn ? (lc.wms / lc.wn * 1000).toFixed(2) : "-"} us a draw (${lc ? lc.wn : 0} draws), the gate ${lc && lc.gn ? (lc.gms / lc.gn * 1000).toFixed(2) : "-"} us a draw (${lc ? lc.gn : 0} draws)`);
    check(name, "performance: walking round the garden and through the gate on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const P2 = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P2.loaded) {
      const plan = (P, a, b) => P.I(([f, tt]) => { const I2 = window.__island; I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); let s = performance.now(); const n = I2.walkTo(tt[0], tt[1], false); const cold = performance.now() - s; s = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(tt[0], tt[1], false); return [cold, (performance.now() - s) / 20, n]; }, [a, b]);
      for (const [lab, a, b] of [["across the west wall (102,57 to 104,57)", [102, 57], [104, 57]], ["the spawn to the koi garden's route end", SPAWN, ROUTE_END], ["the commons up through the gate", [76, 54], JUNCTION]]) {
        const xc = await plan(P2, a, b), xt = await plan(tp, a, b);
        perf.push(`${name}: path planning ${lab} (ms first / warm, tiles): content ${xc[0].toFixed(2)} / ${xc[1].toFixed(2)}, ${xc[2]}; terrain preview ${xt[0].toFixed(2)} / ${xt[1].toFixed(2)}, ${xt[2]}`);
      }
      const dec = await P2.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [cWith(() => {})]);
      const decT = await tp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [STAGED_MAP]);
      perf.push(`${name}: decoding the staged map: ${dec.toFixed(1)} ms with the content layer (${DATA.records.length} records), ${decT.toFixed(1)} ms without (terrain preview)`);
    }
    await P2.ctx.close();
  }
  if (tp.loaded) await tp.ctx.close();

  // 2h. code mutations (Chromium only: each is a whole load)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.gateUndrawn[1](WORLD) }); const a = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(74 * 16 + 8, 41 * 16 + 10); for (let i = 0; i < 10; i++) I2.step(1); return I2.preview().gates[0].drawn; }) : "didn't load";
      caught(MUT.gateUndrawn[0], a === null, `drawn ${JSON.stringify(a)}`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.gateOpen[1](WORLD) }); const r = P.loaded ? await P.I(() => { const I2 = window.__island; return { walk: I2.tile(72, 38).walkable, blocked: I2.blocked(72 * 16 + 8, 38 * 16 + 8) }; }) : null;
      caught(MUT.gateOpen[0], r && (r.walk || !r.blocked), r ? JSON.stringify(r) : "didn't load"); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.cliffIgnored[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => moveTerr(c, 119, 60))) : "didn't load";
      caught(MUT.cliffIgnored[0], r === null, r === null ? "an open tile listed as closed by the terrain decoded (the wall left with a walkable hole)" : r); await P.ctx.close(); }
  }

  // 2i. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    const at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
    // the minimap is drawn on the game's canvas: folded away with the game's own click on it (for the whole-garden frames)
    const foldMini = async (P) => { const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); };
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      // 1000 x 1150 is scale 3: the whole garden and a tile round it, with pi on the loop path below the pond (111,65)
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: { viewport: { width: 1000, height: 1150 } }, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await foldMini(P); await at(P, 111, 65, 1500);
        await shoot(P, `${name}-koi-garden-${tag}.png`);
        if (tag === "day") {
          // the diagnostic overlay: what blocks (the game's own collision, read tile by tile) over the art, the cliff that closes the ring,
          // the openings, safe ground, and the reserved and planned places by the garden; its legend clear of the island's interface
          const clear = await P.I(([box, gaps, terr, marks, pav, cats]) => {
            const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
            c.id = "b3d3-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
            const g = c.getContext("2d"), X = (tx) => (tx * 16 - v.camera[0]) * E, Y = (ty) => (ty * 16 - v.camera[1]) * E, Sz = 16 * E, isG = new Set(gaps.map((p) => p.join())), isT = new Set(terr.map((p) => p.join())); let solid = 0, cliff = 0, open = 0;
            for (let y = box.y0 - 2; y <= box.y1 + 1; y++) for (let x = box.x0 - 2; x <= box.x1 + 2; x++) {
              const q = I2.tile(x, y);
              if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.42)"; g.fillRect(X(x), Y(y), Sz, Sz); g.strokeStyle = "#ff4040"; g.lineWidth = 1; g.strokeRect(X(x) + 0.5, Y(y) + 0.5, Sz - 1, Sz - 1); }
              else if (isT.has(x + "," + y)) { cliff++; g.fillStyle = "rgba(255,150,40,.5)"; g.fillRect(X(x), Y(y), Sz, Sz); }
              else if (isG.has(x + "," + y)) { open++; g.fillStyle = "rgba(255,209,102,.55)"; g.fillRect(X(x), Y(y), Sz, Sz); }
              else if (I2.safe(x, y)) { g.strokeStyle = "rgba(74,222,128,.75)"; g.lineWidth = 1; g.strokeRect(X(x) + 2.5, Y(y) + 2.5, Sz - 5, Sz - 5); }
            }
            g.setLineDash([6, 4]); g.strokeStyle = "#c084fc"; g.lineWidth = 2; g.strokeRect(X(pav.x0), Y(pav.y0), (pav.x1 - pav.x0 + 1) * Sz, (pav.y1 - pav.y0 + 1) * Sz);
            g.strokeStyle = "#7dd3fc"; g.strokeRect(X(cats.x0) + 3, Y(cats.y0) + 3, (cats.x1 - cats.x0 + 1) * Sz - 6, (cats.y1 - cats.y0 + 1) * Sz - 6); g.setLineDash([]);
            for (const [x, y] of marks) { g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(X(x) + 1, Y(y) + 1, Sz - 2, Sz - 2); }
            cvs.parentElement.insertBefore(c, cvs.nextSibling);
            const L = document.createElement("div"); L.id = "b3d3-legend";
            L.textContent = `B3d3 diagnostic (test overlay)\nred: wall collision, read\n     from the game (53)\norange: cliff rim closing\n     it (terrain, 4)\nyellow: openings (7)\ngreen: safe ground\nwhite: route end 108,68,\n  pond place 110,57,\n  macbook 105,57 and its\n  stand 105,58, log site\n  106,58, overlook 120,63\npurple: koi pavilion\n  reserve (unused)\nblue: cats' roam box`;
            Object.assign(L.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "15px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
            document.body.appendChild(L);
            const lr = L.getBoundingClientRect(), hits = [];
            for (const el of cvs.parentElement.querySelectorAll("*")) {
              if (el === L || el === c || el === cvs || L.contains(el) || el.contains(L)) continue;
              const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none" || +st.opacity === 0) continue;
              const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
              if (r.left < lr.right && r.right > lr.left && r.top < lr.bottom && r.bottom > lr.top && (el.children.length === 0 || el.tagName === "CANVAS")) hits.push((el.className || el.tagName) + "");
            }
            const gx0 = X(box.x0), gy1 = Y(box.y1 + 1);
            return { rect: [lr.left, lr.top, lr.width, lr.height].map(Math.round), hits, solid, cliff, open, garden: [Math.round(gx0), Math.round(gy1)] };
          }, [BOX, GAPS, TERR, [ROUTE_END, POND_PLACE, MAC, MAC_STAND, LOG_SITE, OVERLOOK], PAVILION, CATS]);
          check(name, "diagnostic overlay, the koi garden (review screenshot only): the game's own collision shows exactly the wall's 53 tiles in and round the garden, the 4 rim tiles and the 7 openings; its legend on screen, clear of the island's interface",
            clear.solid === 53 && clear.cliff === 4 && clear.open === 7 && clear.rect[0] >= 0 && clear.rect[1] >= 0 && clear.rect[0] + clear.rect[2] <= 1000 && clear.rect[1] + clear.rect[3] <= 1150 && clear.hits.length === 0,
            `${clear.solid} solid, ${clear.cliff} cliff, ${clear.open} open; legend at ${clear.rect}; under it: ${clear.hits.join(", ") || "nothing"}`);
          await shoot(P, `${name}-koi-diagnostic.png`);
          await P.page.evaluate(() => { for (const id of ["b3d3-overlay", "b3d3-legend"]) { const e = document.getElementById(id); if (e) e.remove(); } });
          // the gate's overlay: its posts' collision, its opening, the ramp, and the places by it
          await at(P, 74, 41, 1500);
          const gcl = await P.I(([posts, gopen, ramp, marks]) => {
            const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
            c.id = "b3d3-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
            const g = c.getContext("2d"), X = (tx) => (tx * 16 - v.camera[0]) * E, Y = (ty) => (ty * 16 - v.camera[1]) * E, Sz = 16 * E; let solid = 0;
            for (let y = 32; y <= 45; y++) for (let x = 64; x <= 84; x++) { const q = I2.tile(x, y); if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.5)"; g.fillRect(X(x), Y(y), Sz, Sz); g.strokeStyle = "#ff4040"; g.strokeRect(X(x) + 0.5, Y(y) + 0.5, Sz - 1, Sz - 1); } }
            for (const [x, y] of gopen) { g.fillStyle = "rgba(255,209,102,.5)"; g.fillRect(X(x), Y(y), Sz, Sz); }
            g.setLineDash([6, 4]); g.strokeStyle = "#7dd3fc"; g.lineWidth = 2; g.strokeRect(X(ramp.x0), Y(ramp.y0), (ramp.x1 - ramp.x0 + 1) * Sz, (ramp.y1 - ramp.y0 + 1) * Sz); g.setLineDash([]);
            for (const [x, y] of marks) { g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(X(x) + 1, Y(y) + 1, Sz - 2, Sz - 2); }
            cvs.parentElement.insertBefore(c, cvs.nextSibling);
            const L = document.createElement("div"); L.id = "b3d3-legend";
            L.textContent = `B3d3 diagnostic (test overlay)\nred: the gate's posts,\n     collision read from\n     the game (72,38, 76,38)\nyellow: its opening, the\n     main walk (73-75,38)\nblue: the park-gate ramp\nwhite: marker 74,38, B3a's\n  lamp place 78,38, goto\n  place 'gate' 74,40`;
            Object.assign(L.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "15px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
            document.body.appendChild(L);
            return { solid };
          }, [GPOSTS, GOPEN, RAMP, [MARK, GLAMP, GPLACE]]);
          check(name, "diagnostic overlay, the park gate: the game's own collision shows exactly the gate's 2 posts round it", gcl.solid === 2, `${gcl.solid} solid`);
          await shoot(P, `${name}-gate-diagnostic.png`);
        }
      }
      await P.ctx.close();
    }
    // close-ups at 1280 x 800 (scale 4): the openings, the corners, the cliff stretch, pi on its way in; the gate, pi under it and in
    // front; at night too. And a bigger frame (1500 x 950, scale 5) for the gate close-up
    for (const [hour, tag] of [[11, ""], [22, "-night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { wait: 2600 });
      if (P.loaded) {
        await hideDbg(P);
        const shots = tag ? [["koi-north-opening", 111, 56], ["koi-east-cliff", 117, 59], ["gate", 74, 41]] :
          [["koi-north-opening", 111, 56], ["koi-west-opening", 105, 61], ["koi-east-opening", 117, 63], ["koi-east-cliff", 117, 59], ["koi-corner-nw", 105, 56], ["koi-corner-ne", 117, 56], ["koi-corner-sw", 105, 68], ["koi-corner-se", 117, 68], ["koi-outside-south-west", 101, 66], ["gate", 74, 41], ["gate-under", 74, 37], ["gate-behind", 74, 34]];
        for (const [f, x, y] of shots) { await at(P, x, y); await shoot(P, `${name}-${f}${tag}.png`); }
        if (!tag) {
          // pi on its way: walking along the west trail toward the west opening; and walking up the road under the arch
          await at(P, 98, 61, 600); await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(900);
          await shoot(P, `${name}-koi-approach.png`); await P.page.keyboard.up("ArrowRight");
          await at(P, 74, 40, 600); await P.page.keyboard.down("ArrowUp"); await P.page.waitForTimeout(420);
          await shoot(P, `${name}-gate-passing.png`); await P.page.keyboard.up("ArrowUp");
          await at(P, 108, 57, 600); await P.page.keyboard.down("ArrowUp"); await P.page.waitForTimeout(1000);
          await shoot(P, `${name}-koi-collision-push.png`); await P.page.keyboard.up("ArrowUp");
        }
      }
      await P.ctx.close();
    }
    { const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: 1500, height: 950 } }, wait: 2600 });
      if (P.loaded) { await hideDbg(P); await at(P, 74, 39, 1200); await shoot(P, `${name}-gate-closeup.png`); }
      await P.ctx.close(); }
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
      const Q2 = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (Q2.loaded) { await cardAway(Q2); await hideDbg(Q2); await at(Q2, 111, 57, 1200); await shoot(Q2, `${name}-${tag}-koi-north.png`); await at(Q2, 104, 62, 1200); await shoot(Q2, `${name}-${tag}-koi-west.png`); await at(Q2, 74, 40, 1200); await shoot(Q2, `${name}-${tag}-gate.png`); }
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
