---
name: sync
description: Reconciles a Pandacorp project's documentation BACKWARDS from
  changes made directly in the code — the inverse of iterate (code→docs). Use
  after editing an app by hand (e.g. Mission Control) outside
  spec/design/implement/change. EXHAUSTIVE by design — it propagates each change
  through its FULL cascade of owning docs (behaviour→FRD + work orders + FDD;
  architecture→blueprint + ADR; UI→FDD + design tokens; scope→PRD) across BOTH
  docs/ and .pandacorp/, and records the area's decision log so nothing is left
  undocumented. Works warm (changes already in context) or COLD (no context — it
  audits the whole app against the docs and finds every gap). A third mode,
  CLOSE-OUT, batch-closes ONE already-implemented change queue card
  (documentation proportional to its rigor, one commit, gated on a green
  non-partial verify.sh) instead of the full cascade. Behind an INTENT gate
  (warm/cold only); marks what it writes as reconciled-from-code; it documents,
  it never verifies — and where the DOC is right (a bug, or
  documented-but-unbuilt work) it routes to /change or marks it pending, never
  rewrites the spec down to the code. Runs INSIDE the project (modo proyecto).
  Hand-edits to the plugin/factory go to /pandacorp:learn.
---

# /pandacorp:sync

**The reverse flow: "I changed the code by hand — now catch the docs up, completely."** The whole pipeline runs `doc → code` (`spec → design → architecture → implement`, and day-to-day `change`/`iterate`). `sync` is the inverse: you edited an app directly — to go fast, to see it change live — and the code outran the docs. `sync` propagates that reality **upstream** to the owning canonical docs **and** the area's decision log. It is `iterate` run backwards, and it is **exhaustive** — the owner's standard is *lots of well-made documentation over too little; nothing slips through*.

Runs inside the project.

## Team

- architect
