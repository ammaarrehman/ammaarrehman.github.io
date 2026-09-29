# Handoff: Ammaar's ePortfolio and pi's island

For a fresh Claude Code session. Read this whole file first, then the two plan documents in section 2,
then carry on from section 9. It is written to put you exactly where the last session left off.
Written 2026-09-27, updated 2026-09-28 after the whole-island art conversion, the audit fixes R1 to R8 and their deploy (`git log` for the exact state).

---

## 1. The project

- **Owner:** Ammaar Rehman. Refer to him by name; in handoff copy he is "he".
- **What it is:** his personal ePortfolio, plain HTML, CSS and JavaScript with no framework and no build
  step. The main page is a terminal-themed portfolio. Behind the orb in the hero is **pi's island**, a
  canvas game in `js/world.js` (a small white creature, pi, walks a dinosaur island whose landmarks hold the
  portfolio). The island is now **Mossgate Reserve**.
- **Live site:** https://ammaarrehman.com (Cloudflare Workers static assets). `lab.ammaarrehman.com` is
  planned (a Pi, through a Cloudflare Tunnel) but not live.
- **Repo:** `/Users/ammaarrehman/projects/GITHUB REPO/ammaarrehman.github.io`, branch `main`.
  - Push to GitHub over HTTPS (`origin`); the `gh` credential helper does the auth. There is no SSH key.
  - **GitHub is the source of truth.** gitlab.com/ammaarrehman is an automatic weekly mirror (Sundays
    10:00, launchd, `~/gitlab-mirror`). Never push to GitLab and never add GitLab remotes; the mirror
    overwrites GitLab. New GitHub repos are copied to GitLab as private projects on their own. (This
    overrides handoff 3 C3's `git remote add gitlab`.)
  - Ammaar's GitHub account is **flagged** (his repos 404 to the public). That's why repo links are off.
- **Commits:** one commit per item, each message ending with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

  Never force-push. Push after each batch.

## 2. The plan documents (read them)

| File | What |
|---|---|
| `~/Downloads/pi-island-handoff-2.md` | Parts A to F: audit, hosting, island fixes, game design, CTF, containment drill, live homelab status, standalone packaging. Still stands except where handoff 3 replaces it. |
| `~/Downloads/pi-island-handoff-3.md` | The current plan: Parts A to M and **the build order at its end** (Phases 6 to 19). |
| `~/Downloads/HANDOFF.md` | A **separate** plan: rebuilding Ammaar's homelab (Pis). Not this repo. His homelab audit will settle the DNS wording (P-11 below). |
| `docs/game-design.md` | The game's source of truth, written from both handoffs plus the decisions, with what's built. Keep it updated. |
| `AUDIT.md` | The site audit: every finding, the claims inventory (C-1 to C-32), the copy batch (P-1 to P-14) and its status. |
| `docs/hosting.md` | Hosting, deploys, Cloudflare dashboard steps, the deploy log, and how to undo each step. |
| `docs/dns-claim.md` | Steps for Ammaar to make "AdGuard Home in front of recursive Unbound" true. |
| `README.md` | Running locally, switches, cache versions, debug flags, storage keys, config map, art pipeline, dead-file candidates. |

**Reference images** are in `~/Documents/pi-island-refs/` (outside the repo on purpose):
- `ref-1` to `ref-9`: as described in handoff 3's D0 table.
  - ref-1: The Climb's vista.
  - ref-2: pond and cliff.
  - ref-3: rocks.
  - ref-4: river and bridge.
  - ref-5: tree canopy.
  - ref-6: cave mouth.
  - ref-7, ref-8, ref-9: Ankylosaurus, raptor, Styracosaurus.
- `brachiosaurus-shape-ref.png`: a 123RF watermarked stock image. It's a shape reference only; never copy or ship it.
- `middle-path-drawing.jpg`: the original drawing the kaiju comes from.
- `older-*`: earlier references (the old secret scene, the fossil dig site, the village).

Rules for the references: use them for style. Ammaar says they're open source and can be borrowed from,
but don't copy them wholesale, especially the environments, which must follow handoff 3's D1 rules. Never
ship them, never commit them, and never name their sources anywhere in the site or repo.

## 3. Ammaar's decisions (these override handoff 3's 0.1 table)

| # | Topic | Decision |
|---|---|---|
| 1 | DNS (AdGuard to DoH or Unbound) | On hold. Ammaar is doing a full homelab audit (see `~/Downloads/HANDOFF.md`). Until verified, no copy says Unbound resolves queries. P-11 in AUDIT.md waits. |
| 2 | FBLA | Off the site (done). The résumé is his call. |
| 3 | Ready5 | Keep "in cohort" in the hero. Elsewhere it reads "in progress · expected Nov 2026". |
| 4 | Island personal details | Keep the cats, cockatiels, koi pond, Middle Path drawing and timezone. The car is "Ammaar's car" (done). |
| 5 | Raptors | Feathered Utahraptors (done). |
| 6 | Email | Keep ammaarrehmanf@gmail.com. hello@ammaarrehman.com comes later; handoff 3 Part L is on hold. |
| 7 | Code host | GitLab, username `ammaarrehman`. Repos are mirrored there already (private). |
| 8 | The Climb ending | Variant A. |
| 9 | Reserve name | **Mossgate Reserve** (not Cinderfern). |
| 10 | Kaiju | Option A (done): his grey, pi's rounded head and eyes, soft back bumps, tail lines that glow at night. |
| - | Copy batch P-1 to P-14 | Approved 2026-09-27. Applied: P-1 to P-7, P-10, P-12. P-8 and P-9 show once `CODE_HOST` is set. P-11 waits. P-13, P-14 unchanged. P-15 (trading-lab: nine experiments, "each judged on a single run") approved and applied 2026-09-28; the served résumé (`f672ca8`) says nine too. P-13 and P-16 (no course names or count), P-17 (House of Delegates removed) and P-18 ("guaranteed transfer admission" removed) follow his 2026-09-29 résumé (`3e31d13`), whose contact links are all clickable. |
| - | TLS | Done 2026-09-28 (R3): Minimum TLS Version is TLS 1.2, with TLS 1.3 still on. Ammaar verified TLS 1.0 and 1.1 fail, 1.2 connects, and the SSL Labs recheck passed as expected. Before that, 1.0 and 1.1 were still accepted and SSL Labs gave B. |
| - | Web Analytics | Done 2026-09-28 (R6): Cloudflare's automatic injection is off. Ammaar verified the live page has no `cloudflareinsights`, DevTools shows no CSP errors, and Lighthouse passed as expected. The CSP was never widened; keep it that way. |

## 4. Ground rules (from the handoffs; they bind every session)

- **Claims about Ammaar:**
  - Every claim must survive a federal background check. Never drop a scope qualifier, and never describe in-progress work as done.
  - The résumé PDF on the site is the source.
  - Don't edit a factual claim directly: propose it in AUDIT.md's copy table and wait for approval.
  - UI, game text and NPC lines can change freely, but game text may state nothing about Ammaar beyond approved copy.
- **Wording:**
  - Education is "incoming student at UMD" and never implies current enrollment.
  - The DNS is per-device; never write "network-wide".
- **Style:** no em dashes anywhere shipped. No buzzwords, tricolons or "let's connect" closers. Plain sentences.
- **Original content only:**
  - Nothing from any film or franchise: no names, quotes, logos, music, iconic scenes or creature designs.
  - The dilophosaurus has no frill and no spit.
- **Secrets and privacy:**
  - Never commit tokens or credentials.
  - No private IPs, hostnames, MACs or Tailscale addresses in the repo or anything served.
  - Fake data uses the RFC 5737 IP ranges and RFC 2606 domains.
  - The weather location is 39.27, -76.80 only, never the visitor's.
  - The Cloudflare Tunnel token is entered by Ammaar only; never ask him to paste it.
- **Engineering:**
  - Framework-free, no build step.
  - Dev tooling lives in `tools/`, with its own `package.json` and gitignored `node_modules` and `.venv`.
  - Nothing in `tools/`, `docs/`, `*.md` or `art/` ships; the deploy allowlist enforces it.
- **Process:**
  - One commit per item. Report after each phase: what changed, what you tested, what you couldn't test.
  - **Stop and ask Ammaar** before:
    - claim or copy changes
    - anything that costs money
    - anything on the Pi, unless he gives SSH for that step
    - deleting portfolio content
  - Also stop at each "Stop" in the build order.
- **Outside services:** only Open-Meteo and NOAA SWPC may be added (Part I). Nothing else without asking.

## 5. How to work in this environment

- **Serve locally:** `node tools/serve.mjs`, which serves on http://localhost:8000 and applies `_headers` like Cloudflare, with a real 404. Or `python3 -m http.server 8000`.
- **Deploy:**
  - `node tools/deploy.mjs --dry-run` builds `.deploy/` from the allowlist and checks it. `node tools/deploy.mjs` builds, checks, deploys with wrangler (already logged in via `npx wrangler login`) and smoke-tests the live site. `node tools/deploy.mjs --check` runs only the live checks.
  - If the live checks fail with `ENOTFOUND`, this Mac's DNS cache is stale; check with `dig ammaarrehman.com @1.1.1.1`, or use `curl --resolve ammaarrehman.com:443:104.21.52.117`.
- **Cache version:** every script and CSS reference carries `?v=`. It's currently `20261016`. Bump it everywhere together (`index.html`, `js/site.js`, `js/world.js`) whenever a script, the CSS or a baked image changes. Nine places in `index.html`.
- **Audit and tests** (in `tools/`; run `npm install` and `npx playwright install` once):
  - `node audit.mjs` covers A2, A3, A6, A7 and A9 across Chromium, WebKit and Firefox, five sizes, axe, keyboard, reduced motion and links. Add `--only=a3,a9` or `--offline` to narrow it.
  - `node lighthouse.mjs`: add `--local`, or `--resolve=104.21.52.117` when the DNS cache is stale.
  - `npm run html` (html-validate) and `npm run spell` (cspell; add real words to `tools/cspell.json`).
  - `node doors.mjs` (every door, worst frame under 16 ms), `node orbs.mjs` (main-page orbs stay sharp) and `node shots.mjs <tag> name=x,y ...` (island screenshots at named places, in tiles, into `tools/out/shots/`).
  - `node focus.mjs` (island keyboard focus, R2) and `node codelinks.mjs` (repo links with js off, no host and a GitLab host, R4).
  - Exit codes: `audit.mjs` and `orbs.mjs` exit 1 on a failure and 2 when nothing failed but something couldn't run (a browser that won't launch). A 2 is not a pass. `audit.mjs --engines=chromium,webkit` leaves Firefox out on purpose (reported as skipped).
  - `node atlas.mjs` bakes the man-made sprites (`tools/props-src.js`) into `img/atlas/props.png`; `tools/.venv/bin/python envart.py` bakes the environment atlas. Both rewrite their frame table line in `js/world.js` (`var PROPS`, `var ENV`).
