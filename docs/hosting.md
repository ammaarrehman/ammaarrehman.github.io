# Hosting: ammaarrehman.com

Where each address is served from:

| Address | Served by | Why |
|---|---|---|
| `ammaarrehman.com` (and `www`, redirected) | Cloudflare Workers static assets, free plan | Global CDN and real security headers. Works while GitHub is flagged. |
| `lab.ammaarrehman.com` | Pi #1 through a Cloudflare Tunnel (later, Phase 7) | Served from the homelab with no open ports. |
| `ammaarrehman.github.io` | A redirect to `https://ammaarrehman.com/`, once GitHub clears the flag | One source of truth. |

The main site is not on the Pi on purpose. Home power, the ISP, the SD card and reboots would all take it down, and Pi #1 is also the DNS primary. If the Pi is down, only the lab page and the island's live panel go amber.

Moving the whole site onto the Pi later would take two changes: point the tunnel's public hostname for the apex at the Pi, and remove the Worker's custom domain. Not planned.

Cost: $0 beyond the domain renewal.

---

## 1. Your steps (accounts and domain)

Nothing here can be done from code. Take a screenshot of anything before you change it.

- [ ] **Accounts.** Turn on two-factor sign-in at GoDaddy. Create a Cloudflare account and turn on two-factor there too.
- [ ] **GoDaddy settings.**
  - Turn on domain lock, auto-renew and privacy.
  - Turn off any domain forwarding or parking.
  - If DNSSEC is on at GoDaddy, turn it off now (it goes back on in step 5, from Cloudflare).
- [ ] **Add the domain to Cloudflare.**
  - Add `ammaarrehman.com` on the Free plan.
  - Review the DNS records Cloudflare imports. Delete GoDaddy's parking and forwarding records.
  - Keep any MX and TXT records if the domain is used for email.
  - Screenshot the imported records before deleting anything.
- [ ] **Switch nameservers.** In GoDaddy: Domain, then DNS, then Nameservers. Choose "Change", then "I'll use my own nameservers", and paste the two nameservers Cloudflare gives you. Wait until Cloudflare shows the domain as Active (usually under an hour, up to 24).
- [ ] **Cloudflare security settings.**
  - SSL/TLS encryption mode: Full (strict).
  - Edge Certificates: turn on Always Use HTTPS and Automatic HTTPS Rewrites. Minimum TLS version 1.2.
  - DNS, then Settings: enable DNSSEC. Copy the DS record it shows and add it at GoDaddy (Domain, then DNS, then DNSSEC).
- [ ] **www redirect.** Rules, then Redirect Rules: use the "Redirect from WWW to root" template. It should be a 301 that keeps the path and the query string.
- [ ] **Deploy sign-in.** In the repo folder, run `npx wrangler login`. It signs in through the browser; no API token is saved in the repo or anywhere in files.
- [ ] **Revoke the July GitHub token** (GitHub, Settings, Developer settings, Personal access tokens) if that hasn't been done.

Tell Claude when the domain shows Active and `wrangler login` has worked.

---

## 2. Deploying

```bash
node tools/deploy.mjs --dry-run
```

builds `.deploy/` from the allowlist in `tools/deploy.mjs` and runs every check without touching Cloudflare.

```bash
node tools/deploy.mjs
```

does the same, then runs `npx wrangler deploy` and checks the live site: a 200 on `/`, the CSP and HSTS headers present, `security.txt` reachable, and a real 404 for a missing page.

```bash
node tools/deploy.mjs --check
```

runs only those live checks. If they fail with `ENOTFOUND` right after a DNS change, this Mac is still holding an old "no such domain" answer from the home DNS; `dig ammaarrehman.com @1.1.1.1` shows whether the domain itself resolves. The negative cache runs out on its own.

```bash
node tools/deploy.mjs --help
```

prints the usage and does nothing else. The script takes at most one option (`--dry-run`, `--check`, `--guard-self-test` or `--help` / `-h`). Any other argument, or two options together, stops it with exit 2 before it builds, writes, installs or deploys anything (`tools/deploy-args.mjs`; `node tools/deploy-args.test.mjs` proves it with every command and request stubbed). Before 2026-10-08 an unknown argument was ignored, so `--help` deployed (the incident in the deploy log). Running it with no option at all is still the real deploy.

What the build refuses to ship: `*.md` files, `tools/`, `.git`, `*.env`, `.dev.vars`, `wrangler.*`, and any file containing something shaped like a key (`ghp_`, `github_pat_`, `-----BEGIN`). It also stops if a page references a file that isn't in the build, or if the CSP in the pages' `<meta>` tags differs from the one in `_headers`.

