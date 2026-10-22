# Context pack · FRD-09 · Gamification (RPG theme)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-09 copy, S2.1 builds, S2.2 amendments, S2.3-09 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-09-gamification/frd.md` (id FRD-09, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 2 under `states["frd-09-gamification"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 19 AC lines: 0 drawn · 4 partially drawn · 2 not drawn · 13 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-09#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-09#U1 · partial · `shell-expanded`, `achievements-summary`

> - The top bar SHALL show the **guild's level and XP** (operator), with a title and a bar to the next level.

**Prototype:** The guild level and XP live in the SIDEBAR guild card (crest with level "22", rank "Portador de Luz III", "175 / 200 XP al nivel 23" and a gold bar; only the crest on the collapsed and tablet rails) and in the Logros hero ("Gremio Pandacorp · nivel 22", "2410 XP · 25 para el nivel 23" with a bar). There is no top bar.

### FRD-09#U2 · partial · `achievements-ranks`, `guild-rank-ladder`

> - The guild rank SHALL climb a **40-rung RPG ladder** (Final Fantasy tone, owner-authored 2026-06-25): **the level is GRANULAR and the rank is a BAND of levels** (the rank is NOT 1:1 with the level — decision 2026-06-25, owner) — Humano (Nv 1–3) → Buscador del Alba I–III → Portador de Luz I–III → Guardián del Juramento I–III → Guardián de Glifos I–III → Guardián del Éter I–III → Portador de Esquirla I–III → Caballero Radiante I–III → Invocador de Reinos I–III → Heraldo del Alba I–III → Señor de Tormentas I–III → Ascendente I–III → Ascendente del Fénix → Señor del Leviatán → Señor Dragón Carmesí → Guardián Celestial → Soberano del Alba → **Portador del Juramento Eterno (Nv ~289+)**. The **level** is derived from XP via a super-linear per-level curve (`xpForLevel`/`levelForXp` — each level costs more than the last, so leveling gets harder as you climb); the **rank** is the level band that contains the current level (`rankForLevel`), and the bands **widen toward the summit** (`rankBandSize`) so the higher ranks take more levels to earn. Each rank carries a **custom pixel-art emblem** (`/ranks/<family>.png` via `RankEmblem`; one emblem per I·II·III family + the 6 standalone tops + Humano = 18 sprites; the Tabler icon remains a fallback), and within a shared family emblem the **sub-grade I·II·III is distinguished by a small roman-numeral badge** (`RankEmblem grade`). The emblem + grade are shown beside the rank name in the GuildBar (header), the GuildHero, and the Rangos tab. The ladder is the single source `RANKS` in `lib/gamification/gamification.ts`, each rank carrying its `minLevel` (band entry) + `grade`.

**Prototype:** Ladder drawn as six eras with sprite emblem + roman grade badge, rank name, flavour line, "Nv a–b", XP threshold and state "Conseguido" / "Estás aquí" (+ "Faltan N XP para <rango>" and a bar) / locked "Nv N"; eras more than one step ahead are collapsed with their level range. The emblem is NOT shown beside the rank name in the sidebar card (crest number only).

### FRD-09#U3 · behaviour only · `achievements-summary`

> - The vocabulary and visual accents SHALL have RPG flavor with **restraint** (missions, objectives, party, guild; pixel touches), **without sacrificing the legibility** of the data.

**Prototype:** RPG flavour with restraint is a design principle (gold only for guild/trophy, hue for meaning).

### FRD-09#U4 · behaviour only · `achievements-summary`

> - The gamification SHALL represent **real work**: XP is earned by **result** (work order/phase/release closed), **not** by volume of trivial tasks nor by opening the app.

**Prototype:** XP by result: data rule ("Se gana XP construyendo: cada work order verificada, fase completada y lanzamiento suma." is drawn in "Tu siguiente rango").

### FRD-09#U5 · partial · `guild-achievement-notice`

> - The celebration SHALL **scale**: small toast (work order) → medium animation (phase) → celebration (release) → **level-up** moment. Never a flat celebration on every action.

**Prototype:** Only the smallest rung is drawn: a gold achievement notice. Phase animation, release celebration and level-up moment are NOT drawn.

### FRD-09#U6 · not drawn · `guild-achievement-notice`

> - WHEN a product **ships** (the release milestone is met) THE system SHALL fire the **release celebration AUTOMATICALLY** (triggered by the milestone, e.g. `/pandacorp:release` completing), NOT via a button the owner presses.

**Prototype:** No automatic release celebration is drawn.

### FRD-09#U7 · not drawn · `guild-achievement-notice`

