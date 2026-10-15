/* MAP-B B3b: the home island's content layer, as data. The schema, its validation, the compile from the authored
   source (tools/maps/home.content.mjs) to the staged content file (tools/maps/staged/home.content.js), and the rules
   that keep content from changing the terrain. Pure functions: no file is read or written here (tools/map-content.mjs
   does that), so tests can run any synthetic content through exactly the code the real content goes through.

   Why a separate layer, and a separate file:
   - The terrain (tools/maps/home.src.mjs, compiled by tools/map-compile.mjs into tools/maps/staged/home.js) is locked:
     B1's geography, B2a's collision, footBlock and edgeMask, and the two painter digests B2c and B2d locked. Content never
     edits it. The staged terrain file stays byte for byte as it is; content compiles to its own file, bound to the
     terrain it was placed on by that file's sourceSha256.
   - The game keeps two collision layers for a staged format-2 map: the terrain's (the painter reads only that one, so
     no building, wall or post can change a painted pixel) and the content's. Movement, path planning and safe ground
     read their union. Content only ever adds blocking: a solid tile, or foot-box pixels on a tile that stays walkable.

   The source (schema mapb-content-1), in the B1 conventions: tiles are [x, y]; tile boxes are inclusive
   { x0, y0, x1, y1 } named ...Box; pixel boxes are inclusive world pixels { px0, py0, px1, py1 } (16 px a tile) named
   ...PxBox(es). Ids are lowercase words joined by hyphens.

     export default { schema: "mapb-content-1", id: "home", records: [ record, ... ] }

     record: {
       id, kind,                         // kind: building, landmark, station, wall, fence, gate, prop
       drawnPxBoxes: [pxBox, ...],       // where the record's art is drawn on the ground (D1: no collision outside it)
       solid: {                          // what blocks (all optional, at least one)
         tileBoxes: [tileBox, ...],      //   whole tiles
         tiles: [[x, y], ...],           //   whole tiles
         ringOfBox: { ...tileBox, gapTiles: [[x, y], ...] },   // a wall or fence round a box's edge, minus its gaps
         ringOfHabitat: { habitat, gapTiles: [[x, y], ...] },  // round a B1e habitat outline: its tiles with any of the
                                                               //   8 neighbours outside it (a 4-connected ring)
         footPxBoxes: [pxBox, ...]       //   pixels where feet stop on a tile that stays walkable (a post, a sign's base)
       },
       doorTiles: [[x, y], ...],         // optional: walkable tiles next to its solid, reachable from the spawn
       reserve: "footprint-id",          // optional: the B1e footprint it stands in (its solid must stay inside it)
       encloses: true,                   // optional: it may cut ground off (a paddock fence); nothing else may
       art: "placeholder",               // a building's (B3c1, required on one): what the game draws over its drawn box
       room: "visitor"                   // a building's, optional (B3c1): the game's room behind its one door
     }

   A building (B3c1) draws itself: art "placeholder" is the game's temporary building art, drawn exactly over the
   record's one drawn box, until the art stage adds real sprites as a new art kind (the footprint, the door and the
   collision stay as they are). Its solid is its footprint, one full rectangle; its art box is as wide as the
   footprint and stands on its front edge (it may rise above it); a building naming a reserve fills that footprint
   exactly; one with a room has exactly one door, the tile right in front of the footprint (every B1e footprint's
   front is south), and pi's feet fit in the doorway there (clear of the terrain's foot-blocking pixels).

   A ring's drawn boxes are its own tiles (a fence or wall is drawn on every tile it stands on), added by the compile.

   The compiled record (the staged content file and the game): { id, kind, drawnPxBoxes, tiles, footPxBoxes, doorTiles,
   reserve?, encloses? }, every solid as an explicit tile list, so the game derives its layer without knowing any shape.

   The rules, each named (the compile throws on the first broken one; contentProblems() lists them all):
     schema         fields, types, kinds, ids unique, everything inside the map
     terrain        content solids only on terrain a foot could walk, never on water, a cliff rim, the volcano, a bridge,
                    a dock or the helipad
     spawn          the spawn tile, and pi's feet there, stay clear
     drawn          D1: every solid tile and foot pixel lies inside the record's drawn boxes
     overlap        no tile solid in two records
     foot           foot boxes only on tiles that stay walkable (terrain walkable, no content tile)
     reserve        a record naming a reserve stays inside it; no other record's solid enters a reserve
     buildings      a building's art, footprint, reserve, room and door, as above (B3c1)
     open-space     nothing solid in the B1e open spaces (the rift arena's clear field)
     doors          each door tile walkable, next to its record's solid, reachable from the spawn
     route-ends     every B1d route end still reachable from the spawn
     pockets        no ground the spawn reached before is cut off, apart from what an encloses record encloses */
