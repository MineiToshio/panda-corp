# Mocks — FRD-16 (Orphan project detection)

- **Visual source:** `docs/design/prototype/index.html` — the **banner view** of the dashboard, NOT
  the whole app. **NOTE: the prototype has no dedicated orphans render function** (functional gap —
  see the FRD-16 functional-gap note in the re-anchor). The orphans banner is the sibling of the
  plugin-sync banner, so its fidelity reference is:
  - `pluginBanner()` (lines ~573–575) — the banner template (warn-tone strip, alert-triangle icon,
    heading, command row).
  - `cmdRow()` — the copyable command row idiom (`/pandacorp:adopt` / `/pandacorp:sync-portfolio`).
  - Shared style: `.cmd` + the `warn` tokens.
- **Scope:** only this FRD's banner (per-candidate items + overflow collapse + dismiss). Never the
  whole prototype.
- The banner reuses the **shared `Banner` primitive** (warn variant, dismissible, multi-item) — same
  shape as the FRD-15 plugin-sync banner (DR-057). The scoped design is in `../fdd.md`; all visual
  values come from the frozen `docs/design/design-tokens.json`.
