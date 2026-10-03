#!/usr/bin/env node
/* map-parity (MAP-A0): the island's map and everything built from it, compared exactly between a
   reference revision of js/world.js and the working tree's, in each engine. Both are served with one
   read-only hook added inside the island (window.__mp, next to the ?debug=1 API), which reads the
   map's own variables, so the same digest works on both sides. Each check is a SHA-256 of the exact
   bytes (typed arrays as they are, floats as float64, canvases as RGBA), compared side by side.

   Then the sensitivity proof: planted mutations of js/maps/home.js, the source of truth, applied in
   memory (route rewrite, nothing on disk changes), each of which must fail exactly the checks it should
   and leave the ones it shouldn't alone. Then art apart from collision: the painted ground (GK) is
   repainted and nothing collision feeds may move. Last, the map as a load dependency: with
   js/maps/home.js blocked, unusable or malformed the island says it didn't load, and a retry with the
   file back opens it.

     node tools/map-parity.mjs                         715450d vs the working tree, then the mutations
     node tools/map-parity.mjs --ref=HEAD --no-mutations
     ENGINES=chromium node tools/map-parity.mjs        one engine (default chromium, webkit, firefox)

   Firefox is tried and reported BLOCKED if it can't launch. Exit code 1 on any parity difference or
   any mutation that isn't caught as expected. */
