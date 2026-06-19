# FDD-16 — Orphan project detection (adopt?)

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`, extracted from the owner-approved prototype under DR-054). Cross-cutting tokens/a11y
> are FRD-13's FDD. No new tokens introduced.

- **Visual source:** `docs/design/prototype/index.html`. **There is no dedicated orphans render
  function in the prototype** (see functional gap below). The orphans banner is the **sibling of the
  plugin-sync banner** (FRD-15) — *"detect a gap, show the command, don't act"* — so its visual is
  derived from **`pluginBanner()`** (lines ~573–575) as the banner template, plus `cmdRow()` for the
  command row. Both banners are the **same shape on the same shared `Banner` primitive** (DR-057).

## Surface — the orphans banner (CMP-16-banner)

- **Layout:** a top-of-app dismissible **warning banner** (warn tone, same shape as the plugin-sync
  banner): warn-bg background, hairline warn border, left **alert-triangle** icon, one **item per
  candidate**.
- **Per item:** heading (`--warn`) — *"Proyecto sin registrar: `<name>` — ¿adoptarlo?"* (orphan) or
  *"Proyecto con marcador pero fuera del portfolio: `<name>`"* (unlisted); a monospace selectable
  **path** line; a recall line; a `.cmd` command row + `CopyButton` — `/pandacorp:adopt` (orphan) or
  `/pandacorp:sync-portfolio` (unlisted, REQ-16: don't adopt an already-marked project); a **dismiss
  (×) button** with a Spanish `aria-label`.
- **Overflow collapse:** when **more than two** candidates exist, show the first two + a toggle
  *"Ver N proyectos más sin registrar" / "Ver menos"* so orphans don't dominate the dashboard
  (avoids the wall-of-banners regression).
- **State signal not by color alone:** warning-triangle icon + heading text + the × dismiss button
  carry meaning, not the warn color alone (FRD-13).

## Components mapped to shared primitives
| Surface | Primitive | Notes |
|---|---|---|
| Banner shell | **shared `Banner` primitive** (warn variant, dismissible) | **MUST be the single shared Banner — see below** |
| Per-candidate icon + heading | icon+text state signal (FRD-13 / `StateBadge` idiom) | not color alone |
| Command row + copy | `CopyButton` (`src/components/core/CopyButton/CopyButton.tsx`) | read-only (adopt / sync-portfolio) |
| Overflow toggle / dismiss | `Banner` collapse + dismiss affordance | localStorage-remembered dismissal |

### Shared `Banner` primitive (DR-057 — reuse-before-create)
This banner and the **FRD-15 plugin-sync banner** are the **same banner shape**. They MUST be built on
**one shared `Banner` primitive** with variants (drift vs orphan; dismissible vs persistent; single
vs multi-item with collapse), not two near-duplicate components. Today they are implemented separately
(`src/app/_components/orphans-banner/orphans-banner.tsx` and
`src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx`), each re-declaring the identical
`BANNER_STYLE` / `ICON_STYLE` / `CMD_ROW_STYLE` / `RECALL_STYLE` block — **this is the DR-057
duplicate-banner defect being corrected.** The orphans banner is the `kind="orphan"` (multi-item,
dismissible, collapsible) consumer of that one `Banner`.

## States
- **No orphans** (empty candidate list / not yet fetched / all dismissed): renders **nothing**
  (AC-16-004.7) — no empty shell; self-clears when a candidate is adopted/fixed and drops out of the
  probe.
- **One/two candidates:** all shown inline.
- **>2 candidates:** first two + overflow toggle.
- **Dismissed:** the owner's × hides a candidate (remembered in localStorage, keyed by absolute path —
  a client-local UI state, not a factory write).
- **Loading:** the client component polls `/api/orphans`; renders nothing until the first confirmed
  poll (no false-alarm flash).
- **Error:** a failed/parse-error poll does **not** update state — the banner stays hidden; the rest
  of the app is unaffected.

## Visual reference
`docs/design/prototype/index.html` → `pluginBanner()` (lines ~573–575) as the banner template (the
prototype has no orphans-specific render fn), on the frozen tokens. See `mocks/README.md`.
