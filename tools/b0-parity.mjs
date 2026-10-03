#!/usr/bin/env node
/* b0-parity (B0a): the home island's placements that still live in js/world.js (creature spawns and
   roam areas, bot routes, the drone pad, the car, rex, goto places, the roar zone, the arena, the core
   tap, fireflies, perches, the gardener's beds, the first-visit spot), compared exactly between a
   reference revision and the working tree, in each engine. B0 moves these into js/maps/home.js; this is
   the net under that move, written before anything moves.

   Both sides are served with one read-only hook inside the island's closure (window.__b0, next to the
   ?debug=1 API). Each check is a JSON observation compared side by side (its SHA-256 is printed). Some
   probes stand in for code paths that have no API: they rebind closure variables for a moment (rand,
   botGo, bots, print, rift) and put them back.

   Roam areas: creatures that share one area object follow a leader (world.js, `o.area === c.area`), so
   the alias graph (which creatures share an area object) is checked over every pair, apart from the
   numbers in the boxes.

   Then the sensitivity proof: planted mutations of the working tree's js/world.js, served changed in
   memory (nothing on disk changes), each of which must fail the checks it should and leave the ones it
   shouldn't alone. Until B0 moves the values into home.js these edit the literals; afterwards they edit
   the map data.

     node tools/b0-parity.mjs                          715450d vs the working tree, then the mutations
     node tools/b0-parity.mjs --ref=HEAD --no-mutations
     ENGINES=chromium node tools/b0-parity.mjs         one engine (default chromium, webkit, firefox)

   Firefox is tried and reported BLOCKED if it can't launch (exit 2 if nothing failed). Exit 1 on any
   parity difference or a mutation that isn't caught as expected. */
