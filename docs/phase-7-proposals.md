# Phase 7 diagram proposals

Proposals only. Ammaar must approve nodes/arrows before SVG implementation. Four featured cards, not nine. No private addresses, hostnames, infrastructure IDs or invented metrics.

**Update 2026-10-01:** approved with changes and built (Phase 7 K, committed, not deployed yet). The final approved nodes, arrows and labels are in `handoff.md`, section 7. The table below is the original proposal.

| Project | Proposed nodes and arrows | Guardrails |
|---|---|---|
| HA DNS | Clients → floating VIP → active DNS node; node A ↔ node B failover relationship; configuration sync A → B | Unbound may be listed as installed, but no AdGuard → Unbound query-resolution arrow until P-11 is verified. Do not imply an unverified current topology. |
| Intake triage | Google Form → Apps Script → Claude API → reviewable structured record; evaluation cases → evaluation results | Record labels: category, urgency, summary, next step, human-review flag. No production-adoption or staff-impact claims. |
| Trading lab | Preregistered rules → self-tests → backtests → rejection before capital | Use the approved nine-experiment scope (P-15). No returns or investment-success implications. |
| Terraform static site | Visitor → CloudFront → private S3; Terraform provisions infrastructure; deploy/teardown script manages the demo lifecycle | Label CloudFront-to-S3 authorization OAC. Do not imply the AWS demo remains live. |

Implementation after approval: accessible SVGs in the existing visual style, concise adjacent text alternatives, legible at phone size, no dependency on color alone. Revalidate against approved copy before drawing.
