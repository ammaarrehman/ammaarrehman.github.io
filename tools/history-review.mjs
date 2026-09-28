#!/usr/bin/env node
/* history-review: the read-only pre-publication scan (handoff 3 C2, Phase 7). Before a repo the site
   links to goes public, look at everything publishing would expose: every commit on every ref, not
   only the current files. An old commit is published with the repo, so it is scanned like the rest.

   For each repo it keeps a bare mirror under <out>/cache/<source>/ (fetched again on later runs,
   never deleted) and reports:
     secrets    gitleaks over the full history; reduced to rule, file, line and commit
     content    every text blob ever committed, and the printable strings inside binaries (EXIF, XMP,
                PNG text, PDF info): private IPv4, CGNAT/Tailscale IPv4, private, link-local and
                Tailscale IPv6, MACs, *.ts.net names, local hostnames, machine and device names,
                user@host prompts, local and machine paths, email addresses, public IPv4, private keys
     paths      file names, symlink targets and ref names, matched against the same patterns
     metadata   author, committer and tagger names and emails; commit and tag messages
     binaries   every image and binary blob ever committed, for review by eye (text drawn in a
                screenshot can't be scanned), with any metadata blocks found in it
     mirror     GitHub and GitLab refs compared with git ls-remote

   Read-only: git init/fetch into its own cache and ls-remote; nothing is pushed, rewritten, deleted
   or fixed. Every value in the output is masked: a shape that keeps no more than the category says
   (192.168.x.x, •••.ts.net) and a fingerprint (an HMAC whose salt exists only for this run), so
   repeats can be counted without the value being readable.

     node tools/history-review.mjs                       the four repos the site links to, from GitHub
     node tools/history-review.mjs --repos=trading-lab   some of them
     node tools/history-review.mjs --from=gitlab         scan the GitLab copies instead
     --github=<base> --gitlab=<base>                     another owner URL, or a folder of bare <name>.git repos
     --no-mirror                                         skip the GitHub/GitLab comparison
     --out=<dir>                                         default tools/out/history-review (gitignored)

   Writes summary.md (masked counts, identities, mirror state and findings: the file to share),
   binaries.md (the by-eye checklist) and report.json (everything, masked). Exits 0 when every part
   ran, 2 when a part couldn't (gitleaks missing, a repo or the mirror unreachable), 1 on a crash.
   Findings are candidates to triage, so they don't change the exit code. */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, resolve, extname } from "node:path";

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a === undefined ? undefined : a.slice(k.length + 3); };
const REPOS = (arg("repos") || "homelab,trading-lab,claude-intake-triage,ammaarrehman.github.io").split(",").filter(Boolean);
const BASES = { github: arg("github") || "https://github.com/ammaarrehman", gitlab: arg("gitlab") || "https://gitlab.com/ammaarrehman" };
const FROM = arg("from") || "github";
if (!BASES[FROM]) { console.error("--from must be github or gitlab"); process.exit(1); }
const MIRROR = !process.argv.includes("--no-mirror");
const OUT = resolve(arg("out") || fileURLToPath(new URL("./out/history-review/", import.meta.url)));
const CACHE = join(OUT, "cache", FROM);
mkdirSync(CACHE, { recursive: true });
const SALT = randomBytes(32);
// never prompt for a password (a private GitLab project without stored credentials is reported as
// unreachable instead), and ignore any gitleaks config from the environment
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };
delete ENV.GITLEAKS_CONFIG;

// addresses the site already publishes: found, but marked as already public
const PUBLIC_EMAILS = new Set(["ammaarrehmanf@gmail.com"]);
const RESOLVERS = new Set(["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9", "149.112.112.112", "208.67.222.222", "208.67.220.220", "94.140.14.14", "94.140.15.15"]);
const SEVERITY = {
  "secret": "high", "private-key": "high", "private-ipv4": "high", "cgnat-ipv4": "high", "tailscale-ipv6": "high", "tailscale-hostname": "high",
  "mac": "high", "machine-name": "high", "local-path": "high", "email-machine-host": "high",
  "private-ipv6": "medium", "local-hostname": "medium", "user-at-host": "medium", "email": "medium",
  "link-local-ipv4": "low", "link-local-ipv6": "low", "public-ipv4": "low",
  "email-public": "info", "email-noreply": "info"
};

