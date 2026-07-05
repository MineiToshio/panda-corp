# 29 — Single Source of Truth: inventory, Mission Control fixes, factory law

**Status:** APPROVED-PENDING — inventory complete; implementation checklist below is the resumable execution state.
**Date:** 2026-07-05
**Origin:** owner mission — the same fact (e.g. the work-order count) shows different values across Mission Control views; root cause is more than one source of truth per fact. Goal: fix every divergence, then elevate "single source of truth" to a first-class, enforced Pandacorp principle propagated to every product project.

> **Resume protocol:** this document is self-contained. A fresh session can execute §4 (checklist) top-to-bottom without prior context. Mark items `[x]` as they land; each item names its files. The factory rules that bind the executor: language (committed = English, owner chat = Spanish), PROTECTED STATE PATHS (never bulk-delete `.pandacorp/` or `factory/{ideas,memory,profile.md,portfolio.md}`), decision-log discipline (canonical doc + area decision log, same turn), plugin lifecycle (semver bump + Codex mirrors + validate), DR-047 lesson capture.

---

## 1 · The law (design)

**One writer per fact; readers DERIVE, never duplicate.** If a derived value is cached for performance, there is exactly ONE resolver and it is honestly re-derived at safe points by its single writer — a second independent derivation of the same fact is a defect, rejected at review.

Two allowed shapes for any fact that more than one surface consumes:

1. **Derive-on-read (default).** Readers compute from the atomic source (the `wo-*.md` files, the docs, the queue files) at read time, through ONE shared resolver (request-scoped `React.cache()` in MC, one query module elsewhere).
2. **Honest cache (exception, performance-justified).** A stored derived value is legitimate ONLY if: (a) it has ONE named writer, (b) that writer re-derives it from the atomic source at defined safe points (never increments/decrements blindly), (c) the storage is documented as a replica ("maintained by X, re-derived at Y — display consumers must use the resolver"), and (d) no UI/display surface reads it when a live resolver exists.

**Forbidden patterns** (each observed in this audit): a second independent derivation of a value an existing resolver provides; a counter maintained by scattered `+1/-1` writes instead of re-derivation; a reader mapping a stored field that has no writer (dead field displayed as truth); docs claiming a different source than the code uses.

This generalizes **DR-092** (UI derived-state resolver) beyond UI into a data-architecture principle covering code, DB schemas, JSON/YAML artifacts and documents. Existing instances it federates: DR-050 §1 (WO frontmatter atomic; FRD status = derived rollup), DR-087 (`dependsOn` is the DAG source), DR-066 (liveness = crossing, not the flag), DR-078 (fail-loud reads). New id: **DR-115**.

## 2 · Inventory of divergences (Phase 1, verified 2026-07-05)

Classification: **(a)** OK-single-derivation · **(b)** honest cache · **(c) DEFECT** — divergent second derivation.

### Work orders — "how many WOs / how done is this project" (3 mechanisms today)

| Surface | Reads from | Mechanism | Class |
|---|---|---|---|
| ObjectivesBar (project header) | `ProjectWorkspace.tsx:246-250` → `listWorkOrders` + `aggregateProgress` | live glob `docs/frds/*/work-orders/wo-*.md` + frontmatter `implementation_status` | (a) — but its props docstrings falsely say "from status.yaml" (`objectives-bar.tsx:39,41`) |
| Work Orders tab kanban, Observability DAG, Party/CampaignStrip, board Architecture DAG/modal | `listWorkOrders` (same array threaded) | live glob | (a) |
| **Inicio portfolio card ("Cartera")** | `page.tsx:155-156` → `card.ts:172-175,232` | **raw `status.yaml:work_orders_done/total` cache** | **(c) D1** |
| **Gamification XP/level input** | `gamification.ts:498-561` (`deriveGuildOutcomes`) | **sums `status.workOrdersDone` from the yaml cache**; ledger then freezes stale maxima (MAX merge) | **(c) D2** |
| Observability timeline | `build-track.ts` — `track.jsonl` events + `supplementMissingWos`/`fromStructural`/`fromGit` fallbacks; `resolveWoState` treats frontmatter as authoritative | track = timing/history log (a distinct fact), state defers to frontmatter | (b) — guard item MC-8 verifies set/count honors `listWorkOrders` |
| `status.yaml:work_orders_total/done` fields | written by build engine at safe points (`pandacorp-build.js:404,495,571,592`; DR-050 declares the replica) | honest cache **during builds only** — stale between builds / after manual DR-097 edits | (b) as engine breadcrumb; **(c) whenever UI reads it** → fix = forbid display reads (D1/D2) |

