# Handoff: Ammaar's ePortfolio and pi's island

For a fresh Claude Code session. Read this whole file first, then the two plan documents in section 2,
then carry on from section 9. It is written to put you exactly where the last session left off.
Written 2026-09-27, updated 2026-09-28 after the whole-island art conversion, the audit fixes R1 to R8 and their deploy, and 2026-09-30 after the Phase 7 publication deploy and the Phase 8 foundation (C5, D11-A, D11-B) and its deploy; 2026-10-01 after the Phase 8 C4 fixes and their deploy, which close Phase 8, and after the Phase 7 K project diagrams and their deploy, and the `hands.js` fix and its deploy, and the K4 screenshot retakes and their deploy, and the triage repo's screenshot privacy cleanup; 2026-10-02 after Phase 9 (the CTF, E1-A to E1-C2) and its deploy; 2026-10-03 after MAP-A, B0 and the core approach fix and their deploys; 2026-10-07 after MAP-B B1, the staged 150 x 120 blockout (not deployed) (`git log` for the exact state).

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
    overrides handoff 3 C3's `git remote add gitlab`.) Two exceptions so far: on 2026-09-29 Ammaar fast-forwarded
    `trading-lab` and `claude-intake-triage` on GitLab by hand (no force, no remote) so they could go public
    before the Sunday mirror; on 2026-10-01 Claude fast-forwarded `claude-intake-triage` to `e07c933` the same way, with Ammaar's written OK, for the screenshot privacy cleanup. Don't repeat it without his OK.
  - **Public on GitLab since 2026-09-29:** `trading-lab` and `claude-intake-triage`. The mirror now publishes every
    GitHub commit on those two the next Sunday, unscanned: treat them as public repos. `homelab` and this repo stay private.
  - Ammaar's GitHub account is **flagged** (his repos 404 to the public). That's why repo links are off.
- **Commits:** one commit per item, each message ending with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

  Never force-push. Push after each batch.

## 2. The plan documents (read them)

