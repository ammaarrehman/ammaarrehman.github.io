#!/usr/bin/env node
/* atlas: bakes the island's man-made sprites (tools/props-src.js: buildings, landmarks, lamps,
   crates, the outpost's kit, the park gate) into img/atlas/props.png + props.json, and writes the
   frame table into js/world.js (`var PROPS = {...};`), the way tools/envart.py does for the
   environment (handoff 3 D2). The game loads the PNG instead of drawing these at runtime.

   Outlines follow D1 rule 4: each outline pixel is its neighbour's own colour taken down to a cool
   dark (toward blue-violet, never black), one step lighter on the lit side (above or left of the
   shape).

     node tools/atlas.mjs            bake
     node tools/atlas.mjs preview    write tools/out/atlas-preview.png only
*/
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const preview = process.argv[2] === "preview";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: readFileSync(join(ROOT, "tools/props-src.js"), "utf8") });
const out = await page.evaluate(() => {
  const S = window.buildProps(), COOL = [24, 20, 48], NO_OUTLINE = { cave: 1 };
  function outlined(name, src) {
    const w0 = src.width, h0 = src.height, c = document.createElement("canvas");
    c.width = w0 + 2; c.height = h0 + 2;
    const g = c.getContext("2d"); g.drawImage(src, 1, 1);
    if (NO_OUTLINE[name]) return c;
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data, W = c.width, H = c.height;
    const A = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 40;
    const put = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (A(x, y)) continue;
      // the shape to the right or below: this pixel is on its lit side
      for (const [dx, dy, lit] of [[1, 0, 1], [0, 1, 1], [-1, 0, 0], [0, -1, 0]]) {
        if (!A(x + dx, y + dy)) continue;
        const i = ((y + dy) * W + x + dx) * 4, k = lit ? 0.46 : 0.3;
        put.push([x, y, [0, 1, 2].map((ch) => Math.round(d[i + ch] * k + COOL[ch] * (1 - k)))]);
        break;
      }
    }
    for (const [x, y, rgb] of put) { const i = (y * W + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return c;
  }
  const items = Object.keys(S).map((n) => [n, outlined(n, S[n])]).sort((a, b) => b[1].height - a[1].height || a[0].localeCompare(b[0]));
  const W = 256; let x = 0, y = 0, rowh = 0; const table = {};
  for (const [n, c] of items) {
    if (x + c.width > W) { x = 0; y += rowh + 1; rowh = 0; }
    table[n] = [x, y, c.width, c.height]; x += c.width + 1; rowh = Math.max(rowh, c.height);
  }
  const atlas = document.createElement("canvas"); atlas.width = W; atlas.height = y + rowh;
  const g = atlas.getContext("2d");
  for (const [n, c] of items) g.drawImage(c, table[n][0], table[n][1]);
  return { png: atlas.toDataURL("image/png"), table, w: atlas.width, h: atlas.height };
});
await browser.close();

const png = Buffer.from(out.png.split(",")[1], "base64");
mkdirSync(join(ROOT, "tools/out"), { recursive: true });
writeFileSync(join(ROOT, "tools/out/atlas-preview.png"), png);
if (preview) { console.log("preview", out.w, "x", out.h); process.exit(0); }
writeFileSync(join(ROOT, "img/atlas/props.png"), png);
writeFileSync(join(ROOT, "img/atlas/props.json"), JSON.stringify(out.table));
const worldPath = join(ROOT, "js/world.js"), world = readFileSync(worldPath, "utf8");
const line = "var PROPS = " + JSON.stringify(out.table) + ";\n";
const next = world.replace(/var PROPS = \{.*?\};\n/, line);
if (next === world && !world.includes(line)) console.log("note: no `var PROPS = {...};` line in js/world.js to update");
else writeFileSync(worldPath, next);
console.log("atlas", out.w, "x", out.h, Object.keys(out.table).length, "sprites");