### Level / XP / Pulse / ideas

| Surface | Reads from | Mechanism | Class |
|---|---|---|---|
| GuildBar (layout), Inicio Progreso, Logros GuildHero | `getGuildState()` (`guildState.ts:92`, React.cache) | one resolver per request — the reference pattern | (a) — except its **input** is D2 |
| **Inicio "Pulso" ideas-vivas count** | `page.tsx:233` inline filter (`status !== discarded/shipped`) | ad-hoc filter in the page | **(c) D3** |
| **Logros Informe funnel** | `funnel.ts:75-91` (`totalIdeas = ideas.length`, launched/wip from statuses) | second independent count of "the ideas in play" | **(c) D3** (same fix: one ideas-funnel resolver exporting BOTH named facts) |

### Pending decisions / bugs / changes

| Surface | Reads from | Mechanism | Class |
|---|---|---|---|
| Pending decisions (all surfaces) | `readStatusWithLiveDecisions` (`status.ts:318-327`) overriding the yaml counter with `countPendingDecisions` | live derivation, documented DR-092 mitigation | (a) — the model to replicate for bugs |
| **Pending bugs badges** (`status-chips.tsx:157-201`, `ProjectRail.tsx:563-567`) | `status.pendingBugs` ← `status.yaml:pending_bugs` | **dead field** — removed from the template (plugin decision log:631), no writer exists; the real fact lives in `.pandacorp/inbox/changes/*.md` (`readChangeQueue`, type `bug`) | **(c) D4** |
| `status.yaml:pending_changes` | incremented by `/change`+`/bug` skills, decremented by engine close-out; **no reader anywhere** | increment-maintained counter (forbidden pattern), desyncs on any manual queue edit | **(c) D10** (factory side) |

### FRD counts / board tabs / dead fields

| Surface | Reads from | Mechanism | Class |
|---|---|---|---|
| Board "Documentos" rail | `listProjectDocs` (`tree.ts:86-106`) | real `docs/frds/frd-*` folders | (a) — the canonical FRD source |
| **Board "Spec" badge "N FRDs"** | `spec.ts:253-312` parsing `.pandacorp/comms/spec-resumen.md` prose | digest section count presented as the project's FRD count | **(c) D6** |
| **Board "Arquitectura" FRD-card badge "N WOs"** | `architecture.ts:231-282` parsing `arquitectura-resumen.md` prose | digest bullet count — while the SAME card's DAG/modal uses `listWorkOrders` | **(c) D5** |
| `status.ts:182` maps `progress` | no writer anywhere; not in the template; ObjectivesBar derives its own pct | dead mapping inviting a stale consumer | **(c) D7** |
| `KpiHeader`/`deriveKpis` "failed WOs" (`kpis.ts:79-196`) | event stream `status==="fail"` | orphan (unmounted) code with a divergent mechanism vs `WorkOrder.state` | **(c) D8** — delete (dead code) |
| `status.yaml.tpl` missing `last_harvest` | skills write/read `last_harvest` (`implement:112`, `memory:18/42`) but the template lacks the field | schema drift | **(c) D11** (factory side) |

### Verified honest / single-source (no action)

