# FRD-17 mocks — Proposals inbox ("Propuestas / Crónica del gremio")

**Visual source = `docs/design/prototype/index.html`** (the owner-approved whole-app prototype —
DR-054/056). **Special case:** the prototype does **not yet draw a dedicated Proposals inbox screen** —
its only presence is the **Autoaprendizaje concept page** (`docPage` p=14, surfaced in the Manual as
`c-autoaprendizaje`), which describes the self-learning loop and **explicitly forward-references this
surface** (line ~1001: *"…mañana, en el buzón de Propuestas de Mission Control (FRD-17)…"*).

So the inbox is **assembled from the frozen PDD primitives the prototype already provides** — fidelity,
not novelty, but with no single render function to copy. The components to reproduce:

- the **self-learning vocabulary, palette mapping and loop framing** of `docPage(p)` with `p=14`
  (loop chips, the 3-actor `panel` rows, the **proposed → tú revisas → approved · rejected** state row,
  the lesson-type chips, the protections list);
- the **top-bar open-count badge** pattern from `topbar()` (the guild-level entry point);
- the **portfolio rail chip** + pending-decisions/bugs chips of FRD-14 (`snapshotPanel` /
  `decisionesBox`) that this inbox extends with a third "proposals" stream;
- the **staleness banner** pattern of `pluginBanner()` for the memory-health nudge;
- the **copy-command chip** `cmdRow` / `docCmd` for the exact `/pandacorp:*` per proposal.

This is the Proposals-inbox surface only (a single FRD's screens), not the whole app. The design on the
frozen tokens (the PDD) is documented in `../fdd.md`.

> Read-only, like FRD-15/16: every "action" is a **copy-command chip** or a **dismiss** — MC never
> harvests, promotes, prunes or runs a skill. No DR-061 `SOLO DEMO` block is needed (no control pretends
> to mutate the factory).
>
> Fidelity, not novelty: nothing is relaxed or re-styled — the visual language is transcribed from the
> approved prototype's PDD primitives + the p=14 concept page. **Because the prototype does not draw
> this screen, the visual-fidelity gate's baseline is captured from the assembled inbox** (DR-055/056),
> flagged in `../fdd.md` so the gate does not expect a prototype screen that does not exist. This
> re-anchor pass is documentation-only.