> - WHEN an agent or the guild **levels up** (an XP threshold is crossed) THE system SHALL fire the **level-up moment AUTOMATICALLY** on the milestone, NOT via a button.

**Prototype:** No level-up moment is drawn.

### FRD-09#U8 · partial · `guild-achievement-notice`

> - IF a celebration/level-up overlay is shown THEN the owner SHALL be able to **dismiss** it (honest, fatigue-free — White-Hat): the trigger is automatic, but it never blocks or nags.

**Prototype:** The notice has "Ver" and "Cerrar aviso" and closes by itself after 9 s; no blocking overlay exists to dismiss.

### FRD-09#U9 · behaviour only · `achievements-stats`

> - The system SHALL NOT include: **leaderboards**, **lives/death**, **daily streaks with reset**, nor **false urgency/timers**. Streaks SHALL be **weekly** (with a "freeze").

**Prototype:** No leaderboards, lives or false timers exist; the weekly streak appears as mission "Racha récord (semanas)" and record "Racha récord".

### FRD-09#U10 · behaviour only · `achievements-summary`

> - The gamification SHALL complement good UX, not compensate for bad UX (clear data comes first).

**Prototype:** UX-first principle.

### FRD-09#U11 · behaviour only · `achievements-summary`

> - It SHALL live in the **"White Hat" of Octalysis** (Epic Meaning, Accomplishment/Progress, Empowerment + Feedback): the greatest intrinsic asset is **seeing the agents work live**; XP is a secondary confirmation layer, not the main hook.

**Prototype:** White Hat principle.

### FRD-09#U12 · behaviour only · `achievements-summary`

> - EVERY new mechanic SHALL pass the **ethical test** before being added: does the user control their participation? does it build or undermine intrinsic motivation? is the reward meaningful or an addictive loop? is it honest about its psychological effect? Forbidden patterns: streak anxiety, slot-machine-style variable rewards, false urgency, leaderboards, a bar "stuck at 80%".

**Prototype:** Ethical test for new mechanics.

### AC-09-006.1 · behaviour only · `achievements-summary`

> - **AC-09-006.1** — WHEN Mission Control computes guild outcomes THEN it SHALL read the local ledger (`factory/gamification-ledger.json`, gitignored) and use `MAX(live, ledger)` for each metric (workOrdersDone, phasesCompleted, releases) so that **deleting a project NEVER decreases the guild's XP or level**.

**Prototype:** Ledger MAX(live, ledger): data rule.

### AC-09-006.2 · behaviour only · `achievements-summary`

> - **AC-09-006.2** — WHEN a live metric exceeds the stored ledger value THEN Mission Control SHALL update the ledger to record the new maximum (snapshot-on-exceed, fire-and-forget — does NOT block the render).

**Prototype:** Snapshot on exceed: data rule.

### AC-09-006.3 · behaviour only · `achievements-summary`

> - **AC-09-006.3** — `factory/gamification-ledger.json` SHALL be gitignored (personal data, DR-033). It SHALL NOT be committed to the repo.

**Prototype:** Gitignored ledger: data rule.

### FRD-09#U13 · behaviour only · `achievements-summary`

> - WHEN the same result is replayed through multiple runtime transports or vocabulary aliases THEN
>   durable XP and achievements SHALL count it once by a monotonic oracle-derived fact key, independent
>   of declared `event_id` or `run_id`.

**Prototype:** Runtime-neutral fact keys: data rule.

### FRD-09#U14 · behaviour only · `achievements-summary`

> - The existing gitignored ledger SHALL use schema v2, migrate valid v1 maxima without fabricating
>   event history, write atomically through one Server Action, serialize concurrent reconciliation,
>   refuse symlinks and fail closed without overwriting corrupt data.

**Prototype:** Ledger schema v2: data rule.

### FRD-09#U15 · behaviour only · `achievements-summary`

> - The writer SHALL derive totals and evidence from server-side canonical files; it SHALL ignore all
>   aggregate values supplied by the client.

**Prototype:** Server-side derivation: data rule.

### FRD-09#U16 · behaviour only · `achievements-summary`

> - A live/legacy event MAY render as telemetry, but SHALL NOT grant durable XP, agent attribution or an
>   achievement until a WO/FRD/status/git/artifact oracle corroborates the result. Uncorroborated
>   agent/role/mode/time fields SHALL be discarded when the durable fact is materialized.

**Prototype:** Telemetry vs durable XP: data rule (the stats tab marks unwired counters "sin datos aún").

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `guild-achievement-notice` | `?achievement=preview#inicio` | wait for `.ach-toast` | capture viewport | `FRD-09#U5` `FRD-09#U6` `FRD-09#U7` `FRD-09#U8` |
| `guild-rank-ladder` | `#logros?tab=Rangos` | (none) | full page | `FRD-09#U2` |

