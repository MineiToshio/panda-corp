# Pandacorp achievements and stats

Design of the Achievements Hall (FRD-10). Each achievement stores the **date** and **project**
where it happened, and is **derived from a verifiable signal** — never fabricated (the honesty
contract, blueprint §2 / §5). The factory reads its own portfolio, idea base and event stream;
nothing here is hand-set or simulated.

> **v2 (2026-06-29) — "La página épica".** The catalogue is expanded to ~80 trophies across **8
> axes**, ~21 cumulative missions grouped in **sagas**, and ~18 **secrets** (each with a visible
> hint). Per-trophy **rarity** (Común→Leyenda) and category **Seals** (platinum-equivalent) are
> added. Crucially, **every unlock is re-anchored to the REAL event vocabulary the factory emits**
> (see §1) — the v1 catalogue read an `achievement`/`task=…` event that **nothing ever emitted**,
> so most trophies were dormant forever. See decision-log 2026-06-29.

---

## § 1. The real signal vocabulary (the honesty source of truth)

Every achievement derives from one of three already-read sources (`ReaderData`): the **idea cards**,
the **project statuses**, and the **event stream** (`~/.claude/dashboard-events.ndjson`). The event
stream's REAL vocabulary (verified against the live file) is the binding constraint — a trophy may
only exist if it can be computed from these:

| Source | Field | What it tells us |
|---|---|---|
| **ideas[]** | `status` | discovered · recommended · in-pipeline · shipped · discarded |
| | `score`, `favorite`, `slug`, `title` | idea quality / pin / identity (no date field — never fabricate a date) |
| **statuses[]** (per project) | `phase` | product · design · architecture · implementation · release |
| **work-order files** (per project) | `listWorkOrders(path)` (live) | build volume — derived live from the `wo-*.md` files (DR-092/DR-115), never `status.yaml`'s cached `workOrdersDone`/`Total` (dead fields) |
| | `deployTarget`, `deployUrl`, `targetPlatforms`, `version`, `updatedAt`, `repo` | launch facts |
| **events[]** `AgentDone` | `data.role`, `data.wo`, `data.result:"green"` | a work order closed green, by which role |
| `AgentWorking` | `data.role`, `data.wo` | which roles/agents are active on which WOs |
| `ReviewVerdict` | `data.role`, `data.wo`, `data.verdict:"APPROVED"` | a per-WO review verdict |
| `GateResult` | `data.frd`, `data.wo`, `data.verdict:"PASS"`, `data.mode` | an FRD review gate passed |
| `GateVerdict` | `data.frd`, `data.wo`, `data.verdict:"PASS"\|"REJECT"`, `data.reopen_count`, `data.reason`, `data.mode` | gate pass/reject + how many reopens |
| `AgentFinding` | `data.role`, `data.wo`, `data.verdict`, `data.blocking`, `data.important` | review findings (severity counts) |
| `BuildLaunch` | `data.mode` (pro·balanced·powerful·deep), `data.maxAgents`, `data.pending_wos` | a build started, in which mode, how big |
| `BuildComplete` | `data.wos` ("78/78"), `data.frds`, `data.phase`, `data.last_green` | a full build finished |
| `BuildRelaunch` | `data.reason`, `data.mode` | a build recovered/resumed after an interruption |
| `SubagentStop` | `data.agent_type`, `data.effort.level` (low…xhigh), `data.cwd`, `data.background_tasks[]` | a subagent finished; its effort tier; which project |
| `SupervisorTick` | (heartbeat) | the supervisor is watching a live build |
| all events | `at` (ISO 8601) | the real timestamp — powers time-of-day / streak / marathon trophies |

**Reader extension required (foundational WO).** The current `lib/events/events.ts` only surfaces a
fixed subset of `data.*`. v2 needs `verdict`, `result`, `reopenCount`, `blocking`, `important`,
`agentType`, `effort`, `maxAgents`, `wos`/`frds` (BuildComplete) and `reason` surfaced too —
**fail-loud parse** (DR-078): a recognised event with an unparseable enriched shape is an explicit
error, never a silent drop that dark-renders a trophy.

**Cumulative-counter caveat.** `readEvents()` defaults to a 200-event tail. "Only-grow" counters
(total WOs closed, total builds, distinct roles ever) must read the **full** stream so a trophy
earned long ago doesn't un-earn as the stream grows. The achievements engine reads uncapped; the
guild-level engine keeps its tail (FRD-09 unchanged).

