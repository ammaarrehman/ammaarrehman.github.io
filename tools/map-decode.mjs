#!/usr/bin/env node
/* map-decode (MAP-A3): decodeMap(), the island's map decoder, on synthetic maps, in each engine, through
   the ?debug=1 API (the production function, not a copy). None of these maps ships; they are built here.
   - valid: the real js/maps/home.js; a minimal 12 x 10 map with every optional field left out (the B0
     placements too: a map carries only the systems it has); a representative one with props, regions,
     decals, woods, a source and the B0 placements (anchors, roam areas, two of them with the same box,
     zones with a fractional edge, spawns, a route, places); a 150 x 120 one (decode only: the format and
     decoder don't assume 100 x 80);
   - decodeMap never changes what it's given: it decodes deep-frozen copies, and the data is the same after;
   - invalid: one fault at a time, each refused with an error naming the field and the problem (the core
     approach among them: it must be walkable and on or next to the arena, so the arena can't move without it).

     node tools/map-decode.mjs
     ENGINES=chromium node tools/map-decode.mjs        (default chromium, webkit, firefox) */
import { chromium, firefox, webkit } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINES = (process.env.ENGINES || "chromium,webkit,firefox").split(",");
const HOME = (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), c); return c.window.ISLAND_MAPS.home; })();
const T = 16;

/* a small consistent map: grass on terrace 1, a dock, a helipad, a gate, a hut with its door, a sign; the
   volcano sits off the map so no tile is under it */
