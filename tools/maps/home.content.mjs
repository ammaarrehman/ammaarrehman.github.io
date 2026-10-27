/* MAP-B: the authored content of the home island ("Harbour Crescent"): buildings, landmarks, stations, walls, fences,
   gates and props, placed on the locked terrain in tools/maps/home.src.mjs. Edit it, then run
   `node tools/map-content.mjs` (it writes tools/maps/staged/home.content.js).

   STAGED. Only the local content preview reads the compiled file (tools/mapb-preview.mjs --content, loopback only).
   The schema, the rules and the reasons for a separate content layer are in tools/maps/content.mjs.

   B3b (the architecture) added the format and no content. B3c onward adds records, one approved batch at a time; the
   proposed coordinates are in the B3a plan (tools/out/mapb/b3a/B3a-plan.md, local).

   B3c1: the first two buildings, each on its approved B1e footprint (the whole footprint solid, D1 as modified: the
   placeholder art covers all of it, so no collision is invisible), with its door on the tile in the middle of its
   front (the B3a doorstep, floor(x0 + w / 2), y1 + 1) and the format-1 room behind it.
   - The visitor centre: footprint visitor-centre, 80,69 to 88,73 (9 x 5). Door 84,74, on the plaza's paving; the B1d
     door stub (visitor-centre-door, 85,74 to 85,75) is the tile beside it, paved too.
   - The supply depot: footprint ranger-hq-depot, 101,73 to 107,76 (7 x 4). Door 104,77, on grass; the depot spur
     (x 104 and 105 from row 78 south to the service road) starts right below it.
   Both art boxes are the footprint exactly (no roof rising above it yet: the art stage decides that).

   B3c2: the outpost bunker, the same way, on its approved B1e footprint inside the bunker compound.
   - The bunker: footprint bunker, 113,79 to 119,82 (7 x 4). Door 116,83, on grass: the B3a doorstep and the B1e log
     site rack-desk-bunker. Room bunker (format 1's: the rack, the desk, the radio and the rest).
   - The compound round it (bunker-compound, 109,76 to 124,89, gates 109,84 to 109,86) was planning metadata only in
     B3c2. From the gates the door is 7 tiles east and 2 north over open grass inside it.

   B3c3: the compound's wall, on the B1e compound's box exactly, with its three gates as the west entrance.
   - The wall: bunker-compound, the ring round 109,76 to 124,89 (16 x 14) less the gates 109,84, 109,85 and 109,86: 53
     solid tiles, each drawn (placeholder art, one opaque tile of wall on every solid tile and nowhere else). The rule
     checks it is the B1e compound's own box and gates.
   - The west entrance is the three gates, open as format 1's compound gate is (a gap in the wall, nothing that opens,
     closes or locks): 109,84 and 109,85 are the ops road's paving, 109,86 is grass. The posts either side of it stand
     on the wall's own tiles 109,83 and 109,87.
   - Nothing else of the compound yet: no outpost kit, no uplink, no lamps (B3a's proposed places for them, inside the
     wall, stay clear).

   B3d1: the first paddock fence, the raptor yard's (format 1's raptor pen), on the B1e habitat raptor-yard exactly.
   - The fence: raptor-yard, the ring of the habitat's box 119,10 to 127,17 (9 x 8): 30 solid tiles, each drawn
     (placeholder art, one opaque tile of fence on every solid tile and nowhere else). The rule checks it is a contained
     B1e habitat's own ring, named for it.
   - No openings: format 1's raptor pen is a closed ring with no gate, and B1e gives the yard none. Its inside (120,11
     to 126,16, 42 tiles) is closed in on purpose (encloses), so it is not safe ground: no landing, no saved position.
   - Nothing else of the yard yet: no raptors, roam area, welder patrol, fence words or roof netting (later batches).

   B3d2: the second paddock fence, the T. rex holding paddock's (format 1's t-rex paddock; temporary, until Ironwood), on the
   B1e habitat holding-paddock exactly, with the same fence.
   - The fence: holding-paddock, the ring of the habitat's outline (its tiles with any of the 8 neighbours outside it), the
     box 106,10 to 117,17: 36 solid tiles, each drawn. The outline is the approved smooth one, so the ring steps round it.
   - No openings: format 1's t-rex paddock is a closed ring with no gate, and B1e gives the paddock none. Its inside (35
     tiles, 108,11 to 116,16 at most, B3a's T. rex roam box) is closed in on purpose (encloses).
   - Between the two paddocks, column 118 stays open: one tile wide at rows 12 to 15, the paddock's east fence (x 117) on
     one side and the raptor yard's west fence (x 119) on the other.
   - Nothing else of the paddock yet: no T. rex, roam area, roar zone, fence words or bones (later batches). B1e's
     planning label "double fence, high security" isn't built: one ring, as B3a plans and format 1 has.

   B3d3: the koi garden's wall and the park gate.
   - The koi garden's wall: koi-garden, the ring round the B1e compound koi-garden's box 103,54 to 119,70 (17 x 17) less
     its seven gates, as the r2.1 study's "garden wall": three openings, north 110,54 to 112,54 (the koi-north-gate trail,
     from the koi-headland road), west 103,61 to 103,62 (the koi-west-gate trail) and east 119,63 to 119,64 (out to the koi
     bay overlook, 120,63). On the east side, 119,56 to 119,59 are the terrace's cliff rim over the koi bay's beach, solid
     terrain: the cliff closes the ring there and no wall is built on it (terrainTiles). 53 solid tiles, each drawn (B3a's
     count: the edge's 64 tiles less the 7 gates and the 4 rim tiles). The south wall (row 70) stands on the cliff top over
     the lowland; the koi pond, the garden loop, the koi pavilion's reserve (113,66 to 116,68, unused) and the route end
     koi-garden (108,68) are inside it, reached through any of the openings. Placeholder art in a garden wall's look (not
     the outpost's sandbags). No koi, cats, pavilion, Moss or feeding here (later batches).
   - The park gate: park-gate, on the B1e marker park-gate (74,38, the study's gate anchor), at the foot of the park-gate
     ramp where the main walk climbs to the highland. Its posts are format 1's rule, the tiles 2 either side of it, 72,38
     and 76,38 (B3a's), solid; its opening is the main walk's three paved tiles between them, 73,38 to 75,38. The arch's
     art is the box from 72,38's west edge to 76,38's east edge, 60 px tall (format 1's sprite's height). As in format 1 it
     is decorative: nothing opens, closes or locks, and the ground either side of it stays open. Format 1's lamp beside it
     (B3a's 78,38) is a later batch's.

   B3d4a: the two landmark bases, the tower's and the lighthouse's, each on its approved B1e landmark footprint (the whole
   footprint solid, as the buildings', D1), named for it (the format-2 completeness list's ids, tower-base and
   lighthouse-base). Placeholder art in format 1's look, as wide as the footprint and standing on its front edge, rising
   above it (format 1's sprites are 24 x 40 and 20 x 50 px on one tile; here the same proportions on the approved bases).
   - The tower base: footprint tower, 94,25 to 96,27 (3 x 3), on the open highland north of the tower trail; approached
     from 95,28 (the middle of its front, on the trail: B3a's stand for the tower's station and B1e's log site). Art 48 x 80.
   - The lighthouse base: footprint lighthouse, 139,42 to 140,43 (2 x 2), on the headland plateau near its tip; approached
     from 140,44 (the middle of its front, B3a's stand), a step above the koi-headland road's end and the route end
     lighthouse-headland (140,45). Art 32 x 96.
   - Structure only: no station (the log, the tour stop, the deep links, the map pins, the tower's live trace and the
     lighthouse's turning beam are format 1's station, a later batch's). */
