---
id: LESSON-0423
type: anti-pattern
domain: responsive-design
tags: [responsive, color-coding, multi-state, breakpoint, accessibility]
context: a responsive phase/status selector that color-codes a MULTI-VALUE state (more than two named values) via a colored avatar/swatch, where a breakpoint can collapse or hide its text label
trigger: use this when color-coding a state with MORE than two named values (phases, categories, statuses) in a responsive selector/pill/avatar, and a breakpoint reduces the control's width
source: "Mission Control Orbita review round 4, finding R4-01, 2026-10-17 (agent-inferred): below a breakpoint the phase selector showed only a colored avatar with no visible phase text (Architecture/Build/Release); fixed by keeping the phase name visible on a second line at every width"
provenance: agent-inferred
created: 2026-10-18
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0319]
---

**Situation:** a responsive phase selector colored each phase's avatar/swatch distinctly. Above a certain
breakpoint the phase name was shown as text next to the colored avatar; below it, the layout dropped the
text to save space, leaving only the colored avatar — which no longer identified WHICH phase ("Architecture"
vs. "Build" vs. "Release") it represented.

**Lesson:** a color swatch/avatar can reliably carry a binary or small on/off signal by saturation alone
(LESSON-0319), but once a value has more than two specific named states, color alone cannot carry WHICH one
it is — only the text label does. A responsive breakpoint that silently drops that label to save horizontal
space breaks the control's actual communication contract even though the UI still "looks" intact and
colored correctly.

**Apply next time:** when a responsive breakpoint collapses a multi-state (>2 values) color-coded control,
explicitly verify the item's specific text identity remains visible at every width (e.g. move it to a
second line rather than drop it) — never let a narrower viewport silently reduce a multi-value state down
to color-only.