import { regionPoly } from "../map-compile.mjs";
import { raster } from "./geom.mjs";

export const CONTENT_SCHEMA = "mapb-content-1";
export const KINDS = ["building", "landmark", "station", "wall", "fence", "gate", "prop"];
export const RULES = ["schema", "terrain", "spawn", "drawn", "overlap", "foot", "reserve", "buildings", "open-space", "doors", "route-ends", "pockets"];
/* the rooms a building may open into (the game's ROOMS in js/world.js, whose decoder holds the same list) and the art
   kinds the game draws for a building */
export const ROOM_IDS = ["visitor", "bunker", "depot"];
export const ART_KINDS = ["placeholder"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const T = 16;
// terrain codes and flags, the compiler's (tools/map-compile.mjs GROUND and COLL)
const G_BRIDGE = 10, G_DOCK = 6, G_PAD = 8;

export class ContentError extends Error { constructor(rule, msg) { super(`${rule}: ${msg}`); this.rule = rule; } }
const fail = (rule, msg) => { throw new ContentError(rule, msg); };

const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
function only(o, f, keys) { for (const k of Object.keys(o)) if (!keys.includes(k)) fail("schema", `${f} has an unknown field ${k}`); }
function int(v, f, lo, hi) { if (typeof v !== "number" || v % 1 !== 0 || v < lo || v > hi) fail("schema", `${f} must be a whole number from ${lo} to ${hi}`); return v; }
function tile(p, f, W, H) { if (!Array.isArray(p) || p.length !== 2) fail("schema", `${f} must be a tile [x, y]`); int(p[0], f + " x", 0, W - 1); int(p[1], f + " y", 0, H - 1); return p; }
function tileBox(b, f, W, H, extra = []) {
  if (!isObj(b)) fail("schema", `${f} must be an inclusive tile box { x0, y0, x1, y1 }`);
  only(b, f, ["x0", "y0", "x1", "y1", ...extra]);
  int(b.x0, f + ".x0", 0, W - 1); int(b.y0, f + ".y0", 0, H - 1); int(b.x1, f + ".x1", b.x0, W - 1); int(b.y1, f + ".y1", b.y0, H - 1);
  return b;
}
function pxBox(b, f, W, H) {
  if (!isObj(b)) fail("schema", `${f} must be an inclusive pixel box { px0, py0, px1, py1 }`);
  only(b, f, ["px0", "py0", "px1", "py1"]);
  int(b.px0, f + ".px0", 0, W * T - 1); int(b.py0, f + ".py0", 0, H * T - 1); int(b.px1, f + ".px1", b.px0, W * T - 1); int(b.py1, f + ".py1", b.py0, H * T - 1);
  return b;
}
function list(v, f) { if (!Array.isArray(v)) fail("schema", `${f} must be a list`); return v; }

/* the habitat's tiles, as the B1e lint rasters them (tile centres inside the outline, or the box) */
export function habitatMask(src, id, W, H) {
  const h = (src.habitats || []).find((q) => q.id === id);
  if (!h) return null;
  const g = new Uint8Array(W * H);
  if (h.habitatBox) { const b = h.habitatBox; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) g[y * W + x] = 1; }
  else { const r = raster(regionPoly(h), W, H); for (let i = 0; i < W * H; i++) g[i] = r[i] ? 1 : 0; }
  return g;
}
// a ring: the area's tiles with any of their 8 neighbours outside it (so the ring is 4-connected), and its inside
function ringOf(mask, W, H) {
  const ring = [], inner = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || !mask[ny * W + nx]) { edge = true; break; } }
    (edge ? ring : inner).push([x, y]);
  }
  return { ring, inner };
}

