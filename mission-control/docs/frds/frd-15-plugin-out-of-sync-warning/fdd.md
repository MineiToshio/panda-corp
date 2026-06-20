# FDD-15 — Plugin out-of-sync warning

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`, extracted from the owner-approved prototype under DR-054). Cross-cutting tokens/a11y
> are FRD-13's FDD. No new tokens introduced.

- **Visual source:** `docs/design/prototype/index.html` → **`pluginBanner()`** (~L612), the three drift
  reasons `DRIFT_REASONS` (~L607), with the demo flag `PLUGIN_SYNC` (~L602). Shared style: `.cmd`, the
  warn tokens, `cmdRow()`, `bDemo()`.

> **Re-anchor note (2026-06-19):** the banner now ships **3 drift-reason variants** —
> **Sin commitear · Instalado atrasado (behind) · Ambos** (`DRIFT_REASONS`, ~L607), each with its own
> heading, detail and recall steps. In the real app the reason is decided by **git state (uncommitted
> changes) + the installed SHA vs the last plugin commit**; in the prototype the reason cycles via a
> DR-061 `SOLO DEMO` toggler.

## Surface — the drift banner (CMP-15-banner)

- **Layout:** a top-of-app **persistent warning banner** (warn tone): `warn-bg` background, hairline
  warn border, a left **alert-triangle** icon (`--warn`), and a body column. Placed under the dashboard
  page title (with the orphans banner), per `dashboardView()` (~L745).
- **Body — varies by the 3 reasons (`DRIFT_REASONS`):** heading (`--warn`, weight 500) *"Plugin
  desincronizado · {reason label}"*:
  - **Sin commitear** — "instalado {sha} · hay cambios del plugin sin commitear"; recall: *"1) commitea
    los cambios · 2) corre el comando · 3) reinicia la sesión de Claude Code"*.
  - **Instalado atrasado (behind)** — "instalado {sha} · el último commit del plugin es {sha2} (N
    commits por delante)"; recall: *"1) corre el comando para reinstalar la última versión · 2) reinicia
    la sesión"* (commit step dropped — nothing to commit).
  - **Ambos** — combined detail; 3-step recall.
- **Command row:** a `.cmd` row with `claude plugin update pandacorp@panda-corp` + `CopyButton`
  ("pégalo en la terminal de la fábrica"). **Read-only** — shows the command, never executes
  (REQ-15-005).
- **State signal not by color alone:** the warning triangle icon + heading text (incl. the reason label)
  carry the meaning, not the warn color (FRD-13).

## Components mapped to shared primitives
| Surface | Primitive | Notes |
|---|---|---|
| Banner shell | **shared `Banner` primitive** (warn variant) | **MUST be the single shared Banner — see below** |
| Alert icon + heading | icon+text state signal (FRD-13 / `StateBadge` idiom) | not color alone |
| Command row + copy | `CopyButton` (`src/components/core/CopyButton/CopyButton.tsx`) | read-only |

### Shared `Banner` primitive (DR-057 — reuse-before-create)
This banner and the **FRD-16 orphans banner** are the **same banner shape** (warn-tone strip, left
warning-triangle icon, body, optional command row). They MUST be built on **one shared `Banner`
primitive** with variants, not two near-duplicate components. Today they are implemented as two
separate components (`src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx` and
`src/app/_components/orphans-banner/orphans-banner.tsx`) that each re-declare the identical
`BANNER_STYLE` / `ICON_STYLE` / `CMD_ROW_STYLE` / `RECALL_STYLE` block — **this is the DR-057
duplicate-banner defect being corrected.** The plugin-sync banner is the `kind="drift"` consumer of
that one `Banner`.

## States
- **In sync** (`drift === false` / not yet fetched): renders **nothing** (AC-15-004.2/.4) — no empty
  shell; self-clears on the next poll when drift resolves.
- **Drift — uncommitted:** heading "hay cambios sin commitear", 3-step recall starting with commit.
- **Drift — behind (installed SHA ≠ last plugin commit):** heading "El plugin instalado está atrás",
  2-step recall.
- **Drift — both:** combined heading, 3-step recall.
- **Loading:** the client component polls `/api/plugin-sync`; until the first confirmed `drift` it
  renders nothing (no false-alarm flash).
- **Error:** a failed/parse-error poll does **not** update state (no false alarm) — the banner simply
  stays hidden; the rest of the app is unaffected.

## Cohesion (DR-062)
The drift banner is the one shared **`Banner`** (`kind="drift"`) — same strip shape, chip and `CmdRow` as
the orphans banner (FRD-16) and every other app banner; never a second banner type. It sits under the
dashboard's one light `PageTitle` (`pageHead`), not a bespoke header.

## Demo-only controls (DR-061)
The **drift-reason toggler** (Sin commitear / behind / Ambos) is a **preview-only** control: it cycles
the variant in the static prototype. It is wrapped in the prototype's `bDemo` block (~L617) — dashed
border + uppercase **`SOLO DEMO`** tag + note: *"En la app real el motivo lo decide git (cambios sin
commitear) + el SHA instalado vs el último commit del plugin — no se elige a mano."* On implementation
this MUST keep the DR-061 wrapper; the real reason/detail is **real read-only data** derived from git +
the installed SHA, surfaced in the banner body, not behind a toggle.

## Visual reference
`docs/design/prototype/index.html` → `pluginBanner()` (~L612), `DRIFT_REASONS` (~L607), `PLUGIN_SYNC`
(~L602), on the frozen tokens. See `mocks/README.md`.
