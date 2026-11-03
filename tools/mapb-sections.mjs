#!/usr/bin/env node
/* mapb-sections (MAP-B B3f): format 1's remaining home sections in the content format, at B3a's approved places: the anchors (the
   cargo dock, the car, rex, the gardener, the first visit, the arena, the core approach; the gate's is B3d3's park gate), the ten goto
   places, the five zones, the welder's patrol, the gardener's plants (the undergrowth it waters, none of it blocking) and format 1's two
   nests on their straw bases (Ammaar's option D: each base drawn over the nest's whole tile, the tile solid, D1 whole). The rooms have
   no place of their own: each of the game's three is behind one building's door (B3c). Completeness is complete: each of its six
   items is shown here to be satisfied by the content (taken away, the wall names it). The other props that block their tile in format 1
   (trees, lamps, the outpost kit, crates) wait for B4.
   In the content preview the roar zone and the fences' [E] cards (format 1's words) are on; the systems whose content is in but whose
   code would change the preview's seeded runs or isn't adapted (rex, the cockatiels, the bots, the car, the rift, the hatching, the
   koi, the volcano) stay off.

   1. Node: the content (the 49 records before B3f byte for byte as committed at d6b4c43, B3f's 41 after them, 290 solid tiles, no
      foot pixel, every rule passing); each record at B3a's place; what each zone's system needs; the plants; a malformed case for
      each new rule, each caught by its rule.
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the content preview: no error; the
      decoded sections in format 1's shapes; completeness (one item: the nests); goto to every place from the cave terminal; the
      terminal's paddocks; [E] at both fences (format 1's cards; the t-rex paddock's sets off the roar); the roar zone (format 1's
      rule: pi strictly inside it and within 150 px of the T. rex, never outside it or farther); the gardener's plants drawn and
      rustling; the fireflies over the brachio meadow at night; both painter digests; no storage written (the roar's secret
      included); the decoder refusing each broken section. Review shots (labelled, never baselines) in tools/out/mapb/b3f/.

     node tools/mapb-sections.mjs
     ENGINES=chromium node tools/mapb-sections.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, ANCHOR_PLAN, PLACE_PLAN, ZONE_PLAN, ROUTE_PLAN, PROP_SPRITES, NEST_PLAN } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, process.env.OUT || "tools/out/mapb/b3f");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const sha = (o) => createHash("sha256").update(typeof o === "string" ? o : JSON.stringify(o)).digest("hex");
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;

/* ════════ 1. Node ════════ */
const { src, m } = await terrain(), W = m.w, H = m.h, PW = W * T, at = (x, y) => y * W + x;
const { content, contentSha256 } = await loadContent();
const built = await buildContentText(content, contentSha256);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
const B3F_K = ["anchor", "place", "zone", "route", "prop"], CREC = DATA.records.filter((r) => !B3F_K.includes(r.kind)), SEC = DATA.records.slice(49);
const FORTY_NINE = "27354e47275633f2e598ee47f7c00c1872a967b3237e8f56925a5d51ce5bcd8a";   // B3e9's 49, as committed at d6b4c43
const RECS = resolveContent(content, src, m), LAYER = contentLayers(RECS, W, H);
const nameOf = (r) => r.id.slice(r.kind.length + 1), byKind = (k) => SEC.filter((r) => r.kind === k);
check("node", "the tracked content file is the current compile of tools/maps/home.content.mjs", built.text === readFileSync(CONTENT_STAGED, "utf8"));
check("node", "the content: the 49 records before B3f exactly as committed at d6b4c43 (byte for byte, in their order), then B3f's 41: 7 anchors, 10 places, 5 zones, the welder's route, 16 plants and the 2 nests, in that order; 90 records, 290 solid tiles (the nests' 2: nothing else of B3f's blocks) and no foot pixel; every rule passes",
  CREC.length === 49 && sha(DATA.records.slice(0, 49)) === FORTY_NINE && SEC.map((r) => r.kind).join() === [...Array(7).fill("anchor"), ...Array(10).fill("place"), ...Array(5).fill("zone"), "route", ...Array(18).fill("prop")].join() &&
  DATA.records.length === 90 && DATA.solidTiles === 290 && DATA.footPixels === 0 && contentProblems(RECS, src, m).length === 0 && SEC.every((r) => r.sprite === "e:nest0" ? r.tiles.length === 1 : !r.tiles.length && !r.footPxBoxes.length && !r.drawnPxBoxes.length),
  `${DATA.records.length} records, ${DATA.solidTiles} solid tiles, ${DATA.footPixels} foot pixels; ${contentProblems(RECS, src, m).map((q) => q.join(": ")).slice(0, 2).join(" | ") || "no problem"}`);
check("node", "each B3f record at B3a's approved place: the anchors (the first visit at the spawn, D4), the ten places in format 1's order, the five zones, the welder's start and stops",
  byKind("anchor").every((r) => ANCHOR_PLAN[nameOf(r)] && ANCHOR_PLAN[nameOf(r)].join() === r.at.join()) && Object.keys(ANCHOR_PLAN).length === 7 && ANCHOR_PLAN["first-visit"].join() === m.anchors.spawnTile.join() &&
  byKind("place").map((r) => nameOf(r) + ":" + r.at).join() === PLACE_PLAN.map(([n, p]) => n + ":" + p).join() &&
  byKind("zone").every((r) => ZONE_PLAN[nameOf(r)] && ZONE_PLAN[nameOf(r)].join() === r.area.join()) && byKind("zone").length === 5 &&
  JSON.stringify(byKind("route").map((r) => [nameOf(r), r.start, r.stops])) === JSON.stringify(Object.entries(ROUTE_PLAN).map(([n, q]) => [n, q.start, q.stops])),
  byKind("anchor").map((r) => `${nameOf(r)} ${r.at}`).join("; "));
