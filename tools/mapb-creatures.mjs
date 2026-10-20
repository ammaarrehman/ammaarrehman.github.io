#!/usr/bin/env node
/* mapb-creatures (MAP-B B3e1): the creature migration's foundation. The content layer gains roam areas (kind roam: format 1's roam
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
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, compileContent, ContentError, ROAM_PLAN, CREATURE_KINDS as KINDS_C, creatureMayStand, habitatMask } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3e1");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const sha = (o) => createHash("sha256").update(typeof o === "string" ? o : JSON.stringify(o)).digest("hex");
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");

/* B3a's approved placements for the creatures (section 3 of the plan), written out so a change anywhere shows */
const HEATH = { box: [36, 15, 45, 22], habitat: "pachy-heath", spawns: [[38, 18], [42, 19]], roams: ["roam-09", "roam-10"] };

/* ════════ 1. Node ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && t.current, `${Buffer.byteLength(built.text)} bytes`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// B3d4b's 21 compiled records, as committed at 7588290
const TWENTY_ONE = "7dcfe507a5c57db3daf45c0c412ea8238dc78fd926c98c58f81b4205bd7e39a8";
check("node", "the content: B3c's to B3d4b's 21 records exactly as committed (byte for byte), then the two roam areas roam-09 and roam-10; nothing else",
  sha(DATA.records.slice(0, 21)) === TWENTY_ONE && DATA.records.length === 23 && DATA.records.slice(21).map((r) => `${r.id}:${r.kind}`).join() === "roam-09:roam,roam-10:roam", DATA.records.slice(21).map((r) => r.id).join(", "));
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
// the heath
const HM = habitatMask(src, "pachy-heath", W, H);
const may = (k, x, y) => { const i = y * W + x; return m.coll[i] === 0 && !LAYER.tiles[i] && creatureMayStand(k, m.ground[i]); };
const aimWet = (x, y) => { let n = 0; const fx = x * T + 8, fy = y * T + 10; for (let py = fy - 2; py <= fy + 1; py++) for (let px = fx - 4; px <= fx + 4; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
const [bx0, by0, bx1, by1] = HEATH.box, boxTiles = []; for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) boxTiles.push([x, y]);
const targets = boxTiles.filter(([x, y]) => may("pachy", x, y)), inHab = boxTiles.filter(([x, y]) => HM[y * W + x]);
const notGrass = boxTiles.filter(([x, y]) => !may("pachy", x, y)).map(([x, y]) => `${x},${y}:${m.coll[y * W + x] ? "coll" + m.coll[y * W + x] : "ground" + m.ground[y * W + x]}`);
for (const [i, id] of HEATH.roams.entries()) {
  const r = RECS.find((q) => q.id === id), [sx, sy] = HEATH.spawns[i];
  check("node", `${id}: a roam area at B3a's box ${HEATH.box.join(",")} in the B1e habitat pachy-heath, its pachycephalosaur starting at ${sx},${sy} (format 1's: ${F1.spawns.filter((s) => s.roam === id).map((s) => s.at).join()}, in format 1's box ${F1.regions.roamAreas.find((q) => q.id === id).box.join(",")}); no collision, nothing drawn; exactly the plan's`,
    r && r.kind === "roam" && r.box.join() === HEATH.box.join() && r.habitat === "pachy-heath" && r.spawns.length === 1 && r.spawns[0].creature === "pachy" && r.spawns[0].at.join() === [sx, sy].join() && !r.tiles.length && !r.drawnPxBoxes.length && JSON.stringify(r.spawns) === JSON.stringify(ROAM_PLAN[id].spawns));
  check("node", `${id}: its spawn ${sx},${sy} is open grass (a tile a pachycephalosaur may stand on), its feet clear of every foot-blocking pixel, inside the habitat`, may("pachy", sx, sy) && !aimWet(sx, sy) && HM[sy * W + sx] === 1);
}
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let blockedWalks = 0; for (let i = 0; i < 2000; i++) { const a = targets[(rnd() * targets.length) | 0], c = targets[(rnd() * targets.length) | 0]; const ax = a[0] * T + 8, ay = a[1] * T + 10, cx = c[0] * T + 8, cy = c[1] * T + 10, d = Math.hypot(cx - ax, cy - ay), s = Math.max(1, Math.ceil(d / 2)); for (let j = 0; j <= s; j++) { const px = ax + (cx - ax) * j / s, py = ay + (cy - ay) * j / s; if (m.coll[Math.floor(py / T) * W + Math.floor(px / T)] !== 0 || m.px.foot[Math.floor(py) * PW + Math.floor(px)]) { blockedWalks++; break; } } }
check("node", `the heath: ${targets.length} of its ${boxTiles.length} tiles are open grass to walk to (the others: ${notGrass.length}), ${inHab.length} inside the habitat; every straight walk between two of them (2,000 tried) crosses only walkable ground (format 1's wander walks straight)`, targets.length === 69 && blockedWalks === 0, `not grass: ${notGrass.join(" ")}`);
notes.push(`node: the heath's tiles that aren't open grass (no pachycephalosaur walks to them): ${notGrass.join(" ")}`);
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
  ["a prop named roam-11", "creatures", (o) => { o.records.push({ id: "roam-11", kind: "prop", drawnPxBoxes: [{ px0: 30 * 16, py0: 70 * 16, px1: 30 * 16 + 15, py1: 70 * 16 + 15 }], solid: { tiles: [[30, 70]] } }); }, /the id is a roam area's/],
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
const PRED_CONTENT = (() => { const o = realWith((q) => { const i = q.records.findIndex((r) => r.id === "roam-09"); q.records.splice(i, 0, ...["roam-02", "roam-03"].map((id) => ({ id, kind: "roam", box: ROAM_PLAN[id].box, habitat: ROAM_PLAN[id].habitat, spawns: ROAM_PLAN[id].spawns }))); });
  const c = compileContent(o, src, m); return { format: 2, staged: true, schema: DATA.schema, id: DATA.id, generator: DATA.generator, source: DATA.source, sourceSha256: DATA.sourceSha256, terrainSha256: DATA.terrainSha256, solidTiles: c.solidTiles, footPixels: c.footPixels, records: JSON.parse(JSON.stringify(c.records)) }; })();
const SAY = JSON.parse("[" + (WORLD.match(/pachy: \{ art: true, sp: 12, step: 1\.8, say: \[([^\]]*)\]/) || [])[1] + "]");

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

  // 2c. the content preview: the two pachycephalosaurs and nothing else
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store: STORE });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const OFF = ["rex", "birds", "koi", "bots", "car", "rift", "volcano", "hatch"];
  check(name, "content preview: 23 records (288 solid tiles); the creature system on (with the buildings and the stations), every other home system off; exactly two creatures, both pachycephalosaurs, at their spawns (38,18 and 42,19), each in its own roam area (roam-09 and roam-10, one box: two objects, as in format 1)",
    cp.loaded && !cp.errs.length && cv.content.records === 23 && cv.content.solidTiles === 288 && cv.sys.creatures && cv.sys.buildings && cv.sys.stations && OFF.every((k) => cv.sys[k] === false) && cv.systems.critters === 2 && !cv.systems.rex && !cv.systems.car &&
      cv.creatures.every((c, i) => c.kind === "pachy" && c.x === HEATH.spawns[i][0] * 16 + 8 && c.y === HEATH.spawns[i][1] * 16 + 10 && c.area.join() === HEATH.box.join()) && cv.creatures[0].areaIx !== cv.creatures[1].areaIx,
    cv ? `sys ${JSON.stringify(cv.sys)}; ${JSON.stringify(cv.creatures.map((c) => [c.kind, c.x, c.y, c.areaIx]))}` : cp.errs.join("; "));
  if (cp.loaded) {
    await cp.I(() => { const I2 = window.__island; I2.teleport(40 * 16 + 8, 23 * 16 + 10); I2.step(4); });
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST) };
    check(name, "content preview, the pachycephalosaurs on screen: both locked painter digests (creatures are drawn in the object layer)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && tDig.td === TERRAIN_SHA, `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const sp = await cp.I((s) => s.map(([x, y]) => { const I2 = window.__island; return I2.tile(x, y).walkable && !I2.tile(x, y).content && I2.safe(x, y) && I2.tile(x, y).type === 3; }), HEATH.spawns);
    check(name, "spawns: each pachycephalosaur's tile walkable, no content, safe ground, grass", sp.every(Boolean), JSON.stringify(sp));
    // a long seeded run, pi away from them (no player influence): ten minutes of game time
    const far = [30 * 16 + 8, 26 * 16 + 10];
    const r1 = await run(cp, 36000, far);
    check(name, "ten minutes on the game's clock (36,000 frames, pi away): both pachycephalosaurs walk the heath (each over many tiles), feet never on a solid pixel, never outside their box, never off walkable ground",
      r1.st.every((s) => s.solid === 0 && s.outBox === 0 && s.offGround === 0 && s.tiles.length > 15 && s.walking > 1000), r1.st.map((s, i) => `pachy ${i}: ${s.tiles.length} tiles, walking ${(100 * s.walking / (r1.n / 2)).toFixed(0)}% of frames, ${s.dist} px, extent ${s.box.join(",")}${s.solid ? ", FEET ON SOLID " + s.solid : ""}${s.outBox ? ", OUT OF BOX " + s.outBox : ""}`).join("; "));
    check(name, "the two pachycephalosaurs butt heads now and then (format 1's: both rearing at once when idle and close)", r1.both > 0, `${r1.both} frames with both rearing`);
    // pi walks round the heath: they turn to watch and the run stays clean
    const ring = []; for (let x = 35; x <= 46; x++) ring.push([x, 14]); for (let y = 15; y <= 23; y++) ring.push([46, y]); for (let x = 45; x >= 35; x--) ring.push([x, 23]); for (let y = 22; y >= 15; y--) ring.push([35, y]);
    const ringOk = await cp.I((r) => r.filter(([x, y]) => window.__island.tile(x, y).walkable).length, ring);
    const r2 = await run(cp, 12000, null, { path: ring.filter(() => true), every: 60 });
    check(name, `pi walking round the heath (${ringOk} of the ${ring.length} ring tiles walkable): the pachycephalosaurs keep to their box, feet never on solid, never off walkable ground`, r2.st.every((s) => s.solid === 0 && s.outBox === 0 && s.offGround === 0), r2.st.map((s) => `${s.tiles.length} tiles`).join("; "));
    // the obstacles round the heath: each pachycephalosaur sent at a tile it can't stand on just outside its box, from inside: stops before it
    const OBST = (() => { const o = []; for (let y = by0 - 3; y <= by1 + 3; y++) for (let x = bx0 - 3; x <= bx1 + 3; x++) if ((x < bx0 || x > bx1 || y < by0 || y > by1) && m.coll[y * W + x] !== 0) o.push([x, y]); return o; })();
    const pushes = [];
    for (const [ox, oy] of OBST.filter((_, i) => i % Math.max(1, Math.floor(OBST.length / 12)) === 0).slice(0, 12)) {
      const from = [Math.max(bx0, Math.min(bx1, ox)), Math.max(by0, Math.min(by1, oy))];
      if (!may("pachy", from[0], from[1])) continue;
      const r = await cp.I(([f, o]) => { const I2 = window.__island; I2.creature(0, { x: f[0] * 16 + 8, y: f[1] * 16 + 10, tx: o[0] * 16 + 8, ty: o[1] * 16 + 10, wait: 0, sleep: 0, fast: 1 }); let bad = 0; for (let i = 0; i < 400; i++) { I2.step(1); const c = I2.creature(0); if (I2.blocked(c.x - 4, c.y - 2) || I2.blocked(c.x + 4, c.y - 2) || I2.blocked(c.x - 4, c.y + 1) || I2.blocked(c.x + 4, c.y + 1)) bad++; if (!c.tx) break; } const c = I2.creature(0); return { end: [Math.floor(c.x / 16), Math.floor(c.y / 16)], bad, walk: I2.tile(Math.floor(c.x / 16), Math.floor(c.y / 16)).walkable }; }, [from, [ox, oy]]);
      pushes.push({ to: [ox, oy], from, ...r });
    }
    check(name, `obstacles: a pachycephalosaur sent at ${pushes.length} blocked tiles round the heath (terrain: cliffs, water) from inside stops on walkable ground, its feet never on a solid pixel`, pushes.length > 3 && pushes.every((q) => q.bad === 0 && q.walk && !(q.end[0] === q.to[0] && q.end[1] === q.to[1])), pushes.map((q) => `${q.to} from ${q.from}: ended ${q.end}`).join("; "));
    // [E] by one: the prompt, the card (one of format 1's lines, "a dinosaur"), the hop
    const e1 = await cp.I(() => { const I2 = window.__island, c = I2.creature(0, { tx: 0, wait: 99 }); I2.teleport(c.x + 12, c.y); I2.step(2); return I2.preview().nearby; });
    await cp.page.keyboard.press("e"); await cp.I(() => window.__island.step(3));
    const d1 = await dialog(cp), hop = await cp.I(() => window.__island.creature(0).hop);
    check(name, "[E] beside a pachycephalosaur: the prompt offers it; its card is format 1's (\"a dinosaur\", one of the pachycephalosaur's lines); it hops", e1 === "critter" && d1.open && d1.name === "a dinosaur" && SAY.includes(d1.text) && hop !== 0, `${e1}, "${d1.name}", ${SAY.indexOf(d1.text) >= 0 ? "line " + SAY.indexOf(d1.text) : "NOT a pachycephalosaur line"}, hop ${hop}`);
    await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(3));
    // a tap (click) on one walks pi to it and opens its card on arrival (format 1's)
    await cp.I(() => { const I2 = window.__island, c = I2.creature(1, { tx: 0, wait: 99 }); I2.teleport(c.x - 70, c.y + 10); I2.step(30); });
    const sc = await cp.I(() => { const I2 = window.__island, v = I2.preview(), c = I2.creature(1), E = v.ui.scale * v.zoom; return [(c.x - v.camera[0]) * E, (c.y - 5 - v.camera[1]) * E]; });
    await cp.page.mouse.click(sc[0], sc[1]); await cp.I(() => { for (let i = 0; i < 300; i++) { window.__island.step(1); if (!window.__island.getState().pi.path) break; } window.__island.step(3); });
    const d2 = await dialog(cp);
    check(name, "a click on a pachycephalosaur walks pi to it and opens its card on arrival (format 1's tap)", d2.open && d2.name === "a dinosaur" && SAY.includes(d2.text), `"${d2.name}"`);
    await cp.page.keyboard.press("Escape"); await cp.I(() => window.__island.step(3));
    const comp = await cp.I(() => window.__island.completeness());
    const sr = comp && comp.missing.find((q) => /^spawns and roam areas/.test(q));
    check(name, "completeness: a normal format-2 home made of this content would still be refused (7 items); the spawns item now names the 26 roam areas not migrated yet (roam-09 and roam-10 off it)",
      comp && !comp.complete && comp.missing.length === 7 && sr && !/roam-09|roam-10/.test(sr) && /roam-00/.test(sr) && /roam-27/.test(sr) && (sr.match(/roam-\d\d/g) || []).length === 26, sr ? sr.slice(0, 160) : JSON.stringify(comp));
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    check(name, "content preview: no storage read or written (a production save beside it untouched through the runs, the card, a reload)", (await storeOf(cp)) === STORE_JSON);
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    { const msg = await refusedHere(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    check(name, "no page error, console error or uncaught exception in the content preview", cp.errs.length === 0, cp.errs.slice(0, 3).join(" | "));
  }
  if (cp.loaded) await cp.ctx.close();

  // 2d. repeatability: two fresh loads with the same seed, the same ten-minute walk to the pixel
  { const a = await open(`http://127.0.0.1:${port + 1}/${Q}`), b = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    const ra = a.loaded ? await run(a, 36000, [30 * 16 + 8, 26 * 16 + 10]) : null, rb = b.loaded ? await run(b, 36000, [30 * 16 + 8, 26 * 16 + 10]) : null;
    check(name, "repeatability: two fresh loads with ?seed=42, ten minutes each, end with both pachycephalosaurs at the same spots, having walked the same distances", ra && rb && JSON.stringify(ra.end) === JSON.stringify(rb.end) && JSON.stringify(ra.st.map((s) => s.dist)) === JSON.stringify(rb.st.map((s) => s.dist)), ra && rb ? `${JSON.stringify(ra.end)} vs ${JSON.stringify(rb.end)}` : "didn't load");
    await a.ctx.close(); await b.ctx.close(); }
  // 2e. night: they doze (format 1's: idle dinosaurs, after dark); pi close wakes one
  { const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&step=1&islandhour=22&seed=42#island`);
    const r = P.loaded ? await run(P, 9000, [30 * 16 + 8, 26 * 16 + 10]) : null;
    let woke = null;
    if (P.loaded) woke = await P.I(() => { const I2 = window.__island; for (let i = 0; i < 6000; i++) { I2.step(1); const c = I2.creature(0); if (c.sleep > 0) { I2.teleport(c.x + 10, c.y); I2.step(2); return { slept: true, after: I2.creature(0).sleep }; } } return { slept: false }; });
    check(name, "night (22:00): the pachycephalosaurs doze now and then, and pi coming close wakes one", r && r.st.some((s) => s.sleep > 0) && woke && woke.slept && woke.after <= 0 && !P.errs.length, r ? `${r.st.map((s) => `${(100 * s.sleep / (r.n / 2)).toFixed(0)}% asleep`).join(", ")}; woken: ${JSON.stringify(woke)}` : "");
    if (P.loaded && name !== "firefox") { await hideDbg(P); await P.I(() => { const I2 = window.__island, c = I2.creature(1); I2.teleport(c.x - 40, c.y + 30); for (let i = 0; i < 120; i++) I2.step(1); }); await shoot(P, `${name}-pachy-night.png`); }
    await P.ctx.close(); }

  // 2f. phones: a tap on a pachycephalosaur walks pi to it and opens its card; the card on screen
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    await P.I(() => { const I2 = window.__island, c = I2.creature(0, { tx: 0, wait: 99 }); I2.teleport(c.x - 50, c.y + 20); for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.step(60); });
    const sc = await P.I(() => { const I2 = window.__island, v = I2.preview(), c = I2.creature(0), E = v.ui.scale * v.zoom; return [(c.x - v.camera[0]) * E, (c.y - 5 - v.camera[1]) * E]; });
    await P.page.touchscreen.tap(sc[0], sc[1]); await P.I(() => { for (let i = 0; i < 300; i++) { window.__island.step(1); if (!window.__island.getState().pi.path) break; } window.__island.step(3); });
    await P.page.waitForTimeout(600);
    const d = await dialog(P), rect = await P.page.evaluate(() => { const r = document.querySelector(".w-dialog").getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    await hideDbg(P); await shoot(P, `${name}-phone${vw}-pachy-card.png`);
    check(name, `phone ${vw} x ${vh}: a tap on a pachycephalosaur walks pi to it and opens its card, on screen`, sc[0] > 0 && sc[0] < vw && sc[1] > 0 && sc[1] < vh && d.open && d.name === "a dinosaur" && SAY.includes(d.text) && rect[0] >= 0 && rect[2] <= vw && rect[3] <= vh && !P.errs.length, `tapped ${sc.map(Math.round)}, "${d.name}", card ${rect.map(Math.round)}`);
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
      check(name, "predators (simulation only): the T. rex and the three raptors spawn and run in their enclosures with no page error (the roar zone and the cats aren't there: the game's guards hold)", v.systems.critters === 6 && !P.errs.length, `${v.systems.critters} creatures: ${v.creatures.map((c) => c.kind).join(",")}`);
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
      for (const [at, k2] of [[[34, 18], "ArrowRight"], [[47, 20], "ArrowLeft"], [[40, 13], "ArrowDown"]]) { await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at); await P.page.keyboard.down(k2); await P.page.waitForTimeout(1800); await P.page.keyboard.up(k2); }
      const f = (await P.I(() => window.__island.frames(true))).sort((x, y) => x - y); await P.ctx.close(); const q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))]; return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], errs: P.errs }; };
    const lc = await live(port + 1), lt = await live(port), fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    perf.push(`${name}: live frame work walking the heath's edges: content preview (two pachycephalosaurs) ${fmt(lc)}; terrain preview ${fmt(lt)}`);
    check(name, "performance: by the heath on the live loop the content preview's frame work p95 is under 16.7 ms", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
  }
  if (tp.loaded) await tp.ctx.close();

  // 2j. review screenshots (ignored; not baselines), on the live loop: the pair at several spots, walking, by the heath's edges, the card
  if (name !== "firefox") {
    const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11&seed=42#island`, { ctxOpts: { viewport: { width: 1280, height: 900 } }, wait: 2600 });
    if (P.loaded) {
      await hideDbg(P); const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2);
      await P.I(() => window.__island.teleport(40 * 16 + 8, 21 * 16 + 10)); await P.page.waitForTimeout(1500); await shoot(P, `${name}-pachy-spawn-area.png`);
      for (const [i, lab] of [[0, "moving-1"], [1, "moving-2"]]) { await P.I(([j]) => { const I2 = window.__island, c = I2.creature(j); I2.creature(j, { tx: (j ? 37 : 44) * 16 + 8, ty: (j ? 16 : 21) * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(40 * 16 + 8, 21 * 16 + 10); }, [i]); await P.page.waitForTimeout(1600); await shoot(P, `${name}-pachy-${lab}.png`); }
      // by the edges: one sent at the heath's west and north limits
      for (const [lab, to] of [["edge-west", [36, 18]], ["edge-north", [41, 15]], ["edge-east", [45, 19]]]) { await P.I((tt) => { const I2 = window.__island; I2.creature(0, { tx: tt[0] * 16 + 8, ty: tt[1] * 16 + 10, wait: 0, sleep: 0 }); I2.teleport(tt[0] * 16 + 8, (tt[1] + 4) * 16 + 10); }, to); await P.page.waitForTimeout(2600); await shoot(P, `${name}-pachy-${lab}.png`); }
      await P.I(() => { const I2 = window.__island, c = I2.creature(0, { tx: 0, wait: 99 }); I2.teleport(c.x + 12, c.y); }); await P.page.waitForTimeout(500); await shoot(P, `${name}-pachy-prompt.png`);
      await P.page.keyboard.press("e"); await P.page.waitForTimeout(1200); await shoot(P, `${name}-pachy-card.png`);
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
