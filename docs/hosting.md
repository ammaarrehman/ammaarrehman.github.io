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
| Site deployed on Workers | Workers and Pages, the `ammaarrehman-site` Worker, Settings, Domains and Routes: remove the custom domain. Deleting the Worker removes it entirely. |
| HSTS | Set `max-age=0` in `_headers` and deploy. Browsers that saw a long max-age keep it until it runs out, which is why it starts at 300 seconds. |
| Tunnel (Phase 7) | Zero Trust, Networks, Tunnels: delete `homelab-lab`. On the Pi, `sudo cloudflared service uninstall`. |
| GitHub Pages redirect | Set the Pages source back to `main`. |
