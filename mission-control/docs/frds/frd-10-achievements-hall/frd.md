---
id: FRD-10
type: frd
title: FRD-10 — Achievements Hall
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-10-22'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-10-achievements-hall/mocks/achievements-hall.html
floor: false
---
# FRD-10 — Achievements Hall

A page of achievements that are also **stats that grow**. The interface calls this surface "Logros". (Today with example data in the prototype; when the real Mission Control is built, the stats are computed by reading the factory and the projects.)

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The separate Informe anchor (`informe-del-gremio.html`) is superseded by the Estadísticas tab of the prototype (contradiction C-13 of `docs/design/freeze/reconciliation.md`). Items the owner left out of v2 (decision 2026-10-21) stay in place, prefixed **Out of v2**. Prototype-drawn behaviours are REQ-10-028 (AC-10-028.1 to AC-10-028.5). The original unnumbered criteria carry no ids and are amended in place.

## Tier vs rarity (distinct concepts)
**Tier** and **rarity** are two different things and must not be conflated:
- **Tier** = the level a cumulative chain has reached. A chain tiers up through **5 tiers** — **Común → Poco común → Raro → Épico → Leyenda** (Common → Uncommon → Rare → Epic → Legend) — each time its stat crosses a threshold. Tier is a property of *where a chain currently sits*.
- **Rarity** = how rare an individual achievement is to obtain (Común→Leyenda), a per-achievement attribute independent of chain tiers. **Shipped in v2** as a per-trophy gem/border (reusing `tiers.ts` colors) in a pyramid distribution (many Común, few Leyenda); **Out of v2 (owner decision 2026-10-21):** the estimated-rarity label.

## v2 — "La página épica" (2026-06-29)
The catalogue is expanded from 15 trophies / 12 chains / 3 secrets to **~80 trophies across 8 axes**,
**~21 chains grouped in sagas**, and **~18 secrets**, with **per-trophy rarity**, category **Seals**
(platinum-equivalent), and the rarity model (the per-trophy **NUEVO** badge and the **estimated-rarity** label are out of v2). Crucially, **every unlock
is re-anchored to the REAL event vocabulary the factory emits** — the v1 predicates read an
`achievement`/`task=…` event that nothing ever emitted, so most trophies were dormant forever (see
decision-log 2026-06-29). The full catalogue, the real-signal map and the rarity model live in
[mission-control/docs/achievements.md](../../achievements.md).

## Acceptance criteria (EARS)
### v2 additions (2026-06-29)
- Every unique trophy SHALL carry a **rarity grade** (Común · Poco común · Raro · Épico · Leyenda), shown as a colored gem/border (reusing `tiers.ts`) plus a **text label** (never color alone, WCAG 1.4.1); **Out of v2 (owner decision 2026-10-21):** the estimated-rarity blurb. The catalogue SHALL follow a **pyramid** distribution (≈40/25/17/11/6%).
- Trophies SHALL span **8 axes** (Descubrimiento · Velocidad · Calidad · Constancia · Maestría · Producción · Gremio · Resiliencia), offered as filter chips.
- The Hall SHALL show **Sellos** (meta-trophies): one per axis, unlocked when **all** that axis's trophies are earned, plus a **Sello grande** ("Todos los sellos · N/8") when all 8 Sellos are held. A Sello is derived purely from the unlocked-set of its axis (no new signal).
- **Out of v2 (owner decision 2026-10-21):** a trophy unlocked within the last **7 days** SHALL show a **NUEVO** badge, derived from its real unlock `date` vs the server clock (no fabrication). In v2 the "Nuevo" chip on Inicio's last-achievement card (FRD-18) and the gold notice (FRD-09 AC-09-008.2) carry that signal.
- Cumulative chains SHALL be **grouped into sagas** (narrative section headers) on the Misiones tab.
- **Honesty (non-negotiable):** every trophy/chain/secret SHALL be **derived from a verifiable real signal** (idea cards · project statuses · the real event vocabulary in `docs/achievements.md` §1). A condition with **no real signal** SHALL NOT ship as a trophy (recorded under "pending emitter" instead) — no dormant/smoke trophies. The events reader SHALL **fail loud** (DR-078) on an unrecognised enriched shape, never silently drop it.

