#!/usr/bin/env node
/* deploy-args.test: proves tools/deploy.mjs refuses an argument it doesn't know before it does anything,
   that --help only prints, and that the real options still work. It never contacts Cloudflare and never
   deploys:
     - the parser (tools/deploy-args.mjs) is tested directly;
     - tools/deploy.mjs runs in a child process with a preload that replaces every child_process call and
       fetch with a recorder that throws, so no command (npx wrangler among them) and no request can run;
       on top of that the child's PATH puts stub npx and wrangler first, HOME is a throwaway folder (no
       wrangler login) and CLOUDFLARE_API_TOKEN is a dummy;
     - a sentinel file in .deploy/ shows whether a build started (the build deletes .deploy/ first).
   The harness checks its own stubs first, then one control runs the deploy path (no option) under them to
   show a deploy attempt would be caught and recorded, so the "nothing ran" results mean something.

     node tools/deploy-args.test.mjs        exits 1 on any failure

   It leaves .deploy/ as the dry run builds it. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeployArgs, USAGE } from "./deploy-args.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = join(ROOT, "tools/deploy.mjs");
const OUT = join(ROOT, ".deploy");
const SENTINEL = join(OUT, ".deploy-args-test-sentinel");
const FX = mkdtempSync(join(tmpdir(), "deploy-args-test-"));
const LOG = join(FX, "calls.log"), BIN = join(FX, "bin"), HOME = join(FX, "home"), PRELOAD = join(FX, "stub.mjs");
let failed = 0;
const check = (ok, name, why = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && why ? ": " + why : ""}`); };

// 1. the parser, directly
const table = [
  [[], { mode: "deploy" }],
  [["--dry-run"], { mode: "dry-run" }],
  [["--check"], { mode: "check" }],
  [["--guard-self-test"], { mode: "guard-self-test" }],
  [["--help"], { mode: "help" }],
  [["-h"], { mode: "help" }],
  [["--bogus"], "error"],
  [["--dry-run", "--bogus"], "error"],
  [["--bogus", "--dry-run"], "error"],
  [["--dry-run", "--check"], "error"],
  [["--dry-run", "--dry-run"], "error"],
  [["--help", "--dry-run"], "error"],
  [["--dryrun"], "error"],
  [["--dry-run=1"], "error"],
  [["dry-run"], "error"],
  [[""], "error"],
  [["--deploy"], "error"],
  [["--force"], "error"],
  [["--HELP"], "error"],
  [["--help", "--bogus"], "error"]
];
for (const [argv, want] of table) {
  const got = parseDeployArgs(argv);
  const ok = want === "error" ? typeof got.error === "string" && got.mode === undefined : got.mode === want.mode && got.error === undefined;
  check(ok, `parse ${JSON.stringify(argv)} -> ${want === "error" ? "refused" : want.mode}`, JSON.stringify(got));
}
check(/--dry-run/.test(USAGE) && /--check/.test(USAGE) && /--guard-self-test/.test(USAGE) && /--help/.test(USAGE), "the usage names every option");

// 2. the stubs
mkdirSync(BIN); mkdirSync(HOME);
for (const name of ["npx", "wrangler", "npm"]) {
  writeFileSync(join(BIN, name), `#!/bin/sh\necho "bin ${name} $*" >> "${LOG}"\nexit 97\n`); chmodSync(join(BIN, name), 0o755);
}
writeFileSync(PRELOAD, `import { createRequire, syncBuiltinESMExports } from "node:module";
import { appendFileSync } from "node:fs";
const require = createRequire(import.meta.url), cp = require("node:child_process");
const log = (line) => appendFileSync(process.env.DEPLOY_ARGS_TEST_LOG, line + "\\n");
for (const f of ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"]) {
  cp[f] = (cmd, ...rest) => { log("child_process." + f + " " + JSON.stringify(cmd)); throw new Error("deploy-args.test: " + f + " is stubbed"); };
}
syncBuiltinESMExports();
globalThis.fetch = async (u) => { log("fetch " + String(u)); throw new Error("deploy-args.test: fetch is stubbed"); };
`);
const env = { ...process.env, PATH: `${BIN}:${process.env.PATH}`, HOME, CLOUDFLARE_API_TOKEN: "deploy-args-test-not-a-token", CLOUDFLARE_ACCOUNT_ID: "0", WRANGLER_SEND_METRICS: "false", npm_config_offline: "true", DEPLOY_ARGS_TEST_LOG: LOG };
const calls = () => (existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean) : []);
const plant = () => { mkdirSync(OUT, { recursive: true }); writeFileSync(SENTINEL, "if this file is gone, a build ran\n"); };
const run = (args) => { rmSync(LOG, { force: true }); plant(); const r = spawnSync(process.execPath, ["--import", PRELOAD, TOOL, ...args], { cwd: ROOT, env, encoding: "utf8", timeout: 120000 }); return { code: r.status, out: r.stdout || "", err: r.stderr || "", calls: calls(), built: !existsSync(SENTINEL) }; };

// the stubs catch what they must: a child process, a fetch, and the shell's npx. If they don't, nothing
// below runs tools/deploy.mjs
let harness = failed;
{
  rmSync(LOG, { force: true });
  const probe = `import { execSync } from "node:child_process"; try { execSync("npx wrangler deploy"); } catch {} try { await fetch("https://ammaarrehman.com/"); } catch {}`;
  const r = spawnSync(process.execPath, ["--import", PRELOAD, "--input-type=module", "-e", probe], { env, encoding: "utf8" });
  const c = calls();
  check(r.status === 0 && c.some((l) => l.startsWith("child_process.execSync") && l.includes("wrangler")) && c.some((l) => l.startsWith("fetch ")) && !c.some((l) => l.startsWith("bin ")), "harness: the preload stops execSync and fetch before anything runs", JSON.stringify({ code: r.status, c, err: r.stderr }));
  rmSync(LOG, { force: true });
  const sh = spawnSync("/bin/sh", ["-c", "npx wrangler deploy"], { env, encoding: "utf8" });
  check(sh.status === 97 && calls().some((l) => l === "bin npx wrangler deploy"), "harness: the shell's npx is the stub", JSON.stringify({ code: sh.status, c: calls() }));
}

// 3. tools/deploy.mjs itself
const nothingRan = (r) => r.calls.length === 0 && !r.built;
harness = failed === harness;
if (!harness) console.log("FAIL the stubs didn't hold: tools/deploy.mjs not run");
else {
  for (const a of ["--help", "-h"]) {
    const r = run([a]);
    check(r.code === 0 && /^usage: node tools\/deploy\.mjs/.test(r.out) && nothingRan(r), `${a}: prints the usage, exits 0, builds, runs and fetches nothing`, JSON.stringify({ code: r.code, calls: r.calls, built: r.built, err: r.err.slice(0, 300) }));
  }
  for (const args of [["--bogus"], ["--dry-run", "--bogus"], ["--bogus", "--dry-run"], ["--dry-run", "--check"], ["--help", "--dry-run"], ["--dryrun"], ["--deploy"], ["--force"]]) {
    const r = run(args);
    check(r.code === 2 && /nothing was built or deployed/.test(r.err) && nothingRan(r), `${args.join(" ")}: refused (exit 2) before any build, command or request`, JSON.stringify({ code: r.code, calls: r.calls, built: r.built, err: r.err.slice(0, 300) }));
  }
  {
    const r = run(["--dry-run"]);
    check(r.code === 0 && /built \.deploy\/ with \d+ files/.test(r.out) && /checks passed/.test(r.out) && /dry run: stopping before the deploy/.test(r.out) && r.built && r.calls.length === 0, "--dry-run: builds and checks as before, runs no command and makes no request", JSON.stringify({ code: r.code, calls: r.calls, out: r.out.slice(-400), err: r.err.slice(0, 300) }));
    const m = r.out.match(/built \.deploy\/ with (\d+) files[\s\S]*checked (\d+) references/);
    console.log(`     (dry run: ${m ? `${m[1]} files, ${m[2]} references` : "counts not found"})`);
  }
  {
    const r = run(["--guard-self-test"]);
    check(r.code === 0 && (r.out.match(/^ok {2}/gm) || []).length === 8 && nothingRan(r), "--guard-self-test: 8 of 8 (6, and B3b's 2 for the staged content layer), builds, runs and fetches nothing", JSON.stringify({ code: r.code, calls: r.calls, built: r.built, out: r.out.slice(0, 400) }));
  }
  {
    const r = run(["--check"]);
    check(!r.built && r.calls.length > 0 && r.calls.every((l) => l.startsWith("fetch https://ammaarrehman.com/")) && r.code === 1, "--check: goes straight to the live checks (no build, no command); its requests reach only the stub", JSON.stringify({ code: r.code, calls: r.calls, built: r.built }));
  }
  {
    // the control: no option is the real deploy path. Under the stubs it builds, then its wrangler call is
    // caught by the preload, so it fails without running anything
    const r = run([]);
    check(r.code !== 0 && r.built && r.calls.length === 1 && r.calls[0] === 'child_process.execSync "npx wrangler deploy"', "control: the deploy path's wrangler call is caught by the stub (so a deploy attempt above would have shown)", JSON.stringify({ code: r.code, calls: r.calls, built: r.built }));
  }
}

rmSync(SENTINEL, { force: true });
rmSync(FX, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
