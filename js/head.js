/* head: runs before first paint. marks js on, applies a saved theme, and decides whether the
   vintage boot screen plays (first visit this session; never for reduced motion or #island links).
   it's a file rather than an inline script so the page's CSP can be script-src 'self'. */
/* site switches. CODE_HOST: where the project repos live. null hides every repo link and the
   "code is on ..." sentences (GitHub is flagged, and the GitLab mirrors are private until they pass
   the secrets scan). the markup carries only repo paths (data-repo), never a live link, so with js
   off nothing points at a repo either. once they're public, one line brings them all back, pointed at GitLab:
     CODE_HOST: { name: "GitLab", base: "https://gitlab.com/ammaarrehman" } */
window.SITE = { CODE_HOST: null };
// a repo path ("homelab/tree/main/ha-dns", "" for the profile) or a github.com/ammaarrehman/... url, on the code host
window.SITE.hostUrl = function (u) {
  var h = window.SITE.CODE_HOST; if (!h) return u;
  var path = u.replace(/^https:\/\/github\.com\/ammaarrehman\/?/, "");
  return (h.base + (path ? "/" + path : "")).replace(/\/tree\//, /gitlab/i.test(h.base) ? "/-/tree/" : "/tree/");
};
(function () {
  var d = document.documentElement; d.classList.add("js");
  if (window.SITE.CODE_HOST) d.classList.add("code-host");
  try {
    if (sessionStorage.getItem("booted") !== "1" && location.hash.indexOf("#island") !== 0 &&
        !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) d.classList.add("booting");
  } catch (e) {}
  try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") d.setAttribute("data-theme", t); } catch (e) {}
})();
