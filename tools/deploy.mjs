#!/usr/bin/env node
/* deploy: builds .deploy/ from an allowlist, checks it, deploys it to Cloudflare, then checks
   the live site. Nothing ships unless it's on the list below.

     node tools/deploy.mjs              build, check, deploy, smoke-test
     node tools/deploy.mjs --dry-run    build and check only (no Cloudflare account needed)

   It stops (exit 1) if:
     - a file the pages reference (html src/href/srcset, css url(), js paths) is missing
     - anything that must never ship is in .deploy/: *.md, tools/, .git, *.env, wrangler.*
     - any file contains something shaped like a key: ghp_, github_pat_, -----BEGIN
     - the CSP in the <meta> tags doesn't match the one in _headers (the header may add
       frame-ancestors and upgrade-insecure-requests, which a meta tag can't or shouldn't carry)
   The deploy itself needs `npx wrangler login` once (see docs/hosting.md). No token is stored. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".deploy");
const SITE = "https://ammaarrehman.com";
const DRY = process.argv.includes("--dry-run");

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
const smoke = [];
const home = await fetch(SITE + "/", { redirect: "manual" });
if (home.status !== 200) smoke.push(`${SITE}/ returned ${home.status}`);
if (!home.headers.get("content-security-policy")) smoke.push("no Content-Security-Policy header on /");
if (!home.headers.get("strict-transport-security")) smoke.push("no Strict-Transport-Security header on /");
const sec = await fetch(SITE + "/.well-known/security.txt");
if (sec.status !== 200) smoke.push(`security.txt returned ${sec.status}`);
const lost = await fetch(SITE + "/nothing-here-" + Date.now());
if (lost.status !== 404) smoke.push(`a missing page returned ${lost.status}, not 404`);
if (smoke.length) { console.error("\ndeployed, but the live checks failed:\n  " + smoke.join("\n  ")); process.exit(1); }
console.log(`live and checked: ${SITE}/`);
