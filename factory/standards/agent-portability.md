# Multi-runtime agent portability

> Domain: Factory operation · Severity: **MUST** (portable core) · Enforcement: CLI fencing, runtime-local hooks and the checks named below; **factory-internal — not injected**. The project-facing slice ships through `AGENTS.md.tpl` (DR-113/DR-133).

## Purpose & scope

The factory's portable core is its canonical instructions, skills, documents and file state. Claude Code and Codex have equal owner authorization to read and write every skill/application, including plans and build state (DR-133). Tool availability and observed automation evidence are separate from permission.

**One instruction source (DEC-13).** `AGENTS.md` contains all instructions, including its Claude Code section; `CLAUDE.md` is exactly the one-line `@AGENTS.md` shim, never another maintained manual or a symlink. Non-Claude agents explicitly read the files AGENTS.md names because native import expansion is not assumed. `upgrade` migrates existing projects through `migrate-instructions.mjs`; it refuses a `CLAUDE.local.md` until its contents are reconciled.

**One executor.** Both sessions coordinate the runtime-neutral `plugin/scripts/pandacorp-build.mjs` CLI. Durable authority lives in the epoch-fenced lease, journal, work-order frontmatter and run scope; `state.json` is an honest cache. The main checkout's committed projection changes at landing. Do not infer a live run from `status.yaml` alone.

**Runtime locality.** Native subagents belong to the active runtime. The CLI is the narrow, deterministic vehicle for cross-company workers; it is not a shared subagent API or permission to launch another runtime's session directly. A Codex session and the Codex-only `drive` relay never call Claude. Safe continuation follows PORT-5, including authorized same-run transfers; arbitrary live takeover is forbidden.

## Rule — PORT-1 Runtime capability matrix

| Capability | Claude Code | Codex (app + CLI) | Cursor / OpenCode |
|---|---|---|---|
| Canonical instructions | `CLAUDE.md` imports `AGENTS.md` | native `AGENTS.md`; explicitly read named files | read `AGENTS.md`; verify discovery in that runtime |
| Skills | `plugin/skills/*/SKILL.md` | `.agents/skills` symlink to the same files | discovered skills or explicit file read |
| Subagents | native `Agent`/`Task` | native subagents / generated `.codex/agents/*.toml` | use available native tool, else sequential |
| Build executor | session coordinates the shared CLI | same CLI; `drive` is Codex-only | no automated vehicle is qualified; state the limitation |
| Hooks | `plugin/hooks/hooks.json` | generated adapter/registration; installation and trust are local | no wired equivalent claimed |
| Design canvas | Claude-native when available | HTML mockup fallback (DR-058) | HTML mockup fallback |

Source-tested Codex hook compatibility is not proof that every Codex app/CLI invocation fires those hooks. Preserve the rules even when a runtime has no enforcement tool, and do not claim unattended continuity without an observed working mechanism.

## Rule — PORT-2 Neutral model tiers

One runtime-neutral tier vocabulary — **MECH / STANDARD / JUDGE** — mapped per runtime. This generalizes CONV-12/DR-111 (whose haiku/sonnet/opus wording is exactly the Claude column below); do not contradict CONV-12 — reference it.

| Tier | Meaning | Claude Code | Codex |
|---|---|---|---|
| **MECH** | mechanical, zero judgment (a commit, a rename, a one-line tweak, grep-and-report) | haiku | `gpt-6-luna` (effort low) |
| **STANDARD** | real work, the default floor (implementation, research fan-out, most execution) | sonnet | `gpt-6.1-sol` (effort low) |
| **JUDGE** | genuine judgment / adversarial (architecture, red-team, open-ended synthesis) | opus | `gpt-6.1-sol` (effort high) |
| — | **never auto** (most expensive tier, owner request only) | Fable | (n/a) |