The headers live in `_headers`. The same policy is in a `<meta>` tag in `index.html` and `404.html` so it also applies on GitHub Pages. Two directives are header-only: `frame-ancestors` (not allowed in a meta tag) and `upgrade-insecure-requests` (in a meta tag it breaks testing on a phone over plain `http://` on the LAN).

### After the first deploy

- [x] Check with `curl -I https://ammaarrehman.com/`, securityheaders.com and SSL Labs, and record the grades (below).
- [x] Move every absolute URL to the new domain: the canonical link, `og:url` and `og:image`, the JSON-LD `url`, `sitemap.xml`, `robots.txt`, and the `Canonical:` line in `.well-known/security.txt`.
- [ ] On or after 2026-10-04, if nothing broke in the first week, raise HSTS in `_headers` to `max-age=31536000; includeSubDomains` and deploy. Don't preload.

### Deploy log

**2026-09-26, first deploy.**

- Live checks: `/` 200 with every header in `_headers`; `http://` and `www.` both 301 to `https://ammaarrehman.com/` with path and query kept; a missing page is a real 404 (and carries the headers); `security.txt` 200. `README.md`, `AUDIT.md`, `docs/`, `tools/`, `wrangler.jsonc`, `_headers` and `.git/` all 404.
- DNSSEC: validates (the `ad` flag from 1.1.1.1). Nameservers are Cloudflare's.
- securityheaders.com: **A**. The one warning is the 300-second HSTS, which is on purpose for the first week.
- SSL Labs: **B** on all four edge addresses. The certificate chain has no issues; the cap is because TLS 1.0 and 1.1 are still accepted, so "Minimum TLS Version 1.2" isn't in effect yet (Cloudflare dashboard: SSL/TLS, Edge Certificates). Expected A once it is; A+ also needs a long HSTS.
- Cloudflare Web Analytics is injecting `static.cloudflareinsights.com/beacon.min.js` into the page. The CSP blocks it (two console errors), which is right: the site loads nothing from other origins. Turn the injection off (Analytics and Logs, Web Analytics, the site, "Disable" or remove automatic setup) rather than widening the CSP.

**2026-09-28, the whole-island art conversion** (version `3df869e0`, cache `20261015`). 7 files changed (world.js, site.js, index.html, both atlases). Live checks passed.

- TLS rechecked with `openssl s_client -tls1` / `-tls1_1` (`-cipher 'DEFAULT@SECLEVEL=0'`): both still complete handshakes (ECDHE-RSA-AES128-SHA). TLS 1.3 is on, but the minimum is still 1.0, so the Minimum TLS Version 1.2 switch below is still needed.

**2026-09-28, the audit fixes** (version `a31ba8b4-4ef8-448f-8317-a39dadbe2078`, cache `20261016`, commit `b6cdf53`). Deployed by Ammaar from the Mac with `node tools/deploy.mjs` after the six fix commits reached GitHub `main`. Cloudflare reported the custom domain `ammaarrehman.com` live. Checked by Ammaar:

