---
id: LESSON-0444
type: gotcha
domain: security
tags: [ssrf, dns-rebinding, image-fetch, server-side-fetch, security-audit]
context: a server-side fetch of a user-supplied or third-party image/resource URL (e.g. hotlinking a catalog image, fetching a remote asset to process)
trigger: use this when a server-side route fetches a URL supplied or influenced by an external source (a hotlinked image, a webhook callback, any outbound fetch where the host isn't a fixed internal constant) — check that the resolved network address is validated, not just the hostname string
source: "funko-tracker docs/reviews/security-2026-10-19.md SEC-12 (close-out security audit, fixed same commit)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0425]
---

**Situation:** the close-out security audit found that image fetches (the server-side path that
hotlinks/retrieves catalog images, see LESSON-0425) validated neither the resolved network address nor
pinned it — a hostname string check alone is not enough, because DNS can resolve to an internal/private
address either initially or on a later lookup (classic SSRF via DNS rebinding). The fix: perform the DNS
lookup explicitly at connection time, reject the fetch if the resolved address is private/internal
(including IPv4-mapped IPv6 forms), and use that SAME resolved address for the actual connection rather
than re-resolving — closing the window between "checked" and "connected."

**Lesson:** validating a URL's HOSTNAME is not equivalent to validating the ADDRESS the connection will
actually use — the two can diverge (attacker-controlled DNS, a TTL=0 record that changes between check
and connect, an IPv4-mapped IPv6 literal that string-matching misses). Any server-side outbound fetch
whose target host is influenced by something outside the server's own fixed configuration needs this
treated as an SSRF surface by default, not just a "validate the URL looks like an image" check.

**Apply next time:** for any server-initiated fetch to an external/attacker-influenceable host (image
hotlinking, webhook delivery, link-preview generation), resolve the hostname explicitly, reject
private/loopback/link-local/IPv4-mapped-IPv6 resolved addresses before connecting, and connect to that
EXACT resolved address (not a fresh re-resolution) to close the check-then-connect race.