**A documented STANDARD variant, not a fourth tier (proposal 33 R-06).** `sonnet` + `effort: high` is load-bearing in this repo — `analytics`/`devops`/`librarian`/`security-auditor` (`plugin/agents/*.md` frontmatter) all pin it — but it stays a *variant* of STANDARD, never a promoted tier: the vocabulary above remains exactly MECH/STANDARD/JUDGE. The variant is reserved for agents that run **once per project phase**; the plain-`sonnet` STANDARD default stays on the five high-volume build-loop workers (`backend-dev`/`frontend-dev`/`implementer`/`researcher`/`test-writer`) that run many times per work order/FRD, where a raised default effort would compound cost with no phase-once ceiling.

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
| `Workflow` | **no equivalent** | backlog-only workflows stay Claude-local; product builds use the shared CLI and runtime-local workers; if a tool is missing, remain attended |
| `Monitor` / `ScheduleWakeup` | none | attended run (owner present) |
| `PushNotification` | `notify` / hooks | tell the owner in-chat |
| `AskUserQuestion` | — | ask in chat |
| `EnterWorktree` / `ExitWorktree` | — | `git worktree` by hand |
| `WebSearch` / `WebFetch` | Codex web search | ask the owner to paste the source |
| `DesignSync` | — | documented HTML-mockup fallback (DR-058 Plan B) |
| `$ARGUMENTS` in a skill body | — | the free text of the owner's request (skills have no `$ARGUMENTS` templating outside Claude Code) |

## Rule — PORT-4 Skill invocation protocol (non-Claude runtimes)

When the owner asks for a phase (`/pandacorp:x`, "ejecuta la fase x", `$x`):

1. Read `plugin/skills/<x>/SKILL.md` or its discovered equivalent.
2. Apply PORT-3 to any runtime-specific tool reference.
3. Apply PORT-5/PORT-6 where mechanisms differ. Describe missing capabilities honestly.
4. Human gates, independent verification, language and documentation discipline never degrade. Owner interaction is always Spanish; committed artifacts are English (DR-009). Canonical truth and the area's decision log are both required.
5. Internal engines (`user-invocable: false`) stay internal even when another runtime ignores that metadata. Building a feature/change/bug routes through `implement`; saving it for later creates a draft card validated by `card check`.

## Rule — PORT-5 Runtime-neutral execution and continuation

### Authorization, executor and one writer

**Full owner authorization (DR-133).** Codex and Claude Code may execute every skill and write project documentation and build state. Documentation-only phase work follows readiness/consistency gates without starting a build lease. Before changing an active plan, inspect the run and ownership; wait for the builder to stop at a safe point. Preserve unrelated edits.

**The CLI is the executor in both runtimes.** `node <plugin>/scripts/pandacorp-build.mjs <cmd>` is a deterministic Node program. The session resolves `<plugin>` from the installed plugin/factory path in `.pandacorp/guide.md` and follows CLI-returned actions. The CLI owns scope, lease, plan/admission, routing, transitions, commits, journal and landing. Do not recreate those decisions in the coordinator. Engine policy has one home, [build-engine.md](build-engine.md) BUILD-7..BUILD-15; command/file/schema interfaces live in [build-engine-cli.md](../../plugin/docs/build-engine-cli.md).

**One path to `main`.** A run never writes a tracked file in the project's main checkout. Workers own isolated unit worktrees; the CLI commits documentation, frontmatter, rollups, tracking and landing metadata on `lane/<run_id>/integration`. Only `.pandacorp/merge-queue.sh` with G3 lands that tree. During a run, a main-checkout reader sees the last landed docs; live progress comes from the CLI status, lease, run snapshot and events. This also applies to projects nested inside the factory.

### Dispatch boundary

A coordinator dispatches its own runtime's native agents. A Claude coordinator reaches Codex builders/reviewers only through the documented CLI action (`codex-worker.mjs --direct`), never by spawning a Codex session itself. A Codex coordinator and `drive` never launch Claude; unavailability and review degradation follow BUILD-10/BUILD-11, never a silent same-model pass. The Codex app has no Claude vehicle; use the CLI's availability/routing verdict rather than inventing one.

### Lease, relay and cold continuation

