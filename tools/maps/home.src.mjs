/* MAP-B: the authored source of the home island, "Harbour Crescent" (MAP-B r2.1, approved by Ammaar
   2026-10-03). This file is the source of truth for the redesigned island's geography. Edit it, then run
   `node tools/map-compile.mjs` (it writes tools/maps/staged/home.js) and `node tools/map-lint.mjs`.

   STAGED. Nothing in the game reads this file or its output yet. Production still runs the original
   100 x 80 island from js/maps/home.js; the game learns the new map format in B2, and the switch-over is
   a separate, approved release later. It holds the canvas, the coast and the sea (B1a, locked), the four
   levels, the beach and the eight ramps (B1b, locked), the river, the ponds and the volcano's terrain
   (B1c), and metadata for the three future exits, the planned river crossings and the open sea the
   satellites need. Paths, bridges, docks, buildings and everything else come in later batches; this
   file must not hold them yet (the compiler refuses unknown sections).

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
     - plannedCrossings: where B1d will bridge the river. Not built: map-lint uses them only to show that
       any area the river cuts off until then is joined again by a planned crossing. */
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
    plannedCrossings: [
      // the study's bridge boxes, converted from half-open to inclusive; built in B1d
      { id: "upper-bridge", crossingBox: { x0: 46, y0: 20, x1: 53, y1: 25 } },
      { id: "brachio-bridge", crossingBox: { x0: 32, y0: 44, x1: 38, y1: 49 } },
      { id: "delta-bridge", crossingBox: { x0: 21, y0: 75, x1: 28, y1: 80 } }
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
