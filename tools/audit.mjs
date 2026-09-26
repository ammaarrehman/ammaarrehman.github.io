#!/usr/bin/env node
/* audit: the repeatable part of the site audit (AUDIT.md, Part A). Starts tools/serve.mjs on a
   spare port, then:

     A7  Chromium, Firefox and WebKit at five sizes: full-page screenshots in tools/out/,
         console errors and warnings, failed requests, horizontal overflow; the 404 page too
     A2  the recruiter path at 1366x768 and 390x844: when the name, the focus area, the résumé
         link and a contact method are all on screen without scrolling (first visit and repeat)
     A3  axe (WCAG 2.2 AA) on the main page, the 404 page and the island's dialogs; a keyboard
         pass (tab order, visible focus, skip link, traps); headings; target sizes; what still
         moves under reduced motion
     A9  every link: in-page anchors resolve, site files exist, external links answer
     A6  what the site keeps in localStorage and sessionStorage

     cd tools && npm install && npx playwright install
     node audit.mjs                 everything
     node audit.mjs --only=a3,a9    some of it
     node audit.mjs --offline       skip the external link checks

   Writes tools/out/report.json. Exits 1 on any console error or axe violation. */
import { chromium, firefox, webkit } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const ONLY = (arg("only") || "a2,a3,a6,a7,a9").split(",");
const OFFLINE = process.argv.includes("--offline");
const PORT = 8000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://localhost:${PORT}`;
const SIZES = [[360, 800], [390, 844], [768, 1024], [1366, 768], [1920, 1080]];
const ENGINES = { chromium, firefox, webkit };
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const report = { when: new Date().toISOString(), base: BASE };
let failed = false;

const server = await serve(PORT);
const browsers = {}, noLaunch = {};
async function browser(name) { return (browsers[name] ||= await ENGINES[name].launch()); }
async function usable(name) {
  try { await browser(name); return true; }
  catch (e) { noLaunch[name] = e.message.split("\n").find((l) => /Could not|error|Error/.test(l)) || e.message.split("\n")[0]; return false; }
}

