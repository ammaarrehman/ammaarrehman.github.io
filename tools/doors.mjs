#!/usr/bin/env node
/* doors: the door transition test (handoff 3 B2). For every building with a room, in Chromium:
   walk up, press E, go in, walk out, and report the slowest frame of island work during each
   transition (update + render, from ?debug=1's window.__island.frames). Target: under 16 ms.
   Each door is tried cold (straight in, so the room finishes building while the iris closes)
   and warm (after standing nearby, so it was built ahead). Then once under reduced motion,
   where the iris becomes a 150 ms crossfade.

     node doors.mjs
*/
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const PORT = 8900 + Math.floor(Math.random() * 90);
const server = await serve(PORT);
const browser = await chromium.launch();
let failed = 0;

async function island(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug=1#island`);
  await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 15000 });
  await page.waitForTimeout(2500);                       // the title card and the opening iris
  await page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
  return { ctx, page, errors };
}
const state = (page) => page.evaluate(() => window.__island.getState());
const worst = (page) => page.evaluate(() => { const f = window.__island.frames(true); return f.length ? Math.max(...f) : 0; });

async function throughDoor(page, door, warm) {
  await page.evaluate((d) => window.__island.teleport(d.x, d.y + 8), door);
  await page.waitForTimeout(warm ? 1500 : 30);
  const builtBefore = (await state(page)).doors.find((d) => d.id === door.id).built;
  await worst(page);                                     // clear
  await page.keyboard.press("e");
  await page.waitForTimeout(700);
  const inMs = await worst(page), s1 = await state(page);
  await page.keyboard.down("ArrowDown");
  for (let i = 0; i < 40 && (await state(page)).room; i++) await page.waitForTimeout(100);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(700);
  const outMs = await worst(page), s2 = await state(page);
  const ok = s1.room === door.room && !s2.room && inMs < 16 && outMs < 16;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${door.id.padEnd(8)} ${warm ? "warm" : "cold"} (built ahead: ${builtBefore ? "yes" : "no "})  worst frame in ${inMs.toFixed(1)} ms, out ${outMs.toFixed(1)} ms${s1.room !== door.room ? "  (didn't enter)" : ""}${s2.room ? "  (didn't leave)" : ""}`);
}

{
  const { ctx, page, errors } = await island();
  const doors = (await state(page)).doors;
  for (const d of doors) await throughDoor(page, d, false);
  for (const d of doors) await throughDoor(page, d, true);
  if (errors.length) { failed++; console.log("FAIL console:", errors.slice(0, 3)); }
  await ctx.close();
}
{
  const { ctx, page, errors } = await island({ reducedMotion: "reduce" });
  const d = (await state(page)).doors[0];
  await page.evaluate((d) => window.__island.teleport(d.x, d.y + 8), d); await page.waitForTimeout(100);
  await page.keyboard.press("e"); await page.waitForTimeout(40);
  const s = await state(page); await page.waitForTimeout(300); const s2 = await state(page);
  const ok = s.room === d.room && s.xfade && !s.iris && !s2.xfade && !errors.length;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} reduced motion: cut straight in with a crossfade (fading: ${s.xfade}, iris: ${s.iris}, done after 300 ms: ${!s2.xfade})`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? `\n${failed} failed` : "\nall doors under 16 ms");
process.exit(failed ? 1 : 0);
