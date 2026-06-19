---
id: FDD-18
type: fdd
title: FDD-18 — Dashboard ("Inicio") feature design
parent: frds/frd-18-dashboard/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-18 — Dashboard ("Inicio") feature design

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. This document is **fidelity, not novelty**: it
describes the dashboard exactly as the prototype renders it, mapped to the frozen design system and to
FRD-18's acceptance criteria.

- **Visual source:** `docs/design/prototype/index.html` — render function **`dashboardView()`**
  (with its helpers `digestSection()` / `evCard()`, `qrow()`, `dStat()`, and the gamification foot
  reusing `.rpgpanel.rpggrid` + `.xpbar`).
- **Runnable source, not a duplicated slice:** the prototype is the live mockup; this FDD scopes it to
  the dashboard surface. The build's visual-fidelity gate captures the baseline from the `dashboard`
  view of `index.html` (see `mocks/README.md`).

> The design contract (palette, typography, the 3 surface elevations, the app-wide RPG embossed skin,
> the pixel/Space-Grotesk type pairing) is the **global PDD** — it is NOT redefined here. This FDD
> only assembles the dashboard's sections on top of it. Every value named below resolves to a token,
> never a hardcoded literal.

## 1. Layout (top → bottom)

The dashboard is the default view, rendered inside the `#pcapp` max-width-1240 column under the topbar
(`topbar()`, the `.rpgpanel.rpggrid` operator strip — owned by FRD-09/FRD-13, not this FDD). Sections
are separated by the **`.secthead`** rule (display-font label + trailing 1px line + optional right
count). In order:

1. **Health banners** (conditional) — onboarding gate (`onboardingGate()`, FRD-01), plugin drift
   (FRD-15), orphan projects (FRD-16). Rendered as a warn-bordered `.panel` (`Banner`). Not authored
   here; the dashboard only reserves the top slot.
2. **Desde tu última visita** — `digestSection()`. `.secthead` (`ti-history`) carrying either a
   `var(--accent-bg)` "N nuevas" chip + a **marcar visto** button, or a `var(--ok-bg)` "al día" chip.
   Body is a wrap row of **event cards** (`evCard()`): a `.secondary` rounded tile, status-colored
   leading icon, title + source + relative time; **new** events get a `var(--accent)` border, the
   24h-fallback events are dimmed (`opacity .5`).
3. **Tu turno** — `.secthead` (`ti-flag-3`) with a `var(--danger-bg)` "N esperan por ti" chip or an
   "al día" `var(--ok-bg)` chip. Body is the human-gate **queue** of `qrow()` cards (see §3) or a
   centered calm empty-state `.panel`.
4. **Pulso de la fábrica** — `.secthead` (`ti-activity-heartbeat`) + a 4-up auto-fit grid of
   **stat tiles** (`dStat()`), then a centered one-line conversion metric (idea → shipped).
5. **Construcción y cartera** — `.secthead` (`ti-layout-grid`) + an auto-fit grid (`minmax(290px,1fr)`)
   of **project cards** (one `.panel` per active/shipped project; see §3), or a first-action empty card.
6. **Tu progreso** — `.secthead` (`ti-trophy`) + the honest gamification **foot**: a
   `.rpgpanel.rpggrid` strip with a recent-achievement medal, the next milestone line, and the
   operator-level **XP bar** (`.xpbar`). Derived from FRD-09; this FDD only places it.

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Section dividers | `SectionHeader` (`.secthead`) | display label + trailing rule + optional right count |
| Health banners (gate / drift / orphan) | `Banner` | warn/info variant, copyable command; owned by FRD-01/15/16 |
| "N nuevas" / "al día" / count pills | `Chip` | accent-bg / ok-bg / danger-bg / secondary variants |
| Event item (digest) | `EventCard` | `.secondary` tile, status icon, title+source+`ago()`; `isNew` border + `dim` variants |
| "marcar visto" + "simular/reiniciar" | `Button` / text link (`.lnk`) | mark-seen is real; simular/reiniciar are **DEMO-only** (see §5) |
| Human-gate queue item | `QueueRow` (`qrow`) | 34px icon badge + title/sub + inline `CommandChip` |
| Pulse stat tile | `StatTile` (`dStat`) | label + big pixel numeral (`.px`) + sub; optional accent color |
| Project card (build & portfolio) | `ProjectCard` | `.panel`, status/live/stalled/bugs chips, progress bar, next-command, inline blocker |
| Copyable `/pandacorp:*` command | `CommandChip` (`.cmd`) | mono command + copy button (`Toast` on copy) |
| Gamification foot | `RpgPanel` (`.rpgpanel.rpggrid`) + `XpBar` (`.xpbar`) | medal + next milestone + level/XP bar |