// a context that skips the boot screen unless asked not to
async function context(name, opts = {}) {
  const { boot, ...rest } = opts;
  const ctx = await (await browser(name)).newContext({ viewport: { width: 1366, height: 768 }, ...rest });
  if (!boot) await ctx.addInitScript(() => { try { sessionStorage.setItem("booted", "1"); } catch (e) {} });
  return ctx;
}
// collect everything a page complains about
function watch(page) {
  const log = { errors: [], warnings: [], failed: [] };
  page.on("console", (m) => { if (m.type() === "error") log.errors.push(m.text()); if (m.type() === "warning") log.warnings.push(m.text()); });
  page.on("pageerror", (e) => log.errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => log.failed.push(`${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => { if (r.status() >= 400 && !/nothing-here/.test(r.url())) log.failed.push(`${r.url()} ${r.status()}`); });
  return log;
}
const settle = (page, ms = 2600) => page.waitForTimeout(ms);          // the hero types itself in over ~1.8 s

// ---------- A7: engines x sizes ----------
if (ONLY.includes("a7")) {
  report.a7 = [];
  for (const name of Object.keys(ENGINES)) {
    if (!(await usable(name))) { report.a7.push({ engine: name, size: "all", launchFailed: noLaunch[name], errors: [], warnings: [], failed: [] }); continue; }
    for (const [w, h] of SIZES) {
      const ctx = await context(name, { viewport: { width: w, height: h } });
      const page = await ctx.newPage(); const log = watch(page);
      await page.goto(BASE + "/", { waitUntil: "load" }); await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const seen = JSON.parse(JSON.stringify(log));   // before the screenshot: WebKit's injects a style tag the CSP refuses
      await page.screenshot({ path: join(OUT, `${name}-${w}x${h}.png`), fullPage: true });
      report.a7.push({ engine: name, size: `${w}x${h}`, overflowPx: overflow, ...seen });
      await ctx.close();
    }
    const ctx = await context(name); const page = await ctx.newPage(); const log = watch(page);
    const res = await page.goto(BASE + "/nothing-here", { waitUntil: "load" }); await settle(page, 800);
    log.errors = log.errors.filter((e) => !/status of 404/.test(e));      // the page's own 404, which is the point
    const seen = JSON.parse(JSON.stringify(log));
    await page.screenshot({ path: join(OUT, `${name}-404.png`) });
    report.a7.push({ engine: name, size: "404 page", status: res.status(), ...seen });
    await ctx.close();
  }
  for (const r of report.a7) if (r.errors.length) failed = true;
}

// ---------- A2: the recruiter path ----------
if (ONLY.includes("a2")) {
  report.a2 = [];
  const probe = () => {
    const seen = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.15) return false;
      }
      const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 20), 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const top = document.elementFromPoint(x, y);
      return !!top && (el.contains(top) || top.contains(el));
    };
    const any = (sel) => [...document.querySelectorAll(sel)].some(seen);
    return {
      name: seen(document.querySelector("h1")),
      focus: seen(document.querySelector('.t-box[aria-label="profile"] dd')),
      resume: any('a[href$="Resume.pdf"]'),
      contact: any('a[href^="mailto:"], a[href*="linkedin.com"]')
    };
  };
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    for (const boot of [true, false]) {
      const ctx = await context("chromium", { viewport: { width: w, height: h }, boot });
      const page = await ctx.newPage();
      const t0 = Date.now();
      await page.goto(BASE + "/", { waitUntil: "commit" });
      let all = null, last = null;
      for (let t = 0; t < 12000; t += 100) {
        last = await page.evaluate(probe).catch(() => null);
        if (last && Object.values(last).every(Boolean)) { all = Date.now() - t0; break; }
        await page.waitForTimeout(100);
      }
      const paint = await page.evaluate(() => {
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return { fcp: fcp ? Math.round(fcp.startTime) : null };
      });
      await page.screenshot({ path: join(OUT, `recruiter-${w}x${h}-${boot ? "first" : "repeat"}.png`) });
      report.a2.push({ size: `${w}x${h}`, visit: boot ? "first (boot screen)" : "repeat", allVisibleMs: all, missingAtEnd: all ? [] : Object.keys(last || {}).filter((k) => !last[k]), ...paint });
      await ctx.close();
    }
  }
}

// ---------- A3: accessibility ----------
if (ONLY.includes("a3")) {
  report.a3 = {};
  const axe = async (page, include) => {
    let b = new AxeBuilder({ page }).withTags(AXE_TAGS);
    if (include) b = b.include(include);
    const r = await b.analyze();
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join(" ").trim()) }));
  };
  // main page and 404
  let ctx = await context("chromium"); let page = await ctx.newPage();
  await page.goto(BASE + "/"); await settle(page);
  report.a3.axeMain = await axe(page);
  await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(300);
  report.a3.axeMainDark = await axe(page);
  await page.emulateMedia({ colorScheme: "light" });
  report.a3.lang = await page.evaluate(() => document.documentElement.lang);
  report.a3.headings = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => !h.closest("#world")).map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 50)}`));
  report.a3.headingSkips = report.a3.headings.map((h) => +h[1]).map((l, i, a) => (i && l > a[i - 1] + 1 ? report.a3.headings[i] : null)).filter(Boolean);
  // target size (2.5.8): anything interactive under 24 x 24 that isn't an inline link in a sentence
  report.a3.smallTargets = await page.evaluate(() => [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.closest("#world,#boot") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
    .map((el) => { const r = el.getBoundingClientRect(); const inline = getComputedStyle(el).display === "inline" && /\S/.test((el.parentElement.textContent || "").replace(el.textContent, "")); return { el, w: Math.round(r.width), h: Math.round(r.height), inline }; })
    .filter((t) => (t.w < 24 || t.h < 24) && !t.inline)
    .map((t) => `${t.el.tagName.toLowerCase()} "${(t.el.getAttribute("aria-label") || t.el.textContent).trim().slice(0, 40)}" ${t.w}x${t.h}`));
  // link text that doesn't say where it goes
  report.a3.vagueLinks = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ a, n: (a.getAttribute("aria-label") || a.textContent).trim() }))
    .filter(({ n }) => !n || /^(link|here|click( here)?|more|read more|↗)$/i.test(n)).map(({ a, n }) => `"${n}" -> ${a.getAttribute("href")}`));
  // keyboard pass
  await page.goto(BASE + "/"); await settle(page);
  const stops = [];
  for (let i = 0; i < 140; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none" || /underline/.test(cs.textDecorationLine);
      const r = el.getBoundingClientRect();
      return { id: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""), label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40), ring, onScreen: r.bottom > 0 && r.top < innerHeight, key: el.outerHTML.slice(0, 120) };
    });
    if (!s) continue;                                               // the gap after the last stop, before it wraps
    if (stops.length && stops.some((p) => p.key === s.key) && stops[0].key === s.key) break;   // wrapped around
    stops.push(s);
  }
  report.a3.tabStops = stops.map((s) => `${s.id} "${s.label}"${s.ring ? "" : "  <- no visible focus style"}${s.onScreen === false ? "  <- off screen" : ""}`);
  report.a3.skipLinkFirst = /skip/.test(stops[0]?.label || "");
  const keys = stops.map((s) => s.key); report.a3.trap = keys.length > 20 && new Set(keys.slice(-20)).size < 4;
  report.a3.axe404 = await (async () => { const p = await ctx.newPage(); await p.goto(BASE + "/nothing-here"); await settle(p, 600); const v = await axe(p); await p.close(); return v; })();
  await ctx.close();

  // reduced motion: what still runs
  ctx = await context("chromium", { reducedMotion: "reduce" }); page = await ctx.newPage();
  await page.goto(BASE + "/"); await settle(page);
  report.a3.reducedMotion = await page.evaluate(async () => {
    const running = document.getAnimations().filter((a) => a.playState === "running").map((a) => `${a.animationName || a.transitionProperty || "animation"} on ${a.effect?.target?.className || a.effect?.target?.tagName}`);
    const c = document.querySelector("canvas.orb"); let orbMoves = null;
    if (c) { const a = c.toDataURL(); await new Promise((r) => setTimeout(r, 700)); orbMoves = a !== c.toDataURL(); }
    return { running: [...new Set(running)], orbMoves };
  });
  await ctx.close();

  // the island's dialogs
  ctx = await context("chromium"); page = await ctx.newPage(); const log = watch(page);
  const island = {};
  await page.goto(BASE + "/#island/dns");
  await page.waitForSelector("#world.show", { timeout: 15000 }).catch(() => {});
  await page.waitForSelector(".w-dialog:not([hidden])", { timeout: 8000 }).catch(() => {});
  island.card = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.keyboard.press("p"); await page.waitForTimeout(400);
  island.pause = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.keyboard.press("m"); await page.waitForTimeout(500);
  island.map = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.click(".w-gear").catch(() => {}); await page.waitForTimeout(400);
  island.settings = await axe(page, "#world");
  report.a3.island = island; report.a3.islandConsole = log;
  // ---------- A6: storage, read while the island is open ----------
  report.a6 = await page.evaluate(() => {
    const dump = (s) => Object.keys(s).map((k) => `${k} (${s.getItem(k).length} chars): ${s.getItem(k).slice(0, 80)}`);
    return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) };
  });
  await ctx.close();
  for (const v of [report.a3.axeMain, report.a3.axeMainDark, report.a3.axe404, ...Object.values(island)]) if (v.length) failed = true;
}

