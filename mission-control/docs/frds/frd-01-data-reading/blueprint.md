---
id: FRD-01-blueprint
type: blueprint
parent: FRD-01
status: ACTIVE
implementation_status: PLANNED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---
# FRD-01 — Data reading layer — Feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how the data-reading layer is implemented on top of the
> platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)): the stack (§2), the factory filesystem
> data model (§4), the event contract (§5), the `src/lib/**` boundary (§6), the read-only invariant and the
> fixture seams (§7) and the environment variables (§7). It does not restate them.

---

## Purpose

FRD-01 is **the data layer**: the read interfaces every other feature builds on. It owns the
`src/lib/**` readers that turn the factory filesystem into typed, serializable data, plus the
**onboarding gate** that fires when `factory/profile.md` is absent. The platform golden rule is law here:
**read-only, never call Claude.** The single set of writes in the app (idea discard / restore / favourite,
change and backlog discard, the guild ledger) belongs to other FRDs.

v1 shipped every reader (WO-01-000 to WO-01-009, all `VERIFIED`, kept live and unchanged). **v2 adds one
thing**: the injection seams the close-out fidelity gate needs (technical-assumptions §4.1, open point F4):
a clock, a git runner and an oracle-mode boot, so the app can replay 159 captured states against the
fictional prototype factory and never read the owner's real one. Two work orders carry it: **WO-01-010**
(the seams, W2) and **WO-01-011** (adopting them in the readers no other v2 work order rewrites, W5). v2
also removes from FRD-01 the digest «Desde tu última visita», its `visto_hasta` marker and the
time-in-phase (age-in-stage) diffs (FRD-01 amended 2026-10-22; owner decision 2026-10-21).

## Components & Interfaces

