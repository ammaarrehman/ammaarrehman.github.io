/* MAP-B: the authored source of the home island, "Harbour Crescent" (MAP-B r2.1, approved by Ammaar
   2026-10-03). This file is the source of truth for the redesigned island's geography. Edit it, then run
   `node tools/map-compile.mjs` (it writes tools/maps/staged/home.js) and `node tools/map-lint.mjs`.

   STAGED. Nothing in the game reads this file or its output yet. Production still runs the original
   100 x 80 island from js/maps/home.js; the game learns the new map format in B2, and the switch-over is
   a separate, approved release later. It holds the canvas, the coast and the sea (B1a, locked), the four
   levels, the beach and the eight ramps (B1b, locked), the river, the ponds and the volcano's terrain
   (B1c, locked), the corridors, bridges, plazas, docks and helipad (B1d, locked), the planning metadata:
   districts, reserves, habitats and planning markers (B1e; no tile comes from them), and metadata for the
   three future exits and the open sea the satellites need. Buildings, walls, fences, props, creatures and
   everything else are B3's; this file must not hold them (the compiler refuses unknown sections).

   Coordinates (one convention for the whole file; tools/map-lint.mjs enforces it):
   - Tile space. Tile (tx, ty) is the square [tx, tx + 1) x [ty, ty + 1); its centre is (tx + 0.5, ty + 0.5).
     The map is w x h = 150 x 120 tiles, so tiles are x 0 to 149 and y 0 to 119.
   - Control points (coast.points) are positions, not tiles: { id, x, y } with x in [0, 150] and y in
     [0, 120], decimals allowed. A tile is land when its centre is inside the closed coast curve. Elevation
     outline points are positions too, and may lie up to 10 tiles off the map (see elevation).
   - Point ids are unique across the whole file, so any point can be named on its own.
   - A field named ...Tile is one tile: [x, y], whole numbers, x 0 to 149, y 0 to 119.
   - A field named ...Tiles is a list of tiles.
   - A field named ...Box is an INCLUSIVE tile box: { x0, y0, x1, y1 }, whole numbers, both corners
     inside it, 0 <= x0 <= x1 <= 149 and 0 <= y0 <= y1 <= 119, so it is x1 - x0 + 1 tiles wide. A box
     reaching the east edge ends at x1 = 149, never 150. This is the only rectangle form: no half-open
     rectangles, no [x0, y0, x1, y1] arrays, no w/h, and no fields named rect, bounds, span or area.
   - Ids are lowercase words joined by hyphens.

   To reshape the coast, move named points ("move ash-cove-inner 2 tiles west" is x 99 to 97), add or
   remove points, or flip corner. map-lint then reports how far the land has drifted from the frozen r2.1
   mask (tools/fixtures/mapb-r21.json, never rewritten) and from the last accepted build
   (tools/fixtures/mapb-staged.json, updated only with `map-lint --accept --reason="..."`). */

