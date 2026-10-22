---
id: FDD-14
type: fdd
slug: snapshot-and-feedback
title: Último commit en verde (snapshot panel)
status: ACTIVE
parent: FRD-14
last_updated: '2026-10-22'
prototype_blessed_at: ''
---

# FDD — FRD-14 Último commit en verde (snapshot panel)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Feature design on the frozen Órbita contract (`docs/design/design-tokens.json` + root `DESIGN.md`). It uses the global tokens and components; it defines none. Frozen FROM the approved prototype `docs/design/prototype/index.html` (Órbita, round 5), shard `mocks/snapshot-and-feedback.html`.

FRD-14 draws one surface: the **snapshot panel**, a card in the project **Resumen** directly below La Fragua (FRD-06), shown only while a build runs and a green commit exists. The three captured states render the whole Resumen of Funko Tracker, because the panel mounts inside it; the hero, La Fragua, "Avance por FRD", "Decisiones", "Tu turno" and "Últimos avances" blocks around the panel belong to FRD-04 and FRD-06 and are specified there. The rail chips and the `rethink_pending` indicator are out of v2 (owner decision 2026-10-21, AC-14-003.1, AC-14-003.2, AC-14-004.1) and have nothing to build.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Snapshot panel in the project Resumen | Say which build commit is safe to test in a separate worktree while the build continues, tell "building now" apart from it, and give the command to copy. Route `#portfolio?project=funko-tracker`, panel root `#snapshot-panel`. | `project-snapshot` | AC-14-001.1, AC-14-001.2, AC-14-001.3 |

What the panel draws, top to bottom, in `project-snapshot`:

- **Card header** (the shared `CardHeader`): green check icon tile, the title "Último commit en verde" and, at the right, a status pill. The pill reads "Seguro para probar" (green, check icon): state by icon and text, never colour alone.
- **Intro line:** "El último commit del build que pasó todos los gates. Puedes probarlo en un worktree aparte mientras el build sigue; no se toca nada de lo que está construyendo." It frames the commit as safe to test in a separate worktree while the build continues, and never as a local-versus-remote matter (AC-14-001.2).
- **Commit row:** the short SHA as a mono chip (`a41c09e2`), then "verificó WO-07-002 de FRD-07" (the last verified work order and the FRD it belongs to).
- **Building-now line** (blue, loader icon): a bold "Construyendo ahora:" followed by "el build sigue avanzando. Eso todavía no está en verde: no lo pruebes." It is a separate line from the commit row, so the two facts are never conflated (AC-14-001.3).
- **Command block:** the lead-in "Para probarlo, córrelo en la carpeta de Funko Tracker:" and the `CommandBox` with `git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2` and its copy button (accessible name "Copiar git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2"). Mission Control never runs it.

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Green commit, build live (default) | The panel exactly as described above: green pill "Seguro para probar", the commit row, the blue building-now line and the command. The build is live (fresh supervisor heartbeat), so the hero chip reads "Construyendo". | `project-snapshot` | AC-14-001.1, AC-14-001.2, AC-14-001.3 |
| Green commit far behind the build | The header pill becomes "Quedó atrás del build" (amber, alert icon). An amber notice (`role="status"`, alert icon) is inserted between the building-now line and the command: bold "Este commit quedó atrás del build" and "El build lleva 14 commits y 26 horas más. Lo que pruebes ahí ya no refleja lo que el build construyó desde entonces." The commit row, the building-now line and the command stay. The commits and hours come from comparing `last_green_sha` with the build's HEAD. | `project-snapshot-stale` | AC-14-002.1 |
| Build claims to run but has no signal | The building-now line is replaced by a coral line with the alert icon: "El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min. Revisa si sigue vivo antes de fiarte de ese estado." The pill, the commit row and the command stay. The same capture shows the hero chip "Sin señal · último evento hace 25 min" in place of "Construyendo" and the La Fragua health chip "Sin señal" (those two are drawn by FRD-04 and FRD-06 on the same screen). The `running` flag is never dressed up as a live build (DR-066: live means running and a fresh heartbeat, 10 min TTL). | `build-no-signal` | AC-14-002.2 |