### Base criteria
- It SHALL present a **5-tab layout** (Resumen · Misiones · Trofeos · Estadísticas · Rangos), each tab a chip with **its icon** and a **count only on Trofeos** (unlocked trophies; Misiones carries no count) — prototype `logrosTabs` (the Rangos tab is the guild-rank-ladder surface, FRD-09).
- The **Rangos** tab SHALL show the **40-rung guild rank ladder** (FRD-09) as an **enriched, era-sectioned vertical climb** (UI/UX research 2026-06-25: for an ordered 40-tier ladder a list beats a grid — it preserves the climb metaphor — and the row's horizontal space is filled with metadata rather than abandoned for cards). The 40 ranks are grouped into **6 narrative "eras"** (El despertar · Los portadores · Los guardianes · Los campeones · Los ascendidos · La trascendencia), each with a section header + level range. **Each rank row** shows a **56 px pixel-art emblem** with its **grade badge** (I·II·III), the Spanish name, a **one-line RPG flavor caption**, the **level band** `Nv min–max` (open-ended `Nv N+` at the top), the **XP threshold** ("Inicio" / "1.040 XP"), and a **state marker with an icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N`) — never color alone (WCAG 1.4.1). The **current rank** is highlighted (accent glow + a bar of progress to the NEXT rank); ranks already earned read as done; ranks ahead are dimmed/locked (fading toward the summit, opacity floored at 0.5 so the icon+text cues stay legible). **Out of v2 (owner decision 2026-10-21):** the **summit** (rank 40) gets a distinct, centered full-width treatment ("LA CIMA", larger emblem, warn-colored frame) so the top reads as a destination. The rank is the BAND that contains the guild's granular level (FRD-09 `rankForLevel`), not a 1:1 level.
- The **GuildHero character-sheet** (level shield · guild title · XP bar) SHALL sit **above all five tabs** ("Gremio Pandacorp · nivel N"), and the Resumen tab SHALL show the rest of the page (AC-10-028.1). **Out of v2 (owner decision 2026-10-21):** the TU PARTY roster and the record badges in the hero. The always-visible guild level is the sidebar guild card (FRD-09 AC-09-008.1).
- The hero summary SHALL count **trofeos** (unlocked trophies), **secretos** (unlocked secrets) and **niveles de misión** (tiers reached, Σ currentTierIndex+1 across chains) (prototype `logrosCounts`).
- The hero XP line SHALL read "N XP · M para el nivel L" (level and rank are separate, since the rank is a band of levels), and the rank card and the current rank row SHALL read "Faltan N XP para &lt;nextRank&gt;".
- Each **cumulative chain card** SHALL show the **current tier's fun name** as its title (chain name as subtitle), a **rarity badge** (Común → Leyenda — never metal names), a **tier-colored** bar (reusing CMP-09-xp-bar's fillColor), a **node ladder** of the tiers, a **goal row** "→ &lt;next&gt; · valor / umbral" (lower-is-better: "récord Nd → ≤Md"). **Out of v2 (owner decision 2026-10-21):** on completion the **"Cadena legendaria completada"** crown. **All chain cards SHALL share one standardized layout** (no per-card divergence): the progress bar is ALWAYS present (a completed chain shows a full 100% bar, never a missing bar) and every card ends in the **same uniform footer slot** — the cumulative value / record (**Out of v2:** the latest dated unlock `date · project`, see the per-tier date and project line below), so a card never shows a footer while its neighbour shows nothing.
- It SHALL show a **statistics panel** (counters that only grow), comprising exactly these stats: products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs written, ADRs registered, agents coordinated, record streak (weeks), and record idea→launch (days). These SHALL be presented as the character sheet — a radar of guild attributes, the record/hero stats (products shipped · record streak · record idea→launch) and the per-category ledger (Production · Quality · Pace & reach).
- Each metric in the Estadísticas tab SHALL show an **unbounded "Nv N" level** (FRD-09, `metricLevel`) that **keeps climbing with the value — never capped at 5** and no rarity names (Común→Leyenda): the level counts the metric's defined milestones crossed, then extends ≈1.6× beyond the last. The level is shown as a `Nv N` chip + a band-colored pip (5 hues) on hero tiles and ledger rows; 0 → "sin nivel". (The rarity-named, 5-tier chains remain the **Misiones** lens; Estadísticas is the numeric character-sheet lens.)
- It SHALL show **cumulative chains** that **tier up** through the 5 tiers (**Común → Poco común → Raro → Épico → Leyenda**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.
- **Out of v2 (owner decision 2026-10-21):** EACH unlocked chain tier SHALL store and show the **date** and **project** where it happened, and the chain-complete crown. Unlocked trophies keep their date · project.
- It SHALL show a **"Casi lo tienes"** card on the Resumen (and an "A un paso de subir" spotlight on Misiones) with the chains closest to their next tier (Zeigarnik effect).
- It SHALL show **unique achievements** (one-time only) grouped **by state** — **Conquistados** (unlocked) then **Por conquistar** (locked, compact lockchips whose click opens a dialog with the unlock condition) — with the **eight axes** (Descubrimiento, Velocidad, Calidad, Constancia, Maestría, Producción, Gremio, Resiliencia) offered as **filter chips** (not as a second grouping axis), with date + project when unlocked, and the condition + rarity when locked. (Matches the prototype `logrosTrofeos`; the earlier by-category grouping made every locked card look identical and diverged from the design.)
- It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, the secret SHALL move to Conquistados as a normal trophy tile showing its condition (what triggered it), never remain an obscure loot-box-style mechanic. **Out of v2 (owner decision 2026-10-21):** a distinct revealed-secret treatment.
- The chains and progress bars SHALL apply **honest endowed progress**: start by showing the progress **already achieved** (not at zero) — it speeds up completion (Zeigarnik effect) and is honest because it corresponds to real work. No notifications or nagging reminders.
- The names SHALL be fun and scale in grandeur by tier (e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle).

## v3 — "Informe operativo" (the Estadísticas tab becomes a sober operator report) (2026-06-29)

The **Estadísticas** tab is expanded from the character-sheet (radar + record tiles + ledger) into a
sober **operator report** ("Informe") that answers, with REAL factory data, *how is the factory
actually doing, and what should I move next?* This is **additive**: the radar, the record tiles and the
per-category ledger stay; the report **adds** an executive-summary band, real time-series, usage/effort,
a funnel & per-project flow view, a process-health band and a next-actions band, and it **replaces only**
the old raw-event-count "en el tiempo" view (which counted raw events = noise) with a real
WO-verified-per-week + ideas-per-week series.

**Visual anchor (source of truth for the look):** the Estadísticas tab of
`docs/design/prototype/index.html` (amended 2026-10-22; it supersedes the earlier standalone
`informe-del-gremio.html` anchor). The same prototype anchors the other four tabs (Resumen · Misiones ·
Trofeos · Rangos) and the shared skin. The section headers of the Informe bands are *El pulso de la
fábrica · En el tiempo, de verdad · Cómo usas la fábrica · Embudo y flujo · Estado y salud del proceso ·
Qué mover ahora*.

**Honesty contract (unchanged, non-negotiable, DR-078):** every figure is **derived from a verifiable
real source** (git history of the committed artifacts · `factory/ideas/*.md` · project `status.yaml` ·
the real event stream `~/.claude/dashboard-events.ndjson`). A figure with **no wired source** is rendered
as a no-value marker (never an em dash, product-copy rule) **with a "no cableado" label** — **never a fabricated zero** and never an invented
value. The readers **fail loud** on an unrecognised shape (render an error state, not an empty band). The
**only-grow** invariant applies to cumulative counters ONLY; it does **NOT** apply to the time-series
(a week can legitimately have fewer verified WOs than the previous one).

**Sober register (DR-062):** the Informe is calm and legible — no RPG lore, no levels, no glow walls; the
gamified lore/levels stay in the Trofeos and Rangos tabs. The Informe reuses the existing tokens, type
scale, card style and section-header style (a deviation in scale/palette is a defect, DR-062).

### Sub-feature: Informe operativo

The report is composed of six bands plus the expanded ledger and records grid. Numbering continues from
the existing FRD-10 ranges; these requirements carry IDs `REQ-10-020`..`REQ-10-027` with acceptance
criteria `AC-10-020.K`..`AC-10-027.K`.

#### REQ-10-020 — "El pulso de la fábrica" (executive summary band)
A band at the top of the Informe: a one-sentence **verdict** derived by deterministic rules from the real
figures, plus a KPI row of FLOW metrics.

- **AC-10-020.1** — WHEN the Informe renders THE system SHALL show a one-sentence **verdict** computed by
  deterministic rules from the real figures (e.g. WO-verified trend, active-project count, conversion);
  the rule inputs SHALL all be wired real values, and the rule SHALL be a pure function of them (same
  inputs → same sentence) — no fabricated adjectives.
- **AC-10-020.2** — THE KPI row SHALL show, each from its real source: **WO verified / week** (this week,
  with the **delta** vs the previous week, from the git-derived series, `IF-10-flow-series`); **active
  projects (WIP)** = projects whose `phase` is between `design` and `release` exclusive of terminal,
  from `readStatus` (`IF-10-funnel`); **idea→launched conversion** = shipped ÷ total ideas, from
  `readIdeas`+`readStatus`.
- **AC-10-020.3** — THE **idea→release lead time** KPI SHALL render as **a no-value marker with a "no cableado" label**
  (NOT a zero) because `readIdeas` does not yet parse a per-idea `created` timestamp tying an idea to its
  launch — IF and when that field is wired THEN it SHALL show real days. (Bidirectional edge: this is the
  primary "no cableado" path of the band.)

#### REQ-10-021 — "En el tiempo, de verdad" (real time-series — REPLACES the raw-event-count view)
- **AC-10-021.1** — THE system SHALL show a **WO-verified-per-week** series grouped by **ISO week**,
  where each WO's week is the **git commit where its `implementation_status` crosses to `VERIFIED`** (read
  from the git history of each `work-orders/wo-*.md`, `IF-10-flow-series`), and the per-week values SHALL equal
  the fixture-factory oracle values (state `achievements-stats`, fixtures at `docs/design/prototype/fixtures/`).
  (Amended 2026-10-22, v2 plan: replaces the dated real-data shape W25=78, W26=8, W27=5, which no live test can reproduce.)
