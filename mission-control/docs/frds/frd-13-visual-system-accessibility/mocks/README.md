# Mocks — FRD-13 (Visual system and accessibility)

**This FRD has no single-screen mock — it is the cross-cutting token/a11y layer**, not a view.

- **Visual source:** `docs/design/prototype/index.html` — specifically its `<style>` block (the
  app-wide RPG embossed skin + the a11y rules: `:focus-visible` ring, `prefers-reduced-motion`,
  `tabular-nums`) and the frozen artifacts it was extracted into:
  - `docs/design/design-tokens.json` (canonical hex tokens — the contract),
  - root `DESIGN.md` (tokens + allowed components + prohibitions),
  - `src/app/_design/tokens/tokens.ts` + `src/app/globals.css` (runtime mirror).
- **Why no `mocks/*.html` slice:** the visual system is applied across **every** screen; the
  per-screen shards live in the consuming FRDs' `mocks/` (FRD-14 snapshot, FRD-15 plugin-sync banner,
  FRD-16 orphans banner, and the Party FDDs). Each of those slices renders **on top of** this layer.
- The design and a11y intent are documented in `../fdd.md`; the fidelity reference is the prototype's
  shared style block plus the frozen tokens.
