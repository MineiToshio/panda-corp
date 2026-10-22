# Context pack · FRD-14 · Probable snapshot and feedback channels

> S2.1 output, 2026-10-22 (FRD-14 had no pack at S0.3; the owner approved drawing its panel at M1, item 1). The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S2.2 amendments, S2.3-14 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-14-snapshot-and-feedback/frd.md` (id FRD-14, status ACTIVE, `implementation_status: VERIFIED`, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 3 under `states["frd-14-snapshot-and-feedback"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 10 AC lines: 5 drawn · 0 partially drawn · 0 not drawn · 2 behaviour/data only · 3 out for v2 (B-10, B-35) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). A `js` action `applyScenario('<name>')` switches the fixture to that scenario (see `SCENARIOS` in `prototype.js`). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn; **not drawn** = no captured state draws it; **behaviour only** = data, derivation, write or live behaviour with no picture to compare; **out for v2** = removed by the owner at M1 (reconciliation Group B).

## 1. Acceptance criteria (verbatim) and what the prototype draws

### AC-14-001.1 · drawn · `project-snapshot`

> - **AC-14-001.1** — FOR each project being built, Mission Control SHALL show a **snapshot panel** presenting the **last build commit that passed all gates** ("último commit en verde · seguro para probar"), the FRD it closed, and the **`git worktree add /Users/Shared/review-worktrees/<project> <sha>` command** ready to copy (the review worktree lives under the canonical review-worktrees root, outside `Proyectos/` — DR-090). It reads `last_green_sha` and `safe_to_test` from `.pandacorp/status.yaml`.

**Prototype:** Card "Último commit en verde" (green check icon tile) in the project Resumen, directly below La Fragua, only while the project's `running` flag is true and `last_green_sha` exists. Header pill "Seguro para probar" (green, check icon) when `safe_to_test: true`; "Aún no es seguro" (amber, alert icon) when false. Body: intro line, the short SHA as a mono chip plus "verificó WO-07-002 de FRD-07" (the latest verified work order of the build timeline and its FRD), the command box `git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2` with "Para probarlo, córrelo en la carpeta de Funko Tracker:". Fixture: funko-tracker `status.yaml` (`running: true`, `last_green_sha: "a41c09e2"`, `safe_to_test: true`, heartbeat 8 min old).

### AC-14-001.2 · drawn · `project-snapshot`

> - **AC-14-001.2** — The copy SHALL state that the green commit is **safe to test in a separate git worktree while the build continues** — it SHALL NOT frame it as a local-vs-remote git matter, nor use the "punto verde" term.

**Prototype:** "El último commit del build que pasó todos los gates. Puedes probarlo en un worktree aparte mientras el build sigue; no se toca nada de lo que está construyendo."

### AC-14-001.3 · drawn · `project-snapshot`

> - **AC-14-001.3** — The panel SHALL distinguish **"building now"** (the work order in progress — "this is not green yet, don't test it") from the **last green commit** — they are two different things.

**Prototype:** A separate blue line with the loader icon: "Construyendo ahora: el build sigue avanzando. Eso todavía no está en verde: no lo pruebes." (with an in-progress work order it reads "Construyendo ahora: WO-NN-MMM · <title>. …").

### AC-14-002.1 · drawn · `project-snapshot-stale`

> - **AC-14-002.1** — IF the last green commit (`last_green_sha`) is **far behind the build's current HEAD** (many commits/hours), THEN Mission Control SHALL warn that the green commit has fallen behind the build, and that testing it no longer reflects the build's current state.

**Prototype:** Amber notice inside the panel: "Este commit quedó atrás del build" / "El build lleva 14 commits y 26 horas más. Lo que pruebes ahí ya no refleja lo que el build construyó desde entonces."; the header pill becomes "Quedó atrás del build" (amber, alert icon). Scenario `snapshot-stale` (the commits/hours come from the git probe in the app).

### AC-14-002.2 · drawn · `build-no-signal`

> - **AC-14-002.2** — WHILE `status.yaml` claims `running: true`, THE panel SHALL show "building now" ONLY when the claim is LIVE — `running` crossed with the supervisor heartbeat's recency (DR-066: liveness = running AND fresh, never the flag alone). WHEN the heartbeat is stale (≥ the 10-min TTL) or absent, THE panel SHALL show a "sin señal" note instead — the flag is never dressed up as a live build.