/* B3d4b: format 1's eleven outdoor stations, each at its B3a place (verified against the compiled staged terrain), tied to
   the approved source it belongs to (place), as interaction points only: no station adds collision or draws anything of
   its own here (the game draws the free-standing ones with format 1's sprites; the tower's and the lighthouse's are drawn
   by their bases). Each is used from its approach, the tile south of it (the boat's, at sea, the pier's end north of it),
   within [E]'s 26 px; the game's words, logs, tour, links and secrets for each are format 1's, unchanged.
   - sign 74,76 (from 74,77): the arrival plaza, 5 tiles from the spawn.
   - uplink 121,81 (from 121,82, B1e's log site): inside the bunker compound, east of the bunker.
   - tower 95,27 (from 95,28, the base's approach and B1e's log site): on the tower base, the middle of its front row.
   - lighthouse 140,43 (from 140,44, the base's approach; B1e's log site is 140,45, the route end below it): on the
     lighthouse base, the middle of its front row.
   - macbook 105,57 (from 105,58, on the koi garden's loop; B1e's log site 106,58 is the tile beside it): inside the koi
     garden's wall.
   - tablet 82,48 (from 82,49, B1e's log site): north-east of the commons.
   - mailbox 50,81 (from 50,82, B1e's log site): beside the post office's reserve (44,77 to 48,80, unused), outside it.
   - drink 53,87 (from 53,88): the village square.
   - shrine 14,19 (from 14,20): the B1e marker and its approach (D3: a 1 x 1 station, as format 1's).
   - cave 66,24 (from 66,25): the B1e cave-mouth marker and its approach.
   - boat 79,97 (from 79,96, the ferry pier's end): the south harbour's berth (D5), at sea like format 1's. */
