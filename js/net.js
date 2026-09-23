/* net — the flowing multilayer network behind pi's island (and a small one
   at contact). columns of drifting nodes, every node wired to the next layer
   with curves that sway, signals firing input → output. drawn on three depth
   planes that parallax against the pointer. no libraries. */
(function () {
  var canvases = document.querySelectorAll("canvas.net");
  if (!canvases.length) return;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var PAL_DARK = ["#FFB000", "#E879F9", "#5B8DEF", "#4DD6E8", "#4ADE80"];
  var PAL_LIGHT = ["#8a5c00", "#a63fb8", "#2f5fc4", "#0b6e7c", "#136f39"];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function bez(a, b, c, d, u) { var v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; }

  function Net(canvas) {
    var ctx = canvas.getContext("2d");
    var shape = (canvas.getAttribute("data-layers") || "4,6,7,6,4").split(",").map(Number);
    var maxN = Math.max.apply(null, shape), L = shape.length;
    var maxSig = +(canvas.getAttribute("data-signals") || 16);
    // front → back: scale, opacity, parallax strength
    var planes = [{ z: 1, a: 1, par: 22 }, { z: 0.74, a: 0.42, par: 12 }, { z: 0.52, a: 0.2, par: 5 }];
    var W = 0, H = 0, dpr = 1, px = 0, py = 0, ox = 0, oy = 0;
    var visible = true, dark = true, pal = PAL_DARK, frame = 0;

    planes.forEach(function (p) {
      p.layers = shape.map(function (n, li) {
        var col = [];
        for (var i = 0; i < n; i++) col.push({ li: li, i: i, n: n, ph: rnd(0, 6.283), sp: rnd(0.3, 0.7), amp: rnd(0.015, 0.04), glow: 0, x: 0, y: 0 });
        return col;
      });
      p.edges = []; p.out = [];
      for (var li = 0; li < L - 1; li++)
        p.layers[li].forEach(function (a) {
          a.out = [];
          p.layers[li + 1].forEach(function (b) {
            var e = { a: a, b: b, w: Math.pow(Math.random(), 1.8), ph: rnd(0, 6.283) };
            p.edges.push(e); a.out.push(e);
          });
        });
      p.sig = [];
    });

    function size() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    }
    function theme() {
      // tokens are inherited, so the island's night frame reads as dark even on paper
      var bg = getComputedStyle(canvas).getPropertyValue("--bg").trim().toLowerCase();
      dark = bg.indexOf("#0") === 0 || bg.indexOf("#1") === 0;
      pal = dark ? PAL_DARK : PAL_LIGHT;
    }

    function layout(p, t) {
      var sw = W * 0.84 * p.z, sh = H * 0.8 * p.z, cx = W / 2 + ox * p.par, cy = H / 2 + oy * p.par * 0.7;
      p.layers.forEach(function (col, li) {
        var span = sh * (0.35 + 0.65 * col.length / maxN);
        var wave = Math.sin(t * 0.45 + li * 0.9 + p.z * 3) * H * 0.05;   // whole layers undulate like a ribbon
        col.forEach(function (nd) {
          nd.x = cx - sw / 2 + sw * li / (L - 1) + Math.cos(t * nd.sp * 0.8 + nd.ph) * nd.amp * W * 0.6;
          nd.y = cy - span / 2 + span * (nd.i + 0.5) / nd.n + wave + Math.sin(t * nd.sp + nd.ph) * nd.amp * H;
        });
      });
    }
    function ctrl(e, t) {
      var dx = (e.b.x - e.a.x) * 0.5;
      return [e.a.x + dx, e.a.y + Math.sin(t * 0.8 + e.ph) * H * 0.035,
              e.b.x - dx, e.b.y + Math.cos(t * 0.6 + e.ph) * H * 0.035];
    }

    function fire(p) {
      var start = pick(p.layers[0]);
      p.sig.push({ e: pick(start.out), u: 0, sp: rnd(0.35, 0.7) });
    }

    function draw(t, dt) {
      if (frame++ % 60 === 0) theme();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      ctx.lineCap = "round";

      for (var pi = planes.length - 1; pi >= 0; pi--) {
        var p = planes[pi];
        layout(p, t);

        // edges: faint, weighted, tinted by the layer they leave
        ctx.lineWidth = 0.6 + p.z * 0.5;
        p.edges.forEach(function (e) {
          var c = ctrl(e, t);
          ctx.globalAlpha = (0.035 + e.w * (dark ? 0.16 : 0.22)) * p.a;
          ctx.strokeStyle = pal[e.a.li % pal.length];
          ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y);
          ctx.bezierCurveTo(c[0], c[1], c[2], c[3], e.b.x, e.b.y);
          ctx.stroke();
        });

        // signals: travel an edge, light the node they reach, usually carry on
        if (pi < 2 && !REDUCED) {
          var cap = pi === 0 ? maxSig : Math.round(maxSig / 2);
          if (p.sig.length < cap && Math.random() < dt * 3) fire(p);
          for (var s = p.sig.length - 1; s >= 0; s--) {
            var g = p.sig[s], c = ctrl(g.e, t);
            g.u += dt * g.sp;
            if (g.u >= 1) {
              g.e.b.glow = 1;
              if (g.e.b.out && Math.random() < 0.85) { g.e = pick(g.e.b.out); g.u = 0; }
              else { p.sig.splice(s, 1); continue; }
              c = ctrl(g.e, t);
            }
            var sx = bez(g.e.a.x, c[0], c[2], g.e.b.x, g.u), sy = bez(g.e.a.y, c[1], c[3], g.e.b.y, g.u);
            var col = pal[(g.e.a.li + (g.u > 0.5 ? 1 : 0)) % pal.length];
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.16 * p.a; ctx.beginPath(); ctx.arc(sx, sy, 6 * p.z, 0, 6.283); ctx.fill();
            ctx.globalAlpha = 0.95 * p.a; ctx.beginPath(); ctx.arc(sx, sy, 1.6 * p.z, 0, 6.283); ctx.fill();
          }
        }

        // nodes: small cores, a halo that swells when a signal lands
        p.layers.forEach(function (colm) {
          colm.forEach(function (nd) {
            var col = pal[nd.li % pal.length];
            nd.glow = Math.max(0, nd.glow - dt * 1.6);
            ctx.fillStyle = col;
            ctx.globalAlpha = (0.08 + nd.glow * 0.3) * p.a;
            ctx.beginPath(); ctx.arc(nd.x, nd.y, (5 + nd.glow * 7) * p.z, 0, 6.283); ctx.fill();
            ctx.globalAlpha = (0.55 + nd.glow * 0.45) * p.a;
            ctx.beginPath(); ctx.arc(nd.x, nd.y, (1.8 + nd.glow * 1.2) * p.z, 0, 6.283); ctx.fill();
          });
        });
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }

    var last = 0, t0 = performance.now(), rafId = 0;
    function loop(now) {
      rafId = 0;
      if (!visible) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      if (FINE) { ox += (px - ox) * 0.05; oy += (py - oy) * 0.05; }
      draw((now - t0) / 1000, dt);
      rafId = requestAnimationFrame(loop);
    }
    function start() { if (!rafId && !REDUCED) { last = performance.now(); rafId = requestAnimationFrame(loop); } }

    size(); theme(); draw(2, 0.016);
    if ("ResizeObserver" in window) new ResizeObserver(function () { size(); if (REDUCED) draw(2, 0.016); }).observe(canvas);
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }).observe(canvas);
    if (FINE && !REDUCED) window.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / window.innerWidth * 2));
      py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / window.innerHeight * 2));
    }, { passive: true });
    // theme toggle: repaint the moment data-theme changes
    if ("MutationObserver" in window)
      new MutationObserver(function () { theme(); if (REDUCED) draw(2, 0.016); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    start();
  }

  Array.prototype.forEach.call(canvases, Net);
})();