- **Environment quirks:**
  - Playwright browsers must run **outside the command sandbox** (`dangerouslyDisableSandbox: true`); WebKit and Chromium then work.
  - **Firefox can't launch inside the Claude app at all.** macOS won't let the app create `~/Library/Application Support/Firefox`. Ammaar runs the Firefox audit in his own Terminal:

    ```bash
    cd ~/projects/"GITHUB REPO"/ammaarrehman.github.io/tools && npm install && npx playwright install firefox && node audit.mjs --only=a7
    ```

  - WebKit's screenshots inject a style tag that the CSP refuses. The audit reads the console *before* taking screenshots; keep it that way.
  - The in-app browser pane throttles `requestAnimationFrame` when hidden. Drive the island with Playwright and `?debug=1` instead.
  - `?debug=1` exposes `window.__island`: `teleport(x, y)` in world px (tiles × 16 + 8), `getState()`, `frames(clear)`, `ground()` (the painted map as a PNG, and its paint time) and `props()`. Handoff 2 C5 grows this into the full test API.
- **Python art tools:** use `tools/.venv/bin/python` (pillow, numpy). Recreate the environment with `python3 -m venv tools/.venv && tools/.venv/bin/pip install -r tools/requirements.txt`.
- **Private artifacts:** the deploy scrubs `.deploy/`. The screenshots and audit output live in `tools/out/` (gitignored). The art test area's before and after images are in `tools/out/test-area/`; the whole island's, per area, in `tools/out/island-ba/` (`overview-1.png`, `overview-2.png`, and `ba-<area>-1x/2x.png`).
- **The island's code** is one IIFE, `js/world.js`, about 4,700 lines. Sections are marked `/* ════════ name ════════ */`. Key pieces:

  | Area | Where |
  |---|---|
  | Map generation | `coast`, `hiEdge`, `midEdge`, `tier`, `RIVER_PTS`, `road(...)`, `CURVES` |
  | Planting | the `props` loop, `forest()`, `treeFor` + `stand` (species by terrace), `plantUnder`, `TALL` |
  | Ground paint | `kindAt` (grass, dirt, sand, water per pixel), `paint()` (colour, decals, dock, bridges, cliffs via `face`/`stairs`), `grassKind` + `BIOME`, `FOAM` (the surf) |
  | Sprites | `SPR` (filled from `PROPS` and `ENV` atlases), `sprite()`, `outline()` (still used by rooms and realities) |
  | Creatures | `DINOS`, `SHEET`, `drawCritter`, `softShadow` |
  | Rooms | `ROOMS`, `enterRoom`, `roomBgStep`, `renderRoom` |
  | Transitions | `irisTo`, `drawIris`, `DOOR_CLOSE`, `DOOR_OPEN`, `xfade`, `doorAnim` |
  | The old secret scene | `side`, `renderSide`, `DEITY_LINES` |
  | Realities | `SKINS`, `duotone` |
  | Terminal | `CMDS` |
  | Saves | `island-save` |
  | Audio | `js/audio.js` (`window.Sound`) |
  | Main page | `js/orb.js` (orbs), `js/windows.js` (window buttons, dock), `js/site.js`, `js/head.js` (`window.SITE.CODE_HOST`), `js/boot.js` |

