/* pi — resident critter + his floor of things.
   stations: desk (study), server rack (tickets), coffee (speed),
   package (delivery), rocket (orbits the moon).
   drag pi onto anything — or leave him alone and he'll get to it. */
(function () {
  var el = document.getElementById("critter");
  if (!el) return;
  var cv = el.querySelector("canvas"), cx = cv.getContext("2d");
  var bubble = document.getElementById("critter-bubble");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function perf() { return performance.now(); }
  var W = function () { return window.innerWidth; };
  var H = function () { return window.innerHeight; };
  var floorY = function () { return H() - 37; };

  /* ── palette ── */
  var C = { W: "#efefef", G: "#9e9e9e", D: "#5c5c5c", K: "#0a0a0a",
            O: "#FFA94D", Y: "#FFE066", R: "#FF5252", A: "#4ADE80" };

  /* ── pi sprite ── */
  var FRAMES = {
    idle:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG..",".........."],
    blink: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWGWWGWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG..",".........."],
    walk1: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..",".WW....WW.",".GG....GG.",".........."],
    walk2: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","...WWWW...","...GGGG...",".........."],
    held:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..",".WW....WW.","WW......WW","GG......GG",".........."]
  };
  function drawPi(name, flip) {
    cx.clearRect(0, 0, 10, 11);
    var f = FRAMES[name];
    for (var y = 0; y < f.length; y++)
      for (var x = 0; x < 10; x++) {
        var c = f[y][flip ? 9 - x : x];
        if (c !== ".") { cx.fillStyle = C[c]; cx.fillRect(x, y, 1, 1); }
      }
  }

  /* ── prop factory ── */
  function prop(id, pw, ph) {
    var d = document.getElementById(id);
    if (!d) return null;
    var c = d.querySelector("canvas");
    return { el: d, ctx: c.getContext("2d"), pw: pw, ph: ph, x: 0, y: 0,
             visible: function () { return d.offsetParent !== null && getComputedStyle(d).display !== "none"; },
             place: function (x) { this.x = x; this.y = H() - (ph * 3) - 4;
                                   d.style.transform = "translate(" + x + "px," + this.y + "px)"; } };
  }
  var desk   = prop("desk", 28, 18);
  var server = prop("server", 16, 24);
  var coffee = prop("coffee", 10, 11);
  var box    = prop("box", 14, 12);
  var rocket = prop("rocket", 9, 13);

  function px(p, x, y, col) { p.ctx.fillStyle = col; p.ctx.fillRect(x, y, 1, 1); }
  function bar(p, x0, y0, w, h, col) { p.ctx.fillStyle = col; p.ctx.fillRect(x0, y0, w, h); }

  /* ── desk: lamp + book ── */
  var studying = false;
  function drawDesk(t) {
    if (!desk) return;
    desk.ctx.clearRect(0, 0, 28, 18);
    bar(desk, 0, 11, 28, 1, C.G); bar(desk, 0, 12, 28, 1, C.D);       // top
    bar(desk, 2, 13, 2, 5, C.D);  bar(desk, 24, 13, 2, 5, C.D);       // legs
    bar(desk, 20, 10, 4, 1, C.G);                                     // lamp base
    bar(desk, 21, 5, 1, 5, C.G);                                      // arm
    bar(desk, 18, 4, 4, 1, C.W);                                      // head
    if (studying) {
      bar(desk, 18, 5, 3, 1, C.Y);                                    // light
      if (Math.floor(t / 400) % 2) px(desk, 17, 6, "#6b5d2e");        // glow flicker
    }
    bar(desk, 5, 9, 7, 2, C.W);                                       // book
    var split = studying ? (Math.floor(t / 500) % 3) + 7 : 8;
    bar(desk, split, 9, 1, 2, C.D);                                   // page split
  }

  /* ── server rack: LEDs, occasional incident ── */
  var serverDown = false, nextIncident = perf() + 14000;
  function drawServer(t) {
    if (!server) return;
    server.ctx.clearRect(0, 0, 16, 24);
    bar(server, 0, 0, 16, 24, C.D); bar(server, 1, 1, 14, 22, C.K);   // frame
    for (var u = 0; u < 3; u++) {
      var oy = 2 + u * 7;
      bar(server, 2, oy, 12, 6, "#101010");
      for (var v = 0; v < 3; v++) bar(server, 3, oy + 1 + v * 2, 6, 1, "#222");  // vents
      var blink = Math.floor(t / (300 + u * 170)) % 2;
      if (u === 0 && serverDown) px(server, 12, oy + 1, blink ? C.R : "#401414");
      else px(server, 12, oy + 1, blink ? C.A : "#1c4a2c");
      px(server, 12, oy + 4, Math.floor(t / 900 + u) % 2 ? C.G : C.D);
    }
  }

  /* ── coffee: steam ── */
  function drawCoffee(t) {
    if (!coffee) return;
    coffee.ctx.clearRect(0, 0, 10, 11);
    bar(coffee, 1, 10, 8, 1, C.G);                                    // saucer
    bar(coffee, 2, 5, 6, 5, C.W); bar(coffee, 3, 6, 4, 3, C.K);       // cup
    bar(coffee, 3, 5, 4, 1, "#333333");                               // coffee
    px(coffee, 8, 6, C.G); px(coffee, 8, 7, C.G);                     // handle
    if (!REDUCED) {
      var ph = Math.floor(t / 260) % 4;
      if (ph < 3) { px(coffee, 4 + (ph % 2), 3 - ph, ph === 2 ? C.D : C.G); }
    }
  }

  /* ── package ── */
  function drawBox() {
    if (!box) return;
    box.ctx.clearRect(0, 0, 14, 12);
    bar(box, 0, 2, 14, 10, "#6e6e6e"); bar(box, 1, 3, 12, 8, "#383838");  // box
    bar(box, 6, 2, 2, 10, C.G);                                       // tape
    bar(box, 2, 8, 3, 1, C.D);                                        // label
    px(box, 1, 1, "#6e6e6e"); px(box, 12, 1, "#6e6e6e");              // flaps
  }

  /* ── rocket ── */
  var ROCKET = ["....W....","...WWW...","...WWW...","..WWWWW..","..WKKKW..","..WWWWW..","..WWWWW..","..GWWWG..",".WGWWWGW.",".W.WWW.W.","...GGG...",".........","........."];
  function drawRocket(flame, t) {
    if (!rocket) return;
    rocket.ctx.clearRect(0, 0, 9, 13);
    for (var y = 0; y < ROCKET.length; y++)
      for (var x = 0; x < 9; x++) {
        var c = ROCKET[y][x];
        if (c !== ".") { rocket.ctx.fillStyle = C[c]; rocket.ctx.fillRect(x, y, 1, 1); }
      }
    if (!flame) {
      rocket.ctx.fillStyle = Math.floor(t / 600) % 2 ? C.G : C.W;
      rocket.ctx.fillRect(4, 0, 1, 1);
    } else {
      px(rocket, 3, 11, C.O); px(rocket, 5, 11, C.O); px(rocket, 4, 11, C.Y);
      if (Math.floor(t / 90) % 2) px(rocket, 4, 12, C.O);
    }
  }

  /* ── layout ── */
  function layout() {
    if (desk)   desk.place(Math.max(90, W() * 0.13));
    if (coffee) coffee.place(Math.max(210, W() * 0.13 + 130));
    if (server) server.place(W() * 0.46);
    if (box)    box.place(box.placed ? Math.max(8, Math.min(box.x, W() - 140)) : W() * 0.64);
    if (box) box.placed = true;
    if (rocket && !flying) rocket.place(W() - 52);
  }

  /* ── speech ── */
  var QUIPS = [
    "pi:~$ hi. i’m pi.",
    "pi:~$ ammaar is probably studying for net+.",
    "pi:~$ 3.648 gpa. i checked.",
    "pi:~$ aws ccp — passed. certified.",
    "pi:~$ open to internships, btw.",
    "pi:~$ drop me somewhere. i do things.",
    "pi:~$ umd smith, soon.",
    "pi:~$ nightfall hq is one tab away."
  ];
  var STUDY_QUIPS = ["pi:~$ net+ ch.4: subnetting.", "pi:~$ osi layer 3. again.", "pi:~$ flashcards: vlans.", "pi:~$ quiet. midterms."];
  var bubbleT = null;
  function say(msg) {
    bubble.textContent = msg;
    bubble.style.left = Math.max(6, Math.min(W() - 190, x - 30)) + "px";
    bubble.style.top = Math.max(6, y - 30) + "px";
    bubble.classList.add("show");
    clearTimeout(bubbleT);
    bubbleT = setTimeout(function () { bubble.classList.remove("show"); }, 2400);
  }

  /* ── pi state ── */
  var x = Math.min(80, W() - 60), y = floorY();
  var dir = 1, baseVX = 0.45, vx = baseVX, vy = 0, t = 0;
  var mode = REDUCED ? "pause" : "walk";
  var pauseT = REDUCED ? 1e9 : 0;
  var held = false, grabDX = 0, grabDY = 0, moved = 0;
  var actT = 0, boostUntil = 0, ticket = 201;
  var cool = { desk: 0, server: 0, coffee: 0, box: 0 };

  function engage(what) {
    if (REDUCED && what !== "rocket") { say("pi:~$ " + what + ". noted."); return; }
    cool[what] = perf() + (what === "desk" ? 45000 : 28000);
    if (what === "desk") {
      mode = "study"; actT = 420 + Math.random() * 240;
      x = desk.x - 16; dir = 1; studying = true;
      say(STUDY_QUIPS[Math.floor(Math.random() * STUDY_QUIPS.length)]);
    } else if (what === "coffee") {
      mode = "drink"; actT = 100; x = coffee.x - 24; dir = 1;
    } else if (what === "server") {
      mode = "fix"; actT = serverDown ? 150 : 70; x = server.x - 26; dir = 1;
    } else if (what === "box") {
      mode = "push"; actT = 160; dir = x < box.x ? 1 : -1;
      x = dir === 1 ? box.x - 26 : box.x + 44;
    }
  }
  function endAct(what) {
    studying = false;
    if (what === "study") say("pi:~$ break. earned.");
    if (what === "drink") { boostUntil = perf() + 8000; say("pi:~$ caffeinated. zoom."); }
    if (what === "fix") {
      if (serverDown) { serverDown = false; nextIncident = perf() + 20000 + Math.random() * 30000; say("pi:~$ ticket closed. that’s " + (ticket++) + "."); }
      else say("pi:~$ all green. carry on.");
    }
    if (what === "push") say("pi:~$ out for delivery.");
    mode = REDUCED ? "pause" : "walk";
  }

  /* ── rocket flight (orbits the moon) ── */
  var flying = false, flightT0 = 0, rAngle = 0, prevRX = 0, prevRY = 0;
  var FL = { board: 600, ascend: 900, orbit: 4200, ret: 900 };
  function moonCenter() {
    var g = document.getElementById("moon-art");
    if (g) {
      var r = g.getBoundingClientRect();
      var cx0 = r.left + r.width / 2, cy0 = r.top + r.height / 2;
      if (cy0 > -100 && cy0 < H() + 100)
        return { x: cx0, y: cy0, rx: r.width * 0.62 + 26, ry: r.height * 0.40 + 18 };
    }
    return { x: W() / 2, y: H() * 0.4, rx: W() * 0.3, ry: H() * 0.18 };
  }
  function orbitPoint(a, g) { return { x: g.x + Math.cos(a) * g.rx - 13, y: g.y + Math.sin(a) * g.ry - 19 }; }
  function padPos() { return { x: W() - 52, y: H() - 43 }; }
  function flyStep(now) {
    var e = now - flightT0, g = moonCenter(), A0 = 0.9, p = padPos(), u, o;
    prevRX = rocket.x; prevRY = rocket.y;
    if (e < FL.board) {
      rocket.x = p.x + Math.sin(e / 28) * 1.6; rocket.y = p.y;
      rocket.el.style.zIndex = 79;
    } else if (e < FL.board + FL.ascend) {
      u = (e - FL.board) / FL.ascend; u = 1 - Math.pow(1 - u, 3);
      o = orbitPoint(A0, g);
      rocket.x = p.x + (o.x - p.x) * u; rocket.y = p.y + (o.y - p.y) * u;
    } else if (e < FL.board + FL.ascend + FL.orbit) {
      u = (e - FL.board - FL.ascend) / FL.orbit;
      var a = A0 - u * Math.PI * 4;
      o = orbitPoint(a, g);
      rocket.x = o.x; rocket.y = o.y;
      var behind = Math.sin(a) < -0.15;
      rocket.el.style.zIndex = behind ? 0 : 79;
      rocket.el.style.opacity = behind ? 0.55 : 1;
    } else if (e < FL.board + FL.ascend + FL.orbit + FL.ret) {
      u = (e - FL.board - FL.ascend - FL.orbit) / FL.ret; u = 1 - Math.pow(1 - u, 3);
      o = orbitPoint(A0 - Math.PI * 4, g);
      rocket.x = o.x + (p.x - o.x) * u; rocket.y = o.y + (p.y - o.y) * u;
      rocket.el.style.zIndex = 79; rocket.el.style.opacity = 1;
    } else {
      flying = false; layout();
      rocket.el.style.transform = "translate(" + rocket.x + "px," + rocket.y + "px)";
      x = rocket.x - 26; y = floorY(); mode = REDUCED ? "pause" : "walk"; dir = -1;
      el.style.display = "";
      say("pi:~$ orbit complete.");
      return;
    }
    var dx = rocket.x - prevRX, dy = rocket.y - prevRY;
    rAngle = (e > FL.board && (dx || dy)) ? Math.atan2(dy, dx) * 180 / Math.PI + 90 : 0;
    rocket.el.style.transform = "translate(" + rocket.x + "px," + rocket.y + "px) rotate(" + rAngle + "deg)";
    drawRocket(e > FL.board, now);
  }

  /* ── auto engage while walking ── */
  function maybeEngage() {
    var now = perf();
    var spots = [
      desk && desk.visible() && { k: "desk", ax: desk.x - 16 },
      coffee && coffee.visible() && { k: "coffee", ax: coffee.x - 24 },
      server && server.visible() && { k: "server", ax: server.x - 26 },
      box && box.visible() && { k: "box", ax: box.x - 26 }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      if (!s || now < cool[s.k]) continue;
      if (Math.abs(x - s.ax) < 2.2 && Math.random() < (s.k === "server" && serverDown ? 0.9 : 0.35)) {
        engage(s.k); return;
      }
    }
  }

  function overlaps(p, pad) {
    if (!p || !p.visible()) return false;
    var a = el.getBoundingClientRect(), b = p.el.getBoundingClientRect();
    pad = pad || 6;
    return !(a.right < b.left - pad || a.left > b.right + pad || a.bottom < b.top - pad || a.top > b.bottom + pad);
  }

  /* ── main loop ── */
  function step(now) {
    t++;
    now = now || perf();
    drawDesk(now); drawServer(now); drawCoffee(now); drawBox();
    if (!serverDown && now > nextIncident && !REDUCED) { serverDown = true; }
    if (flying) { flyStep(now); requestAnimationFrame(step); return; }

    drawRocket(false, now);
    rocket.el.style.transform = "translate(" + rocket.x + "px," + rocket.y + "px)";

    if (held) {
      drawPi("held", dir < 0);
    } else if (mode === "fall") {
      vy += 0.55; y += vy;
      if (y >= floorY()) { y = floorY(); vy = 0; mode = REDUCED ? "pause" : "walk"; }
      drawPi("held", dir < 0);
    } else if (mode === "study") {
      actT--;
      drawPi(t % 110 < 8 ? "blink" : "idle", false);
      if (actT <= 0) endAct("study");
    } else if (mode === "drink" || mode === "fix" || mode === "push") {
      actT--;
      if (mode === "push") {
        var pv = 0.35;
        x += pv * dir; box.x += pv * dir;
        box.x = Math.max(8, Math.min(box.x, W() - 140));
        box.el.style.transform = "translate(" + box.x + "px," + box.y + "px)";
        drawPi(t % 16 < 8 ? "walk1" : "walk2", dir < 0);
      } else {
        drawPi(t % 30 < 15 ? "idle" : "blink", dir < 0);
      }
      if (actT <= 0) endAct(mode);
    } else if (mode === "pause") {
      pauseT--;
      if (pauseT <= 0 && !REDUCED) { mode = "walk"; dir = Math.random() < 0.5 ? -1 : 1; }
      drawPi(t % 90 < 6 ? "blink" : "idle", dir < 0);
    } else {
      vx = now < boostUntil ? baseVX * 1.9 : baseVX;
      x += vx * dir;
      if (x < 8) { x = 8; dir = 1; }
      if (x > W() - 86) { x = W() - 86; dir = -1; }
      if (Math.random() < 0.004) { mode = "pause"; pauseT = 90 + Math.random() * 200; }
      y = floorY();
      maybeEngage();
      drawPi(t % 16 < 8 ? "walk1" : "walk2", dir < 0);
    }
    el.style.transform = "translate(" + x + "px," + y + "px)";
    requestAnimationFrame(step);
  }

  /* ── input ── */
  el.addEventListener("pointerdown", function (e) {
    if (flying) return;
    held = true; moved = 0; studying = false;
    grabDX = e.clientX - x; grabDY = e.clientY - y;
    el.classList.add("held");
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener("pointermove", function (e) {
    if (!held) return;
    var nx = e.clientX - grabDX, ny = e.clientY - grabDY;
    moved += Math.abs(nx - x) + Math.abs(ny - y);
    x = Math.max(0, Math.min(W() - 30, nx));
    y = Math.max(0, Math.min(floorY(), ny));
  });
  el.addEventListener("pointerup", function () {
    if (!held) return;
    held = false; el.classList.remove("held");
    if (moved < 6) {
      say(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
      mode = "pause"; pauseT = 120;
    } else if (overlaps(rocket) && !flying) {
      el.style.display = "none";
      flying = true; flightT0 = perf();
      say("pi:~$ launching...");
    } else if (overlaps(desk)) { y = floorY(); engage("desk"); }
    else if (overlaps(coffee)) { y = floorY(); engage("coffee"); }
    else if (overlaps(server)) { y = floorY(); engage("server"); }
    else if (overlaps(box)) { y = floorY(); engage("box"); }
    else if (y < floorY()) { vy = 0; mode = "fall"; }
  });
  window.addEventListener("resize", function () {
    x = Math.min(x, W() - 38);
    if (!held && mode !== "fall" && !flying) y = floorY();
    layout();
  });

  layout();
  drawPi("idle", false);
  requestAnimationFrame(step);
  setTimeout(function () { if (!held && !flying) say("pi:~$ hi. i’m pi."); }, 2600);
  /* demo the desk once, early, if nobody's touched him */
  setTimeout(function () {
    if (!held && !flying && mode === "walk" && desk && desk.visible()) engage("desk");
  }, 9000);
})();
