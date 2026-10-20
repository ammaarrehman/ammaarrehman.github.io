#!/usr/bin/env node
/* mapb-stations (MAP-B B3d4b): format 1's eleven outdoor stations moved to their approved MAP-B places as interaction-only
   content records (kind station: an anchor, an approach and the place each is tied to; no collision, nothing drawn of its
   own), and the stations system turned on in the content preview: [E] and touch, the cards, the logs, the shrine's seal,
   the cave terminal, the drink stand, the boat, the tour, deep links, goto, the big map and the menu. The tower's and the
   lighthouse's stations stand on their B3d4a bases (anchors 95,27 and 140,43) and are used from the bases' approaches
   (95,28 and 140,44). Real content, served through the content preview (tools/mapb-preview.mjs --content); nothing
   synthetic is written anywhere.

   1. Node, the content and its compiler:
      - the tracked content file is the current compile: the ten earlier records exactly as committed at B3d4a (their
        compiled bytes pinned), then the eleven stations; still 288 solid tiles, no foot pixel (the stations add none);
      - each station against B3a's plan (anchor, approach), the approved source it is tied to (B1e's markers, log sites,
        plazas and berth; the B3d4a bases) and format 1 (the same ids, one solid tile each there); its approach open ground,
        reached from the spawn, in [E]'s reach;
      - the game's ids and words: the compiler's, the decoder's and the completeness list's ids are format 1's outdoor
        stations; every string literal of B3d4a's js/world.js (the cards, the secrets, the terminal) is still in it;
      - malformed records, each caught by its rule (the new stations rule, and the schema).
   2. Browser (Chromium and WebKit; Firefox tried and reported BLOCKED if it can't launch), the game itself:
      - production and the terrain preview as before; the content preview: the stations system on and nothing else new;
        both locked painter digests; the collision layer unchanged by the stations;
      - every station: the planner from the spawn to its approach, [E] there (the card's title, words and links the same as
        format 1's, compared by hash, never printed), the prompt, walking over a free-standing station's tile;
      - the tower and the lighthouse: [E] from the approach and the tiles beside it, pi pushed into the base stays off it;
      - progression in memory: the logs one by one, four (the terminal's evolve), eight (the seal's cut at the shrine, the
        shrine opening; no rift, which isn't migrated), the cave terminal (its commands, none printing a secret here), the
        drink stand, the boat, the tour, deep links, goto, the big map and the menu; nothing stored, nothing read;
      - phones (taps on a base's art and on a sprite, the touch prompt); completeness; decoder refusals; code mutations
        (Chromium); performance;
      - review screenshots (not baselines) into tools/out/mapb/b3d4b/, with a labelled diagnostic overlay the test draws over
        the page (never the game).

     node tools/mapb-stations.mjs
     ENGINES=chromium node tools/mapb-stations.mjs */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";
