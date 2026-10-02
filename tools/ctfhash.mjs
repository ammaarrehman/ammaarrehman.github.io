#!/usr/bin/env node
/* ctfhash: the hash a ctf flag's entry in js/world.js needs (`h`), from its id and its answer.
   The answer is typed at a prompt that doesn't echo it, and it is never printed or written to a
   file, so a real answer never lands in the repo or its history. Prints the normalized length and
   the sha-256 hex; paste the hex into the flag's `h`.

     node tools/ctfhash.mjs ctf-<slug>

   normalize() and hash() are the page's ctfNorm and ctfHash (same rules, same scheme);
   tools/ctf.mjs checks that the two agree. */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const SCHEME = "pi-ctf/1/";
export const ID = /^ctf-[a-z0-9][a-z0-9-]{0,27}$/;

// NFKC, trimmed, wrapping quotes or backticks off, flag{...} optional, lowercase, runs of spaces,
// hyphens and underscores one underscore, none at the ends; a-z, 0-9, _ and . only; 1 to 64 long
export function normalize(s) {
  if (typeof s !== "string" || s.length > 256) return null;
  s = s.normalize("NFKC");
  s = s.trim().replace(/^["'`‘’“”]+|["'`‘’“”]+$/g, "").trim();
  const w = /^flag\{([\s\S]*)\}$/i.exec(s); if (w) s = w[1];
  s = s.toLowerCase().replace(/[\s_-]+/g, "_").replace(/^_+|_+$/g, "");
  return s && s.length <= 64 && /^[a-z0-9_.]+$/.test(s) ? s : null;
}
export function hash(id, answer) {
  const n = normalize(answer);
  return n === null ? null : createHash("sha256").update(SCHEME + id + "/" + n, "utf8").digest("hex");
}

// the answer, read without echoing it
function ask(prompt) {
  return new Promise((resolve) => {
    const inp = process.stdin;
    if (!inp.isTTY) { let buf = ""; inp.setEncoding("utf8"); inp.on("data", (d) => (buf += d)); inp.on("end", () => resolve(buf.replace(/\r?\n$/, ""))); return; }
    process.stdout.write(prompt);
    inp.setRawMode(true); inp.resume(); inp.setEncoding("utf8");
    let s = "";
    inp.on("data", function on(ch) {
      for (const c of ch) {
        if (c === "\r" || c === "\n") { inp.setRawMode(false); inp.pause(); inp.removeListener("data", on); process.stdout.write("\n"); resolve(s); return; }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (c === "\u007f" || c === "\b") s = s.slice(0, -1); else s += c;
      }
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2];
  if (!id || !ID.test(id)) { console.error("usage: node tools/ctfhash.mjs ctf-<slug>   (ctf- and a lowercase name, up to 32 characters)"); process.exit(1); }
  const answer = await ask("answer (not shown): ");
  const n = normalize(answer);
  if (n === null) { console.error("refused: after normalizing, an answer is 1 to 64 of a-z, 0-9, _ and ."); process.exit(1); }
  console.log(`${id}  normalized length ${n.length}\nh: "${hash(id, answer)}"`);
}
