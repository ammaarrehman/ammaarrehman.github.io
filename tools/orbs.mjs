#!/usr/bin/env node
/* orbs: the blurry-orb regression test (AUDIT.md, handoff 3 B1). For each main-page orb, in
   Chromium and WebKit at 2x:
     1. the window buttons: minimize its window, restore it from the dock
     2. the browser: hide the tab behind another one, bring it back
   After each, the canvas's backing store must match its size on screen (width = clientWidth x dpr,
   within 1 px), and a still frame of the orb must look like one from a fresh load: same sharpness
   and nearly the same pixels.

     node orbs.mjs
*/
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import { serve } from "./serve.mjs";

const PORT = 8700 + Math.floor(Math.random() * 200);
const server = await serve(PORT);
const URL = `http://localhost:${PORT}/`;
let failed = 0;

// a still, repeatable frame: pause the orb and redraw it at t = 4
const still = (page, i) => page.evaluate((i) => { const o = window.orbs[i]; o.pause(true); o.palette("eclipse"); }, i);
const resume = (page, i) => page.evaluate((i) => window.orbs[i].pause(false), i);
const sizes = (page) => page.evaluate(() => [...document.querySelectorAll("canvas.orb")].map((c) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: Math.min(devicePixelRatio, 2) })));
async function shot(page, i) {
  const el = (await page.$$("canvas.orb"))[i];
  await el.scrollIntoViewIfNeeded();
  return PNG.sync.read(await el.screenshot());
}
// mean absolute difference per channel (0..255), and sharpness as the mean horizontal gradient
function compare(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { diff: 255, sharpA: 0, sharpB: 0 };
  let d = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) d += Math.abs(a.data[i + c] - b.data[i + c]);
    if ((i / 4) % a.width) { sa += Math.abs(a.data[i] - a.data[i - 4]); sb += Math.abs(b.data[i] - b.data[i - 4]); }
  }
  const n = a.width * a.height;
  return { diff: d / (n * 3), sharpA: sa / n, sharpB: sb / n };
}
function check(label, before, after, fresh, now) {
  const s = after;
  const sizeOk = s.cw > 0 && Math.abs(s.w - Math.round(s.cw * s.dpr)) <= 1 && Math.abs(s.h - Math.round(s.ch * s.dpr)) <= 1;
  const c = compare(fresh, now);
  const lookOk = c.diff < 12 && c.sharpB >= c.sharpA * 0.85;      // the hero orb leans toward the pointer, so allow some drift; blur shows as lost sharpness
  if (!sizeOk || !lookOk) failed++;
  console.log(`${sizeOk && lookOk ? "ok  " : "FAIL"} ${label}: backing ${s.w}x${s.h} for ${s.cw}x${s.ch} css at ${s.dpr}x; pixel diff ${c.diff.toFixed(2)}, sharpness ${c.sharpB.toFixed(2)} vs fresh ${c.sharpA.toFixed(2)}`);
}

for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("booted", "1"); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(URL); await page.waitForTimeout(2500);
  const wins = await page.evaluate(() => [...document.querySelectorAll("canvas.orb")].map((c) => c.closest("[data-win]")?.getAttribute("data-win")));
  const fresh = [];
  for (let i = 0; i < wins.length; i++) { await still(page, i); fresh.push(await shot(page, i)); await resume(page, i); }

  for (let i = 0; i < wins.length; i++) {
    // 1. the window buttons
    await page.click(`[aria-label="Minimize the ${wins[i]} window"]`); await page.waitForTimeout(800);
    await page.click(`[aria-label="Restore the ${wins[i]} window"]`); await page.waitForTimeout(900);
    const s1 = (await sizes(page))[i];
    await still(page, i); check(`${name} ${wins[i]}: minimize, restore`, null, s1, fresh[i], await shot(page, i)); await resume(page, i);
  }
  // 2. the browser: headless tabs never report hidden, so hide and show the page the way the
  // browser does when a tab is switched away and back: visibilityState plus the event
  const flip = (state) => page.evaluate((st) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => st });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => st === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
  await flip("hidden"); await page.waitForTimeout(600);
  const hidden = "simulated";
  await flip("visible"); await page.waitForTimeout(800);
  const s2 = await sizes(page);
  for (let i = 0; i < wins.length; i++) { await still(page, i); check(`${name} ${wins[i]}: tab hidden (${hidden}), shown`, null, s2[i], fresh[i], await shot(page, i)); await resume(page, i); }
  await browser.close();
}
server.close();
console.log(failed ? `\n${failed} failed` : "\nall orbs sharp");
process.exit(failed ? 1 : 0);
