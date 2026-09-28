#!/usr/bin/env node
/* history-review.test: builds a throwaway repo in the system temp folder with planted values, a
   deleted file, a symlink, a PNG with a text chunk, a machine-named author, a tag and a GitLab copy
   that has drifted, then runs tools/history-review.mjs on it (twice, and once from the GitLab copy).
   Checks every category is found, no planted value appears anywhere in the output, reruns work
   over the old cache, and the fixture "remotes" are never changed.

     node tools/history-review.test.mjs        exits 1 on any failure

   The planted values are assembled at runtime so this file itself holds none of them. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("./history-review.mjs", import.meta.url));
const FX = mkdtempSync(join(tmpdir(), "history-review-test-"));
const fails = [];
const check = (what, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${!ok && detail ? "  (" + detail + ")" : ""}`); if (!ok) fails.push(what); };
const j = (...p) => p.join("");

// the planted values (fake; only ever written inside the temp folder)
const P = {
  ipv4: [10, 23, 45, 67].join("."),
  cgnat: [100, 88, 1, 2].join("."),
  mac: ["0a", "1b", "2c", "3d", "4e", "5f"].join(":"),
  tsHost: ["build-box", "tail0f00d", "ts", "net"].join("."),
  ula: j("fd12", ":3456:789a::", "42"),
  tsV6: j("fd7a", ":115c:a1e0::", "beef"),
  lanHost: j("printer", ".", "lan"),
  machine: j("Testers", "-", "MacBook-Pro"),
  device: j("homelab", "-dns-", "07"),
  path: j("/", "Users", "/", "tester", "/projects/secret-plans"),
  prompt: j("tester", "@", "buildhost"),
  email: j("tester.person", "@", "mail-provider.test"),
  authorEmail: j("tester", "@", "Testers", "-", "MacBook-Pro", ".local"),
  keyLine: j("-----BEGIN ", "OPENSSH PRIVATE KEY", "-----")
};
const ENV = { ...process.env, GIT_AUTHOR_NAME: "Fixture Tester", GIT_AUTHOR_EMAIL: P.authorEmail, GIT_COMMITTER_NAME: "Fixture Tester", GIT_COMMITTER_EMAIL: P.authorEmail, GIT_AUTHOR_DATE: "2026-01-02T03:04:05Z", GIT_COMMITTER_DATE: "2026-01-02T03:04:05Z" };
const git = (cwd, ...args) => { const r = spawnSync("git", args, { cwd, env: ENV, encoding: "utf8" }); if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr}`); return r.stdout; };
function png(text) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, "latin1"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("tEXt", Buffer.from(`Author\0${text}`, "latin1")), chunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0, 0, 0, 2, 0, 1])), chunk("IEND", Buffer.alloc(0))]);
}

try {
  // the working repo and its history
  const work = join(FX, "work"); mkdirSync(work);
  git(work, "init", "--quiet", "--initial-branch=main");
  writeFileSync(join(work, "README.md"), "# fixture\nnothing to see here\n");
  writeFileSync(join(work, "notes.txt"), [`dns ${P.ipv4}`, `tailnet ${P.cgnat} ${P.tsHost} ${P.tsV6}`, `ula ${P.ula}`, `mac ${P.mac}`, `printer ${P.lanHost}`,
    `laptop ${P.machine} and ${P.device}`, `repo at ${P.path}`, `${P.prompt} ~ % ls`, `mail ${P.email}`, P.keyLine, `docs 192.0.2.10 and someone@example.com`].join("\n") + "\n");
  writeFileSync(join(work, "shot.png"), png(`made on ${P.machine}`));
  symlinkSync(P.path, join(work, "link-to-home"));
  git(work, "add", "-A"); git(work, "commit", "--quiet", "-m", "first commit");
  git(work, "rm", "--quiet", "notes.txt"); git(work, "commit", "--quiet", "-m", `remove notes (were on ${P.lanHost})`);
  git(work, "tag", "-a", "v1", "-m", "first tag");
  git(work, "checkout", "--quiet", "-b", "feature"); writeFileSync(join(work, "feature.txt"), "a feature\n"); git(work, "add", "-A"); git(work, "commit", "--quiet", "-m", "feature");
  git(work, "checkout", "--quiet", "main");

  // "GitHub" and a drifted "GitLab": main one commit behind, and an extra branch
  const gh = join(FX, "github"), gl = join(FX, "gitlab"); mkdirSync(gh); mkdirSync(gl);
  git(FX, "clone", "--quiet", "--bare", work, join(gh, "fixture.git"));
  git(FX, "clone", "--quiet", "--bare", work, join(gl, "fixture.git"));
  const glDir = join(gl, "fixture.git");
  git(glDir, "update-ref", "refs/heads/main", git(glDir, "rev-parse", "main~1").trim());
  git(glDir, "branch", "gitlab-only", "main");
  const remotesBefore = git(FX, "ls-remote", join(gh, "fixture.git")) + git(FX, "ls-remote", glDir);

  const out = join(FX, "out");
  const run = (...extra) => spawnSync(process.execPath, [TOOL, "--repos=fixture", `--github=${gh}`, `--gitlab=${gl}`, `--out=${out}`, ...extra], { encoding: "utf8" });
  const hasGitleaks = !spawnSync("gitleaks", ["version"]).error;
  const expectExit = hasGitleaks ? 0 : 2;

  const r1 = run();
  check(`first run exits ${expectExit} (${hasGitleaks ? "gitleaks installed" : "gitleaks missing, so blocked"})`, r1.status === expectExit, `exit ${r1.status}: ${r1.stderr.slice(0, 200)}`);
  const report = JSON.parse(readFileSync(join(out, "report.json"), "utf8")), repo = report.repos[0];
  const cats = new Set(repo.findings.map((f) => f.cat));
  for (const c of ["private-ipv4", "cgnat-ipv4", "mac", "tailscale-hostname", "private-ipv6", "tailscale-ipv6", "local-hostname", "machine-name", "local-path", "user-at-host", "email", "email-machine-host", "private-key"])
    check(`finds ${c}`, cats.has(c));
  check("the deleted file's findings are marked history only", repo.findings.some((f) => f.paths?.includes("notes.txt") && f.atHead === false));
  check("a symlink's target is scanned", repo.findings.some((f) => f.source === "symlink-target" && f.cat === "local-path"));
  check("strings inside a binary are scanned", repo.findings.some((f) => f.source === "binary-strings" && f.cat === "machine-name"));
  check("a commit message is scanned", repo.findings.some((f) => f.source === "message" && f.cat === "local-hostname"));
  check("the machine-named author is one identity finding", repo.findings.filter((f) => f.cat === "email-machine-host" && /email$/.test(f.source)).length === 1 && repo.identities.some((i) => i.class === "email-machine-host" && i.roles.includes("tagger")));
  check("documentation examples are ignored (RFC 5737, RFC 2606)", !repo.findings.some((f) => f.cat === "public-ipv4") && !repo.identities.some((i) => i.class === "example"));
  check("the PNG is on the review list, with its text chunk", repo.binaries.some((b) => b.paths.includes("shot.png") && b.metadata.includes("PNG text chunks")));
  check("binaries.md lists it", readFileSync(join(out, "binaries.md"), "utf8").includes("shot.png"));
  check("the drifted mirror is reported", repo.mirror?.differ.some((d) => d.ref === "refs/heads/main") && repo.mirror.onlyGitlab.includes("refs/heads/gitlab-only"));
  check("every commit on every ref was read", repo.commits === 3);

  // nothing planted appears in any output or console text
  const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (f === "cache") continue; statSync(p).isDirectory() ? walk(p) : files.push(p); } }; walk(out);
  const texts = files.map((f) => readFileSync(f, "latin1")).concat(r1.stdout, r1.stderr);
  const leaked = Object.entries(P).filter(([, v]) => texts.some((t) => t.toLowerCase().includes(v.toLowerCase())));
  check(`no planted value in ${files.length} output files or the console`, !leaked.length, leaked.map(([k]) => k).join(", "));

  const r2 = run();
  check("a rerun over the old cache works", r2.status === expectExit && JSON.parse(readFileSync(join(out, "report.json"), "utf8")).repos[0].commits === 3, `exit ${r2.status}`);
  const r3 = run("--from=gitlab");
  const fromGl = JSON.parse(readFileSync(join(out, "report.json"), "utf8")).repos[0];
  check("--from=gitlab scans the GitLab copy", r3.status === expectExit && fromGl.source === "gitlab" && fromGl.commits === 3, `exit ${r3.status}`);
  const missing = spawnSync(process.execPath, [TOOL, "--repos=nope", `--github=${gh}`, `--gitlab=${gl}`, `--out=${out}`], { encoding: "utf8" });
  check("an unreachable repo is blocked, not passed", missing.status === 2 && /Blocked/.test(readFileSync(join(out, "summary.md"), "utf8")));
  const remotesAfter = git(FX, "ls-remote", join(gh, "fixture.git")) + git(FX, "ls-remote", glDir);
  check("the fixture remotes are unchanged", remotesBefore === remotesAfter);
} catch (e) {
  fails.push("crashed: " + e.message);
  console.log("FAIL crashed: " + e.message);
} finally {
  rmSync(FX, { recursive: true, force: true });                  // only the temp folder this test made
}
console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