**The hard rule:** if an idea cannot be tied to a real signal above, it does **not** become a trophy
(no "smoke"). A handful of evocative trophies that need a NEW emitter are listed in §8 as *pending
emitter* — explicitly out of the live catalogue, never shipped as dormant.

---

## § 2. Rarity model (per-trophy) + Seals

Two distinct axes (do not conflate — see FRD-10 "Tier vs rarity"):

- **Chain tier** = where a *mission* currently sits (Común→Leyenda, §6). Property of a chain.
- **Trophy rarity** = how hard an *individual* trophy is to earn. A per-trophy attribute, shown as a
  colored gem/border reusing `tiers.ts` colors. Five grades, a **pyramid** (PlayStation-style: many
  common, few legendary):

| Rarity | Color token | ~Share | Meaning |
|---|---|---|---|
| **Común** | `--color-tier-1` | ~40% | first steps / routine results |
| **Poco común** | `--color-tier-2` | ~25% | takes some deliberate effort |
| **Raro** | `--color-tier-3` | ~17% | a notable, non-trivial feat |
| **Épico** | `--color-tier-4` | ~11% | hard; sustained excellence |
| **Leyenda** | `--color-tier-5` | ~6% | the apex; rarely seen |

**Seals (platinum-equivalent).** One **Seal** per axis, unlocked by earning **every** trophy in that
axis. A Seal is a Leyenda-grade meta-trophy (titled, displayable). 8 axes → 8 Seals. A 9th **Grand
Seal** ("El Gran Sello del Gremio") unlocks when all 8 Seals are held.

**Estimated rarity (display).** Each trophy shows an estimated-rarity blurb derived from its grade
("logro de leyenda — pocos lo alcanzan"). Single-owner tool, so it is a *difficulty* label, not a
population %.

**"NUEVO" badge.** A trophy unlocked within the last **7 days** (real `date` vs the server clock)
shows a NUEVO pip. Honest: derived from the real unlock date, no fabrication.

---

## § 3. The 8 axes (trophies)

Display names are Spanish UI copy (i18n), matching the existing RPG tone. Each row: **name** ·
*(rarity)* · the **real signal** it derives from. ✦ = buildable with TODAY's signals; ⧖ = needs the
reader extension in §1 (still real data, just not yet surfaced).

### Axis 1 — Descubrimiento (Discovery) · first-times
*Seal: "El Cartógrafo" — todos los descubrimientos.*

1. **El primer ladrillo** · *Común* · ✦ first project exists in the portfolio.
2. **El primer spec** · *Común* · ✦ any project reached `phase ≥ design` (a PRD/spec exists).
3. **El debut del diseñador** · *Común* · ✦ any project reached `phase ≥ design`.
4. **El blueprintero** · *Poco común* · ✦ any project reached `phase ≥ architecture`.
5. **La primera orden** · *Común* · ⧖ first `AgentDone result=green` (first WO ever closed).
6. **El primer veredicto** · *Poco común* · ⧖ first `ReviewVerdict APPROVED`.
7. **El gran tour** · *Raro* · ✦ a project reached `phase=release` (all phases traversed).
8. **El día del lanzamiento** · *Raro* · ✦ first project at `phase=release`.
9. **Iteración cero** · *Poco común* · ✦ a shipped project went back to `implementation` (re-opened).
10. **El primer enjambre** · *Poco común* · ⧖ first `BuildLaunch` (a build engine run started).
11. **Memoria de la fábrica** · *Raro* · ✦ first ADR/blueprint exists (project at `phase ≥ architecture`).

### Axis 2 — Velocidad (Speed) · turnaround & throughput bursts
*Seal: "El Rayo" — toda la velocidad.*

1. **Sprint decente** · *Común* · ✦ a project went idea→`release` within 30 days (`updatedAt`–first-seen).
2. **El cohete** · *Raro* · ✦ idea→`release` within 14 days.
3. **La semana perfecta** · *Épico* · ✦ idea→`release` within 7 days.
4. **Modo dios activado** · *Leyenda* · ✦ idea→`release` within 3 days.
5. **48 horas de locura** · *Épico* · ✦ idea→`release` within 48h.
6. **La maratón** · *Raro* · ⧖ 20+ `AgentDone green` within a 24h window.
7. **El sprint relámpago** · *Poco común* · ⧖ 10+ `AgentDone green` within a 24h window.
8. **Build en un día** · *Raro* · ⧖ a `BuildLaunch` and its `BuildComplete` on the same UTC day.
9. **Sin frenos** · *Poco común* · ⧖ 3+ WOs closed green within a single hour.
10. **El primer impulso** · *Común* · ⧖ 5+ `AgentDone green` total (the throughput tutorial).

