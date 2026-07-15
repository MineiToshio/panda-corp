# Multi-runtime agent portability

> Domain: Factory operation · Severity: **MUST** (portable core) · Enforcement: manual (agent self-check per skill invocation; owner cross-runtime test plan). **factory-internal — not injected** into product projects (the project-facing slice ships via `AGENTS.md.tpl`'s "Other runtimes" section, DR-113). See DR-113, proposal `docs/proposals/25-multi-runtime-portability.md`, and CONV-12/DR-111 (which this generalizes).

## Purpose & scope

The Pandacorp factory — and, lighter, its product projects — is operable from **any coding agent that reads AGENTS.md and discovers Agent Skills** (`SKILL.md`): Claude Code (native), OpenAI Codex (app + CLI), Cursor, OpenCode. This standard defines the **portable core** (documents + file-state + skills), the **per-runtime capability matrix**, the **neutral model-tier vocabulary**, the **tool translation table**, and the **degradation rules** for the parts that don't port. It never forks the know-how (`factory/` is plain markdown, one canonical copy) and never degrades the Claude Code experience.

**The invariant that makes portability possible — durable handoff state lives in files, never only in a session.** Work-order frontmatter (`implementation_status`: `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), `.pandacorp/status.yaml` (`phase`, machine state), the change queue and the decisions inbox are the cross-session evidence. This is necessary but **not sufficient for live cross-runtime takeover**: the active executor also owns in-memory scheduling, commit serialization, review work, budgets and health brakes that files do not currently reconstruct completely. Therefore a runtime switch is a **cold continuation only after a clean safe point**: the current executor finishes its gate/commit, stops fully and releases ownership before a later runtime reads the files. No runtime may take over another runtime's live run. Only the *execution vehicle* is runtime-specific: Claude uses Dynamic Workflows and its supervisor; Codex uses `plugin/runtime/codex/executor.mjs` and its own supervisor. Certification controls whether that Codex executor may write normal projects; it is not a claim that Codex drives Claude's workflow — see PORT-5/PORT-6.

**Runtime locality is strict.** A Claude session or Dynamic Workflow dispatches only Claude agents/models; a Codex session dispatches only Codex agents/models. The runtimes share canonical files and deterministic contracts, not subagents, messages, transcripts or a live control plane. Deterministic, versioned and test-covered CLIs may be shared as the one writer for a governed transition once their migration slice is certified; Claude invokes them under the Dynamic Workflow's instruction, so the Workflow remains the Claude orchestration decision-maker (constitution §14).

**Executor parity is contractual, not mechanical identity.** R10/R11 certify the observable governed
contract of each runtime-local executor and the cold handoff between them. They do not require the
Claude Dynamic Workflow to eliminate every model-agent trust boundary or become the Codex executor.
Claude's workflow JavaScript has no native filesystem/process channel, so stop inspection currently
passes through a Claude subagent: receipt validation is fail-closed, and installed qualification proves
the real CLI path under hostile aliases, but this is not cryptographic proof of every future agent tool
call. That explicit platform limitation is tracked as non-blocking hardening in BL-0074. It does not
prevent R10/R11 from running or promoting the separately certified Codex executor.

## Rule — PORT-1 Runtime capability matrix

Which portable-core capability each supported runtime provides. When a cell is absent, the degradation rules (PORT-3/PORT-5/PORT-6) apply.

| Capability | Claude Code | Codex (app + CLI) | Cursor | OpenCode |
|---|---|---|---|---|
| AGENTS.md read (canonical instructions) | via `@AGENTS.md` import from `CLAUDE.md` | native (walks git root → cwd, concatenates; ~32 KiB budget) | native (editor + CLI) | native |
| SKILL.md discovery | native (`plugin/`) | `$REPO_ROOT/.agents/skills/` + `~/.agents/skills/` | native (skills support) | `.agents/skills/`, `.claude/skills/`, `.opencode/skills/` |
| Skill discovery path in this repo | `plugin/skills/` | `.agents/skills` → `plugin/skills` (committed symlink) | same symlink | same symlink |
| Subagents | native (`Agent`/`Task`, per-spawn model) | `.codex/agents/*.toml` (model baked in, explicit-request-only, depth 1, ≤ `max_threads`) | limited/none | limited/none |
| Build execution | native Dynamic Workflow: targeted or bare/global, background/unattended, resumable | **FALLBACK:** `attended_foreground` is implemented as a candidate but unavailable until its installed Codex-only canary is green | none | none |
| Hooks (lifecycle enforcement) | native (`hooks.json` + `${CLAUDE_PLUGIN_ROOT}`) | **source-certified for Codex CLI 0.144.1**: generated `PreToolUse` + `Stop` registration, strict payload adapter and execpolicy; each installation/update still requires explicit plugin install + hook trust | none wired | none wired |
| MCP | native | native (`.mcp.json`) | native | native |

**Reading the matrix:** AGENTS.md + SKILL.md discovery + MCP are the portable floor present everywhere, but **not by themselves permission to write the build state machine**. Codex remains denied while policy is `FALLBACK`; candidate code and a one-run permit are not authority. Subagents are shallow/absent outside Claude Code (degrade to sequential, PORT-3). Hook availability alone never grants or widens build permission.

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

### Current permission boundary — Codex remains FALLBACK pending its installed canary

Codex MUST NOT write normal project build state while canonical capability policy resolves
`implement.codex` to `FALLBACK`. The implemented `attended_foreground` profile is a promotion candidate,
not permission: the official launcher must stop before lease acquisition until one installed
Codex-only disposable canary is green and the policy is explicitly changed to `EXPERIMENTAL`.

The candidate profile contract, which becomes operative only after that promotion, is fail-closed at launcher, supervisor and executor:

- exactly **one** explicit target: one normalized FRD slug OR one exact `status: ready` change slug;
- foreground ownership for the full run, with cumulative `max-duration <= 7200` seconds;
- zero automatic restarts: a controller crash ends the run and releases/quiesces through the terminal path;
- sequential Codex-local STANDARD implementation and independent JUDGE review, deterministic
  `verify.sh`, and a parsed mutation receipt that must be green; missing, timed-out, ambiguous or
  below-threshold mutation evidence is red;
- milestones in `.pandacorp/comms/progress.md`, timing events in `.pandacorp/track.jsonl`, and the
  existing fenced lease/state writer remain the durable evidence;
- terminal scope is always partial: release ownership and keep `phase: implementation`. The profile
  cannot enter project-wide hardening, advance `phase: release`, drain an untargeted project, run in
  background/unattended/overnight mode, or invoke/delegate to Claude.

After promotion, the launcher issues a single-use attended permit bound to the project, run, exact target and limits;
the supervisor and executor consume their own stages before build mutation. Directly invoking either
controller without the profile and permit is denied before lease acquisition. The permit is authority
for this one attended run, not a reusable certification receipt.

Before promotion, **all** normal Codex build forms remain denied. After the narrow promotion, these broader forms remain denied: bare/global `/pandacorp:implement`, multiple FRDs,
hardening/release, background/unattended operation and factory-backlog drain-all. Cursor, OpenCode and
other non-Claude runtimes remain read/review-only on build state until separately promoted. Claude Code
keeps its Dynamic Workflow, Claude-only agents, supervisor and unattended behavior unchanged.

Runtime switching is outside this profile. If the owner later reopens that capability, it remains a
cold continuation only after a clean committed safe point, full stop and lease release—never live
takeover, simultaneous builds or runtime-to-runtime messaging.

**Legacy certification-only exceptions (not normal permission).** The R10/R11 evidence procedures
below remain preserved for any future cross-runtime or overnight qualification. They are separate
from `attended_foreground`: their distinct owner authorizations, markers and receipts consume a nonce
before lease acquisition, revoke it on every terminal path, reject replay after revocation and grant
no permission to another fixture, HEAD, scope or limit. Completing them is no longer a prerequisite
for the narrow Codex-only attended profile, and the attended permit cannot be substituted for either.

**R10 Stage 2.** One installed-canary
Stage 2 launched by the official Codex foreground launcher with a one-shot owner authorization. The
permit requires a non-symlink standalone repository below `pandacorp-canaries`, a versioned
`.pandacorp/certification/r10.json` identity (UUID + seed), exact plugin/overlay/engine pins, one
exact FRD and limits, authorization tied to the fixture, stage and current HEAD, and a clean Claude
safe point with no lease and a reachable `last_green_sha`. It is consumed before ownership and
revoked on every terminal result; a consumed nonce is never retried. This path only produces the
evidence this section requires and grants no write permission elsewhere.
The engine pin resolves only the regular, versioned managed-overlay file
`.claude/engines/pandacorp-build.js`; no `.pandacorp` engine alias or fallback exists. Permit checks
fail closed on missing, modified or symlinked engine provenance and never print the authorization
nonce.
Before authorization can be consumed, the permit also binds the regular Stage-1 evidence to the
current clean HEAD and requires the released projection to say `phase: implementation`,
`running: false`, the same Claude logical run, runtime and epoch, plus a non-empty acquisition time.
It invokes the canonical resolver and accepts only an automatic Claude→Codex cold-continuation verdict.
Missing or drifted projection fields fail closed before Codex can acquire ownership.

**R11 `LIVE_OVERNIGHT`.** One separately authorized foreground run in a non-symlink standalone
repository below `pandacorp-canaries`. Its committed `.pandacorp/certification/r11.json` marker and
fresh owner authorization bind the fixture UUID and seed, exact current HEAD, plugin and overlay,
the SHA-256 of the Codex executor, supervisor and launcher, at least two exact FRDs, and the exact
spend/duration/retry/block ceilings. The duration ceiling must permit at least three hours. Its
`pandacorp-r11-certification-receipt` is separate from R10 and is accepted only for stage
`codex-live-overnight`. The collector, not elapsed narration, decides whether the result qualifies as
`LIVE_OVERNIGHT`. Full procedure: `plugin/runtime/codex/R11-CERTIFICATION.md`.

### Governed sequential contract (candidate for Codex `attended_foreground`)

The Codex `attended_foreground` executor is implemented against the applicable targeted subset of this contract, but may not exercise it on a normal project until the installed canary and policy promotion; whole-project/hardening clauses remain future gates:

- **Same governed state machine.** Build Plan order, `implementation_status` frontmatter (`PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`), the same per-FRD gate (fresh reviewer pass + `verify.sh`), the same per-WO commits and safe-point rules.
- **VERIFIED is never rebuilt.** A cold successor derives pending work from canonical files only after the prior executor stopped and released the atomic lease.
- **Sequential by default.** No shared-tree parallel writes. Any later parallelism requires its own certified contract/ADR.
- **One atomic lease.** The certified lease, not the legacy `running` flag alone, fences acquire, heartbeat, stale reclaim and release across runtimes.
- **One atomic terminal instant.** A terminal checkpoint captures time once and uses that exact value
  for both `terminal_at` and `updated_at`. Executor completion, lease release, supervisor terminal and
  any certification-receipt revocation must name the same run/outcome and may not predate that instant;
  the evidence collector rejects split or causally impossible chains. `LIVE_OVERNIGHT` additionally
  binds every counted FRD to a JUDGE dispatch, green finish and real result artifact, and binds the
  complete receipt to its committed marker and owner authorization—starts or partial receipts do not count.
- **One logical build-run identity per cold continuation.** The shared resolver automatically reuses
  the prior `build_run_id` only at a released cross-runtime `phase: implementation` safe point, so
  durable dispatch, spend and health floors carry over without asking the owner for an ID. A
  same-runtime next pass, `phase: release`, missing/invalid prior state or explicit `new` intent starts
  a new run. Runtime/process identity stays local.

**Executor playbook (the Codex profile applies it to its one exact target):**

1. **Preflight.** `.pandacorp/status.yaml` exists (else STOP: not a factory project — route to `adopt`/`spec`). `overlay_version` not behind `plugin/templates/OVERLAY_VERSION` (else run `upgrade` first, DR-048). Readiness stamps present on every ACTIVE per-FRD `blueprint.md` (`readiness_gate: passed`, `grounding_gate: passed`) and `grep -rn "NEEDS CLARIFICATION" docs/` empty (DR-100/DR-102) — a plan that never passed its gates is not built.
2. **Atomic lease.** Acquire the R2 lease using the certified owner-token protocol; a failed acquire restores the prior projection before dropping ownership (and retains the fence if rollback itself cannot complete). Renew at the certified cadence, reclaim stale ownership only through the fenced protocol, and release only with the matching owner token on every exit. The active `phase`, `running`, acquisition time, logical run, runtime and epoch are one controller-owned projection re-derived from the fenced lease at renew, rollup and terminal safe points; duplicate/drifted YAML keys are canonicalized. Legacy status fields never become an independent lock.
3. **Plan.** Read every FRD's Build Plan + work-order frontmatter; list non-`VERIFIED` FRDs in cross-FRD dependency order. Announce to the owner what will be built and in what order.
4. **Per work order** (one at a time): stamp `IN_PROGRESS` → implement with TDD per the WO's EARS acceptance criteria → run the WO's own fast self-test → stamp `IN_REVIEW` + write the `## Status Note` hand-off → commit (one commit per WO, conventional message).
5. **Per-FRD gate** (when all its WOs are `IN_REVIEW`): re-read the feature with fresh eyes (correctness, security, quality, runtime lenses), write at least one adversarial test the implementation didn't anticipate, run `verify.sh` (or `verify.sh --since <last_green>` if available), then run the deterministic FRD mutation seam. For Codex `attended_foreground`, absent, timed-out, unparsable, ambiguous or below-threshold mutation evidence is RED. Green → stamp every WO + the FRD `VERIFIED` and publish the safe point with **two commits**: A contains the complete reviewed snapshot; metadata-only B records `last_green_sha: A` + `safe_to_test: true` only after proving A exists and is an ancestor of HEAD (BL-0066). Never amend A—a commit cannot contain its own hash. Red → fix in place; if genuinely stuck → `BLOCKED` + `blocked_reason` (`needs-owner` | `external` | `error`), log it to `.pandacorp/inbox/decisions.md` when the owner must act, and continue with an independent FRD. **On a REVERT (a `cause: 'code'` reopen), PRESERVE the test evidence (DR-107): MOVE the reviewer-authored / Status-Note-referenced test files to `.pandacorp/run/preserved-tests/` — never delete them — so the rebuild inherits the RED baseline that caught the fault.** **Append the gate's timing to `.pandacorp/track.jsonl`** (`review_start` / `review_end` / `frd_end`, with state — DR-086) so a later cold session (and Mission Control's timeline) can reconstruct the safe-point history from files.
6. **Safe point** (after each FRD gate): drain `status: ready` items from `.pandacorp/inbox/changes/` (route via the `iterate`/`bug` engine; `draft` is SKIPPED, DR-069) — **but ONLY on a bare, whole-project run: a TARGETED attended run (launched for a specific `change` or a `frds` subset) builds ONLY its target and does NOT drain the other `ready` changes** (they wait for a later bare `implement`); apply answered `decisions.md` entries (flip their BLOCKED WOs back to `PLANNED`); honor the **stop signal — `rethink_pending: true` in `status.yaml` OR the presence of `.pandacorp/run/stop` (equivalent)** — (stop cleanly + tell the owner); append a milestone line to `.pandacorp/comms/progress.md` (what shipped, in owner language — never raw tool output, BL-0014).
6b. **Feed the live dashboard (best effort, fire-and-forget).** Mission Control's Party reads a plain NDJSON stream any runtime can append to. At each WO start and each FRD gate, append one line to `~/.claude/dashboard-events.ndjson` (schema: `{"event":"<name>","at":"<ISO-UTC>","project":"<project folder basename>","data":{…}}`): `AgentWorking` with `data:{role:"<agent role>",wo:"<WO id>"}` at WO start; `gate` with `data:{frd:"<frd id>",result:"verified"|"reopened"}` at each gate. Never block or fail the build on a write error here — observability is best effort, the file state is the truth.
7. **Close-out (bare whole-project runs only).** When all global FRDs are `VERIFIED`, a bare run performs the hardening pass per DR-085 — security audit (evidence: `docs/reviews/security-<date>.md`), telemetry verification (evidence: `## Verification` in `docs/analytics/events.md`), full quality suite — BEFORE setting `phase: release`; if hardening can't run in this runtime session, say so explicitly and leave `phase: implementation` (never self-declare release without the evidence). A targeted `frds`/`change` run always terminates after its scoped FRDs verify, quiesces ownership and preserves `phase: implementation`, even when its target was the final global pending work; it has no authority to widen into project hardening/fixes or release. Remind the owner to run the lesson harvest from the factory.

These have no cross-runtime analogue and remain Claude-side; the **rules they enforce still bind every runtime as instructions** (stated in AGENTS.md), so governance is never lost — only the automated enforcement mechanism is.

| Claude-only capability | Why it doesn't port | What still binds every runtime |
|---|---|---|
| Background build engine (`pandacorp-build.js`, Dynamic Workflows) | injected `agent()`/`phase()`/`budget`, `Workflow({...})`, `TaskStop` — no identical non-Claude vehicle | Codex's candidate sequential executor remains unavailable while policy is FALLBACK; it never calls or replaces this Claude engine |
| Supervisor stack (`Monitor`, `ScheduleWakeup`, `PushNotification`, worktrees) | Claude uses native tools; Codex has a candidate foreground supervisor but no promoted build profile | After promotion the caller stays attached for ≤7200 s; background/overnight and the two Claude-owned recurring schedules remain unavailable in Codex |
| Hooks enforcement (safety gate, Stop verify-gate, telemetry) | registrations remain runtime-local; Codex uses a generated adapter and must re-trust changed hook definitions | shared policy is source-tested for Codex 0.144.1; an uninstalled/untrusted adapter fails the activation gate and does not grant build writes |
| Mission Control live telemetry | each runtime emits its own additive stream; Claude transcripts remain Claude-only | Mission Control reads both transports through the canonical vocabulary, while `status.yaml`, WO frontmatter and progress files remain truth |
| Claude Design canvas (`DesignSync`) | Claude-native tool | documented HTML-mockup fallback (DR-058 Plan B, PORT-3) |

## How it is verified

- **PORT-1/PORT-2/PORT-3/PORT-4:** manual — the agent self-checks the translation on each skill invocation under a non-Claude runtime; the injection point is AGENTS.md (always in context), so the worst case is the agent stops and asks. Cross-checked by the owner's Codex test plan (proposal Part 4).
- **PORT-5:** while policy is `FALLBACK`, verify every normal Codex launch fails before lease acquisition. The candidate implementation must also reject missing profile/permit, zero-or-multiple targets, background, duration >7200, restart, bare/global, hardening and release. A disposable installed Codex-only canary must prove one real targeted FRD and leave `phase: implementation`, a released lease and a clean tree; only then may policy change to `EXPERIMENTAL/attended_foreground`. R10/R11 remain separate future evidence for cross-runtime/overnight capability.
- **PORT-6:** Claude keeps its existing registration untouched. Codex enforcement is generated from `plugin/runtime/enforcement-policy.json` and tested by `test-codex-enforcement.mjs`; promotion additionally requires a disposable install, explicit hook trust and the live deny/Stop canaries in `plugin/docs/codex-activation.md`. Cursor/OpenCode remain instruction-only.

## Why

The standards landscape converged on two open standards we already fit — **AGENTS.md** (cross-tool instructions, our product overlay is already AGENTS.md-canonical) and **Agent Skills / SKILL.md** (open, unknown frontmatter fields ignored). That portable floor lets any compliant runtime read the same know-how and review the same durable evidence without forking it. It does **not** make every runtime a certified writer: build execution additionally requires runtime-local orchestration, atomic ownership, enforcement and one-writer transition proofs. Neutral tiers and explicit tool translation let each executor stay local to its own agents/models. Degradation is honest: Codex receives only the narrow attended targeted authority its executor has proved; every broader build form stays denied instead of borrowing confidence from Claude or from file persistence alone.

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
