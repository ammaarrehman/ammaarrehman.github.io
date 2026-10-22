#!/usr/bin/env node
/* mapb-content (MAP-B B3b): the content-collision architecture, on the staged 150 x 120 island. Every gameplay check
   here runs on SYNTHETIC content built here and served through the content preview in memory (never written to the
   content source or the staged files). The real content (tools/maps/home.content.mjs: B3c1's two buildings, B3c2's bunker, B3c3's compound wall, B3d1's raptor-yard fence, B3d2's holding-paddock fence, B3d3's koi garden wall and park gate, B3d4a's tower and lighthouse bases so far) is
   checked here only as a layer (current, bound to its terrain, the painter untouched, incomplete); tools/mapb-buildings.mjs
   tests the buildings and the compound wall themselves, tools/mapb-fences.mjs the fence. B3c3: a wall now draws itself (art),
   so the synthetic walled room has art. B3d1: so does a fence, and a fence is the ring round a contained B1e habitat, so the
   synthetic fenced pen is the ring round the holding paddock's outline (synthetic content of its own, built here; since B3d2
   the real content has that fence too, tested in tools/mapb-paddock.mjs).

   1. Node, the content compiler (tools/maps/content.mjs, tools/map-content.mjs):
      - the tracked content file is the current compile, bound to the current terrain; the terrain's staged file is
        untouched (map-compile's own compile, byte for byte); two compiles give the same bytes;
      - the synthetic content passes every rule; each rule, broken one at a time, is caught by that rule.
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - the terrain preview is exactly as before: no content, the terrain's collision, both locked painter digests;
      - the content preview with the real content: loads, its badge, no storage read or written, the digests,
        and the completeness report (a normal format-2 home would still be refused);
      - the content preview with synthetic content: the decoded layer is the compiler's, tile for tile and pixel for
        pixel; gameplay collision is exactly the terrain's plus the content's, the terrain's untouched; a walled room
        is entered only through its door; a fenced pen is cut off (not safe ground, no landing, no path in); a post's
        foot box stops pi's feet on a tile that stays walkable; paths go round a hut and never step on it; and the
        painter is untouched: both locked digests, and its reports, exactly as on the terrain preview;
      - the decoder refuses broken content, one fault at a time, each named; the terrain preview refuses content, the
        content preview refuses a map without it; the content wrapper off loopback, or without its flag, doesn't
        load; production still loads format 1 with no preview; a non-staged format-2 map is still refused;
      - code mutations (js/world.js served altered, in memory): the painter fed the gameplay collision, the union
        dropped, the foot union dropped, the terrain preview accepting content, the D1 check removed, and a normal
        format-2 home let past the decoder: each is caught.

     node tools/mapb-content.mjs
     ENGINES=chromium node tools/mapb-content.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";
import { startPreview, contentWrapper } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, compileContent, contentLayers, serializeContent, ContentError } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

// since B3e1 the content ends with roam areas (creatures; tools/mapb-creatures.mjs pins them exactly): how many, and the creatures they hold
const ROAM_N = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); const r = c.window.ISLAND_MAPS_STAGED_CONTENT.home.records; return { records: r.length, roams: r.filter((q) => q.kind === "roam").length, creatures: r.filter((q) => q.kind === "roam").reduce((n, q) => n + q.spawns.length, 0) }; })();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

/* ════════ 1. Node: the compiler and its rules ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h;
const px = (x, y, a, b, c, d) => ({ px0: x * T + a, py0: y * T + b, px1: x * T + c, py1: y * T + d });
const tileArt = (x0, y0, x1, y1, up = 0) => ({ px0: x0 * T, py0: (y0 - up) * T, px1: x1 * T + T - 1, py1: y1 * T + T - 1 });
// the synthetic content: open grass in the galli meadow (the walled room) and round the cottage-row reserve (the rest)
const SYN = {
  schema: "mapb-content-1", id: "home", records: [
    { id: "syn-room", kind: "wall", art: "placeholder", solid: { ringOfBox: { x0: 86, y0: 40, x1: 92, y1: 45, gapTiles: [[89, 45]] } }, doorTiles: [[89, 45]] },
    { id: "holding-paddock", kind: "fence", art: "placeholder", solid: { ringOfHabitat: { habitat: "holding-paddock" } }, encloses: true },
    { id: "syn-post", kind: "prop", drawnPxBoxes: [px(40, 92, 3, -10, 12, 12)], solid: { footPxBoxes: [px(40, 92, 5, 6, 10, 11)] } },
    { id: "syn-hut", kind: "building", art: "placeholder", drawnPxBoxes: [tileArt(44, 92, 47, 93, 2)], solid: { tileBoxes: [{ x0: 44, y0: 92, x1: 47, y1: 93 }] }, doorTiles: [[45, 94]] }
  ]
};
const SYN_C = compileContent(SYN, src, m);
const SYN_LAYER = contentLayers(SYN_C.records, W, H);
const SYN_DATA = (() => { const c = { window: {} }; vm.runInNewContext(serializeContent(SYN_C, { id: "home", sourceSha256: "0".repeat(64), terrainSha256: t.sourceSha256 }), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
{
  const { content, contentSha256 } = await loadContent();
  const a = await buildContentText(content, contentSha256), b = await buildContentText(content, contentSha256);
  const tracked = readFileSync(CONTENT_STAGED, "utf8");
  check("node", "the tracked content file is the current compile of tools/maps/home.content.mjs (B3c1: the visitor centre and the depot; B3c2: the bunker; B3c3: the bunker compound's wall; B3d1: the raptor yard's fence; B3d2: the holding paddock's fence; B3d3: the koi garden's wall and the park gate; B3d4a: the tower's and the lighthouse's bases; B3d4b: the eleven stations; B3e1: two roam areas; nothing else)", tracked === a.text && a.compiled.records.slice(0, 21).map((r) => r.id).join() === "visitor,depot,bunker,bunker-compound,raptor-yard,holding-paddock,koi-garden,park-gate,tower-base,lighthouse-base,sign,uplink,tower,lighthouse,macbook,tablet,mailbox,drink,shrine,cave,boat" && a.compiled.records.slice(21).every((r) => r.kind === "roam"), `${Buffer.byteLength(a.text)} bytes, ${a.compiled.records.length} records: ${a.compiled.records.map((r) => r.id).join(", ")}`);
  check("node", "two compiles give the same bytes", a.text === b.text);
  check("node", "the content is bound to the terrain it was placed on (terrainSha256 is the staged terrain's sourceSha256)", a.text.includes(`"terrainSha256": "${t.sourceSha256}"`), t.sourceSha256.slice(0, 16));
  check("node", "the staged terrain file is untouched: map-compile's own compile, byte for byte", t.current && readFileSync(STAGED_PATH, "utf8") === t.terrainText);
  check("node", "the synthetic content passes every rule", contentProblems(SYN_C.records, src, m).length === 0, `${SYN_C.records.length} records, ${SYN_C.solidTiles} solid tiles, ${SYN_C.footPixels} foot pixels`);
}
// each rule broken alone: [label, the rule that must catch it, the change]
const synWith = (fn) => { const o = copy(SYN); fn(o); return o; };
const rec = (o, id) => o.records.find((r) => r.id === id);
const RULE_CASES = [
  ["an unknown kind", "schema", (o) => { rec(o, "syn-hut").kind = "tower"; }],
  ["an unknown field", "schema", (o) => { rec(o, "syn-hut").height = 3; }],
  ["two records with one id", "schema", (o) => { o.records.push(copy(rec(o, "syn-post"))); }],
  ["a tile outside the map", "schema", (o) => { rec(o, "syn-hut").solid.tileBoxes[0].x1 = 150; }],
  ["a gap that isn't on the ring", "schema", (o) => { rec(o, "syn-room").solid.ringOfBox.gapTiles = [[89, 43]]; }],
  ["a reserve that isn't a B1e footprint", "schema", (o) => { rec(o, "syn-hut").reserve = "cottage-9"; }],
  ["solid on the koi pond's water", "terrain", (o) => { o.records.push({ id: "syn-wet", kind: "prop", drawnPxBoxes: [tileArt(108, 61, 108, 61)], solid: { tiles: [[108, 61]] } }); }],
  ["solid on a cliff rim", "terrain", (o) => { const r = RIM; o.records.push({ id: "syn-rim", kind: "prop", drawnPxBoxes: [tileArt(r[0], r[1], r[0], r[1])], solid: { tiles: [r] } }); }],
  ["solid on a bridge", "terrain", (o) => { const b = BRIDGE; o.records.push({ id: "syn-bridge", kind: "prop", drawnPxBoxes: [tileArt(b[0], b[1], b[0], b[1])], solid: { tiles: [b] } }); }],
  ["solid on the helipad", "terrain", (o) => { o.records.push({ id: "syn-pad", kind: "prop", drawnPxBoxes: [tileArt(101, 93, 101, 93)], solid: { tiles: [[101, 93]] } }); }],
  // (a prop since B3d4b: a station is an interaction point that can't be solid at all, which the schema refuses first)
  ["solid on the spawn tile", "spawn", (o) => { o.records.push({ id: "syn-spawn", kind: "prop", drawnPxBoxes: [tileArt(79, 79, 79, 79)], solid: { tiles: [[79, 79]] } }); }],
  ["a foot box under pi's feet at the spawn", "spawn", (o) => { o.records.push({ id: "syn-spawn-foot", kind: "prop", drawnPxBoxes: [px(79, 79, 0, 0, 15, 15)], solid: { footPxBoxes: [px(79, 79, 6, 9, 9, 11)] } }); }],
  ["a solid tile outside what's drawn (D1)", "drawn", (o) => { rec(o, "syn-hut").drawnPxBoxes = [tileArt(44, 92, 46, 93, 2)]; }],
  ["a foot box outside what's drawn (D1)", "drawn", (o) => { rec(o, "syn-post").solid.footPxBoxes = [px(40, 92, 5, 6, 14, 14)]; }],
  ["solid with nothing drawn", "drawn", (o) => { rec(o, "syn-hut").drawnPxBoxes = []; }],
  ["one tile solid in two records", "overlap", (o) => { o.records.push({ id: "syn-dup", kind: "prop", drawnPxBoxes: [tileArt(45, 92, 45, 92)], solid: { tiles: [[45, 92]] } }); }],
  ["a foot box on a solid tile", "foot", (o) => { rec(o, "syn-hut").solid.footPxBoxes = [px(44, 92, 2, 2, 6, 6)]; }],
  ["a record outside the reserve it names", "reserve", (o) => { rec(o, "syn-hut").reserve = "post-office"; }],
  ["solid inside a reserve it doesn't name", "reserve", (o) => { o.records.push({ id: "syn-intruder", kind: "prop", drawnPxBoxes: [tileArt(84, 70, 84, 70)], solid: { tiles: [[84, 70]] } }); }],
  ["solid in the rift arena's clear field", "open-space", (o) => { o.records.push({ id: "syn-rift", kind: "prop", drawnPxBoxes: [tileArt(70, 58, 70, 58)], solid: { tiles: [[70, 58]] } }); }],
  ["a door that is closed", "doors", (o) => { rec(o, "syn-room").solid.ringOfBox.gapTiles = []; rec(o, "syn-room").encloses = true; }],
  ["a door not next to its solid", "doors", (o) => { rec(o, "syn-hut").doorTiles = [[45, 96]]; }],
  ["a route end walled in", "route-ends", (o) => { o.records.push({ id: "syn-cut", kind: "prop", drawnPxBoxes: [tileArt(104, 86, 104, 86)], solid: { tiles: [[104, 86]] } }); }],
  ["ground cut off by a record that doesn't say it encloses", "pockets", (o) => { delete rec(o, "holding-paddock").encloses; }]
];
// a cliff-rim tile and a bridge tile, from the terrain itself
const RIM = (() => { for (let y = 30; y < 100; y++) for (let x = 30; x < 120; x++) if (m.why[y * W + x] === 1) return [x, y]; })();
const BRIDGE = (() => { for (let i = 0; i < W * H; i++) if (m.ground[i] === 10) return [i % W, (i - i % W) / W]; })();
for (const [label, rule, fn] of RULE_CASES) {
  let caught = null;
  try { const r = resolveContent(synWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => q[0]) : []; }
  catch (e) { caught = e instanceof ContentError ? [e.rule] : ["error: " + e.message]; }
  check("node", `rule ${rule}: ${label} is caught`, caught.includes(rule), caught.join(", ") || "NOT caught");
}

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const idxOf = (bits) => { const o = []; for (let i = 0; i < bits.length; i++) if (bits[i]) o.push(i); return o; };
const WANT_TILES = idxOf(SYN_LAYER.tiles), WANT_FOOT = idxOf(SYN_LAYER.foot);
// what decodeMap must refuse, one fault at a time, on the content preview: [label, change to the content, message]
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(SYN_DATA) }); fn(o.content, o); return o; };
const R = (o, id) => o.records.find((r) => r.id === id);
const REFUSE = [
  ["content placed on other terrain", (c) => { c.terrainSha256 = "f".repeat(64); }, /terrainSha256 isn't this terrain's sourceSha256/],
  ["the wrong schema", (c) => { c.schema = "mapb-content-0"; }, /^content\.schema must be mapb-content-1$/],
  ["an unknown field in the content", (c) => { c.buildings = []; }, /^content has an unknown field buildings$/],
  ["an unknown field in a record", (c) => { R(c, "syn-hut").height = 3; }, /^content record syn-hut has an unknown field height$/],
  ["an unknown kind", (c) => { R(c, "syn-hut").kind = "tower"; }, /^content record syn-hut\.kind "tower" isn't one of/],
  ["two records with one id", (c) => { c.records.push(copy(R(c, "syn-post"))); }, /^content record syn-post appears twice$/],
  ["solid on water", (c) => { R(c, "syn-hut").tiles.push([108, 61]); R(c, "syn-hut").drawnPxBoxes.push(tileArt(108, 61, 108, 61)); c.solidTiles++; }, /tile 108,61 isn't walkable terrain/],
  ["solid on a bridge", (c) => { R(c, "syn-hut").tiles.push(BRIDGE); R(c, "syn-hut").drawnPxBoxes.push(tileArt(BRIDGE[0], BRIDGE[1], BRIDGE[0], BRIDGE[1])); c.solidTiles++; }, /is a bridge, a dock or the helipad/],
  ["solid on the helipad", (c) => { R(c, "syn-hut").tiles.push([101, 93]); R(c, "syn-hut").drawnPxBoxes.push(tileArt(101, 93, 101, 93)); c.solidTiles++; }, /tile 101,93 is a bridge, a dock or the helipad/],
  ["solid on the spawn", (c) => { R(c, "syn-post").tiles.push([79, 79]); R(c, "syn-post").drawnPxBoxes.push(tileArt(79, 79, 79, 79)); c.solidTiles++; }, /the spawn tile 79,79 is solid content/],
  ["a foot box under pi's feet at the spawn", (c) => { const r = R(c, "syn-post"); r.footPxBoxes.push(px(79, 79, 6, 9, 9, 11)); r.drawnPxBoxes.push(px(79, 79, 0, 0, 15, 15)); c.footPixels += 12; }, /a foot box covers pi's feet at the spawn/],
  ["a solid tile outside what's drawn (D1)", (c) => { R(c, "syn-hut").drawnPxBoxes = [tileArt(44, 92, 46, 93, 2)]; }, /tile 47,92 is solid outside what it draws/],
  ["a foot box outside what's drawn (D1)", (c) => { R(c, "syn-post").drawnPxBoxes = [px(40, 92, 3, -10, 8, 12)]; }, /is outside what it draws: no invisible collision/],
  ["nothing drawn", (c) => { R(c, "syn-hut").drawnPxBoxes = []; }, /^content record syn-hut draws nothing/],
  ["a foot box on a solid tile", (c) => { const r = R(c, "syn-hut"); r.footPxBoxes.push(px(44, 92, 2, 2, 6, 6)); }, /is on tile 44,92, which is already blocked/],
  ["one tile in two records", (c) => { R(c, "syn-post").tiles.push([45, 92]); R(c, "syn-post").drawnPxBoxes.push(tileArt(45, 92, 45, 92)); }, /tile 45,92 is already solid in syn-(hut|post)/],
  ["a closed door", (c) => { R(c, "syn-room").doorTiles = [[89, 44]]; }, /door 89,44 isn't next to its solid|door 89,44 isn't walkable/],
  ["a door that isn't walkable", (c) => { R(c, "syn-hut").doorTiles = [[46, 93]]; }, /door 46,93 isn't walkable/],
  ["solidTiles that don't add up", (c) => { c.solidTiles++; }, /^content\.solidTiles is \d+ but the records make \d+ solid tiles$/],
  ["footPixels that don't add up", (c) => { c.footPixels--; }, /^content\.footPixels is \d+ but the records make \d+ foot pixels$/],
  ["a pixel box off the map", (c) => { R(c, "syn-post").drawnPxBoxes[0].px1 = 99999; }, /drawnPxBoxes\[0\]\.px1 must be a whole number/],
  ["a record that blocks nothing", (c) => { const r = R(c, "syn-post"); r.footPxBoxes = []; c.footPixels = 0; }, /^content record syn-post blocks nothing/]
];
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  painterReadsGameplay: ["the painter fed the gameplay collision (content in it)", (s) => s.replace("COLL[cq] = TCOLL[cq] | MAP.contentColl[cq]; }", "COLL[cq] = TCOLL[cq] | MAP.contentColl[cq]; TCOLL = COLL; }")],
  noUnion: ["the union dropped (gameplay on the terrain alone)", (s) => s.replace("if (MAP.contentColl) { COLL = new Uint16Array", "if (false) { COLL = new Uint16Array")],
  noFootUnion: ["the foot-box union dropped", (s) => s.replace("if (MAP.contentFoot) { FOOT = new Uint32Array", "if (false) { FOOT = new Uint32Array")],
  terrainTakesContent: ["the terrain preview accepting content", (s) => s.replace('} else if (M.content !== undefined) bad("content runs only in the MAP-B content preview', '} else if (false) bad("content runs only in the MAP-B content preview')],
  noD1: ["the decoder's D1 check removed", (s) => s.replace('if (!inDrawn(px, py)) bad(f + ": tile " + p + " is solid outside what it draws', 'if (false) bad(f + ": tile " + p + " is solid outside what it draws')],
  normal2: ["a normal format-2 home let past the decoder (B4 come early)", (s) => s.replace("if (M && typeof M === \"object\" && !Array.isArray(M) && M.format === 2 && M.staged === true) return decodeMap2(M);", "if (M && M.format === 2) return decodeMap2(M);").replace("if (!(previewAsked() && LOOPBACK)) bad(", "if (false) bad(")],
  normal2NoWall: ["the same, with the completeness wall removed too", (s) => MUT.normal2[1](s).replace("if (need.length) { var e3", "if (false) { var e3")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) { check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found"); }

const port = 9400 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), realPv = await startPreview(port + 1, { content: true }), synPv = await startPreview(port + 2, { content: SYN_DATA }), plain = await serve(port + 3);

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const open = async (url, { world, route, store } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [], cons = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (msg) => { if (msg.type() === "error") cons.push(msg.text()); });
    if (store) await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, store);
    if (world) await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: world }));
    if (route) await route(page);
    await page.goto(url);
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => true, () => false);
    return { ctx, page, errs, cons, loaded, I: (fn, a) => page.evaluate(fn, a) };
  };
  const Q = "?debug=1&step=1&islandhour=11#island";
  const look = async (P) => { const o = await P.I(async () => { const I2 = window.__island; return { v: I2.preview(), td: await I2.terrainDigest(), pr: JSON.stringify(I2.painterReport()), fr: JSON.stringify(I2.featureReport()), comp: I2.completeness() }; }); o.gd = await P.page.evaluate(DIGEST); return o; };

  // 2a. the terrain preview, as before
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tl = tp.loaded ? await look(tp) : null;
  check(name, "terrain preview: as before (terrain mode, no content layer, its badge, no save)", tp.loaded && !tp.errs.length && tl.v.previewMode === "terrain" && tl.v.terrainOnly && tl.v.stagedPreview && tl.v.content === null && tl.v.badge && tl.v.saveLocked,
    (tl ? `mode ${tl.v.previewMode}, content ${JSON.stringify(tl.v.content)}` : "") + (tp.errs.length ? `; errors: ${tp.errs.join("; ")}` : ""));
  check(name, "terrain preview: both locked painter digests", tl && tl.td === TERRAIN_SHA && tl.gd === GROUND_SHA, tl ? `terrain ${tl.td.slice(0, 12)}, ground ${tl.gd.slice(0, 12)}` : "");
  const tLayers = tp.loaded ? await tp.I(() => { const L = window.__island.layers(); return { coll: L.collision, keys: Object.keys(L).join() }; }) : null;
  check(name, "terrain preview: the collision is the compiler's terrain collision, and layers() has no content keys", tLayers && sameSet(tLayers.coll, Array.from(m.coll)) && tLayers.keys === "w,h,ground,height,collision,flags", tLayers ? tLayers.keys : "");
  const refusedHere = async (P, o) => P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
  { const r = tp.loaded ? await refusedHere(tp, cWith(() => {})) : null;
    check(name, "terrain preview: a map with content is refused (content runs only in the content preview)", /^content runs only in the MAP-B content preview/.test(r || ""), r || "NOT refused"); }
  const postT = tp.loaded ? await tp.I(([x, y]) => [window.__island.blocked(x, y), window.__island.safe(112, 14)], [40 * T + 7, 92 * T + 8]) : null;

  // 2b. the content preview with the real content (B3c1 and B3c2: the three buildings)
  const store = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
  const rp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store });
  const rl = rp.loaded ? await look(rp) : null;
  check(name, "content preview (real content): loads in content mode (a staged preview, not terrain-only), its own badge, save locked", rp.loaded && !rp.errs.length && rl.v.previewMode === "content" && rl.v.stagedPreview && !rl.v.terrainOnly && rl.v.badge && rl.v.saveLocked && rl.v.content && rl.v.content.records === ROAM_N.records,
    rl ? `mode ${rl.v.previewMode}, content ${JSON.stringify(rl.v.content)}` : rp.errs.join("; "));
  const badge = rp.loaded ? await rp.page.evaluate(() => { const b = document.querySelector(".w-mapb-badge"); return { text: b.textContent, label: b.getAttribute("aria-label") }; }) : null;
  check(name, "content preview: the badge says so", badge && badge.text === "MAP-B\ncontent\npreview" && badge.label === "MAP-B content preview", JSON.stringify(badge));
  check(name, "content preview (real content): both locked painter digests, and the painter's reports as on the terrain preview", rl && rl.td === TERRAIN_SHA && rl.gd === GROUND_SHA && tl && rl.pr === tl.pr && rl.fr === tl.fr);
  // B3c2: with the bunker the three buildings are all there, so buildings has left the list; everything else is still missing
  // (B3d2: with both paddock fences there the list is 11 items, not 12; B3d3: with the koi garden's wall and the park gate, 9;
  // B3d4a: with both landmark bases, 8; B3d4b: with the eleven stations, 7; the count is pinned so an item leaving it is noticed)
  check(name, "content preview (real content): incomplete, so a normal format-2 home made of it would be refused (the missing list, 7 items: no longer the buildings, the paddock fences, the compound walls, the park gate, the landmark bases or the stations, still the sections not in the format yet)", rl && rl.comp && !rl.comp.complete && rl.comp.missing.length === 7 && !rl.comp.missing.some((s) => /^(buildings|paddock fences|compound walls|the park gate|landmark bases|stations)/.test(s)) && rl.comp.missing.some((s) => /^spawns and roam areas/.test(s)),
    rl ? `${rl.comp.missing.length} missing, first: ${rl.comp.missing.slice(0, 2).join(" | ")}` : "");
  // B3c3: the bunker compound's wall is there (with its art); B3d3: so is the koi garden's, and the park gate (with its art)
  const wl = rl && rl.comp ? rl.comp.missing.filter((s) => /^(compound walls|the park gate)/.test(s)) : [];
  check(name, "content preview (real content): the completeness list no longer names compound walls or the park gate (B3c3's bunker compound wall, B3d3's koi garden wall and park gate are all there)", wl.length === 0, JSON.stringify(wl));
  // B3d1: the raptor yard's fence is there (enclosing, with its art); B3d2: so is the holding paddock's, so no paddock fence is missing
  const fl = rl && rl.comp ? rl.comp.missing.filter((s) => /^paddock fences/.test(s)) : [];
  check(name, "content preview (real content): the completeness list no longer names paddock fences (B3d1's raptor yard and B3d2's holding paddock are both there)", fl.length === 0, JSON.stringify(fl));
  if (rp.loaded) {
    await rp.page.keyboard.down("ArrowRight"); await rp.I(() => window.__island.step(20)); await rp.page.keyboard.up("ArrowRight");
    await rp.I(() => window.__island.setSave({ v: 2, logs: ["tablet"] }));
    await rp.page.reload(); await rp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    const after = await rp.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const sorted = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    check(name, "content preview: no storage read or written (a production save beside it untouched through walking, setSave and a reload)", sorted(after) === sorted(store), sorted(after) === sorted(store) ? "" : JSON.stringify(after));
    const r = await refusedHere(rp, Object.assign(copy(STAGED_MAP)));
    check(name, "content preview: a map without the content layer is refused", /^the content preview needs the content layer/.test(r || ""), r || "NOT refused");
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(rp, cWith(fn)); check(name, `content preview refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    const un = await refusedHere(rp, cWith((c, o) => { delete o.staged; }));
    check(name, "a non-staged format-2 map, content and all, is still refused (no normal format 2 before B4)", /^the map has an unknown field runtimeSupported$|^format 2 isn't supported/.test(un || ""), un || "NOT refused");
  }
  await tp.ctx.close(); await rp.ctx.close();

  // 2c. the content preview with the synthetic content
  const sp = await open(`http://127.0.0.1:${port + 2}/${Q}`);
  const sl = sp.loaded ? await look(sp) : null;
  check(name, "synthetic content: loads, its layer counted as the compiler counts it", sp.loaded && !sp.errs.length && sl.v.content && sl.v.content.records === 4 && sl.v.content.solidTiles === SYN_C.solidTiles && sl.v.content.footPixels === SYN_C.footPixels,
    sl ? JSON.stringify(sl.v.content) : sp.errs.join("; "));
  if (sp.loaded) {
    const det = await sp.I((mm) => { const d = window.__island.decodeDetail(mm); return { tiles: d.contentTiles, foot: d.contentFoot, coll: d.coll }; }, cWith(() => {}));
    check(name, "synthetic content: the decoded content layer is the compiler's, tile for tile and pixel for pixel; the terrain layer is untouched", sameSet(det.tiles, WANT_TILES) && sameSet(det.foot, WANT_FOOT) && sameSet(det.coll, Array.from(m.coll)), `${det.tiles.length} tiles, ${det.foot.length} foot pixels`);
    const L = await sp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let unionOk = true; for (let i = 0; i < W * H; i++) if (L.c[i] !== (m.coll[i] | (SYN_LAYER.tiles[i] ? 1 : 0)) || L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!SYN_LAYER.tiles[i]) { unionOk = false; break; }
    check(name, "gameplay collision is exactly the terrain's plus the content's; the terrain's own layer is the compiler's", unionOk);
    const tiles = await sp.I(() => ["45,92", "112,10", "40,92"].map((s) => { const [x, y] = s.split(",").map(Number); return window.__island.tile(x, y); }));
    check(name, "a content tile: not walkable for play, terrain flags clear, marked content; a foot-box tile stays walkable", !tiles[0].walkable && tiles[0].terrainFlags === 0 && tiles[0].content && !tiles[1].walkable && tiles[1].content && tiles[2].walkable && !tiles[2].content, JSON.stringify(tiles));
    check(name, "synthetic content can't touch the painter: both locked digests, and its reports, exactly as on the terrain preview", sl.td === TERRAIN_SHA && sl.gd === GROUND_SHA && tl && sl.pr === tl.pr && sl.fr === tl.fr, `terrain ${sl.td.slice(0, 12)}, ground ${sl.gd.slice(0, 12)}`);

    const walk = (from, to, loose = false, max = 3000) => sp.I(([f, tt, lo, mx]) => {
      const I2 = window.__island; I2.teleport(f[0] * 16 + 8, f[1] * 16 + 10); I2.step(1);
      const plan = I2.walkTo(tt[0], tt[1], lo); if (plan === null) return { plan: null };
      const seen = []; let n = 0;
      for (; n < mx; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
      const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen };
    }, [from, to, loose, max]);
    const onSolid = (seen) => seen.filter(([x, y]) => SYN_LAYER.tiles[y * W + x]);
    // the walled room: in through its door only
    const into = await walk([89, 48], [89, 42]);
    check(name, "the walled room: walked into from the south, through its door (89,45), never over the wall", into.plan !== null && into.at.join() === "89,42" && into.seen.some((q) => q.join() === "89,45") && !onSolid(into.seen).length, into.plan === null ? "no path" : `ended ${into.at}, ${into.seen.length} tiles`);
    const round = await walk([89, 38], [89, 42]);
    check(name, "the walled room from the north: the planner goes round to the door (no way over the wall)", round.plan !== null && round.at.join() === "89,42" && round.seen.some((q) => q.join() === "89,45") && !onSolid(round.seen).length && round.plan > 10, round.plan === null ? "no path" : `${round.plan}-tile plan (straight would be 4), ended ${round.at}`);
    // the fenced pen (the synthetic fence round the holding paddock's outline): cut off
    const pen = await sp.I(() => { const I2 = window.__island; return { safe: I2.safe(112, 14), edge: I2.safe(112, 20), land: I2.canLand(112 * 16 + 8, 14 * 16 + 8), outLand: I2.canLand(113 * 16 + 8, 21 * 16 + 8) }; });
    check(name, "the fenced pen: its inside is not safe ground and the helicopter can't land there (outside still can); on the terrain preview the same tile was safe", !pen.safe && pen.edge && !pen.land && pen.outLand && postT && postT[1] === true, JSON.stringify(pen));
    const penWalk = await walk([112, 20], [112, 14]);
    check(name, "the fenced pen: no walk gets inside", penWalk.plan === null || (penWalk.at.join() !== "112,14" && !penWalk.seen.some(([x, y]) => SYN_C.records.find((r) => r.id === "holding-paddock").inner.some((q) => q[0] === x && q[1] === y))), penWalk.plan === null ? "no path planned" : `ended ${penWalk.at}`);
    // the post's foot box: feet stop on a walkable tile
    const pb = await sp.I(([x, y]) => [window.__island.blocked(x, y), window.__island.terrainBlocked(x, y), window.__island.blocked(x - 3, y)], [40 * T + 7, 92 * T + 8]);
    check(name, "the post's foot box: its pixels block feet (blocked), the terrain's answer there is open, a pixel beside it stays open; on the terrain preview the same pixel was open", pb[0] && !pb[1] && !pb[2] && postT && postT[0] === false, JSON.stringify(pb));
    const push = await sp.I(([sx, sy]) => { const I2 = window.__island; I2.teleport(sx, sy); I2.step(1); window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", code: "ArrowRight", bubbles: true })); for (let f = 0; f < 120; f += 2) I2.step(2); window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", code: "ArrowRight", bubbles: true })); const p = I2.getState().pi; return [p.x, p.y]; }, [38 * T + 8, 92 * T + 10]);
    check(name, "pushed east at the post: pi's feet stop against it, inside the walkable tile", push[0] + 4 < 40 * T + 5 && push[0] > 38 * T + 8 && Math.floor(push[0] / 16) <= 40, `stopped at x ${push[0].toFixed(2)} (the foot box starts at ${40 * T + 5}; feet reach x + 4)`);
    // the hut: paths go round it
    const hut = await walk([42, 93], [49, 93]);
    check(name, "the hut: a walk from its west side to its east side goes round it, never on it", hut.plan !== null && hut.at.join() === "49,93" && !onSolid(hut.seen).length && hut.plan > 7, hut.plan === null ? "no path" : `${hut.plan}-tile plan (straight would be 7)`);
    const onHut = await walk([42, 96], [45, 92]), door = await walk([42, 96], [45, 94]);
    check(name, "the hut: a walk to one of its tiles stops beside it, never on it; its door is reached", (onHut.plan === null || (!onSolid(onHut.seen).length && !SYN_LAYER.tiles[onHut.at[1] * W + onHut.at[0]])) && door.plan !== null && door.at.join() === "45,94",
      `walk to 45,92 ${onHut.plan === null ? "not planned" : "ended " + onHut.at}; door walk ended ${door.at}`);
  }
  await sp.ctx.close();

  // 2d. the walls round the content preview
  const refusedLoad = async (label, url, opts, re) => {
    const P = await open(url, opts); const said = P.cons.concat(P.errs).join(" | ");
    check(name, label, !P.loaded && re.test(said), `loaded ${P.loaded}; said "${said.slice(0, 170)}"`); await P.ctx.close();
  };
  const STAGE_RE = /pi's island: js\/maps\/home\.js: (this is a staged map: it runs only in the local MAP-B preview|the map has an unknown field runtimeSupported|format 2 isn't supported)/;
  const noFlag = (page) => page.route(/\/js\/maps\/home\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: contentWrapper(SYN_DATA).replace(/window\.ISLAND_MAP_PREVIEW = "mapb-content";/, "") }));
  await refusedLoad("the content wrapper without its flag (loopback host) doesn't load", `http://127.0.0.1:${port + 3}/${Q}`, { route: noFlag }, STAGE_RE);
  const forged = (page) => page.route(/^http:\/\/mapb-forged\.example\//, async (r) => { const res = await r.fetch({ url: r.request().url().replace("http://mapb-forged.example", `http://127.0.0.1:${port + 2}`) }); await r.fulfill({ response: res }); });
  await refusedLoad("the content preview (flag set) on a host that isn't loopback doesn't load", `http://mapb-forged.example/${Q}`, { route: forged }, STAGE_RE);
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`); const v = P.loaded ? await P.I(() => window.__island.preview()) : null;
    check(name, "production on loopback: format 1, 100 x 80, no preview mode, no content, its save", P.loaded && !P.errs.length && v.format === 1 && v.w === 100 && v.previewMode === null && v.content === null && !v.saveLocked && !v.badge, v ? `format ${v.format}, mode ${v.previewMode}` : P.errs.join("; ")); await P.ctx.close(); }

  // 2e. code mutations: each must be caught
  const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`, { world: MUT.painterReadsGameplay[1](WORLD) }); const l = P.loaded ? await look(P) : null;
    caught(MUT.painterReadsGameplay[0], l && (l.td !== TERRAIN_SHA || l.gd !== GROUND_SHA), l ? `terrain ${l.td === TERRAIN_SHA ? "same" : "changed"}, ground ${l.gd === GROUND_SHA ? "same" : "changed"}` : "didn't load"); await P.ctx.close(); }
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`, { world: MUT.noUnion[1](WORLD) }); const w2 = P.loaded ? await P.I(() => window.__island.tile(45, 92).walkable) : null;
    caught(MUT.noUnion[0], w2 === true, `hut tile walkable: ${w2}`); await P.ctx.close(); }
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`, { world: MUT.noFootUnion[1](WORLD) }); const b2 = P.loaded ? await P.I(([x, y]) => window.__island.blocked(x, y), [40 * T + 7, 92 * T + 8]) : null;
    caught(MUT.noFootUnion[0], b2 === false, `post pixel blocked: ${b2}`); await P.ctx.close(); }
  { const P = await open(`http://127.0.0.1:${port}/${Q}`, { world: MUT.terrainTakesContent[1](WORLD) }); const r = P.loaded ? await refusedHere(P, cWith(() => {})) : "didn't load";
    caught(MUT.terrainTakesContent[0], r === null, r === null ? "the terrain preview decoded content" : r); await P.ctx.close(); }
  // (on a prop with a solid tile it doesn't draw: since B3c1 a building's own shape check would also refuse the narrowed hut,
  // since B3c3 a wall's would refuse the walled room's missing tile of art, and since B3d1 a fence's the pen's, so none of
  // them can show D1 alone)
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`, { world: MUT.noD1[1](WORLD) }); const r = P.loaded ? await refusedHere(P, cWith((c) => { c.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [tileArt(50, 92, 50, 92)], tiles: [[51, 92]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; })) : "didn't load";
    caught(MUT.noD1[0], r === null, r === null ? "invisible collision decoded" : r); await P.ctx.close(); }
  // a normal format-2 home (not staged, no flag) let past the decoder: the completeness wall still refuses it, naming what's missing
  const normalHome = (page) => page.route(/\/js\/maps\/home\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: `window.ISLAND_MAPS = { home: ${JSON.stringify(Object.assign(copy(STAGED_MAP), { staged: undefined }))} };` }));
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`, { world: MUT.normal2[1](WORLD), route: normalHome }); const said = P.cons.concat(P.errs).join(" | ");
    check(name, `the completeness wall: ${MUT.normal2[0]}: still refused, naming what it lacks`, !P.loaded && /is a format-2 home without the content it needs: the content layer; buildings/.test(said), `loaded ${P.loaded}; said "${said.slice(0, 170)}"`); await P.ctx.close(); }
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`, { world: MUT.normal2NoWall[1](WORLD), route: normalHome }); const said = P.cons.concat(P.errs).join(" | ");
    caught(MUT.normal2NoWall[0], !/without the content it needs/.test(said), `loaded ${P.loaded}; said "${said.slice(0, 150)}" (without the wall nothing names what's missing)`); await P.ctx.close(); }
  await browser.close();
}
terrainPv.close(); realPv.close(); synPv.close(); plain.close();
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
