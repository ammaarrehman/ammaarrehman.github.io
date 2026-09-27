/* orb: a fluid AI orb made of dots, the neofetch art in the hero.
   two layers of points (an outer skin and a dimmer inner shell) sit on a
   surface pushed by slow, smooth waves; the pattern flows over the surface
   while the whole thing breathes and drifts. lit by the surface normal, in
   one of several palettes: "eclipse" (a dark face lit only at the rim) by
   default, or whichever orb won the fight on pi's island this session.
   dots are batched by colour for speed.
   window.Orb(canvas, opts) → { boost(), calm(), center(), pause(bool), palette(name) }
   window.Orb(canvas, { offscreen: {w, h}, palette, layers }) → { canvas, frame(t), palette(name), energy(e) } */
(function () {
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // palettes: shadow → light stops, plus the glow behind the orb and its dust.
  // pick one with data-palette="…" on the canvas; "bone" is the default
  var PALETTES = {
    bone:  { stops: [[26, 25, 24], [84, 81, 76], [160, 154, 143], [222, 215, 200], [252, 248, 238]], glow: [214, 206, 188], dust: [230, 224, 210] },
    moon:  { stops: [[16, 20, 30], [62, 72, 92], [140, 154, 178], [208, 218, 232], [248, 251, 255]], glow: [150, 170, 210], dust: [210, 222, 240] },
    ash:   { stops: [[14, 14, 14], [60, 60, 60], [128, 128, 128], [200, 200, 200], [255, 255, 255]], glow: [120, 120, 120], dust: [200, 200, 200] },
    omen:  { stops: [[40, 6, 10], [96, 30, 30], [176, 160, 150], [230, 224, 214], [255, 252, 246]], glow: [120, 16, 24], dust: [220, 200, 196] },
    // lighting variants: g = tone gamma (>1 is low-key and darker), rim / lit scale the edge glow and
    // the front light, gs scales the glow behind the orb
    fog:       { stops: [[30, 30, 30], [78, 78, 76], [128, 127, 124], [176, 174, 170], [214, 212, 206]], glow: [150, 150, 146], dust: [170, 170, 166], g: 0.85, gs: 1.6 },
    eclipse:   { stops: [[8, 8, 8], [34, 33, 31], [110, 106, 98], [214, 208, 194], [255, 252, 242]], glow: [200, 194, 178], dust: [190, 186, 176], g: 1.6, rim: 2.2, lit: 0.35 },
    phosphor:  { stops: [[18, 22, 18], [70, 80, 70], [150, 164, 148], [214, 228, 210], [244, 255, 240]], glow: [190, 214, 186], dust: [210, 232, 204] },
    parchment: { stops: [[30, 24, 16], [92, 78, 58], [168, 150, 118], [226, 212, 182], [250, 243, 224]], glow: [214, 190, 140], dust: [226, 210, 176] },
    void:      { stops: [[6, 6, 6], [24, 24, 24], [70, 70, 68], [180, 178, 172], [250, 248, 242]], glow: [90, 90, 88], dust: [140, 140, 136], g: 1.9, lit: 1.2 },
    halo:      { stops: [[40, 40, 44], [110, 110, 116], [190, 190, 196], [236, 236, 240], [255, 255, 255]], glow: [230, 232, 245], dust: [240, 242, 255], gs: 2.4, rim: 1.4 },
    ice:       { stops: [[14, 22, 28], [56, 80, 92], [132, 168, 182], [206, 230, 238], [246, 253, 255]], glow: [160, 210, 230], dust: [200, 236, 246] },
    pink:  { stops: [[92, 34, 110], [176, 52, 140], [244, 84, 166], [255, 150, 205], [255, 226, 240]], glow: [244, 84, 166], dust: [255, 160, 210] }
  };
  var CB = 14, AB = 6;                                   // light-level × alpha buckets
  function build(pal) {
    var st = pal.stops, out = [];
    function mix(u) {
      u = Math.max(0, Math.min(0.999, u)) * (st.length - 1);
      var i = Math.floor(u), f = u - i, a = st[i], b = st[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    for (var ci = 0; ci < CB; ci++) {
      var c = mix(ci / (CB - 1));
      for (var ai = 0; ai < AB; ai++) out.push("rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (0.25 + 0.75 * (ai + 1) / AB).toFixed(3) + ")");
    }
    return out;
  }

  function Orb(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var mini = !!opts.mini;
    var off = opts.offscreen;                                // {w, h}: drawn on demand by someone else (the island)
    var PAL, STYLE, GLOW, DUST, GAMMA, RIMK, LITK, GS;
    function palette(name) {
      PAL = PALETTES[name] || PALETTES.eclipse;
      STYLE = build(PAL); GLOW = PAL.glow.join(","); DUST = PAL.dust.join(",");
      GAMMA = PAL.g || 1; RIMK = PAL.rim || 1; LITK = PAL.lit || 1; GS = PAL.gs || 1;
      if (!off) canvas.style.setProperty("--orb-glow", "rgba(" + GLOW + ",.3)");
    }
    // whoever wins the fight on pi's island recolours the orbs live, until the page reloads
    palette(opts.palette || canvas.getAttribute("data-palette") || "eclipse");
    // layers: [rows, cols (point count = rows × cols), radius, brightness]
    var LAYERS = opts.layers || (mini ? [[40, 80, 1, 1], [22, 44, 0.78, 0.45]] : [[64, 128, 1, 1], [36, 72, 0.8, 0.42]]);
    // points on each layer follow a Fibonacci sphere: evenly spaced, no pinched poles
    var N = 0, LAT = [], LON = [];
    LAYERS.forEach(function (l) {
      var n = l[0] * l[1], la = new Float32Array(n), lo = new Float32Array(n);
      for (var j = 0; j < n; j++) { la[j] = Math.asin(1 - 2 * (j + 0.5) / n); lo[j] = j * 2.39996323; }
      LAT.push(la); LON.push(lo); N += n;
    });
    var DX = new Float32Array(N), DY = new Float32Array(N), DS = new Float32Array(N), DQ = new Int32Array(N);
    var bn = new Int32Array(CB * AB), boff = new Int32Array(CB * AB + 1), order = new Int32Array(N);
    var W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0;
    var energy = 0, target = 0, paused = false, visible = true, raf = 0;
    var mx = 0, my = 0, tx = 0, ty = 0;

    var dust = [];
    for (var i = 0; i < (mini ? 60 : 180); i++) dust.push({ a: Math.random() * 6.283, r: 1.12 + Math.random() * 0.35, y: Math.random() * 2 - 1, s: 0.05 + Math.random() * 0.12, tw: Math.random() * 6.283 });

    /* the backing store follows the canvas's layout size, never getBoundingClientRect(): that
       includes transforms, and the windows minimize and restore by scaling to 5%, so measuring
       mid-flight left a tiny canvas stretched blurry (and a transform never fires the observer).
       a canvas folded to 0 x 0 keeps its last good size. w, h: css px; bw, bh: device px if known */
    function size(w, h, bw, bh) {
      if (off) { w = off.w; h = off.h; }
      else if (w == null) { w = canvas.clientWidth; h = canvas.clientHeight; }
      if (!w || !h) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!bw || (window.devicePixelRatio || 1) > 2) { bw = Math.round(w * dpr); bh = Math.round(h * dpr); }
      if (W === w && H === h && canvas.width === bw && canvas.height === bh) return false;
      W = w; H = h; canvas.width = Math.max(1, bw); canvas.height = Math.max(1, bh);
      R = Math.min(W, H) * 0.33; cx = W / 2; cy = H / 2;
      return true;
    }

    // smooth, low-frequency waves: the surface swells and settles like liquid
    function disp(lat, lon, t, amp) {
      return 1 + amp * (0.5 * Math.sin(2 * lon + t * 0.55) * Math.sin(2 * lat - t * 0.42)
                      + 0.3 * Math.sin(3 * lat + 2 * lon - t * 0.47)
                      + 0.2 * Math.sin(lon - 3 * lat + t * 0.71));
    }
    var LX = -0.4, LY = -0.58, LZ = 0.71;

    function draw(t) {
      energy += (target - energy) * 0.04;
      tx += (mx - tx) * 0.04; ty += (my - ty) * 0.04;
      var amp = 0.13 + energy * 0.1, breathe = 1 + 0.03 * Math.sin(t * 0.9);
      var yaw = t * 0.09 + Math.sin(t * 0.13) * 0.6, pitch = 0.28 + Math.sin(t * 0.17) * 0.2;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var flow = t * (0.22 + energy * 0.25);             // the dot pattern streams around the surface
      var ox = cx + tx, oy = cy + ty, dotR = R / (mini ? 70 : 80);
      bn.fill(0);
      var idx = 0;
      for (var L = 0; L < LAYERS.length; L++) {
        var la = LAT[L], lo = LON[L], n = la.length, k = LAYERS[L][2] * breathe, lum = LAYERS[L][3];
        var ph = L * 1.7;
        for (var pi = 0; pi < n; pi++, idx++) {
            var lat = la[pi], cl = Math.cos(lat), sl = Math.sin(lat);
            var swirl = 0.3 * Math.sin(2 * lat + t * 0.3 + ph);
            var lon = lo[pi] + flow * (L ? -0.7 : 1) + swirl;
            var d = disp(lat, lon - flow, t + ph, amp) * k;
            var x = cl * Math.cos(lon) * d, y = sl * d, z = cl * Math.sin(lon) * d;
            // approximate normal: radial, tilted by the local slope of the swell
            var dd = (disp(lat, lon - flow + 0.08, t + ph, amp) - disp(lat, lon - flow, t + ph, amp)) * 6;
            var nx = cl * Math.cos(lon) - dd * Math.sin(lon), ny = sl, nz = cl * Math.sin(lon) + dd * Math.cos(lon);
            var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
            var nx1 = nx * cyw + nz * syw, nz1 = -nx * syw + nz * cyw, ny1 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
            var nl = Math.sqrt(nx1 * nx1 + ny1 * ny1 + nz2 * nz2) || 1;
            var lit = Math.max(0, (nx1 * LX + ny1 * LY + nz2 * LZ) / nl);
            var rim = Math.pow(1 - Math.abs(nz2 / nl), 2.5) * 0.55 * RIMK;
            var depth = (z2 + 1.2) / 2.4;
            var tone = Math.pow(Math.min(1, (0.08 + 0.72 * lit * LITK + rim) * (0.35 + 0.65 * depth)) * (0.6 + 0.4 * lum), GAMMA);
            var f = 3.8 / (3.8 - z2);
            var q = Math.min(CB - 1, Math.round(tone * (CB - 1))) * AB + Math.min(AB - 1, Math.floor(depth * lum * AB));
            DX[idx] = ox + x1 * R * f; DY[idx] = oy + y1 * R * f; DS[idx] = dotR * (0.55 + 0.95 * depth) * (L ? 0.8 : 1); DQ[idx] = q; bn[q]++;
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      var g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 1.35);
      g.addColorStop(0, "rgba(" + GLOW + "," + Math.min(0.5, (0.1 + energy * 0.1) * GS).toFixed(3) + ")");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      boff[0] = 0;
      for (var q2 = 0; q2 < CB * AB; q2++) boff[q2 + 1] = boff[q2] + bn[q2];
      bn.fill(0);
      for (var i2 = 0; i2 < N; i2++) { var qq = DQ[i2]; order[boff[qq] + bn[qq]++] = i2; }
      for (q2 = 0; q2 < CB * AB; q2++) {
        if (boff[q2 + 1] === boff[q2]) continue;
        ctx.fillStyle = STYLE[q2];
        for (var j = boff[q2]; j < boff[q2 + 1]; j++) { var kk = order[j], s = DS[kk]; ctx.fillRect(DX[kk] - s / 2, DY[kk] - s / 2, s, s); }
      }
      // a slow dust of points orbiting just outside the skin
      for (i2 = 0; i2 < dust.length; i2++) {
        var p = dust[i2], ang = p.a + t * p.s, pr = p.r * R, tw = 0.5 + 0.5 * Math.sin(t * 1.3 + p.tw);
        var pz = Math.sin(ang), px2 = ox + Math.cos(ang) * pr * Math.sqrt(1 - p.y * p.y), py2 = oy + p.y * pr;
        ctx.fillStyle = "rgba(" + DUST + "," + ((0.1 + 0.4 * tw) * (0.5 + 0.5 * pz)).toFixed(3) + ")";
        ctx.fillRect(px2, py2, 1.3, 1.3);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    var t0 = performance.now();
    function loop(now) {
      raf = 0;
      if (paused || !visible) return;
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !REDUCED && !paused && visible) raf = requestAnimationFrame(loop); }

    size();
    if (off) return { canvas: canvas, frame: draw, palette: palette, energy: function (e) { target = e; } };
    draw(4);
    function redraw() { draw(REDUCED || paused ? 4 : (performance.now() - t0) / 1000); }
    function remeasure() { if (size()) redraw(); }
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function (en) {
        var e = en[0], c = e.contentBoxSize && e.contentBoxSize[0], d = e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0];
        if (size(c ? c.inlineSize : e.contentRect.width, c ? c.blockSize : e.contentRect.height, d && d.inlineSize, d && d.blockSize)) redraw();
      });
      try { ro.observe(canvas, { box: "device-pixel-content-box" }); } catch (e) { ro.observe(canvas); }
    }
    // and whenever a window finishes moving, the tab comes back, the page returns from the
    // back/forward cache, or the screen's pixel density changes (a window dragged to another display)
    ["transitionend", "animationend"].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (e.target && e.target.contains && e.target.contains(canvas)) remeasure(); }, true);
    });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) remeasure(); });
    window.addEventListener("pageshow", remeasure);
    (function watchDpr() {
      if (!window.matchMedia) return;
      var mq = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
      var on = function () { remeasure(); if (mq.removeEventListener) mq.removeEventListener("change", on); watchDpr(); };
      if (mq.addEventListener) mq.addEventListener("change", on);
    })();
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; start(); }).observe(canvas);
    if (!mini && !REDUCED && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", function (e) {
        var r = canvas.getBoundingClientRect();
        mx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / window.innerWidth)) * 12;
        my = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / window.innerHeight)) * 9;
      }, { passive: true });
      canvas.addEventListener("pointerenter", function () { target = 0.8; });
      canvas.addEventListener("pointerleave", function () { target = 0; });
    }
    start();

    return {
      boost: function () { target = 1.4; if (REDUCED) draw(4); },
      calm: function () { target = 0; },
      center: function () { var r = canvas.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, R]; },
      pause: function (p) { paused = p; if (!p) start(); },
      palette: function (name) { palette(name); if (REDUCED || paused) draw(4); }
    };
  }

  window.Orb = Orb;
  window.OrbPalettes = PALETTES;
  window.orbs = [];
  document.querySelectorAll("canvas.orb").forEach(function (c) {
    if (!c.hasAttribute("data-manual")) window.orbs.push(Orb(c, { mini: c.classList.contains("orb-mini") }));
  });
})();
