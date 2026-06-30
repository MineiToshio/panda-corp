---
id: FRD-10
type: frd
title: FRD-10 — Achievements Hall
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-29'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_informe: docs/design/prototype/informe-del-gremio.html
---
# FRD-10 — Achievements Hall

A page of achievements that are also **stats that grow**, with a date and project on each one. (Today with example data in the prototype; when the real Mission Control is built, the stats are computed by reading the factory and the projects.)

## Tier vs rarity (distinct concepts)
**Tier** and **rarity** are two different things and must not be conflated:
- **Tier** = the level a cumulative chain has reached. A chain tiers up through **5 tiers** — **Común → Poco común → Raro → Épico → Leyenda** (Common → Uncommon → Rare → Epic → Legend) — each time its stat crosses a threshold. Tier is a property of *where a chain currently sits*.
- **Rarity** = how rare an individual achievement is to obtain (Común→Leyenda), a per-achievement attribute independent of chain tiers. **Shipped in v2** as a per-trophy gem/border (reusing `tiers.ts` colors) in a pyramid distribution (many Común, few Leyenda), with an estimated-rarity label.

## v2 — "La página épica" (2026-06-29)
The catalogue is expanded from 15 trophies / 12 chains / 3 secrets to **~80 trophies across 8 axes**,
**~21 chains grouped in sagas**, and **~18 secrets**, with **per-trophy rarity**, category **Seals**
(platinum-equivalent), a **NUEVO** badge and an **estimated-rarity** label. Crucially, **every unlock
is re-anchored to the REAL event vocabulary the factory emits** — the v1 predicates read an
`achievement`/`task=…` event that nothing ever emitted, so most trophies were dormant forever (see
decision-log 2026-06-29). The full catalogue, the real-signal map and the rarity model live in
[mission-control/docs/achievements.md](../../achievements.md).

## Acceptance criteria (EARS)
### v2 additions (2026-06-29)
- Every unique trophy SHALL carry a **rarity grade** (Común · Poco común · Raro · Épico · Leyenda), shown as a colored gem/border (reusing `tiers.ts`) plus a **text label** (never color alone, WCAG 1.4.1) and an estimated-rarity blurb. The catalogue SHALL follow a **pyramid** distribution (≈40/25/17/11/6%).
- Trophies SHALL span **8 axes** (Descubrimiento · Velocidad · Calidad · Consistencia · Maestría · **Producción** · **Gremio** · **Temple**), offered as filter chips with each axis's icon.
- The Hall SHALL show **Seals** (meta-trophies): one per axis, unlocked when **all** that axis's trophies are earned, plus a **Grand Seal** when all 8 Seals are held. A Seal is derived purely from the unlocked-set of its axis (no new signal).
- A trophy unlocked within the last **7 days** SHALL show a **NUEVO** badge, derived from its real unlock `date` vs the server clock (no fabrication).
- Cumulative chains SHALL be **grouped into sagas** (narrative section headers) on the Misiones tab.
- **Honesty (non-negotiable):** every trophy/chain/secret SHALL be **derived from a verifiable real signal** (idea cards · project statuses · the real event vocabulary in `docs/achievements.md` §1). A condition with **no real signal** SHALL NOT ship as a trophy (recorded under "pending emitter" instead) — no dormant/smoke trophies. The events reader SHALL **fail loud** (DR-078) on an unrecognised enriched shape, never silently drop it.

