/* head: runs before first paint. marks js on, applies a saved theme, and decides whether the
   vintage boot screen plays (first visit this session; never for reduced motion or #island links).
   it's a file rather than an inline script so the page's CSP can be script-src 'self'. */
(function () {
  var d = document.documentElement; d.classList.add("js");
  try {
    if (sessionStorage.getItem("booted") !== "1" && location.hash.indexOf("#island") !== 0 &&
        !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) d.classList.add("booting");
  } catch (e) {}
  try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") d.setAttribute("data-theme", t); } catch (e) {}
})();