Data cases the oracle does not capture reuse what is drawn, they do not get a new design:

- No build running, or no `last_green_sha`: the panel is not rendered (an absence, AC-14-001.1).
- `safe_to_test` false: the header pill uses the amber alert variant that `project-snapshot-stale` draws, with its own verdict text.
- A work order in progress: the building-now line names it in the same slot.

## Components used

From `docs/design/components.md`: `SnapshotPanel` (new, root `#snapshot-panel`, states default and stale; the no-signal variant swaps its building-now line), `Card` and `CardHeader` (icon tile, display title, pill), `Chip` (the SHA chip and the status pill), `Notice` (the amber behind-the-build notice and the coral no-signal line), `CommandBox` (the worktree command with copy). The frame around it is `AppShell` (FRD-19) and the Resumen is FRD-04's. No new component beyond `SnapshotPanel`, which the inventory already lists as planned for this state.

## Interaction & flow

1. The owner opens Portafolio, picks a project with a running build, and lands on its Resumen. The panel sits below La Fragua.
2. They read the verdict pill, check whether "Construyendo ahora" or the no-signal line is shown, and, if the commit is safe, copy the command with the copy button and run it in the Funko Tracker folder.
3. The panel is read-only: it reads `last_green_sha` and `safe_to_test` from `.pandacorp/status.yaml` and the heartbeat, and never runs `git worktree` or starts a server.
4. The staleness notice and the no-signal line appear on their own when the data says so; nothing is dismissible or nagging.

Behaviour with no picture of its own (non-visual rules):

- The documentation explains the three feedback channels to a running build, `/pandacorp:bug`, `/pandacorp:iterate` and `/pandacorp:decide`, all via files picked up at the next safe point (AC-14-003.3, AC-14-005.1). That content lives in the Documentación pages (FRD-08); this FRD adds no screen for it.

## Responsive & accessibility

- Captured at 375, 768 and 1280, light and dark. The panel is one column at every width; the `CommandBox` keeps its 36 px copy icon button (the shared component's size) and wraps only at ":" and spaces.
- The pill and the lines carry meaning by icon and text, not colour alone (check, alert, loader). The behind-the-build notice has `role="status"`, so it is announced when it appears.
- The copy button has the accessible name "Copiar <command>". The panel heading is an `h2` in the Resumen's heading order.

## Copy

All strings above are the prototype's, in Spanish. Command, path and file names stay literal. The panel never uses the old "punto verde" term. Keyed strings are in `docs/design/microcopy.es.json`.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar). Component catalogue `docs/design/prototype/components.html`; measured styles `docs/design/prototype/reference/computed-styles.json`; icons `docs/design/prototype/icons/`; copy `docs/design/microcopy.es.json`; whole-app prototype `docs/design/prototype/index.html`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-14-snapshot-and-feedback/mocks/snapshot-and-feedback.html` (sections `project-snapshot`, `project-snapshot-stale`, `build-no-signal`); screenshots in `mocks/screenshots/` named `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=funko-tracker`; `project-snapshot-stale` after `applyScenario('snapshot-stale')`, `build-no-signal` after `applyScenario('build-no-signal')`.
- **Oracle entries (`fidelity.config.json` states of `frd-14-snapshot-and-feedback`):** `project-snapshot`, `project-snapshot-stale`, `build-no-signal`.
- **Reference files:** `docs/design/freeze/packs/frd-14.md`, `docs/design/freeze/reconciliation.md`, `docs/design/freeze/m1-decisions.md`, root `DESIGN.md`.
- **components.md rows:** `SnapshotPanel`, `Card`/`CardHeader`, `Chip` family, `EmptyState`/`Notice`, `CommandBox`, `AppShell`.
