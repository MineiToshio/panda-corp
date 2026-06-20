# FDD-14 — Probable snapshot and feedback channels

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`, extracted from the owner-approved prototype under DR-054). This FDD describes only the
> FRD-14 surfaces; the cross-cutting token/a11y layer is FRD-13's FDD. No new tokens are introduced.

- **Visual source:** `docs/design/prototype/index.html`.
  - Snapshot panel render fn: **`snapshotPanel(i)`** (~L867).
  - Staleness panel render fn: **`bStalenessPanel(i)`** (~L876).
  - Per-project rail chips (decisions/bugs/rethink): **`portfolioView()`** `dchip` / `bchip` / rethink
    (~L854–858).
  - "Building now" + progress: `projResumen(i)` / `progressBar(i)` (~L906/~L924).
  - Shared style: `.panel`, `.chip`, `.cmd` and the app-wide `rpgSkin` panel override.

> **Re-anchor note (2026-06-19):** the snapshot copy is now the **clear** wording — **"Último commit en
> verde · seguro para probar"** (the last build commit that passed ALL gates), replacing the old/confusing
> "punto verde / punto probable". The staleness case is its own panel (`bStalenessPanel`).

## Surfaces (this FRD)

### A. Snapshot panel (CMP-14-snapshot-panel) — `snapshotPanel(i)` (~L867)
- **Layout:** a `.panel` (frozen `rpgSkin` embossed panel) with a left status icon (`ti-circle-check`,
  `--ok`) + body. Body line 1: **"Último commit en verde · seguro para probar"** + a green chip with the
  FRD (`ok-bg`/`ok`). Line 2 (muted, `text3`): `commit <sha> — pasó todos los gates. Pruébalo en un
  worktree aparte sin parar el build.` SHA rendered with `tabular-nums`.
- **"Building now" block** (when `running`): a visually-distinct line with a hammer icon (`--accent`):
  *"El build sigue avanzando: `<progreso>` · eso aún no está en verde, no lo pruebes"* — distinct from
  the last-green commit (REQ-14-002). The two are never conflated.
- **Command row:** the `git worktree add …` command in a `.cmd` row + `CopyButton` ("crea un worktree de
  prueba en esa carpeta"). Read-only — Mission Control never runs it (Non-goal).

### A2. Staleness panel (CMP-14-staleness) — `bStalenessPanel(i)` (~L876)
- **Layout:** a separate `.panel` with `border-color:var(--warn)`, a left `ti-clock-exclamation`
  (`--warn`) icon, the heading **"El último commit en verde quedó atrás del build"** and a `text2`
  detail: "El último commit en verde (`<ultimoVerde>`) quedó `<adelanto>`. Lo que pruebes ahí ya no
  refleja lo que el build lleva construido." (REQ-14-003) — warn meaning carried by **icon + text**, not
  color alone. Rendered only when `i.staleness` is present.

### B. Per-project status chips (CMP-14-status-chips)
- On each portfolio-rail row: an **amber** chip with `pendingDecisions` and a **red** chip with
  `pendingBugs` (from `status.yaml`), plus a `rethink pendiente` indicator when `rethinkPending`. Each
  chip carries its count (`tabular-nums`) + a Spanish label/title — never color alone.

## Components mapped to shared primitives
| Surface | Primitive | Notes |
|---|---|---|
| Snapshot panel container | `Panel` (`.panel` / `rpgSkin` embossed) | frozen app-wide skin — no bespoke panel |
| Green chip + staleness | `StateBadge` idiom (icon+shape+label) | reinforce ok/warn by icon, not color alone |
| Staleness panel | `Panel` (warn-border) / shared `Banner` idiom | icon + text warning, not color alone |
| Command row + copy | `CmdRow` + `CopyButton` (`src/components/core/CopyButton/CopyButton.tsx`) | read-only command surface |
| Rail decisions/bugs/rethink | `StatusChips` / `CountBadge` (`src/app/portfolio/_components/status-chips/status-chips.tsx`) | counts with `tabular-nums` |

## Cohesion (DR-062)
Both panels are the one shared **`Panel`** (the staleness one a warn-bordered variant, never a second
panel type); the green/staleness signals use the shared `StateBadge`/`Chip` idioms and the command row is
the shared `CmdRow`. These surfaces live inside the project workspace (FDD-04) under its light
`compactProjectHeader` — they never carry their own heavy title. One panel, one chip, one command-row.

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
`docs/design/prototype/index.html` → `snapshotPanel(i)` (~L867), `bStalenessPanel(i)` (~L876) + the rail
chips in `portfolioView()` (~L854–858), on the frozen tokens. See `mocks/README.md`.
