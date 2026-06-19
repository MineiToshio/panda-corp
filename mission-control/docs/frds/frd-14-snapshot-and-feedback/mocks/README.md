# Mocks — FRD-14 (Probable snapshot and feedback channels)

- **Visual source:** `docs/design/prototype/index.html` — the **snapshot panel + status-chips** slice
  of the project workspace, NOT the whole app:
  - `snapshotPanel(i)` (lines ~781–786) — last probable point, green badge, "building now" notice,
    `git worktree add` command row.
  - `portfolioView()` rail chips `dchip` / `bchip` (lines ~774–776) — pending decisions (amber) /
    bugs (red) per project.
  - Shared style: `.panel` (app-wide `rpgSkin` embossed panel override), `.chip`, `.cmd`.
- **Scope:** only this FRD's screens (the snapshot panel + its rail chips). Never the whole prototype.
- All visual values come from the frozen `docs/design/design-tokens.json`; this README points at the
  banner/panel view of the prototype as the fidelity reference. The scoped design is in `../fdd.md`.