- **AC-10-021.2** — THE system SHALL show an **ideas-captured-per-week** series from the **`created`**
  frontmatter of `factory/ideas/*.md` grouped by ISO week (`IF-10-flow-series`), and the per-week values SHALL
  equal the fixture-factory oracle values (state `achievements-stats`, fixtures at `docs/design/prototype/fixtures/`;
  amended 2026-10-22, v2 plan: replaces the dated real-data shape W24=3, W26=15). IF an idea card has no `created` frontmatter THEN it SHALL be excluded
  from the per-week series (and that exclusion SHALL be observable, not silently zeroed).
- **AC-10-021.3** — THE Informe SHALL NOT render the old raw-event-count "en el tiempo" view (raw event
  counts are noise); this requirement REPLACES it. (Negative AC.)

#### REQ-10-022 — "Cómo usas la fábrica" (usage + effort mix)
- **AC-10-022.1** — **Out of v2 (owner decision 2026-10-21; the skills do not emit the event yet, so the honest empty band stays):** THE system SHALL show the **most-used workflows/skills**, aggregated from the event
  stream (`~/.claude/dashboard-events.ndjson`, `IF-10-usage`), matching the verified real shape
  **deep-research 1494, pandacorp-build 850, audits/research ≈400** (top-N, descending).
