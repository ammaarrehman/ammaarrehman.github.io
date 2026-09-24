/* face — hover the headshot and it turns into terminal ascii. the photo is
   sampled once into a character grid (darker pixels get denser glyphs);
   on hover each cell decodes from noise into its glyph in a random order,
   and a scan line rolls down it. tap toggles it on touch screens. */
(function () {
  var fig = document.querySelector(".about-photo"), img = fig && fig.querySelector("img");
  if (!img) return;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RAMP = " .'`:-~=+*coa#%&@", NOISE = "!<>-_\\/[]{}=+*^?#01";
  var cv = document.createElement("canvas");
  cv.className = "face-ascii"; cv.setAttribute("aria-hidden", "true");
  img.insertAdjacentElement("afterend", cv);
  var ctx = cv.getContext("2d");
  var cols = 58, rows = 0, cells = null, order = null, W = 0, H = 0, dpr = 1, raf = 0, p = 0, dir = 0, last = 0;

  function sample() {
    var aspect = img.naturalHeight / img.naturalWidth;
    rows = Math.round(cols * aspect * 0.52);
    var c = document.createElement("canvas"); c.width = cols; c.height = rows;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0, cols, rows);
    var d = g.getImageData(0, 0, cols, rows).data, lum = [], lo = 1, hi = 0;
    for (var i = 0; i < cols * rows; i++) {
      var v = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;
      lum.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    // inverted: the photo has a light backdrop, so darks (hair, eyes, shirt) get the dense glyphs
    cells = lum.map(function (v) { v = 1 - (v - lo) / (hi - lo || 1); v = Math.pow(v, 1.35); return { v: v, ch: RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))], at: Math.random() }; });
  }
  function size() {
    W = img.offsetWidth; H = img.offsetHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.top = img.offsetTop + "px"; cv.style.width = W + "px"; cv.style.height = H + "px";
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var cw = W / cols, chh = H / rows, fs = Math.min(cw / 0.6, chh * 1.05);
    ctx.font = "600 " + fs.toFixed(2) + "px 'Cascadia Mono', monospace"; ctx.textBaseline = "top";
    var accent = getComputedStyle(fig).getPropertyValue("--accent").trim() || "#FFB000";
    var scan = ((now / 1000) * 0.6 % 1.2) * rows;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], x = (i % cols) * cw, y = ((i / cols) | 0) * chh, row = (i / cols) | 0;
      if (p < c.at) { if (p > c.at - 0.25) { ctx.fillStyle = "rgba(160,160,160,.35)"; ctx.fillText(NOISE[(Math.random() * NOISE.length) | 0], x, y); } continue; }
      if (c.ch === " ") continue;
      var near = Math.max(0, 1 - Math.abs(row - scan) / 2);
      ctx.fillStyle = c.v > 0.86 ? accent : "rgba(236,236,236," + (0.35 + 0.65 * c.v + near * 0.3).toFixed(3) + ")";
      ctx.fillText(c.ch, x, y);
    }
  }
  function loop(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    p = Math.max(0, Math.min(1.25, p + dir * dt * 2.2));
    draw(now);
    if (dir > 0 || p > 0) raf = requestAnimationFrame(loop);
  }
  function show(on) {
    if (!cells && img.complete && img.naturalWidth) ready();   // hovered before the lazy photo finished loading
    if (!cells) return;
    fig.classList.toggle("ascii", on);
    if (REDUCED) { p = on ? 1.25 : 0; draw(0); return; }
    dir = on ? 1 : -1;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function ready() { sample(); size(); }
  if (img.complete && img.naturalWidth) ready(); else img.addEventListener("load", ready, { once: true });
  window.addEventListener("resize", function () { if (cells) { size(); if (p > 0) draw(performance.now()); } });
  fig.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") show(true); });
  fig.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch") show(false); });
  fig.addEventListener("click", function () { if (window.matchMedia("(pointer: coarse)").matches) show(!fig.classList.contains("ascii")); });
})();
