#!/usr/bin/env node
/* deploy: builds .deploy/ from an allowlist, checks it, deploys it to Cloudflare, then checks
   the live site. Nothing ships unless it's on the list below.

     node tools/deploy.mjs              build, check, deploy, smoke-test
     node tools/deploy.mjs --dry-run    build and check only (no Cloudflare account needed)
     node tools/deploy.mjs --check      only the live checks, against what's deployed now

   It stops (exit 1) if:
     - a file the pages reference (html src/href/srcset, css url(), js paths) is missing
     - anything that must never ship is in .deploy/: *.md, tools/, .git, *.env, wrangler.*
     - any file contains something shaped like a key: ghp_, github_pat_, -----BEGIN
     - the CSP in the <meta> tags doesn't match the one in _headers (the header may add
       frame-ancestors and upgrade-insecure-requests, which a meta tag can't or shouldn't carry)
     - the staged MAP-B island would ship (until its approved switch-over): js/maps/home.js, run in a sandbox,
       must register the format-1, 100 x 80 island and nothing staged; no shipped script's code (comments aside)
       may name ISLAND_MAPS_STAGED, switch on the preview flag or carry a staged map ("staged": true)
     node tools/deploy.mjs --guard-self-test   proves that guard stops a synthetic staged map, and passes the real one
   The deploy itself needs `npx wrangler login` once (see docs/hosting.md). No token is stored. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".deploy");
const SITE = "https://ammaarrehman.com";
const DRY = process.argv.includes("--dry-run");
const CHECK = process.argv.includes("--check");

// what ships: paths relative to the repo root (a folder ships whole)
const ALLOW = [
  "index.html", "404.html", "_headers", "robots.txt", "sitemap.xml", "site.webmanifest",
  "css", "js", "fonts", ".well-known",
  "assets/favicon.svg", "assets/favicon.png", "assets/favicon-32.png", "assets/apple-touch-icon.png", "assets/icon-512.png",
  "assets/og.png", "assets/headshot.jpg", "assets/hands.json", "assets/island", "assets/work",
  "assets/resume/Ammaar_Rehman_Resume.pdf",
  "img", "audio"                                       // not present yet; shipped if they appear
];
const NEVER = [/\.md$/i, /(^|\/)tools\//, /(^|\/)\.git(\/|$)/, /\.env$/i, /(^|\/)\.dev\.vars$/, /(^|\/)wrangler\./, /(^|\/)node_modules\//];
const KEYISH = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /-----BEGIN [A-Z ]*(PRIVATE )?KEY-----/];
const TEXT = new Set([".html", ".css", ".js", ".json", ".txt", ".xml", ".webmanifest", ".svg", ""]);

const fail = [];
/* the staged MAP-B island stays local until the approved switch-over (B4 lifts the format-1 rule): home is the
   text of js/maps/home.js, scripts [path, text] every shipped script. Judged by what runs, not by words in comments */
