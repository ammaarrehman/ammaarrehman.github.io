#!/usr/bin/env node
/* mapb-runtime (MAP-B B2b): the staged 150 x 120 island running in the real game, through the local preview
   (tools/mapb-preview.mjs), in each engine (Chromium and WebKit; Firefox is tried and reported BLOCKED if it can't
   launch). With ?debug=1&step=1 the test API drives pi frame by frame through the game's own update loop.

   - it loads with no page error, console error or uncaught exception, as the terrain-only preview (badge, no save,
     no content systems), 150 x 120, pi at spawnTile [79,79] (1272, 1274 px), no NaN in pi, the camera or the zoom;
   - representative walks, each planned by the game (walkTo, the path planner that checks pi's feet against
     footBlock) and walked by the update loop to the exact tile: the harbour (the ferry pier's end), up the main-path
     ramp to the commons, across each of the three bridges bank to bank, to the koi garden, up the headland stairs to
     the lighthouse, up the park-gate ramp to the highland, and up the shrine stairs to the shrine; every change of
     level on the way inside a ramp, as its two levels; the camera follows;
   - collision: pushed at the sea, a river bank and the koi pond, pi stops against footBlock inside a walkable tile,
     never with a foot on a blocked or wet pixel; pushed sideways on each bridge, pi stays on the deck; pushed at a
     cliff rim, pi never enters it, and no path leads into it;
   - the big map opens;
   - review screenshots (not baselines) into tools/out/mapb/runtime/: arrival and harbour, commons, river and bridge,
     highland ramp, koi garden and headland, the shrine, the whole diagnostic ground, at 1280 x 800.

     node tools/mapb-runtime.mjs
     ENGINES=chromium node tools/mapb-runtime.mjs
   - B2e: every one of the 17 authored route ends (corridors.routeEnds), planned by the game and walked to the exact tile;
     planning that ends cleanly for unreachable targets (the open sea, the berth, the three exits' route markers, the
     crater, a cliff rim); the three exits where B1 put them, reachable where they're land and never travel destinations;
     move()'s trailing foot-corner contacts, reported and held to the accepted corner tiles; the helicopter on the staged
     pad (boarding with E, flight to the map's edges and the camera's clamp, landing refused over the sea, the volcano, a
     river, the koi pond and a cliff rim, a landing with pi stepping out and walking away, landings while drifting from the
     coast, the map-wide landing sweep, home to the pad, no storage written); the map ui at 1280 x 800, 1920 x 1080 and two
     phones (390 x 844, 375 x 667): the minimap, the big map (pi's marker, the scale, never squashed or cut off), the camera
     at the world's corners, a click or touch that walks pi; review screenshots of each.
     SKIP=routes,heli,viewports leaves B2e sections out while working on another.
   The painter is tools/mapb-painter.mjs (B2c, B2d). */
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPreview } from "./mapb-preview.mjs";
import { loadSource, compile, GROUND, COLL, WHY } from "./map-compile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tools/out/mapb/runtime");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const SKIP = (process.env.SKIP || "").split(",");                  // B2e sections to leave out while working: routes, heli, viewports
const { src, sourceSha256 } = await loadSource();
const M = compile(src, sourceSha256), W = M.w, H = M.h, T = 16, PW = W * T, P = M.px;
const at = (x, y) => y * W + x, walkT = (i) => M.coll[i] === COLL.none;
const footAt = (px, py) => P.foot[py * PW + px] === 1;
const end = (id) => src.corridors.routeEnds.find((r) => r.id === id).endTile;
const hub = (id) => src.districts.flatMap((d) => d.hubs).find((h) => h.id === id).hubTile;
const RAMPS = src.elevation.ramps.map((r) => ({ id: r.id, b: r.rampBox, lv: r.levels }));
const inRamp = (a, b) => RAMPS.some((r) => [a, b].every(([x, y]) => x >= r.b.x0 && x <= r.b.x1 && y >= r.b.y0 && y <= r.b.y1) && [M.height[at(...a)], M.height[at(...b)]].sort().join() === r.lv.join());

/* test sites, found in the compiler's own data. A push site: a walkable tile whose next tile (in the push
   direction, down) is water of the wanted kind, with footBlock in this tile's lower half under pi's feet, and a
   clear tile above to start from */
function pushSite(kind, box) {
  for (let ty = 2; ty < H - 2; ty++) for (let tx = 2; tx < W - 2; tx++) {
    if (box && (tx < box.x0 || tx > box.x1 || ty < box.y0 || ty > box.y1)) continue;
    const i = at(tx, ty), below = M.ground[at(tx, ty + 1)];
    if (!walkT(i) || ![GROUND.land, GROUND.sand, GROUND.path].includes(M.ground[i]) || !kind.includes(below) || !walkT(at(tx, ty - 1))) continue;
    const x0 = tx * T + 8;
    let first = -1; for (let py = ty * T; py < ty * T + T && first < 0; py++) for (let px = x0 - 4; px <= x0 + 4; px++) if (footAt(px, py)) { first = py; break; }
    if (first < ty * T + 6) continue;                               // stop inside the tile, below its top
    let clear = true; for (let py = (ty - 1) * T; py < first; py++) for (let px = x0 - 6; px <= x0 + 6; px++) if (footAt(px, py) || !walkT(at(px >> 4, py >> 4))) clear = false;
    // move() tests the four corners of pi's 9 x 4 px feet (x - 4 and x + 4; format 1's contract), so the corners meet the wall
    let corner = -1; for (let py = ty * T; py < ty * T + T && corner < 0; py++) if (footAt(x0 - 4, py) || footAt(x0 + 4, py)) corner = py;
    if (clear && corner >= 0) return { tile: [tx, ty], start: [x0, (ty - 1) * T + 8], wall: corner, anyWall: first };
  }
  return null;
}
function rimSite() {
  for (let ty = 3; ty < H - 3; ty++) for (let tx = 3; tx < W - 3; tx++) {
    const i = at(tx, ty);
    if (M.why[i] !== WHY.rim || !walkT(at(tx, ty + 1)) || !walkT(at(tx, ty + 2)) || M.height[at(tx, ty + 1)] >= M.height[i]) continue;
    let clear = true; for (let py = (ty + 1) * T; py < (ty + 3) * T; py++) for (let px = tx * T; px < tx * T + T; px++) if (footAt(px, py)) clear = false;
    if (clear && tx > 30) return { tile: [tx, ty], start: [tx * T + 8, (ty + 2) * T + 8] };
  }
  return null;
}
// each bridge: a path tile on each bank, in its crossing box, on the corridor that made it (west bank first)
const BRIDGES = M.bridges.map((b) => {
  const cb = b.crossingBox, k = src.corridors.paths.findIndex((p) => p.id === b.path), banks = [];
  for (let y = cb.y0; y <= cb.y1; y++) for (let x = cb.x0; x <= cb.x1; x++) if (M.ground[at(x, y)] === GROUND.path && M.pathOf[at(x, y)] === k) banks.push([x, y]);
  banks.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const deck = []; for (let y = b.bridgeBox.y0; y <= b.bridgeBox.y1; y++) for (let x = b.bridgeBox.x0; x <= b.bridgeBox.x1; x++) if (M.ground[at(x, y)] === GROUND.bridge) deck.push([x, y]);
  return { id: b.id, west: banks[0], east: banks[banks.length - 1], deck, dir: b.deckDir };
});
const body = (id) => src.water.bodies.find((b) => b.id === id).withinBox;
/* pi's feet: move() tests their four corners only, (x - 4, y - 2), (x + 4, y - 2), (x - 4, y + 1), (x + 4, y + 1). That
   is format 1's contract and B2b keeps it: no midpoint or whole-foot test. So where water narrows between the corners,
   the middle of the feet can lie over wet pixels while every corner is dry. Map-wide, over every whole-pixel spot the
   corners let pi reach from the spawn, this is how many rows of the feet's middle (from the top or the bottom edge)
   lie over wet pixels. Ammaar accepted B2b's measurement as a format-2 compatibility characteristic; these are its exact
   figures, and any change fails (if a figure rises, stop: never raise the accepted values to match) */
const CORNER_ACCEPTED = { positions: 74, hist: { 1: 35, 2: 22, 3: 10, 4: 7 }, max: 4, spots: 39,
  tiles: ["19,67", "20,67", "21,78", "25,79", "26,79", "29,19", "30,19", "47,23", "50,23"] };   // the tiles where 2 rows or more occur
