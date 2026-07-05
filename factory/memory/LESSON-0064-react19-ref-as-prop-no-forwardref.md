---
id: LESSON-0064
type: pattern
domain: react
tags: [react-19, ref, forwardRef, shared-primitive]
context: a function component in React 19 needs to accept a `ref` (e.g. a shared primitive like a `Card` that a consuming component wants to attach a hook's ref to)
trigger: use this when a shared React component primitive needs an optional ref and the project targets React 19
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a shared `Card` primitive needed an optional `ref` on its anchor branch so a
`useSpotlight()`-style hook could attach to it from a consuming component.

**Lesson:** React 19 lets a function component accept `ref` as a plain prop directly — the
`forwardRef` wrapper is no longer required to make a function component ref-able. This avoids turning a
simple shared primitive into ref-forwarding boilerplate just to support one consumer's need for a ref.

**Apply next time:** on a React 19 codebase, add `ref` as a normal prop to a function component instead
of reaching for `forwardRef` by default — reserve `forwardRef` for cases that actually need it (e.g.
supporting pre-19 React or a library boundary that requires it).