const station = (id, anchor, approach, place) => ({ id, kind: "station", anchor, approach, place });
/* B3e1: the first creatures, format 1's pair of pachycephalosaurs, each in its own roam area as in format 1 (roam-09 and roam-10,
   one box: two areas, two objects), at B3a's approved place on the pachy heath (36,15 to 45,22; 99% inside the B1e habitat
   pachy-heath, all of it open grass but 11 tiles), starting at 38,18 and 42,19. Roam areas add no collision and draw nothing;
   the creatures are the game's, unchanged. The other 26 roam areas and their 31 creatures are later batches' (B3a's plan, in
   tools/maps/content.mjs ROAM_PLAN) */
/* B3e2: format 1's four gallimimus and five compsognathus, each in its own roam area as in format 1 (roam-11 to roam-14 and roam-15 to
   roam-19: one box each, separate objects), at B3a's approved places: the galli meadow (85,41 to 95,48, all of it open grass, inside
   the B1e habitat galli-meadow), starting at 87,43, 90,42, 93,45 and 86,47; the village gardens (27,91 to 33,96, all open grass,
   inside village-gardens), starting at 29,92, 30,93, 28,94, 31,92 and 27,93. Both bolt from pi as in format 1 */
/* B3e3: format 1's herd and its dilophosaur, at B3a's approved places. The herd is one roam area (roam-04) its four share, as in format 1
   (a stegosaur, two triceratops and an ankylosaur: one area, one object, so they drift together), on the riverlands range (41,43 to
   57,60, all open grass but 46 path tiles, inside the B1e habitat riverlands-range), starting at 44,46, 50,47, 54,55 and 45,58. The
   dilophosaur's roam-08 is the dilo strip (89,14 to 95,21, all open grass, 96% inside dilo-strip), starting at 91,17. Roam areas come
   in format 1's order, so these two sit before roam-09; every earlier record is as it was. Then format 1's two brachiosaurs, each in
   its own roam area as in format 1 (roam-00 and roam-01: one box, two objects), on the brachio meadow (12,33 to 27,50, all of it
   open grass but 44 path tiles, inside the B1e habitat brachio-meadow), starting at 16,38 and 22,46; first of all the roam areas.
   Their footfalls shake the camera as in format 1; the game now settles the shake when the volcano's update doesn't run */
/* B3e4: format 1's two parasaurolophus, each in its own roam area as in format 1 (roam-05 and roam-06: one box, two objects), at B3a's
   approved place in the delta wetland (14,71 to 22,80: 43 open grass tiles among the lagoon, the river, its banks and the path; 82% of
   the box inside the B1e habitat delta-wetland), starting at 20,73 and 16,77. Format 1's wander walks straight; about 3% of those walks
   stop at the river bank's foot pixels (20,79), and the animal picks a new target half a second later, as in format 1. In format 1's
   order they sit after roam-04 */
const roam = (id, [x0, y0, x1, y1], habitat, spawns) => ({ id, kind: "roam", box: { x0, y0, x1, y1 }, habitat, spawns: spawns.map(([creature, x, y]) => ({ creature, at: [x, y] })) });

const T = 16;
// a footprint's tile box as the pixel box its art covers
const footprintPx = (x0, y0, x1, y1) => ({ px0: x0 * T, py0: y0 * T, px1: x1 * T + T - 1, py1: y1 * T + T - 1 });

