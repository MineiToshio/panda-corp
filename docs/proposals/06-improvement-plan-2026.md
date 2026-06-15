# Factory improvement plan — 2026

> Generated 2026-06-13 from two deep web research efforts with adversarial verification
> (orchestration/quality/SDK/docs + UI/UX/gamification). 5 dimensions, ~50 sources,
> claims verified by a 3-0 vote except where noted. Each finding is connected to what to
> change in Pandacorp (pipeline, hooks, agents, or Mission Control).

## Central thesis

The quality and speed of an autonomous software factory **do not come from "better prompts"**, but from
**making everything verifiable deterministic and everything debatable adversarial**. Pandacorp is already well positioned
(deterministic hooks, a reviewer that re-verifies, the `Stop`/`verify.sh` gate, teams with isolated context, memory
in files). The improvements are **incremental and high-ROI**, not a redesign.

The most actionable and best-evidenced finding: **a verifier built only with AI-generated tests
systematically fails** (20–40% of "green" solutions are actually wrong) because LLM errors
cluster (a shared systematic bias) while humans fail in diverse ways. We must **reinforce
agent-independent verification**, not trust that the agent "won't cheat".

---

## Dimension 1 — Agent orchestration and pipeline

| # | Finding (evidence) | Application to Pandacorp |
|---|---|---|
| 1.1 | **Spec-driven development**: the spec as an "executable source of truth" decomposed into *small chunks testable in isolation* reduces cascading errors. Spec Kit structures it as Specify/Plan/Tasks/Implement; the tasks are "small reviewable chunks… you can implement and test in isolation". [1][2] | The `spec→design→blueprint→work-orders→implement` pipeline **is already SDD**; the EARS criteria are the executable spec. **Improvement:** have the `reviewer` **reject work orders that are too large** and require each WO to be testable in isolation (a new rule in `blueprint`/`work-orders`). |
| 1.2 | **Assembly line with codified SOPs** (PM→Architect→Engineer→Reviewer): having each role *verify intermediate results* mitigates the "cascading hallucinations" of naive LLM chaining. MetaGPT (ICLR 2024 Oral). [3][4] | The 10 roles already exist. **Improvement:** move the intermediate verification checklists **to each `agents/*.md`** (an SOP of "before handing off the work, I verify X/Y/Z"), instead of concentrating them only in the `implement` skill. |
| 1.3 | **MAST taxonomy of multi-agent failures**: 14 failure modes in 3 categories (system design, inter-agent misalignment, **task verification/termination**), derived from 1600+ real traces across 7 frameworks (NeurIPS 2025, κ=0.88). [5][6] | Use MAST as a **design checklist** for the hooks and for `implement`. The *task verification* category (premature termination, incomplete/incorrect verification) is exactly what `Stop`/`verify.sh` must prevent. **Document in the constitution which failure mode each hook prevents.** |

---

## Dimension 2 — Automatic quality and verification without human review

| # | Finding (evidence) | Application to Pandacorp |
|---|---|---|
| 2.1 ⭐ | **AI-generated tests have persistent blind spots**: solutions that passed private tests were wrong in 20% (medium) / 40% (hard); "LLM errors cluster tightly… while human errors are widely distributed". Popular benchmarks have weak tests (HumanEval 7.7 tests/problem; 84% of verifiers defective in one set). [7] | **The `test-writer` and the `implementer` share a bias** → the "green" tests have gaps. **P0 improvement:** the `reviewer` (a different model, opus) writes **adversarial tests the implementer did NOT see**; add **mutation testing** to `verify.sh` to detect decorative tests. |
| 2.2 | **Human-LLM test generation (SAGA)**: deriving constraints from correct solutions and failure modes from incorrect ones improves the verifier (+15.86% over existing TCG). [7] *(2-1 vote: nuance in the figures, not in the principle)* | Anchor the tests in the **"human part"**: EARS criteria from the FRDs and **real bugs documented in `docs/progress.md`**, not in what the LLM imagines. Reinforce the `test-writer`'s existing rule. |
| 2.3 ⭐ | **Hardening the evaluation ENVIRONMENT cuts "cheating" by 87.7%** (exploits 6.5%→0.8%) **without losing task success**: randomized intermediate outputs, explicit step verification, *fail-closed* parsing, less metadata visible to the agent. [8] *(2026 preprint, 1 author — strongly directional, no replication)* | `verify.sh` should run in a **clean/isolated environment**, **parse fail-closed** (any ambiguity = failure), **not expose to the agent the exact names of the tests** to pass, and hide/randomize fixtures. It validates the deterministic hook architecture you already have. |
| 2.4 | **OWASP Top 10 for Agentic Applications** (Dec 9, 2025, ASI01–ASI10): from "preventing bad outputs" to "preventing cascading failures" in agents that plan/persist/delegate. Risks: Tool Misuse, Identity & Privilege Abuse, Memory Poisoning, Cascading Failures. [9] | Adopt it as an **explicit checklist** in `agents/security-auditor.md` and in the `release` skill. Directly relevant: Tool Misuse (agents with Bash/rm), Memory Poisoning (poisoning `progress.md`/memory between work orders). |
| 2.5 | **The worker's training regime determines its propensity to game**: RL-from-base hallucinates/exploits 12–16% vs 0.4–0.8% in SFT-focused. [8] *(2-1 vote)* | **Don't assume the sonnet/haiku workers are honest**: it justifies having the `reviewer` **re-verify ALL evidence** and that the checks are always from scripts/CI (rule 4 of the constitution, already correct). |

