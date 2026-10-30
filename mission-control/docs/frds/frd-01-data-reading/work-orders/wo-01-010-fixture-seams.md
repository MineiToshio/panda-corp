---
id: WO-01-010
type: work-order
slug: fixture-seams
title: 'WO-01-010 — Fixture seams: injectable clock, git runner and oracle-mode boot'
status: ACTIVE
parent: FRD-01
foundation: false
implementation_status: IN_REVIEW
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/clock/**'
  - 'src/lib/git/**'
  - 'src/lib/config/**'
  - 'scripts/oracle/**'
  - '.env.example'
  - 'README.md'
  - 'package.json'
source_requirements: [REQ-01-008, REQ-01-011]
dependsOn: [WO-01-000, WO-01-001]
last_updated: 2026-10-22
---

# WO-01-010 Fixture seams: injectable clock, git runner and oracle-mode boot

## Summary

Adds the three injection points that let the close-out fidelity gate replay Mission Control against the
fictional prototype factory without ever reading the owner's real one: `now()` (honours `MC_CLOCK`),
`runGit(args, cwd?)` (the only git boundary; read-only; answers from `MC_GIT_FIXTURE` when set), and
`pnpm dev:oracle`, the launcher that sets the whole technical-assumptions §1.5 recipe before the server
starts. It also documents every environment variable once in `.env.example` and the README, each with its
own comment line. No reader is migrated here except `config`; WO-01-011 migrates the kept readers and
every v2 WO migrates the readers it owns.

## In Scope

- `src/lib/clock/clock.ts`: `now(): Date`, evaluated at call time. `MC_CLOCK` set to a valid ISO-8601
  instant returns that instant (a new `Date` each call); set but unparseable throws `ClockConfigError`
  (fail loud, never falls back to the real clock); unset returns the real clock. Dependency-free (no
  `react`, no `next`) so the CLIs under `scripts/` can import it. Server-side by contract: Next inlines only
  `NEXT_PUBLIC_*` variables into client bundles, so `MC_CLOCK` never reaches a Client Component. Client
  Components receive `now` (an ISO string) from the server as a prop and never call `now()` or `Date.now()`
  for a displayed age; the module header states this rule.
- `src/lib/git/git.ts`: `runGit(args, cwd?): string` and `GitError` (typed: `kind` is `disallowed`,
  `failed`, `timeout` or `no-fixture-answer`; message never echoes file contents).
  - Real mode: spawns `git` with `execFileSync`, `cwd` default the factory root, an explicit timeout
    (10 s), a bounded `maxBuffer`, `GIT_OPTIONAL_LOCKS=0` so even `status` never touches the index, and a
    read-only allowlist of subcommands (`log`, `rev-parse`, `rev-list`, `status`, `diff`, `show`,
    `symbolic-ref`, `branch` in list forms, `worktree list`). Anything else is refused before spawning
    (`GitError` `disallowed`), which is what makes REQ-01-011 (never write) true for git.
  - Fixture mode (`MC_GIT_FIXTURE` set to a `git-state.json` path): never spawns a process. The repository
    is chosen from `cwd`: the factory root answers from `repos.factory`; a folder named `<id>` answers from
    `repos[<id>]` (the fixture's own `root` strings are display values, not lookup keys). A malformed or
    missing fixture file throws `GitError` once, loudly.
  - `src/lib/git/fixtureGit.ts` holds the dispatcher and `src/lib/git/fixtureAnswers.ts` the data-driven
    answer table. Base families (the commands the prototype's `fixtureGit()` in
    `docs/design/prototype/scripts/make-fixtures.mjs` answers): `symbolic-ref --quiet --short
    refs/remotes/origin/HEAD`, `worktree list --porcelain`, `branch --no-merged main
    --format=%(refname:short)`, `status --porcelain` (per worktree and `-- plugin`), `rev-list --count
    main..<branch>`, `log -1 --format=%ct|%s <branch>`, `diff --shortstat main...<branch>`. Added here
    because v2 readers need them: `rev-list --count HEAD` (from `commits`) and `log -1 --format=%cI` (the
    repository's last commit, from `lastActivity[<id>]`). The dispatcher answers `log -1 --format=%cI` from
    `lastActivity[<id>]` even when `repos[<id>]` is absent: the fixture has no `repos["mission-control"]`, yet
    the portfolio lists `mission-control` and `lastActivity["mission-control"]` exists, so its card must not
    fall to `no-fixture-answer`. A command with no answer throws `GitError`
    `no-fixture-answer`, exactly like a failing git, so readers take their existing fail-soft path.
    WO-01-011 extends the table with the history families the report readers issue.
    Also answered here, because W3 consumers read them (reconciliation 2026-10-22; a command the table cannot
    answer is a gap in the consumer's reader contract, never a reason to mock the reader):
    - FRD-21 (WO-21-003, AC-21-007.1/.2, states `worktrees-card`, `worktrees-branch-dialog`,
      `worktrees-unreadable`), per repository root of `git-state.json`: `worktree list --porcelain` (main
      worktree first, `locked` / `detached` flags from `extraWorktrees`, branch checkouts from
      `branches[].worktree`), `branch --no-merged <default>`, `rev-list --count`, `log -1` (subject and committer
      time), `status --porcelain` inside a branch worktree (the uncommitted count); under the
      `worktrees-unreadable` scenario `worktree list` fails for the `pandasaga` repository with the message
      «git worktree list terminó con error».
    - FRD-14 (WO-14-005, AC-14-001.1, AC-14-002.1, states `project-snapshot` and `project-snapshot-stale`): the
      snapshot gap queries of `src/lib/snapshot/gap.ts` (commits from `last_green_sha` to HEAD, the committer
      times of both commits, the subject of the green commit), with `a41c09e2` (WO-07-002 of FRD-07) for
      `project-snapshot` and 14 commits / 26 hours for `project-snapshot-stale`.
- `src/lib/config/env.ts`: the environment contract as typed constants (the variable names of
  architecture.md §7 "Environment variables": `PANDACORP_FACTORY_ROOT`, `PANDACORP_EVENTS_FILE`,
  `PANDACORP_CODEX_EVENTS_FILE`, `PANDACORP_ACCOUNTS_FILE`, `PANDACORP_CODEX_PLUGIN_ROOT`, `MC_CLOCK`,
  `MC_GIT_FIXTURE`) plus `resolveHomeDir()` (`HOME`, then `USERPROFILE`). `resolveFactoryRoot` and the
  import-time path constants of `src/lib/config/config.ts` stay as they are; the module header states why the
  variables must be set before the server starts. `PANDACORP_STALE_HOURS` is deliberately NOT part of the
  contract and is not documented: FRD-21 replaced its idle threshold with the legend rule (WO-21-003 uses fixed
  constants), and its only reader, `src/lib/pendingMerge/pendingMerge.ts`, is deleted by WO-13-013.
- `src/lib/config/oracleEnv.ts`: `oracleEnv(repoRoot): Record<string, string>`, the pure recipe of
  technical-assumptions §1.5: factory root `docs/design/prototype/fixtures/factory-root`, `HOME`
  `fixtures/home`, the two event files under that home, the accounts file under
  `fixtures/pandacorp-vault/services/accounts.yaml`, `MC_GIT_FIXTURE` `fixtures/git-state.json`,
  `MC_CLOCK` `2026-10-21T00:20:00.000Z` (a caller-supplied `MC_CLOCK` wins, for a diagnostic run) and
  `NEXT_TELEMETRY_DISABLED=1` (so the overridden `HOME` receives no framework writes). Absolute paths
  only; relative imports only (the launcher loads it through the repo's `ts-loader`). It never asserts that
  the Codex events file exists: `fixtures/home/.codex/dashboard-events.ndjson` is absent and the events reader
  already skips a missing transport.
- `scripts/oracle/dev-oracle.mjs` and the `package.json` script `"dev:oracle"`: builds the environment
  with `oracleEnv`, refuses with an actionable message when the fixture tree is missing
  (`node docs/design/prototype/scripts/make-fixtures.mjs` regenerates it) and then starts `next dev` on
  `127.0.0.1` (extra arguments such as `--port` pass through). It never reads the real factory and never
  generates fixtures implicitly.
- `.env.example`: every variable above, in labelled groups, commented out, each with its OWN one-line
  `# what it is for / how to obtain it` comment directly above it (CONV-16); the three already present
  keep their values and wording intent, and every comment that cites the config module names its real path
  `src/lib/config/config.ts` (today's comments say `src/lib/config.ts`). `HOME` is an OS variable and is not
  listed; `PANDACORP_STALE_HOURS` is not listed (above).
- `README.md`: the Getting-started environment section lists the variables (pointing to `.env.example`)
  and documents `pnpm dev:oracle`.

## Out of Scope

- Migrating any reader to `now()` or `runGit()` (WO-01-011 for the kept readers; v2 WOs for their own).
- The history answer families of the git fixture (phase history, verified dates): WO-01-011.
- Editing the prototype fixtures, `make-fixtures.mjs` or any frozen design file.
- Any change to `e2e/server-env.json`, `playwright.config.ts` or the gate files (canonical, DR-059).
- A runtime flag or UI affordance for oracle mode: the seams are inert unless their variable is set.

## Requirements & Acceptance Criteria

FRD-01 is REQ-only by design (a non-UI platform reader FRD; it defines no `AC-01-*` bullet), so this work
order owns no acceptance criterion. It enables the close-out fidelity gate (technical-assumptions §4.1,
open point F4) and keeps two FRD-01 requirements true by construction: REQ-01-008 (the live / no-signal
indicators read the clock) and REQ-01-011 (never write, never call Claude: the git boundary is read-only).
The platform source is architecture.md §7 "Fixture seams (oracle mode, ADR-0012)".

## Components & Interfaces

- `CMP-01-clock` with `IF-01-now`; `CMP-01-git` with `IF-01-runGit`; `CMP-01-env` with `IF-01-envContract`
  (and `resolveHomeDir`); `CMP-01-oracle-boot` with `IF-01-oracleEnv` and the `dev:oracle` script.
  Definitions in `../blueprint.md` §1 and §2.

## Reuse

Check-before-create (DR-057) found nothing to reuse: no clock or git runner exists. The one existing
precedent is `pendingMerge.ts`'s private `(args) => string` runner type, which this WO generalizes; the
prototype's `fixtureGit()` is the behaviour reference, ported to TypeScript, not imported (it lives under
frozen `docs/`).

## Installs

None.

## Visual reference

N/A: not a UI work order.

## Tests this WO owns

- `src/lib/clock/_tests/clock.test.ts`: frozen instant, new `Date` per call, invalid value throws
  `ClockConfigError`, unset returns a real instant, evaluated at call time (set after import).
- `src/lib/git/_tests/git.test.ts`: refuses a write subcommand (`commit`, `push`, `checkout`,
  `worktree add`) without spawning; real mode runs a read command in a throwaway repo and times out on a
  hanging command; `GIT_OPTIONAL_LOCKS=0` is set.
- `src/lib/git/_tests/fixtureGit.test.ts`: every base family answers from a committed small fixture;
  the child-process module is spied and never called in fixture mode; an unknown command throws
  `no-fixture-answer`; a malformed fixture file throws a typed error (DR-078 negative case).
- `src/lib/config/_tests/env.test.ts`: every name of the contract appears in `.env.example` with a comment
  line of its own directly above it and none is documented twice; `resolveHomeDir` fallbacks.
- `src/lib/config/_tests/oracleEnv.test.ts`: absolute paths, no value points outside the fixtures folder,
  caller `MC_CLOCK` wins, the recipe never contains the real home.
- Unchanged and still green: `src/lib/config/_tests/config.test.ts`.

## Derogated tests

None. Nothing existing pins the clock or git behaviour changed here.

## Definition of done

- The acceptance floor is the tests above, written first (RED, then GREEN).
- `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge.
- Error path per failure mode: invalid `MC_CLOCK`, missing or malformed git fixture, refused subcommand,
  git timeout, missing fixture tree for `dev:oracle`; each surfaces a typed error with an actionable
  message and no file contents.
- Non-functional: `runGit` has an explicit timeout and bounded output (resilience.md); no secret, no
  network call; the seams are present in every build (including `pnpm build`) and inert when their variable
  is unset, so `pnpm dev` and `pnpm start` behave exactly as before; production never sets them (ADR-0012).
- Every new exported function and type carries a short JSDoc; comments explain why only.
- Cite `LESSON-0450` in the commit (the harness must not let owner-private files into tests).

## Dependencies

WO-01-000 (fixtures harness) and WO-01-001 (`pathExists`, used by the launcher's fixture check). Consumers:
WO-01-011, WO-21-003, WO-03-007, WO-10-016 and every WO that reads time or git.

## Status Note

Implemented dependency-free call-time `now(): Date` / `ClockConfigError`, the read-only
`runGit(args: readonly string[], cwd?: string): string` boundary and shared `GitError`
(`disallowed | failed | timeout | no-fixture-answer`), typed `ENV`, `resolveHomeDir(): string`
and `oracleEnv(repoRoot: string): Record<string, string>`. `pnpm dev:oracle` uses the existing
TypeScript loader, checks required fixtures before spawning Next, passes through arguments, and
forwards termination signals. No existing reader is migrated in this work order.

Consumers inherit trimmed git stdout, a 10-second real-git timeout, 1 MiB output bound, disabled
optional index locks, and no subprocess output in surfaced errors. Fixture repository selection
uses the configured factory root, otherwise the cwd basename, with explicit branch-worktree
matching. Display-only fixture roots do not select a repository. Unknown reads throw; missing,
malformed and structurally invalid fixtures throw safe typed errors. Fixture files are re-read on
each call so temporary gate overlays take effect without stale cached state.

Scenario selection was unspecified in the source recipe: the optional top-level fixture JSON
`scenario` field accepts `snapshot-stale` or `worktrees-unreadable`; omit it for the default.
Only temporary copies should set it. The snapshot probe for funko-tracker's `a41c09e2` defaults to
3 commits / 5 hours, or 14 commits / 26 hours in the stale scenario, deriving HEAD time from
`lastActivity`. The unreadable scenario fails only pandasaga's worktree-list query.
The fixture green-commit subject is a deterministic descriptive oracle value because the frozen
fixture has no green-commit subject field. No frozen design files were changed.

Oracle paths are absolute, HOME and USERPROFILE both point into fixture home, telemetry is disabled,
and GIT_DIR / GIT_CEILING_DIRECTORIES fence unmigrated git readers away from the real repository.
The optional Codex event file is not required to exist. The Codex plugin cache override is also
isolated under fixture home. Environment path overrides must be set before config import.

Applied LESSON-0450: tests use explicit committed fictional git facts and temporary repositories,
never the owner's implicit factory or private home. The existing global test setup requires jsdom;
tests retain that environment and spy on the actual child-process boundary through its default
Node export. Read-fixture tests include the real Spanish prototype shape and malformed/missing
negative cases. Test files: `src/lib/clock/_tests/clock.test.ts`,
`src/lib/git/_tests/{git,fixtureGit}.test.ts`, `src/lib/config/_tests/{env,oracleEnv}.test.ts`,
`scripts/oracle/_tests/dev-oracle.test.ts`; existing `config.test.ts` remains unchanged.
No UI is owned, so visual fidelity and dialog e2e do not apply.