import { startPreview } from "./mapb-preview.mjs";
import { STAGED_PATH } from "./map-compile.mjs";
import { resolveContent, contentProblems, contentLayers, ContentError, STATION_IDS, STATION_PLACES } from "./maps/content.mjs";
import { loadContent, buildContentText, terrain, CONTENT_STAGED } from "./map-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// its review screenshots go to tools/out/mapb/b3d4b/; MAPB_SHOTS names another folder under tools/out/ (a later batch's regression run)
const OUT = join(ROOT, "tools/out", process.env.MAPB_SHOTS || "mapb/b3d4b");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const T = 16;
let fails = 0; const blocked = [], perf = [], notes = [];
const check = (eng, name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${name}${detail ? ": " + detail : ""}`); };
const copy = (o) => JSON.parse(JSON.stringify(o));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const FIX = JSON.parse(readFileSync(join(ROOT, "tools/fixtures/mapb-ground.json"), "utf8"));
const TERRAIN_SHA = FIX.terrain.rgbaSha256, GROUND_SHA = FIX.ground.rgbaSha256;
const B3D4A = "1c42050f072364d72348d9a5bc43a0c9dfd07673";                // the commit before this batch

/* the approved placements (B3a's plan; the tower's and the lighthouse's as Ammaar approved at B3d4a), written out so a
   change anywhere shows: anchor, approach, the place it is tied to, and what it is used for */
const ST = {
  sign:       { anchor: [74, 76], approach: [74, 77], place: { plaza: "arrival-plaza" }, log: false },
  uplink:     { anchor: [121, 81], approach: [121, 82], place: { logSite: "uplink" }, log: true },
  tower:      { anchor: [95, 27], approach: [95, 28], place: { landmark: "tower-base" }, log: true },
  lighthouse: { anchor: [140, 43], approach: [140, 44], place: { landmark: "lighthouse-base" }, log: true },
  macbook:    { anchor: [105, 57], approach: [105, 58], place: { logSite: "macbook" }, log: true },
  tablet:     { anchor: [82, 48], approach: [82, 49], place: { logSite: "tablet" }, log: true },
  mailbox:    { anchor: [50, 81], approach: [50, 82], place: { logSite: "mailbox" }, log: true },
  drink:      { anchor: [53, 87], approach: [53, 88], place: { plaza: "village-square" }, log: false },
  shrine:     { anchor: [14, 19], approach: [14, 20], place: { marker: "shrine" }, log: false },
  cave:       { anchor: [66, 24], approach: [66, 25], place: { marker: "cave-mouth" }, log: false },
  boat:       { anchor: [79, 97], approach: [79, 96], place: { berth: "south" }, log: false }
};
const IDS = Object.keys(ST);
const BASES = { "tower-base": { x0: 94, y0: 25, x1: 96, y1: 27, station: "tower" }, "lighthouse-base": { x0: 139, y0: 42, x1: 140, y1: 43, station: "lighthouse" } };
const onBase = (seen) => seen.filter(([x, y]) => Object.values(BASES).some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1));
const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/* ════════ 1. Node: the records and the compiler ════════ */
const t = await terrain(), { src, m } = t, W = m.w, H = m.h, PW = W * T;
const { content: REAL, contentSha256 } = await loadContent();
const built = await buildContentText(REAL, contentSha256), again = await buildContentText(REAL, contentSha256);
check("node", "the tracked content file is the current compile, bound to the staged terrain; two compiles give the same bytes", readFileSync(CONTENT_STAGED, "utf8") === built.text && built.text === again.text && built.text.includes(`"terrainSha256": "${t.sourceSha256}"`) && t.current,
  `${Buffer.byteLength(built.text)} bytes, terrain ${t.sourceSha256.slice(0, 16)}`);
const RECS = built.compiled.records, LAYER = contentLayers(RECS, W, H);
const DATA = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(CONTENT_STAGED, "utf8"), c); return c.window.ISLAND_MAPS_STAGED_CONTENT.home; })();
// B3d4a's ten compiled records, as committed at 1c42050 (the sha256 of their JSON, in order)
const TEN = "8e0bac4d94b735fce70b13fd8de1669aa941b66166d7998dfa999ed4aae6b226";
check("node", "the content: B3c's to B3d4a's ten records exactly as committed (their compiled records byte for byte), then the eleven stations in the completeness list's order (since B3e1 the roam areas after them, tools/mapb-creatures.mjs); nothing else",
  createHash("sha256").update(JSON.stringify(DATA.records.slice(0, 10))).digest("hex") === TEN && DATA.records.length >= 21 && DATA.records.slice(10, 21).map((r) => `${r.id}:${r.kind}`).join() === IDS.map((id) => `${id}:station`).join() && DATA.records.slice(21).every((r) => r.kind === "roam"),
  DATA.records.slice(10, 21).map((r) => r.id).join(", "));
const PAST = contentLayers(RECS.slice(0, 10), W, H);
let sameLayer = PAST.solidTiles === LAYER.solidTiles; for (let i = 0; sameLayer && i < W * H; i++) if (PAST.tiles[i] !== LAYER.tiles[i]) sameLayer = false;
check("node", "the content passes every rule; 288 solid tiles and no foot pixel, exactly B3d4a's layer tile for tile: the stations add no collision", contentProblems(RECS, src, m).length === 0 && built.compiled.solidTiles === 288 && built.compiled.footPixels === 0 && sameLayer,
  `${built.compiled.solidTiles} solid tiles, ${built.compiled.footPixels} foot pixels, ${sameLayer ? "the same tiles as B3d4a's" : "TILES DIFFER FROM B3d4a's"}`);
const foot = (x, y) => { let n = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
const aimWet = (x, y) => { let n = 0; const fx = x * T + 8, fy = y * T + 10; for (let py = fy - 2; py <= fy + 1; py++) for (let px = fx - 4; px <= fx + 4; px++) n += m.px.foot[py * PW + px] ? 1 : 0; return n; };
const pathId = (x, y) => { const k = m.pathOf[y * W + x]; return k >= 0 ? src.corridors.paths[k].id : null; };
const bfs = (from, block) => { const dist = new Int32Array(W * H).fill(-1), q = [from[1] * W + from[0]]; dist[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [ax, ay] of N4) { const nx = x + ax, ny = y + ay, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || block(j) || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); } } return dist; };
const SPAWN = m.anchors.spawnTile, DIST = bfs(SPAWN, (i) => m.coll[i] !== 0 || LAYER.tiles[i] === 1);
const F1 = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); return c.window.ISLAND_MAPS.home; })();
const coll1 = (x, y) => F1.coll.values[parseInt(F1.coll.rows[y][x], 36)];
check("node", "format 1 (js/maps/home.js): the same eleven outdoor stations, each one tile, solid in its collision (MAP-B's add no collision: the approved B3d4b direction)",
  Object.keys(F1.stations).sort().join() === [...IDS].sort().join() && IDS.every((id) => coll1(...F1.stations[id]) !== 0), IDS.map((id) => `${id} ${F1.stations[id]}`).join("; "));
check("node", "the compiler's station ids (STATION_IDS) are the eleven, and its approved places (STATION_PLACES) are B3a's, as written out here", JSON.stringify(STATION_IDS) === JSON.stringify(IDS) && IDS.every((id) => JSON.stringify(STATION_PLACES[id]) === JSON.stringify(ST[id].place)));
for (const id of IDS) {
  const A = ST[id], r = RECS.find((q) => q.id === id), [ax, ay] = A.anchor, [px, py] = A.approach, pk = Object.keys(A.place)[0], pv = A.place[pk];
  check("node", `${id}: the record is a station at ${ax},${ay}, used from ${px},${py}, tied to ${pk} ${pv}; no tile, foot box, door or drawn box (it blocks nothing)`,
    r && r.kind === "station" && r.anchor.join() === A.anchor.join() && r.approach.join() === A.approach.join() && JSON.stringify(r.place) === JSON.stringify(A.place) && !r.tiles.length && !r.footPxBoxes.length && !r.doorTiles.length && !r.drawnPxBoxes.length && !r.art && !r.reserve,
    r ? JSON.stringify({ anchor: r.anchor, approach: r.approach, place: r.place }) : "no record");
  let src1 = null, ok1 = false;
  if (pk === "landmark") { const b = BASES[pv], lm = RECS.find((q) => q.id === pv); ok1 = lm && lm.kind === "landmark" && ax === Math.floor(b.x0 + (b.x1 - b.x0 + 1) / 2) && ay === b.y1 && px === ax && py === b.y1 + 1 && LAYER.tiles[ay * W + ax] === 1; src1 = `the base ${b.x0},${b.y0} to ${b.x1},${b.y1}: the middle of its front row, on the base (content solid, the base's own), used from the base's approach`; }
  else if (pk === "marker") { const mk = src.reserves.markers.find((q) => q.id === pv); ok1 = mk && mk.markerTile.join() === A.anchor.join() && mk.approachTile && mk.approachTile.join() === A.approach.join(); src1 = `B1e's marker ${pv} ${mk && mk.markerTile}, its approach ${mk && mk.approachTile}`; }
  else if (pk === "logSite") { const ls = src.planningMarkers.logSites.find((q) => q.id === pv); ok1 = ls && Math.max(Math.abs(ls.siteTile[0] - px), Math.abs(ls.siteTile[1] - py)) <= 1; src1 = `B1e's log site ${pv} ${ls && ls.siteTile} (${ls && ls.siteTile.join() === A.approach.join() ? "the approach itself" : "beside the approach"})`; }
  else if (pk === "plaza") { const pz = src.corridors.plazas.find((q) => q.id === pv), b = pz.plazaBox || src.exits.south.arrivalPlazaBox; ok1 = ax >= b.x0 && ax <= b.x1 && ay >= b.y0 && ay <= b.y1; src1 = `B1e's plaza ${pv} ${b.x0},${b.y0} to ${b.x1},${b.y1}`; }
  else if (pk === "berth") { const bt = src.exits.south.berthTile; ok1 = bt.join() === A.anchor.join() && [0, 1].includes(m.ground[ay * W + ax]) && m.coll[ay * W + ax] !== 0 && m.ground[py * W + px] === 6; src1 = `B1e's south berth ${bt} (at sea), the ferry pier's end ${A.approach} (dock)`; }
  check("node", `${id}: tied to its approved source: ${src1}`, ok1);
  const free = pk !== "landmark" && pk !== "berth", ai = ay * W + ax, pi2 = py * W + px, reach = Math.hypot(ax * T + 8 - (px * T + 8), ay * T + 12 - (py * T + 10));
  check("node", `${id}: ${free ? "its anchor open land (walkable terrain, no content, no foot-blocking pixel, not a bridge, dock or the pad); " : ""}its approach open ground (no content, pi's feet clear of every foot-blocking pixel), reached from the spawn (${DIST[pi2]} tiles), ${reach.toFixed(0)} px from the station (reach 26)`,
    (!free || (m.coll[ai] === 0 && !LAYER.tiles[ai] && !foot(ax, ay) && ![10, 6, 8].includes(m.ground[ai]))) && m.coll[pi2] === 0 && !LAYER.tiles[pi2] && !aimWet(px, py) && DIST[pi2] > 0 && reach < 26,
    `${pathId(px, py) || "off the paths"}; anchor ground ${m.ground[ai]}, level ${m.height[ai]}`);
  perf.push(`node: ${id}: walking distance from the spawn to its approach ${DIST[pi2]} tiles`);
}
{ // the game's ids and words: the decoder's, the completeness list's and STATION_WORDS' outdoor ids are the eleven; no string literal of B3d4a's world.js
  // is gone (the cards, the secrets, the terminal's lines; checked by presence, never printed: some are a CTF's payload)
  const W1 = readFileSync(join(ROOT, "js/world.js"), "utf8"), W0 = execFileSync("git", ["show", `${B3D4A}:js/world.js`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
  const dec = JSON.parse((W1.match(/var STATION_IDS = (\[[^\]]*\])/) || [])[1] || "null");
  const comp = JSON.parse((W1.match(/\["station", (\[[^\]]*\]), "stations"\]/) || [])[1] || "null");
  const words = [...(W1.match(/var STATION_WORDS = \[([\s\S]*?)\n  \];/) || ["", ""])[1].matchAll(/\{ id: "([a-z]+)"(, room: "[a-z]+")?/g)].filter((q) => !q[2]).map((q) => q[1]);
  check("node", "js/world.js: the decoder's STATION_IDS, the completeness list's stations and STATION_WORDS' outdoor stations are the eleven ids", JSON.stringify(dec) === JSON.stringify(IDS) && JSON.stringify(comp) === JSON.stringify(IDS) && JSON.stringify(words) === JSON.stringify(IDS), `${words.join(",")}`);
  const block = (s, a, b) => { const i = s.indexOf(a); return i < 0 ? null : s.slice(i, s.indexOf(b, i) + b.length); };
  const same = [["STATION_WORDS", "var STATION_WORDS = [", "\n  ];"], ["SECRETS", "var SECRETS = [", "\n  ];"], ["ROUTES", "var ROUTES = {", "};"], ["TOUR", "var TOUR = [", "];"], ["PLACES", "var PLACES = {", "};"], ["verbOf", "function verbOf(v) {", "\n  }"], ["DEITY_LINES", "var DEITY_LINES", "];"], ["FILES", "var FILES = {", "\n  };"]]
    .map(([n, a, b]) => [n, block(W0, a, b), block(W1, a, b)]);
  check("node", "the cards (STATION_WORDS), the secrets, the deep links (ROUTES), the tour, goto's places, the prompt's verbs, the shrine's lines and the terminal's files are byte for byte as at B3d4a",
    same.every(([, a, b]) => a && a === b), same.map(([n, a, b]) => `${n} ${a && a === b ? "same" : "CHANGED"}`).join(", "));
  // the string literals, from esprima's tokenizer (in tools' node_modules, through cspell): every quoted string in the file
  let esprima = null; try { esprima = createRequire(import.meta.url)("esprima"); } catch (e) { esprima = null; }
  const lits = (s) => new Set(esprima ? esprima.tokenize(s).filter((q) => q.type === "String").map((q) => q.value) : []);
  const L0 = lits(W0), L1 = lits(W1), gone = [...L0].filter((q) => !L1.has(q)), added = [...L1].filter((q) => !L0.has(q));
  check("node", `every one of B3d4a's ${L0.size} string literals in js/world.js is still there (no card, secret, prompt or terminal line removed or reworded)`, !!esprima && L0.size > 2000 && gone.length === 0,
    gone.length ? `${gone.length} gone (first: ${gone[0].length} chars, sha256 ${sha(gone[0]).slice(0, 12)})` : `${added.length} new`);
  const shown = added.filter((q) => /on this island yet/.test(q));
  notes.push(`node: ${added.length} new string literals in js/world.js (B3d4b): ${added.length - shown.length} in the decoder's station checks, and the content preview's own lines for systems not migrated yet: ${shown.join("; ")}`);
}
// malformed records, each alone: [label, the rule that must catch it, the change to the authored content, a message it must give]
const realWith = (fn) => { const o = copy(REAL); fn(o); return o; };
const SR = (o, id) => o.records.find((r) => r.id === id);
const pxOf = (x, y) => ({ px0: x * T, py0: y * T, px1: x * T + T - 1, py1: y * T + T - 1 });
// a walkable tile whose aim spot has the terrain's foot-blocking pixels, with walkable open land north of it (for the feet case)
const wetSpot = (() => { for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x, n = (y - 1) * W + x; if (m.coll[i] === 0 && aimWet(x, y) && m.coll[n] === 0 && !LAYER.tiles[n] && !LAYER.tiles[i] && !foot(x, y - 1) && ![10, 6, 8].includes(m.ground[n]) && DIST[n] > 0) return [x, y]; } return null; })();
const BAD = [
  ["the sign twice", "schema", (o) => { o.records.push(copy(SR(o, "sign"))); }, /appears twice/],
  ["a station that isn't one of the game's (a fountain)", "stations", (o) => { SR(o, "drink").id = "fountain"; }, /one of the game's outdoor stations/],
  ["the sign with collision (a solid tile)", "schema", (o) => { SR(o, "sign").solid = { tiles: [[74, 76]] }; }, /blocks nothing/],
  ["the sign with a drawn box", "schema", (o) => { SR(o, "sign").drawnPxBoxes = [pxOf(74, 76)]; }, /no drawn box/],
  ["the sign with art", "schema", (o) => { SR(o, "sign").art = "placeholder"; }, /no art/],
  ["the shrine with a marker field (only a gate has one)", "schema", (o) => { SR(o, "shrine").marker = "shrine"; }, /no marker/],
  ["the sign with no anchor", "schema", (o) => { delete SR(o, "sign").anchor; }, /anchor must be a tile/],
  ["the sign's anchor off the map", "schema", (o) => { SR(o, "sign").anchor = [150, 76]; }, /anchor x must be/],
  ["the sign's place naming two things", "schema", (o) => { SR(o, "sign").place = { plaza: "arrival-plaza", marker: "shrine" }; }, /must name one place/],
  ["the sign's place an unknown kind", "schema", (o) => { SR(o, "sign").place = { district: "harbour-arrival" }; }, /must name one place/],
  ["a building with an anchor", "schema", (o) => { SR(o, "visitor").anchor = [84, 74]; }, /only a station has an anchor/],
  ["the sign tied to another plaza than its approved one", "stations", (o) => { SR(o, "sign").place = { plaza: "village-square" }; }, /approved place/],
  ["the sign used from beside it (not the tile south)", "stations", (o) => { SR(o, "sign").approach = [75, 77]; }, /approach is the tile south/],
  ["the tower's station off the middle of the base's front row (94,27)", "stations", (o) => { SR(o, "tower").anchor = [94, 27]; SR(o, "tower").approach = [94, 28]; }, /middle of the base's front row/],
  ["the lighthouse's station on its approach (140,44, from 140,45)", "stations", (o) => { SR(o, "lighthouse").anchor = [140, 44]; SR(o, "lighthouse").approach = [140, 45]; }, /middle of the base's front row/],
  ["the tower's station with its base gone", "stations", (o) => { o.records = o.records.filter((r) => r.id !== "tower-base"); }, /no such landmark/],
  ["the shrine beside its marker (15,19)", "stations", (o) => { SR(o, "shrine").anchor = [15, 19]; SR(o, "shrine").approach = [15, 20]; }, /its anchor is the marker/],
  ["the mailbox two tiles from its log site", "stations", (o) => { SR(o, "mailbox").anchor = [52, 81]; SR(o, "mailbox").approach = [52, 82]; }, /log site mailbox/],
  ["the drink stand outside the village square (55,87)", "stations", (o) => { SR(o, "drink").anchor = [55, 87]; SR(o, "drink").approach = [55, 88]; }, /outside it/],
  ["the boat beside the berth", "stations", (o) => { SR(o, "boat").anchor = [80, 97]; SR(o, "boat").approach = [80, 96]; }, /anchor is the berth/],
  ["the boat used from the sea south of it", "stations", (o) => { SR(o, "boat").approach = [79, 98]; }, /approach is the tile north/],
  ["the tablet on the sign's tile", "stations", (o) => { SR(o, "tablet").anchor = [74, 76]; SR(o, "tablet").approach = [74, 77]; }, /no two stations share an anchor/],
  ["the sign's approach blocked by a crate", "stations", (o) => { o.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf(74, 77)], solid: { tiles: [[74, 77]] } }); }, /approach 74,77 isn't open ground \(solid content\)/],
  ["the sign in the post office's reserve (46,79)", "stations", (o) => { SR(o, "sign").anchor = [46, 79]; SR(o, "sign").approach = [46, 80]; }, /inside the reserve post-office/],
  ["the sign on the ferry pier (79,95)", "stations", (o) => { SR(o, "sign").anchor = [79, 95]; SR(o, "sign").approach = [79, 96]; }, /is dock/],
  ["the tablet inside the raptor yard (closed in)", "stations", (o) => { SR(o, "tablet").anchor = [123, 13]; SR(o, "tablet").approach = [123, 14]; }, /can't be reached from the spawn/],
  ["a prop named mailbox (a station's id), with the mailbox station gone", "stations", (o) => { o.records = o.records.filter((r) => r.id !== "mailbox"); o.records.push({ id: "mailbox", kind: "prop", drawnPxBoxes: [pxOf(30, 70)], solid: { tiles: [[30, 70]] } }); }, /the id is a station's/]
];
if (wetSpot) BAD.push([`the drink stand used from a tile whose middle is on the terrain's foot-blocking pixels (${wetSpot})`, "stations", (o) => { SR(o, "drink").anchor = [wetSpot[0], wetSpot[1] - 1]; SR(o, "drink").approach = wetSpot.slice(); }, /foot-blocking pixels under pi's feet/]);
for (const [label, rule, fn, re] of BAD) {
  let caught = null;
  try { const r = resolveContent(realWith(fn), src, m); const p = contentProblems(r, src, m); caught = p.length ? p.map((q) => [q[0], q[1]]) : []; }
  catch (e) { caught = e instanceof ContentError ? [[e.rule, e.message]] : [["error", e.message]]; }
  const hit = caught.find((q) => q[0] === rule && re.test(q[1]));
  check("node", `malformed: ${label} is caught by rule ${rule}`, !!hit, hit ? hit[1].slice(0, 110) : caught.map((q) => q.join(": ")).join(" | ").slice(0, 220) || "NOT caught");
}
check("node", "B3d4b's own test geometry: a tile for the feet case was found (walkable, its middle on the terrain's foot-blocking pixels, open land north of it)", !!wetSpot, wetSpot ? wetSpot.join() : "none");

/* ════════ 2. the game ════════ */
const STAGED_MAP = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(STAGED_PATH, "utf8"), c); return c.window.ISLAND_MAPS_STAGED.home; })();
const WORLD = readFileSync(join(ROOT, "js/world.js"), "utf8");
// the root secret's sudo password, read from the game (never written here or printed): the terminal's own check
const SUDO = (WORLD.match(/if \(line\.trim\(\)\.toLowerCase\(\) === "([a-z]+)"\)/) || [])[1] || null;
const DIGEST = async () => { const g = window.__island.ground(), img = new Image(); img.src = g.png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const cWith = (fn) => { const o = Object.assign(copy(STAGED_MAP), { content: copy(DATA) }); fn(o.content); return o; };
const DR = (c, id) => c.records.find((r) => r.id === id);
const REFUSE = [
  ["a station with a solid tile", (c) => { DR(c, "sign").tiles = [[74, 76]]; c.solidTiles++; }, /^content record sign is a station: it blocks nothing and draws nothing of its own \(tiles must be empty\)$/],
  ["a station with a drawn box", (c) => { DR(c, "sign").drawnPxBoxes = [pxOf(74, 76)]; }, /^content record sign is a station: it blocks nothing and draws nothing of its own \(drawnPxBoxes must be empty\)$/],
  ["a station with art", (c) => { DR(c, "sign").art = "placeholder"; }, /^content record sign\.art: a station has no art$/],
  ["a station that isn't one of the game's", (c) => { DR(c, "drink").id = "fountain"; }, /^content record fountain is a station, and fountain isn't one of the game's outdoor stations/],
  ["a station used from beside it", (c) => { DR(c, "sign").approach = [75, 77]; }, /^content record sign: its approach is the tile south of its anchor \(74,77\), not 75,77$/],
  ["the boat used from the sea south of it", (c) => { DR(c, "boat").approach = [79, 98]; }, /^content record boat: its approach is the tile north of its anchor \(79,96\), not 79,98$/],
  ["a place naming two things", (c) => { DR(c, "sign").place = { plaza: "arrival-plaza", marker: "shrine" }; }, /^content record sign\.place must name one place/],
  ["a building with an anchor", (c) => { DR(c, "visitor").anchor = [84, 74]; }, /^content record visitor\.anchor: only a station has an anchor/],
  ["two stations on one anchor", (c) => { DR(c, "tablet").anchor = [74, 76]; DR(c, "tablet").approach = [74, 77]; }, /^content record tablet: its anchor 74,76 is sign's too: no two stations share an anchor$/],
  ["the tower's station off the middle of its base's front row", (c) => { DR(c, "tower").anchor = [94, 27]; DR(c, "tower").approach = [94, 28]; }, /^content record tower: on the landmark base tower-base it stands in the middle of the base's front row, 95,27, not 94,27$/],
  ["the tower's station with its base gone", (c) => { c.records = c.records.filter((r) => r.id !== "tower-base"); c.solidTiles -= 9; }, /^content record tower stands on the landmark base tower-base, and there is no such landmark$/],
  ["the boat on land", (c) => { DR(c, "boat").anchor = [79, 95]; DR(c, "boat").approach = [79, 94]; }, /^content record boat: a berth's station lies at sea, and its anchor 79,95 isn't sea$/],
  ["the sign on the visitor centre's footprint (solid content)", (c) => { DR(c, "sign").anchor = [84, 73]; DR(c, "sign").approach = [84, 74]; }, /^content record sign: its anchor 84,73 isn't open land \(solid content\)$/],
  ["the sign's approach blocked by a crate", (c) => { c.records.push({ id: "syn-crate", kind: "prop", drawnPxBoxes: [pxOf(74, 77)], tiles: [[74, 77]], footPxBoxes: [], doorTiles: [] }); c.solidTiles++; }, /^content record sign: its approach 74,77 isn't open ground \(solid content\)$/],
  ["the tablet inside the raptor yard (closed in)", (c) => { DR(c, "tablet").anchor = [123, 13]; DR(c, "tablet").approach = [123, 14]; }, /^content record tablet: its approach 123,14 can't be reached on foot from the spawn$/]
];
if (wetSpot) REFUSE.push(["a station used from a tile whose middle is on foot-blocking pixels", (c) => { DR(c, "drink").anchor = [wetSpot[0], wetSpot[1] - 1]; DR(c, "drink").approach = wetSpot.slice(); }, /^content record drink: its approach .* isn't open ground \(\d+ foot-blocking pixels under pi's feet\)$/]);
// code mutations: [label, what's changed in js/world.js]
const MUT = {
  off: ["the stations left off in the content preview", (s) => s.replace("stations: all || stations,", "stations: all,")],
  sprite: ["the tower's and the lighthouse's format-1 sprites drawn over their bases (the station code drawing them)", (s) => s.replace("OUT.forEach(function (s) { if (!s.lm) list.push(", "OUT.forEach(function (s) { if (true) list.push(")],
  stand: ["goto ignoring the approach (format 1's tile south)", (s) => s.replace("tx = s.stand ? s.stand[0] : s.x; ty = s.stand ? s.stand[1] : s.y + 1;", "tx = s.x; ty = s.y + 1;")],
  noCheck: ["the decoder's station checks removed", (s) => s.replace("stationShape(r, f); return { r: r,", "return { r: r,")],
  rift: ["the orbs asked for after eight logs where the rift doesn't run", (s) => s.replace("if (n === TOTAL && !save.seal) { sealNext = true; if (!rift && SYS.rift) pendingRift = true; }", "if (n === TOTAL && !save.seal) { sealNext = true; if (!rift) pendingRift = true; }")]
};
for (const [k, [, fn]] of Object.entries(MUT)) if (fn(WORLD) === WORLD) check("node", `mutation ${k} applies to js/world.js`, false, "the text it changes wasn't found");
check("node", "the diagnostic overlay and its legend are this test's own (drawn over the page for a review screenshot): js/world.js has no trace of them", !/b3d4b-(overlay|legend)/.test(WORLD));
check("node", "the sudo password is read from the game's own check (never written in this test)", !!SUDO);

const port = 9860 + Math.floor(Math.random() * 80);
const terrainPv = await startPreview(port), contentPv = await startPreview(port + 1, { content: true }), plain = await serve(port + 3);
mkdirSync(OUT, { recursive: true });
const Q = "?debug=1&step=1&islandhour=11#island";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = { "island-save": JSON.stringify({ v: 2, logs: ["mailbox"], secrets: [], island: "home", flags: {} }), "island-opts": '{"shake":0.25}', unrelated: "kept" };
const STORE_JSON = JSON.stringify(Object.keys(STORE).sort().map((k) => [k, STORE[k]]));

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const open = async (url, { world, store, ctxOpts, wait = 0 } = {}) => {
    const ctx = await browser.newContext(ctxOpts || { viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (msg) => { if (msg.type() === "error" && !page.__shooting) errs.push(msg.text()); });
    if (store) await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, store);
    if (world) await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: world }));
    await page.goto(url, { timeout: 60000 }).catch((e) => errs.push("goto: " + e.message.split("\n")[0]));
    const loaded = await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).then(() => true, () => false);
    if (loaded && wait) await page.waitForTimeout(wait);
    return { ctx, page, errs, loaded, I: (fn, a) => page.evaluate(fn, a) };
  };
  const shoot = async (P, f) => { P.page.__shooting = true; await P.page.screenshot({ path: join(OUT, f) }); await P.page.waitForTimeout(50); P.page.__shooting = false; };
  const tilePx = (p) => [p[0] * T + 8, p[1] * T + 10];
  const walk = (P, from, to, loose = false) => P.I(([f, tt, lo]) => {
    const I2 = window.__island; if (f) { I2.teleport(f[0], f[1]); I2.step(1); }
    const s0 = I2.getState().pi.stalls, plan = I2.walkTo(tt[0], tt[1], lo); if (plan === null) return { plan: null };
    const seen = []; let n = 0;
    for (; n < 9000; n += 4) { I2.step(4); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path) break; }
    const p = I2.getState().pi; return { plan, at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], px: [p.x, p.y], seen, frames: n, stalls: p.stalls - s0 };
  }, [from, to, loose]);
  const hold = (P, key, at, n) => P.I(async ([k2, a, nn]) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(1); return null; }, [key, at, n]).then(async () => {
    await P.page.keyboard.down(key);
    const r = await P.I((nn) => { const I2 = window.__island, tiles = []; let bad = 0; for (let f = 0; f < nn; f += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = tiles[tiles.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) tiles.push(q); if (I2.blocked(p.x - 4, p.y - 2) || I2.blocked(p.x + 4, p.y - 2) || I2.blocked(p.x - 4, p.y + 1) || I2.blocked(p.x + 4, p.y + 1)) bad++; } const p = I2.getState().pi; return { x: p.x, y: p.y, tiles, bad }; }, n);
    await P.page.keyboard.up(key); return r;
  });
  const cardAway = async (P) => { const go = await P.page.$('.w-card-go [data-a="play"]'); if (go && await go.isVisible()) { const bb = await go.boundingBox(); await P.page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await P.page.waitForTimeout(200); } };
  const settle = (P, at) => P.I(([x, y]) => { const I2 = window.__island; for (let i = 0; i < 400 && Math.abs(I2.preview().zoom - 1) > 1e-4; i++) I2.step(2); I2.teleport(x, y); let c0 = ""; for (let i = 0; i < 600; i++) { I2.step(1); const c = I2.preview().camera.join(); if (c === c0 && i > 30) break; c0 = c; } }, at);
  const screenOf = (P, wx, wy) => P.I(([a, b]) => { const v = window.__island.preview(), E = v.ui.scale * v.zoom; return { sx: (a - v.camera[0]) * E, sy: (b - v.camera[1]) * E, tile: 16 * E }; }, [wx, wy]);
  const storeOf = (P) => P.page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); });
  const hideDbg = (P) => P.page.evaluate(() => { const d = document.querySelector(".w-debug"); if (d) d.style.visibility = "hidden"; });
  // the open card: its title, its words (a SHA-256 and a length, never printed) and its links
  const dialog = (P) => P.page.evaluate(async () => {
    const d = document.querySelector(".w-dialog"), txt = d.querySelector("#w-sr").textContent, h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return { open: !d.hidden, name: d.querySelector(".w-name").textContent, sha: [...new Uint8Array(h)].map((v) => v.toString(16).padStart(2, "0")).join(""), len: txt.length, links: [...d.querySelectorAll(".w-links a")].map((a) => a.textContent + " " + a.getAttribute("href")) };
  });
  const termLines = (P) => P.page.evaluate(() => [...document.querySelectorAll(".w-term-out .w-term-line")].map((l) => l.textContent));
  const closeAll = async (P) => {
    await P.I(() => window.__island.step(2));
    if (await P.I(() => window.__island.preview().term)) { await P.page.click(".w-term-x").catch(() => {}); await P.I(() => window.__island.step(2)); }
    if (await P.page.evaluate(() => !document.querySelector(".w-dialog").hidden)) { await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(4)); }
  };
  // use a station: pi at the spot (world px), what [E] would use there and whether its prompt is drawn, then the key; the card (or the terminal) after 100
  // frames (1.7 s, past a log's 1.5 s); then everything closed again
  const useAt = async (P, at, key = "e", keep = false) => {
    await closeAll(P);
    const nb = await P.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(3); const v = I2.preview(); return { id: v.nearby, prompt: !!v.prompt }; }, at);
    await P.page.keyboard.press(key === " " ? "Space" : key); await P.I(() => window.__island.step(100));
    const d = await dialog(P), v = await P.I(() => { const x = window.__island.preview(); return { term: x.term, logs: x.logs, found: window.__island.getState().found }; });
    const lines = v.term ? (await termLines(P)).length : 0;
    if (!keep) await closeAll(P);
    return { nb: nb.id, prompt: nb.prompt, d, term: v.term, lines, logs: v.logs, found: v.found };
  };
  const typeCmd = async (P, cmd) => { await P.page.fill(".w-term-in", cmd); await P.page.press(".w-term-in", "Enter"); await sleep(40); await P.I(() => window.__island.step(2)); };
  const sameCard = (a, b) => a && b && a.open && b.open && a.name === b.name && a.sha === b.sha && a.len === b.len && JSON.stringify(a.links) === JSON.stringify(b.links);

  // 2a. production: format 1's stations as before; their cards, the reference for the content preview's (read at the tile south of each, as format 1's goto stands)
  const pr = await open(`http://127.0.0.1:${port + 3}/${Q}`);
  const REF = {}; let prv = null;
  if (pr.loaded) {
    await pr.I(() => window.__island.step(180));                       // a first visit hatches pi (2.2 s); an [E] before then only skips it
    prv = await pr.I(() => window.__island.preview());
    for (const id of IDS) { const s = prv.stations.find((q) => q.id === id); REF[id] = await useAt(pr, [s.x * T + 8, (s.y + 1) * T + 10]); }
  }
  check(name, "production: format 1, its eleven outdoor stations where js/maps/home.js puts them, each drawn by the station code, no approach of its own (the tile south) and no landmark base; 13 stations with the room's rack and desk",
    pr.loaded && prv.format === 1 && prv.sys.stations && prv.systems.stations === 13 && prv.stations.length === 11 && prv.stations.every((s) => JSON.stringify([s.x, s.y]) === JSON.stringify(F1.stations[s.id]) && s.stand.join() === [s.x, s.y + 1].join() && s.landmark === null && s.draws > 0) && prv.landmarks.length === 0,
    prv ? prv.stations.map((s) => `${s.id} ${s.x},${s.y}`).join("; ") : pr.errs.join("; "));
  check(name, "production: [E] at each station as before (the reference): a card for nine, the cave's terminal, the six logs counted",
    IDS.every((id) => REF[id] && REF[id].nb === id && (id === "cave" ? REF[id].term && REF[id].lines > 0 : REF[id].d.open && REF[id].d.len > 0)) && REF.boat && REF.boat.found.length === 6,
    IDS.map((id) => REF[id] ? `${id}: ${REF[id].nb}, ${id === "cave" ? "terminal " + REF[id].term : `"${REF[id].d.name}" ${REF[id].d.len} chars, ${REF[id].d.links.length} links`}` : `${id}: -`).join("; "));
  check(name, "no page error, console error or uncaught exception in production", pr.loaded && pr.errs.length === 0, pr.errs.slice(0, 3).join(" | "));
  if (pr.loaded) await pr.ctx.close();

  // 2b. the terrain preview: no station
  const tp = await open(`http://127.0.0.1:${port}/${Q}`);
  const tv = tp.loaded ? await tp.I(() => { const I2 = window.__island; I2.teleport(95 * 16 + 8, 28 * 16 + 10); I2.step(3); return I2.preview(); }) : null;
  check(name, "terrain preview: no content, the stations off (none, nothing to use at the tower's approach, no logs)", tp.loaded && !tp.errs.length && tv.previewMode === "terrain" && tv.sys.stations === false && tv.stations.length === 0 && tv.systems.stations === 0 && tv.nearby === null && tv.logs.total === 0,
    tv ? `stations ${tv.stations.length}, nearby ${tv.nearby}` : tp.errs.join("; "));
  const tDig = tp.loaded ? { td: await tp.I(() => window.__island.terrainDigest()), gd: await tp.page.evaluate(DIGEST), pr: await tp.I(() => JSON.stringify(window.__island.painterReport())), fr: await tp.I(() => JSON.stringify(window.__island.featureReport())) } : null;

  // 2c. the content preview: the eleven stations
  const cp = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store: STORE });
  const cv = cp.loaded ? await cp.I(() => window.__island.preview()) : null;
  const SYS_OFF = ["rex", "birds", "koi", "bots", "car", "rift", "volcano", "hatch"];
  check(name, "content preview: 23 records (288 solid tiles: since B3e1 two roam areas too); the buildings, the stations and (since B3e1) the creatures on, every other home system off (no rex, bird, koi, bot, drone, car, rift, volcano or hatching); 13 stations with the room's rack and desk; 8 logs to find, none found (no save read)",
    cp.loaded && !cp.errs.length && cv.content.records === 23 && cv.content.solidTiles === 288 && cv.sys.buildings && cv.sys.stations && SYS_OFF.every((k) => cv.sys[k] === false) && cv.systems.stations === 13 && cv.systems.critters === 2 && cv.systems.bots === 0 && cv.systems.drones === 0 && cv.systems.birds === 0 && cv.systems.koi === 0 && !cv.systems.car && !cv.systems.rex && !cv.systems.arena && !cv.systems.volcano && cv.logs.total === 8 && cv.logs.found === 0 && cv.saveLocked,
    cv ? `sys ${JSON.stringify(cv.sys)}; systems ${JSON.stringify(cv.systems)}; logs ${JSON.stringify(cv.logs)}` : cp.errs.join("; "));
  check(name, "content preview: each station where its record puts it (anchor, approach as the game's stand), the tower's and the lighthouse's on their bases",
    cv && cv.stations.length === 11 && IDS.every((id) => { const s = cv.stations.find((q) => q.id === id), A = ST[id]; return s && s.x === A.anchor[0] && s.y === A.anchor[1] && s.stand.join() === A.approach.join() && s.landmark === (A.place.landmark || null) && s.log === A.log; }),
    cv ? cv.stations.map((s) => `${s.id} ${s.x},${s.y} from ${s.stand}${s.landmark ? " on " + s.landmark : ""}`).join("; ") : "");
  check(name, "content preview: everything B3c to B3d4a built as before (three buildings, two compound walls, two paddock fences, the park gate, the two landmark bases)",
    cv && cv.buildings.map((b) => b.id).join() === "visitor,depot,bunker" && cv.walls.map((q) => `${q.id}:${q.tiles}`).join() === "bunker-compound:53,koi-garden:53" && cv.fences.map((f) => `${f.id}:${f.tiles}:${f.encloses}`).join() === "raptor-yard:30:true,holding-paddock:36:true" && cv.gates.map((g) => g.id).join() === "park-gate" && cv.landmarks.map((l) => `${l.id}:${l.box.join(".")}`).join() === "tower-base:94.25.96.27,lighthouse-base:139.42.140.43");
  if (cp.loaded) {
    // the painter: both digests with every station drawn
    for (const id of IDS) await cp.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(2); }, tilePx(ST[id].approach));
    const cDig = { td: await cp.I(() => window.__island.terrainDigest()), gd: await cp.page.evaluate(DIGEST), pr: await cp.I(() => JSON.stringify(window.__island.painterReport())), fr: await cp.I(() => JSON.stringify(window.__island.featureReport())) };
    check(name, "content preview, every station drawn: both locked painter digests, and the painter's reports exactly as on the terrain preview (stations are drawn in the object layer, never the ground)", cDig.td === TERRAIN_SHA && cDig.gd === GROUND_SHA && tDig && cDig.pr === tDig.pr && cDig.fr === tDig.fr,
      `terrain ${cDig.td.slice(0, 12)}, ground ${cDig.gd.slice(0, 12)}`);
    const dv = await cp.I(() => window.__island.preview());
    check(name, "drawing: the nine free-standing stations drawn by the station code (format 1's sprites); the tower and the lighthouse never (their bases draw them; their trace and beam stay deferred)",
      IDS.every((id) => { const s = dv.stations.find((q) => q.id === id); return ST[id].place.landmark ? s.draws === 0 : s.draws > 0; }) && dv.landmarks.every((l) => l.drawn), dv.stations.map((s) => `${s.id} ${s.draws}`).join(", "));
    // collision: the stations add none
    const L = await cp.I(() => { const L2 = window.__island.layers(); return { c: L2.collision, t: L2.terrainCollision, k: L2.contentCollision }; });
    let lay = true; for (let i = 0; i < W * H; i++) if (L.t[i] !== m.coll[i] || (L.k[i] !== 0) !== !!LAYER.tiles[i] || L.c[i] !== (m.coll[i] | (LAYER.tiles[i] ? 1 : 0))) { lay = false; break; }
    check(name, "collision: the content layer is exactly the compiler's, B3d4a's 288 tiles (the stations add none), kept apart from the terrain's; gameplay is their union", lay);
    const pc = await cp.I(([sts]) => {
      const I2 = window.__island, o = {};
      for (const [id, a, p, free] of sts) {
        let bad = 0; if (free) for (let py = a[1] * 16; py < a[1] * 16 + 16; py++) for (let px = a[0] * 16; px < a[0] * 16 + 16; px++) if (I2.blocked(px, py) !== I2.terrainBlocked(px, py)) bad++;
        o[id] = { bad, anchor: free ? I2.tile(a[0], a[1]).walkable && !I2.tile(a[0], a[1]).content && I2.safe(a[0], a[1]) : null, approach: I2.tile(p[0], p[1]).walkable && !I2.tile(p[0], p[1]).content && I2.safe(p[0], p[1]) };
      }
      return o;
    }, [IDS.map((id) => [id, ST[id].anchor, ST[id].approach, !ST[id].place.landmark && !ST[id].place.berth])]);
    check(name, "collision, pixel by pixel: every pixel of each free-standing station's tile answers exactly as the terrain does (no collision); its tile and every approach walkable, no content, safe ground",
      IDS.every((id) => pc[id].bad === 0 && pc[id].anchor !== false && pc[id].approach), IDS.map((id) => `${id}: ${pc[id].bad} px differ, anchor ${pc[id].anchor}, approach ${pc[id].approach}`).filter((q) => !/0 px differ, anchor (true|null), approach true/.test(q)).join("; ") || "all clear");
    // walking over a free-standing station: from the approach, up through its tile
    const over = [];
    for (const id of IDS.filter((q) => !ST[q].place.landmark && !ST[q].place.berth)) { const r = await hold(cp, "ArrowUp", tilePx(ST[id].approach), 60); over.push({ id, r, on: r.tiles.some((q) => q.join() === ST[id].anchor.join()) }); }
    check(name, "walking: pi held going up from each free-standing station's approach walks onto the station's own tile (it blocks nothing), feet never on a solid pixel",
      over.every((q) => q.on && q.r.bad === 0), over.map((q) => `${q.id}: ${q.r.tiles.map((p) => p.join()).join(" > ")}${q.r.bad ? ", feet on solid " + q.r.bad : ""}`).join("; "));
    // the planner from the spawn to each approach, on the update loop
    const pw = [];
    for (const id of IDS) { const r = await walk(cp, tilePx(SPAWN), ST[id].approach); pw.push({ id, r }); }
    check(name, "planner: from the spawn to every station's approach, on the update loop, no stall, never over a landmark base",
      pw.every((q) => q.r.plan !== null && q.r.at.join() === ST[q.id].approach.join() && q.r.stalls === 0 && !onBase(q.r.seen).length), pw.map((q) => `${q.id}: ${q.r.plan === null ? "no path" : `${q.r.plan} tiles, ended ${q.r.at}, ${q.r.stalls} stalls`}`).join("; "));
    pw.forEach((q) => notes.push(`${name}: planner, the spawn to ${q.id}'s approach: ${q.r.plan} tiles, ${q.r.frames} frames`));
    // [E] at each approach, in format 1's order: the same card as format 1's (title, words by hash, links), the cave's terminal, the logs counted
    const got = {};
    for (const id of IDS) got[id] = await useAt(cp, tilePx(ST[id].approach));
    for (const id of IDS) {
      const g = got[id], R = REF[id];
      check(name, `${id}: at its approach ${ST[id].approach} [E] offers it (its prompt drawn) and ${id === "cave" ? "opens the cave terminal, as format 1's" : "opens its card, the same as format 1's: title, words (by hash) and links"}${ST[id].log ? "; its log counted" : ""}`,
        g.nb === id && g.prompt && (id === "cave" ? g.term && R && R.term && g.lines === R.lines : sameCard(g.d, R && R.d)) && (!ST[id].log || g.found.includes(id)),
        `${g.nb}, prompt ${g.prompt}, ${id === "cave" ? `terminal ${g.term}, ${g.lines} lines (format 1 ${R && R.lines})` : `"${g.d.name}" ${g.d.len} chars sha ${g.d.sha.slice(0, 10)} (format 1 ${R ? `${R.d.len} chars sha ${R.d.sha.slice(0, 10)}` : "-"}), links ${JSON.stringify(g.d.links)}`}`);
    }
    check(name, "the logs: the six outdoor ones read here counted in memory, in the order read, the found list as format 1's after the same reads; the drink stand found its secret (zoom)",
      JSON.stringify(got.boat.found) === JSON.stringify(REF.boat.found) && got.boat.logs.found === 6 && (await cp.I(() => window.__island.getSave().secrets)).includes("zoom"), `${JSON.stringify(got.boat.found)}; ${JSON.stringify(got.boat.logs)}`);
    // the other keys format 1 takes: space and enter
    const sp = await useAt(cp, tilePx(ST.tablet.approach), " "), en = await useAt(cp, tilePx(ST.sign.approach), "Enter");
    check(name, "keys: space and enter use a station too (format 1's e, space and enter)", sp.d.open && sp.d.name === REF.tablet.d.name && en.d.open && en.d.name === REF.sign.d.name, `space: "${sp.d.name}"; enter: "${en.d.name}"`);
    // the tower and the lighthouse: [E] from the approach and the tiles beside it; pi held going up from the approach stops at the base, off it
    const lmk = [];
    for (const id of ["tower", "lighthouse"]) {
      const [ax, ay] = ST[id].approach;
      for (const dx of [-1, 0, 1]) { const nb = await cp.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(3); return I2.preview().nearby; }, tilePx([ax + dx, ay])); lmk.push({ id, at: [ax + dx, ay], nb }); }
      const r = await hold(cp, "ArrowUp", tilePx([ax, ay]), 120), u = await useAt(cp, [r.x, r.y]);
      lmk.push({ id, push: r, after: u });
    }
    check(name, "the tower and the lighthouse: [E] reaches each from its approach and from the tiles either side of it; pi held going up from the approach stops at the base's front edge (never on it, feet never on solid) and [E] there opens its card",
      lmk.every((q) => q.push ? q.push.bad === 0 && !onBase(q.push.tiles).length && Math.floor(q.push.y / T) === ST[q.id].approach[1] && q.after.d.open && q.after.d.name === REF[q.id].d.name : q.nb === q.id),
      lmk.map((q) => q.push ? `${q.id} pushed: ended ${(q.push.y - (ST[q.id].approach[1] - 1) * T - T).toFixed(1)} px below the base, then "${q.after.d.name}"` : `${q.id} from ${q.at}: ${q.nb}`).join("; "));
    // storage, through all of it, and a reload
    await cp.page.reload(); await cp.page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 }).catch(() => {});
    const rl = await cp.I(() => ({ logs: window.__island.preview().logs, save: window.__island.getSave() }));
    check(name, "content preview: no storage read or written (a production save beside it untouched through the reads, the logs, a secret and a reload); after the reload nothing is found (progress lives in memory only)",
      (await storeOf(cp)) === STORE_JSON && rl.logs.found === 0 && rl.save.logs.length === 0 && rl.save.secrets.length === 0, `logs after reload ${JSON.stringify(rl.logs)}`);
    const comp = await cp.I(() => window.__island.completeness());
    check(name, "completeness: with the eleven stations there the stations item is gone; a normal format-2 home made of this content would still be refused (7 items: the sections not in the format yet)",
      comp && !comp.complete && comp.missing.length === 7 && !comp.missing.some((q) => /^(stations|landmark bases|compound walls|the park gate|paddock fences|buildings)/.test(q)), comp ? `${comp.missing.length} items missing, first: ${comp.missing.slice(0, 2).join(" | ")}` : "");
    const refusedHere = async (o) => cp.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, o);
    { const msg = await refusedHere(cWith(() => {})); check(name, "decoder: the real content decodes", msg === null, msg || ""); }
    for (const [label, fn, re] of REFUSE) { const msg = await refusedHere(cWith(fn)); check(name, `decoder refuses: ${label}`, re.test(msg || ""), msg || "NOT refused"); }
    check(name, "no page error, console error or uncaught exception in the content preview", cp.errs.length === 0, cp.errs.slice(0, 3).join(" | "));
  }
  if (cp.loaded) await cp.ctx.close();

  // 2d. progression, in memory: four logs (the terminal's evolve), the terminal's commands, eight logs (the seal's cut at the shrine), the shrine
  // opened and stepped through, the boat; nothing stored
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store: STORE });
    if (P.loaded) {
      const four = []; for (const id of ["tablet", "mailbox", "uplink", "tower"]) four.push(await useAt(P, tilePx(ST[id].approach)));
      const t0 = await useAt(P, tilePx(ST.cave.approach), "e", true);
      await typeCmd(P, "./evolve pi"); await sleep(2300); await P.I(() => window.__island.step(2));
      const ev = await P.I(() => ({ kaiju: window.__island.getState().pi.kaiju, secrets: window.__island.getSave().secrets }));
      check(name, "four logs read (each counted as it is read); then in the cave terminal ./evolve pi evolves pi (format 1's four-log unlock), its secret found",
        four.map((q) => q.logs.found).join() === "1,2,3,4" && t0.term && ev.kaiju && ev.secrets.includes("evolve"), `logs ${four.map((q) => q.logs.found).join(",")}; terminal ${t0.term}; kaiju ${ev.kaiju}`);
      if (t0.term) await shoot(P, `${name}-cave-terminal.png`);
      // the terminal's commands in the content preview: each runs and prints (its output is checked, never printed: the ctf's lines among them);
      // what format 1's systems that aren't here yet answer (the koi, the car, the orbs) is the preview's own line
      // a command's output (after its echoed line; an answer to sudo's password prompt isn't echoed)
      const run = async (cmd, echo = true) => { const n0 = (await termLines(P)).length; await typeCmd(P, cmd); const l = await termLines(P); return { cmd, out: l.slice(n0 + (echo ? 1 : 0)), open: await P.I(() => window.__island.preview().term) }; };
      const R2 = {};
      for (const c of ["help", "ls", "ls landmarks/", "found", "secrets", "ctf", "goto", "whoami", "neofetch", "census", "time", "uname", "ls paddocks/", "feed koi", "cat koi.csv", "drive"]) R2[c] = await run(c);
      const su = await run("sudo ./rift --wake"), pw = SUDO ? await run(SUDO, false) : { out: [] }; await sleep(1100); await P.I(() => window.__island.step(30));
      const afterSudo = await P.I(() => ({ term: window.__island.preview().term, secrets: window.__island.getSave().secrets })), dl0 = await dialog(P);
      const last = (c) => (R2[c].out[R2[c].out.length - 1] || "");
      check(name, "the cave terminal: every command runs and prints, the terminal stays open; ls landmarks/ and found list the eight logs (four found), goto lists the stations' places",
        Object.values(R2).every((q) => q.open && (q.cmd === "ls paddocks/" || q.out.length > 0)) && R2["ls landmarks/"].out[0] === "rack   desk   uplink*   tower*   lighthouse   macbook   tablet*   mailbox*" && R2.found.out.length === 9 && R2.found.out[8] === "4/8 found" && /^places: rack desk uplink tower lighthouse macbook tablet mailbox sign boat dock /.test(R2.goto.out[0] || ""),
        Object.values(R2).map((q) => `${q.cmd} ${q.out.length}`).join(", "));
      check(name, "the cave terminal, for the systems not in the content preview yet: feed koi, cat koi.csv and drive say so (the preview's own lines; format 1 answers as before), and nothing breaks",
        last("feed koi") === "feed: the koi aren't on this island yet." && last("cat koi.csv") === "cat: koi.csv: the koi aren't on this island yet." && last("drive") === "drive: the car isn't on this island yet." && !(await P.I(() => window.__island.getSave().secrets)).includes("koi"),
        `${last("feed koi")} | ${last("cat koi.csv")} | ${last("drive")}`);
      check(name, "the cave terminal: sudo ./rift --wake and the right password (read from the game, never printed) grant access and find the root secret as format 1's, then say the orbs aren't here yet: the terminal stays open, no fight asked for, no error",
        !!SUDO && su.out.length === 0 && pw.out[0] === "access granted." && pw.out[pw.out.length - 1] === "the orbs aren't on this island yet." && afterSudo.term && afterSudo.secrets.includes("root") && !(dl0.open && dl0.name === "the clearing") && !P.errs.length,
        `${pw.out.length} lines; terminal ${afterSudo.term}; dialog ${dl0.open ? dl0.name : "none"}`);
      const fl = await run("fly"); await sleep(500); await P.I(() => window.__island.step(4));
      const fp = await P.I(() => { const s = window.__island.getState(); return { term: window.__island.preview().term, heli: s.heli ? [Math.floor(s.heli.x / 16), Math.floor(s.heli.y / 16)] : null, pi: [Math.floor(s.pi.x / 16), Math.floor(s.pi.y / 16)] }; });
      check(name, "the cave terminal: fly walks pi to the parked helicopter (the previews' own) and closes", fl.out[0] === "walking you to the helipad..." && !fp.term && fp.heli && Math.abs(fp.pi[0] - fp.heli[0]) <= 4 && Math.abs(fp.pi[1] - fp.heli[1]) <= 4, JSON.stringify(fp));
      // the rack and the desk in the bunker's room (logs five and six), then the macbook and the lighthouse (seven, eight)
      const bd = await P.I(() => window.__island.preview().buildings.find((b) => b.id === "bunker").doorway);
      await closeAll(P); await P.I(([x, y]) => { const I2 = window.__island; I2.teleport(x, y + 8); I2.step(2); }, bd); await P.page.keyboard.press("e");
      for (let k = 0; k < 25; k++) { await sleep(60); if (await P.I(() => { window.__island.step(1); return window.__island.getState().room; })) break; }
      await sleep(250); await P.I(() => window.__island.step(1));
      const inRoom = [];
      for (const sid of ["rack", "desk"]) {
        const it = (await P.I(() => window.__island.room().items)).find((q) => q[1] === sid);
        if (!it) { inRoom.push({ sid, nb: null }); continue; }
        const [, , x, y, w0, h0] = it, w = sid === "desk" ? 3 : w0, x0 = sid === "desk" ? x - 1 : x;
        inRoom.push(Object.assign({ sid }, await useAt(P, [x0 * T + w * T / 2, (y + h0) * T + 8])));
      }
      check(name, "the bunker's room: the rack and the desk count their logs now (five and six), as format 1's (B3c2 held them back until the stations came)",
        inRoom.every((q) => q.nb === q.sid && q.d.open) && inRoom.map((q) => q.logs.found).join() === "5,6", inRoom.map((q) => `${q.sid}: ${q.nb}, logs ${q.logs && q.logs.found}`).join("; "));
      await P.I(() => { const I2 = window.__island, R = I2.room(); I2.teleport(R.door * 16 + 8, (R.h - 2) * 16 + 10); I2.step(1); });
      await P.page.keyboard.down("ArrowDown"); for (let k = 0; k < 60; k++) { if (!(await P.I(() => { window.__island.step(1); return window.__island.getState().room; }))) break; await sleep(25); } await P.page.keyboard.up("ArrowDown");
      await sleep(300); await P.I(() => window.__island.step(4));
      const seven = await useAt(P, tilePx(ST.macbook.approach)), eight = await useAt(P, tilePx(ST.lighthouse.approach), "e", true);
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(20));              // closing the eighth card: the seal's cut
      const cut = await P.I(() => { const v = window.__island.preview(); return { logs: v.logs, cam: [v.camera[0] + v.view[0] / 2, v.camera[1] + v.view[1] / 2] }; });
      await shoot(P, `${name}-seal-cut.png`);
      await P.I(() => window.__island.step(200));
      const after = await P.I(() => { const v = window.__island.preview(); return { logs: v.logs }; }), dl1 = await dialog(P);
      check(name, "eight logs: closing the eighth card cuts to the shrine (the camera on it) and the seal breaks (in memory); then no fight is asked for (the rift isn't migrated), no error",
        seven.logs.found === 7 && eight.logs.found === 8 && cut.logs.cut && Math.abs(cut.cam[0] - (14 * T + 8)) < 40 && Math.abs(cut.cam[1] - 19 * T) < 40 && !after.logs.cut && after.logs.seal && after.logs.sealed === false && !dl1.open && !P.errs.length,
        `during: ${JSON.stringify(cut.logs)} camera ${cut.cam.map(Math.round)}; after: ${JSON.stringify(after.logs)}; dialog ${dl1.open ? dl1.name : "none"}`);
      // the cut ends on a fade the game lifts a little each frame it draws (drawFade, format 1's): in step mode one call is one drawn frame,
      // so twenty single steps let it clear before the review screenshot (the live loop's own recovery is checked in 2m)
      for (let i = 0; i < 20; i++) await P.I(() => window.__island.step(1));
      await shoot(P, `${name}-eight-logs.png`);
      const sh = await useAt(P, tilePx(ST.shrine.approach), "e", true);
      check(name, "the shrine, once the seal is broken: [E] opens its card with format 1's two links (step through, and the flash setting), not the sealed words", sh.d.open && sh.d.name === "an old shrine" && sh.d.links[0] === "step through #descend" && sh.d.links.length === 2 && sh.d.sha !== REF.shrine.d.sha, JSON.stringify(sh.d.links));
      await P.page.click('.w-links a[href="#descend"]').catch(() => {});
      let side = false; for (let k = 0; k < 40 && !side; k++) { await sleep(60); side = await P.I(() => { window.__island.step(1); return window.__island.preview().side; }); }
      await sleep(200); await P.page.keyboard.press("Escape");
      let back = false; for (let k = 0; k < 40 && !back; k++) { await sleep(60); back = await P.I(() => { window.__island.step(1); return !window.__island.preview().side; }); }
      check(name, "the shrine: step through takes pi into the side scene, and escape brings it back to the island (format 1's)", side && back && !P.errs.length, `side ${side}, back ${back}`);
      const bt = await useAt(P, tilePx(ST.boat.approach), "e", true);
      await P.page.click('.w-links a[href="#"]').catch(() => {});
      let gone = false; for (let k = 0; k < 60 && !gone; k++) { await sleep(60); gone = await P.I(() => !window.__island.getState().open); }
      check(name, "the boat: its card offers sail back, which leaves the island (format 1's)", bt.d.open && bt.d.links.join() === "sail back ↩ #" && gone, `links ${JSON.stringify(bt.d.links)}; left ${gone}`);
      check(name, "progression, all of it in memory: the production save beside it untouched, nothing written (logs, secrets, the evolve, the seal, leaving)", (await storeOf(P)) === STORE_JSON && !P.errs.length, P.errs.slice(0, 2).join(" | "));
    } else check(name, "progression", false, "didn't load");
    await P.ctx.close(); }

  // 2e. the tour: format 1's eight stops in order, each card the same as production's, pi taken to each station's approach (the rack and the desk: the room)
  const tourOf = async (url, prod) => {
    const P = await open(url); if (!P.loaded) return null;
    if (prod) await P.I(() => window.__island.step(180));
    await P.page.click(".w-tour"); const out = [];
    for (let i = 0; i < 8; i++) {
      await P.I(() => window.__island.step(20));
      const s = await P.I(() => { const I2 = window.__island, st = I2.getState(); return { i: I2.preview().tour, room: st.room, pi: [Math.floor(st.pi.x / 16), Math.floor(st.pi.y / 16)] }; });
      const d = await dialog(P); out.push(Object.assign(s, { name: d.name, sha: d.sha }));
      if (i === 0 && !prod) await shoot(P, `${name}-tour-lighthouse.png`);
      await P.I(() => window.__island.step(360));
    }
    await P.I(() => window.__island.step(30));
    const end = await P.I(() => ({ tour: window.__island.preview().tour, found: window.__island.getState().found.length }));
    const errs = P.errs.slice(); await P.ctx.close();
    return { out, end, errs };
  };
  { const a = await tourOf(`http://127.0.0.1:${port + 1}/${Q}`, false), b = await tourOf(`http://127.0.0.1:${port + 3}/${Q}`, true);
    const order = ["lighthouse", "rack", "desk", "uplink", "tower", "macbook", "tablet", "mailbox"];
    check(name, "the tour: the content preview's eight stops in format 1's order (lighthouse, rack, desk, uplink, tower, macbook, tablet, mailbox), each card the same as production's (title and words), pi at each station's approach (in the bunker's room for the rack and the desk); every log found by the end; no error",
      a && b && a.out.every((q, i) => q.i === i && q.name === b.out[i].name && q.sha === b.out[i].sha && (["rack", "desk"].includes(order[i]) ? q.room === "bunker" : q.pi.join() === ST[order[i]].approach.join())) && a.end.tour === null && a.end.found === 8 && b.end.found === 8 && !a.errs.length,
      a ? a.out.map((q, i) => `${order[i]}: "${q.name}" ${q.room ? "room " + q.room : "at " + q.pi}`).join("; ") + `; found ${a.end.found}` + (a.errs.length ? "; errors " + a.errs.join(" | ") : "") : "didn't load"); }

  // 2f. deep links: every name ROUTES knows, and the tour
  { const routes = (() => { const s0 = WORLD.slice(WORLD.indexOf("var ROUTES = {") + 13, WORLD.indexOf("};", WORLD.indexOf("var ROUTES = {")) + 1); return JSON.parse(s0.replace(/([a-z]+):/g, '"$1":')); })();
    const words = {}; for (const q of WORLD.matchAll(/\{ id: "([a-z]+)",(?: room: "[a-z]+", x: \d+, y: \d+,)? name: "([^"]+)"(?:, sec: "([^"]+)")?/g)) words[q[1]] = q[3] ? `${q[2]} · ${q[3]}` : q[2];
    const res = [];
    for (const k of Object.keys(routes)) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&step=1&islandhour=11#island/${k}`);
      if (!P.loaded) { res.push({ k, ok: false, why: "didn't load" }); await P.ctx.close(); continue; }
      await P.I(() => window.__island.step(40));
      const st = await P.I(() => { const s = window.__island.getState(); return { room: s.room, pi: [Math.floor(s.pi.x / 16), Math.floor(s.pi.y / 16)] }; }), d = await dialog(P), id = routes[k];
      res.push({ k, id, ok: d.open && d.name === words[id] && (["rack", "desk"].includes(id) ? st.room === "bunker" : st.pi.join() === ST[id].approach.join()) && !P.errs.length, why: `"${d.name}" ${st.room ? "room " + st.room : "at " + st.pi}` });
      await P.ctx.close();
    }
    check(name, `deep links: each of the ${res.length} names format 1's ROUTES knows (#island/<name>) takes pi to its station's approach (the bunker's room for the rack and the desk) and opens its card`, res.length === 18 && res.every((q) => q.ok), res.filter((q) => !q.ok).map((q) => `${q.k}: ${q.why}`).join("; ") || res.map((q) => q.k).join(" ")); }

  // 2g. goto (the cave terminal), the big map's travel and the menu's landmarks
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P.loaded) {
      const g = [];
      for (const k of ["uplink", "tower", "lighthouse", "macbook", "tablet", "mailbox", "sign", "boat", "dock", "rack"]) {
        const u = await useAt(P, tilePx(ST.cave.approach), "e", true);
        if (!u.term) { g.push({ k, ok: false }); continue; }
        await typeCmd(P, `goto ${k}`); await sleep(450); await P.I(() => window.__island.step(2));
        const s = await P.I(() => { const st = window.__island.getState(); return { term: window.__island.preview().term, room: st.room, pi: [Math.floor(st.pi.x / 16), Math.floor(st.pi.y / 16)] }; });
        const want = k === "rack" ? null : ST[k === "dock" ? "boat" : k].approach;
        g.push({ k, s, ok: !s.term && (want ? s.pi.join() === want.join() && !s.room : s.room === "bunker") });
      }
      check(name, "goto (the cave terminal): each station's name walks pi to its approach (dock to the boat's, the pier's end; rack into the bunker's room) and closes the terminal", g.every((q) => q.ok), g.map((q) => `${q.k}: ${q.s ? (q.s.room ? "room " + q.s.room : q.s.pi) : "no terminal"}`).join("; "));
    } else check(name, "goto", false, "didn't load");
    await P.ctx.close(); }
  { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { store: STORE });
    if (P.loaded) {
      await P.I(() => window.__island.setSave({ v: 2, logs: ["rack", "desk", "uplink", "tower", "lighthouse", "macbook", "tablet", "mailbox"] }));
      await P.I((a) => { window.__island.teleport(a[0], a[1]); window.__island.step(2); }, tilePx(SPAWN));
      await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2));
      const btn = await P.page.evaluate(() => [...document.querySelectorAll(".w-map .w-lm button")].map((b) => [b.getAttribute("data-lm"), b.disabled]));
      await P.page.waitForTimeout(800); await shoot(P, `${name}-bigmap.png`);
      const trav = [];
      for (const id of ["tower", "lighthouse"]) {
        if (!(await P.I(() => window.__island.preview().ui.mapOpen))) { await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2)); }
        await P.page.click(`.w-map .w-lm button[data-lm="${id}"]`).catch(() => {});
        let at = null; for (let k = 0; k < 50; k++) { await sleep(60); at = await P.I(() => { window.__island.step(1); const p = window.__island.getState().pi; return [Math.floor(p.x / 16), Math.floor(p.y / 16)]; }); if (at.join() === ST[id].approach.join()) break; }
        trav.push({ id, at });
      }
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(2));
      await P.page.click('.w-pause [data-lm="macbook"]').catch(() => {}); await P.I(() => window.__island.step(20));
      const mn = await P.I(() => { const p = window.__island.getState().pi; return [Math.floor(p.x / 16), Math.floor(p.y / 16)]; }), md = await dialog(P);
      check(name, "the big map lists the eight logs' stations (all found here, set in memory) and travels to the tower's and the lighthouse's approaches; the menu's landmark button takes pi to the macbook and opens its card; nothing stored",
        btn.length === 8 && btn.every((b) => !b[1]) && trav.every((q) => q.at && q.at.join() === ST[q.id].approach.join()) && mn.join() === ST.macbook.approach.join() && md.open && md.name === REF.macbook.d.name && (await storeOf(P)) === STORE_JSON && !P.errs.length,
        `map buttons ${btn.map((b) => b[0]).join(",")}; travel ${trav.map((q) => `${q.id} ${q.at}`).join(", ")}; menu ${mn} "${md.name}"`);
    } else check(name, "big map", false, "didn't load");
    await P.ctx.close(); }

  // 2h. phones (390 x 844 and 375 x 667, touch): a tap on a base's art (or a station's sprite) walks pi toward the station's approach and, on
  // arrival, uses it (format 1's tap: the planner's loose goal, the tile or one next to it, then the station's card); at the approach the
  // touch prompt is the button
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P);
    const follow = () => P.I(() => { const I2 = window.__island, seen = []; for (let n = 0; n < 3000; n += 2) { I2.step(2); const p = I2.getState().pi, q = [Math.floor(p.x / 16), Math.floor(p.y / 16)], l = seen[seen.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) seen.push(q); if (!p.path && n > 10) break; } const p = I2.getState().pi; return { at: [Math.floor(p.x / 16), Math.floor(p.y / 16)], seen }; });
    const res = [];
    for (const [id, from, tap] of [["tower", [95, 31], [95, 24]], ["lighthouse", [138, 46], [140, 40]], ["sign", [74, 80], [74, 75]], ["mailbox", [50, 85], [50, 80]]]) {
      await settle(P, tilePx(from));
      const sc = await screenOf(P, tap[0] * 16 + 8, tap[1] * 16 + 8); await P.page.touchscreen.tap(sc.sx, sc.sy); const r = await follow();
      await P.I(() => window.__island.step(4)); const d = await dialog(P);
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(4));
      await P.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(4); }, tilePx(ST[id].approach)); const pr2 = await P.I(() => window.__island.preview().prompt);
      if (pr2) { await P.page.touchscreen.tap(pr2[0] + pr2[2] / 2, pr2[1] + pr2[3] / 2); await P.I(() => window.__island.step(4)); }
      const d2 = await dialog(P);
      if (id === "tower") { await P.page.waitForTimeout(800); await shoot(P, `${name}-phone${vw}-tower-card.png`); }
      res.push({ id, r, d, prompt: pr2, d2, near: Math.abs(r.at[0] - ST[id].approach[0]) + Math.abs(r.at[1] - ST[id].approach[1]), onScreen: sc.sx > 0 && sc.sx < vw && sc.sy > 0 && sc.sy < vh && (!pr2 || (pr2[0] >= 0 && pr2[0] + pr2[2] <= vw && pr2[1] >= 0 && pr2[1] + pr2[3] <= vh)) });
      await P.page.keyboard.press("Escape"); await P.I(() => window.__island.step(4));
    }
    check(name, `phone ${vw} x ${vh}: a tap on the tower's and the lighthouse's art (above the base), and on the sign's and the mailbox's sprites, walks pi to the station's approach (or the tile next to it: format 1's loose goal), never onto a base, and opens the station's card on arrival`,
      res.every((q) => q.onScreen && q.near <= 1 && !onBase(q.r.seen).length && q.d.open && q.d.name === REF[q.id].d.name) && !P.errs.length,
      res.map((q) => `${q.id}: ended ${q.r.at} (${q.near} from the approach), "${q.d.name}"`).join("; ") + (P.errs.length ? "; errors " + P.errs.join(" | ") : ""));
    check(name, `phone ${vw} x ${vh}: at each approach the touch prompt is on screen, and tapping it opens the card`, res.every((q) => q.prompt && q.d2.open && q.d2.name === REF[q.id].d.name),
      res.map((q) => `${q.id}: prompt ${q.prompt ? q.prompt.map(Math.round).join(",") : "none"}, "${q.d2.name}"`).join("; "));
    await P.ctx.close();
  }

  // 2l. the big map's labels (B3d4b review): in the content preview every label inside the map, none over another label or another pin,
  // every pin exactly at its station (the bunker's rack and desk either side of its middle, as format 1's); format 1's labels where format 1
  // always put them (centred above each pin, the desk's below); at 1280 x 800, 390 x 844 and 375 x 667; a click on a pin still travels
  const ALL8 = ["rack", "desk", "uplink", "tower", "lighthouse", "macbook", "tablet", "mailbox"];
  for (const [tag, p0, vw, vh, dsf, mob] of [["mapb", port + 1, 1280, 800, 1, false], ["mapb", port + 1, 390, 844, 3, true], ["mapb", port + 1, 375, 667, 2, true], ["format1", port + 3, 1280, 800, 1, false], ["format1", port + 3, 390, 844, 3, true], ["format1", port + 3, 375, 667, 2, true]]) {
    if (name === "firefox") break;
    const P = await open(`http://127.0.0.1:${p0}/${Q}`, { ctxOpts: mob ? { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true } : { viewport: { width: vw, height: vh } } });
    if (!P.loaded) { check(name, `big map ${tag} ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    if (tag === "format1") await P.I(() => window.__island.step(200));
    await P.I((l) => window.__island.setSave({ v: 2, logs: l }), ALL8); if (mob) await cardAway(P);
    await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2)); await P.page.waitForTimeout(800);
    const u = await P.I(() => window.__island.preview().ui);
    await shoot(P, `${name}-bigmap-${tag}-${vw}.png`);
    const hit = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const L = u.mapLabels, Pn = u.mapPins, [cw, chh] = u.mapCss, k = u.mapK * 3;
    let lab = 0, pin = 0; const out = L.filter((q) => q.rect[0] < 0 || q.rect[1] < 0 || q.rect[0] + q.rect[2] > cw + 0.5 || q.rect[1] + q.rect[3] > chh + 0.5).map((q) => q.id);
    L.forEach((a, i) => { L.forEach((b, j) => { if (j > i && hit(a.rect, b.rect) > 0) lab++; }); Pn.forEach((q) => { if (q.id !== a.id && hit(a.rect, [q.x - 5, q.y - 5, 10, 10]) > 0) pin++; }); });
    if (tag === "mapb") {
      const want = (id) => ["rack", "desk"].includes(id) ? [(116.5 + (id === "desk" ? 1.4 : -1.4)) * k, 81 * k] : [(ST[id].anchor[0] + 0.5) * k, (ST[id].anchor[1] + 0.5) * k];
      const pinsOk = Pn.length === 8 && Pn.every((q) => { const w = want(q.id); return Math.abs(q.x - w[0]) < 1e-6 && Math.abs(q.y - w[1]) < 1e-6; });
      check(name, `big map, content preview, ${vw} x ${vh}: the eight pins exactly at their stations; every label inside the map, none over another label or another pin`, pinsOk && L.length === 8 && !out.length && lab === 0 && pin === 0 && !P.errs.length,
        `${L.length} labels, ${out.length ? "OUTSIDE: " + out.join(",") : "all inside"}, ${lab} label overlaps, ${pin} labels over a pin; map ${cw} x ${chh} css px, ${L.map((q) => `${q.id} ${q.rect.map((v) => Math.round(v)).join(",")}`).join("; ")}`);
      if (vw === 1280) {
        const tw = Pn.find((q) => q.id === "tower"), r0 = await P.page.evaluate(() => { const r = document.querySelector(".w-map canvas").getBoundingClientRect(); return [r.left, r.top]; });
        await P.page.mouse.click(r0[0] + tw.x, r0[1] + tw.y);
        let at = null; for (let i = 0; i < 50; i++) { await sleep(60); at = await P.I(() => { window.__island.step(1); const q = window.__island.getState().pi; return [Math.floor(q.x / 16), Math.floor(q.y / 16)]; }); if (at.join() === ST.tower.approach.join()) break; }
        check(name, "big map, content preview: a click on the tower's pin (where it always was) still travels to the tower's approach", at && at.join() === ST.tower.approach.join(), `ended ${at}`);
      }
    } else {
      const same = L.length === 8 && L.every((q) => { const pn = Pn.find((x) => x.id === q.id); return Math.abs(q.rect[0] + q.rect[2] / 2 - pn.x) < 1e-6 && Math.abs(q.rect[1] - (q.id === "desk" ? pn.y + 8 : pn.y - 22)) < 1e-6; });
      check(name, `big map, format 1, ${vw} x ${vh}: its labels exactly where format 1 always put them (centred above each pin, the desk's below)`, same && !P.errs.length, `${lab} label overlaps (format 1's own: the uplink's label over the desk's by its bunker), ${pin} labels over a pin, ${out.length} outside`);
      notes.push(`${name}: big map, format 1, ${vw} x ${vh}: ${lab} label overlaps, ${pin} labels over another pin, ${out.length} outside the map (inherited, unchanged)`);
    }
    await P.ctx.close();
  }

  // 2m. the fade at the end of the shrine's cut (B3d4b review: the dark eight-logs screenshot): on the live loop, the picture darkens during
  // the cut and is back to its daytime brightness at the same spot without a reload, in the content preview as in production (format 1's
  // effect, unchanged)
  { const bright = (P) => P.page.evaluate(() => { const c = document.querySelector(".w-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { s += d[i] + d[i + 1] + d[i + 2]; n++; } return s / n / 3; });
    const fadeRun = async (p0, prod) => {
      const P = await open(`http://127.0.0.1:${p0}/?debug=1&islandhour=11#island`, { wait: prod ? 3200 : 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      await P.I(() => window.__island.setSave({ v: 2, logs: ["rack", "desk", "uplink", "tower", "macbook", "tablet", "mailbox"] }));
      const s = await P.I(() => window.__island.preview().stations.find((q) => q.id === "lighthouse"));
      await P.I((a) => window.__island.teleport(a[0], a[1]), [s.stand[0] * 16 + 8, s.stand[1] * 16 + 10]); await P.page.waitForTimeout(800);
      const b0 = await bright(P);
      await P.page.keyboard.press("e"); await P.page.waitForTimeout(2000); await P.page.keyboard.press("Escape");
      const t0 = Date.now(), series = [];
      while (Date.now() - t0 < 5000) { series.push([Date.now() - t0, await bright(P), await P.I(() => window.__island.preview().logs.cut)]); await P.page.waitForTimeout(80); }
      if (!prod) await shoot(P, `${name}-eight-logs-live.png`);
      const r = { b0, series, seal: await P.I(() => window.__island.preview().logs.seal), errs: P.errs.slice() }; await P.ctx.close(); return r;
    };
    for (const [lab, p0, prod] of [["content preview", port + 1, false], ["production", port + 3, true]]) {
      const r = await fadeRun(p0, prod);
      if (!r) { check(name, `the cut's fade, ${lab}`, false, "didn't load"); continue; }
      const endCut = r.series.findIndex((q, i) => i > 0 && !q[2] && r.series[i - 1][2]), dim = Math.min(...r.series.map((q) => q[1])), last = r.series[r.series.length - 1][1];
      const back = endCut >= 0 ? r.series.slice(endCut).find((q) => q[1] >= 0.9 * r.b0) : null;
      check(name, `the cut's fade, ${lab}: the screen darkens as the seal's cut runs and is back to its daytime brightness at the same spot within a second of the cut ending, with no reload; the seal broken`,
        r.seal && endCut > 0 && dim < 0.6 * r.b0 && back && back[0] - r.series[endCut][0] <= 1000 && last >= 0.9 * r.b0 && last <= 1.1 * r.b0 && (prod || !r.errs.length),
        `brightness before ${r.b0.toFixed(1)}, lowest ${dim.toFixed(1)}, cut over at ${endCut >= 0 ? r.series[endCut][0] : "-"} ms, back to 90% at ${back ? back[0] : "-"} ms, last ${last.toFixed(1)}`);
    }
  }

  // 2n. phones, the lighthouse (B3d4b review): the prompt on screen and tappable, the card on screen with its controls reachable (its link
  // the topmost thing where it's drawn), and a tap on the island closing it (format 1's: the first tap finishes the words, the next closes)
  if (name !== "firefox") for (const [vw, vh, dsf] of [[390, 844, 3], [375, 667, 2]]) {
    const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 1500 });
    if (!P.loaded) { check(name, `phone ${vw} x ${vh}, the lighthouse`, false, "didn't load"); await P.ctx.close(); continue; }
    await cardAway(P); await hideDbg(P);
    await settle(P, tilePx(ST.lighthouse.approach)); await P.I(() => window.__island.step(4));
    const pr = await P.I(() => window.__island.preview().prompt);
    const top = pr ? await P.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.className : null; }, [pr[0] + pr[2] / 2, pr[1] + pr[3] / 2]) : null;
    await shoot(P, `${name}-phone${vw}-lighthouse-prompt.png`);
    if (pr) await P.page.touchscreen.tap(pr[0] + pr[2] / 2, pr[1] + pr[3] / 2);
    await P.I(() => window.__island.step(4)); await P.page.waitForTimeout(900);
    const card = await P.page.evaluate(() => { const d = document.querySelector(".w-dialog"), r = d.getBoundingClientRect(); return { open: !d.hidden, name: d.querySelector(".w-name").textContent, rect: [r.left, r.top, r.width, r.height], links: [...d.querySelectorAll(".w-links a")].map((a) => { const q = a.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { t: a.textContent, rect: [q.left, q.top, q.width, q.height], top: e === a || a.contains(e) }; }) }; });
    await shoot(P, `${name}-phone${vw}-lighthouse-card.png`);
    for (let i = 0; i < 2; i++) { await P.page.touchscreen.tap(vw / 2, 160); await P.I(() => window.__island.step(2)); await P.page.waitForTimeout(150); }
    const closed = await P.page.evaluate(() => document.querySelector(".w-dialog").hidden);
    const inV = (r) => r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= vw && r[1] + r[3] <= vh;
    check(name, `phone ${vw} x ${vh}, the lighthouse: at its approach the touch prompt is on screen and on top (${top}); tapping it opens its card, on screen, its link on screen and the topmost thing where it's drawn; a tap on the island closes it`,
      pr && inV(pr) && /w-cv/.test(top || "") && card.open && card.name === REF.lighthouse.d.name && inV(card.rect) && card.links.length === 1 && card.links.every((q) => inV(q.rect) && q.top) && closed && !P.errs.length,
      `prompt ${pr ? pr.map(Math.round).join(",") : "none"}; card "${card.name}" ${card.rect.map(Math.round).join(",")}; links ${card.links.map((q) => `${q.t} ${q.rect.map(Math.round).join(",")} ${q.top ? "on top" : "COVERED"}`).join("; ")}; closed ${closed}`);
    await P.ctx.close();
  }

  // 2o. the preview badge and the big map (B3d4b review: on a 375 px phone the badge sat over the map's title): in both previews the badge
  // shows while exploring, is hidden while the big map is open, and is back the moment it closes (by the m key and by its close button);
  // with the map open its title, close button, picture and landmark buttons are each the topmost thing where they're drawn. Production
  // has no badge, and its map opens and closes as before
  for (const [mode, p0] of [["content", port + 1], ["terrain", port], ["production", port + 3]]) for (const [vw, vh, dsf, mob] of [[1280, 800, 1, false], [390, 844, 3, true], [375, 667, 2, true]]) {
    if (name === "firefox") break;
    const P = await open(`http://127.0.0.1:${p0}/${Q}`, { ctxOpts: mob ? { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true } : { viewport: { width: vw, height: vh } } });
    if (!P.loaded) { check(name, `badge, ${mode} ${vw} x ${vh}`, false, "didn't load"); await P.ctx.close(); continue; }
    if (mode === "production") await P.I(() => window.__island.step(200));
    if (mode !== "terrain") await P.I(() => window.__island.setSave({ v: 2, logs: ["rack", "desk", "uplink", "tower", "lighthouse", "macbook", "tablet", "mailbox"] }));
    if (mob) await cardAway(P);
    const st = () => P.I(() => { const v = window.__island.preview(); return { badge: v.badge, shown: v.badgeVisible, map: v.ui.mapOpen }; });
    const s0 = await st();
    await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2)); await P.page.waitForTimeout(800);
    const s1 = await st();
    const tops = await P.page.evaluate(() => {
      const els = [[".w-map-top b", "title"], ['.w-map-top [data-a="close"]', "close"], [".w-map canvas", "map"]].map(([q, n]) => [document.querySelector(q), n]).concat([...document.querySelectorAll(".w-map .w-lm button")].map((b) => [b, "button " + b.getAttribute("data-lm")]));
      const bg = document.querySelector(".w-mapb-badge"), bgr = bg && getComputedStyle(bg).visibility !== "hidden" ? bg.getBoundingClientRect() : null;
      return els.map(([e, n]) => { const r = e.getBoundingClientRect(), pts = [[0.5, 0.5], [0.1, 0.5], [0.9, 0.5]].map(([fx, fy]) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy)); const over = bgr && r.left < bgr.right && bgr.left < r.right && r.top < bgr.bottom && bgr.top < r.bottom;
        return { n, rect: [r.left, r.top, r.width, r.height].map(Math.round), top: pts.every((x) => x === e || e.contains(x)), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, over: !!over }; });
    });
    await shoot(P, `${name}-bigmap-badge-${mode}-${vw}-open.png`);
    await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2));
    const s2 = await st();
    await shoot(P, `${name}-bigmap-badge-${mode}-${vw}-closed.png`);
    await P.page.keyboard.press("m"); await P.I(() => window.__island.step(2)); await P.page.click('.w-map-top [data-a="close"]'); await P.I(() => window.__island.step(2));
    const s3 = await st();
    const prev = mode !== "production", bad = tops.filter((q) => !q.top || !q.inView || q.over);
    check(name, `badge, ${mode}${prev ? " preview" : ""}, ${vw} x ${vh}: ${prev ? "shown while exploring, hidden while the big map is open, back as it closes (the m key, and the close button)" : "no badge, the big map opens and closes as before"}; with the map open its title, close button, picture and ${tops.length - 3} landmark buttons each on screen and the topmost thing where drawn, nothing under the badge`,
      (prev ? s0.badge && s0.shown && !s0.map && s1.map && !s1.shown && !s2.map && s2.shown && !s3.map && s3.shown : !s0.badge && s1.map && !s2.map && !s3.map) && bad.length === 0 && tops.length === (mode === "terrain" ? 3 : 11) && !P.errs.length,
      `exploring ${JSON.stringify(s0)}; open ${JSON.stringify(s1)}; closed (m) ${JSON.stringify(s2)}; closed (button) ${JSON.stringify(s3)}${bad.length ? "; PROBLEMS " + JSON.stringify(bad) : `; title ${tops[0].rect}, close ${tops[1].rect}`}`);
    await P.ctx.close();
  }

  // 2i. code mutations (Chromium only: each is a whole load)
  if (name === "chromium") {
    const caught = (label, ok, detail) => check(name, `mutation caught: ${label}`, ok, detail);
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.off[1](WORLD) }); const nb = P.loaded ? await P.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(3); return I2.preview().nearby; }, tilePx(ST.tower.approach)) : "didn't load";
      caught(MUT.off[0], nb !== "tower", `[E] at the tower's approach offers ${nb}`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.sprite[1](WORLD) }); const dr = P.loaded ? await P.I((a) => { const I2 = window.__island; I2.teleport(a[0], a[1]); I2.step(3); return I2.preview().stations.find((s) => s.id === "tower").draws; }, tilePx(ST.tower.approach)) : -1;
      caught(MUT.sprite[0], dr > 0, `the station code drew the tower ${dr} times`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.stand[1](WORLD) }); let at = null;
      if (P.loaded) { const u = await useAt(P, tilePx(ST.cave.approach), "e", true); if (u.term) { await typeCmd(P, "goto boat"); await sleep(450); at = await P.I(() => { const p = window.__island.getState().pi; return [Math.floor(p.x / 16), Math.floor(p.y / 16)]; }); } }
      caught(MUT.stand[0], !at || at.join() !== ST.boat.approach.join(), `goto boat ended at ${at}`); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.noCheck[1](WORLD) }); const r = P.loaded ? await P.I((mm) => { try { window.__island.decodeMap(mm); return null; } catch (e) { return e.message; } }, cWith((c) => { DR(c, "sign").approach = [75, 77]; })) : "didn't load";
      caught(MUT.noCheck[0], r === null, r === null ? "a station used from beside it decoded" : r); await P.ctx.close(); }
    { const P = await open(`http://127.0.0.1:${port + 1}/${Q}`, { world: MUT.rift[1](WORLD) }); let d = null;
      if (P.loaded) { await P.I(() => window.__island.setSave({ v: 2, logs: ["rack", "desk", "uplink", "tower", "macbook", "tablet", "mailbox"] })); await useAt(P, tilePx(ST.lighthouse.approach)); await P.I(() => window.__island.step(400)); d = await dialog(P); }
      caught(MUT.rift[0], P.errs.length > 0 || (d && d.open && d.name === "the clearing"), `${P.errs.length} page errors${P.errs.length ? " (" + P.errs[0].slice(0, 80) + ")" : ""}; dialog ${d && d.open ? d.name : "none"}`); await P.ctx.close(); }
  }

  // 2j. performance: the frame work on the live loop walking past stations (the sign, the tower, the lighthouse), beside the terrain preview; decoding
  { const liveWalk = async (port0) => {
      const P = await open(`http://127.0.0.1:${port0}/?debug=1&islandhour=11#island`, { wait: 2600 });
      if (!P.loaded) return null;
      await P.page.click(".w-cv", { position: { x: 5, y: 400 } }).catch(() => {});
      await P.I(() => window.__island.frames(true));
      for (const [at, k2] of [[[70, 77], "ArrowRight"], [[78, 77], "ArrowLeft"], [[92, 28], "ArrowRight"], [[136, 44], "ArrowRight"], [[143, 44], "ArrowLeft"]]) {
        await P.I(([x, y]) => window.__island.teleport(x * 16 + 8, y * 16 + 10), at);
        await P.page.keyboard.down(k2); await P.page.waitForTimeout(1800); await P.page.keyboard.up(k2);
      }
      const f0 = await P.I(() => window.__island.frames(true)); await P.ctx.close();
      const f = f0.slice().sort((a, b) => a - b), q = (k) => f[Math.min(f.length - 1, Math.floor(f.length * k))];
      return { n: f.length, med: q(0.5), p95: q(0.95), max: f[f.length - 1], errs: P.errs };
    };
    const lc = await liveWalk(port + 1), lt = await liveWalk(port);
    const fmt = (o) => o ? `${o.n} frames, median ${o.med.toFixed(2)} / p95 ${o.p95.toFixed(2)} / max ${o.max.toFixed(2)} ms` : "didn't load";
    perf.push(`${name}: live frame work walking past the sign, the tower and the lighthouse: content preview ${fmt(lc)}; terrain preview ${fmt(lt)}`);
    check(name, "performance: walking past stations on the live loop, the content preview's frame work p95 is under 16.7 ms (the game's target)", lc && lc.n > 100 && lc.p95 < 16.7 && !lc.errs.length, `content ${fmt(lc)}; terrain ${fmt(lt)}`);
    const P2 = await open(`http://127.0.0.1:${port + 1}/${Q}`);
    if (P2.loaded) {
      const dec = await P2.I(([mm]) => { const I2 = window.__island; for (let i = 0; i < 3; i++) I2.decodeMap(mm); const a = performance.now(); for (let i = 0; i < 10; i++) I2.decodeMap(mm); return (performance.now() - a) / 10; }, [cWith(() => {})]);
      const dec10 = await P2.I(([mm]) => { const I2 = window.__island; for (let i = 0; i < 3; i++) I2.decodeMap(mm); const a = performance.now(); for (let i = 0; i < 10; i++) I2.decodeMap(mm); return (performance.now() - a) / 10; }, [cWith((c) => { c.records = c.records.slice(0, 10); })]);
      perf.push(`${name}: decoding the staged map (warm, 10): ${dec.toFixed(1)} ms with the ${DATA.records.length} records, ${dec10.toFixed(1)} ms with B3d4a's ten (the stations' checks and their flood from the spawn)`);
    }
    await P2.ctx.close(); }
  if (tp.loaded) await tp.ctx.close();

  // 2k. review screenshots (ignored; not baselines), on the live loop
  if (name !== "firefox") {
    const at = async (P, x, y, ms = 900) => { await P.I(([a, b]) => window.__island.teleport(a, b), [x * T + 8, y * T + 10]); await P.page.waitForTimeout(ms); };
    const foldMini = async (P) => { const mr = await P.I(() => window.__island.preview().ui.mini); if (mr) await P.page.mouse.click(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); };
    for (const [hour, tag] of [[11, "day"], [22, "night"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=${hour}#island`, { ctxOpts: { viewport: { width: 1280, height: 1000 } }, wait: 2600 });
      if (P.loaded) {
        await hideDbg(P); await foldMini(P);
        for (const id of tag === "day" ? IDS : ["tower", "lighthouse", "sign", "cave", "shrine", "boat"]) {
          await at(P, ST[id].approach[0], ST[id].approach[1], 1300); await shoot(P, `${name}-${id}-${tag}.png`);
          if (id === "tower" || id === "lighthouse") {
            await P.page.keyboard.press("e"); await P.page.waitForTimeout(1300); await shoot(P, `${name}-${id}-${tag}-card.png`); await P.page.keyboard.press("Escape"); await P.page.waitForTimeout(300);
            if (tag === "day") {
              // the diagnostic overlay: the base's collision (read from the game), the station's anchor, its approach, [E]'s reach round the station, safe ground
              const A = ST[id], b = BASES[A.place.landmark];
              const d = await P.I(([bb, an, ap, idd]) => {
                const I2 = window.__island, v = I2.preview(), E = v.ui.scale * v.zoom, cvs = document.querySelector(".w-cv"), c = document.createElement("canvas");
                c.id = "b3d4b-overlay"; c.width = cvs.clientWidth; c.height = cvs.clientHeight; Object.assign(c.style, { position: "absolute", left: cvs.offsetLeft + "px", top: cvs.offsetTop + "px", width: cvs.clientWidth + "px", height: cvs.clientHeight + "px", pointerEvents: "none", zIndex: "1" });
                const g = c.getContext("2d"), X = (px) => (px - v.camera[0]) * E, Y = (py) => (py - v.camera[1]) * E, Sz = 16 * E; let solid = 0;
                for (let y = bb.y0 - 3; y <= bb.y1 + 3; y++) for (let x = bb.x0 - 3; x <= bb.x1 + 3; x++) {
                  const q = I2.tile(x, y);
                  if (q.content) { solid++; g.fillStyle = "rgba(255,64,64,.40)"; g.fillRect(X(x * 16), Y(y * 16), Sz, Sz); g.strokeStyle = "#ff4040"; g.lineWidth = 1; g.strokeRect(X(x * 16) + 0.5, Y(y * 16) + 0.5, Sz - 1, Sz - 1); }
                  else if (I2.safe(x, y)) { g.strokeStyle = "rgba(74,222,128,.75)"; g.lineWidth = 1; g.strokeRect(X(x * 16) + 2.5, Y(y * 16) + 2.5, Sz - 5, Sz - 5); }
                }
                const sx = X(an[0] * 16 + 8), sy = Y(an[1] * 16 + 12);
                g.strokeStyle = "#e879f9"; g.lineWidth = 3; g.beginPath(); g.moveTo(sx - 8, sy - 8); g.lineTo(sx + 8, sy + 8); g.moveTo(sx + 8, sy - 8); g.lineTo(sx - 8, sy + 8); g.stroke();
                g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 26 * E, 0, 6.283); g.stroke(); g.setLineDash([]);
                g.strokeStyle = "#ffd166"; g.lineWidth = 3; g.strokeRect(X(ap[0] * 16) + 1, Y(ap[1] * 16) + 1, Sz - 2, Sz - 2);
                cvs.parentElement.insertBefore(c, cvs.nextSibling);
                const L = document.createElement("div"); L.id = "b3d4b-legend";
                L.textContent = `B3d4b diagnostic (test overlay)\n${idd} station on its base\nred: collision, read from the\n     game (the base only)\nmagenta x: the station's point\n     (anchor ${an.join(",")}), no collision\nmagenta ring: [E]'s reach, 26 px\nyellow: approach ${ap.join(",")}\ngreen: safe ground`;
                Object.assign(L.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "1000", whiteSpace: "pre", font: "700 12px monospace", lineHeight: "15px", color: "#ffd166", background: "rgba(17,17,17,.88)", border: "2px solid #ffd166", padding: "6px 8px", pointerEvents: "none" });
                document.body.appendChild(L);
                return { solid };
              }, [b, A.anchor, A.approach, id]);
              check(name, `diagnostic overlay, ${id} (review screenshot only): the game's own collision within 3 tiles of its base shows exactly the base's ${(b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)} tiles (the station adds none)`, d.solid === (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1), `${d.solid} solid`);
              await shoot(P, `${name}-${id}-diagnostic.png`);
              await P.page.evaluate(() => { for (const i3 of ["b3d4b-overlay", "b3d4b-legend"]) { const e = document.getElementById(i3); if (e) e.remove(); } });
            }
          }
        }
      }
      await P.ctx.close();
    }
    for (const [vw, vh, dsf, tag] of [[390, 844, 3, "phone390"], [375, 667, 2, "phone375"]]) {
      const P = await open(`http://127.0.0.1:${port + 1}/?debug=1&islandhour=11#island`, { ctxOpts: { viewport: { width: vw, height: vh }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }, wait: 2600 });
      if (P.loaded) { await cardAway(P); await hideDbg(P); for (const id of ["tower", "lighthouse", "sign"]) { await at(P, ST[id].approach[0], ST[id].approach[1], 1300); await shoot(P, `${name}-${tag}-${id}.png`); } }
      await P.ctx.close();
    }
  }
  await browser.close();
}
terrainPv.close(); contentPv.close(); plain.close();
if (notes.length) { console.log("\nmeasured, for the record:"); notes.forEach((l) => console.log("  " + l)); }
if (perf.length) { console.log("\nperformance (measured, for the record):"); perf.forEach((l) => console.log("  " + l)); }
console.log(`\n${fails ? fails + " failed" : "all passed"}${blocked.length ? `; BLOCKED: ${blocked.join(", ")} (not a pass)` : ""}`);
process.exit(fails ? 1 : blocked.length ? 2 : 0);