function cornerOverlap() {
  const N = PW * M.h * T, PH = M.h * T, wet = (x, y) => P.wet[y * PW + x] === 1;
  const blk = (x, y) => x < 0 || y < 0 || x >= PW || y >= PH || !walkT(at(x >> 4, y >> 4)) || P.foot[y * PW + x] === 1;
  const ok = (x, y) => !blk(x - 4, y - 2) && !blk(x + 4, y - 2) && !blk(x - 4, y + 1) && !blk(x + 4, y + 1);
  const R = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0; const s0 = 1274 * PW + 1272; R[s0] = 1; q[t++] = s0;
  while (h < t) { const i = q[h++], x = i % PW, y = (i - x) / PW; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = ny * PW + nx; if (nx >= 4 && ny >= 2 && nx < PW - 4 && ny < PH - 1 && !R[j] && ok(nx, ny)) { R[j] = 1; q[t++] = j; } } }
  const hist = {}, tiles = new Map(); let max = 0, spots = 0, positions = 0;
  for (let i = 0; i < N; i++) {
    if (!R[i]) continue;
    const x = i % PW, y = (i - x) / PW, rows = (from, step) => { let n = 0; for (let r = from; r >= y - 2 && r <= y + 1; r += step) { let a = false; for (let c = x - 3; c <= x + 3; c++) if (wet(c, r)) a = true; if (a) n++; else break; } return n; };
    const n = Math.max(rows(y + 1, -1), rows(y - 2, 1));
    if (!n) continue;
    hist[n] = (hist[n] || 0) + 1; max = Math.max(max, n); positions++;
    if (n >= 2) { spots++; const k = `${x >> 4},${y >> 4}`, v = tiles.get(k); if (!v || n > v.n) tiles.set(k, { n, x, y }); }
  }
  return { reached: t, hist, max, spots, positions, tiles };
}
const cornerSummary = (c) => ({ positions: c.positions, hist: c.hist, max: c.max, spots: c.spots, tiles: [...c.tiles.keys()].sort() });
const cornerAccepted = (c) => JSON.stringify(cornerSummary(c)) === JSON.stringify(CORNER_ACCEPTED);
const CORNER = cornerOverlap();
const SITES = { sea: pushSite([GROUND.shallow]), river: pushSite([GROUND.river]), pond: pushSite([GROUND.pond], body("koi-pond")), tarn: pushSite([GROUND.pond], body("tarn")), rim: rimSite() };

let fails = 0; const blocked = []; const CROSS = {};
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const fin = (v) => typeof v === "number" && isFinite(v);

/* ════════ B2e: the integration audit ════════
   every authored route end, the three future exits, the helicopter on the staged pad, and the map ui (minimap, big
   map, camera, taps) at desktop and phone sizes. All of it through the game's own planner, update loop and input */
const ROUTE_ENDS = src.corridors.routeEnds;                            // the 17, from the authored source
const EXITS = src.exits;
// the exits' planning markers as B1 approved them (docs/game-design.md, MAP-B B1): they stay markers, never destinations
const EXIT_PINS = { south: { berthTile: [79, 97], routeMarkerTile: [79, 101], ferryPierBox: [78, 84, 80, 96], arrivalPlazaBox: [70, 74, 84, 81] },
  west: { routeMarkerTile: [13, 66], jettyBox: [17, 66, 19, 70] }, northwest: { routeMarkerTile: [5, 21], landingBox: [9, 21, 14, 21] } };
const SPAWN_T = [79, 79];
// the walkable tiles reachable from the spawn (4 ways, as the game's safe ground), and the shortest walk in tiles from the arrival
const REACH = new Int32Array(W * H).fill(-1);
{ const q = [at(...SPAWN_T)]; REACH[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = at(nx, ny); if (nx >= 0 && ny >= 0 && nx < W && ny < H && REACH[j] < 0 && walkT(j)) { REACH[j] = REACH[i] + 1; q.push(j); } } } }
const reach = (t) => REACH[at(...t)] >= 0;
const boxTiles = (b) => { const o = []; for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) o.push([x, y]); return o; };
const asBox = (b) => [b.x0, b.y0, b.x1, b.y1];
// may the helicopter set a sample point down on this tile? only reachable walkable ground or the pad
const landOK = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && ((walkT(at(tx, ty)) && reach([tx, ty])) || M.ground[at(tx, ty)] === GROUND.pad);
const VOLC = (i) => M.cone[i] === 1 || M.crater[i] === 1;
// level changes on a walk: only inside a ramp, between its two levels; and the levels walked
const lvSteps = (seen) => { const bad = []; for (let k = 1; k < seen.length; k++) { const a = seen[k - 1], b = seen[k]; if (M.height[at(...a)] !== M.height[at(...b)] && !inRamp(a, b)) bad.push(`${a}->${b}`); } return bad; };
const TRAIL = [];                                                       // trailing foot-corner contacts seen on the route-end walks
const lvList = (seen) => [...new Set(seen.map((t) => M.height[at(...t)]))].join(" ");
// a tile of a kind whose whole 3 x 3 is of that kind (so no landing sample can reach out of it), nearest to a point
const deepTile = (pred, near) => { let best = null, bd = 1e9; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let all = true; for (let j = -1; j <= 1 && all; j++) for (let i = -1; i <= 1; i++) if (!pred(at(x + i, y + j))) { all = false; break; } const d = Math.hypot(x - near[0], y - near[1]); if (all && d < bd) { bd = d; best = [x, y]; } } return best; };

/* in the page: plan with the game's planner from a tile, walk it with the update loop 2 frames at a time, pi's four foot
   corners checked after each; how long the plan took, where pi ended, every tile on the way */
const walkCheck = (I, from, to, max = 9000) => I(([fx, fy, tx, ty, mx]) => {
  const I2 = window.__island; I2.teleport(fx * 16 + 8, fy * 16 + 10); I2.step(1);
  const st0 = I2.getState().pi.stalls, t0 = performance.now(), plan = I2.walkTo(tx, ty, false), planMs = performance.now() - t0;
  if (plan === null) return { plan: null, planMs };
  const seen = [], bad = []; let f = 0;
  for (; f < mx; f += 2) {
    I2.step(2); const p = I2.getState().pi, t = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1];
    if (!l || l[0] !== t[0] || l[1] !== t[1]) seen.push(t);
    for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 1], [4, 1]]) { const x = Math.floor(p.x + dx), y = Math.floor(p.y + dy); if (I2.blocked(x, y) || I2.kind(x, y) === "water") bad.push([x, y, (x >> 4) + "," + (y >> 4), Math.sign(p.vx || 0)]); }
    if (!p.path) break;
  }
  const p = I2.getState().pi;
  return { plan, planMs, frames: f, done: !p.path, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen, bad: bad.length, badAt: bad, stalls: p.stalls - st0 };
}, [from[0], from[1], to[0], to[1], max]);