- **AC-10-022.2** — **Out of v2 (owner decision 2026-10-21; same reason as AC-10-022.1):** THE system SHALL show the **effort mix** (high / xhigh / max / medium) aggregated from
  the event stream's `effort.level`, matching the verified real shape **high 1384, xhigh 937, max 700,
  medium 3**.
- **AC-10-022.3** — IF the event stream is absent or unreadable THEN the band SHALL render its **"no
  cableado" / error state** (fail-loud), NOT an empty or zeroed band. The unreadable-stream error state is
  drawn as its own coral notice, distinct from the empty-band text (state `stats-stream-error`, M1
  2026-10-22).

#### REQ-10-023 — "Embudo y flujo" (funnel + per-project phase transitions)
- **AC-10-023.1** — THE system SHALL show the **ideas → launched funnel** from `readIdeas` + `readStatus`
  (`IF-10-funnel`): total ideas narrowing to launched, with the conversion, and the funnel counts and the
  conversion SHALL equal the fixture-factory oracle values (state `achievements-stats`; amended 2026-10-22, v2 plan:
  replaces the dated real-data shape 18 ideas, 1 launched, ≈ 6 %).
- **AC-10-023.2** — THE system SHALL show **phase transitions PER PROJECT** read from the **git history of
  the `phase` field in each `.pandacorp/status.yaml`** (`IF-10-phase-transitions`), labelling each row
  with the **project name**, and the transitions (date, project, from→to) SHALL equal the fixture-factory
  oracle values (state `achievements-stats`; amended 2026-10-22, v2 plan: replaces the dated real-data shape of
  `mission-control`, 06-16 to 06-21).