// ---------- A9: links ----------
if (ONLY.includes("a9")) {
  const ctx = await context("chromium"); const page = await ctx.newPage();
  await page.goto(BASE + "/"); await settle(page, 800);
  const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: (a.getAttribute("aria-label") || a.textContent).trim().replace(/\s+/g, " ").slice(0, 50), ghOff: a.classList.contains("gh-off"), hidden: !a.getClientRects().length })));
  const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id));
  const p404 = await ctx.newPage(); await p404.goto(BASE + "/nothing-here");
  const links404 = await p404.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: a.textContent.trim().slice(0, 40), page: "404" })));
  await ctx.close();
  // the island cards' links live in world.js
  const world = readFileSync(join(HERE, "..", "js", "world.js"), "utf8");
  const islandLinks = [...world.matchAll(/\["([^"#\]][^"\]]{0,59})", "((?:https?:\/\/|#[a-z]|assets\/|mailto:)[^"]+)"\]/g)].map((m) => ({ href: m[2], text: m[1], page: "island" }));
  const actions = new Set([...world.matchAll(/l\[1\] === "(#[a-z]+)"/g)].map((m) => m[1]));
  const all = [...links.map((l) => ({ ...l, page: "main" })), ...links404, ...islandLinks];
  const seen = new Map(); for (const l of all) if (!seen.has(l.href)) seen.set(l.href, l);
  const out = [];
  for (const [href, l] of seen) {
    let status;
    if (href.startsWith("#")) status = href === "#" || ids.includes(href.slice(1).split("/")[0]) || href.startsWith("#island") ? "ok (anchor)" : actions.has(href) ? "ok (island action)" : "MISSING ANCHOR";
    else if (href.startsWith("tel:")) status = "ok (tel)";
    else if (href.startsWith("mailto:")) status = href === "mailto:ammaarrehmanf@gmail.com" ? "ok (mailto)" : "CHECK MAILTO";
    else if (/^https?:/.test(href)) {
      if (OFFLINE) status = "skipped (offline)";
      else {
        try {
          const r = await fetch(href, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36" }, signal: AbortSignal.timeout(12000) });
          status = String(r.status) + (r.redirected ? ` (redirected to ${r.url})` : "") + (r.status === 999 ? " LinkedIn refuses scripts; check by hand" : "");
        } catch (e) { status = "ERROR " + (e.cause?.code || e.name); }
      }
    } else {
      const r = await fetch(new URL(href, BASE + "/")).catch(() => null);
      status = r && r.status === 200 ? "ok (file)" : `MISSING FILE ${r?.status}`;
    }
    out.push({ status, href, text: l.text, page: l.page, note: l.ghOff ? "shown as plain text (GitHub off)" : l.hidden ? "hidden" : "" });
  }
  report.a9 = out;
}

for (const b of Object.values(browsers)) await b.close();
server.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

// short summary
if (report.a7) for (const r of report.a7) if (r.launchFailed) console.log(`A7 ${r.engine.padEnd(8)} could not launch: ${r.launchFailed}`); else console.log(`A7 ${r.engine.padEnd(8)} ${String(r.size).padEnd(10)} errors ${r.errors.length}  warnings ${r.warnings.length}  failed ${r.failed.length}${r.overflowPx > 0 ? `  OVERFLOW ${r.overflowPx}px` : ""}${r.status ? `  status ${r.status}` : ""}`);
if (report.a2) for (const r of report.a2) console.log(`A2 ${r.size.padEnd(9)} ${r.visit.padEnd(19)} all four on screen at ${r.allVisibleMs ?? "never"} ms${r.missingAtEnd.length ? " (missing: " + r.missingAtEnd.join(", ") + ")" : ""}  fcp ${r.fcp} ms`);
if (report.a3) {
  const n = (v) => v.map((x) => `${x.id}(${x.nodes.length})`).join(" ") || "none";
  console.log(`A3 axe main (light): ${n(report.a3.axeMain)} | main (dark): ${n(report.a3.axeMainDark)} | 404: ${n(report.a3.axe404)} | island: ${Object.entries(report.a3.island).map(([k, v]) => k + " " + n(v)).join(", ")}`);
  console.log(`A3 lang=${report.a3.lang} skipFirst=${report.a3.skipLinkFirst} trap=${report.a3.trap} tabStops=${report.a3.tabStops.length} noFocusStyle=${report.a3.tabStops.filter((s) => /no visible/.test(s)).length} headingSkips=${report.a3.headingSkips.length} smallTargets=${report.a3.smallTargets.length} vagueLinks=${report.a3.vagueLinks.length}`);
  console.log(`A3 reduced motion: orb moves=${report.a3.reducedMotion.orbMoves}, running: ${report.a3.reducedMotion.running.join("; ") || "none"}`);
}
if (report.a9) console.log(`A9 ${report.a9.length} links: ${report.a9.filter((l) => /MISSING|ERROR|CHECK|^[45]/.test(l.status)).length} need a look`);
console.log(`\nfull report: tools/out/report.json${failed ? "\nFAILED: console errors or axe violations (see the report)" : ""}`);
process.exit(failed ? 1 : 0);
