# FRD-06 mocks — Party · La Fragua

`la-fragua.html` is the per-FRD-scoped, self-contained screen for this feature, **scoped from
`docs/design/prototype/party-proposal.html`** (the owner-approved visual — DR-054/056). It is the
La Fragua build view only (a single FRD's screen), not the whole app.

- **Self-contained** (inline CSS/JS, only the Tailwind/Google-Fonts CDN over the network), navigable.
- **Shared assets are referenced, not copied** — the pixel-art zones/sprites live once under
  `docs/design/prototype/assets/`; this mock points at them via the relative path
  `../../../design/prototype/assets/…` so the ~24 MB asset folder is not duplicated per feature.
- The cross-link to La Campaña points at the sibling shard
  `../../frd-02-ideas-board/mocks/la-campana.html`.

> Fidelity, not novelty: nothing was relaxed or re-styled — the visual is transcribed from the
> approved prototype. The design on the frozen tokens is documented in `../fdd.md`. A baseline
> screenshot is added later by the visual-fidelity gate.
