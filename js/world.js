/* world: pi's island. click the orb and you warp into a top-down jurassic island
   you can walk around as pi. every landmark is a piece of the portfolio: the rack
   is the homelab, the lighthouse is the security work, the boat takes you home.
   there's a volcano, fenced paddocks, a helicopter on the pad, Ammaar's koi, cats,
   cockatiels and M3, and a terminal left logged in inside a cave.
   keyboard: wasd / arrows to walk, e / space / enter to look, esc to leave.
   pointer: tap anywhere to walk there, tap a landmark to walk up and look. */
(function () {
  var root = document.getElementById("world");
  var orbBtn = document.querySelector(".orb-btn");
  if (!root || !orbBtn) return;
  var cv = root.querySelector(".w-cv"), ctx = cv.getContext("2d");
  var warp = document.querySelector("canvas.warp"), wctx = warp.getContext("2d");
  var dlg = root.querySelector(".w-dialog"), dName = dlg.querySelector(".w-name"), dText = dlg.querySelector(".w-text"), dLinks = dlg.querySelector(".w-links");
  var foundEl = root.querySelector(".w-found");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  /* ════════ map ════════ */
  var T = 16, MW = 72, MH = 58, CX = 36, CY = 29;
  var DEEP = 0, SHAL = 1, SAND = 2, GRASS = 3, PATH = 4, POND = 5, DOCK = 6, LAVA = 7, PAD = 8, RIVER = 9, BRIDGE = 10;
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  function rad(a) { return 21.5 + 2.6 * Math.sin(3 * a + 1.1) + 1.8 * Math.sin(5 * a + 2.3) + 1.1 * Math.sin(7 * a + 0.4); }
  var map = [], x, y;
  for (y = 0; y < MH; y++) {
    map.push([]);
    for (x = 0; x < MW; x++) {
      var dx = (x + 0.5 - CX) / 1.25, dy = y + 0.5 - CY, d = Math.sqrt(dx * dx + dy * dy), r = rad(Math.atan2(dy, dx));
      map[y].push(d > r + 2.8 ? DEEP : d > r ? SHAL : d > r - 2.3 ? SAND : GRASS);
    }
  }
  function at(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? DEEP : map[y][x]; }
  function land(t) { return t === GRASS || t === SAND || t === PATH || t === PAD || t === BRIDGE; }
  function wet(t) { return t === DEEP || t === SHAL || t === POND || t === RIVER; }
  // the koi pond: a wobbly blob (tile units). < 1 is water
  var KP = { x: 54.5, y: 35.5, rx: 5.2, ry: 2.3 };
  function pondF(fx, fy) {
    var dx = (fx - KP.x) / KP.rx, dy = (fy - KP.y) / KP.ry, a = Math.atan2(dy, dx);
    return Math.sqrt(dx * dx + dy * dy) / (1 + 0.13 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + 2.1) + 0.05 * Math.sin(7 * a));
  }
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] === GRASS && pondF(x + 0.5, y + 0.5) < 1) map[y][x] = POND;
  /* the layout, like a level: a round plaza is the hub; one main road loops out from it to
     each district (the park gate and the plateau to the north, the jungle and the uplink to
     the west, the paddocks and the lighthouse to the east, the dock to the south), and
     narrower trails lead off it to the landmarks. roads and the river are smooth curves,
     not grid lines. the river falls off the plateau and runs west to the sea; the west road
     crosses it on a bridge. */
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
  function carve(pts, width, paint) {
    spline(pts, function (fx, fy, q) {
      var wd = typeof width === "function" ? width(q) : width, r0 = Math.ceil(wd);
      for (var j = -r0; j <= r0; j++) for (var i = -r0; i <= r0; i++) {
        var tx = Math.floor(fx) + i, ty = Math.floor(fy) + j;
        if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
        if (Math.hypot(tx + 0.5 - fx, ty + 0.5 - fy) <= wd / 2) paint(tx, ty);
      }
    });
  }
  var RIVER_PTS = [[24.5, 18.2], [23.2, 21], [21, 23.8], [18.6, 26.6], [16.2, 29.3], [13.2, 31.2], [10.5, 32.2]];
  carve(RIVER_PTS, function (q) { return 1.5 + q * 1.1; }, function (tx, ty) { if (map[ty][tx] === GRASS || map[ty][tx] === SAND) map[ty][tx] = RIVER; });
  function road(pts, width) { carve(pts, width, function (tx, ty) { var m = map[ty][tx]; if (m === GRASS || m === SAND) map[ty][tx] = PATH; else if (m === RIVER) map[ty][tx] = BRIDGE; }); }
  var PLAZA = { x: 36.5, y: 29.5, r: 2.9 };
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (Math.hypot(x + 0.5 - PLAZA.x, y + 0.5 - PLAZA.y) < PLAZA.r && land(at(x, y))) map[y][x] = PATH;
  var dockY = CY; while (land(at(CX, dockY + 1))) dockY++;
  road([[36.5, 28], [36.4, 24], [36.6, 20], [37, 16.5]], 1.9);                                  // north: the gate, the stairs
  road([[33.6, 29.6], [29.5, 30.6], [25, 29.8], [20.5, 28.4], [16.5, 28.4]], 1.9);             // west: over the bridge to the uplink
  road([[39.5, 29.5], [44, 28.4], [49, 28.9], [55, 29.6], [61.5, 28.6]], 1.9);                 // east: to the lighthouse
  road([[36.8, 32], [37.2, 36], [36.4, 40.5], [36.6, dockY + 0.5]], 1.9);                      // south: to the dock
  road([[36.5, 16.5], [38.5, 16.8]], 1);                                                       // the watchtower
  road([[31.3, 40.8], [28, 42.6], [25, 44.6], [21, 45.4]], 1);                              // the outpost, past the helipad
  road([[20, 22.5], [18.4, 19.8], [16.6, 17.4]], 1);                                           // an old trail into the woods
  road([[48.8, 29.1], [47.6, 32.4], [47.2, 35.8], [48.6, 39.2]], 1);                           // the garden: pond, blanket, the M3
  road([[36.7, 38.2], [33.5, 39.4], [31.3, 40.8]], 1);                                         // the helipad
  road([[36.7, 41.4], [39.5, 41.9], [42, 42.2]], 1);                                           // the tablet
  road([[36, dockY], [33.4, dockY - 0.2]], 1);                                                 // the mailbox
  for (y = dockY + 1; y <= dockY + 4; y++) { map[y][CX] = DOCK; map[y][CX + 1] = DOCK; }
  var HELI = { x: 29, y: 42 };                                         // the helipad, 3x3 tiles
  for (y = HELI.y - 1; y <= HELI.y + 1; y++) for (x = HELI.x - 1; x <= HELI.x + 1; x++) if (land(at(x, y))) map[y][x] = PAD;
  // buildings: the visitor centre off the plaza, and the supply depot the robots stock from the dock
  var BUILDINGS = [
    { id: "visitor", x0: 29, y0: 24, w: 4, h: 2, room: "visitor", name: "the visitor centre", text: "the visitor centre. the robots keep it stocked. there's a map on the wall with eight pins in it, and a sign by the door: 'please do not tap on the glass. the raptors can see you.'" },
    { id: "bunker", x0: 17, y0: 43, w: 4, h: 2, room: "bunker", name: "the bunker", text: "the outpost bunker." },
    { id: "depot", x0: 39, y0: 43, w: 3, h: 2, room: "depot", name: "the supply depot", text: "the supply depot. crates come off the boat, the cargo bots haul them in here, and the drones fly them out to wherever something needs fixing." }
  ];

  // height: a plateau across the north; the volcano stands on top of it
  var ELEV = [];
  for (y = 0; y < MH; y++) {
    ELEV.push([]);
    for (x = 0; x < MW; x++) {
      var tl = map[y][x], lv = 0;
      if (tl === GRASS || tl === PATH) {
        var hx = (x + 0.5 - 34) / 12.5, hy = (y + 0.5 - 14.2) / 5.6, ha = Math.atan2(hy, hx);
        var hw = 1 + 0.08 * Math.sin(3 * ha + 0.5) + 0.06 * Math.sin(5 * ha + 2);
        if (hx * hx + hy * hy < hw * hw) lv = 1;
      }
      ELEV[y].push(lv);
    }
  }
  // the volcano is a heightfield (world px): a cone with gullies, a crater bowl and a lava lake.
  // (x, y) is the centre of its footprint; squash flattens the footprint front to back
  var VOLC = { x: 33 * T + 8, y: 11 * T + 4, R: 118, H: 104, sq: 1.65, rc: 27 };
  function volcD(wx, wy) { var u = wx - VOLC.x, v = (wy - VOLC.y) * VOLC.sq; return Math.sqrt(u * u + v * v); }
  var RIMH = Math.pow(1 - VOLC.rc / VOLC.R, 1.25) * VOLC.H;
  function lvl(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? 0 : ELEV[y][x]; }
  function rim(x, y) { var l = lvl(x, y); return lvl(x + 1, y) !== l || lvl(x - 1, y) !== l || lvl(x, y + 1) !== l || lvl(x, y - 1) !== l; }

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", x: 32, y: 27, name: "signpost", text: "pi's jurassic island. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. find all eight and something on the island wakes up. the boat at the dock takes you back. (the paddocks are fenced. please don't feed the raptors.)" },
    { id: "rack", room: "bunker", x: 2, y: 3, name: "the rack", found: true, text: "the homelab. two Raspberry Pi 5 nodes run AdGuard Home and Unbound behind a keepalived floating IP. pull the plug on one and DNS keeps answering from the other within seconds. failover tested in both directions, config synced every 10 minutes.", links: [["ha-dns repo ↗", GH + "homelab/tree/main/ha-dns"]] },
    { id: "desk", room: "bunker", x: 6, y: 3, name: "the desk", found: true, wide: true, text: "a Claude intake triage assistant. messy free-text help requests go in; structured records come out with category, urgency, summary, next step, and a human-review flag. a 15-case eval harness took classification accuracy to 100%.", links: [["repo ↗", GH + "claude-intake-triage"], ["demo ↗", "https://www.loom.com/share/c43efcd9c3314bcd9cda3002282d31a5"]] },
    { id: "uplink", x: 23, y: 46, name: "the uplink", found: true, text: "an AWS static site built end to end with Terraform: S3 hosting, CloudFront delivery, Route 53 DNS, IAM access controls. one command up, one command down. Ammaar is an AWS Certified Cloud Practitioner.", links: [["terraform repo ↗", GH + "homelab/tree/main/terraform-aws-static-site"]] },
    { id: "tower", x: 38, y: 16, name: "the watchtower", found: true, text: "the monitoring stack. Prometheus and Grafana watch every host and container in the lab through node-exporter and cAdvisor, and Uptime Kuma pings every service. from up here you can see the whole island, and the volcano is still warm.", links: [["monitoring ↗", GH + "homelab/tree/main/monitoring-stack"], ["uptime ↗", GH + "homelab/tree/main/uptime-monitoring"]] },
    { id: "lighthouse", x: 63, y: 28, name: "the lighthouse", found: true, text: "the security work. Ammaar is a cyber security analyst in Cyber Ready Clinic's internship cohort, supporting nonprofit cyber-readiness assessments with the Discover5 and Ready5 frameworks, with findings aligned to the NIST CSF and CIS Controls. the Ready5 Practitioner badge is in progress, expected Nov 2026.", links: [["experience", "#experience"]] },
    { id: "macbook", x: 49, y: 38, name: "a macbook on a blanket", found: true, text: "this website. hand-rolled HTML, CSS, JavaScript and a little Python, no frameworks. the orb, the hands, and this island are all drawn in plain canvas. you're standing in it.", links: [["site repo ↗", GH + "ammaarrehman.github.io"]] },
    { id: "tablet", x: 42, y: 41, name: "a stone tablet", found: true, text: "the record. Howard Community College, A.A. through Dec 2026, 3.65 GPA, Dean's List. starting at UMD's Smith School, B.S. Information Systems, in Jan 2027. AWS Certified Cloud Practitioner, CompTIA Tech+. FBLA State and Regional Champion.", links: [["education", "#education"]] },
    { id: "mailbox", x: 33, y: dockY - 1, name: "the mailbox", found: true, text: "ammaarrehmanf@gmail.com. email is the fastest way to reach Ammaar.", links: [["email ↗", "mailto:ammaarrehmanf@gmail.com"], ["linkedin ↗", "https://www.linkedin.com/in/ammaarrehman/"]] },
    { id: "drink", x: 40, y: 31, name: "a drink stand", text: "pi takes a sip. zoom mode for ten seconds." },
    { id: "shrine", x: 16, y: 16, name: "an old shrine", text: "" },
    { id: "cave", x: 29, y: 14, name: "a cave in the cliff", text: "there's a terminal in here, still humming. someone left it logged in." },
    { id: "boat", x: 38, y: dockY + 3, name: "the boat", text: "the boat back to the mainland. sail back to the site?", links: [["sail back ↩", "#exit"]] }
  ];
  var TOTAL = STATIONS.filter(function (s) { return s.found; }).length;
  var OUT = STATIONS.filter(function (s) { return !s.room; });        // the landmarks that stand outdoors
  var found = {};
  try { (JSON.parse(sessionStorage.getItem("pi-found") || "[]")).forEach(function (k) { found[k] = 1; }); } catch (e) {}

  /* ════════ collision ════════ */
  var solid = {}, fence = {};
  function k(x, y) { return x + "," + y; }
  OUT.forEach(function (s) {
    if (s.id === "boat") return;
    solid[k(s.x, s.y)] = 1;
    if (s.wide) { solid[k(s.x - 1, s.y)] = 1; solid[k(s.x + 1, s.y)] = 1; }
  });
  function nearStation(x, y) {
    for (var i = 0; i < OUT.length; i++) { var s = OUT[i]; if (Math.abs(s.x - x) <= 1 && y >= s.y - 2 && y <= s.y + 1) return true; }
    return false;
  }
  function near(x, y, r, fn) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (fn(x + i, y + j)) return true; return false; }
  // cliffs: tiles where the ground changes level can't be walked, except where a path makes stairs
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] !== PATH && (map[y][x] === GRASS || map[y][x] === SAND) && rim(x, y)) solid[k(x, y)] = 1;
  // nobody climbs the volcano
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (volcD(x * T + 8, y * T + 8) < VOLC.R * 0.93) solid[k(x, y)] = 1;
  // the park gate over the north road, and the electric fences around the paddocks
  var GATE = { x: 36, y: 23 };
  solid[k(GATE.x - 2, GATE.y)] = 1; solid[k(GATE.x + 2, GATE.y)] = 1;
  var PADDOCKS = [
    { name: "t-rex paddock", x0: 15, y0: 31, x1: 25, y1: 40 },
    { name: "raptor pen", x0: 48, y0: 17, x1: 57, y1: 25 }
  ];
  PADDOCKS.forEach(function (p) {
    for (y = p.y0; y <= p.y1; y++) for (x = p.x0; x <= p.x1; x++) {
      if ((x === p.x0 || x === p.x1 || y === p.y0 || y === p.y1) && land(at(x, y))) { fence[k(x, y)] = 1; solid[k(x, y)] = 1; }
    }
  });
  function inPaddock(x, y) { return PADDOCKS.some(function (p) { return x > p.x0 && x < p.x1 && y > p.y0 && y < p.y1; }); }
  BUILDINGS.forEach(function (bd) { for (y = bd.y0; y < bd.y0 + bd.h; y++) for (x = bd.x0; x < bd.x0 + bd.w; x++) solid[k(x, y)] = 1; });
  function inBuilding(x, y) { return BUILDINGS.some(function (bd) { return x >= bd.x0 - 1 && x <= bd.x0 + bd.w && y >= bd.y0 - 2 && y <= bd.y0 + bd.h; }); }
  /* planting, the way a level artist would: forests are solid masses from a low-frequency
     noise field (so they read as woods, not a scatter), trees inside them are jittered off the
     grid, ferns and tall grass only grow along forest edges and water, and meadows stay open
     with a lone tree here and there. boulders gather under the cliffs and round the volcano. */
  function fbm(x, y) {
    var v = 0, a2 = 1, f = 0.07, n = 0;
    for (var o = 0; o < 3; o++) { v += a2 * (Math.sin(x * f + o * 1.7) * Math.cos(y * f * 1.13 + o * 2.3) + Math.sin((x + y) * f * 0.7 + o)); n += a2 * 2; a2 *= 0.5; f *= 2.1; }
    return v / n;
  }
  var FOREST_BIAS = [[14, 16, 5, 0.35], [58, 32, 3, 0.25], [21, 50, 4, 0.3], [30, 17, 5, 0.3], [44, 17, 4, 0.25], [61, 36, 4, 0.3], [27, 35, 3, 0.2]];
  function forest(x, y) {
    var v = fbm(x, y) + 0.08;
    FOREST_BIAS.forEach(function (fb) { v += fb[3] * Math.max(0, 1 - Math.hypot(x - fb[0], y - fb[1]) / fb[2]); });
    return v;
  }
  var CLEAR = [[19.5, 22.5, 4], [44, 42, 5.5], [36.5, 29.5, 5], [51, 39, 3.2], [29, 42, 3], [20, 36, 3.5], [44, 34, 2.6], [55, 29, 3], [52, 21, 3]];
  var COMPOUND = { x0: 14, y0: 42, x1: 26, y1: 48, gate: [44, 45] };
  function inCompound(x, y) { return x >= COMPOUND.x0 && x <= COMPOUND.x1 && y >= COMPOUND.y0 - 1 && y <= COMPOUND.y1; }
  function clearing(x, y) { return inCompound(x, y) || Math.hypot(x - 16, y - 16.5) < 1.7 || CLEAR.some(function (c) { return Math.hypot(x - c[0], y - c[1]) < c[2]; }); }
  var props = [];     // trees, palms, ferns, rocks, nests: static, y-sorted with everything else
  function busy(a, b) { var q = at(a, b); return q === PATH || q === POND || q === PAD || q === DOCK || q === LAVA || q === RIVER || q === BRIDGE || fence[k(a, b)] || nearStation(a, b) || inBuilding(a, b) || Math.abs(a - GATE.x) <= 3 && Math.abs(b - GATE.y) <= 1; }
  function nearWater(a, b, r) { return near(a, b, r, function (i, j) { var q = at(i, j); return q === RIVER || q === POND; }); }
  function jit(x, y, n) { return Math.round((hash(x * n, y * 3 + n) - 0.5) * 8); }
  for (y = 1; y < MH - 1; y++) for (x = 1; x < MW - 1; x++) {
    var t = map[y][x], h = hash(x, y);
    if (volcD(x * T + 8, y * T + 8) < VOLC.R + 6) {       // boulders ring the volcano's foot
      if (t === GRASS && volcD(x * T + 8, y * T + 8) > VOLC.R * 0.93 && h < 0.28 && !busy(x, y) && !solid[k(x, y)]) props.push({ kind: h < 0.12 ? "boulder" : "stones", tx: x, ty: y, ox: jit(x, y, 1), oy: jit(x, y, 2) / 2 });
      continue;
    }
    if (t === GRASS && !solid[k(x, y)]) {
      var F = forest(x, y), edge = F > 0.12 && F < 0.26, inF = F >= 0.26;
      var dense = inF ? 0.82 : edge ? 0.18 : 0.025;
      if (inPaddock(x, y)) dense *= 0.3;
      if (!clearing(x, y) && h < dense && !near(x, y, 1, busy)) {
        var kind = inF ? (h < dense * 0.18 ? "jtree" : h < dense * 0.55 ? "tree" : h < dense * 0.8 ? "tree2" : "tfern") : (h < dense * 0.5 ? "tree2" : "palm");
        if (kind === "jtree" && near(x, y, 1, function (a2, b2) { return solid[k(a2, b2)]; })) kind = "tree";
        props.push({ kind: kind, tx: x, ty: y, flip: hash(y, x) < 0.5, ox: jit(x, y, 1), oy: jit(x, y, 2) / 2 }); solid[k(x, y)] = 1;
        continue;
      }
      var h2 = hash(x * 7, y * 13);
      if (busy(x, y)) continue;
      if ((edge || nearWater(x, y, 1)) && h2 < 0.3) props.push({ kind: h2 < 0.2 ? "fern" : "cycad", tx: x, ty: y, flip: hash(y, x) < 0.5, ox: jit(x, y, 3), oy: 0 });   // pi walks behind these
      else if (!inF && fbm(x * 2.3 + 40, y * 2.3) > 0.25 && h2 < 0.36) props.push({ kind: "tallgrass", tx: x, ty: y, flip: h2 < 0.18, ox: jit(x, y, 4), oy: jit(x, y, 6) / 2 });
      else if (rim(x, y + 1) && h2 < 0.25) props.push({ kind: "stones", tx: x, ty: y, ox: jit(x, y, 5), oy: 0 });
    } else if (t === SAND && h < 0.11 && !solid[k(x, y)]) {
      if (near(x, y, 1, function (a2, b2) { return busy(a2, b2) || solid[k(a2, b2)]; })) continue;
      props.push({ kind: "palm", tx: x, ty: y, flip: h < 0.055, ox: jit(x, y, 1), oy: 0 }); solid[k(x, y)] = 1;
    } else if (t === SHAL && h < 0.02 && Math.abs(x - CX) > 3) {
      props.push({ kind: "rock", tx: x, ty: y });
    }
  }
  // nests in the meadow, each with a clutch of speckled eggs
  var nests = [[42, 45], [47, 44], [21, 22], [19, 37]].filter(function (n) { return walkable0(n[0], n[1]); }).map(function (n) {
    solid[k(n[0], n[1])] = 1; var p = { kind: "nest", tx: n[0], ty: n[1], eggs: 2 + ((hash(n[0], n[1]) * 3) | 0) }; props.push(p); return p;
  });
  function walkable0(x, y) { return land(at(x, y)) && at(x, y) !== PATH && !solid[k(x, y)]; }
  [[33, 26], [40, 26], [33, 33], [40, 33], [35, dockY - 1], [38, dockY - 1], [19, 27], [22, 27]].forEach(function (l) {
    if (land(at(l[0], l[1])) && at(l[0], l[1]) !== PATH && at(l[0], l[1]) !== BRIDGE && !solid[k(l[0], l[1])]) { props.push({ kind: "lamp", tx: l[0], ty: l[1] }); solid[k(l[0], l[1])] = 1; }
  });
  // the outpost: sandbag walls with a gate facing the helipad, and a yard kitted for living off-grid
  var wall = {};
  for (y = COMPOUND.y0; y <= COMPOUND.y1; y++) for (x = COMPOUND.x0; x <= COMPOUND.x1; x++) {
    var edge2 = x === COMPOUND.x0 || x === COMPOUND.x1 || y === COMPOUND.y0 || y === COMPOUND.y1;
    if (!edge2 || !land(at(x, y)) || at(x, y) === PATH || (x === COMPOUND.x1 && COMPOUND.gate.indexOf(y) >= 0)) continue;
    wall[k(x, y)] = 1; solid[k(x, y)] = 1;
  }
  [["mast", 15, 43], ["solar", 15, 46], ["solar", 16, 46], ["generator", 22, 43], ["tank", 24, 43], ["tent", 22, 47], ["campfire", 19, 47], ["crates", 25, 47], ["lamp", 25, 43], ["lamp", 15, 47]].forEach(function (q) {
    if (walkable0(q[1], q[2])) { props.push({ kind: q[0], tx: q[1], ty: q[2] }); solid[k(q[1], q[2])] = 1; }
  });
  // crates stacked by the depot and on the dock
  [[42, 44], [42, 43], [38, 44], [35, dockY]].forEach(function (c2) { if (walkable0(c2[0], c2[1])) { props.push({ kind: "crates", tx: c2[0], ty: c2[1] }); solid[k(c2[0], c2[1])] = 1; } });
  function walkable(x, y) { var t = at(x, y); return (land(t) || t === DOCK) && !solid[k(x, y)]; }
  function solidPx(px, py) { return !walkable(Math.floor(px / T), Math.floor(py / T)); }

  /* ════════ sprites (drawn once into little canvases) ════════ */
  function sprite(w, h, fn) { var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
  function blob(r, cx, cy, rad, col) { for (var j = -rad; j <= rad; j++) { var w = Math.round(Math.sqrt(rad * rad - j * j)); r(cx - w, cy + j, w * 2, 1, col); } }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // pick one of a few tones for a shade in [0,1], ordered-dithered so the bands blend like 16-bit art
  function tone(v, tones, x, y) {
    var f = Math.max(0, Math.min(0.999, v)) * (tones.length - 1), i = Math.floor(f);
    return (f - i) > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? tones[Math.min(tones.length - 1, i + 1)] : tones[i];
  }
  var BARK = ["#3a2616", "#553820", "#6e4a2a", "#8a6038"];
  function trunk(g, x, y, w, h, flare) {
    for (var yy = 0; yy < h; yy++) {
      var ww = w + Math.max(0, yy - h + flare) * 1.3;
      for (var xx = -ww / 2; xx < ww / 2; xx++) {
        var v = 0.62 - (xx / ww) * 0.8 + (hash(Math.round(xx) + 90, (yy / 2) | 0) - 0.5) * 0.3;
        g.fillStyle = tone(v, BARK, Math.round(x + xx), y + yy); g.fillRect(Math.round(x + xx), y + yy, 1, 1);
      }
    }
  }
  // a canopy is a union of circles; each pixel is lit from the upper left by its own blob's normal
  function canopy(g, blobs, tones) {
    var W = 64, H = 64;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var best = null, depth = 0;
      blobs.forEach(function (b) { var d = b[2] - Math.hypot(x + 0.5 - b[0], y + 0.5 - b[1]); if (d > depth) { depth = d; best = b; } });
      if (!best) continue;
      var nx = (x - best[0]) / best[2], ny = (y - best[1]) / best[2];
      var v = 0.62 - (nx * 0.55 + ny * 0.75) * 0.42 + (hash(x * 3, y * 5) - 0.5) * 0.22 - (depth < 1.5 ? 0.12 : 0);
      // leafy clumps: every few pixels a darker notch so it doesn't read as a smooth ball
      if (hash((x / 3) | 0, (y / 3) | 0) < 0.18 && depth > 2) v -= 0.18;
      g.fillStyle = tone(v, tones, x, y); g.fillRect(x, y, 1, 1);
    }
  }
  // a frond: a curved stem with leaflets hanging off both sides, for palms, tree ferns and ferns
  function frond(g, x0, y0, ang, len, droop, tones, leaf) {
    var px = x0, py = y0, dx = Math.cos(ang), dy = Math.sin(ang);
    for (var i = 0; i < len; i++) {
      var u = i / len;
      px += dx; py += dy + droop * u * 1.6;
      var sh = 0.8 - u * 0.45;
      g.fillStyle = tone(sh, tones, px | 0, py | 0); g.fillRect(Math.round(px), Math.round(py), 1, 1);
      if (!leaf || i < 1) continue;
      var ll = Math.round(leaf * Math.sin(Math.min(1, u * 1.3) * Math.PI) + 0.6);
      for (var j = 1; j <= ll; j++) {
        g.fillStyle = tone(sh - 0.08 * j, tones, (px | 0) + j, (py | 0) + j);
        g.fillRect(Math.round(px - dy * j * 0.7 - 0.3 * j * Math.sign(dx)), Math.round(py + j * 0.8), 1, 1);
        g.fillRect(Math.round(px + dy * j * 0.7 + 0.2 * j * Math.sign(dx)), Math.round(py + j * 0.55), 1, 1);
      }
    }
  }
  // a 1px outline around everything opaque: the single biggest readability win in pixel art
  function outline(src, col) {
    var w0 = src.width, h0 = src.height, d = src.getContext("2d").getImageData(0, 0, w0, h0).data;
    function A(x, y) { return x >= 0 && y >= 0 && x < w0 && y < h0 && d[(y * w0 + x) * 4 + 3] > 40; }
    var c = document.createElement("canvas"); c.width = w0 + 2; c.height = h0 + 2;
    var g = c.getContext("2d"); g.fillStyle = col;
    for (var y = -1; y <= h0; y++) for (var x = -1; x <= w0; x++)
      if (!A(x, y) && (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
    g.drawImage(src, 1, 1);
    return c;
  }
  var LEAF = ["#0f2f1a", "#1a4a24", "#28662e", "#3f8a3a", "#62ad50"];
  var LEAF2 = ["#12301f", "#1d4a2c", "#2d6a38", "#468c46", "#6aae5c"];
  var FROND = ["#16452a", "#23663a", "#3a8a44", "#63b056", "#8fd06a"];
  var FERN = ["#12382e", "#1d5440", "#2c7250", "#4a9464", "#74b882"];
  // 3x5 pixel letters for signs
  var GLYPH = { P: ["111", "101", "111", "100", "100"], I: ["111", "010", "010", "010", "111"], S: ["111", "100", "111", "001", "111"], L: ["100", "100", "100", "100", "111"],
                A: ["010", "101", "111", "101", "101"], N: ["110", "101", "101", "101", "101"], D: ["110", "101", "101", "101", "110"], "'": ["1", "1", "0", "0", "0"], " ": ["00", "00", "00", "00", "00"] };
  function pixText(r, str, x, y, col) { str.split("").forEach(function (ch) { var gl = GLYPH[ch]; gl.forEach(function (row, j) { for (var i = 0; i < row.length; i++) if (row[i] === "1") r(x + i, y + j, 1, 1, col); }); x += gl[0].length + 1; }); }
  function textW(str) { return str.split("").reduce(function (s, ch) { return s + GLYPH[ch][0].length + 1; }, -1); }

  var SPR = {
    // a giant buttressed jungle tree, hung with vines
    jtree: sprite(50, 62, function (r, g) {
      trunk(g, 25, 30, 9, 31, 8);
      canopy(g, [[25, 22, 16], [11, 26, 10], [39, 26, 10], [17, 12, 11], [33, 11, 11], [25, 32, 9]], LEAF);
      [[9, 31, 16], [16, 35, 12], [34, 34, 14], [41, 31, 10], [27, 37, 8]].forEach(function (v) {
        for (var i = 0; i < v[2]; i++) { r(v[0] + Math.round(Math.sin(i * 0.45) * 0.8), v[1] + i, 1, 1, "#2a5e26"); if (i % 3 === 1) r(v[0] + 1, v[1] + i, 1, 1, "#5aa04a"); }
        r(v[0] - 1, v[1] + v[2], 3, 1, "#3f8a3a");
      });
    }),
    tree: sprite(34, 44, function (r, g) {
      trunk(g, 17, 26, 5, 17, 4);
      canopy(g, [[17, 17, 13], [10, 13, 8], [24, 12, 8], [17, 8, 8]], LEAF);
    }),
    tree2: sprite(34, 46, function (r, g) {
      trunk(g, 17, 28, 5, 17, 4);
      canopy(g, [[17, 22, 11], [17, 12, 11], [9, 17, 7], [25, 17, 7]], LEAF2);
      [[21, 25], [10, 19], [23, 13], [14, 9], [18, 29]].forEach(function (p) { r(p[0], p[1], 2, 2, "#e0782f"); r(p[0], p[1], 1, 1, "#ffb060"); });   // fruit
    }),
    // a tree fern: a thin shaggy trunk and a crown of arching fronds
    tfern: sprite(40, 44, function (r, g) {
      for (var yy = 14; yy < 43; yy++) { var cx = 20 + Math.round(Math.sin(yy / 9) * 1.2); r(cx - 1, yy, 3, 1, yy % 3 ? "#5a3a1e" : "#7a5230"); if (yy % 4 === 0) r(cx - 2 + (yy % 8 ? 0 : 4), yy, 1, 1, "#3f2a14"); }
      [[-2.9, 16, 0.9], [-2.4, 15, 0.8], [-1.9, 12, 0.5], [-1.3, 12, 0.5], [-0.7, 15, 0.8], [-0.25, 16, 0.9], [-1.6, 9, 0.2]].forEach(function (f) { frond(g, 20, 14, f[0], f[1], f[2], FROND, 3); });
    }),
    palm: sprite(40, 50, function (r, g) {
      for (var i = 0; i < 32; i++) {                               // a curved, ringed trunk
        var px = 18 + Math.round(Math.sin(i / 11) * 5), band = (i >> 1) % 2;
        r(px, 48 - i, 4, 1, band ? "#8a5a33" : "#a8744a"); r(px + 3, 48 - i, 1, 1, "#6b4424"); if (!band) r(px, 48 - i, 1, 1, "#c09062");
      }
      var tx = 18 + Math.round(Math.sin(31 / 11) * 5) + 2, ty = 17;
      [[-3.0, 17, 1.0], [-2.5, 15, 0.9], [-1.9, 11, 0.5], [-1.2, 11, 0.5], [-0.6, 15, 0.9], [-0.1, 17, 1.0], [-1.57, 8, 0.1]].forEach(function (f) { frond(g, tx, ty, f[0], f[1], f[2], FROND, 3); });
      r(tx - 2, ty, 3, 3, "#5a3a1e"); r(tx + 1, ty + 1, 3, 3, "#6b4424"); r(tx - 1, ty + 2, 1, 1, "#8a6038");      // coconuts
    }),
    fern: sprite(20, 14, function (r, g) {
      [[-2.7, 8, 0.7], [-2.2, 9, 0.5], [-1.57, 8, 0.2], [-0.95, 9, 0.5], [-0.45, 8, 0.7]].forEach(function (f) { frond(g, 10, 12, f[0], f[1], f[2], FERN, 2); });
    }),
    cycad: sprite(22, 18, function (r, g) {
      r(9, 12, 4, 6, "#6b4a2a"); r(9, 12, 1, 6, "#8a6038"); r(10, 13, 1, 1, "#3f2a14"); r(11, 15, 1, 1, "#3f2a14");
      [[-2.9, 9, 0.2], [-2.4, 10, 0.1], [-1.9, 9, 0], [-1.25, 9, 0], [-0.75, 10, 0.1], [-0.25, 9, 0.2]].forEach(function (f) { frond(g, 11, 12, f[0], f[1], f[2], LEAF2, 1); });
      r(10, 10, 3, 3, "#d9832f"); r(11, 10, 1, 1, "#f0b060");
    }),
    lamp: sprite(7, 18, function (r) { r(3, 5, 1, 13, "#2b2b2b"); r(2, 16, 3, 2, "#2b2b2b"); r(1, 1, 5, 4, "#3a3a3a"); r(2, 2, 3, 2, "#ffe9b0"); r(3, 0, 1, 1, "#3a3a3a"); }),
    nest: sprite(18, 9, function (r) {
      for (var i = 0; i < 40; i++) { var a = i / 40 * 6.283, rr = 7 + (i % 3) * 0.6; r(Math.round(9 + Math.cos(a) * rr), Math.round(5 + Math.sin(a) * rr * 0.45), 2, 1, ["#6e4a2a", "#8a6038", "#a8804e"][i % 3]); }
      r(4, 5, 10, 2, "#4a3018");
    }),
    rock: sprite(16, 12, function (r) { blob(r, 8, 7, 5, "#7c858c"); blob(r, 7, 6, 3, "#9aa3aa"); r(5, 4, 2, 1, "#c3cad0"); }),
    // a mossy boulder: rock lit from the upper left, moss on its crown
    boulder: sprite(22, 16, function (r, g) {
      canopy(g, [[11, 9, 7], [6, 10, 5], [16, 11, 5]], ["#3e434a", "#595f68", "#767d86", "#979ea6", "#b6bcc2"]);
      for (var i = 0; i < 22; i++) for (var j = 0; j < 8; j++) if (hash(i, j + 40) < 0.55 - j * 0.07) { var d = g.getImageData(i, j + 2, 1, 1).data; if (d[3] > 0 && j < 5) { g.fillStyle = tone(0.6 - j * 0.1, ["#2c5a2a", "#3f7a36", "#5a9a44"], i, j); g.fillRect(i, j + 2, 1, 1); } }
    }),
    stones: sprite(14, 7, function (r) { [[2, 3, "#6d737a"], [7, 2, "#858b92"], [10, 4, "#6d737a"], [5, 5, "#9aa0a6"]].forEach(function (q) { r(q[0], q[1], 3, 2, q[2]); r(q[0], q[1], 2, 1, "#b0b6bc"); r(q[0], q[1] + 2, 3, 1, "#3e434a"); }); }),
    // a clump of tall grass: blades of three greens, a few seed heads
    tallgrass: sprite(16, 14, function (r) {
      // separate blades with gaps between them, each curving a little, darker at the root
      for (var i = 0; i < 9; i++) {
        var bx = 1.5 + i * 1.6 + (hash(i, 3) - 0.5), hgt = 5 + ((hash(i, 7) * 7) | 0), lean = (hash(i, 9) - 0.5) * 4;
        for (var j = 0; j < hgt; j++) { var q = j / hgt; r(Math.round(bx + lean * q * q), 13 - j, 1, 1, q > 0.75 ? "#9ad874" : q > 0.4 ? "#5fae4a" : "#2f6a2a"); }
        if (i % 3 === 1) { r(Math.round(bx + lean), 13 - hgt - 1, 1, 2, "#e0cc86"); r(Math.round(bx + lean), 13 - hgt - 1, 1, 1, "#f4e6a8"); }
      }
    }),
    crates: sprite(15, 16, function (r) {
      function crate(x, y) { r(x, y, 10, 8, "#a0703e"); r(x, y, 10, 1, "#c89458"); r(x, y + 7, 10, 1, "#5a3a1e"); r(x, y, 1, 8, "#7a5230"); r(x + 9, y, 1, 8, "#5a3a1e"); r(x + 1, y + 3, 8, 1, "#7a5230"); r(x + 4, y + 1, 1, 6, "#7a5230"); }
      crate(0, 8); crate(5, 1);
    }),
    // the visitor centre: a stone plinth, timber walls, a deep red roof, a lit door and two banners
    visitor: sprite(68, 60, function (r, g) {
      r(2, 50, 64, 9, "#6e6a62"); r(2, 50, 64, 1, "#8d887e"); for (var i = 2; i < 66; i += 7) r(i, 51 + (i % 2), 1, 8, "#57534c");
      for (var yy = 28; yy < 50; yy++) for (var xx = 4; xx < 64; xx++) { g.fillStyle = tone(0.62 - (yy - 28) / 22 * 0.25 + ((xx >> 2) % 2 ? 0.05 : 0), BARK, xx, yy); g.fillRect(xx, yy, 1, 1); }
      for (var c = 0; c < 4; c++) { var wx = [8, 18, 44, 54][c]; r(wx, 33, 7, 8, "#20282e"); r(wx, 33, 7, 1, "#3a2616"); r(wx + 1, 34, 5, 6, "#2d4250"); r(wx + 1, 34, 2, 2, "#5e8aa0"); r(wx + 3, 33, 1, 8, "#3a2616"); }
      r(28, 32, 12, 18, "#2a1a0e"); r(29, 33, 10, 17, "#f2d58a"); r(33, 33, 2, 17, "#c8a04e"); r(26, 30, 16, 2, "#3a2616");
      for (yy = 0; yy < 30; yy++) { var inset = Math.round((30 - yy) * 0.35), w2 = 68 - inset * 2; for (xx = 0; xx < w2; xx++) { g.fillStyle = tone(0.35 + yy / 30 * 0.45 + ((xx + inset) % 6 === 0 ? -0.15 : 0), ["#5a1a12", "#7e2618", "#a8361f", "#c9502e", "#e27a4e"], xx + inset, yy); g.fillRect(xx + inset, yy, 1, 1); } }
      r(0, 29, 68, 2, "#3a120c");
      [12, 52].forEach(function (bx) { r(bx, 36, 5, 11, "#b8321f"); r(bx, 36, 5, 1, "#e0584a"); r(bx + 1, 40, 3, 3, "#f2d58a"); r(bx + 2, 47, 1, 2, "#b8321f"); });
    }),
    // the outpost bunker: half sunk into the ground, sandbags on the roof, a heavy steel door
    bunker: sprite(70, 44, function (r, g) {
      for (var yy = 12; yy < 42; yy++) for (var xx = 2; xx < 68; xx++) { g.fillStyle = tone(0.58 - (yy - 12) / 30 * 0.3 + (hash(xx >> 2, yy >> 2) - 0.5) * 0.12, ["#3a3c3a", "#50534f", "#686b66", "#83867f"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      for (var i = 0; i < 9; i++) { r(3 + i * 7, 6 + (i % 2), 7, 6, "#a8966a"); r(3 + i * 7, 6 + (i % 2), 7, 1, "#c8b688"); r(3 + i * 7, 11 + (i % 2), 7, 1, "#6e6040"); }
      r(2, 12, 66, 2, "#2a2c2a"); r(28, 20, 14, 22, "#2c3034"); r(29, 21, 12, 21, "#4a5058"); for (i = 0; i < 4; i++) r(29, 24 + i * 5, 12, 1, "#2c3034"); r(38, 30, 2, 3, "#c8a040");
      for (i = 0; i < 12; i += 4) { r(28 + i, 19, 2, 1, "#f2c230"); r(30 + i, 19, 2, 1, "#1a1a1a"); }
      r(8, 22, 10, 6, "#20282e"); r(9, 23, 8, 4, "#4DD6E8"); r(9, 23, 8, 1, "#b8f4ff"); r(52, 22, 10, 6, "#20282e"); r(53, 23, 8, 4, "#4DD6E8");
      r(60, 0, 2, 12, "#6a6d68"); r(58, 2, 6, 1, "#6a6d68"); r(61, 0, 1, 1, "#ff5252"); r(6, 2, 5, 4, "#50534f"); r(7, 1, 3, 1, "#6a6d68");
    }),
    solar: sprite(18, 14, function (r) { r(2, 9, 1, 5, "#3a3c3a"); r(14, 9, 1, 5, "#3a3c3a"); r(0, 1, 18, 9, "#8a939b"); r(1, 2, 16, 7, "#1c2a54"); for (var i = 1; i < 17; i += 4) r(i, 2, 1, 7, "#3a4a7a"); r(1, 5, 16, 1, "#3a4a7a"); r(2, 3, 3, 1, "#8ab0ff"); }),
    mast: sprite(12, 50, function (r) { for (var yy = 4; yy < 50; yy++) { var w2 = Math.round(2 + (yy - 4) / 46 * 8); r(6 - w2 / 2, yy, 1, 1, "#7a7d78"); r(6 + w2 / 2, yy, 1, 1, "#7a7d78"); if (yy % 6 === 0) r(6 - w2 / 2, yy, w2, 1, "#5a5d58"); } r(5, 0, 2, 5, "#9a9d98"); r(2, 12, 8, 3, "#c8ccd0"); r(3, 13, 6, 1, "#8a8e92"); }),
    generator: sprite(18, 15, function (r) { r(0, 4, 18, 11, "#c8a038"); r(0, 4, 18, 1, "#e8c058"); r(0, 14, 18, 1, "#7a5a1e"); for (var i = 3; i < 12; i += 2) r(i, 7, 1, 5, "#7a5a1e"); r(13, 7, 3, 3, "#2a2c2a"); r(14, 0, 2, 5, "#4a4c4a"); r(1, 12, 3, 3, "#2a2c2a"); r(14, 12, 3, 3, "#2a2c2a"); }),
    tank: sprite(14, 24, function (r, g) { r(2, 16, 1, 8, "#4a4c4a"); r(11, 16, 1, 8, "#4a4c4a"); for (var yy = 2; yy < 18; yy++) for (var xx = 0; xx < 14; xx++) { g.fillStyle = tone(0.8 - xx / 14 * 0.6, ["#3a5a6a", "#4a7488", "#5e90a6", "#7ab0c4"], xx, yy); g.fillRect(xx, yy, 1, 1); } r(0, 1, 14, 2, "#8ab4c8"); r(0, 8, 14, 1, "#2e4654"); r(0, 13, 14, 1, "#2e4654"); }),
    tent: sprite(22, 14, function (r) { for (var yy = 0; yy < 12; yy++) { var w2 = Math.round(2 + yy * 1.6); r(11 - w2 / 2, yy + 1, w2, 1, yy % 3 === 0 ? "#4a5a30" : "#5c6e3c"); } r(9, 6, 4, 7, "#2a3218"); r(10, 1, 2, 1, "#3a4624"); r(0, 12, 22, 1, "#3a4624"); }),
    campfire: sprite(16, 8, function (r) { [[1, 5], [4, 6], [8, 6], [12, 5], [3, 3], [11, 3]].forEach(function (q) { r(q[0], q[1], 3, 2, "#6d737a"); r(q[0], q[1], 2, 1, "#9aa0a6"); }); r(4, 4, 8, 2, "#5a3a1e"); r(6, 3, 5, 2, "#7a5230"); }),
    // the old shrine: a standing stone carved with a ring (an orb), older than the park
    shrine: sprite(22, 34, function (r, g) {
      for (var yy = 4; yy < 32; yy++) for (var xx = 3; xx < 19; xx++) { var e2 = Math.min(xx - 3, 18 - xx, yy - 4); if (yy < 8 && e2 < 8 - yy) continue; g.fillStyle = tone(0.7 - xx / 22 * 0.5 + (hash(xx, yy) - 0.5) * 0.15, ["#3a3c4a", "#4f5264", "#686c80", "#8a8ea2"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      g.strokeStyle = "#2a2c38"; g.lineWidth = 2; g.beginPath(); g.arc(11, 15, 4.5, 0, 6.283); g.stroke(); r(10, 14, 2, 2, "#2a2c38");
      r(7, 23, 8, 1, "#2a2c38"); r(8, 26, 6, 1, "#2a2c38"); r(0, 31, 22, 3, "#50534f"); r(1, 31, 20, 1, "#6a6d68");
      for (var m = 0; m < 14; m++) r(3 + ((hash(m, 3) * 15) | 0), 4 + ((hash(3, m) * 26) | 0), 2, 1, "#4a8a3a");
    }),
    // the supply depot: corrugated walls, a half-open roller door with crates inside, a drone pad on the roof
    depot: sprite(52, 46, function (r, g) {
      for (var yy = 14; yy < 44; yy++) for (var xx = 1; xx < 51; xx++) { g.fillStyle = tone(0.55 - (yy - 14) / 30 * 0.2 + (xx % 3 === 0 ? -0.12 : 0.04), ["#3a4046", "#50585f", "#6a737b", "#8a939b"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(14, 26, 24, 18, "#1a1e22"); for (var i = 0; i < 5; i++) r(14, 26 + i * 2, 24, 1, "#7a838b");
      r(17, 37, 8, 7, "#a0703e"); r(17, 37, 8, 1, "#c89458"); r(27, 39, 8, 5, "#a0703e"); r(27, 39, 8, 1, "#c89458");
      for (i = 0; i < 24; i += 4) { r(14 + i, 44, 2, 2, "#f2c230"); r(16 + i, 44, 2, 2, "#1a1a1a"); }
      for (yy = 0; yy < 14; yy++) for (xx = 0; xx < 52; xx++) { g.fillStyle = tone(0.4 + yy / 14 * 0.35, ["#2c3238", "#3e454c", "#565e66", "#737b83"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(18, 3, 16, 8, "#4a525a"); r(19, 4, 14, 6, "#5e666e"); r(25, 5, 2, 4, "#f4f4f4"); r(23, 6, 6, 1, "#f4f4f4"); r(29, 5, 2, 4, "#f4f4f4");   // pad
      r(4, 2, 6, 4, "#2c3238"); r(5, 1, 4, 1, "#737b83"); r(44, 0, 1, 8, "#737b83"); r(43, 0, 3, 1, "#ff5252");
      r(4, 18, 7, 4, "#f2c230"); r(5, 19, 5, 2, "#1a1a1a");
    }),
    sign: sprite(16, 20, function (r) { r(3, 9, 2, 11, "#7a5530"); r(11, 9, 2, 11, "#7a5530"); r(0, 2, 16, 9, "#7a5530"); r(1, 3, 14, 7, "#c4955a"); r(3, 5, 9, 1, "#7a5530"); r(3, 7, 7, 1, "#7a5530"); }),
    tower: sprite(22, 38, function (r) {
      r(3, 14, 2, 24, "#7a5230"); r(17, 14, 2, 24, "#7a5230");
      for (var i = 0; i < 3; i++) { r(4, 18 + i * 7, 14, 1, "#8b5e34"); }
      r(1, 3, 20, 12, "#6e4826"); r(0, 0, 22, 4, "#3a2a1a"); r(4, 5, 14, 7, "#0b1a12");
    }),
    rack: sprite(16, 26, function (r) {
      r(0, 0, 16, 26, "#3a3a3a"); r(1, 1, 14, 24, "#1c1c1c");
      for (var i = 0; i < 6; i++) { r(2, 3 + i * 4, 12, 3, "#262626"); r(3, 4 + i * 4, 6, 1, "#3a3a3a"); }
    }),
    lighthouse: sprite(18, 48, function (r) {
      r(2, 40, 14, 8, "#8e959b"); r(2, 40, 14, 1, "#b3bac0");
      for (var yy = 10; yy < 40; yy++) { var w = Math.round(8 + (yy - 10) / 30 * 4), xx = 9 - w / 2; r(Math.round(xx), yy, w, 1, Math.floor((yy - 10) / 6) % 2 ? "#f1f1f1" : "#d9463b"); }
      r(2, 8, 14, 2, "#2b2b2b"); r(5, 2, 8, 6, "#ffe28a"); r(4, 0, 10, 2, "#2b2b2b"); r(7, 11, 3, 4, "#2b2b2b");
    }),
    uplink: sprite(20, 28, function (r) {
      r(9, 12, 2, 13, "#9aa3aa"); r(5, 24, 10, 4, "#6f777d");
      for (var j = 0; j < 10; j++) { var w = Math.round(Math.sqrt(1 - Math.pow((j - 5) / 5.2, 2)) * 9); r(10 - w, 2 + j, w * 2, 1, j < 5 ? "#e3e9ed" : "#b5c0c7"); }
      r(9, 5, 2, 7, "#6f777d"); r(9, 1, 2, 2, "#6f777d");
    }),
    desk: sprite(34, 24, function (r) {
      r(0, 12, 30, 4, "#9b6b3f"); r(0, 12, 30, 1, "#b8845a"); r(2, 16, 2, 8, "#6b4424"); r(26, 16, 2, 8, "#6b4424");
      r(8, 1, 15, 10, "#1d1d1d"); r(14, 11, 3, 2, "#1d1d1d"); r(10, 14, 11, 1, "#9e9e9e");
      r(28, 13, 6, 3, "#2b2b2b"); r(29, 16, 4, 8, "#2b2b2b"); r(28, 8, 6, 5, "#333");
    }),
    tablet: sprite(16, 22, function (r) {
      r(2, 4, 12, 18, "#8d9399"); r(3, 2, 10, 2, "#8d9399"); r(5, 1, 6, 1, "#8d9399"); r(2, 4, 1, 18, "#a5abb1");
      for (var i = 0; i < 5; i++) r(5, 6 + i * 3, 4 + (i * 3) % 4, 1, "#62686e");
      r(2, 19, 4, 3, "#4f9a3d"); r(11, 20, 3, 2, "#4f9a3d");
    }),
    macbook: sprite(30, 18, function (r) {
      for (var j = 0; j < 12; j++) for (var i = 0; i < 28; i += 4) r(1 + i, 6 + j, 4, 1, ((i / 4 + (j >> 2)) % 2) ? "#f3f3f3" : "#d64a4a");
      r(9, 12, 12, 2, "#c9ced3"); r(10, 4, 10, 8, "#c9ced3"); r(11, 5, 8, 6, "#2b2f36");
      r(23, 10, 3, 3, "#f1f1f1"); r(24, 8, 1, 2, "#e879f9");
    }),
    mailbox: sprite(12, 20, function (r) { r(5, 9, 2, 11, "#7a5530"); r(0, 3, 11, 7, "#d64545"); r(1, 2, 9, 1, "#d64545"); r(0, 3, 11, 1, "#e46a6a"); r(1, 6, 3, 2, "#8a2d2d"); }),
    drink: sprite(24, 26, function (r) {
      r(11, 3, 1, 12, "#6b4424");
      for (var i = 0; i < 6; i++) r(1 + i * 1, 1 + (5 - i), 22 - i * 2, 1, "#fff");
      for (var s = 0; s < 22; s += 4) r(1 + s, 0, 2, 6, "#e04b4b");
      r(2, 14, 20, 8, "#d9b27c"); r(2, 14, 20, 1, "#e8c795"); r(4, 22, 4, 4, "#3a3a3a"); r(16, 22, 4, 4, "#3a3a3a");
      r(15, 10, 4, 4, "#f7f7f7"); r(16, 11, 2, 2, "#ff9f43"); r(18, 7, 1, 4, "#e879f9");
    }),
    // the mouth of a cave, cut into the volcano's cliff (a terminal glows inside)
    cave: sprite(14, 12, function (r) {
      for (var j = 0; j < 12; j++) { var w = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((11 - j) / 11.5, 2))) * 6); r(7 - w, j, w * 2, 1, j < 2 ? "#2a211a" : "#0c0907"); }
      r(1, 11, 12, 1, "#1a1410"); r(4, 3, 1, 1, "#3a2e24"); r(9, 5, 1, 1, "#3a2e24");
    }),
    boat: sprite(36, 20, function (r) {
      r(2, 9, 32, 6, "#f4f4f4"); r(4, 15, 28, 2, "#c7d3dc"); r(6, 17, 24, 1, "#9fb3c2"); r(2, 12, 32, 1, "#d64545");
      r(6, 7, 24, 2, "#9b6b3f"); r(20, 1, 10, 6, "#f4f4f4"); r(22, 2, 6, 2, "#4fa3d6"); r(12, 0, 1, 8, "#7a5530");
    }),
    // the park gate: two log pillars with torch baskets, a beam, and a painted plaque
    gate: sprite(90, 58, function (r, g) {
      [[6, 0], [74, 0]].forEach(function (p) {
        for (var yy = 12; yy < 58; yy++) for (var xx = 0; xx < 10; xx++) { g.fillStyle = tone(0.75 - xx / 10 * 0.6 + (hash(xx + p[0], (yy / 3) | 0) - 0.5) * 0.25, BARK, p[0] + xx, yy); g.fillRect(p[0] + xx, yy, 1, 1); }
        for (yy = 16; yy < 56; yy += 9) r(p[0], yy, 10, 1, "#2e1e10");
        r(p[0] - 2, 8, 14, 4, "#3a2616"); r(p[0] - 1, 6, 12, 2, "#553820"); r(p[0] + 1, 4, 8, 2, "#2a1a0e");   // torch basket
        r(p[0] - 1, 55, 12, 3, "#5c4632");
      });
      for (var yy = 16; yy < 26; yy++) for (var xx = 2; xx < 88; xx++) { g.fillStyle = tone(0.7 - (yy - 16) / 10 * 0.5 + (hash(xx >> 2, yy) - 0.5) * 0.2, BARK, xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(2, 16, 86, 1, "#9a6c40"); r(2, 25, 86, 1, "#2e1e10");
      var label = "PI'S ISLAND", lw = textW(label), px0 = 45 - Math.ceil(lw / 2) - 4;
      r(px0 - 1, 13, lw + 10, 15, "#1a0f08"); r(px0, 14, lw + 8, 13, "#b8321f"); r(px0 + 1, 15, lw + 6, 11, "#d9463b");
      r(px0 + 1, 15, lw + 6, 1, "#ec6a52");
      pixText(r, label, px0 + 4, 18, "#ffe6a8");
      r(px0 + 4, 24, lw, 1, "#8a2414");
    })
  };

  Object.keys(SPR).forEach(function (k) {
    SPR[k] = outline(SPR[k], /tree|fern|palm|cycad/.test(k) ? "rgba(10,28,16,.9)" : k === "cave" || k === "tallgrass" ? "rgba(0,0,0,0)" : "rgba(18,18,20,.88)");
  });

  /* ════════ ground, drawn once ════════ */
  var COL = { deep: "#1f4e79", deep2: "#1a4470", shal: "#3d8fc4", shal2: "#4fa3d6", sand: "#ecd9a0", sand2: "#dcc586", wetsand: "#cdb57a",
              grass: "#4f9a3e", grass2: "#3f8433", grass3: "#6cb452", path: "#c69a66", path2: "#a97c4c", pond: "#4aa3c9", pondrim: "#3b86a8", dock: "#8b5e34", dock2: "#6e4826" };
  var ground = document.createElement("canvas"); ground.width = MW * T; ground.height = MH * T;
  function jungle(x, y) { return (Math.sin(x * 0.31 + 1) + Math.sin(y * 0.37 + 2) + Math.sin((x + y) * 0.23 + 0.5) + Math.sin((x - y) * 0.17)) / 4 + (x < 30 ? 0.12 : 0); }
  // how far each water tile is from land, for depth shading
  var DEPTH = [];
  (function () {
    var q = [], x, y;
    for (y = 0; y < MH; y++) { DEPTH.push([]); for (x = 0; x < MW; x++) { var lt = land(map[y][x]) || map[y][x] === DOCK || map[y][x] === LAVA; DEPTH[y].push(lt ? 0 : 99); if (lt) q.push([x, y]); } }
    while (q.length) {
      var c = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (n) {
        var nx = c[0] + n[0], ny = c[1] + n[1];
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || DEPTH[ny][nx] <= DEPTH[c[1]][c[0]] + 1) return;
        DEPTH[ny][nx] = DEPTH[c[1]][c[0]] + 1; q.push([nx, ny]);
      });
    }
  })();
  var WATER = ["#5cb6dd", "#4aa3d2", "#3b8dc2", "#3179b0", "#28669c", "#215888", "#1f4e79"];
  var GRASS_T = ["#3b7d31", "#448a37", "#4f9a3e", "#5aa846", "#67b651", "#76c25c"];
  var ASH = ["#3a312b", "#4a3f37", "#5b4f45", "#6d6054", "#807264"];
  (function paint() {
    var g = ground.getContext("2d");
    function r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    var N = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var ty = 0; ty < MH; ty++) for (var tx = 0; tx < MW; tx++) {
      var t = map[ty][tx], X = tx * T, Y = ty * T, i, j, hh;
      if (t === DEEP || t === SHAL || t === DOCK) {
        // water gets deeper away from shore; dither toward the next band so there are no hard lines
        var dp = Math.min(WATER.length - 1, Math.max(0, DEPTH[ty][tx] - 1));
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var f = (j / T) * 0.5 + hash(tx * 16 + i, ty * 16 + j) * 0.12;
          g.fillStyle = tone(dp / (WATER.length - 1) + f / (WATER.length - 1), WATER, (X + i) >> 1, (Y + j) >> 1); g.fillRect(X + i, Y + j, 2, 2);
        }
        for (i = 0; i < 2; i++) { hh = hash(tx * 3 + i, ty * 5); r(X + ((hh * 12) | 0), Y + ((hash(ty, tx * 7 + i) * 15) | 0), 3, 1, "rgba(255,255,255,.08)"); }
        if (t === DOCK) {
          for (j = 0; j < 4; j++) r(X, Y + j * 4, T, 3, j % 2 ? COL.dock : "#9a6a3c");
          r(X, Y, 2, T, COL.dock2); if (tx === CX + 1) r(X + T - 2, Y, 2, T, COL.dock2);
        }
      } else if (t === SAND || t === PATH || t === PAD) {
        r(X, Y, T, T, t === SAND ? COL.sand : COL.path);
        for (i = 0; i < 6; i++) { hh = hash(tx * 11 + i, ty * 13); r(X + ((hh * 15) | 0), Y + ((hash(ty * 3 + i, tx) * 15) | 0), 1, 1, t === SAND ? COL.sand2 : COL.path2); }
        if (t === PATH || t === PAD) {
          // packed dirt: dithered tones, pebbles, darker where it meets the grass
          for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
            var edgeD = Math.min(at(tx - 1, ty) === GRASS ? i : 99, at(tx + 1, ty) === GRASS ? T - 2 - i : 99, at(tx, ty - 1) === GRASS ? j : 99, at(tx, ty + 1) === GRASS ? T - 2 - j : 99);
            g.fillStyle = tone(0.55 + (hash(X + i, Y + j) - 0.5) * 0.3 - (edgeD < 3 ? 0.25 : 0), ["#8e6a42", "#a97f50", "#c69a66", "#d8b07c"], X + i, Y + j); g.fillRect(X + i, Y + j, 2, 2);
          }
          for (i = 0; i < 2; i++) { hh = hash(tx * 13 + i, ty * 7); if (hh < 0.45) { var sx = X + ((hh * 13) | 0), sy = Y + ((hash(ty, tx * 5 + i) * 13) | 0); r(sx, sy, 1, 1, "#dcc294"); r(sx, sy + 1, 1, 1, "#8a6a42"); } }
        }
        N.forEach(function (n, q) {
          var nt = at(tx + n[0], ty + n[1]);
          if (wet(nt)) { if (q === 0) r(X, Y, T, 3, COL.wetsand); if (q === 1) r(X + T - 3, Y, 3, T, COL.wetsand); if (q === 2) r(X, Y + T - 3, T, 3, COL.wetsand); if (q === 3) r(X, Y, 3, T, COL.wetsand); }
          if (nt === GRASS) for (var s = 0; s < T; s += 2) if (hash(tx * 17 + s, ty * 19 + q) < 0.55) {
            if (q === 0) r(X + s, Y, 2, 2, COL.grass); if (q === 2) r(X + s, Y + T - 2, 2, 2, COL.grass);
            if (q === 1) r(X + T - 2, Y + s, 2, 2, COL.grass); if (q === 3) r(X, Y + s, 2, 2, COL.grass);
          }
        });
        if (t === SAND && hash(tx, ty * 3) < 0.03) { r(X + 6, Y + 7, 3, 2, "#f6efe0"); r(X + 7, Y + 6, 1, 1, "#e9a3a3"); }   // shell
      } else if (t === GRASS) {
        // grass: soft tonal patches (sampled per pixel pair, so patches cross tile edges), darker
        // and lusher under the forests, brighter up on the plateau, worn to dirt in the meadows
        var fo = forest(tx, ty);
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var wx = tx + i / T, wy = ty + j / T, patch = fbm(wx * 1.6 + 7, wy * 1.6);
          var gv = 0.55 + patch * 0.45 + (hash(X + i, Y + j) - 0.5) * 0.22 + ELEV[ty][tx] * 0.18 - Math.max(0, Math.min(1, (fo - 0.1) * 4)) * 0.28;
          var dirt = fo < 0.05 && fbm(wx * 2.8 + 90, wy * 2.8 + 11) > 0.33;
          g.fillStyle = dirt ? tone(0.5 + (hash(X + i, Y + j) - 0.5) * 0.4, ["#6f5a3a", "#8a7048", "#9c8a56"], X + i, Y + j) : tone(gv, GRASS_T, X + i, Y + j);
          g.fillRect(X + i, Y + j, 2, 2);
        }
        for (i = 0; i < 6; i++) {                           // tufts: little V blades, dark with a lit tip
          hh = hash(tx * 5 + i, ty * 9); var bx2 = X + ((hh * 13) | 0) + 1, by2 = Y + ((hash(ty * 7 + i, tx * 2) * 12) | 0) + 2;
          r(bx2, by2, 1, 2, COL.grass2); r(bx2 - 1, by2 - 1, 1, 1, COL.grass2); r(bx2 + 1, by2 - 1, 1, 1, COL.grass3);
        }
        hh = hash(tx * 31, ty * 17);
        if (hh < 0.07 && fo < 0.12) {                        // flowers grow in little clusters
          var fc = ["#ff8fb1", "#ffe066", "#ffffff", "#ff7a3a", "#c9a4ff"][(hh * 99 | 0) % 5];
          for (i = 0; i < 3 + ((hh * 40) | 0) % 3; i++) { var fx3 = X + 2 + ((hash(tx * 3 + i, ty) * 11) | 0), fy3 = Y + 2 + ((hash(tx, ty * 3 + i) * 11) | 0); r(fx3, fy3, 1, 1, fc); r(fx3 - 1, fy3 + 1, 3, 1, fc); r(fx3, fy3 + 1, 1, 1, "#ffcf33"); r(fx3, fy3 + 2, 1, 1, "#2f6a2a"); }
        } else if (hh < 0.12) { r(X + 5, Y + 9, 2, 2, "#3f8a3a"); r(X + 7, Y + 8, 2, 2, "#4a9a42"); r(X + 6, Y + 7, 2, 2, "#5aa84a"); }   // clover
      } else if (t === POND) {
        r(X, Y, T, T, "#4f9a3e");                          // grass under the pond; the water is drawn per pixel below
      } else if (t === RIVER || t === BRIDGE) {
        // the river: shallow green-blue, darker in the channel, muddy banks with reeds
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var bank = Math.min(land(at(tx - 1, ty)) && at(tx - 1, ty) !== BRIDGE ? i : 99, land(at(tx + 1, ty)) && at(tx + 1, ty) !== BRIDGE ? T - 2 - i : 99, land(at(tx, ty - 1)) && at(tx, ty - 1) !== BRIDGE ? j : 99, land(at(tx, ty + 1)) && at(tx, ty + 1) !== BRIDGE ? T - 2 - j : 99);
          g.fillStyle = bank < 2 ? "#6b5a3a" : bank < 4 ? tone(0.5, ["#4f8f86", "#5aa39a"], X + i, Y + j) : tone(0.45 + (hash(X + i, Y + j) - 0.5) * 0.2, ["#2c6a78", "#357c8a", "#3f8e98", "#4aa0a4"], X + i, Y + j);
          g.fillRect(X + i, Y + j, 2, 2);
        }
        if (t === BRIDGE) {
          // planks across, rails and posts along the sides that meet the water
          r(X, Y + 1, T, T - 2, "#8a5a33");
          for (i = 0; i < T; i += 3) r(X + i, Y + 1, 1, T - 2, "#6e4826");
          for (i = 0; i < T; i += 5) r(X + i + 1, Y + 3 + (i % 2) * 6, 1, 1, "#b8845a");
          if (at(tx, ty - 1) !== BRIDGE && !land(at(tx, ty - 1)) || at(tx, ty - 1) === RIVER) { r(X, Y, T, 2, "#4a3018"); r(X + 2, Y - 3, 2, 4, "#4a3018"); r(X + 10, Y - 3, 2, 4, "#4a3018"); r(X, Y - 3, T, 1, "#6e4826"); }
          if (at(tx, ty + 1) === RIVER) { r(X, Y + T - 2, T, 2, "#4a3018"); r(X + 2, Y + T - 5, 2, 4, "#4a3018"); r(X + 10, Y + T - 5, 2, 4, "#4a3018"); r(X, Y + T - 5, T, 1, "#6e4826"); }
        } else if (hash(tx * 3, ty * 11) < 0.35) { var rx3 = X + ((hash(tx, ty) * 12) | 0); r(rx3, Y + 2, 1, 5, "#2f6f2c"); r(rx3 + 2, Y + 3, 1, 4, "#3f8a3a"); r(rx3, Y, 1, 2, "#6b4a2a"); }
      }
    }

    // the pond, pixel by pixel: deeper toward the middle, a stone rim, reeds and lily pads
    for (var py = Math.floor((KP.y - 3) * T); py < (KP.y + 3) * T; py++) for (var px = Math.floor((KP.x - 7) * T); px < (KP.x + 7) * T; px++) {
      var pf = pondF((px + 0.5) / T, (py + 0.5) / T);
      if (pf < 1) g.fillStyle = tone(1 - pf * 0.95, ["#4aa3c9", "#3d8fc0", "#2f78a8", "#24628f"], px, py);
      else if (pf < 1.07) g.fillStyle = ["#8f8a7c", "#6f6a5e", "#a8a291", "#7d786b"][(hash(px >> 1, py >> 1) * 4) | 0];
      else if (pf < 1.1) g.fillStyle = "rgba(0,0,0,.18)";
      else continue;
      g.fillRect(px, py, 1, 1);
    }
    for (var n2 = 0; n2 < 26; n2++) {
      var la = hash(n2, 77) * 6.283, lr = 0.25 + hash(77, n2) * 0.6, lx = (KP.x + Math.cos(la) * lr * KP.rx) * T, ly = (KP.y + Math.sin(la) * lr * KP.ry) * T;
      if (pondF(lx / T, ly / T) > 0.85) continue;
      g.fillStyle = "#3f9137"; g.beginPath(); g.arc(lx, ly, 2.6, 0.5, 6.1); g.lineTo(lx, ly); g.fill();
      g.fillStyle = "#58ad47"; g.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 1, 1);
      if (n2 % 4 === 0) { g.fillStyle = "#ff9ec4"; g.fillRect(Math.round(lx), Math.round(ly) - 1, 2, 2); g.fillStyle = "#ffe066"; g.fillRect(Math.round(lx), Math.round(ly) - 1, 1, 1); }
    }
    for (n2 = 0; n2 < 40; n2++) {                          // reeds around the rim
      var ra = hash(n2, 91) * 6.283, rx0 = (KP.x + Math.cos(ra) * 1.08 * KP.rx * 1.05) * T, ry0 = (KP.y + Math.sin(ra) * 1.08 * KP.ry * 1.1) * T;
      if (hash(91, n2) < 0.5 || at(Math.floor(rx0 / T), Math.floor(ry0 / T)) === PATH) continue;
      g.fillStyle = "#2f6f2c"; g.fillRect(Math.round(rx0), Math.round(ry0) - 4, 1, 5); g.fillRect(Math.round(rx0) + 2, Math.round(ry0) - 3, 1, 4);
      g.fillStyle = "#6b4a2a"; g.fillRect(Math.round(rx0), Math.round(ry0) - 6, 1, 2);
    }

    // the volcano's shadow falls to the east across the plateau
    for (py = VOLC.y - 60; py < VOLC.y + 90; py++) for (px = VOLC.x - 40; px < VOLC.x + 170; px++) {
      var sd = Math.hypot((px - VOLC.x - 38) / (VOLC.R * 1.02), (py - VOLC.y - 12) / (VOLC.R / VOLC.sq * 1.05));
      if (sd < 1 && volcD(px, py) > VOLC.R - 4 && (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16 < (1 - sd) * 1.6) { g.fillStyle = "rgba(10,20,10,.22)"; g.fillRect(px, py, 1, 1); }
    }

    // the helipad: a concrete disc, a painted ring and a big H
    var hx0 = HELI.x * T + 8, hy0 = HELI.y * T + 8;
    for (py = hy0 - 24; py <= hy0 + 24; py++) for (px = hx0 - 24; px <= hx0 + 24; px++) {
      var hd = Math.hypot(px + 0.5 - hx0, py + 0.5 - hy0);
      if (hd > 23) continue;
      g.fillStyle = hd > 21.5 ? "#5e6064" : hd > 18.5 && hd < 20.5 ? "#f2c230" : tone(0.55 + (hash(px >> 1, py >> 1) - 0.5) * 0.3, ["#8b8e90", "#9a9d9f", "#a9acae"], px, py);
      g.fillRect(px, py, 1, 1);
    }
    r(hx0 - 7, hy0 - 8, 3, 16, "#f4f4f4"); r(hx0 + 4, hy0 - 8, 3, 16, "#f4f4f4"); r(hx0 - 4, hy0 - 1, 8, 3, "#f4f4f4");

    // bones in the t-rex paddock, and three-toed tracks along the north beach
    (function bones(bx, by) {
      for (var i = 0; i < 6; i++) { r(bx + i * 3, by, 1, 6, "#d9cfb8"); r(bx + i * 3, by, 1, 1, "#f2ead8"); }
      r(bx - 1, by + 3, 18, 1, "#c8bea8"); r(bx + 17, by + 2, 6, 3, "#e8e0cc"); r(bx + 21, by + 1, 5, 4, "#e8e0cc"); r(bx + 22, by + 2, 1, 1, "#3a3024"); r(bx + 24, by + 4, 2, 1, "#c8bea8");
      r(bx - 10, by + 3, 9, 1, "#c8bea8"); r(bx - 12, by + 4, 3, 1, "#c8bea8");
    })(20 * T + 2, 36 * T + 4);
    for (var ft = 0; ft < 11; ft++) {
      var fx0 = (27 + ft * 1.3) * T + (ft % 2) * 6, fy0 = (5.5 + Math.sin(ft * 0.6) * 0.5) * T;
      if (at(Math.floor(fx0 / T), Math.floor(fy0 / T)) !== SAND) continue;
      g.fillStyle = "#c2a86e"; g.fillRect(fx0, fy0, 2, 2); g.fillRect(fx0 + 2, fy0 - 2, 1, 2); g.fillRect(fx0 + 2, fy0 + 2, 1, 2); g.fillRect(fx0 + 3, fy0, 2, 1);
    }

    // cliffs: a rock face under every drop in level, walls down the sides, stairs where a path climbs
    var ROCK = ["#5c4632", "#7a5f45", "#957658", "#b3936f"];
    for (var cy2 = 1; cy2 < MH; cy2++) for (var cx2 = 0; cx2 < MW; cx2++) {
      var X2 = cx2 * T, Y2 = cy2 * T, L0 = lvl(cx2, cy2), Lup = lvl(cx2, cy2 - 1);
      var isPath = map[cy2][cx2] === PATH, upPath = map[cy2 - 1][cx2] === PATH, RK = ROCK;
      if (Lup > L0) {
        if (isPath || upPath) {                              // stairs
          for (var st = 0; st < T; st += 3) { r(X2 + 2, Y2 + st, T - 4, 2, "#b99c68"); r(X2 + 2, Y2 + st + 2, T - 4, 1, "#8a6f45"); }
          r(X2, Y2, 2, T, "#6f573f"); r(X2 + T - 2, Y2, 2, T, "#6f573f");
        } else {
          var fh = 11;
          for (var fy2 = 0; fy2 < fh; fy2++) for (var fx2 = 0; fx2 < T; fx2++) {
            var strata = ((fy2 + (hash(cx2, 3) * 3 | 0)) % 4 === 0) ? -0.25 : 0;
            g.fillStyle = tone(0.75 - fy2 / fh * 0.6 + strata + (hash(X2 + fx2, Y2 + fy2) - 0.5) * 0.2, RK, X2 + fx2, Y2 + fy2);
            g.fillRect(X2 + fx2, Y2 + fy2, 1, 1);
          }
          r(X2, Y2, T, 1, "#76c25c");  // the lip hangs over the edge
          for (var lp = 0; lp < T; lp += 2) if (hash(cx2 * 16 + lp, cy2) < 0.5) r(X2 + lp, Y2 + 1, 2, 1, "#5aa846");
          if (hash(cx2, cy2 * 3) < 0.5) for (var vn = 0; vn < 6 + hash(cy2, cx2) * 4; vn++) r(X2 + 3 + ((hash(cx2, 9) * 9) | 0), Y2 + 1 + vn, 1, 1, vn % 2 ? "#2f6f2c" : "#4f9a3e");   // a hanging vine
          r(X2, Y2 + fh, T, 3, "rgba(0,0,0,.22)");            // cast shadow at the foot
        }
      }
      if (lvl(cx2 - 1, cy2) > L0 && !isPath) { r(X2, Y2, 3, T, RK[1]); r(X2, Y2, 1, T, RK[0]); r(X2 + 3, Y2, 2, T, "rgba(0,0,0,.15)"); }
      if (lvl(cx2 + 1, cy2) > L0 && !isPath) { r(X2 + T - 3, Y2, 3, T, RK[1]); r(X2 + T - 1, Y2, 1, T, RK[0]); r(X2 + T - 5, Y2, 2, T, "rgba(0,0,0,.15)"); }
      if (L0 > Lup && !isPath) r(X2, Y2, T, 1, "rgba(255,255,255,.18)");   // back edge of a raised tile
    }

    // shadows, baked into the ground: trees and buildings cast soft dithered shadows down and
    // to the right (the light comes from the upper left, like the sprites)
    var SH = { jtree: [22, 9, 10, 4], tree: [15, 7, 6, 3], tree2: [15, 7, 6, 3], tfern: [11, 5, 5, 2], palm: [12, 5, 7, 2], boulder: [10, 5, 3, 2] };
    function castShadow(cx, cy, rx, ry, a) {
      for (var yy = -ry; yy <= ry; yy++) for (var xx = -rx; xx <= rx; xx++) {
        var dd = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
        if (dd <= 1 && (BAYER[((cy + yy) & 3) * 4 + ((cx + xx) & 3)] + 0.5) / 16 < (1 - dd) * 1.8) { g.fillStyle = "rgba(8,26,12," + a + ")"; g.fillRect(cx + xx, cy + yy, 1, 1); }
      }
    }
    props.forEach(function (p2) { var sh = SH[p2.kind]; if (sh) castShadow(p2.tx * T + 8 + (p2.ox || 0) + sh[2], p2.ty * T + 13 + (p2.oy || 0) + sh[3], sh[0], sh[1], 0.3); });
    BUILDINGS.forEach(function (bd) { castShadow(Math.round((bd.x0 + bd.w / 2) * T + 10), (bd.y0 + bd.h) * T + 2, bd.w * 9, 6, 0.32); });
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

  function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x - w / 2 + 1, y - 1, w - 2, 1); ctx.fillRect(x - w / 2, y, w, 2); ctx.fillRect(x - w / 2 + 1, y + 2, w - 2, 1); }

  var SPAWN = { x: 36 * T + 8, y: 29 * T + 12 };
  var pi = { kaiju: (function () { try { return sessionStorage.getItem("pi-kaiju") === "1"; } catch (e) { return false; } })(), x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, face: 1, dir: "down", dist: 0, stepAcc: 0, boost: 0, path: null, want: null, hop: 0 };
  var rex = { x: 31 * T + 8, y: 33 * T + 10, tx: 0, ty: 0, face: -1, wait: 1, dist: 0, hop: 0, vy: 0 };
  var ptero = { on: false, x: 0, y: 0, vx: 0, next: 4 };
  var clouds = [0, 1, 2].map(function (i) { return { x: hash(i, 9) * MW * T, y: hash(9, i) * MH * T, w: 90 + i * 30, v: 5 + i * 2 }; });
  var egg = null;          // { t } while pi is hatching
  var bubble = null;       // { text, t } speech over pi

  /* ════════ view ════════ */
  var W = 0, H = 0, dpr = 1, S = 3, zoom = 1, zoomTo = 1, camX = 0, camY = 0, camF = { x: null, y: null }, look = { x: 0, y: 0 };
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    S = Math.max(2, Math.min(5, Math.floor(Math.min(W / 300, H / 190))));
  }

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
    if (!amb) amb = { waves: SND.loop("waves"), falls: SND.loop("falls"), buzz: SND.loop("buzz"), aura: SND.loop("aura"), rumble: SND.loop("rumble"), rotor: SND.loop("rotor"), engine: SND.loop("engine") };
  }
  function stopSound() {
    if (!SND) return;
    SND.music(null);
    if (amb) { Object.keys(amb).forEach(function (k2) { amb[k2].stop(); }); amb = null; }
  }
  var shoreT = 0, shore = 0;
  function updateSound(dt) {
    if (!amb) return;
    if (room) { ["waves", "falls", "rumble", "buzz", "rotor", "engine", "aura"].forEach(function (k2) { amb[k2].set({ vol: 0 }); }); SND.music(sky.dark > 0.6 ? "night" : "day"); return; }
    SND.music(riftBusy() && rift.phase !== "dim" ? (reality.cur === "future" ? "future" : reality.cur === "chaos" ? "chaos" : "battle") : sky.dark > 0.6 ? "night" : "day");
    shoreT -= dt;
    if (shoreT <= 0) {                               // how much water is around pi, for the surf
      shoreT = 0.3; var wn = 0, tx0 = Math.floor(pi.x / T), ty0 = Math.floor(pi.y / T);
      for (var j = -5; j <= 5; j += 1) for (var i = -5; i <= 5; i += 1) if (at(tx0 + i, ty0 + j) === DEEP || at(tx0 + i, ty0 + j) === SHAL) wn++;
      shore = wn / 121;
    }
    var vd = Math.hypot(pi.x - VX, pi.y - (VOLC.y - 20));
    amb.waves.set({ vol: 0.05 + shore * 0.5 });
    amb.falls.set({ vol: Math.max(0, 1 - Math.hypot(pi.x - WF.x, pi.y - WF.y) / 260) * 0.35, pan: Math.max(-1, Math.min(1, (WF.x - pi.x) / 200)) });
    var dn = drones.reduce(function (m, d) { return Math.min(m, Math.hypot(pi.x - d.x, pi.y - d.y)); }, 1e9);
    amb.buzz.set({ vol: Math.max(0, 1 - dn / 200) * 0.05 });
    amb.aura.set({ vol: rift && rift.phase !== "reign" ? 0.55 : rift ? 0.12 * Math.max(0, 1 - Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y) / 200) : 0, rate: rift && rift.dash ? 1 : 0.3 });
    amb.rumble.set({ vol: Math.max(0, 1 - vd / 380) * 0.5, pan: Math.max(-1, Math.min(1, (VX - pi.x) / 300)) });
    if (vd < 300 && (popT -= dt) <= 0) { popT = 0.4 + Math.random() * 1.6; sfx("pop", VX + (Math.random() - 0.5) * 30, VY); }
    var hd = Math.hypot(heli.x - pi.x, heli.y - pi.y);
    amb.rotor.set({ vol: heli.spin * (aboard() ? 0.42 : 0.4 * Math.max(0, 1 - hd / 360)), rate: heli.spin });
    amb.engine.set({ vol: car.driving ? 0.1 + Math.min(1, Math.abs(car.v) / 120) * 0.14 : 0, rate: Math.min(1, Math.abs(car.v) / 120) });
  }
  if (SND) SND.onChange(function (on) { paintSound(on); });
  var soundBtn = root.querySelector(".w-sound");
  function paintSound(on) { if (soundBtn) { soundBtn.innerHTML = "♪<span class=\"w-sound-l\"> sound " + (on ? "on" : "off") + "</span>"; soundBtn.setAttribute("aria-pressed", on ? "true" : "false"); soundBtn.setAttribute("aria-label", "Sound " + (on ? "on" : "off")); } }
  if (soundBtn) {
    if (!SND) soundBtn.hidden = true;
    else { paintSound(SND.on()); soundBtn.addEventListener("click", function () { SND.toggle(); if (open) startSound(); cv.focus({ preventScroll: true }); }); }
  }

  /* ════════ input ════════ */
  var keys = {}, open = false, last = 0, raf = 0, t = 0;
  function dirKey(e) {
    var c = e.key.toLowerCase();
    return c === "arrowup" || c === "w" ? "u" : c === "arrowdown" || c === "s" ? "d" : c === "arrowleft" || c === "a" ? "l" : c === "arrowright" || c === "d" ? "r" : null;
  }
  window.addEventListener("keydown", function (e) {
    if (!open || termOpen) return;
    var d = dirKey(e);
    if (d) { keys[d] = 1; pi.path = null; pi.want = null; car.target = null; heli.target = null; e.preventDefault(); if (egg) egg.t = 99; return; }
    if (aboard() && (e.key === "e" || e.key === "E" || e.key === "Enter")) { e.preventDefault(); toggleHeli(); return; }
    if (aboard() && e.key === " ") { e.preventDefault(); bubble = { text: "whup whup whup", t: 1 }; return; }
    if (car.driving && (e.key === "e" || e.key === "E" || e.key === "Enter")) { e.preventDefault(); toggleCar(); return; }
    if (car.driving && e.key === " ") { e.preventDefault(); bubble = { text: "beep beep", t: 1 }; sfx("honk"); return; }
    if (e.key === "Escape") { e.preventDefault(); if (!dlg.hidden) closeDialog(); else if (side && side.phase === "walk") { side = null; fade = 1; } else if (!side) exit(); return; }
    if (e.key === "Shift") { keys.run = 1; return; }
    if (side && e.key === " " && dlg.hidden) { e.preventDefault(); keys.jump = 1; return; }
    if ((e.key === "m" || e.key === "M") && SND) { SND.toggle(); return; }
    if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "A") return;   // let links work
      e.preventDefault();
      if (egg) { egg.t = 99; return; }
      if (side) { if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); } return; }
      if (riftBusy()) return;
      if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
      var s = nearby(); if (s) interact(s);
    }
  });
  cv.addEventListener("pointerup", function () { if (side) side.tap = 0; });
  cv.addEventListener("pointercancel", function () { if (side) side.tap = 0; });
  window.addEventListener("keyup", function (e) { var d = dirKey(e); if (d) keys[d] = 0; if (e.key === "Shift") keys.run = 0; });
  window.addEventListener("blur", function () { keys = {}; });

  cv.addEventListener("pointerdown", function (e) {
    if (!open || termOpen) return;
    if (mapRect && e.clientX >= mapRect[0] && e.clientX <= mapRect[0] + mapRect[2] && e.clientY >= mapRect[1] && e.clientY <= mapRect[1] + mapRect[3]) { mapOn = !mapOn; sfx("blip"); return; }
    if (egg) { egg.t = 99; return; }
    if (riftBusy()) return;
    if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
    var E = S * zoom, wx = camX + e.clientX / E, wy = camY + e.clientY / E;
    var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (car.driving) { car.target = { x: wx, y: wy }; return; }
    if (side) { if (side.phase === "walk") { if (e.clientY < H * 0.45) keys.jump = 1; else side.tap = e.clientX < W / 2 ? -1 : 1; } return; }
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
    if (hit) {
      var goal = hit.id === "rex" ? [Math.floor(rex.x / T), Math.floor(rex.y / T)] : hit.id === "core" ? [36, 26] : hit.gx !== undefined ? [hit.gx, hit.gy] : [hit.x, hit.y + 1];
      pi.path = bfs([Math.floor(pi.x / T), Math.floor(pi.y / T)], goal, true); pi.want = hit;
    } else {
      pi.path = bfs([Math.floor(pi.x / T), Math.floor(pi.y / T)], [tx, ty], false); pi.want = null;
    }
  });

  // breadth-first path over walkable tiles; "loose" accepts the closest tile next to the goal
  function bfs(a, b, loose) {
    var q = [a], prev = {}, seen = {}; seen[k(a[0], a[1])] = 1;
    var best = null, bestD = 1e9;
    while (q.length) {
      var c = q.shift(), d = Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]);
      if (d < bestD) { bestD = d; best = c; }
      if (d === 0 || (loose && d <= 1)) { best = c; break; }
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (n) {
        var nx = c[0] + n[0], ny = c[1] + n[1], kk = k(nx, ny);
        if (!seen[kk] && walkable(nx, ny)) { seen[kk] = 1; prev[kk] = c; q.push([nx, ny]); }
      });
    }
    if (!best || (!loose && bestD > 3)) return null;
    var p = [best];
    while (prev[k(p[0][0], p[0][1])]) p.unshift(prev[k(p[0][0], p[0][1])]);
    p.shift();
    return p;
  }

  function nearby() {
    if (room) { var bb = null, bdd = 1e9; roomCandidates().forEach(function (c) { if (c.d < c.max && c.d < bdd) { bdd = c.d; bb = c.v; } }); return bb; }
    if (car.driving || aboard()) return null;
    var best = null, bd = 1e9;
    nearCandidates().forEach(function (c) { if (c.d < c.max && c.d < bd) { bd = c.d; best = c.v; } });
    if (rift && rift.phase === "reign" && Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y) < 30) best = { id: "core", name: "the core" };
    return best;
  }

  /* ════════ dialog ════════ */
  var typing = null, full = "";
  var REX = ["rex: RAWR. (he means hi.)", "rex does a little hop. he's a chrome-dino homage and he knows it.", "rex: have you tried turning the router off and on again?", "rex is guarding the meadow from pterodactyls. so far, so good."];
  function interact(s) {
    pi.path = null; pi.want = null; keys = {};
    if (s.id === "rex") { rex.hop = 1; rex.vy = -2.2; say("rex", REX[(Math.random() * REX.length) | 0], []); return; }
    if (s.id === "core") { coreSay(false); return; }
    if (s.id === "cave") { openTerm(); return; }
    if (s.id === "shrine") { say("an old shrine", "a standing stone, older than the park, with a ring carved into it. the ring is warm. something on the other side of it is breathing.", [["step through", "#descend"]]); return; }
    if (s.id === "heli") { toggleHeli(); return; }
    if (s.id === "car") { toggleCar(); bubble = { text: "pi:~$ vroom. arrows drive, space honks, e parks", t: 3.5 }; return; }
    if (s.id === "critter" || s.id === "bird" || s.id === "pond" || s.id === "nest" || s.id === "fence") { sayLocal(s); return; }
    if (s.id === "building") { if (s.ref.room) enterRoom(s.ref.room); else say(s.ref.name, s.ref.text, []); return; }
    if (s.id === "roomitem") { say(s.name, s.text, []); return; }
    if (s.id === "bot") { var bl = BOTSAY[s.ref.kind]; sfx("chatter", s.ref.x, s.ref.y); say("a bot", bl[(Math.random() * bl.length) | 0], []); return; }
    if (s.id === "drink") pi.boost = 10;
    if (s.found && !found[s.id]) {
      found[s.id] = 1; paintFound(); setTimeout(function () { sfx("found"); }, 120);
      try { sessionStorage.setItem("pi-found", JSON.stringify(Object.keys(found))); } catch (e) {}
    }
    var all = Object.keys(found).length === TOTAL && s.found, extra = "";
    if (all && !rift) { extra = " (that's all eight. the ground just shifted. close this and look up.)"; pendingRift = true; }
    say(s.name, s.text + extra, s.links || []);
  }
  function say(name, text, links) {
    dName.textContent = name; dLinks.innerHTML = ""; dlg.hidden = false;
    links.forEach(function (l) {
      var a = document.createElement("a"); a.textContent = l[0]; a.href = l[1] === "#exit" ? "#" : l[1];
      if (/^https?:|^mailto:/.test(l[1])) { a.target = "_blank"; a.rel = "noopener"; }
      else if (l[1] === "#rematch") a.addEventListener("click", function (e) { e.preventDefault(); rift = null; startRift(); });
      else if (l[1] === "#eclipse") a.addEventListener("click", function (e) { e.preventDefault(); crown("eclipse"); });
      else if (l[1] === "#descend") a.addEventListener("click", function (e) { e.preventDefault(); enterSide(); });
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
  function finishTyping() { clearInterval(typing); typing = null; dText.textContent = full; }
  function closeDialog() {
    finishTyping(); dlg.hidden = true; cv.focus({ preventScroll: true });
    if (pendingRift && open) { pendingRift = false; setTimeout(startRift, 400); }
  }
  function paintFound() {
    foundEl.textContent = "found " + Object.keys(found).filter(function (id) { return STATIONS.some(function (s) { return s.id === id && s.found; }); }).length + "/" + TOTAL
      + (rift && rift.winner ? " · core: " + rift.winner : "");
  }
  paintFound();

  /* ════════ outlined, cached frames for everything that moves ════════ */
  var frameCache = {};
  function frameCanvas(rows, pal, w) {
    var key = rows.join("|") + JSON.stringify(pal);
    if (!frameCache[key]) {
      var c = document.createElement("canvas"); c.width = w; c.height = rows.length;
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
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
        g.addColorStop(0, "rgba(" + l[3] + "," + (l[4] * night).toFixed(3) + ")"); g.addColorStop(1, "rgba(" + l[3] + ",0)");
        ctx.fillStyle = g; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
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
     the dinosaurs are built from shapes (ellipses, tapered tubes, polygons), snapped to
     whole pixels, then shaded by hand-rolled rules: lit along the back, darker toward
     the belly, a rim of light on top, spots dithered in, far legs pushed into shadow. */
  function bez(p, u) { var q = p.map(function (a) { return a.slice(); }); for (var n = q.length - 1; n > 0; n--) for (var i = 0; i < n; i++) { q[i][0] += (q[i + 1][0] - q[i][0]) * u; q[i][1] += (q[i + 1][1] - q[i][1]) * u; } return q[0]; }
  /* ════════ creature rendering ════════
     every creature is authored as shapes on a small grid, rasterized larger (DS), then lit.
     parts: each shape is its own part unless it names a group, so a leg reads as a leg and
     the body, neck, head and tail (one group) read as one smooth form. each part gets a
     rounded height from its distance to its own edge, a normal from that, and a light from
     the top left: surfaces facing the light are bright, surfaces turned away are dark (not
     pillow shading: the light has a direction). where a nearer part overlaps a farther one,
     the farther one is shadowed along the seam. outlines are "sel-out": lit edges get a
     warm dark of the creature's own colour, shadowed edges a deeper one. */
  var DS = 1.6, BODY = 1, LX = -0.55, LY = -0.62, LZ = 0.56;
  function selout(hex, k) { var n = parseInt(hex.slice(1), 16); return "rgb(" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) { return Math.round(c * (k || 0.45)); }).join(",") + ")"; }
  function shapeArt(w0, h0, pal, draw, P, ds) {
    ds = ds || DS;
    var w = Math.ceil(w0 * ds), h = Math.ceil(h0 * ds), N = w * h, kind = [], grp = [], order = {}, eyes = [], i, nextG = 100, stamps = 0;
    for (i = 0; i < N; i++) { kind.push(null); grp.push(-1); }
    var sc = document.createElement("canvas"); sc.width = w; sc.height = h; var sg = sc.getContext("2d");
    function stamp(key, fn, g) {
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, w, h); sg.setTransform(ds, 0, 0, ds, 0, 0);
      sg.fillStyle = "#fff"; sg.beginPath(); fn(sg); sg.fill();
      var gid = g !== undefined ? g : nextG++;
      if (order[gid] === undefined) order[gid] = stamps++;
      var d = sg.getImageData(0, 0, w, h).data;
      for (var i2 = 0; i2 < N; i2++) if (d[i2 * 4 + 3] > 118) { kind[i2] = key; grp[i2] = gid; }
    }
    var a = {
      ell: function (key, x, y, rx, ry, rot, g) { stamp(key, function (c) { c.ellipse(x, y, rx, ry, rot || 0, 0, 6.283); }, g); },
      poly: function (key, pts, g) { stamp(key, function (c) { pts.forEach(function (p, j) { if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); }, g); },
      tube: function (key, pts, r0, r1, g) { stamp(key, function (c) { for (var j = 0; j <= 36; j++) { var u = j / 36, p = bez(pts, u), rr = Math.max(0.5, r0 + (r1 - r0) * u); c.moveTo(p[0] + rr, p[1]); c.arc(p[0], p[1], rr, 0, 6.283); } }, g); },
      px: function (key, x, y, pw, ph) {
        var x0 = Math.round(x * ds), y0 = Math.round(y * ds), x1 = Math.max(x0 + 1, Math.round((x + (pw || 1)) * ds)), y1 = Math.max(y0 + 1, Math.round((y + (ph || 1)) * ds));
        for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) { kind[yy * w + xx] = key; if (grp[yy * w + xx] < 0) grp[yy * w + xx] = 99; }
      },
      eye: function (x, y) { eyes.push([Math.round(x * ds), Math.round(y * ds)]); }
    };
    draw(a, P);
    eyes.forEach(function (e) { [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (o) { var ex = e[0] + o[0], ey = e[1] + o[1]; if (ex < w && ey < h) { kind[ey * w + ex] = "K"; grp[ey * w + ex] = 98; } }); if (e[0] + 1 < w) kind[e[1] * w + e[0] + 1] = "W"; });
    function G(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? -1 : kind[y * w + x] ? grp[y * w + x] : -1; }
    // distance from each pixel to the edge of its own part (chamfer, two passes)
    var dist = new Float32Array(N), BIG = 1e6;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var g0 = G(x, y); if (g0 < 0) { dist[y * w + x] = 0; continue; }
      dist[y * w + x] = G(x - 1, y) !== g0 || G(x + 1, y) !== g0 || G(x, y - 1) !== g0 || G(x, y + 1) !== g0 ? 0.6 : BIG;
    }
    function relax(x, y, dx, dy, c) { var nx = x + dx, ny = y + dy; if (G(nx, ny) === G(x, y)) { var v = dist[ny * w + nx] + c; if (v < dist[y * w + x]) dist[y * w + x] = v; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (G(x, y) >= 0) { relax(x, y, -1, 0, 1); relax(x, y, 0, -1, 1); relax(x, y, -1, -1, 1.4); relax(x, y, 1, -1, 1.4); }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) if (G(x, y) >= 0) { relax(x, y, 1, 0, 1); relax(x, y, 0, 1, 1); relax(x, y, 1, 1, 1.4); relax(x, y, -1, 1, 1.4); }
    var R = (pal.round || 4.5) * ds / 1.6;
    function H(x, y, g0) { if (G(x, y) !== g0) return 0; var d = Math.min(dist[y * w + x], R) / R; return R * (1 - (1 - d) * (1 - d)); }
    var out = document.createElement("canvas"); out.width = w + 2; out.height = h + 2; var og = out.getContext("2d");
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var q = kind[y * w + x]; if (!q) continue;
      var gg = grp[y * w + x], col;
      if (q === "K") col = "#0b0908";
      else if (q === "W") col = "#f7f3ea";
      else {
        var ramp = q === "L" ? pal.L : q === "A" ? pal.A : q === "H" ? pal.H : pal.B;
        var nx = H(x - 1, y, gg) - H(x + 1, y, gg), ny = H(x, y - 1, gg) - H(x, y + 1, gg), nz = 1.6, nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        var lam = (nx * -LX + ny * -LY + nz * LZ) / nl;                      // facing the light (top left, a little in front)
        var v = 0.16 + 0.78 * Math.max(0, lam);
        if (lam > 0.9) v += 0.1;                                             // a hot spot where it faces the light square on
        if (q === "F") v -= 0.3;
        // the farther part is shadowed where a nearer one overlaps it
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var gn = G(x + ox, y + oy); if (gn >= 0 && gn !== gg && order[gn] > order[gg] && gn < 98) { v -= 0.18; oy = ox = 3; } }
        var up = ny > 0.15;                                                  // facing upward: the creature's back
        if (q === "B" && pal.spots && hash(((x + (pal.seed || 0)) >> 1) * 3, (y >> 1) * 5 + (pal.seed || 0)) < pal.spots) v += pal.spotV || -0.25;
        if (q === "B" && pal.pattern === "stripes" && up && ((x + y * 0.45 + (pal.seed || 0)) % 7) < 1.7) v -= 0.28;
        if (q === "B" && pal.pattern === "rosettes" && up) {
          var cx0 = Math.floor(x / 7), cy0 = Math.floor(y / 6), rd = Math.hypot(x + 0.5 - (cx0 * 7 + 3.5), (y + 0.5 - (cy0 * 6 + 3)) * 1.2);
          if (hash(cx0, cy0 + 50) < 0.6 && rd > 1.2 && rd < 2.4) { og.fillStyle = tone(0.35 + 0.55 * Math.max(0, lam), pal.A, x, y); og.fillRect(x + 1, y + 1, 1, 1); continue; }
        }
        if (q === "B" && pal.scales && ((x + (y >> 1)) % 3 === 0) && (y % 2 === 0)) v -= 0.07;   // a hint of scale texture
        v += (hash(x * 7 + (pal.seed || 0), y * 3) - 0.5) * 0.08;
        col = tone(v, ramp, x, y);
      }
      og.fillStyle = col; og.fillRect(x + 1, y + 1, 1, 1);
    }
    // sel-out: the outline on the lit side is a warm dark, on the shadow side a deep one
    var lit = selout(pal.B[1], 0.55), dark = selout(pal.B[0], 0.4);
    for (y = -1; y <= h; y++) for (x = -1; x <= w; x++) {
      if (G(x, y) >= 0) continue;
      var r2 = G(x + 1, y) >= 0, d2 = G(x, y + 1) >= 0, l2 = G(x - 1, y) >= 0, u2 = G(x, y - 1) >= 0;
      if (!(r2 || d2 || l2 || u2)) continue;
      og.fillStyle = (r2 || d2) && !(l2 || u2) ? lit : dark; og.fillRect(x + 1, y + 1, 1, 1);
    }
    return out;
  }
  /* poses. every creature is drawn from a pose P = { mode, ph }: mode is walk, idle, blink,
     graze, roar or fly, and ph runs 0..1 through the cycle. walks are six frames. four-legged
     animals step in a four-beat walk (near hind, near fore, far hind, far fore, a quarter
     apart); two-legged ones alternate. each foot slides back along the ground for half its
     cycle and lifts and swings forward for the other half; the body bobs twice per cycle and
     the head and tail follow a beat behind. idles breathe and blink. */
  function gait(P, off) {
    if (P.mode !== "walk") return { dx: 0, lift: 0 };
    var p = (P.ph + off) % 1;
    return p < 0.5 ? { dx: 1 - p * 4, lift: 0 } : { dx: -1 + (p - 0.5) * 4, lift: Math.sin((p - 0.5) * 2 * Math.PI) };
  }
  function limb(a, key, hx, hy, fy, stride, liftH, g, r0, r1, bend) {
    var fx = hx + g.dx * stride, ly = fy - g.lift * liftH, kx = (hx + fx) / 2 + (bend || 0) * (1 + g.lift * 1.5);
    a.tube(key, [[hx, hy], [kx, (hy + ly) / 2], [fx, ly]], r0, r1);
    a.ell(key, fx + 0.6, ly - 0.2, r1 * 1.25, 0.9);                        // a flat foot
    return [fx, ly];
  }
  // a theropod leg: heavy thigh, shin angled forward to the knee, a long metatarsus back to the ankle, three toes
  function tleg(a, key, hx, hy, fy, stride, liftH, g, th, sickle) {
    var fx = hx + g.dx * stride, ly = fy - g.lift * liftH;
    a.ell(key, hx - 0.4, hy + th * 0.6, th * 1.25, th * 1.7, 0.3);
    var kx = hx + th * 0.7 + g.lift * 1.4, ky = hy + th * 2, ax = fx - th * 0.5 - g.lift * 0.8, ay = ly - th * 1.3;
    a.tube(key, [[hx, hy + th], [kx, ky], [ax, ay]], th * 0.85, th * 0.5);
    a.tube(key, [[ax, ay], [fx, ly - 0.4]], th * 0.45, th * 0.38);
    a.poly(key, [[fx - th * 0.6, ly - 0.9], [fx + th * 1.1, ly - 0.7], [fx + th * 1.3, ly + 0.9], [fx - th * 0.6, ly + 0.9]]);
    a.px("H", fx + th * 1.2, ly - 0.2, 0.8, 0.8);
    if (sickle) a.px("H", fx + 0.2, ly - 1.4, 0.8, 1);
    return [fx, ly];
  }
  function bobOf(P, amp) { return P.mode === "walk" ? -Math.abs(Math.sin(P.ph * Math.PI * 2)) * amp : 0; }
  function breathe(P) { return P.mode === "idle" || P.mode === "blink" ? Math.sin(P.ph * Math.PI * 2) * 0.35 : 0; }
  function swayOf(P) { return Math.sin(P.ph * Math.PI * 2 + 1) * (P.mode === "walk" ? 1.3 : 0.9); }
  function eye(a, P, x, y) { if (P.mode !== "blink") a.eye(x, y); }
  function chew(P) { return P.mode === "graze" && P.ph >= 0.5 ? 0.6 : 0; }
  /* the species. proportions follow current reconstructions: tyrannosaurs and other theropods
     carry the spine near horizontal with the tail held straight out as a counterweight;
     stegosaurus has short forelimbs and a high-arched back; brachiosaurus is the reverse, with
     long forelimbs and a steeply rising trunk; raptors are feathered; spinosaurus has a tall
     sail and a crocodile-like snout for fishing along the river. */
  var ART = {
    trex: { w: 46, h: 28, pal: { B: ["#132f1a", "#1d4a24", "#28662e", "#3c8a3a", "#5eac50", "#86c870"], L: ["#6f9a52", "#94b86e", "#bcd694"], H: ["#bfb8a2", "#f4efe0"], A: ["#7a3a10", "#b8581c", "#e8883a"], pattern: "rosettes", scales: 1, seed: 23, round: 5 },
      draw: function (a, P) {
        var b = bobOf(P, 1), br = breathe(P), sw = swayOf(P), roar = P.mode === "roar", jaw = roar ? (P.ph < 0.5 ? 3.5 : 4.5) : 0, hy = b + (roar ? -2.5 : 0) + br * 0.5;
        tleg(a, "F", 19, 14 + b, 27, 3.2, 2.6, gait(P, 0.5), 3.2);
        a.tube("B", [[16, 11.5 + b], [8, 10 + b + sw * 0.3], [0.6, 9.5 + sw]], 5.2, 0.8, BODY);
        a.ell("B", 21.5, 12.5 + b, 9.5, 6.2 + br, -0.06, BODY);
        a.tube("B", [[27.5, 10.5 + b], [30.5, 8.5 + b], [32, 7 + hy]], 4.8, 4.4, BODY);
        a.poly("B", [[29, 3.5 + hy], [38, 3 + hy], [43.5, 5.5 + hy], [44.8, 9 + hy], [39, 10 + hy], [31, 10.8 + hy]], BODY);
        a.poly("B", [[31, 10 + hy], [43.8, 9.5 + hy + jaw], [42.8, 12 + hy + jaw], [33, 13.2 + hy]], BODY);
        a.tube("L", [[26.5, 15.5 + b], [21, 18.4 + b], [14, 16.5 + b]], 1.8, 1.2, BODY); a.tube("L", [[33, 12.8 + hy], [29, 14 + b]], 1.4, 1.4, BODY);
        if (roar) { a.poly("K", [[32, 10.5 + hy], [43.5, 10 + hy], [43, 10 + hy + jaw], [33, 12 + hy]]); for (var i = 33; i <= 42; i += 2) { a.px("H", i, 10.4 + hy, 0.8, 1); a.px("H", i + 1, 9.2 + hy + jaw, 0.8, 1); } }
        else { a.px("K", 32, 10 + hy, 12, 0.7); for (i = 34; i <= 42; i += 2) a.px("H", i, 10.6 + hy, 0.7, 0.8); }
        a.tube("B", [[29, 14 + b], [31.5, 16.8 + b], [33, 16 + b]], 1.2, 0.8);
        tleg(a, "B", 19, 14 + b, 27, 3.2, 2.6, gait(P, 0), 3.4);
        a.px("K", 36.2, 4.4 + hy, 3, 0.6); eye(a, P, 37, 5.4 + hy); a.px("K", 43.4, 6.2 + hy, 0.8, 0.8);
      } },
    raptor: { w: 31, h: 18, pal: { B: ["#34100c", "#4f1d16", "#6d2c20", "#8e402e", "#ae5c3c", "#c8784e"], L: ["#b89468", "#d6b486", "#eed4aa"], A: ["#0c2226", "#163a3e", "#245a5e", "#3a8288"], H: ["#bdb4a0", "#f0ead8"], pattern: "stripes", seed: 67, round: 3.5 },
      draw: function (a, P) {
        var b = bobOf(P, 1.1), br = breathe(P), sw = swayOf(P) * 1.1, look = P.mode === "idle" ? [0, -0.8, 0, 0.6][Math.round(P.ph * 4) % 4] : 0, hy = b * 0.7 + look;
        tleg(a, "F", 12, 8.5 + b, 17, 3.6, 2.4, gait(P, 0.5), 1.8, true);
        a.poly("A", [[3, 5 + b + sw * 0.4], [-0.5, 3.4 + sw * 0.7], [-0.5, 8.2 + sw * 0.7], [3, 7.4 + b + sw * 0.4]]);   // the tail fan
        a.tube("B", [[9, 7.2 + b], [4, 6.2 + b + sw * 0.3], [0.5, 5.8 + sw * 0.7]], 2.4, 0.9, BODY);
        a.ell("B", 13, 8.2 + b, 5.6, 3.3 + br * 0.5, -0.05, BODY);
        a.tube("B", [[17.5, 7 + b], [20, 5 + hy], [21.5, 3.4 + hy]], 2.2, 1.8, BODY);
        a.poly("B", [[20, 1.4 + hy], [25.5, 1.8 + hy], [30, 3.6 + hy], [29, 5.2 + hy], [22, 5.6 + hy]], BODY);
        a.tube("L", [[17, 10 + b], [13, 11 + b], [9, 9.5 + b]], 1.3, 1, BODY); a.tube("L", [[21.5, 5.4 + hy], [24, 5 + hy]], 0.8, 0.7, BODY);
        a.poly("A", [[20.5, 1.6 + hy], [18.6, 0.2 + hy], [21.5, 1 + hy]]);                                                     // crest feathers
        a.tube("B", [[17, 9 + b], [19, 11 + b], [20.5, 11.2 + b]], 0.9, 0.6);
        a.poly("A", [[16.5, 9.4 + b], [20.6, 11.4 + b], [17.4, 13 + b]]);                                                      // arm feathers
        tleg(a, "B", 12, 9 + b, 17, 3.6, 2.4, gait(P, 0), 1.9, true);
        eye(a, P, 24.6, 2.4 + hy); a.px("K", 25.5, 4.7 + hy, 4, 0.5);
      } },
    brachio: { w: 46, h: 50, pal: { B: ["#3f4a14", "#58661c", "#768a26", "#96aa36", "#b8c858", "#d2dc84"], L: ["#8a9058", "#a9ae76", "#cacd98"], spots: 0.14, spotV: -0.25, seed: 11, round: 6 },
      draw: function (a, P) {
        var b = bobOf(P, 0.8), br = breathe(P), sw = swayOf(P), gz = P.mode === "graze" ? 1 : 0;
        limb(a, "F", 30, 32 + b, 49, 2.4, 2, gait(P, 0.75), 2.8, 2.3, 0.6);
        limb(a, "F", 13, 35 + b, 49, 2.4, 2, gait(P, 0.5), 3, 2.4, -0.6);
        a.tube("B", [[10, 34 + b], [3, 37 + b + sw * 0.4], [1 + sw * 0.3, 44 + sw]], 4.4, 0.8, BODY);
        a.ell("B", 20, 32 + b, 13, 7.8 + br, -0.28, BODY);
        var hx = 35.5 + gz * 1.5 + (P.mode === "walk" ? Math.sin(P.ph * Math.PI * 4) * 0.5 : 0), hy = 7 + b * 0.6 - gz * 1.5 + br;
        a.tube("B", [[29, 26 + b], [35, 18 + b], [hx, hy]], 5, 2.6, BODY);
        a.ell("B", hx + 2, hy - 1.6, 4.2, 2.8, 0.1, BODY); a.ell("B", hx + 1.6, hy - 3.4, 2.2, 1.6, 0, BODY);   // the arched nasal crest
        a.tube("B", [[hx + 3.5, hy - 1], [hx + 7.8, hy + 0.4 + chew(P)]], 2.1, 1.4, BODY);
        a.tube("L", [[32, 28 + b], [37.4, 18.5 + b], [hx + 2.5, hy + 2]], 1.3, 0.9, BODY);
        a.ell("L", 20, 37.5 + b, 9, 2.2, -0.2, BODY);
        limb(a, "B", 28, 33 + b, 49, 2.4, 2, gait(P, 0.25), 3.2, 2.6, 0.6);
        limb(a, "B", 12, 36 + b, 49, 2.4, 2, gait(P, 0), 3.4, 2.7, -0.6);
        eye(a, P, hx + 2.8, hy - 2.6); a.px("K", hx + 6.8, hy - 0.2, 0.8, 0.8);
      } },
    stego: { w: 40, h: 27, pal: { B: ["#111c36", "#1b2c52", "#28416f", "#3c5c93", "#5d80b6", "#86a4d0"], A: ["#7a2410", "#b04418", "#e06a2a", "#f7a95e"], L: ["#50627e", "#71849f", "#98abc4"], H: ["#bdb49c", "#efe8d6"], spots: 0.08, spotV: 0.25, seed: 37, round: 5 },
      draw: function (a, P) {
        var b = bobOf(P, 0.7), br = breathe(P), sw = swayOf(P), gz = P.mode === "graze" ? 1 : 0, i;
        function back(px) { return 14 + b - (7.2 + br) * Math.sqrt(Math.max(0, 1 - Math.pow((px - 18) / 12, 2))) + (px - 18) * 0.12; }
        for (i = 0; i < 7; i++) { var px = 9.5 + i * 3.2, top = back(px), sz = 2.2 + 3.4 * Math.sin(Math.PI * (i + 0.3) / 7.5); a.poly("A", [[px - 2, top + 2], [px + 0.8, top - sz - 1.2], [px + 2.2, top + 2]]); }   // far row
        limb(a, "F", 25, 18 + b, 26, 2, 1.6, gait(P, 0.75), 2.2, 1.8, 0.3); limb(a, "F", 12, 16 + b, 26, 2.2, 1.8, gait(P, 0.5), 2.6, 2.1, -0.3);
        a.tube("B", [[8, 13 + b], [3, 11 + b + sw * 0.4], [0.5, 12 + sw * 0.8]], 3.8, 1.1, BODY);
        a.tube("H", [[2.2, 11 + sw * 0.7], [0.6, 6.5 + sw * 0.7]], 0.75, 0.35); a.tube("H", [[3.4, 10.8 + sw * 0.6], [3, 6 + sw * 0.6]], 0.75, 0.35);
        a.tube("H", [[2, 12.6 + sw * 0.7], [-0.4, 15 + sw * 0.7]], 0.7, 0.35); a.tube("H", [[3.4, 12.6 + sw * 0.6], [2.2, 15.6 + sw * 0.6]], 0.7, 0.35);
        a.ell("B", 18, 14.5 + b, 12, 7.2 + br, 0.14, BODY);
        var hx = 35.5 + gz * 0.5, hy = 20.5 + b * 0.5 + gz * 2.5 + chew(P);
        a.tube("B", [[28, 17 + b], [hx - 1.5, hy - 0.5]], 3.4, 2.2, BODY); a.ell("B", hx, hy, 3, 2, 0.2, BODY);
        a.ell("L", 18, 19.4 + b, 8.5, 2, 0.14, BODY);
        for (i = 0; i < 7; i++) { px = 8 + i * 3.2; top = back(px); sz = 2 + 3.6 * Math.sin(Math.PI * (i + 0.5) / 7.5); a.poly("A", [[px - 2.2, top + 2.6], [px - 0.2, top - sz - 0.4], [px + 2.2, top + 2.6]]); }   // near row
        limb(a, "B", 26, 19 + b, 26, 2, 1.6, gait(P, 0.25), 2.6, 2.2, 0.3); limb(a, "B", 12, 17 + b, 26, 2.2, 1.8, gait(P, 0), 3, 2.4, -0.3);
        eye(a, P, hx + 0.5, hy - 0.8);
      } },
    trike: { w: 40, h: 25, pal: { B: ["#5a2c12", "#7e3e1a", "#a3582a", "#c77b3b", "#e3a064", "#f2c28a"], A: ["#6a2a1e", "#9a3f2a", "#c65c3c", "#e88a5c"], L: ["#c9a27a", "#e0bf96", "#f2dcb8"], H: ["#bdb094", "#f5eedc"], seed: 41, round: 5.5 },
      draw: function (a, P) {
        var b = bobOf(P, 0.7), br = breathe(P), sw = swayOf(P), gz = P.mode === "graze" ? 1 : 0, dy = b * 0.5 + gz * 2.6 + chew(P);
        limb(a, "F", 25, 15 + b, 24, 2, 1.6, gait(P, 0.75), 2.6, 2.2, 0.6); limb(a, "F", 10, 15 + b, 24, 2, 1.6, gait(P, 0.5), 2.8, 2.3, -0.3);
        a.tube("B", [[6, 12 + b], [0.6, 14 + b + sw * 0.6]], 3.4, 1, BODY);
        a.ell("B", 16, 12.5 + b, 11.5, 7 + br, 0, BODY);
        a.ell("A", 29, 9.5 + dy, 4.6, 7.8, 0.3 + gz * 0.3);                                         // the frill
        for (var i = 0; i < 5; i++) a.px("H", 29 + Math.cos(-1.9 + i * 0.5) * 4.6, 9.5 + dy + Math.sin(-1.9 + i * 0.5) * 7.4, 0.8, 0.8);   // bony knobs on its rim
        a.poly("B", [[27, 7 + dy], [33, 10 + dy], [37, 13.5 + dy], [35, 17.5 + dy], [28, 17.5 + dy], [25.5, 12.5 + dy]]);
        a.poly("H", [[35, 14 + dy], [39.5, 15.2 + dy], [36.5, 17.5 + dy]]);                             // beak
        a.tube("H", [[30.5, 8.5 + dy], [37.5, 2 + dy + gz]], 1.2, 0.4); a.tube("H", [[32.4, 9.6 + dy], [39, 4.5 + dy + gz]], 1.1, 0.4); a.tube("H", [[35.2, 12.4 + dy], [37.4, 9.5 + dy]], 0.9, 0.4);
        a.ell("L", 16, 17 + b, 8, 2);
        limb(a, "B", 25, 16 + b, 24, 2, 1.6, gait(P, 0.25), 3.1, 2.6, 0.6); limb(a, "B", 10, 16 + b, 24, 2, 1.6, gait(P, 0), 3.3, 2.7, -0.3);
        eye(a, P, 31.2, 11.2 + dy);
      } },
    para: { w: 36, h: 30, pal: { B: ["#6a3f18", "#8f5a26", "#b37a36", "#d49a52", "#ecc27e", "#f6dca6"], A: ["#7a2412", "#a8381a", "#d45a2a", "#f08a4a"], L: ["#d8b88a", "#ecd2a8", "#f8e8cc"], H: ["#bdb094", "#f5eedc"], pattern: "stripes", seed: 53, round: 4.5 },
      draw: function (a, P) {
        var b = bobOf(P, 1), br = breathe(P), sw = swayOf(P), gz = P.mode === "graze" ? 1 : 0;
        tleg(a, "F", 16, 15.5 + b, 29, 2.8, 2.2, gait(P, 0.5), 2.3);
        a.tube("B", [[10, 14 + b], [4, 14 + b + sw * 0.4], [0.5, 16.5 + sw]], 3.8, 0.8, BODY);
        a.ell("B", 17, 14 + b, 8.5, 5.6 + br, -0.12 + gz * 0.15, BODY);
        var hx = 27 + gz * 2, hy = 5.5 + b * 0.6 + gz * 8 + chew(P) + br * 0.5;
        a.tube("B", [[22, 11.5 + b], [hx - 1.5, hy + 1]], 3.2, 2.5, BODY);
        a.ell("B", hx, hy, 3.3, 2.4, 0, BODY); a.tube("B", [[hx + 0.5, hy + 0.8], [hx + 6, hy + 2.2]], 1.9, 1.3, BODY);
        a.tube("A", [[hx - 1.5, hy - 1.4], [hx - 6, hy - 4 + gz * 1.5], [hx - 11, hy - 4.2 + gz * 3]], 1.8, 1.2);
        a.tube("B", [[22, 15 + b], [24.5, 19 + b]], 1.1, 0.8);
        a.tube("L", [[22, 17 + b], [17, 19.4 + b], [11, 17 + b]], 1.6, 1, BODY); a.tube("L", [[hx - 1.5, hy + 3], [23, 11.5 + b]], 1.1, 1, BODY);
        tleg(a, "B", 16, 16 + b, 29, 2.8, 2.2, gait(P, 0), 2.5);
        eye(a, P, hx + 0.6, hy - 1.3);
      } },
    ankylo: { w: 40, h: 21, pal: { B: ["#211a12", "#34281b", "#4a3a27", "#624e36", "#7d684a", "#9c8666"], A: ["#8a7250", "#b89c74", "#e0cca4", "#f4e6c4"], L: ["#8a4f1e", "#b0682a", "#d08a44", "#e8a860"], seed: 71, round: 5 },
      draw: function (a, P) {
        var b = bobOf(P, 0.5), br = breathe(P), sw = swayOf(P) * 1.5, gz = P.mode === "graze" ? 1 : 0, i;
        limb(a, "F", 27, 12 + b, 20, 1.6, 1.3, gait(P, 0.75), 2.4, 2.1, 0.2); limb(a, "F", 11, 12 + b, 20, 1.6, 1.3, gait(P, 0.5), 2.6, 2.2, -0.2);
        a.tube("B", [[7, 10 + b], [1.8, 8.5 + b + sw * 0.6]], 2.6, 1.5, BODY); a.ell("A", 2.2, 7.8 + b + sw * 0.8, 2.8, 2.2);   // the club
        a.ell("B", 19, 10 + b, 13, 6.8 + br, 0, BODY);
        for (i = 6; i <= 32; i += 3.2) a.poly("A", [[i - 1.3, 13.4 + b], [i, 16.2 + b], [i + 1.3, 13.4 + b]]);             // side spikes
        for (var yy = 5; yy <= 12; yy += 3) for (var xx = 8 + (yy % 2) * 1.6; xx <= 30; xx += 3.4) if (Math.pow((xx - 19) / 13, 2) + Math.pow((yy - 10) / 6.8, 2) < 0.78) a.ell("A", xx, yy + b, 1.2, 0.9);   // osteoderms
        var hy = 12 + b * 0.5 + gz * 2 + chew(P);
        a.ell("L", 33.5, hy, 3.6, 2.8, 0, BODY); a.poly("L", [[35, hy - 1], [38.6, hy + 0.6], [35.5, hy + 2.2]], BODY); a.px("A", 31.5, hy - 2.6, 1.4, 1); a.px("A", 34, hy - 2.8, 1.2, 1);
        limb(a, "L", 26, 14 + b, 20, 1.6, 1.3, gait(P, 0.25), 2.7, 2.3, 0.2); limb(a, "L", 11, 14 + b, 20, 1.6, 1.3, gait(P, 0), 2.9, 2.4, -0.2);
        eye(a, P, 34.2, hy - 1.2);
      } },
    spino: { w: 54, h: 32, pal: { B: ["#2a1c14", "#402a1c", "#5a3c26", "#785236", "#9a6c48", "#bc8e66"], A: ["#6a1414", "#9a2418", "#c83c22", "#e8703a", "#f4a060"], L: ["#a88c6a", "#c8ae88", "#e4d0aa"], H: ["#bdb094", "#f5eedc"], pattern: "stripes", seed: 29, round: 5 },
      draw: function (a, P) {
        // a sail of long spines, a crocodile snout for fish, short hind legs, a deep paddle of a tail
        var b = bobOf(P, 0.9), br = breathe(P), sw = swayOf(P), gz = P.mode === "graze" ? 1 : 0, hy = b * 0.6 + gz * 5 + chew(P);
        tleg(a, "F", 22, 17 + b, 31, 2.8, 2.2, gait(P, 0.5), 2.8);
        a.poly("A", [[14, 12 + b], [16, 2 + b], [20, -0.5 + b], [25, 0.2 + b], [29, 3 + b], [31, 11 + b]]);
        for (var i = 15.5; i <= 30; i += 2.2) a.px("H", i, 2 + b + Math.abs(i - 22) * 0.35, 0.5, 9 - Math.abs(i - 22) * 0.5);
        a.poly("B", [[16, 13 + b], [8, 12.5 + b + sw * 0.3], [0.5, 10 + sw], [1, 16 + sw], [8, 17 + b + sw * 0.3], [16, 18.5 + b]], BODY);   // paddle tail
        a.ell("B", 23, 14.5 + b, 9.5, 5.6 + br, -0.05, BODY);
        a.tube("B", [[30, 12.5 + b], [34, 11 + b + gz * 2], [37, 11 + hy]], 3.6, 3, BODY);
        a.poly("B", [[36, 8.8 + hy], [44, 9.6 + hy], [53.5, 11.6 + hy], [53, 13.4 + hy], [44, 13.6 + hy], [36, 14.2 + hy]], BODY);
        a.px("K", 40, 12.4 + hy, 13, 0.5); for (i = 42; i <= 52; i += 2) a.px("H", i, 12.9 + hy, 0.6, 0.7);
        a.tube("L", [[30, 17.5 + b], [24, 20 + b], [16, 18 + b]], 1.7, 1.1, BODY);
        a.tube("B", [[31, 16 + b], [33.5, 19.5 + b], [35.5, 20 + b]], 1.3, 0.9);
        tleg(a, "B", 22, 17.5 + b, 31, 2.8, 2.2, gait(P, 0), 3);
        eye(a, P, 40.5, 9.8 + hy);
      } },
    dilo: { w: 32, h: 22, pal: { B: ["#1e2a14", "#2c3e1c", "#3e5626", "#567434", "#74944a", "#9ab86a"], A: ["#8a1a14", "#c02a1a", "#e8502a", "#f8c040"], L: ["#b8b48a", "#d4d0a4", "#ecead0"], H: ["#bdb094", "#f5eedc"], pattern: "stripes", seed: 81, round: 3.5 },
      draw: function (a, P) {
        // twin crests, and a frill that fans out when it calls
        var b = bobOf(P, 1), br = breathe(P), sw = swayOf(P) * 1.1, call = P.mode === "roar", hy = b * 0.7 + (call ? -1 : 0);
        tleg(a, "F", 12, 10 + b, 21, 3, 2.2, gait(P, 0.5), 2);
        a.tube("B", [[9, 9 + b], [4, 8 + b + sw * 0.3], [0.5, 7.5 + sw * 0.8]], 2.6, 0.8, BODY);
        a.ell("B", 13.5, 10 + b, 6, 3.8 + br * 0.5, -0.1, BODY);
        a.tube("B", [[18.5, 8.5 + b], [21, 5.5 + hy], [22.5, 4.2 + hy]], 2.4, 2, BODY);
        if (call) a.ell("A", 22, 5.5 + hy, 3.8, 5.4, 0);
        a.poly("B", [[21, 2.4 + hy], [27, 2.8 + hy], [31, 4.6 + hy], [30, 6.4 + hy], [23, 6.8 + hy]], BODY);
        a.ell("A", 24.5, 1.8 + hy, 3.2, 1.3, -0.2); a.ell("A", 25.5, 1.2 + hy, 2.4, 1, -0.2);
        a.tube("L", [[18, 12 + b], [14, 13 + b], [9.5, 11.5 + b]], 1.3, 1, BODY);
        a.tube("B", [[18, 11 + b], [20, 13.5 + b]], 0.9, 0.6);
        tleg(a, "B", 12, 10.5 + b, 21, 3, 2.2, gait(P, 0), 2.1);
        eye(a, P, 26, 3.4 + hy); if (call) a.poly("K", [[27, 5.4 + hy], [31, 5 + hy], [30.4, 6.8 + hy]]);
      } },
    pachy: { w: 30, h: 24, pal: { B: ["#3a2a3a", "#523a52", "#6c4e6a", "#8a6886", "#a888a2", "#c8aac0"], A: ["#8a7a60", "#b8a47e", "#e0d0a8", "#f6ecd0"], L: ["#c8b4b8", "#e0ccd0", "#f2e4e6"], H: ["#bdb094", "#f5eedc"], seed: 61, round: 4 },
      draw: function (a, P) {
        // a thick bony dome ringed with knobs; the head drops low to butt
        var b = bobOf(P, 1), br = breathe(P), sw = swayOf(P), butt = P.mode === "roar" ? 1 : 0, hy = b * 0.6 + butt * 3;
        tleg(a, "F", 12, 12 + b, 23, 2.6, 2, gait(P, 0.5), 2.2);
        a.tube("B", [[9, 11 + b], [4, 10.5 + b + sw * 0.4], [0.5, 11.5 + sw]], 3, 0.8, BODY);
        a.ell("B", 14, 11.5 + b, 7, 5 + br, -0.08 - butt * 0.2, BODY);
        a.tube("B", [[19, 9.5 + b], [21.5, 7.5 + hy]], 2.8, 2.6, BODY);
        a.ell("B", 23.5, 7.5 + hy, 3.8, 3, 0.1, BODY); a.poly("B", [[25, 8 + hy], [29.5, 9.4 + hy], [26, 10.6 + hy]], BODY);
        a.ell("A", 23, 5 + hy, 3.8, 2.8, 0.1);
        for (var i = 0; i < 5; i++) a.px("A", 20.4 + i * 1.3, 7.2 + hy + Math.abs(i - 2) * 0.3, 0.8, 0.8);
        a.tube("L", [[19, 13.5 + b], [14, 15 + b], [10, 13.5 + b]], 1.4, 1, BODY);
        a.tube("B", [[19, 12.5 + b], [21, 15 + b]], 0.9, 0.6);
        tleg(a, "B", 12, 12.5 + b, 23, 2.6, 2, gait(P, 0), 2.4);
        eye(a, P, 25.5, 7 + hy);
      } },
    galli: { w: 30, h: 32, pal: { B: ["#4a3a26", "#6a5236", "#8a6c48", "#aa8a5e", "#c8a878", "#e2c69a"], L: ["#d8cbb0", "#ece0c8", "#faf2e2"], H: ["#bdb094", "#f5eedc"], seed: 47, round: 3.5 },
      draw: function (a, P) {
        // an ostrich of a dinosaur: small head, long neck, very long legs
        var b = bobOf(P, 1.4), br = breathe(P), sw = swayOf(P);
        tleg(a, "F", 12, 14 + b, 31, 4.2, 3.2, gait(P, 0.5), 1.6);
        a.tube("B", [[8, 12 + b], [3, 11.5 + b + sw * 0.4], [0.5, 12.5 + sw]], 2.8, 0.8, BODY);
        a.ell("B", 12.5, 13 + b, 6, 4 + br * 0.5, -0.1, BODY);
        a.tube("B", [[17, 11 + b], [21, 7 + b], [22, 2.6 + b * 0.6]], 1.9, 1.4, BODY);
        a.ell("B", 23.5, 2.2 + b * 0.6, 2.3, 1.7, 0, BODY); a.poly("H", [[25, 1.6 + b * 0.6], [29.5, 2.8 + b * 0.6], [25.2, 3.6 + b * 0.6]]);
        a.tube("L", [[17, 14 + b], [12.5, 16 + b], [8.5, 14.5 + b]], 1.4, 1, BODY); a.tube("L", [[20, 9 + b], [22.4, 4 + b]], 0.8, 0.6, BODY);
        tleg(a, "B", 12, 14.5 + b, 31, 4.2, 3.2, gait(P, 0), 1.7);
        eye(a, P, 23.6, 1.4 + b * 0.6);
      } },
    compy: { w: 16, h: 10, ds: 1.3, pal: { B: ["#1e3a1a", "#2c5424", "#3e7430", "#58963e", "#7ab65a", "#a2d484"], L: ["#c8d8a0", "#dce8b8", "#eef6d6"], H: ["#bdb094", "#f5eedc"], pattern: "stripes", seed: 5, round: 2.5 },
      draw: function (a, P) {
        var b = bobOf(P, 0.7), sw = swayOf(P);
        tleg(a, "F", 7, 5 + b, 9.5, 1.8, 1.4, gait(P, 0.5), 1);
        a.tube("B", [[5, 4.5 + b], [2, 4 + b + sw * 0.3], [0.5, 4 + sw * 0.6]], 1.4, 0.5, BODY);
        a.ell("B", 7.5, 5 + b, 3, 2, -0.1, BODY);
        a.tube("B", [[10, 4 + b], [11.5, 2.4 + b]], 1.1, 0.9, BODY);
        a.poly("B", [[11, 1.2 + b], [15.5, 2 + b], [12, 3.4 + b]], BODY);
        tleg(a, "B", 7, 5.2 + b, 9.5, 1.8, 1.4, gait(P, 0), 1.05);
        eye(a, P, 12.4, 1.6 + b);
      } },
    baby: { w: 15, h: 12, pal: { B: ["#2f6b3a", "#3f8a48", "#5aa85a", "#86c878", "#b0e09a", "#d0f0bc"], L: ["#b8dca0", "#d4ecc0", "#ecf8dc"], seed: 83, round: 3 },
      draw: function (a, P) {
        var b = bobOf(P, 0.6), br = breathe(P), sw = swayOf(P) * 0.6;
        limb(a, "F", 9, 6.5 + b, 11, 1, 1, gait(P, 0.75), 1.2, 1); limb(a, "F", 5, 6.5 + b, 11, 1, 1, gait(P, 0.5), 1.2, 1);
        a.tube("B", [[3.5, 6 + b], [0.6, 7 + b + sw]], 1.6, 0.6, BODY);
        a.ell("B", 7, 6.5 + b, 4, 2.8 + br * 0.5, 0, BODY); a.ell("B", 11, 3.8 + b * 0.7 + br * 0.4, 3, 2.6, 0, BODY);
        a.ell("L", 7, 8.2 + b, 2.6, 0.9);
        limb(a, "B", 8.5, 8 + b, 11, 1, 1, gait(P, 0.25), 1.3, 1.1); limb(a, "B", 5, 8 + b, 11, 1, 1, gait(P, 0), 1.3, 1.1);
        eye(a, P, 11.6, 2.8 + b * 0.7);
      } },
    baby2: { w: 15, h: 12, pal: { B: ["#1f5a5a", "#2c7a74", "#3f9a8e", "#66bcaa", "#96dcc8", "#c0eee0"], L: ["#b8e0d4", "#d4efe6", "#ecfaf4"], seed: 89, round: 3 } },
    ptero: { w: 38, h: 18, pal: { B: ["#3e2410", "#62391c", "#8a5226", "#b0743a", "#d0965a", "#e8b882"], L: ["#8a5a32", "#a8784a", "#c69a66", "#e0bc88"], A: ["#7a3018", "#a84a24", "#d06a36", "#f08a50"], seed: 97, round: 3 },
      draw: function (a, P) {
        // seen from above, gliding right: membrane wings stretched from the long fourth finger, a Pteranodon crest
        var k2 = 0.5 - 0.5 * Math.cos(P.ph * Math.PI * 2), span = 8.6 - 3.2 * k2, sw = 2 + 2.6 * k2;
        a.poly("L", [[22, 8.2], [17 - sw, 9 - span], [12.5 - sw, 9.6 - span], [12, 8.6]]);
        a.poly("L", [[22, 9.8], [17 - sw, 9 + span], [12.5 - sw, 8.4 + span], [12, 9.4]]);
        a.tube("B", [[22, 8.3], [19 - sw, 9 - span * 0.55], [17 - sw, 9 - span]], 1, 0.5);
        a.tube("B", [[22, 9.7], [19 - sw, 9 + span * 0.55], [17 - sw, 9 + span]], 1, 0.5);
        a.ell("B", 18.5, 9, 5.2, 1.9, 0, BODY);
        a.tube("B", [[23, 9], [27, 9]], 1.7, 1.3, BODY); a.tube("B", [[27, 9], [36, 9]], 1, 0.35, BODY);
        a.poly("A", [[26.5, 7.9], [19.5, 7], [21, 8.6]]);
        a.px("K", 26, 8, 0.8, 0.8); a.px("K", 26, 10, 0.8, 0.8);
      } },
    // pi: a baby kaiju, white and round, pink spikes down its back. it will be Middle Path one day
    pi: { w: 16, h: 14, ds: 1.2, pal: { B: ["#8e8a86", "#b4b0ac", "#d2d0cc", "#e8e7e3", "#f6f5f2", "#ffffff"], A: ["#8a1e4e", "#c02f72", "#f454a6", "#ff9ecb"], L: ["#e0d8cc", "#ece6dc", "#f8f4ec"], H: ["#bdb094", "#f5eedc"], seed: 3, round: 3 },
      draw: function (a, P) {
        var b = bobOf(P, 0.8), br = breathe(P), sw = swayOf(P) * 0.6;
        limb(a, "F", 9, 9 + b, 13, 1.4, 1.4, gait(P, 0.5), 1.5, 1.3);
        a.tube("B", [[4, 9.5 + b], [1.4, 10.4 + b + sw * 0.4], [0.5, 12 + sw * 0.5]], 2, 0.8, BODY);
        a.ell("B", 7.5, 9 + b, 4.4, 3.4 + br * 0.4, 0, BODY);
        a.ell("B", 10.5, 5 + b * 0.8 + br * 0.3, 4.2, 3.8, 0, BODY);
        a.ell("L", 8.5, 10 + b, 2.4, 1.8, 0, BODY);
        [[5.2, 5.6], [7, 3.4], [9, 1.4]].forEach(function (s2, i) { a.poly("A", [[s2[0] - 1.1, s2[1] + 1.4 + b * 0.8], [s2[0] - 0.6 - i * 0.1, s2[1] - 1 + b * 0.8], [s2[0] + 1, s2[1] + 1 + b * 0.8]]); });
        a.tube("B", [[11, 8.5 + b], [12.6, 9.6 + b]], 0.7, 0.6);
        limb(a, "B", 7, 10 + b, 13, 1.4, 1.4, gait(P, 0), 1.6, 1.4);
        eye(a, P, 12, 4.2 + b * 0.8); a.px("A", 13.4, 5.8 + b * 0.8, 0.8, 0.5);
      } },
    // Middle Path, the kaiju pi grows up to be: upright, spiked, a thick tail on the ground, head up
    kaiju: { w: 30, h: 30, ds: 1.3, pal: { B: ["#8e8a86", "#b4b0ac", "#d2d0cc", "#e8e7e3", "#f6f5f2", "#ffffff"], A: ["#8a1e4e", "#c02f72", "#f454a6", "#ff9ecb"], L: ["#e0d8cc", "#ece6dc", "#f8f4ec"], H: ["#bdb094", "#f5eedc"], seed: 7, round: 4.5 },
      draw: function (a, P) {
        var b = bobOf(P, 1), br = breathe(P), sw = swayOf(P) * 0.8, roar = P.mode === "roar";
        tleg(a, "F", 15, 17 + b, 29, 2.4, 2, gait(P, 0.5), 2.6);
        a.tube("B", [[12, 20 + b], [5, 25 + b + sw * 0.3], [0.8, 27.5 + sw * 0.4], [5, 29]], 3.6, 1.2, BODY);
        a.ell("B", 15, 16 + b, 6.4, 8 + br * 0.5, -0.35, BODY);
        a.ell("B", 20.5, 6 + b * 0.6 + (roar ? -1 : 0), 5, 4.4, -0.2, BODY);
        a.poly("B", [[22, 7 + b * 0.6], [28.5, 7.4 + b * 0.6 + (roar ? 1.5 : 0)], [27, 10 + b * 0.6 + (roar ? 2.5 : 0)], [21, 10.4 + b * 0.6]], BODY);
        a.ell("L", 17.5, 18 + b, 3.6, 5.6, -0.35, BODY);
        [[9.5, 20.5, 2], [9.8, 15.5, 2.8], [11.4, 11, 3.2], [14.4, 7, 3], [17.2, 3.4, 2.4], [4.8, 24.8, 1.6]].forEach(function (s2) { a.poly("A", [[s2[0] + 1.6, s2[1] + 1.4], [s2[0] - s2[2] * 0.9, s2[1] - s2[2] * 0.5], [s2[0] + 0.4, s2[1] - s2[2] * 0.8], [s2[0] + 2.2, s2[1] - 0.2]]); });
        a.tube("B", [[19, 14 + b], [22, 16.5 + b], [23.4, 15.2 + b]], 1.2, 0.8);
        tleg(a, "B", 15, 17.5 + b, 29, 2.4, 2, gait(P, 0), 2.8);
        eye(a, P, 22.8, 4.6 + b * 0.6); if (roar) a.poly("K", [[23, 9.8 + b * 0.6], [28, 8.4 + b * 0.6], [27, 11.4 + b * 0.6]]);
      } }
  };
  ART.baby2.draw = ART.baby.draw;
  var FRAMES_OF = { walk: 6, idle: 4, blink: 1, graze: 2, roar: 2, fly: 4 };
  var DART = {};
  function dinoFrame(kind, mode, i) {
    var key = kind + mode + i;
    if (!DART[key]) { var d = ART[kind]; DART[key] = shapeArt(d.w, d.h, d.pal, d.draw, { mode: mode, ph: i / FRAMES_OF[mode] }, d.ds); }
    return DART[key];
  }
  function artScale(kind) { return ART[kind].ds || DS; }
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
    raptor: { art: true, sp: 26, step: 2.3, say: ["a velociraptor. it is definitely not testing the fences.", "a velociraptor. it clicks at the others. they all look at pi."] },
    ankylo: { art: true, sp: 6, step: 1.1, graze: true, say: "an ankylosaurus. armored, unbothered, and swinging that tail at nothing in particular." },
    baby: { art: true, sp: 13, step: 0.8, say: "a baby dino. it squeaks at pi." },
    spino: { art: true, sp: 10, step: 1.9, say: ["a spinosaurus, working the riverbank for fish. the sail catches the light.", "a spinosaurus. its snout is more crocodile than dinosaur. it ignores pi completely, which is somehow worse."] },
    dilo: { art: true, sp: 16, step: 2, say: ["a dilophosaurus. twin crests, and when it calls, a frill you really don't want aimed at you.", "a dilophosaurus. it hoots, and the frill fans out. pi decides that's a no."] },
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
    return { kind: kind, x: tx * T + 8, y: ty * T + 10, area: area, tx: 0, ty: 0, wait: Math.random() * 3, face: Math.random() < 0.5 ? 1 : -1, dist: 0, hop: 0, vy: 0, sleep: 0, roar: 0, cd: 0, graze: 0, seed: Math.random() * 10, call: 3 + Math.random() * 14, fast: 1 };
  }
  var ROARS = { trex: 1, dilo: 1, pachy: 1 };
  var CALLS = { spino: "grunt", dilo: "screech", pachy: "snort", galli: "squeak", compy: "chirp", brachio: "hoot", trex: "grunt", raptor: "screech", trike: "snort", ankylo: "snort", stego: "grunt", para: "honkp", baby: "squeak", baby2: "squeak", robot: "chatter", roomba: "chatter" };
  var HERD = [38, 39, 52, 46], PEN = [49, 18, 56, 24], REXPAD = [16, 32, 24, 39];
  var critters = [
    critter("brachio", 18, 23, [15, 19, 24, 26]), critter("brachio", 21, 21, [15, 19, 24, 26]),
    critter("trex", 20, 35, REXPAD),
    critter("raptor", 50, 20, PEN), critter("raptor", 53, 22, PEN), critter("raptor", 55, 19, PEN),
    critter("stego", 43, 43, HERD), critter("trike", 46, 40, HERD), critter("trike", 40, 45, HERD), critter("ankylo", 49, 44, HERD),
    critter("para", 54, 27, [47, 26, 62, 32]), critter("para", 58, 31, [47, 26, 62, 32]),
    critter("spino", 16, 24, [14, 22, 20, 27]), critter("dilo", 30, 36, [26, 33, 34, 39]),
    critter("pachy", 50, 27, [48, 26, 58, 32]), critter("pachy", 55, 31, [48, 26, 58, 32]),
    critter("galli", 58, 27, [50, 27, 62, 33]), critter("galli", 60, 30, [50, 27, 62, 33]), critter("galli", 56, 32, [50, 27, 62, 33]), critter("galli", 61, 28, [50, 27, 62, 33]),
    critter("compy", 33, 44, [30, 43, 44, 47]), critter("compy", 34, 45, [30, 43, 44, 47]), critter("compy", 32, 46, [30, 43, 44, 47]), critter("compy", 35, 44, [30, 43, 44, 47]), critter("compy", 31, 45, [30, 43, 44, 47]),
    critter("baby", 43, 45, [39, 42, 47, 46]), critter("baby2", 46, 44, [39, 42, 47, 46]), critter("baby", 20, 24, [15, 20, 23, 26]),
    critter("robot", 40, 29, [26, 26, 46, 30]), critter("robot", 28, 29, [16, 28, 34, 30]), critter("roomba", 35, 29, [33, 28, 39, 30]),
    critter("cat", 47, 37, [44, 35, 52, 41]), critter("cat", 50, 40, [44, 35, 52, 41])
  ];
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
    if (c.sleep > 0) { c.sleep -= dt; return; }
    if (c.roar > 0) return;
    c.graze = Math.max(0, c.graze - dt);
    if (!c.tx && d.art && !room && Math.hypot(pi.x - c.x, pi.y - c.y) < 56) c.face = pi.x > c.x ? 1 : -1;     // idle dinos turn to watch pi
    // every creature has a voice, and calls out now and then (heard only if pi is in earshot)
    c.call -= dt;
    if (c.call <= 0) {
      c.call = 9 + Math.random() * 18;
      var cs = CALLS[c.kind];
      if (cs && !room && Math.hypot(pi.x - c.x, pi.y - c.y) < 300) { sfx(cs, c.x, c.y); if (d.art && !c.tx) c.hop = c.hop || (c.kind.indexOf("baby") === 0 ? 1 : 0); }
    }
    var pd0 = room ? 1e9 : Math.hypot(pi.x - c.x, pi.y - c.y);
    // the small and the skittish bolt when pi gets close
    if ((c.kind === "compy" && pd0 < 40) || (c.kind === "galli" && pd0 < 64)) {
      if (!c.flee || !c.tx) { var fa = Math.atan2(c.y - pi.y, c.x - pi.x) + (Math.random() - 0.5) * 0.8; c.tx = c.x + Math.cos(fa) * 60; c.ty = c.y + Math.sin(fa) * 40; c.fast = 1.6; c.flee = 1; if (Math.random() < 0.3) sfx(CALLS[c.kind], c.x, c.y); }
    } else c.flee = 0;
    // the dilophosaurus fans its frill and calls; two pachycephalosaurs butt heads
    if (c.kind === "dilo" && !c.tx && Math.random() < dt * 0.08) { c.roar = 1.4; sfx("screech", c.x, c.y); }
    if (c.kind === "pachy" && !c.tx && c.cd <= 0) {
      var rival2 = critters.filter(function (o) { return o.kind === "pachy" && o !== c && !o.tx; })[0];
      if (rival2 && Math.hypot(rival2.x - c.x, rival2.y - c.y) < 44 && Math.random() < dt * 0.4) {
        c.face = rival2.x > c.x ? 1 : -1; rival2.face = -c.face; c.roar = rival2.roar = 1; c.cd = rival2.cd = 6;
        setTimeout(function () { sfx("hit", c.x, c.y, { vol: 0.7 }); c.hop = rival2.hop = 1; c.vy = rival2.vy = -1.4; }, 450);
      }
    }
    // the t-rex stalks pi along the inside of its fence
    if (c.kind === "trex" && pd0 < 190 && !aboard() && (!c.tx || Math.random() < dt * 1.5)) {
      c.tx = Math.max((c.area[0] + 0.5) * T, Math.min((c.area[2] + 0.5) * T, pi.x)); c.ty = Math.max((c.area[1] + 0.5) * T, Math.min((c.area[3] + 0.5) * T, pi.y)); c.fast = 1.4;
    }
    c.wait -= dt;
    if (c.wait <= 0 && !c.tx) {
      c.fast = 1;
      // raptors dart after each other; herd animals drift together
      if (c.kind === "raptor" && Math.random() < 0.35) { var mate = critters.filter(function (o) { return o.kind === "raptor" && o !== c; })[(Math.random() * 2) | 0]; if (mate) { c.tx = mate.x + (Math.random() - 0.5) * 30; c.ty = mate.y + (Math.random() - 0.5) * 20; c.fast = 1.7; } }
      if (d.graze && Math.random() < 0.4) { var lead = critters.filter(function (o) { return o !== c && o.area === c.area && o.tx; })[0]; if (lead) { c.tx = lead.tx + (Math.random() - 0.5) * 40; c.ty = lead.ty + (Math.random() - 0.5) * 24; } }
      if (c.tx && !okFor(c, Math.floor(c.tx / T), Math.floor(c.ty / T))) c.tx = 0;
    }
    if (c.wait <= 0 && !c.tx) {
      for (var tries = 0; tries < 6; tries++) {
        var tx = c.area[0] + Math.floor(Math.random() * (c.area[2] - c.area[0] + 1)), ty = c.area[1] + Math.floor(Math.random() * (c.area[3] - c.area[1] + 1));
        if (okFor(c, tx, ty)) { c.tx = tx * T + 8; c.ty = ty * T + 10; break; }
      }
      if (!c.tx) c.wait = 1;
    }
    if (c.tx) {
      var dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
      if (dd < 2) {
        c.tx = 0; c.wait = 1 + Math.random() * 4;
        if (d.cat && Math.random() < 0.4) c.sleep = 6 + Math.random() * 10;
        if (d.graze && Math.random() < 0.55) { c.graze = 3 + Math.random() * 5; c.wait = Math.max(c.wait, c.graze); }
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
  function drawCritter(c) {
    var d = DINOS[c.kind];
    if (d.art) {
      var mode = "idle", fr = Math.floor(t * 2.5 + c.seed) % 4;
      if (c.roar > 0 && ROARS[c.kind]) { mode = "roar"; fr = Math.floor(t * 8) % 2; }
      else if (c.tx) { mode = "walk"; fr = Math.floor(c.dist / d.step) % 6; }
      else if (c.graze > 0) { mode = "graze"; fr = Math.floor(t * 3 + c.seed) % 2; }
      else if (hash(Math.floor(t * 3 + c.seed * 7), 3) < 0.07) { mode = "blink"; fr = 0; }
      var art = dinoFrame(c.kind, mode, fr);
      shadow(c.x, c.y, Math.max(8, art.width * 0.55));
      drawArt(art, c.x, c.y + c.hop + (c.roar > 0 ? Math.round(Math.sin(t * 40)) : 0), c.face < 0);
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
  var DOCKPT = [36, dockY - 1], DEPOTPT = [40, 45], VISITPT = [30, 26];
  function tileOf(o) { return [Math.floor(o.x / T), Math.floor(o.y / T)]; }
  var bots = [
    { kind: "cargo", x: DOCKPT[0] * T + 8, y: DOCKPT[1] * T + 10, legs: [DEPOTPT, VISITPT, DEPOTPT, DOCKPT], leg: 0, path: null, carry: true, wait: 1, face: 1, dist: 0 },
    { kind: "cargo", x: DEPOTPT[0] * T + 8, y: DEPOTPT[1] * T + 10, legs: [DOCKPT, DEPOTPT], leg: 0, path: null, carry: false, wait: 4, face: -1, dist: 0 },
    { kind: "welder", x: 50 * T + 8, y: 26 * T + 10, spots: [[50, 26], [53, 26], [58, 22], [47, 21]], spot: 0, path: null, wait: 6, face: -1, dist: 0, work: 0 },
    { kind: "gardener", x: 34 * T + 8, y: 26 * T + 10, path: null, wait: 2, face: 1, dist: 0, work: 0 }
  ];
  var pad = { x: 40.5 * T, y: 44 * T + 6, roof: 30 };
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
  function updateBots(dt) {
    bots.forEach(function (b) {
      if (b.wait > 0) { b.wait -= dt; if (b.kind === "welder" && b.work > 0) { b.work -= dt; weldSparks(b, dt); } if (b.kind === "gardener" && b.work > 0) { b.work -= dt; spraying(b); } return; }
      if (b.kind === "cargo") {
        if (!b.path) { var goal = b.legs[b.leg]; botGo(b, goal); if (!b.path) { b.wait = 2; b.leg = (b.leg + 1) % b.legs.length; } return; }
        if (stepBot(b, dt, 20)) {
          // at the dock it loads a crate; at the depot or the visitor centre it drops one off
          var at0 = b.legs[b.leg];
          b.carry = at0 === DOCKPT || (at0 === DEPOTPT && b.legs.length > 2 && b.leg === 0);
          b.leg = (b.leg + 1) % b.legs.length; b.wait = 1.6 + Math.random();
          if (at0 === DOCKPT) sfx("backup", b.x, b.y); else sfx("chatter", b.x, b.y);
        }
      } else if (b.kind === "welder") {
        if (!b.path) { b.spot = (b.spot + 1) % b.spots.length; botGo(b, b.spots[b.spot]); if (!b.path) b.wait = 3; return; }
        if (stepBot(b, dt, 14)) { b.wait = 8 + Math.random() * 6; b.work = b.wait; b.face = 1; }
      } else if (b.kind === "gardener") {
        if (!b.path) {
          var near2 = props.filter(function (p2) { return (p2.kind === "fern" || p2.kind === "cycad" || p2.kind === "tallgrass") && Math.abs(p2.tx - 33) < 9 && Math.abs(p2.ty - 28) < 8; });
          var pick = near2[(Math.random() * near2.length) | 0];
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
      if (d.state === "rest") { d.z = pad.roof; if ((d.wait -= dt) <= 0) { var dest = OUT[(Math.random() * OUT.length) | 0]; d.tx = dest.x * T + 8; d.ty = dest.y * T + 18; d.state = "up"; d.carry = true; } }
      else if (d.state === "up") { d.z += 18 * dt; if (d.z >= 46) d.state = d.carry ? "out" : "home"; }
      else if (d.state === "out" || d.state === "home") {
        var gx = d.state === "out" ? d.tx : pad.x, gy = d.state === "out" ? d.ty : pad.y, dx = gx - d.x, dy = gy - d.y, dd = Math.hypot(dx, dy);
        if (dd < 3) { d.state = d.state === "out" ? "drop" : "land"; d.wait = 1.4; }
        else { d.x += dx / dd * 46 * dt; d.y += dy / dd * 46 * dt; }
      } else if (d.state === "drop") { d.z = Math.max(16, d.z - 30 * dt); if ((d.wait -= dt) <= 0) { d.carry = false; sparks.push({ x: d.x, y: d.y - 4, vx: 0, vy: -10, life: 0.8, c: "#c89458", box: true }); d.state = "up"; } }
      else if (d.state === "land") { d.z = Math.max(pad.roof, d.z - 18 * dt); if (d.z <= pad.roof) { d.state = "rest"; d.wait = 4 + Math.random() * 6; } }
    });
  }
  function weldSparks(b, dt) {
    if (Math.random() < dt * 30) { var sx = b.x + 9 * b.face, sy = b.y - 6; sparks.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 40, life: 1, c: Math.random() < 0.5 ? "#ffe07a" : "#ffffff" }); light(sx, sy, 14, "255,200,120", 0.9); }
    b.wt = (b.wt || 0) - dt; if (b.wt <= 0) { b.wt = 1 + Math.random() * 0.8; sfx("weld", b.x, b.y); }
  }
  function spraying(b) { if (Math.random() < 0.6) sparks.push({ x: b.x - 6 * b.face, y: b.y - 4, vx: -b.face * (20 + Math.random() * 20), vy: -10 - Math.random() * 10, life: 0.8, c: "#8fc0ff" }); }
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
    gardener: ["a gardener bot. it won't water anything past the old shrine in the northwest woods. it says the stone there hums.", "a gardener bot, watering the ferns. it waters pi a little, by accident, then apologizes.", "a gardener bot. it hums while it works: 'dns healthy, ferns hydrated.'"]
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
    props.filter(function (p) { return /tree/.test(p.kind) && Math.abs(p.tx - 36) < 9 && Math.abs(p.ty - 29) < 8; }).slice(0, 6).forEach(function (p) {
      perches.push({ x: p.tx * T + 8, y: p.ty * T + 16 - SPR[p.kind].height + 4, gy: p.ty * T + 15 });
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
        if (u >= 1) { b.fly = null; b.rest = 4 + Math.random() * 9; }
        return;
      }
      b.rest -= dt;
      // walk right up to them and they scatter
      if (i === 0 && !room && (pi.vx || pi.vy) && Math.hypot(pi.x - b.x, pi.y - b.gy) < 16) { b.rest = 0; sfx("chirp", b.x, b.y); }
      // the leader picks a new perch; the other follows a moment later
      if (b.rest <= 0 && i === 0) {
        var n = (Math.random() * perches.length) | 0; if (n === b.perch) n = (n + 1) % perches.length;
        fly(b, n, 0); fly(birds[1], n, 0.5);
      }
    });
  }
  function fly(b, n, delay) {
    var p = perches[n], off = b.i ? 4 : 0;
    setTimeout(function () {
      b.perch = n;
      b.fly = { t: 0, dur: 1.4 + Math.hypot(p.x - b.x, p.y - b.y) / 160, x0: b.x, y0: b.y, g0: b.gy, x1: p.x + off, y1: p.y, g1: p.gy, arc: 18 + Math.random() * 16 };
    }, delay * 1000);
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
    if (bx === undefined) { bx = (KP.x - KP.rx * 0.72) * T; by = KP.y * T; }
    food = { x: bx, y: by, t: 12, bits: [] };
    for (var i = 0; i < 14; i++) food.bits.push({ x: bx + (Math.random() - 0.5) * 18, y: by + (Math.random() - 0.5) * 8, life: 1 });
    ripples.push({ x: bx, y: by, r: 1, life: 1 });
  }
  function updateKoi(dt) {
    if (food) { food.t -= dt; if (food.t <= 0) food = null; }
    koi.forEach(function (f) {
      f.turn += (Math.random() - 0.5) * dt * 3; f.turn *= 0.97; f.a += f.turn * dt * 2;
      var boost = 1;
      if (food) {
        var want = Math.atan2(food.y - f.y, food.x - f.x), dd = Math.hypot(food.x - f.x, food.y - f.y);
        f.a += Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a)) * Math.min(1, dt * 3);
        boost = dd > 12 ? 2.2 : 0.4;
        if (dd < 8) food.bits.forEach(function (b) { if (b.life > 0 && Math.hypot(b.x - f.x, b.y - f.y) < 5) { b.life = 0; ripples.push({ x: b.x, y: b.y, r: 1, life: 0.7 }); } });
      }
      var nx = f.x + Math.cos(f.a) * f.v * boost * dt, ny = f.y + Math.sin(f.a) * f.v * boost * dt;
      if (pondF((nx + Math.cos(f.a) * f.len) / T, (ny + Math.sin(f.a) * f.len) / T) > 0.86) { f.a += 2.2 + Math.random(); return; }
      f.x = nx; f.y = ny;
      if (Math.random() < dt * 0.08) ripples.push({ x: f.x, y: f.y, r: 1, life: 1 });
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

  /* ════════ the BMW ════════ */
  var CAR = {
    rows: ["..HHBBBBBHH..", ".BBBKKBKKBBB.", "TBBBKKBKKBBBT", "TBNBBMmRBBNBT", "TBBNBWUWBNBBT", ".BBNBUWUBNBB.", ".BBBBWUWBBBB.", ".BBBBBBBBBBB.",
           ".GGGGGGGGGGG.", "XGGGGGGGGGGGX", ".GGGGGGGGGGG.", ".BCCCCCCCCCB.", ".BCcCcCcCcCB.", ".BCCCCCCCCCB.", ".BCcCcCcCcCB.",
           "TGGGGGGGGGGGT", "TGGGGGGGGGGGT", "TBBBBBBBBBBBT", ".BBBBBBBBBBB.", ".KKKKKKKKKKK.", ".RRBBBBBBBRR.", "..EE.....EE.."],
    pal: { B: "#8b9096", N: "#a9aeb3", C: "#161616", c: "#2a2a2a", G: "#34465a", K: "#0b0b0b", E: "#cfd6dc", H: "#fff4c2", R: "#e0231f",
           U: "#1c69d4", W: "#f4f4f4", T: "#0e0e0e", X: "#8b9096", M: "#3fa9f5", m: "#1f3f9e" }
  };
  var car = { x: 44 * T + 8, y: 34 * T + 8, a: Math.PI / 2, v: 0, driving: false, target: null };
  function carClear(x, y, a) {
    var fx = Math.sin(a), fy = -Math.cos(a), rx = Math.cos(a), ry = Math.sin(a);
    return [[9, 4.5], [9, -4.5], [-9, 4.5], [-9, -4.5]].every(function (p) {
      return walkable(Math.floor((x + fx * p[0] + rx * p[1]) / T), Math.floor((y + fy * p[0] + ry * p[1]) / T));
    });
  }
  function updateCar(dt) {
    if (!car.driving) { car.v *= 0.9; return; }
    var thr = (keys.u ? 1 : 0) - (keys.d ? 1 : 0), steer = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    if (car.target && !thr && !steer) {            // tap to drive: steer toward the tap
      var dx = car.target.x - car.x, dy = car.target.y - car.y, dist = Math.hypot(dx, dy);
      if (dist < 10) car.target = null;
      else {
        var want = Math.atan2(dx, -dy), diff = Math.atan2(Math.sin(want - car.a), Math.cos(want - car.a));
        steer = Math.max(-1, Math.min(1, diff * 2)); thr = Math.abs(diff) > 2.2 ? -0.6 : 1;
      }
    }
    if (riftBusy()) thr = -Math.sign(car.v);
    car.v += thr * (thr * car.v < 0 ? 160 : 70) * dt;
    car.v *= Math.pow(0.35, dt); car.v = Math.max(-40, Math.min(120, car.v));
    car.a += steer * dt * 2.4 * Math.max(-1, Math.min(1, car.v / 45));
    var nx = car.x + Math.sin(car.a) * car.v * dt, ny = car.y - Math.cos(car.a) * car.v * dt;
    if (carClear(nx, ny, car.a)) { car.x = nx; car.y = ny; }
    else { car.v *= -0.25; car.target = null; }
    pi.x = car.x; pi.y = car.y;
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
    light(car.x - fx * 11, car.y - fy * 11, 8, "255,59,59", car.driving ? 0.5 : 0.2);
  }
  function toggleCar() {
    if (!car.driving) { car.driving = true; pi.path = null; bubble = { text: "pi:~$ vroom.", t: 1.6 }; return; }
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
  function canLand(x, y) {
    return [[0, 0], [9, 7], [-9, 7], [9, -7], [-9, -7]].every(function (p) { var tx = Math.floor((x + p[0]) / T), ty = Math.floor((y + p[1]) / T); return walkable(tx, ty) || at(tx, ty) === PAD; });
  }
  function toggleHeli() {
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
    if (heli.state === "spool") { heli.spin = Math.min(1, heli.spin + dt / 1.3); if (heli.spin >= 1) heli.state = "lift"; }
    else if (heli.state === "lift") { heli.z += 26 * dt; zoomTo = 0.72; if (heli.z >= 34) heli.state = "flying"; }
    else if (heli.state === "descend") {
      heli.z = Math.max(0, heli.z - 22 * dt); heli.vx *= 0.9; heli.vy *= 0.9;
      if (heli.z <= 0) {
        heli.state = "parked"; zoomTo = 1;
        // pi hops out on whichever side is clear
        for (var dd = 14; dd <= 30; dd += 4) for (var sd = -1; sd <= 1; sd += 2) {
          var px = heli.x + Math.cos(heli.a) * dd * sd, py = heli.y + Math.sin(heli.a) * dd * sd;
          if (walkable(Math.floor(px / T), Math.floor(py / T))) { pi.x = px; pi.y = py; bubble = { text: "pi:~$ touchdown.", t: 1.8 }; return; }
        }
        pi.x = heli.x; pi.y = heli.y + 12; return;
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
    heli.x = Math.max(T * 2, Math.min(MW * T - T * 2, heli.x + heli.vx * dt));
    heli.y = Math.max(T * 2, Math.min(MH * T - T * 2, heli.y + heli.vy * dt));
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
    if (smokeT <= 0) { smokeT = 0.18; smoke.push({ x: VX + (Math.random() - 0.5) * 20, y: VY + 2, r: 3 + Math.random() * 3, life: 1, vx: 4 + Math.random() * 4 }); }
    smoke.forEach(function (s) { s.y -= 11 * dt; s.x += s.vx * dt; s.r += 3.2 * dt; s.life -= dt * 0.16; });
    smoke = smoke.filter(function (s) { return s.life > 0; });
    if (Math.random() < dt * 1.2) embers.push({ x: VX + (Math.random() - 0.5) * 30, y: VY, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, life: 1 });
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
    var c = document.createElement("canvas"); c.width = w; c.height = h;
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
  function drawPteros() {
    pteros.forEach(function (p, i) {
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.alt, 9, 3, 0, 0, 6.283); ctx.fill();
      drawArt(dinoFrame("ptero", "fly", Math.floor(t * 6 + i) % 4), p.x, p.y + 9, p.face < 0);
    });
    if (ptero.on) {
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(ptero.x, ptero.y + 50, 9, 3, 0, 0, 6.283); ctx.fill();
      drawArt(dinoFrame("ptero", "fly", Math.floor(t * 7) % 4), ptero.x, ptero.y + 9, ptero.vx < 0);
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

  /* ════════ the cave terminal ════════
     a shell that runs the park, left logged in inside the volcano. `help` lists the
     everyday commands. the hidden files explain the rest. */
  var term = root.querySelector(".w-term"), tOut = term.querySelector(".w-term-out"), tIn = term.querySelector(".w-term-in"), tPs = term.querySelector(".w-term-ps");
  var termOpen = false, tHist = [], tHi = 0, sudoTries = -1, uptime0 = Date.now();
  var FILES = {
    "readme.txt": "welcome to pi's island.\nthis terminal runs the park: fences, feeding, the helipad, the clock.\nmost of it is harmless. type help.",
    "paddocks.log": "[ ok ] t-rex paddock ...... fence live, 10,000 V\n[ ok ] raptor pen ......... 3 of 3 raptors accounted for\n[warn] raptor pen ......... fence tested at 03:12, 03:47, 04:20. they're learning.\n[ ok ] herd meadow ........ 2 nests, eggs warm",
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
    termOpen = true; keys = {}; pi.path = null; pi.want = null;
    term.hidden = false; tOut.innerHTML = ""; sudoTries = -1; setPrompt();
    print("pi-sh 1.0 on tty1, cave terminal (volcano, level 1)", "dim");
    print("last login: a long time ago, from the helipad", "dim");
    print("type help. esc leaves.", "dim");
    tIn.value = ""; setTimeout(function () { tIn.focus({ preventScroll: true }); }, 30);
  }
  function closeTerm() { termOpen = false; term.hidden = true; tIn.type = "text"; cv.focus({ preventScroll: true }); }
  function setPrompt() { tPs.textContent = sudoTries >= 0 ? "[sudo] password for pi:" : "pi@island:~$"; tIn.type = sudoTries >= 0 ? "password" : "text"; }
  var PLACES = { rack: 1, desk: 1, uplink: 1, tower: 1, lighthouse: 1, macbook: 1, tablet: 1, mailbox: 1, sign: 1, boat: 1, dock: "boat", pond: [53, 38], helipad: [31, 42], heli: [31, 42], gate: [36, 24], plaza: [36, 29], car: [45, 35], paddock: [26, 36], raptors: [47, 21], volcano: [30, 15] };
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
    else { tx = p[0]; ty = p[1]; }
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
       "  census            who lives here", "  found             landmarks found so far", "  goto <place>      go somewhere (goto with no place lists them)", "  time [hour|reset] the island clock, synced to Ammaar's timezone",
       "  feed koi          ring the dinner bell at the pond", "  sound [on|off]    music and sound effects", "  fly | drive       go to the helicopter or the M3", "  history           what you've typed", "  clear             clear the screen", "  exit              log out"].forEach(function (l) { print(l); });
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
    },
    whoami: function () { print("pi. a small white dino, Ammaar's mascot. you hatched here."); },
    neofetch: function () {
      var up = Math.floor((Date.now() - uptime0) / 1000), n = nyNow();
      var art = ["    ▄███▄  ", "    █▀█▀█  ", "   ▄█████  ", "  ▀██████▀ ", "    ▀▀ ▀▀  "];
      var info = ["pi@island", "---------", "os: pi's island (jurassic edition)", "host: Ellicott City, MD (ET)", "uptime: " + Math.floor(up / 60) + "m " + (up % 60) + "s",
                  "residents: " + critters.filter(function (c) { return DINOS[c.kind].art; }).length + " dinos, 3 bots, 2 cats, 2 cockatiels, 20 koi", "landmarks: " + countFound() + "/" + TOTAL + " found", "volcano: warm", "core: " + (rift && rift.winner ? rift.winner : "asleep")];
      info.forEach(function (l, i) { print((art[i] || "           ") + " " + l, i === 0 ? "hi" : ""); });
    },
    census: function () {
      var c = {}; critters.forEach(function (q) { c[q.kind] = (c[q.kind] || 0) + 1; });
      ["  2  brachiosaurus ...... the northwest meadow", "  1  t-rex .............. the paddock (fenced, 10,000 V)", "  3  velociraptors ...... the pen (fenced, and they know it)",
       "  1  stegosaurus, 2 triceratops, 1 ankylosaurus ... the south meadow", "  2  parasaurolophus .... east, by the lighthouse road", "  3  babies ............. near the nests", "  3  pterosaurs ......... circling the volcano",
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
    drive: function () { goto("car"); print("walking you to the M3..."); setTimeout(closeTerm, 350); },
    history: function () { tHist.forEach(function (h, i) { print("  " + (i + 1) + "  " + h); }); },
    clear: function () { tOut.innerHTML = ""; },
    exit: function () { closeTerm(); },
    logout: function () { closeTerm(); },
    pwd: function () { print("/home/pi"); },
    cd: function (args) { print(args[0] ? "cd: this shell only has one room. try ls " + args[0] : "you're already home."); },
    man: function (args) { if (args[0] && CMDS[args[0]]) print(args[0] + ": see help. the manual was eaten by a raptor."); else CMDS.help(); },
    uname: function () { print("pi-sh 1.0 island tty1 jurassic (cave terminal, volcano level 1)"); },
    date: function () { CMDS.time([]); },
    echo: function (args) { print(args.join(" ")); },
    summon: function () { print("summon what? the orbs don't answer to that. maybe the hidden files know."); },
    middlepath: function () { KAIJU_ART.forEach(function (l) { print(l, "hi"); }); },
    evolve: function (args) {
      if (args[0] && args[0] !== "pi") { print("evolve: only pi can evolve. try ./evolve pi"); return; }
      if (pi.kaiju) { print("pi is already MIDDLE PATH. (devolve takes it back.)"); return; }
      var stages = [["  .--.  ", " /    \\ ", " \\____/ ", "   egg  "], ["  ▄███▄  ", "  █▀█▀█  ", " ▄█████  ", "   pi     "], ["   ???    ", "  (    )  ", "   ~~~~   ", "          "]];
      print("evolving pi...", "dim");
      stages.forEach(function (st, n) { setTimeout(function () { st.forEach(function (l) { print("   " + l); }); print("   ↓", "dim"); sfx(n === 2 ? "warp" : "blip"); }, 300 + n * 500); });
      setTimeout(function () {
        KAIJU_ART.forEach(function (l) { print(l, "hi"); });
        print("pi evolved into MIDDLE PATH. (devolve to go back)", "ok");
        pi.kaiju = true; try { sessionStorage.setItem("pi-kaiju", "1"); } catch (e) {}
        sfx("roar", undefined, undefined, { vol: 0.8 });
      }, 1900);
    },
    devolve: function () { if (!pi.kaiju) { print("pi is as small as it gets."); return; } pi.kaiju = false; try { sessionStorage.removeItem("pi-kaiju"); } catch (e) {} print("pi is pi again.", "ok"); },
    sound: function (args) {
      if (!SND) { print("sound: not available in this browser"); return; }
      if ((args[0] === "on") !== SND.on() && (args[0] === "on" || args[0] === "off")) SND.toggle(); else if (!args[0]) SND.toggle();
      startSound(); print("sound " + (SND.on() ? "on" : "off") + ". (m toggles it too)");
    },
    fences: function (args) { print(args[0] === "off" ? "fences: permission denied. and also, no." : "fences: all paddocks live. 10,000 V."); }
  };
  function countFound() { return Object.keys(found).filter(function (id) { return STATIONS.some(function (s) { return s.id === id && s.found; }); }).length; }
  function run(line) {
    if (sudoTries >= 0) {                                        // answering the sudo password prompt
      if (line.trim().toLowerCase() === "eclipse") {
        sudoTries = -1; setPrompt();
        print("access granted.", "ok"); sfx("grant"); print((rift && rift.winner ? "the core stirs. " : "") + "waking the orbs...", "ok");
        setTimeout(function () { closeTerm(); rift = null; startRift(); }, 900);
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
    var parts = line.split(/\s+/), cmd = parts[0].toLowerCase();
    if (CMDS[cmd]) CMDS[cmd](parts.slice(1)); else print(cmd + ": command not found. try help", "err");
  }
  term.querySelector(".w-term-row").addEventListener("submit", function (e) { e.preventDefault(); var v = tIn.value; tIn.value = ""; run(v); });
  tIn.addEventListener("keydown", function (e) {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") sfx("key");
    if (e.key === "Escape") { e.preventDefault(); closeTerm(); return; }
    if (sudoTries >= 0) return;
    if (e.key === "ArrowUp" && tHist.length) { e.preventDefault(); tHi = Math.max(0, tHi - 1); tIn.value = tHist[tHi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); tHi = Math.min(tHist.length, tHi + 1); tIn.value = tHist[tHi] || ""; }
    else if (e.key === "Tab") {                                  // complete a command or a file name
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
      var d = DINOS[c.kind], ht = d.art ? ART[c.kind].h * artScale(c.kind) : d.a.length, reach = d.art ? Math.max(18, ART[c.kind].w * artScale(c.kind) * 0.5) : 18;
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
        : c.sleep > 0 && d.sleepSay ? d.sleepSay : Array.isArray(d.say) ? d.say[(Math.random() * d.say.length) | 0] : d.say;
      say(c.name ? c.name : c.kind === "cat" ? "a himalayan cat" : c.kind === "robot" || c.kind === "roomba" ? "a bot" : "a dinosaur", line, []);
    } else if (v.id === "bird") { sfx("whistle", pi.x, pi.y); say("a cockatiel", "one of Ammaar's two cockatiels. it whistles at pi, then preens.", []); }
    else if (v.id === "pond") {
      // pi tosses a handful of pellets on the water nearest him, and the koi come running
      var best = null, bd = 1e9;
      for (var a2 = 0; a2 < 6.283; a2 += 0.1) { var qx = (KP.x + Math.cos(a2) * KP.rx * 0.8) * T, qy = (KP.y + Math.sin(a2) * KP.ry * 0.75) * T, q = Math.hypot(qx - pi.x, qy - pi.y); if (q < bd) { bd = q; best = [qx, qy]; } }
      feedKoi(best[0], best[1]); sfx("plop", best[0], best[1]); setTimeout(function () { sfx("splash", best[0], best[1]); }, 500);
      say("the koi pond", "Ammaar's koi pond: twenty koi, every one a different variety and size. kohaku, showa, tancho, chagoi, karasu, a big platinum ogon, and the rest. pi tosses in some pellets and they all come running.", []);
    }
    else if (v.id === "nest") say("a nest", "a nest of " + v.ref.eggs + " speckled eggs, still warm. one of them wobbles. pi backs away slowly.", []);
    else if (v.id === "fence") {
      var pd = PADDOCKS.filter(function (q) { return v.fx >= q.x0 && v.fx <= q.x1 && v.fy >= q.y0 && v.fy <= q.y1; })[0];
      say(pd ? pd.name : "a fence", pd && pd.name === "raptor pen" ? "the raptor pen. 10,000 volts. three raptors inside, and all three have stopped to look at pi." : "the t-rex paddock. 10,000 volts. somewhere in there, something very big just stopped moving.", []);
      sfx("zap", v.fx * T + 8, v.fy * T);
      if (pd && pd.name !== "raptor pen" && trex.cd <= 0) roar();
    }
    else if (v.id === "car") { say("the M3", "Ammaar's BMW M3. press e to get in, arrows or wasd to drive, space to honk, e again to park." + (TOUCH ? " on touch: tap where you want to go." : ""), [["get in", "#drive"]]); }
  }

  // the t-rex roars when pi comes close to its fence: the screen shakes, the birds scatter
  function roar() {
    trex.roar = 1.4; trex.cd = 14; trex.tx = 0; trex.face = pi.x > trex.x ? 1 : -1; quake = 4;
    roarTag = { x: trex.x, y: trex.y - ART.trex.h * DS - 4, t: 1.6 };
    sfx("roar", trex.x, trex.y, { vol: 1.4 });
    if (!birds[0].fly) { var n = (birds[0].perch + 3) % perches.length; fly(birds[0], n, 0); fly(birds[1], n, 0.2); }
  }
  var roarTag = null;
  function updateLife(dt) {
    skyT -= dt; if (skyT <= 0) { readSky(); skyT = 30; }
    critters.forEach(function (c) { updateCritter(c, dt); });
    updateBirds(dt); updateKoi(dt); updateCar(dt); updateHeli(dt); updateVolcano(dt); updateBots(dt);
    if (trex.cd <= 0 && !aboard() && !room && pi.x < 27 * T && pi.x > 13 * T && pi.y > 29.5 * T && pi.y < 42 * T && Math.hypot(pi.x - trex.x, pi.y - trex.y) < 150) roar();
    if (roarTag) { roarTag.t -= dt; if (roarTag.t <= 0) roarTag = null; }
  }

  /* ════════ the rift: an easter egg for finding all eight ════════
     the island darkens, five orbs fall out of the sky, and they fight for
     control of the site. the last one standing takes the core, and runs the
     orbs on the page for the rest of the session. walk up to it for a rematch. */
  var ARENA = { x: 36 * T + 8, y: 25 * T + 8 }, OR = 13;         // centre of the fight, orb radius (world px)
  var RIVALS = ["eclipse", "bone", "halo", "fog", "void"];
  var POWER = { eclipse: 1.7, bone: 1.2, halo: 1.1, fog: 0.9, void: 1.0 };
  var rift = null, pendingRift = false, orbCache = {};
  function orbArt(name) {
    if (!orbCache[name] && window.Orb) orbCache[name] = window.Orb(document.createElement("canvas"), { offscreen: { w: 96, h: 96 }, palette: name, layers: [[26, 52, 1, 1], [14, 28, 0.78, 0.45]] });
    return orbCache[name];
  }
  function riftBusy() { return rift && rift.phase !== "reign"; }
  function dust(name) { var p = window.OrbPalettes && window.OrbPalettes[name]; return p ? p.dust : [230, 230, 230]; }
  function burst(x, y, name, n, speed) {
    var c = dust(name);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = speed * (0.3 + Math.random());
      rift.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 10, life: 1, c: c });
    }
  }
  function rival(name, i) {
    var a = i / RIVALS.length * 6.283 - 1.57;
    return { name: name, art: orbArt(name), a: a, x: ARENA.x + Math.cos(a) * 46, y: ARENA.y + Math.sin(a) * 22, z: 300 + i * 50, hp: 2, alive: true, scale: 1, flash: 0, vx: 0, vy: 0 };
  }
  function startRift() {
    closeDialog(); keys = {}; pi.path = null; pi.want = null;
    if (car.driving) toggleCar();
    if (aboard()) { heli.state = "parked"; heli.z = 0; heli.x = HELI.x * T + 8; heli.y = HELI.y * T + 8; zoomTo = 1; }
    if (Math.hypot(pi.x - ARENA.x, pi.y - ARENA.y) > 200) { pi.x = ARENA.x; pi.y = ARENA.y + 70; camF.x = null; }
    if (REDUCED || !window.Orb) { crown("eclipse"); return; }
    rift = { phase: "dim", t: 0, orbs: RIVALS.map(rival), parts: [], shake: 0, dim: 0, next: 0, dash: null, winner: null, ring: 0 };
    bubble = { text: "pi:~$ ...something's waking up.", t: 3.2 };
  }
  function crown(name) {
    if (reality.cur !== "dino") shiftReality("dino", ARENA.x, ARENA.y - 34);
    try { sessionStorage.setItem("orb-palette", name); sessionStorage.setItem("rift-done", name); } catch (e) {}
    if (window.orbs) window.orbs.forEach(function (o) { if (o.palette) o.palette(name); });
    if (!rift) rift = { orbs: [], parts: [], shake: 0, dim: 0, ring: 0 };
    rift.phase = "reign"; rift.winner = name; rift.t = 0;
    var w = rift.orbs.filter(function (o) { return o.name === name; })[0] || (window.Orb ? rival(name, 0) : null);
    if (w) { w.alive = true; w.x = ARENA.x; w.y = ARENA.y; w.z = 34; w.scale = 1.7; rift.orbs = [w]; }
    paintFound();
    coreSay(true);
  }
  function coreSay(fresh) {
    var w = rift.winner, links = [["rematch ↻", "#rematch"]];
    if (w !== "eclipse") links.push(["give eclipse control back", "#eclipse"]);
    say("the core", fresh
      ? "the orbs fought for control of the site. " + w + " won" + (w === "eclipse" ? ", as it usually does" : ", an upset") + ". it runs the orbs on the page for the rest of your visit. walk back up to it any time for a rematch."
      : w + " holds the core. it runs the orbs on the page until you close the tab.", links);
  }
  function updateRift(dt) {
    if (!rift) return;
    rift.t += dt; rift.shake = Math.max(0, rift.shake - dt * 14); rift.ring = Math.max(0, rift.ring - dt * 0.8);
    var alive = rift.orbs.filter(function (o) { return o.alive; });
    if (rift.phase === "dim") {
      rift.dim = Math.min(0.62, rift.t / 1.5 * 0.62); rift.shake = Math.max(rift.shake, 1.2);
      if (rift.t > 1.7) { rift.phase = "fall"; rift.t = 0; }
    } else if (rift.phase === "fall") {
      rift.orbs.forEach(function (o, i) {
        var u = Math.max(0, Math.min(1, (rift.t - i * 0.2) / 0.9)), e = 1 - Math.pow(1 - u, 3);
        var z = 300 + i * 50 + (26 - 300 - i * 50) * e;
        if (o.z > 40 && z <= 40) { rift.shake = 5; burst(o.x, o.y, o.name, 14, 50); sfx("thud", o.x, o.y); }
        o.z = z;
      });
      if (rift.t > 2.3) { rift.phase = "fight"; rift.t = 0; rift.next = 0.5; }
    } else if (rift.phase === "fight") {
      var ring = 20 + alive.length * 6;
      alive.forEach(function (o) {
        o.a += dt * 0.9;
        if (rift.dash && rift.dash.a === o) return;
        var hx = ARENA.x + Math.cos(o.a) * ring, hy = ARENA.y + Math.sin(o.a) * ring * 0.5;
        o.vx *= 0.9; o.vy *= 0.9;
        o.x += (hx - o.x) * 0.06 + o.vx * dt; o.y += (hy - o.y) * 0.06 + o.vy * dt;
        o.z = 26 + Math.sin(rift.t * 3 + o.a * 2) * 3;
      });
      var d = rift.dash;
      if (!d && alive.length > 1 && (rift.next -= dt) <= 0) {
        // stronger orbs pick fights more often; the target is anyone else
        var total = alive.reduce(function (s, o) { return s + POWER[o.name]; }, 0), r = Math.random() * total, att = alive[0];
        for (var i = 0; i < alive.length; i++) { r -= POWER[alive[i].name]; if (r <= 0) { att = alive[i]; break; } }
        var others = alive.filter(function (o) { return o !== att; });
        rift.dash = { a: att, b: others[(Math.random() * others.length) | 0], t: 0, fx: att.x, fy: att.y };
        sfx("dash", att.x, att.y);
      } else if (d) {
        d.t += dt / 0.3;
        var k = Math.min(1, d.t * d.t);
        d.a.x = d.fx + (d.b.x - d.fx) * k; d.a.y = d.fy + (d.b.y - d.fy) * k;
        if (d.t >= 1) {
          var dx = d.b.x - d.fx, dy = d.b.y - d.fy, len = Math.hypot(dx, dy) || 1;
          d.b.hp--; d.b.flash = 1; d.a.flash = 0.6; rift.shake = 9; hitstop = 0.12;
          var ix0 = (d.a.x + d.b.x) / 2, iy0 = (d.a.y + d.b.y) / 2 - 26;
          rift.impacts = rift.impacts || []; rift.impacts.push({ x: ix0, y: iy0, t: 0, dur: 1.1, c1: dust(d.a.name), c2: dust(d.b.name), rot: Math.random() * 6 });
          lens = { x: ix0, y: iy0, t: 0 };
          for (var sp2 = 0; sp2 < 50; sp2++) { var sa = Math.random() * 6.283, sv = 40 + Math.random() * 120; rift.parts.push({ x: ix0, y: iy0 + 26, vx: Math.cos(sa) * sv, vy: Math.sin(sa) * sv * 0.6, life: 1.3, c: sp2 % 2 ? dust(d.a.name) : dust(d.b.name), swirl: 3 }); }
          var others2 = ["dino", "future", "chaos"].filter(function (r2) { return r2 !== reality.cur; });
          shiftReality(others2[(Math.random() * others2.length) | 0], (d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2 - 26);
          d.b.vx = dx / len * 140; d.b.vy = dy / len * 90; d.a.vx = -dx / len * 60; d.a.vy = -dy / len * 40;
          burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, d.a.name, 12, 70); burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, d.b.name, 12, 70);
          if (d.b.hp <= 0) { d.b.alive = false; burst(d.b.x, d.b.y - d.b.z, d.b.name, 70, 110); rift.shake = 10; sfx("burst", d.b.x, d.b.y); hitstop = 0.14; }
          rift.dash = null; rift.next = 0.5 + Math.random() * 0.4;
          if (rift.orbs.filter(function (o) { return o.alive; }).length === 1) { rift.phase = "crowning"; rift.t = 0; }
        }
      }
    } else if (rift.phase === "crowning") {
      var w = alive[0];
      w.x += (ARENA.x - w.x) * 0.06; w.y += (ARENA.y - w.y) * 0.06; w.z += (34 - w.z) * 0.06;
      w.scale = 1 + Math.min(1, rift.t / 1.4) * 0.7;
      rift.dim = Math.max(0.2, rift.dim - dt * 0.2);
      if (rift.t > 0.6 && !rift.ringed) { rift.ringed = true; rift.ring = 1; rift.shake = 7; burst(w.x, w.y - w.z, w.name, 50, 90); sfx("crown"); }
      if (rift.t > 2.2) crown(w.name);
    } else if (rift.phase === "reign") {
      rift.dim = Math.max(0, rift.dim - dt * 0.3);
      var o = rift.orbs[0]; if (o) o.z = 34 + Math.sin(rift.t * 1.6) * 3;
    }
    rift.orbs.forEach(function (o) { o.flash = Math.max(0, o.flash - dt * 2.5); });
    rift.parts.forEach(function (p) {
      if (p.swirl) { var ca = Math.cos(p.swirl * dt), sa2 = Math.sin(p.swirl * dt), vx = p.vx; p.vx = vx * ca - p.vy * sa2; p.vy = vx * sa2 + p.vy * ca; }   // debris spirals like an accretion disc
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt * 1.1;
    });
    (rift.impacts || []).forEach(function (im) { im.t += dt; });
    if (rift.impacts) rift.impacts = rift.impacts.filter(function (im) { return im.t < im.dur; });
    rift.parts = rift.parts.filter(function (p) { return p.life > 0; });
  }
  function drawRift(E) {
    if (!rift) return;
    if (rift.dim > 0) { ctx.fillStyle = "rgba(3,4,10," + rift.dim.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    var list = rift.orbs.filter(function (o) { return o.alive; }).slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) {
      var gx = (o.x - camX) * E, gy = (o.y - camY) * E, rr = OR * E * o.scale;
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(gx, gy, rr * 0.8, rr * 0.25, 0, 0, 6.283); ctx.fill();
    });
    // the aura: a pool of darkness around each orb, dark motes falling into it like matter into a
    // well, and for an instant now and then, a pair of red eyes looking back
    list.forEach(function (o, oi) {
      var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale, rage = rift.dash && rift.dash.a === o ? 1 : 0.4;
      var ag = ctx.createRadialGradient(sx, sy, rr * 0.4, sx, sy, rr * (2.6 + rage));
      ag.addColorStop(0, "rgba(0,0,0,.8)"); ag.addColorStop(0.55, "rgba(" + (o.name === "void" || o.name === "eclipse" ? "40,0,20" : "10,6,20") + ",.4)"); ag.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ag; ctx.fillRect(sx - rr * 4, sy - rr * 4, rr * 8, rr * 8);
      for (var m = 0; m < 16; m++) {
        var ph = (t * (0.35 + (m % 5) * 0.06) + m * 0.137 + oi * 0.3) % 1, ang = m * 2.4 + t * (0.8 + rage) + ph * 3, dd2 = rr * (2.8 - ph * 1.9);
        ctx.fillStyle = "rgba(6,4,12," + (0.9 * Math.sin(ph * Math.PI)).toFixed(2) + ")";
        ctx.fillRect(Math.round(sx + Math.cos(ang) * dd2), Math.round(sy + Math.sin(ang) * dd2 * 0.8), 2, 2);
      }
      if (Math.sin(t * 9 + oi * 2) > 0.94) { ctx.fillStyle = "rgba(208,20,44,.9)"; ctx.fillRect(sx - 3, sy - 1, 2, 1); ctx.fillRect(sx + 2, sy - 1, 2, 1); }
    });
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    list.forEach(function (o) {
      var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale, size = 96 * rr / 31.7;
      o.art.energy(rift.dash && rift.dash.a === o ? 1.3 : 0.25);
      o.art.frame(t + o.a);
      ctx.drawImage(o.art.canvas, sx - size / 2, sy - size / 2, size, size);
      if (o.flash > 0) {
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 1.6);
        g.addColorStop(0, "rgba(255,255,255," + (0.6 * o.flash).toFixed(3) + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(sx - rr * 2, sy - rr * 2, rr * 4, rr * 4);
      }
    });
    // stars colliding: a white-hot core, shockwaves in both orbs' colours, a burst of light spikes
    (rift.impacts || []).forEach(function (im) {
      var ix = (im.x - camX) * E, iy = (im.y - camY) * E, u = im.t / im.dur, e = 1 - Math.pow(1 - u, 3), fade = 1 - u;
      var core = ctx.createRadialGradient(ix, iy, 0, ix, iy, (18 + e * 140) * E / 3);
      core.addColorStop(0, "rgba(255,255,255," + (0.95 * fade).toFixed(3) + ")"); core.addColorStop(0.3, "rgba(" + im.c1.join(",") + "," + (0.6 * fade).toFixed(3) + ")"); core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core; ctx.fillRect(ix - 200 * E, iy - 200 * E, 400 * E, 400 * E);
      for (var k3 = 0; k3 < 3; k3++) {
        var ru = Math.max(0, u - k3 * 0.09), rr3 = (10 + (1 - Math.pow(1 - ru, 2)) * (160 + k3 * 70)) * E / 3;
        if (ru <= 0) continue;
        ctx.strokeStyle = "rgba(" + (k3 % 2 ? im.c2 : im.c1).join(",") + "," + (0.8 * (1 - ru)).toFixed(3) + ")"; ctx.lineWidth = Math.max(1, (4 - k3) * (1 - ru) * 2);
        ctx.beginPath(); ctx.ellipse(ix, iy, rr3, rr3 * 0.62, 0, 0, 6.283); ctx.stroke();
      }
      for (var k4 = 0; k4 < 12; k4++) {
        var ra = im.rot + k4 * Math.PI / 6 + u * 0.4, rl = (k4 % 3 === 0 ? 1 : 0.55) * (30 + e * 260) * E / 3, rw = (k4 % 3 === 0 ? 3.2 : 1.6) * fade;
        ctx.fillStyle = "rgba(255,250,240," + (0.55 * fade).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(ix + Math.cos(ra + 1.57) * rw, iy + Math.sin(ra + 1.57) * rw); ctx.lineTo(ix + Math.cos(ra) * rl, iy + Math.sin(ra) * rl * 0.7); ctx.lineTo(ix + Math.cos(ra - 1.57) * rw, iy + Math.sin(ra - 1.57) * rw); ctx.fill();
      }
    });
    rift.parts.forEach(function (p) {
      ctx.fillStyle = "rgba(" + p.c.join(",") + "," + Math.min(1, p.life).toFixed(3) + ")";
      ctx.fillRect((p.x - camX) * E, (p.y - camY) * E, 2, 2);
    });
    if (rift.ring > 0) {
      var cx0 = (ARENA.x - camX) * E, cy0 = (ARENA.y - 34 - camY) * E, rad = (1 - rift.ring) * 260 + 20;
      ctx.strokeStyle = "rgba(240,236,226," + rift.ring.toFixed(3) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx0, cy0, rad, rad * 0.55, 0, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
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
    var w = src.width, h = src.height, c = document.createElement("canvas"); c.width = w; c.height = h;
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
        var tt = map[y][x], X = x * T, Y = y * T;
        if (!land(tt)) continue;
        g.fillStyle = "rgba(41,216,255,.08)"; g.fillRect(X, Y, T, 1); g.fillRect(X, Y, 1, T);
        if (tt === PATH || tt === BRIDGE) { g.fillStyle = "rgba(255,79,160,.55)"; if ((x + y) % 2) g.fillRect(X + 6, Y + 7, 4, 1); g.fillStyle = "rgba(41,216,255,.35)"; g.fillRect(X, Y, T, 1); continue; }
        var h = hash(x * 5, y * 7);
        if (h < 0.35) { g.fillStyle = "rgba(41,216,255,.45)"; if (h < 0.18) g.fillRect(X, Y + 8, T, 1); else g.fillRect(X + 8, Y, 1, T); g.fillStyle = "#c8fdff"; g.fillRect(X + 7, Y + 7, 2, 2); }
      }
    } else {
      c = document.createElement("canvas"); c.width = ground.width; c.height = ground.height; g = c.getContext("2d");
      g.fillStyle = "#ece8df"; g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 0.35; g.drawImage(duotone(ground, ["#b8b4ab", "#d4d0c7", "#e6e2d8", "#ece8df"], 1.4), 0, 0); g.globalAlpha = 1;
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
  var cars = [];
  function drawFuture(E, VW, VH) {
    // flying traffic in lanes across the view
    if (!cars.length) for (var i = 0; i < 16; i++) cars.push({ lane: i % 8, off: Math.random() * 400, v: (i % 2 ? 1 : -1) * (60 + Math.random() * 60), c: ["#29d8ff", "#ff4fa0", "#ffe07a"][i % 3] });
    cars.forEach(function (cr) {
      var span = VW + 80, x = camX - 40 + ((((cr.off + t * cr.v) % span) + span) % span), y = camY + 20 + cr.lane * (VH - 40) / 8;
      ctx.fillStyle = cr.c; ctx.fillRect(Math.round(x), Math.round(y), 5, 2);
      var tr = ctx.createLinearGradient(x, 0, x - Math.sign(cr.v) * 26, 0); tr.addColorStop(0, cr.c); tr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.6; ctx.fillStyle = tr; ctx.fillRect(Math.min(x, x - Math.sign(cr.v) * 26), Math.round(y), 26, 1); ctx.globalAlpha = 1;
      light(x, y, 10, cr.c === "#29d8ff" ? "41,216,255" : cr.c === "#ff4fa0" ? "255,79,160" : "255,224,122", 0.6);
    });
  }
  var nodes = null;
  function drawChaosNet(E) {
    // a neural net over the ink: nodes, flickering connections, pulses running along them
    if (!nodes) { nodes = []; for (var i = 0; i < 70; i++) { var a = Math.random() * 6.283, d = 30 + Math.random() * 520; nodes.push({ x: ARENA.x + Math.cos(a) * d * 1.3, y: ARENA.y + Math.sin(a) * d * 0.8, r: 1 + Math.random() * 3 }); } nodes.forEach(function (n) { n.to = nodes.slice().sort(function (p2, q2) { return Math.hypot(p2.x - n.x, p2.y - n.y) - Math.hypot(q2.x - n.x, q2.y - n.y); }).slice(1, 4); }); }
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
      for (var i = 0; i < 700; i++) { ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.55)"; ctx.fillRect(Math.random() * W, Math.random() * H, 1 + (Math.random() < 0.1 ? 2 : 0), 1); }
      if (Math.random() < 0.04) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
    }
  }
  // the tear isn't a circle: a jagged, rotating star of a hole, its points flickering
  function tearPath(cx, cy, r, seed) {
    var n = 30; ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = i / n * 6.283 + t * 0.35, k2 = (0.7 + 0.3 * hash(i % n, seed | 0) + 0.12 * Math.sin(a * 5 + t * 7)) * (i % 2 ? 0.78 : 1.18);
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
    reality.wipe = { from: reality.cur, x: x, y: y, r: 0, seed: (Math.random() * 1000) | 0 };
    reality.cur = to; reality.glitch = 0.35;
    sfx("warp");
  }
  function updateReality(dt) {
    if (reality.wipe) { reality.wipe.r += dt * (240 + reality.wipe.r * 2.2); if (reality.wipe.r > 1400) reality.wipe = null; }
    reality.glitch = Math.max(0, reality.glitch - dt);
  }
  function glitchSlices() {
    // tear the frame: shove a few horizontal bands sideways and split the colour channels
    var n = 5 + ((Math.random() * 6) | 0);
    for (var i = 0; i < n; i++) {
      var sy = Math.random() * cv.height, sh = 4 + Math.random() * 40 * dpr, dx = (Math.random() - 0.5) * 60 * dpr;
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
        { kind: "radio", x: 9, y: 3, say: "a shortwave radio. mostly static. once, very faintly, something that sounds like an orb humming." }
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
    room = R; room.id = name;
    pi.x = (spot ? spot[0] : R.door) * T + 8; pi.y = (spot ? spot[1] : R.h - 2) * T + 10; pi.vx = pi.vy = 0; pi.path = null; keys = {};
    fade = 1; sfx("open");
  }
  function exitRoom() {
    var bd = BUILDINGS.filter(function (q) { return q.room === room.id; })[0];
    room = null; fade = 1; sfx("open");
    pi.x = (bd.x0 + bd.w / 2) * T; pi.y = (bd.y0 + bd.h) * T + 10; pi.vx = pi.vy = 0; camF.x = null;
  }
  var fade = 0;
  function roomMove(o, dx, dy) {
    var hw = 4;
    function hit(px, py) { return roomSolid(room, Math.floor(px / T), Math.floor(py / T)); }
    if (dx && !hit(o.x + dx + (dx > 0 ? hw : -hw), o.y - 2) && !hit(o.x + dx + (dx > 0 ? hw : -hw), o.y + 1)) o.x += dx;
    if (dy && !hit(o.x - hw, o.y + dy + (dy > 0 ? 1 : -2)) && !hit(o.x + hw, o.y + dy + (dy > 0 ? 1 : -2))) o.y += dy;
    if (Math.floor(o.y / T) >= room.h - 1 && dy > 0) exitRoom();      // out through the door
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
    var R = room, E = Math.max(2, Math.min(5, Math.floor(Math.min(W / (R.w * T + 40), H / (R.h * T + 60))))) * 1;
    var ox = (W / E - R.w * T) / 2, oy = (H / E - R.h * T) / 2 + 10;
    camX = -ox; camY = -oy;
    ctx.setTransform(E * dpr, 0, 0, E * dpr, ox * E * dpr, oy * E * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#07080a"; ctx.fillRect(-ox, -oy, W / E, H / E);
    lights = []; beamAt = null;
    // floor, then the back wall (two tiles tall), side walls, and the doorway
    for (var ty = 2; ty < R.h; ty++) for (var tx = 0; tx < R.w; tx++) for (var j = 0; j < T; j += 2) for (var i = 0; i < T; i += 2) {
      var X = tx * T + i, Y = ty * T + j, seam = (i === 0 || j === 0) ? -0.18 : 0;
      ctx.fillStyle = tone(0.5 + seam + (hash(X, Y) - 0.5) * 0.25, R.floor, X, Y); ctx.fillRect(X, Y, 2, 2);
    }
    for (ty = 0; ty < 2; ty++) for (tx = 0; tx < R.w; tx++) for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) { X = tx * T + i; Y = ty * T + j; ctx.fillStyle = tone(0.35 + (Y / 32) * 0.4 + (hash(X >> 2, Y >> 2) - 0.5) * 0.15, R.wall, X, Y); ctx.fillRect(X, Y, 2, 2); }
    ctx.fillStyle = R.trim; ctx.fillRect(0, 2 * T - 2, R.w * T, 2);
    ctx.fillStyle = R.wall[0]; ctx.fillRect(0, 0, T * 0.5, R.h * T); ctx.fillRect(R.w * T - T * 0.5, 0, T * 0.5, R.h * T); ctx.fillRect(0, (R.h - 1) * T + 6, R.door * T, 10); ctx.fillRect((R.door + 1) * T, (R.h - 1) * T + 6, (R.w - R.door - 1) * T, 10);
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(R.door * T + 2, (R.h - 1) * T, T - 4, T);
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
    if (nb && nb.ax !== undefined) tag(TOUCH ? "tap" : "E", (nb.ax - camX) * E, (nb.ay - camY) * E - 4 + Math.sin(t * 4) * 2, true);
    tag(R.name, W / 2, oy * E - 14, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 22 - camY) * E, false);
  }

  /* ════════ the other side ════════
     the old shrine in the northwest woods is a door. step through and the world turns on its
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
    function cloudLayer(w, h, seed, tones, n) {
      var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d");
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
    var isle = sprite(170, 150, function (r, g) {
      for (var y = 60; y < 150; y++) { var hw = Math.max(0, (1 - (y - 60) / 90) * 70); for (var x = -hw; x < hw; x++) { g.fillStyle = tone(0.7 - (y - 60) / 90 * 0.5 + (hash(x >> 2, y >> 2) - 0.5) * 0.2 - x / 200, ["#3a3e5a", "#50567a", "#6a7298", "#8a92b4"], x, y); g.fillRect(85 + x, y, 1, 1); } }
      for (x = 15; x < 155; x++) { r(x, 57 + Math.round(Math.sin(x * 0.2) * 1.5), 1, 5, x % 3 ? "#4a9a3a" : "#6ab84a"); }
      g.drawImage(willow(110, 90), 20, -28);
      r(118, 34, 6, 24, "#6a6e84"); r(119, 30, 4, 4, "#8a8ea2");
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
    var sky2 = document.createElement("canvas"); sky2.width = 64; sky2.height = 260; var sg2 = sky2.getContext("2d");
    for (var y = 0; y < 260; y++) for (var x = 0; x < 64; x++) { sg2.fillStyle = tone(0.15 + y / 260 * 0.85, ["#2a4a8a", "#3a6ab0", "#5a9ae0", "#8ac0f4", "#b8dcfa"], x, y); sg2.fillRect(x, y, 1, 1); }
    var hills = document.createElement("canvas"); hills.width = 1400; hills.height = 260; var hg = hills.getContext("2d");
    for (x = 0; x < hills.width; x++) {
      var hy = 118 - 16 * Math.sin(x * 0.006 + 2) - 6 * Math.sin(x * 0.021);
      for (y = Math.floor(hy); y < 260; y++) { hg.fillStyle = tone(0.62 - (y - hy) / 70 * 0.45 + (hash(x >> 1, y >> 1) - 0.5) * 0.12, ["#1f4a2a", "#2c6636", "#3c8440", "#58a44a", "#76c05a"], x, y); hg.fillRect(x, y, 1, 1); }
      if (hash(x, 17) < 0.3) { hg.fillStyle = "#6ab84a"; hg.fillRect(x, Math.floor(hy) - 1 - ((hash(x, 5) * 2) | 0), 1, 2); }
    }
    for (var n = 0; n < 9; n++) { var tx2 = 90 + n * 150 + hash(n, 2) * 40, tt2 = totem[n % 3]; hg.drawImage(tt2, Math.round(tx2), Math.round(118 - 16 * Math.sin(tx2 * 0.006 + 2) - 6 * Math.sin(tx2 * 0.021) - tt2.height + 6)); }
    var grnd = document.createElement("canvas"); grnd.width = SIDEW; grnd.height = 260; var gg = grnd.getContext("2d");
    for (x = 0; x < SIDEW; x++) {
      var g0 = groundY(x);
      for (y = Math.floor(g0); y < 260; y++) { var dd = y - g0; gg.fillStyle = dd < 6 ? tone(0.82 - dd / 6 * 0.35 + (hash(x >> 1, y) - 0.5) * 0.2, ["#3c8a3a", "#5aac46", "#7ccc58", "#a2e070"], x, y) : tone(0.42 - dd / 80 * 0.3 + (hash(x >> 2, y >> 2) - 0.5) * 0.18, ["#140f0a", "#241a12", "#382a1c", "#4e3a26"], x, y); gg.fillRect(x, y, 1, 1); }
      if (hash(x, 3) < 0.45) { gg.fillStyle = hash(x, 4) < 0.5 ? "#5aac46" : "#7ccc58"; gg.fillRect(x, Math.floor(g0) - 1 - ((hash(x, 6) * 3) | 0), 1, 3); }
      if (hash(x >> 2, 7) < 0.03 && x % 4 === 0) { gg.fillStyle = "#f6f0e0"; gg.fillRect(x - 1, Math.floor(g0) - 4, 3, 1); gg.fillRect(x, Math.floor(g0) - 5, 1, 3); gg.fillStyle = "#ffb060"; gg.fillRect(x, Math.floor(g0) - 4, 1, 1); }
    }
    for (var st = 0; st < 8; st++) { var sx3 = 1330 + st * 12, sy3 = Math.round(groundY(sx3)); gg.fillStyle = "#8a8ea2"; gg.fillRect(sx3, sy3, 12, 3); gg.fillStyle = "#5a5e76"; gg.fillRect(sx3, sy3 + 3, 12, 2); }
    return { sky: sky2, hills: hills, ground: grnd, far: cloudLayer(900, 170, 3, ["#a8c8f0", "#c8def6", "#e4f0fc", "#ffffff"], 26), near: cloudLayer(1100, 190, 9, ["#8ab4e8", "#b4d2f4", "#dceafa", "#ffffff"], 18), isle: isle, willow: willow(300, 230), totem: totem, deity: window.Orb ? window.Orb(document.createElement("canvas"), { offscreen: { w: 200, h: 200 }, palette: "void", layers: [[30, 60, 1, 1], [16, 32, 0.8, 0.5]] }) : null };
  }
  function enterSide() {
    closeDialog();
    if (car.driving) toggleCar();
    sideArt = sideArt || buildSideArt();
    side = { x: 60, y: groundY(60), vy: 0, ground: true, face: 1, dist: 0, phase: "walk", t: 0, line: 0, warp: 0 };
    fade = 1; keys = {}; sfx("warp");
    if (SND) SND.music(null);
  }
  function sideTalk() {
    if (side.line >= DEITY_LINES.length) { side.phase = "warp"; side.t = 0; sfx("warp"); return; }
    say("the first orb", DEITY_LINES[side.line++], []);
    sfx("dash");
  }
  function updateSide(dt) {
    side.t += dt;
    if (amb) { amb.aura.set({ vol: 0.12 + Math.max(0, (side.x - 500) / 900) * 0.5, rate: side.phase === "warp" ? 1 : 0.3 }); ["waves", "falls", "rumble", "buzz", "rotor", "engine"].forEach(function (k2) { amb[k2].set({ vol: 0 }); }); }
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
      if (Math.random() < dt * 3) sfx("warp");
      if (side.t > 4.2 && !side.done) { side.done = true; throwOut(); }
    }
  }
  function renderSide() {
    var E = Math.max(2, Math.min(5, Math.floor(Math.min(H / 190, W / 240)))), VW = W / E, VH = H / E;
    var cam = Math.max(0, Math.min(SIDEW - VW, side.x - VW * 0.4)), oy = Math.max(0, VH - 230) * 0.6;
    var shx = (Math.random() - 0.5) * quake, shy = (Math.random() - 0.5) * quake;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#2a4a8a"; ctx.fillRect(0, 0, W, oy * E + 1);
    ctx.setTransform(E * dpr, 0, 0, E * dpr, shx * dpr, (shy + oy * E) * dpr); ctx.imageSmoothingEnabled = false; VH -= oy;
    // the sky, darkening toward the deity
    var dk = Math.max(0, (side.x - 900) / 600), A = sideArt;
    ctx.drawImage(A.sky, 0, 0, VW, 260); ctx.fillStyle = "#b8dcfa"; ctx.fillRect(0, 259, VW, VH);
    if (dk > 0) { ctx.fillStyle = "rgba(20,10,40," + (dk * 0.45).toFixed(3) + ")"; ctx.fillRect(0, 0, VW, VH); }   // the sky darkens as you near it
    function par(img, k, yy) { var off = -((cam * k) % img.width); for (var x = off; x < VW; x += img.width) ctx.drawImage(img, Math.round(x), yy); }
    par(A.far, 0.12, 8); par(A.near, 0.25, 40);
    ctx.drawImage(A.isle, Math.round(260 - cam * 0.35), 14 + Math.round(Math.sin(t * 0.5) * 3));
    ctx.drawImage(A.isle, Math.round(1100 - cam * 0.35), 40 + Math.round(Math.sin(t * 0.4 + 2) * 3));
    par(A.hills, 0.6, 0);
    ctx.drawImage(A.willow, Math.round(1030 - cam * 0.8), Math.round(groundY(1150) - A.willow.height + 18));
    ctx.drawImage(A.ground, -Math.round(cam), 0);
    if (VH > 260) { ctx.fillStyle = "#140f0a"; ctx.fillRect(0, 259, VW, VH); }
    var ax = 1500 - cam, ay = groundY(1500) - 70 + Math.sin(t * 0.9) * 4;
    var halo = ctx.createRadialGradient(ax, ay, 10, ax, ay, 150); halo.addColorStop(0, "rgba(0,0,0,.85)"); halo.addColorStop(0.5, "rgba(20,0,30,.45)"); halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.fillRect(ax - 160, ay - 160, 320, 320);
    for (var ring = 0; ring < 3; ring++) {                                  // rune rings turning around it
      var rr2 = 58 + ring * 16, rot = t * (0.3 - ring * 0.12) * (ring % 2 ? -1 : 1);
      for (var gl = 0; gl < 24; gl++) { var ga = rot + gl / 24 * 6.283; ctx.fillStyle = "rgba(190,160,255," + (0.35 + 0.35 * Math.sin(t * 2 + gl)).toFixed(2) + ")"; ctx.fillRect(Math.round(ax + Math.cos(ga) * rr2), Math.round(ay + Math.sin(ga) * rr2 * 0.35), gl % 3 ? 2 : 3, gl % 4 ? 1 : 2); }
    }
    if (A.deity) { A.deity.energy(side.phase === "warp" ? 1.6 : 0.4); A.deity.frame(t); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(A.deity.canvas, ax - 60, ay - 60, 120, 120); ctx.globalCompositeOperation = "source-over"; }
    var open2 = side.phase === "walk" ? Math.max(0, (side.x - 1100) / 230) : 1;       // an eye opens as you come close
    if (open2 > 0) { ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.ellipse(ax, ay, 16, 7 * Math.min(1, open2), 0, 0, 6.283); ctx.fill(); ctx.fillStyle = "#d0142c"; ctx.beginPath(); ctx.ellipse(ax + Math.max(-6, Math.min(6, (side.x - 1500 + cam - cam) / 60)), ay, 3.5 * open2, 5 * Math.min(1, open2), 0, 0, 6.283); ctx.fill(); }
    // pi (or what pi became), in profile
    var who = pi.kaiju ? "kaiju" : "pi", art = dinoFrame(who, side.ground && (keys.l || keys.r || side.tap) && side.phase === "walk" ? "walk" : "idle", side.ground && (keys.l || keys.r || side.tap) ? Math.floor(side.dist / 3) % 6 : Math.floor(t * 2.5) % 4);
    var px = side.x - cam; ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(Math.round(px - 6), Math.round(groundY(side.x)), 12, 2);
    if (side.face < 0) { ctx.save(); ctx.translate(Math.round(px + art.width / 2), 0); ctx.scale(-1, 1); ctx.drawImage(art, 0, Math.round(side.y - art.height + 2)); ctx.restore(); } else ctx.drawImage(art, Math.round(px - art.width / 2), Math.round(side.y - art.height + 2));
    // dark leaves hanging into the frame
    ctx.fillStyle = "#101a14"; for (var lf = 0; lf < 16; lf++) { var lx = ((lf * 97 - cam * 1.3) % (VW + 80) + VW + 80) % (VW + 80) - 40; ctx.beginPath(); ctx.ellipse(lx, VH - 4 + (lf % 3) * 3, 16, 7, lf, 0, 6.283); ctx.fill(); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (side.phase === "warp") {
      // reality comes apart: the colours invert in flashes, the tear opens from the orb, everything shakes
      var u = side.warp, ex = (ax) * E, ey = (ay + oy) * E;
      if (Math.random() < 0.25 + u * 0.4) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
      ctx.fillStyle = "#000"; tearPath(ex, ey, u * u * Math.max(W, H) * 1.3, 7); ctx.fill();
      ctx.strokeStyle = "rgba(190,160,255,.9)"; ctx.lineWidth = 3; tearPath(ex, ey, u * u * Math.max(W, H) * 1.3, 7); ctx.stroke();
      if (u > 0.85) { ctx.fillStyle = "rgba(255,255,255," + ((u - 0.85) / 0.15).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
      glitchSlices();
    }
    tag("← →  walk   space  jump", W / 2, H - 16, false);
  }
  // thrown out: the island closes without ceremony and the machine reboots
  function throwOut() {
    side = null; closeDialog();
    try { sessionStorage.setItem("deity-met", "1"); } catch (e) {}
    stopSound();
    open = false; cancelAnimationFrame(raf); raf = 0;
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
  function update(dt) {
    if (hitstop > 0) { hitstop -= dt; return; }
    if (side) { updateSide(dt); updateReality(dt); quake = Math.max(0, quake - dt * 8); if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; } return; }             // a beat of freeze on a big hit sells the impact
    updateRift(dt);
    updateReality(dt);
    updateLife(dt);
    updateFootfalls(dt);
    updateSound(dt);
    if (egg) { egg.t += dt; if (egg.t > 2.2) { egg = null; bubble = { text: "pi:~$ fresh hatch. hi.", t: 3 }; } return; }
    var top = (pi.boost > 0 ? 95 : 58) * (keys.run ? 1.6 : 1); pi.boost = Math.max(0, pi.boost - dt);
    var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), onPath = false;
    if (!dlg.hidden) mx = my = 0;
    if (riftBusy() || car.driving || aboard() || termOpen) { mx = my = 0; pi.path = null; pi.vx = pi.vy = 0; }
    if (!mx && !my && pi.path && pi.path.length) {
      var n = pi.path[0], gx = n[0] * T + 8, gy = n[1] * T + 10, ddx = gx - pi.x, ddy = gy - pi.y, dd = Math.hypot(ddx, ddy);
      if (dd < 1.5) { pi.path.shift(); if (!pi.path.length) { pi.path = null; if (pi.want) { var w = pi.want; pi.want = null; interact(w.id === "rex" ? { id: "rex" } : w); } } }
      else { mx = ddx / dd; my = ddy / dd; onPath = true; }
    }
    // ease into a walk and out of it: quick to start, quicker to stop (tapped paths steer exactly)
    if (room && roomTap && !mx && !my) {
      var rdx = roomTap.x - pi.x, rdy = roomTap.y - pi.y, rdd = Math.hypot(rdx, rdy);
      if (rdd < 4 || (roomTap.want && rdd < 20)) { var rw = roomTap.want; roomTap = null; if (rw) interact(rw); } else { mx = rdx / rdd; my = rdy / rdd; }
    }
    var len = Math.hypot(mx, my); if (len) { mx /= len; my /= len; }
    if (onPath) { pi.vx = mx * top; pi.vy = my * top; }
    else {
      var acc = (len ? 520 : 760) * dt, tvx = mx * top, tvy = my * top;
      pi.vx += Math.max(-acc, Math.min(acc, tvx - pi.vx)); pi.vy += Math.max(-acc, Math.min(acc, tvy - pi.vy));
    }
    if (Math.abs(pi.vx) < 0.5 && Math.abs(pi.vy) < 0.5 && !len) { pi.vx = pi.vy = 0; }
    if (pi.vx || pi.vy) {
      var ox = pi.x, oy = pi.y;
      if (room) roomMove(pi, pi.vx * dt, pi.vy * dt); else move(pi, pi.vx * dt, pi.vy * dt);
      var moved = Math.hypot(pi.x - ox, pi.y - oy);
      if (moved < 0.01 && !len) pi.vx = pi.vy = 0;
      pi.dist += moved;
      if (Math.abs(pi.vx) > 6) pi.face = pi.vx > 0 ? 1 : -1;
      if (len) pi.dir = my < -0.5 ? "up" : "down";
      if (pi.path && moved < 0.01) pi.path = null;   // stuck: give up
      footfall(moved);
    }
    // rex wanders the meadow
    rex.wait -= dt;
    if (rex.wait <= 0 && !rex.tx) {
      var tx = 27 + Math.floor(Math.random() * 7), ty = 31 + Math.floor(Math.random() * 6);
      if (walkable(tx, ty)) { rex.tx = tx * T + 8; rex.ty = ty * T + 10; }
    }
    if (rex.tx) {
      var rx = rex.tx - rex.x, ry = rex.ty - rex.y, rd = Math.hypot(rx, ry);
      if (rd < 2) { rex.tx = 0; rex.wait = 1 + Math.random() * 3; }
      else { var bx = rex.x, by = rex.y; move(rex, rx / rd * 22 * dt, ry / rd * 22 * dt); rex.dist += 22 * dt; rex.face = rx > 0 ? 1 : -1; if (Math.hypot(rex.x - bx, rex.y - by) < 0.01) { rex.tx = 0; rex.wait = 1; } }
    }
    if (rex.hop) { rex.vy += 9 * dt; rex.hop += rex.vy; if (rex.hop >= 0) { rex.hop = 0; rex.vy = 0; } }
    // pterodactyl fly-bys
    ptero.next -= dt;
    if (!ptero.on && ptero.next <= 0) { ptero.on = true; ptero.vx = Math.random() < 0.5 ? 38 : -38; ptero.x = ptero.vx > 0 ? camX - 30 : camX + W / (S * zoom) + 30; ptero.y = camY + 20 + Math.random() * (H / (S * zoom) - 60); }
    if (ptero.on) { ptero.x += ptero.vx * dt; ptero.y -= 4 * dt; if (ptero.x < camX - 60 || ptero.x > camX + W / (S * zoom) + 60) { ptero.on = false; ptero.next = 6 + Math.random() * 8; } }
    clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > MW * T + c.w) c.x = -c.w; });
    if (bubble) { bubble.t -= dt; if (bubble.t <= 0) bubble = null; }
  }

  /* ════════ footfalls: a sound per step, dust on dry ground, prints in the sand, ferns that rustle ════════ */
  var puffs = [], prints = [], rustling = [];
  var ferns = {}; props.forEach(function (p) { if (p.kind === "fern" || p.kind === "cycad" || p.kind === "tallgrass") ferns[k(p.tx, p.ty)] = p; });

  /* ════════ buildings and the waterfall ════════ */
  function drawBuilding(bd) {
    var sp = SPR[bd.id], bx = Math.round((bd.x0 + bd.w / 2) * T - sp.width / 2), by = (bd.y0 + bd.h) * T - sp.height + 2;
    var behind = pi.y < (bd.y0 + bd.h) * T - 2 && pi.y > by + 4 && pi.x > bx && pi.x < bx + sp.width;
    if (behind) ctx.globalAlpha = 0.45;
    ctx.drawImage(skin(sp), bx, by);
    ctx.globalAlpha = 1;
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
  var WF = { x: 24.5 * T, y: 16.6 * T };
  function drawWaterfall() {
    // a white ribbon off the plateau edge with streaks falling through it, and spray at the foot
    var x0 = Math.round(WF.x - 9), y0 = Math.round(WF.y), hgt = 22;
    for (var i = 0; i < 18; i++) for (var j = 0; j < hgt; j += 2) {
      var v = 0.55 + 0.35 * Math.sin(j * 0.9 - t * 12 + i * 1.7) + (hash(i, j) - 0.5) * 0.2;
      ctx.fillStyle = tone(v, ["#3f8e98", "#6fb6c0", "#a8dde2", "#e8fbff"], x0 + i, y0 + j); ctx.fillRect(x0 + i, y0 + j, 1, 2);
    }
    ctx.fillStyle = "rgba(240,252,255,.8)";
    for (i = 0; i < 9; i++) { var a3 = t * 3 + i * 0.7, rr = (t * 9 + i * 3) % 7; ctx.fillRect(Math.round(WF.x - 9 + i * 2 + Math.sin(a3) * 2), Math.round(y0 + hgt - rr * 0.5 + 1), 2, 1); }
    light(WF.x, y0 + hgt, 20, "200,240,255", 0.35);
  }
  function footfall(moved) {
    pi.stepAcc += moved;
    var stride = keys.run ? 9 : 7;
    if (pi.stepAcc < stride) return;
    pi.stepAcc = 0;
    var tx = Math.floor(pi.x / T), ty = Math.floor((pi.y - 2) / T), tt = at(tx, ty), side = (pi.dist / stride | 0) % 2 ? 2 : -2;
    if (room) { sfx("step", undefined, undefined, { surface: room.id === "visitor" ? "dock" : "gravel", vol: 0.7 }); return; }
    sfx("step", undefined, undefined, { surface: tt === DOCK ? "dock" : tt === GRASS ? "grass" : "gravel", vol: keys.run ? 1.2 : 0.8 });
    if (pi.kaiju) { sfx("stomp", undefined, undefined, { vol: 0.5 }); quake = Math.max(quake, 0.5); }     // middle path is heavier than pi
    if (tt === PATH || tt === SAND || tt === PAD || keys.run) {
      for (var i = 0; i < (keys.run ? 3 : 1); i++) puffs.push({ x: pi.x + side + (Math.random() - 0.5) * 3, y: pi.y, vx: -pi.vx * 0.08 + (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 4, life: 1, c: tt === GRASS ? "150,190,110" : tt === SAND ? "230,214,170" : "200,170,120" });
    }
    if (tt === SAND) { prints.push({ x: Math.round(pi.x + side), y: Math.round(pi.y), life: 1 }); if (prints.length > 60) prints.shift(); }
    var fp = ferns[k(tx, Math.floor(pi.y / T))];
    if (fp) { fp.rustle = 1; if (rustling.indexOf(fp) < 0) rustling.push(fp); sfx("rustle", pi.x, pi.y); puffs.push({ x: pi.x, y: pi.y - 8, vx: (Math.random() - 0.5) * 16, vy: -8, life: 1.2, c: "70,140,70", leaf: true }); }
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
  }
  function drawDust() {
    puffs.forEach(function (d) { ctx.fillStyle = "rgba(" + d.c + "," + Math.min(1, d.life * (d.leaf ? 1 : 0.6)).toFixed(3) + ")"; ctx.fillRect(Math.round(d.x), Math.round(d.y), d.leaf ? 2 : 1, d.leaf ? 1 : 1); });
  }

  /* ════════ the minimap: bottom right, click it to fold it away ════════ */
  var mini = document.createElement("canvas"), MINI = 2, mapOn = true, mapRect = null;
  mini.width = MW * MINI; mini.height = MH * MINI;
  (function () { var g = mini.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(ground, 0, 0, mini.width, mini.height); g.drawImage(volc.canvas, (volc.ox) / T * MINI, (volc.oy) / T * MINI, volc.canvas.width / T * MINI, volc.canvas.height / T * MINI); })();
  function drawMinimap() {
    if (W < 760) { mapRect = null; return; }
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
      var tt = map[ty][tx];
      if (!wet(tt) || REAL === "chaos") continue;
      if (tt === POND && pondF(tx + 0.5, ty + 0.5) > 0.9) continue;
      var ph = hash(tx, ty), cyc = Math.floor(t * 0.9 + ph * 7);
      if (hash(tx * 3 + cyc, ty) < 0.16) { ctx.fillStyle = tt === DEEP ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.35)"; ctx.fillRect(tx * T + ((hash(cyc, tx) * 11) | 0), ty * T + ((hash(ty, cyc) * 14) | 0), 4, 1); }
      if (tt === RIVER) {                                    // the current: light streaks sliding downstream
        for (var q2 = 0; q2 < 2; q2++) {
          var fl = ((t * 14 + hash(tx, ty * 3 + q2) * 40) % 20) - 2;
          ctx.fillStyle = "rgba(220,245,255,.35)"; ctx.fillRect(tx * T + 12 - fl * 0.6 + q2 * 3, ty * T + fl * 0.8, 3, 1);
        }
        continue;
      }
      if (tt !== POND) {
        var tide = Math.sin(t * 1.6 + tx * 0.5 + ty * 0.3) * 1.5 + 1.5;
        ctx.fillStyle = "rgba(240,250,255,.7)";
        if (land(at(tx, ty - 1)) || at(tx, ty - 1) === DOCK) for (var s = 0; s < T; s += 3) if (hash(tx * 16 + s, ty) < 0.7) ctx.fillRect(tx * T + s, ty * T + (tide | 0), 2, 1);
        if (land(at(tx, ty + 1))) for (s = 0; s < T; s += 3) if (hash(tx * 16 + s, ty + 3) < 0.7) ctx.fillRect(tx * T + s, ty * T + T - 1 - (tide | 0), 2, 1);
        if (land(at(tx - 1, ty))) for (s = 0; s < T; s += 3) if (hash(tx, ty * 16 + s) < 0.7) ctx.fillRect(tx * T + (tide | 0), ty * T + s, 1, 2);
        if (land(at(tx + 1, ty))) for (s = 0; s < T; s += 3) if (hash(tx + 5, ty * 16 + s) < 0.7) ctx.fillRect(tx * T + T - 1 - (tide | 0), ty * T + s, 1, 2);
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
        if (p.kind === "nest") {
          ctx.drawImage(s, bx - 10, by - 10);
          for (var e = 0; e < p.eggs; e++) {                 // speckled teal eggs; one of them wobbles
            var ex = bx - 5 + e * 4, wob = e === 1 && Math.sin(t * 9) > 0.6 ? 1 : 0;
            ctx.fillStyle = "#1a2a26"; ctx.fillRect(ex - 1 + wob, by - 11, 5, 6); ctx.fillStyle = "#7cc4b2"; ctx.fillRect(ex + wob, by - 10, 3, 5); ctx.fillStyle = "#b4e6d8"; ctx.fillRect(ex + wob, by - 10, 1, 2); ctx.fillStyle = "#3f7a6c"; ctx.fillRect(ex + 2 + wob, by - 8, 1, 1); ctx.fillRect(ex + 1 + wob, by - 7, 1, 1);
          }
          return;
        }
        bx += p.ox || 0; by += p.oy || 0;
        if (p.kind === "lamp" || p.kind === "crates") shadow(bx, by, p.kind === "lamp" ? 6 : 14);
        if (p.kind === "rock") { ctx.drawImage(s, bx - 9, by - 11 + Math.round(Math.sin(t + p.tx) * 0.5)); return; }
        var sway = (p.kind === "palm" || p.kind === "tfern") && !REDUCED ? Math.round(Math.sin(t * 1.2 + p.tx) * 0.6) : 0;
        if (p.kind === "tallgrass" && !REDUCED) sway = Math.round(Math.sin(t * 1.8 + p.tx * 0.7 + p.ty * 0.3) * 0.8);   // wind rolls across the field
        if (p.rustle) sway = Math.round(Math.sin(t * 34) * p.rustle * 1.6);
        if (REAL === "future" && /tree|tfern/.test(p.kind)) { var tw = towers()[(hash(p.tx, p.ty) * 6) | 0]; ctx.drawImage(tw, bx - tw.width / 2, by - tw.height + 2); light(bx, by - tw.height * 0.6, 18, hash(p.ty, p.tx) < 0.5 ? "255,79,160" : "41,216,255", 0.5); return; }
        s = skin(s);
        var behind = /tree|palm|tfern|mast|tank/.test(p.kind) && pi.y < by - 3 && pi.y > by - s.height + 6 && Math.abs(pi.x - bx) < s.width / 2 - 2;
        if (behind) ctx.globalAlpha = 0.42;                      // pi walks behind it: see through
        if (p.flip) { ctx.save(); ctx.translate(bx * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(s, bx - s.width / 2 + sway, by - s.height + 2);
        if (p.flip) ctx.restore();
        ctx.globalAlpha = 1;
        if (p.kind === "lamp") light(bx, by - 14, 34, "255,210,140", 0.95);
        if (p.kind === "campfire") {
          for (var f2 = 0; f2 < 8; f2++) { var fl2 = Math.sin(t * 13 + f2 * 1.9), w5 = Math.max(1, 6 - f2 * 0.8 + fl2); ctx.fillStyle = f2 < 2 ? "#ffe07a" : f2 < 5 ? "#ff9a30" : "#e85414"; ctx.fillRect(Math.round(bx - w5 / 2 + fl2 * 0.6), by - 9 - f2, Math.round(w5), 1); }
          light(bx, by - 10, 46, "255,150,60", 1);
          if (Math.random() < 0.3) puffs.push({ x: bx + (Math.random() - 0.5) * 3, y: by - 16, vx: (Math.random() - 0.5) * 4, vy: -10, life: 1, c: "120,110,100" });
        }
        if (p.kind === "mast" && Math.floor(t * 1.2) % 2) { ctx.fillStyle = "#ff5252"; ctx.fillRect(bx, by - s.height + 3, 2, 1); light(bx, by - s.height + 3, 10, "255,82,82", 0.9); }
        if (p.kind === "generator" && Math.random() < 0.25) puffs.push({ x: bx + 6, y: by - 16, vx: 2, vy: -8, life: 0.8, c: "80,80,80" });
      } });
    });
    OUT.forEach(function (s) { list.push({ y: s.y * T + 15, f: function () { drawStation(s); } }); });
    BUILDINGS.forEach(function (bd) { list.push({ y: (bd.y0 + bd.h) * T - 2, f: function () { drawBuilding(bd); } }); });
    list.push({ y: WF.y + 30, f: drawWaterfall });
    list.push({ y: rex.y, f: function () {
      shadow(rex.x, rex.y, 10);
      drawFrame(DINO[Math.floor(rex.dist / 5) % 2 ? "b" : "a"], { W: "#ececec", K: "#141414" }, 11, rex.x, rex.y - 1 + rex.hop, rex.face < 0);
    } });
    list.push({ y: pi.y, f: drawPi });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // above it all: dust and leaves, volcano smoke, the helicopter in flight, pterosaurs, drifting cloud shadows
    drawDust();
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
  function render() {
    if (side) { renderSide(); drawFade(); return; }
    if (room) { renderRoom(); drawFade(); return; }
    zoom += (zoomTo - zoom) * 0.08;
    var E = S * zoom, VW = W / E, VH = H / E;
    // the camera follows pi, except while the orbs fight: then it watches the arena
    // lead the camera a little in the direction of travel so you see where you're going
    var lvx = car.driving ? Math.sin(car.a) * car.v * 0.3 : aboard() ? heli.vx * 0.3 : pi.vx * 0.22, lvy = car.driving ? -Math.cos(car.a) * car.v * 0.3 : aboard() ? heli.vy * 0.3 : pi.vy * 0.22;
    var lk = car.driving || aboard() ? 30 : 14;
    look.x += (Math.max(-lk, Math.min(lk, lvx)) - look.x) * 0.03; look.y += (Math.max(-lk * 0.6, Math.min(lk * 0.6, lvy)) - look.y) * 0.03;
    var fx = riftBusy() ? ARENA.x : pi.x + look.x, fy = riftBusy() ? ARENA.y - 20 : pi.y + look.y;
    if (camF.x === null) { camF.x = fx; camF.y = fy; }
    camF.x += (fx - camF.x) * 0.06; camF.y += (fy - camF.y) * 0.06;
    var sh = (rift ? rift.shake : 0) + quake;
    camX = Math.max(0, Math.min(MW * T - VW, camF.x - VW / 2)) + (Math.random() - 0.5) * sh;
    camY = Math.max(0, Math.min(MH * T - VH, camF.y - VH / 2)) + (Math.random() - 0.5) * sh;
    camX = Math.round(camX * E) / E; camY = Math.round(camY * E) / E;
    if (reality.wipe) {
      REAL = reality.wipe.from; drawWorld(E, VW, VH);
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wsx = (reality.wipe.x - camX) * E, wsy = (reality.wipe.y - camY) * E, wr = reality.wipe.r * E / 2;
      tearPath(wsx, wsy, wr, reality.wipe.seed); ctx.clip();
      REAL = reality.cur; drawWorld(E, VW, VH);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = reality.cur === "chaos" ? "rgba(0,0,0,.9)" : reality.cur === "future" ? "rgba(41,216,255,.9)" : "rgba(240,236,226,.9)"; ctx.lineWidth = 3;
      tearPath(wsx, wsy, wr, reality.wipe.seed); ctx.stroke();
      ctx.strokeStyle = "rgba(255,79,160,.6)"; ctx.lineWidth = 1; tearPath(wsx + 3, wsy, wr + 5, reality.wipe.seed + 1); ctx.stroke();
    } else { REAL = reality.cur; drawWorld(E, VW, VH); }

    // screen-space overlays: the rift, then prompts and speech
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(E);
    drawLens(E);
    drawRift(E);
    if (reality.glitch > 0 && !REDUCED) glitchSlices();
    var nb = !egg && dlg.hidden ? nearby() : null;
    if (nb && nb.ax !== undefined) tag(TOUCH ? "tap" : "E", (nb.ax - camX) * E, (nb.ay - camY) * E - 4 + Math.sin(t * 4) * 2, true);
    else if (nb) {
      // float the prompt just above the landmark's own sprite
      var topY = nb.id === "rex" ? rex.y - 15 : nb.id === "core" ? ARENA.y - 34 - OR * 1.9 : nb.id === "boat" ? nb.y * T : nb.y * T + 16 - SPR[nb.id].height;
      var sx = ((nb.id === "rex" ? rex.x : nb.id === "core" ? ARENA.x : nb.x * T + 8) - camX) * E, sy = (topY - camY) * E - 6 + Math.sin(t * 4) * 2;
      tag(TOUCH ? "tap" : "E", sx, sy, true);
    }
    drawMinimap();
    if (roarTag) tag("ROAR", (roarTag.x - camX) * E, (roarTag.y - camY) * E, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 16 - (aboard() ? heli.z + 10 : 0) - camY) * E - 6, false);
    drawFade();
  }
  function drawFade() { if (fade > 0) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "rgba(0,0,0," + fade.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); fade = Math.max(0, fade - 0.06); } }
  function tag(text, sx, sy, key) {
    ctx.font = (key ? "700 12px " : "400 12px ") + "'Cascadia Mono', monospace";
    var w = ctx.measureText(text).width + (key ? 12 : 16), h = key ? 20 : 24;
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 2; ctx.strokeRect(sx - w / 2, sy - h, w, h);
    ctx.fillStyle = "#f4f4f4"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, sx, sy - h / 2 + 1);
  }

  function drawPi() {
    if (egg) {
      var e = egg.t, cx = SPAWN.x, cy = SPAWN.y, rock = e < 1.6 ? Math.sin(e * (6 + e * 10)) * Math.min(2, e * 1.5) : 0;
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
        drawArt(dinoFrame("pi", "idle", 0), cx, Math.round(cy - Math.sin(u * 3.14) * 6), false);
      }
      return;
    }
    if (car.driving || aboard()) return;
    var who = pi.kaiju ? "kaiju" : "pi";
    shadow(pi.x, pi.y, pi.kaiju ? 18 : 12);
    var moving = (Math.abs(pi.vx) + Math.abs(pi.vy) > 4) && dlg.hidden;
    var fr = moving ? Math.floor(pi.dist / (pi.kaiju ? 3.2 : 2.2)) % 6 : Math.floor(t * 2.5) % 4;
    var art = dinoFrame(who, moving ? "walk" : hash(Math.floor(t * 3), 9) < 0.06 ? "blink" : "idle", moving ? fr : hash(Math.floor(t * 3), 9) < 0.06 ? 0 : fr);
    drawArt(art, pi.x, pi.y + 1, pi.face < 0);
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
      var gl = 0.35 + 0.35 * Math.sin(t * 1.3);
      ctx.fillStyle = "rgba(160,120,255," + gl.toFixed(2) + ")"; ctx.fillRect(sx1 + 11, sy1 + 15, 2, 2);
      light(bx, sy1 + 16, 26, "160,120,255", 0.8);
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

  function loop(now) {
    raf = 0;
    if (!open) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
    update(dt); render();
    raf = requestAnimationFrame(loop);
  }

  /* ════════ the warp: orb → island and back ════════ */
  var streaks = [];
  function warpRun(dir, done) {
    if (REDUCED) { done(); return; }
    var c = window.orbs && window.orbs[0] ? window.orbs[0].center() : [innerWidth / 2, innerHeight / 2, 100];
    warp.hidden = false;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    warp.width = innerWidth * d; warp.height = innerHeight * d;
    streaks = [];
    for (var i = 0; i < 260; i++) streaks.push({ a: Math.random() * 6.283, r: Math.random() * 40, v: 0.5 + Math.random(), c: Math.random() });
    var start = performance.now(), dur = dir > 0 ? 1000 : 650, far = Math.hypot(innerWidth, innerHeight);
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
      if (dir > 0 && p > 0.75) { wctx.fillStyle = "rgba(240,232,255," + ((p - 0.75) * 4 * 0.9).toFixed(3) + ")"; wctx.fillRect(0, 0, innerWidth, innerHeight); }
      wctx.globalCompositeOperation = "source-over";
      if (p < 1) requestAnimationFrame(frame); else done();
    })(start);
  }
  function hideWarp() {
    if (REDUCED) { warp.hidden = true; return; }
    warp.style.transition = "opacity .5s ease"; warp.style.opacity = "0";
    setTimeout(function () { warp.hidden = true; warp.style.opacity = ""; warp.style.transition = ""; }, 520);
  }

  var lastFocus = null;
  var entering = false;
  function enter() {
    if (open || entering) return;
    entering = true;
    lastFocus = document.activeElement;
    if (window.orbs && window.orbs[0]) window.orbs[0].boost();
    startSound(); sfx("whoosh");
    warpRun(1, function () {
      open = true; entering = false; size();
      document.documentElement.classList.add("in-world");
      root.hidden = false; root.classList.add("show");
      var first = false;
      try { first = sessionStorage.getItem("pi-hatched") !== "1"; sessionStorage.setItem("pi-hatched", "1"); } catch (e) {}
      egg = first && !REDUCED ? { t: 0 } : null;
      pi.x = SPAWN.x; pi.y = SPAWN.y; pi.vx = pi.vy = 0; pi.path = null; keys = {};
      zoom = REDUCED ? 1 : 2.6; zoomTo = 1;
      if (!first) bubble = { text: "pi:~$ welcome back.", t: 2.5 };
      camF.x = null;
      var ruler = null; try { ruler = sessionStorage.getItem("rift-done"); } catch (e) {}
      if (ruler && !rift && window.Orb) { rift = { phase: "reign", winner: ruler, t: 0, orbs: [rival(ruler, 0)], parts: [], shake: 0, dim: 0, ring: 0 }; var w0 = rift.orbs[0]; w0.x = ARENA.x; w0.y = ARENA.y; w0.z = 34; w0.scale = 1.7; paintFound(); }
      else if (!ruler && !rift && Object.keys(found).length === TOTAL) setTimeout(function () { if (open && !rift) startRift(); }, first ? 3000 : 1200);
      last = performance.now(); raf = requestAnimationFrame(loop);
      cv.focus({ preventScroll: true });
      hideWarp();
      if (window.orbs) window.orbs.forEach(function (o) { o.pause(true); });
      if (history.replaceState) history.replaceState(null, "", "#island");
    });
  }
  function exit(then) {
    if (!open) return;
    closeDialog(); if (termOpen) closeTerm();
    if (car.driving) toggleCar();
    if (aboard()) { heli.state = "parked"; heli.z = 0; heli.spin = 0; heli.x = HELI.x * T + 8; heli.y = HELI.y * T + 8; heli.a = 0; zoomTo = 1; }
    sfx("whoosh", undefined, undefined, { out: true }); stopSound();
    var finish = function () {
      open = false; cancelAnimationFrame(raf); raf = 0;
      root.classList.remove("show"); root.hidden = true;
      document.documentElement.classList.remove("in-world");
      if (window.orbs) window.orbs.forEach(function (o) { o.pause(false); o.calm(); });
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      hideWarp();
      if (then) { var el = document.querySelector(then); if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); }
      else if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    if (REDUCED) { finish(); return; }
    root.classList.remove("show");
    warpRun(-1, finish);
  }

  orbBtn.addEventListener("click", enter);
  window.islandEnter = enter;
  root.querySelector(".w-exit").addEventListener("click", function () { exit(); });
  window.addEventListener("resize", function () { if (open) size(); });
})();
