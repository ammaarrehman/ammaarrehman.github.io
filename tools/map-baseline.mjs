#!/usr/bin/env node
/* map-baseline: records how the island's map behaves at a git revision, for the D11-B parity test in
   scenarios.mjs. For every tile: its type, whether it can be walked, its height; for every pixel:
   whether feet stop there and what ground is painted there; every prop; and a hash of the painted
   ground. Done per engine, since sin and cos may round differently in each.

   The revision's js/world.js is served with one line added inside the island (a read-only hook that
   exposes at, walkable, lvl, solidPx, kAt, props and the ground canvas), so it works on code from
   before the debug API had layers. Nothing in the repo changes except the fixture.

     node tools/map-baseline.mjs                 the revision before D11-B (bbadcae)
     node tools/map-baseline.mjs --rev=HEAD      another revision
*/
import { chromium, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { mapDigest, finish } from "./mapdigest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REV = (process.argv.find((a) => a.startsWith("--rev=")) || "--rev=bbadcae").slice(6);
const src = execFileSync("git", ["show", `${REV}:js/world.js`], { cwd: ROOT, encoding: "utf8" });
const ANCHOR = "  if (DEBUG) window.__island = {";
if (!src.includes(ANCHOR)) throw new Error("no debug block to hook in " + REV);
const HOOK = "  window.__mapapi = { at: at, walk: walkable, lvl: lvl, blocked: solidPx, kind: function (px, py) { return [\"\", \"grass\", \"dirt\", \"sand\", \"water\"][kAt(px, py)]; }, props: function () { return props.map(function (p) { return [p.kind, p.tx, p.ty]; }); }, png: function () { return ground.toDataURL(); } };\n";
const patched = src.replace(ANCHOR, HOOK + ANCHOR);

const PORT = 8700 + Math.floor(Math.random() * 90);
const server = await serve(PORT);
const out = { rev: execFileSync("git", ["rev-parse", "--short", REV], { cwd: ROOT, encoding: "utf8" }).trim(), engines: {} };
for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: patched }));
  await page.goto(`http://localhost:${PORT}/?debug=1&step=1&islandhour=11#island`);
  await page.waitForFunction(() => window.__mapapi && window.__island && window.__island.getState().open, null, { timeout: 30000 });
  out.engines[name] = finish(await page.evaluate(mapDigest, "old"));
  console.log(name, out.engines[name].pxBlocked, "blocked px,", out.engines[name].props.slice(0, 12), "props hash");
  await browser.close();
}
server.close();
mkdirSync(join(ROOT, "tools/fixtures"), { recursive: true });
writeFileSync(join(ROOT, "tools/fixtures/map-baseline.json"), JSON.stringify(out, null, 1) + "\n");
console.log("wrote tools/fixtures/map-baseline.json from", out.rev);
