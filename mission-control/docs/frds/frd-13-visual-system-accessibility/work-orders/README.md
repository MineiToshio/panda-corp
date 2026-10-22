# Work orders — FRD-13 Visual system and accessibility

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md)
> (the build engine reads that, not this). Each WO is a coarse slice, carries its own
> `implementation_status` frontmatter and copies in the acceptance criteria it owns.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-13-010 | orbita-tokens-fonts-themes-icons-copy | PLANNED | — | Órbita token layer and Tailwind registry in both themes, self-hosted fonts, theme util with no-flash boot, typed copy accessor, `Icon`, prototype art in `public/` (foundation, W0) |
| WO-13-011 | leaf-primitives | PLANNED | WO-13-010 | Buttons, the one chip family, command box, fields, `MoreBar`, `StateDot`, `Avatar`, `Ring`, progress bars, phase stepper, toast, segmented, badge icon, and the shared tone vocabulary (foundation, W1) |
| WO-13-012 | composite-primitives | PLANNED | WO-13-011 | Card and card header, page head and crumbs, section heading, tabs, empty state, notice, alert banner, dialog family, table, list row, markdown (foundation, W2) |
| WO-13-013 | retire-v1-skin | PLANNED | WO-01-011, WO-02-015, WO-02-016, WO-02-018, WO-02-020, WO-03-007, WO-04-011, WO-04-012, WO-05-008, WO-05-009, WO-07-006, WO-08-003, WO-08-004, WO-10-017, WO-11-004, WO-17-008, WO-18-002, WO-19-003, WO-22-002 | Deletes the v1 compatibility block, retired primitives and dead v1 code, removes Dagre, finalises the README and flips `target_platforms` to responsive (W7, alone) |

> **Depends on** mirrors each WO's `dependsOn` frontmatter (DR-087).

## Build order

- **W0:** WO-13-010, in parallel with WO-22-001, WO-25-001, WO-02-019 and the legacy W0 readers
  (disjoint files).
- **W1:** WO-13-011 (the only v2 WO of the wave).
- **W2:** WO-13-012, in parallel with WO-01-010 and WO-11-003.
- After W2 every feature WO may assume tokens, fonts, icons, `t()` and every primitive of
  `docs/design/components.md`; FRD-19's WO-19-002 mounts the shell in W3.
- **W7:** WO-13-013 alone, after the last surface WO of every FRD; FRD-13's gate runs last.

## AC coverage

| AC | Work order |
|---|---|
| AC-13-010.1 | WO-13-011 |
| AC-13-010.2 | WO-13-010 |
| AC-13-010.3 | WO-13-010 |
| AC-13-010.4 | WO-13-010 |

WO-13-012 and WO-13-013 own no acceptance criterion (map §7); they trace to REQ-13-002, REQ-13-004,
REQ-13-005, REQ-13-007, REQ-13-008, REQ-13-009 and REQ-13-001.

## Superseded (v1 history)

- WO-13-001 (token schema and key maps) → WO-13-010
- WO-13-002 (globals.css wiring) → WO-13-010
- WO-13-003 (tabular-nums and a11y primitives) → WO-13-010
- WO-13-004 (ThemeToggle with high-contrast) → WO-13-010, WO-19-003
- WO-13-005 (StateBadge) → WO-13-011
- WO-13-006 (PageTitle, SectionHead, Tabs) → WO-13-012
- WO-13-007 (Banner and base primitives) → WO-13-011, WO-13-012
- WO-13-008 (RPG primitives) → WO-13-011, WO-13-013
- WO-13-009 (Party canvas primitives) → WO-06-013
