#!/usr/bin/env node
/* map-content (MAP-B B3b): compiles the home island's authored content, tools/maps/home.content.mjs, into the staged
   content file, tools/maps/staged/home.content.js, against the staged terrain (tools/maps/home.src.mjs, compiled
   in memory by tools/map-compile.mjs's compile(), exactly as map-compile does). The schema and rules are in
   tools/maps/content.mjs.

   It never writes the terrain's staged file, and it writes nothing under js/ (map-compile's guard: only
   tools/maps/staged/ and tools/out/). It refuses to write if the tracked terrain file isn't the current compile
   (run map-compile first), so the content is always bound to the terrain the game will load beside it.
   Deterministic: two runs give the same bytes.

     node tools/map-content.mjs            compile and write tools/maps/staged/home.content.js
     node tools/map-content.mjs --check    compile and compare with the tracked file, write nothing
     node tools/map-content.mjs --stdout   compile and print it */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, STAGED_PATH, loadSource, compile, serialize, writeOut } from "./map-compile.mjs";
import { compileContent, serializeContent } from "./maps/content.mjs";

export const CONTENT_SOURCE = join(ROOT, "tools/maps/home.content.mjs");
export const CONTENT_STAGED = join(ROOT, "tools/maps/staged/home.content.js");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export async function loadContent(path = CONTENT_SOURCE) {
  const text = readFileSync(path, "utf8");
  const mod = await import(pathToFileURL(path).href + "?sha=" + sha256(text));
  return { content: mod.default, contentSha256: sha256(text) };
}
/* the terrain as the game will load it: compiled from its source, and that compile must be the tracked file */
export async function terrain() {
  const { src, sourceSha256 } = await loadSource();
  const m = compile(src, sourceSha256);
  const text = serialize(m, src);
  const tracked = existsSync(STAGED_PATH) ? readFileSync(STAGED_PATH, "utf8") : null;
  return { src, m, sourceSha256, current: tracked === text, terrainText: text };
}
export async function buildContentText(content, contentSha256) {
  const t = await terrain();
  const c = compileContent(content, t.src, t.m);
  return { text: serializeContent(c, { id: t.m.id, sourceSha256: contentSha256, terrainSha256: t.sourceSha256 }), compiled: c, terrain: t };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const { content, contentSha256 } = await loadContent();
  let out;
  try { out = await buildContentText(content, contentSha256); }
  catch (e) { console.error(`map-content: ${e.message}`); process.exit(1); }
  const { text, compiled, terrain: t } = out;
  if (!t.current) { console.error("map-content: tools/maps/staged/home.js isn't the current terrain compile; run node tools/map-compile.mjs first"); process.exit(1); }
  if (args.includes("--stdout")) process.stdout.write(text);
  else if (args.includes("--check")) {
    const cur = existsSync(CONTENT_STAGED) ? readFileSync(CONTENT_STAGED, "utf8") : null;
    if (cur !== text) { console.error(`map-content --check: tools/maps/staged/home.content.js is ${cur === null ? "missing" : "stale"}; run node tools/map-content.mjs`); process.exit(1); }
    console.log(`map-content --check: tools/maps/staged/home.content.js is current (${Buffer.byteLength(text)} bytes, sha256 ${sha256(text).slice(0, 16)}; ${compiled.records.length} records, ${compiled.solidTiles} solid tiles, ${compiled.footPixels} foot pixels)`);
  } else {
    const p = writeOut(CONTENT_STAGED, text);
    console.log(`map-content: wrote ${p.replace(ROOT + "/", "")} (${Buffer.byteLength(text)} bytes; ${compiled.records.length} records, ${compiled.solidTiles} solid tiles, ${compiled.footPixels} foot pixels)`);
  }
}
