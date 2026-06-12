/* pi — resident critter. the hero is his floating island.
   first visit: an egg hatches (tap to crack faster), pi plops onto
   the island, and the camera zooms out into the site.
   stations: desk+pc, macbook, homelab, drink. wildlife: one chrome-ish
   dino (rex), pterodactyls with radar waypoints, drifting bit-clouds. */
(function () {
  var canvas = document.getElementById("room");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var wrap = canvas.parentElement;
  var bubble = document.getElementById("room-bubble");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function perf() { return performance.now(); }

  var RW = 200, RH = 144, FLOOR = 104;   // island units (1 = 1 chunky pixel)

  var C = { W: "#efefef", G: "#9e9e9e", D: "#5c5c5c", K: "#0a0a0a",
            O: "#FFA94D", Y: "#FFE066", R: "#FF5252", A: "#4ADE80" };

  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177 | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

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

  /* ── rex, the dino (chrome homage) ── */
  var DINO = {
    a: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...W..W....","...W...W..."],
    b: ["......WWWWW","......WKWWW","......WWWWW","......WWW..","......WWWW.","W....WWWW..","W...WWWWWW.","WW.WWWWWW..","WWWWWWWW...",".WWWWWWW...","..WWWWW....","...WW.W....","....W..W..."]
  };
  function drawDino(frame, flip, ox, oy, col) {
    var f = DINO[frame];
    ox = Math.round(ox); oy = Math.round(oy);
    for (var y = 0; y < f.length; y++)
      for (var x = 0; x < 11; x++) {
        var c = f[y][flip ? 10 - x : x];
        if (c === "W") { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); }
        else if (c === "K") { ctx.fillStyle = "#0a0a0a"; ctx.fillRect(ox + x, oy + y, 1, 1); }
      }
  }

  /* ── pterodactyl ── */
  var PTERO = {
    up:   ["..W.......W...","..WW.....WW...","...WW...WW....","....WWWWW.....",".....WWWWWW...","......W......."],
    down: ["..............","....WWWWW.....","..WWW...WWW...",".WW..WWW..WW..",".....WWWWWW...","......W......."]
  };
  function drawPtero(frame, flip, ox, oy) {
    var f = PTERO[frame];
    ox = Math.round(ox); oy = Math.round(oy);
    for (var y = 0; y < f.length; y++)
      for (var x = 0; x < 14; x++) {
        var c = f[y][flip ? 13 - x : x];
        if (c === "W") { ctx.fillStyle = "#9e9e9e"; ctx.fillRect(ox + x, oy + y, 1, 1); }
      }
  }

  /* ── world state ── */
  var pcOn = false, macLid = 0, macGlow = false, labDown = false;
  var nextIncident = perf() + 18000, ticket = 201;
  var clouds = [], i;
  for (i = 0; i < 4; i++) clouds.push({ x: hash(i, 99) * 200, y: 10 + i * 13 + hash(i, 5) * 6, v: 0.018 + i * 0.011, w: 14 + Math.floor(hash(i, 3) * 9) });
  var dino = { x: 150, dir: -1, vy: 0, oy: 0, mode: "walk", t: 0, pause: 0 };
  var ptero = { on: false, x: 0, y: 0, dir: 1, next: perf() + 5000 };

  /* ── sky ── */
  function drawSky(t) {
    for (var sx = 0; sx < RW; sx += 2)
      for (var sy = 0; sy < FLOOR - 4; sy += 2) {
        var h = hash(sx, sy);
        if (h < 0.012) {
          var tw = Math.floor(t / (900 + sx * 7)) % 6 === 0;
          ctx.fillStyle = h < 0.0015 ? "#5B8DEF" : (h < 0.003 ? "#8a3a3a" : (tw ? "#7e7e7e" : "#2e2e2e"));
          ctx.fillRect(sx, sy, 1, 1);
        }
      }
    // crescent moon
    ctx.fillStyle = "#efefef";
    [[177,10,4],[175,11,4],[174,12,3],[173,13,3],[173,14,3],[173,15,3],[174,16,3],[175,17,4],[177,18,4]].forEach(function (r) {
      ctx.fillRect(r[0], r[1], r[2], 1);
    });
    // radar waypoints (atc homage) — amber triangles, one blinking
    [[34,28],[148,44],[98,16]].forEach(function (p, k) {
      ctx.fillStyle = "#6b5a26";
      ctx.fillRect(p[0], p[1] - 1, 1, 1); ctx.fillRect(p[0] - 1, p[1], 3, 1);
      if (k === 1 && Math.floor(t / 700) % 2) { ctx.fillStyle = "#FFB000"; ctx.fillRect(p[0], p[1] - 3, 1, 1); }
    });
    // clouds
    clouds.forEach(function (cl) {
      if (!REDUCED) { cl.x += cl.v; if (cl.x > RW + 20) cl.x = -28; }
      var cx0 = Math.round(cl.x), cy0 = Math.round(cl.y);
      rect(cx0 + 2, cy0, cl.w - 4, 1, "#383838");
      rect(cx0, cy0 + 1, cl.w, 1, "#2e2e2e");
      rect(cx0 + 3, cy0 + 2, cl.w - 7, 1, "#262626");
    });
    // pterodactyl
    if (ptero.on) {
      if (!REDUCED) ptero.x += ptero.dir * 0.34;
      // dotted radar track behind
      for (var d = 1; d <= 4; d++) {
        if ((d + Math.floor(t / 200)) % 2) { ctx.fillStyle = "#4a3e1c"; ctx.fillRect(Math.round(ptero.x - ptero.dir * d * 7) + 6, Math.round(ptero.y) + 2, 1, 1); }
      }
      drawPtero(Math.floor(t / 260) % 2 ? "up" : "down", ptero.dir < 0, ptero.x, ptero.y);
      if (ptero.x < -20 || ptero.x > RW + 20) { ptero.on = false; ptero.next = perf() + 8000 + Math.random() * 9000; }
    } else if (!REDUCED && perf() > ptero.next) {
      ptero.on = true; ptero.dir = Math.random() < 0.5 ? 1 : -1;
      ptero.x = ptero.dir === 1 ? -16 : RW + 16;
      ptero.y = 14 + Math.random() * 38;
    }
  }

  /* ── the island ── */
  function drawIsland() {
    rect(6, FLOOR, 188, 1, "#3f6b4d");           // grass
    rect(8, FLOOR + 1, 184, 1, "#2e4f3a");
    rect(10, FLOOR + 2, 180, 1, "#243f30");
    for (var gx = 8; gx < 192; gx += 5)          // grass blades
      if (hash(gx, 77) < 0.3) { ctx.fillStyle = "#3f6b4d"; ctx.fillRect(gx, FLOOR - 1, 1, 1); }
    for (var y = FLOOR + 3; y < RH - 2; y++) {   // tapering dirt
      var p = (y - FLOOR - 3) / (RH - FLOOR - 5);
      var hw = (1 - p * p) * 88 - hash(y, 3) * 5;
      if (hw < 5) break;
      rect(Math.round(100 - hw), y, Math.round(hw * 2), 1, y % 2 ? "#1b1b1b" : "#171717");
      for (var rx = 0; rx < 6; rx++) {           // rocks
        var h = hash(y, rx * 31);
        if (h < 0.5) { ctx.fillStyle = "#242424"; ctx.fillRect(Math.round(100 + (h - 0.25) * hw * 7) % RW, y, 1, 1); }
      }
    }
    rect(60, FLOOR + 3, 1, 7, "#262626");        // roots
    rect(61, FLOOR + 9, 1, 3, "#202020");
    rect(143, FLOOR + 3, 1, 5, "#262626");
  }

  /* ── furniture (open-air setup) ── */
  function drawDrink(t, sipping) {
    rect(18, 99, 16, 1, C.G); rect(18, 100, 16, 1, "#3a3a3a");
    rect(19, 101, 1, 3, "#3a3a3a"); rect(32, 101, 1, 3, "#3a3a3a");
    rect(22, 94, 6, 5, C.W); rect(23, 95, 4, 2, "#333333");
    rect(28, 95, 1, 2, C.G);
    if (!REDUCED) {
      var ph = Math.floor(t / 240) % 4;
      if (ph < 3) { ctx.fillStyle = ph === 2 ? "#3a3a3a" : "#5c5c5c"; ctx.fillRect(23 + (ph % 2) * 2, 91 - ph, 1, 1); }
      if (sipping && Math.floor(t / 120) % 2) { ctx.fillStyle = "#5c5c5c"; ctx.fillRect(25, 89, 1, 1); }
    }
  }
  function drawDesk(t) {
    rect(42, 98, 48, 1, C.G); rect(42, 99, 48, 1, "#3a3a3a");
    rect(44, 100, 2, 4, "#3a3a3a"); rect(86, 100, 2, 4, "#3a3a3a");
    rect(50, 100, 7, 4, "#1c1c1c"); rect(51, 101, 5, 2, "#101010");   // tower
    ctx.fillStyle = pcOn ? (Math.floor(t / 160) % 2 ? C.A : "#1c4a2c") : "#222";
    ctx.fillRect(55, 101, 1, 1);
    rect(48, 84, 18, 12, "#1c1c1c");             // monitor
    rect(56, 96, 2, 2, "#1c1c1c");
    if (pcOn) {
      rect(49, 85, 16, 10, "#0c1f14");
      for (var k = 0; k < 4; k++) {
        var yy = 86 + ((Math.floor(t / 90) + k * 3) % 9);
        var ww = 4 + Math.floor(hash(k, Math.floor(t / 360)) * 9);
        ctx.fillStyle = k % 3 ? "#2f7a4d" : "#4ADE80";
        ctx.fillRect(50 + (k % 2) * 2, yy, ww, 1);
      }
    } else {
      rect(49, 85, 16, 10, "#0d0d0d");
      rect(55, 89, 4, 1, "#1a1a1a");
    }
    rect(70, 97, 12, 1, "#5c5c5c");              // keyboard
    if (pcOn && Math.floor(t / 130) % 2) { ctx.fillStyle = "#9e9e9e"; ctx.fillRect(71 + Math.floor(hash(9, Math.floor(t / 130)) * 9), 97, 1, 1); }
  }
  function drawMac(t) {
    rect(96, 100, 20, 1, C.G); rect(97, 101, 1, 3, "#3a3a3a"); rect(113, 101, 1, 3, "#3a3a3a");
    rect(99, 99, 14, 1, "#9e9e9e");
    var lid = Math.round(macLid);
    if (lid <= 0) {
      rect(99, 98, 14, 1, "#bcbcbc");
      ctx.fillStyle = "#efefef"; ctx.fillRect(105, 98, 1, 1);
    } else {
      rect(112, 98 - lid, 1, lid + 1, "#bcbcbc");
      if (macGlow && lid >= 5) {
        rect(107, 94, 5, 5, "#1a1a22");
        rect(108, 95, 3, 1, "#cfcfcf"); rect(108, 97, 2, 1, "#5c5c5c");
      }
    }
  }
  function drawLab(t) {
    rect(124, 78, 22, 26, "#262626"); rect(125, 79, 20, 24, "#0a0a0a");
    for (var u = 0; u < 3; u++) {
      var oy = 80 + u * 8;
      rect(126, oy, 18, 7, "#101010");
      for (var v = 0; v < 3; v++) rect(127, oy + 1 + v * 2, 9, 1, "#1e1e1e");
      var blink = Math.floor(t / (340 + u * 150)) % 2;
      ctx.fillStyle = (u === 0 && labDown) ? (blink ? C.R : "#401414") : (blink ? C.A : "#1c4a2c");
      ctx.fillRect(141, oy + 1, 1, 1);
      ctx.fillStyle = Math.floor(t / 800 + u) % 2 ? "#5c5c5c" : "#2e2e2e";
      ctx.fillRect(141, oy + 4, 1, 1);
    }
    rect(127, 97, 3, 4, "#11201a");              // film-poster sticker
    ctx.fillStyle = "#3a5c46"; ctx.fillRect(128, 98, 1, 1);
    ctx.fillStyle = "#FF5252"; ctx.fillRect(128, 100, 1, 1);   // hanko
  }
  function drawShellBits() {
    // hatched egg — bottom cup + tipped cap
    rect(157, 99, 11, 5, "#efefef"); rect(158, 99, 9, 1, "#0d0d0d");
    [[157,98],[160,98],[163,98],[166,98],[159,97],[164,97]].forEach(function (p) {
      ctx.fillStyle = "#efefef"; ctx.fillRect(p[0], p[1], 1, 1);
    });
    rect(157, 103, 11, 1, "#bcbcbc");
    rect(171, 101, 8, 3, "#efefef");             // cap on its side
    rect(172, 100, 5, 1, "#efefef"); rect(171, 103, 8, 1, "#bcbcbc");
    ctx.fillStyle = "#d8d8d8"; ctx.fillRect(174, 102, 1, 1);
  }

  /* ── stations ── */
  var ST = {
    drink: { zone: [14, 74, 38, 106],  ax: 7,   dir: 1 },
    desk:  { zone: [42, 64, 92, 106],  ax: 71,  dir: -1 },
    mac:   { zone: [92, 80, 118, 106], ax: 85,  dir: 1 },
    lab:   { zone: [120, 56, 150, 106], ax: 126, dir: 1 }
  };

  var QUIPS = [
    "pi:~$ hi. i’m pi.",
    "pi:~$ ammaar is probably studying for net+.",
    "pi:~$ 3.648 gpa. i checked.",
    "pi:~$ aws ccp — passed. certified.",
    "pi:~$ open to internships, btw.",
    "pi:~$ drop me on something. i do things.",
    "pi:~$ island wifi: surprisingly good.",
    "pi:~$ the dino’s name is rex. obviously.",
    "pi:~$ umd smith, soon.",
    "pi:~$ nightfall hq is one tab away."
  ];
  var DESK_QUIPS = ["pi:~$ net+ ch.4: subnetting.", "pi:~$ osi layer 3. again.", "pi:~$ git commit -m ‘study’", "pi:~$ flashcards: vlans."];
  var bubbleT = null;
  function say(msg, px, py) {
    var s = canvas.clientWidth / RW;
    bubble.textContent = msg;
    bubble.style.left = Math.max(2, Math.min(wrap.clientWidth - 190, canvas.offsetLeft + px * s - 36)) + "px";
    bubble.style.top = Math.max(2, canvas.offsetTop + py * s - 26) + "px";
    bubble.classList.add("show");
    clearTimeout(bubbleT);
    bubbleT = setTimeout(function () { bubble.classList.remove("show"); }, 2400);
  }

  /* ── pi state ── */
  var hatching = false;                          // true while the egg overlay runs
  var x = 160, y = FLOOR - 11;
  var dir = -1, baseVX = 0.18, vy = 0, t = 0;
  var mode = REDUCED ? "pause" : "walk";
  var pauseT = REDUCED ? 1e9 : 30;
  var held = false, moved = 0, grabDX = 0, grabDY = 0, fallFrom = 0;
  var actT = 0, act = null, boostUntil = 0, justHatched = false;
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
    if (x > 150 && Math.random() < 0.0015) { mode = "pause"; pauseT = 140; say("pi:~$ my egg. sentimental.", x, y); }
  }
  function inZone(k) {
    var z = ST[k].zone, cxp = x + 5, cyp = y + 8;
    return cxp >= z[0] && cxp <= z[2] && cyp >= z[1] && cyp <= z[3];
  }

  /* ── rex behavior ── */
  function stepDino(now) {
    dino.t++;
    var feet = FLOOR - 13;
    if (dino.mode === "hop") {
      dino.vy += 0.35; dino.oy += dino.vy;
      if (dino.oy >= 0) { dino.oy = 0; dino.vy = 0; dino.mode = "walk"; }
    } else if (dino.mode === "pause") {
      dino.pause--;
      if (dino.pause <= 0) { dino.mode = "walk"; dino.dir = Math.random() < 0.5 ? -1 : 1; }
    } else if (!REDUCED) {
      dino.x += 0.11 * dino.dir;
      if (dino.x < 8) { dino.x = 8; dino.dir = 1; }
      if (dino.x > 180) { dino.x = 180; dino.dir = -1; }
      if (Math.random() < 0.004) { dino.mode = "pause"; dino.pause = 60 + Math.random() * 160; }
      // startled hop if pi lands close
      if (Math.abs((x + 5) - (dino.x + 6)) < 11 && (mode === "fall" || held) && dino.oy === 0 && Math.random() < 0.1) hopDino();
    }
    var fr = dino.mode === "walk" && Math.floor(dino.t / 16) % 2 ? "b" : "a";
    drawDino(fr, dino.dir < 0, dino.x, feet + dino.oy, "#bcbcbc");
  }
  function hopDino() { if (dino.oy === 0) { dino.mode = "hop"; dino.vy = -2.6; } }

  /* ── main loop ── */
  function step(now) {
    t++;
    now = now || perf();
    if (!labDown && now > nextIncident && !REDUCED && !hatching) labDown = true;

    ctx.clearRect(0, 0, RW, RH);
    drawSky(now);
    drawIsland();
    drawDrink(now, act === "drink"); drawDesk(now); drawMac(now); drawLab(now);
    drawShellBits();
    stepDino(now);

    var lidTarget = (act === "mac" && actT > 40) ? 6 : 0;
    macLid += (lidTarget - macLid) * 0.18;

    if (hatching) {                              // pi not on island yet
      requestAnimationFrame(step);
      return;
    }

    if (held) {
      drawPi("held", dir < 0, x, y);
    } else if (mode === "fall") {
      vy += 0.32; y += vy;
      if (y >= FLOOR - 11) {
        y = FLOOR - 11; vy = 0; mode = REDUCED ? "pause" : "walk";
        if (justHatched) { justHatched = false; say("pi:~$ fresh hatch. hi.", x, y); mode = "pause"; pauseT = 150; }
        else if (y - fallFrom > 44) say("pi:~$ #@%&!", x, y);
      }
      drawPi("held", dir < 0, x, y);
    } else if (mode === "act") {
      actT--;
      if (act === "desk") drawPi(t % 14 < 7 ? "walk2" : "idle", dir < 0, x, y - (t % 28 < 14 ? 0 : 1));
      else drawPi(t % 60 < 6 ? "blink" : "idle", dir < 0, x, y);
      if (actT <= 0) endAct();
    } else if (mode === "pause") {
      pauseT--;
      if (pauseT <= 0 && !REDUCED) { mode = "walk"; dir = Math.random() < 0.5 ? -1 : 1; }
      drawPi(t % 90 < 6 ? "blink" : "idle", dir < 0, x, y);
    } else {
      var vx = now < boostUntil ? baseVX * 2 : baseVX;
      x += vx * dir;
      if (x < 8) { x = 8; dir = 1; }
      if (x > 182) { x = 182; dir = -1; }
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
    var p = roomXY(e);
    if (held) {
      var nx = Math.max(0, Math.min(RW - 10, p.x - grabDX));
      var ny = Math.max(4, Math.min(FLOOR - 11, p.y - grabDY));
      moved += Math.abs(nx - x) + Math.abs(ny - y);
      x = nx; y = ny;
    } else {
      var overPi = p.x >= x - 2 && p.x <= x + 12 && p.y >= y - 2 && p.y <= y + 13;
      var overDino = p.x >= dino.x - 1 && p.x <= dino.x + 13 && p.y >= FLOOR - 14 && p.y <= FLOOR;
      canvas.style.cursor = (overPi || overDino) && !hatching ? "grab" : "default";
    }
  });
  canvas.addEventListener("pointerdown", function (e) {
    if (hatching) return;
    var p = roomXY(e);
    if (p.x >= x - 2 && p.x <= x + 12 && p.y >= y - 2 && p.y <= y + 13) {
      held = true; moved = 0; grabDX = p.x - x; grabDY = p.y - y;
      if (act === "desk") pcOn = false;
      if (act === "mac") macGlow = false;
      act = null;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (p.x >= dino.x - 1 && p.x <= dino.x + 13 && p.y >= FLOOR - 16 && p.y <= FLOOR) {
      hopDino();
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
    else if (y < FLOOR - 11) { fallFrom = y; vy = 0; mode = "fall"; }
    else mode = REDUCED ? "pause" : "walk";
  });

  /* ════════════════════════════════════════════
     the hatch — first-visit entry overlay
     ════════════════════════════════════════════ */
  var overlay = document.getElementById("hatch");
  var eggCv = overlay && overlay.querySelector("canvas");
  var canPlay = overlay && eggCv && !REDUCED;
  var played = false;
  try { played = sessionStorage.getItem("pi-hatched") === "1"; } catch (err) {}

  if (canPlay && !played) {
    hatching = true;
    overlay.hidden = false;
    document.body.classList.add("hatching");
    var ec = eggCv.getContext("2d");
    var EW = 72, EH = 84, p = 0, burstT = 0, done = false;
    var CRACKS = [
      [[33,38],[35,40],[33,42],[36,44]],
      [[40,34],[42,36],[40,38],[43,39]],
      [[30,48],[33,50],[31,52],[34,54],[32,56]],
      [[44,46],[41,48],[44,50],[42,52]],
      [[36,28],[38,30],[35,32],[39,33],[36,35],[40,37],[34,41],[42,43],[37,47],[43,53],[33,57],[39,58]]
    ];
    function eggHW(ty) {                          // egg half-width profile
      var c = (ty - 0.58) / 0.62;
      var v = 1 - c * c;
      return v > 0 ? 13 * Math.sqrt(v) : 0;
    }
    function drawEgg(now) {
      ec.clearRect(0, 0, EW, EH);
      var rock = Math.sin(now / (130 - p * 70)) * p * 2.4;
      var ex = Math.round(36 + rock), top = 26;
      var stage = Math.min(5, Math.floor(p * 5) + (burstT ? 5 : 0));
      var split = burstT ? Math.min(8, (perf() - burstT) / 60) : 0;
      for (var ry = 0; ry < 34; ry++) {
        var hw = eggHW((ry + 0.5) / 34);
        if (hw < 1) continue;
        var off = ry < 14 ? -split : 0;          // cap pops up
        var tilt = ry < 14 ? Math.round(split / 3) : 0;
        ec.fillStyle = "#efefef";
        ec.fillRect(Math.round(ex - hw) + tilt, top + ry + off, Math.round(hw * 2), 1);
        ec.fillStyle = "#bcbcbc";
        ec.fillRect(Math.round(ex - hw) + tilt, top + ry + off, 2, 1);
        if (ry > 29) { ec.fillStyle = "#bcbcbc"; ec.fillRect(Math.round(ex - hw) + tilt, top + ry + off, Math.round(hw * 2), 1); }
      }
      ec.fillStyle = "#d8d8d8";                  // speckles
      [[32,36],[41,44],[36,52],[30,44],[43,32]].forEach(function (s) { ec.fillRect(s[0] + Math.round(rock), s[1], 1, 1); });
      ec.fillStyle = "#1a1a1a";                  // cracks by stage
      for (var ci = 0; ci < stage && ci < CRACKS.length; ci++)
        CRACKS[ci].forEach(function (pt) {
          var off2 = pt[1] - 26 < 14 && burstT ? -split : 0;
          ec.fillRect(pt[0] + Math.round(rock), pt[1] + off2, 1, 1);
        });
      if (burstT) {                              // pi rising out
        var u = Math.min(1, (perf() - burstT) / 450);
        var py = 44 - u * 26;
        var f = FRAMES.idle;
        for (var fy = 0; fy < f.length; fy++)
          for (var fx = 0; fx < 10; fx++) {
            var ch = f[fy][fx];
            if (ch !== "." && fy < 11 * Math.min(1, u * 1.6)) { ec.fillStyle = C[ch]; ec.fillRect(31 + fx, Math.round(py) + fy, 1, 1); }
          }
      }
    }
    function eggLoop(now) {
      if (done) return;
      if (!burstT) {
        p += 0.0031;                             // ~5s auto
        if (p >= 1) { burstT = perf(); }
      } else if (perf() - burstT > 650) {
        done = true;
        // zoom out toward the island
        var r = canvas.getBoundingClientRect();
        overlay.style.transformOrigin = (r.left + r.width / 2) + "px " + (r.top + r.height / 2) + "px";
        overlay.classList.add("zoom");
        try { sessionStorage.setItem("pi-hatched", "1"); } catch (err) {}
        setTimeout(function () {
          overlay.remove();
          document.body.classList.remove("hatching");
          hatching = false;
          justHatched = true;
          x = 158; y = -14; vy = 0; mode = "fall"; fallFrom = -14; dir = -1;
        }, 780);
        return;
      }
      drawEgg(now || perf());
      requestAnimationFrame(eggLoop);
    }
    overlay.addEventListener("pointerdown", function () {
      if (!burstT) p = Math.min(1, p + 0.09);
    });
    requestAnimationFrame(eggLoop);
  } else {
    if (overlay) overlay.remove();
    hatching = false;
  }

  requestAnimationFrame(step);
  setTimeout(function () { if (!held && !hatching && mode === "walk") say("pi:~$ hi. i’m pi. my island.", x, y); }, 3200);
  setTimeout(function () { if (!held && !hatching && mode === "walk") engage("desk"); }, 11000);
})();
