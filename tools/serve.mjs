#!/usr/bin/env node
/* serve: a local static server that behaves like the Cloudflare deploy. It serves the repo root,
   applies every header from _headers, and answers missing paths with 404.html and a 404 status.
   (HSTS and upgrade-insecure-requests are left off locally; they only make sense over https.)

     node tools/serve.mjs            http://localhost:8000
     PORT=8123 node tools/serve.mjs

   Also imported by audit.mjs, which starts it on a spare port. */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".pdf": "application/pdf", ".txt": "text/plain", ".xml": "application/xml"
};

function headers() {
  const out = {};
  for (const line of readFileSync(join(ROOT, "_headers"), "utf8").split("\n")) {
    const m = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (!m || m[1] === "Strict-Transport-Security") continue;
    out[m[1]] = m[1] === "Content-Security-Policy" ? m[2].replace(/;\s*upgrade-insecure-requests/, "") : m[2];
  }
  return out;
}

function file(p) {
  try { const s = statSync(p); return s.isDirectory() ? file(join(p, "index.html")) : p; } catch { return null; }
}

export function serve(port = 8000) {
  const H = headers();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const safe = normalize(join(ROOT, path));
    // nothing outside the repo, and none of the files the deploy never ships
    const blocked = !safe.startsWith(ROOT) || /(^|\/)(\.git|tools|docs|node_modules)(\/|$)|\.md$|wrangler\.|_headers$/.test(path);
    let p = blocked ? null : file(safe), status = 200;
    if (!p) { p = join(ROOT, "404.html"); status = 404; }
    res.writeHead(status, { ...H, "Content-Type": TYPES[extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : readFileSync(p));
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  await serve(port);
  console.log(`serving the site at http://localhost:${port}/ (Ctrl+C to stop)`);
}
