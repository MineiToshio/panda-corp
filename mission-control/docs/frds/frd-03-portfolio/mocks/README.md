# FRD-03 mocks — Portfolio and project navigation

**Visual source = the `portfolio` view of `docs/design/prototype/index.html`** (render function
`portfolioView()` — the 240px project rail + the workspace pane; the rail items are `railproj`,
the selected one is `.rail.on`).

The prototype `index.html` is the **runnable** owner-approved mockup (DR-054/056): a client-side SPA
where this surface is a render function on the frozen tokens. No standalone HTML slice or screenshot is
duplicated here — the build's **visual-fidelity gate captures the baseline from the `portfolio` view of
`index.html`**, and the scoped spec lives in `../fdd.md`.

> Fidelity, not novelty: nothing was relaxed or re-styled. The right-hand pane is the project workspace
> (FRD-04); this shard owns only the rail + two-column shell.