`last_green_sha`+`safe_to_test` (gate-only writer) · heartbeats (DR-066) · FRD `implementation_status` rollup (DR-050, engine re-derives) · ideas snapshot cache (single purpose/consumer) · `factory/memory/INDEX.md` (delta-edit discipline) · `factory/portfolio.md` (pointers, refreshed by `sync-portfolio` on demand, documented) · board tabs reading live docs per request (no intermediate snapshot — a docs iteration IS reflected; the defect is only the digest-count badges D5/D6).

## 3 · Fix design per surface (decisions)

- **MC-1 (D1):** Inicio portfolio card derives from `listWorkOrders` (page.tsx already calls it per project for the blocker reason — reuse) via `aggregateProgress`. Then **remove `workOrdersTotal/workOrdersDone` from `ProjectStatus` + `status.ts` mapping** so no display consumer can regress (enforcement by construction). The yaml fields STAY as the engine's honest replica (DR-050) for humans/other runtimes — template comment updated to say "display consumers must derive".
- **MC-2 (D2):** `readGuildState` computes `workOrdersDone` by summing `listWorkOrders(project).state === "done"` across the portfolio; `deriveGuildOutcomes` takes the live count instead of `status.workOrdersDone`. Ledger MAX-merge logic unchanged.
- **MC-3 (D4):** add `countPendingBugs(projectPath)` to the changes lib (open queue items, `type: "bug"`); extend the live wrapper (`readStatusWithLiveDecisions` → also overrides `pendingBugs`; rename to `readStatusWithLiveInboxCounts`, keep a deprecated alias or update all callers). Remove the `pending_bugs` yaml mapping.
- **MC-4 (D3):** one cached ideas-funnel resolver (`src/lib/ideas/` — `getIdeaCounts = cache(...)` exporting `totalIdeas`, `ideasAlive`, `ideasShipped`); `derivePulse` and `funnelAndFlow` consume it. `ideasAlive` and `totalIdeas` remain DISTINCT named facts (different denominators are legitimate) — each with exactly one derivation.
- **MC-5 (D5):** ArchitectureDigest FRD-card badge counts from `workOrdersForFrd(frd, listWorkOrders(...))` (already computed for the modal); digest prose stays narrative-only.
- **MC-6 (D6):** SpecDigest "N FRDs" badge derives from the live FRD folder count (`listProjectDocs`-based shared helper); digest sections remain the narrative body.
- **MC-7 (D7):** remove `progress` from `ProjectStatus` + `status.ts`.
- **MC-8 (D8 + timeline guard):** delete orphan `KpiHeader`/`deriveKpis` failed-WO path after re-verifying it is unmounted; add a unit assertion that the timeline's WO id set ⊇/= `listWorkOrders` set when both exist (frontmatter authoritative).
- **MC-9 (D9):** fix the lying docstrings in `objectives-bar.tsx:39,41`.
- **MC-10:** end-to-end proof — create a throwaway WO file under `mission-control/docs/frds/<frd>/work-orders/`, verify with preview tools that header, WO tab, Inicio card, board and Observability all show the same count; remove the file (file-by-file; committed docs path, not protected state).
- **FA-1 (D10):** remove `pending_changes` from the template and the increment/decrement steps in `plugin/skills/change/SKILL.md`, `plugin/skills/bug/SKILL.md`, `pandacorp-build.js` close-out — the queue directory is the fact; anyone needing the count derives it. *(Red-team note: no reader exists today, so removal loses nothing; if a non-MC runtime wants the count, `ls .pandacorp/inbox/changes/*.md` is the derivation.)*
- **FA-2 (D11):** add `last_harvest: ""` to `status.yaml.tpl` with a comment naming its writers.

## 4 · Execution checklist (resumable state — mark as you land)

**Phase A — Mission Control fixes** (worktree per DR-096; land via `mission-control/.pandacorp/merge-queue.sh`; update owning FRDs + `mission-control/docs/decision-log.md` in the same change):

