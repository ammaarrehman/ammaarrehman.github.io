#!/usr/bin/env node
/* codelinks: repo links are safe with the code host off, with or without js (audit 2026-09-28, R4).
   The markup carries repo paths in data-repo and no href. Three loads of the main page:
     js off              no link points at a repo host, and the repo-only bits ([data-gh=hide]) are hidden
     js on, no host      the same (CODE_HOST is null in js/head.js today)
     js on, GitLab host  head.js served with CODE_HOST set: every repo path becomes a GitLab link
                         (tree paths with their /-/), the repo-only bits and "on GitLab" sentences show

     node tools/codelinks.mjs        chromium; exits 1 on any failure
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { serve } from "./serve.mjs";

const PORT = 8800 + Math.floor(Math.random() * 200);
const server = await serve(PORT);
const HOST = 'window.SITE = { CODE_HOST: { name: "GitLab", base: "https://gitlab.com/ammaarrehman" } };';
const head = readFileSync(new URL("../js/head.js", import.meta.url), "utf8");
const gitlabHead = head.replace(/window\.SITE = \{ CODE_HOST: null \};/, HOST);
const fails = [];
const check = (what, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? "  (" + detail + ")" : ""}`); if (!ok) fails.push(what + (detail ? ": " + detail : "")); };

const look = () => {
  const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const repo = /(^|\/\/)(www\.)?(github|gitlab)\.com\/ammaarrehman/;
  return {
    repoHrefs: [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => repo.test(h)),
    paths: [...document.querySelectorAll("a[data-repo]")].map((a) => ({ path: a.dataset.repo, href: a.getAttribute("href"), target: a.target, rel: a.rel, shown: shown(a) })),
    hideShown: [...document.querySelectorAll("[data-gh=hide]")].filter(shown).length,
    hideTotal: document.querySelectorAll("[data-gh=hide]").length,
    hostOnlyShown: [...document.querySelectorAll("[data-host-only]")].filter(shown).length,
    emptyLinkRows: [...document.querySelectorAll(".work-links")].filter((w) => shown(w) && !w.querySelector("a:not([data-gh=hide])")).length,
    hostName: [...document.querySelectorAll("[data-host-name]")].map((e) => e.textContent),
    island: window.SITE ? window.SITE.hostUrl("https://github.com/ammaarrehman/homelab/tree/main/ha-dns") : null
  };
};

let browser;
try { browser = await chromium.launch(); } catch (e) { fails.push("chromium: could not launch (" + e.message.split("\n")[0] + ")"); }
if (browser) {
  for (const [name, js, host] of [["js off", false, false], ["js on, no host", true, false], ["js on, GitLab host", true, true]]) {
    const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1366, height: 900 } });
    if (host) await context.route("**/js/head.js*", (r) => r.fulfill({ contentType: "application/javascript", body: gitlabHead }));
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForTimeout(js ? 800 : 200);
    const s = await page.evaluate(look);
    check(`${name}: no page errors`, errors.length === 0, errors.join("; "));
    check(`${name}: repo paths in the markup`, s.paths.length >= 14, `${s.paths.length}`);
    if (!host) {
      check(`${name}: no link points at a repo host`, s.repoHrefs.length === 0, s.repoHrefs.join(", "));
      check(`${name}: repo paths carry no href`, s.paths.every((p) => p.href === null));
      check(`${name}: repo-only bits hidden`, s.hideShown === 0, `${s.hideShown} of ${s.hideTotal} shown`);
      check(`${name}: "on <host>" sentences hidden`, s.hostOnlyShown === 0, `${s.hostOnlyShown} shown`);
      check(`${name}: no empty link rows under the cards`, s.emptyLinkRows === 0, `${s.emptyLinkRows}`);
    } else {
      const bad = s.paths.filter((p) => !p.href || p.href !== "https://gitlab.com/ammaarrehman" + (p.path ? "/" + p.path.replace("/tree/", "/-/tree/") : ""));
      check(`${name}: every repo path is a GitLab link`, bad.length === 0, bad.map((b) => b.path + " -> " + b.href).join(", "));
      check(`${name}: they open in a new tab, noopener`, s.paths.every((p) => p.target === "_blank" && /noopener/.test(p.rel)));
      check(`${name}: no github.com link left`, !s.repoHrefs.some((h) => /github\.com/.test(h)));
      check(`${name}: repo-only bits shown`, s.hideShown === s.hideTotal, `${s.hideShown} of ${s.hideTotal}`);
      check(`${name}: "on <host>" sentences shown`, s.hostOnlyShown > 0 && s.hostName.every((n) => n === "GitLab"), `${s.hostOnlyShown}, ${s.hostName.join(", ")}`);
      check(`${name}: island links rewrite too`, s.island === "https://gitlab.com/ammaarrehman/homelab/-/tree/main/ha-dns", s.island);
    }
    await context.close();
  }
  await browser.close();
}
server.close();
if (fails.length) { console.log(`\n${fails.length} problem(s):\n- ${fails.join("\n- ")}`); process.exit(1); }
console.log("\nall passed");