**Missing as of 2026-09-30:** the three `~/Downloads` files below are no longer on this Mac (not in `~/Downloads` or anywhere else on disk). What survives is their summary in this file (sections 3, 4 and 9), `docs/game-design.md` and `AUDIT.md`. Handoff 2's C4 bug list existed only there, so Phase 8's bug hunt needs that list from Ammaar (or a fresh hunt). Don't recreate the files from memory.

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
| 7 | Code host | GitLab, username `ammaarrehman`. Repos are mirrored there. `trading-lab` and `claude-intake-triage` are public (2026-09-29); the rest stay private. |
| 8 | The Climb ending | Variant A. |
| 9 | Reserve name | **Mossgate Reserve** (not Cinderfern). |
| 10 | Kaiju | Option A (done): his grey, pi's rounded head and eyes, soft back bumps, tail lines that glow at night. |
| - | Copy batch P-1 to P-14 | Approved 2026-09-27. Applied: P-1 to P-7, P-10, P-12. P-8 and P-9 shipped 2026-09-29 as P-19 and P-20 (only two repos are public). P-11 waits. P-13, P-14 unchanged. P-15 (trading-lab: nine experiments, "each judged on a single run") approved and applied 2026-09-28; the served résumé (`f672ca8`) says nine too. P-13 and P-16 (no course names or count), P-17 (House of Delegates removed) and P-18 ("guaranteed transfer admission" removed) follow his 2026-09-29 résumé (`3e31d13`), whose contact links are all clickable. |
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
- **Cache version:** every script and CSS reference carries `?v=`. It's currently `20261025`. Bump it everywhere together (`index.html`, `js/site.js`, `js/world.js`) whenever a script, the CSS or a baked image changes. Nine places in `index.html`.
- **Audit and tests** (in `tools/`; run `npm install` and `npx playwright install` once):
  - `node audit.mjs` covers A2, A3, A6, A7 and A9 across Chromium, WebKit and Firefox, five sizes, axe, keyboard, reduced motion and links. Add `--only=a3,a9` or `--offline` to narrow it.
  - `node lighthouse.mjs`: add `--local`, or `--resolve=104.21.52.117` when the DNS cache is stale.
  - `npm run html` (html-validate) and `npm run spell` (cspell; add real words to `tools/cspell.json`).
  - `node doors.mjs` (every door, worst frame under 16 ms), `node orbs.mjs` (main-page orbs stay sharp) and `node shots.mjs <tag> name=x,y ...` (island screenshots at named places, in tiles, into `tools/out/shots/`).
  - `node hands.mjs` (the background hands never draw before they're built: no page error when a scroll, resize or theme change comes while they load).
  - `node ctf.mjs` (the Phase 9 CTF: the engine with synthetic flags, the terminal commands, and the two real flags, whose answers it works out at runtime; never write a real answer into a test) and `node ctfhash.mjs ctf-<slug>` (a flag's hash, from an answer typed at a hidden prompt; Ammaar types it, and it never lands in a file or a command line).
  - The map (MAP-A): `node map-parity.mjs` (`715450d` against the working tree in Chromium and WebKit: 37 checks, planted mutations of `home.js`, art apart from collision, the load failing and recovering), `node map-decode.mjs` (`decodeMap()` on synthetic maps, every refusal), `node map-export.mjs --check` (a fresh export from `715450d` equals `js/maps/home.js`), `node map-baseline.mjs --rev=<rev> --check` (a revision against the D11-B fixture; without `--check` it rewrites the fixture, so don't).
  - The staged MAP-B island (B1): `node map-compile.mjs` (writes `tools/maps/staged/home.js` from `tools/maps/home.src.mjs`; `--check` only compares) and `node map-lint.mjs` (153: 71 checks, 82 self-tests; `--accept --reason="..."` records an accepted build and never rewrites the frozen r2.1 fixtures). Neither touches `js/`.
  - `node focus.mjs` (island keyboard focus, R2) and `node codelinks.mjs` (repo links with js off, the host off, the shipped per-repo switches and every switch on; R4, Phase 7).
  - Exit codes: `audit.mjs`, `orbs.mjs` and `hands.mjs` exit 1 on a failure and 2 when nothing failed but something couldn't run (a browser that won't launch). A 2 is not a pass. `audit.mjs --engines=chromium,webkit` leaves Firefox out on purpose (reported as skipped).
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
  | Map data | `js/maps/home.js` (authored, the source of truth; `ISLAND_MAPS.home`), `decodeMap()` (checks and decodes it), the shape evaluators `coast`, `hiEdge`, `midEdge`, `tier`, `pondF`, the curve samples `CURVES` |
  | Collision | `COLL` and `FOOT` (footBlock, a bitset) from the map data; `walkable`, `solidPx`; `STEPOK`, `SAFE` (caches built from them) |
  | Props | authored in `home.js` (`props`, `nests`); `forest()` (the woods' shade), `TALL` |
  | Ground paint | `kindAt` (grass, dirt, sand, water per pixel), `paint()` (colour, decals, dock, bridges, cliffs via `face`/`stairs`), `grassKind` + `BIOME`, `FOAM` (the surf) |
  | Sprites | `SPR` (filled from `PROPS` and `ENV` atlases), `sprite()`, `outline()` (still used by rooms and realities) |
  | Creatures | `DINOS`, `SHEET`, `drawCritter`, `softShadow` |
  | Rooms | `ROOMS`, `enterRoom`, `roomBgStep`, `renderRoom` |
  | Transitions | `irisTo`, `drawIris`, `DOOR_CLOSE`, `DOOR_OPEN`, `xfade`, `doorAnim` |
  | The old secret scene | `side`, `renderSide`, `DEITY_LINES` |
  | Realities | `SKINS`, `duotone` |
  | Terminal | `CMDS`, `run` (and its one pipe, `echo <text> \| base64 -d`), `termWait` |
  | The CTF | "the ctf" section: `CTF_SHIPPED`, `ctfCheck`, `ctfSolve`, `ctfBoard`; the terminal's side after `CMDS` (`ctfReport`) |
  | Saves | `island-save` |
  | Audio | `js/audio.js` (`window.Sound`) |
  | Main page | `js/orb.js` (orbs), `js/windows.js` (window buttons, dock), `js/site.js`, `js/head.js` (`window.SITE.CODE_HOST`), `js/boot.js` |

## 6. Repo map (what's where)

| Path | What |
|---|---|
| `index.html`, `404.html`, `css/styles.css` | The site. |
| `js/` | `head.js`, `site.js`, `boot.js`, `windows.js`, `orb.js`, `face.js`, `hands.js`, `skills.js`, `theme.js`, `audio.js`, `world.js`, and `maps/home.js` (the home island's map data, generated by `tools/map-export.mjs`). |
| `assets/` | Images, résumé PDF, `island/dinos.png` (the baked creature sheet), `work/` screenshots (scrubbed). |
| `img/atlas/env.png`, `img/atlas/env.json` | Environment sprites (trees, plants, rocks, reeds, lilies, cave mouth), baked by `tools/envart.py`. |
| `art/palette.json`, `art/src/dinos-src.png` + `.json` | The master palette; the hand-drawn creature source frames. |
| `fonts/` | Self-hosted woff2 fonts + OFL licenses. |
| `_headers`, `wrangler.jsonc`, `.well-known/security.txt`, `robots.txt`, `sitemap.xml`, `site.webmanifest` | Hosting config. |
| `tools/` | `deploy.mjs`, `serve.mjs`, `audit.mjs`, `lighthouse.mjs`, `orbs.mjs`, `doors.mjs`, `shots.mjs`, `focus.mjs`, `codelinks.mjs`, `scenarios.mjs`, `ctf.mjs`, `ctfhash.mjs`, `map-baseline.mjs` (+ `mapdigest.mjs`, `fixtures/map-baseline.json`), `map-compile.mjs` and `map-lint.mjs` (+ `maps/home.src.mjs`, `maps/geom.mjs`, `maps/staged/home.js`, `fixtures/mapb-*.json`; MAP-B, staged, not deployed), `map-export.mjs`, `map-parity.mjs`, `map-decode.mjs`, `history-review.mjs`, `island-review.mjs`, `review.mjs`, `animate.py`, `brachio.py`, `envart.py`, and older `marks.py` / `duotone.py` / `resume.py` (see the dead-file list in the README). |
| `docs/` | `hosting.md`, `dns-claim.md`, `game-design.md`. |
| Local branch `gh-pages` (not pushed) | A redirect page for github.io, for when the GitHub flag clears (docs/hosting.md). |

## 7. What's done

### MAP-B B1, the staged 150 x 120 blockout, 2026-10-03 to 2026-10-07 (not deployed)

- What: the whole Harbour Crescent r2.1 blockout of the home island as staged data, complete. It is not runtime-active and not deployed. `docs/game-design.md` ("Technical", MAP-B B1) has the full record: the pipeline, the locked counts, districts, exits, reserves, habitats, scale and the B2 list.
  - Pipeline: `tools/maps/home.src.mjs` (authored) through the deterministic `tools/map-compile.mjs` to `tools/maps/staged/home.js` (format 2, `window.ISLAND_MAPS_STAGED`, `runtimeSupported: false`). `tools/map-lint.mjs` checks it against five frozen fixtures (`tools/fixtures/mapb-r21*.json`).
  - Production still loads `js/maps/home.js` (100 x 80, format 1), never overwritten. The staged files live under `tools/`, outside the deploy bundle. B2 teaches the game to read and draw the staged island locally.
  - Locked: 150 x 120; 10,257 land tiles, x 6 to 143, y 5 to 107, 80 coast points, 0 drift from r2.1; levels 0 to 3 at 3,413 / 4,111 / 2,225 / 508 tiles, 8 ramps; river 260, delta branch 39, koi pond 52, tarn 11, lagoon 20, reed marsh 31, 2 river mouths, 2 waterfalls, the volcano sealed; 3 bridges, 2 docks (the south harbour quay and ferry pier, the west Ironwood jetty), the NW Ashpine bridgehead, the helipad; 9,194 walkable tiles in one piece.
  - 8 districts; 3 future exits (south harbour, west jetty to Ironwood, NW bridgehead to Ashpine); no east pier, no south-east slip, no satellites, no ferry or map switching.
  - Planning only: 13 building footprints, the bunker, koi-garden and cottage-row reserves, the rift-arena clear space, 5 markers (cave approach, volcano trailhead, park gate, research gate, shrine), 11 habitats (no fences, roam areas, spawns or containment; the T. rex paddock is temporary, its long-term home Ironwood), 7 planning log sites. The shrine stays a marker at `[14,19]` (approach `[14,20]`): the study's 3 x 3 base conflicts with B1b's stricter cliffs and the nearby clean alternative would cover the approved route end, so B3 decides its structure.
  - Scale (planning metrics, not guarantees): all-logs tour 333 tiles, about 92 s walking, 57 s running; longest route 134 tiles, about 37 s. Projected with every reserve solid: 8,725 walkable, 8,638 reachable (the study's historical 8,693 is not a target).
  - Approved along the way: the 2-tile upper bridge; thin diagonal trails whose tiles meet only at corners (B2's painter must check they draw as continuous strokes).
- Commits: B1a coastline pipeline `9968f1a229947c19ed4d2bbdb497b53d9555e15b`; B1b elevation `7b83ff3a8fc934cbfa4f5c97878e1b7ee7c822ba`; B1c water and volcano `aca3924d4bc2efe21a08cc87f82aa90b674074e8`; B1d corridors and infrastructure `b87ed3775f4534baa8f02e1508344e7ed06bd4db`; B1e districts and planning reserves `b52815e532de0b0dc355edf221d926e1d544e1cb`; B1f these docs.
- Final audit at B1f: `map-compile --check` current (66,801 bytes); `map-lint` 153 of 153 (71 checks, 82 self-tests), the five frozen fixtures unchanged, the output deterministic across two processes, B1e changing no tile from B1d; `map-export --check` current; the dry run 53 files, 41 references, no MAP-B file; `git diff --check` clean. The production browser suite wasn't rerun: B1 changed no runtime file.
- Production is still the 100 x 80 island. `SAVE_V` is still 2, the cache still `20261025`. Nothing deployed. B2 hasn't started. The r2.1 study stays local and untracked in `tools/out/blockout/r2/`.

### Core approach fix, 2026-10-03, deployed 2026-10-03

- What it fixes: through B0, tapping the core after the orb fight sent pi toward 36,25 / 36,26, where the arena was before it moved to 48,43 in `a28541f`; the path ended at 36,27, nowhere near the fight. Now the tap plans toward an authored target, `anchors.coreApproach` = 48,44 (one row south of the arena, on open grass).
  - The anchor is optional in the map format and required by the home island. `decodeMap()` refuses one that isn't a walkable tile on or next to the arena, so the arena can't move without it. `home.js` is generated by `tools/map-export.mjs` (not hand-edited); `world.js` reads `MAP.anchors.coreApproach` and has no core destination literal left.
  - The existing loose landmark planner is kept on purpose (not made strict): 48,44 is the target, and pi stops wherever that planner validly stops, on it or on a tile next to it. From the south pi stops on 48,45; from the north 48,43, the east 49,44, the west 47,44. The core's dialog opens on arrival.
  - Tests: `b0-parity.mjs` keeps its 21 other checks identical with `715450d`, checks `core.tap` against the anchor explicitly, its core mutation now edits `coreApproach` in `home.js` (19 mutations: 18 of `home.js`, 1 of `world.js`), and a dedicated regression taps from four sides, moves only the approach, moves only the arena (the island must refuse to load) and scans `world.js` for literals. `map-decode.mjs` has four new refusal cases (250 checks).
- Commits: the fix `19724cccf61e8158fb584429c864e6b486d419af`; the cache bump to `20261025` `ea910c58f4f3600ea26a23cd30fb1b381e43fefd`.
- **Deployed 2026-10-03:** Cloudflare version `b5fe7d52-c7c5-49e7-a543-aabb127aafca`, cache `20261025`, deployed commit `ea910c58f4f3600ea26a23cd30fb1b381e43fefd` (the cache bump; this docs update came after and isn't a web asset). Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`); wrangler uploaded 4 files: `index.html`, `js/site.js`, `js/world.js`, `js/maps/home.js`.
  - Pre-deploy from `ea910c5`: `map-export.mjs --check` current; `map-decode.mjs` 250; `b0-parity.mjs` 21 of 21 identical with `715450d` in Chromium and WebKit, the explicit `core.tap` check and the core regression passing, 19 of 19 mutations caught in each; `map-parity.mjs` 37 of 37 in each, 18 mutations caught; `map-baseline.mjs --check` matching `bbadcae` (not rewritten); `scenarios.mjs` 98 of 98; `ctf.mjs` 250; `doors.mjs` passed (worst frame 3.1 ms); `focus.mjs` 16; `hands.mjs` 26; `codelinks.mjs` 49; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); html-validate and cspell clean; the dry run passed (53 files, 41 references). Firefox blocked at launch throughout.
  - Live: `--check` passed; 9 references to `v=20261025` and none to `v=20261024`; `index.html`, the 404 page, `css/styles.css`, every script (`home.js` included) and the three island images byte-identical to `ea910c5`; live `home.js` has `"coreApproach":[48,44]` (100 x 80, format 1); live `world.js` reads `MAP.anchors.coreApproach`, has no 36,25 / 36,26 core destination, and has `SAVE_V = 2`. In Chromium and WebKit, from ignored copies of the tests in `tools/out/coreapp/release/live/` (production as the current side; tracked tests unchanged):
    - the core, end to end on production's own files: from four sides the tap plans toward `["core",48,44]` with the loose planner, and pi walks the real update loop to its stop (south 48,45, north 48,43, east 49,44, west 47,44) and the core's dialog opens; `b0-parity` 21 of 21 identical with `715450d`, `core.tap` and the whole core regression passing on production's `world.js` (only the approach moved: the tap follows it; only the arena moved: the island refuses to load);
    - `map-parity` 37 of 37; `map-baseline --check` matching `bbadcae`; `scenarios.mjs` 98 of 98; `ctf.mjs` 250 (Fence Logs and Radio Static open, slots 3 to 6 offline); `doors.mjs` passed (worst 3.2 ms);
    - a plain visitor gets no test API and no page, console or request error; `home.js` loads before `world.js`; harbour, meadow, the core and arena, depot, lighthouse and a 390 px phone view are pixel-identical to the previous production (`7f29828` served locally); the depot interior differs only in the debug overlay's live counters; the big map is 300 x 240 with identical pixels at 1280 and 390 px.
  - Production is still the 100 x 80 island, the same geography. `SAVE_V` is still 2. MAP-B (the 150 x 120 island) hasn't started. `CX` / `CY` cleanup is still deferred. No manual live check by Ammaar yet.

### B0, map placement data, 2026-10-03, deployed 2026-10-03

- What: the home island's remaining hard-coded positions moved from `world.js` into `js/maps/home.js`, with exact parity and no visible change. `docs/game-design.md` ("Technical", map data) has the sections and rules.
  - Authored now: creature spawns and roam areas (one record per area object; matching boxes stay separate records, so identity is kept), the welder's route, the car, rex, gardener, first-visit and arena anchors, the static goto places and five zones.
  - Derived from the authored buildings: the cargo stops and the drone pad.
  - `heli` and `helipad` stay dynamic goto names with no static coordinate (the dead `59,62` is gone).
  - The big map's size follows the map (3 px a tile: 300 x 240 now, 450 x 360 at 150 x 120).
  - The placement sections are optional in the format; the home island requires its own and stops with a message naming any that's missing.
- Commits: B0a the parity harness `tools/b0-parity.mjs` (`80fd911`); B0b the schema, decoder and export (`b795d32`; `home.js` 99,667 bytes, 12,985 gzipped); B0c creatures, roam areas, bots, drones, car and rex from the data (`8cce475`); B0d places, zones, arena and first visit (`ecbb809`); B0e removed the dead heli coordinate, derived the big-map size, made `map-parity.mjs`'s places check compare heli and helipad as dynamic places, and these docs (`d1036c2`); the cache bump to `20261024` (`7f29828`).
- Full SHAs: B0a `80fd9119447677323ae361c15d35cd5b1c473636`, B0b `b795d3284453c2e3c80d2c8b8befff6a1c5f5599`, B0c `8cce475f519008cec1b9ae784ba89347e939c7a4`, B0d `ecbb8096b671edfdb75e46d5cce32ff89d20d89a`, B0e `d1036c2f378f3038b8fb80da76e92ab3592145f2`, cache bump `7f29828b6d4ef89e39c9a907c0b12e73e35abe56`.
- Parity: `b0-parity.mjs` 22 of 22 identical with `715450d` in Chromium and WebKit, 19 of 19 mutations caught in each (17 edit `home.js`; 2 edit `world.js` on purpose: the core tap's goal and goto heli's offset). `map-parity.mjs` 37 of 37, `map-baseline.mjs --check` matches; no fixture changed.
- Kept on purpose in B0: the core-tap bug (pi headed for 36,25 / 36,26, the old arena, and ended at 36,27; the arena moved to 48,43 in `a28541f`). It shipped unfixed in the B0 release on purpose, and was fixed separately afterwards with an authored approach point (the core approach fix, below; deployed 2026-10-03, cache `20261025`). `CX` / `CY` are dead; their cleanup (with the exporter and parity tools that read them) is deferred.
- **Deployed 2026-10-03:** Cloudflare version `0e9f176d-d0c6-47ce-b207-85f5a9373e0a`, cache `20261024`, deployed commit `7f29828b6d4ef89e39c9a907c0b12e73e35abe56` (the cache bump; this docs update came after and isn't a web asset). Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`); wrangler uploaded 4 files: `index.html`, `js/site.js`, `js/world.js`, `js/maps/home.js`.
  - Pre-deploy from `7f29828`: `map-export.mjs --check` current; `map-decode.mjs` 242 of 242; `b0-parity.mjs` 22 of 22 identical with `715450d` in Chromium and WebKit, 19 of 19 mutations caught in each; `map-parity.mjs` 37 of 37 in each, every mutation caught; `map-baseline.mjs --check` matching `bbadcae` (not rewritten); `scenarios.mjs` 98 of 98; `ctf.mjs` 250 (125 per engine); `doors.mjs` passed (worst frame 4.0 ms); `focus.mjs` 16 of 16; `hands.mjs` 26 of 26; `codelinks.mjs` 49 of 49; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); html-validate and cspell clean; the dry run passed. Firefox blocked at launch throughout.
  - Live: `--check` passed; 9 references to `v=20261024` and none to `v=20261023`; every shipped file (pages, CSS, every script, `home.js` included, and the three island images) byte-identical to `7f29828`; `world.js` has `SAVE_V = 2`. In Chromium and WebKit, from ignored copies of the tests in `tools/out/b0/release/live/` (the production site as the current side; tracked tests unchanged): `b0-parity` 22 of 22 identical with `715450d` (33 creature starts, the roam-area identity graph with the raptor and herd groups shared and matching boxes kept apart, cargo stops by identity, the welder's route, the gardener's start and beds, the drone pad, car and rex starts, rex's wander, every goto place, goto heli and helipad with the helicopter parked in three places, the roar zone, perches, fireflies, arena, first visit, the core tap); `map-parity` 37 of 37; `scenarios.mjs` 98 of 98 (the map digest matching the `bbadcae` fixture, routes, safe landings and hop-outs); `doors.mjs` passed (worst 3.7 ms); `ctf.mjs` 250 (Fence Logs and Radio Static live, slots 3 to 6 offline). A plain visitor gets no test API and no page, console or request error; `home.js` (100 x 80, format 1) loads before `world.js`. Harbour, meadow, depot, lighthouse and a 390 px phone view are pixel-identical to MAP-A (`6a58744` served locally); the depot interior differs only in the debug overlay's live counters; the big map is 300 x 240 with identical pixels at 1280 and 390 px.
  - Production is still the 100 x 80 island, the same geography; only where its placements come from changed. `SAVE_V` is still 2. The 150 x 120 MAP-B geography hasn't started. `CX` / `CY` cleanup is deferred. No manual live check by Ammaar yet.

### MAP-B world plan approved, 2026-10-03 (design only)

- Ammaar approved MAP-B r2.1:
  - the home island's redesign, "Harbour Crescent": a 150 x 120 map with an island of about 138 x 103 tiles, about 10,250 land tiles, a two-mouth south-west delta, and the south harbour as the transport hub;
  - its district layout and travel pacing;
  - the satellite plan in `docs/game-design.md` ("The setting").
- What's locked:
  - **Exits:** exactly three, the south harbour, a restricted west service jetty and the north-west Ashpine rope bridge.
  - **Ids and saves:** the id stays `home`; `SAVE_V` stays 2; when the new geography ships, an old saved position falls back to arrival.
  - **Volcano:** the shoulder stays solid.
  - **Buildings:** about 2 to 2.5 times today's footprints.
  - **T. rex:** it stays on the home island in a small holding paddock until Ironwood exists.
  - **How it's authored:** an authored source in `tools/` generates the map data.
  - **Order:** B0 comes first. B0 moves today's remaining hard-coded positions into map data with exact parity and doesn't change the geography.
- Not built:
  - no 150 x 120 map;
  - no satellite maps, ferries, boats or map switching;
  - B0 was built next (above) and deployed 2026-10-03 (cache `20261024`).
- Production still runs the original 100 x 80 island.
- The study files (schematics, checks, world chart) are local and untracked, in `tools/out/blockout/r2/` (`plan-r2.1.md`). They're not in git.

### MAP-A, the authored map foundation, 2026-10-02, deployed 2026-10-03

- Context: Ammaar approved the P10-R island masterplan (concept 5, the hybrid: a 150 x 120 main island carrying the whole core game, with satellite islands as separate maps added only with the phases that need them) and, as its first step, MAP-A: turn today's procedural island into authored data that reproduces it exactly. No visible change. The masterplan's own document and any roadmap reordering are not written yet.
- What changed: `js/maps/home.js` is now the source of truth for the home island's geography (format 1; `docs/game-design.md`, "Technical", has the format and the rules). Gameplay collision is authored `coll` + authored `footBlock`; the painted ground (`GK`) is visual only. The procedural generation, the collision scratchpad and planting are gone from `world.js`. Critters, NPC routes, `PLACES`, quests, the CTF, prose and saves didn't move.
- Commits: A0 the parity harness (`77e2d65`); A1 the exporter and `home.js` (`4a7d9b5`, exported from `715450d4c6efca6a24f7cf21e64fdd25ad38eaba`); `ctf.mjs`'s scans made recursive for `js/maps/` (`5480b2b`); A2a geometry from the data and the load chain `audio.js`, `js/maps/home.js`, `world.js` (`c29dce9`); A2b layers, collision, footBlock and props from the data (`a3d56dc`); A3 `decodeMap()` with its validation and consistency rules, `tools/map-decode.mjs`, `map-baseline.mjs --rev --check`, these docs (`83838eb`); the cache bump to `20261023` (`6a58744`).
- Parity: `map-parity.mjs`, 37 of 37 checks identical with `715450d` in Chromium and WebKit; every planted mutation caught; repainting 8,561 px of `GK` moves no collision. `map-baseline.mjs --check` matches the D11-B fixture for `715450d` and for A2b. No fixture changed. `SAVE_V` is still 2.
- Performance against `715450d` (A3, medians of 12 alternating runs, Chromium and WebKit): open time the same (within 0.5%); ground paint +3 to 4% (the shapes are evaluated from data); `solidPx` 26 to 34% faster, a full `STEPOK` 13 to 19% faster; heap +1.6% (Chromium); `decodeMap()` about 1 ms. `home.js` is 95,712 bytes, about 11.9 KB gzipped. `doors.mjs` sees occasional 10 to 16 ms frames on any door, before MAP-A (`715450d`) as after; 3 of the first 11 A3-session runs went over 16 ms (the depot each time), none of the later 16.
- A later timing study (30 alternating runs each of `715450d`, `c29dce9`, `a3d56dc` and A3) put those frames down mainly to browser frame-scheduling lateness, plus a rare render spike in the first frames after leaving the depot that `715450d` has too; not a MAP-A regression. `decodeMap()` runs once, at load, never during a door. `doors.mjs` and its 16 ms limit are unchanged.
- **Deployed 2026-10-03:** Cloudflare version `b62884f1-9481-4774-84f2-f1523d837979`, cache `20261023`, deployed commit `6a5874438c932e958ee0d1a7955e46e41a77f5d0` (the cache bump; this docs update came after and isn't a web asset). Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`). Pre-deploy from `6a58744`: `map-decode.mjs` 174 of 174, `map-parity.mjs` 37 of 37 in Chromium and WebKit with every mutation caught, `map-baseline.mjs --check` matching, `scenarios.mjs` 98 of 98, `ctf.mjs` 125 of 125 per engine, `doors.mjs` passed, `focus.mjs` 16 of 16, `hands.mjs` 26 of 26, `codelinks.mjs` 49 of 49, `audit.mjs` 81 passed, 0 failed, 2 blocked, html-validate and cspell clean, the dry run passed. `--check` passed; the live shipped files are byte-identical to `6a58744`, with 9 references to `v=20261023` and none to `v=20261022`. Live in Chromium and WebKit: `scenarios.mjs` 98 of 98, `doors.mjs` passed, `ctf.mjs` 125 of 125 (Fence Logs and Radio Static live, slots 3 to 6 offline, saves in v2); a plain visitor gets no test API and no error, and `home.js` is loaded before `world.js`; harbour, meadow, lighthouse and phone screenshots pixel-identical to `715450d`. The live island is the same geography and content; only where it comes from changed. Only `home` exists. `SAVE_V` is still 2. The 150 x 120 blockout hasn't started. No manual live check by Ammaar yet.

### Phase 9, the CTF (E1-A to E1-C2), deployed 2026-10-02

- Design: Ammaar approved a fresh proposal (the old E1 spec is lost), Option D: one reusable six-slot engine, two real flags now, the other slots reserved for the phases whose places and tools exist then. `docs/game-design.md`, "The CTF", has the design and the slot table.
- Commits: E1-A the engine (`f6a3863`): data model, conditions, normalization, SHA-256 through Web Crypto, the save write, the terminal's async wait (`termWait`: one check at a time, a closed terminal drops a pending result, a 4 s watchdog), debug hooks, `tools/ctf.mjs`, `tools/ctfhash.mjs`. E1-B the terminal (`f078a25`): `ctf`/`flags`, `submit`, `hint`, `writeup`, the banner and help lines, the shared toast, the reduced-motion fix for the terminal and toast, a keyboard-reachable terminal log (axe's scrollable-region rule, which already failed before Phase 9 once the log scrolled) and Shift+Tab out of the input. E1-C1 Fence Logs (`b3fc6de`), E1-C2 Radio Static (`ba8396b`), including the narrow `echo <text> | base64 -d` decoder.
- The cave terminal is only an early access point; the CTF's narrative home is Server Key (Phase 18), which will call the same engine.
- Save: solves are `save.flags["ctf-<slug>"] = true`, save v2 unchanged. No version bump.
- Answers: never in the repo. Ammaar typed each answer into `ctfhash.mjs`'s hidden prompt; only the hashes are in `CTF_SHIPPED`. The tests work each answer out from the game (the fence log's own sessions; decoding the radio's payload). Fence Logs' answer is, by design, also ordinary data in its log among other addresses; Radio Static ships only its Base64 payload.
- Checks (2026-10-02, on `ba8396b`'s code): `ctf.mjs` 125 of 125 in Chromium and WebKit; `scenarios.mjs` 98 of 98; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); `focus.mjs`, `codelinks.mjs`, `doors.mjs` pass; `hands.mjs` 26 of 26; html-validate and cspell clean; the deploy dry run passed. Firefox is blocked at launch everywhere, not failed.
- Docs `74ba3f8`; cache bump to `20261022` in `50ba18d`.
- **Deployed 2026-10-02:** Cloudflare version `77077169-5af9-4f10-939f-00b4abe2c2ef`, cache `20261022`, GitHub `main` at `50ba18d`. Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`). Pre-deploy from the committed state: `ctf.mjs` 125 of 125 (Chromium, WebKit), `scenarios.mjs` 98 of 98, `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn), `focus.mjs`, `codelinks.mjs`, `doors.mjs` passed, `hands.mjs` 26 of 26, html-validate and cspell clean, the dry run passed. `--check` passed; the live `index.html`, `world.js`, `site.js` and `styles.css` are byte-identical to the repo, with 9 references to `v=20261022`. The full `ctf.mjs` run against the live site passed 125 of 125 in Chromium and WebKit: slots 1 (Fence Logs) and 2 (Radio Static) open and solvable, slots 3 to 6 offline, saves in v2. No page or console error for a plain visitor. No manual live check by Ammaar yet.

### `claude-intake-triage` screenshot privacy cleanup, 2026-10-01

- Found during K4 planning; Ammaar approved each image before the change. The public repo's three README screenshots exposed: `sheet-output.png`, Ammaar's Google account avatar, the test row's ZIP (`21044`) and its test email; `form.png`, the avatar in the Forms header; `eval-results.png`, the Mac's user and host name in both prompt lines.
- Fix, in the triage repo commit `e07c9335c9c8ce68d6a9387d720e11819fdf5f44` ("Privacy: clean public triage screenshots"), the three PNGs only: `sheet-output.png` cropped below the Sheets toolbar (the column headers, the Claude output columns, Human Review Required and Staff Status stay) with opaque bars over the email and ZIP; `form.png` cropped below the Forms header (every question stays); `eval-results.png` with opaque bars over the user and host name only (both runs' output unchanged). No replacement text. sRGB, and the files hold only image data (no EXIF, XMP or ICC). Outside the bars and crops, every pixel matches the originals. README unchanged.
- Published: pushed to GitHub, then GitLab fast-forwarded from `50a1039` to `e07c933` (direct URL, no remote, no force; section 1). Both are at `e07c933`. The public GitLab README shows the cleaned images (byte-identical); GitHub's copies are identical through the API (GitHub 404s to the public, as for all of Ammaar's repos).
- **History was intentionally not rewritten.** The earlier versions of all three files are still in both repos' history (`44ecef9` through `50a1039`), and GitLab's is public. Whether to remove them is a separate decision for Ammaar.
- `e07c933`'s author and committer email is Ammaar's personal address from the Mac's global git config, the same address already on 7 of the 9 earlier commits there; the latest two used his GitHub noreply address. For future commits to public repos, check which address applies.
- Not part of this: the repo's video and the Loom demo (section 9). The portfolio site doesn't use any of these images; it has no change.

### Phase 7 K4, project screenshot retakes, deployed 2026-10-01

- Committed in `ef88c90` (the six images and the three `<img>` tags). Three featured-card screenshots changed; Ammaar approved each choice and its alt text before the work. Details, sources and the exact crop and render numbers: `docs/screenshots.md`, "K4".
  - **HA DNS:** re-cropped from the committed, already-redacted v1 image to 982 x 614 (rows 178 to 791: the dig HEADER line through MSG SIZE), so all six answers show; the old card crop cut the sixth in half. No retake (v1 is retired). Alt text drops "and the laptop name" (that redaction is now out of frame).
  - **trading-lab:** the old return chart is gone. New: lines 19 to 29 of the committed `docs/results/faber-2026-09-23.txt` (experiment 9), verbatim under a plain file-name line: the five pre-registered checks, VERDICT: REJECT and the paper-trading line. No returns, Sharpe values, drawdowns or account values; no prompt or invented shell output.
  - **Terraform:** re-cropped from the original capture with an opaque bar over the private repo URL (`AUDIT.md` A6-19); the address bar, avatar, `mar@homelab`, the AdGuard/Unbound row and the old tagline stay out. Alt text says it's the historical deployed site and that the link is redacted.
  - **Triage:** unchanged, exactly as before.
- Each new image is exactly 16:10 (the card shows all of it) with a 600 x 375 copy; WebP, and inspecting the exported files shows only the image payload, no EXIF, XMP or ICC metadata. `index.html` changed only those three `<img>` tags (alt, width, height, srcset widths). Work images carry no `?v=` and are served with `max-age=0, must-revalidate`, so no cache bump is needed.
- Checks, on the tracked images (no substitution): Chromium and WebKit at 1280, 700, 375 and 360 px, light and dark, 1x and 2x (32 runs): every card image loads from its srcset at its real size, is uncropped in its 16:10 box, sits inside its card without overlapping the bar or text, has the approved alt text, no horizontal overflow, no page or console errors. The redaction bars are flat and opaque; triage is byte-identical. `focus.mjs` and `codelinks.mjs` pass, html-validate and cspell clean, `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn), the dry run passed.
- **Deployed 2026-10-01:** Cloudflare version `1e3c4c5e-df30-49d7-832b-1b9bf3272aa9`, cache still `20261021` (no bump needed), GitHub `main` at `3636e79` (docs commit for `ef88c90`). Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`). Pre-deploy from the committed state: `focus.mjs` and `codelinks.mjs` passed, html-validate and cspell clean, `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn), the dry run passed, the K4 card-image check 32 of 32. `--check` passed; the live `index.html` and all eight work images are byte-identical to the repo; on the live site the same 32-run card-image check passed in Chromium and WebKit with no page or console error. No manual live check by Ammaar yet.
- The project copy, the four diagrams, `hands.js` and homelab wording are unchanged. Still separate and not started: the `claude-intake-triage` README screenshot privacy cleanup (section 9) and Phase 9.

### `hands.js` drawing before it's built, fixed and deployed 2026-10-01

- Bug (found during the Phase 7 K checks, present before K): `draw()` reads the hand canvases that only `build()` makes, but three handlers call it from the moment the script runs: the reduced-motion scroll listener, the resize handler and the `data-theme` observer. `build()` can't run until `assets/hands.json` has loaded, and the first draw waits for the font, so any of those events during loading threw a `drawImage` TypeError (`hands.js` line 63). Reduced motion: scroll, resize or theme change; normal motion: resize or theme change. On the live site it showed in every reduced-motion Playwright run.
- Fix (`cd80047`): one line, `draw()` returns until the canvases exist. Nothing is lost: `go()` always builds and draws once loading finishes, at the current scroll, size and theme. No timing or order change; the animation loop only starts after `build()`, so normal motion is unchanged.
- Test: new `tools/hands.mjs`. It holds `hands.json` back while each trigger fires, in Chromium, WebKit and Firefox, with reduced and normal motion, and requires no page error, the canvas switched on and drawn, and (reduced motion) a scroll after loading still redrawing. 26 of 26 pass in Chromium and WebKit; Firefox is blocked at launch (exit 2). Against the old `hands.js` it fails 12 checks, all the TypeError.
- Also checked: with reduced motion, the old and new `hands.js` draw byte-identical canvases (Chromium and WebKit, light and dark, top and bottom of the page); `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); html-validate and cspell clean.
- **Deployed 2026-10-01:** Cloudflare version `8957e8ba-22da-4e16-ad92-ab82d22b217a`, cache `20261021` (`ba157d0`), GitHub `main` at `ba157d0`. Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`). Pre-deploy: `hands.mjs` 26 of 26 (Firefox blocked at launch), `focus.mjs` and `codelinks.mjs` passed, html-validate and cspell clean, `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn), the dry run passed. `--check` passed; the live page has 9 references to `v=20261021` and none to `v=20261020`; the live `hands.js` is `cd80047`'s. On the live site in Chromium and WebKit, `hands.mjs` (26 of 26), 64 reduced-motion card loads and a normal-motion scroll, resize and theme change logged no page error. No manual live check by Ammaar yet.

### Phase 7 K, project diagrams, deployed 2026-10-01

- Each of the four featured project cards has an SVG diagram after its description and before its tags: HA DNS (`16ee02b`), intake triage (`d5eff6b`), trading-lab (`26ee4a5`), Terraform static site (`163cbd9`). Ammaar approved every node, arrow and label before drawing, and each rendered diagram before its commit. Labels come only from the approved card copy; no project copy changed.
- What each shows (the approved final specs; `docs/phase-7-proposals.md` holds the original proposals):
  - **HA DNS:** v1 only, headed "Homelab v1 · retired September 2026": my devices, the keepalived VRRP floating IP, the two Raspberry Pi 5 / AdGuard Home nodes, "IP moves on failure", "config sync every 10 min" (no direction: the copy doesn't establish one) and "failover and failback tested both ways". The footer repeats the card's "Version two, a single Pi built with Ansible, is in progress."; if that sentence changes, change the diagram too. No Unbound, no upstream or DoH node, no "active" role, nothing styled as live.
  - **Intake triage:** Google Forms → Google Sheets → Apps Script ⇄ Claude API, with Apps Script writing the five fields (category, urgency, summary, next step, human-review flag) back into the same Sheet row. Checked against the public repo's `apps-script/Code.gs` (GitLab `50a1039`), which showed the form lands in the Sheet first. The eval lane (15 eval cases → Python evals → the two approved figures) is drawn separately with no line to the Claude API. No staff, users, volumes or production.
  - **trading-lab:** nine experiments; rules committed to git before any data, backtests built to catch their own bugs, each judged on a single run; "all nine rejected · $0 lost". No returns, charts, names or "before capital".
  - **Terraform:** visitor → CloudFront (HTTPS) → private S3 bucket through an "Origin Access Control (OAC)" pill labelled "access via OAC", with dashed Terraform provisioning lines and "deploy and teardown scripted and documented". No Route 53, IAM, domain, distribution ID or live/offline state: it shows the architecture, not whether the demo is running.
- Built as two inline SVGs per card in `index.html`: a wide one and a stacked one for cards under 380 px (a container query; the other is `display:none`). Each has `role="img"` with a `<title>` and `<desc>` and no visible caption. Styles and theme colours are in `css/styles.css` (`.work-diagram`, `.dg`); no inline styles, because of the CSP. Smallest text: 11.1 px on desktop, about 12 px on phones (11.9 px at 360 px in WebKit). On diagram cards the description no longer stretches (`.work-body:has(.work-diagram)`), so the diagram sits 14 px under the text and spare height in an equal-height desktop row goes above the tags. Card heights are unchanged; keep the tags there, not directly under the diagrams (Ammaar's call).
- Checks: Chromium and WebKit at 1280, 700, 375 and 360 px, light and dark (one layout shown, no overflow, overlap or clipping, right accessible name and description); html-validate and cspell clean; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); `focus.mjs` and `codelinks.mjs` pass.
- **Deployed 2026-10-01:** Cloudflare version `bd2ad2cc-b2ed-49c1-a00c-9315d331ab27`, cache `20261020` (`8216a65`), GitHub `main` at `8216a65`. Claude ran `node tools/deploy.mjs` on the Mac with Ammaar's written authorization for this release (deploy log in `docs/hosting.md`). Pre-deploy: `focus.mjs` and `codelinks.mjs` passed, `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn), the dry run passed. `--check` passed; the live page has 9 references to `v=20261020`; all four diagrams are live and render without overflow or overlap in Chromium and WebKit at desktop and phone widths, light and dark. No manual live check by Ammaar yet.
- Still separate: K4 (screenshot retakes, done and deployed afterwards; section 7), the `hands.js` bug (fixed afterwards in `cd80047` and deployed 2026-10-01; section 7). Phase 9 is not started.
- Found while testing, not caused by K: the `hands.js` reduced-motion error (section 10).

### Phase 8 closed: the C4 fixes deployed, 2026-10-01

- C4-1 (`cc39bb5`) and C4-2 (`3bc6f9b`) are live: Cloudflare version `bff274a4-ef11-4b9b-8283-2d40a3a51955`, cache `20261019` (`3bfaa3a`), GitHub `main` at `3bfaa3a`, deployed by Ammaar with `node tools/deploy.mjs` (deploy log in `docs/hosting.md`).
- Checks: `scenarios.mjs` 98 of 98 in Chromium and WebKit (Claude's run on `3bc6f9b`; the bump changed only `?v=`); final pre-deploy `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); `--check` passed; the live page has 9 references to `v=20261019` and the live `world.js` has `canStep`, `safeTile` and `hopSpot`. Firefox is still blocked at launch, not failed.
- Manual live smoke test by Ammaar, all four passed: the lighthouse tap route from the village completes and its card opens; a normal helicopter landing works and pi gets out normally; a reload keeps progress; the helicopter refuses to land over a paddock.
- **Phase 8 is done.** C5, D11-A, D11-B, C4-1 and C4-2 are all live. Nothing actionable is left; the cave transition (handoff 3 B2) is deferred to Phase 12, when the tunnel exists.

### Phase 8 C4-2, safe ground for the helicopter and restored positions, 2026-09-30

- Bug (found in the C4 hunt): the helicopter could land in walkable pockets cut off from the island (both paddock interiors, the highland behind the volcano and others: 3,229 of 25,670 landing spots touched one), and a save made there restored pi into the pocket with the helicopter back on its pad. Separately, 477 of 102,680 hop-outs put pi inside blocked pixels.
- Fix: `safeTile()` is the walkable ground reachable on foot from the spawn (a flood fill, done once and cached in `SAFE`; like `STEPOK` it assumes collision never changes at runtime, so a later phase that changes walkability must clear it). The helicopter lands only where `landTile()` allows: safe ground or the helipad. That function is where a later phase adds explicit landing zones; none exist yet. Pi hops out at `hopSpot()`: the same spots beside the doors as before, but only one that is safe and clear at all four of `move()`'s points; failing that, the nearest such spot in rings out to 96 px; failing that, the spawn. A saved position is restored only on safe ground, otherwise pi starts at the spawn. E is checked where it's pressed, and the helicopter then glides up to about 19 px while it comes down; that glide now stops where the next bit would leave ground `canLand()` allows, so the parked helicopter is always on it (before: 79,243 of 359,056 full-speed glides parked off it). No save schema, control or movement change.
- Tests (`scenarios.mjs`, Chromium and WebKit): every 4 px landing spot with four headings. 22,441 landings are still accepted, and the 3,229 dropped are exactly those touching a pocket. None lands outside safe ground or the helipad. All 102,680 old hop-out cases end clear and on safe ground. The paddocks and the north pocket are refused, and the helipad isn't. The glide after E, run on the game's own `updateHeli` (`__island.landingFrom`) from every accepted spot in 16 directions at full speed, never parks off allowed ground, including the cases gliding toward a pocket, and is unchanged on open ground (18.71 px). In real flights, E over the t-rex paddock doesn't land, while landing on open meadow and back on the helipad works with pi clear. The (41,8) saved spot starts pi on safe ground; a normal saved spot is still restored. With the old rules put back, every one of these checks fails.
- Deployed 2026-10-01 (Cloudflare `bff274a4`, above).

### Phase 8 C4-1, pi's paths, 2026-09-30

- Bug (found in the C4 hunt): on 14 river-bank and pond-edge tiles the spot the path follower aims for sits too close to painted water for pi's feet. A tapped route crossing one stopped short and gave up (the old zero-movement guard dropped it), so the landmark's card never opened. Routes from the village to the lighthouse, the koi pond, the shrine and across the river all crossed one; 42 tile-to-tile steps in all.
- Fix (navigation only; `GROUND`, `HEIGHT`, `COLL`, `walkable()`, `move()` and the `bbadcae` parity fixture are unchanged): pi's planner (`piPath`, `bfs(..., feet)`) only steps between tiles when `move()` can walk pi from one aim spot to the next, at walking and running speed (`canStep`, cached per tile and direction); the first step is tried from where pi stands. Bots plan as before. A 0.5 s no-progress failsafe ends a path that stops getting closer; it and the old zero-movement guard both count into `pi.stalls`.
- **Static collision assumed:** the `canStep` cache (`STEPOK`) assumes the collision geometry never changes after the island is built. A later phase that changes walkability at runtime (gates, a mended bridge, moving obstacles) must clear `STEPOK` or redesign it.
- Tests (`scenarios.mjs`, Chromium and WebKit): the 42 steps (found from the pixels, not a list) all finish; routes from the village to 24 landmarks, doors, `goto` places and river banks finish with no give-ups; the reported 27,27 to 27,28 tap finishes; keyboard movement matches `tools/fixtures/keyboard-trace.json`, recorded from `a0d015b` before the fix. With the feet check switched off, all three path checks fail.
- The planner leaves out exactly those 14 tiles and nothing else (no landmark, door or place lost). The mailbox's approach tile has no walkable neighbour, so a tap there ends 2 tiles away, as before.
- Deployed 2026-10-01 (Cloudflare `bff274a4`, above).

### Phase 8 foundation deployed, 2026-09-30

- C5, D11-A and D11-B are live (no intended visual or UI behavior changes): Cloudflare version `591b3f45-9e51-49f9-81a3-61b36634cc3b`, cache `20261018` (`6c44762`), GitHub `main` at `6c44762`, deployed by Ammaar with `node tools/deploy.mjs` (deploy log in `docs/hosting.md`).
- Checks: final pre-deploy `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's launch, LinkedIn); `--check` passed; the live page has 9 references to `v=20261018` and the live `world.js` has `SAVE_V = 2`. Ammaar's manual live check passed: the island loads and plays normally (moving, normal interactions), and the saved state survives a reload.
- **Save v2 is live: fix forward.** Visitors' saves become v2 on their next island visit, and code from before `bbadcae` would start them fresh. Don't roll back past `bbadcae`.

### Phase 8 D11-B, map data layers, 2026-09-30

- The map is three typed-array layers in `js/world.js`: `GROUND` (tile codes), `HEIGHT` (0 to 5; 0 to 2 used) and `COLL` (collision bits: solid, shallow, deep, low, ledge N/E/S/W, lava, climbable). `docs/game-design.md`, "Technical", has the schema. The shape is my choice (the docs named the layers only): typed arrays and bit flags, 32 KB in all.
- One source: the builder writes `GROUND` and `HEIGHT` directly (`map` and `ELEV` are gone). `COLL` is built once from the tiles and the builder's `solid` set, which is then dropped; the painter's water pass sets the solid bit. `walkable()` reads the flags.
- Reserved for Phase 11 and unset: `low`, the ledges, `climbable`. Water is shallow (sea shallows, pond, river) or deep (open sea); the river is all shallow for now. Props stay a list; spawns and triggers wait for the Phase 12 map export.
- Parity: `tools/map-baseline.mjs` recorded `bbadcae`'s map (every tile's type, walkability and height, all 2,048,000 pixels' collision and ground kind, the props, the painted ground) into `tools/fixtures/map-baseline.json`; `scenarios.mjs` matches it exactly in Chromium and WebKit. Checked that it catches a change: one crate moved one tile fails and names the tile.
- Speed (Chromium): `walkable()` about 0.004 µs instead of 0.023, `solidPx` over every pixel 10 ms instead of 37; ground paint unchanged (about 347 ms). New debug API: `layers()`, `blocked(px, py)`, and `tile()` gives height and flags.
- No layout, art, movement or save change. Deployed 2026-09-30 (above).

### Phase 8 D11-A, save v2, 2026-09-30

- `island-save` is now version 2: every v1 field as before, plus `island` (`"home"`), `quests`, `dex`, `cosmetics` (id to boolean/number/short string), `flags`, `tools` (id to boolean) and `edgeSeen`. The shapes are my reading of the field names in `docs/game-design.md`; handoff 2's D11 text is in the missing plan files. `docs/game-design.md`, "Technical", has the rules.
- Migration: a v1 save is rewritten as v2 on load with every valid field kept; the older per-session keys go straight to v2. Junk starts fresh, as before. New: a save from a newer version (`v > 2`) is played fresh but never written over (`saveLocked`), so a rollback or a stale tab can't destroy it. Tightened: `ruler` must be a string and `settings` keeps only `shake`, `flash` and `map` (the fields the game reads).
- `setSave` takes v1 or v2; new `getSave()`.
- Sizes (Chromium): a full v1 save migrated is 390 bytes; one with every planned quest, 20 dex entries and flags is about 1.2 KB; the fullest possible (every list capped at 64) is about 27 KB.
- Deployed 2026-09-30 (above). Rolling back to v1 code would make old code treat v2 saves as unknown and start fresh, so fix forward; don't roll back past `bbadcae`.

### Phase 8 C5, the test API, 2026-09-30

- `window.__island` (`?debug=1` only) gained `step(n)`, `play()`, `setSeed(n)`, `setSave(obj)` and `fireEvent(name)` (`ptero`, `roar`, `quake`; the weather and events system is Phase 13). `getState()` also gives the island clock, found logs, creatures and running events. README, "Debug flags", has the details.
- Every dice roll in `js/world.js` goes through `rand()` (plain `Math.random` unless seeded). Outside `?debug=1`, `?seed=n` still seeds only the fight's own stream, exactly as before. With `?debug=1` it also seeds `rand()`, and `setSeed(n)` reseeds both. New `?step=1`: the live loop never starts, so seeded, stepped runs repeat exactly. The save loader is now `mergeSave()`, shared by `setSave`.
- Nothing changes without `?debug=1`, `?seed` included. Deployed 2026-09-30 with the cache bump to `20261018` (above).
- Tests: new `tools/scenarios.mjs`, 18 checks per engine, passes in Chromium and WebKit. Firefox is **blocked, not failed**: it won't launch inside the Claude app, and Ammaar's own Terminal run (`node tools/scenarios.mjs --engines=firefox`, 2026-09-30) was also blocked at launch ("Failed to launch the browser process"), the same Firefox launch issue as his final Phase 7 audit. Nothing failed. Regression: `focus.mjs`, `codelinks.mjs`, `orbs.mjs`, `doors.mjs` pass; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox, LinkedIn); html-validate and cspell clean.

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

### Phase 7 publication, 2026-09-29

- `trading-lab` and `claude-intake-triage` are public on GitLab, after Ammaar's manual fast-forward sync and a clean GitLab re-scan. `homelab` and this repo stay private.
- The site links only those two (per-repo switches in `js/head.js`), `github` labels are `gitlab`, copy P-19 and P-20, cache `20261017`. Checked in the cloud session: `codelinks.mjs`, html-validate, cspell, `deploy.mjs --dry-run`, `audit.mjs --engines=chromium` (0 failed; LinkedIn and Loom unreachable from there) and `focus.mjs` in Chromium.
- **Deployed** 2026-09-29 by Ammaar: he pushed `f18918c` to GitHub `main`, ran the Mac checks, then ran `node tools/deploy.mjs` on that state. Cloudflare version `41e97ef1-1b2b-4a55-b5ce-c3bace2f7489`, cache `20261017` (deploy log in `docs/hosting.md`). Ammaar's final Mac audit: `audit.mjs` 36 passed, 0 failed, 1 blocked (Firefox, "Could not find profile folder").
- Deferred, optional: the diagrams (K) and the screenshot retakes (`docs/screenshots.md`). Waiting: the GitLab profile (section 8, item 6).

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

0. **MAP-A, B0 and core approach fix deploys: done 2026-10-03** (MAP-A: Cloudflare `b62884f1`, cache `20261023`; B0: Cloudflare `0e9f176d`, cache `20261024`; core approach fix: Cloudflare `b5fe7d52`, cache `20261025`; section 7). A manual look at the live island by Ammaar is still welcome; nothing should look different.
1. **Island visual quality reopened:** Ammaar says the conversion does not look good/fully reworked. Fresh assessment in `docs/audit-2026-09-28.md` agrees it needs a coherent art-direction/layout pass, not simply more props. Propose one cohesive slice for approval before expanding it. Park plaque still reads "PI'S ISLAND" rather than Mossgate; buildings/landmarks retain older art. Phase 12 map/layout approval still applies.
2. HSTS: confirm after a week (raise to `max-age=31536000; includeSubDomains` in `_headers` on or after 2026-10-04 if nothing broke).
3. The homelab audit, which settles P-11. Also in that copy-verification queue: the skills list (`js/skills.js`) still names "Unbound". It stays unchanged until verified.
4. Dead-file candidates (README). Résumé bullet issue is closed for the current asset after a fresh render/extraction; tagged-PDF accessibility remains optional future work.
5. GitLab: `trading-lab` and `claude-intake-triage` are public (2026-09-29). After the 2026-10-04 mirror, check both are still public (`curl -s -o /dev/null -w '%{http_code}' https://gitlab.com/api/v4/projects/ammaarrehman%2Ftrading-lab`, 200 while public). `homelab` and this repo stay private.
6. The GitLab profile project `ammaarrehman/ammaarrehman` has been public since 2026-09-25 and was never in Ammaar's scan. Scan it (`node tools/history-review.mjs --repos=ammaarrehman --from=gitlab --no-mirror`), and decide on its commit email and its README (it still says GitHub). Then the profile switch (`"": true` in `js/head.js`) can go on, showing the hero `gitlab` link and the contact row, and GitLab can be added to `sameAs` and `rel="me"`.

## 9. Next steps, in order

Follow handoff 3's build order. Where it stands:

1. **Phase 6:** original copy batch approved/applied; fresh audit complete; its code findings (R1, R2, R4, R5, R7, R8) are fixed (section 7). Deployed, and checked on the Mac in Chromium and WebKit. R3 (minimum TLS 1.2) and R6 (Web Analytics injection off) are set and verified. Phase 6's audit items are complete; still open elsewhere: HSTS on or after 2026-10-04 (section 8), the homelab audit (P-11), the dead-file list, and the island art pass (step 2).
2. **Art conversion:** terrain/asset implementation landed, visual quality NOT accepted. See section 8 and the new audit. Propose a coherent slice; do not mark the whole island finished. Buildings/landmarks, bridges and helipad remain candidates. The pi and "future" reality tower sprites are still built at runtime.
3. **Phase 7 (portfolio upgrades):**
   - **Publication, done and deployed 2026-09-29** (Cloudflare version `41e97ef1`, commit `f18918c`; details in `AUDIT.md`, "Phase 7 publication"):
     - Scans: `tools/history-review.mjs` on every repo, GitHub and GitLab copies, masked, triaged with Ammaar. The site repo (a GPS-tagged photo and unredacted screenshots in its history) and `homelab` stay private.
     - `trading-lab` and `claude-intake-triage`: publication-prep commits, a manual fast-forward to GitLab, a clean GitLab re-scan, then made public by Ammaar.
     - Site: `CODE_HOST` is GitLab, with per-repo switches (`SITE.REPOS` in `js/head.js`). Only those two link out; every other repo path is plain text and its buttons hidden. The `github` labels are now `gitlab`. Copy P-19 and P-20. `tools/codelinks.mjs` checks it all; both GitLab links return 200 (`node audit.mjs --only=a9`).
   - **Waiting:** the profile switch, `sameAs` and `rel="me"` (section 8, item 6). To publish another repo later: scan it, have Ammaar flip it public, then set its switch to `true`.
   - **K (project diagrams): done and deployed 2026-10-01** (Cloudflare `bd2ad2cc`, section 7). Four featured cards, four diagrams.
   - **K4 (screenshot retakes): done and deployed 2026-10-01** (`ef88c90`, Cloudflare `1e3c4c5e`; section 7). The checklist is `docs/screenshots.md`. K4 fixed:
     - the trading-lab screenshot, which showed the old return chart ("$250 invested, 2015-2026", the strategy against SPY);
     - the Terraform screenshot, whose page showed `github.com/ammaarrehman/homelab` (a private repo, and GitHub links are off).
   - **Triage repo screenshot privacy cleanup: done 2026-10-01** (triage commit `e07c933`, on GitHub and GitLab; section 7). The three static README screenshots are clean; their earlier versions remain in the repo's history, not rewritten.
   - **Next, before Phase 9: the triage repo's media review (read-only first).** The tracked video `Claude Intake Triage Assistant for Nonprofits.mp4` and the Loom demo (`loom.com/share/c43efcd9…`, linked from the triage README, the project card and the island desk) are not yet reviewed for the same exposures; nothing in them has been changed.
   - **L6 email:** on hold (decision 6).
4. **Phase 8 (foundations):**
   - Handoff 2 C5: **done 2026-09-30** (section 7). `tools/scenarios.mjs` is where C4 and D11 scenarios go.
   - C4: a fresh bug hunt on the island as it is now, with the C5 scenario tools (handoff 2's list is lost; don't recreate it from memory). Found and approved: C4-1 pi's paths stop short at river and pond banks (**fixed 2026-09-30**, section 7); C4-2 the helicopter can land in, and a reload can restore pi into, walkable pockets cut off from the island (**fixed 2026-09-30**, section 7). Both deployed 2026-10-01 (Cloudflare `bff274a4`). **Phase 8 is done**; only B2 below remains, deferred to Phase 12. Handoff 3 B2's cave transition waits for the Phase 12 tunnel.
   - D11: split in two. **D11-A save v2: done 2026-09-30** (section 7). **D11-B map data layers: done 2026-09-30** (section 7). All three deployed 2026-09-30 (Cloudflare `591b3f45`). C4's cave transition (handoff 3 B2) is deferred to Phase 12: it can't be tested until the tunnel exists.
5. **Phase 9:** the CTF (handoff 2 E1). **Done and deployed 2026-10-02** (Cloudflare `77077169`, cache `20261022`; section 7): the engine, the cave terminal's commands, slot 1 Fence Logs and slot 2 Radio Static. Deliberately not in Phase 9: the Scanner and slot 3 (Phase 11), the cave's tunnel and chamber, the B2 transition and slot 4 (Phase 12), Root, Server Key, slots 5 and 6, the CTF's full narrative home and any reward for all six (Phase 18).
6. **Phase 10:** the art test-area stop (already reached; see step 2). Since then: P10-0 (visual reconnaissance) and P10-R (the island masterplan, concept 5 approved) were done, and MAP-A, the authored map foundation, is built and deployed 2026-10-03 (Cloudflare `b62884f1`, cache `20261023`; section 7). Then the MAP-B world plan (r2.1) was approved 2026-10-03 (section 7). **MAP-B (B0, then the 150 x 120 home island) comes next, before any geography-dependent Phase 11 work**, and it takes over Phase 12's home island layout. B0 is built and deployed 2026-10-03 (Cloudflare `0e9f176d`, cache `20261024`; section 7), and so is the core approach fix (Cloudflare `b5fe7d52`, cache `20261025`; section 7). The 150 x 120 island's B1 blockout is complete as staged data in `tools/` (2026-10-07, not deployed; section 7). **Next: B2**, the runtime format, the generalized painter and a local dev-only preview of the staged island (the list is in `docs/game-design.md`, "Technical", MAP-B B1); it doesn't switch production. Then B3, buildings and content.
7. **Phase 11:** movement (F1 to F5): heights, jumping and falling, crouch and stealth (the caged Utahraptors are the stealth tutorial), sprint and stamina, swimming, the volcano with lava and respawn, the new key bindings.
8. **Phase 12:**
   - The map export (handoff 2 C1 step 1) and the regions plan. **Stop** for Ammaar's approval.
   - The home island layout: now part of MAP-B (step 6).
   - The terminal cave's tunnel and chamber (E3; the entrance is done).
   - Interiors per E6.
9. **Phase 13:** weather and events (Part I).
10. **Phase 14:** The Climb (Part J), with the dread engine (handoff 2 C3). Use ref-1 for the vista's composition only.
11. **Phases 15 to 19:** NPCs and quests (H); regions and species (Styracosaurus from ref-9, etc.) with the camera and Field Guide; the containment breach (handoff 2 E2); Server Key, the reef and live status (needs the lab on the Pi); the standalone game (handoff 2 Part F).

## 10. Known gaps and notes

- Save v2 is live (2026-09-30): fix forward, never roll back past `bbadcae`, or returning visitors' island progress starts fresh.
- The audit's confirmed bugs (the `DEEP` collision, focus escaping the island, three walkable tiles painted as water) are fixed (section 7).
- Firefox can't launch inside the Claude app on the Mac, so `audit.mjs` reports it as blocked (exit 2) there. Since 2026-09-30 it is also blocked at launch from Ammaar's own Terminal (it worked there on 2026-09-28), so Firefox currently has no automated coverage; record it as blocked, not failed. The orb test's Chromium contact failures were a test-timing problem, now fixed (R8). Supplemental collectors (`review.mjs`, `island-review.mjs`) gather evidence and are not pass/fail gates.
- Cloud sessions (claude.ai/code): the container has Chromium only, and it is an older build than the pinned Playwright 1.63 expects. Point `PLAYWRIGHT_BROWSERS_PATH` at a scratch directory whose `chromium_headless_shell-1243/chrome-headless-shell-linux64/` links to `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/*`, with `chrome-headless-shell` linked to `headless_shell`. Don't run `playwright install`. There is no WebKit or Firefox, no `~/.agent-handoff`, and no `tools/.venv`. The network policy also blocks `ammaarrehman.com` and SSL Labs, so live checks can't run there. GitHub push may be refused (403) if Claude's GitHub access isn't connected; then hand the commits over as a git bundle (`git bundle create <file> origin/main..HEAD`) and push from the Mac.
- `js/hands.js` drawing before it was built (the `drawImage` TypeError found during Phase 7 K): **fixed** in `cd80047` and deployed 2026-10-01 (Cloudflare `8957e8ba`, cache `20261021`; section 7). `tools/hands.mjs` guards it.
- `doors.mjs` misses its 16 ms budget on some frames in the cloud container (software rendering). The commit before the audit fixes misses it the same way, and worse, so it isn't a regression. Judge door timing on the Mac.

- The ground painter's pixel edges can sit up to about half a tile off the collision tiles (the waterline is biased out to sea so walkable sand never looks wet). Road pixels can cross a solid cliff-rim tile at a stair edge.
- The lowland is a narrow strip of clearings, so it has few inland trees; adding woods there is a layout change for Phase 12.
- The Utahraptor's feathers are subtle at 33 px wide; consider a bigger sprite when the creatures get their full art pass.
- The far legs in `animate.py` are darkened copies of the near legs. That's fine at game scale; the Brachiosaurus uses a real rig.
- The pterosaur is the original sprite, kept as drawn. The internal creature key is still `raptor`; only the text says Utahraptor.
- `tools/resume.py` is out of date against the résumé PDF, and the rules say never to regenerate the PDF from it.
- The Loom demo link on the triage card returns 200. LinkedIn returns 999 to scripts, so check it by hand.
- Ammaar said he wants "everything" done; the build order above is long. Work phase by phase, report after each, and stop at each Stop. When he pushes for speed, prefer finishing whole, tested pieces over half-built ones.
