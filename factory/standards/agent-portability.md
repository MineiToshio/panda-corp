# Multi-runtime agent portability

> Domain: Factory operation · Severity: **MUST** (portable core) · Enforcement: manual (agent self-check per skill invocation; owner cross-runtime test plan). **factory-internal — not injected** into product projects (the project-facing slice ships via `AGENTS.md.tpl`'s "Other runtimes" section, DR-113). See DR-113, proposal `docs/proposals/25-multi-runtime-portability.md`, and CONV-12/DR-111 (which this generalizes).

## Purpose & scope

The Pandacorp factory — and, lighter, its product projects — is operable from **any coding agent that reads AGENTS.md and discovers Agent Skills** (`SKILL.md`): Claude Code (native), OpenAI Codex (app + CLI), Cursor, OpenCode. This standard defines the **portable core** (documents + file-state + skills), the **per-runtime capability matrix**, the **neutral model-tier vocabulary**, the **tool translation table**, and the **degradation rules** for the parts that don't port. It never forks the know-how (`factory/` is plain markdown, one canonical copy) and never degrades the Claude Code experience.

**The invariant that makes it work — ALL durable state lives in files, never in a session.** The factory's state machine is driven by files any agent can read and write: work-order frontmatter (`implementation_status`: `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), `.pandacorp/status.yaml` (`phase`, machine state), the change queue (`.pandacorp/inbox/changes/`), the decisions inbox (`.pandacorp/inbox/decisions.md`). No progress is held in a runtime's transcript or memory. This is why a build one runtime started can be resumed by another (cross-runtime resume): the truth is on disk. Only the *execution vehicle* (Dynamic Workflows, the supervisor) is Claude-bound — see PORT-6.

## Rule — PORT-1 Runtime capability matrix

Which portable-core capability each supported runtime provides. When a cell is absent, the degradation rules (PORT-3/PORT-5/PORT-6) apply.

| Capability | Claude Code | Codex (app + CLI) | Cursor | OpenCode |
|---|---|---|---|---|
| AGENTS.md read (canonical instructions) | via `@AGENTS.md` import from `CLAUDE.md` | native (walks git root → cwd, concatenates; ~32 KiB budget) | native (editor + CLI) | native |
| SKILL.md discovery | native (`plugin/`) | `$REPO_ROOT/.agents/skills/` + `~/.agents/skills/` | native (skills support) | `.agents/skills/`, `.claude/skills/`, `.opencode/skills/` |
| Skill discovery path in this repo | `plugin/skills/` | `.agents/skills` → `plugin/skills` (committed symlink) | same symlink | same symlink |
| Subagents | native (`Agent`/`Task`, per-spawn model) | `.codex/agents/*.toml` (model baked in, explicit-request-only, depth 1, ≤ `max_threads`) | limited/none | limited/none |
| Background / unattended workflows | native (Dynamic Workflows, resumable) | **none locally** (Cloud only; `codex resume` reloads transcript) | none | none |
| Hooks (lifecycle enforcement) | native (`hooks.json` + `${CLAUDE_PLUGIN_ROOT}`) | events exist (`SessionStart`/`PreToolUse`/`PostToolUse`/`Stop`/…) but **not wired here yet** (V2) | none wired | none wired |
| MCP | native | native (`.mcp.json`) | native | native |

**Reading the matrix:** AGENTS.md + SKILL.md discovery + MCP are the portable floor present everywhere — that floor is enough to operate the factory's file-state machine. Subagents are shallow/absent outside Claude Code (degrade to sequential, PORT-3). Background workflows and hooks enforcement are Claude-Code-only (PORT-5/PORT-6).

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
| `Workflow` | **no equivalent** | the attended build loop (PORT-5) |
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

## Rule — PORT-5 The attended build loop (`implement` degradation)

Under any runtime other than Claude Code, `/pandacorp:implement` degrades to the **attended build loop** — the same state machine, run sequentially in-session with the owner present:
- **Same state machine.** Build Plan order, `implementation_status` frontmatter (`PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), the same per-FRD gate (fresh reviewer pass + `verify.sh`), the same per-WO commits, the same safe-point rules (change-queue drain, `decisions.md`) — executed **sequentially, in-session, owner present**.
- **VERIFIED is never rebuilt.** Anything already `VERIFIED` is skipped. This is exactly what makes **cross-runtime resume** work: Codex can continue a build Claude Code started (and vice versa), because the state is in the files, not the session.
- **No silent parallelism.** Fan-out only if the owner explicitly asks AND the runtime supports it (Codex explicit subagents, ≤ `max_threads`). Default is sequential.
- **The single-build lock applies across runtimes.** The concurrent-run guard (DR-050 §11) is file-based (`status.yaml` lock), so it is runtime-agnostic: a Codex attended build and a Claude background build cannot run on the same project simultaneously.

**The playbook (execute in order; each step names its file evidence):**

1. **Preflight.** `.pandacorp/status.yaml` exists (else STOP: not a factory project — route to `adopt`/`spec`). `overlay_version` not behind `plugin/templates/OVERLAY_VERSION` (else run `upgrade` first, DR-048). Readiness stamps present on every ACTIVE per-FRD `blueprint.md` (`readiness_gate: passed`, `grounding_gate: passed`) and `grep -rn "NEEDS CLARIFICATION" docs/` empty (DR-100/DR-102) — a plan that never passed its gates is not built.
2. **Lock.** Read `running` + `supervisor_heartbeat` in `status.yaml`: `running: true` with a heartbeat fresher than 10 min → ABORT (another build is live). Stale or absent → take the lock: `running: true`, `run_started_at: <now>`; refresh a heartbeat timestamp at every step below; on ANY exit — done, blocked, owner stop, error — the LAST act is `running: false` (never leave a lying flag, DR-068).
3. **Plan.** Read every FRD's Build Plan + work-order frontmatter; list non-`VERIFIED` FRDs in cross-FRD dependency order. Announce to the owner what will be built and in what order.
4. **Per work order** (one at a time): stamp `IN_PROGRESS` → implement with TDD per the WO's EARS acceptance criteria → run the WO's own fast self-test → stamp `IN_REVIEW` + write the `## Status Note` hand-off → commit (one commit per WO, conventional message).
5. **Per-FRD gate** (when all its WOs are `IN_REVIEW`): re-read the feature with fresh eyes (correctness, security, quality, runtime lenses), write at least one adversarial test the implementation didn't anticipate, run `verify.sh` (or `verify.sh --since <last_green>` if available). Green → stamp every WO + the FRD `VERIFIED`, commit, update `status.yaml` (per-status work-order counts + `last_green_sha`). Red → fix in place; if genuinely stuck → `BLOCKED` + `blocked_reason` (`needs-owner` | `external` | `error`), log it to `.pandacorp/inbox/decisions.md` when the owner must act, and continue with an independent FRD.
6. **Safe point** (after each FRD gate): drain `status: ready` items from `.pandacorp/inbox/changes/` (route via the `iterate`/`bug` engine; `draft` is SKIPPED, DR-069); apply answered `decisions.md` entries (flip their BLOCKED WOs back to `PLANNED`); honor `rethink_pending: true` (stop cleanly + tell the owner); append a milestone line to `.pandacorp/comms/progress.md` (what shipped, in owner language — never raw tool output, BL-0014).
6b. **Feed the live dashboard (best effort, fire-and-forget).** Mission Control's Party reads a plain NDJSON stream any runtime can append to. At each WO start and each FRD gate, append one line to `~/.claude/dashboard-events.ndjson` (schema: `{"event":"<name>","at":"<ISO-UTC>","project":"<project folder basename>","data":{…}}`): `AgentWorking` with `data:{role:"<agent role>",wo:"<WO id>"}` at WO start; `gate` with `data:{frd:"<frd id>",result:"verified"|"reopened"}` at each gate. Never block or fail the build on a write error here — observability is best effort, the file state is the truth.
7. **Close-out** (all FRDs `VERIFIED`): the hardening pass per DR-085 — security audit (evidence: `docs/reviews/security-<date>.md`), telemetry verification (evidence: `## Verification` in `docs/analytics/events.md`), full quality suite — BEFORE setting `phase: release`; if hardening can't run in this runtime session, say so explicitly and leave `phase: implementation` (never self-declare release without the evidence). Remind the owner to run the lesson harvest from the factory.

These have no cross-runtime analogue and remain Claude-side; the **rules they enforce still bind every runtime as instructions** (stated in AGENTS.md), so governance is never lost — only the automated enforcement mechanism is.

| Claude-only capability | Why it doesn't port | What still binds every runtime |
|---|---|---|
| Background build engine (`pandacorp-build.js`, Dynamic Workflows) | injected `agent()`/`phase()`/`budget`, `Workflow({...})`, `TaskStop` — no equivalent; Codex has no local unattended run | the attended build loop (PORT-5) runs the same state machine, owner present |
| Supervisor stack (`Monitor`, `ScheduleWakeup`, `PushNotification`, worktrees) | no background watch/wakeup/push outside Claude Code | the owner is present in the attended loop; notify in-chat |
| Hooks enforcement (safety gate, Stop verify-gate, telemetry) | hook registration format differs; matcher/payload parity unverified (V2 port pending) | the *rules* the hooks enforce are stated as instructions: never `rm -rf`, never declare done red, capture lessons |
| Mission Control live telemetry | reads Claude-side artifacts (`~/.claude/`, dashboard-events.ndjson, transcripts) | the file-state MC renders (`status.yaml`, WO frontmatter, `progress.md`) updates regardless of runtime |
| Claude Design canvas (`DesignSync`) | Claude-native tool | documented HTML-mockup fallback (DR-058 Plan B, PORT-3) |

## How it is verified

- **PORT-1/PORT-2/PORT-3/PORT-4:** manual — the agent self-checks the translation on each skill invocation under a non-Claude runtime; the injection point is AGENTS.md (always in context), so the worst case is the agent stops and asks. Cross-checked by the owner's Codex test plan (proposal Part 4).
- **PORT-5:** the same per-FRD gate the native engine uses (`verify.sh` + reviewer pass) runs in the attended loop; `VERIFIED` skip and the DR-050 lock are file-based, so they hold identically. review-only for the sequential-execution discipline itself.
- **PORT-6:** the Claude-only enforcement (hooks, verify-gate) stays wired on the Claude side; under other runtimes the enforced rules are review-only (stated in AGENTS.md as instructions) until the V2 hook port lands.

## Why

The standards landscape converged on two open standards we already fit — **AGENTS.md** (cross-tool instructions, our product overlay is already AGENTS.md-canonical) and **Agent Skills / SKILL.md** (open, unknown frontmatter fields ignored). Because every durable state the factory owns is a file, any AGENTS.md/Skills-compliant agent can drive the state machine; only the execution vehicle is Claude-bound. Making the tiers neutral and the tool translation explicit lets the owner operate dual-channel — talk to the factory from Claude Code *and* Codex, cross-checking each other's work — without forking the know-how or maintaining two divergent instruction files (the trap every team that copied CLAUDE.md↔AGENTS.md fell into). Degradation is honest: where a mechanism can't port, the governance (gates, language, doc discipline) still binds as instructions, so a weaker runtime is slower and more manual, never less correct.

## Maintenance — the single-source-of-truth map

Diagram: `docs/assets/multi-runtime-two-doors.svg` (two doors, one core).

Every piece has exactly ONE source of truth; the "other side" is a link, an import, or a generated artifact — never a hand-maintained copy. **Only one derived copy exists in the whole layer** (the Codex agent TOMLs), and it is script-generated:

| Piece | Single source | The other side is… |
|---|---|---|
| The 25 skills | `plugin/skills/*/SKILL.md` | **symlink** (`.agents/skills → plugin/skills`) — same physical files |
| The operating manual | `AGENTS.md` (repo root) | **import** (`CLAUDE.md` references it via `@AGENTS.md`; adds the Claude-only layer) |
| Standards, registry, factory docs | `factory/…` | shared as-is (every runtime reads the same file) |
| The 14 team agents | `plugin/agents/*.md` | **generated** — `.codex/agents/*.toml` via `plugin/scripts/generate-codex-agents.mjs` (provenance header, never hand-edited) |
| Plugin manifests | `plugin/.claude-plugin/plugin.json` | minimal mirror (`plugin/.codex-plugin/plugin.json`), version-synced by ritual |

**When an agent modifies X, it must also… (the cross-runtime modification guide):**

| You change… | Also do |
|---|---|
| A skill (`plugin/skills/*/SKILL.md`) | Nothing for Codex (symlink). For Claude: the normal plugin ritual (`claude plugin update`). Keep `name:` = the directory slug (spec requirement) |
| An agent (`plugin/agents/*.md`) | `node plugin/scripts/generate-codex-agents.mjs` (regenerates the 14 mirrors + 3 tier workers) |
| Root `AGENTS.md` | Keep it self-contained (no `@imports` — Codex doesn't expand them) and under ~32 KB (`project_doc_max_bytes`); anything Claude-only goes to `CLAUDE.md` instead |
| Root `CLAUDE.md` | Nothing — no other runtime reads it |
| The plugin version | Bump BOTH manifests to the same version |
| `plugin/hooks/` or scripts | Remember other runtimes get no enforcement (PORT-6) — if the rule matters cross-runtime, state it in AGENTS.md too (and see BL-0030 for the Codex hook port) |
| The overlay templates (`plugin/templates/`) | OVERLAY_VERSION bump, as always; the AGENTS.md.tpl "Other runtimes" section is part of the managed layer |

Both derived artifacts (TOMLs, manifest mirror) — plus the `.agents/skills` symlink — are **script-checked for drift**: `plugin/scripts/check-derived-drift.sh` (fail-closed; wired as a Stop hook in the factory repo, self-tested by `test-check-derived-drift.sh`). A stale TOML, a diverged manifest version, or a dangling skills symlink blocks the session from declaring done until regenerated/re-synced.