- `node tools/deploy.mjs --check` passed, and the live `index.html` carries `v=20261016`.
- `node tools/audit.mjs` (local server): 79 passed, 0 failed, 2 blocked. The two blocked were Firefox (its profile can't be created inside the Claude app) and LinkedIn (999 to scripts). Both were then checked another way: the Firefox audit run from Ammaar's own Terminal works, and the LinkedIn link works when opened by hand.
- `tools/focus.mjs` and `tools/orbs.mjs` pass in Chromium and WebKit.

**2026-09-29, the Phase 7 publication** (version `41e97ef1-1b2b-4a55-b5ce-c3bace2f7489`, cache `20261017`, commit `f18918c`). Ammaar fast-forwarded the Phase 7 bundle onto the Mac, pushed `f18918c` to GitHub `main`, ran the Mac checks, then deployed that state with `node tools/deploy.mjs`. It ships the per-repo GitLab switches (only `trading-lab` and `claude-intake-triage` link out) and the 2026-09-29 copy and résumé updates (commits `637f2e1` to `f18918c`). Checked:

- The live `index.html` carries `v=20261017`, the live `js/head.js` has the same switches as `f18918c`, and no page has a static `gitlab.com` link.
- `node tools/audit.mjs` on the Mac (Ammaar's final run): 36 passed, 0 failed, 1 blocked. The blocked check was Firefox ("Could not find profile folder").

**2026-09-30, the Phase 8 foundation** (version `591b3f45-9e51-49f9-81a3-61b36634cc3b`, cache `20261018`, commit `6c44762`). Deployed by Ammaar from the Mac with `node tools/deploy.mjs` after `6c44762` reached GitHub `main`. It ships C5 (the `?debug=1` test API), D11-A (save v2) and D11-B (the map as data layers); no intended visual or UI behavior changes. Checked:

- Final pre-deploy `node tools/audit.mjs` on the Mac: 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check).
- `node tools/deploy.mjs --check` passed; the live `index.html` has 9 references to `v=20261018`; the live `js/world.js?v=20261018` has `SAVE_V = 2`.
- Manual live check by Ammaar: opened the island on the live site, moved around, used normal interactions and reloaded. It loads and plays normally, and the saved state survives the reload.
- **Save v2 is live.** Each visitor's save is rewritten as v2 the next time they open the island, and code from before `bbadcae` treats a v2 save as unknown and starts fresh. So fix problems forward; don't roll back past `bbadcae`.

**2026-10-01, the Phase 8 C4 fixes** (version `bff274a4-ef11-4b9b-8283-2d40a3a51955`, cache `20261019`, commit `3bfaa3a`). Deployed by Ammaar from the Mac with `node tools/deploy.mjs` after `3bfaa3a` reached GitHub `main`. It ships C4-1 (`cc39bb5`: tapped routes no longer stop short at river and pond banks) and C4-2 (`3bc6f9b`: the helicopter lands, and pi is restored, only on ground reachable from the spawn); `3bfaa3a` is the cache bump. Checked:

- `node tools/scenarios.mjs`: 98 of 98 in Chromium and WebKit (run on `3bc6f9b`; the bump changed only `?v=`). Firefox is blocked at launch, not failed.
- Final pre-deploy `node tools/audit.mjs` on the Mac: 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check).
- `node tools/deploy.mjs --check` passed; the live `index.html` has 9 references to `v=20261019`; the live `js/world.js?v=20261019` has `canStep`, `safeTile` and `hopSpot`.
- Manual live smoke test by Ammaar, all four passed: the lighthouse tap route from the village completes and its card opens; a normal helicopter landing works and pi gets out normally; a reload keeps progress; the helicopter refuses to land over a paddock.
- Save v2 is still live: fix forward, don't roll back past `bbadcae`.

**2026-10-01, the Phase 7 K project diagrams** (version `bd2ad2cc-b2ed-49c1-a00c-9315d331ab27`, cache `20261020`, commit `8216a65`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `8216a65` reached GitHub `main`. It ships the four project-card diagrams: HA DNS (`16ee02b`), intake triage (`d5eff6b`), trading-lab (`26ee4a5`) and Terraform static site with the shared spacing rule (`163cbd9`); `8216a65` is the cache bump. Wrangler uploaded 4 changed files: `index.html`, `css/styles.css`, `js/site.js` and `js/world.js` (the two scripts changed only their `?v=` references). Checked:

- Scope: every commit since `3bfaa3a` is the K diagrams, docs or the cache bump; nothing else changed.
- Pre-deploy on the Mac: `focus.mjs` and `codelinks.mjs` passed; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check); `deploy.mjs --dry-run` passed (52 files, 40 references checked).
- `node tools/deploy.mjs --check` passed; the live `index.html` has 9 references to `v=20261020` and none to `v=20261019`; the live `js/site.js` and `js/world.js` have 2 and 3; the live CSS has the diagram rules.
- Live renders (Playwright, Chromium and WebKit, 1280, 700, 375 and 360 px, light and dark): all four diagrams are present in both layouts, one layout shows at each width, and no text overflows or overlaps. Smallest text: 11.1 px on desktop, 11.9 to 12.9 px on phones.
- The only console error live is the pre-existing `hands.js` reduced-motion `drawImage` error (Chromium and WebKit, `hands.js:63`). It is not part of this release and is not fixed (`handoff.md`, section 10).
- No manual live check by Ammaar yet.