### Axis 3 — Calidad (Quality) · flawless & zero-rejection
*Seal: "El Orfebre" — toda la calidad.*

1. **Primer intento** · *Raro* · ⧖ an FRD `GateResult PASS` with `reopen_count = 0`.
2. **El perfeccionista práctico** · *Épico* · ⧖ 3 consecutive `GateResult PASS` with no `REJECT` between.
3. **Sin una mancha** · *Poco común* · ⧖ a `ReviewVerdict APPROVED` on first submission (no prior REJECT for that WO).
4. **Pulcro** · *Común* · ⧖ first `GateResult PASS`.
5. **Cero hallazgos** · *Raro* · ⧖ an `AgentFinding` with `blocking = 0` and `important = 0`.
6. **Lanzamiento impecable** · *Épico* · ✦ a project reached `release` with a clean build (`BuildComplete wos = N/N`, no open rejects).
7. **El cirujano** · *Leyenda* · ⧖ 7 flawless gates (PASS, reopen 0) across the factory.
8. **Manos firmes** · *Raro* · ⧖ a whole FRD's WOs each passed their gate with reopen 0.
9. **Revisado y bendecido** · *Común* · ⧖ first `ReviewVerdict APPROVED`.
10. **Calidad sostenida** · *Épico* · ⧖ 25 `GateResult PASS` total.

### Axis 4 — Consistencia (Consistency) · streaks & cadence
*Seal: "El Inquebrantable" — toda la consistencia.*

1. **Semanas seguidas** · *Común* · ⧖ a 2-week streak (consecutive ISO weeks with ≥1 green WO).
2. **El constructor constante** · *Raro* · ⧖ an 8-week streak.
3. **Medio año sin parar** · *Épico* · ⧖ a 26-week streak.
4. **El año del fundador** · *Leyenda* · ⧖ a 52-week streak.
5. **El fundador madrugador** · *Poco común* · ⧖ a green WO with `at` before 08:00 (real timestamp).
6. **El último en apagar** · *Poco común* · ⧖ a green WO with `at` in the 00:00 hour (after midnight).
7. **Guerrero de fin de semana** · *Poco común* · ⧖ green WOs on a Saturday AND a Sunday.
8. **Cinco días de fuego** · *Raro* · ⧖ green WOs on 5 distinct days within one ISO week.
9. **El ritmo** · *Común* · ⧖ green WOs on 3 distinct days, ever.
10. **Nunca un lunes vacío** · *Raro* · ⧖ green WOs on 4 distinct Mondays.

### Axis 5 — Maestría (Mastery) · scope & ownership
*Seal: "El Maestro de la Fábrica" — toda la maestría.*

1. **La trilogía** · *Épico* · ✦ 3 projects at `release` simultaneously.
2. **El imperio** · *Leyenda* · ✦ 5 projects at `release` simultaneously.
3. **Coleccionista de estados** · *Poco común* · ✦ one project that passed through all 5 phases.
4. **Dos frentes** · *Raro* · ✦ 2 projects in `implementation` at once.
5. **El portafolio** · *Raro* · ✦ 5 distinct projects ever created.
6. **Maestro de obras** · *Raro* · ✦ 5 products shipped (cumulative).
7. **El arquitecto** · *Épico* · ✦ 10 products shipped.
8. **El magnate digital** · *Leyenda* · ✦ 25 products shipped.
9. **Interno y externo** · *Raro* · ✦ shipped both an `internal` and an `external` deploy target.
10. **Multiplataforma** · *Poco común* · ✦ shipped a `responsive` (or both desktop & mobile) target.

### Axis 6 — Producción (Production) · sheer cumulative output
*Seal: "La Gran Máquina" — toda la producción. (volume axis → mostly Común/Poco común)*

