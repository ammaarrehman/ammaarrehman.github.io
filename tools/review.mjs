#!/usr/bin/env node
/* Supplemental review: actual navigation, keyboard containment, narrow screens, storage,
   island deep links, and a live delivery check. Outputs are private in tools/out/review/.
   node tools/review.mjs [--live] */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const out = fileURLToPath(new URL('./out/review/', import.meta.url));
mkdirSync(out, { recursive: true });
const server = await serve(8461);
const base = 'http://localhost:8461';
const browser = await chromium.launch();
const liveOnly = process.argv.includes('--live-only');
const report = liveOnly ? JSON.parse(readFileSync(out + 'report.json', 'utf8')) : { when: new Date().toISOString(), main: [], island: [], resilience: [] };
async function pageFor(options = {}, init) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => sessionStorage.setItem('booted', '1'));
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { context, page, errors };
}
async function focusWalk(page, count = 32) {
  const stops = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const e = document.activeElement;
      return { tag: e.tagName, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 65), inIsland: !!e.closest('#world'), hidden: !e.getClientRects().length };
    }));
  }
  return stops;
}
try {
  if (!liveOnly) {
  for (const [name, viewport, colorScheme] of [
    ['desktop-dark', { width: 1366, height: 900 }, 'dark'],
    ['desktop-light', { width: 1366, height: 900 }, 'light'],
    ['phone', { width: 390, height: 844 }, 'light'],
    ['narrow', { width: 320, height: 800 }, 'light'],
    ['landscape', { width: 568, height: 320 }, 'dark']
  ]) {
    const { context, page, errors } = await pageFor({ viewport, colorScheme });
    const requests = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto(base); await page.waitForTimeout(2500);
    await page.screenshot({ path: out + name + '-hero.png' });
    const initial = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      font: getComputedStyle(document.body).fontFamily,
      brokenImages: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.getAttribute('src'))
    }));
    initial.islandLoadedBeforeInteraction = requests.some(u => /\/js\/(world|audio)\.js/.test(u));
    const sections = [];
    for (const id of ['about', 'skills', 'experience', 'projects', 'education', 'contact']) {
      await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
      sections.push(await page.locator('#' + id).evaluate(e => ({ id: e.id, visible: getComputedStyle(e).opacity, width: e.getBoundingClientRect().width })));
      if (['projects', 'contact'].includes(id)) await page.screenshot({ path: out + name + '-' + id + '.png' });
    }
    if (name === 'desktop-dark') {
      await page.locator('.orb-btn').scrollIntoViewIfNeeded();
      initial.windowHitAreas = await page.locator('.hero .wb').evaluateAll(es => es.map(e => {
        const r = e.getBoundingClientRect(), p = getComputedStyle(e, '::before');
        return { label: e.getAttribute('aria-label'), width: r.width, height: r.height, inset: p.inset,
          outsideBoxHitsButton: e.contains(document.elementFromPoint(r.left - 4, r.top + 6)) };
      }));
    }
    report.main.push({ name, initial, sections, errors });
    await context.close();
  }
  for (const id of ['rack', 'desk', 'uplink', 'tower', 'lighthouse', 'macbook', 'tablet', 'mailbox']) {
    const { context, page, errors } = await pageFor({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(base + '/?debug=1&islandhour=11#island/' + id);
    await page.waitForSelector('.w-dialog:not([hidden])'); await page.waitForTimeout(600);
    const state = await page.evaluate(() => window.__island.getState());
    const title = await page.locator('.w-name').innerText();
    const row = { id, title, state, errors };
    if (id === 'rack') {
      row.focus = await focusWalk(page);
      await page.keyboard.press('Escape');
      await page.locator('.w-cv').focus(); await page.keyboard.press('p');
      row.pauseFocus = await focusWalk(page);
      await page.screenshot({ path: out + 'island-pause.png' });
    }
    report.island.push(row); await context.close();
  }
  for (const scenario of ['blocked-storage', 'unknown-save', 'invalid-save-shape', 'no-js']) {
    const options = { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...(scenario === 'no-js' ? { javaScriptEnabled: false } : {}) };
    const init = scenario === 'blocked-storage' ? () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    } : scenario === 'unknown-save' ? () => localStorage.setItem('island-save', JSON.stringify({ v: 999, logs: ['rack'] }))
      : scenario === 'invalid-save-shape' ? () => localStorage.setItem('island-save', JSON.stringify({ v: 1, logs: ['not-a-landmark'], ruler: { invalid: true }, hints: [] })) : undefined;
    const { context, page, errors } = await pageFor(options, init);
    await page.goto(base + (scenario === 'no-js' ? '/' : '/#island'));
    await page.waitForTimeout(2500);
    if (scenario !== 'no-js' && await page.locator('.w-card-go [data-a="play"]').isVisible()) await page.locator('.w-card-go [data-a="play"]').click();
    report.resilience.push({ scenario, errors, state: await page.evaluate(() => ({
      islandVisible: document.querySelector('#world').classList.contains('show'),
      mainVisible: getComputedStyle(document.querySelector('h1')).visibility,
      overflow: document.documentElement.scrollWidth - innerWidth,
      repoLinksVisible: [...document.querySelectorAll('a[href*="github.com/ammaarrehman"], a[data-repo][href]')].filter(e => e.getClientRects().length > 0).length
    })) });
    await page.screenshot({ path: out + scenario + '.png' }); await context.close();
  }
  }
  if (process.argv.includes('--live') || liveOnly) {
    const { context, page, errors } = await pageFor();
    const requests = [];
    page.on('request', r => requests.push(r.url()));
    const response = await page.goto('https://ammaarrehman.com/'); await page.waitForTimeout(3000);
    report.live = { status: response.status(), headers: await response.allHeaders(), errors,
      externalOrigins: [...new Set(requests.filter(u => /^https?:/.test(u)).map(u => new URL(u).origin))],
      paths: [] };
    for (const path of ['/.well-known/security.txt', '/robots.txt', '/sitemap.xml', '/missing-audit-page', '/README.md', '/AGENTS.md', '/docs/game-design.md', '/tools/audit.mjs', '/art/palette.json', '/.git/config', '/wrangler.jsonc']) {
      const r = await fetch('https://ammaarrehman.com' + path);
      report.live.paths.push({ path, status: r.status, ...(path.endsWith('security.txt') ? { text: await r.text() } : {}) });
    }
    for (const url of ['http://ammaarrehman.com/audit-path?q=1', 'https://www.ammaarrehman.com/audit-path?q=1']) {
      const r = await fetch(url, { redirect: 'manual' });
      report.live.paths.push({ url, status: r.status, location: r.headers.get('location') });
    }
    report.live.tls = ['tls1', 'tls1_1', 'tls1_2', 'tls1_3'].map(version => {
      const r = spawnSync('openssl', ['s_client', '-connect', 'ammaarrehman.com:443', '-servername', 'ammaarrehman.com', '-' + version, '-cipher', 'DEFAULT@SECLEVEL=0', '-brief'], { input: '', encoding: 'utf8', timeout: 15000 });
      return { version, status: r.status, output: (r.stdout + r.stderr).split('\n').filter(l => /Protocol|Ciphersuite|Verification|alert|error/i.test(l)).join('\n'), error: r.error?.message };
    });
    const dns = spawnSync('dig', ['+dnssec', 'ammaarrehman.com', '@1.1.1.1'], { encoding: 'utf8', timeout: 15000 });
    report.live.dnssec = dns.stdout.split('\n').filter(l => /flags:|IN\s+(A|RRSIG)\s/.test(l));
    await context.close();
  }
} finally {
  writeFileSync(out + 'report.json', JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
console.log(JSON.stringify({ main: report.main.map(r => ({ name: r.name, ...r.initial, errors: r.errors })),
  island: report.island.map(r => ({ id: r.id, room: r.state.room, title: r.title, errors: r.errors,
    focusEscapesIsland: r.focus?.filter(s => !s.inIsland), pauseEscapesIsland: r.pauseFocus?.filter(s => !s.inIsland) })),
  resilience: report.resilience, live: report.live, report: out + 'report.json' }, null, 2));
