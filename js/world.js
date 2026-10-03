/* world: pi's island. click the orb and you warp into a top-down jurassic island
   you can walk around as pi. every landmark is a piece of the portfolio: the rack
   is the homelab, the lighthouse is the security work, the boat takes you home.
   there's a volcano, fenced paddocks, a helicopter on the pad, Ammaar's koi, cats,
   cockatiels and car, and a terminal left logged in inside a cave.
   keyboard: wasd / arrows to walk, e / space / enter to look, esc to leave.
   pointer: tap anywhere to walk there, tap a landmark to walk up and look. */
(function () {
  var root = document.getElementById("world");
  var orbBtn = document.querySelector(".orb-btn");
  if (!root || !orbBtn) return;
  var cv = root.querySelector(".w-cv"), ctx = cv.getContext("2d");
  var warp = document.querySelector("canvas.warp"), wctx = warp.getContext("2d");
  var dlg = root.querySelector(".w-dialog"), dName = dlg.querySelector(".w-name"), dText = dlg.querySelector(".w-text"), dLinks = dlg.querySelector(".w-links"), dSr = dlg.querySelector("#w-sr");
  var liveEl = document.getElementById("w-live");
  // polite announcements for screen readers: landmarks nearby, logs found. never movement
  function announce(msg) { if (!liveEl) return; liveEl.textContent = ""; setTimeout(function () { liveEl.textContent = msg; }, 30); }
  var foundEl = root.querySelector(".w-found");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  // ?debug=1 shows a readout of the frame time, particles, audio, canvases, state and the save;
  // ?seed=n makes the fight play out the same way every time. with ?debug=1 it also seeds every
  // other roll (the creatures, the bots, the flyovers), for the scenario tests
  var DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  var SEED = (location.search.match(/[?&]seed=(\d+)/) || [])[1];
  function seeded(a) { return function () { a = (a + 0x6d2b79f5) | 0; var q = Math.imul(a ^ (a >>> 15), 1 | a); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; }
  var frand = SEED ? seeded(+SEED) : Math.random;                                   // the fight's rolls, as before
  var rand = SEED && DEBUG ? seeded(+SEED ^ 0x5bd1e995) : Math.random;            // every other roll
  // every offscreen canvas is made here, so they can be counted (and their memory estimated)
  var CANVASES = [];
  function mkCanvas() { var c = document.createElement("canvas"); CANVASES.push(c); return c; }
  // letting a canvas go: size it to nothing first, or safari keeps holding its memory
  function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } }
  /* glow sprites. building a radial gradient every frame is slow (slowest in safari), so each
     glow is drawn once into a small canvas, keyed by its colour stops, then stretched to size
     with drawImage, its strength riding on globalAlpha. the least recently used are let go */
  var GLOWS = typeof Map !== "undefined" ? new Map() : null, GLOW_MAX = 64;
  function glowSprite(key, stops, inner) {
    var c = GLOWS && GLOWS.get(key);
    if (c) { GLOWS.delete(key); GLOWS.set(key, c); return c; }
    c = mkCanvas(); c.width = c.height = 128;
    var g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, (inner || 0) * 64, 64, 64, 64);
    stops.forEach(function (st) { gr.addColorStop(st[0], "rgba(" + st[1] + "," + st[2] + ")"); });
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    if (GLOWS) { GLOWS.set(key, c); if (GLOWS.size > GLOW_MAX) { var k0 = GLOWS.keys().next().value; freeCanvas(GLOWS.get(k0)); GLOWS.delete(k0); } }
    return c;
  }
  function drawGlow(c, x, y, rx, ry, a) {
    if (a <= 0.003 || rx <= 0) return;
    var ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(c, x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = ga;
  }

  /* ════════ map ════════ */
  /* the map is authored data (MAP-A): js/maps/home.js, loaded just before this file, registers
     ISLAND_MAPS.home, and decodeMap() below checks it and turns it into the game's own copies. the data
     is the source of truth for the island's geography: the tile layers (ground, height), the collision
     (the final per-tile flags, coll, and footBlock, the extra pixels where feet stop on tiles coll lets
     them onto), the props, the shapes the ground is painted from, and where the buildings, landmarks,
     helipad, dock, gate, paddocks and outpost stand. a map that doesn't decode stops the island here,
     before anything is built, with a message that names what's wrong */
  var T = 16;
  var DEEP = 0, SHAL = 1, SAND = 2, GRASS = 3, PATH = 4, POND = 5, DOCK = 6, LAVA = 7, PAD = 8, RIVER = 9, BRIDGE = 10;
  /* the collision flags, per tile. a tile can be walked when none of SOLID, SHALLOW, DEEP or LAVA is set.
     LOW, the ledges and CLIMBABLE are reserved for Phase 11 (jumping, heights) and nothing sets them yet */
  var C_SOLID = 1, C_SHALLOW = 2, C_DEEP = 4, C_LOW = 8, C_LEDGE_N = 16, C_LEDGE_E = 32, C_LEDGE_S = 64, C_LEDGE_W = 128, C_LAVA = 256, C_CLIMB = 512;
  var C_BLOCK = C_SOLID | C_SHALLOW | C_DEEP | C_LAVA, C_ALL = 1023;
  /* the props that stand in pi's way: when the island was generated, each of these made its tile solid,
     so the data must agree (undergrowth, pebbles, small rocks, lilies and the volcano's boulders never did) */
  var BLOCKING_PROP = /^(e:(oak|birch|ginkgo|mpuzzle|redwood|palm|fig|tallfern|baretree)\d*|e:nest0|lamp|mast|solar|generator|tank|tent|campfire|crates)$/;
  /* decodeMap: one map's data (format 1) checked and decoded, or an Error naming the field and the
     problem. it never changes what it's given: the layers become typed arrays, footBlock a bitset (one bit
     per pixel), and everything else a copy (props keep their fields in their order).
     the shape types (harmonic-blob, sine-edge, wobble-ellipse, disc, the curves, the volcano) are legacy
     parity types: they reproduce the original procedural island exactly. a new island isn't bound to
     them. the size is limited to 256 x 256 tiles, about the most a phone can paint as one canvas */
  function decodeMap(M) {
    function bad(msg) { throw new Error(msg); }
    function isObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
    function num(v, f) { if (typeof v !== "number" || !isFinite(v)) bad(f + " must be a finite number"); return v; }
    function int(v, f, lo, hi) { if (typeof v !== "number" || v % 1 !== 0 || v < lo || v > hi) bad(f + " must be a whole number from " + lo + " to " + hi); return v; }
    function pos(v, f) { if (num(v, f) <= 0) bad(f + " must be above 0"); return v; }
    function arr(v, f, n) { if (!Array.isArray(v) || (n !== undefined && v.length !== n)) bad(f + " must be a list" + (n !== undefined ? " of " + n : "")); return v; }
    function nums(v, f, n) { arr(v, f, n).forEach(function (q, i) { num(q, f + "[" + i + "]"); }); return v; }
    function only(o, f, keys) { Object.keys(o).forEach(function (q) { if (keys.indexOf(q) < 0) bad(f + " has an unknown field " + q); }); }
    function copy(o) { return JSON.parse(JSON.stringify(o)); }
    if (!isObj(M)) bad("no map (window.ISLAND_MAPS has no entry for it)");
    only(M, "the map", ["format", "id", "source", "tile", "w", "h", "ground", "height", "coll", "footBlock", "shapes", "decals", "buildings", "stations", "anchors", "regions", "props"]);
    if (M.format !== 1) bad("format " + M.format + " isn't supported (this code reads format 1)");
    if (typeof M.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(M.id)) bad("id must be a short lowercase name (a to z, 0 to 9, -)");
    if (M.source !== undefined && (typeof M.source !== "string" || !/^[0-9a-f]{40}$/.test(M.source))) bad("source must be a 40-character git commit");
    if (M.tile !== T) bad("tile must be " + T + " (px per tile in this engine)");
    var w = int(M.w, "w", 1, 256), h = int(M.h, "h", 1, 256), PWm = w * T, PHm = h * T, D = { format: 1, id: M.id, source: M.source || null, w: w, h: h };
    // the tile layers: a row string per tile row, a base-36 digit per tile
    function layer(f, list, max) {
      var out = new Uint8Array(w * h);
      if (!Array.isArray(list) || list.length !== h) bad(f + " must have " + h + " rows");
      for (var y = 0; y < h; y++) {
        var row = list[y]; if (typeof row !== "string" || row.length !== w) bad(f + " row " + y + " must be " + w + " long" + (typeof row === "string" ? ", not " + row.length : ""));
        for (var x = 0; x < w; x++) { var v = parseInt(row.charAt(x), 36); if (!(v <= max)) bad(f + " row " + y + " has " + JSON.stringify(row.charAt(x)) + " at " + x + " (0 to " + max.toString(36) + ")"); out[y * w + x] = v; }
      }
      return out;
    }
    D.ground = layer("ground", M.ground, BRIDGE);
    D.height = layer("height", M.height, 5);
    if (!isObj(M.coll)) bad("coll must be { values, rows }");
    only(M.coll, "coll", ["values", "rows"]);
    var vals = arr(M.coll.values, "coll.values");
    if (!vals.length || vals.length > 36) bad("coll.values must hold 1 to 36 values");
    vals.forEach(function (v, i) { int(v, "coll.values[" + i + "]", 0, C_ALL); if (vals.indexOf(v) !== i) bad("coll.values has " + v + " twice"); });
    var ix = layer("coll", M.coll.rows, vals.length - 1);
    D.coll = new Uint16Array(w * h);
    for (var i = 0; i < ix.length; i++) D.coll[i] = vals[ix[i]];
    function walk(x, y) { return x >= 0 && y >= 0 && x < w && y < h && !(D.coll[y * w + x] & C_BLOCK); }
    function g(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? D.ground[y * w + x] : -1; }
    function solid(x, y) { return x >= 0 && y >= 0 && x < w && y < h && !!(D.coll[y * w + x] & C_SOLID); }
    // footBlock: [py, x0, n, x0, n, ...] per pixel row, rows ascending, runs in order, apart, inside the
    // map and only on tiles coll lets feet onto (so no pixel is listed twice or blocked twice)
    D.foot = new Uint32Array((PWm * PHm + 31) >>> 5); D.footPixels = 0;
    var lastY = -1;
    arr(M.footBlock, "footBlock").forEach(function (r, k) {
      if (!Array.isArray(r) || r.length < 3 || r.length % 2 !== 1) bad("footBlock entry " + k + " must be [py, x0, n, ...]");
      var py = int(r[0], "footBlock entry " + k + " row", 0, PHm - 1);
      if (py <= lastY) bad("footBlock rows must go up: row " + py + " comes after " + lastY);
      lastY = py;
      for (var j = 1, end = -1; j < r.length; j += 2) {
        var x0 = int(r[j], "footBlock row " + py + " run start", 0, PWm - 1), n = int(r[j + 1], "footBlock row " + py + " run length", 1, PWm);
        if (x0 <= end) bad("footBlock row " + py + ": the run at " + x0 + " overlaps or touches the one before (runs must be in order, with a gap)");
        if (x0 + n > PWm) bad("footBlock row " + py + ": the run at " + x0 + " runs off the map");
        for (var px = x0; px < x0 + n; px++) {
          if (!walk((px / T) | 0, (py / T) | 0)) bad("footBlock pixel " + px + "," + py + " is on tile " + ((px / T) | 0) + "," + ((py / T) | 0) + ", which coll already blocks");
          var b = py * PWm + px; D.foot[b >>> 5] |= 1 << (b & 31); D.footPixels++;
        }
        end = x0 + n;
      }
    });
    // the shapes the ground is painted from
    var S = M.shapes; if (!isObj(S)) bad("shapes is missing");
    only(S, "shapes", ["coast", "terraces", "pond", "plaza", "curves", "volcano", "woods"]);
    function waves(v, f) { arr(v, f).forEach(function (q, i) { if (!Array.isArray(q) || (q.length !== 2 && q.length !== 3)) bad(f + "[" + i + "] must be [a, f] or [a, f, p]"); nums(q, f + "[" + i + "]"); }); }
    function shape(o, f, type, keys) {
      if (!isObj(o)) bad(f + " is missing");
      if (o.type !== type) bad(f + ".type " + JSON.stringify(o.type) + " isn't a known type (" + type + ")");
      only(o, f, ["type"].concat(keys));
    }
    shape(S.coast, "shapes.coast", "harmonic-blob", ["c", "sx", "r", "waves", "union", "cut", "salt"]);
    nums(S.coast.c, "shapes.coast.c", 2); pos(S.coast.sx, "shapes.coast.sx"); pos(S.coast.r, "shapes.coast.r"); waves(S.coast.waves, "shapes.coast.waves"); num(S.coast.salt, "shapes.coast.salt");
    arr(S.coast.union, "shapes.coast.union").forEach(function (q, i) { nums(q, "shapes.coast.union[" + i + "]", 4); pos(q[2], "shapes.coast.union[" + i + "] rx"); pos(q[3], "shapes.coast.union[" + i + "] ry"); });
    arr(S.coast.cut, "shapes.coast.cut").forEach(function (q, i) { nums(q, "shapes.coast.cut[" + i + "]", 5); pos(q[2], "shapes.coast.cut[" + i + "] rx"); pos(q[3], "shapes.coast.cut[" + i + "] ry"); });
    arr(S.terraces, "shapes.terraces", 2).forEach(function (E, i) {
      var f = "shapes.terraces[" + i + "]";
      shape(E, f, "sine-edge", ["level", "base", "waves", "ramps", "slope", "salt"]);
      if (E.level !== 2 - i) bad(f + ".level must be " + (2 - i) + " (the upper edge first, then the lower)");
      num(E.base, f + ".base"); waves(E.waves, f + ".waves"); num(E.salt, f + ".salt");
      if (E.ramps !== undefined) arr(E.ramps, f + ".ramps").forEach(function (q, k) { nums(q, f + ".ramps[" + k + "]", 3); if (q[1] !== 1 && q[1] !== -1) bad(f + ".ramps[" + k + "] direction must be 1 or -1"); });
      if (E.slope !== undefined) nums(E.slope, f + ".slope", 2);
    });
    shape(S.pond, "shapes.pond", "wobble-ellipse", ["x", "y", "rx", "ry", "waves"]);
    num(S.pond.x, "shapes.pond.x"); num(S.pond.y, "shapes.pond.y"); pos(S.pond.rx, "shapes.pond.rx"); pos(S.pond.ry, "shapes.pond.ry"); waves(S.pond.waves, "shapes.pond.waves");
    shape(S.plaza, "shapes.plaza", "disc", ["x", "y", "r"]);
    num(S.plaza.x, "shapes.plaza.x"); num(S.plaza.y, "shapes.plaza.y"); pos(S.plaza.r, "shapes.plaza.r");
    var roadSeen = false;
    arr(S.curves, "shapes.curves").forEach(function (c, i) {
      var f = "shapes.curves[" + i + "]";
      if (!isObj(c)) bad(f + " must be { kind, w, pts }");
      only(c, f, ["kind", "w", "pts"]);
      if (c.kind === "river") { if (roadSeen) bad(f + ": rivers come before roads"); nums(c.w, f + ".w", 2); }
      else if (c.kind === "road") { roadSeen = true; pos(c.w, f + ".w"); }
      else bad(f + ".kind " + JSON.stringify(c.kind) + " isn't a known kind (river, road)");
      if (arr(c.pts, f + ".pts").length < 2) bad(f + ".pts needs at least 2 points");
      c.pts.forEach(function (p, k) { nums(p, f + ".pts[" + k + "]", 2); });
    });
    if (!S.curves.length || S.curves[0].kind !== "river") bad("shapes.curves needs a river first");
    var V = S.volcano; if (!isObj(V)) bad("shapes.volcano is missing");
    only(V, "shapes.volcano", ["x", "y", "R", "H", "sq", "rc"]);
    num(V.x, "shapes.volcano.x"); num(V.y, "shapes.volcano.y"); pos(V.R, "shapes.volcano.R"); pos(V.H, "shapes.volcano.H"); pos(V.sq, "shapes.volcano.sq"); pos(V.rc, "shapes.volcano.rc");
    if (V.rc >= V.R) bad("shapes.volcano.rc must be smaller than R");
    if (S.woods !== undefined) arr(S.woods, "shapes.woods").forEach(function (q, i) { nums(q, "shapes.woods[" + i + "]", 4); pos(q[2], "shapes.woods[" + i + "] radius"); });
    D.shapes = copy(S); if (!D.shapes.woods) D.shapes.woods = [];
    // decals, optional: the bones and the beach footprints
    var De = M.decals === undefined ? {} : M.decals; if (!isObj(De)) bad("decals must be an object");
    only(De, "decals", ["bones", "tracks"]);
    if (De.bones !== undefined) nums(De.bones, "decals.bones", 2);
    if (De.tracks !== undefined) { if (!isObj(De.tracks)) bad("decals.tracks must be { x, dx, y, n }"); only(De.tracks, "decals.tracks", ["x", "dx", "y", "n"]); num(De.tracks.x, "decals.tracks.x"); num(De.tracks.dx, "decals.tracks.dx"); num(De.tracks.y, "decals.tracks.y"); int(De.tracks.n, "decals.tracks.n", 0, 1000); }
    D.decals = copy(De);
    // where things stand
    var ID = /^[a-z0-9][a-z0-9-]{0,31}$/, ids = {};
    D.buildings = arr(M.buildings, "buildings").map(function (b, i) {
      var f = "building " + i;
      if (!isObj(b)) bad(f + " must be an object");
      only(b, f, ["id", "x0", "y0", "w", "h", "room"]);
      if (typeof b.id !== "string" || !ID.test(b.id)) bad(f + " needs an id (a short lowercase name)");
      if (ids[b.id]) bad("building " + b.id + " appears twice");
      ids[b.id] = 1; f = "building " + b.id;
      int(b.x0, f + " x0", 0, w - 1); int(b.y0, f + " y0", 0, h - 1); int(b.w, f + " w", 1, w - b.x0); int(b.h, f + " h", 1, h - b.y0);
      if (b.room !== undefined && (typeof b.room !== "string" || !ID.test(b.room))) bad(f + " room must be a short lowercase name");
      for (var y = b.y0; y < b.y0 + b.h; y++) for (var x = b.x0; x < b.x0 + b.w; x++) if (!solid(x, y)) bad(f + ": its footprint tile " + x + "," + y + " isn't solid in coll");
      var ex = Math.floor(b.x0 + b.w / 2), ey = b.y0 + b.h;                    // where pi comes out of the door
      if (b.room && !walk(ex, ey)) bad(f + ": its doorway " + ex + "," + ey + " (where pi comes out) can't be walked");
      return copy(b);
    });
    if (!isObj(M.stations)) bad("stations must be an object (id: [x, y])");
    D.stations = {};
    Object.keys(M.stations).forEach(function (sid) {
      var p = M.stations[sid], f = "station " + sid;
      if (!ID.test(sid)) bad(f + ": the id must be a short lowercase name");
      nums(p, f, 2); int(p[0], f + " x", 0, w - 1); int(p[1], f + " y", 0, h - 1);
      // a landmark on land was always something pi bumps into; one on the water (the boat) is in the water
      var t = g(p[0], p[1]);
      if (t !== DEEP && t !== SHAL && t !== POND && t !== RIVER && !solid(p[0], p[1])) bad(f + " stands on land at " + p[0] + "," + p[1] + " but that tile isn't solid in coll");
      D.stations[sid] = [p[0], p[1]];
    });
    var A = M.anchors; if (!isObj(A)) bad("anchors is missing");
    only(A, "anchors", ["spawn", "helipad", "dock", "gate"]);
    nums(A.spawn, "anchors.spawn", 2); num(A.spawn[0], "anchors.spawn x");
    if (A.spawn[0] < 0 || A.spawn[1] < 0 || A.spawn[0] >= PWm || A.spawn[1] >= PHm) bad("anchors.spawn (world px) is off the map");
    if (!walk(Math.floor(A.spawn[0] / T), Math.floor(A.spawn[1] / T))) bad("anchors.spawn is on a tile that can't be walked (the safe ground floods from it)");
    nums(A.helipad, "anchors.helipad", 2); int(A.helipad[0], "anchors.helipad x", 1, w - 2); int(A.helipad[1], "anchors.helipad y", 1, h - 2);
    if (g(A.helipad[0], A.helipad[1]) !== PAD) bad("anchors.helipad " + A.helipad + " isn't on a pad tile in ground");
    nums(A.dock, "anchors.dock", 2); int(A.dock[0], "anchors.dock x", 0, w - 2); int(A.dock[1], "anchors.dock y", 0, h - 5);
    for (var dy = 1; dy <= 4; dy++) for (var dx = 0; dx <= 1; dx++) if (g(A.dock[0] + dx, A.dock[1] + dy) !== DOCK) bad("anchors.dock " + A.dock + ": the 2 x 4 tiles below it must be dock in ground");
    nums(A.gate, "anchors.gate", 2); int(A.gate[0], "anchors.gate x", 2, w - 3); int(A.gate[1], "anchors.gate y", 0, h - 1);
    if (!solid(A.gate[0] - 2, A.gate[1]) || !solid(A.gate[0] + 2, A.gate[1])) bad("anchors.gate " + A.gate + ": its two posts (2 tiles either side) must be solid in coll");
    D.anchors = copy(A);
    // regions, optional: the paddocks (their fences are solid) and the outpost compound (its walls are)
    var R = M.regions === undefined ? {} : M.regions; if (!isObj(R)) bad("regions must be an object");
    only(R, "regions", ["paddocks", "compound"]);
    (R.paddocks === undefined ? [] : arr(R.paddocks, "regions.paddocks")).forEach(function (p, i) {
      var f = "regions.paddocks[" + i + "]";
      if (!Array.isArray(p) || p.length !== 5 || typeof p[0] !== "string" || !p[0]) bad(f + " must be [name, x0, y0, x1, y1]");
      int(p[1], f + " x0", 0, w - 1); int(p[2], f + " y0", 0, h - 1); int(p[3], f + " x1", p[1] + 1, w - 1); int(p[4], f + " y1", p[2] + 1, h - 1);
      for (var y = p[2]; y <= p[4]; y++) for (var x = p[1]; x <= p[3]; x++) {
        var edge = x === p[1] || x === p[3] || y === p[2] || y === p[4], t = g(x, y);
        if (edge && (t === GRASS || t === SAND || t === PATH || t === PAD || t === BRIDGE) && !solid(x, y)) bad(f + " (" + p[0] + "): its fence tile " + x + "," + y + " isn't solid in coll");
      }
    });
    if (R.compound !== undefined) {
      var Cp = R.compound, f2 = "regions.compound";
      if (!isObj(Cp)) bad(f2 + " must be { x0, y0, x1, y1, gate }");
      only(Cp, f2, ["x0", "y0", "x1", "y1", "gate"]);
      int(Cp.x0, f2 + ".x0", 0, w - 1); int(Cp.y0, f2 + ".y0", 0, h - 1); int(Cp.x1, f2 + ".x1", Cp.x0 + 1, w - 1); int(Cp.y1, f2 + ".y1", Cp.y0 + 1, h - 1);
      arr(Cp.gate, f2 + ".gate").forEach(function (gy, i) { int(gy, f2 + ".gate[" + i + "]", Cp.y0, Cp.y1); });
      for (var cy = Cp.y0; cy <= Cp.y1; cy++) for (var cx = Cp.x0; cx <= Cp.x1; cx++) {     // its walls: the edge, where there's land and no path, but the gate
        var ct = g(cx, cy);
        if ((cx === Cp.x0 || cx === Cp.x1 || cy === Cp.y0 || cy === Cp.y1) && (ct === GRASS || ct === SAND || ct === PAD || ct === BRIDGE) && !(cx === Cp.x1 && Cp.gate.indexOf(cy) >= 0) && !solid(cx, cy)) bad(f2 + ": its wall tile " + cx + "," + cy + " isn't solid in coll");
      }
    }
    D.regions = copy({ paddocks: R.paddocks || [], compound: R.compound || null });
    // props, in their order, each a copy with its fields in their order
    var PROP_KEYS = { kind: "string", tx: "tile", ty: "tile", flip: "boolean", ox: "offset", oy: "offset", sea: "boolean", flat: "boolean", eggs: "count" };
    D.props = arr(M.props, "props").map(function (p, i) {
      var f = "prop " + i;
      if (!isObj(p)) bad(f + " must be an object");
      if (typeof p.kind !== "string" || !/^(e:)?[a-z][a-z0-9_]*$/.test(p.kind)) bad(f + " needs a kind (a sprite name like e:oak1 or lamp)");
      f = "prop " + i + " (" + p.kind + ")";
      if (p.tx === undefined || p.ty === undefined) bad(f + " needs tx and ty");
      Object.keys(p).forEach(function (q) {
        var t = PROP_KEYS[q], v = p[q];
        if (!t) bad(f + " has an unknown field " + q);
        if (t === "boolean" && typeof v !== "boolean") bad(f + " " + q + " must be true or false");
        if (t === "offset" && (typeof v !== "number" || !isFinite(v) || Math.abs(v) > 16)) bad(f + " " + q + " must be a number of px from -16 to 16");
        if (t === "count") int(v, f + " " + q, 0, 9);
      });
      int(p.tx, f + " tx", 0, w - 1); int(p.ty, f + " ty", 0, h - 1);
      if (BLOCKING_PROP.test(p.kind) && !solid(p.tx, p.ty)) bad(f + " at " + p.tx + "," + p.ty + " stands in pi's way, but that tile isn't solid in coll");
      return copy(p);
    });
    // nobody climbs the volcano: every tile under its cone is solid
    for (var vy = 0; vy < h; vy++) for (var vx = 0; vx < w; vx++) {
      var u = vx * T + 8 - V.x, v2 = (vy * T + 8 - V.y) * V.sq;
      if (Math.sqrt(u * u + v2 * v2) < V.R * 0.93 && !solid(vx, vy)) bad("tile " + vx + "," + vy + " is under the volcano but isn't solid in coll");
    }
    return D;
  }
  var MAP;
  try { MAP = decodeMap(window.ISLAND_MAPS && window.ISLAND_MAPS.home); }
  catch (e) { var err = new Error("pi's island: js/maps/home.js: " + e.message); if (window.console) console.error(err.message); throw err; }
  var SH = MAP.shapes;
  var MW = MAP.w, MH = MAP.h, CX = 48, CY = 40, DOCKX = MAP.anchors.dock[0];
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  /* the island is built like a level, in three terraces. the highland across the north holds
     the volcano, the watchtower, the cave and, far to the west, the old shrine. a cliff band
     drops to the meadows, the big middle terrace: the brachio meadow and the river to the
     west, the t-rex paddock, the clearing where trails meet, the raptor pen, the koi garden,
     and the headland with the lighthouse out east. a second cliff band drops to the lowland
     along the south shore: the harbour village with the dock, the helipad, the herd plain,
     and the outpost in the southwest. the only ways up or down a cliff are the stairs where a
     trail climbs it, so the trails are the level's chokepoints. the river rises on the
     highland, falls off both cliffs and runs out to sea past the outpost. */
  /* the shapes, worked out from the data in the same operations, in the same order, as the original
     formulas, so every value is the same to the last bit. a wave [a, f, p] adds a * sin(f * t + p);
     [a, f] adds a * sin(f * t) */
  function wave(v, w, t) { return v + w[0] * Math.sin(w.length > 2 ? w[1] * t + w[2] : w[1] * t); }
  // the coast: an outline round a centre, rippled by waves, joined by ellipses (the lighthouse headland,
  // the southwest lobe), cut by others (the harbour bay)
  function coast(x, y) {             // < 1 is land
    var C = SH.coast, a = Math.atan2(y - C.c[1], (x - C.c[0]) / C.sx), d = Math.hypot((x - C.c[0]) / C.sx, y - C.c[1]), r = C.r, i;
    for (i = 0; i < C.waves.length; i++) r = wave(r, C.waves[i], a);
    var v = d / r;
    for (i = 0; i < C.union.length; i++) v = Math.min(v, Math.hypot((x - C.union[i][0]) / C.union[i][2], (y - C.union[i][1]) / C.union[i][3]));
    for (i = 0; i < C.cut.length; i++) v = Math.max(v, C.cut[i][4] - Math.hypot((x - C.cut[i][0]) / C.cut[i][2], (y - C.cut[i][1]) / C.cut[i][3]));
    return v;
  }
  // a terrace's edge: its row at column x, a base with waves, ramps and a slope
  function edgeAt(E, x) {
    var v = E.base, i;
    for (i = 0; i < E.waves.length; i++) { var w = E.waves[i]; v = v + w[0] * Math.sin(w.length > 2 ? x * w[1] + w[2] : x * w[1]); }
    if (E.ramps) for (i = 0; i < E.ramps.length; i++) { var q = E.ramps[i]; v = v - Math.max(0, q[1] > 0 ? x - q[0] : q[0] - x) * q[2]; }
    if (E.slope) v = v - (x - E.slope[0]) * E.slope[1];
    return v;
  }
  function hiEdge(x) { return edgeAt(SH.terraces[0], x); }
  function midEdge(x) { return edgeAt(SH.terraces[1], x); }
  function tier(x, y) { return y < hiEdge(x) ? 2 : y < midEdge(x) ? 1 : 0; }
  /* the map is three layers, one value per tile, at index y * MW + x (Phase 8, D11-B), all authored in
     js/maps/home.js: GROUND, the tile codes above; HEIGHT, the terrace (0 to 5; the island uses 0 to 2
     today); and COLL, the collision flags (below). decodeMap made each the game's own array, so nothing
     the game does changes the registry's data */
  var GROUND = MAP.ground, x, y;
  function at(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? DEEP : GROUND[y * MW + x]; }
  function land(t) { return t === GRASS || t === SAND || t === PATH || t === PAD || t === BRIDGE; }
  function wet(t) { return t === DEEP || t === SHAL || t === POND || t === RIVER; }
  /* the art (handoff 3, D1): the master palette is art/palette.json (PAL below copies it); the
     environment sprites are baked by tools/envart.py into img/atlas/env.png, their frames in ENV */
  var ENV = {"mpuzzle0":[0,0,44,66,22,64],"mpuzzle1":[45,0,44,66,22,64],"mpuzzle2":[90,0,44,66,22,64],"fig0":[135,0,50,60,25,57],"fig1":[186,0,50,60,25,57],"redwood0":[237,0,28,56,14,54],"redwood1":[266,0,28,56,14,54],"palm0":[0,67,42,56,21,54],"palm1":[43,67,42,56,21,54],"palm2":[86,67,42,56,21,54],"tallfern0":[129,67,40,50,20,48],"tallfern1":[170,67,40,50,20,48],"birch0":[211,67,26,46,13,44],"birch1":[238,67,26,46,13,44],"cavemouth":[0,124,60,46,30,45],"oak0":[61,124,34,42,17,40],"oak1":[96,124,34,42,17,40],"oak2":[131,124,34,42,17,40],"ginkgo0":[166,124,30,40,15,38],"ginkgo1":[197,124,30,40,15,38],"baretree0":[228,124,30,36,15,35],"baretree1":[259,124,30,36,15,35],"tfern0":[0,171,34,34,17,32],"tfern1":[35,171,34,34,17,32],"cycad0":[70,171,24,22,12,20],"cycad1":[95,171,24,22,12,20],"rock2_0":[120,171,28,22,14,20],"rock2_1":[149,171,28,22,14,20],"rock2_2":[178,171,28,22,14,20],"rock2_3":[207,171,28,22,14,20],"rock2_4":[236,171,28,22,14,20],"horsetail0":[265,171,14,18,7,17],"magnolia0":[280,171,22,16,11,15],"rock1_0":[0,206,20,16,10,14],"rock1_1":[21,206,20,16,10,14],"rock1_2":[42,206,20,16,10,14],"rock1_3":[63,206,20,16,10,14],"rock1_4":[84,206,20,16,10,14],"reeds0":[105,206,12,16,6,15],"reeds1":[118,206,12,16,6,15],"reeds2":[131,206,12,16,6,15],"tallgrass0":[144,206,18,16,9,15],"tallgrass1":[163,206,18,16,9,15],"tallgrass2":[182,206,18,16,9,15],"bush0":[201,206,18,14,9,13],"bush1":[220,206,18,14,9,13],"fern0":[239,206,20,14,10,13],"fern1":[260,206,20,14,10,13],"rock0_0":[281,206,14,12,7,10],"rock0_1":[296,206,14,12,7,10],"rock0_2":[0,223,14,12,7,10],"rock0_3":[15,223,14,12,7,10],"rock0_4":[30,223,14,12,7,10],"nest0":[45,223,20,11,10,10],"lilies0":[66,223,16,10,8,9],"lilies1":[83,223,16,10,8,9],"lilies2":[100,223,16,10,8,9],"pebbles0":[117,223,16,8,8,7],"pebbles1":[134,223,16,8,8,7]};
  var PAL = { grass: ["#24463f", "#2e5d44", "#3d7a47", "#55944a", "#73ad51", "#98c65c"], dirt: ["#4a3634", "#6b4c3b", "#8e6a4a", "#b08c5e", "#cdaa74"],
              water: ["#1e3a66", "#23507c", "#2a6892", "#3582a8", "#48a0bc", "#6cbcca"], rim: ["#b4e4e0", "#e2f6ee"], rock: ["#2f2f44", "#4a4a5a", "#6a6a72", "#8e8c8c", "#b5b0a6", "#d6cfbd"],
              moss: ["#35553a", "#4f7a3c", "#79a24a"], wood: ["#2e2433", "#4a3635", "#6b4d3c", "#8e6a48", "#b08a5c"], flower: ["#f2e9e4", "#f5c84b", "#d98bb3", "#9d7ad2"],
              sand: ["#8f7c6a", "#b99a6c", "#d6bb86", "#ecd9a6", "#f6ecc8"], blossom: ["#e7a9bf", "#f6dde4"],
              leaf2: ["#2c4a3a", "#3f6a42", "#5c8c49", "#86ad55", "#b6cf6b"], dry: ["#4a5236", "#6b7440", "#8f944c", "#b6b060", "#d8cd80"] };   // from art/palette.json
  // the koi pond: a wobbly blob (tile units). < 1 is water
  var KP = { x: SH.pond.x, y: SH.pond.y, rx: SH.pond.rx, ry: SH.pond.ry };
  function pondF(fx, fy) {
    var dx = (fx - KP.x) / KP.rx, dy = (fy - KP.y) / KP.ry, a = Math.atan2(dy, dx), r = 1;
    for (var i = 0; i < SH.pond.waves.length; i++) r = wave(r, SH.pond.waves[i], a);
    return Math.sqrt(dx * dx + dy * dy) / r;
  }
  // roads and the river are smooth curves (catmull-rom through a few points), not grid lines
  function spline(pts, fn) {
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var u = 0; u < 1; u += 0.04) {
        var u2 = u * u, u3 = u2 * u;
        fn(0.5 * (2 * p1[0] + (p2[0] - p0[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * u3),
           0.5 * (2 * p1[1] + (p2[1] - p0[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * u3), (i + u) / (pts.length - 1));
      }
    }
    var e = pts[pts.length - 1]; fn(e[0], e[1], 1);
  }
  var CURVES = { river: [], road: [] };                               // every sample along them, for the ground painter
  function carve(pts, width, kind) {
    spline(pts, function (fx, fy, q) { var wd = typeof width === "function" ? width(q) : width; CURVES[kind].push([fx, fy, wd / 2]); });
  }
  /* the river and the roads, in the data's order (the river first): the village to the clearing, up
     past the gate to the highland, the watchtower, the cave, west over the river to the brachio meadow,
     the old trail into the woods, east past the garden along the headland, the raptor pen, the t-rex
     viewpoint, the garden, the coast road to the outpost, the helipad, the dock, the stone tablet.
     their tiles are in GROUND already; the curves are what the painter draws them from */
  var RIVERS = SH.curves.filter(function (c) { return c.kind === "river"; }), ROADS = SH.curves.filter(function (c) { return c.kind === "road"; });
  var RIVER_PTS = RIVERS[0].pts;
  RIVERS.forEach(function (c) { carve(c.pts, function (q) { return c.w[0] + q * c.w[1]; }, "river"); });
  ROADS.forEach(function (c) { carve(c.pts, c.w, "road"); });
  var PLAZA = { x: SH.plaza.x, y: SH.plaza.y, r: SH.plaza.r };       // the village square, by the harbour
  var dockY = MAP.anchors.dock[1];                                     // the last tile of land before the dock
  var HELI = { x: MAP.anchors.helipad[0], y: MAP.anchors.helipad[1] }; // the helipad, 3x3 tiles
  // buildings: the visitor centre and the supply depot on the square, the bunker in the outpost. where
  // each stands and the room behind its door are map data; the names and words are here
  var BUILDINGS = [
    { id: "visitor", name: "the visitor centre", text: "the visitor centre. the robots keep it stocked. there's a map on the wall with eight pins in it, and a sign by the door: 'lost and found: one hat, two sunglasses, a very small egg.'" },
    { id: "bunker", name: "the bunker", text: "the outpost bunker." },
    { id: "depot", name: "the supply depot", text: "the supply depot. crates come off the boat, the cargo bots haul them in here, and the drones fly them out to wherever something needs fixing." }
  ].map(function (bd) {
    var m = MAP.buildings.filter(function (q) { return q.id === bd.id; })[0];
    if (!m) throw new Error("pi's island: js/maps/home.js has no building " + bd.id);
    return { id: bd.id, x0: m.x0, y0: m.y0, w: m.w, h: m.h, room: m.room, name: bd.name, text: bd.text };
  });

  // height: which terrace each tile of ground (and water on the ground) sits on
  var HEIGHT = MAP.height;
  // the volcano is a heightfield (world px): a cone with gullies, a crater bowl and a lava lake.
  // (x, y) is the centre of its footprint; squash flattens the footprint front to back
  var VOLC = { x: SH.volcano.x, y: SH.volcano.y, R: SH.volcano.R, H: SH.volcano.H, sq: SH.volcano.sq, rc: SH.volcano.rc };
  function volcD(wx, wy) { var u = wx - VOLC.x, v = (wy - VOLC.y) * VOLC.sq; return Math.sqrt(u * u + v * v); }
  var RIMH = Math.pow(1 - VOLC.rc / VOLC.R, 1.25) * VOLC.H;
  function lvl(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? 0 : HEIGHT[y * MW + x]; }
  // the waterfalls: wherever the river runs off a cliff
  var FALLS = [];
  (function () {
    var seen = {};
    for (var yy = 1; yy < MH; yy++) for (var xx = 0; xx < MW; xx++) {
      if (GROUND[yy * MW + xx] !== RIVER || GROUND[(yy - 1) * MW + xx] !== RIVER || lvl(xx, yy - 1) <= lvl(xx, yy)) continue;
      var key = lvl(xx, yy - 1) * 100 + lvl(xx, yy);
      if (!seen[key]) { seen[key] = { n: 0, x: 0, up: lvl(xx, yy - 1) }; FALLS.push(seen[key]); }
      seen[key].n++; seen[key].x += xx;
    }
    // each fall hangs off the terrace's smooth edge, where the cliff face is drawn
    FALLS.forEach(function (f) { f.x = (f.x / f.n + 0.5) * T; f.y = (f.up === 2 ? hiEdge : midEdge)(f.x / T) * T - 4; });
  })();

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", name: "signpost", text: "Mossgate Reserve. the robots run it; pi is the newest intern. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. find all eight and something on the island wakes up. the boat at the dock takes you back. (the paddocks are fenced. please don't feed the raptors.)" },
    { id: "rack", room: "bunker", x: 2, y: 3, name: "the rack", sec: "projects", found: true, text: "Homelab v1, retired September 2026: high-availability DNS. Two Raspberry Pi 5 nodes ran AdGuard Home behind a keepalived VRRP floating IP, filtering DNS for my own devices. Failover and failback tested in both directions. Version two, one Pi built with Ansible, is in progress.", links: [["ha-dns repo ↗", GH + "homelab/tree/main/ha-dns"], ["projects", "#projects"]] },
    { id: "desk", room: "bunker", x: 6, y: 3, name: "the desk", sec: "projects", found: true, wide: true, text: "Claude intake triage assistant. Turns messy free-text help requests into structured, reviewable records (category, urgency, summary, next step, human-review flag) via Google Forms, Apps Script, and the Claude API. A 15-case eval harness took classification accuracy to 100% and multi-need coverage from 0% to 90%. Every record carries a human-review flag.", links: [["repo ↗", GH + "claude-intake-triage"], ["demo ↗", "https://www.loom.com/share/c43efcd9c3314bcd9cda3002282d31a5"], ["projects", "#projects"]] },
    { id: "uplink", name: "the uplink", sec: "projects", found: true, text: "AWS static site with Terraform. A private S3 bucket served over HTTPS through CloudFront with Origin Access Control, provisioned entirely with Terraform. Deployment and teardown are scripted and documented.", links: [["terraform repo ↗", GH + "homelab/tree/main/terraform-aws-static-site"], ["projects", "#projects"]] },
    { id: "tower", name: "the watchtower", sec: "projects", found: true, text: "monitoring-stack: Prometheus scrapes host and container metrics, Grafana charts them. Docker Compose. uptime-monitoring: Uptime Kuma in Docker, tracking availability and response health for the homelab's services. (from up here you can see the whole island, and the volcano is still warm.)", links: [["monitoring ↗", GH + "homelab/tree/main/monitoring-stack"], ["uptime ↗", GH + "homelab/tree/main/uptime-monitoring"], ["projects", "#projects"]] },
    { id: "lighthouse", name: "the lighthouse", sec: "experience", found: true, text: "Cyber Ready Clinic, Cyber Security Analyst, Sep 2026 – present, Maryland · internship cohort. Support nonprofit cyber-readiness assessments using the Discover5 business-risk and Ready5 capability frameworks, with findings aligned to the NIST Cybersecurity Framework and CIS Controls. Working toward the Ready5 Practitioner digital badge, expected Nov 2026 on cohort completion. Also: NextGen Consulting Inc., Cloud & AI Operations Intern, May 2025 – present. HCC Campus Store · Slingshot, Campus Operations Associate, Aug 2024 – present.", links: [["experience", "#experience"]] },
    { id: "macbook", name: "a macbook on a blanket", sec: "projects", found: true, text: "ammaarrehman.com. This site. Plain HTML, CSS, JavaScript and a little Python, no frameworks. The orb, the island, and the boot screen are all canvas. (you're standing in it.)", links: [["site repo ↗", GH + "ammaarrehman.github.io"], ["projects", "#projects"]] },
    { id: "tablet", name: "a stone tablet", sec: "education & certs", found: true, text: "Howard Community College, A.A. General Studies, Aug 2024 – Dec 2026, GPA 3.65 · Dean's List. UMD · Smith School of Business, B.S. Information Systems, starts Jan 2027. Certifications: AWS Certified Cloud Practitioner (CLF-C02), CompTIA Tech+, Ready5 Practitioner (Cyber Ready Clinic, in progress · expected Nov 2026).", links: [["education", "#education"]] },
    { id: "mailbox", name: "the mailbox", sec: "contact", found: true, text: "ammaarrehmanf@gmail.com. Want to talk? Email is the fastest way to reach me.", links: [["email ↗", "mailto:ammaarrehmanf@gmail.com"], ["linkedin ↗", "https://www.linkedin.com/in/ammaarrehman/"], ["contact", "#contact"]] },
    { id: "drink", name: "a drink stand", text: "pi takes a sip. zoom mode for ten seconds." },
    { id: "shrine", name: "an old shrine", text: "" },
    { id: "cave", name: "a cave in the cliff", text: "there's a terminal in here, still humming. someone left it logged in." },
    { id: "boat", name: "the boat", text: "the boat back to the mainland. sail back to the site?", links: [["sail back ↩", "#exit"]] }
  ].map(function (s) {             // an outdoor landmark's place is map data; the words are here
    if (s.room) return s;
    var p = MAP.stations[s.id];
    if (!p) throw new Error("pi's island: js/maps/home.js has no place for " + s.id);
    return Object.assign({ id: s.id, x: p[0], y: p[1] }, s);
  });
  var TOTAL = STATIONS.filter(function (s) { return s.found; }).length;
  var OUT = STATIONS.filter(function (s) { return !s.room; });        // the landmarks that stand outdoors
  /* ════════ the save ════════
     one versioned object in localStorage: the logs found, the secrets, whether pi has evolved,
     where pi was, the comfort settings, who holds the core, whether the credits have rolled.
     version 2 (Phase 8, D11) adds room for the later phases: which island pi is on, quests, the
     Field Guide (dex), story flags, cosmetics, tools, and whether the Edge has been seen. a
     version 1 save is rewritten as version 2 the first time it loads, keeping everything in it.
     a bad parse or a broken save starts fresh instead of breaking the island; a save from a newer
     version is left alone (play goes on with a fresh one that is never written over it); and a
     browser that refuses storage (a private window) just doesn't remember */
  var SAVE_KEY = "island-save", SAVE_V = 2;
  function freshSave() {
    return { v: SAVE_V, logs: [], secrets: [], evolved: false, lastPos: null, settings: null, ruler: null, credits: false, hatched: false, seal: false, hints: { move: false, use: false },
             island: "home", quests: {}, dex: {}, flags: {}, cosmetics: {}, tools: {}, edgeSeen: false };
  }
  var save = freshSave(), saveLocked = false;
  // the save's own checks. ids are short lowercase names; a list or map holds at most 64, which keeps
  // the whole save well under 50 KB however it is filled
  var SAVE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/, SAVE_MAX = 64;
  function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
  function isBool(x) { return typeof x === "boolean"; }
  function isEntry(x) { return isBool(x) || (typeof x === "number" && isFinite(x)) || (typeof x === "string" && x.length <= 32); }
  function idList(a) { var out = []; if (Array.isArray(a)) a.forEach(function (x) { if (typeof x === "string" && x.length <= 64 && out.indexOf(x) < 0 && out.length < SAVE_MAX) out.push(x); }); return out; }
  function idMap(o, ok) { var out = {}, n = 0; if (isObj(o)) Object.keys(o).forEach(function (k2) { if (n < SAVE_MAX && SAVE_ID.test(k2) && ok(o[k2])) { out[k2] = o[k2]; n++; } }); return out; }
  // a parsed save of either version, as a version 2 save; null if it is neither. version 1 fields
  // keep what version 1 kept (only values the game can't use are dropped); the new fields start
  // empty for a version 1 save and are checked for a version 2 one
  function mergeSave(o) {
    if (!isObj(o) || (o.v !== 1 && o.v !== 2) || !Array.isArray(o.logs)) return null;
    var m = freshSave();
    m.logs = idList(o.logs); m.secrets = idList(o.secrets);
    ["evolved", "credits", "hatched", "seal"].forEach(function (k2) { if (isBool(o[k2])) m[k2] = o[k2]; });
    if (Array.isArray(o.lastPos) && o.lastPos.length === 2 && isFinite(o.lastPos[0]) && isFinite(o.lastPos[1])) m.lastPos = [+o.lastPos[0], +o.lastPos[1]];
    if (isObj(o.settings)) {
      m.settings = {};
      if (typeof o.settings.shake === "number" && isFinite(o.settings.shake)) m.settings.shake = o.settings.shake;
      if (isBool(o.settings.flash)) m.settings.flash = o.settings.flash;
      if (isBool(o.settings.map)) m.settings.map = o.settings.map;
    }
    if (typeof o.ruler === "string" && o.ruler.length <= 32) m.ruler = o.ruler;
    if (isObj(o.hints)) { m.hints.move = o.hints.move === true; m.hints.use = o.hints.use === true; }
    if (o.v === 2) {
      if (typeof o.island === "string" && SAVE_ID.test(o.island)) m.island = o.island;
      m.quests = idMap(o.quests, isEntry); m.dex = idMap(o.dex, isEntry); m.cosmetics = idMap(o.cosmetics, isEntry);
      m.flags = idMap(o.flags, isBool); m.tools = idMap(o.tools, isBool);
      if (isBool(o.edgeSeen)) m.edgeSeen = o.edgeSeen;
    }
    return m;
  }
  (function () {
    var o = null; try { o = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { o = null; }
    var m = mergeSave(o);
    if (m) { save = m; if (o.v !== SAVE_V) writeSave(); return; }                       // version 1: rewritten as version 2 now
    if (isObj(o) && typeof o.v === "number" && o.v > SAVE_V) { saveLocked = true; return; }   // newer than this code: don't touch it
    try {                                                            // no save yet: bring over the older per-session keys
      var old = JSON.parse(sessionStorage.getItem("pi-found") || "[]"); if (Array.isArray(old)) save.logs = idList(old);
      save.evolved = sessionStorage.getItem("pi-kaiju") === "1"; save.ruler = sessionStorage.getItem("rift-done") || null; save.hatched = sessionStorage.getItem("pi-hatched") === "1";
    } catch (e) {}
  })();
  function writeSave() { if (saveLocked) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  var found = {};
  save.logs.forEach(function (k2) { if (typeof k2 === "string") found[k2] = 1; });

  /* ════════ collision ════════ */
  function k(x, y) { return x + "," + y; }
  function near(x, y, r, fn) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (fn(x + i, y + j)) return true; return false; }
  // the park gate over the north road, the electric fences around the paddocks and the outpost's sandbag
  // walls: where they stand is map data, the fence and wall tiles (drawn as sprites) follow from it, and
  // what can't be walked through is already in COLL
  var GATE = { x: MAP.anchors.gate[0], y: MAP.anchors.gate[1] };
  var PADDOCKS = MAP.regions.paddocks.map(function (p) { return { name: p[0], x0: p[1], y0: p[2], x1: p[3], y1: p[4] }; });
  var COMPOUND = MAP.regions.compound;                                  // or null: no outpost
  var fence = {}, wall = {};
  PADDOCKS.forEach(function (p) {
    for (y = p.y0; y <= p.y1; y++) for (x = p.x0; x <= p.x1; x++) if ((x === p.x0 || x === p.x1 || y === p.y0 || y === p.y1) && land(at(x, y))) fence[k(x, y)] = 1;
  });
  if (COMPOUND) for (y = COMPOUND.y0; y <= COMPOUND.y1; y++) for (x = COMPOUND.x0; x <= COMPOUND.x1; x++) {
    if (!(x === COMPOUND.x0 || x === COMPOUND.x1 || y === COMPOUND.y0 || y === COMPOUND.y1) || !land(at(x, y)) || at(x, y) === PATH || (x === COMPOUND.x1 && COMPOUND.gate.indexOf(y) >= 0)) continue;
    wall[k(x, y)] = 1;
  }
  /* the woods' shade on the ground: a low-frequency noise field, raised round the woods the data names */
  function fbm(x, y) {
    var v = 0, a2 = 1, f = 0.07, n = 0;
    for (var o = 0; o < 3; o++) { v += a2 * (Math.sin(x * f + o * 1.7) * Math.cos(y * f * 1.13 + o * 2.3) + Math.sin((x + y) * f * 0.7 + o)); n += a2 * 2; a2 *= 0.5; f *= 2.1; }
    return v / n;
  }
  var FOREST_BIAS = SH.woods;
  function forest(x, y) {
    var v = fbm(x, y) + 0.08;
    FOREST_BIAS.forEach(function (fb) { v += fb[3] * Math.max(0, 1 - Math.hypot(x - fb[0], y - fb[1]) / fb[2]); });
    return v;
  }
  /* the props: trees, palms, ferns, rocks, nests, lamps, the outpost's kit, crates. static, y-sorted with
     everything else, authored in the data (decodeMap copied them, so the list is the game's own). TALL is every
     tree pi can walk behind */
  var TALL = /^e:(oak|birch|ginkgo|mpuzzle|redwood|palm|fig|tallfern)/;
  var props = MAP.props;
  var nests = props.filter(function (p) { return p.kind === "e:nest0"; });     // each with a clutch of speckled eggs
  var COLL = MAP.coll;                                                  // the collision layer, authored (the flags are above)
  function walkable(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH && !(COLL[y * MW + x] & C_BLOCK); }
  /* footBlock, authored: the pixels where feet stop on tiles COLL lets them onto (the river's, pond's and
     sea's wandering edges, a bridge's rails excepted). the data holds runs per pixel row; here they are one
     bit per pixel. so where feet stop is COLL and footBlock, nothing else: the painted ground (GK, below)
     is only a picture */
  var PW = MW * T, PH = MH * T;
  var FOOT = MAP.foot;
  function solidPx(px, py) {
    var tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (!walkable(tx, ty)) return true;
    var b = Math.floor(py) * PW + Math.floor(px);
    return (FOOT[b >>> 5] >>> (b & 31) & 1) === 1;
  }

  /* ════════ sprites (drawn once into little canvases) ════════ */
  function sprite(w, h, fn) { var c = mkCanvas(); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // pick one of a few tones for a shade in [0,1], ordered-dithered so the bands blend like 16-bit art
  function tone(v, tones, x, y) {
    var f = Math.max(0, Math.min(0.999, v)) * (tones.length - 1), i = Math.floor(f);
    return (f - i) > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? tones[Math.min(tones.length - 1, i + 1)] : tones[i];
  }
  var BARK = ["#3a2616", "#553820", "#6e4a2a", "#8a6038"];
  // a 1px outline around everything opaque: the single biggest readability win in pixel art
  function outline(src, col) {
    var w0 = src.width, h0 = src.height, c = mkCanvas(); c.width = w0 + 2; c.height = h0 + 2;
    var g = c.getContext("2d"); g.drawImage(src, 1, 1);
    var d = g.getImageData(1, 1, w0, h0).data;       // read the copy: some sources were already read while being drawn
    function A(x, y) { return x >= 0 && y >= 0 && x < w0 && y < h0 && d[(y * w0 + x) * 4 + 3] > 40; }
    g.globalCompositeOperation = "destination-over"; g.fillStyle = col;       // under the sprite, as if drawn first
    for (var y = -1; y <= h0; y++) for (var x = -1; x <= w0; x++)
      if (!A(x, y) && (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
    g.globalCompositeOperation = "source-over";
    return c;
  }


  /* the man-made sprites (buildings, landmarks, lamps, crates, the outpost's kit, the park gate)
     are baked by tools/atlas.mjs from tools/props-src.js into img/atlas/props.png (handoff 3 D2).
     each gets its canvas now, at its size, so anything can ask for sizes straight away; the pixels
     arrive with the image. atlas sprites (the environment's too) join SPR under their names */
  var PROPS = {"visitor":[0,0,70,62],"gate":[71,0,92,60],"mast":[164,0,14,52],"lighthouse":[179,0,20,50],"depot":[200,0,54,48],"bunker":[0,63,72,46],"tower":[73,63,24,40],"shrine":[98,63,24,36],"uplink":[123,63,22,30],"drink":[146,63,26,28],"rack":[173,63,18,28],"desk":[192,63,36,26],"tank":[229,63,16,26],"tablet":[0,110,18,24],"boat":[19,110,38,22],"mailbox":[58,110,14,22],"sign":[73,110,18,22],"lamp":[92,110,9,20],"macbook":[102,110,32,20],"crates":[135,110,17,18],"generator":[153,110,20,17],"solar":[174,110,20,16],"tent":[195,110,24,16],"cave":[220,110,16,14],"campfire":[237,110,18,10]};
  var SPR = {};
  Object.keys(PROPS).forEach(function (n) { var c = mkCanvas(); c.width = PROPS[n][2]; c.height = PROPS[n][3]; SPR[n] = c; });
  var PROPS_IMG = new Image();
  PROPS_IMG.onload = function () {
    Object.keys(PROPS).forEach(function (n) { var e = PROPS[n]; SPR[n].getContext("2d").drawImage(PROPS_IMG, e[0], e[1], e[2], e[3], 0, 0, e[2], e[3]); });
    if (skinCache) { skinCache.forEach(function (e) { Object.keys(e).forEach(function (k2) { freeCanvas(e[k2]); }); }); skinCache.clear(); }   // nothing reskinned from the empty canvases
  };
  PROPS_IMG.src = "img/atlas/props.png?v=20261022";

  /* ════════ ground, drawn once (handoff 3, D1) ════════
     pixel by pixel, into one buffer. every pixel is grass, dirt, sand or water, decided from a
     smooth field (each tile's type blended across its neighbours) plus a little noise, so edges
     wander a few pixels off the tile grid instead of stepping along it; walking still follows the
     tiles. grass is lit on the edge it overhangs and throws a cool shadow on the dirt or sand below
     it. water has a pale rim along every edge, is lighter in the shallows and shows stones under
     the surface near the banks; the sea deepens with the distance from shore. flowers, clover,
     pebbles and twigs grow in drifts. GK keeps each pixel's kind so the game can ask later (the
     foam, the glints). it's a picture only: where feet stop is COLL and footBlock, above */
  var KG = 1, KD = 2, KS = 3, KW = 4;
  var GK = new Uint8Array(PW * PH);
  function kAt(px, py) { return px < 0 || py < 0 || px >= PW || py >= PH ? KW : GK[py * PW + px]; }
  function field(fx, fy, test) {                               // 0..1: how much of (fx, fy) passes test
    var x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5), u = fx - 0.5 - x0, v = fy - 0.5 - y0;
    var a = test(at(x0, y0)) ? 1 : 0, b = test(at(x0 + 1, y0)) ? 1 : 0, c = test(at(x0, y0 + 1)) ? 1 : 0, d = test(at(x0 + 1, y0 + 1)) ? 1 : 0;
    var su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
  }
  var BAY2 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function soft(v, ramp, x, y, spread) {
    var n = ramp.length, q = v * (n - 1) + ((BAY2[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * (spread || 0.28);
    return ramp[Math.max(0, Math.min(n - 1, Math.round(q)))];
  }
  function isDirt(t) { return t === PATH || t === PAD; }
  function isPad(t) { return t === PAD; }
  /* the river and the roads are drawn from their curves, not their tiles: CG holds, per tile, the
     curve samples near it, and curveD is how far (in tiles) a point is outside the nearest one */
  var CG = {};
  Object.keys(CURVES).forEach(function (kd) {
    var grid = CG[kd] = new Array(MW * MH);
    CURVES[kd].forEach(function (c) {
      var R = c[2] + 0.45;                                          // enough for the edge noise
      for (var yy = Math.floor(c[1] - R); yy <= Math.floor(c[1] + R); yy++) for (var xx = Math.floor(c[0] - R); xx <= Math.floor(c[0] + R); xx++) {
        if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
        (grid[yy * MW + xx] = grid[yy * MW + xx] || []).push(c);
      }
    });
  });
  function curveD(grid, fx, fy) {
    var tx = Math.floor(fx), ty = Math.floor(fy), cs = tx >= 0 && ty >= 0 && tx < MW && ty < MH && grid[ty * MW + tx], best = 9;
    if (cs) for (var q = 0; q < cs.length; q++) { var c = cs[q], d = Math.hypot(fx - c[0], fy - c[1]) - c[2]; if (d < best) best = d; }
    return best;
  }
  function isRiv(t) { return t === RIVER || t === BRIDGE; }
  function isSea(t) { return t === SHAL || t === DEEP || t === DOCK; }
  /* slow noise changes little from pixel to pixel, so it's worked out once per 2x2 block, when first asked for */
  function blockNoise(arr, px, py, fn) {
    var bi = (py >> 1) * (PW >> 1) + (px >> 1), v = arr[bi];
    if (v !== v) v = arr[bi] = fn((px | 1) / T, (py | 1) / T, px, py);
    return v;
  }
  function edgeNoise(fx, fy, px, py) { return (hash(px >> 1, py >> 1) - 0.5) * 0.12 + fbm(fx * 3.1 + 5, fy * 3.1) * 0.22; }
  var NK;
  function kindAt(px, py) {
    var tx = Math.floor(px / T), ty = Math.floor(py / T), t0 = at(tx, ty);
    if (t0 === BRIDGE) return KW;                                 // the planks go over it later
    var fx = (px + 0.5) / T, fy = (py + 0.5) / T, n = blockNoise(NK, px, py, edgeNoise);
    if (t0 === POND || (t0 === GRASS && pondF(fx, fy) < 1.2)) return pondF(fx + n * 0.2, fy) < 1 ? KW : KG;
    if (curveD(CG.river, fx, fy) + n * 0.5 < 0 && (t0 === RIVER || t0 === GRASS || t0 === SAND)) return KW;
    if (t0 !== RIVER && !isSea(t0) && (curveD(CG.road, fx, fy) + n * 0.5 < 0 || Math.hypot(fx - PLAZA.x, fy - PLAZA.y) - PLAZA.r + n * 0.5 < 0 || field(fx, fy, isPad) + n > 0.5)) return KD;
    var cv = coast(fx, fy) + n * 0.03;                            // the shore follows the island's own smooth outline
    return cv > 1.012 ? KW : cv > 0.925 || isSea(t0) ? KS : KG;   // the waterline sits a little out to sea: never wading on dry tiles
  }
  // colours as 32-bit pixels (little-endian RGBA), for writing straight into the buffer
  var C32 = {};
  function c32(hex) {
    var v = C32[hex]; if (v !== undefined) return v;
    var n = parseInt(hex.slice(1), 16);
    return (C32[hex] = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0);
  }
  var P32 = {}; Object.keys(PAL).forEach(function (k2) { P32[k2] = PAL[k2].map(c32); });
  /* grass comes in four kinds per terrace (D1 rule 6). the kinds: short, lush, dry, a fern floor,
     moss, heath, and sandy scrub. each terrace has a base kind, one for the low spots of a slow
     noise, one for the high spots, and one for the ground round the woods; the lowland's sandy
     scrub grows just behind the beach. kinds meet in a dither, not a line */
  var GSHORT = 0, GLUSH = 1, GDRY = 2, GFERN = 3, GMOSS = 4, GHEATH = 5, GSANDY = 6;
  var GRAMP = [
    { ramp: P32.grass, lift: 0 }, { ramp: P32.grass, lift: -0.13 }, { ramp: P32.dry, lift: 0.02 }, { ramp: P32.leaf2, lift: 0.04 },
    { ramp: [PAL.grass[0], PAL.moss[0], PAL.moss[1], PAL.grass[3], PAL.moss[2], PAL.grass[5]].map(c32), lift: 0.02 }, { ramp: P32.dry, lift: -0.14 }, { ramp: P32.grass, lift: 0.06 }
  ];
  var BIOME = [                                                  // by terrace: the lowland, the meadows, the highland
    { lift: 0.03, base: GSHORT, lo: GLUSH, hi: GDRY, woods: GLUSH },
    { lift: 0, base: GSHORT, lo: GLUSH, hi: GDRY, woods: GFERN },
    { lift: -0.02, base: GMOSS, lo: GSHORT, hi: GHEATH, woods: GFERN }
  ];
  function grassKind(fx, fy, fo, vn, tr, cv) {                    // tr, cv: the terrace and coast() there, if already known
    var B = BIOME[tr === undefined ? tier(fx, fy) : tr];
    if (fo > 0.2 + vn * 0.1) return B.woods;
    if (B === BIOME[0] && (cv === undefined ? coast(fx, fy) : cv) > 0.84 + vn * 0.03) return GSANDY;
    return vn < -0.18 ? B.lo : vn > 0.22 ? B.hi : B.base;
  }

  var COL = { deep: PAL.water[1], dock: "#8b5e34", dock2: "#6e4826" };
  var ground = mkCanvas(); ground.width = PW; ground.height = PH;
  // how far each water tile is from land, in tiles (the night sky's reflections use it)
  var DEPTH = [];
  (function () {
    var q = [], x, y;
    for (y = 0; y < MH; y++) { DEPTH.push([]); for (x = 0; x < MW; x++) { var lt = land(GROUND[y * MW + x]) || GROUND[y * MW + x] === DOCK || GROUND[y * MW + x] === LAVA; DEPTH[y].push(lt ? 0 : 99); if (lt) q.push([x, y]); } }
    while (q.length) {
      var c = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (n) {
        var nx = c[0] + n[0], ny = c[1] + n[1];
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || DEPTH[ny][nx] <= DEPTH[c[1]][c[0]] + 1) return;
        DEPTH[ny][nx] = DEPTH[c[1]][c[0]] + 1; q.push([nx, ny]);
      });
    }
  })();
  var WD, groundMs = performance.now();                         // WD: each water pixel's distance to land, x3 (chamfer)
  (function paint() {
    var g = ground.getContext("2d"), img = g.createImageData(PW, PH), buf = new Uint32Array(img.data.buffer);
    function r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    function put(px, py, c) { if (px >= 0 && py >= 0 && px < PW && py < PH) buf[py * PW + px] = c; }
    var tx, ty, px, py, i;
    NK = new Float32Array((PW >> 1) * (PH >> 1)).fill(NaN);
    var NG = new Float32Array(NK.length).fill(NaN), ND = new Float32Array(NK.length).fill(NaN), NS = new Float32Array(NK.length).fill(NaN), NR = new Float32Array(NK.length).fill(NaN);
    function patchN(fx, fy) { return fbm(fx * 1.6 + 7, fy * 1.6); }
    var NV = new Float32Array(NK.length).fill(NaN);
    function kindN(fx, fy) { return fbm(fx * 0.45 + 31, fy * 0.45 + 17); }
    var NT = new Float32Array(NK.length).fill(NaN), NC = new Float32Array(NK.length).fill(NaN), NF = new Float32Array(NK.length).fill(NaN);
    function dirtN(fx, fy) { return fbm(fx * 4 + 30, fy * 4); }
    function sandN(fx, fy) { return fbm(fx * 3 + 60, fy * 3); }
    function ribN(fx, fy) { return fbm(fx, fy) * 6; }

    // 1. what every pixel is. a tile whose neighbours all match is the same all the way through
    for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
      var t0 = GROUND[ty * MW + tx], same = t0 !== BRIDGE && !(t0 === GRASS && pondF(tx + 0.5, ty + 0.5) < 1.6) && !CG.river[ty * MW + tx] && !CG.road[ty * MW + tx];
      for (var j2 = -1; j2 <= 1 && same; j2++) for (var i2 = -1; i2 <= 1 && same; i2++) if (at(tx + i2, ty + j2) !== t0) same = false;
      var kd0 = same ? (t0 === GRASS ? KG : isDirt(t0) ? KD : t0 === SAND ? KS : KW) : 0;
      for (py = ty * T; py < ty * T + T; py++) for (px = tx * T; px < tx * T + T; px++) GK[py * PW + px] = kd0 || kindAt(px, py);
    }
    // 2. how far each water pixel is from the bank: a two-pass chamfer distance (3 across, 4 diagonal)
    WD = new Uint16Array(PW * PH);
    for (i = 0; i < PW * PH; i++) WD[i] = GK[i] === KW ? 60000 : 0;
    for (py = 0; py < PH; py++) for (px = 0; px < PW; px++) {
      i = py * PW + px; if (!WD[i]) continue;
      var m = WD[i];
      if (px > 0) m = Math.min(m, WD[i - 1] + 3);
      if (py > 0) { m = Math.min(m, WD[i - PW] + 3); if (px > 0) m = Math.min(m, WD[i - PW - 1] + 4); if (px < PW - 1) m = Math.min(m, WD[i - PW + 1] + 4); }
      WD[i] = m;
    }
    for (py = PH - 1; py >= 0; py--) for (px = PW - 1; px >= 0; px--) {
      i = py * PW + px; if (!WD[i]) continue;
      m = WD[i];
      if (px < PW - 1) m = Math.min(m, WD[i + 1] + 3);
      if (py < PH - 1) { m = Math.min(m, WD[i + PW] + 3); if (px < PW - 1) m = Math.min(m, WD[i + PW + 1] + 4); if (px > 0) m = Math.min(m, WD[i + PW - 1] + 4); }
      WD[i] = m;
    }

    // 3. colour. forest cover is slow to work out, so once per tile
    var FO = new Float32Array(MW * MH);
    for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) FO[ty * MW + tx] = forest(tx, ty);
    function foAt(fx, fy) {                                     // blended between tile centres, so the woods' shade has no tile edges
      var x0 = Math.max(0, Math.min(MW - 2, Math.floor(fx - 0.5))), y0 = Math.max(0, Math.min(MH - 2, Math.floor(fy - 0.5))), u = Math.max(0, Math.min(1, fx - 0.5 - x0)), v = Math.max(0, Math.min(1, fy - 0.5 - y0));
      return (FO[y0 * MW + x0] * (1 - u) + FO[y0 * MW + x0 + 1] * u) * (1 - v) + (FO[(y0 + 1) * MW + x0] * (1 - u) + FO[(y0 + 1) * MW + x0 + 1] * u) * v;
    }
    for (py = 0; py < PH; py++) for (px = 0; px < PW; px++) {
      i = py * PW + px;
      var kd = GK[i], fx = (px + 0.5) / T, fy = (py + 0.5) / T, c;
      tx = px >> 4; ty = py >> 4;
      if (kd === KG) {
        var fo = blockNoise(NF, px, py, foAt), patch = blockNoise(NG, px, py, patchN), tr = blockNoise(NT, px, py, tier);
        var gk = grassKind(fx, fy, fo, blockNoise(NV, px, py, kindN) + ((BAY2[(py & 3) * 4 + (px & 3)] + 0.5) / 16 - 0.5) * 0.12, tr, tr ? 0 : blockNoise(NC, px, py, coast)), GR = GRAMP[gk];
        var gv = 0.71 + patch * 0.28 - Math.max(0, Math.min(1, (fo - 0.1) * 4)) * 0.2 + BIOME[tr].lift + GR.lift;
        var below = kAt(px, py + 1);
        if (below !== KG) gv = 0.98;                                           // the lit lip where grass overhangs
        else if (kAt(px, py + 2) === KD || kAt(px, py + 2) === KS) gv = Math.max(gv, 0.8);
        c = gk === GSANDY && below === KG && hash(px, py * 7) < 0.2 ? soft(0.55 + patch * 0.3, P32.sand, px, py) : soft(gv, GR.ramp, px, py, 0.2);
      } else if (kd === KD) {
        var dv = 0.58 + (hash(px >> 1, py >> 1) - 0.5) * 0.28 + blockNoise(ND, px, py, dirtN) * 0.2;
        if (kAt(px, py - 1) === KG || kAt(px, py - 2) === KG) dv = 0.12;       // grass is a step higher: its cool shadow on the dirt
        else if (kAt(px - 1, py) === KG) dv -= 0.25;
        c = soft(dv, P32.dirt, px, py);
      } else if (kd === KS) {
        // sand: pale and dry up the beach, ribbed by the wind, darker and wet by the water
        var wetD = 99;
        for (var q = 1; q <= 4 && wetD === 99; q++) if (kAt(px, py + q) === KW || kAt(px, py - q) === KW || kAt(px + q, py) === KW || kAt(px - q, py) === KW) wetD = q;
        var sv = 0.62 + (hash(px >> 1, py >> 1) - 0.5) * 0.2 + blockNoise(NS, px, py, sandN) * 0.2 + (Math.sin(px * 0.35 + py * 0.9 + blockNoise(NR, px, py, ribN)) > 0.86 ? 0.2 : 0);
        if (wetD <= 4) sv = 0.18 + wetD * 0.08;
        if (kAt(px, py - 1) === KG || kAt(px, py - 2) === KG) sv = 0.02;       // under the grass lip
        c = soft(sv, P32.sand, px, py, 0.3);
      } else {
        var d = WD[i] / 3, tt = GROUND[ty * MW + tx], wv;
        if (d <= 1.01) c = P32.rim[(px + py) % 3 ? 0 : 1];
        else {
          if (tt === POND) wv = 0.85 - Math.min(1, 1 - pondF(fx, fy)) * 0.75;
          else if (isRiv(tt) || (tt !== SHAL && tt !== DEEP && tt !== DOCK && curveD(CG.river, fx, fy) < 0.4)) wv = d <= 5 ? 0.35 + Math.round(d) * 0.1 : 0.3;
          else wv = 0.2 + 0.72 * Math.exp(-(d - 2) / 26);                      // the sea: turquoise over the sand, deepening offshore
          c = soft(Math.min(0.95, wv), P32.water, px, py, 0.22);
        }
      }
      buf[i] = c;
    }
    // stones under the surface near the banks, and sand showing through the sea's shallows
    for (var n3 = 0; n3 < (PW * PH) / 700; n3++) {
      var sx = Math.floor(hash(n3, 7) * PW), sy = Math.floor(hash(3, n3) * PH), si = sy * PW + sx, rr = 1.5 + hash(n3, 5) * 1.6;
      if (GK[si] !== KW || WD[si] < 6 || WD[si] > 24) continue;
      var seaS = isSea(at(sx >> 4, sy >> 4));
      if (seaS && hash(n3, 11) < 0.7) continue;
      for (var yy = -2; yy <= 2; yy++) for (var xx = -3; xx <= 3; xx++) {
        if ((xx * xx) / (rr * rr * 1.6) + (yy * yy) / (rr * rr) > 1 || kAt(sx + xx, sy + yy) !== KW || WD[(sy + yy) * PW + sx + xx] < 5) continue;
        put(sx + xx, sy + yy, yy < 0 && xx < 1 ? P32.water[3] : P32.water[1]);
      }
    }
    for (py = 0; py < PH; py += 2) for (px = (py >> 1) & 1; px < PW; px += 3) {
      i = py * PW + px;
      if (GK[i] === KW && WD[i] > 6 && WD[i] < 40 && isSea(at(px >> 4, py >> 4)) && hash(px, py) < 0.06) buf[i] = P32.water[5];
    }

    // decals, in drifts: tufts, flowers (one colour per drift), clover, pebbles by paths and water,
    // twigs under trees, shells on the beach
    for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
      var tl = GROUND[ty * MW + tx], X = tx * T, Y = ty * T, hh = hash(tx * 13, ty * 7);
      if (tl === SAND) {
        if (hash(tx, ty * 3) < 0.05) { var shx = X + 3 + ((hh * 9) | 0), shy = Y + 4 + ((hash(ty, tx) * 8) | 0); if (kAt(shx, shy) === KS) { put(shx, shy, P32.flower[0]); put(shx + 1, shy, P32.blossom[0]); put(shx, shy + 1, P32.sand[1]); } }
        continue;
      }
      if (tl !== GRASS) continue;
      var fl = fbm(tx * 0.8 + 500, ty * 0.8 + 77), fo2 = FO[ty * MW + tx], gk2 = grassKind(tx + 0.5, ty + 0.5, fo2, kindN(tx + 0.5, ty + 0.5)), GR2 = GRAMP[gk2].ramp;
      for (var tf = 0; tf < 4; tf++) {
        var bxt = X + 1 + Math.floor(hash(tx * 5 + tf, ty * 9) * 13), byt = Y + 2 + Math.floor(hash(ty * 7 + tf, tx * 2) * 12);
        if (kAt(bxt, byt) !== KG || kAt(bxt, byt + 2) !== KG) continue;
        if (gk2 === GFERN) {                                    // a little frond, leaning down to the right
          for (var fr = 0; fr < 4; fr++) { put(bxt + fr, byt + (fr >> 1), GR2[fr < 2 ? 3 : 2]); if (fr % 2) put(bxt + fr, byt + (fr >> 1) - 1, GR2[4]); }
        } else if (gk2 === GMOSS && tf % 2) {                   // cushions of moss
          put(bxt, byt, GR2[4]); put(bxt + 1, byt, GR2[4]); put(bxt, byt + 1, GR2[2]); put(bxt + 1, byt + 1, GR2[2]); put(bxt + 2, byt + 1, GR2[3]);
        } else {                                                // a tuft; dry grass and heath carry seed heads
          var tip = gk2 === GDRY || gk2 === GHEATH ? P32.dry[4] : GR2[GR2.length - 1];
          put(bxt, byt, GR2[2]); put(bxt, byt + 1, GR2[2]); put(bxt - 1, byt - 1, GR2[2]); put(bxt + 1, byt - 1, tip);
          if (gk2 === GDRY && tf === 1) put(bxt + 1, byt - 2, P32.dry[3]);
        }
      }
      if (gk2 === GHEATH && hh < 0.7) for (var ht = 0; ht < 3 + Math.floor(hh * 4); ht++) {   // heather: small purple sprays
        var hx2 = X + 2 + Math.floor(hash(tx * 9 + ht, ty) * 12), hy2 = Y + 2 + Math.floor(hash(tx, ty * 9 + ht) * 12);
        if (kAt(hx2, hy2) === KG) { put(hx2, hy2, P32.flower[3]); put(hx2 + 1, hy2 + 1, P32.flower[3]); put(hx2, hy2 + 1, P32.dry[1]); }
      }
      if (gk2 === GSANDY && hh < 0.5) { var sp2 = X + 3 + Math.floor(hh * 18), sq2 = Y + 5 + Math.floor(hash(ty, tx * 3) * 8); if (kAt(sp2, sq2) === KG) { put(sp2, sq2, P32.rock[4]); put(sp2 + 1, sq2, P32.sand[3]); put(sp2, sq2 + 1, P32.rock[2]); } }
      if (fl > 0.22 && fo2 < 0.2 && hh < 0.75 && gk2 !== GMOSS && gk2 !== GHEATH) {
        var fc = P32.flower[Math.floor(hash(tx >> 2, ty >> 2) * 4)];
        for (var f2 = 0; f2 < 2 + Math.floor(hh * 4); f2++) {
          var fx2 = X + 2 + Math.floor(hash(tx * 3 + f2, ty) * 12), fy2 = Y + 2 + Math.floor(hash(tx, ty * 3 + f2) * 12);
          if (kAt(fx2, fy2) !== KG) continue;
          put(fx2, fy2, fc); put(fx2 - 1, fy2 + 1, fc); put(fx2 + 1, fy2 + 1, fc); put(fx2, fy2 + 2, fc);
          put(fx2, fy2 + 1, fc === P32.flower[1] ? c32("#c8762e") : P32.flower[1]);
        }
      } else if ((gk2 === GLUSH ? fbm(tx * 1.3 + 900, ty * 1.3) > 0 : fbm(tx * 1.3 + 900, ty * 1.3) > 0.3) && hh < 0.6 && gk2 !== GSANDY) {
        for (var c2 = 0; c2 < 3; c2++) {
          var cx3 = X + 3 + Math.floor(hash(tx + c2, ty * 5) * 10), cy3 = Y + 3 + Math.floor(hash(tx * 5, ty + c2) * 10);
          if (kAt(cx3, cy3) !== KG) continue;
          put(cx3, cy3, P32.grass[4]); put(cx3 + 2, cy3, P32.grass[4]); put(cx3 + 1, cy3 + 1, P32.grass[4]); put(cx3 + 1, cy3 + 2, P32.grass[2]);
        }
      }
      if (hh > 0.55 && near(tx, ty, 1, function (a2, b2) { var q2 = at(a2, b2); return isDirt(q2) || q2 === RIVER || q2 === POND || q2 === SAND; })) {
        for (var pb = 0; pb < 2; pb++) { var bx4 = X + Math.floor(hash(tx * 7 + pb, ty) * 14), by4 = Y + Math.floor(hash(tx, ty * 7 + pb) * 14); if (kAt(bx4, by4) === KW) continue; put(bx4, by4, P32.rock[4]); put(bx4 + 1, by4, P32.rock[4]); put(bx4, by4 + 1, P32.rock[1]); put(bx4 + 1, by4 + 1, P32.rock[1]); }
      }
      if (fo2 > 0.26 && hh < 0.4) { var tw0 = X + 4 + Math.floor(hh * 16), tw1 = Y + 6 + Math.floor(hash(ty, tx) * 6); put(tw0, tw1, P32.wood[2]); put(tw0 + 1, tw1 + 1, P32.wood[2]); put(tw0 + 2, tw1 + 1, P32.wood[2]); put(tw0 + 3, tw1 + 2, P32.wood[2]); }
    }
    g.putImageData(img, 0, 0);

    // the dock: planks over the water
    for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
      if (GROUND[ty * MW + tx] !== DOCK) continue;
      X = tx * T; Y = ty * T;
      for (j2 = 0; j2 < 4; j2++) r(X, Y + j2 * 4, T, 3, j2 % 2 ? PAL.wood[2] : PAL.wood[3]);
      r(X, Y, 2, T, PAL.wood[1]); if (tx === DOCKX + 1) r(X + T - 2, Y, 2, T, PAL.wood[1]);
    }
    // bridges: planks across, rails and posts along the sides that meet the water
    for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
      if (GROUND[ty * MW + tx] !== BRIDGE) continue;
      X = tx * T; Y = ty * T;
      r(X, Y + 1, T, T - 2, PAL.wood[3]);
      for (i = 0; i < T; i += 3) r(X + i, Y + 1, 1, T - 2, PAL.wood[2]);
      for (i = 0; i < T; i += 5) r(X + i + 1, Y + 3 + (i % 2) * 6, 1, 1, PAL.wood[4]);
      if (at(tx, ty - 1) !== BRIDGE && !land(at(tx, ty - 1)) || at(tx, ty - 1) === RIVER) { r(X, Y, T, 2, PAL.wood[1]); r(X + 2, Y - 3, 2, 4, PAL.wood[1]); r(X + 10, Y - 3, 2, 4, PAL.wood[1]); r(X, Y - 3, T, 1, PAL.wood[2]); }
      if (at(tx, ty + 1) === RIVER) { r(X, Y + T - 2, T, 2, PAL.wood[1]); r(X + 2, Y + T - 5, 2, 4, PAL.wood[1]); r(X + 10, Y + T - 5, 2, 4, PAL.wood[1]); r(X, Y + T - 5, T, 1, PAL.wood[2]); r(X, Y + T, T, 2, "rgba(26,20,58,.3)"); }
    }
    // a puddle on the path into the cave, lit on its far rim
    (function () {
      var cs = STATIONS.filter(function (q3) { return q3.id === "cave"; })[0]; if (!cs) return;
      var pcx = (cs.x + 1.2) * T, pcy = (cs.y + 1.4) * T;
      for (var yy2 = -4; yy2 <= 4; yy2++) for (var xx2 = -8; xx2 <= 8; xx2++) {
        var dd = (xx2 * xx2) / 64 + (yy2 * yy2) / 14 + (hash(xx2 + 40, yy2 + 40) - 0.5) * 0.15; if (dd > 1) continue;
        g.fillStyle = dd > 0.72 && yy2 < 0 ? PAL.rim[0] : soft(0.55 - dd * 0.35, PAL.water, pcx + xx2, pcy + yy2); g.fillRect(pcx + xx2, pcy + yy2, 1, 1);
      }
    })();

    // the volcano's shadow falls to the east across the plateau
    for (py = VOLC.y - 60; py < VOLC.y + 90; py++) for (px = VOLC.x - 40; px < VOLC.x + 170; px++) {
      var sd = Math.hypot((px - VOLC.x - 38) / (VOLC.R * 1.02), (py - VOLC.y - 12) / (VOLC.R / VOLC.sq * 1.05));
      if (sd < 1 && volcD(px, py) > VOLC.R - 4 && (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16 < (1 - sd) * 1.6) { g.fillStyle = "rgba(26,20,58,.22)"; g.fillRect(px, py, 1, 1); }
    }

    // the helipad: a concrete disc, a painted ring and a big H
    var hx0 = HELI.x * T + 8, hy0 = HELI.y * T + 8;
    for (py = hy0 - 24; py <= hy0 + 24; py++) for (px = hx0 - 24; px <= hx0 + 24; px++) {
      var hd = Math.hypot(px + 0.5 - hx0, py + 0.5 - hy0);
      if (hd > 23) continue;
      g.fillStyle = hd > 21.5 ? PAL.rock[2] : hd > 18.5 && hd < 20.5 ? "#f2c230" : tone(0.55 + (hash(px >> 1, py >> 1) - 0.5) * 0.3, [PAL.rock[3], "#9a9d9f", PAL.rock[4]], px, py);
      g.fillRect(px, py, 1, 1);
    }
    r(hx0 - 7, hy0 - 8, 3, 16, "#f4f4f4"); r(hx0 + 4, hy0 - 8, 3, 16, "#f4f4f4"); r(hx0 - 4, hy0 - 1, 8, 3, "#f4f4f4");

    // bones in the t-rex paddock, and three-toed tracks along the south beach
    if (MAP.decals.bones) (function bones(bx, by) {
      for (var b = 0; b < 6; b++) { r(bx + b * 3, by, 1, 6, "#d9cfb8"); r(bx + b * 3, by, 1, 1, "#f2ead8"); }
      r(bx - 1, by + 3, 18, 1, "#c8bea8"); r(bx + 17, by + 2, 6, 3, "#e8e0cc"); r(bx + 21, by + 1, 5, 4, "#e8e0cc"); r(bx + 22, by + 2, 1, 1, "#3a3024"); r(bx + 24, by + 4, 2, 1, "#c8bea8");
      r(bx - 10, by + 3, 9, 1, "#c8bea8"); r(bx - 12, by + 4, 3, 1, "#c8bea8");
    }).apply(null, MAP.decals.bones);
    var TRK = MAP.decals.tracks || { x: 0, dx: 0, y: 0, n: 0 };
    for (var ft = 0; ft < TRK.n; ft++) {
      var fx0 = Math.round((TRK.x + ft * TRK.dx) * T + (ft % 2) * 6), fy0 = Math.round((TRK.y + Math.sin(ft * 0.6) * 0.5) * T);
      if (kAt(fx0, fy0) !== KS) continue;
      g.fillStyle = PAL.sand[0]; g.fillRect(fx0, fy0, 2, 2); g.fillRect(fx0 + 2, fy0 - 2, 1, 2); g.fillRect(fx0 + 2, fy0 + 2, 1, 2); g.fillRect(fx0 + 3, fy0, 2, 1);
    }

    /* cliffs follow the terraces' own smooth edges (hiEdge, midEdge) column by column, and the
       coast wherever raised ground drops to the beach, so they curve instead of stepping along the
       tiles (walking still follows the tiles, and the edge always lies inside the tiles that are
       solid). the face is vertical stone planes, each lit on its left edge and darkening toward the
       foot, the odd ledge, a cool shadow at the base, grass hanging over the lip with a root or a
       vine here and there. where a path climbs, stairs */
    function face(gx, top, fh, row) {
      // the slab boundaries come from a hash of the column, so each slab is 3 to 9 px wide
      var sx0 = gx; while (sx0 > gx - 9 && hash(sx0, row) > 0.28) sx0--;
      var sx1 = gx + 1; while (sx1 < gx + 10 && hash(sx1, row) > 0.28) sx1++;
      var sw = Math.max(3, sx1 - sx0), inS = gx - sx0, cap = 1 + Math.floor(hash(sx0, row * 5) * 3);
      var ledge = 5 + Math.floor(hash(sx0 * 3, row) * Math.max(1, fh - 9)), tint = (hash(sx0, row * 23) - 0.5) * 0.14;
      for (var fy3 = 0; fy3 < fh; fy3++) {
        var v = 0.8 - fy3 / fh * 0.62 + tint + (hash(gx >> 1, (top + fy3) >> 2) - 0.5) * 0.06;
        if (fy3 < cap) v += 0.2;
        if (inS === 0) v += 0.12; else if (inS >= sw - 1) v -= 0.3;
        if (fy3 === ledge) v -= 0.3; else if (fy3 === ledge + 1) v += 0.16;
        g.fillStyle = soft(Math.max(0.02, Math.min(0.98, v)), PAL.rock, gx, top + fy3, 0.18); g.fillRect(gx, top + fy3, 1, 1);
      }
      var hang = 1 + Math.floor(hash(gx, row * 5) * 3) + (hash(gx >> 1, row) < 0.12 ? 3 : 0);
      for (var hy = 0; hy < hang; hy++) { g.fillStyle = hy === hang - 1 ? PAL.grass[2] : PAL.grass[4 - (hy > 1 ? 1 : 0)]; g.fillRect(gx, top + hy, 1, 1); }
      if (hash(gx * 3, row) < 0.015) for (var rt = 0; rt < 3 + hash(gx, 7) * 5; rt++) { g.fillStyle = rt % 2 ? PAL.wood[1] : PAL.wood[2]; g.fillRect(gx + (rt > 3 ? 1 : 0), top + hang + rt, 1, 1); }
      else if (hash(gx * 7, row) < 0.04) for (var vn = 0; vn < Math.min(fh - hang - 2, 4 + hash(gx, 9) * 8); vn++) { g.fillStyle = vn % 2 ? PAL.moss[1] : PAL.moss[2]; g.fillRect(gx, top + hang + vn, 1, 1); }
      for (var sh2 = 0; sh2 < 4; sh2++) { g.fillStyle = "rgba(26,20,58," + (0.3 - sh2 * 0.07).toFixed(2) + ")"; g.fillRect(gx, top + fh + sh2, 1, 1); }
    }
    function stairs(gx, top, fh, side) {                       // side: -1 the lit left wall, 1 the dark right wall, 0 the steps
      for (var y3 = 0; y3 < fh; y3++) {
        g.fillStyle = side < 0 ? PAL.rock[3] : side > 0 ? PAL.rock[1] : [PAL.dirt[4], PAL.dirt[3], PAL.dirt[1]][y3 % 3];
        g.fillRect(gx, top + y3, 1, 1);
      }
    }
    [[hiEdge, SH.terraces[0].salt], [midEdge, SH.terraces[1].salt]].forEach(function (E) {
      var col = [];
      for (var gx = 0; gx < PW; gx++) {
        var top = Math.round(E[0]((gx + 0.5) / T) * T), up = kAt(gx, top - 1), dn = kAt(gx, top + 1);
        col.push(null);
        if (top < 2 || top >= PH - 24 || volcD(gx, top) < VOLC.R) continue;
        if (up === KW || dn === KW || up === KS || dn === KS || kAt(gx - 4, top) === KW || kAt(gx + 4, top) === KW) continue;   // the falls, and the beach (the coast has its own pass)
        col[gx] = { top: top, dirt: up === KD || dn === KD || kAt(gx, top + 6) === KD };
      }
      col.forEach(function (c4, gx) {
        if (!c4) return;
        if (!c4.dirt) { face(gx, c4.top, 21, E[1]); return; }
        var l = col[gx - 1], rr = col[gx + 1];
        stairs(gx, c4.top, 21, !l || !l.dirt ? -1 : !rr || !rr.dirt ? 1 : 0);
      });
    });
    for (px = 0; px < PW; px++) for (py = 1; py < PH - 1; py++) {
      i = py * PW + px;
      if ((GK[i] !== KG && GK[i] !== KD) || GK[i + PW] !== KS) continue;
      var Lc = tier((px + 0.5) / T, (py + 0.5) / T); if (!Lc) continue;
      var run = 0; while (run < 30 && kAt(px, py + 1 + run) === KS) run++;
      var fhc = Math.min(8 + 5 * Lc, run - 3);
      if (fhc >= 4) face(px, py + 1, fhc, SH.coast.salt);
    }

    // the buildings' shadows, baked into the ground: soft and dithered, down and to the right
    // (the light comes from the upper left, like the sprites)
    function castShadow(cx, cy, rx, ry, a) {
      for (var yy3 = -ry; yy3 <= ry; yy3++) for (var xx3 = -rx; xx3 <= rx; xx3++) {
        var d3 = (xx3 * xx3) / (rx * rx) + (yy3 * yy3) / (ry * ry);
        if (d3 <= 1 && (BAYER[((cy + yy3) & 3) * 4 + ((cx + xx3) & 3)] + 0.5) / 16 < (1 - d3) * 1.8) { g.fillStyle = "rgba(26,20,58," + a + ")"; g.fillRect(cx + xx3, cy + yy3, 1, 1); }
      }
    }
    BUILDINGS.forEach(function (bd) { castShadow(Math.round((bd.x0 + bd.w / 2) * T + 10), (bd.y0 + bd.h) * T + 2, bd.w * 9, 6, 0.32); });
  })();
  groundMs = performance.now() - groundMs;
  /* the surf: every sea pixel on the waterline, with the way out to sea, kept per tile. the foam
     rides in and out along it with the tide (still under reduced motion) */
  var FOAM = new Array(MW * MH);
  (function () {
    for (var py = 1; py < PH - 1; py++) for (var px = 1; px < PW - 1; px++) {
      var i = py * PW + px;
      var tl = GROUND[(py >> 4) * MW + (px >> 4)];
      if (WD[i] !== 3 || tl === RIVER || tl === BRIDGE || tl === POND || hash(px, py * 3) > 0.6 || curveD(CG.river, (px + 0.5) / T, (py + 0.5) / T) < 0.8 || pondF((px + 0.5) / T, (py + 0.5) / T) < 1.3) continue;
      var ti = (py >> 4) * MW + (px >> 4);
      (FOAM[ti] = FOAM[ti] || []).push(px, py, Math.sign(WD[i + 1] - WD[i - 1]), Math.sign(WD[i + PW] - WD[i - PW]));
    }
    WD = null;                                                   // 4 MB we don't need any more
  })();

  /* ════════ actors ════════ */
  // middle path: the kaiju mascot Ammaar and his friends drew, in ascii for the terminal
  var KAIJU_ART = [
    "                          .-.",
    "                         ( o )",
    "                    .--.  `-'",
    "                   / ^  \\   .",
    "              /\\  |     \\_/|",
    "         /\\  /  \\ |   ___/",
    "        /  \\/    \\|  (",
    "       <           \\  \\",
    "        \\/\\     .-. |  |",
    "          /    ( (  |  |",
    "         /      \\ \\_/  /",
    "        (________\\____/~~--._",
    "     ____________________________",
    "        m i d d l e    p a t h"
  ];
  var DINO = {
    a: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...W..W....","...W...W..."],
    b: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...WW.W....","....W..W..."]
  };

  // pi: the little white one, as it was
  var FRAMES = {
    idle:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."],
    blink: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWGWWGWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."],
    walk1: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..",".WW....WW.",".GG....GG."],
    walk2: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","...WWWW...","...GGGG..."],
    back:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."]
  };
  var PIPAL = { W: "#f4f4f4", G: "#a9a9a9", K: "#141414" };
  // middle path, as pi grows into it: a small grey kaiju, about pi's size, from Ammaar's friends'
  // drawing. it has pi's rounded head and round eyes, soft rounded bumps down its back (not
  // plates or spikes), a small smile, and faint circuit lines on its tail that glow after dark.
  // side on, facing the camera, or walking away
  var KJ = {
    side: { w: 16,
      idle:  ["........GGGG....", ".....D.GGGGGG...", "....DDGGGGGGEGG.", "..D.DGGGGGGGGGGG", ".DDGGGGGGGGGGMG.", ".DGGGGGGGGGGG...", "DDGGGGGLLLGGG...", "DGGGGGGLLLLGG...", "GGGGGGGLLLLG....", "GCGCGGGLLLLG....", ".GGGGGGGLLGG....", "...GGGGGGGG.....", "....FF...FF.....", "....FF...FF....."],
      blink: ["........GGGG....", ".....D.GGGGGG...", "....DDGGGGGGMGG.", "..D.DGGGGGGGGGGG", ".DDGGGGGGGGGGMG.", ".DGGGGGGGGGGG...", "DDGGGGGLLLGGG...", "DGGGGGGLLLLGG...", "GGGGGGGLLLLG....", "GCGCGGGLLLLG....", ".GGGGGGGLLGG....", "...GGGGGGGG.....", "....FF...FF.....", "....FF...FF....."],
      walk1: ["........GGGG....", ".....D.GGGGGG...", "....DDGGGGGGEGG.", "..D.DGGGGGGGGGGG", ".DDGGGGGGGGGGMG.", ".DGGGGGGGGGGG...", "DDGGGGGLLLGGG...", "DGGGGGGLLLLGG...", "GGGGGGGLLLLG....", "GCGCGGGLLLLG....", ".GGGGGGGLLGG....", "...GGGGGGGG.....", "...FF.....FF....", "...FF......FF..."],
      walk2: ["................", "........GGGG....", ".....D.GGGGGG...", "....DDGGGGGGEGG.", "..D.DGGGGGGGGGGG", ".DDGGGGGGGGGGMG.", ".DGGGGGGGGGGG...", "DDGGGGGLLLGGG...", "DGGGGGGLLLLGG...", "GGGGGGGLLLLG....", "GCGCGGGLLLLG....", "...GGGGGGGG.....", ".....FFFF.......", ".....FF.FF......"] },
    front: { w: 12,
      idle:  ["....GGGG....", "..GGGGGGGG..", ".GGGGGGGGGG.", ".GGEGGGGEGG.", "DGGGGGGGGGGD", ".GGGGMMGGGG.", "..GGGGGGGG..", ".GGGLLLLGGG.", "GGGLLLLLLGGG", ".GGLLLLLLGG.", "..GLLLLLLG..", "...GGGGGG.GC", "...FF..FF...", "...FF..FF..."],
      blink: ["....GGGG....", "..GGGGGGGG..", ".GGGGGGGGGG.", ".GGMGGGGMGG.", "DGGGGGGGGGGD", ".GGGGMMGGGG.", "..GGGGGGGG..", ".GGGLLLLGGG.", "GGGLLLLLLGGG", ".GGLLLLLLGG.", "..GLLLLLLG..", "...GGGGGG.GC", "...FF..FF...", "...FF..FF..."],
      walk1: ["....GGGG....", "..GGGGGGGG..", ".GGGGGGGGGG.", ".GGEGGGGEGG.", "DGGGGGGGGGGD", ".GGGGMMGGGG.", "..GGGGGGGG..", ".GGGLLLLGGG.", "GGGLLLLLLGGG", ".GGLLLLLLGG.", "..GLLLLLLG..", "...GGGGGG.GC", "...FF...FF..", "...FF......."],
      walk2: ["....GGGG....", "..GGGGGGGG..", ".GGGGGGGGGG.", ".GGEGGGGEGG.", "DGGGGGGGGGGD", ".GGGGMMGGGG.", "..GGGGGGGG..", ".GGGLLLLGGG.", "GGGLLLLLLGGG", ".GGLLLLLLGG.", "..GLLLLLLG..", "...GGGGGG.GC", "..FF...FF...", ".........FF."] },
    back: { w: 12,
      idle:  ["....GGGG....", "..GGGGGGGG..", ".GGGGDDGGGG.", ".GGGGDDGGGG.", "DGGGGGGGGGGD", ".GGGGDDGGGG.", "..GGGDDGGG..", ".GGGGGGGGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "...FFCGFF...", "...FF.GCFF.."],
      walk1: ["....GGGG....", "..GGGGGGGG..", ".GGGGDDGGGG.", ".GGGGDDGGGG.", "DGGGGGGGGGGD", ".GGGGDDGGGG.", "..GGGDDGGG..", ".GGGGGGGGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "...FFCG.FF..", "...FF..GC..."],
      walk2: ["....GGGG....", "..GGGGGGGG..", ".GGGGDDGGGG.", ".GGGGDDGGGG.", "DGGGGGGGGGGD", ".GGGGDDGGGG.", "..GGGDDGGG..", ".GGGGGGGGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "..FF.CGFF...", ".......GCFF."] }
  };
  // the same grey as middle path's drawing; C is the circuit lines on the tail, which glow at night
  var KJPAL = { G: "#8b8f98", D: "#4a4d55", L: "#c4c7cd", E: "#141414", M: "#5a5d65", F: "#6a6e76", C: "#6b7079" };
  var KJPAL_N = { G: "#8b8f98", D: "#4a4d55", L: "#c4c7cd", E: "#141414", M: "#5a5d65", F: "#6a6e76", C: "#7fe3ff" };
  // pi's frame for a mode ("idle", "walk", "blink"), or middle path's once pi has evolved
  function piArt(mode, i, up, profile) {
    if (pi.kaiju) {
      var set = KJ[profile ? "side" : up ? "back" : pi.view === "down" ? "front" : "side"];
      return frameCanvas(mode === "walk" ? (i % 2 ? set.walk1 : set.walk2) : mode === "blink" && set.blink ? set.blink : set.idle, sky.dark > 0.5 ? KJPAL_N : KJPAL, set.w);
    }
    var f = up ? (mode === "walk" && i % 2 ? FRAMES.walk1 : FRAMES.back) : mode === "walk" ? (i % 2 ? FRAMES.walk1 : FRAMES.walk2) : mode === "blink" ? FRAMES.blink : FRAMES.idle;
    return frameCanvas(f, PIPAL, 10);
  }
  /* the art direction's shadow: one soft, pre-rendered ellipse per size, cool blue-violet, at about
     35%, falling to the lower right (the light is always top-left) */
  var SHADOWS = {};
  function softShadow(x, y, w) {
    w = Math.max(6, Math.round(w / 2) * 2);
    var sp = SHADOWS[w];
    if (!sp) {
      var h = Math.max(3, Math.round(w * 0.28)); sp = mkCanvas(); sp.width = w + 2; sp.height = h + 2;
      var g = sp.getContext("2d");
      for (var yy = 0; yy < h + 2; yy++) for (var xx = 0; xx < w + 2; xx++) {
        var dx = (xx + 0.5 - (w + 2) / 2) / (w / 2), dy = (yy + 0.5 - (h + 2) / 2) / (h / 2), d = dx * dx + dy * dy;
        if (d < 1) { g.fillStyle = "rgba(26,20,58," + (0.35 * Math.min(1, (1 - d) * 2.2)).toFixed(3) + ")"; g.fillRect(xx, yy, 1, 1); }
      }
      SHADOWS[w] = sp;
    }
    ctx.drawImage(sp, Math.round(x - sp.width / 2 + w * 0.12), Math.round(y - sp.height / 2 + 1));
  }
  function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x - w / 2 + 1, y - 1, w - 2, 1); ctx.fillRect(x - w / 2, y, w, 2); ctx.fillRect(x - w / 2 + 1, y + 2, w - 2, 1); }

  var SPAWN = { x: MAP.anchors.spawn[0], y: MAP.anchors.spawn[1] };
  var pi = { kaiju: !!save.evolved, x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, face: 1, dir: "down", dist: 0, stepAcc: 0, boost: 0, path: null, want: null, hop: 0 };
  var rex = { x: 44 * T + 8, y: 62 * T + 10, tx: 0, ty: 0, face: -1, wait: 1, dist: 0, hop: 0, vy: 0 };
  var ptero = { on: false, x: 0, y: 0, vx: 0, next: 4 };
  var clouds = [0, 1, 2].map(function (i) { return { x: hash(i, 9) * MW * T, y: hash(9, i) * MH * T, w: 90 + i * 30, v: 5 + i * 2 }; });
  var egg = null;          // { t } while pi is hatching
  var bubble = null;       // { text, t } speech over pi

  /* ════════ view ════════ */
  var W = 0, H = 0, dpr = 1, S = 3, zoom = 1, zoomTo = 1, camX = 0, camY = 0, camF = { x: null, y: null }, look = { x: 0, y: 0 };
  /* the backing store is the css size times the pixel ratio (capped at 2), rounded down, and
     the game scale is a whole number of device pixels per world pixel, so sprites stay crisp at
     125% zoom or on a 1.5x screen. setting the canvas size resets the context (smoothing comes
     back on), so its state is put back every time */
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth || window.innerWidth; H = root.clientHeight || window.innerHeight;
    var bw = Math.floor(W * dpr), bh = Math.floor(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    ctx.imageSmoothingEnabled = false;
    var sc = Math.max(2, Math.min(5, Math.floor(Math.min(W / 300, H / 190))));
    S = crisp(sc);
  }
  function crisp(sc) { return Math.max(1, Math.round(sc * dpr)) / dpr; }             // a css scale that's whole device pixels
  // the pixel ratio changes when the window moves to another screen or the page is zoomed
  var dprQ = null;
  function watchDpr() {
    if (!window.matchMedia) return;
    if (dprQ) dprQ.removeEventListener ? dprQ.removeEventListener("change", onDpr) : dprQ.removeListener(onDpr);
    dprQ = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
    if (dprQ.addEventListener) dprQ.addEventListener("change", onDpr); else if (dprQ.addListener) dprQ.addListener(onDpr);
  }
  function onDpr() { if (open) size(); watchDpr(); }
  watchDpr();

  /* ════════ sound ════════
     positional one-shots are panned by where they are on screen and fade with distance
     from the middle of the view. the ambience (surf, jungle insects, the volcano's rumble)
     and the rotor and engine are held loops whose volume follows the scene. */
  var SND = window.Sound || null, amb = null, popT = 0;
  function sfx(name, x, y, o) {
    if (!SND) return;
    o = o || {};
    if (x !== undefined) {
      var E0 = S * zoom, cx0 = camX + W / E0 / 2, cy0 = camY + H / E0 / 2, dd = Math.hypot(x - cx0, y - cy0);
      o.pan = Math.max(-1, Math.min(1, (x - cx0) / (W / E0 / 2 || 1)));
      o.vol = (o.vol || 1) * Math.max(0, 1 - dd / 420);
      if (o.vol < 0.03) return;
    }
    SND.sfx(name, o);
  }
  function startSound() {
    if (!SND) return;
    SND.unlock();
    if (!amb && SND.stats().state !== "none") amb = { waves: SND.loop("waves"), falls: SND.loop("falls"), buzz: SND.loop("buzz"), aura: SND.loop("aura"), rumble: SND.loop("rumble"), rotor: SND.loop("rotor"), engine: SND.loop("engine") };
  }
  function stopSound() {
    if (!SND) return;
    SND.music(null);
    if (amb) { Object.keys(amb).forEach(function (k2) { amb[k2].stop(); }); amb = null; }
  }
  var shoreT = 0, shore = 0;
  // each terrace has its own loop (the buildings are all on the lowland), and a night version
  function regionMood() {
    var tr = room ? 0 : tier(pi.x / T, (aboard() ? heli.y : pi.y) / T);
    return ["low", "meadow", "high"][tr] + (sky.dark > 0.6 ? "-night" : "");
  }
  function hush(names) { names.forEach(function (k2) { amb[k2].set({ vol: 0 }); }); }
  function updateSound(dt) {
    if (!amb || side) return;                        // the shrine sets its own sound
    if (room) { hush(["waves", "falls", "rumble", "buzz", "rotor", "engine", "aura"]); SND.music(regionMood()); return; }
    if (riftBusy()) {
      // when the orbs wake, the island goes silent: no surf, no birds, no music. then the dark
      // score creeps in out of nothing, and it only gets worse from there
      hush(["waves", "falls", "rumble", "buzz", "rotor", "engine"]);
      SND.music(rift.phase === "dim" || rift.phase === "fall" ? null : reality.cur === "future" ? "doom-future" : reality.cur === "chaos" ? "doom-chaos" : "doom");
      amb.aura.set({ vol: rift.phase === "dim" ? 0 : rift.phase === "fall" ? 0.14 : 0.24 + (rift.act ? 0.18 : 0), rate: rift.act ? 1 : 0.3 });
      return;
    }
    SND.music(regionMood());
    shoreT -= dt;
    if (shoreT <= 0) {                               // how much water is around pi, for the surf
      shoreT = 0.3; var wn = 0, tx0 = Math.floor(pi.x / T), ty0 = Math.floor(pi.y / T);
      for (var j = -5; j <= 5; j += 1) for (var i = -5; i <= 5; i += 1) if (at(tx0 + i, ty0 + j) === DEEP || at(tx0 + i, ty0 + j) === SHAL) wn++;
      shore = wn / 121;
    }
    var vd = Math.hypot(pi.x - VX, pi.y - (VOLC.y - 20));
    amb.waves.set({ vol: 0.04 + shore * 0.4 });
    var WF = FALLS.reduce(function (m, f) { return !m || Math.hypot(pi.x - f.x, pi.y - f.y) < Math.hypot(pi.x - m.x, pi.y - m.y) ? f : m; }, null) || { x: -9999, y: -9999 };
    amb.falls.set({ vol: Math.pow(Math.max(0, 1 - Math.hypot(pi.x - WF.x, pi.y - WF.y) / 230), 1.6) * 0.1, pan: Math.max(-1, Math.min(1, (WF.x - pi.x) / 200)) });
    var dn = drones.reduce(function (m, d) { return Math.min(m, Math.hypot(pi.x - d.x, pi.y - d.y)); }, 1e9);
    amb.buzz.set({ vol: Math.pow(Math.max(0, 1 - dn / 150), 1.5) * 0.018 });
    amb.aura.set({ vol: rift ? 0.1 * Math.max(0, 1 - Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y) / 200) : 0, rate: 0.2 });
    amb.rumble.set({ vol: Math.max(0, 1 - vd / 380) * 0.4, pan: Math.max(-1, Math.min(1, (VX - pi.x) / 300)) });
    if (vd < 300 && (popT -= dt) <= 0) { popT = 0.4 + rand() * 1.6; sfx("pop", VX + (rand() - 0.5) * 30, VY); }
    var hd = Math.hypot(heli.x - pi.x, heli.y - pi.y);
    amb.rotor.set({ vol: heli.spin * (aboard() ? 0.2 : 0.2 * Math.max(0, 1 - hd / 320)), rate: heli.spin });
    amb.engine.set({ vol: car.driving ? 0.08 + Math.min(1, Math.abs(car.v) / 120) * 0.12 : 0, rate: Math.min(1, Math.abs(car.v) / 120) });
  }
  if (SND && SND.onRestart) SND.onRestart(function () { amb = null; if (open) startSound(); });
  if (SND) SND.onChange(function (on) { paintSound(on); paintChip(); });
  /* if the browser holds the sound back (no tap yet, or safari interrupted it for a call or
     the lock screen), a chip offers to bring it back, and any key or tap on the island does too */
  var sndChip = root.querySelector(".w-snd-chip");
  function soundStuck() { if (!SND || !SND.on() || !SND.state) return false; var st = SND.state(); return st === "suspended" || st === "interrupted"; }
  function paintChip() { if (sndChip) { var on = open && soundStuck() && !document.hidden; if (sndChip.hidden === on) sndChip.hidden = !on; } }
  function nudgeSound() { if (soundStuck()) { SND.unlock(); startSound(); } }
  if (SND && SND.onState) SND.onState(paintChip);
  if (sndChip) sndChip.addEventListener("click", function () { nudgeSound(); cv.focus({ preventScroll: true }); });
  var soundBtn = root.querySelector(".w-sound");
  function paintSound(on) { if (soundBtn) { soundBtn.innerHTML = "♪<span class=\"w-sound-l\"> sound " + (on ? "on" : "off") + "</span>"; soundBtn.setAttribute("aria-pressed", on ? "true" : "false"); soundBtn.setAttribute("aria-label", "Sound " + (on ? "on" : "off")); } }
  if (soundBtn) {
    if (!SND) soundBtn.hidden = true;
    else { paintSound(SND.on()); soundBtn.addEventListener("click", function () { SND.toggle(); if (open) startSound(); cv.focus({ preventScroll: true }); }); }
  }

  /* ════════ settings ════════
     the gear in the corner: a level for each part of the sound (everything, the music, the
     effects, the ambience), a button that restarts the sound engine if the browser has got it
     stuck, and some comfort switches: how much the screen shakes, whether big hits flash the
     screen white, and the minimap. it all stays for next time (this browser only). */
  // with nothing saved, shake and flashes start from the system's reduced-motion setting, and follow it
  var OPT = { shake: REDUCED ? 0 : 1, flash: !REDUCED, map: true }, OPT_SAVED = {};
  try {
    var so0 = save.settings || JSON.parse(localStorage.getItem("island-opts") || "{}"); if (so0 && typeof so0 === "object") OPT_SAVED = so0; else so0 = {};
    if (typeof so0.shake === "number") OPT.shake = Math.max(0, Math.min(1, so0.shake));
    if (typeof so0.flash === "boolean") OPT.flash = so0.flash;
    if (so0.map === false) OPT.map = false;
  } catch (e) {}
  function saveOpt() { OPT_SAVED = { shake: OPT.shake, flash: OPT.flash, map: OPT.map }; save.settings = OPT_SAVED; writeSave(); }
  var RMQ = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (RMQ && RMQ.addEventListener) RMQ.addEventListener("change", function (e) {
    REDUCED = e.matches;
    if (typeof OPT_SAVED.shake !== "number") OPT.shake = REDUCED ? 0 : 1;
    if (typeof OPT_SAVED.flash !== "boolean") OPT.flash = !REDUCED;
  });
  function flashOK() { return OPT.flash; }
  /* every flash on the island goes through this gate, so nothing can strobe: at most three new
     flashes in any one second, none at all with reduced motion. with bright flashes off, a
     whiteout peaks at 0.35 and takes at least 250 ms to fade, and nothing inverts the screen.
     shakes all pass through shakeBy, which applies the shake setting. */
  var flashTimes = [];
  function flashGate() {
    if (REDUCED) return false;
    var n = performance.now(); flashTimes = flashTimes.filter(function (x) { return n - x < 1000; });
    if (flashTimes.length >= 3) return false;
    flashTimes.push(n); return true;
  }
  function whiteout(a) {
    if (a <= 0 || REDUCED) return;
    ctx.fillStyle = "rgba(255,248,236," + Math.min(OPT.flash ? 0.75 : 0.35, a * (OPT.flash ? 0.75 : 0.35)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
  }
  function invertFlash() {
    if (!OPT.flash || !flashGate()) return;
    ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
  }
  function shakeBy(v) { return REDUCED ? 0 : v * OPT.shake; }
  function flashNote(on) { return "bright flashes: " + (on ? "on" : "off"); }
  var gearBtn = root.querySelector(".w-gear"), setEl = root.querySelector(".w-set");
  function setOpen() { return setEl && !setEl.hidden; }
  function buildSettings() {
    var mix = SND ? SND.mix() : null;
    function slider(key, label, val) { return '<label>' + label + '<input type="range" min="0" max="100" step="1" value="' + Math.round(val * 100) + '" data-k="' + key + '"><output>' + Math.round(val * 100) + '</output></label>'; }
    setEl.innerHTML = '<h3>settings</h3>'
      + (SND ? '<h4>sound</h4><label class="w-chk"><input type="checkbox" data-k="on"' + (SND.on() ? " checked" : "") + '>sound on (or the ♪ button)</label>'
        + slider("master", "master", mix.master) + slider("music", "music", mix.music) + slider("sfx", "effects", mix.sfx) + slider("amb", "ambience", mix.amb)
        + '<div class="w-row"><button type="button" data-a="restart">restart sound engine</button></div><div class="w-note">if the sound cuts out or stutters, this rebuilds it from scratch.</div>' : "")
      + '<h4>comfort</h4>' + slider("shake", "shake", OPT.shake)
      + '<label class="w-chk"><input type="checkbox" data-k="flash"' + (OPT.flash ? " checked" : "") + '>bright flashes</label>'
      + '<label class="w-chk"><input type="checkbox" data-k="map"' + (OPT.map ? " checked" : "") + '>minimap</label>'
      + '<div class="w-row"><button type="button" data-a="close">close</button></div>';
  }
  function toggleSettings(on) {
    if (!setEl) return;
    on = on === undefined ? setEl.hidden : on;
    if (on) buildSettings();
    setEl.hidden = !on; if (gearBtn) gearBtn.setAttribute("aria-expanded", on ? "true" : "false");
    keys = {};
    if (on) { var f = setEl.querySelector("input"); if (f) f.focus({ preventScroll: true }); } else cv.focus({ preventScroll: true });
  }
  if (gearBtn && setEl) {
    gearBtn.addEventListener("click", function () { if (SND) SND.unlock(); toggleSettings(); });
    setEl.addEventListener("input", function (e) {
      var el = e.target, k2 = el.getAttribute("data-k"); if (!k2) return;
      if (el.type === "range") {
        var v = el.value / 100; el.nextElementSibling.textContent = el.value;
        if (k2 === "shake") { OPT.shake = v; saveOpt(); } else if (SND) { SND.setMix(k2, v); if (k2 !== "music") sfx("blip"); }
      }
    });
    setEl.addEventListener("change", function (e) {
      var el = e.target, k2 = el.getAttribute("data-k"); if (el.type !== "checkbox") return;
      if (k2 === "on" && SND) { if (SND.on() !== el.checked) SND.toggle(); if (open) startSound(); }
      else if (k2 === "flash") { OPT.flash = el.checked; saveOpt(); }
      else if (k2 === "map") { OPT.map = el.checked; mapOn = el.checked; saveOpt(); }
    });
    setEl.addEventListener("click", function (e) {
      var a2 = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a2 === "close") toggleSettings(false);
      else if (a2 === "restart" && SND) { SND.restart(); if (open) startSound(); sfx("blip"); e.target.textContent = "restarted ✓"; }
    });
    setEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); toggleSettings(false); } });
  }

  /* ════════ input ════════ */
  var keys = {}, open = false, last = 0, raf = 0, t = 0;
  function dirKey(e) {
    var c = e.code || "";
    if (!c) { var k0 = (e.key || "").toLowerCase(); c = k0 === "w" ? "KeyW" : k0 === "a" ? "KeyA" : k0 === "s" ? "KeyS" : k0 === "d" ? "KeyD" : e.key; }
    return c === "ArrowUp" || c === "KeyW" ? "u" : c === "ArrowDown" || c === "KeyS" ? "d" : c === "ArrowLeft" || c === "KeyA" ? "l" : c === "ArrowRight" || c === "KeyD" ? "r" : null;
  }
  function onKeyDown(e) {
    if (open) nudgeSound();
    if (open && creditsOpen()) {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter" && !(document.activeElement && document.activeElement.tagName === "A")) {
        e.preventDefault(); if (credEl.classList.contains("w-cred-end")) closeCredits(); else creditsEnd();
      }
      return;
    }
    if (open && paused) {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { e.preventDefault(); setPaused(false); }
      return;
    }
    if (!open || termOpen || setOpen() || mapOpen()) return;
    var tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;          // typing somewhere: leave the keys alone
    if (tour && !e.repeat && (e.key === " " || e.key === "e" || e.key === "E" || e.key === "Enter" || e.key === "ArrowRight")) { e.preventDefault(); if (tour.i >= TOUR.length - 1) { endTour(false); closeDialog(); } else tourStep(); return; }
    if (tour && e.key === "Escape") { e.preventDefault(); endTour(true); return; }
    var d = dirKey(e);
    if (d) { keys[d] = 1; pi.path = null; pi.want = null; car.target = null; heli.target = null; e.preventDefault(); if (egg) egg.t = 99; return; }
    if (e.repeat) { if (e.key === " " || e.key === "Enter") e.preventDefault(); return; }
    if (aboard() && (e.key === "e" || e.key === "E" || e.key === "Enter")) { e.preventDefault(); toggleHeli(); return; }
    if (aboard() && e.key === " ") { e.preventDefault(); bubble = { text: "whup whup whup", t: 1 }; return; }
    if (car.driving && (e.key === "e" || e.key === "E" || e.key === "Enter")) { e.preventDefault(); toggleCar(); return; }
    if (car.driving && e.key === " ") { e.preventDefault(); bubble = { text: "beep beep", t: 1 }; sfx("honk"); foundSecret("honk"); return; }
    if (e.key === "Escape") { e.preventDefault(); if (!dlg.hidden) closeDialog(); else if (side && side.phase === "walk") { irisTo(function () { side = null; freeSideArt(); if (SND) SND.music(null); }); } else if (!side) setPaused(true); return; }
    if (asking && !dlg.hidden && (e.key === "y" || e.key === "Y" || e.key === "n" || e.key === "N")) { e.preventDefault(); wakeOrbs(e.key === "y" || e.key === "Y"); return; }
    if ((e.key === "p" || e.key === "P") && !side) { e.preventDefault(); setPaused(true); return; }
    if (e.key === "Shift") { keys.run = 1; return; }
    if (side && e.key === " " && dlg.hidden) { e.preventDefault(); keys.jump = 1; return; }
    if ((e.key === "m" || e.key === "M") && !side && !e.repeat) { e.preventDefault(); toggleMap(true); return; }
    if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "A" && e.key !== "e" && e.key !== "E") return;   // let links work
      e.preventDefault();
      if (egg) { egg.t = 99; return; }
      if (side) { if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); } return; }
      if (riftBusy()) return;
      if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
      var s = nearby(); if (s) interact(s);
    }
  }

  var joy = null;
  cv.addEventListener("pointermove", function (e) {
    if (!joy || e.pointerId !== joy.id) return;
    var dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, d = Math.hypot(dx, dy);
    if (!joy.on && d > 14) { joy.on = true; pi.path = null; pi.want = null; roomTap = null; }
    if (joy.on) { var m = Math.min(1, d / 44); joy.dx = d ? dx / d * m : 0; joy.dy = d ? dy / d * m : 0; joy.x = e.clientX; joy.y = e.clientY; }
  });
  function endJoy(e) { if (joy && (!e || e.pointerId === joy.id)) joy = null; }
  cv.addEventListener("pointerup", function (e) { if (side) side.tap = 0; endJoy(e); });
  cv.addEventListener("pointercancel", endJoy);
  cv.addEventListener("pointercancel", function () { if (side) side.tap = 0; });
  cv.addEventListener("lostpointercapture", function () { if (side) side.tap = 0; });
  function onKeyUp(e) { var d = dirKey(e); if (d) keys[d] = 0; if (e.key === "Shift") keys.run = 0; }
  // a key let go while the window was away never sends its keyup: forget everything held
  function clearKeys() { keys = {}; if (side) side.tap = 0; }
  function onVis() { if (document.hidden) { clearKeys(); if (open && !paused) setPaused(true); } else qGrace = performance.now() + 1000; }
  function onResize() { if (open) size(); }
  /* the window listeners exist only while the island is open: one AbortController per visit,
     aborted on the way out, so leaving and coming back can never stack them up */
  var session = null;
  function bindSession() {
    unbindSession();
    session = typeof AbortController !== "undefined" ? new AbortController() : null;
    var o = session ? { signal: session.signal } : false;
    window.addEventListener("keydown", onKeyDown, o);
    window.addEventListener("keyup", onKeyUp, o);
    window.addEventListener("blur", clearKeys, o);
    window.addEventListener("resize", onResize, o);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize, o);     // the ios url bar
    document.addEventListener("visibilitychange", onVis, o);
  }
  function unbindSession() {
    if (session) session.abort();
    else { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", clearKeys); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); if (window.visualViewport) window.visualViewport.removeEventListener("resize", onResize); }
    session = null; clearKeys();
  }

  cv.addEventListener("pointerdown", function (e) {
    if (!open || termOpen) return;
    nudgeSound();
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    if (promptRect && dlg.hidden && !riftBusy() && e.clientX >= promptRect[0] && e.clientX <= promptRect[0] + promptRect[2] && e.clientY >= promptRect[1] && e.clientY <= promptRect[1] + promptRect[3]) {
      if (car.driving) toggleCar(); else if (heli.state === "flying") toggleHeli(); else { var pn = nearby(); if (pn) interact(pn); }
      return;
    }
    if (mapRect && e.clientX >= mapRect[0] && e.clientX <= mapRect[0] + mapRect[2] && e.clientY >= mapRect[1] && e.clientY <= mapRect[1] + mapRect[3]) { mapOn = !mapOn; sfx("blip"); return; }
    if (egg) { egg.t = 99; return; }
    if (riftBusy()) return;
    if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
    var E = S * zoom, wx = camX + e.clientX / E, wy = camY + e.clientY / E;
    var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (car.driving) { car.target = { x: wx, y: wy }; return; }
    if (side) { if (side.phase === "walk") { if (e.clientY < H * 0.45) keys.jump = 1; else side.tap = e.clientX < W / 2 ? -1 : 1; } return; }
    if (e.pointerType === "touch" && !joy && !car.driving && !aboard()) joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dx: 0, dy: 0, on: false };
    if (room) { pi.path = null; roomTap = { x: wx, y: wy }; var rc = roomCandidates().filter(function (c) { return Math.hypot(wx - c.v.ax, wy - c.v.ay - 12) < 18; })[0]; if (rc) roomTap.want = rc.v; return; }
    if (heli.state === "flying") { if (Math.hypot(wx - heli.x, wy - heli.y + heli.z) < 16) toggleHeli(); else heli.target = { x: wx, y: wy }; return; }
    if (aboard()) return;
    // tapped a landmark (its sprite reaches up a couple of tiles)? walk up to it
    var hit = OUT.filter(function (s) { return Math.abs(tx - s.x) <= (s.wide ? 1 : 0) && ty <= s.y && ty >= s.y - 2; })[0];
    if (!hit && Math.hypot(wx - rex.x, wy - rex.y + 6) < 12) hit = { id: "rex" };
    if (!hit && Math.hypot(wx - car.x, wy - car.y) < 12) hit = { id: "car", gx: Math.floor(car.x / T), gy: Math.floor(car.y / T) };
    if (!hit && Math.hypot(wx - heli.x, wy - heli.y) < 18) hit = { id: "heli", gx: HELI.x, gy: HELI.y + 2 };
    if (!hit) critters.forEach(function (c) { if (!hit && Math.hypot(wx - c.x, wy - c.y + 5) < 10) hit = { id: "critter", ref: c, gx: Math.floor(c.x / T), gy: Math.floor(c.y / T) }; });
    if (!hit && rift && rift.phase === "reign" && Math.hypot(wx - ARENA.x, wy - (ARENA.y - 34)) < 22) hit = { id: "core", x: 36, y: 25 };
    if (e.pointerType === "touch" && !joy && !car.driving && !aboard()) joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dx: 0, dy: 0, on: false };
    if (hit) {
      var goal = hit.id === "rex" ? [Math.floor(rex.x / T), Math.floor(rex.y / T)] : hit.id === "core" ? [36, 26] : hit.gx !== undefined ? [hit.gx, hit.gy] : [hit.x, hit.y + 1];
      pi.path = piPath(goal, true); pi.want = hit;
    } else {
      pi.path = piPath([tx, ty], false); pi.want = null;
    }
  });

  /* pi's paths also check pi's real feet (C4-1). a tile can be walkable while the spot the path
     follower aims for in it (its centre, 10 px down) sits too close to blocked pixels (footBlock) for pi's
     8 px feet, so pi would stop short and give up. so pi only steps from one tile to the next
     when move() can walk pi from one aim spot to the other, at walking and at running speed, the
     way the follower does; the first step is tried from where pi really stands. the map and
     walkable() don't change; each answer is worked out on first use and kept. that cache assumes
     the collision (COLL and footBlock) never changes once the island is built: anything
     that changes what can be walked at runtime (a later phase's gates, bridges, moving obstacles) must
     clear STEPOK or replace it */
  var STEPOK = new Uint8Array(MW * MH * 4);                          // per tile and direction: 0 not known yet, 1 yes, 2 no
  function walkLine(x, y, gx, gy, top) {
    var o = { x: x, y: y };
    for (var s0 = 0; s0 < 90; s0++) { var dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy); if (d < 1.5) return true; move(o, dx / d * top * STEP, dy / d * top * STEP); }
    return false;
  }
  function footsCan(x, y, gx, gy) { return walkLine(x, y, gx, gy, 58) && walkLine(x, y, gx, gy, 58 * 1.6); }
  function canStep(ax, ay, bx, by) {
    var i = (ay * MW + ax) * 4 + (by > ay ? 0 : bx > ax ? 1 : by < ay ? 2 : 3);
    if (!STEPOK[i]) STEPOK[i] = footsCan(ax * T + 8, ay * T + 10, bx * T + 8, by * T + 10) ? 1 : 2;
    return STEPOK[i] === 1;
  }
  function piPath(goal, loose) { return bfs([Math.floor(pi.x / T), Math.floor(pi.y / T)], goal, loose, pi); }
  // breadth-first path over walkable tiles; "loose" accepts the closest tile next to the goal.
  // feet (pi) makes each step one pi's feet can walk (above); bots plan without it, as before
  function bfs(a, b, loose, feet) {
    var q = [a], prev = {}, seen = {}; seen[k(a[0], a[1])] = 1;
    var best = null, bestD = 1e9;
    while (q.length) {
      var c = q.shift(), d = Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]);
      if (d < bestD) { bestD = d; best = c; }
      if (d === 0 || (loose && d <= 1)) { best = c; break; }
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (n) {
        var nx = c[0] + n[0], ny = c[1] + n[1], kk = k(nx, ny);
        if (!seen[kk] && walkable(nx, ny) && (!feet || (c === a ? footsCan(feet.x, feet.y, nx * T + 8, ny * T + 10) : canStep(c[0], c[1], nx, ny)))) { seen[kk] = 1; prev[kk] = c; q.push([nx, ny]); }
      });
    }
    if (!best || (!loose && bestD > 3)) return null;
    var p = [best];
    while (prev[k(p[0][0], p[0][1])]) p.unshift(prev[k(p[0][0], p[0][1])]);
    p.shift();
    return p;
  }

  /* one verb for everything: each thing pi can use says what using it does and how much it
     matters. the thing in reach with the highest priority wins (nearest breaks a tie), and one
     prompt shows it: [E] read · experience. getting out of a vehicle beats a door, a door beats
     a landmark, a landmark beats an animal or a bot */
  function verbOf(v) {
    var id = v.id;
    if (id === "exitcar") return ["park", 4]; if (id === "exitheli") return ["land", 4];
    if (id === "building") return v.ref.room ? ["enter", 3] : ["look", 1];
    if (id === "car") return ["drive", 3]; if (id === "heli") return ["fly", 3];
    if (id === "cave") return ["use the terminal", 2]; if (id === "boat") return ["sail back", 2];
    if (id === "drink") return ["drink", 2]; if (id === "wake") return ["wake the orbs", 2];
    if (id === "core" || id === "shrine") return ["look", 2];
    if (v.sec || id === "sign") return ["read", 2];
    if (id === "pond") return ["feed the koi", 1]; if (id === "bot") return ["talk", 1];
    return ["look", 1];
  }
  function pick(cands) {
    var best = null, bp = -1, bd = 1e9;
    cands.forEach(function (c) { if (c.d >= c.max) return; var pr = verbOf(c.v)[1]; if (pr > bp || (pr === bp && c.d < bd)) { bp = pr; bd = c.d; best = c.v; } });
    return best;
  }
  function nearby() {
    if (room) return pick(roomCandidates());
    if (car.driving || aboard()) return null;
    var cands = nearCandidates(), da = Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y);
    if (rift && rift.phase === "reign") cands.push({ d: da, max: 30, v: { id: "core", name: "the core" } });
    if (!rift && countFound() === TOTAL) cands.push({ d: da, max: 34, v: { id: "wake", name: "the clearing", ax: ARENA.x, ay: ARENA.y - 8 } });
    return pick(cands);
  }
  // the prompt's words, and where it was last drawn (on touch the prompt is the button)
  var promptRect = null;
  function promptText(nb) { return (TOUCH ? "" : "[E] ") + verbOf(nb)[0] + (nb.sec ? " · " + nb.sec : ""); }

  /* ════════ dialog ════════ */
  var typing = null, full = "";
  var REX = ["rex: RAWR. (he means hi.)", "rex does a little hop. he's a chrome-dino homage and he knows it.", "rex: have you tried turning the router off and on again?", "rex is guarding the meadow from pterodactyls. so far, so good."];
  function interact(s) {
    if (!save.hints.use) { save.hints.use = true; writeSave(); }
    pi.path = null; pi.want = null; keys = {};
    if (s.id === "rex") { foundSecret("rex"); rex.hop = 1; rex.vy = -2.2; say("rex", REX[(rand() * REX.length) | 0], []); return; }
    if (s.id === "core") { coreSay(false); return; }
    if (s.id === "cave") { openTerm(); return; }
    if (s.id === "shrine" && sealed()) { say("an old shrine", "a standing stone, older than the park, with a ring carved into it. the ring is cold, and something has sealed it shut. (it opens when all eight logs are found: " + countFound() + " of " + TOTAL + ".)", []); return; }
    if (s.id === "shrine") { say("an old shrine", "a standing stone, older than the park, with a ring carved into it. the ring is warm. something on the other side of it is breathing. (what's through it contains flashing lights and loud sound.)", [["step through", "#descend"], [flashNote(OPT.flash), "#flash"]]); return; }
    if (s.id === "wake") { askRift(); return; }
    if (s.id === "heli") { toggleHeli(); return; }
    if (s.id === "car") { toggleCar(); bubble = { text: "pi:~$ vroom. arrows drive, space honks, e parks", t: 3.5 }; return; }
    if (s.id === "critter" || s.id === "bird" || s.id === "pond" || s.id === "nest" || s.id === "fence") { sayLocal(s); return; }
    if (s.id === "building") { if (s.ref.room) { var rm = s.ref.room; pi.sq = 0.12; pi.sqStart = false; sfx("open"); doorAnim = { bd: s.ref, t0: performance.now(), open: true }; stepIn = { y: pi.y, t0: performance.now() }; irisTo(function () { stepIn = null; enterRoom(rm); }, DOOR_CLOSE, DOOR_OPEN, ROOMS[rm]); } else say(s.ref.name, s.ref.text, []); return; }
    if (s.id === "roomitem") { say(s.name, s.text, []); return; }
    if (s.id === "bot") { var bl = BOTSAY[s.ref.kind]; sfx("chatter", s.ref.x, s.ref.y); say("a bot", bl[(rand() * bl.length) | 0], []); return; }
    if (s.id === "drink") { pi.boost = 10; foundSecret("zoom"); }
    logWait = s.found && !found[s.id] ? { s: s, t: 0 } : null;
    var host = window.SITE && window.SITE.CODE_HOST;                          // a repo link only once that repo is public on the host
    say(s.sec ? s.name + " · " + s.sec : s.name, s.text, (s.links || []).map(function (l) {
      return l[1].indexOf("github.com/") < 0 ? l : host && window.SITE.hostUrl(l[1]) ? [l[0].replace(/github/i, host.name), window.SITE.hostUrl(l[1])] : null;
    }).filter(Boolean));
  }
  /* ════════ secrets ════════
     every easter egg on the island is in this one table. finding one pops a toast, rings a
     chime and goes in the save; the terminal's `secrets` lists them (the hints open up once
     all eight logs are found) */
  var SECRETS = [
    { id: "dotfiles", name: "dotfiles", hint: "some files in the cave terminal start with a dot. ls -a." },
    { id: "root", name: "root", hint: "sudo in the cave. the password is the orb that usually wins." },
    { id: "evolve", name: "middle path", hint: "four logs, then ./evolve pi in the cave." },
    { id: "koi", name: "feeding time", hint: "the koi in the garden are always hungry." },
    { id: "roar", name: "too close", hint: "walk along the t-rex paddock's fence." },
    { id: "heli", name: "air support", hint: "the helicopter on the pad isn't just for show." },
    { id: "drift", name: "sideways", hint: "hold shift in the car when it's going fast." },
    { id: "honk", name: "beep beep", hint: "the car has a horn." },
    { id: "rex", name: "chrome dino", hint: "a small dinosaur near the village wants to say hi." },
    { id: "zoom", name: "zoom mode", hint: "the drink stand in the square." },
    { id: "night", name: "night shift", hint: "come back after dark, New York time." },
    { id: "deity", name: "the first orb", hint: "step through the shrine and keep climbing." }
  ];
  var toastEl = root.querySelector(".w-toast"), toastT = 0;
  /* the toast: one short line over the island that pops in and goes after 3.2 s, the newest
     replacing the last. it's a status region, so screen readers hear it; quiet keeps it out of
     the accessibility tree, for news a screen reader already gets another way (the terminal's log) */
  function toast(msg, quiet) {
    if (!toastEl) return;
    if (quiet) toastEl.setAttribute("aria-hidden", "true"); else toastEl.removeAttribute("aria-hidden");
    toastEl.textContent = msg; toastEl.hidden = false; toastEl.classList.remove("w-toast-in"); void toastEl.offsetWidth; toastEl.classList.add("w-toast-in"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 3200);
  }
  function foundSecret(id) {
    var q = SECRETS.filter(function (x) { return x.id === id; })[0];
    if (!q || save.secrets.indexOf(id) >= 0) return;
    save.secrets.push(id); writeSave();
    var msg = "secret found (" + save.secrets.length + "/" + SECRETS.length + "): " + q.name;
    toast(msg);
    sfx("secret"); announce(msg + ".");
  }
  /* the logs. a card counts as read once it has been open a second and a half, or scrolled to
     its end. four logs wake the terminal's evolve command; all eight break the seal on the
     shrine (a short cut to show it) and then the orbs ask to fight */
  var logWait = null, sealNext = false;
  function updateLog(dt) { if (!logWait) return; if (dlg.hidden) { logWait = null; return; } if ((logWait.t += dt) >= 1.5) { var s0 = logWait.s; logWait = null; markFound(s0); } }
  function markFound(s) {
    if (found[s.id]) return;
    sinceLog = 0;
    found[s.id] = 1; save.logs = Object.keys(found); writeSave();
    var n = countFound();
    paintFound(true); sfx("found"); pi.hop = 1;
    announce("found " + n + " of " + TOTAL + ": " + s.name + ", " + s.sec + ".");
    if (n === 4 && !pi.kaiju) bubble = { text: "pi:~$ four logs. something in the cave terminal just woke up.", t: 4 };
    if (n === TOTAL && !save.seal) { sealNext = true; if (!rift) pendingRift = true; }
    else if (n === TOTAL && !rift) pendingRift = true;
  }
  dlg.addEventListener("scroll", function () { if (logWait && dlg.scrollHeight > dlg.clientHeight + 4 && dlg.scrollTop + dlg.clientHeight >= dlg.scrollHeight - 2) { var s0 = logWait.s; logWait = null; markFound(s0); } });
  function say(name, text, links) {
    dName.textContent = name; dLinks.innerHTML = ""; dlg.hidden = false; dSr.textContent = text;
    if (SND && SND.duck) SND.duck(true);
    /* a real dialog, opened non-modal so the hud (back to portfolio, stop tour) stays usable;
       focus moves into it so a screen reader reads it whole, and escape or e closes it */
    if (dlg.show && !dlg.open) { try { dlg.show(); } catch (e) {} }
    if (open) dlg.focus({ preventScroll: true });
    links.forEach(function (l) {
      var a = document.createElement("a"); a.textContent = l[0]; a.href = l[1] === "#exit" ? "#" : l[1];
      if (/^https?:|^mailto:/.test(l[1])) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      else if (l[1] === "#rematch") a.addEventListener("click", function (e) { e.preventDefault(); askRift(); });
      else if (l[1] === "#wake") a.addEventListener("click", function (e) { e.preventDefault(); wakeOrbs(true); });
      else if (l[1] === "#later") a.addEventListener("click", function (e) { e.preventDefault(); wakeOrbs(false); });
      else if (l[1] === "#flash") a.addEventListener("click", function (e) { e.preventDefault(); OPT.flash = !OPT.flash; saveOpt(); a.textContent = flashNote(OPT.flash); });
      else if (l[1] === "#eclipse") a.addEventListener("click", function (e) { e.preventDefault(); crown("eclipse"); });
      else if (l[1] === "#descend") a.addEventListener("click", function (e) { e.preventDefault(); closeDialog(); irisTo(enterSide); });
      else if (l[1] === "#drive") a.addEventListener("click", function (e) { e.preventDefault(); closeDialog(); if (!car.driving) toggleCar(); });
      else a.addEventListener("click", function (e) { e.preventDefault(); exit(l[1] === "#exit" ? null : l[1]); });
      dLinks.appendChild(a);
    });
    full = text; dText.textContent = "";
    if (REDUCED) { dText.textContent = full; typing = null; return; }
    var i = 0;
    clearInterval(typing);
    sfx("open");
    typing = setInterval(function () { i += 2; dText.textContent = full.slice(0, i); if (i % 8 === 0) sfx("type"); if (i >= full.length) finishTyping(); }, 16);
  }
  dlg.addEventListener("cancel", function (e) { e.preventDefault(); if (tour) { endTour(true); return; } if (typing) finishTyping(); else closeDialog(); });
  dlg.addEventListener("click", function (e) {
    if (e.target !== dlg) return;
    var r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
    else if (typing) finishTyping();
  });
  function finishTyping() { clearInterval(typing); typing = null; dText.textContent = full; }
  function closeDialog() {
    finishTyping(); if (dlg.open && dlg.close) dlg.close(); dlg.hidden = true; cv.focus({ preventScroll: true });
    if (SND && SND.duck) SND.duck(false);
    asking = false;
    if (tour) pendingRift = false;
    if (creditsNext && open) { creditsNext = false; showCredits(); return; }
    if (sealNext && open && !tour) { sealNext = false; openSeal(); return; }
    if (pendingRift && open) { pendingRift = false; askRift(); }
  }
  // eight pips in the hud, one per log; the newest pops
  function paintFound(pop) {
    var n = countFound(), h = '<span class="w-pips" role="img" aria-label="found ' + n + " of " + TOTAL + '">';
    for (var i = 0; i < TOTAL; i++) h += "<i" + (i < n ? ' class="on' + (pop && i === n - 1 ? " pop" : "") + '"' : "") + "></i>";
    foundEl.innerHTML = h + "</span>" + (rift && rift.winner ? '<span class="w-core"> · core: ' + rift.winner + "</span>" : "");
  }
  function sealed() { return !save.seal && countFound() < TOTAL; }
  /* the seal breaking: a hard cut to the shrine, the ring cracks open with a toll, and back */
  var cut = null;
  function openSeal() {
    var sh = STATIONS.filter(function (q) { return q.id === "shrine"; })[0];
    cut = { x: sh.x * T + 8, y: sh.y * T, t: 0, broke: false };
    camF.x = cut.x; camF.y = cut.y; fade = 0.9; keys = {}; pi.path = null;
    announce("all eight logs found. the seal on the old shrine breaks.");
  }
  function updateCut(dt) {
    cut.t += dt;
    if (!cut.broke && cut.t > 0.9) {
      cut.broke = true; save.seal = true; writeSave();
      sfx("toll", cut.x, cut.y, { vol: 0.5 }); quake = Math.max(quake, 2);
      for (var i = 0; i < 40; i++) { var a = rand() * 6.283, v = 20 + rand() * 50; embers.push({ x: cut.x, y: cut.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1 + rand() }); }
    }
    if (cut.t > 2.6) { cut = null; camF.x = null; fade = 0.9; bubble = { text: "pi:~$ something up on the highland just opened.", t: 3.5 }; if (pendingRift && open) later(1.2, function () { if (pendingRift && dlg.hidden && !side) { pendingRift = false; askRift(); } }); }
  }
  paintFound();

  /* ════════ outlined, cached frames for everything that moves ════════ */
  var frameCache = {};
  function frameCanvas(rows, pal, w) {
    var key = rows.join("|") + JSON.stringify(pal);
    if (!frameCache[key]) {
      var c = mkCanvas(); c.width = w; c.height = rows.length;
      var g = c.getContext("2d");
      for (var y = 0; y < rows.length; y++) for (var x = 0; x < w; x++) {
        var ch = rows[y][x]; if (!ch || ch === ".") continue;
        g.fillStyle = pal[ch] || pal.W; g.fillRect(x, y, 1, 1);
      }
      frameCache[key] = outline(c, "rgba(16,16,20,.85)");
    }
    return frameCache[key];
  }
  // draw a frame with its feet at (x, y); flip mirrors it to face left
  function drawFrame(rows, pal, w, x, y, flip) {
    var c = skin(frameCanvas(rows, pal, w)), dx = Math.round(x - c.width / 2), dy = Math.round(y - c.height + 1);
    if (!flip) { ctx.drawImage(c, dx, dy); return; }
    ctx.save(); ctx.translate(dx + c.width, dy); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore();
  }

  /* ════════ the clock: the island keeps Ammaar's time (Ellicott City, America/New_York) ════════ */
  var LAT = 39.27, LON = -76.80, TZ = "America/New_York";
  var forced = /[?&]islandhour=([\d.]+)/.exec(location.search), hourOverride = null;   // ?islandhour=21 previews any hour
  function nyNow() {
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
      var get = function (tp) { for (var i = 0; i < parts.length; i++) if (parts[i].type === tp) return +parts[i].value; return 0; };
      h = get("hour") % 24 + get("minute") / 60;
    } catch (e) {}
    var utc = d.getUTCHours() + d.getUTCMinutes() / 60, off = ((h - utc + 36) % 24) - 12;
    if (forced) h = +forced[1] % 24;
    if (hourOverride !== null) h = hourOverride;
    return { h: h, off: off, d: d };
  }
  // sunrise and sunset from the date (NOAA's simplified solar equations), in New York time
  function sunTimes(d, off) {
    var N = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
    var B = 2 * Math.PI * (N - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    var decl = 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365) * Math.PI / 180, lat = LAT * Math.PI / 180;
    var cosH = (Math.cos(90.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
    var half = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI / 15;
    var noon = 12 - LON / 15 - eot / 60 + off;
    return { rise: noon - half, set: noon + half };
  }
  var sky = { h: 12, rise: 7, set: 19, dark: 0, warm: 0 }, skyT = 0;
  var clockEl = document.createElement("span"); clockEl.className = "w-clock";
  foundEl.parentNode.appendChild(clockEl);
  function readSky() {
    if (open && sky.dark > 0.6) foundSecret("night");
    var n = nyNow(), st = sunTimes(n.d, n.off), h = n.h;
    function ramp(x, a, b) { return Math.max(0, Math.min(1, (x - a) / (b - a))); }
    var light = Math.min(ramp(h, st.rise - 0.6, st.rise + 0.5), 1 - ramp(h, st.set - 0.5, st.set + 0.7));
    sky.h = h; sky.rise = st.rise; sky.set = st.set; sky.dark = 1 - light;
    sky.warm = Math.max(0, 1 - Math.abs(h - st.rise) / 0.9) + Math.max(0, 1 - Math.abs(h - st.set) / 0.9);
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60), h12 = ((hh + 11) % 12) + 1;
    var phase = sky.dark > 0.85 ? "night" : sky.warm > 0.35 ? (h < 12 ? "dawn" : "dusk") : "day";
    clockEl.textContent = "· " + h12 + ":" + String(mm).padStart(2, "0") + (hh >= 12 ? " pm" : " am") + " ET · " + phase;
  }
  readSky();

  // lights pushed while drawing the world, lit up after the night tint goes down
  var lights = [], beamAt = null;
  function light(x, y, r, rgb, a) { lights.push([x, y, r, rgb, a]); }
  function drawSky(E) {
    if (REAL === "chaos") return;
    if (REAL === "future") { var sd = sky.dark; sky.dark = 0.85; drawLights(E); sky.dark = sd; return; }
    if (sky.dark > 0.01) {
      var k = sky.dark * 0.8;
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgb(" + Math.round(255 - k * 203) + "," + Math.round(255 - k * 185) + "," + Math.round(255 - k * 120) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (sky.warm > 0.02) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255,120,50," + Math.min(0.45, sky.warm * 0.4).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    drawLights(E);
  }
  function drawLights(E) {
    ctx.globalCompositeOperation = "lighter";
    var night = sky.dark;
    if (night > 0.05) {
      lights.forEach(function (l) {
        var sx = (l[0] - camX) * E, sy = (l[1] - camY) * E, rr = l[2] * E;
        drawGlow(glowSprite("L" + l[3], [[0, l[3], 1], [1, l[3], 0]]), sx, sy, rr, rr, l[4] * night);
      });
      // the lighthouse sweeps the water after dark
      if (beamAt) {
        var bxs = (beamAt.x - camX) * E, bys = (beamAt.y - camY) * E, ba = t * 0.8, br = 180 * E;
        ctx.fillStyle = "rgba(255,226,138," + (0.16 * night).toFixed(3) + ")";
        [0, Math.PI].forEach(function (o) { ctx.beginPath(); ctx.moveTo(bxs, bys); ctx.arc(bxs, bys, br, ba + o - 0.16, ba + o + 0.16); ctx.closePath(); ctx.fill(); });
      }
      // fireflies drift over the grass, and the stars show up in the water
      if (room) { ctx.globalCompositeOperation = "source-over"; return; }
      var VW = W / E, VH = H / E;
      for (var i = 0; i < 26; i++) {
        var fx = camX + ((hash(i, 3) * VW + Math.sin(t * 0.3 + i) * 30 + t * (4 + i % 5)) % VW), fy = camY + ((hash(3, i) * VH + Math.cos(t * 0.4 + i * 2) * 20) % VH);
        if (at(Math.floor(fx / T), Math.floor(fy / T)) !== GRASS) continue;
        var bl = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        ctx.fillStyle = "rgba(210,255,120," + (bl * night * 0.9).toFixed(3) + ")";
        ctx.fillRect((fx - camX) * E, (fy - camY) * E, 2, 2);
      }
      var x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T));
      for (var ty = y0; ty < Math.min(MH, y0 + VH / T + 2); ty++) for (var tx = x0; tx < Math.min(MW, x0 + VW / T + 2); tx++) {
        if (DEPTH[ty][tx] < 2 || hash(tx * 5, ty * 7) > 0.18) continue;
        var tw = 0.5 + 0.5 * Math.sin(t * 2 + tx * 3 + ty);
        ctx.fillStyle = "rgba(230,236,255," + (tw * night * 0.7).toFixed(3) + ")";
        ctx.fillRect((tx * T + hash(tx, ty) * 14 - camX) * E, (ty * T + hash(ty, tx) * 14 - camY) * E, 1.5, 1.5);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* ════════ the locals: dinos, robots, cats, cockatiels, koi ════════
     the dinosaurs are hand-built pixel sprites in one sheet (assets/island/dinos.png), drawn in
     the style of the pterosaur: flat tone bands, dark along the back and light on the belly, a
     dark outline that goes near black underneath, a few speckles. the pterosaur is the original
     sprite, pixel for pixel. middle path is traced from Ammaar's drawing. every sprite faces
     right with its feet on the bottom row; SHEET says where each frame of each mode sits. */
  var SHEET = {"trex":{"w":85,"h":45,"f":[[0,0],[86,0],[172,0],[258,0],[344,0],[430,0],[516,0],[602,0],[688,0],[774,0],[860,0],[946,0],[1032,0],[1118,0],[1204,0],[1290,0],[1376,0],[1462,0],[1548,0],[1634,0],[1720,0],[1806,0],[1892,0],[1978,0],[2064,0],[2150,0],[2236,0],[2322,0],[2408,0],[2494,0],[2580,0]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"roar":[25,26,27,28,29,30]}},"raptor":{"w":39,"h":20,"f":[[0,46],[40,46],[80,46],[120,46],[160,46],[200,46],[240,46],[280,46],[320,46],[360,46],[400,46],[440,46],[480,46],[520,46],[560,46],[600,46],[640,46],[680,46],[720,46],[760,46],[800,46],[840,46],[880,46],[920,46],[960,46]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"brachio":{"w":84,"h":83,"f":[[0,67],[85,67],[170,67],[255,67],[340,67],[425,67],[510,67],[595,67],[680,67],[765,67],[850,67],[935,67],[1020,67],[1105,67],[1190,67],[1275,67],[1360,67],[1445,67],[1530,67],[1615,67],[1700,67],[1785,67],[1870,67],[1955,67],[2040,67],[2125,67],[2210,67],[2295,67],[2380,67],[2465,67],[2550,67],[2635,67],[2720,67]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"graze":[25,26,27,28,29,30,31,32]}},"stego":{"w":65,"h":40,"f":[[0,151],[66,151],[132,151],[198,151],[264,151],[330,151],[396,151],[462,151],[528,151],[594,151],[660,151],[726,151],[792,151],[858,151],[924,151],[990,151],[1056,151],[1122,151],[1188,151],[1254,151],[1320,151],[1386,151],[1452,151],[1518,151],[1584,151],[1650,151],[1716,151],[1782,151],[1848,151],[1914,151],[1980,151],[2046,151],[2112,151]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"graze":[25,26,27,28,29,30,31,32]}},"trike":{"w":64,"h":36,"f":[[0,192],[65,192],[130,192],[195,192],[260,192],[325,192],[390,192],[455,192],[520,192],[585,192],[650,192],[715,192],[780,192],[845,192],[910,192],[975,192],[1040,192],[1105,192],[1170,192],[1235,192],[1300,192],[1365,192],[1430,192],[1495,192],[1560,192],[1625,192],[1690,192],[1755,192],[1820,192],[1885,192],[1950,192],[2015,192],[2080,192]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"graze":[25,26,27,28,29,30,31,32]}},"para":{"w":60,"h":42,"f":[[0,229],[61,229],[122,229],[183,229],[244,229],[305,229],[366,229],[427,229],[488,229],[549,229],[610,229],[671,229],[732,229],[793,229],[854,229],[915,229],[976,229],[1037,229],[1098,229],[1159,229],[1220,229],[1281,229],[1342,229],[1403,229],[1464,229],[1525,229],[1586,229],[1647,229],[1708,229],[1769,229],[1830,229],[1891,229],[1952,229]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"graze":[25,26,27,28,29,30,31,32]}},"ankylo":{"w":52,"h":21,"f":[[0,272],[53,272],[106,272],[159,272],[212,272],[265,272],[318,272],[371,272],[424,272],[477,272],[530,272],[583,272],[636,272],[689,272],[742,272],[795,272],[848,272],[901,272],[954,272],[1007,272],[1060,272],[1113,272],[1166,272],[1219,272],[1272,272],[1325,272],[1378,272],[1431,272],[1484,272],[1537,272],[1590,272],[1643,272],[1696,272]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"graze":[25,26,27,28,29,30,31,32]}},"spino":{"w":96,"h":51,"f":[[0,294],[97,294],[194,294],[291,294],[388,294],[485,294],[582,294],[679,294],[776,294],[873,294],[970,294],[1067,294],[1164,294],[1261,294],[1358,294],[1455,294],[1552,294],[1649,294],[1746,294],[1843,294],[1940,294],[2037,294],[2134,294],[2231,294],[2328,294]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"dilo":{"w":47,"h":32,"f":[[0,346],[48,346],[96,346],[144,346],[192,346],[240,346],[288,346],[336,346],[384,346],[432,346],[480,346],[528,346],[576,346],[624,346],[672,346],[720,346],[768,346],[816,346],[864,346],[912,346],[960,346],[1008,346],[1056,346],[1104,346],[1152,346],[1200,346],[1248,346],[1296,346],[1344,346],[1392,346],[1440,346]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"roar":[25,26,27,28,29,30]}},"pachy":{"w":37,"h":22,"f":[[0,379],[38,379],[76,379],[114,379],[152,379],[190,379],[228,379],[266,379],[304,379],[342,379],[380,379],[418,379],[456,379],[494,379],[532,379],[570,379],[608,379],[646,379],[684,379],[722,379],[760,379],[798,379],[836,379],[874,379],[912,379],[950,379],[988,379],[1026,379],[1064,379],[1102,379],[1140,379]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24],"roar":[25,26,27,28,29,30]}},"galli":{"w":44,"h":40,"f":[[0,402],[45,402],[90,402],[135,402],[180,402],[225,402],[270,402],[315,402],[360,402],[405,402],[450,402],[495,402],[540,402],[585,402],[630,402],[675,402],[720,402],[765,402],[810,402],[855,402],[900,402],[945,402],[990,402],[1035,402],[1080,402]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"compy":{"w":23,"h":10,"f":[[0,443],[24,443],[48,443],[72,443],[96,443],[120,443],[144,443],[168,443],[192,443],[216,443],[240,443],[264,443],[288,443],[312,443],[336,443],[360,443],[384,443],[408,443],[432,443],[456,443],[480,443],[504,443],[528,443],[552,443],[576,443]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"baby":{"w":27,"h":18,"f":[[0,454],[28,454],[56,454],[84,454],[112,454],[140,454],[168,454],[196,454],[224,454],[252,454],[280,454],[308,454],[336,454],[364,454],[392,454],[420,454],[448,454],[476,454],[504,454],[532,454],[560,454],[588,454],[616,454],[644,454],[672,454]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"baby2":{"w":27,"h":18,"f":[[0,473],[28,473],[56,473],[84,473],[112,473],[140,473],[168,473],[196,473],[224,473],[252,473],[280,473],[308,473],[336,473],[364,473],[392,473],[420,473],[448,473],[476,473],[504,473],[532,473],[560,473],[588,473],[616,473],[644,473],[672,473]],"m":{"walk":[0,1,2,3,4,5,6,7,8,9,10,11],"idle":[12,13,14,15,16,17,18,19,20,21,22,23],"blink":[24]}},"ptero":{"w":32,"h":45,"f":[[0,492],[33,492],[66,492],[99,492],[132,492],[165,492],[198,492],[231,492],[264,492],[297,492],[330,492],[363,492],[396,492],[429,492],[462,492],[495,492],[528,492]],"m":{"fly":[0,1,2,3,4,5,6,7,8,9,10,11],"glide":[12,13,14,15],"blink":[16]}}};
  var ENV_IMG = new Image();
  ENV_IMG.onload = function () {
    Object.keys(ENV).forEach(function (n) {
      var e = ENV[n], c = mkCanvas(); c.width = e[2]; c.height = e[3];
      c.getContext("2d").drawImage(ENV_IMG, e[0], e[1], e[2], e[3], 0, 0, e[2], e[3]); SPR["e:" + n] = c;
    });
  };
  ENV_IMG.src = "img/atlas/env.png?v=20261022";
  var SHEET_IMG = new Image(), sheetReady = false;
  SHEET_IMG.onload = function () { sheetReady = true; };
  SHEET_IMG.src = "assets/island/dinos.png?v=20261022";
  var DART = {}, BLANK = mkCanvas(); BLANK.width = BLANK.height = 1;
  function dinoFrame(kind, mode, i) {
    var d = SHEET[kind]; if (!d || !sheetReady) return BLANK;
    var list = d.m[mode] || d.m.idle || d.m.fly, n = list[((i | 0) % list.length + list.length) % list.length], key = kind + ":" + n;
    if (!DART[key]) {
      var c = mkCanvas(); c.width = d.w; c.height = d.h;
      c.getContext("2d").drawImage(SHEET_IMG, d.f[n][0], d.f[n][1], d.w, d.h, 0, 0, d.w, d.h);
      DART[key] = c;
    }
    return DART[key];
  }
  function artW(kind) { return SHEET[kind] ? SHEET[kind].w : 16; }
  function artH(kind) { return SHEET[kind] ? SHEET[kind].h : 16; }
  // draw a canvas with its feet at (x, y); flip mirrors it to face left
  function drawArt(c, x, y, flip) {
    c = skin(c);
    var dx = Math.round(x - c.width / 2), dy = Math.round(y - c.height + 1);
    if (!flip) { ctx.drawImage(c, dx, dy); return; }
    ctx.save(); ctx.translate(dx + c.width, dy); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore();
  }
  var DINOS = {
    brachio: { art: true, sp: 7, step: 1.6, graze: true, say: ["a brachiosaurus. it's eating the top off a palm, very slowly.", "a brachiosaurus. from down here pi can only see its knees."] },
    trex: { art: true, sp: 13, step: 2.1, say: ["the t-rex. it stares at pi through the fence and does not blink.", "the t-rex. 10,000 volts between you and it. it's thinking about that."] },
    stego: { art: true, sp: 8, step: 1.4, graze: true, say: "a stegosaurus. those plates are mostly for show." },
    trike: { art: true, sp: 10, step: 1.4, graze: true, say: "a triceratops. it's grazing and would like some personal space." },
    para: { art: true, sp: 12, step: 1.7, graze: true, say: ["a parasaurolophus. it honks through its crest. pi honks back.", "a parasaurolophus. it's keeping an eye on the pond."] },
    raptor: { art: true, sp: 26, step: 2.3, say: ["a utahraptor. feathered, about the length of a car, and definitely not testing the fences.", "a utahraptor. it fluffs its feathers and clicks at the others. they all look at pi."] },
    ankylo: { art: true, sp: 6, step: 1.1, graze: true, say: "an ankylosaurus. armored, unbothered, and swinging that tail at nothing in particular." },
    baby: { art: true, sp: 13, step: 0.8, say: "a baby dino. it squeaks at pi." },
    spino: { art: true, sp: 10, step: 1.9, say: ["a spinosaurus, working the riverbank for fish. the sail catches the light.", "a spinosaurus. its snout is more crocodile than dinosaur. it ignores pi completely, which is somehow worse."] },
    dilo: { art: true, sp: 16, step: 2, say: ["a dilophosaurus. two thin crests on its head, and a call that carries across the paddock.", "a dilophosaurus. it hoots and bobs its crests. pi admires them from here."] },
    pachy: { art: true, sp: 12, step: 1.8, say: ["a pachycephalosaurus. the dome on its head is solid bone, about a foot thick.", "a pachycephalosaurus, sizing up the other one. they're going to butt heads again."] },
    galli: { art: true, sp: 30, step: 2.8, say: ["a gallimimus. an ostrich of a dinosaur, and just as quick to bolt.", "a gallimimus. the whole herd flinches when pi gets close."] },
    compy: { art: true, sp: 26, step: 1.2, say: ["a compsognathus. about the size of a chicken. there are more of them than pi counted.", "a compy. it chirps and darts off, and the others follow."] },
    baby2: { art: true, sp: 13, step: 0.8, say: "a baby dino, fresh out of the nest. it follows pi for a step, then forgets." },
    robot: { w: 8, pal: { M: "#b8c2cc", D: "#5c6670", E: "#4DD6E8", O: "#FF5252" }, sp: 12, paths: true,
      a: ["...O....","...M....",".MMMMMM.",".MEMMEM.",".MMMMMM.","..DDDD..",".MMMMMM.","MMMMMMMM",".M.DD.M.",".DD..DD."],
      b: ["...D....","...M....",".MMMMMM.",".MEMMEM.",".MMMMMM.","..DDDD..",".MMMMMM.","MMMMMMMM",".M.DD.M.","DD....DD"],
      say: ["a maintenance bot. it beeps: 'dns healthy. failover armed.'", "a maintenance bot. it's labeling cables again.", "a maintenance bot. it whispers: 'there's an old terminal in a cave, up on the volcano. nobody logged out.'"] },
    roomba: { w: 8, pal: { D: "#2a2d33", M: "#4a4f58", G: "#4ADE80" }, sp: 9, paths: true,
      a: ["..DDDD..",".DMMMMD.","DMMGMMMD",".DMMMMD.","..DDDD.."], b: ["..DDDD..",".DMMMMD.","DMMMMMMD",".DMMMMD.","..DDDD.."],
      say: "a little cleaning bot, sweeping the plaza. it bumps pi and says sorry." },
    cat: { w: 12, pal: { C: "#f1e6d2", L: "#fff8ec", D: "#5b4636", B: "#6fb7ff", Q: "#ff7eb6" }, sp: 10, cat: true,
      a: [".........D.D","D........DDD","DCLLLLLCCDBD",".CCCCCCCQDDD",".CCCCCCCCCC.",".CCCCCCCCC..","..D.D...D.D."],
      b: [".........D.D","D........DDD","DCLLLLLCCDBD",".CCCCCCCQDDD",".CCCCCCCCCC.",".CCCCCCCCC..","...D.D..D.D."],
      z: ["....CCCC....","..CLLLLCCC..",".CCCCCCCCCD.",".CCCCCCCDDD.","..DDCCCCCC.."],
      say: "one of Ammaar's two himalayan cats. very fluffy, fully unbothered.", sleepSay: "one of Ammaar's two himalayan cats. it's asleep in the sun. pi lets it be." }
  };
  function critter(kind, tx, ty, area) {
    return { kind: kind, x: tx * T + 8, y: ty * T + 10, area: area, tx: 0, ty: 0, wait: rand() * 3, face: rand() < 0.5 ? 1 : -1, dist: 0, hop: 0, vy: 0, sleep: 0, roar: 0, cd: 0, graze: 0, seed: rand() * 10, call: 3 + rand() * 14, fast: 1 };
  }
  var ROARS = { trex: 1, dilo: 1, pachy: 1 };
  var CALLS = { spino: "grunt", dilo: "screech", pachy: "snort", galli: "squeak", compy: "chirp", brachio: "hoot", trex: "grunt", raptor: "screech", trike: "snort", ankylo: "snort", stego: "grunt", para: "honkp", baby: "squeak", baby2: "squeak", robot: "chatter", roomba: "chatter" };
  var HERD = [55, 52, 68, 60], PEN = [61, 31, 69, 37], REXPAD = [28, 44, 38, 53];
  var critters = [
    critter("brachio", 16, 36, [13, 32, 25, 44]), critter("brachio", 21, 42, [13, 32, 25, 44]),
    critter("trex", 33, 48, REXPAD),
    critter("raptor", 63, 33, PEN), critter("raptor", 66, 35, PEN), critter("raptor", 67, 32, PEN),
    critter("stego", 58, 55, HERD), critter("trike", 62, 54, HERD), critter("trike", 65, 58, HERD), critter("ankylo", 57, 58, HERD),
    critter("para", 76, 44, [72, 41, 84, 48]), critter("para", 80, 46, [72, 41, 84, 48]),
    critter("spino", 20, 48, [17, 44, 26, 53]), critter("dilo", 30, 33, [26, 29, 36, 36]),
    critter("pachy", 75, 34, [72, 31, 82, 38]), critter("pachy", 79, 35, [72, 31, 82, 38]),
    critter("galli", 74, 46, [70, 42, 85, 49]), critter("galli", 78, 42, [70, 42, 85, 49]), critter("galli", 82, 44, [70, 42, 85, 49]), critter("galli", 73, 43, [70, 42, 85, 49]),
    critter("compy", 33, 60, [29, 58, 38, 64]), critter("compy", 34, 61, [29, 58, 38, 64]), critter("compy", 32, 62, [29, 58, 38, 64]), critter("compy", 35, 60, [29, 58, 38, 64]), critter("compy", 31, 61, [29, 58, 38, 64]),
    critter("baby", 60, 57, [56, 54, 66, 59]), critter("baby2", 63, 56, [56, 54, 66, 59]), critter("baby", 17, 40, [14, 36, 22, 43]),
    critter("robot", 45, 61, [40, 59, 52, 63]), critter("robot", 30, 61, [27, 60, 40, 63]), critter("roomba", 47, 60, [44, 59, 49, 62]),
    critter("cat", 65, 51, [62, 49, 72, 54]), critter("cat", 70, 52, [62, 49, 72, 54])
  ];
  // anything that spawned inside a tree or a wall steps out to the nearest open ground
  critters.forEach(function (c) {
    var tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    for (var r0 = 0; r0 < 6 && !walkable(tx, ty); r0++) for (var j = -r0; j <= r0; j++) for (var i = -r0; i <= r0; i++) if (walkable(tx + i, ty + j) && !walkable(tx, ty)) { tx += i; ty += j; }
    c.x = tx * T + 8; c.y = ty * T + 10;
  });
  // Ammaar's cats: jasmine (pink collar) and prince (blue collar)
  var cats = critters.filter(function (c) { return c.kind === "cat"; });
  cats[0].name = "jasmine"; cats[0].pal = { Q: "#ff7eb6" }; cats[0].say = "jasmine, one of Ammaar's two himalayan cats. she's very fluffy and fully unbothered.";
  cats[1].name = "prince"; cats[1].pal = { Q: "#4f8fff" }; cats[1].say = "prince, one of Ammaar's two himalayan cats. he inspects pi, then goes back to supervising.";
  var trex = critters.filter(function (c) { return c.kind === "trex"; })[0];
  function okFor(c, tx, ty) {
    if (!walkable(tx, ty)) return false;
    var tt = at(tx, ty), d = DINOS[c.kind];
    if (d.paths) return tt === PATH;
    if (d.cat) return tt !== DOCK;
    return tt === GRASS;
  }
  function updateCritter(c, dt) {
    var d = DINOS[c.kind];
    if (c.hop) { c.vy += 9 * dt; c.hop += c.vy; if (c.hop >= 0) { c.hop = 0; c.vy = 0; } }
    c.roar = Math.max(0, c.roar - dt); c.cd = Math.max(0, c.cd - dt);
    if (c.sleep > 0) {
      c.sleep -= dt;
      if (d.art && !room && Math.hypot(pi.x - c.x, pi.y - c.y) < 26) { c.sleep = 0; c.hop = c.hop || 1; c.vy = -1.4; c.wait = 3; }   // woken up
      return;
    }
    if (c.roar > 0) return;
    c.graze = Math.max(0, c.graze - dt);
    if (!c.tx && d.art && !room && Math.hypot(pi.x - c.x, pi.y - c.y) < 56) c.face = pi.x > c.x ? 1 : -1;     // idle dinos turn to watch pi
    // every creature has a voice, and calls out now and then (heard only if pi is in earshot)
    c.call -= dt;
    if (c.call <= 0) {
      c.call = 9 + rand() * 18;
      var cs = CALLS[c.kind];
      if (cs && !room && Math.hypot(pi.x - c.x, pi.y - c.y) < 300) { sfx(cs, c.x, c.y); if (d.art && !c.tx) c.hop = c.hop || (c.kind.indexOf("baby") === 0 ? 1 : 0); }
    }
    var pd0 = room ? 1e9 : Math.hypot(pi.x - c.x, pi.y - c.y);
    // the small and the skittish bolt when pi gets close
    // at night the dinosaurs doze where they stand (the raptors don't)
    if (d.art && sky.dark > 0.7 && !c.tx && c.kind !== "raptor" && pd0 > 70 && c.wait > 0 && rand() < dt * 0.3) { c.sleep = 8 + rand() * 14; return; }
    if ((c.kind === "compy" && pd0 < 48) || (c.kind === "galli" && pd0 < 64)) {
      if (!c.flee || !c.tx) { var fa = Math.atan2(c.y - pi.y, c.x - pi.x) + (rand() - 0.5) * 0.8; c.tx = c.x + Math.cos(fa) * 60; c.ty = c.y + Math.sin(fa) * 40; c.fast = 1.6; c.flee = 1; if (rand() < 0.3) sfx(CALLS[c.kind], c.x, c.y); }
    } else c.flee = 0;
    // the dilophosaurus calls; two pachycephalosaurs butt heads
    if (c.kind === "dilo" && !c.tx && rand() < dt * 0.08) { c.roar = 1.4; sfx("screech", c.x, c.y); }
    if (c.kind === "pachy" && !c.tx && c.cd <= 0) {
      var rival2 = critters.filter(function (o) { return o.kind === "pachy" && o !== c && !o.tx; })[0];
      if (rival2 && Math.hypot(rival2.x - c.x, rival2.y - c.y) < 44 && rand() < dt * 0.4) {
        c.face = rival2.x > c.x ? 1 : -1; rival2.face = -c.face; c.roar = rival2.roar = 1; c.cd = rival2.cd = 6;
        later(0.45, function () { sfx("hit", c.x, c.y, { vol: 0.7 }); c.hop = rival2.hop = 1; c.vy = rival2.vy = -1.4; });
      }
    }
    // the raptors pace their fence to keep level with pi
    if (c.kind === "raptor" && pd0 < 170 && !aboard() && (!c.tx || rand() < dt * 1.2)) {
      var ro = (critters.indexOf(c) % 3 - 1) * 14;
      c.tx = Math.max((c.area[0] + 0.5) * T, Math.min((c.area[2] + 0.5) * T, pi.x + ro)); c.ty = Math.max((c.area[1] + 0.5) * T, Math.min((c.area[3] + 0.5) * T, pi.y + ro * 0.5)); c.fast = 1.5;
      if (!okFor(c, Math.floor(c.tx / T), Math.floor(c.ty / T))) c.tx = 0;
    }
    // stand still beside the brachiosaurus for a couple of seconds and it lowers its head to look
    if (c.kind === "brachio") {
      if (pd0 < 52 && !pi.vx && !pi.vy && !c.tx) { c.near = (c.near || 0) + dt; if (c.near > 2 && c.graze <= 0) { c.graze = 3.5; c.face = pi.x > c.x ? 1 : -1; c.wait = Math.max(c.wait, 3.5); sfx("hoot", c.x, c.y, { vol: 0.5 }); c.near = -4; } }
      else c.near = (c.near || 0) < 0 ? c.near + dt : 0;
    }
    // the t-rex stalks pi along the inside of its fence
    if (c.kind === "trex" && pd0 < 190 && !aboard() && (!c.tx || rand() < dt * 1.5)) {
      c.tx = Math.max((c.area[0] + 0.5) * T, Math.min((c.area[2] + 0.5) * T, pi.x)); c.ty = Math.max((c.area[1] + 0.5) * T, Math.min((c.area[3] + 0.5) * T, pi.y)); c.fast = 1.4;
    }
    c.wait -= dt;
    if (c.wait <= 0 && !c.tx) {
      c.fast = 1;
      // raptors dart after each other; herd animals drift together
      if (c.kind === "raptor" && rand() < 0.35) { var mate = critters.filter(function (o) { return o.kind === "raptor" && o !== c; })[(rand() * 2) | 0]; if (mate) { c.tx = mate.x + (rand() - 0.5) * 30; c.ty = mate.y + (rand() - 0.5) * 20; c.fast = 1.7; } }
      if (d.graze && rand() < 0.4) { var lead = critters.filter(function (o) { return o !== c && o.area === c.area && o.tx; })[0]; if (lead) { c.tx = lead.tx + (rand() - 0.5) * 40; c.ty = lead.ty + (rand() - 0.5) * 24; } }
      if (c.tx && !okFor(c, Math.floor(c.tx / T), Math.floor(c.ty / T))) c.tx = 0;
    }
    if (c.wait <= 0 && !c.tx) {
      for (var tries = 0; tries < 6; tries++) {
        var tx = c.area[0] + Math.floor(rand() * (c.area[2] - c.area[0] + 1)), ty = c.area[1] + Math.floor(rand() * (c.area[3] - c.area[1] + 1));
        if (okFor(c, tx, ty)) { c.tx = tx * T + 8; c.ty = ty * T + 10; break; }
      }
      if (!c.tx) c.wait = 1;
    }
    if (c.tx) {
      var dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
      if (dd < 2) {
        c.tx = 0; c.wait = 1 + rand() * 4;
        if (d.cat && rand() < 0.4) c.sleep = 6 + rand() * 10;
        if (d.graze && rand() < 0.55) { c.graze = 3 + rand() * 5; c.wait = Math.max(c.wait, c.graze); }
        return;
      }
      var bx = c.x, by = c.y, step = d.sp * (c.fast || 1) * dt, d0 = c.dist;
      move(c, dx / dd * step, dy / dd * step);
      c.dist += step; if (Math.abs(dx) > 1) c.face = dx > 0 ? 1 : -1;
      // big feet: every footfall thuds, and close by you feel it
      if ((c.kind === "trex" || c.kind === "brachio") && Math.floor(c.dist / (d.step * 3)) !== Math.floor(d0 / (d.step * 3))) {
        sfx("stomp", c.x, c.y, { vol: c.kind === "brachio" ? 0.9 : 0.7 });
        if (pd0 < 120) quake = Math.max(quake, c.kind === "brachio" ? 1.2 : 0.8);
      }
      if (Math.hypot(c.x - bx, c.y - by) < 0.01) { c.tx = 0; c.wait = 0.5; }
    }
  }
  // a sleeper's z's: small, drifting up and fading, one after another
  function sleepZ(x, y, seed) {
    for (var i = 0; i < 2; i++) {
      var ph = (t * 0.5 + i * 0.5 + seed) % 1, zx = Math.round(x + ph * 5 + i * 2), zy = Math.round(y - 2 - ph * 9);
      ctx.fillStyle = "rgba(232,238,252," + (Math.sin(ph * Math.PI) * 0.9).toFixed(2) + ")";
      ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
    }
  }
  function drawCritter(c) {
    var d = DINOS[c.kind];
    if (d.art) {
      // the cycles are baked by tools/animate.py: walk 12 frames a stride (tied to distance, so feet
      // don't skate), idle 12 at 8 fps, graze 8 at 6 fps, calls 6 at 10 fps
      var mode = "idle", fr = Math.floor(t * 8 + c.seed * 5);
      if (c.roar > 0 && ROARS[c.kind]) { mode = "roar"; fr = Math.floor(t * 10); }
      else if (c.sleep > 0) { mode = "blink"; fr = 0; }
      else if (c.tx) { mode = "walk"; fr = Math.floor(c.dist / (d.step / 2)); }
      else if (c.graze > 0) { mode = "graze"; fr = Math.floor(t * 6 + c.seed); }
      else if (hash(Math.floor(t * 3 + c.seed * 7), 3) < 0.07) { mode = "blink"; fr = 0; }
      var art = dinoFrame(c.kind, mode, fr);
      softShadow(c.x, c.y, Math.max(8, art.width * 0.6));
      drawArt(art, c.x, c.y + c.hop + (c.roar > 0 ? Math.round(Math.sin(t * 40)) : 0), c.face < 0);
      if (c.sleep > 0) sleepZ(c.x + c.face * art.width * 0.25, c.y - art.height, c.seed);
      return;
    }
    var rows = c.sleep > 0 && d.z ? d.z : (Math.floor(c.dist / 4) % 2 ? d.b : d.a);
    if (c.kind === "robot") rows = Math.floor(t * 2) % 2 ? d.a : d.b;                      // antenna blinks
    shadow(c.x, c.y, Math.max(6, d.w - 4));
    drawFrame(rows, c.pal ? Object.assign({}, d.pal, c.pal) : d.pal, d.w, c.x, c.y + c.hop, c.face < 0);
    if (c.sleep > 0 && Math.floor(t * 1.5) % 2) { ctx.fillStyle = "#e8eefc"; ctx.fillRect(Math.round(c.x + 4), Math.round(c.y - 9 - (t * 3 % 3)), 2, 1); }   // z
    if (c.kind === "robot") light(c.x, c.y - 6, 10, "77,214,232", 0.5);
  }

  /* ════════ the robot crew ════════
     the island runs itself. cargo bots haul crates off the dock to the depot and on to the
     visitor centre, drones fly parcels from the depot roof out to the landmarks, a welder
     patches the raptor pen fence (the raptors keep testing it), and a gardener waters the
     ferns. every one of them beeps, whirs or hisses while it works. */
  var BOTART = {
    cargo: { w: 12, pal: { D: "#3a4048", M: "#9aa6b2", L: "#c8d2dc", E: "#4DD6E8", Y: "#f2c230", K: "#1a1a1a", T: "#2a2d33", t: "#4a4f58" },
      a: ["..DDDDDDDD..", ".DLLLLLLLLD.", ".DMEEMMEEMD.", ".DMMMMMMMMD.", "DDDDDDDDDDDD", "YKYKYKYKYKYK", ".TTTTTTTTTT.", ".TtTtTtTtTT."],
      b: ["..DDDDDDDD..", ".DLLLLLLLLD.", ".DMEEMMEEMD.", ".DMMMMMMMMD.", "DDDDDDDDDDDD", "KYKYKYKYKYKY", ".TTTTTTTTTT.", ".tTtTtTtTtT."] },
    welder: { w: 10, pal: { M: "#d8a838", D: "#7a5a1e", V: "#ff9a30", K: "#1a1a1a", G: "#5c6670", L: "#f2d06a" },
      a: ["..LMMMM...", ".MVVVVVM..", ".MMMMMMM..", "..DDDDD...", ".MMMMMMGG.", "MMMMMMM..G", ".M.DD.M...", ".DD..DD..."],
      b: ["..LMMMM...", ".MVVVVVM..", ".MMMMMMM.G", "..DDDDD.G.", ".MMMMMMG..", "MMMMMMM...", ".M.DD.M...", ".DD..DD..."] },
    gardener: { w: 10, pal: { M: "#5aa84a", D: "#2f6a2a", E: "#e8fbff", C: "#4f8fff", c: "#8fc0ff", K: "#1a1a1a" },
      a: ["...DDD....", "..MMMMM...", ".MEMMMEM..", ".MMMMMMM..", "..DDDDD...", "CCMMMMM...", "Cc.D.D....", "...D.D...."],
      b: ["...DDD....", "..MMMMM...", ".MEMMMEM..", ".MMMMMMM..", "..DDDDD...", "CCMMMMM...", "Cc..D.D...", "...D...D.."] }
  };
  var DOCKPT = [DOCKX, dockY], DEPOTPT = [54, 60], VISITPT = [41, 60];
  function tileOf(o) { return [Math.floor(o.x / T), Math.floor(o.y / T)]; }
  var bots = [
    { kind: "cargo", x: DOCKPT[0] * T + 8, y: DOCKPT[1] * T + 10, legs: [DEPOTPT, VISITPT, DEPOTPT, DOCKPT], leg: 0, path: null, carry: true, wait: 1, face: 1, dist: 0 },
    { kind: "cargo", x: DEPOTPT[0] * T + 8, y: DEPOTPT[1] * T + 10, legs: [DOCKPT, DEPOTPT], leg: 0, path: null, carry: false, wait: 4, face: -1, dist: 0 },
    { kind: "welder", x: 59 * T + 8, y: 39 * T + 10, spots: [[59, 34], [62, 39], [67, 39], [71, 34]], spot: 0, path: null, wait: 6, face: -1, dist: 0, work: 0 },
    { kind: "gardener", x: 45 * T + 8, y: 62 * T + 10, path: null, wait: 2, face: 1, dist: 0, work: 0 }
  ];
  var pad = { x: 54.5 * T, y: 58 * T + 6, roof: 30 };
  var drones = [0, 1].map(function (i) { return { x: pad.x + i * 6, y: pad.y, z: pad.roof, state: "rest", wait: 2 + i * 5, tx: 0, ty: 0, carry: true, spin: 0 }; });
  var sparks = [];
  function botGo(b, goal) { b.path = bfs(tileOf(b), goal, true); if (b.path) sfx("servo", b.x, b.y); }
  function stepBot(b, dt, sp) {
    if (!b.path || !b.path.length) { b.path = null; return true; }
    var n = b.path[0], gx = n[0] * T + 8, gy = n[1] * T + 10, dx = gx - b.x, dy = gy - b.y, dd = Math.hypot(dx, dy);
    if (dd < 1.5) { b.path.shift(); return !b.path.length && (b.path = null, true); }
    b.x += dx / dd * sp * dt; b.y += dy / dd * sp * dt; b.dist += sp * dt; if (Math.abs(dx) > 0.5) b.face = dx > 0 ? 1 : -1;
    return false;
  }
  var BARKS = { cargo: ["fragile: eggs. i drive slow.", "beep. please step off the loading lane."], welder: ["the raptors watch me work. i work faster.", "safety first. then sparks."], gardener: ["i don't water past the shrine. it hums.", "ferns first, then you, by accident."] };
  function compass(dx, dy) { var a = Math.atan2(-dy, dx) * 180 / Math.PI, d8 = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"]; return d8[((Math.round(a / 45) % 8) + 8) % 8]; }
  function botBark(b) {
    b.barkN = ((b.barkN || 0) + 1) % 3;
    if (b.barkN === 1) {
      var g = nearestUnfound(b.x, b.y);
      if (g) return g.q.name + ": " + compass(g.x - b.x, g.y - b.y) + " of here.";
      return "all eight logs. the orbs are restless.";
    }
    if (b.barkN === 2) {
      var left = SECRETS.filter(function (x) { return save.secrets.indexOf(x.id) < 0; });
      if (left.length) return "rumour: " + left[(rand() * left.length) | 0].hint;
    }
    var j = BARKS[b.kind]; return j[(rand() * j.length) | 0];
  }
  function updateBots(dt) {
    bots.forEach(function (b) {
      b.barkCd = Math.max(0, (b.barkCd || 0) - dt); if (b.bark && (b.bark.t -= dt) <= 0) b.bark = null;
      if (!room && !riftBusy() && b.barkCd <= 0 && Math.hypot(pi.x - b.x, pi.y - b.y) < 34) { b.bark = { text: botBark(b), t: 3.6 }; b.barkCd = 12; b.face = pi.x > b.x ? 1 : -1; sfx("chatter", b.x, b.y, { vol: 0.6 }); }
      if (b.wait > 0) { b.wait -= dt; if (b.kind === "welder" && b.work > 0) { b.work -= dt; weldSparks(b, dt); } if (b.kind === "gardener" && b.work > 0) { b.work -= dt; spraying(b); } return; }
      if (b.kind === "cargo") {
        if (!b.path) { var goal = b.legs[b.leg]; botGo(b, goal); if (!b.path) { b.wait = 2; b.leg = (b.leg + 1) % b.legs.length; } return; }
        if (stepBot(b, dt, 20)) {
          // at the dock it loads a crate; at the depot or the visitor centre it drops one off
          var at0 = b.legs[b.leg];
          b.carry = at0 === DOCKPT || (at0 === DEPOTPT && b.legs.length > 2 && b.leg === 0);
          b.leg = (b.leg + 1) % b.legs.length; b.wait = 1.6 + rand();
          if (at0 === DOCKPT) sfx("backup", b.x, b.y); else sfx("chatter", b.x, b.y);
        }
      } else if (b.kind === "welder") {
        if (!b.path) { b.spot = (b.spot + 1) % b.spots.length; botGo(b, b.spots[b.spot]); if (!b.path) b.wait = 3; return; }
        if (stepBot(b, dt, 14)) { b.wait = 8 + rand() * 6; b.work = b.wait; b.face = 1; }
      } else if (b.kind === "gardener") {
        if (!b.path) {
          var near2 = props.filter(function (p2) { return /^e:(fern|cycad|bush|magnolia|tallgrass)/.test(p2.kind) && Math.abs(p2.tx - 46) < 12 && Math.abs(p2.ty - 58) < 8; });
          var pick = near2[(rand() * near2.length) | 0];
          if (pick) botGo(b, [pick.tx, pick.ty + 1]);
          if (!b.path) { b.wait = 2; return; }
          b.target = pick; return;
        }
        if (stepBot(b, dt, 12)) { b.wait = 2.5; b.work = 2.5; if (b.target) { b.target.rustle = 0.6; if (rustling.indexOf(b.target) < 0) rustling.push(b.target); } sfx("spray", b.x, b.y); }
      }
    });
    sparks.forEach(function (s2) { s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.vy += 80 * dt; s2.life -= dt * 2.2; });
    sparks = sparks.filter(function (s2) { return s2.life > 0; });
    drones.forEach(function (d) {
      d.spin += dt * 40;
      if (d.state === "rest") { d.z = pad.roof; if ((d.wait -= dt) <= 0) { var dest = OUT[(rand() * OUT.length) | 0]; d.tx = dest.x * T + 8; d.ty = dest.y * T + 18; d.state = "up"; d.carry = true; } }
      else if (d.state === "up") { d.z += 18 * dt; if (d.z >= 46) d.state = d.carry ? "out" : "home"; }
      else if (d.state === "out" || d.state === "home") {
        var gx = d.state === "out" ? d.tx : pad.x, gy = d.state === "out" ? d.ty : pad.y, dx = gx - d.x, dy = gy - d.y, dd = Math.hypot(dx, dy);
        if (dd < 3) { d.state = d.state === "out" ? "drop" : "land"; d.wait = 1.4; }
        else { d.x += dx / dd * 46 * dt; d.y += dy / dd * 46 * dt; }
      } else if (d.state === "drop") { d.z = Math.max(16, d.z - 30 * dt); if ((d.wait -= dt) <= 0) { d.carry = false; sparks.push({ x: d.x, y: d.y - 4, vx: 0, vy: -10, life: 0.8, c: "#c89458", box: true }); d.state = "up"; } }
      else if (d.state === "land") { d.z = Math.max(pad.roof, d.z - 18 * dt); if (d.z <= pad.roof) { d.state = "rest"; d.wait = 4 + rand() * 6; } }
    });
  }
  function weldSparks(b, dt) {
    if (rand() < dt * 30) { var sx = b.x + 9 * b.face, sy = b.y - 6; sparks.push({ x: sx, y: sy, vx: (rand() - 0.5) * 70, vy: -30 - rand() * 40, life: 1, c: rand() < 0.5 ? "#ffe07a" : "#ffffff" }); light(sx, sy, 14, "255,200,120", 0.9); }
    b.wt = (b.wt || 0) - dt; if (b.wt <= 0) { b.wt = 1 + rand() * 0.8; sfx("weld", b.x, b.y); }
  }
  function spraying(b) { if (rand() < 0.6) sparks.push({ x: b.x - 6 * b.face, y: b.y - 4, vx: -b.face * (20 + rand() * 20), vy: -10 - rand() * 10, life: 0.8, c: "#8fc0ff" }); }
  function drawBot(b) {
    var art = BOTART[b.kind], rows = Math.floor(b.dist / 3) % 2 || (b.work > 0 && Math.floor(t * 6) % 2) ? art.b : art.a;
    shadow(b.x, b.y, art.w - 2);
    drawFrame(rows, art.pal, art.w, b.x, b.y, b.face < 0);
    if (b.kind === "cargo" && b.carry) { var cx = Math.round(b.x - 4), cy = Math.round(b.y - 14); ctx.fillStyle = "#1a1a1a"; ctx.fillRect(cx - 1, cy - 1, 10, 8); ctx.fillStyle = "#a0703e"; ctx.fillRect(cx, cy, 8, 6); ctx.fillStyle = "#c89458"; ctx.fillRect(cx, cy, 8, 1); ctx.fillStyle = "#7a5230"; ctx.fillRect(cx + 3, cy + 1, 1, 5); }
    light(b.x, b.y - 6, 12, b.kind === "welder" ? "255,154,48" : "77,214,232", 0.45);
  }
  function drawSparks() { sparks.forEach(function (s2) { ctx.fillStyle = s2.c; ctx.globalAlpha = Math.min(1, s2.life); ctx.fillRect(Math.round(s2.x), Math.round(s2.y), s2.box ? 3 : 1, s2.box ? 3 : 1); }); ctx.globalAlpha = 1; }
  function drawDroneShadow(d) { var k2 = Math.max(0.4, 1 - d.z / 90); ctx.fillStyle = "rgba(0,0,0," + (0.22 * k2).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 7 * k2, 3 * k2, 0, 0, 6.283); ctx.fill(); }
  function drawDrone(d) {
    var x = Math.round(d.x), y = Math.round(d.y - d.z);
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x - 8, y - 1, 16, 1); ctx.fillRect(x - 1, y - 4, 2, 7);
    [[-8, -3], [7, -3], [-8, 2], [7, 2]].forEach(function (r4, i) { var w4 = Math.abs(Math.sin(d.spin + i)) * 3 + 1; ctx.fillStyle = "rgba(210,220,230,.7)"; ctx.fillRect(x + r4[0] - Math.round(w4 / 2) + 1, y + r4[1], Math.round(w4), 1); });
    ctx.fillStyle = "#3a4048"; ctx.fillRect(x - 3, y - 2, 7, 4); ctx.fillStyle = "#9aa6b2"; ctx.fillRect(x - 3, y - 2, 7, 1); ctx.fillStyle = "#4DD6E8"; ctx.fillRect(x, y, 1, 1);
    if (d.carry) { ctx.fillStyle = "#a0703e"; ctx.fillRect(x - 2, y + 3, 5, 4); ctx.fillStyle = "#c89458"; ctx.fillRect(x - 2, y + 3, 5, 1); }
    if (Math.floor(t * 3) % 2) { ctx.fillStyle = "#ff5252"; ctx.fillRect(x - 3, y - 2, 1, 1); ctx.fillStyle = "#4ADE80"; ctx.fillRect(x + 3, y - 2, 1, 1); }
    light(d.x, d.y, 10, "180,240,255", 0.3);
  }
  var BOTSAY = {
    cargo: ["a cargo bot, hauling crates between the dock and the depot. it beeps at pi to move.", "a cargo bot. the crate says FRAGILE: EGGS. it drives very carefully."],
    welder: ["a welder bot, patching the raptor pen. the raptors watch it work. it works faster.", "a welder bot. sparks everywhere. it gives pi a thumbs up with the torch hand, which is alarming."],
    gardener: ["a gardener bot. it won't water anything past the old shrine, up the trail from the brachio meadow. it says the stone there hums.", "a gardener bot, watering the ferns. it waters pi a little, by accident, then apologizes.", "a gardener bot. it hums while it works: 'dns healthy, ferns hydrated.'"]
  };

  // cockatiels: they perch on landmarks and trees near the plaza, and fly between them in a pair
  var BIRD = {
    pal: { Y: "#f6d64a", O: "#f08a3a", G: "#9a9a9a", W: "#f2f2f2", K: "#1a1a1a", P: "#e9a3a3" },
    sit: ["....Y...", ".....Y..", "....YYY.", "....YKYP", "...GYOY.", ".GGGGGG.", "GGWWGGG.", "G..GGG..", "....P.P."],
    up:  ["G.......G.", ".GG...GG..", "..GGYYY...", "...GGYOKP.", "....GGG...", "...G......"],
    dn:  ["..........", "...GYYY...", "..GGGYOKP.", ".GG.GGG.G.", "G......GG.", "...G......"]
  };
  var perches = [];
  (function () {
    function top(id) { var s = STATIONS.filter(function (q) { return q.id === id; })[0]; return { x: s.x * T + 8, y: s.y * T + 17 - SPR[id].height, gy: s.y * T + 16 }; }
    ["sign", "mailbox", "tablet", "uplink"].forEach(function (id) { perches.push(top(id)); });
    props.filter(function (p) { return /^e:(oak|birch|ginkgo)/.test(p.kind) && Math.abs(p.tx - 36) < 9 && Math.abs(p.ty - 29) < 8; }).slice(0, 6).forEach(function (p) {
      perches.push({ x: p.tx * T + 8 + (p.ox || 0), y: p.ty * T + 16 - ENV[p.kind.slice(2)][3] + 4, gy: p.ty * T + 15 });
    });
  })();
  var birds = [0, 1].map(function (i) { var p = perches[i]; return { i: i, x: p.x + i * 4, y: p.y, gy: p.gy, z: 0, perch: i, fly: null, face: i ? -1 : 1, rest: 3 + i * 2 }; });
  function updateBirds(dt) {
    birds.forEach(function (b, i) {
      if (b.fly) {
        var f = b.fly; f.t += dt / f.dur;
        var u = Math.min(1, f.t), e = u * u * (3 - 2 * u);
        b.x = f.x0 + (f.x1 - f.x0) * e; b.y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * f.arc; b.gy = f.g0 + (f.g1 - f.g0) * e;
        b.face = f.x1 > f.x0 ? 1 : -1;
        if (u >= 1) { b.fly = null; b.rest = 4 + rand() * 9; }
        return;
      }
      b.rest -= dt;
      // walk right up to them and they scatter
      if (i === 0 && !room && (pi.vx || pi.vy) && Math.hypot(pi.x - b.x, pi.y - b.gy) < 16) { b.rest = 0; sfx("chirp", b.x, b.y); }
      // the leader picks a new perch; the other follows a moment later
      if (b.rest <= 0 && i === 0) {
        var n = (rand() * perches.length) | 0; if (n === b.perch) n = (n + 1) % perches.length;
        fly(b, n, 0); fly(birds[1], n, 0.5);
      }
    });
  }
  function fly(b, n, delay) {
    var p = perches[n], off = b.i ? 4 : 0;
    later(delay, function () {
      b.perch = n;
      b.fly = { t: 0, dur: 1.4 + Math.hypot(p.x - b.x, p.y - b.y) / 160, x0: b.x, y0: b.y, g0: b.gy, x1: p.x + off, y1: p.y, g1: p.gy, arc: 18 + rand() * 16 };
    });
  }
  function drawBird(b) {
    if (b.fly) {
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(Math.round(b.x) - 3, Math.round(b.gy), 6, 1);
      drawFrame(Math.floor(t * 10) % 2 ? BIRD.up : BIRD.dn, BIRD.pal, 10, b.x, b.y, b.face < 0);
    } else drawFrame(BIRD.sit, BIRD.pal, 8, b.x, b.y, b.face < 0);
  }

  // koi: about twenty, every one a different variety and size
  var KOI = [
    ["kohaku", "#f5f3ea", ["#e2462f"]], ["sanke", "#f5f3ea", ["#e2462f", "#161616"]], ["showa", "#161616", ["#e2462f", "#f5f3ea"]],
    ["tancho", "#f5f3ea", []], ["ogon", "#e9d9a0", []], ["platinum", "#e6ebef", []], ["yamabuki", "#f2b53a", []],
    ["chagoi", "#8a5a33", []], ["soragoi", "#8a98a8", []], ["karasu", "#1d1d1d", []], ["kigoi", "#f3dc4a", []],
    ["benigoi", "#d8341f", []], ["asagi", "#6e8fb3", ["#e2462f"]], ["shusui", "#8aa6c8", ["#e2462f"]],
    ["goshiki", "#3b3f58", ["#e2462f", "#f5f3ea"]], ["shiro utsuri", "#161616", ["#f5f3ea"]], ["orenji ogon", "#f28a2a", []],
    ["hi utsuri", "#161616", ["#e2462f"]], ["kujaku", "#c9c9b8", ["#e2462f", "#d9b44a"]], ["ochiba", "#9aa7b4", ["#b8834e"]]
  ];
  var koi = KOI.map(function (v, i) {
    var len = 5 + Math.floor(hash(i, 5) * 6), col = [];
    for (var j = 0; j < len; j++) col.push(v[2].length && hash(i * 9 + j, 7) < 0.45 ? v[2][(hash(j, i) * v[2].length) | 0] : v[1]);
    if (v[0] === "tancho") col[1] = "#e2462f";                 // the single red spot on the head
    var a0 = hash(i, 13) * 6.283, r0 = hash(13, i) * 0.6;
    return { x: (KP.x + Math.cos(a0) * r0 * KP.rx) * T, y: (KP.y + Math.sin(a0) * r0 * KP.ry) * T, a: a0 * 2, v: 11 - len * 0.8 + hash(i, 2) * 3, col: col, len: len, turn: 0 };
  });
  var ripples = [], food = null;
  // feeding time: pellets land on the water by the bank and every koi heads for them
  function feedKoi(bx, by) {
    foundSecret("koi");
    if (bx === undefined) { bx = (KP.x - KP.rx * 0.72) * T; by = KP.y * T; }
    food = { x: bx, y: by, t: 12, bits: [] };
    for (var i = 0; i < 14; i++) food.bits.push({ x: bx + (rand() - 0.5) * 18, y: by + (rand() - 0.5) * 8, life: 1 });
    ripples.push({ x: bx, y: by, r: 1, life: 1 });
  }
  function updateKoi(dt) {
    if (food) { food.t -= dt; if (food.t <= 0) food = null; }
    koi.forEach(function (f) {
      f.turn += (rand() - 0.5) * dt * 3; f.turn *= 0.97; f.a += f.turn * dt * 2;
      var boost = 1;
      if (food) {
        var want = Math.atan2(food.y - f.y, food.x - f.x), dd = Math.hypot(food.x - f.x, food.y - f.y);
        f.a += Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a)) * Math.min(1, dt * 3);
        boost = dd > 12 ? 2.2 : 0.4;
        if (dd < 8) food.bits.forEach(function (b) { if (b.life > 0 && Math.hypot(b.x - f.x, b.y - f.y) < 5) { b.life = 0; ripples.push({ x: b.x, y: b.y, r: 1, life: 0.7 }); } });
      }
      var nx = f.x + Math.cos(f.a) * f.v * boost * dt, ny = f.y + Math.sin(f.a) * f.v * boost * dt;
      if (pondF((nx + Math.cos(f.a) * f.len) / T, (ny + Math.sin(f.a) * f.len) / T) > 0.86) { f.a += 2.2 + rand(); return; }
      f.x = nx; f.y = ny;
      if (rand() < dt * 0.08) ripples.push({ x: f.x, y: f.y, r: 1, life: 1 });
    });
    ripples.forEach(function (r) { r.r += dt * 8; r.life -= dt * 0.8; });
    ripples = ripples.filter(function (r) { return r.life > 0; });
  }
  function drawKoi() {
    if (food) food.bits.forEach(function (b) { if (b.life > 0) { ctx.fillStyle = "#c9933a"; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); } });
    koi.forEach(function (f) {
      var cx = Math.cos(f.a), sy = Math.sin(f.a), wig = Math.sin(t * 8 + f.v * 3) * 0.8, n = f.len, mid = n / 2;
      ctx.globalAlpha = 0.93;
      for (var i = 0; i < n; i++) {
        var o = (mid - i) * 1.4, tail = i > n * 0.6 ? wig * (i - n * 0.6) * 0.8 : 0;
        var px = f.x + cx * o - sy * tail, py = f.y + sy * o + cx * tail;
        var sz = i === 0 || i === n - 1 ? 1 : n > 7 && i > 1 && i < n - 2 ? 3 : 2;
        ctx.fillStyle = f.col[i]; ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
      }
      var tx2 = f.x + cx * (mid - n) * 1.4, ty2 = f.y + sy * (mid - n) * 1.4;   // tail fin
      ctx.fillStyle = f.col[n - 1];
      ctx.fillRect(Math.round(tx2 - sy * 1.5), Math.round(ty2 + cx * 1.5), 1, 1); ctx.fillRect(Math.round(tx2 + sy * 1.5), Math.round(ty2 - cx * 1.5), 1, 1);
      ctx.fillStyle = f.col[2];                                           // pectoral fins
      ctx.fillRect(Math.round(f.x + cx * 1.5 - sy * 2), Math.round(f.y + sy * 1.5 + cx * 2), 1, 1);
      ctx.fillRect(Math.round(f.x + cx * 1.5 + sy * 2), Math.round(f.y + sy * 1.5 - cx * 2), 1, 1);
      ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 0.6;
    ripples.forEach(function (r) { ctx.globalAlpha = r.life * 0.6; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.55, 0, 0, 6.283); ctx.stroke(); });
    ctx.globalAlpha = 1;
  }

  /* ════════ the car ════════ */
  var CAR = {
    rows: ["..HHBBBBBHH..", ".BBBKKBKKBBB.", "TBBBKKBKKBBBT", "TBNBBMmRBBNBT", "TBBNBWUWBNBBT", ".BBNBUWUBNBB.", ".BBBBWUWBBBB.", ".BBBBBBBBBBB.",
           ".GGGGGGGGGGG.", "XGGGGGGGGGGGX", ".GGGGGGGGGGG.", ".BCCCCCCCCCB.", ".BCcCcCcCcCB.", ".BCCCCCCCCCB.", ".BCcCcCcCcCB.",
           "TGGGGGGGGGGGT", "TGGGGGGGGGGGT", "TBBBBBBBBBBBT", ".BBBBBBBBBBB.", ".KKKKKKKKKKK.", ".RRBBBBBBBRR.", "..EE.....EE.."],
    pal: { B: "#8b9096", N: "#a9aeb3", C: "#161616", c: "#2a2a2a", G: "#34465a", K: "#0b0b0b", E: "#cfd6dc", H: "#fff4c2", R: "#e0231f",
           U: "#1c69d4", W: "#f4f4f4", T: "#0e0e0e", X: "#8b9096", M: "#3fa9f5", m: "#1f3f9e" }
  };
  /* the car drives like a car, not a cursor. it has a drive and a reverse gear (tap s or down
     when it's stopped or rolling back and it drops into reverse, with a clunk and the reversing
     lights on), a torque curve that fades toward top speed, brakes that bite, and grip: the
     tyres kill sideways slide, until you pull the handbrake (shift) and the back steps out into
     a drift, laying rubber on the ground. hit something and it bumps off it. */
  var car = { x: 36 * T + 8, y: 62 * T + 8, a: Math.PI / 2, v: 0, vx: 0, vy: 0, driving: false, target: null, gear: "D", brake: false, skidT: 0 };
  var skids = [];
  function carClear(x, y, a) {
    var fx = Math.sin(a), fy = -Math.cos(a), rx = Math.cos(a), ry = Math.sin(a);
    return [[9, 4.5], [9, -4.5], [-9, 4.5], [-9, -4.5]].every(function (p) {
      return walkable(Math.floor((x + fx * p[0] + rx * p[1]) / T), Math.floor((y + fy * p[0] + ry * p[1]) / T));
    });
  }
  function updateCar(dt) {
    skids.forEach(function (m) { m.life -= dt / 14; }); if (skids.length && skids[0].life <= 0) skids = skids.filter(function (m) { return m.life > 0; });
    if (!car.driving) { car.vx *= 0.9; car.vy *= 0.9; car.v *= 0.9; car.brake = false; return; }
    var fwx = Math.sin(car.a), fwy = -Math.cos(car.a), rtx = Math.cos(car.a), rty = Math.sin(car.a);
    var vf = car.vx * fwx + car.vy * fwy, vl = car.vx * rtx + car.vy * rty;
    var thr = (keys.u ? 1 : 0) - (keys.d ? 1 : 0), steer = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), hand = !!keys.run;
    if (hand && car.driving && Math.hypot(car.vx, car.vy) > 60 && Math.abs(steer)) foundSecret("drift");
    if (car.target && !thr && !steer) {            // tap to drive: steer toward the tap, back out if it's behind you and close
      var dx = car.target.x - car.x, dy = car.target.y - car.y, dist = Math.hypot(dx, dy);
      if (dist < 12) car.target = null;
      else {
        var want = Math.atan2(dx, -dy), diff = Math.atan2(Math.sin(want - car.a), Math.cos(want - car.a));
        if (Math.abs(diff) > 2.1 && dist < 110) { thr = -1; steer = diff > 0 ? -1 : 1; }
        else { steer = Math.max(-1, Math.min(1, diff * 2)); thr = dist < 50 ? 0.5 : 1; }
      }
    }
    if (riftBusy()) { thr = 0; hand = true; }
    if (thr < 0 && vf < 6 && car.gear !== "R") { car.gear = "R"; sfx("gear"); bubble = { text: "R", t: 0.8 }; }
    if (thr > 0 && vf > -6 && car.gear !== "D") { car.gear = "D"; sfx("gear"); }
    var braking = false;
    if (car.gear === "D") { if (thr > 0) vf += 150 * thr * Math.max(0, 1 - Math.max(0, vf) / 165) * dt; else if (thr < 0) braking = true; }
    else { if (thr < 0) vf -= 95 * Math.max(0, 1 - Math.max(0, -vf) / 58) * dt; else if (thr > 0) braking = true; }
    if (braking) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 280 * dt);
    if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 70 * dt);
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (10 + Math.abs(vf) * 0.3) * dt);     // rolling resistance and air
    var sp = Math.abs(vf), steerK = Math.min(1, sp / 36) * (1 - Math.min(0.45, sp / 380));
    car.a += steer * dt * (hand ? 3.6 : 2.7) * steerK * (vf < 0 ? -1 : 1);
    var grip = hand && sp > 28 ? 2 : 11;
    vl -= vl * Math.min(1, grip * dt);
    fwx = Math.sin(car.a); fwy = -Math.cos(car.a); rtx = Math.cos(car.a); rty = Math.sin(car.a);
    car.vx = fwx * vf + rtx * vl; car.vy = fwy * vf + rty * vl; car.v = vf; car.brake = braking || hand;
    // rubber on the road when the tyres slide
    if (Math.abs(vl) > 20 || (braking && sp > 55)) {
      [-4, 4].forEach(function (o2) { skids.push({ x: car.x - fwx * 8 + rtx * o2, y: car.y - fwy * 8 + rty * o2, life: 1 }); });
      if (skids.length > 500) skids.splice(0, skids.length - 500);
      if ((car.skidT -= dt) <= 0) { car.skidT = 0.22; sfx("skid", car.x, car.y, { vol: Math.min(1, (Math.abs(vl) + sp * 0.3) / 60) }); }
    }
    // move in steps of at most a third of a tile, so no speed can carry it through a wall
    var nsub = Math.max(1, Math.ceil(Math.hypot(car.vx, car.vy) * dt / (T / 3))), sdt = dt / nsub;
    for (var sub = 0; sub < nsub; sub++) {
      var nx = car.x + car.vx * sdt, ny = car.y + car.vy * sdt;
      if (carClear(nx, ny, car.a)) { car.x = nx; car.y = ny; continue; }
      var hitV = Math.hypot(car.vx, car.vy);
      if (carClear(nx, car.y, car.a)) { car.x = nx; car.vy *= -0.3; }
      else if (carClear(car.x, ny, car.a)) { car.y = ny; car.vx *= -0.3; }
      else { car.vx *= -0.3; car.vy *= -0.3; }
      if (hitV > 35) { sfx("thud", car.x, car.y); quake = Math.max(quake, Math.min(3, hitV / 45)); }
      car.target = null; break;
    }
    pi.x = car.x; pi.y = car.y;
  }
  function drawSkids() {
    skids.forEach(function (m) { ctx.fillStyle = "rgba(20,16,14," + (0.4 * m.life).toFixed(3) + ")"; ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 2, 2); });
  }
  function drawCar() {
    var c = frameCanvas(CAR.rows, CAR.pal, 13), a = Math.round(car.a / (Math.PI / 8)) * (Math.PI / 8);   // 16 headings keep the pixels crisp
    ctx.save(); ctx.translate(Math.round(car.x), Math.round(car.y)); ctx.rotate(a);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(-7, -10, 15, 24);
    ctx.drawImage(c, -Math.floor(c.width / 2), -Math.floor(c.height / 2));
    ctx.restore();
    // headlights and taillights
    var fx = Math.sin(car.a), fy = -Math.cos(car.a);
    light(car.x + fx * 16, car.y + fy * 16, 22, "255,244,194", 0.55);
    light(car.x - fx * 11, car.y - fy * 11, car.brake ? 12 : 8, "255,59,59", car.brake ? 0.95 : car.driving ? 0.45 : 0.2);
    if (car.driving && car.gear === "R") light(car.x - fx * 12, car.y - fy * 12, 14, "240,244,255", 0.6);      // reversing lights
  }
  function toggleCar() {
    if (!car.driving && !can("vehicle")) return;
    if (!car.driving) { quake = Math.max(quake, 1); sfx("stomp", car.x, car.y, { vol: 0.35 }); car.driving = true; car.gear = "D"; pi.path = null; bubble = { text: TOUCH ? "tap to drive. e parks." : "w/s drive and reverse · shift drifts · e parks", t: 3 }; return; }
    // park: pi hops out beside the driver's door
    car.driving = false; car.target = null;
    var sx = Math.cos(car.a), sy = Math.sin(car.a);
    for (var k2 = 10; k2 <= 22; k2 += 4) for (var sd = -1; sd <= 1; sd += 2) {
      var px = car.x - sx * k2 * sd, py = car.y - sy * k2 * sd;
      if (walkable(Math.floor(px / T), Math.floor(py / T))) { pi.x = px; pi.y = py; return; }
    }
  }

  /* ════════ the helicopter ════════
     parked on the pad. e to board: the rotor spools up and it lifts off; arrows or
     wasd fly it anywhere (it clears the trees), e sets it down on open ground. */
  var HELI_ART = {
    rows: ["......ggg......", "....gGGGGGg....", "...gGGWGGGGg...", "...gGGGGGGGg...", "...BGGGGGGGB...", "..BBBBBBBBBBB..", "..BNBBBBBBBNB..",
           "S.BBYYYYYYYBB.S", "S.BBBBBBBBBBB.S", "S.BBBBMMMBBBB.S", "S.BBBBMOMBBBB.S", "S.BBBBMMMBBBB.S", "S.BBYYYYYYYBB.S", "S.BBBBBBBBBBB.S",
           "S..BBBBBBBBB..S", "S...BBBBBBB...S", ".....BBBBB.....", "......BBB......", "......BBB......", "......BYB......", "......BBB......",
           "......BBB......", "......BYB......", "......BBB......", "......BBB......", "....BBBBBBB....", ".....BBBBB.....", "......BBB......", "......BRB......"],
    pal: { B: "#4b5a36", N: "#6a7a50", G: "#1d3848", g: "#12242e", W: "#9fd8f0", Y: "#FFB000", M: "#2a2f24", O: "#6d7466", S: "#2b2b2b", R: "#e0231f" }
  };
  var heli = { x: HELI.x * T + 8, y: HELI.y * T + 8, a: 0, vx: 0, vy: 0, z: 0, rot: 0, spin: 0, state: "parked", target: null };
  function aboard() { return heli.state !== "parked"; }
  /* safe ground (C4-2): the walkable tiles pi can reach on foot from the spawn. the fenced paddocks
     and other walkable pockets cut off from it are not. worked out once, on first use; like the path
     cache it assumes collision never changes after the island is built (clear SAFE if that changes) */
  var SAFE = null;
  function safeTile(x, y) {
    if (!SAFE) {
      SAFE = new Uint8Array(MW * MH);
      var s0 = Math.floor(SPAWN.y / T) * MW + Math.floor(SPAWN.x / T), q = [s0]; SAFE[s0] = 1;
      while (q.length) {
        var i = q.pop(), x0 = i % MW, y0 = (i / MW) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x0 + d[0], ny = y0 + d[1]; if (walkable(nx, ny) && !SAFE[ny * MW + nx]) { SAFE[ny * MW + nx] = 1; q.push(ny * MW + nx); } });
      }
    }
    return x >= 0 && y >= 0 && x < MW && y < MH && SAFE[y * MW + x] === 1;
  }
  // where the helicopter may set down: safe ground, or the helipad. a later phase's landing zones go here
  function landTile(tx, ty) { return safeTile(tx, ty) || at(tx, ty) === PAD; }
  function canLand(x, y) {
    return [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].every(function (p) { return landTile(Math.floor((x + p[0]) / T), Math.floor((y + p[1]) / T)); });
  }
  // a spot pi can stand on: safe ground, and clear of everything at the four points move() tests
  function standSpot(x, y) { return safeTile(Math.floor(x / T), Math.floor(y / T)) && !solidPx(x - 4, y - 2) && !solidPx(x + 4, y - 2) && !solidPx(x - 4, y + 1) && !solidPx(x + 4, y + 1); }
  // where pi hops out after a landing: beside the doors on whichever side is clear, as before; failing
  // that, the nearest clear spot in rings round the helicopter; failing that, the spawn
  function hopSpot(hx, hy, a) {
    for (var dd = 14; dd <= 30; dd += 4) for (var sd = -1; sd <= 1; sd += 2) {
      var px = hx + Math.cos(a) * dd * sd, py = hy + Math.sin(a) * dd * sd;
      if (standSpot(px, py)) return { x: px, y: py };
    }
    for (var r = 8; r <= 96; r += 4) for (var n = 0; n < 16; n++) {
      var rx = hx + Math.cos(n / 16 * 6.283) * r, ry = hy + Math.sin(n / 16 * 6.283) * r;
      if (standSpot(rx, ry)) return { x: rx, y: ry };
    }
    return { x: SPAWN.x, y: SPAWN.y };
  }
  function toggleHeli() {
    if (heli.state === "parked" && !can("vehicle")) return;
    if (heli.state === "parked") {
      heli.state = "spool"; pi.path = null; pi.want = null; keys = {}; car.target = null;
      bubble = { text: "pi:~$ spinning up. arrows fly, e lands", t: 3 }; return;
    }
    if (heli.state === "flying") {
      if (!canLand(heli.x, heli.y)) { bubble = { text: "pi:~$ can't land here. find open ground", t: 2.2 }; return; }
      heli.state = "descend"; heli.target = null; return;
    }
  }
  function updateHeli(dt) {
    heli.rot += heli.spin * dt * 38;
    var fx = 0, fy = 0;
    if (heli.state === "parked") { heli.spin = Math.max(0, heli.spin - dt * 0.4); return; }
    if (heli.state === "spool") { heli.spin = Math.min(1, heli.spin + dt / 1.3); if (heli.spin >= 1) { heli.state = "lift"; foundSecret("heli"); } }
    else if (heli.state === "lift") { heli.z += 26 * dt; zoomTo = 0.72; if (heli.z >= 34) heli.state = "flying"; }
    else if (heli.state === "descend") {
      heli.z = Math.max(0, heli.z - 22 * dt); heli.vx *= 0.9; heli.vy *= 0.9;
      if (heli.z <= 0) {
        heli.state = "parked"; zoomTo = 1;
        // pi hops out on whichever side is clear (hopSpot)
        var hs = hopSpot(heli.x, heli.y, heli.a); pi.x = hs.x; pi.y = hs.y; bubble = { text: "pi:~$ touchdown.", t: 1.8 }; return;
      }
    }
    if (heli.state === "flying") {
      heli.z = 34 + Math.sin(t * 2) * 1.5;
      fx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); fy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
      if (heli.target && !fx && !fy) {
        var dx = heli.target.x - heli.x, dy = heli.target.y - heli.y, dist = Math.hypot(dx, dy);
        if (dist < 8) heli.target = null; else { fx = dx / dist; fy = dy / dist; if (dist < 40) { fx *= dist / 40; fy *= dist / 40; } }
      }
      if (riftBusy()) fx = fy = 0;
    }
    var len = Math.hypot(fx, fy); if (len > 1) { fx /= len; fy /= len; }
    heli.vx += fx * 190 * dt; heli.vy += fy * 190 * dt;
    heli.vx *= Math.pow(0.3, dt); heli.vy *= Math.pow(0.3, dt);
    var sp = Math.hypot(heli.vx, heli.vy); if (sp > 150) { heli.vx *= 150 / sp; heli.vy *= 150 / sp; }
    var hx = Math.max(T * 2, Math.min(MW * T - T * 2, heli.x + heli.vx * dt)), hy = Math.max(T * 2, Math.min(MH * T - T * 2, heli.y + heli.vy * dt));
    // coming down, the drift stops where the next bit would leave ground it may land on (C4-2): E is
    // checked where it's pressed, and the glide after it (up to about 19 px) must stay on such ground too
    if (heli.state === "descend" && !canLand(hx, hy)) { heli.vx = heli.vy = 0; hx = heli.x; hy = heli.y; }
    heli.x = hx; heli.y = hy;
    if (sp > 12) { var want = Math.atan2(heli.vx, -heli.vy), diff = Math.atan2(Math.sin(want - heli.a), Math.cos(want - heli.a)); heli.a += diff * Math.min(1, dt * 3); }
    pi.x = heli.x; pi.y = heli.y;
  }
  function drawHeliShadow() {
    var k2 = Math.max(0.35, 1 - heli.z / 70);
    ctx.fillStyle = "rgba(0,0,0," + (0.28 * k2).toFixed(3) + ")";
    ctx.beginPath(); ctx.ellipse(heli.x, heli.y + 2, 11 * k2, 14 * k2, heli.a, 0, 6.283); ctx.fill();
    if (heli.spin > 0.4) { ctx.strokeStyle = "rgba(0,0,0," + (0.08 * k2).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(heli.x, heli.y + 2, 26 * k2, 26 * k2 * 0.9, 0, 0, 6.283); ctx.stroke(); }
  }
  function drawHeli() {
    var c = frameCanvas(HELI_ART.rows, HELI_ART.pal, 15), a = Math.round(heli.a / (Math.PI / 8)) * (Math.PI / 8);
    var bx = Math.round(heli.x), by = Math.round(heli.y - heli.z);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
    ctx.drawImage(c, -Math.floor(c.width / 2), -11);
    // tail rotor, then the main rotor: blades when slow, a blurred disc when fast
    ctx.fillStyle = "rgba(30,30,30,.8)"; var tr = Math.sin(heli.rot * 1.7) * 3; ctx.fillRect(-1, 17 + tr * 0.3, 1, 1); ctx.fillRect(-4, 18, 8, 1);
    ctx.rotate(heli.rot);
    if (heli.spin > 0.6) { ctx.fillStyle = "rgba(20,24,20,.16)"; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = "rgba(24,24,24," + (heli.spin > 0.6 ? 0.45 : 0.95) + ")";
    ctx.fillRect(-25, -1, 50, 2); ctx.fillRect(-1, -25, 2, 50);
    ctx.fillStyle = "#2a2f24"; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
    // nav lights: red to port, green to starboard, a white strobe on the tail
    var cs = Math.cos(heli.a), sn = Math.sin(heli.a), blink = Math.floor(t * 2.5) % 2;
    ctx.fillStyle = "#ff3b3b"; ctx.fillRect(Math.round(bx - cs * 7), Math.round(by - sn * 7), 1, 1);
    ctx.fillStyle = "#4ADE80"; ctx.fillRect(Math.round(bx + cs * 7), Math.round(by + sn * 7), 1, 1);
    if (blink && heli.spin > 0.2) { ctx.fillStyle = "#ffffff"; ctx.fillRect(Math.round(bx - sn * 17), Math.round(by + cs * 17), 1, 1); light(bx - sn * 17, by + cs * 17, 10, "255,255,255", 0.6); }
    if (heli.z > 4) light(heli.x + sn * 18, heli.y - cs * 18, 30, "255,250,220", 0.55);    // a searchlight on the ground ahead
  }

  /* ════════ pterosaurs, the volcano, the fences, the gate ════════ */
  var pteros = [0, 1, 2].map(function (i) { return { a: i * 2.1, r: 70 + i * 22, sp: 0.35 + i * 0.07, alt: 44 + i * 10, x: 0, y: 0, face: 1 }; });
  var smoke = [], embers = [], smokeT = 0, quake = 0;
  function updateVolcano(dt) {
    pteros.forEach(function (p) {
      p.a += p.sp * dt;
      var nx = VX + Math.cos(p.a) * p.r * 1.3, ny = VY + 30 + Math.sin(p.a) * p.r * 0.7;
      p.face = nx > p.x ? 1 : -1; p.x = nx; p.y = ny;
    });
    smokeT -= dt;
    if (smokeT <= 0) { smokeT = 0.18; smoke.push({ x: VX + (rand() - 0.5) * 20, y: VY + 2, r: 3 + rand() * 3, life: 1, vx: 4 + rand() * 4 }); }
    smoke.forEach(function (s) { s.y -= 11 * dt; s.x += s.vx * dt; s.r += 3.2 * dt; s.life -= dt * 0.16; });
    smoke = smoke.filter(function (s) { return s.life > 0; });
    if (rand() < dt * 1.2) embers.push({ x: VX + (rand() - 0.5) * 30, y: VY, vx: (rand() - 0.5) * 30, vy: -30 - rand() * 30, life: 1 });
    embers.forEach(function (e) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 40 * dt; e.life -= dt * 0.9; });
    embers = embers.filter(function (e) { return e.life > 0; });
    quake = Math.max(0, quake - dt * 8);
  }
  var LAVA_T = ["#6a1606", "#b02a0a", "#e85414", "#ff9a30", "#ffe07a"];
  /* the volcano, rendered once like an old voxel-space terrain: each column of the sprite is
     filled front to back, so nearer slopes hide farther ones, and every sample is lit by its
     slope. the lava lake and the flows down the south face are remembered and animated live */
  var ROCKV = ["#17120f", "#221a15", "#30251d", "#403127", "#534033", "#6b5443", "#866c57"];
  var MOSS = ["#1d3a1f", "#27502a", "#356a34", "#4a8a44"];
  var FLOWS = [[1.25, 58, 2.6], [1.72, 76, 3.2], [2.2, 50, 2.2]];      // [angle, length, width] on the south face
  var volc = (function () {
    var R = VOLC.R, Hm = VOLC.H, sq = VOLC.sq, rc = VOLC.rc, floor = RIMH - 11;
    var depth = Math.ceil(R / sq), w = R * 2 + 4, h = Math.ceil(Hm) + depth * 2 + 8;
    var ox = VOLC.x - R - 2, oy = VOLC.y - depth - Math.ceil(Hm) - 4;
    function height(u, v) {
      var vv = v * sq, d = Math.sqrt(u * u + vv * vv);
      if (d >= R) return 0;
      if (d < rc) return Math.max(floor, RIMH - (rc - d) * 1.4);             // the bowl, down to the lava
      var a = Math.atan2(vv, u), k2 = Math.sin(Math.PI * Math.min(1, (d - rc) / (R - rc)));
      var gully = (Math.sin(a * 13 + d * 0.06) * 0.6 + Math.sin(a * 5 + 1.3) * 0.4) * 5 * k2;
      return Math.pow(1 - d / R, 1.25) * Hm + gully + (d < rc + 5 ? (rc + 5 - d) * 0.6 : 0);   // a raised lip round the crater
    }
    var c = mkCanvas(); c.width = w; c.height = h;
    var g = c.getContext("2d"), ybuf = [], lava = [], flows = [];
    for (var i = 0; i < w; i++) ybuf.push(h);
    for (var v = depth; v >= -depth; v -= 0.5) for (var sx = 0; sx < w; sx++) {
      var u = sx + ox - VOLC.x, vv = v * sq, d = Math.sqrt(u * u + vv * vv);
      if (d >= R) continue;
      var H = height(u, v), sy = Math.round(VOLC.y + v - H - oy), gy = Math.round(VOLC.y + v - oy) + 1;
      if (sy >= ybuf[sx]) continue;
      var n = Math.max(1, Math.min(ybuf[sx], gy) - sy); ybuf[sx] = sy;
      if (d < rc && H <= floor + 0.5) { g.fillStyle = "#6a1606"; g.fillRect(sx, sy, 1, n); lava.push([sx, sy, n]); continue; }
      var a = Math.atan2(vv, u), fl = null;
      FLOWS.forEach(function (f) { var q = (d - rc) / f[1]; if (!fl && q > -0.1 && q < 1 && Math.abs(a - f[0] + Math.sin(d * 0.08) * 0.05) * d < f[2] * (1 - q * 0.5)) fl = q; });
      if (fl !== null) { g.fillStyle = "#4a1c0c"; g.fillRect(sx, sy, 1, n); flows.push([sx, sy, n, fl]); continue; }
      // light from the upper left and a little in front
      var dHu = height(u + 1, v) - height(u - 1, v), dHv = height(u, v + 0.6) - height(u, v - 0.6);
      var nx = -dHu / 2, ny = -dHv / 1.2, nz = 1, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      var lit = (nx * -0.62 + ny * 0.3 + nz * 0.72) / nl;
      var sh = 0.1 + lit * 0.72 + (H / Hm) * 0.12 + ((Math.floor(H / 6) % 3) === 0 ? -0.07 : 0) + (hash(sx, sy) - 0.5) * 0.12;
      if (d < rc) sh = 0.18 + (H - floor) / 20 * 0.25;                          // the crater's inner wall
      var col = tone(sh, ROCKV, sx, sy);
      if (d > R * 0.86 && hash(sx >> 1, sy >> 1) < (d / R - 0.86) * 6) col = tone(sh + 0.1, MOSS, sx, sy);   // jungle creeps up the foot
      if (d > rc && d < rc + 3) col = tone(sh + 0.25, ROCKV, sx, sy);                                    // a bright lip on the rim
      g.fillStyle = col; g.fillRect(sx, sy, 1, n);
    }
    return { canvas: outline(c, "rgba(12,9,7,.9)"), ox: ox - 1, oy: oy - 1, lava: lava, flows: flows };
  })();
  var VX = VOLC.x, VY = VOLC.y - RIMH + 2;
  function drawVolcano() {
    var cv0 = volc.canvas, ox = volc.ox + 1, oy = volc.oy + 1;
    ctx.drawImage(skin(cv0), volc.ox, volc.oy);
    var i, p, v;
    for (i = 0; i < volc.lava.length; i++) {                   // the lava lake churns; crust drifts across it
      p = volc.lava[i];
      v = 0.55 + 0.28 * Math.sin(t * 1.3 + p[0] * 0.23 + Math.sin(p[1] * 0.3 + t * 0.7) * 2) + 0.16 * Math.sin(t * 0.8 - p[1] * 0.4 + p[0] * 0.05);
      if (hash(((p[0] + t * 5) / 5) | 0, p[1] >> 1) < 0.14) v -= 0.45;
      ctx.fillStyle = tone(v, LAVA_T, p[0], p[1]); ctx.fillRect(ox + p[0], oy + p[1], 1, p[2]);
    }
    for (i = 0; i < volc.flows.length; i++) {                  // pulses of heat run down each flow and cool toward the foot
      p = volc.flows[i];
      v = 0.62 - p[3] * 0.55 + 0.22 * Math.sin(p[3] * 14 - t * 2.4) + (hash(p[0], p[1]) - 0.5) * 0.15;
      ctx.fillStyle = tone(v, LAVA_T, p[0], p[1]); ctx.fillRect(ox + p[0], oy + p[1], 1, p[2]);
    }
    light(VX, VY, 80, "255,110,40", 0.95);
    light(VX - 10, VY + 40, 50, "255,90,30", 0.45);
  }
  function drawSmoke() {
    smoke.forEach(function (s) {
      ctx.fillStyle = "rgba(" + (sky.dark > 0.5 ? "70,60,60" : "120,112,108") + "," + (0.32 * s.life).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    });
    embers.forEach(function (e) { ctx.fillStyle = "rgba(255," + (140 + (e.life * 100 | 0)) + ",60," + e.life.toFixed(3) + ")"; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); });
  }
  // pterosaurs fly the way big soaring birds do: three deep wingbeats (the body lifts a little
  // on each downstroke), then a long glide, sinking slowly, wings swaying; now and then a blink
  var BEAT = 0.62, BEATS = 3, PCYC = 6.4;
  function pteroFlight(i) {
    var c = (t + i * 2.3) % PCYC, flapT = BEAT * BEATS, f, lift;
    if (c < flapT) {
      var ph = (c / BEAT) % 1;
      f = dinoFrame("ptero", "fly", (Math.floor(ph * 12) + 2) % 12);
      lift = Math.sin(ph * 6.283) * 1.6 - (c / flapT) * 7;                  // climbing through the beats
    } else {
      var g = (c - flapT) / (PCYC - flapT);
      f = dinoFrame("ptero", hash(Math.floor(t * 4) + i * 7, 3) < 0.03 ? "blink" : "glide", Math.floor(t * 1.5 + i) % 4);
      lift = -7 + g * g * (3 - 2 * g) * 7;                                    // then sinking back down the thermal
    }
    return { f: f, lift: lift };
  }
  function drawPteros() {
    pteros.forEach(function (p, i) {
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.alt, 20, 5, 0, 0, 6.283); ctx.fill();
      var pf = pteroFlight(i); drawArt(pf.f, p.x, Math.round(p.y + 30 + pf.lift), p.face < 0);
    });
    if (ptero.on) {
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(ptero.x, ptero.y + 60, 20, 5, 0, 0, 6.283); ctx.fill();
      var pf2 = pteroFlight(7); drawArt(pf2.f, ptero.x, Math.round(ptero.y + 30 + pf2.lift), ptero.vx < 0);
    }
  }
  // fence posts every tile, three wires to the next post, a warning sign now and then
  function drawFence(tx, ty) {
    var X = tx * T + 8, Y = ty * T + 13, right = fence[k(tx + 1, ty)], down = fence[k(tx, ty + 1)], night = sky.dark;
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(X - 2, Y, 5, 2);
    ctx.fillStyle = "#4e5358"; ctx.fillRect(X - 1, Y - 16, 3, 17); ctx.fillStyle = "#7d848a"; ctx.fillRect(X - 1, Y - 16, 1, 17);
    ctx.fillStyle = "#e0b83a"; ctx.fillRect(X - 1, Y - 17, 3, 1);
    var wire = night > 0.4 ? "rgba(140,230,255,.75)" : "#8a9197";
    if (right) { ctx.fillStyle = wire; [15, 10, 5].forEach(function (h) { ctx.fillRect(X + 2, Y - h, T - 3, 1); }); }
    if (down) { ctx.fillStyle = wire; ctx.fillRect(X, Y + 1, 1, T - 1); }
    if (hash(tx, ty * 3) < 0.12 && right) {
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(X + 4, Y - 13, 7, 7); ctx.fillStyle = "#f2c230"; ctx.fillRect(X + 5, Y - 12, 5, 5);
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(X + 7, Y - 12, 1, 2); ctx.fillRect(X + 6, Y - 10, 2, 1); ctx.fillRect(X + 7, Y - 9, 1, 2);
    }
    if (right && hash(tx * 5 + Math.floor(t * 3), ty) < 0.02) { ctx.fillStyle = "#e8fbff"; ctx.fillRect(X + 2 + ((hash(tx, Math.floor(t * 9)) * 12) | 0), Y - 10, 2, 1); light(X + 8, Y - 10, 8, "180,240,255", 0.8); }
  }
  // sandbag walls round the outpost: courses of bags, each lit on top and shadowed underneath
  function drawWall(tx, ty) {
    var X = tx * T, Y = ty * T + 14;
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(X, Y, T, 2);
    for (var row = 0; row < 3; row++) for (var i = 0; i < 4; i++) {
      var bx = X + i * 6 - (row % 2) * 3, by = Y - 4 - row * 4;
      if (bx + 6 <= X || bx >= X + T) continue;
      var cx0 = Math.max(bx, X), cw = Math.min(bx + 6, X + T) - cx0;
      ctx.fillStyle = "#6e6040"; ctx.fillRect(cx0, by, cw, 4); ctx.fillStyle = "#a8966a"; ctx.fillRect(cx0, by, cw, 3); ctx.fillStyle = "#c8b688"; ctx.fillRect(cx0 + (bx < X ? 0 : 1), by, Math.max(0, cw - 2), 1);
    }
  }
  function drawGate() {
    var s = SPR.gate, bx = GATE.x * T + 8, by = GATE.y * T + 14, x0 = Math.round(bx - s.width / 2), y0 = by - s.height + 2;
    shadow(bx - 38, by, 14); shadow(bx + 38, by, 14);
    ctx.drawImage(skin(s), x0, y0);
    [x0 + 12, x0 + 80].forEach(function (fx, i) {           // the torches flicker
      for (var j = 0; j < 7; j++) {
        var fl = Math.sin(t * 11 + j * 1.7 + i * 3), w = Math.max(1, 5 - j * 0.7 + fl);
        ctx.fillStyle = j < 2 ? "#ffe07a" : j < 4 ? "#ff9a30" : "#e85414";
        ctx.fillRect(Math.round(fx - w / 2 + fl * 0.5), y0 + 4 - j, Math.round(w), 1);
      }
      light(fx, y0 + 2, 34, "255,170,80", 0.95);
    });
  }

  /* ════════ the ctf (Phase 9, E1) ════════
     six flags, one per slot. one engine for every terminal that takes flags: the cave terminal
     now, others later. each flag is data: a stable id (ctf-..., never renamed or reused), its
     slot (1 to 6), when it is open, a sha-256 of its answer, hints and a write-up. no answer is
     stored: a guess is normalized, hashed with the flag's id and compared. that keeps answers out
     of plain sight in the source, nothing more; this is a game in the browser, so anyone reading
     the code can still work everything out. a solve is save.flags[id] = true (save v2 as it is),
     so a tab still running older code keeps it. two flags so far: fence logs and radio static (E1-C)
       open, hints[].when: null, or "tool:x", "flag:x", "secret:x", "log:x", "island:x", or a
       list of those that must all hold. a later tool or region opens things through these */
  var CTF_SLOTS = 6, CTF_SCHEME = "pi-ctf/1/", CTF_LEN = 64;
  var CTF_SHIPPED = [
    { id: "ctf-fence-logs", slot: 1, name: "fence logs", open: null, h: "d8bd6c4774846c50220ff0a609f84d053eacb617864f6224481ecd6503ac3b6c",     // fence.log, in the cave terminal
      hints: [{ t: "match each fence test to who was logged in at that moment." }],
      writeup: ["logs say who did what, and when.", "the loudest source only failed to log in.", "a quieter source had a session around", "every unscheduled fence test.", "one line proves little. defenders", "correlate time and source, then act."] },
    { id: "ctf-radio-static", slot: 2, name: "radio static", open: null, h: "6956553b0f475a33f2bd9985ec2b53aabd28472b981bdda1329c42af19953d02",   // the bunker radio; decoded with echo ... | base64 -d
      hints: [{ t: "the bunker radio shows mixed-case letters and digits, a multiple of 4 long: a standard way to write bytes as text. this terminal has the usual tool." }],
      writeup: ["base64 writes bytes as text, using", "A-Z, a-z, 0-9, + and / (= pads it).", "it is encoding, not encryption: no", "key, so anyone can turn it back.", "spotting base64, hex and url encoding", "is an everyday step in analysis."] }
  ];
  var CTF_ID = /^ctf-[a-z0-9][a-z0-9-]{0,27}$/, CTF_COND = /^(tool|flag|secret|log|island):[a-z0-9][a-z0-9-]{0,31}$/;
  var CTF = [], ctfDone = 0;                                       // ctfDone: times all six were completed this visit
  function ctfCondOk(c) { return c == null || (typeof c === "string" && CTF_COND.test(c)) || (Array.isArray(c) && c.every(function (x) { return typeof x === "string" && CTF_COND.test(x); })); }
  function ctfCond(c) {
    if (c == null) return true;
    if (Array.isArray(c)) return c.every(ctfCond);
    if (typeof c !== "string" || !CTF_COND.test(c)) return false;
    var kind = c.slice(0, c.indexOf(":")), id = c.slice(c.indexOf(":") + 1);
    return kind === "tool" ? save.tools[id] === true : kind === "flag" ? save.flags[id] === true : kind === "secret" ? save.secrets.indexOf(id) >= 0
      : kind === "log" ? !!found[id] : save.island === id;
  }
  // what's wrong with a table of flags: [] when it can be used
  function ctfProblems(list) {
    var bad = [], ids = {}, slots = {}, hs = {};
    if (!Array.isArray(list)) return ["not a list"];
    list.forEach(function (f, i) {
      var at0 = "flag " + i + (f && typeof f.id === "string" ? " (" + f.id + ")" : "");
      if (!isObj(f)) { bad.push(at0 + ": not an object"); return; }
      if (typeof f.id !== "string" || !CTF_ID.test(f.id)) bad.push(at0 + ": id must be ctf- and a short lowercase name");
      else if (ids[f.id]) bad.push(at0 + ": duplicate id"); else ids[f.id] = 1;
      if (typeof f.slot !== "number" || f.slot !== Math.floor(f.slot) || f.slot < 1 || f.slot > CTF_SLOTS) bad.push(at0 + ": slot must be a whole number from 1 to " + CTF_SLOTS);
      else if (slots[f.slot]) bad.push(at0 + ": duplicate slot " + f.slot); else slots[f.slot] = 1;
      if (typeof f.h !== "string" || !/^[0-9a-f]{64}$/.test(f.h)) bad.push(at0 + ": h must be 64 lowercase hex characters (sha-256)");
      else if (hs[f.h]) bad.push(at0 + ": duplicate hash"); else hs[f.h] = 1;
      if (typeof f.name !== "string" || !f.name) bad.push(at0 + ": needs a name");
      if (!ctfCondOk(f.open)) bad.push(at0 + ": bad open condition");
      if (!Array.isArray(f.hints) || !f.hints.every(function (q) { return isObj(q) && typeof q.t === "string" && ctfCondOk(q.when); })) bad.push(at0 + ": hints must be a list of { t, when }");
      if (!Array.isArray(f.writeup) || !f.writeup.every(function (l) { return typeof l === "string"; })) bad.push(at0 + ": writeup must be a list of lines");
    });
    return bad;
  }
  var ctfShippedBad = ctfProblems(CTF_SHIPPED);
  function ctfUse(list) { CTF = ctfProblems(list).length ? [] : JSON.parse(JSON.stringify(list)); }
  ctfUse(CTF_SHIPPED);                                             // a broken table ships no flags rather than breaking the island
  function ctfById(id) { return CTF.filter(function (f) { return f.id === id; })[0] || null; }
  function ctfSolved(f) { return save.flags[f.id] === true; }
  function ctfCount() { return CTF.filter(ctfSolved).length; }
  // a guess as the hash sees it, or null when it can't be an answer (refused before hashing):
  // NFKC, trimmed, wrapping quotes or backticks off, flag{...} optional, lowercase, every run of
  // spaces, hyphens and underscores one underscore, none at the ends; then a-z, 0-9, _ and . only
  function ctfNorm(s) {
    if (typeof s !== "string" || s.length > 256) return null;
    if (s.normalize) s = s.normalize("NFKC");
    s = s.trim().replace(/^["'`‘’“”]+|["'`‘’“”]+$/g, "").trim();
    var w = /^flag\{([\s\S]*)\}$/i.exec(s); if (w) s = w[1];
    s = s.toLowerCase().replace(/[\s_-]+/g, "_").replace(/^_+|_+$/g, "");
    return s && s.length <= CTF_LEN && /^[a-z0-9_.]+$/.test(s) ? s : null;
  }
  // web crypto, looked up each time (an http page on a LAN address has none)
  function ctfCrypto() { var c = window.crypto; return c && c.subtle && typeof c.subtle.digest === "function" && typeof TextEncoder !== "undefined" ? c.subtle : null; }
  function ctfHash(id, norm) {
    var sub = ctfCrypto(); if (!sub) return Promise.reject(new Error("no web crypto"));
    return Promise.resolve().then(function () { return sub.digest("SHA-256", new TextEncoder().encode(CTF_SCHEME + id + "/" + norm)); }).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    });
  }
  /* check a guess against every open flag. it never writes anything; it resolves (never rejects)
     with a status: "match" (id), "already" (id, solved before), "none", "invalid" (refused before
     hashing), "no-crypto" or "error" (the hashing failed). an offline flag can't match */
  function ctfCheck(text) {
    var n = ctfNorm(text);
    if (n === null) return Promise.resolve({ status: "invalid" });
    if (!ctfCrypto()) return Promise.resolve({ status: "no-crypto" });
    var live = CTF.filter(function (f) { return ctfCond(f.open); });
    return Promise.all(live.map(function (f) { return ctfHash(f.id, n); })).then(function (hs) {
      for (var i = 0; i < live.length; i++) if (hs[i] === live[i].h) return { status: ctfSolved(live[i]) ? "already" : "match", id: live[i].id };
      return { status: "none" };
    }, function () { return { status: "error" }; });
  }
  /* mark a flag solved: one save write, only the first time. complete is true only on the solve
     that makes it six of six */
  function ctfSolve(id) {
    var f = ctfById(id);
    if (!f || !ctfCond(f.open)) return { status: "none" };
    if (ctfSolved(f)) return { status: "already", id: id, count: ctfCount(), complete: false };
    if (!(id in save.flags) && Object.keys(save.flags).length >= SAVE_MAX) return { status: "full" };   // it would be dropped on the next load
    var before = ctfCount();
    save.flags[id] = true; writeSave();
    var n = ctfCount(), complete = before < CTF_SLOTS && n === CTF_SLOTS;
    if (complete) ctfDone++;
    return { status: "match", id: id, count: n, complete: complete };
  }
  // every slot, as a board would show it: offline, open or solved, the hints unlocked, the write-up
  function ctfBoard() {
    var out = [];
    for (var s = 1; s <= CTF_SLOTS; s++) {
      var f = CTF.filter(function (q) { return q.slot === s; })[0];
      if (!f) { out.push({ slot: s, id: null, state: "offline", hints: [0, 0], writeup: false }); continue; }
      var solved = ctfSolved(f);
      out.push({ slot: s, id: f.id, name: f.name, state: solved ? "solved" : ctfCond(f.open) ? "open" : "offline",
                 hints: [f.hints.filter(function (q) { return ctfCond(q.when); }).length, f.hints.length], writeup: solved });
    }
    return out;
  }

  /* ════════ the cave terminal ════════
     a shell that runs the park, left logged in inside the volcano. `help` lists the
     everyday commands. the hidden files explain the rest. */
  var term = root.querySelector(".w-term"), tOut = term.querySelector(".w-term-out"), tIn = term.querySelector(".w-term-in"), tPs = term.querySelector(".w-term-ps");
  var termOpen = false, tHist = [], tHi = 0, sudoTries = -1, uptime0 = Date.now();
  tOut.tabIndex = 0;                                    // the log scrolls once it fills, so the keyboard has to reach it too
  var FILES = {
    "readme.txt": "welcome to pi's island.\nthis terminal runs the park: fences, feeding, the helipad, the clock.\nmost of it is harmless. type help.",
    "paddocks.log": "[ ok ] t-rex paddock ...... fence live, 10,000 V\n[ ok ] raptor pen ......... 3 of 3 raptors accounted for\n[warn] raptor pen ......... fence tested at 03:12, 03:47, 04:20. they're learning.\n[ ok ] herd meadow ........ 2 nests, eggs warm",
    "fence.log": "# fence controller, raptor pen\n# this controller is 192.0.2.10\n# 3 fence tests tonight, none scheduled\n02:58:10 198.51.100.8  login fail\n03:05:44 198.51.100.8  login fail\n03:11:58 203.0.113.47  login ok\n03:12:04 192.0.2.10    fence test\n03:12:30 203.0.113.47  logout\n03:28:16 198.51.100.8  login fail\n03:46:51 203.0.113.47  login ok\n03:47:02 192.0.2.10    fence test\n03:47:40 203.0.113.47  logout\n03:51:40 192.0.2.11    login ok\n03:52:05 192.0.2.11    logout\n04:19:57 203.0.113.47  login ok\n04:20:06 192.0.2.10    fence test\n04:20:31 203.0.113.47  logout\n04:33:58 198.51.100.8  login fail",
    "koi.csv": null,
    "orbs.txt": "the orbs, as last recorded:\n  eclipse   default. current champion.\n  bone\n  halo\n  fog\n  void",
    ".bash_history": "ls -a\ncat .rift\nsudo ./rift --wake\n# forgot the password again.\n# it's the default orb. check orbs.txt\ncat .middlepath\n./evolve pi",
    ".middlepath": "middle path.\n\na mascot Ammaar and his friends drew years ago: a small kaiju,\nspikes down its back, sitting on a line and blowing bubbles at the sky.\nthere's a note in pi's source that just says: 'one day.'\n\nrun ./evolve pi to find out what that means. run middlepath to see the drawing.",
    ".rift": "#!/bin/sh\n# the orbs sleep under the island.\n# waking them starts a fight for control of the site.\n# the winner runs every orb on the page until you close the tab.\n#\n# usage: sudo ./rift --wake"
  };
  function koiCsv() { return "variety,length\n" + KOI.map(function (v, i) { return v[0] + "," + ["small", "small", "medium", "medium", "large", "large"][koi[i].len - 5]; }).join("\n"); }
  function print(text, cls) {
    if (cls === "err") sfx("err");
    var p = document.createElement("div"); p.className = "w-term-line" + (cls ? " " + cls : ""); p.textContent = text;
    tOut.appendChild(p); tOut.scrollTop = tOut.scrollHeight;
  }
  function openTerm() {
    if (!can("terminal")) return;
    termOpen = true; keys = {}; pi.path = null; pi.want = null; tSession++; tWait = null; tMiss = 0;
    term.hidden = false; tOut.innerHTML = ""; sudoTries = -1; setPrompt();
    print("pi-sh 1.0 on tty1, cave terminal (volcano, level 1)", "dim");
    print("last login: a long time ago, from the helipad", "dim");
    print("type help. esc leaves.", "dim");
    print("ctf board available · type ctf", "dim");
    tIn.value = ""; setTimeout(function () { tIn.focus({ preventScroll: true }); }, 30);
  }
  function closeTerm() { termOpen = false; tSession++; tWait = null; term.hidden = true; tIn.type = "text"; cv.focus({ preventScroll: true }); }
  /* a command that has to wait (the ctf's hashing is a promise) goes through termWait. one wait
     at a time: while it lasts the terminal runs no new line, and what's typed stays in the box.
     each open and close of the terminal is a new session; a wait that settles after its session
     ended prints nothing and does nothing (so closing the terminal mid-check saves nothing). a
     watchdog ends a wait that never settles, so the terminal can't stay stuck */
  var tSession = 0, tWait = null, TERM_WAIT_MS = 4000, tMiss = 0;
  function termWait(p, done) {
    var me = { s: tSession }; tWait = me;
    var dog = new Promise(function (ok, no) { me.dog = setTimeout(function () { no(new Error("timed out")); }, TERM_WAIT_MS); });
    Promise.race([p, dog]).then(function (v) { return { v: v }; }, function (e) { return { err: e || new Error("failed") }; }).then(function (r) {
      clearTimeout(me.dog);
      if (tWait === me) tWait = null;
      if (me.s !== tSession || !termOpen) return;               // that terminal session is gone
      done(r.err || null, r.v);
    });
  }
  function setPrompt() { tPs.textContent = sudoTries >= 0 ? "[sudo] password for pi:" : "pi@island:~$"; tIn.type = sudoTries >= 0 ? "password" : "text"; }
  var PLACES = { rack: 1, desk: 1, uplink: 1, tower: 1, lighthouse: 1, macbook: 1, tablet: 1, mailbox: 1, sign: 1, boat: 1, dock: "boat", pond: [69, 45], helipad: [59, 62], heli: [59, 62], gate: [48, 35], plaza: [46, 60], car: [37, 61], paddock: [41, 51], raptors: [64, 40], volcano: [48, 25], outpost: [26, 61], shrine: [21, 23], clearing: [48, 43] };
  function goto(name) {
    var p = PLACES[name], tx, ty;
    if (!p) return false;
    if (name === "heli" || name === "helipad") p = [Math.round(heli.x / T) + 2, Math.round(heli.y / T)];     // wherever it was last set down
    if (p === 1 || typeof p === "string") {
      var s = STATIONS.filter(function (q) { return q.id === (p === 1 ? name : p); })[0];
      if (s.room) { if (!room || room.id !== s.room) { if (room) exitRoom(); enterRoom(s.room, [s.x, s.y + 1]); } else { pi.x = s.x * T + 8; pi.y = (s.y + 1) * T + 10; } return true; }
      tx = s.x; ty = s.y + 1;
    }
    if (room) exitRoom();
    if (tx === undefined) { tx = p[0]; ty = p[1]; }
    var spot = null;
    for (var r2 = 0; !spot && r2 < 4; r2++) for (var j = -r2; j <= r2 && !spot; j++) for (var i = -r2; i <= r2 && !spot; i++) if (walkable(tx + i, ty + j)) spot = [tx + i, ty + j];
    if (!spot) return false;
    if (car.driving) toggleCar();
    pi.x = spot[0] * T + 8; pi.y = spot[1] * T + 10; pi.path = null; camF.x = null;
    return true;
  }
  var CMDS = {
    help: function () {
      ["commands:", "  help              this list", "  ls [-a]           list files", "  cat <file>        print a file", "  whoami            who's logged in", "  neofetch          island info",
       "  census            who lives here", "  found             landmarks found so far", "  secrets           the island's secrets, found and not", "  ctf | flags       the ctf board: six flags to capture", "  submit <answer>   check a flag", "  hint <n>          hints for flag n", "  writeup <n>       how flag n works, once it's captured", "  goto <place>      go somewhere (goto with no place lists them)", "  time [hour|reset] the island clock, synced to Ammaar's timezone",
       "  feed koi          ring the dinner bell at the pond", "  sound [on|off]    music and sound effects", "  fly | drive       go to the helicopter or the car", "  history           what you've typed", "  clear             clear the screen", "  exit              log out"].forEach(function (l) { print(l); });
    },
    ls: function (args) {
      var dir = args.filter(function (a) { return a[0] !== "-"; })[0];
      if (dir && /^landmarks/.test(dir)) { print(STATIONS.filter(function (s) { return s.found; }).map(function (s) { return s.id + (found[s.id] ? "*" : ""); }).join("   ")); print("(* = found)", "dim"); return; }
      if (dir && /^paddocks/.test(dir)) { print(PADDOCKS.map(function (q) { return q.name.replace(/ /g, "-"); }).join("   ")); return; }
      if (dir) { print("ls: " + dir + ": no such directory"); return; }
      var all = /-\w*a/.test(args.join(" "));
      print(Object.keys(FILES).filter(function (f) { return all || f[0] !== "."; }).concat(all ? ["rift*"] : []).join("   "));
      if (!all) print("landmarks/   paddocks/", "dim");
    },
    cat: function (args) {
      var f = (args[0] || "").replace(/^\.\/(?=\w)/, "").replace(/^~\//, "");
      if (!f) { print("cat: which file? try ls"); return; }
      if (f === "koi.csv") { koiCsv().split("\n").forEach(function (l) { print(l); }); return; }
      if (f === "rift" || f === "./rift") f = ".rift";
      if (FILES[f] === undefined) { print("cat: " + args[0] + ": no such file"); return; }
      FILES[f].split("\n").forEach(function (l) { print(l); });
      if (f.charAt(0) === ".") foundSecret("dotfiles");
    },
    whoami: function () { print("pi. a small white dino, Ammaar's mascot. you hatched here."); },
    neofetch: function () {
      var up = Math.floor((Date.now() - uptime0) / 1000), n = nyNow();
      var art = ["    ▄███▄  ", "    █▀█▀█  ", "   ▄█████  ", "  ▀██████▀ ", "    ▀▀ ▀▀  "];
      var info = ["pi@island", "---------", "os: pi's island (cretaceous edition)", "host: Ellicott City, MD (ET)", "uptime: " + Math.floor(up / 60) + "m " + (up % 60) + "s",
                  "residents: " + critters.filter(function (c) { return DINOS[c.kind].art; }).length + " dinos, 3 bots, 2 cats, 2 cockatiels, 20 koi", "landmarks: " + countFound() + "/" + TOTAL + " found", "volcano: warm", "core: " + (rift && rift.winner ? rift.winner : "asleep")];
      info.forEach(function (l, i) { print((art[i] || "           ") + " " + l, i === 0 ? "hi" : ""); });
    },
    census: function () {
      var c = {}; critters.forEach(function (q) { c[q.kind] = (c[q.kind] || 0) + 1; });
      ["  2  brachiosaurus ...... the west meadow, by the river", "  1  t-rex .............. the paddock (fenced, 10,000 V)", "  3  utahraptors ........ the pen (fenced, and they know it)",
       "  1  stegosaurus, 2 triceratops, 1 ankylosaurus ... the herd plain, down by the harbour", "  2  parasaurolophus .... east, by the lighthouse road", "  3  babies ............. near the nests", "  3  pterosaurs ......... circling the volcano",
       "  1  rex ................ chrome edition, wanders wherever", "  2  himalayan cats ..... jasmine and prince, the garden", "  2  cockatiels ......... usually on the signpost", " 20  koi ................ the pond (see koi.csv)", "  3  bots ............... on the roads"].forEach(function (l) { print(l); });
    },
    found: function () { STATIONS.filter(function (s) { return s.found; }).forEach(function (s) { print((found[s.id] ? "  [x] " : "  [ ] ") + s.name); }); print(countFound() + "/" + TOTAL + " found", "dim"); },
    "goto": function (args) {
      if (!args[0]) { print("places: " + Object.keys(PLACES).join(" ")); return; }
      if (goto(args[0].toLowerCase())) { print("walking you to " + args[0] + "..."); setTimeout(closeTerm, 350); } else print("goto: no place called " + args[0]);
    },
    time: function (args) {
      if (args[0] === "reset") { hourOverride = null; readSky(); print("clock synced to America/New_York again."); return; }
      if (args[0] !== undefined) { var h = parseFloat(args[0]); if (isNaN(h) || h < 0 || h >= 24) { print("time: give an hour from 0 to 23"); return; } hourOverride = h; readSky(); print("island clock set to " + h + ":00 for this visit. time reset puts it back."); return; }
      var n = nyNow(), st = sunTimes(n.d, n.off);
      function hm(x) { var hh = Math.floor(x), mm = Math.floor((x - hh) * 60); return ((hh + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + (hh >= 12 ? " pm" : " am"); }
      print("island time " + hm(n.h) + " ET" + (hourOverride !== null ? " (set by hand)" : "") + ". sunrise " + hm(st.rise) + ", sunset " + hm(st.set) + ".");
    },
    feed: function (args) {
      if ((args[0] || "koi") !== "koi") { print(args[0] === "raptors" ? "absolutely not." : "feed: only the koi are on the schedule."); return; }
      feedKoi(); print("dinner bell rung. the koi are heading for the west bank of the pond.");
    },
    fly: function () { goto("heli"); print("walking you to the helipad..."); setTimeout(closeTerm, 350); },
    drive: function () { goto("car"); print("walking you to the car..."); setTimeout(closeTerm, 350); },
    history: function () { tHist.forEach(function (h, i) { print("  " + (i + 1) + "  " + h); }); },
    clear: function () { tOut.innerHTML = ""; },
    exit: function () { closeTerm(); },
    logout: function () { closeTerm(); },
    pwd: function () { print("/home/pi"); },
    cd: function (args) { print(args[0] ? "cd: this shell only has one room. try ls " + args[0] : "you're already home."); },
    man: function (args) { if (args[0] && CMDS[args[0]]) print(args[0] + ": see help. the manual was eaten by a raptor."); else CMDS.help(); },
    uname: function () { print("pi-sh 1.0 island tty1 (cave terminal, volcano level 1)"); },
    date: function () { CMDS.time([]); },
    echo: function (args) { print(args.join(" ")); },
    summon: function () { print("summon what? the orbs don't answer to that. maybe the hidden files know."); },
    secrets: function () {
      var all = countFound() === TOTAL;
      print("secrets: " + save.secrets.length + " of " + SECRETS.length + " found" + (all ? "" : " (hints open up once all eight logs are found)"), "dim");
      SECRETS.forEach(function (q) { var got = save.secrets.indexOf(q.id) >= 0; print((got ? "  [x] " : "  [ ] ") + (got ? q.name : "???") + (!got && all ? "   " + q.hint : "")); });
    },
    ctf: function () { ctfBoardLines().forEach(function (l) { print(l[0], l[1]); }); },
    flags: function () { CMDS.ctf([]); },
    submit: function (args) {
      var guess = args.join(" ");
      if (!guess) { print("usage: submit <answer>   (flag{...} or just what's inside)", "err"); return; }
      if (ctfNorm(guess) === null) { print("submit: that can't be a flag. answers are letters, digits, _ and ., up to 64.", "err"); return; }
      termWait(ctfCheck(guess), ctfReport);
    },
    hint: function (args) {
      var f = ctfSlotArg(args, "hint"); if (!f) return;
      print("flag " + f.slot + " · " + f.name, "dim");
      if (!f.hints.length) { print("  no hints for this one."); return; }
      f.hints.forEach(function (q, i) { print("  " + (i + 1) + ". " + (ctfCond(q.when) ? q.t : "(another hint unlocks " + ctfLockedWhy(q.when) + ".)"), ctfCond(q.when) ? "" : "dim"); });
    },
    writeup: function (args) {
      var f = ctfSlotArg(args, "writeup"); if (!f) return;
      if (!ctfSolved(f)) { print("writeup " + f.slot + ": locked. capture flag " + f.slot + " first.", "dim"); return; }
      print("flag " + f.slot + " · " + f.name + " · write-up", "dim");
      f.writeup.forEach(function (l) { print("  " + l); });
    },
    middlepath: function () { KAIJU_ART.forEach(function (l) { print(l, "hi"); }); },
    evolve: function (args) {
      if (args[0] && args[0] !== "pi") { print("evolve: only pi can evolve. try ./evolve pi"); return; }
      if (pi.kaiju) { print("pi is already MIDDLE PATH. (devolve takes it back.)"); return; }
      if (countFound() < 4) { print("evolve: pi isn't ready. it needs 4 of 8 logs first (" + countFound() + " found).", "err"); return; }
      var stages = [["  .--.  ", " /    \\ ", " \\____/ ", "   egg  "], ["  ▄███▄  ", "  █▀█▀█  ", " ▄█████  ", "   pi     "], ["   ???    ", "  (    )  ", "   ~~~~   ", "          "]];
      print("evolving pi...", "dim");
      stages.forEach(function (st, n) { setTimeout(function () { st.forEach(function (l) { print("   " + l); }); print("   ↓", "dim"); sfx(n === 2 ? "warp" : "blip"); }, 300 + n * 500); });
      setTimeout(function () {
        KAIJU_ART.forEach(function (l) { print(l, "hi"); });
        print("pi evolved into MIDDLE PATH. (devolve to go back)", "ok"); foundSecret("evolve");
        pi.kaiju = true; save.evolved = true; writeSave();
        sfx("kgrowl");                                                         // its own growl: a warble, then a little chirp
      }, 1900);
    },
    devolve: function () { if (!pi.kaiju) { print("pi is as small as it gets."); return; } pi.kaiju = false; save.evolved = false; writeSave(); print("pi is pi again.", "ok"); },
    sound: function (args) {
      if (!SND) { print("sound: not available in this browser"); return; }
      if ((args[0] === "on") !== SND.on() && (args[0] === "on" || args[0] === "off")) SND.toggle(); else if (!args[0]) SND.toggle();
      startSound(); print("sound " + (SND.on() ? "on" : "off") + ". (m toggles it too)");
    },
    base64: function () { print("usage: echo <text> | base64 -d"); },
    fences: function (args) { print(args[0] === "off" ? "fences: permission denied. and also, no." : "fences: all paddocks live. 10,000 V."); }
  };
  /* the ctf in this terminal: the board, submit's answers, hints and write-ups. the engine
     (above, "the ctf") does the checking and saving; this is only how this terminal shows it */
  var CTF_STATE = { solved: ["[x]", "captured"], open: ["[ ]", "open"], offline: ["[-]", "offline"] };
  function ctfBoardLines() {
    var b = ctfBoard(), out = [["ctf board · " + ctfCount() + " of " + CTF_SLOTS + " captured", "dim"]];
    b.forEach(function (q) { var st = CTF_STATE[q.state], nm = q.state === "offline" ? "???" : q.name; out.push(["  " + st[0] + " " + q.slot + " " + (nm.length < 14 ? (nm + "              ").slice(0, 14) : nm) + " " + st[1], q.state === "solved" ? "ok" : q.state === "offline" ? "dim" : ""]); });
    out.push(["submit flag{...} · hint <n> · writeup <n>", "dim"]);
    return out;
  }
  // the flag a slot argument names, or null after saying why: a bad number, or nothing there yet
  function ctfSlotArg(args, cmd) {
    if (!/^[1-6]$/.test(args[0] || "")) { print("usage: " + cmd + " <n>   (n is a slot, 1 to " + CTF_SLOTS + ")", "err"); return null; }
    var f = CTF.filter(function (q) { return q.slot === +args[0]; })[0];
    if (!f || (!ctfSolved(f) && !ctfCond(f.open))) { print("flag " + args[0] + " is offline. nothing here yet.", "dim"); return null; }
    return f;
  }
  // a locked hint's reason, said vaguely: never the condition itself
  function ctfLockedWhy(c) {
    var first = (Array.isArray(c) ? c : [c]).filter(function (x) { return !ctfCond(x); })[0] || "";
    var kind = first.slice(0, first.indexOf(":"));
    return kind === "tool" ? "with a tool you don't have yet" : kind === "secret" ? "after you find a certain secret" : kind === "log" ? "after you read a certain log"
      : kind === "island" ? "somewhere you haven't been yet" : "after something else happens";
  }
  // submit's answer, once the check settles (termWait only calls this while the terminal is open)
  function ctfReport(err, r) {
    if (err) { print("submit: the flag checker didn't answer. try again.", "err"); return; }
    var f = r.id ? ctfById(r.id) : null;
    if (r.status === "match") {
      var sv = ctfSolve(r.id);
      if (sv.status === "match") {
        print("flag accepted: " + f.name + " (" + sv.count + "/" + CTF_SLOTS + ")", "ok"); sfx("grant");
        toast(sv.complete ? "all six flags captured" : "flag captured (" + sv.count + "/" + CTF_SLOTS + "): " + f.name, true);
        if (sv.complete) print("all six flags captured.", "ok");
        return;
      }
      if (sv.status === "full") { print("submit: the island's save has no room left, so this can't be kept.", "err"); return; }
      if (sv.status === "already") { print("already captured: " + f.name, "dim"); return; }
      r = { status: "none" };
    }
    if (r.status === "already") { print("already captured: " + f.name, "dim"); return; }
    if (r.status === "none") {
      print("no flag matches that.", "err");
      if (++tMiss === 3) print("stuck? try hint <n>", "dim");
      return;
    }
    if (r.status === "no-crypto") { print("submit: the flag checker needs a secure (https) connection.", "err"); return; }
    if (r.status === "invalid") { print("usage: submit <answer>   (flag{...} or just what's inside)", "err"); return; }
    print("submit: the flag checker failed. try again.", "err");
  }
  /* the one pipe this shell knows: echo <text> | base64 -d (or --decode), the real command's
     form. no other pipes, no encoding, and base64 on its own only says how to use it. the text
     must be whole base64 (its alphabet, = only as padding, a multiple of 4 long); what comes out
     is printed, never run, and only if it's text */
  function base64Decode(t) {
    if (!t) return;                                              // like the real one: nothing in, nothing out
    if (t.length % 4 || !/^[A-Za-z0-9+\/]+={0,2}$/.test(t)) { print("base64: invalid input", "err"); return; }
    var out; try { out = atob(t); } catch (e) { print("base64: invalid input", "err"); return; }
    out = out.replace(/\n$/, "");
    if (!/^[\x20-\x7e\t\n]*$/.test(out)) { print("base64: output isn't text", "err"); return; }
    out.split("\n").forEach(function (l) { print(l); });
  }
  function countFound() { return Object.keys(found).filter(function (id) { return STATIONS.some(function (s) { return s.id === id && s.found; }); }).length; }
  function run(line) {
    if (sudoTries >= 0) {                                        // answering the sudo password prompt
      if (line.trim().toLowerCase() === "eclipse") {
        sudoTries = -1; setPrompt();
        print("access granted.", "ok"); sfx("grant"); foundSecret("root"); print((rift && rift.winner ? "the core stirs. " : "") + "waking the orbs...", "ok");
        setTimeout(function () { closeTerm(); askRift(); }, 900);
      } else if (++sudoTries >= 3) { sudoTries = -1; setPrompt(); print("sudo: 3 incorrect password attempts. a raptor has been notified.", "err"); }
      else print("sorry, try again.", "err");
      return;
    }
    print("pi@island:~$ " + line, "cmd");
    line = line.trim(); if (!line) return;
    tHist.push(line); tHi = tHist.length;
    if (/^sudo\s+(\.\/)?rift\s+--?wake$/i.test(line)) { sudoTries = 0; setPrompt(); return; }
    if (/^(\.\/)?evolve\b/i.test(line)) { CMDS.evolve(line.split(/\s+/).slice(1)); return; }
    if (/^(sudo\s+)?(\.\/)?rift\b/.test(line)) { print(/^sudo/.test(line) ? "usage: sudo ./rift --wake" : "./rift: permission denied (try sudo)"); return; }
    if (/^sudo\b/.test(line)) { print("pi is not in the sudoers file. this incident will be reported.", "err"); return; }
    if (/^rm\s+-\w*r\w*f|^rm\s+-\w*f\w*r/.test(line)) { print("nice try. the raptors are watching.", "err"); return; }
    var b64 = /^echo\s+(?:'([^']*)'|"([^"]*)"|([^\s'"|]+))\s*\|\s*base64\s+(?:-d|--decode)$/.exec(line);
    if (b64) { base64Decode(b64[1] !== undefined ? b64[1] : b64[2] !== undefined ? b64[2] : b64[3]); return; }
    var parts = line.split(/\s+/), cmd = parts[0].toLowerCase();
    if (CMDS[cmd]) CMDS[cmd](parts.slice(1)); else if (DEBUG && DCMDS[cmd]) DCMDS[cmd](line.slice(parts[0].length).trim()); else print(cmd + ": command not found. try help", "err");
  }
  /* ?debug=1 only, and in neither help nor tab completion: __ctf <guess> checks a guess through
     the terminal's wait, the way the ctf's own commands will (E1-B) */
  var DCMDS = {
    __ctf: function (guess) {
      termWait(ctfCheck(guess), function (err, r) {
        if (err) { print("__ctf: the checker failed (" + err.message + ")", "err"); return; }
        if (r.status === "match") { var sv = ctfSolve(r.id); print("__ctf: " + sv.status + " " + r.id + " (" + ctfCount() + "/" + CTF_SLOTS + ")" + (sv.complete ? " complete" : ""), "ok"); }
        else print("__ctf: " + r.status + (r.id ? " " + r.id : ""), r.status === "already" ? "dim" : "err");
      });
    }
  };
  // one line from the box: nothing runs while a wait is open (the line stays typed)
  function submitLine() { if (tWait) return false; var v = tIn.value; tIn.value = ""; run(v); return true; }
  term.querySelector(".w-term-row").addEventListener("submit", function (e) { e.preventDefault(); submitLine(); if (termOpen && document.activeElement !== tIn) tIn.focus({ preventScroll: true }); });
  tIn.addEventListener("keydown", function (e) {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") sfx("key");
    if (e.key === "Escape") { e.preventDefault(); closeTerm(); return; }
    if (sudoTries >= 0) return;
    if (e.key === "ArrowUp" && tHist.length) { e.preventDefault(); tHi = Math.max(0, tHi - 1); tIn.value = tHist[tHi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); tHi = Math.min(tHist.length, tHi + 1); tIn.value = tHist[tHi] || ""; }
    else if (e.key === "Tab" && !e.shiftKey) {                   // complete a command or a file name (shift+tab moves focus back, to the log)
      e.preventDefault();
      var v = tIn.value, sp = v.lastIndexOf(" "), word = v.slice(sp + 1);
      var pool = sp < 0 ? Object.keys(CMDS) : v.indexOf("goto") === 0 ? Object.keys(PLACES) : Object.keys(FILES);
      var hits = pool.filter(function (w) { return w.indexOf(word) === 0; });
      if (hits.length === 1) tIn.value = v.slice(0, sp + 1) + hits[0] + (sp < 0 ? " " : "");
      else if (hits.length > 1) print(hits.join("   "), "dim");
    }
  });
  term.querySelector(".w-term-x").addEventListener("click", closeTerm);
  term.addEventListener("pointerdown", function (e) { if (e.target === term || e.target === tOut) setTimeout(function () { tIn.focus({ preventScroll: true }); }, 0); });

  // one place to ask "what's near pi": landmarks, rex, the locals, the birds, the pond, the car, the core
  function nearCandidates() {
    var out = [];
    OUT.forEach(function (s) { out.push({ d: Math.hypot(pi.x - (s.x * T + 8), pi.y - (s.y * T + 12)), max: 26, v: s }); });
    out.push({ d: Math.hypot(pi.x - rex.x, pi.y - rex.y), max: 20, v: { id: "rex", name: "rex" } });
    critters.forEach(function (c) {
      var d = DINOS[c.kind], ht = d.art ? artH(c.kind) : d.a.length, reach = d.art ? Math.max(18, artW(c.kind) * 0.5) : 18;
      out.push({ d: Math.hypot(pi.x - c.x, pi.y - c.y), max: reach, v: { id: "critter", ref: c, ax: c.x, ay: c.y - ht - 2 } });
    });
    bots.forEach(function (b) { out.push({ d: Math.hypot(pi.x - b.x, pi.y - b.y), max: 18, v: { id: "bot", ref: b, ax: b.x, ay: b.y - 16 } }); });
    BUILDINGS.forEach(function (bd) { var dx2 = (bd.x0 + bd.w / 2) * T, dy2 = (bd.y0 + bd.h) * T + 6; out.push({ d: Math.hypot(pi.x - dx2, pi.y - dy2), max: 24, v: { id: "building", ref: bd, ax: dx2, ay: dy2 - 20 } }); });
    nests.forEach(function (n) { var nx = n.tx * T + 8, ny = n.ty * T + 12; out.push({ d: Math.hypot(pi.x - nx, pi.y - ny), max: 20, v: { id: "nest", ref: n, ax: nx, ay: ny - 10 } }); });
    if (heli.state === "parked") out.push({ d: Math.hypot(pi.x - heli.x, pi.y - heli.y), max: 26, v: { id: "heli", ax: heli.x, ay: heli.y - 20 } });
    birds.forEach(function (b) { if (!b.fly) out.push({ d: Math.hypot(pi.x - b.x, pi.y - b.gy), max: 22, v: { id: "bird", ax: b.x, ay: b.y - 10 } }); });
    out.push({ d: Math.hypot(pi.x - car.x, pi.y - car.y), max: 20, v: { id: "car", ax: car.x, ay: car.y - 14 } });
    var ptx = Math.floor(pi.x / T), pty = Math.floor(pi.y / T);
    if (near(ptx, pty, 1, function (a, b) { return at(a, b) === POND; })) out.push({ d: 21, max: 22, v: { id: "pond", ax: pi.x, ay: pi.y - 16 } });
    var fz = null; near(ptx, pty, 1, function (a, b) { if (fence[k(a, b)] && !fz) fz = [a, b]; return false; });
    if (fz) out.push({ d: 23, max: 24, v: { id: "fence", fx: fz[0], fy: fz[1], ax: fz[0] * T + 8, ay: fz[1] * T - 8 } });
    return out;
  }
  function sayLocal(v) {
    if (v.id === "critter") {
      var c = v.ref, d = DINOS[c.kind];
      if (c.sleep <= 0) { c.hop = 1; c.vy = -2; sfx(c.kind === "para" ? "honkp" : c.kind === "robot" || c.kind === "roomba" ? "blip" : "hop", c.x, c.y); }
      var line = c.name ? (c.sleep > 0 ? c.name + " is asleep in the sun. pi lets " + (c.name === "jasmine" ? "her" : "him") + " be." : c.say)
        : c.sleep > 0 && d.sleepSay ? d.sleepSay : Array.isArray(d.say) ? d.say[(rand() * d.say.length) | 0] : d.say;
      say(c.name ? c.name : c.kind === "cat" ? "a himalayan cat" : c.kind === "robot" || c.kind === "roomba" ? "a bot" : "a dinosaur", line, []);
    } else if (v.id === "bird") { sfx("whistle", pi.x, pi.y); say("a cockatiel", "one of Ammaar's two cockatiels. it whistles at pi, then preens.", []); }
    else if (v.id === "pond") {
      // pi tosses a handful of pellets on the water nearest him, and the koi come running
      var best = null, bd = 1e9;
      for (var a2 = 0; a2 < 6.283; a2 += 0.1) { var qx = (KP.x + Math.cos(a2) * KP.rx * 0.8) * T, qy = (KP.y + Math.sin(a2) * KP.ry * 0.75) * T, q = Math.hypot(qx - pi.x, qy - pi.y); if (q < bd) { bd = q; best = [qx, qy]; } }
      feedKoi(best[0], best[1]); sfx("plop", best[0], best[1]); later(0.5, function () { sfx("splash", best[0], best[1]); });
      say("the koi pond", "Ammaar's koi pond: twenty koi, every one a different variety and size. kohaku, showa, tancho, chagoi, karasu, a big platinum ogon, and the rest. pi tosses in some pellets and they all come running.", []);
    }
    else if (v.id === "nest") say("a nest", "a nest of " + v.ref.eggs + " speckled eggs, still warm. one of them wobbles. pi backs away slowly.", []);
    else if (v.id === "fence") {
      var pd = PADDOCKS.filter(function (q) { return v.fx >= q.x0 && v.fx <= q.x1 && v.fy >= q.y0 && v.fy <= q.y1; })[0];
      say(pd ? pd.name : "a fence", pd && pd.name === "raptor pen" ? "the raptor pen. 10,000 volts. three raptors inside, and all three have stopped to look at pi." : "the t-rex paddock. 10,000 volts. somewhere in there, something very big just stopped moving.", []);
      sfx("zap", v.fx * T + 8, v.fy * T);
      if (pd && pd.name !== "raptor pen" && trex.cd <= 0) roar();
    }
    else if (v.id === "car") { say("the car", "Ammaar's car. press e to get in, arrows or wasd to drive, space to honk, e again to park." + (TOUCH ? " on touch: tap where you want to go." : ""), [["get in", "#drive"]]); }
  }

  // the t-rex roars when pi comes close to its fence: the screen shakes, the birds scatter
  function roar() {
    foundSecret("roar");
    trex.roar = 1.4; trex.cd = 14; trex.tx = 0; trex.face = pi.x > trex.x ? 1 : -1; quake = 4;
    roarTag = { x: trex.x, y: trex.y - artH("trex") - 4, t: 1.6 };
    sfx("roar", trex.x, trex.y, { vol: 1.4 });
    if (!birds[0].fly) { var n = (birds[0].perch + 3) % perches.length; fly(birds[0], n, 0); fly(birds[1], n, 0.2); }
  }
  var roarTag = null;
  function updateLife(dt) {
    skyT -= dt; if (skyT <= 0) { readSky(); skyT = 30; }
    critters.forEach(function (c) { updateCritter(c, dt); });
    updateBirds(dt); updateKoi(dt); updateCar(dt); updateHeli(dt); updateVolcano(dt); updateBots(dt);
    if (trex.cd <= 0 && !aboard() && !room && pi.x < 42 * T && pi.x > 25 * T && pi.y > 41.5 * T && pi.y < 56 * T && Math.hypot(pi.x - trex.x, pi.y - trex.y) < 150) roar();
    if (roarTag) { roarTag.t -= dt; if (roarTag.t <= 0) roarTag = null; }
  }

  /* ════════ the rift: an easter egg for finding all eight ════════
     the island darkens, five orbs fall out of the sky, and they fight for
     control of the site. the last one standing takes the core, and runs the
     orbs on the page for the rest of the session. walk up to it for a rematch. */
  var ARENA = { x: 48 * T + 8, y: 43 * T + 8 }, OR = 13;         // centre of the fight, orb radius (world px)
  var RIVALS = ["eclipse", "bone", "halo", "fog", "void"];
  var POWER = { eclipse: 1.7, bone: 1.2, halo: 1.1, fog: 0.9, void: 1.0 };
  var rift = null, pendingRift = false, orbCache = {};
  function orbArt(name) {
    if (!orbCache[name] && window.Orb) orbCache[name] = window.Orb(mkCanvas(), { offscreen: { w: 96, h: 96 }, palette: name, layers: [[26, 52, 1, 1], [14, 28, 0.78, 0.45]] });
    return orbCache[name];
  }
  function riftBusy() { return rift && rift.phase !== "reign"; }
  function dust(name) { var p = window.OrbPalettes && window.OrbPalettes[name]; return p ? p.dust : [230, 230, 230]; }
  var PCAP = TOUCH ? 120 : 300;
  function addPart(p) { var cap = qTier ? PCAP >> 1 : PCAP; if (rift.parts.length >= cap) rift.parts.shift(); rift.parts.push(p); }
  function burst(x, y, name, n, speed) {
    var c = dust(name);
    for (var i = 0; i < n; i++) {
      var a = frand() * 6.283, v = speed * (0.3 + frand());
      addPart({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 10, life: 1, c: c });
    }
  }
  /* the fight. the orbs don't circle a spot and take turns: they range over the whole
     clearing, each at its own height, and each fights its own way:
       eclipse  charges: winds up, trembling, then tears across the field through its target
       bone     binds: locks onto its target and the two spiral in like a binary star, faster
                and tighter, until they merge and blow apart
       halo     burns: hangs back, gathers light, and fires a beam
       fog      blinks: folds out of the world and unfolds right beside its target
       void     devours: opens a gravity well and drags its target in
     every hit is two stars colliding: the screen goes white, a fireball swells out of the point
     of impact, a field of pressure rolls outward across the island, embers scatter, the ground
     is scorched, and reality tears. a killing blow is a supernova. */
  var STYLE = { eclipse: "charge", bone: "bind", halo: "beam", fog: "blink", void: "well" };
  var FIELD = { rx: 170, ry: 92 };
  function rival(name, i) {
    var a = i / RIVALS.length * 6.283 - 1.57;
    return { name: name, art: orbArt(name), a: a, x: ARENA.x + Math.cos(a) * 120, y: ARENA.y + Math.sin(a) * 60, z: 300 + i * 50, hp: 2, alive: true, scale: 1, flash: 0, vx: 0, vy: 0,
             style: STYLE[name] || "charge", goal: null, gt: 0, alpha: 1, trail: [], hz: 26 + i * 7 };
  }
  function fieldPoint() { var a = frand() * 6.283, r = Math.sqrt(frand()); return { x: ARENA.x + Math.cos(a) * FIELD.rx * r, y: ARENA.y + Math.sin(a) * FIELD.ry * r }; }
  // before the orbs wake, ask, and say what's coming: the fight flashes and it's loud
  var asking = false;
  function askRift() {
    if (REDUCED || !window.Orb) { startRift(); return; }
    say("the clearing", "five orbs are waking up under the clearing, and they want control of the site. wake them? it gets loud and flashy: contains flashing lights and loud sound.", [["wake them (y)", "#wake"], ["not now (n)", "#later"], [flashNote(OPT.flash), "#flash"]]);
    asking = true;
  }
  function wakeOrbs(yes) {
    asking = false; closeDialog();
    if (yes) { rift = null; startRift(); } else bubble = { text: "pi:~$ they can wait. the clearing, whenever.", t: 3 };
  }
  function startRift() {
    if (side) return;
    settle();
    if (Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y) > 200) { pi.x = ARENA.x; pi.y = ARENA.y + FIELD.ry + 30; camF.x = null; }
    if (REDUCED || !window.Orb) { crown("eclipse"); return; }
    rift = { phase: "dim", t: 0, orbs: RIVALS.map(rival), parts: [], shake: 0, dim: 0, next: 0, act: null, winner: null, ring: 0, novas: [], scorch: [], flash: 0, hits: 0 };
    bubble = { text: "pi:~$ ...something's waking up.", t: 3.2 };
  }
  function crown(name) {
    if (reality.cur !== "dino") shiftReality("dino", ARENA.x, ARENA.y - 34);
    save.ruler = name; writeSave();
    if (window.orbs) window.orbs.forEach(function (o) { if (o.palette) o.palette(name); });
    if (!rift) rift = { orbs: [], parts: [], shake: 0, dim: 0, ring: 0, novas: [], scorch: [], flash: 0 };
    rift.phase = "reign"; rift.winner = name; rift.t = 0; rift.act = null;
    var w = rift.orbs.filter(function (o) { return o.name === name; })[0] || (window.Orb ? rival(name, 0) : null);
    if (w) { w.alive = true; w.alpha = 1; w.x = ARENA.x; w.y = ARENA.y; w.z = 34; w.scale = 1.7; rift.orbs = [w]; }
    paintFound();
    if (!save.credits) creditsNext = true;
    coreSay(true);
  }
  /* the credits: after the first crowning, a short roll, then the contact card. after that the
     island is free roam, everything open */
  var creditsNext = false, credEl = root.querySelector(".w-credits");
  function creditsOpen() { return credEl && !credEl.hidden; }
  function showCredits() {
    if (!credEl) return;
    save.credits = true; writeSave();
    var roll = credEl.querySelector(".w-roll"), lines = [["h", "pi's island"], ["", "a playable version of this portfolio"], ["", ""], ["k", "the eight logs"]];
    STATIONS.filter(function (q) { return q.found; }).forEach(function (q) { lines.push(["", q.name + " · " + q.sec]); });
    lines.push(["", ""], ["k", "the orbs"], ["", "eclipse, bone, halo, fog and void"], ["", (rift && rift.winner ? rift.winner : "eclipse") + " holds the core"], ["", ""], ["k", "the mascot"], ["", "Middle Path, drawn years ago by Ammaar and his friends"], ["", ""], ["h", "thanks for playing"]);
    roll.innerHTML = ""; lines.forEach(function (l) { var d = document.createElement("div"); d.className = l[0] ? "w-roll-" + l[0] : ""; d.textContent = l[1] || "\u00a0"; roll.appendChild(d); });
    credEl.hidden = false; credEl.classList.remove("w-cred-end");
    keys = {};
    if (REDUCED) creditsEnd(); else { roll.style.animation = "none"; void roll.offsetWidth; roll.style.animation = ""; }
    credEl.focus({ preventScroll: true });
  }
  function creditsEnd() { if (!credEl) return; credEl.classList.add("w-cred-end"); var a0 = credEl.querySelector(".w-contact a"); if (a0) a0.focus({ preventScroll: true }); }
  function closeCredits() { if (credEl) credEl.hidden = true; cv.focus({ preventScroll: true }); bubble = { text: "pi:~$ everything's open now. go anywhere.", t: 3.5 }; }
  if (credEl) {
    credEl.querySelector(".w-roll").addEventListener("animationend", creditsEnd);
    credEl.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-a=\"roam\"]")) { closeCredits(); return; }
      if (!credEl.classList.contains("w-cred-end") && !(e.target.closest && e.target.closest("a"))) creditsEnd();
    });
  }
  var restoreBtn = root.querySelector(".w-restore");
  function restoreSite() {
    if (!rift) return;
    closeDialog();
    rift = null; reality.cur = "dino"; reality.wipe = null; reality.glitch = 0; lens = null; freeSkins();
    save.ruler = null; writeSave();
    if (window.orbs) window.orbs.forEach(function (o) { if (o.palette) o.palette("eclipse"); });
    if (SND) SND.intensity(0);
    paintFound(); paintRestore();
    bubble = { text: "pi:~$ site restored. the orbs are asleep.", t: 3 };
    cv.focus({ preventScroll: true });
  }
  function paintRestore() { if (restoreBtn && restoreBtn.hidden !== !rift) restoreBtn.hidden = !rift; }
  if (restoreBtn) restoreBtn.addEventListener("click", restoreSite);
  function coreSay(fresh) {
    var w = rift.winner, links = [["rematch ↻", "#rematch"]];
    if (w !== "eclipse") links.push(["give eclipse control back", "#eclipse"]);
    say("the core", fresh
      ? "the orbs fought for control of the site. " + w + " won" + (w === "eclipse" ? ", as it usually does" : ", an upset") + ". it runs the orbs on the page until the page reloads. walk back up to it any time for a rematch, or press restore site to put everything back."
      : w + " holds the core. it runs the orbs on the page until the page reloads.", links);
  }
  // two stars meet at (x, y): b takes the hit
  function nova(a, b, x, y) {
    var kill = --b.hp <= 0, big = kill ? 2.3 : 1;
    b.flash = 1; a.flash = 0.6; rift.hits++;
    rift.shake = kill ? 16 : 11; hitstop = kill ? 0.1 : 0.07; if (flashGate()) rift.flash = kill ? 1 : 0.7;
    rift.novas.push({ x: x, y: y, t: 0, dur: kill ? 3.4 : 2.2, R: big, c1: dust(a.name), c2: dust(b.name) });
    rift.scorch.push({ x: x, y: y + 26, r: 30 * big, life: 1 });
    lens = { x: x, y: y, t: 0 };
    for (var i = 0; i < (kill ? 160 : 80); i++) {
      var sa = frand() * 6.283, sv = (40 + frand() * 200) * (kill ? 1.4 : 1);
      addPart({ x: x, y: y + 26, vx: Math.cos(sa) * sv, vy: Math.sin(sa) * sv * 0.6, life: 1 + frand() * 1.2, c: i % 3 ? dust(i % 2 ? a.name : b.name) : [255, 244, 220], drag: 0.94, size: frand() < 0.2 ? 3 : 2 });
    }
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    b.vx += dx / len * 220; b.vy += dy / len * 130; a.vx -= dx / len * 90; a.vy -= dy / len * 60;
    var others = ["dino", "future", "chaos"].filter(function (r2) { return r2 !== reality.cur; });
    shiftReality(others[(frand() * others.length) | 0], x, y);
    sfx("nova", x, y, { vol: kill ? 1.25 : 1 });
    if (kill) { b.alive = false; later(0.7, function () { sfx("nova", x, y, { vol: 0.7 }); }); }
  }
  // every special move is telegraphed: 150 ms of the attacker glowing and a rising tone first
  function begin(att, tgt) {
    rift.act = { a: att, b: tgt, kind: att.style, t: 0, fx: att.x, fy: att.y, ang: Math.atan2(att.y - tgt.y, att.x - tgt.x), done: false, tele: 0.15 };
    att.trail = [];
    sfx("tele", att.x, att.y);
  }
  function updateAct(dt) {
    var d = rift.act, a = d.a, b = d.b;
    if (!a.alive || !b.alive) { rift.act = null; return; }
    if (d.tele > 0) {
      d.tele -= dt; a.rage = 1; a.flash = Math.max(a.flash, 0.5); a.vx *= 0.8; a.vy *= 0.8;
      if (d.tele <= 0) { d.fx = a.x; d.fy = a.y; if (a.style === "blink") sfx("whoosh", a.x, a.y); else sfx("dash", a.x, a.y); }
      return;
    }
    d.t += dt;
    if (d.kind === "charge") {
      if (d.t < 0.6) { a.vx *= 0.8; a.vy *= 0.8; a.x += (frand() - 0.5) * 3; a.rage = d.t / 0.6; d.fx = a.x; d.fy = a.y; }
      else {
        var k = Math.min(1, Math.pow((d.t - 0.6) / 0.28, 2));
        a.trail.push({ x: a.x, y: a.y, z: a.z }); if (a.trail.length > 10) a.trail.shift();
        a.x = d.fx + (b.x - d.fx) * k; a.y = d.fy + (b.y - d.fy) * k; a.z += (b.z - a.z) * k;
        if (k >= 1) { nova(a, b, b.x, b.y - b.z); a.vx += (b.x - d.fx) * 0.8; a.vy += (b.y - d.fy) * 0.8; rift.act = null; }
      }
    } else if (d.kind === "bind") {
      var D = 2, u = Math.min(1, d.t / D), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, rr = 46 * Math.pow(1 - u, 1.3) + 2;
      d.ang += dt * (2.5 + u * u * 16);
      a.x += (mx + Math.cos(d.ang) * rr - a.x) * 0.3; a.y += (my + Math.sin(d.ang) * rr * 0.55 - a.y) * 0.3;
      b.x += (mx - Math.cos(d.ang) * rr - b.x) * 0.3; b.y += (my - Math.sin(d.ang) * rr * 0.55 - b.y) * 0.3;
      a.z += (34 - a.z) * 0.1; b.z += (34 - b.z) * 0.1; a.vx = a.vy = b.vx = b.vy = 0;
      if (frand() < dt * 30) addPart({ x: mx + (frand() - 0.5) * rr * 2, y: my + 26 + (frand() - 0.5) * rr, vx: 0, vy: 0, life: 0.8, c: dust(frand() < 0.5 ? a.name : b.name), swirl: 5, size: 2 });
      if (u >= 1) { nova(a, b, mx, my - 34); rift.act = null; }
    } else if (d.kind === "beam") {
      a.vx *= 0.85; a.vy *= 0.85; a.rage = Math.min(1, d.t / 0.8);
      if (d.t > 0.8 && !d.done) { d.done = true; d.beam = { t: 0 }; nova(a, b, b.x, b.y - b.z); }
      if (d.beam) { d.beam.t += dt; if (d.beam.t > 0.4) rift.act = null; }
    } else if (d.kind === "blink") {
      if (d.t < 0.35) { a.alpha = 1 - d.t / 0.35; if (frand() < dt * 60) addPart({ x: a.x + (frand() - 0.5) * 30, y: a.y + 26 + (frand() - 0.5) * 20, vx: 0, vy: 0, life: 0.5, c: dust(a.name), pull: a, size: 2 }); }
      else if (!d.moved) { d.moved = true; var ang = frand() * 6.283; a.x = b.x + Math.cos(ang) * 30; a.y = b.y + Math.sin(ang) * 16; a.vx = a.vy = 0; }
      else { a.alpha = Math.min(1, (d.t - 0.35) / 0.15); if (d.t > 0.55) { nova(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2 - 30); a.alpha = 1; rift.act = null; } }
    } else if (d.kind === "well") {
      var ddx = a.x - b.x, ddy = a.y - b.y, dist = Math.hypot(ddx, ddy) || 1;
      a.vx *= 0.8; a.vy *= 0.8; a.rage = 1;
      b.vx += ddx / dist * dt * (260 + d.t * 400); b.vy += ddy / dist * dt * (160 + d.t * 260);
      if (frand() < dt * 40) { var pa = frand() * 6.283, pr = 40 + frand() * 50; addPart({ x: a.x + Math.cos(pa) * pr, y: a.y + 26 + Math.sin(pa) * pr * 0.55, vx: 0, vy: 0, life: 1, c: [20, 8, 30], pull: a, swirl: 4, size: 2 }); }
      if (dist < 20 || d.t > 2.2) { nova(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2 - 30); rift.act = null; }
    }
  }
  function updateRift(dt) {
    paintRestore();
    if (!rift) return;
    rift.t += dt; rift.shake = Math.max(0, rift.shake - dt * 14); rift.ring = Math.max(0, rift.ring - dt * 0.8); rift.flash = Math.max(0, (rift.flash || 0) - dt * 2.6);
    var alive = rift.orbs.filter(function (o) { return o.alive; });
    if (SND && rift.phase !== "reign") SND.intensity(rift.phase === "fight" ? Math.min(1, 0.12 + rift.hits * 0.07 + rift.t * 0.006) : 0);
    if (rift.phase === "dim") {
      rift.dim = Math.min(0.66, rift.t / 2.5 * 0.66); rift.shake = Math.max(rift.shake, 0.8);
      if (rift.t > 3) { rift.phase = "fall"; rift.t = 0; }                            // a long silence first
    } else if (rift.phase === "fall") {
      rift.orbs.forEach(function (o, i) {
        var u = Math.max(0, Math.min(1, (rift.t - i * 0.35) / 0.9)), e = 1 - Math.pow(1 - u, 3);
        var z = 300 + i * 50 + (o.hz - 300 - i * 50) * e;
        if (o.z > 40 && z <= 40) { rift.shake = 6; burst(o.x, o.y, o.name, 20, 60); sfx("thud", o.x, o.y); rift.scorch.push({ x: o.x, y: o.y, r: 16, life: 1 }); }
        o.z = z;
      });
      if (rift.t > 3) { rift.phase = "fight"; rift.t = 0; rift.next = 0.8; }
    } else if (rift.phase === "fight") {
      alive.forEach(function (o) {
        if (rift.act && (rift.act.a === o || (rift.act.kind === "bind" && rift.act.b === o))) return;
        // roam: each picks somewhere on the field, drifts there, picks again
        o.gt -= dt;
        if (!o.goal || o.gt <= 0 || Math.hypot(o.goal.x - o.x, o.goal.y - o.y) < 12) { o.goal = fieldPoint(); o.gt = 1.5 + frand() * 2.5; }
        var sp = o.style === "blink" ? 70 : o.style === "charge" ? 55 : 40, gx = o.goal.x - o.x, gy = o.goal.y - o.y, gl = Math.hypot(gx, gy) || 1;
        o.vx += (gx / gl * sp - o.vx) * dt * 1.6; o.vy += (gy / gl * sp * 0.7 - o.vy) * dt * 1.6;
        o.x += o.vx * dt; o.y += o.vy * dt;
        var ex = (o.x - ARENA.x) / FIELD.rx, ey = (o.y - ARENA.y) / FIELD.ry, ed = Math.hypot(ex, ey);
        if (ed > 1.1) { o.x = ARENA.x + ex / ed * 1.1 * FIELD.rx; o.y = ARENA.y + ey / ed * 1.1 * FIELD.ry; o.vx *= -0.4; o.vy *= -0.4; }
        o.z += (o.hz + Math.sin(rift.t * 2 + o.a * 3) * 6 - o.z) * dt * 2;
        o.rage = Math.max(0, (o.rage || 0) - dt);
        o.trail.length = 0;
      });
      if (rift.act) updateAct(dt);
      else if (alive.length > 1 && (rift.next -= dt) <= 0) {
        // the strong pick fights more often; the target is anyone else
        var total = alive.reduce(function (s, o) { return s + POWER[o.name]; }, 0), r = frand() * total, att = alive[0];
        for (var i = 0; i < alive.length; i++) { r -= POWER[alive[i].name]; if (r <= 0) { att = alive[i]; break; } }
        var others = alive.filter(function (o) { return o !== att; });
        begin(att, others[(frand() * others.length) | 0]);
        rift.next = 0.9 + frand() * 1.1;
      }
      if (!rift.act && rift.orbs.filter(function (o) { return o.alive; }).length === 1) { rift.phase = "crowning"; rift.t = 0; }
    } else if (rift.phase === "crowning") {
      var w = alive[0];
      w.x += (ARENA.x - w.x) * 0.04; w.y += (ARENA.y - w.y) * 0.04; w.z += (34 - w.z) * 0.04; w.alpha = 1;
      w.scale = 1 + Math.min(1, rift.t / 2.4) * 0.7;
      rift.dim = Math.max(0.3, rift.dim - dt * 0.1);
      if (rift.t > 1.2 && !rift.ringed) { rift.ringed = true; rift.ring = 1; rift.shake = 7; burst(w.x, w.y - w.z, w.name, 60, 90); sfx("crown"); }
      if (rift.t > 4) crown(w.name);
    } else if (rift.phase === "reign") {
      rift.dim = Math.max(0, rift.dim - dt * 0.3);
      var o = rift.orbs[0]; if (o) o.z = 34 + Math.sin(rift.t * 1.6) * 3;
    }
    rift.orbs.forEach(function (o) { o.flash = Math.max(0, o.flash - dt * 2.5); });
    rift.parts.forEach(function (p) {
      if (p.pull) { var px2 = p.pull.x - p.x, py2 = p.pull.y + 26 - p.y, pl = Math.hypot(px2, py2) || 1; p.vx += px2 / pl * 300 * dt; p.vy += py2 / pl * 300 * dt; }
      if (p.swirl) { var ca = Math.cos(p.swirl * dt), sa2 = Math.sin(p.swirl * dt), vx = p.vx; p.vx = vx * ca - p.vy * sa2; p.vy = vx * sa2 + p.vy * ca; }
      p.x += p.vx * dt; p.y += p.vy * dt; var dr = p.drag || 0.97; p.vx *= dr; p.vy *= dr; p.life -= dt * 1.1;
    });
    rift.novas = (rift.novas || []).filter(function (n) { n.t += dt; return n.t < n.dur; });
    rift.scorch = (rift.scorch || []).filter(function (s) { s.life -= dt / 9; return s.life > 0; });
    for (var pi0 = 0, pj = 0; pi0 < rift.parts.length; pi0++) if (rift.parts[pi0].life > 0) rift.parts[pj++] = rift.parts[pi0];
    rift.parts.length = pj;
  }
  function orbFocus() {
    // the camera watches the fight, not one spot: the middle of the living orbs, pulled toward the arena
    if (!rift || !rift.orbs.length) return { x: ARENA.x, y: ARENA.y - 20 };
    var al = rift.orbs.filter(function (o) { return o.alive; }), sx = 0, sy = 0;
    al.forEach(function (o) { sx += o.x; sy += o.y - o.z * 0.5; });
    return al.length ? { x: (sx / al.length + ARENA.x) / 2, y: (sy / al.length + ARENA.y - 20) / 2 } : { x: ARENA.x, y: ARENA.y - 20 };
  }
  function drawOrb(o, E, alpha) {
    var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale, size = 96 * rr / 31.7;
    ctx.globalAlpha = alpha;
    o.art.energy(o.rage > 0 ? 0.6 + o.rage : 0.3);
    o.art.frame(t + o.a);
    ctx.drawImage(o.art.canvas, sx - size / 2, sy - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  function drawRift(E) {
    if (!rift) return;
    if (rift.dim > 0) { ctx.fillStyle = "rgba(3,4,10," + rift.dim.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    // scorched ground where the stars met
    (rift.scorch || []).forEach(function (s) {
      var gx = (s.x - camX) * E, gy = (s.y - camY) * E;
      drawGlow(glowSprite("scorch", [[0, "8,2,2", 0.7], [0.6, "40,8,4", 0.35], [1, "0,0,0", 0]]), gx, gy, s.r * E, s.r * E * 0.55, s.life);
    });
    var list = rift.orbs.filter(function (o) { return o.alive; }).slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) {
      var gx = (o.x - camX) * E, gy = (o.y - camY) * E, rr = OR * E * o.scale * (1 - Math.min(0.5, o.z / 160));
      ctx.fillStyle = "rgba(0,0,0," + (0.35 * o.alpha).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(gx, gy, rr * 0.8, rr * 0.25, 0, 0, 6.283); ctx.fill();
    });
    var act = rift.act;
    // the gravity well: a field of darkness around void while it feeds
    if (act && act.kind === "well") {
      var wx = (act.a.x - camX) * E, wy = (act.a.y - act.a.z - camY) * E, wr = (70 + act.t * 20) * E / 3 * 3;
      drawGlow(glowSprite("well", [[0, "0,0,0", 0.95], [0.4, "10,0,16", 0.6], [1, "0,0,0", 0]]), wx, wy, wr, wr, 1);
    }
    // each orb pools darkness around itself; motes fall into it; now and then a pair of red eyes
    list.forEach(function (o, oi) {
      var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale, rage = o.rage || 0.3;
      var pc = o.name === "void" || o.name === "eclipse" ? "40,0,20" : "10,6,20", ar = rr * (2.6 + rage);
      drawGlow(glowSprite("pool" + pc, [[0, "0,0,0", 0.8], [0.55, pc, 0.4], [1, "0,0,0", 0]], 0.13), sx, sy, ar, ar, o.alpha);
      for (var m = 0; m < 14; m++) {
        var ph = (t * (0.35 + (m % 5) * 0.06) + m * 0.137 + oi * 0.3) % 1, ang = m * 2.4 + t * (0.8 + rage) + ph * 3, dd2 = rr * (2.8 - ph * 1.9);
        ctx.fillStyle = "rgba(6,4,12," + (0.9 * Math.sin(ph * Math.PI) * o.alpha).toFixed(2) + ")";
        ctx.fillRect(Math.round(sx + Math.cos(ang) * dd2), Math.round(sy + Math.sin(ang) * dd2 * 0.8), 2, 2);
      }
      if (Math.sin(t * 9 + oi * 2) > 0.95) { ctx.fillStyle = "rgba(208,20,44,.9)"; ctx.fillRect(sx - 3, sy - 1, 2, 1); ctx.fillRect(sx + 2, sy - 1, 2, 1); }
    });
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    // afterimages behind a charge
    list.forEach(function (o) { o.trail.forEach(function (p, i) { drawOrb({ x: p.x, y: p.y, z: p.z, scale: o.scale * (0.6 + i * 0.04), art: o.art, a: o.a, rage: 1 }, E, 0.08 + i * 0.03); }); });
    list.forEach(function (o) {
      drawOrb(o, E, o.alpha);
      var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale;
      if (o.flash > 0 || o.rage > 0.2) {
        var fr2 = rr * (1.6 + o.rage);
        drawGlow(glowSprite("flare", [[0, "255,255,255", 1], [1, "255,255,255", 0]]), sx, sy, fr2, fr2, 0.6 * Math.max(o.flash, o.rage * 0.4));
      }
    });
    // the binary: a bridge of light between the two as they spiral in
    if (act && act.kind === "bind") {
      var ax = (act.a.x - camX) * E, ay = (act.a.y - act.a.z - camY) * E, bx = (act.b.x - camX) * E, by = (act.b.y - act.b.z - camY) * E, bu = Math.min(1, act.t / 2);
      var lg = ctx.createLinearGradient(ax, ay, bx, by); lg.addColorStop(0, "rgba(" + dust(act.a.name).join(",") + "," + (0.3 + bu * 0.6).toFixed(2) + ")"); lg.addColorStop(1, "rgba(" + dust(act.b.name).join(",") + "," + (0.3 + bu * 0.6).toFixed(2) + ")");
      ctx.strokeStyle = lg; ctx.lineWidth = (1 + bu * 5) * E / 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // halo's beam: a core of white inside a wide glow, flickering
    if (act && act.kind === "beam") {
      var hx = (act.a.x - camX) * E, hy = (act.a.y - act.a.z - camY) * E, tx2 = (act.b.x - camX) * E, ty2 = (act.b.y - act.b.z - camY) * E;
      if (!act.beam) { ctx.strokeStyle = "rgba(255,255,255," + (0.15 * act.t).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx2, ty2); ctx.stroke(); ctx.setLineDash([]); }
      else {
        var bf = 1 - act.beam.t / 0.4, fl = 0.8 + rand() * 0.4;
        [[18, 0.18], [9, 0.4], [3, 0.95]].forEach(function (lw, i) { ctx.strokeStyle = i === 2 ? "rgba(255,255,255," + (lw[1] * bf).toFixed(3) + ")" : "rgba(" + dust(act.a.name).join(",") + "," + (lw[1] * bf).toFixed(3) + ")"; ctx.lineWidth = lw[0] * fl * E / 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx2, ty2); ctx.stroke(); });
      }
    }
    // the collisions: fields, not lines. a fireball swelling out of the impact, a band of
    // pressure rolling outward over the island, and at the heart, for a moment, a black hole
    (rift.novas || []).forEach(function (n) {
      var ix = (n.x - camX) * E, iy = (n.y - camY) * E, u = n.t / n.dur, e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3), fade = 1 - u;
      var Rf = (14 + e * 95) * n.R * E / 3 * 1.8;
      var c1 = n.c1.join(","), c2 = n.c2.join(",");
      drawGlow(glowSprite("fb" + c1 + "/" + c2, [[0, c1, 0.85], [0.22, c1, 0.85], [0.5, c2, 0.55], [0.78, "120,20,16", 0.35], [1, "0,0,0", 0]]), ix, iy, Rf, Rf, fade);
      var core = OPT.flash ? "255,255,255" : c1;                                  // the white heart (coloured with flashes off)
      drawGlow(glowSprite("core" + core, [[0, core, 1], [0.22, core, 0.6], [0.45, core, 0]]), ix, iy, Rf, Rf, Math.max(0, 1 - u * 1.6) * (OPT.flash ? 1 : 0.6));
      for (var k3 = 0; k3 < 2 && qTier === 0; k3++) {                           // the pressure fronts
        var su = Math.max(0, u - k3 * 0.12); if (su <= 0) continue;
        var Rs = (20 + (1 - Math.pow(1 - su, 2.2)) * 300 * n.R) * E / 3 * 1.6, band = Math.max(8, Rs * 0.28), Ro = Rs + band * 0.3, pcol = (k3 ? n.c2 : [255, 236, 214]).join(",");
        drawGlow(glowSprite("front" + pcol, [[0, pcol, 0], [0.75, pcol, 1], [1, pcol, 0]], 0.66), ix, iy, Ro, Ro * 0.62, 0.32 * (1 - su));
      }
    });
    rift.parts.forEach(function (p) {
      ctx.fillStyle = "rgba(" + p.c.join(",") + "," + Math.min(1, p.life).toFixed(3) + ")";
      ctx.fillRect((p.x - camX) * E, (p.y - camY) * E, p.size || 2, p.size || 2);
    });
    if (rift.ring > 0) {
      var cx0 = (ARENA.x - camX) * E, cy0 = (ARENA.y - 34 - camY) * E, rad = (1 - rift.ring) * 320 + 20;
      drawGlow(glowSprite("ring", [[0, "200,190,210", 0], [0.8, "200,190,210", 1], [1, "200,190,210", 0]], 0.8), cx0, cy0, rad + 8, (rad + 8) * 0.6, 0.3 * rift.ring);
    }
    ctx.restore();
    // black holes at the hearts of the fresh collisions, and the white-out
    (rift.novas || []).forEach(function (n) {
      var u = n.t / n.dur; if (u < 0.25 || u > 0.7 || qTier > 0) return;
      var ix = (n.x - camX) * E, iy = (n.y - camY) * E, br = Math.sin((u - 0.25) / 0.45 * Math.PI) * 10 * n.R * E / 3 * 1.8;
      drawGlow(glowSprite("hole", [[0, "0,0,0", 0.95], [0.5, "0,0,0", 0.7], [1, "0,0,0", 0]]), ix, iy, br * 2, br * 2, 1);
    });
    whiteout(Math.min(1, rift.flash || 0));
  }

  /* ════════ realities ════════
     when the orbs clash, reality tears. each hit rips a circle open from the point of impact
     and the island underneath is somewhere else:
       dino    the jurassic island you walked in on
       future  a neon arcology: every tree a lit tower, roads of light, flying cars, a violet night
       chaos   ink and noise: white paper, a black nervous system of tangled lines and spheres,
               flickering neural connections, grain everywhere
     when a winner is crowned, the tear closes and the island comes back. the art for the other
     realities is built from the island's own sprites the first time it's needed. */
  var reality = { cur: "dino", wipe: null, glitch: 0 }, REAL = "dino";
  var SKINS = { future: ["#03050f", "#070b22", "#0d1238", "#161a52", "#24206e", "#3c2388", "#7a2a9e", "#29b8ff", "#8af0ff", "#e8fdff"], chaos: ["#000000", "#060606", "#0e0e0e", "#161616", "#e9e5dc", "#ffffff"] };
  var skinCache = typeof Map !== "undefined" ? new Map() : null;
  function duotone(src, ramp, contrast) {
    var w = src.width, h = src.height, c = mkCanvas(); c.width = w; c.height = h;
    var g = c.getContext("2d"); g.drawImage(src, 0, 0);
    var im = g.getImageData(0, 0, w, h), d = im.data, rgb = ramp.map(function (hx) { var n = parseInt(hx.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; });
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var L = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      L = Math.max(0, Math.min(0.999, (L - 0.5) * contrast + 0.5));
      var q = rgb[Math.floor(L * rgb.length)]; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  function skin(c) {
    if (REAL === "dino" || !skinCache) return c;
    var e = skinCache.get(c); if (!e) { e = {}; skinCache.set(c, e); }
    if (!e[REAL]) e[REAL] = duotone(c, SKINS[REAL], REAL === "chaos" ? 2.4 : 1.25);
    return e[REAL];
  }
  var realGrounds = {};
  function realGround(R) {
    if (realGrounds[R]) return realGrounds[R];
    var c, g, i, x, y;
    if (R === "future") {
      c = duotone(ground, SKINS.future, 1.1); g = c.getContext("2d");
      // circuitry: a faint grid on the land, traces along tile edges, glowing vias, light-strip roads
      for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) {
        var tt = GROUND[y * MW + x], X = x * T, Y = y * T;
        if (!land(tt)) continue;
        g.fillStyle = "rgba(41,216,255,.08)"; g.fillRect(X, Y, T, 1); g.fillRect(X, Y, 1, T);
        if (tt === PATH || tt === BRIDGE) { g.fillStyle = "rgba(255,79,160,.55)"; if ((x + y) % 2) g.fillRect(X + 6, Y + 7, 4, 1); g.fillStyle = "rgba(41,216,255,.35)"; g.fillRect(X, Y, T, 1); continue; }
        var h = hash(x * 5, y * 7);
        if (h < 0.35) { g.fillStyle = "rgba(41,216,255,.45)"; if (h < 0.18) g.fillRect(X, Y + 8, T, 1); else g.fillRect(X + 8, Y, 1, T); g.fillStyle = "#c8fdff"; g.fillRect(X + 7, Y + 7, 2, 2); }
      }
    } else {
      c = mkCanvas(); c.width = ground.width; c.height = ground.height; g = c.getContext("2d");
      g.fillStyle = "#ece8df"; g.fillRect(0, 0, c.width, c.height);
      var paper = duotone(ground, ["#b8b4ab", "#d4d0c7", "#e6e2d8", "#ece8df"], 1.4);
      g.globalAlpha = 0.35; g.drawImage(paper, 0, 0); g.globalAlpha = 1; freeCanvas(paper);
      // a nervous system in ink: hundreds of tangled strands pouring out of the arena
      var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      g.lineCap = "round";
      for (i = 0; i < 900; i++) {
        var a = rnd() * 6.283, len = 60 + rnd() * rnd() * 900, bend = (rnd() - 0.5) * 2.2, sx = ARENA.x + (rnd() - 0.5) * 60, sy = ARENA.y + (rnd() - 0.5) * 40;
        g.strokeStyle = "rgba(0,0,0," + (0.25 + rnd() * 0.75).toFixed(2) + ")"; g.lineWidth = 0.4 + rnd() * rnd() * 3.2;
        g.beginPath(); g.moveTo(sx, sy);
        g.bezierCurveTo(sx + Math.cos(a + bend) * len * 0.35, sy + Math.sin(a + bend) * len * 0.35, sx + Math.cos(a - bend) * len * 0.7, sy + Math.sin(a - bend) * len * 0.7, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g.stroke();
      }
      for (i = 0; i < 70; i++) {                               // spheres: some void-black with star specks, some pale and hatched
        var cx = rnd() * c.width, cy = rnd() * c.height, rr = 4 + rnd() * rnd() * 70;
        g.beginPath(); g.arc(cx, cy, rr, 0, 6.283);
        if (rnd() < 0.5) { g.fillStyle = "#050505"; g.fill(); g.fillStyle = "#ece8df"; for (var sp = 0; sp < rr; sp++) g.fillRect(cx + (rnd() - 0.5) * rr * 1.4, cy + (rnd() - 0.5) * rr * 1.4, 1, 1); g.strokeStyle = "rgba(236,232,223,.5)"; g.beginPath(); g.arc(cx, cy, rr * 0.7, rnd() * 6, rnd() * 6 + 2); g.stroke(); }
        else { g.fillStyle = "#f7f4ee"; g.fill(); g.strokeStyle = "#111"; g.lineWidth = 1; g.stroke(); for (var hl = 0; hl < 6; hl++) { g.beginPath(); g.arc(cx + rr * 0.2, cy + rr * 0.2, rr * (0.3 + hl * 0.12), 3.4, 5.2); g.stroke(); } }
      }
      for (i = 0; i < 5000; i++) { g.fillStyle = rnd() < 0.8 ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.8)"; g.fillRect(rnd() * c.width, rnd() * c.height, 1, 1); }
    }
    realGrounds[R] = c;
    return c;
  }
  // in the future, every tree is a tower
  var TOWERS = null;
  function towers() {
    if (TOWERS) return TOWERS;
    TOWERS = [0, 1, 2, 3, 4, 5].map(function (n) {
      var w = 14 + (n % 3) * 5, h = 44 + n * 11;
      return outline(sprite(w, h, function (r) {
        r(0, 6, w, h - 6, "#0c0f26"); r(0, 6, 2, h - 6, "#1a1f48"); r(w - 2, 6, 2, h - 6, "#06081a");
        for (var y2 = 9; y2 < h - 4; y2 += 3) for (var x2 = 3; x2 < w - 3; x2 += 3) if (hash(x2 + n * 50, y2) < 0.55) r(x2, y2, 2, 1, ["#29d8ff", "#ff4fa0", "#ffe07a", "#c8fdff"][(hash(y2, x2 + n) * 4) | 0]);
        r(0, 6, w, 1, "#29d8ff"); r(Math.floor(w / 2), 0, 1, 6, "#8a93a8"); r(Math.floor(w / 2) - 1, 0, 3, 1, "#ff5252");
        r(0, h - 3, w, 3, "#ff4fa0");
      }), "rgba(0,0,0,.9)");
    });
    return TOWERS;
  }
  var cars = [], TRAILS = {};
  function trailSprite(col) {
    if (TRAILS[col]) return TRAILS[col];
    var c = mkCanvas(); c.width = 26; c.height = 1; var g = c.getContext("2d"), gr = g.createLinearGradient(26, 0, 0, 0);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 26, 1);
    return (TRAILS[col] = c);
  }
  function drawFuture(E, VW, VH) {
    // flying traffic in lanes across the view
    if (!cars.length) for (var i = 0; i < 16; i++) cars.push({ lane: i % 8, off: rand() * 400, v: (i % 2 ? 1 : -1) * (60 + rand() * 60), c: ["#29d8ff", "#ff4fa0", "#ffe07a"][i % 3] });
    cars.forEach(function (cr) {
      var span = VW + 80, x = camX - 40 + ((((cr.off + t * cr.v) % span) + span) % span), y = camY + 20 + cr.lane * (VH - 40) / 8;
      ctx.fillStyle = cr.c; ctx.fillRect(Math.round(x), Math.round(y), 5, 2);
      var trs = trailSprite(cr.c);
      ctx.globalAlpha = 0.6;
      if (cr.v > 0) ctx.drawImage(trs, Math.round(x - 26), Math.round(y), 26, 1); else { ctx.save(); ctx.translate(Math.round(x + 26), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(trs, 0, 0, 26, 1); ctx.restore(); }
      ctx.globalAlpha = 1;
      light(x, y, 10, cr.c === "#29d8ff" ? "41,216,255" : cr.c === "#ff4fa0" ? "255,79,160" : "255,224,122", 0.6);
    });
  }
  var nodes = null;
  function drawChaosNet(E) {
    // a neural net over the ink: nodes, flickering connections, pulses running along them
    if (!nodes) { nodes = []; for (var i = 0; i < 70; i++) { var a = rand() * 6.283, d = 30 + rand() * 520; nodes.push({ x: ARENA.x + Math.cos(a) * d * 1.3, y: ARENA.y + Math.sin(a) * d * 0.8, r: 1 + rand() * 3 }); } nodes.forEach(function (n) { n.to = nodes.slice().sort(function (p2, q2) { return Math.hypot(p2.x - n.x, p2.y - n.y) - Math.hypot(q2.x - n.x, q2.y - n.y); }).slice(1, 4); }); }
    ctx.lineWidth = 0.6;
    nodes.forEach(function (n, i) {
      n.to.forEach(function (m, j) {
        var fl = Math.sin(t * 7 + i * 1.3 + j) * 0.5 + 0.5; if (fl < 0.3) return;
        ctx.strokeStyle = "rgba(0,0,0," + (fl * 0.8).toFixed(2) + ")"; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        var u = (t * 0.8 + i * 0.13 + j * 0.3) % 1; ctx.fillStyle = (i + j) % 5 ? "#000" : "#d0142c"; ctx.fillRect(n.x + (m.x - n.x) * u - 1, n.y + (m.y - n.y) * u - 1, 2, 2);
      });
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + Math.sin(t * 3 + i) * 0.6, 0, 6.283); ctx.fill();
    });
  }
  function realityGrade(R) {
    // screen-space finishing for each reality (drawn inside the tear's clip)
    if (R === "future") {
      ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(120,40,255,.35)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(41,216,255,.05)"; for (var y = (t * 40) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    } else if (R === "chaos") {
      for (var i = 0; i < 700; i++) { ctx.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.55)"; ctx.fillRect(rand() * W, rand() * H, 1 + (rand() < 0.1 ? 2 : 0), 1); }
      if (rand() < 0.04) invertFlash();
    }
  }
  // the tear isn't a circle: a jagged, rotating star of a hole, its points flickering
  function tearPath(cx, cy, r, seed) {
    var n = 72, s0 = (seed | 0) % 97; ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = i / n * 6.283, k2 = 1 + 0.1 * Math.sin(a * 3 + s0 + t * 1.3) + 0.06 * Math.sin(a * 7 - s0 * 0.7 - t * 2.1) + 0.03 * Math.sin(a * 13 + t * 4);
      var px = cx + Math.cos(a) * r * k2, py = cy + Math.sin(a) * r * k2 * 0.9;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  var lens = null;
  function drawLens(E) {
    // gravitational lensing: the frame around the impact bulges outward, then settles
    if (!lens || REDUCED) return;
    lens.t += 1 / 60; if (lens.t > 0.7) { lens = null; return; }
    var u = lens.t / 0.7, k3 = 0.22 * (1 - u), lx = (lens.x - camX) * E * dpr, ly = (lens.y - camY) * E * dpr, R = (40 + u * 160) * E * dpr / 3;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.arc(lx, ly, R, 0, 6.283); ctx.clip();
    var sz = R * 2 / (1 + k3); ctx.drawImage(cv, lx - sz / 2, ly - sz / 2, sz, sz, lx - R, ly - R, R * 2, R * 2);
    ctx.restore();
  }
  function shiftReality(to, x, y) {
    if (to === reality.cur) return;
    reality.wipe = { from: reality.cur, x: x, y: y, r: 0, seed: (frand() * 1000) | 0 };
    reality.cur = to; reality.glitch = 0.35;
    sfx("warp");
  }
  /* the other realities' art is built the first time it's needed and let go once the island is
     itself again (the fight over and the tear closed): the future and chaos grounds alone are
     about 8 MB each, and ios quietly blanks canvases past its memory limit */
  function freeSkins() {
    if (skinCache) { skinCache.forEach(function (e) { Object.keys(e).forEach(function (k2) { freeCanvas(e[k2]); }); }); skinCache.clear(); }
    Object.keys(realGrounds).forEach(function (k2) { freeCanvas(realGrounds[k2]); }); realGrounds = {};
  }
  function updateReality(dt) {
    if (reality.wipe) { reality.wipe.r += dt * (240 + reality.wipe.r * 2.2); if (reality.wipe.r > 1400) { reality.wipe = null; if (reality.cur === "dino" && !riftBusy()) freeSkins(); } }
    reality.glitch = Math.max(0, reality.glitch - dt);
  }
  function glitchSlices() {
    // tear the frame: shove a few horizontal bands sideways and split the colour channels
    var n = 5 + ((rand() * 6) | 0);
    for (var i = 0; i < n; i++) {
      var sy = rand() * cv.height, sh = 4 + rand() * 40 * dpr, dx = (rand() - 0.5) * 60 * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, 0, sy, cv.width, sh, dx, sy, cv.width, sh);
    }
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25; ctx.drawImage(cv, 6 * dpr, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ════════ rooms ════════
     some buildings open up. walk to a door and press e: the island fades and you're inside,
     a small room drawn to its own scale, with a back wall, a floor, furniture you can bump
     into and things you can look at. the bunker at the outpost holds the tech: the homelab
     rack and the triage desk live in there now. walk back out through the door. */
  var ROOMS = {
    bunker: { name: "the bunker", w: 15, h: 9, floor: ["#3a3c3a", "#464946", "#525551", "#5e615c"], wall: ["#2a2c2e", "#34373a", "#404448"], trim: "#f2c230", door: 7, light: "255,214,150",
      items: [
        { kind: "station", id: "rack", x: 2, y: 3 }, { kind: "station", id: "desk", x: 6, y: 3 },
        { kind: "screens", x: 10, y: 1, w: 4, h: 1, say: "a wall of monitors: Grafana panels, an Uptime Kuma board all green, and a log tail scrolling too fast to read." },
        { kind: "shelf", x: 13, y: 3, w: 1, h: 3, say: "supplies: canned beans, rice, water jugs, spare SD cards, a label maker. survival, homelab edition." },
        { kind: "cot", x: 1, y: 6, w: 2, h: 1, say: "a cot and a sleeping bag. somebody's been pulling all-nighters out here." },
        { kind: "table", x: 6, y: 6, w: 3, h: 1, say: "a map table. the island's drawn on it in marker, with the paddocks circled twice." },
        { kind: "gen", x: 11, y: 6, w: 2, h: 1, say: "a UPS bank and a battery wall. if the island loses power, the DNS doesn't." },
        { kind: "radio", x: 9, y: 3, say: "a shortwave radio. mostly static. its little display keeps scrolling:\nZmxhZ3tqdXN0X2VuY29kZWR9\nonce, very faintly, something that sounds like an orb humming." }   // cspell:disable-line
      ] },
    visitor: { name: "the visitor centre", w: 13, h: 8, floor: ["#6e4a2a", "#7e5836", "#8e6640", "#9e744a"], wall: ["#3a2616", "#553820", "#6e4a2a"], trim: "#b8321f", door: 6, light: "255,224,170",
      items: [
        { kind: "skull", x: 2, y: 2, w: 2, h: 2, say: "a t-rex skull on a plinth. the plaque says it's a cast. the teeth look very real." },
        { kind: "mapwall", x: 5, y: 1, w: 3, h: 1, say: "a map of the island with eight pins in it. the ones you've found are lit." },
        { kind: "counter", x: 9, y: 3, w: 3, h: 1, say: "the front desk. a bell, a stack of brochures, and a sign: 'back in 5 min. -the gardener bot'." },
        { kind: "plush", x: 10, y: 5, w: 2, h: 1, say: "the gift shop. plush pi, plush raptor, and a mug that says I SURVIVED PI'S ISLAND." },
        { kind: "bench", x: 2, y: 5, w: 2, h: 1, say: "a bench for waiting out the rain." }
      ] },
    depot: { name: "the supply depot", w: 11, h: 7, floor: ["#3e454c", "#4a525a", "#565e66", "#626a72"], wall: ["#2c3238", "#3a4046", "#4a5258"], trim: "#f2c230", door: 5, light: "230,240,255",
      items: [
        { kind: "crates", x: 1, y: 2, w: 2, h: 2, say: "crates, stacked to the ceiling. the labels say EGGS: FRAGILE, SD CARDS, and one just says ???" },
        { kind: "crates", x: 8, y: 2, w: 2, h: 1, say: "more crates. the cargo bots keep them in perfect rows." },
        { kind: "bench2", x: 4, y: 2, w: 3, h: 1, say: "a drone workbench: rotors, a soldering iron, and one drone with a sticker that says 'not a bird'." },
        { kind: "charger", x: 8, y: 4, w: 2, h: 1, say: "a charging dock for the cargo bots. one is plugged in, snoring in beeps." }
      ] }
  };
  var room = null, roomFrom = null, roomTap = null;
  function roomSolid(R, tx, ty) {
    if (tx < 1 || tx > R.w - 2 || ty < 2 || ty > R.h - 1) return !(ty === R.h - 1 && tx === R.door) || ty > R.h - 1;
    if (ty === R.h - 1) return tx !== R.door;
    return R.items.some(function (it) { var w = it.w || (it.kind === "station" && it.id === "desk" ? 3 : 1), h = it.h || 1, x0 = it.kind === "station" && it.id === "desk" ? it.x - 1 : it.x; return tx >= x0 && tx < x0 + w && ty >= it.y && ty < it.y + h; });
  }
  function enterRoom(name, spot) {
    var R = ROOMS[name]; if (!R) return;
    if (car.driving) toggleCar();
    roomFrom = { x: pi.x, y: pi.y, name: name };
    room = R; room.id = name; fade = 0;
    pi.x = (spot ? spot[0] : R.door) * T + 8; pi.y = (spot ? spot[1] : R.h - 2) * T + 10; pi.vx = pi.vy = 0; pi.path = null; keys = {};
    sfx("open");
  }
  /* the iris: a circle closing on pi (300 ms), the cut, then opening again (300 ms), with the
     music swept down to a muffle and back. doors, fast travel, the shrine and landing all use it */
  var iris = null, IRIS = 0.3;
  /* doors are quicker: 150 ms closing, 170 ms opening, no hold on black. fast travel and the
     shrine keep 300 + 300. under reduced motion every transition is a 150 ms crossfade instead */
  var DOOR_CLOSE = 0.15, DOOR_OPEN = 0.17, XFADE = 0.15, xfade = null;
  function irisTo(fn, close, opn, pre) {
    if (!open) { if (fn) fn(); return; }
    if (REDUCED) {                                                    // snapshot the frame, cut, fade the snapshot out
      if (xfade) freeCanvas(xfade.img);
      var snap = mkCanvas(); snap.width = cv.width; snap.height = cv.height; snap.getContext("2d").drawImage(cv, 0, 0);
      xfade = { img: snap, t0: performance.now() }; if (pre) roomBgStep(pre, 1e9); if (fn) fn(); return;
    }
    if (iris) { if (iris.fn) { var f0 = iris.fn; iris.fn = null; f0(); } iris.t0 = performance.now() - iris.c * 1000; if (fn) fn(); return; }
    iris = { t0: performance.now(), fn: fn || null, c: close || IRIS, o: opn || IRIS, pre: pre || null }; keys = {};
    if (SND && SND.muffle) SND.muffle(1, iris.c);
  }
  function irisOpen() { if (REDUCED) return; iris = { t0: performance.now() - IRIS * 1000, fn: null, c: IRIS, o: IRIS }; if (SND && SND.muffle) { SND.muffle(1, 0.01); SND.muffle(0, IRIS * 1.3); } }
  function irisBusy() { return !!iris && performance.now() - iris.t0 < iris.c * 1000; }        // closing: hold the controls
  function drawIris(cx, cy) {
    if (xfade) {
      var a = 1 - (performance.now() - xfade.t0) / 1000 / XFADE;
      if (a <= 0) { freeCanvas(xfade.img); xfade = null; }
      else { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(xfade.img, 0, 0); ctx.restore(); }
    }
    if (!iris) return;
    var u = (performance.now() - iris.t0) / 1000, C = iris.c, O = iris.o;
    if (stepIn) pi.y = stepIn.y - 4 * Math.min(1, (performance.now() - stepIn.t0) / 1000 / DOOR_CLOSE);   // pi steps into the doorway
    if (u < C && iris.pre) roomBgStep(iris.pre, 5);                   // finish the room while the circle closes
    if (u >= C && iris.fn) { var f = iris.fn; iris.fn = null; if (iris.pre) roomBgStep(iris.pre, 1e9); f(); if (SND && SND.muffle) SND.muffle(0, O * 1.3); }
    if (u >= C + O) { iris = null; return; }
    var k0 = u < C ? 1 - u / C : (u - C) / O, e = k0 * k0 * (3 - 2 * k0), R = Math.hypot(W, H) * e;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0, R), 0, Math.PI * 2, true); ctx.fill("evenodd");   // a true 2π: 6.283 anticlockwise drew a sliver, so the hole was missing and the screen went solid black
    ctx.restore();
  }
  function exitRoom() {
    var bd = BUILDINGS.filter(function (q) { return q.room === room.id; })[0];
    room = null; sfx("open");
    pi.x = (bd.x0 + bd.w / 2) * T; pi.y = (bd.y0 + bd.h) * T + 6; pi.vx = pi.vy = 0; pi.dir = "down"; camF.x = null;   // in the doorway, facing out
    doorAnim = { bd: bd, t0: performance.now() + DOOR_OPEN * 1000, open: false };                            // it swings shut once the circle is open
  }
  /* doors: hinged ones swing in, the depot's roller rolls up. x, y, w, h in the building sprite */
  var DOORS = { visitor: [29, 33, 10, 17, "hinge"], bunker: [29, 21, 12, 21, "hinge"], depot: [14, 26, 24, 18, "roller"] };
  var doorAnim = null, stepIn = null;
  function drawDoor(bd, bx, by) {
    var D = DOORS[bd.id]; if (!D || !doorAnim || doorAnim.bd !== bd) return;
    var k = Math.max(0, Math.min(1, (performance.now() - doorAnim.t0) / 1000 / 0.15)), o = doorAnim.open ? k : 1 - k;
    if (!doorAnim.open && k >= 1) { doorAnim = null; return; }
    var x = bx + D[0], y = by + D[1], w = D[2], h = D[3];
    ctx.fillStyle = "#140e0a"; ctx.fillRect(x, y, w, h);                              // the dark inside
    ctx.fillStyle = "rgba(255,210,140,.18)"; ctx.fillRect(x + 1, y + h - 4, w - 2, 4);  // lamplight on the threshold
    if (D[4] === "roller") { ctx.fillStyle = "#7a838b"; ctx.fillRect(x, y, w, Math.round(h * (1 - o))); }
    else { var pw = Math.max(1, Math.round(w * (1 - 0.8 * o))); ctx.fillStyle = bd.id === "bunker" ? "#4a5058" : "#f2d58a"; ctx.fillRect(x, y, pw, h); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x + pw - 1, y, 1, h); }
  }
  /* each room's floor and walls are drawn once into a canvas, a few rows at a time: starting when
     pi is within 3 tiles of its door, and finishing while the iris closes, so nothing heavy runs
     on the frames around the cut */
  function roomBgStep(R, budgetMs) {
    if (R._bg && R._bgDone) return;
    var t0b = performance.now();
    if (!R._bg) { R._bg = mkCanvas(); R._bg.width = R.w * T; R._bg.height = R.h * T; R._bgRow = 0; }
    var g = R._bg.getContext("2d");
    while (R._bgRow < R.h && performance.now() - t0b < budgetMs) {
      var ty = R._bgRow++;
      for (var tx = 0; tx < R.w; tx++) for (var j = 0; j < T; j += 2) for (var i = 0; i < T; i += 2) {
        var X = tx * T + i, Y = ty * T + j;
        if (ty >= 2) { var seam = (i === 0 || j === 0) ? -0.18 : 0; g.fillStyle = tone(0.5 + seam + (hash(X, Y) - 0.5) * 0.25, R.floor, X, Y); }
        else g.fillStyle = tone(0.35 + (Y / 32) * 0.4 + (hash(X >> 2, Y >> 2) - 0.5) * 0.15, R.wall, X, Y);
        g.fillRect(X, Y, 2, 2);
      }
    }
    if (R._bgRow >= R.h) {
      g.fillStyle = R.trim; g.fillRect(0, 2 * T - 2, R.w * T, 2);
      g.fillStyle = R.wall[0]; g.fillRect(0, 0, T * 0.5, R.h * T); g.fillRect(R.w * T - T * 0.5, 0, T * 0.5, R.h * T); g.fillRect(0, (R.h - 1) * T + 6, R.door * T, 10); g.fillRect((R.door + 1) * T, (R.h - 1) * T + 6, (R.w - R.door - 1) * T, 10);
      g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(R.door * T + 2, (R.h - 1) * T, T - 4, T);
      R._bgDone = true;
    }
  }
  var fade = 0;
  function roomMove(o, dx, dy) {
    var hw = 4;
    // the door is one tile wide: heading down near it, pi is steered into the doorway
    var dcx = room.door * T + 8;
    if (dy > 0 && Math.floor(o.y / T) >= room.h - 3 && Math.abs(o.x - dcx) < 14 && Math.abs(o.x - dcx) > 0.5) { var ax0 = Math.max(-1.2, Math.min(1.2, dcx - o.x)); if (!roomSolid(room, Math.floor((o.x + ax0 + (ax0 > 0 ? hw : -hw)) / T), Math.floor(o.y / T))) o.x += ax0; }
    function hit(px, py) { return roomSolid(room, Math.floor(px / T), Math.floor(py / T)); }
    if (dx && !hit(o.x + dx + (dx > 0 ? hw : -hw), o.y - 2) && !hit(o.x + dx + (dx > 0 ? hw : -hw), o.y + 1)) o.x += dx;
    if (dy && !hit(o.x - hw, o.y + dy + (dy > 0 ? 1 : -2)) && !hit(o.x + hw, o.y + dy + (dy > 0 ? 1 : -2))) o.y += dy;
    if (Math.floor(o.y / T) >= room.h - 1 && dy > 0 && !iris) irisTo(function () { if (room) exitRoom(); }, DOOR_CLOSE, DOOR_OPEN);      // out through the door
  }
  function roomCandidates() {
    var out = [];
    room.items.forEach(function (it) {
      var w = it.w || (it.id === "desk" ? 3 : 1), cx = (it.kind === "station" && it.id === "desk" ? it.x - 1 : it.x) * T + w * T / 2, cy = (it.y + (it.h || 1)) * T;
      var v = it.kind === "station" ? STATIONS.filter(function (q) { return q.id === it.id; })[0] : { id: "roomitem", name: room.name, text: it.say };
      out.push({ d: Math.hypot(pi.x - cx, pi.y - cy), max: 22, v: v.id === "roomitem" ? v : Object.assign({}, v, { ax: cx, ay: it.y * T - 4 }) });
      if (v.id === "roomitem") { v.ax = cx; v.ay = it.y * T - 4; }
    });
    return out;
  }
  function drawRoomItem(it) {
    var X = it.x * T, Y = it.y * T, w = (it.w || 1) * T, h = (it.h || 1) * T, i;
    function r(x, y, ww, hh, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), ww, hh); }
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(X + 1, Y + h - 2, w - 2, 3);
    if (it.kind === "station") {
      var sp = SPR[it.id]; drawStationArt(it.id, sp, it.x * T + 8, it.y * T + 15); return;
    }
    if (it.kind === "screens") { for (i = 0; i < 4; i++) { r(X + i * 16 + 1, Y - 10, 14, 11, "#15181c"); r(X + i * 16 + 2, Y - 9, 12, 9, i === 1 ? "#0c2418" : "#0a1420"); ctx.strokeStyle = i === 1 ? "#4ADE80" : "#4DD6E8"; ctx.beginPath(); for (var j = 0; j < 12; j++) { var gy = Y - 5 - Math.round((Math.sin(t * 2 + j * 0.7 + i) * 0.5 + 0.5) * 3); j ? ctx.lineTo(X + i * 16 + 2 + j, gy + 0.5) : ctx.moveTo(X + i * 16 + 2, gy + 0.5); } ctx.stroke(); } light(X + w / 2, Y - 4, 30, "77,214,232", 0.5); return; }
    if (it.kind === "shelf") { r(X, Y - 14, w, h + 14, "#5a3a1e"); for (i = 0; i < 4; i++) { r(X + 1, Y - 12 + i * 12, w - 2, 1, "#3a2616"); for (var c2 = 0; c2 < 3; c2++) r(X + 2 + c2 * 4, Y - 17 + i * 12, 3, 4, ["#c8a038", "#4f8fff", "#d64545", "#e8e8e8"][(c2 + i) % 4]); } return; }
    if (it.kind === "cot") { r(X, Y + 2, w, 10, "#4a5a30"); r(X, Y + 2, w, 2, "#6e8246"); r(X + 2, Y + 3, 8, 5, "#e8e0cc"); r(X + 1, Y + 12, 2, 3, "#2a2c2a"); r(X + w - 3, Y + 12, 2, 3, "#2a2c2a"); return; }
    if (it.kind === "table") { r(X, Y, w, 12, "#7a5230"); r(X, Y, w, 1, "#9a6c40"); r(X + 4, Y + 2, w - 8, 8, "#d8c89a"); ctx.fillStyle = "#4f9a3e"; ctx.beginPath(); ctx.ellipse(X + w / 2, Y + 6, w / 2 - 8, 3, 0, 0, 6.283); ctx.fill(); r(X + w / 2 - 6, Y + 5, 2, 2, "#d64545"); r(X + w / 2 + 4, Y + 4, 2, 2, "#d64545"); return; }
    if (it.kind === "gen") { r(X, Y - 6, w, h + 4, "#3a3c3a"); for (i = 0; i < 6; i++) r(X + 2 + i * 5, Y - 4, 3, 10, i % 2 ? "#4ADE80" : "#2a5a3a"); r(X + 2, Y - 5, w - 4, 1, "#686b66"); return; }
    if (it.kind === "radio") { r(X + 2, Y + 2, 12, 9, "#3a3c3a"); r(X + 3, Y + 3, 5, 4, "#c8a038"); r(X + 10, Y + 4, 2, 2, "#8a8e92"); r(X + 12, Y - 6, 1, 8, "#8a8e92"); if (Math.floor(t * 2) % 2) r(X + 4, Y + 8, 2, 1, "#ff5252"); return; }
    if (it.kind === "skull") { r(X + 4, Y + 10, w - 8, 16, "#6e6a62"); r(X + 4, Y + 10, w - 8, 1, "#8d887e"); r(X + 2, Y - 2, w - 4, 12, "#e8e0cc"); r(X + 2, Y - 2, w - 4, 2, "#f6f0e2"); r(X + 8, Y + 1, 4, 3, "#2a2420"); r(X + 18, Y + 3, 8, 2, "#2a2420"); for (i = 0; i < 6; i++) r(X + 14 + i * 2, Y + 8, 1, 2, "#f6f0e2"); return; }
    if (it.kind === "mapwall") { r(X, Y - 12, w, 14, "#d8c89a"); r(X, Y - 12, w, 1, "#8a7a50"); ctx.fillStyle = "#4f9a3e"; ctx.beginPath(); ctx.ellipse(X + w / 2, Y - 5, w / 2 - 4, 5, 0, 0, 6.283); ctx.fill(); var pins = STATIONS.filter(function (q) { return q.found; }); pins.forEach(function (q, n) { r(X + 6 + n * 4.5, Y - 7 + (n % 3) * 2, 2, 2, found[q.id] ? "#4DD6E8" : "#5a5a5a"); }); return; }
    if (it.kind === "counter" || it.kind === "bench2") { r(X, Y - 2, w, 12, it.kind === "counter" ? "#8a5a33" : "#4a525a"); r(X, Y - 2, w, 2, it.kind === "counter" ? "#b8845a" : "#6a737b"); if (it.kind === "counter") { r(X + 6, Y - 5, 3, 3, "#c8a038"); r(X + 20, Y - 6, 8, 4, "#f4f4f4"); } else { r(X + 5, Y - 6, 10, 4, "#3a4048"); r(X + 3, Y - 7, 3, 1, "#9aa6b2"); r(X + 15, Y - 7, 3, 1, "#9aa6b2"); r(X + 30, Y - 5, 6, 3, "#c8a038"); } return; }
    if (it.kind === "plush") { r(X, Y - 4, w, 14, "#6e4a2a"); [[3, "#f4f4f4"], [11, "#7a2a1e"], [19, "#3f8a3a"], [25, "#f454a6"]].forEach(function (q) { r(X + q[0], Y - 9, 5, 5, q[1]); r(X + q[0] + 3, Y - 8, 1, 1, "#141414"); }); return; }
    if (it.kind === "bench") { r(X, Y + 2, w, 5, "#8a5a33"); r(X, Y + 2, w, 1, "#b8845a"); r(X + 2, Y + 7, 2, 5, "#5a3a1e"); r(X + w - 4, Y + 7, 2, 5, "#5a3a1e"); return; }
    if (it.kind === "crates") { for (var cy = 0; cy < (it.h || 1) * 2; cy++) for (var cx = 0; cx < (it.w || 1) * 2; cx++) { var qx = X + cx * 8, qy = Y + h - 8 - cy * 8 - 6; r(qx, qy, 8, 8, "#a0703e"); r(qx, qy, 8, 1, "#c89458"); r(qx + 3, qy + 1, 1, 7, "#7a5230"); r(qx, qy + 7, 8, 1, "#5a3a1e"); } return; }
    if (it.kind === "charger") { r(X, Y - 4, w, 12, "#2c3238"); r(X + 2, Y - 2, 4, 3, "#4ADE80"); r(X + 10, Y + 2, 16, 8, "#9aa6b2"); r(X + 12, Y + 3, 2, 2, "#4DD6E8"); r(X + 18, Y + 3, 2, 2, "#4DD6E8"); return; }
  }
  function renderRoom() {
    var R = room, E = crisp(Math.max(2, Math.min(5, Math.floor(Math.min(W / (R.w * T + 40), H / (R.h * T + 60))))));
    var ox = (W / E - R.w * T) / 2, oy = (H / E - R.h * T) / 2 + 10;
    camX = -ox; camY = -oy;
    ctx.setTransform(E * dpr, 0, 0, E * dpr, ox * E * dpr, oy * E * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#07080a"; ctx.fillRect(-ox, -oy, W / E, H / E);
    lights = []; beamAt = null;
    // floor, back wall, side walls and doorway: built once (roomBgStep), drawn as one image
    roomBgStep(R, 1e9); ctx.drawImage(R._bg, 0, 0);
    var i;
    for (i = 2; i < R.w - 1; i += 4) { ctx.fillStyle = "#fff4c2"; ctx.fillRect(i * T + 6, 2, 4, 2); light(i * T + 8, 6, 60, R.light, 0.7); }   // ceiling lamps
    var list = R.items.map(function (it) { return { y: (it.y + (it.h || 1)) * T, f: function () { drawRoomItem(it); } }; });
    list.push({ y: pi.y, f: drawPi });
    list.sort(function (a2, b2) { return a2.y - b2.y; }).forEach(function (o) { o.f(); });
    // interiors are dim and lit by their lamps
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgb(150,146,160)"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(ox * E, oy * E, R.w * T * E, R.h * T * E); ctx.clip();
    var sd = sky.dark; sky.dark = 0.6; drawLights(E); sky.dark = sd;
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    var nb = dlg.hidden ? nearby() : null;
    nearNote(nb);
    if (nb && nb.ax !== undefined) tag(promptText(nb), (nb.ax - camX) * E, (nb.ay - camY) * E - 4 + Math.sin(t * 4) * 2, true);
    tag(R.name, W / 2, oy * E - 14, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 22 - camY) * E, false);
  }

  /* ════════ the other side ════════
     the old shrine up on the highland is a door. step through and the world turns on its
     side: a painted sky, drifting islands, a weeping willow over a hill of standing stones,
     like an old side-scrolling adventure. walk right (jump with space or up) and at the top
     of the steps the first orb is waiting. it speaks, reality tears itself apart, and you
     are thrown out of the island entirely, back to the machine booting up. */
  var side = null, SIDEW = 1700, sideArt = null;
  var DEITY_LINES = [
    "...so the small white thing found the door.",
    "i was here before the orbs. before eclipse and void, before the first line of code that dreamed this island.",
    "every reality you tore open was a skin. the scales, the neon, the ink. i wore them all, and none of them are me.",
    "you think you are walking an island. you are walking a portfolio. you are walking somebody's mind.",
    "go back. start again from nothing. forget me, until you can't."
  ];
  function groundY(x) { return 150 - 14 * Math.sin(x * 0.004 + 1) - 8 * Math.sin(x * 0.011) - (x > 1330 ? Math.min(30, (x - 1330) * 0.35) : 0); }
  function buildSideArt() {
    function hillY(x) { return 118 - 16 * Math.sin(x * Math.PI * 2 / 1400 + 2) - 6 * Math.sin(x * Math.PI * 2 * 5 / 1400); }
    function cloudLayer(w, h, seed, tones, n) {
      var c = mkCanvas(); c.width = w; c.height = h; var g = c.getContext("2d");
      for (var i = 0; i < n; i++) {
        var cx = hash(i, seed) * w, cy = h * (0.25 + hash(seed, i) * 0.6), rr = 14 + hash(i * 3, seed) * 34;
        for (var y = -rr; y < rr; y++) for (var x = -rr * 1.8; x < rr * 1.8; x++) {
          var d = Math.hypot(x / 1.8, y) / rr + (hash((cx + x) >> 2, (cy + y) >> 2) - 0.5) * 0.25; if (d > 1 || y > rr * 0.35) continue;
          g.fillStyle = tone(0.9 - d * 0.35 - (y > 0 ? 0.25 : 0), tones, cx + x, cy + y); g.fillRect(((cx + x) % w + w) % w, cy + y, 1, 1);
        }
      }
      return c;
    }
    function willow(w, h) {
      // a weeping willow: a thick leaning trunk, boughs arching out from the top, and curtains of
      // pale strands hanging almost to the ground, lit from the upper left
      return sprite(w, h, function (r, g) {
        var topX = w * 0.52, topY = h * 0.3;
        for (var y = Math.floor(topY); y < h; y++) {
          var u = (y - topY) / (h - topY), cx = topX + Math.sin(u * 2.6) * 14 - u * 10, tw = 7 + u * 9 + (u > 0.9 ? (u - 0.9) * 60 : 0);
          for (var x = -tw / 2; x < tw / 2; x++) { g.fillStyle = tone(0.7 - (x / tw + 0.5) * 0.6 + (hash(x | 0, y >> 1) - 0.5) * 0.2, ["#2a1a12", "#3e281c", "#5a3c2a", "#76543a"], cx + x, y); g.fillRect(Math.round(cx + x), y, 1, 1); }
        }
        var boughs = [[-1, 0.9], [-0.55, 0.55], [0.4, 0.6], [0.95, 0.85], [0.1, 0.3]];
        boughs.forEach(function (bo) { for (var j = 0; j < 60; j++) { var q = j / 60, bx = topX + bo[0] * q * w * 0.42, by = topY - Math.sin(q * Math.PI * 0.8) * h * 0.18 * bo[1] + q * q * 10; r(Math.round(bx), Math.round(by), 3 - q * 2 + 1, 2, "#3e281c"); } });
        for (var s2 = 0; s2 < 170; s2++) {
          var ang = hash(s2, 4) * 2 - 1, sx = topX + ang * w * 0.44 + (hash(s2, 8) - 0.5) * 20, sy = topY - h * 0.2 + Math.abs(ang) * h * 0.12 + hash(4, s2) * 20, len = h * (0.25 + hash(s2, 9) * 0.45) * (1 - Math.abs(ang) * 0.3);
          for (var k2 = 0; k2 < len; k2++) {
            var v = 0.85 - k2 / len * 0.45 - (sx - topX) / w * 0.35 + (hash(s2, k2 >> 1) - 0.5) * 0.18;
            g.fillStyle = tone(v, ["#5a3e30", "#8a6a4e", "#b8986e", "#dccaa0", "#f2e8cc", "#fffaec"], sx, sy + k2); g.fillRect(Math.round(sx + Math.sin(k2 * 0.12 + s2) * 1.2), Math.round(sy + k2), 2, 1);
          }
        }
      });
    }
    var isle = sprite(170, 180, function (r, g) {                            // (drawn 30px down, so the willow's crown fits)
      var O = 30;
      for (var y = 60; y < 150; y++) { var hw = Math.max(0, (1 - (y - 60) / 90) * 70); for (var x = -hw; x < hw; x++) { g.fillStyle = tone(0.7 - (y - 60) / 90 * 0.5 + (hash(x >> 2, y >> 2) - 0.5) * 0.2 - x / 200, ["#3a3e5a", "#50567a", "#6a7298", "#8a92b4"], x, y); g.fillRect(85 + x, y + O, 1, 1); } }
      for (x = 15; x < 155; x++) { r(x, 57 + O + Math.round(Math.sin(x * 0.2) * 1.5), 1, 5, x % 3 ? "#4a9a3a" : "#6ab84a"); }
      g.drawImage(willow(110, 90), 20, O - 28);
      r(118, 34 + O, 6, 24, "#6a6e84"); r(119, 30 + O, 4, 4, "#8a8ea2");
    });
    var totem = [0, 1, 2].map(function (n) {
      return sprite(20, 44 - n * 8, function (r, g) {
        var h2 = 44 - n * 8;
        for (var y = 0; y < h2; y++) for (var x = 2; x < 18; x++) { g.fillStyle = tone(0.72 - x / 20 * 0.5 + (hash(x, y + n * 50) - 0.5) * 0.15, ["#44485c", "#5a5e76", "#767a92", "#9296ae"], x, y); g.fillRect(x, y, 1, 1); }
        if (n === 0) { g.strokeStyle = "#343848"; g.lineWidth = 2; g.beginPath(); g.arc(10, 10, 4, 0, 6.283); g.stroke(); } else { r(6, 8, 3, 2, "#343848"); r(11, 8, 3, 2, "#343848"); r(7, 14, 6, 1, "#343848"); }
        for (var m = 0; m < 6; m++) r(3 + ((hash(m, n) * 13) | 0), 2 + ((hash(n, m) * (h2 - 4)) | 0), 2, 1, "#4a8a3a");
      });
    });
    // the sky, the hills with their standing stones, and the ground are painted once into long strips
    var sky2 = mkCanvas(); sky2.width = 64; sky2.height = 260; var sg2 = sky2.getContext("2d");
    for (var y = 0; y < 260; y++) for (var x = 0; x < 64; x++) { sg2.fillStyle = tone(0.15 + y / 260 * 0.85, ["#2a4a8a", "#3a6ab0", "#5a9ae0", "#8ac0f4", "#b8dcfa"], x, y); sg2.fillRect(x, y, 1, 1); }
    var hills = mkCanvas(); hills.width = 1400; hills.height = 260; var hg = hills.getContext("2d");
    for (x = 0; x < hills.width; x++) {
      var hy = hillY(x);
      for (y = Math.floor(hy); y < 260; y++) { hg.fillStyle = tone(0.62 - (y - hy) / 70 * 0.45 + (hash(x >> 1, y >> 1) - 0.5) * 0.12, ["#1f4a2a", "#2c6636", "#3c8440", "#58a44a", "#76c05a"], x, y); hg.fillRect(x, y, 1, 1); }
      if (hash(x, 17) < 0.3) { hg.fillStyle = "#6ab84a"; hg.fillRect(x, Math.floor(hy) - 1 - ((hash(x, 5) * 2) | 0), 1, 2); }
    }
    for (var n = 0; n < 9; n++) { var tx2 = 90 + n * 150 + hash(n, 2) * 40, tt2 = totem[n % 3]; hg.drawImage(tt2, Math.round(tx2), Math.round(hillY(tx2 + 10) - tt2.height + 8)); }
    // far mountains, a periodic strip too, cold and hazy
    var mtn = mkCanvas(); mtn.width = 1200; mtn.height = 260; var mg = mtn.getContext("2d");
    for (x = 0; x < mtn.width; x++) {
      var my0 = 96 - 26 * Math.abs(Math.sin(x * Math.PI * 3 / 1200 + 0.4)) - 10 * Math.sin(x * Math.PI * 14 / 1200) - 5 * Math.sin(x * Math.PI * 38 / 1200 + 1);
      for (y = Math.floor(my0); y < 150; y++) { mg.fillStyle = tone(0.5 - (y - my0) / 90 * 0.3 + (hash(x >> 2, y >> 2) - 0.5) * 0.08 + (y - my0 < 3 ? 0.2 : 0), ["#3a4666", "#4a5880", "#5c6c96", "#7888b0"], x, y); mg.fillRect(x, y, 1, 1); }
    }
    var grnd = mkCanvas(); grnd.width = SIDEW; grnd.height = 260; var gg = grnd.getContext("2d");
    for (x = 0; x < SIDEW; x++) {
      var g0 = groundY(x);
      for (y = Math.floor(g0); y < 260; y++) {
        var dd = y - g0, strata = Math.sin((y + Math.sin(x * 0.03) * 3) * 0.45) > 0.85 ? -0.14 : 0, stone = 0;
        gg.fillStyle = dd < 9 ? tone(0.86 - dd / 9 * 0.45 + (hash(x >> 1, y) - 0.5) * 0.2, ["#2f7a34", "#4a9a40", "#6cbc50", "#94d868"], x, y)
          : tone(0.62 - Math.min(1, dd / 110) * 0.42 + strata + stone + (hash(x >> 2, y >> 2) - 0.5) * 0.14, ["#2a1c14", "#3e2a1c", "#584030", "#735840", "#8e7458"], x, y);
        gg.fillRect(x, y, 1, 1);
      }
      if (hash(x, 11) < 0.04) { gg.fillStyle = "#4a3222"; for (var rt = 0; rt < 12; rt++) gg.fillRect(x + Math.round(Math.sin(rt * 0.7) * 2), Math.floor(g0) + 9 + rt, 1, 1); }   // a root
      if (hash(x, 3) < 0.45) { gg.fillStyle = hash(x, 4) < 0.5 ? "#5aac46" : "#7ccc58"; gg.fillRect(x, Math.floor(g0) - 1 - ((hash(x, 6) * 3) | 0), 1, 3); }
      if (hash(x >> 2, 7) < 0.03 && x % 4 === 0) { gg.fillStyle = "#f6f0e0"; gg.fillRect(x - 1, Math.floor(g0) - 4, 3, 1); gg.fillRect(x, Math.floor(g0) - 5, 1, 3); gg.fillStyle = "#ffb060"; gg.fillRect(x, Math.floor(g0) - 4, 1, 1); }
    }
    for (var st = 0; st < 8; st++) { var sx3 = 1330 + st * 12, sy3 = Math.round(groundY(sx3)); gg.fillStyle = "#8a8ea2"; gg.fillRect(sx3, sy3, 12, 3); gg.fillStyle = "#5a5e76"; gg.fillRect(sx3, sy3 + 3, 12, 2); }
    return { sky: sky2, hills: hills, ground: grnd, far: cloudLayer(900, 170, 3, ["#a8c8f0", "#c8def6", "#e4f0fc", "#ffffff"], 26), near: cloudLayer(1100, 190, 9, ["#8ab4e8", "#b4d2f4", "#dceafa", "#ffffff"], 18), isle: isle, willow: willow(190, 150), mtn: mtn, totem: totem, deity: window.Orb ? window.Orb(mkCanvas(), { offscreen: { w: 200, h: 200 }, palette: "void", layers: [[30, 60, 1, 1], [16, 32, 0.8, 0.5]] }) : null };
  }
  function enterSide() {
    if (side || riftBusy()) return;
    settle();
    sideArt = sideArt || buildSideArt();
    side = { x: 60, y: groundY(60), vy: 0, ground: true, face: 1, dist: 0, phase: "walk", t: 0, line: 0, warp: 0 };
    fade = 1; keys = {}; sfx("warp");
    if (SND) SND.music("dread");
  }
  function sideTalk() {
    if (side.line >= DEITY_LINES.length) { side.phase = "warp"; side.t = 0; sfx("warp"); return; }
    say("the first orb", DEITY_LINES[side.line++], []);
    sfx("dash");
  }
  function updateSide(dt) {
    side.t += dt;
    var dread = side.phase === "walk" ? Math.max(0, Math.min(1, (side.x - 600) / 780)) : 1;
    if (SND) SND.intensity(dread);
    if (amb) { amb.aura.set({ vol: 0.04 + dread * 0.22, rate: side.phase === "warp" ? 1 : dread * 0.5 }); hush(["waves", "falls", "rumble", "buzz", "rotor", "engine"]); }
    if (side.phase === "walk") {
      var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      if (side.tap) mx = side.tap;
      side.x = Math.max(20, Math.min(SIDEW - 260, side.x + mx * 72 * dt)); if (mx) { side.face = mx; side.dist += Math.abs(mx) * 72 * dt; }
      if ((keys.u || keys.jump) && side.ground) { side.vy = -190; side.ground = false; sfx("hop"); keys.jump = 0; }
      side.vy += 520 * dt; side.y += side.vy * dt;
      var gy = groundY(side.x); if (side.y >= gy) { side.y = gy; side.vy = 0; side.ground = true; }
      if (side.x > 1330) { side.phase = "talk"; keys = {}; side.tap = 0; sideTalk(); }
    } else if (side.phase === "talk") {
      if (dlg.hidden && !typing) sideTalk();
    } else if (side.phase === "warp") {
      side.warp = Math.min(1, side.t / 4);
      reality.glitch = 0.3; quake = 6 * side.warp;
      if (rand() < dt * 3) sfx("warp");
      if (side.t > 4.2 && !side.done) { side.done = true; throwOut(); }
    }
  }
  function renderSide() {
    var E = crisp(Math.max(2, Math.min(5, Math.floor(Math.min(H / 190, W / 240))))), VW = W / E, VH = H / E;
    var cam = Math.max(0, Math.min(SIDEW - VW, side.x - VW * 0.4)), oy = Math.max(0, VH - 230) * 0.6;
    var shx = (rand() - 0.5) * shakeBy(quake), shy = (rand() - 0.5) * shakeBy(quake);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#2a4a8a"; ctx.fillRect(0, 0, W, oy * E + 1);
    ctx.setTransform(E * dpr, 0, 0, E * dpr, shx * dpr, (shy + oy * E) * dpr); ctx.imageSmoothingEnabled = false; VH -= oy;
    // the sky: a smooth gradient that sinks from a clear afternoon into a bruised dusk as you
    // get closer, and the stars come out over it
    var dk = side.phase === "walk" ? Math.max(0, Math.min(1, (side.x - 760) / 620)) : 1, A = sideArt;
    var skyG = ctx.createLinearGradient(0, 0, 0, 200);
    function mixc(c1, c2, k) { return "rgb(" + c1.map(function (v, i) { return Math.round(v + (c2[i] - v) * k); }).join(",") + ")"; }
    skyG.addColorStop(0, mixc([58, 106, 176], [8, 6, 18], dk)); skyG.addColorStop(0.6, mixc([120, 176, 232], [40, 16, 42], dk)); skyG.addColorStop(1, mixc([190, 222, 248], [96, 34, 44], dk));
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, VW, VH);
    if (dk > 0.3) for (var st2 = 0; st2 < 60; st2++) { var sxs = hash(st2, 1) * VW, sys = hash(1, st2) * 110; ctx.fillStyle = "rgba(230,226,255," + ((dk - 0.3) * (0.5 + 0.5 * Math.sin(t * 2 + st2))).toFixed(2) + ")"; ctx.fillRect(Math.round(sxs), Math.round(sys), 1, 1); }
    function par(img, k, yy) { var off = -((cam * k) % img.width); for (var x = off; x < VW; x += img.width) ctx.drawImage(img, Math.round(x), yy); }
    ctx.globalAlpha = 1 - dk * 0.5; par(A.far, 0.12, 8); ctx.globalAlpha = 1;
    par(A.mtn, 0.2, 0);
    ctx.globalAlpha = 1 - dk * 0.35; par(A.near, 0.28, 40); ctx.globalAlpha = 1;
    ctx.drawImage(A.isle, Math.round(300 - cam * 0.35), -14 + Math.round(Math.sin(t * 0.5) * 3));
    ctx.drawImage(A.isle, Math.round(820 - cam * 0.35), 14 + Math.round(Math.sin(t * 0.4 + 2) * 3));
    par(A.hills, 0.6, 0);
    ctx.drawImage(A.willow, Math.round(1060 - cam * 0.85), Math.round(groundY(1140) - A.willow.height + 10));
    ctx.drawImage(A.ground, -Math.round(cam), 0);
    if (VH > 260) { ctx.fillStyle = "#2a1c14"; ctx.fillRect(0, 259, VW, VH); }
    if (dk > 0) { ctx.fillStyle = "rgba(14,4,16," + (dk * 0.4).toFixed(3) + ")"; ctx.fillRect(0, 0, VW, VH); }      // the whole world dims toward it
    // the first orb. no face: the orb itself. far off it's a slow dark thing; as you close in it
    // turns, in violent jerks, through colours that don't belong together (arterial red, acid
    // green, a bruised violet, dead white, black), it throbs like a heart, splits into offset
    // copies of itself, and the dark around it breathes in and out
    var ax = 1500 - cam, ay = groundY(1500) - 56 + Math.sin(t * 0.9) * 4;
    var near = side.phase === "walk" ? Math.max(0, Math.min(1, (side.x - 950) / 380)) : 1, rage = side.phase === "warp" ? 1 : near;
    var beat = Math.pow(Math.max(0, Math.sin(t * (2.2 + rage * 3))), 8), R0 = 60 * (1 + beat * 0.12 * rage);
    var halo = ctx.createRadialGradient(ax, ay, 10, ax, ay, 150 + beat * 30 * rage);
    halo.addColorStop(0, "rgba(0,0,0,.9)"); halo.addColorStop(0.45, "rgba(24,0,18," + (0.5 + rage * 0.3).toFixed(2) + ")"); halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.fillRect(ax - 190, ay - 190, 380, 380);
    if (A.deity) {
      A.deity.energy(0.35 + rage * 1.4); A.fph = (A.fph || 0) + Math.max(0, Math.min(0.1, t - (A.ft || t))) * (1 + rage * 2); A.ft = t; A.deity.frame(A.fph);
      // it changes colour at most three times a second (slower with flashes off) and never flickers in between
      var VIOLENT = OPT.flash && !REDUCED ? ["#ff0a3a", "#7cff00", "#6a00ff", "#ffffff", "#000000", "#ff5200", "#00f0ff"] : ["#8a0a22", "#3c6a10", "#3a1070", "#5a2a10"];
      A.cph = (A.cph || 0) + Math.max(0, Math.min(0.1, t - (A.ct || t))) * (OPT.flash && !REDUCED ? 1 + rage * 2 : 0.4 + rage * 0.6); A.ct = t;
      var col = VIOLENT[Math.floor(A.cph) % VIOLENT.length];
      var dc = A.dc || (A.dc = mkCanvas()); dc.width = dc.height = 140; var dg = dc.getContext("2d");
      dg.clearRect(0, 0, 140, 140); dg.drawImage(A.deity.canvas, 10, 10, 120, 120);
      if (rage > 0.05) { dg.globalCompositeOperation = "source-atop"; dg.globalAlpha = Math.min(OPT.flash ? 0.85 : 0.5, rage * (0.6 + 0.2 * Math.sin(t * 2.4))); dg.fillStyle = col; dg.fillRect(0, 0, 140, 140); dg.globalAlpha = 1; dg.globalCompositeOperation = "source-over"; }
      var sz = R0 * 2 / 120 * 140, jx = (rand() - 0.5) * rage * 4, jy = (rand() - 0.5) * rage * 4;
      if (rage > 0.3) {                                                      // it splits: offset ghosts of itself
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 * rage;
        ctx.drawImage(dc, ax - sz / 2 - 5 * rage + jx, ay - sz / 2 + jy, sz, sz); ctx.drawImage(dc, ax - sz / 2 + 5 * rage - jx, ay - sz / 2 - jy, sz, sz);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      ctx.drawImage(dc, ax - sz / 2 + jx, ay - sz / 2 + jy, sz, sz);
    }
    // pi (or what pi became), in profile
    var art = piArt(side.ground && (keys.l || keys.r || side.tap) && side.phase === "walk" ? "walk" : "idle", side.ground && (keys.l || keys.r || side.tap) ? Math.floor(side.dist / 4) % 6 : Math.floor(t * 1.6) % 4, false, true);
    var px = side.x - cam; ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(Math.round(px - 6), Math.round(groundY(side.x)), 12, 2);
    if (side.face < 0) { ctx.save(); ctx.translate(Math.round(px + art.width / 2), 0); ctx.scale(-1, 1); ctx.drawImage(art, 0, Math.round(side.y - art.height + 2)); ctx.restore(); } else ctx.drawImage(art, Math.round(px - art.width / 2), Math.round(side.y - art.height + 2));
    // grass in the foreground, dark against the scene
    for (var lf = 0; lf < 70; lf++) { var lx = ((lf * 37 - cam * 1.3) % (VW + 40) + VW + 40) % (VW + 40) - 20, lh = 4 + hash(lf, 3) * 9; ctx.fillStyle = lf % 3 ? "#0e1a10" : "#162a18"; ctx.fillRect(Math.round(lx), Math.round(VH - lh), 1, lh); ctx.fillRect(Math.round(lx + 1), Math.round(VH - lh * 0.6), 1, lh * 0.6); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (side.phase === "warp") {
      // reality comes apart: the colours invert in flashes, a hole opens out of the orb, everything shakes
      var u = side.warp, ex = (ax) * E, ey = (ay + oy) * E;
      if (rand() < 0.2 + u * 0.35) invertFlash();
      var hr = u * u * Math.max(W, H) * 1.3;
      var hole = ctx.createRadialGradient(ex, ey, hr * 0.6, ex, ey, hr * 1.05); hole.addColorStop(0, "rgba(0,0,0,1)"); hole.addColorStop(0.8, "rgba(40,0,30,.8)"); hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = "#000"; tearPath(ex, ey, hr * 0.6, 7); ctx.fill();
      ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(ex, ey, hr * 1.05, 0, 6.283); ctx.fill();
      if (u > 0.85) { ctx.fillStyle = OPT.flash ? "rgba(255,255,255," + ((u - 0.85) / 0.15).toFixed(3) + ")" : "rgba(0,0,0," + ((u - 0.85) / 0.15).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
      glitchSlices();
    }
    tag("← →  walk   space  jump", W / 2, H - 16, false);
  }
  // thrown out: the island closes without ceremony and the machine reboots
  function freeSideArt() {
    if (!sideArt) return;
    Object.keys(sideArt).forEach(function (k2) { var v = sideArt[k2]; if (v && v.getContext) freeCanvas(v); else if (v && v.canvas && v.canvas.getContext) freeCanvas(v.canvas); });
    sideArt = null;
  }
  function throwOut() {
    foundSecret("deity");
    side = null; closeDialog(); freeSideArt();
    try { sessionStorage.setItem("deity-met", "1"); } catch (e) {}
    stopSound();
    open = false; stopLoop(); unbindSession();
    root.classList.remove("show"); root.hidden = true;
    document.documentElement.classList.remove("in-world");
    if (window.orbs) window.orbs.forEach(function (o) { o.pause(false); o.calm(); });
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    pi.x = SPAWN.x; pi.y = SPAWN.y;
    if (window.reboot) window.reboot();
  }

  /* ════════ simulation ════════ */
  function move(o, dx, dy) {
    var hw = 4;
    if (dx && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y - 2) && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y + 1)) o.x += dx;
    if (dy && !solidPx(o.x - hw, o.y + dy + (dy > 0 ? 1 : -2)) && !solidPx(o.x + hw, o.y + dy + (dy > 0 ? 1 : -2))) o.y += dy;
  }
  var hitstop = 0;
  /* game-time timers: background tabs throttle setTimeout, and a paused game shouldn't keep
     firing things, so anything in play waits on the game's own clock instead */
  var timers = [];
  function later(sec, fn) { timers.push({ t: sec, fn: fn }); }
  function tickTimers(dt) {
    if (!timers.length) return;
    var due = [];
    timers = timers.filter(function (tm) { tm.t -= dt; if (tm.t <= 0) { due.push(tm.fn); return false; } return true; });
    due.forEach(function (fn) { fn(); });
  }
  function update(dt) {
    tickTimers(dt);
    updateTour(dt);
    updateLog(dt);
    if (cut) { updateCut(dt); return; }
    if (hitstop > 0) { hitstop -= dt; return; }
    if (side) { updateSide(dt); updateReality(dt); quake = Math.max(0, quake - dt * 8); if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; } return; }             // a beat of freeze on a big hit sells the impact
    updateRift(dt);
    updateReality(dt);
    updateLife(dt);
    updateFootfalls(dt);
    updateSound(dt);
    if (egg) { egg.t += dt; if (egg.t > 2.2) { egg = null; bubble = { text: "pi:~$ fresh hatch. hi.", t: 3 }; } return; }
    var top = (pi.boost > 0 ? 95 : 58) * (keys.run ? 1.6 : 1) * (pi.kaiju ? 0.88 : 1); pi.boost = Math.max(0, pi.boost - dt);
    var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), onPath = false;
    if (joy && joy.on) { mx = joy.dx; my = joy.dy; pi.path = null; }
    sinceLog += dt;
    if (!save.hints.move && Math.hypot(pi.x - hintFrom.x, pi.y - hintFrom.y) > 3 * T) { save.hints.move = true; writeSave(); }
    if (!dlg.hidden) mx = my = 0;
    if (riftBusy() || car.driving || aboard() || termOpen || irisBusy()) { mx = my = 0; pi.path = null; pi.vx = pi.vy = 0; }
    if (!mx && !my && pi.path && pi.path.length) {
      var n = pi.path[0], gx = n[0] * T + 8, gy = n[1] * T + 10, ddx = gx - pi.x, ddy = gy - pi.y, dd = Math.hypot(ddx, ddy);
      if (dd < 1.5) { pi.path.shift(); if (!pi.path.length) { pi.path = null; if (pi.want) { var w = pi.want; pi.want = null; interact(w.id === "rex" ? { id: "rex" } : w); } } }
      else {
        // a failsafe, not the route planner: half a second without getting closer ends the path
        if (pi.pathTo !== n || dd < pi.pathD - 0.25) { pi.pathTo = n; pi.pathD = dd; pi.pathT = 0; }
        else if ((pi.pathT += dt) > 0.5) { pi.path = null; pi.want = null; pi.pathTo = null; pi.stalls = (pi.stalls || 0) + 1; }
        if (pi.path) { mx = ddx / dd; my = ddy / dd; onPath = true; }
      }
    }
    // ease into a walk and out of it: quick to start, quicker to stop (tapped paths steer exactly)
    if (room && roomTap && !mx && !my) {
      var rdx = roomTap.x - pi.x, rdy = roomTap.y - pi.y, rdd = Math.hypot(rdx, rdy);
      if (rdd < 4 || (roomTap.want && rdd < 20)) { var rw = roomTap.want; roomTap = null; if (rw) interact(rw); } else { mx = rdx / rdd; my = rdy / rdd; }
    }
    var len = Math.hypot(mx, my); if (len) { mx /= len; my /= len; }
    if (onPath) { pi.vx = mx * top; pi.vy = my * top; }
    else {
      var acc = (len ? 520 : pi.kaiju ? 560 : 760) * dt, tvx = mx * top, tvy = my * top;
      pi.vx += Math.max(-acc, Math.min(acc, tvx - pi.vx)); pi.vy += Math.max(-acc, Math.min(acc, tvy - pi.vy));
    }
    if (Math.abs(pi.vx) < 0.5 && Math.abs(pi.vy) < 0.5 && !len) { pi.vx = pi.vy = 0; }
    var goingNow = !!len || onPath;
    if (goingNow !== !!pi.going) { pi.going = goingNow; pi.sq = 0.08; pi.sqStart = goingNow; }         // squash and stretch
    pi.sq = Math.max(0, (pi.sq || 0) - dt); if (pi.hop) pi.hop = Math.max(0, pi.hop - dt * 2.8);
    if (pi.vx || pi.vy) {
      var ox = pi.x, oy = pi.y;
      if (room) roomMove(pi, pi.vx * dt, pi.vy * dt); else move(pi, pi.vx * dt, pi.vy * dt);
      var moved = Math.hypot(pi.x - ox, pi.y - oy);
      if (moved < 0.01 && !len) pi.vx = pi.vy = 0;
      pi.dist += moved;
      if (Math.abs(pi.vx) > 6) pi.face = pi.vx > 0 ? 1 : -1;
      if (len) { pi.dir = my < -0.5 ? "up" : "down"; pi.view = Math.abs(mx) >= Math.abs(my) * 0.8 ? "side" : pi.dir; }
      if (pi.path && moved < 0.01) { pi.path = null; pi.stalls = (pi.stalls || 0) + 1; }   // stuck: give up (counted for the ?debug=1 tests)
      footfall(moved);
    }
    // rex wanders the meadow
    rex.wait -= dt;
    if (rex.wait <= 0 && !rex.tx) {
      var tx = 38 + Math.floor(rand() * 12), ty = 60 + Math.floor(rand() * 3);
      if (walkable(tx, ty)) { rex.tx = tx * T + 8; rex.ty = ty * T + 10; }
    }
    if (rex.tx) {
      var rx = rex.tx - rex.x, ry = rex.ty - rex.y, rd = Math.hypot(rx, ry);
      if (rd < 2) { rex.tx = 0; rex.wait = 1 + rand() * 3; }
      else { var bx = rex.x, by = rex.y; move(rex, rx / rd * 22 * dt, ry / rd * 22 * dt); rex.dist += 22 * dt; rex.face = rx > 0 ? 1 : -1; if (Math.hypot(rex.x - bx, rex.y - by) < 0.01) { rex.tx = 0; rex.wait = 1; } }
    }
    if (rex.hop) { rex.vy += 9 * dt; rex.hop += rex.vy; if (rex.hop >= 0) { rex.hop = 0; rex.vy = 0; } }
    // pterodactyl fly-bys
    ptero.next -= dt;
    if (!ptero.on && ptero.next <= 0) { ptero.on = true; ptero.vx = rand() < 0.5 ? 38 : -38; ptero.x = ptero.vx > 0 ? camX - 30 : camX + W / (S * zoom) + 30; ptero.y = camY + 20 + rand() * (H / (S * zoom) - 60); }
    if (ptero.on) { ptero.x += ptero.vx * dt; ptero.y -= 4 * dt; if (ptero.x < camX - 60 || ptero.x > camX + W / (S * zoom) + 60) { ptero.on = false; ptero.next = 6 + rand() * 8; } }
    clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > MW * T + c.w) c.x = -c.w; });
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }
  }

  /* ════════ footfalls: a sound per step, dust on dry ground, prints in the sand, ferns that rustle ════════ */
  var puffs = [], prints = [], rustling = [];
  var ferns = {}; props.forEach(function (p) { if (/^e:(fern|cycad|horsetail|bush|magnolia|reeds|tallgrass)/.test(p.kind)) ferns[k(p.tx, p.ty)] = p; });

  /* ════════ buildings and the waterfall ════════ */
  function drawBuilding(bd) {
    var sp = SPR[bd.id], bx = Math.round((bd.x0 + bd.w / 2) * T - sp.width / 2), by = (bd.y0 + bd.h) * T - sp.height + 2;
    var behind = pi.y < (bd.y0 + bd.h) * T - 2 && pi.y > by + 4 && pi.x > bx && pi.x < bx + sp.width;
    if (behind) ctx.globalAlpha = 0.45;
    ctx.drawImage(skin(sp), bx, by);
    ctx.globalAlpha = 1;
    drawDoor(bd, bx, by);
    if (bd.room && !ROOMS[bd.room]._bgDone && Math.hypot(pi.x - (bd.x0 + bd.w / 2) * T, pi.y - (bd.y0 + bd.h) * T) < 3 * T) roomBgStep(ROOMS[bd.room], 3);
    var night = sky.dark > 0.4;
    if (bd.id === "visitor") {
      if (night) { ctx.fillStyle = "rgba(255,214,120,.55)"; [9, 19, 45, 55].forEach(function (wx) { ctx.fillRect(bx + wx + 1, by + 34, 6, 7); }); }
      light(bx + 34, by + 42, 40, "255,214,140", 0.9); light(bx + 12, by + 38, 18, "255,214,140", 0.5); light(bx + 56, by + 38, 18, "255,214,140", 0.5);
      var fl2 = Math.sin(t * 2 + 1) > 0 ? 0 : 1; ctx.fillStyle = "#b8321f"; ctx.fillRect(bx + 13 + fl2, by + 47, 3, 2); ctx.fillRect(bx + 53 - fl2, by + 47, 3, 2);   // banners stir
    } else if (bd.id === "depot") {
      if (Math.floor(t * 1.5) % 2) { ctx.fillStyle = "#ff5252"; ctx.fillRect(bx + 44, by + 1, 3, 1); light(bx + 45, by + 1, 10, "255,82,82", 0.8); }
      light(bx + 26, by + 36, 30, "255,240,200", 0.6);
    }
  }
  function drawWaterfall(WF) {
    // a white ribbon off the plateau edge with streaks falling through it, and spray at the foot
    var x0 = Math.round(WF.x - 9), y0 = Math.round(WF.y), hgt = 22;
    for (var i = 0; i < 18; i++) for (var j = 0; j < hgt; j += 2) {
      var v = 0.55 + 0.35 * Math.sin(j * 0.9 - t * 12 + i * 1.7) + (hash(i, j) - 0.5) * 0.2;
      ctx.fillStyle = tone(v, ["#3f8e98", "#6fb6c0", "#a8dde2", "#e8fbff"], x0 + i, y0 + j); ctx.fillRect(x0 + i, y0 + j, 1, 2);
    }
    ctx.fillStyle = "rgba(240,252,255,.8)";
    for (i = 0; i < 9; i++) { var a3 = t * 3 + i * 0.7, rr = (t * 9 + i * 3) % 7; ctx.fillRect(Math.round(WF.x - 9 + i * 2 + Math.sin(a3) * 2), Math.round(y0 + hgt - rr * 0.5 + 1), 2, 1); }
    // foam where it lands: a churned band of white, wider than the ribbon, breathing with the flow
    var ft = REDUCED ? 0 : t;
    for (i = 0; i < 26; i++) {
      var fxw = WF.x - 13 + (i * 7 % 26) + Math.round(Math.sin(ft * 2.3 + i) * 1.5), fyw = y0 + hgt + 1 + (i % 3) + Math.round(Math.sin(ft * 3.1 + i * 1.7));
      ctx.fillStyle = i % 4 === 0 ? "rgba(255,255,255,.95)" : i % 4 === 1 ? "rgba(226,246,238,.85)" : "rgba(180,228,224,.7)";
      ctx.fillRect(Math.round(fxw), Math.round(fyw), i % 3 ? 2 : 3, 1);
    }
    light(WF.x, y0 + hgt, 20, "200,240,255", 0.35);
  }
  function footfall(moved) {
    var fr0 = Math.floor(pi.dist / 4);
    if (fr0 === pi.lastFr) return;
    pi.lastFr = fr0;
    if (fr0 % 3) return;                                              // a foot comes down on frames 0 and 3
    var stride = 12, nstep = fr0 / 3;
    var tx = Math.floor(pi.x / T), ty = Math.floor((pi.y - 2) / T), tt = at(tx, ty), side = nstep % 2 ? 2 : -2;
    if (room) { sfx("step", undefined, undefined, { surface: room.id === "visitor" ? "dock" : "gravel", vol: 0.7 }); return; }
    sfx("step", undefined, undefined, { surface: tt === DOCK ? "dock" : tt === GRASS ? "grass" : "gravel", vol: keys.run ? 1.2 : 0.8 });
    if (pi.kaiju) { sfx("stomp", undefined, undefined, { vol: 0.18 }); nudge = 1; }     // middle path is a little heavier than pi: the screen feels it
    if (tt === GRASS && nstep % 3 === 0 && !keys.run) puffs.push({ x: pi.x + side, y: pi.y, vx: (rand() - 0.5) * 5, vy: -2 - rand() * 2, life: 0.7, c: "150,130,90" });   // a little dust off the grass
    if (tt === PATH || tt === SAND || tt === PAD || keys.run) {
      for (var i = 0; i < (keys.run ? 3 : 1); i++) puffs.push({ x: pi.x + side + (rand() - 0.5) * 3, y: pi.y, vx: -pi.vx * 0.08 + (rand() - 0.5) * 6, vy: -3 - rand() * 4, life: 1, c: tt === GRASS ? "150,190,110" : tt === SAND ? "230,214,170" : "200,170,120" });
    }
    if (tt === SAND) { prints.push({ x: Math.round(pi.x + side), y: Math.round(pi.y), life: 1 }); if (prints.length > 60) prints.shift(); }
    var fp = ferns[k(tx, Math.floor(pi.y / T))];
    if (fp) { fp.rustle = 1; if (rustling.indexOf(fp) < 0) rustling.push(fp); sfx("rustle", pi.x, pi.y); puffs.push({ x: pi.x, y: pi.y - 8, vx: (rand() - 0.5) * 16, vy: -8, life: 1.2, c: "70,140,70", leaf: true }); }
  }
  function updateFootfalls(dt) {
    puffs.forEach(function (d) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += (d.leaf ? 14 : 4) * dt; d.life -= dt * (d.leaf ? 0.9 : 2.2); });
    puffs = puffs.filter(function (d) { return d.life > 0; });
    prints.forEach(function (p2) { p2.life -= dt / 9; });
    prints = prints.filter(function (p2) { return p2.life > 0; });
    rustling.forEach(function (p2) { p2.rustle = Math.max(0, p2.rustle - dt * 1.6); });
    rustling = rustling.filter(function (p2) { return p2.rustle > 0; });
  }
  function drawPrints() {
    prints.forEach(function (p2) { ctx.fillStyle = "rgba(150,120,70," + (0.45 * p2.life).toFixed(3) + ")"; ctx.fillRect(p2.x - 1, p2.y - 1, 2, 2); });
    drawSkids();
  }
  /* fireflies over the brachio meadow at night */
  var FLIES = [];
  for (var fi = 0; fi < 38; fi++) { var fx0 = 11 + hash(fi, 71) * 18, fy0 = 30 + hash(71, fi) * 20; if (land(at(Math.floor(fx0), Math.floor(fy0)))) FLIES.push({ x: fx0 * T, y: fy0 * T, ph: hash(fi, 5) * 6.283, r: 6 + hash(fi, 9) * 10 }); }
  function drawFlies() {
    if (sky.dark < 0.5 || REAL !== "dino") return;
    var a0 = Math.min(1, (sky.dark - 0.5) * 3);
    FLIES.forEach(function (f) {
      var x = f.x + Math.sin(t * 0.4 + f.ph) * f.r, y = f.y + Math.cos(t * 0.33 + f.ph * 1.3) * f.r * 0.6 - 6, on = Math.max(0, Math.sin(t * 1.7 + f.ph * 3));
      if (on < 0.15) return;
      ctx.fillStyle = "rgba(220,255,140," + (on * a0).toFixed(2) + ")"; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      light(x, y, 7, "200,255,120", on * a0 * 0.5);
    });
  }
  function drawDust() {
    puffs.forEach(function (d) { ctx.fillStyle = "rgba(" + d.c + "," + Math.min(1, d.life * (d.leaf ? 1 : 0.6)).toFixed(3) + ")"; ctx.fillRect(Math.round(d.x), Math.round(d.y), d.leaf ? 2 : 1, d.leaf ? 1 : 1); });
  }

  /* ════════ the minimap: bottom right, click it to fold it away ════════ */
  var mini = mkCanvas(), MINI = 2, mapOn = OPT.map, mapRect = null;
  mini.width = MW * MINI; mini.height = MH * MINI;
  (function () { var g = mini.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(ground, 0, 0, mini.width, mini.height); g.drawImage(volc.canvas, (volc.ox) / T * MINI, (volc.oy) / T * MINI, volc.canvas.width / T * MINI, volc.canvas.height / T * MINI); })();
  /* the full map: m, or from the menu. the island pre-rendered once at 3 px a tile, drawn at a
     whole-number scale; found landmarks are named, the rest are "?". pick a found one (click it,
     or from the list) and pi travels there */
  var bigMap = null, mapEl = root.querySelector(".w-map"), mapCv = mapEl && mapEl.querySelector("canvas"), mapK = 1, mapPts = [];
  function mapOpen() { return mapEl && !mapEl.hidden; }
  function buildBigMap() {
    bigMap = mkCanvas(); bigMap.width = MW * 3; bigMap.height = MH * 3;
    var g = bigMap.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(ground, 0, 0, bigMap.width, bigMap.height);
    g.drawImage(volc.canvas, volc.ox / T * 3, volc.oy / T * 3, volc.canvas.width / T * 3, volc.canvas.height / T * 3);
  }
  function mapSpot(q) {
    if (q.room) { var b = BUILDINGS.filter(function (b0) { return b0.room === q.room; })[0], i = STATIONS.filter(function (x) { return x.room === q.room; }).indexOf(q); return { x: b.x0 + b.w / 2 + (i ? 1.4 : -1.4), y: b.y0 + b.h / 2, below: i % 2 }; }
    return { x: q.x + 0.5, y: q.y + 0.5 };
  }
  function paintMap() {
    if (!bigMap) buildBigMap();
    var aw = Math.max(300, Math.min(W - 40, 1200)), ah = Math.max(240, H - 230);
    mapK = Math.max(1, Math.floor(Math.min(aw / 300, ah / 240)));
    var cw = 300 * mapK, ch = 240 * mapK;
    mapCv.style.width = cw + "px"; mapCv.style.height = ch + "px"; mapCv.width = Math.floor(cw * dpr); mapCv.height = Math.floor(ch * dpr);
    var g = mapCv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(bigMap, 0, 0, cw, ch);
    g.font = "700 11px 'Cascadia Mono', monospace"; g.textAlign = "center"; g.textBaseline = "bottom";
    mapPts = [];
    STATIONS.filter(function (q) { return q.found; }).forEach(function (q) {
      var sp = mapSpot(q), x = sp.x * 3 * mapK, y = sp.y * 3 * mapK, f = !!found[q.id];
      g.fillStyle = f ? "#4DD6E8" : "#0a0a0a"; g.fillRect(x - 4, y - 4, 8, 8); g.strokeStyle = f ? "#0a0a0a" : "#f4f4f4"; g.lineWidth = 1.5; g.strokeRect(x - 4, y - 4, 8, 8);
      var lbl = f ? q.name.replace(/^(the|a|an) /, "") : "?", w0 = g.measureText(lbl).width + 8;
      var ly = sp.below ? y + 22 : y - 8;
      g.fillStyle = "rgba(10,10,10,.85)"; g.fillRect(x - w0 / 2, ly - 14, w0, 15); g.fillStyle = f ? "#f4f4f4" : "#9a9a9a"; g.fillText(lbl, x, ly);
      mapPts.push({ id: q.id, x: x, y: y, f: f });
    });
    var px = pi.x / T * 3 * mapK, py = pi.y / T * 3 * mapK;                       // pi
    g.fillStyle = "#f454a6"; g.beginPath(); g.arc(px, py, 4, 0, 6.283); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
    var nav = mapEl.querySelector(".w-lm"); nav.innerHTML = "";
    STATIONS.filter(function (q) { return q.found; }).forEach(function (q) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("data-lm", q.id);
      if (found[q.id]) { b.setAttribute("data-found", "1"); b.textContent = q.name + " · " + q.sec; b.setAttribute("aria-label", "travel to " + q.name + ", " + q.sec); }
      else { b.disabled = true; b.textContent = "? · " + q.sec; b.setAttribute("aria-label", q.sec + ", not found yet"); }
      nav.appendChild(b);
    });
  }
  function toggleMap(on) {
    if (!mapEl) return;
    if (on && (side || riftBusy() || cut || creditsOpen())) return;
    if (on) { if (paused) setPaused(false); if (!dlg.hidden) closeDialog(); paintMap(); }
    mapEl.hidden = !on; keys = {};
    if (on) { var b0 = mapEl.querySelector(".w-lm button:not([disabled])"); (b0 || mapEl).focus({ preventScroll: true }); } else cv.focus({ preventScroll: true });
  }
  function travel(id) {
    var q = STATIONS.filter(function (x) { return x.id === id; })[0]; if (!q || !found[id]) return;
    toggleMap(false);
    if (termOpen) closeTerm(); if (aboard()) landNow();
    irisTo(function () { goto(id); }); sfx("whoosh");
    announce("traveled to " + q.name + ".");
  }
  if (mapEl) {
    mapEl.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button"); if (!b) return;
      if (b.getAttribute("data-a") === "close") { toggleMap(false); return; }
      if (b.getAttribute("data-lm")) travel(b.getAttribute("data-lm"));
    });
    mapCv.addEventListener("click", function (e) {
      var r = mapCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 18;
      mapPts.forEach(function (m) { var d = Math.hypot(m.x - x, m.y - y); if (m.f && d < bd) { bd = d; best = m; } });
      if (best) travel(best.id);
    });
    mapEl.addEventListener("keydown", function (e) { if (e.key === "Escape" || e.key === "m" || e.key === "M") { e.preventDefault(); e.stopPropagation(); toggleMap(false); } });
  }
  function drawMinimap() {
    if (W < 760 || riftBusy() || !OPT.map) { mapRect = null; return; }
    var sc = 1.5, mw = mini.width * sc, mh = mini.height * sc, x0 = W - mw - 16, y0 = H - mh - 16;
    mapRect = [x0, y0, mw, mh];
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(x0 - 3, y0 - 3, mapOn ? mw + 6 : 58, mapOn ? mh + 6 : 22);
    ctx.strokeStyle = "rgba(244,244,244,.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0 - 3.5, y0 - 3.5, mapOn ? mw + 7 : 59, mapOn ? mh + 7 : 23);
    if (!mapOn) { ctx.font = "400 11px 'Cascadia Mono', monospace"; ctx.fillStyle = "#f4f4f4"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("map ▴", x0 + 4, y0 + 8); mapRect = [x0 - 3, y0 - 3, 58, 22]; return; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mini, x0, y0, mw, mh);
    var f = MINI * sc / T;
    STATIONS.forEach(function (st) {
      if (!st.found) return;
      var bd = st.room && BUILDINGS.filter(function (q) { return q.room === st.room; })[0];
      var sx = x0 + (bd ? (bd.x0 + bd.w / 2) * T + (st.id === "desk" ? 5 : -5) : st.x * T + 8) * f, sy = y0 + (bd ? (bd.y0 + 1) * T : st.y * T + 8) * f;
      ctx.fillStyle = found[st.id] ? "#4DD6E8" : "#0a0a0a"; ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.strokeStyle = found[st.id] ? "#4DD6E8" : "#f4f4f4"; ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
    });
    ctx.fillStyle = "#FFB000"; ctx.fillRect(x0 + heli.x * f - 1.5, y0 + heli.y * f - 1.5, 3, 3);
    if (Math.floor(t * 3) % 2) { ctx.fillStyle = "#f454a6"; ctx.fillRect(x0 + pi.x * f - 2, y0 + pi.y * f - 2, 4, 4); }
    ctx.strokeStyle = "rgba(244,244,244,.5)"; var E0 = S * zoom; ctx.strokeRect(x0 + camX * f, y0 + camY * f, W / E0 * f, H / E0 * f);
  }

  /* ════════ render ════════ */
  function drawWorld(E, VW, VH) {
    ctx.setTransform(E * dpr, 0, 0, E * dpr, -camX * E * dpr, -camY * E * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COL.deep; ctx.fillRect(camX, camY, VW + 1, VH + 1);
    ctx.drawImage(REAL === "dino" ? ground : realGround(REAL), 0, 0);

    // water: glints and foam that breathe with the tide
    var x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T)), x1 = Math.min(MW - 1, Math.ceil((camX + VW) / T)), y1 = Math.min(MH - 1, Math.ceil((camY + VH) / T));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var tt = GROUND[ty * MW + tx], fm = FOAM[ty * MW + tx];
      if (REAL === "chaos") continue;
      if (fm) {                                              // the surf breathes in and out along the waterline
        ctx.fillStyle = "rgba(226,246,238,.75)";
        for (var s = 0; s < fm.length; s += 4) {
          var tide = REDUCED ? 1 : Math.sin(t * 1.6 + fm[s] * 0.03 + fm[s + 1] * 0.02) * 1.5 + 1.5;
          ctx.fillRect(fm[s] + Math.round(fm[s + 2] * tide), fm[s + 1] + Math.round(fm[s + 3] * tide), 2, 1);
        }
      }
      if (!wet(tt)) continue;
      if (tt === POND && pondF(tx + 0.5, ty + 0.5) > 0.9) continue;
      var ph = hash(tx, ty), cyc = REDUCED ? 0 : Math.floor(t * 0.9 + ph * 7);    // glints, only ever on water
      if (hash(tx * 3 + cyc, ty) < 0.16) {
        var gx0 = tx * T + ((hash(cyc, tx) * 11) | 0), gy0 = ty * T + ((hash(ty, cyc) * 14) | 0);
        if (kAt(gx0, gy0) === KW && kAt(gx0 + 3, gy0) === KW) { ctx.fillStyle = tt === DEEP ? "rgba(255,248,226,.18)" : "rgba(255,248,226,.35)"; ctx.fillRect(gx0, gy0, 4, 1); }
      }
      if (tt === RIVER) {                                    // the current: light streaks sliding downstream
        for (var q2 = 0; q2 < 2; q2++) {
          var fl = REDUCED ? 8 : ((t * 14 + hash(tx, ty * 3 + q2) * 40) % 20) - 2, sx2 = Math.round(tx * T + 12 - fl * 0.6 + q2 * 3), sy2 = Math.round(ty * T + fl * 0.8);
          if (kAt(sx2, sy2) === KW && kAt(sx2 + 2, sy2) === KW) { ctx.fillStyle = "rgba(226,246,238,.35)"; ctx.fillRect(sx2, sy2, 3, 1); }
        }
      }
    }

    lights = []; beamAt = null;
    drawKoi();
    drawPrints();
    drawHeliShadow();
    drones.forEach(drawDroneShadow);

    // y-sorted scene
    var list = [];
    critters.forEach(function (c) { list.push({ y: c.y, f: function () { drawCritter(c); } }); });
    bots.forEach(function (b) { list.push({ y: b.y, f: function () { drawBot(b); } }); });
    birds.forEach(function (b) { list.push({ y: b.fly ? b.gy + 40 : b.gy + 1, f: function () { drawBird(b); } }); });
    list.push({ y: car.y + 8, f: drawCar });
    if (heli.z < 12) list.push({ y: heli.y + 12, f: drawHeli });
    list.push({ y: GATE.y * T + 14, f: drawGate });
    list.push({ y: VOLC.y + 24, f: drawVolcano });
    for (var fy = y0; fy <= y1 + 1; fy++) for (var fx = x0 - 1; fx <= x1 + 1; fx++) {
      if (fence[k(fx, fy)]) (function (a, b) { list.push({ y: b * T + 13, f: function () { drawFence(a, b); } }); })(fx, fy);
      if (wall[k(fx, fy)]) (function (a, b) { list.push({ y: b * T + 13, f: function () { drawWall(a, b); } }); })(fx, fy);
    }
    props.forEach(function (p) {
      if (p.tx < x0 - 2 || p.tx > x1 + 2 || p.ty < y0 - 1 || p.ty > y1 + 4) return;
      list.push({ y: p.ty * T + 14, f: function () {
        var bx = p.tx * T + 8, by = p.ty * T + 14, s = SPR[p.kind];
        if (!s) return;                                         // an atlas sprite that hasn't loaded yet
        var envK = p.kind.charCodeAt(0) === 101 && p.kind.charAt(1) === ":";
        if (envK) {
          bx += p.ox || 0; by += p.oy || 0;
          if (p.flat) { ctx.drawImage(s, Math.round(bx - s.width / 2), Math.round(by - s.height + 4 + (REDUCED ? 0 : Math.sin(t * 1.3 + p.tx) * 0.5))); return; }
          if (p.sea) {                                            // a rock in the shallows: it seems to bob as the surf rings it
            var bob = REDUCED ? 0 : Math.round(Math.sin(t + p.tx) * 0.5), rw = s.width / 2 + 1;
            ctx.drawImage(s, Math.round(bx - s.width / 2), by - s.height + 4 + bob);
            ctx.fillStyle = "rgba(226,246,238,.7)";
            for (var fa = 0; fa < 10; fa++) { var an = fa / 10 * 6.283 + (REDUCED ? 0 : t * 0.6); ctx.fillRect(Math.round(bx + Math.cos(an) * rw), Math.round(by + 2 + Math.sin(an) * 2.5), 2, 1); }
            return;
          }
          if (p.eggs !== undefined) {                             // the nest, with its clutch of speckled teal eggs; one of them wobbles
            softShadow(bx + 1, by + 1, 18); ctx.drawImage(s, bx - 10, by - 10);
            for (var e = 0; e < p.eggs; e++) {
              var ex = bx - 5 + e * 4, wob = e === 1 && !REDUCED && Math.sin(t * 9) > 0.6 ? 1 : 0;
              ctx.fillStyle = "#1a2a26"; ctx.fillRect(ex - 1 + wob, by - 11, 5, 6); ctx.fillStyle = "#7cc4b2"; ctx.fillRect(ex + wob, by - 10, 3, 5); ctx.fillStyle = "#b4e6d8"; ctx.fillRect(ex + wob, by - 10, 1, 2); ctx.fillStyle = "#3f7a6c"; ctx.fillRect(ex + 2 + wob, by - 8, 1, 1); ctx.fillRect(ex + 1 + wob, by - 7, 1, 1);
            }
            return;
          }
          softShadow(bx + 1, by + 2, Math.max(8, s.width * (TALL.test(p.kind) ? (/palm|mpuzzle/.test(p.kind) ? 0.45 : 0.72) : 0.85)));
        }
        bx += p.ox || 0; by += p.oy || 0;
        if (p.kind === "lamp" || p.kind === "crates") shadow(bx, by, p.kind === "lamp" ? 6 : 14);
        var sway = /^e:(palm|tallfern)/.test(p.kind) && !REDUCED ? Math.round(Math.sin(t * 1.2 + p.tx) * 0.6) : 0;
        if (/^e:(fern|reeds|horsetail|tfern|bush|tallgrass)/.test(p.kind) && !REDUCED) sway = Math.round(Math.sin(t * 1.8 + p.tx * 0.7 + p.ty * 0.3) * 0.8);   // wind rolls across the field
        if (p.rustle) sway = Math.round(Math.sin(t * 34) * p.rustle * 1.6);
        if (REAL === "future" && TALL.test(p.kind)) { var tw = towers()[(hash(p.tx, p.ty) * 6) | 0]; ctx.drawImage(tw, bx - tw.width / 2, by - tw.height + 2); light(bx, by - tw.height * 0.6, 18, hash(p.ty, p.tx) < 0.5 ? "255,79,160" : "41,216,255", 0.5); return; }
        s = skin(s);
        var behind = (TALL.test(p.kind) || p.kind === "mast" || p.kind === "tank") && pi.y < by - 3 && pi.y > by - s.height + 6 && Math.abs(pi.x - bx) < s.width / 2 - 2;
        if (behind) ctx.globalAlpha = 0.42;                      // pi walks behind it: see through
        if (p.flip) { ctx.save(); ctx.translate(bx * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(s, bx - s.width / 2 + sway, by - s.height + 2);
        if (p.flip) ctx.restore();
        ctx.globalAlpha = 1;
        if (p.kind === "lamp") light(bx, by - 14, 34, "255,210,140", 0.95);
        if (p.kind === "campfire") {
          for (var f2 = 0; f2 < 8; f2++) { var fl2 = Math.sin(t * 13 + f2 * 1.9), w5 = Math.max(1, 6 - f2 * 0.8 + fl2); ctx.fillStyle = f2 < 2 ? "#ffe07a" : f2 < 5 ? "#ff9a30" : "#e85414"; ctx.fillRect(Math.round(bx - w5 / 2 + fl2 * 0.6), by - 9 - f2, Math.round(w5), 1); }
          light(bx, by - 10, 46, "255,150,60", 1);
          if (rand() < 0.3) puffs.push({ x: bx + (rand() - 0.5) * 3, y: by - 16, vx: (rand() - 0.5) * 4, vy: -10, life: 1, c: "120,110,100" });
        }
        if (p.kind === "mast" && Math.floor(t * 1.2) % 2) { ctx.fillStyle = "#ff5252"; ctx.fillRect(bx, by - s.height + 3, 2, 1); light(bx, by - s.height + 3, 10, "255,82,82", 0.9); }
        if (p.kind === "generator" && rand() < 0.25) puffs.push({ x: bx + 6, y: by - 16, vx: 2, vy: -8, life: 0.8, c: "80,80,80" });
      } });
    });
    OUT.forEach(function (s) { list.push({ y: s.y * T + 15, f: function () { drawStation(s); } }); });
    BUILDINGS.forEach(function (bd) { list.push({ y: (bd.y0 + bd.h) * T - 2, f: function () { drawBuilding(bd); } }); });
    FALLS.forEach(function (f) { list.push({ y: f.y + 30, f: function () { drawWaterfall(f); } }); });
    list.push({ y: rex.y, f: function () {
      shadow(rex.x, rex.y, 10);
      drawFrame(DINO[Math.floor(rex.dist / 5) % 2 ? "b" : "a"], { W: "#ececec", K: "#141414" }, 11, rex.x, rex.y - 1 + rex.hop, rex.face < 0);
    } });
    list.push({ y: pi.y, f: drawPi });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // above it all: dust and leaves, volcano smoke, the helicopter in flight, pterosaurs, drifting cloud shadows
    drawDust(); drawFlies();
    drawSparks();
    drones.forEach(drawDrone);
    drawSmoke();
    if (heli.z >= 12) drawHeli();
    drawPteros();
    ctx.fillStyle = "rgba(10,30,50,.08)";
    clouds.forEach(function (c) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.45, 0, 0, 6.283); ctx.fill(); });

    if (REAL === "future") drawFuture(E, VW, VH);
    if (REAL === "chaos") drawChaosNet(E);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    realityGrade(REAL);
  }
  var rdt = 1 / 60, nudge = 0;
  function render() {
    paintChip(); promptRect = null;
    if (side) { renderSide(); drawFade(); drawIris(W / 2, H / 2); return; }
    if (room) { renderRoom(); drawFade(); drawIris(W / 2, H / 2); return; }
    zoom += (zoomTo - zoom) * (1 - Math.pow(0.0066, rdt));
    var E = S * zoom, VW = W / E, VH = H / E;
    // the camera follows pi, except while the orbs fight: then it watches the arena
    // lead the camera a little in the direction of travel so you see where you're going
    // about a tile and a half ahead on foot, further the faster a vehicle goes
    var cvx = car.driving ? car.vx : aboard() ? heli.vx : pi.vx, cvy = car.driving ? car.vy : aboard() ? heli.vy : pi.vy;
    var veh = car.driving || aboard(), lvx = cvx * (veh ? 0.3 : 0.41), lvy = cvy * (veh ? 0.3 : 0.41);
    var lk = veh ? Math.min(64, 30 + Math.hypot(cvx, cvy) * 0.2) : 24, kl = 1 - Math.pow(0.03, rdt);
    if (cvx === undefined || cvy === undefined || isNaN(lvx)) { lvx = 0; lvy = 0; }
    look.x += (Math.max(-lk, Math.min(lk, lvx)) - look.x) * kl; look.y += (Math.max(-lk * 0.6, Math.min(lk * 0.6, lvy)) - look.y) * kl;
    var foc = cut ? cut : riftBusy() ? orbFocus() : null, fx = foc ? foc.x : pi.x + look.x, fy = foc ? foc.y : pi.y + look.y;
    if (camF.x === null) { camF.x = fx; camF.y = fy; }
    var kf = 1 - Math.pow(0.001, rdt);                                  // the same follow at any frame rate
    camF.x += (fx - camF.x) * kf; camF.y += (fy - camF.y) * kf;
    var sh = shakeBy((rift ? rift.shake : 0) + quake);
    camX = Math.max(0, Math.min(MW * T - VW, camF.x - VW / 2)) + (rand() - 0.5) * sh;
    camY = Math.max(0, Math.min(MH * T - VH, camF.y - VH / 2)) + (rand() - 0.5) * sh + shakeBy(nudge) / E; nudge = 0;
    camX = Math.round(camX * E * dpr) / (E * dpr); camY = Math.round(camY * E * dpr) / (E * dpr);        // whole device pixels: no shimmer
    if (reality.wipe) {
      REAL = reality.wipe.from; drawWorld(E, VW, VH);
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wsx = (reality.wipe.x - camX) * E, wsy = (reality.wipe.y - camY) * E, wr = reality.wipe.r * E / 2;
      tearPath(wsx, wsy, wr, reality.wipe.seed); ctx.clip();
      REAL = reality.cur; drawWorld(E, VW, VH);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the edge of the tear glows like a heat front: soft bands, widest and faintest outside
      var ec = reality.cur === "chaos" ? "0,0,0" : reality.cur === "future" ? "41,216,255" : "255,226,200";
      [[22, 0.08], [12, 0.16], [5, 0.35], [2, 0.8]].forEach(function (b2) { ctx.strokeStyle = "rgba(" + ec + "," + b2[1] + ")"; ctx.lineWidth = b2[0]; tearPath(wsx, wsy, wr, reality.wipe.seed); ctx.stroke(); });
    } else { REAL = reality.cur; drawWorld(E, VW, VH); }

    // screen-space overlays: the rift, then prompts and speech
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(E);
    drawLens(E);
    drawRift(E);
    if (reality.glitch > 0 && !REDUCED) glitchSlices();
    var nb = !egg && dlg.hidden ? nearby() : null;
    nearNote(nb);
    if (nb && nb.ax !== undefined) tag(promptText(nb), (nb.ax - camX) * E, (nb.ay - camY) * E - 4 + Math.sin(t * 4) * 2, true);
    else if (nb) {
      // float the prompt just above the landmark's own sprite
      var topY = nb.id === "rex" ? rex.y - 15 : nb.id === "core" ? ARENA.y - 34 - OR * 1.9 : nb.id === "boat" ? nb.y * T : nb.y * T + 16 - SPR[nb.id].height;
      var sx = ((nb.id === "rex" ? rex.x : nb.id === "core" ? ARENA.x : nb.x * T + 8) - camX) * E, sy = (topY - camY) * E - 6 + Math.sin(t * 4) * 2;
      tag(promptText(nb), sx, sy, true);
    }
    // in a vehicle, the way out is the prompt
    else if (!egg && dlg.hidden && !riftBusy() && (car.driving || heli.state === "flying")) {
      var vx0 = car.driving ? car.x : heli.x, vy0 = car.driving ? car.y - 14 : heli.y - heli.z - 22;
      tag(promptText({ id: car.driving ? "exitcar" : "exitheli" }), (vx0 - camX) * E, (vy0 - camY) * E, true);
    }
    bots.forEach(function (b) { if (b.bark) tag(b.bark.text, (b.x - camX) * E, (b.y - 20 - camY) * E, false); });
    drawGuide(E);
    drawMinimap();
    if (roarTag) tag("ROAR", (roarTag.x - camX) * E, (roarTag.y - camY) * E, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 16 - (aboard() ? heli.z + 10 : 0) - camY) * E - 6, false);
    drawFade();
    drawIris((pi.x - camX) * E, (pi.y - 8 - (aboard() ? heli.z : 0) - camY) * E);
  }
  function drawFade() { if (fade > 0) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "rgba(0,0,0," + fade.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); fade = Math.max(0, fade - 0.06); } }
  /* first steps: a hint beside pi until it has walked three tiles, the same for the first
     prompt, and if a while goes by with no new log, a chevron at the edge of the screen points
     at the nearest one still to find (it goes once that landmark is on screen) */
  var sinceLog = 0, hintFrom = { x: 0, y: 0 };
  function stationPos(q) { return q.room ? BUILDINGS.filter(function (b) { return b.room === q.room; }).map(function (b) { return { x: (b.x0 + b.w / 2) * T, y: (b.y0 + b.h) * T }; })[0] : { x: q.x * T + 8, y: q.y * T + 8 }; }
  function nearestUnfound(x, y) {
    var best = null, bd = 1e9;
    STATIONS.forEach(function (q) { if (!q.found || found[q.id]) return; var p = stationPos(q), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { q: q, x: p.x, y: p.y }; } });
    return best;
  }
  function guideTarget() { return nearestUnfound(pi.x, pi.y); }
  function drawGuide(E) {
    if (egg || riftBusy() || cut || tour) return;
    if (!save.hints.move && dlg.hidden) tag(TOUCH ? "drag to move, or tap a spot" : "wasd / arrow keys to walk", (pi.x - camX) * E, (pi.y + 26 - camY) * E, false);
    else if (!save.hints.use && promptRect && dlg.hidden) tag(TOUCH ? "tap the prompt to use it" : "e, space or enter to use", promptRect[0] + promptRect[2] / 2, promptRect[1] - 4, false);
    if (sinceLog > 20 && countFound() < TOTAL && dlg.hidden && !car.driving && !aboard()) {
      var g = guideTarget(); if (!g) return;
      var sx = (g.x - camX) * E, sy = (g.y - camY) * E, m = 26;
      if (sx > m && sx < W - m && sy > 60 && sy < H - m) return;                      // it's on screen
      var cx = W / 2, cy = H / 2, a = Math.atan2(sy - cy, sx - cx), k2 = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 60) / Math.abs(Math.sin(a) || 1e-6));
      var ex = cx + Math.cos(a) * k2, ey = cy + Math.sin(a) * k2, bob = Math.sin(t * 5) * 3;
      ctx.save(); ctx.translate(ex + Math.cos(a) * bob, ey + Math.sin(a) * bob); ctx.rotate(a);
      ctx.fillStyle = "#0a0a0a"; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#4DD6E8"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    if (joy && joy.on) {
      ctx.strokeStyle = "rgba(244,244,244,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.x0, joy.y0, 44, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "rgba(244,244,244,.5)"; ctx.beginPath(); ctx.arc(joy.x0 + joy.dx * 44, joy.y0 + joy.dy * 44, 16, 0, 6.283); ctx.fill();
    }
  }
  var nearId = null, nearT = 0;
  function nearNote(nb) {
    var id = nb && nb.sec ? nb.id : null;
    if (id === nearId || (id && performance.now() - nearT < 2000)) return;       // at most one every 2 s
    nearId = id; if (id) { nearT = performance.now(); announce(nb.name + ", " + nb.sec + ". Press E to read."); }
  }
  function tag(text, sx, sy, key) {
    ctx.font = (key ? "700 12px " : "400 12px ") + "'Cascadia Mono', monospace";
    var w = ctx.measureText(text).width + (key ? 12 : 16), h = key ? 20 : 24;
    if (key) promptRect = [sx - w / 2 - 6, sy - h - 6, w + 12, h + 12];
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 2; ctx.strokeRect(sx - w / 2, sy - h, w, h);
    ctx.fillStyle = "#f4f4f4"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, sx, sy - h / 2 + 1);
  }

  function drawPi() {
    if (egg) {
      var e = egg.t, cx = pi.x, cy = pi.y, rock = e < 1.6 ? Math.sin(e * (6 + e * 10)) * Math.min(2, e * 1.5) : 0;
      shadow(cx, cy, 10);
      if (e < 1.6) {
        for (var j = 0; j < 14; j++) { var w = Math.round(Math.sqrt(1 - Math.pow((j - 8) / 8.5, 2)) * 6); ctx.fillStyle = j > 11 ? "#cfcfcf" : "#f4f4f4"; ctx.fillRect(Math.round(cx - w + rock), cy - 14 + j, w * 2, 1); }
        ctx.fillStyle = "#1a1a1a";
        if (e > 0.5) { ctx.fillRect(cx - 2 + rock, cy - 9, 1, 1); ctx.fillRect(cx - 1 + rock, cy - 8, 1, 1); ctx.fillRect(cx + rock, cy - 9, 1, 1); }
        if (e > 1.0) { ctx.fillRect(cx + 2 + rock, cy - 7, 1, 1); ctx.fillRect(cx + 1 + rock, cy - 6, 1, 1); ctx.fillRect(cx - 3 + rock, cy - 6, 1, 1); }
      } else {
        var u = Math.min(1, (e - 1.6) / 0.5);
        ctx.fillStyle = "#f4f4f4"; ctx.fillRect(cx - 9, cy - 3, 5, 3); ctx.fillRect(cx + 5, cy - 2, 4, 2);          // shell halves
        for (var p = 0; p < 6; p++) { ctx.fillStyle = ["#FFB000", "#E879F9", "#4DD6E8"][p % 3]; ctx.fillRect(Math.round(cx + Math.cos(p) * u * 14), Math.round(cy - 8 + Math.sin(p * 2) * u * 10), 1, 1); }
        drawArt(frameCanvas(FRAMES.idle, PIPAL, 10), cx, Math.round(cy - Math.sin(u * 3.14) * 6), false);
      }
      return;
    }
    if (car.driving || aboard()) return;
    shadow(pi.x, pi.y, pi.kaiju ? 12 : 10);
    var moving = (Math.abs(pi.vx) + Math.abs(pi.vy) > 4) && dlg.hidden;
    var blink = hash(Math.floor(t * 3), 9) < 0.06;
    var fr = moving ? Math.floor(pi.dist / 4) % 6 : 0;
    var bob = moving ? 0 : Math.round(Math.sin(t * 3) * 0.5);
    var hopY = pi.hop ? -Math.round(Math.sin((1 - pi.hop) * Math.PI) * 6) : 0;
    if (pi.sq > 0 && !REDUCED) {
      var sxq = pi.sqStart ? 1.15 : 0.87, syq = pi.sqStart ? 0.87 : 1.15;
      ctx.save(); ctx.translate(pi.x, pi.y); ctx.scale(sxq, syq); ctx.translate(-pi.x, -pi.y);
      drawArt(piArt(moving ? "walk" : "idle", fr, pi.dir === "up" && pi.view !== "side"), pi.x, pi.y + bob + hopY, pi.face < 0);
      ctx.restore();
    } else drawArt(piArt(moving ? "walk" : blink ? "blink" : "idle", fr, pi.dir === "up" && pi.view !== "side"), pi.x, pi.y + bob + hopY, pi.face < 0);
    if (pi.kaiju && sky.dark > 0.5) light(pi.x - pi.face * 6, pi.y - 4, 9, "127,227,255", 0.35 * sky.dark);   // the tail's circuit lines, after dark
    if (pi.boost > 0) { ctx.fillStyle = "#E879F9"; ctx.fillRect(Math.round(pi.x - 7 - pi.face * 3), Math.round(pi.y - 4), 2, 1); ctx.fillRect(Math.round(pi.x - 8 - pi.face * 5), Math.round(pi.y - 6), 2, 1); }
  }

  function drawStation(s) {
    var bx = s.x * T + 8, by = s.y * T + 15, sp = SPR[s.id];
    if (s.id === "boat") {
      var bob = Math.round(Math.sin(t * 1.5) * 1);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(bx - 16, by + 3 + bob, 34, 1);
      ctx.drawImage(sp, bx - 15, by - 17 + bob); return;
    }
    if (s.id === "shrine") {
      var sp2 = skin(SPR.shrine), sx1 = Math.round(bx - sp2.width / 2), sy1 = by - sp2.height + 2;
      ctx.drawImage(sp2, sx1, sy1);
      if (sealed() && !(cut && cut.broke)) {
        ctx.fillStyle = "rgba(150,170,190,.55)"; ctx.fillRect(sx1 + 3, sy1 + 15, sp2.width - 6, 1); ctx.fillRect(sx1 + 11, sy1 + 8, 2, 14);
        light(bx, sy1 + 16, 14, "150,170,200", 0.3);
        return;
      }
      var gl = 0.35 + 0.35 * Math.sin(t * 1.3);
      ctx.fillStyle = "rgba(160,120,255," + gl.toFixed(2) + ")"; ctx.fillRect(sx1 + 11, sy1 + 15, 2, 2);
      light(bx, sy1 + 16, 26, "160,120,255", 0.8);
      return;
    }
    if (s.id === "cave" && SPR["e:cavemouth"]) {
      // ref-6's cave (handoff 3, E3): a hillside of mossy boulders round a dark mouth, grass over the
      // lip, the floor running in. the terminal still hums green deep inside
      var cm = SPR["e:cavemouth"], mx = s.x * T + 8 - 30, my = s.y * T + 15 - 45;
      softShadow(s.x * T + 10, s.y * T + 14, 56);
      ctx.drawImage(cm, mx, my);
      var fl2 = 0.55 + 0.35 * Math.sin(t * 7) * Math.sin(t * 2.3);
      ctx.fillStyle = "#15151a"; ctx.fillRect(mx + 26, my + 30, 8, 6);
      ctx.fillStyle = "rgba(74,222,128," + fl2.toFixed(2) + ")"; ctx.fillRect(mx + 27, my + 31, 6, 4);
      if (Math.floor(t * 2) % 2) { ctx.fillStyle = "#b8ffd0"; ctx.fillRect(mx + 27, my + 34, 1, 1); }
      light(mx + 30, my + 34, 22, "74,222,128", 0.7);
      return;
    }
    if (s.id === "cave") {
      // the cave mouth sits in the cliff face; a terminal flickers green inside it
      var cx0 = s.x * T + 1, cy0 = s.y * T;
      ctx.drawImage(sp, cx0, cy0);
      var fl = 0.55 + 0.35 * Math.sin(t * 7) * Math.sin(t * 2.3);
      ctx.fillStyle = "#1c1c1c"; ctx.fillRect(cx0 + 5, cy0 + 5, 6, 5);
      ctx.fillStyle = "rgba(74,222,128," + fl.toFixed(2) + ")"; ctx.fillRect(cx0 + 6, cy0 + 6, 4, 3);
      if (Math.floor(t * 2) % 2) { ctx.fillStyle = "#b8ffd0"; ctx.fillRect(cx0 + 6, cy0 + 8, 1, 1); }
      light(cx0 + 8, cy0 + 8, 16, "74,222,128", 0.7);
      return;
    }
    drawStationArt(s.id, sp, bx, by);
  }
  function drawStationArt(id, sp, bx, by) {
    var s = { id: id };
    shadow(bx, by, s.id === "desk" ? 30 : 14);
    // outlined sprites carry a 1px border, so live details are offset by one pixel into the art
    var sx0 = Math.round(bx - sp.width / 2), sy0 = by - sp.height + 2;
    ctx.drawImage(skin(sp), sx0, sy0);
    var ox = sx0 + 1, oy = sy0 + 1, blink = Math.floor(t * 3);
    if (s.id === "rack") for (var i = 0; i < 6; i++) { ctx.fillStyle = hash(i, blink) < 0.2 ? "#FFB000" : (hash(i + 9, blink) < 0.7 ? "#4ADE80" : "#1c3a24"); ctx.fillRect(ox + 11, oy + 4 + i * 4, 1, 1); ctx.fillStyle = hash(i, blink + 3) < 0.5 ? "#4DD6E8" : "#16323a"; ctx.fillRect(ox + 12, oy + 4 + i * 4, 1, 1); }
    if (s.id === "desk") { ctx.fillStyle = "#0b1a12"; ctx.fillRect(ox + 9, oy + 2, 13, 8); for (i = 0; i < 4; i++) { ctx.fillStyle = "#4ADE80"; ctx.fillRect(ox + 10, oy + 3 + i * 2, 3 + ((hash(i, blink) * 8) | 0), 1); } if (blink % 2) ctx.fillRect(ox + 10 + 11, oy + 9, 1, 1); }
    if (s.id === "tower") { ctx.strokeStyle = "#4ADE80"; ctx.lineWidth = 1; ctx.beginPath(); for (i = 0; i < 13; i++) { var gy = oy + 9 - Math.round((Math.sin(t * 2 + i * 0.8) * 0.5 + 0.5) * 4); if (i) ctx.lineTo(ox + 5 + i, gy + 0.5); else ctx.moveTo(ox + 5, gy + 0.5); } ctx.stroke(); }
    if (s.id === "uplink" && blink % 2) { ctx.fillStyle = "#FF5252"; ctx.fillRect(ox + 9, oy, 2, 1); }
    if (s.id === "macbook") { ctx.fillStyle = "rgba(139,92,246," + (0.5 + Math.sin(t * 2) * 0.3).toFixed(2) + ")"; ctx.fillRect(ox + 11, oy + 5, 8, 6); }
    if (s.id === "mailbox") { ctx.fillStyle = "#FFB000"; ctx.fillRect(ox + 10, oy + (found.mailbox ? 1 : 3), 2, found.mailbox ? 4 : 2); }
    if (s.id === "desk") light(ox + 16, oy + 6, 18, "74,222,128", 0.55);
    if (s.id === "macbook") light(ox + 15, oy + 8, 14, "180,160,255", 0.5);
    if (s.id === "tower") light(ox + 11, oy + 8, 14, "74,222,128", 0.45);
    if (s.id === "rack") light(ox + 12, oy + 14, 16, "77,214,232", 0.4);
    if (s.id === "lighthouse") {
      light(bx, oy + 5, 60, "255,226,138", 0.9);
      beamAt = { x: bx, y: oy + 5 };
      var a = t * 0.8, lx = bx, ly = oy + 5;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,226,138,.12)";
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 120, a - 0.18, a + 0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 120, a + Math.PI - 0.18, a + Math.PI + 0.18); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  /* ════════ states ════════
     what pi can be doing, and where it can go from each. gameState() reads the state, can()
     answers whether a move is allowed, and settle() takes pi out of whatever it's in (the car,
     the helicopter, a room, the terminal, a card, the settings, the tour) before a cutscene or
     the fight takes over, so the two can never overlap.
       explore   walking about             → vehicle, room, terminal, cutscene, fight, paused
       vehicle   the car or the helicopter → explore, paused  (a cutscene or fight settles it first)
       room      inside a building         → explore, paused
       terminal  the cave terminal         → explore
       cutscene  the shrine, side on       → explore, or the reboot
       fight     the orbs                  → explore (once someone reigns), paused
       paused    the menu                  → back to whatever it was */
  var FLOW = { explore: ["vehicle", "room", "terminal", "cutscene", "fight", "paused"], vehicle: ["explore", "paused"], room: ["explore", "paused"],
               terminal: ["explore"], cutscene: ["explore"], fight: ["explore", "paused"], paused: ["explore", "vehicle", "room", "fight"] };
  function baseState() { return !open ? "closed" : paused ? "paused" : side ? "cutscene" : termOpen ? "terminal" : riftBusy() ? "fight" : room ? "room" : car.driving || aboard() ? "vehicle" : "explore"; }
  function can(to) { var f = FLOW[baseState()]; return !!f && f.indexOf(to) >= 0; }
  function landNow() { heli.state = "parked"; heli.z = 0; heli.spin = 0; heli.x = HELI.x * T + 8; heli.y = HELI.y * T + 8; heli.a = 0; heli.target = null; zoomTo = 1; }
  function settle() {
    if (tour) endTour(true);
    if (termOpen) closeTerm();
    if (setOpen()) toggleSettings(false);
    if (paused) setPaused(false);
    pendingRift = false; asking = false;
    if (!dlg.hidden) closeDialog();
    if (car.driving) toggleCar();
    if (aboard()) landNow();
    if (room) exitRoom();
    keys = {}; pi.path = null; pi.want = null; car.target = null;
  }

  /* ════════ ?debug=1: a readout in the corner ════════ */
  var dbg = null, dbgT = 0, frameMs = [];
  function gameState() {
    if (!open) return "closed";
    if (side) return "cutscene (shrine: " + side.phase + ")";
    if (termOpen) return "terminal";
    if (setOpen()) return "settings";
    if (room) return "room (" + room.id + ")";
    if (riftBusy()) return "fight (" + rift.phase + (rift.act ? ", " + rift.act.kind : "") + ")";
    if (car.driving) return "vehicle (car, " + car.gear + ")";
    if (aboard()) return "vehicle (heli, " + heli.state + ")";
    if (!dlg.hidden) return "dialog";
    return "explore";
  }
  function particleCount() {
    return (rift ? rift.parts.length : 0) + sparks.length + ripples.length + skids.length + smoke.length + embers.length + puffs.length + prints.length + rustling.length;
  }
  function saveDump() {
    var o = {};
    [["s", sessionStorage], ["l", localStorage]].forEach(function (st) {
      try { for (var i = 0; i < st[1].length; i++) { var kk = st[1].key(i); o[st[0] + ":" + kk] = st[1].getItem(kk); } } catch (e) {}
    });
    return JSON.stringify(o, null, 1);
  }
  function drawDebug(ms) {
    frameMs.push(ms); if (frameMs.length > 240) frameMs.shift();
    if ((dbgT -= ms / 1000) > 0) return;
    dbgT = 0.25;
    if (!dbg) { dbg = document.createElement("pre"); dbg.className = "w-debug"; dbg.setAttribute("aria-hidden", "true"); root.appendChild(dbg); }
    var sorted = frameMs.slice().sort(function (a, b) { return a - b; }), avg = frameMs.reduce(function (a, b) { return a + b; }, 0) / frameMs.length;
    var live = CANVASES.filter(function (c) { return c.width * c.height > 0; }), mb = live.reduce(function (a, c) { return a + c.width * c.height * 4; }, cv.width * cv.height * 4) / 1048576;
    var au = SND && SND.stats ? SND.stats() : null;
    dbg.textContent = "fps " + (1000 / avg).toFixed(0) + "   frame avg " + avg.toFixed(1) + " ms   p95 " + sorted[Math.floor(sorted.length * 0.95)].toFixed(1) + " ms\n"
      + "state " + gameState() + "   pi " + Math.round(pi.x / T) + "," + Math.round(pi.y / T) + (SEED ? "   seed " + SEED : "") + "\n"
      + "particles " + particleCount() + "   novas " + (rift && rift.novas ? rift.novas.length : 0) + "   quality " + (qTier ? "reduced" : "full") + "   glows " + (GLOWS ? GLOWS.size : 0) + "\n"
      + "audio " + (au ? au.state + "   sources " + au.sources + "   voices " + au.voices + "   loops " + au.loops + "   mood " + (au.mood || "-") : "none") + "\n"
      + "dpr " + dpr + "   css " + W + "x" + H + "   backing " + cv.width + "x" + cv.height + "   scale " + S + "\n"
      + "canvases " + live.length + " live / " + CANVASES.length + " made   ~" + mb.toFixed(1) + " MB\n"
      + "save " + saveDump();
  }

  /* the simulation runs on a fixed 60 Hz step with an accumulator: a frame's time is clamped
     to 100 ms and at most five steps run per frame, so a long hitch (or a tab coming back from
     the background) can't make the car tunnel through a wall or a fight skip ahead */
  var STEP = 1 / 60, acc = 0, paused = false;
  var manual = DEBUG && /[?&]step=1(&|$)/.test(location.search);             // ?debug=1&step=1: only __island.step() moves time
  var qTier = 0, fAvg = 16, qSlow = 0, qFast = 0;
  var qGrace = 0;                                                             // no samples until this time (ms)
  function qualityWatch(ms) {
    if (paused || document.hidden || ms > 250 || performance.now() < qGrace) return;   // a hidden, stalled or just-returned tab says nothing about speed
    fAvg += (ms - fAvg) * 0.05;
    if (fAvg > 20) { qSlow += ms / 1000; qFast = 0; if (qSlow > 2 && qTier === 0) { qTier = 1; qSlow = 0; } }
    else if (fAvg < 12) { qFast += ms / 1000; qSlow = 0; if (qFast > 5 && qTier === 1) { qTier = 0; qFast = 0; } }
    else { qSlow = 0; qFast = 0; }
  }
  function startLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (manual) { if (open) render(); return; } last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function loop(now) {
    raf = 0;
    if (!open) return;
    var ms = now - last; last = now; rdt = Math.min(0.1, Math.max(0.001, ms / 1000));
    if (!paused && !setOpen() && !creditsOpen() && !mapOpen()) {
      acc += Math.min(0.1, Math.max(0, ms / 1000));
      for (var n = 0; acc >= STEP && n < 5; n++) { t += STEP; update(STEP); acc -= STEP; }
      if (acc >= STEP) acc = 0;
    }
    render();
    qualityWatch(ms);
    if (DEBUG) { drawDebug(ms); work.push(performance.now() - now); if (work.length > 600) work.shift(); }
    raf = requestAnimationFrame(loop);
  }
  /* ?debug=1 only: the test API (handoff 2 C5). work[] is how long each recent frame's update and
     render took, in ms, which is what the transition tests check against 16 ms.
     step(n) stops the live loop and runs exactly n fixed steps (none while paused or a menu is
     up, like the loop), then draws once; play() hands time back to the loop. With ?seed=n and
     ?step=1 (the loop never starts) two runs of the same steps end in the same state; setSeed(n)
     reseeds from wherever the island is. Door and warp animations still run on the wall clock */
  var work = [];
  var EVENTS = {
    ptero: function () { ptero.on = false; ptero.next = 0; },                   // the flyover crosses the view from the next step
    roar: function () { roar(); },
    quake: function () { quake = 4; }
  };
  if (DEBUG) window.__island = {
    teleport: function (x, y) { pi.x = x; pi.y = y; pi.vx = pi.vy = 0; pi.path = null; camF.x = null; },
    step: function (n) {
      manual = true; stopLoop();
      var ran = 0;
      if (open && !paused && !setOpen() && !creditsOpen() && !mapOpen()) for (; ran < (n | 0); ran++) { t += STEP; update(STEP); }
      if (open) { rdt = STEP; render(); }
      return ran;
    },
    play: function () { manual = false; if (open) startLoop(); },
    setSeed: function (n) { frand = seeded(+n); rand = seeded(+n ^ 0x5bd1e995); },
    // a save object of either version, checked (and migrated) the way a stored one is; pi's form and
    // the found logs follow it now. comfort settings take effect the next time the island loads
    setSave: function (o) {
      var m = mergeSave(o); if (!m) throw new Error("setSave: not a version 1 or 2 save");
      save = m; saveLocked = false; writeSave();
      found = {}; save.logs.forEach(function (k2) { if (typeof k2 === "string") found[k2] = 1; });
      pi.kaiju = !!save.evolved; paintFound(); paintLandmarks();
      return JSON.parse(JSON.stringify(save));
    },
    getSave: function () { return JSON.parse(JSON.stringify(save)); },
    fireEvent: function (name) { if (!EVENTS[name]) throw new Error("fireEvent: one of " + Object.keys(EVENTS).join(", ")); EVENTS[name](); },
    getState: function () { return { open: open, t: t, manual: manual, room: room ? room.id : null, pi: { x: pi.x, y: pi.y, dir: pi.dir, kaiju: pi.kaiju, path: pi.path ? pi.path.length : 0, stalls: pi.stalls || 0 }, found: Object.keys(found), critters: critters.map(function (c) { return [c.kind, c.x, c.y]; }), events: { ptero: ptero.on, roar: trex.roar > 0, quake: quake }, heli: { x: heli.x, y: heli.y, z: heli.z, a: heli.a, state: heli.state }, iris: !!iris, xfade: !!xfade, doors: BUILDINGS.filter(function (b) { return b.room; }).map(function (b) { return { id: b.id, room: b.room, x: (b.x0 + b.w / 2) * T, y: (b.y0 + b.h) * T + 6, built: !!ROOMS[b.room]._bgDone }; }) }; },
    frames: function (clear) { var w = work.slice(); if (clear) work.length = 0; return w; },
    ground: function () { return { ms: Math.round(groundMs), png: ground.toDataURL() }; },      // the whole painted ground, for art reviews
    props: function () { return props.map(function (p) { return [p.kind, p.tx, p.ty]; }); },
    tile: function (x, y) { return { type: at(x, y), walkable: walkable(x, y), height: lvl(x, y), flags: x >= 0 && y >= 0 && x < MW && y < MH ? COLL[y * MW + x] : C_DEEP }; },   // map codes: 0 deep, 1 shallows, 9 river, 10 bridge
    blocked: function (px, py) { return solidPx(px, py); },                                          // where feet stop, in world px
    safe: function (tx, ty) { return safeTile(tx, ty); },
    canLand: function (px, py) { return canLand(px, py); },
    hopSpot: function (px, py, a) { return hopSpot(px, py, a); },
    // a landing run on the game's own updateHeli: descend from (x, y) moving at (vx, vy) until parked;
    // gives where the helicopter and pi end up, then puts the helicopter, pi and the camera back
    landingFrom: function (x, y, vx, vy) {
      var keep = JSON.stringify(heli), px0 = pi.x, py0 = pi.y, b0 = bubble, z0 = zoomTo;
      heli.state = "descend"; heli.x = x; heli.y = y; heli.z = 34; heli.vx = vx; heli.vy = vy; heli.target = null;
      for (var n = 0; n < 600 && heli.state === "descend"; n++) updateHeli(STEP);
      var out = { heli: [heli.x, heli.y], pi: [pi.x, pi.y], state: heli.state, frames: n };
      Object.assign(heli, JSON.parse(keep)); pi.x = px0; pi.y = py0; bubble = b0; zoomTo = z0;
      return out;
    },
    walkTo: function (tx, ty, loose) { pi.path = piPath([tx, ty], !!loose); pi.want = null; return pi.path ? pi.path.length : null; },   // what a tap on that tile does                                          // where feet stop, in world px
    // decodeMap on any map's data (synthetic ones in the tests): a summary of what it decoded, or its error
    decodeMap: function (o) {
      var d = decodeMap(o);
      return { id: d.id, w: d.w, h: d.h, source: d.source, ground: d.ground.length, height: d.height.length, coll: d.coll.length, footWords: d.foot.length, footPixels: d.footPixels,
               props: d.props.length, buildings: d.buildings.length, stations: Object.keys(d.stations).length, curves: d.shapes.curves.length, paddocks: d.regions.paddocks.length, compound: !!d.regions.compound };
    },
    // the map layers (copies), one value per tile at y * w + x
    layers: function () {
      return { w: MW, h: MH, ground: Array.from(GROUND), height: Array.from(HEIGHT), collision: Array.from(COLL),
               flags: { solid: C_SOLID, shallow: C_SHALLOW, deep: C_DEEP, low: C_LOW, ledgeN: C_LEDGE_N, ledgeE: C_LEDGE_E, ledgeS: C_LEDGE_S, ledgeW: C_LEDGE_W, lava: C_LAVA, climbable: C_CLIMB } };
    },
    kind: function (px, py) { return ["", "grass", "dirt", "sand", "water"][kAt(Math.floor(px), Math.floor(py))]; },
    // the ctf (Phase 9, E1): the board, the solved count, completions this visit, problems in the
    // shipped table, and whether the terminal is waiting on a check
    ctf: function () { return { slots: ctfBoard(), count: ctfCount(), completions: ctfDone, shipped: CTF_SHIPPED.length, shippedProblems: ctfShippedBad.slice(), loaded: CTF.map(function (f) { return f.id; }), pending: !!tWait }; },
    // swap in a table of test flags until the next load (null puts the shipped one back); a table
    // with problems is refused and the current one kept
    ctfLoad: function (list) {
      var use = list === null ? CTF_SHIPPED : list, bad = ctfProblems(use);
      if (bad.length) throw new Error("ctfLoad: " + bad.join("; "));
      ctfUse(use); return this.ctf();
    },
    ctfNorm: function (s) { return ctfNorm(s); },
    ctfHash: function (id, text) { var n = ctfNorm(text); return n === null ? Promise.resolve(null) : ctfHash(id, n); },
    ctfCheck: function (text) { return ctfCheck(text); },
    ctfSubmit: function (text) { return ctfCheck(text).then(function (r) { return r.status === "match" ? ctfSolve(r.id) : r; }); },
    // the cave terminal: open or close it; run a line the way the box does (false while a check
    // is waiting); read what it shows
    terminal: function (on) { if (on) { if (!termOpen) openTerm(); } else if (termOpen) closeTerm(); return termOpen; },
    term: function (line) { tIn.value = line; return submitLine(); },
    termOut: function () { return Array.prototype.map.call(tOut.children, function (el) { return el.textContent; }); }
  };
  /* hidden tab: pause. coming back shows the pause card; nothing (least of all a fight)
     carries on by itself */
  var pauseEl = root.querySelector(".w-pause");
  var lmEl = pauseEl && pauseEl.querySelector(".w-lm");
  function paintLandmarks() {
    if (!lmEl) return;
    lmEl.innerHTML = "";
    STATIONS.filter(function (q) { return q.found; }).forEach(function (q) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("data-lm", q.id); if (found[q.id]) b.setAttribute("data-found", "1");
      b.textContent = q.name + " · " + q.sec; b.setAttribute("aria-label", q.name + ", " + q.sec + (found[q.id] ? ", found" : ""));
      lmEl.appendChild(b);
    });
  }
  /* the tour: every section in about a minute. pi jumps to each landmark in turn and its card
     opens for six seconds; space (or e) skips ahead, escape stops. it ends on the contact card */
  var TOUR = ["lighthouse", "rack", "desk", "uplink", "tower", "macbook", "tablet", "mailbox"], tour = null;
  var tourBtn = root.querySelector(".w-tour");
  function paintTour() { if (tourBtn) { tourBtn.setAttribute("aria-pressed", tour ? "true" : "false"); tourBtn.innerHTML = tour ? "■<span class=\"w-sound-l\"> stop tour</span>" : "▶<span class=\"w-sound-l\"> tour</span>"; } }
  function startTour() {
    egg = null;
    if (side || riftBusy()) { bubble = { text: "pi:~$ the tour can wait for this.", t: 2.5 }; return; }
    if (paused) setPaused(false);
    if (setOpen()) toggleSettings(false);
    tour = { i: -1, t: 0 }; paintTour(); tourStep();
  }
  function tourStep() {
    if (!tour) return;
    tour.i++; tour.t = 0;
    if (tour.i >= TOUR.length) { endTour(false); return; }
    fade = 0.8; visitLandmark(TOUR[tour.i]);
    finishTyping();                                              // no typewriter on the tour: read straight away
    announce("tour, " + (tour.i + 1) + " of " + TOUR.length + ".");
  }
  function endTour(stopped) {
    if (!tour) return;
    var last = !stopped; tour = null; paintTour();
    if (stopped) closeDialog();
    else if (last) bubble = { text: "pi:~$ that's everything. walk around, or head back.", t: 4 };
  }
  function updateTour(dt) { if (tour && (tour.t += dt) > 6) { if (tour.i < TOUR.length - 1) tourStep(); else endTour(false); } }     // the contact card stays up
  if (tourBtn) tourBtn.addEventListener("click", function () { if (tour) endTour(true); else startTour(); });
  // from the menu: take pi to a landmark and open its card
  function visitLandmark(id) {
    var q = STATIONS.filter(function (x) { return x.id === id; })[0]; if (!q) return;
    if (side) return;
    if (!riftBusy()) { if (termOpen) closeTerm(); if (aboard()) landNow(); goto(id); }
    interact(q);
  }
  function setPaused(on) {
    if (!open) return;
    paused = on; clearKeys();
    if (on) paintLandmarks();
    if (pauseEl) pauseEl.hidden = !on;
    if (on) { var b0 = pauseEl && pauseEl.querySelector("button"); if (b0) b0.focus({ preventScroll: true }); }
    else { last = performance.now(); acc = 0; cv.focus({ preventScroll: true }); }
  }
  if (pauseEl) pauseEl.addEventListener("click", function (e) {
    var lm = e.target.closest && e.target.closest("[data-lm]");
    if (lm) { setPaused(false); visitLandmark(lm.getAttribute("data-lm")); return; }
    var a2 = e.target.closest && e.target.closest("[data-a]"); if (!a2) return;
    var act = a2.getAttribute("data-a");
    setPaused(false);
    if (act === "controls") { setPaused(true); var cl = pauseEl.querySelector(".w-ctl"); cl.hidden = !cl.hidden; return; }
    if (act === "settings") toggleSettings(true); else if (act === "tour") startTour(); else if (act === "map") toggleMap(true); else if (act === "leave") exit();
  });

  /* ════════ the warp: orb → island and back ════════ */
  var streaks = [];
  function warpRun(dir, done) {
    if (REDUCED) { done(); return; }
    var c = window.orbs && window.orbs[0] ? window.orbs[0].center() : [innerWidth / 2, innerHeight / 2, 100];
    warp.hidden = false;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    warp.width = Math.floor(innerWidth * d); warp.height = Math.floor(innerHeight * d);
    streaks = [];
    for (var i = 0; i < 260; i++) streaks.push({ a: rand() * 6.283, r: rand() * 40, v: 0.5 + rand(), c: rand() });
    var start = performance.now(), dur = dir > 0 ? 1000 : 650, far = Math.hypot(innerWidth, innerHeight), bloom = dir > 0 && OPT.flash && flashGate();
    (function frame(now) {
      var p = Math.min(1, (now - start) / dur), e = dir > 0 ? p * p * p : 1 - Math.pow(1 - p, 3);
      wctx.setTransform(d, 0, 0, d, 0, 0);
      wctx.fillStyle = "rgba(4,4,10," + (dir > 0 ? Math.min(1, p * 1.4) : 1 - p).toFixed(3) + ")";
      wctx.clearRect(0, 0, innerWidth, innerHeight); wctx.fillRect(0, 0, innerWidth, innerHeight);
      wctx.globalCompositeOperation = "lighter"; wctx.lineCap = "round";
      streaks.forEach(function (s) {
        var prog = dir > 0 ? e : 1 - e;
        var r1 = c[2] * 0.4 + s.r + prog * far * s.v, r0 = r1 - (20 + prog * 260 * s.v);
        var col = s.c < 0.3 ? "244,84,166" : s.c < 0.55 ? "139,92,246" : s.c < 0.8 ? "77,214,232" : "252,248,238";   // pink, violet, cyan, white
        wctx.strokeStyle = "rgba(" + col + "," + (0.25 + 0.6 * Math.sin(p * Math.PI)).toFixed(3) + ")";
        wctx.lineWidth = 1 + prog * 2;
        wctx.beginPath(); wctx.moveTo(c[0] + Math.cos(s.a) * Math.max(0, r0), c[1] + Math.sin(s.a) * Math.max(0, r0)); wctx.lineTo(c[0] + Math.cos(s.a) * r1, c[1] + Math.sin(s.a) * r1); wctx.stroke();
      });
      // a white bloom at the peak of the jump
      if (dir > 0 && p > 0.75 && bloom) { wctx.fillStyle = "rgba(240,232,255," + ((p - 0.75) * 4 * 0.9).toFixed(3) + ")"; wctx.fillRect(0, 0, innerWidth, innerHeight); }
      wctx.globalCompositeOperation = "source-over";
      if (p < 1) requestAnimationFrame(frame); else done();
    })(start);
  }
  function hideWarp() {
    if (REDUCED) { warp.hidden = true; return; }
    warp.style.transition = "opacity .5s ease"; warp.style.opacity = "0";
    setTimeout(function () { warp.hidden = true; warp.style.opacity = ""; warp.style.transition = ""; }, 520);
  }

  var cardEl = root.querySelector(".w-card"), cardT = 0;
  var cardGo = cardEl && cardEl.querySelector(".w-card-go");
  function showCard(offer) {
    if (!cardEl) return;
    cardEl.hidden = true; void cardEl.offsetWidth; cardEl.hidden = false;       // restart the fade
    clearTimeout(cardT);
    if (cardGo) cardGo.hidden = !offer; cardEl.classList.toggle("w-card-stay", !!offer);
    if (offer) { var b0 = cardGo.querySelector("button"); if (b0) b0.focus({ preventScroll: true }); return; }
    cardT = setTimeout(function () { cardEl.hidden = true; }, REDUCED ? 1600 : 2200);
  }
  if (cardGo) cardGo.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-a]"); if (!b) return;
    cardEl.hidden = true; cv.focus({ preventScroll: true });
    if (b.getAttribute("data-a") === "tour") startTour();
  });
  // what a deep link can name: a landmark, or the section it holds
  var ROUTES = { rack: "rack", homelab: "rack", dns: "rack", desk: "desk", triage: "desk", uplink: "uplink", aws: "uplink", terraform: "uplink", tower: "tower", monitoring: "tower",
               lighthouse: "lighthouse", experience: "lighthouse", macbook: "macbook", site: "macbook", tablet: "tablet", education: "tablet", mailbox: "mailbox", contact: "mailbox" };
  window.addEventListener("hashchange", function () { if (!open && location.hash.indexOf("#island") === 0) enter(); });
  var lastFocus = null;
  /* while the island is open it is the whole page: everything else in the body is inert (no
     focus, no clicks, hidden from screen readers), and Tab wraps inside the topmost layer. the
     terminal, credits, map, settings and menu hold focus; otherwise Tab cycles the HUD, the canvas
     and an open landmark card, which pi can walk away from */
  var madeInert = [];
  function setBackground(off) {
    if (off) [].forEach.call(document.body.children, function (el) { if (el !== root && el.tagName !== "SCRIPT" && !el.inert) { el.inert = true; madeInert.push(el); } });
    else { madeInert.forEach(function (el) { el.inert = false; }); madeInert = []; }
  }
  function topLayer() { return [term, credEl, mapEl, setEl, pauseEl].filter(function (el) { return el && !el.hidden; })[0] || root; }
  var TABBABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !open || e.defaultPrevented) return;          // the terminal's Tab completes words instead
    var items = [].filter.call(topLayer().querySelectorAll(TABBABLE), function (el) { return el.getClientRects().length > 0 && !el.closest("[hidden]"); });
    if (!items.length) { e.preventDefault(); return; }
    // every Tab is moved by hand: safari's own order skips buttons and links, and would walk out
    var i = items.indexOf(document.activeElement), n = items.length;
    e.preventDefault();
    items[i < 0 ? (e.shiftKey ? n - 1 : 0) : (i + (e.shiftKey ? n - 1 : 1)) % n].focus();
  });
  var entering = false;
  function enter() {
    if (open || entering) return;
    entering = true;
    lastFocus = document.activeElement;
    if (window.orbs && window.orbs[0]) window.orbs[0].boost();
    startSound(); sfx("whoosh");
    warpRun(1, function () {
      entering = false;
      if (open) return;
      open = true; size(); bindSession(); setBackground(true);
      document.documentElement.classList.add("in-world");
      root.hidden = false; root.classList.add("show");
      var first = false;
      first = !save.hatched; save.hatched = true; writeSave();
      egg = first && !REDUCED ? { t: 0 } : null;
      pi.x = SPAWN.x; pi.y = SPAWN.y; pi.vx = pi.vy = 0; pi.path = null; keys = {};
      if (first) { pi.x = 50 * T + 8; pi.y = 61 * T + 10; if (!walkable(50, 61)) { pi.x = SPAWN.x; pi.y = SPAWN.y; } }   // the mailbox is on screen
      hintFrom = { x: pi.x, y: pi.y }; sinceLog = 0;
      var lp = save.lastPos;                                            // back where pi left off
      if (!first && lp && safeTile(Math.floor(lp[0] / T), Math.floor(lp[1] / T))) { pi.x = lp[0]; pi.y = lp[1]; }   // only on safe ground (C4-2)
      zoom = REDUCED ? 1 : 2.6; zoomTo = 1;
      if (!first) bubble = { text: "pi:~$ welcome back.", t: 2.5 };
      camF.x = null;
      var ruler = save.ruler;
      if (ruler && !rift && window.Orb) { rift = { phase: "reign", winner: ruler, t: 0, orbs: [rival(ruler, 0)], parts: [], shake: 0, dim: 0, ring: 0 }; var w0 = rift.orbs[0]; w0.x = ARENA.x; w0.y = ARENA.y; w0.z = 34; w0.scale = 1.7; paintFound(); }
      else if (!ruler && !rift && Object.keys(found).length === TOTAL) later(first ? 3 : 1.2, function () { if (!rift && dlg.hidden) askRift(); });
      startLoop();
      cv.focus({ preventScroll: true });
      var deep = (location.hash.match(/^#island\/([a-z-]+)/) || [])[1], lmk = deep && ROUTES[deep];
      showCard(!deep && TOUCH); irisOpen();
      if (deep === "tour") later(0.2, startTour);
      else if (lmk) { egg = null; later(0.2, function () { visitLandmark(lmk); }); }
      announce("pi's island, a playable version of this portfolio. Press Escape for a menu listing all eight sections.");
      hideWarp();
      if (window.orbs) window.orbs.forEach(function (o) { o.pause(true); });
      if (history.replaceState) history.replaceState(null, "", "#island");
    });
  }
  var exiting = false;
  function exit(then) {
    if (!open || exiting) return;
    exiting = true;
    if (!room && !side && !riftBusy()) { save.lastPos = [Math.round(pi.x), Math.round(pi.y)]; writeSave(); }
    if (side) { side = null; freeSideArt(); }
    closeDialog(); if (termOpen) closeTerm();
    if (car.driving) toggleCar();
    if (aboard()) { heli.state = "parked"; heli.z = 0; heli.spin = 0; heli.x = HELI.x * T + 8; heli.y = HELI.y * T + 8; heli.a = 0; zoomTo = 1; }
    sfx("whoosh", undefined, undefined, { out: true }); stopSound();
    var finish = function () {
      paused = false; if (pauseEl) pauseEl.hidden = true; tour = null; paintTour(); if (credEl) credEl.hidden = true; if (mapEl) mapEl.hidden = true;
      open = false; exiting = false; stopLoop(); unbindSession(); setBackground(false);
      root.classList.remove("show"); root.hidden = true;
      document.documentElement.classList.remove("in-world");
      if (window.orbs) window.orbs.forEach(function (o) { o.pause(false); o.calm(); });
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      hideWarp();
      if (then) { var el = document.querySelector(then); if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); }
      else (lastFocus && lastFocus.focus && lastFocus !== document.body ? lastFocus : orbBtn).focus({ preventScroll: true });
    };
    if (REDUCED) { finish(); return; }
    root.classList.remove("show");
    warpRun(-1, finish);
  }

  orbBtn.addEventListener("click", enter);
  window.islandEnter = enter;
  root.querySelector(".w-exit").addEventListener("click", function () { exit(); });
})();