## 6. Repo map (what's where)

| Path | What |
|---|---|
| `index.html`, `404.html`, `css/styles.css` | The site. |
| `js/` | `head.js`, `site.js`, `boot.js`, `windows.js`, `orb.js`, `face.js`, `hands.js`, `skills.js`, `theme.js`, `audio.js`, `world.js`. |
| `assets/` | Images, résumé PDF, `island/dinos.png` (the baked creature sheet), `work/` screenshots (scrubbed). |
| `img/atlas/env.png`, `img/atlas/env.json` | Environment sprites (trees, plants, rocks, reeds, lilies, cave mouth), baked by `tools/envart.py`. |
| `art/palette.json`, `art/src/dinos-src.png` + `.json` | The master palette; the hand-drawn creature source frames. |
| `fonts/` | Self-hosted woff2 fonts + OFL licenses. |
| `_headers`, `wrangler.jsonc`, `.well-known/security.txt`, `robots.txt`, `sitemap.xml`, `site.webmanifest` | Hosting config. |
| `tools/` | `deploy.mjs`, `serve.mjs`, `audit.mjs`, `lighthouse.mjs`, `orbs.mjs`, `doors.mjs`, `shots.mjs`, `animate.py`, `brachio.py`, `envart.py`, and older `marks.py` / `duotone.py` / `resume.py` (see the dead-file list in the README). |
| `docs/` | `hosting.md`, `dns-claim.md`, `game-design.md`. |
| Local branch `gh-pages` (not pushed) | A redirect page for github.io, for when the GitHub flag clears (docs/hosting.md). |

