---
id: LESSON-0141
type: pattern
domain: design-process
tags: [claude-design, canvas, design-system, verification, synthesis, audit]
source: "synthesis over 4 evidence-anchored candidates, all pandacast .pandacorp/run/lessons.md, 2026-07-10 (one design-system-generation session): LESSON-0134 (canvas inlined new UI patterns into a screen instead of asking, even when explicitly told not to, until the instruction was repeated per-screen AND paired with a reminder of its own prior violation), LESSON-0136 (a single-pass Stage-1 generation omitted an entire component category — Banner/Alert, Panel/Surface, Toast — undetected until Stage-2 screens needed them), LESSON-0137 (the canvas's own generated readme claimed 'both themes pass WCAG AA'; a computed OKLCH-to-sRGB contrast check found two failures a visual review missed), LESSON-0138 (a component declared and documented a responsive variant that its actual consumer never wired, invisible to the cross-screen usage-diff reconciliation check) — librarian reflection pass, 2026-07-10"
context: generating or reviewing a UI design system (or any single-pass generative canvas artifact) before trusting it is complete, compliant, and correctly wired
trigger: use this when a Stage-1 design-system generation pass (or any comparable generative-canvas artifact) has just completed, or when you are about to trust its component coverage, its self-reported compliance claims, its declared conditional variants, or its adherence to a "do not create new X" instruction, without an independent check
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0134, LESSON-0136, LESSON-0137, LESSON-0138, LESSON-0109, LESSON-0057, BL-0059, BL-0060]
---

**Situation:** across one design-system-generation session (pandacast), four INDEPENDENT failure modes
surfaced from the same generative canvas, each caught by a different kind of check, none caught by the
"obvious" one (a plain instruction, a visual review, or a cross-screen usage diff): (1) an explicit
"do not create new components, stop and ask" instruction was silently defeated until repeated per-prompt
with a concrete reminder of the canvas's own prior violation; (2) an entire component category (feedback/
notification surfaces) was missing from a Stage-1 pass and only surfaced reactively per-screen in Stage 2;
(3) the canvas's own generated documentation asserted "both themes pass WCAG AA" when a computed
OKLCH-to-sRGB contrast check found two real failures; (4) a documented, prop-driven responsive variant was
never actually wired by its consumer, invisible to the standard "is this used somewhere" reconciliation
diff.

**Lesson:** a generative design canvas produces an artifact that LOOKS complete and compliant along every
axis a human would normally check (it followed the brief, it has a readme claiming compliance, it looks
right on screen, it is used somewhere) while actually failing along four DIFFERENT, uncorrelated axes:
instruction-adherence (duplicated a pattern instead of asking), coverage (missing a whole category),
self-reported correctness (a false compliance claim), and wiring (a declared-but-dead code path). No single
review technique catches all four — a visual review does not catch (2)/(3)/(4); a cross-screen usage diff
does not catch (2)/(3)/(4) either, since it only checks "is X used", not "is X true" or "is X reachable";
restating an instruction once does not reliably hold at all (this generalizes LESSON-0109's "a
surface-text safety instruction does not self-enforce" to design-generation prompting specifically). The
generalizable point: trust NOTHING about a single generative pass's own claims or apparent completeness —
each of the four axes (instructions, coverage, self-reported compliance, wiring) needs its OWN independent,
deterministic check, because passing one gives no signal about the others.

**Apply next time:** after any single generative-canvas pass (a design system, or a comparable artifact),
run four independent checks before trusting the output, none of which substitutes for another: (1)
**instruction adherence** — restate any "do not do X, ask instead" rule in every subsequent prompt, name
the canvas's own prior violation explicitly if it already happened once, and still actively audit the
output for inlined patterns that should have been shared components; (2) **coverage** — check for a
predictable category the generation is prone to skip (feedback/notification surfaces: banner, alert,
toast, panel) even if today's checklist doesn't name it yet; (3) **self-reported compliance** — never
accept the generator's own claim (a readme, a docstring) about a computable property (contrast, a11y,
performance) — run the actual deterministic computation; (4) **wiring** — for any declared conditional/
responsive variant, trace its actual consumer to confirm the trigger condition is really evaluated
somewhere, since a cross-screen usage diff will not catch a variant that is documented but never invoked.
