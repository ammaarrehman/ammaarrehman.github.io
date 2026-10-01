#!/usr/bin/env node
/* scenarios: the ?debug=1 test API (handoff 2 C5) in each engine. Runs with ?step=1, so the live
   loop never starts and only __island.step() moves time:
   - the same ?seed and the same steps end in the same state, and another seed doesn't;
   - step(n) advances the clock by exactly n sixtieths of a second, and play() hands it back;
   - setSeed(n) mid-run makes the rest of the run repeat;
   - setSave() is checked like a stored save, applies at once and survives a reload;
   - save v2 (D11-A): a version 1 save (and the older per-session keys) migrate with nothing lost,
     and play on exactly like the same save written as version 2; junk starts fresh; a newer
     version is never written over; bad fields are dropped; the fullest possible save stays
     under 50 KB (the sizes are printed);
   - map layers (D11-B): every tile's type, walkability and height, every pixel's collision and ground,
     every prop and the painted ground match tools/fixtures/map-baseline.json (made from the code
     before the layers by map-baseline.mjs); the layers have the map's size, heights 0 to 5, only
     known flags, flags that agree with the tiles, and come out the same on every load and seed;
   - pi's paths (C4-1): every neighbour step whose aim spots pi's feet can't walk between (42 on
     today's map) is routed round instead of stopping short; the reported 27,27 to 27,28 tap arrives; routes
     from the village to every landmark, door and goto place finish; the no-progress failsafe never
     fires on them; keyboard movement matches tools/fixtures/keyboard-trace.json (recorded before);
   - safe ground (C4-2): over every landing spot (each 4 px, four headings) the helicopter only sets
     down on ground reachable from the spawn or the helipad, and pi always hops out clear and on it;
     the paddocks and other pockets are refused, in flight too; every other landing still works; a
     saved spot in a pocket starts pi at the spawn, a normal one is still restored; and the glide
     after E (up to about 19 px at full speed) never parks it anywhere it may not land, from every
     accepted spot in 16 directions and from spots whose glide would carry it into a pocket;
   - fireEvent() starts the flyover, the roar and a quake;
   - without ?debug=1 there is no __island.

     node tools/scenarios.mjs                            chromium, firefox and webkit
     node tools/scenarios.mjs --engines=chromium,webkit  only these

   Exit 1 if a check failed, 2 if nothing failed but an engine couldn't launch (blocked, not
   failed: Firefox won't launch inside the Claude app, and as of 2026-09-30 not from Terminal on
   Ammaar's Mac either), 0 when everything asked for ran and passed. */
import { chromium, firefox, webkit } from "playwright";
import { serve } from "./serve.mjs";
import { isDeepStrictEqual as same } from "node:util";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mapDigest, finish } from "./mapdigest.mjs";

const BASELINE = JSON.parse(readFileSync(new URL("./fixtures/map-baseline.json", import.meta.url), "utf8"));
const KEYTRACE = JSON.parse(readFileSync(new URL("./fixtures/keyboard-trace.json", import.meta.url), "utf8"));

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const ENGINES = (arg("engines") || "chromium,firefox,webkit").split(",");
const PORT = 8400 + Math.floor(Math.random() * 190);
const server = await serve(PORT);
const BASE = `http://localhost:${PORT}/`;
const fails = [], blocked = [];

function check(engine, what, ok, detail) {
  console.log(`${ok ? "ok  " : "FAIL"} ${engine.padEnd(8)} ${what}${!ok && detail ? ": " + detail : ""}`);
  if (!ok) fails.push(`${engine} ${what}${detail ? ": " + detail : ""}`);
}

// a fresh profile on the island, frozen: ?step=1 keeps the loop from ever starting. store puts
// { l: localStorage, s: sessionStorage } entries in place before the island loads
async function island(browser, query, store) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  if (store) {
    await page.goto(`${BASE}?debug=1`);
    await page.evaluate((st) => { for (const [k, v] of Object.entries(st.l || {})) localStorage.setItem(k, v); for (const [k, v] of Object.entries(st.s || {})) sessionStorage.setItem(k, v); }, store);
  }
  await page.goto(`${BASE}?debug=1&step=1&islandhour=11${query ? "&" + query : ""}#island`);
  await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const run = (page, fn, a) => page.evaluate(fn, a);
const snap = (page) => run(page, () => { const s = window.__island.getState(); return JSON.stringify({ t: s.t, pi: s.pi, critters: s.critters }); });

