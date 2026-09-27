#!/usr/bin/env node
/* shots: screenshots of places on the island, for art reviews (before/after). Uses ?debug=1's
   window.__island.teleport, at 1x (the game's own zoom) and a 2x crop around pi.

     node shots.mjs after                          the default places: falls, koi, cave
     node shots.mjs before falls=28,27.5 koi=69,47  named places, in tiles
     HOUR=21 node shots.mjs night                   any hour of the island clock

   Writes tools/out/shots/<tag>-<place>-1x.png and -2x.png. For a "before", check out the older
   js/world.js first (git show <sha>:js/world.js > js/world.js), shoot, then restore it. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out", "shots");
mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || "shot";
const named = process.argv.slice(3).map((a) => { const [n, xy] = a.split("="); const [x, y] = xy.split(",").map(Number); return [n, x, y]; });
const places = named.length ? named : [["falls", 28, 27.5], ["koi", 69, 47], ["cave", 41, 22.5]];
const PORT = 8500 + Math.floor(Math.random() * 300);
const server = await serve(PORT);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?debug=1&islandhour=${process.env.HOUR || 11}#island`);
await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 20000 });
await page.waitForTimeout(2500);
await page.click(".w-cv", { position: { x: 5, y: 500 } });
for (const [name, tx, ty] of places) {
  await page.evaluate(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 8), [tx, ty]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${tag}-${name}-1x.png`), clip: { x: 360, y: 90, width: 880, height: 560 } });
  await page.screenshot({ path: join(OUT, `${tag}-${name}-2x.png`), clip: { x: 600, y: 240, width: 400, height: 260 } });
}
await browser.close(); server.close();
console.log(`wrote ${places.length * 2} shots to tools/out/shots/` + (errors.length ? `\nconsole errors: ${errors.join(" | ")}` : ""));
process.exit(errors.length ? 1 : 0);
