/* hands — the page background. two ascii hands (after the Sistine ceiling)
   start at the edges and reach toward each other as you scroll; by the end
   of the page the fingertips spark. characters glint in pink, violet, cyan and bone,
   and a soft lamp follows the pointer. still frame for reduced motion. */
(function () {
  var cv = document.querySelector("canvas.hands");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var GLINT = ["#f454a6", "#8b5cf6", "#4DD6E8", "#f4efe2"];
  var lines = null, split = 0, rows = 0, cols = 0;
  var W = 0, H = 0, dpr = 1, cw = 0, lh = 0, fs = 0, artW = 0, top = 0;
  var left = null, right = null, leftLit = null, rightLit = null, dark = true;
  var tipL = [0, 0], tipR = [0, 0], glints = [], mx = -999, my = -999, raf = 0, lamp = document.createElement("canvas");

  function theme() {
    var bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().toLowerCase();
    dark = bg.indexOf("#0") === 0 || bg.indexOf("#1") === 0;
  }

  // draw one hand's characters into its own canvas, in a given ink
  function bake(from, to, ink) {
    var c = document.createElement("canvas");
    c.width = Math.ceil((to - from) * cw * dpr); c.height = Math.ceil(rows * lh * dpr);
    var g = c.getContext("2d");
    g.scale(dpr, dpr); g.font = "400 " + fs + "px 'Cascadia Mono', monospace"; g.textBaseline = "top"; g.fillStyle = ink;
    for (var y = 0; y < rows; y++) {
      var l = lines[y];
      for (var x = from; x < to && x < l.length; x++) if (l[x] !== " ") g.fillText(l[x], (x - from) * cw, y * lh);
    }
    return c;
  }

  function build() {
    if (!lines) return;
    theme();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // the art spans a bit wider than the screen; phones crop the wrists
    artW = Math.max(W * 1.04, 760);
    cw = artW / cols; fs = cw / 0.6; lh = cw * 2;
    top = Math.max(70, (H - rows * lh) * 0.42);
    var base = dark ? "rgba(255,255,255,.17)" : "rgba(20,20,20,.14)", lit = dark ? "rgba(235,235,255,.62)" : "rgba(20,20,20,.55)";
    left = bake(0, split, base); right = bake(split, cols, base);
    leftLit = bake(0, split, lit); rightLit = bake(split, cols, lit);
  }

  function offsets() {
    var max = document.documentElement.scrollHeight - H, p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    var e = 1 - Math.pow(1 - p, 2);
    // at the top the hands sit far apart; by the bottom they close the original gap
    var spread = (1 - e) * Math.max(80, W * 0.16);
    var x0 = (W - artW) / 2;
    return { p: p, lx: x0 - spread, rx: x0 + split * cw + spread };
  }

  function draw(now) {
    var o = offsets();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(left, Math.round(o.lx * dpr), Math.round(top * dpr));
    ctx.drawImage(right, Math.round(o.rx * dpr), Math.round(top * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // lamp: the lit copy, masked to a soft circle in its own canvas, laid over the pointer
    if (FINE && mx > -900 && !REDUCED) {
      var R = 150, lc = lamp.getContext("2d");
      lamp.width = lamp.height = Math.round(R * 2 * dpr);
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.drawImage(leftLit, o.lx - mx + R, top - my + R, leftLit.width / dpr, leftLit.height / dpr);
      lc.drawImage(rightLit, o.rx - mx + R, top - my + R, rightLit.width / dpr, rightLit.height / dpr);
      var g = lc.createRadialGradient(R, R, 0, R, R, R);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      lc.globalCompositeOperation = "destination-in"; lc.fillStyle = g; lc.fillRect(0, 0, R * 2, R * 2);
      ctx.drawImage(lamp, mx - R, my - R, R * 2, R * 2);
    }

    // glints: a few characters flare in the orb's palette and fade
    if (!REDUCED) {
      if (glints.length < 26 && Math.random() < 0.6) {
        var y = (Math.random() * rows) | 0, x = (Math.random() * cols) | 0, ch = lines[y][x];
        if (ch && ch !== " ") glints.push({ x: x, y: y, ch: ch, life: 1, col: GLINT[(Math.random() * GLINT.length) | 0] });
      }
      ctx.font = "700 " + fs + "px 'Cascadia Mono', monospace"; ctx.textBaseline = "top";
      for (var i = glints.length - 1; i >= 0; i--) {
        var gl = glints[i], gx = (gl.x < split ? o.lx + gl.x * cw : o.rx + (gl.x - split) * cw), gy = top + gl.y * lh;
        ctx.globalAlpha = Math.sin(gl.life * Math.PI) * (dark ? 0.9 : 0.7);
        ctx.fillStyle = gl.col; ctx.fillText(gl.ch, gx, gy);
        gl.life -= 0.012; if (gl.life <= 0) glints.splice(i, 1);
      }
      ctx.globalAlpha = 1;
    }

    // the spark: once the fingertips are close, a small light jumps between them
    var ax = o.lx + tipL[0] * cw + cw, ay = top + tipL[1] * lh + lh / 2, bx = o.rx + (tipR[0] - split) * cw, by = top + tipR[1] * lh + lh / 2;
    var near = Math.max(0, (o.p - 0.82) / 0.18);
    if (near > 0) {
      var sx = (ax + bx) / 2, sy = (ay + by) / 2, pulse = REDUCED ? 1 : 0.75 + 0.25 * Math.sin(now / 160);
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40 * near);
      sg.addColorStop(0, "rgba(244,84,166," + (0.55 * near * pulse).toFixed(3) + ")");
      sg.addColorStop(0.4, "rgba(139,92,246," + (0.25 * near * pulse).toFixed(3) + ")");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg; ctx.fillRect(sx - 40, sy - 40, 80, 80);
      ctx.fillStyle = "rgba(255,255,255," + (0.85 * near * pulse).toFixed(3) + ")"; ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }

  var lastDraw = 0;
  function loop(now) {
    raf = 0;
    // 30fps is plenty for a background, and it sits idle while the island is open
    if (document.documentElement.classList.contains("in-world") || now - lastDraw < 32) { raf = requestAnimationFrame(loop); return; }
    lastDraw = now;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  fetch("assets/hands.json").then(function (r) { return r.json(); }).then(function (d) {
    lines = d.lines; split = d.split; rows = lines.length;
    cols = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    lines = lines.map(function (l) { while (l.length < cols) l += " "; return l; });
    // fingertips: the right-most ink of the left hand, the left-most ink of the right hand
    var bestL = -1, bestR = cols;
    lines.forEach(function (l, y) {
      for (var x = split - 1; x >= 0; x--) if (l[x] !== " ") { if (x > bestL) { bestL = x; tipL = [x, y]; } break; }
      for (x = split; x < cols; x++) if (l[x] !== " ") { if (x < bestR) { bestR = x; tipR = [x, y]; } break; }
    });
    var go = function () { build(); draw(performance.now()); cv.classList.add("on"); if (!REDUCED) raf = requestAnimationFrame(loop); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }).catch(function () { cv.remove(); });

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { build(); draw(performance.now()); }, 150); });
  if (REDUCED) window.addEventListener("scroll", function () { draw(performance.now()); }, { passive: true });
  if (FINE) {
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", function () { mx = my = -999; });
  }
  if ("MutationObserver" in window)
    new MutationObserver(function () { build(); draw(performance.now()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
