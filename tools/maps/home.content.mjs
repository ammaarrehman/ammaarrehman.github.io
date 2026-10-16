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
     wall, stay clear). */

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
    }
  ]
};