async function b2eRoutes(name, I, page) {
  // the authored data: 17 route ends, every one walkable and reachable on foot in the compiled map
  check(name, "route ends: the 17 come from the authored source (corridors.routeEnds), each on walkable ground reachable from the spawn", ROUTE_ENDS.length === 17 && ROUTE_ENDS.every((r) => walkT(at(...r.endTile)) && reach(r.endTile)),
    ROUTE_ENDS.map((r) => `${r.id} ${r.endTile}${walkT(at(...r.endTile)) && reach(r.endTile) ? "" : " NOT REACHABLE"}`).join(", "));
  const rows = [];
  for (const r of ROUTE_ENDS) {
    const from = r.id === "arrival" ? end("ferry-pier-end") : end("arrival"), w = await walkCheck(I, from, r.endTile);
    const lv = w.plan === null ? ["no path"] : lvSteps(w.seen), offWalk = w.seen ? w.seen.filter((t) => !walkT(at(...t))) : [];
    const ok = w.plan !== null && w.done && w.at[0] === r.endTile[0] && w.at[1] === r.endTile[1] && !w.stalls && !lv.length && !offWalk.length;
    if (w.badAt) w.badAt.forEach((c) => TRAIL.push({ route: r.id, px: [c[0], c[1]], tile: c[2] }));
    rows.push({ id: r.id, ok, shortest: Math.abs(REACH[at(...r.endTile)] - REACH[at(...from)]), ...w });
    check(name, `route end ${r.id} ${r.endTile}: planned by the game and walked to the exact tile from ${r.id === "arrival" ? "the ferry pier's end" : "the arrival"}`, ok,
      w.plan === null ? "no path planned" : `${w.plan}-tile plan in ${w.planMs.toFixed(1)} ms (shortest 4-way walk from the spawn's flood ${REACH[at(...r.endTile)]} tiles from the spawn), ${w.frames} frames (${(w.frames / 60).toFixed(1)} s), ended at ${w.at}${w.done ? "" : " STILL WALKING"}; ${w.stalls} stalls; ${w.bad} foot-corner contacts with blocked or wet pixels (reported below); levels ${lvList(w.seen)}${lv.length ? ", outside a ramp: " + lv.join(" ") : ""}${offWalk.length ? ", off walkable tiles: " + offWalk.join(" ") : ""}`);
  }
  /* move() tests only the leading pair of foot corners on each axis (format 1's contract, kept): the trailing pair sweeps over what
     was the middle of the feet and isn't tested, so it can rest on a wet or blocked pixel the middle already overlapped. The
     map-wide scan above floods with all four corners tested, so it doesn't see these. Reported here, tile by tile; all of them
     must be at the accepted corner-contract tiles (a contact anywhere else fails) */
  const tiles = [...new Set(TRAIL.map((c) => c.tile))].sort(), off = tiles.filter((t) => !CORNER_ACCEPTED.tiles.includes(t));
  check(name, "route ends: trailing foot-corner contacts with wet or blocked pixels (move()'s leading-corner test), all at the accepted corner-contract tiles", off.length === 0,
    TRAIL.length ? `${TRAIL.length} contacts on tiles ${tiles.join(" ")} (${[...new Set(TRAIL.map((c) => c.route))].join(", ")}): ${TRAIL.slice(0, 6).map((c) => c.px.join(",")).join(" ")}${off.length ? `; NOT accepted: ${off.join(" ")}` : ""}` : "none");
  TRAIL.length = 0;
  // a tap on somewhere pi can't go: the planner ends (null, or a plan to the nearest tile it can reach), pi never gets there
  const nope = [["the open sea (corner)", [2, 2]], ["the ferry berth", EXITS.south.berthTile], ["the south route marker", EXITS.south.routeMarkerTile], ["the west route marker", EXITS.west.routeMarkerTile],
    ["the north-west route marker", EXITS.northwest.routeMarkerTile], ["the volcano's crater", (() => { for (let i = 0; i < W * H; i++) if (M.crater[i]) return [i % W, (i / W) | 0]; })()], ["a cliff rim", SITES.rim && SITES.rim.tile]];
  let worst = 0;
  for (const [label, tl] of nope) {
    const w = await walkCheck(I, end("arrival"), tl, 12000); worst = Math.max(worst, w.planMs);
    const reached = w.at && w.at[0] === tl[0] && w.at[1] === tl[1];
    check(name, `route planning ends for an unreachable target: ${label} ${tl}`, !reached && (w.plan === null || (w.done && !w.stalls && walkT(at(...w.at)))), w.plan === null ? `no path (${w.planMs.toFixed(1)} ms)` : `a ${w.plan}-tile plan to the nearest reachable ground (${w.planMs.toFixed(1)} ms), ${w.frames} frames, pi stopped at ${w.at} (${walkT(at(...w.at)) ? "walkable" : "NOT walkable"}), ${w.stalls} stalls, ${w.bad} trailing-corner contacts`);
  }
  check(name, "route planning: the slowest plan to an unreachable target", worst < 250, `${worst.toFixed(1)} ms`);

  // the exits: positions as approved, reachable where they're land, sea where they're markers, never travel destinations
  const pinned = JSON.stringify({ south: { berthTile: EXITS.south.berthTile, routeMarkerTile: EXITS.south.routeMarkerTile, ferryPierBox: asBox(EXITS.south.ferryPierBox), arrivalPlazaBox: asBox(EXITS.south.arrivalPlazaBox) },
    west: { routeMarkerTile: EXITS.west.routeMarkerTile, jettyBox: asBox(EXITS.west.jettyBox) }, northwest: { routeMarkerTile: EXITS.northwest.routeMarkerTile, landingBox: asBox(EXITS.northwest.landingBox) } }) === JSON.stringify(EXIT_PINS);
  check(name, "exits: the three exits' boxes and planning markers are where B1 put them", pinned, JSON.stringify(EXIT_PINS));
  const plaza = boxTiles(EXIT_PINS.south.arrivalPlazaBox), plazaOk = plaza.filter((t) => walkT(at(...t)) && reach(t)).length;
  const pier = boxTiles(EXIT_PINS.south.ferryPierBox).filter((t) => M.ground[at(...t)] === GROUND.dock), pierOk = pier.filter(reach).length;
  const jetty = boxTiles(EXIT_PINS.west.jettyBox).filter((t) => M.ground[at(...t)] === GROUND.dock), jettyOk = jetty.filter(reach).length;
  const landing = boxTiles(EXIT_PINS.northwest.landingBox), landingOk = landing.filter((t) => walkT(at(...t)) && reach(t)).length;
  const markers = [EXITS.south.berthTile, EXITS.south.routeMarkerTile, EXITS.west.routeMarkerTile, EXITS.northwest.routeMarkerTile], seaM = markers.filter((t) => !M.land[at(...t)] && !walkT(at(...t))).length;
  check(name, "exits: the arrival plaza, the ferry pier, the west jetty and the north-west bridgehead are all walkable and reachable; the berth and the 3 route markers are open sea, not walkable",
    plazaOk === plaza.length && pier.length > 0 && pierOk === pier.length && jetty.length > 0 && jettyOk === jetty.length && landingOk === landing.length && seaM === 4,
    `plaza ${plazaOk}/${plaza.length} tiles, ferry pier ${pierOk}/${pier.length} dock tiles, west jetty ${jettyOk}/${jetty.length} dock tiles, bridgehead ${landingOk}/${landing.length}, markers at sea ${seaM}/4`);
  await page.keyboard.press("m");
  const nav = await I(() => ({ buttons: document.querySelectorAll(".w-map .w-lm button").length, stations: window.__island.preview().systems.stations }));
  await page.keyboard.press("Escape");
  check(name, "exits and route ends are not travel destinations yet: the big map lists nothing to travel to", nav.buttons === 0 && nav.stations === 0, `${nav.buttons} travel buttons, ${nav.stations} stations`);
  return rows;
}

/* the helicopter on the staged island, through its own mechanics: the pad, boarding with E, flight to the map's edges,
   landing refused off safe ground, landing (and drifting while landing) only on safe ground, pi stepping out on clear
   feet, the camera and the zoom, the minimap's marker; and no storage written */
