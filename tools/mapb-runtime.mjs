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
   Deferred: every B1 route end, the helicopter (flying, landing on the pad), the big map's size and phone layout and
   the performance figures (B2e); the painter (B2c, B2d). */
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPreview } from "./mapb-preview.mjs";
import { loadSource, compile, GROUND, COLL, WHY } from "./map-compile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tools/out/mapb/runtime");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
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
  const g = await pg.evaluate(() => window.__island.ground());
  const gf = join(OUT, `${name}-ground-full.png`); writeFileSync(gf, Buffer.from(g.png.split(",")[1], "base64")); files.push(gf);
  check(name, "review screenshots written (live loop, no page error)", e2.length === 0, files.map((f) => f.replace(ROOT + "/", "")).join(", "));
  await c2.close(); await browser.close(); server.close();
}
{ const eng = Object.keys(CROSS); if (eng.length > 1) { const a = JSON.stringify(CROSS[eng[0]]), same = eng.every((e) => JSON.stringify(CROSS[e]) === a);
  check(eng.join("+"), "the corner contract's results are identical in every engine (stop positions, rows over water, worst spots)", same, same ? `${Object.keys(CROSS[eng[0]]).length} results, byte for byte` : eng.map((e) => `${e}: ${JSON.stringify(CROSS[e]).slice(0, 200)}`).join(" | ")); } }
console.log(fails ? `${fails} failed` : `nothing failed${blocked.length ? "; blocked: " + blocked.join(", ") : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