**2026-10-01, the `hands.js` fix** (version `8957e8ba-22da-4e16-ad92-ab82d22b217a`, cache `20261021`, commit `ba157d0`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `ba157d0` reached GitHub `main`. It ships `cd80047` (`hands.js` no longer draws before it's built, so a scroll, resize or theme change during loading no longer throws a `drawImage` TypeError); `ba157d0` is the cache bump. Wrangler uploaded 4 changed files: `js/hands.js`, `index.html`, `js/site.js` and `js/world.js` (the last three changed only their `?v=` references). Checked:

- Scope: every commit since `8216a65` is the `hands.js` fix and its test, docs or the cache bump; the shipped files changed only by the one-line guard and `?v=` references.
- Pre-deploy on the Mac: `hands.mjs` 26 of 26 passed in Chromium and WebKit (Firefox blocked at launch); `focus.mjs` and `codelinks.mjs` passed; html-validate and cspell clean; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check); `deploy.mjs --dry-run` passed (52 files, 40 references checked).
- `node tools/deploy.mjs --check` passed; the live `index.html` has 9 references to `v=20261021` and none to `v=20261020`; the live `js/site.js` and `js/world.js` have 2 and 3; every `?v=20261021` asset the scripts load returns 200; the live `js/hands.js?v=20261021` is byte-identical to `cd80047`'s, guard included.
- Live runtime (Playwright, Chromium and WebKit; Firefox blocked at launch): `hands.mjs` pointed at the live site, holding `hands.json` back during a scroll, resize or theme change, passed 26 of 26 with no page error. The four project cards loaded normally with reduced motion (1280, 700, 375 and 360 px, light and dark; 64 runs) logged no page error, where before nearly every live run logged the `drawImage` TypeError. A normal load with a scroll, a resize and the theme button, in both motion modes and both themes, logged no page or console error; the hands were drawn, and with normal motion they kept animating.
- No manual live check by Ammaar yet.

**2026-10-01, Phase 7 K4 project screenshots** (version `1e3c4c5e-df30-49d7-832b-1b9bf3272aa9`, cache still `20261021`, GitHub `main` at `3636e79`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `3636e79` reached GitHub `main`. It ships `ef88c90` (new HA DNS, trading-lab and Terraform card images and their three `<img>` tags); `3636e79` is its docs. No cache bump: the work images carry no `?v=` and are served with `max-age=0, must-revalidate`. Wrangler uploaded 7 changed files: the six `assets/work/` images and `index.html`. Checked:

- Pre-deploy on the Mac, from the committed state: `focus.mjs` and `codelinks.mjs` passed; html-validate and cspell clean; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check); `deploy.mjs --dry-run` passed (52 files, 40 references checked); the K4 card-image check passed 32 of 32 (below) on the committed files.
- `node tools/deploy.mjs --check` passed. The live `index.html` and all eight `assets/work/` images (the six new ones and the unchanged triage pair) are byte-identical to the repo; each image returns 200 `image/webp`. The three new alt texts are live and the old trading-lab chart's alt text is gone.
- Live card images (Playwright, Chromium and WebKit; Firefox blocked at launch), 1280, 700, 375 and 360 px, light and dark, 1x and 2x (32 runs): each image loads from its srcset (the 600 px file at 1x on desktop and phones, the full one otherwise) at its real size, is uncropped in its 16:10 box, sits inside its card without overlapping its bar or text, has the approved alt text; no horizontal overflow and no page or console error. Previews show the six HA DNS answers, the trading-lab experiment 9 checks and REJECT verdict (no return chart), triage as before, and the Terraform page with the repo URL under an opaque bar.
- No manual live check by Ammaar yet.

**2026-10-02, Phase 9, the CTF** (version `77077169-5af9-4f10-939f-00b4abe2c2ef`, cache `20261022`, commit `50ba18d`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `50ba18d` reached GitHub `main`. It ships E1-A the CTF engine (`f6a3863`), E1-B the cave terminal's CTF commands (`f078a25`), E1-C1 Fence Logs (`b3fc6de`) and E1-C2 Radio Static (`ba8396b`); `74ba3f8` is their docs and `50ba18d` the cache bump. Wrangler uploaded 4 changed files: `index.html`, `css/styles.css`, `js/site.js` and `js/world.js`. Checked:

- Pre-deploy on the Mac, from the committed state (`50ba18d`): `ctf.mjs` 125 of 125 in Chromium and WebKit; `scenarios.mjs` 98 of 98; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn's scripted check); `focus.mjs`, `codelinks.mjs` and `doors.mjs` passed; `hands.mjs` 26 of 26; html-validate and cspell clean; `deploy.mjs --dry-run` passed. Firefox is blocked at launch, not failed. Neither flag's answer is in the deploy build: Fence Logs' address appears only as data inside `fence.log`, Radio Static ships only its Base64 payload, and the CTF table holds only hashes.
- `node tools/deploy.mjs --check` passed. The live `index.html`, `js/world.js`, `js/site.js` and `css/styles.css` are byte-identical to the repo; the live page has 9 references to `v=20261022` and none to `v=20261021`, and the island loads `world.js?v=20261022`.
- Live CTF (the full `ctf.mjs` run against https://ammaarrehman.com, from an untracked copy with only its base URL changed; Chromium and WebKit, 125 of 125 each): a new visitor's board is 0 of 6 with fence logs and radio static open and slots 3 to 6 offline; `fence.log` is listed and exact, and the answer worked out from it captures slot 1; the bunker radio shows the payload with the orb's hum, `echo <payload> | base64 -d` and `--decode` give the flag line, and submitting it captures slot 2; hints, locked and unlocked write-ups, reload persistence in save v2 (no schema change), `ctf`/`flags`/`submit`/`hint`/`writeup`, the 360 px board, keyboard, Shift+Tab, Tab completion (`base64` completes, absent from `help`), reduced motion, the secret toast and axe all pass. A plain visitor session (no `?debug=1`) has no test API and no page or console error in Chromium or WebKit.
- No manual live check by Ammaar yet.

**2026-10-03, MAP-A, the authored map foundation** (version `b62884f1-9481-4774-84f2-f1523d837979`, cache `20261023`, commit `6a5874438c932e958ee0d1a7955e46e41a77f5d0`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `6a58744` reached GitHub `main`. It ships MAP-A: A0 `77e2d65`, A1 `4a7d9b5`, the scanner fix `5480b2b`, A2a `c29dce9`, A2b `a3d56dc`, A3 `83838eb`; `6a58744` is the cache bump, and the deployed commit. An invisible architecture release: the island's geography now comes from the authored `js/maps/home.js` (exported from `715450d`), with no intended visible or gameplay change. Wrangler uploaded 4 changed files: `index.html`, `js/site.js`, `js/world.js` and the new `js/maps/home.js`. Checked:

- Pre-deploy on the Mac, from `6a58744`: `map-export.mjs --check` current; `map-decode.mjs` 174 of 174; `map-parity.mjs` 37 of 37 identical with `715450d` in Chromium and WebKit, every planted mutation caught and the unpaired station move refused, art apart from collision and the loader's retry passing, the registry untouched; `map-baseline.mjs --check` matching the fixture (not rewritten); `scenarios.mjs` 98 of 98; `ctf.mjs` 125 of 125 in Chromium and WebKit; `doors.mjs` passed (worst frame 3.9 ms); `focus.mjs` 16 of 16; `hands.mjs` 26 of 26; `codelinks.mjs` 49 of 49; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn); html-validate and cspell clean; the dry run passed. Firefox blocked at launch throughout.
- `node tools/deploy.mjs --check` passed. The live page has 9 references to `v=20261023` and none to `v=20261022`. The live `index.html`, `404` page, `css/styles.css`, every script (`js/maps/home.js?v=20261023` among them, 200) and the three island images are byte-identical to the deployed commit. The live `home.js` names `715450d4c6efca6a24f7cf21e64fdd25ad38eaba` as its source; the live `world.js` has `SAVE_V = 2`.
- Live runtime (Playwright, Chromium and WebKit, from untracked copies of the tests with only their base URL changed): `scenarios.mjs` 98 of 98 (map parity with the fixture, walkability, routes, safe landings and hop-outs, saves in v2), `doors.mjs` passed (worst frame 3.8 ms), `ctf.mjs` 125 of 125 (slots 1 and 2 open and solvable, 3 to 6 offline, no answer in any shipped file, `home.js` included). A plain visitor (no `?debug=1`): no test API, no page, console or request error, the island opens, `home.js` loads before `world.js` and `ISLAND_MAPS.home` (100 x 80, format 1) is there when `world.js` starts. Screenshots against `715450d` served locally, same engine, seed and steps: the harbour, meadow, lighthouse and a 390 px phone view pixel-identical in both engines; the depot interior differs only in the `?debug=1` overlay's live counters.
- No manual live check by Ammaar yet.

**2026-10-03, B0, map placement data** (version `0e9f176d-d0c6-47ce-b207-85f5a9373e0a`, cache `20261024`, commit `7f29828b6d4ef89e39c9a907c0b12e73e35abe56`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `7f29828` reached GitHub `main`. It ships B0: B0a `80fd9119447677323ae361c15d35cd5b1c473636`, B0b `b795d3284453c2e3c80d2c8b8befff6a1c5f5599`, B0c `8cce475f519008cec1b9ae784ba89347e939c7a4`, B0d `ecbb8096b671edfdb75e46d5cce32ff89d20d89a`, B0e `d1036c2f378f3038b8fb80da76e92ab3592145f2`; `7f29828` is the cache bump, and the deployed commit. Another invisible architecture release: the home island's creature starts and roam areas, bot routes, car, rex, places, zones, arena and first-visit spot now come from `js/maps/home.js`, with no intended visible or gameplay change. Wrangler uploaded 4 changed files: `index.html`, `js/site.js`, `js/world.js` and `js/maps/home.js`. Checked:

- Pre-deploy on the Mac, from `7f29828`: `map-export.mjs --check` current; `map-decode.mjs` 242 of 242; `b0-parity.mjs` 22 of 22 identical with `715450d` in Chromium and WebKit, 19 of 19 planted mutations caught in each; `map-parity.mjs` 37 of 37 in each, every mutation caught; `map-baseline.mjs --check` matching the `bbadcae` fixture (not rewritten); `scenarios.mjs` 98 of 98; `ctf.mjs` 250 (125 per engine); `doors.mjs` passed (worst frame 4.0 ms); `focus.mjs` 16 of 16; `hands.mjs` 26 of 26; `codelinks.mjs` 49 of 49; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn); html-validate and cspell clean; the dry run passed. Firefox blocked at launch throughout.
- `node tools/deploy.mjs --check` passed. The live page has 9 references to `v=20261024` and none to `v=20261023`. The live `index.html`, `404` page, `css/styles.css`, every script (`js/maps/home.js?v=20261024` among them) and the three island images return 200 and are byte-identical to `7f29828`; the live `world.js` has `SAVE_V = 2`.
- Live runtime (Playwright, Chromium and WebKit, from ignored copies of the tests in `tools/out/b0/release/live/` with production as the current side; the tracked tests are unchanged): `b0-parity` 22 of 22 identical with `715450d` (creatures, roam-area identities, cargo stops, welder, gardener, drone pad, car, rex, goto places, goto heli and helipad with the helicopter in three places, the zones, arena, first visit, and the core tap still heading for 36,25 / 36,26 and ending at 36,27); `map-parity` 37 of 37; `scenarios.mjs` 98 of 98; `doors.mjs` passed (worst frame 3.7 ms); `ctf.mjs` 250 (Fence Logs and Radio Static live, slots 3 to 6 offline). A plain visitor (no `?debug=1`): no test API, no page, console or request error, `home.js` (100 x 80, format 1) loaded before `world.js`. Screenshots against MAP-A (`6a58744` served locally), same engine, seed and steps: harbour, meadow, depot, lighthouse and a 390 px phone view pixel-identical in both engines; the depot interior differs only in the `?debug=1` overlay's live counters; the big map is 300 x 240 with identical pixels at 1280 and 390 px.
- Production is still the 100 x 80 island. `SAVE_V` is still 2. The 150 x 120 MAP-B geography hasn't started; the core-tap bug was still outstanding on purpose in this release (fixed in the next one, below) and the `CX` / `CY` cleanup is deferred.
- No manual live check by Ammaar yet.

**2026-10-03, the core approach fix** (version `b5fe7d52-c7c5-49e7-a543-aabb127aafca`, cache `20261025`, commit `ea910c58f4f3600ea26a23cd30fb1b381e43fefd`). Deployed by Claude on the Mac with `node tools/deploy.mjs`, with Ammaar's written authorization for this release, after `ea910c5` reached GitHub `main`. It ships the fix `19724cccf61e8158fb584429c864e6b486d419af`; `ea910c5` is the cache bump, and the deployed commit. Tapping the core after the orb fight used to send pi toward 36,25 / 36,26, where the arena was before `a28541f`; it now plans toward the authored `anchors.coreApproach`, 48,44, with the existing loose planner kept on purpose (pi stops on the target or a valid tile next to it). Nothing else changes. Wrangler uploaded 4 changed files: `index.html`, `js/site.js`, `js/world.js` and `js/maps/home.js`. Checked:

- Pre-deploy on the Mac, from `ea910c5`: `map-export.mjs --check` current; `map-decode.mjs` 250; `b0-parity.mjs` 21 of 21 identical with `715450d` in Chromium and WebKit, the explicit `core.tap` check and the core regression passing, 19 of 19 planted mutations caught in each; `map-parity.mjs` 37 of 37 in each, every mutation caught; `map-baseline.mjs --check` matching the `bbadcae` fixture (not rewritten); `scenarios.mjs` 98 of 98; `ctf.mjs` 250; `doors.mjs` passed (worst frame 3.1 ms); `focus.mjs` 16 of 16; `hands.mjs` 26 of 26; `codelinks.mjs` 49 of 49; `audit.mjs` 81 passed, 0 failed, 2 blocked (Firefox's browser launch, LinkedIn); html-validate and cspell clean; the dry run passed. Firefox blocked at launch throughout.
- `node tools/deploy.mjs --check` passed. The live page has 9 references to `v=20261025` and none to `v=20261024`. The live `index.html`, the 404 page, `css/styles.css`, every script (`js/maps/home.js?v=20261025` among them) and the three island images return 200 and are byte-identical to `ea910c5`. The live `home.js` has `"coreApproach":[48,44]` (100 x 80, format 1); the live `world.js` reads `MAP.anchors.coreApproach`, has no 36,25 / 36,26 core destination, and has `SAVE_V = 2`.
- Live runtime (Playwright, Chromium and WebKit, from ignored copies of the tests in `tools/out/coreapp/release/live/` with production as the current side; the tracked tests are unchanged): the core tap end to end (from four sides the tap plans toward 48,44 with the loose planner; pi walks to its stop, 48,45 from the south, 48,43 north, 49,44 east, 47,44 west, and the core's dialog opens); `b0-parity` 21 of 21 identical with `715450d` plus `core.tap` and the core regression (only the approach moved: the tap follows it; only the arena moved: the island refuses to load); `map-parity` 37 of 37; `map-baseline --check` matching; `scenarios.mjs` 98 of 98; `ctf.mjs` 250 (Fence Logs and Radio Static open, slots 3 to 6 offline); `doors.mjs` passed (worst 3.2 ms). A plain visitor gets no test API and no page, console or request error. Harbour, meadow, the core and arena, depot, lighthouse and a 390 px phone view are pixel-identical to the previous production (`7f29828` served locally); the big map is 300 x 240 with identical pixels at 1280 and 390 px.
- Production is still the 100 x 80 island. `SAVE_V` is still 2. MAP-B hasn't started and the `CX` / `CY` cleanup is deferred.
- No manual live check by Ammaar yet.

**2026-10-08, accidental deploy, rolled back (not a release).** Nothing in this entry was approved for production.

- What happened: at 20:07 EDT (2026-10-09 00:07:09 UTC) Claude ran `node tools/deploy.mjs --help` while starting MAP-B B2e, to read the script's options. The script didn't know `--help`, ignored it and ran its normal path: build, checks (passed), then `npx wrangler deploy`. That deployed `main` at `227c16950ce53f9a4810760e6b27a9ad00e06fe6` (MAP-B B2d, committed but never meant to ship) as Cloudflare version `e1d40cdd-e047-4c71-9090-35cd10d2726e`. Claude saw it from the output, stopped and reported it.
- What it shipped: only `js/world.js` differed from the approved release (+849 / -92 lines since `ea910c5`: the dormant MAP-B format-2 decoder, preview gate and painter). `index.html`, `js/maps/home.js` (format 1, 100 x 80) and every other file were unchanged; `SAVE_V` 2 and the cache `20261025` unchanged; no staged map file in the bundle (`tools/` stays out; `/tools/maps/staged/home.js` 404). The format-2 code runs only for a staged format-2 map with the preview flag on a loopback host, none of which exist in production, and the format-1 path had passed MAP-A parity, B0, scenarios and the legacy decoder at B2d. So the live island behaved as before, but the code was unapproved.
- Rollback: with Ammaar's written authorization for that one action, `npx wrangler rollback b5fe7d52-c7c5-49e7-a543-aabb127aafca` (no build, no upload; it repoints the deployment at the existing version) at 20:13 EDT (2026-10-09 00:13:42 UTC). Wrangler reported success; `npx wrangler deployments status` shows `b5fe7d52-c7c5-49e7-a543-aabb127aafca` at 100%. The accidental version was live about 6.5 minutes.
- Verified after the rollback (read-only, cache-bypassed): `index.html`, `/404`, `css/styles.css`, `js/world.js`, `js/site.js`, `js/maps/home.js`, `js/audio.js`, `js/boot.js`, `js/windows.js` and `js/orb.js` byte-identical to `ea910c5` (the approved release), both with a random query and at the exact `?v=20261025` URLs browsers request; the live `world.js` has `SAVE_V = 2` and none of the format-2 code; 9 references to `v=20261025`; the live `home.js` is format 1, 100 x 80; `/tools/maps/staged/home.js`, `/tools/maps/home.src.mjs`, `/tools/fixtures/mapb-ground.json`, `/tools/deploy.mjs`, `/js/maps/staged/home.js`, `handoff.md` and `docs/game-design.md` all 404; a missing page 404. Fresh Playwright contexts in Chromium and WebKit, with no-cache requests (`tools/out/rollback/live.mjs`, ignored): the home page and the island load with 0 page errors, 0 console errors and 0 failed requests; the island runs the format-1, 100 x 80 map, no staged registry, no preview badge. Scripts are served `Cache-Control: public, max-age=0, must-revalidate`, so a browser that fetched the accidental `world.js` revalidates and gets the approved one on its next load. Saves were never at risk: both versions are save v2.
- The fix: `tools/deploy.mjs` now checks its command line first (`tools/deploy-args.mjs`) and refuses any argument it doesn't know, or more than one option, with exit 2 before anything else; `--help` prints the usage and exits 0; the wrangler step also refuses to run unless no option was given. `tools/deploy-args.test.mjs` proves it without touching Cloudflare (every child process and fetch stubbed); run against the old script, the same stubs record `--help` reaching `npx wrangler deploy`. The fix is tooling only and isn't deployed (it doesn't ship).

### Two dashboard items for Ammaar (both done 2026-09-28)

**1. Minimum TLS version. Done 2026-09-28.** Set to TLS 1.2 and verified by Ammaar: TLS 1.0 and 1.1 now fail, TLS 1.2 connects, and the SSL Labs recheck passed as expected (A was the expected grade). The steps stay here for reference (undo: set it back in the same place).

Before: checked 2026-09-27, TLS 1.3 was on, but TLS 1.0 and 1.1 still connected (`openssl s_client -tls1` completed a handshake). Turning 1.3 on and setting the minimum are two different switches.

1. Cloudflare dashboard, then the `ammaarrehman.com` zone.
2. SSL/TLS, then Edge Certificates.
3. Scroll to **Minimum TLS Version** and choose **TLS 1.2**. (Leave "TLS 1.3" on; it's a separate switch further down.)
4. Check it took: `openssl s_client -connect ammaarrehman.com:443 -tls1_1 </dev/null` should now fail with an alert, and `-tls1_2` should still connect.
5. Re-run SSL Labs (https://www.ssllabs.com/ssltest/analyze.html?d=ammaarrehman.com&latest). Expected: A. Record it in the deploy log.

**2. The console error behind Lighthouse's 92. Done 2026-09-28.** Ammaar switched the automatic injection off and verified it: the live page fetched with browser headers has no `cloudflareinsights`, Chrome DevTools shows no CSP errors, and the Lighthouse recheck passed as expected (best practices 100 was the expected score). The CSP is unchanged. The steps stay here for reference (undo: turn automatic setup back on in the same place).

Before: Cloudflare's Web Analytics added this to every page it serves to a browser (curl without browser headers doesn't get it):

```html
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/..." data-cf-beacon='{"token": ...}'>
```

The site's CSP only allows scripts from its own origin, so the browser refuses it and logs an error. That refusal is correct: the site loads nothing from other origins. Don't widen the CSP; switch the injection off:

1. Cloudflare dashboard, then the `ammaarrehman.com` zone.
2. Analytics & Logs, then **Web Analytics**.
3. On the `ammaarrehman.com` row, open **Manage site** (or the site's settings).
4. Turn off automatic setup (the option is labelled **Disable** or an **Enable** toggle, depending on the dashboard version) and save.

The zone's own traffic analytics (Analytics & Logs, Traffic) keep working with no script on the page. After the change, `node tools/lighthouse.mjs` should show best practices 100.

### Verified 2026-09-27

- `https://www.ammaarrehman.com/some/path?q=1` returns 301 to `https://ammaarrehman.com/some/path?q=1`: path and query kept.
- DNSSEC: the DS record is published at the parent (key tag 2371, algorithm 13) and answers from 1.1.1.1 carry the `ad` flag, so the chain validates.

### GitHub Pages, once the flag clears

A local branch `gh-pages` (not pushed) holds one page that redirects to `https://ammaarrehman.com/` with a meta refresh and a canonical link. When GitHub clears the account:

1. `git push origin gh-pages`
2. Repo Settings, Pages: set the source to the `gh-pages` branch.

The code stays on `main`. Don't add a `CNAME` file: it would make GitHub try to serve the apex itself.

---

## 3. Undoing each step

| Step | How to undo it |
|---|---|
| Nameservers moved to Cloudflare | In GoDaddy, Nameservers, choose "GoDaddy default". Turn DNSSEC off in Cloudflare first and remove the DS record at GoDaddy, or the domain stops resolving. |
| Records deleted in Cloudflare | Re-add them from the screenshots taken before deleting. |
| www redirect rule | Delete the rule in Rules, Redirect Rules. |
| A bad deploy | `npx wrangler deployments list` to find the last good version, then `npx wrangler rollback <version-id> -m "<reason>"`. It switches traffic to that existing version with no build or upload (done 2026-10-08, see the deploy log). Never roll back past `bbadcae` (save v2). |
| Site deployed on Workers | Workers and Pages, the `ammaarrehman-site` Worker, Settings, Domains and Routes: remove the custom domain. Deleting the Worker removes it entirely. |
| HSTS | Set `max-age=0` in `_headers` and deploy. Browsers that saw a long max-age keep it until it runs out, which is why it starts at 300 seconds. |
| Tunnel (Phase 7) | Zero Trust, Networks, Tunnels: delete `homelab-lab`. On the Pi, `sudo cloudflared service uninstall`. |
| GitHub Pages redirect | Set the Pages source back to `main`. |
