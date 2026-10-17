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
     (B3a's 78,38) is a later batch's. */

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
    }
  ]
};
