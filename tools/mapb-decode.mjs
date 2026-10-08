#!/usr/bin/env node
/* mapb-decode (MAP-B B2b): the game's format-2 decoder (decodeMap2 in js/world.js, through the ?debug=1 API, the
   production function, not a copy) on the staged MAP-B island, and the walls round the terrain preview. In each
   engine (Chromium and WebKit; Firefox is tried and reported BLOCKED if it can't launch):

   - the real staged map decodes, and what the game decoded is what the compiler made: the ground, height and
     collision layers byte for byte, every one of the 22,101 footBlock and 43,589 edgeMask pixels, 150 x 120, the four
     levels, the 8 ramps, the water, the 2 falls, the 3 bridges, the docks, the pad, the tile anchors and the spawn
     made from them; decoding never changes what it's given, and twice gives the same;
   - malformed staged maps are refused, one fault at a time, each with an error naming the field and the problem;
   - the preview's walls: a staged map without the preview flag, or with it on a host that isn't loopback (the flag
     forged), or a non-staged format-2 map, is refused and the island doesn't load; the production page on
     localhost and on 127.0.0.1 loads format 1, with no preview, no badge and its save; the preview on both hosts
     loads the staged map, reads and writes no storage, and leaves a production save on the same origin untouched.

     node tools/mapb-decode.mjs
     ENGINES=chromium node tools/mapb-decode.mjs        (default chromium, webkit, firefox) */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview, stagedWrapper } from "./mapb-preview.mjs";
import { loadSource, compile } from "./map-compile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const STAGED_TEXT = readFileSync(join(ROOT, "tools/maps/staged/home.js"), "utf8");
const STAGED = (() => { const c = { window: {} }; vm.runInNewContext(STAGED_TEXT, c); return c.window.ISLAND_MAPS_STAGED.home; })();
// the compiler's own answer, for the byte-for-byte comparison
const { src, sourceSha256 } = await loadSource();
const M = compile(src, sourceSha256);
const idx = (bits) => { const out = []; for (let i = 0; i < bits.length; i++) if (bits[i]) out.push(i); return out; };
const WANT = { ground: Array.from(M.ground), height: Array.from(M.height), coll: Array.from(M.coll), foot: idx(M.px.foot), edge: idx(M.px.edge) };

let fails = 0, blocked = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const sameArr = (a, b) => { if (!a || !b || a.length !== b.length) return { ok: false, n: -1 }; let n = 0, f = -1; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { n++; if (f < 0) f = i; } return { ok: n === 0, n, f }; };

