# FDD-14 — Probable snapshot and feedback channels

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`, extracted from the owner-approved prototype under DR-054). This FDD describes only the
> FRD-14 surfaces; the cross-cutting token/a11y layer is FRD-13's FDD. No new tokens are introduced.

- **Visual source:** `docs/design/prototype/index.html`.
  - Snapshot panel render fn: **`snapshotPanel(i)`** (lines ~781–786).
  - Per-project rail chips (decisions/bugs): **`portfolioView()`** `dchip` / `bchip` (lines ~774–776).
  - "Building now" + progress: `projectPane(i)` / `progressBar(i)` (lines ~787–809).
  - Shared style: `.panel`, `.chip`, `.cmd` and the app-wide `rpgSkin` panel override.

## Surfaces (this FRD)

### A. Snapshot panel (CMP-14-snapshot-panel)
- **Layout:** a `.panel` (frozen `rpgSkin` embossed panel) with a left status icon (`ti-circle-check`,
  `--ok`) + body. Body line 1: **"Último punto probable: `<FRD>`"** + a green `verde` chip
  (`ok-bg`/`ok`). Line 2 (muted, `text3`): `commit <sha> · testeable sin parar la construcción`. SHA
  rendered with `tabular-nums`.
- **"Building now" block** (when `running`): a visually-distinct line with a hammer icon (`--accent`):
  *"Construyendo ahora: `<wo>` · no probar esto todavía"* — distinct from the probable point
  (REQ-14-002). The two are never conflated.
- **Command row:** the `git worktree add ../<slug>-review <sha>` command in a `.cmd` row + `CopyButton`
  ("pruébalo en otra carpeta"). Read-only — Mission Control never runs it (Non-goal).
- **Staleness warning** (REQ-14-003): when `last_green_sha` is far behind HEAD, an icon + text warning
  (warn tone) that the probable snapshot is getting stale — icon + text, not color alone.

### B. Per-project status chips (CMP-14-status-chips)
- On each portfolio-rail row: an **amber** chip with `pendingDecisions` and a **red** chip with
  `pendingBugs` (from `status.yaml`), plus a `rethink pendiente` indicator when `rethinkPending`. Each
  chip carries its count (`tabular-nums`) + a Spanish label/title — never color alone.

## Components mapped to shared primitives
| Surface | Primitive | Notes |
|---|---|---|
| Snapshot panel container | `.panel` / `rpgSkin` embossed panel | frozen app-wide skin — no bespoke panel |
| Green "verde" + staleness | `StateBadge` idiom (icon+shape+label) | reinforce ok/warn by icon, not color alone |
| Command row + copy | `CopyButton` (`src/components/core/CopyButton/CopyButton.tsx`) | read-only command surface |
| Rail decisions/bugs/rethink | `StatusChips` (`src/app/portfolio/_components/status-chips/status-chips.tsx`) | counts with `tabular-nums` |

## States
- **Populated:** probable point + (optionally) building-now + (optionally) staleness warning.
- **No snapshot** (`last_green_sha` absent / `snapshot === null`): the **panel is omitted entirely**
  (AC-14-001.3) — no empty shell.
- **Loading:** Server Component reads `status.yaml` in the same navigation — no client loading phase /
  skeleton (Next.js rule: don't add skeletons for server-delivered UI).
- **Error:** if `status.yaml` is unreadable/malformed, the snapshot resolves to `null` → panel omitted
  (fail-safe, never a broken render); the rest of the workspace still renders.
- **Empty chips:** `StatusChips` returns `null` when all counters are zero — no empty wrapper.

## Visual reference
`docs/design/prototype/index.html` → `snapshotPanel(i)` (lines ~781–786) + the rail chips in
`portfolioView()` (lines ~774–776), on the frozen tokens. See `mocks/README.md`.
