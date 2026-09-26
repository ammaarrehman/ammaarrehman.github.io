/* boot: a vintage startup screen. plays on the first visit of a session and
   again from the "↻ reboot" button in the footer. a BIOS-style POST types
   itself out (memory test counting up, drives being detected), then the screen
   switches off like an old CRT and the site is underneath. any key, click or
   tap skips it. the <head> script decides whether to boot on load
   (html.booting); site.js waits for "boot:done" before running neofetch. */
(function () {
  var root = document.documentElement, el = document.getElementById("boot");
  if (!el) return;
  var log = el.querySelector(".boot-log");
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var d = new Date(), stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  // [text, pause after (ms)]. "{mem}" becomes the counting memory test
  var SCRIPT = [
    ["<b>AMMAAR BIOS v26.09</b>  release " + stamp, 60],
    ["(C) 2026 Ammaar Rehman. All rights reserved.", 260],
    ["", 0],
    ["CPU  : curiosity-class processor @ 4.65 GHz", 120],
    ["{mem}", 120],
    ["", 0],
    ["Detecting DNS node A ....... <b>primary</b> (Raspberry Pi 5)", 110],
    ["Detecting DNS node B ....... <b>backup</b> (Raspberry Pi 5)", 110],
    ["Detecting cloud ............ AWS Certified Cloud Practitioner", 110],
    ["Detecting security ......... Cyber Ready Clinic, analyst cohort", 160],
    ["", 0],
    ["Mounting /projects ......... <b>10</b> found", 120],
    ["Loading pi.sys ............. <i>OK</i>", 140],
    ["Starting ePortfolio", 380]
  ];
  var i, timer, finished, html;

  function write(line) { html += line + "\n"; log.innerHTML = html + '<span class="boot-cur"></span>'; }
  function next() {
    if (finished) return;
    if (i >= SCRIPT.length) { off(); return; }
    var step = SCRIPT[i++];
    if (step[0] === "{mem}") { memory(); return; }
    write(step[0]);
    timer = setTimeout(next, step[1]);
  }
  function memory() {
    var k = 0, total = 16384, base = html;
    (function tick() {
      if (finished) return;
      k = Math.min(total, k + 1024 + ((Math.random() * 1024) | 0));
      log.innerHTML = base + "Memory Test : " + k + "K" + (k === total ? " <i>OK</i>" : "") + '<span class="boot-cur"></span>';
      if (k < total) timer = setTimeout(tick, 28);
      else { html = base + "Memory Test : " + total + "K <i>OK</i>\n"; timer = setTimeout(next, 120); }
    })();
  }
  // the old-CRT switch-off: the picture collapses to a line, then a dot, then it's gone
  function off() {
    if (finished) return;
    finished = true; clearTimeout(timer);
    window.removeEventListener("keydown", off); window.removeEventListener("pointerdown", off);
    el.classList.add("off");
    if (window.Sound) window.Sound.sfx("beep");       // one short beep: POST passed (only heard on a reboot; browsers mute page loads)
    try { sessionStorage.setItem("booted", "1"); } catch (e) {}
    setTimeout(function () {
      root.classList.remove("booting");
      el.classList.remove("off");
      window.dispatchEvent(new Event("boot:done"));
    }, 520);
  }
  function run() {
    i = 0; finished = false; html = ""; log.innerHTML = "";
    root.classList.add("booting");
    window.addEventListener("keydown", off);
    // the click that started a reboot must not also skip it
    setTimeout(function () { if (!finished) window.addEventListener("pointerdown", off); }, 0);
    timer = setTimeout(next, 250);
  }

  // footer button: power-cycle the site. after the boot, neofetch runs again
  window.reboot = function () {
    if (root.classList.contains("booting")) return;
    window.scrollTo(0, 0);
    if (window.Sound) window.Sound.unlock();
    if (REDUCED) return;
    run();
    window.addEventListener("boot:done", function () {
      var term = document.querySelector(".term");
      if (!term) return;
      term.classList.remove("in");
      void term.offsetWidth;                    // restart the line-by-line reveal
      setTimeout(function () { term.classList.add("in"); }, 60);
    }, { once: true });
  };
  var btn = document.querySelector(".reboot-btn");
  if (btn) {
    if (REDUCED) btn.hidden = true;
    btn.addEventListener("click", window.reboot);
  }

  if (root.classList.contains("booting")) run();
})();
