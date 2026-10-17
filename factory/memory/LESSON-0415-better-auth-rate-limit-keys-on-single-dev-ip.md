---
id: LESSON-0415
type: library-verdict
domain: auth
tags: [better-auth, rate-limit, e2e, x-forwarded-for, playwright]
context: e2e tests that create many guest sessions / sign-ups against a Better Auth 1.7.7-backed app running locally or in CI
trigger: use this when e2e sign-up/guest-creation specs start failing intermittently with rate-limit errors despite low total request volume, on a project using Better Auth
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): Better Auth 1.7.7 rate limits key on 127.0.0.1 for every local request (Next sets x-forwarded-for from the socket; dev/test fall back to localhost) and rows persist across runs in the e2e DB; e2e that creates many guests/sign-ups needs a unique single-value IPv4 x-forwarded-for per context AND per run."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Better Auth 1.7.7's rate limiter keys its buckets by client IP. In a local dev/test
environment, Next.js derives that IP from the request socket, which for every local request resolves to
`127.0.0.1` / `localhost` — there is no real distinct client IP per browser context. An e2e suite that
spins up many guest sessions or sign-ups in a single run (and across runs, since rate-limit rows persist
in the e2e database rather than being cleared between runs) quickly exhausts the rate limit for that one
shared "IP", producing failures that look like app bugs but are purely an artifact of every e2e actor
sharing one identity in the rate limiter's eyes.

**Lesson:** a library's IP-based rate limiting is invisible in production (where real distinct client IPs
exist) but becomes a structural e2e-test bottleneck the moment every test actor shares one loopback
address — and the problem compounds across runs if the limiter's storage isn't reset between them. The fix
is not to disable or raise the rate limit (that changes production-relevant behavior) but to give the test
harness a real axis of distinctness the limiter can key on.

**Apply next time:** for e2e suites hitting a Better Auth (or any IP-keyed rate limiter) backed endpoint
with high actor counts, set a unique, valid, single-value IPv4 `x-forwarded-for` header per browser
CONTEXT, and vary it again per test RUN (e.g. derive from a run-scoped seed) so repeated runs against a
persistent e2e database don't re-collide with a previous run's exhausted bucket. Confirm the framework
(Next.js here) actually trusts/forwards a test-supplied `x-forwarded-for` rather than overriding it from
the socket.