export default {
  schema: "mapb-content-1",
  id: "home",
  records: [
    {
      id: "visitor", kind: "building", reserve: "visitor-centre", art: "placeholder", room: "visitor",
      drawnPxBoxes: [footprintPx(80, 69, 88, 73)],
      solid: { tileBoxes: [{ x0: 80, y0: 69, x1: 88, y1: 73 }] },
      doorTiles: [[84, 74]]
    },
    {
      id: "depot", kind: "building", reserve: "ranger-hq-depot", art: "placeholder", room: "depot",
      drawnPxBoxes: [footprintPx(101, 73, 107, 76)],
      solid: { tileBoxes: [{ x0: 101, y0: 73, x1: 107, y1: 76 }] },
      doorTiles: [[104, 77]]
    },
    {
      id: "bunker", kind: "building", reserve: "bunker", art: "placeholder", room: "bunker",
      drawnPxBoxes: [footprintPx(113, 79, 119, 82)],
      solid: { tileBoxes: [{ x0: 113, y0: 79, x1: 119, y1: 82 }] },
      doorTiles: [[116, 83]]
    },
    {
      id: "bunker-compound", kind: "wall", compound: "bunker-compound", art: "placeholder",
      solid: { ringOfBox: { x0: 109, y0: 76, x1: 124, y1: 89, gapTiles: [[109, 84], [109, 85], [109, 86]] } }
    },
    {
      id: "raptor-yard", kind: "fence", art: "placeholder", encloses: true,
      solid: { ringOfHabitat: { habitat: "raptor-yard" } }
    },
    {
      id: "holding-paddock", kind: "fence", art: "placeholder", encloses: true,
      solid: { ringOfHabitat: { habitat: "holding-paddock" } }
    },
    {
      id: "koi-garden", kind: "wall", compound: "koi-garden", art: "placeholder",
      solid: { ringOfBox: { x0: 103, y0: 54, x1: 119, y1: 70,
        gapTiles: [[110, 54], [111, 54], [112, 54], [103, 61], [103, 62], [119, 63], [119, 64]],
        terrainTiles: [[119, 56], [119, 57], [119, 58], [119, 59]] } }
    },
    {
      id: "park-gate", kind: "gate", marker: "park-gate", art: "placeholder",
      drawnPxBoxes: [{ px0: 72 * T, py0: 38 * T + T - 60, px1: 76 * T + T - 1, py1: 38 * T + T - 1 }],
      solid: { tiles: [[72, 38], [76, 38]] }
    },
    {
      id: "tower-base", kind: "landmark", reserve: "tower", art: "placeholder",
      drawnPxBoxes: [{ px0: 94 * T, py0: 27 * T + T - 80, px1: 96 * T + T - 1, py1: 27 * T + T - 1 }],
      solid: { tileBoxes: [{ x0: 94, y0: 25, x1: 96, y1: 27 }] }
    },
    {
      id: "lighthouse-base", kind: "landmark", reserve: "lighthouse", art: "placeholder",
      drawnPxBoxes: [{ px0: 139 * T, py0: 43 * T + T - 96, px1: 140 * T + T - 1, py1: 43 * T + T - 1 }],
      solid: { tileBoxes: [{ x0: 139, y0: 42, x1: 140, y1: 43 }] }
    },
    station("sign", [74, 76], [74, 77], { plaza: "arrival-plaza" }),
    station("uplink", [121, 81], [121, 82], { logSite: "uplink" }),
    station("tower", [95, 27], [95, 28], { landmark: "tower-base" }),
    station("lighthouse", [140, 43], [140, 44], { landmark: "lighthouse-base" }),
    station("macbook", [105, 57], [105, 58], { logSite: "macbook" }),
    station("tablet", [82, 48], [82, 49], { logSite: "tablet" }),
    station("mailbox", [50, 81], [50, 82], { logSite: "mailbox" }),
    station("drink", [53, 87], [53, 88], { plaza: "village-square" }),
    station("shrine", [14, 19], [14, 20], { marker: "shrine" }),
    station("cave", [66, 24], [66, 25], { marker: "cave-mouth" }),
    station("boat", [79, 97], [79, 96], { berth: "south" }),
    roam("roam-00", [12, 33, 27, 50], "brachio-meadow", [["brachio", 16, 38]]),
    roam("roam-01", [12, 33, 27, 50], "brachio-meadow", [["brachio", 22, 46]]),
    roam("roam-04", [41, 43, 57, 60], "riverlands-range", [["stego", 44, 46], ["trike", 50, 47], ["trike", 54, 55], ["ankylo", 45, 58]]),
    roam("roam-05", [14, 71, 22, 80], "delta-wetland", [["para", 20, 73]]),
    roam("roam-06", [14, 71, 22, 80], "delta-wetland", [["para", 16, 77]]),
    roam("roam-08", [89, 14, 95, 21], "dilo-strip", [["dilo", 91, 17]]),
    roam("roam-09", [36, 15, 45, 22], "pachy-heath", [["pachy", 38, 18]]),
    roam("roam-10", [36, 15, 45, 22], "pachy-heath", [["pachy", 42, 19]]),
    roam("roam-11", [85, 41, 95, 48], "galli-meadow", [["galli", 87, 43]]),
    roam("roam-12", [85, 41, 95, 48], "galli-meadow", [["galli", 90, 42]]),
    roam("roam-13", [85, 41, 95, 48], "galli-meadow", [["galli", 93, 45]]),
    roam("roam-14", [85, 41, 95, 48], "galli-meadow", [["galli", 86, 47]]),
    roam("roam-15", [27, 91, 33, 96], "village-gardens", [["compy", 29, 92]]),
    roam("roam-16", [27, 91, 33, 96], "village-gardens", [["compy", 30, 93]]),
    roam("roam-17", [27, 91, 33, 96], "village-gardens", [["compy", 28, 94]]),
    roam("roam-18", [27, 91, 33, 96], "village-gardens", [["compy", 31, 92]]),
    roam("roam-19", [27, 91, 33, 96], "village-gardens", [["compy", 27, 93]])
  ]
};