1. **Capataz novato** · *Común* · ⧖ 10 WOs closed green (cumulative).
2. **Jefe de fábrica** · *Poco común* · ⧖ 50 WOs closed green.
3. **El fordismo digital** · *Raro* · ⧖ 200 WOs closed green.
4. **Maestro de ensamblaje** · *Épico* · ⧖ 500 WOs closed green.
5. **La gran máquina** · *Leyenda* · ⧖ 1000 WOs closed green.
6. **Mente inquieta** · *Común* · ✦ 5 ideas captured.
7. **Máquina de ideas** · *Poco común* · ✦ 20 ideas captured.
8. **El ideólogo** · *Raro* · ✦ 50 ideas captured.
9. **Pipeline novato** · *Común* · ✦ 5 phases completed across projects.
10. **Flujo continuo** · *Poco común* · ✦ 25 phases completed.
11. **El editor** · *Común* · ✦ 5 ideas discarded (killing darlings is production too).
12. **El filtro implacable** · *Raro* · ✦ 50 ideas discarded.
13. **El enjambre** · *Poco común* · ⧖ 100 `SubagentStop` total (subagents spawned).
14. **El ejército** · *Raro* · ⧖ 1000 `SubagentStop` total.

### Axis 7 — Gremio (Guild) · coordination, roles & modes
*Seal: "El Titiritero" — todo el gremio.*

1. **Equipo mínimo** · *Común* · ⧖ 3 distinct roles seen in `AgentWorking`/`AgentDone`.
2. **El líder de raid** · *Poco común* · ⧖ 6 distinct roles coordinated.
3. **Comandante de fábrica** · *Raro* · ⧖ 10 distinct agents (`agent`/`role`) coordinated.
4. **La orquesta** · *Épico* · ⧖ all 6 build roles (pm·architect·backend·frontend·designer·reviewer) active.
5. **Probé todos los modos** · *Raro* · ⧖ `BuildLaunch` seen in all 4 modes (pro·balanced·powerful·deep).
6. **Modo profundo** · *Poco común* · ⧖ a `BuildLaunch mode=deep` (or a `SubagentStop effort=xhigh`).
7. **El general** · *Raro* · ⧖ a `BuildLaunch maxAgents ≥ 50`.
8. **Cien manos** · *Épico* · ⧖ a `BuildLaunch maxAgents ≥ 100`.
9. **El revisor incansable** · *Poco común* · ⧖ 10 `ReviewVerdict`/`GateResult` events (the reviewer pulled weight).
10. **Coro completo** · *Raro* · ⧖ 6 distinct roles each closed ≥1 green WO.

### Axis 8 — Temple (Resilience) · recovering from setbacks
*Seal: "El Ave Fénix" — todo el temple.*

1. **De vuelta a la carga** · *Poco común* · ⧖ a `BuildRelaunch` exists (a build resumed after interruption).
2. **El ave fénix** · *Raro* · ⧖ a build with 3+ `BuildRelaunch` that later `BuildComplete`s.
3. **La perseverancia** · *Raro* · ⧖ a WO with `reopen_count ≥ 3` that later passes its gate.
4. **No me rindo** · *Poco común* · ⧖ a `GateVerdict REJECT` for a WO that later `GateResult PASS`es.
5. **Curtido en mil batallas** · *Épico* · ⧖ 10 WOs that were rejected at least once then passed.
6. **El bombero** · *Poco común* · ⧖ an `AgentFinding blocking ≥ 1` whose WO later passed (fire put out).
7. **Maratón sin caídas** · *Raro* · ⧖ a build that completed without any `BuildRelaunch` and ≥40 WOs.
8. **El temple del acero** · *Leyenda* · ⧖ a project that shipped despite ≥5 reopened WOs along the way.

---

## § 4. Seals & the Grand Seal (meta-trophies)

| Seal | Unlocks when | Rarity |
|---|---|---|
| El Cartógrafo | all Descubrimiento trophies | Leyenda |
| El Rayo | all Velocidad trophies | Leyenda |
| El Orfebre | all Calidad trophies | Leyenda |
| El Inquebrantable | all Consistencia trophies | Leyenda |
| El Maestro de la Fábrica | all Maestría trophies | Leyenda |
| La Gran Máquina | all Producción trophies | Leyenda |
| El Titiritero | all Gremio trophies | Leyenda |
| El Ave Fénix | all Temple trophies | Leyenda |
| **El Gran Sello del Gremio** | **all 8 Seals held** | Leyenda (apex) |