for (const [name, type] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { const why = e.message.split("\n")[0]; console.log(`BLOCKED ${name}: could not launch (${why})`); blocked.push(name); continue; }
  const open = [];
  const get = async (query, store) => { const it = await island(browser, query, store); open.push(it); return it; };

  // the same seed and steps: the same island; another seed: a different one
  const a = await get("seed=42"), b = await get("seed=42"), c = await get("seed=43");
  const ranA = await run(a.page, () => window.__island.step(600));
  await run(b.page, () => window.__island.step(600)); await run(c.page, () => window.__island.step(600));
  const [sa, sb, sc] = [await snap(a.page), await snap(b.page), await snap(c.page)];
  check(name, "same seed, same 600 steps: same state", sa === sb, "the two runs differ");
  check(name, "another seed: a different state", sa !== sc, "seeds 42 and 43 ended the same");
  const st = await run(a.page, () => window.__island.getState());
  check(name, "step(600) runs 600 steps, 10 s of island time", ranA === 600 && Math.abs(st.t - 10) < 1e-6 && st.manual, `ran ${ranA}, t ${st.t}`);
  check(name, "getState lists the creatures", JSON.parse(sa).critters.length > 0);

  // setSeed mid-run: the rest of the run repeats
  const d = await get("seed=1"), e = await get("seed=1"), f = await get("seed=1");
  for (const [it, s] of [[d, 9], [e, 9], [f, 10]]) await run(it.page, (seed) => { window.__island.step(60); window.__island.setSeed(seed); window.__island.step(300); }, s);
  const [sd, se, sf] = [await snap(d.page), await snap(e.page), await snap(f.page)];
  check(name, "setSeed(9) mid-run twice: same state", sd === se, "the two runs differ");
  check(name, "setSeed(10) instead: a different state", sd !== sf, "seeds 9 and 10 ended the same");

  // play() gives time back to the loop
  await run(a.page, () => window.__island.play());
  await a.page.waitForTimeout(600);
  const played = await run(a.page, () => window.__island.getState());
  check(name, "play() resumes the live loop", !played.manual && played.t > 10.1, `t ${played.t}, manual ${played.manual}`);

  // setSave: checked, applied now, kept across a reload
  const put = await run(d.page, () => window.__island.setSave({ v: 1, logs: ["rack", "desk"], secrets: ["roar"], evolved: true, hatched: true, credits: "yes" }));
  const now = await run(d.page, () => window.__island.getState());
  const stored = await run(d.page, () => JSON.parse(localStorage.getItem("island-save")));
  check(name, "setSave applies the logs and pi's form now", now.found.sort().join() === "desk,rack" && now.pi.kaiju === true, JSON.stringify({ found: now.found, kaiju: now.pi.kaiju }));
  check(name, "setSave drops a field of the wrong type", put.credits === false && stored.credits === false, `credits ${put.credits}`);
  check(name, "setSave writes the save", stored.logs.join() === "rack,desk" && stored.secrets.join() === "roar" && stored.evolved === true);
  const bad = await run(d.page, () => { const out = []; for (const o of [null, { v: 3, logs: [] }, { v: 1 }, { v: "2", logs: [] }]) { try { window.__island.setSave(o); out.push("accepted"); } catch (x) { out.push("refused"); } } return out; });
  check(name, "setSave refuses what isn't a version 1 or 2 save", bad.every((x) => x === "refused"), bad.join(", "));
  await d.page.reload();
  await d.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  const back = await run(d.page, () => window.__island.getState());
  check(name, "the save survives a reload", back.found.sort().join() === "desk,rack" && back.pi.kaiju === true, JSON.stringify({ found: back.found, kaiju: back.pi.kaiju }));

  // fireEvent
  const ev = await run(e.page, () => {
    const I = window.__island, out = {};
    I.fireEvent("ptero"); I.step(1); out.ptero = I.getState().events.ptero;
    I.fireEvent("roar"); out.roar = I.getState().events; I.step(1);
    I.fireEvent("quake"); out.quake = I.getState().events.quake;
    try { I.fireEvent("meteor"); out.unknown = "accepted"; } catch (x) { out.unknown = "refused"; }
    return out;
  });
  check(name, "fireEvent('ptero'): the flyover starts", ev.ptero === true);
  check(name, "fireEvent('roar'): the rex roars and the ground shakes", ev.roar.roar === true && ev.roar.quake > 0, JSON.stringify(ev.roar));
  check(name, "fireEvent('quake'): a quake", ev.quake === 4, JSON.stringify(ev));
  check(name, "fireEvent refuses an unknown event", ev.unknown === "refused");

  // save v2 (D11-A)
  const V1 = { v: 1, logs: ["lighthouse", "rack", "desk", "uplink", "tower", "macbook", "tablet", "mailbox"], secrets: ["roar", "koi", "evolve"], evolved: true, lastPos: [800, 980], settings: { shake: 0.5, flash: false, map: false }, ruler: "halo", credits: true, hatched: true, seal: true, hints: { move: true, use: true } };
  const V2 = { ...V1, v: 2, island: "home", quests: {}, dex: {}, flags: {}, cosmetics: {}, tools: {}, edgeSeen: false };
  const mig = await get("seed=5", { l: { "island-save": JSON.stringify(V1) } }), nat = await get("seed=5", { l: { "island-save": JSON.stringify(V2) } });
  const [mSave, mStored] = await run(mig.page, () => [window.__island.getSave(), JSON.parse(localStorage.getItem("island-save"))]);
  check(name, "a full v1 save migrates to v2 with every field kept", same(mSave, V2), JSON.stringify(mSave));
  check(name, "the migrated save is written back as v2", same(mStored, V2), JSON.stringify(mStored));
  const mState = await run(mig.page, () => window.__island.getState());
  check(name, "the migrated progress is live (8 logs, pi evolved)", mState.found.length === 8 && mState.pi.kaiju === true, JSON.stringify({ found: mState.found.length, kaiju: mState.pi.kaiju }));
  for (const it of [mig, nat]) await run(it.page, () => window.__island.step(300));
  const play = async (it) => JSON.stringify([await snap(it.page), (await run(it.page, () => window.__island.getState())).found.sort()]);
  check(name, "migrated v1 and native v2 play the same 300 steps the same", (await play(mig)) === (await play(nat)), "they differ");

  const v0 = await get("", { s: { "pi-found": JSON.stringify(["rack", "desk"]), "pi-kaiju": "1", "rift-done": "fog" } });
  const s0 = await run(v0.page, () => window.__island.getSave());
  check(name, "the older per-session keys migrate straight to v2", s0.v === 2 && s0.logs.join() === "rack,desk" && s0.evolved === true && s0.ruler === "fog" && same(s0.quests, {}), JSON.stringify(s0));

  const junk = ["not json", JSON.stringify({ v: 1 }), JSON.stringify({ v: "1", logs: ["rack"] })];
  const fresh = [];
  for (const raw of junk) {
    const it = await get("", { l: { "island-save": raw } });
    const [sv, st] = await run(it.page, () => [window.__island.getSave(), JSON.parse(localStorage.getItem("island-save"))]);
    fresh.push(sv.v === 2 && !sv.logs.length && st.v === 2 && !st.logs.length);
  }
  check(name, "junk saves start fresh (and are replaced)", fresh.every(Boolean), fresh.join());
  const NEWER = JSON.stringify({ v: 3, logs: ["rack"], future: { x: 1 } });
  const nw = await get("", { l: { "island-save": NEWER } });
  const [nSave, nRaw] = await run(nw.page, () => [window.__island.getSave(), localStorage.getItem("island-save")]);
  check(name, "a newer save plays fresh and is never written over", nSave.v === 2 && !nSave.logs.length && nRaw === NEWER, nRaw);

  const norm = await run(mig.page, () => window.__island.setSave({ v: 2, logs: ["rack", 5, "rack", null], secrets: "roar", hints: [], settings: { shake: "x", flash: true, extra: 1 }, ruler: 7, lastPos: ["a", 1], island: "Bad Island", quests: { "q1-lost-cargo": "active", "Bad Key": 1, q2: { deep: 1 } }, dex: { stego: true, trex: 12 }, flags: { "bridge-mended": true, x: "yes" }, cosmetics: [], tools: { rope: true }, edgeSeen: "yes" }));
  const NORM = { v: 2, logs: ["rack"], secrets: [], evolved: false, lastPos: null, settings: { flash: true }, ruler: null, credits: false, hatched: false, seal: false, hints: { move: false, use: false }, island: "home", quests: { "q1-lost-cargo": "active" }, dex: { stego: true, trex: 12 }, flags: { "bridge-mended": true }, cosmetics: {}, tools: { rope: true }, edgeSeen: false };
  check(name, "bad fields are dropped, good ones kept", same(norm, NORM), JSON.stringify(norm));

  const size = await run(mig.page, (v1) => {
    const I = window.__island, id = (p, i) => (p + i).padEnd(32, "x"), many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
    const map = (v) => Object.fromEntries(many(100, (i) => [id("k", i), v]));
    const bytes = () => new Blob([localStorage.getItem("island-save")]).size;
    const max = I.setSave({ ...v1, v: 2, logs: many(100, (i) => id("log", i).padEnd(64, "x")), secrets: many(100, (i) => id("s", i).padEnd(64, "x")), island: id("i", 0), quests: map("q".repeat(32)), dex: map("d".repeat(32)), cosmetics: map("c".repeat(32)), flags: map(true), tools: map(true), edgeSeen: true });
    const out = { max: bytes(), capped: [max.logs.length, max.secrets.length, Object.keys(max.quests).length, Object.keys(max.flags).length] };
    const QUESTS = ["q1-lost-cargo", "q2-dark-lighthouse", "q3-thirsty-garden", "q4-field-guide", "q5-stray-herd", "q6-nest-egg", "q7-root-access", "q8-signal", "q9-the-wreck", "q10-the-ford", "q11-boardwalk", "q12-rim-sensors", "q13-night-watch", "q14-the-keep"];
    I.setSave({ ...v1, v: 2, secrets: ["dotfiles", "root", "evolve", "koi", "roar", "heli", "drift", "honk", "rex", "zoom", "night", "deity"], quests: Object.fromEntries(QUESTS.map((q) => [q, "done"])), dex: Object.fromEntries(many(20, (i) => ["species-" + i, true])), flags: { "bridge-mended": true, "ford-open": true, "boardwalk-fixed": true }, tools: { rope: true, lantern: true, camera: true }, cosmetics: { hat: "straw" }, edgeSeen: true });
    out.full = bytes();
    I.setSave(v1); out.v1 = bytes();
    return out;
  }, V1);
  console.log(`     ${name.padEnd(8)} save sizes: v1 progress migrated ${size.v1} B, every planned quest/dex/flag ${size.full} B, fullest possible ${size.max} B (caps: ${size.capped.join(", ")})`);
  check(name, "the fullest possible save is under 50 KB, lists capped at 64", size.max < 50 * 1024 && size.capped.every((n) => n === 64), JSON.stringify(size));

  // map layers (D11-B)
  const m1 = await get("seed=1"), m2 = await get("seed=1"), m3 = await get("seed=2");
  const now2 = finish(await run(m1.page, mapDigest, "new")), base = BASELINE.engines[name];
  const diff = Object.keys(base).filter((k) => !same(base[k], now2[k]));
  check(name, `map parity with ${BASELINE.rev}: tiles, walkability, height, ${base.pxBlocked} blocked px, ground, props, painting`, !diff.length, "differs: " + diff.join(", "));
  if (diff.includes("walk") || diff.includes("ground") || diff.includes("height")) {
    const at = (k) => [...base[k]].map((c, i) => (c !== now2[k][i] ? `${k}@${i % 100},${(i / 100) | 0} ${c}->${now2[k][i]}` : null)).filter(Boolean).slice(0, 8);
    console.log("     first differences:", ["ground", "walk", "height"].flatMap(at).join("; "));
  }
  const L = await run(m1.page, () => window.__island.layers());
  check(name, "layers are 100 x 80, one value per tile", L.w === 100 && L.h === 80 && ["ground", "height", "collision"].every((k) => L[k].length === L.w * L.h));
  check(name, "heights are whole numbers 0 to 5", L.height.every((v) => Number.isInteger(v) && v >= 0 && v <= 5), `range ${Math.min(...L.height)} to ${Math.max(...L.height)}`);
  const F = L.flags, KNOWN = Object.values(F).reduce((a, b) => a | b, 0), RESERVED = F.low | F.ledgeN | F.ledgeE | F.ledgeS | F.ledgeW | F.climbable;
  const walkNow = await run(m1.page, () => { const w = []; for (let y = 0; y < 80; y++) for (let x = 0; x < 100; x++) w.push(window.__island.tile(x, y).walkable); return w; });
  const badFlags = L.collision.map((c, i) => {
    const g = L.ground[i], water = g === 0 || g === 1 || g === 5 || g === 9;
    if (c & ~KNOWN) return "unknown bit";
    if (c & RESERVED) return "reserved bit set";
    if (!!(c & F.deep) !== (g === 0) || !!(c & F.shallow) !== (g === 1 || g === 5 || g === 9) || !!(c & F.lava) !== (g === 7)) return "flag/tile mismatch";
    if (walkNow[i] !== !(c & (F.solid | F.shallow | F.deep | F.lava))) return "walkable disagrees with flags";
    if (walkNow[i] && water) return "walkable water";
    return null;
  }).filter(Boolean);
  check(name, "flags: known bits only, reserved ones unset, agree with tiles and walkable()", !badFlags.length, [...new Set(badFlags)].join(", "));
  const lh = await Promise.all([m1, m2, m3].map(async (it) => createHash("sha256").update(JSON.stringify(await run(it.page, () => window.__island.layers()))).digest("hex")));
  check(name, "layers identical across loads and seeds (1, 1, 2)", lh[0] === lh[1] && lh[1] === lh[2]);
  const counts = { solid: 0, shallow: 0, deep: 0 }; L.collision.forEach((c) => { for (const f of Object.keys(counts)) if (c & F[f]) counts[f]++; });
  console.log(`     ${name.padEnd(8)} layers: heights ${[0, 1, 2, 3, 4, 5].map((h) => L.height.filter((v) => v === h).length).join("/")}, flags ${JSON.stringify(counts)}`);

  // pi's paths (C4-1)
  const pp = await get("seed=4");
  // the transitions pi's feet can't make: found from the pixels with move()'s own checks, not a list
  const BADSTEPS = await run(pp.page, () => {
    const I = window.__island, L = I.layers(), W = 100, T = 16, F = L.flags, BL = F.solid | F.shallow | F.deep | F.lava;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < 80 && !(L.collision[y * W + x] & BL), B = (px, py) => I.blocked(px, py);
    const seen = new Uint8Array(W * 80), q = [[46, 60]]; seen[60 * W + 46] = 1;
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (walk(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); } } }
    function seg(ax, ay, bx, by) { let x = ax * T + 8, y = ay * T + 10; const gx = bx * T + 8, gy = by * T + 10;
      for (let s = 0; s < 120; s++) { const dx0 = gx - x, dy0 = gy - y, d = Math.hypot(dx0, dy0); if (d < 1.5) return true; const vx = dx0 / d * 58 / 60, vy = dy0 / d * 58 / 60;
        if (vx && !B(x + vx + (vx > 0 ? 4 : -4), y - 2) && !B(x + vx + (vx > 0 ? 4 : -4), y + 1)) x += vx;
        if (vy && !B(x - 4, y + vy + (vy > 0 ? 1 : -2)) && !B(x + 4, y + vy + (vy > 0 ? 1 : -2))) y += vy; } return false; }
    const bad = [];
    for (let y = 0; y < 80; y++) for (let x = 0; x < W; x++) { if (!walk(x, y) || !seen[y * W + x]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const nx = x + dx, ny = y + dy; if (!walk(nx, ny)) continue; if (!seg(x, y, nx, ny)) bad.push([x, y, nx, ny]); if (!seg(nx, ny, x, y)) bad.push([nx, ny, x, y]); } }
    return bad;
  });
  check(name, `the map still has its ${BADSTEPS.length} steps pi's feet can't make (42 when found)`, BADSTEPS.length === 42, String(BADSTEPS.length));
  // walk somewhere the way a tap does; finished = path done, no failsafe, pi near the goal
  const tapWalk = (from, to, loose) => run(pp.page, ([f, g, l]) => {
    const I = window.__island; I.teleport(f[0] * 16 + 8, f[1] * 16 + 10); I.step(2);
    const s0 = I.getState().pi.stalls, len = I.walkTo(g[0], g[1], l);
    let n = 0; while (I.getState().pi.path && n < 3000) { I.step(10); n += 10; }
    const s = I.getState(), tx = Math.floor(s.pi.x / 16), ty = Math.floor(s.pi.y / 16);
    return { len, steps: n, done: !s.pi.path, stalled: s.pi.stalls - s0, at: [tx, ty], off: Math.max(Math.abs(tx - g[0]), Math.abs(ty - g[1])) };
  }, [from, to, !!loose]);
  const stepsBad = [];
  for (const [ax, ay, bx, by] of BADSTEPS) { const r = await tapWalk([ax, ay], [bx, by]); if (!r.done || r.stalled || r.off > 1) stepsBad.push(`${ax},${ay}>${bx},${by} ${JSON.stringify(r)}`); }
  check(name, "all 42 of them now finish (routed round, no failsafe, pi at or next to the tile)", !stepsBad.length, stepsBad.slice(0, 4).join(" | "));
  const GOALS = { lighthouse: [89, 38], pond: [69, 45], shrine: [21, 22], "brachio meadow": [18, 36], "west bank": [20, 47], sign: [44, 58], uplink: [25, 64], tower: [58, 22], macbook: [66, 54], tablet: [52, 51], mailbox: [54, 64], cave: [41, 21], visitor: [41, 60], bunker: [21, 60], depot: [54, 60], helipad: [59, 62], gate: [48, 35], plaza: [46, 60], car: [37, 61], paddock: [41, 51], raptors: [64, 40], volcano: [48, 25], outpost: [26, 61], clearing: [48, 43] };
  // the mailbox's approach tile has no walkable neighbours, so the nearest anyone gets is 2 tiles (as before)
  const routeBad = [], NEAREST = { mailbox: 2 };
  for (const [g, t] of Object.entries(GOALS)) { const r = await tapWalk([46, 60], t, true); if (r.len === null || !r.done || r.stalled || r.off > (NEAREST[g] || 1)) routeBad.push(`${g} ${JSON.stringify(r)}`); }
  check(name, `routes from the village to ${Object.keys(GOALS).length} landmarks, doors, goto places and the river banks finish`, !routeBad.length, routeBad.slice(0, 4).join(" | "));
  // the reported case with a real tap on the canvas (live loop; 1280 x 800 draws at 4x, the camera centred on pi)
  await run(pp.page, () => { window.__island.teleport(27 * 16 + 8, 27 * 16 + 10); window.__island.play(); });
  await pp.page.waitForTimeout(2500); await pp.page.mouse.click(5, 400); await pp.page.waitForTimeout(300);
  await run(pp.page, () => window.__island.teleport(27 * 16 + 8, 27 * 16 + 10)); await pp.page.waitForTimeout(1500);
  const before = await run(pp.page, () => window.__island.getState());
  await pp.page.mouse.click(640 + (27 * 16 + 8 - before.pi.x) * 4, 400 + (28 * 16 + 8 - before.pi.y) * 4); await pp.page.waitForTimeout(3000);
  const tapped = await run(pp.page, () => { const I = window.__island, s = I.getState(); s.clear = [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I.blocked(s.pi.x + dx, s.pi.y + dy)); return s; });
  check(name, "a real tap from 27,27 to 27,28 finishes (it used to stop short and give up)", tapped.pi.path === 0 && tapped.pi.stalls === before.pi.stalls && tapped.clear, `path ${tapped.pi.path}, at ${tapped.pi.x.toFixed(1)},${tapped.pi.y.toFixed(1)}, stalls ${tapped.pi.stalls - before.pi.stalls}`);
  // keyboard movement is untouched: the same keys from the same spots end in the same places as before
  const kb = await get("seed=4");
  await run(kb.page, () => window.__island.step(30)); await kb.page.focus(".w-cv");
  const trace = [];
  for (const [sx, sy] of KEYTRACE.starts) {
    await run(kb.page, ([x, y]) => { window.__island.teleport(x * 16 + 8, y * 16 + 10); window.__island.step(5); }, [sx, sy]);
    for (const [k, n] of KEYTRACE.seq) { await kb.page.keyboard.down(k); await run(kb.page, (m) => window.__island.step(m), n); await kb.page.keyboard.up(k); await run(kb.page, () => window.__island.step(20));
      trace.push(await run(kb.page, () => { const s = window.__island.getState(); return [+s.pi.x.toFixed(3), +s.pi.y.toFixed(3)]; })); }
  }
  const kbDiff = trace.map((t, i) => (same(t, KEYTRACE.engines[name][i]) ? null : `#${i} ${t} vs ${KEYTRACE.engines[name][i]}`)).filter(Boolean);
  check(name, `keyboard movement unchanged: ${trace.length} positions match the ${KEYTRACE.rev} trace`, !kbDiff.length, kbDiff.slice(0, 3).join("; "));

  // safe ground (C4-2)
  const sg = await get("seed=6");
  const sweep = await run(sg.page, () => {
    const I = window.__island, L = I.layers(), W = 100, T = 16, F = L.flags, BL = F.solid | F.shallow | F.deep | F.lava;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < 80 && !(L.collision[y * W + x] & BL), pad = (x, y) => L.ground[y * W + x] === 8;
    const PTS = [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]], tiles = (x, y) => PTS.map(([a, c]) => [Math.floor((x + a) / T), Math.floor((y + c) / T)]);
    const clear = (x, y) => [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I.blocked(x + dx, y + dy));
    const out = { oldYes: 0, newYes: 0, droppedPocket: 0, droppedOther: 0, gained: 0, landBadTile: 0, poses: 0, hopBad: 0, hopNotSafe: 0, examples: [] };
    for (let y = 8; y < 80 * T - 8; y += 4) for (let x = 8; x < W * T - 8; x += 4) {
      const ts = tiles(x, y), was = ts.every(([a, c]) => walk(a, c) || pad(a, c)), now = I.canLand(x, y);
      if (was) out.oldYes++; if (now) out.newYes++;
      if (was && !now) { if (ts.some(([a, c]) => walk(a, c) && !I.safe(a, c))) out.droppedPocket++; else { out.droppedOther++; if (out.examples.length < 3) out.examples.push(["dropped", x, y]); } }
      if (!was && now) out.gained++;
      if (now && !ts.every(([a, c]) => I.safe(a, c) || pad(a, c))) out.landBadTile++;
      if (!was) continue;            // hop-outs: every spot the old rule let it land, pockets included
      for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        out.poses++; const h = I.hopSpot(x, y, a);
        if (!clear(h.x, h.y)) { out.hopBad++; if (out.examples.length < 6) out.examples.push(["blocked", x, y, a]); }
        else if (!I.safe(Math.floor(h.x / T), Math.floor(h.y / T))) out.hopNotSafe++;
      }
    }
    out.refused = { "t-rex paddock": I.canLand(33 * 16 + 8, 48 * 16 + 8), "raptor pen": I.canLand(65 * 16 + 8, 34 * 16 + 8), "north pocket": I.canLand(41 * 16 + 8, 8 * 16 + 8) };
    out.helipad = I.canLand(61 * 16 + 8, 62 * 16 + 8);
    return out;
  });
  console.log(`     ${name.padEnd(8)} landings: ${sweep.oldYes} spots before, ${sweep.newYes} now (${sweep.droppedPocket} touched a pocket); ${sweep.poses} hop-outs checked`);
  check(name, "every accepted landing is on safe ground or the helipad", sweep.landBadTile === 0 && sweep.gained === 0, JSON.stringify(sweep));
  check(name, "only landings touching a cut-off pocket were dropped", sweep.droppedOther === 0 && sweep.droppedPocket > 0, JSON.stringify(sweep.examples));
  check(name, "the paddocks and the north pocket are refused; the helipad isn't", !Object.values(sweep.refused).some(Boolean) && sweep.helipad, JSON.stringify(sweep.refused));
  check(name, `every hop-out is clear and on safe ground (${sweep.poses} cases; 477 were blocked before)`, sweep.hopBad === 0 && sweep.hopNotSafe === 0, JSON.stringify({ blocked: sweep.hopBad, notSafe: sweep.hopNotSafe, ex: sweep.examples }));
  // the glide after E: the game's own updateHeli, from every accepted spot at full speed in 16 directions
  const drift = await run(sg.page, () => {
    const I = window.__island, PTS = [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]], L = I.layers(), F = L.flags, BL = F.solid | F.shallow | F.deep | F.lava;
    const walk = (x, y) => x >= 0 && y >= 0 && x < 100 && y < 80 && !(L.collision[y * 100 + x] & BL);
    const pocketAt = (x, y) => PTS.some(([a, c]) => { const tx = Math.floor((x + a) / 16), ty = Math.floor((y + c) / 16); return walk(tx, ty) && !I.safe(tx, ty); });
    const clear = (x, y) => [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I.blocked(x + dx, y + dy));
    const out = { runs: 0, bad: 0, maxGlide: 0, toward: 0, towardBad: 0, ex: [] };
    for (let y = 8; y < 1280 - 8; y += 4) for (let x = 8; x < 1600 - 8; x += 4) {
      if (!I.canLand(x, y)) continue;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * 2 * Math.PI, vx = Math.cos(a) * 150, vy = Math.sin(a) * 150, o = I.landingFrom(x, y, vx, vy);
        out.runs++; out.maxGlide = Math.max(out.maxGlide, Math.hypot(o.heli[0] - x, o.heli[1] - y));
        const ok = o.state === "parked" && I.canLand(o.heli[0], o.heli[1]) && clear(o.pi[0], o.pi[1]) && I.safe(Math.floor(o.pi[0] / 16), Math.floor(o.pi[1] / 16));
        if (!ok) { out.bad++; if (out.ex.length < 4) out.ex.push([x, y, k, o]); }
        // the deliberate cases: an unchecked full glide (18.7 px) would end touching a pocket
        if (pocketAt(x + Math.cos(a) * 18.7, y + Math.sin(a) * 18.7)) { out.toward++; if (!ok || pocketAt(o.heli[0], o.heli[1])) out.towardBad++; }
      }
    }
    out.maxGlide = +out.maxGlide.toFixed(2);
    return out;
  });
  console.log(`     ${name.padEnd(8)} glide after E: ${drift.runs} landings, longest ${drift.maxGlide} px, ${drift.toward} headed into a pocket`);
  check(name, "the glide after E never parks the helicopter off allowed ground, and pi always gets out clear", drift.bad === 0 && drift.runs > 300000, JSON.stringify(drift.ex));
  check(name, `landings started next to a pocket, gliding into it at full speed, stop short (${drift.toward} cases)`, drift.toward > 500 && drift.towardBad === 0, `${drift.towardBad} of ${drift.toward}`);
  check(name, "on open ground the glide is unchanged (up to about 19 px)", drift.maxGlide > 18 && drift.maxGlide < 19.5, String(drift.maxGlide));
  // fly it for real: over the t-rex paddock E is refused; at the helipad and on open meadow it lands
  await sg.page.focus(".w-cv");
  const fly = async (tx, ty) => {
    for (let i = 0; i < 200; i++) {
      const h = (await run(sg.page, () => window.__island.getState())).heli, dx = tx - h.x, dy = ty - h.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { await run(sg.page, () => window.__island.step(150)); const h2 = (await run(sg.page, () => window.__island.getState())).heli; if (Math.hypot(tx - h2.x, ty - h2.y) < 10) return h2; continue; }
      const ks = []; if (dx > 6) ks.push("ArrowRight"); if (dx < -6) ks.push("ArrowLeft"); if (dy > 6) ks.push("ArrowDown"); if (dy < -6) ks.push("ArrowUp");
      for (const k of ks) await sg.page.keyboard.down(k);
      await run(sg.page, (n) => window.__island.step(n), Math.hypot(dx, dy) > 80 ? 12 : 4);
      for (const k of ks) await sg.page.keyboard.up(k);
      await run(sg.page, () => window.__island.step(6));
    }
    return (await run(sg.page, () => window.__island.getState())).heli;
  };
  // (the first visit's hatching has to finish before pi can board)
  const board = await run(sg.page, () => { const I = window.__island; I.step(300); const h = I.getState().heli; I.teleport(h.x + 20, h.y + 4); I.step(5); return h; });
  await sg.page.keyboard.press("e"); await run(sg.page, () => window.__island.step(240));
  const up = (await run(sg.page, () => window.__island.getState())).heli.state;
  const over = await fly(33 * 16 + 8, 48 * 16 + 8);
  await sg.page.keyboard.press("e"); await run(sg.page, () => window.__island.step(30));
  const after = (await run(sg.page, () => window.__island.getState())).heli.state;
  check(name, "in flight: E over the t-rex paddock doesn't land", up === "flying" && after === "flying", `took off: ${up}, over ${Math.round(over.x)},${Math.round(over.y)}, after E: ${after}`);
  const meadow = await run(sg.page, () => { const I = window.__island; for (let r = 0; r < 200; r += 8) for (let a = 0; a < 6.28; a += 0.5) { const x = 52 * 16 + Math.cos(a) * r, y = 47 * 16 + Math.sin(a) * r; if (I.canLand(x, y)) return [x, y]; } return null; });
  const landAt = async (x, y) => { const was = (await run(sg.page, () => window.__island.getState())).heli.state; await fly(x, y); await sg.page.keyboard.press("e"); await run(sg.page, () => window.__island.step(240));
    return run(sg.page, (w) => { const I = window.__island, s = I.getState(); return { was: w, state: s.heli.state, pi: [s.pi.x, s.pi.y], clear: [[-4, -2], [4, -2], [-4, 1], [4, 1]].every(([dx, dy]) => !I.blocked(s.pi.x + dx, s.pi.y + dy)), safe: I.safe(Math.floor(s.pi.x / 16), Math.floor(s.pi.y / 16)) }; }, was); };
  const l1 = await landAt(meadow[0], meadow[1]);
  check(name, "in flight: lands on open meadow, pi hops out clear and on safe ground", l1.was === "flying" && l1.state === "parked" && l1.clear && l1.safe, JSON.stringify(l1));
  await run(sg.page, () => { const I = window.__island, h = I.getState().heli; I.teleport(h.x + 20, h.y + 4); I.step(5); });
  await sg.page.keyboard.press("e"); await run(sg.page, () => window.__island.step(240));
  const l2 = await landAt(board.x, board.y);
  check(name, "in flight: lands back on the helipad, pi hops out clear and on safe ground", l2.was === "flying" && l2.state === "parked" && l2.clear && l2.safe, JSON.stringify(l2));
  // a saved spot in a pocket starts pi at the spawn; a normal saved spot is still restored
  await run(sg.page, () => window.__island.setSave({ ...window.__island.getSave(), hatched: true, lastPos: [41 * 16 + 8, 8 * 16 + 10] }));
  await sg.page.reload(); await sg.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  const rp = await run(sg.page, () => { const I = window.__island, s = I.getState(); return [Math.floor(s.pi.x / 16), Math.floor(s.pi.y / 16), I.safe(Math.floor(s.pi.x / 16), Math.floor(s.pi.y / 16))]; });
  check(name, "a saved spot in the north pocket (41,8) starts pi on safe ground, not stranded", rp[2] && !(rp[0] === 41 && rp[1] === 8), JSON.stringify(rp));
  await run(sg.page, () => window.__island.setSave({ ...window.__island.getSave(), hatched: true, lastPos: [52 * 16 + 8, 47 * 16 + 10] }));
  await sg.page.reload(); await sg.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  const rn = await run(sg.page, () => { const s = window.__island.getState(); return [s.pi.x, s.pi.y]; });
  check(name, "a normal saved spot (52,47) is still restored", rn[0] === 52 * 16 + 8 && rn[1] === 47 * 16 + 10, JSON.stringify(rn));

  // visitors: no test API
  const plain = await browser.newPage();
  await plain.goto(`${BASE}#island`);
  await plain.waitForTimeout(4000);
  check(name, "no __island (or map layers) without ?debug=1", await plain.evaluate(() => window.__island === undefined && ["GROUND", "HEIGHT", "COLL", "__mapapi"].every((k) => !(k in window))));
  await plain.close();

  const errs = open.flatMap((it) => it.errors);
  check(name, "no page errors", !errs.length, [...new Set(errs)].join(" | "));
  await browser.close();
}
server.close();
console.log(fails.length ? `\n${fails.length} failed:\n- ` + fails.join("\n- ") : blocked.length ? `\nnothing failed; blocked: ${blocked.join(", ")}` : "\nthe test API works");
process.exit(fails.length ? 1 : blocked.length ? 2 : 0);