function git(args, opts = {}) {
  const r = spawnSync("git", args, { env: ENV, maxBuffer: 1 << 30, ...opts });
  return { ok: r.status === 0, status: r.status, out: r.stdout, err: r.stderr };
}
const gitText = (dir, args) => { const r = git(["--git-dir", dir, ...args], { encoding: "utf8" }); return r.ok ? r.out : null; };
const url = (base, name) => (/^[a-z]+:\/\//i.test(base) ? `${base.replace(/\/$/, "")}/${name}.git` : join(resolve(base), name + ".git"));
const fp = (v) => createHmac("sha256", SALT).update(String(v).toLowerCase()).digest("hex").slice(0, 10);
const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");

/* ── the patterns: each match becomes { cat, shape, value, index, length } ── */
function ipv4(a, b, c, d) {
  if ([a, b, c, d].some((n) => n > 255)) return null;
  if (a === 10) return ["private-ipv4", "10.x.x.x"];
  if (a === 172 && b >= 16 && b <= 31) return ["private-ipv4", "172.16-31.x.x"];
  if (a === 192 && b === 168) return ["private-ipv4", "192.168.x.x"];
  if (a === 100 && b >= 64 && b <= 127) return ["cgnat-ipv4", "100.64-127.x.x (CGNAT, Tailscale)"];
  if (a === 169 && b === 254) return ["link-local-ipv4", "169.254.x.x"];
  if (a === 0 || a === 127 || a >= 224) return null;                                  // this host, loopback, multicast, reserved
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return null;   // RFC 5737
  if (a === 198 && (b === 18 || b === 19)) return null;                              // benchmarking
  if (RESOLVERS.has(`${a}.${b}.${c}.${d}`)) return null;
  return ["public-ipv4", "x.x.x.x"];
}
function ipv6(tok) {
  if ((tok.match(/::/g) || []).length > 1) return null;
  const groups = tok.split(":");
  if (groups.length > 8 || groups.some((g) => g.length > 4)) return null;
  const first = parseInt(groups[0] || "0", 16);
  // Tailscale's fixed prefix, compared as numbers so this file doesn't match its own pattern
  if (groups.length > 3 && [0xfd7a, 0x115c, 0xa1e0].every((n, i) => parseInt(groups[i], 16) === n)) return ["tailscale-ipv6", "(Tailscale prefix):… (Tailscale)"];
  if (first >= 0xfc00 && first <= 0xfdff && groups[0].length === 4) return ["private-ipv6", `${groups[0].slice(0, 2).toLowerCase()}xx:… (ULA)`];
  if (first >= 0xfe80 && first <= 0xfebf && groups[0].length === 4) return ["link-local-ipv6", "fe80:… (link-local)"];
  return null;
}
function emailClass(v) {
  const lower = v.toLowerCase(), dom = lower.split("@")[1] || "";
  const tld = (dom.match(/\.([a-z]{2,})$/) || [])[1];
  if (/^git@(github|gitlab)\.com$/.test(lower)) return null;                         // an ssh remote, not an address
  if (/^(example\.(com|org|net)|[a-z0-9.-]*\.example)$/.test(dom)) return null;       // RFC 2606
  if (/noreply/.test(lower)) return ["email-noreply", "•••@noreply"];                // GitHub's users.noreply and web-flow noreply@github.com
  if (PUBLIC_EMAILS.has(lower)) return ["email-public", "•••@•••.com (the site's public contact)"];
  if (!tld || /\.(local|lan|internal|localdomain|home|home\.arpa)$/.test(dom) || /macbook|mac-mini|imac|mac-studio|desktop-|laptop-|raspberry(?:pi)/i.test(dom))
    return ["email-machine-host", "•••@<machine host>"];
  return ["email", `•••@•••.${tld}`];
}
const RULES = [
  [/(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\.?\d)/g, (m) => ipv4(+m[1], +m[2], +m[3], +m[4])],
  [/(?<![0-9A-Za-z:])[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{0,4}){2,7}(?![0-9A-Za-z:])/g, (m) => ipv6(m[0])],
  [/(?<![0-9A-Fa-f:-])[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])/g,
    (m) => (/^(00[:-]){5}00$|^(ff[:-]){5}ff$/i.test(m[0]) ? null : ["mac", "xx:xx:xx:xx:xx:xx"])],
  [/\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.ts\.net\b/gi, () => ["tailscale-hostname", "•••.ts.net"]],
  [/\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(local|lan|internal|intranet|localdomain|home\.arpa|home|corp)\b(?![.-]?\w)/gi,
    (m) => ["local-hostname", `•••.${m[1].toLowerCase()}`]],
  [/\b[A-Za-z0-9][A-Za-z0-9-]*-(MacBook(?:-Pro|-Air)?|Mac-mini|Mac-Pro|Mac-Studio|iMac|mbp|MBP)\b/g, (m) => ["machine-name", `•••-${m[1]}`]],
  [/\b[A-Z][A-Za-z]+['’]s (MacBook(?: Pro| Air)?|Mac mini|Mac Studio|iMac|iPhone|iPad)\b/g, (m) => ["machine-name", `•••'s ${m[1]}`]],
  [/\b(?:DESKTOP|LAPTOP)-[A-Z0-9]{5,}\b|\braspberrypi\b|\bhomelab-[a-z]+-\d+\b/gi, () => ["machine-name", "••• (device name)"]],
  [/\b[a-z_][a-z0-9_.-]{0,31}@[A-Za-z0-9][A-Za-z0-9.-]{0,62}(?=[:\s][^\n]{0,40}?[%$#](?:\s|$))/g, () => ["user-at-host", "•••@••• (shell prompt)"]],
  [/(?:\/Users\/|\/home\/|\/var\/home\/|\/Volumes\/|[A-Za-z]:\\{1,2}Users\\{1,2})([^/\\\s"'`<>:;,)]+)/g,
    (m) => (/^(user|runner|ubuntu|shared|runneradmin|\$\w+|\$\{\w+\}|<[^>]*|\*|\.\.\.)$/i.test(m[1]) ? null : ["local-path", m[0].replace(m[1], "•••")])],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, (m) => emailClass(m[0])],
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g, () => ["private-key", "-----BEGIN … PRIVATE KEY-----"]]
];
// every match in a string; where matches overlap (an email whose domain is a machine name) the
// longest wins, so one string is one finding
function detect(text) {
  const hits = [];
  for (const [re, classify] of RULES) for (const m of text.matchAll(re)) {
    const c = classify(m); if (c) hits.push({ cat: c[0], shape: c[1], value: m[0], index: m.index, length: m[0].length });
  }
  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const kept = []; let end = -1;
  for (const h of hits) if (h.index >= end) { kept.push(h); end = h.index + h.length; }
  return kept;
}
// a path, ref or name with every sensitive part replaced by its shape
function redact(s) {
  let out = s;
  for (const h of detect(s).reverse()) out = out.slice(0, h.index) + `[${h.shape}]` + out.slice(h.index + h.length);
  return out;
}

