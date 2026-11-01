---
id: LESSON-0580
type: pattern
domain: frontend
tags: [markdown, link-resolver, navigation, shared-component, consistency]
context: a shared `<Markdown>` renderer used from more than one consumption context (a URL-routed document reader vs a client-state-driven detail panel), where in-doc relative links must resolve differently per context
trigger: use this when adding a new consumption mode/call site for a shared markdown-link-resolving component, and an earlier call site already had its own working link resolver
source: "mission-control docs/decision-log.md 2026-06 (agent-inferred, corroborated 2026-10-31 .pandacorp/run/lessons.md) — the shared `<Markdown>` component's link resolver was wired for the URL-navigated document reader first (`resolveLink`/`docHref`); the board's card-detail panel, which navigates by client state instead of a URL, hit the SAME in-doc-link bug later because it had no resolver wired at all — `<Markdown>` gained a second resolver SHAPE (`{ onSelect }`) rather than reusing the first one as-is, because the two navigation models are genuinely different, but the gap between 'built for mode A' and 'also needed for mode B' had already shipped as a known, unfixed follow-up"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a shared markdown renderer supports in-document relative links (e.g. `[FRD-01](../frds/frd-01/frd.md)`)
by taking an injectable `resolveLink`/`onSelect` hook. The FIRST consumer that needed working links (a
URL-routed reader) got a resolver; raw, unresolved relative links continued to 404 or "fly away" from
every OTHER consumer of the same `<Markdown>` component until each was audited and given its own matching
resolver — one such gap was identified and explicitly deferred rather than fixed at the time.

**Lesson:** a shared renderer with an *optional* hook for a cross-cutting concern (link resolution, here)
does not make that concern "handled" everywhere it's used — each call site silently falls back to doing
nothing unless someone explicitly wires it. This is invisible until a reader actually clicks a link in
that specific branch, so it is not caught by a smoke test that only renders markdown, only exercises
clicking.

**Apply next time:** when a shared component gains an opt-in hook to fix a bug in one consumption branch,
audit and list EVERY other call site of that component for the same gap in the SAME change — don't treat
"fixed in the reader" as "fixed." If a navigation model genuinely differs enough to need a distinct
resolver shape (URL-based vs client-state-based), that is fine, but the audit and the fix for each branch
still belong together, not staggered across separate changes discovered one broken click at a time.
