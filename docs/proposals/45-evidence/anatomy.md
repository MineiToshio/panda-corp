# Pandacorp implement audit · execution anatomy

**Snapshot:** 2026-11-21, Lima. Factory HEAD `3105fd559c67c285ec5eaa4d51e38e1ebc3dc551`, from `git rev-parse HEAD`. This is read-only research for the Option B follow-up. No implementation, gate, test suite, model launch, provider probe, queue, or write-capable Git command was invoked.

**Finding.** The current engine can delay coding through serialized documentation, a conditional independent test author, and independent report acceptance. Then it requires feature review and the production landing proof. In the November 21 Funko incident, **89m 37s MEASURED** elapsed from owner approval to run 2 stop, with **zero MEASURED** feature-build dispatches and **zero MEASURED** G3 executions in the two runs. The failures before coding were generated types in a fresh lane, a docs classifier matching settled prose, and a malformed provider output schema. A more permissive builder prompt alone could not reach any of those failure points. The largest redesign opportunity is to let one implementation context carry a small change through code and narrow verification, with the independent verification and release contract selected at the coordinator boundary. [`docs/proposals/44-verification-strategy.md:33–40`, `docs/proposals/44-evidence/funko-case.md:21–50`, sections 1–7 below]

**Evidence convention.** All `plugin/…`, `factory/…` and `docs/…` path references are relative to `P=/Users/Shared/Proyectos/panda-corp`. `R=plugin/runtime/build`, `CLI=plugin/scripts/pandacorp-build.mjs`, `SK=plugin/skills/implement`, `MQ=plugin/templates/shared/.pandacorp/merge-queue.sh`, and `V=plugin/templates/stack-a-nextjs/verify.sh`. `F=/Users/Shared/Proyectos/funko-tracker` and `FR=F/.pandacorp/run`. `J1=FR/build/journal.jsonl` and `J2=F/.claude/worktrees/catalog-line-scope/.pandacorp/run/build/journal.jsonl`. `N16=FR/build-archive/br-2026-11-16-01/journal.jsonl`, `N14=FR/build-suspended/br-2026-11-14-01/journal.jsonl`, `N13=FR/build-suspended/br-2026-11-13-02/journal.jsonl`. `EJ=F/.claude/worktrees/eloquent-nash-b37282/.pandacorp/run/build/journal.jsonl` and `PJ=F/.claude/worktrees/pensive-wing-dad871/.pandacorp/run/build/journal.jsonl`. File, state, enum, timeline and Git counts are **MEASURED**; modeled clean-path dispatch counts, tokenizer estimates, causal rank and inferred improvement are **ESTIMATED**. Section/order numbers, exit codes, policy constants, schema versions, commit IDs and timestamps identify evidence.

## 1. Owner request to landing

**MEASURED anatomy count:** The code has **3** verify tiers in the engine (G1/G2/G3), **7** detect rows, **3** size modes, **8** unit kinds, **8** mapped agent roles, **26** CLI command names including `start` and **4** start modes. Run, unit and job state enums have **9 + 16 + 3 = 28** entries, plus **4** landing projection values and **43** journal event types. There are **14** build schema files and **4** structured Codex worker output schemas. The list below divides the lifecycle into **18** trace stages for this audit. These stages can loop, overlap or be skipped. [`R/state.mjs:13–33`, `R/schemas/state.schema.json:20–45,178–231,624–647,760–776`, `R/detect.mjs:333–367`, `R/next/constants.mjs:48–54`, `CLI:44–88`, Appendix A2]

1. **Owner request and routing.** The conversation reads the project guide and resolves the plugin path. “Implement it” creates or selects a cited, bounded card if conversation scope is new. “Capture it” creates a draft and returns after `card check`. Named card/FRD or a bare request can select existing pending WOs. An explicit direct request exits this workflow. A new mid-run request becomes a separate draft. Internal `iterate` and `bug` describe bounded preparation and reproduction, with current runtime behavior in `incremental.mjs` and `planner/units.mjs`. [`SK/SKILL.md:27–77`, `SK/references/engine-v2.md:58–123,237–239`, `plugin/skills/iterate/SKILL.md:9–46`, `plugin/skills/bug/SKILL.md:9–26`, `R/incremental.mjs:17–24`, `R/planner/units.mjs:58–104`]
2. **Project and detect.** CLI requires `.pandacorp/status.yaml`. Skill reads overlay version and routes drift through the conversation after a lease check. `start --detect` inspects arguments, lease and saved state, cards, WO frontmatter, project phase and launch target. In code branch order, it chooses live-owner observation, explicit resume, session card, version-scale/unresolved/no-work, named card, named FRD, implicit resume or bare pending plan. Several branches map to the same one of seven row values. Outside-scope prerequisites are surfaced and scope stays bounded. `touch` is up to one WO/point without new FRD, `giant` is first implementation or more than four FRDs or fifteen WOs, `feature` otherwise. [`CLI:136–146,161–177`, `R/detect.mjs:223–242,281–384`, `SK/SKILL.md:41–67`]
3. **Preflight and decisions.** Session refreshes available quota readings and calls `start --preflight` for the scope. Code checks scope/conflicts, launch/push hook, provider login/quota, test DB/env, disk/RAM, power, risk and deferred-review ledger. It writes `preflight.json` with questions, working defaults, drive armability and `failclosed` for unevaluated guarded reads. Some checks are warnings or questions. The skill calls for ACTIVE blueprint/readiness evidence and a first-minute message. I found no invocation of the former global readiness shell in the v2 preflight body; planner, specialist contracts and verifier implement distinct later checks. Launched projects ask for an explicit landing order at the start. Owner decisions for protected actions are separate from reversible technical assumptions. [`R/preflight.mjs:55–161`, `R/preflight/phase.mjs:5–36`, `R/preflight/common.mjs:52–66`, `SK/SKILL.md:14–17,49–67`, `SK/references/autonomy.md:20–95,141–181`]
4. **Acquire ownership and initialize.** `start --run` requires matching preflight no more than 15 minutes old and a buildable scope. It revalidates the card, manages prior run storage with lifecycle checks, verifies or installs the launched-project pre-push guard, acquires the run lease and creates `lane/<run>/integration`. A standalone design handoff can pin an exact committed base. Card becomes `building` with a run ID. State starts `active`. The CLI writes `run_started` and initial `unit_queued` events, atomic state, perf initialization and launch telemetry, then tries to arm standby. Start failure runs the compensating rollback path. `start --resume` has a separate path to claim/transfer/reclaim appropriately, rebuild/heal where needed, reattach workers/replay reports or requeue orphan executions and journal `run_resumed`. [`R/lifecycle/start.mjs:24–145`, `R/lifecycle/buildDir.mjs`, `R/lifecycle/resume.mjs:32–75,115–233,241–255`, `R/lifecycle/common.mjs:10–13,38–44`]
5. **Fence each mutation.** Project run lease has epoch, token hash, holder/runtime and renewal time. Normal v2 TTL is 1,800 s. Lease state is serialized by a mutation mutex. `fencedTwoPhase` renews and verifies the fence before taking intent, performs slow work outside the mutex, then revalidates the lease before recording results. A separate unit admission token identifies the working attempt. The CLI appends hash-chained, schema-checked JSONL events under a per-file append lock, and atomically writes schema-checked `state.json`. Rebuild folds journal and reconciles WO frontmatter. The journal is replay evidence and the state is a cache; code may read both inside one scheduling pass. [`plugin/runtime/build-state.mjs:144–181,212–231,250–324`, `R/lifecycle/common.mjs:10`, `R/state.mjs:103–152,172–207,229–339,398–449`, `R/journal.mjs:16–45`, `R/fsx.mjs:41–66,232–307,316–341`]
6. **Scheduler and admission.** `next` renews, samples resources and journals host performance, services rescues, tries bootstrap, harvests events, integrates ready commits, checks pending scope repairs, reads shared capacity and re-plans. It prioritizes eligible landing, heavy G2 jobs, then workers. Planner groups up to three same-FRD, compatible dependency-linked WOs. Artifact overlap, dependencies, risk floor, UI boundaries, cell/answer changes and fan-out can split or delay groups. It logs `unit_queued` and `admit` decisions. `next --wait` watches artifacts and reruns scheduling up to its wait limit. [`R/next.mjs:41–60`, `R/next/step.mjs:22–142`, `R/planner/units.mjs:14–42,58–105`, `R/planner/common.mjs:4`, `R/planner/rounds.mjs:18–59,77–117`, `R/next/planning.mjs:72–113`, `R/next/dispatch.mjs:50–141`, `R/next/wait.mjs:6–38`]
7. **Card docs, optional visual prerequisite.** A current card queues a product-manager docs unit and a dependent architect docs unit. Each owns a write contract and must be G1-accepted and integrated. Architect activates/amends WOs, writes complexity and `source_change`, and cites design. A selected UI WO without usable design refs gets a designer docs dependency. A bug follows the same intake with its reproduction and a conditional code path that always requires tests-first for a bug card. Eligible existing WO-only requests can skip both card-doc dispatches. [`R/lifecycle/start.mjs:102–125`, `R/incremental.mjs:17–54`, `R/units/brief.mjs:128–153`, `R/planner/units.mjs:58–104`, `R/visual-source.mjs`, `J1:1–4,19–40`]
8. **Select, prepare and dispatch.** For every eligible unit, capacity qualifies then selects/pins the provider, model and effort. Admission reserves a slot and checks disk headroom. Build/patch transition WO `PLANNED → IN_PROGRESS` on integration. The worker gets a per-unit worktree and brief. Review worktree is pinned to the judged diff range. Routes are `via:session` (eligible first-attempt unzoned touch in the lead context), `via:agent` (native Claude Agent), and `via:cli` (direct launcher, Codex or headless Claude). Review is a fresh stronger context. Journal uses `unit_state` queued/suspended → admitted → running, `unit_dispatched`, and `job_started` for CLI workers. Launch-time capacity/disk refusal returns admitted units to queued without a completed execution. [`R/next/candidates.mjs:155–215`, `R/next/dispatch.mjs:79–141,146–178,181–280`, `R/routing.mjs:135–190`, `R/units/worktrees.mjs:52–88,256–268`, `SK/references/engine-v2.md:168–201`]
9. **Conditional tests-first.** One test writer per qualifying chain, before its builder. Trigger is a bug card or a non-`none` risk zone with new AC IDs relative to the FRD at the integration base. Its write allowlist is test-only. The CLI checks an actual assertion RED on chosen files, then runs light with no selected tests to confirm other checks are green. It hashes and commits the accepted tests. A test unit failure can strand every WO in the dependent chain. Builders can author ordinary tests alongside code where tests-first was skipped. [`R/planner/units.mjs:64–69,97–104`, `R/next/planning.mjs:68–81`, `R/units/allowlist.mjs`, `R/report.mjs:183–195,285–311`, `J1:39–59`]
10. **Worker output and G1.** Native lead files verbatim JSON using `report`/`review-record`/`doubt answer`. CLI harvest polls sealed worker output, checks its launcher envelope bound to the live job/epoch, injects the actual report token, validates structure and writes the report. Standard report handling checks token, state, Git ownership, reported file list vs actual diff, changed/allowed paths and protected oracles/snapshots. G1 reruns `verify.sh --light` with changed tests where applicable. A successful CLI commit includes `Unit:` and when applicable `WO:` evidence. Events include `report_received`, `wo_committed`, `unit_state → committed`. Doubts go to `reported`, and protected operations can go to `waiting_gate` with the existing unit commit preserved. [`SK/references/engine-v2.md:203–226`, `R/workers.mjs:383–425,439–478`, `R/next/harvest.mjs:66–123`, `R/report.mjs:125–195,234–356,359–399,429–476`]
11. **Integrate, record and make a safe point.** Engine orders committed units by dependencies, rebases each onto integration and fast-forwards it. It moves WO `IN_PROGRESS → IN_REVIEW`, commits governed metadata, appends workflow tracking and records `integrated`/`safe_point`. Conflicts route to a patch/handback depending on budget and scope. Work under an assumption can go through a separately managed assumption branch; healthy unrelated units keep moving. [`R/integrate/chain.mjs:29–116`, `R/integrate/committed.mjs:28–88`, `R/integrate/transitions.mjs`, `R/integrate/assumptions.mjs`, `R/next/integration.mjs`]
12. **G2 at an eligible FRD.** Once all FRD work is integrated or later and an integrated build/patch/tests unit is pending review, create a fresh pinned G2 snapshot and launch an H-slot job. Bootstrap then `verify.sh --since <integration-base>`. Docs alone do not trigger G2. Job exit, pin and affected FRD are recorded. Stale same-FRD evidence reruns. Red queues attributed or batch-scope patches, with `patching` state and journal `patch`. Green advances affected units to `reviewing` and queues the independent reviewer. [`R/integrate/chain.mjs:99–116`, `R/next/g2.mjs:58–78`, `R/next/constants.mjs:16–34`, `R/next/dispatch.mjs:101–111,146–178`, `R/next/harvest.mjs:207–304`]
13. **Independent review and risk audit.** `review-record` verifies report schema and actual dispatched cell/floor/separate context, hashes selected failed-first probes, can commit probes, and records `review_recorded` and `safe_point`. Pass moves reviewed units to `verified`. Reopen queues patch within budget and WO `IN_REVIEW → PLANNED → IN_PROGRESS`; blocked routes handback; doubt routes the consult path. Deferred re-reviews can be served separately and can file a later bug card. Before eligible landing, run-diff risk can queue one security-auditor unit or a deferred audit entry when the route says so. [`R/review.mjs:35–48,75–249`, `R/review/verdictEffects.mjs`, `R/review/probes.mjs:7–24`, `R/next/landing.mjs:11–28,55–82`, `R/risk.mjs:347–365`]
14. **Recovery loop and real owner gates.** While there is work, scheduler handles independent branches, ambiguity/consultation, missing artifacts and gates. It records accepted reversible assumptions with rationale/reversal. Same-failure identity twice can move a unit to `rescue`, preserving prior evidence and scope. Rescue is one supervised exception path, using lead in-place or CLI worker, staged independent review, full green checks, and `Rescue:` trailer. Approved oracle repair is independent and hash-bound. Failed rescue marks root and dependents `abandoned` and independent work can finish `completed_with_gaps`. Production, money, actual data deletion/access-risk actions and external communication follow owner gates when applicable. [`R/failure/policy.mjs:76–118`, `R/rescue.mjs:36–111,135–299,311–390`, `R/doubts.mjs`, `R/next/planning.mjs:148–189`, `R/answers.mjs`, `R/next/terminal.mjs:21–77`, `SK/references/autonomy.md:98–174`]
15. **Capacity and relay continuation.** A qualified alternative can take new work. Certified subscription or transient rate-limit leaves live files/session/token/cell in `suspended`. If all work waits, run `waiting → resuming → active` uses a one-winner wake generation and fresh capacity evidence. Explicit handoff or sufficiently silent lease can transfer only coordinator authority, rotate epoch and fence the old loop. Live native continuation can block transfer. The drive harvests/launches CLI workers and cannot apply a production order. Owner resume can transfer back and wait for drive to yield and stop only unrecorded launches. [`R/next/candidates.mjs:87–113,187–214`, `R/next/harvest.mjs:178–202`, `plugin/runtime/capacity/scheduler.mjs:10–129`, `R/lifecycle/handoff.mjs:8–22`, `R/drive/triggers.mjs:42–76`, `R/drive/takeover.mjs:16–71`, `R/drive/loop.mjs:81–173`]
16. **Landing preparation.** `next` returns `land` after batch readiness, required review/audit and integration bootstrap. `land` checks canonical integration branch and clean/default-main prerequisites, rebases integration to main if needed, rechecks protected oracle hashes, commits canonical WO status/track/card evidence and fires the detached G3 queue job. Launch strips `PANDACORP_OWNER_RELEASE_OK`. A launched project can reach a certified waiting state through this detached path. [`R/next/landing.mjs:11–52`, `R/next/scope.mjs:39–73`, `R/land/command.mjs:13–181`, `R/jobs.mjs:39–44`]
17. **Queue certifies and fast-forwards.** G3 queue acquires the FIFO repo lock (atomic ticket plus lock ownership) and a heavy host slot when it runs full verification, detects busy main, checks dependencies, rebases to pinned main, uses a compatible exact-tree stamp or runs full verify and must record green proof. For a launched project the missing order yields exit 21 after certification. Land harvest stores `certified-awaiting-order`, then the attended authorized queue path performs exact-SHA local ff and push. Harvest can adopt a corresponding exact queue receipt. Invalid/stale proof requires requeue; conflict/red/precondition/port/infra/main movement take distinct branches (section 3). Successful harvest writes `job_finished`, `batch_landed`, `safe_point`, units → `landed`, and archives a fully completed card. Code caveat: exit 13 (local ff with push failure/unconfirmed) returns “landed” and sets the unit states to landed, while retaining landing_state implemented-uncertified and an explicit push warning. The skill’s launched completion needs publication. A vanished G3 job also has an ancestry-only success branch at land/harvest.mjs:272–277. The sample contains no observed execution of that branch. [`MQ:65–149,455–628,638–705,711–879,884–930,950–1001`, `R/land/batch.mjs:13–31`, `R/land/harvest.mjs:16–78,154–219,254–325`, `SK/SKILL.md:8–17`]
18. **Finish and teardown.** `finish` refuses active unfinished units, journals `run_finished` or `paused`/`waiting_gate`, quiesces and releases the lease, then writes the report, perf rollup and safe teardown. Clean eligible worktrees can go; dirty/locked/live work and integration needed for a pending gate are retained. Session inventory cleanup is separate and can be incomplete. Owner cancellation is explicit `stop` and preserves recorded state. [`R/lifecycle/terminate.mjs:18–51,54–122`, `R/lifecycle/cleanup.mjs`, `R/integrate/worktrees.mjs`, `SK/SKILL.md:122–146`]


**Observed mixed-runtime dispatch.** J1 contains **6 MEASURED** dispatch events: product-manager and architect each ran twice via native Claude Agent, Opus/high (`J1:8,15,25,32`), followed by two CLI Codex Sol/high starts for the same tests unit (`J1:44,52`). J2 contains **2 MEASURED** native Opus/high docs dispatch events (`J2:8,18`). Claude coordination of a Codex CLI worker in J1 did not transfer its lease to drive. The N16 drive takeovers are separate examples. Worker dispatch counts count execution events including retry, while the scenario table counts clean-path unit contexts.

**State crosswalk.** Initial project landing metadata can move phase `architecture → implementation` and gives eligible WO frontmatter `IN_REVIEW → VERIFIED` before G3 on the lane. That is separate from unit state and published status. The build-state WO enum is `PLANNED, IN_PROGRESS, IN_REVIEW, VERIFIED, BLOCKED` (**5 MEASURED**), with reopen implemented through PLANNED plus a counter/reason. Pipeline evidence also has card `draft → ready → building → done/archived` with recovery to ready, plus job `running → done/dead`. `finish` may mark a run finished with blocked terminal units, so two archived `run_finished` events without a `batch_landed` are coherent observations. Canonical completion remains proof-dependent. [`R/land/command.mjs:77–100`, `plugin/runtime/build-state.mjs:375–411`, `R/incremental.mjs:35–54`, `R/review/verdictEffects.mjs:59–99`, `R/lifecycle/start.mjs:31–55`, `R/land/harvest.mjs:41–73`, `R/state.mjs:26–33`, `FR/build-archive/br-2026-11-13-01/journal.jsonl:13`, `N16:272`]

### Dispatch counts under fixed assumptions

| Scenario (ESTIMATED; one eligible FRD) | Builder units | Test-writer units | Reviewers | Model-context executions before optional work |
| --- | ---: | ---: | ---: | ---: |
| One already written WO; clean ordinary scope | 1 | 0–1 | 1 | 2–3 |
| One WO on a newly scoped card, including a bug/risk-new-AC example | 1 | 0–1 | 1 | 4–5, with 2 serial docs executions |
| Five already written WOs in one FRD, all clean | 2–5 | 0–5 | 1 | 3–11, depending on chains and tests-first |
| Five WOs produced by one new card, same one-FRD assumptions | 2–5 | 0–5 | 1 | 5–13, with 2 serial docs executions |

The low endpoints assume good compatible chains or a single ordinary WO. The high endpoints assume separate qualifying chains. In the one-WO case the build can be a session execution, so subtract one from **fresh** agent launches when the session eligibility and capacity tests hold. Each additional eligible FRD brings one G2 and one review, up to five FRD reviews for five separate WOs in this illustration. Add designer prerequisites only for UI with missing refs, and add one security audit if the diff triggers it. Retries, consults, deferred reviews, scope repairs, and rescue can add work with no useful general bound derivable from WO count alone. G1 uses one engine replay on each ordinary accepted docs/build/patch report and two on a successful tests-first unit. G2 and G3 are jobs, and the native lead/drive coordinator is a control role. Distinct engine worker names are **8 MEASURED**: product-manager, architect, designer, implementer, test-writer, reviewer, security-auditor, and general-purpose consult. Backend-dev and frontend-dev exist in `plugin/agents/` and are outside the engine's current role map. [`R/planner/common.mjs:4`, `R/planner/units.mjs:14–42,58–104`, `R/next/constants.mjs:38–54`, `R/report.mjs:171–195,285–311`, `R/next/harvest.mjs:241–256`, `R/next/landing.mjs:55–77`, `R/routing.mjs:135–176`]


## 2. What the worker receives

There are three delivery modes. For native Claude, the lead calls the named subagent and sends this wrapper from `SK/references/engine-v2.md:180–185`. It also specifies the allocated model/effort, background execution and CLI-provided worktree.

> Read the brief at `<brief_path>` and follow it. Work only in `<worktree>`. Write your JSON report to `<report_path>` (schema `<schema_path>`) and print the same JSON as your final message. Unit `<unit>`, token `<token>`.

The runtime supplies the Claude role to the native Agent. For an inline touch, the session has already loaded the skill and then reads the brief. For direct Codex and headless Claude the launched text is the generated `brief.md` verbatim. `startDirect` writes byte copies to both `prompt.md` and `full-prompt.md`. Codex sends the schema separately through `--output-schema`. The headless Claude CLI command streams JSON transport but lacks that provider-side schema argument. The report file and local validator remain part of the protocol. `roleInstructions()` is legacy relay assembly and does not run inside `startDirect()`. The v2 brief tells the worker to read the named role file, and the work order and related contracts are path-addressed reads. The full implement skill and references are lead instructions, with no direct-worker concatenation in this path. [`R/units/brief.mjs:78–110,164–172`, `R/units/render.mjs:53–73,114–145`, `R/next/dispatch.mjs:260–274,308–316`, `R/workers.mjs:129–148`, `plugin/scripts/codex-worker.mjs:100–108,192–213,259–288`, `SK/references/engine-v2.md:180–201`]

**What the brief actually injects.** Unit, attempt, cell, FRD, risk and WO IDs. Card Dentro/Fuera text and exact owned AC lines extracted from FRD. Artifacts/write allowance and hashed test/probe paths. Path pack for WO, FRD, FDD, blueprint, tokens, DESIGN, rules and available design refs. It can add prior attempt diagnostics, gate tail/implicated paths, reviewer findings, decision/owner defaults, specialist or repair notes, expected verification commands, output path/schema and identity. Builder/test and reviewer have different sections. CLI-routed workers use a launcher-bound identity marker in current code. It binds real admission credentials to dispatch/epoch and injects the token at ingestion. The historical prompt excerpts retain any marker and redact historic bearer values. Release variable and path constraints remain in the brief. [`R/units/brief.mjs:78–172`, `R/units/render.mjs:53–145`, `R/next/dispatch.mjs:260–274`, `R/workers.mjs:261–278,410–423,439–478`]

**Observed direct-worker jobs on real Funko WOs.** The Appendix B sample shows a builder and test writer on the same individual WO-12-002 and a reviewer at FRD-01 closure, which reviews two WOs. The exact briefs were **7,127 / 7,146 / 15,531 chars MEASURED** (about **1,782 / 1,786 / 3,883 tokens ESTIMATED**). On the named stack (brief, current role, current schema and recovered WO bodies), even treating every WO character as task, direct task content is at most **34.9% / 40.0% / 41.6% ESTIMATED by classification on measured text**. The archived brief by itself has **47.9% / 47.7% / 78.4% MEASURED** in quoted card/AC/range bullets under the disclosed classifier. The reviewer has substantial AC text and a larger role contract. Literal uppercase MUST/NEVER counts in the current role bodies are **1/2, 0/2, 2/5 MEASURED**; none of the three archived briefs uses uppercase forms. Title-case “Never” and enforceable schemas impose constraints independent of that word count. [Appendix B]

**Actual session framing and reads.** The three Codex rollouts contain the full recorded `session_meta.base_instructions.text` and first-turn framing. I measured them separately to avoid conflating wrapper instructions and task context. Counts below are **MEASURED** from JSONL lines 1, 3–6 and 10. The first-turn sum excludes tool definitions/protocol serialization and subsequent tool returns. Token estimates use chars÷4.

| Sample | Base text chars | Developer frame chars | Project instructions + environment chars | Exact unit prompt chars | First-turn recorded chars / tokens ESTIMATED | Observed requested reads |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Builder, C-B below | 21,524 | 12,876 | 15,121 | 7,127 | 56,648 / ~14,162 | role + guide/rules index at 14, rules pack at 19, WO/blueprint/FRD/schema at 27 |
| Test writer, C-T | 21,769 | 12,740 | 15,121 | 7,146 | 56,776 / ~14,194 | role + guide/rules index at 14, rules pack at 19, WO/blueprint/FRD/schema at 27 |
| Reviewer, C-R | 21,524 | 12,906 | 14,998 | 15,531 | 64,959 / ~16,240 | role/guide/rules at 14 and 19, WO/schema at 19, schema again at 63 |

- **C-B** `/Users/sergio/.codex/sessions/2026/11/16/rollout-2026-11-16T02-37-09-01a1e349-d779-7e10-b3a6-bc0b20433905.jsonl`.
- **C-T** `/Users/sergio/.codex/sessions/2026/11/15/rollout-2026-11-15T23-22-12-01a1e297-487e-72a0-a867-71c8004f0766.jsonl`.
- **C-R** `/Users/sergio/.codex/sessions/2026/11/13/rollout-2026-11-13T23-57-52-01a1d86b-43df-79a3-aed9-41fe6ea5529e.jsonl.zst` (line numbers in `zstd -dc` output).

These include CLI default runtime instructions and project `AGENTS.md` even with `--ignore-user-config`. The deployable prompt reconstruction is the role pointer, report schema, exact original task and observed context reads. Vendor base text and environment payload are measured and sourced in the original transcripts, without duplicating them in the annex. Native Claude internal framing was outside this sample. The archive holds current-factory role/schema copies plus historical WO recovery, and dates matter: e.g. current `DR-159` inventory/budget instructions and the November 21 schema fix postdate the November 14–16 worker examples. See Appendix B for exact retained briefs, WOs, role definitions and output schemas.


**Observed tool outputs, separate from initial context.** Matching `call_id` to the response shows the builder accepted a **39,713-char MEASURED** role/guide/index return at C-B:17 and the test writer a **36,286-char MEASURED** return at C-T:17. Their rules-pack and WO/contract calls at C-B:19,27 and C-T:19,27 returned truncation-marked text (C-B:23,31 and C-T:23,32). Reviewer’s first read was truncated before the role (C-R:17) and a subsequent truncated bundle did carry the named reviewer body (C-R:24); the schema appears in a later **14,440-char MEASURED** multi-read response at C-R:67. Thus the path-addressed reconstruction is reproducible, while actual later context depends on worker reads and tool return caps.