/* ── mirroring (read-only against the source) ── */
function mirror(name) {
  const dir = join(CACHE, name + ".git"), src = url(BASES[FROM], name);
  // init on an existing folder only re-initialises it, so a rerun or an interrupted clone just fetches again
  if (!git(["init", "--quiet", "--bare", dir]).ok) return { dir, error: "could not create the cache folder" };
  const f = git(["--git-dir", dir, "fetch", "--quiet", "--prune", "--update-shallow", "--no-write-fetch-head", src, "+refs/*:refs/*"]);
  if (!f.ok) return { dir, error: `fetch from ${FROM} failed (status ${f.status}: no access, or no such repo)` };
  // a fetch can succeed and still bring nothing, or only part of the history: neither is a clean scan
  if (!(gitText(dir, ["for-each-ref", "--count=1", "--format=%(refname)"]) || "").trim()) return { dir, error: `fetch from ${FROM} brought no refs` };
  if ((gitText(dir, ["rev-parse", "--is-shallow-repository"]) || "").trim() === "true") return { dir, error: `the ${FROM} copy is shallow, so its history is incomplete; scan a full clone` };
  const head = git(["ls-remote", "--symref", src, "HEAD"], { encoding: "utf8" });
  const def = head.ok && (head.out.match(/^ref: (refs\/heads\/\S+)\tHEAD/m) || [])[1];
  if (def) git(["--git-dir", dir, "symbolic-ref", "HEAD", def]);
  return { dir, defaultBranch: def ? def.replace("refs/heads/", "") : null };
}
function lsRemote(src) {
  const r = git(["ls-remote", src], { encoding: "utf8" });
  if (!r.ok) return null;
  const refs = new Map();
  for (const line of r.out.trim().split("\n").filter(Boolean)) { const [sha, ref] = line.split("\t"); refs.set(ref, sha); }
  return refs;
}
const PLATFORM = /^refs\/(pull|merge-requests|keep-around|environments|pipelines)\//;
function compareMirror(name) {
  const gh = lsRemote(url(BASES.github, name)), gl = lsRemote(url(BASES.gitlab, name));
  const side = (m) => (m ? { reachable: true, refs: [...m.keys()].filter((r) => !PLATFORM.test(r) && r !== "HEAD").length, platformRefs: [...m.keys()].filter((r) => PLATFORM.test(r)).length } : { reachable: false });
  const res = { github: side(gh), gitlab: side(gl), onlyGithub: [], onlyGitlab: [], differ: [] };
  if (!gh || !gl) return res;
  const names = new Set([...gh.keys(), ...gl.keys()].filter((r) => !PLATFORM.test(r)));
  for (const ref of [...names].sort()) {
    const a = gh.get(ref), b = gl.get(ref), safe = redact(ref);
    if (a && !b) res.onlyGithub.push(safe); else if (b && !a) res.onlyGitlab.push(safe);
    else if (a !== b) res.differ.push({ ref: safe, github: a.slice(0, 10), gitlab: b.slice(0, 10) });
  }
  return res;
}