## 7. What's done

### Audit fixes, 2026-09-28 (Claude, local session then a cloud session)

The code findings in `docs/audit-2026-09-28.md` are fixed and committed; its "Fix status" table has each commit and how it was checked.
- R1 `4dccee8`: the deep-link table is `ROUTES`, so `DEEP` stays the deep-sea tile code.
- R2 `0103c08` (+ `bc5d241`, a spelling rename): the portfolio is inert while the island is open, and Tab is kept inside the top layer. Test: `tools/focus.mjs`.
- R5 `b7f4e72`: painted water blocks movement, and walkable tiles with water at their centre are solid.
- R4 `624b157`: the markup has repo paths (`data-repo`) and no hrefs, and repo-only bits are hidden unless `head.js` adds `.code-host`. Safe with JS off. Test: `tools/codelinks.mjs`.
- R7 `d4e0bf1`: `tools/audit.mjs` gives every check pass/fail/blocked/skipped, and the exit code follows.
- R8 `103d83e`: no blur regression. The orb test's baseline was shot mid-reveal, and now waits for the reveal.
- Cache version `20261016` (`4acef7f`).
- On GitHub `main` (`b6cdf53`). The cloud session's push was refused (403), so Ammaar brought the commits to the Mac as a git bundle and pushed from there.
- **Deployed** 2026-09-28 by Ammaar with `node tools/deploy.mjs`: Cloudflare version `a31ba8b4-4ef8-448f-8317-a39dadbe2078`, `ammaarrehman.com` live, `--check` passed (deploy log in `docs/hosting.md`).
- Mac results: `focus.mjs` and `orbs.mjs` pass in Chromium and WebKit. `audit.mjs` gave 79 passed, 0 failed, 2 blocked (Firefox inside the Claude app, LinkedIn's 999). The Firefox audit from Ammaar's Terminal works, and LinkedIn works by hand.

### Codex audit checkpoint, 2026-09-28

User requested a full audit first, then phase-by-phase next steps with progress updates, and approved installing gitleaks. They then requested a handoff to Claude. Read `docs/audit-2026-09-28.md` first. It records completed checks, fresh visual critique, new bugs and explicit limits. No production code/copy/art changed or deployed in this checkpoint. Added supplemental read-only audit collectors and Phase 7 proposal/checklist docs. Gitleaks 8.30.1 installed, but full-history scans did NOT execute: the approval service hit an account usage limit. Scan script is prepared, not validated by a completed scan. No repository cleared for publication. See `docs/phase-7-proposals.md` and `docs/screenshots.md`.

The following historical implementation entries describe previously committed/pushed/live work, not approval of its current visual quality:

- **Phase 5 (go live):**
  - Fonts self-hosted.
  - Lazy-loaded island.
  - GitHub links switched off, now `CODE_HOST`.
  - Cloudflare Workers deploy with a strict CSP and security headers.
  - `security.txt`.
  - Canonical, OG tags and JSON-LD on the new domain.
  - Screenshots scrubbed (private IP redacted).
  - FBLA removed, NightStar removed from tools, boot-screen hostnames removed, `alumniOf` removed.
- **Phase 6 (audit):**
  - Accessibility: axe clean (main page light and dark, 404, island dialogs); contrast, tap targets, reduced motion.
  - Phone nav pins résumé and mail.
  - html-validate, cspell and no em dashes.
  - Audio waits for a gesture; one canvas readback per frame.
  - Lighthouse live: 100 performance, 100 accessibility, 92 best practices, 100 SEO. (The 92 was Cloudflare's injected beacon; fixed 2026-09-28, R6.)
  - AUDIT.md complete; README, docs/hosting.md and docs/dns-claim.md written.
  - The approved copy batch applied, and `CODE_HOST`.
- **B1:** the blurry orbs fixed; the cause was sizing from the scaled restore animation. `tools/orbs.mjs` tests it.
- **B2 (transitions):**
  - The real cause of the "black hold" was an iris arc drawn with 6.283 instead of 2π, which gave solid black for 600 ms.
  - Doors now: the door opens, pi steps in, a 150 ms close and 170 ms open.
  - Rooms are built ahead of time; worst frame about 3 ms.
  - Reduced motion gets a 150 ms crossfade.
- **Art and animation:**
  - Kaiju A with a synth growl.
  - The Brachiosaurus redrawn (rig in `tools/brachio.py`).
  - All creatures animated smoothly by `tools/animate.py`: 12-frame walks and idles, 8 graze, 6 call, playing at 8 to 22 fps.
  - Utahraptors feathered.
  - Soft cool shadows.
- **D3 art test area:** approved by Ammaar on 2026-09-28, then converted island-wide (below).
  - It covered the west meadow falls and the koi garden.
  - New palette and environment atlas.
  - Irregular edges; water with rims and underwater stones; decals in drifts.
  - Cliffs as vertical stone slabs; foam at every waterfall.
- **Whole-island art conversion (2026-09-28, commits `8d7dddf` to the undergrowth thinning):**
  - One ground painter for the whole map; edges wander off the grid; the coast, river, roads and cliffs follow their smooth curves (no tile stairsteps); stairs where paths climb; waterfalls hang off the smooth edge.
  - The surf follows the real waterline; glints and streaks stay on water.
  - Four grass kinds per terrace; three tree species per terrace with 2 to 3 variants; the conifer is now a real monkey-puzzle.
  - All plant, rock and nest props from the env atlas; man-made sprites from the new props atlas (D2), outlines recoloured per D1 rule 4.
  - Paint about 370 ms (desktop Chromium; open time unchanged); canvas memory about 18.6 MB desktop, 16.7 MB phone.
- **E3 entrance:** ref-6-style cave mouth with the terminal glowing inside, a puddle and bare trees. The tunnel and chamber aren't built yet.
- **Docs:** `docs/game-design.md` written.

## 8. Waiting on Ammaar

1. **Island visual quality reopened:** Ammaar says the conversion does not look good/fully reworked. Fresh assessment in `docs/audit-2026-09-28.md` agrees it needs a coherent art-direction/layout pass, not simply more props. Propose one cohesive slice for approval before expanding it. Park plaque still reads "PI'S ISLAND" rather than Mossgate; buildings/landmarks retain older art. Phase 12 map/layout approval still applies.
2. HSTS: confirm after a week (raise to `max-age=31536000; includeSubDomains` in `_headers` on or after 2026-10-04 if nothing broke).
3. The homelab audit, which settles P-11.
4. Dead-file candidates (README). Résumé bullet issue is closed for the current asset after a fresh render/extraction; tagged-PDF accessibility remains optional future work.
5. GitLab: make each mirrored project public after the secrets scan (Phase 7). Check the weekly mirror doesn't reset visibility.

## 9. Next steps, in order

Follow handoff 3's build order. Where it stands:

1. **Phase 6:** original copy batch approved/applied; fresh audit complete; its code findings (R1, R2, R4, R5, R7, R8) are fixed (section 7). Deployed, and checked on the Mac in Chromium and WebKit. R3 (minimum TLS 1.2) and R6 (Web Analytics injection off) are set and verified. Phase 6's audit items are complete; still open elsewhere: HSTS on or after 2026-10-04 (section 8), the homelab audit (P-11), the dead-file list, and the island art pass (step 2).
2. **Art conversion:** terrain/asset implementation landed, visual quality NOT accepted. See section 8 and the new audit. Propose a coherent slice; do not mark the whole island finished. Buildings/landmarks, bridges and helipad remain candidates. The pi and "future" reality tower sprites are still built at runtime.
3. **Phase 7 (portfolio upgrades):**
   - Current checkpoint: gitleaks installed; `tools/history-review.mjs` prepared, scan not run due approval-service usage limit. Retry with normal approval once available. Do not bypass the failed approval. Four diagram proposals and screenshot checklist are written; diagrams still require Ammaar's OK.
   - **C2 pre-flight** on every repo the site links to:
     - `gitleaks detect` on the full history (install it with Homebrew; ask first).
     - Grep for private IP ranges, hostnames and MACs.
     - Report every hit, masked. Don't rewrite history.
   - Before `CODE_HOST` goes on, two visible labels still say "github": the hero's `github` command link and the contact list's `github` row (`github.com/ammaarrehman`). With a GitLab host they'd link to GitLab under the wrong name. Give them `data-host-name` or new wording (UI text, not a claim), and extend `tools/codelinks.mjs` to check it.
   - Then Ammaar flips the GitLab projects public and you set `CODE_HOST` to `{ name: "GitLab", base: "https://gitlab.com/ammaarrehman" }` in `js/head.js`. Verify every GitLab link returns 200 (`node audit.mjs --only=a9`).
   - Add GitLab to the JSON-LD `sameAs` and a `rel="me"` link.
   - **K (project diagrams):**
     - Inventory the cards; there are 4 featured, not 9.
     - Propose each diagram's nodes and arrows from approved copy only, and get Ammaar's OK before drawing SVGs in the site's style.
     - Write `docs/screenshots.md` (K4's retake checklist).
   - **L6 email:** on hold (decision 6).
4. **Phase 8 (foundations):**
   - Handoff 2 C5: grow `window.__island` (`step`, `setSave`, `setSeed`, `fireEvent`), plus Playwright scenarios on three engines.
   - C4: the bug hunt (the handoff 2 list, and handoff 3 B2's cave transition once the tunnel exists).
   - D11: save v2 with migration, and map data layers including height.
5. **Phase 9:** the CTF (handoff 2 E1): six flags, stored hashed, with hints and write-ups.
6. **Phase 10:** the art test-area stop (already reached; see step 2).
7. **Phase 11:** movement (F1 to F5): heights, jumping and falling, crouch and stealth (the caged Utahraptors are the stealth tutorial), sprint and stamina, swimming, the volcano with lava and respawn, the new key bindings.
8. **Phase 12:**
   - The map export (handoff 2 C1 step 1) and the regions plan. **Stop** for Ammaar's approval.
   - The home island layout.
   - The terminal cave's tunnel and chamber (E3; the entrance is done).
   - Interiors per E6.
9. **Phase 13:** weather and events (Part I).
10. **Phase 14:** The Climb (Part J), with the dread engine (handoff 2 C3). Use ref-1 for the vista's composition only.
11. **Phases 15 to 19:** NPCs and quests (H); regions and species (Styracosaurus from ref-9, etc.) with the camera and Field Guide; the containment breach (handoff 2 E2); Server Key, the reef and live status (needs the lab on the Pi); the standalone game (handoff 2 Part F).

## 10. Known gaps and notes

- The audit's confirmed bugs (the `DEEP` collision, focus escaping the island, three walkable tiles painted as water) are fixed (section 7).
- Firefox can't launch inside the Claude app on the Mac, so `audit.mjs` reports it as blocked (exit 2) there. Run the Firefox audit from Ammaar's own Terminal (section 5), which works. The orb test's Chromium contact failures were a test-timing problem, now fixed (R8). Supplemental collectors (`review.mjs`, `island-review.mjs`) gather evidence and are not pass/fail gates.
- Cloud sessions (claude.ai/code): the container has Chromium only, and it is an older build than the pinned Playwright 1.63 expects. Point `PLAYWRIGHT_BROWSERS_PATH` at a scratch directory whose `chromium_headless_shell-1243/chrome-headless-shell-linux64/` links to `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/*`, with `chrome-headless-shell` linked to `headless_shell`. Don't run `playwright install`. There is no WebKit or Firefox, no `~/.agent-handoff`, and no `tools/.venv`. The network policy also blocks `ammaarrehman.com` and SSL Labs, so live checks can't run there. GitHub push may be refused (403) if Claude's GitHub access isn't connected; then hand the commits over as a git bundle (`git bundle create <file> origin/main..HEAD`) and push from the Mac.
- `doors.mjs` misses its 16 ms budget on some frames in the cloud container (software rendering). The commit before the audit fixes misses it the same way, and worse, so it isn't a regression. Judge door timing on the Mac.

- The ground painter's pixel edges can sit up to about half a tile off the collision tiles (the waterline is biased out to sea so walkable sand never looks wet). Road pixels can cross a solid cliff-rim tile at a stair edge.
- The lowland is a narrow strip of clearings, so it has few inland trees; adding woods there is a layout change for Phase 12.
- The Utahraptor's feathers are subtle at 33 px wide; consider a bigger sprite when the creatures get their full art pass.
- The far legs in `animate.py` are darkened copies of the near legs. That's fine at game scale; the Brachiosaurus uses a real rig.
- The pterosaur is the original sprite, kept as drawn. The internal creature key is still `raptor`; only the text says Utahraptor.
- `tools/resume.py` is out of date against the résumé PDF, and the rules say never to regenerate the PDF from it.
- The Loom demo link on the triage card returns 200. LinkedIn returns 999 to scripts, so check it by hand.
- Ammaar said he wants "everything" done; the build order above is long. Work phase by phase, report after each, and stop at each Stop. When he pushes for speed, prefer finishing whole, tested pieces over half-built ones.