- **One lease.** The CLI uses `plugin/runtime/build-state.mjs` directly. Epoch fencing prevents a previous coordinator from mutating current state. Every fenced coordinator command renews ownership (`plugin/runtime/build/state.mjs:191`); there is no separate heartbeat process or second lock based on `running`.
- **Authorized same-run transfer.** `drive` is armed under BUILD-14 and can continue the already authorized run through `transfer`, keeping the run id and increasing the epoch. Token files stay private and are never printed. A transfer kills no worker and does not release the lease; stale reports and commands are fenced. The owner's `start --resume` transfers control back. Respect contention: do not reset an active relay's worktree when resume returns `CONTENDED`.
- **Foreign/dead ownership.** A stale foreign lease or a dead-owner release uses the documented owner-confirmed commands. A later runtime may continue released state only after the former executor stopped at a durable safe point. It reads the canonical files and preserves completed work; no runtime may seize another session's live run.
- **Honest continuity.** `drive` runs Codex workers and deterministic steps only. Fake-worker suite coverage is not a real unattended survival test. Detached-process survival, sleep and notification delivery remain unverified until observed on a live run; report the actual evidence.

### Gates, answers and upgrades

Review, deterministic verification and landing remain independent of the builder's self-report. The CLI owns VERIFIED transitions; an agent never stamps its own check. A targeted run cannot widen its scope, drain other cards or claim release. Owner questions in `open_questions` are answered through `answer`; `decisions.pending.md` is a reader mirror when canonical decisions are tracked, not a second writer.

Human gates retain their authority. A launched project's landing waits at `waiting_gate` for the owner's explicit production order. Neither the CLI nor `drive` sets `PANDACORP_OWNER_RELEASE_OK`. The untracked git pre-push hook protects the default branch even where runtime hooks are absent; `drive` is not armed in a launched project without a verified guard. The environment flag is a deliberate approval marker, not a secret or protection against intentional bypass. Worker briefs forbid setting it.

Never mix plugin versions on one project. `upgrade` refuses while a build is live. After plugin update, restart or close all sessions working on that project before continuing. The CLI status/lease is the build authority; the overlay's liveness check remains a compatibility check, never an alternative owner lease.

At close-out, preserve reports and pending owner state, and remove only eligible finished-run worktrees under BUILD-5/CONV-21. Keep owner data, uncommitted work and live/locked/deployed/in-use checkouts. The engine may remove an eligible clean terminal checkout while retaining its branch so resume can reconstruct it; deletion never means its pending work shipped.

## Rule — PORT-6 Runtime-local enforcement

Registrations remain runtime-local; governance is shared. Claude hooks call the canonical handler scripts; Codex uses generated registration, payload normalization and execpolicy from `plugin/runtime/enforcement-policy.json`. Each installation/update still requires its local hook trust. Absent hooks do not waive verification, protected state, ownership or production gates. The git pre-push guard is the build's cross-runtime production backstop (BUILD-13).

Scheduling and notifications depend on available tools. Use attended execution when they are absent; chat narration is not a scheduler. Mission Control reads the canonical event vocabulary and runtime transports; it never needs another runtime's transcript to establish build authority. Claude Design has the documented HTML fallback (PORT-3).

## How it is verified

- **PORT-1..PORT-4:** invocation-time tool translation and skill review; `check-skill-capabilities.mjs` validates capability metadata, not live-provider availability.
- **PORT-5:** `plugin/scripts/test-build-v2-{state,cli,next,drive,e2e,nested,answer}.mjs` cover fixture execution, fencing, relay and nested state/answers. `test-pre-push.sh` covers the guard; live unattended reliability still needs a real run. The retired launcher/executor qualification procedures are historical evidence only, recoverable through the retirement tag described in `plugin/docs/engine-v1-reactivation.md`.
- **PORT-6:** generate from `enforcement-policy.json` with `generate-codex-enforcement.mjs`; `test-codex-enforcement.mjs` checks source behavior. Installation/trust and actual runtime firing are separate checks. No runtime may weaken a gate because its hooks are absent.

## Why