import { chromium, firefox, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { serve } from "./serve.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const REF = arg("ref", "715450d");
const MUTATE = !process.argv.includes("--no-mutations");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const ANCHOR = "  if (DEBUG) window.__island = {";
const STEPS = 3000;

let refSrc;
try { refSrc = execFileSync("git", ["show", `${REF}:js/world.js`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { console.error(`b0-parity: can't read js/world.js at ${REF}`); process.exit(2); }
const curSrc = readFileSync(join(ROOT, "js/world.js"), "utf8");

/* the hook: runs inside the island's closure and only reads, apart from the probes that say otherwise */
const HOOK = String.raw`
  window.__b0 = (function () {
    var J = JSON.stringify;
    function px(o) { return [o.x, o.y]; }
    function alias() {                                   // the roam-area alias graph: pairs, and the groups
      var n = critters.length, m = "", groups = [], seen = [];
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) m += critters[i].area === critters[j].area ? "1" : "0";
      for (i = 0; i < n; i++) {
        if (seen[i]) continue;
        var g = [i]; for (j = i + 1; j < n; j++) if (critters[j].area === critters[i].area) { g.push(j); seen[j] = 1; }
        groups.push(g);
      }
      return { pairs: m, groups: groups };
    }
    function legOf(p) { return p === DOCKPT ? "dock" : p === DEPOTPT ? "depot" : p === VISITPT ? "visitor" : "other:" + J(p); }
    return {
      // what the island holds as it opens (step=1: nothing has run yet). first visit: a fresh browser
      static: function () {
        var gard = bots.filter(function (b) { return b.kind === "gardener"; })[0], weld = bots.filter(function (b) { return b.kind === "welder"; })[0];
        return {
          "creatures.start": J(critters.map(function (c) { return [c.kind, c.x, c.y]; })),
          "creatures.areas": J(critters.map(function (c) { return c.area.slice(); })),
          "creatures.alias": J(alias()),
          "bots.start": J(bots.map(function (b) { return [b.kind, b.x, b.y, b.face, b.wait, !!b.carry]; })),
          "bots.cargo.legs": J({ dock: DOCKPT, depot: DEPOTPT, visitor: VISITPT, legs: bots.filter(function (b) { return b.kind === "cargo"; }).map(function (b) { return b.legs.map(legOf); }) }),
          "bots.welder.route": J({ start: px(weld), spots: weld.spots, spot: weld.spot }),
          "bots.gardener.start": J(px(gard)),
          "drones": J({ pad: [pad.x, pad.y, pad.roof], drones: drones.map(function (d) { return [d.x, d.y, d.z, d.state, d.wait]; }) }),
          "car.start": J([car.x, car.y, car.a]),
          "rex.start": J([rex.x, rex.y, rex.face, rex.wait]),
          "perches": J({ perches: perches, birds: birds.map(function (b) { return [b.x, b.y, b.gy, b.perch]; }) }),
          "fireflies": J(FLIES),
          "arena": J([ARENA.x, ARENA.y, OR, FIELD.rx, FIELD.ry]),
          "firstVisit": J({ pi: px(pi), hatched: save.hatched, egg: !!egg })
        };
      },
      // the gardener's work beds: every prop it can pick. rand is rebound to step through [0, 1) in
      // thousandths (every index of a list under 1,000), botGo to record the pick without a path
      gardener: function () {
        var g = bots.filter(function (b) { return b.kind === "gardener"; })[0];
        var keep = { bots: bots, rand: rand, botGo: botGo, pi: px(pi), g: [g.x, g.y, g.wait, g.path, g.target, g.barkCd] }, k = 0, picks = {};
        bots = [g]; rand = function () { return k / 1000; }; botGo = function (b, goal) { b.path = [goal]; }; pi.x = -9999; pi.y = -9999;
        for (k = 0; k < 1000; k++) { g.path = null; g.target = null; g.wait = 0; g.barkCd = 99; updateBots(0); if (g.target) picks[props.indexOf(g.target)] = 1; }
        bots = keep.bots; rand = keep.rand; botGo = keep.botGo; pi.x = keep.pi[0]; pi.y = keep.pi[1];
        g.x = keep.g[0]; g.y = keep.g[1]; g.wait = keep.g[2]; g.path = keep.g[3]; g.target = keep.g[4]; g.barkCd = keep.g[5];
        return { "gardener.beds": J(Object.keys(picks).map(Number).sort(function (a, b) { return a - b; }).map(function (i) { return [i, props[i].kind, props[i].tx, props[i].ty]; })) };
      },
      // goto: every name, where it lands pi; heli and helipad wherever the helicopter is parked (at the
      // pad, then set down somewhere else); the place list the terminal prints and tab completes
      places: function () {
        var out = [], lines = [], keepPrint = print, keepHeli = [heli.x, heli.y];
        Object.keys(PLACES).forEach(function (nm) { if (room) exitRoom(); var ok = goto(nm); out.push([nm, ok, pi.x, pi.y, room ? room.id : null]); });
        if (room) exitRoom();
        var heliOut = [];
        [[keepHeli[0], keepHeli[1]], [30 * T + 8, 50 * T + 8], [70 * T + 8, 47 * T + 8]].forEach(function (h) {
          heli.x = h[0]; heli.y = h[1];
          ["heli", "helipad"].forEach(function (nm) { var ok = goto(nm); heliOut.push([nm, h, ok, pi.x, pi.y]); });
        });
        heli.x = keepHeli[0]; heli.y = keepHeli[1];
        print = function (t) { lines.push(String(t)); };
        CMDS.goto([]);
        ["goto ", "goto he", "goto heli", "goto p", "goto pon", "goto cl", "goto x"].forEach(function (v) {
          tIn.value = v; tIn.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); lines.push("[" + v + "] -> " + tIn.value);
        });
        tIn.value = ""; print = keepPrint;
        return { "places.goto": J(out), "places.heli": J(heliOut), "places.terminal": J(lines) };
      },
      // the roar: pi and the t-rex put at each point (so only the zone decides), one updateLife(0), did it
      // roar. every 4 px over the zone and 5 tiles round it (the edges are multiples of 4 px), and every
      // 16 px over the whole map
      roar: function () {
        var keep = [trex.x, trex.y, trex.cd, pi.x, pi.y], fine = [], coarse = [], X, Y;
        function at(x, y) { trex.cd = 0; trex.x = x; trex.y = y; pi.x = x; pi.y = y; updateLife(0); return trex.cd > 0 ? 1 : 0; }
        for (Y = 36 * T; Y <= 61 * T; Y += 4) for (X = 20 * T; X <= 47 * T; X += 4) fine.push(at(X, Y));
        for (Y = 0; Y < MH * T; Y += 16) for (X = 0; X < MW * T; X += 16) coarse.push(at(X + 8, Y + 8));
        trex.x = keep[0]; trex.y = keep[1]; trex.cd = keep[2]; pi.x = keep[3]; pi.y = keep[4];
        var n = 0; fine.forEach(function (v) { n += v; });
        return { "roar.zone": J({ fine: fine.join(""), coarse: coarse.join(""), roarsInFine: n }) };
      },
      // rex's wander: 400 seeded single steps from where rex spawns (pi at the spawn), before anything
      // else has run; the target it picks each time. the
      // updates that run before rex's in update() are stood down for the probe, so the seeded rolls
      // reach rex's own code first and nothing else on the island can change what it picks
      rex: function () {
        var keep = { rand: rand, egg: egg, keys: keys, path: pi.path, pi: px(pi), f: [tickTimers, updateTour, updateLog, updateRift, updateReality, updateLife, updateFootfalls, updateSound] }, out = [], start = [rex.x, rex.y], nop = function () {};
        pi.x = SPAWN.x; pi.y = SPAWN.y; pi.vx = pi.vy = 0;
        tickTimers = updateTour = updateLog = updateRift = updateReality = updateLife = updateFootfalls = updateSound = nop; egg = null; keys = {}; pi.path = null;
        for (var n = 1; n <= 400; n++) { rand = seeded(n); rex.x = start[0]; rex.y = start[1]; rex.wait = 0; rex.tx = 0; rex.ty = 0; update(STEP); out.push([rex.tx, rex.ty]); }
        tickTimers = keep.f[0]; updateTour = keep.f[1]; updateLog = keep.f[2]; updateRift = keep.f[3]; updateReality = keep.f[4]; updateLife = keep.f[5]; updateFootfalls = keep.f[6]; updateSound = keep.f[7];
        rand = keep.rand; egg = keep.egg; keys = keep.keys; pi.path = keep.path; pi.x = keep.pi[0]; pi.y = keep.pi[1]; rex.x = start[0]; rex.y = start[1]; rex.tx = 0;
        return { "rex.wander": J(out) };
      },
      // the core tap after the fight: a real pointerdown on the core above the arena while an orb reigns
      // (rift stood in by its phase alone); where pi is sent and what it will do on arrival
      core: function () {
        var keep = { rift: rift, egg: egg, pr: promptRect, mr: mapRect, pi: px(pi) }, E = S * zoom;
        rift = { phase: "reign" }; egg = null; promptRect = null; mapRect = null; pi.x = ARENA.x; pi.y = ARENA.y + 40; pi.path = null; pi.want = null;
        cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: (ARENA.x - camX) * E, clientY: (ARENA.y - 34 - camY) * E, pointerId: 7, pointerType: "mouse", bubbles: true }));
        var r = { want: pi.want ? [pi.want.id, pi.want.x, pi.want.y] : null, path: pi.path ? pi.path.length : null, end: pi.path && pi.path.length ? pi.path[pi.path.length - 1] : null };
        rift = keep.rift; egg = keep.egg; promptRect = keep.pr; mapRect = keep.mr; pi.x = keep.pi[0]; pi.y = keep.pi[1]; pi.path = null; pi.want = null;
        return { "core.tap": J(r) };
      },
      // every actor after the seeded run
      actors: function () {
        return { "actors.after": J({ t: t, critters: critters.map(function (c) { return [c.kind, c.x, c.y, c.tx, c.ty, c.face, c.sleep, c.graze]; }),
          bots: bots.map(function (b) { return [b.kind, b.x, b.y, b.leg, b.spot, b.wait, b.target ? props.indexOf(b.target) : -1, b.path ? b.path.length : 0]; }),
          drones: drones.map(function (d) { return [d.x, d.y, d.z, d.state]; }), birds: birds.map(function (b) { return [b.x, b.y, b.perch, !!b.fly]; }),
          rex: [rex.x, rex.y, rex.tx, rex.ty], car: [car.x, car.y, car.a], heli: [heli.x, heli.y, heli.state], pi: px(pi) }) };
      }
    };
  })();
`;

function hooked(src) {
  if (!src.includes(ANCHOR)) throw new Error("b0-parity: the debug block isn't there to hook into");
  return src.replace(ANCHOR, HOOK + ANCHOR);
}

/* planted mutations of the working tree's world.js, in memory. each edit must find its text exactly once */
const edit = (pairs) => (src) => pairs.reduce((s, [a, b]) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`"${a}" found ${n} times`); return s.replace(a, b); }, src);
const MUTATIONS = [
  { name: "a creature spawn moves (the first brachiosaurus 16,36 to 17,36)", src: edit([['critter("brachio", 16, 36,', 'critter("brachio", 17, 36,']]),
    must: ["creatures.start", "actors.after"], keep: ["creatures.areas", "creatures.alias", "bots.start", "places.goto", "roar.zone", "firstVisit", "rex.wander"] },
  { name: "a route point moves (the welder's stop 62,39 to 62,40)", src: edit([["[62, 39], [67, 39]", "[62, 40], [67, 39]"]]),
    must: ["bots.welder.route"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "bots.start", "places.goto", "roar.zone", "rex.wander"] },
  { name: "a zone edge moves (the roar zone's east edge 42 to 43 tiles)", src: edit([["pi.x < 42 * T && pi.x > 25 * T", "pi.x < 43 * T && pi.x > 25 * T"]]),
    must: ["roar.zone"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "bots.start", "places.goto", "firstVisit", "rex.wander"] },
  { name: "a static place moves (goto plaza 46,60 to 47,60)", src: edit([["plaza: [46, 60]", "plaza: [47, 60]"]]),
    must: ["places.goto"], keep: ["creatures.start", "creatures.alias", "bots.start", "roar.zone", "places.heli", "places.terminal", "rex.wander"] },
  { name: "the first-visit spot moves (50,61 to 51,61)", src: edit([["if (first) { pi.x = 50 * T + 8; pi.y = 61 * T + 10; if (!walkable(50, 61))", "if (first) { pi.x = 51 * T + 8; pi.y = 61 * T + 10; if (!walkable(51, 61))"]]),
    must: ["firstVisit"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "bots.start", "places.goto", "roar.zone", "rex.wander"] },
  { name: "two separate roam areas merge (the two parasaurolophus get one shared area, numbers unchanged)",
    src: edit([["var HERD = [55, 52, 68, 60],", "var PARA_SHARED = [72, 41, 84, 48], HERD = [55, 52, 68, 60],"],
               ['critter("para", 76, 44, [72, 41, 84, 48]), critter("para", 80, 46, [72, 41, 84, 48])', 'critter("para", 76, 44, PARA_SHARED), critter("para", 80, 46, PARA_SHARED)']]),
    must: ["creatures.alias"], keep: ["creatures.start", "creatures.areas", "bots.start", "places.goto", "roar.zone", "firstVisit", "rex.wander"] },
  { name: "one shared roam area splits (the second raptor gets its own copy of the pen, numbers unchanged)", src: edit([['critter("raptor", 66, 35, PEN)', 'critter("raptor", 66, 35, PEN.slice())']]),
    must: ["creatures.alias"], keep: ["creatures.start", "creatures.areas", "bots.start", "places.goto", "roar.zone", "firstVisit", "rex.wander"] },
  // and one for each other target, so every observation is shown to see its own source
  { name: "rex's wander area widens (12 to 13 columns)", src: edit([["var tx = 38 + Math.floor(rand() * 12)", "var tx = 38 + Math.floor(rand() * 13)"]]), must: ["rex.wander"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the gardener's beds widen (|tx - 46| < 12 to < 13)", src: edit([["Math.abs(p2.tx - 46) < 12", "Math.abs(p2.tx - 46) < 13"]]), must: ["gardener.beds"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the cockatiel trees' box moves (centre x 36 to 30)", src: edit([["Math.abs(p.tx - 36) < 9", "Math.abs(p.tx - 30) < 9"]]), must: ["perches"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the firefly area moves (x from 11 to 12)", src: edit([["fx0 = 11 + hash", "fx0 = 12 + hash"]]), must: ["fireflies"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the drone pad moves (x 54.5 to 55.5 tiles)", src: edit([["var pad = { x: 54.5 * T", "var pad = { x: 55.5 * T"]]), must: ["drones"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the car's start moves (36 to 37)", src: edit([["var car = { x: 36 * T + 8", "var car = { x: 37 * T + 8"]]), must: ["car.start"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "rex's start moves (44 to 45)", src: edit([["var rex = { x: 44 * T + 8", "var rex = { x: 45 * T + 8"]]), must: ["rex.start"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the arena moves (48 to 49)", src: edit([["var ARENA = { x: 48 * T + 8", "var ARENA = { x: 49 * T + 8"]]), must: ["arena"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the core tap's goal moves (36,26 to 37,26)", src: edit([['hit.id === "core" ? [36, 26]', 'hit.id === "core" ? [37, 26]']]), must: ["core.tap"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "a cargo stop moves (the depot 54,60 to 54,61)", src: edit([["DEPOTPT = [54, 60]", "DEPOTPT = [54, 61]"]]), must: ["bots.cargo.legs"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "the gardener's start moves (45 to 46)", src: edit([['kind: "gardener", x: 45 * T + 8', 'kind: "gardener", x: 46 * T + 8']]), must: ["bots.gardener.start", "bots.start"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] },
  { name: "goto heli resolves one tile further from the helicopter (+2 to +3)", src: edit([["p = [Math.round(heli.x / T) + 2", "p = [Math.round(heli.x / T) + 3"]]), must: ["places.heli"], keep: ["creatures.start", "creatures.areas", "creatures.alias", "firstVisit"] }
];

const PORT = 8900 + Math.floor(Math.random() * 90);
const server = await serve(PORT);
const URL0 = `http://localhost:${PORT}/?debug=1&step=1&seed=42&islandhour=11#island`;

async function observe(browser, src) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: src }));
  await page.goto(URL0);
  await page.waitForFunction(() => window.__b0 && window.__island && window.__island.getState().open, null, { timeout: 60000 });
  // the order is fixed: what the island opens with, then the seeded run, then the probes that move things
  const obs = await page.evaluate((steps) => {
    const B = window.__b0, I = window.__island, o = Object.assign({}, B.static(), B.rex());
    I.setSeed(42); I.step(steps); Object.assign(o, B.actors());
    for (const p of ["gardener", "places", "roar", "core"]) Object.assign(o, B[p]());
    return o;
  }, STEPS);
  await ctx.close();
  return { obs, errors };
}
const sha = (s) => createHash("sha256").update(s).digest("hex");
const differ = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

const t0 = Date.now(); let failed = false, blocked = false; const report = [];
for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked = true; continue; }
  const te = Date.now();
  const ref = await observe(browser, hooked(refSrc)), cur = await observe(browser, hooked(curSrc));
  const d = differ(ref.obs, cur.obs), errs = [...ref.errors, ...cur.errors];
  console.log(`${name}: ${Object.keys(ref.obs).length} checks, ${REF} vs working tree: ${d.length ? "DIFFERS in " + d.join(", ") : "identical"}${errs.length ? "; page errors: " + errs.join(" | ") : ""}`);
  if (d.length || errs.length) failed = true;
  if (name === "chromium") {
    for (const [k, v] of Object.entries(ref.obs)) report.push(`    ${k.padEnd(20)} ${String(v.length).padStart(8)} chars  ${sha(v).slice(0, 16)}`);
    const A = JSON.parse(ref.obs["creatures.alias"]), C = JSON.parse(ref.obs["creatures.start"]), R = JSON.parse(ref.obs["creatures.areas"]);
    console.log("  roam-area identity groups (" + REF + "):");
    for (const g of A.groups) console.log(`    [${R[g[0]].join(",")}]  ${g.length > 1 ? "shared by" : "own area:"} ${g.map((i) => `#${i} ${C[i][0]}`).join(", ")}`);
    const gb = JSON.parse(ref.obs["gardener.beds"]), core = JSON.parse(ref.obs["core.tap"]), roar = JSON.parse(ref.obs["roar.zone"]);
    console.log(`  gardener beds: ${gb.length} props; core tap: wants ${JSON.stringify(core.want)}, path of ${core.path} ends at ${JSON.stringify(core.end)}; roar zone: ${roar.roarsInFine} roaring points on the fine grid`);
  }
  if (MUTATE) for (const m of MUTATIONS) {
    let src; try { src = hooked(m.src(curSrc)); } catch (e) { console.log(`  MUTATION BROKEN ${m.name}: ${e.message}`); failed = true; continue; }
    const mu = await observe(browser, src);
    const dm = differ(ref.obs, mu.obs), missed = m.must.filter((k) => !dm.includes(k)), leaked = (m.keep || []).filter((k) => dm.includes(k));
    const ok = dm.length > 0 && !missed.length && !leaked.length && !mu.errors.length;
    console.log(`  ${ok ? "caught" : "NOT AS EXPECTED"}  ${m.name}\n           failed: ${dm.join(", ") || "nothing"}${missed.length ? "\n           should have failed: " + missed.join(", ") : ""}${leaked.length ? "\n           should have stayed equal: " + leaked.join(", ") : ""}${mu.errors.length ? "\n           page errors: " + mu.errors.join(" | ") : ""}`);
    if (!ok) failed = true;
  }
  await browser.close();
  console.log(`  ${name} took ${((Date.now() - te) / 1000).toFixed(1)} s`);
}
server.close();
if (report.length) console.log("checks (chromium, reference side):\n" + report.join("\n"));
console.log(`${failed ? "FAIL" : blocked ? "PASS (with a browser blocked)" : "PASS"} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : blocked ? 2 : 0);