- **AC-10-023.3** — WHEN a transition goes **backwards** in the phase order (a reopen, e.g.
  release→implementation) THE system SHALL **flag it as a reopening** (text + icon, never color alone).

#### REQ-10-024 — "Estado y salud del proceso" (2-column health band)
- **AC-10-024.1** — THE left column SHALL list **projects by phase** from `readStatus` (`IF-10-funnel`),
  and each project's phase SHALL equal the fixture-factory oracle values (state `achievements-stats`; amended
  2026-10-22, v2 plan: replaces the dated real-data shape mission-control → release, personal-page-v2 → design).
- **AC-10-024.2** — THE right column SHALL list **process signals** each from its real source:
  **lessons distilled** (equal to the fixture-factory oracle value, state `achievements-stats`, `IF-10-lessons`; amended 2026-10-22, v2 plan: replaces the dated 2 / 131); **build relaunches** (from
  `IF-10-phase-transitions` reopen count / signals); **discards without a structured reason** (idea cards
  with `status: discarded` whose `discard_reason` is empty/freeform — itself a finding, from `readIdeas`);
  **quality telemetry not wired** (rendered explicitly as **"no cableado"**, not a zero).

#### REQ-10-025 — "Qué mover ahora" (next-best-actions)
- **AC-10-025.1** — THE system SHALL show a short list of **next-best-actions**, each derived by a
  deterministic rule from the real figures and each carrying **its command** (e.g.
  `/pandacorp:memory`, `/pandacorp:release`, `/pandacorp:recommend`); each action's trigger condition
  SHALL be a pure function of wired real values (no fabricated suggestions).

