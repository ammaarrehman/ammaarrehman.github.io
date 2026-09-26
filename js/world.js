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
  var dlg = root.querySelector(".w-dialog"), dName = dlg.querySelector(".w-name"), dText = dlg.querySelector(".w-text"), dLinks = dlg.querySelector(".w-links"), dSr = dlg.querySelector("#w-sr");
  var liveEl = document.getElementById("w-live");
  // polite announcements for screen readers: landmarks nearby, logs found. never movement
  function announce(msg) { if (!liveEl) return; liveEl.textContent = ""; setTimeout(function () { liveEl.textContent = msg; }, 30); }
  var foundEl = root.querySelector(".w-found");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  // ?debug=1 shows a readout of the frame time, particles, audio, canvases, state and the save;
  // ?seed=n makes the fight play out the same way every time
  var DEBUG = /[?&]debug=1(&|$)/.test(location.search);
  var SEED = (location.search.match(/[?&]seed=(\d+)/) || [])[1];
  var frand = SEED ? (function (a) { return function () { a = (a + 0x6d2b79f5) | 0; var q = Math.imul(a ^ (a >>> 15), 1 | a); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; })(+SEED) : Math.random;
  // every offscreen canvas is made here, so they can be counted (and their memory estimated)
  var CANVASES = [];
  function mkCanvas() { var c = document.createElement("canvas"); CANVASES.push(c); return c; }

  /* ════════ map ════════ */
  var T = 16, MW = 100, MH = 80, CX = 48, CY = 40, DOCKX = 51;
  var DEEP = 0, SHAL = 1, SAND = 2, GRASS = 3, PATH = 4, POND = 5, DOCK = 6, LAVA = 7, PAD = 8, RIVER = 9, BRIDGE = 10;
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
  function coast(x, y) {             // < 1 is land
    var a = Math.atan2(y - 39, (x - 48) / 1.32), d = Math.hypot((x - 48) / 1.32, y - 39);
    var v = d / (28 + 2.2 * Math.sin(3 * a + 1.1) + 1.6 * Math.sin(5 * a + 2.3) + 1.0 * Math.sin(7 * a + 0.4) + 0.6 * Math.sin(11 * a + 1.7));
    v = Math.min(v, Math.hypot((x - 84) / 10, (y - 37) / 5.6));             // the lighthouse headland
    v = Math.min(v, Math.hypot((x - 21) / 12, (y - 61) / 8.5));             // the southwest lobe
    return Math.max(v, 1.9 - Math.hypot((x - 52) / 6.4, (y - 69.5) / 5.4));  // the harbour bay
  }
  function hiEdge(x) { return 26.5 + 3.2 * Math.sin(x * 0.13 + 0.6) + 1.6 * Math.sin(x * 0.37 + 2.1) - Math.max(0, x - 68) * 0.55 - Math.max(0, 24 - x) * 0.5; }
  function midEdge(x) { return 55 + 2.6 * Math.sin(x * 0.17 + 1.3) + 1.4 * Math.sin(x * 0.41) - (x - 48) * 0.1; }
  function tier(x, y) { return y < hiEdge(x) ? 2 : y < midEdge(x) ? 1 : 0; }
  var map = [], x, y;
  for (y = 0; y < MH; y++) {
    map.push([]);
    for (x = 0; x < MW; x++) { var cv0 = coast(x + 0.5, y + 0.5); map[y].push(cv0 > 1.12 ? DEEP : cv0 > 1 ? SHAL : cv0 > 0.925 ? SAND : GRASS); }
  }
  function at(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? DEEP : map[y][x]; }
  function land(t) { return t === GRASS || t === SAND || t === PATH || t === PAD || t === BRIDGE; }
  function wet(t) { return t === DEEP || t === SHAL || t === POND || t === RIVER; }
  // the koi pond: a wobbly blob (tile units). < 1 is water
  var KP = { x: 69, y: 48.5, rx: 5.2, ry: 2.4 };
  function pondF(fx, fy) {
    var dx = (fx - KP.x) / KP.rx, dy = (fy - KP.y) / KP.ry, a = Math.atan2(dy, dx);
    return Math.sqrt(dx * dx + dy * dy) / (1 + 0.13 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + 2.1) + 0.05 * Math.sin(7 * a));
  }
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] === GRASS && pondF(x + 0.5, y + 0.5) < 1) map[y][x] = POND;
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
  var RIVER_PTS = [[31, 13.5], [30.2, 19], [29.6, 24], [28.4, 29], [25.6, 34], [22, 39], [19.6, 44.5], [18.2, 50], [17, 55], [15.4, 59.5], [12.6, 63.5], [8, 66.4], [3, 67.4]];
  carve(RIVER_PTS, function (q) { return 1.4 + q * 1.3; }, function (tx, ty) { if (map[ty][tx] === GRASS || map[ty][tx] === SAND) map[ty][tx] = RIVER; });
  function road(pts, width) { carve(pts, width, function (tx, ty) { var m = map[ty][tx]; if (m === GRASS || m === SAND) map[ty][tx] = PATH; else if (m === RIVER) map[ty][tx] = BRIDGE; }); }
  var PLAZA = { x: 46.5, y: 60.5, r: 2.7 };                           // the village square, by the harbour
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (Math.hypot(x + 0.5 - PLAZA.x, y + 0.5 - PLAZA.y) < PLAZA.r && land(at(x, y))) map[y][x] = PATH;
  var dockY = 60; while (land(at(DOCKX, dockY + 1))) dockY++;
  road([[46.6, 58], [45.6, 55.2], [46.6, 52], [49.4, 49.4], [50.2, 46.6]], 1.9);                              // up the first cliff: the village to the clearing
  road([[47.6, 40.6], [46.2, 37.6], [47.4, 34.4], [49.2, 31.6], [48.8, 28.6], [47.6, 25.5]], 1.9);           // the gate, then up the second cliff to the highland
  road([[48, 25.5], [52.5, 23.6], [57, 22.8]], 1.2);                                                          // the watchtower
  road([[47.6, 25.4], [44, 23.4], [41.4, 21.2]], 1.2);                                                        // the cave
  road([[46.6, 38.4], [41, 38.8], [35, 40.6], [29.5, 40.4], [24.5, 38.2], [18.5, 36.6]], 1.9);               // west, over the river to the brachio meadow
  road([[18.5, 36.6], [17.6, 32.4], [18.2, 28.6], [19.6, 25.4], [20.6, 23.2], [21, 22.2]], 1.6);                                  // an old trail up into the woods
  road([[52.4, 46], [57, 46.6], [62.4, 44.6], [68.6, 44.6], [74.5, 43.4], [80, 40.4], [86.5, 37.6]], 1.9);   // east, past the garden and out along the headland
  road([[62.4, 44.6], [63, 41], [64.4, 38]], 1);                                                              // the raptor pen
  road([[45.6, 47], [42.6, 48.6], [40.8, 50.4]], 1);                                                          // the t-rex paddock viewpoint
  road([[68.6, 44.6], [67.4, 50.4], [66.4, 52]], 1);                                                          // the garden: pond, blanket, the M3
  road([[44.4, 60.4], [38, 61.6], [31.6, 61.2], [27, 61.4]], 1.3);                                            // the coast road to the outpost
  road([[49.4, 60.8], [54, 61.8], [58.6, 62.6]], 1.3);                                                        // the helipad and the herd plain
  road([[48, 62.6], [50.4, 63.4], [DOCKX + 0.5, dockY + 0.5]], 1.3);                                          // the dock
  road([[47.8, 50.6], [51.6, 51.4]], 1);                                                                      // the stone tablet
  for (y = dockY + 1; y <= dockY + 4; y++) { map[y][DOCKX] = DOCK; map[y][DOCKX + 1] = DOCK; }
  var HELI = { x: 61, y: 62 };                                         // the helipad, 3x3 tiles
  for (y = HELI.y - 1; y <= HELI.y + 1; y++) for (x = HELI.x - 1; x <= HELI.x + 1; x++) if (land(at(x, y))) map[y][x] = PAD;
  // buildings: the visitor centre and the supply depot on the square, the bunker in the outpost
  var BUILDINGS = [
    { id: "visitor", x0: 39, y0: 58, w: 4, h: 2, room: "visitor", name: "the visitor centre", text: "the visitor centre. the robots keep it stocked. there's a map on the wall with eight pins in it, and a sign by the door: 'please do not tap on the glass. the raptors can see you.'" },
    { id: "bunker", x0: 19, y0: 58, w: 4, h: 2, room: "bunker", name: "the bunker", text: "the outpost bunker." },
    { id: "depot", x0: 53, y0: 58, w: 3, h: 2, room: "depot", name: "the supply depot", text: "the supply depot. crates come off the boat, the cargo bots haul them in here, and the drones fly them out to wherever something needs fixing." }
  ];

  // height: which terrace each tile of ground (and water on the ground) sits on
  var ELEV = [];
  for (y = 0; y < MH; y++) {
    ELEV.push([]);
    for (x = 0; x < MW; x++) { var tl = map[y][x]; ELEV[y].push(tl === GRASS || tl === PATH || tl === RIVER || tl === BRIDGE || tl === POND || tl === PAD ? tier(x + 0.5, y + 0.5) : 0); }
  }
  // the volcano is a heightfield (world px): a cone with gullies, a crater bowl and a lava lake.
  // (x, y) is the centre of its footprint; squash flattens the footprint front to back
  var VOLC = { x: 46 * T + 8, y: 15 * T + 4, R: 118, H: 104, sq: 1.65, rc: 27 };
  function volcD(wx, wy) { var u = wx - VOLC.x, v = (wy - VOLC.y) * VOLC.sq; return Math.sqrt(u * u + v * v); }
  var RIMH = Math.pow(1 - VOLC.rc / VOLC.R, 1.25) * VOLC.H;
  function lvl(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? 0 : ELEV[y][x]; }
  function rim(x, y) { var l = lvl(x, y); return lvl(x + 1, y) !== l || lvl(x - 1, y) !== l || lvl(x, y + 1) !== l || lvl(x, y - 1) !== l; }
  // the waterfalls: wherever the river runs off a cliff
  var FALLS = [];
  (function () {
    var seen = {};
    for (var yy = 1; yy < MH; yy++) for (var xx = 0; xx < MW; xx++) {
      if (map[yy][xx] !== RIVER || map[yy - 1][xx] !== RIVER || lvl(xx, yy - 1) <= lvl(xx, yy)) continue;
      var key = lvl(xx, yy - 1) * 100 + lvl(xx, yy);
      if (!seen[key]) { seen[key] = { n: 0, x: 0, y: 0 }; FALLS.push(seen[key]); }
      seen[key].n++; seen[key].x += xx; seen[key].y += yy;
    }
    FALLS.forEach(function (f) { f.x = (f.x / f.n + 0.5) * T; f.y = (f.y / f.n) * T - 4; });
  })();

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", x: 44, y: 57, name: "signpost", text: "pi's jurassic island. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. find all eight and something on the island wakes up. the boat at the dock takes you back. (the paddocks are fenced. please don't feed the raptors.)" },
    { id: "rack", room: "bunker", x: 2, y: 3, name: "the rack", sec: "projects", found: true, text: "High-availability DNS. Two Raspberry Pi 5 nodes running AdGuard Home + Unbound behind a keepalived VRRP floating IP. A service-level health check moves the IP to the backup node within seconds; failover and failback tested in both directions, config synced every 10 minutes.", links: [["ha-dns repo ↗", GH + "homelab/tree/main/ha-dns"], ["projects", "#projects"]] },
    { id: "desk", room: "bunker", x: 6, y: 3, name: "the desk", sec: "projects", found: true, wide: true, text: "Claude intake triage assistant. Turns messy free-text help requests into structured, reviewable records (category, urgency, summary, next step, human-review flag) via Google Forms, Apps Script, and the Claude API. A 15-case eval harness took primary accuracy from 93% to 100% and multi-need coverage from 0% to 90%. Staff review every row.", links: [["repo ↗", GH + "claude-intake-triage"], ["demo ↗", "https://www.loom.com/share/c43efcd9c3314bcd9cda3002282d31a5"], ["projects", "#projects"]] },
    { id: "uplink", x: 25, y: 63, name: "the uplink", sec: "projects", found: true, text: "AWS static site with Terraform. A private S3 bucket served over HTTPS through CloudFront with Origin Access Control, provisioned entirely with Terraform. Deployed and destroyed with one command, inside the AWS free tier, with a budget alarm.", links: [["terraform repo ↗", GH + "homelab/tree/main/terraform-aws-static-site"], ["projects", "#projects"]] },
    { id: "tower", x: 58, y: 21, name: "the watchtower", sec: "projects", found: true, text: "monitoring-stack: Prometheus scrapes host and container metrics, Grafana charts them. Docker Compose. uptime-monitoring: Uptime Kuma in Docker, tracking availability and response health for every homelab service. (from up here you can see the whole island, and the volcano is still warm.)", links: [["monitoring ↗", GH + "homelab/tree/main/monitoring-stack"], ["uptime ↗", GH + "homelab/tree/main/uptime-monitoring"], ["projects", "#projects"]] },
    { id: "lighthouse", x: 89, y: 37, name: "the lighthouse", sec: "experience", found: true, text: "Cyber Ready Clinic, Cyber Security Analyst, Sep 2026 – present, Maryland · internship cohort. Support nonprofit cyber-readiness assessments using the Discover5 business-risk and Ready5 capability frameworks, with findings aligned to the NIST Cybersecurity Framework and CIS Controls. Working toward the Ready5 Practitioner digital badge, expected Nov 2026 on cohort completion. Also: NextGen Consulting Inc., Cloud & AI Operations Intern, May 2025 – present. HCC Campus Store · Slingshot, Campus Operations Associate, Aug 2024 – present.", links: [["experience", "#experience"]] },
    { id: "macbook", x: 66, y: 53, name: "a macbook on a blanket", sec: "projects", found: true, text: "ammaarrehman.github.io. This site. Plain HTML, CSS, JavaScript and a little Python, no frameworks. The orb, the island, and the boot screen are all canvas. (you're standing in it.)", links: [["site repo ↗", GH + "ammaarrehman.github.io"], ["projects", "#projects"]] },
    { id: "tablet", x: 52, y: 50, name: "a stone tablet", sec: "education & certs", found: true, text: "Howard Community College, A.A. General Studies, Aug 2024 – Dec 2026, GPA 3.65 · Dean's List. UMD · Smith School of Business, B.S. Information Systems, starts Jan 2027. Certifications: AWS Certified Cloud Practitioner (CLF-C02), CompTIA Tech+, Ready5 Practitioner (Cyber Ready Clinic, in progress · expected Nov 2026). FBLA State Champion and Regional Champion.", links: [["education", "#education"]] },
    { id: "mailbox", x: 54, y: 63, name: "the mailbox", sec: "contact", found: true, text: "ammaarrehmanf@gmail.com. Want to talk? Email is the fastest way to reach me.", links: [["email ↗", "mailto:ammaarrehmanf@gmail.com"], ["linkedin ↗", "https://www.linkedin.com/in/ammaarrehman/"], ["contact", "#contact"]] },
    { id: "drink", x: 50, y: 58, name: "a drink stand", text: "pi takes a sip. zoom mode for ten seconds." },
    { id: "shrine", x: 21, y: 21, name: "an old shrine", text: "" },
    { id: "cave", x: 41, y: 20, name: "a cave in the cliff", text: "there's a terminal in here, still humming. someone left it logged in." },
    { id: "boat", x: DOCKX + 2, y: dockY + 3, name: "the boat", text: "the boat back to the mainland. sail back to the site?", links: [["sail back ↩", "#exit"]] }
  ];
  var TOTAL = STATIONS.filter(function (s) { return s.found; }).length;
  var OUT = STATIONS.filter(function (s) { return !s.room; });        // the landmarks that stand outdoors
  /* ════════ the save ════════
     one versioned object in localStorage: the logs found, the secrets, whether pi has evolved,
     where pi was, the comfort settings, who holds the core, whether the credits have rolled.
     a bad parse or an unknown version starts fresh instead of breaking the island, and a browser
     that refuses storage (a private window) just doesn't remember */
  var SAVE_KEY = "island-save";
  function freshSave() { return { v: 1, logs: [], secrets: [], evolved: false, lastPos: null, settings: null, ruler: null, credits: false, hatched: false, seal: false }; }
  var save = freshSave();
  (function () {
    var o = null; try { o = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { o = null; }
    if (o && o.v === 1 && Array.isArray(o.logs)) {
      Object.keys(save).forEach(function (k2) { if (o[k2] !== undefined && o[k2] !== null && typeof o[k2] === typeof save[k2]) save[k2] = o[k2]; else if (o[k2] !== undefined && save[k2] === null) save[k2] = o[k2]; });
      if (!Array.isArray(save.secrets)) save.secrets = [];
      if (!Array.isArray(save.lastPos) || save.lastPos.length !== 2 || !isFinite(save.lastPos[0]) || !isFinite(save.lastPos[1])) save.lastPos = null;
      return;
    }
    try {                                                            // no save yet: bring over the older per-session keys
      var old = JSON.parse(sessionStorage.getItem("pi-found") || "[]"); if (Array.isArray(old)) save.logs = old;
      save.evolved = sessionStorage.getItem("pi-kaiju") === "1"; save.ruler = sessionStorage.getItem("rift-done") || null; save.hatched = sessionStorage.getItem("pi-hatched") === "1";
    } catch (e) {}
  })();
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  var found = {};
  save.logs.forEach(function (k2) { if (typeof k2 === "string") found[k2] = 1; });

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
  var GATE = { x: 48, y: 33 };
  solid[k(GATE.x - 2, GATE.y)] = 1; solid[k(GATE.x + 2, GATE.y)] = 1;
  var PADDOCKS = [
    { name: "t-rex paddock", x0: 27, y0: 43, x1: 39, y1: 54 },
    { name: "raptor pen", x0: 60, y0: 30, x1: 70, y1: 38 }
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
  var FOREST_BIAS = [[31, 18, 6, 0.35], [62, 19, 5, 0.3], [28, 32, 5, 0.35], [19, 25, 4, 0.35], [74, 29, 4, 0.25], [36, 56, 4, 0.3], [59, 49, 3, 0.25], [81, 48, 4, 0.3], [14, 50, 3, 0.25], [40, 29, 4, 0.25]];
  function forest(x, y) {
    var v = fbm(x, y) + 0.08;
    FOREST_BIAS.forEach(function (fb) { v += fb[3] * Math.max(0, 1 - Math.hypot(x - fb[0], y - fb[1]) / fb[2]); });
    return v;
  }
  var CLEAR = [[46.5, 60, 6], [48.5, 43.5, 6.2], [18, 38, 4], [61, 56, 5.5], [67, 50, 4], [65, 34, 4], [33, 48.5, 4.5], [61, 62, 3], [78, 44, 4], [58, 22, 2.5], [41, 20.5, 2], [48, 33, 2.5], [89, 37, 2.5], [77, 34, 3], [22, 61, 5]];
  var COMPOUND = { x0: 17, y0: 57, x1: 28, y1: 65, gate: [60, 61, 62] };
  function inCompound(x, y) { return x >= COMPOUND.x0 && x <= COMPOUND.x1 && y >= COMPOUND.y0 - 1 && y <= COMPOUND.y1; }
  function clearing(x, y) { return inCompound(x, y) || Math.hypot(x - 21, y - 21.5) < 1.7 || CLEAR.some(function (c) { return Math.hypot(x - c[0], y - c[1]) < c[2]; }); }
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
    } else if (t === SHAL && h < 0.02 && Math.abs(x - DOCKX) > 3) {
      props.push({ kind: "rock", tx: x, ty: y });
    }
  }
  // nests in the meadow, each with a clutch of speckled eggs
  var nests = [[57, 55], [63, 57], [66, 54], [15, 39]].filter(function (n) { return walkable0(n[0], n[1]); }).map(function (n) {
    solid[k(n[0], n[1])] = 1; var p = { kind: "nest", tx: n[0], ty: n[1], eggs: 2 + ((hash(n[0], n[1]) * 3) | 0) }; props.push(p); return p;
  });
  function walkable0(x, y) { return land(at(x, y)) && at(x, y) !== PATH && !solid[k(x, y)]; }
  [[43, 59], [50, 60], [43, 62], [50, 63], [46, 33], [51, 33], [53, 62], [26, 40]].forEach(function (l) {
    if (land(at(l[0], l[1])) && at(l[0], l[1]) !== PATH && at(l[0], l[1]) !== BRIDGE && !solid[k(l[0], l[1])]) { props.push({ kind: "lamp", tx: l[0], ty: l[1] }); solid[k(l[0], l[1])] = 1; }
  });
  // the outpost: sandbag walls with a gate facing the helipad, and a yard kitted for living off-grid
  var wall = {};
  for (y = COMPOUND.y0; y <= COMPOUND.y1; y++) for (x = COMPOUND.x0; x <= COMPOUND.x1; x++) {
    var edge2 = x === COMPOUND.x0 || x === COMPOUND.x1 || y === COMPOUND.y0 || y === COMPOUND.y1;
    if (!edge2 || !land(at(x, y)) || at(x, y) === PATH || (x === COMPOUND.x1 && COMPOUND.gate.indexOf(y) >= 0)) continue;
    wall[k(x, y)] = 1; solid[k(x, y)] = 1;
  }
  [["mast", 18, 61], ["solar", 18, 63], ["solar", 19, 63], ["generator", 24, 58], ["tank", 26, 58], ["tent", 22, 63], ["campfire", 21, 62], ["crates", 27, 64], ["lamp", 27, 58], ["lamp", 18, 59]].forEach(function (q) {
    if (walkable0(q[1], q[2])) { props.push({ kind: q[0], tx: q[1], ty: q[2] }); solid[k(q[1], q[2])] = 1; }
  });
  // crates stacked by the depot and on the dock
  [[56, 60], [56, 59], [52, 60], [DOCKX - 1, dockY]].forEach(function (c2) { if (walkable0(c2[0], c2[1])) { props.push({ kind: "crates", tx: c2[0], ty: c2[1] }); solid[k(c2[0], c2[1])] = 1; } });
  function walkable(x, y) { var t = at(x, y); return (land(t) || t === DOCK) && !solid[k(x, y)]; }
  function solidPx(px, py) { return !walkable(Math.floor(px / T), Math.floor(py / T)); }

  /* ════════ sprites (drawn once into little canvases) ════════ */
  function sprite(w, h, fn) { var c = mkCanvas(); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
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
    var c = mkCanvas(); c.width = w0 + 2; c.height = h0 + 2;
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
  var ground = mkCanvas(); ground.width = MW * T; ground.height = MH * T;
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
  var HIGH_T = ["#58912f", "#679f36", "#78ad3e", "#8aba48", "#9dc656", "#b0d066"];
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
          r(X, Y, 2, T, COL.dock2); if (tx === DOCKX + 1) r(X + T - 2, Y, 2, T, COL.dock2);
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
        // and lusher under the forests, brighter up on the highland, worn to dirt in the meadows
        var fo = forest(tx, ty);
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var wx = tx + i / T, wy = ty + j / T, patch = fbm(wx * 1.6 + 7, wy * 1.6);
          var gv = 0.47 + patch * 0.42 + (hash(X + i, Y + j) - 0.5) * 0.22 + ELEV[ty][tx] * 0.2 - Math.max(0, Math.min(1, (fo - 0.1) * 4)) * 0.28;
          var dirt = fo < 0.05 && fbm(wx * 2.8 + 90, wy * 2.8 + 11) > 0.33;
          g.fillStyle = dirt ? tone(0.5 + (hash(X + i, Y + j) - 0.5) * 0.4, ["#6f5a3a", "#8a7048", "#9c8a56"], X + i, Y + j) : tone(gv, ELEV[ty][tx] === 2 ? HIGH_T : GRASS_T, X + i, Y + j);
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

    // bones in the t-rex paddock, and three-toed tracks along the south beach
    (function bones(bx, by) {
      for (var i = 0; i < 6; i++) { r(bx + i * 3, by, 1, 6, "#d9cfb8"); r(bx + i * 3, by, 1, 1, "#f2ead8"); }
      r(bx - 1, by + 3, 18, 1, "#c8bea8"); r(bx + 17, by + 2, 6, 3, "#e8e0cc"); r(bx + 21, by + 1, 5, 4, "#e8e0cc"); r(bx + 22, by + 2, 1, 1, "#3a3024"); r(bx + 24, by + 4, 2, 1, "#c8bea8");
      r(bx - 10, by + 3, 9, 1, "#c8bea8"); r(bx - 12, by + 4, 3, 1, "#c8bea8");
    })(31 * T + 2, 50 * T + 4);
    for (var ft = 0; ft < 11; ft++) {
      var fx0 = (30 + ft * 1.3) * T + (ft % 2) * 6, fy0 = (65.4 + Math.sin(ft * 0.6) * 0.5) * T;
      if (at(Math.floor(fx0 / T), Math.floor(fy0 / T)) !== SAND) continue;
      g.fillStyle = "#c2a86e"; g.fillRect(fx0, fy0, 2, 2); g.fillRect(fx0 + 2, fy0 - 2, 1, 2); g.fillRect(fx0 + 2, fy0 + 2, 1, 2); g.fillRect(fx0 + 3, fy0, 2, 1);
    }

    // cliffs: a rock face under every drop in level, walls down the sides, stairs where a path climbs
    var ROCK = ["#5d574c", "#7c7567", "#9d9584", "#bdb5a2", "#d6cfbc"];
    for (var cy2 = 1; cy2 < MH; cy2++) for (var cx2 = 0; cx2 < MW; cx2++) {
      var X2 = cx2 * T, Y2 = cy2 * T, L0 = lvl(cx2, cy2), Lup = lvl(cx2, cy2 - 1);
      var isPath = map[cy2][cx2] === PATH, upPath = map[cy2 - 1][cx2] === PATH, RK = ROCK, tt2 = map[cy2][cx2];
      if (tt2 === RIVER || tt2 === BRIDGE || map[cy2 - 1][cx2] === RIVER) { if (Lup > L0) r(X2, Y2 + 12, T, 3, "rgba(0,0,0,.18)"); continue; }
      if (Lup > L0) {
        if (isPath || upPath) {                              // stairs cut into the rock
          for (var st = 0; st < T; st += 3) { r(X2 + 2, Y2 + st, T - 4, 2, "#c8b48a"); r(X2 + 2, Y2 + st + 2, T - 4, 1, "#8a7552"); }
          r(X2, Y2, 2, T, RK[1]); r(X2 + T - 2, Y2, 2, T, RK[1]); r(X2, Y2, 1, T, RK[0]); r(X2 + T - 1, Y2, 1, T, RK[0]);
        } else {
          // a tall rock face: pale at the top where the light catches it, darker toward the foot,
          // split by vertical cracks, with a ledge of strata partway down and grass hanging over the lip
          var fh = 16 + 5 * (Lup - L0), below = map[cy2 + 1] ? map[cy2 + 1][cx2] : DEEP;
          if (below === PATH || below === RIVER) fh = 14;
          var ledge = 6 + ((hash(cx2 >> 1, cy2) * 4) | 0);
          for (var fy2 = 0; fy2 < fh; fy2++) for (var fx2 = 0; fx2 < T; fx2++) {
            var gx2 = X2 + fx2, crack = hash(gx2 >> 2, cy2 * 7) < 0.3 && (gx2 & 3) === 0, wob = Math.sin(gx2 * 0.7 + cy2) * 1.2;
            var v2 = 0.92 - fy2 / fh * 0.62 + (hash(gx2 >> 1, (Y2 + fy2) >> 2) - 0.5) * 0.18 - (crack ? 0.35 : 0) - (Math.abs(fy2 - ledge - wob) < 0.8 ? 0.3 : 0) + (Math.abs(fy2 - ledge - wob - 1) < 0.8 ? 0.12 : 0);
            g.fillStyle = tone(v2, RK, gx2, Y2 + fy2); g.fillRect(gx2, Y2 + fy2, 1, 1);
          }
          var LIP = L0 < Lup ? (Lup === 2 ? "#86c860" : "#6cb452") : "#6cb452";
          for (var lp = 0; lp < T; lp++) { var hang = 1 + ((hash(cx2 * 16 + lp, cy2) * 3) | 0); r(X2 + lp, Y2, 1, hang, lp % 3 ? LIP : "#4f9a3e"); }
          if (hash(cx2, cy2 * 3) < 0.4) for (var vn = 0; vn < 5 + hash(cy2, cx2) * 8; vn++) r(X2 + 3 + ((hash(cx2, 9) * 9) | 0) + (vn % 3 === 2 ? 1 : 0), Y2 + 2 + vn, 1, 1, vn % 2 ? "#2f6f2c" : "#4f9a3e");   // a hanging vine
          for (var sh2 = 0; sh2 < 4; sh2++) r(X2, Y2 + fh + sh2, T, 1, "rgba(0,0,0," + (0.26 - sh2 * 0.06).toFixed(2) + ")");   // cast shadow at the foot
          if (hash(cx2 * 5, cy2) < 0.35) { var bxr = X2 + ((hash(cx2, cy2) * 10) | 0); r(bxr, Y2 + fh - 3, 4, 3, RK[2]); r(bxr, Y2 + fh - 3, 4, 1, RK[3]); r(bxr, Y2 + fh, 4, 1, "rgba(0,0,0,.3)"); }   // fallen rock
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

  // pi: the little white one, as it was
  var FRAMES = {
    idle:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."],
    blink: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWGWWGWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."],
    walk1: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..",".WW....WW.",".GG....GG."],
    walk2: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","...WWWW...","...GGGG..."],
    back:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."]
  };
  var PIPAL = { W: "#f4f4f4", G: "#a9a9a9", K: "#141414" };
  // middle path, as pi grows into it: a small grey kaiju, about pi's size, spikes down its back,
  // a stubby tail and a big grin. side on, facing the camera, or walking away
  var KJ = {
    side: { w: 14, idle: ["........GGGG..", ".....DGGGGGGG.", ".....DGGGEGGGG", "...DDDGGGGGGGG", "...DDGGGGGMMM.", ".DDDGGGGGGG...", "..DGGGGGLLGG..", "DDDGGGGLLLGGG.", "DGGGGGGLLLG...", "GGGGGGGLLLG...", ".GGGGGGGLGG...", "...GGGGGGG....", "...FF...FF....", "...FF...FF...."], blink: ["........GGGG..", ".....DGGGGGGG.", ".....DGGGMGGGG", "...DDDGGGGGGGG", "...DDGGGGGMMM.", ".DDDGGGGGGG...", "..DGGGGGLLGG..", "DDDGGGGLLLGGG.", "DGGGGGGLLLG...", "GGGGGGGLLLG...", ".GGGGGGGLGG...", "...GGGGGGG....", "...FF...FF....", "...FF...FF...."], walk1: ["........GGGG..", ".....DGGGGGGG.", ".....DGGGEGGGG", "...DDDGGGGGGGG", "...DDGGGGGMMM.", ".DDDGGGGGGG...", "..DGGGGGLLGG..", "DDDGGGGLLLGGG.", "DGGGGGGLLLG...", "GGGGGGGLLLG...", ".GGGGGGGLGG...", "...GGGGGGG....", "..FF.....FF...", "..FF......FF.."], walk2: ["..............", "........GGGG..", ".....DGGGGGGG.", ".....DGGGEGGGG", "...DDDGGGGGGGG", "...DDGGGGGMMM.", ".DDDGGGGGGG...", "..DGGGGGLLGG..", "DDDGGGGLLLGGG.", "DGGGGGGLLLG...", "GGGGGGGLLLG...", "..GGGGGGGG....", "....FFFF......", "....FF.FF....."] },
    front: { w: 12, idle: ["....GGGG....", "..GGGGGGGG..", ".DGGGGGGGGD.", ".DGEGGGGEGD.", "DDGGGLLGGGDD", ".DGGMMMMGGD.", "..GGGGGGGG..", ".GGGLLLLGGG.", ".GGLLLLLLGG.", "..GLLLLLLG..", "..GGGGGGGGG.", "...GGGGGG.GG", "...FF..FF...", "...FF..FF..."], blink: ["....GGGG....", "..GGGGGGGG..", ".DGGGGGGGGD.", ".DGMGGGGMGD.", "DDGGGLLGGGDD", ".DGGMMMMGGD.", "..GGGGGGGG..", ".GGGLLLLGGG.", ".GGLLLLLLGG.", "..GLLLLLLG..", "..GGGGGGGGG.", "...GGGGGG.GG", "...FF..FF...", "...FF..FF..."], walk1: ["....GGGG....", "..GGGGGGGG..", ".DGGGGGGGGD.", ".DGEGGGGEGD.", "DDGGGLLGGGDD", ".DGGMMMMGGD.", "..GGGGGGGG..", ".GGGLLLLGGG.", ".GGLLLLLLGG.", "..GLLLLLLG..", "..GGGGGGGGG.", "...GGGGGG.GG", "...FF...FF..", "...FF......."], walk2: ["....GGGG....", "..GGGGGGGG..", ".DGGGGGGGGD.", ".DGEGGGGEGD.", "DDGGGLLGGGDD", ".DGGMMMMGGD.", "..GGGGGGGG..", ".GGGLLLLGGG.", ".GGLLLLLLGG.", "..GLLLLLLG..", "..GGGGGGGGG.", "...GGGGGG.GG", "..FF...FF...", ".........FF."] },
    back: { w: 12, idle: ["....GGGG....", "..GGGDDGGG..", ".DGGGDDGGGD.", ".DGGDDDDGGD.", "DDGGGDDGGGDD", ".DGGDDDDGGD.", "..GGGDDGGG..", ".GGGDDDDGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "...FFGGFF...", "...FF.GGFF.."], walk1: ["....GGGG....", "..GGGDDGGG..", ".DGGGDDGGGD.", ".DGGDDDDGGD.", "DDGGGDDGGGDD", ".DGGDDDDGGD.", "..GGGDDGGG..", ".GGGDDDDGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "...FFGG.FF..", "...FF..GG..."], walk2: ["....GGGG....", "..GGGDDGGG..", ".DGGGDDGGGD.", ".DGGDDDDGGD.", "DDGGGDDGGGDD", ".DGGDDDDGGD.", "..GGGDDGGG..", ".GGGDDDDGGG.", ".GGGGDDGGGG.", "..GGGDDGGG..", "..GGGGGGGG..", "...GGGGGG...", "..FF.GGFF...", ".......GGFF."] }
  };
  var KJPAL = { G: "#8b8f98", D: "#4a4d55", L: "#c4c7cd", E: "#141414", M: "#5a5d65", F: "#6a6e76" };
  // pi's frame for a mode ("idle", "walk", "blink"), or middle path's once pi has evolved
  function piArt(mode, i, up, profile) {
    if (pi.kaiju) {
      var set = KJ[profile ? "side" : up ? "back" : pi.view === "down" ? "front" : "side"];
      return frameCanvas(mode === "walk" ? (i % 2 ? set.walk1 : set.walk2) : mode === "blink" && set.blink ? set.blink : set.idle, KJPAL, set.w);
    }
    var f = up ? (mode === "walk" && i % 2 ? FRAMES.walk1 : FRAMES.back) : mode === "walk" ? (i % 2 ? FRAMES.walk1 : FRAMES.walk2) : mode === "blink" ? FRAMES.blink : FRAMES.idle;
    return frameCanvas(f, PIPAL, 10);
  }
  function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x - w / 2 + 1, y - 1, w - 2, 1); ctx.fillRect(x - w / 2, y, w, 2); ctx.fillRect(x - w / 2 + 1, y + 2, w - 2, 1); }

  var SPAWN = { x: 46 * T + 8, y: 60 * T + 12 };
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
    if (!amb) amb = { waves: SND.loop("waves"), falls: SND.loop("falls"), buzz: SND.loop("buzz"), aura: SND.loop("aura"), rumble: SND.loop("rumble"), rotor: SND.loop("rotor"), engine: SND.loop("engine") };
  }
  function stopSound() {
    if (!SND) return;
    SND.music(null);
    if (amb) { Object.keys(amb).forEach(function (k2) { amb[k2].stop(); }); amb = null; }
  }
  var shoreT = 0, shore = 0;
  function hush(names) { names.forEach(function (k2) { amb[k2].set({ vol: 0 }); }); }
  function updateSound(dt) {
    if (!amb || side) return;                        // the shrine sets its own sound
    if (room) { hush(["waves", "falls", "rumble", "buzz", "rotor", "engine", "aura"]); SND.music(sky.dark > 0.6 ? "night" : "day"); return; }
    if (riftBusy()) {
      // when the orbs wake, the island goes silent: no surf, no birds, no music. then the dark
      // score creeps in out of nothing, and it only gets worse from there
      hush(["waves", "falls", "rumble", "buzz", "rotor", "engine"]);
      SND.music(rift.phase === "dim" || rift.phase === "fall" ? null : reality.cur === "future" ? "doom-future" : reality.cur === "chaos" ? "doom-chaos" : "doom");
      amb.aura.set({ vol: rift.phase === "dim" ? 0 : rift.phase === "fall" ? 0.14 : 0.24 + (rift.act ? 0.18 : 0), rate: rift.act ? 1 : 0.3 });
      return;
    }
    SND.music(sky.dark > 0.6 ? "night" : "day");
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
    if (vd < 300 && (popT -= dt) <= 0) { popT = 0.4 + Math.random() * 1.6; sfx("pop", VX + (Math.random() - 0.5) * 30, VY); }
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
      + (SND ? '<h4>sound</h4><label class="w-chk"><input type="checkbox" data-k="on"' + (SND.on() ? " checked" : "") + '>sound on (m)</label>'
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
    if (!open || termOpen || setOpen()) return;
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
    if (car.driving && e.key === " ") { e.preventDefault(); bubble = { text: "beep beep", t: 1 }; sfx("honk"); return; }
    if (e.key === "Escape") { e.preventDefault(); if (!dlg.hidden) closeDialog(); else if (side && side.phase === "walk") { side = null; fade = 1; } else if (!side) setPaused(true); return; }
    if (asking && !dlg.hidden && (e.key === "y" || e.key === "Y" || e.key === "n" || e.key === "N")) { e.preventDefault(); wakeOrbs(e.key === "y" || e.key === "Y"); return; }
    if ((e.key === "p" || e.key === "P") && !side) { e.preventDefault(); setPaused(true); return; }
    if (e.key === "Shift") { keys.run = 1; return; }
    if (side && e.key === " " && dlg.hidden) { e.preventDefault(); keys.jump = 1; return; }
    if ((e.key === "m" || e.key === "M") && SND) { SND.toggle(); return; }
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

  cv.addEventListener("pointerup", function () { if (side) side.tap = 0; });
  cv.addEventListener("pointercancel", function () { if (side) side.tap = 0; });
  cv.addEventListener("lostpointercapture", function () { if (side) side.tap = 0; });
  function onKeyUp(e) { var d = dirKey(e); if (d) keys[d] = 0; if (e.key === "Shift") keys.run = 0; }
  // a key let go while the window was away never sends its keyup: forget everything held
  function clearKeys() { keys = {}; if (side) side.tap = 0; }
  function onVis() { if (document.hidden) { clearKeys(); if (open && !paused) setPaused(true); } }
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
    pi.path = null; pi.want = null; keys = {};
    if (s.id === "rex") { rex.hop = 1; rex.vy = -2.2; say("rex", REX[(Math.random() * REX.length) | 0], []); return; }
    if (s.id === "core") { coreSay(false); return; }
    if (s.id === "cave") { openTerm(); return; }
    if (s.id === "shrine" && sealed()) { say("an old shrine", "a standing stone, older than the park, with a ring carved into it. the ring is cold, and something has sealed it shut. (it opens when all eight logs are found: " + countFound() + " of " + TOTAL + ".)", []); return; }
    if (s.id === "shrine") { say("an old shrine", "a standing stone, older than the park, with a ring carved into it. the ring is warm. something on the other side of it is breathing. (what's through it contains flashing lights and loud sound.)", [["step through", "#descend"], [flashNote(OPT.flash), "#flash"]]); return; }
    if (s.id === "wake") { askRift(); return; }
    if (s.id === "heli") { toggleHeli(); return; }
    if (s.id === "car") { toggleCar(); bubble = { text: "pi:~$ vroom. arrows drive, space honks, e parks", t: 3.5 }; return; }
    if (s.id === "critter" || s.id === "bird" || s.id === "pond" || s.id === "nest" || s.id === "fence") { sayLocal(s); return; }
    if (s.id === "building") { if (s.ref.room) enterRoom(s.ref.room); else say(s.ref.name, s.ref.text, []); return; }
    if (s.id === "roomitem") { say(s.name, s.text, []); return; }
    if (s.id === "bot") { var bl = BOTSAY[s.ref.kind]; sfx("chatter", s.ref.x, s.ref.y); say("a bot", bl[(Math.random() * bl.length) | 0], []); return; }
    if (s.id === "drink") pi.boost = 10;
    logWait = s.found && !found[s.id] ? { s: s, t: 0 } : null;
    say(s.sec ? s.name + " · " + s.sec : s.name, s.text, s.links || []);
  }
  /* the logs. a card counts as read once it has been open a second and a half, or scrolled to
     its end. four logs wake the terminal's evolve command; all eight break the seal on the
     shrine (a short cut to show it) and then the orbs ask to fight */
  var logWait = null, sealNext = false;
  function updateLog(dt) { if (!logWait) return; if (dlg.hidden) { logWait = null; return; } if ((logWait.t += dt) >= 1.5) { var s0 = logWait.s; logWait = null; markFound(s0); } }
  function markFound(s) {
    if (found[s.id]) return;
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
      for (var i = 0; i < 40; i++) { var a = Math.random() * 6.283, v = 20 + Math.random() * 50; embers.push({ x: cut.x, y: cut.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1 + Math.random() }); }
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
     the dinosaurs are hand-built pixel sprites in one sheet (assets/island/dinos.png), drawn in
     the style of the pterosaur: flat tone bands, dark along the back and light on the belly, a
     dark outline that goes near black underneath, a few speckles. the pterosaur is the original
     sprite, pixel for pixel. middle path is traced from Ammaar's drawing. every sprite faces
     right with its feet on the bottom row; SHEET says where each frame of each mode sits. */
  var SHEET = {"trex":{"w":79,"h":45,"f":[[0,0],[80,0],[160,0],[240,0],[320,0],[400,0],[480,0],[560,0],[640,0],[720,0],[800,0],[880,0],[960,0]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"roar":[11,12]}},"raptor":{"w":33,"h":20,"f":[[0,46],[34,46],[68,46],[102,46],[136,46],[170,46],[204,46],[238,46],[272,46],[306,46],[340,46]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"brachio":{"w":84,"h":83,"f":[[0,67],[85,67],[170,67],[255,67],[340,67],[425,67],[510,67],[595,67],[680,67],[765,67],[850,67],[935,67],[1020,67]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"graze":[11,12]}},"stego":{"w":59,"h":40,"f":[[0,151],[60,151],[120,151],[180,151],[240,151],[300,151],[360,151],[420,151],[480,151],[540,151],[600,151],[660,151],[720,151]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"graze":[11,12]}},"trike":{"w":58,"h":36,"f":[[0,192],[59,192],[118,192],[177,192],[236,192],[295,192],[354,192],[413,192],[472,192],[531,192],[590,192],[649,192],[708,192]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"graze":[11,12]}},"para":{"w":54,"h":42,"f":[[0,229],[55,229],[110,229],[165,229],[220,229],[275,229],[330,229],[385,229],[440,229],[495,229],[550,229],[605,229],[660,229]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"graze":[11,12]}},"ankylo":{"w":46,"h":21,"f":[[0,272],[47,272],[94,272],[141,272],[188,272],[235,272],[282,272],[329,272],[376,272],[423,272],[470,272],[517,272],[564,272]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"graze":[11,12]}},"spino":{"w":90,"h":51,"f":[[0,294],[91,294],[182,294],[273,294],[364,294],[455,294],[546,294],[637,294],[728,294],[819,294],[910,294]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"dilo":{"w":41,"h":32,"f":[[0,346],[42,346],[84,346],[126,346],[168,346],[210,346],[252,346],[294,346],[336,346],[378,346],[420,346],[462,346],[504,346]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"roar":[11,12]}},"pachy":{"w":31,"h":22,"f":[[0,379],[32,379],[64,379],[96,379],[128,379],[160,379],[192,379],[224,379],[256,379],[288,379],[320,379],[352,379],[384,379]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10],"roar":[11,12]}},"galli":{"w":38,"h":40,"f":[[0,402],[39,402],[78,402],[117,402],[156,402],[195,402],[234,402],[273,402],[312,402],[351,402],[390,402]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"compy":{"w":17,"h":10,"f":[[0,443],[18,443],[36,443],[54,443],[72,443],[90,443],[108,443],[126,443],[144,443],[162,443],[180,443]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"baby":{"w":21,"h":18,"f":[[0,454],[22,454],[44,454],[66,454],[88,454],[110,454],[132,454],[154,454],[176,454],[198,454],[220,454]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"baby2":{"w":21,"h":18,"f":[[0,473],[22,473],[44,473],[66,473],[88,473],[110,473],[132,473],[154,473],[176,473],[198,473],[220,473]],"m":{"walk":[0,1,2,3,4,5],"idle":[6,7,8,9],"blink":[10]}},"ptero":{"w":32,"h":45,"f":[[0,492],[33,492],[66,492],[99,492],[132,492],[165,492],[198,492],[231,492],[264,492],[297,492],[330,492],[363,492],[396,492],[429,492],[462,492],[495,492],[528,492]],"m":{"fly":[0,1,2,3,4,5,6,7,8,9,10,11],"glide":[12,13,14,15],"blink":[16]}}};
  var SHEET_IMG = new Image(), sheetReady = false;
  SHEET_IMG.onload = function () { sheetReady = true; };
  SHEET_IMG.src = "assets/island/dinos.png?v=20260928";
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
        later(0.45, function () { sfx("hit", c.x, c.y, { vol: 0.7 }); c.hop = rival2.hop = 1; c.vy = rival2.vy = -1.4; });
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
          var near2 = props.filter(function (p2) { return (p2.kind === "fern" || p2.kind === "cycad" || p2.kind === "tallgrass") && Math.abs(p2.tx - 46) < 12 && Math.abs(p2.ty - 58) < 8; });
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
    later(delay, function () {
      b.perch = n;
      b.fly = { t: 0, dur: 1.4 + Math.hypot(p.x - b.x, p.y - b.y) / 160, x0: b.x, y0: b.y, g0: b.gy, x1: p.x + off, y1: p.y, g1: p.gy, arc: 18 + Math.random() * 16 };
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
  /* the M3 drives like a car, not a cursor. it has a drive and a reverse gear (tap s or down
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
    if (!car.driving) { car.driving = true; car.gear = "D"; pi.path = null; bubble = { text: TOUCH ? "tap to drive. e parks." : "w/s drive and reverse · shift drifts · e parks", t: 3 }; return; }
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
    if (!can("terminal")) return;
    termOpen = true; keys = {}; pi.path = null; pi.want = null;
    term.hidden = false; tOut.innerHTML = ""; sudoTries = -1; setPrompt();
    print("pi-sh 1.0 on tty1, cave terminal (volcano, level 1)", "dim");
    print("last login: a long time ago, from the helipad", "dim");
    print("type help. esc leaves.", "dim");
    tIn.value = ""; setTimeout(function () { tIn.focus({ preventScroll: true }); }, 30);
  }
  function closeTerm() { termOpen = false; term.hidden = true; tIn.type = "text"; cv.focus({ preventScroll: true }); }
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
      ["  2  brachiosaurus ...... the west meadow, by the river", "  1  t-rex .............. the paddock (fenced, 10,000 V)", "  3  velociraptors ...... the pen (fenced, and they know it)",
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
      if (countFound() < 4) { print("evolve: pi isn't ready. it needs 4 of 8 logs first (" + countFound() + " found).", "err"); return; }
      var stages = [["  .--.  ", " /    \\ ", " \\____/ ", "   egg  "], ["  ▄███▄  ", "  █▀█▀█  ", " ▄█████  ", "   pi     "], ["   ???    ", "  (    )  ", "   ~~~~   ", "          "]];
      print("evolving pi...", "dim");
      stages.forEach(function (st, n) { setTimeout(function () { st.forEach(function (l) { print("   " + l); }); print("   ↓", "dim"); sfx(n === 2 ? "warp" : "blip"); }, 300 + n * 500); });
      setTimeout(function () {
        KAIJU_ART.forEach(function (l) { print(l, "hi"); });
        print("pi evolved into MIDDLE PATH. (devolve to go back)", "ok");
        pi.kaiju = true; save.evolved = true; writeSave();
        sfx("grunt"); setTimeout(function () { sfx("squeak"); }, 260);             // a small roar, for a small kaiju
      }, 1900);
    },
    devolve: function () { if (!pi.kaiju) { print("pi is as small as it gets."); return; } pi.kaiju = false; save.evolved = false; writeSave(); print("pi is pi again.", "ok"); },
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
        : c.sleep > 0 && d.sleepSay ? d.sleepSay : Array.isArray(d.say) ? d.say[(Math.random() * d.say.length) | 0] : d.say;
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
    else if (v.id === "car") { say("the M3", "Ammaar's BMW M3. press e to get in, arrows or wasd to drive, space to honk, e again to park." + (TOUCH ? " on touch: tap where you want to go." : ""), [["get in", "#drive"]]); }
  }

  // the t-rex roars when pi comes close to its fence: the screen shakes, the birds scatter
  function roar() {
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
  function burst(x, y, name, n, speed) {
    var c = dust(name);
    for (var i = 0; i < n; i++) {
      var a = frand() * 6.283, v = speed * (0.3 + frand());
      rift.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 10, life: 1, c: c });
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
    rift = null; reality.cur = "dino"; reality.wipe = null; reality.glitch = 0; lens = null;
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
    rift.shake = kill ? 16 : 11; hitstop = kill ? 0.32 : 0.12; if (flashGate()) rift.flash = kill ? 1 : 0.7;
    rift.novas.push({ x: x, y: y, t: 0, dur: kill ? 3.4 : 2.2, R: big, c1: dust(a.name), c2: dust(b.name) });
    rift.scorch.push({ x: x, y: y + 26, r: 30 * big, life: 1 });
    lens = { x: x, y: y, t: 0 };
    for (var i = 0; i < (kill ? 160 : 80); i++) {
      var sa = frand() * 6.283, sv = (40 + frand() * 200) * (kill ? 1.4 : 1);
      rift.parts.push({ x: x, y: y + 26, vx: Math.cos(sa) * sv, vy: Math.sin(sa) * sv * 0.6, life: 1 + frand() * 1.2, c: i % 3 ? dust(i % 2 ? a.name : b.name) : [255, 244, 220], drag: 0.94, size: frand() < 0.2 ? 3 : 2 });
    }
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    b.vx += dx / len * 220; b.vy += dy / len * 130; a.vx -= dx / len * 90; a.vy -= dy / len * 60;
    var others = ["dino", "future", "chaos"].filter(function (r2) { return r2 !== reality.cur; });
    shiftReality(others[(frand() * others.length) | 0], x, y);
    sfx("nova", x, y, { vol: kill ? 1.25 : 1 });
    if (kill) { b.alive = false; later(0.7, function () { sfx("nova", x, y, { vol: 0.7 }); }); }
  }
  function begin(att, tgt) {
    rift.act = { a: att, b: tgt, kind: att.style, t: 0, fx: att.x, fy: att.y, ang: Math.atan2(att.y - tgt.y, att.x - tgt.x), done: false };
    att.trail = [];
    if (att.style === "blink") sfx("whoosh", att.x, att.y); else sfx("dash", att.x, att.y);
  }
  function updateAct(dt) {
    var d = rift.act, a = d.a, b = d.b; d.t += dt;
    if (!a.alive || !b.alive) { rift.act = null; return; }
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
      if (frand() < dt * 30) rift.parts.push({ x: mx + (frand() - 0.5) * rr * 2, y: my + 26 + (frand() - 0.5) * rr, vx: 0, vy: 0, life: 0.8, c: dust(frand() < 0.5 ? a.name : b.name), swirl: 5, size: 2 });
      if (u >= 1) { nova(a, b, mx, my - 34); rift.act = null; }
    } else if (d.kind === "beam") {
      a.vx *= 0.85; a.vy *= 0.85; a.rage = Math.min(1, d.t / 0.8);
      if (d.t > 0.8 && !d.done) { d.done = true; d.beam = { t: 0 }; nova(a, b, b.x, b.y - b.z); }
      if (d.beam) { d.beam.t += dt; if (d.beam.t > 0.4) rift.act = null; }
    } else if (d.kind === "blink") {
      if (d.t < 0.35) { a.alpha = 1 - d.t / 0.35; if (frand() < dt * 60) rift.parts.push({ x: a.x + (frand() - 0.5) * 30, y: a.y + 26 + (frand() - 0.5) * 20, vx: 0, vy: 0, life: 0.5, c: dust(a.name), pull: a, size: 2 }); }
      else if (!d.moved) { d.moved = true; var ang = frand() * 6.283; a.x = b.x + Math.cos(ang) * 30; a.y = b.y + Math.sin(ang) * 16; a.vx = a.vy = 0; }
      else { a.alpha = Math.min(1, (d.t - 0.35) / 0.15); if (d.t > 0.55) { nova(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2 - 30); a.alpha = 1; rift.act = null; } }
    } else if (d.kind === "well") {
      var ddx = a.x - b.x, ddy = a.y - b.y, dist = Math.hypot(ddx, ddy) || 1;
      a.vx *= 0.8; a.vy *= 0.8; a.rage = 1;
      b.vx += ddx / dist * dt * (260 + d.t * 400); b.vy += ddy / dist * dt * (160 + d.t * 260);
      if (frand() < dt * 40) { var pa = frand() * 6.283, pr = 40 + frand() * 50; rift.parts.push({ x: a.x + Math.cos(pa) * pr, y: a.y + 26 + Math.sin(pa) * pr * 0.55, vx: 0, vy: 0, life: 1, c: [20, 8, 30], pull: a, swirl: 4, size: 2 }); }
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
    rift.parts = rift.parts.filter(function (p) { return p.life > 0; });
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
      var gx = (s.x - camX) * E, gy = (s.y - camY) * E, g0 = ctx.createRadialGradient(gx, gy, 0, gx, gy, s.r * E);
      g0.addColorStop(0, "rgba(8,2,2," + (0.7 * s.life).toFixed(3) + ")"); g0.addColorStop(0.6, "rgba(40,8,4," + (0.35 * s.life).toFixed(3) + ")"); g0.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g0; ctx.beginPath(); ctx.ellipse(gx, gy, s.r * E, s.r * E * 0.55, 0, 0, 6.283); ctx.fill();
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
      var wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      wg.addColorStop(0, "rgba(0,0,0,.95)"); wg.addColorStop(0.4, "rgba(10,0,16,.6)"); wg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wx, wy, wr, 0, 6.283); ctx.fill();
    }
    // each orb pools darkness around itself; motes fall into it; now and then a pair of red eyes
    list.forEach(function (o, oi) {
      var sx = (o.x - camX) * E, sy = (o.y - o.z - camY) * E, rr = OR * E * o.scale, rage = o.rage || 0.3;
      var ag = ctx.createRadialGradient(sx, sy, rr * 0.4, sx, sy, rr * (2.6 + rage));
      ag.addColorStop(0, "rgba(0,0,0," + (0.8 * o.alpha).toFixed(2) + ")"); ag.addColorStop(0.55, "rgba(" + (o.name === "void" || o.name === "eclipse" ? "40,0,20" : "10,6,20") + "," + (0.4 * o.alpha).toFixed(2) + ")"); ag.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ag; ctx.fillRect(sx - rr * 4, sy - rr * 4, rr * 8, rr * 8);
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
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * (1.6 + o.rage));
        g.addColorStop(0, "rgba(255,255,255," + (0.6 * Math.max(o.flash, o.rage * 0.4)).toFixed(3) + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(sx - rr * 3, sy - rr * 3, rr * 6, rr * 6);
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
        var bf = 1 - act.beam.t / 0.4, fl = 0.8 + Math.random() * 0.4;
        [[18, 0.18], [9, 0.4], [3, 0.95]].forEach(function (lw, i) { ctx.strokeStyle = i === 2 ? "rgba(255,255,255," + (lw[1] * bf).toFixed(3) + ")" : "rgba(" + dust(act.a.name).join(",") + "," + (lw[1] * bf).toFixed(3) + ")"; ctx.lineWidth = lw[0] * fl * E / 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx2, ty2); ctx.stroke(); });
      }
    }
    // the collisions: fields, not lines. a fireball swelling out of the impact, a band of
    // pressure rolling outward over the island, and at the heart, for a moment, a black hole
    (rift.novas || []).forEach(function (n) {
      var ix = (n.x - camX) * E, iy = (n.y - camY) * E, u = n.t / n.dur, e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3), fade = 1 - u;
      var Rf = (14 + e * 95) * n.R * E / 3 * 1.8;
      var fb = ctx.createRadialGradient(ix, iy, 0, ix, iy, Rf);
      fb.addColorStop(0, "rgba(" + (OPT.flash ? "255,255,255" : n.c1.join(",")) + "," + (Math.max(0, 1 - u * 1.6) * (OPT.flash ? 1 : 0.6)).toFixed(3) + ")");
      fb.addColorStop(0.22, "rgba(" + n.c1.join(",") + "," + (0.85 * fade).toFixed(3) + ")");
      fb.addColorStop(0.5, "rgba(" + n.c2.join(",") + "," + (0.55 * fade).toFixed(3) + ")");
      fb.addColorStop(0.78, "rgba(120,20,16," + (0.35 * fade).toFixed(3) + ")");
      fb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fb; ctx.beginPath(); ctx.arc(ix, iy, Rf, 0, 6.283); ctx.fill();
      for (var k3 = 0; k3 < 2; k3++) {                                          // the pressure fronts
        var su = Math.max(0, u - k3 * 0.12); if (su <= 0) continue;
        var Rs = (20 + (1 - Math.pow(1 - su, 2.2)) * 300 * n.R) * E / 3 * 1.6, band = Math.max(8, Rs * 0.28);
        var sg = ctx.createRadialGradient(ix, iy, Math.max(0, Rs - band), ix, iy, Rs + band * 0.3);
        sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(0.75, "rgba(" + (k3 ? n.c2 : [255, 236, 214]).join(",") + "," + (0.32 * (1 - su)).toFixed(3) + ")"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(ix, iy, Rs + band * 0.3, (Rs + band * 0.3) * 0.62, 0, 0, 6.283); ctx.fill();
      }
    });
    rift.parts.forEach(function (p) {
      ctx.fillStyle = "rgba(" + p.c.join(",") + "," + Math.min(1, p.life).toFixed(3) + ")";
      ctx.fillRect((p.x - camX) * E, (p.y - camY) * E, p.size || 2, p.size || 2);
    });
    if (rift.ring > 0) {
      var cx0 = (ARENA.x - camX) * E, cy0 = (ARENA.y - 34 - camY) * E, rad = (1 - rift.ring) * 320 + 20, rgd = ctx.createRadialGradient(cx0, cy0, Math.max(0, rad - 40), cx0, cy0, rad + 8);
      rgd.addColorStop(0, "rgba(0,0,0,0)"); rgd.addColorStop(0.8, "rgba(200,190,210," + (0.3 * rift.ring).toFixed(3) + ")"); rgd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rgd; ctx.beginPath(); ctx.ellipse(cx0, cy0, rad + 8, (rad + 8) * 0.6, 0, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    // black holes at the hearts of the fresh collisions, and the white-out
    (rift.novas || []).forEach(function (n) {
      var u = n.t / n.dur; if (u < 0.25 || u > 0.7) return;
      var ix = (n.x - camX) * E, iy = (n.y - camY) * E, br = Math.sin((u - 0.25) / 0.45 * Math.PI) * 10 * n.R * E / 3 * 1.8;
      var bh = ctx.createRadialGradient(ix, iy, 0, ix, iy, br * 2); bh.addColorStop(0, "rgba(0,0,0,.95)"); bh.addColorStop(0.5, "rgba(0,0,0,.7)"); bh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bh; ctx.beginPath(); ctx.arc(ix, iy, br * 2, 0, 6.283); ctx.fill();
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
        var tt = map[y][x], X = x * T, Y = y * T;
        if (!land(tt)) continue;
        g.fillStyle = "rgba(41,216,255,.08)"; g.fillRect(X, Y, T, 1); g.fillRect(X, Y, 1, T);
        if (tt === PATH || tt === BRIDGE) { g.fillStyle = "rgba(255,79,160,.55)"; if ((x + y) % 2) g.fillRect(X + 6, Y + 7, 4, 1); g.fillStyle = "rgba(41,216,255,.35)"; g.fillRect(X, Y, T, 1); continue; }
        var h = hash(x * 5, y * 7);
        if (h < 0.35) { g.fillStyle = "rgba(41,216,255,.45)"; if (h < 0.18) g.fillRect(X, Y + 8, T, 1); else g.fillRect(X + 8, Y, 1, T); g.fillStyle = "#c8fdff"; g.fillRect(X + 7, Y + 7, 2, 2); }
      }
    } else {
      c = mkCanvas(); c.width = ground.width; c.height = ground.height; g = c.getContext("2d");
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
      if (Math.random() < 0.04) invertFlash();
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
    var R = room, E = crisp(Math.max(2, Math.min(5, Math.floor(Math.min(W / (R.w * T + 40), H / (R.h * T + 60))))));
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
      if (Math.random() < dt * 3) sfx("warp");
      if (side.t > 4.2 && !side.done) { side.done = true; throwOut(); }
    }
  }
  function renderSide() {
    var E = crisp(Math.max(2, Math.min(5, Math.floor(Math.min(H / 190, W / 240))))), VW = W / E, VH = H / E;
    var cam = Math.max(0, Math.min(SIDEW - VW, side.x - VW * 0.4)), oy = Math.max(0, VH - 230) * 0.6;
    var shx = (Math.random() - 0.5) * shakeBy(quake), shy = (Math.random() - 0.5) * shakeBy(quake);
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
      var sz = R0 * 2 / 120 * 140, jx = (Math.random() - 0.5) * rage * 4, jy = (Math.random() - 0.5) * rage * 4;
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
      if (Math.random() < 0.2 + u * 0.35) invertFlash();
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
  function throwOut() {
    side = null; closeDialog();
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
      if (len) { pi.dir = my < -0.5 ? "up" : "down"; pi.view = Math.abs(mx) >= Math.abs(my) * 0.8 ? "side" : pi.dir; }
      if (pi.path && moved < 0.01) pi.path = null;   // stuck: give up
      footfall(moved);
    }
    // rex wanders the meadow
    rex.wait -= dt;
    if (rex.wait <= 0 && !rex.tx) {
      var tx = 38 + Math.floor(Math.random() * 12), ty = 60 + Math.floor(Math.random() * 3);
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
  function drawWaterfall(WF) {
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
    if (pi.kaiju) sfx("stomp", undefined, undefined, { vol: 0.18 });     // middle path is a little heavier than pi
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
    drawSkids();
  }
  function drawDust() {
    puffs.forEach(function (d) { ctx.fillStyle = "rgba(" + d.c + "," + Math.min(1, d.life * (d.leaf ? 1 : 0.6)).toFixed(3) + ")"; ctx.fillRect(Math.round(d.x), Math.round(d.y), d.leaf ? 2 : 1, d.leaf ? 1 : 1); });
  }

  /* ════════ the minimap: bottom right, click it to fold it away ════════ */
  var mini = mkCanvas(), MINI = 2, mapOn = OPT.map, mapRect = null;
  mini.width = MW * MINI; mini.height = MH * MINI;
  (function () { var g = mini.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(ground, 0, 0, mini.width, mini.height); g.drawImage(volc.canvas, (volc.ox) / T * MINI, (volc.oy) / T * MINI, volc.canvas.width / T * MINI, volc.canvas.height / T * MINI); })();
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
    FALLS.forEach(function (f) { list.push({ y: f.y + 30, f: function () { drawWaterfall(f); } }); });
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
    paintChip(); promptRect = null;
    if (side) { renderSide(); drawFade(); return; }
    if (room) { renderRoom(); drawFade(); return; }
    zoom += (zoomTo - zoom) * 0.08;
    var E = S * zoom, VW = W / E, VH = H / E;
    // the camera follows pi, except while the orbs fight: then it watches the arena
    // lead the camera a little in the direction of travel so you see where you're going
    var lvx = car.driving ? Math.sin(car.a) * car.v * 0.3 : aboard() ? heli.vx * 0.3 : pi.vx * 0.22, lvy = car.driving ? -Math.cos(car.a) * car.v * 0.3 : aboard() ? heli.vy * 0.3 : pi.vy * 0.22;
    var lk = car.driving || aboard() ? 30 : 14;
    look.x += (Math.max(-lk, Math.min(lk, lvx)) - look.x) * 0.03; look.y += (Math.max(-lk * 0.6, Math.min(lk * 0.6, lvy)) - look.y) * 0.03;
    var foc = cut ? cut : riftBusy() ? orbFocus() : null, fx = foc ? foc.x : pi.x + look.x, fy = foc ? foc.y : pi.y + look.y;
    if (camF.x === null) { camF.x = fx; camF.y = fy; }
    camF.x += (fx - camF.x) * 0.06; camF.y += (fy - camF.y) * 0.06;
    var sh = shakeBy((rift ? rift.shake : 0) + quake);
    camX = Math.max(0, Math.min(MW * T - VW, camF.x - VW / 2)) + (Math.random() - 0.5) * sh;
    camY = Math.max(0, Math.min(MH * T - VH, camF.y - VH / 2)) + (Math.random() - 0.5) * sh;
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
    drawMinimap();
    if (roarTag) tag("ROAR", (roarTag.x - camX) * E, (roarTag.y - camY) * E, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 16 - (aboard() ? heli.z + 10 : 0) - camY) * E - 6, false);
    drawFade();
  }
  function drawFade() { if (fade > 0) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "rgba(0,0,0," + fade.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); fade = Math.max(0, fade - 0.06); } }
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
    drawArt(piArt(moving ? "walk" : blink ? "blink" : "idle", fr, pi.dir === "up" && pi.view !== "side"), pi.x, pi.y + bob, pi.face < 0);
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
      + "particles " + particleCount() + "   novas " + (rift && rift.novas ? rift.novas.length : 0) + "\n"
      + "audio " + (au ? au.state + "   sources " + au.sources + "   voices " + au.voices + "   loops " + au.loops + "   mood " + (au.mood || "-") : "none") + "\n"
      + "dpr " + dpr + "   css " + W + "x" + H + "   backing " + cv.width + "x" + cv.height + "   scale " + S + "\n"
      + "canvases " + live.length + " live / " + CANVASES.length + " made   ~" + mb.toFixed(1) + " MB\n"
      + "save " + saveDump();
  }

  /* the simulation runs on a fixed 60 Hz step with an accumulator: a frame's time is clamped
     to 100 ms and at most five steps run per frame, so a long hitch (or a tab coming back from
     the background) can't make the car tunnel through a wall or a fight skip ahead */
  var STEP = 1 / 60, acc = 0, paused = false;
  function startLoop() { if (raf) cancelAnimationFrame(raf); last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function loop(now) {
    raf = 0;
    if (!open) return;
    var ms = now - last; last = now;
    if (!paused && !setOpen() && !creditsOpen()) {
      acc += Math.min(0.1, Math.max(0, ms / 1000));
      for (var n = 0; acc >= STEP && n < 5; n++) { t += STEP; update(STEP); acc -= STEP; }
      if (acc >= STEP) acc = 0;
    }
    render();
    if (DEBUG) drawDebug(ms);
    raf = requestAnimationFrame(loop);
  }
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
    if (act === "settings") toggleSettings(true); else if (act === "tour") startTour(); else if (act === "leave") exit();
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
    for (var i = 0; i < 260; i++) streaks.push({ a: Math.random() * 6.283, r: Math.random() * 40, v: 0.5 + Math.random(), c: Math.random() });
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
  var DEEP = { rack: "rack", homelab: "rack", dns: "rack", desk: "desk", triage: "desk", uplink: "uplink", aws: "uplink", terraform: "uplink", tower: "tower", monitoring: "tower",
               lighthouse: "lighthouse", experience: "lighthouse", macbook: "macbook", site: "macbook", tablet: "tablet", education: "tablet", mailbox: "mailbox", contact: "mailbox" };
  window.addEventListener("hashchange", function () { if (!open && location.hash.indexOf("#island") === 0) enter(); });
  var lastFocus = null;
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
      open = true; size(); bindSession();
      document.documentElement.classList.add("in-world");
      root.hidden = false; root.classList.add("show");
      var first = false;
      first = !save.hatched; save.hatched = true; writeSave();
      egg = first && !REDUCED ? { t: 0 } : null;
      pi.x = SPAWN.x; pi.y = SPAWN.y; pi.vx = pi.vy = 0; pi.path = null; keys = {};
      var lp = save.lastPos;                                            // back where pi left off
      if (!first && lp && walkable(Math.floor(lp[0] / T), Math.floor(lp[1] / T))) { pi.x = lp[0]; pi.y = lp[1]; }
      zoom = REDUCED ? 1 : 2.6; zoomTo = 1;
      if (!first) bubble = { text: "pi:~$ welcome back.", t: 2.5 };
      camF.x = null;
      var ruler = save.ruler;
      if (ruler && !rift && window.Orb) { rift = { phase: "reign", winner: ruler, t: 0, orbs: [rival(ruler, 0)], parts: [], shake: 0, dim: 0, ring: 0 }; var w0 = rift.orbs[0]; w0.x = ARENA.x; w0.y = ARENA.y; w0.z = 34; w0.scale = 1.7; paintFound(); }
      else if (!ruler && !rift && Object.keys(found).length === TOTAL) later(first ? 3 : 1.2, function () { if (!rift && dlg.hidden) askRift(); });
      startLoop();
      cv.focus({ preventScroll: true });
      var deep = (location.hash.match(/^#island\/([a-z-]+)/) || [])[1], lmk = deep && DEEP[deep];
      showCard(!deep && TOUCH);
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
    closeDialog(); if (termOpen) closeTerm();
    if (car.driving) toggleCar();
    if (aboard()) { heli.state = "parked"; heli.z = 0; heli.spin = 0; heli.x = HELI.x * T + 8; heli.y = HELI.y * T + 8; heli.a = 0; zoomTo = 1; }
    sfx("whoosh", undefined, undefined, { out: true }); stopSound();
    var finish = function () {
      paused = false; if (pauseEl) pauseEl.hidden = true; tour = null; paintTour(); if (credEl) credEl.hidden = true;
      open = false; exiting = false; stopLoop(); unbindSession();
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
