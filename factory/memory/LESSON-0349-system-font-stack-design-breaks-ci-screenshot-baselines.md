---
id: LESSON-0349
type: gotcha
domain: design-system
tags: [web-fonts, system-fonts, ci, visual-baseline, self-hosting]
context: a design frozen on system font stacks (e.g. `Iowan Old Style, system-ui`) rather than self-hosted web fonts, before setting up CI visual-regression baselines
trigger: use this when a design is about to be frozen/approved and its typography relies on system font stacks rather than self-hosted web fonts
source: "pandasaga .pandacorp/comms/iteration.md design close-out / .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): a design built on system font stacks looked right only on the designer's OS and made CI screenshot baselines meaningless; the owner was shown a side-by-side and chose Literata + Inter as self-hosted web fonts before freezing"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a design's typography used system font stacks (`Iowan Old Style`, `system-ui`), which
render using whatever font the operating system or browser substitutes. The design looked right on the
machine it was built on, but a CI visual-regression baseline captured on a different OS/headless-browser
font set would render completely different glyphs/metrics — making any screenshot baseline meaningless
for catching real layout regressions, since font substitution alone would diff every run.

**Lesson:** system font stacks are not a neutral/safe default once a design needs REPEATABLE visual
verification — they are, by definition, rendered differently depending on which OS/environment captures
them. A design frozen on system fonts can look correct to its author and still be unverifiable by CI,
because the baseline captured in one environment won't match renders from another. This is invisible
until CI (or a different reviewer's machine) is actually used.

**Apply next time:** before freezing a design that will have CI visual baselines, pick and self-host
specific web fonts (don't depend on the device's installed fonts) and show the owner a side-by-side of
the font change so it's an explicit, approved decision rather than a silent substitution discovered
later when baselines start failing for no code reason.
