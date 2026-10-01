#!/usr/bin/env node
/* hands: the background hands must never draw before they're built. js/hands.js draws on scroll
   (reduced motion), on resize and on a theme change, and all three can fire while assets/hands.json
   or the font is still loading; drawing then threw a drawImage TypeError (found 2026-10-01).

   For Chromium, WebKit and Firefox, with reduced and normal motion, hands.json is held back while
   each of those three happens; then it's let through. Each run must log no page error, and the
   canvas must switch on with the hands drawn in it. With reduced motion, a scroll after that must
   still redraw them (the hands move apart and together as the page scrolls).

     node hands.mjs        exits 1 on a failure, 2 if nothing failed but an engine couldn't launch
*/
import { chromium, webkit, firefox } from "playwright";
import { serve } from "./serve.mjs";

const PORT = 8700 + Math.floor(Math.random() * 200);
const server = await serve(PORT);
const fails = [], blocked = [];
const check = (name, what, ok, why) => { console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(9)} ${what}${ok ? "" : "  (" + why + ")"}`); if (!ok) fails.push(`${name}: ${what}`); };

// how much of the hands canvas is inked, and a hash of it, to see that it was drawn and redrawn
const canvas = (page) => page.evaluate(() => {
  const c = document.querySelector("canvas.hands"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let ink = 0, h = 2166136261;
  for (let i = 3; i < d.length; i += 4) if (d[i]) { ink++; h = Math.imul(h ^ (i + d[i]), 16777619) >>> 0; }
  return { on: c.classList.contains("on"), ink, h };
});

const TRIGGERS = {
  scroll: (page) => page.evaluate(() => window.scrollTo(0, 1500)),
  resize: async (page) => { await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(300); },   // past the 150 ms debounce
  theme: (page) => page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"))
};

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  for (const motion of ["reduce", "no-preference"]) for (const [trigger, fire] of Object.entries(TRIGGERS)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: motion });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
    let release; const held = new Promise((r) => (release = r));
    await page.route(/assets\/hands\.json/, async (route) => { await held; await route.continue(); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
    await fire(page); await page.waitForTimeout(100);
    release();
    const drawn = await page.waitForFunction(() => document.querySelector("canvas.hands")?.classList.contains("on"), null, { timeout: 15000 }).then(() => true, () => false);
    const c = await canvas(page);
    const label = `${motion === "reduce" ? "reduced" : "normal"} motion, ${trigger} before load:`;
    check(name, `${label} no page error`, !errors.length, errors.join(" | "));
    check(name, `${label} the hands are drawn once loaded`, drawn && c.on && c.ink > 1000, JSON.stringify({ drawn, on: c.on, ink: c.ink }));
    if (motion === "reduce" && trigger === "scroll") {
      // scroll events fire on the next frame, so wait two before reading the canvas
      const scrollTo = (y) => page.evaluate((y) => new Promise((r) => { window.scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), y);
      await scrollTo(0); const a = await canvas(page);
      await scrollTo(1e6); const b = await canvas(page);
      check(name, "reduced motion: scrolling after load still redraws the hands", a.h !== b.h && b.ink > 1000 && !errors.length, JSON.stringify({ top: a.h, bottom: b.h, errors }));
    }
    await ctx.close();
  }
  await browser.close();
}
server.close();
console.log(fails.length ? `\n${fails.length} failed:\n- ` + fails.join("\n- ") : blocked.length ? `\nnothing failed; blocked: ${blocked.join(", ")}` : "\nall passed");
process.exit(fails.length ? 1 : blocked.length ? 2 : 0);
