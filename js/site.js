/* site: theme toggle, copy email, scroll reveal, heading word-rise, nav scrollspy,
   and the card spotlight. the orb is js/orb.js, the island js/world.js,
   the background js/hands.js.
   everything here is progressive: with js off the page renders as-is. */
(function () {
  var root = document.documentElement;
  // repo links follow SITE.CODE_HOST and SITE.REPOS (js/head.js). the markup names repo paths in
  // data-repo and has no href, so with no js they're plain text and the repo buttons stay hidden (css
  // hides [data-gh=hide]). a repo that's public on the host becomes a link to it (GitLab's tree paths
  // carry a /-/) and its button shows; an "on <host>" sentence shows once every repo it links is public
  var HOST = window.SITE && window.SITE.CODE_HOST;
  if (HOST) {
    Array.prototype.forEach.call(document.querySelectorAll("a[data-repo]"), function (a) {
      var url = window.SITE.hostUrl(a.getAttribute("data-repo")); if (!url) return;
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      var gate = a.closest("[data-gh]"); if (gate) gate.setAttribute("data-gh", "show");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-host-only]"), function (e) {
      if (!e.querySelector("a[data-repo]:not([href])")) e.hidden = false;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-host-name]"), function (e) { e.textContent = HOST.name; });
  }
  // staggered entrances: the delay rides in data-d and becomes --d here
  Array.prototype.forEach.call(document.querySelectorAll("[data-d]"), function (el) { el.style.setProperty("--d", el.getAttribute("data-d")); });
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var IO = "IntersectionObserver" in window;

  /* ── theme ── */
  var btn = document.querySelector(".theme-btn");
  var meta = document.querySelector('meta[name="theme-color"]');
  function current() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function paintMeta() { if (meta) meta.setAttribute("content", current() === "light" ? "#f4f1ea" : "#0a0a0a"); }
  function setTheme(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    paintMeta();
  }
  if (btn) btn.addEventListener("click", function () {
    var next = current() === "light" ? "dark" : "light";
    if (!document.startViewTransition || REDUCED) return setTheme(next);
    // the new theme wipes out in a circle from the button
    var r = btn.getBoundingClientRect();
    root.style.setProperty("--vx", (r.left + r.width / 2) + "px");
    root.style.setProperty("--vy", (r.top + r.height / 2) + "px");
    document.startViewTransition(function () { setTheme(next); });
  });

  /* ── the terminal: a real "last login" time and a greeting for the hour ── */
  var now = new Date();
  var nowEl = document.querySelector(".t-now");
  if (nowEl) nowEl.textContent = now.toDateString().slice(0, 10) + " " + now.toTimeString().slice(0, 5);
  var greet = document.querySelector(".t-greeting");
  if (greet) { var hr = now.getHours(); greet.textContent = hr < 5 ? "Up late" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; }

  /* ── copy email ── */
  var copy = document.querySelector(".copy-btn");
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(copy.getAttribute("data-copy")).then(function () {
        copy.textContent = "copied ✓"; copy.classList.add("done");
        setTimeout(function () { copy.textContent = "copy"; copy.classList.remove("done"); }, 1800);
      });
    });
  }
  paintMeta();

  /* ── section headings: wrap each word in a mask so it can rise ── */
  document.querySelectorAll(".section-heading").forEach(function (h) {
    var wi = 0, nodes = Array.prototype.slice.call(h.childNodes);
    h.textContent = "";
    function word(content) {
      var w = document.createElement("span"), inner = document.createElement("span");
      w.className = "w"; inner.style.setProperty("--wi", wi++);
      if (typeof content === "string") inner.textContent = content; else inner.appendChild(content);
      w.appendChild(inner); h.appendChild(w);
    }
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) h.appendChild(document.createTextNode(" "));
          else word(part);
        });
      } else word(n);
    });
  });

  /* ── reveal ── */
  var items = Array.prototype.slice.call(document.querySelectorAll(".rv"));
  // stagger siblings that don't set their own delay
  items.forEach(function (el) {
    if (el.style.getPropertyValue("--d")) return;
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains("rv"); });
    el.style.setProperty("--d", Math.min(sibs.indexOf(el) * 0.07, 0.42) + "s");
  });
  function show(el) { el.classList.add("in"); }
  if (REDUCED || !IO) items.forEach(show);
  else {
    var hero = document.querySelector(".hero");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) {
      if (hero && hero.contains(el)) {
        // the terminal boots after the vintage startup screen, so you see neofetch run
        if (root.classList.contains("booting")) window.addEventListener("boot:done", function () { setTimeout(function () { show(el); }, 60); }, { once: true });
        else setTimeout(function () { show(el); }, 30);
      }
      else io.observe(el);
    });
  }

  /* ── nav scrollspy ── */
  // active = the last section whose top has passed 40% of the viewport; the
  // bottom of the page always lights the last one (contact is too short to reach 40%)
  var strip = document.querySelector(".nav-links"), spyLinks = [], active = null;
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) {
    var s = document.getElementById(a.getAttribute("href").slice(1));
    if (s) spyLinks.push({ a: a, s: s });
  });
  function spy() {
    var line = window.innerHeight * 0.4, hit = null;
    spyLinks.forEach(function (l) { if (!l.s.classList.contains("min") && l.s.getBoundingClientRect().top <= line) hit = l; });   // minimized sections don't count
    // scrollY > 0 guard: while pi's island locks the page it reads as "at the bottom"
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) hit = spyLinks[spyLinks.length - 1];
    if (hit === active) return;
    active = hit;
    spyLinks.forEach(function (l) { l.a.classList.toggle("on", l === hit); });
    if (hit && strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = hit.a.offsetLeft - strip.offsetLeft - 24;
  }
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);
  spy();

  /* ── project screenshots live in other repos; if one can't load, drop it cleanly ── */
  document.querySelectorAll(".work-img").forEach(function (img) {
    function gone() { img.closest(".work-item").classList.add("no-img"); }
    if (img.complete && img.naturalWidth === 0) gone(); else img.addEventListener("error", gone);
  });

  /* ── project card spotlight ── */
  if (FINE) document.querySelectorAll(".work-item").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--x", (e.clientX - r.left) + "px");
      card.style.setProperty("--y", (e.clientY - r.top) + "px");
    });
  });

  /* ── pi's island is big, so it loads the first time someone reaches for the orb
     (hover, focus or touch), or straight away if the URL asks for #island ── */
  var orbBtn = document.querySelector(".orb-btn");
  if (orbBtn) {
    var island = 0, go = false;
    // the island arrives in three parts, in order: its sound engine (the island looks for it), its map
    // (js/maps/home.js, the data the island is built from), then the island
    var hint = document.querySelector(".orb-hint"), hint0 = hint ? hint.textContent : "";
    var script = function (src, done, fail) { var sc = document.createElement("script"); sc.src = src; sc.onload = done; sc.onerror = fail; document.body.appendChild(sc); };
    var loadIsland = function () {
      if (island) return;
      island = 1;
      var failed = function () { island = 0; orbBtn.removeAttribute("aria-busy"); if (hint) hint.textContent = "[ the island didn't load. try again ]"; };
      script("js/audio.js?v=20261024", function () {
        script("js/maps/home.js?v=20261024", function () {
          script("js/world.js?v=20261024", function () {
            if (!window.islandEnter) { failed(); return; }           // it loaded but couldn't build (say, a broken map)
            island = 2; orbBtn.removeAttribute("aria-busy"); if (hint) hint.textContent = hint0;
            if (go) window.islandEnter();
          }, failed);
        }, failed);
      }, failed);
    };
    var waiting = function () { orbBtn.setAttribute("aria-busy", "true"); if (hint) hint.textContent = "[ loading pi's island… ]"; };
    orbBtn.addEventListener("pointerenter", loadIsland);
    orbBtn.addEventListener("focus", loadIsland);
    orbBtn.addEventListener("touchstart", loadIsland, { passive: true });
    orbBtn.addEventListener("click", function () { if (island !== 2) { go = true; waiting(); loadIsland(); } });
    window.addEventListener("hashchange", function () { if (island !== 2 && location.hash.indexOf("#island") === 0) { go = true; loadIsland(); } });
    // an #island link: wait for the rest of the page's scripts (the sound engine, the orbs) first
    if (location.hash.indexOf("#island") === 0) {
      go = true;
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadIsland); else loadIsland();
    }
  }

})();