/* the source checked and resolved: every record with its solid as explicit tiles. m is the compiled terrain
   (compile() in tools/map-compile.mjs), src its source. Throws a ContentError (schema) on the first fault */
export function resolveContent(content, src, m) {
  const W = m.w, H = m.h;
  if (!isObj(content)) fail("schema", "the content source must export an object");
  only(content, "the content", ["schema", "id", "records"]);
  if (content.schema !== CONTENT_SCHEMA) fail("schema", `schema must be ${CONTENT_SCHEMA}`);
  if (content.id !== m.id) fail("schema", `id must be the terrain's, ${m.id}`);
  const seen = new Set();
  const records = list(content.records, "records").map((r, k) => {
    const f0 = `records[${k}]`;
    if (!isObj(r)) fail("schema", `${f0} must be an object`);
    if (typeof r.id !== "string" || !ID.test(r.id)) fail("schema", `${f0} needs an id (lowercase words joined by hyphens)`);
    const f = `record ${r.id}`;
    if (seen.has(r.id)) fail("schema", `${f} appears twice`); seen.add(r.id);
    only(r, f, ["id", "kind", "drawnPxBoxes", "solid", "doorTiles", "reserve", "encloses", "art", "room"]);
    if (!KINDS.includes(r.kind)) fail("schema", `${f}.kind ${JSON.stringify(r.kind)} isn't one of ${KINDS.join(", ")}`);
    if (r.room !== undefined && (r.kind !== "building" || !ROOM_IDS.includes(r.room))) fail("schema", `${f}.room ${JSON.stringify(r.room)} ${r.kind !== "building" ? "is on a " + r.kind + ": only a building has a room" : "isn't one of the game's rooms, " + ROOM_IDS.join(", ")}`);
    if (r.art !== undefined && (r.kind !== "building" || !ART_KINDS.includes(r.art))) fail("schema", `${f}.art ${JSON.stringify(r.art)} ${r.kind !== "building" ? "is on a " + r.kind + ": only a building has art the game draws so far" : "isn't one of " + ART_KINDS.join(", ")}`);
    if (!isObj(r.solid)) fail("schema", `${f}.solid must be an object`);
    only(r.solid, f + ".solid", ["tileBoxes", "tiles", "ringOfBox", "ringOfHabitat", "footPxBoxes"]);
    if (!Object.keys(r.solid).length) fail("schema", `${f}.solid is empty: a content record exists to block something`);
    const drawn = list(r.drawnPxBoxes === undefined ? [] : r.drawnPxBoxes, f + ".drawnPxBoxes").map((b, j) => pxBox(b, `${f}.drawnPxBoxes[${j}]`, W, H));
    const tiles = [], key = new Set(), put = (x, y) => { const q = y * W + x; if (!key.has(q)) { key.add(q); tiles.push([x, y]); } };
    let inner = null;
    if (r.solid.tileBoxes !== undefined) list(r.solid.tileBoxes, f + ".solid.tileBoxes").forEach((b, j) => { tileBox(b, `${f}.solid.tileBoxes[${j}]`, W, H); for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) put(x, y); });
    if (r.solid.tiles !== undefined) list(r.solid.tiles, f + ".solid.tiles").forEach((p, j) => { tile(p, `${f}.solid.tiles[${j}]`, W, H); put(p[0], p[1]); });
    const ringDrawn = [];
    const addRing = (mask, gaps, fr) => {
      const gapSet = new Set(list(gaps === undefined ? [] : gaps, fr + ".gapTiles").map((p, j) => { tile(p, `${fr}.gapTiles[${j}]`, W, H); return p[1] * W + p[0]; }));
      const { ring, inner: ins } = ringOf(mask, W, H);
      for (const g of gapSet) if (!ring.some(([x, y]) => y * W + x === g)) fail("schema", `${fr}.gapTiles: ${g % W},${(g - g % W) / W} isn't on the ring`);
      for (const [x, y] of ring) if (!gapSet.has(y * W + x)) { put(x, y); ringDrawn.push({ px0: x * T, py0: y * T, px1: x * T + T - 1, py1: y * T + T - 1 }); }
      inner = (inner || []).concat(ins);
    };
    if (r.solid.ringOfBox !== undefined) {
      const b = tileBox(r.solid.ringOfBox, f + ".solid.ringOfBox", W, H, ["gapTiles"]);
      if (b.x1 - b.x0 < 2 || b.y1 - b.y0 < 2) fail("schema", `${f}.solid.ringOfBox must be at least 3 x 3`);
      const mask = new Uint8Array(W * H); for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) mask[y * W + x] = 1;
      addRing(mask, b.gapTiles, f + ".solid.ringOfBox");
    }
    if (r.solid.ringOfHabitat !== undefined) {
      const o = r.solid.ringOfHabitat; if (!isObj(o)) fail("schema", `${f}.solid.ringOfHabitat must be { habitat, gapTiles }`);
      only(o, f + ".solid.ringOfHabitat", ["habitat", "gapTiles"]);
      const mask = habitatMask(src, o.habitat, W, H); if (!mask) fail("schema", `${f}.solid.ringOfHabitat.habitat ${JSON.stringify(o.habitat)} isn't a B1e habitat`);
      addRing(mask, o.gapTiles, f + ".solid.ringOfHabitat");
    }
    const foot = list(r.solid.footPxBoxes === undefined ? [] : r.solid.footPxBoxes, f + ".solid.footPxBoxes").map((b, j) => pxBox(b, `${f}.solid.footPxBoxes[${j}]`, W, H));
    const doors = list(r.doorTiles === undefined ? [] : r.doorTiles, f + ".doorTiles").map((p, j) => tile(p, `${f}.doorTiles[${j}]`, W, H));
    if (r.reserve !== undefined && (typeof r.reserve !== "string" || !(src.reserves.footprints || []).some((q) => q.id === r.reserve))) fail("schema", `${f}.reserve ${JSON.stringify(r.reserve)} isn't a B1e footprint`);
    if (r.encloses !== undefined && r.encloses !== true) fail("schema", `${f}.encloses must be true or left out`);
    if (r.encloses && !inner) fail("schema", `${f}.encloses needs a ring (ringOfBox or ringOfHabitat)`);
    const out = { id: r.id, kind: r.kind, drawnPxBoxes: drawn.concat(ringDrawn), tiles: tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]), footPxBoxes: foot, doorTiles: doors };
    if (r.reserve) out.reserve = r.reserve;
    if (r.encloses) out.encloses = true;
    if (r.art) out.art = r.art;
    if (r.room) out.room = r.room;
    if (!out.drawnPxBoxes.length) fail("drawn", `${f} has solid but nothing drawn (drawnPxBoxes is empty)`);
    Object.defineProperty(out, "inner", { value: inner || [], enumerable: false });
    return out;
  });
  return records;
}