// the island as built (terrain and content): reached from the spawn on foot
const reach = new Uint8Array(W * H); { const q = [at(...m.anchors.spawnTile)]; reach[q[0]] = 1; for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(x + dx, y + dy); if (!reach[n] && m.coll[n] === 0 && !LAYER.tiles[n]) { reach[n] = 1; q.push(n); } } } }
const feetClear = (x, y) => { const fx = x * T + 8, fy = y * T + 10; for (let yy = fy - 2; yy <= fy + 1; yy++) for (let xx = fx - 4; xx <= fx + 4; xx++) if (m.px.foot[yy * PW + xx] || LAYER.foot[yy * PW + xx]) return false; return true; };
const spots = [...byKind("anchor").map((r) => ["anchor " + nameOf(r), r.at]), ...byKind("place").map((r) => ["place " + nameOf(r), r.at]), ...byKind("route").flatMap((r) => [r.start, ...r.stops].map((p) => ["welder " + p, p]))];
const badSpots = spots.filter(([, [x, y]]) => !reach[at(x, y)] || !feetClear(x, y));
check("node", `every anchor, place and welder stop (${spots.length}) is open ground reached on foot from the spawn, pi's feet clear (so none is inside an enclosure: both are cut off)`, badSpots.length === 0, badSpots.map((q) => q[0]).join(", ") || `${spots.length} spots`);
const Z = Object.fromEntries(byKind("zone").map((r) => [nameOf(r), r.area])), A = Object.fromEntries(byKind("anchor").map((r) => [nameOf(r), r.at]));
const pdk = RECS.find((r) => r.id === "holding-paddock"), rex2 = RECS.find((r) => r.id === "roam-02");
const inZ = (x, y, z) => x >= z[0] && x <= z[2] && y >= z[1] && y <= z[3];
check("node", "what each zone's system needs: the roar zone round the holding paddock's whole fence and the T. rex's box (strictly inside, as the roar reads it); rex's anchor on grass in his meadow (32 walkable grass tiles); the gardener in the beds; the cargo dock on the quay; the core approach a row south of the arena at the rift field's middle",
  pdk.tiles.every(([x, y]) => x > Z["trex-roar"][0] && x + 1 < Z["trex-roar"][2] && y > Z["trex-roar"][1] && y + 1 < Z["trex-roar"][3]) && rex2.box[0] > Z["trex-roar"][0] && rex2.box[3] + 1 < Z["trex-roar"][3] &&
  inZ(...A.rex, Z["rex-meadow"]) && m.ground[at(...A.rex)] === 3 && inZ(...A.gardener, Z["gardener-beds"]) && m.ground[at(...A["cargo-dock"])] === 6 && A["core-approach"].join() === [A.arena[0], A.arena[1] + 1].join() && A.arena.join() === "76,56",
  `the paddock fence's ${pdk.tiles.length} tiles x ${Math.min(...pdk.tiles.map((q) => q[0]))} to ${Math.max(...pdk.tiles.map((q) => q[0]))}, y ${Math.min(...pdk.tiles.map((q) => q[1]))} to ${Math.max(...pdk.tiles.map((q) => q[1]))}; the roar zone ${Z["trex-roar"]}`);
const plants = byKind("prop").filter((r) => r.sprite !== "e:nest0"), nestR = byKind("prop").filter((r) => r.sprite === "e:nest0");
check("node", "the nests (Ammaar's option D): format 1's two at B3a's places, 46,54 with 3 eggs and 51,51 with 2, each on its straw base: its own tile solid and nothing else, its one drawn box that whole tile (D1: all of the collision drawn); open grass terrain under each (the terrain untouched: coll 0), in the riverlands babies' box (44,50 to 53,56); no ground cut off but the nests' own tiles (the pockets rule), and every baby and herd spawn clear",
  nestR.length === 2 && nestR.every((r) => { const k = NEST_PLAN.findIndex(([x, y]) => x === r.at[0] && y === r.at[1]); return k >= 0 && r.eggs === NEST_PLAN[k][2] && r.base === "straw" && r.tiles.length === 1 && r.tiles[0].join() === r.at.join() && JSON.stringify(r.drawnPxBoxes) === JSON.stringify([{ px0: r.at[0] * T, py0: r.at[1] * T, px1: r.at[0] * T + T - 1, py1: r.at[1] * T + T - 1 }]) && m.coll[at(...r.at)] === 0 && m.ground[at(...r.at)] === 3 && r.at[0] >= 44 && r.at[0] <= 53 && r.at[1] >= 50 && r.at[1] <= 56; }) &&
  !DATA.records.filter((r) => r.kind === "roam").some((r) => r.spawns.some((q) => nestR.some((n) => n.at.join() === q.at.join()))), nestR.map((r) => `${r.id}: ${r.eggs} eggs, tile ${r.tiles[0]}, drawn ${JSON.stringify(r.drawnPxBoxes[0])}`).join("; "));
