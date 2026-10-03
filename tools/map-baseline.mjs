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
     node tools/map-baseline.mjs --rev=X --check compare X with the fixture instead of writing it

   Each revision is served whole as far as the island goes: its js/world.js and js/site.js, and from
   MAP-A1 (4a7d9b5) on its map module, js/maps/home.js. A revision from before MAP-A has none, and none is
   asked for. */
import { chromium, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { mapDigest, finish } from "./mapdigest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REV = (process.argv.find((a) => a.startsWith("--rev=")) || "--rev=bbadcae").slice(6);
const CHECK = process.argv.includes("--check");
const show = (path) => { try { return execFileSync("git", ["show", `${REV}:${path}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return null; } };
const src = show("js/world.js"), siteSrc = show("js/site.js"), mapSrc = show("js/maps/home.js");
if (!src || !siteSrc) throw new Error(`no js/world.js or js/site.js at ${REV}`);
console.log(`${REV}: ${mapSrc ? "has a map module (js/maps/home.js), served with it" : "has no map module (before MAP-A)"}`);
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
  await page.route(/\/js\/site\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: siteSrc }));
  const mapAsked = [];
  await page.route(/\/js\/maps\/home\.js/, (r) => { mapAsked.push(1); return mapSrc ? r.fulfill({ status: 200, contentType: "text/javascript", body: mapSrc }) : r.fulfill({ status: 404, body: "" }); });
  await page.goto(`http://localhost:${PORT}/?debug=1&step=1&islandhour=11#island`);
  await page.waitForFunction(() => window.__mapapi && window.__island && window.__island.getState().open, null, { timeout: 30000 });
  out.engines[name] = finish(await page.evaluate(mapDigest, "old"));
  console.log(`  ${name}: the map module was ${mapAsked.length ? "asked for " + mapAsked.length + " time(s)" : "not asked for"}`);
  console.log(name, out.engines[name].pxBlocked, "blocked px,", out.engines[name].props.slice(0, 12), "props hash");
  await browser.close();
}
server.close();
if (CHECK) {
  const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/map-baseline.json"), "utf8"));
  let same = true;
  for (const [name, d] of Object.entries(out.engines)) {
    const f = FIX.engines[name], diff = Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(d[k]));
    console.log(`  ${name}: ${diff.length ? "DIFFERS from" : "matches"} the fixture (${FIX.rev}) in all ${Object.keys(f).length} fields${diff.length ? ": " + diff.join(", ") : ""}`);
    if (diff.length) same = false;
  }
  console.log(same ? `${out.rev} matches tools/fixtures/map-baseline.json (not written)` : `${out.rev} DIFFERS from the fixture (not written)`);
  process.exit(same ? 0 : 1);
}
mkdirSync(join(ROOT, "tools/fixtures"), { recursive: true });
writeFileSync(join(ROOT, "tools/fixtures/map-baseline.json"), JSON.stringify(out, null, 1) + "\n");
console.log("wrote tools/fixtures/map-baseline.json from", out.rev);
