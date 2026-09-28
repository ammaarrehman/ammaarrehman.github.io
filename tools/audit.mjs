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
     node audit.mjs --engines=chromium,webkit   A7 in only these engines (the rest are skipped)

   Every check ends as pass, fail, blocked (it couldn't run: a browser that won't launch, a
   section that crashed, an external link that couldn't be reached) or skipped (left out on
   purpose by a flag). Missing coverage is never a pass.
   Writes tools/out/report.json (results[] holds every check). Exits 1 if anything failed,
   2 if nothing failed but something was blocked, 0 only when everything asked for ran and passed. */
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
const ENGINES_ASKED = (arg("engines") || "chromium,firefox,webkit").split(",");
const OFFLINE = process.argv.includes("--offline");
const PORT = 8000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://localhost:${PORT}`;
const SIZES = [[360, 800], [390, 844], [768, 1024], [1366, 768], [1920, 1080]];
const ENGINES = { chromium, firefox, webkit };
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const report = { when: new Date().toISOString(), base: BASE, results: [] };
const result = (id, status, detail = "") => report.results.push({ id, status, detail });
const gate = (id, ok, detail = "") => result(id, ok ? "pass" : "fail", ok ? "" : detail);

const server = await serve(PORT);
const browsers = {}, noLaunch = {};
async function browser(name) { return (browsers[name] ||= await ENGINES[name].launch()); }
async function usable(name) {
  try { await browser(name); return true; }
  catch (e) { noLaunch[name] = e.message.split("\n").find((l) => /Could not|error|Error/.test(l)) || e.message.split("\n")[0]; return false; }
}
// run one part of the audit: blocked if it needs chromium and chromium won't start, and a crash
// part way through is recorded as a failure rather than ending the run
async function section(id, needsChromium, fn) {
  if (needsChromium && !(await usable("chromium"))) return result(id.toUpperCase(), "blocked", "chromium could not launch: " + noLaunch.chromium);
  try { await fn(); } catch (e) { result(id.toUpperCase(), "fail", "crashed: " + e.message.split("\n")[0]); }
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
if (ONLY.includes("a7")) await section("a7", false, async () => {
  report.a7 = [];
  for (const name of Object.keys(ENGINES)) {
    if (!ENGINES_ASKED.includes(name)) { result(`A7 ${name}`, "skipped", "not in --engines"); continue; }
    if (!(await usable(name))) { result(`A7 ${name}`, "blocked", "could not launch: " + noLaunch[name]); report.a7.push({ engine: name, size: "all", launchFailed: noLaunch[name], errors: [], warnings: [], failed: [] }); continue; }
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
  for (const r of report.a7) if (!r.launchFailed) {
    const id = `A7 ${r.engine} ${r.size}`;
    gate(id + " console", !r.errors.length, r.errors.slice(0, 3).join(" | "));
    gate(id + " requests", !r.failed.length, r.failed.slice(0, 3).join(" | "));
    if (r.overflowPx !== undefined) gate(id + " overflow", !(r.overflowPx > 0), `${r.overflowPx}px wider than the viewport`);
    if (r.status !== undefined) gate(id + " status", r.status === 404, `answered ${r.status}, not 404`);
  }
});

// ---------- A2: the recruiter path ----------
if (ONLY.includes("a2")) await section("a2", true, async () => {
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
      gate(`A2 ${w}x${h} ${boot ? "first" : "repeat"}`, all !== null, "not all on screen within 12 s; missing: " + report.a2.at(-1).missingAtEnd.join(", "));
      await ctx.close();
    }
  }
});