import { chromium, firefox, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const REF = arg("ref", "715450d");
const MUTATE = !process.argv.includes("--no-mutations");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const ANCHOR = "  if (DEBUG) window.__island = {";

let refSrc;
try { refSrc = execFileSync("git", ["show", `${REF}:js/world.js`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { console.error(`map-parity: can't read js/world.js at ${REF}`); process.exit(2); }
const curSrc = readFileSync(join(ROOT, "js/world.js"), "utf8");

/* the hook: runs inside the island's closure. everything it reads is the map or built from it */
const HOOK = String.raw`
  window.__mp = (function () {
    function u8(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }
    function f64(list) { return u8(Float64Array.from(list)); }
    function txt(s) { return new TextEncoder().encode(s); }
    function rgba(c) { return c.width && c.height ? u8(c.getContext("2d").getImageData(0, 0, c.width, c.height).data) : new Uint8Array(0); }
    function sorted(o) { return JSON.stringify(o, function (k, v) { return v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce(function (r, q) { r[q] = v[q]; return r; }, {}) : v; }); }
    function plain(o) { return JSON.parse(JSON.stringify(o, function (k, v) { return k.charAt(0) === "_" || (v && v.getContext) ? undefined : v; })); }
    var parts = {};
    function put(name, bytes, raw) { parts[name] = { bytes: bytes, raw: raw }; }
    function build() {
      var px, py, i, PWv = MW * T, PHv = MH * T;
      put("dims", txt(JSON.stringify([T, MW, MH, PW, PH, CX, CY, DOCKX, dockY])));
      put("layer.ground", u8(GROUND), true); put("layer.height", u8(HEIGHT), true); put("layer.coll", u8(COLL), true);
      // per pixel: the painted kind, and where feet stop (solidPx at each pixel's centre)
      put("px.kind", u8(GK), true);
      var B = new Uint8Array(PWv * PHv);
      for (py = 0; py < PHv; py++) for (px = 0; px < PWv; px++) B[py * PWv + px] = solidPx(px + 0.5, py + 0.5) ? 1 : 0;
      put("px.blocked", B, true);
      // props: every field and the order of the list; and the same with keys sorted, to tell a key-order change apart
      put("props.exact", txt(JSON.stringify(props)));
      put("props.values", txt(sorted(props)));
      put("props.links", txt(JSON.stringify({ nests: nests.map(function (n) { return props.indexOf(n); }), wall: Object.keys(wall).sort(), fence: Object.keys(fence).sort() })));
      put("stations", txt(JSON.stringify(STATIONS.map(function (s) { return [s.id, s.x, s.y, s.room || null, !!s.wide, !!s.found]; })).concat(OUT.map(function (s) { return s.id; }).join())));
      put("buildings", txt(JSON.stringify(BUILDINGS.map(function (b) { return [b.id, b.x0, b.y0, b.w, b.h, b.room]; }))));
      put("anchors", txt(JSON.stringify({ spawn: SPAWN, heli: HELI, gate: GATE, plaza: PLAZA, pond: KP, volc: VOLC, paddocks: PADDOCKS, compound: COMPOUND, river: RIVER_PTS })));
      put("shape.curves", f64([].concat.apply([], ["river", "road"].map(function (kd) { return [].concat.apply([CURVES[kd].length], CURVES[kd]); }))));
      put("shape.falls", txt(JSON.stringify(FALLS)));
      put("shape.depth", txt(JSON.stringify(DEPTH)));
      var fo = []; for (i = 0; i < FOAM.length; i++) if (FOAM[i]) fo.push(i, FOAM[i].length, FOAM[i].join());
      put("shape.foam", txt(fo.join(";")));
      // the shape functions at every place the painter or the game asks them: pixel centres, 2x2 block
      // centres, pixel columns, tile corners
      var A = new Float64Array(PWv * PHv); for (py = 0; py < PHv; py++) for (px = 0; px < PWv; px++) A[py * PWv + px] = coast((px + 0.5) / T, (py + 0.5) / T);
      put("fn.coast.px", u8(A));
      A = new Float64Array(PWv * PHv); for (py = 0; py < PHv; py++) for (px = 0; px < PWv; px++) A[py * PWv + px] = pondF((px + 0.5) / T, (py + 0.5) / T);
      put("fn.pond.px", u8(A));
      var Q = (PWv >> 1) * (PHv >> 1), C2 = new Float64Array(Q), T2 = new Float64Array(Q);
      for (py = 0; py < PHv; py += 2) for (px = 0; px < PWv; px += 2) { i = (py >> 1) * (PWv >> 1) + (px >> 1); C2[i] = coast((px | 1) / T, (py | 1) / T); T2[i] = tier((px | 1) / T, (py | 1) / T); }
      put("fn.coast.block", u8(C2)); put("fn.tier.block", u8(T2));
      var E = new Float64Array(PWv * 2); for (px = 0; px < PWv; px++) { E[px] = hiEdge((px + 0.5) / T); E[PWv + px] = midEdge((px + 0.5) / T); }
      put("fn.edges.col", u8(E));
      var F = new Float64Array(MW * MH); for (i = 0; i < MW * MH; i++) F[i] = forest(i % MW, (i / MW) | 0);
      put("fn.forest.tile", u8(F));
      // pictures: the painted ground, the volcano, the minimap and the full map
      put("img.ground", rgba(ground)); put("img.volcano", rgba(volc.canvas)); put("img.mini", rgba(mini));
      buildBigMap(); put("img.bigmap", rgba(bigMap));
      // the path and landing caches, filled for every tile
      var D = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for (var ty = 0; ty < MH; ty++) for (var tx = 0; tx < MW; tx++) D.forEach(function (d) { var bx = tx + d[0], by = ty + d[1]; if (bx >= 0 && by >= 0 && bx < MW && by < MH) canStep(tx, ty, bx, by); });
      put("cache.stepok", u8(STEPOK), true);
      safeTile(0, 0); put("cache.safe", u8(SAFE), true);
      var L = new Uint8Array(MW * MH); for (i = 0; i < MW * MH; i++) L[i] = landTile(i % MW, (i / MW) | 0) ? 1 : 0;
      put("cache.land", L, true);
      var CL = []; for (py = 0; py < PHv; py += 8) for (px = 0; px < PWv; px += 8) CL.push(canLand(px, py) ? 1 : 0);
      put("cache.canland8", Uint8Array.from(CL));
      // the creatures, the bots, the car and pi as the island starts (after spawning out of walls)
      put("actors.start", txt(JSON.stringify({ critters: critters.map(function (c) { return [c.kind, c.x, c.y]; }), bots: bots.map(function (b) { return [b.kind, b.x, b.y]; }), car: [car.x, car.y, car.a], rex: [rex.x, rex.y], heli: [heli.x, heli.y], pi: [pi.x, pi.y] })));
      put("places", txt(JSON.stringify(PLACES)));
      put("rooms", txt(sorted({ rooms: plain(ROOMS), doors: DOORS })));
      return Object.keys(parts);
    }
    return {
      build: build,
      raw: function (name) { return parts[name].bytes; },
      /* art and collision apart: repaint GK (every painted-water pixel on a tile feet may enter turned to
         grass, and a 4 x 4 pool of water painted in the middle of 300 open tiles), then ask everything
         collision feeds again: where feet stop at every pixel, every step, the safe ground, landing on an
         8 px grid and 40 routes. under the authored model none of it may move; under the old one it
         does. GK is put back and the caches emptied afterwards */
      decouple: function () {
        var PWv = MW * T, PHv = MH * T, px, py, i;
        var ROUTES = [[44, 58, 89, 38], [44, 58, 21, 22], [44, 58, 18, 36], [44, 58, 20, 47], [44, 58, 66, 54], [44, 58, 41, 21], [44, 58, 64, 40], [44, 58, 25, 64], [21, 60, 69, 45], [58, 22, 37, 61]];
        function snap() {
          var B = new Uint8Array(PWv * PHv); for (py = 0; py < PHv; py++) for (px = 0; px < PWv; px++) B[py * PWv + px] = solidPx(px + 0.5, py + 0.5) ? 1 : 0;
          STEPOK.fill(0);
          for (var ty = 0; ty < MH; ty++) for (var tx = 0; tx < MW; tx++) [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) { var bx = tx + d[0], by = ty + d[1]; if (bx >= 0 && by >= 0 && bx < MW && by < MH) canStep(tx, ty, bx, by); });
          SAFE = null; safeTile(0, 0);
          var L = []; for (py = 0; py < PHv; py += 8) for (px = 0; px < PWv; px += 8) L.push(canLand(px, py) ? 1 : 0);
          var keep = [pi.x, pi.y], R = ROUTES.map(function (r) { pi.x = r[0] * T + 8; pi.y = r[1] * T + 10; var p = piPath([r[2], r[3]], true); return p ? p.map(String).join(" ") : "none"; });
          pi.x = keep[0]; pi.y = keep[1];
          return { blocked: B, stepok: STEPOK.slice(), safe: SAFE.slice(), land: L, routes: R };
        }
        function diff(a, b) { var n = 0; for (var j = 0; j < a.length; j++) if (a[j] !== b[j]) n++; return n; }
        var before = snap(), keepGK = GK.slice(), painted = 0, pools = 0;
        for (i = 0; i < GK.length; i++) {
          var tt = GROUND[((i / PWv | 0) >> 4) * MW + ((i % PWv) >> 4)];
          if (GK[i] === KW && walkable((i % PWv) >> 4, (i / PWv | 0) >> 4) && tt !== BRIDGE && tt !== DOCK) { GK[i] = KG; painted++; }
        }
        for (var ty2 = 0; ty2 < MH && pools < 300; ty2++) for (var tx2 = 0; tx2 < MW && pools < 300; tx2++) {
          if (!walkable(tx2, ty2) || GROUND[ty2 * MW + tx2] !== GRASS) continue;
          for (var j2 = 6; j2 < 10; j2++) for (var i2 = 6; i2 < 10; i2++) { GK[(ty2 * T + j2) * PWv + tx2 * T + i2] = KW; painted++; }
          pools++;
        }
        var after = snap(), out = { gkPixelsRepainted: painted, gkDiffer: diff(keepGK, GK), blocked: diff(before.blocked, after.blocked), stepok: diff(before.stepok, after.stepok),
          safe: diff(before.safe, after.safe), land: diff(before.land, after.land), routes: diff(before.routes, after.routes) };
        GK.set(keepGK); STEPOK.fill(0); SAFE = null;
        return out;
      },
      // where pi stands on going into each building and coming out (state is put back afterwards)
      doors: function () {
        var out = [];
        BUILDINGS.forEach(function (bd) { if (!bd.room) return; enterRoom(bd.room); out.push([bd.room, "in", pi.x, pi.y]); exitRoom(); out.push([bd.room, "out", pi.x, pi.y]); doorAnim = null; });
        return out;
      }
    };
  })();
`;

function hooked(src) {
  if (!src.includes(ANCHOR)) throw new Error("map-parity: the debug block isn't there to hook into");
  return src.replace(ANCHOR, HOOK + ANCHOR);
}

/* the planted mutations: each edits the working tree's js/maps/home.js in memory (it's served changed;
   nothing on disk changes), the source of truth for everything mutated here since MAP-A2b. "must" lists
   checks that have to fail; "keep" lists checks that have to stay equal (the mutation is that kind of
   change only). each first checks the value it changes is what it expects, so a drift in the data shows
   as a broken mutation, not a silent pass */
const MAPFILE = join(ROOT, "js/maps/home.js");
const mapOf = (text) => { const c = { window: {} }; vm.runInNewContext(text, c); return c.window.ISLAND_MAPS.home; };
const mapEdit = (fn) => (text) => { const M = JSON.parse(JSON.stringify(mapOf(text))); fn(M); return "(window.ISLAND_MAPS = window.ISLAND_MAPS || {}).home = " + JSON.stringify(M) + ";\n"; };
const setChar = (rows, y, x, want, to) => { if (rows[y][x] !== want) throw new Error(`row ${y} x ${x} is ${rows[y][x]}, not ${want}`); rows[y] = rows[y].slice(0, x) + to + rows[y].slice(x + 1); };
const PIXELS = ["px.kind", "img.ground", "img.mini", "img.bigmap", "fn.coast.px", "fn.pond.px", "shape.curves"];
const GAMEPLAY = ["layer.ground", "layer.height", "layer.coll", "px.blocked", "cache.stepok", "cache.safe", "cache.land"];
const MUTATIONS = [
  { name: "one ground value (home.js: meadow tile 50,45 grass to sand)", map: mapEdit((M) => setChar(M.ground, 45, 50, "3", "2")), must: ["layer.ground"], keep: ["layer.coll", "layer.height"] },
  { name: "one collision bit (home.js: open meadow tile 52,40 made solid; art untouched)", map: mapEdit((M) => setChar(M.coll.rows, 40, 52, M.coll.values.indexOf(0).toString(36), M.coll.values.indexOf(1).toString(36))),
    must: ["layer.coll", "px.blocked", "cache.stepok"], keep: ["layer.ground", "layer.height", "px.kind", "img.ground", "img.mini", "props.exact"] },
  { name: "one height value (home.js: tile 52,40 meadow 1 to 2)", map: mapEdit((M) => setChar(M.height, 40, 52, "1", "2")), must: ["layer.height"], keep: ["layer.ground", "layer.coll", "px.kind", "img.ground"] },
  { name: "one prop field (home.js: the first lamp's ox, absent to 1; a visual change, no collision)", map: mapEdit((M) => { const p = M.props.find((q) => q.kind === "lamp"); if (!p || "ox" in p) throw new Error("no lamp without ox"); p.ox = 1; }),
    must: ["props.exact", "props.values"], keep: GAMEPLAY.concat(PIXELS) },
  // a row of 16 blocked pixels across the middle of open meadow tile 52,40 (pixel row 648, where pi's
  // feet are tested walking through the tile's aim spot): feet stop there and the steps through the tile
  // change, but the tiles, the safe ground and every picture don't
  { name: "one footBlock run (home.js: pixels 832 to 847 on row 648, open meadow tile 52,40)", map: mapEdit((M) => {
      if (M.coll.values[parseInt(M.coll.rows[40][52], 36)] !== 0) throw new Error("tile 52,40 isn't open");
      // the row has runs elsewhere (river and sea edges): the new one goes in among them, in order,
      // touching none, so the row stays canonical
      let row = M.footBlock.find((r) => r[0] === 648);
      if (!row) { const at = M.footBlock.findIndex((r) => r[0] > 648); row = [648]; M.footBlock.splice(at < 0 ? M.footBlock.length : at, 0, row); }
      const runs = []; for (let i = 1; i < row.length; i += 2) runs.push([row[i], row[i + 1]]);
      if (runs.some(([x0, n]) => x0 <= 848 && x0 + n >= 832)) throw new Error("row 648 already has a run at or next to 832 to 847");
      runs.push([832, 16]); runs.sort((a, b) => a[0] - b[0]); row.length = 1; runs.forEach(([x0, n]) => row.push(x0, n)); }),
    must: ["px.blocked", "cache.stepok"], keep: ["layer.ground", "layer.height", "layer.coll", "cache.safe", "cache.land", "px.kind", "img.ground", "img.mini", "props.exact"] },
  // moving a landmark moves its solid tile with it (a landmark on land is something pi bumps into)
  { name: "one station coordinate (home.js: signpost x 44 to 45, its solid tile with it)", map: mapEdit((M) => {
      if (M.stations.sign[0] !== 44) throw new Error("signpost isn't at x 44");
      M.stations.sign[0] = 45; const o = M.coll.values.indexOf(0).toString(36), c = M.coll.values.indexOf(1).toString(36);
      setChar(M.coll.rows, 57, 44, c, o); setChar(M.coll.rows, 57, 45, o, c); }), must: ["stations", "layer.coll", "px.blocked"] },
  // and moving it without its collision is an authoring mistake decodeMap refuses
  { name: "a station moved without its collision (home.js: signpost x 44 to 45 only)", map: mapEdit((M) => { M.stations.sign[0] = 45; }),
    refuse: /^pi's island: js\/maps\/home\.js: station sign stands on land at 45,57 but that tile isn't solid in coll$/ },
  { name: "one road coordinate (home.js: the tablet spur's end 51.6 to 51.61)", map: mapEdit((M) => { const c = M.shapes.curves.find((q) => JSON.stringify(q.pts) === "[[47.8,50.6],[51.6,51.4]]"); if (!c) throw new Error("no tablet spur"); c.pts[1][0] = 51.61; }), must: ["shape.curves", "px.kind", "img.ground"] },
  { name: "plaza radius (home.js: 2.7 to 2.71; changes painted dirt only, no tile or collision)", map: mapEdit((M) => { if (M.shapes.plaza.r !== 2.7) throw new Error("plaza r isn't 2.7"); M.shapes.plaza.r = 2.71; }), must: ["anchors", "px.kind", "img.ground"], keep: GAMEPLAY },
  // pi's first-visit start is the mailbox spot (50,61), not SPAWN, and SAFE floods from SPAWN's tile, so a
  // 1 px move shows only in the anchors check (which is why that check exists)
  { name: "spawn coordinate (home.js: spawn x + 1 px)", map: mapEdit((M) => { if (M.anchors.spawn[0] !== 744) throw new Error("spawn x isn't 744"); M.anchors.spawn[0] += 1; }), must: ["anchors"], keep: GAMEPLAY.concat(PIXELS) }
];

const PORT = 8900 + Math.floor(Math.random() * 90);
const server = await serve(PORT);
const URL0 = `http://localhost:${PORT}/?debug=1&step=1&seed=42&islandhour=11#island`;

async function digest(browser, src, mapSrc) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  // the island opens, or the map is refused (decodeMap's error stops the build): either ends the wait
  const refused = new Promise((ok) => page.on("pageerror", (e) => { if (/^pi's island: /.test(e.message)) ok(e.message); }));
  await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: src }));
  if (mapSrc) await page.route(/\/js\/maps\/home\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: mapSrc }));
  await page.goto(URL0);
  const opened = page.waitForFunction(() => window.__mp && window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => null);
  const why = await Promise.race([opened, refused]);
  if (why) { await ctx.close(); return { refused: why, out: {}, errors: [] }; }
  const reg0 = await page.evaluate(() => JSON.stringify(window.ISLAND_MAPS && window.ISLAND_MAPS.home));
  const names = await page.evaluate(() => window.__mp.build());
  const out = {};
  for (const n of names) out[n] = await page.evaluate(async (k) => { const b = window.__mp.raw(k); const h = await crypto.subtle.digest("SHA-256", b); return { len: b.length, sha: Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("") }; }, n);
  // behaviour: 600 seeded steps from the start; then walks from the signpost to places all over the
  // island; the doors last (they move pi)
  const beh = await page.evaluate(() => {
    const I = window.__island; I.setSeed(42); I.step(600);
    const s = I.getState(), r = { start600: JSON.stringify({ t: s.t, pi: s.pi, critters: s.critters }), walks: [] };
    for (const [x, y] of [[89, 38], [21, 22], [18, 36], [25, 64], [58, 22], [66, 54], [41, 21], [21, 60], [64, 40], [48, 35], [69, 45], [37, 61]]) {
      I.teleport(44 * 16 + 8, 58 * 16 + 10); const len = I.walkTo(x, y, true); let n = 0;
      while (I.getState().pi.path && n < 3000) { I.step(10); n += 10; }
      const p = I.getState().pi; r.walks.push([x, y, len, n, p.x, p.y]);
    }
    r.walks = JSON.stringify(r.walks); r.doors = JSON.stringify(window.__mp.doors());
    return r;
  });
  // the map registry's data is never changed by the game (it decodes and copies it)
  const reg1 = await page.evaluate(() => JSON.stringify(window.ISLAND_MAPS && window.ISLAND_MAPS.home));
  const served = JSON.stringify(mapOf(mapSrc || readFileSync(MAPFILE, "utf8")));
  out["registry.untouched"] = { len: 1, sha: reg0 === served && reg1 === served ? "unchanged" : "CHANGED" };
  for (const [k, v] of Object.entries(beh)) out["behaviour." + k] = { len: v.length, sha: createHash("sha256").update(v).digest("hex") };
  const raw = async (k) => Buffer.from(await page.evaluate((n) => { const b = window.__mp.raw(n); let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); }, k), "base64");
  return { out, errors, page, ctx, raw };
}

/* the map as a load dependency (audio.js, then js/maps/home.js, then world.js): with the map file not
   loading, loading with no usable map, or with a layer that won't decode, the island isn't marked ready, the orb's hint says it didn't
   load, and once the file is back a click on the orb loads and opens the island */
const FAILED = "[ the island didn't load. try again ]";
async function loader(browser, how) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  let broken = true, mapLoads = 0;
  await page.route(/\/js\/maps\/home\.js/, (r) => { mapLoads++; if (!broken) return r.continue(); if (how === "blocked") return r.abort();
    return r.fulfill({ status: 200, contentType: "text/javascript", body: how === "unusable" ? "/* no map here */\n" : mapEdit((M) => { M.ground[3] = M.ground[3].slice(1); })(readFileSync(MAPFILE, "utf8")) }); });
  await page.goto(`http://localhost:${PORT}/?debug=1#island`);
  await page.waitForFunction((t) => { const h = document.querySelector(".orb-hint"); return h && h.textContent === t; }, FAILED, { timeout: 30000 }).catch(() => {});
  const down = await page.evaluate(() => ({ hint: document.querySelector(".orb-hint").textContent, busy: document.querySelector(".orb-btn").hasAttribute("aria-busy"), enter: typeof window.islandEnter, api: typeof window.__island }));
  broken = false;
  await page.click(".orb-btn");
  const back = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 }).then(() => true, () => false);
  const after = await page.evaluate(() => ({ hint: document.querySelector(".orb-hint").textContent, enter: typeof window.islandEnter }));
  await ctx.close();
  const expectErr = { blocked: [], unusable: ["pi's island: js/maps/home.js: no map (window.ISLAND_MAPS has no entry for it)"], malformed: ["pi's island: js/maps/home.js: ground row 3 must be 100 long, not 99"] }[how];
  return { down, back, after, mapLoads, errors, ok: down.hint === FAILED && !down.busy && down.enter === "undefined" && down.api === "undefined" && back && after.hint !== FAILED && after.enter === "function" && mapLoads === 2 && JSON.stringify(errors) === JSON.stringify(expectErr) };
}