async function b2eHeli(name, I, page) {
  const PAD = [103, 95], pad = { x: PAD[0] * 16 + 8, y: PAD[1] * 16 + 8 };
  const key = (k, down) => I(([kk, d]) => window.dispatchEvent(new KeyboardEvent(d ? "keydown" : "keyup", { key: kk, code: kk, bubbles: true })), [k, down]);
  const steps = (n, per = 2) => I(([n2, p]) => { for (let i = 0; i < n2; i += p) window.__island.step(p); }, [n, per]);
  const state = () => I(() => { const I2 = window.__island, s = I2.getState(), v = I2.preview(); return { heli: s.heli, pi: [s.pi.x, s.pi.y], cam: v.camera, view: v.view, zoom: v.zoom, near: v.nearby, ui: v.ui, ls: localStorage.length, ss: sessionStorage.length }; });
  // the minimap's marker for the helicopter: amber, where the minimap's formula puts it
  const miniMarker = () => I(() => {
    const v = window.__island.preview(), u = v.ui, h = window.__island.getState().heli; if (!u.mini) return null;
    const f = u.mini[2] / u.miniBacking[0] * 2 / 16, x = Math.round((u.mini[0] + h.x * f) * u.dpr), y = Math.round((u.mini[1] + h.y * f) * u.dpr);
    const d = document.querySelector(".w-cv").getContext("2d").getImageData(x, y, 1, 1).data; return { at: [x, y], rgb: [d[0], d[1], d[2]] };
  });
  const amber = (m) => m && Math.abs(m.rgb[0] - 255) < 8 && Math.abs(m.rgb[1] - 176) < 8 && m.rgb[2] < 8;
  const pink = (m) => m && Math.abs(m.rgb[0] - 0xf4) < 8 && Math.abs(m.rgb[1] - 0x54) < 8 && Math.abs(m.rgb[2] - 0xa6) < 8;
  const marked = (m) => amber(m) || pink(m);                            // aboard, pi's blinking marker is drawn over the helicopter's
  await I(() => { localStorage.clear(); sessionStorage.clear(); });
  let s = await state();
  const lp = await I(([x, y]) => window.__island.canLand(x, y), [pad.x, pad.y]);
  await I(() => window.__island.step(1)); const mm0 = await miniMarker();
  check(name, "helicopter: parked at the staged pad's centre, helipadTile [103,95] (1656, 1528 px), on pad tiles, landable there, its minimap marker in place", s.heli.state === "parked" && s.heli.x === pad.x && s.heli.y === pad.y && s.heli.z === 0 && M.ground[at(...PAD)] === GROUND.pad && lp && amber(mm0),
    `state ${s.heli.state}, at ${s.heli.x},${s.heli.y}, z ${s.heli.z}, ground ${M.ground[at(...PAD)]} (pad ${GROUND.pad}), canLand ${lp}, minimap marker ${mm0 && mm0.rgb}`);
  // boarding: pi next to it, E
  await I(() => { const I2 = window.__island; I2.teleport(103 * 16 + 8, 96 * 16 + 10); I2.step(1); });
  s = await state(); const nearHeli = s.near;
  await key("e", true); await key("e", false);
  let fr = 0; for (; fr < 600; fr += 10) { await steps(10); s = await state(); if (s.heli.state === "flying") break; }
  for (let k = 0; k < 60; k++) await steps(2);                          // render() eases the zoom once per step() call
  s = await state();
  const cc = [s.cam[0] + s.view[0] / 2, s.cam[1] + s.view[1] / 2], off = Math.hypot(cc[0] - s.heli.x, cc[1] - s.heli.y);
  check(name, "helicopter: E beside it boards; it spools, lifts and flies, the view zooming out to 0.72 and the camera on it", nearHeli === "heli" && s.heli.state === "flying" && s.heli.z > 30 && Math.abs(s.zoom - 0.72) < 0.01 && s.pi[0] === s.heli.x && s.pi[1] === s.heli.y && off < 70,
    `nearby ${nearHeli}; flying after ${fr} frames, z ${s.heli.z.toFixed(1)}, zoom ${s.zoom.toFixed(3)}, pi with it ${s.pi[0] === s.heli.x && s.pi[1] === s.heli.y}; view centre ${off.toFixed(1)} px from it (look-ahead up to 64)`);
  // to the map's corners: the flight bounds (2 tiles in from the edge) and the camera's clamp at zoom 0.72
  const corners = [[["ArrowUp", "ArrowLeft"], [32, 32]], [["ArrowDown", "ArrowRight"], [W * 16 - 32, H * 16 - 32]], [["ArrowUp", "ArrowRight"], [W * 16 - 32, 32]], [["ArrowDown", "ArrowLeft"], [32, H * 16 - 32]]];
  for (const [ks, want] of corners) {
    for (const k of ks) await key(k, true);
    await steps(2400, 6);
    for (const k of ks) await key(k, false);
    await steps(60);
    s = await state(); const mm = await miniMarker();
    const tol = 0.5 / (s.ui.scale * s.zoom * s.ui.dpr) + 1e-6;              // the camera is rounded to whole device pixels
    const maxX = W * 16 - s.view[0], maxY = H * 16 - s.view[1], camOk = s.cam[0] >= -tol && s.cam[1] >= -tol && s.cam[0] <= maxX + tol && s.cam[1] <= maxY + tol;
    const atEdgeX = want[0] < 100 ? s.cam[0] <= tol : Math.abs(s.cam[0] - maxX) <= tol, atEdgeY = want[1] < 100 ? s.cam[1] <= tol : Math.abs(s.cam[1] - maxY) <= tol;
    check(name, `helicopter: flown to the ${ks.join("+")} corner, it stops at the flight bounds (${want}) and the camera clamps to the world's edge`, Math.abs(s.heli.x - want[0]) < 0.5 && Math.abs(s.heli.y - want[1]) < 0.5 && camOk && atEdgeX && atEdgeY && s.heli.state === "flying" && marked(mm),
      `heli ${s.heli.x.toFixed(1)},${s.heli.y.toFixed(1)}; camera ${s.cam.map((v) => v.toFixed(1))} (range 0..${maxX.toFixed(1)}, 0..${maxY.toFixed(1)}), view ${s.view.map((v) => v.toFixed(1))} at zoom ${s.zoom.toFixed(2)}; minimap marker ${mm ? mm.rgb : "hidden"}`);
  }
  // E over the sea (this corner): refused, still flying
  await key("e", true); await key("e", false); await steps(30); s = await state();
  check(name, "helicopter: E over the open sea is refused; it keeps flying", s.heli.state === "flying" && !(await I(([x, y]) => window.__island.canLand(x, y), [s.heli.x, s.heli.y])), `state ${s.heli.state} at ${s.heli.x.toFixed(0)},${s.heli.y.toFixed(0)}`);
  // fly by taps, as a player does: tap toward the target until it's there
  /* tap-steering, as a player flies: a tap off screen is clamped to the view's edge (the helicopter heads that way); on screen the
     target is tapped exactly, again every 10 frames, since at speed the helicopter can pass through its 8 px stop and coast on (its
     flight, as in format 1). A tap on the helicopter itself or its [E] prompt would mean "land", so a target in that band is tapped
     60 px to one side instead. Arrived: within a tile and still */
  const flyTo = async (tx, ty) => {
    let last = null;
    for (let k = 0; k < 400; k++) {
      const r = await I(([wx, wy]) => {
        const I2 = window.__island, v = I2.preview(), h = I2.getState().heli, E = v.ui.scale * v.zoom;
        const risky = Math.hypot(wx - h.x, wy - (h.y - h.z)) < 24 || (Math.abs(wx - h.x) < 45 && wy < h.y - h.z + 8 && wy > h.y - h.z - 40);
        const aimX = risky ? wx + (wx >= h.x ? 60 : -60) : wx;
        const sx = Math.max(24, Math.min(v.ui.css[0] - 24, (aimX - v.camera[0]) * E)), sy = Math.max(70, Math.min(v.ui.css[1] - 24, (wy - v.camera[1]) * E));
        const cv = document.querySelector(".w-cv"); for (const t of ["pointerdown", "pointerup"]) cv.dispatchEvent(new PointerEvent(t, { clientX: sx, clientY: sy, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, bubbles: true }));
        for (let i = 0; i < 10; i += 2) I2.step(2);
        const h2 = I2.getState().heli;
        return { x: h2.x, y: h2.y, dist: Math.hypot(wx - h2.x, wy - h2.y), state: h2.state };
      }, [tx, ty]);
      if (r.state !== "flying") return false;
      if (r.dist < 16 && last && Math.hypot(r.x - last[0], r.y - last[1]) < 0.5) return true;   // the game drops a target within 8 px, then drifts to a stop
      last = [r.x, r.y];
    }
    return false;
  };
  // E over the volcano, a river, the koi pond and a cliff rim: refused
  const kb = body("koi-pond");
  const refuse = [["the volcano", deepTile((i) => VOLC(i), [83, 14])], ["the river", deepTile((i) => M.ground[i] === GROUND.river, [40, 55])], ["the koi pond", deepTile((i) => M.ground[i] === GROUND.pond, [(kb.x0 + kb.x1) / 2, (kb.y0 + kb.y1) / 2])],
    ["a cliff rim", SITES.rim && SITES.rim.tile]];
  const SAMPLES = [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]];
  for (const [label, tl] of refuse) {
    // over it: for a 3 x 3 site anywhere within the tile's reach; a cliff rim is one tile thick, so there at least one of the
    // five landing samples must be on a rim tile (flown again if it settled off it)
    let got = false, smp = [];
    for (let tries = 0; tries < 3; tries++) {
      got = await flyTo(tl[0] * 16 + 8, tl[1] * 16 + 8); await steps(40); s = await state();
      smp = SAMPLES.map(([dx, dy]) => [Math.floor((s.heli.x + dx) / 16), Math.floor((s.heli.y + dy) / 16)]);
      if (label !== "a cliff rim" || smp.some((t) => M.why[at(...t)] === WHY.rim)) break;
    }
    const ht = [Math.floor(s.heli.x / 16), Math.floor(s.heli.y / 16)], cl = await I(([x, y]) => window.__island.canLand(x, y), [s.heli.x, s.heli.y]);
    const nodeSays = smp.every((t) => landOK(...t)), onKind = label === "a cliff rim" ? smp.some((t) => M.why[at(...t)] === WHY.rim) : !landOK(...ht);
    await key("e", true); await key("e", false); await steps(40); const s2 = await state();
    check(name, `helicopter: flown by taps over ${label} ${tl} and E pressed: refused, still flying`, got && onKind && !cl && !nodeSays && s2.heli.state === "flying",
      `${got ? "over" : "DIDN'T REACH"} tile ${ht} (ground ${M.ground[at(...ht)]}, coll ${M.coll[at(...ht)]}${label === "a cliff rim" ? `, rim under samples ${smp.filter((t) => M.why[at(...t)] === WHY.rim).join(" ")}` : ""}), game canLand ${cl}, compiled data ${nodeSays ? "landable" : "not landable"}, after E: ${s2.heli.state}`);
  }
  // a real landing on open ground at the commons, then pi steps out and walks
  const commons = hub("commons"), got = await flyTo(commons[0] * 16 + 8 + 40, commons[1] * 16 + 8 + 30); await steps(60);
  await key("e", true); await key("e", false);
  for (let k = 0; k < 40; k++) { await steps(10); s = await state(); if (s.heli.state === "parked") break; }
  for (let k = 0; k < 60; k++) await steps(2);
  s = await state();
  const piOk = await I(([x, y]) => { const I2 = window.__island; return [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I2.blocked(Math.floor(x + dx), Math.floor(y + dy)) && I2.kind(Math.floor(x + dx), Math.floor(y + dy)) !== "water") && I2.safe(Math.floor(x / 16), Math.floor(y / 16)); }, s.pi);
  const ht = [Math.floor(s.heli.x / 16), Math.floor(s.heli.y / 16)];
  const after = await walkCheck(I, [Math.floor(s.pi[0] / 16), Math.floor(s.pi[1] / 16)], end("arrival"));
  check(name, "helicopter: lands with E on open ground near the commons; pi steps out on clear feet and can walk away to the arrival", got && s.heli.state === "parked" && landOK(...ht) && piOk && Math.abs(s.zoom - 1) < 0.01 && after.done && after.at.join() === end("arrival").join(),
    `parked on tile ${ht} (level ${M.height[at(...ht)]}), pi out at ${s.pi.map((v) => v.toFixed(1))} ${piOk ? "on clear, safe feet" : "NOT CLEAR"}, zoom back to ${s.zoom.toFixed(3)}; then walked ${after.plan} tiles to the arrival`);
  // landings while drifting, from the coast toward the sea at full speed (the game's own updateHeli): never off safe ground
  const coastal = []; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = at(x, y); if (!walkT(i) || !reach([x, y])) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (M.coll[at(x + dx, y + dy)] & (COLL.shallow | COLL.deep)) { coastal.push([x, y, dx, dy]); break; } }
  const sample = coastal.filter((_, k) => k % 7 === 0);
  const drift = await I((list) => list.map(([x, y, dx, dy]) => window.__island.landingFrom(x * 16 + 8, y * 16 + 8, dx * 150, dy * 150)), sample);
  const badDrift = drift.map((d, k) => ({ d, k })).filter(({ d }) => d.state !== "parked" || !landOK(Math.floor(d.heli[0] / 16), Math.floor(d.heli[1] / 16)) || !landOK(Math.floor(d.pi[0] / 16), Math.floor(d.pi[1] / 16)));
  check(name, "helicopter: landings drifting seaward at full speed from the coast always stop on safe ground, and pi steps out on safe ground", sample.length > 50 && badDrift.length === 0,
    `${sample.length} coastal starts (every 7th of ${coastal.length}); ${badDrift.length} bad${badDrift.length ? ": " + badDrift.slice(0, 4).map(({ d, k }) => `${sample[k]} -> heli ${d.heli.map(Math.round)} pi ${d.pi.map(Math.round)}`).join("; ") : ""}`);
  // where it may come down, map-wide: every 4 px; every one of canLand's five sample points on reachable walkable ground or the pad
  const sweep = await I(() => { const I2 = window.__island, o = []; for (let y = 2; y < 120 * 16; y += 4) for (let x = 2; x < 150 * 16; x += 4) if (I2.canLand(x, y)) o.push(x, y); return o; });
  let landPts = 0, badPts = 0, wet = 0, solid = 0, volc = 0; const SAMPLE = [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]];
  for (let k = 0; k < sweep.length; k += 2) { landPts++; let bad = false; for (const [dx, dy] of SAMPLE) { const tx = Math.floor((sweep[k] + dx) / 16), ty = Math.floor((sweep[k + 1] + dy) / 16), i = at(tx, ty); if (!landOK(tx, ty)) { bad = true; if (M.coll[i] & (COLL.shallow | COLL.deep)) wet++; else if (VOLC(i)) volc++; else solid++; } } if (bad) badPts++; }
  check(name, "helicopter: map-wide (every 4 px), every point it may land on has all five landing samples on reachable walkable ground or the pad: none over water, a cliff, the volcano or a blocked tile", landPts > 1000 && badPts === 0,
    `${landPts} landable points of ${600 * 480}; ${badPts} bad (${wet} wet, ${volc} volcano, ${solid} solid or unreachable sample tiles)`);
  // home: pi back beside the helicopter (parked at the commons), E, flown to the pad by taps, E: it parks on the pad
  await I(([x, y]) => { const I2 = window.__island; I2.teleport(x, y + 12); I2.step(1); }, [s.heli.x, s.heli.y]);
  const n2 = (await state()).near;
  await key("e", true); await key("e", false);
  for (let k = 0; k < 60; k++) { await steps(10); if ((await state()).heli.state === "flying") break; }
  const back = await flyTo(pad.x, pad.y); await steps(40);
  await key("e", true); await key("e", false);
  for (let k = 0; k < 40; k++) { await steps(10); s = await state(); if (s.heli.state === "parked") break; }
  const hp = [Math.floor(s.heli.x / 16), Math.floor(s.heli.y / 16)];
  check(name, "helicopter: boarded again where it landed, flown home by taps and landed on the pad", n2 === "heli" && back && s.heli.state === "parked" && M.ground[at(...hp)] === GROUND.pad,
    `nearby ${n2}; ${back ? "reached the pad" : "DIDN'T REACH the pad"}; parked on tile ${hp} (ground ${M.ground[at(...hp)]})`);
  s = await state();
  check(name, "helicopter: no storage written by any of it (the preview's save is locked; local and session storage stay empty)", s.ls === 0 && s.ss === 0, `localStorage ${s.ls} keys, sessionStorage ${s.ss} keys`);
}

