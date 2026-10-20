---
id: LESSON-0433
type: gotcha
domain: build-orchestration
tags: [next-start, production-mode, better-auth, secrets, fidelity-gate]
context: a fidelity/oracle gate (or any verification harness) that builds and serves the app in PRODUCTION mode (`next build` + `next start`) rather than `next dev`
trigger: use this when a verification/e2e harness runs the app via a production build+serve instead of the dev server, and an auth/session flow that passes under every dev-mode e2e starts 500ing only under that harness
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a fidelity/oracle gate built and served the app in PRODUCTION mode. Better Auth refuses
to run with its default/placeholder secret once `NODE_ENV=production` (a deliberate safety check), so
the harness's own sign-in route 500'd — while every dev-mode e2e run, which never hit that check,
continued to pass.

**Lesson:** running a verification harness in production mode is not equivalent to running it in dev
mode plus "more realistic" — production mode silently withdraws dev-only convenience defaults
(placeholder secrets, relaxed checks) that the dev server supplies for free. A library "working under
dev but not under the gate" is not evidence the library or the gate is broken; it is evidence the gate
changed the runtime mode and inherited that mode's own stricter contract.

**Apply next time:** when a gate deliberately builds+serves in production mode, audit every
"deployed-only" check the stack enforces (auth secrets, cookie flags, CORS, telemetry) and set each one
to a FIXED gate constant explicitly in that gate's own server env — never assume dev-mode defaults carry
over, and don't debug a production-mode-only 500 as an application bug before checking whether it is a
production-only guard rail instead.
