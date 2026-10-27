#!/usr/bin/env node
/* mapb-creatures (MAP-B B3e1 to B3e4): the creature migration. B3e4 adds format 1's two parasaurolophus (roam-05, roam-06, the delta
   wetland), after roam-04 in format 1's order, the 36 earlier records as they were. Their wetland blocks a few of format 1's straight
   walks (the river bank's foot pixels): measured with the game's own move(), no place a walk can end strands them, and in the game every
   blocked walk is followed by a new target. B3e3 adds format 1's herd (roam-04: a stegosaur, two triceratops and
   an ankylosaur sharing one roam area, so they drift together, on the riverlands range) and its dilophosaur (roam-08, the dilo strip);
   the two records sit before roam-09 (format 1's order) and the 32 earlier records are as they were. Then the two brachiosaurs
   (roam-00, roam-01, the brachio meadow), first of all, the 34 before them as they were, once the game settles the camera's shake
   where the volcano's update (which settled it) doesn't run: their footfalls' shake, the seal's, and format 1's (decayed once a
   frame, exactly as before) are checked, and their sprites against the meadow's edges. Every check runs for all eight kinds, with
   the herd's sharing and drifting checked as format 1's. B3e2 adds format 1's four gallimimus (roam-11 to roam-14, the galli
   meadow) and five compsognathus (roam-15 to roam-19, the village gardens), with their bolting from pi; every check below runs for
   all three species, and B3e1's pachycephalosaurs keep theirs. B3e1: the creature migration's foundation. The content layer gains roam areas (kind roam: format 1's roam
   area ids, B3a's approved boxes, habitats and spawns, in format 1's order; no collision, nothing drawn), and the content preview
   runs the creature system for exactly the creatures its roam areas hold: format 1's pair of pachycephalosaurs (roam-09 and
   roam-10) on the pachy heath. Every other creature stays off. Then, as a test-only simulation (never in the content file), the
   predators B3e2 would bring: the T. rex (roam-02) and the three raptors (roam-03) in their B3d1 and B3d2 enclosures.

   1. Node: the content file and its compiler (the 21 earlier records byte for byte, then the two roam areas; 288 tiles, the
      layer unchanged); format 1's creatures (the inventory: 33 spawns, 28 roam areas, the sharing graph) against B3a's plan
      (ROAM_PLAN: every roam area's kinds and order as format 1's); the pachy heath (the spawns, the targets, straight walks);
      malformed roam records each caught by its rule.
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch):
      - production's 33 creatures as before; the terrain preview without any; the content preview's two pachycephalosaurs and
        nothing else (no cats, T. rex, raptors, herd, rex, birds, koi, bots); both painter digests;
      - spawns, a long seeded run (feet never on a solid pixel, always in the box, always on ground they may walk), head-butts,
        night sleep and waking, repeatability (the same seed, the same walk), pushes into the obstacles round the heath;
      - [E] and the card, a tap on one, phones; storage; completeness; decoder refusals; code mutations (Chromium); performance;
      - the predators' feasibility (simulation only): containment over long seeded runs with pi walking the fences and the lane,
        targets outside the enclosures, stalls, and how far the art reaches past the fences;
      - review screenshots (not baselines) into tools/out/mapb/b3e1/.

     node tools/mapb-creatures.mjs
     ENGINES=chromium node tools/mapb-creatures.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { execSync } from "node:child_process";
import { PNG } from "pngjs";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, compileContent, ContentError, ROAM_PLAN, CREATURE_KINDS as KINDS_C, creatureMayStand, habitatMask } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3e4");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const sha = (o) => createHash("sha256").update(typeof o === "string" ? o : JSON.stringify(o)).digest("hex");
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
// js/world.js as committed with B3e2 (e3e3699), before B3e3 settled the shake without the volcano: the shake's baseline
const OLD_WORLD = execSync("git show e3e36995857936469fe5ea3a828f10a3ffb08d9e:js/world.js", { cwd: ROOT, maxBuffer: 1 << 26 }).toString();

/* B3a's approved placements for the migrated creatures (section 3 of the plan), written out so a change anywhere shows, in format 1's
   order: B3e3's brachiosaurs and herd, B3e4's parasaurolophus, B3e3's dilophosaur, B3e1's pachycephalosaurs, B3e2's gallimimus and compsognathus. The herd's four share one roam
   area (roam-04: one object, as in format 1); every other roam id is its own area (one box, separate objects, as in format 1) */
const POPS = [
  { key: "brachio", name: "brachiosaur", batch: "B3e3", box: [12, 33, 27, 50], habitat: "brachio-meadow", roams: ["roam-00", "roam-01"], spawns: [[16, 38], [22, 46]], targets: 244 },
  { key: "herd", name: "herd", batch: "B3e3", box: [41, 43, 57, 60], habitat: "riverlands-range", roams: ["roam-04", "roam-04", "roam-04", "roam-04"], kinds: ["stego", "trike", "trike", "ankylo"], spawns: [[44, 46], [50, 47], [54, 55], [45, 58]], targets: 260, shared: true },
  { key: "para", name: "parasaurolophus", batch: "B3e4", box: [14, 71, 22, 80], habitat: "delta-wetland", roams: ["roam-05", "roam-06"], spawns: [[20, 73], [16, 77]], targets: 43, wetland: true, apart: [[21, 73], [14, 79], [21, 78], [14, 77]] },
  { key: "dilo", name: "dilophosaur", batch: "B3e3", box: [89, 14, 95, 21], habitat: "dilo-strip", roams: ["roam-08"], spawns: [[91, 17]], targets: 56 },
  { key: "pachy", name: "pachycephalosaur", batch: "B3e1", box: [36, 15, 45, 22], habitat: "pachy-heath", roams: ["roam-09", "roam-10"], spawns: [[38, 18], [42, 19]], targets: 69 },
  { key: "galli", name: "gallimimus", batch: "B3e2", box: [85, 41, 95, 48], habitat: "galli-meadow", roams: ["roam-11", "roam-12", "roam-13", "roam-14"], spawns: [[87, 43], [90, 42], [93, 45], [86, 47]], targets: 88, bolt: 64 },
  { key: "compy", name: "compsognathus", batch: "B3e2", box: [27, 91, 33, 96], habitat: "village-gardens", roams: ["roam-15", "roam-16", "roam-17", "roam-18", "roam-19"], spawns: [[29, 92], [30, 93], [28, 94], [31, 92], [27, 93]], targets: 42, bolt: 48 }
];
POPS.forEach((P) => { if (!P.kinds) P.kinds = P.spawns.map(() => P.key); });
const HEATH = POPS.find((P) => P.key === "pachy");
const ALL = POPS.flatMap((P) => P.spawns.map((sp, i) => ({ kind: P.kinds[i], at: sp, roam: P.roams[i], box: P.box, pop: P.key })));   // the content preview's creatures, in order
const KINDS = [...new Set(ALL.map((q) => q.kind))];   // brachio, stego, trike, ankylo, para, dilo, pachy, galli, compy
const NAME = { para: "parasaurolophus", brachio: "brachiosaur", stego: "stegosaur", trike: "triceratops", ankylo: "ankylosaur", dilo: "dilophosaur", pachy: "pachycephalosaur", galli: "gallimimus", compy: "compsognathus" };
const ROAMS = [...new Set(ALL.map((q) => q.roam))];
const ixOf = (f) => ALL.map((q, i) => f(q) ? i : -1).filter((i) => i >= 0);
const NA = ALL.length, NAREAS = ROAMS.length, AN = (k) => (/^[aeiou]/.test(NAME[k]) ? "an " : "a ") + NAME[k];
// the herd drifts together in format 1 (below), and a herd-mate's target can lie a little past the box: held to a tile and a half
const HERD_SLACK = 1.5, herdIx = ixOf((q) => q.pop === "herd");

