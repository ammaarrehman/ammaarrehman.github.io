#!/usr/bin/env node
/* map-export (MAP-A1): writes js/maps/home.js, the authored data for today's island, from the
   procedural island in js/world.js at 715450d (the last revision that generated it). It runs that
   revision in each engine with read-only hooks, takes what the build produced, and checks it.

   What it takes:
   - the tile layers as the build left them: GROUND, HEIGHT and the final COLL (after every rule,
     the post-paint one included);
   - footBlock: the per-pixel foot blocking on top of COLL. For every pixel of a tile COLL lets feet
     onto, the old solidPx() is asked whether feet stop there; those pixels, as runs per pixel row.
     It comes from the old gameplay answer, never from colours, so the rule
       solidPx(px, py) = tile blocked by COLL || footBlock has the pixel
     equals the old solidPx() at all 2,048,000 pixels (checked below, both engines);
   - every prop, each field and the list's order (JSON drops the sign of a -0 offset; every reader
     uses p.ox || 0, so it reads the same);
   - outdoor station positions, building footprints and doors, spawn, helipad, dock, gate, paddocks,
     the outpost compound;
   - the shapes the painter reads: coast, terrace edges, pond, plaza, river and road curves, volcano,
     the woods, two ground decals. These are the old formulas with their numbers. They are legacy
     parity types for this island, not how a new island has to be authored. Their numbers are written
     out below and checked two ways: the reference source must still hold the exact code they came
     from, and evaluated from the data they must equal the old functions bit for bit at every point
     the game samples them.

   - B0, the placements the game still kept as literals: the creature spawns in order (kind, the start
     tile as passed to critter(), and the roam area object itself, so creatures that share one area object
     share one roam-area record and every other area gets its own, even where two boxes match); the
     welder's patrol; the car, rex, the gardener, the first-visit spot and the arena as tiles; the goto
     places that have a fixed spot (heli and helipad follow the helicopter and have none); and five zones
     (the t-rex's roar, the fireflies, rex's meadow, the gardener's beds, the cockatiel trees). The ones
     the game reads as variables are read from the running island; the ones that are only literals in
     code are written out below and the reference must hold that exact code. Derived, not stored: the
     cargo stops (the depot and visitor centre doorways) and the drone pad (the depot's roof).

   - After B0, one placement that is authored here and doesn't come from the reference: the core approach
     (anchors.coreApproach), the target a tap on the core plans toward (the loose landmark planner may stop pi
     on a tile next to it). At the reference that goal is a stale
     literal (36,26) left over from when the arena was at 36,25; it is one row south of the arena, the side
     the core is used from, and is written out below for the arena where it is now.

   Nothing else: no prose, no ctf data, no creature behaviour or quests.

     node tools/map-export.mjs            export, check, write js/maps/home.js
     node tools/map-export.mjs --check    export and check, compare with the file, write nothing
     ENGINES=chromium,webkit (default)    every engine must produce the same bytes */
import { chromium, firefox, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serve } from "./serve.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = "715450d";                                    // the input ref; the file records the full SHA
const INTENDED = "715450d";                               // the last revision that generated the island
const OUTFILE = join(ROOT, "js/maps/home.js");
const CHECK_ONLY = process.argv.includes("--check");
const ENGINES = (process.env.ENGINES || "chromium,webkit").split(",");
const fail = (msg) => { console.error("map-export: " + msg); process.exit(1); };

