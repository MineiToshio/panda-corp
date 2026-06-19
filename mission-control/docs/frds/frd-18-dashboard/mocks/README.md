# FRD-18 mocks — Dashboard ("Inicio")

**Visual source = the `dashboard` view of `docs/design/prototype/index.html`** (render function
`dashboardView()`, with helpers `digestSection()` / `evCard()`, `qrow()`, `dStat()`, and the
gamification foot built on `.rpgpanel.rpggrid` + `.xpbar`).

The prototype `index.html` is the **runnable** owner-approved mockup (DR-054/056): a client-side SPA
where this surface is a render function on the frozen tokens. No standalone HTML slice or screenshot is
duplicated here — the build's **visual-fidelity gate captures the baseline from the `dashboard` view of
`index.html`**, and the scoped spec lives in `../fdd.md`.

> Fidelity, not novelty: nothing was relaxed or re-styled. To preview, open
> `docs/design/prototype/index.html` and stay on the default "Inicio" view.
> The digest's "simular/reiniciar novedad" footer is **DEMO-only** (see `../fdd.md` §5).
