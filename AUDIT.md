# Site audit

Not deployed (the deploy allowlist skips `*.md`). The site went live on ammaarrehman.com on 2026-09-26. Started in Phase 5 with the go-live blockers; Phase 6 adds the rest of the audit (accessibility, performance, cross-browser, links, copy style).

Severity: blocker / high / medium / low. Status: fixed in `<sha>` / proposed / needs Ammaar.

## A6. Security and privacy

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A6-1 | high | Skills section and the CSP | No Vue anywhere; `js/skills.js` is plain JS and renders under `script-src 'self'`. | None needed. | fixed (nothing to do) |
| A6-2 | blocker | `assets/work/ha-dns.webp` (HA DNS project card) | The terminal shows a private LAN address (`192.168.x.x`, the DNS server) three times, plus the Mac's user and host name (`ammaarrehman@Ammaars-MacBook-Pro`). | A replacement screenshot with a documentation address (for example 192.0.2.53) or the address cropped out. Not blurred here. | needs Ammaar |
| A6-3 | medium | `assets/work/terraform.webp` | The address bar shows the CloudFront distribution's domain (`d12…cloudfront.net`), the shell host `homelab`, and the browser profile avatar. The page in it says "Recursive Resolution" (see A1-3). | If the distribution is destroyed, the domain reveals nothing; still, a crop above the address bar removes all three. | needs Ammaar |
| A6-4 | low | `assets/work/triage.webp` | The prompt shows the Mac's user and host name. | A crop, or leave it (it identifies a laptop, not a network). | needs Ammaar |
| A6-5 | low | `assets/work/trading-lab.webp` | Clean. | None. | fixed (nothing to do) |
| A6-6 | low | Every image in `assets/` | No EXIF, GPS or XMP metadata in any of the 11 images. | None. | fixed (nothing to do) |
| A6-7 | low | `assets/resume/Ammaar_Rehman_Resume.pdf` | Metadata: Author "Ammaar Rehman", Title "Ammaar Rehman Resume", Producer "ReportLab PDF Library", Creator "(unspecified)", created 2026-09-25. No other personal fields. | None required. | fixed (nothing to do) |
| A6-8 | high | `assets/resume/Ammaar_Rehman_Resume.pdf` | The 14 bullets are byte 0x7F in Times-Roman with WinAnsi encoding, which has no glyph there, so they show as boxes or blanks. | In your own export: make the bullet • (U+2022). The PDF is not regenerated here. | needs Ammaar |
| A6-9 | low | Transcript | No transcript PDF is deployed. | None. | fixed (nothing to do) |
| A6-10 | medium | Third-party origins | The main page loaded Google Fonts (fonts.googleapis.com, fonts.gstatic.com). | Fonts self-hosted; the main page now contacts no other origin. The CSP allows `https://lab.ammaarrehman.com` for the live status later. | fixed in `7b916f9` |
| A6-11 | low | `.well-known/security.txt` | Has Contact, Expires (2027-09-25, within a year), Preferred-Languages and Canonical. Canonical pointed at github.io. | Canonical (and every other absolute URL) moved to ammaarrehman.com. | fixed in `bdd161a` |
| A6-13 | high | Cloudflare edge TLS | SSL Labs B on all four edge addresses: TLS 1.0 and 1.1 are accepted (`openssl s_client -tls1` connects). | Cloudflare dashboard: SSL/TLS, Edge Certificates, Minimum TLS Version 1.2. | needs Ammaar |
| A6-14 | medium | Cloudflare Web Analytics | Cloudflare injects `static.cloudflareinsights.com/beacon.min.js`; the CSP blocks it, leaving two console errors on every load. | Turn off the automatic Web Analytics injection for the zone. Don't add the origin to the CSP. | needs Ammaar |
| A6-15 | low | `_headers` | securityheaders.com A; X-Frame-Options not set (`frame-ancestors 'none'` covers modern browsers). | Added `X-Frame-Options: DENY`. The other warning, the 300 s HSTS, is deliberate for the first week. | fixed in `a0310c6` |
| A6-12 | medium | `tools/resume.py`, `tools/marks.py` | `tools/resume.py` names "NightStar Solutions, Ellicott City, MD, Founder"; `tools/marks.py` mentions NIGHTFALL and nightstarlabs. Both are served publicly by GitHub Pages today (the new Cloudflare deploy doesn't ship `tools/`). | Flagged, not deleted. | needs Ammaar |

## A4. Performance (Phase 5 part)

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A4-1 | medium | Island loading | The sound engine (`js/audio.js`, 11.5 KB gzipped) loaded for every visitor. | It now loads with the island. A visitor who never touches the orb loads about 19 KB of gzipped JS in total. | fixed in `d4b5dae` |
| A4-2 | low | Project screenshots | Already self-hosted WebP with width, height and lazy loading (not hotlinked). No 1x version. | 600 px versions and a srcset. No PNG fallback: every supported browser reads WebP. | fixed in `99c4a54` |
| A4-3 | low | Fonts | Loaded from Google Fonts. The site uses Geist, Cascadia Mono and (on the 404 page) Instrument Serif, not the fonts the handoff named. | Self-hosted woff2 (latin and latin-ext) with their OFL licenses; the hero's mono is preloaded. | fixed in `7b916f9` |

## A9. Links (Phase 5 part)

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A9-1 | high | Every github.com link | They 404 while the account is flagged. | `GITHUB_LINKS_ENABLED` in `js/head.js`, false for now: repo buttons and GitHub-only entries hide, other github links become plain text, island cards drop theirs. | fixed in `fd5cc1b` |

## A1. Claims (Phase 5: blockers only)

| ID | Severity | Where | Evidence | Fix | Status |
|---|---|---|---|---|---|
| A1-1 | blocker | Main page (hero, honors), the island's tablet card | "FBLA State Champion and Regional Champion" | Ammaar confirms or removes. | needs Ammaar |
| A1-2 | high | Main page, `~/projects/more`, dns-filtering row | "AdGuard Home in front of an Unbound recursive resolver with DNSSEC validation." This says Unbound resolves the queries, which isn't confirmed (the last known setup sent AdGuard upstream to DoH). | See the proposed copy below. | proposed |
| A1-3 | medium | `assets/work/terraform.webp` | The old page in the screenshot says "DNS Filtering and Recursive Resolution". | A new screenshot, or accept it as a picture of an old page. | needs Ammaar |
| A1-4 | medium | Alt text of `assets/work/ha-dns.webp` | Alt says "keepalived failover: the floating IP now answering from the backup node". The image shows one `dig` answer; it doesn't show which node answered. | See the proposed copy below. | proposed |
| A1-5 | low | Education framing | Main page, meta description and island cards all say incoming, starting January 2027. Nothing implies current UMD enrollment. | None. | fixed (nothing to do) |
| A1-6 | low | Nightfall / Nightstar | Not on any served page. Only in `tools/` (A6-12). | None. | fixed (nothing to do) |

## Proposed copy changes

Nothing here is changed until Ammaar approves it.

| Current text | Proposed text | Reason | Source |
|---|---|---|---|
| "AdGuard Home in front of an Unbound recursive resolver with DNSSEC validation. Where the homelab started." (main page, dns-filtering row) | "AdGuard Home and Unbound on a Raspberry Pi, filtering DNS for my devices. Where the homelab started." | Doesn't claim Unbound resolves the queries, and says per-device. If AdGuard now forwards to Unbound, the current text can stay. | Handoff 2 DNS rule; Ammaar to confirm where AdGuard forwards |
| Alt: "keepalived failover: the floating IP now answering from the backup node" | Alt: "A dig query answered by the HA DNS pair's floating IP" | Describes what the screenshot shows. | The image itself |

## Needs Ammaar

1. Confirm or remove the FBLA claim (A1-1).
2. Replace the HA DNS screenshot, or approve a crop (A6-2); decide on A6-3 and A6-4.
3. Say where AdGuard forwards (DoH or Unbound), which settles A1-2.
4. Approve or change the two proposed copy lines.
5. Fix the résumé PDF bullets in your own export (A6-8).
6. Decide what to do with the NightStar and NIGHTFALL mentions in `tools/` (A6-12).
7. Cloudflare dashboard: set Minimum TLS Version to 1.2 (A6-13) and turn off the Web Analytics injection (A6-14).