Each reader is a pure-ish module (path or handle in, typed data out), unit-tested with fixtures via
`PANDACORP_FACTORY_ROOT`; all returned types are serializable. Paths are the real ones under `src/lib/`.

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-01-config` | module | `src/lib/config/config.ts` | Path constants and `resolveFactoryRoot`. Shipped with the foundation. | REQ-01-001 |
| `CMP-01-ideas` | module | `src/lib/ideas/ideas.ts` | Read and parse all idea cards (gray-matter). | REQ-01-003 |
| `CMP-01-profile` | module | `src/lib/profile/profile.ts` | Read the owner profile; signal absence for the onboarding gate. | REQ-01-001 / REQ-01-002 |
| `CMP-01-portfolio` | module | `src/lib/portfolio/portfolio.ts` | Parse the portfolio markdown table into project rows (path, repo). | REQ-01-004 |
| `CMP-01-status` | module | `src/lib/status/status.ts` | Read and validate `<project>/.pandacorp/status.yaml`, partial-tolerant, plus the live inbox counts wrapper. | REQ-01-005 / REQ-01-006 |
| `CMP-01-docs` | module | `src/lib/docs/docs.ts` | Discover the feature-centric `docs/` tree and the `.pandacorp/` comms per project. | REQ-01-007 |
| `CMP-01-events` | module | `src/lib/events/events.ts` | Tail and parse the event streams (capped, project filter before the cap) and derive `lastEventAt` / `byProject`. | REQ-01-008 / REQ-01-012 / REQ-01-014..019 |
| `CMP-01-live` | route + hook | `src/app/api/live/route.ts`, `src/hooks/useLiveSnapshot.ts` | The shared SSE transport with `stateVersion`; one `EventStore` singleton, per-connection filter. | REQ-01-008 / REQ-01-012 / REQ-01-013 |
| `CMP-01-onboarding-gate` | UI (Server) | `src/app/_components/OnboardingGate/OnboardingGate.tsx` + guard in `src/app/layout.tsx` | Render the gate instead of the app when no profile. | REQ-01-001 |
| `CMP-01-fs` | module | `src/lib/fs-utils/fs-utils.ts` | Read-only existence probe used by status, docs and portfolio not-found marking. | REQ-01-010 |
| `CMP-01-clock` (v2) | module | `src/lib/clock/clock.ts` | The only source of «now» for readers; honours `MC_CLOCK`. | REQ-01-008 |
| `CMP-01-git` (v2) | module | `src/lib/git/git.ts`, `fixtureGit.ts`, `fixtureAnswers.ts` | The only git boundary: read-only subcommands, timeout, answers from a fixture when `MC_GIT_FIXTURE` is set. | REQ-01-011 |
| `CMP-01-env` (v2) | module | `src/lib/config/env.ts` | The environment contract as typed constants and `resolveHomeDir`; checked against `.env.example`. | REQ-01-011 |
| `CMP-01-oracle-boot` (v2) | module + script | `src/lib/config/oracleEnv.ts`, `scripts/oracle/dev-oracle.mjs`, `pnpm dev:oracle` | The technical-assumptions §1.5 recipe that boots the app against the fixture factory. | REQ-01-011 |
| `CMP-01-seam-adoption` (v2) | changes | the readers listed in WO-01-011 | Route their clock and git calls through the seams; no behaviour change. | REQ-01-008 / REQ-01-011 |
| `IF-01-readProfile` | interface | `readProfile(): ProfileResult` | `{ present: false } \| { present: true; profile }`. Absence is explicit, never invented. | REQ-01-001 / REQ-01-002 |
| `IF-01-readIdeas` | interface | `readIdeas(): IdeaCard[]` | Cards of `IDEAS_DIR`, skipping `NON_IDEA_FILES`; frontmatter and body. | REQ-01-003 |
| `IF-01-readPortfolio` | interface | `readPortfolio(): PortfolioEntry[]` | Project rows; tolerate broken or empty rows. | REQ-01-004 |
| `IF-01-readStatus` | interface | `readStatus(projectPath): StatusResult` | `{ present, malformed, status: Partial<ProjectStatus> }`; never throws on absent or malformed. | REQ-01-005 / REQ-01-006 |
| `IF-01-readProjectDocs` | interface | `readProjectDocs(projectPath): ProjectDocsIndex` | Product layer, per-FRD modules, global docs, `.pandacorp/` comms. | REQ-01-007 |
| `IF-01-readEvents` | interface | `readEvents(opts?): EventsSnapshot` | Capped tail of both NDJSON transports, merged chronologically, deduplicated by `event_id`. | REQ-01-008 / REQ-01-012 / REQ-01-014..019 |
| `IF-01-pathExists` | interface | `pathExists(p): boolean` | Read-only existence probe; never throws. | REQ-01-010 |
| `IF-01-now` (v2) | interface | `now(): Date` | The frozen instant when `MC_CLOCK` is a valid ISO-8601 instant; throws `ClockConfigError` when it is set but invalid; the real clock when unset. | REQ-01-008 |
| `IF-01-runGit` (v2) | interface | `runGit(args: readonly string[], cwd?: string): string` and `GitError` | Trimmed stdout of an allowlisted read-only git command; throws a typed `GitError` (`disallowed`, `failed`, `timeout`, `no-fixture-answer`). | REQ-01-011 |
| `IF-01-envContract` (v2) | interface | `ENV` constants, `resolveHomeDir()` | One list of the environment variables, mirrored by `.env.example`. | REQ-01-011 |
| `IF-01-oracleEnv` (v2) | interface | `oracleEnv(repoRoot): Record<string, string>` | The pure environment of oracle mode (absolute paths, frozen clock, fixture git). | REQ-01-011 |

> **`visto_hasta` (REQ-01-009)** was client-local UI state owned by FRD-18 and is **out of v2** with the
> digest it fed. No component here; the read-only invariant (REQ-01-011) is unaffected.

---

## Contracts

### Type contracts (the data-layer surface)

Defined alongside their modules. Shapes mirror architecture §4.

```ts
// profile
type Profile = { name?: string; goals?: string; interests?: string[]; assets?: string[];
  projectsPath?: string; body: string };
type ProfileResult = { present: false } | { present: true; profile: Profile };

// ideas
type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";
type IdeaCard = { slug: string; title: string; status: IdeaStatus; projectType?: string;
  returnType?: "monetary" | "opportunity" | "personal" | "mixed"; score?: number;
  project?: string; body: string };

// portfolio
type PortfolioEntry = { name: string; path: string; repo?: string; originIdea?: string;
  phase?: string; users?: string; returnMetric?: string; verdict?: string; lastSync?: string };

