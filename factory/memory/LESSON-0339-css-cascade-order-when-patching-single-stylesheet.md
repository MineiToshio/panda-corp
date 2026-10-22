---
id: LESSON-0339
type: gotcha
domain: css
tags: [css, cascade, specificity, monolithic-stylesheet, patching]
context: patching a single large/monolithic stylesheet by appending new rules, and a new rule silently loses to an existing generic rule or is itself silently inherited by an unrelated existing component
trigger: use this when adding or editing a rule in a single large hand-maintained stylesheet (not a scoped component-CSS setup) and the fix doesn't visibly apply, whether because of a specificity mismatch or a source-order tie
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred, two related findings on the same project): (1) a caption bar rendered as `<figcaption>` silently inherited an existing generic `.figure figcaption { display: grid; margin-top }` rule meant for a different context, stacking its actions below the text; (2) a new rule appended right after an early selector anchor (`.text-cover`) still lost the cascade to later, more-generic rules (`.saga-row .actions`, `.card-link`) at equal specificity, because source order — not intent — decided the winner; corroborated by mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Orbita, a DIFFERENT mechanism in the same family: a phone-only override `.acc-table td { border: 0 }` silently lost to the higher-specificity base rule `table.t td`, so leftover borders showed only on phones, caught only in a screenshot, not by reading the CSS"
provenance: agent-inferred
created: 2026-10-15
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0254]
---

**Situation:** two separate patches to the same monolithic stylesheet silently didn't apply as intended.
A new caption-bar overlay inherited an unrelated generic `figcaption` rule written for a different
layout, because it matched the same tag-based selector. A different fix, appended textually right after
the selector it was meant to override, still lost to later same-specificity generic rules elsewhere in
the file, because CSS resolves ties by SOURCE ORDER across the whole file, not by proximity to the
element it's "about."

**Lesson:** in a single large hand-maintained stylesheet, a new or patched rule's effective behavior
depends on its position in the WHOLE file's cascade, not on being placed near the selector it concerns.
A generic selector (a bare tag, a loosely-scoped class) written earlier for one context will silently
apply to a differently-intentioned element later that happens to match it, and appending a fix near its
"logical" spot does not protect it from being beaten by a more specific or later-declared generic rule
elsewhere in the file.

**Apply next time:** when patching a monolithic stylesheet, scope new/overlay-variant rules with
sufficiently specific selectors rather than relying on a bare tag name that a generic rule elsewhere
might already claim; when a fix needs to win a cascade tie, either raise its specificity or append it at
the END of the file rather than near a logically-related but earlier anchor; and verify every CSS patch
with an actual screenshot, since a rule losing silently produces no error.

**Cross-project corroboration (mission-control, 2026-10-21):** a narrow-viewport override written as
`.acc-table td { border: 0 }` lost outright to the unconditional base rule `table.t td` — not a
source-order tie, but a genuine SPECIFICITY gap (one class selector vs. a compound element+class
selector). Same family of trap, same fix shape: match or raise the overriding selector's specificity
(`table.t.acc-table td`), and confirm the result in a screenshot rather than by re-reading the CSS.
