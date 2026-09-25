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
  var ctx = null, master, sfxBus, musicBus, noiseBuf, verb, verbIn, enabled = true, listeners = [];
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
    // a long, dark reverb for the orbs: an impulse of decaying stereo noise
    verb = ctx.createConvolver(); var ir = ctx.createBuffer(2, ctx.sampleRate * 3.2, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var dd = ir.getChannelData(ch); for (var j = 0; j < dd.length; j++) dd[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / dd.length, 2.6); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.7; verbIn.connect(verb); verb.connect(master);
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
    osc.connect(g); var pg = pan(g, o.pan); pg.connect(o.bus || sfxBus); if (o.verb) pg.connect(verbIn);
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
    src.connect(flt); flt.connect(g); var pn = pan(g, o.pan); pn.connect(o.bus || sfxBus); if (o.verb) pn.connect(verbIn);
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
    warp: function () {
      // reality warping: the world's sound collapses like a tape stopping (a chord dragged down to
      // nothing), a ring-modulated shriek tears across it, grains of it stutter and scatter across
      // the stereo field, and a sub-bass boom rolls away into a long dark reverb
      var t0 = now(), i;
      [110, 138.6, 164.8, 220].forEach(function (f) {
        var o1 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o1.type = "sawtooth"; o1.frequency.setValueAtTime(f * 2, t0); o1.frequency.exponentialRampToValueAtTime(f / 16, t0 + 1.1);
        lp.type = "lowpass"; lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(90, t0 + 1.1);
        g.gain.setValueAtTime(0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
        o1.connect(lp); lp.connect(g); g.connect(sfxBus); g.connect(verbIn); o1.start(t0); o1.stop(t0 + 1.25);
      });
      var car = ctx.createOscillator(), mod = ctx.createOscillator(), rm = ctx.createGain(), rg = ctx.createGain();
      car.type = "sawtooth"; car.frequency.setValueAtTime(1800, t0); car.frequency.exponentialRampToValueAtTime(140, t0 + 0.9);
      mod.frequency.setValueAtTime(1370, t0); mod.frequency.exponentialRampToValueAtTime(61, t0 + 0.9);
      rm.gain.value = 0; mod.connect(rm.gain); car.connect(rm);
      rg.gain.setValueAtTime(0.09, t0); rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
      rm.connect(rg); rg.connect(sfxBus); rg.connect(verbIn); car.start(t0); mod.start(t0); car.stop(t0 + 1); mod.stop(t0 + 1);
      for (i = 0; i < 14; i++) {
        if (Math.random() < 0.5) tone("square", jit(100 + Math.random() * 3000, 0.3), jit(60 + Math.random() * 900, 0.3), 0.04, 0.05, { when: 0.03 + i * 0.04 + Math.random() * 0.02, pan: Math.random() * 2 - 1, verb: true });
        else noise(0.04, 0.09, "bandpass", 300 + Math.random() * 6000, null, { when: 0.03 + i * 0.045, pan: Math.random() * 2 - 1, q: 4, verb: true });
      }
      tone("sine", 70, 18, 1.6, 0.55, { verb: true }); noise(1.4, 0.2, "lowpass", 1400, 60, { verb: true });
      noise(0.9, 0.14, "bandpass", 8000, 150, { q: 1.2, attack: 0.05, verb: true });
    },
    // the moment before a clash: reversed air rushing in
    dash: function (o) { noise(0.38, 0.22, "bandpass", 200, 3200, { pan: o.pan, q: 2.5, attack: 0.34, verb: true }); tone("sawtooth", 40, 160, 0.36, 0.07, { pan: o.pan, attack: 0.3 }); },
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
      // the orbs' presence, meant to feel wrong: a beating sub drone felt more than heard; a
      // ring-modulated metallic tone with no musical pitch; a theremin-like wail that slides
      // between notes that don't belong together; and whispering formants in the noise
      var s1 = ctx.createOscillator(), s2 = ctx.createOscillator(), sub = ctx.createGain();
      s1.frequency.value = 36; s2.frequency.value = 36.6; sub.gain.value = 0.5; s1.connect(sub); s2.connect(sub); sub.connect(out);
      var c1 = ctx.createOscillator(), m1 = ctx.createOscillator(), ring = ctx.createGain(), rbp = ctx.createBiquadFilter(), rgain = ctx.createGain();
      c1.type = "sawtooth"; c1.frequency.value = 233; m1.frequency.value = 157.3; ring.gain.value = 0; m1.connect(ring.gain); c1.connect(ring);
      rbp.type = "bandpass"; rbp.frequency.value = 900; rbp.Q.value = 3; rgain.gain.value = 0.22; ring.connect(rbp); rbp.connect(rgain); rgain.connect(out);
      var sweep = ctx.createOscillator(), sweepG = ctx.createGain(); sweep.frequency.value = 0.07; sweepG.gain.value = 600; sweep.connect(sweepG); sweepG.connect(rbp.frequency);
      var wail = ctx.createOscillator(), vib = ctx.createOscillator(), vibG = ctx.createGain(), wailG = ctx.createGain(), wlp = ctx.createBiquadFilter();
      wail.type = "sine"; wail.frequency.value = 420; vib.frequency.value = 5.3; vibG.gain.value = 9; vib.connect(vibG); vibG.connect(wail.frequency);
      wlp.type = "lowpass"; wlp.frequency.value = 1400; wailG.gain.value = 0.09; wail.connect(wlp); wlp.connect(wailG); wailG.connect(out);
      var wsrc = src(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), wg = ctx.createGain(), wl = ctx.createOscillator(), wlg = ctx.createGain();
      f1.type = "bandpass"; f1.frequency.value = 700; f1.Q.value = 14; f2.type = "bandpass"; f2.frequency.value = 2300; f2.Q.value = 16;
      wl.frequency.value = 0.31; wlg.gain.value = 0.12; wg.gain.value = 0.14; wl.connect(wlg); wlg.connect(wg.gain);
      wsrc.connect(f1); wsrc.connect(f2); f1.connect(wg); f2.connect(wg); wg.connect(out);
      nodes.push(s1, s2, c1, m1, sweep, wail, vib, wl);
      if (verbIn) out.connect(verbIn);
      var notes = [420, 397, 561, 333, 471, 298], wn = 0;
      var slide = setInterval(function () { if (!ctx) return; wn = (wn + 1 + ((Math.random() * 3) | 0)) % notes.length; wail.frequency.setTargetAtTime(notes[wn] * (0.9 + Math.random() * 0.2), now(), 0.6); f1.frequency.setTargetAtTime(400 + Math.random() * 900, now(), 0.4); f2.frequency.setTargetAtTime(1600 + Math.random() * 1800, now(), 0.4); }, 1400);
      ctl.cleanup = function () { clearInterval(slide); };
      ctl.rate = function (r) { rgain.gain.setTargetAtTime(0.12 + r * 0.25, now(), 0.2); c1.frequency.setTargetAtTime(233 + r * 140, now(), 0.3); wailG.gain.setTargetAtTime(0.05 + r * 0.1, now(), 0.3); };
    }
    var t0 = now(); nodes.forEach(function (s) { s.start(t0); });
    return {
      set: function (p) {
        if (p.vol !== undefined) out.gain.setTargetAtTime(enabled ? Math.max(0, p.vol) : 0, now(), 0.12);
        if (p.rate !== undefined && ctl.rate) ctl.rate(p.rate);
        if (p.pan !== undefined && sp) sp.pan.setTargetAtTime(Math.max(-1, Math.min(1, p.pan)), now(), 0.1);
      },
      stop: function () {
        if (ctl.cleanup) ctl.cleanup();
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