let SOURCE;
try { SOURCE = execFileSync("git", ["rev-parse", "--verify", `${REF}^{commit}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
catch (e) { fail(`can't resolve ${REF} to a commit`); }
if (!/^[0-9a-f]{40}$/.test(SOURCE) || !SOURCE.startsWith(INTENDED)) fail(`${REF} resolves to ${SOURCE}, not the intended historical commit ${INTENDED}`);
let src;
try { src = execFileSync("git", ["show", `${SOURCE}:js/world.js`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { fail(`can't load js/world.js at ${REF} (${e.message.split("\n")[0]})`); }

/* the code the written-out numbers come from. if the reference stops holding any of it, stop */
const ASSUME = [
  "var T = 16, MW = 100, MH = 80, CX = 48, CY = 40, DOCKX = 51;",
  "var a = Math.atan2(y - 39, (x - 48) / 1.32), d = Math.hypot((x - 48) / 1.32, y - 39);",
  "var v = d / (28 + 2.2 * Math.sin(3 * a + 1.1) + 1.6 * Math.sin(5 * a + 2.3) + 1.0 * Math.sin(7 * a + 0.4) + 0.6 * Math.sin(11 * a + 1.7));",
  "v = Math.min(v, Math.hypot((x - 84) / 10, (y - 37) / 5.6));",
  "v = Math.min(v, Math.hypot((x - 21) / 12, (y - 61) / 8.5));",
  "return Math.max(v, 1.9 - Math.hypot((x - 52) / 6.4, (y - 69.5) / 5.4));",
  "function hiEdge(x) { return 26.5 + 3.2 * Math.sin(x * 0.13 + 0.6) + 1.6 * Math.sin(x * 0.37 + 2.1) - Math.max(0, x - 68) * 0.55 - Math.max(0, 24 - x) * 0.5; }",
  "function midEdge(x) { return 55 + 2.6 * Math.sin(x * 0.17 + 1.3) + 1.4 * Math.sin(x * 0.41) - (x - 48) * 0.1; }",
  "function tier(x, y) { return y < hiEdge(x) ? 2 : y < midEdge(x) ? 1 : 0; }",
  "return Math.sqrt(dx * dx + dy * dy) / (1 + 0.13 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + 2.1) + 0.05 * Math.sin(7 * a));",
  "carve(RIVER_PTS, function (q) { return 1.4 + q * 1.3; },",
  "[[hiEdge, 17], [midEdge, 29]].forEach(function (E) {",
  "if (fhc >= 4) face(px, py + 1, fhc, 41);",
  "})(31 * T + 2, 50 * T + 4);",
  "for (var ft = 0; ft < 11; ft++) {",
  "var fx0 = Math.round((30 + ft * 1.3) * T + (ft % 2) * 6), fy0 = Math.round((65.4 + Math.sin(ft * 0.6) * 0.5) * T);",
  "return !walkable(tx, ty) || (GK && tt !== BRIDGE && tt !== DOCK && kAt(Math.floor(px), Math.floor(py)) === KW);",
  "var SPAWN = { x: 46 * T + 8, y: 60 * T + 12 };",
  "var C_SOLID = 1, C_SHALLOW = 2, C_DEEP = 4, C_LOW = 8, C_LEDGE_N = 16, C_LEDGE_E = 32, C_LEDGE_S = 64, C_LEDGE_W = 128, C_LAVA = 256, C_CLIMB = 512;",
  // B0: placements that exist only as literals in code
  "if (first) { pi.x = 50 * T + 8; pi.y = 61 * T + 10; if (!walkable(50, 61)) { pi.x = SPAWN.x; pi.y = SPAWN.y; } }",
  "pi.x < 42 * T && pi.x > 25 * T && pi.y > 41.5 * T && pi.y < 56 * T",
  "var fx0 = 11 + hash(fi, 71) * 18, fy0 = 30 + hash(71, fi) * 20;",
  "var tx = 38 + Math.floor(rand() * 12), ty = 60 + Math.floor(rand() * 3);",
  "Math.abs(p2.tx - 46) < 12 && Math.abs(p2.ty - 58) < 8",
  "Math.abs(p.tx - 36) < 9 && Math.abs(p.ty - 29) < 8",
  // and what stayed code: the core tap's stale goal (anchors.coreApproach, written out below, replaces it);
  // the drone pad and cargo stops (derived)
  'hit.id === "core" ? [36, 26]',
  "var pad = { x: 54.5 * T, y: 58 * T + 6, roof: 30 };",
  "var DOCKPT = [DOCKX, dockY], DEPOTPT = [54, 60], VISITPT = [41, 60];"
];
const missing = ASSUME.filter((s) => !src.includes(s));
if (missing.length) fail(`${REF} no longer matches what this exporter assumes:\n  ` + missing.join("\n  "));

/* the shapes, written out from the code above */
const SHAPES = {
  coast: { type: "harmonic-blob", c: [48, 39], sx: 1.32, r: 28, waves: [[2.2, 3, 1.1], [1.6, 5, 2.3], [1.0, 7, 0.4], [0.6, 11, 1.7]],
           union: [[84, 37, 10, 5.6], [21, 61, 12, 8.5]], cut: [[52, 69.5, 6.4, 5.4, 1.9]], salt: 41 },
  terraces: [
    { level: 2, type: "sine-edge", base: 26.5, waves: [[3.2, 0.13, 0.6], [1.6, 0.37, 2.1]], ramps: [[68, 1, 0.55], [24, -1, 0.5]], salt: 17 },
    { level: 1, type: "sine-edge", base: 55, waves: [[2.6, 0.17, 1.3], [1.4, 0.41]], slope: [48, 0.1], salt: 29 }
  ],
  pondWaves: [[0.13, 3, 0.8], [0.08, 5, 2.1], [0.05, 7]],
  riverWidth: [1.4, 1.3]
};
const DECALS = { bones: [498, 804], tracks: { x: 30, dx: 1.3, y: 65.4, n: 11 } };
/* B0: the zones and the first-visit spot, written out from the code above. a zone is [x0, y0, x1, y1] in
   tiles; how its edges count stays with the system reading it:
   - trex-roar: pi strictly inside, in world px (x > 25 T, x < 42 T, y > 41.5 T, y < 56 T)
   - fireflies: x0 + hash * (x1 - x0), y0 + hash * (y1 - y0) (11 + hash * 18, 30 + hash * 20)
   - rex-meadow: whole tiles x0 to x1, y0 to y1 (38 + floor(rand * 12), 60 + floor(rand * 3))
   - gardener-beds, cockatiel-trees: props on whole tiles x0 to x1, y0 to y1 (|tx - 46| < 12, |ty - 58| < 8;
     |tx - 36| < 9, |ty - 29| < 8) */
const ZONES = { "trex-roar": [25, 41.5, 42, 56], "fireflies": [11, 30, 29, 50], "rex-meadow": [38, 60, 49, 62], "gardener-beds": [35, 51, 57, 65], "cockatiel-trees": [28, 22, 44, 36] };
const FIRST_VISIT = [50, 61];
/* the core approach: the target pi heads for to use the core (pi may stop next to it, as at any landmark). the core floats 34 px over the arena's centre
   (48,43) and is used from the south, as it always was (arena 28,19, goal 28,20; arena 36,25, goal 36,26);
   the clearing round it is open grass */
const CORE_APPROACH = [48, 44];

/* the evaluators: the data-driven form of each old function, in the same operations in the same order.
   a wave [a, f, p] adds a * sin(x * f + p); [a, f] adds a * sin(x * f) */
const EVAL = String.raw`
  var MX = {
    wave: function (v, w, x) { return v + w[0] * Math.sin(w.length > 2 ? w[1] * x + w[2] : w[1] * x); },
    coast: function (S, x, y) {
      var a = Math.atan2(y - S.c[1], (x - S.c[0]) / S.sx), d = Math.hypot((x - S.c[0]) / S.sx, y - S.c[1]), r = S.r, i;
      for (i = 0; i < S.waves.length; i++) r = MX.wave(r, S.waves[i], a);
      var v = d / r;
      for (i = 0; i < S.union.length; i++) v = Math.min(v, Math.hypot((x - S.union[i][0]) / S.union[i][2], (y - S.union[i][1]) / S.union[i][3]));
      for (i = 0; i < S.cut.length; i++) v = Math.max(v, S.cut[i][4] - Math.hypot((x - S.cut[i][0]) / S.cut[i][2], (y - S.cut[i][1]) / S.cut[i][3]));
      return v;
    },
    edge: function (E, x) {
      var v = E.base, i;
      for (i = 0; i < E.waves.length; i++) { var w = E.waves[i]; v = v + w[0] * Math.sin(w.length > 2 ? x * w[1] + w[2] : x * w[1]); }
      if (E.ramps) for (i = 0; i < E.ramps.length; i++) { var q = E.ramps[i]; v = v - Math.max(0, q[1] > 0 ? x - q[0] : q[0] - x) * q[2]; }
      if (E.slope) v = v - (x - E.slope[0]) * E.slope[1];
      return v;
    },
    tier: function (terr, x, y) { for (var i = 0; i < terr.length; i++) if (y < MX.edge(terr[i], x)) return terr[i].level; return 0; },
    pond: function (P, fx, fy) {
      var dx = (fx - P.x) / P.rx, dy = (fy - P.y) / P.ry, a = Math.atan2(dy, dx), r = 1;
      for (var i = 0; i < P.waves.length; i++) r = MX.wave(r, P.waves[i], a);
      return Math.sqrt(dx * dx + dy * dy) / r;
    },
    curves: function (list) {
      var out = { river: [], road: [] };
      list.forEach(function (c) {
        var pts = c.pts, push = function (fx, fy, q) { var wd = typeof c.w === "number" ? c.w : c.w[0] + q * c.w[1]; out[c.kind].push([fx, fy, wd / 2]); };
        for (var i = 0; i < pts.length - 1; i++) {
          var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
          for (var u = 0; u < 1; u += 0.04) {
            var u2 = u * u, u3 = u2 * u;
            push(0.5 * (2 * p1[0] + (p2[0] - p0[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * u3),
                 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * u3), (i + u) / (pts.length - 1));
          }
        }
        var e = pts[pts.length - 1]; push(e[0], e[1], 1);
      });
      return out;
    }
  };
`;

/* the decoder for the collision part: rows of palette characters and footBlock runs back into COLL
   and a per-pixel foot block, with every canonical rule checked. returns { coll, foot } or throws */
const DECODE = String.raw`
  function decodeCollision(M, BLOCK, groundAt) {
    var w = M.w, h = M.h, T = M.tile, PW = w * T, PH = h * T, coll = new Uint16Array(w * h), foot = new Uint8Array(PW * PH), y, x;
    if (M.coll.rows.length !== h) throw new Error("coll: " + M.coll.rows.length + " rows, want " + h);
    for (y = 0; y < h; y++) {
      var row = M.coll.rows[y]; if (row.length !== w) throw new Error("coll row " + y + ": length " + row.length);
      for (x = 0; x < w; x++) { var k = parseInt(row.charAt(x), 36); if (!(k < M.coll.values.length)) throw new Error("coll row " + y + ": bad character"); coll[y * w + x] = M.coll.values[k]; }
    }
    var lastY = -1;
    M.footBlock.forEach(function (r) {
      var py = r[0]; if (!(py > lastY) || py >= PH || r.length < 3 || r.length % 2 !== 1) throw new Error("footBlock: bad row entry at " + py);
      lastY = py; var end = -1;
      for (var i = 1; i < r.length; i += 2) {
        var x0 = r[i], n = r[i + 1];
        if (!(Number.isInteger(x0) && Number.isInteger(n)) || n < 1 || x0 <= end || x0 + n > PW) throw new Error("footBlock: row " + py + " run " + x0 + "+" + n + " overlaps, touches the last run or leaves the map");
        for (var px = x0; px < x0 + n; px++) {
          var ti = (py / T | 0) * w + (px / T | 0);
          if (coll[ti] & BLOCK) throw new Error("footBlock: pixel " + px + "," + py + " is on a tile COLL already blocks");
          var g = groundAt(ti); if (g === 10 || g === 6) throw new Error("footBlock: pixel " + px + "," + py + " is on a bridge or dock");
          foot[py * PW + px] = 1;
        }
        end = x0 + n;
      }
    });
    return { coll: coll, foot: foot };
  }
  function solidFrom(D, M, BLOCK, px, py) {
    var T = M.tile, tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return true;
    return !!(D.coll[ty * M.w + tx] & BLOCK) || D.foot[Math.floor(py) * M.w * T + Math.floor(px)] === 1;
  }
`;

const MARK = "  /* ════════ map ════════ */";
const CARVE = "  function carve(pts, width, paint, kind) {";
const PRECOLL = "  var C_SOLID = 1,";
const ANCHOR = "  if (DEBUG) window.__island = {";
const CRITTER = "  function critter(kind, tx, ty, area) {";
for (const a of [MARK, CARVE, PRECOLL, ANCHOR, CRITTER]) if (!src.includes(a)) fail(`${REF}: hook point missing: ${a.trim()}`);

const HOOK = String.raw`
  window.__mx = (function () {
    ${EVAL}
    ${DECODE}
    function u8(a) { return Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
    return {
      // everything the data is made of, read from the island just built
      read: function () {
        var X = window.__mapExport, i, rowsOf = function (A, f) { var r = []; for (var y = 0; y < MH; y++) { var s = ""; for (var x = 0; x < MW; x++) s += f(A[y * MW + x]); r.push(s); } return r; };
        var vals = []; for (i = 0; i < COLL.length; i++) if (vals.indexOf(COLL[i]) < 0) vals.push(COLL[i]);
        vals.sort(function (a, b) { return a - b; });
        if (vals.length > 36) throw new Error("more than 36 collision values");
        var foot = [], blockedFoot = 0, bd = { bridgeDockPx: 0, bridgeDockBlocked: 0 };
        for (var py = 0; py < PH; py++) {
          var runs = [py], x0 = -1;
          for (var px = 0; px <= PW; px++) {
            var on = false;
            if (px < PW) {
              var ti = (py >> 4) * MW + (px >> 4), tt = GROUND[ti];
              if (tt === BRIDGE || tt === DOCK) { bd.bridgeDockPx++; if (solidPx(px, py)) bd.bridgeDockBlocked++; }
              on = walkable(px >> 4, py >> 4) && solidPx(px, py);
            }
            if (on && x0 < 0) x0 = px;
            if (!on && x0 >= 0) { runs.push(x0, px - x0); blockedFoot += px - x0; x0 = -1; }
          }
          if (runs.length > 1) foot.push(runs);
        }
        var out = {
          w: MW, h: MH, tile: T,
          ground: rowsOf(GROUND, function (v) { return v.toString(16); }),
          height: rowsOf(HEIGHT, function (v) { if (v > 5) throw new Error("height above 5"); return String(v); }),
          coll: { values: vals, rows: rowsOf(COLL, function (v) { return vals.indexOf(v).toString(36); }) },
          footBlock: foot,
          carves: X.carves, propsBuilt: X.propsBuilt, propsNow: JSON.stringify(props),
          props: JSON.parse(JSON.stringify(props)),
          stations: STATIONS.filter(function (s) { return !s.room; }).map(function (s) { return [s.id, s.x, s.y]; }),
          buildings: BUILDINGS.map(function (b) { return { id: b.id, x0: b.x0, y0: b.y0, w: b.w, h: b.h, room: b.room }; }),
          spawn: [SPAWN.x, SPAWN.y], helipad: [HELI.x, HELI.y], dock: [DOCKX, dockY], gate: [GATE.x, GATE.y],
          plaza: PLAZA, pond: KP, volcano: VOLC, woods: FOREST_BIAS,
          paddocks: PADDOCKS.map(function (p) { return [p.name, p.x0, p.y0, p.x1, p.y1]; }), compound: COMPOUND,
          prose: STATIONS.map(function (s) { return s.text || ""; }).concat(BUILDINGS.map(function (b) { return b.text || ""; })),
          stats: { blockedFoot: blockedFoot, runs: foot.reduce(function (n, r) { return n + (r.length - 1) / 2; }, 0), rows: foot.length, bridgeDock: bd }
        };
        // B0: the spawns as critter() was called, with roam areas grouped by the area objects themselves
        var areas = [], sp = X.spawns || [];
        out.b0 = {
          spawns: sp.map(function (a, i) {
            var k = areas.indexOf(a[3]); if (k < 0) { k = areas.length; areas.push(a[3]); }
            return { kind: a[0], at: [a[1], a[2]], area: k, sameAsCritter: critters[i] && critters[i].kind === a[0] && critters[i].area === a[3] };
          }),
          critters: critters.length,
          pairs: (function () { var m = ""; for (var i = 0; i < critters.length; i++) for (var j = i + 1; j < critters.length; j++) m += critters[i].area === critters[j].area ? "1" : "0"; return m; })(),
          boxes: areas.map(function (a) { return a.slice(); }),
          px: { car: [car.x, car.y], rex: [rex.x, rex.y], arena: [ARENA.x, ARENA.y], welder: bots.filter(function (b) { return b.kind === "welder"; }).map(function (b) { return [b.x, b.y]; })[0],
                gardener: bots.filter(function (b) { return b.kind === "gardener"; }).map(function (b) { return [b.x, b.y]; })[0] },
          spots: bots.filter(function (b) { return b.kind === "welder"; })[0].spots,
          places: Object.keys(PLACES).map(function (k) { return [k, PLACES[k]]; }),
          cargo: { depot: DEPOTPT, visitor: VISITPT, legsShareStops: bots.filter(function (b) { return b.kind === "cargo"; }).every(function (b) { return b.legs.every(function (l) { return l === DOCKPT || l === DEPOTPT || l === VISITPT; }); }) },
          pad: [pad.x, pad.y, pad.roof],
          gardenerBeds: props.map(function (p, i) { return Math.abs(p.tx - 46) < 12 && Math.abs(p.ty - 58) < 8 ? i : -1; }).filter(function (i) { return i >= 0; }),
          cockatielTrees: props.map(function (p, i) { return Math.abs(p.tx - 36) < 9 && Math.abs(p.ty - 29) < 8 ? i : -1; }).filter(function (i) { return i >= 0; })
        };
        return out;
      },
      // the shapes from the data against the old functions, at every point the game asks them
      verify: function (S) {
        var bad = {}, n = {}, px, py, i;
        function cmp(k, a, b) { n[k] = (n[k] || 0) + 1; if (!Object.is(a, b)) bad[k] = (bad[k] || 0) + 1; }
        for (py = 0; py < PH; py++) for (px = 0; px < PW; px++) {
          var fx = (px + 0.5) / T, fy = (py + 0.5) / T;
          cmp("coast at pixel centres", MX.coast(S.coast, fx, fy), coast(fx, fy));
          cmp("pond at pixel centres", MX.pond(S.pond, fx, fy), pondF(fx, fy));
          if (!(px & 1) && !(py & 1)) { cmp("coast at 2x2 block centres", MX.coast(S.coast, (px | 1) / T, (py | 1) / T), coast((px | 1) / T, (py | 1) / T)); cmp("tier at 2x2 block centres", MX.tier(S.terraces, (px | 1) / T, (py | 1) / T), tier((px | 1) / T, (py | 1) / T)); }
        }
        for (var ty = 0; ty < MH; ty++) for (var tx = 0; tx < MW; tx++) {
          cmp("coast at tile centres", MX.coast(S.coast, tx + 0.5, ty + 0.5), coast(tx + 0.5, ty + 0.5));
          cmp("tier at tile centres", MX.tier(S.terraces, tx + 0.5, ty + 0.5), tier(tx + 0.5, ty + 0.5));
          cmp("pond at tile centres", MX.pond(S.pond, tx + 0.5, ty + 0.5), pondF(tx + 0.5, ty + 0.5));
        }
        // and off those points: the painter asks the pond at points nudged by its edge noise, so the same
        // operations are checked at 400,000 points spread finely over the whole map
        var sd = 7; function rnd() { sd = (Math.imul(sd, 1103515245) + 12345) >>> 0; return sd / 4294967296; }
        for (i = 0; i < 400000; i++) { var rx = rnd() * MW, ry = rnd() * MH; cmp("coast, pond, tier at scattered points", MX.coast(S.coast, rx, ry), coast(rx, ry)); cmp("coast, pond, tier at scattered points", MX.pond(S.pond, rx, ry), pondF(rx, ry)); cmp("coast, pond, tier at scattered points", MX.tier(S.terraces, rx, ry), tier(rx, ry)); }
        for (px = -2; px < PW + 2; px++) { var gx = (px + 0.5) / T; cmp("upper edge at pixel columns", MX.edge(S.terraces[0], gx), hiEdge(gx)); cmp("lower edge at pixel columns", MX.edge(S.terraces[1], gx), midEdge(gx)); }
        FALLS.forEach(function (f) { cmp("edges at the falls", MX.edge(S.terraces[f.up === 2 ? 0 : 1], f.x / T), (f.up === 2 ? hiEdge : midEdge)(f.x / T)); });
        var C = MX.curves(S.curves);
        ["river", "road"].forEach(function (k) {
          cmp(k + " curve sample count", C[k].length, CURVES[k].length);
          for (i = 0; i < Math.max(C[k].length, CURVES[k].length); i++) for (var q = 0; q < 3; q++) cmp(k + " curve samples", C[k][i] ? C[k][i][q] : NaN, CURVES[k][i] ? CURVES[k][i][q] : NaN);
        });
        return { bad: bad, n: n };
      },
      // collision: the old solidPx at every pixel against the decoded COLL + footBlock; then the
      // same after painting changes, which must move the old rule but not the new one
      collision: function (M) {
        var D = decodeCollision(M, C_BLOCK, function (ti) { return GROUND[ti]; }), r = { pixels: 0, differ: 0, collDiffer: 0, bridgeDockDiffer: 0 };
        for (var i = 0; i < COLL.length; i++) if (D.coll[i] !== COLL[i]) r.collDiffer++;
        for (var py = 0; py < PH; py++) for (var px = 0; px < PW; px++) {
          var a = solidPx(px + 0.5, py + 0.5), b = solidFrom(D, M, C_BLOCK, px + 0.5, py + 0.5), tt = GROUND[(py >> 4) * MW + (px >> 4)];
          r.pixels++; if (a !== b) { r.differ++; if (tt === BRIDGE || tt === DOCK) r.bridgeDockDiffer++; }
        }
        var edge = 0; for (var e = -3; e < PW + 3; e++) [[e, -1], [e, PH], [-1, e % PH], [PW, e % PH]].forEach(function (p) { if (solidPx(p[0], p[1]) !== solidFrom(D, M, C_BLOCK, p[0], p[1])) edge++; });
        r.outsideDiffer = edge;
        // paint over 400 pixels on open tiles (grass to water and water to grass), as an art change would
        var keep = GK.slice(), moved = 0, oldChanged = 0, newChanged = 0, k2 = 0;
        for (var ty = 20; ty < 70 && k2 < 400; ty++) for (var tx = 10; tx < 90 && k2 < 400; tx++) {
          if (!walkable(tx, ty)) continue;
          var p0 = (ty * T + 7) * PW + tx * T + 7, before = solidPx(tx * T + 7.5, ty * T + 7.5), nb = solidFrom(D, M, C_BLOCK, tx * T + 7.5, ty * T + 7.5);
          GK[p0] = GK[p0] === KW ? KG : KW; moved++; k2++;
          if (solidPx(tx * T + 7.5, ty * T + 7.5) !== before) oldChanged++;
          if (solidFrom(D, M, C_BLOCK, tx * T + 7.5, ty * T + 7.5) !== nb) newChanged++;
        }
        GK.set(keep);
        r.gkMutation = { pixelsRepainted: moved, oldRuleChanged: oldChanged, newRuleChanged: newChanged };
        // one footBlock entry moved by a pixel must show
        var M2 = JSON.parse(JSON.stringify(M)), row = M2.footBlock[Math.floor(M2.footBlock.length / 2)]; row[1] -= 1;
        var D2 = null, why = ""; try { D2 = decodeCollision(M2, C_BLOCK, function (ti) { return GROUND[ti]; }); } catch (e2) { why = e2.message; }
        var seen = 0; if (D2) for (var j = 0; j < D.foot.length; j++) if (D.foot[j] !== D2.foot[j]) seen++;
        r.footMutation = { row: row[0], decoded: !!D2, pixelsChanged: seen, refused: why };
        return r;
      }
    };
  })();
`;
const hooked = src
  .replace(MARK, "  window.__mapExport = { carves: [] };\n" + MARK)
  .replace(CARVE, CARVE + "\n    window.__mapExport.carves.push([kind, JSON.parse(JSON.stringify(pts)), typeof width === \"function\" ? String(width) : width]);")
  .replace(PRECOLL, "  window.__mapExport.propsBuilt = JSON.stringify(props);\n" + PRECOLL)
  .replace(CRITTER, CRITTER + "\n    window.__mapExport.spawns = window.__mapExport.spawns || []; window.__mapExport.spawns.push([kind, tx, ty, area]);")
  .replace(ANCHOR, HOOK + ANCHOR);

/* assembling the data from what was read */
function assemble(R) {
  const curves = R.carves.map(([kind, pts, w]) => {
    if (typeof w === "string") { if (w !== "function (q) { return 1.4 + q * 1.3; }") fail("an unknown curve width rule: " + w); w = SHAPES.riverWidth; }
    return { kind, w, pts };
  });
  const st = {}; R.stations.forEach(([id, x, y]) => { st[id] = [x, y]; });
  // B0: world px back to the tiles the code wrote them from (each actor has its own px offset, which
  // stays in code); anything that isn't a whole tile means the assumption is wrong
  const B = R.b0, tile = (p, ox, oy, what) => { const t = [(p[0] - ox) / 16, (p[1] - oy) / 16]; if (!t.every(Number.isInteger)) fail(`${what} ${J(p)} isn't a whole tile at offset ${ox},${oy}`); return t; };
  const roam = (k) => "roam-" + String(k).padStart(2, "0");                  // by first appearance in spawn order
  const places = {}; B.places.forEach(([k, v]) => { if (Array.isArray(v) && k !== "heli" && k !== "helipad") places[k] = v; });
  return {
    format: 1, id: "home", source: SOURCE, tile: R.tile, w: R.w, h: R.h,
    ground: R.ground, height: R.height, coll: R.coll, footBlock: R.footBlock,
    shapes: {
      coast: SHAPES.coast, terraces: SHAPES.terraces,
      pond: { type: "wobble-ellipse", x: R.pond.x, y: R.pond.y, rx: R.pond.rx, ry: R.pond.ry, waves: SHAPES.pondWaves },
      plaza: { type: "disc", x: R.plaza.x, y: R.plaza.y, r: R.plaza.r },
      curves,
      volcano: R.volcano, woods: R.woods
    },
    decals: DECALS,
    buildings: R.buildings, stations: st,
    anchors: { spawn: R.spawn, helipad: R.helipad, dock: R.dock, gate: R.gate, car: tile(B.px.car, 8, 8, "car"), rex: tile(B.px.rex, 8, 10, "rex"),
               gardener: tile(B.px.gardener, 8, 10, "gardener"), firstVisit: FIRST_VISIT, arena: tile(B.px.arena, 8, 8, "arena"), coreApproach: CORE_APPROACH },
    regions: { paddocks: R.paddocks, compound: R.compound, roamAreas: B.boxes.map((box, k) => ({ id: roam(k), box })), zones: ZONES },
    spawns: B.spawns.map((c) => ({ kind: c.kind, at: c.at, roam: roam(c.area) })),
    routes: { "welder-patrol": { start: tile(B.px.welder, 8, 10, "welder"), stops: B.spots } },
    places,
    props: R.props
  };
}

/* the file: one line per row, run row or prop, so a diff reads like the map */
const J = (v) => JSON.stringify(v);
function write(M) {
  const list = (a, ind) => "[\n" + a.map((x) => ind + J(x)).join(",\n") + "\n  ]";
  const lines = [
    "/* pi's island: the home map, format 1. Generated by tools/map-export.mjs from js/world.js at " + REF + ";",
    "   regenerate it rather than edit it by hand. Geometry and placements only: the prose, creature",
    "   behaviour and ctf stay in js/world.js. ground: a hex digit per tile (0 deep, 1 shallow, 2 sand,",
    "   3 grass, 4 path, 5 pond, 6 dock, 7 lava, 8 pad, 9 river, a bridge). height: the terrace, 0 to 5.",
    "   coll: the final collision flags per tile,",
    "   a base-36 index into coll.values. footBlock: extra pixels where feet stop on tiles coll lets them onto,",
    "   one entry per pixel row: [py, x0, n, x0, n, ...]; feet stop where coll blocks the tile or footBlock",
    "   has the pixel. shapes: what the ground painter draws from; these types reproduce the original island",
    "   exactly and are legacy parity types, not how a new island has to be authored. placements, in tiles",
    "   (anchors.spawn alone is in world px): anchors; regions.roamAreas, one record per roam area (creatures",
    "   naming the same id share one area; two ids are two areas even when their boxes match); regions.zones,",
    "   [x0, y0, x1, y1], each edge read by its own system; spawns, the creatures in order; routes, a start",
    "   and stops in order; places, goto spots (heli and helipad follow the helicopter). */",
    "(window.ISLAND_MAPS = window.ISLAND_MAPS || {}).home = {",
    `  "format": ${M.format}, "id": ${J(M.id)}, "source": ${J(M.source)}, "tile": ${M.tile}, "w": ${M.w}, "h": ${M.h},`,
    `  "ground": ${list(M.ground, "    ")},`,
    `  "height": ${list(M.height, "    ")},`,
    `  "coll": { "values": ${J(M.coll.values)}, "rows": ${list(M.coll.rows, "    ").replace(/\n  \]$/, "\n  ] }")},`,
    `  "footBlock": ${list(M.footBlock, "    ")},`,
    `  "shapes": {`,
    `    "coast": ${J(M.shapes.coast)},`,
    `    "terraces": ${list(M.shapes.terraces, "      ").replace(/\n  \]$/, "\n    ]")},`,
    `    "pond": ${J(M.shapes.pond)},`,
    `    "plaza": ${J(M.shapes.plaza)},`,
    `    "curves": ${list(M.shapes.curves, "      ").replace(/\n  \]$/, "\n    ]")},`,
    `    "volcano": ${J(M.shapes.volcano)},`,
    `    "woods": ${J(M.shapes.woods)}`,
    `  },`,
    `  "decals": ${J(M.decals)},`,
    `  "buildings": ${list(M.buildings, "    ")},`,
    `  "stations": ${J(M.stations)},`,
    `  "anchors": ${J(M.anchors)},`,
    `  "regions": {`,
    `    "paddocks": ${J(M.regions.paddocks)}, "compound": ${J(M.regions.compound)},`,
    `    "roamAreas": ${list(M.regions.roamAreas, "      ").replace(/\n  \]$/, "\n    ]")},`,
    `    "zones": ${J(M.regions.zones)}`,
    `  },`,
    `  "spawns": ${list(M.spawns, "    ")},`,
    `  "routes": ${J(M.routes)},`,
    `  "places": ${J(M.places)},`,
    `  "props": ${list(M.props, "    ")}`,
    "};",
    ""
  ];
  return lines.join("\n");
}
function props(M) { return M.props; }
function load(text) {             // the file back into an object, the way a page would run it
  const ctx = { window: {} }; vm.runInNewContext(text, ctx); return ctx.window.ISLAND_MAPS.home;
}

const PORT = 9000 + Math.floor(Math.random() * 90);
const server = await serve(PORT);
const results = {}, problems = [], t0 = Date.now();
const check = (ok, what, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? ": " + detail : ""}`); if (!ok) problems.push(what); };

for (const [name, type] of [["chromium", chromium], ["webkit", webkit], ["firefox", firefox]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch`); continue; }
  for (const run of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/\/js\/world\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: hooked }));
    await page.goto(`http://localhost:${PORT}/?debug=1&step=1&islandhour=11#island`);
    await page.waitForFunction(() => window.__mx && window.__island && window.__island.getState().open, null, { timeout: 60000 });
    const R = await page.evaluate(() => window.__mx.read());
    check(!errors.length, `${name} run ${run}: no page errors`, errors.join(" | "));
    check(R.propsBuilt === R.propsNow, `${name} run ${run}: props unchanged between the build and the read`);
    const M = assemble(R), text = write(M);
    results[`${name}#${run}`] = text;
    if (run === 2) { await page.close(); continue; }
    const V = await page.evaluate((S) => window.__mx.verify(S), M.shapes);
    const nBad = Object.values(V.bad).reduce((a, b) => a + b, 0), nAll = Object.values(V.n).reduce((a, b) => a + b, 0);
    check(nBad === 0, `${name}: shapes from the data equal the old functions bit for bit (${nAll.toLocaleString()} evaluations)`, nBad ? J(V.bad) : Object.entries(V.n).map(([k, v]) => `${k} ${v}`).join("; "));
    const C = await page.evaluate((m) => window.__mx.collision(m), load(text));
    check(C.collDiffer === 0, `${name}: decoded COLL equals the final COLL at all ${M.w * M.h} tiles`, String(C.collDiffer));
    check(C.differ === 0 && C.pixels === 2048000, `${name}: COLL + footBlock equals the old solidPx at every pixel`, `${C.pixels.toLocaleString()} pixels, ${C.differ} differ`);
    check(C.bridgeDockDiffer === 0, `${name}: bridge and dock pixels exact`, `${R.stats.bridgeDock.bridgeDockPx} pixels, ${R.stats.bridgeDock.bridgeDockBlocked} of them blocked before and after`);
    check(C.outsideDiffer === 0, `${name}: the pixels just outside the map stay blocked`);
    check(C.gkMutation.oldRuleChanged > 0 && C.gkMutation.newRuleChanged === 0, `${name}: repainting ${C.gkMutation.pixelsRepainted} pixels of GK moves the old rule, not COLL + footBlock`, J(C.gkMutation));
    check(C.footMutation.pixelsChanged > 0 || C.footMutation.refused, `${name}: one footBlock run moved by a pixel is caught`, J(C.footMutation));
    results.stats = R.stats; results.R = R;
    await page.close();
  }
  await browser.close();
}
server.close();

