# Dynamic Workflows

A **Dynamic Workflow** is a native Claude Code JS script that orchestrates subagents deterministically: what runs in parallel, what waits on what, where a quality gate sits, how many agents at most, and how to resume if the run is cut — all decided in code, not improvised per run by a model reading prose. This is distinct from a **skill** (`plugin/skills/*/SKILL.md`), which the model reads and interprets fresh each time; a skill shines on conversational, nuanced, one-off work, a dynamic workflow on repetitive fan-out with strict checkpoints that must behave the same way every run.

## The two engines

Two dynamic workflows exist today, both under `plugin/templates/shared/.claude/engines/` (the project template) or `.claude/engines/` (the factory's own copy) — never hand-invoked, always launched by the skill that owns them:

- **`pandacorp-build`** (`plugin/templates/shared/.claude/engines/pandacorp-build.js`) — the project build engine. Launched by `/pandacorp:implement` (`plugin/skills/implement/SKILL.md`), it runs INSIDE a product project: global-wave scheduling across FRDs, a per-FRD review gate (serial, or split into four parallel finder lenses + adversarial verify + an Opus closer under `reviewSplit` — see `PROFILES` in the engine source), and frontmatter-driven resume. See `plugin/skills/implement/SKILL.md` §"The dynamic workflow (pandacorp-build)" for the owner-facing summary.
- **`pandacorp-backlog`** (`.claude/engines/pandacorp-backlog.js`) — the factory backlog drain engine. Launched by `/pandacorp:implement-backlog` (`plugin/skills/implement-backlog/SKILL.md`) with no arguments, it runs IN the factory root: Scan → Implement (parallel, one isolated worktree per item, tier-sized model) → Merge (strictly serialized, one item at a time, a validator between every merge) → Report. See `plugin/skills/implement-backlog/SKILL.md` §"The dynamic workflow (pandacorp-backlog)".

These are two independent scripts with independent phases — `pandacorp-backlog` is not a mode of `pandacorp-build`.

## Why `.claude/engines/`, not `.claude/workflows/`

Claude Code auto-exposes every script under `.claude/workflows/` (project or `~/.claude/workflows/` user-level) as a `/` slash command. Both engines are internal machinery meant to be launched by their owning skill only — never typed directly by the owner — so they live in `.claude/engines/`, a directory Claude Code does not scan for the menu. A skill launches one by `scriptPath` (never by `name`, which is the form that DOES get menu-exposed):

```js
Workflow({ scriptPath: '<project-or-factory-root>/.claude/engines/pandacorp-build.js', args: { mode, maxAgents, projectDir, project } })
```

## The `args`-as-JSON-string quirk

Empirically, a `scriptPath` launch delivers `args` to the script as a JSON **string**, where a `name` launch used to deliver a plain object. Both engines carry the same normalization shim at the very top of the file, before any `args.*` read:

```js
if (typeof args === 'string') {
  try { args = JSON.parse(args) } catch (e) { log('FATAL: args arrived as an unparseable string: ' + e.message); throw e }
}
```

An unparseable string fails loud (throws) rather than silently falling back to defaults — a misconfigured run must never look like a normal one.

## Offline test harnesses

Both engines are plain JS executed with injected globals (`agent`, `log`, `budget`, `args`, `phase`, `parallel`) and delegate all real I/O to subagents via `agent(prompt, opts)` — which makes them deterministically simulable without Claude, a filesystem, or git: load the source, strip the single ESM `export`, wrap it in an `AsyncFunction` with the same global set the runtime injects, and run it with stub globals that answer by scripted, schema-conformant responses.

- **`plugin/scripts/test-pandacorp-build.mjs`** — the general `pandacorp-build` harness: 19 scenarios covering the args-string shim, the `maxAgents` brake (including its opus cost-weighting), frontmatter-driven resume, artifact-disjoint wave scheduling, the fail-safe close, the safe-point/change-queue drain and its targeted-build scoping, blocked-dependency handling, and hardening-gated `phase: release`.
- **`plugin/scripts/test-build-engine.mjs`** — a focused harness for the `reviewSplit` gate alone: powerful mode (split gate, a refuted finding dies, an Opus closer signs off), balanced mode (serial gate, no finder lenses), and a `maxAgents`-exhausted fallback to the serial gate.

Run either with `node plugin/scripts/<file>.mjs`; both report PASS/FAIL per scenario and exit non-zero on any failure.

## Going deeper

The canonical, exhaustive spec for both engines' mechanics — wave scheduling, the recovery ladder (patch-first → self-repair → revert+reopen), the concurrent-run guard, the supervisor contract, the change-queue drain, the split gate's contracts — lives in `factory/standards/build-orchestration.md`. This page only orients; it does not duplicate that spec.
