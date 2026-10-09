#!/usr/bin/env node
/* mapb-painter (MAP-B B2c, B2d): the format-2 painter, the terrain (B2c) and the features over it (B2d), in the real game, through the local preview, in each engine
   (Chromium and WebKit; Firefox is tried and reported BLOCKED if it can't launch).

   - the ground paints once, 2400 x 1920 world px, with no page error, its own account (?debug=1's painterReport)
     agreeing with the decoded map: every pixel looks wet exactly where the edge mask says (and GK, which the footfalls
     and glints read, agrees); nothing pi can stand on looks like rock, a cliff, lava or water; every one of the 289
     cliff rims reads as rock, with a face only above lower land; each of the 8 ramps meets its levels with a slope, no
     face; all four levels' grass, both rivers, the four still waters, both seas and the volcano's scree, cone and lava
     are drawn; the 9 accepted dry-lip places (B2a) read as rock;
   - the paint is repeatable: three fresh loads give the same RGBA digest, and so does every engine. The terrain pass
     alone (kept aside before the features are drawn) is the approved B2c terrain (tools/fixtures/mapb-ground.json's
     terrain), which a single changed pixel would break; the finished ground (terrain and features) is checked against
     the fixture's ground once one is approved, and measured until then. Only canvases, never a screenshot;
   - the features (B2d): no path, plaza, deck, dock or pad pixel on water or on ground pi can't stand on; every
     corridor drawn without a gap along its authored line wherever pi can stand there (the thin diagonal trails among
     them); each bridge's deck, each dock and the pad drawn; both falls drawn, on water only; no tile-shaped dirt left;
   - format 1's ground (production) is unchanged: its RGBA digest per engine is B2b's;
   - measured: the paint's time by phase, the canvas and its memory, frame times while walking (the ground isn't painted
     again after the first time);
   - review images (ignored, never baselines) into tools/out/mapb/painter/.

     node tools/mapb-painter.mjs
     ENGINES=chromium node tools/mapb-painter.mjs */
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tools/out/mapb/painter");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
// format 1's painted ground at B2b (cdc4e3f), RGBA SHA-256 per engine (format 1's painter uses sin and cos, so each engine its own)
const F1_GROUND = { chromium: "ae221c53e6dcf6034e1c7f53b385c19310f4747d6aa2b51e8a0a6aa93592a15b", webkit: "31bef4191ad09fba4a248ab71ceccc381091b1844dc0b01cda8183c586be69e8" };
const FIXTURE = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8")), GROUND_FIXTURE = FIXTURE.terrain, FINAL_FIXTURE = FIXTURE.ground || null;
const RIM_TILES = 289;                                              // B1b's cliff rims, as map-lint counts them
const DRY_LIP_TILES = ["80,6", "62,7", "52,13", "7,23", "44,28", "124,29", "132,37", "96,106", "97,106"];   // B2a's accepted places over 8 px
const CORNER_TILES = ["29,19", "30,19", "47,23", "50,23", "19,67", "20,67", "21,78", "25,79", "26,79"];       // B2b's accepted corner-model places
const CROPS = [["harbour", 62, 72, 98, 100], ["west-jetty", 10, 60, 26, 74], ["upper-bridge", 42, 18, 56, 28], ["brachio-bridge", 28, 40, 42, 54], ["delta-bridge", 16, 70, 32, 86],
  ["upper-waterfall", 38, 22, 52, 34], ["lower-waterfall", 24, 54, 38, 66], ["helipad", 96, 86, 110, 100], ["diagonal-trails-shrine", 8, 16, 34, 30], ["diagonal-trails-riverlands", 20, 36, 46, 60],
  ["harbour-coast", 60, 74, 98, 104], ["delta", 4, 64, 32, 100], ["riverlands", 22, 34, 62, 66], ["upper-waterfall-area", 34, 18, 54, 38], ["koi-pond", 100, 52, 122, 72],
  ["headland-coast", 122, 30, 149, 58], ["shrine", 4, 12, 24, 30], ["volcano-tarn", 46, 0, 92, 24], ["main-ramp", 68, 58, 84, 72], ["park-gate-ramp", 66, 30, 82, 44], ["shrine-ramp", 8, 18, 24, 30], ["headland-ramp", 124, 36, 136, 50]];
