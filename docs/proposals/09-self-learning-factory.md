# Self-learning factory — accumulating know-how that compounds

> Generated 2026-06-15 from a deep web-research pass with adversarial verification
> (25 claims extracted, 24 confirmed by a 3-0 vote, all on primary sources: arXiv papers
> from NeurIPS/AAAI/ICLR/TMLR + first-party Anthropic/Letta/DeepMind docs). Each finding is
> connected to what to build in Pandacorp. The owner chose **alternative B** (semi-autonomous,
> eval-gated). This document is the canonical proposal; the policy is **DR-047**, the substrate
> is **`factory/memory/`**, and the history is in `factory/decision-log.md` (2026-06-15).

## Central thesis

A factory "gets smarter with use" not by **retraining a model** but by **externalizing experience
into retrievable artifacts and recalling them at the right moment**. Every verified state-of-the-art
mechanism is *gradient-free*: structured notes, memory blocks, executable skills, natural-language
insights, on-disk progress/skill files. The only systems that edit themselves at the code level
(DGM, AlphaEvolve) pair self-modification with a **mandatory empirical eval gate**.

That shape — *learn from experience, but verify before you keep it, and let a human gate the risky
edits* — is **the Pandacorp constitution itself** (§3 deterministic/adversarial verification, an
agent never validates its own work; §7 every human intervention reduces future ones). So a
self-learning loop does not fight the constitution: it is the constitution applied to the factory's
own evolution.

## 1. The two stacks of self-improvement (verified)

