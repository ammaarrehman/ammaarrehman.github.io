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

### Two dashboard items for Ammaar

**1. Minimum TLS version.** Checked 2026-09-27: TLS 1.3 is on, but TLS 1.0 and 1.1 still connect (`openssl s_client -tls1` completes a handshake). Turning 1.3 on and setting the minimum are two different switches.

1. Cloudflare dashboard, then the `ammaarrehman.com` zone.
2. SSL/TLS, then Edge Certificates.
3. Scroll to **Minimum TLS Version** and choose **TLS 1.2**. (Leave "TLS 1.3" on; it's a separate switch further down.)
4. Check it took: `openssl s_client -connect ammaarrehman.com:443 -tls1_1 </dev/null` should now fail with an alert, and `-tls1_2` should still connect.
5. Re-run SSL Labs (https://www.ssllabs.com/ssltest/analyze.html?d=ammaarrehman.com&latest). Expected: A. Record it in the deploy log.

**2. The console error behind Lighthouse's 92.** Cloudflare's Web Analytics adds this to every page it serves to a browser (curl without browser headers doesn't get it):

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
