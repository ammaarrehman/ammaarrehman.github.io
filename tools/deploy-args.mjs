/* deploy-args: the command line of tools/deploy.mjs, checked before it does anything at all (no build, no
   file written, no wrangler, no network). Pure, so tools/deploy-args.test.mjs can test it directly.

   It takes at most one option, and only one it knows. Anything else fails closed: on 2026-10-08
   `node tools/deploy.mjs --help`, an option the script didn't know, was read as "no option" and deployed
   (Cloudflare e1d40cdd, rolled back to b5fe7d52; docs/hosting.md). */

export const MODES = {
  "--dry-run": "dry-run",
  "--check": "check",
  "--guard-self-test": "guard-self-test",
  "--help": "help",
  "-h": "help"
};

export const USAGE = `usage: node tools/deploy.mjs [option]

  (no option)          build, check, deploy to Cloudflare, smoke-test the live site
  --dry-run            build and check only (no Cloudflare account needed)
  --check              only the live checks, against what's deployed now
  --guard-self-test    prove the staged MAP-B guard stops a synthetic staged map, and passes the real one
  --help, -h           print this and exit (does nothing else)

Any other argument, or more than one option, stops it before it builds or deploys anything.`;

/* argv: process.argv.slice(2). Returns { mode } (deploy, dry-run, check, guard-self-test or help) or
   { error } with the reason; the caller prints it and exits nonzero */
export function parseDeployArgs(argv) {
  const unknown = argv.filter((a) => !Object.hasOwn(MODES, a));
  if (unknown.length) return { error: `unsupported argument${unknown.length > 1 ? "s" : ""}: ${unknown.map((a) => JSON.stringify(a)).join(", ")}` };
  if (argv.length > 1) return { error: `one option at most, got ${argv.length}: ${argv.join(" ")}` };
  return { mode: argv.length ? MODES[argv[0]] : "deploy" };
}
