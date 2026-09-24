/* world — pi's island. click the orb and you warp into a top-down island you
   can walk around as pi. every landmark is a piece of the portfolio: the rack
   is the homelab, the lighthouse is the security work, the boat takes you home.
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
  var T = 16, MW = 56, MH = 44, CX = 28, CY = 21;
  var DEEP = 0, SHAL = 1, SAND = 2, GRASS = 3, PATH = 4, POND = 5, DOCK = 6;
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  function rad(a) { return 16.2 + 2.4 * Math.sin(3 * a + 1.1) + 1.6 * Math.sin(5 * a + 2.3) + 1.0 * Math.sin(7 * a + 0.4); }
  var map = [], x, y;
  for (y = 0; y < MH; y++) {
    map.push([]);
    for (x = 0; x < MW; x++) {
      var dx = (x + 0.5 - CX) / 1.22, dy = y + 0.5 - CY, d = Math.sqrt(dx * dx + dy * dy), r = rad(Math.atan2(dy, dx));
      map[y].push(d > r + 2.8 ? DEEP : d > r ? SHAL : d > r - 2.3 ? SAND : GRASS);
    }
  }
  function at(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? DEEP : map[y][x]; }
  function land(t) { return t === GRASS || t === SAND || t === PATH; }
  function wet(t) { return t === DEEP || t === SHAL || t === POND; }
  // the koi pond: a wobbly blob (tile units). < 1 is water
  var PC = { x: 38.5, y: 25.5, rx: 5, ry: 1.9 };
  function pondF(fx, fy) {
    var dx = (fx - PC.x) / PC.rx, dy = (fy - PC.y) / PC.ry, a = Math.atan2(dy, dx);
    return Math.sqrt(dx * dx + dy * dy) / (1 + 0.13 * Math.sin(3 * a + 0.8) + 0.08 * Math.sin(5 * a + 2.1) + 0.05 * Math.sin(7 * a));
  }
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) if (map[y][x] === GRASS && pondF(x + 0.5, y + 0.5) < 1) map[y][x] = POND;
  var dockY = CY; while (land(at(CX, dockY + 1))) dockY++;
  function seg(x0, y0, x1, y1) {
    var sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    for (;;) { if (land(at(x0, y0))) map[y0][x0] = PATH; if (x0 === x1 && y0 === y1) break; if (x0 !== x1) x0 += sx; else y0 += sy; }
  }
  function route(p) { for (var i = 0; i < p.length - 1; i++) seg(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); }
  for (y = 21; y <= 23; y++) for (x = 26; x <= 31; x++) if (land(at(x, y))) map[y][x] = PATH;   // plaza
  route([[28, 23], [28, dockY]]); route([[29, 23], [29, dockY]]);
  route([[28, 21], [28, 11]]);
  route([[31, 22], [49, 22], [49, 21]]);
  route([[35, 22], [35, 17]]);
  route([[26, 22], [13, 22]]);
  route([[20, 22], [20, 18]]);
  route([[28, 30], [19, 30]]);
  route([[29, 30], [37, 30]]);
  route([[28, dockY], [25, dockY]]);
  route([[29, 28], [33, 28]]);
  for (y = dockY + 1; y <= dockY + 4; y++) { map[y][CX] = DOCK; map[y][CX + 1] = DOCK; }

  var ELEV = [];
  for (y = 0; y < MH; y++) {
    ELEV.push([]);
    for (x = 0; x < MW; x++) {
      var tl = map[y][x], lv = 0;
      if (tl === GRASS || tl === PATH) {
        var hx = (x + 0.5 - 28) / 9.5, hy = (y + 0.5 - 9.8) / 4.6, ha = Math.atan2(hy, hx);
        var hw = 1 + 0.1 * Math.sin(3 * ha + 0.5) + 0.07 * Math.sin(5 * ha + 2);
        if (hx * hx + hy * hy < hw * hw) lv = 1;
        var px2 = (x + 0.5 - 26) / 4.2, py2 = (y + 0.5 - 7.6) / 2.1;
        if (lv && px2 * px2 + py2 * py2 < 1) lv = 2;
      }
      ELEV[y].push(lv);
    }
  }
  function lvl(x, y) { return x < 0 || y < 0 || x >= MW || y >= MH ? 0 : ELEV[y][x]; }
  function rim(x, y) { var l = lvl(x, y); return lvl(x + 1, y) !== l || lvl(x - 1, y) !== l || lvl(x, y + 1) !== l || lvl(x, y - 1) !== l; }

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", x: 26, y: 20, name: "signpost", text: "pi's island. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. find all eight and something on the island wakes up. the boat at the dock takes you back." },
    { id: "rack", x: 35, y: 16, name: "the rack", found: true, text: "the homelab. two Raspberry Pi 5 nodes run AdGuard Home and Unbound behind a keepalived floating IP. pull the plug on one and DNS keeps answering from the other within seconds. failover tested in both directions, config synced every 10 minutes.", links: [["ha-dns repo ↗", GH + "homelab/tree/main/ha-dns"]] },
    { id: "desk", x: 20, y: 17, name: "the desk", found: true, wide: true, text: "a Claude intake triage assistant. messy free-text help requests go in; structured records come out with category, urgency, summary, next step, and a human-review flag. a 15-case eval harness took classification accuracy to 100%.", links: [["repo ↗", GH + "claude-intake-triage"], ["demo ↗", "https://www.loom.com/share/c43efcd9c3314bcd9cda3002282d31a5"]] },
    { id: "uplink", x: 13, y: 21, name: "the uplink", found: true, text: "an AWS static site built end to end with Terraform: S3 hosting, CloudFront delivery, Route 53 DNS, IAM access controls. one command up, one command down. Ammaar is an AWS Certified Cloud Practitioner.", links: [["terraform repo ↗", GH + "homelab/tree/main/terraform-aws-static-site"]] },
    { id: "tower", x: 28, y: 10, name: "the watchtower", found: true, text: "the monitoring stack. Prometheus and Grafana watch every host and container in the lab through node-exporter and cAdvisor, and Uptime Kuma pings every service.", links: [["monitoring ↗", GH + "homelab/tree/main/monitoring-stack"], ["uptime ↗", GH + "homelab/tree/main/uptime-monitoring"]] },
    { id: "lighthouse", x: 49, y: 20, name: "the lighthouse", found: true, text: "the security work. Ammaar is a cyber security analyst in Cyber Ready Clinic's internship cohort, assessing nonprofit clients' cyber readiness with the Ready5 framework and mapping gaps to the NIST CSF and CIS Controls. the Ready5 Practitioner badge is in progress.", links: [["experience", "#experience"]] },
    { id: "macbook", x: 37, y: 29, name: "a macbook on a blanket", found: true, text: "this website. hand-rolled HTML, CSS, JavaScript and a little Python, no frameworks. the orb, the hands, and this island are all drawn in plain canvas. you're standing in it.", links: [["site repo ↗", GH + "ammaarrehman.github.io"]] },
    { id: "tablet", x: 19, y: 29, name: "a stone tablet", found: true, text: "the record. Howard Community College, A.A. through Dec 2026, 3.65 GPA, Dean's List. starting at UMD's Smith School, B.S. Information Systems, in Jan 2027. AWS Certified Cloud Practitioner, CompTIA Tech+. FBLA State and Regional Champion.", links: [["education", "#education"]] },
    { id: "mailbox", x: 25, y: dockY - 1, name: "the mailbox", found: true, text: "ammaarrehmanf@gmail.com. email is the fastest way to reach Ammaar.", links: [["email ↗", "mailto:ammaarrehmanf@gmail.com"], ["linkedin ↗", "https://www.linkedin.com/in/ammaarrehman/"]] },
    { id: "drink", x: 33, y: 27, name: "a drink stand", text: "pi takes a sip. zoom mode for ten seconds." },
    { id: "boat", x: 30, y: dockY + 3, name: "the boat", text: "the boat back to the mainland. sail back to the site?", links: [["sail back ↩", "#exit"]] }
  ];
  var TOTAL = STATIONS.filter(function (s) { return s.found; }).length;
  var found = {};
  try { (JSON.parse(sessionStorage.getItem("pi-found") || "[]")).forEach(function (k) { found[k] = 1; }); } catch (e) {}

  /* ════════ collision ════════ */
  var solid = {};
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
  var props = [];     // trees, palms, rocks: static, y-sorted with everything else
  for (y = 1; y < MH - 1; y++) for (x = 1; x < MW - 1; x++) {
    var t = map[y][x], h = hash(x, y);
    if (t === GRASS) {
      var f = Math.sin(x * 0.42 + 1) + Math.sin(y * 0.5 + 2) + Math.sin((x + y) * 0.27 + 0.5);
      if ((f > 0.7 && h < 0.72) || h < 0.07) {
        if (near(x, y, 1, function (a, b) { return at(a, b) === PATH || at(a, b) === POND || solid[k(a, b)] || nearStation(a, b); })) continue;
        props.push({ kind: h < 0.25 ? "tree" : h < 0.5 ? "pine" : "tree2", tx: x, ty: y }); solid[k(x, y)] = 1;
      }
    } else if (t === GRASS && hash(x * 7, y * 13) < 0.035 && !solid[k(x, y)]) {
      props.push({ kind: "bush", tx: x, ty: y });           // decoration: pi can walk behind bushes
    } else if (t === SAND && h < 0.09) {
      if (near(x, y, 1, function (a, b) { return at(a, b) === PATH || at(a, b) === DOCK || solid[k(a, b)] || nearStation(a, b); })) continue;
      props.push({ kind: "palm", tx: x, ty: y, flip: h < 0.045 }); solid[k(x, y)] = 1;
    } else if (t === SHAL && h < 0.02 && Math.abs(x - CX) > 3) {
      props.push({ kind: "rock", tx: x, ty: y });
    }
  }
  [[25, 23], [32, 21], [27, dockY - 1], [30, dockY - 1]].forEach(function (l) {
    if (land(at(l[0], l[1])) && at(l[0], l[1]) !== PATH) { props.push({ kind: "lamp", tx: l[0], ty: l[1] }); solid[k(l[0], l[1])] = 1; }
  });
  function walkable(x, y) { var t = at(x, y); return (land(t) || t === DOCK) && !solid[k(x, y)]; }
  function solidPx(px, py) { return !walkable(Math.floor(px / T), Math.floor(py / T)); }

  /* ════════ sprites (drawn once into little canvases) ════════ */
  function sprite(w, h, fn) { var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
  function blob(r, cx, cy, rad, col) { for (var j = -rad; j <= rad; j++) { var w = Math.round(Math.sqrt(rad * rad - j * j)); r(cx - w, cy + j, w * 2, 1, col); } }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // pick one of 4 tones for a shade in [0,1], ordered-dithered so the bands blend like 16-bit art
  function tone(v, tones, x, y) {
    var f = Math.max(0, Math.min(0.999, v)) * (tones.length - 1), i = Math.floor(f);
    return (f - i) > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? tones[Math.min(tones.length - 1, i + 1)] : tones[i];
  }
  function trunk(r, x, y, h) {
    r(x, y, 5, h, "#6b4424"); r(x + 3, y, 2, h, "#4f311a"); r(x + 1, y + 2, 1, 3, "#8a5a33");
    r(x - 1, y + h - 2, 7, 2, "#5a3a1e"); r(x - 2, y + h - 1, 2, 1, "#5a3a1e"); r(x + 5, y + h - 1, 2, 1, "#5a3a1e");
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
      g.fillStyle = tone(v, tones, x, y); g.fillRect(x, y, 1, 1);
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
  var SPR = {
    tree: sprite(32, 42, function (r, g) {
      trunk(r, 14, 27, 13);
      canopy(g, [[16, 17, 13], [10, 13, 8], [22, 12, 8], [16, 8, 8]], ["#1f4d22", "#2e6f2d", "#46963a", "#76c45a"]);
    }),
    tree2: sprite(32, 44, function (r, g) {
      trunk(r, 14, 30, 12);
      canopy(g, [[16, 22, 11], [16, 12, 11], [9, 17, 7], [23, 17, 7]], ["#1d4a24", "#2b6a31", "#3f8c3c", "#6db957"]);
      [[20, 25], [9, 19], [22, 13], [13, 9], [17, 29]].forEach(function (p) { r(p[0], p[1], 2, 2, "#d9483e"); r(p[0], p[1], 1, 1, "#ff8a6e"); });   // fruit
    }),
    pine: sprite(26, 46, function (r, g) {
      trunk(r, 11, 36, 9);
      for (var tier = 0; tier < 4; tier++) {                       // stacked, dithered cones
        var top = 4 + tier * 8, hgt = 14, half = 5 + tier * 2.2;
        for (var yy = 0; yy < hgt; yy++) {
          var w = Math.round(half * (yy + 1) / hgt + 1);
          for (var xx = -w; xx <= w; xx++) {
            var shade = 0.72 - (xx / (w + 1)) * 0.45 - yy / hgt * 0.35 + (hash(xx + 40, yy + tier * 20) - 0.5) * 0.18;
            g.fillStyle = tone(shade, ["#173d22", "#23572e", "#317439", "#4f9a48"], xx + 13, top + yy);
            g.fillRect(13 + xx, top + yy, 1, 1);
          }
        }
      }
    }),
    lamp: sprite(7, 18, function (r) { r(3, 5, 1, 13, "#2b2b2b"); r(2, 16, 3, 2, "#2b2b2b"); r(1, 1, 5, 4, "#3a3a3a"); r(2, 2, 3, 2, "#ffe9b0"); r(3, 0, 1, 1, "#3a3a3a"); }),
    bush: sprite(18, 12, function (r, g) { canopy(g, [[9, 7, 5], [5, 8, 4], [13, 8, 4]], ["#1f4d22", "#2e6f2d", "#46963a", "#76c45a"]); }),
    palm: sprite(34, 44, function (r) {
      for (var i = 0; i < 28; i++) { var px = 16 + Math.round(Math.sin(i / 10) * 4); r(px, 42 - i, 4, 1, i % 4 === 0 ? "#7a5230" : "#9a6b3f"); }
      var top = [20, 14];
      [[-1, -0.35], [-0.9, 0.35], [1, -0.3], [0.95, 0.4], [-0.2, -1], [0.35, 0.95]].forEach(function (d) {
        for (var s = 0; s < 13; s++) {
          var lx = top[0] + d[0] * s, ly = top[1] + d[1] * s + (s * s) / 28;
          r(Math.round(lx), Math.round(ly), 2, 2, s % 3 === 0 ? "#2f7d2e" : "#43a13c");
        }
      });
      r(18, 15, 3, 3, "#6b4424"); r(21, 16, 3, 3, "#5a3a1e");
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
    boat: sprite(36, 20, function (r) {
      r(2, 9, 32, 6, "#f4f4f4"); r(4, 15, 28, 2, "#c7d3dc"); r(6, 17, 24, 1, "#9fb3c2"); r(2, 12, 32, 1, "#d64545");
      r(6, 7, 24, 2, "#9b6b3f"); r(20, 1, 10, 6, "#f4f4f4"); r(22, 2, 6, 2, "#4fa3d6"); r(12, 0, 1, 8, "#7a5530");
    })
  };

  Object.keys(SPR).forEach(function (k) {
    SPR[k] = outline(SPR[k], /tree|pine|bush|palm/.test(k) ? "rgba(14,34,18,.9)" : "rgba(18,18,20,.88)");
  });

  /* ════════ ground, drawn once ════════ */
  var COL = { deep: "#1f4e79", deep2: "#1a4470", shal: "#3d8fc4", shal2: "#4fa3d6", sand: "#ecd9a0", sand2: "#dcc586", wetsand: "#cdb57a",
              grass: "#5aa846", grass2: "#4b9339", grass3: "#74c257", path: "#cfae74", path2: "#bb9a60", pond: "#4aa3c9", pondrim: "#3b86a8", dock: "#8b5e34", dock2: "#6e4826" };
  var ground = document.createElement("canvas"); ground.width = MW * T; ground.height = MH * T;
  // how far each water tile is from land, for depth shading
  var DEPTH = [];
  (function () {
    var q = [], x, y;
    for (y = 0; y < MH; y++) { DEPTH.push([]); for (x = 0; x < MW; x++) { var lt = land(map[y][x]) || map[y][x] === DOCK; DEPTH[y].push(lt ? 0 : 99); if (lt) q.push([x, y]); } }
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
      } else if (t === SAND || t === PATH) {
        r(X, Y, T, T, t === SAND ? COL.sand : COL.path);
        for (i = 0; i < 5; i++) { hh = hash(tx * 11 + i, ty * 13); r(X + ((hh * 15) | 0), Y + ((hash(ty * 3 + i, tx) * 15) | 0), 1, 1, t === SAND ? COL.sand2 : COL.path2); }
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
        // grass in soft tonal patches instead of one flat green
        var patch = (Math.sin(tx * 0.35) + Math.sin(ty * 0.41 + 1) + Math.sin((tx - ty) * 0.23 + 2)) / 3;
        for (j = 0; j < T; j += 2) for (i = 0; i < T; i += 2) {
          var gv = 0.5 + patch * 0.45 + (hash(tx * 8 + i, ty * 8 + j) - 0.5) * 0.25 + ELEV[ty][tx] * 0.3;
          g.fillStyle = tone(gv, ["#4d9a3c", "#57a644", "#62b04e", "#6fbd58", "#7dc862"], X + i, Y + j); g.fillRect(X + i, Y + j, 2, 2);
        }
        for (i = 0; i < 6; i++) { hh = hash(tx * 5 + i, ty * 9); r(X + ((hh * 15) | 0), Y + ((hash(ty * 7 + i, tx * 2) * 14) | 0), 1, 2, hh < 0.5 ? COL.grass2 : COL.grass3); }
        hh = hash(tx * 31, ty * 17);
        if (hh < 0.06) { var fc = ["#ff8fb1", "#ffe066", "#ffffff", "#c9a4ff"][(hh * 66 | 0) % 4]; r(X + 6, Y + 6, 1, 1, fc); r(X + 5, Y + 7, 3, 1, fc); r(X + 6, Y + 8, 1, 1, fc); r(X + 6, Y + 7, 1, 1, "#ffcf33"); }
        else if (hh < 0.14) { r(X + 4, Y + 9, 1, 3, COL.grass2); r(X + 6, Y + 8, 1, 4, COL.grass2); r(X + 8, Y + 9, 1, 3, COL.grass2); }
      } else if (t === POND) {
        r(X, Y, T, T, "#57a644");                          // grass under the pond; the water is drawn per pixel below
      }
    }

    // the pond, pixel by pixel: deeper toward the middle, a stone rim, reeds and lily pads
    for (var py = Math.floor((PC.y - 3) * T); py < (PC.y + 3) * T; py++) for (var px = Math.floor((PC.x - 7) * T); px < (PC.x + 7) * T; px++) {
      var pf = pondF((px + 0.5) / T, (py + 0.5) / T);
      if (pf < 1) g.fillStyle = tone(1 - pf * 0.95, ["#4aa3c9", "#3d8fc0", "#2f78a8", "#24628f"], px, py);
      else if (pf < 1.07) g.fillStyle = ["#8f8a7c", "#6f6a5e", "#a8a291", "#7d786b"][(hash(px >> 1, py >> 1) * 4) | 0];
      else if (pf < 1.1) g.fillStyle = "rgba(0,0,0,.18)";
      else continue;
      g.fillRect(px, py, 1, 1);
    }
    for (var n2 = 0; n2 < 26; n2++) {
      var la = hash(n2, 77) * 6.283, lr = 0.25 + hash(77, n2) * 0.6, lx = (PC.x + Math.cos(la) * lr * PC.rx) * T, ly = (PC.y + Math.sin(la) * lr * PC.ry) * T;
      if (pondF(lx / T, ly / T) > 0.85) continue;
      g.fillStyle = "#3f9137"; g.beginPath(); g.arc(lx, ly, 2.6, 0.5, 6.1); g.lineTo(lx, ly); g.fill();
      g.fillStyle = "#58ad47"; g.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 1, 1);
      if (n2 % 4 === 0) { g.fillStyle = "#ff9ec4"; g.fillRect(Math.round(lx), Math.round(ly) - 1, 2, 2); g.fillStyle = "#ffe066"; g.fillRect(Math.round(lx), Math.round(ly) - 1, 1, 1); }
    }
    for (n2 = 0; n2 < 40; n2++) {                          // reeds around the rim
      var ra = hash(n2, 91) * 6.283, rr2 = 1.08, rx0 = (PC.x + Math.cos(ra) * rr2 * PC.rx * 1.05) * T, ry0 = (PC.y + Math.sin(ra) * rr2 * PC.ry * 1.1) * T;
      if (hash(91, n2) < 0.5 || at(Math.floor(rx0 / T), Math.floor(ry0 / T)) === PATH) continue;
      g.fillStyle = "#2f6f2c"; g.fillRect(Math.round(rx0), Math.round(ry0) - 4, 1, 5); g.fillRect(Math.round(rx0) + 2, Math.round(ry0) - 3, 1, 4);
      g.fillStyle = "#6b4a2a"; g.fillRect(Math.round(rx0), Math.round(ry0) - 6, 1, 2);
    }

    // cliffs: a rock face under every drop in level, walls down the sides, stairs where a path climbs
    var ROCK = ["#5c4632", "#7a5f45", "#957658", "#b3936f"];
    for (var cy2 = 1; cy2 < MH; cy2++) for (var cx2 = 0; cx2 < MW; cx2++) {
      var X2 = cx2 * T, Y2 = cy2 * T, L0 = lvl(cx2, cy2), Lup = lvl(cx2, cy2 - 1);
      var isPath = map[cy2][cx2] === PATH, upPath = map[cy2 - 1][cx2] === PATH;
      if (Lup > L0) {
        if (isPath || upPath) {                              // stairs
          for (var st = 0; st < T; st += 3) { r(X2 + 2, Y2 + st, T - 4, 2, "#b99c68"); r(X2 + 2, Y2 + st + 2, T - 4, 1, "#8a6f45"); }
          r(X2, Y2, 2, T, "#6f573f"); r(X2 + T - 2, Y2, 2, T, "#6f573f");
        } else {
          var fh = 11;
          for (var fy2 = 0; fy2 < fh; fy2++) for (var fx2 = 0; fx2 < T; fx2++) {
            var strata = ((fy2 + (hash(cx2, 3) * 3 | 0)) % 4 === 0) ? -0.25 : 0;
            g.fillStyle = tone(0.75 - fy2 / fh * 0.6 + strata + (hash(X2 + fx2, Y2 + fy2) - 0.5) * 0.2, ROCK, X2 + fx2, Y2 + fy2);
            g.fillRect(X2 + fx2, Y2 + fy2, 1, 1);
          }
          r(X2, Y2, T, 1, "#6fbd58");                        // the grass lip hangs over the edge
          for (var lp = 0; lp < T; lp += 2) if (hash(cx2 * 16 + lp, cy2) < 0.5) r(X2 + lp, Y2 + 1, 2, 1, "#57a644");
          r(X2, Y2 + fh, T, 3, "rgba(0,0,0,.22)");            // cast shadow at the foot
        }
      }
      if (lvl(cx2 - 1, cy2) > L0 && !isPath) { r(X2, Y2, 3, T, ROCK[1]); r(X2, Y2, 1, T, ROCK[0]); r(X2 + 3, Y2, 2, T, "rgba(0,0,0,.15)"); }
      if (lvl(cx2 + 1, cy2) > L0 && !isPath) { r(X2 + T - 3, Y2, 3, T, ROCK[1]); r(X2 + T - 1, Y2, 1, T, ROCK[0]); r(X2 + T - 5, Y2, 2, T, "rgba(0,0,0,.15)"); }
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
  var PC = { W: "#f4f4f4", G: "#a9a9a9", K: "#141414" };
  var DINO = {
    a: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...W..W....","...W...W..."],
    b: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...WW.W....","....W..W..."]
  };
  var PTERO = {
    up:   ["..W.......W...","..WW.....WW...","...WW...WW....","....WWWWW.....",".....WWWWWW...","......W......."],
    down: ["..............","....WWWWW.....","..WWW...WWW...",".WW..WWW..WW..",".....WWWWWW...","......W......."]
  };
  function pix(f, flip, ox, oy, pal, w) {
    for (var yy = 0; yy < f.length; yy++) for (var xx = 0; xx < w; xx++) {
      var c = f[yy][flip ? w - 1 - xx : xx];
      if (c !== ".") { ctx.fillStyle = pal[c] || pal.W; ctx.fillRect(ox + xx, oy + yy, 1, 1); }
    }
  }
  function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x - w / 2 + 1, y - 1, w - 2, 1); ctx.fillRect(x - w / 2, y, w, 2); ctx.fillRect(x - w / 2 + 1, y + 2, w - 2, 1); }

  var pi = { x: 28 * T + 8, y: 22 * T + 12, face: 1, dir: "down", dist: 0, boost: 0, path: null, want: null, hop: 0 };
  var rex = { x: 18 * T + 8, y: 25 * T + 10, tx: 0, ty: 0, face: -1, wait: 1, dist: 0, hop: 0, vy: 0 };
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
    if (!open) return;
    var d = dirKey(e);
    if (d) { keys[d] = 1; pi.path = null; pi.want = null; car.target = null; e.preventDefault(); if (egg) egg.t = 99; return; }
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
    if (!open) return;
    if (egg) { egg.t = 99; return; }
    if (riftBusy()) return;
    if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
    var E = S * zoom, wx = camX + e.clientX / E, wy = camY + e.clientY / E;
    var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (car.driving) { car.target = { x: wx, y: wy }; return; }
    // tapped a landmark (its sprite reaches up a couple of tiles)? walk up to it
    var hit = STATIONS.filter(function (s) { return Math.abs(tx - s.x) <= (s.wide ? 1 : 0) && ty <= s.y && ty >= s.y - 2; })[0];
    if (!hit && Math.hypot(wx - rex.x, wy - rex.y + 6) < 12) hit = { id: "rex" };
    if (!hit && Math.hypot(wx - car.x, wy - car.y) < 12) hit = { id: "car", gx: Math.floor(car.x / T), gy: Math.floor(car.y / T) };
    if (!hit) critters.forEach(function (c) { if (!hit && Math.hypot(wx - c.x, wy - c.y + 5) < 10) hit = { id: "critter", ref: c, gx: Math.floor(c.x / T), gy: Math.floor(c.y / T) }; });
    if (!hit && rift && rift.phase === "reign" && Math.hypot(wx - ARENA.x, wy - (ARENA.y - 34)) < 22) hit = { id: "core", x: 28, y: 19 };
    if (hit) {
      var goal = hit.id === "rex" ? [Math.floor(rex.x / T), Math.floor(rex.y / T)] : hit.id === "core" ? [28, 20] : hit.gx !== undefined ? [hit.gx, hit.gy] : [hit.x, hit.y + 1];
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
    if (car.driving) return null;
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
    if (s.id === "car") { toggleCar(); bubble = { text: "pi:~$ vroom. arrows drive, space honks, e parks", t: 3.5 }; return; }
    if (s.id === "critter" || s.id === "bird" || s.id === "pond") { sayLocal(s); return; }
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
  var forced = /[?&]islandhour=([\d.]+)/.exec(location.search);          // ?islandhour=21 previews any hour
  function nyNow() {
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
      var get = function (tp) { for (var i = 0; i < parts.length; i++) if (parts[i].type === tp) return +parts[i].value; return 0; };
      h = get("hour") % 24 + get("minute") / 60;
    } catch (e) {}
    var utc = d.getUTCHours() + d.getUTCMinutes() / 60, off = ((h - utc + 36) % 24) - 12;
    if (forced) h = +forced[1] % 24;
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

  /* ════════ the locals: dinos, robots, cats, cockatiels, koi ════════ */
  var DINOS = {
    trike: { w: 16, pal: { W: "#c77b3b", D: "#8a4f25", L: "#eccb95", H: "#f3ecd8", K: "#1a1a1a" }, sp: 11,
      a: ["...........DD...","..........DWWD.H","...WWWWWWWDWWWHH","..WWWWWWWWWDWWKW",".WWWWWWWWWWWWWWW","WWLLLLLLLLLWWW..","...WW..WW.WW....","...WW..WW.WW...."],
      b: ["...........DD...","..........DWWD.H","...WWWWWWWDWWWHH","..WWWWWWWWWDWWKW",".WWWWWWWWWWWWWWW","WWLLLLLLLLLWWW..","..WW..WW..WW....","...W...W...W...."],
      say: "a triceratops. it's grazing and would like some personal space." },
    brachio: { w: 14, pal: { W: "#5a9e8a", L: "#a9d8c6", K: "#1a1a1a" }, sp: 7,
      a: ["..........WW..",".........WWKW.",".........WWWW.",".........WW...","........WW....","........WW....",".......WW.....",".......WW.....","..WWWWWWW.....",".WWWWWWWWW....","WWWWWWWWWWW...","W.LLLLLLLLL...","..WW.WW.WW....","..WW.WW.WW...."],
      b: ["..........WW..",".........WWKW.",".........WWWW.",".........WW...","........WW....","........WW....",".......WW.....",".......WW.....","..WWWWWWW.....",".WWWWWWWWW....","WWWWWWWWWWW...","W.LLLLLLLLL...",".WW.WW.WW.....","..W..W..W....."],
      say: "a brachiosaurus. it's eating the top off a tree, very slowly." },
    stego: { w: 16, pal: { W: "#6f9a3d", L: "#c9dd9a", O: "#e0782f", K: "#1a1a1a" }, sp: 9,
      a: ["......O.O.......",".....OOOOO......","....OWWWWWO.....","...WWWWWWWWW....","O.WWWWWWWWWWWWW.","OWWWWWWWWWWWWWKW",".WWLLLLLLLLLWW..","...WW..WW..WW...","...WW..WW..WW..."],
      b: ["......O.O.......",".....OOOOO......","....OWWWWWO.....","...WWWWWWWWW....","O.WWWWWWWWWWWWW.","OWWWWWWWWWWWWWKW",".WWLLLLLLLLLWW..","..WW..WW..WW....","...W...W...W...."],
      say: "a stegosaurus. those plates are mostly for show." },
    raptor: { w: 12, pal: { W: "#7b6aa0", L: "#c8bde0", D: "#3d3350", K: "#1a1a1a" }, sp: 24,
      a: [".........WW.","........WWKW","........WWWD","W......WWW..",".WWWWWWWW...","..WWLLWWW...","....WWWWD...","....W..W....","...WW..WW..."],
      b: [".........WW.","........WWKW","........WWWD","W......WWW..",".WWWWWWWW...","..WWLLWWW...","....WWWWD...","...W...W....","..WW...WW..."],
      say: "a velociraptor. it is definitely not testing the fences." },
    baby: { w: 7, pal: { W: "#8fd46b", K: "#1a1a1a" }, sp: 13,
      a: ["....WW.","....WKW","W.WWWW.",".WWWWW.","..W.W.."], b: ["....WW.","....WKW","W.WWWW.",".WWWWW.",".W...W."],
      say: "a baby dino. it squeaks at pi." },
    robot: { w: 8, pal: { M: "#b8c2cc", D: "#5c6670", E: "#4DD6E8", O: "#FF5252" }, sp: 12, paths: true,
      a: ["...O....","...M....",".MMMMMM.",".MEMMEM.",".MMMMMM.","..DDDD..",".MMMMMM.","MMMMMMMM",".M.DD.M.",".DD..DD."],
      b: ["...D....","...M....",".MMMMMM.",".MEMMEM.",".MMMMMM.","..DDDD..",".MMMMMM.","MMMMMMMM",".M.DD.M.","DD....DD"],
      say: ["a maintenance bot. it beeps: 'dns healthy. failover armed.'", "a maintenance bot. it's labeling cables again.", "a maintenance bot. it asks pi if he's tried turning it off and on again."] },
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
    return { kind: kind, x: tx * T + 8, y: ty * T + 10, area: area, tx: 0, ty: 0, wait: Math.random() * 3, face: Math.random() < 0.5 ? 1 : -1, dist: 0, hop: 0, vy: 0, sleep: 0 };
  }
  var critters = [
    critter("trike", 16, 25, [13, 23, 24, 29]), critter("trike", 20, 12, [14, 9, 26, 16]),
    critter("brachio", 41, 16, [36, 13, 46, 20]), critter("stego", 17, 31, [12, 29, 23, 34]),
    critter("raptor", 41, 25, [38, 23, 47, 29]), critter("raptor", 44, 26, [38, 23, 47, 29]),
    critter("baby", 40, 18, [37, 15, 45, 20]), critter("baby", 42, 18, [37, 15, 45, 20]), critter("baby", 19, 26, [15, 24, 23, 28]),
    critter("robot", 30, 22, [18, 15, 37, 22]), critter("robot", 22, 22, [13, 17, 30, 22]), critter("roomba", 28, 22, [26, 21, 31, 23]),
    critter("cat", 36, 31, [33, 28, 44, 33]), critter("cat", 39, 30, [33, 28, 44, 33])
  ];
  // Ammaar's cats: jasmine (pink collar) and prince (blue collar)
  var cats = critters.filter(function (c) { return c.kind === "cat"; });
  cats[0].name = "jasmine"; cats[0].pal = { Q: "#ff7eb6" }; cats[0].say = "jasmine, one of Ammaar's two himalayan cats. she's very fluffy and fully unbothered.";
  cats[1].name = "prince"; cats[1].pal = { Q: "#4f8fff" }; cats[1].say = "prince, one of Ammaar's two himalayan cats. he inspects pi, then goes back to supervising.";
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
    if (c.sleep > 0) { c.sleep -= dt; return; }
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
    var d = DINOS[c.kind], rows = c.sleep > 0 && d.z ? d.z : (Math.floor(c.dist / 4) % 2 ? d.b : d.a);
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
    props.filter(function (p) { return /tree/.test(p.kind) && Math.abs(p.tx - 28) < 9 && Math.abs(p.ty - 22) < 8; }).slice(0, 6).forEach(function (p) {
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
    return { x: (PC.x + Math.cos(a0) * r0 * PC.rx) * T, y: (PC.y + Math.sin(a0) * r0 * PC.ry) * T, a: a0 * 2, v: 11 - len * 0.8 + hash(i, 2) * 3, col: col, len: len, turn: 0 };
  });
  var ripples = [];
  function updateKoi(dt) {
    koi.forEach(function (f) {
      f.turn += (Math.random() - 0.5) * dt * 3; f.turn *= 0.97; f.a += f.turn * dt * 2;
      var nx = f.x + Math.cos(f.a) * f.v * dt, ny = f.y + Math.sin(f.a) * f.v * dt;
      if (pondF((nx + Math.cos(f.a) * f.len) / T, (ny + Math.sin(f.a) * f.len) / T) > 0.86) { f.a += 2.2 + Math.random(); return; }
      f.x = nx; f.y = ny;
      if (Math.random() < dt * 0.08) ripples.push({ x: f.x, y: f.y, r: 1, life: 1 });
    });
    ripples.forEach(function (r) { r.r += dt * 8; r.life -= dt * 0.8; });
    ripples = ripples.filter(function (r) { return r.life > 0; });
  }
  function drawKoi() {
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
  var car = { x: 33 * T + 8, y: 30 * T + 8, a: Math.PI / 2, v: 0, driving: false, target: null };
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

  // one place to ask "what's near pi": landmarks, rex, the locals, the birds, the pond, the car, the core
  function nearCandidates() {
    var out = [];
    STATIONS.forEach(function (s) { out.push({ d: Math.hypot(pi.x - (s.x * T + 8), pi.y - (s.y * T + 12)), max: 26, v: s }); });
    out.push({ d: Math.hypot(pi.x - rex.x, pi.y - rex.y), max: 20, v: { id: "rex", name: "rex" } });
    critters.forEach(function (c) { out.push({ d: Math.hypot(pi.x - c.x, pi.y - c.y), max: 18, v: { id: "critter", ref: c, ax: c.x, ay: c.y - DINOS[c.kind].a.length - 2 } }); });
    birds.forEach(function (b) { if (!b.fly) out.push({ d: Math.hypot(pi.x - b.x, pi.y - b.gy), max: 22, v: { id: "bird", ax: b.x, ay: b.y - 10 } }); });
    out.push({ d: Math.hypot(pi.x - car.x, pi.y - car.y), max: 20, v: { id: "car", ax: car.x, ay: car.y - 14 } });
    var ptx = Math.floor(pi.x / T), pty = Math.floor(pi.y / T);
    if (near(ptx, pty, 1, function (a, b) { return at(a, b) === POND; })) out.push({ d: 21, max: 22, v: { id: "pond", ax: pi.x, ay: pi.y - 16 } });
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
    else if (v.id === "pond") say("the koi pond", "Ammaar's koi pond: about twenty koi, every one a different color and size. kohaku, showa, tancho, chagoi, karasu, a big platinum ogon, and the rest, circling under the lily pads.", []);
    else if (v.id === "car") { say("the M3", "Ammaar's BMW M3. press e to get in, arrows or wasd to drive, space to honk, e again to park." + (TOUCH ? " on touch: tap where you want to go." : ""), [["get in", "#drive"]]); }
  }

  function updateLife(dt) {
    skyT -= dt; if (skyT <= 0) { readSky(); skyT = 30; }
    critters.forEach(function (c) { updateCritter(c, dt); });
    updateBirds(dt); updateKoi(dt); updateCar(dt);
  }

  /* ════════ the rift: an easter egg for finding all eight ════════
     the island darkens, five orbs fall out of the sky, and they fight for
     control of the site. the last one standing takes the core, and runs the
     orbs on the page for the rest of the session. walk up to it for a rematch. */
  var ARENA = { x: 28 * T + 8, y: 19 * T + 8 }, OR = 13;         // centre of the fight, orb radius (world px)
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
    if (riftBusy() || car.driving) { mx = my = 0; pi.path = null; }
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
      var tx = 15 + Math.floor(Math.random() * 10), ty = 23 + Math.floor(Math.random() * 6);
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
    var sh = rift ? rift.shake : 0;
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

    // y-sorted scene
    var list = [];
    critters.forEach(function (c) { list.push({ y: c.y, f: function () { drawCritter(c); } }); });
    birds.forEach(function (b) { list.push({ y: b.fly ? b.gy + 40 : b.gy + 1, f: function () { drawBird(b); } }); });
    list.push({ y: car.y + 8, f: drawCar });
    props.forEach(function (p) {
      if (p.tx < x0 - 2 || p.tx > x1 + 2 || p.ty < y0 - 1 || p.ty > y1 + 3) return;
      list.push({ y: p.ty * T + 14, f: function () {
        var bx = p.tx * T + 8, by = p.ty * T + 14, s = SPR[p.kind];
        if (p.kind !== "rock") shadow(bx, by, p.kind === "palm" || p.kind === "pine" ? 12 : p.kind === "bush" ? 14 : 18);
        if (p.kind === "rock") { ctx.drawImage(s, bx - 9, by - 11 + Math.round(Math.sin(t + p.tx) * 0.5)); return; }
        var sway = p.kind === "palm" && !REDUCED ? Math.round(Math.sin(t * 1.2 + p.tx) * 0.6) : 0;
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

    // clouds drift shadows over everything; the pterodactyl flies above it all
    ctx.fillStyle = "rgba(10,30,50,.08)";
    clouds.forEach(function (c) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.45, 0, 0, 6.283); ctx.fill(); });
    if (ptero.on) {
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(Math.round(ptero.x) + 3, Math.round(ptero.y) + 26, 8, 2);
      drawFrame(PTERO[Math.floor(t * 4) % 2 ? "up" : "down"], { W: "#6a6a6a" }, 14, ptero.x + 7, ptero.y + 5, ptero.vx < 0);
    }

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
    if (bubble) tag(bubble.text, (pi.x - camX) * E, (pi.y - 16 - camY) * E - 6, false);
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
      var e = egg.t, cx = 28 * T + 8, cy = 22 * T + 12, rock = e < 1.6 ? Math.sin(e * (6 + e * 10)) * Math.min(2, e * 1.5) : 0;
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
        pix(FRAMES.idle, false, cx - 5, Math.round(cy - 10 - Math.sin(u * 3.14) * 6), PC, 10);
      }
      return;
    }
    if (car.driving) return;
    shadow(pi.x, pi.y, 10);
    var moving = (keys.u || keys.d || keys.l || keys.r || (pi.path && pi.path.length)) && dlg.hidden;
    var f = pi.dir === "up" ? FRAMES.back : moving ? (Math.floor(pi.dist / 4) % 2 ? FRAMES.walk1 : FRAMES.walk2) : FRAMES.idle;
    var bob = moving ? 0 : Math.round(Math.sin(t * 3) * 0.5);
    drawFrame(f, PC, 10, pi.x, pi.y - 1 + bob, pi.face < 0);
    if (pi.boost > 0) { ctx.fillStyle = "#E879F9"; ctx.fillRect(Math.round(pi.x - 7 - pi.face * 3), Math.round(pi.y - 4), 2, 1); ctx.fillRect(Math.round(pi.x - 8 - pi.face * 5), Math.round(pi.y - 6), 2, 1); }
  }

  function drawStation(s) {
    var bx = s.x * T + 8, by = s.y * T + 15, sp = SPR[s.id];
    if (s.id === "boat") {
      var bob = Math.round(Math.sin(t * 1.5) * 1);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(bx - 16, by + 3 + bob, 34, 1);
      ctx.drawImage(sp, bx - 15, by - 17 + bob); return;
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
      pi.x = 28 * T + 8; pi.y = 22 * T + 12; pi.path = null; keys = {};
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
    closeDialog();
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
