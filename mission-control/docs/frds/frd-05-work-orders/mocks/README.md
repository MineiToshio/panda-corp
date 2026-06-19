# FRD-05 mocks — Work orders (live view)

**Visual source = the work-orders kanban of `docs/design/prototype/index.html`** (render function
`projWO()` — both the board and the single-work-order detail; with `woFullDoc()` for the full document
and `frdChip()` for the FRD chip). Reach it in the `portfolio` view: select a project in the rail, then
open the **Work orders** subtab.

The prototype `index.html` is the **runnable** owner-approved mockup (DR-054/056): a client-side SPA
where this surface is a render function on the frozen tokens. No standalone HTML slice or screenshot is
duplicated here — the build's **visual-fidelity gate captures the baseline from the `portfolio` view of
`index.html` (project selected, Work orders subtab)**, and the scoped spec lives in `../fdd.md`.

> Fidelity, not novelty: nothing was relaxed or re-styled. The kanban is **read-only** (no drag, no
> demo controls — see `../fdd.md` §4).