### Base criteria
- It SHALL present a **5-tab layout** (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**), each tab a chip with **its icon** and, where applicable, **a count** (Misiones = chains in progress; Trofeos = unlocked trophies) — prototype `logrosTabs` (the Rangos tab is the new guild-rank-ladder surface, FRD-09).
- The **Rangos** tab SHALL show the **40-rung guild rank ladder** (FRD-09) as an **enriched, era-sectioned vertical climb** (UI/UX research 2026-06-25: for an ordered 40-tier ladder a list beats a grid — it preserves the climb metaphor — and the row's horizontal space is filled with metadata rather than abandoned for cards). The 40 ranks are grouped into **6 narrative "eras"** (El despertar · Los portadores · Los guardianes · Los campeones · Los ascendidos · La trascendencia), each with a section header + level range. **Each rank row** shows a **LARGE pixel-art emblem** (≈88px; 104px for the current rank — the art is the hero, the owner's request) with its **grade badge** (I·II·III), the Spanish name, a **one-line RPG flavor caption**, the **level band** `Nv min–max` (open-ended `Nv N+` at the top), the **XP threshold** ("Inicio" / "1.040 XP"), and a **state marker with an icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N`) — never color alone (WCAG 1.4.1). The **current rank** is highlighted (accent glow + a bar of progress to the NEXT rank); ranks already earned read as done; ranks ahead are dimmed/locked (fading toward the summit, opacity floored at 0.5 so the icon+text cues stay legible). The **summit** (rank 40) gets a distinct, centered full-width treatment ("LA CIMA", larger emblem, warn-colored frame) so the top reads as a destination. The rank is the BAND that contains the guild's granular level (FRD-09 `rankForLevel`), not a 1:1 level.
- The **GuildHero character-sheet** (level shield · guild title · XP bar · TU PARTY roster · record badges) SHALL live **inside the Resumen tab** (below the tabs), NOT as a persistent header across tabs — the always-visible guild level is the header GuildBar (FRD-09). Prototype `logrosResumen = hero + questsNear + recentTrophies`. (Decision 2026-06-25, red-team: a persistent hero duplicates the header GuildBar.)
- The hero summary SHALL count **hazañas = tiers reached (Σ currentTierIndex+1 across chains) + unlocked trophies**, and **misiones en curso = chains with a next tier** (prototype `logrosCounts`).
- The XP bar SHALL show the **XP total on the left** and **"faltan N para Nv X · &lt;nextRank&gt;" on the right**, both above the bar (prototype `logrosHero`).
- Each **cumulative chain card** SHALL show the **current tier's fun name** as its title (chain name as subtitle), a **rarity badge** (Común → Leyenda — never metal names), a **tier-colored** bar (reusing CMP-09-xp-bar's fillColor), a **node ladder** of the tiers, a **goal row** "→ &lt;next&gt; · valor / umbral" (lower-is-better: "récord Nd → ≤Md"), and on completion the **"Cadena legendaria completada"** crown. **All chain cards SHALL share one standardized layout** (no per-card divergence): the progress bar is ALWAYS present (a completed chain shows a full 100% bar, never a missing bar) and every card ends in the **same uniform footer slot** — the latest dated unlock (`date · project`) when one exists, else an honest fallback (the cumulative value / record), so a card never shows a date while its neighbour shows nothing.
- It SHALL show a **statistics panel** (counters that only grow), comprising exactly these stats: products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs written, ADRs registered, agents coordinated, record streak (weeks), and record idea→launch (days). These SHALL be presented as the character sheet — a radar of guild attributes, the record/hero stats (products shipped · record streak · record idea→launch) and the per-category ledger (Production · Quality · Pace & reach).
- Each metric in the Estadísticas tab SHALL show an **unbounded "Nv N" level** (FRD-09, `metricLevel`) that **keeps climbing with the value — never capped at 5** and no rarity names (Común→Leyenda): the level counts the metric's defined milestones crossed, then extends ≈1.6× beyond the last. The level is shown as a `Nv N` chip + a band-colored pip (5 hues) on hero tiles and ledger rows; 0 → "sin nivel". (The rarity-named, 5-tier chains remain the **Misiones** lens; Estadísticas is the numeric character-sheet lens.)
- It SHALL show **cumulative chains** that **tier up** through the 5 tiers (**Común → Poco común → Raro → Épico → Leyenda**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.
- EACH unlocked tier SHALL store and show the **date** and **project** where it happened.
- It SHALL show an **"Almost there"** section with the chains closest to their next tier (Zeigarnik effect).
- It SHALL show **unique achievements** (one-time only) grouped **by state** — **Conquistados** (unlocked) then **Por conquistar** (locked, compact lockchips with a hover-reveal of the unlock condition) — with the **eight axes** (Discovery, Speed, Quality, Consistency, Mastery, Production, Guild, Resilience — v2) offered as **filter chips** (not as a second grouping axis), with date + project when unlocked, and the condition + rarity when locked. (Matches the prototype `logrosTrofeos`; the earlier by-category grouping made every locked card look identical and diverged from the design.)
- It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, it SHALL **reveal its criterion** (what triggered it), never remain an obscure loot-box-style mechanic.
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

**Approved visual anchor (source of truth for the look):**
[`docs/design/prototype/informe-del-gremio.html`](../../design/prototype/informe-del-gremio.html) — the
sober six-band Informe view (the prototype's section headers: *El pulso de la fábrica · En el tiempo, de
verdad · Cómo usas la fábrica · Embudo y flujo · Estado y salud del proceso · Qué mover ahora*). The
owner approved this design on 2026-06-29. The `docs/design/prototype/index.html` Logros view remains the
anchor for the other four tabs (Resumen · Misiones · Trofeos · Rangos) and for the shared RPG skin.

**Honesty contract (unchanged, non-negotiable, DR-078):** every figure is **derived from a verifiable
real source** (git history of the committed artifacts · `factory/ideas/*.md` · project `status.yaml` ·
the real event stream `~/.claude/dashboard-events.ndjson`). A figure with **no wired source** is rendered
as a literal **"—" with a "no cableado" label** — **never a fabricated zero** and never an invented
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
- **AC-10-020.3** — THE **idea→release lead time** KPI SHALL render as **"—" with a "no cableado" label**
  (NOT a zero) because `readIdeas` does not yet parse a per-idea `created` timestamp tying an idea to its
  launch — IF and when that field is wired THEN it SHALL show real days. (Bidirectional edge: this is the
  primary "no cableado" path of the band.)

#### REQ-10-021 — "En el tiempo, de verdad" (real time-series — REPLACES the raw-event-count view)
- **AC-10-021.1** — THE system SHALL show a **WO-verified-per-week** series grouped by **ISO week**,
  where each WO's week is the **git commit where its `implementation_status` crosses to `VERIFIED`** (read
  from the git history of each `work-orders/wo-*.md`, `IF-10-flow-series`), matching the verified real
  shape **W25=78, W26=8, W27=5 (91 total)**.
- **AC-10-021.2** — THE system SHALL show an **ideas-captured-per-week** series from the **`created`**
  frontmatter of `factory/ideas/*.md` grouped by ISO week (`IF-10-flow-series`), matching the verified
  real shape **W24=3, W26=15**. IF an idea card has no `created` frontmatter THEN it SHALL be excluded
  from the per-week series (and that exclusion SHALL be observable, not silently zeroed).
- **AC-10-021.3** — THE Informe SHALL NOT render the old raw-event-count "en el tiempo" view (raw event
  counts are noise); this requirement REPLACES it. (Negative AC.)

#### REQ-10-022 — "Cómo usas la fábrica" (usage + effort mix)
- **AC-10-022.1** — THE system SHALL show the **most-used workflows/skills**, aggregated from the event
  stream (`~/.claude/dashboard-events.ndjson`, `IF-10-usage`), matching the verified real shape
  **deep-research 1494, pandacorp-build 850, audits/research ≈400** (top-N, descending).
- **AC-10-022.2** — THE system SHALL show the **effort mix** (high / xhigh / max / medium) aggregated from
  the event stream's `effort.level`, matching the verified real shape **high 1384, xhigh 937, max 700,
  medium 3**.
- **AC-10-022.3** — IF the event stream is absent or unreadable THEN the band SHALL render its **"no
  cableado" / error state** (fail-loud), NOT an empty or zeroed band.

#### REQ-10-023 — "Embudo y flujo" (funnel + per-project phase transitions)
- **AC-10-023.1** — THE system SHALL show the **ideas → launched funnel** from `readIdeas` + `readStatus`
  (`IF-10-funnel`): total ideas (matching the verified real shape **18: discovered 6, in-pipeline 2,
  discarded 10**) narrowing to launched (**1**), with the conversion **≈ 6 %**.
- **AC-10-023.2** — THE system SHALL show **phase transitions PER PROJECT** read from the **git history of
  the `phase` field in each `.pandacorp/status.yaml`** (`IF-10-phase-transitions`), labelling each row
  with the **project name**, matching the verified real shape for `mission-control`: **06-16
  architecture→implementation, 06-18 implementation→release, 06-19 release→implementation (flagged as a
  REOPEN), 06-21 implementation→release**.
- **AC-10-023.3** — WHEN a transition goes **backwards** in the phase order (a reopen, e.g.
  release→implementation) THE system SHALL **flag it as a reopening** (text + icon, never color alone).

#### REQ-10-024 — "Estado y salud del proceso" (2-column health band)
- **AC-10-024.1** — THE left column SHALL list **projects by phase** from `readStatus` (`IF-10-funnel`),
  matching the verified real shape **mission-control → release, personal-page-v2 → design**.
- **AC-10-024.2** — THE right column SHALL list **process signals** each from its real source:
  **lessons distilled** (matching **2 / 131**, `IF-10-lessons`); **build relaunches** (from
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
  the columns align (no staircase). **Producción** gains **FRDs completed (21), Commits (823), Projects
  created (2)**; **Calidad** gains **Tests passing (7134), Decisions/DR (99)**. Each new row's value
  SHALL come from its real source (`IF-10-scalars` for the git/doc counts; `readIdeas`/`readStatus` for
  the rest).
- **AC-10-026.2** — Each new ledger value SHALL be a real count (or **"—" / "no cableado"** when its
  source is not wired) — never a fabricated number.

#### REQ-10-027 — Records grid expanded to 2×3 (6 records)
- **AC-10-027.1** — THE records block (right of Atributos) SHALL show a **2×3 grid of 6 records**, adding
  to the existing 3: **Peak week** (the WO count of the best week, **78**, from `IF-10-flow-series`);
  **Lessons captured** (**131**, from `IF-10-lessons`); **Subagents coordinated** (from
  `signals.subagents`). Each record SHALL come from its real source; an unwired record SHALL render
  **"—" / "no cableado"**, never a fabricated value.

## Detail
Full list of stats, thresholds, tier names and unique achievements in [mission-control/docs/achievements.md](../../achievements.md).
The Informe operativo's data sources and the new interfaces (`IF-10-flow-series`, `IF-10-phase-transitions`,
`IF-10-scalars`, `IF-10-usage`, `IF-10-funnel`, `IF-10-lessons`) are designed in the
[feature blueprint](blueprint.md) and built by work orders **WO-10-014** (data layer) and **WO-10-015**
(report UI).

## Future
Meta-achievements (Seals), the "New" badge, and per-trophy rarity are **shipped in v2** (above).
Remaining future ideas: trophy "progress %" toward partially-met conditions, and the *pending-emitter*
trophies (`docs/achievements.md` §8) that need a new factory event (code-churn, runtime-error feed)
before they can ship — never shipped as dormant.