function compare(a, b) { return Object.keys(a.out).filter((k) => !b.out[k] || a.out[k].sha !== b.out[k].sha || a.out[k].len !== b.out[k].len); }
async function where(a, b, k) {             // for the raw layers: how many values differ and the first one
  if (!["layer.ground", "layer.height", "layer.coll", "px.kind", "px.blocked", "cache.stepok", "cache.safe", "cache.land"].includes(k)) return "";
  const [x, y] = [await a.raw(k), await b.raw(k)]; let n = 0, first = -1;
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) { n++; if (first < 0) first = i; }
  return ` (${n} differ, first at index ${first})`;
}

const t0 = Date.now(); let failed = false; const report = [];
for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); continue; }
  const te = Date.now();
  const ref = await digest(browser, hooked(refSrc));
  const cur = await digest(browser, hooked(curSrc));
  const diff = compare(ref, cur), errs = [...ref.errors, ...cur.errors];
  console.log(`${name}: ${Object.keys(ref.out).length} checks, ${REF} vs working tree: ${diff.length ? "DIFFERS in " + diff.join(", ") : "identical"}${errs.length ? "; page errors: " + errs.join(" | ") : ""}`);
  for (const k of diff) console.log("   ", k + await where(ref, cur, k));
  if (diff.length || errs.length) failed = true;
  if (name === "chromium") for (const [k, v] of Object.entries(ref.out)) report.push(`    ${k.padEnd(20)} ${String(v.len).padStart(9)} bytes  ${v.sha.slice(0, 16)}`);
  await cur.ctx.close();
  if (MUTATE) for (const m of MUTATIONS) {
    let src, mapSrc; try { src = hooked(curSrc); mapSrc = m.map(readFileSync(MAPFILE, "utf8")); } catch (e) { console.log(`  MUTATION BROKEN ${m.name}: ${e.message}`); failed = true; continue; }
    const mu = await digest(browser, src, mapSrc);
    if (m.refuse || mu.refused) {
      const ok = !!m.refuse && !!mu.refused && m.refuse.test(mu.refused);
      console.log(`  ${ok ? "refused" : "NOT AS EXPECTED"}  ${m.name}\n           ${mu.refused ? "the island refused the map: " + mu.refused : "the island opened"}`);
      if (!ok) failed = true;
      continue;
    }
    const d = compare(ref, mu);
    const missed = m.must.filter((k) => !d.includes(k)), leaked = (m.keep || []).filter((k) => d.includes(k));
    const ok = d.length > 0 && !missed.length && !leaked.length && !mu.errors.length;
    console.log(`  ${ok ? "caught" : "NOT AS EXPECTED"}  ${m.name}\n           failed: ${d.join(", ") || "nothing"}${missed.length ? "\n           should have failed: " + missed.join(", ") : ""}${leaked.length ? "\n           should have stayed equal: " + leaked.join(", ") : ""}${mu.errors.length ? "\n           page errors: " + mu.errors.join(" | ") : ""}`);
    for (const k of d.filter((k) => m.must.includes(k))) { const w = await where(ref, mu, k); if (w) console.log(`           ${k}${w}`); }
    if (!ok) failed = true;
    await mu.ctx.close();
  }
  {
    const D = {};
    for (const [side, code] of [["reference", refSrc], ["working tree", curSrc]]) {
      const g = await digest(browser, hooked(code));
      D[side] = await g.page.evaluate(() => window.__mp.decouple()); await g.ctx.close();
    }
    const r = D["reference"], c = D["working tree"];
    const okRef = r.blocked > 0 && r.stepok > 0, okCur = c.gkDiffer > 0 && c.blocked === 0 && c.stepok === 0 && c.safe === 0 && c.land === 0 && c.routes === 0;
    console.log(`  art apart from collision: GK repainted at ${c.gkDiffer} px; working tree: solidPx ${c.blocked}, STEPOK ${c.stepok}, SAFE ${c.safe}, landing ${c.land}, routes ${c.routes} changed: ${okCur ? "ok" : "NOT AS EXPECTED"}`);
    console.log(`     (${REF}, the old rule, for contrast: solidPx ${r.blocked}, STEPOK ${r.stepok}, SAFE ${r.safe}, landing ${r.land}, routes ${r.routes} changed${okRef ? "" : "; EXPECTED THE OLD RULE TO MOVE"})`);
    if (!okCur || !okRef) failed = true;
  }
  for (const how of ["blocked", "unusable", "malformed"]) {
    const L = await loader(browser, how);
    console.log(`  loader, map file ${how}: ${L.ok ? "ok" : "NOT AS EXPECTED"}  hint "${L.down.hint}", ready ${L.down.enter !== "undefined"}, busy ${L.down.busy}; after a retry with the file back: island open ${L.back}, hint "${L.after.hint}"; map requests ${L.mapLoads}; page errors ${JSON.stringify(L.errors)}`);
    if (!L.ok) failed = true;
  }
  await ref.ctx.close(); await browser.close();
  console.log(`  ${name} took ${((Date.now() - te) / 1000).toFixed(1)} s`);
}
server.close();
if (report.length) console.log("checks (chromium, reference side):\n" + report.join("\n"));
console.log(`${failed ? "FAIL" : "PASS"} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