export default {
  schema: "mapb-source-1",
  id: "home",
  w: 150,
  h: 120,
  tile: 16,

  /* the coast: a closed Hermite spline through these points, in order, clockwise round the island from
     the north-west cape. corner: true keeps a cape, point or cove corner sharp (tangent 0); every other
     point is smooth (tangent 1). 8 samples per segment */
  coast: {
    samplesPerSegment: 8,
    points: [
      // the north-west cape: the shrine knoll and the Ashpine rope-bridge landing
      { id: "nw-cape-tip", x: 7, y: 21, corner: true },
      { id: "nw-cape-knuckle", x: 10.5, y: 16, corner: true },
      { id: "nw-cape-north-shore", x: 15, y: 13.5 },
      { id: "nw-cape-north-point", x: 19.5, y: 12, corner: true },
      // the north-west bay, behind the cape
      { id: "nw-bay-west-shore", x: 25, y: 15 },
      { id: "nw-bay-inner", x: 30, y: 20, corner: true },
      { id: "nw-bay-east-point", x: 34, y: 14.5, corner: true },
      // the highland's north coast, west of the volcano
      { id: "highland-north-shore", x: 40, y: 12 },
      { id: "highland-north-notch", x: 44, y: 13, corner: true },
      { id: "highland-north-reach", x: 50, y: 9.5 },
      // the volcano's uneven north face
      { id: "volcano-west-shoulder", x: 56, y: 6, corner: true },
      { id: "volcano-north-west-shore", x: 60, y: 6.8 },
      { id: "volcano-north-notch-west", x: 63.5, y: 8.2, corner: true },
      { id: "volcano-north-cape", x: 70, y: 5, corner: true },
      { id: "volcano-north-shore", x: 74, y: 6 },
      { id: "volcano-north-notch-east", x: 77.5, y: 7.8, corner: true },
      { id: "volcano-north-east-point", x: 85, y: 5.5, corner: true },
      { id: "volcano-east-shore", x: 88.5, y: 7 },
      { id: "volcano-east-corner", x: 91, y: 9.5, corner: true },
      // the ash cove, between the volcano and the research shoulder
      { id: "ash-cove-west-shore", x: 94, y: 11.5 },
      { id: "ash-cove-inner", x: 99, y: 16, corner: true },
      { id: "ash-cove-east-shore", x: 105, y: 12.5 },
      // the research shoulder (north-east)
      { id: "research-shoulder-west-corner", x: 110, y: 8.5, corner: true },
      { id: "research-shoulder-north-point", x: 119, y: 5.5, corner: true },
      { id: "research-shoulder-north-shore", x: 126, y: 7 },
      { id: "research-shoulder-north-east-corner", x: 129.5, y: 9.5, corner: true },
      { id: "research-shoulder-east-shore", x: 131, y: 14 },
      { id: "research-shoulder-south-east-corner", x: 131.5, y: 19, corner: true },
      // the lantern cove, north of the headland
      { id: "lantern-cove-north-shore", x: 129.5, y: 23 },
      { id: "lantern-cove-inner", x: 124, y: 28, corner: true },
      { id: "lantern-cove-south-shore", x: 126, y: 34 },
      // the lighthouse headland
      { id: "headland-north-shore", x: 133, y: 38 },
      { id: "headland-north-shore-outer", x: 139, y: 40.5 },
      { id: "lighthouse-headland-tip", x: 144, y: 43, corner: true },
      { id: "headland-south-shore-outer", x: 142.5, y: 47.5 },
      { id: "headland-south-shore", x: 136, y: 48.5 },
      { id: "headland-south-shore-inner", x: 130, y: 50 },
      // the koi bay, south of the headland
      { id: "koi-bay-north-shore", x: 124, y: 53 },
      { id: "koi-bay-inner", x: 121, y: 58, corner: true },
      { id: "koi-bay-south-shore", x: 124, y: 64 },
      // the east coast and the ops arm
      { id: "east-shore", x: 130, y: 67 },
      { id: "east-point", x: 134, y: 72, corner: true },
      { id: "ops-east-shore-north", x: 131, y: 80 },
      { id: "ops-east-shore", x: 126, y: 88 },
      { id: "ops-east-shore-south", x: 121, y: 94 },
      { id: "ops-arm-south-east-corner", x: 115, y: 99, corner: true },
      { id: "ops-arm-south-shore", x: 109, y: 99.5 },
      { id: "ops-arm-south-shore-west", x: 101, y: 103 },
      { id: "ops-arm-tip", x: 96, y: 108, corner: true },
      // the crescent harbour, between the ops arm and the village arm
      { id: "harbour-east-shore-outer", x: 98, y: 100 },
      { id: "harbour-east-shore", x: 96, y: 92 },
      { id: "harbour-head-east", x: 90, y: 86.5 },
      { id: "harbour-head-east-centre", x: 82, y: 84 },
      { id: "harbour-head-west-centre", x: 74, y: 84 },
      { id: "harbour-head-west", x: 67, y: 86.5 },
      { id: "harbour-west-shore", x: 62, y: 92 },
      { id: "harbour-west-shore-outer", x: 61, y: 100 },
      { id: "village-arm-tip", x: 64, y: 108, corner: true },
      // the village's south coast
      { id: "village-south-shore-east", x: 57, y: 106 },
      { id: "village-south-shore", x: 49, y: 104 },
      { id: "village-south-shore-west", x: 41, y: 101 },
      { id: "village-south-west-shore", x: 33, y: 100 },
      { id: "village-south-west-point", x: 27, y: 103.5, corner: true },
      // the south-west delta fan: two mouths with a lobe between them
      { id: "delta-south-shore", x: 21, y: 100 },
      { id: "delta-second-mouth-south", x: 17, y: 97 },
      { id: "delta-second-mouth", x: 15.5, y: 95, corner: true },
      { id: "delta-lobe-south", x: 12, y: 93.5 },
      { id: "delta-lobe", x: 9.5, y: 90 },
      { id: "delta-main-mouth", x: 12, y: 86.5, corner: true },
      { id: "delta-north-shore", x: 10, y: 80 },
      // the west service cove (the future restricted jetty)
      { id: "west-cove-south-shore", x: 12, y: 73 },
      { id: "west-cove-south-inner", x: 18, y: 69.5 },
      { id: "west-cove-inner", x: 24, y: 64, corner: true },
      { id: "west-cove-north-shore", x: 16, y: 61.5 },
      // the west coast (the brachio meadow's shore) back to the cape
      { id: "west-coast-south", x: 9, y: 58 },
      { id: "west-coast-westmost", x: 6.5, y: 50 },
      { id: "west-coast-middle", x: 7, y: 42 },
      { id: "west-coast-north", x: 8, y: 34 },
      { id: "nw-cape-west-shore", x: 6, y: 29.5 },
      { id: "nw-cape-re-entrant", x: 8.2, y: 25.5, corner: true }
    ]
  },

  /* the sea: shallow within this many steps (diagonals count as one) of land, deep beyond */
  sea: { shallowWithin: 3 },

  /* elevation (B1b): four levels, 0 to 3. Every land tile starts at level 0; each region below lifts the
     land tiles whose centre is inside it to its level, and where regions overlap the highest wins. Then
     the beach rule drops the coastal band back to level 0. Level changes happen only inside a ramp: any
     other place where walkable ground would meet ground a level lower, the higher tile is a cliff rim and
     solid. A region marked solid is blocked ground.
     - level 0, the lowland: the harbour, the village, ops, the delta, and every beach;
     - level 1, the meadow terrace: the commons, the riverlands, the koi garden;
     - level 2, the highland and the headland plateau: research, the cave approach, the lighthouse;
     - level 3: the volcano mass (solid, kept for Cinder Reach) and the shrine knoll (walkable, by its stairs).
     Outline points are positions like the coast's, but may lie up to 10 tiles off the map (x -10 to 160,
     y -10 to 130), so a terrace can run off the edge; only map tiles are filled. An outline is a closed
     Hermite spline like the coast, all smooth unless a point says corner: true. An ellipse is filled as
     a polygon of `sides` corners. Ramp boxes are inclusive tile boxes, like every ...Box in this file */
  elevation: {
    regions: [
      { id: "meadow-terrace", level: 1, outline: { samplesPerSegment: 8, points: [
        // the terrace runs off the map to the north, east and west; its south edge, east to west, is the
        // cliff above the lowland (the harbour, the village, ops and the delta)
        { id: "meadow-off-map-north-west", x: -5, y: -5 },
        { id: "meadow-off-map-north-east", x: 155, y: -5 },
        { id: "meadow-off-map-east", x: 155, y: 72 },
        { id: "meadow-edge-east-coast", x: 134, y: 73 },
        { id: "meadow-edge-ops", x: 120, y: 72.5 },
        { id: "meadow-edge-depot", x: 106, y: 72 },
        { id: "meadow-edge-service-road", x: 98, y: 70.5 },
        { id: "meadow-edge-harbour-east", x: 90, y: 67.5 },
        { id: "meadow-edge-main-path", x: 80, y: 66 },
        { id: "meadow-edge-harbour-west", x: 70, y: 66.5 },
        { id: "meadow-edge-village-east", x: 62, y: 68.5 },
        { id: "meadow-edge-village", x: 54, y: 70 },
        { id: "meadow-edge-village-west", x: 44, y: 70 },
        { id: "meadow-edge-delta-trail", x: 38, y: 67.5 },
        { id: "meadow-edge-riverlands-south", x: 33, y: 62 },
        { id: "meadow-edge-west-cove", x: 28, y: 58 },
        { id: "meadow-edge-west-coast", x: 20, y: 57 },
        { id: "meadow-off-map-west", x: -5, y: 57 }
      ] } },
      { id: "highland", level: 2, outline: { samplesPerSegment: 8, points: [
        // the highland runs off the map to the north; its south edge, east to west, is the cliff above
        // the meadow terrace
        { id: "highland-off-map-north-west", x: -5, y: -5 },
        { id: "highland-off-map-north-east", x: 155, y: -5 },
        { id: "highland-off-map-east", x: 155, y: 30 },
        { id: "highland-edge-lantern-cove", x: 122, y: 30 },
        { id: "highland-edge-research-gate", x: 112, y: 31 },
        { id: "highland-edge-service-road", x: 102, y: 33.5 },
        { id: "highland-edge-tower", x: 94, y: 36 },
        { id: "highland-edge-galli", x: 84, y: 37 },
        { id: "highland-edge-park-gate", x: 76, y: 36.5 },
        { id: "highland-edge-cave", x: 68, y: 35.5 },
        { id: "highland-edge-spino", x: 58, y: 34 },
        { id: "highland-edge-upper-falls", x: 50, y: 31.5 },
        { id: "highland-edge-river", x: 44, y: 29 },
        { id: "highland-edge-pachy", x: 36, y: 27.5 },
        { id: "highland-edge-brachio", x: 26, y: 27.5 },
        { id: "highland-edge-west", x: 14, y: 28 },
        { id: "highland-off-map-west", x: -5, y: 30 }
      ] } },
      { id: "headland-plateau", level: 2, outline: { samplesPerSegment: 8, points: [
        // the lighthouse headland's raised top
        { id: "headland-plateau-north-west", x: 132, y: 38.5 },
        { id: "headland-plateau-north", x: 140, y: 38.5 },
        { id: "headland-plateau-tip", x: 146, y: 42.5 },
        { id: "headland-plateau-south-east", x: 144, y: 48.5 },
        { id: "headland-plateau-south", x: 137, y: 49.5 },
        { id: "headland-plateau-south-west", x: 132, y: 47 }
      ] } },
      { id: "volcano-mass", level: 3, solid: true, reservedFor: "Cinder Reach (a later phase opens it)", ellipse: { cx: 72, cy: 15, rx: 14, ry: 10, sides: 48 } },
      { id: "shrine-knoll", level: 3, ellipse: { cx: 13, cy: 21, rx: 6.5, ry: 4.5, sides: 48 } }
    ],
    /* the beach: a land tile at level 0 within level0Within steps of the sea, or at level 1 within
       level1Within, is beach (sand) at level 0. Levels 2 and 3 meet the sea as sea cliffs, with no beach */
    beach: { level0Within: 2, level1Within: 1 },
    /* the eight ramps, the only places a level changes. Boxes are inclusive (the study wrote them
       half-open, x0 <= x < x1, so each one's x1 and y1 here are the study's minus 1) */
    ramps: [
      { id: "main-path", number: 1, levels: [0, 1], rampBox: { x0: 73, y0: 63, x1: 79, y1: 67 } },
      { id: "park-gate", number: 2, levels: [1, 2], rampBox: { x0: 71, y0: 34, x1: 77, y1: 39 } },
      { id: "shrine-stairs", number: 3, levels: [2, 3], rampBox: { x0: 13, y0: 22, x1: 19, y1: 26 } },
      { id: "service-road-lower", number: 4, levels: [0, 1], rampBox: { x0: 94, y0: 67, x1: 100, y1: 73 } },
      { id: "service-road-upper", number: 5, levels: [1, 2], rampBox: { x0: 97, y0: 30, x1: 104, y1: 36 } },
      { id: "headland-stairs", number: 6, levels: [1, 2], rampBox: { x0: 128, y0: 40, x1: 132, y1: 46 } },
      { id: "lantern-cove-steps", number: 7, levels: [0, 1], rampBox: { x0: 124, y0: 32, x1: 129, y1: 37 } },
      { id: "riverlands-delta-trail", number: 8, levels: [0, 1], rampBox: { x0: 27, y0: 60, x1: 37, y1: 70 } }
    ]
  },

  /* water and the volcano's terrain (B1c), on the locked coast and levels: they change what ground a land
     tile is, never whether it is land or its level.
     - bodies, in order (a later one wins a tile): each fills the land tiles whose centre is inside its
       ellipse or outline. kind says what it is (pond, tarn, lagoon, marsh); the format draws them all as
       still water for now. withinBox is the inclusive tile box the body must stay inside (its approved
       area). meetsSea: true says the body may touch the sea; any other body that does is an error.
     - rivers, after the bodies (a river wins a tile): an open Hermite spline through named points, from
       upstream to downstream. A land tile is river when its centre is within the half-width of the
       nearest segment of the sampled centre line. halfWidth is a number, or a widening one,
       base + gain * (k / n) ^ power along the n segments. A river that starts at another's point joins it.
     - the volcano: the cone and the crater inside the solid volcano mass (elevation); the rest of the
       mass is scree. All of it stays solid; the crater is lava.
     - crossings: the only places the river may be bridged (approved). The bridges themselves are built
       by the corridors (B1d): a corridor over river makes bridge there. A crossing with no bridge yet is
       planned, and map-lint uses it only to show that any area the river cuts off is joined again by it. */
  water: {
    bodies: [
      { id: "koi-pond", kind: "pond", ellipse: { cx: 111, cy: 62, rx: 5.5, ry: 3.2, sides: 48 }, withinBox: { x0: 104, y0: 56, x1: 118, y1: 68 } },
      { id: "tarn", kind: "tarn", ellipse: { cx: 54.5, cy: 12.5, rx: 2.8, ry: 1.8, sides: 48 }, withinBox: { x0: 50, y0: 9, x1: 59, y1: 16 } },
      { id: "delta-lagoon", kind: "lagoon", ellipse: { cx: 15, cy: 75, rx: 3, ry: 2, sides: 48 }, withinBox: { x0: 11, y0: 72, x1: 19, y1: 78 } },
      { id: "delta-reed-marsh", kind: "marsh", meetsSea: true, outline: { samplesPerSegment: 8, points: [
        // between the two channels; it fronts the sea along the lobe between the mouths (as approved)
        { id: "marsh-north-west", x: 10.5, y: 87 },
        { id: "marsh-north-east", x: 20, y: 84 },
        { id: "marsh-east", x: 19, y: 90 },
        { id: "marsh-south-east", x: 16, y: 94.5 },
        { id: "marsh-south-west", x: 10.5, y: 93.5 }
      ] }, withinBox: { x0: 9, y0: 83, x1: 21, y1: 96 } }
    ],
    rivers: [
      { id: "main-river", samplesPerSegment: 8, halfWidth: { base: 1, gain: 1.5, power: 1.6 }, points: [
        { id: "river-source", x: 54, y: 13 },              // in the tarn
        { id: "river-highland", x: 50, y: 22 },
        { id: "river-upper-falls", x: 44, y: 31 },         // drops from the highland to the meadow terrace
        { id: "river-spino-reach", x: 38, y: 42 },
        { id: "river-brachio-reach", x: 34, y: 52 },
        { id: "river-lower-falls", x: 30, y: 63 },         // drops from the meadow terrace to the lowland
        { id: "river-delta-head", x: 26, y: 75 },
        { id: "river-fork", x: 21, y: 82 },                // the delta branch leaves here
        { id: "river-main-mouth", x: 13, y: 86 }
      ] },
      { id: "delta-branch", samplesPerSegment: 6, halfWidth: 1.3, points: [
        { id: "branch-fork", x: 21, y: 82 },
        { id: "branch-middle", x: 18, y: 89 },
        { id: "branch-second-mouth", x: 15, y: 94.5 }
      ] }
    ],
    volcano: {
      mass: "volcano-mass",
      cone: { cx: 72, cy: 13, rx: 9, ry: 6.5, sides: 48 },
      crater: { cx: 72, cy: 12, rx: 3, ry: 2, sides: 48 }
    },
    crossings: [
      // the study's bridge boxes, converted from half-open to inclusive
      { id: "upper-bridge", crossingBox: { x0: 46, y0: 20, x1: 53, y1: 25 } },
      { id: "brachio-bridge", crossingBox: { x0: 32, y0: 44, x1: 38, y1: 49 } },
      { id: "delta-bridge", crossingBox: { x0: 21, y0: 75, x1: 28, y1: 80 } }
    ]
  },

  /* corridors (B1d): the island's paths, a hierarchy, not a grid. A corridor is a polyline through
     positions (tile space, like the coast's points); a land tile is on it when its centre is within its
     class's half-width of the line. main (about 3 tiles wide) links the hubs to the arrival; secondary
     (about 2) reaches the districts; service (about 2) serves ops, research and the west jetty; trail
     (1 to 2) crosses the riverlands, the highland and the shrine cape. Corridors pave grass and beach;
     over river they make bridge (only inside an approved water.crossings box); they never pave still
     water or lava, and never change a level. Plazas pave the grass and beach inside them. The large
     natural areas (the commons, the riverlands, the koi garden and headland, the highland) stay open:
     only these lines cross them. Short local trails (door stubs, the koi garden loop, the fence walks)
     are the approved study's, kept so the network is exact; B3 may refine them. Thin diagonal trails can
     touch only at tile corners in this raster (approved for B1): B2's painter must visually verify that
     trails render as continuous strokes from these lines.
     routeEnds: the places the corridors exist to join, each a tile; map-lint walks to every one from the
     arrival and reports the times. Not districts (B1e). */
  corridors: {
    halfWidths: { main: 1.55, secondary: 1.05, service: 1.05, trail: 0.62 },
    plazas: [
      // inclusive boxes (the study's rectangles were half-open: x1 and y1 here are the study's minus 1)
      { id: "arrival-plaza", sameAs: "exits.south.arrivalPlazaBox" },
      { id: "village-square", plazaBox: { x0: 42, y0: 82, x1: 54, y1: 88 } },
      { id: "commons", ellipse: { cx: 76, cy: 54, rx: 6, ry: 4.5, sides: 48 } },
      { id: "car-park", plazaBox: { x0: 56, y0: 88, x1: 60, y1: 91 } },
      { id: "research-forecourt", plazaBox: { x0: 103, y0: 25, x1: 120, y1: 28 } },
      { id: "service-yard", plazaBox: { x0: 99, y0: 83, x1: 107, y1: 89 } }
    ],
    paths: [
      // main: the spine, from the ferry pier through the arrival plaza, the commons and the park gate to the highland junction
      { id: "main-walk", class: "main", line: [[79, 96], [79, 84], [78, 79], [76, 73], [76, 66], [76, 60], [76, 54], [75, 46], [74, 38], [73, 33]] },
      // secondary: to the districts
      { id: "village-road", class: "secondary", line: [[71, 78], [62, 80], [52, 84], [44, 85], [34, 85], [28, 82], [24, 79], [19, 76], [17, 71]] },   // plaza, village, delta bridge, west jetty
      { id: "ops-road", class: "secondary", line: [[84, 75], [92, 74.5], [97, 80], [104, 85], [109, 85]] },                                          // plaza, service yard, the compound's gate
      { id: "riverlands-road", class: "secondary", line: [[76, 54], [66, 52], [56, 50], [46, 49], [38, 48], [30, 46], [22, 44]] },                    // commons, riverlands, brachio bridge, brachio meadow
      { id: "koi-headland-road", class: "secondary", line: [[76, 54], [88, 52.5], [100, 52], [111, 52], [120, 47], [127, 44], [132, 44], [137, 45.5], [140, 45.5]] },   // commons, koi garden gate, headland stairs, lighthouse
      // service: ops, research
      { id: "research-service-road", class: "service", line: [[104, 85], [98, 82], [96, 76], [97, 70], [99, 62], [100, 52], [100, 42], [101, 33], [104, 28], [111, 26.5]] },   // service yard, both service-road ramps, research forecourt
      { id: "helipad-spur", class: "service", line: [[103, 89], [103, 93]] },
      { id: "depot-spur", class: "service", line: [[105, 78.7], [105, 83]] },
      // trails: the highland, the shrine cape, the riverlands
      { id: "cave-spur", class: "trail", line: [[73, 33], [68, 28], [66, 26]] },
      { id: "shrine-trail", class: "trail", line: [[73, 33], [62, 31], [55, 27], [50, 24], [44, 22], [38, 22.5], [30, 23.5], [22, 24.5], [17, 25], [15, 23], [14, 21]] },   // junction, upper bridge, heath, shrine stairs
      { id: "bridgehead-trail", class: "trail", line: [[14, 21], [9, 21]] },                                                                         // the Ashpine rope-bridge landing
      { id: "tower-trail", class: "trail", line: [[73, 33], [84, 32], [90, 30], [95, 29], [100, 29], [104, 28]] },                                    // junction, tower, research gate
      { id: "volcano-trailhead-spur", class: "trail", line: [[84, 32], [83, 25]] },                                                                   // reserved for Cinder Reach
      { id: "paddock-fence-walk", class: "trail", line: [[106, 26], [106, 19], [119, 19]] },
      { id: "raptor-yard-walk", class: "trail", line: [[120, 26], [123, 24], [123, 22]] },
      { id: "koi-north-gate", class: "trail", line: [[111, 52], [111, 55]] },
      { id: "koi-west-gate", class: "trail", line: [[103, 61.5], [98, 61.5]] },
      { id: "koi-garden-loop", class: "trail", line: [[106, 58], [108, 57.5], [115, 57.5], [117, 60], [117, 64], [114, 65], [107, 65], [105, 63], [106, 58]] },
      { id: "koi-bay-overlook", class: "trail", line: [[117, 63.5], [120, 63.5]] },
      { id: "riverlands-delta-trail", class: "trail", line: [[46, 49], [42, 56], [36, 62], [32, 66], [31, 68]] },
      { id: "brachio-meadow-loop", class: "trail", line: [[22, 44], [16, 40], [12, 46], [18, 50], [22, 44]] },
      // door stubs where the approved study's buildings stand (B3 builds them)
      { id: "terminal-door", class: "trail", line: [[88, 81], [88, 82]] },
      { id: "post-office-door", class: "trail", line: [[46, 81], [46, 84]] },
      { id: "cafe-door", class: "trail", line: [[57, 80], [57, 82]] },
      { id: "visitor-centre-door", class: "trail", line: [[85, 74], [85, 75]] },
      { id: "research-station-door", class: "trail", line: [[112, 25], [112, 26]] },
      { id: "keeper-cottage-door", class: "trail", line: [[136, 42], [136, 44.5]] },
      { id: "lantern-cove-steps-trail", class: "trail", line: [[125, 45], [126, 40], [127, 35.5]] }
    ],
    routeEnds: [
      { id: "arrival", endTile: [79, 79] },
      { id: "village-square", endTile: [48, 85] },
      { id: "ops-service-yard", endTile: [104, 86] },
      { id: "commons", endTile: [76, 54] },
      { id: "riverlands", endTile: [46, 49] },
      { id: "brachio-meadow", endTile: [18, 44] },
      { id: "delta-wetland", endTile: [15, 78] },
      { id: "koi-garden", endTile: [108, 68] },
      { id: "lighthouse-headland", endTile: [140, 45] },
      { id: "research-forecourt", endTile: [110, 26] },
      { id: "highland-junction", endTile: [73, 33] },
      { id: "cave", endTile: [66, 25] },
      { id: "shrine", endTile: [14, 20] },
      { id: "nw-bridgehead", endTile: [9, 21] },
      { id: "west-jetty", endTile: [18, 68] },
      { id: "helipad", endTile: [103, 95] },
      { id: "ferry-pier-end", endTile: [79, 96] }
    ]
  },

  /* infrastructure (B1d). The docks are built from the exits' own boxes: the quay (exits.south.quayBox),
     the ferry pier (exits.south.ferryPierBox) and the west service jetty (exits.west.jettyBox), dock
     over land or water. The helipad is pad. Nothing else: no east pier, no south-east slip */
  infrastructure: {
    helipadBox: { x0: 101, y0: 93, x1: 105, y1: 97 }
  },

  /* ════════ B1e: planning metadata. None of it changes a tile: it says where later content belongs and
     checks that the room is there. B3 turns the reserves into buildings, walls, fences and landmarks.
     Nothing below is written into the staged map (it is not runtime data). ════════ */

  /* the eight districts: organising areas, not collision; they may overlap where they meet. Each box is
     the approved study's, converted from its half-open rectangle (x1 and y1 here are the study's minus 1),
     so the koi garden and headland district ends at x1 = 149. levels: the levels the district spans.
     hubs: the district's named centres, each a walkable tile reachable from the arrival */
  districts: [
    { id: "harbour-arrival", levels: [0], districtBox: { x0: 64, y0: 66, x1: 97, y1: 107 }, hubs: [{ id: "arrival-plaza", hubTile: [79, 79] }] },
    { id: "village-services", levels: [0], districtBox: { x0: 22, y0: 68, x1: 65, y1: 105 }, hubs: [{ id: "village-square", hubTile: [48, 85] }] },
    { id: "ops-security", levels: [0], districtBox: { x0: 94, y0: 72, x1: 131, y1: 103 }, hubs: [{ id: "ops-service-yard", hubTile: [104, 86] }] },
    { id: "meadow-commons", levels: [1], districtBox: { x0: 62, y0: 38, x1: 99, y1: 65 }, hubs: [{ id: "commons", hubTile: [76, 54] }] },
    { id: "riverlands-delta", levels: [0, 1], districtBox: { x0: 5, y0: 28, x1: 61, y1: 99 }, hubs: [{ id: "brachio-meadow", hubTile: [18, 44] }, { id: "delta-wetland", hubTile: [15, 78] }] },
    { id: "koi-garden-headland", levels: [1, 2], districtBox: { x0: 100, y0: 32, x1: 149, y1: 71 }, hubs: [{ id: "koi-garden", hubTile: [108, 68] }, { id: "lighthouse", hubTile: [140, 45] }] },
    { id: "research-security", levels: [2], districtBox: { x0: 99, y0: 2, x1: 131, y1: 29 }, hubs: [{ id: "research-forecourt", hubTile: [110, 26] }] },
    { id: "highland-volcano-cave", levels: [2, 3], districtBox: { x0: 5, y0: 1, x1: 98, y1: 36 }, hubs: [{ id: "highland-junction", hubTile: [73, 33] }, { id: "cave", hubTile: [66, 25] }, { id: "shrine", hubTile: [14, 20] }] }
  ],

  /* reserves: four kinds, never treated alike.
     - footprints: a future building's or landmark's body, exclusive (no two overlap). Each is free land on
       one level: no water, lava, cliff rim, ramp, bridge, dock or paving, with walkable frontage on its front
       side for a door. Sizes are the approved targets (the study's, but the visitor centre 9 x 5 not 10 x 5,
       the ranger HQ / depot 7 x 4 not 8 x 5, the lighthouse base 2 x 2 not 3 x 3, as approved).
     - compounds: a broader area later content goes inside (paths may cross it). walled: B3 builds a wall
       round its edge with openings at gateTiles (the study's).
     - openSpaces: areas that must stay clear (every tile walkable, no footprint or wall in them). clearField
       is an ellipse tested at tile centres, ((x + 0.5 - cx) / rx)^2 + ((y + 0.5 - cy) / ry)^2 <= 1 (the study's).
     - markers: single places later systems use (a cave mouth and its approach, gates, a trailhead) */
  reserves: {
    footprints: [
      { id: "visitor-centre", kind: "building", front: "south", footprintBox: { x0: 80, y0: 69, x1: 88, y1: 73 } },
      { id: "ferry-terminal", kind: "building", front: "south", sameAs: "exits.south.ferryTerminalReserveBox" },
      { id: "ranger-hq-depot", kind: "building", front: "south", footprintBox: { x0: 101, y0: 73, x1: 107, y1: 76 } },
      { id: "bunker", kind: "building", front: "south", inCompound: "bunker-compound", footprintBox: { x0: 113, y0: 79, x1: 119, y1: 82 } },
      { id: "research-station", kind: "building", front: "south", footprintBox: { x0: 108, y0: 21, x1: 115, y1: 24 } },
      { id: "raptor-house", kind: "building", front: "south", footprintBox: { x0: 121, y0: 20, x1: 125, y1: 21 } },
      { id: "workshop", kind: "building", front: "south", footprintBox: { x0: 60, y0: 84, x1: 65, y1: 87 } },
      { id: "post-office", kind: "building", front: "south", footprintBox: { x0: 44, y0: 77, x1: 48, y1: 80 } },
      { id: "cafe", kind: "building", front: "south", footprintBox: { x0: 55, y0: 77, x1: 59, y1: 79 } },
      { id: "keeper-cottage", kind: "building", front: "south", footprintBox: { x0: 134, y0: 40, x1: 137, y1: 41 } },
      { id: "koi-pavilion", kind: "building", front: "south", inCompound: "koi-garden", footprintBox: { x0: 113, y0: 66, x1: 116, y1: 68 } },
      { id: "lighthouse", kind: "landmark", front: "south", footprintBox: { x0: 139, y0: 42, x1: 140, y1: 43 } },   // the base; the sprite stands much taller
      { id: "tower", kind: "landmark", front: "south", footprintBox: { x0: 94, y0: 25, x1: 96, y1: 27 } }
    ],
    compounds: [
      { id: "bunker-compound", walled: true, compoundBox: { x0: 109, y0: 76, x1: 124, y1: 89 }, gateTiles: [[109, 84], [109, 85], [109, 86]] },
      { id: "koi-garden", walled: true, compoundBox: { x0: 103, y0: 54, x1: 119, y1: 70 }, gateTiles: [[110, 54], [111, 54], [112, 54], [103, 61], [103, 62], [119, 63], [119, 64]] },
      // the study's four 4 x 3 cottages (x30-33 y87-89, x36-39 y92-94, x44-47 y96-98, x52-55 y96-98), kept as one area until B3
      { id: "cottage-row", walled: false, compoundBox: { x0: 30, y0: 87, x1: 55, y1: 98 } }
    ],
    openSpaces: [
      { id: "rift-arena", centreTile: [76, 56], clearField: { cx: 76.5, cy: 56.5, rx: 10.6, ry: 5.75 } }   // the orb fight's clear ground in the commons
    ],
    markers: [
      { id: "cave-mouth", markerTile: [66, 24], approachTile: [66, 25] },          // outside the solid volcano, off the cave spur; the cave is a later phase
      { id: "volcano-trailhead", markerTile: [83, 25] },                          // where Cinder Reach will start; the volcano stays sealed
      { id: "park-gate", markerTile: [74, 38] },                                  // the main walk's gate between the commons and the highland
      { id: "research-gate", markerTile: [101, 29] },                             // the research road's gate into the secure shoulder
      { id: "shrine", markerTile: [14, 19], approachTile: [14, 20] }              // the study's 3 x 3 base (x13-15, y17-19) would cover three cliff-rim tiles; B3 sizes and places it
    ]
  },

  /* habitats: ecological planning regions only. No fence, wall, roam area, spawn or creature comes from
     them. planningLabels say what each is for. Herbivore spaces stay open and natural; predators are
     contained later (B3). The T. rex holding paddock is temporary: its long-term home is Ironwood Keep.
     Each is an outline (a closed smooth Hermite through named points, like the coast) or an inclusive box */
  habitats: [
    { id: "holding-paddock", containment: "contained", planningLabels: ["temporary predator holding (T. rex, until Ironwood)", "double fence, high security"], outline: { samplesPerSegment: 8, points: [
      { id: "holding-paddock-west", x: 107, y: 13 }, { id: "holding-paddock-north", x: 112, y: 10.5 }, { id: "holding-paddock-north-east", x: 117, y: 11 },
      { id: "holding-paddock-east", x: 118, y: 16 }, { id: "holding-paddock-south", x: 113, y: 17.5 }, { id: "holding-paddock-south-west", x: 107, y: 17 }] } },
    { id: "raptor-yard", containment: "contained", planningLabels: ["raptor research yard", "fence and roof netting"], habitatBox: { x0: 119, y0: 10, x1: 127, y1: 17 } },
    { id: "riverlands-range", containment: "open", planningLabels: ["herd range: stegosaur, triceratops, ankylosaur, nests", "river west, cliff south, hedgerow east"], outline: { samplesPerSegment: 8, points: [
      { id: "riverlands-range-north-west", x: 41, y: 41.5 }, { id: "riverlands-range-north-east", x: 56, y: 40.5 }, { id: "riverlands-range-east", x: 60, y: 47 },
      { id: "riverlands-range-south-east", x: 58, y: 60 }, { id: "riverlands-range-south", x: 48, y: 64 }, { id: "riverlands-range-south-west", x: 40, y: 60 }, { id: "riverlands-range-west", x: 38.5, y: 50 }] } },
    { id: "brachio-meadow", containment: "open", planningLabels: ["brachiosaur meadow", "river east, coast west, cliff north, cove south"], outline: { samplesPerSegment: 8, points: [
      { id: "brachio-meadow-north-west", x: 11, y: 33 }, { id: "brachio-meadow-north", x: 24, y: 30.5 }, { id: "brachio-meadow-north-east", x: 31, y: 35 },
      { id: "brachio-meadow-east", x: 31, y: 44 }, { id: "brachio-meadow-south-east", x: 24, y: 54 }, { id: "brachio-meadow-south-west", x: 13, y: 54 }, { id: "brachio-meadow-west", x: 10.5, y: 44 }] } },
    { id: "spino-reach", containment: "open", planningLabels: ["spinosaur reach", "the river below the falls"], outline: { samplesPerSegment: 8, points: [
      { id: "spino-reach-west", x: 37, y: 31 }, { id: "spino-reach-north", x: 45, y: 30.5 }, { id: "spino-reach-east", x: 47, y: 36 }, { id: "spino-reach-south", x: 42, y: 40 }, { id: "spino-reach-south-west", x: 36, y: 37 }] } },
    { id: "delta-wetland", containment: "open", planningLabels: ["parasaurolophus wetland", "river east, coast west, lagoon"], outline: { samplesPerSegment: 8, points: [
      { id: "delta-wetland-west", x: 14, y: 73.5 }, { id: "delta-wetland-north", x: 20, y: 71 }, { id: "delta-wetland-east", x: 23, y: 76 }, { id: "delta-wetland-south", x: 19, y: 81 }, { id: "delta-wetland-south-west", x: 14.5, y: 80 }] } },
    { id: "galli-meadow", containment: "open", planningLabels: ["gallimimus meadow"], outline: { samplesPerSegment: 8, points: [
      { id: "galli-meadow-north-west", x: 84, y: 40 }, { id: "galli-meadow-north-east", x: 95, y: 40.5 }, { id: "galli-meadow-south-east", x: 96, y: 49 }, { id: "galli-meadow-south-west", x: 85, y: 49.5 }] } },
    { id: "pachy-heath", containment: "open", planningLabels: ["pachycephalosaur heath"], outline: { samplesPerSegment: 8, points: [
      { id: "pachy-heath-west", x: 35, y: 15 }, { id: "pachy-heath-north", x: 43, y: 14.5 }, { id: "pachy-heath-east", x: 47, y: 19 }, { id: "pachy-heath-south-east", x: 46, y: 23 }, { id: "pachy-heath-south-west", x: 36, y: 24 }] } },
    { id: "dilo-strip", containment: "open", planningLabels: ["dilophosaur strip"], outline: { samplesPerSegment: 8, points: [
      { id: "dilo-strip-north-west", x: 88, y: 13 }, { id: "dilo-strip-north-east", x: 94, y: 13.5 }, { id: "dilo-strip-south-east", x: 96, y: 21 }, { id: "dilo-strip-south-west", x: 89, y: 22.5 }] } },
    { id: "koi-garden", containment: "walled garden", planningLabels: ["koi garden: the cats and the koi", "walled, two gates (the koi-garden compound)"], habitatBox: { x0: 104, y0: 55, x1: 117, y1: 68 } },
    { id: "village-gardens", containment: "open", planningLabels: ["village gardens: compsognathus"], habitatBox: { x0: 26, y0: 90, x1: 34, y1: 97 } }
  ],

  /* planning and test markers only, never runtime data: the study's log targets, which the all-logs tour
     (the 331-tile scale check) walks between. The logs themselves are B3's */
  planningMarkers: {
    logSites: [
      { id: "mailbox", siteTile: [50, 82] }, { id: "tablet", siteTile: [82, 49] }, { id: "rack-desk-bunker", siteTile: [116, 83] }, { id: "uplink", siteTile: [121, 82] },
      { id: "macbook", siteTile: [106, 58] }, { id: "tower", siteTile: [95, 28] }, { id: "lighthouse", siteTile: [140, 45] }
    ]
  },

  /* named features, each checked by tiles that must be land or sea (map-lint). points: the control
     points that shape it, so a check that fails says which points to look at */
  features: [
    { id: "south-crescent-harbour", points: ["harbour-head-east-centre", "harbour-head-west-centre", "harbour-east-shore", "harbour-west-shore"],
      landTiles: [[79, 83], [58, 104], [100, 101]], seaTiles: [[79, 92], [79, 100]] },
    { id: "village-arm", points: ["village-arm-tip", "harbour-west-shore-outer"], landTiles: [[58, 104]], seaTiles: [[63, 104], [60, 108]] },
    { id: "ops-arm", points: ["ops-arm-tip", "harbour-east-shore-outer"], landTiles: [[100, 101]], seaTiles: [[95, 105]] },
    { id: "south-west-delta-two-mouths", points: ["delta-main-mouth", "delta-lobe", "delta-second-mouth"],
      landTiles: [[11, 84], [11, 87], [10, 90], [14, 94], [16, 95]], seaTiles: [[11, 86], [9, 90], [15, 95]] },
    { id: "west-service-cove", points: ["west-cove-inner", "west-cove-south-inner", "west-cove-north-shore"],
      landTiles: [[16, 61], [16, 71], [20, 67]], seaTiles: [[16, 66], [18, 67]] },
    { id: "north-west-shrine-cape", points: ["nw-cape-tip", "nw-cape-knuckle", "nw-cape-re-entrant"],
      landTiles: [[7, 21], [8, 21], [7, 26]], seaTiles: [[6, 21], [7, 24]] },
    { id: "north-west-bay", points: ["nw-bay-inner", "nw-bay-east-point"], landTiles: [[26, 17], [33, 18]], seaTiles: [[29, 18]] },
    { id: "north-volcano-highland-coast", points: ["volcano-north-cape", "volcano-north-notch-west", "volcano-north-notch-east"],
      landTiles: [[70, 5], [70, 7]], seaTiles: [[70, 4], [63, 7], [77, 7]] },
    { id: "ash-cove", points: ["ash-cove-inner", "ash-cove-west-shore", "ash-cove-east-shore"],
      landTiles: [[96, 14], [102, 14], [99, 17]], seaTiles: [[99, 15]] },
    { id: "research-shoulder", points: ["research-shoulder-north-point", "research-shoulder-south-east-corner"],
      landTiles: [[120, 10], [128, 15]], seaTiles: [[133, 19]] },
    { id: "lantern-cove", points: ["lantern-cove-inner"], landTiles: [[125, 25], [125, 34]], seaTiles: [[125, 31]] },
    { id: "eastern-lighthouse-headland", points: ["lighthouse-headland-tip", "headland-north-shore", "headland-south-shore"],
      landTiles: [[140, 45], [143, 43]], seaTiles: [[145, 43], [138, 39], [136, 50]] },
    { id: "koi-bay", points: ["koi-bay-inner", "koi-bay-north-shore", "koi-bay-south-shore"],
      landTiles: [[124, 52], [124, 64]], seaTiles: [[124, 58]] },
    { id: "west-coast", points: ["west-coast-westmost"], landTiles: [[7, 50]], seaTiles: [[5, 50]] }
  ],

  /* the three future exits, the only external connections the home island will have. Nothing is built
     in B1a: these say where each one goes, so the coast keeps room for it. Every concept has its own
     field and its own tiles; no coordinate means two things */
  exits: {
    south: {
      leadsTo: "the public ferries, the restricted Server Key line, and the boat back to the site",
      arrivalPlazaBox: { x0: 70, y0: 74, x1: 84, y1: 81 },          // land: the harbour plaza where pi arrives
      ferryTerminalReserveBox: { x0: 85, y0: 77, x1: 90, y1: 80 },  // land: kept free for the ferry terminal building (B3), not built
      quayBox: { x0: 66, y0: 82, x1: 93, y1: 83 },                  // land: the harbour edge the quay runs along (B1d)
      ferryPierBox: { x0: 78, y0: 84, x1: 80, y1: 96 },             // sea: where the ferry pier runs out over the basin (B1d)
      berthTile: [79, 97],                                          // deep sea: where the ferry ties up, just past the pier's end
      routeMarkerTile: [79, 101]                                    // deep sea: where the external routes leave the harbour (a marker, not a building)
    },
    west: {
      leadsTo: "the restricted service barge to Ironwood Keep",
      jettyBox: { x0: 17, y0: 66, x1: 19, y1: 70 },                 // across the shore of the west cove: its root on land, its head in the water (B1d)
      routeMarkerTile: [13, 66]                                     // deep sea: where the barge route leaves the cove
    },
    northwest: {
      leadsTo: "the rope bridge to Ashpine Heights (mended after The Climb)",
      capePoint: "nw-cape-tip",                                     // the coast point the bridge leaves from
      landingBox: { x0: 9, y0: 21, x1: 14, y1: 21 },                // land: the bridgehead on the cape, behind its tip (B1d)
      routeMarkerTile: [5, 21]                                      // sea: the gap the bridge crosses (the span itself is a later phase)
    }
  },

  /* open sea that must stay free of land, for the satellites and their routes (no satellite land is built
     on this map). map-lint checks that no tile in a lane is land */
  seaLanes: [
    { id: "north-margin", toward: "north: open sea for later expansion", laneBox: { x0: 0, y0: 0, x1: 149, y1: 4 } },
    { id: "west-margin", toward: "west", laneBox: { x0: 0, y0: 0, x1: 5, y1: 119 } },
    { id: "east-channel", toward: "east: the ferries round the east coast to Hornfield, and Reedmarsh", laneBox: { x0: 144, y0: 0, x1: 149, y1: 119 } },
    { id: "south-sea", toward: "south: Server Key and the ferry lines", laneBox: { x0: 0, y0: 108, x1: 149, y1: 119 } },
    { id: "ashpine-strait", toward: "north-west: Ashpine Heights, across the gap off the cape", laneBox: { x0: 0, y0: 10, x1: 6, y1: 24 } },
    { id: "ironwood-west", toward: "west, then south-west: Ironwood Keep, out of the west cove", laneBox: { x0: 0, y0: 64, x1: 14, y1: 69 } },
    { id: "harbour-channel", toward: "south: from the berth out of the harbour to the map's edge", laneBox: { x0: 76, y0: 97, x1: 82, y1: 119 } },
    { id: "south-east-sea", toward: "south-east: Reedmarsh", laneBox: { x0: 100, y0: 104, x1: 149, y1: 119 } }
  ],

  /* the satellites (conceptual: no satellite map exists), the exit each is reached from, and the lanes
     their routes need */
  satellites: [
    { id: "ashpine-heights", direction: "north-west", exit: "northwest", lanes: ["ashpine-strait", "north-margin"] },
    { id: "ironwood-keep", direction: "south-west", exit: "west", lanes: ["ironwood-west", "west-margin", "south-sea"] },
    { id: "server-key", direction: "far south", exit: "south", lanes: ["harbour-channel", "south-sea"] },
    { id: "hornfield", direction: "north-east", exit: "south", lanes: ["harbour-channel", "south-east-sea", "east-channel", "north-margin"] },
    { id: "reedmarsh", direction: "east / south-east", exit: "south", lanes: ["harbour-channel", "south-east-sea", "east-channel"] }
  ]
};
