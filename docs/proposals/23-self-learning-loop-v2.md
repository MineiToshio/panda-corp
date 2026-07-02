# Proposal 23 — Self-learning loop v2: close the loop, automate the turn, validate the lessons (2026-07-02)

> Status: IMPLEMENTED (2026-07-02, all 4 fases — owner approved the full plan the same day; plugin v9.49.0, OVERLAY 8.55.3, DR-047 rewritten). F1.4 (validate-backlog.sh) had already shipped in a parallel session. FRD-17's close (4.2) is filed in Mission Control's change queue (`mc-frd17-propuestas-memory-health-loop-v2`) — the only piece pending build. The scheduled sweep became a DAILY threshold routine (machine-local `pandacorp-memory-review`).
> Origin: owner ask 2026-07-02 — "review the whole continuous-improvement flow (memory, learn, auto-recommendations); today I have to run /memory and /learn by hand per project; compare with other systems and give me an improvement plan."
> Method: exhaustive repo audit (memory store, skills, agents, governance, backlog, scheduling — all counts measured 2026-07-02) + external research sweep (agent-memory systems, self-improving-agent literature 2023–2026, validation patterns). Every internal claim below was verified against the repo, not inferred.
> Related: proposal 09 (the original design), proposal 17 P0.2 (still open), proposal 20 P1-6/P1-7 (confirmed here), DR-047, DR-103.

## The one-line diagnosis

**The factory writes its diary but never rereads it, and nobody turns the pages for it.** Capture works (22 lessons, DR-103 routing correct, inbox drains when someone runs harvest). Everything downstream of capture is prose, not mechanism: retrieval is instructed in 8 agent prompts but has never demonstrably happened (`times_applied: 0` on all 22 lessons), no scheduled job has ever turned the loop (zero scheduled tasks despite DR-047 claiming "SWEEP ACTIVATED"), the implement close-out harvest is documented but not invoked, the promotion queue has no operator surface (FRD-17 partial), and there is no validation that a stored lesson is *true* rather than a single trajectory's self-flattery.

### Measured state (2026-07-02)