// ---------- A3: accessibility ----------
if (ONLY.includes("a3")) await section("a3", true, async () => {
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
  const opened = await page.waitForSelector("#world.show", { timeout: 15000 }).then(() => true, () => false);
  const carded = await page.waitForSelector(".w-dialog:not([hidden])", { timeout: 8000 }).then(() => true, () => false);
  island.card = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.keyboard.press("p"); await page.waitForTimeout(400);
  island.pause = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.keyboard.press("m"); await page.waitForTimeout(500);
  island.map = await axe(page, "#world");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const geared = await page.click(".w-gear").then(() => true, () => false); await page.waitForTimeout(400);
  island.settings = await axe(page, "#world");
  report.a3.island = island; report.a3.islandConsole = log;
  // ---------- A6: storage, read while the island is open ----------
  report.a6 = await page.evaluate(() => {
    const dump = (s) => Object.keys(s).map((k) => `${k} (${s.getItem(k).length} chars): ${s.getItem(k).slice(0, 80)}`);
    return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) };
  });
  await ctx.close();
  const axeGate = (id, v) => gate("A3 axe " + id, !v.length, v.map((x) => `${x.id}(${x.nodes.length})`).join(" "));
  axeGate("main (light)", report.a3.axeMain); axeGate("main (dark)", report.a3.axeMainDark); axeGate("404", report.a3.axe404);
  // an island dialog that never opened was never checked: that's a failure, not a clean axe run
  gate("A3 island opens from #island/dns", opened && carded, opened ? "the landmark card never showed" : "the island never showed");
  gate("A3 island settings open", geared, "no .w-gear to click");
  for (const [k, v] of Object.entries(island)) if ((k !== "settings" || geared) && opened && carded) axeGate("island " + k, v);
  gate("A3 island console", !log.errors.length, log.errors.slice(0, 3).join(" | "));
  gate("A3 lang is en", report.a3.lang === "en", `lang="${report.a3.lang}"`);
  gate("A3 skip link is the first tab stop", report.a3.skipLinkFirst);
  gate("A3 no keyboard trap", !report.a3.trap);
  gate("A3 every tab stop shows focus", report.a3.tabStops.every((t) => !/no visible/.test(t)), report.a3.tabStops.filter((t) => /no visible/.test(t)).slice(0, 3).join(" | "));
  gate("A3 headings in order", !report.a3.headingSkips.length, report.a3.headingSkips.join(" | "));
  gate("A3 link text names its destination", !report.a3.vagueLinks.length, report.a3.vagueLinks.join(" | "));
  if (report.a3.reducedMotion.orbMoves === null) result("A3 reduced motion: orb still", "blocked", "no canvas.orb on the page");
  else gate("A3 reduced motion: orb still", !report.a3.reducedMotion.orbMoves);
  gate("A3 reduced motion: nothing animating", !report.a3.reducedMotion.running.length, report.a3.reducedMotion.running.join(" | "));
  // smallTargets stays a list to read, not a gate: the window lights' hit areas are pseudo-elements
  // the probe can't see (docs/audit-2026-09-28.md)
});

// ---------- A9: links ----------
if (ONLY.includes("a9")) await section("a9", true, async () => {
  const ctx = await context("chromium"); const page = await ctx.newPage();
  await page.goto(BASE + "/"); await settle(page, 800);
  const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: (a.getAttribute("aria-label") || a.textContent).trim().replace(/\s+/g, " ").slice(0, 50), hidden: !a.getClientRects().length })));
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
    out.push({ status, href, text: l.text, page: l.page, note: l.hidden ? "hidden" : "" });
    const id = `A9 ${l.page} ${href}`;
    if (status.startsWith("skipped")) continue;
    else if (status.startsWith("ERROR")) result(id, "blocked", status);                       // couldn't reach it: unknown, not passed
    else if (status.startsWith("999")) result(id, "blocked", "LinkedIn refuses scripts; check by hand");
    else gate(id, !/MISSING|CHECK|^[45]/.test(status), status);
  }
  if (OFFLINE) result("A9 external links", "skipped", "--offline");
  report.a9 = out;
});

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
const count = (st) => report.results.filter((r) => r.status === st);
const [pass, fail, blocked, skipped] = ["pass", "fail", "blocked", "skipped"].map(count);
for (const r of [...fail, ...blocked]) console.log(`${r.status.toUpperCase().padEnd(7)} ${r.id}${r.detail ? ": " + r.detail : ""}`);
console.log(`\n${pass.length} passed, ${fail.length} failed, ${blocked.length} blocked, ${skipped.length} skipped. full report: tools/out/report.json`);
if (!report.results.length) console.log("nothing ran (check --only)");
process.exit(fail.length || !report.results.length ? 1 : blocked.length ? 2 : 0);
