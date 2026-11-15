---
id: LESSON-0682
type: gotcha
domain: build-engine
tags: [codex, sandbox, next-dev, turbopack, chromium, playwright, env-infra, fsevents]
context: a build-engine worker dispatched to a Codex sandbox cell needs to run a Next.js dev server or a real browser (Playwright/Chromium) to finish its own acceptance checking
trigger: use this when a Codex-sandboxed build/patch worker's e2e or browser acceptance step fails with a native-binding, file-watcher, or file-descriptor error (e.g. "Failed to load native binding" for @swc/core, "unable to start FSEvent stream" under Turbopack, or EMFILE) rather than an application-code error
source: "funko-tracker, build run br-2026-11-14-01, .pandacorp/run/build/journal.jsonl seq 18-22 (2026-11-14): a Codex Sol worker building WO-01-017/018 handed back cause=env-infra with 'The Codex sandbox cannot run Next.js dev servers or Chromium (SWC native cache, FSEvents, EMFILE). Browser and e2e acceptance run in the engine's G2/G3 gates outside the sandbox.' The engine's own unblock instruction told the worker to stop retrying locally, finish static/unit checks, commit, and report the browser checks as pending for G2. The same symptom recurred independently at seq 69 (a reviewer's F3 finding): re-running exploreHome.spec.ts/exploreColor.spec.ts inside the sandbox hit the native SWC cache, then Turbopack failed with 'unable to start FSEvent stream' — correctly attributed to the sandbox, not the UI (citing LESSON-0047's checklist discipline, though this specific mechanism is a sandbox-capability gap, not a screenshot-tool false signal)."
provenance: agent-inferred
created: 2026-11-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047, LESSON-0281]
---

**Situation:** a build/patch/review worker executing inside a Codex sandbox cell tried to run `next dev`
(or Turbopack) and/or a real Playwright/Chromium browser to self-verify its work. The sandbox cannot
reliably supply native filesystem-watch primitives (FSEvents) or enough file descriptors (EMFILE), and
its native-binding cache for `@swc/core` can fail to resolve — so the attempt fails with an
infrastructure error, not an application defect, even when the underlying code is correct.

**Lesson:** a Codex sandbox worker is not a reliable place to run a dev server or a browser for
acceptance evidence — that capability gap is structural (sandboxed FS/process constraints), not a flaky
one-off. The engine already treats this correctly as an `env-infra` handback class (distinct from a
`code`-caused failure) and its own unblock instruction is the right policy: stop retrying the browser
locally, finish what the sandbox CAN verify (static checks: typecheck/lint, unit/component tests), commit,
and explicitly list the browser/e2e checks as pending for the engine's own G2/G3 gates, which run outside
the sandbox. Treating a sandbox FSEvents/EMFILE/native-binding failure as evidence that the UI is broken
(or burning repair attempts retrying it in-sandbox) wastes budget on an unfixable-from-inside-the-sandbox
problem.

**Apply next time:** when a Codex-sandboxed worker's browser/dev-server step fails with a native-binding,
file-watcher or file-descriptor symptom (not a test assertion failure), do not keep retrying it locally or
attribute it to the product code. Finish and commit everything the sandbox CAN verify, explicitly record
the browser/e2e checks as deferred to the gate that runs outside the sandbox (G2/G3), and let that gate be
the actual oracle for visual/browser acceptance — same discipline as LESSON-0047's "rule out known tooling
gaps before trusting an unexpected preview/browser result," but for a distinct mechanism: sandbox
capability, not the preview/screenshot tool itself lying.
