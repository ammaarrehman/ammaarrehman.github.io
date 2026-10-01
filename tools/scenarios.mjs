#!/usr/bin/env node
/* scenarios: the ?debug=1 test API (handoff 2 C5) in each engine. Runs with ?step=1, so the live
   loop never starts and only __island.step() moves time:
   - the same ?seed and the same steps end in the same state, and another seed doesn't;
   - step(n) advances the clock by exactly n sixtieths of a second, and play() hands it back;
   - setSeed(n) mid-run makes the rest of the run repeat;
   - setSave() is checked like a stored save, applies at once and survives a reload;
   - fireEvent() starts the flyover, the roar and a quake;
   - without ?debug=1 there is no __island.

     node tools/scenarios.mjs                            chromium, firefox and webkit
     node tools/scenarios.mjs --engines=chromium,webkit  only these

   Exit 1 if a check failed, 2 if nothing failed but an engine couldn't launch (blocked, not
   failed: Firefox won't launch inside the Claude app, and as of 2026-09-30 not from Terminal on
   Ammaar's Mac either), 0 when everything asked for ran and passed. */
import { chromium, firefox, webkit } from "playwright";
import { serve } from "./serve.mjs";

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

// a fresh profile on the island, frozen: ?step=1 keeps the loop from ever starting
async function island(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
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
  const get = async (query) => { const it = await island(browser, query); open.push(it); return it; };

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
  const bad = await run(d.page, () => { const out = []; for (const o of [null, { v: 2, logs: [] }, { v: 1 }]) { try { window.__island.setSave(o); out.push("accepted"); } catch (x) { out.push("refused"); } } return out; });
  check(name, "setSave refuses what isn't a version 1 save", bad.every((x) => x === "refused"), bad.join(", "));
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

  // visitors: no test API
  const plain = await browser.newPage();
  await plain.goto(`${BASE}#island`);
  await plain.waitForTimeout(4000);
  check(name, "no __island without ?debug=1", await plain.evaluate(() => window.__island === undefined));
  await plain.close();

  const errs = open.flatMap((it) => it.errors);
  check(name, "no page errors", !errs.length, [...new Set(errs)].join(" | "));
  await browser.close();
}
server.close();
console.log(fails.length ? `\n${fails.length} failed:\n- ` + fails.join("\n- ") : blocked.length ? `\nnothing failed; blocked: ${blocked.join(", ")}` : "\nthe test API works");
process.exit(fails.length ? 1 : blocked.length ? 2 : 0);
