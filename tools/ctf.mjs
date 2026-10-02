#!/usr/bin/env node
/* ctf: the Phase 9 ctf engine (E1-A) in each engine, through the ?debug=1 test API. Every flag here
   is a synthetic test flag injected with __island.ctfLoad(), with a synthetic answer; no real
   flag's answer is used or stored anywhere. Hashes are made here with tools/ctfhash.mjs.
   - the shipped table: valid, one real flag (fence logs, slot 1, open), slots 2 to 6 offline;
   - fence logs (E1-C1), without its answer written anywhere: fence.log is listed and exact, only
     RFC 5737 addresses, 40 characters a line; the answer is worked out from the log itself (the one
     source logged in across every fence test), and of every address in the file only that one solves
     it, wrapped or not; the controller, the failing source and the short session don't; the hint;
     the write-up locked, then shown, never naming the address; the solve survives a reload;
     paddocks.log and the secrets are as before; no shipped file holds flag{<any address in the log>};
   - normalization and hashing: the page and ctfhash.mjs agree on a corpus and on the hashes;
   - table integrity: duplicate ids, duplicate slots, slots outside 1 to 6, hashes that aren't 64
     lowercase hex, duplicate hashes, ids outside ctf-, bad conditions, hints and write-ups are refused;
   - answers: right (with the optional flag{} and the normalizing rules), wrong (the save is never
     touched), repeated (no second write), offline (never solves, even when right), refused input;
   - hints and write-ups unlock on their conditions; 5 of 6 to 6 of 6 completes exactly once;
   - the save: a solve survives a reload; an old save has no ctf progress; bad values are dropped and
     unknown ctf- ids kept but not counted; a tab running the code before the ctf (STALE) keeps them;
     with save.flags already at its 64 keys a new solve is refused ("full") and nothing is written;
   - the terminal's wait: a second line while a check waits is ignored and stays typed; closing the
     terminal mid-check prints and saves nothing, and reopening works; a failed or never-ending
     check ends cleanly; no web crypto gives a clean message; history and tab completion are right;
     keyboard and touch both run it; axe on the open terminal;
   - the visitor commands (E1-B): the banner line; ctf and flags (the empty shipped board exactly,
     and test flags' names and states); submit (right, already, wrong, empty, malformed, the save
     full, the three-miss nudge once per session, pending, failing, never-ending, closed mid-check,
     six of six once); hint (usage, offline, locked tiers said vaguely, no condition ids); writeup
     (locked, then shown); keyboard, touch and focus; tab completion; axe with the board up;
   - the shared toast: the secret toast is as before; reduced motion stops the terminal's and the
     toast's animations and both still show; at 360 px the board fits with no sideways scroll;
   - help and tab completion are STALE's plus exactly the ctf commands; __ctf is in neither, and
     doesn't exist without ?debug=1.

     node tools/ctf.mjs                            chromium, firefox and webkit
     node tools/ctf.mjs --engines=chromium,webkit  only these

   Exit 1 if a check failed, 2 if nothing failed but an engine couldn't launch (blocked, not failed),
   0 when everything asked for ran and passed. */
import { chromium, firefox, webkit } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { serve } from "./serve.mjs";
import { normalize, hash } from "./ctfhash.mjs";

const STALE = "003d1e0";                                      // the last commit before the ctf code
const OLD_WORLD = execFileSync("git", ["show", `${STALE}:js/world.js`], { cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 1 << 24 });
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const ENGINES = (arg("engines") || "chromium,firefox,webkit").split(",");
const PORT = 8200 + Math.floor(Math.random() * 190);
const server = await serve(PORT);
const BASE = `http://localhost:${PORT}/`;
const fails = [], blocked = [];

function check(engine, what, ok, detail) {
  console.log(`${ok ? "ok  " : "FAIL"} ${engine.padEnd(8)} ${what}${!ok && detail ? ": " + detail : ""}`);
  if (!ok) fails.push(`${engine} ${what}${detail ? ": " + detail : ""}`);
}

// synthetic test flags: ids ctf-test-<word>, answers flag{test_<word>}
const WORDS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
const ANSWER = (w) => `flag{test_${w}}`;
function flag(slot, w, extra = {}) {
  const id = `ctf-test-${w}`;
  return { id, slot, name: `test ${w}`, open: null, h: hash(id, ANSWER(w)), hints: [{ t: "test hint one" }, { t: "test hint two", when: "tool:scanner" }], writeup: ["test write-up line"], ...extra };
}
const SIX = WORDS.map((w, i) => flag(i + 1, w));

// a page on the island, frozen (?step=1). init counts every write of the save in window.__writes
async function island(ctx, query = "", opts = {}) {
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  if (opts.old) await page.route("**/js/world.js*", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: OLD_WORLD }));
  await page.addInitScript(() => {
    window.__writes = 0; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === "island-save") window.__writes++; return set.call(this, k, v); };
  });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(`${BASE}?debug=1&step=1&islandhour=11${query}#island`);
  await page.waitForFunction(() => window.__island && window.__island.getState().open, null, { timeout: 30000 });
  return { page, errors };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
const raw = (page) => ev(page, () => localStorage.getItem("island-save"));
const flagsOf = (page) => ev(page, () => window.__island.getSave().flags);
const lastLine = (page, prefix) => page.waitForFunction((p) => window.__island.termOut().some((l) => l.startsWith(p)), prefix, { timeout: 10000 }).then(() => ev(page, (p) => window.__island.termOut().filter((l) => l.startsWith(p)).pop(), prefix));
// make the page's digest slow, never settle, fail, or real again
const slowDigest = (page, ms) => ev(page, (ms) => { const s = crypto.subtle, real = Object.getPrototypeOf(s).digest; s.digest = (a, d) => new Promise((ok, no) => setTimeout(() => real.call(s, a, d).then(ok, no), ms)); }, ms);
const realDigest = (page) => ev(page, () => { delete crypto.subtle.digest; });

