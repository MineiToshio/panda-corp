# FDD-11 — Per-project build modes — feature design

> **Visual source:** `docs/design/prototype/index.html` — the **Modo de construcción** panel
> (`buildModePanel()`), shown inside a project's **Comandos** tab (`projComandos()`).
> Frozen tokens: `docs/design/design-tokens.json` (Atelier — pixel-RPG / guild). No hardcoded visuals.

## Screen shape

A `.panel` block at the top of a project's **Comandos** sub-tab, above the "Comandos a la mano" box:

1. **Heading** — "Modo de construcción" (`text.t2`, 13px display, with an adjustments icon) + a
   one-line subtitle (`text.t3`, 12px): "Con cuánta potencia construir ESTE proyecto. Por defecto
   Equilibrado (Max 5x). Cambia el modo y copia el comando que toca."
2. **Mode selector** — a row of four `.stab` chips: **Pro / económico · Equilibrado · Potente ·
   Profundo**. The selected mode is `.stab.on` (`secondary` fill). Selecting a mode updates the
   per-project state and re-renders the description + command below.
3. **Description** — the chosen mode's one-liner (agents, models, recommended plan) in `text.t2`.
4. **Command row** — a `.cmd` chip (`rpgSkin.cmd`: inset on `canvas`, `bd2` hairline, `mono` font)
   showing the exact `/pandacorp:implement [mode]` string with a copy button (`cmdRow`).

Below this panel, `commandsBox()` renders the general project commands (continue/release/iterate).

## The four modes (data: `BUILDMODES`, index.html ~L795)

| Mode | Chip label | Command |
|---|---|---|
| `pro` | Pro / económico | `/pandacorp:implement pro` |
| `balanced` (default) | Equilibrado | `/pandacorp:implement` |
| `powerful` | Potente | `/pandacorp:implement powerful` |
| `deep` | Profundo | `/pandacorp:implement deep` |

The chosen mode is **remembered per project** (`ST.modes[slug]`; in the real app this is read-only
persisted MC state per the FRD).

## Components mapped to frozen primitives

| Element | Render fn | Token / primitive |
|---|---|---|
| Mode panel container | `buildModePanel` | `.panel` (base panel → `rpgSkin.overrides.panel` embossed) |
| Mode chips | inside `buildModePanel` | `.stab` / `.stab.on` |
| Command chip + copy | `cmdRow` | `rpgSkin.cmd` (`canvas` inset, `bd2`, `mono`) + copy button |
| Comandos tab wrapper | `projComandos` | base `.panel` |

## States (empty / loading / error)

- **Default / no selection yet:** the panel always has a current mode — it defaults to **Equilibrado**
  (`balanced`) when none is stored, so there is no true empty state; the description + command render
  for `balanced`.
- **Loading:** server-delivered; no skeleton. The selected chip + command render immediately.
- **Error:** if the per-project mode read fails, fall back to `balanced` (the documented default) and
  render its command — never a blank panel.
- **Copy feedback:** the copy button fires the shared `toast()` ("copiado") — the small, sober
  confirmation, not an expressive celebration.

## Real vs demo — DR-061 disposition

Per the task brief and DR-061: this surface is **REAL, not a demo-preview**. It is a genuine
**read/copy-command** surface — MC surfaces the chosen mode (read-only persisted state) and the exact
command to copy. It does **not** trigger the build (MC is read-only; the build is launched by running
`/pandacorp:implement [mode]` in the project folder). Therefore:

- The mode chips and command row are **not** wrapped in a DEMO block — they reflect/copy real state.
- The implementation MUST NOT imply the dashboard *launches* the build by selecting a mode. The copy
  affordance + the subtitle ("copia el comando que toca", `cmdRow` "pégalo en la carpeta del
  proyecto") make explicit that the human runs the command. No play/run button is added.
- The chosen mode is shown as **read-only data** (the `.stab.on` selected chip + the command), which is
  exactly the "real value surfaced in a real UI surface" DR-061 requires.

## Accessibility notes
- Selected mode conveyed by the `.stab.on` fill **and** by being the mode whose description/command is
  shown — not color alone. Consider `aria-pressed`/radio semantics on implementation.
- The command string is real text in a `mono` font with `tabular-nums`; the copy button has an
  accessible label.
- Chips sized to ≥44px hit area on implementation.

## index.html render-fn pointer
`buildModePanel` (~L801), `projComandos` (~L807), `BUILDMODES` (~L795), `cmdRow` (~L570),
`commandsBox` (~L729). CSS: `.stab`/`.stab.on` (L64-65), `.cmd`/`.cmd .t` (L71-72, override L158),
`.panel` (rpgSkin.overrides.panel).