/* the derived layers: solid tiles (1 per tile) and foot pixels (1 per pixel), from resolved records */
export function contentLayers(records, W, H) {
  const tiles = new Uint8Array(W * H), foot = new Uint8Array(W * H * T * T);
  for (const r of records) for (const [x, y] of r.tiles) tiles[y * W + x] = 1;
  for (const r of records) for (const b of r.footPxBoxes) for (let py = b.py0; py <= b.py1; py++) for (let px = b.px0; px <= b.px1; px++) foot[py * W * T + px] = 1;
  let solidTiles = 0, footPixels = 0; for (const v of tiles) solidTiles += v; for (const v of foot) footPixels += v;
  return { tiles, foot, solidTiles, footPixels };
}

/* every broken rule, as [rule, message]; [] when the content is sound. m: the compiled terrain; src: its source */
export function contentProblems(records, src, m) {
  const W = m.w, H = m.h, PW = W * T, out = [], add = (rule, msg) => out.push([rule, msg]);
  const at = (x, y) => y * W + x;
  const tWalk = (i) => m.coll[i] === 0;                                // the terrain's own: no flag at all
  const L = contentLayers(records, W, H);
  const owner = new Map();
  for (const r of records) for (const [x, y] of r.tiles) {
    const i = at(x, y);
    if (owner.has(i)) add("overlap", `tile ${x},${y} is solid in both ${owner.get(i)} and ${r.id}`); else owner.set(i, r.id);
    if (!tWalk(i)) add("terrain", `${r.id}: tile ${x},${y} isn't walkable terrain (coll ${m.coll[i]}): content goes on open ground only`);
    else if ([G_BRIDGE, G_DOCK, G_PAD].includes(m.ground[i])) add("terrain", `${r.id}: tile ${x},${y} is ${m.ground[i] === G_BRIDGE ? "a bridge" : m.ground[i] === G_DOCK ? "dock" : "the helipad"}`);
  }
  // the spawn and pi's feet on it (the spawn's aim spot, x - 4 to x + 4, y - 2 to y + 1)
  const sp = m.anchors.spawnTile, sx = sp[0] * T + 8, sy = sp[1] * T + 10;
  if (L.tiles[at(...sp)]) add("spawn", `the spawn tile ${sp} is solid content`);
  for (let py = sy - 2; py <= sy + 1; py++) for (let px = sx - 4; px <= sx + 4; px++) if (L.foot[py * PW + px]) { add("spawn", `a foot box covers pi's feet at the spawn (pixel ${px},${py})`); py = Infinity; break; }
  // D1: nothing solid outside what's drawn
  for (const r of records) {
    const inDrawn = (px, py) => r.drawnPxBoxes.some((b) => px >= b.px0 && px <= b.px1 && py >= b.py0 && py <= b.py1);
    let bad = null;
    for (const [x, y] of r.tiles) { for (let py = y * T; py < y * T + T && !bad; py++) for (let px = x * T; px < x * T + T; px++) if (!inDrawn(px, py)) { bad = `tile ${x},${y} (pixel ${px},${py})`; break; } if (bad) break; }
    if (!bad) for (const b of r.footPxBoxes) { for (let py = b.py0; py <= b.py1 && !bad; py++) for (let px = b.px0; px <= b.px1; px++) if (!inDrawn(px, py)) { bad = `foot pixel ${px},${py}`; break; } if (bad) break; }
    if (bad) add("drawn", `${r.id}: its collision reaches ${bad}, outside what it draws (D1: no invisible collision)`);
    for (const b of r.footPxBoxes) {
      let hit = null;
      for (let ty = b.py0 >> 4; ty <= b.py1 >> 4 && !hit; ty++) for (let tx = b.px0 >> 4; tx <= b.px1 >> 4; tx++) if (!tWalk(at(tx, ty)) || L.tiles[at(tx, ty)]) { hit = `${tx},${ty}`; break; }
      if (hit) add("foot", `${r.id}: a foot box lies on tile ${hit}, which is already blocked (foot boxes go on tiles that stay walkable)`);
    }
  }
  // reserves: a record naming one stays in it; nobody else's solid goes in one
  const RES = (src.reserves.footprints || []).map((q) => ({ id: q.id, b: q.footprintBox || (q.sameAs === "exits.south.ferryTerminalReserveBox" ? src.exits.south.ferryTerminalReserveBox : null) })).filter((q) => q.b);
  const inBox = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  for (const r of records) {
    const own = r.reserve && RES.find((q) => q.id === r.reserve);
    for (const [x, y] of r.tiles) {
      if (own && !inBox(x, y, own.b)) { add("reserve", `${r.id}: tile ${x},${y} is outside its reserve ${own.id}`); break; }
      const other = RES.find((q) => q.id !== r.reserve && inBox(x, y, q.b));
      if (other) { add("reserve", `${r.id}: tile ${x},${y} is inside the reserve ${other.id}, which it doesn't name`); break; }
    }
  }
  // buildings (B3c1): art, footprint, reserve, room and door
  for (const r of records) {
    if (r.kind !== "building") continue;
    const B = (msg) => add("buildings", `${r.id}: ${msg}`);
    if (!r.art) { B("a building draws itself: it needs art (\"placeholder\" until the art stage)"); continue; }
    if (!r.tiles.length) { B("a building's footprint is solid, and it has no solid tiles"); continue; }
    const xs = r.tiles.map((p) => p[0]), ys = r.tiles.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (r.tiles.length !== (x1 - x0 + 1) * (y1 - y0 + 1)) B(`its solid must be one full rectangle (its footprint): ${r.tiles.length} tiles in ${x0},${y0} to ${x1},${y1}`);
    if (r.art === "placeholder") {
      const b = r.drawnPxBoxes;
      if (b.length !== 1) B(`placeholder art is one drawn box, not ${b.length}`);
      else if (b[0].px0 !== x0 * T || b[0].px1 !== x1 * T + T - 1 || b[0].py1 !== y1 * T + T - 1 || b[0].py0 > y0 * T) B(`its placeholder art must cover the footprint exactly in width and stand on its front edge (px ${x0 * T} to ${x1 * T + T - 1}, bottom ${y1 * T + T - 1}), not ${JSON.stringify(b[0])}`);
    }
    const own = r.reserve && RES.find((q) => q.id === r.reserve);
    if (own && (x0 !== own.b.x0 || y0 !== own.b.y0 || x1 !== own.b.x1 || y1 !== own.b.y1)) B(`it names the reserve ${own.id} (${own.b.x0},${own.b.y0} to ${own.b.x1},${own.b.y1}) and must fill it exactly, not ${x0},${y0} to ${x1},${y1}`);
    if (r.room) {
      if (r.doorTiles.length !== 1) { B(`it opens into the room ${r.room}, so it has exactly one door, not ${r.doorTiles.length}`); continue; }
      const [dx, dy] = r.doorTiles[0];
      if (dy !== y1 + 1 || dx < x0 || dx > x1) B(`its door ${dx},${dy} must be right in front of its footprint (row ${y1 + 1}, x ${x0} to ${x1}: the front is south)`);
      const fx = dx * T + 8, fy = dy * T + 6;
      let hit = null; for (let py = fy - 2; py <= fy + 1 && !hit; py++) for (let px = fx - 4; px <= fx + 4; px++) if (m.px.foot[py * PW + px]) { hit = `${px},${py}`; break; }
      if (hit) B(`its doorway (${fx},${fy}) is on the terrain's foot-blocking pixels (${hit}): pi couldn't stand in it`);
    }
  }
  // the open spaces (the rift arena's clear field, tested at tile centres as B1e does)
  for (const o of src.reserves.openSpaces || []) {
    const e = o.clearField;
    for (const r of records) for (const [x, y] of r.tiles) if (((x + 0.5 - e.cx) / e.rx) ** 2 + ((y + 0.5 - e.cy) / e.ry) ** 2 <= 1) { add("open-space", `${r.id}: tile ${x},${y} is in ${o.id}'s clear field`); break; }
  }
  // reachability: tile floods from the spawn, before and after content
  const flood = (blocked) => { const seen = new Uint8Array(W * H), q = [at(...sp)]; if (blocked(q[0])) return seen; seen[q[0]] = 1; for (let k = 0; k < q.length; k++) { const c = q[k], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = at(nx, ny); if (!seen[n] && !blocked(n)) { seen[n] = 1; q.push(n); } } } return seen; };
  const before = flood((i) => !tWalk(i)), after = flood((i) => !tWalk(i) || L.tiles[i] === 1);
  for (const r of records) for (const [x, y] of r.doorTiles) {
    const i = at(x, y);
    if (!tWalk(i) || L.tiles[i]) add("doors", `${r.id}: door ${x},${y} isn't walkable`);
    else if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.tiles.some(([tx, ty]) => tx === x + dx && ty === y + dy))) add("doors", `${r.id}: door ${x},${y} isn't next to its solid`);
    else if (!after[i]) add("doors", `${r.id}: door ${x},${y} can't be reached from the spawn`);
  }
  for (const e of (src.corridors && src.corridors.routeEnds) || []) if (!after[at(...e.endTile)]) add("route-ends", `route end ${e.id} ${e.endTile} can't be reached from the spawn`);
  const enclosed = new Set(); for (const r of records) if (r.encloses) for (const [x, y] of r.inner) enclosed.add(at(x, y));
  let lost = 0, first = null;
  for (let i = 0; i < W * H; i++) if (before[i] && !after[i] && !L.tiles[i] && !enclosed.has(i)) { lost++; if (!first) first = `${i % W},${(i - i % W) / W}`; }
  if (lost) add("pockets", `${lost} walkable tile(s) cut off from the spawn that no encloses record encloses (first ${first})`);
  return out;
}

