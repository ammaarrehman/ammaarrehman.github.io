#!/usr/bin/env node
/* focus: keyboard focus stays inside pi's island while it's open (audit 2026-09-28, R2).
   Tab and Shift+Tab through the island, an open landmark card, the menu and the map: focus never
   reaches the portfolio behind, and the modal layers keep it to themselves. Then leave: the
   portfolio is usable again (nothing left inert) and focus is back on the orb.

     node tools/focus.mjs            chromium and webkit
*/
import { chromium, webkit } from "playwright";
import { serve } from "./serve.mjs";

const PORT = 8600 + Math.floor(Math.random() * 200);
const server = await serve(PORT);
const fails = [];
const where = () => {
  const a = document.activeElement, w = document.getElementById("world");
  const layer = ["w-term", "w-credits", "w-map", "w-set", "w-pause", "w-dialog"].find((c) => a && a.closest("." + c));
  return { inWorld: !!(a && w.contains(a)), layer: layer || (a && w.contains(a) ? "island" : "outside"), label: a ? (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 30) : "none" };
};
async function walk(page, n, shift) {
  const seen = [];
  for (let i = 0; i < n; i++) { await page.keyboard.press(shift ? "Shift+Tab" : "Tab"); seen.push(await page.evaluate(where)); }
  return seen;
}
for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  let browser;
  try { browser = await type.launch(); } catch (e) { fails.push(`${name}: could not launch (${e.message.split("\n")[0]})`); continue; }
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const check = (what, seen, layer) => {
    const bad = seen.filter((s) => !s.inWorld || (layer && s.layer !== layer));
    console.log(`${bad.length ? "FAIL" : "ok  "} ${name.padEnd(8)} ${what.padEnd(34)} ${seen.length} presses, layers: ${[...new Set(seen.map((s) => s.layer))].join(", ")}`);
    if (bad.length) fails.push(`${name} ${what}: reached ${bad.map((b) => b.layer + " '" + b.label + "'").slice(0, 3).join("; ")}`);
  };

  await page.goto(`http://localhost:${PORT}/?debug=1&islandhour=11`);
  await page.waitForTimeout(600);
  await page.focus(".orb-btn, [data-orb], button.orb").catch(() => {});
  const orbSel = await page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.className || a.tagName) : null; });
  await page.evaluate(() => { location.hash = "#island"; });
  await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  check("the island: Tab", await walk(page, 24, false));
  check("the island: Shift+Tab", await walk(page, 24, true));
  const bgInert = await page.evaluate(() => ["main", "nav.nav", "header.hero", "footer"].every((s) => !document.querySelector(s) || document.querySelector(s).inert));
  console.log(`${bgInert ? "ok  " : "FAIL"} ${name.padEnd(8)} the portfolio behind is inert`);
  if (!bgInert) fails.push(`${name}: the portfolio behind is not inert while the island is open`);

  // a landmark card: the menu's landmark button walks pi to the mailbox and opens it
  await page.focus(".w-cv"); await page.keyboard.press("p"); await page.waitForTimeout(300);
  await page.click('.w-pause [data-lm="mailbox"]');
  await page.waitForFunction(() => !document.querySelector(".w-dialog").hidden, null, { timeout: 8000 }).catch(() => {});
  const cardOpen = await page.evaluate(() => !document.querySelector(".w-dialog").hidden);
  if (cardOpen) check("a landmark card: Tab", await walk(page, 20, false));
  else { console.log(`skip ${name.padEnd(8)} a landmark card (it didn't open)`); fails.push(`${name}: the landmark card didn't open, so it wasn't tested`); }
  await page.focus(".w-cv"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  if (await page.evaluate(() => !document.querySelector(".w-pause").hidden)) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }

  // the menu (p), then the map (m): each keeps focus to itself
  await page.focus(".w-cv"); await page.keyboard.press("p"); await page.waitForTimeout(300);
  check("the menu: Tab", await walk(page, 16, false), "w-pause");
  check("the menu: Shift+Tab", await walk(page, 16, true), "w-pause");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.focus(".w-cv"); await page.keyboard.press("m"); await page.waitForTimeout(400);
  check("the map: Tab", await walk(page, 16, false), "w-map");
  await page.keyboard.press("m"); await page.waitForTimeout(300);

  // leave: nothing inert, focus back on the page
  await page.click(".w-exit");
  await page.waitForFunction(() => !window.__island.getState().open, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ inert: [...document.body.children].filter((e) => e.inert).map((e) => e.tagName), focus: document.activeElement && document.activeElement !== document.body ? (document.activeElement.className || document.activeElement.tagName) : "body" }));
  const okExit = !after.inert.length && after.focus !== "body";
  console.log(`${okExit ? "ok  " : "FAIL"} ${name.padEnd(8)} leaving: inert left ${JSON.stringify(after.inert)}, focus on ${after.focus}${orbSel ? "" : " (the orb had no focus to begin with)"}`);
  if (!okExit) fails.push(`${name}: after leaving, inert ${JSON.stringify(after.inert)}, focus ${after.focus}`);
  if (errors.length) fails.push(`${name}: page errors: ${errors.join(" | ")}`);
  await browser.close();
}
server.close();
console.log(fails.length ? `\n${fails.length} problem(s):\n- ` + fails.join("\n- ") : "\nfocus stays in the island");
process.exit(fails.length ? 1 : 0);