const PLACES = [["harbour", [79, 82]], ["commons", [76, 54]], ["delta", [22, 79]], ["highland", [73, 33]], ["koi", [108, 68]], ["shrine", [14, 20]]];

let fails = 0; const blocked = [], DIG = {};
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
// in the page: the ground canvas's RGBA (decoded from the test API's PNG, which is lossless) and its SHA-256
// (perturb: the same, with one pixel's red changed by 1, to show the digest notices a single pixel: px 1216,960, on the
// main walk's stroke, a feature-layer pixel)
const DIGEST = async (perturb) => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height).data; if (perturb) { const i = (960 * c.width + 1216) * 4; px[i] = (px[i] + 1) & 255; }
  const h = await crypto.subtle.digest("SHA-256", px); return { w: c.width, h: c.height, sha: [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join("") }; };
mkdirSync(OUT, { recursive: true });

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const port = 9100 + Math.floor(Math.random() * 300), pv = await startPreview(port), plain = await serve(port + 1);
  const load = async (url) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [];
    // Playwright's own screenshot in WebKit injects a stylesheet the site's CSP refuses (production the same): that
    // message, while a screenshot is being taken, is the tool's, not the game's; anything else counts
    page.on("pageerror", (e) => errs.push("page error: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !(page.__shooting && /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'/.test(m.text()))) errs.push("console: " + m.text()); });
    await page.goto(url); const ok = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 }).then(() => true, () => false); return { ctx, page, errs, ok }; };

  // three fresh loads: the same pixels every time
  const runs = [];
  let rep = null, keep = null;
  for (let r = 0; r < 3; r++) {
    const L = await load(`http://127.0.0.1:${port}/?debug=1&step=1#island`);
    const v = L.ok ? await L.page.evaluate(() => window.__island.preview()) : null, d = L.ok ? await L.page.evaluate(DIGEST) : null;
    const td = L.ok ? await L.page.evaluate(() => window.__island.terrainDigest()) : null;
    runs.push({ ok: L.ok && !L.errs.length, ms: v && v.groundMs, phases: v && v.paintMs, paints: v && v.paints, d, td, errs: L.errs });
    if (r === 0 && L.ok) { rep = await L.page.evaluate(() => window.__island.painterReport()); keep = L; } else await L.ctx.close();
  }
  const r0 = runs[0];
  check(name, "the ground paints once, 2400 x 1920, with no error, three times over", runs.every((r) => r.ok && r.paints === 1 && r.d && r.d.w === 2400 && r.d.h === 1920), runs.map((r) => `${r.d ? r.d.w + " x " + r.d.h : "?"} in ${r.ms} ms${r.errs.length ? " " + r.errs.join("; ") : ""}`).join(", "));
  const shas = runs.map((r) => r.d && r.d.sha);
  check(name, "repeatable: three fresh paints give the same RGBA", shas.every((x) => x && x === shas[0]), `sha256 ${shas.join(", ")}`);
  DIG[name] = shas[0];
  const tds = runs.map((r) => r.td);
  check(name, "the terrain pass is the approved B2c terrain (tools/fixtures/mapb-ground.json's terrain), every paint", tds.every((x) => x === GROUND_FIXTURE.rgbaSha256),
    `fixture ${GROUND_FIXTURE.stage} ${GROUND_FIXTURE.rgbaSha256}${tds.every((x) => x === GROUND_FIXTURE.rgbaSha256) ? "" : `; terrain painted ${tds.join(", ")}`}`);
  check(name, FINAL_FIXTURE ? "the finished ground (terrain and features) is the approved one" : "the finished ground (terrain and features): measured, its fixture waits for approval", FINAL_FIXTURE ? shas.every((x) => x === FINAL_FIXTURE.rgbaSha256) : true,
    FINAL_FIXTURE ? `fixture ${FINAL_FIXTURE.stage} ${FINAL_FIXTURE.rgbaSha256}` : `ground ${shas[0]}`);
  if (keep) { const pd = await keep.page.evaluate(DIGEST, true); const fc = await keep.page.evaluate(() => window.__island.painterTiles(["76,60"])[0]);
    check(name, "one feature pixel changed (px 1216,960 on the main walk, red + 1): the finished ground's digest no longer matches", pd.sha !== (FINAL_FIXTURE ? FINAL_FIXTURE.rgbaSha256 : shas[0]) && (fc.path || 0) > 0, `perturbed ${pd.sha.slice(0, 16)} vs ${(FINAL_FIXTURE ? FINAL_FIXTURE.rgbaSha256 : shas[0]).slice(0, 16)}; tile 76,60 holds ${fc.path || 0} path pixels`); }
  // the painter against the decoded map
  if (rep) {
    check(name, "every pixel looks wet exactly where the edge mask says (and GK agrees)", rep.mismatchWet === 0 && rep.mismatchGK === 0, `${rep.mismatchWet} painted wrong, ${rep.mismatchGK} GK wrong, of 4,608,000`);
    check(name, "the coast's and the waters' boundary pixels follow the edge mask", rep.edgePixels === 43589 && rep.edgeAgree === rep.edgePixels, `${rep.edgeAgree} of ${rep.edgePixels} edge-mask pixels painted as their look says`);
    check(name, "nothing pi can stand on looks like rock, a cliff, lava or water", rep.inviting === 0, `${rep.inviting} open pixels painted as rock, a face, lava or water`);
    check(name, "every cliff rim reads as rock (closed), a face only above lower land, sea faces only on blocked water", rep.rimTiles === RIM_TILES && rep.rimOpen === 0 && rep.faceNotAbove === 0 && rep.seaFaceOpen === 0,
      `${rep.rimTiles} rim tiles (B1b ${RIM_TILES}), ${rep.rimOpen} rim pixels not rock, ${rep.faceNotAbove} faces not above lower land, ${rep.seaFaceOpen} sea-face pixels pi could stand on; faces ${rep.classes.face || 0} px, sea faces ${rep.classes.seaface || 0} px`);
    const rampsOk = rep.ramps.length === 8 && rep.ramps.every((r) => r.joins > 0 && r.slopePixels > 0 && r.faceOnWalkable === 0);
    check(name, "the 8 ramps are open: their levels meet in a slope, never a face", rampsOk, rep.ramps.map((r) => `${r.id} ${r.levels.join("-")}: ${r.joins} joins, ${r.slopePixels} slope px${r.faceOnWalkable ? `, ${r.faceOnWalkable} FACE px` : ""}`).join("; "));
    check(name, "all four levels' grass is drawn", rep.grassByLevel.every((n) => n > 0), `levels 0-3: ${rep.grassByLevel.join(" / ")} px`);
    const waters = ["sea-deep", "sea-shallow", "main-river", "delta-branch", "koi-pond", "tarn", "delta-lagoon", "delta-reed-marsh"];
    check(name, "the seas, both rivers and the four still waters are each drawn as themselves", waters.every((k) => rep.water[k] > 0), waters.map((k) => `${k} ${rep.water[k] || 0}`).join(", "));
    check(name, "the volcano: scree, cone and crater lava (sealed: none of it open)", (rep.classes.scree || 0) > 0 && (rep.classes.cone || 0) > 0 && (rep.classes.lava || 0) > 0, `scree ${rep.classes.scree}, cone ${rep.classes.cone}, lava ${rep.classes.lava} px`);
    const lipT = await keep.page.evaluate((tiles) => window.__island.painterTiles(tiles), DRY_LIP_TILES);
    const lipOk = lipT.every((t) => (t.liprock || 0) + (t.seaface || 0) + (t.face || 0) > 0);
    check(name, "the 9 accepted dry-lip places (over 8 px) read as rock, not beach", lipOk, lipT.map((t) => `${t.tile}: rock ${t.liprock || 0}, wet sand ${t.wetsand || 0}, bank ${t.bank || 0}${t.seaface ? ", sea face " + t.seaface : ""}`).join("; "));
  }
  // the features against the map
  {
    const f = keep ? await keep.page.evaluate(() => window.__island.featureReport()) : null;
    if (!f) check(name, "the feature report", false, "none");
    else {
      check(name, "no path, plaza, deck, dock or pad pixel on water or on ground pi can't stand on", f.onWet === 0 && f.onBlocked === 0, `${f.onWet} on water, ${f.onBlocked} on blocked ground`);
      const gaps = f.paths.filter((q) => q.gaps), trails = f.paths.filter((q) => q.cls === "trail");
      check(name, "every corridor drawn without a gap along its authored line wherever pi can stand (28 paths, the trails among them)", f.paths.length === 28 && !gaps.length,
        `${f.paths.reduce((a, q) => a + q.samples, 0)} samples every half pixel; ${gaps.length ? gaps.map((q) => `${q.id} ${q.gaps} gaps (first at ${q.firstGap})`).join("; ") : "no gap"}; trails: ${trails.map((q) => `${q.id} ${q.samples} (${q.notOpen} over water or blocked)`).join(", ")}`);
      check(name, "the three bridges' decks drawn", f.bridges.length === 3 && f.bridges.every((b) => b.deckPixels > 0), f.bridges.map((b) => `${b.id} ${b.deckPixels} px`).join(", "));
      check(name, "the docks (quay, ferry pier, west jetty) and the helipad drawn, every dry pixel", f.docks.length === 3 && f.docks.every((d) => d.drawn === d.dry && d.dry > 0) && f.helipad && f.helipad.drawn === f.helipad.dry && f.helipad.dry === 6400,
        `${f.docks.map((d) => `${d.id} ${d.drawn}/${d.dry}`).join(", ")}; helipad ${f.helipad && f.helipad.drawn}/${f.helipad && f.helipad.dry}`);
      check(name, "both waterfalls drawn, on water only", f.falls.length === 2 && f.falls.every((q) => q.pixels > 0) && f.fallOnDry === 0, `${f.falls.map((q) => `${q.levels}: ${q.pixels} px`).join(", ")}; ${f.fallOnDry} on dry ground`);
      check(name, "no tile-shaped dirt or plank left from the terrain pass", f.leftoverDirt === 0, `${f.leftoverDirt} dirt px, ${f.leftoverWood} plank px (a bridge tile's pixels beside its deck)`);
    }
  }
  // format 1 unchanged
  {
    const L = await load(`http://127.0.0.1:${port + 1}/?debug=1&step=1#island`);
    const d = L.ok ? await L.page.evaluate(DIGEST) : null, v = L.ok ? await L.page.evaluate(() => window.__island.preview()) : null;
    check(name, "format 1's ground is unchanged (B2b's RGBA, this engine)", !!d && d.sha === F1_GROUND[name] && v.format === 1, d ? `${d.w} x ${d.h}, sha256 ${d.sha.slice(0, 16)} (B2b ${(F1_GROUND[name] || "").slice(0, 16)}), painted in ${v.groundMs} ms` : "didn't load");
    await L.ctx.close();
  }
  // review images: the whole ground, crops, the accepted places, and the game's own view round pi
  {
    const pg = keep.page;
    const imgs = await pg.evaluate(async ([crops, lipTiles, cornerTiles]) => {
      const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode();
      const crop = (x0, y0, x1, y1, s) => { const c = document.createElement("canvas"); c.width = (x1 - x0 + 1) * 16 * s; c.height = (y1 - y0 + 1) * 16 * s; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, x0 * 16, y0 * 16, (x1 - x0 + 1) * 16, (y1 - y0 + 1) * 16, 0, 0, c.width, c.height); return c; };
      const out = { "ground-full": g.png };
      for (const [nm, x0, y0, x1, y1] of crops) out[nm] = crop(x0, y0, x1, y1, 3).toDataURL();
      const sheet = (tiles, title) => { const s = 6, cw = 7 * 16 * s, ch = 7 * 16 * s, cols = 3, c = document.createElement("canvas"); c.width = cols * (cw + 16) + 16; c.height = Math.ceil(tiles.length / cols) * (ch + 40) + 50; const x = c.getContext("2d");
        x.fillStyle = "#14161c"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#eee"; x.font = "bold 18px sans-serif"; x.fillText(title, 16, 30);
        tiles.forEach((k, i) => { const [tx, ty] = k.split(",").map(Number), cx = 16 + (i % cols) * (cw + 16), cy = 50 + ((i / cols) | 0) * (ch + 40); x.drawImage(crop(tx - 3, ty - 3, tx + 3, ty + 3, s), cx, cy);
          x.strokeStyle = "#ff4fd8"; x.lineWidth = 2; x.strokeRect(cx + 3 * 16 * s, cy + 3 * 16 * s, 16 * s, 16 * s); x.fillStyle = "#ddd"; x.font = "14px sans-serif"; x.fillText(`tile ${k} (pink square)`, cx, cy + ch + 20); });
        return c.toDataURL(); };
      out["dry-lip-sites"] = sheet(lipTiles, "B2c: the 9 accepted dry-lip places (B2a, over 8 px), 6 px per world px");
      out["corner-water-sites"] = sheet(cornerTiles, "B2c: the 9 corner-model water places (B2b), 6 px per world px");
      return out;
    }, [CROPS, DRY_LIP_TILES, CORNER_TILES]);
    const files = [];
    for (const [nm, u] of Object.entries(imgs)) { const f = join(OUT, `${name}-${nm}.png`); writeFileSync(f, Buffer.from(u.split(",")[1], "base64")); files.push(f); }
    await keep.ctx.close();
    // the game, live, round pi (1280 x 800), and the frame times while walking
    const L = await load(`http://127.0.0.1:${port}/?debug=1&islandhour=11#island`);
    await L.page.waitForTimeout(2600);
    for (const [nm, t] of PLACES) { await L.page.evaluate(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), t); await L.page.waitForTimeout(900); const f = join(OUT, `${name}-game-${nm}.png`); L.page.__shooting = true; await L.page.screenshot({ path: f, caret: "initial" }); await L.page.waitForTimeout(50); L.page.__shooting = false; files.push(f); }
    await L.page.evaluate(() => { window.__island.teleport(79 * 16 + 8, 79 * 16 + 10); window.__island.frames(true); });
    await L.page.keyboard.down("ArrowUp"); await L.page.waitForTimeout(2500); await L.page.keyboard.up("ArrowUp");
    await L.page.keyboard.down("ArrowRight"); await L.page.waitForTimeout(2500); await L.page.keyboard.up("ArrowRight");
    const fr = await L.page.evaluate(() => ({ w: window.__island.frames(true), v: window.__island.preview() }));
    const ws = fr.w.slice().sort((a, b) => a - b), q = (f) => ws[Math.min(ws.length - 1, Math.floor(ws.length * f))];
    check(name, "walking: the ground isn't painted again; frame times measured", fr.v.paints === 1 && ws.length > 100 && L.errs.length === 0,
      `${ws.length} frames, update + render median ${q(0.5).toFixed(2)} ms, p95 ${q(0.95).toFixed(2)} ms, max ${ws[ws.length - 1].toFixed(2)} ms; paints ${fr.v.paints}${L.errs.length ? "; " + L.errs.join("; ") : ""}`);
    check(name, "paint measured (one time, by phase); ground canvas 2400 x 1920, about 17.6 MiB", true,
      `${r0.ms} ms (setup ${r0.phases.setup.toFixed(0)}, pixels ${r0.phases.pixels.toFixed(0)}, lip ${r0.phases.lip.toFixed(0)}, faces ${r0.phases.faces.toFixed(0)}, features ${(r0.phases.features || 0).toFixed(0)}, put ${r0.phases.put.toFixed(0)}); runs ${runs.map((r) => r.ms).join(", ")} ms; RGBA 2400 x 1920 x 4 = 18,432,000 bytes`);
    await L.ctx.close();
    check(name, "review images written (ignored)", true, files.map((f) => f.replace(ROOT + "/", "")).join(", "));
  }
  pv.close(); plain.close(); await browser.close();
}
{ const e = Object.keys(DIG); if (e.length > 1) { const same = e.every((k) => DIG[k] === DIG[e[0]]); check(e.join("+"), "every engine paints the same RGBA", same, e.map((k) => `${k} ${DIG[k] && DIG[k].slice(0, 16)}`).join(", ")); } }
console.log(fails ? `${fails} failed` : `nothing failed${blocked.length ? "; blocked: " + blocked.join(", ") : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
