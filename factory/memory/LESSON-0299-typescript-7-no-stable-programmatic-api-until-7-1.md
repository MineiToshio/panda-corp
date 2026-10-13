---
id: LESSON-0299
type: gotcha
domain: typescript-tooling
tags: [typescript, typescript-7, compiler-api, tooling, stack-proposal]
context: picking a TypeScript version for a project whose tooling (Next.js, bundler, lint/type-check scripts) consumes TypeScript's programmatic compiler API, not just `tsc` on the CLI
trigger: "use this when choosing a TypeScript major version for a stack proposal/blueprint and any tool in the chain (framework, bundler, custom scripts) calls into the TypeScript compiler API programmatically rather than only shelling out to `tsc`"
source: "pandacast .pandacorp/run/lessons.md inbox note, 2026-10-10, architecture stack-proposal research — TypeScript 7.0 ships without a stable programmatic API, stabilizing only in 7.1"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** while proposing a stack, TypeScript 7.0 looked like the obvious "latest major" pick — but
tools that consume TypeScript's programmatic compiler API (Next.js's own type-checking, custom build
scripts, some lint integrations) are not guaranteed to work against it: the stable programmatic API only
ships in TypeScript 7.1, not 7.0.

**Lesson:** a new TypeScript major's CLI (`tsc`) landing does not imply its programmatic/compiler API has
also stabilized for that same release — the two can ship on different cadences within the same major
version line. Pinning the "latest major" blindly can break any tool in the chain that imports
`typescript`'s API rather than just invoking the `tsc` binary.

**Apply next time:** before pinning a new TypeScript major for a stack that includes a framework or
custom tooling consuming the compiler API programmatically (not just CLI `tsc`), check that specific
tool's compatibility notes/changelog for that TypeScript version — if the programmatic API is flagged as
unstable in `X.0`, pin to the first `X.y` release where the framework/tooling's own docs confirm support
(for TypeScript 7, that was 7.1, not 7.0).