/* ── what's in the history ── */
// every blob any commit on any ref added or changed (merges against each parent), with its paths,
// modes and the commits that touched it
function blobIndex(dir) {
  const r = git(["--git-dir", dir, "-c", "core.quotePath=false", "log", "--all", "-m", "--raw", "--no-abbrev", "--no-renames", "-z", "--format=%x01%H%x02%ct"], { encoding: "utf8" });
  const blobs = new Map(), gitlinks = [];
  if (!r.ok) return { blobs, gitlinks };
  const tok = r.out.split("\0");
  let commit = null, time = 0;
  for (let i = 0; i < tok.length; i++) {
    const t = tok[i].replace(/^\n+/, "");
    if (t.startsWith("\x01")) { [commit, time] = t.slice(1).split("\x02"); time = +time; continue; }
    if (!t.startsWith(":")) continue;
    const [, newMode, , newSha, status] = t.slice(1).split(" "), path = tok[++i];
    if (status === "D" || /^0+$/.test(newSha)) continue;
    if (newMode === "160000") { gitlinks.push({ path, sha: newSha, commit, time }); continue; }
    const b = blobs.get(newSha) || { paths: new Set(), modes: new Set(), first: null, last: null };
    b.paths.add(path); b.modes.add(newMode);
    if (!b.first || time < b.first.time) b.first = { commit, time };
    if (!b.last || time > b.last.time) b.last = { commit, time };
    blobs.set(newSha, b);
  }
  // anything reachable that no commit diff introduced (a tag pointing straight at a blob)
  const all = gitText(dir, ["rev-list", "--objects", "--all"]) || "";
  const types = git(["--git-dir", dir, "cat-file", "--batch-check=%(objectname) %(objecttype)"], { input: all.split("\n").map((l) => l.split(" ")[0]).filter(Boolean).join("\n") + "\n", encoding: "utf8" });
  const isBlob = new Set((types.out || "").split("\n").filter((l) => l.endsWith(" blob")).map((l) => l.split(" ")[0]));
  for (const line of all.split("\n")) {
    const [oid, ...p] = line.split(" ");
    if (isBlob.has(oid) && !blobs.has(oid)) blobs.set(oid, { paths: new Set([p.join(" ") || "(no path)"]), modes: new Set(["100644"]), first: null, last: null });
  }
  return { blobs, gitlinks };
}
function* readBlobs(dir, oids) {
  for (let i = 0; i < oids.length; i += 200) {
    const chunk = oids.slice(i, i + 200);
    const r = git(["--git-dir", dir, "cat-file", "--batch"], { input: chunk.join("\n") + "\n" });
    let at = 0; const buf = r.out;
    while (buf && at < buf.length) {
      const nl = buf.indexOf(10, at), [oid, type, size] = buf.subarray(at, nl).toString().split(" ");
      at = nl + 1;
      if (type === "missing") continue;
      yield [oid, buf.subarray(at, at + +size)];
      at += +size + 1;
    }
  }
}
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".bmp", ".tif", ".tiff", ".ico", ".svg", ".psd"]);
function kindOf(buf, paths) {
  const h = buf.subarray(0, 12).toString("latin1");
  if (h.startsWith("\x89PNG")) return "PNG image";
  if (h.startsWith("\xff\xd8\xff")) return "JPEG image";
  if (h.startsWith("GIF8")) return "GIF image";
  if (h.startsWith("RIFF") && h.slice(8, 12) === "WEBP") return "WebP image";
  if (h.startsWith("%PDF")) return "PDF";
  if (h.startsWith("PK\x03\x04")) return "zip-based archive or document";
  if (h.startsWith("wOFF") || h.startsWith("wOF2")) return "web font";
  const ext = extname([...paths][0] || "").toLowerCase();
  if (IMAGE_EXT.has(ext)) return `${ext.slice(1).toUpperCase()} image`;
  return ext ? `binary (${ext})` : "binary";
}
function metadataFlags(buf) {
  const s = buf.toString("latin1"), f = [];
  if (s.includes("Exif\0\0") || s.includes("eXIf") || (s.startsWith("RIFF") && s.includes("EXIF"))) f.push("EXIF (check GPS, camera, owner)");
  if (s.includes("<x:xmpmeta") || s.includes("ns.adobe.com/xap/")) f.push("XMP");
  if (s.startsWith("\x89PNG") && /tEXt|iTXt|zTXt/.test(s)) f.push("PNG text chunks");
  if (s.startsWith("%PDF") && /\/(Author|Producer|Creator|Title)\s*\(/.test(s)) f.push("PDF info fields");
  return f;
}
// printable ASCII runs of 6 or more inside a binary, with their byte offsets
function* strings(buf) {
  let start = -1;
  for (let i = 0; i <= buf.length; i++) {
    const c = i < buf.length ? buf[i] : 0;
    if (c === 9 || (c >= 32 && c < 127)) { if (start < 0) start = i; }
    else { if (start >= 0 && i - start >= 6) yield [start, buf.subarray(start, i).toString("latin1")]; start = -1; }
  }
}

function gitleaks(dir, name) {
  const report = join(OUT, `${name}-gitleaks.json`), common = ["--no-banner", "--log-opts=--all", "--redact=100", "--ignore-gitleaks-allow", "--report-format=json", "--report-path=" + report];
  let r = spawnSync("gitleaks", ["git", ...common, dir], { env: ENV, cwd: OUT, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.error) return { blocked: "gitleaks is not installed (brew install gitleaks)" };
  if (![0, 1].includes(r.status)) r = spawnSync("gitleaks", ["detect", "--source", dir, ...common], { env: ENV, cwd: OUT, encoding: "utf8", maxBuffer: 1 << 28 });   // before 8.19
  if (![0, 1].includes(r.status)) return { blocked: `gitleaks failed (status ${r.status}); output withheld` };
  let found = [];
  try { found = JSON.parse(readFileSync(report, "utf8")); } catch { return { blocked: "gitleaks wrote no readable report" }; }
  // keep where and which rule; drop the match, the line, the author and the message
  const reduced = found.map((f) => ({ rule: f.RuleID, path: redact(f.File || ""), line: f.StartLine, commit: (f.Commit || "").slice(0, 10), date: (f.Date || "").slice(0, 10) }));
  writeFileSync(report, JSON.stringify(reduced, null, 2));
  return { findings: reduced };
}

function scan(name) {
  const repo = { name, source: FROM, blocked: [], findings: [], binaries: [], gitlinks: [], identities: [], lfs: false };
  const m = mirror(name);
  if (m.error) { repo.blocked.push(m.error); return repo; }
  const dir = m.dir;
  repo.defaultBranch = m.defaultBranch;
  repo.refs = (gitText(dir, ["for-each-ref", "--format=%(refname)"]) || "").trim().split("\n").filter(Boolean).length;
  repo.commits = +(gitText(dir, ["rev-list", "--all", "--count"]) || 0);
  const head = new Set((gitText(dir, ["ls-tree", "-r", "HEAD"]) || "").split("\n").map((l) => l.split(/\s+/)[2]).filter(Boolean));
  if (!head.size) repo.blocked.push("no default-branch tree, so 'at HEAD' is unknown");
  const add = (f) => repo.findings.push({ severity: SEVERITY[f.cat] || "medium", ...f, value: undefined, fingerprint: fp(f.value) });

  const { blobs, gitlinks } = blobIndex(dir);
  repo.gitlinks = gitlinks.map((g) => ({ path: redact(g.path), sha: g.sha.slice(0, 10), commit: g.commit.slice(0, 10) }));
  let text = 0, binary = 0;
  for (const [oid, buf] of readBlobs(dir, [...blobs.keys()])) {
    const b = blobs.get(oid), paths = [...b.paths].map(redact), atHead = head.has(oid);
    const where = { blob: oid.slice(0, 10), paths, atHead, first: b.first && b.first.commit.slice(0, 10), firstDate: day(b.first && b.first.time) };
    const isBinary = buf.subarray(0, 8000).includes(0);
    const ext = extname([...b.paths][0] || "").toLowerCase();
    if (buf.subarray(0, 60).toString("latin1").startsWith("version https://git-lfs")) {
      repo.lfs = true;
      repo.binaries.push({ ...where, kind: "Git LFS pointer (the file itself isn't in git; review it separately)", size: buf.length, metadata: [] });
      continue;
    }
    if (isBinary || IMAGE_EXT.has(ext)) {
      repo.binaries.push({ ...where, kind: isBinary ? kindOf(buf, b.paths) : `${ext.slice(1).toUpperCase()} image (text, also scanned)`, size: buf.length, metadata: isBinary ? metadataFlags(buf) : [] });
    }
    if (isBinary) {
      binary++;
      for (const [offset, s] of strings(buf)) for (const h of detect(s)) add({ source: "binary-strings", cat: h.cat, shape: h.shape, value: h.value, ...where, offset });
      continue;
    }
    text++;
    const symlink = b.modes.has("120000");
    buf.toString("utf8").split("\n").forEach((line, i) => {
      for (const h of detect(line)) add({ source: symlink ? "symlink-target" : "content", cat: h.cat, shape: h.shape, value: h.value, ...where, line: i + 1 });
    });
  }
  repo.textBlobs = text; repo.binaryBlobs = binary;

  // names on disk and ref names
  for (const [oid, b] of blobs) for (const p of b.paths) for (const h of detect(p)) add({ source: "path", cat: h.cat, shape: h.shape, value: h.value, blob: oid.slice(0, 10), paths: [redact(p)], atHead: head.has(oid) });
  for (const ref of (gitText(dir, ["for-each-ref", "--format=%(refname)"]) || "").split("\n").filter(Boolean)) for (const h of detect(ref)) add({ source: "ref-name", cat: h.cat, shape: h.shape, value: h.value, ref: redact(ref) });

  // who and what the commits and tags say. each address is one identity (one finding, however many
  // commits carry it), with its roles, commit count and dates
  const ids = new Map();
  const identity = (email, role, commit, time) => {
    const key = email.toLowerCase(), c = email.includes("@") ? emailClass(email) : ["email-machine-host", "<no @: a bare user or host name>"];
    const id = ids.get(key) || { value: email, c, shape: c ? c[1] : "(RFC 2606 example)", class: c ? c[0] : "example", fingerprint: fp(email), roles: new Set(), commitSet: new Set(), first: time, last: time, firstCommit: commit };
    id.roles.add(role); id.commitSet.add(commit);
    if (time < id.first) { id.first = time; id.firstCommit = commit; }
    id.last = Math.max(id.last, time);
    ids.set(key, id);
  };
  const log = gitText(dir, ["log", "--all", "--format=%H%x1f%ct%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e"]) || "";
  for (const rec of log.split("\x1e")) {
    const [h, t, an, ae, cn, ce, body] = rec.replace(/^\n/, "").split("\x1f");
    if (!h) continue;
    identity(ae, "author", h, +t); identity(ce, "committer", h, +t);
    for (const [field, v] of [["author-name", an], ["committer-name", cn], ["message", body || ""]])
      v.split("\n").forEach((line, i) => { for (const h2 of detect(line)) add({ source: field, cat: h2.cat, shape: h2.shape, value: h2.value, commit: h.slice(0, 10), date: day(+t), line: field === "message" ? i + 1 : undefined }); });
  }
  const tags = gitText(dir, ["for-each-ref", "refs/tags", "--format=%(refname)%1f%(taggername)%1f%(taggeremail)%1f%(taggerdate:unix)%1f%(contents)%1e"]) || "";
  for (const rec of tags.split("\x1e")) {
    const [ref, tn, te, td, body] = rec.replace(/^\n/, "").split("\x1f");
    if (!ref || !te) continue;                                                   // lightweight tags have no tagger
    identity(te.replace(/^<|>$/g, ""), "tagger", "tag", +td || 0);
    for (const [field, v] of [["tagger-name", tn], ["tag-message", body || ""]]) for (const h of detect(v)) add({ source: field, cat: h.cat, shape: h.shape, value: h.value, ref: redact(ref) });
  }
  for (const i of ids.values()) if (i.c && SEVERITY[i.c[0]] !== "info")
    add({ source: `${[...i.roles].join("/")}-email`, cat: i.c[0], shape: i.c[1], value: i.value, commit: String(i.firstCommit).slice(0, 10), date: day(i.first), commits: i.commitSet.size });
  repo.identities = [...ids.values()].map(({ value, c, commitSet, firstCommit, ...i }) => ({ ...i, roles: [...i.roles], commits: commitSet.size, first: day(i.first), last: day(i.last) }));

  const gl = gitleaks(dir, name);
  if (gl.blocked) repo.blocked.push(gl.blocked);
  for (const f of gl.findings || []) repo.findings.push({ severity: "high", source: "gitleaks", cat: "secret", shape: `[${f.rule}]`, paths: [f.path], line: f.line, commit: f.commit, date: f.date });
  if (repo.lfs) repo.blocked.push("Git LFS files aren't fetched; review them separately");
  if (MIRROR) {
    repo.mirror = compareMirror(name);
    if (!repo.mirror.github.reachable) repo.blocked.push("GitHub refs not readable (no access?)");
    if (!repo.mirror.gitlab.reachable) repo.blocked.push("GitLab refs not readable (no access, or the project is private and this Mac has no GitLab credentials)");
  }
  return repo;
}

/* ── reports ── */
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
function summary(report) {
  const L = [`# Pre-publication history review`, ``, `Run ${report.when}. Source: ${report.source}. Every value is masked; fingerprints only match within this run.`, ``,
    `Candidates to triage, not verdicts. History-only findings are still published with the repo.`, ``];
  for (const r of report.repos) {
    L.push(`## ${r.name}`, "");
    if (r.blocked.length) L.push(...r.blocked.map((b) => `- **Blocked:** ${b}`), "");
    if (r.commits === undefined) continue;
    L.push(`${r.commits} commits on ${r.refs} refs (default branch: ${r.defaultBranch || "unknown"}); ${r.textBlobs} text and ${r.binaryBlobs} binary blobs; ${r.binaries.length} files for review by eye (binaries.md); ${r.gitlinks.length} submodule links.`, "");
    const byCat = new Map();
    for (const f of r.findings) {
      const c = byCat.get(f.cat) || { severity: f.severity, n: 0, distinct: new Set(), head: 0, history: 0 };
      c.n++; c.distinct.add(f.fingerprint || f.shape); if (f.atHead) c.head++; else if (f.atHead === false) c.history++;
      byCat.set(f.cat, c);
    }
    const order = ["high", "medium", "low", "info"];
    L.push("| Category | Severity | Occurrences | Distinct values | In current files | History only |", "|---|---|---|---|---|---|");
    for (const [cat, c] of [...byCat].sort((a, b) => order.indexOf(a[1].severity) - order.indexOf(b[1].severity) || a[0].localeCompare(b[0])))
      L.push(`| ${cat} | ${c.severity} | ${c.n} | ${c.distinct.size} | ${c.head} | ${c.history} |`);
    if (!byCat.size) L.push("| (none) | | | | | |");
    L.push("", "Identities in commit and tag metadata:", "", "| Address (masked) | Class | Fingerprint | Roles | Commits | First | Last |", "|---|---|---|---|---|---|---|");
    for (const i of r.identities) L.push(`| ${esc(i.shape)} | ${i.class} | ${i.fingerprint} | ${i.roles.join(", ")} | ${i.commits} | ${i.first} | ${i.last} |`);
    if (r.mirror) {
      const m = r.mirror;
      L.push("", `Mirror: GitHub ${m.github.reachable ? `${m.github.refs} refs (+${m.github.platformRefs} pull refs)` : "not readable"}, GitLab ${m.gitlab.reachable ? `${m.gitlab.refs} refs (+${m.gitlab.platformRefs} merge-request/keep-around refs)` : "not readable"}.`);
      if (m.github.reachable && m.gitlab.reachable) {
        if (!m.onlyGithub.length && !m.onlyGitlab.length && !m.differ.length) L.push("Branches and tags match.");
        for (const x of m.onlyGithub) L.push(`- only on GitHub: \`${x}\``);
        for (const x of m.onlyGitlab) L.push(`- only on GitLab: \`${x}\` (published with GitLab, but not scanned from GitHub: rerun with --from=gitlab)`);
        for (const x of m.differ) L.push(`- differs: \`${x.ref}\` GitHub ${x.github}, GitLab ${x.gitlab}`);
      }
    }
    const rows = r.findings.filter((f) => f.severity !== "info");
    L.push("", `Findings (${rows.length}${rows.length > 500 ? ", first 500; all in report.json" : ""}):`, "", "| Severity | Category | Masked | Fingerprint | Where | Line or offset | Current or history | This version first seen |", "|---|---|---|---|---|---|---|---|");
    for (const f of rows.slice(0, 500)) {
      const where = f.source === "gitleaks" ? `gitleaks: ${f.paths[0]}` : f.paths ? `${f.source}: ${f.paths.join(", ")}` : f.ref ? `${f.source}: ${f.ref}` : `${f.source}: commit ${f.commit}${f.commits ? ` (on ${f.commits} commits)` : ""}`;
      L.push(`| ${f.severity} | ${f.cat} | ${esc(f.shape)} | ${f.fingerprint || ""} | ${esc(where)} | ${f.line ?? (f.offset !== undefined ? "byte " + f.offset : "")} | ${f.atHead ? "current" : f.atHead === false ? "history only" : ""} | ${f.first || f.commit || ""} ${f.firstDate || f.date || ""} |`);
    }
    L.push("");
  }
  L.push("## Not inspected", "", ...report.limits.map((l) => `- ${l}`), "");
  return L.join("\n");
}
function binariesList(report) {
  const L = ["# Files to review by eye", "", "Every image and binary blob ever committed. Text drawn in a screenshot can't be scanned: open each one (`git --git-dir <cache> cat-file blob <blob> > file`) and look for addresses, hostnames, prompts, account names, tabs and avatars. Tick when checked.", ""];
  for (const r of report.repos) {
    L.push(`## ${r.name} (${r.binaries.length})`, "");
    if (!r.binaries.length) { L.push("None.", ""); continue; }
    L.push("| ✓ | Path(s) | Kind | Size | Metadata found | Current or history | Blob | First seen |", "|---|---|---|---|---|---|---|---|");
    for (const b of [...r.binaries].sort((a, c) => a.paths[0].localeCompare(c.paths[0])))
      L.push(`| [ ] | ${esc(b.paths.join("<br>"))} | ${b.kind} | ${(b.size / 1024).toFixed(1)} KB | ${b.metadata.join(", ") || "none found"} | ${b.atHead ? "current" : "history only"} | ${b.blob} | ${b.first || ""} ${b.firstDate || ""} |`);
    L.push("");
  }
  return L.join("\n");
}

const report = {
  when: new Date().toISOString(), source: FROM, repos: [],
  limits: [
    "Text inside images (screenshots) and scanned PDFs: listed in binaries.md for review by eye.",
    "Git LFS objects and submodule contents: listed, not fetched.",
    "Objects the host keeps outside any ref (deleted branches, force-pushed commits, cached forks) may still be reachable there by hash; only what the refs reach is scanned.",
    "Issues, merge requests, wikis, CI logs, releases and project settings on GitHub or GitLab.",
    "Values written in unusual forms (split across lines, encoded, hex or base64, obfuscated) and hostnames without a telltale suffix or model name.",
    "Whether a value is sensitive: a private address in a tutorial and a real one look the same. Triage each finding.",
    "Fingerprints use a salt that is thrown away, so they can't be compared between runs or reversed."
  ]
};
let crashed = false;
for (const name of REPOS) {
  try { report.repos.push(scan(name)); }
  catch (e) { crashed = true; report.repos.push({ name, blocked: ["crashed: " + String(e.message).split("\n")[0].slice(0, 200)], findings: [], binaries: [], gitlinks: [], identities: [] }); }
  const r = report.repos.at(-1);
  console.log(`${name.padEnd(24)} ${r.commits ?? "-"} commits, ${r.findings.filter((f) => f.severity !== "info").length} findings (${r.findings.filter((f) => f.severity === "high").length} high), ${r.binaries.length} to review by eye${r.blocked.length ? `, ${r.blocked.length} blocked` : ""}`);
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, (k, v) => (v instanceof Set ? [...v] : v), 2));
writeFileSync(join(OUT, "summary.md"), summary(report));
writeFileSync(join(OUT, "binaries.md"), binariesList(report));
const blocked = report.repos.some((r) => r.blocked.length);
console.log(`\nwrote summary.md, binaries.md and report.json in ${OUT}${blocked ? "\nsome parts couldn't run: see 'Blocked' in summary.md" : ""}`);
process.exit(crashed ? 1 : blocked ? 2 : 0);
