#!/usr/bin/env node
/* codelinks: repo links follow the per-repo switches in js/head.js (audit 2026-09-28 R4, Phase 7).
   The markup carries repo paths in data-repo and no href. Four loads of the main page:
     js off              no link points at a repo host, and the repo-only bits ([data-gh=hide]) are hidden
     js on, host off     head.js served with CODE_HOST: null: the same
     js on, as shipped   the real head.js: only the repos switched on in SITE.REPOS become GitLab links
                         (trading-lab and claude-intake-triage today); homelab, this site's repo and the
                         profile stay plain text, their buttons hidden, and an "on <host>" sentence shows
                         only when every repo it links is public
     js on, all public   head.js served with every switch on: every repo path becomes a GitLab link (tree
                         paths with their /-/), every repo-only bit shows, and no visible label says GitHub

     node tools/codelinks.mjs        chromium; exits 1 on any failure
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { serve } from "./serve.mjs";

const PORT = 8800 + Math.floor(Math.random() * 200);
const server = await serve(PORT);
const BASE = "https://gitlab.com/ammaarrehman";
const head = readFileSync(new URL("../js/head.js", import.meta.url), "utf8");
const SWITCHES = /^  REPOS: \{[^\n]*\}$/m;
const fails = [];
const check = (what, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? "  (" + detail + ")" : ""}`); if (!ok) fails.push(what + (detail ? ": " + detail : "")); };

// what head.js ships: the switches, read the same way the page does
const REPOS = JSON.parse(head.match(SWITCHES)[0].replace(/^\s*REPOS: /, "").replace(/([{,]\s*)"?([\w.-]*)"?:/g, '$1"$2":'));
check("head.js ships the GitLab host", /CODE_HOST: \{ name: "GitLab", base: "https:\/\/gitlab\.com\/ammaarrehman" \}/.test(head));
check("only trading-lab and claude-intake-triage are switched on", Object.keys(REPOS).filter((k) => REPOS[k] === true).sort().join() === "claude-intake-triage,trading-lab", JSON.stringify(REPOS));
const hostOff = head.replace(/CODE_HOST: \{[^}]*\}/, "CODE_HOST: null");
const allOn = head.replace(SWITCHES, "  REPOS: { \"trading-lab\": true, \"claude-intake-triage\": true, \"homelab\": true, \"ammaarrehman.github.io\": true, \"\": true }");
const isPublic = (path, repos) => repos[path.split("/")[0]] === true;
const gitlab = (path) => BASE + (path ? "/" + path.replace("/tree/", "/-/tree/") : "");

const look = () => {
  const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const repo = /(^|\/\/)(www\.)?(github|gitlab)\.com\/ammaarrehman/;
  const gh = "https://github.com/ammaarrehman/";
  return {
    repoHrefs: [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => repo.test(h)),
    paths: [...document.querySelectorAll("a[data-repo]")].map((a) => ({ path: a.dataset.repo, href: a.getAttribute("href"), target: a.target, rel: a.rel, shown: shown(a) })),
    gates: [...document.querySelectorAll("[data-gh]")].map((e) => ({ repo: (e.matches("a[data-repo]") ? e : e.querySelector("a[data-repo]")).dataset.repo, shown: shown(e) })),
    hostOnly: [...document.querySelectorAll("[data-host-only]")].map((e) => ({ repos: [...e.querySelectorAll("a[data-repo]")].map((a) => a.dataset.repo), shown: shown(e) })),
    emptyLinkRows: [...document.querySelectorAll(".work-links")].filter((w) => shown(w) && ![...w.querySelectorAll("a")].some(shown)).length,
    hostName: [...document.querySelectorAll("[data-host-name]")].filter(shown).map((e) => e.textContent),
    githubLabels: [...document.querySelectorAll("a[href]")].filter((a) => shown(a) && repo.test(a.href) && /github(?!\.io)/i.test(a.closest("div, p, span").textContent)).map((a) => a.textContent.trim()),
    island: window.SITE ? ["homelab/tree/main/ha-dns", "claude-intake-triage", "ammaarrehman.github.io"].map((p) => window.SITE.hostUrl(gh + p)) : null
  };
};

let browser;
try { browser = await chromium.launch(); } catch (e) { fails.push("chromium: could not launch (" + e.message.split("\n")[0] + ")"); }
if (browser) {
  const allRepos = { "trading-lab": true, "claude-intake-triage": true, "homelab": true, "ammaarrehman.github.io": true, "": true };
  for (const [name, js, body, repos] of [["js off", false, null, {}], ["js on, host off", true, hostOff, {}], ["js on, as shipped", true, null, REPOS], ["js on, all public", true, allOn, allRepos]]) {
    const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1366, height: 900 } });
    if (body) await context.route("**/js/head.js*", (r) => r.fulfill({ contentType: "application/javascript", body }));
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForTimeout(js ? 800 : 200);
    const s = await page.evaluate(look);
    check(`${name}: no page errors`, errors.length === 0, errors.join("; "));
    check(`${name}: repo paths in the markup`, s.paths.length >= 16, `${s.paths.length}`);
    const pub = s.paths.filter((p) => isPublic(p.path, repos)), priv = s.paths.filter((p) => !isPublic(p.path, repos));
    const badPub = pub.filter((p) => p.href !== gitlab(p.path) || p.target !== "_blank" || !/noopener/.test(p.rel));
    check(`${name}: ${pub.length} public repo paths are GitLab links in a new tab, noopener`, badPub.length === 0, badPub.map((b) => b.path + " -> " + b.href).join(", "));
    check(`${name}: ${priv.length} other repo paths carry no href`, priv.every((p) => p.href === null), priv.filter((p) => p.href).map((p) => p.path).join(", "));
    check(`${name}: no link points at GitHub (${s.repoHrefs.length} repo host links)`, !s.repoHrefs.some((h) => /github\.com/.test(h)), s.repoHrefs.filter((h) => /github\.com/.test(h)).join(", "));
    check(`${name}: every repo host link is to a public repo`, s.repoHrefs.every((h) => pub.some((p) => p.href === h)), s.repoHrefs.filter((h) => !pub.some((p) => p.href === h)).join(", "));
    const badGate = s.gates.filter((g) => g.shown !== isPublic(g.repo, repos));
    check(`${name}: repo-only bits show exactly for public repos (${s.gates.filter((g) => g.shown).length} of ${s.gates.length} shown)`, badGate.length === 0, badGate.map((g) => (g.repo || "profile") + (g.shown ? " shown" : " hidden")).join(", "));
    const badOnly = s.hostOnly.filter((h) => h.shown !== (js && Object.keys(repos).length > 0 && h.repos.every((r) => isPublic(r, repos))));
    check(`${name}: "on <host>" sentences show only when all their repos are public (${s.hostOnly.filter((h) => h.shown).length} of ${s.hostOnly.length} shown)`, badOnly.length === 0, badOnly.map((h) => h.repos.join("+") + (h.shown ? " shown" : " hidden")).join(", "));
    check(`${name}: they name the host GitLab`, s.hostName.every((n) => n === "GitLab"), s.hostName.join(", "));
    check(`${name}: no empty link rows under the cards`, s.emptyLinkRows === 0, `${s.emptyLinkRows}`);
    check(`${name}: no visible repo link is labelled GitHub`, s.githubLabels.length === 0, s.githubLabels.join(", "));
    if (js) {
      const want = ["homelab/tree/main/ha-dns", "claude-intake-triage", "ammaarrehman.github.io"].map((p) => isPublic(p, repos) ? gitlab(p) : null);
      check(`${name}: island repo links follow the same switches`, JSON.stringify(s.island) === JSON.stringify(want), JSON.stringify(s.island));
    }
    await context.close();
  }
  await browser.close();
}
server.close();
if (fails.length) { console.log(`\n${fails.length} problem(s):\n- ${fails.join("\n- ")}`); process.exit(1); }
console.log("\nall passed");