All map to shared primitives in `docs/design/components.md`; none are dashboard-bespoke beyond the
section composition.

## 3. Section detail

### Desde tu última visita
`evCard()`: `.secondary` background, `radius md`, `.5px` border that becomes `var(--accent)` when the
event is newer than the persisted seen-marker; status-colored leading icon (17px); two-line text with
`ago()` relative time. The "seen" marker is client-local (`localStorage` in the prototype), persisted
across refresh/close. Header right side: the **marcar visto** button (`Button`, small) when there are
new events; the "al día" `Chip` otherwise.

### Tu turno (queue)
`qrow()`: a `.card` row — a 34px rounded icon badge tinted per priority (danger-bg / warn-bg /
accent-bg / secondary), a two-line title+subtitle, and a trailing inline **`.cmd` CommandChip** with
the exact `/pandacorp:*` command + copy. The whole row is clickable (`data-act` → navigate to project
/ board). Priority order: pending decisions → review-launch → memory backlog → unprioritized ideas.

### Pulso de la fábrica
`dStat()`: a `.secondary` tile with an 11px label + icon, a **30px pixel numeral** (`.px`, tabular),
and an 11px sub. The "En construcción" tile colors its numeral `var(--ok)` when builds are live. Below
the grid, a centered line surfaces the **idea → shipped conversion %** — the one metric that matters.

### Construcción y cartera
Project card = a clickable `.panel` (`padding 14px 16px`): title + a flex-wrap chip row
(status+version chip; `en vivo`/`sin señal` chip with play/alert icon; `estancado · N días` or
`Nd en fase` chip; `N bugs` chip), an accent **progress bar** (work orders done/total) for non-shipped
projects, a meta line (`done/tot work orders` or `estable · en operación`) with the next-command
`<code>`, and an inline **danger blocker** line when a work order has failed.

### Tu progreso (foot)
`.rpgpanel.rpggrid` strip: a 42px warn-bg medal (recent achievement icon), a two-line
achievement + next-milestone block, and the operator **`.xpbar`** with the `NV N · título` /
`xp / next XP` caption. Honest gamification — derived from real outcomes (FRD-09), no streaks.

## 4. States

- **Empty (fresh factory)** — digest shows the *al día* state; "Tu turno" shows the calm empty `.panel`
  ("Nada espera por ti…"); "Construcción y cartera" shows a first-action `.card` with the
  `/pandacorp:spec <idea>` command. Nothing is faked (`AC` quiet-when-healthy).
- **Loading** — the Next.js build streams each section; sections that read the event stream / state
  render under their own boundary. No skeleton is shown for content the server already delivers
  (per `nextjs.md`); a section awaiting the event stream may show its calm/al-día state as the fallback.
- **Error** — a section that fails to read its source renders an inline `Banner` (info/warn) with the
  source it could not read, never a blank panel; the rest of the dashboard still renders (segment
  `error.tsx`).
- **Healthy / quiet** — exception-first: "Tu turno" and the digest read *al día*; no manufactured
  urgency, no vanity counters.

## 5. Demo-only controls (DR-061)

The prototype's digest exposes a demo footer: **"simular novedad"** and **"reiniciar novedades"**
(`data-act="seen-sim"` / `seen-reset`) plus the "Evento simulado (demo)" entries. These exist purely
to **preview the new-events state** in a static mockup; the real app reads the live factory event
stream (`~/.claude/dashboard-events.ndjson` + state diffs, FRD-01) and has no event simulator. In the
build, this footer MUST be wrapped in a **dashed-border `DEMO` block** with a one-line note
("real app reads the live event stream; there is no simulate/reset"), or omitted. The **marcar visto**
action is **real** (it advances the client-local seen-marker) and stays in the real UI.

No other dashboard control is demo-only: the copy buttons, queue navigation, and project-card links are
all real read-only affordances.
