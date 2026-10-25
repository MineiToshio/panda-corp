---
id: LESSON-0525
type: gotcha
domain: auth
tags: [oauth, google, redirect-uri, localhost, better-auth]
context: configuring/debugging a Google OAuth (web client) sign-in flow for local development
trigger: use this when a Google OAuth sign-in fails with a redirect_uri_mismatch (or silently fails to callback) during local development, before assuming the console registration is missing or wrong
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — Google's web OAuth client requires the redirect URI to match EXACTLY, including the port; there is no localhost wildcard. 127.0.0.1 (instead of localhost) and any port other than the one actually registered both fail. The callback for http://localhost:4030 (the project's BETTER_AUTH_URL) was already registered in the console; the agent nearly concluded it was missing without checking first"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0027]
---

**Situation:** a local Google sign-in flow needed its redirect URI to resolve correctly. Google's OAuth
web-client redirect URI matching is EXACT — hostname, scheme, and port all must match a registered URI
character-for-character. There is no wildcard for `localhost`, and `127.0.0.1` is treated as a different
host than `localhost` even though both resolve to the loopback address. The project's actual auth base
URL (`BETTER_AUTH_URL=http://localhost:4030`) was already correctly registered in the Google console —
the near-mistake was assuming the callback was unregistered and needed to be added, without checking.

**Lesson:** Google OAuth redirect URI validation has zero tolerance for host/port variation —
`localhost:4030` and `127.0.0.1:4030` are different registered URIs even on the same machine, and a port
mismatch (even by one digit, e.g. after a dev-port reassignment) breaks the flow with no useful error
beyond "redirect_uri_mismatch". This generalizes LESSON-0027's "verify before asserting": a missing-looking
OAuth callback is just as likely to be a host/port MISMATCH against an already-correct registration as it
is to be genuinely unregistered.

**Apply next time:** when a Google OAuth callback appears to fail, first check the exact registered
redirect URIs in the Google Cloud console (hostname, scheme, port, trailing slash) against the app's
actual configured auth base URL — before assuming the registration is missing and adding a new one
(which can leave stale/duplicate entries). Always use the exact `localhost:<port>` form the app serves on,
never `127.0.0.1` or a different port, even if both "should" work.
