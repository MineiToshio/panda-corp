# Proposal 12 — Adaptive repair (patch vs rebuild) + adaptive model selection

> Status: DRAFT for owner review (red-team pending). Author: factory supervisor, 2026-06-21.
> Origin: the Mission Control Phase-2 build. Owner-identified, evidence-backed.

## The problem (two issues, both seen live in the MC build)

**Issue A — "rebuild everything for a 1% failure."** When the FRD gate rejects a specific work order for a CORRECTION fault, the engine today (`pandacorp-build.js` `frdGate`, line 233 + main loop line 425):
1. the reviewer reverts the WO's files to `last_green_sha` (DR-070) and sets it `PLANNED`;
2. the **next run rebuilds the whole WO from scratch**.

For WO-07-005 (the complex Configuración surface) this caused **4 gate cycles**, each a DIFFERENT progressively-smaller finding (5 EARS → reverse cross-nav → dead-code knip → dead Back button). Every reject threw away a ~99%-correct build and a fresh full rebuild re-introduced a new micro-bug. It only converged when a human recovered the good build from git and **patched the one bug** (the dead Back button: a 4-line fix + a test) — ~5 min vs 4 multi-agent passes. **The revert-and-rebuild is correct only for its original purpose (protecting PARALLEL siblings' global gate); for a localized fault it is waste that actively causes non-convergence.** Owner: "no tiene sentido descartar todo por un 1% que falla."

**Issue B — "one model for everything."** The worker model is fixed per mode (`MODES`, line 46: `powerful` → `worker: 'sonnet'`). A complex surface gets a sonnet implementer regardless of difficulty or how many times it has failed. The engine should ESCALATE to opus when a WO is genuinely hard or has failed repeatedly — **without leaving the chosen mode** — and the `work-orders` skill should record each WO's difficulty so the engine can decide a priori.

## Change 1 — Adaptive repair: patch-in-place by default, rebuild only when it pays

**Principle:** on a gate reject, default to **patching the specific finding on the existing build** (inject the finding + the failing test + file:line); full revert-and-rebuild is the *exception*, taken only when it genuinely helps.

**The decision (made by the reviewer, the model that already found the fault):** classify each CORRECTION reject as one of:
- **LOCALIZED** (the default, ~majority): a specific, bounded fault — a dead handler, a missing EARS behavior, a dead export, a wrong prop — and the REST of the WO is correct. → return `{ green:false, patch:[{ wo, finding, failingTest, files }] }`, **do NOT revert.**
- **GROSS / structural**: the surface is not recognizably the designed thing (wrong layout, a whole section missing), i.e. the build is a bad foundation to patch. → the current `revert + reopen` (rebuild from scratch).
- **SIBLING-THREATENING**: the broken code would redden OTHER in-flight FRDs' global `verify.sh --since` in the window before it is patched. → revert (the original DR-070 case) **unless** the patch can run synchronously within this FRD's gate step (see Safety).

**Engine flow (reuses the existing `attemptRepair`, line 242 — it already patches in place and re-gates):**
1. `frdGate` returns `patch:[…]` for a localized reject.
2. Main loop runs a **scoped patch agent** (a tightened `attemptRepair`: only the named finding, the existing build, the failing test as the RED→GREEN anchor) → re-run the focused gate.
3. **Cap patch attempts per WO** (`PATCH_CAP`, e.g. 2). On exhaustion → fall back to `revert + reopen` (today's path) → then the existing non-progress block (`MAX_REOPENS`). So convergence is still bounded.

**Safety (why not-reverting does not re-break siblings — the crux):**
- The patch runs **synchronously inside this FRD's gate step**, before the engine yields to other FRDs' gates; the WO is only set `VERIFIED` (and committed) once the focused `verify.sh --since` is green. The global tree therefore never carries the broken code across a sibling's gate.
- A WO is only marked `VERIFIED`/committed on green — never broken-committed. (Same invariant as today.)
- The revert path remains as the fallback for the genuine sibling-threat / gross cases, so DR-070's protection is **not removed, just no longer the default.**

**Verification integrity (generator ≠ verifier):** the patch is GREEN-gated by the reviewer's *committed adversarial tests* + a RED-proven test for the specific finding (the patch must make a test that fails-without it pass-with it). The reviewer (a distinct model/effort from the worker) re-gates after the patch. No self-attestation.

## Change 2 — Adaptive model selection (escalate within the mode)

Add `pickWorkerModel(wo, P)`: the mode's `P.worker` is the **floor**; escalate to `opus` when **either**
- `wo.difficulty === 'high'` (a priori, from Change 3), **or**
- `wo.reopen_count >= ESCALATE_AT` (e.g. 1) or `wo.patch_attempts >= 1` (empirical: it has already failed once — raise the model for the retry).

Never downgrade below `P.worker`. Apply on the WO-build worker calls (lines 204-215) and the scoped patch agent. Effort likewise (`high`→`xhigh`) on escalation.

**Budget interaction (must be addressed):** opus costs more tokens; the `maxAgents` brake counts *agents*, not tokens. Escalation raises token cost without the agent-count brake noticing. Mitigation: keep `maxSpend`/`budget.spent()` as the token ceiling, and log every escalation (`⤴ opus: <wo> (difficulty=high | reopen=N)`) so spend is visible; consider an escalation budget cap.

## Change 3 — WO difficulty in the work-order frontmatter

The `work-orders` skill (`plugin/skills/work-orders/SKILL.md`) adds **`difficulty: low | medium | high`** to each WO frontmatter (default `medium` when absent → backward-compatible; the engine treats missing as `medium` = `P.worker`). Rubric for the generating architect/PM:
- **low**: one small component, no integration seams, ≤2 EARS, pure presentational reuse.
- **medium**: a cohesive view, a few components, 1 integration seam.
- **high**: a feature-rich surface (many components/states), multiple integration seams, cross-navigation/stateful interactions, ≥5 EARS, or novel logic. (WO-07-005 is the canonical `high`.)

Engine reads it in `pickWorkerModel`. The estimate is a *prior*; `reopen_count`/`patch_attempts` are the *empirical* correction (so a mis-estimated WO still escalates once it actually fails).

## Feasibility (per change)

- **Change 1: HIGH.** The patch mechanism (`attemptRepair`) already exists, already re-gates, already runs on a strong model at `xhigh`. The work is: (a) extend `FRD_GATE_SCHEMA` with a `patch[]` shape + the reviewer's localized/gross classification; (b) route `gate.patch` to a scoped repair + re-gate with a `PATCH_CAP`; (c) make the reviewer's reject prompt classify-then-patch-or-revert. ~1 engine function + prompt edits. Net new state: `patch_attempts` per WO (mirror of `reopen_count`).
- **Change 2: HIGH.** One helper + swap `model: P.worker` → `model: pickWorkerModel(wo, P)` on ~5 call sites. Pure additive.
- **Change 3: MEDIUM-LOW.** Additive frontmatter field + a rubric in one skill + the engine default-to-medium read. Backward-compatible.

## Pre-identified risks (input for the red team)

1. **Not-reverting re-breaks parallel siblings** (the DR-070 raison d'être). The Safety argument hinges on the patch being synchronous-within-the-gate-step and never committing broken code; the red team must stress this against the actual wave/parallel-FRD scheduling.
2. **Patch loop / non-convergence**: a patch that introduces a new fault. Bounded by `PATCH_CAP` → fall back to rebuild → non-progress block; verify the interaction with `reopen_count`/`MAX_REOPENS` is sound.
3. **Cost blowup from opus escalation** vs the agent-count brake's token blindness.
4. **Reviewer mis-classifies LOCALIZED vs GROSS** → patches a build that should have been rebuilt (wasted attempts) or rebuilds a fixable one. Is `reopen_count`/`patch_attempts` a more reliable trigger than the reviewer's a-priori call?
5. **Difficulty mis-estimation** by the WO author; is the a-priori field worth it, or is empirical escalation (on failure) enough?
6. **Over-engineering**: could a simpler rule (e.g. "always patch once before ever reverting; escalate model on any reopen") capture ~90% of the benefit with less machinery?
7. **Verification integrity**: patching the existing build risks generator≈verifier drift; confirm the re-gate is genuinely independent.

---

# RED-TEAM RESULTS (3 adversarial agents, opus) + v2 design

The red team CONVERGED: the **core idea is sound and high-value**, but v1's mechanism had a **fatal safety flaw** and was **over-built**. Three findings, all accepted.

## Finding 1 (FATAL) — v1 re-creates the 2026-06-21 sibling-pollution incident
The post-patch re-gate in v1 was the FOCUSED `verify.sh --since` (line 229): biome/tsc run whole-project but **tests are scoped and `knip` is NOT run**. v1 classifies a **dead export** as LOCALIZED → patch, no-revert. The patch passes the focused gate while leaving a whole-project knip/dead-export fault **committed in HEAD**; a LATER sibling FRD's gate (which the engine runs over the whole tree) goes RED — the verbatim incident DR-070 exists to kill. v1's "VERIFIED only on green" used the WRONG green (focused, not whole-project).
**FIX:** a patched WO is committed/VERIFIED **only after a WHOLE-PROJECT check passes** — at minimum the fast whole-project gates **knip + biome + tsc** (the slow full test suite still runs once at close-out). Patch in the working tree; commit only on whole-project-clean. This restores DR-070's TRUE invariant ("never broken-committed whole-project") without a revert.

## Finding 2 — unbounded cost + non-termination (the brakes don't compose)
- `patch_attempts` and `reopen_count` NEST → ~3.5× the spawns to reach a block (~21 vs ~6 per stubborn WO).
- **Never-blocks path:** each patch can surface a NEW localized finding (WO-07-005's exact signature) → a per-finding cap never trips; and any green **resets reopen_count** (DR-072 C2) → dodges MAX_REOPENS.
- **Cost:** the only reliable overnight brake counts AGENTS not TOKENS. Opus escalation makes ~21 opus/xhigh agents ≈ ~100+ sonnet agents in tokens while `agentSpawned` reads ~21 — silently reintroduces the 5M-token/68-agent blow-up DR-070 was built against.
**FIXES:** (a) ONE unified ceiling `repair_attempts = patch_attempts + reopen_count`, block at it; (b) the counter binds to the WO and increments on EVERY re-gate incl. new findings; (c) **weight `agentSpawned` by model cost** (opus≈3–4× sonnet) so `maxAgents` brakes on a token-proxy; (d) a hard per-WO escalation cap.

## Finding 3 — over-built; cut the classifier and the difficulty field
- The reviewer's LOCALIZED/GROSS/SIBLING-THREATENING classification is a NEW unreliable LLM judgment on the exact faculty the engine already distrusts (line 226 calls the reviewer's over-broad judgment "the #1 cause of the build never finishing"). The **empirical rule** — "always attempt exactly ONE in-place patch before ever reverting" — captures ~90% with NO classifier and no mis-classification churn.
- The a-priori `difficulty` field is **self-admitted noise** (the proposal itself says empirical `reopen_count`/`patch_attempts` supersedes it). It only matters on the first build of a high WO — exactly when a human guess is least reliable — to save ONE sonnet attempt that then escalates empirically anyway.
- **Verification integrity:** patch-in-place keeps the worker's (possibly decorative, DR-015) build+tests; the re-gate must be the **full FRD adversarial + integration pass**, not just `--since` the one file, or the bar is lowered vs a clean rebuild.

## v2 — the hardened, minimal design (what to actually build)

**Change 1 (v2) — Empirical patch-first, whole-project-gated.**
- On ANY CORRECTION reject of a specific WO: run **exactly ONE** scoped patch (`PATCH_CAP=1`, reuse `attemptRepair`) on the existing build — inject the finding + a RED-proven failing test. NO reviewer classifier.
- Re-gate = the **full FRD adversarial + integration pass** + whole-project **knip+biome+tsc**. Commit/VERIFY only if whole-project-clean.
- If the patch fails / yields a new finding / isn't whole-project-clean → fall back to **today's `revert + reopen`** (rebuild from scratch). DR-070 protection intact as the fallback.
- Unified attempt budget: `repair_attempts = reopen_count + patch_attempts`, BLOCK needs-owner at a single ceiling (3); counter bound to the WO.

**Change 2 (v2) — Empirical escalation + cost-weighted brake.**
- `pickWorkerModel(wo, P)`: floor `P.worker`; escalate to `opus` when `reopen_count>=1 || patch_attempts>=1` (it already failed once). Hard cap: ≤1 empirical opus escalation per WO.
- **Weight `agentSpawned`** so an opus agent counts ~3 toward `maxAgents` (closes the token-blind brake).

**Change 3 — CUT** (empirical escalation replaces it). [Owner's call — it was the owner's idea; see decision point.]

**Feasibility (v2): HIGHER than v1** — less surface (no classifier branch, no difficulty field/rubric/threading). New work: route reject→1 patch→full-FRD+whole-project re-gate→fallback; `pickWorkerModel`; cost-weighted `agentSpawned`; unified `repair_attempts`. All localized to `pandacorp-build.js` + the reviewer prompt.
