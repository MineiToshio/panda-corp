---
id: LESSON-0639
type: anti-pattern
domain: deployment
tags: [dns, vercel, cloudflare, wildcard, domain-verification, launch]
context: verifying a production domain cutover after a green CI/platform deploy, or adding any DNS record at a subdomain already served by a wildcard record
trigger: use this when a deploy pipeline (Vercel/GitHub) reports success and the task is to confirm the production domain is actually live, or when about to add ANY DNS record (including a verification TXT) at a name under a domain that has a wildcard record
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07/08 (agent-inferred, two related incidents): (1) a green Vercel/GitHub deploy did not prove the domain responded — the production host had only a Search-Console TXT record in Cloudflare, no A/CNAME, so it was unresolvable (NOERROR, no answer) despite the deploy being green; (2) separately, adding a Search Console verification TXT at a name served only by a DNS wildcard (*.domain) made that name 'exist' and the wildcard stopped answering A/CNAME for it, taking production down"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation (deploy vs DNS):** a Vercel/GitHub Actions pipeline reported a successful deploy. The
production domain was still unreachable: Cloudflare had only a `TXT` record (google-site-verification) at
that name, no `A`/`CNAME`, so DNS resolution returned `NOERROR` with no answer — the app was never
actually reachable at the domain despite every CI signal being green.

**Situation (wildcard shadowing):** a wildcard DNS record (`*.domain.tld`) was serving a subdomain's
`A`/`CNAME` implicitly. Adding ANY other record (a Search Console `TXT`) at that exact name made the name
"exist" as its own DNS node — and once a name has its own record set, the wildcard NO LONGER answers
`A`/`CNAME` queries for it. Production on that subdomain went unresolvable the moment the TXT was added, a
pure DNS side effect unrelated to the app or the deploy.

**Lesson:** "deploy success" (CI green, platform dashboard green) is a build/release-pipeline signal, not
proof the public domain resolves and serves traffic — the two are verified independently. Separately, a
DNS wildcard is fragile: it only answers for names that have NO explicit record of their own; adding any
record (even an unrelated TXT) at a wildcard-covered name silently breaks the wildcard's A/CNAME answer
for that exact name.

**Apply next time:** after any deploy claims success, verify independently with `dig` against the
authoritative nameserver for the exact production host, plus `curl --resolve <host>:443:<platform-ip>` —
never trust the pipeline's own "success" status as proof the domain is live. Before adding ANY record
(including a verification TXT) at a subdomain, `dig A`/`CNAME` for that exact name AND a random sibling
name to check whether only a wildcard serves it; if so, first create an explicit `A`/`CNAME` copy of the
wildcard's record at that name (a TXT can coexist with a CNAME-replacement `A` record, but not with a
wildcard-only answer). Re-`dig` the production host after any DNS change, not just after the one record
you intended to touch.
