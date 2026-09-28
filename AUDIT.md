# Site audit

Latest review: [2026-09-28 full site and island audit](docs/audit-2026-09-28.md). It records new keyboard/terrain findings, current live checks, visual recommendations and explicit coverage gaps. Its code findings (R1, R2, R4, R5, R7, R8) are fixed; its "Fix status" table has the commits. The older completed checklist below is not a clean bill of health for the current island.

Not deployed (the deploy allowlist skips `*.md`). The site went live on ammaarrehman.com on 2026-09-26. Phase 5 covered the go-live blockers; Phase 6 (2026-09-26 and 27) covers the rest. Re-run the automated parts with `cd tools && node audit.mjs`, `node lighthouse.mjs`, `npm run html` and `npm run spell`. `audit.mjs` exits 1 if a check failed and 2 if one couldn't run (for example Firefox inside the Claude app); pass `--engines=chromium,webkit` to leave an engine out on purpose.

Severity: blocker / high / medium / low. Status: fixed in `<sha>` / proposed / needs Ammaar.

## A6. Security and privacy

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A6-1 | high | Skills section and the CSP | No Vue anywhere; `js/skills.js` is plain JS and renders under `script-src 'self'`. | None needed. | fixed (nothing to do) |
| A6-2 | blocker | `assets/work/ha-dns.webp` (HA DNS project card) | The terminal shows a private LAN address (`192.168.x.x`, the DNS server) three times, plus the Mac's user and host name (`ammaarrehman@Ammaars-MacBook-Pro`). | At Ammaar's request: solid redaction bars over the three addresses and the user and host name. No address was swapped for a fake one, so the image stays real output. | fixed in `4c349a9` |
| A6-3 | medium | `assets/work/terraform.webp` | The address bar shows the CloudFront distribution's domain (`d12…cloudfront.net`), the shell host `homelab`, and the browser profile avatar. The page in it says "Recursive Resolution" (see A1-3). | Cropped to the rows from Uptime Kuma down to the footer, padded to 16:10 with the page's own background. The address bar, avatar, `homelab` prompt, old DNS row and the "Information Systems student" tagline are gone. | fixed in `4c349a9` |
| A6-4 | low | `assets/work/triage.webp` | The prompt shows the Mac's user and host name. | Cropped below the prompt line. | fixed in `4c349a9` |
| A6-5 | low | `assets/work/trading-lab.webp` | Clean. | None. | fixed (nothing to do) |
| A6-6 | low | Every image in `assets/` | No EXIF, GPS or XMP metadata in any of the 11 images. | None. | fixed (nothing to do) |
| A6-7 | low | `assets/resume/Ammaar_Rehman_Resume.pdf` | Rechecked 2026-09-28: current PDF has no Title/Author/Producer fields; the earlier metadata description was stale. | None required. | rechecked, no change |
| A6-8 | low | `assets/resume/Ammaar_Rehman_Resume.pdf` | Rechecked 2026-09-28 by rendering and text extraction: bullets display normally and extract as U+2022. Earlier missing-glyph finding does not apply to the current file. PDF is untagged. | No bullet repair needed. Consider an accessible tagged export separately; do not regenerate here. | closed for current asset |
| A6-9 | low | Transcript | No transcript PDF is deployed. | None. | fixed (nothing to do) |
| A6-10 | medium | Third-party origins | The main page loaded Google Fonts (fonts.googleapis.com, fonts.gstatic.com). | Fonts self-hosted; the main page now contacts no other origin. The CSP allows `https://lab.ammaarrehman.com` for the live status later. | fixed in `7b916f9` |
| A6-11 | low | `.well-known/security.txt` | Has Contact, Expires (2027-09-25, within a year), Preferred-Languages and Canonical. Canonical pointed at github.io. | Canonical (and every other absolute URL) moved to ammaarrehman.com. | fixed in `bdd161a` |
| A6-13 | high | Cloudflare edge TLS | SSL Labs B on all four edge addresses: TLS 1.0 and 1.1 are accepted (`openssl s_client -tls1` connects). | Cloudflare dashboard: SSL/TLS, Edge Certificates, Minimum TLS Version 1.2. Rechecked 2026-09-27: 1.3 is on, and 1.0 and 1.1 still complete a handshake, so the minimum is still 1.0. "TLS 1.3" and "Minimum TLS Version" are separate switches (click path in `docs/hosting.md`). | needs Ammaar |
| A6-14 | medium | Cloudflare Web Analytics | Cloudflare injects `static.cloudflareinsights.com/beacon.min.js`; the CSP blocks it, leaving two console errors on every load. | Identified 2026-09-27: Cloudflare Web Analytics (RUM) adds `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/...">` to pages served to browsers; `script-src 'self'` refuses it. Switch the injection off (click path in `docs/hosting.md`); don't widen the CSP. | needs Ammaar |
| A6-15 | low | `_headers` | securityheaders.com A; X-Frame-Options not set (`frame-ancestors 'none'` covers modern browsers). | Added `X-Frame-Options: DENY`. The other warning, the 300 s HSTS, is deliberate for the first week. | fixed in `a0310c6` |
| A6-16 | medium | `js/boot.js` (boot screen) | Printed `homelab-dns-01` and `homelab-dns-02`, the Pis' hostnames, on every first visit. A scan of everything in `.deploy/` for hostnames, private and Tailscale addresses, MACs and `user@host` found nothing else. | "DNS node A / B" with primary and backup. | fixed in `1ae268f` |
| A6-17 | low | Third-party inventory | Origins the main page contacts: none but its own. Reserved: `https://lab.ammaarrehman.com` in `connect-src` (E3, not live). Outbound links only (no requests): github.com, linkedin.com, the mailto address. Unwanted: Cloudflare's injected `static.cloudflareinsights.com` beacon, blocked by the CSP (A6-14). | None. | fixed (nothing to do) |
| A6-18 | low | CDN scripts | No script, style or font is loaded from a CDN, so there's nothing to pin or give an SRI hash. | None. | fixed (nothing to do) |
| A6-12 | medium | `tools/resume.py`, `tools/marks.py` | `tools/resume.py` names "NightStar Solutions, Ellicott City, MD, Founder"; `tools/marks.py` mentions NIGHTFALL and nightstarlabs. Both are served publicly by GitHub Pages today (the new Cloudflare deploy doesn't ship `tools/`). | Removed at Ammaar's call (the NightStar job in `resume.py`, the NIGHTFALL lines in `marks.py`). A tracked `tools/__pycache__/*.pyc` also carried it; untracked and ignored. Older commits keep them (no force-push). | fixed in `edcf5e9` |

## A1. Claims inventory

Source of truth: the résumé PDF on the site (`assets/resume/Ammaar_Rehman_Resume.pdf`, created 2026-09-25), plus Ammaar's decisions below. "Matches" means the site says no more than the résumé.

### Decisions from Ammaar (handoff 3, 0.1, as edited 2026-09-27)

| # | Decision |
|---|---|
| FBLA | Off the site (done, `42551f2`). The résumé only supports "2023 National Qualifier". |
| Ready5 | Keep "in cohort" in the hero (Ammaar prefers it). Elsewhere it already reads "in progress · expected Nov 2026". No change. |
| Email | Keep ammaarrehmanf@gmail.com everywhere. A domain address (hello@) comes later; handoff 3 Part L is on hold. |
| Code host | GitLab, username `ammaarrehman` (Phase 7). |
| DNS | On hold: Ammaar is auditing the homelab. Until AdGuard is verified to forward to Unbound, no copy says Unbound resolves queries. |
| Island personal details | Keep the cats, cockatiels, koi pond, Middle Path drawing and timezone. The car loses its make and model (C-12). |
| Kaiju | Option A (2026-09-27): the same grey, new shapes (a rounder head with pi's eyes, soft back bumps instead of spikes, tail lines that glow at night). |
| Reserve | Mossgate Reserve (2026-09-27), replacing the working name. |

### Inventory

| ID | Claim, as the site says it | Where | Résumé | Status |
|---|---|---|---|---|
| C-1 | Cyber Security Analyst, Cyber Ready Clinic internship cohort, Sep 2026 to present, Maryland | hero, experience, meta, JSON-LD, island | same | matches |
| C-2 | The three Cyber Ready Clinic bullets (Discover5 / Ready5, NIST CSF and CIS, the control areas, client engagements) | experience, island | same wording | matches |
| C-3 | Ready5 Practitioner badge in progress, expected Nov 2026 ("in cohort" in the hero) | hero, experience, education, island | "In progress, expected Nov 2026" | matches (decision) |
| C-4 | Cloud & AI Operations Intern, NextGen Consulting, May 2025 to present | hero, experience, meta | same | matches |
| C-5 | Uses Claude and AWS Kiro **daily** | about, experience | "Use Claude, AWS Kiro, and AWS services" | unsourced word; see copy batch |
| C-6 | Support docs **other staff reuse** | about, experience | "improve documentation" | unsourced; see copy batch |
| C-7 | IT Operations Intern, Jun 2024 to May 2025; resolved 200+ user issues | about, experience | same | matches |
| C-8 | Support documentation that **reduced** repeat-issue resolution time | experience | "to reduce" | qualifier dropped; see copy batch |
| C-9 | Campus Operations Associate, HCC Campus Store / Slingshot, Aug 2024 to present; operates order, fulfillment and inventory systems | experience | same | matches |
| C-10 | Second Campus Store bullet: troubleshoots order, delivery and account issues and **identifies recurring workflow problems** | experience | not on the résumé | unsourced; see copy batch |
| C-11 | HCC A.A. General Studies, Aug 2024 to Dec 2026, GPA 3.65, Dean's List, coursework | hero, about, education, island | "Expected Dec 2026", GPA, Dean's List, same coursework (start date not listed) | matches |
| C-12 | "Ammaar's BMW M3" | island car card and terminal help | not a portfolio claim | decision: "Ammaar's car"; see copy batch |
| C-13 | UMD Smith B.S. Information Systems, guaranteed transfer admission, starts Jan 2027, expected 2028; "incoming" | hero, about, education, meta, island | same | matches |
| C-14 | AWS Certified Cloud Practitioner (CLF-C02) Jun 2026; CompTIA Tech+ Aug 2026 | hero, about, education, meta, skills, island | same | matches |
| C-15 | 9 Anthropic AI Fluency and Claude developer courses, Jun 2026, **incl. Claude Code 101, Building with the Claude API, Intro to MCP** | about, education | "9 courses \| Jun 2026" (no course names) | course names unsourced; Ammaar confirm |
| C-16 | Maryland House of Delegates volunteer staff; Dean's List | about, education | same | matches |
| C-17 | Two Raspberry Pi 5 nodes, HA DNS behind a keepalived VRRP floating IP, failover and failback tested both ways, config synced every 10 minutes | about, HA DNS card, island | same | matches |
| C-18 | "A service-level health check moves the IP to the backup node **within seconds**" | HA DNS card, island rack | "tested automatic failover and failback" | unsourced detail; see copy batch |
| C-19 | "AdGuard Home in front of an Unbound recursive resolver with DNSSEC validation" | more-projects dns-filtering row | the résumé says the same, but handoff 2 says the last known setup forwarded to DoH | on hold (DNS decision); applies to the résumé too |
| C-20 | Prometheus and Grafana; Uptime Kuma "for **every** homelab service"; Tailscale for admin access with no router ports opened | hero, more-projects, island tower | Prometheus/Grafana, Uptime Kuma, Tailscale | "every" is stronger than the résumé; low |
| C-21 | homepage/: "A config-driven dashboard for the whole lab, running full-screen on the rack's touchscreen in kiosk mode" | more-projects | not on the résumé | unsourced; see copy batch |
| C-22 | Claude intake triage: structured records via Google Forms, Apps Script and the Claude API; 15-case eval harness; multi-need coverage 0% to 90%; accuracy to 100% | triage card, island desk | same | matches |
| C-23 | Triage accuracy **from 93%** | triage card, island desk | "to 100%" (no baseline) | unsourced baseline; see copy batch |
| C-24 | "**Staff review every row**" | triage card, island desk | "human-review flags" | implies staff use in production; see copy batch |
| C-25 | Terraform static site: private S3, HTTPS through CloudFront with OAC, all in Terraform | Terraform card, island uplink | same (the résumé also lists Route 53 and IAM) | matches |
| C-26 | "Deployed and destroyed with one command, **inside the AWS free tier, with a budget alarm**"; tag "AWS Budgets" | Terraform card, island uplink | "documented repeatable deployment and teardown" | free tier and budget alarm unsourced; see copy batch |
| C-27 | trading-lab: seven strategies (named), pass/fail rules committed before data, backtests that test themselves, **each run once**, all rejected, $0 lost | about, trading-lab card, chart alt | seven strategies, pre-registered, self-tests, all rejected before capital was deployed | the named experiments and "each run once" come from the repo; Ammaar confirm |
| C-28 | "Four featured builds, then the rest. **Every one is documented on GitHub.**" / "It's all on **GitHub**, this site included." | projects, about | not a résumé claim | untrue to a visitor while GitHub is hidden; host-neutral sentence in the copy batch (Phase 7 wires it to `CODE_HOST`) |
| C-29 | Skills lists (six tabs) | skills | all on the résumé except node-exporter, cAdvisor, "HTML / CSS (in production)" | low; Ammaar confirm the three |
| C-30 | Name, email (ammaarrehmanf@gmail.com), phone, LinkedIn, "Ellicott City, MD" | contact, hero, footer, security.txt, island mailbox and credits | same on the résumé ("Ellicott City, Maryland") | consistent |
| C-31 | Dates | everywhere | "Mon YYYY" ranges with an en dash; the boot screen's ISO date is decorative | consistent |
| C-32 | Island lines about Ammaar's life: two Himalayan cats, two cockatiels, the koi pond, Middle Path drawn with friends, Eastern time | island | not portfolio claims | kept (decision) |

## Proposed copy changes

Approved by Ammaar on 2026-09-27. Applied: P-1 to P-7, P-10, P-12. P-8 and P-9 are wired to `CODE_HOST` and show once the GitLab repos are public. P-11 waits for the homelab audit. P-13 and P-14 stay as they are.

| # | Current text | Proposed text | Reason | Source |
|---|---|---|---|---|
| P-1 | "Tested app functionality, documented bugs, and built support documentation that reduced repeat-issue resolution time" | "Tested app functionality, documented bugs, and built support documentation to reduce repeat-issue resolution time" | Keeps the résumé's qualifier: it states the aim, not a measured result. | résumé, NextGen IT Ops bullet 2 |
| P-2 | "A service-level health check moves the IP to the backup node within seconds; failover and failback tested in both directions, config synced every 10 minutes." (HA DNS card and island rack) | "keepalived moves the floating IP to the backup node automatically; failover and failback tested in both directions, config synced every 10 minutes." | "Health check" and "within seconds" aren't on the résumé. Keep the current line if the homelab audit measures it. | résumé, homelab bullet 1 |
| P-3 | "A 15-case eval harness took primary accuracy from 93% to 100% and multi-need coverage from 0% to 90%. Staff review every row." (triage card and island desk) | "A 15-case eval harness took classification accuracy to 100% and multi-need coverage from 0% to 90%. Every record carries a human-review flag." | The 93% baseline isn't on the résumé, and "staff review every row" implies it's in production use with staff. Keep either if the repo's results and a real deployment back them. | résumé, triage bullets |
| P-4 | "Deployed and destroyed with one command, inside the AWS free tier, with a budget alarm." and the "AWS Budgets" tag (Terraform card and island uplink) | "Deployment and teardown are scripted and documented." and drop the tag | The free tier and budget alarm aren't on the résumé. Keep them if the Terraform repo has the budget resource. | résumé, AWS bullet |
| P-5 | homepage/ row: "A config-driven dashboard for the whole lab, running full-screen on the rack's touchscreen in kiosk mode." | Remove the row, unless it's running now. | Not on the résumé. | Ammaar |
| P-6 | Campus Store bullet 2: "Troubleshoot order, delivery, and account issues, and identify recurring workflow problems to improve consistency during peak periods" | Remove the bullet (bullet 1 already covers troubleshooting). | Not on the résumé. | résumé, Campus Store bullet |
| P-7 | "using Claude and AWS Kiro daily to investigate errors and triage tickets, and I write the support docs other staff end up reusing" (about) and "Use AI-assisted tools (Claude, AWS Kiro) daily to investigate errors, summarize issues, and improve internal support documentation other staff reuse" (experience) | about: "using Claude and AWS Kiro to investigate errors and triage tickets, and to improve our support documentation"; experience: "Use Claude, AWS Kiro and AWS services to investigate errors, summarize issues, and improve documentation" | "Daily" and "other staff reuse" aren't on the résumé. | résumé, NextGen Cloud & AI bullet 1 |
| P-8 | "Four featured builds, then the rest. Every one is documented on GitHub." | "Four featured builds, then the rest. Each has its code and write-up on GitLab." (the host name comes from `CODE_HOST`; with it off: "Four featured builds, then the rest.") | GitHub is hidden, so the sentence is untrue to a visitor today. Ships in Phase 7 with the GitLab links, after the repos pass the secrets scan and go public. | handoff 3 C4 |
| P-9 | "It's all on GitHub, this site included." (about) | "The code is public, this site included." (Phase 7, same condition as P-8) | Same as P-8. | handoff 3 C4 |
| P-10 | "Uptime Kuma in Docker, tracking availability and response health for every homelab service." | "Uptime Kuma in Docker, tracking availability and response health for the homelab's services." | "Every" is stronger than the source. | résumé, homelab bullet 2 |
| P-11 | "AdGuard Home in front of an Unbound recursive resolver with DNSSEC validation. Where the homelab started." | On hold for the homelab audit. If AdGuard is verified to forward to Unbound, keep it. If not: "AdGuard Home and Unbound on a Raspberry Pi, filtering DNS for my devices. Where the homelab started." (and change the résumé line too) | Handoff 2's DNS rule. | homelab audit |
| P-12 | "Ammaar's BMW M3. press e to get in..." (island car card); "fly \| drive  go to the helicopter or the M3" (terminal help) | "Ammaar's car. press e to get in..."; "go to the helicopter or the car" | A specific car plus a named town is a small identification risk, and a brand name in the game. | handoff 3 0.1 #4 (approved direction) |
| P-13 | "9 AI Fluency & Claude developer courses, incl. Claude Code 101, Building with the Claude API, Intro to MCP" | Keep if those are the real course titles; otherwise "9 AI Fluency & Claude developer courses". | The résumé doesn't list course names. | Ammaar |
| P-14 | trading-lab card: the seven named experiments and "each run once"; skills: node-exporter, cAdvisor, "HTML / CSS (in production)" | No change if the repos back them. | Detail beyond the résumé, likely from the repos. | Ammaar |

## A2. The recruiter path

Name, focus area, résumé link and a contact method, all on screen without scrolling (Chromium, `tools/audit.mjs`).

| Size | First visit (boot screen plays) | Repeat visit | First contentful paint |
|---|---|---|---|
| 1366 x 768 | 4.9 s | 1.9 s | about 0.1 s |
| 390 x 844 | 4.3 s | 1.4 s | about 0.1 s |

- Before `d0243e0`, the résumé link and contact were never on screen at 390 px (the nav's résumé link scrolled off to the right, and the hero's links sit below the orb). Fixed by pinning "resume ↗" and "mail" in the nav.
- The first visit waits for the boot screen (about 3 s; any key, click or tap skips it, and it never plays under reduced motion or for `#island` links). Kept: it's part of the site's character. If Ammaar wants recruiters in faster, the boot could shorten to about 1.5 s.
- The main page works fully without ever opening the island.

## A3. Accessibility (WCAG 2.2 AA)

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A3-1 | high | hero terminal title | axe color-contrast: `.term-size` #5a5a5a on #161616, 2.6:1 | `--t3` (4.9:1); also the rack permissions | fixed in `8a701fe` |
| A3-2 | high | window lights on every pane | axe target-size: 12 x 12 buttons 19 px apart | 24 px between centres and a 24 px hit area | fixed in `1bd3736` |
| A3-3 | medium | reduced motion | the cursor blink and the Ready5 scan bar kept running; the hero still waited up to 1.75 s to appear | stopped; the hero appears at once | fixed in `dc75f51` |
| A3-4 | medium | landmarks | two navs both named "Island landmarks"; two regions both named "certifications" | unique names | fixed in `c46f0d1` |
| A3-5 | low | island terminal | a form with no submit button; the input removed its outline | a ↵ submit button and a focus line | fixed in `c46f0d1` |
| A3-6 | low | island dialog | the heading was empty until filled by script | default text | fixed in `c46f0d1` |

Now: axe finds nothing on the main page (light and dark), the 404 page, or the island's card, pause, map and settings dialogs. `lang="en"`, the skip link is the first tab stop, 43 tab stops all show focus, no keyboard trap, headings in order (h1, then h2 per section, h3 inside), link text names its destination, the hero orb doesn't move under reduced motion. Nine project screenshots in the handoff; the site has four, all with descriptive alt text.

## A4. Performance

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A4-1 | medium | Island loading | The sound engine (`js/audio.js`, 11.5 KB gzipped) loaded for every visitor. | It now loads with the island. A visitor who never touches the orb loads about 19 KB of gzipped JS in total. | fixed in `d4b5dae` |
| A4-2 | low | Project screenshots | Already self-hosted WebP with width, height and lazy loading (not hotlinked). No 1x version. | 600 px versions and a srcset. No PNG fallback: every supported browser reads WebP. | fixed in `99c4a54` |
| A4-3 | low | Fonts | Loaded from Google Fonts. The site uses Geist, Cascadia Mono and (on the 404 page) Instrument Serif, not the fonts the handoff named. | Self-hosted woff2 (latin and latin-ext) with their OFL licenses; the hero's mono is preloaded. | fixed in `7b916f9` |
| A4-4 | low | Lighthouse, live site (2026-09-26) | Mobile: performance 100, accessibility 100, best practices 92, SEO 100; LCP 1.9 s, CLS 0, TBT 10 ms. Desktop: 100 / 100 / 92 / 100; LCP 0.3 s. | The 92 is the console error from A6-14; it goes to 100 once the injection is off. | needs Ammaar (A6-14) |

INP needs real visitors; Total Blocking Time is the lab stand-in and is 10 ms.

## A7. Cross-browser and responsive

Chromium and WebKit at 360 x 800, 390 x 844, 768 x 1024, 1366 x 768 and 1920 x 1080, plus the 404 page: no console errors or warnings, no failed requests, no horizontal overflow. Screenshots in `tools/out/` (not committed).

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A7-1 | medium | island opened from a link | 25 "AudioContext was not allowed to start" warnings | audio waits for the first gesture | fixed in `96c7c82` |
| A7-2 | low | island sprites | Chrome's "multiple readback operations" warning | one pixel read per canvas, identical output | fixed in `b264b2a` |
| A7-3 | medium | Firefox | Can't launch inside the Claude app (macOS blocks the folder Firefox needs). | Ammaar runs it in Terminal (below) and pastes the output. | needs Ammaar |

Firefox, from Terminal:

```bash
cd ~/projects/"GITHUB REPO"/ammaarrehman.github.io/tools && npm install && npx playwright install firefox && node audit.mjs --only=a7
```

## A8. Code health

- `npm run html` (html-validate) and `npm run spell` (cspell) pass.
- No console warnings on the main page or in the island.
- README now covers running, deploying, debug flags, every storage key, and where each config lives (`95a6cab`).
- Dead-file candidates are listed in the README for Ammaar: `assets/favicon.png`, `tools/duotone.py`, `tools/resume.py`.

## A9. Links

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A9-1 | high | Every github.com link | They 404 while the account is flagged. | `GITHUB_LINKS_ENABLED` in `js/head.js`, false for now: repo buttons and GitHub-only entries hide, other github links become plain text, island cards drop theirs. | fixed in `fd5cc1b` |
| A9-2 | low | LinkedIn | Returns 999 to scripts (LinkedIn blocks them). | Checked by hand: the profile URL is right. | fixed (nothing to do) |

All 27 links checked: in-page anchors resolve, site files exist, the mailto is ammaarrehmanf@gmail.com, the tel link matches the résumé, the Loom demo returns 200, and the island's `#exit`-style links are actions the island handles.

## A10. Copy style

- No em dashes in anything shipped (`144f51e`); the résumé PDF has none.
- cspell: US spelling; the one British word a visitor could meet ("travelled", read by screen readers) is fixed. Species, koi varieties and product names are in `tools/cspell.json`.
- Product names are consistent: AWS, AdGuard Home, Raspberry Pi, keepalived, Uptime Kuma, CloudFront.
- Dates: "Mon YYYY" everywhere, ranges with an en dash.

## Needs Ammaar

1. Cloudflare: Minimum TLS Version 1.2 and the Web Analytics toggle (click paths in `docs/hosting.md`).
2. Run the Firefox audit command (A7) and paste the output.
3. The homelab audit settles P-11 and C-19.
4. Decide on the dead-file candidates in the README.
5. Fix the résumé PDF bullets in your own export (A6-8).