States cited above that belong to another FRD folder (captured there, reused here): `shell-expanded`, `achievements-summary`, `achievements-ranks`, `achievements-stats`.

**Not drawn (2)**: `FRD-09#U6`, `FRD-09#U7`.

**Partially drawn (4)**: `FRD-09#U1`, `FRD-09#U2`, `FRD-09#U5`, `FRD-09#U8`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `guild-achievement-notice`

- [dlg span] Vista previa del aviso
- [dlg @aria-label] Cerrar aviso

### `guild-rank-ladder`

- [span] Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- [p] El progreso que ha construido tu gremio, con la evidencia detrás.
- [span] Gremio Pandacorp · nivel 22
- [p] 2410 XP · 25 para el nivel 23
- [small] niveles de misión
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [@aria-label] Secciones de logros
- [button[tab]] Misiones
- [button[tab]] Trofeos 18
- [button[tab]] Rangos
- [p] El escalafón del gremio: tu nivel sube con XP y cada rango cubre un tramo de niveles. Cada nivel cuesta más que el anterior; la cima está lejos a propósito.
- [span] El despertar
- [span] Nv 1–12 · completa
- [p] Los primeros pasos del gremio
- [span] El punto de partida: todo gremio empieza con una sola persona.
- [span] Nv 1–3 (×41 of the same pattern)
- [span] Conseguido
- [span] 0 XP (×40 of the same pattern)
- [span] I
- [span] Buscas la primera luz; el camino apenas comienza.
- [span] II
- [span] III
- [span] Los portadores
- [p] Llevar la luz a la obra
- [span] Llevas la llama que guía a quienes vienen detrás.
- [span] Faltan 450 XP para Guardián del Juramento I
- [span] Estás aquí
- [span] Los guardianes
- [p] Custodios del juramento, los glifos y el éter
- [span] Tu palabra es ley; el juramento no se rompe.
- [span] Nv 25 (×33 of the same pattern)
- [span] Custodias los glifos que dan forma a la obra.
- [span] Dominas la energía que fluye entre los mundos.
- [span] Los campeones
- [span] Nv 73–141 · 9 rangos (×2 of the same pattern)
- [p] Esquirlas, espadas y reinos
- [span] Portas una esquirla de poder puro.
- [span] Tu espada brilla con la luz de mil victorias.
- [span] Invocas reinos enteros con una sola orden.
- [span] Los ascendidos
- [p] Heraldos, tormentas y trascendencia
- [span] Anuncias el amanecer de una nueva era.
- [span] El trueno responde a tu llamada.
- [span] Te elevas por encima de lo mortal.
- [span] La trascendencia
- [span] Nv 231+ · 6 rangos
- [p] Más allá de lo mortal: la cima
- [span] Renaces de tus cenizas, más fuerte cada vez.
- [span] Las profundidades te obedecen.
- [span] El dragón carmesí vuela bajo tu estandarte.
- [span] Vigilas el gremio desde las estrellas.
- [span] Reinas sobre el alba eterna.
- [span] La cima: el juramento que nunca termina.
- [span] Nv 289+

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Guild Master" title in the top bar | rank name ("Portador de Luz III") in the sidebar guild card; "Gremio Pandacorp · nivel 22" in the Logros hero.
- "Guild level-up moment" and "release celebration" | absent.
- Achievement notice "¡Nuevo logro!" / "Vista previa del aviso" (guild-achievement-notice); FRD-06 AC-06-016.1 asks "¡Logro desbloqueado!".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The "top bar" with guild level/XP does not exist: the shell is a sidebar plus a phone top bar (FRD-19 conflict).
- The celebration ladder (small toast → phase animation → release celebration → level-up) is only drawn at its first rung: FRD wants, prototype lacks.
- FRD-09 keeps ledger and runtime-neutral requirements that are not UI; they stay with the app, not the freeze.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 17: Resumen of Logros adds "Tu siguiente rango" (current → next emblem, XP left, how XP is earned) and a compact "Atributos del gremio" radar so both columns end at a similar height; Rangos collapses eras more than one step beyond the current one (goal gradient).
- Iteration 18: Inicio's Gremio card shows the latest achievement and links to Trofeos; a trophy flagged new by the app, or unlocked within 7 days of the capture, raises a gold notice once per browser (Ver / Cerrar, auto-close 9 s); `?achievement=preview` shows it for review.
- Iteration 21: the sidebar guild card is part of the collapsible shell.
- Iteration 28: gold is the category colour for mission progress, near trophies and the guild radar; green/amber/red remain status.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
