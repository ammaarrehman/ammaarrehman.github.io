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
  for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) {
    var ex = (x + 0.5 - 35) / 3.4, ey = (y + 0.5 - 25) / 2.3;
    if (ex * ex + ey * ey < 1 && map[y][x] === GRASS) map[y][x] = POND;
  }
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

  /* ════════ the portfolio, as landmarks ════════ */
  var GH = "https://github.com/ammaarrehman/";
  var STATIONS = [
    { id: "sign", x: 26, y: 20, name: "signpost", text: "pi's island. walk with wasd or the arrow keys, or tap where you want to go. press e or space next to anything to look at it. eight landmarks hold Ammaar's work. the boat at the dock takes you back." },
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
  var props = [];     // trees, palms, rocks: static, y-sorted with everything else
  for (y = 1; y < MH - 1; y++) for (x = 1; x < MW - 1; x++) {
    var t = map[y][x], h = hash(x, y);
    if (t === GRASS) {
      var f = Math.sin(x * 0.42 + 1) + Math.sin(y * 0.5 + 2) + Math.sin((x + y) * 0.27 + 0.5);
      if ((f > 0.7 && h < 0.72) || h < 0.07) {
        if (near(x, y, 1, function (a, b) { return at(a, b) === PATH || at(a, b) === POND || solid[k(a, b)] || nearStation(a, b); })) continue;
        props.push({ kind: h < 0.36 ? "tree" : "tree2", tx: x, ty: y }); solid[k(x, y)] = 1;
      }
    } else if (t === SAND && h < 0.09) {
      if (near(x, y, 1, function (a, b) { return at(a, b) === PATH || at(a, b) === DOCK || solid[k(a, b)] || nearStation(a, b); })) continue;
      props.push({ kind: "palm", tx: x, ty: y, flip: h < 0.045 }); solid[k(x, y)] = 1;
    } else if (t === SHAL && h < 0.02 && Math.abs(x - CX) > 3) {
      props.push({ kind: "rock", tx: x, ty: y });
    }
  }
  function walkable(x, y) { var t = at(x, y); return (land(t) || t === DOCK) && !solid[k(x, y)]; }
  function solidPx(px, py) { return !walkable(Math.floor(px / T), Math.floor(py / T)); }

  /* ════════ sprites (drawn once into little canvases) ════════ */
  function sprite(w, h, fn) { var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
  function blob(r, cx, cy, rad, col) { for (var j = -rad; j <= rad; j++) { var w = Math.round(Math.sqrt(rad * rad - j * j)); r(cx - w, cy + j, w * 2, 1, col); } }
  var SPR = {
    tree: sprite(32, 42, function (r) {
      r(14, 28, 5, 12, "#6b4424"); r(17, 28, 2, 12, "#553519");
      blob(r, 16, 17, 14, "#2c6a2b"); blob(r, 15, 15, 12, "#3b8a34"); blob(r, 12, 11, 7, "#52a843"); blob(r, 10, 9, 3, "#6fc157");
      [[21, 20], [8, 21], [19, 8], [24, 14]].forEach(function (p) { r(p[0], p[1], 2, 2, "#2c6a2b"); });
    }),
    tree2: sprite(32, 44, function (r) {
      r(14, 30, 5, 12, "#6b4424"); r(17, 30, 2, 12, "#553519");
      blob(r, 16, 24, 11, "#2a6128"); blob(r, 16, 13, 11, "#347d30"); blob(r, 14, 18, 9, "#3f9137"); blob(r, 12, 9, 5, "#5bb14a");
      r(20, 26, 2, 2, "#d95b5b"); r(9, 20, 2, 2, "#d95b5b"); r(22, 15, 2, 2, "#d95b5b");   // fruit
    }),
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

  /* ════════ ground, drawn once ════════ */
  var COL = { deep: "#1f4e79", deep2: "#1a4470", shal: "#3d8fc4", shal2: "#4fa3d6", sand: "#ecd9a0", sand2: "#dcc586", wetsand: "#cdb57a",
              grass: "#5aa846", grass2: "#4b9339", grass3: "#74c257", path: "#cfae74", path2: "#bb9a60", pond: "#4aa3c9", pondrim: "#3b86a8", dock: "#8b5e34", dock2: "#6e4826" };
  var ground = document.createElement("canvas"); ground.width = MW * T; ground.height = MH * T;
  (function paint() {
    var g = ground.getContext("2d");
    function r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    var N = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var ty = 0; ty < MH; ty++) for (var tx = 0; tx < MW; tx++) {
      var t = map[ty][tx], X = tx * T, Y = ty * T, i, j, hh;
      if (t === DEEP) {
        r(X, Y, T, T, COL.deep);
        for (i = 0; i < 3; i++) { hh = hash(tx * 3 + i, ty * 5); r(X + ((hh * 13) | 0), Y + ((hash(ty, tx * 7 + i) * 15) | 0), 3, 1, COL.deep2); }
      } else if (t === SHAL || t === DOCK) {
        var nearLand = N.some(function (n) { return land(at(tx + n[0], ty + n[1])); });
        r(X, Y, T, T, nearLand ? COL.shal2 : COL.shal);
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
        r(X, Y, T, T, COL.grass);
        for (i = 0; i < 6; i++) { hh = hash(tx * 5 + i, ty * 9); r(X + ((hh * 15) | 0), Y + ((hash(ty * 7 + i, tx * 2) * 14) | 0), 1, 2, hh < 0.5 ? COL.grass2 : COL.grass3); }
        hh = hash(tx * 31, ty * 17);
        if (hh < 0.06) { var fc = ["#ff8fb1", "#ffe066", "#ffffff", "#c9a4ff"][(hh * 66 | 0) % 4]; r(X + 6, Y + 6, 1, 1, fc); r(X + 5, Y + 7, 3, 1, fc); r(X + 6, Y + 8, 1, 1, fc); r(X + 6, Y + 7, 1, 1, "#ffcf33"); }
        else if (hh < 0.14) { r(X + 4, Y + 9, 1, 3, COL.grass2); r(X + 6, Y + 8, 1, 4, COL.grass2); r(X + 8, Y + 9, 1, 3, COL.grass2); }
      } else if (t === POND) {
        r(X, Y, T, T, COL.pond);
        N.forEach(function (n, q) {
          if (at(tx + n[0], ty + n[1]) !== POND) { if (q === 0) r(X, Y, T, 2, COL.pondrim); if (q === 1) r(X + T - 2, Y, 2, T, COL.pondrim); if (q === 2) r(X, Y + T - 2, T, 2, COL.pondrim); if (q === 3) r(X, Y, 2, T, COL.pondrim); }
        });
        if (hash(tx * 7, ty * 11) < 0.25) { r(X + 5, Y + 5, 5, 4, "#3f9137"); r(X + 6, Y + 4, 3, 1, "#3f9137"); r(X + 8, Y + 6, 1, 1, "#ff8fb1"); }
      }
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
  var W = 0, H = 0, dpr = 1, S = 3, zoom = 1, zoomTo = 1, camX = 0, camY = 0;
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
    if (d) { keys[d] = 1; pi.path = null; pi.want = null; e.preventDefault(); if (egg) egg.t = 99; return; }
    if (e.key === "Escape") { e.preventDefault(); if (!dlg.hidden) closeDialog(); else exit(); return; }
    if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "A") return;   // let links work
      e.preventDefault();
      if (egg) { egg.t = 99; return; }
      if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
      var s = nearby(); if (s) interact(s);
    }
  });
  window.addEventListener("keyup", function (e) { var d = dirKey(e); if (d) keys[d] = 0; });
  window.addEventListener("blur", function () { keys = {}; });

  cv.addEventListener("pointerdown", function (e) {
    if (!open) return;
    if (egg) { egg.t = 99; return; }
    if (!dlg.hidden) { typing ? finishTyping() : closeDialog(); return; }
    var E = S * zoom, wx = camX + e.clientX / E, wy = camY + e.clientY / E;
    var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    // tapped a landmark (its sprite reaches up a couple of tiles)? walk up to it
    var hit = STATIONS.filter(function (s) { return Math.abs(tx - s.x) <= (s.wide ? 1 : 0) && ty <= s.y && ty >= s.y - 2; })[0];
    if (!hit && Math.hypot(wx - rex.x, wy - rex.y + 6) < 12) hit = { id: "rex" };
    if (hit) {
      var goal = hit.id === "rex" ? [Math.floor(rex.x / T), Math.floor(rex.y / T)] : [hit.x, hit.y + 1];
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
    var best = null, bd = 26;
    STATIONS.forEach(function (s) {
      var d = Math.hypot(pi.x - (s.x * T + 8), pi.y - (s.y * T + 12));
      if (d < bd) { bd = d; best = s; }
    });
    if (Math.hypot(pi.x - rex.x, pi.y - rex.y) < 20) best = { id: "rex", name: "rex" };
    return best;
  }

  /* ════════ dialog ════════ */
  var typing = null, full = "";
  var REX = ["rex: RAWR. (he means hi.)", "rex does a little hop. he's a chrome-dino homage and he knows it.", "rex: have you tried turning the router off and on again?", "rex is guarding the meadow from pterodactyls. so far, so good."];
  function interact(s) {
    pi.path = null; pi.want = null; keys = {};
    if (s.id === "rex") { rex.hop = 1; rex.vy = -2.2; say("rex", REX[(Math.random() * REX.length) | 0], []); return; }
    if (s.id === "drink") pi.boost = 10;
    if (s.found && !found[s.id]) {
      found[s.id] = 1; paintFound();
      try { sessionStorage.setItem("pi-found", JSON.stringify(Object.keys(found))); } catch (e) {}
    }
    var extra = Object.keys(found).length === TOTAL && s.found ? " (that's all eight. pi is proud of you.)" : "";
    say(s.name, s.text + extra, s.links || []);
  }
  function say(name, text, links) {
    dName.textContent = name; dLinks.innerHTML = ""; dlg.hidden = false;
    links.forEach(function (l) {
      var a = document.createElement("a"); a.textContent = l[0]; a.href = l[1] === "#exit" ? "#" : l[1];
      if (/^https?:|^mailto:/.test(l[1])) { a.target = "_blank"; a.rel = "noopener"; }
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
  function closeDialog() { finishTyping(); dlg.hidden = true; cv.focus({ preventScroll: true }); }
  function paintFound() { foundEl.textContent = "found " + Object.keys(found).filter(function (id) { return STATIONS.some(function (s) { return s.id === id && s.found; }); }).length + "/" + TOTAL; }
  paintFound();

  /* ════════ simulation ════════ */
  function move(o, dx, dy) {
    var hw = 4;
    if (dx && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y - 2) && !solidPx(o.x + dx + (dx > 0 ? hw : -hw), o.y + 1)) o.x += dx;
    if (dy && !solidPx(o.x - hw, o.y + dy + (dy > 0 ? 1 : -2)) && !solidPx(o.x + hw, o.y + dy + (dy > 0 ? 1 : -2))) o.y += dy;
  }
  function update(dt) {
    if (egg) { egg.t += dt; if (egg.t > 2.2) { egg = null; bubble = { text: "pi:~$ fresh hatch. hi.", t: 3 }; } return; }
    var sp = (pi.boost > 0 ? 95 : 58) * dt; pi.boost = Math.max(0, pi.boost - dt);
    var mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (!dlg.hidden) mx = my = 0;
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
    camX = Math.max(0, Math.min(MW * T - VW, pi.x - VW / 2)); camY = Math.max(0, Math.min(MH * T - VH, pi.y - VH / 2));
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

    // y-sorted scene
    var list = [];
    props.forEach(function (p) {
      if (p.tx < x0 - 2 || p.tx > x1 + 2 || p.ty < y0 - 1 || p.ty > y1 + 3) return;
      list.push({ y: p.ty * T + 14, f: function () {
        var bx = p.tx * T + 8, by = p.ty * T + 14, s = SPR[p.kind];
        if (p.kind !== "rock") shadow(bx, by, p.kind === "palm" ? 12 : 18);
        if (p.kind === "rock") { ctx.drawImage(s, bx - 8, by - 10 + Math.round(Math.sin(t + p.tx) * 0.5)); return; }
        var sway = p.kind === "palm" && !REDUCED ? Math.round(Math.sin(t * 1.2 + p.tx) * 0.6) : 0;
        if (p.flip) { ctx.save(); ctx.translate(bx * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(s, bx - s.width / 2 + sway, by - s.height + 2);
        if (p.flip) ctx.restore();
      } });
    });
    STATIONS.forEach(function (s) { list.push({ y: s.y * T + 15, f: function () { drawStation(s); } }); });
    list.push({ y: rex.y, f: function () {
      shadow(rex.x, rex.y, 10);
      pix(DINO[Math.floor(rex.dist / 5) % 2 ? "b" : "a"], rex.face < 0, Math.round(rex.x - 5), Math.round(rex.y - 13 + rex.hop), { W: "#ececec", K: "#141414" }, 11);
    } });
    list.push({ y: pi.y, f: drawPi });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // clouds drift shadows over everything; the pterodactyl flies above it all
    ctx.fillStyle = "rgba(10,30,50,.08)";
    clouds.forEach(function (c) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.45, 0, 0, 6.283); ctx.fill(); });
    if (ptero.on) {
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(Math.round(ptero.x) + 3, Math.round(ptero.y) + 26, 8, 2);
      pix(PTERO[Math.floor(t * 4) % 2 ? "up" : "down"], ptero.vx < 0, Math.round(ptero.x), Math.round(ptero.y), { W: "#5c5c5c" }, 14);
    }

    // screen-space overlays: prompts and speech
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var nb = !egg && dlg.hidden ? nearby() : null;
    if (nb) {
      // float the prompt just above the landmark's own sprite
      var topY = nb.id === "rex" ? rex.y - 15 : nb.id === "boat" ? nb.y * T : nb.y * T + 16 - SPR[nb.id].height;
      var sx = ((nb.id === "rex" ? rex.x : nb.x * T + 8) - camX) * E, sy = (topY - camY) * E - 6 + Math.sin(t * 4) * 2;
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
    shadow(pi.x, pi.y, 10);
    var moving = (keys.u || keys.d || keys.l || keys.r || (pi.path && pi.path.length)) && dlg.hidden;
    var f = pi.dir === "up" ? FRAMES.back : moving ? (Math.floor(pi.dist / 4) % 2 ? FRAMES.walk1 : FRAMES.walk2) : FRAMES.idle;
    var bob = moving ? 0 : Math.round(Math.sin(t * 3) * 0.5);
    pix(f, pi.face < 0, Math.round(pi.x - 5), Math.round(pi.y - 10 + bob), PC, 10);
    if (pi.boost > 0) { ctx.fillStyle = "#E879F9"; ctx.fillRect(Math.round(pi.x - 7 - pi.face * 3), Math.round(pi.y - 4), 2, 1); ctx.fillRect(Math.round(pi.x - 8 - pi.face * 5), Math.round(pi.y - 6), 2, 1); }
  }

  function drawStation(s) {
    var bx = s.x * T + 8, by = s.y * T + 15, sp = SPR[s.id];
    if (s.id === "boat") {
      var bob = Math.round(Math.sin(t * 1.5) * 1);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(bx - 16, by + 3 + bob, 34, 1);
      ctx.drawImage(sp, bx - 14, by - 16 + bob); return;
    }
    shadow(bx, by, s.id === "desk" ? 30 : 14);
    ctx.drawImage(sp, Math.round(bx - sp.width / 2), by - sp.height + 1);
    var ox = Math.round(bx - sp.width / 2), oy = by - sp.height + 1, blink = Math.floor(t * 3);
    if (s.id === "rack") for (var i = 0; i < 6; i++) { ctx.fillStyle = hash(i, blink) < 0.2 ? "#FFB000" : (hash(i + 9, blink) < 0.7 ? "#4ADE80" : "#1c3a24"); ctx.fillRect(ox + 11, oy + 4 + i * 4, 1, 1); ctx.fillStyle = hash(i, blink + 3) < 0.5 ? "#4DD6E8" : "#16323a"; ctx.fillRect(ox + 12, oy + 4 + i * 4, 1, 1); }
    if (s.id === "desk") { ctx.fillStyle = "#0b1a12"; ctx.fillRect(ox + 9, oy + 2, 13, 8); for (i = 0; i < 4; i++) { ctx.fillStyle = "#4ADE80"; ctx.fillRect(ox + 10, oy + 3 + i * 2, 3 + ((hash(i, blink) * 8) | 0), 1); } if (blink % 2) ctx.fillRect(ox + 10 + 11, oy + 9, 1, 1); }
    if (s.id === "tower") { ctx.strokeStyle = "#4ADE80"; ctx.lineWidth = 1; ctx.beginPath(); for (i = 0; i < 13; i++) { var gy = oy + 9 - Math.round((Math.sin(t * 2 + i * 0.8) * 0.5 + 0.5) * 4); if (i) ctx.lineTo(ox + 5 + i, gy + 0.5); else ctx.moveTo(ox + 5, gy + 0.5); } ctx.stroke(); }
    if (s.id === "uplink" && blink % 2) { ctx.fillStyle = "#FF5252"; ctx.fillRect(ox + 9, oy, 2, 1); }
    if (s.id === "macbook") { ctx.fillStyle = "rgba(139,92,246," + (0.5 + Math.sin(t * 2) * 0.3).toFixed(2) + ")"; ctx.fillRect(ox + 11, oy + 5, 8, 6); }
    if (s.id === "mailbox") { ctx.fillStyle = "#FFB000"; ctx.fillRect(ox + 10, oy + (found.mailbox ? 1 : 3), 2, found.mailbox ? 4 : 2); }
    if (s.id === "lighthouse") {
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
        var col = s.c < 0.45 ? "244,84,166" : s.c < 0.8 ? "255,150,205" : "236,236,236";   // the orb's pinks, and white
        wctx.strokeStyle = "rgba(" + col + "," + (0.25 + 0.6 * Math.sin(p * Math.PI)).toFixed(3) + ")";
        wctx.lineWidth = 1 + prog * 2;
        wctx.beginPath(); wctx.moveTo(c[0] + Math.cos(s.a) * Math.max(0, r0), c[1] + Math.sin(s.a) * Math.max(0, r0)); wctx.lineTo(c[0] + Math.cos(s.a) * r1, c[1] + Math.sin(s.a) * r1); wctx.stroke();
      });
      // a white bloom at the peak of the jump
      if (dir > 0 && p > 0.75) { wctx.fillStyle = "rgba(255,236,246," + ((p - 0.75) * 4 * 0.9).toFixed(3) + ")"; wctx.fillRect(0, 0, innerWidth, innerHeight); }
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
