# Project screenshot retake checklist

Use authentic project output, never fabricated terminal results. Keep existing images until replacements are reviewed. No new public factual claims without copy approval.

- Capture at 2x the displayed card resolution, using a consistent 16:10 crop and consistent light/dark theme.
- Frame the actual result, not browser chrome, personal tabs, account avatars or desktop clutter. Keep text readable at card size.
- Remove credentials, tokens, private/Tailscale addresses, MAC addresses, device names, shell user/host prompts, account IDs and sensitive form data before capture. Inspect terminal history and browser chrome too.
- DNS: show approved failover/health evidence without resolver addresses or implying Unbound handles queries before P-11 verification. A concise result is preferable to a full network configuration dump.
- Triage: use clearly synthetic cases without patient/student/customer data. Show the structured result and review flag; do not imply operational adoption.
- Trading: show the preregistered test/rejection evidence with its actual scope. No cherry-picked profit chart or implied live investment performance.
- Terraform: show the deployed demo or infrastructure result without distribution identifiers, account numbers or an unsupported current-live claim.
- Trading (found in Phase 7 K, 2026-10-01): the old screenshot was the return chart ("$250 invested, 2015-2026", the strategy against SPY). The replacement must not show strategy returns or profit performance. Done in K4 (below).
- Terraform (found in Phase 7 K, 2026-10-01): the old screenshot's page showed `github.com/ammaarrehman/homelab` (a private repo, and GitHub links are off). The replacement or crop must remove that text. Done in K4 (below).
- Strip EXIF/GPS/XMP metadata; inspect the final exported image, not only the editing canvas. If redaction is needed, use opaque irreversible bars and do not substitute fake values that look real.
- Review all four images together on desktop and phone. Check contrast, crop consistency and legibility; retain useful factual alt text.
- Run the deploy allowlist check and confirm only approved web assets ship. Source captures and reports stay under ignored tools/out, never in deployed assets.

## K4, 2026-10-01

Three cards changed; triage kept exactly as it was (its 15/15 and 9/10 match the card, and the 16:10 card crop only trims empty space). Each new image is exactly 16:10, so the card shows all of it, with a 600 x 375 copy for the srcset. All are WebP; inspecting the exported files shows each holds only the image payload (one VP8 chunk), with no EXIF, XMP or ICC metadata.

- HA DNS (982 x 614): the committed, already-redacted v1 image (Jun 29 2026), rows 178 to 791: the dig HEADER line through MSG SIZE, so all six answers show (the old card crop cut the sixth in half). The command line and its redactions are out of frame; the SERVER redaction stays. No retake: v1 is retired.
- trading-lab (1280 x 800): lines 19 to 29 of `docs/results/faber-2026-09-23.txt` in the public repo (`2edd871`), verbatim, under a plain line naming the file and the lines: the five pre-registered checks (four ok, the 50 bp cost check FAIL), VERDICT: REJECT and the paper-trading line. Typeset in SF Mono Regular, 28 px on 42 px lines from x 56, vertically centred, text #ececf0 and the file line #8c929e, on the HA DNS terminal's background (#222731); no prompt, no window, no returns, Sharpe values or drawdowns (the file's header with those is left out).
- Terraform (1280 x 800): the original `homelab/terraform-aws-static-site/screenshots/live-site.png`, converted from its display profile to sRGB, source rows 688 to 1387 and columns 140 to 1643 (the Uptime Kuma row through the footer), an opaque grey bar (#3c3c3c) over the repo URL and its underline (source box 164,1166 to 776,1216), padded to 1504 x 940 with the page's background (#0a0a0a, 120 px above and below) and scaled to 1280 x 800. Out of frame: the address bar, avatar, `mar@homelab` prompt, the AdGuard/Unbound row and the old tagline.
- Rebuild: these are plain crops and one text render with Pillow (`tools/.venv`); the numbers above are the whole recipe. Source captures and previews stay in `tools/out/k4/`.
