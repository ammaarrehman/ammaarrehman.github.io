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
         ringOfBox: { ...tileBox, gapTiles: [[x, y], ...], terrainTiles: [[x, y], ...] },
                                                               // a wall or fence round a box's edge, minus its gaps and
                                                               //   (B3d3) the tiles of it the terrain itself closes
         ringOfHabitat: { habitat, gapTiles: [[x, y], ...] },  // round a B1e habitat outline: its tiles with any of the
                                                               //   8 neighbours outside it (a 4-connected ring)
         footPxBoxes: [pxBox, ...]       //   pixels where feet stop on a tile that stays walkable (a post, a sign's base)
       },
       doorTiles: [[x, y], ...],         // optional: walkable tiles next to its solid, reachable from the spawn
       reserve: "footprint-id",          // optional: the B1e footprint it stands in (its solid must stay inside it)
       encloses: true,                   // optional: it may cut ground off (a paddock fence); nothing else may
       art: "placeholder",               // a building's, a wall's, a fence's, a gate's or a landmark's (B3c1, B3c3, B3d1, B3d3,
                                         //   B3d4a; required on each): what the game draws
       room: "visitor",                  // a building's, optional (B3c1): the game's room behind its one door
       compound: "bunker-compound",      // a wall's, optional (B3c3): the B1e walled compound it walls in
       marker: "park-gate"               // a gate's (B3d3, required): the B1e marker it stands on
     }

     station record (B3d4b): { id, kind: "station", anchor: [x, y], approach: [x, y], place: { <kind>: "<id>" } }
                                         // no solid, drawnPxBoxes, doorTiles, reserve, encloses, art, room, compound or
                                         //   marker: a station blocks nothing and draws nothing of its own here

     roam record (B3e1): { id: "roam-NN", kind: "roam", box: tileBox, habitat?: "b1e-habitat-id",
                           spawns: [{ creature: "<kind>", at: [x, y] }, ...] }
                                         // format 1's roam area of that id and the creatures that start in it; no collision

   A building (B3c1) draws itself: art "placeholder" is the game's temporary building art, drawn exactly over the
   record's one drawn box, until the art stage adds real sprites as a new art kind (the footprint, the door and the
   collision stay as they are). Its solid is its footprint, one full rectangle; its art box is as wide as the
   footprint and stands on its front edge (it may rise above it); a building naming a reserve fills that footprint
   exactly; one with a room has exactly one door, the tile right in front of the footprint (every B1e footprint's
   front is south), and pi's feet fit in the doorway there (clear of the terrain's foot-blocking pixels).

   A ring's drawn boxes are its own tiles (a fence or wall is drawn on every tile it stands on), added by the compile.

   A wall (B3c3) draws itself too: art "placeholder" is the game's temporary wall art, one opaque tile of it on every
   solid tile of the wall and nowhere else, so what looks solid is exactly what blocks. Its solid is one ring (round a
   box or a habitat) and nothing else, and it has no drawn box of its own (the compile adds its tiles). Its openings are
   the ring's gaps: open ground, clear of all content, reachable from the spawn, never a corner (a corner joins two runs;
   an opening there leads nowhere). A wall naming a B1e compound is that compound's wall: the ring of its compoundBox,
   with exactly its gateTiles as the openings. An opening is a plain gap, as format 1's compound gate is: nothing opens,
   closes or locks. Where the ring runs over terrain that is itself solid land (a cliff rim: the koi garden's east side,
   B3d3), the terrain closes it and no wall is built there: those tiles are listed (terrainTiles), each on the ring, not an
   opening, and solid land in the terrain (never water); they are neither solid content nor drawn (the terrain painter
   draws the cliff), and any other ring tile on terrain a foot can't walk is still refused (terrain).

   A fence (B3d1) draws itself the same way: art "placeholder" is the game's temporary paddock fence, one opaque tile of
   it on every solid tile and nowhere else. A fence is a paddock's: its solid is the ring of one B1e habitat whose
   containment is "contained" (ringOfHabitat) and nothing else, and it is named for that habitat (its id is the
   habitat's), so no fence line is ever drawn from anything but the approved habitat geometry. It has no drawn box of its
   own, no door, no reserve and no foot box. Its openings follow the walls' rules (open ground, clear of all content,
   reachable from the spawn, never a corner of the ring). A fence with no openings closes its habitat in, and says so
   (encloses: true); one with openings doesn't. Nothing in a fence opens, closes, locks or shocks: like format 1's paddock
   fences it is collision and art.

   A gate (B3d3) is format 1's park gate: an arch over a road, standing on a B1e marker (marker; the record is named for
   it). Its solid is exactly its two posts, the tiles 2 either side of the marker on its row (format 1's rule: posts at
   x - 2 and x + 2, solid), and nothing else (no ring, box, foot box, door or reserve). Its art (placeholder: the game's
   temporary arch, two timber posts each as wide as its tile, a crossbeam and a sign) is one drawn box from the west
   post's west edge to the east post's east edge, standing on the posts' bottom edge (it rises above them: the posts and
   the sign stand up). Its opening is the three tiles between the posts: open ground (walkable, no content, no
   foot-blocking pixels), reached from the spawn, with open ground right in front of and behind its middle, so the road
   goes through. Nothing in it opens, closes or locks: like format 1's it is art and two posts.

   A landmark base (B3d4a) is the body of a landmark that stands on a B1e landmark footprint (the tower's, the
   lighthouse's): named for it (its id is the footprint's id with "-base"), naming it as its reserve, its solid that
   footprint exactly (one full rectangle), and its art (placeholder: the game's temporary tower or lighthouse) one drawn
   box as wide as the footprint, standing on its front edge (it rises above it: the structure stands tall), opaque over
   every tile of the footprint. No door, foot box, opening or room; the tile in the middle of its front (floor(x0 + w / 2),
   y1 + 1: where the landmark is approached from, B3a's) is open ground reached from the spawn. A base is structure only:
   the landmark's interaction (its station: the log, the tour stop, the links) is a station record's (B3d4b).

   A station (B3d4b) is one of format 1's eleven outdoor stations (the game's own ids and words: the signpost, the uplink,
   the watchtower, the lighthouse, the macbook, the stone tablet, the mailbox, the drink stand, the shrine, the cave and the
   boat), moved to its approved MAP-B place. It is an interaction point and nothing more: it adds no collision (no solid,
   no foot box) and draws nothing of its own here (the game draws a free-standing station with format 1's sprite, and a
   station on a landmark is drawn by its landmark base). Its anchor is the tile the station stands on (the point [E]
   reaches to, as format 1's station tile); its approach is the tile pi uses it from (format 1's: the tile south of it;
   the boat's, at sea, the pier's end north of it): open ground with pi's feet clear of every foot-blocking pixel, reached
   from the spawn, a step from the anchor and within [E]'s reach of it (26 px from pi's feet to the station's point).
   place names what the station is tied to, one of the approved sources (B3a's placement plan), and must be that
   station's own (STATION_PLACES):
     landmark   a landmark base in this content (the tower's, the lighthouse's): the anchor is the middle of its front
                row, on the base (floor(x0 + w / 2), y1), and the approach is the base's own approach in front of it
     marker     a B1e marker with an approach tile (the shrine, the cave mouth): the anchor is the marker, the approach its
                approach tile
     logSite    a B1e planning log site (the mailbox, the tablet, the uplink, the macbook): the approach is the site or a
                tile beside it (the macbook's stands by the koi garden's loop, the site one tile east)
     plaza      a B1e plaza (the arrival plaza's sign, the village square's drink stand): the anchor is inside its box
     berth      a B1e exit's berth (the south harbour's, for the boat): the anchor is the berth (at sea), the approach the
                pier's end north of it
   A roam area (B3e1) is one of format 1's creature roam areas (its id, roam-00 to roam-27), moved to its approved MAP-B box
   (B3a's placement plan, ROAM_PLAN), with the creatures that start in it, in format 1's order (so the game's sharing graph
   is format 1's: creatures naming one roam area share it, a herd follows its leader by it). It is no collision and draws
   nothing: the creatures are the game's (format 1's kinds, art, movement and words). Its box, its habitat (the B1e region
   it stands in, where B3a gave one) and its spawns are exactly the plan's; every spawn stands inside the box on a tile its
   creature may stand on (format 1's okFor: open ground, grass for a dinosaur, path for a robot or the roomba, anything but a
   dock for a cat) with its feet clear of every foot-blocking pixel; the box holds at least one more such tile to walk to;
   roam areas come in format 1's order.

   A free-standing station's anchor is open land (walkable terrain with no content tile, not a bridge, a dock or the pad)
   outside every B1e footprint; a landmark's is on its base; the boat's is the sea. No two stations share an anchor, and
   a landmark carries at most one station.

   The compiled record (the staged content file and the game): { id, kind, drawnPxBoxes, tiles, footPxBoxes, doorTiles,
   gapTiles?, terrainTiles?, reserve?, encloses?, art?, room?, compound?, marker?, anchor?, approach?, place? }, every solid
   as an explicit tile list, so the game derives its layer without knowing any shape; gapTiles (a ring's openings, B3c3) let
   the game draw the posts either side of them; terrainTiles (B3d3) are where the terrain closes a wall's ring; a station's
   anchor, approach and place (B3d4b), with its tile, foot box, door and drawn lists empty.

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
     walls          a wall's art, ring, openings, compound and the tiles the terrain closes, as above (B3c3, B3d3)
     fences         a fence's art, habitat ring, name, openings and enclosure, as above (B3d1)
     gates          a gate's art, marker, posts, drawn box and opening, as above (B3d3)
     landmarks      a landmark base's art, footprint, name, drawn box and approach, as above (B3d4a)
     stations       a station's id, place, anchor and approach, as above (B3d4b)
     creatures      a roam area's id, box, habitat and spawns, as above (B3e1)
     open-space     nothing solid in the B1e open spaces (the rift arena's clear field)
     doors          each door tile walkable, next to its record's solid, reachable from the spawn
     route-ends     every B1d route end still reachable from the spawn
     pockets        no ground the spawn reached before is cut off, apart from what an encloses record encloses */
import { regionPoly } from "../map-compile.mjs";
import { raster } from "./geom.mjs";

export const CONTENT_SCHEMA = "mapb-content-1";
export const KINDS = ["building", "landmark", "station", "wall", "fence", "gate", "prop", "roam"];
export const RULES = ["schema", "terrain", "spawn", "drawn", "overlap", "foot", "reserve", "buildings", "walls", "fences", "gates", "landmarks", "stations", "creatures", "open-space", "doors", "route-ends", "pockets"];
/* the rooms a building may open into (the game's ROOMS in js/world.js, whose decoder holds the same list), the art
   kinds the game draws, and what it draws them on (a building since B3c1, a wall since B3c3, a fence since B3d1, a gate
   since B3d3, a landmark since B3d4a) */
export const ROOM_IDS = ["visitor", "bunker", "depot"];
export const ART_KINDS = ["placeholder"];
export const ART_ON = ["building", "wall", "fence", "gate", "landmark"];
/* the stations (B3d4b): format 1's eleven outdoor stations (the game's STATION_WORDS ids that stand outdoors, whose decoder
   holds the same list), and the place each is tied to, from B3a's approved placement plan */
export const STATION_IDS = ["sign", "uplink", "tower", "lighthouse", "macbook", "tablet", "mailbox", "drink", "shrine", "cave", "boat"];
export const STATION_PLACES = {
  sign: { plaza: "arrival-plaza" }, uplink: { logSite: "uplink" }, tower: { landmark: "tower-base" }, lighthouse: { landmark: "lighthouse-base" },
  macbook: { logSite: "macbook" }, tablet: { logSite: "tablet" }, mailbox: { logSite: "mailbox" }, drink: { plaza: "village-square" },
  shrine: { marker: "shrine" }, cave: { marker: "cave-mouth" }, boat: { berth: "south" }
};
export const PLACE_KINDS = ["landmark", "marker", "logSite", "plaza", "berth"];
export const STATION_REACH = 26;
/* the creatures (B3e1): format 1's kinds (the game's CREATURE_KINDS, but rex, who is his own system), and B3a's approved roam
   areas, in format 1's order: each id's box on the staged island, the B1e habitat it stands in (none for the robots and the
   roomba, which keep to paths), and the creatures that start in it, kind and tile (format 1's kinds, counts and order). Amended
   by Ammaar for B3e6 (2026-10-29): roam-23 42,82 to 54,88 became 42,82 to 52,88 and roam-25 72,75 to 84,81 became 75,75 to 84,81,
   the spawns kept, so the robot doesn't pass behind the drink stand (53,87) nor the roomba under the signpost (74,76): MAP-B's
   stations have no collision, and the bots vanished into their art. Amended by Ammaar for B3e7 (2026-10-30): roam-26 and roam-27 (both
   105,56 to 117,68, round the koi pond) became Jasmine's south lawn 105,65 to 117,68 and Prince's north lawn 107,56 to 117,58, the spawns
   and the habitat kept: format 1's straight wander stopped at the pond on about half the cats' walks (five targets unreachable), and a
   cat by the macbook (105,57) was hidden under its blanket and lost [E] to it */
export const CREATURE_KINDS = ["brachio", "trex", "stego", "trike", "para", "raptor", "ankylo", "baby", "spino", "dilo", "pachy", "galli", "compy", "baby2", "robot", "roomba", "cat"];
const RP = (box, habitat, spawns) => ({ box: { x0: box[0], y0: box[1], x1: box[2], y1: box[3] }, habitat, spawns: spawns.map(([creature, x, y]) => ({ creature, at: [x, y] })) });
export const ROAM_PLAN = {
  "roam-00": RP([12, 33, 27, 50], "brachio-meadow", [["brachio", 16, 38]]), "roam-01": RP([12, 33, 27, 50], "brachio-meadow", [["brachio", 22, 46]]),
  "roam-02": RP([108, 11, 116, 16], "holding-paddock", [["trex", 112, 14]]),
  "roam-03": RP([120, 11, 126, 16], "raptor-yard", [["raptor", 121, 12], ["raptor", 124, 14], ["raptor", 125, 12]]),
  "roam-04": RP([41, 43, 57, 60], "riverlands-range", [["stego", 44, 46], ["trike", 50, 47], ["trike", 54, 55], ["ankylo", 45, 58]]),
  "roam-05": RP([14, 71, 22, 80], "delta-wetland", [["para", 20, 73]]), "roam-06": RP([14, 71, 22, 80], "delta-wetland", [["para", 16, 77]]),
  "roam-07": RP([37, 31, 46, 38], "spino-reach", [["spino", 40, 34]]),
  "roam-08": RP([89, 14, 95, 21], "dilo-strip", [["dilo", 91, 17]]),
  "roam-09": RP([36, 15, 45, 22], "pachy-heath", [["pachy", 38, 18]]), "roam-10": RP([36, 15, 45, 22], "pachy-heath", [["pachy", 42, 19]]),
  "roam-11": RP([85, 41, 95, 48], "galli-meadow", [["galli", 87, 43]]), "roam-12": RP([85, 41, 95, 48], "galli-meadow", [["galli", 90, 42]]),
  "roam-13": RP([85, 41, 95, 48], "galli-meadow", [["galli", 93, 45]]), "roam-14": RP([85, 41, 95, 48], "galli-meadow", [["galli", 86, 47]]),
  "roam-15": RP([27, 91, 33, 96], "village-gardens", [["compy", 29, 92]]), "roam-16": RP([27, 91, 33, 96], "village-gardens", [["compy", 30, 93]]),
  "roam-17": RP([27, 91, 33, 96], "village-gardens", [["compy", 28, 94]]), "roam-18": RP([27, 91, 33, 96], "village-gardens", [["compy", 31, 92]]),
  "roam-19": RP([27, 91, 33, 96], "village-gardens", [["compy", 27, 93]]),
  "roam-20": RP([44, 50, 53, 56], "riverlands-range", [["baby", 47, 52]]), "roam-21": RP([44, 50, 53, 56], "riverlands-range", [["baby2", 50, 53]]),
  "roam-22": RP([14, 36, 22, 43], "brachio-meadow", [["baby", 19, 38]]),
  "roam-23": RP([42, 82, 52, 88], null, [["robot", 45, 85]]), "roam-24": RP([27, 80, 41, 86], null, [["robot", 33, 85]]),
  "roam-25": RP([75, 75, 84, 81], null, [["roomba", 77, 78]]),
  "roam-26": RP([105, 65, 117, 68], "koi-garden", [["cat", 108, 66]]), "roam-27": RP([107, 56, 117, 58], "koi-garden", [["cat", 113, 57]])
};
// format 1's okFor: a tile a creature may walk to or stand on (ground codes: grass 3, path 4, dock 6)
export const creatureMayStand = (kind, ground) => (kind === "robot" || kind === "roomba" ? ground === 4 : kind === "cat" ? ground !== 6 : ground === 3);                 // the game's: [E] reaches a station 26 px from pi's feet (nearCandidates)
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
    only(r, f, ["id", "kind", "drawnPxBoxes", "solid", "doorTiles", "reserve", "encloses", "art", "room", "compound", "marker", "anchor", "approach", "place", "box", "habitat", "spawns"]);
    if (!KINDS.includes(r.kind)) fail("schema", `${f}.kind ${JSON.stringify(r.kind)} isn't one of ${KINDS.join(", ")}`);
    if (r.kind === "station") return station(r, f);
    if (r.kind === "roam") return roam(r, f);
    for (const k of ["box", "habitat", "spawns"]) if (r[k] !== undefined) fail("schema", `${f}.${k} is on a ${r.kind}: only a roam area has a box, a habitat and spawns`);
    for (const k of ["anchor", "approach", "place"]) if (r[k] !== undefined) fail("schema", `${f}.${k} is on a ${r.kind}: only a station has an anchor, an approach and a place`);
    if (r.room !== undefined && (r.kind !== "building" || !ROOM_IDS.includes(r.room))) fail("schema", `${f}.room ${JSON.stringify(r.room)} ${r.kind !== "building" ? "is on a " + r.kind + ": only a building has a room" : "isn't one of the game's rooms, " + ROOM_IDS.join(", ")}`);
    if (r.art !== undefined && (!ART_ON.includes(r.kind) || !ART_KINDS.includes(r.art))) fail("schema", `${f}.art ${JSON.stringify(r.art)} ${!ART_ON.includes(r.kind) ? "is on a " + r.kind + ": only a building, a wall, a fence, a gate or a landmark has art the game draws so far" : "isn't one of " + ART_KINDS.join(", ")}`);
    if (r.compound !== undefined && (r.kind !== "wall" || !(src.reserves.compounds || []).some((q) => q.id === r.compound && q.walled === true))) fail("schema", `${f}.compound ${JSON.stringify(r.compound)} ${r.kind !== "wall" ? "is on a " + r.kind + ": only a wall walls in a compound" : "isn't one of B1e's walled compounds"}`);
    if (r.marker !== undefined && (r.kind !== "gate" || !(src.reserves.markers || []).some((q) => q.id === r.marker))) fail("schema", `${f}.marker ${JSON.stringify(r.marker)} ${r.kind !== "gate" ? "is on a " + r.kind + ": only a gate stands on a marker" : "isn't one of B1e's markers"}`);
    if (!isObj(r.solid)) fail("schema", `${f}.solid must be an object`);
    only(r.solid, f + ".solid", ["tileBoxes", "tiles", "ringOfBox", "ringOfHabitat", "footPxBoxes"]);
    if (!Object.keys(r.solid).length) fail("schema", `${f}.solid is empty: a content record exists to block something`);
    const drawn = list(r.drawnPxBoxes === undefined ? [] : r.drawnPxBoxes, f + ".drawnPxBoxes").map((b, j) => pxBox(b, `${f}.drawnPxBoxes[${j}]`, W, H));
    const tiles = [], key = new Set(), put = (x, y) => { const q = y * W + x; if (!key.has(q)) { key.add(q); tiles.push([x, y]); } };
    let inner = null;
    if (r.solid.tileBoxes !== undefined) list(r.solid.tileBoxes, f + ".solid.tileBoxes").forEach((b, j) => { tileBox(b, `${f}.solid.tileBoxes[${j}]`, W, H); for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) put(x, y); });
    if (r.solid.tiles !== undefined) list(r.solid.tiles, f + ".solid.tiles").forEach((p, j) => { tile(p, `${f}.solid.tiles[${j}]`, W, H); put(p[0], p[1]); });
    const ringDrawn = [], gapTiles = [], terrainTiles = [];
    const addRing = (mask, gaps, fr, terr) => {
      const at2 = (p, j, what) => { tile(p, `${fr}.${what}[${j}]`, W, H); return p[1] * W + p[0]; };
      const gapSet = new Set(list(gaps === undefined ? [] : gaps, fr + ".gapTiles").map((p, j) => at2(p, j, "gapTiles")));
      const terrSet = new Set(list(terr === undefined ? [] : terr, fr + ".terrainTiles").map((p, j) => at2(p, j, "terrainTiles")));
      const { ring, inner: ins } = ringOf(mask, W, H);
      for (const g of gapSet) if (!ring.some(([x, y]) => y * W + x === g)) fail("schema", `${fr}.gapTiles: ${g % W},${(g - g % W) / W} isn't on the ring`);
      for (const g of terrSet) {
        if (!ring.some(([x, y]) => y * W + x === g)) fail("schema", `${fr}.terrainTiles: ${g % W},${(g - g % W) / W} isn't on the ring`);
        if (gapSet.has(g)) fail("schema", `${fr}.terrainTiles: ${g % W},${(g - g % W) / W} is an opening too`);
      }
      for (const [x, y] of ring) if (terrSet.has(y * W + x)) terrainTiles.push([x, y]); else if (!gapSet.has(y * W + x)) { put(x, y); ringDrawn.push({ px0: x * T, py0: y * T, px1: x * T + T - 1, py1: y * T + T - 1 }); } else gapTiles.push([x, y]);
      inner = (inner || []).concat(ins);
    };
    if (r.solid.ringOfBox !== undefined) {
      const b = tileBox(r.solid.ringOfBox, f + ".solid.ringOfBox", W, H, ["gapTiles", "terrainTiles"]);
      if (b.x1 - b.x0 < 2 || b.y1 - b.y0 < 2) fail("schema", `${f}.solid.ringOfBox must be at least 3 x 3`);
      const mask = new Uint8Array(W * H); for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) mask[y * W + x] = 1;
      addRing(mask, b.gapTiles, f + ".solid.ringOfBox", b.terrainTiles);
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
    if (gapTiles.length) out.gapTiles = gapTiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (terrainTiles.length) out.terrainTiles = terrainTiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (r.reserve) out.reserve = r.reserve;
    if (r.encloses) out.encloses = true;
    if (r.art) out.art = r.art;
    if (r.room) out.room = r.room;
    if (r.compound) out.compound = r.compound;
    if (r.marker) out.marker = r.marker;
    if (!out.drawnPxBoxes.length) fail("drawn", `${f} has solid but nothing drawn (drawnPxBoxes is empty)`);
    Object.defineProperty(out, "inner", { value: inner || [], enumerable: false });
    // what the walls rule (B3c3) needs of the source: which solid shapes it used, its ring's box, and its own drawn boxes
    // and the fences rule (B3d1): which habitat its ring is round; the gates rule (B3d3) uses the shapes and drawn boxes
    Object.defineProperty(out, "shape", { value: { solid: Object.keys(r.solid), box: r.solid.ringOfBox ? { x0: r.solid.ringOfBox.x0, y0: r.solid.ringOfBox.y0, x1: r.solid.ringOfBox.x1, y1: r.solid.ringOfBox.y1 } : null, habitat: r.solid.ringOfHabitat ? r.solid.ringOfHabitat.habitat : null, ownDrawn: drawn.length }, enumerable: false });
    return out;
  });
  return records;
  /* a station (B3d4b): an interaction point, no collision and nothing drawn of its own; the rule checks the rest */
  function station(r, f) {
    for (const k of ["box", "habitat", "spawns"]) if (r[k] !== undefined) fail("schema", `${f}.${k}: only a roam area has a box, a habitat and spawns`);
    for (const k of ["drawnPxBoxes", "solid", "doorTiles", "reserve", "encloses", "art", "room", "compound", "marker"]) if (r[k] !== undefined) fail("schema", `${f}.${k}: a station is an interaction point with no ${k === "solid" ? "collision (it blocks nothing)" : k === "drawnPxBoxes" ? "drawn box of its own" : k}`);
    const anchor = tile(r.anchor, f + ".anchor", W, H), approach = tile(r.approach, f + ".approach", W, H);
    if (!isObj(r.place)) fail("schema", `${f}.place must be { <kind>: "<id>" }, one of ${PLACE_KINDS.join(", ")}`);
    const pk = Object.keys(r.place);
    if (pk.length !== 1 || !PLACE_KINDS.includes(pk[0]) || typeof r.place[pk[0]] !== "string" || !ID.test(r.place[pk[0]])) fail("schema", `${f}.place must name one place, { <kind>: "<id>" } with kind one of ${PLACE_KINDS.join(", ")}, not ${JSON.stringify(r.place)}`);
    const out = { id: r.id, kind: "station", drawnPxBoxes: [], tiles: [], footPxBoxes: [], doorTiles: [], anchor: [anchor[0], anchor[1]], approach: [approach[0], approach[1]], place: { [pk[0]]: r.place[pk[0]] } };
    Object.defineProperty(out, "inner", { value: [], enumerable: false });
    Object.defineProperty(out, "shape", { value: { solid: [], box: null, habitat: null, ownDrawn: 0 }, enumerable: false });
    return out;
  }
  /* a roam area (B3e1): a box, its habitat and its spawns; no collision and nothing drawn; the rule checks the rest */
  function roam(r, f) {
    for (const k of ["drawnPxBoxes", "solid", "doorTiles", "reserve", "encloses", "art", "room", "compound", "marker", "anchor", "approach", "place"]) if (r[k] !== undefined) fail("schema", `${f}.${k}: a roam area ${k === "solid" ? "blocks nothing" : k === "drawnPxBoxes" ? "draws nothing" : "has no " + k}`);
    const b = tileBox(r.box, f + ".box", W, H);
    if (r.habitat !== undefined && (typeof r.habitat !== "string" || !(src.habitats || []).some((q) => q.id === r.habitat))) fail("schema", `${f}.habitat ${JSON.stringify(r.habitat)} isn't a B1e habitat`);
    const sp = list(r.spawns, f + ".spawns").map((q, j) => {
      const g = `${f}.spawns[${j}]`;
      if (!isObj(q)) fail("schema", `${g} must be { creature, at }`);
      only(q, g, ["creature", "at"]);
      if (!CREATURE_KINDS.includes(q.creature)) fail("schema", `${g}.creature ${JSON.stringify(q.creature)} isn't one of the game's creatures (${CREATURE_KINDS.join(", ")})`);
      tile(q.at, g + ".at", W, H);
      return { creature: q.creature, at: [q.at[0], q.at[1]] };
    });
    if (!sp.length) fail("schema", `${f}.spawns is empty: a roam area is where creatures start`);
    const out = { id: r.id, kind: "roam", drawnPxBoxes: [], tiles: [], footPxBoxes: [], doorTiles: [], box: [b.x0, b.y0, b.x1, b.y1], spawns: sp };
    if (r.habitat) out.habitat = r.habitat;
    Object.defineProperty(out, "inner", { value: [], enumerable: false });
    Object.defineProperty(out, "shape", { value: { solid: [], box: null, habitat: null, ownDrawn: 0 }, enumerable: false });
    return out;
  }
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
  // walls (B3c3): art, one ring and nothing else, its art its own tiles, its openings, and its compound
  for (const r of records) {
    if (r.kind !== "wall") continue;
    const B = (msg) => add("walls", `${r.id}: ${msg}`), S = r.shape || { solid: [], box: null, ownDrawn: 0 }, gaps = r.gapTiles || [];
    if (!r.art) B("a wall draws itself: it needs art (\"placeholder\" until the art stage)");
    const rings = S.solid.filter((k) => k === "ringOfBox" || k === "ringOfHabitat").length;
    if (rings !== 1 || S.solid.length !== 1) B(`a wall's solid is one ring (ringOfBox or ringOfHabitat) and nothing else, not ${S.solid.join(", ") || "nothing"}`);
    if (S.ownDrawn) B(`its art is drawn on its own tiles exactly (the compile adds them), so it has no drawn box of its own, not ${S.ownDrawn}`);
    for (const [x, y] of gaps) {
      const i = at(x, y);
      let wet = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) wet += m.px.foot[py * PW + px] || L.foot[py * PW + px] ? 1 : 0;
      if (S.box && (x === S.box.x0 || x === S.box.x1) && (y === S.box.y0 || y === S.box.y1)) B(`its opening ${x},${y} is a corner: a corner joins two runs, and an opening there leads nowhere`);
      else if (!tWalk(i) || L.tiles[i] || wet) B(`its opening ${x},${y} isn't open ground (${!tWalk(i) ? "terrain coll " + m.coll[i] : L.tiles[i] ? "solid content" : wet + " foot-blocking pixels"})`);
      else if (!after[i]) B(`its opening ${x},${y} can't be reached from the spawn`);
    }
    // the tiles the terrain closes (B3d3): solid land in the terrain (a cliff rim), never water or open ground
    for (const [x, y] of r.terrainTiles || []) {
      const i = at(x, y);
      if (m.coll[i] !== 1) B(`${x},${y} is listed as closed by the terrain, but the terrain there is ${m.coll[i] === 0 ? "open ground (build the wall there)" : "coll " + m.coll[i] + ", not solid land (a wall is closed by a cliff, never by water)"}`);
    }
    if (r.compound) {
      const c = (src.reserves.compounds || []).find((q) => q.id === r.compound), b = S.box, cb = c && c.compoundBox;
      const key = (l) => l.map((p) => p.join()).sort().join(" ");
      if (!b || !cb || b.x0 !== cb.x0 || b.y0 !== cb.y0 || b.x1 !== cb.x1 || b.y1 !== cb.y1) B(`it walls in ${r.compound}, so its ring is that compound's box ${cb ? `${cb.x0},${cb.y0} to ${cb.x1},${cb.y1}` : "(none)"}, not ${b ? `${b.x0},${b.y0} to ${b.x1},${b.y1}` : "a habitat's outline"}`);
      if (c && key(gaps) !== key(c.gateTiles || [])) B(`it walls in ${r.compound}, so its openings are exactly that compound's gates ${key(c.gateTiles || [])}, not ${key(gaps) || "none"}`);
    }
  }
  // fences (B3d1): art, one ring round a contained B1e habitat and nothing else, named for it, its openings, and enclosure
  for (const r of records) {
    if (r.kind !== "fence") continue;
    const B = (msg) => add("fences", `${r.id}: ${msg}`), S = r.shape || { solid: [], habitat: null, ownDrawn: 0 }, gaps = r.gapTiles || [];
    if (!r.art) B("a fence draws itself: it needs art (\"placeholder\" until the art stage)");
    const hab = S.habitat && (src.habitats || []).find((q) => q.id === S.habitat);
    if (S.solid.length !== 1 || S.solid[0] !== "ringOfHabitat") B(`a fence's solid is one ring round a B1e habitat (ringOfHabitat) and nothing else, not ${S.solid.join(", ") || "nothing"}`);
    else if (!hab || hab.containment !== "contained") B(`it fences ${S.habitat}, whose containment is ${hab ? JSON.stringify(hab.containment) : "unknown"}: only a contained habitat is fenced`);
    else if (r.id !== S.habitat) B(`it is the fence round the habitat ${S.habitat}, so it is named for it, not ${r.id}`);
    if (S.ownDrawn) B(`its art is drawn on its own tiles exactly (the compile adds them), so it has no drawn box of its own, not ${S.ownDrawn}`);
    if (r.doorTiles.length || r.reserve || r.footPxBoxes.length) B(`a fence has no ${r.doorTiles.length ? "door (its openings are gapTiles)" : r.reserve ? "reserve" : "foot box (it blocks whole tiles)"}`);
    // an opening sits in a straight run of the ring: its two neighbours along the line are opposite each other
    const line = new Set(r.tiles.concat(gaps).map(([x, y]) => at(x, y)));
    for (const [x, y] of gaps) {
      const i = at(x, y), nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => line.has(at(x + dx, y + dy)));
      let wet = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) wet += m.px.foot[py * PW + px] || L.foot[py * PW + px] ? 1 : 0;
      if (nb.length !== 2 || nb[0][0] !== -nb[1][0] || nb[0][1] !== -nb[1][1]) B(`its opening ${x},${y} is a corner: a corner joins two runs, and an opening there leads nowhere`);
      else if (!tWalk(i) || L.tiles[i] || wet) B(`its opening ${x},${y} isn't open ground (${!tWalk(i) ? "terrain coll " + m.coll[i] : L.tiles[i] ? "solid content" : wet + " foot-blocking pixels"})`);
      else if (!after[i]) B(`its opening ${x},${y} can't be reached from the spawn`);
    }
    if (!gaps.length && !r.encloses) B("it has no openings, so it closes its habitat in: it must say so (encloses: true)");
    if (gaps.length && r.encloses) B(`it has ${gaps.length} opening(s), so it doesn't close its habitat in (leave encloses out)`);
  }
  // only a wall is closed by the terrain (B3d3)
  for (const r of records) if (r.kind !== "wall" && r.terrainTiles) add("walls", `${r.id}: only a wall is closed by the terrain (terrainTiles), not a ${r.kind}`);
  // gates (B3d3): art, a B1e marker it is named for, its two posts 2 either side of it, one drawn box over them, its opening
  for (const r of records) {
    if (r.marker !== undefined && r.kind !== "gate") add("gates", `${r.id}: only a gate stands on a marker`);
    if (r.kind !== "gate") continue;
    const B = (msg) => add("gates", `${r.id}: ${msg}`), S = r.shape || { solid: [], ownDrawn: 0 };
    if (!r.art) B("a gate draws itself: it needs art (\"placeholder\" until the art stage)");
    const mk = r.marker && (src.reserves.markers || []).find((q) => q.id === r.marker);
    if (!mk) { B("a gate stands on a B1e marker (marker), and it names none"); continue; }
    if (r.id !== r.marker) B(`it is the gate on the marker ${r.marker}, so it is named for it, not ${r.id}`);
    const [mx, my] = mk.markerTile, posts = [[mx - 2, my], [mx + 2, my]];
    if (S.solid.length !== 1 || S.solid[0] !== "tiles") B(`a gate's solid is its two posts (tiles) and nothing else, not ${S.solid.join(", ") || "nothing"}`);
    const key = (l) => l.map((p) => p.join()).sort().join(" ");
    if (key(r.tiles) !== key(posts)) B(`its posts are the tiles 2 either side of its marker ${mx},${my} (format 1's rule), ${key(posts)}, not ${key(r.tiles) || "none"}`);
    if (r.footPxBoxes.length || r.doorTiles.length || r.reserve || r.encloses || r.gapTiles) B(`a gate has no ${r.footPxBoxes.length ? "foot box (its posts block whole tiles)" : r.doorTiles.length ? "door" : r.reserve ? "reserve" : r.encloses ? "enclosure" : "openings list (its opening is between its posts)"}`);
    const d = r.drawnPxBoxes;
    if (d.length !== 1 || d[0].px0 !== (mx - 2) * T || d[0].px1 !== (mx + 2) * T + T - 1 || d[0].py1 !== my * T + T - 1 || d[0].py0 > my * T) B(`its art is one box from its west post's west edge to its east post's east edge, standing on their bottom edge (px ${(mx - 2) * T} to ${(mx + 2) * T + T - 1}, bottom ${my * T + T - 1}; it may rise above), not ${JSON.stringify(d)}`);
    const open = (x, y) => { const i = at(x, y); let wet = 0; for (let py = y * T; py < y * T + T; py++) for (let px = x * T; px < x * T + T; px++) wet += m.px.foot[py * PW + px] || L.foot[py * PW + px] ? 1 : 0; return !tWalk(i) ? "terrain coll " + m.coll[i] : L.tiles[i] ? "solid content" : wet ? wet + " foot-blocking pixels" : !after[i] ? "not reached from the spawn" : null; };
    for (const [x, y] of [[mx - 1, my], [mx, my], [mx + 1, my]]) { const why = open(x, y); if (why) B(`its opening ${x},${y} isn't open ground (${why})`); }
    for (const [x, y] of [[mx, my - 1], [mx, my + 1]]) { const why = open(x, y); if (why) B(`the road through it is blocked at ${x},${y}, ${y < my ? "behind" : "in front of"} its opening (${why})`); }
  }
  // landmark bases (B3d4a): art, a B1e landmark footprint it is named for and fills, one drawn box over it, its approach
  for (const r of records) {
    if (r.kind !== "landmark") continue;
    const B = (msg) => add("landmarks", `${r.id}: ${msg}`), S = r.shape || { solid: [], ownDrawn: 0 };
    if (!r.art) B("a landmark base draws itself: it needs art (\"placeholder\" until the art stage)");
    const fp = r.reserve && (src.reserves.footprints || []).find((q) => q.id === r.reserve);
    if (!fp || fp.kind !== "landmark" || !fp.footprintBox) { B(`a landmark base stands on a B1e landmark footprint (reserve), and ${r.reserve ? r.reserve + " isn't one" : "it names none"}`); continue; }
    const b = fp.footprintBox, w = b.x1 - b.x0 + 1;
    if (r.id !== fp.id + "-base") B(`it is the base on the footprint ${fp.id}, so it is named ${fp.id}-base, not ${r.id}`);
    if (S.solid.length !== 1 || S.solid[0] !== "tileBoxes") B(`a landmark base's solid is its footprint (one tile box) and nothing else, not ${S.solid.join(", ") || "nothing"}`);
    const key = (l) => l.map((p) => p.join()).sort().join(" "), want = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) want.push([x, y]);
    if (key(r.tiles) !== key(want)) B(`its solid is its footprint ${b.x0},${b.y0} to ${b.x1},${b.y1} exactly, not ${r.tiles.length} other tiles`);
    if (r.footPxBoxes.length || r.doorTiles.length || r.gapTiles || r.encloses || r.room || r.compound || r.marker) B("a landmark base has no foot box, door, opening, enclosure, room, compound or marker");
    const d = r.drawnPxBoxes;
    if (d.length !== 1 || d[0].px0 !== b.x0 * T || d[0].px1 !== b.x1 * T + T - 1 || d[0].py1 !== b.y1 * T + T - 1 || d[0].py0 > b.y0 * T) B(`its art is one box as wide as its footprint, standing on its front edge (px ${b.x0 * T} to ${b.x1 * T + T - 1}, bottom ${b.y1 * T + T - 1}; it may rise above), not ${JSON.stringify(d)}`);
    const ax = Math.floor(b.x0 + w / 2), ay = b.y1 + 1, ai = at(ax, ay);
    let wet = 0; for (let py = ay * T; py < ay * T + T; py++) for (let px = ax * T; px < ax * T + T; px++) wet += m.px.foot[py * PW + px] || L.foot[py * PW + px] ? 1 : 0;
    if (!tWalk(ai) || L.tiles[ai] || wet || !after[ai]) B(`its approach ${ax},${ay} (the middle of its front) isn't open ground reached from the spawn`);
  }
  // stations (B3d4b): one of the game's outdoor stations, at its approved place, no collision, used from an open approach
  const stAnchor = new Map(), onLandmark = new Map();
  for (const r of records) {
    if (r.kind !== "station") continue;
    const B = (msg) => add("stations", `${r.id}: ${msg}`);
    if (!STATION_IDS.includes(r.id)) { B(`a station is one of the game's outdoor stations (${STATION_IDS.join(", ")}), and ${r.id} isn't`); continue; }
    if (r.tiles.length || r.footPxBoxes.length || r.doorTiles.length || r.drawnPxBoxes.length) B("a station adds no collision and draws nothing of its own");
    const [ax, ay] = r.anchor, [px, py] = r.approach, pk = Object.keys(r.place)[0], pv = r.place[pk], want = STATION_PLACES[r.id];
    if (JSON.stringify(r.place) !== JSON.stringify(want)) B(`its approved place is ${JSON.stringify(want)} (B3a's plan), not ${JSON.stringify(r.place)}`);
    if (stAnchor.has(at(ax, ay))) B(`its anchor ${ax},${ay} is ${stAnchor.get(at(ax, ay))}'s too: no two stations share an anchor`); else stAnchor.set(at(ax, ay), r.id);
    const inRes = (x, y) => RES.find((q) => inBox(x, y, q.b));
    // the place it is tied to, and what that fixes
    let south = true;
    if (pk === "landmark") {
      const lm = records.find((q) => q.id === pv && q.kind === "landmark");
      if (!lm || !lm.tiles.length) B(`it stands on the landmark base ${pv}, and there is no such landmark here`);
      else {
        const xs = lm.tiles.map((q) => q[0]), ys = lm.tiles.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys), mx = Math.floor(x0 + (x1 - x0 + 1) / 2);
        if (ax !== mx || ay !== y1) B(`on the landmark base ${pv} its anchor is the middle of the base's front row, ${mx},${y1}, not ${ax},${ay}`);
        if (px !== mx || py !== y1 + 1) B(`on the landmark base ${pv} it is used from the base's approach ${mx},${y1 + 1}, not ${px},${py}`);
        if (onLandmark.has(pv)) B(`the landmark base ${pv} already carries ${onLandmark.get(pv)}: one station a landmark`); else onLandmark.set(pv, r.id);
      }
    } else if (pk === "marker") {
      const mk = (src.reserves.markers || []).find((q) => q.id === pv);
      if (!mk || !mk.approachTile) B(`it stands on a B1e marker with an approach tile, and ${pv} ${mk ? "has no approach tile" : "isn't a marker"}`);
      else { if (mk.markerTile.join() !== r.anchor.join()) B(`on the marker ${pv} its anchor is the marker ${mk.markerTile}, not ${r.anchor}`); if (mk.approachTile.join() !== r.approach.join()) B(`on the marker ${pv} it is used from the marker's approach ${mk.approachTile}, not ${r.approach}`); }
    } else if (pk === "logSite") {
      const ls = ((src.planningMarkers && src.planningMarkers.logSites) || []).find((q) => q.id === pv);
      if (!ls) B(`it is tied to the log site ${pv}, and B1e has no such log site`);
      else if (Math.max(Math.abs(ls.siteTile[0] - px), Math.abs(ls.siteTile[1] - py)) > 1) B(`it is used at the log site ${pv} (${ls.siteTile}), so its approach is that tile or one beside it, not ${r.approach}`);
    } else if (pk === "plaza") {
      const pz = ((src.corridors && src.corridors.plazas) || []).find((q) => q.id === pv), box = pz && (pz.plazaBox || (pz.sameAs === "exits.south.arrivalPlazaBox" ? src.exits.south.arrivalPlazaBox : null));
      if (!box) B(`it stands in the plaza ${pv}, and B1e has no plaza box by that name`);
      else if (!inBox(ax, ay, box)) B(`it stands in the plaza ${pv} (${box.x0},${box.y0} to ${box.x1},${box.y1}), and its anchor ${r.anchor} is outside it`);
    } else if (pk === "berth") {
      const ex = src.exits && src.exits[pv];
      south = false;
      if (!ex || !ex.berthTile) B(`it lies at the ${pv} exit's berth, and B1e has no berth there`);
      else if (ex.berthTile.join() !== r.anchor.join()) B(`at the ${pv} exit's berth its anchor is the berth ${ex.berthTile}, not ${r.anchor}`);
    }
    // its anchor: on the base (a landmark's), at sea (the boat's), or open land outside every footprint (the rest)
    const ai = at(ax, ay);
    if (pk === "berth") { if (![0, 1].includes(m.ground[ai]) || tWalk(ai)) B(`the boat's anchor ${r.anchor} is at sea (deep or shallow water), not ${tWalk(ai) ? "land" : "ground " + m.ground[ai]}`); }
    else if (pk !== "landmark") {
      if (!tWalk(ai) || L.tiles[ai]) B(`its anchor ${r.anchor} isn't open land (${!tWalk(ai) ? "terrain coll " + m.coll[ai] : "solid content"})`);
      else if ([G_BRIDGE, G_DOCK, G_PAD].includes(m.ground[ai])) B(`its anchor ${r.anchor} is ${m.ground[ai] === G_BRIDGE ? "a bridge" : m.ground[ai] === G_DOCK ? "dock" : "the helipad"}: a free-standing station stands on open land`);
      const rs = inRes(ax, ay); if (rs) B(`its anchor ${r.anchor} is inside the reserve ${rs.id}: nothing stands in a reserved footprint`);
    }
    // its approach: a step from the anchor (south of it; the boat's north of it, on the pier), open ground, pi's feet clear,
    // reached from the spawn, within [E]'s reach
    if (px !== ax || py !== ay + (south ? 1 : -1)) B(`its approach is the tile ${south ? "south" : "north"} of its anchor, ${ax},${ay + (south ? 1 : -1)}, not ${r.approach}`);
    const pi2 = at(px, py), fx = px * T + 8, fy = py * T + 10;
    let wet = 0; for (let yy = fy - 2; yy <= fy + 1; yy++) for (let xx = fx - 4; xx <= fx + 4; xx++) wet += m.px.foot[yy * PW + xx] || L.foot[yy * PW + xx] ? 1 : 0;
    if (!tWalk(pi2) || L.tiles[pi2] || wet) B(`its approach ${r.approach} isn't open ground (${!tWalk(pi2) ? "terrain coll " + m.coll[pi2] : L.tiles[pi2] ? "solid content" : wet + " foot-blocking pixels under pi's feet"})`);
    else if (!after[pi2]) B(`its approach ${r.approach} can't be reached from the spawn`);
    const rp = inRes(px, py); if (rp) B(`its approach ${r.approach} is inside the reserve ${rp.id}`);
    const reach = Math.hypot(ax * T + 8 - fx, ay * T + 12 - fy);
    if (reach >= STATION_REACH) B(`from its approach pi's feet are ${reach.toFixed(1)} px from the station, out of [E]'s reach (${STATION_REACH})`);
  }
  for (const r of records) if (r.kind !== "station" && STATION_IDS.includes(r.id)) add("stations", `${r.id}: the id is a station's, and this is a ${r.kind}`);
  // roam areas (B3e1): one of format 1's, at its approved box with its habitat and spawns (B3a's plan), in format 1's order; each spawn
  // inside the box on a tile its creature may stand on, feet clear; at least one more tile there to walk to
  let lastRoam = -1;
  for (const r of records) {
    if (r.kind !== "roam") { if (/^roam-/.test(r.id)) add("creatures", `${r.id}: the id is a roam area's, and this is a ${r.kind}`); continue; }
    const B = (msg) => add("creatures", `${r.id}: ${msg}`), plan = ROAM_PLAN[r.id];
    if (!plan) { B(`a roam area is one of format 1's (roam-00 to roam-27), and ${r.id} isn't`); continue; }
    const n = +r.id.slice(5); if (n <= lastRoam) B(`roam areas come in format 1's order (it comes after roam-${String(lastRoam).padStart(2, "0")})`); lastRoam = Math.max(lastRoam, n);
    const pb = plan.box;
    if (r.box.join() !== [pb.x0, pb.y0, pb.x1, pb.y1].join()) B(`its approved box is ${pb.x0},${pb.y0} to ${pb.x1},${pb.y1} (B3a's plan), not ${r.box.join(",")}`);
    if ((r.habitat || null) !== plan.habitat) B(`its approved habitat is ${plan.habitat || "none"}, not ${r.habitat || "none"}`);
    if (JSON.stringify(r.spawns) !== JSON.stringify(plan.spawns)) B(`its approved spawns are ${plan.spawns.map((q) => q.creature + " " + q.at).join("; ")} (format 1's kinds and order, B3a's tiles), not ${r.spawns.map((q) => q.creature + " " + q.at).join("; ")}`);
    const [x0, y0, x1, y1] = r.box, may = (k, x, y) => { const i = at(x, y); return tWalk(i) && !L.tiles[i] && creatureMayStand(k, m.ground[i]); };
    for (const s of r.spawns) {
      const [x, y] = s.at, fx = x * T + 8, fy = y * T + 10;
      let wet = 0; for (let yy = fy - 2; yy <= fy + 1; yy++) for (let xx = fx - 4; xx <= fx + 4; xx++) wet += m.px.foot[yy * PW + xx] || L.foot[yy * PW + xx] ? 1 : 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) B(`its ${s.creature} starts at ${s.at}, outside its box`);
      else if (!may(s.creature, x, y)) B(`its ${s.creature} starts at ${s.at}, a tile it may not stand on (${!tWalk(at(x, y)) ? "terrain coll " + m.coll[at(x, y)] : L.tiles[at(x, y)] ? "solid content" : "ground " + m.ground[at(x, y)]})`);
      else if (wet) B(`its ${s.creature} starts at ${s.at} with ${wet} foot-blocking pixels under its feet`);
    }
    let room = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (may(r.spawns[0].creature, x, y)) room++;
    if (room < 2) B(`its box holds ${room} tile(s) its ${r.spawns[0].creature} may walk to: nowhere to roam`);
  }
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
    if (r.gapTiles) o.gapTiles = r.gapTiles;
    if (r.terrainTiles) o.terrainTiles = r.terrainTiles;
    if (r.reserve) o.reserve = r.reserve;
    if (r.encloses) o.encloses = true;
    if (r.art) o.art = r.art;
    if (r.room) o.room = r.room;
    if (r.compound) o.compound = r.compound;
    if (r.marker) o.marker = r.marker;
    if (r.kind === "station") { o.anchor = r.anchor; o.approach = r.approach; o.place = r.place; }
    if (r.kind === "roam") { o.box = r.box; if (r.habitat) o.habitat = r.habitat; o.spawns = r.spawns; }
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
    `   where feet stop on tiles that stay walkable; doorTiles; gapTiles, a ring's openings; terrainTiles, where the terrain`,
    `   closes a wall's ring; encloses, a ring that closes ground in; a building's, a wall's, a fence's or a gate's art; a`,
    `   building's room; a wall's compound; a gate's marker; a station's anchor, approach and place (it blocks nothing); a`,
    `   roam area's box, habitat and spawns (format 1's creatures, B3e1; it blocks nothing).`,
    `   solidTiles and footPixels: the totals, which the game checks.`,
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