A Seal is derived purely from the unlocked-set of its axis — no new signal needed.

---

## § 5. Secrets (~18, hidden with a cryptic hint until unlocked)

Each shows a **silhouette + cryptic hint** while locked; ON unlock it **reveals its criterion**
(never a permanent obscure loot-box). All derive from real signals (✦/⧖ as above). ~18 secrets
against ~80 visible trophies ≈ the ~20–30% hidden ratio the research recommends.

| # | Hint (always visible) | Criterion (revealed on unlock) | Signal |
|---|---|---|---|
| 1 | "Ves el vacío al otro lado." | Toda tu base de ideas está vacía o sin nada activo. | ✦ ideas all discarded/empty |
| 2 | "El código revisó al código." | Un agente revisor corrigió/aprobó el trabajo de otro agente. | ⧖ `ReviewVerdict` by a reviewer role |
| 3 | "Va más rápido de lo esperado." | Recorriste el pipeline completo en un solo día. | ⧖ design+arch+impl+release events same UTC day |
| 4 | "Renace de sus cenizas." | Un build se relanzó 3+ veces y aun así terminó. | ⧖ ≥3 `BuildRelaunch` then `BuildComplete` |
| 5 | "El que insiste, vence." | Un work order rechazado 3+ veces terminó aprobado. | ⧖ `reopen_count ≥ 3` then PASS |
| 6 | "Toda la orquesta tocó a la vez." | Los 6 roles del gremio estuvieron activos el mismo día. | ⧖ 6 roles with events same UTC day |
| 7 | "Esfuerzo máximo." | Un subagente corrió a esfuerzo 'xhigh'. | ⧖ `SubagentStop effort.level=xhigh` |
| 8 | "La hora de las brujas." | Cerraste trabajo entre las 3 y las 4 de la madrugada. | ⧖ green WO with `at` hour = 3 |
| 9 | "Un ejército de cien." | Lanzaste un build con 100 agentes. | ⧖ `BuildLaunch maxAgents = 100` |
| 10 | "El enjambre despertó." | 50+ subagentes terminaron en un solo día. | ⧖ ≥50 `SubagentStop` in one UTC day |
| 11 | "Nada que mostrar, todo por hacer." | Tienes ideas capturadas pero ningún proyecto aún. | ✦ ideas>0, zero projects in portfolio |
| 12 | "El favorito olvidado." | Marcaste una idea como favorita y luego la descartaste. | ✦ idea `favorite` + `status=discarded` |
| 13 | "Cuatro modos, un maestro." | Usaste los 4 modos de build alguna vez. | ⧖ all 4 `BuildLaunch.mode` seen |
| 14 | "Viernes de gloria." | Lanzaste a producción un viernes. | ⧖ `BuildComplete`/release `at` weekday = Fri |
| 15 | "Doble o nada." | Dos proyectos llegaron a release el mismo día. | ✦ 2 statuses at release with same `updatedAt` day |
| 16 | "El perfeccionista invisible." | Un FRD entero pasó su gate sin un solo reopen. | ⧖ all gate events of an FRD have reopen 0 |
| 17 | "Mil y una órdenes." | Cerraste 1001 work orders en total. | ⧖ 1001 `AgentDone green` |
| 18 | "El gremio al completo." | Conseguiste los 8 Sellos. | derived: all 8 Seals held |

---

## § 6. Missions (cumulative chains) — grouped in Sagas

Chains tier up **Común → Poco común → Raro → Épico → Leyenda** as their stat crosses each threshold,
storing date+project per tier. The **Estadísticas** tab shows the unbounded `Nv N` per metric
(FRD-09 `metricLevel`); the **Misiones** tab shows the 5-tier rarity lens. v2 keeps the 12 existing
chains, **re-anchors** the event-based ones to real signals, and adds new ones, grouped into sagas.

### Saga "La Construcción" (output)
| Chain | Stat | T1 | T2 | T3 | T4 | T5 | Source |
|---|---|---|---|---|---|---|---|
| Productos lanzados | shipped | 1 | 5 | 10 | 25 | 50 | ✦ statuses phase=release |
| Work orders completados | workorders | 10 | 50 | 200 | 500 | 1000 | ⧖ `AgentDone green` (+ statuses.workOrdersDone) |
| Fases completadas | phases | 5 | 25 | 75 | 200 | — | ✦ statuses advanced phases |
| Builds completados | builds | 1 | 5 | 15 | 40 | — | ⧖ `BuildComplete` count |
| Subagentes coordinados | subagents | 50 | 250 | 1000 | 3000 | — | ⧖ `SubagentStop` count |