**Prototype:** Scenario `build-no-signal` (heartbeat 25 min old): the building-now line is replaced by a coral line with the alert icon: "El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min. Revisa si sigue vivo antes de fiarte de ese estado." The same capture shows the hero chip "Sin señal · último evento hace 25 min" and the La Fragua health chip "Sin señal" (FRD-06's `build-no-signal`).

### AC-14-003.1 · out for v2 (B-10)

> - **AC-14-003.1** — EACH project in the portfolio rail SHALL show **chips** with the number of **pending decisions** (amber) and **bugs in the inbox** (red), derived live from the project's inbox (`readStatusWithLiveInboxCounts` — DR-092/DR-115), never a status.yaml counter.

**Prototype:** The portfolio rail is gone (sidebar project list + Portafolio cards); decisions are a column in Portafolio → Lista (FRD-03's `portfolio-list`).

### AC-14-003.2 · out for v2 (B-35)

> - **AC-14-003.2** — IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change).

**Prototype:** Not drawn; out for v2 at M1.

### AC-14-003.3 · behaviour only (B-38)

> - **AC-14-003.3** — Mission Control's documentation SHALL explain the **three feedback channels** to an in-progress build: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (all via files, picked up at the next safe point).

**Prototype:** Content of the captured Documentación pages (`data/manual-live.js`), FRD-08's states; no picture of its own.

### AC-14-004.1 · out for v2 (B-10)

> - **AC-14-004.1** — EACH portfolio-rail row SHALL show an amber **pending-decisions** chip when `> 0` and a red **pending-bugs** chip when `> 0`, both derived live from the project's inbox (`readStatusWithLiveInboxCounts`, DR-092/DR-115), never a status.yaml counter.

**Prototype:** Same as AC-14-003.1.

### AC-14-005.1 · behaviour only (B-35 indicator out, B-38 docs)

> - **AC-14-005.1** — IF a project has `rethink_pending: true`, the rail SHALL indicate it; AND the documentation SHALL explain the three feedback channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`).

**Prototype:** Indicator out for v2; the channels are in the captured Documentación.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `project-snapshot` | `#portfolio?project=funko-tracker` | wait for `#snapshot-panel` | full page | `AC-14-001.1` `AC-14-001.2` `AC-14-001.3` |
| `project-snapshot-stale` | `#portfolio?project=funko-tracker` | js `applyScenario('snapshot-stale')`, wait for `#snapshot-panel .notice` | full page | `AC-14-002.1` |
| `build-no-signal` | `#portfolio?project=funko-tracker` | js `applyScenario('build-no-signal')`, wait for `.fragua` | full page | `AC-14-002.2` |

States cited above that belong to another FRD folder (captured there, reused here): FRD-03's `portfolio-list`; FRD-08's documentation pages. `project-snapshot` is also registered under FRD-04 (REQ-04-005) and `build-no-signal` under FRD-03, FRD-06, FRD-12 and FRD-18 with their own routes.

**Not drawn (0)**: none. **Out for v2 (3)**: `AC-14-003.1`, `AC-14-003.2`, `AC-14-004.1`.

States S2.1 ADDED for this FRD (they render with the fixture; verified): `project-snapshot`, `project-snapshot-stale`, `build-no-signal`. Component `SnapshotPanel` (root `#snapshot-panel`, states `default` and `stale`).

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). Fixture values (SHA, ids, project name) are kept where they mix with interface text.

### `project-snapshot`

- [h2] Último commit en verde
- [chip] Seguro para probar
- [p] El último commit del build que pasó todos los gates. Puedes probarlo en un worktree aparte mientras el build sigue; no se toca nada de lo que está construyendo.
- [code] a41c09e2
- [span] verificó WO-07-002 de FRD-07
- [p] Construyendo ahora: el build sigue avanzando. Eso todavía no está en verde: no lo pruebes.
- [span] Para probarlo, córrelo en la carpeta de Funko Tracker:
- [code] git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2
- [@aria-label] Copiar git worktree add /Users/Shared/review-worktrees/funko-tracker a41c09e2

### `project-snapshot-stale`

- the strings of `project-snapshot`, with the header pill [chip] Quedó atrás del build
- [b] Este commit quedó atrás del build
- [p] El build lleva 14 commits y 26 horas más. Lo que pruebes ahí ya no refleja lo que el build construyó desde entonces.

### `build-no-signal`

- the strings of `project-snapshot` without the "Construyendo ahora" line
- [p] El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min. Revisa si sigue vivo antes de fiarte de ese estado.
- [chip] Sin señal · último evento hace 25 min (hero)
- [chip] Sin señal (La Fragua health)
- [h2] … El build dice estar corriendo, pero no hay señal del supervisor desde hace 25 min. … (La Fragua verdict)

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- AC-14-001.1 quotes "último commit en verde · seguro para probar"; the prototype splits it into the card title "Último commit en verde" and the pill "Seguro para probar".
- The current app (`snapshot-panel.tsx`) says "Última versión verificada · segura para probar" and "verificada" / "aún no seguro"; the prototype wins (FRD wording).
- FRD-04 REQ-04-005 (S2.2 draft) quotes the command `git worktree add ../<slug>-review <sha>`; FRD-14 AC-14-001.1 and DR-090 give `/Users/Shared/review-worktrees/<project> <sha>`, which the prototype draws. One of the two FRDs must change (report to S2.2).

## 5. FRD vs prototype conflicts and Group B seeds

- None open: the panel is the owner-approved Group B item B-52 (M1 2026-10-22). The rail chips and the `rethink_pending` indicator are out for v2 (B-10, B-35).
- The FRD's "Relationship" line still says the panel complements Party; Party is now La Fragua inside the Resumen (C-04/C-08).

## 6. Owner decisions that touch this FRD

**FRD-specific:**

- M1 2026-10-22, item 1: draw the "último commit en verde" panel with its command in the project Resumen, below La Fragua, shown only while a build runs (FRD-14, REQ-04-005).
- DR-066 (liveness): the running flag alone is never shown as live; a stale heartbeat reads "sin señal".
- DR-090: review worktrees live under `/Users/Shared/review-worktrees/`.

**Global (apply to every FRD):** the same list as every other pack (scope decisions 1–4 of 2026-10-21, Spanish interface with English artifact names, iteration-28 shared component rules). See `_global.md`.
