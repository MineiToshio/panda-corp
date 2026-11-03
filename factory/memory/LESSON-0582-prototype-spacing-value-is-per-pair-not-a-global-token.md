---
id: LESSON-0582
type: gotcha
domain: frontend
tags: [design-tokens, spacing, visual-fidelity, dr-062, measurement]
context: measuring a spacing value (gap/margin) from an approved prototype and applying that single sampled number as if it were one general spacing token across an entire layout
trigger: use this when reading a spacing value off a prototype screenshot/export to apply it in code, and more than one kind of gap (between sections, between columns, between individual items/actions) is visible in the same view
source: "mission-control docs/decision-log.md 2026-10-31 (agent-inferred) — a review pass had to restore THREE distinct spacing contracts that a prior pass had collapsed into one: 24px between sections, 16px between health columns, and 12px only between action cards; the 12px figure had been generalized outward and applied where 24px or 16px actually belonged"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a layout had at least three visually distinct gap sizes in the approved prototype (between
major sections, between columns inside a section, between small action cards). A pass measured one of
these gaps (12px, the smallest/most local one) and then applied it more broadly, collapsing what should
have been three separate spacing contracts into one — the sections and columns ended up reading as
cramped as the action-card row.

**Lesson:** a single measured spacing value from a prototype describes the gap BETWEEN THE TWO SPECIFIC
ELEMENTS it was measured between — it is not automatically the layout's general spacing scale. Prototypes
commonly use several deliberately different gap sizes to express hierarchy (bigger gap = bigger
structural break); collapsing them to "the one spacing number I measured" erases that hierarchy even when
every individual value, in isolation, still "looks like a reasonable gap."

**Apply next time:** when porting spacing from a prototype, measure EACH distinct visual tier of gap
separately (section-level, column-level, item/action-level) and give each its own token/value — don't
reuse one sampled measurement as a stand-in for the others just because they're visually similar. If the
prototype shows a layout with more than one gap size, that is a hierarchy to preserve, not noise to
simplify.