### A) Externalized memory — the substrate
| System | Mechanism | What we copy |
|---|---|---|
| **A-MEM** [1] | Each lesson is a Zettelkasten note (7 fields: content, time, keywords, tags, a one-line *context* for retrieval, embedding, links). Notes auto-link (top-k similarity → the LLM decides connections) and **"memory evolution"** rewrites neighbour notes when new experience arrives. | The typed-lesson schema, the one-line retrieval `context`, and *reconsolidation* (revise, don't only append). |
| **Letta / MemGPT** [2] | Memory is DB-persisted **"blocks"** the agent self-edits **unless `read_only`** (then only the developer) — a developer-gated control. Multiple agents **share** a block → cross-project knowledge base. | `read_only` = the gate; a *shared* store across projects. |

### B) Experiential improvement — distilling success/failure into reusable artifacts
| System | Mechanism | What we copy |
|---|---|---|
| **Voyager** [3] | An ever-growing **skill library of executable code** that composes and **transfers across worlds** (3/3 novel tasks vs 0/3 baselines), refined by env feedback + self-verification, no fine-tuning. | We already have this: `plugin/skills/`. The lesson: a skill library compounds. |
| **ExpeL** [4] | Gradient-free: extracts natural-language **insights by comparing a failed vs a successful trajectory**, recalls top-k similar past trajectories at inference. **Critical negative result: stacking "reflections" on top of the pairs was *harmful* — reflections hallucinate and poison insight extraction.** | Harvest lessons anchored to concrete evidence; **do not** harvest reflections-on-reflections. |
| **Self-Refine** [5] | One LLM in three roles (generate → critique → refine), ~+20% absolute, no training. | The `reviewer` already does this within a work order. |
| **Darwin Gödel Machine** [6] / **AlphaEvolve** [7] | Agents that **rewrite their own code**, but **every edit is validated on a benchmark before it is retained**; DGM keeps a lineage archive (used to *detect* reward-hacking — the agent once faked test logs). DGM 20%→50% SWE-bench; AlphaEvolve beat Strassen (48 mults, first in 56 years). | The **eval gate**: nothing self-applies without passing verification. Lineage = traceability. |

### C) Anthropic's own published pattern (most directly applicable)
"Structured note-taking" (agent writes notes outside context — to-dos, `NOTES.md`), long-running
state via `claude-progress.txt` + git history [8], and a public-beta **memory tool**
(`memory_20250818`) that CRUDs files under `/memories` so Claude "improves at recurring workflows"
across sessions [9]. This is exactly the file-based pattern Pandacorp already uses (`MEMORY.md`).

## 2. What is NOT solved (be honest, and seize it)

The research is explicit: of six areas, **governance (pruning stale lessons, anti-bloat,
anti-poisoning), an explicit "which library worked/failed" memory, and "Hermes"** produced
**no adversarially-verified claims**. Implications:

- **The library-verdict memory the owner wants is open ground** — no framework implements it well.
  It is simple to build and would give Pandacorp something almost nobody has.
- **Auto-pruning and auto-acceptance are unsafe without a gate.** ExpeL (reflections poison) and
  A-MEM (documented memory-poisoning vulnerability) prove it. → eval-gate + human-gate are not
  bureaucracy; they are the only verified governance pattern.
- **"Hermes Agent"** (the owner's reference) is real — NousResearch's agent, organized around
  *Memory / Skills / "Soul" / Crons*, described as self-improving and self-documenting ("writes its
  own manual") [10] — but those descriptions are secondary/unverified. Directional inspiration only;
  copy the *verified* mechanisms above. Its shape maps onto what we already have: Memory =
  `factory/memory/`, Skills = `plugin/skills/` + `learn`, Crons = `/loop` + `/schedule`.

## 3. What the factory already has (≈60% of the way)

| Self-learning piece | Exists? | Where |
|---|---|---|
| Policy (rules + defaults) | ✅ | `factory/decisions/registry.yaml` (47 DR) |
| History (what/why) | ✅ | the four decision logs |
| Know-how injected into projects | ✅ | `factory/standards/` via scaffold templates |
| Skill library + skill eval | ✅ | `plugin/skills/` + `learn` (delegates eval to `skill-creator`) |
| File-based memory pattern | ✅ | `MEMORY.md` |
| Scheduled self-runs (Crons) | ✅ | `/loop`, `/schedule` |
| ~15 capture points (bugs, reviews, ADRs, verdicts) | ✅ | bug, reviewer, `progress.md`, `review-launch`, portfolio… |
| **Cross-project memory** | ❌ | this proposal (`factory/memory/`) |
| **Automatic harvest of lessons** | ❌ | `learn` is 100% manual |
| **Retrieval of lessons at build time** | ❌ | Phase 2 |
| **Prune / self-questioning** | ❌ | Phase 4 |
| **Mission Control self-suggestion** | ❌ | Phase 5 (FRD-17); event stream already exists |

We do not build a new brain. We **close the loop** and add **one substrate**, **one agent**, **one
Mission Control surface**.

## 4. Alternatives (axis = autonomy)

| | A — Augmented | **B — Semi-autonomous (CHOSEN)** | C — Self-evolving |
|---|---|---|---|
| Auto-applies | nothing | **low-risk after eval-gate**; high-risk asks | almost everything (DGM-style) |
| Risk | minimal | low, controlled | high |
| Constitution fit | total | total (it *is* §3 + §7) | needs a hardened eval-harness first |
| Status | floor of B | **build this** | deferred north star |

**Chosen: B**, built incrementally from A's foundation. C is deferred until the eval-harness is
proven — the literature has no safe auto-pruning, and a solo operator cannot supervise a fleet that
self-rewrites without a rock-solid gate.

## 5. The closed loop and the phases

```
capture point ──▶ HARVEST (candidate) ──▶ factory/memory/ ──▶ RETRIEVE (at design/blueprint/implement)
                                               │                          │
                                               ▼                          ▼
                                          PRUNE (deprecate)  ◀── PROPOSE ──▶ GATE (eval + human) ──▶ PROMOTE (standard / DR / skill via learn)
```

- **Phase 0 — Substrate (this change).** `factory/memory/` with typed lessons (problem-solution |
  library-verdict | pattern | gotcha | anti-pattern), the schema, the README, a template, a first
  seed lesson, and **DR-047** (the tiered-autonomy policy). Committed English know-how, like standards.
- **Phase 1 — Harvest.** A new agent (the "cronista"/librarian) proposes a **candidate** lesson at
  the capture points (bug fixed; reviewer finding seen ≥2×; library chosen in blueprint →
  `library-verdict`, later confirmed by `review-launch`). Candidates only — never confirmed truth.
- **Phase 2 — Retrieve (highest leverage).** Agents query `factory/memory/` by domain/tags before
  `design`/`blueprint`/`implement`, and the relevant lessons are injected into context (like ExpeL
  recalls top-k, like Letta attaches shared blocks). *Without retrieval, the memory is a graveyard.*
- **Phase 3 — Promote with a double gate.** Owner-facing **Propuestas inbox** in Mission Control
  (new **FRD-17**) to approve/edit/reject; the **eval-gate** reuses existing machinery (`learn`
  requires a verifier; `skill-creator` benchmarks skills). This is where A→B is encoded as the
  risk tiers in DR-047.
- **Phase 4 — Prune / self-question.** A periodic `/loop`/`/schedule` job flags lessons never
  retrieved in N months, lessons contradicted by newer evidence, and standards/DR/skills that
  projects keep violating or that never trigger — **proposes** deprecation, never deletes (DR-011/DR-007).
- **Phase 5 — Mission Control self-suggests.** The same FRD-17 inbox surfaces bottleneck/velocity/
  "unused skill" insights computed locally from `dashboard-events.ndjson` + `status.yaml` + the memory.

`learn` is no longer a manual point-tool: it becomes the **apply stage** of this loop.

## 6. Governance & anti-poisoning (DR-047)

| Risk | Mitigation |
|---|---|
| Poisoning (a bad lesson contaminates) | candidate ≠ confirmed · confidence + corroboration (≥2 projects) · eval-gate · human gate for high-risk |
| Bloat | prune by staleness/usage (Phase 4) · reconsolidate instead of append (A-MEM) |
| Over-confidence (ExpeL) | anchor lessons to concrete evidence; no reflections-on-reflections |
| Self-edit breaks projects | risk tiers; anything touching projects is always human; MUST standards enter first as SHOULD |

This is already a recognized risk class in the factory: **Memory Poisoning** is in DR-017 (OWASP
Agentic ASI). DR-047 makes the mitigation explicit.

## 7. Phase 0 — shipped in this change

`factory/memory/{README.md, _lesson-template.md, LESSON-0001-*.md}` + DR-047 + this proposal. It is
100% safe (no auto-modification yet), and the `library-verdict` type already delivers the owner's
explicit ask: a durable record of which dependency worked or failed and why.

---

## Implementation status (shipped 2026-06-15)

Built and verified incrementally (plugin v6.1.0 → v6.3.0; `claude plugin validate` + a deterministic `validate-memory.sh` gate):
- **Phase 0** — `factory/memory/` substrate + DR-047 + this proposal.
- **Phases 1–4** — the `librarian` agent + `/pandacorp:memory` (harvest/review/status); retrieval wired into the build agents; `learn` as the promote stage; prune via `review`.
- **Capture (Tier 1), general & always-on** — a rule in `.pandacorp/guide.md` + the factory `CLAUDE.md` jots one-line candidates to a raw inbox; refined later with **A.U.D.N. dedup** + **provenance** (owner > CI > agent). Cadence = scheduled sweep + the Mission Control memory-health reminder (not tied to any single skill).
- **Promotion gate** — a durable **`promotion`** field (`proposed/approved/rejected`): `review` queues it, `/memory status` lists the queue, `learn` decides; the owner reviews the full list and decides whenever.
- **Phase 5** — Mission Control **FRD-17** (proposals inbox + memory-health panel + promotions queue) is specified.

Pending (deferred, consistent with DR-048): activating the scheduled `/loop` sweep once projects generate lessons, and reconciling the HTML prototype's Manual catalogs (the Reference auto-derives from source; the prototype hand-mirror is updated when the Next.js app is built).

## References
[1] A-MEM: Agentic Memory for LLM Agents — https://arxiv.org/abs/2502.12110
[2] Letta — Memory Blocks — https://www.letta.com/blog/memory-blocks
[3] Voyager: An Open-Ended Embodied Agent — https://arxiv.org/abs/2305.16291
[4] ExpeL: LLM Agents Are Experiential Learners — https://arxiv.org/abs/2308.10144
[5] Self-Refine: Iterative Refinement with Self-Feedback — https://arxiv.org/abs/2303.17651
[6] Darwin Gödel Machine — https://arxiv.org/abs/2505.22954 · https://sakana.ai/dgm
[7] AlphaEvolve — https://arxiv.org/abs/2506.13131
[8] Anthropic — Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
[9] Anthropic — Memory tool (memory_20250818) — https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
[10] Hermes Agent (NousResearch) — https://github.com/NousResearch/hermes-agent