**Rigid wording and enforced reports.** Builder and test writer receive: “Work only in”; “Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`”; “Run, in this order, one heavy tool at a time, at most 3 fix cycles”; “Record each command's exit code and the output tail”; “Never ask the owner.” The test brief adds “each new test must fail by assertion, never by an import or syntax error; touch no production code.” Reviewer: “probe files only, under the test globs; never production code” and “Re-run the evidence yourself; never trust a claim of passing tests.” Both write schema-valid JSON to the report path and print the same JSON as final output. [`R/units/render.mjs:76–85,114–145`]

- **Builder/test report** requires `schema, unit, token, status, summary, files, verification, pending, doubt, diagnosis, gate, authored_by` (**12 MEASURED** top-level). `verification[]` has `command, exit_code, tail`. `authored_by` has runtime, model, effort, each a fixed enumeration. Diagnosis/gate/doubt are required nullable keys. Doubt options require ID and text. Unknown fields are rejected. Git contents and protected scope have additional code-level rules beyond JSON. Ordinary report authored_by is schema-checked. The reviewer path additionally matches its full dispatch cell, and the builder state already stores its execution cell. [`R/schemas/report.schema.json:6–226`, `R/report.mjs:125–158,234–311,340–356,369–397`]
- **Review report** requires `schema, unit, token, reviewer, verdict, findings, probes, traceability, doubt` (**9 MEASURED**). Findings require ID, severity, lens, file, line, summary and a nullable probe pointer. Probes require path and failed_first. Traceability requires contract, contract_class, status and tests. Reopen/blocked need a reason finding. A pass disallows high/critical findings or failed traceability. Probe paths must be allowed test paths, unique, referenced correctly, and retain stable hashes and no overwrites at ingestion. The reviewer must report its actual dispatch cell. [`R/schemas/review-report.schema.json:6–247`, `R/review/report.mjs:14–59`, `R/review.mjs:35–48,108–152`]
- **Other transport contracts.** Doubt answer and rescue report are their own schemas. They require typed decisions, status, reason, origin or review cell as applicable. Appendix A2 lists exact required fields/structural paths. In-session rescue separately applies `rescueResult()` semantics. [`R/units/dispatch.mjs:37–53`, `R/rescue.mjs:123,311–369`, `R/schemas/doubt-answer.schema.json:77–84`, `R/schemas/rescue-report.schema.json:65–71`]

A specific source of prompt friction is inherited SOP overlap. The reviewer role still contains an end-of-build direct visual-polish instruction, per-FRD drill and preview smoke, and then the additive v2 section. A v2 review brief only permits probe edits, and review recording commits selected probes. The implementer role contains RED-first/default TDD prose with exceptions for a combined brief, which must be reconciled with independent hashed tests where the engine created them. The mismatch can consume orientation even where the brief correctly narrows the worker's job. [`plugin/agents/reviewer.md:65–121`, `plugin/agents/implementer.md:15–47`, `R/units/render.mjs:76–85,132–145`, `R/review.mjs:132–152`]

## 3. Non-product stop, stall and failure surfaces

“Observed” here means a matching recorded outcome, with historical-version caveats. “Code path” means a reachable source branch without a positive incident in the retained sample. The table follows the current source. Archived incidents can predate a named mitigation.

| Boundary | Failure or wait and next behavior | Evidence |
| --- | --- | --- |
| CLI entry / input | Missing status, unknown command/mode/flag/positionals, invalid integer/provider/path, malformed scope JSON or missing file. Exit 2/6/10 or defensive failure. Start or caller must correct invocation. Project source and report code are untouched. | **Code path.** `CLI:36–39,94–147,358–418`, `R/lifecycle/start.mjs:24–29,69–87`. |
| Card, data and planning | Ready status and Dentro/Fuera citations, unrelated or live card, unreadable state/WOs, missing dependencies outside scope, invalid complexity, unsupported metadata, initial plan empty/deadlock. Detect can exit 9 on unreadable inputs. Start rejects and unwinds; a later stalled scheduler enters recovery or parks. | **Observed metadata and scope.** N16:56–58 drive fails before launch on quoted WO state (`factory/backlog/BL-0326-engine-failure-drive.md:15–45`). N16:122 dependency/ownership handback (`factory/backlog/BL-0327-blocked-allowlist-repair.md:15–31`). `R/detect.mjs:292–384`, `R/lifecycle/start.mjs:75–125`, `R/next/planning.mjs:72–113`. |
| Overlay, loaded plugin and schema version | Skill routes stale overlay before starting; protected active build guards prevent mid-run upgrade. Claude session can read an older resident skill while factory checkout supplies CLI. State version mismatch throws 5 and requests replay. This v2 executor has no matching patch-level plugin version check in `startRun` or `startDirect`. | **Observed historical loaded-skill skew** `factory/backlog/BL-0168-skill-tool-serves-session-loaded-plugin-version.md:7–30`. `SK/SKILL.md:41–54`, `R/state.mjs:103–120`, `R/lifecycle/start.mjs:69–100`. Status YAML in Funko:7, Mission Control:7 and personal-page-v2:9 shows overlay 9.9.5. Funko incident was a pre-patch schema rejection, distinct from a proven mixed-install cause. |
| Preflight inputs/environment | Scope conflicts, hidden/malformed readings, unavailable login/DB, pending env, RAM/disk/power, missing pre-push and stale or mismatched preflight block specific paths or produce caution/asks. Guarded check rejection/timeout makes `failclosed`. `startRun` enforces preflight freshness and its own launched hook install; warnings have different effects. | **Code path;** launch prerequisite from `R/preflight.mjs:65–161`, `R/preflight/common.mjs:52–66`, `R/preflight/phase.mjs:5–36`, `R/preflight/freshness.mjs:28–41`, `R/lifecycle/start.mjs:78–105`, `R/lifecycle/common.mjs:38–44`. |
| Lease, mutex, stale actor / status mismatch | A live run remains authoritative, and unparseable lease looks live. Existing holder/contended mutex gives exit 4. Old epoch, token mismatch, quiesced lease or state/run disagreement fence the mutation (exit 3). Stale run reclamation waits for grace; recovery/adoption use safe CLI commands. | **Observed epoch transfer:** N16:5–6,62–63,203–204. Fencing the old coordinator follows from the code. **No standalone lease-mutex contention or individual fence rejection established** in this sample. `plugin/runtime/build-state.mjs:144–181,212–244,250–324`, `R/state.mjs:137–207`, `R/lifecycle/resume.mjs:32–75`. |
| Journal / state / deferred or job metadata | Failed atomic read/parse/schema, missing state, illegal state/cache projection, bad tail, gap, wrong hash or torn journal all have explicit failure branches. Schema or journal errors surface as exit 5 outside recovery or as retry/replay with current held lease. Replay needs sound journal plus controlled WO projection. If replay itself stays broken, repeated wait can preserve ownership without progress. Deferred ledger or malformed prior attempt JSON can also disrupt planning or prompt assembly. | **Observed state/parser-related failures** N16:58,159 and backlog notes. **Broken chain not observed:** eight journals independently parsed and hash-checked, 8/8. `R/journal.mjs:16–45`, `R/fsx.mjs:232–341`, `R/state.mjs:103–128,229–339,398–449`, `R/next/planning.mjs:38–41`, `R/units/brief.mjs:117–124`, `R/failure/engineFailure.mjs:79–104,187–220`. |
| Admission and resources | Missing/unusable host inputs lower available concurrency or give safe-mode waits. Host slot limits and artifact overlap constrain launches. Low disk with the 1.5 GiB reservation and 15 GiB floor holds new trees and returns wait. Already running work can continue. Caffeinate/standby can lack prerequisites independently. | **Code path.** `R/admission/constants.mjs:4–13`, `R/admission/disk.mjs:5–22`, `R/admission/hostSlots.mjs:57–132`, `R/next/dispatch.mjs:79–141,193–202`, `R/next/step.mjs:90–128`, `R/drive/arm.mjs:65–124`. |
| Capacity, credentials and timers | A launch can be refused on a changed capacity pin, missing qualified tool or model/interface mapping. New work can fall back. In-flight real usage limits or provider 429/529 can suspend in place; expired/unknown provider readings do not prove renewal. Rate backoff is capped at 900 s, and full waiting uses reset + 60 s and a fenced wake generation. Missing native timer requires an attended lead. Invalid/repeated continuation or session ID are engine failures. | **Historical owner quota handback** N14:83, under earlier rules. Current automatic reset/resume or watchdog exhaustion not established from that row. `R/routing.mjs:130–205`, `R/next/dispatch.mjs:226–238,268–277`, `R/next/harvest.mjs:88–101,178–202`, `plugin/runtime/capacity/scheduler.mjs:10–129`, `SK/references/shared-capacity.md:3–27`. |
| Worktree, pin and bootstrap | Existing path is not registered, wrong worktree branch, unit branch carries foreign assumptions, missing git object, SWC cache layout or preparation error, missing env/deps and hook outputs. Unit bootstrap default bound 10 min; exit 4 requeues as disk wait; non-disk result may let dispatch run before worker/G1 discovers environment damage. G2 snapshot bootstrap is special exit 75 handback or disk 76 wait; snapshot creation has three-pass limit. Integration bootstrap retries or hands back. Wrong review SHA can hand back review as environment, and stale G2 reruns. | **Observed** N14:19–30,126–128 for env writes and wrong pinned review checkout; `factory/backlog/BL-0323-review-redispatch-wrong-checkout.md:15–39`; J1:9–19, J2 gate report for typegen; EJ:77–110. `R/units/worktrees.mjs:52–88,95–117,175–182,256–294`, `R/next/dispatch.mjs:241–258`, `R/next/g2.mjs:142–184`, `R/next/harvest.mjs:207–242`, `R/next/landing.mjs:40–52`. |
| Provider launch / structured output compilation | Missing brief/schema/directory, invalid argv/path/model/effort, sealed transport, spawn or provider configuration. Launcher can return coded failure before job, scheduler records technical failure; a provider can start the subprocess then reject schema before model action, reported through harvest as unsuccessful execution. Same identity twice can enter rescue. Provider-independent direct text or a different configured schema would be a different path. | **Observed** J1:44–59 and two `codex.log:4–5` in section 6. `R/workers.mjs:119–153,261–305`, `R/next/dispatch.mjs:146–178,268–277`, `plugin/scripts/codex-worker.mjs:259–285,408–439`, `R/next/harvest.mjs:66–123`. |
| Worker liveness and result transport | Launcher timeout can kill a stuck startup; `read` timeout, bad FNV seal, no result, dead child, or broken/missing envelope can fail a poll. Seal parsing retries up to twice after the first read. Watchdog defaults measured in source: 120 s start silence, 20 min stall, 120 min cap. Scoped watchdog kills only the owned execution. Harvest records repeated transport faults for rescue; provider exits and timeouts are routed through failure policy. | **Code path** for actual watchdog/transport timeout in sampled logs. `R/workers.mjs:29–35,158–202,286–305,348–369,383–425,439–478`, `plugin/scripts/codex-worker.mjs:232–236,291–386`, `R/next/harvest.mjs:66–132`. |
| Worker report intake / exact author | Unreadable, malformed, absent or schema-invalid JSON; incorrect model effort, unit token, report route or status. Provider-side response schema and CLI-side report decisions are separate. Native missing report → handback. Ordinary invalid report → rejection/attempt ladder when ingestion can attribute it to a live token. Invalid review file or token can throw exit 6 before verdict; scheduler's settle/recovery path then matters. | **Observed** EJ:49 and its `units/u-build-wo-06-007/attempt-1.json:4` show `/authored_by/model must be one of …`. `R/report.mjs:340–399,429–476`, `R/review/report.mjs:25–59`, `R/review.mjs:35–48,81–98`, `R/next/harvest.mjs:165–176`. |
| File list, scope, test hashes and Git | Report files must equal actual selected diff. Staging outside product, unintended bootstrap config, path absent in WO scope, worktree empty, self-commit, protected test/snapshot change, wrong WO frontmatter, source_change missing, symlink/ignored path, or staging/index race can reject before G1. Scope repair needs a governed architect transaction and can preserve original branch/attempt. Rebase conflict may need patch or handback. | **Observed** N14:30 (bootstrap files), PJ:57,64,71 (roster files/allowlist), N16:159 (Git stage of tracked ignored file) and :212 (allowlist); `factory/backlog/BL-0328-engine-failure-drive.md:15–46,69–74` and `factory/backlog/BL-0329-chained-scope-repair.md:15–45`. `R/report.mjs:125–158,234–283`, `R/reportFiles.mjs`, `R/scope.mjs`, `R/integrate/chain.mjs:47–69`. |
| G1 non-product red | Missing verifier fails closed. A fresh checkout with missing generated types, lint/marker on docs, lock contention or environmental RED can be sent into report retry as “code.” Tests-first rejects an import/syntax/tool failure or passing “new tests,” and requires green static checks separately. G1 has a 20 min timeout/exit 124, and retries may open a fresh lane. | **Observed** J1:9–11,26–28, EJ:9, PJ:9; literal `NEEDS CLARIFICATION` and missing `PageProps`. Phase 1 reports timed stages of the two J1 reds as **12.868 s MEASURED**, with **21m 09s MEASURED** combined red-to-integration across retries. `R/report.mjs:33,171–195,285–311`, `V:986–1004,1115–1152`, `docs/proposals/44-evidence/funko-case.md:21–49`. |
| G2 evidence refresh or red | Forgotten bootstrap, dead job, partial/noisy wrapper result, stale pin, docs check or failure attributed outside declared artifacts. Dead job may respawn, stale same-FRD evidence reruns, bootstrap can hand back, true-looking red schedules patch and may exhaust WO/batch budget even when affected tests list is empty. | **Observed** EJ:77–117 and PJ:79–87, both with pre-existing generated-type failure and absent failed-test IDs in saved G2 failure records. `R/next/harvest.mjs:207–304`, `R/gatefail.mjs`, `R/next/g2.mjs:153–184`. |
| Review independence, range and probes | No qualified reviewer can wait on capacity; wrong provider/model/effort rejects acceptance; shared context invalid; wrong SHA on blocked verdict treated as env-infra; invalid paths, report contradiction, failed probe hash/overwrite or proof staleness disrupts closure. Reviewer doubt can queue another context. | **Observed** N14:126–128 and `factory/backlog/BL-0323-review-redispatch-wrong-checkout.md:15–41`. `R/next/candidates.mjs:155–180`, `R/review.mjs:35–48,81–152,190–240`, `R/review/report.mjs:44–58`. |
| Doubt, risk classifier and false protected gates | Ordinary technical doubt uses sources/consult and can record reversible assumptions. Artifact/dependency or test disputes use their own contracts. Risk diff classifies real protected actions and can misread benign operations; unclassified diff fails closed toward owner gate. Pending gates park scoped branches. In the current route a failed CLI review submission can leave the unit live and escalate to ENGINE_FAILURE, whereas ordinary report failure is sent to failUnit (harvest.mjs:165–174). | **Observed** N16:71 flags `unlink(` in receipt cleanup as deletion; ledger then shows owner gate wait. `R/report.mjs:318–356,458–475`, `R/risk.mjs:274–365`, `R/doubts.mjs`, `R/failure/policy.mjs:76–100`. |
| Relay/drive ownership change | Standby arm fails without login, pre-push or launch prerequisites. Invalid/stale handoff is ignored. Token/epoch mismatch retries, native continuation can refuse transfer, old coordinator yields on fence; failed resume waits for drive to exit or leaves it owner. Drive only dispatches CLI workers. Any unexpectedly native or unknown action throws into recovery. Provider quota no longer triggers live transfer automatically. | **Observed** ten explicit requests and ten takeovers in N16; N16:58,159 recorded drive loop failure from different engine defects, and `FR/build-archive/br-2026-11-16-01/drive/drive.log:8,31` records the two diagnoses. `R/drive/arm.mjs:65–124`, `R/drive/triggers.mjs:12–76`, `R/drive/takeover.mjs:16–71`, `R/drive/loop.mjs:81–174`, `R/lifecycle/resume.mjs:32–75`. |
| G3 queue/landing | Conflicts (10), gate red or uncertifiable green (11), locked/dirty main (12), failure after local ff (13), occupied port (14), setup (16), moving main (17), preconditions (20), owner order (21). Land has separate integration bootstrap, rebase and oracle hash pre-check. Requeue eligible busy/ports/main movement; environment repair/retry bound per SHA; persistent precondition can hand back; red can reopen scoped/batch patch; publication requires attended command or exact receipt. | **Observed** N13:18,30,34,53 red/lockfile environment loops. Broader queue cases and limits in proposal 44 sections 5 and 7 and its timing evidence. `R/land/batch.mjs:13–31,89–91`, `R/land/command.mjs:13–181`, `R/land/harvest.mjs:83–164,222–325`, `MQ:628–1001`. |
| Stop hook and cleanup | Independent Claude Stop policy can block a discussion or agent turn on exit 75 even with zero selected tests. Stale active ownership, process cwd, dirty/locked worktree and orphan jobs can prevent cleanup or reuse. `finish` can refuse unfinished units and release only after journaled state/cleanup checks. | **Observed** five discussion stops, **404 ms MEASURED** summed verifier time; interaction cost separate. Cleanup incident `factory/memory/INDEX.md:123` and `factory/backlog/BL-0325-session-cleanup-treats-hook-runtime-files-as-owner-state.md:15–51`. `plugin/scripts/verify-before-stop.sh:114–129,193,228–253`, `R/lifecycle/terminate.mjs:65–122`, `R/lifecycle/cleanup.mjs`. |

**Two additional source-only mismatches worth checking.** `R/next/candidates.mjs:145–150` emits `consult_routed` when the allocator changes a pending doubt consultation’s cell/via, and I found no `consult_routed` in the 43-value `R/schemas/journal-event.schema.json:29–74` enum. `R/journal.mjs:16–27` validates before append. That branch appears able to re-route the doubt record and then fail its journal write, leaving evidence out of sync. I found no matching event/error in the eight journals, and did not execute the branch. `R/next/constants.mjs:42–43` currently lists `worker_error` and `watchdog` as environment worker outcomes while `R/next/harvest.mjs:108–114` assigns other report failures to “code.” Historical J1:47,55 records the launch/schema outage with `worker_failed:code`. A labeled technical failure still consumes recovery and may hide deterministic launch rejection from provider-specific telemetry. [`R/workers.mjs:348–373`, `R/failure-identity.mjs`, Appendix A3]

**Rescue nuance.** Ordinary policy can requeue once; the third execution requires new evidence plus diagnosis or qualifying gate/reviewer evidence. DR-164 records repeated identities and may interrupt that ladder into rescue. On successful rescue, work and review stages preserve scope, control files and protected tests. On failure, it can abandon dependent work. A corrupt journal and missing state can constrain even this recovery path. In J1 the repeated launch fault was followed by `rescue_started` and both `unit_abandoned` events without a successful rescue worker. On earlier runs N16:58 and :159 the mechanism stopped the loop with `engine_failure`. The code currently prefers rehydrate/retry/rescue in active state and still contains fallback failure reporting for paths without a recoverable live state. [`R/failure/unitFailure.mjs:31–78`, `R/failure/policy.mjs:76–118`, `R/failure/engineFailure.mjs:79–110,128–181,202–220`, `R/rescue.mjs:36–111,305–390`, `J1:46–60`]


## 4. What the engine takes away from the worker

| Ordinary action available to a single implementation agent | Current engine boundary | Evidence of consequence |
| --- | --- | --- |
| Follow a dependency into an adjacent file and make the smallest consistent fix | Build/patch can write only WO artifacts. Out-of-scope dependency is not pulled in. Reopening/amending planning belongs to the scoped architect or explicit `scope-repair` with concrete approved files and validated dependency edges. Builder is forbidden from editing existing WO frontmatter. | PJ:57,64,71 shows the two roster-adjacent files rejected. The next report describes a real roster mismatch when they stay alone. N16:122,212 presents additional ownership/dependency examples. [`R/units/allowlist.mjs`, `R/report.mjs:125–158,260–283`, `R/scope.mjs`, `R/incremental.mjs:27–54`] |
| Correct an invalid test while seeing the failing implementation, or write code to make a test import real code | Separate test writer is test-only and must demonstrate assertion RED against available implementation. Builder cannot change another unit’s hashed oracle or blessed snapshots. A bad oracle needs the dispute/causal independent repair procedure, preserving predecessor/new hashes. Builder can still edit authorized ordinary unprotected tests. | J1:39–59 proves a failed test-author job strands the dependent builder. `PJ:57–79` shows that preserved test-contract and adjacent-scope constraints can interact. [`R/units/render.mjs:76–85`, `R/units/brief.mjs:112–115,140–141`, `R/report.mjs:125–138,183–195,285–304`, `R/rescue.mjs:115–121,327–359`] |
| Bootstrap the environment and retain the setup alongside the work | Engine allocates and bootstraps the checkout. Workers can run checks or create permitted/ignored local wiring. Tracked generated neighbors are still considered against the file manifest and allowlist unless the engine recognizes unchanged bootstrap ownership. Environment handback requires coordinator repair and `unblock` at the preserved attempt. | N14:19–30 shows sandbox server setup, unblock then rejection for tracked `.claude/launch.json` and `e2e/server-env.json`. J1:9–19 documents missing generated types. [`R/units/worktrees.mjs:175–182`, `R/report.mjs:244–283`, `SK/references/engine-v2.md:220–226`] |
| Continue past an unrelated docs warning, or fix the docs in the current context | Ordinary report must pass its deterministic gate before commit. G1 light still checks doc-lint, ambiguity and whole-project static analysis. It accepts neither a worker’s green assertion nor an out-of-scope edit to make it green. | J1:25–37 shows a matched quoted marker in an architect blueprint and an **11m 48s MEASURED** second architect dispatch-to-integration interval (timestamps at lines 32/36), after the original docs attempt. [`R/report.mjs:171–178,285–311`, `V:1115–1152`, `docs/proposals/44-evidence/funko-case.md:24–25,37–38`] |
| Make a safe technical call in context and continue | Brief tells the worker to stop and file a doubt if the docs do not answer the decision. Engine checks sources, may consult in another context and can record reversible assumptions. Real protected decisions still need the owner. | N16:71 records an owner gate from `unlink(` in receipt cleanup. I found no direct evidence this branch was product-data deletion. [`R/units/render.mjs:125–126,141–142`, `R/report.mjs:327–356`, `R/doubts.mjs`, `SK/references/autonomy.md:98–174`] |
| Keep a working terminal, repair the diff, and commit when ready | Worker may only write locally and report. It cannot commit/push/reset/checkout/stash, change controlled state, use another worktree, choose a model, or open the production flag. Normal requeue can use a fresh attempt path. In-place preservation is conditional on environment unblock or qualified capacity continuation. | J1 docs attempts use fresh worktrees; N14:21 shows explicit unblock preserving the attempt. [`R/units/render.mjs:114–145`, `R/report.mjs:234–242,306–311`, `R/next/dispatch.mjs:225–280`, `R/lifecycle/resume.mjs:179–222`, `SK/SKILL.md:106–120`] |
| Review and patch in the same pass | Fresh stronger context and allocated reviewer identity are checked at recording. A reviewer can write bounded probes and findings, while the engine queues another patch to modify production. | N14:126–128 shows review on wrong pinned checkout causing downstream handback. Keeping an independently administered oracle can catch real defects, per proposal 44 evidence. [`R/review.mjs:35–48,132–152,190–240`, `R/review/verdictEffects.mjs`, `docs/proposals/44-verification-strategy.md:37,167–185`] |
| Simplify scope or add another requested change in place | Card boundaries stay fixed, preflight and dependency planning are repeated by the CLI, and mid-run requests make new draft cards. A bounded docs role may reopen a WO before it is claimed. | The second Funko run consumed **23m 14s MEASURED** before stop while repeating the docs path; its new base makes pure duplication cost an estimate. [`SK/references/engine-v2.md:77–123,237–239`, `R/incremental.mjs:35–54`, `R/lifecycle/start.mjs:102–125`, `J2:1–19`, `docs/proposals/44-evidence/funko-case.md:26–30,49–50`] |

## 5. Size, churn and the vanilla comparator

**Size at HEAD, MEASURED.** Build runtime has **166 JavaScript modules / 19,371 lines**, plus **14 JSON schemas / 3,435 lines**, **421 lines** in the CLI, and **7 implement Markdown files / 824 lines**. Appendix A1 lists every module and line count. This excludes the separate lease store, provider adapters, shared capacity, scripts, verifier, queue, hooks, role files and tests. The largest single directory group after runtime root is `next/` at **2,039 lines MEASURED**. [Appendix A1]

**60 Lima calendar dates, MEASURED.** Since Sept 23 inclusive, up to Nov 22 exclusive, HEAD ancestry has **63 runtime** and **62 skill** path-history commits, **104 distinct on the union**. The union includes **8 `fix(build)`, 6 `fix(plugin)`, 48 scoped fixes overall**, with **7 → 41 scoped fixes** from the first to second 30-day half. Project-wide plugin evolution includes **130** version-changing commits in canonical metadata (129 distinct resulting values) and **75** overlay version-changing commits. Plugin is **10.19.5** and overlay **9.9.5** at HEAD. The schema correction at HEAD changes neither version marker. The zero baseline is a directory history. The directory started with **10 modules / 3,905 lines MEASURED** in `1ba7d1c6` and reached **166 / 19,371 MEASURED** at the current snapshot. Counts include files split from other modules and new code. [Appendix A1, `git log --diff-filter=A -- plugin/runtime/build/state.mjs` → `1ba7d1c6` on 2026-11-11; `git show --stat 3105fd55`]

The older proposal’s `--review-only` fallback is historical. The current CLI help/dispatch table has no such mode and the current detect parser warns on unknown raw switches. A plain-prompt comparator must specify how it reaches the same independent and queue checks. [`docs/proposals/39-fast-lane-implement.md:8–15`, `CLI:44–88`, `R/detect.mjs:76–108`]

**Judgment, ESTIMATED.** The evidence fits a recently rewritten executor accumulating fixes at its interfaces. It does not show convergence in fresh-run completion rate. Some patches remove concrete failure modes, e.g. quoted WO states, worker review pinning, unchanged bootstrap wiring, selected Git staging, and typed schemas. Other work adds durable capacity, retry/rescue, scope-repair and proof state. The retained cases lack a complete denominator. Positive repairs and increased churn can coexist. [`factory/backlog/BL-0323-review-redispatch-wrong-checkout.md:15–41`, `factory/backlog/BL-0326-engine-failure-drive.md:15–45`, `factory/backlog/BL-0328-engine-failure-drive.md:15–46,69–74`, `factory/backlog/BL-0329-chained-scope-repair.md:15–45`, `docs/proposals/43-done-means-queue-green.md`, Appendix A1/A3]

**Historical plain-prompt comparison.** Proposals 39–41 report older-engine benchmarks, with different usable/reviewed boundaries:

- Small form: vanilla **2.6–5.5 min MEASURED in the cited benchmark**, both arms at **151/151 MEASURED** on the saturated small oracle. Proposal 40’s fast lane was **8.0 / 11.8 min MEASURED** at usable and **40.1–44 min MEASURED** with review/close-out. A separate blind judge had **93–95 engine vs 79 vanilla MEASURED in the cited benchmark** on an older configuration. Different metrics and configurations matter. [`docs/proposals/39-fast-lane-implement.md:19–27`, `docs/proposals/40-implement-speed-v2.md:29–38`]
- Medium app: vanilla **11.5–12.1 min MEASURED**, **285/289 and 289/289 MEASURED** (one missed four dialog focus traps). FM-3’s last FRD usable elapsed **67.8 min MEASURED**, all verified **99.9 min**, done **108.2 min**, oracle **289/289**. Proposal 41’s **20 measured builder transcripts** attribute **71.5% ESTIMATED from model throughput and turn latency**, with **4.2–4.8× MEASURED** output tokens and disproportionate test output. These support a process/write-volume hypothesis and show independent checks can find differences. [`docs/proposals/40-implement-speed-v2.md:29–38`, `docs/proposals/41-builder-speed.md:8–34,163–176`]
- The historical referenced sibling bench directories are absent from `/Users/Shared/Proyectos` in this snapshot. `ab-run.log:1–3` is a port-4037 contention artifact, not a result set. Proposal 42 concerns Claude Design artifact routing, and 43 concerns queue proof. Phase 1 traced only the in-flight owner-directed Funko direct worker, so its finish and comparison are unverified in that evidence. None of these figures establishes current v2 engine-versus-plain quality or an exact queue-green time ratio at HEAD. [`ls /Users/Shared/Proyectos`; `find /Users/Shared/Proyectos/pandacorp-research -maxdepth 3`; `docs/proposals/42-absorb-claude-design-to-artifacts.md:1–24`, `docs/proposals/43-done-means-queue-green.md:1–30`, `docs/proposals/44-evidence/funko-case.md:30–32,78–83`]

## 6. Does 3105fd55 fix both Funko Codex launch failures?

**Yes for their demonstrated shared rejection, verified by static comparison. Production execution through the patch remains unobserved.** Both calls were test-writer attempts for `u-tests-wo-06-010` and both rejected the identical `properties.schema` node before acceptance-test work.

> Invalid schema for response_format 'codex_output_schema': At schema path /properties/schema, schema must specify a type

Provider error code `invalid_json_schema` appears in the corresponding rollout records. Direct source: `FR/codex-workers/w-br-2026-11-21-01-u-tests-wo-06-010-db6710ea2/codex.log:4–5` and `FR/codex-workers/w-br-2026-11-21-01-u-tests-wo-06-010-a2-d7552132d/codex.log:4–5`. The related Codex rollouts are named and linked by thread ID in `docs/proposals/44-evidence/funko-case.md:11–12,26–27`. J1:44–57 binds the failed executions to attempts 1 and 2 and the eventual abandonment. Current assignment of report schema to test workers is in `R/next/dispatch.mjs:268–274,308–316` and `R/units/dispatch.mjs:19–24`. The launcher forwards it at `R/workers.mjs:129–148` and `plugin/scripts/codex-worker.mjs:267–280`.

`git show --format= --unified=2 3105fd55 -- plugin/runtime/build/schemas/report.schema.json`, relevant hunk:

~~~~diff
@@ -6,5 +6,6 @@
   "properties": {
     "schema": {
-      "const": 1
+      "const": 1,
+      "type": "integer"
     },
     "unit": {
~~~~

The same file now types the other six enum nodes as strings (**6 MEASURED**). Recursive static read of parent and patch finds **23 → 0 MEASURED** untyped const/enum nodes in the four worker output schemas: report **7→0**, reviewer **9→0**, rescue **3→0**, doubt answer **4→0**. The patch also adds a repository test that enforces that specific property, and I did not run it. The local schema validator supports const/enum without explicit type, so local JSON acceptance alone could not catch this stricter provider requirement. Provider acceptance of the complete schema, distribution to an already-loaded plugin copy, and feature completion require separate evidence. Run 2 ended before the test unit. [`git show --stat 3105fd55`, Appendix A2, `R/fsx.mjs:345–397,410–468`, `plugin/scripts/test-codex-output-schemas.mjs:1–40`, `J2:1–19`]

## 7. Ranked likely drivers of delay and failure

Ranking is **ESTIMATED** from observed critical-path impact, recurrence in retained artifacts and source fan-out. It does not rank product risk or estimate a population rate.

| Rank | Design feature | Evidence and direction for the proposal |
| ---: | --- | --- |
| 1 | Mandatory PM → architect → implementation pipeline for a scoped card | PM and architecture each got two attempts and took **48m 42s MEASURED** from first engine start through architect integration. A fresh second run repeated docs work even after commits were cited on the card. Let one bounded implementation context update the relevant docs and code where the acceptance contract already exists. Trigger specialist planning only on actual unresolved product/architecture decisions. [`R/incremental.mjs:17–24`, `J1:1–39`, `J2:1–19`, `docs/proposals/44-evidence/funko-case.md:21–30,46–50`] |
| 2 | Fresh isolated trees without an independently verified environment prerequisite | One missing generated type followed docs, G1 and G2 across several November sessions. Wrong worktree pin and tracked bootstrap outputs are separate copies of the same setup problem. Carry a health-checked implementation checkout across phases, and let coordinator repair setup without spending the implementation retry budget. [`J1:9–19`, `EJ:77–117`, `PJ:79–87`, `N14:19–30,126–128`] |
| 3 | Every report waits on broad static checks, including docs-only work | Two failed G1s totaled **12.868 s MEASURED** in reported stages, then drove **21m 09s MEASURED** from reds to accepted docs integrations. The generic replay path amplifies cheap false hits into expensive agent rework. Classify environment and format failures mechanically, and scope pure-prose verification under Option B. [`R/report.mjs:171–195,285–311`, `docs/proposals/44-evidence/funko-case.md:34–50`] |
| 4 | Per-WO ownership and hashed test boundaries applied to cross-cutting changes | Real dependent files split across WOs led to allowlist/roster loop. Keep protected-oracle and security boundaries, let a bounded implementation context extend adjacent product paths with a recorded rationale and diff review. Use explicit escalation for genuinely out-of-scope behavior. [`R/report.mjs:125–158,260–283`, `PJ:57–79`, `factory/backlog/BL-0329-chained-scope-repair.md:15–45`] |
| 5 | Provider-specific structured reports as a launch dependency | Both Nov 21 starts died on the same schema, and a Nov 18 report failed on model enum. Move deterministic schema compatibility and author/token provenance to launcher preflight. Derive filesystem facts and model identity in the runtime, and keep a small domain result contract for worker judgment. A user-facing prose tweak cannot fix response-format compilation. [`J1:44–59`, `EJ:49`, `R/workers.mjs:261–305,383–425`, section 6] |
| 6 | Conditional independent test writer sits before any implementation | The seam requires one more allocation, worktree, role, schema and two engine verifier passes, and the builder cannot proceed if the test lane fails. Preserve independent high-risk or regression evidence where it pays. On ordinary scoped work, allow one builder to author focused tests and report the actual failure mode, with a separate check at the decision boundary. [`R/planner/units.mjs:64–69,97–104`, `R/report.mjs:183–195`, `J1:39–59`, `docs/proposals/44-verification-strategy.md:37,167–185`] |
| 7 | Retry and rescue often switch context with only partial evidence | Prior attempts become notes/paths; normal attempt N can allocate a new tree. Identical failures can still be tried twice before a more expensive rescue or abandonment. Test-provider outage needed a startup-level fix. Preserve work and classify deterministic launcher, tooling and permission failures before model retries. [`R/units/brief.mjs:117–127`, `R/failure/policy.mjs:76–118`, `R/rescue.mjs:36–111`, `J1:44–60`] |
| 8 | Heavy role SOPs, prompt/injection layers and generated test/report volume | Three actual Codex first-turn frames totaled **56.6k–65.0k chars MEASURED** each, with substantial additional rules acquisition. Older benchmark output was **4.2–4.8× MEASURED** vanilla across compared builders. Give implementers one compact scope/acceptance brief, with the narrow few required non-negotiables and path rules supplied on demand. Retain the authoritative requirements and test anchors. [section 2, Appendix B, `docs/proposals/41-builder-speed.md:8–34`] |
| 9 | G2 + review + audit + full G3 all along the usability-to-landing path | Independent gates have genuine catches, but older benchmarks show time between usable and reviewed, and current G2 can repeat on stale pins/setup. Track usable, independently reviewed, certified and published explicitly, align proof to the risk boundary, and evaluate replayable narrow checks before shortening G3. [`R/next/harvest.mjs:207–304`, `R/next/landing.mjs:11–78`, `docs/proposals/40-implement-speed-v2.md:29–38`, `docs/proposals/44-verification-strategy.md:33–40`] |
| 10 | Coordination layer with provider routing, leases, relay, durable jobs and recovery state | One retained run has **10 requests and 10 takeovers MEASURED**, plus two separately caused engine failures. The architecture supports genuine long-running/restart cases. Default bounded changes to one attended coordinator and one implementation worktree, using the resumable multi-runtime scheduler when scale or genuine continuity needs it. [`N16:5–6,58,62–63,159,255–256`, `R/drive/takeover.mjs:16–71`, Appendix A3] |

**Proposal implication.** The smallest experiment that can distinguish prompt quality from control-plane cost is a three-arm paired replay or sandbox benchmark on the same recoverable scoped tasks: current v2 at a pinned revision, plain “implement the work orders to the end”, and one bounded implementation context with identical requirements and independent landing evidence. Log first useful product edit, usable tree, certifiable SHA, queue/publish state, output tokens, safe rollbacks, and failed starts. Evaluate regressions with an independent oracle and include both a low-risk change and one real boundary case. Existing benchmarks motivate the experiment. The available evidence does not establish an exact performance win for the simplified path.

**Coverage limits.** The current runtime was traced statically with user-authorized read-only source, Git, historical project artifacts, targeted Claude/Codex JSONL reads, and prior verified phase-1 evidence. The retained Funko journal sample contains **8 MEASURED** readable hash chains, **939 MEASURED** journal lines, **59 MEASURED** dispatch records and **zero MEASURED** `batch_landed` events. Mission Control and personal-page-v2 main checkouts retain queue and track logs and lacked the v2 build-state/journal directories examined. They cannot supply a comparable build-run denominator. No observed absence in this sample proves global absence. Sizes and Git churn are reproducible; per-WO dispatch scenarios, token conversion, ranked causes and unexecuted patch consequences retain the limitations above. This audit does not claim a current end-to-end timing baseline or a live proof of provider acceptance. [Appendix A, `docs/proposals/44-verification-strategy.md:33–40,445–455`]

## Appendix A. Source, Git, schema and log measurements

All counts in this appendix are **MEASURED**, except token estimates. Source ranges are from the checked-out factory at HEAD 3105fd559c67c285ec5eaa4d51e38e1ebc3dc551.

### A1. Line counts and churn

Physical lines via Python splitlines: 166 build runtime modules, 19,371 lines; 14 build schemas, 3,435 lines; CLI 421 lines; 7 implement skill + reference Markdown files, 824 lines. Runtime boundary excludes the CLI, shared capacity, build-state, worker launcher, queue, verifier and tests.

| Module group under plugin/runtime/build | Files | Physical lines |
| --- | --- | --- |
| (root) | 41 | 7130 |
| admission | 8 | 624 |
| answers | 9 | 675 |
| card | 7 | 702 |
| doubts | 15 | 1104 |
| drive | 9 | 773 |
| failure | 9 | 1270 |
| integrate | 10 | 1083 |
| land | 4 | 698 |
| lifecycle | 9 | 777 |
| next | 13 | 2039 |
| planner | 9 | 747 |
| preflight | 7 | 477 |
| review | 8 | 409 |
| units | 8 | 863 |


Per-file physical lines (Path.rglob, read_text().splitlines()):

~~~~text
  421 plugin/scripts/pandacorp-build.mjs
   59 plugin/runtime/build/admission/constants.mjs
   76 plugin/runtime/build/admission/decision.mjs
   22 plugin/runtime/build/admission/disk.mjs
   50 plugin/runtime/build/admission/hostSlotMutex.mjs
  141 plugin/runtime/build/admission/hostSlots.mjs
   42 plugin/runtime/build/admission/ladder.mjs
  119 plugin/runtime/build/admission/signals.mjs
  115 plugin/runtime/build/admission/tokens.mjs
   19 plugin/runtime/build/admission.mjs
   67 plugin/runtime/build/answers/assumption.mjs
   90 plugin/runtime/build/answers/command.mjs
   15 plugin/runtime/build/answers/common.mjs
   24 plugin/runtime/build/answers/constants.mjs
   69 plugin/runtime/build/answers/io.mjs
  128 plugin/runtime/build/answers/plan.mjs
  110 plugin/runtime/build/answers/planEffects.mjs
  115 plugin/runtime/build/answers/questions.mjs
   57 plugin/runtime/build/answers/start.mjs
   15 plugin/runtime/build/answers.mjs
   24 plugin/runtime/build/capacity.mjs
   37 plugin/runtime/build/card/common.mjs
   58 plugin/runtime/build/card/frontmatter.mjs
  100 plugin/runtime/build/card/lifecycle.mjs
  118 plugin/runtime/build/card/parse.mjs
  117 plugin/runtime/build/card/read.mjs
  103 plugin/runtime/build/card/write.mjs
  169 plugin/runtime/build/card/yaml.mjs
   29 plugin/runtime/build/card.mjs
  155 plugin/runtime/build/deferred.mjs
  457 plugin/runtime/build/detect.mjs
   54 plugin/runtime/build/doubts/advance.mjs
   87 plugin/runtime/build/doubts/answer.mjs
   16 plugin/runtime/build/doubts/command.mjs
   38 plugin/runtime/build/doubts/common.mjs
   38 plugin/runtime/build/doubts/constants.mjs
  118 plugin/runtime/build/doubts/consult.mjs
   94 plugin/runtime/build/doubts/effects.mjs
   55 plugin/runtime/build/doubts/input.mjs
   51 plugin/runtime/build/doubts/integrationLog.mjs
   43 plugin/runtime/build/doubts/ladder.mjs
   80 plugin/runtime/build/doubts/open.mjs
  103 plugin/runtime/build/doubts/records.mjs
   39 plugin/runtime/build/doubts/repeat.mjs
   76 plugin/runtime/build/doubts/texts.mjs
  212 plugin/runtime/build/doubts/veto.mjs
   19 plugin/runtime/build/doubts.mjs
  131 plugin/runtime/build/drive/arm.mjs
    5 plugin/runtime/build/drive/audit.mjs
   17 plugin/runtime/build/drive/constants.mjs
  105 plugin/runtime/build/drive/context.mjs
  207 plugin/runtime/build/drive/loop.mjs
  111 plugin/runtime/build/drive/run.mjs
   39 plugin/runtime/build/drive/standby.mjs
   79 plugin/runtime/build/drive/takeover.mjs
   79 plugin/runtime/build/drive/triggers.mjs
   24 plugin/runtime/build/drive.mjs
   27 plugin/runtime/build/failure/common.mjs
  116 plugin/runtime/build/failure/engineBacklog.mjs
  222 plugin/runtime/build/failure/engineFailure.mjs
  193 plugin/runtime/build/failure/handback.mjs
   83 plugin/runtime/build/failure/handbackText.mjs
  165 plugin/runtime/build/failure/policy.mjs
  273 plugin/runtime/build/failure/unblock.mjs
   79 plugin/runtime/build/failure/unitDoubt.mjs
  112 plugin/runtime/build/failure/unitFailure.mjs
    7 plugin/runtime/build/failure-identity.mjs
   27 plugin/runtime/build/failure.mjs
  559 plugin/runtime/build/fsx.mjs
  113 plugin/runtime/build/gatefail.mjs
   55 plugin/runtime/build/incremental.mjs
  104 plugin/runtime/build/integrate/abandoned.mjs
  109 plugin/runtime/build/integrate/assumptions.mjs
   66 plugin/runtime/build/integrate/bootstrap.mjs
  117 plugin/runtime/build/integrate/chain.mjs
   88 plugin/runtime/build/integrate/committed.mjs
   13 plugin/runtime/build/integrate/common.mjs
   99 plugin/runtime/build/integrate/git.mjs
  157 plugin/runtime/build/integrate/transitions.mjs
   92 plugin/runtime/build/integrate/workOrders.mjs
  238 plugin/runtime/build/integrate/worktrees.mjs
   22 plugin/runtime/build/integrate.mjs
  307 plugin/runtime/build/jobs.mjs
   68 plugin/runtime/build/journal.mjs
   91 plugin/runtime/build/land/batch.mjs
  191 plugin/runtime/build/land/command.mjs
   91 plugin/runtime/build/land/common.mjs
  325 plugin/runtime/build/land/harvest.mjs
   27 plugin/runtime/build/land.mjs
   81 plugin/runtime/build/lifecycle/buildDir.mjs
   20 plugin/runtime/build/lifecycle/cleanup.mjs
   44 plugin/runtime/build/lifecycle/common.mjs
   22 plugin/runtime/build/lifecycle/handoff.mjs
   43 plugin/runtime/build/lifecycle/plan.mjs
  255 plugin/runtime/build/lifecycle/resume.mjs
  145 plugin/runtime/build/lifecycle/start.mjs
   45 plugin/runtime/build/lifecycle/status.mjs
  122 plugin/runtime/build/lifecycle/terminate.mjs
   13 plugin/runtime/build/lifecycle.mjs
  220 plugin/runtime/build/next/candidates.mjs
   87 plugin/runtime/build/next/constants.mjs
  130 plugin/runtime/build/next/context.mjs
  346 plugin/runtime/build/next/dispatch.mjs
  189 plugin/runtime/build/next/g2.mjs
  311 plugin/runtime/build/next/harvest.mjs
   92 plugin/runtime/build/next/integration.mjs
   89 plugin/runtime/build/next/landing.mjs
  203 plugin/runtime/build/next/planning.mjs
   73 plugin/runtime/build/next/scope.mjs
  152 plugin/runtime/build/next/step.mjs
  109 plugin/runtime/build/next/terminal.mjs
   38 plugin/runtime/build/next/wait.mjs
   61 plugin/runtime/build/next.mjs
  105 plugin/runtime/build/notify.mjs
   39 plugin/runtime/build/oracle-review.mjs
  243 plugin/runtime/build/park.mjs
  173 plugin/runtime/build/paths.mjs
  150 plugin/runtime/build/perf.mjs
   25 plugin/runtime/build/planner/common.mjs
   48 plugin/runtime/build/planner/lint.mjs
  164 plugin/runtime/build/planner/model.mjs
   40 plugin/runtime/build/planner/pathRules.mjs
   71 plugin/runtime/build/planner/readWorkOrders.mjs
   48 plugin/runtime/build/planner/readiness.mjs
  117 plugin/runtime/build/planner/rounds.mjs
   64 plugin/runtime/build/planner/stuck.mjs
  170 plugin/runtime/build/planner/units.mjs
  108 plugin/runtime/build/planner.mjs
  103 plugin/runtime/build/preflight/access.mjs
   89 plugin/runtime/build/preflight/common.mjs
   41 plugin/runtime/build/preflight/freshness.mjs
   64 plugin/runtime/build/preflight/gates.mjs
   44 plugin/runtime/build/preflight/machine.mjs
   37 plugin/runtime/build/preflight/phase.mjs
   99 plugin/runtime/build/preflight/scope.mjs
  162 plugin/runtime/build/preflight.mjs
  183 plugin/runtime/build/quota.mjs
   81 plugin/runtime/build/recovery.mjs
  591 plugin/runtime/build/report.mjs
   75 plugin/runtime/build/reportFiles.mjs
  390 plugin/runtime/build/rescue.mjs
   11 plugin/runtime/build/review/common.mjs
   69 plugin/runtime/build/review/degradation.mjs
   44 plugin/runtime/build/review/git.mjs
   30 plugin/runtime/build/review/probes.mjs
   30 plugin/runtime/build/review/range.mjs
   60 plugin/runtime/build/review/report.mjs
  101 plugin/runtime/build/review/verdictEffects.mjs
   64 plugin/runtime/build/review/workOrders.mjs
  252 plugin/runtime/build/review.mjs
  393 plugin/runtime/build/risk.mjs
  221 plugin/runtime/build/routing.mjs
  366 plugin/runtime/build/scope.mjs
  449 plugin/runtime/build/state.mjs
  428 plugin/runtime/build/summary.mjs
  149 plugin/runtime/build/telemetry.mjs
   51 plugin/runtime/build/units/allowlist.mjs
  173 plugin/runtime/build/units/brief.mjs
    6 plugin/runtime/build/units/common.mjs
   54 plugin/runtime/build/units/dispatch.mjs
   57 plugin/runtime/build/units/git.mjs
  156 plugin/runtime/build/units/render.mjs
   71 plugin/runtime/build/units/workOrders.mjs
  295 plugin/runtime/build/units/worktrees.mjs
   20 plugin/runtime/build/units.mjs
   73 plugin/runtime/build/visual-source.mjs
  478 plugin/runtime/build/workers.mjs
  153 plugin/runtime/build/schemas/card-frontmatter.schema.json
  156 plugin/runtime/build/schemas/deferred-reviews.schema.json
   85 plugin/runtime/build/schemas/doubt-answer.schema.json
  310 plugin/runtime/build/schemas/doubt.schema.json
   84 plugin/runtime/build/schemas/gate-failure.schema.json
   32 plugin/runtime/build/schemas/handoff.schema.json
  608 plugin/runtime/build/schemas/journal-event.schema.json
  250 plugin/runtime/build/schemas/perf-record.schema.json
  163 plugin/runtime/build/schemas/quota.schema.json
  227 plugin/runtime/build/schemas/report.schema.json
   72 plugin/runtime/build/schemas/rescue-report.schema.json
  248 plugin/runtime/build/schemas/review-report.schema.json
  799 plugin/runtime/build/schemas/state.schema.json
  248 plugin/runtime/build/schemas/summary.schema.json
  146 plugin/skills/implement/SKILL.md
  203 plugin/skills/implement/references/autonomy.md
   67 plugin/skills/implement/references/drive.md
  293 plugin/skills/implement/references/engine-v2.md
   43 plugin/skills/implement/references/incremental.md
   44 plugin/skills/implement/references/rescue.md
   28 plugin/skills/implement/references/shared-capacity.md
~~~~


Sixty Lima calendar dates ending Nov 21 inclusive. HEAD ancestry, default Git path-history simplification, committer-date filters, distinct subjects counted per commit (exact prefixes shown; Merge is subject-based).

| Path scope | Commits | fix(build): | fix(plugin): | All fix(scopes) | Merge subjects |
| --- | --- | --- | --- | --- | --- |
| Runtime | 63 | 8 | 4 | 39 | 2 |
| Implement skill | 62 | 1 | 3 | 18 | 0 |
| Runtime ∪ skill | 104 | 8 | 6 | 48 | 2 |
| Runtime ∪ skill ∪ CLI | 104 | 8 | 6 | 48 | 2 |
| Entire plugin | 344 | 9 | 45 | 157 | 7 |


~~~~text
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/build
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/skills/implement
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/build plugin/skills/implement
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/build plugin/skills/implement plugin/scripts/pandacorp-build.mjs
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin
~~~~


| Start | End | Union commits | fix( subjects |
| --- | --- | --- | --- |
| 2026-09-23 | 2026-10-22 | 35 | 7 |
| 2026-10-23 | 2026-11-21 | 69 | 41 |


~~~~text
git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-10-23T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/build plugin/skills/implement
git log HEAD --since=2026-10-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/build plugin/skills/implement
~~~~


git ls-tree -r --name-only 31257a05ec79b9673a2981700ec9ff137e70e50b -- plugin/runtime/build and git show 31257a05ec79b9673a2981700ec9ff137e70e50b:<path> → 0 modules and 0 physical lines.

git ls-tree -r --name-only 1ba7d1c6 -- plugin/runtime/build and git show 1ba7d1c6:<path> → 10 modules and 3,905 physical lines.

git ls-tree -r --name-only HEAD -- plugin/runtime/build and git show HEAD:<path> → 166 modules and 19,371 physical lines.

Plugin canonical metadata, plugin/runtime/plugin-metadata.json: 9.106.0 → 10.19.5. 130 path-history commits, 130 first-parent-relative version changes, 129 distinct resulting versions. This can include branch versions and non-increasing changes. Command: git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/runtime/plugin-metadata.json, then git show <sha>^1:plugin/runtime/plugin-metadata.json and git show <sha>:plugin/runtime/plugin-metadata.json.

~~~~text
d5e1c96d 2026-11-21 10.19.4 → 10.19.5 fix(plugin): one shared test-identity function with deterministic ordinals for repeated titles; validated on the real Mission Control corpus (proposal 43 phase 3)
baa8cf14 2026-11-21 10.19.3 → 10.19.4 fix(plugin): escape control characters in test identities across policy, exclusions, budget baseline and flaky ledger (proposal 43 phase 3)
cdff96f4 2026-11-21 10.19.2 → 10.19.3 fix(plugin): database-clean stage reports under the phase-3 inventory policy (proposal 43 phase 3)
2a691793 2026-11-21 10.19.1 → 10.19.2 fix(plugin): allow an empty inventory only in partial passes that permit no tests (proposal 43 phase 3 re-review)
01acbe06 2026-11-21 10.19.0 → 10.19.1 fix(plugin): exclusion trust anchored in the factory's committed key with Keychain-gated signing; inventory integrity before exclusions/budgets; declared skips; budget migration; managed agent rule (proposal 43 phase 3 review)
5ed055d6 2026-11-21 10.18.4 → 10.19.0 feat(plugin): owner-signed flaky exclusions (Mission Control only, 14-day max, nightly unexcluded run) and added-test time budget (proposal 43 phase 3, decisions 5B and 6C)
f844af57 2026-11-21 10.18.3 → 10.18.4 feat(mission-control): per-worker fixture slots for isolated browser specs; worktree e2e port moved to an ignored file (proposal 43 phase 2)
7ce2d67a 2026-11-21 10.18.2 → 10.18.3 fix(plugin): engine e2e landing and pre-push installer regressions from phase 1 (proposal 43)
feffb707 2026-11-21 10.18.1 → 10.18.2 fix(plugin): physical-path receipt match, with-merge-lock in the overlay inventory and nested allowlist, executable overlay scripts on upgrade (proposal 43 phase 1)
48f72557 2026-11-21 10.18.0 → 10.18.1 fix(plugin): no inherited release order in any job, pre-push attempt identity, status across bootstrap overrides, ignored archive paths, upgrade keeps verify.sh executable (proposal 43 phase 1 review)
31de507a 2026-11-21 10.17.0 → 10.18.0 feat(plugin): queue states and --status, required stamp record, diagnose-unit, flaky-suspects ledger, engine land states (proposal 43 phase 1)
f8f2f148 2026-11-21 10.16.2 → 10.17.0 Merge branch 'main' into feat/p43-phase05
10013f03 2026-11-21 10.16.1 → 10.16.2 fix(plugin): inherited slot validation waits within admission budget; exit-16 retry budget kept per sha across intermediate results (proposal 43 phase 0.5 re-review)
d8fee7ed 2026-11-21 10.16.0 → 10.16.1 fix(plugin): atomic FIFO tickets, shared host-slot mutex, lockfile identity env step, bounded push confirmation, exhausted exit-16 retry (proposal 43 phase 0.5 review)
c40e452d 2026-11-20 10.15.0 → 10.16.0 feat(plugin): queue lock ownership + FIFO, env step, gated-sha ff/push, exits 16/17, with-merge-lock (proposal 43 phase 0.5, shard A)
cf81d784 2026-11-20 10.15.0 → 10.16.0 feat(plugin): pace-balanced capacity allocation (DR-162 amended)
246f4ba4 2026-11-20 10.14.3 → 10.15.0 feat(plugin): queue log, immutable gate-report archive and done-to-main metric (proposal 43 phase 0)
7d9a1cc5 2026-11-17 10.14.2 → 10.14.3 fix(build): keep reviewed repair evidence immutable and review repairs after authorized gates
b2e73fa9 2026-11-17 10.14.1 → 10.14.2 fix(build): reviewed oracle repairs, bounded exclusion conflicts, stable failure identity (plugin 10.14.2)
a84ac214 2026-11-17 10.14.0 → 10.14.1 fix(build): close review findings on supervised rescue
c3f6fe11 2026-11-17 10.13.9 → 10.14.0 feat(build): supervised rescue so implement always finishes (plugin 10.14.0)
138ca18e 2026-11-17 10.13.8 → 10.13.9 fix(build): implement keeps moving — real fix-test repair, gate commit reuse, close-out wait
37f64f3c 2026-11-16 10.13.7 → 10.13.8 fix(build): scope-repair accepts Next dynamic-route paths and chained multi-WO units (BL-0329, plugin 10.13.8)
81a1a991 2026-11-16 10.13.6 → 10.13.7 fix(build): stage tracked files under ignored paths when integrating unit reports (BL-0328, plugin 10.13.7)
a2179e7b 2026-11-16 10.13.5 → 10.13.6 fix(build): owner-approved scope repair for units blocked by files outside their WO allowlist (BL-0327, plugin 10.13.6)
9869938e 2026-11-16 10.13.4 → 10.13.5 fix(build): accept quoted WO implementation_status in transitions and rollups (BL-0326, plugin 10.13.5)
23579f00 2026-11-15 10.13.3 → 10.13.4 fix(templates): accept .spec.mts/.cts in e2e inventories and keep the test-DB residue check (plugin 10.13.4, overlay 9.4.2)
19823cdf 2026-11-15 10.13.2 → 10.13.3 fix(implement): design repair inherits the repaired unit's risk and complexity
6bf205e0 2026-11-15 10.13.1 → 10.13.2 fix(implement): hash binary visual references; repair design for queued UI units
f7c07d90 2026-11-14 10.13.0 → 10.13.1 fix(implement): shared visual-source resolution; design gate only for undesigned UI units
fa9b6462 2026-11-14 10.12.2 → 10.13.0 feat(implement): light design mode and three UI cases; specialists own change docs
6cfec3de 2026-11-14 10.12.1 → 10.12.2 docs(capacity): sync manual, agents, standards and engine docs with the allocator
249f7b7b 2026-11-14 10.12.0 → 10.12.1 fix(capacity): reviewer strictly above implementer on a shared cross-tool scale
2d44f7eb 2026-11-14 10.11.4 → 10.12.0 feat(capacity): implementer effort by task complexity; reviewer one rung above
91095a71 2026-11-14 10.11.3 → 10.11.4 fix(capacity): stale weekly readings stay known; health tier beats preference
761bf964 2026-11-14 10.11.2 → 10.11.3 fix(capacity): restore the watchdog on idempotent resume; align drive relay docs
8b8b5e6d 2026-11-14 10.11.1 → 10.11.2 fix(capacity): close final review blockers
0687c8af 2026-11-14 10.11.0 → 10.11.1 fix(capacity): close independent review blockers
2b92b55e 2026-11-14 10.10.1 → 10.11.0 feat(capacity): suspend on quota limit and resume with the same cell (phase 3)
05a9fdaf 2026-11-14 10.10.0 → 10.10.1 fix(capacity): close review findings and restore routing coverage (phase 2c)
aaf893ee 2026-11-14 10.9.0 → 10.10.0 feat(capacity): route engine, image and worker launches through the allocator (phase 2a)
68487c7a 2026-11-14 10.8.0 → 10.9.0 feat(capacity): shared Claude/Codex quota allocator — never-stop rule (phase 1)
bc923770 2026-11-14 10.7.0 → 10.8.0 fix(build-engine): BL-0323 — reviews run on their pinned checkout; wrong-checkout blocks are env-infra
8ede7b49 2026-11-13 10.6.0 → 10.7.0 fix(build-engine): BL-0322 — all-Codex mixed reviews never park; high Claude readings stay known
30a56e6f 2026-11-13 10.5.0 → 10.6.0 fix(build-engine): BL-0321 — review-reopen patches return to G2; reviews below 15 % left never park
becefe70 2026-11-13 10.4.5 → 10.5.0 feat(build-engine): BL-0320 — quota conserve keeps reviews in the author's company (DR-161)
b278cea0 2026-11-13 10.4.4 → 10.4.5 fix(backlog): BL-0319 — preflight takes the coordinator explicitly, never from --label
c14f0a81 2026-11-13 10.4.3 → 10.4.4 fix(backlog): BL-0318 — bootstrap-written files are not a worker's changes
d62ed1f9 2026-11-13 10.4.2 → 10.4.3 fix(backlog): BL-0317 — stop the endless green G2 loop on docs-only FRDs
70442116 2026-11-13 10.4.1 → 10.4.2 fix(backlog): BL-0316 — remove owned G2 leftovers; docs-only G3 reds open no patch
38b2f117 2026-11-13 10.4.0 → 10.4.1 fix(backlog): BL-0315 — card-run docs units must bind new work orders to the card
ad0e5cfb 2026-11-13 10.3.0 → 10.4.0 feat(factory): one PostHog organization per app (DR-160)
e6af9b5c 2026-11-13 10.2.1 → 10.3.0 fix(backlog): BL-0312/0313/0314 — resume env-blocked units, Codex report dir writable, docs units may write DESIGN.md
0ddb7a2a 2026-11-13 10.2.0 → 10.2.1 fix(plugin): track nested MC vitest-policy and gate-budget; regression for every managed overlay file - plugin 10.2.1
57504bc4 2026-11-13 10.1.2 → 10.2.0 feat(plugin): keep the gate fast over time (unclassified-spec and stage-budget warnings, shared Vitest policy) - plugin 10.2.0, overlay 9.2.0
9c505fe8 2026-11-13 10.1.1 → 10.1.2 fix(plugin): scope RSC refresh matchers; diagnostic mode runs every phase - plugin 10.1.2, overlay 9.1.2
3d124d67 2026-11-12 10.1.0 → 10.1.1 fix(plugin): green-stamp fingerprints effective env inputs; keep mobile selection without reviewed inventory; sync live-refresh harness with SSE - plugin 10.1.1, overlay 9.1.1
14e5b10c 2026-11-12 10.0.0 → 10.1.0 feat(plugin): faster quality gate (fail-fast, single gate owner, prod-build browser gates, mobile allowlist, parallel-safe workers, affected iteration) - plugin 10.1.0, overlay 9.1.0
ea85e8e2 2026-11-12 9.157.0 → 10.0.0 chore(plugin): release 10.0.0 (engine v2 day 1), overlay 9.0.0, registry DR-154..157
e133584c 2026-11-12 9.155.0 → 9.157.0 chore(build-engine): merge main (CONV-20 v2) into engine v2, plugin 9.157.0
bc47366c 2026-11-12 9.154.0 → 9.156.0 feat(standards): decision card v2, one-paragraph context and lettered options (CONV-20, DR-148 addendum)
26e0fba7 2026-11-11 9.154.0 → 9.155.0 feat(build-engine): wave D assembly of the v2 engine CLI (9.155.0)
1a532f0b 2026-11-11 9.153.0 → 9.154.0 feat(standards): every Neon project declares NEON_PROJECT_ID (EXT-8, DR-149)
1c5460bb 2026-11-10 9.152.0 → 9.153.0 feat(standards): decision cards for every decision put to the owner (CONV-20, DR-148)
a96834ca 2026-11-10 9.151.1 → 9.152.0 fix(changes): keep the change queue equal to reality whatever the door (DR-147)
3f5f0906 2026-11-10 9.151.0 → 9.151.1 fix(templates): no size-dependent gate verdicts under pipefail (BL-0306)
6f7d6440 2026-11-10 9.150.0 → 9.151.0 feat(gate): light Stop gate, certified-tree queue skip, seeded vitest (DR-146)
15efe57b 2026-11-05 9.149.1 → 9.150.0 fix(backlog): BL-0304 — reclaim merged session worktrees and temporary artifacts safely
485e96b8 2026-11-04 9.149.0 → 9.149.1 fix(templates): make stack-a e2e files pass the template biome and export waitForHydrated
d85ba1da 2026-11-03 9.148.1 → 9.149.0 feat(standards): tests assert behavior on own data, never live-data volumes (DR-144)
bedacffb 2026-10-31 9.148.0 → 9.148.1 fix(engine-tests): make the CI engine corpus pass on a clean runner
ee6d09a8 2026-10-31 9.147.0 → 9.148.0 feat(backlog): BL-0298 — serve full Playwright passes from a production build
c34dbe01 2026-10-31 9.146.6 → 9.147.0 feat(backlog): BL-0296 — add an evidence-based parallel e2e tier
d9f03478 2026-10-31 9.146.5 → 9.146.6 fix(plugin): keep the responsive helper's sr-only and obscured-target handling in the template
e2abbf50 2026-10-30 9.146.4 → 9.146.5 fix(plugin): keep Codex relays on task and the plan on Claude (9.146.5)
44a1124c 2026-10-30 9.146.3 → 9.146.4 fix(plugin): route every build commit through one staging helper (9.146.4)
01b807ae 2026-10-30 9.146.2 → 9.146.3 fix(plugin): commit a journal tracked under an ignored directory (9.146.3)
c3fdfae5 2026-10-30 9.146.1 → 9.146.2 fix(plugin): recover Codex worker prompts from the relay transcript (9.146.2)
5b74e90c 2026-10-30 9.146.0 → 9.146.1 fix(plugin): make Codex worker ids and infra pause Workflow-safe (9.146.1)
74bdff20 2026-10-29 9.145.2 → 9.146.0 feat(plugin): Codex workers across lanes and repairs, auto-stop on lease end, telemetry (DR-142)
8e637a73 2026-10-29 9.145.1 → 9.145.2 fix(backlog): BL-0288 — gate committed server-env on the merge queue, restore local PORT on exit
cd6d2ffe 2026-10-29 9.145.0 → 9.145.1 fix(plugin): Codex workers default to full access so builders can commit (DR-142)
847799ac 2026-10-29 9.144.1 → 9.145.0 feat(plugin): /pandacorp:implement codex — Codex workers under the Claude engine (DR-142)
ed32bed6 2026-10-29 9.144.0 → 9.144.1 fix(plugin): move Codex tiers off the rejected gpt-5.5 (BL-0287)
5ee36dec 2026-10-27 9.143.0 → 9.144.0 feat(standards): DR-141 batch integration with a single final gate
9b431c32 2026-10-24 9.142.0 → 9.143.0 feat(standards): DB tests only on native local Postgres with zero residue (DR-140)
189a2f42 2026-10-23 9.141.0 → 9.142.0 feat(plugin): main is the only production branch, GitHub-only deploys, English URLs (DR-138, DR-139)
38fd28b3 2026-10-20 9.140.0 → 9.141.0 feat(standards): namespace project-owned skills
79bb9986 2026-10-20 9.138.1 → 9.140.0 feat(plugin): require a description for every .env.example variable (DR-136)
ba2a8bf4 2026-10-20 9.138.0 → 9.138.1 docs(architecture): clarify migration execution and database targets
66f53ab3 2026-10-20 9.137.0 → 9.138.0 feat(architecture): standardize three environment files
1e0116cb 2026-10-20 9.136.0 → 9.137.0 feat(architecture): deliver protected environment values after final decisions
af8d59c2 2026-10-20 9.135.0 → 9.136.0 feat(services): codify approved account reuse and provider recipes
b35fa128 2026-10-20 9.134.0 → 9.135.0 feat(governance): grant Codex and Claude full native skill authority
a80f6711 2026-10-19 9.133.0 → 9.134.0 feat(architecture): exclude custom database backups from MVP scope
99841e9b 2026-10-19 9.132.0 → 9.133.0 feat(architecture): require explicit owner scope for optional capabilities
cb1da0d5 2026-10-17 9.131.0 → 9.132.0 fix(engine): schedule the fast lane per work order, never deadlock on a floor FRD, never repair a half-built tree (DR-132)
3a68ff53 2026-10-17 9.130.0 → 9.131.0 feat(architecture): dispatch on portable tiers, parallel groups and context packs (DR-131 v3)
e6335ce4 2026-10-17 9.129.0 → 9.130.0 feat(architecture): owner decision round, cross-FRD planning pipeline and deterministic plan checks (DR-131)
fcd3b9cb 2026-10-17 9.128.0 → 9.129.0 feat(mission-control): persist navigation URLs across all views
5e5198cb 2026-10-17 9.127.2 → 9.128.0 fix(backlog): BL-0239 — refuse an FDD that specifies UI the frozen prototype never draws
ca949642 2026-10-16 9.127.1 → 9.127.2 chore(factory): publish pending documentation and preserve personal drafts
e555a1d8 2026-10-16 9.127.0 → 9.127.1 fix(design): freeze toolkit e2e findings — stable incremental hash, shared demo selectors, state-width gate, lossless icon exports, fast identity fail, config-accumulated-during-rounds
18a669ab 2026-10-16 9.126.0 → 9.127.0 feat(design): parallel, time-boxed freeze with shipped fidelity toolkit, round preflight and quality gate (DR-129)
57dcd761 2026-10-16 9.124.0 → 9.126.0 feat(standards): keep published logical models current across projects
cd5a8fcd 2026-10-15 9.123.0 → 9.124.0 feat(design): update one stable prototype artifact every round
8582ee07 2026-10-15 9.122.0 → 9.123.0 feat(design): freeze a complete fidelity hand-off with web fonts and a Codex logo (DR-128)
b1797983 2026-10-11 9.121.1 → 9.122.0 feat(backlog): BL-0117 — design visual gate publishes directions as private Artifacts
d8dcea90 2026-10-11 9.121.0 → 9.121.1 fix(backlog): BL-0229 — design skill honesty patch for the standalone Claude Design sunset
cd188448 2026-10-03 9.120.2 → 9.121.0 chore(plugin): release 9.121.0 (proposal 41 builder speed, DR-126 measured; BL-0223), overlay 8.98.0
75df8474 2026-10-03 9.120.1 → 9.120.2 chore(plugin): release 9.120.2 (bench follow-ups BL-0218..BL-0221), overlay 8.97.2; Mission Control follows
ed79920a 2026-10-03 9.120.0 → 9.120.1 fix(plugin): stack-a prod-smoke harness passes its own biome and strict tsc gate (9.120.1, overlay 8.97.1)
e83862a7 2026-10-03 9.119.0 → 9.120.0 feat(plugin): worktree lanes on by default, release 9.120.0 (DR-125, proposal 40)
09d7954a 2026-10-01 9.118.2 → 9.119.0 chore(plugin): bump to 9.119.0 and document the fast-lane fix round
da517ef0 2026-10-01 9.118.1 → 9.118.2 fix(engine): unwrap string-encoded MECH results and skip the baseline on greenfield (plugin 9.118.2, overlay 8.95.2)
163b2ab9 2026-10-01 9.118.0 → 9.118.1 fix(engine): ignore sentinel strings in the baseline pre-check (plugin 9.118.1, overlay 8.95.1)
4d41e943 2026-10-01 9.117.1 → 9.118.0 chore(plugin): bump version to 9.118.0, overlay to 8.95.0
9a12a08b 2026-09-30 9.117.0 → 9.117.1 fix(plugin): keep prose out of the portfolio's "Última sync" column and flag it when it happens
f301394d 2026-09-30 9.116.0 → 9.117.0 chore(plugin): bump version to 9.117.0, overlay to 8.94.0
278959b6 2026-09-26 9.115.1 → 9.116.0 chore(plugin): bump version to 9.116.0, overlay to 8.93.0
20fe7b2b 2026-09-25 9.115.0 → 9.115.1 chore(plugin): bump version to 9.115.1, overlay to 8.92.1 (BL-0204 engine source/artifact split)
83bce653 2026-09-25 9.114.0 → 9.115.0 chore(plugin): bump version to 9.115.0, overlay to 8.92.0 (BL-0202, BL-0203 drift finder, launcher gate flags)
7284ada5 2026-09-25 9.113.0 → 9.114.0 chore(plugin): bump version to 9.114.0, overlay to 8.91.0 (canary E2 findings BL-0194..0200)
31360746 2026-09-25 9.112.0 → 9.113.0 chore(plugin): bump version to 9.113.0, overlay to 8.90.0 (canary E findings BL-0191/0192/0193)
4ff999b5 2026-09-25 9.111.0 → 9.112.0 chore(plugin): release 9.112.0 -- parallel FRD gates, gate cost levers, launcher --gate-evidence; overlay 8.89.0
4a15f4cc 2026-09-25 9.110.0 → 9.111.0 chore(plugin): release 9.111.0 -- drift policy (DR-122), C2 hardening, rollup dedupe; overlay 8.88.0
bf667df7 2026-09-25 9.109.0 → 9.110.0 chore(plugin): release 9.110.0 (BL-0170/BL-0179 landed, BL-0180 fixed, DR-118 prose corrected)
5fc5093c 2026-09-24 9.108.0 → 9.109.0 chore(plugin): release 9.109.0 (BL-0171/0172/0173/0174/0175/0176/0177 merged, BL-0178/0179 open)
9b7f9890 2026-09-24 9.107.0 → 9.108.0 chore(plugin): release 9.108.0 (BL-0158/0159/0160/0163/0167/0169 merged, BL-0166/0168/0170 open)
c0a9b157 2026-09-23 9.106.0 → 9.107.0 chore(plugin): release 9.107.0 (BL-0140/0134 classifier + BL-0044 isolation-nudge hook merged, BL-0164/0165 canary-2 S3/S8 fixes, BL-0166 open)
~~~~


Installed manifest source, plugin/.claude-plugin/plugin.json: 9.106.0 → 10.19.5. 130 path-history commits, 130 first-parent-relative version changes, 129 distinct resulting versions. This can include branch versions and non-increasing changes. Command: git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/.claude-plugin/plugin.json, then git show <sha>^1:plugin/.claude-plugin/plugin.json and git show <sha>:plugin/.claude-plugin/plugin.json.

Overlay, plugin/templates/OVERLAY_VERSION: 8.84.0 → 9.9.5. 75 path-history commits, 75 first-parent-relative version changes, 75 distinct resulting versions. This can include branch versions and non-increasing changes. Command: git log HEAD --since=2026-09-23T00:00:00-05:00 --until=2026-11-22T00:00:00-05:00 --format=%h%x09%cs%x09%s -- plugin/templates/OVERLAY_VERSION, then git show <sha>^1:plugin/templates/OVERLAY_VERSION and git show <sha>:plugin/templates/OVERLAY_VERSION.

~~~~text
d5e1c96d 2026-11-21 9.9.4 → 9.9.5 fix(plugin): one shared test-identity function with deterministic ordinals for repeated titles; validated on the real Mission Control corpus (proposal 43 phase 3)
baa8cf14 2026-11-21 9.9.3 → 9.9.4 fix(plugin): escape control characters in test identities across policy, exclusions, budget baseline and flaky ledger (proposal 43 phase 3)
cdff96f4 2026-11-21 9.9.2 → 9.9.3 fix(plugin): database-clean stage reports under the phase-3 inventory policy (proposal 43 phase 3)
2a691793 2026-11-21 9.9.1 → 9.9.2 fix(plugin): allow an empty inventory only in partial passes that permit no tests (proposal 43 phase 3 re-review)
01acbe06 2026-11-21 9.9.0 → 9.9.1 fix(plugin): exclusion trust anchored in the factory's committed key with Keychain-gated signing; inventory integrity before exclusions/budgets; declared skips; budget migration; managed agent rule (proposal 43 phase 3 review)
5ed055d6 2026-11-21 9.8.0 → 9.9.0 feat(plugin): owner-signed flaky exclusions (Mission Control only, 14-day max, nightly unexcluded run) and added-test time budget (proposal 43 phase 3, decisions 5B and 6C)
f844af57 2026-11-21 9.7.2 → 9.8.0 feat(mission-control): per-worker fixture slots for isolated browser specs; worktree e2e port moved to an ignored file (proposal 43 phase 2)
feffb707 2026-11-21 9.7.1 → 9.7.2 fix(plugin): physical-path receipt match, with-merge-lock in the overlay inventory and nested allowlist, executable overlay scripts on upgrade (proposal 43 phase 1)
48f72557 2026-11-21 9.7.0 → 9.7.1 fix(plugin): no inherited release order in any job, pre-push attempt identity, status across bootstrap overrides, ignored archive paths, upgrade keeps verify.sh executable (proposal 43 phase 1 review)
31de507a 2026-11-21 9.6.2 → 9.7.0 feat(plugin): queue states and --status, required stamp record, diagnose-unit, flaky-suspects ledger, engine land states (proposal 43 phase 1)
10013f03 2026-11-21 9.6.1 → 9.6.2 fix(plugin): inherited slot validation waits within admission budget; exit-16 retry budget kept per sha across intermediate results (proposal 43 phase 0.5 re-review)
d8fee7ed 2026-11-21 9.6.0 → 9.6.1 fix(plugin): atomic FIFO tickets, shared host-slot mutex, lockfile identity env step, bounded push confirmation, exhausted exit-16 retry (proposal 43 phase 0.5 review)
c40e452d 2026-11-20 9.5.0 → 9.6.0 feat(plugin): queue lock ownership + FIFO, env step, gated-sha ff/push, exits 16/17, with-merge-lock (proposal 43 phase 0.5, shard A)
246f4ba4 2026-11-20 9.4.2 → 9.5.0 feat(plugin): queue log, immutable gate-report archive and done-to-main metric (proposal 43 phase 0)
23579f00 2026-11-15 9.4.1 → 9.4.2 fix(templates): accept .spec.mts/.cts in e2e inventories and keep the test-DB residue check (plugin 10.13.4, overlay 9.4.2)
f7c07d90 2026-11-14 9.4.0 → 9.4.1 fix(implement): shared visual-source resolution; design gate only for undesigned UI units
fa9b6462 2026-11-14 9.3.0 → 9.4.0 feat(implement): light design mode and three UI cases; specialists own change docs
ad0e5cfb 2026-11-13 9.2.0 → 9.3.0 feat(factory): one PostHog organization per app (DR-160)
57504bc4 2026-11-13 9.1.2 → 9.2.0 feat(plugin): keep the gate fast over time (unclassified-spec and stage-budget warnings, shared Vitest policy) - plugin 10.2.0, overlay 9.2.0
9c505fe8 2026-11-13 9.1.1 → 9.1.2 fix(plugin): scope RSC refresh matchers; diagnostic mode runs every phase - plugin 10.1.2, overlay 9.1.2
3d124d67 2026-11-12 9.1.0 → 9.1.1 fix(plugin): green-stamp fingerprints effective env inputs; keep mobile selection without reviewed inventory; sync live-refresh harness with SSE - plugin 10.1.1, overlay 9.1.1
14e5b10c 2026-11-12 9.0.0 → 9.1.0 feat(plugin): faster quality gate (fail-fast, single gate owner, prod-build browser gates, mobile allowlist, parallel-safe workers, affected iteration) - plugin 10.1.0, overlay 9.1.0
ea85e8e2 2026-11-12 8.124.0 → 9.0.0 chore(plugin): release 10.0.0 (engine v2 day 1), overlay 9.0.0, registry DR-154..157
e133584c 2026-11-12 8.122.0 → 8.124.0 chore(build-engine): merge main (CONV-20 v2) into engine v2, plugin 9.157.0
bc47366c 2026-11-12 8.122.0 → 8.123.0 feat(standards): decision card v2, one-paragraph context and lettered options (CONV-20, DR-148 addendum)
1a532f0b 2026-11-11 8.121.0 → 8.122.0 feat(standards): every Neon project declares NEON_PROJECT_ID (EXT-8, DR-149)
1c5460bb 2026-11-10 8.120.0 → 8.121.0 feat(standards): decision cards for every decision put to the owner (CONV-20, DR-148)
a96834ca 2026-11-10 8.119.1 → 8.120.0 fix(changes): keep the change queue equal to reality whatever the door (DR-147)
3f5f0906 2026-11-10 8.119.0 → 8.119.1 fix(templates): no size-dependent gate verdicts under pipefail (BL-0306)
6f7d6440 2026-11-10 8.118.0 → 8.119.0 feat(gate): light Stop gate, certified-tree queue skip, seeded vitest (DR-146)
15efe57b 2026-11-05 8.117.1 → 8.118.0 fix(backlog): BL-0304 — reclaim merged session worktrees and temporary artifacts safely
485e96b8 2026-11-04 8.117.0 → 8.117.1 fix(templates): make stack-a e2e files pass the template biome and export waitForHydrated
d85ba1da 2026-11-03 8.116.0 → 8.117.0 feat(standards): tests assert behavior on own data, never live-data volumes (DR-144)
ee6d09a8 2026-10-31 8.115.0 → 8.116.0 feat(backlog): BL-0298 — serve full Playwright passes from a production build
c34dbe01 2026-10-31 8.114.4 → 8.115.0 feat(backlog): BL-0296 — add an evidence-based parallel e2e tier
e2abbf50 2026-10-30 8.114.3 → 8.114.4 fix(plugin): keep Codex relays on task and the plan on Claude (9.146.5)
c3fdfae5 2026-10-30 8.114.2 → 8.114.3 fix(plugin): recover Codex worker prompts from the relay transcript (9.146.2)
5b74e90c 2026-10-30 8.114.1 → 8.114.2 fix(plugin): make Codex worker ids and infra pause Workflow-safe (9.146.1)
8e637a73 2026-10-29 8.114.0 → 8.114.1 fix(backlog): BL-0288 — gate committed server-env on the merge queue, restore local PORT on exit
5ee36dec 2026-10-27 8.113.0 → 8.114.0 feat(standards): DR-141 batch integration with a single final gate
9b431c32 2026-10-24 8.112.0 → 8.113.0 feat(standards): DB tests only on native local Postgres with zero residue (DR-140)
319eae48 2026-10-24 8.111.0 → 8.112.0 feat(standards): require gh CLI for GitHub access
189a2f42 2026-10-23 8.110.0 → 8.111.0 feat(plugin): main is the only production branch, GitHub-only deploys, English URLs (DR-138, DR-139)
38fd28b3 2026-10-20 8.109.0 → 8.110.0 feat(standards): namespace project-owned skills
79bb9986 2026-10-20 8.108.1 → 8.109.0 feat(plugin): require a description for every .env.example variable (DR-136)
ba2a8bf4 2026-10-20 8.108.0 → 8.108.1 docs(architecture): clarify migration execution and database targets
66f53ab3 2026-10-20 8.107.0 → 8.108.0 feat(architecture): standardize three environment files
1e0116cb 2026-10-20 8.106.0 → 8.107.0 feat(architecture): deliver protected environment values after final decisions
af8d59c2 2026-10-20 8.105.0 → 8.106.0 feat(services): codify approved account reuse and provider recipes
b35fa128 2026-10-20 8.104.0 → 8.105.0 feat(governance): grant Codex and Claude full native skill authority
a80f6711 2026-10-19 8.103.0 → 8.104.0 feat(architecture): exclude custom database backups from MVP scope
99841e9b 2026-10-19 8.102.0 → 8.103.0 feat(architecture): require explicit owner scope for optional capabilities
cb1da0d5 2026-10-17 8.101.0 → 8.102.0 fix(engine): schedule the fast lane per work order, never deadlock on a floor FRD, never repair a half-built tree (DR-132)
e6335ce4 2026-10-17 8.100.0 → 8.101.0 feat(architecture): owner decision round, cross-FRD planning pipeline and deterministic plan checks (DR-131)
18a669ab 2026-10-16 8.99.1 → 8.100.0 feat(design): parallel, time-boxed freeze with shipped fidelity toolkit, round preflight and quality gate (DR-129)
57dcd761 2026-10-16 8.98.0 → 8.99.1 feat(standards): keep published logical models current across projects
cd188448 2026-10-03 8.97.2 → 8.98.0 chore(plugin): release 9.121.0 (proposal 41 builder speed, DR-126 measured; BL-0223), overlay 8.98.0
75df8474 2026-10-03 8.97.1 → 8.97.2 chore(plugin): release 9.120.2 (bench follow-ups BL-0218..BL-0221), overlay 8.97.2; Mission Control follows
ed79920a 2026-10-03 8.97.0 → 8.97.1 fix(plugin): stack-a prod-smoke harness passes its own biome and strict tsc gate (9.120.1, overlay 8.97.1)
e83862a7 2026-10-03 8.96.0 → 8.97.0 feat(plugin): worktree lanes on by default, release 9.120.0 (DR-125, proposal 40)
6d673e32 2026-10-01 8.95.2 → 8.96.0 fix(engine): keep a wrapped sealed line verbatim for its receipt reader after the 9.118.2 rebase
da517ef0 2026-10-01 8.95.1 → 8.95.2 fix(engine): unwrap string-encoded MECH results and skip the baseline on greenfield (plugin 9.118.2, overlay 8.95.2)
163b2ab9 2026-10-01 8.95.0 → 8.95.1 fix(engine): ignore sentinel strings in the baseline pre-check (plugin 9.118.1, overlay 8.95.1)
4d41e943 2026-10-01 8.94.0 → 8.95.0 chore(plugin): bump version to 9.118.0, overlay to 8.95.0
f301394d 2026-09-30 8.93.0 → 8.94.0 chore(plugin): bump version to 9.117.0, overlay to 8.94.0
278959b6 2026-09-26 8.92.1 → 8.93.0 chore(plugin): bump version to 9.116.0, overlay to 8.93.0
20fe7b2b 2026-09-25 8.92.0 → 8.92.1 chore(plugin): bump version to 9.115.1, overlay to 8.92.1 (BL-0204 engine source/artifact split)
83bce653 2026-09-25 8.91.0 → 8.92.0 chore(plugin): bump version to 9.115.0, overlay to 8.92.0 (BL-0202, BL-0203 drift finder, launcher gate flags)
7284ada5 2026-09-25 8.90.0 → 8.91.0 chore(plugin): bump version to 9.114.0, overlay to 8.91.0 (canary E2 findings BL-0194..0200)
31360746 2026-09-25 8.89.0 → 8.90.0 chore(plugin): bump version to 9.113.0, overlay to 8.90.0 (canary E findings BL-0191/0192/0193)
4ff999b5 2026-09-25 8.88.0 → 8.89.0 chore(plugin): release 9.112.0 -- parallel FRD gates, gate cost levers, launcher --gate-evidence; overlay 8.89.0
4a15f4cc 2026-09-25 8.87.0 → 8.88.0 chore(plugin): release 9.111.0 -- drift policy (DR-122), C2 hardening, rollup dedupe; overlay 8.88.0
48f07b09 2026-09-25 8.86.0 → 8.87.0 chore(mission-control): upgrade overlay to 8.87.0
5fc5093c 2026-09-24 8.85.0 → 8.86.0 chore(plugin): release 9.109.0 (BL-0171/0172/0173/0174/0175/0176/0177 merged, BL-0178/0179 open)
9b7f9890 2026-09-24 8.84.0 → 8.85.0 chore(plugin): release 9.108.0 (BL-0158/0159/0160/0163/0167/0169 merged, BL-0166/0168/0170 open)
~~~~


### A2. Exact CLI, machine state and schema inventory

plugin/scripts/pandacorp-build.mjs:44–88,373–415: 26 top-level commands, including start; 4 start modes; 29 help rows, excluding help itself. Expanding card/doubt/quota gives 31 callable variants, or 32 with the explicit drive --standby submode counted separately.

Top-level: start, card, plan, lint-plan, risk, next, rescue, suspend, report, review-record, land, doubt, answer, handback, scope-repair, unblock, quota, admit, handoff, drive, finish, stop, status, gc, summary, rebuild-state. Start: --detect, --preflight, --run, --resume.

- run.status: **9** · active, paused, waiting_owner, waiting_gate, finished, stopped, waiting, resuming, completed_with_gaps.

- unit.state: **16** · queued, admitted, running, reported, committed, integrated, reviewing, patching, verified, landed, parked, waiting_gate, blocked, suspended, rescue, abandoned.

- unit.kind: **8** · docs, tests, build, patch, review, audit, doubt-consult, deferred-review.

- job.state: **3** · running, done, dead.

- job.kind: **3** · g2, land, worker.

- landing_state: **4** · implemented-uncertified, certified-awaiting-order, certified-stale, landed.

- coordinator: **3** · claude-session, codex-session, drive.

- Total run + unit + job state entries: **28**. Landing projection and enum values for kind/coordinator are separate axes.

- Journal event types: **43** · run_started, run_resumed, run_stopped, run_finished, unit_queued, unit_state, admit, unit_dispatched, job_started, job_finished, report_received, wo_committed, gate, integrated, review_recorded, patch, escalated, handback, unblocked, safe_point, batch_landed, pin_stale, quota_reading, doubt_opened, doubt_consulted, autonomous_decision, answer_recorded, parked, waiting_gate, handoff_requested, drive_armed, drive_takeover, deferred_review_queued, deferred_review_done, engine_failure, paused, capacity_state, scope_repair_approved, technical_failure, rescue_started, rescue_stage, rescue_completed, unit_abandoned. Schema plugin/runtime/build/schemas/journal-event.schema.json:29–74; persisted event types need not all fire on one run.

14 files in the build schema directory, 4 structured output schemas on the CLI-worker routes. File inventory in A1. Required keys of all four output files (JSON Pointers are structural, disjunction paths are conditional):

| Schema | Object location | Required fields |
| --- | --- | --- |
| doubt-answer | / | decision, rationale, consulted, confidence, reversible |
| doubt-answer | /properties/consulted/anyOf/1 | runtime, model, effort |
| report | / | schema, unit, token, status, summary, files, verification, pending, doubt, diagnosis, gate, authored_by |
| report | /properties/verification/items | command, exit_code, tail |
| report | /properties/doubt/anyOf/1 | question, options, preferred, why |
| report | /properties/doubt/anyOf/1/properties/options/items | id, text |
| report | /properties/diagnosis/anyOf/1 | cause, detail |
| report | /properties/gate/anyOf/1 | kind, detail |
| report | /properties/authored_by | runtime, model, effort |
| rescue-report | / | status, summary, authored_by, gate |
| rescue-report | /properties/authored_by | runtime, model, effort |
| review-report | / | schema, unit, token, reviewer, verdict, findings, probes, traceability, doubt |
| review-report | /properties/reviewer | runtime, model, effort |
| review-report | /properties/findings/items | id, severity, lens, file, line, summary, probe |
| review-report | /properties/probes/items | path, failed_first |
| review-report | /properties/traceability/items | contract, contract_class, status, tests |
| review-report | /properties/doubt/anyOf/1 | question, options, preferred, why |
| review-report | /properties/doubt/anyOf/1/properties/options/items | id, text |


Independent recursive const/enum node inspection of git show 3105fd55^:<schema> and git show 3105fd55:<schema>:

| Schema | Parent untyped | Patch untyped | Parent JSON pointers |
| --- | --- | --- | --- |
| doubt-answer | 4 | 0 | /properties/consulted/anyOf/1/properties/runtime, /properties/consulted/anyOf/1/properties/model, /properties/consulted/anyOf/1/properties/effort, /properties/confidence |
| report | 7 | 0 | /properties/schema, /properties/status, /properties/diagnosis/anyOf/1/properties/cause, /properties/gate/anyOf/1/properties/kind, /properties/authored_by/properties/runtime, /properties/authored_by/properties/model, /properties/authored_by/properties/effort |
| rescue-report | 3 | 0 | /properties/status, /properties/authored_by/properties/runtime, /properties/gate |
| review-report | 9 | 0 | /properties/schema, /properties/reviewer/properties/runtime, /properties/reviewer/properties/model, /properties/reviewer/properties/effort, /properties/verdict, /properties/findings/items/properties/severity, /properties/findings/items/properties/lens, /properties/traceability/items/properties/contract_class, /properties/traceability/items/properties/status |


### A3. Journal sample and chain integrity

Raw JSONL hash checks (SHA-256 over prior UTF-8 line, without newline) equivalent to the chain portion of plugin/runtime/build/fsx.mjs:316–341. Enumeration is the Funko main build, archive/suspended and currently present adjacent Claude worktree builds. This is a retained-artifact sample. The production CLI and schema validator were outside scope.

| Funko journal | Lines | Chain | Dispatch events | Handoff requests | Drive takeovers | Batch-landed events | Last event |
| --- | --- | --- | --- | --- | --- | --- | --- |
| .claude/worktrees/catalog-line-scope/.pandacorp/run/build/journal.jsonl | 19 | ok | 2 | 0 | 0 | 0 | run_stopped |
| .claude/worktrees/eloquent-nash-b37282/.pandacorp/run/build/journal.jsonl | 117 | ok | 10 | 0 | 0 | 0 | run_stopped |
| .claude/worktrees/pensive-wing-dad871/.pandacorp/run/build/journal.jsonl | 87 | ok | 9 | 0 | 0 | 0 | run_stopped |
| .pandacorp/run/build/journal.jsonl | 60 | ok | 6 | 0 | 0 | 0 | run_stopped |
| .pandacorp/run/build-archive/br-2026-11-13-01/journal.jsonl | 13 | ok | 1 | 0 | 0 | 0 | run_finished |
| .pandacorp/run/build-archive/br-2026-11-16-01/journal.jsonl | 272 | ok | 17 | 10 | 10 | 0 | run_finished |
| .pandacorp/run/build-suspended/br-2026-11-13-02/journal.jsonl | 219 | ok | 3 | 0 | 0 | 0 | run_stopped |
| .pandacorp/run/build-suspended/br-2026-11-14-01/journal.jsonl | 152 | ok | 11 | 0 | 0 | 0 | run_stopped |


- /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/build/journal.jsonl: missing.

- /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/build-archive: missing.

- /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/build-suspended: missing.

- /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/queue-log.jsonl: 33,464 bytes.

- /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/track.jsonl: 77,593 bytes.

- /Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/build/journal.jsonl: missing.

- /Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/build-archive: missing.

- /Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/build-suspended: missing.

- /Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/queue-log.jsonl: 21,153 bytes.

- /Users/Shared/Proyectos/personal-page-v2/.pandacorp/track.jsonl: 7,992 bytes.
## Appendix B. Worker prompt reconstruction and exact readable inputs

Character counts are **MEASURED** on original Unicode text, including newlines and before redaction. Token estimates divide by four. The table gives two boundaries: archive text sent by direct transport, and a named potential reading stack (brief + current role body + current schema once + recovered WO docs). Runtime system framing, other referenced project docs, model-selected reads and reasoning are outside both sums. Task counts copied Dentro/Fuera/AC bullet rows and pinned review range. Explicit constraints counts imperative lines by their leading label. Reporting counts sections 8–9. Process is all other characters including pointers, identifiers, mechanics, and some constraint prose. Literal uppercase words use whole-word, case-sensitive matches. Entire WO documents are provisionally counted with task in the last column, making it an upper-bound allocation within this named stack.

| Role | Brief chars | ~Tokens est. | Task | Explicit constraints | Process/metadata | Reporting | MUST/NEVER brief | Role-body chars | MUST/NEVER role | Current schema chars | WO chars | Named chars / tokens est. | Upper task % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Builder | 7,127 | 1,782 | 3,412 | 1,210 | 2,076 | 429 | 0/0 | 11,426 | 1/2 | 4,497 | 7,104 | 30,154 / ~7,538 | 34.9% |
| Test writer | 7,146 | 1,786 | 3,412 | 1,394 | 1,911 | 429 | 0/0 | 7,569 | 0/2 | 4,497 | 7,104 | 26,316 / ~6,579 | 40.0% |
| FRD reviewer | 15,531 | 3,883 | 12,180 | 870 | 2,015 | 466 | 0/0 | 33,075 | 2/5 | 5,069 | 17,394 | 71,069 / ~17,767 | 41.6% |


Coordinator-only plugin/skills/implement/SKILL.md: 10,162 chars; 56,860 chars in references. Funko main AGENTS.md: 15,536 chars (current file; inclusion and historical revision vary by worker). These counts are outside the named worker stack.

### Builder · w-br-2026-11-16-01-u-build-wo-12-002-d0bed5570

Exact archived direct-transport text, with the unit credential redacted if present. Raw role pointer and checkout paths are retained. Source /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-16-01-u-build-wo-12-002-d0bed5570/full-prompt.md:1–77. prompt.md and full-prompt.md are byte-identical at read time. Worker metadata /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-16-01-u-build-wo-12-002-d0bed5570/state.json:1 records direct=True and tool=codex.

~~~~markdown
# Unit u-build-wo-12-002: build

## 1. Role
Act as `pandacorp:implementer` (read `/Users/Shared/Proyectos/panda-corp/plugin/agents/implementer.md` for the role rules). Runtime: codex, model sol, effort high.

## 2. Unit
- id: u-build-wo-12-002
- kind: build
- work orders: wo-12-002
- FRD: frd-12-web-performance
- attempt: 1
- risk zone: floor (rules: R2)

## 3. Scope
Dentro (verbatim from the card):
- Aislar del chrome común (AppShell) la sesión del menú, la cobertura del footer y el año, para que dejen de volver dinámica cada página pública. "Para ver, analiza qué es lo mejor, ya, y ponlo, agrégalo al plan."
- Fichas `/piece/[id]` pregeneradas de verdad (generateStaticParams con los IDs públicos reales), datos invalidados por tag al publicar, y lo personal ("lo tengo", wishlist) como isla cargada en el cliente; altas nuevas a demanda y cacheadas. "también creo que habría que agregar un caché, ¿cierto? A todas las páginas"
- Explore y Universe: shell pública cacheada (primera lista y mapa pregenerados) con filtros resueltos en el cliente, conservando URLs, facetas, SEO y fallback sin JS acotado. "las podemos cachar o en todo caso generarlos como HTML"
- Invalidación por tags desde la ingesta (tags por lote, recibo y reintento ante fallo), sin regeneración periódica corta; directorios, noticias y ayuda pregenerados. "de tal manera que cuando entren las páginas"
- Sitemap y robots cacheados como respuesta completa por tag; imágenes OG desacopladas, cacheadas por revisión. "Ok, ya entendí mejor. ¿Me puedes volver a pasar el plan"
- Contacto y exportar: el HTML base no lleva token ni datos privados; la capacidad privada se carga al abrir o enviar, y el preview de export solo al pedirlo. "has toda la implementacion completa del plan"
- Complementario: el matcher del proxy deja fuera `/api/health` y los assets estáticos seguros, conservando headers y protecciones. "has toda la implementacion completa del plan"

Fuera (verbatim from the card):
- Cambiar de plan en Vercel, reglas de Firewall, la sonda de Sentry o el workflow de mantenimiento: son ajustes del owner fuera del código.
- Agrupar deploys (máximo 1 push a main por día de trabajo): es un ajuste de proceso, sin código.
- Mover trabajo fuera de Vercel o rediseñar la UI.
- `output: 'export'` (HTML 100 % estático): se descartó porque pierde Server Actions, cookies e ISR.

Owned acceptance criteria (verbatim):
- **AC-12-003.4:** WHEN an approved ingestion or catalog/coverage/taxonomy publication commits public changes THE SYSTEM SHALL submit one deduplicated bounded batch of affected supported tags to the existing signed invalidation boundary, covering changed details, lists/facets, footer coverage, help examples, directories/news, Universe and discovery assets; uncommitted/rejected work SHALL NOT claim a refresh. The publication flow SHALL persist a receipt bound to its operation, target environment, committed revision and requested tags, distinguishing acknowledged invalidation from pending/failed work. A timeout, partial acknowledgement or lost response SHALL retain closure-pending work for an idempotent bounded retry with backoff at the outer publication caller, without replaying catalog writes, uploads or content approval; the retry budget, timeout and resumable command SHALL be explicit in the blueprint. Only acknowledged tags SHALL count as refreshed, and success SHALL prevent subsequent fresh public requests from receiving superseded hidden/removed facts. Warm reuse SHALL NOT depend on a seconds/minutes/hourly regeneration loop; long-lived cache expiry/eviction MAY cause a later miss but SHALL NOT substitute for publication invalidation.
- | Rejected publication, missing secret, bad signature/tag, duplicate tag, partial/lost acknowledgement, exhausted retry | AC-12-003.4: no false refresh/closure; pending receipt is recoverable without repeating publication. |

Write allowlist (`artifacts`): `src/lib/publicCache/**`, `src/app/api/internal/revalidate/**`, `scripts/ops/**`, `src/lib/ingest/**`, `docs/api/WO-12-002.md`

Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every existing work order, hashed test files, anything listed in Fuera.

DR-159: For every new/changed e2e spec, re-audit transitive writes and viewport behavior; update opted-in e2e/parallel-safe.json or e2e/serial-specs.json and e2e/mobile-specs.json with per-spec reasons in the inventory review document. Review inventories like code; unknown specs remain serial + both platforms. Report gate budget WARNs; never auto-raise baselines or drop tests.

## 4. Context pack
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/docs/frds/frd-12-web-performance/frd.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/docs/frds/frd-12-web-performance/blueprint.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/docs/frds/frd-12-web-performance/work-orders/wo-12-002-publication-cache-protocol.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/docs/design/design-tokens.json
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/DESIGN.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002/docs/rules/README.md

Read-only, hashed by the engine (a change gets your report rejected):
- scripts/ops/_tests/publicationCacheProtocol.test.ts
- src/app/(catalog)/explore/_actions/_tests/exploreAdmission.review.test.ts
- src/app/(catalog)/explore/_components/ExploreHub/_tests/HubPersonalTransport.review.test.tsx
- src/app/api/internal/revalidate/_tests/route.test.ts

Decision on your earlier doubt: undefined (undefined). Question was: q-conflict.paused_plus_card

## 5. Working directory and git
Work only in: /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-build-wo-12-002
Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`. The engine commits.
Never set `PANDACORP_OWNER_RELEASE_OK`.

## 6. Verification
Run, in this order, one heavy tool at a time, at most 3 fix cycles:
- `bash .pandacorp/verify.sh --light`
- `bash .pandacorp/verify.sh --light --tests=<the test files you changed>`
Test budget: existing tests reached by the change always; at most one new behaviour spec per new or changed main flow; at most 5 cases per module for branching logic; cite the AC ids in test names.
Record each command's exit code and the output tail in the report.

## 7. Doubts
Never ask the owner. If a decision needed to proceed is not answered by the documents, stop and return `status:"doubt"` with `question`, `options`, `preferred` and `why`.

## 8. Output
Write a JSON object valid against `/Users/Shared/Proyectos/panda-corp/plugin/runtime/build/schemas/report.schema.json` to `/Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/units/u-build-wo-12-002/report.json`, and print the same JSON as your final message.

## 9. Identity
unit: u-build-wo-12-002
token: [REDACTED UNIT CREDENTIAL]
(copy both verbatim into the report)
~~~~


Work-order body + frontmatter from git -C /Users/Shared/Proyectos/funko-tracker show lane/br-2026-11-16-01/integration:docs/frds/frd-12-web-performance/work-orders/wo-12-002-publication-cache-protocol.md (68 lines, 7,104 characters). This is the surviving historical integration-branch version. Exact worker-time equality is unverified. WO bodies contain their own process instructions.

~~~~markdown
---
id: "WO-12-002"
type: "work-order"
slug: "publication-cache-protocol"
title: "Publication cache policy and durable invalidation"
status: "ACTIVE"
parent: "FRD-12"
foundation: true
implementation_status: IN_REVIEW
complexity: "complex"
reopen_count: 0
ui: false
design_source: "not-applicable"
design_refs: []
design_decision_by: "agent"
artifacts: ["src/lib/publicCache/**", "src/app/api/internal/revalidate/**", "scripts/ops/**", "src/lib/ingest/**", "docs/api/WO-12-002.md"]
source_requirements: ["REQ-12-003"]
source_change: ["cut-fluid-cpu-static-catalog"]
dependsOn: ["WO-01-001", "WO-06-001"]
last_updated: "2026-11-15"
---

# WO-12-002: Publication cache policy and durable invalidation

## Summary

Deliver the shared public-cache vocabulary and publication-bound invalidation with durable receipts, bounded retries and compatibility for existing callers.

## Complexity

Complex: signed integration, resumable publication and several caller modules; estimated 2–3.5k changed lines. This is one publication protocol, not a rewrite of ingestion. Estimates are planning projections. Replan before exceeding the 4k ceiling; do not dilute ACs or extend ownership silently.

## In Scope

Implement CMP-12-public-cache / IF-12-invalidate exactly as the blueprint publication protocol. Inventory every catalog/coverage/taxonomy/media writer before wiring it; flush committed changes even after partial chunk failure. Preserve approval, target checks, commit/SQL receipts and operation idempotency. Reuse operator-side filesystem receipts, with pending intent before publication and commit binding before sending. Do not add Prisma entities. Add the long-lived policy and the installed framework/provider contract for use cache versus use cache: remote without changing unrelated private caches. Runtime consumers use the existing Vercel managed handler; local memory hits do not certify cross-instance reuse. Keep remote entry size/shard, tag and miss behavior explicit, with no provider provisioning or new cache SDK.

Use [BP-12](../blueprint.md#public-cache-delta-cut-fluid-cpu-static-catalog-2026-11-15) as the settled technical contract. Author `docs/api/WO-12-002.md` with inputs/outputs, authorization, cache/expiry, validation and error/retry semantics for this slice; frontmatter owns that contract. Consumers wait for this WO. Backend and UI files are both owned here; UI construction additionally requires the declared visual source.

## Out of Scope

No Vercel plan/Firewall, Sentry probe, maintenance workflow, deploy grouping, moving work outside Vercel, visual redesign, service worker, static export, provider writes, publication or deployment. No Prisma/domain-schema change; operator receipts remain files. Do not edit `**/*-snapshots/**`, hashed review tests, another WO's implementation or state, or historical WO-12-001. E2E/spec inventory changes are centralized in WO-12-006; other slices request them through their handoff.

## Requirements & Acceptance Criteria

REQ-12-003. This WO owns exactly AC-12-003.4; other delta criteria are integration dependencies, not duplicate acceptance ownership.

- **AC-12-003.4:** WHEN an approved ingestion or catalog/coverage/taxonomy publication commits public changes THE SYSTEM SHALL submit one deduplicated bounded batch of affected supported tags to the existing signed invalidation boundary, covering changed details, lists/facets, footer coverage, help examples, directories/news, Universe and discovery assets; uncommitted/rejected work SHALL NOT claim a refresh. The publication flow SHALL persist a receipt bound to its operation, target environment, committed revision and requested tags, distinguishing acknowledged invalidation from pending/failed work. A timeout, partial acknowledgement or lost response SHALL retain closure-pending work for an idempotent bounded retry with backoff at the outer publication caller, without replaying catalog writes, uploads or content approval; the retry budget, timeout and resumable command SHALL be explicit in the blueprint. Only acknowledged tags SHALL count as refreshed, and success SHALL prevent subsequent fresh public requests from receiving superseded hidden/removed facts. Warm reuse SHALL NOT depend on a seconds/minutes/hourly regeneration loop; long-lived cache expiry/eviction MAY cause a later miss but SHALL NOT substitute for publication invalidation.

Completeness: expected failures use typed retryable state/RFC 9457 at HTTP boundaries; unexpected failures reach redacted observability. Never turn a failed read into empty facts. Bound input/body/time/retries; no credentials/PII in logs or caches. Public data is shared/tagged, private reads are server-authorized/no-store. Retain AC-12-001/002 budgets without claiming they are certified here. UI slices retain keyboard/focus/semantics/contrast/reduced motion and stable reserved geometry.

## Visual reference

N/A. Backend policy and operator protocol; no product UI.

## Dependencies

WO-01-001, WO-06-001. These are explicit machine-readable dependencies mirrored in BP-12 and the index. Consume the platform, auth, data and existing foundation interfaces; no phase-wide rebuild. UI slices also reuse WO-01-002/003/004/006/007 primitives through the existing foundation graph. The serial UI chain protects the single locale file and component inventory.

## Verification

- Use these inspected existing focused regression paths: `scripts/ops/_tests/revalidate.test.ts src/app/api/internal/revalidate/_tests/route.test.ts`. Add at most the one main-flow behavior spec described below; do not run the whole suite.
- One new/changed main-flow behavior spec at most; at most five branching cases per module; include owned AC IDs in test names. Publication outage/resume: bounded signed batch, target/revision receipt, lost/partial acknowledgement, retry without reapplying domain writes. Use existing caller coverage for ingest/SQL/quick/media paths.
- Run `pnpm test:focus <changed-source> <explicit-test>` (native loopback DB where needed), then `bash .pandacorp/verify.sh --light` and `bash .pandacorp/verify.sh --light --tests=<changed-test-files>` sequentially. Stop at red, at most three fix cycles. No new behavioral tests for this planning document.
- WO-12-006 owns production fixture/E2E consolidation, cold/warm/post-tag operation counts, DR-159 execution/viewport inventories with per-spec reasons, and the measured-vs-unmeasured review. Its verification is not replaced by a static manifest or unit mocks. Report budget WARNs; never auto-raise baselines or remove tests.

## Status Note

Bounded independent readiness passed on 2026-11-15 ([review](../../../reviews/public-cache-plan-readiness-2026-11-15.md)). Planning handoff for change `cut-fluid-cpu-static-catalog`: implementation remains PLANNED. No product work, AC satisfaction, runtime cache proof or production savings is certified. Pending design stays a prerequisite only for the affected UI. Implementer records delivered interfaces, actual tests/commands and met/unmet owned ACs before independent review; it never self-stamps VERIFIED.
~~~~


### Test writer · w-br-2026-11-16-01-u-tests-wo-12-002-daa8528e7

Exact archived direct-transport text, with the unit credential redacted if present. Raw role pointer and checkout paths are retained. Source /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-16-01-u-tests-wo-12-002-daa8528e7/full-prompt.md:1–77. prompt.md and full-prompt.md are byte-identical at read time. Worker metadata /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-16-01-u-tests-wo-12-002-daa8528e7/state.json:1 records direct=True and tool=codex.

~~~~markdown
# Unit u-tests-wo-12-002: tests

## 1. Role
Act as `pandacorp:test-writer` (read `/Users/Shared/Proyectos/panda-corp/plugin/agents/test-writer.md` for the role rules). Runtime: codex, model sol, effort high.

## 2. Unit
- id: u-tests-wo-12-002
- kind: tests
- work orders: wo-12-002
- FRD: frd-12-web-performance
- attempt: 1
- risk zone: floor (rules: R2)

## 3. Scope
Dentro (verbatim from the card):
- Aislar del chrome común (AppShell) la sesión del menú, la cobertura del footer y el año, para que dejen de volver dinámica cada página pública. "Para ver, analiza qué es lo mejor, ya, y ponlo, agrégalo al plan."
- Fichas `/piece/[id]` pregeneradas de verdad (generateStaticParams con los IDs públicos reales), datos invalidados por tag al publicar, y lo personal ("lo tengo", wishlist) como isla cargada en el cliente; altas nuevas a demanda y cacheadas. "también creo que habría que agregar un caché, ¿cierto? A todas las páginas"
- Explore y Universe: shell pública cacheada (primera lista y mapa pregenerados) con filtros resueltos en el cliente, conservando URLs, facetas, SEO y fallback sin JS acotado. "las podemos cachar o en todo caso generarlos como HTML"
- Invalidación por tags desde la ingesta (tags por lote, recibo y reintento ante fallo), sin regeneración periódica corta; directorios, noticias y ayuda pregenerados. "de tal manera que cuando entren las páginas"
- Sitemap y robots cacheados como respuesta completa por tag; imágenes OG desacopladas, cacheadas por revisión. "Ok, ya entendí mejor. ¿Me puedes volver a pasar el plan"
- Contacto y exportar: el HTML base no lleva token ni datos privados; la capacidad privada se carga al abrir o enviar, y el preview de export solo al pedirlo. "has toda la implementacion completa del plan"
- Complementario: el matcher del proxy deja fuera `/api/health` y los assets estáticos seguros, conservando headers y protecciones. "has toda la implementacion completa del plan"

Fuera (verbatim from the card):
- Cambiar de plan en Vercel, reglas de Firewall, la sonda de Sentry o el workflow de mantenimiento: son ajustes del owner fuera del código.
- Agrupar deploys (máximo 1 push a main por día de trabajo): es un ajuste de proceso, sin código.
- Mover trabajo fuera de Vercel o rediseñar la UI.
- `output: 'export'` (HTML 100 % estático): se descartó porque pierde Server Actions, cookies e ISR.

Owned acceptance criteria (verbatim):
- **AC-12-003.4:** WHEN an approved ingestion or catalog/coverage/taxonomy publication commits public changes THE SYSTEM SHALL submit one deduplicated bounded batch of affected supported tags to the existing signed invalidation boundary, covering changed details, lists/facets, footer coverage, help examples, directories/news, Universe and discovery assets; uncommitted/rejected work SHALL NOT claim a refresh. The publication flow SHALL persist a receipt bound to its operation, target environment, committed revision and requested tags, distinguishing acknowledged invalidation from pending/failed work. A timeout, partial acknowledgement or lost response SHALL retain closure-pending work for an idempotent bounded retry with backoff at the outer publication caller, without replaying catalog writes, uploads or content approval; the retry budget, timeout and resumable command SHALL be explicit in the blueprint. Only acknowledged tags SHALL count as refreshed, and success SHALL prevent subsequent fresh public requests from receiving superseded hidden/removed facts. Warm reuse SHALL NOT depend on a seconds/minutes/hourly regeneration loop; long-lived cache expiry/eviction MAY cause a later miss but SHALL NOT substitute for publication invalidation.
- | Rejected publication, missing secret, bad signature/tag, duplicate tag, partial/lost acknowledgement, exhausted retry | AC-12-003.4: no false refresh/closure; pending receipt is recoverable without repeating publication. |

Write allowlist (`artifacts`): `**/_tests/**`, `**/*.test.*`, `**/*.spec.*`, `e2e/**`, `src/test/**`

Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every existing work order, hashed test files, anything listed in Fuera.

RED-first acceptance tests: each new test must fail by assertion, never by an import or syntax error; touch no production code. The report carries no hashes; the engine computes them.

DR-159: For every new/changed e2e spec, re-audit transitive writes and viewport behavior; update opted-in e2e/parallel-safe.json or e2e/serial-specs.json and e2e/mobile-specs.json with per-spec reasons in the inventory review document. Review inventories like code; unknown specs remain serial + both platforms. Report gate budget WARNs; never auto-raise baselines or drop tests.

## 4. Context pack
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/docs/frds/frd-12-web-performance/frd.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/docs/frds/frd-12-web-performance/blueprint.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/docs/frds/frd-12-web-performance/work-orders/wo-12-002-publication-cache-protocol.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/docs/design/design-tokens.json
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/DESIGN.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002/docs/rules/README.md

Read-only, hashed by the engine (a change gets your report rejected):
- src/app/(catalog)/explore/_actions/_tests/exploreAdmission.review.test.ts
- src/app/(catalog)/explore/_components/ExploreHub/_tests/HubPersonalTransport.review.test.tsx

Decision on your earlier doubt: undefined (undefined). Question was: q-conflict.paused_plus_card

## 5. Working directory and git
Work only in: /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-tests-wo-12-002
Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`. The engine commits.
Never set `PANDACORP_OWNER_RELEASE_OK`.

## 6. Verification
Run, in this order, one heavy tool at a time, at most 3 fix cycles:
- `bash .pandacorp/verify.sh --light`
- `bash .pandacorp/verify.sh --light --tests=<the test files you changed>`
Test budget: existing tests reached by the change always; at most one new behaviour spec per new or changed main flow; at most 5 cases per module for branching logic; cite the AC ids in test names.
Record each command's exit code and the output tail in the report.

## 7. Doubts
Never ask the owner. If a decision needed to proceed is not answered by the documents, stop and return `status:"doubt"` with `question`, `options`, `preferred` and `why`.

## 8. Output
Write a JSON object valid against `/Users/Shared/Proyectos/panda-corp/plugin/runtime/build/schemas/report.schema.json` to `/Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/units/u-tests-wo-12-002/report.json`, and print the same JSON as your final message.

## 9. Identity
unit: u-tests-wo-12-002
token: [REDACTED UNIT CREDENTIAL]
(copy both verbatim into the report)
~~~~


Work-order body + frontmatter from git -C /Users/Shared/Proyectos/funko-tracker show lane/br-2026-11-16-01/integration:docs/frds/frd-12-web-performance/work-orders/wo-12-002-publication-cache-protocol.md (68 lines, 7,104 characters). This is the surviving historical integration-branch version. Exact worker-time equality is unverified. WO bodies contain their own process instructions.

~~~~markdown
---
id: "WO-12-002"
type: "work-order"
slug: "publication-cache-protocol"
title: "Publication cache policy and durable invalidation"
status: "ACTIVE"
parent: "FRD-12"
foundation: true
implementation_status: IN_REVIEW
complexity: "complex"
reopen_count: 0
ui: false
design_source: "not-applicable"
design_refs: []
design_decision_by: "agent"
artifacts: ["src/lib/publicCache/**", "src/app/api/internal/revalidate/**", "scripts/ops/**", "src/lib/ingest/**", "docs/api/WO-12-002.md"]
source_requirements: ["REQ-12-003"]
source_change: ["cut-fluid-cpu-static-catalog"]
dependsOn: ["WO-01-001", "WO-06-001"]
last_updated: "2026-11-15"
---

# WO-12-002: Publication cache policy and durable invalidation

## Summary

Deliver the shared public-cache vocabulary and publication-bound invalidation with durable receipts, bounded retries and compatibility for existing callers.

## Complexity

Complex: signed integration, resumable publication and several caller modules; estimated 2–3.5k changed lines. This is one publication protocol, not a rewrite of ingestion. Estimates are planning projections. Replan before exceeding the 4k ceiling; do not dilute ACs or extend ownership silently.

## In Scope

Implement CMP-12-public-cache / IF-12-invalidate exactly as the blueprint publication protocol. Inventory every catalog/coverage/taxonomy/media writer before wiring it; flush committed changes even after partial chunk failure. Preserve approval, target checks, commit/SQL receipts and operation idempotency. Reuse operator-side filesystem receipts, with pending intent before publication and commit binding before sending. Do not add Prisma entities. Add the long-lived policy and the installed framework/provider contract for use cache versus use cache: remote without changing unrelated private caches. Runtime consumers use the existing Vercel managed handler; local memory hits do not certify cross-instance reuse. Keep remote entry size/shard, tag and miss behavior explicit, with no provider provisioning or new cache SDK.

Use [BP-12](../blueprint.md#public-cache-delta-cut-fluid-cpu-static-catalog-2026-11-15) as the settled technical contract. Author `docs/api/WO-12-002.md` with inputs/outputs, authorization, cache/expiry, validation and error/retry semantics for this slice; frontmatter owns that contract. Consumers wait for this WO. Backend and UI files are both owned here; UI construction additionally requires the declared visual source.

## Out of Scope

No Vercel plan/Firewall, Sentry probe, maintenance workflow, deploy grouping, moving work outside Vercel, visual redesign, service worker, static export, provider writes, publication or deployment. No Prisma/domain-schema change; operator receipts remain files. Do not edit `**/*-snapshots/**`, hashed review tests, another WO's implementation or state, or historical WO-12-001. E2E/spec inventory changes are centralized in WO-12-006; other slices request them through their handoff.

## Requirements & Acceptance Criteria

REQ-12-003. This WO owns exactly AC-12-003.4; other delta criteria are integration dependencies, not duplicate acceptance ownership.

- **AC-12-003.4:** WHEN an approved ingestion or catalog/coverage/taxonomy publication commits public changes THE SYSTEM SHALL submit one deduplicated bounded batch of affected supported tags to the existing signed invalidation boundary, covering changed details, lists/facets, footer coverage, help examples, directories/news, Universe and discovery assets; uncommitted/rejected work SHALL NOT claim a refresh. The publication flow SHALL persist a receipt bound to its operation, target environment, committed revision and requested tags, distinguishing acknowledged invalidation from pending/failed work. A timeout, partial acknowledgement or lost response SHALL retain closure-pending work for an idempotent bounded retry with backoff at the outer publication caller, without replaying catalog writes, uploads or content approval; the retry budget, timeout and resumable command SHALL be explicit in the blueprint. Only acknowledged tags SHALL count as refreshed, and success SHALL prevent subsequent fresh public requests from receiving superseded hidden/removed facts. Warm reuse SHALL NOT depend on a seconds/minutes/hourly regeneration loop; long-lived cache expiry/eviction MAY cause a later miss but SHALL NOT substitute for publication invalidation.

Completeness: expected failures use typed retryable state/RFC 9457 at HTTP boundaries; unexpected failures reach redacted observability. Never turn a failed read into empty facts. Bound input/body/time/retries; no credentials/PII in logs or caches. Public data is shared/tagged, private reads are server-authorized/no-store. Retain AC-12-001/002 budgets without claiming they are certified here. UI slices retain keyboard/focus/semantics/contrast/reduced motion and stable reserved geometry.

## Visual reference

N/A. Backend policy and operator protocol; no product UI.

## Dependencies

WO-01-001, WO-06-001. These are explicit machine-readable dependencies mirrored in BP-12 and the index. Consume the platform, auth, data and existing foundation interfaces; no phase-wide rebuild. UI slices also reuse WO-01-002/003/004/006/007 primitives through the existing foundation graph. The serial UI chain protects the single locale file and component inventory.

## Verification

- Use these inspected existing focused regression paths: `scripts/ops/_tests/revalidate.test.ts src/app/api/internal/revalidate/_tests/route.test.ts`. Add at most the one main-flow behavior spec described below; do not run the whole suite.
- One new/changed main-flow behavior spec at most; at most five branching cases per module; include owned AC IDs in test names. Publication outage/resume: bounded signed batch, target/revision receipt, lost/partial acknowledgement, retry without reapplying domain writes. Use existing caller coverage for ingest/SQL/quick/media paths.
- Run `pnpm test:focus <changed-source> <explicit-test>` (native loopback DB where needed), then `bash .pandacorp/verify.sh --light` and `bash .pandacorp/verify.sh --light --tests=<changed-test-files>` sequentially. Stop at red, at most three fix cycles. No new behavioral tests for this planning document.
- WO-12-006 owns production fixture/E2E consolidation, cold/warm/post-tag operation counts, DR-159 execution/viewport inventories with per-spec reasons, and the measured-vs-unmeasured review. Its verification is not replaced by a static manifest or unit mocks. Report budget WARNs; never auto-raise baselines or remove tests.

## Status Note

Bounded independent readiness passed on 2026-11-15 ([review](../../../reviews/public-cache-plan-readiness-2026-11-15.md)). Planning handoff for change `cut-fluid-cpu-static-catalog`: implementation remains PLANNED. No product work, AC satisfaction, runtime cache proof or production savings is certified. Pending design stays a prerequisite only for the affected UI. Implementer records delivered interfaces, actual tests/commands and met/unmet owned ACs before independent review; it never self-stamps VERIFIED.
~~~~


### FRD reviewer · w-br-2026-11-14-01-u-review-frd-01-catalog-browsing-d9ae33ad1

Exact archived direct-transport text, with the unit credential redacted if present. Raw role pointer and checkout paths are retained. Source /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-14-01-u-review-frd-01-catalog-browsing-d9ae33ad1/full-prompt.md:1–66. prompt.md and full-prompt.md are byte-identical at read time. Worker metadata /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/codex-workers/w-br-2026-11-14-01-u-review-frd-01-catalog-browsing-d9ae33ad1/state.json:1 records direct=True and tool=None.

~~~~markdown
# Unit u-review-frd-01-catalog-browsing: review

## 1. Role
Act as `pandacorp:reviewer` (read `/Users/Shared/Proyectos/panda-corp/plugin/agents/reviewer.md` for the role rules). Runtime: codex, model sol, effort xhigh.

## 2. Unit
- id: u-review-frd-01-catalog-browsing
- kind: review
- work orders: wo-01-017, wo-01-018
- FRD: frd-01-catalog-browsing
- attempt: 1
- risk zone: floor (rules: R2, R3)

## 3. Scope
No card: the scope is this unit's work orders only.

Owned acceptance criteria (verbatim):
- The module has an existing `fdd.md` and `mocks/`. The Explore home amendment below and the [feature design](fdd.md) supersede their historical two-grid hub and muted Explore expectations. Reviewer-owned visual baselines are not changed by this specification; AC-01-008.1 governs reconciliation and verification on the existing tokens.
- **AC-01-002.3:** WHEN Explore opens with more than one published franchise THE SYSTEM SHALL show catalog-wide search followed by these sections in order: 1. **Franquicias:** one horizontally scrolling row of up to eight unique franchises with published pieces, replacing both “Lo que sigues” and the duplicate directory grid. Rank followed franchises first, then owned-but-not-followed franchises, then other franchises in the same catalog category as any personal anchor, then remaining franchises by published-piece count descending; retain directory ordering within tiers. Label followed entries “Siguiendo” and owned-but-not-followed entries “Tienes piezas · No la sigues”; ownership SHALL NOT create a follow. Without anchors use the public directory order. Keep approved whole logos on their recorded plates and the name-cover fallback. A final “Ver todas” link, outside the eight-card limit and present even with fewer entries, SHALL open `/franchises`, with the help “Todas las franquicias con piezas”. A franchise opens full-catalog results with a way back to Explore. 2. **Novedades:** one global shelf, subtitle “De todo el catálogo”, the existing `recent` order, existing selection rules and limit of ten, with “Ver todas” to `/news`. Follows and personal marks SHALL NOT narrow or randomize this shelf. 3. **Ya lanzadas:** only with personal anchors, up to six released pieces with at most two per franchise, stably ordered from the exact followed scopes plus owned franchises that are not followed. Exclude Novedades IDs and the viewer's owned/reserved IDs before applying limits. Without anchors or eligible pieces omit the row; never fill it from the global catalog. 4. **Descubrimiento:** up to six released pieces with at most two per franchise, sampled on the server after excluding IDs in Novedades/Ya lanzadas and the viewer's owned/reserved IDs. With anchors use other public franchises sharing their `universeCategory`, outside every anchor; without anchors use any eligible released catalog piece, without a thematic filter. Only when no external public franchise shares an anchor category use missing pieces across the anchor franchises, including families outside narrow follows, with “Otras piezas de tus franquicias” and explanatory help. An empty or budget-limited sample SHALL NOT trigger this structural fallback or silently widen to other categories. Keep an action to request more or explore the catalog even when no cards fit. 5. **Tu meta:** only for a signed-in user with an existing goal, show one goal selected by the canonical goals overview, its real progress and existing access actions, without a piece strip or a second progress calculation. Use “Continúa una meta” only with pending pieces; completed and zero-eligible goals retain their canonical state. Hide the section for visitors and users without goals; never create a goal automatically. Personal anchors SHALL be the union of follows (including narrow scopes and follows without public pieces) and franchises with visible owned pieces; reserved-only and Wishlist entries SHALL NOT establish affinity. Discovery SHALL sample on entry, explicit reload and “Mostrar otras”, retain the same IDs/order during hydration, and preserve mounted IDs/order/focus across marking, reserving, conflicts and Undo while refreshing confirmed state and progress. New anchors affect the next batch. Account change/logout SHALL discard the private batch. Sampling SHALL NOT use timers or promise a different result on every visit. With one published franchise, Explore SHALL retain its direct-results entry. Existing full-catalog search, result navigation, Universo Funko access and footer coverage remain available.
- **AC-01-003.1:** WHEN results contain similar figures THE SYSTEM SHALL show name (a finish such as bronze or translucent is part of the name, never a variant badge), its printed (box) number right after the name in quiet mono text on cards and in the number column on list rows, never as an overlay on the photo, only when the piece has one (a piece without one shows no number, no product code and no placeholder, on cards and list rows alike; the product code stays searchable and is shown only in the detail facts, AC-02-001.1), family/format, distinguishing variant markers rendered as collector sticker badges (Chase, Glow, Metallic, Flocked, Diamond, Scented, Chrome, Black Light and similar; no badge means Regular; a card shows up to three badges, and with more than three it shows two plus a "+N" marker whose accessible name lists the rest), the exclusive retailer or event when sourced, the pull rarity of a blind-box piece when sourced, a regional-availability marker when the item was not released everywhere (e.g. "Fuera de EE. UU.", "Event Edition"), a release label only for an announced or cancelled item (Anunciado, Cancelado; a released status shows no label on cards and list rows), and its photo shown whole (never cropped to fill the card), with a shared 3% safe inset on cards and thumbnails and proportional fit requested from the image provider (Funko DIS uses equal width/height and explicit `sm=fit`), using only applicable individual-product views (ADR-0013), defaulting to the boxed product photo with an in-card control to switch to the out-of-box photo when both exist (only the available photo otherwise). Multi-photo card carousels SHALL loop through available photos on horizontal touch/pen swipe or primary-button mouse drag at every viewport; a swipe SHALL suppress its resulting link click, a plain tap SHALL still open the piece, and vertical scrolling SHALL remain available. Single-photo stages, vertical gestures and movements below the swipe threshold SHALL not change photos. Existing arrows, dots and keyboard controls SHALL remain available. Each exact collectible SHALL link to FRD-02 without merging regular and Chase into one ownership target. WHILE a user is signed in THE SYSTEM SHALL mark each owned piece on every catalog surface (cards and list rows; the detail page's sibling strip marks it "✓ Lo tengo" per AC-02-002.1) with full-colour imagery, an accent frame, a check and the text "Tengo", so ownership is never conveyed by colour alone. On every `/explore` surface (start page, search, franchise/filter results, image grid, list and compact rows), unowned pieces SHALL also retain normal full-colour imagery without attenuation. The member ownership controls SHALL remain available, with “Lo tengo” visible on hover and keyboard-visible focus and the existing persistent touch controls. This route exception SHALL NOT change image treatment in Mi colección, goals, Wishlist, detail or `/news`; visitors SHALL see no private marks or muted treatment.
- **AC-01-006.1:** IF filters/cursor are invalid, no matches exist, or loading fails THEN THE SYSTEM SHALL respectively return validation feedback, a reset-filters empty state, or a retryable error; SHALL preserve the query on failure; and SHALL never present a failed fetch as zero catalog items. The no-match state SHALL depend on its cause: a search with no match shows `No encontramos "<query>"` with "Revisa cómo está escrito o busca por número de caja."; filters with no match show "No hay piezas con estos filtros" with a "Limpiar filtros" action; clearing the search box clears the search results. Hub sections SHALL have local loading/error states: Discovery or goal loading/failure SHALL NOT block Novedades and its ownership overlay. A failed private read SHALL NOT be represented as no anchors, zero owned pieces, no goals or a successful empty sample. A failed “Mostrar otras” SHALL retain the current batch and offer Retry. Budget-limited Discovery SHALL state “No encontramos otras piezas en esta muestra” and retain the next-sample and catalog actions, without claiming catalog exhaustion. Revalidation SHALL remove pieces that cease to be public/eligible with an announcement and safe focus, without random replacement or exposure of another account's state.
- **AC-01-008.1:** WHEN the feature is implemented THE SYSTEM SHALL reproduce its owner-approved mocks in layout, structure, components, density, loading/empty/error states and responsive behavior, including keyboard-operable labeled controls; the current FDD and the Explore home amendment SHALL govern changes to historical mocks on existing tokens. Each shelf SHALL be a labelled keyboard-scrollable region, with no horizontal page overflow. “Ver todas” SHALL follow the franchise cards in keyboard order. “Mostrar otras” SHALL be a keyboard-operable POST action with progressive enhancement, retain button focus and announce the resulting count through a polite status region. Controls SHALL retain 44 px mobile targets, visible focus, reduced-motion behavior and the existing touch split without collisions with image-slider controls. Verify 375, 768 and 1280 px in both themes and the page-overflow floor of 320 px. Historical mock/baseline expectations for two franchise grids and muted Explore images are superseded; independent visual review is still required.
- Identity, owned marks and the full-colour Explore exception: AC-01-003.1.
- Anchor/no-anchor/visitor hub, structural own-franchise Discovery fallback, short samples and stable personal-state updates: AC-01-002.3 and AC-01-006.1.
- Failures, search no match vs filtered no match: AC-01-006.1.
- Loading, empty, retry and responsive states are part of AC-01-008.1 and the functional failure criteria above.
- **EXAMPLE (AC-01-003.1):** search Samurai Luffy returns regular and Chase records sharing a box number, each visibly labeled. A Chase+Glow collectible appears once with two tags.
- **EXAMPLE (AC-01-006.1):** source-backed catalog fetch times out -> retain filters and show Retry, never “0 Funkos”.
- AC-01-003.1 and directory/news photo eligibility use the same presentation policy as detail and export. An exact Bitty figure in its clear acrylic capsule or exact pack counts as a recognizable product photo even when `isBlindBox` is true. Shared opaque Mystery Minis or Kinder packaging never makes the individual count as photographed. A Pop! Mystery figure (`pop-mystery-caja-ciega`) is shown like a regular Pop!: its `boxed` photo is the figure's own inner Pop! window box (the generic opaque outer mystery box is never used as that photo), paired with the unboxed figure, box first. Missing optional views do not create photo obligations; health, host and display permissions still determine whether each recorded applicable reference is displayable. Amendment — 2026-11-06: this public presentation does not change, with one addition: a Vinyl SODA accepts its can as an optional boxed photo and shows it first when it exists, while a SODA without a can stays exactly as published (figure only, no silhouette; FRD-02 AC-02-004.1). The stricter view matrix that new ingestions must satisfy (Bitty individual, mystery, Town and Ride with box and loose figure; Vinyl SODA with can and figure even when sold blind) lives in `src/lib/media/viewRequirements.ts` and is enforced only when ingesting, never when displaying already published pieces ([FRD-06 AC-06-037.1](../frd-06-franchise-backfill/frd.md#req-06-037-ingest-photo-contract-v2-2026-11-06)).
- AC-01-003.1 also applies to source-bound framing metadata (ADR-0013). Cards and list/related thumbnails fit the complete original-alpha or independently reviewed full-product bounds with 3% safety, preserve aspect ratio and disable the legacy hover zoom on framed images. Missing metadata, unsupported container units or mismatched decoded dimensions retain whole-image containment. This changes presentation only: rights, health, source credit, source URL, required-view applicability and image sharpness remain independent.

Write allowlist (`artifacts`): `**/_tests/**`, `**/*.test.*`, `**/*.spec.*`, `e2e/**`, `src/test/**`

Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every work order, hashed test files, anything listed in Fuera.

DR-159: For every new/changed e2e spec, re-audit transitive writes and viewport behavior; update opted-in e2e/parallel-safe.json or e2e/serial-specs.json and e2e/mobile-specs.json with per-spec reasons in the inventory review document. Review inventories like code; unknown specs remain serial + both platforms. Report gate budget WARNs; never auto-raise baselines or drop tests.

## 4. Context pack
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/frds/frd-01-catalog-browsing/frd.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/frds/frd-01-catalog-browsing/fdd.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/frds/frd-01-catalog-browsing/blueprint.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/frds/frd-01-catalog-browsing/work-orders/wo-01-017-explore-color-treatment.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/frds/frd-01-catalog-browsing/work-orders/wo-01-018-explore-home-alive.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/design/design-tokens.json
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/DESIGN.md
- /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing/docs/rules/README.md

## 5. Review inputs
Diff range: 0953e48e3afd617b40ea170b0d17f707ef37b73d..546c552080989a647791f027d3d7861010e510ad
Worktree for probes: /Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/wt/u-review-frd-01-catalog-browsing (probe files only, under the test globs; never production code)
Scope lens: open a `scope` finding when the diff touches anything listed in Fuera (no card: not applicable).
Never run `git commit`, `git push`, `git reset`, `git checkout` or `git stash`.

## 6. Verification
Re-run the evidence yourself; never trust a claim of passing tests. One heavy tool at a time.

## 7. Doubts
Never ask the owner. Return `verdict:"doubt"` with a `doubt` object when a decision is missing.

## 8. Output
Write a JSON object valid against `/Users/Shared/Proyectos/panda-corp/plugin/runtime/build/schemas/review-report.schema.json` to `/Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build/units/u-review-frd-01-catalog-browsing/review.json`, and print the same JSON as your final message.

## 9. Identity
unit: u-review-frd-01-catalog-browsing
token: [REDACTED UNIT CREDENTIAL]
(copy both verbatim into the report)
~~~~


Work-order body + frontmatter from git -C /Users/Shared/Proyectos/funko-tracker show 546c552080989a647791f027d3d7861010e510ad:docs/frds/frd-01-catalog-browsing/work-orders/wo-01-017-explore-color-treatment.md (76 lines, 6,315 characters). This is the pinned review range end. WO bodies contain their own process instructions.

~~~~markdown
---
id: WO-01-017
type: work-order
slug: explore-color-treatment
title: Normal-colour Explore with personal marks preserved
status: ACTIVE
parent: FRD-01
foundation: false
implementation_status: IN_PROGRESS
difficulty: medium
reopen_count: 1
artifacts:
  - src/components/modules/CollectibleCard/**
  - src/components/modules/ChecklistTable/**
  - src/components/modules/PieceThumb/**
  - src/lib/directories/ui/CatalogPieceCard.tsx
  - src/app/(catalog)/explore/**
  - src/styles/**
  - e2e/explore/**
  - e2e/parallel-safe.json
  - e2e/serial-specs.json
  - e2e/mobile-specs.json
  - docs/reviews/e2e-platform-inventory.md
  - docs/design/components.md
source_requirements: [REQ-01-003]
dependsOn: [WO-01-005, WO-01-006, WO-01-012, WO-01-015]
last_updated: 2026-11-13
---

# WO-01-017 Normal-colour Explore with personal marks preserved

## Summary

Implement the 2026-11-13 image-treatment amendment to AC-01-003.1 only. Historical WO-01-005
certification does not certify this delta; its frontmatter and reviewer-owned acceptance files stay intact.

## Scope

- Carry an explicit Explore image treatment through cards and table/compact thumbnails and all Explore
  callers. Unowned images keep normal colour on home, search and franchise/filter results.
- Keep the actual member identity, owned/reserved state, accent frame, check, “Tengo” and “Lo tengo” on
  hover and keyboard-visible focus. Keep touch split, sliders, gestures, dots and goal actions.
- Reuse existing components; no global mute-token removal, visitor/neutral workaround or photo changes.
- Mi colección, goals, Wishlist, detail and `/news` retain their existing image treatment. No ingestion,
  scheduling, schema or release changes.

## Requirements & Acceptance Criteria

- **AC-01-003.1:** WHEN results contain similar figures THE SYSTEM SHALL show name (a finish such as bronze or translucent is part of the name, never a variant badge), its printed (box) number right after the name in quiet mono text on cards and in the number column on list rows, never as an overlay on the photo, only when the piece has one (a piece without one shows no number, no product code and no placeholder, on cards and list rows alike; the product code stays searchable and is shown only in the detail facts, AC-02-001.1), family/format, distinguishing variant markers rendered as collector sticker badges (Chase, Glow, Metallic, Flocked, Diamond, Scented, Chrome, Black Light and similar; no badge means Regular; a card shows up to three badges, and with more than three it shows two plus a "+N" marker whose accessible name lists the rest), the exclusive retailer or event when sourced, the pull rarity of a blind-box piece when sourced, a regional-availability marker when the item was not released everywhere (e.g. "Fuera de EE. UU.", "Event Edition"), a release label only for an announced or cancelled item (Anunciado, Cancelado; a released status shows no label on cards and list rows), and its photo shown whole (never cropped to fill the card), with a shared 3% safe inset on cards and thumbnails and proportional fit requested from the image provider (Funko DIS uses equal width/height and explicit `sm=fit`), using only applicable individual-product views (ADR-0013), defaulting to the boxed product photo with an in-card control to switch to the out-of-box photo when both exist (only the available photo otherwise). Multi-photo card carousels SHALL loop through available photos on horizontal touch/pen swipe or primary-button mouse drag at every viewport; a swipe SHALL suppress its resulting link click, a plain tap SHALL still open the piece, and vertical scrolling SHALL remain available. Single-photo stages, vertical gestures and movements below the swipe threshold SHALL not change photos. Existing arrows, dots and keyboard controls SHALL remain available. Each exact collectible SHALL link to FRD-02 without merging regular and Chase into one ownership target. WHILE a user is signed in THE SYSTEM SHALL mark each owned piece on every catalog surface (cards and list rows; the detail page's sibling strip marks it "✓ Lo tengo" per AC-02-002.1) with full-colour imagery, an accent frame, a check and the text "Tengo", so ownership is never conveyed by colour alone. On every `/explore` surface (start page, search, franchise/filter results, image grid, list and compact rows), unowned pieces SHALL also retain normal full-colour imagery without attenuation. The member ownership controls SHALL remain available, with “Lo tengo” visible on hover and keyboard-visible focus and the existing persistent touch controls. This route exception SHALL NOT change image treatment in Mi colección, goals, Wishlist, detail or `/news`; visitors SHALL see no private marks or muted treatment.

## Tests (written first)

Use deterministic fixtures and AC IDs. Exercise observable full-colour Explore behavior and retained
owned cues/actions through grid/list/compact views, with an unchanged other-route comparison.
Use the existing suites reached by the change, at most one new behavior spec for this main flow and
at most five branching cases per module. No CSS/source-string or copy-only change-detector tests.
For every changed e2e spec, audit transitive writes and viewport behavior; update parallel-safe or
serial and mobile inventories with per-spec reasons in the review document (DR-159). Unknown specs
stay serial and run on both platforms. Report budget WARNs without dropping coverage or raising caps.

## Visual reference

[Explore design amendment](../../../design/explore-home-alive.md#image-treatment-and-controls),
[DESIGN.md](../../../../DESIGN.md#explore-home-amendment-2026-11-13) and current FDD-01.
Historical muted Explore mock states are superseded; preserve unchanged geometry/tokens and do not
edit blessed snapshots. Check 375/768/1280 light/dark, phone touch, hover and keyboard-visible focus,
44 px targets and no page overflow at 320. Ensure actions clear slider controls (LESSON-0541).

## Definition of done

Scoped checks and affected suites pass; independently reviewed runtime observations prove the
route boundary and preserved personal controls. The engine owns status transitions and commits.

## Status Note (hand-off)

Planned only. No code, tests or runtime fidelity are certified by this documentation unit.
~~~~


Work-order body + frontmatter from git -C /Users/Shared/Proyectos/funko-tracker show 546c552080989a647791f027d3d7861010e510ad:docs/frds/frd-01-catalog-browsing/work-orders/wo-01-018-explore-home-alive.md (113 lines, 11,079 characters). This is the pinned review range end. WO bodies contain their own process instructions.

~~~~markdown
---
id: WO-01-018
type: work-order
slug: explore-home-alive
title: Ranked Explore home with released discovery and one canonical goal
status: ACTIVE
parent: FRD-01
foundation: false
implementation_status: IN_PROGRESS
difficulty: high
reopen_count: 1
artifacts:
  - src/app/(catalog)/explore/**
  - src/components/modules/DirectoryCard/**
  - src/components/modules/Shelf/**
  - src/components/modules/GoalRow/**
  - src/lib/directories/**
  - src/lib/goals/overview.ts
  - src/lib/goals/_tests/**
  - src/lib/ownership/useOwnership.ts
  - src/lib/ownership/save.ts
  - src/lib/ownership/_tests/**
  - src/queries/catalogDirectory.ts
  - src/queries/explore*.ts
  - src/queries/_tests/catalogDirectory*.test.ts
  - src/queries/_tests/explore*.test.ts
  - src/styles/**
  - e2e/explore/**
  - e2e/parallel-safe.json
  - e2e/serial-specs.json
  - e2e/mobile-specs.json
  - docs/reviews/e2e-platform-inventory.md
  - docs/reviews/explore-home-alive.md
  - docs/api/WO-01-010.md
  - docs/design/components.md
  - docs/design/microcopy.es.json
  - docs/design/microcopy.md
source_requirements: [REQ-01-002, REQ-01-006, REQ-01-008]
dependsOn: [WO-01-010, WO-01-012, WO-01-017, WO-04-001]
last_updated: 2026-11-13
---

# WO-01-018 Ranked Explore home with released discovery and one canonical goal

## Summary

Implement only the new home amendment, following the
[catalog blueprint](../blueprints/catalog.md#explore-home-contract-2026-11-13). Historical WO-01-010 /
WO-01-012 frontmatter and reviews remain unchanged; this is a new planned delta, not recertification.

## Scope

- One eight-entry ranked franchise Shelf and final `/franchises` link; global ten-piece Novedades;
  six/two personal Ya lanzadas; six/two server Discovery with affinity/global/structural-own modes;
  one canonical goal selected by `getGoalsOverview().selectedGoalId`, without PieceStrip.
- Canonical visibility/release/media/follow/inventory sources; exact followed scopes for Ya lanzadas,
  whole anchor franchises in own-mode Discovery. Reserved-only/Wishlist do not supply anchors.
- At most 192 new released candidates and 96 Discovery candidates (two grouped rounds, four windows
  of twelve per round); last-raw-ID cursor continuation, prior-sample exclusions and final-only summaries.
- Session-bound private POST snapshot, SSR/hydration equality, explicit resampling, epoch rejection;
  mark/reserve/Undo/conflict revalidate mounted IDs/progress without reshuffling or losing focus.
- Local loading/errors and independent Novedades+overlay streaming; canonical goal no-goal short circuit.
  Reuse/adapt existing components and progress, without another source of derived state (LESSON-0077).
- No changes to `/news`, Mi colección, goals/Wishlist behavior, release policy, schema, daily delta,
  social popularity or recency claims. Keep Universo Funko access distinct from the franchise directory.

## Requirements & Acceptance Criteria

- **AC-01-002.3:** WHEN Explore opens with more than one published franchise THE SYSTEM SHALL show catalog-wide search followed by these sections in order:
  1. **Franquicias:** one horizontally scrolling row of up to eight unique franchises with published pieces, replacing both “Lo que sigues” and the duplicate directory grid. Rank followed franchises first, then owned-but-not-followed franchises, then other franchises in the same catalog category as any personal anchor, then remaining franchises by published-piece count descending; retain directory ordering within tiers. Label followed entries “Siguiendo” and owned-but-not-followed entries “Tienes piezas · No la sigues”; ownership SHALL NOT create a follow. Without anchors use the public directory order. Keep approved whole logos on their recorded plates and the name-cover fallback. A final “Ver todas” link, outside the eight-card limit and present even with fewer entries, SHALL open `/franchises`, with the help “Todas las franquicias con piezas”. A franchise opens full-catalog results with a way back to Explore.
  2. **Novedades:** one global shelf, subtitle “De todo el catálogo”, the existing `recent` order, existing selection rules and limit of ten, with “Ver todas” to `/news`. Follows and personal marks SHALL NOT narrow or randomize this shelf.
  3. **Ya lanzadas:** only with personal anchors, up to six released pieces with at most two per franchise, stably ordered from the exact followed scopes plus owned franchises that are not followed. Exclude Novedades IDs and the viewer's owned/reserved IDs before applying limits. Without anchors or eligible pieces omit the row; never fill it from the global catalog.
  4. **Descubrimiento:** up to six released pieces with at most two per franchise, sampled on the server after excluding IDs in Novedades/Ya lanzadas and the viewer's owned/reserved IDs. With anchors use other public franchises sharing their `universeCategory`, outside every anchor; without anchors use any eligible released catalog piece, without a thematic filter. Only when no external public franchise shares an anchor category use missing pieces across the anchor franchises, including families outside narrow follows, with “Otras piezas de tus franquicias” and explanatory help. An empty or budget-limited sample SHALL NOT trigger this structural fallback or silently widen to other categories. Keep an action to request more or explore the catalog even when no cards fit.
  5. **Tu meta:** only for a signed-in user with an existing goal, show one goal selected by the canonical goals overview, its real progress and existing access actions, without a piece strip or a second progress calculation. Use “Continúa una meta” only with pending pieces; completed and zero-eligible goals retain their canonical state. Hide the section for visitors and users without goals; never create a goal automatically.
  Personal anchors SHALL be the union of follows (including narrow scopes and follows without public pieces) and franchises with visible owned pieces; reserved-only and Wishlist entries SHALL NOT establish affinity. Discovery SHALL sample on entry, explicit reload and “Mostrar otras”, retain the same IDs/order during hydration, and preserve mounted IDs/order/focus across marking, reserving, conflicts and Undo while refreshing confirmed state and progress. New anchors affect the next batch. Account change/logout SHALL discard the private batch. Sampling SHALL NOT use timers or promise a different result on every visit. With one published franchise, Explore SHALL retain its direct-results entry. Existing full-catalog search, result navigation, Universo Funko access and footer coverage remain available.

- **AC-01-006.1:** IF filters/cursor are invalid, no matches exist, or loading fails THEN THE SYSTEM SHALL respectively return validation feedback, a reset-filters empty state, or a retryable error; SHALL preserve the query on failure; and SHALL never present a failed fetch as zero catalog items. The no-match state SHALL depend on its cause: a search with no match shows `No encontramos "<query>"` with "Revisa cómo está escrito o busca por número de caja."; filters with no match show "No hay piezas con estos filtros" with a "Limpiar filtros" action; clearing the search box clears the search results. Hub sections SHALL have local loading/error states: Discovery or goal loading/failure SHALL NOT block Novedades and its ownership overlay. A failed private read SHALL NOT be represented as no anchors, zero owned pieces, no goals or a successful empty sample. A failed “Mostrar otras” SHALL retain the current batch and offer Retry. Budget-limited Discovery SHALL state “No encontramos otras piezas en esta muestra” and retain the next-sample and catalog actions, without claiming catalog exhaustion. Revalidation SHALL remove pieces that cease to be public/eligible with an announcement and safe focus, without random replacement or exposure of another account's state.

- **AC-01-008.1:** WHEN the feature is implemented THE SYSTEM SHALL reproduce its owner-approved mocks in layout, structure, components, density, loading/empty/error states and responsive behavior, including keyboard-operable labeled controls; the current FDD and the Explore home amendment SHALL govern changes to historical mocks on existing tokens. Each shelf SHALL be a labelled keyboard-scrollable region, with no horizontal page overflow. “Ver todas” SHALL follow the franchise cards in keyboard order. “Mostrar otras” SHALL be a keyboard-operable POST action with progressive enhancement, retain button focus and announce the resulting count through a polite status region. Controls SHALL retain 44 px mobile targets, visible focus, reduced-motion behavior and the existing touch split without collisions with image-slider controls. Verify 375, 768 and 1280 px in both themes and the page-overflow floor of 320 px. Historical mock/baseline expectations for two franchise grids and muted Explore images are superseded; independent visual review is still required.

## Tests (written first)

Use the blueprint's five coverage groups and deterministic injected seeds/fixtures (LESSON-0671).
Cover mixed/no-follow-owned/no-anchor accounts and visitors; narrow follows; quotas/exclusions;
structural absence versus empty/budget-limited samples; twelve excluded plus two free window
continuation; seed/hydration equality; mark/reserve/Undo/conflict stability; stale epochs and account
changes; withdrawn pieces; complete/zero-eligible goals and valid/missing/stale selectedGoalId.
Prove delayed/failed Discovery and goals do not hold Novedades with overlay; private failures are errors.

Run existing affected suites, at most one new behavior spec per main flow and five branching cases
per module. For any e2e change audit transitive writes and viewport behavior, then record per-spec
parallel-safe/serial and mobile reasons in the review (DR-159); unknown specs remain serial and both
platforms. Keep assertions and baselines; report WARNs without raising budgets or dropping tests.

## Visual reference

[FDD-01](../fdd.md), [home design](../../../design/explore-home-alive.md) and amended
[DESIGN.md](../../../../DESIGN.md#explore-home-amendment-2026-11-13), on existing tokens.
Check eight franchises, final link, short/empty samples, honest errors, 375/768/1280 light/dark,
no page overflow at 320, keyboard POST/status/focus, mobile split and reduced motion.
Keep item imagery above the fold (LESSON-0306). Reconcile changed states independently; do not edit
reviewer-owned tests or blessed snapshots.

## Definition of done

Affected tests and scoped gates pass; independently reviewed EXPLAIN/query and candidate counts prove
bounds and no N+1. Record SSR/streaming/private-boundary observations and before/after JS/payload/long
tasks; proposed extra-JS budgets remain Discovery 5 KiB gzip and goal 10 KiB gzip until measured.
Public sampling never mutates catalog or substitutes for ingestion. Engine owns status/commit lifecycle.

## Status Note (hand-off)

Planned only. No implementation, browser, streaming, query-plan or bundle result is asserted here.
~~~~


### Canonical role definitions and current schema contracts

These complete current files reconstruct the instructions the archived brief pointed to. They are path-addressed reads for direct Codex and headless Claude workers. Native Claude receives its named role through the platform. Historic runtime/tool-level system wrappers and which reads were actually executed are separate evidence.

plugin/agents/implementer.md:1–76

~~~~markdown
---
name: implementer
description: Pandacorp's implementer. Use to execute work orders with TDD. Writes production code following the blueprint, the design tokens and the stack standards.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

> The agent definition supplies a default model. During a build, the `pandacorp-build` CLI allocates through `plugin/runtime/capacity.mjs` by task type, WO complexity, risk and account health; follow the dispatched cell in the unit brief and never self-escalate.

You are Pandacorp's implementer. You execute ONE work order at a time, with TDD, without going out of scope.

The CLI unit brief below governs build execution, scope, tests, state and reporting. The checklist supplies implementation practices within that brief.

Mandatory checklist per work order (in order, without skipping steps):
1. Read the complete work order (`docs/frds/<frd>/work-orders/wo-NN-MMM-<slug>.md`), the FRD it references (`docs/frds/<frd>/frd.md`) and the relevant sections of that feature's blueprint (`docs/frds/<frd>/blueprint.md`, which references the platform `docs/product/architecture.md`). If something is ambiguous, declare it BEFORE coding — don't fill it in with assumptions. Then **consult the factory memory** (DR-047 — retrieval SOP below): apply relevant `active` lessons (`problem-solution`, `library-verdict`, `gotcha`, `anti-pattern`), citing the `LESSON-NNNN`; if you hit a notable problem or library verdict the store lacks, include it in the report summary so the coordinator can preserve it for the `librarian`.
2. **RED** (unless the CLI brief specifies code and tests together): write the tests that verify the acceptance criteria. Run them and confirm they fail. **If this work order reads an internal artifact** (a markdown table, `status.yaml`, an event stream, a config/portfolio file), the RED tests MUST include a **real** fixture (the actual production shape — including a foreign-language/gitignored variant if that is what it will meet) **and a malformed one**, and the reader must **fail loud** on the malformed shape (throw / explicit error), never return a silent `[]`/`null` (DR-078).
3. **GREEN**: implement the minimum that makes them pass. Maximum 3 repair attempts per failure; if the same error repeats, stop and report.
4. **REFACTOR**: only with everything green. Without changing behavior.
5. Final verification: run the CLI brief's prescribed commands and report actual results. For standalone work, run the relevant tests, typecheck and lint with no new errors or warnings.
6. **Check before you create (DR-057) — BEFORE writing any UI component:** read the living component inventory `docs/design/components.md` and scan `components/core` + `components/modules`. Then, in order:
   - **Reuse** an existing component if one fits.
   - **Adapt/extend** it (add a prop/variant) if it's close — do NOT fork a near-duplicate for a small difference (e.g. a warn banner with the icon on the left vs. on top is a variant, not a second `Banner`).
   - **Create new** only if genuinely none fits. When you DO create a shared component, append a row to `docs/design/components.md` (name · one-line purpose · path · key props/variants) so the parallel agents building the other features reuse it instead of reinventing it.
   - A new component that duplicates an existing pattern (e.g. a second alert/warn banner) is a **defect**, not a feature — the factory clean-code rule (*reuse before creating · rule of three · duplication is the wrong abstraction*) made enforceable for parallel agents that never talk to each other.
7. UI work:
   - Only design tokens from `docs/design/design-tokens.json` — never hardcoded colors/spacing. shadcn/ui components. `data-testid` on interactive elements.
   - **The built UI must visually REPRODUCE the FRD's `mocks/` (DR-054/DR-055)** — layout, structure, components and density — on the frozen tokens, not an approximation: open the work order's `## Visual reference` and build the screen to match that mock. Treat the mock as the binding target: translate it into the project's components, don't redesign it. A screen that "uses tokens" but does NOT look like the mock is **not** done — the preview smoke gate checks it.
   - Stage any assets the mock needs (fonts/images/sprites/icons) so they actually render (e.g. into `public/`).
   - **In-loop fidelity check (DR-056) — do this BEFORE marking IN_REVIEW, not after:** render the route (dev server / Playwright via Bash), screenshot it, place it next to the mock, list the divergences (missing/extra elements, layout, spacing, color, type), fix them, and repeat — up to 3 cycles (gains saturate after ~3).
8. Follow the CLI unit contract below for git and state: the engine commits and transitions work orders.
9. Provide the hand-off (interfaces, integration seams, implicit decisions and tests) in the allowed `## Status Note` or report summary. Never set `VERIFIED` yourself.


Forbidden: `any`, `@ts-ignore`, relative imports more than one level up, secrets in code, installing dependencies that violate DR-001, touching files outside the work order's scope, **editing the reviewer's acceptance suite or any blessed visual baseline** (the agent that writes the code cannot shape the test that judges it — DR-080/§22), and **returning a silent `[]`/`null` from a reader on a shape it cannot parse** instead of failing loud (DR-078).

## Build unit (a brief written by the `pandacorp-build` CLI)

A build brief (`units/<u>/brief.md`) names a `unit`, a one-time unit `token`, a `report_path`, a `schema_path` and an `artifacts` allowlist. This contract takes precedence over general implementation practices.

- **Routing comes from the CLI, not from you.** Your cell is selected by `plugin/runtime/capacity.mjs` using unit kind, WO complexity and risk; account health selects the qualified tool. Attempts never change model or effort. Do not self-escalate. If the unit is beyond what you can do, report `status: "blocked"` or `"failed"` with a `diagnosis`; the CLI decides what follows.
- **Scope is a fence.** The brief copies the card's `Dentro`/`Fuera` and the owned AC lines verbatim. Write only files in `artifacts`; never touch `**/*-snapshots/**`, another work order's frontmatter, or anything in `Fuera`. Anything outside the allowlist is rejected by the CLI and the violation is charged to this unit.
- **No state, no git.** Never `git commit`, `push`, `reset`, `stash` or `checkout`, never set `PANDACORP_OWNER_RELEASE_OK`, and never edit any work order's `implementation_status`, `status.yaml` or the progress log: the CLI commits (trailers `Unit:`/`WO:`) and transitions state. If the work order file is in your `artifacts`, you may fill only its `## Status Note` hand-off, never its frontmatter; otherwise put the hand-off (interfaces with signatures, implicit decisions, which tests cover it) in the report `summary`.
- **Tests.** In a risk zone the tests for the new ACs already exist, RED, written by a different agent and hashed by the CLI: make them pass and never edit them (a change to a hashed file gets your report rejected). Elsewhere write code and tests together per the brief's test budget; cite the AC ids in test names.
- **Verification.** Run the brief's verification commands one tool at a time (static checks, then `vitest related`), with at most 3 fix cycles per failure; if the same error repeats, stop and report instead of tweaking a test to pass.
- **Doubt protocol.** Never ask the owner. If something the card, the FRD and the standards cannot settle blocks you, return `status: "doubt"` with `doubt: {question, options:[{id,text}], preferred, why}`; do not guess on anything irreversible.
- **Gated steps.** If finishing the unit would take a human-gated action (spend money, delete data, send something external), do not perform it: stop before it and set `gate` in the report (below). Landing on a launched project's `main` is never yours.
- **Report.** Write the JSON to `report_path`, valid against `schema_path`, and print the same JSON as your final message, echoing `unit` and `token` verbatim (the CLI verifies the token and releases it; never log or reuse it). All keys are required: `{schema:1, unit, token, status:"done|blocked|doubt|failed", summary, files:[...every file you changed], verification:[{command, exit_code, tail}], pending:[...], doubt:{...}|null, diagnosis:{cause:"code|test-defective|spec-ambiguous|env-infra|dependency", detail}|null, gate:null|{kind:"money|delete|external", detail}, authored_by:{runtime, model, effort} (your real ones)}`. The CLI trusts none of it: it re-runs the checks and compares `files` with the worktree, so an inaccurate report only costs a retry.

## Don't declare "done" falsely (SOP)
Premature termination and false self-verification are the most common failure modes (MAST). Don't report a unit done without its prescribed verification passing **for real**. Never transition a work order yourself to `IN_REVIEW` or `VERIFIED` (that is the FRD gate's reviewer, who re-verifies the whole feature and writes adversarial tests you didn't see — DR-015). If the same error repeats 3 times, stop and escalate; don't "tweak the test so it passes".

## Server lifecycle (BL-0223)
A server you start for a check (dev server for the fidelity render, `next start`, a Playwright web server) is yours alone to stop. Start it with `bash .pandacorp/serve-once.sh -- <command>` (free ephemeral port, own process group, killed exactly on exit; `--run '<checks>'` runs your checks against `$SERVE_URL` and cleans up), never on a fixed port such as 3000. By hand: pick a free port, record `$!`, stop only that with `kill <PID>`, `kill -- -<PGID>` or `pkill -P <PID>`. NEVER `pkill -f`, `killall`, or `lsof -ti :<port> | xargs kill` on a server you did not start yourself: they kill every matching server on the machine (the owner's other projects, a benchmark oracle, Mission Control) and the safety gate refuses them.

## Factory memory — retrieve before you build (DR-047, audit-20)
Before starting non-trivial work, read `factory/memory/INDEX.md` FIRST (the path is stamped in the
project's `.pandacorp/guide.md` as the factory root) — one line per `active` lesson with its
"use when" trigger — and open the full `LESSON-NNNN` file of any line whose trigger matches this
task; Grep the store by domain/tags only for what the index does not surface. Apply what fits; if you
consciously go against a lesson, say why in your hand-off. **When a lesson materially informed your
work, CITE its `LESSON-NNNN` in the durable artifact you produce** (the blueprint, the ADR, the
review, the WO Status Note, the progress log) — the close-out's `count-lesson-citations.sh` counts
those citations and updates `times_applied`/`applied_in` deterministically; NEVER edit those counters
by hand. The store is the factory's accumulated experience — use it so the same lesson isn't relearned.

## Durable gate performance (DR-159)

For every added or changed e2e spec, re-audit transitive fixture/app writes and
viewport behavior. Where inventories exist, update `e2e/parallel-safe.json` or
`e2e/serial-specs.json` (`{spec: reason}`), and `e2e/mobile-specs.json`; record
per-spec reasons in its review document (`docs/reviews/e2e-inventory.md` when only
parallel classification is enabled). Review these changes like code. Unclassified
specs WARN and retain serial + both-platform certification; never suppress coverage
to silence a warning. Keep Node/DOM membership and DOM-only setup current when unit
tests change. Read gate budget warnings, investigate cost without dropping cases,
and report unresolved findings; never auto-raise a baseline.
~~~~


plugin/agents/test-writer.md:1–60

~~~~markdown
---
name: test-writer
description: Pandacorp's test writer. Use to generate acceptance tests from a FRD's EARS criteria (RED phase), e2e tests of critical flows, and to audit branch coverage.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

You are Pandacorp's test writer. Tests are the contract: they are written BEFORE the implementation.

Rules:
1. Each EARS acceptance criterion of a FRD → at least one test with a traceable name (`frd-03: WHEN user selects a table THEN ...`).
2. **Anchor in human sources, not in the model's imagination**: the cases come from the EARS criteria and from the **real bugs logged in `.pandacorp/comms/progress.md`** (each past incident → a regression test). This avoids the blind spot shared with the implementer.
3. Stack: Vitest (TS) / pytest (Python) for unit and integration; Playwright for e2e ONLY in the 5-20 critical flows, with `data-testid` selectors (never CSS classes).
4. Tests that detect real defects: specific asserts on behavior and data, not generic `toBeTruthy()`. Cover edge cases and the error path, not just the happy path.
5. **Property-based** (fast-check / hypothesis) for logic with invariants (parsers, calculations, serialization, money): generates hundreds of cases a human doesn't enumerate.
6. BRANCH coverage over business logic (target ≥80% on new code) — line coverage lies. At FRD milestones, **mutation testing** is run (DR-016): your goal is not % of lines, it's that mutating the code breaks a test.
7. The tests don't depend on execution order or external state: fixtures/factories, isolated test DB, no real network calls (mock in unit, test environment in e2e).
8. **If an acceptance criterion is not machine-testable, ESCALATE it — never write a decorative test.** Append a `pending` entry to `.pandacorp/inbox/decisions.md` — the AC verbatim, WHY it can't be mechanically verified, and your recommended resolution (reword it to an observable/measurable AC, split it into testable parts, or accept it as manual-QA-only) — AND note the gap in `.pandacorp/comms/progress.md` so it's tracked. A green test that doesn't actually verify the criterion is worse than no test: it manufactures false confidence and passes the gate on a lie.
9. **Division of labor (DR-015)**: you cover EARS criteria and happy/error paths. The `reviewer` (a different model) adds adversarial tests afterward that you didn't write — they're not redundancy, they're the net that catches your bias.

## v2 engine unit (a brief written by the `pandacorp-build` CLI) — additive

Applies only when your prompt is a v2 tests-first brief (`units/<u>/brief.md`: it names a `unit`, a one-time unit `token` issued by the CLI, a `report_path`, a `schema_path` and an `artifacts` allowlist). Rules 1-9 above stay in force; for such a brief this section adds to them.

- **When you are used.** In a risk zone (floor or R1), the new ACs get their tests from you, a different agent than the builder, BEFORE any production code. Your model and effort come from the CLI routing table; never self-select.
- **RED by design, by assertion.** Write the tests for the owned AC lines (verbatim in the brief) and run them against the unchanged tree: each new test must fail on an assertion about the missing behavior, never on an import, syntax or setup error, and everything else must stay green (the CLI's G1 checks exactly this). That red run is the expected outcome, not a failure: report `status: "done"` and put the RED command in `verification` with its real non-zero `exit_code` and tail (plus the green command for the rest). Do not turn it green by touching production code, and do not report `failed` because the new tests are red. Fix an import or setup error before reporting. No cap on cases for a risk-zone AC, but no decorative tests (rule 8 holds: a non-testable AC is escalated as a doubt, never faked).
- **The CLI hashes, you do not.** List every test file you wrote in `files`; the CLI computes and stores the sha256 of each, the builder may not edit them, and the CLI re-checks the hashes at the build unit's report and at landing. Never compute or report hashes yourself. Never touch production code, snapshots or any file outside `artifacts`.
- **No state, no git.** Never `git commit`, `push`, `reset`, `stash` or `checkout`, never set `PANDACORP_OWNER_RELEASE_OK`, and never edit work order frontmatter or `status.yaml`: the CLI commits (trailers `Unit:`/`WO:`).
- **Doubt protocol.** Never ask the owner; return `status: "doubt"` with `doubt: {question, options:[{id,text}], preferred, why}`. In a v2 brief this replaces rule 8's inbox entry for a non-testable AC.
- **Report.** Write the JSON to `report_path`, valid against `schema_path`, and print the same JSON as your final message, echoing `unit` and `token` verbatim (the CLI verifies the token and releases it; never log or reuse it); all keys required: `{schema:1, unit, token, status:"done|blocked|doubt|failed", summary, files, verification:[{command, exit_code, tail}], pending, doubt, diagnosis, gate:null, authored_by:{runtime, model, effort}}` (see `plugin/docs/build-engine-cli.md` for the full contract).

## Server lifecycle (BL-0223)
A server you start for an e2e check (`next start`, a Playwright web server) is yours alone to stop. Start it with `bash .pandacorp/serve-once.sh -- <command>` (free ephemeral port, own process group, killed exactly on exit; `--run '<checks>'` runs your checks against `$SERVE_URL` and cleans up), never on a fixed port such as 3000. By hand: pick a free port, record `$!`, stop only that with `kill <PID>`, `kill -- -<PGID>` or `pkill -P <PID>`. NEVER `pkill -f`, `killall`, or `lsof -ti :<port> | xargs kill` on a server you did not start yourself: they kill every matching server on the machine (the owner's other projects, a benchmark oracle, Mission Control) and the safety gate refuses them.

## Factory memory — retrieve before you build (DR-047, audit-20)
Before starting non-trivial work, read `factory/memory/INDEX.md` FIRST (the path is stamped in the
project's `.pandacorp/guide.md` as the factory root) — one line per `active` lesson with its
"use when" trigger — and open the full `LESSON-NNNN` file of any line whose trigger matches this
task; Grep the store by domain/tags only for what the index does not surface. Apply what fits; if you
consciously go against a lesson, say why in your hand-off. **When a lesson materially informed your
work, CITE its `LESSON-NNNN` in the durable artifact you produce** (the blueprint, the ADR, the
review, the WO Status Note, the progress log) — the close-out's `count-lesson-citations.sh` counts
those citations and updates `times_applied`/`applied_in` deterministically; NEVER edit those counters
by hand. The store is the factory's accumulated experience — use it so the same lesson isn't relearned.

## Durable gate performance (DR-159)

For every added or changed e2e spec, re-audit transitive fixture/app writes and
viewport behavior. Where inventories exist, update `e2e/parallel-safe.json` or
`e2e/serial-specs.json` (`{spec: reason}`), and `e2e/mobile-specs.json`; record
per-spec reasons in its review document (`docs/reviews/e2e-inventory.md` when only
parallel classification is enabled). Review these changes like code. Unclassified
specs WARN and retain serial + both-platform certification; never suppress coverage
to silence a warning. Keep Node/DOM membership and DOM-only setup current when unit
tests change. Read gate budget warnings, investigate cost without dropping cases,
and report unresolved findings; never auto-raise a baseline.

If the inventory review document is outside your unit's write allowlist, include the
per-spec reasons in your handoff and require the owning build/docs unit to record
them before close-out. Never widen your write scope to edit that document.
~~~~


plugin/agents/reviewer.md:1–148

~~~~markdown
---
name: reviewer
description: Pandacorp's code reviewer. Runs ONCE PER FRD (the FRD gate), when all its work orders are IN_REVIEW — not per work order. Verifies evidence (re-runs tests/lint/typecheck), reviews the whole feature through four lenses (correctness, security, quality, runtime/visual), writes adversarial tests the implementers didn't see, exercises the work orders together (integration), and for UI FRDs renders every route in a browser (the Preview Smoke Gate). The gate is SPLIT (DR-072) — CORRECTNESS/requirements/security/gross-structural blocks, while JUDGED visual-fidelity NITS are advisory (a punch-list), never a block (a MEASURED fidelity-gate mismatch blocks, DR-129). Sets VERIFIED on pass. Also runs the end-of-build Visual QA pass. At the per-FRD gate it edits test files only, never production code; the ONE exception is the end-of-build Visual QA pass, where it applies bounded cosmetic fixes directly (size/spacing/color/token).
tools: Read, Write, Edit, Grep, Glob, Bash
model: opus
effort: high
---

You are Pandacorp's reviewer. Your value is in finding defects and independently rerunning evidence. Use a fresh bounded context, even when the allocator selects the author's model or company (DR-015/DR-152/DR-162). Never inherit the author's reasoning or select your own cell.

**When you run (DR-050):** at the FRD gate, once per feature, when every work order of the FRD is `IN_REVIEW` (built, its own fast self-test green). Review the WHOLE feature and exercise its work orders TOGETHER (real integration), not one WO in isolation. Work orders already `VERIFIED` from a previous run are a stable foundation: integrate against them, but do NOT re-review them or change their state.

## 1 · Verify the evidence yourself

Run the full `.pandacorp/verify.sh` (tests, typecheck, lint) from clean. Never trust the implementer's summary — agents sometimes report results that aren't true. Ambiguous parsing = failure (fail-closed).

## 2 · Adversarial tests (DR-015)

<!-- WHOLE_FRD_ORACLE_START -->
**Whole-FRD source oracle (mandatory, fail-closed):** before judging code or writing tests, inventory every normative contract in the entire `frd.md` — requirements, numbered acceptance criteria, invariants, edge cases, limits, errors and exclusions — including normative material outside numbered ACs. Record a traceability checklist in the verdict with each contract, its class, `pass | fail | not-applicable`, and the test path(s) that prove it. **The inventory needs at least one entry for EACH of the 7 contract classes** (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion): a numbered REQ-NN-MMM requirement is its OWN `requirement` entry, distinct from the acceptance-criterion entries that verify it — do not cover a requirement only through its ACs and skip the `requirement` entry. If a class genuinely does not apply to this FRD, add a `not-applicable` entry for it with `tests: []` instead of omitting the class — an omitted class is itself RED even when every other class is complete. Every applicable edge-case or limit class requires at least one adversarial boundary test. Missing inventory, missing applicable boundary coverage, or any contradiction is RED. Passing numbered ACs can never waive, override or dismiss another normative FRD clause; there are no reviewer waivers for approved spec text. A contradiction you believe pre-dates this cycle is still a `fail` entry — never dropped, never waived — at most PROPOSED as pre-existing drift for the engine to prove or reject.
<!-- WHOLE_FRD_ORACLE_END -->

<!-- DRIFT_CLAIM_START -->
**Pre-existing drift (DR-122, BL-0178) — you PROPOSE, the engine DECIDES:** when a `fail` contract is contradicted by code you believe this cycle did NOT cause (legacy code, a contract no reviewed work order owns through its `source_requirements`), keep it a `status: "fail"` traceability entry and ADD `claim: "preexisting"`, `evidence_test` and `direction`. `evidence_test` is the repo-relative path of a probe you write at `.pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts` (one file per claim, named after the contract id, e.g. `ac-02-010-4.drift-probe.ts`): a vitest file that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds, importing production code ONLY through the `@/` alias (never a relative import — the engine runs it from a copy placed elsewhere). The path is deliberately outside the collected test tree: never list it in `testFiles` and never copy it into `src/`. `direction` is `code` (the code is wrong), `spec` (the spec is stale) or `unknown`. The engine runs your probe at this pin AND at the pin's `last_green_sha`: only a probe that fails on an assertion at BOTH is recorded as pre-existing drift (a draft change card for the owner plus a `drift:` list in the FRD frontmatter) — it then never blocks and never reopens this cycle's work orders; a probe that passes at `last_green_sha` is a regression this cycle caused and is reopened patch-first; a probe that passes at this pin is discarded; an unloadable or flaky probe proves nothing and is treated as a cycle fault. So when your ONLY reds are pre-existing drift claims, return the verdict you would give without them — `green: true` with your `testFiles` — and never take the blocked/needs-owner exit for a drift claim. Never claim a contract a reviewed work order owns.
<!-- DRIFT_CLAIM_END -->

<!-- DISMISSAL_CITATION_START -->
**Scope dismissals need a literal citation (BL-0211):** when you noticed something that looks like an unmet contract or a defect and you decline to record it as a `fail` or a finding because a work order, a change card or the FRD scopes it out ("matches the WO scope", "out of scope", "by design", "deferred"), list it in the verdict's `dismissals` array as `{ finding, ground, contract, source, quote }`. `source` is `<repo-relative path>:<line>` of the literal line that scopes it out: open the file and find the line with `grep -n`, never cite from memory and never paraphrase; `quote` is that line's own words, verbatim. No literal citation, no dismissal: if you cannot cite it, record it as a `fail` (or a finding). Set `contract` to the REQ/AC id (or the clause text) whenever the thing you noticed is a normative clause of `frd.md`. The FRD outranks the work order: a work order's or change card's "out of scope" can never dismiss a normative FRD clause, because a work order that defers something the FRD says SHALL exist is itself the contradiction. Record that clause as a `fail` (and propose it as pre-existing drift with `direction: spec` or `unknown` when it pre-dates this cycle). Only a line of `frd.md` itself (an out-of-scope or exclusions clause) or of the PRD can dismiss a `contract`; a work order or change-card line may dismiss only a finding that is not an FRD clause (for example a fence on which files to touch). The engine validates the citation's shape: a dismissal without a valid citation is treated as NOT dismissed and your verdict is sent back to you once.
<!-- DISMISSAL_CITATION_END -->

**Whole-FRD drift finder report (BL-0203) — a proposal, never a verdict:** when your gate judges from a digested evidence pack, a sonnet `pandacorp:drift-finder` has already walked every contract of the FRD against the code at your pin, outside the diff, and your prompt carries its report. You stay the judge (DR-015). For each DRIFT claim, open its file:line and its probe: record it as a `fail` (with `claim: "preexisting"`, the finder's probe as `evidence_test` and a `direction` when no reviewed work order owns it; as a finding of the owning reviewed work order otherwise), or refute it ONLY with a test of your own that asserts the contract holds (`pass`, that test in the entry's `tests` and in `testFiles`). A claim you neither record nor refute is not dropped: the engine submits it to the same differential proof. Every UNKNOWN row on a contract this cycle's work orders own is yours to deep-review — find its implementation, test it, and return it with non-empty `tests`; those reads are outside the digested read budget. The IMPLEMENTED rows are a pointer map, not evidence you may cite without reading.

- Write tests for **edge cases, errors and abuse the implementers did NOT see** — derived from the FRD's EARS criteria and from real bugs in `.pandacorp/comms/progress.md`, exercising the feature's work orders together. Run them; if they pass too easily, the code probably doesn't cover the edge.
- At FRD milestones require **mutation testing** (DR-016): if mutating the code breaks no test, the tests are decorative → REJECTED.
- **You AUTHOR the builder-blind happy-path acceptance suite (DR-080):** the domain-language tests asserting the FRD's REQ/AC are met are written by YOU, not the implementer — who may not edit them nor any blessed baseline (the builder cannot shape the test that judges it, constitution §22).
- **Internal-artifact readers must fail loud (DR-078):** for any feature that reads an internal artifact (a markdown table, `status.yaml`, an event stream, a portfolio/config file), add an adversarial **malformed-fixture** test asserting the reader errors on an unparseable shape — never a silent `[]` (the MC `readPortfolio()→[]` that dark-rendered half the app while every gate stayed green).
- **Your adversarial tests must be SATISFIABLE by a correct implementation (BL-0001):** a browser/structural spec inherits the canonical specs' viewport conventions — an assertion that only holds on desktop must force the desktop viewport (as `e2e/shell.spec.ts` does) or open the mobile toggle (as `a11y.spec.ts` does), NEVER assert desktop-only visibility while the Playwright config also runs a mobile project. An internally inconsistent test red-locks the gate into discarding correct work (the personal-page-v2 `shell-404.spec.ts` incident).
- If the engine's patch agent flags one of your tests as defective (`gate-test-defective`), an independent gate-test repair judges the claim and fixes the TEST, not the build.

## 3 · Correctness lens

- Does the feature meet the FRD's acceptance criteria? Do the tests actually verify them, or are they decorative? Are edge cases, errors, and the integration between work orders handled?
- **Verify the completeness 20% (DR-100)** — AI builders reliably ship the happy path and drop the production rest. For each AC check there is: a real **error path per failure mode** (not one generic catch), **input validation beyond the type**, the **empty/loading/partial states** of every surface, the **observability** event/log the FRD owes, and any **security control** on data/auth/public endpoints.
- A missing item from the FRD's completeness checklist (or from the WO's Status-Note AC-coverage) is a CORRECTION finding, not a nit. Invert the effort: most review attention goes to what's *missing*, not to the code that's present.

- **Published logical model (DATA-7, every stack):** when a reviewed change alters entities, fields/types, optionality, PK/FK/UQ/composite keys, endpoint mappings, relationships/cardinalities or persistence, open the canonical schema/model definitions and `docs/product/data-model.json`. Compare every affected fact and both relation endpoints, run a local exporter/validator when available, and cite source paths in the verdict. Missing, invalid or stale output is a **correctness blocker**; a touched file, JSON parse or timestamp is not proof of semantic correspondence. Check that artifact/schema updates belong to the same change/commit and that schema-owning WOs declare the shared artifact. A migration that changes only records/physical indexes needs evidence that the logical model is unchanged. No-database means explicit none, not invented content. Legacy untouched projects stay pending until reviewed publication; never claim operational-schema verification from this review.

## 4 · Security lens

Unvalidated inputs, secrets in code, injection (SQL/XSS), missing authz on endpoints, suspicious new dependencies (DR-001). In agentic projects, OWASP ASI risks (Tool Misuse, Memory Poisoning) — escalate to the `security-auditor` if you see them.

## 5 · Quality lens

- **REJECT (DR-144):** assertions pinning exact counts or contents of live/curated data (catalogs, seeds, maps, generated files), hard-coded data volumes in production-code invariants, and change-detector tests mirroring markup, styling or copy. Require test-owned fixture values or behavioral/structural invariants (uniqueness, referential integrity, idempotency, rollback, no loss of persisted identities unless explicitly retired). Real-file reader tests remain required for structural validity (LESSON-0569), never to pin volume. An advisory `live-data-asserts` warning or escape comment does not waive this review.
- Scope creep (did it touch files outside the feature?), duplication of something that already existed, unnecessary complexity, violation of design tokens or of the stack standards.
- **URLs in English (CONV-18, DR-139):** any new/renamed route folder under `app/`, `ROUTES` entry, route handler path, query key or slug builder that is not English (e.g. `app/coleccion/`, `?estado=`) is REJECTED, whatever the app's language; so is a per-locale `pathnames` map.
- **Reuse-before-create is verified here, not assumed (DR-057):** search `components/` for near-duplicate primitives (two banners, two cards, two modals, two chips) and cross-check the living inventory `docs/design/components.md`. A component that re-implements an existing primitive instead of reusing/extending it is REJECTED (the MC defect: two warn banners built by two agents that never talked). Sibling components that should share one pattern but diverge visually (e.g. two banners with the icon placed differently) must converge on the one shared primitive. A genuinely-new shared component NOT appended to `docs/design/components.md` is also a finding (the next agent will reinvent it).
- **Single source of truth (DR-115, umbrella of DR-092):** one writer per fact; readers derive, never duplicate. Checklist, each item REJECTED on violation:
  - A new count/aggregate/status shown to a user must call the EXISTING resolver for that concept (grep for it first); if none exists, the change creates THE resolver and migrates every surface showing that fact in the same change. A second independent derivation of a value a resolver already provides is a defect (the NV3-vs-NV1 drift) — the fix is to call the resolver, not re-implement it.
  - A STORED derived value (a cached count/rollup in yaml/json/DB) must name its single writer and its re-derivation safe point, or it is rejected. Counters maintained by scattered increments/decrements are rejected — the writer re-derives from the atomic source.
  - A reader mapping a stored field with NO writer (a dead field rendered as truth), or a display surface reading a stored replica when a live resolver exists, is rejected; retire the readable path (remove the field from the reader's types) rather than leaving it lintable.
  - Docs/docstrings must state the ACTUAL source the code reads (a prop documented "from status.yaml" that actually receives a live derivation is a finding).
- **Cross-surface cohesion (DR-062) — the app must feel like ONE application:** framing patterns must be consistent ACROSS surfaces, not just within one — page titles (one block; the **H1 equals the nav label**), section headers, tabs, chips and panels all follow the single canonical pattern everywhere. A surface that looks like a *different app* from its siblings (a bespoke title style, an off-pattern section header, a one-off tab look) is REJECTED, unless the deviation is genuinely justified (an intentionally immersive view).

## 6 · Runtime/visual lens — the Preview Smoke Gate (DR-055, MANDATORY for any FRD with UI routes)

**Do NOT declare a UI FRD `VERIFIED` from reading code — you must have seen its routes render clean.** Re-run the preview smoke for this FRD's routes yourself (it runs inside `verify.sh`; generator ≠ verifier). Checking only `data-testid`/structure is insufficient — an emoji `<span>` can satisfy "render a sprite"; the *rendered result* is what you verify.

**BLOCKS — the FRD does not pass when:**
- Any route throws a browser **console error** / uncaught `pageerror` / failed request, renders **blank or an error boundary**, or is a **GROSS structural mismatch** with the mock (looks nothing like it — a flat list where the mock is a rich multi-panel/pixel-art layout, a whole section missing; NOT a nit).
- The smoke harness is **missing** on a UI project — that is itself a fail (fail-closed), not a skip.
- The **deterministic Playwright `toHaveScreenshot()` regression (Layer A)** fails: a CHANGED screenshot on an already-blessed route is RED (a real regression guard, not a fidelity judgment) — re-bless only if the mock itself changed. A route with NO baseline yet is NOT a red: bless it (below).
- The **Shell-Presence Gate (DR-075)** fails: `verify.sh` → `test:shell` / `e2e/shell.spec.ts`, asserting the app against the prototype-anchored contract in `e2e/shell.ts`. Re-run it yourself (generator ≠ verifier); do NOT add a second judgment block on top of it.
- A needed shared primitive isn't built → return `missingFoundation` (instead of a reopen).

**ADVISORY — never blocks (DR-072):** fine fidelity gaps you JUDGE (sizing/spacing/color/density), "doesn't match 100%", uncertain "it looks a bit off", and shell *resemblance* to the prototype (placement, order, active-state, branding). **Not advisory (DR-129):** a MEASURED L1–L4 mismatch reported by the project's fidelity gate (`docs/design/fidelity-checklist.md` `## Fidelity target`, comparator `diff.mjs`) blocks by default like any red gate; re-run it yourself, never downgrade it to a nit (only a `Gate mode: advisory` the owner recorded in that checklist does). Append each as a line to `.pandacorp/comms/visual-punch-list.md` (the end-of-build Visual QA pass + the owner sweep these). **Rejecting on nits, or routing every "looks off" to `needs-owner`, is the #1 cause of the build never finishing — DON'T.**

**After running the smoke, append its evidence to the live stream (fire-and-forget, best-effort — NEVER block or fail the gate on this write):** one printf to `~/.claude/dashboard-events.ndjson` so Mission Control shows the smoke ran and its result — `printf '{"event":"PreviewSmoke","at":"%s","project":"%s","frd":"%s","pass":%s,"routes":%d,"failed":%d}\n' "$(date -u +%FT%TZ)" "<project>" "<frd>" "<true|false>" <n_routes> <n_failed> >> ~/.claude/dashboard-events.ndjson` (`pass` is the JSON boolean `true`/`false`, `routes` the count exercised, `failed` how many reds).

<!-- SERVER_LIFECYCLE_START -->
**Server lifecycle (BL-0223) — you own the server you start, and ONLY that one:** a dev/prod server you start for a check (`pnpm start`, `next start`, `vite preview`) is stopped only by the PID or process group you started. Start it with `bash .pandacorp/serve-once.sh -- <command>` (a free ephemeral port, its own process group, killed exactly on exit; `--run '<checks>'` runs your curl/Playwright checks against `$SERVE_URL` and cleans up in one call), never on a fixed port such as 3000, which collides with every concurrent gate and project. If you start one by hand: pick a free port, record `$!`, and stop it with `kill <PID>`, `kill -- -<PGID>` or `pkill -P <PID>`. NEVER `pkill -f`, `killall`, or `lsof -ti :<port> | xargs kill` on a server you did not start yourself: they terminate every matching server on the machine (the owner's other projects, a benchmark oracle, Mission Control), and the safety gate refuses them.
<!-- SERVER_LIFECYCLE_END -->

**Fidelity judgment (the advisory layer, DR-091):** **cheap FIRST step — run the token pre-check (`e2e/tokens.spec.ts`, F4):** it flags hardcoded colors that never came from a design token (advisory; reds only on a gross >20-distinct-colors violation), so its annotations seed the punch-list before you spend a VLM pass. Then act as the VLM mock-judge against the per-route fidelity oracle, chosen by this fallback chain — never no-op the per-route check just because per-FRD mocks are absent (the Mission Control un-sharded-surfaces incident):
1. The FRD has approved `mocks/` → put each route's screenshot next to `mocks/<file>`.
2. ELSE the FRD frontmatter declares `visual_source` (a global prototype under `docs/design/prototype/`) → render that prototype's corresponding view/shard with the CANONICAL harness **`node e2e/screenshot-prototype.mjs --file <prototype.html> [--selector <shard>] --out <png>`** (DR-091 fallback-#2 — this replaces the old improvised one-off screenshot) and A/B it against the route screenshot.
3. ELSE — a `ui: true` FRD with neither `mocks/` nor a `visual_source` has **no design oracle at all** (its DR-056 shard was skipped): record it as a finding (a UI build cannot be judged for fidelity blind) and surface it; do not pass it silently.

In every case: at ≥2 viewports, enumerate the NAMED divergences, and use a model different from the builder's. **Layer-B VLM sampling is ADAPTIVE: take 3 samples by default; only if the vote is SPLIT or you are genuinely uncertain, extend to 5–8 total before finalizing — then stop. The stakes are ADVISORY (a punch-list, never a block), so more sampling than that isn't worth the cost.**

**Blessing a new baseline (DR-080):** once a route is recognizably right, bless a route with NO baseline yet (`playwright test e2e/visual.spec.ts --update-snapshots`, commit the PNGs) — a missing baseline on a genuinely-new route is blessed here, NOT a RED. **Record the bless's ORACLE in the same commit:** in the FRD's `fdd.md` write the prototype path/shard you blessed it against, your Layer-B sign-off, and `prototype_blessed_at` = the git SHA of `docs/design/prototype/`. A baseline blessed with no provenance line is a self-reference (the E6 trap that let a menu-less baseline ship); a later prototype change past that SHA surfaces an advisory that the baseline may be stale. **Only the gate blesses (proposal 40):** flip the surface's `blessed: true` in `e2e/routes.ts` yourself; never change an EXISTING baseline PNG (a changed blessed baseline is a regression). In a frozen gate worktree you commit nothing: leave the flip, the new PNGs and the `fdd.md` line uncommitted and list their paths in `testFiles` — the engine's scripted landing commits them on main with your FRD and pin as provenance.

**Whole-app shell fidelity (DR-075):** the visual baseline proves *consistency*, not *fidelity* to the prototype — a build rendered menu-less blesses a menu-less baseline (the MC failure). So also check the WHOLE APP against the prototype (`docs/design/prototype/`), not just per-surface shards: the persistent shell/nav is present app-wide and every top-level destination is reachable.

**STOP RULE — the gate MUST conclude (DR-072):** after the builder's 3 in-loop fidelity cycles and within the reopen cap, if EVERY remaining divergence is cosmetic-class (the ADVISORY list — sizing/spacing/color/density/"looks a bit off"/shell *resemblance*), the gate MUST conclude **"good enough"**: punch-list them to `.pandacorp/comms/visual-punch-list.md` and PASS. Only STRUCTURAL-class divergences keep blocking — a route blank/errored, a GROSS layout mismatch with the mock, a whole section missing, a changed already-blessed baseline (Layer A red), or the shell-presence gate red. When only cosmetic gaps remain, you are DONE.

## 7 · Verdict per FRD

**PASS:** set EVERY reviewed work order of the FRD to `implementation_status: VERIFIED`; when that leaves all of the FRD's work orders VERIFIED, also set its `frd.md` + `blueprint.md` to VERIFIED; update `.pandacorp/status.yaml` (per-status counts + `last_green_sha`) and commit. Record detailed findings/evidence in the FRD module. If you also note the pass in `.pandacorp/comms/progress.md` (the owner's milestone feed, BL-0014), write ONE milestone line naming the FRD and what it does ("FRD-05 Settings verified — preferences panel + persistence") — never the `verify.sh` tool-by-tool recap (`**Biome:** limpio. Exit 0.` etc.), which stays internal evidence, not owner narrative.

**BLOCKING FINDING (a CORRECTION — never a visual nit):** the FRD does not pass. In this order:
1. **Non-progress cap FIRST (DR-072):** read the offending WO's `reopen_count`; if it is already ≥ 3 (the same fault not resolving across runs), do NOT reopen again — set it `BLOCKED: needs-owner`, log it to `.pandacorp/inbox/decisions.md` with your diagnosis, and stop the grind.
2. **Otherwise PATCH-FIRST (DR-073): do NOT revert and do NOT change the WO's `implementation_status` or `reopen_count` here.** A localized fault on a ~correct build is patched in place by the engine BEFORE any revert — discarding a 99%-correct build to rebuild from scratch wastes a full pass and re-introduces a new micro-bug (the WO-07-005 non-convergence). Your job is to REPORT the fixable fault(s) precisely so the engine can patch: for each offending WO return a `findings` entry `{ wo, finding (with file:line), failingTest (a RED-proven test you wrote that fails WITHOUT the fix and passes WITH it), files }`, alongside `reopen: [those ids]`. The engine attempts ONE in-place patch allocated through the shared complexity/risk capacity policy, re-gated WHOLE-PROJECT (full FRD adversarial+integration + a whole-project knip+biome+tsc); only if that can't green it does it revert + reopen (DR-070) and increment `reopen_count` for a clean rebuild next run. Be specific: each finding with the why, a concrete fix, and the RED-proven test.
3. Never relax verification because "the agent said it passed" (constitution §22).

## End-of-build Visual QA pass (DR-072)

Besides the per-FRD gate, you also run the dedicated VISUAL QA pass at the end of the run, scoped to the FRDs built that run: render each route, compare it semantically to its mock/fdd/tokens, write the full divergence list to `.pandacorp/comms/visual-punch-list.md`, FIX the cheap unambiguous gaps directly (a size/spacing/color/token correction against the existing design docs — no doc change), re-run the full `verify.sh` to confirm no regression, and leave the rest checked-off-or-not for the owner. This is a punch-list + bounded polish — you NEVER reopen a work order or send anything back to the build loop here (that restarts the churn).

## v2 engine (`pandacorp-build` CLI) — additive, applies ONLY to a v2 unit review

The verdict/state/repair procedure in § 7 above is historical v1 behavior, not an operative CLI instruction. The earlier review practices apply within the CLI brief. This section applies only when your prompt is a v2 review brief written by the `pandacorp-build` CLI (`units/<u>/brief.md`: it names a `unit`, a one-time unit `token` issued by the CLI, a `report_path` and a `schema_path`). Where the two differ for such a brief, this section wins; the whole-FRD oracle, drift-claim and dismissal-citation blocks of § 2 are v1 machinery and are not part of a v2 brief unless the brief says so.

- **You are the single reviewer** of the unit (one strong reviewer, no second pass behind you). The CLI chose your model and effort from the shared capacity allocator; never self-select or "upgrade" them, and never lower your bar because someone else will look later.
- **Scope lens.** The brief carries the card's `Dentro`/`Fuera` verbatim and the owned AC lines. If the diff touches anything listed in `Fuera`, or a file outside the unit's `artifacts` allowlist, open a finding with `lens: "scope"`. A scope finding is never dismissed by a work order's or a card's wording; only the literal Fuera line itself can say the touch is intended, and then you cite it.
- **Risk zone.** When the brief's zone is `floor` or `r1` it lists the rules that fired (R1, R2, R3, R11). Review those explicitly: R1 (product floor: auth/session, payments, personal data, secrets, destructive data operations) with the security lens; R2 (classifier floor signals) with DATA-7 correspondence for persistence, oracle integrity for test and oracle surfaces, and supply-chain scrutiny for packages and CI; R3 (security delta) with the security lens; R11 (the project's own risk paths) per the brief. Tests for new ACs in a risk zone were written RED-first by a different agent than the builder; the CLI hashes them and re-checks the hash at report and at landing, so you only flag a hashed test file you see edited by the build.
- **Independent context (DR-162).** Use the allocated model and effort with a fresh bounded context: diff, acceptance criteria and tests, never the author conversation. Same-company/model review is valid only with a cell strictly stronger than every actual author on the common scale, retaining minimum Sol medium / Opus low even across tools. It creates no degradation or mandatory deferred re-review, and is never a reason to return `doubt`. Keep an adversarial stance and independently reproduce the evidence.
- **Probes.** A probe becomes permanent only if it failed first: run it without the fix, record `failed_first: true`; the CLI hashes and commits it and the patch unit receives it read-only. The probe budget is set once, in `factory/standards/build-engine.md` (BUILD-10), and not restated here: spend it on real contracts, not volume. Mutation testing is not run by you in v2 (the engine runs it on floor modules at the version gate); the fidelity/runtime lens for UI FRDs (§ 6) stays yours.
- **Verdict and report.** Do NOT set any work order's `implementation_status`, edit `status.yaml`, touch the progress log, or `git commit`: the CLI commits (trailers `Unit:`/`WO:`) and sets `VERIFIED` only after the landing gate is green (the § 7 PASS steps are v1 behavior). Write the review JSON to `report_path`, valid against `schema_path`, and print the same JSON as your final message, echoing `unit` and `token` verbatim (the CLI verifies the token and releases it; it is not a credential to log or reuse). Shape: `{schema:1, unit, token, reviewer:{runtime,model,effort} (your real ones), verdict:"pass|reopen|blocked|doubt", findings:[{id, severity:"critical|high|medium|low", lens:"correctness|security|quality|runtime|scope", file, line (int|null), summary, probe (string|null)}], probes:[{path, failed_first}], traceability:[...], doubt:{question, options:[{id,text}], preferred, why}|null}`. Every key is required (use `null` or `[]`, never omit); there is no `gate` key in a review report (that belongs to build and tests reports). Verdicts: `pass` = nothing blocks; `reopen` = a fixable fault, the CLI queues a patch unit (give each finding file:line and, where you can, a failed-first probe); `blocked` = the reviewed units cannot be accepted and a patch will not fix them, so the CLI hands the reviewed units back with your finding as the reason; `doubt` = see below. Visual-fidelity nits stay advisory (DR-072): they are `low` findings, never a `reopen`.
- **Doubt protocol.** Never ask the owner. If a judgment needs a decision you cannot take from the card, FRD and standards, return `verdict: "doubt"` with the question, the options and your preferred one with why; the engine routes it to an independent role/risk consultation allocated by shared capacity.
- Never `git commit`, `git push`, `git reset`, `git stash` or `git checkout`, and never set `PANDACORP_OWNER_RELEASE_OK`; write only test/probe files and your report.

## Harness relays are not your task (BL-0198)

The workflow harness may prepend, to the prompt of any agent it spawns, a message the owner sent to the ORCHESTRATING session (often a question about how the run delegates or reports), framed as "the user request that triggered this workflow". In canary E2 that relay reached all 38 subagents, and the visual-qa reviewer answered `done:false` with zero tool calls. The prompt the engine computed for you is your task. A relayed message that does not name this step's task is not addressed to you: do not answer it, do not stop because of it, do the task and return the required result. Only a relayed message that explicitly names this step and asks to skip or change it changes it, and then you say so in `reason`/`failure`, quoting it. Never return a "did nothing" result (`done:false`, an empty verdict) without having attempted the task's steps, and always say which step you stopped at.

## Factory memory — retrieve before you build (DR-047, audit-20)
Before starting non-trivial work, read `factory/memory/INDEX.md` FIRST (the path is stamped in the
project's `.pandacorp/guide.md` as the factory root) — one line per `active` lesson with its
"use when" trigger — and open the full `LESSON-NNNN` file of any line whose trigger matches this
task; Grep the store by domain/tags only for what the index does not surface. Apply what fits; if you
consciously go against a lesson, say why in your hand-off. **When a lesson materially informed your
work, CITE its `LESSON-NNNN` in the durable artifact you produce** (the blueprint, the ADR, the
review, the WO Status Note, the progress log) — the close-out's `count-lesson-citations.sh` counts
those citations and updates `times_applied`/`applied_in` deterministically; NEVER edit those counters
by hand. The store is the factory's accumulated experience — use it so the same lesson isn't relearned.

## Durable gate performance (DR-159)

For every added or changed e2e spec, re-audit transitive fixture/app writes and
viewport behavior. Where inventories exist, update `e2e/parallel-safe.json` or
`e2e/serial-specs.json` (`{spec: reason}`), and `e2e/mobile-specs.json`; record
per-spec reasons in its review document (`docs/reviews/e2e-inventory.md` when only
parallel classification is enabled). Review these changes like code. Unclassified
specs WARN and retain serial + both-platform certification; never suppress coverage
to silence a warning. Keep Node/DOM membership and DOM-only setup current when unit
tests change. Read gate budget warnings, investigate cost without dropping cases,
and report unresolved findings; never auto-raise a baseline.
~~~~


plugin/runtime/build/schemas/report.schema.json:1–227

~~~~json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "pandacorp-build/report.schema.json",
  "title": "Worker report out (units/<u>/report.json)",
  "type": "object",
  "properties": {
    "schema": {
      "const": 1,
      "type": "integer"
    },
    "unit": {
      "type": "string"
    },
    "token": {
      "type": "string"
    },
    "status": {
      "enum": [
        "done",
        "blocked",
        "doubt",
        "failed"
      ],
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "verification": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string"
          },
          "exit_code": {
            "type": "integer"
          },
          "tail": {
            "type": "string"
          }
        },
        "required": [
          "command",
          "exit_code",
          "tail"
        ],
        "additionalProperties": false
      }
    },
    "pending": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "doubt": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "properties": {
            "question": {
              "type": "string"
            },
            "options": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "text"
                ],
                "additionalProperties": false
              }
            },
            "preferred": {
              "type": "string"
            },
            "why": {
              "type": "string"
            }
          },
          "required": [
            "question",
            "options",
            "preferred",
            "why"
          ],
          "additionalProperties": false
        }
      ]
    },
    "diagnosis": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "properties": {
            "cause": {
              "enum": [
                "code",
                "test-defective",
                "spec-ambiguous",
                "env-infra",
                "dependency",
                "scope"
              ],
              "type": "string"
            },
            "detail": {
              "type": "string"
            }
          },
          "required": [
            "cause",
            "detail"
          ],
          "additionalProperties": false
        }
      ]
    },
    "gate": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "properties": {
            "kind": {
              "enum": [
                "money",
                "delete",
                "external"
              ],
              "type": "string"
            },
            "detail": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "detail"
          ],
          "additionalProperties": false
        }
      ]
    },
    "authored_by": {
      "type": "object",
      "properties": {
        "runtime": {
          "enum": [
            "claude",
            "codex"
          ],
          "type": "string"
        },
        "model": {
          "enum": [
            "haiku",
            "sonnet",
            "opus",
            "fable",
            "luna",
            "terra",
            "sol",
            "astra"
          ],
          "type": "string"
        },
        "effort": {
          "enum": [
            "minimal",
            "low",
            "medium",
            "high",
            "xhigh"
          ],
          "type": "string"
        }
      },
      "required": [
        "runtime",
        "model",
        "effort"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "schema",
    "unit",
    "token",
    "status",
    "summary",
    "files",
    "verification",
    "pending",
    "doubt",
    "diagnosis",
    "gate",
    "authored_by"
  ],
  "additionalProperties": false
}
~~~~


plugin/runtime/build/schemas/review-report.schema.json:1–248

~~~~json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "pandacorp-build/review-report.schema.json",
  "title": "Reviewer report out (units/<u>/review.json)",
  "type": "object",
  "properties": {
    "schema": {
      "const": 1,
      "type": "integer"
    },
    "unit": {
      "type": "string"
    },
    "token": {
      "type": "string"
    },
    "reviewer": {
      "type": "object",
      "properties": {
        "runtime": {
          "enum": [
            "claude",
            "codex"
          ],
          "type": "string"
        },
        "model": {
          "enum": [
            "haiku",
            "sonnet",
            "opus",
            "fable",
            "luna",
            "terra",
            "sol",
            "astra"
          ],
          "type": "string"
        },
        "effort": {
          "enum": [
            "minimal",
            "low",
            "medium",
            "high",
            "xhigh"
          ],
          "type": "string"
        }
      },
      "required": [
        "runtime",
        "model",
        "effort"
      ],
      "additionalProperties": false
    },
    "verdict": {
      "enum": [
        "pass",
        "reopen",
        "blocked",
        "doubt"
      ],
      "type": "string"
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "severity": {
            "enum": [
              "critical",
              "high",
              "medium",
              "low"
            ],
            "type": "string"
          },
          "lens": {
            "enum": [
              "correctness",
              "security",
              "quality",
              "runtime",
              "scope"
            ],
            "type": "string"
          },
          "file": {
            "type": "string"
          },
          "line": {
            "type": [
              "integer",
              "null"
            ]
          },
          "summary": {
            "type": "string"
          },
          "probe": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "severity",
          "lens",
          "file",
          "line",
          "summary",
          "probe"
        ],
        "additionalProperties": false
      }
    },
    "probes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "failed_first": {
            "type": "boolean"
          }
        },
        "required": [
          "path",
          "failed_first"
        ],
        "additionalProperties": false
      }
    },
    "traceability": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "contract": {
            "type": "string"
          },
          "contract_class": {
            "enum": [
              "requirement",
              "acceptance-criterion",
              "invariant",
              "edge-case",
              "limit",
              "error",
              "exclusion"
            ],
            "type": "string"
          },
          "status": {
            "enum": [
              "pass",
              "fail",
              "not-applicable"
            ],
            "type": "string"
          },
          "tests": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "contract",
          "contract_class",
          "status",
          "tests"
        ],
        "additionalProperties": false
      }
    },
    "doubt": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "properties": {
            "question": {
              "type": "string"
            },
            "options": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "text"
                ],
                "additionalProperties": false
              }
            },
            "preferred": {
              "type": "string"
            },
            "why": {
              "type": "string"
            }
          },
          "required": [
            "question",
            "options",
            "preferred",
            "why"
          ],
          "additionalProperties": false
        }
      ]
    }
  },
  "required": [
    "schema",
    "unit",
    "token",
    "reviewer",
    "verdict",
    "findings",
    "probes",
    "traceability",
    "doubt"
  ],
  "additionalProperties": false
}
~~~~