/* ════════ 1. Node ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && t.current, `${Buffer.byteLength(built.text)} bytes`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// B3d4b's 21 compiled records, as committed at 7588290
const TWENTY_ONE = "7dcfe507a5c57db3daf45c0c412ea8238dc78fd926c98c58f81b4205bd7e39a8";
// B3e1's 23 (those and its two roam areas), as committed at e231b62
const TWENTY_THREE = "d80de2e654ddf7512663861b17a8ad44e83445628e137f1bb09649cb1a8f7f93";
// B3e2's 32 (those and its nine), as committed at e3e3699
const THIRTY_TWO = "b1187ae327e007d1633bb0be607669a2e8aaed4f9c6327f5a1920682fde93b22";
// B3e3's first 34 (those, the herd's roam-04 and roam-08), as reported for review before the brachiosaurs
const THIRTY_FOUR = "f3c1e91ab8e0c32fb288fd1ba15203fa72a1d75631acb3d5c9f4b1e95a4b4dca";
// B3e3's 36 (those and the brachiosaurs' roam-00 and roam-01), as committed at f0b2bca
const THIRTY_SIX = "cdd879883873e3ed792f8c574898a6c253b498237ba5e27598974207aeecdb54";
const PARA = ["roam-05", "roam-06"], NEW3 = ["roam-00", "roam-01", "roam-04", "roam-08", ...PARA], EARLIER = DATA.records.filter((r) => !NEW3.includes(r.id));
check("node", "the content: B3c's to B3d4b's 21 records, B3e1's two roam areas, B3e2's nine and B3e3's four (roam-00, roam-01, roam-04, roam-08) exactly as committed (byte for byte, in their order), with B3e4's parasaurolophus (roam-05, roam-06) after roam-04 in format 1's order; nothing else",
  sha(DATA.records.slice(0, 21)) === TWENTY_ONE && sha([...DATA.records.slice(0, 21), ...EARLIER.filter((r) => r.id === "roam-09" || r.id === "roam-10")]) === TWENTY_THREE && sha(EARLIER) === THIRTY_TWO &&
    sha(DATA.records.filter((r) => !["roam-00", "roam-01", ...PARA].includes(r.id))) === THIRTY_FOUR && sha(DATA.records.filter((r) => !PARA.includes(r.id))) === THIRTY_SIX && DATA.records.length === 38 &&
    DATA.records.slice(21).map((r) => `${r.id}:${r.kind}`).join() === ROAMS.map((id) => `${id}:roam`).join(), DATA.records.slice(21).map((r) => r.id).join(", "));
const PAST = contentLayers(RECS.slice(0, 21), W, H);
let sameLayer = PAST.solidTiles === LAYER.solidTiles; for (let i = 0; sameLayer && i < W * H; i++) if (PAST.tiles[i] !== LAYER.tiles[i]) sameLayer = false;
check("node", "the content passes every rule; 288 solid tiles and no foot pixel, B3d4b's layer tile for tile: roam areas add no collision", contentProblems(RECS, src, m).length === 0 && built.compiled.solidTiles === 288 && built.compiled.footPixels === 0 && sameLayer, `${built.compiled.solidTiles} tiles`);
// format 1's creatures, the inventory
const F1 = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); return c.window.ISLAND_MAPS.home; })();
const f1Kinds = {}; F1.spawns.forEach((s) => { f1Kinds[s.kind] = (f1Kinds[s.kind] || 0) + 1; });
check("node", "format 1 (js/maps/home.js): 33 creatures in 28 roam areas (the inventory), its kinds the game's CREATURE_KINDS, and the compiler's the same (rex, his own system, apart)",
  F1.spawns.length === 33 && F1.regions.roamAreas.length === 28 && JSON.stringify(KINDS_C) === JSON.stringify(JSON.parse((WORLD.match(/var CREATURE_KINDS = (\[[^\]]*\])/) || [])[1])) && Object.keys(f1Kinds).every((k) => KINDS_C.includes(k)),
  Object.entries(f1Kinds).map(([k, n]) => `${k} ${n}`).join(", "));
{ // B3a's plan against format 1: every roam id, its creatures' kinds and order (so the sharing graph is format 1's)
  const f1By = {}; F1.spawns.forEach((s) => { (f1By[s.roam] = f1By[s.roam] || []).push(s.kind); });
  const bad = Object.keys(ROAM_PLAN).filter((id) => JSON.stringify(ROAM_PLAN[id].spawns.map((q) => q.creature)) !== JSON.stringify(f1By[id] || []));
  const ids = Object.keys(ROAM_PLAN), f1ids = F1.regions.roamAreas.map((r) => r.id);
  check("node", "B3a's plan (ROAM_PLAN): format 1's 28 roam ids in order, each with format 1's creatures, kinds and order (the raptors' one shared area, the herd's one; matching boxes elsewhere separate objects)",
    JSON.stringify(ids) === JSON.stringify(f1ids) && bad.length === 0 && Object.values(ROAM_PLAN).reduce((n, q) => n + q.spawns.length, 0) === 33, bad.join(", ") || "all 28");
}
// each population: its records against the plan and format 1, its spawns, its targets, straight walks between them
const may = (k, x, y) => { const i = y * W + x; return m.coll[i] === 0 && !LAYER.tiles[i] && creatureMayStand(k, m.ground[i]); };
const aimWet = (x, y) => { let n = 0; const fx = x * T + 8, fy = y * T + 10; for (let py = fy - 2; py <= fy + 1; py++) for (let px = fx - 4; px <= fx + 4; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (const P of POPS) {
  const HM = habitatMask(src, P.habitat, W, H), [bx0, by0, bx1, by1] = P.box, boxTiles = []; for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) boxTiles.push([x, y]);
  const targets = boxTiles.filter(([x, y]) => P.kinds.every((k) => may(k, x, y))), inHab = boxTiles.filter(([x, y]) => HM[y * W + x]);
  const notOk = boxTiles.filter(([x, y]) => !P.kinds.every((k) => may(k, x, y))).map(([x, y]) => `${x},${y}:${m.coll[y * W + x] ? "coll" + m.coll[y * W + x] : "ground" + m.ground[y * W + x]}`);
  for (const id of [...new Set(P.roams)]) {
    const r = RECS.find((q) => q.id === id), mine = P.roams.map((q, i) => q === id ? i : -1).filter((i) => i >= 0), f1 = F1.spawns.filter((q) => q.roam === id);
    const want = mine.map((i) => ({ creature: P.kinds[i], at: P.spawns[i] })), says = want.map((q) => `${NAME[q.creature]} ${q.at.join(",")}`).join("; ");
    check("node", `${id} (${P.batch}): a roam area at B3a's box ${P.box.join(",")} in the B1e habitat ${P.habitat}, holding ${says} (format 1's: ${f1.map((q) => q.kind + " " + q.at).join("; ")}, box ${F1.regions.roamAreas.find((q) => q.id === id).box.join(",")}${mine.length > 1 ? "; one area its " + mine.length + " share, not " + mine.length + " areas" : ""}); no collision, nothing drawn; exactly the plan's`,
      r && r.kind === "roam" && r.box.join() === P.box.join() && r.habitat === P.habitat && JSON.stringify(r.spawns) === JSON.stringify(want) && f1.length === mine.length && f1.every((q, j) => q.kind === want[j].creature) && !r.tiles.length && !r.drawnPxBoxes.length && JSON.stringify(r.spawns) === JSON.stringify(ROAM_PLAN[id].spawns));
    for (const { creature: k, at: [sx, sy] } of want)
      check("node", `${id}: its ${NAME[k]}'s spawn ${sx},${sy} is open grass (a tile it may stand on), its feet clear of every foot-blocking pixel, inside the habitat`, may(k, sx, sy) && !aimWet(sx, sy) && HM[sy * W + sx] === 1);
  }
  let blockedWalks = 0; for (let i = 0; i < 2000; i++) { const a = targets[(rnd() * targets.length) | 0], c = targets[(rnd() * targets.length) | 0]; const ax = a[0] * T + 8, ay = a[1] * T + 10, cx = c[0] * T + 8, cy = c[1] * T + 10, d = Math.hypot(cx - ax, cy - ay), st = Math.max(1, Math.ceil(d / 2)); for (let j = 0; j <= st; j++) { const px = ax + (cx - ax) * j / st, py = ay + (cy - ay) * j / st; if (m.coll[Math.floor(py / T) * W + Math.floor(px / T)] !== 0 || m.px.foot[Math.floor(py) * PW + Math.floor(px)]) { blockedWalks++; break; } } }
  if (!P.wetland) check("node", `${P.habitat}: ${targets.length} of its ${boxTiles.length} box tiles are ground a ${P.name} may walk to (the others: ${notOk.length}), ${inHab.length} inside the habitat; every straight walk between two of them (2,000 tried) crosses only walkable ground (format 1's wander walks straight)`, targets.length === P.targets && blockedWalks === 0, notOk.length ? `not theirs: ${notOk.join(" ")}` : "all");
  else {
    // the wetland (B3e4): walked with the game's own move() (9 x 4 px feet, x then y, each axis stopping on a solid pixel, 12 px/s), every pair
    // of targets; then from every place a walk can end (the targets and each blocked walk's stop), how many targets a straight walk reaches
    const solidPx = (px, py) => { const tx = Math.floor(px / T), ty = Math.floor(py / T), i = ty * W + tx; return tx < 0 || ty < 0 || tx >= W || ty >= H || m.coll[i] !== 0 || LAYER.tiles[i] || !!m.px.foot[Math.floor(py) * PW + Math.floor(px)]; };
    const walkTo = (ax, ay, bx, by) => { const o = { x: ax, y: ay }; for (let f = 0; f < 3000; f++) { const dx = bx - o.x, dy = by - o.y, dd = Math.hypot(dx, dy); if (dd < 2) return { ok: true, o }; const st = 0.2, x0 = o.x, y0 = o.y, mx = dx / dd * st, my = dy / dd * st;
      if (!solidPx(o.x + mx + (mx > 0 ? 4 : -4), o.y - 2) && !solidPx(o.x + mx + (mx > 0 ? 4 : -4), o.y + 1)) o.x += mx; if (!solidPx(o.x - 4, o.y + my + (my > 0 ? 1 : -2)) && !solidPx(o.x + 4, o.y + my + (my > 0 ? 1 : -2))) o.y += my;
      if (Math.hypot(o.x - x0, o.y - y0) < 0.01) return { ok: false, o }; } return { ok: false, o }; };
    const px = (q) => [q[0] * T + 8, q[1] * T + 10], stops = new Map(targets.map((q) => [q.join(), px(q)])); let pairs = 0, bad = 0; const at = {};
    for (const a of targets) for (const c of targets) { if (a === c) continue; pairs++; const r = walkTo(...px(a), ...px(c)); if (!r.ok) { bad++; stops.set(r.o.x.toFixed(1) + "," + r.o.y.toFixed(1), [r.o.x, r.o.y]); const k = Math.floor(r.o.x / T) + "," + Math.floor(r.o.y / T); at[k] = (at[k] || 0) + 1; } }
    const reach = [...stops.values()].map(([x, y]) => targets.filter((c) => walkTo(x, y, ...px(c)).ok).length), least = Math.min(...reach);
    check("node", `${P.habitat}: ${targets.length} of its ${boxTiles.length} box tiles are open grass a ${P.name} may walk to (the rest: the lagoon, the river, its banks, the path, sand), ${inHab.length} inside the habitat; walked with the game's own move(), a few straight walks between them stop on the river bank's foot pixels (under 5%), and no place a walk can end strands it (from each, at least half the targets in a straight walk)`,
      targets.length === P.targets && bad / pairs < 0.05 && least >= targets.length / 2, `${bad} of ${pairs} walks stop (${(100 * bad / pairs).toFixed(1)}%), at ${Object.entries(at).map((e) => e.join(" x")).join(", ")}; ${stops.size} places a walk can end, the least reaching ${least} targets (the line sampler: ${blockedWalks} of 2,000)`);
  }
}
// the brachiosaurs' art against the meadow's edges: every frame of the sheet (walk, idle, blink, graze), facing either way, drawn as drawArt
// draws it (centred on the feet, bottom on them), on every target along each edge of the box: its opaque pixels over a tile that isn't open
// ground (the west cliff, the north-west corner's cliff) or over water. Held to what was measured and reviewed (B3e3): the tail's tip over
// the west cliff (6 px), the lowered head over the north-west corner's cliff when it grazes facing west (63 px, 2.3%); nothing east or south
{ const SH = JSON.parse(WORLD.match(/var SHEET = (\{.*?\});\n/)[1]).brachio, png = PNG.sync.read(readFileSync(join(ROOT, "assets/island/dinos.png"))), aw = SH.w, ah = SH.h;
  const masks = SH.f.map(([sx, sy]) => { const a = new Uint8Array(aw * ah); for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) a[y * aw + x] = png.data[((sy + y) * png.width + sx + x) * 4 + 3] > 0 ? 1 : 0; return a; });
  const opaque = Math.max(...masks.map((a) => a.reduce((q, v) => q + v, 0)));
  const P = POPS.find((q) => q.key === "brachio"), [x0, y0, x1, y1] = P.box, res = {};
  const bad = (tx, ty) => tx < 0 || ty < 0 || tx >= W || ty >= H || m.coll[ty * W + tx] !== 0 || LAYER.tiles[ty * W + tx] || [0, 1, 5, 9].includes(m.ground[ty * W + tx]);
  for (const [edge, tiles] of [["west", Array.from({ length: y1 - y0 + 1 }, (_, i) => [x0, y0 + i])], ["north", Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y0])], ["east", Array.from({ length: y1 - y0 + 1 }, (_, i) => [x1, y0 + i])], ["south", Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y1])]]) {
    let worst = 0, at = null, n = 0, any = 0;
    for (const [tx, ty] of tiles) { if (!may("brachio", tx, ty)) continue; n++; const dx = Math.round(tx * T + 8 - aw / 2), dy = Math.round(ty * T + 10 - ah + 1); let w0 = 0;
      for (const a of masks) for (const flip of [0, 1]) { let over = 0; for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (a[y * aw + (flip ? aw - 1 - x : x)] && bad(Math.floor((dx + x) / T), Math.floor((dy + y) / T))) over++; w0 = Math.max(w0, over); }
      if (w0) any++; if (w0 > worst) { worst = w0; at = [tx, ty]; } }
    res[edge] = { n, worst, at, any };
  }
  check("node", `the brachiosaurs' art on the meadow's edges (every frame of the sheet, either facing, on every target along each edge; ${opaque} opaque px a frame at most): its pixels over a cliff or water held to what was reviewed (west and north at most 63 px, 2.3%, at the north-west corner; east and south none)`,
    res.west.n && res.north.n && res.east.n && res.south.n && res.west.worst <= 63 && res.north.worst <= 63 && res.east.worst === 0 && res.south.worst === 0,
    Object.entries(res).map(([e, q]) => `${e} (${q.n} targets, ${q.any} with any): at most ${q.worst} px${q.at ? " at " + q.at.join(",") : ""}`).join("; "));
}
// malformed roam records, each alone
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const RR = (o, id) => o.records.find((r) => r.id === id);
const BAD = [
  ["a roam area that isn't format 1's (roam-30)", "creatures", (o) => { RR(o, "roam-10").id = "roam-30"; }, /isn't/],
  ["roam-09's box moved a tile", "creatures", (o) => { RR(o, "roam-09").box.x0 = 37; }, /approved box/],
  ["roam-09 in another habitat", "creatures", (o) => { RR(o, "roam-09").habitat = "dilo-strip"; }, /approved habitat/],
  ["roam-09 with no habitat", "creatures", (o) => { delete RR(o, "roam-09").habitat; }, /approved habitat/],
  ["roam-09's pachycephalosaur moved a tile", "creatures", (o) => { RR(o, "roam-09").spawns[0].at = [39, 18]; }, /approved spawns/],
  ["roam-09 holding a gallimimus", "creatures", (o) => { RR(o, "roam-09").spawns[0].creature = "galli"; }, /approved spawns/],
  ["roam-09 with a second pachycephalosaur", "creatures", (o) => { RR(o, "roam-09").spawns.push({ creature: "pachy", at: [40, 20] }); }, /approved spawns/],
  ["roam-10 before roam-09", "creatures", (o) => { const a = o.records.findIndex((r) => r.id === "roam-09"); const [r] = o.records.splice(a, 1); o.records.push(r); }, /format 1's order/],
  ["roam-08 after roam-19 (appended, not in format 1's order)", "creatures", (o) => { const a = o.records.findIndex((r) => r.id === "roam-08"); const [r] = o.records.splice(a, 1); o.records.push(r); }, /format 1's order/],
  ["the herd split: its ankylosaur in an area of its own (roam-20)", "creatures", (o) => { const r = RR(o, "roam-04"), a = r.spawns.pop(); o.records.push({ id: "roam-20", kind: "roam", box: copy(r.box), habitat: r.habitat, spawns: [a] }); }, /roam-04: its approved spawns/],
  ["the herd in another order (a triceratops first)", "creatures", (o) => { const r = RR(o, "roam-04"); [r.spawns[0], r.spawns[1]] = [r.spawns[1], r.spawns[0]]; }, /roam-04: its approved spawns/],
  ["the herd short of its ankylosaur", "creatures", (o) => { RR(o, "roam-04").spawns.pop(); }, /roam-04: its approved spawns/],
  ["roam-08's dilophosaur moved a tile", "creatures", (o) => { RR(o, "roam-08").spawns[0].at = [92, 17]; }, /roam-08: its approved spawns/],
  ["roam-04's box shrunk a tile", "creatures", (o) => { RR(o, "roam-04").box.x1 = 56; }, /roam-04: its approved box/],
  ["a roam area with collision", "schema", (o) => { RR(o, "roam-09").solid = { tiles: [[38, 18]] }; }, /blocks nothing/],
  ["a roam area with a drawn box", "schema", (o) => { RR(o, "roam-09").drawnPxBoxes = [{ px0: 608, py0: 288, px1: 623, py1: 303 }]; }, /draws nothing/],
  ["a roam area with art", "schema", (o) => { RR(o, "roam-09").art = "placeholder"; }, /no art/],
  ["a roam area with no spawns", "schema", (o) => { RR(o, "roam-09").spawns = []; }, /is empty/],
  ["a creature that isn't the game's (a unicorn)", "schema", (o) => { RR(o, "roam-09").spawns[0].creature = "unicorn"; }, /isn't one of the game's creatures/],
  ["rex as a roam area's creature (he is his own system)", "schema", (o) => { RR(o, "roam-09").spawns[0].creature = "rex"; }, /isn't one of the game's creatures/],
  ["a spawn off the map", "schema", (o) => { RR(o, "roam-09").spawns[0].at = [150, 18]; }, /at x must be/],
  ["a box off the map", "schema", (o) => { RR(o, "roam-09").box.x1 = 150; }, /x1 must be/],
  ["a station with spawns", "schema", (o) => { RR(o, "sign").spawns = [{ creature: "pachy", at: [74, 77] }]; }, /only a roam area has/],
  ["a prop with a box", "schema", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [{ px0: 480, py0: 480, px1: 495, py1: 495 }], solid: { tiles: [[30, 30]] }, box: { x0: 30, y0: 30, x1: 31, y1: 31 } }); }, /only a roam area has/],
  ["a prop named roam-20", "creatures", (o) => { o.records.push({ id: "roam-20", kind: "prop", drawnPxBoxes: [{ px0: 30 * 16, py0: 70 * 16, px1: 30 * 16 + 15, py1: 70 * 16 + 15 }], solid: { tiles: [[30, 70]] } }); }, /the id is a roam area's/],
  ["a crate on roam-09's spawn", "creatures", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [{ px0: 38 * 16, py0: 18 * 16, px1: 38 * 16 + 15, py1: 18 * 16 + 15 }], solid: { tiles: [[38, 18]] } }); }, /may not stand on \(solid content\)/]
];
for (const [label, rule, fn, re] of BAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.map((q) => [q[0], q[1]]); }
  catch (e) { caught = e instanceof ContentError ? [[e.rule, e.message]] : [["error", e.message]]; }
  const hit = caught.find((q) => q[0] === rule && re.test(q[1]));
  check("node", `malformed: ${label} is caught by rule ${rule}`, !!hit, hit ? hit[1].slice(0, 110) : caught.map((q) => q.join(": ")).join(" | ").slice(0, 220) || "NOT caught");
}
// every other approved roam area compiles under the rules too (B3e2 onward), alone and all together: the plan holds on the island as built
// (one known conflict, found here and left for its batch: B3a's spino spawn, 40,34, stands on the river bank's foot-blocking pixels, which
// B3a's probe didn't look at; the rule isn't loosened and the spawn isn't moved)
const withPlan = (ids) => realWith((o) => { o.records = o.records.filter((r) => r.kind !== "roam"); for (const id of ids) o.records.push({ id, kind: "roam", box: ROAM_PLAN[id].box, ...(ROAM_PLAN[id].habitat ? { habitat: ROAM_PLAN[id].habitat } : {}), spawns: ROAM_PLAN[id].spawns }); });
{ const ids = Object.keys(ROAM_PLAN).filter((id) => id !== "roam-07");
  let msg = null; try { compileContent(withPlan(ids), src, m); } catch (e) { msg = e.message; }
  check("node", "B3a's plan, the other 27 roam areas and 32 creatures added together (in memory only, never written): every spawn passes the creatures rule on the island as built (the walls, fences and stations in place)", msg === null, msg || "27 compile");
  let m7 = null; try { compileContent(withPlan(["roam-07"]), src, m); } catch (e) { m7 = e.message; }
  check("node", "B3a's plan, the known conflict recorded: roam-07's spino spawn (40,34) is refused, its feet on the river bank's foot-blocking pixels (a decision for its batch: the rule isn't loosened, the spawn isn't moved)", /roam-07: its spino starts at 40,34 with \d+ foot-blocking pixels under its feet/.test(m7 || ""), m7 || "not refused");
}

/* the predators' enclosures (Part 3, Node): the T. rex's box against its paddock's inside, the raptors' against the yard's */
const FENCE = { "holding-paddock": RECS.find((r) => r.id === "holding-paddock"), "raptor-yard": RECS.find((r) => r.id === "raptor-yard") };
const inner = (id) => new Set(FENCE[id].inner.map(([x, y]) => `${x},${y}`));
const PRED = [["roam-02", "holding-paddock", "trex"], ["roam-03", "raptor-yard", "raptor"]];
for (const [id, fence, kind] of PRED) {
  const P = ROAM_PLAN[id], b = P.box, inn = inner(fence), out = [], fenceIn = [];
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { if (LAYER.tiles[y * W + x]) fenceIn.push(`${x},${y}`); else if (may(kind, x, y) && !inn.has(`${x},${y}`)) out.push(`${x},${y}`); }
  const spIn = P.spawns.every((q) => inn.has(q.at.join()));
  notes.push(`node: ${id} (${kind}) box ${b.x0},${b.y0} to ${b.x1},${b.y1} in ${fence} (inside ${inn.size} tiles): spawns inside ${spIn}; ${fenceIn.length} fence tiles in the box; ${out.length} tiles it may walk to OUTSIDE the enclosure: ${out.join(" ") || "none"}`);
  check("node", `predators (not activated): ${id}'s ${P.spawns.length} ${kind} spawn(s) inside the ${fence} (${inn.size} tiles)`, spIn);
}

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const REFUSE = [
  ["a roam area that isn't format 1's", (c) => { DR(c, "roam-10").id = "roam-31"; }, /^content record roam-31 is a roam area, and roam-31 isn't one of format 1's/],
  ["a roam area with a solid tile", (c) => { DR(c, "roam-09").tiles = [[38, 18]]; c.solidTiles++; }, /^content record roam-09 is a roam area: it blocks nothing and draws nothing \(tiles must be empty\)$/],
  ["a roam area with art", (c) => { DR(c, "roam-09").art = "placeholder"; }, /^content record roam-09\.art: a roam area has no art$/],
  ["a roam area with no spawns", (c) => { DR(c, "roam-09").spawns = []; }, /has no spawns/],
  ["a creature that isn't the game's", (c) => { DR(c, "roam-09").spawns[0].creature = "unicorn"; }, /isn't one of the game's creatures/],
  ["a spawn outside its box", (c) => { DR(c, "roam-09").spawns[0].at = [30, 18]; }, /outside its roam area's box/],
  ["a pachycephalosaur on the tower's base", (c) => { const r = DR(c, "roam-09"); r.box = [94, 25, 96, 28]; r.spawns[0].at = [95, 26]; }, /a tile it may not stand on/],
  ["a pachycephalosaur on a path", (c) => { const r = DR(c, "roam-09"); r.box = [94, 25, 96, 28]; r.spawns[0].at = [95, 28]; }, /a tile it may not stand on/],
  ["roam-10 before roam-09", (c) => { const a = c.records.findIndex((r) => r.id === "roam-09"); const [r] = c.records.splice(a, 1); c.records.push(r); }, /roam areas come in format 1's order/],
  ["a station with spawns", (c) => { DR(c, "sign").spawns = [{ creature: "pachy", at: [74, 77] }]; }, /only a roam area has a box, a habitat and spawns/]
];
const MUT = {
  off: ["the creatures left off in the content preview", (s) => s.replace("creatures: all || (CONTENT_PREVIEW && MAP.spawns.length > 0),", "creatures: all,")],
  noSpawns: ["the roam records not read into the map's spawns", (s) => s.replace("r.spawns.forEach(function (q) { D.spawns.push({ kind: q.creature, at: q.at.slice(), roam: r.id }); });", "")],
  catGuard: ["the cats named though there are none (format 1's naming, unguarded)", (s) => s.replace("if (SYS.creatures && cats.length === 2) {", "if (SYS.creatures) {")],
  noCheck: ["the decoder's roam checks removed", (s) => s.replace('if (r.kind === "roam") { roamShape(r, f); return', 'if (r.kind === "roam") { return')]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
// the predators' simulation content (test only, in memory): the real content and roam-02 and roam-03 from the plan, compiled by the rules
// inserted after roam-01 (format 1's order)
const SIM_CONTENT = (ids) => { const o = realWith((q) => { const i = q.records.findIndex((r) => r.id === "roam-01") + 1; q.records.splice(i, 0, ...ids.map((id) => ({ id, kind: "roam", box: ROAM_PLAN[id].box, habitat: ROAM_PLAN[id].habitat, spawns: ROAM_PLAN[id].spawns }))); });
  const c = compileContent(o, src, m); return { format: 2, staged: true, schema: DATA.schema, id: DATA.id, generator: DATA.generator, source: DATA.source, sourceSha256: DATA.sourceSha256, terrainSha256: DATA.terrainSha256, solidTiles: c.solidTiles, footPixels: c.footPixels, records: JSON.parse(JSON.stringify(c.records)) }; };
const PRED_CONTENT = SIM_CONTENT(["roam-02", "roam-03"]);
const SAY = {}; for (const k of KINDS) { const g = (WORLD.match(new RegExp(k + ": \\{ art: true, sp: \\d+, step: [\\d.]+, (?:graze: true, )?say: (\\[[^\\]]*\\]|\"[^\"]*\")")) || [])[1]; SAY[k] = g ? [].concat(JSON.parse(g)) : []; }
for (const k of KINDS) if (!SAY[k].length) check("node", `the game's card lines for the ${NAME[k]} found in js/world.js`, false);

const port = 9500 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), predPv = await startPreview(port + 2, { content: PRED_CONTENT }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11&seed=42#island";
const STORE = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
const STORE_JSON = JSON.stringify(Object.keys(STORE).sort().map((k) => [k, STORE[k]]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const open = async (url, { world, store, ctxOpts, wait = 0 } = {}) => {
    const ctx = await browser.newContext(ctxOpts || { viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (msg) => { if (msg.type() === "error" && !page.__shooting) errs.push(msg.text()); });
    if (store) await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, store);
    if (world) await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: world }));
    await page.goto(url, { timeout: 60000 }).catch((e) => errs.push("goto: " + e.message.split("\n")[0]));
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => true, () => false);
    if (loaded && wait) await page.waitForTimeout(wait);
    return { ctx, page, errs, loaded, I: (fn, a) => page.evaluate(fn, a) };
  };
  const shoot = async (P, f) => { P.page.__shooting = true; await P.page.screenshot({ path: join(OUT, f) }); await P.page.waitForTimeout(50); P.page.__shooting = false; };
  const hideDbg = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; });
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });
  const cardAway = async (P) => { const go = await P.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { const bb = await go.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(200); } };
  const dialog = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-dialog"); return { open: !d.hidden, name: d.querySelector(".w-name").textContent, text: d.querySelector("#w-sr").textContent }; });
  // a long run on the game's own clock: every 2 frames, each creature's feet against solid pixels and its box, its tile, what it does
  const run = (P, frames, piAt, opts = {}) => P.I(([n, pa, o]) => {
    const I2 = window.__island; if (pa) { I2.teleport(pa[0], pa[1]); I2.step(1); }
    const v0 = I2.preview().creatures, st = v0.map(() => ({ solid: 0, outBox: 0, offGround: 0, moved: 0, walking: 0, roar: 0, sleep: 0, tiles: new Set(), maxX: -1e9, minX: 1e9, maxY: -1e9, minY: 1e9 })), both = { roar: 0 };
    let path = o.path || null, pi = 0, trail = [];
    for (let f = 0; f < n; f += 2) {
      if (path) { const q = path[Math.floor(f / o.every) % path.length]; if (q !== trail[trail.length - 1]) { I2.teleport(q[0] * 16 + 8, q[1] * 16 + 10); trail.push(q); } }
      I2.step(2);
      const cs = I2.preview().creatures; let rN = 0;
      cs.forEach((c, i) => {
        const s = st[i], tx = Math.floor(c.x / 16), ty = Math.floor(c.y / 16), a = c.area;
        if (I2.blocked(c.x - 4, c.y - 2) || I2.blocked(c.x + 4, c.y - 2) || I2.blocked(c.x - 4, c.y + 1) || I2.blocked(c.x + 4, c.y + 1)) s.solid++;
        if (c.x < a[0] * 16 || c.x >= (a[2] + 1) * 16 || c.y < a[1] * 16 || c.y >= (a[3] + 1) * 16) s.outBox++;
        if (!I2.tile(tx, ty).walkable) s.offGround++;
        if (c.tx) s.walking++; if (c.roar > 0) { s.roar++; rN++; } if (c.sleep > 0) s.sleep++;
        s.tiles.add(tx + "," + ty); s.minX = Math.min(s.minX, c.x); s.maxX = Math.max(s.maxX, c.x); s.minY = Math.min(s.minY, c.y); s.maxY = Math.max(s.maxY, c.y);
      });
      if (rN >= 2) both.roar++;
    }
    const cs = I2.preview().creatures;
    return { n, st: st.map((s, i) => ({ solid: s.solid, outBox: s.outBox, offGround: s.offGround, walking: s.walking, roar: s.roar, sleep: s.sleep, tiles: [...s.tiles], box: [s.minX, s.minY, s.maxX, s.maxY].map(Math.round), dist: Math.round(cs[i].dist) })), both: both.roar, end: cs.map((c) => [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100]) };
  }, [frames, piAt, opts]);

  // 2a. production: format 1's creatures as before
  { const P = await open(`http://127.0.0.1:${port + 3}/${Q}`);
    const v = P.loaded ? await P.I(() => { window.__island.step(200); const x = window.__island.preview(); return { sys: x.sys, n: x.systems.critters, kinds: x.creatures.map((c) => c.kind), areas: x.creatures.map((c) => c.areaIx) }; }) : null;
    const f1Order = F1.spawns.map((s) => s.kind), f1Area = F1.spawns.map((s) => F1.regions.roamAreas.findIndex((r) => r.id === s.roam));
    check(name, "production: format 1's 33 creatures, in its order and kinds, each in its own roam area as format 1 shares them (the raptors one, the herd one); every system on", P.loaded && v.sys.creatures && v.n === 33 && JSON.stringify(v.kinds) === JSON.stringify(f1Order) && JSON.stringify(v.areas) === JSON.stringify(f1Area) && !P.errs.length,
      v ? `${v.n} creatures` : P.errs.join("; "));
    await P.ctx.close(); }
  // 2b. the terrain preview: none
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => window.__island.preview()) : null;
  check(name, "terrain preview: no creature, the creature system off", tp.loaded && !tp.errs.length && tv.sys.creatures === false && tv.systems.critters === 0, tv ? `${tv.systems.critters}` : "");
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST) } : null;

  // 2c. the content preview: the twenty creatures (B3e3's two brachiosaurs, herd of four and dilophosaur, B3e4's two parasaurolophus, B3e1's
  // two pachycephalosaurs, B3e2's four gallimimus and five compsognathus) and nothing else
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store: STORE });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const OFF = ["rex", "birds", "koi", "bots", "car", "rift", "volcano", "hatch"];
  const kinds = (cs) => { const o = {}; cs.forEach((c) => { o[c.kind] = (o[c.kind] || 0) + 1; }); return o; };
  const sameArea = (cs) => ALL.every((q, i) => ALL.every((r, j) => (q.roam === r.roam) === (cs[i].areaIx === cs[j].areaIx)));
  check(name, "content preview: 38 records (288 solid tiles); the creature system on (with the buildings and the stations), every other home system off; exactly twenty creatures, 2 brachiosaurs, the herd (a stegosaur, 2 triceratops, an ankylosaur), 2 parasaurolophus, a dilophosaur, 2 pachycephalosaurs, 4 gallimimus and 5 compsognathus, in format 1's order, each at its spawn; the herd's four in the one roam area they share (one object, as in format 1), every other creature in its own (17 areas); no T. rex, raptor, spinosaur, baby, robot, roomba or cat",
    cp.loaded && !cp.errs.length && cv.content.records === 38 && cv.content.solidTiles === 288 && cv.sys.creatures && cv.sys.buildings && cv.sys.stations && OFF.every((k) => cv.sys[k] === false) && cv.systems.critters === NA && NA === 20 && !cv.systems.rex && !cv.systems.car &&
      cv.creatures.every((c, i) => c.kind === ALL[i].kind && c.x === ALL[i].at[0] * 16 + 8 && c.y === ALL[i].at[1] * 16 + 10 && c.area.join() === ALL[i].box.join()) && new Set(cv.creatures.map((c) => c.areaIx)).size === NAREAS && NAREAS === 17 && sameArea(cv.creatures),
    cv ? `sys ${JSON.stringify(cv.sys)}; ${JSON.stringify(kinds(cv.creatures))}; ${JSON.stringify(cv.creatures.map((c) => [c.kind, c.x, c.y, c.areaIx]))}` : cp.errs.join("; "));
  if (cp.loaded) {
    for (const P of POPS) await cp.I(([x, y]) => { const I2 = window.__island; I2.teleport(x * 16 + 8, (y + 3) * 16 + 10); I2.step(4); }, [(P.box[0] + P.box[2]) >> 1, P.box[3]]);
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST) };
    check(name, "content preview, every creature drawn: both locked painter digests (creatures are drawn in the object layer)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && tDig.td === TERRAIN_SHA, `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const sp = await cp.I((s) => s.map(([x, y]) => { const I2 = window.__island; return I2.tile(x, y).walkable && !I2.tile(x, y).content && I2.safe(x, y) && I2.tile(x, y).type === 3; }), ALL.map((q) => q.at));
    check(name, "spawns: every creature's tile walkable, no content, safe ground, grass", sp.every(Boolean), JSON.stringify(sp));
    // a long seeded run, pi away from all of them (no player influence): ten minutes of game time
    const far = [60 * 16 + 8, 60 * 16 + 10];
    const r1 = await run(cp, 36000, far);
    // beyond the box, in tiles, from a run's feet extents (0 inside)
    const beyond = (q, b) => Math.max(b[0] * 16 - q.box[0], q.box[2] - (b[2] + 1) * 16, b[1] * 16 - q.box[1], q.box[3] - (b[3] + 1) * 16, 0) / 16;
    const line = (r) => POPS.map((P) => { const st = ixOf((q) => q.pop === P.key).map((i) => r.st[i]); return `${P.key}: ${st.map((q) => q.tiles.length).join("/")} tiles, walking ${st.map((q) => (100 * q.walking / (r.n / 2)).toFixed(0)).join("/")}%${st.some((q) => q.solid) ? ", FEET ON SOLID" : ""}${st.some((q) => q.outBox) ? ", out of the box " + st.map((q) => (100 * q.outBox / (r.n / 2)).toFixed(1) + "%").join("/") + ", at most " + Math.max(...st.map((q) => beyond(q, P.box))).toFixed(2) + " tiles beyond" : ""}`; }).join("; ");
    // format 1's herd drifts together: a grazer picking a target takes a herd-mate's (its target, 20 px and 12 px either way), and that can
    // lie a little past the box (the game's okFor checks the ground, not the box); held to a tile and a half, every other creature to its box
    check(name, `ten minutes on the game's clock (36,000 frames, pi away from all of them): every creature walks its own ground (each over many tiles), feet never on a solid pixel, never off walkable ground; never outside its box but for the herd's drifting together (at most ${HERD_SLACK} tiles past it, format 1's)`,
      r1.st.every((q, i) => q.solid === 0 && q.offGround === 0 && q.tiles.length > 12 && q.walking > 1000 && (herdIx.includes(i) ? beyond(q, ALL[i].box) <= HERD_SLACK : q.outBox === 0)), line(r1));
    notes.push(`${name}: ten minutes, pi away: ${line(r1)}`);
    // the herd's drifting, measured frame by frame: how often a herd animal picking a target takes a herd-mate's, against the four gallimimus
    // (one box, four areas, never following) as the baseline
    const drift = await cp.I(([groups, n]) => { const I2 = window.__island; I2.teleport(60 * 16 + 8, 60 * 16 + 10); const out = groups.map(() => ({ picks: 0, follow: 0 }));
      let prev = I2.preview().creatures.map((c) => c.tx ? [c.tx, c.ty] : 0), gap = groups.map(() => []);
      for (let f = 0; f < n; f++) { I2.step(1); const cs = I2.preview().creatures, now = cs.map((c) => c.tx ? [c.tx, c.ty] : 0);
        groups.forEach((g, k) => { for (const i of g) if (!prev[i] && now[i]) { out[k].picks++; if (g.some((j) => j !== i && [prev[j], now[j]].some((q) => q && Math.abs(now[i][0] - q[0]) <= 20 && Math.abs(now[i][1] - q[1]) <= 12))) out[k].follow++; } });
        if (f % 60 === 0) groups.forEach((g, k) => { let d = 0, n2 = 0; for (const i of g) for (const j of g) if (i < j) { d += Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y); n2++; } gap[k].push(d / n2 / 16); });
        prev = now; }
      return out.map((o, k) => ({ ...o, gap: gap[k].reduce((a, b) => a + b, 0) / gap[k].length })); }, [[herdIx, ixOf((q) => q.pop === "galli")], 18000]);
    const pc = (o) => (100 * o.follow / Math.max(1, o.picks)).toFixed(0) + "%";
    check(name, "the herd drifts together (format 1's: its four share one roam area, and a grazer often takes a herd-mate's target): over five minutes the herd's picks that follow a herd-mate far outnumber the four gallimimus' (separate areas: never following), which match only by chance",
      drift[0].picks > 20 && drift[0].follow / drift[0].picks > 0.15 && drift[0].follow / drift[0].picks > 3 * (drift[1].follow / Math.max(1, drift[1].picks)), `herd ${drift[0].follow} of ${drift[0].picks} picks follow (${pc(drift[0])}), mean spacing ${drift[0].gap.toFixed(1)} tiles; gallimimus ${drift[1].follow} of ${drift[1].picks} (${pc(drift[1])}), ${drift[1].gap.toFixed(1)} tiles`);
    check(name, "the two pachycephalosaurs still butt heads now and then (B3e1's, format 1's)", r1.both > 0, `${r1.both} frames with two rearing`);
    // the parasaurolophus' wetland (B3e4): format 1's wander walks straight, and a walk that meets the river bank's foot pixels stops; the game
    // then waits half a second and picks a new target. Frame by frame, with pi away for ten minutes, then crossing the box from the north, the
    // south, the east and the west for four: every walk picked, arrived or blocked; how soon a blocked one is followed by a new target; the
    // longest stand-still that isn't grazing, sleeping or calling
    { const pix = ixOf((q) => q.kind === "para"), [x0, y0, x1, y1] = POPS.find((q) => q.key === "para").box, cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1, cross = [];
      for (const [sx, sy, ex, ey] of [[cx, y0 - 3, cx, y1 + 3], [cx, y1 + 3, cx, y0 - 3], [x1 + 3, cy, x0 - 3, cy], [x0 - 3, cy, x1 + 3, cy]]) for (let u = 0; u <= 20; u++) cross.push([Math.round(sx + (ex - sx) * u / 20), Math.round(sy + (ey - sy) * u / 20)]);
      const watch = (frames, path) => cp.I(([ixs, n, pp]) => { const I2 = window.__island; if (!pp) I2.teleport(60 * 16 + 8, 60 * 16 + 10);
        const S = ixs.map((i) => { const c = I2.preview().creatures[i]; return { i, tx: c.tx, ty: c.ty, prev: [c.x, c.y], picks: 0, arrive: 0, blocked: 0, since: -1, rec: [], still: 0, maxStill: 0, solid: 0, out: 0, at: {} }; });
        for (let f = 0; f < n; f++) { if (pp) { const q = pp[Math.floor(f / 34) % pp.length]; I2.teleport(q[0] * 16 + 8, q[1] * 16 + 10); }
          I2.step(1); const cs = I2.preview().creatures;
          for (const s of S) { const c = cs[s.i], a = c.area;
            if (!s.tx && c.tx) { s.picks++; if (s.since >= 0) { s.rec.push(f - s.since); s.since = -1; } }
            if (s.tx && !c.tx) { if (Math.hypot(c.x - s.tx, c.y - s.ty) < 2.5) s.arrive++; else { s.blocked++; s.since = f; const k = Math.floor(c.x / 16) + "," + Math.floor(c.y / 16); s.at[k] = (s.at[k] || 0) + 1; } }
            s.tx = c.tx; s.ty = c.ty; const mv = Math.hypot(c.x - s.prev[0], c.y - s.prev[1]) > 0.01; s.prev = [c.x, c.y];
            if (mv || c.graze > 0 || c.sleep > 0 || c.roar > 0) s.still = 0; else s.maxStill = Math.max(s.maxStill, ++s.still);
            if (I2.blocked(c.x - 4, c.y - 2) || I2.blocked(c.x + 4, c.y - 2) || I2.blocked(c.x - 4, c.y + 1) || I2.blocked(c.x + 4, c.y + 1)) s.solid++;
            if (c.x < a[0] * 16 || c.x >= (a[2] + 1) * 16 || c.y < a[1] * 16 || c.y >= (a[3] + 1) * 16) s.out++; } }
        return S.map((s) => ({ picks: s.picks, arrive: s.arrive, blocked: s.blocked, recMax: Math.max(0, ...s.rec), pending: s.since >= 0 ? n - s.since : 0, maxStill: s.maxStill, solid: s.solid, out: s.out, at: Object.entries(s.at).map((e) => e.join(" x")).join(", ") })); }, [pix, frames, path]);
      const cross0 = await cp.I((pp) => pp.filter(([x, y]) => window.__island.tile(x, y).walkable), cross);
      for (const [lab, frames, path] of [["pi away, ten minutes", 36000, null], ["pi crossing the box from the north, the south, the east and the west, four minutes", 14400, cross0]]) {
        const w = await watch(frames, path), pct = (q) => (100 * q.blocked / Math.max(1, q.arrive + q.blocked)).toFixed(1);
        check(name, `the parasaurolophus in their wetland, ${lab}: they keep walking (many walks each); a few straight walks stop at the river bank (under 10%), and every one is followed by a new target within 2 s (format 1's half-second pause); no stand-still over 15 s but grazing, sleeping or calling; feet never on a solid pixel, never outside the box`,
          w.every((q) => q.arrive > (path ? 15 : 50) && (q.blocked / Math.max(1, q.arrive + q.blocked)) < 0.1 && q.recMax <= 120 && q.pending <= 120 && q.maxStill < 900 && q.solid === 0 && q.out === 0),
          w.map((q, k) => `para ${k + 1}: ${q.arrive} walks arrived, ${q.blocked} blocked (${pct(q)}%${q.at ? ", at " + q.at : ""}), new target after a block within ${(q.recMax / 60).toFixed(2)} s, longest stand-still ${(q.maxStill / 60).toFixed(1)} s`).join("; "));
        notes.push(`${name}: parasaurolophus, ${lab}: ${w.map((q, k) => `para ${k + 1} ${q.arrive} arrived, ${q.blocked} blocked, recovery ${(q.recMax / 60).toFixed(2)} s, longest stand-still ${(q.maxStill / 60).toFixed(1)} s`).join("; ")}`);
      }
    }
    // pi walks round each habitat that doesn't bolt (B3e1's check, for the heath; B3e3's herd and dilophosaur): they keep to their box
    for (const P of POPS.filter((q) => !q.bolt)) {
      const [x0, y0, x1, y1] = P.box, ring = []; for (let x = x0 - 1; x <= x1 + 1; x++) ring.push([x, y0 - 1]); for (let y = y0; y <= y1 + 1; y++) ring.push([x1 + 1, y]); for (let x = x1; x >= x0 - 1; x--) ring.push([x, y1 + 1]); for (let y = y1; y >= y0; y--) ring.push([x0 - 1, y]);
      const ringOk = await cp.I((pp) => pp.filter(([x, y]) => window.__island.tile(x, y).walkable), ring), every = Math.max(12, Math.round(60 * 40 / ringOk.length));
      const r2 = await run(cp, 12000, null, { path: ringOk, every }), ix = ixOf((q) => q.pop === P.key);
      check(name, `pi walking round the ${P.name}'s box (${ringOk.length} walkable tiles of its ring): they keep to it (they don't bolt${P.shared ? "; the herd's drifting at most " + HERD_SLACK + " tiles past it" : ""}), feet never on solid, never off walkable ground`,
        ix.every((i) => r2.st[i].solid === 0 && r2.st[i].offGround === 0 && (P.shared ? beyond(r2.st[i], P.box) <= HERD_SLACK : r2.st[i].outBox === 0)), ix.map((i) => `${ALL[i].kind} ${beyond(r2.st[i], P.box).toFixed(2)}`).join(", "));
    }
    // bolting (format 1's: a gallimimus within 64 px of pi, a compsognathus within 48, runs 60 px away, faster): pi chases through each herd from
    // every side and round it for three minutes; then pi leaves, and every one is back in its box within a minute
    for (const P of POPS.filter((q) => q.bolt)) {
      const [x0, y0, x1, y1] = P.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, path = [];
      for (let k = 0; k < 4; k++) { const sx = [x0 - 3, x1 + 3, cx, cx][k], sy = [cy, cy, y0 - 3, y1 + 3][k], ex = [x1 + 3, x0 - 3, cx, cx][k], ey = [cy, cy, y1 + 3, y0 - 3][k]; for (let u = 0; u <= 12; u++) path.push([Math.round(sx + (ex - sx) * u / 12), Math.round(sy + (ey - sy) * u / 12)]); }
      for (let a = 0; a < 24; a++) path.push([Math.round(cx + Math.cos(a / 24 * 6.283) * (x1 - x0) / 2), Math.round(cy + Math.sin(a / 24 * 6.283) * (y1 - y0) / 2)]);
      const pathOk = await cp.I((pp) => pp.filter(([x, y]) => window.__island.tile(x, y).walkable), path);
      const rb = await run(cp, 10800, null, { path: pathOk, every: 12 });
      const ix = ixOf((q) => q.pop === P.key), st = ix.map((i) => rb.st[i]);
      const maxOut = Math.max(...st.map((q) => Math.max(x0 * 16 - q.box[0], q.box[2] - (x1 + 1) * 16, y0 * 16 - q.box[1], q.box[3] - (y1 + 1) * 16, 0) / 16));
      const back = await cp.I(([pa, ixs]) => { const I2 = window.__island; I2.teleport(pa[0], pa[1]); for (let f = 0; f <= 3600; f += 10) { I2.step(10); const cs = I2.preview().creatures; if (ixs.every((i) => { const c = cs[i], a = c.area; return c.x >= a[0] * 16 && c.x < (a[2] + 1) * 16 && c.y >= a[1] * 16 && c.y < (a[3] + 1) * 16; })) return f; } return -1; }, [far, ix]);
      check(name, `${P.name}: pi chasing through the herd for three minutes (from every side, and round it): they bolt as format 1's do, feet never on a solid pixel, never off walkable ground; pi leaves and all ${ix.length} are back in their box within a minute`,
        st.every((q) => q.solid === 0 && q.offGround === 0) && st.some((q) => q.outBox > 0) && back >= 0, `out of the box in ${st.map((q) => (100 * q.outBox / (rb.n / 2)).toFixed(0)).join("/")}% of frames, at most ${maxOut.toFixed(1)} tiles beyond it; back after ${back < 0 ? "MORE THAN 60 s" : (back / 60).toFixed(1) + " s"}`);
      notes.push(`${name}: ${P.name}: chased for three minutes, at most ${maxOut.toFixed(1)} tiles beyond its box (format 1's bolt runs 60 px from pi and doesn't check the ground ahead)`);
    }
    // the obstacles round each habitat that doesn't bolt (B3e1's, for the heath; the herd's river, the dilo strip's cliffs and water): one of
    // them sent at blocked tiles stops before them (each of the herd's kinds in turn)
    for (const P of POPS.filter((q) => !q.bolt)) {
      const [bx0, by0, bx1, by1] = P.box, who = [...new Set(P.kinds)].map((k) => ALL.findIndex((q) => q.pop === P.key && q.kind === k));
      const OBST = (() => { const o = []; for (let y = by0 - 3; y <= by1 + 3; y++) for (let x = bx0 - 3; x <= bx1 + 3; x++) if ((x < bx0 || x > bx1 || y < by0 || y > by1) && m.coll[y * W + x] !== 0) o.push([x, y]); return o; })();
      const pushes = [];
      for (const [n, [ox, oy]] of OBST.filter((_, i) => i % Math.max(1, Math.floor(OBST.length / 12)) === 0).slice(0, 12).entries()) {
        const from = [Math.max(bx0, Math.min(bx1, ox)), Math.max(by0, Math.min(by1, oy))], ci = who[n % who.length];
        if (!may(ALL[ci].kind, from[0], from[1])) continue;
        const r = await cp.I(([f, o, j]) => { const I2 = window.__island; I2.teleport(60 * 16 + 8, 60 * 16 + 10); I2.creature(j, { x: f[0] * 16 + 8, y: f[1] * 16 + 10, tx: o[0] * 16 + 8, ty: o[1] * 16 + 10, wait: 0, sleep: 0, fast: 1 }); let bad = 0; for (let i = 0; i < 400; i++) { I2.step(1); const c = I2.creature(j); if (I2.blocked(c.x - 4, c.y - 2) || I2.blocked(c.x + 4, c.y - 2) || I2.blocked(c.x - 4, c.y + 1) || I2.blocked(c.x + 4, c.y + 1)) bad++; if (!c.tx) break; } const c = I2.creature(j); return { end: [Math.floor(c.x / 16), Math.floor(c.y / 16)], bad, walk: I2.tile(Math.floor(c.x / 16), Math.floor(c.y / 16)).walkable }; }, [from, [ox, oy], ci]);
        pushes.push({ k: ALL[ci].kind, to: [ox, oy], from, ...r });
      }
      check(name, `obstacles: ${P.key === "herd" ? "the herd's animals" : "a " + P.name} sent at ${pushes.length} blocked tiles round the ${P.habitat} (terrain: cliffs, water) from inside stop${P.key === "herd" ? "" : "s"} on walkable ground, feet never on a solid pixel`, pushes.length > 3 && pushes.every((q) => q.bad === 0 && q.walk && !(q.end[0] === q.to[0] && q.end[1] === q.to[1])), pushes.map((q) => `${q.k} to ${q.to} from ${q.from}: ended ${q.end}`).join("; "));
    }
    // [E] beside one of each kind: the prompt, the card (format 1's: "a dinosaur" and one of its kind's lines), the hop; and a click on one.
    // In the herd the others stand off in the far corner of the box first, so the one asked about is the one nearest. For the click (and the phones'
    // tap, below) pi starts a few tiles off on the first of several sides from which the game's own route (walkTo, what a tap plans) reaches it
    // (not across the wetland's lagoon, a river, or from a bank's pocket), and close enough on a phone that it stays on screen
    for (const k of KINDS) {
      const ix = ixOf((q) => q.kind === k), i0 = ix[0], i1 = ix[1] === undefined ? ix[0] : ix[1], P = POPS.find((q) => q.key === ALL[i0].pop);
      const mates = (i) => P.shared ? ixOf((q) => q.pop === P.key).filter((j) => j !== i) : [];
      const e1 = await cp.I(([i, ms, b]) => { const I2 = window.__island, c = I2.creature(i, { tx: 0, wait: 99, sleep: 0 }); ms.forEach((j, n) => I2.creature(j, { x: ((c.x / 16 > (b[0] + b[2]) / 2 ? b[0] : b[2]) + n) * 16 + 8, y: ((c.y / 16 > (b[1] + b[3]) / 2 ? b[1] : b[3])) * 16 + 10, tx: 0, wait: 99, sleep: 0 })); I2.teleport(c.x + 12, c.y); I2.step(1); return I2.preview().nearby; }, [i0, mates(i0), P.box]);
      await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(3));
      const d1 = await dialog(cp), hop = await cp.I((i) => window.__island.creature(i).hop, i0);
      check(name, `[E] beside ${AN(k)}: the prompt offers it; its card is format 1's ("a dinosaur", ${SAY[k].length > 1 ? "one of the " + NAME[k] + "'s lines" : "the " + NAME[k] + "'s line"}); it hops`, e1 === "critter" && d1.open && d1.name === "a dinosaur" && SAY[k].includes(d1.text) && hop !== 0, `${e1}, "${d1.name}", ${SAY[k].indexOf(d1.text) >= 0 ? "line " + SAY[k].indexOf(d1.text) : "NOT its line"}, hop ${hop}`);
      await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(3));
      await cp.I(([i, ms, b]) => { const I2 = window.__island, c = I2.creature(i, { tx: 0, wait: 99, sleep: 0 }); ms.forEach((j, n) => I2.creature(j, { x: ((c.x / 16 > (b[0] + b[2]) / 2 ? b[0] : b[2]) + n) * 16 + 8, y: ((c.y / 16 > (b[1] + b[3]) / 2 ? b[1] : b[3])) * 16 + 10, tx: 0, wait: 99, sleep: 0 })); const clearTo = ([dx, dy]) => { I2.teleport(c.x + dx, c.y + dy); const ok = I2.walkTo(Math.floor(c.x / 16), Math.floor(c.y / 16)) !== null; I2.teleport(c.x + dx, c.y + dy); return ok; }; const off = [[-70, 10], [70, 10], [10, -60], [10, 60], [-50, 40], [50, 40]].find(clearTo) || [-70, 10]; I2.teleport(c.x + off[0], c.y + off[1]); I2.step(30); }, [i1, mates(i1), P.box]);
      const sc = await cp.I((i) => { const I2 = window.__island, v = I2.preview(), c = I2.creature(i), E = v.ui.scale * v.zoom; return [(c.x - v.camera[0]) * E, (c.y - 5 - v.camera[1]) * E]; }, i1);
      await cp.page.mouse.click(sc[0], sc[1]); await cp.I(() => { for (let i = 0; i < 400; i++) { window.__island.step(1); if (!window.__island.getState().pi.path) break; } window.__island.step(3); });
      const d2 = await dialog(cp);
      check(name, `a click on ${AN(k)} walks pi to it and opens its card on arrival (format 1's tap${P.bolt ? "; it bolts as pi comes" : ""})`, d2.open && d2.name === "a dinosaur" && SAY[k].includes(d2.text), `"${d2.name}"${d2.open && SAY[k].includes(d2.text) ? "" : ": " + (d2.open ? d2.text.slice(0, 50) : "no card")}`);
      await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(3));
    }
    const comp = await cp.I(() => window.__island.completeness());
    const sr = comp && comp.missing.find((q) => /^spawns and roam areas/.test(q));
    check(name, "completeness: a normal format-2 home made of this content would still be refused (7 items); the spawns item names the 11 roam areas not migrated yet (roam-00, roam-01, roam-04 to roam-06, roam-08 and roam-09 to roam-19 off it)",
      comp && !comp.complete && comp.missing.length === 7 && sr && !/roam-(00|01|04|05|06|08|09|1\d)\b/.test(sr) && /roam-02/.test(sr) && /roam-07/.test(sr) && /roam-27/.test(sr) && (sr.match(/roam-\d\d/g) || []).length === 11, sr ? sr.slice(0, 200) : JSON.stringify(comp));
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the runs, the chases, the cards, a reload)", (await storeOf(cp)) === STORE_JSON);
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    { const msg = await refusedHere(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    check(name, "no page error, console error or uncaught exception in the content preview", cp.errs.length === 0, cp.errs.slice(0, 3).join(" | "));
  }
  if (cp.loaded) await cp.ctx.close();

  // 2d. repeatability: two fresh loads with the same seed, the same ten-minute walk to the pixel, for all twenty
  { const a = await open(`http://127.0.0.1:${port + 1}/${Q}`), b = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    const ra = a.loaded ? await run(a, 36000, [60 * 16 + 8, 60 * 16 + 10]) : null, rb = b.loaded ? await run(b, 36000, [60 * 16 + 8, 60 * 16 + 10]) : null;
    check(name, "repeatability: two fresh loads with ?seed=42, ten minutes each, end with all twenty creatures at the same spots, having walked the same distances", ra && rb && JSON.stringify(ra.end) === JSON.stringify(rb.end) && JSON.stringify(ra.st.map((s) => s.dist)) === JSON.stringify(rb.st.map((s) => s.dist)), ra && rb ? `${ra.end.length} creatures, ${JSON.stringify(ra.end.slice(0, 3))}... vs ${JSON.stringify(rb.end.slice(0, 3))}...` : "didn't load");
    await a.ctx.close(); await b.ctx.close(); }
  // 2e. night: they doze (format 1's: idle dinosaurs, after dark); pi close wakes one of each kind
  { const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&step=1&islandhour=22&seed=42#island`);
    const r = P.loaded ? await run(P, 9000, [60 * 16 + 8, 60 * 16 + 10]) : null;
    const woke = {};
    if (P.loaded) for (const k of KINDS) { const ix = ixOf((q) => q.kind === k);
      woke[k] = await P.I((ixs) => { const I2 = window.__island; I2.teleport(60 * 16 + 8, 60 * 16 + 10); for (let k = 0; k < 9000; k++) { I2.step(1); for (const i of ixs) { const c = I2.creature(i); if (c.sleep > 0) { I2.teleport(c.x + 10, c.y); I2.step(2); return { slept: true, after: I2.creature(i).sleep }; } } } return { slept: false }; }, ix); }
    const slept = (k) => r && ALL.some((q, i) => q.kind === k && r.st[i].sleep > 0);
    check(name, "night (22:00): every kind dozes now and then (the brachiosaurs, the parasaurolophus, the herd's stegosaur, triceratops and ankylosaur, the dilophosaur, the pachycephalosaurs, the gallimimus, the compsognathus), and pi coming close wakes one of each", r && KINDS.every((k) => woke[k] && woke[k].slept && woke[k].after <= 0) && !P.errs.length,
      r ? KINDS.map((k) => `${k}: ${ALL.map((q, i) => q.kind === k ? (100 * r.st[i].sleep / (r.n / 2)).toFixed(0) + "%" : null).filter(Boolean).join("/")} asleep, woken ${JSON.stringify(woke[k])}`).join("; ") : "");
    if (P.loaded && name !== "firefox") { await hideDbg(P); for (const Pp of POPS) { await P.I(([i, ms2, ap]) => { const I2 = window.__island, c = I2.creature(i);
        if (ap) { const far = ap.slice().sort((p, q) => Math.hypot(q[0] * 16 + 8 - c.x, q[1] * 16 + 10 - c.y) - Math.hypot(p[0] * 16 + 8 - c.x, p[1] * 16 + 10 - c.y)); ms2.forEach((j, n) => I2.creature(j, { x: far[n][0] * 16 + 8, y: far[n][1] * 16 + 10 })); }
        const feet = (x, y) => I2.tile(Math.floor(x / 16), Math.floor(y / 16)).walkable && ![[-4, -2], [4, -2], [-4, 1], [4, 1]].some(([dx, dy]) => I2.blocked(x + dx, y + dy)), off = [[40, -24], [-40, -24], [40, 24], [-40, 24]].find(([dx, dy]) => feet(c.x + dx, c.y + dy)) || [40, -24];
        I2.teleport(c.x + off[0], c.y + off[1]); for (let k = 0; k < 240; k++) I2.step(1); }, (() => { const i0 = ALL.findIndex((q) => q.pop === Pp.key); return [i0, Pp.apart ? ixOf((q) => q.pop === Pp.key).filter((j) => j !== i0) : [], Pp.apart || null]; })()); await shoot(P, `${name}-${Pp.key}-night.png`); } }
    await P.ctx.close(); }

  // 2f. phones: a tap on one of each kind walks pi to it and opens its card; the card on screen
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const res = [];
    for (const kk of KINDS) {
      const i0 = ALL.findIndex((q) => q.kind === kk), Pp = POPS.find((q) => q.key === ALL[i0].pop), ms = Pp.shared || Pp.apart ? ixOf((q) => q.pop === Pp.key).filter((j) => j !== i0) : [];
      await P.I(([i, ms2, b, ap]) => { const I2 = window.__island, c = I2.creature(i, { tx: 0, wait: 99, sleep: 0 }), far = ap ? ap.slice().sort((p, q) => Math.hypot(q[0] * 16 + 8 - c.x, q[1] * 16 + 10 - c.y) - Math.hypot(p[0] * 16 + 8 - c.x, p[1] * 16 + 10 - c.y)) : null;
        ms2.forEach((j, n) => I2.creature(j, far ? { x: far[n][0] * 16 + 8, y: far[n][1] * 16 + 10, tx: 0, wait: 99, sleep: 0 } : { x: ((c.x / 16 > (b[0] + b[2]) / 2 ? b[0] : b[2]) + n) * 16 + 8, y: ((c.y / 16 > (b[1] + b[3]) / 2 ? b[1] : b[3])) * 16 + 10, tx: 0, wait: 99, sleep: 0 }));
        const feet = (x, y) => I2.tile(Math.floor(x / 16), Math.floor(y / 16)).walkable && ![[-4, -2], [4, -2], [-4, 1], [4, 1]].some(([dx, dy]) => I2.blocked(x + dx, y + dy));
        const clearTo = ([dx, dy]) => { if (!feet(c.x + dx, c.y + dy)) return false; I2.teleport(c.x + dx, c.y + dy); const ok = I2.walkTo(Math.floor(c.x / 16), Math.floor(c.y / 16)) !== null; I2.teleport(c.x + dx, c.y + dy); return ok; }; const off = [[-90, 30], [-60, 40], [60, 40], [10, -60], [10, 60], [90, 30]].find(clearTo) || [-90, 30]; I2.teleport(c.x + off[0], c.y + off[1]); for (let k = 0; k < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; k++) I2.step(2); I2.step(60); }, [i0, ms, Pp.box, Pp.apart || null]);
      const sc = await P.I((i) => { const I2 = window.__island, v = I2.preview(), c = I2.creature(i), E = v.ui.scale * v.zoom; return [(c.x - v.camera[0]) * E, (c.y - 5 - v.camera[1]) * E]; }, i0);
      await P.page.touchscreen.tap(sc[0], sc[1]); await P.I(() => { for (let i = 0; i < 400; i++) { window.__island.step(1); if (!window.__island.getState().pi.path) break; } window.__island.step(3); });
      await P.page.waitForTimeout(600);
      const d = await dialog(P), rect = await P.page.evaluate(() => { const r = document.querySelector(".w-dialog").getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
      await hideDbg(P); await shoot(P, `${name}-phone${vw}-${kk}-card.png`);
      res.push({ k: kk, ok: sc[0] > 0 && sc[0] < vw && sc[1] > 0 && sc[1] < vh && d.open && d.name === "a dinosaur" && SAY[kk].includes(d.text) && rect[0] >= 0 && rect[2] <= vw && rect[3] <= vh, sc, d, rect });
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(4));
    }
    check(name, `phone ${vw} x ${vh}: a tap on each kind (brachiosaur, stegosaur, triceratops, ankylosaur, parasaurolophus, dilophosaur, pachycephalosaur, gallimimus, compsognathus) walks pi to it and opens its card, on screen`, res.every((q) => q.ok) && !P.errs.length, res.map((q) => `${q.k}: tapped ${q.sc.map(Math.round)}, "${q.d.name}", card ${q.rect.map(Math.round)}`).join("; "));
    await P.ctx.close();
  }

  // 2g. the predators (Part 3: a feasibility simulation, test only; roam-02 and roam-03 from the plan in a synthetic content file, never written):
  // the T. rex and the three raptors in their enclosures, ten minutes with pi away, then ten with pi walking the fences and the lane
  { const P = await open(`http://127.0.0.1:${port + 2}/${Q}`);
    if (P.loaded) {
      const v = await P.I(() => window.__island.preview());
      const inn = { trex: [...inner("holding-paddock")], raptor: [...inner("raptor-yard")] };
      const sim = async (frames, opts, pa) => { const r = await run(P, frames, pa, opts); const cs = await P.I(() => window.__island.preview().creatures); return { r, kinds: cs.map((c) => c.kind) }; };
      const lane = []; for (let y = 10; y <= 18; y++) lane.push([118, y]); for (let x = 106; x <= 128; x++) lane.push([x, 18]); for (let y = 18; y >= 9; y--) lane.push([128, y]);
      const a = await sim(36000, {}, [100 * 16 + 8, 26 * 16 + 10]), b = await sim(36000, { path: lane, every: 40 }, null);
      const judge = (s) => { const r = []; s.r.st.forEach((q, i) => { const k = s.kinds[i]; if (k !== "trex" && k !== "raptor") return; const set = new Set(inn[k]); r.push({ k, out: q.tiles.filter((x) => !set.has(x)), solid: q.solid, walking: q.walking, tiles: q.tiles.length, n: s.r.n / 2, ext: q.box }); }); return r; };
      const ja = judge(a), jb = judge(b);
      check(name, "predators (simulation only): the T. rex and the three raptors spawn and run in their enclosures with no page error (the roar zone and the cats aren't there: the game's guards hold)", v.creatures.filter((c) => c.kind === "trex").length === 1 && v.creatures.filter((c) => c.kind === "raptor").length === 3 && v.systems.critters === 4 + ALL.length && !P.errs.length, `${v.systems.critters} creatures: ${v.creatures.map((c) => c.kind).join(",")}`);
      check(name, "predators (simulation only): over ten minutes with pi away and ten with pi walking the fences and the lane between the paddocks, every T. rex and raptor foot stays inside its enclosure (no tile outside the inside), never on a solid pixel",
        [...ja, ...jb].every((q) => q.out.length === 0 && q.solid === 0), [...ja, ...jb].map((q) => `${q.k}: ${q.tiles} tiles${q.out.length ? ", OUTSIDE " + q.out.join(" ") : ""}${q.solid ? ", FEET ON SOLID " + q.solid : ""}`).join("; "));
      [["pi away", ja], ["pi on the fences", jb]].forEach(([lab, j]) => j.forEach((q) => notes.push(`${name}: predators, ${lab}: ${q.k} walked ${(100 * q.walking / q.n).toFixed(0)}% of frames over ${q.tiles} tiles, feet extent x ${q.ext[0]} to ${q.ext[2]}, y ${q.ext[1]} to ${q.ext[3]} px`)));
      // how far the art reaches past the fences: the T. rex's 85 x 45 px and a raptor's 39 x 20 px sprites, drawn on their feet, against the fence tiles
      const reach = (pa) => P.I((pp) => { const I2 = window.__island, o = { trex: { frames: 0, over: 0 }, raptor: { frames: 0, over: 0 } }, W2 = { trex: [85, 45], raptor: [39, 20] };
        I2.teleport(pp[0], pp[1]); I2.step(1);
        for (let f = 0; f < 6000; f += 2) { I2.step(2); I2.preview().creatures.forEach((c) => { if (!W2[c.kind]) return; const [w, h] = W2[c.kind], q = o[c.kind]; q.frames++; let hit = false; for (let y = Math.floor((c.y - h) / 16); y <= Math.floor(c.y / 16) && !hit; y++) for (let x = Math.floor((c.x - w / 2) / 16); x <= Math.floor((c.x + w / 2) / 16) && !hit; x++) if (I2.tile(x, y).content) hit = true; if (hit) q.over++; }); }
        return o; }, pa);
      const pct = (q) => (100 * q.over / Math.max(1, q.frames)).toFixed(0) + "%";
      const ra = await reach([100 * 16 + 8, 26 * 16 + 10]), rb = await reach([118 * 16 + 8, 14 * 16 + 10]);
      notes.push(`${name}: predators: the art (T. rex 85 x 45 px, raptor 39 x 20 px, drawn on the feet) over a fence tile: pi away, T. rex ${pct(ra.trex)} and raptors ${pct(ra.raptor)} of frames; pi in the lane between the paddocks (they stalk and pace toward pi), T. rex ${pct(rb.trex)}, raptors ${pct(rb.raptor)}`);
      if (name !== "firefox") {
        await hideDbg(P);
        await P.I(() => { const I2 = window.__island; I2.teleport(118 * 16 + 8, 14 * 16 + 10); for (let i = 0; i < 300; i++) I2.step(1); }); await shoot(P, `${name}-predators-simulation.png`);
      }
    } else check(name, "predators (simulation)", false, "didn't load");
    await P.ctx.close(); }

  // 2g'. the camera's shake (B3e3). The game settles it in the volcano's update; where that doesn't run (the MAP-B previews: SYS.volcano off)
  // it now settles at the same point of the frame instead. Format 1 frame by frame before the change (B3e2's js/world.js) and after it
  // (settled once a frame, not twice), the content preview the same, the live loop too; the camera jitters while it shakes and holds still
  // once settled; each brachiosaur's footfalls and the seal's cut after eight logs, in the content preview against format 1
  { const seq = (P) => P.I(() => { const I2 = window.__island; I2.fireEvent("quake"); const q = []; for (let s2 = 0; s2 < 40; s2++) { I2.step(1); q.push(+I2.getState().events.quake.toFixed(4)); } return q; });
    const WANT = Array.from({ length: 40 }, (_, n) => +Math.max(0, 4 - (n + 1) * 8 / 60).toFixed(4));
    const pages = { f1Old: await open(`http://127.0.0.1:${port + 3}/${Q}`, { world: OLD_WORLD }), f1: await open(`http://127.0.0.1:${port + 3}/${Q}`), cpOld: await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: OLD_WORLD }), cp: await open(`http://127.0.0.1:${port + 1}/${Q}`) };
    const sq = {}; for (const [k, P] of Object.entries(pages)) sq[k] = P.loaded ? await seq(P) : null;
    const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b), short = (a) => a ? a.filter((_, i) => i % 4 === 0).join(" ") : "didn't load";
    check(name, "the shake in format 1, frame by frame: exactly as before the change (B3e2's js/world.js) and as the volcano's update settles it, 8 a second (4 to 0 in 30 frames, once a frame: no second decay)", same(sq.f1, sq.f1Old) && same(sq.f1, WANT), `now ${short(sq.f1)}; before ${short(sq.f1Old)}`);
    check(name, "the shake in the content preview (no volcano): settles exactly as format 1's, frame for frame (before the change it held at 4 for good)", same(sq.cp, sq.f1) && sq.cpOld && sq.cpOld.every((x) => x === 4), `now ${short(sq.cp)}; before ${short(sq.cpOld)}`);
    // the camera: jittering while it shakes, still once settled (pi standing still, the camera on him)
    // (the camera eases toward pi by a hundredth of a pixel a frame for a while after a teleport: an unshaken run alongside is the reference)
    const cam = await pages.cp.I(() => { const I2 = window.__island, c = () => I2.preview().camera.slice(); I2.teleport(60 * 16 + 8, 60 * 16 + 10); for (let s2 = 0; s2 < 120; s2++) I2.step(1);
      const ref = []; for (let s2 = 0; s2 < 45; s2++) { I2.step(1); ref.push(c()); } I2.teleport(60 * 16 + 8, 60 * 16 + 10); for (let s2 = 0; s2 < 120; s2++) I2.step(1);
      I2.fireEvent("quake"); const a = []; for (let s2 = 0; s2 < 45; s2++) { I2.step(1); a.push([I2.getState().events.quake, c()]); } return { ref, a }; });
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), A = cam.a;
    const jumps = A.map(([q, c], i) => i && q > 0 ? dist(c, A[i - 1][1]) : 0).filter((d) => d > 0.05).length, s0 = A.findIndex(([q]) => q === 0);
    const settled = A.slice(s0 + 1).every(([q, c], i) => q === 0 && dist(c, A[s0 + i][1]) < 0.02), home = dist(A[A.length - 1][1], cam.ref[cam.ref.length - 1]);
    check(name, "the camera while the shake lasts and after: it jitters about pi while shaking, and once settled it moves no more than the camera's own easing (under 0.02 px a frame), ending where an unshaken camera is (within 0.1 px)",
      jumps > 10 && s0 > 0 && settled && home < 0.1, `${jumps} of ${A.filter(([q]) => q > 0).length} shaking frames jumped; settled at frame ${s0 + 1}; then easing only: ${settled}; ${home.toFixed(3)} px from the unshaken camera`);
    for (const k of Object.keys(pages)) if (!["cp", "f1"].includes(k)) { await pages[k].ctx.close(); delete pages[k]; }
    // each brachiosaur walking past pi: its footfalls' shake (format 1's 1.2, a footfall every 4.8 px), and how soon it settles once it stops,
    // in the content preview and in format 1 (its brachiosaurs, the first two creatures there too, walked the same way on its own meadow)
    // (each walks a fixed route: five grass tiles in a row in its own roam area, the row farthest from any T. rex, so format 1's roar stays out)
    const stomp = (P, j) => P.I((jj) => { const I2 = window.__island, v = I2.preview(), a = v.creatures[jj].area, rex = v.creatures.filter((c) => c.kind === "trex");
      let best = null; for (let y = a[1]; y <= a[3]; y++) for (let x = a[0]; x + 4 <= a[2]; x++) { if (![0, 1, 2, 3, 4].every((k) => I2.tile(x + k, y).walkable && I2.tile(x + k, y).type === 3)) continue;
        const d = rex.length ? Math.min(...rex.map((c) => Math.hypot(c.x - (x + 2) * 16, c.y - y * 16))) : 0; if (!best || d > best.d) best = { x, y, d }; }
      if (!best) return { dx: 0, stomps: 0, starts: [], badDecay: 0, roar: 0, settle: -1, held: -1 };
      const tx = best.x, ty = best.y, dx = 4; I2.creature(jj, { x: tx * 16 + 8, y: ty * 16 + 10, tx: (tx + dx) * 16 + 8, ty: ty * 16 + 10, wait: 0, sleep: 0, fast: 1 }); I2.teleport((tx + 2) * 16 + 8, ty * 16 + 30);
      // each footfall sets the shake to 1.2 and the same frame settles it by 8/60 (so it reads 1.0667), then 8/60 a frame to 0; a T. rex roar
      // (format 1's, 4) is set apart
      const STEP = 8 / 60, q = []; for (let f = 0; f < 240; f++) { I2.step(1); q.push(I2.getState().events.quake); }
      let stomps = 0, starts = [], badDecay = 0, roar = 0;
      q.forEach((v, i) => { const p = i ? q[i - 1] : 0; if (v > 1.2 + 1e-9) { roar++; return; } if (v > p + 1e-9) { stomps++; starts.push(+v.toFixed(4)); } else if (p > 0 && p <= 1.2 + 1e-9 && Math.abs(v - Math.max(0, p - STEP)) > 1e-9) badDecay++; });
      I2.creature(jj, { tx: 0, wait: 999 }); let settle = -1; for (let f = 0; f < 120; f++) { I2.step(1); if (I2.getState().events.quake === 0) { settle = f + 1; break; } }
      return { dx, stomps, starts: [...new Set(starts)], badDecay, roar, settle, held: I2.getState().events.quake }; }, j);
    const bi = ixOf((q) => q.kind === "brachio"), st = { cp: [], f1: [] };
    for (const j of bi) { st.cp.push(await stomp(pages.cp, j)); st.f1.push(await stomp(pages.f1, j)); }
    // (how many footfalls, and how soon after the last it settles, depend on the walk and the stride: the shape of each footfall's shake is the measure)
    const pulseOk = (q) => q.stomps >= 2 && q.starts.length === 1 && q.starts[0] === +(1.2 - 8 / 60).toFixed(4) && q.badDecay === 0 && q.settle > 0 && q.settle <= 9 && q.held === 0;
    check(name, "each brachiosaur walking past pi: every footfall shakes the camera as format 1's do (1.2, read 1.0667 after the frame's own settling), then settles 8/60 a frame, to rest within 9 frames of its last footfall, no reload; format 1's brachiosaurs measured the same way give the same",
      bi.length === 2 && st.cp.every((q) => pulseOk(q) && q.stomps > 3 && q.roar === 0) && st.f1.every(pulseOk),
      st.cp.map((q, i) => `brachiosaur ${i + 1}: ${q.stomps} footfalls at ${q.starts.join("/")}, ${q.badDecay} off-step frames, settled ${q.settle} frames after (format 1: ${st.f1[i].stomps} at ${st.f1[i].starts.join("/")}, ${st.f1[i].badDecay} off-step, settled ${st.f1[i].settle}${st.f1[i].roar ? ", a T. rex roar's frames set apart: " + st.f1[i].roar : ""})`).join("; "));
    // the seal's cut after eight logs: seven logs in memory (the preview writes nothing), the eighth read at the mailbox, its card closed
    const seal = (P) => P.I(async () => { const I2 = window.__island; I2.setSave({ v: 2, logs: ["rack", "desk", "uplink", "tower", "lighthouse", "macbook", "tablet"], secrets: [], island: "home", flags: {} });
      const s0 = I2.preview().stations.find((q) => q.id === "mailbox"); I2.teleport(s0.stand[0] * 16 + 8, s0.stand[1] * 16 + 10); I2.step(2); return s0.stand; });
    const sealRun = async (P) => { await seal(P); await P.page.keyboard.press("e"); await P.I(() => window.__island.step(100)); const n = await P.I(() => window.__island.preview().logs.found); await P.page.keyboard.press("Escape");
      return { n, q: await P.I(() => { const I2 = window.__island, q = []; for (let f = 0; f < 240; f++) { I2.step(1); q.push(+I2.getState().events.quake.toFixed(4)); } return q; }) }; };
    const sc = await sealRun(pages.cp), sf = await sealRun(pages.f1);
    const held = (q) => q.filter((x) => x === 2).length, end = (q) => q.findIndex((x, i) => i > q.indexOf(2) && x === 0);
    check(name, "the seal's cut after eight logs, in the content preview: its shake (2) holds through the cut as format 1's does, then settles once play resumes, frame for frame as format 1's; it doesn't hold for good",
      sc.n === 8 && sf.n === 8 && sc.q.includes(2) && sc.q[sc.q.length - 1] === 0 && same(sc.q, sf.q), `logs ${sc.n}; shake 2 for ${held(sc.q)} frames, settled at frame ${end(sc.q)} (format 1: ${held(sf.q)}, ${end(sf.q)})`);
    for (const P of Object.values(pages)) await P.ctx.close();
    // the live loop: the shake set, one second of real time, settled (the content preview and format 1)
    for (const [lab, p0] of [["content preview", port + 1], ["format 1", port + 3]]) {
      const P = await open(`http://127.0.0.1:${p0}/?debug=1&islandhour=11#island`, { wait: 1500 });
      const r = P.loaded ? await P.I(async () => { const I2 = window.__island; I2.fireEvent("quake"); const a = I2.getState().events.quake; await new Promise((res) => setTimeout(res, 1000)); return [a, I2.getState().events.quake]; }) : null;
      check(name, `the live loop (${lab}): the shake set, and a second later settled`, r && r[0] === 4 && r[1] === 0 && !P.errs.length, JSON.stringify(r));
      await P.ctx.close();
    }
  }

  // 2h. code mutations (Chromium only)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    for (const k of ["off", "noSpawns"]) { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT[k][1](WORLD) }); const n = P.loaded ? await P.I(() => { window.__island.step(30); return window.__island.preview().creatures.filter((c) => c.kind === "pachy" && c.dist > 0).length; }) : -1; caught(MUT[k][0], n !== 2 || P.errs.length > 0, `${n} pachycephalosaurs walking; ${P.errs.length} errors`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.catGuard[1](WORLD) }); caught(MUT.catGuard[0], !P.loaded || P.errs.length > 0, `${P.errs.length} page errors${P.errs[0] ? " (" + P.errs[0].slice(0, 70) + ")" : ""}`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noCheck[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, "roam-09").spawns[0].creature = "unicorn"; })) : "didn't load"; caught(MUT.noCheck[0], r === null, r === null ? "a unicorn decoded" : r); await P.ctx.close(); }
  }

  // 2i. performance: the live loop's frame work by the heath, beside the terrain preview; decoding
  { const live = async (p0) => { const P = await open(`http://127.0.0.1:${p0}/?debug=1&islandhour=11#island`, { wait: 2600 }); if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {}); await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[10, 42], "ArrowRight"], [[29, 42], "ArrowLeft"], [[13, 78], "ArrowRight"], [[24, 78], "ArrowLeft"], [[39, 52], "ArrowRight"], [[59, 50], "ArrowLeft"], [[87, 18], "ArrowRight"], [[97, 18], "ArrowLeft"], [[34, 18], "ArrowRight"], [[47, 20], "ArrowLeft"], [[83, 44], "ArrowRight"], [[97, 45], "ArrowLeft"], [[25, 93], "ArrowRight"], [[35, 94], "ArrowLeft"]]) { await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at); await P.page.keyboard.down(k2); await P.page.waitForTimeout(1800); await P.page.keyboard.up(k2); }
      const f = (await P.I(() => window.__island.frames(true))).sort((x, y) => x - y); await P.ctx.close(); const q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))]; return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], errs: P.errs }; };
    const lc = await live(port + 1), lt = await live(port), fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    perf.push(`${name}: live frame work walking through the brachio meadow, the delta wetland, the riverlands range, the dilo strip, the heath, the galli meadow and the village gardens (all twenty creatures running; the brachiosaurs' footfalls shaking the camera, the herd drifting, the gallimimus and compsognathus bolting): content preview ${fmt(lc)}; terrain preview ${fmt(lt)}`);
    check(name, "performance: through the seven habitats on the live loop, all twenty creatures running, the content preview's frame work p95 is under 16.7 ms", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
  }
  if (tp.loaded) await tp.ctx.close();

  // 2j. review screenshots (ignored; not baselines), on the live loop: the pair at several spots, walking, by the heath's edges, the card
  if (name !== "firefox") {
    const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11&seed=42#island`, { ctxOpts: { viewport: { width: 1280, height: 900 } }, wait: 2600 });
    if (P.loaded) {
      await hideDbg(P); const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2);
      // B3e3: framing, checked for each review shot below that shows them: every animal's whole sprite on screen, under no overlay (the HUD, the
      // badge, the map button, a toast; the minimap is folded above)
      const ART = { brachio: [84, 83], para: [60, 42], stego: [65, 40], trike: [64, 36], ankylo: [52, 21], dilo: [47, 32] }, framing = [];
      const clear = async (lab, ixs) => { const r = await P.I(([is, art]) => { const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom;
          const root = document.querySelector(".w-cv").parentElement, seen = (e) => { for (let x = e; x && x !== root; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0 || x.hidden) return false; } return true; };
          const ui = [...root.querySelectorAll("*")].filter((e) => !(e instanceof HTMLCanvasElement) && !e.closest(".w-debug") && /absolute|fixed/.test(getComputedStyle(e).position) && seen(e) && e.getClientRects().length)
            .map((e) => [e.className || e.tagName, e.getBoundingClientRect()]).filter(([, b]) => b.width > 2 && b.height > 2 && b.width < innerWidth * 0.9 && b.height < innerHeight * 0.9);
          return is.map((i) => { const c = v.creatures[i], [w, h] = art[c.kind], x0 = (c.x - w / 2 - v.camera[0]) * E, y0 = (c.y - h - v.camera[1]) * E, x1 = x0 + w * E, y1 = (c.y - v.camera[1]) * E;
            const hit = ui.filter(([, b]) => b.left < x1 && b.right > x0 && b.top < y1 && b.bottom > y0).map(([n]) => String(n).split(" ")[0]);
            return { k: c.kind, on: x0 >= 0 && y0 >= 0 && x1 <= innerWidth && y1 <= innerHeight, hit }; }); }, [ixs, ART]);
        framing.push(`${lab}: ${r.map((q) => `${q.k}${q.on ? "" : " OFF SCREEN"}${q.hit.length ? " UNDER " + q.hit.join("+") : ""}`).join(", ")}`); return r.every((q) => q.on && !q.hit.length); };
      const framed = [];
      // the brachiosaurs: the pair with pi; one walking; at the meadow's west (the cliff and the beach below) and north (under the cliff), east
      // and south edges; a footfall's shake and the same view settled
      const bi = ixOf((q) => q.kind === "brachio"), hold = (i, x, y) => ({ i, o: { x: x * 16 + 8, y: y * 16 + 10, tx: 0, wait: 99, sleep: 0 } });
      // B3e4 review: every pose is fair. pi walks to his spot from his spawn by a tap's route and must arrive (a teleport skips collision: the
      // first B3e4 lagoon shot stood him in the lagoon); each held animal stands on its own ground (grass, inside its box, its feet clear)
      const fixtures = [], SPAWN0 = await P.I(() => { const s = window.__island.getState().pi; return [s.x, s.y]; });
      const pose = async (list, piAt) => { const r = await P.I(([l, pa, sp]) => { const I2 = window.__island; I2.step(1);
          const feet = (x, y) => ![[-4, -2], [4, -2], [-4, 1], [4, 1]].some(([dx, dy]) => I2.blocked(x + dx, y + dy));
          I2.teleport(sp[0], sp[1]); I2.walkTo(pa[0], pa[1]); for (let f = 0; f < 6000 && I2.getState().pi.path; f++) I2.step(1);
          const s = I2.getState().pi, piOk = Math.floor(s.x / 16) === pa[0] && Math.floor(s.y / 16) === pa[1] && I2.tile(pa[0], pa[1]).walkable && feet(pa[0] * 16 + 8, pa[1] * 16 + 10);
          l.forEach((q) => I2.creature(q.i, q.o));
          const bad = l.filter((q) => { const a = I2.preview().creatures[q.i].area, tx = Math.floor(q.o.x / 16), ty = Math.floor(q.o.y / 16), t = I2.tile(tx, ty);
            return !(t.walkable && t.type === 3 && feet(q.o.x, q.o.y) && tx >= a[0] && tx <= a[2] && ty >= a[1] && ty <= a[3]); }).map((q) => `${I2.preview().creatures[q.i].kind} at ${Math.floor(q.o.x / 16)},${Math.floor(q.o.y / 16)}`);
          I2.teleport(pa[0] * 16 + 8, pa[1] * 16 + 10); I2.step(30); return { piOk, at: [Math.floor(s.x / 16), Math.floor(s.y / 16)], bad }; }, [list, piAt, SPAWN0]);
        fixtures.push(`pi ${piAt}${r.piOk ? "" : " NOT REACHED (walked to " + r.at + ")"}${r.bad.length ? "; UNFAIR " + r.bad.join(", ") : ""}`); return r; };
      await pose([hold(bi[0], 16, 41), hold(bi[1], 23, 42)], [19, 39]); framed.push(await clear("brachio-pair", bi)); await shoot(P, `${name}-brachio-pair.png`);
      await pose([hold(bi[0], 15, 44), hold(bi[1], 25, 48)], [19, 42]); await P.I((i) => window.__island.creature(i, { tx: 21 * 16 + 8, ty: 44 * 16 + 10, wait: 0 }), bi[0]); await P.I(() => window.__island.play()); await P.page.waitForTimeout(2500); framed.push(await clear("brachio-walking", [bi[0]])); await shoot(P, `${name}-brachio-walking.png`);
      for (const [lab, at, pa] of [["edge-west", [12, 39], [16, 37]], ["edge-north", [19, 33], [23, 31]], ["edge-east", [27, 40], [23, 38]], ["edge-south", [20, 50], [24, 48]]]) {
        await pose([hold(bi[0], at[0], at[1]), hold(bi[1], 22, 46)], pa); framed.push(await clear(`brachio-${lab}`, [bi[0]])); await shoot(P, `${name}-brachio-${lab}.png`);
      }
      // the north-west corner, the worst case measured above: pi standing north-west of it (45 px: past [E]'s 42, inside the 52 it watches him
      // from; north, so the camera on pi has all of it in view), it turns to him and lowers its head over the corner's cliff; shot as it does
      await pose([hold(bi[0], 12, 33), hold(bi[1], 22, 46)], [10, 31]); const gz = await P.I((i) => { const I2 = window.__island; for (let f = 0; f < 400; f++) { I2.step(1); if (I2.preview().creatures[i].graze > 0) break; } I2.step(6); return I2.preview().creatures[i]; }, bi[0]);
      framed.push(await clear("brachio-corner-north-west", [bi[0]])); await shoot(P, `${name}-brachio-corner-north-west.png`); notes.push(`${name}: screenshot brachio-corner-north-west: facing ${gz.face < 0 ? "west" : "east"}, ${gz.graze > 0 ? "head lowered (grazing)" : "head up"}`);
      // a footfall's shake: one walking past pi, held the frame a footfall lands; then the same view a few frames on, settled
      await pose([hold(bi[0], 15, 44), hold(bi[1], 25, 48)], [18, 42]);
      const sh = await P.I((i) => { const I2 = window.__island; I2.creature(i, { tx: 22 * 16 + 8, ty: 44 * 16 + 10, wait: 0 }); for (let f = 0; f < 300; f++) { I2.step(1); if (I2.getState().events.quake >= 1) break; } return [I2.getState().events.quake, I2.preview().camera.slice()]; }, bi[0]);
      await shoot(P, `${name}-brachio-shake-footfall.png`);
      const st2 = await P.I((i) => { const I2 = window.__island; I2.creature(i, { tx: 0, wait: 99 }); I2.step(20); return [I2.getState().events.quake, I2.preview().camera.slice()]; }, bi[0]);
      await shoot(P, `${name}-brachio-shake-settled.png`);
      notes.push(`${name}: screenshots brachio-shake-footfall (shake ${sh[0]}, camera ${sh[1].map((x) => x.toFixed(2)).join(",")}) and brachio-shake-settled (shake ${st2[0]}, camera ${st2[1].map((x) => x.toFixed(2)).join(",")})`);
      await P.I(() => window.__island.play());
      // B3e4: the parasaurolophus, the pair with pi in their wetland; one at the river bank (20,79, where walks stop) and one by the lagoon (14,77),
      // pi on the shore south-east of it (16,78; the first B3e4 shot stood him at 16,75, in the lagoon)
      const pai = ixOf((q) => q.kind === "para");
      await pose([hold(pai[0], 20, 74), hold(pai[1], 16, 77)], [18, 76]); framed.push(await clear("para-pair", pai)); await shoot(P, `${name}-para-pair.png`);
      // the river shot: it walks from 18,78 toward 20,79 with the game's own move() and is shot where the walk stops (about 324,1272; the
      // first B3e4 shot held it at 20,79's centre, 4 to 7 px into the bank, where its feet can't be)
      await pose([hold(pai[0], 18, 78), hold(pai[1], 15, 78)], [22, 77]);
      const rs = await P.I((i) => { const I2 = window.__island; I2.creature(i, { tx: 20 * 16 + 8, ty: 79 * 16 + 10, wait: 0 }); for (let f = 0; f < 900 && I2.creature(i).tx; f++) I2.step(1); I2.creature(i, { wait: 99 }); I2.step(30); const c = I2.creature(i); return [c.x, c.y, c.face]; }, pai[0]);
      notes.push(`${name}: screenshot para-edge-river: the walk to 20,79 stopped at ${rs[0].toFixed(1)},${rs[1].toFixed(1)}, facing ${rs[2] < 0 ? "west" : "east"}`);
      framed.push(await clear("para-edge-river", [pai[0]])); await shoot(P, `${name}-para-edge-river.png`);
      await pose([hold(pai[0], 21, 72), hold(pai[1], 14, 77)], [16, 78]); framed.push(await clear("para-edge-lagoon", [pai[1]])); await shoot(P, `${name}-para-edge-lagoon.png`);
      await P.I(() => window.__island.play());
      // B3e3: the whole herd (near their spawns: they barely move in the brachiosaurs' shots), on screen; then drifting; one by the river at the box's north-west corner
      const onScreen = (ixs) => P.I((is) => { const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom; return is.map((i) => { const c = v.creatures[i]; const sx = (c.x - v.camera[0]) * E, sy = (c.y - v.camera[1]) * E; return sx > 0 && sx < innerWidth && sy > 0 && sy < innerHeight; }); }, ixs);
      await pose([hold(herdIx[0], 45, 47), hold(herdIx[1], 51, 46), hold(herdIx[2], 53, 52), hold(herdIx[3], 46, 53)], [49, 49]); framed.push(await clear("herd-complete", herdIx)); await shoot(P, `${name}-herd-complete.png`); await P.I(() => window.__island.play());
      const herdSeen = await onScreen(herdIx); notes.push(`${name}: screenshot herd-complete: ${herdSeen.filter(Boolean).length} of 4 herd animals on screen`);
      await P.page.waitForTimeout(9000); await shoot(P, `${name}-herd-drifting.png`);
      await P.I(([j]) => { const I2 = window.__island; I2.creature(j, { tx: 41 * 16 + 8, ty: 43 * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(44 * 16 + 8, 47 * 16 + 10); }, [herdIx[0]]); await P.page.waitForTimeout(5000); await shoot(P, `${name}-herd-edge-river.png`);
      // the dilophosaur: its strip, calling (its roar, format 1's), at the strip's north-east corner over the water; prompts and cards below
      const diloIx = ALL.findIndex((q) => q.kind === "dilo");
      await pose([hold(diloIx, 91, 17)], [93, 16]); framed.push(await clear("dilo", [diloIx])); await shoot(P, `${name}-dilo-spawn-area.png`); await P.I(() => window.__island.play());
      const called = await P.I((i) => { const I2 = window.__island; I2.step(1); for (let f = 0; f < 6000; f++) { I2.step(1); const c = I2.creature(i); if (c.roar > 0.6) { I2.teleport(c.x + 40, c.y - 10); I2.step(1); return f; } } return -1; }, diloIx); await shoot(P, `${name}-dilo-calling.png`); await P.I(() => window.__island.play());
      notes.push(`${name}: screenshot dilo-calling: ${called < 0 ? "it didn't call within 100 s" : "it called after " + (called / 60).toFixed(1) + " s"}`);
      await P.I((i) => { const I2 = window.__island; I2.creature(i, { tx: 95 * 16 + 8, ty: 14 * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(92 * 16 + 8, 18 * 16 + 10); }, diloIx); await P.page.waitForTimeout(4000); await shoot(P, `${name}-dilo-edge-water.png`);
      for (const k of ["brachio", "stego", "trike", "ankylo", "para", "dilo"]) {
        const i0 = ALL.findIndex((q) => q.kind === k), Pp = POPS.find((q) => q.key === ALL[i0].pop), ms = ixOf((q) => q.pop === Pp.key).filter((j) => j !== i0);
        const pr = await P.I(([i, ms2, b, ap]) => { const I2 = window.__island; I2.step(1); const c = I2.creature(i, { tx: 0, wait: 99, sleep: 0 }), far = ap ? ap.slice().sort((p, q) => Math.hypot(q[0] * 16 + 8 - c.x, q[1] * 16 + 10 - c.y) - Math.hypot(p[0] * 16 + 8 - c.x, p[1] * 16 + 10 - c.y)) : null;
          ms2.forEach((j, n) => I2.creature(j, far ? { x: far[n][0] * 16 + 8, y: far[n][1] * 16 + 10, tx: 0, wait: 99, sleep: 0 } : { x: ((c.x / 16 > (b[0] + b[2]) / 2 ? b[0] : b[2]) + n) * 16 + 8, y: ((c.y / 16 > (b[1] + b[3]) / 2 ? b[1] : b[3])) * 16 + 10, tx: 0, wait: 99, sleep: 0 }));
          const feet = (x, y) => I2.tile(Math.floor(x / 16), Math.floor(y / 16)).walkable && ![[-4, -2], [4, -2], [-4, 1], [4, 1]].some(([dx, dy]) => I2.blocked(x + dx, y + dy)), off = [[12, 0], [-12, 0], [0, 10], [0, -10], [10, 8], [-10, 8]].find(([dx, dy]) => feet(c.x + dx, c.y + dy));
          I2.teleport(c.x + (off || [12, 0])[0], c.y + (off || [12, 0])[1]); I2.step(1); return off ? null : `${c.kind}'s prompt: no clear spot beside it`; }, [i0, ms, Pp.box, Pp.apart || null]); if (pr) fixtures.push("UNFAIR " + pr); await shoot(P, `${name}-${k}-prompt.png`);
        await P.page.keyboard.press("e"); await P.I(() => window.__island.step(2)); await P.page.waitForTimeout(1200); await shoot(P, `${name}-${k}-card.png`);
        if (await P.page.evaluate(() => !document.querySelector(".w-dialog").hidden)) await P.page.keyboard.press("Escape");
        await P.I(() => window.__island.play());
      }
      check(name, "review screenshots (B3e3, B3e4): every brachiosaur, parasaurolophus, herd and dilophosaur shot shows each animal whole and on screen, under no overlay", framed.length === 12 && framed.every(Boolean), framing.join("; "));
      check(name, "review screenshots (B3e4 review): every posed shot's pi walked there from his spawn by a tap's route (his feet on clear, walkable ground), every held animal on its own grass with its feet clear, and pi beside each prompt's animal on clear ground", fixtures.length === 13 && fixtures.every((q) => !/NOT|UNFAIR/.test(q)), fixtures.join("; "));
      await P.I(() => window.__island.teleport(40 * 16 + 8, 21 * 16 + 10)); await P.page.waitForTimeout(1500); await shoot(P, `${name}-pachy-spawn-area.png`);
      for (const [i, lab] of [[0, "moving-1"], [1, "moving-2"]]) { await P.I(([j]) => { const I2 = window.__island, c = I2.creature(j); I2.creature(j, { tx: (j ? 37 : 44) * 16 + 8, ty: (j ? 16 : 21) * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(40 * 16 + 8, 21 * 16 + 10); }, [i]); await P.page.waitForTimeout(1600); await shoot(P, `${name}-pachy-${lab}.png`); }
      // by the edges: one sent at the heath's west and north limits
      for (const [lab, to] of [["edge-west", [36, 18]], ["edge-north", [41, 15]], ["edge-east", [45, 19]]]) { await P.I((tt) => { const I2 = window.__island; I2.creature(0, { tx: tt[0] * 16 + 8, ty: tt[1] * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(tt[0] * 16 + 8, (tt[1] + 4) * 16 + 10); }, to); await P.page.waitForTimeout(2600); await shoot(P, `${name}-pachy-${lab}.png`); }
      await P.I(() => { const I2 = window.__island, c = I2.creature(0, { tx: 0, wait: 99 }); I2.teleport(c.x + 12, c.y); }); await P.page.waitForTimeout(500); await shoot(P, `${name}-pachy-prompt.png`);
      await P.page.keyboard.press("e"); await P.page.waitForTimeout(1200); await shoot(P, `${name}-pachy-card.png`);
      if (await P.page.evaluate(() => !document.querySelector(".w-dialog").hidden)) await P.page.keyboard.press("Escape");
      // B3e2: the gallimimus and the compsognathus, at their spawn areas, bolting from pi, beside one (the prompt) and its card
      for (const Pp of POPS.filter((q) => q.bolt)) {
        const [x0, y0, x1, y1] = Pp.box, i0 = ALL.findIndex((q) => q.kind === Pp.key);
        await P.I((b) => window.__island.teleport(((b[0] + b[2]) / 2) * 16 + 8, (b[3] + 3) * 16 + 10), Pp.box); await P.page.waitForTimeout(1800); await shoot(P, `${name}-${Pp.key}-spawn-area.png`);
        await P.I((b) => window.__island.teleport(((b[0] + b[2]) / 2) * 16 + 8, ((b[1] + b[3]) / 2) * 16 + 10), Pp.box); await P.page.waitForTimeout(700); await shoot(P, `${name}-${Pp.key}-bolting.png`);
        await P.I((b) => window.__island.teleport((b[2] + 4) * 16 + 8, (b[3] + 4) * 16 + 10), Pp.box); await P.page.waitForTimeout(6000);
        // beside one (it would bolt on the live loop before [E] reaches it): the game held in step mode for the prompt and the card, then live again
        await P.I((i) => { const I2 = window.__island; I2.step(1); const c = I2.creature(i, { tx: 0, wait: 99, sleep: 0 }); I2.teleport(c.x + 12, c.y); I2.step(1); }, i0); await shoot(P, `${name}-${Pp.key}-prompt.png`);
        await P.page.keyboard.press("e"); await P.I(() => window.__island.step(2)); await P.page.waitForTimeout(1200); await shoot(P, `${name}-${Pp.key}-card.png`);
        if (await P.page.evaluate(() => !document.querySelector(".w-dialog").hidden)) await P.page.keyboard.press("Escape");
        await P.I(() => window.__island.play());
      }
    }
    await P.ctx.close();
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); predPv.close(); plain.close();
if (notes.length) { console.log("\nmeasured, for the record:"); notes.forEach((l) => console.log("  " + l)); }
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