One CLI and canonical file contract avoid artificial permission handoffs and conflicting executors. Runtime-local agents, epoch fencing, independent verification and human gates protect the work while honest capability reporting keeps automation claims tied to evidence.

## Maintenance — the single-source-of-truth map

Diagram: `docs/assets/multi-runtime-two-doors.svg` (two doors, one core).

Every piece has exactly ONE source of truth; the "other side" is a link, an import, or a generated artifact — never a hand-maintained copy. **Derived copies are generated**, including agent mirrors, manifests and enforcement registration:

| Piece | Single source | The other side is… |
|---|---|---|
| Skills | `plugin/skills/*/SKILL.md` | **symlink** (`.agents/skills → plugin/skills`) — same physical files |
| The operating manual | `AGENTS.md` (repo root) | **one-line shim** (`CLAUDE.md` contains only `@AGENTS.md`; the Claude Code section lives in AGENTS.md) |
| Standards, registry, factory docs | `factory/…` | shared as-is (every runtime reads the same file) |
| Team agents | `plugin/agents/*.md` | **generated** — `.codex/agents/*.toml` via `plugin/scripts/generate-codex-agents.mjs` (provenance header, never hand-edited) |
| Plugin manifests | `plugin/runtime/plugin-metadata.json` | both runtime-compatible manifests are projected by `plugin/scripts/generate-plugin-manifests.mjs`; Codex presentation/discovery metadata lives in its runtime extension |
| Repo-local Codex marketplace | canonical `plugin/` + `plugin/runtime/plugin-metadata.json` | `.agents/plugins/marketplace.json` catalogs `./plugins/pandacorp`; Codex resolves that path from the repository root, where `plugins/pandacorp → ../plugin` exposes the same physical plugin; no plugin files are copied |
| Cross-runtime enforcement behavior | `plugin/runtime/enforcement-policy.json` + the existing canonical handler scripts it names | runtime-local hook registration/config/rules are generated; Codex registration lives in `.codex/config.toml` + `plugin/hooks/codex-hooks.json`, never in its unsupported `plugin.json`; payload normalization lives only in `pandacorp-hook-adapter.mjs` |

**When an agent modifies X, it must also… (the cross-runtime modification guide):**

| You change… | Also do |
|---|---|
| A skill (`plugin/skills/*/SKILL.md`) | Nothing for Codex (symlink). For Claude: the normal plugin ritual (`claude plugin update`). Keep `name:` = the directory slug (spec requirement) |
| An agent (`plugin/agents/*.md`) | `node plugin/scripts/generate-codex-agents.mjs` (regenerates the agent mirrors and tier workers) |
| Root `AGENTS.md` | Keep all instructions here, including the Claude Code section; explicitly name files every runtime must read (do not rely on import expansion). Keep within the runtime's document budget; CLAUDE.md stays the one-line shim |
| Root `CLAUDE.md` | Keep it exactly `@AGENTS.md` plus a newline; migrate project content with `migrate-instructions.mjs`, never add a second instruction source |
| The plugin version/metadata | Edit `plugin/runtime/plugin-metadata.json`, then run `node plugin/scripts/generate-plugin-manifests.mjs` |
| Enforcement policy or canonical handler scripts | Regenerate with `node plugin/scripts/generate-codex-enforcement.mjs`; run `node plugin/scripts/test-codex-enforcement.mjs`; never hand-edit `codex-hooks.json`, `.codex/config.toml` or `.codex/rules/pandacorp.rules` |
| The overlay templates (`plugin/templates/`) | OVERLAY_VERSION bump, as always; the AGENTS.md.tpl "Other runtimes" section is part of the managed layer |

The derived artifacts (agent TOMLs, manifests and enforcement registration) — plus the `.agents/skills` symlink — are **script-checked for drift**: `plugin/scripts/check-derived-drift.sh` (fail-closed; wired as a Stop hook in the factory repo, self-tested by `test-check-derived-drift.sh`). A stale TOML, a diverged manifest version, or a dangling skills symlink blocks the session from declaring done until regenerated/re-synced.
