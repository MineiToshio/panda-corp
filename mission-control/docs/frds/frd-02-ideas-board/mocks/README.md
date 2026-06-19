# FRD-02 mocks — Party · La Campaña (card detail)

`la-campana.html` is the per-FRD-scoped, self-contained screen for this feature's card-detail
extension, **scoped from `docs/design/prototype/party-pipeline.html`** (the owner-approved visual —
DR-054/056). It is the La Campaña 6-phase pipeline view only (the Campaña tab of the board card
detail), not the whole app.

- **Self-contained** (inline CSS/JS, only the Google-Fonts CDN over the network), navigable.
- **Shared assets are referenced, not copied** — the pixel-art zones/sprites live once under
  `docs/design/prototype/assets/`; this mock points at them via the relative path
  `../../../design/prototype/assets/…` so the ~24 MB asset folder is not duplicated per feature.
- The "Entrar a La Fragua" link points at the sibling shard
  `../../frd-06-party/mocks/la-fragua.html` (in the real app this navigates the host to
  Portfolio → project → Party — AC-02-010.5).

> Fidelity, not novelty: nothing was relaxed or re-styled — the visual is transcribed from the
> approved prototype. The design on the frozen tokens is documented in `../fdd.md`. A baseline
> screenshot is added later by the visual-fidelity gate.
