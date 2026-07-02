---
description: Documentation discipline — keep the canonical doc current AND log the decision with its why.
applies_when: always
globs: ["docs/**"]
source: Pandacorp standard — documentation
---

# Documentation & decisions

Every relevant change is **two writes, always**:

1. **Update the canonical doc** — the document that *owns* that fact, so it describes reality as of now.
2. **Record the decision** in `docs/decision-log.md` — date, *what*, *why*, linking the doc you touched (most recent on top).

The canonical doc answers *"what is true now?"*; the decision log answers *"how did we get here and why?"*. You need both — the doc alone loses the why; the log alone leaves the doc lying.

## Which canonical doc owns what

| Change | Owning doc |
|---|---|
| App behavior / feature (what it does, acceptance criteria) | the feature's FRD (`docs/frds/frd-NN-<slug>/frd.md`); new feature → new FRD |
| Feature implementation design | that feature's `blueprint.md` |
| Platform-wide architecture / stack / data model | `docs/product/architecture.md` + an ADR |
| Product scope / goals / metrics | `docs/product/prd.md` |
| Visual design, tokens, components | `DESIGN.md` / design tokens |

A behavior change is **not done** without its updated FRD **and** its decision-log entry.

## Forbidden pattern — `docs/proposals/` in a project

This project **never** has a `docs/proposals/` folder. That pattern exists only in the factory repo (`panda-corp/docs/proposals/`) for factory-level RFCs.

A pending change always goes to **`.pandacorp/inbox/changes/`** (via `/pandacorp:change`). A file in `docs/proposals/` is invisible to the build engine and to Mission Control's change queue — it will never be picked up and never be implemented. The table above covers every legitimate destination; if something doesn't fit there, it belongs in the decision log, an ADR, or the inbox.

## Two-layer, feature-centric docs
- A thin **product layer** (`docs/product/`: `prd.md`, `architecture.md`, `research.md`).
- One **self-contained module per feature** (`docs/frds/frd-NN-<slug>/`: `frd.md`, optional `fdd.md`+`mocks/`, `blueprint.md`, `work-orders/`).
- Two architecture layers — **platform** (`docs/product/architecture.md`, one per project) vs **feature** (`frd-NN-<slug>/blueprint.md`, per feature). Never fuse them.
- Don't record trivial changes already obvious from the commit.
