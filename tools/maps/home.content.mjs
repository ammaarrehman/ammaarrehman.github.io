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
   Both art boxes are the footprint exactly (no roof rising above it yet: the art stage decides that). */

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
    }
  ]
};
