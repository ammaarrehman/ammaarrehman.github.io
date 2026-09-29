/* head: runs before first paint. marks js on, applies a saved theme, and decides whether the
   vintage boot screen plays (first visit this session; never for reduced motion or #island links).
   it's a file rather than an inline script so the page's CSP can be script-src 'self'. */
/* site switches. CODE_HOST: where the project repos live (GitHub is flagged, so GitLab). REPOS: which
   repos are public there, one switch each. a repo that isn't switched on stays plain text, its repo
   buttons stay hidden, and so does any "on <host>" sentence that links to it. "" is the profile page.
   the markup carries only repo paths (data-repo), never a live link, so with js off nothing points
   at a repo either. CODE_HOST: null turns every repo link off at once. */
window.SITE = {
  CODE_HOST: { name: "GitLab", base: "https://gitlab.com/ammaarrehman" },
  REPOS: { "trading-lab": true, "claude-intake-triage": true, "homelab": false, "ammaarrehman.github.io": false, "": false }
};
// a repo path ("homelab/tree/main/ha-dns", "" for the profile) or a github.com/ammaarrehman/... url:
// its address on the code host, or null while the host is off or that repo isn't public
window.SITE.hostUrl = function (u) {
  var h = window.SITE.CODE_HOST; if (!h) return null;
  var path = u.replace(/^https:\/\/github\.com\/ammaarrehman\/?/, "");
  if (window.SITE.REPOS[path.split("/")[0]] !== true) return null;
  return (h.base + (path ? "/" + path : "")).replace(/\/tree\//, /gitlab/i.test(h.base) ? "/-/tree/" : "/tree/");
};
(function () {
  var d = document.documentElement; d.classList.add("js");
  try {
    if (sessionStorage.getItem("booted") !== "1" && location.hash.indexOf("#island") !== 0 &&
        !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) d.classList.add("booting");
  } catch (e) {}
  try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") d.setAttribute("data-theme", t); } catch (e) {}
})();