/* the compile: resolve, then every rule; throws the first problem as a ContentError */
export function compileContent(content, src, m) {
  const records = resolveContent(content, src, m);
  const p = contentProblems(records, src, m);
  if (p.length) throw new ContentError(p[0][0], p[0][1]);
  const L = contentLayers(records, m.w, m.h);
  return { records, solidTiles: L.solidTiles, footPixels: L.footPixels };
}

/* the staged content file's text: deterministic, keys in a fixed order */
export function serializeContent(c, meta) {
  const num = (v) => JSON.stringify(v);
  const rec = (r) => {
    const o = { id: r.id, kind: r.kind, drawnPxBoxes: r.drawnPxBoxes, tiles: r.tiles, footPxBoxes: r.footPxBoxes, doorTiles: r.doorTiles };
    if (r.reserve) o.reserve = r.reserve;
    if (r.encloses) o.encloses = true;
    if (r.art) o.art = r.art;
    if (r.room) o.room = r.room;
    return `    ${num(o)}`;
  };
  return [
    `/* STAGED MAP-B home island content (B3), generated by tools/map-content.mjs from tools/maps/home.content.mjs: regenerate`,
    `   it, never edit it. It is the content layer of the staged terrain in tools/maps/staged/home.js and is bound to it by`,
    `   terrainSha256 (that file's sourceSha256). It registers window.ISLAND_MAPS_STAGED_CONTENT, never window.ISLAND_MAPS;`,
    `   only the local content preview (tools/mapb-preview.mjs --content, on a loopback host) loads it, and tools/ is never`,
    `   deployed. Production runs the 100 x 80 island in js/maps/home.js.`,
    `   records: each content record (kind building, landmark, station, wall, fence, gate or prop): drawnPxBoxes, where its art`,
    `   is drawn (inclusive world pixels; no collision outside them); tiles, the whole tiles it makes solid; footPxBoxes, pixels`,
    `   where feet stop on tiles that stay walkable; doorTiles; a building's art and room. solidTiles and footPixels: the totals,`,
    `   which the game checks.`,
    `   The game reads the terrain's collision for painting and the union of both layers for movement. */`,
    `(window.ISLAND_MAPS_STAGED_CONTENT = window.ISLAND_MAPS_STAGED_CONTENT || {}).home = {`,
    `  "format": 2, "staged": true, "schema": ${num(CONTENT_SCHEMA)}, "id": ${num(meta.id)}, "generator": "tools/map-content.mjs",`,
    `  "source": "tools/maps/home.content.mjs", "sourceSha256": ${num(meta.sourceSha256)}, "terrainSha256": ${num(meta.terrainSha256)},`,
    `  "solidTiles": ${c.solidTiles}, "footPixels": ${c.footPixels},`,
    c.records.length ? `  "records": [\n${c.records.map(rec).join(",\n")}\n  ]` : `  "records": []`,
    `};`,
    ``
  ].join("\n");
}
