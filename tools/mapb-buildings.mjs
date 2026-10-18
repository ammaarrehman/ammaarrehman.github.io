#!/usr/bin/env node
/* mapb-buildings (MAP-B B3c1, B3c2, B3c3): the buildings migrated into the content layer (B3c1: the visitor centre and the
   supply depot, on the ranger HQ / depot footprint; B3c2: the outpost bunker, in the bunker compound's reserve; B3c3: the
   bunker compound's wall round it, with its open west entrance), and the
   explicit preview modes and systems (SYS) that replaced B3b's TERRAIN_ONLY. Real content only, served through the
   content preview (tools/mapb-preview.mjs --content); a few synthetic variants of it are built here in memory (never
   written anywhere).

   B3c2 adds, for the bunker: its footprint, door and compound against the B1e source (the door is the log site); the
   future compound (planning only: its wall ring with the west gates, and B3a's proposed outpost kit, made solid in
   memory) leaving the door reachable from every gate and from the spawn, with no pocket inside; the whole room swept
   item by item against format 1 (each item's prompt, dialog, words and links), the rack's and desk's logs not counted in
   the preview (the landmarks, and with them the logs, aren't migrated) while format 1 still counts them; five enter and
   leave cycles; walks from each gate to the door inside the compound; one walk through all three buildings; phones at
   390 x 844 and 375 x 667; two more code mutations; and its review screenshots (exit, all four edges, the compound).

   B3c3 adds, for the compound's wall (the record bunker-compound, kind wall): the record against the B1e compound (its
   box's ring less its three gates, 53 tiles, every one drawn and nothing else), the ring closed and joined at its
   corners, the entrance (three tiles, open ground, the ops road's end), B3a's proposed kit and uplink places still clear,
   no ground cut off, the outside of every side walkable, and malformed wall records and decoder refusals; in Chromium and
   WebKit the wall's collision pixel by pixel, its art (opaque, on its tiles exactly, visible on screen over every solid
   pixel, nothing over the entrance), pi stopped flush by each side from inside and out and at every corner, walks through
   each gate, round the outside, across the compound (the planner goes through the entrance, never the wall), from the
   spawn into the bunker and back out through the entrance, a tap on the wall, no trapped ground, the helicopter refused
   over the wall and stopped short of it, phones tapping in through the entrance, three more code mutations, its cost on
   the live loop, and its review screenshots into tools/out/mapb/b3c3/ (with a labelled diagnostic overlay the test draws
   over the page, never the game).

   B3d1 (tools/mapb-fences.mjs tests the raptor yard's fence, the first paddock fence): this suite expects that record too,
   and its enclosed inside (42 tiles) as the only ground the content cuts off; MAPB_SHOTS sends the review screenshots
   elsewhere, so a later batch's regression run leaves B3c3's in place. B3d2 (tools/mapb-paddock.mjs tests the holding
   paddock's fence): this suite expects that record too, and its inside (35) cut off beside the yard's. B3d3
   (tools/mapb-koi-gate.mjs tests the koi garden's wall and the park gate): this suite expects both records too, the koi
   garden's wall as a second wall beside the compound's, and a gate refused by its own shape now that a gate has art.
   B3d4a (tools/mapb-landmarks.mjs tests the tower's and the lighthouse's bases): both records expected too, and a landmark
   refused by its own shape now that a landmark has art.

   1. Node, the content and its compiler:
      - the tracked content file is the current compile, bound to the current terrain, and holds exactly the two buildings;
      - each record against the approved coordinates and the B1e source: its reserve, its footprint (every tile solid),
        its art box (the footprint exactly), its door (the B3a doorstep), its room; the door on open ground, clear of
        foot-blocking pixels, with a paved approach (the B1d stub or spur) right below or beside it;
      - malformed building records, one fault at a time, each caught by its rule (schema or buildings).
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - the modes: production (every system, its three format-1 buildings, the legacy doorways), the terrain preview (no
        system but the helicopter, no buildings), the content preview (buildings only); badges; no storage read or written
        in either preview, through entering and leaving both buildings and a reload;
      - both locked painter digests with the buildings drawn (they're drawn in the object layer, never the ground);
      - collision: the content layer is exactly the two footprints; every footprint pixel blocks feet and the pixels round
        it answer as the terrain does; pi pushed against each side stops at the wall;
      - the art: opaque over every pixel of the footprint, drawn exactly there, and visibly there (the frame differs from
        the terrain preview's over the whole footprint);
      - the door: walkable, safe, feet fit, reached from the spawn on foot (the update loop) without touching the building;
        [E] there enters (the prompt says "enter"); the room is format 1's (same items, words, size and door); an item
        inside answers; walking out lands on the doorway, facing out, on safe ground, and pi can walk away;
      - paths go round each building; no walkable tile within 3 of a footprint is cut off from the spawn;
      - an off-centre door (a synthetic variant) is where pi enters and comes out (the authored door, not the middle);
      - phones (390 x 844, touch): the prompt is the button, a tap on it goes in, a tap by the room's door walks out;
      - format 1: its three buildings, doors and rooms as before (enter and leave the visitor centre and the depot);
      - the decoder refuses malformed building records, one fault at a time, each named;
      - performance: the content buildings' draw cost, the frame work beside the terrain preview at the same spots, path
        planning to each door, decoding the content, and the door transitions' worst frames (the doors.mjs budget, 16 ms);
      - code mutations (js/world.js served altered): each caught;
      - review screenshots (not baselines) into tools/out/mapb/b3c3/ (B3c1's are in b3c1/, B3c2's in b3c2/): each
        building's exterior (day and night), doorway, interior, pi against its wall, and on a phone; the compound (B3c3).

     node tools/mapb-buildings.mjs
     ENGINES=chromium node tools/mapb-buildings.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, compileContent, contentLayers, serializeContent, ContentError } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// its review screenshots go to tools/out/mapb/b3c3/ (B3c3's); MAPB_SHOTS names another folder under tools/out/ for a later
// batch's regression run, so B3c3's approved evidence isn't overwritten
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3c3");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

// the approved B1e footprints and the B3a doorsteps (Ammaar's B3c1 and B3c2 briefs; checked against the B1e source below);
// approach: what the tile below the door is (the B1d stub or spur's paving, or the compound's grass)
const APPROVED = {
  visitor: { reserve: "visitor-centre", box: { x0: 80, y0: 69, x1: 88, y1: 73 }, door: [84, 74], room: "visitor", name: "the visitor centre", approach: "path" },
  depot: { reserve: "ranger-hq-depot", box: { x0: 101, y0: 73, x1: 107, y1: 76 }, door: [104, 77], room: "depot", name: "the supply depot", approach: "path" },
  bunker: { reserve: "bunker", box: { x0: 113, y0: 79, x1: 119, y1: 82 }, door: [116, 83], room: "bunker", name: "the bunker", approach: "grass" }
};
// the bunker compound (B3c2 brief; B3c3 builds its wall): its box and its west gates, and B3a's proposed outpost kit and
// uplink station (B3a plan section 3; proposals, not approved geometry: B3c3 keeps their places clear), made solid only in
// memory here
const COMP = { box: { x0: 109, y0: 76, x1: 124, y1: 89 }, gates: [[109, 84], [109, 85], [109, 86]] };
const KIT = [["mast", 123, 86], ["solar", 122, 88], ["solar", 123, 88], ["generator", 111, 78], ["tank", 110, 80], ["tent", 118, 87], ["campfire", 117, 86], ["crates", 110, 88], ["lamp", 110, 77], ["lamp", 123, 78], ["uplink", 121, 81]];
const inComp = (x, y) => x >= COMP.box.x0 && x <= COMP.box.x1 && y >= COMP.box.y0 && y <= COMP.box.y1;
const onRing = (x, y) => inComp(x, y) && (x === COMP.box.x0 || x === COMP.box.x1 || y === COMP.box.y0 || y === COMP.box.y1);
const isGate = (x, y) => COMP.gates.some((g) => g[0] === x && g[1] === y);
// B3c3: the wall as approved (the brief): the ring of the box less the gates, its corners and the posts either side of the entrance
const RING = []; for (let y = COMP.box.y0; y <= COMP.box.y1; y++) for (let x = COMP.box.x0; x <= COMP.box.x1; x++) if (onRing(x, y) && !isGate(x, y)) RING.push([x, y]);
const CORNERS = [[109, 76], [124, 76], [109, 89], [124, 89]], POSTS = [[109, 83], [109, 87]], WALL_ID = "bunker-compound";
const onWall = (x, y) => onRing(x, y) && !isGate(x, y);
// pi walked into the wall: [side, from, the tile pi starts on, the key held]; outside and inside each side
const WPUSH = [["north", "outside", [116, 74], "ArrowDown"], ["north", "inside", [116, 78], "ArrowUp"], ["west", "outside", [107, 80], "ArrowRight"], ["west", "inside", [111, 80], "ArrowLeft"],
  ["east", "outside", [126, 80], "ArrowLeft"], ["east", "inside", [122, 80], "ArrowRight"], ["south", "outside", [116, 91], "ArrowUp"], ["south", "inside", [116, 87], "ArrowDown"]];
// and diagonally into each corner, from outside (two keys at once) and from inside (the north-west from outside starts in column
// 108, the one open column between the depot, 101 to 107, and the wall; the south-east's outside is the sea)
const CPUSH = [["north-west", "outside", [108, 74], ["ArrowRight", "ArrowDown"]], ["north-east", "outside", [126, 74], ["ArrowLeft", "ArrowDown"]], ["south-west", "outside", [107, 91], ["ArrowRight", "ArrowUp"]],
  ["north-west", "inside", [111, 78], ["ArrowLeft", "ArrowUp"]], ["north-east", "inside", [122, 78], ["ArrowRight", "ArrowUp"]], ["south-west", "inside", [111, 87], ["ArrowLeft", "ArrowDown"]], ["south-east", "inside", [122, 87], ["ArrowRight", "ArrowDown"]]];
// pi walked into each side of each building: [building, side, the tile pi starts on, the key held]
const PUSH = [["visitor", "front", [82, 76], "ArrowUp"], ["visitor", "west", [77, 71], "ArrowRight"], ["visitor", "east", [91, 71], "ArrowLeft"], ["visitor", "back", [84, 67], "ArrowDown"],
  ["depot", "front", [102, 79], "ArrowUp"], ["depot", "west", [99, 75], "ArrowRight"], ["depot", "east", [109, 75], "ArrowLeft"], ["depot", "back", [104, 72], "ArrowDown"],
  ["bunker", "front", [114, 84], "ArrowUp"], ["bunker", "west", [111, 80], "ArrowRight"], ["bunker", "east", [121, 80], "ArrowLeft"], ["bunker", "back", [116, 77], "ArrowDown"]];
const IDS = Object.keys(APPROVED);
const pxOf = (b) => ({ px0: b.x0 * T, py0: b.y0 * T, px1: b.x1 * T + T - 1, py1: b.y1 * T + T - 1 });
const doorway = (id) => [APPROVED[id].door[0] * T + 8, APPROVED[id].door[1] * T + 6];

/* ════════ 1. Node: the records and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records;
check("node", "the content holds exactly the three buildings (B3c1's two and B3c2's bunker), B3c3's compound wall, B3d1's raptor-yard fence, B3d2's holding-paddock fence, B3d3's koi garden wall and park gate and B3d4a's tower and lighthouse bases (tools/mapb-fences.mjs, tools/mapb-paddock.mjs, tools/mapb-koi-gate.mjs and tools/mapb-landmarks.mjs test them; nothing else migrated)", RECS.map((r) => r.id).join() === IDS.concat(WALL_ID, "raptor-yard", "holding-paddock", "koi-garden", "park-gate", "tower-base", "lighthouse-base").join() && RECS.slice(0, 3).every((r) => r.kind === "building") && RECS[3].kind === "wall" && RECS[4].kind === "fence" && RECS[5].kind === "fence" && RECS[6].kind === "wall" && RECS[7].kind === "gate" && RECS[8].kind === "landmark" && RECS[9].kind === "landmark", RECS.map((r) => `${r.id} (${r.kind})`).join(", "));
check("node", "the content passes every rule", contentProblems(RECS, src, m).length === 0, `${built.compiled.solidTiles} solid tiles, ${built.compiled.footPixels} foot pixels`);
const LAYER = contentLayers(RECS, W, H);
for (const id of IDS) {
  const A = APPROVED[id], r = RECS.find((q) => q.id === id), fp = src.reserves.footprints.find((q) => q.id === A.reserve);
  const b = A.box, w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  check("node", `${id}: the approved footprint ${b.x0},${b.y0} to ${b.x1},${b.y1} (${w} x ${h}) is the B1e source's ${A.reserve} footprint, front south`, !!fp && JSON.stringify(fp.footprintBox) === JSON.stringify(b) && fp.front === "south" && fp.kind === "building", fp ? JSON.stringify(fp.footprintBox) : "no such footprint");
  const want = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) want.push([x, y]);
  check("node", `${id}: the record names its reserve and makes the whole footprint solid (${w * h} tiles), nothing outside it`, r.reserve === A.reserve && JSON.stringify(r.tiles) === JSON.stringify(want), `${r.tiles.length} tiles`);
  check("node", `${id}: its placeholder art box is the footprint exactly (${(w * T)} x ${(h * T)} px), so every solid pixel is under art (D1) and no art hides walkable ground`, r.art === "placeholder" && r.drawnPxBoxes.length === 1 && JSON.stringify(r.drawnPxBoxes[0]) === JSON.stringify(pxOf(b)) && r.footPxBoxes.length === 0, JSON.stringify(r.drawnPxBoxes));
  const step = [Math.floor(b.x0 + w / 2), b.y1 + 1];
  check("node", `${id}: one door, ${A.door}, the B3a doorstep (the middle of the front, floor(x0 + w / 2), y1 + 1), into the format-1 room ${A.room}`, r.room === A.room && r.doorTiles.length === 1 && r.doorTiles[0].join() === A.door.join() && step.join() === A.door.join(), `door ${r.doorTiles.join(" ")}, room ${r.room}`);
  const [dx, dy] = A.door, di = dy * W + dx, below = (dy + 1) * W + dx;
  let footInTile = 0; for (let py = dy * T; py < dy * T + T; py++) for (let px = dx * T; px < dx * T + T; px++) footInTile += m.px.foot[py * PW + px] ? 1 : 0;
  let footBelow = 0; for (let py = (dy + 1) * T; py < (dy + 2) * T; py++) for (let px = dx * T; px < dx * T + T; px++) footBelow += m.px.foot[py * PW + px] ? 1 : 0;
  check("node", `${id}: the door tile is open terrain (no flag, not water, bridge, dock or pad) with no foot-blocking pixel anywhere in it, and the tile below it (the approach) is walkable ${A.approach} with none either`,
    m.coll[di] === 0 && ![6, 8, 10].includes(m.ground[di]) && footInTile === 0 && m.coll[below] === 0 && m.ground[below] === (A.approach === "path" ? 4 : 3) && footBelow === 0, `door ground ${m.ground[di]}, below ground ${m.ground[below]} (4 is path, 3 grass), foot pixels in the door tile ${footInTile}, below ${footBelow}`);
}
{ // the B1d stubs and spurs meet the doors: the visitor stub (x 85, rows 74 to 75) beside the door; the depot spur (x 104 and 105) from row 78
  const stub = src.corridors.paths.find((p) => p.id === "visitor-centre-door"), spur = src.corridors.paths.find((p) => p.id === "depot-spur");
  check("node", "the B1d visitor-centre door stub is the tile beside the visitor door (85,74 to 85,75); the depot spur runs south from the tile below the depot door (104,78, path)",
    stub && JSON.stringify(stub.line) === "[[85,74],[85,75]]" && spur && spur.line[0][0] === 105 && m.ground[78 * W + 104] === 4 && m.ground[78 * W + 105] === 4 && m.ground[77 * W + 104] !== 4,
    `stub ${JSON.stringify(stub && stub.line)}, spur ${JSON.stringify(spur && spur.line)}; 104,77 is ${m.ground[77 * W + 104] === 4 ? "path" : "grass"}`);
}
{ // B3c2: the bunker in its compound, against the B1e source and the brief
  const fp = src.reserves.footprints.find((q) => q.id === "bunker"), cq = src.reserves.compounds.find((q) => q.id === "bunker-compound"), site = src.planningMarkers.logSites.find((q) => q.id === "rack-desk-bunker");
  check("node", "bunker: B1e puts the footprint in bunker-compound, 109,76 to 124,89, walled, gates 109,84 to 109,86 (the brief's numbers); the door 116,83 is the B1e log site rack-desk-bunker",
    fp && fp.inCompound === "bunker-compound" && cq && cq.walled === true && JSON.stringify(cq.compoundBox) === JSON.stringify(COMP.box) && JSON.stringify(cq.gateTiles) === JSON.stringify(COMP.gates) && site && site.siteTile.join() === APPROVED.bunker.door.join(),
    cq ? `${JSON.stringify(cq.compoundBox)}, gates ${JSON.stringify(cq.gateTiles)}, log site ${site && site.siteTile}` : "no compound");
  const b = APPROVED.bunker.box, d = APPROVED.bunker.door;
  check("node", "bunker: the footprint and its door stand inside the compound's interior, clear of its wall line (3 tiles to the west wall, 2 to the north, 4 to the east, 5 rows below the door)",
    b.x0 > COMP.box.x0 && b.x1 < COMP.box.x1 && b.y0 > COMP.box.y0 && b.y1 < COMP.box.y1 && inComp(d[0], d[1]) && !onRing(d[0], d[1]), `gaps: west ${b.x0 - COMP.box.x0 - 1}, north ${b.y0 - COMP.box.y0 - 1}, east ${COMP.box.x1 - b.x1 - 1}, below the door ${COMP.box.y1 - d[1] - 1}`);
  // the compound (B3c3: its wall is real content now, in LAYER): tiles walkable unless the terrain or the content blocks them, then B3a's kit in memory
  const ring = RING;
  const footIn = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
  const bfs = (extra, from) => {
    const block = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) block[i] = m.coll[i] || LAYER.tiles[i] ? 1 : 0; for (const [x, y] of extra) block[y * W + x] = 1;
    const dist = new Int32Array(W * H).fill(-1), prev = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block[j] || dist[j] >= 0) continue; dist[j] = dist[i] + 1; prev[j] = i; q.push(j); } }
    const route = (to) => { const out = []; for (let i = to[1] * W + to[0]; i >= 0 && dist[i] >= 0; i = prev[i]) out.unshift([i % W, (i / W) | 0]); return dist[to[1] * W + to[0]] >= 0 ? out : null; };
    return { dist, route, block };
  };
  const ringSolid = ring.filter(([x, y]) => !m.coll[y * W + x] && LAYER.tiles[y * W + x]).length;
  for (const [label, extra] of [["the real wall", []], ["the real wall and B3a's proposed outpost kit and uplink (in memory)", KIT.map((k) => [k[1], k[2]])]]) {
    const spawn = [79, 79], fromSpawn = bfs(extra, spawn), routes = COMP.gates.map((g) => bfs(extra, g).route(d));
    const interior = []; for (let y = COMP.box.y0 + 1; y < COMP.box.y1; y++) for (let x = COMP.box.x0 + 1; x < COMP.box.x1; x++) if (!fromSpawn.block[y * W + x]) interior.push([x, y]);
    const cut = interior.filter(([x, y]) => fromSpawn.dist[y * W + x] < 0), toDoor = fromSpawn.route(d);
    const routeOk = routes.every((r) => r && r.slice(1).every(([x, y]) => inComp(x, y) && !onRing(x, y)) && r.every(([x, y]) => footIn(x, y) === 0));
    check("node", `the compound, ${label}: the door is reached on foot from each of the three gates inside the compound, over tiles with no foot-blocking pixels, and from the spawn through the gates; no ground inside the compound is cut off`,
      routeOk && toDoor && toDoor.some(([x, y]) => isGate(x, y)) && cut.length === 0 && ringSolid === 53,
      `${ring.length} wall tiles (${ringSolid} solid content on open terrain); gate to door ${routes.map((r) => (r ? r.length - 1 : "none")).join(", ")} steps; spawn to door ${toDoor ? toDoor.length - 1 : "none"} steps; ${interior.length} open interior tiles, ${cut.length} cut off${cut.length ? ": " + cut.slice(0, 6).join(" ") : ""}`);
  }
  const plain = bfs([], [79, 79]).route(d);
  check("node", "with the wall built (B3c3): the door is reached from the spawn through the entrance in 43 steps, as B3c2's in-memory ring predicted (41 with no wall)", !!plain && plain.some(([x, y]) => isGate(x, y)) && plain.length - 1 === 43, plain ? `${plain.length - 1} steps, through ${plain.filter(([x, y]) => isGate(x, y)).join(" ")}` : "no route");
}
{ // B3c3: the compound's wall, against the B1e source and the brief
  const r = RECS.find((q) => q.id === WALL_ID), cq = src.reserves.compounds.find((q) => q.id === WALL_ID), key = (l) => (l || []).map((p) => p.join()).sort().join(" ");
  check("node", "wall: the record bunker-compound is a wall naming the B1e compound bunker-compound, with placeholder art, no reserve, no door, no foot box",
    r && r.kind === "wall" && r.compound === WALL_ID && r.art === "placeholder" && !r.reserve && !r.doorTiles.length && !r.footPxBoxes.length && !r.room, r ? JSON.stringify({ kind: r.kind, compound: r.compound, art: r.art, doors: r.doorTiles.length, foot: r.footPxBoxes.length }) : "no record");
  check("node", "wall: its solid is the compound box's ring (109,76 to 124,89) less exactly the three gates: 53 tiles, the B1e compound's own box and gateTiles",
    r && key(r.tiles) === key(RING) && r.tiles.length === 53 && key(r.gapTiles) === key(COMP.gates) && cq && key(cq.gateTiles) === key(COMP.gates) && JSON.stringify(cq.compoundBox) === JSON.stringify(COMP.box), r ? `${r.tiles.length} tiles, openings ${key(r.gapTiles)}` : "");
  const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
  const terr = RING.filter(([x, y]) => m.coll[y * W + x] !== 0 || [6, 8, 10].includes(m.ground[y * W + x])), wet = RING.filter(([x, y]) => foot(x, y));
  check("node", "wall: every wall tile is on open terrain (no terrain flag, not a bridge, dock or the pad); the only one with foot-blocking pixels is the south-east corner 124,89, on the shore (B3a recorded it)",
    terr.length === 0 && wet.length === 1 && wet[0].join() === "124,89", `${terr.length} on blocked terrain; foot-blocking pixels on ${wet.map((p) => `${p} (${foot(...p)} px)`).join(", ") || "none"}`);
  const boxes = r ? r.drawnPxBoxes.map((b) => `${b.px0},${b.py0},${b.px1},${b.py1}`).sort().join(" ") : "", want = RING.map(([x, y]) => `${x * T},${y * T},${x * T + T - 1},${y * T + T - 1}`).sort().join(" ");
  check("node", "wall: its drawn boxes are its 53 tiles exactly, one each (the art is on every solid tile and nowhere else: no invisible collision, no art over open ground)", r && r.drawnPxBoxes.length === 53 && boxes === want, r ? `${r.drawnPxBoxes.length} boxes` : "");
  // closed and joined: every tile of the box's edge is wall or an opening, and each has exactly two neighbours along the edge
  const edge = []; for (let y = COMP.box.y0; y <= COMP.box.y1; y++) for (let x = COMP.box.x0; x <= COMP.box.x1; x++) if (onRing(x, y)) edge.push([x, y]);
  const lineAt = (x, y) => onRing(x, y), joins = edge.map(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => lineAt(x + dx, y + dy)).length);
  check("node", "wall: closed and joined: the box's whole edge (56 tiles) is wall or entrance, each tile joined to exactly two along it (4-connected, no corner touching only diagonally); all four corners are wall",
    edge.length === 56 && edge.every(([x, y]) => (r.tiles.some((p) => p[0] === x && p[1] === y)) !== isGate(x, y)) && joins.every((n) => n === 2) && CORNERS.every(([x, y]) => LAYER.tiles[y * W + x] === 1), `${edge.length} edge tiles, joins ${[...new Set(joins)].join("/")}`);
  // the entrance: three tiles on the west edge, open ground; walkable straight through each, between the posts
  const gi = COMP.gates.map(([x, y]) => ({ t: [x, y], g: m.ground[y * W + x], coll: m.coll[y * W + x], foot: foot(x, y), out: m.coll[y * W + x - 1] === 0 && !LAYER.tiles[y * W + x - 1], in: m.coll[y * W + x + 1] === 0 && !LAYER.tiles[y * W + x + 1] }));
  check("node", "entrance: the three gates 109,84 to 109,86 (3 tiles, 48 px) on the west edge, open ground with no foot-blocking pixel (109,84 and 109,85 the ops road's paving, 109,86 grass), open on both sides; the posts 109,83 and 109,87 are wall",
    gi.every((q) => q.coll === 0 && q.foot === 0 && q.out && q.in && !LAYER.tiles[q.t[1] * W + q.t[0]]) && gi.map((q) => q.g).join() === "4,4,3" && POSTS.every(([x, y]) => LAYER.tiles[y * W + x] === 1), gi.map((q) => `${q.t}: ground ${q.g}, foot ${q.foot}`).join("; "));
  const bfs2 = (from, block = (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
  const thru = COMP.gates.map(([, y]) => bfs2([107, y])[y * W + 111]);
  check("node", "entrance: from 107,y outside to 111,y inside is 4 steps for each gate row (straight through), and from 108,80 outside to 110,80 inside (2 tiles apart, through the wall) is far longer: the wall is only passable at the entrance",
    thru.every((n) => n === 4) && bfs2([108, 80])[80 * W + 110] > 8, `gate rows ${thru.join(", ")} steps; 108,80 to 110,80: ${bfs2([108, 80])[80 * W + 110]} steps`);
  // B3a's proposed kit and uplink stay placeable: open ground, inside, off the wall, the entrance, the door and the routes from it
  const sp = bfs2([79, 79]), d = APPROVED.bunker.door, fromGates = COMP.gates.map((g) => bfs2(g)), dDoor = bfs2(d);
  const onRoute = (x, y) => fromGates.some((dg) => dg[y * W + x] >= 0 && dg[y * W + x] + dDoor[y * W + x] === dg[d[1] * W + d[0]]);
  const kitBad = KIT.concat([["uplink stand", 121, 82]]).filter(([, x, y]) => m.coll[y * W + x] !== 0 || LAYER.tiles[y * W + x] || !inComp(x, y) || onRing(x, y) || foot(x, y) || (x === d[0] && y === d[1]) || sp[y * W + x] < 0);
  check("node", "B3a's proposed outpost kit and uplink places (and the uplink's stand 121,82) are still open, reachable ground inside the compound, off the wall, the entrance and the door, none with foot-blocking pixels",
    kitBad.length === 0, kitBad.length ? kitBad.map((q) => q.join(" ")).join("; ") : `${KIT.length + 1} places clear`);
  const shortest = KIT.filter(([, x, y]) => onRoute(x, y));
  check("node", "and none of them is on a shortest walk from any gate to the bunker's door (the required access stays clear)", shortest.length === 0, shortest.map((q) => q.join(" ")).join("; ") || "none on the way");
  // no new disconnected ground: everything the spawn reached on the terrain alone it still reaches, unless it's now solid, or (B3d1)
  // it is the inside of a record that says it closes ground in (encloses: the raptor yard's 42 tiles and, B3d2, the holding paddock's
  // 35, exactly, and nothing else)
  const before = bfs2([79, 79], (i) => m.coll[i] !== 0), lost = [], closed = new Set(RECS.filter((r) => r.encloses).flatMap((r) => r.inner.map(([x, y]) => y * W + x))); let interior = 0, closedLost = 0;
  for (let i = 0; i < W * H; i++) { if (before[i] >= 0 && sp[i] < 0 && !LAYER.tiles[i]) { if (closed.has(i)) closedLost++; else lost.push([i % W, (i / W) | 0]); } const x = i % W, y = (i / W) | 0; if (inComp(x, y) && !onRing(x, y) && sp[i] >= 0) interior++; }
  check("node", "no ground cut off: every tile the spawn reached on the terrain alone is still reached, unless content now stands on it or it is the inside of a record that encloses it (B3d1: the raptor yard's 42; B3d2: the holding paddock's 35; all of them); the compound's whole open interior is reached through the entrance", lost.length === 0 && closedLost === 77 && closed.size === 77 && interior > 100, `${lost.length} cut off${lost.length ? ": " + lost.slice(0, 6).join(" ") : ""}; ${closedLost} enclosed on purpose (of ${closed.size}); ${interior} compound interior tiles reached`);
  // the outside of each side: a walkable lane along it, reached from the spawn
  const lane = { north: [], west: [], south: [], east: [] };
  for (let x = 108; x <= 125; x++) lane.north.push([x, 75]);
  for (let y = 75; y <= 90; y++) lane.west.push([108, y]);
  for (let x = 108; x <= 123; x++) lane.south.push([x, 90]);
  for (let y = 75; y <= 88; y++) lane.east.push([125, y]);
  const laneBad = Object.entries(lane).flatMap(([k2, l]) => l.filter(([x, y]) => sp[y * W + x] < 0).map((p) => `${k2} ${p}`));
  const sea = [[124, 90], [125, 89]].map(([x, y]) => m.coll[y * W + x]);
  check("node", "outside: a walkable lane along every side (north row 75, west column 108, south row 90 to x 123, east column 125 to y 88), all reached from the spawn; the south-east corner meets the sea (124,90 and 125,89 are water), so the outside lanes don't join round it",
    laneBad.length === 0 && sea.every((c) => c !== 0), laneBad.length ? laneBad.slice(0, 6).join("; ") : `${Object.values(lane).reduce((a, l) => a + l.length, 0)} lane tiles; 124,90 and 125,89 coll ${sea.join(", ")}`);
}
// malformed building records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const RR = (o, id) => o.records.find((r) => r.id === id);
// a door on foot-blocking pixels: the one spot on the island where a 3 x 2 building on open ground would put its doorway on them
const FOOTDOOR = { id: "syn-wet-door", kind: "building", art: "placeholder", room: "bunker", drawnPxBoxes: [pxOf({ x0: 30, y0: 98, x1: 32, y1: 99 })], solid: { tileBoxes: [{ x0: 30, y0: 98, x1: 32, y1: 99 }] }, doorTiles: [[31, 100]] };
const BAD = [
  ["a building with no art", "buildings", (o) => { delete RR(o, "visitor").art; }],
  ["an art kind the game doesn't draw", "schema", (o) => { RR(o, "visitor").art = "sprite"; }],
  ["art on something that has none the game draws (a prop)", "schema", (o) => { const r = RR(o, "depot"); r.kind = "prop"; delete r.room; }],
  ["the depot as a landmark (B3d4a: a landmark has art, but stands on a landmark footprint and has no door)", "landmarks", (o) => { const r = RR(o, "depot"); r.kind = "landmark"; delete r.room; }],
  ["a room on something that isn't a building", "schema", (o) => { const r = RR(o, "depot"); r.kind = "station"; delete r.art; }],
  ["a room the game doesn't have", "schema", (o) => { RR(o, "visitor").room = "lobby"; }],
  ["two doors", "buildings", (o) => { RR(o, "visitor").doorTiles.push([85, 74]); }],
  ["no door", "buildings", (o) => { RR(o, "visitor").doorTiles = []; }],
  ["a side door", "buildings", (o) => { RR(o, "visitor").doorTiles = [[89, 71]]; }],
  ["a back door", "buildings", (o) => { RR(o, "visitor").doorTiles = [[84, 68]]; }],
  ["a door beside the front, past its corner", "buildings", (o) => { RR(o, "depot").doorTiles = [[108, 77]]; }],
  ["a footprint short of its reserve", "buildings", (o) => { const r = RR(o, "visitor"); r.solid.tileBoxes[0].x1 = 87; r.drawnPxBoxes = [pxOf({ x0: 80, y0: 69, x1: 87, y1: 73 })]; }],
  ["a footprint that isn't a rectangle", "buildings", (o) => { const r = RR(o, "depot"); r.solid.tileBoxes = [{ x0: 101, y0: 73, x1: 107, y1: 75 }, { x0: 101, y0: 76, x1: 106, y1: 76 }]; }],
  ["placeholder art narrower than the footprint (D1 too)", "buildings", (o) => { RR(o, "visitor").drawnPxBoxes[0].px1 -= 16; }],
  ["placeholder art wider than the footprint", "buildings", (o) => { RR(o, "visitor").drawnPxBoxes[0].px1 += 16; }],
  ["placeholder art reaching below the front edge", "buildings", (o) => { RR(o, "depot").drawnPxBoxes[0].py1 += 8; }],
  ["placeholder art in two boxes", "buildings", (o) => { RR(o, "depot").drawnPxBoxes.push(pxOf({ x0: 101, y0: 73, x1: 101, y1: 73 })); }],
  ["a doorway on foot-blocking pixels (31,100)", "buildings", (o) => { o.records.push(copy(FOOTDOOR)); }],
  ["the bunker's door on its back (north), toward the compound's wall", "buildings", (o) => { RR(o, "bunker").doorTiles = [[116, 78]]; }],
  ["the bunker one row short of its reserve", "buildings", (o) => { const r = RR(o, "bunker"); r.solid.tileBoxes[0].y1 = 81; r.drawnPxBoxes = [pxOf({ x0: 113, y0: 79, x1: 119, y1: 81 })]; r.doorTiles = [[116, 82]]; }],
  ["a building's solid outside its own reserve", "reserve", (o) => { RR(o, "depot").solid.tileBoxes[0].x0 = 100; RR(o, "depot").drawnPxBoxes = [pxOf({ x0: 100, y0: 73, x1: 107, y1: 76 })]; }]
];
// B3c3: malformed wall records, each alone: [label, the rule that must catch it, the change, what its message must say (optional)]
const WR = (o) => RR(o, WALL_ID);
const WBAD = [
  ["a wall with no art", "walls", (o) => { delete WR(o).art; }],
  ["an art kind the game doesn't draw, on the wall", "schema", (o) => { WR(o).art = "sprite"; }],
  // (B3d1: a fence has art now; art on a prop still isn't allowed)
  ["art on a prop", "schema", (o) => { o.records.push({ id: "syn-crate", kind: "prop", art: "placeholder", drawnPxBoxes: [pxOf({ x0: 33, y0: 90, x1: 33, y1: 90 })], solid: { tiles: [[33, 90]] } }); }],
  ["the wall's tiles listed instead of a ring (no compound box, no openings)", "walls", (o) => { const w = WR(o); w.solid = { tiles: RING.map((p) => p.slice()) }; w.drawnPxBoxes = RING.map(([x, y]) => pxOf({ x0: x, y0: y, x1: x, y1: y })); }, /one ring \(ringOfBox or ringOfHabitat\) and nothing else/],
  ["a drawn box of its own besides its tiles", "walls", (o) => { WR(o).drawnPxBoxes = [pxOf({ x0: 109, y0: 75, x1: 124, y1: 76 })]; }, /no drawn box of its own/],
  ["a foot box besides its ring", "walls", (o) => { WR(o).solid.footPxBoxes = [{ px0: 111 * T + 4, py0: 78 * T + 4, px1: 111 * T + 8, py1: 78 * T + 8 }]; }],
  ["the ring a tile wider than the compound's box", "walls", (o) => { WR(o).solid.ringOfBox.x1 = 125; }, /its ring is that compound's box 109,76 to 124,89/],
  ["the entrance narrowed to two gates", "walls", (o) => { WR(o).solid.ringOfBox.gapTiles.pop(); }, /its openings are exactly that compound's gates/],
  ["the entrance moved to the east wall", "walls", (o) => { WR(o).solid.ringOfBox.gapTiles = [[124, 84], [124, 85], [124, 86]]; }, /its openings are exactly that compound's gates/],
  ["an opening on a corner (a wall naming no compound)", "walls", (o) => { const w = WR(o); delete w.compound; w.solid.ringOfBox.gapTiles.push([124, 76]); }, /opening 124,76 is a corner/],
  ["an opening blocked by another record", "walls", (o) => { o.records.push({ id: "syn-gate-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 109, y0: 86, x1: 109, y1: 86 })], solid: { tiles: [[109, 86]] } }); }, /opening 109,86 isn't open ground/],
  ["the entrance closed (no openings): the inside cut off", "pockets", (o) => { WR(o).solid.ringOfBox.gapTiles = []; }],
  ["a compound on something that isn't a wall", "schema", (o) => { RR(o, "depot").compound = WALL_ID; }],
  ["a compound B1e doesn't wall (cottage-row)", "schema", (o) => { WR(o).compound = "cottage-row"; }]
];
for (const [label, rule, fn] of BAD) {
  let caught;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.map((q) => q[0]); }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed building: ${label} is caught by the ${rule} rule`, caught.includes(rule), caught.join(", ") || "NOT caught");
}
for (const [label, rule, fn, re] of WBAD) {
  let caught, said = [];
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.map((q) => q[0]); said = p.filter((q) => q[0] === rule).map((q) => q[1]); }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; said = [e.message]; }
  check("node", `malformed wall: ${label} is caught by the ${rule} rule${re ? ", saying why" : ""}`, caught.includes(rule) && (!re || said.some((q) => re.test(q))), `${caught.join(", ") || "NOT caught"}${re ? "; " + (said[0] || "").slice(0, 140) : ""}`);
}

/* ════════ 2. the game ════════ */
const toData = (c) => { const ctx = { window: {} }; vm.runInNewContext(serializeContent(c, { id: "home", sourceSha256: "0".repeat(64), terrainSha256: t.sourceSha256 }), ctx); return ctx.window.ISLAND_MAPS_STAGED_CONTENT.home; };
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const REAL_DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// a synthetic variant: the visitor centre's door moved off the middle (86,74), so the authored door, not the footprint's middle, must lead
const OFF = toData(compileContent(realWith((o) => { RR(o, "visitor").doorTiles = [[86, 74]]; }), src, m));
const F1 = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); return c.window.ISLAND_MAPS.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const SYS_KEYS = ["buildings", "stations", "creatures", "rex", "birds", "koi", "bots", "car", "rift", "volcano", "hatch"];
// the decoder's refusals, on the content preview: [label, change to the compiled content, message]
const cWith = (fn, base = REAL_DATA) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(base) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const REFUSE = [
  ["a building with no art", (c) => { delete DR(c, "visitor").art; }, /^content record visitor is a building with no art/],
  ["an art kind the game doesn't draw", (c) => { DR(c, "visitor").art = "sprite"; }, /^content record visitor\.art "sprite" isn't one of placeholder$/],
  // (B3d4a: a landmark has art now, so the depot turned into a landmark is refused by the landmark base's own shape, and art
  // on a kind with none yet is checked on a prop)
  ["art on something that isn't a building, a wall, a fence, a gate or a landmark", (c) => { const r = DR(c, "depot"); r.kind = "prop"; delete r.room; }, /^content record depot\.art "placeholder": only a building, a wall, a fence, a gate or a landmark has art/],
  ["the depot turned into a landmark (B3d4a: a landmark base has no door)", (c) => { const r = DR(c, "depot"); r.kind = "landmark"; delete r.room; }, /^content record depot is a landmark base: it blocks whole tiles, and it has no foot box, door/],
  ["a room on something that isn't a building", (c) => { const r = DR(c, "depot"); r.kind = "station"; delete r.art; }, /^content record depot\.room "depot": only a building has a room$/],
  ["a room the game doesn't have", (c) => { DR(c, "visitor").room = "lobby"; }, /^content record visitor\.room "lobby" isn't one of the game's rooms/],
  ["two doors", (c) => { DR(c, "visitor").doorTiles.push([85, 74]); }, /^content record visitor opens into a room, so it has exactly one door, not 2$/],
  ["a side door", (c) => { DR(c, "visitor").doorTiles = [[89, 71]]; }, /^content record visitor: its door 89,71 must be right in front of its footprint/],
  ["a footprint that isn't a rectangle", (c) => { DR(c, "depot").tiles.pop(); c.solidTiles--; }, /^content record depot: a building's solid must be one full rectangle/],
  ["placeholder art wider than the footprint", (c) => { DR(c, "visitor").drawnPxBoxes[0].px1 += 16; }, /^content record visitor: its placeholder art \(drawnPxBoxes\[0\]\) must cover the footprint exactly in width/],
  ["placeholder art reaching below the front edge", (c) => { DR(c, "depot").drawnPxBoxes[0].py1 += 8; }, /^content record depot: its placeholder art .* stand on its front edge/],
  ["placeholder art in two boxes", (c) => { DR(c, "depot").drawnPxBoxes.push({ px0: 1616, py0: 1168, px1: 1631, py1: 1183 }); }, /^content record depot: placeholder art is one drawn box, not 2$/],
  ["a doorway on foot-blocking pixels", (c) => { c.records.push({ id: "syn-wet-door", kind: "building", drawnPxBoxes: FOOTDOOR.drawnPxBoxes, tiles: [[30, 98], [31, 98], [32, 98], [30, 99], [31, 99], [32, 99]], footPxBoxes: [], doorTiles: [[31, 100]], art: "placeholder", room: "bunker" }); c.solidTiles += 6; }, /^content record syn-wet-door: its doorway \(504,1606\) is on the terrain's foot-blocking pixels/],
  // B3c3: the wall
  ["a wall with no art", (c) => { delete DR(c, WALL_ID).art; }, /^content record bunker-compound is a wall with no art/],
  // (B3d3: a gate has art now, so the wall turned into a gate is refused by the gate's own shape instead)
  ["the wall turned into a gate (B3d3: a gate has art, and is two posts on a marker)", (c) => { const r = DR(c, WALL_ID); r.kind = "gate"; delete r.compound; }, /^content record bunker-compound is a gate, so it stands on a marker and is named for it/],
  ["a compound on something that isn't a wall", (c) => { DR(c, "depot").compound = WALL_ID; }, /^content record depot\.compound "bunker-compound": only a wall walls in a compound$/],
  ["a wall tile with no art over it", (c) => { const r = DR(c, WALL_ID); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === 116 * T && b.py0 === 76 * T)); }, /no invisible collision/],
  ["wall art on a tile it doesn't block", (c) => { DR(c, WALL_ID).drawnPxBoxes.push(pxOf({ x0: 110, y0: 77, x1: 110, y1: 77 })); }, /its placeholder art is one tile on each of its solid tiles and nowhere else/],
  ["wall art reaching above its tile", (c) => { DR(c, WALL_ID).drawnPxBoxes[0].py0 -= 4; }, /its placeholder art is one tile on each of its solid tiles and nowhere else/],
  ["a hole in the wall that isn't an opening", (c) => { const r = DR(c, WALL_ID); r.tiles = r.tiles.filter((p) => !(p[0] === 116 && p[1] === 76)); r.drawnPxBoxes = r.drawnPxBoxes.filter((b) => !(b.px0 === 116 * T && b.py0 === 76 * T)); c.solidTiles--; }, /don't close round: 1(15|17),76 joins 1 \(a hole in it isn't one of its openings\)/],
  ["an opening on its own wall", (c) => { DR(c, WALL_ID).gapTiles.push([109, 83]); }, /its opening 109,83 is one of its own solid tiles/],
  ["an opening covered by another record's solid tile", (c) => { c.records.push({ id: "syn-gate-crate", kind: "prop", drawnPxBoxes: [pxOf({ x0: 109, y0: 85, x1: 109, y1: 85 })], tiles: [[109, 85]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; }, /its opening 109,85 isn't walkable/],
  ["a foot box on a wall", (c) => { const r = DR(c, WALL_ID); r.footPxBoxes.push({ px0: 109 * T + 2, py0: 76 * T + 2, px1: 109 * T + 5, py1: 76 * T + 5 }); c.footPixels += 16; }, /is a wall with foot boxes/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  artShort: ["the placeholder art one row short of the footprint", (s) => s.replace("h = b.py1 - b.py0 + 1, c = mkCanvas(); c.width = w; c.height = h;", "h = b.py1 - b.py0 + 1, c = mkCanvas(); c.width = w; c.height = h - 1;")],
  exitInside: ["walking out lands on the footprint's front row", (s) => s.replace("pi.x = doorX(bd); pi.y = (bd.y0 + bd.h) * T + 6;", "pi.x = doorX(bd); pi.y = (bd.y0 + bd.h) * T - 6;")],
  doorMiddle: ["the doorway taken from the footprint's middle, not the authored door", (s) => s.replace("function doorX(bd) { return bd.door ? bd.door[0] * T + 8 : (bd.x0 + bd.w / 2) * T; }", "function doorX(bd) { return (bd.x0 + bd.w / 2) * T; }")],
  buildingsOff: ["the content preview's buildings switched off", (s) => s.replace("buildings: all || CONTENT_PREVIEW,", "buildings: all,")],
  botsLeak: ["the bots switched on in the content preview (their stops, routes and pad aren't authored)", (s) => s.replace("bots: all,", "bots: all || CONTENT_PREVIEW,")],
  noShape: ["the decoder's building checks removed", (s) => s.replace("if (r.kind === \"building\") building(r, f, drawn);", "")],
  roomStations: ["the bunker room's rack and desk looked up among the landmarks again (STATIONS, empty in the preview)", (s) => s.replace('var v = it.kind === "station" ? ROOM_STATIONS.filter', 'var v = it.kind === "station" ? STATIONS.filter')],
  logLeak: ["a log counted in the content preview (the landmarks, and the logs with them, aren't migrated)", (s) => s.replace("logWait = SYS.stations && s.found && !found[s.id]", "logWait = s.found && !found[s.id]")],
  // B3c3
  wallsUndrawn: ["the walls left out of the scene (their collision with no art)", (s) => s.replace("if (WALLAT && fx >= 0", "if (false && WALLAT && fx >= 0")],
  wallArtShort: ["a wall piece's art one row short of its tile", (s) => s.replace("var P = WALL_STYLE[pc.wall.id] || WALL_STYLE.other, c = mkCanvas(); c.width = T; c.height = T;", "var P = WALL_STYLE[pc.wall.id] || WALL_STYLE.other, c = mkCanvas(); c.width = T; c.height = T - 1;")],
  noWallShape: ["the decoder's wall checks removed", (s) => s.replace('if (r.kind === "wall") wallShape(r, f, drawn);', "")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlay and its legend are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3c\d-(overlay|legend)/.test(WORLD));

const port = 9500 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), offPv = await startPreview(port + 2, { content: OFF }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    const plan = I2.walkTo(tt[0], tt[1], lo); if (plan === null) return { plan: null };
    const seen = []; let n = 0;
    for (; n < 4000; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
    const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], px: [p.x, p.y], seen };
  }, [from, to, loose]);
  const onSolid = (seen) => seen.filter(([x, y]) => LAYER.tiles[y * W + x]);
  // [E] at a doorway (pi 8 px below it, as doors.mjs stands), then the iris on the wall clock; returns the room entered
  const enter = async (P, dw) => {
    await P.I(([x, y]) => { const I2 = window.__island; I2.teleport(x, y + 8); I2.step(2); }, dw);
    const nb = await P.I(() => window.__island.preview().nearby);
    await P.page.keyboard.press("e");
    for (let k = 0; k < 20; k++) { await sleep(60); const r = await P.I(() => { window.__island.step(1); return window.__island.getState().room; }); if (r) break; }
    await sleep(250); await P.I(() => window.__island.step(1));
    return { nb, room: await P.I(() => window.__island.room()) };
  };
  // out through the room's door: walk down from the tile in front of it, holding the key on the game's own clock, until the
  // room is gone; then where pi stands, read before anything else moves
  const leave = async (P) => {
    await P.I(() => { const I2 = window.__island, R = I2.room(); I2.teleport(R.door * 16 + 8, (R.h - 2) * 16 + 10); I2.step(1); });
    await P.page.keyboard.down("ArrowDown");
    let out = null;
    for (let k = 0; k < 60 && !out; k++) { out = await P.I(() => { const I2 = window.__island; I2.step(1); const s = I2.getState(); return s.room ? null : { pi: s.pi }; }); if (!out) await sleep(25); }
    await P.page.keyboard.up("ArrowDown");
    return out;
  };
  // a phone opens on the start card (it stays on touch until one of its buttons is tapped, and covers the middle of the screen): tap "play", as a
  // player who wants to walk does ("take the tour" would start the tour, which the preview answers with "no landmarks on this island yet")
  const cardAway = async (P) => { const go = await P.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { const bb = await go.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(200); } };
  /* B3c2: the whole room pi is in, item by item: stand in front of it (8 px below its foot, where roomCandidates measures
     from), what [E] would use, then [E]: the dialog's title, its words (a SHA-256 and a length, never printed: the radio's
     display is a CTF's payload) and its links; 100 frames (1.7 s, past a log's 1.5 s) with it open; Escape. Then the logs */
  const sweep = async (P) => {
    const out = [], items = await P.I(() => window.__island.room().items);
    for (const [kind, sid, x, y, w0, h0] of items) {
      const w = sid === "desk" ? 3 : w0, x0 = sid === "desk" ? x - 1 : x, at = [x0 * T + w * T / 2, (y + h0) * T + 8];
      const nb = await P.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(2); return I2.preview().nearby; }, at);
      await P.page.keyboard.press("e"); await P.I(() => window.__island.step(2));
      const dl = await P.page.evaluate(async () => {
        const d = document.querySelector(".w-dialog"), txt = d.querySelector("#w-sr").textContent, h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
        return { open: !d.hidden, name: d.querySelector(".w-name").textContent, sha: [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""), len: txt.length, links: [...d.querySelectorAll(".w-links a")].map((a) => a.textContent + " " + a.getAttribute("href")) };
      });
      await P.I(() => window.__island.step(100));
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(2));
      out.push({ kind, id: sid, nb, ...dl });
    }
    return { items: out, found: await P.I(() => window.__island.getState().found) };
  };
  const sweepOk = (sw, n) => sw && sw.items.length === n && sw.items.every((it) => it.open && it.nb === (it.kind === "station" ? it.id : "roomitem") && it.len > 0);
  const sweepLine = (sw) => sw ? sw.items.map((it) => `${it.id || it.kind}: ${it.nb}, "${it.name}", ${it.len} chars, ${it.links.length} links`).join("; ") : "not entered";
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });

  // 2a. production: format 1, every system, its three buildings and their doors and rooms as before
  const pr = await open(`http://127.0.0.1:${port + 3}/${Q}`);
  if (pr.loaded) await pr.I(() => window.__island.step(180));          // a first visit hatches pi (2.2 s); an [E] before then only skips it
  const pv = pr.loaded ? await pr.I(() => window.__island.preview()) : null;
  const legacy = F1.buildings.map((b) => ({ id: b.id, x0: b.x0, y0: b.y0, w: b.w, h: b.h, room: b.room, doorway: [(b.x0 + b.w / 2) * T, (b.y0 + b.h) * T + 6] }));
  check(name, "production: format 1, no preview, every system on, its three buildings with sprites and the legacy doorways (the middle of each footprint's front)",
    pr.loaded && !pr.errs.length && pv.format === 1 && pv.previewMode === null && !pv.stagedPreview && !pv.terrainOnly && SYS_KEYS.every((k) => pv.sys[k] === true) &&
    JSON.stringify(pv.buildings.map((b) => ({ id: b.id, x0: b.x0, y0: b.y0, w: b.w, h: b.h, room: b.room, doorway: b.doorway }))) === JSON.stringify(legacy) && pv.buildings.every((b) => b.art === "sprite"),
    pv ? pv.buildings.map((b) => `${b.id} ${b.x0},${b.y0} ${b.w}x${b.h} door ${b.doorway}`).join("; ") : pr.errs.join("; "));
  const prDiag = pr.loaded ? await pr.page.evaluate(() => !!document.querySelector('[id^="b3c"]')) : null;
  check(name, "production: no content wall (format 1 draws its own compound walls, unchanged), no preview badge, no diagnostic overlay", pv && pv.walls.length === 0 && pv.wallDraws === 0 && !pv.badge && prDiag === false, pv ? `walls ${pv.walls.length}, wall draws ${pv.wallDraws}, badge ${pv.badge}, overlay ${prDiag}` : "");
  const ROOMS1 = pr.loaded ? await pr.I(() => window.__island.rooms()) : {};
  let SWEEP1 = null;
  for (const id of IDS) {
    const L = legacy.find((b) => b.id === id), e = pr.loaded ? await enter(pr, L.doorway) : null;
    if (id === "bunker" && e && e.room) SWEEP1 = await sweep(pr);                 // format 1's bunker, item by item (B3c2)
    const o = e && e.room ? await leave(pr) : null;
    check(name, `production: the ${id} as before: [E] at its doorway enters its room, walking out lands on the legacy doorway ${L.doorway} facing out`,
      e && e.nb === "building" && e.room && e.room.id === id && JSON.stringify(e.room.items) === JSON.stringify(ROOMS1[id].items) && o && o.pi.x === L.doorway[0] && o.pi.y === L.doorway[1] && o.pi.dir === "down",
      e ? `prompt ${e.nb}, room ${e.room && e.room.id}, out at ${o && [o.pi.x, o.pi.y]} ${o && o.pi.dir}` : "didn't load");
  }
  check(name, "production: inside the bunker every item answers [E] (the rack and the desk as landmarks, the rest as room items), and reading the rack and the desk counts both logs (format 1's progression, unchanged)",
    sweepOk(SWEEP1, ROOMS1.bunker ? ROOMS1.bunker.items.length : -1) && ["rack", "desk"].every((k) => SWEEP1.found.includes(k)), `${sweepLine(SWEEP1)}; logs ${SWEEP1 && JSON.stringify(SWEEP1.found)}`);
  check(name, "no page error, console error or uncaught exception in production", pr.errs.length === 0, pr.errs.slice(0, 3).join(" | "));
  await pr.ctx.close();

  // 2b. the terrain preview: as B2 left it
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => { const I2 = window.__island; I2.teleport(84 * 16 + 8, 74 * 16 + 14); I2.step(2); return { v: I2.preview(), walk: [I2.tile(84, 71).walkable, I2.tile(104, 75).walkable, I2.tile(116, 80).walkable], wallWalk: [[109, 76], [116, 76], [124, 80], [109, 83], [109, 87], [124, 89]].map(([x, y]) => I2.tile(x, y).walkable) }; }) : null;
  check(name, "terrain preview: terrain mode, a staged preview, every home system off, no buildings, nothing at the visitor centre's door, the footprints walkable terrain",
    tp.loaded && !tp.errs.length && tv.v.previewMode === "terrain" && tv.v.terrainOnly && tv.v.stagedPreview && SYS_KEYS.every((k) => tv.v.sys[k] === false) && tv.v.buildings.length === 0 && tv.v.nearby === null && tv.v.content === null && tv.walk.every(Boolean) && tv.v.badge && tv.v.saveLocked,
    tv ? `sys ${JSON.stringify(tv.v.sys)}, buildings ${tv.v.buildings.length}, nearby ${tv.v.nearby}` : tp.errs.join("; "));
  check(name, "terrain preview (B3c3): no wall, none drawn, and the wall's tiles are plain walkable terrain there", tv && tv.v.walls.length === 0 && tv.v.wallDraws === 0 && tv.wallWalk.every(Boolean), tv ? `walls ${tv.v.walls.length}, draws ${tv.v.wallDraws}, walkable ${tv.wallWalk.join(",")}` : "");
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;

  // 2c. the content preview: the buildings
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  check(name, "content preview: content mode, a staged preview (not terrain-only), only the buildings system on, its badge, save locked",
    cp.loaded && !cp.errs.length && cv.previewMode === "content" && cv.stagedPreview && !cv.terrainOnly && cv.sys.buildings === true && SYS_KEYS.filter((k) => k !== "buildings").every((k) => cv.sys[k] === false) && cv.badge && cv.saveLocked,
    cv ? JSON.stringify(cv.sys) : cp.errs.join("; "));
  check(name, "content preview: no other system runs (no critters, bots, drones, birds, koi, stations, car, rex, gate, volcano or arena)",
    cv && Object.entries(cv.systems).every(([k, v]) => (k === "buildings" ? v === IDS.length : v === 0 || v === false)), cv ? JSON.stringify(cv.systems) : "");
  check(name, "content preview: its three buildings, each where its record puts it (footprint, door, room, placeholder art over the footprint)",
    cv && cv.buildings.map((b) => b.id).join() === IDS.join() && cv.buildings.every((b) => { const A = APPROVED[b.id]; return b.x0 === A.box.x0 && b.y0 === A.box.y0 && b.w === A.box.x1 - A.box.x0 + 1 && b.h === A.box.y1 - A.box.y0 + 1 && b.door.join() === A.door.join() && b.doorway.join() === doorway(b.id).join() && b.room === A.room && b.art === "placeholder" && b.name === A.name && JSON.stringify(b.box) === JSON.stringify(pxOf(A.box)); }),
    cv ? cv.buildings.map((b) => `${b.id} ${b.x0},${b.y0} ${b.w}x${b.h} door ${b.door} room ${b.room}`).join("; ") : "");
  if (cp.loaded) {
    // the painter: both locked digests with the buildings drawn (they're drawn in the object layer, never on the ground)
    await cp.I(() => { const I2 = window.__island; I2.teleport(84 * 16 + 8, 76 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, buildings drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && tDig.td === TERRAIN_SHA && tDig.gd === GROUND_SHA && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    // collision: exactly the footprints, on top of the terrain's
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the three footprints, the compound's wall, the paddock fences (B3d1's raptor yard, B3d2's holding paddock) B3d3's koi garden wall and park gate posts, and B3d4a's tower and lighthouse bases: 101 + 53 + 30 + 36 + 53 + 2 + 9 + 4 = 288 tiles; the terrain's layer is the compiler's, gameplay is their union", lay && LAYER.tiles.reduce((a, v) => a + v, 0) === 288);
    for (const id of IDS) {
      const A = APPROVED[id], b = pxOf(A.box);
      const edge = await cp.I(([b]) => {
        const I2 = window.__island, inside = [], outside = [];
        for (let x = b.px0; x <= b.px1; x++) { inside.push([x, b.py0], [x, b.py1]); outside.push([x, b.py0 - 1], [x, b.py1 + 1]); }
        for (let y = b.py0; y <= b.py1; y++) { inside.push([b.px0, y], [b.px1, y]); outside.push([b.px0 - 1, y], [b.px1 + 1, y]); }
        let all = 0; for (let y = b.py0; y <= b.py1; y += 3) for (let x = b.px0; x <= b.px1; x += 3) if (!I2.blocked(x, y)) all++;
        return { inBad: inside.filter(([x, y]) => !I2.blocked(x, y)).length, outBad: outside.filter(([x, y]) => I2.blocked(x, y) !== I2.terrainBlocked(x, y)).length, inner: all, n: outside.length };
      }, [b]);
      check(name, `${id}: every pixel on and inside the footprint's edge blocks feet; the ${edge.n} pixels just outside it answer exactly as the terrain does`, edge.inBad === 0 && edge.outBad === 0 && edge.inner === 0, JSON.stringify(edge));
    }
    // the art: opaque over the whole footprint, drawn exactly there
    for (const id of IDS) {
      const A = APPROVED[id], b = pxOf(A.box), art = await cp.I((i) => { const a = window.__island.buildingArt(i); delete a.png; return a; }, id);
      const drawn = (await cp.I(() => window.__island.preview())).buildings.find((q) => q.id === id).drawn;
      check(name, `${id}: its placeholder art is ${b.px1 - b.px0 + 1} x ${b.py1 - b.py0 + 1}, every pixel fully opaque, and it was drawn at the footprint's own origin`,
        art.w === b.px1 - b.px0 + 1 && art.h === b.py1 - b.py0 + 1 && art.opaque === art.pixels && drawn && drawn.join() === [b.px0, b.py0, art.w, art.h].join(), `${art.w} x ${art.h}, ${art.opaque} of ${art.pixels} opaque, drawn at ${drawn}`);
    }
    // the art on screen: the same frame with and without the building (the terrain preview at the same spot and step): it covers the footprint
    for (const id of IDS) {
      // pi stands right behind it (its back row + 1): the whole footprint in the 1280 x 800 frame, below pi's feet, so nothing of pi's over it
      const A = APPROVED[id], stand = [A.door[0] * T + 8, (A.box.y0 - 1) * T + 10];
      const grab = (P) => P.I(([s, b]) => {
        const I2 = window.__island; I2.teleport(s[0], s[1]); for (let i = 0; i < 6; i++) I2.step(1);
        if (Math.abs(I2.preview().zoom - 1) > 1e-4) return { zoom: I2.preview().zoom };
        const v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), g = c.getContext("2d");
        const x0 = Math.ceil((b.px0 - v.camera[0]) * E), y0 = Math.ceil((b.py0 - v.camera[1]) * E), x1 = Math.floor((b.px1 + 1 - v.camera[0]) * E) - 1, y1 = Math.floor((b.py1 + 1 - v.camera[1]) * E) - 1;
        const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(c.width - 1, x1), cy1 = Math.min(c.height - 1, y1);
        return { full: (x1 - x0 + 1) * (y1 - y0 + 1), rect: [cx0, cy0, cx1, cy1], px: Array.from(g.getImageData(cx0, cy0, cx1 - cx0 + 1, cy1 - cy0 + 1).data) };
      }, [stand, pxOf(A.box)]);
      // the opening zoom (2.6 to 1) settled in both, then the same game time (t moves one STEP a step), so nothing but the building differs
      for (const P of [cp, tp]) if (P.loaded) await P.I(() => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); });
      if (tp.loaded) { const ta = await cp.I(() => window.__island.getState().t), tb = await tp.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await tp.I((n) => window.__island.step(n), k); else if (k < 0) await cp.I((n) => window.__island.step(n), -k); }
      const a = await grab(cp), bq = tp.loaded ? await grab(tp) : null;
      let diff = 0, n = 0; if (bq && a.rect.join() === bq.rect.join()) for (let i = 0; i < a.px.length; i += 4) { n++; if (a.px[i] !== bq.px[i] || a.px[i + 1] !== bq.px[i + 1] || a.px[i + 2] !== bq.px[i + 2]) diff++; }
      check(name, `${id}: on screen, the frame differs from the terrain preview's over the whole footprint (the art is visible over every solid pixel)`, n > 0 && n === a.full && diff / n >= 0.995,
        `${diff} of ${n} screen pixels in the footprint differ (${(100 * diff / Math.max(1, n)).toFixed(2)}%), ${n} of ${a.full} on screen` + (bq && a.rect && bq.rect && a.rect.join() !== bq.rect.join() ? `; the two frames' cameras differ (${a.rect} vs ${bq.rect})` : "") + (a.zoom || (bq && bq.zoom) ? `; zoom not settled` : ""));
    }
    // the door: walkable, safe, feet fit; [E] there says "enter"
    for (const id of IDS) {
      const A = APPROVED[id], dw = doorway(id);
      const d = await cp.I(([dt, dw]) => { const I2 = window.__island; let feet = false; for (let y = dw[1] - 2; y <= dw[1] + 1; y++) for (let x = dw[0] - 4; x <= dw[0] + 4; x++) if (I2.blocked(x, y)) feet = true;
        I2.teleport(dw[0], dw[1] + 8); I2.step(2); return { tile: I2.tile(dt[0], dt[1]), safe: I2.safe(dt[0], dt[1]), feet, nb: I2.preview().nearby }; }, [A.door, dw]);
      check(name, `${id}: the door tile ${A.door} is walkable and safe ground, pi's feet fit in the doorway ${dw}, and [E] there would use the building`, d.tile.walkable && !d.tile.content && d.safe && !d.feet && d.nb === "building", JSON.stringify(d));
    }
    // reached from the spawn on foot, the update loop walking, never on the building
    for (const id of IDS) {
      const A = APPROVED[id], r = await walk(cp, cv.spawn, A.door);
      check(name, `${id}: walked from the spawn to its door ${A.door} on the update loop, never on a building tile`, r.plan !== null && r.at.join() === A.door.join() && !onSolid(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan, ended ${r.at}`);
    }
    // in, the room, an item, and out
    for (const id of IDS) {
      const A = APPROVED[id], dw = doorway(id), e = await enter(cp, dw);
      check(name, `${id}: [E] at the doorway goes in: the room is format 1's ${A.room} (its name, size, door, every item and what each says)`, e.nb === "building" && e.room && e.room.id === A.room && JSON.stringify({ ...e.room, id: undefined }) === JSON.stringify({ ...ROOMS1[A.room], id: undefined }),
        e.room ? `${e.room.name}, ${e.room.w} x ${e.room.h}, door ${e.room.door}, ${e.room.items.length} items` : `prompt ${e.nb}, not entered`);
      if (!e.room) continue;
      if (id === "bunker") {   // B3c2: the whole room, item by item, against format 1's
        const sw = await sweep(cp);
        const same = SWEEP1 && sweepOk(sw, SWEEP1.items.length) && sw.items.every((it, i) => { const f = SWEEP1.items[i]; return it.kind === f.kind && it.id === f.id && it.nb === f.nb && it.name === f.name && it.sha === f.sha && it.len === f.len && JSON.stringify(it.links) === JSON.stringify(f.links); });
        check(name, "bunker: inside, every item (the rack, the desk, the monitors, shelf, cot, map table, UPS bank and radio) answers [E] exactly as in format 1: the same prompt, dialog title, words and links", same, sweepLine(sw));
        check(name, "bunker: reading the rack and the desk counts no log in the preview (the landmarks, and the logs with them, aren't migrated; format 1 counted both above)", sw.found.length === 0, `logs ${JSON.stringify(sw.found)}`);
      } else {
        const item = id === "visitor" ? { at: [168, 74], kind: "counter" } : { at: [144, 90], kind: "charger" };
        const it = await cp.I(async (q) => { const I2 = window.__island; I2.teleport(q.at[0], q.at[1]); I2.step(2); const nb = I2.preview().nearby; return nb; }, item);
        await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(2));
        const dl = await cp.page.evaluate(() => { const d = document.querySelector(".w-dialog"); return { open: !d.hidden, name: d.querySelector(".w-name").textContent }; });
        await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(2));
        check(name, `${id}: inside, the ${item.kind} answers [E] as in format 1 (a room item, its dialog under the room's name)`, it === "roomitem" && dl.open && dl.name === ROOMS1[A.room].name, `nearby ${it}, dialog ${JSON.stringify(dl)}`);
      }
      const o = await leave(cp);
      const after = o ? await cp.I(([dt]) => { const I2 = window.__island, p = I2.getState().pi; let feet = false; for (let y = p.y - 2; y <= p.y + 1; y++) for (let x = p.x - 4; x <= p.x + 4; x++) if (I2.blocked(x, y)) feet = true;
        return { tile: [Math.floor(p.x / 16), Math.floor(p.y / 16)], feet, safe: I2.safe(dt[0], dt[1]), home: I2.walkTo(79, 79, false) }; }, [A.door]) : null;
      check(name, `${id}: walking out lands on the doorway ${dw}, facing out, on the door tile (safe, feet clear), with a way home`,
        o && o.pi.x === dw[0] && o.pi.y === dw[1] && o.pi.dir === "down" && after.tile.join() === A.door.join() && !after.feet && after.safe && after.home !== null, o ? `out at ${o.pi.x},${o.pi.y} ${o.pi.dir}, ${JSON.stringify(after)}` : "never came out");
      const away = await walk(cp, null, [A.door[0], A.door[1] + 2]);
      check(name, `${id}: and walks away from the door (2 tiles south) on the update loop`, away.plan !== null && away.at.join() === [A.door[0], A.door[1] + 2].join(), away.plan === null ? "no path" : `ended ${away.at}`);
    }
    // B3c2: repeated, five times in and out of each building in a row, the same room and the same doorway every time; then home
    for (const id of IDS) {
      const A = APPROVED[id], dw = doorway(id), runs = [];
      for (let k = 0; k < 5; k++) { const e = await enter(cp, dw), o = e.room ? await leave(cp) : null; runs.push(!!(e.nb === "building" && e.room && e.room.id === A.room && o && o.pi.x === dw[0] && o.pi.y === dw[1] && o.pi.dir === "down")); }
      const home = await walk(cp, null, [79, 79]);
      check(name, `${id}: five enter and leave cycles in a row, each into ${A.room} and out onto the doorway facing out; then pi walks home to the spawn`, runs.every(Boolean) && home.plan !== null && home.at.join() === "79,79", `${runs.filter(Boolean).length} of 5 cycles; home ${home.plan === null ? "no path" : home.at}`);
    }
    // B3c2: all three in one go, on foot from the spawn: each door, in, out, on to the next
    { await cp.I(() => { const I2 = window.__island; I2.teleport(79 * 16 + 8, 79 * 16 + 10); I2.step(1); }); const seq = []; let ok = true;
      for (const id of IDS) {
        const A = APPROVED[id], w = await walk(cp, null, A.door), e = await enter(cp, doorway(id)), o = e.room ? await leave(cp) : null;
        ok = ok && w.plan !== null && w.at.join() === A.door.join() && !onSolid(w.seen).length && e.room && e.room.id === A.room && o && o.pi.x === doorway(id)[0] && o.pi.y === doorway(id)[1];
        seq.push(`${id} ${w.plan === null ? "no path" : w.plan + " tiles"}, ${e.room ? e.room.id : "not entered"}, ${o ? "out" : "stuck"}`);
      }
      const home = await walk(cp, null, [79, 79]);
      check(name, "all three buildings together: from the spawn, on foot, to each door in turn (visitor, depot, bunker), in and out of each, then home", ok && home.at && home.at.join() === "79,79", seq.join("; ") + `; home ${home.plan === null ? "no path" : home.at}`); }
    // B3c2 (B3c3: the wall is built now): from each west gate tile to the bunker's door inside the compound, and from the spawn to the gate
    for (const g of COMP.gates) {
      const r = await walk(cp, [g[0] * T + 8, g[1] * T + 10], APPROVED.bunker.door);
      const off = r.seen ? r.seen.filter(([x, y]) => !(isGate(x, y) || (inComp(x, y) && !onRing(x, y)))) : [], kit = r.seen ? r.seen.filter(([x, y]) => KIT.some((q) => q[1] === x && q[2] === y)) : [];
      check(name, `the compound: from the gate ${g} pi walks to the bunker's door on the update loop, every tile on the way a gate or inside the compound (never its wall), none on B3a's proposed kit, never on content`,
        r.plan !== null && r.at.join() === APPROVED.bunker.door.join() && !off.length && !kit.length && !onSolid(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan, ended ${r.at}${off.length ? "; outside: " + off.join(" ") : ""}${kit.length ? "; on kit: " + kit.join(" ") : ""}`);
    }
    { const r = await walk(cp, cv.spawn, [109, 85]);
      check(name, "the compound: its middle gate 109,85 (where the ops road ends) is reached from the spawn on the update loop", r.plan !== null && r.at.join() === "109,85" && !onSolid(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan, ended ${r.at}`); }
    // paths go round each building
    for (const [id, a, b] of [["visitor", [78, 71], [90, 71]], ["visitor", [84, 67], [84, 75]], ["depot", [99, 75], [109, 75]], ["depot", [104, 72], [104, 78]], ["bunker", [111, 80], [121, 80]], ["bunker", [116, 77], [116, 84]]]) {
      const r = await walk(cp, [a[0] * T + 8, a[1] * T + 10], b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      check(name, `${id}: a walk from ${a} to ${b} (across it) goes round the building, never on it`, r.plan !== null && r.at.join() === b.join() && !onSolid(r.seen).length && r.plan > straight, r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight would be ${straight}), ended ${r.at}`);
    }
    // pushed against each side (PUSH): pi stops at the wall
    for (const [id, side, at, key] of PUSH) {
      const b = pxOf(APPROVED[id].box);
      await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(1); }, at);
      await cp.page.keyboard.down(key); const p = await cp.I(() => { const I2 = window.__island; for (let f = 0; f < 150; f += 2) I2.step(2); return I2.getState().pi; }); await cp.page.keyboard.up(key);
      // move() tests the pixel the feet would reach: x + 4 going east, x - 4 west, y - 2 north, y + 1 south. stopped flush: that edge
      // short of the wall, by more than nothing and at most 3 px (one frame's step at most)
      const gap = side === "front" ? (p.y - 2) - b.py1 : side === "back" ? b.py0 - (p.y + 1) : side === "west" ? b.px0 - (p.x + 4) : (p.x - 4) - b.px1;
      check(name, `${id}: pi walked into its ${side} wall stops flush against it (feet outside the footprint, within 3 px of it)`, gap > 0 && gap <= 3, `pi at ${p.x.toFixed(2)},${p.y.toFixed(2)}, ${gap.toFixed(2)} px from the wall`);
    }
    // no trapped ground: every walkable tile within 3 of a footprint still reaches the spawn
    const trap = await cp.I(([boxes]) => {
      const I2 = window.__island, bad = []; let n = 0;
      for (const b of boxes) for (let y = b.y0 - 3; y <= b.y1 + 3; y++) for (let x = b.x0 - 3; x <= b.x1 + 3; x++) {
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) continue;
        if (!I2.tile(x, y).walkable) continue; n++;
        I2.teleport(x * 16 + 8, y * 16 + 10); if (I2.walkTo(79, 79, false) === null) bad.push([x, y]);
      }
      return { n, bad };
    }, [IDS.map((i) => APPROVED[i].box)]);
    check(name, `no trapped ground: all ${trap.n} walkable tiles within 3 of any footprint have a path to the spawn from pi's feet there`, trap.n > 100 && trap.bad.length === 0, trap.bad.length ? `cut off: ${trap.bad.slice(0, 6).join(" ")}` : "");
    /* ════ B3c3: the compound's wall ════ */
    {
      const wv = (await cp.I(() => window.__island.preview())).walls, sortK = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k2) => [k2, o[k2]]));
      check(name, "wall: the content preview has the compound's wall as its record says: 53 tiles, the three west gates as its openings; 40 runs, 7 piers, 4 corners and the 2 posts beside the entrance",
        wv.map((q) => q.id).join() === WALL_ID + ",koi-garden" && wv[0].id === WALL_ID && wv[0].compound === WALL_ID && wv[0].tiles === 53 && !wv[0].terrain.length && JSON.stringify(wv[0].gaps) === JSON.stringify(COMP.gates) && sortK(wv[0].kinds) === sortK({ corner: 4, run: 40, pier: 7, post: 2 }), JSON.stringify(wv));
      const art = await cp.I((id) => { const a = window.__island.wallArt(id); delete a.png; return a; }, WALL_ID);
      const kindAt = (x, y) => (art.pieces.find((q) => q.tile[0] === x && q.tile[1] === y) || {}).kind;
      check(name, "wall: every piece of its art is one 16 x 16 tile, all 256 pixels fully opaque, one on each of its 53 tiles; the corners are corner blocks and the two tiles beside the entrance are its posts",
        art.pieces.length === 53 && art.pieces.every((q) => q.w === T && q.h === T && q.opaque === 256) && RING.every(([x, y]) => kindAt(x, y)) && CORNERS.every(([x, y]) => kindAt(x, y) === "corner") && POSTS.every(([x, y]) => kindAt(x, y) === "post"),
        `${art.pieces.length} pieces, ${art.pieces.filter((q) => q.opaque === 256).length} fully opaque; corners ${CORNERS.map((c) => kindAt(...c)).join("/")}, posts ${POSTS.map((c) => kindAt(...c)).join("/")}`);
      // collision, pixel by pixel: every wall pixel blocks feet, no entrance pixel does, and the pixels round the wall answer as the terrain does
      const wc = await cp.I(([ring, gates]) => {
        const I2 = window.__island, isR = new Set(ring.map((p) => p.join())), isG = new Set(gates.map((p) => p.join()));
        let n = 0, open = 0, under = 0, gb = 0, rim = 0, rimBad = 0;
        for (const [x, y] of ring) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) { n++; if (!I2.blocked(px, py)) open++; if (I2.terrainBlocked(px, py)) under++; }
        for (const [x, y] of gates) for (let py = y * 16; py < y * 16 + 16; py++) for (let px = x * 16; px < x * 16 + 16; px++) if (I2.blocked(px, py)) gb++;
        for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (isR.has(nx + "," + ny) || isG.has(nx + "," + ny)) continue;
          for (let k = 0; k < 16; k++) { const px = dx ? (dx > 0 ? nx * 16 : nx * 16 + 15) : x * 16 + k, py = dy ? (dy > 0 ? ny * 16 : ny * 16 + 15) : y * 16 + k; rim++; if (I2.blocked(px, py) !== I2.terrainBlocked(px, py)) rimBad++; }
        }
        return { n, open, under, gb, rim, rimBad };
      }, [RING, COMP.gates]);
      check(name, `wall: all ${wc.n} pixels of its 53 tiles block feet (on the terrain alone ${wc.under} of them would: the shore's at 124,89); none of the entrance's 768 does; the ${wc.rim} pixels touching the wall from outside and inside answer exactly as the terrain does`,
        wc.n === 53 * 256 && wc.open === 0 && wc.gb === 0 && wc.rimBad === 0, JSON.stringify(wc));
      const tl = await cp.I(([ring, gates]) => { const I2 = window.__island; return { wall: ring.filter(([x, y]) => { const q = I2.tile(x, y); return q.walkable || !q.content || I2.safe(x, y); }).length, gate: gates.filter(([x, y]) => { const q = I2.tile(x, y); return !q.walkable || q.content || !I2.safe(x, y); }).length }; }, [RING, COMP.gates]);
      check(name, "wall: its tiles are content, not walkable and not safe ground; the entrance's three are walkable safe ground with no content", tl.wall === 0 && tl.gate === 0, JSON.stringify(tl));
      // pi walked into each side, from outside and inside: stops flush (feet within 3 px of the wall), feet never on a solid pixel
      const face = { north: [76, 76], south: [89, 89], west: [109, 109], east: [124, 124] };
      const pushed = async (at, keys) => {
        await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(1); }, at);
        for (const k2 of keys) await cp.page.keyboard.down(k2);
        const r = await cp.I(() => { const I2 = window.__island; let bad = 0, worst = null; for (let f = 0; f < 150; f += 2) { I2.step(2); const p = I2.getState().pi; if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) { bad++; worst = [p.x, p.y]; } } return { p: I2.getState().pi, bad, worst }; });
        for (const k2 of keys) await cp.page.keyboard.up(k2);
        return r;
      };
      for (const [side, from, at, key] of WPUSH) {
        const r = await pushed(at, [key]), p = r.p, row = face[side][0];
        const gap = side === "north" ? (from === "outside" ? row * T - (p.y + 1) : (p.y - 2) - (row * T + T - 1)) : side === "south" ? (from === "outside" ? (p.y - 2) - (row * T + T - 1) : row * T - (p.y + 1))
          : side === "west" ? (from === "outside" ? row * T - (p.x + 4) : (p.x - 4) - (row * T + T - 1)) : (from === "outside" ? (p.x - 4) - (row * T + T - 1) : row * T - (p.x + 4));
        check(name, `wall: pi walked into its ${side} side from ${from} stops flush against it (feet within 3 px), feet never on a solid pixel on the way`, gap > 0 && gap <= 3 && r.bad === 0, `pi at ${p.x.toFixed(2)},${p.y.toFixed(2)}, ${gap.toFixed(2)} px from the wall${r.bad ? `; feet on solid ${r.bad} times, at ${r.worst}` : ""}`);
      }
      for (const [corner, from, at, keys] of CPUSH) {
        const r = await pushed(at, keys), tx = Math.floor(r.p.x / T), ty = Math.floor(r.p.y / T), inside = inComp(tx, ty) && !onRing(tx, ty);
        check(name, `wall: pi walked diagonally into its ${corner} corner from ${from} slides or stops there: never through the corner, feet never on a solid pixel, still ${from}`,
          r.bad === 0 && !onWall(tx, ty) && (from === "inside") === inside, `ended on ${tx},${ty} (${inside ? "inside" : "outside"})${r.bad ? `; feet on solid ${r.bad} times` : ""}`);
      }
      // through the entrance: straight through each gate, between the posts
      for (const [gx, gy] of COMP.gates) {
        const r = await walk(cp, [107 * T + 8, gy * T + 10], [111, gy]);
        check(name, `entrance: pi walks straight through the gate ${gx},${gy} on the update loop (107,${gy} outside to 111,${gy} inside, every tile on row ${gy})`, r.plan !== null && r.at.join() === `111,${gy}` && r.seen.every(([, y]) => y === gy) && r.seen.some(([x, y]) => x === gx && y === gy) && !onSolid(r.seen).length, r.plan === null ? "no path" : `a ${r.plan}-tile plan through ${r.seen.join(" ")}`);
      }
      // across the wall: the planner goes round through the entrance, never across a wall tile
      for (const [side, a, b] of [["north", [116, 74], [116, 78]], ["east", [126, 80], [122, 80]], ["south", [116, 91], [116, 87]], ["west", [107, 80], [111, 80]]]) {
        const r = await walk(cp, [a[0] * T + 8, a[1] * T + 10], b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        check(name, `planner: from outside the ${side} wall (${a}) to just inside it (${b}), pi goes round and in through the entrance on the update loop, never on the wall`,
          r.plan !== null && r.at.join() === b.join() && r.seen.some(([x, y]) => isGate(x, y)) && !onSolid(r.seen).length && r.plan > straight + 4, r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight would be ${straight}), through ${r.seen.filter(([x, y]) => isGate(x, y)).join(" ")}`);
      }
      for (const loose of [false, true]) {
        const r = await walk(cp, [122 * T + 8, 80 * T + 10], [124, 80], loose);
        check(name, `planner: a walk${loose ? " (loose)" : ""} to a wall tile (124,80) from inside ends on open ground beside it, never on the wall`, r.plan !== null && !onSolid(r.seen).length && !onWall(...r.at) && Math.abs(r.at[0] - 124) + Math.abs(r.at[1] - 80) <= 2, r.plan === null ? "no path" : `ended ${r.at}`);
      }
      // round the outside, along each side
      for (const [side, a, b] of [["north", [108, 75], [125, 75]], ["west", [108, 75], [108, 90]], ["south", [108, 90], [122, 90]], ["east", [125, 75], [125, 87]]]) {
        const r = await walk(cp, [a[0] * T + 8, a[1] * T + 10], b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        check(name, `outside: pi walks the length of the ${side} side outside the wall (${a} to ${b}) on the update loop, beside it all the way, never on it`, r.plan !== null && r.at.join() === b.join() && !onSolid(r.seen).length && r.seen.every(([x, y]) => !inComp(x, y)), r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight ${straight}), ended ${r.at}`);
      }
      // the whole visit: from the spawn in through the entrance to the bunker, in, an item, out, and back out through the entrance
      { await cp.I(() => { const I2 = window.__island; I2.teleport(79 * 16 + 8, 79 * 16 + 10); I2.step(1); });
        const A = APPROVED.bunker, w1 = await walk(cp, null, A.door), e = await enter(cp, doorway("bunker"));
        let it = null; if (e.room) { it = await cp.I(() => { const I2 = window.__island, R = I2.room(), q = R.items.find((x) => x[0] !== "station"); I2.teleport(q[2] * 16 + (q[4] || 1) * 8, (q[3] + (q[5] || 1)) * 16 + 8); I2.step(2); return I2.preview().nearby; });
          await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(2)); it = it + "/" + (await cp.page.evaluate(() => !document.querySelector(".w-dialog").hidden)); await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(2)); }
        const o = e.room ? await leave(cp) : null, w2 = o ? await walk(cp, null, [105, 85]) : null;
        check(name, "the whole visit: from the spawn, in through the entrance to the bunker's door, [E] in, a room item answers, out onto the doorway, and back out of the compound through the entrance to 105,85, never on the wall",
          w1.plan !== null && w1.seen.some(([x, y]) => isGate(x, y)) && !onSolid(w1.seen).length && e.room && e.room.id === "bunker" && it === "roomitem/true" && o && o.pi.x === doorway("bunker")[0] && o.pi.y === doorway("bunker")[1] && w2 && w2.at.join() === "105,85" && w2.seen.some(([x, y]) => isGate(x, y)) && !onSolid(w2.seen).length,
          `in: ${w1.plan} tiles via ${w1.seen.filter(([x, y]) => isGate(x, y)).join(" ")}; room ${e.room && e.room.id}; item ${it}; out ${o ? "yes" : "no"}; back out ${w2 ? w2.at + " via " + w2.seen.filter(([x, y]) => isGate(x, y)).join(" ") : "-"}`); }
      /* no trapped ground round the compound: from every walkable tile in and within 3 of it, pi standing there has a path to
         the spawn. pi stands where feet can stand: the tile's middle (its tap spot), or, where the shore's foot-blocking pixels
         cover that, the nearest spot in the tile that move() would allow (the four points it tests clear); a tile with no such
         spot is counted apart. The same tiles on the terrain preview give the answer before the wall, for the record */
      const trapScan = (P, b) => P.I(([b2]) => {
        const I2 = window.__island, bad = [], none = []; let n = 0;
        const ok = (x, y) => !I2.blocked(x - 4, y - 2) && !I2.blocked(x + 4, y - 2) && !I2.blocked(x - 4, y + 1) && !I2.blocked(x + 4, y + 1);
        for (let y = b2.y0 - 3; y <= b2.y1 + 3; y++) for (let x = b2.x0 - 3; x <= b2.x1 + 3; x++) {
          if (!I2.tile(x, y).walkable) continue; n++;
          let at = ok(x * 16 + 8, y * 16 + 10) ? [x * 16 + 8, y * 16 + 10] : null;
          for (let r = 1; r < 8 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) { const px = x * 16 + 8 + dx, py = y * 16 + 10 + dy; if (Math.floor(px / 16) === x && Math.floor(py / 16) === y && ok(px, py)) at = [px, py]; }
          if (!at) { none.push([x, y]); continue; }
          I2.teleport(at[0], at[1]); if (I2.walkTo(79, 79, false) === null) bad.push([x, y]);
        }
        return { n, bad, none };
      }, [b]);
      const ctrap = await trapScan(cp, COMP.box), ttrap = tp.loaded ? await trapScan(tp, COMP.box) : null;
      check(name, `no trapped ground: from all ${ctrap.n} walkable tiles in and within 3 of the compound, pi standing there (where feet can stand) has a path to the spawn (from inside, through the entrance)`,
        ctrap.n > 250 && ctrap.bad.length === 0 && ctrap.none.every((q) => ttrap && ttrap.none.some((t2) => t2.join() === q.join())),
        `cut off: ${ctrap.bad.slice(0, 6).join(" ") || "none"}; tiles with nowhere feet can stand: ${ctrap.none.join(" ") || "none"} (terrain preview, no wall: ${ttrap ? ttrap.none.join(" ") || "none" : "-"}; its cut off: ${ttrap ? ttrap.bad.join(" ") || "none" : "-"})`);
      // the helicopter: no landing on the wall; a descent drifting at it stops short, and pi hops out on safe ground, never on the wall
      const hl = await cp.I(([ring]) => {
        const I2 = window.__island, isR = new Set(ring.map((p) => p.join()));
        const foot = (h) => [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].map(([dx, dy]) => [Math.floor((h[0] + dx) / 16), Math.floor((h[1] + dy) / 16)]);
        const runs = [[121, 85, 150, 0], [116, 73, 0, 150], [112, 78, -150, 0], [105, 85, 150, 0]].map(([x, y, vx, vy]) => { const r = I2.landingFrom(x * 16 + 8, y * 16 + 8, vx, vy), pt = [Math.floor(r.pi[0] / 16), Math.floor(r.pi[1] / 16)]; return { from: [x, y], state: r.state, heli: r.heli.map(Math.round), onWall: foot(r.heli).filter((q) => isR.has(q.join())).length, pi: pt, piSafe: I2.safe(pt[0], pt[1]), piOnWall: isR.has(pt.join()) }; });
        return { landOnWall: ring.filter(([x, y]) => I2.canLand(x * 16 + 8, y * 16 + 8)).length, inside: I2.canLand(121 * 16 + 8, 86 * 16 + 8), runs };
      }, [RING]);
      check(name, "helicopter: it can't set down on any of the wall's 53 tiles, can inside the compound (121,86), and four descents drifting at the wall (from inside east, outside north, inside west, and in through the entrance) park with no part over the wall and pi out on safe ground",
        hl.landOnWall === 0 && hl.inside && hl.runs.every((r) => r.state === "parked" && r.onWall === 0 && r.piSafe && !r.piOnWall), `${hl.landOnWall} wall tiles allow a landing; ` + hl.runs.map((r) => `from ${r.from}: ${r.state} at ${r.heli}, pi on ${r.pi}${r.onWall ? " OVER THE WALL" : ""}`).join("; "));
      // the content preview's completeness report: the bunker compound's wall is there, and (B3d3) the koi garden's
      const comp = await cp.I(() => window.__island.completeness());
      check(name, "completeness: a normal format-2 home made of this content would still be refused; it no longer names compound walls (B3d3's koi garden wall is there too)", comp && !comp.complete && !comp.missing.some((q) => /^compound walls/.test(q)), comp ? (comp.missing.filter((q) => /^compound walls/.test(q)).join() || "no compound walls item") + `; ${comp.missing.length} items missing` : "");
    }
    // storage: through entering and leaving both buildings (above), walking, setSave and a reload, nothing read or written
    await cp.I(() => window.__island.setSave({ v: 2, logs: ["tablet"] }));
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    const want = JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]]));
    check(name, "content preview: no storage read or written (a production save beside it untouched through all three buildings, the bunker's logs read, walking, setSave and a reload)", (await storeOf(cp)) === want);
    // the decoder refuses malformed building records
    const refusedHere = (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `content preview refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    check(name, "no page error, console error or uncaught exception all the way through the content preview", cp.errs.length === 0, cp.errs.slice(0, 3).join(" | "));
  }

  // 2d. an off-centre door (synthetic): the authored door leads, not the footprint's middle
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`), dw = [86 * T + 8, 74 * T + 6];
    const e = P.loaded ? await enter(P, dw) : null, o = e && e.room ? await leave(P) : null;
    const mid = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(84 * 16 + 8, 74 * 16 + 14); I2.step(2); return I2.preview().nearby; }) : "didn't load";
    check(name, "an off-centre door (synthetic, 86,74): [E] there goes in, and pi comes out on that doorway, not the footprint's middle; at the middle (84,74) nothing opens",
      e && e.room && e.room.id === "visitor" && o && o.pi.x === dw[0] && o.pi.y === dw[1] && mid === null, e ? `entered ${e.room && e.room.id}, out at ${o && [o.pi.x, o.pi.y]}, at the middle: ${mid}` : "didn't load");
    await P.ctx.close(); }

  // 2d'. B3c3: the wall on screen, against the terrain preview at the same spot, step and size (1280 x 560: scale 2, the whole
  // compound in the frame). Over each wall tile the frame must differ (the art is visible over every solid pixel); over the
  // entrance and the open ground touching the wall it must not (no art over walkable ground)
  { const vp = { viewport: { width: 1280, height: 560 } }, A2 = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: vp }), B2 = await open(`http://127.0.0.1:${port}/${Q}`, { ctxOpts: vp });
    if (A2.loaded && B2.loaded) {
      // pi on the bunker's doorway (116,83: the compound's middle row, so all of it, rows 76 to 89, is in the 280 px tall view); the camera settled
      for (const P of [A2, B2]) await P.I(() => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(116 * 16 + 8, 83 * 16 + 14); let c0 = ""; for (let i = 0; i < 600; i++) { I2.step(1); const c = I2.preview().camera.join(); if (c === c0 && i > 30) break; c0 = c; } });
      { const ta = await A2.I(() => window.__island.getState().t), tb = await B2.I(() => window.__island.getState().t), k = Math.round((ta - tb) * 60);
        if (k > 0) await B2.I((n) => window.__island.step(n), k); else if (k < 0) await A2.I((n) => window.__island.step(n), -k); }
      const isR = new Set(RING.map((q) => q.join())), isG = new Set(COMP.gates.map((q) => q.join())), OUTER = [];
      for (const [x, y] of RING) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = [x + dx, y + dy]; if (!isR.has(q.join()) && !isG.has(q.join()) && !OUTER.some((o) => o.join() === q.join()) && m.coll[q[1] * W + q[0]] === 0 && !(Math.abs(q[0] - 116) <= 1 && Math.abs(q[1] - 83) <= 2)) OUTER.push(q); }
      const grab = (P) => P.I(([ring, gates, outer]) => {
        const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom * v.ui.dpr, c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const tile = ([x, y]) => { const x0 = Math.ceil((x * 16 - v.camera[0]) * E), y0 = Math.ceil((y * 16 - v.camera[1]) * E), x1 = Math.floor(((x + 1) * 16 - v.camera[0]) * E) - 1, y1 = Math.floor(((y + 1) * 16 - v.camera[1]) * E) - 1;
          if (x0 < 0 || y0 < 0 || x1 >= c.width || y1 >= c.height) return null; const o = []; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = (yy * c.width + xx) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; };
        return { cam: v.camera, zoom: v.zoom, ring: ring.map(tile), gates: gates.map(tile), outer: outer.map(tile), at: P_AT() };
        function P_AT() { const a = window.__island.wallArt("bunker-compound"); return a ? a.pieces.map((q) => q.at) : null; }
      }, [RING, COMP.gates, OUTER]);
      const a = await grab(A2), b = await grab(B2);
      const frac = (x, y) => { if (!x || !y || x.length !== y.length) return null; let dd = 0; for (let i = 0; i < x.length; i += 3) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) dd++; return dd / (x.length / 3); };
      const rf = RING.map((q, i) => frac(a.ring[i], b.ring[i])), gf = COMP.gates.map((q, i) => frac(a.gates[i], b.gates[i])), of = OUTER.map((q, i) => frac(a.outer[i], b.outer[i]));
      const sameCam = a.cam.join() === b.cam.join(), allIn = rf.every((v) => v !== null) && gf.every((v) => v !== null);
      const rMin = Math.min(...rf.filter((v) => v !== null)), rAll = rf.filter((v) => v !== null).reduce((x, y) => x + y, 0) / Math.max(1, rf.filter((v) => v !== null).length);
      const lowTiles = RING.filter((q, i) => rf[i] !== null && rf[i] < 0.95).map((q, i) => q.join());
      check(name, "wall on screen (1280 x 560, all 53 tiles in the frame): against the terrain preview's frame, the picture differs over every wall tile (each at least 95% of its pixels, 99.5% overall): the art is visible over every solid pixel",
        sameCam && allIn && rMin >= 0.95 && rAll >= 0.995, `camera ${sameCam ? "same" : "differs"}; per tile min ${(100 * rMin).toFixed(1)}%, mean ${(100 * rAll).toFixed(2)}%${lowTiles.length ? "; under 95%: " + lowTiles.join(" ") : ""}`);
      const gMax = Math.max(...gf.filter((v) => v !== null)), oMax = Math.max(...of.filter((v) => v !== null)), oHi = OUTER.filter((q, i) => of[i] !== null && of[i] > 0.02).map((q) => q.join());
      check(name, `the entrance and the ${OUTER.length} open tiles touching the wall look exactly as on the terrain preview (at most 2% of a tile's pixels differ: no art over walkable ground)`, allIn && gMax <= 0.02 && oMax <= 0.02,
        `entrance max ${(100 * gMax).toFixed(2)}% differ; open ground beside the wall max ${(100 * oMax).toFixed(2)}%${oHi.length ? " (over 2%: " + oHi.slice(0, 6).join(" ") + ")" : ""}`);
      check(name, "wall: each of its 53 pieces was drawn at its own tile's origin (world px), and nowhere else", a.at && a.at.length === 53 && a.at.every((q, i) => q && q[0] === RING[i][0] * T && q[1] === RING[i][1] * T), a.at ? `${a.at.filter(Boolean).length} drawn` : "no wall");
    } else check(name, "wall on screen", false, "didn't load");
    await A2.ctx.close(); await B2.ctx.close(); }

  // 2e'. B3c3: phones (390 x 844 and 375 x 667, touch): from just outside, a tap just inside the compound walks pi in through the entrance
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}: entrance`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const sc = await P.I(() => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(107 * 16 + 8, 85 * 16 + 10); let c0 = ""; for (let i = 0; i < 600; i++) { I2.step(1); const c = I2.preview().camera.join(); if (c === c0 && i > 30) break; c0 = c; } const v = I2.preview(), E = v.ui.scale * v.zoom; return { sx: (111 * 16 + 8 - v.camera[0]) * E, sy: (85 * 16 + 8 - v.camera[1]) * E }; });
    await P.page.touchscreen.tap(sc.sx, sc.sy);
    const r = await P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 3000; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen }; });
    check(name, `phone ${vw} x ${vh}: from outside (107,85), a tap on the ground just inside the compound (111,85; a phone's view is 12 tiles wide) walks pi in through the entrance, never on the wall`,
      sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh && r.at.join() === "111,85" && r.seen.some(([x, y]) => isGate(x, y)) && !onSolid(r.seen).length && !P.errs.length, `tap at ${sc.sx.toFixed(0)},${sc.sy.toFixed(0)}; ended ${r.at} via ${r.seen.join(" ")}${P.errs.length ? "; errors " + P.errs.join("; ") : ""}`);
    await P.ctx.close();
  }

  // 2e. phones (390 x 844, and since B3c2 375 x 667 too): the prompt is the button; a tap on it goes in, a tap by the room's door walks out
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) for (const id of IDS) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}: ${id}`, false, "didn't load"); await P.ctx.close(); continue; }
    const dw = doorway(id);
    await cardAway(P);
    const pr0 = await P.I(([x, y]) => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(x, y + 8); I2.step(2); return I2.preview().prompt; }, dw);
    if (pr0) await P.page.touchscreen.tap(pr0[0] + pr0[2] / 2, pr0[1] + pr0[3] / 2);
    let rm = null; for (let k = 0; k < 20 && !rm; k++) { await sleep(60); rm = await P.I(() => { window.__island.step(1); return window.__island.getState().room; }); }
    await sleep(250); await P.I(() => window.__island.step(1));
    // pi stands two rows above the door (B3c2: in the bunker that's the map table's row, which format 1's room puts in front of the door, so one row above)
    const tgt = rm ? await P.I(() => { const I2 = window.__island, R = I2.room(), v = I2.preview(), E = v.ui.scale * v.zoom, up = R.items.some((it) => R.door >= it[2] && R.door < it[2] + it[4] && R.h - 3 >= it[3] && R.h - 3 < it[3] + it[5]) ? 2 : 3; I2.teleport(R.door * 16 + 8, (R.h - up) * 16 + 10); I2.step(1); const v2 = I2.preview(); return { sx: (R.door * 16 + 8 - v2.camera[0]) * E, sy: ((R.h - 1) * 16 + 12 - v2.camera[1]) * E, up }; }) : null;
    if (tgt) await P.page.touchscreen.tap(tgt.sx, tgt.sy);
    let out = null; for (let k = 0; tgt && k < 80 && !out; k++) { out = await P.I(() => { const I2 = window.__island; I2.step(1); const s = I2.getState(); return s.room ? null : s.pi; }); if (!out) await sleep(25); }
    check(name, `phone ${vw} x ${vh}: ${id}: the prompt is on screen as the button, a tap on it goes in, a tap by the room's door walks pi out onto the doorway`,
      !!pr0 && pr0[0] >= 0 && pr0[0] + pr0[2] <= vw && pr0[1] >= 0 && pr0[1] + pr0[3] <= vh && rm === APPROVED[id].room && !!tgt && tgt.sx > 0 && tgt.sx < vw && tgt.sy > 0 && tgt.sy < vh && out && out.x === dw[0] && out.y === dw[1] && !P.errs.length,
      `prompt ${pr0 ? pr0.map((n) => n.toFixed(0)).join(",") : "none"}, room ${rm}, tap out at ${tgt ? tgt.sx.toFixed(0) + "," + tgt.sy.toFixed(0) : "-"}, out at ${out ? out.x + "," + out.y : "-"}${P.errs.length ? "; errors " + P.errs.join("; ") : ""}`);
    await P.ctx.close();
  }

  // 2f. performance: the buildings' draw cost and the frame work beside the terrain preview at the same spots; path planning; decoding;
  // the door transitions' worst frames on the live loop (doors.mjs's budget, 16 ms)
  if (cp.loaded && tp.loaded) {
    /* the frame work (update + render, as the game measures it: frames()) on the live loop, walking along the buildings'
       fronts in each preview, at the same places and pace. Stepped frames can't measure render cost: Chromium records the
       canvas's drawing and flushes it in one go every ~600 synchronous steps (half a second in its native restore and
       fillRect), in the terrain preview just the same; the live loop presents every frame. The target is the game's own,
       p95 under 16.7 ms (docs/game-design.md) */
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.buildMs, v.buildDraws, v.wallMs, v.wallDraws]; });
      await P.I(() => { window.__island.teleport(79 * 16 + 8, 75 * 16 + 10); window.__island.frames(true); });
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(3000); await P.page.keyboard.up("ArrowRight");
      await P.I(() => window.__island.teleport(99 * 16 + 8, 78 * 16 + 10));
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(2500); await P.page.keyboard.up("ArrowRight");
      await P.I(() => window.__island.teleport(110 * 16 + 8, 84 * 16 + 10));                   // B3c2: along the bunker's front
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(2500); await P.page.keyboard.up("ArrowRight");
      await P.I(() => window.__island.teleport(110 * 16 + 8, 77 * 16 + 10));                   // B3c3: inside along the north wall
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(2500); await P.page.keyboard.up("ArrowRight");
      await P.I(() => window.__island.teleport(108 * 16 + 8, 75 * 16 + 10));                   // and outside down the west wall, past the entrance
      await P.page.keyboard.down("ArrowDown"); await P.page.waitForTimeout(2500); await P.page.keyboard.up("ArrowDown");
      const r = await P.I(() => ({ f: window.__island.frames(true), v: window.__island.preview() }));
      await P.ctx.close();
      const f = r.f.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], bms: r.v.buildMs - b0[0], bn: r.v.buildDraws - b0[1], wms: r.v.wallMs - b0[2], wn: r.v.wallDraws - b0[3], errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    const per = lc && lc.bn ? lc.bms / lc.bn : 0;
    const wper = lc && lc.wn ? lc.wms / lc.wn : 0;
    perf.push(`${name}: live frame work walking along the three buildings and round the compound: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; drawing one content building ${(per * 1000).toFixed(1)} us a draw (${lc ? lc.bn : 0} draws); one wall piece ${(wper * 1000).toFixed(2)} us a draw (${lc ? lc.wn : 0} draws, ${lc ? lc.wms.toFixed(1) : 0} ms in all)`);
    check(name, "performance: walking along the three buildings and round the compound on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const plan = async (P) => P.I(([d]) => { const I2 = window.__island, out = []; for (const dd of d) { I2.teleport(79 * 16 + 8, 79 * 16 + 10); let a = performance.now(); I2.walkTo(dd[0], dd[1], false); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(dd[0], dd[1], false); out.push([cold, (performance.now() - a) / 20]); } return out; }, [IDS.map((i) => APPROVED[i].door)]);
    const pc = await plan(cp), pt = await plan(tp);
    // B3c3: planning across the wall (outside north to just inside): round through the entrance on the content preview, straight on the terrain preview
    const across = (P) => P.I(() => { const I2 = window.__island; I2.teleport(116 * 16 + 8, 74 * 16 + 10); let a = performance.now(); const n = I2.walkTo(116, 78, false); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(116, 78, false); return [cold, (performance.now() - a) / 20, n]; });
    const xc = await across(cp), xt = await across(tp);
    perf.push(`${name}: path planning across the compound's north wall (116,74 to 116,78; ms first / warm, tiles): content ${xc[0].toFixed(2)} / ${xc[1].toFixed(2)}, ${xc[2]} tiles; terrain preview ${xt[0].toFixed(2)} / ${xt[1].toFixed(2)}, ${xt[2]} tiles`);
    perf.push(`${name}: path planning from the spawn to each door (ms, first then warm average): content ${pc.map((v) => v.map((n) => n.toFixed(2)).join(" / ")).join("; ")}; terrain preview ${pt.map((v) => v.map((n) => n.toFixed(2)).join(" / ")).join("; ")}`);
    const dec = await cp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [cWith(() => {})]);
    const decT = await tp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [STAGED_MAP]);
    perf.push(`${name}: decoding the staged map: ${dec.toFixed(1)} ms with the content layer (three buildings and the compound wall), ${decT.toFixed(1)} ms without (terrain preview)`);
  }
  if (tp.loaded) await tp.ctx.close(); if (cp.loaded) await cp.ctx.close();
  { // door transitions on the live loop, as doors.mjs: cold (straight in) and warm (after standing by the door), worst frame of island work
    const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { wait: 2500 });
    if (P.loaded) {
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      for (const warm of [false, true]) for (const id of IDS) {
        const dw = doorway(id);
        await P.I(([x, y]) => window.__island.teleport(x, y + 8), dw); await P.page.waitForTimeout(warm ? 1500 : 30);
        await P.I(() => window.__island.frames(true));
        await P.page.keyboard.press("e"); await P.page.waitForTimeout(700);
        const inMs = await P.I(() => { const f = window.__island.frames(true); return f.length ? Math.max(...f) : 0; }), s1 = await P.I(() => window.__island.getState());
        await P.page.keyboard.down("ArrowDown"); for (let i = 0; i < 40 && (await P.I(() => window.__island.getState().room)); i++) await P.page.waitForTimeout(100); await P.page.keyboard.up("ArrowDown");
        await P.page.waitForTimeout(700);
        const outMs = await P.I(() => { const f = window.__island.frames(true); return f.length ? Math.max(...f) : 0; }), s2 = await P.I(() => window.__island.getState());
        check(name, `door transition, live loop: ${id} ${warm ? "warm" : "cold"}: in and out, worst frame under 16 ms (doors.mjs's budget)`, s1.room === APPROVED[id].room && !s2.room && inMs < 16 && outMs < 16, `worst frame in ${inMs.toFixed(1)} ms, out ${outMs.toFixed(1)} ms`);
      }
    } else check(name, "door transitions, live loop", false, "didn't load");
    await P.ctx.close();
  }

  // 2g. code mutations (Chromium only: each is a whole load)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.artShort[1](WORLD) }); const a = P.loaded ? await P.I(() => { const x = window.__island.buildingArt("visitor"); return [x.h, x.opaque, x.pixels]; }) : null;
      caught(MUT.artShort[0], a && a[0] !== 80, a ? `art ${a[0]} px tall, the footprint 80` : "didn't load"); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.exitInside[1](WORLD) }); const e = P.loaded ? await enter(P, doorway("visitor")) : null, o = e && e.room ? await leave(P) : null;
      caught(MUT.exitInside[0], o && o.pi.y !== doorway("visitor")[1], o ? `out at ${o.pi.x},${o.pi.y} (the doorway is ${doorway("visitor")})` : "didn't come out"); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`, { world: MUT.doorMiddle[1](WORLD) }); const e = P.loaded ? await enter(P, [86 * T + 8, 74 * T + 6]) : null;
      caught(MUT.doorMiddle[0], e && !e.room, e ? `at the off-centre door: prompt ${e.nb}, room ${e.room && e.room.id}` : "didn't load"); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.buildingsOff[1](WORLD) }); const v = P.loaded ? await P.I(() => window.__island.preview().buildings.length) : null;
      caught(MUT.buildingsOff[0], v === 0, `${v} buildings`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.botsLeak[1](WORLD) }); const v = P.loaded ? await P.I(() => window.__island.preview().sys.bots) : null;
      caught(MUT.botsLeak[0], !P.loaded || v === true || P.errs.length > 0, P.loaded ? `bots ${v}` : `didn't load: ${P.errs.slice(0, 1).join("")}`.slice(0, 160)); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noShape[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, "visitor").drawnPxBoxes[0].px1 += 16; })) : "didn't load";
      caught(MUT.noShape[0], r === null, r === null ? "art wider than the footprint decoded" : r); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.roomStations[1](WORLD) }); let err = null, rm = null;
      if (P.loaded) try { const e = await enter(P, doorway("bunker")); rm = e.room && e.room.id; await P.I(() => { const I2 = window.__island; I2.teleport(40, 72); I2.step(2); }); } catch (x) { err = x.message.split("\n")[0]; }
      caught(MUT.roomStations[0], !!err || P.errs.length > 0, (err || P.errs[0] || `room ${rm}, no error`).slice(0, 160)); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.logLeak[1](WORLD) }); let f = null;
      if (P.loaded) try { const e = await enter(P, doorway("bunker")); if (e.room) f = (await sweep(P)).found; } catch (x) { f = "error: " + x.message.split("\n")[0]; }
      caught(MUT.logLeak[0], Array.isArray(f) && f.length > 0, `logs ${JSON.stringify(f)}`.slice(0, 160)); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.wallsUndrawn[1](WORLD) }); const a = P.loaded ? await P.I(() => { const I2 = window.__island; I2.teleport(116 * 16 + 8, 85 * 16 + 10); for (let i = 0; i < 10; i++) I2.step(1); return I2.wallArt("bunker-compound").pieces.filter((q) => q.at).length; }) : null;
      caught(MUT.wallsUndrawn[0], a === 0, `${a} wall pieces drawn`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.wallArtShort[1](WORLD) }); const a = P.loaded ? await P.I(() => window.__island.wallArt("bunker-compound").pieces.filter((q) => q.h !== 16 || q.opaque !== 256).length) : null;
      caught(MUT.wallArtShort[0], a > 0, `${a} pieces not a full opaque tile`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noWallShape[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, WALL_ID).drawnPxBoxes.push(pxOf({ x0: 110, y0: 77, x1: 110, y1: 77 })); })) : "didn't load";
      caught(MUT.noWallShape[0], r === null, r === null ? "wall art over a walkable tile decoded" : r); await P.ctx.close(); }
  }

  // 2h. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { wait: 2600 });
      if (!P.loaded) continue;
      for (const id of IDS) {
        const A = APPROVED[id], dw = doorway(id);
        await P.I(([x, y]) => window.__island.teleport(x, y), [A.door[0] * T + 8, (A.door[1] + 1) * T + 10]); await P.page.waitForTimeout(900);
        await shoot(P, `${name}-${id}-exterior-${tag}.png`);
        if (tag !== "day") continue;
        await P.I(([x, y]) => window.__island.teleport(x, y + 8), dw); await P.page.waitForTimeout(700);
        await shoot(P, `${name}-${id}-doorway.png`);
        await P.page.keyboard.press("e"); await P.page.waitForTimeout(900);
        await shoot(P, `${name}-${id}-interior.png`);
        await P.page.keyboard.down("ArrowDown"); for (let i = 0; i < 40 && (await P.I(() => window.__island.getState().room)); i++) await P.page.waitForTimeout(100); await P.page.keyboard.up("ArrowDown");
        await P.page.waitForTimeout(500);
        if (id === "bunker") await shoot(P, `${name}-bunker-exit.png`);                     // B3c2: where pi comes out
        const at = id === "visitor" ? [77, 71] : id === "depot" ? [109, 75] : [111, 80], key = id === "depot" ? "ArrowLeft" : "ArrowRight";
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at); await P.page.waitForTimeout(400);
        await P.page.keyboard.down(key); await P.page.waitForTimeout(900); await P.page.keyboard.up(key); await P.page.waitForTimeout(300);
        await shoot(P, `${name}-${id}-boundary.png`);
        if (id !== "bunker") continue;
        // B3c2: pi against each of the bunker's four walls, and the compound's reserve (an overlay the test draws over the page, never the game)
        for (const [, side, at2, key2] of PUSH.filter((q) => q[0] === "bunker")) {
          await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at2); await P.page.waitForTimeout(400);
          await P.page.keyboard.down(key2); await P.page.waitForTimeout(900); await P.page.keyboard.up(key2); await P.page.waitForTimeout(300);
          await shoot(P, `${name}-bunker-edge-${side}.png`);
        }
      }
      await P.ctx.close();
    }
    /* B3c3: the compound, for review (ignored, not baselines), in both engines: 1280 x 560 puts the game at scale 2 (size():
       floor(min(W / 300, H / 190))), so the whole compound is in the frame; 1280 x 800 (scale 4) for the close-ups */
    {
      const wide = { viewport: { width: 1280, height: 560 } }, at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
      const hideDbg = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; });   // the readout would cover the compound's south-west
      for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
        const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: wide, wait: 2600 });
        if (P.loaded) {
          await hideDbg(P);
          await P.I(([x, y]) => window.__island.teleport(x, y + 8), doorway("bunker")); await P.page.waitForTimeout(1500);
          await shoot(P, `${name}-compound-${tag === "day" ? "overhead" : "night"}.png`);                            // 1, 9 (and 8: pi on the bunker's doorway, the wall all round)
          if (tag === "day") {
            await at(P, 104, 84, 1200); await shoot(P, `${name}-pi-outside.png`);                                       // 5
            // 12: the diagnostic overlay, the test's own canvas over the game's (inside its root: above the picture, under the HUD), and its
            // legend, a box of its own placed clear of the HUD (checked: nothing of the page's own interface under it)
            await P.I(([x, y]) => window.__island.teleport(x, y + 8), doorway("bunker")); await P.page.waitForTimeout(1200);
            const clear = await P.I(([ring, gates, kit, door, bunker]) => {
              const v = window.__island.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
              c.id = "b3c3-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
              const g = c.getContext("2d"), X = (tx) => (tx * 16 - v.camera[0]) * E, Y = (ty) => (ty * 16 - v.camera[1]) * E, S = 16 * E;
              g.fillStyle = "rgba(255,64,64,.5)"; g.strokeStyle = "#ff4040"; g.lineWidth = 1; for (const [x, y] of ring) { g.fillRect(X(x), Y(y), S, S); g.strokeRect(X(x) + 0.5, Y(y) + 0.5, S - 1, S - 1); }
              g.fillStyle = "rgba(255,160,40,.35)"; g.fillRect(X(bunker.x0), Y(bunker.y0), (bunker.x1 - bunker.x0 + 1) * S, (bunker.y1 - bunker.y0 + 1) * S);
              g.fillStyle = "rgba(74,222,128,.6)"; for (const [x, y] of gates) g.fillRect(X(x), Y(y), S, S);
              g.strokeStyle = "#4DD6E8"; g.lineWidth = 2; g.setLineDash([4, 3]); for (const [, x, y] of kit) g.strokeRect(X(x) + 3, Y(y) + 3, S - 6, S - 6); g.setLineDash([]);
              g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(X(door[0]), Y(door[1]), S, S);
              cvs.parentElement.insertBefore(c, cvs.nextSibling);
              const L = document.createElement("div"); L.id = "b3c3-legend";
              L.textContent = "B3c3 diagnostic (test overlay)\nred: wall, solid (53 tiles)\ngreen: west entrance, open\n       109,84 to 109,86\norange: bunker footprint, solid\nwhite: bunker door 116,83\nblue dashed: B3a's kit, uplink\n       (proposed), kept clear";
              Object.assign(L.style, { position: "absolute", left: "12px", top: "128px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "16px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
              document.body.appendChild(L);
              // nothing of the island's own interface (anything visible in its root but the game's canvas and this overlay) overlaps the legend
              const lr = L.getBoundingClientRect(), hits = [];
              for (const el of cvs.parentElement.querySelectorAll("*")) {                                     // the island's own interface (the site behind it is covered)
                if (el === L || el === c || el === cvs || L.contains(el) || el.contains(L)) continue;
                const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none" || +st.opacity === 0) continue;
                const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
                if (r.left < lr.right && r.right > lr.left && r.top < lr.bottom && r.bottom > lr.top && (el.children.length === 0 || el.tagName === "CANVAS")) hits.push((el.className || el.tagName) + "");
              }
              return { rect: [lr.left, lr.top, lr.width, lr.height].map(Math.round), hits, compoundLeft: Math.round(cvs.getBoundingClientRect().left + X(ring[0][0])) };
            }, [RING, COMP.gates, KIT, APPROVED.bunker.door, APPROVED.bunker.box]);
            check(name, "diagnostic overlay (review screenshot only): its legend is on screen, clear of the HUD and every other piece of the island's interface, and left of the compound it labels", clear.rect[0] >= 0 && clear.rect[1] >= 0 && clear.rect[0] + clear.rect[2] <= 1280 && clear.rect[1] + clear.rect[3] <= 560 && clear.hits.length === 0 && clear.rect[0] + clear.rect[2] < clear.compoundLeft,
              `legend at ${clear.rect}, the compound from x ${clear.compoundLeft}; under it: ${clear.hits.join(", ") || "nothing"}`);
            await shoot(P, `${name}-compound-diagnostic.png`);                                                         // 12
          }
        }
        await P.ctx.close();
      }
      // close-ups at 1280 x 800: the entrance, the three other sides, the four corners, pi going through the entrance, pi inside
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (P.loaded) {
        await hideDbg(P);
        for (const [f, x, y] of [["entrance-closeup", 106, 85], ["perimeter-north", 116, 74], ["perimeter-east", 126, 82], ["perimeter-south", 116, 91], ["perimeter-west", 107, 80],
          ["corner-nw", 107, 74], ["corner-ne", 126, 74], ["corner-sw", 107, 91], ["corner-se", 122, 87], ["pi-inside", 111, 81]]) { await at(P, x, y); await shoot(P, `${name}-${f}.png`); }
        await P.I(([x, y]) => window.__island.teleport(x, y + 8), doorway("bunker")); await P.page.waitForTimeout(900); await shoot(P, `${name}-bunker-doorway-perimeter.png`);   // 8
        await at(P, 106, 85, 600); await P.page.keyboard.down("ArrowRight");                                            // 6: pi walking in, caught between the posts
        for (let i = 0; i < 80 && (await P.I(() => window.__island.getState().pi.x)) < 109 * T + 8; i++) await P.page.waitForTimeout(25);
        await shoot(P, `${name}-pi-entrance.png`); await P.page.keyboard.up("ArrowRight");
      }
      await P.ctx.close();
      // 10, 11: the entrance on phones (pi just outside it)
      for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
        const Q2 = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
        if (Q2.loaded) { await cardAway(Q2); await at(Q2, 107, 85, 1200); await shoot(Q2, `${name}-${tag}-entrance.png`); }
        await Q2.ctx.close();
      }
    }
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone"], [375, 667, 2, "phone375"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (P.loaded) await cardAway(P);
      if (P.loaded) for (const id of IDS) {
        if (tag === "phone375" && id !== "bunker") continue;                              // the 375 px set is the bunker's (B3c2)
        await P.I(([x, y]) => window.__island.teleport(x, y + 8), doorway(id)); await P.page.waitForTimeout(900);
        await shoot(P, `${name}-${id}-${tag}-doorway.png`);
        const pr0 = await P.I(() => window.__island.preview().prompt);
        if (pr0) { await P.page.touchscreen.tap(pr0[0] + pr0[2] / 2, pr0[1] + pr0[3] / 2); await P.page.waitForTimeout(900); await shoot(P, `${name}-${id}-${tag}-interior.png`); }
        await P.page.keyboard.down("ArrowDown"); for (let i = 0; i < 40 && (await P.I(() => window.__island.getState().room)); i++) await P.page.waitForTimeout(100); await P.page.keyboard.up("ArrowDown");
      }
      await P.ctx.close();
    }
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); offPv.close(); plain.close();
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
