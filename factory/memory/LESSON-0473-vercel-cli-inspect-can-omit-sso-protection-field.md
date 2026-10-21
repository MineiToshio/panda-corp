---
id: LESSON-0473
type: gotcha
domain: devops
tags: [vercel, sso-protection, cli, deployment-verification, evidence]
context: verifying whether a Vercel deployment is publicly reachable (e.g. for an external callback/webhook target) using the `vercel` CLI
trigger: use this when deciding whether a Vercel project/deployment is publicly accessible, especially before pointing an external callback at it
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — vercel project inspect --json vs real GET /v9/projects"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `vercel project inspect --json` omitted the project's SSO protection setting entirely.
A real authenticated `GET /v9/projects` call against the Vercel API confirmed the actual value:
`all_except_custom_domains`, with only a single `vercel.app` domain exempt — meaning the deployment is
NOT publicly reachable the way the CLI's silence (absence of the field) might suggest.

**Lesson:** the Vercel CLI's `inspect` output is not a complete snapshot of a project's configuration
— a field being ABSENT from its JSON does not mean that setting is off/default/permissive. Inferring
public accessibility from what the CLI happens to print (or not print) can be wrong in the direction
that matters most (treating a protected deployment as open).

**Apply next time:** to verify a Vercel project's actual protection/access configuration, call the
real API endpoint (e.g. `GET /v9/projects/<id>`) directly and read the authoritative field, rather
than trusting CLI inspect output or the absence of a field. Separately: don't use an authenticated
`vercel curl` call (which carries your own credentials) to "certify" that an external, unauthenticated
callback can reach the deployment — that only proves YOUR authenticated access works, not the
external caller's.