check("node", "the gardener's plants: 16, every one undergrowth the gardener waters (fern or tall grass: no collision in format 1 either), on open grass in its beds, with open ground south of it reached from the spawn (where the gardener stands to water it)",
  plants.length === 16 && plants.every((r) => PROP_SPRITES.test(r.sprite) && inZ(...r.at, Z["gardener-beds"]) && m.ground[at(...r.at)] === 3 && reach[at(r.at[0], r.at[1] + 1)]), plants.map((r) => `${r.sprite.slice(2)} ${r.at}`).slice(0, 4).join("; ") + " ...");
// a malformed case for each new rule, made on the source one at a time, each caught by its rule
const RS = (c, id) => c.records.find((r) => r.id === id);
const BAD = [
  ["an anchor moved (rex a tile east)", (c) => { RS(c, "anchor-rex").at = [39, 80]; }, "anchors", /approved tile is 38,80/],
  ["an anchor that isn't one of B3a's", (c) => { RS(c, "anchor-car").id = "anchor-boat"; }, "anchors", /isn't/],
  ["the first visit away from the spawn", (c) => { RS(c, "anchor-first-visit").at = [50, 83]; }, "anchors", /approved tile|the spawn/],
  ["an anchor on a solid tile (the car in the visitor centre)", (c) => { RS(c, "anchor-car").at = [84, 72]; }, "anchors", /isn't open ground/],
  ["a place moved", (c) => { RS(c, "place-pond").at = [111, 57]; }, "places", /approved tile is 110,57/],
  ["places out of format 1's order", (c) => { const a = c.records.findIndex((r) => r.id === "place-pond"); const [r] = c.records.splice(a, 1); c.records.splice(a + 3, 0, r); }, "places", /format 1's order/],
  ["a place inside the raptor yard", (c) => { RS(c, "place-raptors").at = [123, 14]; }, "places", /not reached from the spawn/],
  ["a place that isn't format 1's", (c) => { RS(c, "place-car").id = "place-cafe"; }, "places", /isn't/],
  ["a zone moved", (c) => { RS(c, "zone-rex-meadow").area = [35, 78, 41, 81]; }, "zones", /approved box/],
  ["a zone that isn't format 1's", (c) => { RS(c, "zone-fireflies").id = "zone-glowworms"; }, "zones", /isn't/],
  ["the roar zone not round the paddock's fence", (c) => { RS(c, "zone-trex-roar").area = [104, 12, 120, 20]; }, "zones", /approved box|isn't inside it/],
  ["a welder stop moved", (c) => { RS(c, "route-welder-patrol").stops[0] = [118, 14]; }, "routes", /approved start and stops/],
  ["a route that isn't format 1's", (c) => { RS(c, "route-welder-patrol").id = "route-cargo-loop"; }, "routes", /isn't/],
  ["a nest with no base (its tile would block undrawn: D1)", (c) => { RS(c, "plant-01").sprite = "e:nest0"; }, "props", /stands on a base drawn over that whole tile/],
  ["a nest moved a tile", (c) => { RS(c, "nest-46-54").at = [47, 54]; }, "props", /one of format 1's two/],
  ["a nest with the other nest's eggs", (c) => { RS(c, "nest-46-54").eggs = 2; }, "props", /holds format 1's 3 eggs/],
  ["a nest whose base isn't one the game draws", (c) => { RS(c, "nest-51-51").base = "moss"; }, "schema", /base must be one of straw/],
  ["eggs on a fern", (c) => { RS(c, "plant-01").eggs = 2; RS(c, "plant-01").base = "straw"; }, "schema", /only a nest \(e:nest0\) has eggs and a base/],
  ["a tree among the props (it blocks its tile in format 1 too)", (c) => { RS(c, "plant-01").sprite = "e:oak1"; }, "props", /waits for B4 \(D1\)/],
  ["a plant on a path", (c) => { RS(c, "plant-01").at = [33, 85]; }, "props", /open grass/],
  ["a plant on the drink stand's approach", (c) => { RS(c, "plant-01").at = [53, 88]; }, "props", /open grass|approach/],
  ["two plants on one tile", (c) => { RS(c, "plant-02").at = RS(c, "plant-01").at.slice(); }, "props", /already has/],
  ["a zone with a solid tile", (c) => { RS(c, "zone-fireflies").solid = { tiles: [[20, 40]] }; }, "schema", /has no solid/],
  ["a place with a box", (c) => { RS(c, "place-pond").box = { x0: 1, y0: 1, x1: 2, y1: 2 }; }, "schema", /has no box/],
  ["an anchor named like a place", (c) => { RS(c, "anchor-car").id = "place-car2"; }, "anchors", /named anchor-<name>/],
  ["a zone off the map", (c) => { RS(c, "zone-fireflies").area = [140, 31, 151, 53]; }, "schema", /inside the map/]
];
for (const [label, fn, rule, re] of BAD) {
  const c = copy(content); fn(c); let got = null;
  try { const rr = resolveContent(c, src, m); const p = contentProblems(rr, src, m); got = p.find((q) => q[0] === rule && re.test(q[1])) ? [rule, "caught"] : p[0] || ["none", "passed"]; }
  catch (e) { got = [e.rule || "throw", e.message]; }
  check("node", `malformed, caught by ${rule}: ${label}`, got[0] === rule && (got[1] === "caught" || re.test(got[1])), got.join(": ").slice(0, 200));
}

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const REFUSE = [
  ["an anchor that isn't the game's", (c) => { DR(c, "anchor-car").id = "anchor-boat"; }, /is an anchor, and boat isn't one of the game's/],
  ["an anchor in the visitor centre", (c) => { DR(c, "anchor-car").at = [84, 72]; }, /its tile 84,72 isn't open ground \(solid content\)/],
  ["a place inside the raptor yard", (c) => { DR(c, "place-raptors").at = [123, 14]; }, /can't be reached on foot from the spawn/],
  ["the cargo dock off the dock", (c) => { DR(c, "anchor-cargo-dock").at = [95, 82]; }, /the cargo dock's anchor 95,82 isn't on the dock/],
  ["a zone that isn't the game's", (c) => { DR(c, "zone-fireflies").id = "zone-glowworms"; }, /is a zone, and glowworms isn't one of the game's/],
  ["a zone off the map", (c) => { DR(c, "zone-fireflies").area = [140, 31, 151, 53]; }, /\.area must lie inside the map/],
  ["a welder stop inside the raptor yard", (c) => { DR(c, "route-welder-patrol").stops[0] = [123, 14]; }, /its stop 123,14 can't be reached on foot from the spawn/],
  ["a route with one stop", (c) => { DR(c, "route-welder-patrol").stops = [[118, 13]]; }, /\.stops needs at least 2 stops/],
  ["a nest with no base (D1: format 1 makes its tile solid)", (c) => { DR(c, "plant-01").sprite = "e:nest0"; }, /the sprite e:nest0 blocks its tile in format 1, and its art doesn't cover the tile: no invisible collision \(D1\)/],
  ["a nest's base short of its tile", (c) => { DR(c, "nest-46-54").drawnPxBoxes[0].py0 += 3; }, /a nest's base is drawn over its whole tile/],
  ["a nest solid beyond its tile", (c) => { DR(c, "nest-46-54").tiles.push([47, 54]); c.solidTiles++; }, /a nest makes its own tile 46,54 solid, and only that/],
  ["a prop with a solid tile", (c) => { const r = DR(c, "plant-01"); r.tiles = [r.at.slice()]; c.solidTiles++; }, /is a prop: it blocks nothing/],
  ["a place named without its kind", (c) => { DR(c, "place-pond").id = "pond"; }, /is a place, so it is named place-<name>/],
  ["two records for one anchor", (c) => { c.records.push(copy(DR(c, "anchor-rex"))); }, /appears twice/],
  ["a zone with a door", (c) => { DR(c, "zone-fireflies").doorTiles = [[20, 40]]; }, /is a zone: it blocks nothing/]
];
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const port = 9600 + Math.floor(Math.random() * 80), servers = {};
await startPreview(port, { content: true });
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11&seed=42#island";
const STORE = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
const STORE_JSON = JSON.stringify(Object.keys(STORE).sort().map((k) => [k, STORE[k]]));

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const open = async (url, opts = {}) => {
    const ctx = await browser.newContext(opts.ctx || { viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (msg) => { if (msg.type() === "error" && !page.__shooting) errs.push(msg.text()); });   // (WebKit's screenshot injects a stylesheet the page's CSP refuses: not the page's error)
    if (opts.store) await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, opts.store);
    await page.goto(url, { timeout: 60000 }).catch((e) => errs.push("goto: " + e.message.split("\n")[0]));
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => true, () => false);
    return { ctx, page, errs, loaded, I: (fn, a) => page.evaluate(fn, a) };
  };
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });
  const dialog = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-dialog"); return { open: !d.hidden, name: d.querySelector(".w-name").textContent, text: d.querySelector("#w-sr").textContent }; });
  const closeAll = async (P) => {
    await P.I(() => window.__island.step(2));
    if (await P.I(() => window.__island.preview().term)) { await P.page.click(".w-term-x").catch(() => {}); await P.I(() => window.__island.step(2)); }
    if (await P.page.evaluate(() => !document.querySelector(".w-dialog").hidden)) { await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(4)); }
  };
  const termLines = (P) => P.page.evaluate(() => [...document.querySelectorAll(".w-term-out .w-term-line")].map((l) => l.textContent));
  // the cave terminal opened (pi at its approach, [E]) and its input ready: it opens on the real clock, so wait for the input to show
  // (once retried; the first full run timed out filling it while it was still hidden: gates/full/mapb-sections.log)
  const openTerm = async (P) => { for (let k = 0; k < 2; k++) { await closeAll(P); await P.I(() => { const I2 = window.__island; I2.teleport(66 * 16 + 8, 25 * 16 + 10); I2.step(3); }); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(40));
    if (await P.page.waitForSelector(".w-term-in", { state: "visible", timeout: 5000 }).then(() => true, () => false)) return true; } return false; };
  // (a command typed into the cave terminal: its input waited for, the terminal reopened once if it went away; a failure, never a throw)
  const typeCmd = async (P, cmd) => { for (let k = 0; k < 2; k++) { if (k) await openTerm(P); const ok = await P.page.waitForSelector(".w-term-in", { state: "visible", timeout: 3000 }).then(() => true, () => false);
    if (ok && await P.page.fill(".w-term-in", cmd, { timeout: 3000 }).then(() => true, () => false)) { await P.page.press(".w-term-in", "Enter").catch(() => {}); await new Promise((r) => setTimeout(r, 40)); await P.I(() => window.__island.step(2)); return true; } } return false; };
  const label = (P, text) => P.page.evaluate((tx) => { let d = document.getElementById("b3f-label"); if (!d) { d = document.createElement("div"); d.id = "b3f-label"; d.style.cssText = "position:fixed;left:8px;top:64px;z-index:99999;background:rgba(0,0,0,.78);color:#ffe27a;font:11px/1.35 monospace;padding:5px 7px;max-width:70vw;pointer-events:none;white-space:pre-wrap"; document.body.appendChild(d); } d.textContent = tx; }, text);
  const shoot = async (P, f, text) => { await P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; }); await label(P, `B3f review (not a baseline): ${text}`); P.page.__shooting = true; await P.page.screenshot({ path: join(OUT, `${name}-${f}.png`) }); await P.page.waitForTimeout(50); P.page.__shooting = false; await P.page.evaluate(() => { const d = document.getElementById("b3f-label"); if (d) d.remove(); }); };

  const P = await open(`http://127.0.0.1:${port}/${Q}`, { store: STORE });
  if (!P.loaded) { check(name, "the content preview loads", false, P.errs.slice(0, 2).join(" | ")); await browser.close(); continue; }
  // the decoded sections, in format 1's shapes, and which systems run
  const dec = await P.I((mm) => { const I2 = window.__island, v = I2.preview(), c = I2.completeness(), s = I2.decodeMap(mm);
    return { sys: v.sys, comp: c, anchors: Object.keys(s.anchors), places: s.content.places, props: I2.props() }; }, cWith(() => {})).catch((e) => ({ err: e.message }));
  if (dec.err) { check(name, "the decoded sections", false, dec.err); await browser.close(); continue; }
  const sumA = dec.anchors;
  check(name, "the content preview decodes B3f's sections into format 1's shapes: the anchors (dock, car, rex, gardener, firstVisit, arena, coreApproach beside the spawn and the helipad; no gate anchor, which would draw format 1's gate: MAP-B's is its record), the ten places, the five zones, the welder's route, the 16 plants as props",
    ["spawn", "helipad", "dock", "car", "rex", "gardener", "firstVisit", "arena", "coreApproach"].every((k) => sumA.includes(k)) && !sumA.includes("gate") && dec.places === 10 && dec.props.length === 18 && dec.props.filter((q) => /^e:(fern|tallgrass)\d$/.test(q[0])).length === 16 && dec.props.filter((q) => q[0] === "e:nest0").map((q) => q.slice(1).join()).join(" ") === "46,54 51,51",
    `anchors ${sumA.join(", ")}; places ${dec.places}; props ${dec.props.length}`);
  check(name, "completeness: complete since B3f's nests, nothing missing (each item checked from the decoded data, never from a claim in it; what each needs is shown below by taking it away)", dec.comp.complete && dec.comp.missing.length === 0, dec.comp.missing.join(" | ") || "nothing missing");
  check(name, "the systems: the creatures and the stations run as before (their content was in); rex, the cockatiels, the bots, the car, the rift, the hatching, the koi and the volcano stay off (their code isn't adapted to MAP-B yet, or switching it on would change the preview's seeded runs; B4's work)",
    dec.sys.creatures && dec.sys.stations && dec.sys.buildings && ["rex", "birds", "koi", "bots", "car", "rift", "volcano", "hatch"].every((k) => dec.sys[k] === false), JSON.stringify(dec.sys));
  // goto to every place from the cave terminal (format 1's command), pi on the place's tile
  const gotoRes = [];
  // (one retry when the command didn't take: the terminal opens and takes input on the real clock; retries counted and reported, so a
  // place goto can't reach is never passed over)
  let retries = 0;
  for (const [nm, p] of PLACE_PLAN) {
    let res = "no terminal";
    for (let attempt = 0; attempt < 2 && res !== "ok"; attempt++) {
      if (attempt) retries++;
      if (!(await openTerm(P))) continue;
      await typeCmd(P, "goto " + nm);
      // (the command runs as the terminal takes it, on the real clock: wait for pi to leave the cave, a second at most)
      for (let q = 0; q < 20 && (await P.I(() => { const p = window.__island.getState().pi; return Math.floor(p.x / 16) === 66 && Math.floor(p.y / 16) === 25; })); q++) { await new Promise((r) => setTimeout(r, 50)); await P.I(() => window.__island.step(1)); }
      await P.I(() => window.__island.step(4));
      const s2 = await P.I(() => { const p = window.__island.getState().pi; return [Math.floor(p.x / 16), Math.floor(p.y / 16)]; });
      res = s2.join() === p.join() ? "ok" : `at ${s2}, not ${p}`;
    }
    gotoRes.push([nm, res]);
  }
  await closeAll(P);
  check(name, "goto from the cave terminal: each of format 1's ten places puts pi on its tile", gotoRes.every((q) => q[1] === "ok"), gotoRes.map((q) => q.join(" ")).join("; ") + `; terminal retries ${retries}`);
  // the terminal's paddocks (format 1's listing, D10's names)
  const tOk = await openTerm(P);
  if (tOk) await typeCmd(P, "ls paddocks/"); const tl = await termLines(P); await closeAll(P);
  check(name, "the terminal's ls paddocks/ names both MAP-B fences in format 1's words (D10: t-rex paddock, raptor pen)", tl.some((l) => l.trim() === "t-rex-paddock   raptor-pen"), tl.slice(-2).join(" / "));
  // [E] at the fences: format 1's cards, and the t-rex paddock's sets off the roar (when it's ready), the raptor pen's doesn't
  const ti = await P.I(() => window.__island.preview().creatures.findIndex((c) => c.kind === "trex"));
  const fenceAt = async (sp) => { await closeAll(P);
    await P.I(() => { const I2 = window.__island; I2.teleport(60 * 16 + 8, 80 * 16 + 10); for (let i = 0; i < 60 * 16; i++) I2.step(1); });   // far off: the roar's 14 s cooldown runs out
    const nb = await P.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); return I2.preview().nearby; }, sp);
    await P.page.keyboard.press("e"); const r = await P.I((i) => window.__island.creature(i).roar, ti); await P.I(() => window.__island.step(2)); const d = await dialog(P); await closeAll(P); return { nb, d, roar: r }; };
  const fT = await fenceAt([113, 18]), fR = await fenceAt([119, 13]);
  check(name, "[E] beside the holding paddock's fence opens format 1's card (\"t-rex paddock\", its words) and the T. rex roars at once (format 1's: the paddock's card sets off the roar when it's ready)",
    fT.nb === "fence" && fT.d.open && fT.d.name === "t-rex paddock" && /^the t-rex paddock\. 10,000 volts\./.test(fT.d.text) && fT.roar > 1.3, `nearby ${fT.nb}, "${fT.d.name}", roar ${fT.roar.toFixed(2)}`);
  check(name, "[E] beside the raptor yard's fence opens format 1's card (\"raptor pen\", its words); it sets off no roar of its own (format 1's)",
    fR.nb === "fence" && fR.d.open && fR.d.name === "raptor pen" && /^the raptor pen\. 10,000 volts\./.test(fR.d.text), `nearby ${fR.nb}, "${fR.d.name}", roar ${fR.roar.toFixed(2)}`);
  // the roar zone, format 1's rule: pi strictly inside the zone and within 150 px of the T. rex, frame by frame, the T. rex held still
  const roarRule = await P.I(([i, z]) => { const I2 = window.__island, out = [];
    // each case: the T. rex held at a tile, pi at a spot, 20 s (the cooldown is 14 s): roars counted, and each roar's frame checked against the rule
    for (const [lab, tx, ty, px, py] of [["inside the zone, near (the lane)", 115, 13, 118, 13], ["inside the zone, near (south of the paddock)", 112, 15, 112, 19], ["outside the zone, near (a row south of it)", 112, 15, 112, 20], ["inside the zone, far (its west edge)", 115, 15, 105, 10]]) {
      I2.teleport(60 * 16 + 8, 80 * 16 + 10); for (let k = 0; k < 900; k++) I2.step(1);
      I2.creature(i, { x: tx * 16 + 8, y: ty * 16 + 10, tx: 0, wait: 1e9, sleep: 0 }); I2.teleport(px * 16 + 8, py * 16 + 10);
      let roars = 0, bad = 0, was = 0;
      for (let f = 0; f < 1200; f++) { I2.step(1); const c = I2.creature(i), p = I2.getState().pi; if (c.roar > 0 && !was) { roars++; const inz = p.x > z[0] * 16 && p.x < z[2] * 16 && p.y > z[1] * 16 && p.y < z[3] * 16; if (!inz || Math.hypot(p.x - c.x, p.y - c.y) >= 150) bad++; } was = c.roar > 0 ? 1 : 0; I2.creature(i, { x: tx * 16 + 8, y: ty * 16 + 10, tx: 0 }); }
      out.push({ lab, roars, bad }); }
    I2.creature(i, { wait: 0 }); return out; }, [ti, ZONE_PLAN["trex-roar"]]);
  check(name, "the roar zone (format 1's rule, the T. rex held still): pi inside the zone and near the T. rex, it roars, once every 14 s; a row south of the zone, as near, never; inside the zone over 150 px off, never; every roar with pi inside and within 150 px",
    roarRule[0].roars >= 1 && roarRule[1].roars >= 1 && roarRule[2].roars === 0 && roarRule[3].roars === 0 && roarRule.every((q) => q.bad === 0) && roarRule[0].roars <= 2, roarRule.map((q) => `${q.lab}: ${q.roars}`).join("; "));
  // a roar in normal play, for review: pi walked into the lane
  await P.I(() => { const I2 = window.__island; I2.teleport(60 * 16 + 8, 80 * 16 + 10); for (let k = 0; k < 900; k++) I2.step(1); I2.teleport(112 * 16 + 8, 19 * 16 + 10); I2.walkTo(118, 13, false); for (let k = 0; k < 2000; k++) { I2.step(1); if (I2.preview().creatures.some((c) => c.kind === "trex" && c.roar > 1.1)) break; } });
  if (name !== "firefox") await shoot(P, "roar-lane", "pi walked into the lane: the T. rex roars (B3f: format 1's roar zone, in the content)");
  // the gardener's beds: the plants drawn, a fern rustling when pi walks through
  const rust = await P.I(() => { const I2 = window.__island; I2.teleport(35 * 16 + 8, 90 * 16 + 10); I2.walkTo(39, 90, false); let n = 0; for (let k = 0; k < 400; k++) { I2.step(1); if (!I2.getState().pi.path) break; } I2.step(10); return I2.props().filter((q) => /^e:(fern|tallgrass)\d$/.test(q[0])).length; });
  if (name !== "firefox") { await P.I(() => { const I2 = window.__island; I2.teleport(34 * 16 + 8, 93 * 16 + 10); for (let k = 0; k < 90; k++) I2.step(1); }); await shoot(P, "gardener-beds", "the gardener's beds (28,88 to 41,97): sixteen plants by B3f's rule, among the compsognathus; the gardener itself (a bot) stays off"); }
  check(name, "the gardener's plants are the game's props (16 of the 18, the nests the other two), drawn with the environment sprites", rust === 16);
  // the nests (option D): [E] beside each opens format 1's card with its eggs; its tile is solid (pi can't stand on it, no route ends on
  // it, its pixels block feet); the babies and the herd, frame by frame for three minutes, never stand on either and keep walking
  const nestCard = async (sp) => { await closeAll(P); const nb = await P.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, y * 16 + 10); I2.step(2); return I2.preview().nearby; }, sp); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(3)); const d = await dialog(P); await closeAll(P); return { nb, d }; };
  const n1 = await nestCard([46, 55]), n2 = await nestCard([51, 52]);
  check(name, "[E] beside each nest opens format 1's card with its own eggs: \"a nest of 3 speckled eggs\" at 46,54 and of 2 at 51,51 (its sprite, wobbling egg and words format 1's)",
    n1.nb === "nest" && n1.d.open && n1.d.name === "a nest" && /^a nest of 3 speckled eggs, still warm\./.test(n1.d.text) && n2.nb === "nest" && n2.d.open && /^a nest of 2 speckled eggs/.test(n2.d.text), `${n1.nb}: ${n1.d.text.slice(0, 30)}; ${n2.nb}: ${n2.d.text.slice(0, 30)}`);
  const nc = await P.I(() => { const I2 = window.__island, out = {};
    out.tiles = [[46, 54], [51, 51]].map(([x, y]) => { const t = I2.tile(x, y); return { walk: t.walkable, content: t.content, terr: t.terrainFlags, safe: I2.safe(x, y), px: [[2, 2], [8, 8], [13, 13], [8, 15]].every(([dx, dy]) => I2.blocked(x * 16 + dx, y * 16 + dy)) }; });
    I2.teleport(46 * 16 + 8, 56 * 16 + 10); I2.step(1); I2.walkTo(46, 54, true); for (let k = 0; k < 600 && I2.getState().pi.path; k++) I2.step(1); const p = I2.getState().pi; out.walked = [Math.floor(p.x / 16), Math.floor(p.y / 16)];
    const cs = I2.preview().creatures, ix = cs.map((c, i) => (c.kind === "baby" || c.kind === "baby2") && c.area[0] === 44 || ["stego", "trike", "ankylo"].includes(c.kind) ? i : -1).filter((i) => i >= 0);
    I2.teleport(30 * 16 + 8, 60 * 16 + 10); I2.step(1); const d0 = ix.map((i) => I2.creature(i).dist); let on = 0;
    for (let f = 0; f < 10800; f += 2) { I2.step(2); ix.forEach((i) => { const c = I2.creature(i), tx = Math.floor(c.x / 16), ty = Math.floor(c.y / 16); if ((tx === 46 && ty === 54) || (tx === 51 && ty === 51) || I2.blocked(c.x, c.y)) on++; }); }
    out.on = on; out.moved = ix.map((i, k) => Math.round(I2.creature(i).dist - d0[k])); out.kinds = ix.map((i) => cs[i].kind); return out; });
  check(name, "each nest's tile is solid, as format 1's: not walkable, not safe ground, its pixels (corners and middle) block feet, the terrain under it unchanged (content, not terrain); pi sent onto 46,54 by the game's route stops short of it",
    nc.tiles.every((q) => !q.walk && q.content && q.terr === 0 && !q.safe && q.px) && nc.walked.join() !== "46,54", `${JSON.stringify(nc.tiles)}; pi ended at ${nc.walked}`);
  check(name, "the babies and the herd round the nests (riverlands), three minutes frame by frame: never on a nest's tile or a solid pixel, and each keeps walking (format 1's: a nest is solid ground they wander round)",
    nc.on === 0 && nc.moved.every((d) => d > 50) && nc.kinds.length === 6, `${nc.kinds.map((k, i) => `${k} ${nc.moved[i]} px`).join(", ")}; on a nest or solid ${nc.on}`);
  if (name !== "firefox") { await P.I(() => { const I2 = window.__island; I2.teleport(48 * 16 + 8, 55 * 16 + 10); for (let k = 0; k < 90; k++) I2.step(1); }); await shoot(P, "nests-desktop-day", "the nests on their straw bases (Ammaar's option D): 46,54 with 3 eggs, 51,51 with 2, each tile solid and drawn whole; desktop 1280 x 900, 11:00"); }
  // what each completeness item needs (B3f): each taken away from the content in turn, the wall names that item and nothing else
  const takeAway = [["rooms", (c) => { DR(c, "depot").room = "bunker"; }, /^rooms: bunker \(behind 2 doors\), depot$/],
    ["anchors", (c) => { c.records = c.records.filter((r) => r.id !== "anchor-car"); }, /^anchors: car$/],
    ["routes", (c) => { c.records = c.records.filter((r) => r.kind !== "route"); }, /^routes: welder-patrol$/],
    ["places", (c) => { c.records = c.records.filter((r) => r.id !== "place-shrine"); }, /^places: shrine$/],
    ["zones", (c) => { c.records = c.records.filter((r) => r.id !== "zone-fireflies"); }, /^zones: fireflies$/],
    ["props", (c) => { c.records = c.records.filter((r) => r.id !== "nest-51-51"); c.solidTiles--; }, /^props: the nests/]];
  const genuine = [];
  for (const [item, fn, re] of takeAway) {
    const c = copy(DATA); fn(c); const pp = port + 10 + takeAway.findIndex((q) => q[0] === item);
    if (!servers[pp]) servers[pp] = await startPreview(pp, { content: c });
    const Q2 = await open(`http://127.0.0.1:${pp}/${Q}`); const cm = Q2.loaded ? await Q2.I(() => window.__island.completeness()) : null; await Q2.ctx.close();
    genuine.push([item, cm && !cm.complete && cm.missing.length === 1 && re.test(cm.missing[0]), cm ? cm.missing.join(" | ").slice(0, 120) : "didn't load"]);
  }
  check(name, "all six completeness items are satisfied by the content, not passed over: taking away the depot's room (the bunker's behind two doors), the car's anchor, the welder's route, the shrine's place, the fireflies' zone or a nest, the wall names exactly that item",
    genuine.every((q) => q[1]), genuine.map((q) => `${q[0]}: ${q[2]}`).join("; "));
  // the painter: both locked digests with B3f's sections in
  const dg = { td: await P.I(() => window.__island.terrainDigest()), gd: await P.page.evaluate(DIGEST) };
  check(name, "the painter: both locked digests with B3f's sections in (none of them is painted into the ground)", dg.td === TERRAIN_SHA && dg.gd === GROUND_SHA, `terrain ${dg.td.slice(0, 12)}, ground ${dg.gd.slice(0, 12)}`);
  // no storage written: the roar found its secret, the cards opened, goto ran; a reload
  await P.page.reload(); await P.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
  check(name, "no storage read or written (the roar's secret found, the cards, goto, a reload): a production save beside it untouched", (await storeOf(P)) === STORE_JSON);
  // the decoder refuses each broken section
  const refused = async (o) => P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
  { const msg = await refused(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
  for (const [lab, fn, re] of REFUSE) { const msg = await refused(cWith(fn)); check(name, `decoder refuses: ${lab}`, re.test(msg || ""), msg || "NOT refused"); }
  check(name, "no page error or console error in the content preview", P.errs.length === 0, P.errs.slice(0, 3).join(" | "));
  await P.ctx.close();
  // night: the fireflies over the brachio meadow (format 1's: drawn from the zone, no rand), for review
  const N = await open(`http://127.0.0.1:${port}/?debug=1&step=1&islandhour=22&seed=42#island`);
  if (N.loaded) {
    // (the opening title card and the iris clear on the real clock first)
    const fl = await N.I(async () => { const I2 = window.__island; for (let q = 0; q < 80; q++) { await new Promise((r) => setTimeout(r, 50)); I2.step(1); } I2.teleport(20 * 16 + 8, 42 * 16 + 10); for (let k = 0; k < 240; k++) I2.step(1); return I2.getState().open && !I2.getState().iris; });
    if (name !== "firefox") await shoot(N, "fireflies-night", "22:00, the brachio meadow: the fireflies (B3f: format 1's fireflies zone, 11,31 to 30,53)");
    check(name, "night: the preview runs with the fireflies' zone in, no error", fl && N.errs.length === 0, N.errs.slice(0, 2).join(" | "));
  } else check(name, "night preview loads", false);
  if (N.loaded && name !== "firefox") { await N.I(() => { const I2 = window.__island; I2.teleport(48 * 16 + 8, 55 * 16 + 10); for (let k = 0; k < 90; k++) I2.step(1); }); await shoot(N, "nests-desktop-night", "the nests at night (22:00), desktop 1280 x 900"); }
  await N.ctx.close();
  // the nests on a phone (390 x 844), day and night, for review
  if (name !== "firefox") for (const [hour, lab] of [[11, "day"], [22, "night"]]) {
    const M = await open(`http://127.0.0.1:${port}/?debug=1&step=1&islandhour=${hour}&seed=42#island`, { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } });
    if (M.loaded) { await M.I(async () => { const I2 = window.__island; for (let q = 0; q < 80; q++) { await new Promise((r) => setTimeout(r, 50)); I2.step(1); } I2.teleport(48 * 16 + 8, 55 * 16 + 10); for (let k = 0; k < 120; k++) I2.step(1); });
      const go = await M.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { await go.tap(); await M.I(() => window.__island.step(10)); }
      await shoot(M, `nests-phone390-${lab}`, `the nests, phone 390 x 844, ${hour}:00`); }
    check(name, `phone 390 x 844, ${lab}: the preview runs by the nests with no error`, M.loaded && !M.errs.length, M.errs.slice(0, 2).join(" | "));
    await M.ctx.close();
  }
  await browser.close();
}
for (const n of notes) console.log("note " + n);
console.log(fails ? `FAILED: ${fails}` : "all passed" + (blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""));
process.exit(fails ? 1 : blocked.length ? 2 : 0);