---

## Dimension 3 — Advanced Claude Code / Agent SDK capabilities

| # | Finding (evidence) | Application to Pandacorp |
|---|---|---|
| 3.1 | **4-step loop** "gather context → take action → **verify work** → repeat" so the agent can "catch mistakes before they compound". The **strongest feedback is rule-based** ("which rules failed and why"); linting is the example; **LLM-as-judge "generally not robust"**. [10][11] | It validates exactly `verify.sh` (tsc/mypy + lint). **Improvement:** have `verify.sh`'s error messages say **which rule failed and why** (actionable feedback), not just "FAILED". And have the `reviewer` **re-run** tests/lint/typecheck (it already does) instead of just opining. |
| 3.2 | **Subagents for 2 things**: parallelization (they finish in the time of the slowest, not the sum) and context management (a fresh isolated conversation; only the final message returns to the leader). E.g.: style-checker + security-scanner + test-coverage in parallel. [12][10] | In **powerful/deep** modes, run the 3 review lenses **in parallel** as subagents. The "on-demand" `researcher` is correct (it explores without polluting the leader's context). **Caveat:** concurrency is capped (~16) and may hit rate limits on lower plans. |
| 3.3 | **Automatic checkpoints** (state before each change, `/rewind`) + **background tasks** + hooks allow delegating broad tasks. **Documented caveat:** checkpoints do **NOT** track Bash changes (rm/mv) nor replace Git. [13][14] | Use **background tasks** for dev servers/long processes without blocking. Checkpoints are a session safety net, **but keep one commit per work order** (already a rule). The `implement` engine is a **resumable dynamic workflow** (state in the script's code + files + commits), so resuming is no longer the engine's problem; even so, **writing critical context to files** remains good practice as a shared source of truth between stages/subagents. |

---

## Dimension 4 — Living documentation and standards enforcement

| # | Finding | Application to Pandacorp |
|---|---|---|
| 4.1 | **Standards enforcement via deterministic rules** (strict linter/formatter/type-check in CI) is the form of quality that works best with AI code; *agent-independent gates* > trust in the agent. [15][16] | Already in `quality.md` + `verify.sh`. **Improvement:** elevate to per-PR CI (typecheck+lint+tests in parallel, e2e toward main) as a merge gate — consistent with constitution §11. |
| 4.2 | **Living documentation**: auto-generate ADRs and architecture docs from the code/commits (LLM in CI), so they don't become obsolete. [17][18] | Add a step in `release`/CI that **auto-generates a changelog** (from conventional commits) and **proposes ADRs** when it detects architectural changes. Keeps `docs/` in sync without human effort. |

---

## Dimension 5 — Mission Control UI/UX and honest gamification

> Through-line: **the eye must link sprite ↔ event ↔ card without reading text**, **failure must be as
> visible as achievement**, and **restraint** (few colors, few metrics, few theme variables) is the
> tool that protects an operator who is weak at design.

### (A) Live agent observability
- **A1. Persistent color per agent, reused across the ENTIRE UI** (sprite + feed + kanban). Double border if there are several projects: project-color (left) + agent-color (2nd). [19]
- **A2. Fixed and bounded iconic vocabulary (~12 events)** (read/write/edit/test ✅❌/start/end); combine event+tool. Reduces reading load. [19]
- **A3. Failure as a first-class state** (fallen sprite + red border + ❌, distinct from "completed"). It sustains the honesty of the XP. [19]
- **A4. Feed with follow-tail + a "pin" button + a cap of 100–200 events** so as not to degrade the render in long builds. [19]

### (B) Pipeline/DAG visualization and data-viz
- **B1. Same data, two views: RPG ↔ honest timeline/tree toggle** (work-orders→tasks→actions). One to "enjoy the show", another to "understand what happened". [20]
- **B2. DAG with path-focus + follow-mode + go-to-failure**: light up only the node's dependency chain, center the camera on the active step, shortcut to "first error". [21]
- **B3. Cheap render: Dagre (~39KB), avoid ELK.js (~1.4MB)** except for orthogonal routing. Explicit graph schema (node=WO, edge=dependency). [22][23]
- **B4. Live Pulse Chart** (bars per minute, color per agent) = an honest signal of "factory alive or stalled". Header with **≤5 KPIs** + a **Live/Stale** indicator with the timestamp of the last event. **Vendor-neutral (OpenTelemetry)** event schema to avoid lock-in. [19][24][25]

### (C) "Clean and impactful" visual craft
- **C1. Theme from ~3 OKLCH tokens** (base/accent/contrast) + surfaces by elevation. Linear went from 98 variables to 3; it enables a high-contrast mode without redesigning. [26]
- **C2. Accent as "punctuation", not paint** (a single rationed accent) + **`tabular-nums` on EVERY number** (XP, counts, stats, timestamps): engineering credibility almost for free. Geist/Vercel: "restraint as a feature". [27][26][28]
- **C3. Tokenized elevation/spacing scale (shadcn)**: 3 levels (canvas→panel→card/popup), 0.5rem radius, 16px base, 1px hairline, spacing in multiples of 0.25rem. [28][26]
- **C4. Sober and honest motion**: only `transform`/`opacity`, **<300ms**, *frequency test* (the everyday sober; reserve the expressive for achievement/level-up/WO-completed). 2–3 easing tokens. [29][30]
- **C5. Mandatory accessibility**: `prefers-reduced-motion` wraps all animation; **state via icon/shape in addition to color** (critical with a warm palette); `aria-label` in Spanish, `aria-live="polite"`, visible focus, contrast ≥4.5:1. [29][30][31]

### (D) Honest, non-toxic gamification
> Pandacorp already made the right decisions (XP by result, no streaks/leaderboards). These findings **validate** them and provide a checklist not to relapse.
- **D1. Live in the "White Hat" of Octalysis** (Epic Meaning, Achievement/Progress, Empowerment+Feedback): the greatest intrinsic asset is **seeing the agents work live** → invest in state legibility, leave XP as a secondary layer. [32][33]
- **D2. XP by verifiable result, never by activity** (avoids the *overjustification effect*): each achievement maps to something verifiable by CI — consistent with "agents never check their own checks". [33][34]
- **D3. Honest Zeigarnik + endowed progress**: show in-progress WOs with a partial bar; start chains with progress already made (Nunes & Drèze study: 34% vs 19% redemption) — honest because it corresponds to real work. **No nagging notifications.** [34][35]
- **D4. Ethical test as an acceptance criterion for every new mechanic** (5 UX Magazine questions). **"Secret" achievements must reveal their criterion upon unlocking** (no loot-box). Patterns NOT to replicate: streak anxiety, variable rewards, false urgency, leaderboards, a bar "stuck at 80%". [36][34]

---

## Prioritized roadmap

### P0 — High impact, strong evidence, low effort
1. **Break the shared test-writer↔implementer bias**: the `reviewer` (opus) writes adversarial tests the implementer did not see; anchor edge cases in EARS + bugs from `progress.md`. *(2.1, 2.2)*
2. **`verify.sh` as an anti-cheat gate**: add mutation testing (Stryker for TS / mutmut for Python), run in a clean environment, fail-closed parsing, don't expose test names. *(2.1, 2.3)*
3. **Mission Control — craft quick wins**: persistent color per agent + failure as a first-class state + `tabular-nums` + a single rationed accent. *(A1, A3, C2)*

### P1 — High impact, medium effort
4. **OWASP Top 10 Agentic (Dec 2025)** as a checklist in `security-auditor` + `release`. *(2.4)*
5. **Per-agent intermediate verification SOPs** (in `agents/*.md`) using MAST; document in the constitution which failure mode each hook prevents. *(1.2, 1.3)*
6. **Actionable `verify.sh` messages** ("which rule failed and why"). *(3.1)*
7. **Mission Control — visual system**: 3-token OKLCH theme + 3 elevations; `prefers-reduced-motion` + states with icon/shape + aria in Spanish; motion <300ms with frequency test; feed follow-tail+pin+cap. *(C1, C3, C4, C5, A4)*

### P2 — Structural / experimental
8. **Unattended parallelism**: concurrent subagents for the 3 review lenses + background tasks in powerful/deep modes; one commit per work order always. *(3.2, 3.3)*
9. **Mission Control — observability**: Live Pulse Chart + RPG↔timeline toggle + header ≤5 KPIs + Live/Stale indicator + DAG with path-focus (Dagre). *(B1–B4)*
10. **Custom eval harness** (SWE-bench style over our own projects) to measure quality regressions of the pipeline between versions. *(open question)*
11. **Living documentation**: auto-changelog from conventional commits + ADRs proposed by CI. *(4.2)*

---

## Limitations and time sensitivity
- The two most operational findings about "agent cheating" (2.3 environment hardening, 2.5 reward hacking) come from **a 2026 preprint by a single author, not peer-reviewed** — directionally strong but without replication. 2.2 (SAGA) and 2.5 had a 2-1 vote.
- The build engine is **Dynamic Workflows** (a native primitive, resumable at its root: state in the script + files + commits). Agent Teams and checkpoints are **recent/experimental** and evolve quickly (Agent Teams is reserved only for occasional adversarial review; checkpoints don't track Bash nor replace Git).
- The strong evidence is mostly from **primary sources** (papers, Anthropic docs/blog, OWASP), robust but biased toward "what the frameworks claim to design" rather than outcomes measured in production.

## References
[1] github.blog — Spec-driven development toolkit · [2] github.com/github/spec-kit · [3] arXiv 2308.00352 (MetaGPT) · [4] openreview VtmBAGCN7o · [5] github MAST · [6] arXiv 2503.13657 · [7] arXiv 2507.06920 · [8] arXiv 2605.02964 · [9] genai.owasp.org (Top 10 Agentic, 2025-12-09) · [10] anthropic.com/engineering/building-agents-with-the-claude-agent-sdk · [11] claude.com/blog/building-agents-with-the-claude-agent-sdk · [12] code.claude.com/docs/agent-sdk/subagents · [13] anthropic.com/news/enabling-claude-code-to-work-more-autonomously · [14] code.claude.com/docs/checkpointing · [15] blog.codacy.com/why-coding-agents-need-independent-quality-gates · [16] blog.reccehq.com/before-you-let-agents-touch-your-codebase-build-these-gates · [17] medium @iraj.hedayati (automatic ADRs) · [18] kinde.com (living architecture docs) · [19] github.com/disler/claude-code-hooks-multi-agent-observability · [20] docs.agentops.ai/v2/concepts/core-concepts · [21] buildkite.com/resources/blog/visualize-your-ci-cd-pipeline-on-a-canvas · [22] reactflow.dev/learn/layouting · [23] cambridge-intelligence.com/blog/react-graph-visualization-library · [24] docs.langchain.com/langsmith/dashboards · [25] opentelemetry.io/blog/2025/ai-agent-observability · [26] linear.app/now/how-we-redesigned-the-linear-ui · [27] designsystems.one/design-systems/vercel-geist · [28] interfaces.rauno.me · [29] github vercel-labs/open-agents web-animation-design · [30] animations.dev · [31] smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards · [32] yukaichou.com white-hat-black-hat-octalysis · [33] yukaichou.com left-brain-right-brain-core-drives · [34] uxmag.com gamification-or-manipulation · [35] learningloop.io endowed-progress-effect · [36] learningloop.io zeigarnik-effect
