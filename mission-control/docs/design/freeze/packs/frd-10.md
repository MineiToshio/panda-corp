# Context pack · FRD-10 · Achievements Hall

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-10 copy, S2.1 builds, S2.2 amendments, S2.3-10 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-10-achievements-hall/frd.md` (id FRD-10, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 7 under `states["frd-10-achievements-hall"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 39 AC lines: 20 drawn · 14 partially drawn · 2 not drawn · 3 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-10#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-10#U1 · partial · `achievements-trophies`, `achievements-trophy-dialog`

> - Every unique trophy SHALL carry a **rarity grade** (Común · Poco común · Raro · Épico · Leyenda), shown as a colored gem/border (reusing `tiers.ts`) plus a **text label** (never color alone, WCAG 1.4.1) and an estimated-rarity blurb. The catalogue SHALL follow a **pyramid** distribution (≈40/25/17/11/6%).

**Prototype:** Rarity (Común · Poco común · Raro · Épico · Leyenda) is a text chip with a coloured dot on every trophy tile and in the dialog; Común→Leyenda is also used for mission tiers. The estimated-rarity blurb is NOT drawn.

### FRD-10#U2 · partial · `achievements-trophies`, `achievements-trophy-category`

> - Trophies SHALL span **8 axes** (Descubrimiento · Velocidad · Calidad · Consistencia · Maestría · **Producción** · **Gremio** · **Temple**), offered as filter chips with each axis's icon.

**Prototype:** Eight category chips with counts: Descubrimiento · Velocidad · Calidad · Constancia · Maestría · Producción · Gremio · Resiliencia (named Constancia/Resiliencia, not Consistencia/Temple); the chips carry no icon.

### FRD-10#U3 · drawn · `achievements-trophies`, `achievements-summary`

> - The Hall SHALL show **Seals** (meta-trophies): one per axis, unlocked when **all** that axis's trophies are earned, plus a **Grand Seal** when all 8 Seals are held. A Seal is derived purely from the unlocked-set of its axis (no new signal).

**Prototype:** "Sellos 0 de 9": one per axis ("Descubrimiento · 7/11" …) plus "Todos los sellos · 0/8", each with a progress bar; summary card "Sellos del gremio".

### FRD-10#U4 · not drawn · `achievements-trophies`

> - A trophy unlocked within the last **7 days** SHALL show a **NUEVO** badge, derived from its real unlock `date` vs the server clock (no fabrication).

**Prototype:** No per-trophy NUEVO badge. The only "Nuevo" chip is on Inicio's last-achievement card when fresh (not fresh in this capture).

### FRD-10#U5 · drawn · `achievements-missions`

> - Cumulative chains SHALL be **grouped into sagas** (narrative section headers) on the Misiones tab.

**Prototype:** Saga headings with icon, hairline and count ("5 misiones", "4 misiones", "3 misiones"); saga names (La Construcción, Las Ideas, El Oficio, El Gremio, El Tiempo) come from the app data.

### FRD-10#U6 · behaviour only · `achievements-stats`

> - **Honesty (non-negotiable):** every trophy/chain/secret SHALL be **derived from a verifiable real signal** (idea cards · project statuses · the real event vocabulary in `docs/achievements.md` §1). A condition with **no real signal** SHALL NOT ship as a trophy (recorded under "pending emitter" instead) — no dormant/smoke trophies. The events reader SHALL **fail loud** (DR-078) on an unrecognised enriched shape, never silently drop it.

**Prototype:** Honesty contract: counters never recorded show "sin datos aún" instead of 0 (drawn).

### FRD-10#U7 · partial · `achievements-summary`, `achievements-missions`, `achievements-trophies`, `achievements-stats`, `achievements-ranks`

> - It SHALL present a **5-tab layout** (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**), each tab a chip with **its icon** and, where applicable, **a count** (Misiones = chains in progress; Trofeos = unlocked trophies) — prototype `logrosTabs` (the Rangos tab is the new guild-rank-ladder surface, FRD-09).

**Prototype:** Five tabs Resumen · Misiones · Trofeos (count of unlocked) · Estadísticas · Rangos, each with an icon; only Trofeos carries a count (Misiones has none).

### FRD-10#U8 · partial · `achievements-ranks`, `guild-rank-ladder`

> - The **Rangos** tab SHALL show the **40-rung guild rank ladder** (FRD-09) as an **enriched, era-sectioned vertical climb** (UI/UX research 2026-06-25: for an ordered 40-tier ladder a list beats a grid — it preserves the climb metaphor — and the row's horizontal space is filled with metadata rather than abandoned for cards). The 40 ranks are grouped into **6 narrative "eras"** (El despertar · Los portadores · Los guardianes · Los campeones · Los ascendidos · La trascendencia), each with a section header + level range. **Each rank row** shows a **LARGE pixel-art emblem** (≈88px; 104px for the current rank — the art is the hero, the owner's request) with its **grade badge** (I·II·III), the Spanish name, a **one-line RPG flavor caption**, the **level band** `Nv min–max` (open-ended `Nv N+` at the top), the **XP threshold** ("Inicio" / "1.040 XP"), and a **state marker with an icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N`) — never color alone (WCAG 1.4.1). The **current rank** is highlighted (accent glow + a bar of progress to the NEXT rank); ranks already earned read as done; ranks ahead are dimmed/locked (fading toward the summit, opacity floored at 0.5 so the icon+text cues stay legible). The **summit** (rank 40) gets a distinct, centered full-width treatment ("LA CIMA", larger emblem, warn-colored frame) so the top reads as a destination. The rank is the BAND that contains the guild's granular level (FRD-09 `rankForLevel`), not a 1:1 level.

**Prototype:** Era-sectioned climb with emblem (56 px, not 88/104), grade badge, Spanish name, flavour caption, "Nv a–b", XP, state marker (Conseguido / Estás aquí / 🔒 Nv N), current rank with progress bar. The distinct "LA CIMA" summit treatment is NOT drawn.

### FRD-10#U9 · partial · `achievements-summary`

> - The **GuildHero character-sheet** (level shield · guild title · XP bar · TU PARTY roster · record badges) SHALL live **inside the Resumen tab** (below the tabs), NOT as a persistent header across tabs — the always-visible guild level is the header GuildBar (FRD-09). Prototype `logrosResumen = hero + questsNear + recentTrophies`. (Decision 2026-06-25, red-team: a persistent hero duplicates the header GuildBar.)

**Prototype:** The guild hero (crest, "Gremio Pandacorp · nivel 22", rank, XP bar, three counts) sits ABOVE the tabs and shows on every tab. "TU PARTY" roster and record badges are NOT drawn.

### FRD-10#U10 · partial · `achievements-summary`

> - The hero summary SHALL count **hazañas = tiers reached (Σ currentTierIndex+1 across chains) + unlocked trophies**, and **misiones en curso = chains with a next tier** (prototype `logrosCounts`).

**Prototype:** Hero counts are "18/82 trofeos", "0/18 secretos", "N/M niveles de misión" (tiers reached); "hazañas" and "misiones en curso" are not shown by those names.

### FRD-10#U11 · partial · `achievements-summary`, `achievements-ranks`

> - The XP bar SHALL show the **XP total on the left** and **"faltan N para Nv X · &lt;nextRank&gt;" on the right**, both above the bar (prototype `logrosHero`).

**Prototype:** XP total and "25 para el nivel 23" sit under the title with a bar; "Faltan 450 XP para Guardián del Juramento I" sits in "Tu siguiente rango" and on the current rank row.

### FRD-10#U12 · partial · `achievements-missions`

> - Each **cumulative chain card** SHALL show the **current tier's fun name** as its title (chain name as subtitle), a **rarity badge** (Común → Leyenda — never metal names), a **tier-colored** bar (reusing CMP-09-xp-bar's fillColor), a **node ladder** of the tiers, a **goal row** "→ &lt;next&gt; · valor / umbral" (lower-is-better: "récord Nd → ≤Md"), and on completion the **"Cadena legendaria completada"** crown. **All chain cards SHALL share one standardized layout** (no per-card divergence): the progress bar is ALWAYS present (a completed chain shows a full 100% bar, never a missing bar) and every card ends in the **same uniform footer slot** — the latest dated unlock (`date · project`) when one exists, else an honest fallback (the cumulative value / record), so a card never shows a date while its neighbour shows nothing.

**Prototype:** Mission card: tier name as title, chain as subtitle ("· menos es mejor" when lower is better), rarity chip (or "Sin tier"), node ladder, goal row "→ next / value / threshold", bar with role=progressbar, footer "N acumulado". The completed-chain crown "Cadena legendaria completada" and the "date · project" footer are NOT drawn (completed chains read "cadena completa").

### FRD-10#U13 · drawn · `achievements-stats`

> - It SHALL show a **statistics panel** (counters that only grow), comprising exactly these stats: products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs written, ADRs registered, agents coordinated, record streak (weeks), and record idea→launch (days). These SHALL be presented as the character sheet — a radar of guild attributes, the record/hero stats (products shipped · record streak · record idea→launch) and the per-category ledger (Production · Quality · Pace & reach).

**Prototype:** Character sheet: Atributos del gremio radar, six record tiles and the three ledgers Producción / Calidad / Ritmo y alcance with all twelve stats.

### FRD-10#U14 · drawn · `achievements-stats`

> - Each metric in the Estadísticas tab SHALL show an **unbounded "Nv N" level** (FRD-09, `metricLevel`) that **keeps climbing with the value — never capped at 5** and no rarity names (Común→Leyenda): the level counts the metric's defined milestones crossed, then extends ≈1.6× beyond the last. The level is shown as a `Nv N` chip + a band-colored pip (5 hues) on hero tiles and ledger rows; 0 → "sin nivel". (The rarity-named, 5-tier chains remain the **Misiones** lens; Estadísticas is the numeric character-sheet lens.)

**Prototype:** "Nv N" chips on hero tiles and ledger rows (Nv 1, Nv 2 …); 0 renders "sin datos aún" or a dim row.

### FRD-10#U15 · drawn · `achievements-missions`

> - It SHALL show **cumulative chains** that **tier up** through the 5 tiers (**Común → Poco común → Raro → Épico → Leyenda**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.

**Prototype:** Chains tier up through Común → Poco común → Raro → Épico → Leyenda with a progress bar to the next tier and the next tier's name.

### FRD-10#U16 · not drawn · `achievements-missions`

> - EACH unlocked tier SHALL store and show the **date** and **project** where it happened.

**Prototype:** Mission cards show no date or project per unlocked tier (dates appear on trophies only).

### FRD-10#U17 · drawn · `achievements-summary`, `achievements-missions`

> - It SHALL show an **"Almost there"** section with the chains closest to their next tier (Zeigarnik effect).

**Prototype:** "Casi lo tienes" card (closest chains with value/threshold and bar) and the "A un paso de subir" spotlight card on Misiones.

### FRD-10#U18 · partial · `achievements-trophies`, `achievements-trophy-category`, `achievements-trophy-dialog`

> - It SHALL show **unique achievements** (one-time only) grouped **by state** — **Conquistados** (unlocked) then **Por conquistar** (locked, compact lockchips with a hover-reveal of the unlock condition) — with the **eight axes** (Discovery, Speed, Quality, Consistency, Mastery, Production, Guild, Resilience — v2) offered as **filter chips** (not as a second grouping axis), with date + project when unlocked, and the condition + rarity when locked. (Matches the prototype `logrosTrofeos`; the earlier by-category grouping made every locked card look identical and diverged from the design.)

**Prototype:** "Conquistados" (gold cards with date · project and rarity), "Los más alcanzables", "Por conquistar" (compact cards with condition and rarity, 12 at a time) and category filter chips. Locked cards open a dialog on click; the hover-reveal lockchip is not drawn.

### FRD-10#U19 · partial · `achievements-trophies`

> - It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, it SHALL **reveal its criterion** (what triggered it), never remain an obscure loot-box-style mechanic.

**Prototype:** "Secretos 0 de 18": silhouette tiles "?" with the cryptic hint; the revealed criterion after unlocking is not captured (none unlocked).

### FRD-10#U20 · behaviour only · `achievements-missions`

> - The chains and progress bars SHALL apply **honest endowed progress**: start by showing the progress **already achieved** (not at zero) — it speeds up completion (Zeigarnik effect) and is honest because it corresponds to real work. No notifications or nagging reminders.

**Prototype:** Honest endowed progress: bars start from the real accumulated value ("84% hacia El fordismo digital").

### FRD-10#U21 · behaviour only · `achievements-missions`

> - The names SHALL be fun and scale in grandeur by tier (e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle).

**Prototype:** Fun names scale by tier: data.

### AC-10-020.1 · drawn · `achievements-stats`

> - **AC-10-020.1** — WHEN the Informe renders THE system SHALL show a one-sentence **verdict** computed by
>   deterministic rules from the real figures (e.g. WO-verified trend, active-project count, conversion);
>   the rule inputs SHALL all be wired real values, and the rule SHALL be a pure function of them (same
>   inputs → same sentence) — no fabricated adjectives.

**Prototype:** "El pulso de la fábrica" verdict sentence.

### AC-10-020.2 · drawn · `achievements-stats`

> - **AC-10-020.2** — THE KPI row SHALL show, each from its real source: **WO verified / week** (this week,
>   with the **delta** vs the previous week, from the git-derived series, `IF-10-flow-series`); **active
>   projects (WIP)** = projects whose `phase` is between `design` and `release` exclusive of terminal,
>   from `readStatus` (`IF-10-funnel`); **idea→launched conversion** = shipped ÷ total ideas, from
>   `readIdeas`+`readStatus`.

**Prototype:** KPI row: "Work orders verificados / semana 2 últ. sem ↗ 2 vs 2 la previa", "Proyectos activos 4 en curso", "Conversión 5% idea→lanzado · 1 lanzada de 22".

### AC-10-020.3 · drawn · `achievements-stats`

> - **AC-10-020.3** — THE **idea→release lead time** KPI SHALL render as **"—" with a "no cableado" label**
>   (NOT a zero) because `readIdeas` does not yet parse a per-idea `created` timestamp tying an idea to its
>   launch — IF and when that field is wired THEN it SHALL show real days. (Bidirectional edge: this is the
>   primary "no cableado" path of the band.)

**Prototype:** "Lead time — idea→release · no cableado".

### AC-10-021.1 · drawn · `achievements-stats`

> - **AC-10-021.1** — THE system SHALL show a **WO-verified-per-week** series grouped by **ISO week**,
>   where each WO's week is the **git commit where its `implementation_status` crosses to `VERIFIED`** (read
>   from the git history of each `work-orders/wo-*.md`, `IF-10-flow-series`), matching the verified real
>   shape **W25=78, W26=8, W27=5 (91 total)**.

**Prototype:** Column chart "Work orders verificados por semana" (sem 25 … sem 39) with the peak sentence.

### AC-10-021.2 · drawn · `achievements-stats`

> - **AC-10-021.2** — THE system SHALL show an **ideas-captured-per-week** series from the **`created`**
>   frontmatter of `factory/ideas/*.md` grouped by ISO week (`IF-10-flow-series`), matching the verified
>   real shape **W24=3, W26=15**. IF an idea card has no `created` frontmatter THEN it SHALL be excluded
>   from the per-week series (and that exclusion SHALL be observable, not silently zeroed).

**Prototype:** Line chart "Ideas capturadas por semana" (sem 24 … sem 42); the observable exclusion of ideas without `created` is NOT drawn.

### AC-10-021.3 · drawn · `achievements-stats`

> - **AC-10-021.3** — THE Informe SHALL NOT render the old raw-event-count "en el tiempo" view (raw event
>   counts are noise); this requirement REPLACES it. (Negative AC.)

**Prototype:** No raw-event view exists.

### AC-10-022.1 · partial · `achievements-stats`

> - **AC-10-022.1** — THE system SHALL show the **most-used workflows/skills**, aggregated from the event
>   stream (`~/.claude/dashboard-events.ndjson`, `IF-10-usage`), matching the verified real shape
>   **deep-research 1494, pandacorp-build 850, audits/research ≈400** (top-N, descending).

**Prototype:** Only the empty message is captured: "Sin eventos de uso en el registro todavía: este bloque se llena cuando las skills emiten su evento." The populated top-N list is not drawn.

### AC-10-022.2 · partial · `achievements-stats`

> - **AC-10-022.2** — THE system SHALL show the **effort mix** (high / xhigh / max / medium) aggregated from
>   the event stream's `effort.level`, matching the verified real shape **high 1384, xhigh 937, max 700,
>   medium 3**.

**Prototype:** Only the empty message: "Sin registro de esfuerzo por agente todavía.".

### AC-10-022.3 · partial · `achievements-stats`

> - **AC-10-022.3** — IF the event stream is absent or unreadable THEN the band SHALL render its **"no
>   cableado" / error state** (fail-loud), NOT an empty or zeroed band.

**Prototype:** The same empty texts serve as the unwired state; a distinct unreadable-stream error is not drawn.

### AC-10-023.1 · drawn · `achievements-stats`

> - **AC-10-023.1** — THE system SHALL show the **ideas → launched funnel** from `readIdeas` + `readStatus`
>   (`IF-10-funnel`): total ideas (matching the verified real shape **18: discovered 6, in-pipeline 2,
>   discarded 10**) narrowing to launched (**1**), with the conversion **≈ 6 %**.

**Prototype:** Funnel "22 capturadas · 10 vivas · 4 en pipeline · 1 lanzada" with the conversion sentence.

### AC-10-023.2 · drawn · `achievements-stats`

> - **AC-10-023.2** — THE system SHALL show **phase transitions PER PROJECT** read from the **git history of
>   the `phase` field in each `.pandacorp/status.yaml`** (`IF-10-phase-transitions`), labelling each row
>   with the **project name**, matching the verified real shape for `mission-control`: **06-16
>   architecture→implementation, 06-18 implementation→release, 06-19 release→implementation (flagged as a
>   REOPEN), 06-21 implementation→release**.

**Prototype:** "Transiciones de fase por proyecto": date, project, from → to, 10 at a time ("Mostrar 2 más · quedan 2").

### AC-10-023.3 · drawn · `achievements-stats`

> - **AC-10-023.3** — WHEN a transition goes **backwards** in the phase order (a reopen, e.g.
>   release→implementation) THE system SHALL **flag it as a reopening** (text + icon, never color alone).

**Prototype:** "Lanzamiento ↺ Construcción" plus an amber "Reapertura" chip.

### AC-10-024.1 · drawn · `achievements-stats`

> - **AC-10-024.1** — THE left column SHALL list **projects by phase** from `readStatus` (`IF-10-funnel`),
>   matching the verified real shape **mission-control → release, personal-page-v2 → design**.

**Prototype:** "Proyectos por estado" list with phase chips.

### AC-10-024.2 · drawn · `achievements-stats`

> - **AC-10-024.2** — THE right column SHALL list **process signals** each from its real source:
>   **lessons distilled** (matching **2 / 131**, `IF-10-lessons`); **build relaunches** (from
>   `IF-10-phase-transitions` reopen count / signals); **discards without a structured reason** (idea cards
>   with `status: discarded` whose `discard_reason` is empty/freeform — itself a finding, from `readIdeas`);
>   **quality telemetry not wired** (rendered explicitly as **"no cableado"**, not a zero).

**Prototype:** "Señales del proceso": Lecciones destiladas x / y, Relanzamientos de build, Descartes sin razón estructurada, Telemetría de calidad "no cableado".

### AC-10-025.1 · drawn · `achievements-stats`

> - **AC-10-025.1** — THE system SHALL show a short list of **next-best-actions**, each derived by a
>   deterministic rule from the real figures and each carrying **its command** (e.g.
>   `/pandacorp:memory`, `/pandacorp:release`, `/pandacorp:recommend`); each action's trigger condition
>   SHALL be a pure function of wired real values (no fabricated suggestions).

**Prototype:** "Qué mover ahora · La conclusión, con su comando": the action text and `/pandacorp:release` with copy.

### AC-10-026.1 · drawn · `achievements-stats`

> - **AC-10-026.1** — THE per-category ledger SHALL show **exactly 8 rows in each of the three columns** so
>   the columns align (no staircase). **Producción** gains **FRDs completed (21), Commits (823), Projects
>   created (2)**; **Calidad** gains **Tests passing (7134), Decisions/DR (99)**. Each new row's value
>   SHALL come from its real source (`IF-10-scalars` for the git/doc counts; `readIdeas`/`readStatus` for
>   the rest).

**Prototype:** Three ledgers with eight rows each; Producción has FRDs completados, Commits, Proyectos creados; Calidad has Tests en verde, Decisiones (DR).

### AC-10-026.2 · partial · `achievements-stats`

> - **AC-10-026.2** — Each new ledger value SHALL be a real count (or **"—" / "no cableado"** when its
>   source is not wired) — never a fabricated number.

**Prototype:** Missing values show "sin datos aún" (event counters) or "no cableado" (scalars); the explanatory line "«Sin datos aún»: la fábrica todavía no registra ese tipo de evento…" is drawn.

### AC-10-027.1 · drawn · `achievements-stats`

> - **AC-10-027.1** — THE records block (right of Atributos) SHALL show a **2×3 grid of 6 records**, adding
>   to the existing 3: **Peak week** (the WO count of the best week, **78**, from `IF-10-flow-series`);
>   **Lessons captured** (**131**, from `IF-10-lessons`); **Subagents coordinated** (from
>   `signals.subagents`). Each record SHALL come from its real source; an unwired record SHALL render
>   **"—" / "no cableado"**, never a fabricated value.

**Prototype:** Six record tiles: Productos lanzados, Racha récord, Récord idea→launch, Pico semanal, Lecciones, Subagentes (unwired ones read "sin datos aún").

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `achievements-summary` | `#logros` | (none) | full page | `FRD-10#U3` `FRD-10#U7` `FRD-10#U9` `FRD-10#U10` `FRD-10#U11` `FRD-10#U17` |
| `achievements-missions` | `#logros?tab=Misiones` | (none) | full page | `FRD-10#U5` `FRD-10#U7` `FRD-10#U12` `FRD-10#U15` `FRD-10#U16` `FRD-10#U17` `FRD-10#U20` `FRD-10#U21` |
| `achievements-trophies` | `#logros?tab=Trofeos` | (none) | full page | `FRD-10#U1` `FRD-10#U2` `FRD-10#U3` `FRD-10#U4` `FRD-10#U7` `FRD-10#U18` `FRD-10#U19` |
| `achievements-trophy-category` | `#logros?tab=Trofeos` | click `[data-trophy-cat="Speed"]` | full page | `FRD-10#U2` `FRD-10#U18` |
| `achievements-trophy-dialog` | `#logros?tab=Trofeos` | click `[data-trophy]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-10#U1` `FRD-10#U18` |
| `achievements-stats` | `#logros?tab=Estad%C3%ADsticas` | (none) | full page | `FRD-10#U6` `FRD-10#U7` `FRD-10#U13` `FRD-10#U14` `AC-10-020.1` `AC-10-020.2` `AC-10-020.3` `AC-10-021.1` `AC-10-021.2` `AC-10-021.3` `AC-10-022.1` `AC-10-022.2` `AC-10-022.3` `AC-10-023.1` `AC-10-023.2` `AC-10-023.3` `AC-10-024.1` `AC-10-024.2` `AC-10-025.1` `AC-10-026.1` `AC-10-026.2` `AC-10-027.1` |
| `achievements-ranks` | `#logros?tab=Rangos` | (none) | full page | `FRD-10#U7` `FRD-10#U8` `FRD-10#U11` |

States cited above that belong to another FRD folder (captured there, reused here): `guild-rank-ladder`.

**Not drawn (2)**: `FRD-10#U4`, `FRD-10#U16`.

**Partially drawn (14)**: `FRD-10#U1`, `FRD-10#U2`, `FRD-10#U7`, `FRD-10#U8`, `FRD-10#U9`, `FRD-10#U10`, `FRD-10#U11`, `FRD-10#U12`, `FRD-10#U18`, `FRD-10#U19`, `AC-10-022.1`, `AC-10-022.2`, `AC-10-022.3`, `AC-10-026.2`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- El progreso que ha construido tu gremio, con la evidencia detrás.
- Gremio Pandacorp · nivel 22
- 2410 XP · 25 para el nivel 23
- niveles de misión
- Ver secciones anteriores
- Ver más secciones
- Secciones de logros
- Misiones
- Trofeos 18
- Rangos
- Común

### `achievements-summary`

- [h2] Casi lo tienes
- [p] Work orders completados · La Construcción
- [p] Ideas descartadas · Las Ideas
- [p] Ideas capturadas · Las Ideas
- [h2] Sellos del gremio
- [div] Descubrimiento
- [div] Maestría
- [div] Resiliencia
- [div] Todos los sellos
- [h2] Tu siguiente rango
- [span] ahora · Nv 22
- [span] desde Nv 25
- [@aria-label] XP hacia Guardián del Juramento I
- [p] Faltan 450 XP. Se gana XP construyendo: cada work order verificada, fase completada y lanzamiento suma.
- [a] Ver el escalafón
- [h2] Trofeos recientes
- [span] 6 oct. 2026
- [h2] Atributos del gremio
- [p] Tu forma como gremio: ideación es lo más fuerte; velocidad, calidad, constancia aún sin datos.
- [a] Ver todas las estadísticas

### `achievements-missions`

- [p] Misiones acumulativas, agrupadas por saga: cada tier alcanzado deja huella verificable en el tiempo.
- [span] A un paso de subir
- [@aria-label] Work orders completados: 84% hacia El fordismo digital
- [p] 176 acumulado (×6 of the same pattern)
- [span] 5 misiones (×3 of the same pattern)
- [@aria-label] Fases completadas: 0% hacia Flujo continuo
- [@aria-label] Productos lanzados: 0% hacia Maestro de obras
- [span] Sin tier
- [@aria-label] Builds completados: 0% hacia Primera corrida
- [@aria-label] Subagentes coordinados: 0% hacia Pequeña cuadrilla
- [@aria-label] Ideas descartadas: 46% hacia Cirujano de ideas
- [@aria-label] Ideas capturadas: 6% hacia El ideólogo
- [@aria-label] PRDs / specs: 0% hacia El PM fantasma
- [@aria-label] ADRs / blueprints: 0% hacia El libro de la fábrica
- [@aria-label] Lanzamientos impecables: 0% hacia Primera vez sin reparos
- [@aria-label] Gates verdes: 0% hacia Primer visto bueno
- [@aria-label] Reviews aprobadas: 0% hacia Primera aprobación
- [@aria-label] Hallazgos atendidos: 0% hacia Primer hallazgo
- [@aria-label] Agentes coordinados: 0% hacia Equipo mínimo
- [@aria-label] Modos de build usados: 0% hacia Un modo
- [@aria-label] Relanzamientos sobrevividos: 0% hacia De vuelta a la carga
- [@aria-label] Racha récord (semanas): 0% hacia Semanas seguidas
- [@aria-label] Días activos: 0% hacia Primeros pasos
- [span] Récord idea→launch (días) · menos es mejor
- [@aria-label] Récord idea→launch (días): 0% hacia Sprint decente

### `achievements-trophies`

- [b] 18 / 82 trofeos conquistados
- [span] Sellos
- [span] 0 de 9 (×3 of the same pattern)
- [span] Descubrimiento · 7/11
- [span] Velocidad · 0/10
- [span] Calidad · 0/10
- [span] Constancia · 0/10
- [span] Maestría · 5/10
- [span] Producción · 6/14
- [span] Gremio · 0/9
- [span] Resiliencia · 0/8
- [span] Todos los sellos · 0/8
- [@aria-label] Categoría
- [button] Todos 82
- [button] Descubrimiento 11
- [button] Velocidad 10
- [button] Calidad 10
- [button] Constancia 10
- [button] Maestría 10
- [button] Producción 14
- [button] Gremio 9
- [button] Resiliencia 8
- [span] Conquistados
- [span] 6 oct. 2026 · PersonalPage v2
- [span] Raro
- [span] Los más alcanzables
- [p] Los de rareza más baja, uno por categoría: los primeros que conviene perseguir.
- [span] Común · Descubrimiento
- [span] Común · Velocidad
- [span] Común · Calidad
- [span] Común · Constancia
- [span] Común · Gremio
- [span] Poco común · Producción
- [span] Por conquistar
- [button] Mostrar 24 más · quedan 46
- [span] ?

### `achievements-trophy-category`

- [span] Ningún trofeo conquistado en esta categoría.
- [span] 3 de 10
- [p] Los de rareza más baja: los primeros que conviene perseguir.
- [span] Poco común · Velocidad
- [span] Épico

### `achievements-trophy-dialog`

- [dlg span] Desbloqueado 6 oct. 2026
- [dlg p] Proyecto: PersonalPage v2

### `achievements-stats`

- [span] Resumen ejecutivo
- [span] El pulso de la fábrica
- [span] Work orders verificados / semana
- [b] 2 últ. sem
- [span] ↗ 2 vs 2 la previa
- [span] Proyectos activos
- [b] 4 en curso
- [span] Conversión
- [b] 5% idea→lanzado
- [span] 1 lanzada de 22
- [span] Lead time
- [b] — idea→release
- [span] no cableado
- [h3] Atributos del gremio
- [text] Constancia
- [text] Ideación
- [span] Nv 1 (×2 of the same pattern)
- [span] tu marca del gremio
- [span] Pico semanal
- [span] work orders en la mejor semana
- [span] capturadas en memoria
- [p] «Sin datos aún»: la fábrica todavía no registra ese tipo de evento (gates, reviews, días activos…). No es un cero medido.
- [span] FRDs completados
- [span] Proyectos creados
- [span] Tests en verde
- [span] Decisiones (DR)
- [h3] Ritmo y alcance
- [span] En el tiempo, de verdad
- [span] ¿Cómo voy semana a semana?
- [h3] Work orders verificados por semana
- [@aria-label] sem 25: 76 work orders, sem 26: 10 work orders, sem 27: 11 work orders, sem 28: 8 work orders, sem 36: 2 work orders, sem 39: 2 work orders
- [span] sem 25 (×8 of the same pattern)
- [p] Pico de 76 en una semana; la última semana con datos cerró 2.
- [h3] Ideas capturadas por semana
- [p] Las ideas llegan a ráfagas, no de forma continua.
- [span] Cómo usas la fábrica
- [span] ¿En qué me apoyo y a qué coste?
- [h3] Workflows y skills más usados
- [p] Sin eventos de uso en el registro todavía: este bloque se llena cuando las skills emiten su evento.
- [h3] Esfuerzo de los agentes
- [p] Sin registro de esfuerzo por agente todavía.
- [span] Embudo y flujo
- [span] ¿Dónde se atascan las ideas y los proyectos?
- [h3] Embudo ideas → lanzado
- [span] 22 capturadas
- [span] 10 vivas
- [span] 4 en pipeline
- [span] 1 lanzada
- [p] El cuello está en decidir y arrancar: pocas ideas entran al pipeline.
- [h3] Transiciones de fase por proyecto
- [span] 18 jun. 2026 (×5 of the same pattern)
- [span] Construcción → Lanzamiento
- [span] Lanzamiento ↺ Construcción
- [span] Reapertura
- [span] 6 jul. 2026 (×2 of the same pattern)
- [span] 3 set. 2026
- [span] Producto → Diseño
- [span] Diseño → Arquitectura
- [button] Mostrar 2 más · quedan 2
- [span] Estado y salud del proceso
- [span] ¿Qué proyectos hay y qué señales vigilar?
- [h3] Proyectos por estado
- [h3] Señales del proceso
- [span] Lecciones destiladas
- [span] Relanzamientos de build
- [span] Descartes sin razón estructurada
- [span] Telemetría de calidad
- [span] Qué mover ahora
- [span] La conclusión, con su comando
- [code] /pandacorp: release
- [@aria-label] Copiar /pandacorp:release

### `achievements-ranks`

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

- Axes "Consistencia · Temple" | "Constancia · Resiliencia" (achievements-trophies).
- "Seals" / "Grand Seal" | "Sellos" / "Todos los sellos".
- "Almost there" | "Casi lo tienes".
- "NUEVO" | absent on trophies; "Nuevo" gold chip only on Inicio's last-achievement card.
- "faltan N para Nv X · <nextRank>" | "25 para el nivel 23" (hero) and "Faltan 450 XP para Guardián del Juramento I" (next rank card).
- Stats wording "no cableado" | "no cableado" (kept) and "sin datos aún" (new, iteration 18).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- FRD-10 puts the GuildHero inside Resumen and forbids a persistent header; the prototype shows the hero above all five tabs.
- Rank row emblem 88/104 px and the summit treatment (U8) vs 56 px and no summit treatment.
- Per-tier date · project (U16), NUEVO badge (U4), estimated-rarity blurb (U1), chain-complete crown (U12) are FRD wants without a drawn counterpart.
- The Informe design anchor `docs/design/prototype/informe-del-gremio.html` (visual_source_informe) is superseded by the Estadísticas tab of the new prototype.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 16: Logros follows the app's organization — Misiones one card per chain grouped by saga, Trofeos with seals then Conquistados / Por conquistar / Secretos, Estadísticas as the operator report drawn as charts (radar, record tiles, three ledgers, weekly columns, ideas line, funnel, phase transitions), Rangos with the 40 ranks in six eras.
- Iteration 17: balanced Resumen (two right-hand cards); Rangos collapses far eras.
- Iteration 18 (owner picked all four): Misiones sorted by closeness to next tier (zero-progress last, muted); "Los más alcanzables" section; "sin datos aún" for never-recorded counters; Gremio card on Inicio with latest achievement and gold notice.
- Iteration 26: untouched missions are compact rows on phones; trophies to conquer show 12 at a time; phase transitions show 10 at a time as two-line cards; ranks put the emblem on the left; radar labels no longer clip.
- Iteration 28: gold = category colour for mission progress, near trophies and the radar; Pulso and data-model sections use non-status hues; the statistics band heading became the shared section heading.
- 2026-10-21 language rule: rarity names and labels are Spanish; trophy/mission names come from the app data.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
