---
id: LESSON-0461
type: gotcha
domain: web-security
tags: [nextjs, origin, reverse-proxy, csrf, request-url, trusted-config]
context: a Next.js route validates a browser's Origin against the Request URL behind a proxy or alternate loopback hostname
trigger: use this when a same-origin browser POST is rejected while the route's Request URL names an internal listener or proxy address
source: "funko-tracker commit 39bb810 (src/app/api/contact/route.ts and _tests/origin.test.ts); .pandacorp/run/runtime-evidence/749ef7dca183-contact-origin-old-route-red.log, f361e040d01f-contact-origin-coverage.log, a2f3f086b20d-contact-origin-verified-summary.json; .pandacorp/run/runtime-contact-browser-focused.log, 2026-10-21"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0102]
---

**Situation:** a contact POST compared the browser's `Origin` with `new URL(request.url).origin`.
The configured public origin was `http://127.0.0.1:4037`, but Next supplied a Request URL with its
`localhost:4037` internal listener. The valid browser POST was refused, while the internal hostname
could pass the old comparison. The old route failed 6 of 13 targeted tests; after the repair, 27 route
tests and 12 focused desktop/mobile browser tests passed. The route now derives its exact allowed
origin from the validated public `BETTER_AUTH_URL`, rejects absent or unapproved `Origin` before reading
the body, and does not derive authority from request `Host` or forwarded-host headers.

**Lesson:** a framework-created Request URL need not name the browser-visible origin. Comparing two
values from a synthetic `Request` in a unit test alone does not prove the relationship at the actual
Next listener/proxy boundary. Accepting `Host` or `X-Forwarded-Host` as a substitute can make the
comparison attacker-controlled.

**Apply next time:** define the allowed public origin from trusted deployment configuration, validate
that URL, compare the untrusted `Origin` exactly, and fail closed on missing configuration or a
mismatch. Exercise the real browser/server path as well as negative header-forgery cases. This is
distinct from retargeting a pinned auth URL after a worktree port changes (LESSON-0102): the configured
URL may be correct while `request.url` still reflects an internal listener.