for (const [name, type] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
  if (!ENGINES.includes(name)) continue;
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`BLOCKED ${name}: could not launch (${e.message.split("\n")[0]})`); blocked.push(name); continue; }
  const pages = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const get = async (q, o) => { const it = await island(ctx, q, o); pages.push(it); return it; };
  const { page } = await get();

  // ── the shipped table
  const shipped = await ev(page, () => window.__island.ctf());
  check(name, "shipped table: valid, exactly one real flag (fence logs, slot 1, open), slots 2 to 6 offline, nothing waiting",
    shipped.shipped === 1 && !shipped.shippedProblems.length && shipped.loaded.join() === "ctf-fence-logs" && shipped.slots.length === 6 && shipped.slots[0].id === "ctf-fence-logs" && shipped.slots[0].state === "open" && shipped.slots.slice(1).every((s, i) => s.slot === i + 2 && s.state === "offline" && s.id === null) && shipped.count === 0 && !shipped.pending, JSON.stringify(shipped));

  // ── normalization: the page, ctfhash.mjs and what's expected all agree
  const CORPUS = [
    ["flag{test_alpha}", "test_alpha"], ["  FLAG{Test Alpha}  ", "test_alpha"], ["`flag{test-alpha}`", "test_alpha"], ["“test_alpha”", "test_alpha"],
    ["'flag{test alpha}'", "test_alpha"], ["Ｔｅｓｔ＿ａｌｐｈａ", "test_alpha"], ["Flag{ test__--  alpha }", "test_alpha"],
    ["_test_alpha_", "test_alpha"], ["test\talpha", "test_alpha"], ["198.51.100.7", "198.51.100.7"], ["flag{198.51.100.7}", "198.51.100.7"],
    ["a".repeat(64), "a".repeat(64)], ["a".repeat(65), null], ["flag{" + "b".repeat(65) + "}", null], ["x".repeat(300), null],
    ["", null], ["   ", null], ["flag{}", null], ["flag{ - _ }", null], ["test alpha!", null], ["{test}", null], ["flag{a}b", null], ["café", null], ["flag{a\nb}", "a_b"]
  ];
  const pageNorm = await ev(page, (c) => c.map((x) => window.__island.ctfNorm(x)), CORPUS.map((c) => c[0]));
  const normBad = CORPUS.map((c, i) => [c[0].slice(0, 24), c[1], normalize(c[0]), pageNorm[i]]).filter(([, want, node, pg]) => want !== node || want !== pg);
  check(name, `normalization: ${CORPUS.length} cases, page = ctfhash.mjs = expected`, !normBad.length, JSON.stringify(normBad));
  const nonString = await ev(page, () => [null, undefined, 5, {}, ["a"]].map((x) => window.__island.ctfNorm(x)));
  check(name, "normalization refuses anything that isn't a string", nonString.every((x) => x === null), JSON.stringify(nonString));
  const PAIRS = [["ctf-test-alpha", "flag{test_alpha}"], ["ctf-test-alpha", "TEST ALPHA"], ["ctf-x", "198.51.100.7"], ["ctf-test-beta", "flag{test_alpha}"]];
  const pageH = await ev(page, (p) => Promise.all(p.map(([id, a]) => window.__island.ctfHash(id, a))), PAIRS);
  check(name, "hashing: the page's web crypto sha-256 = ctfhash.mjs's, 64 lowercase hex", PAIRS.every(([id, a], i) => pageH[i] === hash(id, a) && /^[0-9a-f]{64}$/.test(pageH[i])), JSON.stringify(pageH));
  check(name, "hashing is salted by id: the same answer hashes differently for another flag", pageH[0] !== pageH[3] && pageH[0] === pageH[1]);

  // ── table integrity: ctfLoad refuses broken tables and keeps the one it had
  const BAD = {
    "duplicate id": [flag(1, "alpha"), { ...flag(2, "beta"), id: "ctf-test-alpha" }],
    "duplicate slot": [flag(1, "alpha"), flag(1, "beta")],
    "slot 0": [flag(0, "alpha")], "slot 7": [flag(7, "alpha")], "slot 1.5": [flag(1.5, "alpha")], "slot as a string": [{ ...flag(1, "alpha"), slot: "1" }],
    "hash of 63 characters": [{ ...flag(1, "alpha"), h: "a".repeat(63) }], "uppercase hash": [{ ...flag(1, "alpha"), h: hash("ctf-test-alpha", ANSWER("alpha")).toUpperCase() }],
    "non-hex hash": [{ ...flag(1, "alpha"), h: "g".repeat(64) }], "missing hash": [{ ...flag(1, "alpha"), h: undefined }],
    "duplicate hash": [flag(1, "alpha"), { ...flag(2, "beta"), h: flag(1, "alpha").h }],
    "id outside ctf-": [{ ...flag(1, "alpha"), id: "root" }], "id ctf- only": [{ ...flag(1, "alpha"), id: "ctf-" }], "id too long": [{ ...flag(1, "alpha"), id: "ctf-" + "a".repeat(29) }],
    "uppercase id": [{ ...flag(1, "alpha"), id: "CTF-test" }], "bad open condition": [{ ...flag(1, "alpha"), open: "scanner" }], "bad open list": [{ ...flag(1, "alpha"), open: ["tool:scanner", "x"] }],
    "bad hint": [{ ...flag(1, "alpha"), hints: [{ t: 3 }] }], "bad hint condition": [{ ...flag(1, "alpha"), hints: [{ t: "x", when: "tool:" }] }],
    "bad write-up": [{ ...flag(1, "alpha"), writeup: "one string" }], "no name": [{ ...flag(1, "alpha"), name: "" }], "not a list": { a: 1 }, "a null entry": [null]
  };
  await ev(page, (t) => window.__island.ctfLoad(t), [flag(1, "alpha")]);
  const refused = await ev(page, (bad) => Object.fromEntries(Object.entries(bad).map(([k, t]) => { try { window.__island.ctfLoad(t); return [k, "accepted"]; } catch (e) { return [k, e.message.slice(0, 80)]; } })), BAD);
  const acc = Object.entries(refused).filter(([, v]) => v === "accepted").map(([k]) => k);
  check(name, `table integrity: ${Object.keys(BAD).length} broken tables refused`, !acc.length, "accepted: " + acc.join(", "));
  const kept = await ev(page, () => window.__island.ctf().loaded);
  check(name, "a refused table leaves the loaded one in place", kept.join() === "ctf-test-alpha", kept.join());

  // ── answers
  const six = await ev(page, (t) => window.__island.ctfLoad(t), SIX);
  check(name, "six synthetic flags load: all six slots open", six.slots.every((s) => s.state === "open") && six.count === 0, JSON.stringify(six.slots.map((s) => s.state)));
  const raw0 = await raw(page), w0 = await ev(page, () => window.__writes);
  const wrong = await ev(page, () => Promise.all(["flag{nope}", "test_alph", "flag{test_alpha_x}", "TEST BETA GAMMA"].map((g) => window.__island.ctfSubmit(g))));
  const refusedIn = await ev(page, () => Promise.all(["", "   ", "flag{}", "x".repeat(300), "test alpha!"].map((g) => window.__island.ctfSubmit(g))));
  check(name, "wrong answers: none, and the save is never written", wrong.every((r) => r.status === "none") && await raw(page) === raw0 && await ev(page, () => window.__writes) === w0, JSON.stringify(wrong));
  check(name, "refused input: invalid before hashing, no write", refusedIn.every((r) => r.status === "invalid") && await raw(page) === raw0, JSON.stringify(refusedIn));
  const variants = await ev(page, () => Promise.all(["flag{test_beta}", "TEST BETA", "`flag{Test-Beta}`", "“flag{test beta}”"].map((g) => window.__island.ctfCheck(g))));
  check(name, "right answer in four spellings matches (check alone writes nothing)", variants.every((r) => r.status === "match" && r.id === "ctf-test-beta") && await raw(page) === raw0, JSON.stringify(variants));
  const right = await ev(page, () => window.__island.ctfSubmit("flag{test_alpha}"));
  const fl1 = await flagsOf(page), stored1 = JSON.parse(await raw(page)).flags, w1 = await ev(page, () => window.__writes);
  check(name, "right answer: solved, save.flags['ctf-test-alpha'] = true, written once", right.status === "match" && right.id === "ctf-test-alpha" && right.count === 1 && !right.complete && fl1["ctf-test-alpha"] === true && stored1["ctf-test-alpha"] === true && w1 === w0 + 1, JSON.stringify({ right, w0, w1 }));
  const again = await ev(page, () => Promise.all([window.__island.ctfSubmit("flag{test_alpha}"), window.__island.ctfSubmit("Test Alpha")]));
  check(name, "repeated solve: already, no second write", again.every((r) => r.status === "already" && r.id === "ctf-test-alpha") && await ev(page, () => window.__writes) === w1, JSON.stringify(again));
  const crossed = await ev(page, () => window.__island.ctfCheck("flag{test_alpha}").then((r) => r.id));
  check(name, "an answer only matches its own flag", crossed === "ctf-test-alpha");

  // ── offline flags, hints, write-ups
  await ev(page, (t) => window.__island.ctfLoad(t), [flag(1, "alpha"), flag(3, "gamma", { open: "tool:scanner", hints: [{ t: "h1" }, { t: "h2", when: "tool:scanner" }, { t: "h3", when: ["secret:koi", "log:desk"] }] })]);
  const offB = await ev(page, () => window.__island.ctf().slots[2]);
  const rawOff = await raw(page);
  const off = await ev(page, () => window.__island.ctfSubmit("flag{test_gamma}"));
  check(name, "an offline flag never solves, even with its right answer", offB.state === "offline" && off.status === "none" && await raw(page) === rawOff && !(await flagsOf(page))["ctf-test-gamma"], JSON.stringify({ offB, off }));
  check(name, "offline flag: hints 1 of 3 unlocked, write-up locked", offB.hints[0] === 1 && offB.hints[1] === 3 && offB.writeup === false, JSON.stringify(offB.hints));
  await ev(page, () => { const s = window.__island.getSave(); s.tools.scanner = true; window.__island.setSave(s); });
  const onB = await ev(page, () => window.__island.ctf().slots[2]);
  check(name, "a tool: condition opens it and unlocks its hint (2 of 3)", onB.state === "open" && onB.hints[0] === 2, JSON.stringify(onB));
  await ev(page, () => { const s = window.__island.getSave(); s.secrets = ["koi"]; s.logs = ["desk"]; window.__island.setSave(s); });
  const allH = await ev(page, () => window.__island.ctf().slots[2].hints);
  check(name, "a list condition (secret: and log:) unlocks the last hint (3 of 3)", allH[0] === 3, JSON.stringify(allH));
  const solvedG = await ev(page, () => window.__island.ctfSubmit("flag{test_gamma}").then((r) => [r.status, window.__island.ctf().slots[2]]));
  check(name, "once open it solves, and its write-up unlocks", solvedG[0] === "match" && solvedG[1].state === "solved" && solvedG[1].writeup === true, JSON.stringify(solvedG));

  // ── 5 of 6 to 6 of 6: complete exactly once
  await ev(page, (t) => window.__island.ctfLoad(t), SIX);
  await ev(page, (ids) => { const s = window.__island.getSave(); s.flags = Object.fromEntries(ids.map((i) => [i, true])); window.__island.setSave(s); }, SIX.slice(0, 5).map((f) => f.id));
  const c0 = await ev(page, () => window.__island.ctf());
  const sixth = await ev(page, () => window.__island.ctfSubmit("flag{test_zeta}"));
  const c1 = await ev(page, () => window.__island.ctf());
  const more = await ev(page, () => Promise.all(["flag{test_zeta}", "flag{test_alpha}"].map((g) => window.__island.ctfSubmit(g))));
  const c2 = await ev(page, () => window.__island.ctf());
  check(name, "5 of 6 to 6 of 6: complete exactly once", c0.count === 5 && sixth.status === "match" && sixth.complete === true && sixth.count === 6 && c1.completions === c0.completions + 1 && more.every((r) => r.status === "already" && !r.complete) && c2.completions === c1.completions && c2.slots.every((s) => s.state === "solved" && s.writeup), JSON.stringify({ c0: c0.count, sixth, c1: c1.completions, c2: c2.completions }));

  // ── the save
  await page.reload(); await page.waitForFunction(() => window.__island && window.__island.getState().open);
  const back = await ev(page, (t) => { window.__island.ctfLoad(t); return window.__island.ctf(); }, SIX);
  check(name, "solves survive a reload (six of six, flags in the save)", back.count === 6 && back.slots.every((s) => s.state === "solved"), JSON.stringify(back.slots.map((s) => s.state)));
  await page.reload(); await page.waitForFunction(() => window.__island && window.__island.getState().open);
  check(name, "the injected table doesn't survive a reload (the shipped one comes back)", await ev(page, () => window.__island.ctf().loaded.join() === "ctf-fence-logs"));
  const oldSaves = await ev(page, (t) => {
    window.__island.ctfLoad(t);
    const v2 = window.__island.setSave({ v: 2, logs: ["rack"], secrets: [] }); const a = window.__island.ctf().count;
    const v1 = window.__island.setSave({ v: 1, logs: ["rack", "desk"], secrets: ["roar"], evolved: true }); const b = window.__island.ctf().count;
    return { a, b, f2: v2.flags, f1: v1.flags };
  }, SIX);
  check(name, "an old save (v2 without ctf keys, or v1) has no ctf progress and works", oldSaves.a === 0 && oldSaves.b === 0 && !Object.keys(oldSaves.f2).length && !Object.keys(oldSaves.f1).length, JSON.stringify(oldSaves));
  const mal = await ev(page, () => {
    const m = window.__island.setSave({ v: 2, logs: [], secrets: [], flags: { "ctf-test-alpha": "yes", "ctf-test-beta": 1, "ctf-unknown": true, "CTF-test-gamma": true, "ctf-test-delta": true, "story-x": false } });
    const count = window.__island.ctf().count;
    const junk = window.__island.setSave({ v: 2, logs: [], secrets: [], flags: "junk" }).flags;
    const arr = window.__island.setSave({ v: 2, logs: [], secrets: [], flags: ["ctf-test-alpha"] }).flags;
    return { flags: m.flags, count, junk, arr };
  });
  check(name, "malformed ctf values dropped, unknown ctf- ids kept but not counted", JSON.stringify(mal.flags) === JSON.stringify({ "ctf-unknown": true, "ctf-test-delta": true, "story-x": false }) && mal.count === 1 && !Object.keys(mal.junk).length && !Object.keys(mal.arr).length, JSON.stringify(mal));
  await ev(page, () => localStorage.setItem("island-save", JSON.stringify({ v: 2, logs: ["rack"], secrets: [], flags: { "ctf-test-beta": "1", "ctf-test-alpha": true }, tools: [] })));
  await page.reload(); await page.waitForFunction(() => window.__island && window.__island.getState().open);
  const storedMal = await ev(page, (t) => { window.__island.ctfLoad(t); return { flags: window.__island.getSave().flags, count: window.__island.ctf().count, logs: window.__island.getState().found }; }, SIX);
  check(name, "a stored save with bad ctf values loads: bad ones dropped, good ones kept", JSON.stringify(storedMal.flags) === JSON.stringify({ "ctf-test-alpha": true }) && storedMal.count === 1 && storedMal.logs.join() === "rack", JSON.stringify(storedMal));
  // a tab still running the code from before the ctf loads and rewrites the save: the ctf keys survive
  const solvedSave = { v: 2, logs: ["rack"], secrets: [], flags: { "ctf-test-alpha": true, "ctf-test-beta": true, "ctf-unknown": true } };
  await ev(page, (s) => window.__island.setSave(s), solvedSave);
  const stale = await get("", { old: true });
  const staleOut = await ev(stale.page, () => { const had = typeof window.__island.ctf; window.__island.setSave(window.__island.getSave()); return { had, flags: JSON.parse(localStorage.getItem("island-save")).flags }; });
  await stale.page.close();
  await page.reload(); await page.waitForFunction(() => window.__island && window.__island.getState().open);
  const after = await ev(page, (t) => { window.__island.ctfLoad(t); return window.__island.ctf().count; }, SIX);
  check(name, `a stale tab (${STALE}'s world.js) rewrites the save and keeps every ctf key; the new code still counts them`, staleOut.had === "undefined" && JSON.stringify(staleOut.flags) === JSON.stringify(solvedSave.flags) && after === 2, JSON.stringify({ staleOut, after }));

  // ── save.flags already full (SAVE_MAX, 64 keys): a new solve is refused, nothing written
  await ev(page, (t) => {
    window.__island.ctfLoad(t);
    window.__island.setSave({ v: 2, logs: [], secrets: [], flags: Object.fromEntries(Array.from({ length: 64 }, (_, i) => ["story-" + i, true])) });
  }, [flag(1, "alpha")]);
  const fullBefore = await ev(page, () => ({ keys: Object.keys(window.__island.getSave().flags).length, count: window.__island.ctf().count, raw: localStorage.getItem("island-save"), writes: window.__writes }));
  const fullR = await ev(page, () => window.__island.ctfSubmit("flag{test_alpha}"));
  const fullAfter = await ev(page, () => ({ keys: Object.keys(window.__island.getSave().flags).length, has: "ctf-test-alpha" in window.__island.getSave().flags, count: window.__island.ctf().count, raw: localStorage.getItem("island-save"), writes: window.__writes }));
  check(name, "save.flags full (64): solving a new flag is refused, no key, no count, no write, save byte-identical",
    fullBefore.keys === 64 && fullR.status === "full" && !fullAfter.has && fullAfter.keys === 64 && fullAfter.count === fullBefore.count && fullAfter.writes === fullBefore.writes && fullAfter.raw === fullBefore.raw,
    JSON.stringify({ r: fullR, before: { k: fullBefore.keys, c: fullBefore.count, w: fullBefore.writes }, after: { k: fullAfter.keys, has: fullAfter.has, c: fullAfter.count, w: fullAfter.writes, same: fullAfter.raw === fullBefore.raw } }));

  // ── the terminal's wait
  await ev(page, (t) => { window.__island.setSave({ v: 2, logs: [], secrets: [] }); window.__island.ctfLoad(t); window.__island.terminal(true); }, SIX);
  check(name, "the terminal opens (debug hook)", await ev(page, () => !document.querySelector(".w-term").hidden && window.__island.getState() && window.__island.terminal(true)));
  await ev(page, () => window.__island.term("__ctf flag{test_alpha}"));
  const t1 = await lastLine(page, "__ctf:");
  check(name, "__ctf through the terminal: solved, count shown", t1 === "__ctf: match ctf-test-alpha (1/6)" && (await flagsOf(page))["ctf-test-alpha"] === true, t1);
  // a second line while a check waits: ignored, kept in the box, not in history; order stays
  await slowDigest(page, 400);
  const nOut = (await ev(page, () => window.__island.termOut())).length;
  const busy = await ev(page, () => { const a = window.__island.term("__ctf flag{test_beta}"); const p = window.__island.ctf().pending; const b = window.__island.term("help"); return { a, p, b, box: document.querySelector(".w-term-in").value }; });
  check(name, "while a check waits: pending, a second line is ignored and stays typed", busy.a === true && busy.p === true && busy.b === false && busy.box === "help", JSON.stringify(busy));
  await lastLine(page, "__ctf: match ctf-test-beta");
  const outB = (await ev(page, () => window.__island.termOut())).slice(nOut);
  check(name, "output order: the echo, then the result; help never ran", outB.length === 2 && outB[0] === "pi@island:~$ __ctf flag{test_beta}" && outB[1] === "__ctf: match ctf-test-beta (2/6)", JSON.stringify(outB));
  check(name, "the wait is over: not pending, a new line runs", await ev(page, () => !window.__island.ctf().pending && window.__island.term("help")));
  // history: arrow up walks back through what ran (help, then the two checks)
  await page.focus(".w-term-in");
  const hist = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowUp"); hist.push(await page.inputValue(".w-term-in")); }
  check(name, "history: help, then the two checks (the ignored line isn't in it)", JSON.stringify(hist) === JSON.stringify(["help", "__ctf flag{test_beta}", "__ctf flag{test_alpha}"]), JSON.stringify(hist));
  // closing the terminal mid-check: nothing printed, nothing saved, no error; reopening works
  const rawC = await raw(page), wC = await ev(page, () => window.__writes);
  await ev(page, () => { window.__island.term("__ctf flag{test_gamma}"); window.__island.terminal(false); });
  const linesAtClose = await ev(page, () => window.__island.termOut().length);
  await page.waitForTimeout(800);
  const closed = await ev(page, () => ({ lines: window.__island.termOut().length, pending: window.__island.ctf().pending, hidden: document.querySelector(".w-term").hidden, gamma: window.__island.getSave().flags["ctf-test-gamma"] }));
  check(name, "closing mid-check: no output, no save, not pending", closed.lines === linesAtClose && !closed.pending && closed.hidden && closed.gamma === undefined && await raw(page) === rawC && await ev(page, () => window.__writes) === wC, JSON.stringify(closed));
  await ev(page, () => window.__island.terminal(true));
  await ev(page, () => window.__island.term("__ctf flag{test_gamma}"));
  check(name, "reopened: the same check runs and solves", (await lastLine(page, "__ctf: match")) === "__ctf: match ctf-test-gamma (3/6)");
  // a check that fails, and one that never ends
  await ev(page, () => { crypto.subtle.digest = () => Promise.reject(new Error("broken")); });
  await ev(page, () => window.__island.term("__ctf flag{test_delta}"));
  const failed = await lastLine(page, "__ctf: error");
  check(name, "a failing digest: a clean error line, not pending, nothing saved", failed === "__ctf: error" && await ev(page, () => !window.__island.ctf().pending && !window.__island.getSave().flags["ctf-test-delta"]), failed);
  await ev(page, () => { crypto.subtle.digest = () => new Promise(() => {}); });
  await ev(page, () => window.__island.term("__ctf flag{test_delta}"));
  const stuck = await ev(page, () => ({ p: window.__island.ctf().pending, b: window.__island.term("help") }));
  const timedOut = await lastLine(page, "__ctf: the checker failed");
  check(name, "a digest that never settles: the watchdog ends it, the terminal takes lines again", stuck.p && !stuck.b && timedOut === "__ctf: the checker failed (timed out)" && await ev(page, () => !window.__island.ctf().pending && window.__island.term("help")), JSON.stringify({ stuck, timedOut }));
  await realDigest(page);
  // keyboard: type, enter; tab completion unchanged and __ctf not in it
  await page.focus(".w-term-in");
  await page.keyboard.type("__ctf Test Delta"); await page.keyboard.press("Enter");
  check(name, "keyboard: typed and entered, solved", (await lastLine(page, "__ctf: match ctf-test-delta")) === "__ctf: match ctf-test-delta (4/6)");
  await page.keyboard.type("he"); await page.keyboard.press("Tab");
  const comp1 = await page.inputValue(".w-term-in");
  await page.fill(".w-term-in", "__"); await page.keyboard.press("Tab");
  const comp2 = await page.inputValue(".w-term-in");
  await page.fill(".w-term-in", "");
  check(name, "tab completion: he → help, __ completes to nothing", comp1 === "help " && comp2 === "__", JSON.stringify([comp1, comp2]));
  await page.keyboard.press("Escape");
  check(name, "escape closes the terminal and focus goes back to the island", await ev(page, () => document.querySelector(".w-term").hidden && document.activeElement === document.querySelector(".w-cv")));

  // ── fence logs (E1-C1): the real flag, tested without its answer written down anywhere. the
  // answer is worked out from fence.log the way a player would, and the checker has to agree
  const FENCE = ["# fence controller, raptor pen", "# this controller is 192.0.2.10", "# 3 fence tests tonight, none scheduled",
    "02:58:10 198.51.100.8  login fail", "03:05:44 198.51.100.8  login fail", "03:11:58 203.0.113.47  login ok", "03:12:04 192.0.2.10    fence test",
    "03:12:30 203.0.113.47  logout", "03:28:16 198.51.100.8  login fail", "03:46:51 203.0.113.47  login ok", "03:47:02 192.0.2.10    fence test",
    "03:47:40 203.0.113.47  logout", "03:51:40 192.0.2.11    login ok", "03:52:05 192.0.2.11    logout", "04:19:57 203.0.113.47  login ok",
    "04:20:06 192.0.2.10    fence test", "04:20:31 203.0.113.47  logout", "04:33:58 198.51.100.8  login fail"];
  const fenceCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });      // its own storage: this section solves the real flag
  const fenceIt = await island(fenceCtx); pages.push(fenceIt); const fp = fenceIt.page;
  const fsay = async (line, min = 1) => {
    const n = (await ev(fp, () => window.__island.termOut())).length;
    await ev(fp, (l) => window.__island.term(l), line);
    await fp.waitForFunction(([n, m]) => window.__island.termOut().length >= n + m, [n, min + 1], { timeout: 10000 });
    await fp.waitForTimeout(60);
    return (await ev(fp, () => window.__island.termOut())).slice(n + 1);
  };
  await ev(fp, () => window.__island.terminal(true));
  const lsOut = await fsay("ls", 2);
  check(name, "fence logs: fence.log is listed by ls", lsOut[0].split(/\s+/).includes("fence.log"), JSON.stringify(lsOut));
  await fp.fill(".w-term-in", "cat fe"); await fp.focus(".w-term-in"); await fp.keyboard.press("Tab");
  check(name, "fence logs: tab completes cat fe → cat fence.log", await fp.inputValue(".w-term-in") === "cat fence.log");
  await fp.fill(".w-term-in", "");
  const log = await fsay("cat fence.log", FENCE.length);
  check(name, "fence logs: cat fence.log prints exactly the agreed lines", JSON.stringify(log) === JSON.stringify(FENCE), JSON.stringify(log));
  const ips = [...new Set(log.join("\n").match(/\b\d{1,3}(\.\d{1,3}){3}\b/g))];
  const doc = (ip) => /^(192\.0\.2|198\.51\.100|203\.0\.113)\.(\d{1,3})$/.test(ip) && +ip.split(".")[3] <= 255;
  check(name, `fence logs: all ${ips.length} addresses are RFC 5737 documentation addresses`, ips.length >= 4 && ips.every(doc), JSON.stringify(ips));
  check(name, "fence logs: every line fits the mobile width (40 characters)", log.every((l) => l.length <= 40), JSON.stringify(log.filter((l) => l.length > 40)));
  // the analysis: the controller from the header; each source's sessions (login ok to logout); the
  // tests; the source logged in across every test; the sources that only failed; short sessions elsewhere
  const sec = (t) => { const [h, m, s2] = t.split(":").map(Number); return h * 3600 + m * 60 + s2; };
  const ev2 = log.filter((l) => /^\d/.test(l)).map((l) => { const [t, ip, ...rest] = l.split(/\s+/); return { t: sec(t), ip, what: rest.join(" ") }; });
  const controller = log.find((l) => l.startsWith("# this controller is")).split(" ").pop();
  const tests = ev2.filter((e) => e.what === "fence test").map((e) => e.t);
  const sessions = {};
  ev2.forEach((e) => { if (e.what === "login ok") (sessions[e.ip] ||= []).push([e.t, Infinity]); if (e.what === "logout") sessions[e.ip].at(-1)[1] = e.t; });
  const covers = (ip) => tests.every((t) => (sessions[ip] || []).some(([a, b]) => a <= t && t <= b));
  const derived = ips.filter(covers);
  const failOnly = ips.filter((ip) => ev2.some((e) => e.ip === ip && e.what === "login fail") && !sessions[ip]);
  const shortOnly = ips.filter((ip) => sessions[ip] && !tests.some((t) => sessions[ip].some(([a, b]) => a <= t && t <= b)));
  check(name, "fence logs: the log's own analysis gives exactly one answer, distinct from the controller, the failing source and the short session",
    tests.length === 3 && derived.length === 1 && derived[0] !== controller && failOnly.length === 1 && shortOnly.length === 1 && ![controller, ...failOnly, ...shortOnly].includes(derived[0]), JSON.stringify({ tests: tests.length, derived: derived.length, failOnly: failOnly.length, shortOnly: shortOnly.length }));
  const verdict = await ev(fp, (ips) => Promise.all(ips.map(async (ip) => [ip, (await window.__island.ctfCheck(ip)), (await window.__island.ctfCheck("flag{" + ip + "}"))])), ips);
  const solves = verdict.filter(([, a, b]) => a.status === "match" && a.id === "ctf-fence-logs" && b.status === "match" && b.id === "ctf-fence-logs").map(([ip]) => ip);
  check(name, `fence logs: of the ${ips.length} addresses in the log, exactly one solves it (bare and wrapped), and it's the one the analysis found`, solves.length === 1 && solves[0] === derived[0] && verdict.every(([ip, a, b]) => ip === derived[0] || (a.status === "none" && b.status === "none")), JSON.stringify(verdict.map(([ip, a, b]) => [ip === derived[0] ? "<answer>" : ip, a.status, b.status])));
  check(name, "fence logs: the controller, the failing source and the short-session source don't solve it", [controller, ...failOnly, ...shortOnly].every((ip) => verdict.find((v) => v[0] === ip)[1].status === "none"));
  check(name, "fence logs: nothing was written while checking", !(await flagsOf(fp))["ctf-fence-logs"]);
  const hint1 = await fsay("hint 1", 2);
  check(name, "fence logs: hint 1 is the one agreed hint", JSON.stringify(hint1) === JSON.stringify(["flag 1 · fence logs", "  1. match each fence test to who was logged in at that moment."]), JSON.stringify(hint1));
  const wLocked = await fsay("writeup 1");
  check(name, "fence logs: the write-up is locked before the capture", JSON.stringify(wLocked) === '["writeup 1: locked. capture flag 1 first."]', JSON.stringify(wLocked));
  const capt = await fsay("submit flag{" + derived[0] + "}");
  check(name, "fence logs: submitting the worked-out answer captures it (1/6)", JSON.stringify(capt) === '["flag accepted: fence logs (1/6)"]' && (await flagsOf(fp))["ctf-fence-logs"] === true, JSON.stringify(capt));
  const wOpen = await fsay("writeup 1", 7);
  check(name, "fence logs: the write-up after the capture, exactly", JSON.stringify(wOpen) === JSON.stringify(["flag 1 · fence logs · write-up", "  logs say who did what, and when.", "  the loudest source only failed to log in.", "  a quieter source had a session around", "  every unscheduled fence test.", "  one line proves little. defenders", "  correlate time and source, then act."]), JSON.stringify(wOpen));
  check(name, "fence logs: the write-up never names an address", !wOpen.some((l) => ips.some((ip) => l.includes(ip))));
  await fp.reload(); await fp.waitForFunction(() => window.__island && window.__island.getState().open);
  const after2 = await ev(fp, () => ({ c: window.__island.ctf().count, s: window.__island.ctf().slots[0].state }));
  check(name, "fence logs: the capture survives a reload", after2.c === 1 && after2.s === "solved", JSON.stringify(after2));
  // paddocks.log and the secrets, against the code before the ctf (fresh saves on both)
  const boxRun = async (p, lines) => {
    await ev(p, (ls) => { const t = document.querySelector(".w-term"), i = t.querySelector(".w-term-in"); t.hidden = false; t.querySelector(".w-term-out").innerHTML = ""; for (const l of ls) { i.value = l; t.querySelector(".w-term-row").requestSubmit(); } }, lines);
    return ev(p, () => [...document.querySelectorAll(".w-term-out .w-term-line")].map((l) => l.textContent));
  };
  const freshCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fNew = await island(freshCtx); pages.push(fNew);
  const newOut = await boxRun(fNew.page, ["cat paddocks.log", "cat fence.log", "secrets"]);
  const newSecrets = await ev(fNew.page, () => window.__island.getSave().secrets);
  const oldCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fOld = await island(oldCtx, "", { old: true }); pages.push(fOld);
  const oldOut = await boxRun(fOld.page, ["cat paddocks.log", "secrets"]);
  const cut = (out, cmd) => { const i = out.indexOf("pi@island:~$ " + cmd); const j = out.findIndex((l, k) => k > i && l.startsWith("pi@island:~$ ")); return out.slice(i + 1, j < 0 ? undefined : j); };
  check(name, `fence logs: paddocks.log reads exactly as in ${STALE}`, JSON.stringify(cut(newOut, "cat paddocks.log")) === JSON.stringify(cut(oldOut, "cat paddocks.log")), JSON.stringify(cut(newOut, "cat paddocks.log")));
  check(name, `fence logs: reading fence.log finds no secret, and secrets reads exactly as in ${STALE}`, !newSecrets.length && JSON.stringify(cut(newOut, "secrets")) === JSON.stringify(cut(oldOut, "secrets")), JSON.stringify({ newSecrets, s: cut(newOut, "secrets") }));
  await freshCtx.close(); await oldCtx.close(); await fenceCtx.close();
  // shipped files: no flag{<address>} for any address in the log, and the table holds a hash, not an answer
  const SHIPPED = ["js/world.js", "index.html", "404.html", "css/styles.css", ...readdirSync(new URL("../js/", import.meta.url)).map((f) => "js/" + f)];
  const wrapped = [...new Set(SHIPPED)].filter((f) => ips.some((ip) => readFileSync(new URL("../" + f, import.meta.url), "utf8").includes("flag{" + ip + "}")));
  const entry = /\{ id: "ctf-fence-logs"[^\n]*\n/.exec(readFileSync(new URL("../js/world.js", import.meta.url), "utf8"));
  check(name, "fence logs: no shipped file holds flag{<any address in the log>}; the table entry holds a 64-hex hash and no address", !wrapped.length && !!entry && /h: "[0-9a-f]{64}"/.test(entry[0]) && !ips.some((ip) => entry[0].includes(ip)), JSON.stringify({ wrapped, entry: !!entry }));

  // ── the visitor commands (E1-B): ctf, flags, submit, hint, writeup
  const vp = (await get()).page;
  const sayL = async (line, min = 1) => {                       // run a line; the lines it printed (min: wait for at least that many)
    const n = (await ev(vp, () => window.__island.termOut())).length;
    const ran = await ev(vp, (l) => window.__island.term(l), line);
    await vp.waitForFunction(([n, m]) => window.__island.termOut().length >= n + m, [n, min + 1], { timeout: 10000 });
    await vp.waitForTimeout(60);
    return { ran, out: (await ev(vp, () => window.__island.termOut())).slice(n + 1) };
  };
  await ev(vp, () => window.__island.terminal(true));
  const banner = await ev(vp, () => window.__island.termOut());
  check(name, "banner: one new line, 'ctf board available · type ctf', after the old three", JSON.stringify(banner) === JSON.stringify(["pi-sh 1.0 on tty1, cave terminal (volcano, level 1)", "last login: a long time ago, from the helipad", "type help. esc leaves.", "ctf board available · type ctf"]), JSON.stringify(banner));
  const pad = (s) => s.padEnd(14);
  const EMPTY = ["ctf board · 0 of 6 captured", `  [ ] 1 ${pad("fence logs")} open`, ...[2, 3, 4, 5, 6].map((i) => `  [-] ${i} ${pad("???")} offline`), "submit flag{...} · hint <n> · writeup <n>"];
  const bEmpty = await sayL("ctf", 8), bFlags = await sayL("flags", 8);
  check(name, "ctf on the shipped table: fence logs open, five offline slots, exactly", JSON.stringify(bEmpty.out) === JSON.stringify(EMPTY), JSON.stringify(bEmpty.out));
  check(name, "flags is the same board", JSON.stringify(bFlags.out) === JSON.stringify(EMPTY), JSON.stringify(bFlags.out));
  const markOnly = await ev(vp, () => [...document.querySelectorAll(".w-term-out .w-term-line")].slice(-7, -1).map((l) => l.textContent.slice(2, 5)));
  check(name, "state is in the text: every slot line carries its [-] / [ ] / [x] mark", markOnly.join() === "[ ],[-],[-],[-],[-],[-]", JSON.stringify(markOnly));
  // synthetic flags: alpha open, beta open with locked hints, gamma behind a tool
  const VIS = [flag(1, "alpha"), flag(2, "beta", { hints: [{ t: "test hint one" }, { t: "test hint two", when: "tool:scanner" }, { t: "test hint three", when: ["secret:koi"] }], writeup: ["test write-up one", "test write-up two"] }), flag(3, "gamma", { open: "tool:scanner" })];
  await ev(vp, (t) => { window.__island.setSave({ v: 2, logs: [], secrets: [] }); window.__island.ctfLoad(t); }, VIS);
  const bVis = (await sayL("ctf", 8)).out;
  const WANT = ["ctf board · 0 of 6 captured", `  [ ] 1 ${pad("test alpha")} open`, `  [ ] 2 ${pad("test beta")} open`, `  [-] 3 ${pad("???")} offline`, `  [-] 4 ${pad("???")} offline`, `  [-] 5 ${pad("???")} offline`, `  [-] 6 ${pad("???")} offline`, "submit flag{...} · hint <n> · writeup <n>"];
  check(name, "board with test flags: names and states, an offline flag's name hidden", JSON.stringify(bVis) === JSON.stringify(WANT), JSON.stringify(bVis));
  // submit: right, then already
  await ev(vp, () => { document.querySelector(".w-toast").hidden = true; });
  const wS = await ev(vp, () => window.__writes);
  const sub1 = await sayL("submit flag{test_alpha}");
  const toast1 = await ev(vp, () => { const t = document.querySelector(".w-toast"); return { text: t.textContent, hidden: t.hidden, quiet: t.getAttribute("aria-hidden"), live: document.getElementById("w-live").textContent }; });
  check(name, "submit right: 'flag accepted: test alpha (1/6)', one save write", JSON.stringify(sub1.out) === JSON.stringify(["flag accepted: test alpha (1/6)"]) && await ev(vp, () => window.__writes) === wS + 1 && (await flagsOf(vp))["ctf-test-alpha"] === true, JSON.stringify(sub1.out));
  check(name, "submit right: the shared toast shows 'flag captured (1/6): test alpha', kept from screen readers (the log reads it)", toast1.text === "flag captured (1/6): test alpha" && !toast1.hidden && toast1.quiet === "true" && !/flag/.test(toast1.live), JSON.stringify(toast1));
  await ev(vp, () => { document.querySelector(".w-toast").hidden = true; });
  const sub2 = await sayL("submit TEST ALPHA");
  check(name, "submit again: 'already captured: test alpha', no write, no toast", JSON.stringify(sub2.out) === JSON.stringify(["already captured: test alpha"]) && await ev(vp, () => window.__writes) === wS + 1 && await ev(vp, () => document.querySelector(".w-toast").hidden), JSON.stringify(sub2.out));
  check(name, "board after: slot 1 is [x] captured", (await sayL("ctf", 8)).out[1] === `  [x] 1 ${pad("test alpha")} captured`);
  // empty and malformed
  const e1 = await sayL("submit"), e2 = await sayL("submit test alpha!"), e3 = await sayL("submit " + "x".repeat(70));
  check(name, "submit with nothing, or something that can't be a flag: usage and error lines, no write", e1.out[0] === "usage: submit <answer>   (flag{...} or just what's inside)" && e2.out[0] === "submit: that can't be a flag. answers are letters, digits, _ and ., up to 64." && e3.out[0] === e2.out[0] && await ev(vp, () => window.__writes) === wS + 1, JSON.stringify([e1.out, e2.out, e3.out]));
  // wrong answers and the nudge: invalid input isn't a miss; the nudge comes once, on the third miss
  const m1 = await sayL("submit nope_one"), m2 = await sayL("submit nope_two"), mi = await sayL("submit bad answer!"), m3 = await sayL("submit nope_three", 2), m4 = await sayL("submit nope_four");
  check(name, "wrong: 'no flag matches that.', nothing written", [m1, m2, m4].every((m) => JSON.stringify(m.out) === '["no flag matches that."]') && await ev(vp, () => window.__writes) === wS + 1, JSON.stringify([m1.out, m2.out, m4.out]));
  check(name, "the third miss (invalid input not counted) nudges once: 'stuck? try hint <n>'; the fourth doesn't", JSON.stringify(m3.out) === JSON.stringify(["no flag matches that.", "stuck? try hint <n>"]) && !mi.out.includes("stuck? try hint <n>"), JSON.stringify([mi.out, m3.out, m4.out]));
  await ev(vp, () => { window.__island.terminal(false); window.__island.terminal(true); });
  const r1 = await sayL("submit nope_a"), r2 = await sayL("submit nope_b");
  check(name, "a new terminal session starts the count again (two misses, no nudge)", ![...r1.out, ...r2.out].includes("stuck? try hint <n>"), JSON.stringify([r1.out, r2.out]));
  // hint
  const h0 = await sayL("hint"), h9 = await sayL("hint 9"), h4 = await sayL("hint 4"), h3 = await sayL("hint 3"), h2 = await sayL("hint 2", 4);
  check(name, "hint: no slot or a bad one is usage; an empty slot and a closed flag are offline", h0.out[0] === "usage: hint <n>   (n is a slot, 1 to 6)" && h9.out[0] === h0.out[0] && h4.out[0] === "flag 4 is offline. nothing here yet." && h3.out[0] === "flag 3 is offline. nothing here yet.", JSON.stringify([h0.out, h9.out, h4.out, h3.out]));
  check(name, "hint 2: the unlocked hint, then the locked tiers said vaguely, in order", JSON.stringify(h2.out) === JSON.stringify(["flag 2 · test beta", "  1. test hint one", "  2. (another hint unlocks with a tool you don't have yet.)", "  3. (another hint unlocks after you find a certain secret.)"]), JSON.stringify(h2.out));
  const leaked = [h2, h3, h4].flatMap((x) => x.out).filter((l) => /scanner|koi|tool:|secret:|log:|flag:|island:|test hint two|test hint three|gamma/.test(l));
  check(name, "no condition ids, locked hint text or offline names reach the visitor", !leaked.length, JSON.stringify(leaked));
  const bdbg = await ev(vp, () => window.__island.ctf().slots[1].hints);
  check(name, "debug state still shows the tiers (1 of 3 unlocked)", bdbg[0] === 1 && bdbg[1] === 3, JSON.stringify(bdbg));
  await ev(vp, () => { const s = window.__island.getSave(); s.tools.scanner = true; s.secrets = ["koi"]; window.__island.setSave(s); });
  const h2b = await sayL("hint 2", 4);
  check(name, "once unlocked, every hint shows its text", JSON.stringify(h2b.out) === JSON.stringify(["flag 2 · test beta", "  1. test hint one", "  2. test hint two", "  3. test hint three"]), JSON.stringify(h2b.out));
  // writeup
  const w0x = await sayL("writeup"), w4 = await sayL("writeup 4"), w2 = await sayL("writeup 2");
  check(name, "writeup: usage, offline, and locked until captured", w0x.out[0] === "usage: writeup <n>   (n is a slot, 1 to 6)" && w4.out[0] === "flag 4 is offline. nothing here yet." && w2.out[0] === "writeup 2: locked. capture flag 2 first.", JSON.stringify([w0x.out, w4.out, w2.out]));
  await sayL("submit flag{test_beta}");
  const w2b = await sayL("writeup 2", 3);
  check(name, "writeup after the capture: its lines", JSON.stringify(w2b.out) === JSON.stringify(["flag 2 · test beta · write-up", "  test write-up one", "  test write-up two"]), JSON.stringify(w2b.out));
  // the save is full
  await ev(vp, () => window.__island.setSave({ v: 2, logs: [], secrets: [], flags: Object.fromEntries(Array.from({ length: 64 }, (_, i) => ["story-" + i, true])) }));
  const rawF = await raw(vp), wF = await ev(vp, () => window.__writes);
  const full = await sayL("submit flag{test_alpha}");
  check(name, "submit with save.flags full: says it can't be kept, claims nothing, writes nothing", JSON.stringify(full.out) === JSON.stringify(["submit: the island's save has no room left, so this can't be kept."]) && await raw(vp) === rawF && await ev(vp, () => window.__writes) === wF && await ev(vp, () => window.__island.ctf().count) === 0, JSON.stringify(full.out));
  // 5 of 6 to 6 of 6
  await ev(vp, (a) => { window.__island.ctfLoad(a[0]); window.__island.setSave({ v: 2, logs: [], secrets: [], flags: Object.fromEntries(a[1].map((i) => [i, true])) }); }, [SIX, SIX.slice(0, 5).map((f) => f.id)]);
  const c6 = await sayL("submit flag{test_zeta}", 2), c7 = await sayL("submit flag{test_zeta}"), c8 = await sayL("submit flag{test_alpha}");
  const toastC = await ev(vp, () => document.querySelector(".w-toast").textContent);
  check(name, "5 of 6 to 6 of 6: accepted, then 'all six flags captured.' once", JSON.stringify(c6.out) === JSON.stringify(["flag accepted: test zeta (6/6)", "all six flags captured."]) && toastC === "all six flags captured", JSON.stringify([c6.out, toastC]));
  check(name, "submitting again after six: already, no second completion", JSON.stringify(c7.out) === '["already captured: test zeta"]' && JSON.stringify(c8.out) === '["already captured: test alpha"]' && await ev(vp, () => window.__island.ctf().completions) === 1, JSON.stringify([c7.out, c8.out]));
  // the wait, through submit: pending, a failed digest, and the watchdog
  await ev(vp, (t) => { window.__island.setSave({ v: 2, logs: [], secrets: [] }); window.__island.ctfLoad(t); }, SIX);
  await slowDigest(vp, 300);
  const nP = (await ev(vp, () => window.__island.termOut())).length;
  const pend = await ev(vp, () => ({ a: window.__island.term("submit flag{test_alpha}"), b: window.__island.term("submit flag{test_alpha}"), box: document.querySelector(".w-term-in").value }));
  await vp.waitForFunction((n) => window.__island.termOut().length >= n + 2 && !window.__island.ctf().pending, nP);
  await vp.waitForTimeout(400);
  const outP = (await ev(vp, () => window.__island.termOut())).slice(nP);
  check(name, "submit while a check waits: the second is ignored (stays typed), one solve", pend.a && !pend.b && pend.box === "submit flag{test_alpha}" && JSON.stringify(outP) === JSON.stringify(["pi@island:~$ submit flag{test_alpha}", "flag accepted: test alpha (1/6)"]), JSON.stringify({ pend, outP }));
  await ev(vp, () => { document.querySelector(".w-term-in").value = ""; crypto.subtle.digest = () => Promise.reject(new Error("broken")); });
  const fd = await sayL("submit flag{test_beta}");
  check(name, "submit with a failing digest: 'the flag checker failed. try again.', nothing saved", JSON.stringify(fd.out) === '["submit: the flag checker failed. try again."]' && !(await flagsOf(vp))["ctf-test-beta"], JSON.stringify(fd.out));
  await ev(vp, () => { crypto.subtle.digest = () => new Promise(() => {}); });
  const wd = await sayL("submit flag{test_beta}");
  check(name, "submit when the digest never settles: the watchdog's line, then lines run again", JSON.stringify(wd.out) === '["submit: the flag checker didn\'t answer. try again."]' && await ev(vp, () => !window.__island.ctf().pending), JSON.stringify(wd.out));
  await realDigest(vp);
  // closing mid-submit: nothing printed, nothing saved
  await slowDigest(vp, 300);
  const wCl = await ev(vp, () => window.__writes);
  await ev(vp, () => { window.__island.term("submit flag{test_beta}"); window.__island.terminal(false); });
  await vp.waitForTimeout(700);
  check(name, "closing the terminal mid-submit: no save, no toast, nothing pending", await ev(vp, () => window.__writes) === wCl && !(await flagsOf(vp))["ctf-test-beta"] && await ev(vp, () => !window.__island.ctf().pending));
  await realDigest(vp);
  // keyboard: submit typed and entered; focus stays in the box
  await ev(vp, () => window.__island.terminal(true));
  await vp.waitForTimeout(80); await vp.focus(".w-term-in");
  await vp.keyboard.type("submit Test Beta"); await vp.keyboard.press("Enter");
  await vp.waitForFunction(() => window.__island.termOut().includes("flag accepted: test beta (2/6)"));
  check(name, "keyboard submit: accepted, focus stays in the box", await ev(vp, () => document.activeElement === document.querySelector(".w-term-in")));
  const tabs = {};
  for (const w of ["ct", "fla", "sub", "wr", "he", "__"]) { await vp.fill(".w-term-in", w); await vp.keyboard.press("Tab"); tabs[w] = await vp.inputValue(".w-term-in"); }
  const listOf = async (w) => { await vp.fill(".w-term-in", w); await vp.keyboard.press("Tab"); return (await ev(vp, () => window.__island.termOut())).pop().split(/\s+/).sort().join(); };
  const hiList = await listOf("hi"), flList = await listOf("fl"), suList = await listOf("su");
  await vp.fill(".w-term-in", "");
  check(name, "tab completion: ct→ctf, fla→flags, sub→submit, wr→writeup, he→help, __ nothing; hi, fl, su list both matches", tabs.ct === "ctf " && tabs.fla === "flags " && tabs.sub === "submit " && tabs.wr === "writeup " && tabs.he === "help " && tabs.__ === "__" && hiList === "hint,history" && flList === "flags,fly" && suList === "submit,summon", JSON.stringify({ tabs, hiList, flList, suList }));
  // the log can be reached by keyboard now (it scrolls once full): shift+tab from the box lands on it, with a ring
  await vp.focus(".w-term-in"); await vp.keyboard.press("Shift+Tab");
  const logFocus = await ev(vp, () => { const a = document.activeElement; return { log: a === document.querySelector(".w-term-out"), ring: getComputedStyle(a).outlineStyle }; });
  check(name, "the terminal log takes keyboard focus (shift+tab from the box) and shows a focus ring", logFocus.log && logFocus.ring === "solid", JSON.stringify(logFocus));
  await sayL("ctf", 8); await sayL("hint 2", 3);
  // axe with the board and a hint on screen
  const axC = await new AxeBuilder({ page: vp }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).include(".w-term").analyze().then((r) => r.violations.map((v) => `${v.id} (${v.nodes.length})`), (e) => ["axe failed: " + e.message]);
  check(name, "axe (WCAG 2.2 AA) on the terminal showing the board and a hint: no violations", !axC.length, axC.join(", "));
  const logAttrs = await ev(vp, () => { const o = document.querySelector(".w-term-out"); return o.getAttribute("role") + " " + o.getAttribute("aria-live"); });
  check(name, "the terminal's output is still role=log, aria-live=polite", logAttrs === "log polite", logAttrs);

  // ── the secret toast, unchanged by the refactor
  const sp2 = (await get()).page;
  await ev(sp2, () => window.__island.fireEvent("roar"));
  await sp2.waitForTimeout(120);
  const st = await ev(sp2, () => { const t = document.querySelector(".w-toast"); return { text: t.textContent, hidden: t.hidden, aria: t.getAttribute("aria-hidden"), role: t.getAttribute("role"), cls: t.className, anim: getComputedStyle(t).animationName, live: document.getElementById("w-live").textContent, secrets: window.__island.getSave().secrets }; });
  check(name, "secret toast: 'secret found (1/12): too close', popping in, heard by screen readers, announced, saved", st.text === "secret found (1/12): too close" && !st.hidden && st.aria === null && st.role === "status" && /w-toast-in/.test(st.cls) && st.anim === "w-pop" && st.live === "secret found (1/12): too close." && st.secrets.join() === "roar", JSON.stringify(st));
  await sp2.waitForTimeout(3300);
  check(name, "secret toast goes after 3.2 s", await ev(sp2, () => document.querySelector(".w-toast").hidden));
  const rmT = await ev(sp2, () => { window.__island.terminal(true); return getComputedStyle(document.querySelector(".w-term")).animationName; });
  check(name, "normal motion: the terminal still opens with its animation (w-term-in)", rmT === "w-term-in", rmT);

  // ── reduced motion: the terminal and the toast just appear, and both still work
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const rp = await island(rctx); pages.push(rp);
  await ev(rp.page, (t) => { window.__island.ctfLoad(t); window.__island.terminal(true); window.__island.term("submit flag{test_alpha}"); }, SIX);
  await rp.page.waitForFunction(() => window.__island.termOut().includes("flag accepted: test alpha (1/6)"));
  const rmC = await ev(rp.page, () => { const t = document.querySelector(".w-toast"); return { term: getComputedStyle(document.querySelector(".w-term")).animationName, vis: !document.querySelector(".w-term").hidden, toast: getComputedStyle(t).animationName, text: t.textContent, hidden: t.hidden }; });
  await ev(rp.page, () => { window.__island.terminal(false); window.__island.fireEvent("roar"); });
  const rmS = await ev(rp.page, () => { const t = document.querySelector(".w-toast"); return { toast: getComputedStyle(t).animationName, text: t.textContent, hidden: t.hidden }; });
  check(name, "reduced motion: no terminal or toast animation; the ctf toast and the secret toast still show", rmC.term === "none" && rmC.vis && rmC.toast === "none" && rmC.text === "flag captured (1/6): test alpha" && !rmC.hidden && rmS.toast === "none" && rmS.text === "secret found (1/12): too close" && !rmS.hidden, JSON.stringify({ rmC, rmS }));
  await rctx.close();

  // ── 360 px: the board fits, one screen line per board line, no sideways scroll
  const nctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const np = await island(nctx); pages.push(np);
  await ev(np.page, (t) => { window.__island.ctfLoad(t); window.__island.terminal(true); window.__island.term("submit flag{test_epsilon}"); }, SIX);
  await np.page.waitForFunction(() => window.__island.termOut().some((l) => l.startsWith("flag accepted")));
  await ev(np.page, () => { window.__island.term("ctf"); });
  const fit = await ev(np.page, () => {
    const o = document.querySelector(".w-term-out"), lines = [...o.querySelectorAll(".w-term-line")].slice(-8), lh = parseFloat(getComputedStyle(lines[0]).lineHeight);
    return { over: o.scrollWidth - o.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth, tall: lines.filter((l) => l.getBoundingClientRect().height > lh + 1).map((l) => l.textContent), n: lines.length };
  });
  check(name, "360 px: the board has no sideways scroll and every board line fits on one line", fit.over <= 0 && fit.page <= 0 && !fit.tall.length && fit.n === 8, JSON.stringify(fit));
  await nctx.close();

  // ── axe on the open terminal
  await ev(page, () => window.__island.terminal(true));
  await page.waitForTimeout(300);
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).include(".w-term").analyze().then((r) => r.violations.map((v) => `${v.id} (${v.nodes.length})`), (e) => ["axe failed: " + e.message]);
  check(name, "axe (WCAG 2.2 AA) on the open terminal: no violations", !ax.length, ax.join(", "));

  // ── no web crypto: a clean message, no page error
  const noc = await get("", { init: () => { Object.defineProperty(window.crypto, "subtle", { value: undefined, configurable: true }); } });
  const nocOut = await ev(noc.page, (t) => { window.__island.ctfLoad(t); window.__island.terminal(true); window.__island.term("__ctf flag{test_alpha}"); return window.__island.ctfCheck("flag{test_alpha}"); }, SIX);
  check(name, "no web crypto: checks say no-crypto, the terminal prints it cleanly", nocOut.status === "no-crypto" && (await lastLine(noc.page, "__ctf:")) === "__ctf: no-crypto", JSON.stringify(nocOut));

  // ── touch: tap the box, type, tap ↵
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const tp = await island(tctx); pages.push(tp);
  await ev(tp.page, (t) => { window.__island.ctfLoad(t); window.__island.terminal(true); }, SIX);
  await tp.page.tap(".w-term-in"); await tp.page.keyboard.type("submit flag{test_epsilon}"); await tp.page.tap(".w-term-go");
  check(name, "touch (390 x 844): tap the box, type submit, tap ↵: accepted", (await lastLine(tp.page, "flag accepted")) === "flag accepted: test epsilon (1/6)");
  check(name, "touch: focus is back in the box after ↵", await ev(tp.page, () => document.activeElement === document.querySelector(".w-term-in")));
  await tctx.close();

  // ── nothing changes for visitors
  const oldp = await get("", { old: true });
  // through the box itself (the code before the ctf has no terminal hooks): help, then tab on an empty line
  const helpOf = async (p) => {
    await ev(p, () => { const t = document.querySelector(".w-term"), i = t.querySelector(".w-term-in"); t.hidden = false; t.querySelector(".w-term-out").innerHTML = ""; i.value = "help"; t.querySelector(".w-term-row").requestSubmit(); i.value = ""; });
    await p.focus(".w-term-in"); await p.keyboard.press("Tab");
    return ev(p, () => [...document.querySelectorAll(".w-term-out .w-term-line")].map((l) => l.textContent));
  };
  const helpNew = await helpOf(page), helpOld = await helpOf(oldp.page);
  const NEWHELP = ["  ctf | flags       the ctf board: six flags to capture", "  submit <answer>   check a flag", "  hint <n>          hints for flag n", "  writeup <n>       how flag n works, once it's captured"];
  const at = helpOld.findIndex((l) => l.startsWith("  secrets ")) + 1;
  const wantHelp = [...helpOld.slice(0, at), ...NEWHELP, ...helpOld.slice(at, -1)];
  const tabOld = new Set(helpOld[helpOld.length - 1].split(/\s+/)), tabNew = new Set(helpNew[helpNew.length - 1].split(/\s+/));
  const added = [...tabNew].filter((w) => !tabOld.has(w)).sort().join(), lost = [...tabOld].filter((w) => !tabNew.has(w));
  check(name, `help is ${STALE}'s plus exactly the four ctf lines (after secrets); nothing else changed`, JSON.stringify(helpNew.slice(0, -1)) === JSON.stringify(wantHelp), JSON.stringify(helpNew.slice(0, -1)));
  check(name, `tab completion is ${STALE}'s plus exactly ctf, flags, hint, submit, writeup; no __ctf`, added === "ctf,flags,hint,submit,writeup" && !lost.length && !tabNew.has("__ctf"), JSON.stringify({ added, lost }));
  const plain = await browser.newPage(); const perr = []; plain.on("pageerror", (e) => perr.push(e.message));
  await plain.goto(`${BASE}#island`); await plain.waitForSelector("#world.show", { timeout: 30000 }); await plain.waitForTimeout(500);
  const vis = await plain.evaluate(() => { const f = document.querySelector(".w-term-row"), i = document.querySelector(".w-term-in"); i.value = "__ctf flag{test_alpha}"; f.requestSubmit(); const out = [...document.querySelectorAll(".w-term-out .w-term-line")].map((l) => l.textContent); return { api: window.__island === undefined, last: out.pop() }; });
  check(name, "without ?debug=1: no test API, and __ctf is not a command", vis.api && vis.last === "__ctf: command not found. try help", JSON.stringify(vis));
  pages.push({ errors: perr }); await plain.close();

  const errs = pages.flatMap((it) => it.errors);
  check(name, "no page errors", !errs.length, [...new Set(errs)].join(" | "));
  await browser.close();
}
server.close();
console.log(fails.length ? `\n${fails.length} failed:\n- ` + fails.join("\n- ") : blocked.length ? `\nnothing failed; blocked: ${blocked.join(", ")}` : "\nthe ctf engine works");
process.exit(fails.length ? 1 : blocked.length ? 2 : 0);
