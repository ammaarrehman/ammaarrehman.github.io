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
  var DEEP = 0, SHAL = 1, SAND = 2, GRASS = 3, PATH = 4, POND = 5, DOCK = 6, LAVA = 7, PAD = 8;
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
  function land(t) { return t === GRASS || t === SAND || t === PATH || t === PAD; }
  function wet(t) { return t === DEEP || t === SHAL || t === POND; }
  // the koi pond: a wobbly blob (tile units). < 1 is water
  var KP = { x: 54.5, y: 35.5, rx: 5.2, ry: 2.3 };
  function pondF(fx, fy) {
    var dx = (fx - KP.x) / KP.rx, dy = (fy - KP.y) / KP.ry, a = Math.atan2(dy, dx);
    return Math.sqrt(dx * dx + dy * dy) / (1 + 0.13 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + 2.1) + 0.05 * Math.sin(7 * a));
  }
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] === GRASS && pondF(x + 0.5, y + 0.5) < 1) map[y][x] = POND;
  var dockY = CY; while (land(at(CX, dockY + 1))) dockY++;
  function seg(x0, y0, x1, y1) {
    var sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    for (;;) { if (land(at(x0, y0))) map[y0][x0] = PATH; if (x0 === x1 && y0 === y1) break; if (x0 !== x1) x0 += sx; else y0 += sy; }
  }
  function route(p) { for (var i = 0; i < p.length - 1; i++) seg(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); }
  for (y = 28; y <= 30; y++) for (x = 33; x <= 39; x++) if (land(at(x, y))) map[y][x] = PATH;   // plaza
  route([[36, 30], [36, dockY]]); route([[37, 30], [37, dockY]]);     // south to the dock
  route([[36, 28], [36, 16], [37, 16]]);                               // north: through the gate, up the stairs
  route([[39, 29], [62, 29]]);                                         // east to the lighthouse
  route([[33, 29], [16, 29]]);                                         // west to the uplink
  route([[26, 29], [26, 26]]);                                         // the desk
  route([[44, 29], [44, 26]]);                                         // the rack
  route([[46, 29], [46, 39], [48, 39]]);                               // the garden: pond, blanket, the M3
  route([[36, 37], [30, 37], [30, 41]]);                               // the helipad
  route([[37, 42], [41, 42]]);                                         // the tablet
  route([[36, dockY], [33, dockY]]);                                   // the mailbox
  for (y = dockY + 1; y <= dockY + 4; y++) { map[y][CX] = DOCK; map[y][CX + 1] = DOCK; }
  var HELI = { x: 29, y: 42 };                                         // the helipad, 3x3 tiles
  for (y = HELI.y - 1; y <= HELI.y + 1; y++) for (x = HELI.x - 1; x <= HELI.x + 1; x++) if (land(at(x, y))) map[y][x] = PAD;

  // height: a plateau across the north, a volcanic cone on top of it, lava in the crater
  var ELEV = [];
  for (y = 0; y < MH; y++) {
    ELEV.push([]);
    for (x = 0; x < MW; x++) {
      var tl = map[y][x], lv = 0;
      if (tl === GRASS || tl === PATH) {
        var hx = (x + 0.5 - 34) / 12.5, hy = (y + 0.5 - 14.2) / 5.6, ha = Math.atan2(hy, hx);
        var hw = 1 + 0.08 * Math.sin(3 * ha + 0.5) + 0.06 * Math.sin(5 * ha + 2);
        if (hx * hx + hy * hy < hw * hw) lv = 1;
        var px2 = (x + 0.5 - 33) / 6.5, py2 = (y + 0.5 - 11.8) / 3.1;
        if (lv && px2 * px2 + py2 * py2 < 1) lv = 2;
      }
      ELEV[y].push(lv);
    }
  }
  var VOLC = { x: 33, y: 11, rx: 2.6, ry: 1.15 };
  function craterF(fx, fy) { var a = (fx - VOLC.x) / VOLC.rx, b = (fy - VOLC.y) / VOLC.ry; return Math.sqrt(a * a + b * b); }
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (ELEV[y][x] === 2 && craterF(x + 0.5, y + 0.5) < 1) map[y][x] = LAVA;
  function lvl(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? 0 : ELEV[y][x]; }
  function rim(x, y) { var l = lvl(x, y); return lvl(x + 1, y) !== l || lvl(x - 1, y) !== l || lvl(x, y + 1) !== l || lvl(x, y - 1) !== l; }

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", x: 32, y: 27, name: "signpost", text: "pi's jurassic island. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. find all eight and something on the island wakes up. the boat at the dock takes you back. (the paddocks are fenced. please don't feed the raptors.)" },
    { id: "rack", x: 44, y: 25, name: "the rack", found: true, text: "the homelab. two Raspberry Pi 5 nodes run AdGuard Home and Unbound behind a keepalived floating IP. pull the plug on one and DNS keeps answering from the other within seconds. failover tested in both directions, config synced every 10 minutes.", links: [["ha-dns repo ↗", GH + "homelab/tree/main/ha-dns"]] },
    { id: "desk", x: 26, y: 25, name: "the desk", found: true, wide: true, text: "a Claude intake triage assistant. messy free-text help requests go in; structured records come out with category, urgency, summary, next step, and a human-review flag. a 15-case eval harness took classification accuracy to 100%.", links: [["repo ↗", GH + "claude-intake-triage"], ["demo ↗", "https://www.loom.com/share/c43efcd9c3314bcd9cda3002282d31a5"]] },
    { id: "uplink", x: 15, y: 28, name: "the uplink", found: true, text: "an AWS static site built end to end with Terraform: S3 hosting, CloudFront delivery, Route 53 DNS, IAM access controls. one command up, one command down. Ammaar is an AWS Certified Cloud Practitioner.", links: [["terraform repo ↗", GH + "homelab/tree/main/terraform-aws-static-site"]] },
    { id: "tower", x: 38, y: 16, name: "the watchtower", found: true, text: "the monitoring stack. Prometheus and Grafana watch every host and container in the lab through node-exporter and cAdvisor, and Uptime Kuma pings every service. from up here you can see the whole island, and the volcano is still warm.", links: [["monitoring ↗", GH + "homelab/tree/main/monitoring-stack"], ["uptime ↗", GH + "homelab/tree/main/uptime-monitoring"]] },
    { id: "lighthouse", x: 63, y: 28, name: "the lighthouse", found: true, text: "the security work. Ammaar is a cyber security analyst in Cyber Ready Clinic's internship cohort, supporting nonprofit cyber-readiness assessments with the Discover5 and Ready5 frameworks, with findings aligned to the NIST CSF and CIS Controls. the Ready5 Practitioner badge is in progress, expected Nov 2026.", links: [["experience", "#experience"]] },
    { id: "macbook", x: 49, y: 38, name: "a macbook on a blanket", found: true, text: "this website. hand-rolled HTML, CSS, JavaScript and a little Python, no frameworks. the orb, the hands, and this island are all drawn in plain canvas. you're standing in it.", links: [["site repo ↗", GH + "ammaarrehman.github.io"]] },
    { id: "tablet", x: 42, y: 41, name: "a stone tablet", found: true, text: "the record. Howard Community College, A.A. through Dec 2026, 3.65 GPA, Dean's List. starting at UMD's Smith School, B.S. Information Systems, in Jan 2027. AWS Certified Cloud Practitioner, CompTIA Tech+. FBLA State and Regional Champion.", links: [["education", "#education"]] },
    { id: "mailbox", x: 33, y: dockY - 1, name: "the mailbox", found: true, text: "ammaarrehmanf@gmail.com. email is the fastest way to reach Ammaar.", links: [["email ↗", "mailto:ammaarrehmanf@gmail.com"], ["linkedin ↗", "https://www.linkedin.com/in/ammaarrehman/"]] },
    { id: "drink", x: 40, y: 31, name: "a drink stand", text: "pi takes a sip. zoom mode for ten seconds." },
    { id: "cave", x: 29, y: 14, name: "a cave in the cliff", text: "there's a terminal in here, still humming. someone left it logged in." },
    { id: "boat", x: 38, y: dockY + 3, name: "the boat", text: "the boat back to the mainland. sail back to the site?", links: [["sail back ↩", "#exit"]] }
  ];
  var TOTAL = STATIONS.filter(function (s) { return s.found; }).length;
  var found = {};
  try { (JSON.parse(sessionStorage.getItem("pi-found") || "[]")).forEach(function (k) { found[k] = 1; }); } catch (e) {}

  /* ════════ collision ════════ */
  var solid = {}, fence = {};
  function k(x, y) { return x + "," + y; }
  STATIONS.forEach(function (s) {
    if (s.id === "boat") return;
    solid[k(s.x, s.y)] = 1;
    if (s.wide) { solid[k(s.x - 1, s.y)] = 1; solid[k(s.x + 1, s.y)] = 1; }
  });
  function nearStation(x, y) {
    for (var i = 0; i < STATIONS.length; i++) { var s = STATIONS[i]; if (Math.abs(s.x - x) <= 1 && y >= s.y - 2 && y <= s.y + 1) return true; }
    return false;
  }
  function near(x, y, r, fn) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (fn(x + i, y + j)) return true; return false; }
  // cliffs: tiles where the ground changes level can't be walked, except where a path makes stairs
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] !== PATH && (map[y][x] === GRASS || map[y][x] === SAND) && rim(x, y)) solid[k(x, y)] = 1;
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
  // open ground kept clear of trees so the herds have room to roam
  var CLEAR = [[19, 21, 4.5], [44, 42, 5], [36, 29, 5], [51, 39, 3], [29, 42, 3], [20, 36, 3], [44, 34, 2.6]];
  function clearing(x, y) { return CLEAR.some(function (c) { return Math.hypot(x - c[0], y - c[1]) < c[2]; }); }
  var props = [];     // trees, palms, ferns, rocks, nests: static, y-sorted with everything else
  function busy(a, b) { var q = at(a, b); return q === PATH || q === POND || q === PAD || q === DOCK || q === LAVA || fence[k(a, b)] || nearStation(a, b) || Math.abs(a - GATE.x) <= 3 && Math.abs(b - GATE.y) <= 1; }
  for (y = 1; y < MH - 1; y++) for (x = 1; x < MW - 1; x++) {
    var t = map[y][x], h = hash(x, y);
    if (t === GRASS && ELEV[y][x] === 2) continue;         // nothing grows on the volcano's cone
    if (t === GRASS && !solid[k(x, y)]) {
      // the jungle: thick where the noise says so, thickest to the west and on the plateau
      var J = (Math.sin(x * 0.31 + 1) + Math.sin(y * 0.37 + 2) + Math.sin((x + y) * 0.23 + 0.5) + Math.sin((x - y) * 0.17)) / 4 + (x < 30 ? 0.12 : 0) + (ELEV[y][x] ? 0.15 : 0);
      var dense = J > 0.22 ? 0.62 : 0.05;
      if (inPaddock(x, y)) dense *= 0.35;
      if (!clearing(x, y) && h < dense && !near(x, y, 1, busy)) {
        var kind = h < dense * 0.16 ? "jtree" : h < dense * 0.4 ? "tree" : h < dense * 0.6 ? "tree2" : h < dense * 0.8 ? "tfern" : "palm";
        if (kind === "jtree" && near(x, y, 1, function (a, b) { return solid[k(a, b)]; })) kind = "tree";
        props.push({ kind: kind, tx: x, ty: y, flip: hash(y, x) < 0.5 }); solid[k(x, y)] = 1;
      } else if (hash(x * 7, y * 13) < (J > 0.1 ? 0.11 : 0.035) && !busy(x, y)) {
        props.push({ kind: hash(x * 3, y) < 0.6 ? "fern" : "cycad", tx: x, ty: y, flip: hash(y, x) < 0.5 });   // pi walks behind these
      }
    } else if (t === SAND && h < 0.11 && !solid[k(x, y)]) {
      if (near(x, y, 1, function (a, b) { return busy(a, b) || solid[k(a, b)]; })) continue;
      props.push({ kind: "palm", tx: x, ty: y, flip: h < 0.055 }); solid[k(x, y)] = 1;
    } else if (t === SHAL && h < 0.02 && Math.abs(x - CX) > 3) {
      props.push({ kind: "rock", tx: x, ty: y });
    }
  }
  // nests in the meadow, each with a clutch of speckled eggs
  var nests = [[42, 44], [47, 43], [21, 23], [19, 37]].filter(function (n) { return walkable0(n[0], n[1]); }).map(function (n) {
    solid[k(n[0], n[1])] = 1; var p = { kind: "nest", tx: n[0], ty: n[1], eggs: 2 + ((hash(n[0], n[1]) * 3) | 0) }; props.push(p); return p;
  });
  function walkable0(x, y) { return land(at(x, y)) && at(x, y) !== PATH && !solid[k(x, y)]; }
  [[32, 31], [40, 27], [34, 27], [35, dockY - 1], [38, dockY - 1]].forEach(function (l) {
    if (land(at(l[0], l[1])) && at(l[0], l[1]) !== PATH && !solid[k(l[0], l[1])]) { props.push({ kind: "lamp", tx: l[0], ty: l[1] }); solid[k(l[0], l[1])] = 1; }
  });
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
    SPR[k] = outline(SPR[k], /tree|fern|palm|cycad/.test(k) ? "rgba(10,28,16,.9)" : k === "cave" ? "rgba(0,0,0,0)" : "rgba(18,18,20,.88)");
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
        if (t === PATH) {
          // jeep ruts along the road
          var vert = at(tx, ty - 1) === PATH || at(tx, ty + 1) === PATH, horiz = at(tx - 1, ty) === PATH || at(tx + 1, ty) === PATH;
          for (j = 0; j < T; j++) {
            if (vert && !(horiz && ty >= 28 && ty <= 30)) { if (hash(tx * 16 + j, ty) < 0.8) { r(X + 4, Y + j, 1, 1, COL.path2); r(X + 11, Y + j, 1, 1, COL.path2); } }
            else if (horiz) { if (hash(tx, ty * 16 + j) < 0.8) { r(X + j, Y + 4, 1, 1, COL.path2); r(X + j, Y + 11, 1, 1, COL.path2); } }
          }
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
      } else if (t === GRASS && ELEV[ty][tx] === 2) {
        // the volcano's cone: ash and rock in ridges that run down from the crater, lit from the
        // upper left, with old lava channels cooling on the south slope
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var qx = (X + i + 1) / T - VOLC.x, qy = ((Y + j + 1) / T - VOLC.y) * 2.2, qa = Math.atan2(qy, qx), qd = Math.hypot(qx, qy);
          var ridge = Math.sin(qa * 11 + Math.sin(qd * 1.3) * 0.8), cv = 0.95 - qd * 0.1 - Math.max(0, ridge) * 0.26 + Math.min(0, ridge) * -0.1 - (qx + qy) * 0.04;
          cv += (hash(tx * 8 + i, ty * 8 + j) - 0.5) * 0.2;
          var chan = Math.abs(Math.sin(qa * 3 + 0.9)) < 0.07 && qy > 0 && qd < 5;
          g.fillStyle = chan ? (hash(X + i, Y + j) < 0.5 ? "#7a2a10" : "#4a1c0c") : tone(cv, ASH, X + i, Y + j); g.fillRect(X + i, Y + j, 2, 2);
        }
        if (hash(tx * 13, ty * 7) < 0.3) { r(X + 3 + ((hash(tx, ty) * 8) | 0), Y + 5, 4, 3, "#2a231e"); r(X + 3 + ((hash(tx, ty) * 8) | 0), Y + 5, 3, 1, "#6d6054"); }
      } else if (t === GRASS) {
        // grass in soft tonal patches, darker and lusher under the jungle, brighter up high
        var patch = (Math.sin(tx * 0.35) + Math.sin(ty * 0.41 + 1) + Math.sin((tx - ty) * 0.23 + 2)) / 3, jg = jungle(tx, ty);
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var gv = 0.52 + patch * 0.35 + (hash(tx * 8 + i, ty * 8 + j) - 0.5) * 0.25 + ELEV[ty][tx] * 0.22 - (jg > 0.22 ? 0.22 : 0);
          g.fillStyle = tone(gv, GRASS_T, X + i, Y + j); g.fillRect(X + i, Y + j, 2, 2);
        }
        for (i = 0; i < 7; i++) { hh = hash(tx * 5 + i, ty * 9); r(X + ((hh * 15) | 0), Y + ((hash(ty * 7 + i, tx * 2) * 14) | 0), 1, 2, hh < 0.5 ? COL.grass2 : COL.grass3); }
        hh = hash(tx * 31, ty * 17);
        if (hh < 0.05) { var fc = ["#ff8fb1", "#ffe066", "#ffffff", "#ff7a3a"][(hh * 80 | 0) % 4]; r(X + 6, Y + 6, 1, 1, fc); r(X + 5, Y + 7, 3, 1, fc); r(X + 6, Y + 8, 1, 1, fc); r(X + 6, Y + 7, 1, 1, "#ffcf33"); }
        else if (hh < 0.16) { r(X + 4, Y + 9, 1, 3, COL.grass2); r(X + 6, Y + 8, 1, 4, COL.grass2); r(X + 8, Y + 9, 1, 3, COL.grass2); }
      } else if (t === POND) {
        r(X, Y, T, T, "#4f9a3e");                          // grass under the pond; the water is drawn per pixel below
      } else if (t === LAVA) {
        r(X, Y, T, T, "#2a120a");                          // the live lava is drawn every frame
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

    // the crater: a basalt lip around the lava, cracked and glowing at the edge
    for (py = Math.floor((VOLC.y - 2.5) * T); py < (VOLC.y + 2.5) * T; py++) for (px = Math.floor((VOLC.x - 4) * T); px < (VOLC.x + 4) * T; px++) {
      var cf = craterF((px + 0.5) / T, (py + 0.5) / T);
      if (cf >= 1 && cf < 1.32) { g.fillStyle = tone(0.2 + (cf - 1) * 1.6 + (hash(px >> 1, py >> 1) - 0.5) * 0.3, ["#140c08", "#231812", "#35271e", "#4a3a2e"], px, py); g.fillRect(px, py, 1, 1); }
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
    var ROCK = ["#5c4632", "#7a5f45", "#957658", "#b3936f"], BASALT = ["#231c18", "#352b25", "#4a3d34", "#615145"];
    for (var cy2 = 1; cy2 < MH; cy2++) for (var cx2 = 0; cx2 < MW; cx2++) {
      var X2 = cx2 * T, Y2 = cy2 * T, L0 = lvl(cx2, cy2), Lup = lvl(cx2, cy2 - 1);
      var isPath = map[cy2][cx2] === PATH, upPath = map[cy2 - 1][cx2] === PATH, RK = Lup === 2 ? BASALT : ROCK;
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
          r(X2, Y2, T, 1, Lup === 2 ? "#6d6054" : "#76c25c");  // the lip hangs over the edge
          if (Lup !== 2) for (var lp = 0; lp < T; lp += 2) if (hash(cx2 * 16 + lp, cy2) < 0.5) r(X2 + lp, Y2 + 1, 2, 1, "#5aa846");
          if (Lup !== 2 && hash(cx2, cy2 * 3) < 0.5) for (var vn = 0; vn < 6 + hash(cy2, cx2) * 4; vn++) r(X2 + 3 + ((hash(cx2, 9) * 9) | 0), Y2 + 1 + vn, 1, 1, vn % 2 ? "#2f6f2c" : "#4f9a3e");   // a hanging vine
          r(X2, Y2 + fh, T, 3, "rgba(0,0,0,.22)");            // cast shadow at the foot
        }
      }
      if (lvl(cx2 - 1, cy2) > L0 && !isPath) { r(X2, Y2, 3, T, RK[1]); r(X2, Y2, 1, T, RK[0]); r(X2 + 3, Y2, 2, T, "rgba(0,0,0,.15)"); }
      if (lvl(cx2 + 1, cy2) > L0 && !isPath) { r(X2 + T - 3, Y2, 3, T, RK[1]); r(X2 + T - 1, Y2, 1, T, RK[0]); r(X2 + T - 5, Y2, 2, T, "rgba(0,0,0,.15)"); }
      if (L0 > Lup && !isPath) r(X2, Y2, T, 1, "rgba(255,255,255,.18)");   // back edge of a raised tile
    }
  })();

  /* ════════ actors ════════ */
  var FRAMES = {
    idle:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."],
    walk1: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..",".WW....WW.",".GG....GG."],
    walk2: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","...WWWW...","...GGGG..."],
    back:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG.."]
  };
  var PIPAL = { W: "#f4f4f4", G: "#a9a9a9", K: "#141414" };
  var DINO = {
    a: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...W..W....","...W...W..."],
    b: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...WW.W....","....W..W..."]
  };
  function pix(f, flip, ox, oy, pal, w) {
    for (var yy = 0; yy < f.length; yy++) for (var xx = 0; xx < w; xx++) {
      var c = f[yy][flip ? w - 1 - xx : xx];
      if (c !== ".") { ctx.fillStyle = pal[c] || pal.W; ctx.fillRect(ox + xx, oy + yy, 1, 1); }
    }
  }
  function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x - w / 2 + 1, y - 1, w - 2, 1); ctx.fillRect(x - w / 2, y, w, 2); ctx.fillRect(x - w / 2 + 1, y + 2, w - 2, 1); }

  var SPAWN = { x: 36 * T + 8, y: 29 * T + 12 };
  var pi = { x: SPAWN.x, y: SPAWN.y, face: 1, dir: "down", dist: 0, boost: 0, path: null, want: null, hop: 0 };
  var rex = { x: 31 * T + 8, y: 33 * T + 10, tx: 0, ty: 0, face: -1, wait: 1, dist: 0, hop: 0, vy: 0 };
  var ptero = { on: false, x: 0, y: 0, vx: 0, next: 4 };
  var clouds = [0, 1, 2].map(function (i) { return { x: hash(i, 9) * MW * T, y: hash(9, i) * MH * T, w: 90 + i * 30, v: 5 + i * 2 }; });
  var egg = null;          // { t } while pi is hatching
  var bubble = null;       // { text, t } speech over pi

  /* ════════ view ════════ */
  var W = 0, H = 0, dpr = 1, S = 3, zoom = 1, zoomTo = 1, camX = 0, camY = 0, camF = { x: null, y: null };
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    S = Math.max(2, Math.min(5, Math.floor(Math.min(W / 300, H / 190))));
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
    if (car.driving && e.key === " ") { e.preventDefault(); bubble = { text: "beep beep", t: 1 }; return; }
    if (e.key === "Escape") { e.preventDefault(); if (!dlg.hidden) closeDialog(); else exit(); return; }
    if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "A") return;   // let links work
      e.preventDefault();
      if (egg) { egg.t = 99; return; }
      if (riftBusy()) return;
      if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
      var s = nearby(); if (s) interact(s);
    }
  });
  window.addEventListener("keyup", function (e) { var d = dirKey(e); if (d) keys[d] = 0; });
  window.addEventListener("blur", function () { keys = {}; });

  cv.addEventListener("pointerdown", function (e) {
    if (!open || termOpen) return;
    if (egg) { egg.t = 99; return; }
    if (riftBusy()) return;
    if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
    var E = S * zoom, wx = camX + e.clientX / E, wy = camY + e.clientY / E;
    var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (car.driving) { car.target = { x: wx, y: wy }; return; }
    if (heli.state === "flying") { if (Math.hypot(wx - heli.x, wy - heli.y + heli.z) < 16) toggleHeli(); else heli.target = { x: wx, y: wy }; return; }
    if (aboard()) return;
    // tapped a landmark (its sprite reaches up a couple of tiles)? walk up to it
    var hit = STATIONS.filter(function (s) { return Math.abs(tx - s.x) <= (s.wide ? 1 : 0) && ty <= s.y && ty >= s.y - 2; })[0];
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
    if (s.id === "heli") { toggleHeli(); return; }
    if (s.id === "car") { toggleCar(); bubble = { text: "pi:~$ vroom. arrows drive, space honks, e parks", t: 3.5 }; return; }
    if (s.id === "critter" || s.id === "bird" || s.id === "pond" || s.id === "nest" || s.id === "fence") { sayLocal(s); return; }
    if (s.id === "drink") pi.boost = 10;
    if (s.found && !found[s.id]) {
      found[s.id] = 1; paintFound();
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
      else if (l[1] === "#drive") a.addEventListener("click", function (e) { e.preventDefault(); closeDialog(); if (!car.driving) toggleCar(); });
      else a.addEventListener("click", function (e) { e.preventDefault(); exit(l[1] === "#exit" ? null : l[1]); });
      dLinks.appendChild(a);
    });
    full = text; dText.textContent = "";
    if (REDUCED) { dText.textContent = full; typing = null; return; }
    var i = 0;
    clearInterval(typing);
    typing = setInterval(function () { i += 2; dText.textContent = full.slice(0, i); if (i >= full.length) finishTyping(); }, 16);
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
    var c = frameCanvas(rows, pal, w), dx = Math.round(x - c.width / 2), dy = Math.round(y - c.height + 1);
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
  function shapeArt(w, h, pal, draw, fr) {
    var kind = [], i;
    for (i = 0; i < w * h; i++) kind.push(null);
    var sc = document.createElement("canvas"); sc.width = w; sc.height = h; var sg = sc.getContext("2d");
    function stamp(key, fn) {
      sg.clearRect(0, 0, w, h); sg.fillStyle = "#fff"; sg.beginPath(); fn(sg); sg.fill();
      var d = sg.getImageData(0, 0, w, h).data;
      for (var i = 0; i < w * h; i++) if (d[i * 4 + 3] > 118) kind[i] = key;
    }
    var a = {
      ell: function (key, x, y, rx, ry, rot) { stamp(key, function (g) { g.ellipse(x, y, rx, ry, rot || 0, 0, 6.283); }); },
      poly: function (key, pts) { stamp(key, function (g) { pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); }); },
      tube: function (key, pts, r0, r1) { stamp(key, function (g) { for (var i = 0; i <= 32; i++) { var u = i / 32, p = bez(pts, u), rr = Math.max(0.55, r0 + (r1 - r0) * u); g.moveTo(p[0] + rr, p[1]); g.arc(p[0], p[1], rr, 0, 6.283); } }); },
      px: function (key, x, y, pw, ph) { for (var yy = y; yy < y + (ph || 1); yy++) for (var xx = x; xx < x + (pw || 1); xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) kind[yy * w + xx] = key; }
    };
    draw(a, fr);
    function K(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? null : kind[y * w + x]; }
    var out = document.createElement("canvas"); out.width = w; out.height = h; var og = out.getContext("2d");
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var q = K(x, y); if (!q) continue;
      if (q === "K") og.fillStyle = "#0b0908";
      else if (q === "W") og.fillStyle = "#f4efe2";
      else if (q === "H") og.fillStyle = K(x, y - 1) && K(x, y - 1) !== "H" ? pal.H[0] : pal.H[1];
      else {
        var up = 0, dn = 0; while (K(x, y - up - 1)) up++; while (K(x, y + dn + 1)) dn++;
        var ramp = q === "L" ? pal.L : q === "A" ? pal.A : pal.B;
        var v = 0.28 + 0.58 * (dn + 0.5) / (up + dn + 1);
        if (!K(x, y - 1)) v += 0.22;
        if (!K(x - 1, y)) v += 0.06; if (!K(x + 1, y)) v -= 0.06;
        if (!K(x, y + 1)) v -= 0.1;
        if (q === "F") v -= 0.36;
        if (q === "B" && pal.spots && hash(((x + (pal.seed || 0)) >> 1) * 3, (y >> 1) * 5 + (pal.seed || 0)) < pal.spots) v += pal.spotV || -0.28;
        v += (hash(x * 7 + (pal.seed || 0), y * 3) - 0.5) * 0.12;
        og.fillStyle = tone(v, ramp, x, y);
      }
      og.fillRect(x, y, 1, 1);
    }
    return outline(out, pal.o || "rgba(20,12,8,.92)");
  }
  var ART = {
    brachio: { w: 42, h: 47, pal: { B: ["#3f4a14", "#58661c", "#768a26", "#96aa36", "#b8c858"], L: ["#8a9058", "#a9ae76", "#cacd98"], spots: 0.14, spotV: -0.3, seed: 11 },
      draw: function (a, f) {
        var s = f ? 1.5 : -1.5;
        a.tube("F", [[28, 33], [28 - s, 46]], 2.6, 2.2); a.tube("F", [[12, 34], [12 + s, 46]], 2.8, 2.3);
        a.tube("B", [[9, 31], [2, 33], [1, 41]], 4.2, 0.8);
        a.ell("B", 18, 31, 12.5, 7.5, -0.12);
        a.tube("B", [[25, 28], [32, 20], [32.5, 7]], 4.6, 2.6);
        a.ell("B", 34.5, 5.5, 4.4, 2.8, 0.15); a.tube("B", [[36, 6], [40, 7.5]], 2.1, 1.4);
        a.tube("L", [[28, 30], [34.3, 20], [35, 9]], 1.3, 0.9);
        a.ell("L", 18, 36.5, 9, 2.2);
        a.tube("B", [[25, 34], [25 + s, 46]], 3.1, 2.6); a.tube("B", [[10, 35], [10 - s, 46]], 3.3, 2.7);
        a.px("K", 35, 4); a.px("K", 39, 8);
      } },
    trex: { w: 33, h: 29, pal: { B: ["#132f1a", "#1d4a24", "#28662e", "#3c8a3a", "#5eac50"], L: ["#6f9a52", "#94b86e", "#bcd694"], H: ["#d2cbb6", "#f4efe0"], spots: 0.06, spotV: -0.25, seed: 23 },
      draw: function (a, f) {
        var s = f ? 2 : -2;
        a.tube("F", [[15, 18], [17 - s * 0.5, 23], [16 - s, 27.5]], 2.6, 1.8); a.poly("F", [[13 - s, 26.5], [19 - s, 26.5], [19 - s, 29], [13 - s, 29]]);
        a.tube("B", [[10, 13], [4, 11], [0, 14]], 4.4, 0.8);
        a.ell("B", 15, 14, 7.8, 5.6, -0.35);
        a.tube("B", [[19, 11], [22, 7]], 4.2, 3.8);
        a.poly("B", [[19, 2], [27, 1.5], [30.5, 4], [31.5, 8.5], [26, 9.5], [20, 9.5]]);
        a.poly("B", [[21, 9.5], [30.5, 9.5], [29.5, 12], [22, 13]]);
        a.tube("L", [[19, 17], [15, 19.6], [10, 18]], 1.6, 1.1); a.tube("L", [[22, 13], [20, 15.5]], 1.4, 1.2);
        a.tube("B", [[21, 15], [23.5, 17], [24.5, 16]], 1.1, 0.8);
        a.ell("B", 13, 17.5, 4.6, 5.2, 0.3); a.tube("B", [[13, 20], [11 + s * 0.5, 24], [13 + s, 27.5]], 2.8, 2);
        a.poly("B", [[10 + s, 26.5], [17 + s, 26.5], [17 + s, 29], [10 + s, 29]]);
        a.px("K", 22, 9, 8, 1); a.px("H", 23, 10); a.px("H", 25, 10); a.px("H", 27, 10); a.px("H", 29, 10);
        a.px("K", 25, 4); a.px("K", 24, 3, 3, 1);
      } },
    stego: { w: 37, h: 23, pal: { B: ["#111c36", "#1b2c52", "#28416f", "#3c5c93", "#5d80b6"], A: ["#8a2f10", "#c0501f", "#e67a32", "#f7a95e"], L: ["#50627e", "#71849f", "#98abc4"], H: ["#cfc6ae", "#efe8d6"], spots: 0.09, spotV: 0.3, seed: 37 },
      draw: function (a, f) {
        var s = f ? 1.3 : -1.3;
        for (var i = 0; i < 7; i++) {
          var px = 9 + i * 3, top = 13 - 6.5 * Math.sqrt(Math.max(0, 1 - Math.pow((px - 18) / 11, 2))), sz = 2 + 3.4 * Math.sin(Math.PI * (i + 0.5) / 7);
          a.poly("A", [[px - 2.2, top + 2], [px + (i % 2 ? 0.5 : -0.5), top - sz - 1], [px + 2.2, top + 2]]);
        }
        a.tube("F", [[23, 15], [23 + s, 22]], 2.2, 1.8); a.tube("F", [[12, 15], [12 - s, 22]], 2.4, 2);
        a.tube("B", [[8, 12], [3, 13], [0.5, 16]], 3.6, 1);
        a.tube("H", [[2, 14.5], [0, 10.5]], 0.7, 0.4); a.tube("H", [[4, 13.5], [3, 9.5]], 0.7, 0.4);
        a.ell("B", 18, 13, 11, 6.5);
        a.tube("B", [[27, 13], [31, 16]], 3.2, 2.2); a.ell("B", 32.5, 16.5, 3.1, 2.1);
        a.ell("L", 18, 17.2, 8, 1.8);
        a.tube("B", [[24, 16], [24 - s, 22]], 2.6, 2.2); a.tube("B", [[12, 16], [12 + s, 22]], 2.8, 2.3);
        a.px("K", 33, 16);
      } },
    trike: { w: 33, h: 21, pal: { B: ["#5a2c12", "#7e3e1a", "#a3582a", "#c77b3b", "#e3a064"], A: ["#6a2a1e", "#9a3f2a", "#c65c3c", "#e88a5c"], L: ["#c9a27a", "#e0bf96", "#f2dcb8"], H: ["#cfc3a4", "#f5eedc"], seed: 41 },
      draw: function (a, f) {
        var s = f ? 1.2 : -1.2;
        a.tube("F", [[21, 13], [21 + s, 20]], 2.4, 2); a.tube("F", [[9, 13], [9 - s, 20]], 2.6, 2.2);
        a.tube("B", [[5, 10], [0.5, 12.5]], 3.1, 1);
        a.ell("B", 14, 10.5, 10, 6.2);
        a.ell("A", 23.5, 8.5, 4, 6.8, 0.25);
        a.poly("B", [[21, 6], [27, 9], [30.5, 12], [28.5, 15.5], [22, 15.5], [20, 11]]);
        a.poly("B", [[28, 12], [32, 13.5], [29.5, 15.5]]);
        a.tube("H", [[24.5, 7.5], [30, 2]], 1.1, 0.4); a.tube("H", [[26.5, 8.5], [31.5, 4.5]], 1, 0.4); a.tube("H", [[28.5, 11], [30.5, 8.5]], 0.9, 0.4);
        a.ell("L", 14, 14.5, 7, 1.8);
        a.tube("B", [[20, 14], [20 - s, 20]], 2.8, 2.4); a.tube("B", [[9, 14], [9 + s, 20]], 3, 2.5);
        a.px("K", 25, 10);
      } },
    para: { w: 30, h: 26, pal: { B: ["#6a3f18", "#8f5a26", "#b37a36", "#d49a52", "#ecc27e"], A: ["#7a2412", "#a8381a", "#d45a2a", "#f08a4a"], L: ["#d8b88a", "#ecd2a8", "#f8e8cc"], spots: 0.12, spotV: -0.25, seed: 53 },
      draw: function (a, f) {
        var s = f ? 1.8 : -1.8;
        a.tube("F", [[14, 15], [15 - s, 20.5], [14 - s, 24.5]], 2.4, 1.6); a.poly("F", [[11 - s, 24], [17 - s, 24], [17 - s, 26], [11 - s, 26]]);
        a.tube("B", [[9, 13], [4, 14], [0.5, 17.5]], 3.5, 0.8);
        a.ell("B", 15, 13.5, 7.5, 5.2, -0.25);
        a.tube("B", [[19, 11], [22, 6]], 3, 2.4);
        a.ell("B", 23.5, 5.2, 3.1, 2.2); a.tube("B", [[24, 6], [29, 7.2]], 1.8, 1.3);
        a.tube("A", [[22, 4], [18, 1.6], [13.5, 1.2]], 1.7, 1.1);
        a.tube("B", [[19, 14.5], [21, 17.5]], 1, 0.7);
        a.tube("L", [[19, 16.5], [15, 18.6], [10, 16.5]], 1.5, 1); a.tube("L", [[22, 8], [20, 11]], 1, 1);
        a.ell("B", 14, 16.5, 3.8, 4.5); a.tube("B", [[14, 19.5], [13 + s, 24.5]], 2.2, 1.6); a.poly("B", [[10 + s, 24], [16 + s, 24], [16 + s, 26], [10 + s, 26]]);
        a.px("K", 24, 4);
      } },
    raptor: { w: 25, h: 16, pal: { B: ["#34100c", "#4f1d16", "#6d2c20", "#8e402e", "#ae5c3c"], L: ["#b89468", "#d6b486", "#eed4aa"], H: ["#d0c8b4", "#f0ead8"], spots: 0.16, spotV: -0.25, seed: 67 },
      draw: function (a, f) {
        var s = f ? 2.3 : -2.3;
        a.tube("F", [[11, 8], [12 - s, 11.5], [11 - s, 15]], 1.6, 1); a.px("F", Math.round(9 - s), 15, 4, 1);
        a.tube("B", [[7, 6.5], [2.5, 5.2], [0.5, 4.5]], 2.3, 0.9);
        a.ell("B", 11, 7.2, 5, 3, -0.1);
        a.tube("B", [[14.5, 6], [17.5, 3]], 2, 1.7);
        a.poly("B", [[16.5, 0.8], [20.5, 1.2], [24, 3], [23, 4.8], [17.5, 5.2]]);
        a.tube("L", [[15, 9], [11, 10], [7.5, 8.5]], 1.3, 1); a.tube("L", [[16.5, 5.5], [18.5, 4.7]], 0.8, 0.7);
        a.tube("B", [[14.5, 8.5], [16.5, 10.5]], 0.8, 0.6);
        a.ell("B", 10.5, 9.4, 2.8, 3); a.tube("B", [[10.5, 11.5], [9.5 + s, 15]], 1.5, 1.1); a.px("B", Math.round(8 + s), 15, 4, 1); a.px("H", Math.round(12 + s), 14);
        a.px("K", 20, 2);
      } },
    ankylo: { w: 31, h: 18, pal: { B: ["#211a12", "#34281b", "#4a3a27", "#624e36", "#7d684a"], A: ["#a48a64", "#c8ae84", "#e8d6ae"], L: ["#8a4f1e", "#b0682a", "#d08a44", "#e8a860"], seed: 71 },
      draw: function (a, f) {
        var s = f ? 1 : -1;
        a.tube("F", [[22, 11], [22 + s, 17]], 2.3, 2); a.tube("F", [[9, 11], [9 - s, 17]], 2.4, 2.1);
        a.tube("B", [[6, 9], [1.5, 8]], 2.3, 1.4); a.ell("A", 2, 7.3, 2.5, 1.9);
        a.ell("B", 15, 9, 11, 6.2);
        for (var i = 5; i <= 25; i += 3) a.poly("A", [[i - 1.2, 12.5], [i, 15], [i + 1.2, 12.5]]);
        for (var yy = 5; yy <= 11; yy += 3) for (var xx = 7 + (yy % 2) * 1.5; xx <= 23; xx += 3.2) if (Math.pow((xx - 15) / 11, 2) + Math.pow((yy - 9) / 6.2, 2) < 0.8) a.px("A", Math.round(xx), yy, 2, 1);
        a.ell("L", 26.5, 11, 3.3, 2.6); a.poly("L", [[28, 10], [31, 11.5], [28.5, 13]]);
        a.tube("L", [[21, 13], [21 - s, 17]], 2.6, 2.2); a.tube("L", [[9, 13], [9 + s, 17]], 2.8, 2.3);
        a.px("K", 27, 10);
      } },
    baby: { w: 14, h: 11, pal: { B: ["#2f6b3a", "#3f8a48", "#5aa85a", "#86c878", "#b0e09a"], L: ["#b8dca0", "#d4ecc0", "#ecf8dc"], seed: 83 },
      draw: function (a, f) {
        var s = f ? 0.8 : -0.8;
        a.tube("F", [[8.5, 6], [8.5 + s, 10]], 1.2, 1); a.tube("F", [[4.5, 6], [4.5 - s, 10]], 1.2, 1);
        a.tube("B", [[3, 5.5], [0.5, 6.5]], 1.6, 0.6);
        a.ell("B", 6.5, 6, 3.8, 2.7); a.ell("B", 10.3, 3.4, 2.7, 2.3);
        a.ell("L", 6.5, 7.6, 2.5, 0.9);
        a.tube("B", [[8, 7.5], [8 - s, 10]], 1.3, 1.1); a.tube("B", [[4.5, 7.5], [4.5 + s, 10]], 1.3, 1.1);
        a.px("K", 11, 2, 1, 2);
      } },
    baby2: { w: 14, h: 11, pal: { B: ["#1f5a5a", "#2c7a74", "#3f9a8e", "#66bcaa", "#96dcc8"], L: ["#b8e0d4", "#d4efe6", "#ecfaf4"], seed: 89 } },
    ptero: { w: 36, h: 18, pal: { B: ["#3e2410", "#62391c", "#8a5226", "#b0743a", "#d0965a"], L: ["#8a5a32", "#a8784a", "#c69a66", "#e0bc88"], A: ["#7a3018", "#a84a24", "#d06a36"], seed: 97 },
      draw: function (a, f) {
        // seen from above, gliding right: both wings spread, the membrane swept back to the hips
        var span = f ? 5.8 : 8.6, sw = f ? 4.5 : 2;
        a.poly("L", [[21, 8.2], [17 - sw, 9 - span], [12.5 - sw, 9.6 - span], [12, 8.6]]);
        a.poly("L", [[21, 9.8], [17 - sw, 9 + span], [12.5 - sw, 8.4 + span], [12, 9.4]]);
        a.tube("B", [[21, 8.3], [19 - sw, 9 - span * 0.55], [17 - sw, 9 - span]], 1, 0.5);
        a.tube("B", [[21, 9.7], [19 - sw, 9 + span * 0.55], [17 - sw, 9 + span]], 1, 0.5);
        a.ell("B", 18, 9, 5.2, 1.9);
        a.tube("B", [[13, 9], [9.5, 9]], 0.9, 0.4);
        a.tube("B", [[22, 9], [26, 9]], 1.7, 1.3); a.tube("B", [[26, 9], [34, 9]], 1, 0.35);
        a.poly("A", [[25.5, 7.9], [19.5, 7.2], [20.5, 8.6]]);
        a.px("K", 25, 8); a.px("K", 25, 10);
      } }
  };
  ART.baby2.draw = ART.baby.draw; ART.baby2.w = 14; ART.baby2.h = 11;
  var DART = {};
  function dinoFrame(kind, f) {
    var key = kind + f;
    if (!DART[key]) { var d = ART[kind]; DART[key] = shapeArt(d.w, d.h, d.pal, d.draw, f); }
    return DART[key];
  }
  // draw a canvas with its feet at (x, y); flip mirrors it to face left
  function drawArt(c, x, y, flip) {
    var dx = Math.round(x - c.width / 2), dy = Math.round(y - c.height + 1);
    if (!flip) { ctx.drawImage(c, dx, dy); return; }
    ctx.save(); ctx.translate(dx + c.width, dy); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore();
  }
  var DINOS = {
    brachio: { art: true, sp: 7, step: 7, say: ["a brachiosaurus. it's eating the top off a palm, very slowly.", "a brachiosaurus. from down here pi can only see its knees."] },
    trex: { art: true, sp: 13, step: 5, say: ["the t-rex. it stares at pi through the fence and does not blink.", "the t-rex. 10,000 volts between you and it. it's thinking about that."] },
    stego: { art: true, sp: 8, step: 5, say: "a stegosaurus. those plates are mostly for show." },
    trike: { art: true, sp: 10, step: 5, say: "a triceratops. it's grazing and would like some personal space." },
    para: { art: true, sp: 12, step: 5, say: ["a parasaurolophus. it honks through its crest. pi honks back.", "a parasaurolophus. it's keeping an eye on the pond."] },
    raptor: { art: true, sp: 26, step: 4, say: ["a velociraptor. it is definitely not testing the fences.", "a velociraptor. it clicks at the others. they all look at pi."] },
    ankylo: { art: true, sp: 6, step: 6, say: "an ankylosaurus. armored, unbothered, and swinging that tail at nothing in particular." },
    baby: { art: true, sp: 13, step: 3, say: "a baby dino. it squeaks at pi." },
    baby2: { art: true, sp: 13, step: 3, say: "a baby dino, fresh out of the nest. it follows pi for a step, then forgets." },
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
    return { kind: kind, x: tx * T + 8, y: ty * T + 10, area: area, tx: 0, ty: 0, wait: Math.random() * 3, face: Math.random() < 0.5 ? 1 : -1, dist: 0, hop: 0, vy: 0, sleep: 0, roar: 0, cd: 0 };
  }
  var HERD = [38, 39, 52, 46], PEN = [49, 18, 56, 24], REXPAD = [16, 32, 24, 39];
  var critters = [
    critter("brachio", 18, 23, [14, 18, 24, 26]), critter("brachio", 21, 20, [14, 17, 24, 26]),
    critter("trex", 20, 35, REXPAD),
    critter("raptor", 50, 20, PEN), critter("raptor", 53, 22, PEN), critter("raptor", 55, 19, PEN),
    critter("stego", 43, 43, HERD), critter("trike", 46, 40, HERD), critter("trike", 40, 45, HERD), critter("ankylo", 49, 44, HERD),
    critter("para", 54, 27, [47, 26, 62, 32]), critter("para", 58, 31, [47, 26, 62, 32]),
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
    c.wait -= dt;
    if (c.wait <= 0 && !c.tx) {
      for (var tries = 0; tries < 6; tries++) {
        var tx = c.area[0] + Math.floor(Math.random() * (c.area[2] - c.area[0] + 1)), ty = c.area[1] + Math.floor(Math.random() * (c.area[3] - c.area[1] + 1));
        if (okFor(c, tx, ty)) { c.tx = tx * T + 8; c.ty = ty * T + 10; break; }
      }
      if (!c.tx) c.wait = 1;
    }
    if (c.tx) {
      var dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
      if (dd < 2) { c.tx = 0; c.wait = 1 + Math.random() * 4; if (d.cat && Math.random() < 0.4) c.sleep = 6 + Math.random() * 10; return; }
      var bx = c.x, by = c.y, step = d.sp * dt;
      move(c, dx / dd * step, dy / dd * step);
      c.dist += step; if (Math.abs(dx) > 1) c.face = dx > 0 ? 1 : -1;
      if (Math.hypot(c.x - bx, c.y - by) < 0.01) { c.tx = 0; c.wait = 0.5; }
    }
  }
  function drawCritter(c) {
    var d = DINOS[c.kind];
    if (d.art) {
      var fr = c.tx && !c.roar ? Math.floor(c.dist / d.step) % 2 : 0, art = dinoFrame(c.kind, fr);
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
    ["sign", "mailbox", "tablet", "rack", "uplink"].forEach(function (id) { perches.push(top(id)); });
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
  var VX = VOLC.x * T, VY = VOLC.y * T;
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
  function drawLava(x0, y0, x1, y1) {
    for (var ty = Math.max(y0, 8); ty <= Math.min(y1, 14); ty++) for (var tx = Math.max(x0, 29); tx <= Math.min(x1, 37); tx++) {
      if (map[ty][tx] !== LAVA) continue;
      for (var j = 0; j < T; j += 2) for (var i = 0; i < T; i += 2) {
        var px = tx * T + i, py = ty * T + j;
        if (craterF((px + 1) / T, (py + 1) / T) > 1.02) continue;
        var v = 0.5 + 0.28 * Math.sin(t * 1.3 + px * 0.21 + Math.sin(py * 0.17 + t * 0.7) * 2) + 0.18 * Math.sin(t * 0.8 - py * 0.3 + px * 0.05);
        if (hash(((px + t * 6) / 6) | 0, (py / 4) | 0) < 0.12) v -= 0.45;      // cooling crust drifts across
        ctx.fillStyle = tone(v, LAVA_T, px >> 1, py >> 1); ctx.fillRect(px, py, 2, 2);
      }
    }
    light(VX, VY, 70, "255,110,40", 0.9);
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
      drawArt(dinoFrame("ptero", Math.floor(t * 3 + i) % 2), p.x, p.y + 9, p.face < 0);
    });
    if (ptero.on) {
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(ptero.x, ptero.y + 50, 9, 3, 0, 0, 6.283); ctx.fill();
      drawArt(dinoFrame("ptero", Math.floor(t * 4) % 2), ptero.x, ptero.y + 9, ptero.vx < 0);
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
  function drawGate() {
    var s = SPR.gate, bx = GATE.x * T + 8, by = GATE.y * T + 14, x0 = Math.round(bx - s.width / 2), y0 = by - s.height + 2;
    shadow(bx - 38, by, 14); shadow(bx + 38, by, 14);
    ctx.drawImage(s, x0, y0);
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
    ".bash_history": "ls -a\ncat .rift\nsudo ./rift --wake\n# forgot the password again.\n# it's the default orb. check orbs.txt",
    ".rift": "#!/bin/sh\n# the orbs sleep under the island.\n# waking them starts a fight for control of the site.\n# the winner runs every orb on the page until you close the tab.\n#\n# usage: sudo ./rift --wake"
  };
  function koiCsv() { return "variety,length\n" + KOI.map(function (v, i) { return v[0] + "," + ["small", "small", "medium", "medium", "large", "large"][koi[i].len - 5]; }).join("\n"); }
  function print(text, cls) {
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
    if (p === 1 || typeof p === "string") { var s = STATIONS.filter(function (q) { return q.id === (p === 1 ? name : p); })[0]; tx = s.x; ty = s.y + 1; }
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
       "  feed koi          ring the dinner bell at the pond", "  fly | drive       go to the helicopter or the M3", "  history           what you've typed", "  clear             clear the screen", "  exit              log out"].forEach(function (l) { print(l); });
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
    date: function () { CMDS.time([]); },
    echo: function (args) { print(args.join(" ")); },
    summon: function () { print("summon what? the orbs don't answer to that. maybe the hidden files know."); },
    fences: function (args) { print(args[0] === "off" ? "fences: permission denied. and also, no." : "fences: all paddocks live. 10,000 V."); }
  };
  function countFound() { return Object.keys(found).filter(function (id) { return STATIONS.some(function (s) { return s.id === id && s.found; }); }).length; }
  function run(line) {
    if (sudoTries >= 0) {                                        // answering the sudo password prompt
      if (line.trim().toLowerCase() === "eclipse") {
        sudoTries = -1; setPrompt();
        print("access granted.", "ok"); print((rift && rift.winner ? "the core stirs. " : "") + "waking the orbs...", "ok");
        setTimeout(function () { closeTerm(); rift = null; startRift(); }, 900);
      } else if (++sudoTries >= 3) { sudoTries = -1; setPrompt(); print("sudo: 3 incorrect password attempts. a raptor has been notified.", "err"); }
      else print("sorry, try again.", "err");
      return;
    }
    print("pi@island:~$ " + line, "cmd");
    line = line.trim(); if (!line) return;
    tHist.push(line); tHi = tHist.length;
    if (/^sudo\s+(\.\/)?rift\s+--?wake$/i.test(line)) { sudoTries = 0; setPrompt(); return; }
    if (/^(sudo\s+)?(\.\/)?rift\b/.test(line)) { print(/^sudo/.test(line) ? "usage: sudo ./rift --wake" : "./rift: permission denied (try sudo)"); return; }
    if (/^sudo\b/.test(line)) { print("pi is not in the sudoers file. this incident will be reported.", "err"); return; }
    if (/^rm\s+-\w*r\w*f|^rm\s+-\w*f\w*r/.test(line)) { print("nice try. the raptors are watching.", "err"); return; }
    var parts = line.split(/\s+/), cmd = parts[0].toLowerCase();
    if (CMDS[cmd]) CMDS[cmd](parts.slice(1)); else print(cmd + ": command not found. try help", "err");
  }
  term.querySelector(".w-term-row").addEventListener("submit", function (e) { e.preventDefault(); var v = tIn.value; tIn.value = ""; run(v); });
  tIn.addEventListener("keydown", function (e) {
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
    STATIONS.forEach(function (s) { out.push({ d: Math.hypot(pi.x - (s.x * T + 8), pi.y - (s.y * T + 12)), max: 26, v: s }); });
    out.push({ d: Math.hypot(pi.x - rex.x, pi.y - rex.y), max: 20, v: { id: "rex", name: "rex" } });
    critters.forEach(function (c) {
      var d = DINOS[c.kind], ht = d.art ? ART[c.kind].h : d.a.length, reach = d.art ? Math.max(18, ART[c.kind].w * 0.6) : 18;
      out.push({ d: Math.hypot(pi.x - c.x, pi.y - c.y), max: reach, v: { id: "critter", ref: c, ax: c.x, ay: c.y - ht - 2 } });
    });
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
      if (c.sleep <= 0) { c.hop = 1; c.vy = -2; }
      var line = c.name ? (c.sleep > 0 ? c.name + " is asleep in the sun. pi lets " + (c.name === "jasmine" ? "her" : "him") + " be." : c.say)
        : c.sleep > 0 && d.sleepSay ? d.sleepSay : Array.isArray(d.say) ? d.say[(Math.random() * d.say.length) | 0] : d.say;
      say(c.name ? c.name : c.kind === "cat" ? "a himalayan cat" : c.kind === "robot" || c.kind === "roomba" ? "a bot" : "a dinosaur", line, []);
    } else if (v.id === "bird") say("a cockatiel", "one of Ammaar's two cockatiels. it whistles at pi, then preens.", []);
    else if (v.id === "pond") {
      // pi tosses a handful of pellets on the water nearest him, and the koi come running
      var best = null, bd = 1e9;
      for (var a2 = 0; a2 < 6.283; a2 += 0.1) { var qx = (KP.x + Math.cos(a2) * KP.rx * 0.8) * T, qy = (KP.y + Math.sin(a2) * KP.ry * 0.75) * T, q = Math.hypot(qx - pi.x, qy - pi.y); if (q < bd) { bd = q; best = [qx, qy]; } }
      feedKoi(best[0], best[1]);
      say("the koi pond", "Ammaar's koi pond: twenty koi, every one a different variety and size. kohaku, showa, tancho, chagoi, karasu, a big platinum ogon, and the rest. pi tosses in some pellets and they all come running.", []);
    }
    else if (v.id === "nest") say("a nest", "a nest of " + v.ref.eggs + " speckled eggs, still warm. one of them wobbles. pi backs away slowly.", []);
    else if (v.id === "fence") {
      var pd = PADDOCKS.filter(function (q) { return v.fx >= q.x0 && v.fx <= q.x1 && v.fy >= q.y0 && v.fy <= q.y1; })[0];
      say(pd ? pd.name : "a fence", pd && pd.name === "raptor pen" ? "the raptor pen. 10,000 volts. three raptors inside, and all three have stopped to look at pi." : "the t-rex paddock. 10,000 volts. somewhere in there, something very big just stopped moving.", []);
      if (pd && pd.name !== "raptor pen" && trex.cd <= 0) roar();
    }
    else if (v.id === "car") { say("the M3", "Ammaar's BMW M3. press e to get in, arrows or wasd to drive, space to honk, e again to park." + (TOUCH ? " on touch: tap where you want to go." : ""), [["get in", "#drive"]]); }
  }

  // the t-rex roars when pi comes close to its fence: the screen shakes, the birds scatter
  function roar() {
    trex.roar = 1.4; trex.cd = 14; trex.tx = 0; trex.face = pi.x > trex.x ? 1 : -1; quake = 4;
    roarTag = { x: trex.x, y: trex.y - ART.trex.h - 4, t: 1.6 };
    if (!birds[0].fly) { var n = (birds[0].perch + 3) % perches.length; fly(birds[0], n, 0); fly(birds[1], n, 0.2); }
  }
  var roarTag = null;
  function updateLife(dt) {
    skyT -= dt; if (skyT <= 0) { readSky(); skyT = 30; }
    critters.forEach(function (c) { updateCritter(c, dt); });
    updateBirds(dt); updateKoi(dt); updateCar(dt); updateHeli(dt); updateVolcano(dt);
    if (trex.cd <= 0 && !aboard() && pi.x < 27 * T && pi.x > 13 * T && pi.y > 29.5 * T && pi.y < 42 * T && Math.hypot(pi.x - trex.x, pi.y - trex.y) < 150) roar();
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
      rift.dim = Math.min(0.55, rift.t / 1.5 * 0.55); rift.shake = Math.max(rift.shake, 1.2);
      if (rift.t > 1.7) { rift.phase = "fall"; rift.t = 0; }
    } else if (rift.phase === "fall") {
      rift.orbs.forEach(function (o, i) {
        var u = Math.max(0, Math.min(1, (rift.t - i * 0.2) / 0.9)), e = 1 - Math.pow(1 - u, 3);
        var z = 300 + i * 50 + (26 - 300 - i * 50) * e;
        if (o.z > 40 && z <= 40) { rift.shake = 5; burst(o.x, o.y, o.name, 14, 50); }
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
      } else if (d) {
        d.t += dt / 0.3;
        var k = Math.min(1, d.t * d.t);
        d.a.x = d.fx + (d.b.x - d.fx) * k; d.a.y = d.fy + (d.b.y - d.fy) * k;
        if (d.t >= 1) {
          var dx = d.b.x - d.fx, dy = d.b.y - d.fy, len = Math.hypot(dx, dy) || 1;
          d.b.hp--; d.b.flash = 1; d.a.flash = 0.6; rift.shake = 6;
          d.b.vx = dx / len * 140; d.b.vy = dy / len * 90; d.a.vx = -dx / len * 60; d.a.vy = -dy / len * 40;
          burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, d.a.name, 12, 70); burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, d.b.name, 12, 70);
          if (d.b.hp <= 0) { d.b.alive = false; burst(d.b.x, d.b.y - d.b.z, d.b.name, 70, 110); rift.shake = 10; }
          rift.dash = null; rift.next = 0.5 + Math.random() * 0.4;
          if (rift.orbs.filter(function (o) { return o.alive; }).length === 1) { rift.phase = "crowning"; rift.t = 0; }
        }
      }
    } else if (rift.phase === "crowning") {
      var w = alive[0];
      w.x += (ARENA.x - w.x) * 0.06; w.y += (ARENA.y - w.y) * 0.06; w.z += (34 - w.z) * 0.06;
      w.scale = 1 + Math.min(1, rift.t / 1.4) * 0.7;
      rift.dim = Math.max(0.2, rift.dim - dt * 0.2);
      if (rift.t > 0.6 && !rift.ringed) { rift.ringed = true; rift.ring = 1; rift.shake = 7; burst(w.x, w.y - w.z, w.name, 50, 90); }
      if (rift.t > 2.2) crown(w.name);
    } else if (rift.phase === "reign") {
      rift.dim = Math.max(0, rift.dim - dt * 0.3);
      var o = rift.orbs[0]; if (o) o.z = 34 + Math.sin(rift.t * 1.6) * 3;
    }
    rift.orbs.forEach(function (o) { o.flash = Math.max(0, o.flash - dt * 2.5); });
    rift.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt * 1.1; });
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

  /* ════════ simulation ════════ */
  function move(o, dx, dy) {
    var hw = 4;
    if (dx && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y - 2) && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y + 1)) o.x += dx;
    if (dy && !solidPx(o.x - hw, o.y + dy + (dy > 0 ? 1 : -2)) && !solidPx(o.x + hw, o.y + dy + (dy > 0 ? 1 : -2))) o.y += dy;
  }
  function update(dt) {
    updateRift(dt);
    updateLife(dt);
    if (egg) { egg.t += dt; if (egg.t > 2.2) { egg = null; bubble = { text: "pi:~$ fresh hatch. hi.", t: 3 }; } return; }
    var sp = (pi.boost > 0 ? 95 : 58) * dt; pi.boost = Math.max(0, pi.boost - dt);
    var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (!dlg.hidden) mx = my = 0;
    if (riftBusy() || car.driving || aboard() || termOpen) { mx = my = 0; pi.path = null; }
    if (!mx && !my && pi.path && pi.path.length) {
      var n = pi.path[0], gx = n[0] * T + 8, gy = n[1] * T + 10, ddx = gx - pi.x, ddy = gy - pi.y, dd = Math.hypot(ddx, ddy);
      if (dd < 1.5) { pi.path.shift(); if (!pi.path.length) { pi.path = null; if (pi.want) { var w = pi.want; pi.want = null; interact(w.id === "rex" ? { id: "rex" } : w); } } }
      else { mx = ddx / dd; my = ddy / dd; }
    }
    if (mx || my) {
      var len = Math.hypot(mx, my); mx /= len; my /= len;
      var ox = pi.x, oy = pi.y;
      move(pi, mx * sp, my * sp);
      pi.dist += Math.hypot(pi.x - ox, pi.y - oy);
      if (Math.abs(mx) > 0.3) pi.face = mx > 0 ? 1 : -1;
      pi.dir = my < -0.5 ? "up" : "down";
      if (pi.path && Math.hypot(pi.x - ox, pi.y - oy) < 0.01) pi.path = null;   // stuck: give up
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

  /* ════════ render ════════ */
  function render() {
    zoom += (zoomTo - zoom) * 0.08;
    var E = S * zoom, VW = W / E, VH = H / E;
    // the camera follows pi, except while the orbs fight: then it watches the arena
    var fx = riftBusy() ? ARENA.x : pi.x, fy = riftBusy() ? ARENA.y - 20 : pi.y;
    if (camF.x === null) { camF.x = fx; camF.y = fy; }
    camF.x += (fx - camF.x) * 0.06; camF.y += (fy - camF.y) * 0.06;
    var sh = (rift ? rift.shake : 0) + quake;
    camX = Math.max(0, Math.min(MW * T - VW, camF.x - VW / 2)) + (Math.random() - 0.5) * sh;
    camY = Math.max(0, Math.min(MH * T - VH, camF.y - VH / 2)) + (Math.random() - 0.5) * sh;
    camX = Math.round(camX * E) / E; camY = Math.round(camY * E) / E;
    ctx.setTransform(E * dpr, 0, 0, E * dpr, -camX * E * dpr, -camY * E * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COL.deep; ctx.fillRect(camX, camY, VW + 1, VH + 1);
    ctx.drawImage(ground, 0, 0);

    // water: glints and foam that breathe with the tide
    var x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T)), x1 = Math.min(MW - 1, Math.ceil((camX + VW) / T)), y1 = Math.min(MH - 1, Math.ceil((camY + VH) / T));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var tt = map[ty][tx];
      if (!wet(tt)) continue;
      if (tt === POND && pondF(tx + 0.5, ty + 0.5) > 0.9) continue;
      var ph = hash(tx, ty), cyc = Math.floor(t * 0.9 + ph * 7);
      if (hash(tx * 3 + cyc, ty) < 0.16) { ctx.fillStyle = tt === DEEP ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.35)"; ctx.fillRect(tx * T + ((hash(cyc, tx) * 11) | 0), ty * T + ((hash(ty, cyc) * 14) | 0), 4, 1); }
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
    drawLava(x0, y0, x1, y1);
    drawHeliShadow();

    // y-sorted scene
    var list = [];
    critters.forEach(function (c) { list.push({ y: c.y, f: function () { drawCritter(c); } }); });
    birds.forEach(function (b) { list.push({ y: b.fly ? b.gy + 40 : b.gy + 1, f: function () { drawBird(b); } }); });
    list.push({ y: car.y + 8, f: drawCar });
    if (heli.z < 12) list.push({ y: heli.y + 12, f: drawHeli });
    list.push({ y: GATE.y * T + 14, f: drawGate });
    for (var fy = y0; fy <= y1 + 1; fy++) for (var fx = x0 - 1; fx <= x1 + 1; fx++) if (fence[k(fx, fy)]) (function (a, b) { list.push({ y: b * T + 13, f: function () { drawFence(a, b); } }); })(fx, fy);
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
        if (p.kind !== "rock") shadow(bx, by, { jtree: 30, tree: 18, tree2: 18, tfern: 12, palm: 12, fern: 10, cycad: 10, lamp: 6 }[p.kind] || 12);
        if (p.kind === "rock") { ctx.drawImage(s, bx - 9, by - 11 + Math.round(Math.sin(t + p.tx) * 0.5)); return; }
        var sway = (p.kind === "palm" || p.kind === "tfern") && !REDUCED ? Math.round(Math.sin(t * 1.2 + p.tx) * 0.6) : 0;
        if (p.flip) { ctx.save(); ctx.translate(bx * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(s, bx - s.width / 2 + sway, by - s.height + 2);
        if (p.flip) ctx.restore();
        if (p.kind === "lamp") light(bx, by - 14, 34, "255,210,140", 0.95);
      } });
    });
    STATIONS.forEach(function (s) { list.push({ y: s.y * T + 15, f: function () { drawStation(s); } }); });
    list.push({ y: rex.y, f: function () {
      shadow(rex.x, rex.y, 10);
      drawFrame(DINO[Math.floor(rex.dist / 5) % 2 ? "b" : "a"], { W: "#ececec", K: "#141414" }, 11, rex.x, rex.y - 1 + rex.hop, rex.face < 0);
    } });
    list.push({ y: pi.y, f: drawPi });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // above it all: volcano smoke, the helicopter in flight, pterosaurs, drifting cloud shadows
    drawSmoke();
    if (heli.z >= 12) drawHeli();
    drawPteros();
    ctx.fillStyle = "rgba(10,30,50,.08)";
    clouds.forEach(function (c) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.45, 0, 0, 6.283); ctx.fill(); });

    // screen-space overlays: the rift, then prompts and speech
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(E);
    drawRift(E);
    var nb = !egg && dlg.hidden ? nearby() : null;
    if (nb && nb.ax !== undefined) tag(TOUCH ? "tap" : "E", (nb.ax - camX) * E, (nb.ay - camY) * E - 4 + Math.sin(t * 4) * 2, true);
    else if (nb) {
      // float the prompt just above the landmark's own sprite
      var topY = nb.id === "rex" ? rex.y - 15 : nb.id === "core" ? ARENA.y - 34 - OR * 1.9 : nb.id === "boat" ? nb.y * T : nb.y * T + 16 - SPR[nb.id].height;
      var sx = ((nb.id === "rex" ? rex.x : nb.id === "core" ? ARENA.x : nb.x * T + 8) - camX) * E, sy = (topY - camY) * E - 6 + Math.sin(t * 4) * 2;
      tag(TOUCH ? "tap" : "E", sx, sy, true);
    }
    if (roarTag) tag("ROAR", (roarTag.x - camX) * E, (roarTag.y - camY) * E, false);
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 16 - (aboard() ? heli.z + 10 : 0) - camY) * E - 6, false);
  }
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
        pix(FRAMES.idle, false, cx - 5, Math.round(cy - 10 - Math.sin(u * 3.14) * 6), PIPAL, 10);
      }
      return;
    }
    if (car.driving || aboard()) return;
    shadow(pi.x, pi.y, 10);
    var moving = (keys.u || keys.d || keys.l || keys.r || (pi.path && pi.path.length)) && dlg.hidden;
    var f = pi.dir === "up" ? FRAMES.back : moving ? (Math.floor(pi.dist / 4) % 2 ? FRAMES.walk1 : FRAMES.walk2) : FRAMES.idle;
    var bob = moving ? 0 : Math.round(Math.sin(t * 3) * 0.5);
    drawFrame(f, PIPAL, 10, pi.x, pi.y - 1 + bob, pi.face < 0);
    if (pi.boost > 0) { ctx.fillStyle = "#E879F9"; ctx.fillRect(Math.round(pi.x - 7 - pi.face * 3), Math.round(pi.y - 4), 2, 1); ctx.fillRect(Math.round(pi.x - 8 - pi.face * 5), Math.round(pi.y - 6), 2, 1); }
  }

  function drawStation(s) {
    var bx = s.x * T + 8, by = s.y * T + 15, sp = SPR[s.id];
    if (s.id === "boat") {
      var bob = Math.round(Math.sin(t * 1.5) * 1);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(bx - 16, by + 3 + bob, 34, 1);
      ctx.drawImage(sp, bx - 15, by - 17 + bob); return;
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
    shadow(bx, by, s.id === "desk" ? 30 : 14);
    // outlined sprites carry a 1px border, so live details are offset by one pixel into the art
    var sx0 = Math.round(bx - sp.width / 2), sy0 = by - sp.height + 2;
    ctx.drawImage(sp, sx0, sy0);
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
  function enter() {
    if (open) return;
    lastFocus = document.activeElement;
    if (window.orbs && window.orbs[0]) window.orbs[0].boost();
    warpRun(1, function () {
      open = true; size();
      document.documentElement.classList.add("in-world");
      root.hidden = false; root.classList.add("show");
      var first = false;
      try { first = sessionStorage.getItem("pi-hatched") !== "1"; sessionStorage.setItem("pi-hatched", "1"); } catch (e) {}
      egg = first && !REDUCED ? { t: 0 } : null;
      pi.x = SPAWN.x; pi.y = SPAWN.y; pi.path = null; keys = {};
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
  root.querySelector(".w-exit").addEventListener("click", function () { exit(); });
  window.addEventListener("resize", function () { if (open) size(); });
  if (location.hash === "#island") setTimeout(enter, 400);
})();
