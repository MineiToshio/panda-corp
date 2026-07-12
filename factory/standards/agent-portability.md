# Multi-runtime agent portability

> Domain: Factory operation · Severity: **MUST** (portable core) · Enforcement: manual (agent self-check per skill invocation; owner cross-runtime test plan). **factory-internal — not injected** into product projects (the project-facing slice ships via `AGENTS.md.tpl`'s "Other runtimes" section, DR-113). See DR-113, proposal `docs/proposals/25-multi-runtime-portability.md`, and CONV-12/DR-111 (which this generalizes).

## Purpose & scope

The Pandacorp factory — and, lighter, its product projects — is operable from **any coding agent that reads AGENTS.md and discovers Agent Skills** (`SKILL.md`): Claude Code (native), OpenAI Codex (app + CLI), Cursor, OpenCode. This standard defines the **portable core** (documents + file-state + skills), the **per-runtime capability matrix**, the **neutral model-tier vocabulary**, the **tool translation table**, and the **degradation rules** for the parts that don't port. It never forks the know-how (`factory/` is plain markdown, one canonical copy) and never degrades the Claude Code experience.

**The invariant that makes portability possible — durable handoff state lives in files, never only in a session.** Work-order frontmatter (`implementation_status`: `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), `.pandacorp/status.yaml` (`phase`, machine state), the change queue and the decisions inbox are the cross-session evidence. This is necessary but **not sufficient for live cross-runtime takeover**: the active executor also owns in-memory scheduling, commit serialization, review work, budgets and health brakes that files do not currently reconstruct completely. Therefore a runtime switch is a **cold continuation only after a clean safe point**: the current executor finishes its gate/commit, stops fully and releases ownership before a later runtime reads the files. No runtime may take over another runtime's live run. Only the *execution vehicle* (Dynamic Workflows and its supervisor under Claude; a future separately certified Codex executor) is runtime-specific — see PORT-5/PORT-6.

**Runtime locality is strict.** A Claude session or Dynamic Workflow dispatches only Claude agents/models; a Codex session dispatches only Codex agents/models. The runtimes share canonical files and deterministic contracts, not subagents, messages, transcripts or a live control plane. Deterministic, versioned and test-covered CLIs may be shared as the one writer for a governed transition once their migration slice is certified; Claude invokes them under the Dynamic Workflow's instruction, so the Workflow remains the Claude orchestration decision-maker (constitution §14).

## Rule — PORT-1 Runtime capability matrix

Which portable-core capability each supported runtime provides. When a cell is absent, the degradation rules (PORT-3/PORT-5/PORT-6) apply.

| Capability | Claude Code | Codex (app + CLI) | Cursor | OpenCode |
|---|---|---|---|---|
| AGENTS.md read (canonical instructions) | via `@AGENTS.md` import from `CLAUDE.md` | native (walks git root → cwd, concatenates; ~32 KiB budget) | native (editor + CLI) | native |
| SKILL.md discovery | native (`plugin/`) | `$REPO_ROOT/.agents/skills/` + `~/.agents/skills/` | native (skills support) | `.agents/skills/`, `.claude/skills/`, `.opencode/skills/` |
| Skill discovery path in this repo | `plugin/skills/` | `.agents/skills` → `plugin/skills` (committed symlink) | same symlink | same symlink |
| Subagents | native (`Agent`/`Task`, per-spawn model) | `.codex/agents/*.toml` (model baked in, explicit-request-only, depth 1, ≤ `max_threads`) | limited/none | limited/none |
| Background / unattended workflows | native (Dynamic Workflows, resumable) | **none locally** (Cloud only; `codex resume` reloads transcript) | none | none |
| Hooks (lifecycle enforcement) | native (`hooks.json` + `${CLAUDE_PLUGIN_ROOT}`) | **source-certified for Codex CLI 0.144.1**: generated `PreToolUse` + `Stop` registration, strict payload adapter and execpolicy; each installation/update still requires explicit plugin install + hook trust | none wired | none wired |
| MCP | native | native (`.mcp.json`) | native | native |

**Reading the matrix:** AGENTS.md + SKILL.md discovery + MCP are the portable floor present everywhere — enough to read the factory, invoke certified non-build flows and review canonical state, but **not by themselves permission to write the build state machine**. Subagents are shallow/absent outside Claude Code (degrade to sequential, PORT-3). Codex hook source is now certified, but activation/trust and the executor transition proof are separate gates; hook availability alone never grants write permission. The interim write boundary and executor certification live in PORT-5/PORT-6.

## Rule — PORT-2 Neutral model tiers

One runtime-neutral tier vocabulary — **MECH / STANDARD / JUDGE** — mapped per runtime. This generalizes CONV-12/DR-111 (whose haiku/sonnet/opus wording is exactly the Claude column below); do not contradict CONV-12 — reference it.

| Tier | Meaning | Claude Code | Codex |
|---|---|---|---|
| **MECH** | mechanical, zero judgment (a commit, a rename, a one-line tweak, grep-and-report) | haiku | `gpt-5.4-mini` (effort minimal/low) |
| **STANDARD** | real work, the default floor (implementation, research fan-out, most execution) | sonnet | `gpt-5.5` (effort medium) |
| **JUDGE** | genuine judgment / adversarial (architecture, red-team, open-ended synthesis) | opus | `gpt-5.5` (effort high/xhigh) |
| — | **never auto** (most expensive tier, owner request only) | Fable | (n/a) |

**Rules (identical to CONV-12/DR-111, restated runtime-neutrally):**
- **Compute the tier from the SUBTASK's complexity**, never from the parent conversation's own tier (a session on JUDGE must not silently fan out subtasks at JUDGE).
- **Escalate upward, never downward** if a lower tier proves inadequate.
- **The runtime's most expensive tier (Fable-class) is never auto-selected** — only on the owner's explicit request, or after asking for confirmation before launching.
- On Codex the model is baked into each `.codex/agents/*.toml` (no per-spawn override), so the three generic tier workers (`tier-mech`, `tier-standard`, `tier-judge`) are the delegation vehicle; pick the worker whose tier matches the subtask.

## Rule — PORT-3 Tool translation table

When a skill's prose references a Claude-native tool, translate it to the runtime's equivalent; if none exists, apply the fallback. This table is injected at AGENTS.md level (always in context), not buried per-skill — tool-name leakage is a known port-breaker.

| Claude tool | Equivalent (Codex / other) | Fallback (no equivalent) |
|---|---|---|
| `Agent` / `Task` | Codex subagent (explicit, tier TOMLs) | do it inline, sequentially |
| `Workflow` | **no equivalent** | do not imitate/take over a live workflow; use a separately certified runtime-local executor only after PORT-5's gates |
| `Monitor` / `ScheduleWakeup` | none | attended run (owner present) |
| `PushNotification` | `notify` / hooks | tell the owner in-chat |
| `AskUserQuestion` | — | ask in chat |
| `EnterWorktree` / `ExitWorktree` | — | `git worktree` by hand |
| `WebSearch` / `WebFetch` | Codex web search | ask the owner to paste the source |
| `DesignSync` | — | documented HTML-mockup fallback (DR-058 Plan B) |
| `$ARGUMENTS` in a skill body | — | the free text of the owner's request (skills have no `$ARGUMENTS` templating outside Claude Code) |

## Rule — PORT-4 Skill invocation protocol (non-Claude runtimes)

When the owner asks for a phase (`/pandacorp:x`, "ejecuta la fase x", `$x`) on a non-Claude runtime:
1. **Read the skill file** — `plugin/skills/<x>/SKILL.md` (or the discovered skill) — and follow it.
2. **Apply the tool translation table** (PORT-3) for any Claude-native tool the text references.
3. **Apply the degradation rules** (PORT-5) where no equivalent exists.
4. **Human gates, language rules and documentation discipline are runtime-independent and NEVER degrade.** Every human gate (idea selection, design choice, release to production, spending money, external comms, deleting data), the language rule (committed = English / gitignored = Spanish; the interaction with the owner is **always in Spanish**, DR-009), and the two-layer decision-log discipline (canonical doc + area decision log) bind every runtime identically. A runtime that lacks a tool degrades the *mechanism*, never the *governance*.
5. Internal engine skills (`user-invocable: false`) are visible to other runtimes (they ignore that field); route through `change` exactly as Claude does — AGENTS.md marks which skills are internal.

## Rule — PORT-5 Build execution and cold runtime continuation

### Current permission boundary (R10 fixture result — binding now)

Proposal 32's R2 atomic lease, R3 enforcement and first R6 governed-transition slice are green. R7's
Codex-local executor also passes its offline disposable failure corpus, including two-phase terminal
release; R8 ready-change routing is green offline; and R10 proves bidirectional cold continuation
with real fenced CLIs in a disposable Git fixture. It is nevertheless **NO-GO for promotion**: the
installed Claude→Codex→Claude R10 canary is still pending and unattended certification remains R11. Codex and
every other non-Claude runtime are therefore still **read/review-only on any project with build
state**. They MUST NOT:

- start `/pandacorp:implement` or execute the write steps below;
- stamp work-order/FRD/build state, clear or take the current lock, or emit a build heartbeat;
- run concurrently with, steer, message, delegate to or take over a Claude Dynamic Workflow.

Use Claude Code for governed build writes during this interim. A later runtime may inspect/review the committed safe point, but a **runtime change is cold and safe-point-only**: the current executor completes its active gate and commit, drains/cancels its children, persists the handoff facts, stops fully and releases ownership; only then may a later runtime reconstruct state. `VERIFIED` remains skip-on-resume evidence, but that fact alone does not preserve the prior executor's in-memory scheduler, budget or health state and does not prove cross-runtime safety.

**Reevaluation trigger:** promotion requires the installed-runtime R10 canary and R11's unattended
canary in addition to the already-green R2/R3/R6/offline-R7/R8 and fixture-R10 evidence. Until that complete evidence set exists, no prose interpretation of
this playbook or local invocation of `launch-codex-implement.sh` grants write permission.

**R10 certification-only exception (not promotion).** The sole exception is one installed-canary
Stage 2 launched by the official Codex foreground launcher with a one-shot owner authorization. The
permit requires a non-symlink standalone repository below `pandacorp-canaries`, a versioned
`.pandacorp/certification/r10.json` identity (UUID + seed), exact plugin/overlay/engine pins, one
exact FRD and limits, authorization tied to the fixture, stage and current HEAD, and a clean Claude
safe point with no lease and a reachable `last_green_sha`. It is consumed before ownership and
revoked on every terminal result; a consumed nonce is never retried. This path only produces the
evidence this section requires and grants no write permission elsewhere.

### Future attended sequential contract (certification target; not current permission)

Once promoted by the gate above, a non-Claude `/pandacorp:implement` executor must satisfy this contract with strict runtime locality:

- **Same governed state machine.** Build Plan order, `implementation_status` frontmatter (`PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), the same per-FRD gate (fresh reviewer pass + `verify.sh`), the same per-WO commits and safe-point rules.
- **VERIFIED is never rebuilt.** A cold successor derives pending work from canonical files only after the prior executor stopped and released the atomic lease.
- **Sequential by default.** No shared-tree parallel writes. Any later parallelism requires its own certified contract/ADR.
- **One atomic lease.** The certified lease, not the legacy `running` flag alone, fences acquire, heartbeat, stale reclaim and release across runtimes.
- **One logical build-run identity per cold continuation.** The shared resolver automatically reuses
  the prior `build_run_id` only at a released cross-runtime `phase: implementation` safe point, so
  durable dispatch, spend and health floors carry over without asking the owner for an ID. A
  same-runtime next pass, `phase: release`, missing/invalid prior state or explicit `new` intent starts
  a new run. Runtime/process identity stays local.

**Certification playbook (execute only after promotion; each step names its file evidence):**

1. **Preflight.** `.pandacorp/status.yaml` exists (else STOP: not a factory project — route to `adopt`/`spec`). `overlay_version` not behind `plugin/templates/OVERLAY_VERSION` (else run `upgrade` first, DR-048). Readiness stamps present on every ACTIVE per-FRD `blueprint.md` (`readiness_gate: passed`, `grounding_gate: passed`) and `grep -rn "NEEDS CLARIFICATION" docs/` empty (DR-100/DR-102) — a plan that never passed its gates is not built.
2. **Atomic lease.** Acquire the R2 lease using the certified owner-token protocol; a failed acquire aborts without any state write. Renew at the certified cadence, reclaim stale ownership only through the fenced protocol, and release only with the matching owner token on every exit. Legacy `running`/heartbeat fields are projections during migration, never an independent lock.
3. **Plan.** Read every FRD's Build Plan + work-order frontmatter; list non-`VERIFIED` FRDs in cross-FRD dependency order. Announce to the owner what will be built and in what order.
4. **Per work order** (one at a time): stamp `IN_PROGRESS` → implement with TDD per the WO's EARS acceptance criteria → run the WO's own fast self-test → stamp `IN_REVIEW` + write the `## Status Note` hand-off → commit (one commit per WO, conventional message).
5. **Per-FRD gate** (when all its WOs are `IN_REVIEW`): re-read the feature with fresh eyes (correctness, security, quality, runtime lenses), write at least one adversarial test the implementation didn't anticipate, run `verify.sh` (or `verify.sh --since <last_green>` if available). Green → stamp every WO + the FRD `VERIFIED` and publish the safe point with **two commits**: A contains the complete reviewed snapshot; metadata-only B records `last_green_sha: A` + `safe_to_test: true` only after proving A exists and is an ancestor of HEAD (BL-0066). Never amend A—a commit cannot contain its own hash. Red → fix in place; if genuinely stuck → `BLOCKED` + `blocked_reason` (`needs-owner` | `external` | `error`), log it to `.pandacorp/inbox/decisions.md` when the owner must act, and continue with an independent FRD. **On a REVERT (a `cause: 'code'` reopen), PRESERVE the test evidence (DR-107): MOVE the reviewer-authored / Status-Note-referenced test files to `.pandacorp/run/preserved-tests/` — never delete them — so the rebuild inherits the RED baseline that caught the fault.** **Append the gate's timing to `.pandacorp/track.jsonl`** (`review_start` / `review_end` / `frd_end`, with state — DR-086) so a later cold session (and Mission Control's timeline) can reconstruct the safe-point history from files.
6. **Safe point** (after each FRD gate): drain `status: ready` items from `.pandacorp/inbox/changes/` (route via the `iterate`/`bug` engine; `draft` is SKIPPED, DR-069) — **but ONLY on a bare, whole-project run: a TARGETED attended run (launched for a specific `change` or a `frds` subset) builds ONLY its target and does NOT drain the other `ready` changes** (they wait for a later bare `implement`); apply answered `decisions.md` entries (flip their BLOCKED WOs back to `PLANNED`); honor the **stop signal — `rethink_pending: true` in `status.yaml` OR the presence of `.pandacorp/run/stop` (equivalent)** — (stop cleanly + tell the owner); append a milestone line to `.pandacorp/comms/progress.md` (what shipped, in owner language — never raw tool output, BL-0014).
6b. **Feed the live dashboard (best effort, fire-and-forget).** Mission Control's Party reads a plain NDJSON stream any runtime can append to. At each WO start and each FRD gate, append one line to `~/.claude/dashboard-events.ndjson` (schema: `{"event":"<name>","at":"<ISO-UTC>","project":"<project folder basename>","data":{…}}`): `AgentWorking` with `data:{role:"<agent role>",wo:"<WO id>"}` at WO start; `gate` with `data:{frd:"<frd id>",result:"verified"|"reopened"}` at each gate. Never block or fail the build on a write error here — observability is best effort, the file state is the truth.
7. **Close-out** (all FRDs `VERIFIED`): the hardening pass per DR-085 — security audit (evidence: `docs/reviews/security-<date>.md`), telemetry verification (evidence: `## Verification` in `docs/analytics/events.md`), full quality suite — BEFORE setting `phase: release`; if hardening can't run in this runtime session, say so explicitly and leave `phase: implementation` (never self-declare release without the evidence). Remind the owner to run the lesson harvest from the factory.

These have no cross-runtime analogue and remain Claude-side; the **rules they enforce still bind every runtime as instructions** (stated in AGENTS.md), so governance is never lost — only the automated enforcement mechanism is.

| Claude-only capability | Why it doesn't port | What still binds every runtime |
|---|---|---|
| Background build engine (`pandacorp-build.js`, Dynamic Workflows) | injected `agent()`/`phase()`/`budget`, `Workflow({...})`, `TaskStop` — no identical non-Claude vehicle | Codex stays read/review-only under PORT-5; its separate runtime-local executor is not PROVEN until the complete reevaluation set passes |
| Supervisor stack (`Monitor`, `ScheduleWakeup`, `PushNotification`, worktrees) | Claude uses native tools; Codex has a separate durable local supervisor and its current-head short-live gate is green, but the overnight gate remains open | while FALLBACK binds, use Claude for governed unattended builds; neither runtime duplicates the two Claude-owned recurring schedules |
| Hooks enforcement (safety gate, Stop verify-gate, telemetry) | registrations remain runtime-local; Codex uses a generated adapter and must re-trust changed hook definitions | shared policy is source-tested for Codex 0.144.1; an uninstalled/untrusted adapter fails the activation gate and does not grant build writes |
| Mission Control live telemetry | each runtime emits its own additive stream; Claude transcripts remain Claude-only | Mission Control reads both transports through the canonical vocabulary, while `status.yaml`, WO frontmatter and progress files remain truth |
| Claude Design canvas (`DesignSync`) | Claude-native tool | documented HTML-mockup fallback (DR-058 Plan B, PORT-3) |

## How it is verified

- **PORT-1/PORT-2/PORT-3/PORT-4:** manual — the agent self-checks the translation on each skill invocation under a non-Claude runtime; the injection point is AGENTS.md (always in context), so the worst case is the agent stops and asks. Cross-checked by the owner's Codex test plan (proposal Part 4).
- **PORT-5:** today, verify the negative permission mechanically by a supersession grep: no current operating surface may authorize non-Claude build writes or promise live/arbitrary cross-runtime resume. Promotion requires the complete R7/R8/R11 reevaluation set above; offline executor tests alone are insufficient.
- **PORT-6:** Claude keeps its existing registration untouched. Codex enforcement is generated from `plugin/runtime/enforcement-policy.json` and tested by `test-codex-enforcement.mjs`; promotion additionally requires a disposable install, explicit hook trust and the live deny/Stop canaries in `plugin/docs/codex-activation.md`. Cursor/OpenCode remain instruction-only.

## Why

The standards landscape converged on two open standards we already fit — **AGENTS.md** (cross-tool instructions, our product overlay is already AGENTS.md-canonical) and **Agent Skills / SKILL.md** (open, unknown frontmatter fields ignored). That portable floor lets any compliant runtime read the same know-how and review the same durable evidence without forking it. It does **not** make every runtime a certified writer: build execution additionally requires runtime-local orchestration, atomic ownership, enforcement and one-writer transition proofs. Neutral tiers and explicit tool translation let the owner operate dual-channel and cross-check safe-point artifacts while each executor stays local to its own agents/models. Degradation is honest: where a mechanism is not certified, governance still binds and write permission narrows — today to read/review-only for non-Claude build state — rather than pretending file persistence alone proves equivalence.

## Maintenance — the single-source-of-truth map

Diagram: `docs/assets/multi-runtime-two-doors.svg` (two doors, one core).

Every piece has exactly ONE source of truth; the "other side" is a link, an import, or a generated artifact — never a hand-maintained copy. **Only one derived copy exists in the whole layer** (the Codex agent TOMLs), and it is script-generated:

| Piece | Single source | The other side is… |
|---|---|---|
| The 25 skills | `plugin/skills/*/SKILL.md` | **symlink** (`.agents/skills → plugin/skills`) — same physical files |
| The operating manual | `AGENTS.md` (repo root) | **import** (`CLAUDE.md` references it via `@AGENTS.md`; adds the Claude-only layer) |
| Standards, registry, factory docs | `factory/…` | shared as-is (every runtime reads the same file) |
| The 14 team agents | `plugin/agents/*.md` | **generated** — `.codex/agents/*.toml` via `plugin/scripts/generate-codex-agents.mjs` (provenance header, never hand-edited) |
| Plugin manifests | `plugin/runtime/plugin-metadata.json` | both runtime-compatible manifests are projected by `plugin/scripts/generate-plugin-manifests.mjs`; Codex presentation/discovery metadata lives in its runtime extension |
| Repo-local Codex marketplace | canonical `plugin/` + `plugin/runtime/plugin-metadata.json` | `.agents/plugins/marketplace.json` catalogs `./plugins/pandacorp`; Codex resolves that path from the repository root, where `plugins/pandacorp → ../plugin` exposes the same physical plugin; no plugin files are copied |
| Cross-runtime enforcement behavior | `plugin/runtime/enforcement-policy.json` + the existing canonical handler scripts it names | runtime-local hook registration/config/rules are generated; Codex registration lives in `.codex/config.toml` + `plugin/hooks/codex-hooks.json`, never in its unsupported `plugin.json`; payload normalization lives only in `pandacorp-hook-adapter.mjs` |

**When an agent modifies X, it must also… (the cross-runtime modification guide):**

| You change… | Also do |
|---|---|
| A skill (`plugin/skills/*/SKILL.md`) | Nothing for Codex (symlink). For Claude: the normal plugin ritual (`claude plugin update`). Keep `name:` = the directory slug (spec requirement) |
| An agent (`plugin/agents/*.md`) | `node plugin/scripts/generate-codex-agents.mjs` (regenerates the 14 mirrors + 3 tier workers) |
| Root `AGENTS.md` | Keep it self-contained (no `@imports` — Codex doesn't expand them) and under ~32 KB (`project_doc_max_bytes`); anything Claude-only goes to `CLAUDE.md` instead |
| Root `CLAUDE.md` | Nothing — no other runtime reads it |
| The plugin version/metadata | Edit `plugin/runtime/plugin-metadata.json`, then run `node plugin/scripts/generate-plugin-manifests.mjs` |
| Enforcement policy or canonical handler scripts | Regenerate with `node plugin/scripts/generate-codex-enforcement.mjs`; run `node plugin/scripts/test-codex-enforcement.mjs`; never hand-edit `codex-hooks.json`, `.codex/config.toml` or `.codex/rules/pandacorp.rules` |
| The overlay templates (`plugin/templates/`) | OVERLAY_VERSION bump, as always; the AGENTS.md.tpl "Other runtimes" section is part of the managed layer |

Both derived artifacts (TOMLs, manifest mirror) — plus the `.agents/skills` symlink — are **script-checked for drift**: `plugin/scripts/check-derived-drift.sh` (fail-closed; wired as a Stop hook in the factory repo, self-tested by `test-check-derived-drift.sh`). A stale TOML, a diverged manifest version, or a dangling skills symlink blocks the session from declaring done until regenerated/re-synced.