// one fault at a time on the staged map (each still staged, so decodeMap2 judges it)
const edit = (fn) => { const o = copy(STAGED); fn(o); return o; };
const firstFootRow = STAGED.footBlock[0];
const REFUSE = [
  ["an unknown field (home content B3 hasn't added: buildings)", edit((o) => { o.buildings = []; }), /^the map has an unknown field buildings$/],
  ["a height of 4 (format 2 has levels 0 to 3)", edit((o) => { o.height[60] = o.height[60].slice(0, 70) + "4" + o.height[60].slice(71); }), /^height row 60 has "4" at 70 \(0 to 3\)$/],
  ["a ground row a tile short", edit((o) => { o.ground[3] = o.ground[3].slice(1); }), /^ground row 3 must be 150 long, not 149$/],
  ["a footBlock pixel on a tile coll already blocks (deep sea)", edit((o) => { o.footBlock.unshift([0, 0, 1]); }), /^footBlock pixel 0,0 is on tile 0,0, which coll already blocks$/],
  ["footBlock runs overlapping", edit((o) => { const r = o.footBlock.find((q) => q.length >= 5); r[3] = r[1]; }), /footBlock row \d+: the run at \d+ overlaps or touches the one before/],
  ["a footBlock run dropped (the edge mask still shows water there)", edit((o) => { o.footBlock.shift(); }), new RegExp(`^edgeMask pixel ${firstFootRow[1]},${firstFootRow[0]} looks like water on walkable tile \\d+,\\d+ but footBlock doesn't stop feet there$`)],
  ["an edgeMask row out of order", edit((o) => { const t = o.edgeMask[0]; o.edgeMask[0] = o.edgeMask[1]; o.edgeMask[1] = t; }), /^edgeMask rows must go up/],
  ["the spawn tile in the sea", edit((o) => { o.anchors.spawnTile = [79, 100]; }), /^anchors\.spawnTile 79,100 is on a tile that can't be walked$/],
  ["the spawn where pi's feet would touch footBlock", edit((o) => { o.anchors.spawnTile = null; }), /^anchors\.spawnTile must be a list of 2$/],
  ["the helipad anchor off the pad", edit((o) => { o.anchors.helipadTile = [99, 95]; }), /^anchors\.helipadTile 99,95 isn't on a pad tile in ground$/],
  ["a world-px spawn in format 2 (anchors are tiles)", edit((o) => { o.anchors.spawn = [1272, 1274]; }), /^anchors has an unknown field spawn$/],
  ["a ramp joining levels 0 and 2", edit((o) => { o.shapes.ramps[0].levels = [0, 2]; }), /^shapes\.ramps main-path must join two neighbouring levels$/],
  ["a waterfall tile that isn't river", edit((o) => { o.shapes.falls[0].tiles[0] = [79, 79]; }), /^shapes\.falls\[0\]\.tiles\[0\] 79,79 isn't a river tile$/],
  ["a dock box over grass", edit((o) => { o.shapes.docks[0].y0 = 70; }), /^shapes\.docks harbour-quay: tile 66,70 isn't dock in ground$/],
  ["a bridge's tile count wrong", edit((o) => { o.shapes.bridges[1].tiles = 6; }), /^shapes\.bridges brachio-bridge\.tiles is 6 but its bridgeBox holds 5 bridge tiles$/],
  ["a bridge's axis against its direction", edit((o) => { o.shapes.bridges[0].deckAxis = "ns"; }), /^shapes\.bridges upper-bridge\.deckAxis must be the larger of deckDir's directions$/],
  ["a fourth bridge with no tiles of its own", edit((o) => { o.shapes.bridges.push({ ...o.shapes.bridges[2], id: "east-bridge" }); }), /^shapes\.bridges hold 27 bridge tiles but ground has 17$/],
  ["a river of an unknown type", edit((o) => { o.shapes.rivers[0].type = "catmull-rom"; }), /^shapes\.rivers main-river\.type must be hermite-open$/]
];

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const port = 8900 + Math.floor(Math.random() * 400), pv = await startPreview(port), port2 = port + 1, plain = await serve(port2);
  const open = async (url, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [], cons = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") cons.push(m.text()); });
    if (opts.route) await opts.route(page);
    if (opts.store) { await page.goto(opts.storeAt || url.replace(/#.*$/, "")); await page.evaluate((st) => { localStorage.clear(); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, opts.store); }
    await page.goto(url);
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 20000 }).then(() => true, () => false);
    return { ctx, page, errs, cons, loaded };
  };

  // 1. the real staged map, decoded by the game, against the compiler
  {
    const { ctx, page, errs, loaded } = await open(`http://127.0.0.1:${port}/?debug=1&step=1#island`);
    check(name, "the preview loads (the staged map, the flag, 127.0.0.1)", loaded && !errs.length, errs.join("; "));
    const d = await page.evaluate((o) => { const fr = (x) => { Object.freeze(x); Object.values(x).forEach((v) => { if (v && typeof v === "object") fr(v); }); return x; };
      const before = JSON.stringify(o), a = window.__island.decodeDetail(fr(JSON.parse(before))), b = window.__island.decodeDetail(JSON.parse(before));
      return { a, same: JSON.stringify(a) === JSON.stringify(b), unchanged: true }; }, STAGED);
    const a = d.a;
    for (const k of ["ground", "height", "coll"]) { const r = sameArr(a[k], WANT[k]); check(name, `decoded ${k} equals the compiler's, byte for byte`, r.ok, r.ok ? `${a[k].length} tiles` : `${r.n} differ (first at ${r.f})`); }
    { const r = sameArr(a.foot, WANT.foot); check(name, "decoded footBlock reproduces every blocked pixel", r.ok && a.footPixels === 22101, `${a.foot.length} pixels (compiler ${WANT.foot.length}, staged 22101)${r.ok ? "" : `, ${r.n} differ`}`); }
    { const r = sameArr(a.edge, WANT.edge); check(name, "decoded edgeMask reproduces every boundary pixel", r.ok && a.edgePixels === 43589, `${a.edge.length} pixels (compiler ${WANT.edge.length}, staged 43589)${r.ok ? "" : `, ${r.n} differ`}`); }
    const levels = [...new Set(a.height.filter((v, i) => M.land[i]))].sort();
    check(name, "150 x 120, four levels on land", a.w === 150 && a.h === 120 && JSON.stringify(levels) === "[0,1,2,3]", `${a.w} x ${a.h}, levels ${levels}`);
    check(name, "ramps, water, rivers, falls, docks, the pad", a.ramps === 8 && a.water === 4 && a.rivers === 2 && a.falls === 2 && a.docks === 3 && JSON.stringify(a.helipad) === '{"x0":101,"y0":93,"x1":105,"y1":97}',
      `${a.ramps} ramps, ${a.water} still waters, ${a.rivers} rivers, ${a.falls} falls, ${a.docks} docks, pad ${JSON.stringify(a.helipad)}`);
    check(name, "the 3 bridges", JSON.stringify(a.bridges) === '[["upper-bridge",2,"ew"],["brachio-bridge",5,"ew"],["delta-bridge",10,"ew"]]', JSON.stringify(a.bridges));
    check(name, "tile anchors kept as tiles; the spawn made from spawnTile (its aim spot, x * 16 + 8, y * 16 + 10)", JSON.stringify(a.tileAnchors) === '{"spawnTile":[79,79],"helipadTile":[103,95]}' && JSON.stringify(a.anchors) === '{"spawn":[1272,1274],"helipad":[103,95]}',
      `tileAnchors ${JSON.stringify(a.tileAnchors)}, runtime anchors ${JSON.stringify(a.anchors)}`);
    check(name, "no home content (B3's): no buildings, landmarks, spawns, props or places", Object.values(a.content).every((v) => v === 0), JSON.stringify(a.content));
    check(name, "decoding a frozen copy works, and twice gives the same", d.same, "");
    // the refusals
    for (const [what, o, re] of REFUSE) {
      const r = await page.evaluate((m) => { try { window.__island.decodeMap(m); return { ok: true }; } catch (e) { return { ok: false, msg: e.message }; } }, o);
      check(name, `refused: ${what}`, !r.ok && re.test(r.msg), r.ok ? "NOT refused" : r.msg);
    }
    // a non-staged format 2 doesn't reach decodeMap2: it is refused as production refuses any format but 1
    { const r = await page.evaluate((m) => { try { window.__island.decodeMap(m); return null; } catch (e) { return e.message; } }, edit((o) => { delete o.staged; }));
      check(name, "a non-staged format-2 map gets no preview: refused as format 1 refuses it", /^the map has an unknown field runtimeSupported$|^format 2 isn't supported \(this code reads format 1\)$/.test(r || ""), r || "NOT refused"); }
    await ctx.close();
  }

  // 2. the walls round the preview: these must not load the staged map
  const refusedLoad = async (label, url, route) => {
    const { ctx, page, errs, cons, loaded } = await open(url, { route });
    const st = await page.evaluate(() => ({ enter: typeof window.islandEnter, hint: (document.querySelector(".orb-hint") || {}).textContent || "" }));
    const said = cons.concat(errs).join(" | ");
    check(name, label, !loaded && st.enter === "undefined" && /pi's island: js\/maps\/home\.js: (this is a staged map: it runs only in the local MAP-B preview|the map has an unknown field runtimeSupported|format 2 isn't supported)/.test(said), `loaded ${loaded}; islandEnter ${st.enter}; said "${said.slice(0, 160)}"`);
    await ctx.close();
  };
  const noFlag = (page) => page.route(/\/js\/maps\/home\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STAGED_TEXT + "\nwindow.ISLAND_MAPS = { home: window.ISLAND_MAPS_STAGED.home };\n" }));
  await refusedLoad("the staged map without the preview flag (loopback host) is refused", `http://127.0.0.1:${port2}/?debug=1#island`, noFlag);
  // the flag forged on a host that isn't loopback: every request answered from the local preview server
  const forged = (page) => page.route(/^http:\/\/mapb-forged\.example\//, async (r) => { const res = await r.fetch({ url: r.request().url().replace("http://mapb-forged.example", `http://127.0.0.1:${port}`) }); await r.fulfill({ response: res }); });
  await refusedLoad("the preview wrapper (flag set) on a host that isn't loopback is refused", "http://mapb-forged.example/?debug=1#island", forged);
  const unstaged = (page) => page.route(/\/js\/maps\/home\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: stagedWrapper().replace('"staged": true, ', "") }));
  await refusedLoad("a non-staged format-2 map with the flag (loopback) gets no preview and is refused", `http://127.0.0.1:${port2}/?debug=1#island`, unstaged);

  // 3. production on localhost and 127.0.0.1: format 1, no preview, no badge, its save
  for (const host of ["127.0.0.1", "localhost"]) {
    const url = `http://${host}:${port2}/?debug=1&step=1#island`;
    const { ctx, page, errs, loaded } = await open(url);
    const p = loaded ? await page.evaluate(() => { const v = window.__island.preview(); return { v, save: localStorage.getItem("island-save"), badge: !!document.querySelector(".w-mapb-badge"), flag: window.ISLAND_MAP_PREVIEW === undefined }; }) : null;
    check(name, `production on ${host}: format 1, 100 x 80, no preview, no badge, its save written`, loaded && !errs.length && p && p.v.format === 1 && p.v.w === 100 && p.v.h === 80 && !p.v.terrainOnly && !p.badge && p.flag && !p.v.saveLocked && !!p.save && JSON.parse(p.save).v === 2,
      p ? `format ${p.v.format}, ${p.v.w} x ${p.v.h}, terrainOnly ${p.v.terrainOnly}, badge ${p.badge}, save ${p.save ? "v" + JSON.parse(p.save).v + " written" : "none"}` : errs.join("; "));
    await ctx.close();
  }
  // 4. the preview on both loopback hosts: loads, reads and writes no storage; a production save on the same origin survives
  for (const host of ["127.0.0.1", "localhost"]) {
    const prod = JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], evolved: false, lastPos: [744, 972], settings: { shake: 0.5 }, ruler: null, credits: false, hatched: true, seal: false, hints: { move: true, use: true }, island: "home", quests: {}, dex: {}, flags: {}, cosmetics: {}, tools: {}, edgeSeen: false });
    const store = { "island-save": prod, "island-opts": '{"shake":0.25}', "unrelated": "kept" };
    const { ctx, page, errs, loaded } = await open(`http://${host}:${port}/?debug=1&islandhour=11#island`, { store });
    let after = null, p = null;
    if (loaded) {
      p = await page.evaluate(() => window.__island.preview());
      await page.waitForTimeout(600);
      await page.keyboard.down("ArrowRight"); await page.waitForTimeout(500); await page.keyboard.up("ArrowRight");
      await page.evaluate(() => window.__island.setSave({ v: 2, logs: ["tablet"] }));            // the test API's own write: still nothing stored
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      await page.reload(); await page.waitForTimeout(800);
      after = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    }
    const sorted = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    const same = after && sorted(after) === sorted(store);
    check(name, `the preview on ${host}: staged map, badge, and no storage read or written (a production save beside it untouched, through walking, setSave, Escape and a reload)`, loaded && !errs.length && p && p.terrainOnly && p.badge && p.saveLocked && same,
      `${p ? `terrainOnly ${p.terrainOnly}, badge ${p.badge}, saveLocked ${p.saveLocked}` : "didn't load"}; storage ${same ? "byte for byte as it was" : JSON.stringify(after)}${errs.length ? "; errors " + errs.join("; ") : ""}`);
    await ctx.close();
  }
  pv.close(); plain.close();
  await browser.close();
}
console.log(fails ? `${fails} failed` : `nothing failed${blocked.length ? "; blocked: " + blocked.join(", ") : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
