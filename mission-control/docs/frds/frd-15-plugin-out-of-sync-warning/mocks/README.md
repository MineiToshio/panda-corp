# Mocks — FRD-15 (Plugin out-of-sync warning)

- **Visual source:** `docs/design/prototype/index.html` — the **plugin-sync drift banner** slice,
  NOT the whole app:
  - `pluginBanner()` (lines ~573–575) — the persistent warn-tone banner: alert-triangle icon,
    heading, detail line, 3-step recall, and the `claude plugin update pandacorp@panda-corp` command
    row.
  - Demo flag: `PLUGIN_SYNC` (line 572) — `drift:true` previews the banner. In the real app the state
    is decided server-side from git, not a flag.
  - Shared style: `.cmd` / `cmdRow()` + the `warn` tokens.
- **Scope:** only this FRD's banner. Never the whole prototype.
- The banner reuses the **shared `Banner` primitive** (warn variant) — same shape as the FRD-16
  orphans banner (DR-057). The scoped design is in `../fdd.md`; all visual values come from the frozen
  `docs/design/design-tokens.json`.
