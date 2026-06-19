# FDD-15 — Plugin out-of-sync warning

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`, extracted from the owner-approved prototype under DR-054). Cross-cutting tokens/a11y
> are FRD-13's FDD. No new tokens introduced.

- **Visual source:** `docs/design/prototype/index.html` → **`pluginBanner()`** (lines ~573–575),
  with the demo flag `PLUGIN_SYNC` (line 572). Shared style: `.cmd`, the warn tokens, `cmdRow()`.

## Surface — the drift banner (CMP-15-banner)

- **Layout:** a top-of-app **persistent warning banner** (warn tone): `warn-bg` background, hairline
  warn border, a left **alert-triangle** icon (`--warn`), and a body column.
- **Body:** heading (`--warn`, weight 500) — *"Plugin desincronizado"* (varying by reason:
  uncommitted / behind / both); a `text`-tone detail line (e.g. *"instalado 18a9389 · hay cambios del
  plugin sin commitear"*); a smaller **3-step recall** line: *"1) commitea los cambios · 2) corre el
  comando · 3) reinicia la sesión de Claude Code"* (step 1 dropped when there are no uncommitted
  changes).
- **Command row:** a `.cmd` row with `claude plugin update pandacorp@panda-corp` + `CopyButton`
  ("pégalo en la terminal de la fábrica"). **Read-only** — shows the command, never executes
  (REQ-15-005).
- **State signal not by color alone:** the warning triangle icon + heading text carry the meaning, not
  the warn color (FRD-13).

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

## Visual reference
`docs/design/prototype/index.html` → `pluginBanner()` (lines ~573–575), on the frozen tokens. See
`mocks/README.md`.