/* the file itself */
const texts = Object.entries(results).filter(([k]) => k.includes("#"));
const text = texts[0][1];
check(texts.every(([, t]) => t === text), `every engine and run wrote the same bytes (${texts.map(([k]) => k).join(", ")})`);
const M = load(text);
check(write(M) === text, "load, then write again: the same bytes");
check(/^[0-9a-f]{40}$/.test(M.source) && M.source === SOURCE && M.source.startsWith(INTENDED), "source is the full 40-character SHA of the intended commit", M.source);
check(/^[\x09\x0a\x20-\x7e]*$/.test(text), "ASCII only");
check(M.ground.length === M.h && M.ground.every((r) => /^[0-9a]+$/.test(r) && r.length === M.w), "ground: 80 rows of 100, codes 0 to a");
check(M.height.length === M.h && M.height.every((r) => /^[0-5]+$/.test(r) && r.length === M.w), "height: 80 rows of 100, 0 to 5");
check(M.coll.rows.length === M.h && M.coll.rows.every((r) => r.length === M.w && [...r].every((c) => parseInt(c, 36) < M.coll.values.length)), "coll: 80 rows of 100, every index in values", `values ${J(M.coll.values)}`);
check(M.coll.values.every((v) => (v & ~(1 | 2 | 4 | 256)) === 0), "coll: only solid, shallow, deep and lava bits; the reserved ones (low, ledges, climbable) unset");
check(M.props.length === 753 && J(M.props) === results.R.propsNow, `props: all ${M.props.length}, every field and the order as built`);
const prose = results.R.prose.filter((s) => s.length >= 12);
check(!prose.some((s) => text.includes(s.slice(0, 24))), `no station or building prose in the file (${prose.length} texts checked)`);
const nonLayer = J({ ...M, ground: [], height: [], coll: { values: M.coll.values, rows: [] } });
check(!/flag\{|ctf|[0-9a-f]{64}/i.test(nonLayer) && !/flag\{/i.test(text), "no flag{, ctf or 64-hex strings outside the layer rows (and no flag{ anywhere)");
check(!/[—]/.test(text), "no em dashes");

/* B0: the home island's placements, against the reference island itself */
const B = results.R.b0, pairsOf = (sp) => { let m = ""; for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) m += sp[i].roam === sp[j].roam ? "1" : "0"; return m; };
check(M.spawns.length === 33 && B.critters === 33 && B.spawns.every((c) => c.sameAsCritter), "spawns: 33, in the order critter() was called, each the creature the island built");
check(M.regions.roamAreas.length === 28, "roam areas: 28 records, one per area object", String(M.regions.roamAreas.length));
check(pairsOf(M.spawns) === B.pairs, `roam areas: which spawns share an area is the reference's own alias graph (${B.pairs.length} pairs)`);
const groups = {}; M.spawns.forEach((c, i) => (groups[c.roam] = groups[c.roam] || []).push(i));
check(J(groups[M.spawns[3].roam]) === "[3,4,5]" && J(groups[M.spawns[6].roam]) === "[6,7,8,9]" && Object.values(groups).filter((g) => g.length > 1).length === 2, "roam areas: the raptors share one record, the herd plain's four another, and no other spawns share");
const boxKeys = M.regions.roamAreas.map((r) => J(r.box)), dupBoxes = boxKeys.filter((k, i) => boxKeys.indexOf(k) !== i).length;
check(dupBoxes > 0 && new Set(M.regions.roamAreas.map((r) => r.id)).size === 28, `roam areas: matching boxes stay separate records (${dupBoxes} records repeat an earlier box)`);
check(M.spawns.every((c) => J(c.at) === J([B.spawns[M.spawns.indexOf(c)].at[0], B.spawns[M.spawns.indexOf(c)].at[1]])) && M.regions.roamAreas.every((r, k) => J(r.box) === J(B.boxes[k])), "spawns and roam boxes: exactly the numbers critter() was given");
check(J(M.routes) === J({ "welder-patrol": { start: [59, 39], stops: [[59, 34], [62, 39], [67, 39], [71, 34]] } }), "routes: the welder's patrol, start and stops in order", J(M.routes));
check(J(M.regions.zones) === J(ZONES), "zones: as written out (41.5 kept)", J(M.regions.zones));
const gb = props(M).map((p, i) => p.tx >= 35 && p.tx <= 57 && p.ty >= 51 && p.ty <= 65 ? i : -1).filter((i) => i >= 0), ct = props(M).map((p, i) => p.tx >= 28 && p.tx <= 44 && p.ty >= 22 && p.ty <= 36 ? i : -1).filter((i) => i >= 0);
check(J(gb) === J(B.gardenerBeds) && J(ct) === J(B.cockatielTrees), `zones: the gardener's beds (${gb.length} props) and the cockatiel trees (${ct.length}) pick the same props as the old tests`);
check(J(M.places) === J({ pond: [69, 45], gate: [48, 35], plaza: [46, 60], car: [37, 61], paddock: [41, 51], raptors: [64, 40], volcano: [48, 25], outpost: [26, 61], shrine: [21, 23], clearing: [48, 43] }), "places: the ten fixed goto spots, in the game's order", J(M.places));
check(!("heli" in M.places) && !("helipad" in M.places) && B.places.some(([k]) => k === "heli") && B.places.some(([k]) => k === "helipad"), "places: heli and helipad have no fixed spot (the game keeps the names)");
check(J([M.anchors.car, M.anchors.rex, M.anchors.gardener, M.anchors.firstVisit, M.anchors.arena]) === J([[36, 62], [44, 62], [45, 62], [50, 61], [48, 43]]), "anchors: car, rex, gardener, firstVisit, arena", J(M.anchors));
check(J(M.anchors.arena) !== J([36, 26]) && J(M.anchors.arena) !== J([36, 25]) && !/\[36,2[56]\]/.test(J({ a: M.anchors, r: M.routes, p: M.places, z: M.regions.zones })), "the core tap's old goal (36,26) is nowhere in the data; the arena is where the fight is");
{
  const ca = M.anchors.coreApproach, ar = M.anchors.arena;
  check(J(ca) === J([ar[0], ar[1] + 1]) && (M.coll.values[parseInt(M.coll.rows[ca[1]][ca[0]], 36)] & (1 | 2 | 4 | 256)) === 0,
    "anchors.coreApproach: one row south of the arena, on a tile feet can walk", J({ coreApproach: ca, arena: ar }));
}
const dep = M.buildings.find((b) => b.id === "depot"), vis = M.buildings.find((b) => b.id === "visitor"), door = (b) => [Math.floor(b.x0 + b.w / 2), b.y0 + b.h];
check(J(door(dep)) === J(B.cargo.depot) && J(door(vis)) === J(B.cargo.visitor) && B.cargo.legsShareStops, "derived, not stored: the cargo stops are the depot and visitor doorways, and every cargo leg is one of the stop objects", J(B.cargo));
check(B.pad[0] === (dep.x0 + dep.w / 2) * 16 && B.pad[1] === dep.y0 * 16 + 6 && B.pad[2] === 30, "derived, not stored: the drone pad is the depot's roof (centre x, top row + 6 px, roof 30)", J(B.pad));

/* footBlock: how it could be stored, measured, so the choice is on numbers */
const S = results.stats, PW = M.w * M.tile, PH = M.h * M.tile;
const bits = new Uint8Array(PW * PH / 8); M.footBlock.forEach((r) => { for (let i = 1; i < r.length; i += 2) for (let x = r[i]; x < r[i] + r[i + 1]; x++) { const p = r[0] * PW + x; bits[p >> 3] |= 1 << (p & 7); } });
const tileMasks = {}; M.footBlock.forEach((r) => { for (let i = 1; i < r.length; i += 2) for (let x = r[i]; x < r[i] + r[i + 1]; x++) { const k = `${x >> 4},${r[0] >> 4}`; (tileMasks[k] = tileMasks[k] || new Array(16).fill(0))[r[0] & 15] |= 1 << (x & 15); } });
const rle = []; { let cur = 0, n = 0; for (let p = 0; p < PW * PH; p++) { const b = (bits[p >> 3] >> (p & 7)) & 1; if (b === cur) n++; else { rle.push(n); cur = b; n = 1; } } rle.push(n); }
const enc = {
  "row runs [py, x0, n, ...] (chosen)": J(M.footBlock),
  "per-tile 16x16 masks {\"x,y\": [16 words]}": J(Object.fromEntries(Object.entries(tileMasks).map(([k, v]) => [k, v.map((w) => w.toString(16).padStart(4, "0")).join("")]))),
  "whole-map run lengths": J(rle),
  "bitset, base64": J(Buffer.from(bits).toString("base64"))
};
console.log(`\nfootBlock: ${S.blockedFoot} pixels, ${S.runs} runs on ${S.rows} pixel rows, ${Object.keys(tileMasks).length} tiles`);
for (const [k, v] of Object.entries(enc)) console.log(`  ${k.padEnd(44)} ${String(v.length).padStart(7)} bytes raw, ${String(gzipSync(v, { level: 9 }).length).padStart(6)} gzip`);
const parts = { ground: M.ground, height: M.height, coll: M.coll, footBlock: M.footBlock, shapes: M.shapes, props: M.props, b0: { a: M.anchors, r: M.regions, s: M.spawns, ro: M.routes, p: M.places } };
console.log(`home.js: ${text.length} bytes raw, ${gzipSync(text, { level: 9 }).length} gzip; parts (JSON): ` + Object.entries(parts).map(([k, v]) => `${k} ${J(v).length}`).join(", "));
console.log(`${problems.length ? "FAIL" : "PASS"} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (problems.length) process.exit(1);

if (CHECK_ONLY) {
  const same = existsSync(OUTFILE) && readFileSync(OUTFILE, "utf8") === text;
  console.log(same ? "js/maps/home.js is up to date" : "js/maps/home.js differs from a fresh export");
  process.exit(same ? 0 : 1);
}
mkdirSync(dirname(OUTFILE), { recursive: true });
writeFileSync(OUTFILE, text);
console.log("wrote js/maps/home.js");