| Loop phase (proposal 09) | Designed | Actual |
|---|---|---|
| 0 Substrate | `factory/memory/` typed lessons + validator | ✅ 22 lessons (15 active, 7 candidate), `validate-memory.sh` green |
| 1 Capture + routing | always-on jot + librarian drain + DR-103 split | ✅ works — but only when harvest is run by hand (last: 2026-06-30) |
| 2 Retrieve | all builder agents grep memory, increment `times_applied` | ❌ **all 22 lessons at `times_applied: 0`**; instruction exists in prose, no mechanism executes or verifies it |
| 3 Promote (gate) | eval-gate + FRD-17 Propuestas inbox + owner | ⚠️ 2 lessons stuck at `promotion: proposed` with no surface to approve them; 3 approved ever, all pushed manually post-audit |
| 4 Prune | scheduled review flags stale/contradicted | ❌ never runs; worse, its criterion ("never retrieved") would **condemn every lesson** because phase 2 never increments |
| 5 Self-suggest (MC) | memory-health panel + proposals inbox | ⚠️ partial (FRD-17 spec'd, panel incomplete) |
| — Backlog hygiene | `validate-backlog.sh` (promised in README) | ❌ script does not exist; **live id collisions** (two BL-0010, two BL-0011); MC's fail-loud reader errors on the store |

The owner's pain ("I must run the commands by hand") is precisely the missing half: **the loop has no motor**. And the half nobody complained about yet — retrieval + validation — is where the literature says the actual ROI lives.

## What the outside world does (research digest)

Full sweep in the session record; the load-bearing findings:

1. **The loop must have a background motor, not a human crank.** Letta's *sleep-time compute* (a separate idle-time agent whose only job is reorganizing memory), LangMem's *hot-path jot vs background manager* split, and Mem0's write-time **ADD/UPDATE/DELETE/NOOP** consolidation all converge on the same shape the factory already designed (librarian + A.U.D.N.) — they just actually run it on a schedule/threshold. Devin's "suggested knowledge" and CodeRabbit's "learnings" go further: **the correction itself is the capture event** (a user correcting the agent auto-proposes a knowledge entry; the human only clicks approve).
2. **Retrieval is where the measured wins are.** Agent Workflow Memory (+51% relative on WebArena), ExpeL, ReasoningBank (+34%, −16% steps) all get their gains at *task time*, injecting distilled lessons into new attempts. A store nobody reads is dead weight. The retrieval-friendly format matters: each item carries a **"use this when…" trigger description** (Devin/ReasoningBank), and an always-loaded **index + on-demand detail** (Claude Code auto-memory's own design; ~150-line index).
3. **An unvalidated store is worse than no store.** EDV (arXiv 2606.24428) measured it: injecting just 10% erroneous memories dropped agent performance 82.5%→77.2%. Their fix: the distiller must be a **third party that did not live the trajectory**, extraction works by **contrasting** trajectories, and storage is **default-reject** with consensus. Voyager's rule for procedures: a skill enters the library only after it **verifiably executed once**. Eval-gates belong at *promotion* (lesson→rule), not at capture — gate capture too hard and nothing is ever stored.
4. **Delta updates, never wholesale rewrites.** ACE (arXiv 2510.04618): regenerating a memory/summary causes "context collapse" and brevity bias. One-file-per-lesson + itemized index edits — the factory's existing substrate — is the endorsed shape. No vector DB needed; **the substrate is right, the wiring is missing.**
5. **The end state of a good lesson is enforcement, not retrieval.** Packmind/lint-rule generators graduate a recurring review comment into an automated check so no human repeats it. The factory already has this ladder (`learn` → standard/DR/skill + deterministic verifier); it needs the escalator that feeds it (usage-count-triggered promotion proposals).

## The plan — 4 phases, each independently shippable

Design principle: **keep the substrate, wire the motor, make every step verifiable by a script rather than by agent goodwill** (constitution: agents never check off their own checks).

### Fase 1 — El motor: que el loop gire solo (kills the owner's pain) — P0

- [ ] **1.1 Cosecha ejecutable al close-out de `implement`.** The close-out step stops being prose: the engine *invokes* the librarian harvest (drain `.pandacorp/run/lessons.md` + capture points) and **stamps `last_harvest:` in `status.yaml`**; the supervisor treats a close-out without the stamp as an incomplete close-out. → `plugin/skills/implement/SKILL.md` + engine step + status schema.
- [ ] **1.2 Barrido programado real.** One scheduled job (harness scheduled task or LaunchAgent, like the MC always-on) that runs `/pandacorp:memory harvest` per active project + `review` on threshold: **inbox ≥ 20 notes OR ≥ 7 days since last drain**. Idempotent, logs to the factory feed. This closes proposal 17 P0.2 for good. → new `plugin/scripts/` runner + registration doc.
- [ ] **1.3 Captura por corrección (Devin/CodeRabbit pattern).** A `Stop`/`SessionEnd` hook runs a cheap scan of the session for correction events (owner corrected the agent, a fix-after-failure, a reverted approach) and appends tagged candidates to the right inbox. Removes the dependence on agents remembering rule 8. → `plugin/hooks/` + hook registration in overlay + factory settings.
- [ ] **1.4 `validate-backlog.sh`** (promised by README, missing): id uniqueness + schema + next-free-id; fix the live BL-0010/BL-0011 collisions in the same change. Quick win, unblocks MC's fail-loud reader. → `plugin/scripts/validate-backlog.sh` + renumber items.

### Fase 2 — La recuperación: que las lecciones lleguen al build — P0

- [ ] **2.1 `factory/memory/INDEX.md`** — one line per **active** lesson: `LESSON-NNNN · use when <trigger> · <one-line insight>` (≤150 lines; librarian maintains it with **delta edits only**, never regeneration — ACE). Injected into the project overlay at scaffold/upgrade next to the standards, so every build agent has the index in context *for free* instead of being told to remember to grep.
- [ ] **2.2 Retrieval-shaped lessons.** Add `trigger:` ("use this when…") to the lesson frontmatter/template; librarian backfills the 22 existing lessons. Domain-scoped delivery for stack-specific lessons via `.claude/rules/` files with `paths:` globs in the overlay (zero-infra conditional retrieval).
- [ ] **2.3 Medición determinista del uso.** Stop asking agents to edit frontmatter (they never did). Instead: agents **cite `LESSON-NNNN`** in the artifacts they already write (blueprint, review, WO log); a close-out script **greps the citations and increments `times_applied` + `applied_in`** deterministically. Verification by script, not goodwill — and it un-breaks the prune criterion.

### Fase 3 — La validez: que lo aprendido sea verdad, no superstición — P1

- [ ] **3.1 Default-reject en el refinado (EDV).** The librarian (already a third party — good) gets an explicit default-reject bar: no concrete evidence anchor → discard, not candidate. Most inbox notes should *die* at refine; pile-up means the discard path is missing.
- [ ] **3.2 Corroboración por uso cruzado.** `candidate → active` additionally requires confirmation from a *different* build/project than the one that produced it (or `ci-verified`/`owner-stated` provenance). An agent-inferred, single-trajectory lesson can never self-activate. → tighten the eval-gate in `memory` skill + validator.
- [ ] **3.3 Lecciones de fracaso con contraste (ReasoningBank).** Harvest explicitly from failure/rejection events (reviewer re-opens, gate rejections, reverted WOs), distilling the lesson from the *difference* between the failed and the fixed attempt — more causal than success-only lessons.
- [ ] **3.4 Poda segura.** Freeze the "never retrieved" prune criterion until 2.3 has measured ≥N builds; prune then uses `times_applied` + `last_confirmed` (supersede-not-delete stays as is — already correct per Zep's model).

### Fase 4 — La escalera: promoción que compone — P1

- [ ] **4.1 Escalador de promoción por uso.** A lesson cited ≥3 times (measured by 2.3) auto-sets `promotion: proposed` with target + rationale — the escalator that feeds `learn`.
- [ ] **4.2 Superficie del gate (cerrar FRD-17).** MC's Propuestas inbox lists the `promotion: proposed` queue + memory-health (inbox size, staleness, last sweep) + push (DR-038); owner approves/rejects in one gesture; `learn` executes approved ones. The 2 lessons stuck in the queue today are the first customers.
- [ ] **4.3 Tier medio de DR-047 de verdad.** Auto-promote to SHOULD-standard *only* when the lesson ships with its deterministic verifier (Voyager's rule: a procedure is proven by running once), owner notified. MUST/skills/DRs stay owner-gated — the literature confirms the human gate at high risk is best practice, not a brake.
- [ ] **4.4 Pase de reflexión periódico.** The scheduled review additionally synthesizes clusters of low-level lessons into one higher-level pattern (Generative Agents' reflection) — the store's compression mechanism, capped by A.U.D.N.

## What we deliberately do NOT do

- **No vector DB / external memory service** (Mem0/Zep/Letta as infra): the git-committed markdown substrate is validated by the literature (ACE, Claude Code auto-memory) and by our own constraints (auditable, ownable, human-gated). The gap is wiring, not storage tech.
- **No auto-promotion of MUST standards, skills or DRs** — DR-047's high-risk human gate stands.
- **No capture-time eval-gate** — validation lives at refine (cheap groundedness) and promotion (eval), or nothing ever gets stored.
- **No wholesale memory rewrites** by any agent, ever (ACE: context collapse).

## Sequencing & effort

Fase 1 + 2 are the P0s and pair naturally (motor + retrieval; ~1 plugin release each, MINOR bumps). Fase 3 rides on 2.3's measurement. Fase 4 closes with FRD-17 (MC change → its own `.pandacorp/inbox/changes/` via `/change`, per DR-103). Success metric, one build later: inbox drained without owner action, ≥1 lesson cited in a build artifact with its counter incremented by script, ≥1 promotion approved from the MC surface.
