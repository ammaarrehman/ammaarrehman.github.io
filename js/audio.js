/* audio: every sound on the site is synthesized with the Web Audio API: no files.
   nothing plays until someone clicks (browsers require a gesture), and the choice to
   mute is remembered. sounds run through one master gain and a compressor so a busy
   moment can't clip. the tab going to the background suspends everything.

   Sound.unlock()            call from a click/tap/key handler before the first sound
   Sound.sfx(name, opts)     one-shot: { pan: -1..1, vol: 0..1, surface, pitch }
   Sound.loop(name)          a held sound with live controls: .set({ vol, rate, pan }), .stop()
   Sound.music(mood)         "day", "night", "battle", or null to fade out
   Sound.toggle() / .on()    mute switch (persists in localStorage) */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master, sfxBus, musicBus, noiseBuf, enabled = true, listeners = [];
  try { enabled = localStorage.getItem("sound") !== "off"; } catch (e) {}

  function init() {
    if (ctx || !AC) return ctx;
    ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = enabled ? 0.85 : 0;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32;
    sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock() { init(); if (ctx && ctx.state === "suspended") ctx.resume(); }
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume();
  });

  function now() { return ctx.currentTime; }
  function pan(node, p) {
    if (!ctx.createStereoPanner) return node;
    var sp = ctx.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p || 0));
    node.connect(sp); return sp;
  }
  // an attack/decay envelope on a gain node; exponential ramps can't touch zero
  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(type, f0, f1, dur, vol, o) {
    o = o || {};
    var t0 = now() + (o.when || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, o.attack || 0.005, dur, vol);
    osc.connect(g); pan(g, o.pan).connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    return osc;
  }
  function noise(dur, vol, type, f0, f1, o) {
    o = o || {};
    var t0 = now() + (o.when || 0), src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    flt.type = type; flt.Q.value = o.q || 1; flt.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, o.attack || 0.003, dur, vol);
    src.connect(flt); flt.connect(g); pan(g, o.pan).connect(o.bus || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }
  function jit(f, amt) { return f * (1 + (Math.random() - 0.5) * (amt || 0.08)); }

  var SFX = {
    step: function (o) {
      var v = o.vol || 1, p = o.pan;
      if (o.surface === "dock") { tone("sine", jit(170), 110, 0.07, 0.16 * v, { pan: p }); noise(0.04, 0.05 * v, "lowpass", 800, 400, { pan: p }); }
      else if (o.surface === "grass") noise(0.06, 0.07 * v, "bandpass", jit(1400, 0.3), 700, { pan: p, q: 0.8 });
      else noise(0.05, 0.11 * v, "bandpass", jit(2600, 0.3), 1500, { pan: p, q: 1.4 });   // gravel, sand, the road
    },
    rustle: function (o) { noise(0.14, 0.06 * (o.vol || 1), "highpass", 3200, 2200, { pan: o.pan, attack: 0.02 }); },
    blip: function () { tone("square", 660, 880, 0.06, 0.05); },
    type: function () { tone("square", jit(1300, 0.2), null, 0.02, 0.018); },
    key: function () { tone("square", jit(1900, 0.1), null, 0.012, 0.02); noise(0.015, 0.03, "highpass", 4000); },
    err: function () { tone("square", 150, 110, 0.16, 0.05); },
    found: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, null, 0.12, 0.05, { when: i * 0.08 }); tone("triangle", f / 2, null, 0.18, 0.06, { when: i * 0.08 }); }); },
    open: function () { tone("triangle", 392, null, 0.08, 0.06); tone("triangle", 587, null, 0.1, 0.06, { when: 0.06 }); },
    hop: function () { tone("sine", 300, 620, 0.12, 0.08); },
    roar: function (o) {
      var v = o.vol || 1, t0 = now(), osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      osc.type = "sawtooth"; osc2.type = "square";
      osc.frequency.setValueAtTime(150, t0); osc.frequency.exponentialRampToValueAtTime(52, t0 + 1.5);
      osc2.frequency.setValueAtTime(97, t0); osc2.frequency.exponentialRampToValueAtTime(38, t0 + 1.5);
      lfo.frequency.value = 23; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(g.gain);          // a rattle in the throat
      flt.type = "lowpass"; flt.frequency.setValueAtTime(900, t0); flt.frequency.exponentialRampToValueAtTime(260, t0 + 1.5);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32 * v, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      osc.connect(flt); osc2.connect(flt); flt.connect(g); pan(g, o.pan).connect(sfxBus);
      [osc, osc2, lfo].forEach(function (n) { n.start(t0); n.stop(t0 + 1.7); });
      noise(1.3, 0.12 * v, "lowpass", 700, 200, { pan: o.pan, attack: 0.1 });
    },
    chirp: function (o) { tone("sine", jit(2600), 3400, 0.06, 0.05 * (o.vol || 1), { pan: o.pan }); tone("sine", jit(2900), 3600, 0.05, 0.04 * (o.vol || 1), { pan: o.pan, when: 0.09 }); },
    whistle: function (o) { tone("sine", 1500, 2200, 0.18, 0.06, { pan: o.pan }); tone("sine", 2200, 1750, 0.22, 0.06, { pan: o.pan, when: 0.2 }); },
    // the dinosaurs
    honkp: function (o) { var v = o.vol || 1; tone("triangle", 196, 165, 0.55, 0.14 * v, { pan: o.pan, attack: 0.05 }); tone("sawtooth", 98, 82, 0.55, 0.05 * v, { pan: o.pan, attack: 0.05 }); },   // a parasaurolophus through its crest
    stomp: function (o) { var v = o.vol || 1; tone("sine", jit(62, 0.15), 28, 0.28, 0.32 * v, { pan: o.pan }); noise(0.16, 0.1 * v, "lowpass", 320, 90, { pan: o.pan }); },
    hoot: function (o) { var v = o.vol || 1; tone("sine", 110, 92, 0.7, 0.2 * v, { pan: o.pan, attack: 0.12 }); tone("sine", 92, 78, 0.9, 0.18 * v, { pan: o.pan, attack: 0.12, when: 0.6 }); },   // a brachiosaurus, low and slow
    screech: function (o) { var v = o.vol || 1; tone("sawtooth", jit(1900), 700, 0.32, 0.07 * v, { pan: o.pan }); tone("square", jit(2400), 1300, 0.2, 0.035 * v, { pan: o.pan, when: 0.04 }); for (var i = 0; i < 3; i++) noise(0.02, 0.06 * v, "highpass", 3500, 3500, { pan: o.pan, when: 0.36 + i * 0.07 }); },
    snort: function (o) { var v = o.vol || 1; noise(0.14, 0.16 * v, "bandpass", 520, 300, { pan: o.pan, q: 2 }); noise(0.12, 0.12 * v, "bandpass", 480, 260, { pan: o.pan, q: 2, when: 0.2 }); },
    grunt: function (o) { var v = o.vol || 1; tone("sawtooth", jit(88), 70, 0.32, 0.12 * v, { pan: o.pan, attack: 0.03 }); noise(0.2, 0.05 * v, "lowpass", 400, 200, { pan: o.pan }); },
    squeak: function (o) { tone("sine", jit(1500), 2300, 0.09, 0.07 * (o.vol || 1), { pan: o.pan }); tone("sine", jit(1700), 2500, 0.07, 0.05 * (o.vol || 1), { pan: o.pan, when: 0.12 }); },
    caw: function (o) { var v = o.vol || 1; tone("sawtooth", jit(1300), 620, 0.35, 0.05 * v, { pan: o.pan }); noise(0.3, 0.04 * v, "bandpass", 1600, 900, { pan: o.pan, q: 3 }); },
    // the robots
    servo: function (o) { var v = o.vol || 1; tone("sawtooth", jit(260), 520, 0.14, 0.035 * v, { pan: o.pan }); tone("sawtooth", 520, 300, 0.12, 0.03 * v, { pan: o.pan, when: 0.16 }); },
    chatter: function (o) { var v = o.vol || 1, n = 3 + ((Math.random() * 4) | 0); for (var i = 0; i < n; i++) tone(Math.random() < 0.5 ? "sine" : "square", jit(900 + Math.random() * 1500, 0.1), jit(900 + Math.random() * 1500, 0.2), 0.06, 0.04 * v, { pan: o.pan, when: i * 0.075 }); },
    weld: function (o) { var v = o.vol || 1; for (var i = 0; i < 6; i++) noise(0.025, 0.08 * v, "highpass", 4500, 3000, { pan: o.pan, when: i * 0.04 + Math.random() * 0.03 }); tone("square", 60, 60, 0.3, 0.02 * v, { pan: o.pan }); },
    backup: function (o) { var v = o.vol || 1; for (var i = 0; i < 3; i++) tone("square", 1050, null, 0.12, 0.035 * v, { pan: o.pan, when: i * 0.3 }); },
    spray: function (o) { noise(0.5, 0.05 * (o.vol || 1), "highpass", 2500, 4000, { pan: o.pan, attack: 0.06 }); },
    // the orbs and the realities
    dash: function (o) { noise(0.35, 0.18, "bandpass", 300, 2600, { pan: o.pan, q: 3, attack: 0.25 }); tone("sawtooth", 55, 220, 0.3, 0.06, { pan: o.pan, attack: 0.25 }); },
    warp: function (o) {
      // reality tears: a falling sub-bass, a pitch-bent glitch stutter, and a hiss that sweeps down
      var t0 = now(); tone("sine", 180, 30, 1.1, 0.4); tone("sawtooth", 880, 40, 0.9, 0.08);
      for (var i = 0; i < 8; i++) tone("square", jit(200 + Math.random() * 2000, 0.3), null, 0.03, 0.05, { when: 0.05 + i * 0.045 });
      noise(1, 0.2, "bandpass", 6000, 200, { q: 1.5 });
    },
    splash: function (o) { noise(0.3, 0.12 * (o.vol || 1), "bandpass", 2800, 900, { pan: o.pan, q: 0.7 }); },
    plop: function (o) { tone("sine", jit(620), 180, 0.1, 0.07 * (o.vol || 1), { pan: o.pan }); },
    zap: function (o) { for (var i = 0; i < 4; i++) noise(0.03, 0.12, "highpass", 3000, 5000, { pan: o.pan, when: i * 0.05 * Math.random() + i * 0.03 }); tone("sawtooth", 120, 90, 0.25, 0.05, { pan: o.pan }); },
    honk: function () { tone("square", 440, null, 0.22, 0.06); tone("square", 554, null, 0.22, 0.05); },
    hit: function (o) { tone("sine", 110, 40, 0.3, 0.3 * (o.vol || 1), { pan: o.pan }); noise(0.18, 0.2 * (o.vol || 1), "lowpass", 1400, 300, { pan: o.pan }); },
    thud: function (o) { tone("sine", 80, 35, 0.4, 0.35, { pan: o.pan }); noise(0.25, 0.12, "lowpass", 600, 120, { pan: o.pan }); },
    burst: function (o) { noise(0.8, 0.22, "lowpass", 3000, 150, { pan: o.pan }); tone("sawtooth", 220, 40, 0.7, 0.12, { pan: o.pan }); },
    crown: function () { [392, 494, 587, 784].forEach(function (f, i) { tone("triangle", f, null, 1.3 - i * 0.15, 0.07, { when: i * 0.12, attack: 0.02 }); tone("square", f * 2, null, 0.15, 0.025, { when: i * 0.12 }); }); },
    whoosh: function (o) { noise(o && o.out ? 0.6 : 0.9, 0.2, "bandpass", o && o.out ? 2400 : 300, o && o.out ? 300 : 2600, { q: 2, attack: 0.25 }); },
    pop: function (o) { tone("sine", jit(90, 0.3), 40, 0.12, 0.12 * (o.vol || 1), { pan: o.pan }); },     // a lava bubble
    beep: function () { tone("square", 988, null, 0.14, 0.06); },
    grant: function () { [440, 660, 880].forEach(function (f, i) { tone("square", f, null, 0.09, 0.05, { when: i * 0.07 }); }); }
  };
  function sfx(name, o) {
    if (!enabled || !ctx || ctx.state !== "running" || !SFX[name]) return;
    try { SFX[name](o || {}); } catch (e) {}
  }

  // held sounds: the helicopter rotor, the M3's engine, the surf, the volcano's rumble
  function loop(name) {
    if (!ctx) return { set: function () {}, stop: function () {} };
    var out = ctx.createGain(), sp = ctx.createStereoPanner ? ctx.createStereoPanner() : null, nodes = [], ctl = {};
    out.gain.value = 0;
    if (sp) { out.connect(sp); sp.connect(sfxBus); } else out.connect(sfxBus);
    function src() { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; nodes.push(s); return s; }
    if (name === "rotor") {
      var n = src(), bp = ctx.createBiquadFilter(), chop = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.9;
      lfo.type = "square"; lfo.frequency.value = 6; lg.gain.value = 0.5; chop.gain.value = 0.5;
      lfo.connect(lg); lg.connect(chop.gain); n.connect(bp); bp.connect(chop); chop.connect(out);
      nodes.push(lfo); ctl.rate = function (r) { lfo.frequency.setTargetAtTime(3 + r * 17, now(), 0.2); bp.frequency.setTargetAtTime(380 + r * 260, now(), 0.2); };
    } else if (name === "engine") {
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter();
      o1.type = "sawtooth"; o2.type = "square"; o1.frequency.value = 42; o2.frequency.value = 42.7; lp.type = "lowpass"; lp.frequency.value = 520;
      var g2 = ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(out); nodes.push(o1, o2);
      ctl.rate = function (r) { var f = 40 + r * 95; o1.frequency.setTargetAtTime(f, now(), 0.08); o2.frequency.setTargetAtTime(f * 1.012, now(), 0.08); lp.frequency.setTargetAtTime(420 + r * 900, now(), 0.1); };
    } else if (name === "waves") {
      var w = src(), wl = ctx.createBiquadFilter(), sw = ctx.createGain(), wlfo = ctx.createOscillator(), wlg = ctx.createGain();
      wl.type = "lowpass"; wl.frequency.value = 480; wlfo.frequency.value = 0.11; wlg.gain.value = 0.45; sw.gain.value = 0.55;
      wlfo.connect(wlg); wlg.connect(sw.gain); w.connect(wl); wl.connect(sw); sw.connect(out); nodes.push(wlfo);
    } else if (name === "rumble") {
      var r2 = src(), rl = ctx.createBiquadFilter();
      r2.playbackRate.value = 0.35; rl.type = "lowpass"; rl.frequency.value = 140; rl.Q.value = 3;
      r2.connect(rl); rl.connect(out);
    } else if (name === "falls") {                                       // the waterfall: broad white noise, a little lowpassed
      var fsrc = src(), fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 2400; fsrc.connect(fl); fl.connect(out);
    } else if (name === "buzz") {                                        // a drone's four rotors
      var b1 = ctx.createOscillator(), b2 = ctx.createOscillator(), bf = ctx.createBiquadFilter();
      b1.type = "sawtooth"; b2.type = "sawtooth"; b1.frequency.value = 185; b2.frequency.value = 192; bf.type = "bandpass"; bf.frequency.value = 900; bf.Q.value = 0.8;
      b1.connect(bf); b2.connect(bf); bf.connect(out); nodes.push(b1, b2);
    } else if (name === "aura") {
      // the orbs' presence: two detuned low saws beating against each other, a choir-ish
      // formant on top, and a breathy swell, all slowly swelling in and out
      var a1 = ctx.createOscillator(), a2 = ctx.createOscillator(), a3 = ctx.createOscillator(), al = ctx.createBiquadFilter(), fm = ctx.createBiquadFilter(), sw = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(), hs = src(), hf = ctx.createBiquadFilter();
      a1.type = "sawtooth"; a2.type = "sawtooth"; a3.type = "triangle"; a1.frequency.value = 55; a2.frequency.value = 55.8; a3.frequency.value = 82.4;
      al.type = "lowpass"; al.frequency.value = 420; fm.type = "bandpass"; fm.frequency.value = 700; fm.Q.value = 6;
      lf.frequency.value = 0.18; lg.gain.value = 0.35; sw.gain.value = 0.6; lf.connect(lg); lg.connect(sw.gain);
      hf.type = "bandpass"; hf.frequency.value = 1200; hf.Q.value = 0.7; var hg = ctx.createGain(); hg.gain.value = 0.15;
      a1.connect(al); a2.connect(al); a3.connect(fm); al.connect(sw); fm.connect(sw); hs.connect(hf); hf.connect(hg); hg.connect(sw); sw.connect(out);
      nodes.push(a1, a2, a3, lf);
      ctl.rate = function (r) { al.frequency.setTargetAtTime(300 + r * 1400, now(), 0.3); fm.frequency.setTargetAtTime(500 + r * 900, now(), 0.3); };
    }
    var t0 = now(); nodes.forEach(function (s) { s.start(t0); });
    return {
      set: function (p) {
        if (p.vol !== undefined) out.gain.setTargetAtTime(enabled ? Math.max(0, p.vol) : 0, now(), 0.12);
        if (p.rate !== undefined && ctl.rate) ctl.rate(p.rate);
        if (p.pan !== undefined && sp) sp.pan.setTargetAtTime(Math.max(-1, Math.min(1, p.pan)), now(), 0.1);
      },
      stop: function () {
        out.gain.setTargetAtTime(0, now(), 0.15);
        var tEnd = now() + 0.6; nodes.forEach(function (s) { try { s.stop(tEnd); } catch (e) {} });
      }
    };
  }

  /* music: a small sequencer. each mood is four bars of chords; a melody is picked from the
     chord tones once (seeded) so the loop repeats like a real track, not random noodling.
     notes are scheduled a little ahead of the clock so timing never wobbles. */
  var MOODS = {
    day:    { bpm: 96, lead: "square", bass: "triangle", chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], hat: true, vol: 1 },
    night:  { bpm: 68, lead: "sine", bass: "triangle", chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], hat: false, vol: 0.8, echo: true },
    battle: { bpm: 150, lead: "square", bass: "sawtooth", chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], hat: true, vol: 1.2, drive: true, drums: true, pad: true },
    future: { bpm: 128, lead: "sawtooth", bass: "square", chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], hat: true, vol: 1.1, drive: true, drums: true, pad: true, arp: true },
    chaos:  { bpm: 172, lead: "sawtooth", bass: "sawtooth", chords: [[49, 52, 55], [50, 53, 56], [48, 51, 54], [47, 50, 56]], hat: true, vol: 1.2, drive: true, drums: true, pad: true, glitch: true }
  };
  var mood = null, seq = null, step = 0, nextT = 0, pattern = null, moodGain = null, echo = null;
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function makePattern(m) {
    var s = 7, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, out = [];
    for (var bar = 0; bar < 4; bar++) for (var i = 0; i < 8; i++) {
      var ch = m.chords[bar];
      out.push(rnd() < (m.drive ? 0.85 : 0.6) ? ch[(rnd() * 3) | 0] + 12 + (rnd() < 0.2 ? 12 : 0) : null);
    }
    return out;
  }
  function note(type, n, t0, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = midi(n);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(moodGain); if (echo) g.connect(echo);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function tick() {
    if (!mood || !ctx) return;
    var m = MOODS[mood], eighth = 60 / m.bpm / 2;
    while (nextT < now() + 0.15) {
      var bar = Math.floor(step / 8) % 4, i = step % 8, ch = m.chords[bar], v = m.vol;
      if (i === 0 || (m.drive && i % 2 === 0)) note(m.bass, ch[0] - 12, nextT, eighth * (m.drive ? 1.6 : 3.6), 0.16 * v);
      if (!m.drive && i === 4) note(m.bass, ch[2] - 24, nextT, eighth * 3.2, 0.12 * v);
      var ln = pattern[step % 32];
      if (m.arp) ln = ch[i % 3] + 12 + (i >= 4 ? 12 : 0);                          // synthwave: straight arpeggios
      if (ln !== null) note(m.lead, ln + (m.glitch && Math.random() < 0.2 ? (Math.random() < 0.5 ? 1 : -1) : 0), nextT, eighth * (mood === "night" ? 2.6 : m.glitch ? 0.6 : 1.2), (mood === "night" ? 0.07 : 0.04) * v);
      if (m.drums) {                                                               // kick on the beat, a snare-ish crack on 2 and 4, timpani on the bar
        if (i % 2 === 0) { var ko = ctx.createOscillator(), kg = ctx.createGain(); ko.frequency.setValueAtTime(140, nextT); ko.frequency.exponentialRampToValueAtTime(40, nextT + 0.12); kg.gain.setValueAtTime(0.3 * v, nextT); kg.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.18); ko.connect(kg); kg.connect(moodGain); ko.start(nextT); ko.stop(nextT + 0.2); }
        if (i === 2 || i === 6) { var sn = ctx.createBufferSource(), sf = ctx.createBiquadFilter(), sg2 = ctx.createGain(); sn.buffer = noiseBuf; sf.type = "bandpass"; sf.frequency.value = 1800; sg2.gain.setValueAtTime(0.12 * v, nextT); sg2.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.15); sn.connect(sf); sf.connect(sg2); sg2.connect(moodGain); sn.start(nextT, Math.random()); sn.stop(nextT + 0.16); }
        if (i === 0) note("sine", ch[0] - 24, nextT, eighth * 6, 0.22 * v);
      }
      if (m.pad && i === 0) ch.forEach(function (n2) { note("sawtooth", n2, nextT, eighth * 7.5, 0.018 * v); note("sawtooth", n2 + 0.1, nextT, eighth * 7.5, 0.014 * v); });   // a dark choir under it all
      if (m.glitch && Math.random() < 0.25) { var gb = ctx.createBufferSource(), gg = ctx.createGain(); gb.buffer = noiseBuf; gb.playbackRate.value = 0.2 + Math.random() * 3; gg.gain.setValueAtTime(0.06 * v, nextT); gg.gain.exponentialRampToValueAtTime(0.0001, nextT + eighth); gb.connect(gg); gg.connect(moodGain); gb.start(nextT, Math.random()); gb.stop(nextT + eighth); }
      if (m.hat && i % 2 === 1) { var h = ctx.createBufferSource(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); h.buffer = noiseBuf; hf.type = "highpass"; hf.frequency.value = 7000; hg.gain.setValueAtTime(0.03 * v, nextT); hg.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.04); h.connect(hf); hf.connect(hg); hg.connect(moodGain); h.start(nextT, Math.random()); h.stop(nextT + 0.05); }
      nextT += eighth; step++;
    }
  }
  function music(m) {
    if (!ctx) return;
    if (m === mood) return;
    if (moodGain) { var old = moodGain; old.gain.setTargetAtTime(0, now(), 0.4); setTimeout(function () { old.disconnect(); }, 2000); }
    mood = m; clearInterval(seq); seq = null; moodGain = null; echo = null;
    if (!m) return;
    moodGain = ctx.createGain(); moodGain.gain.value = 0.0001; moodGain.gain.setTargetAtTime(1, now(), 0.8); moodGain.connect(musicBus);
    if (MOODS[m].echo) { echo = ctx.createDelay(); echo.delayTime.value = 0.42; var fb = ctx.createGain(); fb.gain.value = 0.35; echo.connect(fb); fb.connect(echo); echo.connect(moodGain); }
    pattern = makePattern(MOODS[m]); step = 0; nextT = now() + 0.1;
    seq = setInterval(tick, 40); tick();
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem("sound", on ? "on" : "off"); } catch (e) {}
    if (ctx) { master.gain.setTargetAtTime(on ? 0.85 : 0, now(), 0.05); if (on) ctx.resume(); }
    listeners.forEach(function (f) { f(on); });
  }
  window.Sound = {
    unlock: unlock,
    sfx: sfx,
    loop: loop,
    music: music,
    ready: function () { return !!ctx && ctx.state === "running"; },
    on: function () { return enabled; },
    toggle: function () { unlock(); setEnabled(!enabled); return enabled; },
    onChange: function (f) { listeners.push(f); }
  };
})();
