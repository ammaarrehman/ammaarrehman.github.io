/* audio: every sound on the site is synthesized with the Web Audio API: no files.
   nothing plays until someone clicks (browsers require a gesture), and the choice to
   mute is remembered. four buses (music, effects, ambience, and the master they feed) each
   have a volume the island's settings panel can change; the mix is remembered too. a
   compressor and a limiter sit at the end so a busy moment can't clip, and the tab going to
   the background suspends everything.

   Sound.unlock()            call from a click/tap/key handler before the first sound
   Sound.sfx(name, opts)     one-shot: { pan: -1..1, vol: 0..1, surface, pitch }
   Sound.loop(name)          a held sound with live controls: .set({ vol, rate, pan }), .stop()
   Sound.music(mood)         "day", "night", "dread", "doom", "doom-future", "doom-chaos", or null
   Sound.intensity(0..1)     how far the dark scores have crept
   Sound.mix() / .setMix(k, v)   bus volumes 0..1: master, music, sfx, amb
   Sound.restart()           tear the engine down and build it again (the settings panel's button)
   Sound.toggle() / .on()    mute switch (persists in localStorage) */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, musicLP = null, musicDuck = null, live = 0, restarting = false, stateListeners = [], voices = [], curBus = null, curEnd = 0, master, sfxBus, musicBus, ambBus, noiseBuf, verb, verbIn, enabled = true, listeners = [], restartListeners = [];
  var BASE = { master: 0.85, music: 0.42, sfx: 0.9, amb: 0.9 };
  var MIX = { master: 0.7, music: 0.8, sfx: 1, amb: 0.8 };             // a moderate start; the visitor's own levels are remembered
  try { enabled = localStorage.getItem("sound") !== "off"; } catch (e) {}
  try { var saved = JSON.parse(localStorage.getItem("sound-mix") || "{}"); Object.keys(MIX).forEach(function (k) { if (typeof saved[k] === "number") MIX[k] = Math.max(0, Math.min(1, saved[k])); }); } catch (e) {}

  function init() {
    if (ctx || !AC || restarting) return ctx;
    ctx = new AC();
    // safari can interrupt the context (a call, siri, the lock screen); tell whoever's listening
    ctx.addEventListener("statechange", function () { var st = ctx ? ctx.state : "closed"; stateListeners.forEach(function (f) { f(st); }); });
    // count every source from start to end (the debug overlay shows it), and unhook each one
    // from the graph the moment it finishes so nothing lingers
    ["createOscillator", "createBufferSource"].forEach(function (m) {
      var make = ctx[m].bind(ctx);
      ctx[m] = function () { var n = make(); live++; n.addEventListener("ended", function () { live--; try { n.disconnect(); } catch (e) {} }); return n; };
    });
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain();
    applyMix(true);
    // the music runs through a lowpass (muffled through a transition) and a duck (a card is open)
    musicLP = ctx.createBiquadFilter(); musicLP.type = "lowpass"; musicLP.frequency.value = 20000; musicLP.Q.value = 0.5;
    musicDuck = ctx.createGain(); musicDuck.gain.value = 1;
    sfxBus.connect(master); musicBus.connect(musicLP); musicLP.connect(musicDuck); musicDuck.connect(master); ambBus.connect(master); master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    // a long, dark reverb: an impulse of decaying stereo noise, darker as it tails off
    verb = ctx.createConvolver(); var ir = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var dd = ir.getChannelData(ch), lp = 0; for (var j = 0; j < dd.length; j++) { var k2 = 0.25 + 0.7 * (j / dd.length); lp += ((Math.random() * 2 - 1) - lp) * (1 - k2); dd[j] = lp * Math.pow(1 - j / dd.length, 2.2) * 1.6; } }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.7; verbIn.connect(verb); verb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function applyMix(instant) {
    if (!ctx) return;
    var set = function (g, v) { if (instant) g.gain.value = v; else g.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
    set(master, enabled ? BASE.master * MIX.master : 0);
    set(musicBus, BASE.music * MIX.music); set(sfxBus, BASE.sfx * MIX.sfx); set(ambBus, BASE.amb * MIX.amb);
  }
  /* unlock from inside a click, tap or key handler: resume the context and play one silent
     sample in the same handler (what iOS wants before it lets anything through). where the
     browser has an audio session, ask for "playback" so the ringer switch doesn't mute it */
  function unlock() {
    init(); if (!ctx) return;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    if (ctx.state !== "running" && enabled) {
      try { var b = ctx.createBuffer(1, 1, 22050), s0 = ctx.createBufferSource(); s0.buffer = b; s0.connect(ctx.destination); s0.start(0); } catch (e) {}
      var r = ctx.resume(); if (r && r.catch) r.catch(function () {});
    }
  }
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
    osc.connect(g); var pg = pan(g, o.pan); pg.connect(o.bus || curBus || sfxBus); if (o.verb) pg.connect(verbIn);
    osc.start(t0); osc.stop(t0 + dur + (o.attack || 0) + 0.05); curEnd = Math.max(curEnd, t0 + dur + (o.attack || 0) + 0.05);
    return osc;
  }
  function noise(dur, vol, type, f0, f1, o) {
    o = o || {};
    var t0 = now() + (o.when || 0), src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    flt.type = type; flt.Q.value = o.q || 1; flt.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, o.attack || 0.003, dur, vol);
    src.connect(flt); flt.connect(g); var pn = pan(g, o.pan); pn.connect(o.bus || curBus || sfxBus); if (o.verb) pn.connect(verbIn);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + (o.attack || 0) + 0.05); curEnd = Math.max(curEnd, t0 + dur + (o.attack || 0) + 0.05);
  }
  function jit(f, amt) { return f * (1 + (Math.random() - 0.5) * (amt || 0.08)); }
  // a struck bell: inharmonic partials that ring out into the reverb. dark, not sweet
  function bell(f, vol, dur, o) {
    o = o || {};
    [[1, 1], [2.76, 0.55], [5.4, 0.32], [8.93, 0.18], [0.5, 0.6]].forEach(function (p, i) {
      tone("sine", f * p[0] * (1 + (Math.random() - 0.5) * 0.006), null, dur * (1 - i * 0.12), vol * p[1], { when: o.when, attack: 0.004, verb: true, bus: o.bus, pan: o.pan });
    });
    noise(0.05, vol * 0.5, "bandpass", f * 6, null, { when: o.when, q: 3, bus: o.bus, verb: true });
  }

  var SFX = {
    step: function (o) {
      var v = o.vol || 1, p = o.pan;
      if (o.surface === "dock") { tone("sine", jit(160), 105, 0.07, 0.11 * v, { pan: p }); noise(0.04, 0.03 * v, "lowpass", 700, 350, { pan: p }); }
      else if (o.surface === "grass") noise(0.09, 0.026 * v, "lowpass", jit(640, 0.3), 260, { pan: p, attack: 0.014 });              // a soft brush of grass
      else noise(0.06, 0.05 * v, "bandpass", jit(1300, 0.3), 700, { pan: p, q: 0.9, attack: 0.006 });                                 // gravel, sand, the road
    },
    rustle: function (o) { noise(0.2, 0.03 * (o.vol || 1), "bandpass", 1700, 1100, { pan: o.pan, attack: 0.05, q: 0.7 }); },
    blip: function () { tone("square", 660, 880, 0.06, 0.04); },
    type: function () { tone("square", jit(1300, 0.2), null, 0.02, 0.014); },
    key: function () { tone("square", jit(1900, 0.1), null, 0.012, 0.016); noise(0.015, 0.02, "highpass", 4000); },
    err: function () { tone("square", 150, 110, 0.16, 0.04); },
    found: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, null, 0.12, 0.04, { when: i * 0.08 }); tone("triangle", f / 2, null, 0.18, 0.05, { when: i * 0.08 }); }); },
    open: function () { tone("triangle", 392, null, 0.08, 0.05); tone("triangle", 587, null, 0.1, 0.05, { when: 0.06 }); },
    hop: function () { tone("sine", 300, 620, 0.12, 0.06); },
    roar: function (o) {
      var v = o.vol || 1, t0 = now(), osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      osc.type = "sawtooth"; osc2.type = "square";
      osc.frequency.setValueAtTime(150, t0); osc.frequency.exponentialRampToValueAtTime(52, t0 + 1.5);
      osc2.frequency.setValueAtTime(97, t0); osc2.frequency.exponentialRampToValueAtTime(38, t0 + 1.5);
      lfo.frequency.value = 23; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(g.gain);          // a rattle in the throat
      flt.type = "lowpass"; flt.frequency.setValueAtTime(900, t0); flt.frequency.exponentialRampToValueAtTime(260, t0 + 1.5);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.3 * v), t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      osc.connect(flt); osc2.connect(flt); flt.connect(g); pan(g, o.pan).connect(curBus || sfxBus); curEnd = Math.max(curEnd, t0 + 1.7);
      [osc, osc2, lfo].forEach(function (n) { n.start(t0); n.stop(t0 + 1.7); });
      noise(1.3, 0.1 * v, "lowpass", 700, 200, { pan: o.pan, attack: 0.1 });
    },
    chirp: function (o) { tone("sine", jit(2600), 3400, 0.06, 0.035 * (o.vol || 1), { pan: o.pan }); tone("sine", jit(2900), 3600, 0.05, 0.03 * (o.vol || 1), { pan: o.pan, when: 0.09 }); },
    whistle: function (o) { tone("sine", 1500, 2200, 0.18, 0.05, { pan: o.pan }); tone("sine", 2200, 1750, 0.22, 0.05, { pan: o.pan, when: 0.2 }); },
    // the dinosaurs
    honkp: function (o) { var v = o.vol || 1; tone("triangle", 196, 165, 0.55, 0.12 * v, { pan: o.pan, attack: 0.05 }); tone("sawtooth", 98, 82, 0.55, 0.04 * v, { pan: o.pan, attack: 0.05 }); },
    stomp: function (o) { var v = o.vol || 1; tone("sine", jit(62, 0.15), 28, 0.28, 0.28 * v, { pan: o.pan }); noise(0.16, 0.08 * v, "lowpass", 320, 90, { pan: o.pan }); },
    hoot: function (o) { var v = o.vol || 1; tone("sine", 110, 92, 0.7, 0.18 * v, { pan: o.pan, attack: 0.12 }); tone("sine", 92, 78, 0.9, 0.16 * v, { pan: o.pan, attack: 0.12, when: 0.6 }); },
    screech: function (o) { var v = o.vol || 1; tone("sawtooth", jit(1900), 700, 0.32, 0.05 * v, { pan: o.pan }); tone("square", jit(2400), 1300, 0.2, 0.025 * v, { pan: o.pan, when: 0.04 }); for (var i = 0; i < 3; i++) noise(0.02, 0.04 * v, "highpass", 3500, 3500, { pan: o.pan, when: 0.36 + i * 0.07 }); },
    snort: function (o) { var v = o.vol || 1; noise(0.14, 0.13 * v, "bandpass", 520, 300, { pan: o.pan, q: 2 }); noise(0.12, 0.1 * v, "bandpass", 480, 260, { pan: o.pan, q: 2, when: 0.2 }); },
    grunt: function (o) { var v = o.vol || 1; tone("sawtooth", jit(88), 70, 0.32, 0.1 * v, { pan: o.pan, attack: 0.03 }); noise(0.2, 0.04 * v, "lowpass", 400, 200, { pan: o.pan }); },
    squeak: function (o) { tone("sine", jit(1500), 2300, 0.09, 0.05 * (o.vol || 1), { pan: o.pan }); tone("sine", jit(1700), 2500, 0.07, 0.04 * (o.vol || 1), { pan: o.pan, when: 0.12 }); },
    caw: function (o) { var v = o.vol || 1; tone("sawtooth", jit(1300), 620, 0.35, 0.04 * v, { pan: o.pan }); noise(0.3, 0.03 * v, "bandpass", 1600, 900, { pan: o.pan, q: 3 }); },
    flap: function (o) { var v = o.vol || 1; noise(0.16, 0.05 * v, "lowpass", 900, 300, { pan: o.pan, attack: 0.04 }); },
    // the robots
    servo: function (o) { var v = o.vol || 1; tone("sawtooth", jit(260), 520, 0.14, 0.025 * v, { pan: o.pan }); tone("sawtooth", 520, 300, 0.12, 0.02 * v, { pan: o.pan, when: 0.16 }); },
    chatter: function (o) { var v = o.vol || 1, n = 3 + ((Math.random() * 4) | 0); for (var i = 0; i < n; i++) tone(Math.random() < 0.5 ? "sine" : "square", jit(900 + Math.random() * 1500, 0.1), jit(900 + Math.random() * 1500, 0.2), 0.06, 0.03 * v, { pan: o.pan, when: i * 0.075 }); },
    weld: function (o) { var v = o.vol || 1; for (var i = 0; i < 6; i++) noise(0.025, 0.05 * v, "highpass", 4500, 3000, { pan: o.pan, when: i * 0.04 + Math.random() * 0.03 }); tone("square", 60, 60, 0.3, 0.015 * v, { pan: o.pan }); },
    backup: function (o) { var v = o.vol || 1; for (var i = 0; i < 3; i++) tone("square", 1050, null, 0.12, 0.025 * v, { pan: o.pan, when: i * 0.3 }); },
    spray: function (o) { noise(0.5, 0.035 * (o.vol || 1), "highpass", 2500, 4000, { pan: o.pan, attack: 0.06 }); },
    // the car
    skid: function (o) { var v = o.vol || 1; noise(0.28, 0.06 * v, "bandpass", jit(1900, 0.2), 1300, { pan: o.pan, q: 6, attack: 0.02 }); },
    gear: function () { tone("square", 180, 120, 0.05, 0.03); noise(0.03, 0.03, "bandpass", 2400, null, { q: 3 }); },
    // the orbs and the realities
    warp: function () {
      // reality giving way: the world's sound dragged down to nothing like a tape stopping, a
      // tearing noise across it, grains of it scattering through the stereo field, and a sub
      // drop rolling off into the long dark reverb
      var t0 = now(), i;
      [55, 65.4, 77.8, 110].forEach(function (f) {
        var o1 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o1.type = "sawtooth"; o1.frequency.setValueAtTime(f * 2, t0); o1.frequency.exponentialRampToValueAtTime(f / 16, t0 + 1.4);
        lp.type = "lowpass"; lp.frequency.setValueAtTime(2200, t0); lp.frequency.exponentialRampToValueAtTime(70, t0 + 1.4);
        g.gain.setValueAtTime(0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
        o1.connect(lp); lp.connect(g); g.connect(curBus || sfxBus); g.connect(verbIn); o1.start(t0); o1.stop(t0 + 1.55); curEnd = Math.max(curEnd, t0 + 1.55);
      });
      noise(1.1, 0.12, "bandpass", 5000, 120, { q: 1.4, attack: 0.04, verb: true });
      for (i = 0; i < 12; i++) noise(0.05, 0.05, "bandpass", 200 + Math.random() * 3000, null, { when: 0.05 + i * 0.06 + Math.random() * 0.03, pan: Math.random() * 2 - 1, q: 5, verb: true });
      tone("sine", 60, 16, 2.2, 0.5, { verb: true }); noise(1.8, 0.16, "lowpass", 900, 40, { verb: true });
    },
    // the moment before a clash: the air dragged in
    dash: function (o) { noise(0.5, 0.16, "bandpass", 160, 2600, { pan: o.pan, q: 2.5, attack: 0.46, verb: true }); tone("sawtooth", 32, 110, 0.5, 0.05, { pan: o.pan, attack: 0.42 }); },
    // two stars meeting: a pressure wave you feel in the chest, a white roar that sweeps from
    // bright to buried, debris crackling out for seconds after, and a sub that falls through the floor
    nova: function (o) {
      var v = o.vol || 1, p = o.pan;
      tone("sine", 48, 14, 3.4, 0.7 * v, { pan: p, verb: true });
      tone("triangle", 96, 22, 2.2, 0.25 * v, { pan: p });
      noise(4.2, 0.36 * v, "lowpass", 9000, 60, { pan: p, attack: 0.008, verb: true });
      noise(0.5, 0.25 * v, "highpass", 2000, 400, { pan: p, attack: 0.002 });
      for (var i = 0; i < 26; i++) noise(0.03 + Math.random() * 0.05, (0.05 + Math.random() * 0.06) * v, "bandpass", 300 + Math.random() * 4000, null, { when: 0.15 + Math.pow(Math.random(), 1.6) * 3, pan: (p || 0) + (Math.random() - 0.5) * 1.4, q: 3, verb: true });
      noise(3, 0.08 * v, "bandpass", 60, 30, { q: 0.7, when: 0.4, attack: 0.6, verb: true });                        // the long rumble after
    },
    splash: function (o) { noise(0.3, 0.09 * (o.vol || 1), "bandpass", 2800, 900, { pan: o.pan, q: 0.7 }); },
    plop: function (o) { tone("sine", jit(620), 180, 0.1, 0.05 * (o.vol || 1), { pan: o.pan }); },
    zap: function (o) { for (var i = 0; i < 4; i++) noise(0.03, 0.08, "highpass", 3000, 5000, { pan: o.pan, when: i * 0.05 * Math.random() + i * 0.03 }); tone("sawtooth", 120, 90, 0.25, 0.04, { pan: o.pan }); },
    honk: function () { tone("square", 440, null, 0.22, 0.045); tone("square", 554, null, 0.22, 0.04); },
    hit: function (o) { tone("sine", 90, 30, 0.5, 0.3 * (o.vol || 1), { pan: o.pan, verb: true }); noise(0.3, 0.16 * (o.vol || 1), "lowpass", 1200, 150, { pan: o.pan, verb: true }); },
    thud: function (o) { tone("sine", 70, 28, 0.6, 0.32, { pan: o.pan }); noise(0.35, 0.1, "lowpass", 500, 90, { pan: o.pan, verb: true }); },
    burst: function (o) { SFX.nova({ pan: o.pan, vol: 0.8 }); },
    // the fight is over, and nothing about it is a victory: a deep bell, and a chord that sinks
    crown: function () {
      bell(55, 0.22, 7);
      [[33, 0.05], [34, 0.035], [40, 0.04], [45, 0.03]].forEach(function (c) { tone("sawtooth", 440 * Math.pow(2, (c[0] - 69) / 12), 440 * Math.pow(2, (c[0] - 70) / 12), 6, c[1], { attack: 1.4, verb: true }); });
    },
    whoosh: function (o) { noise(o && o.out ? 0.6 : 0.9, 0.14, "bandpass", o && o.out ? 2400 : 300, o && o.out ? 300 : 2600, { q: 2, attack: 0.25 }); },
    pop: function (o) { tone("sine", jit(90, 0.3), 40, 0.12, 0.09 * (o.vol || 1), { pan: o.pan }); },     // a lava bubble
    beep: function () { tone("square", 988, null, 0.14, 0.05); },
    grant: function () { [440, 415, 311].forEach(function (f, i) { tone("square", f, null, 0.1, 0.04, { when: i * 0.08 }); }); },
    toll: function (o) { bell((o && o.f) || 73.4, (o && o.vol) || 0.2, 6, { pan: o && o.pan }); }
  };
  /* each one-shot is a voice: its own gain on the effects bus. at most 24 play at once; past
     that the oldest is faded out in 15 ms and let go. finished voices are unhooked */
  var VOICES = 24;
  function sfx(name, o) {
    if (!enabled || !ctx || ctx.state !== "running" || !SFX[name]) return;
    var t0 = now();
    voices = voices.filter(function (v) { if (v.end < t0) { try { v.g.disconnect(); } catch (e) {} return false; } return true; });
    if (voices.length >= VOICES) { var old = voices.shift(); old.g.gain.setTargetAtTime(0, t0, 0.015); setTimeout(function () { try { old.g.disconnect(); } catch (e) {} }, 200); }
    var vg = ctx.createGain(); vg.connect(sfxBus); curBus = vg; curEnd = t0;
    try { SFX[name](o || {}); } catch (e) {}
    curBus = null; voices.push({ g: vg, end: curEnd + 0.1 });
  }

  // held sounds: the helicopter rotor, the M3's engine, the surf, the volcano's rumble, the
  // waterfalls, the drones, the orbs' presence. vehicles sit on the effects bus, the rest on ambience
  var loops = [];
  function loop(name) {
    if (!ctx) return { set: function () {}, stop: function () {} };
    var out = ctx.createGain(), sp = ctx.createStereoPanner ? ctx.createStereoPanner() : null, nodes = [], ctl = {};
    var bus = name === "rotor" || name === "engine" ? sfxBus : ambBus;
    out.gain.value = 0;
    if (sp) { out.connect(sp); sp.connect(bus); } else out.connect(bus);
    function src() { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; nodes.push(s); return s; }
    function osc(type, f) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; nodes.push(o); return o; }
    if (name === "rotor") {
      // a slow, heavy whump-whump from the main blades (low noise, chopped by a smooth wave),
      // not a buzz; a faint turbine whine underneath
      var n = src(), lp = ctx.createBiquadFilter(), chop = ctx.createGain(), lfo = osc("sine", 3), lg = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 0.8;
      lg.gain.value = 0.45; chop.gain.value = 0.55;
      lfo.connect(lg); lg.connect(chop.gain); n.connect(lp); lp.connect(chop); chop.connect(out);
      var tw = osc("sine", 1200), twg = ctx.createGain(); twg.gain.value = 0.012; tw.connect(twg); twg.connect(out);
      ctl.rate = function (r) { lfo.frequency.setTargetAtTime(1.6 + r * 3.2, now(), 0.4); lp.frequency.setTargetAtTime(160 + r * 140, now(), 0.4); tw.frequency.setTargetAtTime(700 + r * 600, now(), 0.6); };
    } else if (name === "engine") {
      var o1 = osc("sawtooth", 42), o2 = osc("square", 42.7), elp = ctx.createBiquadFilter();
      elp.type = "lowpass"; elp.frequency.value = 520;
      var g2 = ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(elp); o2.connect(g2); g2.connect(elp); elp.connect(out);
      ctl.rate = function (r) { var f = 38 + r * 95; o1.frequency.setTargetAtTime(f, now(), 0.08); o2.frequency.setTargetAtTime(f * 1.012, now(), 0.08); elp.frequency.setTargetAtTime(380 + r * 900, now(), 0.1); };
    } else if (name === "waves") {
      var w = src(), wl = ctx.createBiquadFilter(), sw = ctx.createGain(), wlfo = osc("sine", 0.11), wlg = ctx.createGain();
      wl.type = "lowpass"; wl.frequency.value = 460; wlg.gain.value = 0.45; sw.gain.value = 0.55;
      wlfo.connect(wlg); wlg.connect(sw.gain); w.connect(wl); wl.connect(sw); sw.connect(out);
    } else if (name === "rumble") {
      var r2 = src(), rl = ctx.createBiquadFilter();
      r2.playbackRate.value = 0.35; rl.type = "lowpass"; rl.frequency.value = 140; rl.Q.value = 3;
      r2.connect(rl); rl.connect(out);
    } else if (name === "falls") {
      // a waterfall heard from the path: soft pink-ish noise with the top and bottom cut, breathing slowly
      var fsrc = src(), fl = ctx.createBiquadFilter(), fh = ctx.createBiquadFilter(), fg = ctx.createGain(), flfo = osc("sine", 0.23), flg = ctx.createGain();
      fl.type = "lowpass"; fl.frequency.value = 1100; fh.type = "highpass"; fh.frequency.value = 180; fg.gain.value = 0.5; flg.gain.value = 0.1;
      flfo.connect(flg); flg.connect(fg.gain); fsrc.connect(fl); fl.connect(fh); fh.connect(fg); fg.connect(out);
    } else if (name === "buzz") {                                        // a drone's rotors, a soft hum
      var b1 = osc("triangle", 170), b2 = osc("triangle", 176.5), bf = ctx.createBiquadFilter();
      bf.type = "lowpass"; bf.frequency.value = 650;
      b1.connect(bf); b2.connect(bf); bf.connect(out);
    } else if (name === "aura") {
      // the orbs' presence: a sub drone beating against itself, a low cluster of detuned saws
      // under a closed filter (a minor second, the darkest interval), and a slow breath of air
      var s1 = osc("sine", 32), s2 = osc("sine", 32.7), sub = ctx.createGain(); sub.gain.value = 0.55; s1.connect(sub); s2.connect(sub); sub.connect(out);
      var alp = ctx.createBiquadFilter(); alp.type = "lowpass"; alp.frequency.value = 220; alp.Q.value = 2; alp.connect(out);
      [55, 55.4, 58.3, 58.6, 82.4].forEach(function (f) { var o = osc("sawtooth", f), g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(alp); });
      var slfo = osc("sine", 0.06), slg = ctx.createGain(); slg.gain.value = 120; slfo.connect(slg); slg.connect(alp.frequency);
      var br = src(), brf = ctx.createBiquadFilter(), brg = ctx.createGain(), blfo = osc("sine", 0.14), blg = ctx.createGain();
      brf.type = "bandpass"; brf.frequency.value = 380; brf.Q.value = 0.8; brg.gain.value = 0.06; blg.gain.value = 0.05;
      blfo.connect(blg); blg.connect(brg.gain); br.connect(brf); brf.connect(brg); brg.connect(out);
      if (verbIn) out.connect(verbIn);
      ctl.rate = function (r) { alp.frequency.setTargetAtTime(200 + r * 700, now(), 0.3); sub.gain.setTargetAtTime(0.45 + r * 0.3, now(), 0.3); };
    }
    var t0 = now(); nodes.forEach(function (s) { s.start(t0); });
    var handle = {
      set: function (p) {
        if (!ctx) return;
        if (p.vol !== undefined) out.gain.setTargetAtTime(Math.max(0, p.vol), now(), 0.15);
        if (p.rate !== undefined && ctl.rate) ctl.rate(p.rate);
        if (p.pan !== undefined && sp) sp.pan.setTargetAtTime(Math.max(-1, Math.min(1, p.pan)), now(), 0.1);
      },
      stop: function () {
        if (!ctx) return;
        out.gain.setTargetAtTime(0, now(), 0.15);
        var tEnd = now() + 0.6; nodes.forEach(function (s) { try { s.stop(tEnd); } catch (e) {} });
        loops = loops.filter(function (l) { return l !== handle; });
      }
    };
    loops.push(handle);
    return handle;
  }

  /* music. day and night are a small chiptune sequencer: four bars of chords and a melody
     picked from the chord tones once (seeded) so the loop repeats like a real track.
     the dark scores are not songs. "dread" (the shrine) is a low drone, a minor second
     swelling and fading, wind, and a deep bell now and then. "doom" (the orb fight) creeps in
     out of silence: a sub drone, a cluster that slowly opens, a heartbeat that quickens with
     the fight, a bell tolling, and something like a horn groaning down a long way off. the
     future and chaos realities colour it (metal instead of bronze; the whole thing wavering)
     but it never turns into a tune. everything is scheduled ahead of the clock. */
  var MOODS = {
    day:   { bpm: 96, lead: "square", bass: "triangle", chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], hat: true, vol: 0.8 },
    night: { bpm: 68, lead: "sine", bass: "triangle", chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], hat: false, vol: 0.7, echo: true },
    dread: { dark: true, root: 38, fade: 5, bpm: 30 },
    doom: { dark: true, root: 33, fade: 12, bpm: 40, heart: true, horn: true },
    "doom-future": { dark: true, root: 33, fade: 3, bpm: 40, heart: true, horn: true, metal: true },
    "doom-chaos": { dark: true, root: 32, fade: 3, bpm: 44, heart: true, horn: true, waver: true }
  };
  var mood = null, seq = null, step = 0, nextT = 0, pattern = null, moodGain = null, echo = null, held = [], intens = 0, darkF = null;
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function makePattern(m) {
    var s = 7, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, out = [];
    for (var bar = 0; bar < 4; bar++) for (var i = 0; i < 8; i++) {
      var ch = m.chords[bar];
      out.push(rnd() < 0.6 ? ch[(rnd() * 3) | 0] + 12 + (rnd() < 0.2 ? 12 : 0) : null);
    }
    return out;
  }
  function note(type, n, t0, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = midi(n);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(moodGain); if (echo) g.connect(echo);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function hold(node) { held.push(node); node.start(); return node; }
  // the held layers of a dark score, built once when it starts
  function darkBed(m) {
    var r = midi(m.root);
    var s1 = ctx.createOscillator(), s2 = ctx.createOscillator(), sg = ctx.createGain();
    s1.frequency.value = r / 2; s2.frequency.value = r / 2 * 1.012; sg.gain.value = 0.3; s1.connect(sg); s2.connect(sg); sg.connect(moodGain); hold(s1); hold(s2);
    darkF = ctx.createBiquadFilter(); darkF.type = "lowpass"; darkF.frequency.value = 160; darkF.Q.value = 1.5; darkF.connect(moodGain); darkF.connect(verbIn);
    (m.metal ? [0, 6, 11, 13] : [0, 1, 7, 8]).forEach(function (iv, i) {           // a cluster; the metal version is a tritone and a minor ninth
      [0, 0.09].forEach(function (dt) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = midi(m.root + iv) * (1 + dt / 100);
        g.gain.value = 0.045; o.connect(g); g.connect(darkF); hold(o);
        if (m.waver) { var wl = ctx.createOscillator(), wg = ctx.createGain(); wl.frequency.value = 0.17 + i * 0.07; wg.gain.value = 3 + i; wl.connect(wg); wg.connect(o.frequency); hold(wl); }
      });
    });
    var wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg2 = ctx.createGain(), wlfo = ctx.createOscillator(), wlg = ctx.createGain();
    wind.buffer = noiseBuf; wind.loop = true; wf.type = "bandpass"; wf.frequency.value = 320; wf.Q.value = 0.6; wg2.gain.value = 0.05; wlfo.frequency.value = 0.07; wlg.gain.value = 0.04;
    wlfo.connect(wlg); wlg.connect(wg2.gain); wind.connect(wf); wf.connect(wg2); wg2.connect(moodGain); hold(wind); hold(wlfo);
  }
  function darkTick(m) {
    var beat = 60 / (m.bpm * (1 + intens * 0.9));
    if (darkF) darkF.frequency.setTargetAtTime(150 + intens * 900 + (m.waver ? Math.random() * 200 : 0), now(), 1.2);
    while (nextT < now() + 0.3) {
      var t0 = nextT, v = 0.4 + intens * 0.6, rt = midi(m.root);
      if (m.heart && intens > 0.08) {                                              // a heartbeat, two low thuds
        [0, 0.2].forEach(function (d, i) {
          var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(64, t0 + d); o.frequency.exponentialRampToValueAtTime(30, t0 + d + 0.25);
          g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime((i ? 0.18 : 0.26) * v, t0 + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.3);
          o.connect(g); g.connect(moodGain); o.start(t0 + d); o.stop(t0 + d + 0.35);
        });
      }
      if (step % 8 === 0) {                                                        // the bell
        if (m.metal) [1, 1.41, 2.33, 3.9].forEach(function (p, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rt * 2 * p; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06 / (i + 1), t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5); o.connect(g); g.connect(moodGain); g.connect(verbIn); o.start(t0); o.stop(t0 + 5.1); });
        else [[1, 1], [2.76, 0.5], [5.4, 0.28], [0.5, 0.7]].forEach(function (p) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rt * 2 * p[0]; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09 * p[1] * (0.7 + v * 0.5), t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7); o.connect(g); g.connect(moodGain); g.connect(verbIn); o.start(t0); o.stop(t0 + 7.1); });
      }
      if (step % 8 === 7 && intens > 0.4) {                                        // air rushing backwards into the next toll
        var rs = ctx.createBufferSource(), rf = ctx.createBiquadFilter(), rg = ctx.createGain(); rs.buffer = noiseBuf; rf.type = "bandpass"; rf.frequency.setValueAtTime(200, t0); rf.frequency.exponentialRampToValueAtTime(1800, t0 + beat); rf.Q.value = 1.5;
        rg.gain.setValueAtTime(0.0001, t0); rg.gain.exponentialRampToValueAtTime(0.09 * v, t0 + beat * 0.95); rg.gain.exponentialRampToValueAtTime(0.0001, t0 + beat); rs.connect(rf); rf.connect(rg); rg.connect(moodGain); rs.start(t0, Math.random()); rs.stop(t0 + beat + 0.05);
      }
      if (m.horn && step % 16 === 4) {                                             // something groaning down, a long way off
        var ho = ctx.createOscillator(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); ho.type = "sawtooth"; ho.frequency.setValueAtTime(rt * 4, t0); ho.frequency.exponentialRampToValueAtTime(rt, t0 + beat * 5);
        hf.type = "bandpass"; hf.frequency.value = 520; hf.Q.value = 4; hg.gain.setValueAtTime(0.0001, t0); hg.gain.exponentialRampToValueAtTime(0.05 * v, t0 + beat * 1.5); hg.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 5);
        ho.connect(hf); hf.connect(hg); hg.connect(moodGain); hg.connect(verbIn); ho.start(t0); ho.stop(t0 + beat * 5 + 0.1);
      }
      if (!m.heart && step % 6 === 3) {                                            // dread: a minor second swelling in the dark
        [0, 1].forEach(function (iv) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = midi(m.root + 12 + iv); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + beat * 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 5.5); o.connect(g); g.connect(moodGain); g.connect(verbIn); o.start(t0); o.stop(t0 + beat * 5.6); });
      }
      if (m.waver && Math.random() < 0.3) {                                        // chaos: grains of static in the dark
        var gb = ctx.createBufferSource(), gg = ctx.createGain(); gb.buffer = noiseBuf; gb.playbackRate.value = 0.1 + Math.random() * 0.6; gg.gain.setValueAtTime(0.03 * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4); gb.connect(gg); gg.connect(moodGain); gb.start(t0, Math.random()); gb.stop(t0 + 0.45);
      }
      nextT += beat; step++;
    }
  }
  function tick() {
    if (!mood || !ctx) return;
    var m = MOODS[mood];
    if (m.dark) { darkTick(m); return; }
    var eighth = 60 / m.bpm / 2;
    while (nextT < now() + 0.15) {
      var bar = Math.floor(step / 8) % 4, i = step % 8, ch = m.chords[bar], v = m.vol;
      if (i === 0) note(m.bass, ch[0] - 12, nextT, eighth * 3.6, 0.14 * v);
      if (i === 4) note(m.bass, ch[2] - 24, nextT, eighth * 3.2, 0.1 * v);
      var ln = pattern[step % 32];
      if (ln !== null) note(m.lead, ln, nextT, eighth * (mood === "night" ? 2.6 : 1.2), (mood === "night" ? 0.06 : 0.035) * v);
      if (m.hat && i % 2 === 1) { var h = ctx.createBufferSource(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); h.buffer = noiseBuf; hf.type = "highpass"; hf.frequency.value = 7000; hg.gain.setValueAtTime(0.022 * v, nextT); hg.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.04); h.connect(hf); hf.connect(hg); hg.connect(moodGain); h.start(nextT, Math.random()); h.stop(nextT + 0.05); }
      nextT += eighth; step++;
    }
  }
  function music(m) {
    if (!ctx) return;
    if (m === mood) return;
    if (moodGain) {
      var old = moodGain, oldHeld = held; old.gain.setTargetAtTime(0, now(), MOODS[mood] && MOODS[mood].dark ? 1.2 : 0.4);
      setTimeout(function () { oldHeld.forEach(function (n) { try { n.stop(); } catch (e) {} }); old.disconnect(); }, 5000);
    }
    mood = m; clearInterval(seq); seq = null; moodGain = null; echo = null; held = []; darkF = null;
    if (!m || !MOODS[m]) { mood = null; return; }
    var M = MOODS[m];
    moodGain = ctx.createGain(); moodGain.gain.value = 0.0001; moodGain.connect(musicBus);
    moodGain.gain.setTargetAtTime(1, now(), M.fade ? M.fade / 3 : 0.8);                 // the dark ones creep in
    if (M.echo) { echo = ctx.createDelay(); echo.delayTime.value = 0.42; var fb = ctx.createGain(); fb.gain.value = 0.35; echo.connect(fb); fb.connect(echo); echo.connect(moodGain); }
    if (M.dark) darkBed(M); else pattern = makePattern(M);
    step = 0; nextT = now() + 0.1;
    seq = setInterval(tick, 50); tick();
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem("sound", on ? "on" : "off"); } catch (e) {}
    if (ctx) { applyMix(); if (on) ctx.resume(); }
    listeners.forEach(function (f) { f(on); });
  }
  /* restart waits for the old context to close before building a new one: browsers cap how
     many can exist, and one that isn't closed keeps running */
  function restart() {
    if (restarting) return;
    var m = mood, old = ctx;
    clearInterval(seq); seq = null; mood = null; moodGain = null; held = []; loops = []; voices = []; darkF = null;
    ctx = null; live = 0; restarting = true;
    var done = function () {
      restarting = false; init(); unlock();
      restartListeners.forEach(function (f) { f(); });
      if (m) music(m);
    };
    var p = null; try { p = old && old.close ? old.close() : null; } catch (e) {}
    if (p && p.then) p.then(done, done); else done();
  }
  window.Sound = {
    unlock: unlock,
    sfx: sfx,
    loop: loop,
    music: music,
    intensity: function (x) { intens = Math.max(0, Math.min(1, x)); },
    // 0 is open, 1 is muffled to 800 Hz; the sweep takes about the length of a transition
    muffle: function (x, sec) { if (!musicLP) return; x = Math.max(0, Math.min(1, x)); musicLP.frequency.cancelScheduledValues(now()); musicLP.frequency.setValueAtTime(musicLP.frequency.value, now()); musicLP.frequency.exponentialRampToValueAtTime(20000 * Math.pow(800 / 20000, x), now() + (sec || 0.3)); },
    // the music drops 6 dB while a card is open
    duck: function (on) { if (musicDuck) musicDuck.gain.setTargetAtTime(on ? 0.5 : 1, now(), 0.12); },
    mix: function () { return { master: MIX.master, music: MIX.music, sfx: MIX.sfx, amb: MIX.amb }; },
    setMix: function (k, v) { if (!(k in MIX)) return; MIX[k] = Math.max(0, Math.min(1, v)); try { localStorage.setItem("sound-mix", JSON.stringify(MIX)); } catch (e) {} applyMix(); },
    restart: restart,
    onRestart: function (f) { restartListeners.push(f); },
    stats: function () { return { state: ctx ? ctx.state : restarting ? "restarting" : "none", sources: live, voices: voices.length, loops: loops.length, mood: mood }; },
    state: function () { return ctx ? ctx.state : "none"; },
    onState: function (f) { stateListeners.push(f); },
    ready: function () { return !!ctx && ctx.state === "running"; },
    on: function () { return enabled; },
    toggle: function () { unlock(); setEnabled(!enabled); return enabled; },
    onChange: function (f) { listeners.push(f); }
  };
})();
