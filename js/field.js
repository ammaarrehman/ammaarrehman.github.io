/* field — the page background: a sparse, living network behind everything.
   nodes drift on a slow flow, link to their neighbours with faint threads,
   and pass the odd signal along. two depth layers parallax with the scroll;
   the pointer joins in as a node. holds still for reduced motion. */
(function () {
  var cv = document.querySelector("canvas.field");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var PAL_DARK = ["#FFB000", "#E879F9", "#5B8DEF", "#4DD6E8", "#4ADE80"];
  var PAL_LIGHT = ["#8a5c00", "#a63fb8", "#2f5fc4", "#0b6e7c", "#136f39"];
  // depth layers: back is smaller, dimmer, and scrolls slower
  var LAYERS = [{ k: 0.08, s: 0.75, a: 0.6, link: 120 }, { k: 0.2, s: 1, a: 1, link: 165 }];
  var W = 0, H = 0, dpr = 1, nodes = [], sigs = [], dark = true, pal = PAL_DARK, frame = 0;
  var mx = -9999, my = -9999;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function theme() {
    var bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().toLowerCase();
    dark = bg.indexOf("#0") === 0 || bg.indexOf("#1") === 0;
    pal = dark ? PAL_DARK : PAL_LIGHT;
  }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var count = Math.max(30, Math.min(96, Math.round(W * H / 17000)));
    nodes = [];
    for (var i = 0; i < count; i++) {
      var L = i % 3 === 0 ? 0 : 1;
      nodes.push({ L: L, x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6.283), sp: rnd(0.08, 0.2), c: (Math.random() * 5) | 0, glow: 0, sx: 0, sy: 0 });
    }
    sigs = [];
  }

  // screen position: slow flow drift + scroll parallax, wrapped so the field never runs out
  function place(n, t) {
    var ly = LAYERS[n.L], pad = 60;
    var fx = Math.sin(t * n.sp + n.ph) * 26 + Math.cos(t * n.sp * 0.6 + n.y * 0.004) * 14;
    var fy = Math.cos(t * n.sp * 0.8 + n.ph) * 20;
    var y = n.y + fy - window.scrollY * ly.k;
    var span = H + pad * 2;
    n.sx = n.x + fx;
    n.sy = ((y + pad) % span + span) % span - pad;
  }

  function neighbours(n) {
    var out = [], lim = LAYERS[n.L].link;
    for (var j = 0; j < nodes.length; j++) {
      var m = nodes[j];
      if (m === n || m.L !== n.L) continue;
      var dx = m.sx - n.sx, dy = m.sy - n.sy;
      if (dx * dx + dy * dy < lim * lim) out.push(m);
    }
    return out;
  }

  function draw(t, dt) {
    if (frame++ % 60 === 0) theme();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    var ink = dark ? "255,255,255" : "22,22,22";
    nodes.forEach(function (n) { place(n, t); });

    // threads between neighbours on the same layer; fade with distance
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i], ly = LAYERS[a.L], lim = ly.link;
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        if (b.L !== a.L) continue;
        var dx = b.sx - a.sx, dy = b.sy - a.sy, d2 = dx * dx + dy * dy;
        if (d2 > lim * lim) continue;
        var f = 1 - Math.sqrt(d2) / lim;
        ctx.strokeStyle = "rgba(" + ink + "," + (f * (dark ? 0.22 : 0.16) * ly.a).toFixed(3) + ")";
        ctx.lineWidth = 0.8 * ly.s;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy);
        // a slight bow so the threads read as flowing, not rigid
        var bow = Math.sin(t * 0.5 + i) * 10;
        ctx.quadraticCurveTo((a.sx + b.sx) / 2 - dy * 0.08 + bow * 0.2, (a.sy + b.sy) / 2 + dx * 0.08, b.sx, b.sy);
        ctx.stroke();
      }
    }

    // the pointer is a node too
    if (FINE && mx > -999) {
      nodes.forEach(function (n) {
        if (n.L !== 1) return;
        var dx = n.sx - mx, dy = n.sy - my, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 170) return;
        ctx.strokeStyle = pal[n.c]; ctx.globalAlpha = (1 - d / 170) * (dark ? 0.28 : 0.35);
        ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(n.sx, n.sy); ctx.stroke();
        n.glow = Math.max(n.glow, (1 - d / 170) * 0.6);
      });
      ctx.globalAlpha = 1;
    }

    // signals hop node to node along the threads
    if (!REDUCED) {
      if (sigs.length < 10 && Math.random() < dt * 2) {
        var from = nodes[(Math.random() * nodes.length) | 0], nb = neighbours(from);
        if (nb.length) sigs.push({ a: from, b: nb[(Math.random() * nb.length) | 0], u: 0, hops: 0 });
      }
      for (var s = sigs.length - 1; s >= 0; s--) {
        var g = sigs[s];
        g.u += dt * 0.55;
        if (g.u >= 1) {
          g.b.glow = 1;
          var next = neighbours(g.b).filter(function (m) { return m !== g.a; });
          if (!next.length || ++g.hops > 5) { sigs.splice(s, 1); continue; }
          g.a = g.b; g.b = next[(Math.random() * next.length) | 0]; g.u = 0;
        }
        var sx = g.a.sx + (g.b.sx - g.a.sx) * g.u, sy = g.a.sy + (g.b.sy - g.a.sy) * g.u;
        if (Math.abs(g.b.sy - g.a.sy) > H / 2) continue;       // skip the frame a node wraps
        var col = pal[g.a.c], la = LAYERS[g.a.L].a;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.14 * la; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.85 * la; ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, 6.283); ctx.fill();
      }
    }

    // nodes: faint tinted points, brighter when a signal lands
    nodes.forEach(function (n) {
      var ly = LAYERS[n.L];
      n.glow = Math.max(0, n.glow - dt * 1.2);
      ctx.fillStyle = pal[n.c];
      if (n.glow > 0.02) {
        ctx.globalAlpha = n.glow * 0.3 * ly.a;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, 9 * ly.s, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = ((dark ? 0.5 : 0.45) + n.glow * 0.5) * ly.a;
      ctx.beginPath(); ctx.arc(n.sx, n.sy, 1.8 * ly.s + n.glow * 1.5, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  var t0 = performance.now(), last = t0, raf = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    draw((now - t0) / 1000, dt);
    raf = requestAnimationFrame(loop);
  }

  build(); theme(); draw(4, 0.016);
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { build(); if (REDUCED) draw(4, 0.016); }, 150);
  });
  // theme toggle: pick up the new palette the moment data-theme changes
  if ("MutationObserver" in window)
    new MutationObserver(function () { theme(); if (REDUCED) draw(4, 0.016); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (REDUCED) {
    // still frame, but keep it in step with the scroll
    window.addEventListener("scroll", function () { draw(4, 0.016); }, { passive: true });
    return;
  }
  if (FINE) {
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", function () { mx = my = -9999; });
  }
  raf = requestAnimationFrame(loop);
})();
