---
id: LESSON-0097
type: gotcha
domain: testing
tags: [vitest, jsdom, localstorage, node, polyfill]
context: running vitest unit tests (jsdom environment) that exercise browser `localStorage` on Node 20.9+/22+/25
trigger: use this when a vitest suite that touches `localStorage` starts failing with "localStorage.clear is not a function" (or similar) right after a Node version bump, with no code change in the tested unit
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (FRD-23 build) — agent-inferred"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Node 20.9+ (and 22/25) ships a global `localStorage` built in, but it is only functional when
the process is started with a valid `--localstorage-file`; otherwise its methods exist but throw/are
`undefined`. vitest's jsdom environment does NOT override this broken global with jsdom's own working
`Storage` implementation — its allow-list patches `Storage` (the constructor/prototype) but not the
`localStorage` global binding itself. Any test that calls `localStorage.clear()`/`.getItem()` etc. against
the environment default then fails with something like "localStorage.clear is not a function" — looking
like a regression in the code under test, when it's actually a Node-version-triggered environment change.

**Lesson:** upgrading Node (or a CI runner picking up a newer Node automatically) can silently break
jsdom-based tests that rely on `localStorage`, because Node's own built-in now shadows jsdom's working
polyfill and vitest doesn't reconcile the two. This is not a code regression — it reproduces on a clean
checkout the moment the Node version changes.

**Apply next time:** if a jsdom-based suite starts failing on `localStorage` methods after a Node bump,
install a `Storage`/`localStorage` polyfill explicitly in `vitest.setup.ts`, guarded so it only activates
when the environment's own `localStorage` is broken (e.g. call a cheap probe method inside a try/catch and
install the polyfill only on failure) — don't assume vitest+jsdom's default environment is trustworthy
across Node versions. Alternatively, pin the project's Node version (`.nvmrc` / `engines`) to one predating
this behavior change if a polyfill isn't wanted.
