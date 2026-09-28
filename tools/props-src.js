/* props-src: the source of the island's man-made sprites (buildings, landmarks, lamps, crates,
   the outpost's kit, the park gate), drawn in code. Dev-only: tools/atlas.mjs runs this in a
   headless browser and bakes the result into img/atlas/props.png; the game only loads the PNG
   (handoff 3 D2). Edit a sprite here, then run `node tools/atlas.mjs`. */
window.buildProps = function () {
  function mkCanvas() { return document.createElement("canvas"); }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  function sprite(w, h, fn) { var c = mkCanvas(); c.width = w; c.height = h; var g = c.getContext("2d"); fn(function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }, g); return c; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function tone(v, tones, x, y) {
    var f = Math.max(0, Math.min(0.999, v)) * (tones.length - 1), i = Math.floor(f);
    return (f - i) > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? tones[Math.min(tones.length - 1, i + 1)] : tones[i];
  }
  var BARK = ["#3a2616", "#553820", "#6e4a2a", "#8a6038"];
  // 3x5 pixel letters for signs
  var GLYPH = { P: ["111", "101", "111", "100", "100"], I: ["111", "010", "010", "010", "111"], S: ["111", "100", "111", "001", "111"], L: ["100", "100", "100", "100", "111"],
                A: ["010", "101", "111", "101", "101"], N: ["110", "101", "101", "101", "101"], D: ["110", "101", "101", "101", "110"], "'": ["1", "1", "0", "0", "0"], " ": ["00", "00", "00", "00", "00"] };
  function pixText(r, str, x, y, col) { str.split("").forEach(function (ch) { var gl = GLYPH[ch]; gl.forEach(function (row, j) { for (var i = 0; i < row.length; i++) if (row[i] === "1") r(x + i, y + j, 1, 1, col); }); x += gl[0].length + 1; }); }
  function textW(str) { return str.split("").reduce(function (s, ch) { return s + GLYPH[ch][0].length + 1; }, -1); }
  var SPR = {
    lamp: sprite(7, 18, function (r) { r(3, 5, 1, 13, "#2b2b2b"); r(2, 16, 3, 2, "#2b2b2b"); r(1, 1, 5, 4, "#3a3a3a"); r(2, 2, 3, 2, "#ffe9b0"); r(3, 0, 1, 1, "#3a3a3a"); }),
    crates: sprite(15, 16, function (r) {
      function crate(x, y) { r(x, y, 10, 8, "#a0703e"); r(x, y, 10, 1, "#c89458"); r(x, y + 7, 10, 1, "#5a3a1e"); r(x, y, 1, 8, "#7a5230"); r(x + 9, y, 1, 8, "#5a3a1e"); r(x + 1, y + 3, 8, 1, "#7a5230"); r(x + 4, y + 1, 1, 6, "#7a5230"); }
      crate(0, 8); crate(5, 1);
    }),
    // the visitor centre: a stone plinth, timber walls, a deep red roof, a lit door and two banners
    visitor: sprite(68, 60, function (r, g) {
      r(2, 50, 64, 9, "#6e6a62"); r(2, 50, 64, 1, "#8d887e"); for (var i = 2; i < 66; i += 7) r(i, 51 + (i % 2), 1, 8, "#57534c");
      for (var yy = 28; yy < 50; yy++) for (var xx = 4; xx < 64; xx++) { g.fillStyle = tone(0.62 - (yy - 28) / 22 * 0.25 + ((xx >> 2) % 2 ? 0.05 : 0), BARK, xx, yy); g.fillRect(xx, yy, 1, 1); }
      for (var c = 0; c < 4; c++) { var wx = [8, 18, 44, 54][c]; r(wx, 33, 7, 8, "#20282e"); r(wx, 33, 7, 1, "#3a2616"); r(wx + 1, 34, 5, 6, "#2d4250"); r(wx + 1, 34, 2, 2, "#5e8aa0"); r(wx + 3, 33, 1, 8, "#3a2616"); }
      r(28, 32, 12, 18, "#2a1a0e"); r(29, 33, 10, 17, "#f2d58a"); r(33, 33, 2, 17, "#c8a04e"); r(26, 30, 16, 2, "#3a2616");
      for (yy = 0; yy < 30; yy++) { var inset = Math.round((30 - yy) * 0.35), w2 = 68 - inset * 2; for (xx = 0; xx < w2; xx++) { g.fillStyle = tone(0.35 + yy / 30 * 0.45 + ((xx + inset) % 6 === 0 ? -0.15 : 0), ["#5a1a12", "#7e2618", "#a8361f", "#c9502e", "#e27a4e"], xx + inset, yy); g.fillRect(xx + inset, yy, 1, 1); } }
      r(0, 29, 68, 2, "#3a120c");
      [12, 52].forEach(function (bx) { r(bx, 36, 5, 11, "#b8321f"); r(bx, 36, 5, 1, "#e0584a"); r(bx + 1, 40, 3, 3, "#f2d58a"); r(bx + 2, 47, 1, 2, "#b8321f"); });
    }),
    // the outpost bunker: half sunk into the ground, sandbags on the roof, a heavy steel door
    bunker: sprite(70, 44, function (r, g) {
      for (var yy = 12; yy < 42; yy++) for (var xx = 2; xx < 68; xx++) { g.fillStyle = tone(0.58 - (yy - 12) / 30 * 0.3 + (hash(xx >> 2, yy >> 2) - 0.5) * 0.12, ["#3a3c3a", "#50534f", "#686b66", "#83867f"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      for (var i = 0; i < 9; i++) { r(3 + i * 7, 6 + (i % 2), 7, 6, "#a8966a"); r(3 + i * 7, 6 + (i % 2), 7, 1, "#c8b688"); r(3 + i * 7, 11 + (i % 2), 7, 1, "#6e6040"); }
      r(2, 12, 66, 2, "#2a2c2a"); r(28, 20, 14, 22, "#2c3034"); r(29, 21, 12, 21, "#4a5058"); for (i = 0; i < 4; i++) r(29, 24 + i * 5, 12, 1, "#2c3034"); r(38, 30, 2, 3, "#c8a040");
      for (i = 0; i < 12; i += 4) { r(28 + i, 19, 2, 1, "#f2c230"); r(30 + i, 19, 2, 1, "#1a1a1a"); }
      r(8, 22, 10, 6, "#20282e"); r(9, 23, 8, 4, "#4DD6E8"); r(9, 23, 8, 1, "#b8f4ff"); r(52, 22, 10, 6, "#20282e"); r(53, 23, 8, 4, "#4DD6E8");
      r(60, 0, 2, 12, "#6a6d68"); r(58, 2, 6, 1, "#6a6d68"); r(61, 0, 1, 1, "#ff5252"); r(6, 2, 5, 4, "#50534f"); r(7, 1, 3, 1, "#6a6d68");
    }),
    solar: sprite(18, 14, function (r) { r(2, 9, 1, 5, "#3a3c3a"); r(14, 9, 1, 5, "#3a3c3a"); r(0, 1, 18, 9, "#8a939b"); r(1, 2, 16, 7, "#1c2a54"); for (var i = 1; i < 17; i += 4) r(i, 2, 1, 7, "#3a4a7a"); r(1, 5, 16, 1, "#3a4a7a"); r(2, 3, 3, 1, "#8ab0ff"); }),
    mast: sprite(12, 50, function (r) { for (var yy = 4; yy < 50; yy++) { var w2 = Math.round(2 + (yy - 4) / 46 * 8); r(6 - w2 / 2, yy, 1, 1, "#7a7d78"); r(6 + w2 / 2, yy, 1, 1, "#7a7d78"); if (yy % 6 === 0) r(6 - w2 / 2, yy, w2, 1, "#5a5d58"); } r(5, 0, 2, 5, "#9a9d98"); r(2, 12, 8, 3, "#c8ccd0"); r(3, 13, 6, 1, "#8a8e92"); }),
    generator: sprite(18, 15, function (r) { r(0, 4, 18, 11, "#c8a038"); r(0, 4, 18, 1, "#e8c058"); r(0, 14, 18, 1, "#7a5a1e"); for (var i = 3; i < 12; i += 2) r(i, 7, 1, 5, "#7a5a1e"); r(13, 7, 3, 3, "#2a2c2a"); r(14, 0, 2, 5, "#4a4c4a"); r(1, 12, 3, 3, "#2a2c2a"); r(14, 12, 3, 3, "#2a2c2a"); }),
    tank: sprite(14, 24, function (r, g) { r(2, 16, 1, 8, "#4a4c4a"); r(11, 16, 1, 8, "#4a4c4a"); for (var yy = 2; yy < 18; yy++) for (var xx = 0; xx < 14; xx++) { g.fillStyle = tone(0.8 - xx / 14 * 0.6, ["#3a5a6a", "#4a7488", "#5e90a6", "#7ab0c4"], xx, yy); g.fillRect(xx, yy, 1, 1); } r(0, 1, 14, 2, "#8ab4c8"); r(0, 8, 14, 1, "#2e4654"); r(0, 13, 14, 1, "#2e4654"); }),
    tent: sprite(22, 14, function (r) { for (var yy = 0; yy < 12; yy++) { var w2 = Math.round(2 + yy * 1.6); r(11 - w2 / 2, yy + 1, w2, 1, yy % 3 === 0 ? "#4a5a30" : "#5c6e3c"); } r(9, 6, 4, 7, "#2a3218"); r(10, 1, 2, 1, "#3a4624"); r(0, 12, 22, 1, "#3a4624"); }),
    campfire: sprite(16, 8, function (r) { [[1, 5], [4, 6], [8, 6], [12, 5], [3, 3], [11, 3]].forEach(function (q) { r(q[0], q[1], 3, 2, "#6d737a"); r(q[0], q[1], 2, 1, "#9aa0a6"); }); r(4, 4, 8, 2, "#5a3a1e"); r(6, 3, 5, 2, "#7a5230"); }),
    // the old shrine: a standing stone carved with a ring (an orb), older than the park
    shrine: sprite(22, 34, function (r, g) {
      for (var yy = 4; yy < 32; yy++) for (var xx = 3; xx < 19; xx++) { var e2 = Math.min(xx - 3, 18 - xx, yy - 4); if (yy < 8 && e2 < 8 - yy) continue; g.fillStyle = tone(0.7 - xx / 22 * 0.5 + (hash(xx, yy) - 0.5) * 0.15, ["#3a3c4a", "#4f5264", "#686c80", "#8a8ea2"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      g.strokeStyle = "#2a2c38"; g.lineWidth = 2; g.beginPath(); g.arc(11, 15, 4.5, 0, 6.283); g.stroke(); r(10, 14, 2, 2, "#2a2c38");
      r(7, 23, 8, 1, "#2a2c38"); r(8, 26, 6, 1, "#2a2c38"); r(0, 31, 22, 3, "#50534f"); r(1, 31, 20, 1, "#6a6d68");
      for (var m = 0; m < 14; m++) r(3 + ((hash(m, 3) * 15) | 0), 4 + ((hash(3, m) * 26) | 0), 2, 1, "#4a8a3a");
    }),
    // the supply depot: corrugated walls, a half-open roller door with crates inside, a drone pad on the roof
    depot: sprite(52, 46, function (r, g) {
      for (var yy = 14; yy < 44; yy++) for (var xx = 1; xx < 51; xx++) { g.fillStyle = tone(0.55 - (yy - 14) / 30 * 0.2 + (xx % 3 === 0 ? -0.12 : 0.04), ["#3a4046", "#50585f", "#6a737b", "#8a939b"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(14, 26, 24, 18, "#1a1e22"); for (var i = 0; i < 5; i++) r(14, 26 + i * 2, 24, 1, "#7a838b");
      r(17, 37, 8, 7, "#a0703e"); r(17, 37, 8, 1, "#c89458"); r(27, 39, 8, 5, "#a0703e"); r(27, 39, 8, 1, "#c89458");
      for (i = 0; i < 24; i += 4) { r(14 + i, 44, 2, 2, "#f2c230"); r(16 + i, 44, 2, 2, "#1a1a1a"); }
      for (yy = 0; yy < 14; yy++) for (xx = 0; xx < 52; xx++) { g.fillStyle = tone(0.4 + yy / 14 * 0.35, ["#2c3238", "#3e454c", "#565e66", "#737b83"], xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(18, 3, 16, 8, "#4a525a"); r(19, 4, 14, 6, "#5e666e"); r(25, 5, 2, 4, "#f4f4f4"); r(23, 6, 6, 1, "#f4f4f4"); r(29, 5, 2, 4, "#f4f4f4");   // pad
      r(4, 2, 6, 4, "#2c3238"); r(5, 1, 4, 1, "#737b83"); r(44, 0, 1, 8, "#737b83"); r(43, 0, 3, 1, "#ff5252");
      r(4, 18, 7, 4, "#f2c230"); r(5, 19, 5, 2, "#1a1a1a");
    }),
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
    // the mouth of a cave, cut into the volcano's cliff (a terminal glows inside)
    cave: sprite(14, 12, function (r) {
      for (var j = 0; j < 12; j++) { var w = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((11 - j) / 11.5, 2))) * 6); r(7 - w, j, w * 2, 1, j < 2 ? "#2a211a" : "#0c0907"); }
      r(1, 11, 12, 1, "#1a1410"); r(4, 3, 1, 1, "#3a2e24"); r(9, 5, 1, 1, "#3a2e24");
    }),
    boat: sprite(36, 20, function (r) {
      r(2, 9, 32, 6, "#f4f4f4"); r(4, 15, 28, 2, "#c7d3dc"); r(6, 17, 24, 1, "#9fb3c2"); r(2, 12, 32, 1, "#d64545");
      r(6, 7, 24, 2, "#9b6b3f"); r(20, 1, 10, 6, "#f4f4f4"); r(22, 2, 6, 2, "#4fa3d6"); r(12, 0, 1, 8, "#7a5530");
    }),
    // the park gate: two log pillars with torch baskets, a beam, and a painted plaque
    gate: sprite(90, 58, function (r, g) {
      [[6, 0], [74, 0]].forEach(function (p) {
        for (var yy = 12; yy < 58; yy++) for (var xx = 0; xx < 10; xx++) { g.fillStyle = tone(0.75 - xx / 10 * 0.6 + (hash(xx + p[0], (yy / 3) | 0) - 0.5) * 0.25, BARK, p[0] + xx, yy); g.fillRect(p[0] + xx, yy, 1, 1); }
        for (yy = 16; yy < 56; yy += 9) r(p[0], yy, 10, 1, "#2e1e10");
        r(p[0] - 2, 8, 14, 4, "#3a2616"); r(p[0] - 1, 6, 12, 2, "#553820"); r(p[0] + 1, 4, 8, 2, "#2a1a0e");   // torch basket
        r(p[0] - 1, 55, 12, 3, "#5c4632");
      });
      for (var yy = 16; yy < 26; yy++) for (var xx = 2; xx < 88; xx++) { g.fillStyle = tone(0.7 - (yy - 16) / 10 * 0.5 + (hash(xx >> 2, yy) - 0.5) * 0.2, BARK, xx, yy); g.fillRect(xx, yy, 1, 1); }
      r(2, 16, 86, 1, "#9a6c40"); r(2, 25, 86, 1, "#2e1e10");
      var label = "PI'S ISLAND", lw = textW(label), px0 = 45 - Math.ceil(lw / 2) - 4;
      r(px0 - 1, 13, lw + 10, 15, "#1a0f08"); r(px0, 14, lw + 8, 13, "#b8321f"); r(px0 + 1, 15, lw + 6, 11, "#d9463b");
      r(px0 + 1, 15, lw + 6, 1, "#ec6a52");
      pixText(r, label, px0 + 4, 18, "#ffe6a8");
      r(px0 + 4, 24, lw, 1, "#8a2414");
    })
  };
  return SPR;
};