function synth(w, h, full) {
  const row = (ch) => ch.repeat(w), set = (rows, x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  const ground = Array.from({ length: h }, () => row("3")), height = Array.from({ length: h }, () => row("1")), coll = Array.from({ length: h }, () => row("0"));
  const dock = [2, 4]; for (let y = 5; y <= 8; y++) { set(ground, 2, y, "6"); set(ground, 3, y, "6"); }
  set(ground, w - 3, 2, "8");
  const solid = (x, y) => set(coll, x, y, "1");
  solid(3, 1); solid(7, 1);                                  // the gate's posts
  solid(6, 4); solid(7, 4);                                  // the hut; its door opens onto 7,5
  solid(1, 1);                                               // the sign
  const M = {
    format: 1, id: full ? "synthetic-full" : "synthetic", tile: T, w, h, ground, height,
    coll: { values: [0, 1], rows: coll },
    footBlock: [[6 * T + 3, 5 * T + 2, 4]],
    shapes: {
      coast: JSON.parse(JSON.stringify(HOME.shapes.coast)), terraces: JSON.parse(JSON.stringify(HOME.shapes.terraces)), pond: JSON.parse(JSON.stringify(HOME.shapes.pond)),
      plaza: { type: "disc", x: 5.5, y: 6.5, r: 1.5 },
      curves: [{ kind: "river", w: [1.4, 1.3], pts: [[1, 1], [4, 6]] }, { kind: "road", w: 1.2, pts: [[5, 6], [8, 6]] }],
      volcano: { x: -400, y: -400, R: 60, H: 50, sq: 1.65, rc: 12 }
    },
    buildings: [{ id: "hut", x0: 6, y0: 4, w: 2, h: 1, room: "hut" }],
    stations: { sign: [1, 1] },
    anchors: { spawn: [5 * T + 8, 6 * T + 12], helipad: [w - 3, 2], dock, gate: [5, 1] },
    props: []
  };
  if (full) {
    M.source = "715450d4c6efca6a24f7cf21e64fdd25ad38eaba";
    M.shapes.woods = [[3, 3, 2, 0.3]];
    M.decals = { bones: [40, 40], tracks: { x: 1, dx: 1.3, y: 8.5, n: 4 } };
    solid(9, 7); solid(8, 8);
    for (let x = 0; x <= 2; x++) for (let y = h - 3; y <= h - 1; y++) if (x === 0 || x === 2 || y === h - 3 || y === h - 1) solid(x, y);
    for (const [x, y] of [[8, 5], [9, 5], [10, 5], [8, 6], [8, 7], [10, 7]]) solid(x, y);      // the compound's walls (9,7 is the oak; 10,6 the gate)
    M.regions = { paddocks: [["pen", 0, h - 3, 2, h - 1]], compound: { x0: 8, y0: 5, x1: 10, y1: 7, gate: [6] } };
    M.props = [{ kind: "e:oak1", tx: 9, ty: 7, flip: true, ox: -2, oy: 1.5 }, { tx: 1, ty: 6, flip: false, ox: 0, oy: -0.5, kind: "e:fern0" }, { kind: "e:nest0", tx: 8, ty: 8, eggs: 3 }, { kind: "e:lilies0", tx: 4, ty: 7, flip: true, ox: -2, oy: 0, flat: true }];
    // B0 placements: two roam areas with the same box stay two areas; a zone edge may be fractional, or the map's edge
    Object.assign(M.anchors, { car: [8, 3], rex: [4, 6], gardener: [5, 7], firstVisit: [5, 6], arena: [6, 7], coreApproach: [6, 8] });
    M.regions.roamAreas = [{ id: "pen-a", box: [0, 7, 2, 9] }, { id: "meadow-1", box: [4, 5, 8, 8] }, { id: "meadow-2", box: [4, 5, 8, 8] }];
    M.regions.zones = { roar: [1, 6.5, 4, 9], flies: [0, 0, 12, 10] };
    M.spawns = [{ kind: "trex", at: [1, 8], roam: "pen-a" }, { kind: "para", at: [5, 6], roam: "meadow-1" }, { kind: "para", at: [6, 6], roam: "meadow-2" }, { kind: "stego", at: [7, 6], roam: "meadow-1" }];
    M.routes = { patrol: { start: [5, 6], stops: [[4, 6], [8, 7]] } };
    M.places = { plaza: [5, 6], gate: [5, 2] };
  }
  return M;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const edit = (fn) => { const M = clone(synth(12, 10, true)); fn(M); return M; };
const setc = (rows, x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const PY = 6 * T + 3;

const INVALID = [
  ["no map", undefined, /^no map/],
  ["the map isn't an object", [1, 2], /^no map/],
  ["an unknown top-level field", edit((M) => { M.colour = "red"; }), /^the map has an unknown field colour$/],
  ["wrong format", edit((M) => { M.format = 2; }), /^format 2 isn't supported \(this code reads format 1\)$/],
  ["invalid id", edit((M) => { M.id = "Home Island"; }), /^id must be a short lowercase name/],
  ["source that isn't a commit", edit((M) => { M.source = "715450d"; }), /^source must be a 40-character git commit$/],
  ["wrong tile size", edit((M) => { M.tile = 32; }), /^tile must be 16/],
  ["zero width", edit((M) => { M.w = 0; }), /^w must be a whole number from 1 to 256$/],
  ["negative height", edit((M) => { M.h = -10; }), /^h must be a whole number from 1 to 256$/],
  ["fractional width", edit((M) => { M.w = 12.5; }), /^w must be a whole number from 1 to 256$/],
  ["too wide (300)", edit((M) => { M.w = 300; }), /^w must be a whole number from 1 to 256$/],
  ["ground: a row missing", edit((M) => { M.ground.pop(); }), /^ground must have 10 rows$/],
  ["ground: a row too short", edit((M) => { M.ground[2] = M.ground[2].slice(1); }), /^ground row 2 must be 12 long, not 11$/],
  ["ground: an unknown code", edit((M) => { setc(M.ground, 4, 0, "b"); }), /^ground row 0 has "b" at 4 \(0 to a\)$/],
  ["height: 6", edit((M) => { setc(M.height, 3, 3, "6"); }), /^height row 3 has "6" at 3 \(0 to 5\)$/],
  ["coll: missing", edit((M) => { delete M.coll; }), /^coll must be \{ values, rows \}$/],
  ["coll: a value twice in the palette", edit((M) => { M.coll.values = [0, 0]; }), /^coll\.values has 0 twice$/],
  ["coll: an unknown bit", edit((M) => { M.coll.values = [0, 2048]; }), /^coll\.values\[1\] must be a whole number from 0 to 1023$/],
  ["coll: an empty palette", edit((M) => { M.coll.values = []; }), /^coll\.values must hold 1 to 36 values$/],
  ["coll: an index past the palette", edit((M) => { setc(M.coll.rows, 5, 5, "2"); }), /^coll row 5 has "2" at 5 \(0 to 1\)$/],
  ["footBlock: not a list", edit((M) => { M.footBlock = {}; }), /^footBlock must be a list$/],
  ["footBlock: an entry with no runs", edit((M) => { M.footBlock = [[PY]]; }), /^footBlock entry 0 must be \[py, x0, n, \.\.\.\]$/],
  ["footBlock: a half run", edit((M) => { M.footBlock = [[PY, 82, 4, 90]]; }), /^footBlock entry 0 must be \[py, x0, n, \.\.\.\]$/],
  ["footBlock: overlapping runs", edit((M) => { M.footBlock = [[PY, 82, 4, 84, 2]]; }), /^footBlock row 99: the run at 84 overlaps or touches the one before/],
  ["footBlock: touching runs", edit((M) => { M.footBlock = [[PY, 82, 4, 86, 2]]; }), /^footBlock row 99: the run at 86 overlaps or touches the one before/],
  ["footBlock: runs out of order", edit((M) => { M.footBlock = [[PY, 90, 2, 82, 2]]; }), /^footBlock row 99: the run at 82 overlaps or touches the one before/],
  ["footBlock: the same row twice", edit((M) => { M.footBlock = [[PY, 82, 2], [PY, 90, 2]]; }), /^footBlock rows must go up: row 99 comes after 99$/],
  ["footBlock: rows going down", edit((M) => { M.footBlock = [[PY + 1, 82, 2], [PY, 90, 2]]; }), /^footBlock rows must go up: row 99 comes after 100$/],
  ["footBlock: a run off the map", edit((M) => { M.footBlock = [[PY, 12 * T - 2, 4]]; }), /^footBlock row 99: the run at 190 runs off the map$/],
  ["footBlock: a row off the map", edit((M) => { M.footBlock = [[10 * T, 82, 2]]; }), /^footBlock entry 0 row must be a whole number from 0 to 159$/],
  ["footBlock: a zero-length run", edit((M) => { M.footBlock = [[PY, 82, 0]]; }), /^footBlock row 99 run length must be a whole number from 1 to 192$/],
  ["footBlock: a fractional start", edit((M) => { M.footBlock = [[PY, 82.5, 2]]; }), /^footBlock row 99 run start must be a whole number/],
  ["footBlock: a pixel coll already blocks (the hut)", edit((M) => { M.footBlock = [[4 * T + 2, 6 * T + 1, 2]]; }), /^footBlock pixel 97,66 is on tile 6,4, which coll already blocks$/],
  ["a building off the map", edit((M) => { M.buildings[0].x0 = 11; }), /^building hut w must be a whole number from 1 to 1$/],
  ["a building twice", edit((M) => { M.buildings.push(clone(M.buildings[0])); }), /^building hut appears twice$/],
  ["a building with no id", edit((M) => { delete M.buildings[0].id; }), /^building 0 needs an id/],
  ["a building that isn't solid", edit((M) => { setc(M.coll.rows, 7, 4, "0"); }), /^building hut: its footprint tile 7,4 isn't solid in coll$/],
  ["a building whose door is blocked", edit((M) => { setc(M.coll.rows, 7, 5, "1"); }), /^building hut: its doorway 7,5 \(where pi comes out\) can't be walked$/],
  ["a station off the map", edit((M) => { M.stations.sign = [12, 1]; }), /^station sign x must be a whole number from 0 to 11$/],
  ["a station with a bad id", edit((M) => { M.stations["Sign Post"] = [1, 1]; }), /^station Sign Post: the id must be a short lowercase name$/],
  ["a station on land that isn't solid", edit((M) => { M.stations.sign = [4, 4]; }), /^station sign stands on land at 4,4 but that tile isn't solid in coll$/],
  ["spawn off the map", edit((M) => { M.anchors.spawn = [-1, 50]; }), /^anchors\.spawn \(world px\) is off the map$/],
  ["spawn on a tile that can't be walked", edit((M) => { M.anchors.spawn = [6 * T + 8, 4 * T + 8]; }), /^anchors\.spawn is on a tile that can't be walked/],
  ["helipad off the map", edit((M) => { M.anchors.helipad = [11, 2]; }), /^anchors\.helipad x must be a whole number from 1 to 10$/],
  ["helipad not on a pad", edit((M) => { M.anchors.helipad = [5, 5]; }), /^anchors\.helipad 5,5 isn't on a pad tile in ground$/],
  ["dock with no dock tiles", edit((M) => { M.anchors.dock = [5, 4]; }), /^anchors\.dock 5,4: the 2 x 4 tiles below it must be dock in ground$/],
  ["gate off the map", edit((M) => { M.anchors.gate = [1, 1]; }), /^anchors\.gate x must be a whole number from 2 to 9$/],
  ["gate with an open post", edit((M) => { setc(M.coll.rows, 7, 1, "0"); }), /^anchors\.gate 5,1: its two posts \(2 tiles either side\) must be solid in coll$/],
  ["an unknown anchor", edit((M) => { M.anchors.ferry = [1, 1]; }), /^anchors has an unknown field ferry$/],
  ["a paddock off the map", edit((M) => { M.regions.paddocks[0][3] = 12; }), /^regions\.paddocks\[0\] x1 must be a whole number from 1 to 11$/],
  ["a paddock fence that isn't solid", edit((M) => { setc(M.coll.rows, 1, 9, "0"); }), /^regions\.paddocks\[0\] \(pen\): its fence tile 1,9 isn't solid in coll$/],
  ["a compound wall that isn't solid", edit((M) => { setc(M.coll.rows, 8, 6, "0"); }), /^regions\.compound: its wall tile 8,6 isn't solid in coll$/],
  ["a compound gate outside the compound", edit((M) => { M.regions.compound.gate = [9]; }), /^regions\.compound\.gate\[0\] must be a whole number from 5 to 7$/],
  ["an unknown shape", edit((M) => { M.shapes.lake = {}; }), /^shapes has an unknown field lake$/],
  ["an unknown shape type", edit((M) => { M.shapes.coast.type = "contour"; }), /^shapes\.coast\.type "contour" isn't a known type \(harmonic-blob\)$/],
  ["a coast wave of one number", edit((M) => { M.shapes.coast.waves[1] = [2.2]; }), /^shapes\.coast\.waves\[1\] must be \[a, f\] or \[a, f, p\]$/],
  ["a coast centre that isn't a number", edit((M) => { M.shapes.coast.c = [48, "39"]; }), /^shapes\.coast\.c\[1\] must be a finite number$/],
  ["a coast ellipse of radius 0", edit((M) => { M.shapes.coast.union[0][2] = 0; }), /^shapes\.coast\.union\[0\] rx must be above 0$/],
  ["one terrace", edit((M) => { M.shapes.terraces.pop(); }), /^shapes\.terraces must be a list of 2$/],
  ["terraces the wrong way round", edit((M) => { M.shapes.terraces.reverse(); }), /^shapes\.terraces\[0\]\.level must be 2/],
  ["a ramp with direction 0", edit((M) => { M.shapes.terraces[0].ramps[0][1] = 0; }), /^shapes\.terraces\[0\]\.ramps\[0\] direction must be 1 or -1$/],
  ["a pond of negative radius", edit((M) => { M.shapes.pond.rx = -1; }), /^shapes\.pond\.rx must be above 0$/],
  ["a plaza radius that isn't a number", edit((M) => { M.shapes.plaza.r = null; }), /^shapes\.plaza\.r must be a finite number$/],
  ["a curve of an unknown kind", edit((M) => { M.shapes.curves[1].kind = "canal"; }), /^shapes\.curves\[1\]\.kind "canal" isn't a known kind \(river, road\)$/],
  ["a curve of one point", edit((M) => { M.shapes.curves[1].pts = [[5, 6]]; }), /^shapes\.curves\[1\]\.pts needs at least 2 points$/],
  ["a road before the river", edit((M) => { M.shapes.curves.reverse(); }), /^shapes\.curves\[1\]: rivers come before roads$/],
  ["a volcano crater wider than the cone", edit((M) => { M.shapes.volcano.rc = 70; }), /^shapes\.volcano\.rc must be smaller than R$/],
  ["a volcano over open ground", edit((M) => { M.shapes.volcano.x = 5 * T + 8; M.shapes.volcano.y = 6 * T + 8; }), /^tile \d+,\d+ is under the volcano but isn't solid in coll$/],
  ["woods with a bad entry", edit((M) => { M.shapes.woods[0] = [3, 3]; }), /^shapes\.woods\[0\] must be a list of 4$/],
  ["tracks with a fractional count", edit((M) => { M.decals.tracks.n = 2.5; }), /^decals\.tracks\.n must be a whole number from 0 to 1000$/],
  ["a prop that isn't an object", edit((M) => { M.props[1] = "e:fern0"; }), /^prop 1 must be an object$/],
  ["a prop with no kind", edit((M) => { delete M.props[0].kind; }), /^prop 0 needs a kind/],
  ["a prop kind with a space", edit((M) => { M.props[0].kind = "e:oak 1"; }), /^prop 0 needs a kind/],
  ["a prop off the map", edit((M) => { M.props[1].tx = 12; }), /^prop 1 \(e:fern0\) tx must be a whole number from 0 to 11$/],
  ["a prop with a fractional tile", edit((M) => { M.props[1].ty = 6.5; }), /^prop 1 \(e:fern0\) ty must be a whole number from 0 to 9$/],
  ["a prop with no tile", edit((M) => { delete M.props[1].ty; }), /^prop 1 \(e:fern0\) needs tx and ty$/],
  ["a prop with an unknown field", edit((M) => { M.props[1].fliped = true; }), /^prop 1 \(e:fern0\) has an unknown field fliped$/],
  ["a prop flip that isn't true or false", edit((M) => { M.props[0].flip = 1; }), /^prop 0 \(e:oak1\) flip must be true or false$/],
  ["a prop offset of 40 px", edit((M) => { M.props[0].ox = 40; }), /^prop 0 \(e:oak1\) ox must be a number of px from -16 to 16$/],
  ["a nest of 2.5 eggs", edit((M) => { M.props[2].eggs = 2.5; }), /^prop 2 \(e:nest0\) eggs must be a whole number from 0 to 9$/],
  ["a tree on a tile that isn't solid", edit((M) => { M.props[0].tx = 4; }), /^prop 0 \(e:oak1\) at 4,7 stands in pi's way, but that tile isn't solid in coll$/],
  // B0 placements
  ["spawns that aren't a list", edit((M) => { M.spawns = {}; }), /^spawns must be a list$/],
  ["a spawn that isn't an object", edit((M) => { M.spawns[0] = "trex"; }), /^spawns\[0\] must be \{ kind, at, roam \}$/],
  ["a spawn with an unknown field", edit((M) => { M.spawns[0].speed = 1; }), /^spawns\[0\] has an unknown field speed$/],
  ["a spawn of an unknown creature", edit((M) => { M.spawns[1].kind = "unicorn"; }), /^spawns\[1\]\.kind "unicorn" isn't a known creature$/],
  ["a spawn off the map", edit((M) => { M.spawns[0].at = [12, 8]; }), /^spawns\[0\]\.at x must be a whole number from 0 to 11$/],
  ["a spawn on a fractional tile", edit((M) => { M.spawns[0].at = [1, 8.5]; }), /^spawns\[0\]\.at y must be a whole number from 0 to 9$/],
  ["a spawn naming a roam area that isn't there", edit((M) => { M.spawns[2].roam = "meadow-9"; }), /^spawns\[2\]\.roam "meadow-9" isn't in regions\.roamAreas$/],
  ["a spawn with no roam area", edit((M) => { delete M.spawns[3].roam; }), /^spawns\[3\]\.roam undefined isn't in regions\.roamAreas$/],
  ["a roam area id twice", edit((M) => { M.regions.roamAreas[2].id = "meadow-1"; }), /^regions\.roamAreas: meadow-1 appears twice$/],
  ["a roam area with no id", edit((M) => { delete M.regions.roamAreas[0].id; }), /^regions\.roamAreas\[0\] needs an id/],
  ["a roam area with an unknown field", edit((M) => { M.regions.roamAreas[0].herd = true; }), /^regions\.roamAreas\[0\] has an unknown field herd$/],
  ["a roam box off the map", edit((M) => { M.regions.roamAreas[0].box = [0, 7, 2, 10]; }), /^regions\.roamAreas pen-a y1 must be a whole number from 7 to 9$/],
  ["a roam box inside out", edit((M) => { M.regions.roamAreas[1].box = [4, 5, 3, 8]; }), /^regions\.roamAreas meadow-1 x1 must be a whole number from 4 to 11$/],
  ["a roam box of three numbers", edit((M) => { M.regions.roamAreas[1].box = [4, 5, 8]; }), /^regions\.roamAreas meadow-1 box must be a list of 4$/],
  ["zones that aren't an object", edit((M) => { M.regions.zones = [[1, 1, 2, 2]]; }), /^regions\.zones must be an object/],
  ["a zone of three numbers", edit((M) => { M.regions.zones.roar = [1, 6.5, 4]; }), /^regions\.zones\.roar must be a list of 4$/],
  ["a zone edge that isn't a number", edit((M) => { M.regions.zones.roar = [1, "6.5", 4, 9]; }), /^regions\.zones\.roar\[1\] must be a finite number$/],
  ["a zone past the map's edge", edit((M) => { M.regions.zones.roar = [1, 6.5, 4, 10.5]; }), /^regions\.zones\.roar must lie inside the map \(0 to 12, 0 to 10\)$/],
  ["a zone inside out", edit((M) => { M.regions.zones.roar = [4, 6.5, 1, 9]; }), /^regions\.zones\.roar must have x0 <= x1 and y0 <= y1$/],
  ["a zone with a bad id", edit((M) => { M.regions.zones["Roar Zone"] = [1, 1, 2, 2]; }), /^regions\.zones\.Roar Zone: the id must be a short lowercase name$/],
  ["a route of one stop", edit((M) => { M.routes.patrol.stops = [[4, 6]]; }), /^routes\.patrol\.stops needs at least 2 stops$/],
  ["a route stop off the map", edit((M) => { M.routes.patrol.stops[1] = [12, 7]; }), /^routes\.patrol\.stops\[1\] x must be a whole number from 0 to 11$/],
  ["a route start that isn't a tile", edit((M) => { M.routes.patrol.start = [5]; }), /^routes\.patrol\.start must be a list of 2$/],
  ["a route with an unknown field", edit((M) => { M.routes.patrol.loop = true; }), /^routes\.patrol has an unknown field loop$/],
  ["a route with no stops", edit((M) => { delete M.routes.patrol.stops; }), /^routes\.patrol\.stops must be a list$/],
  ["a route with a bad id", edit((M) => { M.routes["Patrol A"] = M.routes.patrol; }), /^routes\.Patrol A: the id must be a short lowercase name$/],
  ["a place that isn't a tile", edit((M) => { M.places.plaza = [5]; }), /^places\.plaza must be a list of 2$/],
  ["a place off the map", edit((M) => { M.places.plaza = [5, 10]; }), /^places\.plaza y must be a whole number from 0 to 9$/],
  ["a place with a bad name", edit((M) => { M.places["Town Square"] = [5, 6]; }), /^places\.Town Square: the name must be a short lowercase name$/],
  ["a car anchor off the map", edit((M) => { M.anchors.car = [12, 3]; }), /^anchors\.car x must be a whole number from 0 to 11$/],
  ["an arena anchor of one number", edit((M) => { M.anchors.arena = [6]; }), /^anchors\.arena must be a list of 2$/],
  ["a first-visit anchor on a fractional tile", edit((M) => { M.anchors.firstVisit = [5.5, 6]; }), /^anchors\.firstVisit x must be a whole number from 0 to 11$/],
  ["a rex anchor that isn't a number", edit((M) => { M.anchors.rex = [4, null]; }), /^anchors\.rex\[1\] must be a finite number$/],
  ["a core approach on a fractional tile", edit((M) => { M.anchors.coreApproach = [6, 8.5]; }), /^anchors\.coreApproach y must be a whole number from 0 to 9$/],
  ["a core approach with no arena", edit((M) => { delete M.anchors.arena; }), /^anchors\.coreApproach needs anchors\.arena$/],
  ["a core approach left behind by the arena (arena 6,7 moved to 3,7)", edit((M) => { M.anchors.arena = [3, 7]; }), /^anchors\.coreApproach 6,8 isn't next to anchors\.arena 3,7$/],
  ["a core approach on a blocked tile", edit((M) => { setc(M.coll.rows, 6, 8, "1"); }), /^anchors\.coreApproach 6,8 is on a tile that can't be walked$/]
];

const PORT = 9300 + Math.floor(Math.random() * 90), server = await serve(PORT);
let failed = false, blocked = [];
const check = (eng, what, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${eng.padEnd(8)} ${what}${!ok && detail ? ": " + detail : ""}`); if (!ok) failed = true; };
for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch`); blocked.push(name); continue; }
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?debug=1&step=1#island`);
  await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 60000 });
  const dec = (m) => page.evaluate((x) => { try { return { ok: window.__island.decodeMap(x) }; } catch (e) { return { err: e.message }; } }, m);
  // valid maps, each decoded from a deep-frozen copy (so a write would throw), and unchanged afterwards
  const VALID = [["the real home map", HOME, { id: "home", w: 100, h: 80, footPixels: 3773, props: 753, buildings: 3, stations: 11, curves: 15, spawns: 33, creatureKinds: true,
      roamAreas: (v) => v.length === 28 && new Set(v.map((r) => r.split(":")[0])).size === 28 && new Set(v.map((r) => r.split(":")[1])).size < 28,
      zones: ["trex-roar", "fireflies", "rex-meadow", "gardener-beds", "cockatiel-trees"], routes: ["welder-patrol"], places: ["pond", "gate", "plaza", "car", "paddock", "raptors", "volcano", "outpost", "shrine", "clearing"],
      anchors: ["spawn", "helipad", "dock", "gate", "car", "rex", "gardener", "firstVisit", "arena", "coreApproach"] }],
    ["minimal 12 x 10, optional fields left out (no placements either)", synth(12, 10, false), { w: 12, h: 10, footPixels: 4, props: 0, paddocks: 0, compound: false, spawns: 0, roamAreas: [], zones: [], routes: [], places: [], anchors: ["spawn", "helipad", "dock", "gate"] }],
    ["representative 12 x 10 (props, regions, decals, woods, source, placements; two roam areas share a box and stay two)", synth(12, 10, true), { props: 4, paddocks: 1, compound: true, source: "715450d4c6efca6a24f7cf21e64fdd25ad38eaba",
      spawns: 4, roamAreas: ["pen-a:0,7,2,9", "meadow-1:4,5,8,8", "meadow-2:4,5,8,8"], zones: ["roar", "flies"], routes: ["patrol"], places: ["plaza", "gate"] }],
    ["a static helipad place (an ordinary name to the format; only the home map leaves heli and helipad out)", edit((M) => { M.places.helipad = [5, 6]; M.places.heli = [6, 6]; }), { places: ["plaza", "gate", "helipad", "heli"] }],
    ["150 x 120, decode only", synth(150, 120, true), { w: 150, h: 120, ground: 18000, footWords: 144000, props: 4 }]];
  for (const [what, M, want] of VALID) {
    const r = await page.evaluate((x) => {
      const before = JSON.stringify(x);
      (function freeze(o) { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(freeze); } })(x);
      try { const s = window.__island.decodeMap(x); return { s, same: JSON.stringify(x) === before }; } catch (e) { return { err: e.message }; }
    }, M);
    const ok = !r.err && r.same && Object.entries(want).every(([k, v]) => typeof v === "function" ? v(r.s[k]) : Array.isArray(v) ? JSON.stringify(r.s[k]) === JSON.stringify(v) : r.s[k] === v);
    check(name, `valid: ${what}${r.s ? ` (${r.s.w} x ${r.s.h}, ${r.s.footPixels} footBlock px, ${r.s.props} props)` : ""}; input unchanged`, ok, r.err || JSON.stringify({ got: r.s, want, same: r.same }));
  }
  let n = 0;
  for (const [what, M, re] of INVALID) {
    const r = await dec(M);
    const ok = !!r.err && re.test(r.err); n += ok ? 1 : 0;
    check(name, `refused: ${what}  ->  "${r.err}"`, ok, r.err ? `wanted ${re}` : "it decoded");
  }
  check(name, `all ${INVALID.length} faulty maps refused, each naming the field`, n === INVALID.length);
  check(name, "no page errors", !errors.length, errors.join(" | "));
  await browser.close();
}
server.close();
console.log(failed ? "\nFAILED" : `\nnothing failed${blocked.length ? "; blocked: " + blocked.join(", ") : ""}`);
process.exit(failed ? 1 : blocked.length ? 2 : 0);
