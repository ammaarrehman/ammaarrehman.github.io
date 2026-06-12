/* pi — resident critter. the hero is his room.
   stations: desk+pc (he codes), macbook (design review), homelab
   (he closes tickets), drink (speed boost). window has the moon.
   drag pi onto things — or leave him alone and he'll get to it. */
(function () {
  var canvas = document.getElementById("room");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var wrap = canvas.parentElement;
  var bubble = document.getElementById("room-bubble");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function perf() { return performance.now(); }

  var RW = 168, RH = 104, FLOOR = 88;   // room units (1 unit = 1 chunky pixel)

  /* ── palette ── */
  var C = { W: "#efefef", G: "#9e9e9e", D: "#5c5c5c", K: "#0a0a0a",
            O: "#FFA94D", Y: "#FFE066", R: "#FF5252", A: "#4ADE80" };

  /* deterministic hash → stable noise (no flicker) */
  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177 | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  /* ── pi sprite ── */
  var FRAMES = {
    idle:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG..",".........."],
    blink: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWGWWGWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","..WW..WW..","..GG..GG..",".........."],
    walk1: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..",".WW....WW.",".GG....GG.",".........."],
    walk2: ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..","..WW..WW..","...WWWW...","...GGGG...",".........."],
    held:  ["....W.....","..WWWWWW..",".WWWWWWWW.",".WWKWWKWW.",".WWWWWWWW.",".WWWWWWWW.","..GWWWWG..",".WW....WW.","WW......WW","GG......GG",".........."]
  };
  function drawPi(name, flip, ox, oy) {
    var f = FRAMES[name];
    ox = Math.round(ox); oy = Math.round(oy);
    for (var y = 0; y < f.length; y++)
      for (var x = 0; x < 10; x++) {
        var c = f[y][flip ? 9 - x : x];
        if (c !== ".") { ctx.fillStyle = C[c]; ctx.fillRect(ox + x, oy + y, 1, 1); }
      }
  }

  /* ── room state ── */
  var pcOn = false, macLid = 0, macGlow = false, labDown = false;
  var nextIncident = perf() + 16000, ticket = 201;

  function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

  /* ── static shell: wall, floor, noise ── */
  function drawShell(t) {
    rect(0, 0, RW, RH, "#050505");
    // sparse wall noise glyph-dots, stable
    for (var i = 0; i < RW; i += 3)
      for (var j = 0; j < FLOOR; j += 3) {
        var h = hash(i, j);
        if (h < 0.015) { ctx.fillStyle = h < 0.006 ? "#171c2b" : "#161616"; ctx.fillRect(i, j, 1, 1); }
      }
    rect(0, FLOOR, RW, 1, "#262626");          // floor line
    rect(0, FLOOR + 1, RW, RH - FLOOR - 1, "#0d0d0d");  // floor band
    for (var k = 0; k < RW; k += 14) rect(k, FLOOR + 6, 7, 1, "#141414"); // planks
    // shelf over the desk: net+ books
    rect(56, 53, 26, 1, "#3a3a3a");
    rect(58, 48, 2, 5, "#5c5c5c"); rect(61, 48, 2, 5, "#2e4438");
    rect(64, 49, 2, 4, "#9e9e9e"); rect(67, 48, 1, 5, "#7e7e7e");
    rect(70, 50, 3, 3, "#1c1c1c");               // tiny frame
    ctx.fillStyle = "#efefef"; ctx.fillRect(71, 51, 1, 1);
  }

  /* ── window: stars + crescent (the nightfall nod) ── */
  function drawWindow(t) {
    rect(118, 10, 38, 32, "#262626");           // frame
    rect(119, 11, 36, 30, "#030303");           // night
    rect(136, 11, 1, 30, "#1c1c1c");            // mullion
    rect(119, 25, 36, 1, "#1c1c1c");
    for (var i = 0; i < 30; i++) {              // stable stars, 2 accent
      var sx = 120 + Math.floor(hash(i, 7) * 34), sy = 12 + Math.floor(hash(7, i) * 28);
      var h = hash(i, i + 13);
      if (h < 0.8) {
        var tw = Math.floor(t / (700 + i * 37)) % 5 === 0;
        ctx.fillStyle = h < 0.07 ? "#5B8DEF" : (h < 0.12 ? "#FF5252" : (tw ? "#9e9e9e" : "#4a4a4a"));
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    // crescent moon
    ctx.fillStyle = "#efefef";
    [[146,14,3],[145,15,4],[144,16,4],[144,17,3],[144,18,3],[145,19,3],[146,20,2]].forEach(function (r) {
      ctx.fillRect(r[0], r[1], r[2], 1);
    });
    ctx.fillStyle = "#030303";
    ctx.fillRect(147, 15, 2, 4); ctx.fillRect(146, 16, 2, 2);
  }

  /* ── poster: green film print + red seal (pinterest homage) ── */
  function drawPoster() {
    rect(8, 44, 20, 28, "#11201a");              // green-tinted print
    rect(8, 44, 20, 1, "#1c1c1c"); rect(8, 71, 20, 1, "#1c1c1c");
    rect(8, 44, 1, 28, "#1c1c1c"); rect(27, 44, 1, 28, "#1c1c1c");
    rect(10, 47, 16, 9, "#1d3326");              // image block
    rect(12, 50, 5, 2, "#3a5c46");               // figures
    rect(19, 49, 4, 3, "#3a5c46");
    rect(10, 59, 12, 1, "#cfcfcf");              // title bar
    rect(10, 62, 8, 1, "#5c5c5c");               // subtitle
    rect(10, 65, 10, 1, "#2e4438");              // kana line
    rect(24, 67, 2, 2, "#FF5252");               // hanko seal
  }

  /* ── drink: cup on a side table ── */
  function drawDrink(t, sipping) {
    rect(24, 83, 16, 1, C.G); rect(24, 84, 16, 1, "#3a3a3a");   // table top
    rect(25, 85, 1, 3, "#3a3a3a"); rect(38, 85, 1, 3, "#3a3a3a"); // legs
    rect(28, 78, 6, 5, C.W); rect(29, 79, 4, 2, "#333333");     // cup + coffee
    rect(34, 79, 1, 2, C.G);                                    // handle
    if (!REDUCED) {                                             // steam
      var ph = Math.floor(t / 240) % 4;
      if (ph < 3) { ctx.fillStyle = ph === 2 ? "#3a3a3a" : "#5c5c5c"; ctx.fillRect(29 + (ph % 2) * 2, 75 - ph, 1, 1); }
      if (sipping && Math.floor(t / 120) % 2) { ctx.fillStyle = "#5c5c5c"; ctx.fillRect(31, 73, 1, 1); }
    }
  }

  /* ── desk + pc ── */
  function drawDesk(t) {
    rect(44, 82, 48, 1, C.G); rect(44, 83, 48, 1, "#3a3a3a");   // surface
    rect(46, 84, 2, 4, "#3a3a3a"); rect(88, 84, 2, 4, "#3a3a3a"); // legs
    // tower under desk
    rect(52, 84, 7, 4, "#1c1c1c"); rect(53, 85, 5, 2, "#101010");
    ctx.fillStyle = pcOn ? (Math.floor(t / 160) % 2 ? C.A : "#1c4a2c") : "#222";
    ctx.fillRect(57, 85, 1, 1);
    // monitor
    rect(50, 68, 18, 12, "#1c1c1c");             // bezel
    rect(58, 80, 2, 2, "#1c1c1c");               // stand
    if (pcOn) {
      rect(51, 69, 16, 10, "#0c1f14");           // glow
      for (var i = 0; i < 4; i++) {              // scrolling code lines
        var yy = 70 + ((Math.floor(t / 90) + i * 3) % 9);
        var ww = 4 + Math.floor(hash(i, Math.floor(t / 360)) * 9);
        ctx.fillStyle = i % 3 ? "#2f7a4d" : "#4ADE80";
        ctx.fillRect(52 + (i % 2) * 2, yy, ww, 1);
      }
    } else {
      rect(51, 69, 16, 10, "#0d0d0d");
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(57, 73, 4, 1);    // sleep glyph
    }
    rect(72, 81, 12, 1, "#5c5c5c");              // keyboard
    if (pcOn && Math.floor(t / 130) % 2) { ctx.fillStyle = "#9e9e9e"; ctx.fillRect(73 + Math.floor(hash(9, Math.floor(t / 130)) * 9), 81, 1, 1); }
  }

  /* ── macbook on a low bench ── */
  function drawMac(t) {
    rect(98, 84, 20, 1, C.G); rect(99, 85, 1, 3, "#3a3a3a"); rect(115, 85, 1, 3, "#3a3a3a");
    rect(101, 83, 14, 1, "#9e9e9e");             // base
    var lid = Math.round(macLid);                // 0 closed → 6 open
    if (lid <= 0) {
      rect(101, 82, 14, 1, "#bcbcbc");           // closed lid
      ctx.fillStyle = "#efefef"; ctx.fillRect(107, 82, 1, 1);   // logo glint
    } else {
      rect(114, 82 - lid, 1, lid + 1, "#bcbcbc");               // lid up (hinge right)
      if (macGlow && lid >= 5) {
        rect(109, 78, 5, 5, "#1a1a22");                          // screen wash
        rect(110, 79, 3, 1, "#cfcfcf"); rect(110, 81, 2, 1, "#5c5c5c");
      }
    }
  }

  /* ── homelab rack ── */
  function drawLab(t) {
    rect(122, 62, 22, 26, "#262626"); rect(123, 63, 20, 24, "#0a0a0a");
    for (var u = 0; u < 3; u++) {
      var oy = 64 + u * 8;
      rect(124, oy, 18, 7, "#101010");
      for (var v = 0; v < 3; v++) rect(125, oy + 1 + v * 2, 9, 1, "#1e1e1e");  // vents
      var blink = Math.floor(t / (340 + u * 150)) % 2;
      ctx.fillStyle = (u === 0 && labDown) ? (blink ? C.R : "#401414") : (blink ? C.A : "#1c4a2c");
      ctx.fillRect(139, oy + 1, 1, 1);
      ctx.fillStyle = Math.floor(t / 800 + u) % 2 ? "#5c5c5c" : "#2e2e2e";
      ctx.fillRect(139, oy + 4, 1, 1);
    }
    rect(126, 88, 2, 1, "#1c1c1c"); rect(138, 88, 2, 1, "#1c1c1c"); // feet
  }

  /* ── stations ── */
  var ST = {
    drink: { zone: [20, 58, 44, 90],  ax: 13,  dir: 1 },
    desk:  { zone: [44, 48, 94, 90],  ax: 73,  dir: -1 },
    mac:   { zone: [94, 64, 120, 90], ax: 87,  dir: 1 },
    lab:   { zone: [120, 40, 148, 90], ax: 124, dir: 1 }
  };

  /* ── speech ── */
  var QUIPS = [
    "pi:~$ hi. i’m pi.",
    "pi:~$ ammaar is probably studying for net+.",
    "pi:~$ 3.648 gpa. i checked.",
    "pi:~$ aws ccp — passed. certified.",
    "pi:~$ open to internships, btw.",
    "pi:~$ drop me on something. i do things.",
    "pi:~$ umd smith, soon.",
    "pi:~$ nice room, right? i decorated.",
    "pi:~$ nightfall hq is one tab away."
  ];
  var DESK_QUIPS = ["pi:~$ net+ ch.4: subnetting.", "pi:~$ osi layer 3. again.", "pi:~$ git commit -m ‘study’", "pi:~$ flashcards: vlans."];
  var bubbleT = null;
  function say(msg, px, py) {
    var s = canvas.clientWidth / RW;
    bubble.textContent = msg;
    var bx = Math.max(2, Math.min(wrap.clientWidth - 185, canvas.offsetLeft + px * s - 36));
    var by = Math.max(2, canvas.offsetTop + py * s - 26);
    bubble.style.left = bx + "px";
    bubble.style.top = by + "px";
    bubble.classList.add("show");
    clearTimeout(bubbleT);
    bubbleT = setTimeout(function () { bubble.classList.remove("show"); }, 2400);
  }

  /* ── pi state ── */
  var x = 36, y = FLOOR - 11;                    // x = left, y = top (feet at y+11)
  var dir = 1, baseVX = 0.18, vy = 0, t = 0;
  var mode = REDUCED ? "pause" : "walk";
  var pauseT = REDUCED ? 1e9 : 30;
  var held = false, moved = 0, grabDX = 0, grabDY = 0;
  var actT = 0, act = null, boostUntil = 0;
  var cool = { drink: 0, desk: 0, mac: 0, lab: 0 };

  function engage(k) {
    var s = ST[k];
    cool[k] = perf() + (k === "desk" ? 40000 : 26000);
    x = s.ax; y = FLOOR - 11; dir = s.dir; act = k; mode = "act";
    if (k === "desk") {
      actT = 380 + Math.random() * 240; pcOn = true;
      say(DESK_QUIPS[Math.floor(Math.random() * DESK_QUIPS.length)], x, y);
    } else if (k === "drink") { actT = 100; }
    else if (k === "mac")     { actT = 280; macGlow = true; }
    else if (k === "lab")     { actT = labDown ? 150 : 70; }
  }
  function endAct() {
    if (act === "desk") { pcOn = false; say("pi:~$ break. earned.", x, y); }
    if (act === "drink") { boostUntil = perf() + 8000; say("pi:~$ caffeinated. zoom.", x, y); }
    if (act === "mac") { macGlow = false; say("pi:~$ design review: approved.", x, y); }
    if (act === "lab") {
      if (labDown) { labDown = false; nextIncident = perf() + 22000 + Math.random() * 30000; say("pi:~$ ticket closed. that’s " + (ticket++) + ".", x, y); }
      else say("pi:~$ lab: all green.", x, y);
    }
    act = null; mode = REDUCED ? "pause" : "walk";
  }

  function maybeEngage() {
    var now = perf();
    for (var k in ST) {
      if (now < cool[k]) continue;
      if (Math.abs(x - ST[k].ax) < 1.2 && Math.random() < (k === "lab" && labDown ? 0.9 : 0.3)) { engage(k); return; }
    }
    // moon gaze under the window
    if (x > 144 && Math.random() < 0.002) { mode = "pause"; pauseT = 140; say("pi:~$ moon’s out.", x, y); }
  }

  function inZone(k) {
    var z = ST[k].zone, cxp = x + 5, cyp = y + 8;
    return cxp >= z[0] && cxp <= z[2] && cyp >= z[1] && cyp <= z[3];
  }

  /* ── main loop ── */
  function step(now) {
    t++;
    now = now || perf();
    if (!labDown && now > nextIncident && !REDUCED) labDown = true;

    drawShell(now); drawWindow(now); drawPoster();
    drawDrink(now, act === "drink"); drawDesk(now); drawMac(now); drawLab(now);

    // macbook lid easing
    var lidTarget = (act === "mac" && actT > 40) ? 6 : 0;
    macLid += (lidTarget - macLid) * 0.18;

    if (held) {
      drawPi("held", dir < 0, x, y);
    } else if (mode === "fall") {
      vy += 0.32; y += vy;
      if (y >= FLOOR - 11) { y = FLOOR - 11; vy = 0; mode = REDUCED ? "pause" : "walk"; }
      drawPi("held", dir < 0, x, y);
    } else if (mode === "act") {
      actT--;
      if (act === "desk") {
        drawPi(t % 14 < 7 ? "walk2" : "idle", dir < 0, x, y - (t % 28 < 14 ? 0 : 1));  // typing bob
      } else {
        drawPi(t % 60 < 6 ? "blink" : "idle", dir < 0, x, y);
      }
      if (actT <= 0) endAct();
    } else if (mode === "pause") {
      pauseT--;
      if (pauseT <= 0 && !REDUCED) { mode = "walk"; dir = Math.random() < 0.5 ? -1 : 1; }
      drawPi(t % 90 < 6 ? "blink" : "idle", dir < 0, x, y);
    } else {
      var vx = now < boostUntil ? baseVX * 2 : baseVX;
      x += vx * dir;
      if (x < 2) { x = 2; dir = 1; }
      if (x > 146) { x = 146; dir = -1; }
      if (Math.random() < 0.003) { mode = "pause"; pauseT = 80 + Math.random() * 180; }
      y = FLOOR - 11;
      maybeEngage();
      drawPi(t % 18 < 9 ? "walk1" : "walk2", dir < 0, x, y);
    }
    requestAnimationFrame(step);
  }

  /* ── input ── */
  function roomXY(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (RW / r.width), y: (e.clientY - r.top) * (RH / r.height) };
  }
  canvas.addEventListener("pointermove", function (e) {
    if (held) {
      var p = roomXY(e);
      var nx = Math.max(0, Math.min(RW - 10, p.x - grabDX));
      var ny = Math.max(6, Math.min(FLOOR - 11, p.y - grabDY));
      moved += Math.abs(nx - x) + Math.abs(ny - y);
      x = nx; y = ny;
    } else {
      var p2 = roomXY(e);
      var over = p2.x >= x - 2 && p2.x <= x + 12 && p2.y >= y - 2 && p2.y <= y + 13;
      canvas.style.cursor = over ? "grab" : "default";
    }
  });
  canvas.addEventListener("pointerdown", function (e) {
    var p = roomXY(e);
    if (p.x >= x - 2 && p.x <= x + 12 && p.y >= y - 2 && p.y <= y + 13) {
      held = true; moved = 0; grabDX = p.x - x; grabDY = p.y - y;
      if (act === "desk") pcOn = false;
      if (act === "mac") macGlow = false;
      act = null;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  canvas.addEventListener("pointerup", function () {
    if (!held) return;
    held = false; canvas.style.cursor = "grab";
    if (moved < 3) {
      say(QUIPS[Math.floor(Math.random() * QUIPS.length)], x, y);
      mode = "pause"; pauseT = 120;
    } else if (inZone("desk")) engage("desk");
    else if (inZone("drink")) engage("drink");
    else if (inZone("mac")) engage("mac");
    else if (inZone("lab")) engage("lab");
    else if (y < FLOOR - 11) { vy = 0; mode = "fall"; }
    else mode = REDUCED ? "pause" : "walk";
  });

  requestAnimationFrame(step);
  setTimeout(function () { if (!held) say("pi:~$ hi. i’m pi. my room.", x, y); }, 2600);
  setTimeout(function () { if (!held && mode === "walk") engage("desk"); }, 9500);
})();