function stagedMapProblems(home, scripts) {
  const out = [], ctx = { window: {} };
  try { vm.runInNewContext(home, ctx, { timeout: 2000 }); } catch (e) { return [`js/maps/home.js doesn't run: ${e.message}`]; }
  const H = ctx.window.ISLAND_MAPS && ctx.window.ISLAND_MAPS.home;
  if (!H || H.format !== 1 || H.w !== 100 || H.h !== 80 || H.staged !== undefined) out.push(`js/maps/home.js isn't the format-1, 100 x 80 production island (format ${H && H.format}, ${H && H.w} x ${H && H.h}${H && H.staged !== undefined ? ", staged " + H.staged : ""})`);
  if (ctx.window.ISLAND_MAPS_STAGED !== undefined) out.push("js/maps/home.js registers ISLAND_MAPS_STAGED");
  if (ctx.window.ISLAND_MAP_PREVIEW !== undefined) out.push("js/maps/home.js switches on the MAP-B preview flag");
  for (const [f, text] of scripts) {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
    if (/\bISLAND_MAPS_STAGED\b/.test(code)) out.push(`${f} names ISLAND_MAPS_STAGED, the staged map's registry`);
    if (/\bISLAND_MAP_PREVIEW\s*=(?!=)/.test(code)) out.push(`${f} switches on the MAP-B preview flag`);
    if (/["']staged["']\s*:\s*true/.test(code)) out.push(`${f} carries a staged map ("staged": true)`);
  }
  return out;
}
if (process.argv.includes("--guard-self-test")) {
  const realHome = readFileSync(join(ROOT, "js/maps/home.js"), "utf8"), staged = readFileSync(join(ROOT, "tools/maps/staged/home.js"), "utf8");
  const wrapped = staged + "\nwindow.ISLAND_MAPS = window.ISLAND_MAPS || {}; window.ISLAND_MAPS.home = window.ISLAND_MAPS_STAGED.home;\nwindow.ISLAND_MAP_PREVIEW = \"mapb-staged\";\n";
  const cases = [
    ["the real js/maps/home.js and js/world.js pass", realHome, [["js/world.js", readFileSync(join(ROOT, "js/world.js"), "utf8")]], false],
    ["the staged file shipped as js/maps/home.js is stopped", staged, [], true],
    ["the preview wrapper shipped as js/maps/home.js is stopped", wrapped, [], true],
    ["a format-2 map registered as the home island is stopped", realHome.replace('"format": 1', '"format": 2'), [], true],
    ["a script switching on the preview flag is stopped", realHome, [["js/extra.js", "window.ISLAND_MAP_PREVIEW = 'mapb-staged';"]], true],
    ["the words in a comment don't stop it", realHome, [["js/extra.js", "/* ISLAND_MAPS_STAGED, \"staged\": true */\n// ISLAND_MAP_PREVIEW = x\nvar a = 1;"]], false]
  ];
  let bad = 0;
  for (const [name, home, scripts, stop] of cases) { const p = stagedMapProblems(home, scripts); const ok = stop ? p.length > 0 : p.length === 0; if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${p.length ? ": " + p.join("; ") : ""}`); }
  process.exit(bad ? 1 : 0);
}
if (CHECK) { await live(); process.exit(0); }
function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

// 1. build
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const a of ALLOW) {
  const src = join(ROOT, a);
  if (!existsSync(src)) continue;
  cpSync(src, join(OUT, a), { recursive: true });
}
const files = walk(OUT).map((p) => relative(OUT, p).split("\\").join("/"));
console.log(`built .deploy/ with ${files.length} files`);

// 2. nothing forbidden, nothing key-shaped
for (const f of files) {
  if (NEVER.some((re) => re.test(f))) fail.push(`must not ship: ${f}`);
  if (TEXT.has(extname(f).toLowerCase())) {
    const body = readFileSync(join(OUT, f), "utf8");
    for (const re of KEYISH) if (re.test(body)) fail.push(`key-shaped string in ${f} (${re})`);
  }
}

// 2b. the staged MAP-B island can't ship
for (const p of stagedMapProblems(readFileSync(join(OUT, "js/maps/home.js"), "utf8"), files.filter((f) => extname(f) === ".js").map((f) => [f, readFileSync(join(OUT, f), "utf8")]))) fail.push(`MAP-B must not ship yet: ${p}`);

// 3. every referenced file exists
const have = new Set(files);
const refs = new Map();
function ref(from, raw) {
  let u = raw.trim().replace(/[?#].*$/, "");
  if (!u || /^(https?:|mailto:|tel:|data:|blob:|javascript:|#|\/\/)/i.test(raw.trim())) return;
  const base = u.startsWith("/") ? "" : dirname(from);
  const dirRef = u.endsWith("/");
  u = join(base, u.replace(/^\//, "")).split("\\").join("/");
  if (u === "." || u === "") u = "index.html";
  else if (dirRef) u += "/index.html";
  if (!refs.has(u)) refs.set(u, from);
}
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (ext !== ".html" && ext !== ".css" && ext !== ".js" && ext !== ".webmanifest") continue;
  const body = readFileSync(join(OUT, f), "utf8");
  if (ext === ".html") {
    for (const m of body.matchAll(/\s(?:src|href)="([^"]+)"/g)) ref(f, m[1]);
    for (const m of body.matchAll(/\ssrcset="([^"]+)"/g)) m[1].split(",").forEach((c) => ref(f, c.trim().split(/\s+/)[0]));
  }
  if (ext === ".css") for (const m of body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) ref(f, m[1]);
  if (ext === ".webmanifest") for (const m of body.matchAll(/"src":\s*"([^"]+)"/g)) ref("index.html", m[1]);
  // scripts load files by path relative to the page, not to themselves
  if (ext === ".js") for (const m of body.matchAll(/["'`]((?:js|css|assets|fonts|img|audio)\/[A-Za-z0-9_./-]+\.[a-z0-9]+)/g)) ref("index.html", m[1]);
}
for (const [u, from] of refs) if (!have.has(u)) fail.push(`missing: ${u} (referenced from ${from})`);
console.log(`checked ${refs.size} references`);

// 4. the meta CSP matches the header's
const hdr = readFileSync(join(OUT, "_headers"), "utf8").match(/Content-Security-Policy:\s*(.+)/);
const norm = (p) => p.split(";").map((d) => d.trim()).filter((d) => d && !/^(frame-ancestors|upgrade-insecure-requests)\b/.test(d)).sort().join("; ");
for (const f of ["index.html", "404.html"]) {
  const meta = readFileSync(join(OUT, f), "utf8").match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!hdr || !meta) fail.push(`CSP missing in ${!hdr ? "_headers" : f}`);
  else if (norm(meta[1]) !== norm(hdr[1])) fail.push(`CSP in ${f} differs from _headers:\n    meta:   ${norm(meta[1])}\n    header: ${norm(hdr[1])}`);
}

if (fail.length) { console.error("\nnot deploying:\n  " + fail.join("\n  ")); process.exit(1); }
console.log("checks passed");
if (DRY) { console.log("dry run: stopping before the deploy"); process.exit(0); }

// 5. deploy, then look at the live site
execSync("npx wrangler deploy", { cwd: ROOT, stdio: "inherit" });
await live();

async function live() {
  const smoke = [];
  const get = (u, o) => fetch(u, o).catch((e) => { smoke.push(`${u}: ${e.cause?.code || e.message}`); return null; });
  const home = await get(SITE + "/", { redirect: "manual" });
  if (home) {
    if (home.status !== 200) smoke.push(`${SITE}/ returned ${home.status}`);
    if (!home.headers.get("content-security-policy")) smoke.push("no Content-Security-Policy header on /");
    if (!home.headers.get("strict-transport-security")) smoke.push("no Strict-Transport-Security header on /");
  }
  const sec = await get(SITE + "/.well-known/security.txt");
  if (sec && sec.status !== 200) smoke.push(`security.txt returned ${sec.status}`);
  const lost = await get(SITE + "/nothing-here-" + Date.now());
  if (lost && lost.status !== 404) smoke.push(`a missing page returned ${lost.status}, not 404`);
  if (smoke.length) { console.error("\nthe live checks failed (a new domain can take a few minutes to resolve; retry with --check):\n  " + smoke.join("\n  ")); process.exit(1); }
  console.log(`live and checked: ${SITE}/`);
}
