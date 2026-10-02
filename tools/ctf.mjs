#!/usr/bin/env node
/* ctf: the Phase 9 ctf engine (E1-A) in each engine, through the ?debug=1 test API. Every flag here
   is a synthetic test flag injected with __island.ctfLoad(), with a synthetic answer; no real
   flag's answer is used or stored anywhere. Hashes are made here with tools/ctfhash.mjs.
   - the shipped table: valid, no flags yet, all six slots offline;
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
   - nothing changes for visitors: help and tab completion match STALE's, and __ctf doesn't exist
     without ?debug=1.

     node tools/ctf.mjs                            chromium, firefox and webkit
     node tools/ctf.mjs --engines=chromium,webkit  only these

   Exit 1 if a check failed, 2 if nothing failed but an engine couldn't launch (blocked, not failed),
   0 when everything asked for ran and passed. */
import { chromium, firefox, webkit } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
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
  check(name, "shipped table: valid, no flags yet, six slots all offline, nothing waiting",
    shipped.shipped === 0 && !shipped.shippedProblems.length && !shipped.loaded.length && shipped.slots.length === 6 && shipped.slots.every((s, i) => s.slot === i + 1 && s.state === "offline" && s.id === null) && shipped.count === 0 && !shipped.pending, JSON.stringify(shipped));

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
  check(name, "the injected table doesn't survive a reload (the shipped one comes back)", await ev(page, () => window.__island.ctf().loaded.length === 0));
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
  await tp.page.tap(".w-term-in"); await tp.page.keyboard.type("__ctf flag{test_epsilon}"); await tp.page.tap(".w-term-go");
  check(name, "touch (390 x 844): tap the box, type, tap ↵: solved", (await lastLine(tp.page, "__ctf: match")) === "__ctf: match ctf-test-epsilon (1/6)");
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
  check(name, `help and the full tab completion list are identical to ${STALE}'s`, JSON.stringify(helpNew) === JSON.stringify(helpOld) && !helpNew.join("\n").includes("ctf"), JSON.stringify(helpNew.slice(-1)));
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
