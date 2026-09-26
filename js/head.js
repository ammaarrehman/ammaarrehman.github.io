/* head: runs before first paint. marks js on, applies a saved theme, and decides whether the
   vintage boot screen plays (first visit this session; never for reduced motion or #island links).
   it's a file rather than an inline script so the page's CSP can be script-src 'self'. */
/* site switches. GITHUB_LINKS_ENABLED: github.com links 404 while the account is flagged, so they
   stay off until it clears; flip this one line to true to bring them all back */
window.SITE = { GITHUB_LINKS_ENABLED: false };
(function () {
  var d = document.documentElement; d.classList.add("js");
  if (!window.SITE.GITHUB_LINKS_ENABLED) d.classList.add("no-gh");
  try {
    if (sessionStorage.getItem("booted") !== "1" && location.hash.indexOf("#island") !== 0 &&
        !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) d.classList.add("booting");
  } catch (e) {}
  try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") d.setAttribute("data-theme", t); } catch (e) {}
})();