### Saga "Las Ideas" (ideation)
| Chain | Stat | T1 | T2 | T3 | T4 | Source |
|---|---|---|---|---|---|
| Ideas capturadas | ideas | 5 | 20 | 50 | 100 | ✦ idea cards |
| Ideas descartadas | discarded | 5 | 20 | 50 | 100 | ✦ idea cards status=discarded |
| PRDs / specs | specs | 1 | 5 | 15 | 30 | ✦ projects at phase ≥ design |
| ADRs / blueprints | adrs | 1 | 5 | 15 | 40 | ✦ projects at phase ≥ architecture |

### Saga "El Oficio" (quality & craft)
| Chain | Stat | T1 | T2 | T3 | T4 | Source |
|---|---|---|---|---|---|
| Gates verdes | gates | 1 | 10 | 25 | 60 | ⧖ `GateResult PASS` |
| Reviews aprobadas | reviews | 1 | 10 | 40 | 100 | ⧖ `ReviewVerdict APPROVED` |
| Lanzamientos impecables | flawless | 1 | 3 | 7 | 15 | ⧖ clean gates (reopen 0) |
| Hallazgos resueltos | findings | 1 | 10 | 30 | 80 | ⧖ `AgentFinding` resolved |

### Saga "El Gremio" (coordination)
| Chain | Stat | T1 | T2 | T3 | T4 | Source |
|---|---|---|---|---|---|
| Agentes coordinados | agents | 3 | 6 | 10 | 15 | ⧖ distinct agents/roles |
| Modos de build usados | modes | 1 | 2 | 3 | 4 | ⧖ distinct `BuildLaunch.mode` |
| Relanzamientos sobrevividos | relaunches | 1 | 3 | 8 | 20 | ⧖ `BuildRelaunch` count |

### Saga "El Tiempo" (cadence & speed)
| Chain | Stat | T1 | T2 | T3 | T4 | Source |
|---|---|---|---|---|---|
| Racha récord (semanas) | streak | 2 | 8 | 26 | 52 | ⧖ weekly streak from event `at` |
| Récord idea→launch (días, ↓) | speed | ≤30 | ≤14 | ≤7 | ≤3 | ✦ statuses updatedAt deltas |
| Días activos | activedays | 3 | 10 | 30 | 100 | ⧖ distinct UTC days with a green WO |
| Iteraciones desplegadas | iterations | 1 | 10 | 25 | 50 | ✦ shipped→implementation reopens |

~21 chains across 5 sagas. Tier names scale in grandeur (full list in the data tables; e.g. shipped:
El primer ladrillo → Maestro de obras → El arquitecto → El magnate digital → El oráculo de la fábrica).

---

## § 7. UX & new mechanics

- **Stats character sheet** (counters that only grow) + the **"Almost there"** section (top chains by
  % to next tier — Zeigarnik). Reinforce near-miss: surface "te falta 1" prominently.
- **Per-trophy rarity gem** (color) + **estimated-rarity** blurb; **Seals** shelf; **NUEVO** badge for
  7 days post-unlock.
- **Sagas**: missions grouped under saga headers (narrative grouping), not a flat list.
- Honesty everywhere: empty factory → honest zeros, locked trophies, no fabricated dates/bars.
- No notifications, no nagging, no leaderboards, no daily-reset streaks, no false urgency (FRD-09
  ethical constraints carry over).

## § 8. Pending emitter (NOT shipped — would need a new event)

These are evocative but have **no real signal today**; they are recorded here so they are never
shipped as dormant trophies. They become buildable only if the factory emits the signal:

- "Ahorraste $X en infra", "El landing convirtió" — need product/market telemetry (N/A for an
  internal tool).
- "Escribiste N líneas", "Borraste más de lo que escribiste" — need a code-churn emitter.
- "Cero bugs en producción 30 días" — needs a runtime error feed.

---

## Research
[docs/research/08-gamification.md](../../docs/research/08-gamification.md); external scan 2026-06-29
(PlayStation/Xbox/Steam tiers, Duolingo/Habitica/GitHub Achievements, hidden-achievement ratio ~30%,
anti-patterns) summarised in the decision-log entry.