#### REQ-10-026 — Ledger expanded to 8 rows per column (aligned, no staircase)
- **AC-10-026.1** — THE per-category ledger SHALL show **exactly 8 rows in each of the three columns** so
  the columns align (no staircase). **Producción** gains **FRDs completed, Commits, Projects
  created**; **Calidad** gains **Tests passing, Decisions/DR**. Each new row's value
  SHALL come from its real source (`IF-10-scalars` for the git/doc counts; `readIdeas`/`readStatus` for
  the rest), and the values SHALL equal the fixture-factory oracle values (state `achievements-stats`;
  amended 2026-10-22, v2 plan: replaces the dated real-data values 21, 823, 2, 7134 and 99).
- **AC-10-026.2** — Each new ledger value SHALL be a real count (or **a no-value marker with the "no cableado" label** when its
  source is not wired) — never a fabricated number. A counter whose event has never been recorded reads
  "sin datos aún" instead (AC-10-028.5); the two states are never merged.

#### REQ-10-027 — Records grid expanded to 2×3 (6 records)
- **AC-10-027.1** — THE records block (right of Atributos) SHALL show a **2×3 grid of 6 records**, adding
  to the existing 3: **Peak week** (the WO count of the best week, from `IF-10-flow-series`);
  **Lessons captured** (from `IF-10-lessons`); **Subagents coordinated** (from
  `signals.subagents`). Each record SHALL come from its real source and equal the fixture-factory oracle value
  (state `achievements-stats`; amended 2026-10-22, v2 plan: replaces the dated 78 and 131); an unwired record SHALL render
  **a no-value marker with the "no cableado" label**, never a fabricated value.

### REQ-10-028 — Resumen, missions, trophies, ranks and stats details (added 2026-10-22, design freeze)

- **AC-10-028.1** — THE Logros Resumen SHALL show, in its right column, "Tu siguiente rango" (the current and next emblem, the XP left and how XP is earned), a compact attributes radar naming the strongest and weakest attribute, and the last four trophies.
- **AC-10-028.2** — WITHIN each saga on Misiones, missions SHALL be ordered by closeness to their next tier, with untouched missions (zero progress) last and muted.
- **AC-10-028.3** — (amended 2026-10-22, v2 reconciliation) THE Trofeos tab SHALL show a conquered bar and the row of Sellos, "Los más alcanzables" (the lowest-rarity locked trophy of each category, three when a category filter is active), and SHALL list the locked trophies of "Por conquistar" paged with the shared "Mostrar más" bar: the first 12, then WHEN the bar is activated THE system SHALL reveal the next 24 (or what remains), the bar reading "Mostrar N más · quedan M" with N = the next batch (at most 24) and M = the trophies still hidden (the captured state draws "Mostrar 24 más · quedan 46").
- **AC-10-028.4** — THE Rangos tab SHALL collapse every era more than one step beyond the current rank into a single row showing its level range and its rank count.
- **AC-10-028.5** — WHERE a counter's event has never been recorded, THE Estadísticas tab SHALL show "sin datos aún" (not 0) with an explanatory line that distinguishes it from "no cableado", and SHALL list phase transitions 10 at a time.

**Worked example (AC-10-028.2).** In a saga with three missions: A at 80% of its next tier, B at 30%, C at 0%. Order: A, B, then C (muted, last).

## Detail
Full list of stats, thresholds, tier names and unique achievements in [mission-control/docs/achievements.md](../../achievements.md).
The Informe operativo's data sources and the new interfaces (`IF-10-flow-series`, `IF-10-phase-transitions`,
`IF-10-scalars`, `IF-10-usage`, `IF-10-funnel`, `IF-10-lessons`) are designed in the
[feature blueprint](blueprint.md) and built by work orders **WO-10-014** (data layer) and **WO-10-015**
(report UI).

## Future
Meta-achievements (Sellos) and per-trophy rarity are **shipped in v2** (above); the per-trophy "NUEVO" badge is out of v2.
Remaining future ideas: trophy "progress %" toward partially-met conditions, and the *pending-emitter*
trophies (`docs/achievements.md` §8) that need a new factory event (code-churn, runtime-error feed)
before they can ship — never shipped as dormant.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
