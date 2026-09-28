# Handoff: Ammaar's ePortfolio and pi's island

For a fresh Claude Code session. Read this whole file first, then the two plan documents in section 2,
then carry on from section 9. It is written to put you exactly where the last session left off.
Written 2026-09-27, updated 2026-09-28 after the whole-island art conversion (`git log` for the exact state).

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
| - | Copy batch P-1 to P-14 | Approved 2026-09-27. Applied: P-1 to P-7, P-10, P-12. P-8 and P-9 show once `CODE_HOST` is set. P-11 waits. P-13, P-14 unchanged. |
| - | TLS | Ammaar says TLS is 1.3. It is enabled, but on 2026-09-27 TLS 1.0 and 1.1 still completed handshakes (`openssl s_client -tls1 -cipher 'DEFAULT@SECLEVEL=0'`), so the minimum is still 1.0 and SSL Labs gives B. The fix is the separate "Minimum TLS Version = 1.2" switch; the click path is in docs/hosting.md. Recheck and tell him politely with the evidence; don't argue. |
| - | Web Analytics | Ammaar will look later. It's Cloudflare's injected beacon, blocked by the CSP (the 92 in Lighthouse best practices). Don't widen the CSP. |

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
- **Cache version:** every script and CSS reference carries `?v=`. It's currently `20261015`. Bump it everywhere together (`index.html`, `js/site.js`, `js/world.js`) whenever a script, the CSS or a baked image changes. Nine places in `index.html`.
- **Audit and tests** (in `tools/`; run `npm install` and `npx playwright install` once):
  - `node audit.mjs` covers A2, A3, A6, A7 and A9 across Chromium, WebKit and Firefox, five sizes, axe, keyboard, reduced motion and links. Add `--only=a3,a9` or `--offline` to narrow it.
  - `node lighthouse.mjs`: add `--local`, or `--resolve=104.21.52.117` when the DNS cache is stale.
  - `npm run html` (html-validate) and `npm run spell` (cspell; add real words to `tools/cspell.json`).
  - `node doors.mjs` (every door, worst frame under 16 ms), `node orbs.mjs` (main-page orbs stay sharp) and `node shots.mjs <tag> name=x,y ...` (island screenshots at named places, in tiles, into `tools/out/shots/`).
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
  - Lighthouse live: 100 performance, 100 accessibility, 92 best practices, 100 SEO.
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
2. Cloudflare: Minimum TLS 1.2 (rechecked 2026-09-28: TLS 1.0 and 1.1 still complete handshakes, so the minimum is still 1.0; "TLS 1.3" in the dashboard is a separate switch that enables 1.3, not the minimum); the Web Analytics toggle later; confirm HSTS after a week (raise to `max-age=31536000; includeSubDomains` in `_headers` on or after 2026-10-04 if nothing broke).
3. Run the Firefox audit command above and paste the output (fold it into AUDIT.md A7).
4. The homelab audit, which settles P-11.
5. Dead-file candidates (README). Résumé bullet issue is closed for the current asset after a fresh render/extraction; tagged-PDF accessibility remains optional future work.
6. GitLab: make each mirrored project public after the secrets scan (Phase 7). Check the weekly mirror doesn't reset visibility.

## 9. Next steps, in order

Follow handoff 3's build order. Where it stands:

1. **Phase 6:** original copy batch approved/applied; fresh audit complete, new findings remain open. Prioritize DEEP terrain/route variable collision and background keyboard focus, then no-JS code-link fallback, shore/collision consistency and test gates. See the new report before coding.
2. **Art conversion:** terrain/asset implementation landed, visual quality NOT accepted. See section 8 and the new audit. Propose a coherent slice; do not mark the whole island finished. Buildings/landmarks, bridges and helipad remain candidates. The pi and "future" reality tower sprites are still built at runtime.
3. **Phase 7 (portfolio upgrades):**
   - Current checkpoint: gitleaks installed; `tools/history-review.mjs` prepared, scan not run due approval-service usage limit. Retry with normal approval once available. Do not bypass the failed approval. Four diagram proposals and screenshot checklist are written; diagrams still require Ammaar's OK.
   - **C2 pre-flight** on every repo the site links to:
     - `gitleaks detect` on the full history (install it with Homebrew; ask first).
     - Grep for private IP ranges, hostnames and MACs.
     - Report every hit, masked. Don't rewrite history.
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

- New confirmed bugs: duplicate `DEEP` variable overwrites the numeric sea code with the deep-link object; island keyboard focus escapes to the hidden portfolio. Fresh geometry probe also found three walkable centers painted water. No production fixes yet.
- Firefox launch remains blocked in this environment. Chromium contact-orb image comparisons failed, but backing resolution/WebKit passed; investigate baseline reveal timing before claiming a blur regression. Supplemental collectors are evidence gathering, not automatic passing gates.

- The ground painter's pixel edges can sit up to about half a tile off the collision tiles (the waterline is biased out to sea so walkable sand never looks wet). Road pixels can cross a solid cliff-rim tile at a stair edge.
- The lowland is a narrow strip of clearings, so it has few inland trees; adding woods there is a layout change for Phase 12.
- The Utahraptor's feathers are subtle at 33 px wide; consider a bigger sprite when the creatures get their full art pass.
- The far legs in `animate.py` are darkened copies of the near legs. That's fine at game scale; the Brachiosaurus uses a real rig.
- The pterosaur is the original sprite, kept as drawn. The internal creature key is still `raptor`; only the text says Utahraptor.
- `tools/resume.py` is out of date against the résumé PDF, and the rules say never to regenerate the PDF from it.
- The Loom demo link on the triage card returns 200. LinkedIn returns 999 to scripts, so check it by hand.
- Ammaar said he wants "everything" done; the build order above is long. Work phase by phase, report after each, and stop at each Stop. When he pushes for speed, prefer finishing whole, tested pieces over half-built ones.