/* the map ui at desktop and phone sizes: the minimap (300 x 240 on screen, 1.25 like the island, inside the view, hidden
   under 760 px as in format 1), the big map (450 x 360 at 3 px a tile and whole multiples on desktop; scaled down to fit
   on a phone, never squashed or cut off), pi's marker where pi is, the camera clamped at the world's edges, and a tap
   that walks pi to the tapped tile */
const VIEWPORTS = [["desktop-1280x800", { viewport: { width: 1280, height: 800 } }], ["desktop-1920x1080", { viewport: { width: 1920, height: 1080 } }],
  ["phone-390x844", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ["phone-375x667", { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];
async function b2eViewports(name, browser, port, shots) {
  for (const [vn, opts] of VIEWPORTS) {
    const ctx = await browser.newContext(name === "firefox" ? { ...opts, isMobile: undefined } : opts), page = await ctx.newPage(), errs = [];
    // WebKit's screenshots inject a stylesheet the page's CSP refuses: that one message, only while a screenshot is taken (as mapb-painter)
    page.on("pageerror", (e) => errs.push("page error: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !(page.__shooting && /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'/.test(m.text()))) errs.push("console: " + m.text()); });
    const shoot = async (f) => { page.__shooting = true; await page.screenshot({ path: f, caret: "initial" }); await page.waitForTimeout(50); page.__shooting = false; shots.push(f); };
    await page.goto(`http://127.0.0.1:${port}/?debug=1&step=1&islandhour=11#island`);
    await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
    const I = (fn, a) => page.evaluate(fn, a), Wv = opts.viewport.width, Hv = opts.viewport.height, phone = Wv < 760;
    await page.waitForTimeout(1500);                                     // the opening fade runs on the wall clock (screenshots after it)
    await I(() => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); });   // the opening zoom (2.6 to 1) eases once per render
    let v = await I(() => window.__island.preview());
    const m = v.ui.mini;
    check(name, `${vn}: the minimap ${phone ? "is hidden under 760 px wide, as in format 1" : "is 300 x 240 on screen (2 px a tile, 1.25 like the island), inside the view at the bottom right"}`,
      phone ? m === null : !!m && m[2] === 300 && m[3] === 240 && m[0] === Wv - 316 && m[1] === Hv - 256 && m[0] >= 0 && m[1] >= 0 && v.ui.miniBacking.join() === "300,240",
      m ? `at ${m.slice(0, 2)}, ${m[2]} x ${m[3]}, backing ${v.ui.miniBacking}` : "hidden");
    // the big map, with pi in three places
    for (const [pl, t] of [["arrival", end("arrival")], ["nw-bridgehead", end("nw-bridgehead")], ["lighthouse-headland", end("lighthouse-headland")]]) {
      await I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(2); }, t);
      await page.keyboard.press("m"); await page.waitForTimeout(450);
      const b = await I(([tx, ty]) => {
        const c = document.querySelector(".w-map canvas"), r = c.getBoundingClientRect(), v2 = window.__island.preview(), u = v2.ui, p = window.__island.getState().pi;
        const k = u.mapK, x = Math.round(p.x / 16 * 3 * k * u.dpr), y = Math.round(p.y / 16 * 3 * k * u.dpr), d = c.getContext("2d").getImageData(x, y, 1, 1).data;
        return { open: u.mapOpen, k, css: [parseFloat(c.style.width), parseFloat(c.style.height)], rect: [r.left, r.top, r.width, r.height], backing: [c.width, c.height], dpr: u.dpr, pink: [d[0], d[1], d[2]], buttons: document.querySelectorAll(".w-map .w-lm button").length };
      }, t);
      const ratio = b.rect[2] / b.rect[3], inside = b.rect[0] >= 0 && b.rect[1] >= 0 && b.rect[0] + b.rect[2] <= Wv + 0.5 && b.rect[1] + b.rect[3] <= Hv + 0.5;
      const sizeOk = phone ? b.k < 1 && b.css[0] <= Wv - 40 : Number.isInteger(b.k) && b.k >= 1 && b.css[0] === 450 * b.k && b.css[1] === 360 * b.k;
      const pinkOk = Math.abs(b.pink[0] - 0xf4) < 12 && Math.abs(b.pink[1] - 0x54) < 12 && Math.abs(b.pink[2] - 0xa6) < 12;
      check(name, `${vn}: the big map with pi at the ${pl} ${t}: ${phone ? "scaled to fit the phone" : "450 x 360 at a whole multiple"}, the island's 1.25, not squashed (laid out at its own size), wholly on screen, pi's marker on pi`,
        b.open && sizeOk && Math.abs(ratio - 1.25) < 0.01 && Math.abs(b.rect[2] - b.css[0]) < 0.5 && Math.abs(b.rect[3] - b.css[1]) < 0.5 && inside && pinkOk,
        `scale ${b.k.toFixed(3)}, ${b.css.join(" x ")} css px (laid out ${b.rect[2].toFixed(1)} x ${b.rect[3].toFixed(1)} at ${b.rect[0].toFixed(0)},${b.rect[1].toFixed(0)}), backing ${b.backing.join(" x ")} at dpr ${b.dpr}, ratio ${ratio.toFixed(4)}, pi's marker pixel ${b.pink}`);
      if (pl === "arrival" && shots) await shoot(join(OUT, `${name}-${vn}-bigmap.png`));
      await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    }
    // the camera at the world's edges: pi teleported to each corner of the world
    const camBad = [];
    for (const [cx, cy] of [[8, 8], [W * 16 - 8, 8], [8, H * 16 - 8], [W * 16 - 8, H * 16 - 8], [W * 8, H * 8]]) {
      const c = await I(([x, y]) => { const I2 = window.__island; I2.teleport(x, y); for (let i = 0; i < 30; i++) I2.step(2); const v2 = I2.preview(); return { cam: v2.camera, view: v2.view, scale: v2.ui.scale, zoom: v2.zoom, dpr: v2.ui.dpr }; }, [cx, cy]);
      const tol = 0.5 / (c.scale * c.zoom * c.dpr) + 1e-6, mx = W * 16 - c.view[0], my = H * 16 - c.view[1];   // rounded to whole device pixels
      const ok = c.cam[0] >= -tol && c.cam[1] >= -tol && c.cam[0] <= mx + tol && c.cam[1] <= my + tol && c.cam.every(Number.isFinite);
      if (!ok) camBad.push(`${cx},${cy}: ${c.cam}`);
    }
    v = await I(() => window.__island.preview());
    check(name, `${vn}: the camera stays inside the 2400 x 1920 world at every corner (view ${v.view.map((n) => n.toFixed(0)).join(" x ")} world px at scale ${v.ui.scale})`, camBad.length === 0, camBad.join("; ") || "all 5 positions inside");
    // a tap (a click, or a touch on a phone) on a tile beside pi walks pi there
    const tap = await I(() => { const I2 = window.__island; I2.teleport(76 * 16 + 8, 60 * 16 + 10); for (let i = 0; i < 30; i++) I2.step(2); const v2 = I2.preview(), E = v2.ui.scale * v2.zoom; return { sx: (76 * 16 + 8 - v2.camera[0]) * E, sy: (64 * 16 + 8 - v2.camera[1]) * E }; });
    if (phone) await page.touchscreen.tap(tap.sx, tap.sy); else await page.mouse.click(tap.sx, tap.sy);
    const tw = await I(() => { const I2 = window.__island, plan = I2.getState().pi.path; let f = 0; for (; f < 900 && I2.getState().pi.path; f += 2) I2.step(2); const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], f }; });
    check(name, `${vn}: a ${phone ? "touch" : "click"} on the tile 4 below pi (76,64) plans a path and walks pi there`, tw.plan > 0 && tw.at.join() === "76,64", `screen ${tap.sx.toFixed(0)},${tap.sy.toFixed(0)}: a ${tw.plan}-tile path, pi at ${tw.at} after ${tw.f} frames`);
    if (shots) {
      await I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); for (let i = 0; i < 40; i++) I2.step(2); }, end("arrival"));
      await page.waitForTimeout(800); await shoot(join(OUT, `${name}-${vn}-arrival.png`));
    }
    check(name, `${vn}: no page error or console error`, errs.length === 0, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const port = 9600 + Math.floor(Math.random() * 300), server = await startPreview(port);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [];
  page.on("pageerror", (e) => errs.push("page error: " + e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?debug=1&step=1&islandhour=11#island`);
  const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 }).then(() => true, () => false);
  const I = (fn, a) => page.evaluate(fn, a);
  const pv = loaded ? await I(() => window.__island.preview()) : null, s0 = loaded ? await I(() => window.__island.getState().pi) : null;
  check(name, "the preview loads as the terrain-only staged island", loaded && pv.terrainOnly && pv.format === 2 && pv.staged && pv.badge && pv.saveLocked, pv ? `format ${pv.format}, staged ${pv.staged}, badge ${pv.badge}, save locked ${pv.saveLocked}` : "didn't load");
  if (!loaded) { await browser.close(); server.close(); continue; }
  const sys = pv.systems, none = Object.entries(sys).filter(([k, v]) => v !== 0 && v !== false);
  check(name, "no content system runs (B3 hasn't authored their data)", none.length === 0, JSON.stringify(sys));
  check(name, "150 x 120; pi at spawnTile [79,79], its aim spot (1272, 1274 px); ground 2400 x 1920", pv.w === 150 && pv.h === 120 && s0.x === 1272 && s0.y === 1274 && pv.ground.join() === "2400,1920", `${pv.w} x ${pv.h}, pi ${s0.x},${s0.y}, ground ${pv.ground}`);
  const layers = await I(() => { const L = window.__island.layers(); return { w: L.w, h: L.h, n: L.ground.length }; });
  check(name, "the running map's layers are 150 x 120", layers.w === 150 && layers.h === 120 && layers.n === 18000, JSON.stringify(layers));

  // walks: planned by the game, walked by its update loop
  const walk = (to, max = 4000) => I(([tx, ty, mx]) => {
    const I2 = window.__island, plan = I2.walkTo(tx, ty, false);
    if (plan === null) return { plan: null };
    const seen = []; let f = 0;
    for (; f < mx; f += 4) { I2.step(4); const p = I2.getState().pi, t = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== t[0] || l[1] !== t[1]) seen.push(t); if (!p.path) break; }
    const p = I2.getState().pi;
    return { plan, frames: f, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen, stalls: p.stalls, x: p.x, y: p.y };
  }, [to[0], to[1], max]);
  const levelSteps = (seen) => { const bad = []; for (let k = 1; k < seen.length; k++) { const a = seen[k - 1], b = seen[k]; if (M.height[at(...a)] !== M.height[at(...b)] && !inRamp(a, b)) bad.push(`${a}->${b}`); } return bad; };
  const steps = (seen) => [...new Set(seen.map((t) => M.height[at(...t)]))].join(" ");
  const route = async (label, to, extra) => {
    const r = await walk(to);
    const bad = r.plan === null ? ["no path"] : levelSteps(r.seen), arrived = r.at && r.at[0] === to[0] && r.at[1] === to[1];
    const more = extra ? extra(r) : "";
    check(name, `walks: ${label}`, r.plan !== null && arrived && !bad.length && !(more && more.startsWith("NOT")), r.plan === null ? "no path planned" : `${r.plan}-tile plan, ${r.frames} frames, ended at ${r.at}${arrived ? "" : ` (not ${to})`}, levels ${steps(r.seen)}${bad.length ? `, level changes outside a ramp: ${bad.join(" ")}` : ", level changes only inside ramps"}${more ? "; " + more : ""}`);
    return r;
  };
  await route("the harbour: the arrival to the ferry pier's end", end("ferry-pier-end"));
  await I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), end("arrival"));
  const rc = await route("up the main-path ramp (0 to 1) to the commons", hub("commons"), (r) => r.seen.some((t) => M.height[at(...t)] === 0) && r.seen.some((t) => M.height[at(...t)] === 1) ? "" : "NOT both levels");
  for (let k = 0; k < 6; k++) await I(() => window.__island.step(10));
  const cam = await I(() => ({ v: window.__island.preview(), p: window.__island.getState().pi }));
  const cx = cam.v.camera[0] + cam.v.view[0] / 2, cy = cam.v.camera[1] + cam.v.view[1] / 2;
  check(name, "the camera follows pi (centred within the look-ahead, at the commons)", Math.abs(cx - cam.p.x) < 40 && Math.abs(cy - cam.p.y) < 40 && [cx, cy, cam.v.zoom].every(fin), `view centre ${cx.toFixed(1)},${cy.toFixed(1)}, pi ${cam.p.x.toFixed(1)},${cam.p.y.toFixed(1)}, zoom ${cam.v.zoom.toFixed(3)}`);
  for (const b of BRIDGES) {
    await I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), b.west);
    await route(`across the ${b.id}, bank to bank (${b.west} to ${b.east})`, b.east, (r) => { const n = r.seen.filter((t) => M.ground[at(...t)] === GROUND.bridge).length; return n ? `${n} bridge tiles walked` : "NOT over the bridge"; });
  }
  await I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), hub("commons"));
  await route("to the koi garden", hub("koi-garden"));
  await route("up the headland stairs (1 to 2) to the lighthouse", hub("lighthouse"), (r) => r.seen.some((t) => M.height[at(...t)] === 2) ? "" : "NOT up to level 2");
  await I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), hub("commons"));
  await route("up the park-gate ramp (1 to 2) to the highland junction", hub("highland-junction"), (r) => r.seen.some((t) => M.height[at(...t)] === 2) ? "" : "NOT up to level 2");
  await route("over the upper bridge and up the shrine stairs (2 to 3) to the shrine", hub("shrine"), (r) => r.seen.some((t) => M.height[at(...t)] === 3) ? "" : "NOT up to level 3");

  // pushes: hold a key; after every 2 frames pi's foot corners must be on open, dry pixels
  // hold a key for n frames (pi's foot corners checked every 2), then, still holding it, `more` frames: where it stopped,
  // how many rows of its feet's middle lie over wet pixels there, and whether it got any farther
  const push = (start, key, frames, more = 0) => I(([sx, sy, k, n, n2]) => new Promise((done) => {
    const I2 = window.__island; I2.teleport(sx, sy); I2.step(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, bubbles: true }));
    const bad = [], track = [];
    const corners = (p) => { for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 1], [4, 1]]) { const x = Math.floor(p.x + dx), y = Math.floor(p.y + dy); if (I2.blocked(x, y) || I2.kind(x, y) === "water") bad.push(`${x},${y}`); } };
    for (let f = 0; f < n; f += 2) { I2.step(2); const p = I2.getState().pi; track.push([p.x, p.y]); corners(p); }
    const stop = I2.getState().pi, over = window.__mapbOverlap(stop.x, stop.y);
    for (let f = 0; f < n2; f += 2) { I2.step(2); corners(I2.getState().pi); }
    window.dispatchEvent(new KeyboardEvent("keyup", { key: k, code: k, bubbles: true }));
    const p = I2.getState().pi; done({ bad, stop: [stop.x, stop.y], over, end: [p.x, p.y], further: Math.hypot(p.x - stop.x, p.y - stop.y), moved: track.length > 1 ? Math.hypot(track[track.length - 1][0] - sx, track[track.length - 1][1] - sy) : 0, still: track.length > 6 && Math.hypot(track[track.length - 1][0] - track[track.length - 6][0], track[track.length - 1][1] - track[track.length - 6][1]) < 0.5 });
  }), [start[0], start[1], key, frames, more]);
  // rows of the feet's middle (x - 3 to x + 3) over wet pixels, from the bottom edge or the top, whichever is more
  await I(() => { window.__mapbOverlap = (px, py) => { const I2 = window.__island, x = Math.floor(px), y = Math.floor(py), rows = (from, step) => { let n = 0; for (let r = from; r >= y - 2 && r <= y + 1; r += step) { let a = false; for (let c = x - 3; c <= x + 3; c++) if (I2.kind(c, r) === "water") a = true; if (a) n++; else break; } return n; }; return Math.max(rows(y + 1, -1), rows(y - 2, 1)); }; });
  for (const [kind, label] of [["sea", "the sea (coast footBlock)"], ["river", "a river bank (internal water footBlock)"], ["pond", "the koi pond (internal water footBlock)"], ["tarn", "the tarn (internal water footBlock)"]]) {
    const s = SITES[kind];
    if (!s) { check(name, `pushed at ${label}`, false, "no test site found"); continue; }
    const r = await push(s.start, "ArrowDown", 120, 120);
    const foot = r.end[1] + 1, inTile = Math.floor(r.end[1] / 16) === s.tile[1];
    (CROSS[name] = CROSS[name] || {})[kind] = { stop: r.stop, over: r.over, end: r.end };
    check(name, `the corner contract at ${label}: the feet's middle over no more than 1 row of wet pixels, no corner on a wet or blocked pixel, and no farther in 120 more frames of pushing`, r.over <= 1 && !r.bad.length && r.further === 0,
      `stopped at ${r.stop.map((v) => v.toFixed(3))}: the middle over ${r.over} wet row${r.over === 1 ? "" : "s"}; ${r.bad.length ? r.bad.length + " bad corners" : "every corner dry and open"}; ${r.further === 0 ? "not a pixel farther" : `moved ${r.further.toFixed(3)} px farther`} after 120 more frames`);
    const over = Math.max(0, Math.floor(foot) - s.anyWall + 1);
    check(name, `pushed at ${label}: stops against footBlock inside the walkable tile, its feet's corners never on a blocked or wet pixel`, !r.bad.length && r.still && inTile && foot < s.wall && s.wall - foot <= 2,
      `tile ${s.tile}: started ${s.start}, stopped at ${r.end.map((v) => v.toFixed(1))} (feet to y ${foot.toFixed(1)}; footBlock under the feet's corners from y ${s.wall}, under their middle from y ${s.anyWall}${over ? `: the middle of the feet overlaps ${over} px row of it, as move()'s corner test allows` : ""}), ${r.bad.length ? r.bad.length + " bad foot corners" : "no foot corner on a blocked or wet pixel"}`);
  }
  // map-wide, in the compiler's data (Node) and in the game itself (this engine): exactly the accepted figures
  if (name === ENGINES.find((e) => e !== "firefox"))
    check("map", "the corner contract map-wide, from the compiled data: exactly the accepted figures", cornerAccepted(CORNER),
      `${CORNER.reached} whole-pixel spots reached by the corner test from the spawn; the feet's middle over wet pixels at ${CORNER.positions} (rows ${JSON.stringify(CORNER.hist)}), at most ${CORNER.max} rows, 2 or more at ${CORNER.spots} spots on tiles ${[...CORNER.tiles.keys()].sort().join(" ")}${cornerAccepted(CORNER) ? " (as accepted)" : `; accepted ${JSON.stringify(CORNER_ACCEPTED)}`}`);
  {
    // the same scan, in the page: the game's own blocked() and kind() for every pixel, its corner rule, from its spawn
    const g = await I(() => {
      const I2 = window.__island, L = I2.layers(), PW = L.w * 16, PH = L.h * 16, N = PW * PH, B = new Uint8Array(N), Wt = new Uint8Array(N);
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { B[y * PW + x] = I2.blocked(x, y) ? 1 : 0; Wt[y * PW + x] = I2.kind(x, y) === "water" ? 1 : 0; }
      const blk = (x, y) => x < 0 || y < 0 || x >= PW || y >= PH || B[y * PW + x] === 1, ok = (x, y) => !blk(x - 4, y - 2) && !blk(x + 4, y - 2) && !blk(x - 4, y + 1) && !blk(x + 4, y + 1);
      const sp = window.__island.preview().spawn, R = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0; R[sp[1] * PW + sp[0]] = 1; q[t++] = sp[1] * PW + sp[0];
      while (h < t) { const i = q[h++], x = i % PW, y = (i - x) / PW; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const j = ny * PW + nx; if (nx >= 4 && ny >= 2 && nx < PW - 4 && ny < PH - 1 && !R[j] && ok(nx, ny)) { R[j] = 1; q[t++] = j; } } }
      const hist = {}, tiles = {}; let max = 0, spots = 0, positions = 0, wetCorner = 0;
      for (let i = 0; i < N; i++) {
        if (!R[i]) continue;
        const x = i % PW, y = (i - x) / PW;
        for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 1], [4, 1]]) if (Wt[(y + dy) * PW + x + dx]) wetCorner++;
        const rows = (from, step) => { let n = 0; for (let r = from; r >= y - 2 && r <= y + 1; r += step) { let a = false; for (let c = x - 3; c <= x + 3; c++) if (Wt[r * PW + c]) a = true; if (a) n++; else break; } return n; };
        const n = Math.max(rows(y + 1, -1), rows(y - 2, 1));
        if (!n) continue;
        hist[n] = (hist[n] || 0) + 1; max = Math.max(max, n); positions++;
        if (n >= 2) { spots++; tiles[(x >> 4) + "," + (y >> 4)] = 1; }
      }
      return { reached: t, wetCorner, summary: { positions, hist, max, spots, tiles: Object.keys(tiles).sort() } };
    });
    (CROSS[name] = CROSS[name] || {}).mapWide = g;
    const same = JSON.stringify(g.summary) === JSON.stringify(CORNER_ACCEPTED);
    check(name, "the corner contract map-wide, in the game itself: exactly the accepted figures, and no reachable spot with a wet or blocked corner", same && g.wetCorner === 0 && g.reached === CORNER.reached,
      `${g.reached} spots reached (Node ${CORNER.reached}); the feet's middle over wet pixels at ${g.summary.positions} (rows ${JSON.stringify(g.summary.hist)}), at most ${g.summary.max}, 2 or more at ${g.summary.spots} on ${g.summary.tiles.join(" ")}; ${g.wetCorner} wet corners${same ? "; exactly as accepted" : `; accepted ${JSON.stringify(CORNER_ACCEPTED)}`}`);
  }
  for (const b of BRIDGES) {
    const d = b.deck[Math.floor(b.deck.length / 2)];
    for (const key of ["ArrowUp", "ArrowDown"]) {
      const r = await push([d[0] * 16 + 8, d[1] * 16 + 8], key, 90), t = [Math.floor(r.end[0] / 16), Math.floor(r.end[1] / 16)];
      const onDeck = await I(([x, y]) => window.__island.kind(Math.floor(x), Math.floor(y)) !== "water", r.end);
      check(name, `pushed off the ${b.id}'s deck (${key === "ArrowUp" ? "north" : "south"}): stays on dry deck or bank, never into the river`, !r.bad.length && onDeck && r.still, `from deck tile ${d}, stopped at ${r.end.map((v) => v.toFixed(1))} (tile ${t}, ground ${M.ground[at(...t)]}), ${r.bad.length ? r.bad.length + " bad foot pixels" : "no foot on a blocked or wet pixel"}`);
    }
  }
  if (SITES.rim) {
    const s = SITES.rim, r = await push(s.start, "ArrowUp", 120), top = r.end[1] - 2;
    // a tap on the rim: the planner walks to the nearest tile it can reach instead (format 1's way); never onto the rim
    const w2 = await walk(s.tile), onRim = w2.seen ? w2.seen.some((t) => t[0] === s.tile[0] && t[1] === s.tile[1]) : false;
    check(name, "pushed at a cliff rim: never enters it, and a path planned to it never reaches it", !r.bad.length && r.still && top >= (s.tile[1] + 1) * 16 && !onRim && (w2.plan === null || w2.at[0] !== s.tile[0] || w2.at[1] !== s.tile[1]),
      `rim tile ${s.tile} (level ${M.height[at(...s.tile)]}, solid): pushed, pi stopped with its feet' top at y ${top.toFixed(1)} (the rim ends at ${(s.tile[1] + 1) * 16}); walkTo it: ${w2.plan === null ? "no path" : `a ${w2.plan}-tile plan that ends at ${w2.at}, off the rim`}`);
  } else check(name, "pushed at a cliff rim", false, "no test site found");
  await I(() => window.__island.teleport(1272, 1274));
  const st = await I(() => { const s = window.__island.getState(), v = window.__island.preview(); return { p: s.pi, cam: v.camera, zoom: v.zoom }; });
  check(name, "no NaN or undefined in pi, the camera or the zoom", [st.p.x, st.p.y, st.cam[0], st.cam[1], st.zoom].every(fin) && st.p.dir !== undefined, `pi ${st.p.x},${st.p.y} ${st.p.dir}, camera ${st.cam.map((v) => v.toFixed(1))}, zoom ${st.zoom}`);
  await page.keyboard.press("m");
  const mp = await I(() => { const el = document.querySelector(".w-map"), c = el && el.querySelector("canvas"); return { open: !!el && !el.hidden, w: c ? c.width : 0, h: c ? c.height : 0, css: c ? [c.style.width, c.style.height] : null }; });
  check(name, "the big map opens", mp.open && mp.w > 0 && mp.h > 0, `${mp.w} x ${mp.h} backing, css ${mp.css} (its size and phone layout are B2e's)`);
  await page.keyboard.press("Escape");
  // B2e
  if (!SKIP.includes("routes")) await b2eRoutes(name, I, page);
  if (!SKIP.includes("heli")) await b2eHeli(name, I, page);
  check(name, "no page error, console error or uncaught exception all the way through", errs.length === 0, errs.slice(0, 4).join(" | "));
  await ctx.close();

  // review screenshots (ignored; not baselines): the live loop, the camera settled on each place
  mkdirSync(OUT, { recursive: true });
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await c2.newPage(), e2 = [];
  pg.on("pageerror", (e) => e2.push(e.message));
  await pg.goto(`http://127.0.0.1:${port}/?debug=1&islandhour=11#island`);
  await pg.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  await pg.waitForTimeout(2600);
  const shots = [["arrival-harbour", [79, 82]], ["commons", hub("commons")], ["river-bridge", BRIDGES[1].deck[2]], ["highland-ramp", [74, 36]], ["koi-headland", [116, 62]], ["headland-lighthouse", [134, 44]], ["shrine-knoll", [15, 21]]];
  const files = [];
  for (const [nm, t] of shots) {
    await pg.evaluate(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), t); await pg.waitForTimeout(900);
    const f = join(OUT, `${name}-${nm}.png`); await pg.screenshot({ path: f }); files.push(f);
  }
  // B2e: the exits' land ends, the helipad with its helicopter, the harbour sand whose walk B2e fixed, the world's edges (the camera
  // clamped), and the helicopter in flight
  for (const [nm, t] of [["nw-bridgehead", end("nw-bridgehead")], ["west-jetty", end("west-jetty")], ["helipad", [103, 98]], ["harbour-sand-85-84", [86, 84]]]) {
    await pg.evaluate(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), t); await pg.waitForTimeout(900);
    const f = join(OUT, `${name}-${nm}.png`); await pg.screenshot({ path: f }); files.push(f);
  }
  for (const [nm, xy] of [["edge-north-west", [8, 8]], ["edge-south-east", [W * 16 - 8, H * 16 - 8]]]) {
    await pg.evaluate(([x, y]) => window.__island.teleport(x, y), xy); await pg.waitForTimeout(1200);
    const f = join(OUT, `${name}-${nm}.png`); await pg.screenshot({ path: f }); files.push(f);
  }
  await pg.evaluate(() => window.__island.teleport(103 * 16 + 8, 96 * 16 + 10)); await pg.waitForTimeout(300);
  await pg.keyboard.press("e"); await pg.waitForTimeout(3600); await pg.keyboard.down("ArrowLeft"); await pg.waitForTimeout(900); await pg.keyboard.up("ArrowLeft"); await pg.waitForTimeout(400);
  { const f = join(OUT, `${name}-heli-flying.png`); await pg.screenshot({ path: f }); files.push(f); }
  const g = await pg.evaluate(() => window.__island.ground());
  const gf = join(OUT, `${name}-ground-full.png`); writeFileSync(gf, Buffer.from(g.png.split(",")[1], "base64")); files.push(gf);
  check(name, "review screenshots written (live loop, no page error)", e2.length === 0, files.map((f) => f.replace(ROOT + "/", "")).join(", "));
  await c2.close();
  if (!SKIP.includes("viewports")) { const vs = []; await b2eViewports(name, browser, port, vs); check(name, "B2e review screenshots written (ignored)", true, vs.map((f) => f.replace(ROOT + "/", "")).join(", ")); }
  await browser.close(); server.close();
}
{ const eng = Object.keys(CROSS); if (eng.length > 1) { const a = JSON.stringify(CROSS[eng[0]]), same = eng.every((e) => JSON.stringify(CROSS[e]) === a);
  check(eng.join("+"), "the corner contract's results are identical in every engine (stop positions, rows over water, worst spots)", same, same ? `${Object.keys(CROSS[eng[0]]).length} results, byte for byte` : eng.map((e) => `${e}: ${JSON.stringify(CROSS[e]).slice(0, 200)}`).join(" | ")); } }
console.log(fails ? `${fails} failed` : `nothing failed${blocked.length ? "; blocked: " + blocked.join(", ") : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
