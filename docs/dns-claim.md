# Making the DNS line true

The résumé says "Run AdGuard Home in front of recursive Unbound with DNSSEC", and the site's dns-filtering row says much the same. That's only true if AdGuard sends its queries to Unbound. The last known setup sent them upstream over DoH instead. Until the steps below pass, no copy says Unbound resolves the queries (AUDIT.md, P-11).

These are steps for Ammaar, on both Pis. Nothing in this repo touches the Pi.

1. **Point AdGuard at Unbound.** AdGuard Home, then Settings, then DNS settings. Set Upstream DNS servers to one line, `127.0.0.1:<Unbound port>` (Unbound's port is often 5335; `sudo ss -ulnp | grep unbound` shows it). Remove the DoH upstreams, and clear the fallback and bootstrap lists of anything you don't want used. Apply, then do the same on the other node.
2. **Check Unbound answers on each node:**
   ```bash
   dig @127.0.0.1 -p <port> example.com +short
   ```
   An address comes back.
3. **Check DNSSEC validation through the floating IP** (from a device that uses the Pis):
   ```bash
   dig dnssec-failed.org        # status: SERVFAIL (a broken signature is refused)
   dig example.com +dnssec      # status: NOERROR, with the "ad" flag
   ```
4. **Record it.** When all three pass, the résumé line is accurate. Write the date verified into AUDIT.md (C-19 and P-11), and the site row can stay as it is.

If you'd rather keep DoH upstream, change the résumé line instead and approve P-11's alternative wording.
