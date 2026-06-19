# FRD-04 mocks — Project workspace

**Visual source = the project workspace pane of `docs/design/prototype/index.html`** (render functions
`projectPane()` → header + subtabs, `projResumen()` (with `decisionesBox()` + `logBox()`),
`buildModePanel()` + `commandsBox()`, `projDocs()`, plus `progressBar()` and `snapshotPanel()`). Reach
it in the `portfolio` view with a project selected in the rail.

The prototype `index.html` is the **runnable** owner-approved mockup (DR-054/056): a client-side SPA
where this surface is a set of render functions on the frozen tokens. No standalone HTML slice or
screenshot is duplicated here — the build's **visual-fidelity gate captures the baseline from the
`portfolio` view of `index.html` (project selected)**, and the scoped spec lives in `../fdd.md`.

> Fidelity, not novelty: nothing was relaxed or re-styled. The **Work orders** tab is FRD-05 and the
> **Party** tab is FRD-06; this shard owns the workspace shell + Resumen/Documentos/Comandos tabs.
> The build-mode selector (FRD-11) is a copyable-command affordance, not a live build switch
> (see `../fdd.md` §4).