// status
type Phase = "product" | "design" | "architecture" | "implementation" | "release";
type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };
// ProjectStatus: project, phase, version, running, pendingDecisions, pendingBugs, rethinkPending,
// advancePending, lastGreenSha, safeToTest, overlayVersion?, createdWith?, updatedAt?, repo?.
// The old progress / work-order-total fields have no reader (DR-092 / DR-115): work-order counts derive
// live from `listWorkOrders`, decisions and bugs from the live inbox (`readStatusWithLiveInboxCounts`).

// docs
type FrdModule = { slug: string; hasFdd: boolean; hasBlueprint: boolean; hasMocks: boolean;
  hasWorkOrders: boolean };
type ProjectDocsIndex = { prd?: string; architecture?: string; frds: FrdModule[]; hasAdr: boolean;
  hasAnalytics: boolean; hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] } };

// events (schema = architecture §5)
type Event = { event: string; at: string; agent?: string; session?: string; tool?: string;
  status?: "ok" | "fail"; workOrder?: string; task?: string; project?: string /* absent = legacy/global */ };
type EventsSnapshot = { events: Event[]; lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }> };
```

The `Event` type also carries optional enriched fields the parser tolerates from the real engine vocabulary,
read from a nested `data` object with a top-level fallback, where a wrong type drops that field and never
the event: `frd`, `phase`, `activity`, `mode`, `role` (FRD-06); `verdict`, `result`, `reopenCount`,
`blocking`, `important`, `agentType`, `effortLevel`, `maxAgents`, `wos`, `frds`, `reason`, `workflows`
(FRD-10); `stage`, `outcome`, `pass`, `routes`, `failed`, `attempt` (build-engine vocabulary). `wos` is
tolerated as a `"done/total"` string and as a plain count. Chronology uses `Date.parse`
(`event-time.ts`), never a lexicographic compare, because the engine mixes second- and millisecond-precision
stamps.

### Fixture seams (v2)

Each seam is **inert unless its variable is set**: `pnpm dev` and `pnpm start` never set them; only
`pnpm dev:oracle` (WO-01-010) and the test and e2e harnesses do. The variable list, defaults and who sets
them are architecture §7 "Environment variables"; `.env.example` documents each with its own comment line.

- `now()`: reads `MC_CLOCK` at call time, returns a new `Date` per call, throws on an invalid value, has no
  framework dependency (the CLIs under `scripts/` import it). It is server-side only in effect: Next inlines
  only `NEXT_PUBLIC_*` variables into client bundles, so `MC_CLOCK` never reaches a Client Component.
  Client Components receive `now` (an ISO string) from the server as a prop and never call `now()` or
  `Date.now()` for a displayed age.
- `runGit(args, cwd?)`: refuses any subcommand outside the read-only allowlist before spawning
  (`log`, `rev-parse`, `rev-list`, `status`, `diff`, `show`, `symbolic-ref`, `branch` list forms,
  `worktree list`); runs with an explicit timeout, a bounded output buffer and `GIT_OPTIONAL_LOCKS=0`. With
  `MC_GIT_FIXTURE` set it never spawns: the repository is chosen from `cwd` (the factory root answers from
  `repos.factory`; a folder named `<id>` from `repos[<id>]`) and the command from a data-driven answer table
  (the prototype's `fixtureGit()` families, plus `rev-list --count HEAD` and `log -1 --format=%cI`; WO-01-011
  adds the history families). A command without an answer throws `GitError` `no-fixture-answer`, exactly like
  a failing git, so each reader takes its existing fail-soft path.
- `oracleEnv(repoRoot)`: factory root `docs/design/prototype/fixtures/factory-root`, `HOME`
  `fixtures/home`, both event files under it, the accounts file under `fixtures/pandacorp-vault`,
  `MC_GIT_FIXTURE` `fixtures/git-state.json`, `MC_CLOCK` `2026-10-21T00:20:00.000Z` (a caller value wins),
  `NEXT_TELEMETRY_DISABLED=1`. Oracle mode never reads the owner's real factory (LESSON-0450: the harness,
  not each test, forces the default root).

## Tolerance rules (cross-cutting, architecture §7)

Every reader is fail-soft **and honest**: a missing or malformed input yields a partial result that says so,
never a throw and never a silent success that looks like data (DR-078).

- `readProfile`: `{ present: false }` on an absent file (drives the gate).
- `readIdeas`: skips `NON_IDEA_FILES`; a card with unparseable frontmatter is skipped and logged; an empty
  folder is `[]`.
- `readPortfolio`: an empty or missing file is `[]`; rows missing cells degrade to `undefined` fields; a row
  whose path is missing on disk is kept and marked (never dropped).
- `readStatus`: absent is `{ present: false }`; malformed YAML is `{ present: true, malformed: true,
  status: {} }`; partial keys are tolerated.
- `readProjectDocs`: reports only what exists; absent layers are empty or false.
- `readEvents`: a missing NDJSON is an empty snapshot; a malformed line is skipped and valid lines kept; the
  reader tail-reads only the last 256 KB (one fd, dropping the first partial line); the `project` filter is
  applied BEFORE the cap of 200; both transports are merged chronologically before the cap and an exact
  `event_id` repeats once.
- `pathExists`: never throws; a not-found project is marked and the rest of the view survives.

## Platform surfaces used

- `src/lib/**` boundary (architecture §6): this feature owns `config`, `ideas`, `profile`, `portfolio`,
  `status`, `docs`, `events`, `fs-utils` and, in v2, `clock` and `git`.
- App surface (architecture §11 and the Route map): cross-cutting. The only page-level piece is the
  onboarding gate in the root `layout.tsx` render path, and the route handler `/api/live`.
- Event contract and runtime-neutral adapter (Proposal 32 R9): the canonical vocabulary is
  `plugin/runtime/event-vocabulary.json`; Mission Control consumes only the generated, drift-checked
  projection `src/lib/events/event-vocabulary.json` and never keeps its own alias table. Legacy Claude
  (`~/.claude/dashboard-events.ndjson`) and Codex (`~/.codex/dashboard-events.ndjson`) transports are merged.
  `event-contract.ts` maps aliases to the stable semantic name and the La Fragua display name; result
  consumers ledger by `(run_id, event_name, subject)`, so transport ids and alias spelling cannot inflate XP
  or unlocks. Events are observability only: status, phase, work-order and build truth come from
  `.pandacorp/status.yaml`, work-order frontmatter and track / git evidence, whether the stream exists or not.
- Shared live transport (WO-01-009): `/api/live` and `useLiveSnapshot` are built on the readers above. A
  module-level `EventStore` singleton owns one `fs.watch` and a snapshot memoized by `{size, mtimeMs}`; every
  connection subscribes and filters for its own `?project=` / `?kind=` (shared read cap 600, per-frame tail
  200, debounced watch bursts, throttled frames). Per-client `stateVersion` watchers stamp each frame with the
  max mtime of the project machine state (`status.yaml` and the work-order files), so consumers re-read when
  state advances without an event (DR-066 fix 3). Downstream: FRD-05, FRD-06, FRD-12, FRD-18 subscribe to
  their slice instead of polling.

## Requirement → component traceability (REQ-01-MMM)

FRD-01 is **REQ-only by design**: a non-UI platform reader FRD with no `AC-01-*` bullets. The FRD lists
EARS bullets without ids; they are numbered here. **The numbering is frozen**: ids 001 to 011 keep the
meaning they have in every v1 work order; bullets added since take new numbers (012 onwards). The v1 table
mapped `CMP-01-events` to REQ-01-009 in one place and REQ-01-008 in another; the table below is the
correction (the events reader is REQ-01-008).

| REQ | FRD bullet (abridged) | Component(s) / interface(s) | Work order(s) |
|---|---|---|---|
| REQ-01-001 | No `profile.md`: onboarding gate before any view, with the copyable command. | `CMP-01-onboarding-gate`, `IF-01-readProfile` | WO-01-002, WO-01-008 |
| REQ-01-002 | `profile.md` present: read it to personalize. | `CMP-01-profile`, `IF-01-readProfile` | WO-01-002 |
| REQ-01-003 | Read all `factory/ideas/*.md` (skip template and log) with frontmatter. | `CMP-01-ideas`, `IF-01-readIdeas` | WO-01-003 |
| REQ-01-004 | Read `factory/portfolio.md`: projects and paths. | `CMP-01-portfolio`, `IF-01-readPortfolio` | WO-01-004 |
| REQ-01-005 | Read each `status.yaml`; counts derive live, never from status.yaml counters (DR-092 / DR-115). | `CMP-01-status`, `IF-01-readStatus` | WO-01-005 |
| REQ-01-006 | In-pipeline card: column from the project's `phase` (status.yaml is the single source). | `CMP-01-status` (the column map is FRD-02 `lib/board`) | WO-01-005 |
| REQ-01-007 | Read the feature-centric `docs/` tree and the `.pandacorp/` comms. | `CMP-01-docs`, `IF-01-readProjectDocs` | WO-01-006 |
| REQ-01-008 | Read the event stream: live and no-signal indicators (last event per running build). The digest diffs and age-in-stage are **out of v2**. | `CMP-01-events`, `CMP-01-live`, `CMP-01-clock`, `IF-01-readEvents`, `IF-01-now` | WO-01-007, WO-01-009, WO-01-010, WO-01-011 |
| REQ-01-009 | Persist the dashboard «seen» marker client-side. **Out of v2** (FRD-18 digest removed). | none (retired) | none |
| REQ-01-010 | Project path missing: mark not found, never break the view. | `CMP-01-fs`, `IF-01-pathExists`, `CMP-01-status` tolerance | WO-01-001, WO-01-005 |
| REQ-01-011 | NEVER call Claude or write (except FRD-02 discard; browser-local UI state is not a write). | cross-cutting: every reader is `fs.read*`; `CMP-01-git` read-only allowlist; `CMP-01-env`; `CMP-01-oracle-boot`; `CMP-01-seam-adoption` | WO-01-010, WO-01-011 |
| REQ-01-012 | A single-project event read applies the project filter BEFORE the tail cap. | `CMP-01-events`, `CMP-01-live` | WO-01-007, WO-01-009 |
| REQ-01-013 | `/api/live?project=` also watches the machine state and stamps `stateVersion`; `PANDACORP_EVENTS_FILE` overrides the path. | `CMP-01-live` | WO-01-009 |
| REQ-01-014 | Merge the Claude and Codex transports through one canonical vocabulary, preserving La Fragua display names. | `CMP-01-events` (`event-contract.ts`) | WO-01-007 |
| REQ-01-015 | Two records with the same `event_id` keep exactly one observation. | `CMP-01-events` | WO-01-007 |
| REQ-01-016 | Aliases of one result-bearing act ledger once by `(run_id, event_name, subject)`. | FRD-09 ledger over `CMP-01-events` | WO-01-007 |
| REQ-01-017 | A missing, malformed or deleted transport changes no phase, work-order or build state. | `CMP-01-events` fail-soft; status and work orders read from files | WO-01-007 |
| REQ-01-018 | Both transports are merged chronologically before the bounded tail cap. | `CMP-01-events` | WO-01-007 |
| REQ-01-019 | Dispatch-completion and change-reconciliation events stay non-result acts. | `CMP-01-events` (`event-contract.ts`) | WO-01-007 |

> The fixture seams (`CMP-01-clock`, `CMP-01-git`, `CMP-01-env`, `CMP-01-oracle-boot`) have no FRD bullet of
> their own; they trace to architecture.md §7 "Fixture seams (oracle mode, ADR-0012)" and, as consequences,
> to REQ-01-008 (the clock) and REQ-01-011 (read-only git). Reported to the PM as an FRD-01 wording gap in
> the architecture ledger.

## AC ⇄ design check

- «Onboarding gate before any other view»: enforced in `src/app/layout.tsx` (a server guard reads
  `readProfile` and renders the gate instead of children). Later editors of `layout.tsx` (WO-13-010,
  WO-19-002, WO-19-003) keep the guard and its `layout.guard.test.tsx`.
- «Single source of truth for phase»: `status.ts` exposes `phase`; the column map is FRD-02.
- «Never break the rest of the view»: tolerance rules and `pathExists`.
- «Never write»: read-only readers; `runGit` refuses write subcommands before spawning.
- No FRD-01 requirement is unbuildable on the platform.

## Dependencies & Risks

- Upstream: none (FRD-01 is the root of the data layer). Downstream: every FRD reads through it; the v2
  consumers of the seams are WO-21-003, WO-03-007, WO-10-016 (via WO-01-010) and the readers WO-01-011
  migrates.
- Risk: `config.ts` resolves some paths at import time, so the oracle variables must be set before the
  server starts; `dev:oracle` guarantees it, a test that needs a different root uses `withFactoryRoot`.
- Risk: the history answers of the git fixture must match each reader's parser output; WO-01-011 proves it
  with fixture-mode tests rather than by inspection.
- `HOME` is overridden in oracle mode, so the launcher sets `NEXT_TELEMETRY_DISABLED=1` and the framework
  writes nothing into the fixtures.

## Build Plan

> The build engine reads this table; it does not infer dependencies. Legacy v1 work orders are kept live
> (`VERIFIED`, unchanged) so the plan, the AC matrix and the waves are consistent project-wide. Waves are
> computed from `dependsOn` across the whole project.

| WO | Depends on | Artifacts | Foundation | Parallel with |
|---|---|---|---|---|
| WO-01-000 | — | `src/tests/fixtures/index.ts`, `src/tests/fixtures/_tests/**`, `src/tests/fixtures/factory-full/**`, `src/tests/fixtures/factory-fresh/**`, `src/tests/fixtures/events/**` | false | W0 |
| WO-01-001 | WO-01-000 | `src/lib/fs-utils/fs-utils.ts`, `src/lib/fs-utils/_tests/fs-utils.test.ts`, `src/lib/fs-utils/_tests/fs-utils.adversarial.test.ts` | false | W1; with WO-01-002, WO-01-003, WO-01-004, WO-01-007 |
| WO-01-002 | WO-01-000 | `src/lib/profile/profile.ts`, `src/lib/profile/_tests/profile.test.ts`, `src/lib/profile/_tests/profile.adversarial.test.ts` | false | W1; with WO-01-001, WO-01-003, WO-01-004, WO-01-007 |
| WO-01-003 | WO-01-000 | `src/lib/ideas/ideas.ts`, `src/lib/ideas/_tests/ideas.test.ts`, `src/lib/ideas/_tests/ideas.adversarial.test.ts` | false | W1; with WO-01-001, WO-01-002, WO-01-004, WO-01-007 |
| WO-01-004 | WO-01-000 | `src/lib/portfolio/portfolio.ts`, `src/lib/portfolio/_tests/portfolio.test.ts`, `src/lib/portfolio/_tests/portfolio.adversarial.test.ts` | false | W1; with WO-01-001, WO-01-002, WO-01-003, WO-01-007 |
| WO-01-007 | WO-01-000 | `src/lib/events/events.ts`, `src/lib/events/_tests/events.test.ts`, `src/lib/events/_tests/events.adversarial.test.ts` | false | W1; with WO-01-001, WO-01-002, WO-01-003, WO-01-004 |
| WO-01-005 | WO-01-000, WO-01-001 | `src/lib/status/status.ts`, `src/lib/status/_tests/status.test.ts`, `src/lib/status/_tests/status.adversarial.test.ts` | false | W2; with WO-01-006, WO-01-008, WO-01-010 |
| WO-01-006 | WO-01-000, WO-01-001 | `src/lib/docs/docs.ts`, `src/lib/docs/_tests/docs.test.ts`, `src/lib/docs/_tests/docs.adversarial.test.ts` | false | W2; with WO-01-005, WO-01-008, WO-01-010 |
| WO-01-008 | WO-01-002 | `src/app/_components/OnboardingGate/**`, `src/app/_tests/layout.guard.test.tsx`, `src/app/layout.tsx` | false | W2; with WO-01-005, WO-01-006, WO-01-010 |
| WO-01-010 | WO-01-000, WO-01-001 | `src/lib/clock/**`, `src/lib/git/**`, `src/lib/config/**`, `scripts/oracle/**`, `.env.example`, `README.md`, `package.json` | false | W2; with WO-01-005, WO-01-006, WO-01-008, WO-13-012, WO-11-003 |
| WO-01-009 | WO-01-005, WO-01-007, WO-05-001 | `src/app/api/live/**`, `src/hooks/useLiveSnapshot.ts`, `src/hooks/_tests/useLiveSnapshot*.test.ts` | true | W3 |
| WO-01-011 | WO-01-010, WO-10-014, WO-23-006, WO-14-001, WO-14-005, WO-17-003, WO-17-005, WO-17-008, WO-09-006, WO-01-009, WO-15-003, WO-21-003 | `src/lib/achievements/report/**`, `src/lib/achievements/read-model/**`, `src/lib/snapshot/**`, `src/lib/memory/memory-health.ts`, `src/lib/self-suggest/**`, `src/lib/gamification/ledger.ts`, `src/lib/build-track/**`, `src/lib/git/fixtureAnswers.ts`, `src/lib/git/_tests/gitBoundary.test.ts`, `src/app/api/live/**`, `src/app/api/plugin-sync/**`, `src/app/_actions/snapshotLedger.ts` | false | W5; with WO-04-010, WO-18-002 |

- **Order and parallelism.** WO-01-000 first (every reader consumes its fixture tree). The pure readers
  (001, 002, 003, 004, 007) are independent and run in parallel in W1; 005, 006, 008 and the new 010 run in
  W2; 009 (the live transport, `foundation: true`, consumed by the real-time surfaces) in W3; WO-01-011 last
  (W5) because it migrates readers other FRDs finish first.
- **Artifacts, disjoint within a wave (DR-060).** Same-wave rows write different `src/lib/<module>/` folders
  (W1, W2); WO-01-010 owns `package.json`, `.env.example`, `README.md` and `scripts/oracle/**` in W2, and no
  other W2 work order writes them. Overlaps with later waves (`src/app/api/live/**` in WO-01-009 and
  WO-01-011, `src/lib/git/**` in WO-01-010 and WO-01-011, `src/lib/snapshot/**` in WO-14-005 and WO-01-011,
  `src/app/layout.tsx` with the shell WOs) are serialized by a `dependsOn` edge, never by the wave label alone.
- **Integration order.** Seams (010) before any consumer: WO-21-003 and WO-03-007 depend on WO-01-010 and
  adopt `runGit` / `now` for what they own; WO-01-011 closes the rest. The oracle-mode boot is complete
  only after WO-01-011.
- **Cross-FRD dependencies.** WO-01-009 depends on WO-05-001 (work-order reader). WO-01-011 depends on the
  owners of the readers it migrates (FRD-09, 10, 14, 15, 17, 23), on WO-14-005 (co-writer of
  `src/lib/snapshot/**`) and on WO-21-003 (which moves `src/lib/pendingMerge/pendingMerge.ts` onto `runGit`,
  so the boundary test of WO-01-011 can pass). Consumers of the seams: WO-03-007,
  WO-21-003, WO-10-016.
- **Visual spec.** None: FRD-01 has no screen (the onboarding gate keeps its v1 look until the shell WOs
  restyle it through the tokens; its oracle states, if any, belong to FRD-19).

## Reconciliation (2026-10-22, binding)

- WO-01-010's fixture git table also answers the FRD-21 worktree families (including the `pandasaga` failure of
  `worktrees-unreadable`) and the FRD-14 snapshot gap queries (`project-snapshot`, `project-snapshot-stale`); a
  command the table cannot answer is a gap in the consumer's reader contract, never a reason to mock a reader.
- Every v2 work order that reads time or git imports `now()` from `@/lib/clock/clock` and `runGit()` from
  `@/lib/git/git`; none adds `child_process` or a zero-argument `Date` (WO-01-011's boundary test).
- `accounts-source-error` (FRD-26) cannot be replayed from files; the close-out Visual QA needs a reader-level
  injection around `getServicesDirectory()` (lead / oracle-harness item, not a work order of this FRD).

## Superseded (v1 history)

None: all ten v1 work orders (WO-01-000 to WO-01-009) stay live. Their acceptance bullets are rewritten as
non-owning `v1 AC-01-…` history lines because FRD-01 defines no AC.

## Work Orders

In build order: WO-01-000; then WO-01-001, WO-01-002, WO-01-003, WO-01-004, WO-01-007 (parallel); then
WO-01-005, WO-01-006, WO-01-008, WO-01-010 (parallel); WO-01-009; WO-01-011. Index with summaries:
[`work-orders/README.md`](work-orders/README.md).
