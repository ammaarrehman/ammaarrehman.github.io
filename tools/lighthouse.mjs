#!/usr/bin/env node
/* lighthouse: mobile and desktop runs, scores and the lab metrics, HTML reports in tools/out/.
   Uses Playwright's Chromium, so nothing else needs installing.

     node lighthouse.mjs                          the live site, https://ammaarrehman.com/
     node lighthouse.mjs --local                  the repo, through tools/serve.mjs
     node lighthouse.mjs --resolve=104.21.52.117  the live site at a fixed edge address, for when
                                                  this machine's DNS hasn't caught up with a change

   Targets (AUDIT.md, A4): 90+ in every category, LCP under 2.5 s, CLS under 0.1. INP needs real
   visitors, so the lab stand-in is Total Blocking Time (under 200 ms). */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const LOCAL = process.argv.includes("--local");
const RESOLVE = (process.argv.find((a) => a.startsWith("--resolve=")) || "").split("=")[1];
let server = null, url = "https://ammaarrehman.com/";
if (LOCAL) { server = await serve(8455); url = "http://localhost:8455/"; }

const flags = ["--headless=new", "--no-first-run", "--no-default-browser-check"];
if (RESOLVE) flags.push(`--host-resolver-rules=MAP ammaarrehman.com ${RESOLVE}`);
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: flags });
const rows = [];
for (const form of ["mobile", "desktop"]) {
  const config = form === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined;
  const r = await lighthouse(url, { port: chrome.port, output: ["html", "json"], logLevel: "error" }, config);
  writeFileSync(join(OUT, `lighthouse-${form}.html`), r.report[0]);
  const lhr = r.lhr, a = lhr.audits, pct = (k) => Math.round(lhr.categories[k].score * 100);
  rows.push({
    form, performance: pct("performance"), accessibility: pct("accessibility"), "best-practices": pct("best-practices"), seo: pct("seo"),
    lcp: a["largest-contentful-paint"].displayValue, cls: a["cumulative-layout-shift"].displayValue, tbt: a["total-blocking-time"].displayValue,
    fcp: a["first-contentful-paint"].displayValue, lcpElement: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 90),
    failing: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "manual" && x.scoreDisplayMode !== "notApplicable").map((x) => `${x.id} (${x.displayValue || x.score})`)
  });
}
await chrome.kill();
if (server) server.close();
console.log(`Lighthouse on ${url}`);
for (const r of rows) {
  console.log(`\n${r.form}: performance ${r.performance}, accessibility ${r.accessibility}, best practices ${r["best-practices"]}, SEO ${r.seo}`);
  console.log(`  LCP ${r.lcp} (${r.lcpElement || "?"}), CLS ${r.cls}, TBT ${r.tbt}, FCP ${r.fcp}`);
  if (r.failing.length) console.log("  below 90: " + r.failing.join(", "));
}
writeFileSync(join(OUT, "lighthouse.json"), JSON.stringify(rows, null, 2));
