/* windows — the traffic lights work. every terminal window on the page (the
   neofetch hero and each section pane) gets real controls:
     red / yellow  minimize into the dock at the bottom of the screen; the
                   window shrinks toward its dock tab and its section folds away,
                   so the ascii hands behind the page come through
     green         maximize over the page (esc or green again to restore)
   dock tabs put windows back. minimized windows stay minimized for the
   session, and nav links reopen a minimized section on the way. */
(function () {
  var wins = Array.prototype.slice.call(document.querySelectorAll("[data-win]"));
  if (!wins.length) return;
  var root = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var KEY = "min-wins";

  var dock = document.createElement("nav");
  dock.className = "dock"; dock.setAttribute("aria-label", "minimized windows"); dock.hidden = true;
  var all = document.createElement("button");
  all.type = "button"; all.className = "dock-all"; all.textContent = "restore all";
  dock.appendChild(all);
  document.body.appendChild(dock);
  var backdrop = document.createElement("div");
  backdrop.className = "win-backdrop"; backdrop.hidden = true;
  document.body.appendChild(backdrop);

  function holder(w) { return w.closest(".section, .hero"); }
  function name(w) { return w.getAttribute("data-win"); }
  function id(w) { return holder(w).id || "hero"; }
  function saved() { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save() {
    var ids = wins.filter(function (w) { return holder(w).classList.contains("min"); }).map(id);
    try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch (e) {}
  }
  function paintDock() {
    var items = dock.querySelectorAll(".dock-item");
    dock.hidden = !items.length;
    all.hidden = items.length < 2;
  }

  // the controls: real buttons replacing the decorative dots
  wins.forEach(function (w) {
    var ctl = document.createElement("span");
    ctl.className = "win-ctl" + (w.classList.contains("term") ? " live" : "");
    [["close", "Minimize"], ["min", "Minimize"], ["max", "Maximize"]].forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "wb wb-" + b[0];
      btn.setAttribute("aria-label", b[1] + " the " + name(w) + " window");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (b[0] === "max") toggleMax(w); else minimize(w);
      });
      ctl.appendChild(btn);
    });
    var old = w.querySelector(".term-bar .term-dots");
    if (old) old.replaceWith(ctl); else w.insertBefore(ctl, w.firstChild);
  });

  function dockItem(w) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "dock-item";
    b.innerHTML = '<span class="dock-glyph" aria-hidden="true">■</span>';
    b.appendChild(document.createTextNode(name(w)));
    b.setAttribute("aria-label", "Restore the " + name(w) + " window");
    b.addEventListener("click", function () { restore(w, true); });
    dock.insertBefore(b, all);
    w._dock = b;
    paintDock();
    return b;
  }

  function minimize(w, instant) {
    var h = holder(w);
    if (h.classList.contains("min")) return;
    if (w.classList.contains("maxed")) toggleMax(w);
    var item = dockItem(w);
    h.inert = true;
    if (instant || REDUCED) { h.classList.add("min"); save(); return; }
    var wr = w.getBoundingClientRect(), dr = item.getBoundingClientRect();
    var dx = dr.left + dr.width / 2 - (wr.left + wr.width / 2), dy = dr.top + dr.height / 2 - (wr.top + wr.height / 2);
    w.style.transition = "transform .55s cubic-bezier(.55,0,.75,.1), opacity .5s ease .05s";
    w.style.transform = "translate(" + dx + "px," + dy + "px) scale(.05)";
    w.style.opacity = "0";
    // the section folds shut behind it, so the page closes up
    h.style.height = h.offsetHeight + "px";
    void h.offsetHeight;
    h.style.transition = "height .5s cubic-bezier(.4,0,.2,1) .12s, padding .5s cubic-bezier(.4,0,.2,1) .12s";
    h.classList.add("folding");
    h.style.height = "0px";
    item.classList.add("pop");
    setTimeout(function () {
      h.classList.remove("folding"); h.classList.add("min");
      h.style.transition = ""; h.style.height = "";
      w.style.transition = ""; w.style.transform = ""; w.style.opacity = "";
      save();
    }, 680);
  }

  function restore(w, scroll) {
    var h = holder(w);
    if (!h.classList.contains("min")) return;
    var item = w._dock, dr = item ? item.getBoundingClientRect() : null;
    if (item) item.remove(); w._dock = null;
    paintDock();
    h.inert = false;
    h.classList.remove("min");
    save();
    if (REDUCED || !dr) { if (scroll) h.scrollIntoView({ block: "start" }); return; }
    // grow the section back open, and fly the window out of the dock
    var full = h.offsetHeight;
    h.style.height = "0px"; h.classList.add("folding");
    var wr = w.getBoundingClientRect();
    var dx = dr.left + dr.width / 2 - (wr.left + wr.width / 2), dy = dr.top + dr.height / 2 - (wr.top + wr.height / 2);
    w.style.transition = "none";
    w.style.transform = "translate(" + dx + "px," + dy + "px) scale(.05)"; w.style.opacity = "0";
    void h.offsetHeight;
    h.style.transition = "height .5s cubic-bezier(.4,0,.2,1), padding .5s cubic-bezier(.4,0,.2,1)";
    h.classList.remove("folding");
    h.style.height = full + "px";
    w.style.transition = "transform .55s cubic-bezier(.2,.9,.3,1) .05s, opacity .35s ease .05s";
    w.style.transform = ""; w.style.opacity = "";
    if (scroll) setTimeout(function () { h.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
    setTimeout(function () { h.style.height = ""; h.style.transition = ""; w.style.transition = ""; }, 620);
  }

  var maxed = null;
  function toggleMax(w) {
    if (maxed && maxed !== w) toggleMax(maxed);
    var on = !w.classList.contains("maxed");
    w.classList.toggle("maxed", on);
    // .container makes its own stacking layer; lift it so the window clears the backdrop
    var c = w.closest(".container"); if (c) c.classList.toggle("has-maxed", on);
    root.classList.toggle("win-maxed", on);
    backdrop.hidden = !on;
    maxed = on ? w : null;
    if (on) { var b = w.querySelector(".wb-max"); if (b) b.focus({ preventScroll: true }); }
  }
  backdrop.addEventListener("click", function () { if (maxed) toggleMax(maxed); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && maxed && !root.classList.contains("in-world")) toggleMax(maxed); });

  all.addEventListener("click", function () {
    wins.forEach(function (w) { restore(w, false); });
  });

  // nav links and skip links reopen a minimized section before jumping to it
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute("href").slice(1));
    if (!target) return;
    wins.forEach(function (w) { if (holder(w) === target) restore(w, false); });
  }, true);

  // come back to the same desk you left
  var start = saved();
  wins.forEach(function (w) { if (start.indexOf(id(w)) >= 0) minimize(w, true); });
})();
