#!/usr/bin/env node
/* mapb-buildings (MAP-B B3c1): the first two buildings migrated into the content layer (the visitor centre and the
   supply depot, on the ranger HQ / depot footprint), and the explicit preview modes and systems (SYS) that replaced
   B3b's TERRAIN_ONLY. Real content only, served through the content preview (tools/mapb-preview.mjs --content); a few
   synthetic variants of it are built here in memory (never written anywhere).

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
      - review screenshots (not baselines) into tools/out/mapb/b3c1/: each building's exterior (day and night), doorway,
        interior, pi against its wall, and on a phone.

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
const OUT = join(ROOT, "tools/out/mapb/b3c1");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

// the approved B1e footprints and the B3a doorsteps (Ammaar's B3c1 brief; checked against the B1e source below)
const APPROVED = {
  visitor: { reserve: "visitor-centre", box: { x0: 80, y0: 69, x1: 88, y1: 73 }, door: [84, 74], room: "visitor", name: "the visitor centre" },
  depot: { reserve: "ranger-hq-depot", box: { x0: 101, y0: 73, x1: 107, y1: 76 }, door: [104, 77], room: "depot", name: "the supply depot" }
};
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
check("node", "the content holds exactly the two B3c1 buildings (nothing else migrated)", RECS.map((r) => r.id).join() === IDS.join() && RECS.every((r) => r.kind === "building"), RECS.map((r) => `${r.id} (${r.kind})`).join(", "));
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
  check("node", `${id}: the door tile is open terrain (no flag, not water, bridge, dock or pad) with no foot-blocking pixel anywhere in it, and the tile below it is walkable path (the approach)`,
    m.coll[di] === 0 && ![6, 8, 10].includes(m.ground[di]) && footInTile === 0 && m.coll[below] === 0 && m.ground[below] === 4, `door ground ${m.ground[di]}, below ground ${m.ground[below]} (4 is path), foot pixels in the door tile ${footInTile}`);
}
{ // the B1d stubs and spurs meet the doors: the visitor stub (x 85, rows 74 to 75) beside the door; the depot spur (x 104 and 105) from row 78
  const stub = src.corridors.paths.find((p) => p.id === "visitor-centre-door"), spur = src.corridors.paths.find((p) => p.id === "depot-spur");
  check("node", "the B1d visitor-centre door stub is the tile beside the visitor door (85,74 to 85,75); the depot spur runs south from the tile below the depot door (104,78, path)",
    stub && JSON.stringify(stub.line) === "[[85,74],[85,75]]" && spur && spur.line[0][0] === 105 && m.ground[78 * W + 104] === 4 && m.ground[78 * W + 105] === 4 && m.ground[77 * W + 104] !== 4,
    `stub ${JSON.stringify(stub && stub.line)}, spur ${JSON.stringify(spur && spur.line)}; 104,77 is ${m.ground[77 * W + 104] === 4 ? "path" : "grass"}`);
}
// malformed building records, each alone: [label, the rule that must catch it, the change to the authored content]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const RR = (o, id) => o.records.find((r) => r.id === id);
// a door on foot-blocking pixels: the one spot on the island where a 3 x 2 building on open ground would put its doorway on them
const FOOTDOOR = { id: "syn-wet-door", kind: "building", art: "placeholder", room: "bunker", drawnPxBoxes: [pxOf({ x0: 30, y0: 98, x1: 32, y1: 99 })], solid: { tileBoxes: [{ x0: 30, y0: 98, x1: 32, y1: 99 }] }, doorTiles: [[31, 100]] };
const BAD = [
  ["a building with no art", "buildings", (o) => { delete RR(o, "visitor").art; }],
  ["an art kind the game doesn't draw", "schema", (o) => { RR(o, "visitor").art = "sprite"; }],
  ["art on something that isn't a building", "schema", (o) => { const r = RR(o, "depot"); r.kind = "landmark"; delete r.room; }],
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
  ["a building's solid outside its own reserve", "reserve", (o) => { RR(o, "depot").solid.tileBoxes[0].x0 = 100; RR(o, "depot").drawnPxBoxes = [pxOf({ x0: 100, y0: 73, x1: 107, y1: 76 })]; }]
];
for (const [label, rule, fn] of BAD) {
  let caught;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.map((q) => q[0]); }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `malformed building: ${label} is caught by the ${rule} rule`, caught.includes(rule), caught.join(", ") || "NOT caught");
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
  ["art on something that isn't a building", (c) => { const r = DR(c, "depot"); r.kind = "landmark"; delete r.room; }, /^content record depot\.art "placeholder": only a building has art/],
  ["a room on something that isn't a building", (c) => { const r = DR(c, "depot"); r.kind = "station"; delete r.art; }, /^content record depot\.room "depot": only a building has a room$/],
  ["a room the game doesn't have", (c) => { DR(c, "visitor").room = "lobby"; }, /^content record visitor\.room "lobby" isn't one of the game's rooms/],
  ["two doors", (c) => { DR(c, "visitor").doorTiles.push([85, 74]); }, /^content record visitor opens into a room, so it has exactly one door, not 2$/],
  ["a side door", (c) => { DR(c, "visitor").doorTiles = [[89, 71]]; }, /^content record visitor: its door 89,71 must be right in front of its footprint/],
  ["a footprint that isn't a rectangle", (c) => { DR(c, "depot").tiles.pop(); c.solidTiles--; }, /^content record depot: a building's solid must be one full rectangle/],
  ["placeholder art wider than the footprint", (c) => { DR(c, "visitor").drawnPxBoxes[0].px1 += 16; }, /^content record visitor: its placeholder art \(drawnPxBoxes\[0\]\) must cover the footprint exactly in width/],
  ["placeholder art reaching below the front edge", (c) => { DR(c, "depot").drawnPxBoxes[0].py1 += 8; }, /^content record depot: its placeholder art .* stand on its front edge/],
  ["placeholder art in two boxes", (c) => { DR(c, "depot").drawnPxBoxes.push({ px0: 1616, py0: 1168, px1: 1631, py1: 1183 }); }, /^content record depot: placeholder art is one drawn box, not 2$/],
  ["a doorway on foot-blocking pixels", (c) => { c.records.push({ id: "syn-wet-door", kind: "building", drawnPxBoxes: FOOTDOOR.drawnPxBoxes, tiles: [[30, 98], [31, 98], [32, 98], [30, 99], [31, 99], [32, 99]], footPxBoxes: [], doorTiles: [[31, 100]], art: "placeholder", room: "bunker" }); c.solidTiles += 6; }, /^content record syn-wet-door: its doorway \(504,1606\) is on the terrain's foot-blocking pixels/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  artShort: ["the placeholder art one row short of the footprint", (s) => s.replace("h = b.py1 - b.py0 + 1, c = mkCanvas(); c.width = w; c.height = h;", "h = b.py1 - b.py0 + 1, c = mkCanvas(); c.width = w; c.height = h - 1;")],
  exitInside: ["walking out lands on the footprint's front row", (s) => s.replace("pi.x = doorX(bd); pi.y = (bd.y0 + bd.h) * T + 6;", "pi.x = doorX(bd); pi.y = (bd.y0 + bd.h) * T - 6;")],
  doorMiddle: ["the doorway taken from the footprint's middle, not the authored door", (s) => s.replace("function doorX(bd) { return bd.door ? bd.door[0] * T + 8 : (bd.x0 + bd.w / 2) * T; }", "function doorX(bd) { return (bd.x0 + bd.w / 2) * T; }")],
  buildingsOff: ["the content preview's buildings switched off", (s) => s.replace("buildings: all || CONTENT_PREVIEW,", "buildings: all,")],
  botsLeak: ["the bots switched on in the content preview (their stops, routes and pad aren't authored)", (s) => s.replace("bots: all,", "bots: all || CONTENT_PREVIEW,")],
  noShape: ["the decoder's building checks removed", (s) => s.replace("if (r.kind === \"building\") building(r, f, drawn);", "")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");

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
  const ROOMS1 = pr.loaded ? await pr.I(() => window.__island.rooms()) : {};
  for (const id of ["visitor", "depot"]) {
    const L = legacy.find((b) => b.id === id), e = pr.loaded ? await enter(pr, L.doorway) : null, o = e && e.room ? await leave(pr) : null;
    check(name, `production: the ${id} as before: [E] at its doorway enters its room, walking out lands on the legacy doorway ${L.doorway} facing out`,
      e && e.nb === "building" && e.room && e.room.id === id && JSON.stringify(e.room.items) === JSON.stringify(ROOMS1[id].items) && o && o.pi.x === L.doorway[0] && o.pi.y === L.doorway[1] && o.pi.dir === "down",
      e ? `prompt ${e.nb}, room ${e.room && e.room.id}, out at ${o && [o.pi.x, o.pi.y]} ${o && o.pi.dir}` : "didn't load");
  }
  await pr.ctx.close();

  // 2b. the terrain preview: as B2 left it
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => { const I2 = window.__island; I2.teleport(84 * 16 + 8, 74 * 16 + 14); I2.step(2); return { v: I2.preview(), walk: [I2.tile(84, 71).walkable, I2.tile(104, 75).walkable] }; }) : null;
  check(name, "terrain preview: terrain mode, a staged preview, every home system off, no buildings, nothing at the visitor centre's door, the footprints walkable terrain",
    tp.loaded && !tp.errs.length && tv.v.previewMode === "terrain" && tv.v.terrainOnly && tv.v.stagedPreview && SYS_KEYS.every((k) => tv.v.sys[k] === false) && tv.v.buildings.length === 0 && tv.v.nearby === null && tv.v.content === null && tv.walk.every(Boolean) && tv.v.badge && tv.v.saveLocked,
    tv ? `sys ${JSON.stringify(tv.v.sys)}, buildings ${tv.v.buildings.length}, nearby ${tv.v.nearby}` : tp.errs.join("; "));
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;

  // 2c. the content preview: the buildings
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  check(name, "content preview: content mode, a staged preview (not terrain-only), only the buildings system on, its badge, save locked",
    cp.loaded && !cp.errs.length && cv.previewMode === "content" && cv.stagedPreview && !cv.terrainOnly && cv.sys.buildings === true && SYS_KEYS.filter((k) => k !== "buildings").every((k) => cv.sys[k] === false) && cv.badge && cv.saveLocked,
    cv ? JSON.stringify(cv.sys) : cp.errs.join("; "));
  check(name, "content preview: no other system runs (no critters, bots, drones, birds, koi, stations, car, rex, gate, volcano or arena)",
    cv && Object.entries(cv.systems).every(([k, v]) => (k === "buildings" ? v === 2 : v === 0 || v === false)), cv ? JSON.stringify(cv.systems) : "");
  check(name, "content preview: its two buildings, each where its record puts it (footprint, door, room, placeholder art over the footprint)",
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
    check(name, "collision: the content layer is exactly the two footprints (73 tiles), the terrain's layer is the compiler's, gameplay is their union", lay && LAYER.tiles.reduce((a, v) => a + v, 0) === 73);
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
      const item = id === "visitor" ? { at: [168, 74], kind: "counter" } : { at: [144, 90], kind: "charger" };
      const it = await cp.I(async (q) => { const I2 = window.__island; I2.teleport(q.at[0], q.at[1]); I2.step(2); const nb = I2.preview().nearby; return nb; }, item);
      await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(2));
      const dl = await cp.page.evaluate(() => { const d = document.querySelector(".w-dialog"); return { open: !d.hidden, name: d.querySelector(".w-name").textContent }; });
      await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(2));
      check(name, `${id}: inside, the ${item.kind} answers [E] as in format 1 (a room item, its dialog under the room's name)`, it === "roomitem" && dl.open && dl.name === ROOMS1[A.room].name, `nearby ${it}, dialog ${JSON.stringify(dl)}`);
      const o = await leave(cp);
      const after = o ? await cp.I(([dt]) => { const I2 = window.__island, p = I2.getState().pi; let feet = false; for (let y = p.y - 2; y <= p.y + 1; y++) for (let x = p.x - 4; x <= p.x + 4; x++) if (I2.blocked(x, y)) feet = true;
        return { tile: [Math.floor(p.x / 16), Math.floor(p.y / 16)], feet, safe: I2.safe(dt[0], dt[1]), home: I2.walkTo(79, 79, false) }; }, [A.door]) : null;
      check(name, `${id}: walking out lands on the doorway ${dw}, facing out, on the door tile (safe, feet clear), with a way home`,
        o && o.pi.x === dw[0] && o.pi.y === dw[1] && o.pi.dir === "down" && after.tile.join() === A.door.join() && !after.feet && after.safe && after.home !== null, o ? `out at ${o.pi.x},${o.pi.y} ${o.pi.dir}, ${JSON.stringify(after)}` : "never came out");
      const away = await walk(cp, null, [A.door[0], A.door[1] + 2]);
      check(name, `${id}: and walks away from the door (2 tiles south) on the update loop`, away.plan !== null && away.at.join() === [A.door[0], A.door[1] + 2].join(), away.plan === null ? "no path" : `ended ${away.at}`);
    }
    // paths go round each building
    for (const [id, a, b] of [["visitor", [78, 71], [90, 71]], ["visitor", [84, 67], [84, 75]], ["depot", [99, 75], [109, 75]], ["depot", [104, 72], [104, 78]]]) {
      const r = await walk(cp, [a[0] * T + 8, a[1] * T + 10], b), straight = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      check(name, `${id}: a walk from ${a} to ${b} (across it) goes round the building, never on it`, r.plan !== null && r.at.join() === b.join() && !onSolid(r.seen).length && r.plan > straight, r.plan === null ? "no path" : `a ${r.plan}-tile plan (straight would be ${straight}), ended ${r.at}`);
    }
    // pushed against each side: pi stops at the wall
    const PUSH = [["visitor", "front", [82, 76], "ArrowUp"], ["visitor", "west", [77, 71], "ArrowRight"], ["visitor", "east", [91, 71], "ArrowLeft"], ["visitor", "back", [84, 67], "ArrowDown"],
      ["depot", "front", [102, 79], "ArrowUp"], ["depot", "west", [99, 75], "ArrowRight"], ["depot", "east", [109, 75], "ArrowLeft"], ["depot", "back", [104, 72], "ArrowDown"]];
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
    check(name, `no trapped ground: all ${trap.n} walkable tiles within 3 of either footprint have a path to the spawn from pi's feet there`, trap.n > 100 && trap.bad.length === 0, trap.bad.length ? `cut off: ${trap.bad.slice(0, 6).join(" ")}` : "");
    // storage: through entering and leaving both buildings (above), walking, setSave and a reload, nothing read or written
    await cp.I(() => window.__island.setSave({ v: 2, logs: ["tablet"] }));
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    const want = JSON.stringify(Object.keys(store).sort().map((k) => [k, store[k]]));
    check(name, "content preview: no storage read or written (a production save beside it untouched through both buildings, walking, setSave and a reload)", (await storeOf(cp)) === want);
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

  // 2e. phones: the prompt is the button; a tap on it goes in, a tap by the room's door walks out
  if (name !== "firefox") for (const id of IDS) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone 390 x 844: ${id}`, false, "didn't load"); await P.ctx.close(); continue; }
    const dw = doorway(id);
    await cardAway(P);
    const pr0 = await P.I(([x, y]) => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(x, y + 8); I2.step(2); return I2.preview().prompt; }, dw);
    if (pr0) await P.page.touchscreen.tap(pr0[0] + pr0[2] / 2, pr0[1] + pr0[3] / 2);
    let rm = null; for (let k = 0; k < 20 && !rm; k++) { await sleep(60); rm = await P.I(() => { window.__island.step(1); return window.__island.getState().room; }); }
    await sleep(250); await P.I(() => window.__island.step(1));
    const tgt = rm ? await P.I(() => { const I2 = window.__island, R = I2.room(), v = I2.preview(), E = v.ui.scale * v.zoom; I2.teleport(R.door * 16 + 8, (R.h - 3) * 16 + 10); I2.step(1); const v2 = I2.preview(); return { sx: (R.door * 16 + 8 - v2.camera[0]) * E, sy: ((R.h - 1) * 16 + 12 - v2.camera[1]) * E }; }) : null;
    if (tgt) await P.page.touchscreen.tap(tgt.sx, tgt.sy);
    let out = null; for (let k = 0; tgt && k < 80 && !out; k++) { out = await P.I(() => { const I2 = window.__island; I2.step(1); const s = I2.getState(); return s.room ? null : s.pi; }); if (!out) await sleep(25); }
    check(name, `phone 390 x 844: ${id}: the prompt is on screen as the button, a tap on it goes in, a tap by the room's door walks pi out onto the doorway`,
      !!pr0 && pr0[0] >= 0 && pr0[0] + pr0[2] <= 390 && rm === APPROVED[id].room && !!tgt && tgt.sx > 0 && tgt.sx < 390 && tgt.sy > 0 && tgt.sy < 844 && out && out.x === dw[0] && out.y === dw[1] && !P.errs.length,
      `prompt ${pr0 ? pr0.map((n) => n.toFixed(0)).join(",") : "none"}, room ${rm}, tap out at ${tgt ? tgt.sx.toFixed(0) + "," + tgt.sy.toFixed(0) : "-"}, out at ${out ? out.x + "," + out.y : "-"}${P.errs.length ? "; errors " + P.errs.join("; ") : ""}`);
    await P.ctx.close();
  }

  // 2f. performance: the buildings' draw cost and the frame work beside the terrain preview at the same spots; path planning; decoding;
  // the door transitions' worst frames on the live loop (doors.mjs's budget, 16 ms)
  if (cp.loaded && tp.loaded) {
    /* the frame work (update + render, as the game measures it: frames()) on the live loop, walking along both buildings'
       fronts in each preview, at the same places and pace. Stepped frames can't measure render cost: Chromium records the
       canvas's drawing and flushes it in one go every ~600 synchronous steps (half a second in its native restore and
       fillRect), in the terrain preview just the same; the live loop presents every frame. The target is the game's own,
       p95 under 16.7 ms (docs/game-design.md) */
    const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      const b0 = await P.I(() => { const v = window.__island.preview(); return [v.buildMs, v.buildDraws]; });
      await P.I(() => { window.__island.teleport(79 * 16 + 8, 75 * 16 + 10); window.__island.frames(true); });
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(3000); await P.page.keyboard.up("ArrowRight");
      await P.I(() => window.__island.teleport(99 * 16 + 8, 78 * 16 + 10));
      await P.page.keyboard.down("ArrowRight"); await P.page.waitForTimeout(2500); await P.page.keyboard.up("ArrowRight");
      const r = await P.I(() => ({ f: window.__island.frames(true), v: window.__island.preview() }));
      await P.ctx.close();
      const f = r.f.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], bms: r.v.buildMs - b0[0], bn: r.v.buildDraws - b0[1], errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    const per = lc && lc.bn ? lc.bms / lc.bn : 0;
    perf.push(`${name}: live frame work walking along both buildings: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}; drawing one content building ${(per * 1000).toFixed(1)} us a draw (${lc ? lc.bn : 0} draws)`);
    check(name, "performance: walking along both buildings on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const plan = async (P) => P.I(([d]) => { const I2 = window.__island, out = []; for (const dd of d) { I2.teleport(79 * 16 + 8, 79 * 16 + 10); let a = performance.now(); I2.walkTo(dd[0], dd[1], false); const cold = performance.now() - a; a = performance.now(); for (let i = 0; i < 20; i++) I2.walkTo(dd[0], dd[1], false); out.push([cold, (performance.now() - a) / 20]); } return out; }, [IDS.map((i) => APPROVED[i].door)]);
    const pc = await plan(cp), pt = await plan(tp);
    perf.push(`${name}: path planning from the spawn to each door (ms, first then warm average): content ${pc.map((v) => v.map((n) => n.toFixed(2)).join(" / ")).join("; ")}; terrain preview ${pt.map((v) => v.map((n) => n.toFixed(2)).join(" / ")).join("; ")}`);
    const dec = await cp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [cWith(() => {})]);
    const decT = await tp.I(([mm]) => { const I2 = window.__island; const a = performance.now(); for (let i = 0; i < 5; i++) I2.decodeMap(mm); return (performance.now() - a) / 5; }, [STAGED_MAP]);
    perf.push(`${name}: decoding the staged map: ${dec.toFixed(1)} ms with the content layer (two buildings), ${decT.toFixed(1)} ms without (terrain preview)`);
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
        const at = id === "visitor" ? [77, 71] : [109, 75], key = id === "visitor" ? "ArrowRight" : "ArrowLeft";
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at); await P.page.waitForTimeout(400);
        await P.page.keyboard.down(key); await P.page.waitForTimeout(900); await P.page.keyboard.up(key); await P.page.waitForTimeout(300);
        await shoot(P, `${name}-${id}-boundary.png`);
      }
      await P.ctx.close();
    }
    const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, wait: 2600 });
    if (P.loaded) await cardAway(P);
    if (P.loaded) for (const id of IDS) {
      await P.I(([x, y]) => window.__island.teleport(x, y + 8), doorway(id)); await P.page.waitForTimeout(900);
      await shoot(P, `${name}-${id}-phone-doorway.png`);
      const pr0 = await P.I(() => window.__island.preview().prompt);
      if (pr0) { await P.page.touchscreen.tap(pr0[0] + pr0[2] / 2, pr0[1] + pr0[3] / 2); await P.page.waitForTimeout(900); await shoot(P, `${name}-${id}-phone-interior.png`); }
      await P.page.keyboard.down("ArrowDown"); for (let i = 0; i < 40 && (await P.I(() => window.__island.getState().room)); i++) await P.page.waitForTimeout(100); await P.page.keyboard.up("ArrowDown");
    }
    await P.ctx.close();
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); offPv.close(); plain.close();
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
