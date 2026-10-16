#!/usr/bin/env node
/* mapb-preview (MAP-B B2b): the staged 150 x 120 island, running in the real game, on this machine only.

   It serves the site like tools/serve.mjs (on 127.0.0.1, every header from _headers) with one difference: a
   request for js/maps/home.js gets an in-memory wrapper instead of the file. The wrapper is the staged map
   (tools/maps/staged/home.js, which registers window.ISLAND_MAPS_STAGED.home) followed by two lines that make it
   the island's map (window.ISLAND_MAPS.home) and set the preview flag (window.ISLAND_MAP_PREVIEW = "mapb-staged").
   Nothing is written anywhere: js/maps/home.js is never touched, and tools/ is never deployed.

   js/world.js runs a staged map only with that flag on a loopback host (localhost, 127.0.0.1, [::1]); there it
   is the terrain-only preview (no landmarks, creatures, vehicles or rift yet, a "MAP-B staged preview" badge,
   and no save read or written). Anywhere else the island refuses it.

     node tools/mapb-preview.mjs           http://127.0.0.1:8600/?debug=1#island
     PORT=8123 node tools/mapb-preview.mjs

   B3b: the content preview, a second mode beside the terrain preview (which stays exactly as it was). With
   --content (or startPreview(port, { content: true })) the wrapper also carries the staged content layer
   (tools/maps/staged/home.content.js, which registers window.ISLAND_MAPS_STAGED_CONTENT.home), attaches it to the
   map as its content section and sets the flag "mapb-content". The game then decodes the content against this
   terrain and moves on both collision layers; the same loopback, save and deploy walls hold. Tests can pass a
   synthetic content object instead ({ content: object }), served the same way and never written anywhere.

     node tools/mapb-preview.mjs --content

   B3c1: the content preview runs the home systems whose content is authored (js/world.js's SYS): so far the
   buildings, the visitor centre and the supply depot, with their doors and rooms. The terrain preview is unchanged.
   B3c2 adds the outpost bunker and its room. B3c3 adds the bunker compound's wall, with its open west entrance.

   Also imported by tools/mapb-decode.mjs and tools/mapb-runtime.mjs. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const STAGED = join(ROOT, "tools/maps/staged/home.js");
export const PREVIEW_FLAG = "mapb-staged";
export const CONTENT_FLAG = "mapb-content";
export const STAGED_CONTENT = join(ROOT, "tools/maps/staged/home.content.js");

/* the wrapper, built in memory from the staged file as it is now */
export function stagedWrapper() {
  return readFileSync(STAGED, "utf8") +
    "\n/* MAP-B local preview (tools/mapb-preview.mjs): built in memory, never written to js/ or deployed */\n" +
    "window.ISLAND_MAPS = window.ISLAND_MAPS || {}; window.ISLAND_MAPS.home = window.ISLAND_MAPS_STAGED.home;\n" +
    `window.ISLAND_MAP_PREVIEW = ${JSON.stringify(PREVIEW_FLAG)};\n`;
}
export const OVERRIDES = { "/js/maps/home.js": () => ({ type: "text/javascript", body: stagedWrapper() }) };
/* the content preview's wrapper: the staged terrain, then the content layer (the staged file, or a synthetic object a
   test passes), attached as the map's content section, and the content flag */
export function contentWrapper(content) {
  const layer = content && typeof content === "object"
    ? `(window.ISLAND_MAPS_STAGED_CONTENT = window.ISLAND_MAPS_STAGED_CONTENT || {}).home = ${JSON.stringify(content)};\n`
    : readFileSync(STAGED_CONTENT, "utf8");
  return readFileSync(STAGED, "utf8") + "\n" + layer +
    "\n/* MAP-B local content preview (tools/mapb-preview.mjs --content): built in memory, never written to js/ or deployed */\n" +
    "window.ISLAND_MAPS = window.ISLAND_MAPS || {}; window.ISLAND_MAPS.home = Object.assign({}, window.ISLAND_MAPS_STAGED.home, { content: window.ISLAND_MAPS_STAGED_CONTENT.home });\n" +
    `window.ISLAND_MAP_PREVIEW = ${JSON.stringify(CONTENT_FLAG)};\n`;
}
export function startPreview(port, opts = {}) {
  if (!opts.content) return serve(port, { overrides: OVERRIDES });
  return serve(port, { overrides: { "/js/maps/home.js": () => ({ type: "text/javascript", body: contentWrapper(opts.content) }) } });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8600, content = process.argv.includes("--content");
  await startPreview(port, { content });
  console.log(`MAP-B ${content ? "content" : "staged"} preview (local only): http://127.0.0.1:${port}/?debug=1#island  (Ctrl+C to stop)`);
}
