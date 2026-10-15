---
id: LESSON-0330
type: gotcha
domain: accessibility
tags: [axe, contrast, non-text-contrast, forms, design-tokens]
context: an automated axe-core accessibility pass reports PASS on a page whose input/select borders are visually too faint
trigger: use this when an axe-core pass reports no contrast violations on a form-heavy page, before trusting that inputs/selects meet WCAG non-text-contrast (1.4.11)
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13 (agent-inferred): axe passed a design round whose input/select borders did not reach the 3:1 non-text-contrast ratio against their background"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0137]
---

**Situation:** an automated axe-core pass reported zero contrast violations on a design round, yet a
manual browser check found several input/select borders well below the 3:1 ratio WCAG 1.4.11 (non-text
contrast) requires for form controls — axe's default ruleset did not catch it.

**Lesson:** a green axe-core run only covers the checks its default/enabled ruleset actually runs; it is
not a guarantee that EVERY WCAG success criterion is checked, and non-text contrast on form control
borders (vs. text contrast, which axe does check reliably) is one gap. Treating "axe passed" as "fully
accessible" lets this class of defect ship silently.

**Apply next time:** for any form-heavy page, add a manual (or scripted, via computed-style + contrast
math) check of input/select/checkbox border contrast against their background, separate from the text
contrast axe already verifies — and keep the control's own border token distinct from a page's generic
architectural divider token, since a divider tuned for subtlety is usually below the 3:1 floor a control
border needs.