- [ ] A1 · MC-1: Inicio card live WO counts + drop `workOrdersTotal/Done` from `status.ts`/`ProjectStatus` (files: `src/app/page.tsx`, `src/app/(dashboard)/_lib/card.ts`, `src/lib/status/status.ts`, tests) — owning doc: FRD-01/FRD-04
- [ ] A2 · MC-2: gamification live WO input (files: `src/lib/gamification/{guildState,gamification}.ts`, tests) — FRD-09
- [ ] A3 · MC-3: live `pendingBugs` wrapper + remove yaml mapping (files: `src/lib/changes/changes.ts`, `src/lib/status/status.ts`, `status-chips.tsx`, `ProjectRail.tsx`, tests) — FRD-01/FRD-04
- [ ] A4 · MC-4: ideas-funnel single resolver (files: `src/lib/ideas/*`, `src/app/_lib/pulse.ts`, `src/app/page.tsx`, `src/lib/achievements/report/funnel.ts`, tests) — FRD-03/FRD-10
- [ ] A5 · MC-5 + MC-6: board badges derive from disk (files: `ArchitectureDigest.tsx`, `SpecDigest.tsx`, shared helper, tests) — FRD-11
- [ ] A6 · MC-7 + MC-8 + MC-9: dead `progress` mapping out; orphan KpiHeader deleted; timeline set assertion; docstring fixes — FRD-01/FRD-13
- [ ] A7 · MC-10: end-to-end WO-creation proof with preview evidence (screenshots; all surfaces equal)
- [ ] A8 · Final Fable consistency review of the whole diff (no second derivation reintroduced); `verify.sh` green; merge-queue land; decision-log entry in `mission-control/docs/decision-log.md`

**Phase B — Factory law:**

- [ ] B1 · New standard `factory/standards/single-source-of-truth.md` (the law of §1, both shapes, forbidden patterns, enforcement map)
- [ ] B2 · Registry: add **DR-115** (general law; cross-references DR-092/050/087/066/078); DR-092 stays as the UI-resolver instance, its `nota` pointing up to DR-115
- [ ] B3 · Propagation to products: extend `plugin/templates/rules/clean-code.md` DR-092 section into the generalized rule (single writer per fact; honest-cache conditions; forbidden patterns)
- [ ] B4 · Reviewer gate: strengthen `plugin/agents/reviewer.md` quality lens with the explicit SSOT checklist (new count/aggregate ⇒ must call the existing resolver; stored counter ⇒ named writer + re-derivation point or REJECT)
- [ ] B5 · Automated check: doc-lint SOFT check — status.yaml keys not present in the template schema (catches D11-class drift); note: the primary code-level enforcement is BY CONSTRUCTION (A1/A3/A7 removed the readable stale fields) + the reviewer gate
- [ ] B6 · Template changes: FA-1 (`pending_changes` removal from tpl + `change`/`bug` skills + engine close-out) and FA-2 (`last_harvest` in tpl); template comment on `work_orders_*` ("engine-maintained replica — display consumers derive")
- [ ] B7 · Constitution: add the SSOT principle (one line under Technical principles) — **owner-gated**, approved with this plan
- [ ] B8 · Manual (DR-046): Reference auto-derives DR-115 from the registry; check `mission-control/content/manual/concepts/` for the hand-authored page that explains state/observability and add the SSOT concept
- [ ] B9 · Plugin version bump MINOR (9.70.1 → 9.71.0), regenerate Codex mirrors (`node plugin/scripts/generate-codex-agents.mjs` — reviewer.md changed), `claude plugin validate plugin/`; decision-log entries: `plugin/docs/decision-log.md` + `factory/decision-log.md`; lessons to `factory/memory/_inbox.md`

**Deferred (explicitly, not silent):** none yet — anything cut during execution must be listed here.
