# Dispatch: who runs each stage, on which tier, in which parallel group, on what budget (architecture v3)

The one source for HOW the phase is executed: tiers, parallel groups, inputs, owned outputs, budgets and the lead's
own steps. `planning-pipeline.md` says WHAT each stage produces; `gates.md` what each gate asserts. Built from the
funko-tracker run (8 FRDs, 42 WOs, 102 ACs): ~45 subagent runs, ~12 M subagent tokens and ~1 day, mostly from every
author and judge re-reading the whole doc set (~450 to 520 k tokens each), over-tiering, serial steps and late
scope changes regenerated instead of patched.

## 1. Tiers: portable, resolved at dispatch, never written as a model

Every dispatch below is `TIER·effort`: TIER is a PORT-2 tier (MECH / STANDARD / JUDGE,
`factory/standards/agent-portability.md`, CONV-12), effort a value of `effort_rank` in
`${CLAUDE_PLUGIN_ROOT}/runtime/model-tiers.json`. Neither this skill nor a brief names a model: the JSON is the only
place that maps a tier to one, so a new model ships by editing the JSON alone. At the start the lead prints the
current mapping once:

```bash
node -e 'const t=require(process.env.CLAUDE_PLUGIN_ROOT+"/runtime/model-tiers.json").tiers;for(const k in t)console.log(k,"claude:",t[k].aliases[0],"codex:",t[k].codex.model,t[k].codex.effort)'
```

| Runtime | How `TIER·effort` is dispatched |
|---|---|
| Claude Code | `Agent` with `model` = `tiers.<TIER>.aliases[0]` (a family alias that follows the newest model of the tier) and `effort` = the row's effort. Both override a named agent's frontmatter (`architect`, `reviewer`...): its pinned model is a default, not a mandate for this skill. If a runtime build ignores the `effort` parameter, the named agent's frontmatter effort applies. Pass `run_in_background: true` for every agent of a group; never poll, the completion notice arrives |
| Codex | the tier worker (`tier-mech` / `tier-standard` / `tier-judge`, model and effort baked from the same JSON by `plugin/scripts/generate-codex-agents.mjs`), with the named agent's role brief (`plugin/agents/<name>.md` body) pasted at the top of the task. Effort is the worker's baked one (no per-spawn override), so pick the worker by the row's tier AND effort: MECH·* → `tier-mech`; STANDARD·low/medium → `tier-standard`; **STANDARD·high → `tier-judge`** (the JSON gives both the same model, and `tier-standard`'s baked medium would be a silent downgrade); JUDGE·* → `tier-judge`. These workers live in the factory's `.codex/agents/` only: inside a product project there are none, so Codex uses the inline sequential fallback (next row) |
| Any other runtime | PORT-3 fallback: the lead does the row itself, inline, sequentially, in the table's order |

- Efforts used here are only `low`, `medium` and `high` (`minimal` and `xhigh` of `effort_rank` are not used).
- The runtime's most expensive tier, above JUDGE, is never auto-selected (PORT-2): only on the owner's explicit request.
- Escalate upward only, once, when a lower tier proved inadequate (a red script it caused twice, a report that
  misses the brief), and log why. Never down-tier a row that says JUDGE.
- A row whose work is one command (a script, a copy, a `git rm`, a concatenation) is the lead's shell, not an agent:
  spawning an agent to run a script is waste.

## 2. Context packs: read once, write many

`scripts/build-packs.mjs` writes `.pandacorp/run/architecture/packs/` (gitignored): one `frd-NN.md` per FRD (its REQ
lines and live AC bullets verbatim with ids, its route-map rows, the data-model entities it names with their
attributes, its oracle states, the microcopy keys its FDD cites, its slice of the work-order map) and `_global.md`
(the `architecture.md` outline with line numbers, the ADR index, platform routes, Pinned versions, the map's §0
shared-file owners, §1 foundation, §3 DAG and §8 binding resolutions). It is read-only on `docs/`, deterministic and
takes seconds, so the lead re-runs it after each upstream write: **P0** before the decision round (ACs, oracle,
copy), **P1** after G1 (adds routes, entities, ADRs), **P2** after the map (adds the slices). funko-tracker: the
largest FRD pack plus `_global.md` is ~8 k tokens against ~355 k for the full doc set.

Every agent after P0 gets: its brief, its pack(s) + `_global.md`, the files it owns, and the paths it must open
directly (the `architecture.md` sections it needs **by line range** from the outline, the templates, the installed
scaffold). Never "read the docs". **A pack is not a replacement for an FRD**: it carries the AC bullets and the
cross-cutting facts, while scope, business rules, edge cases, contracts and a "no UI" note live in the rest of
`frd.md`. So whoever plans, writes or judges an FRD reads that `frd.md` in full (a few k tokens each): the map
planner and the consistency gate read every `frd.md`, an author its own `frd.md`, `fdd.md` and `mocks/`. A pack line
that looks wrong is checked against its source file, which stays authoritative
(`FRD > FDD > design-tokens > blueprint > work order`).

## 3. The dispatch table

Budgets are for a typical 6 to 8 FRD project; scale authors linearly with FRD count. "Lead" = the lead's own shell,
no agent. Groups run in order; every row of a group is launched **in ONE dispatch message**, outputs disjoint.

| Group | Stage (SKILL step) | TIER·effort | Agent | Inputs (packs, not the doc set) | Owned outputs | Budget (wall · tokens) | Lead runs itself |
|---|---|---|---|---|---|---|---|
| G0 | Readiness preflight (0b) | lead | — | the design scripts | — | 5 min · 0 | `check-design-gate.mjs`, `check-fdd-coverage.mjs`, `build-packs.mjs` (P0) |
| G0 | Decision brief (1) | JUDGE·high | `architect` | `decision-round.md`, `prd.md`, P0 packs, `technical-assumptions.md`, `idea-origin.md`, sibling ADR paths | `.pandacorp/comms/arquitectura-decisiones.md` (main checkout) | 25 min · 0.3 M | `curl -sI`, registry and pricing checks; `AskUserQuestion` round; one ADR stub + decision-log line per answer (scripted) |
| G0 | Web facts for the brief (1) | STANDARD·medium | `researcher` | the decision list from the architect's first draft | its report | ∥ the brief · 0.1 M | — |
| G1 | Platform architecture + data model + decision ADRs (2, 2b, 5) | JUDGE·high | `architect` | locked ADRs, P0 packs, `_global.md`, `architecture-template.md`, `stack.md` | `docs/product/architecture.md`, `docs/product/data-model.json`, its pre-assigned ADR numbers | 45 min · 0.5 M | JSON parse, `doc-lint.sh`, `resolve-versions.mjs` → paste its table into "Pinned versions"; decision-log lines by script from the entries agents report |
| G1 | Stack install (6) | STANDARD·medium | `implementer` (has Bash) | `stack-install.md`, the stack decision, `templates/stack-<chosen>/` | scaffold, canonical gate files, `e2e/` seeds, `.claude/launch.json`, `.env.example` (the stack's own vars), README Getting started | 45 min · 0.25 M | `cmp` per VERBATIM file; 6b rules copy + `docs/rules/README.md`; after G1, `.env.example` reconciled against architecture.md's env table |
| G1 | Event plan (3) | STANDARD·medium | `analytics` | `prd.md` metrics, P0 packs, `events-template.md` | `docs/analytics/events.md` | 20 min · 0.1 M | — |
| G1 | Deploy design (4, only if it deploys) | STANDARD·high | `devops` | locked hosting ADR, `infra.md`, `external-services.md` | its pre-assigned ADR number (`deploy-and-environments`; architecture.md links it) | 25 min · 0.15 M | — |
| G1 | Feasibility spike (5, only when a critical unknown remains) | STANDARD·high | `implementer` | the one unknown, time-boxed | `.pandacorp/run/architecture/spike-<topic>.md` | announced first if > 30 min | — |
| — | FRD amendment (5, only if a decision or spike changed criteria) | STANDARD·high | `product-manager` | the affected packs + the ADR | the affected `frd.md` files | 15 min · 0.1 M | P1 `build-packs.mjs` after G1 (and after any amendment) |
| G2 | Cross-FRD work-order map (9, stage 2) | JUDGE·high | `architect` | P1 packs + `_global.md`, every `frd.md` in full, `wo-map-template.md`, scaffold tree, versions table | `.pandacorp/run/architecture/wo-map.md` | 30 min · 0.35 M | AC count per FRD vs packs; P2 `build-packs.mjs`; milestone 2 "plan ready" |
| G3 | Blueprint + WO author, one per FRD (stage 3; pair FRDs with ≤ 4 ACs) | STANDARD·high when the FRD has ≤ ~10 ACs and no novel integration; JUDGE·high for the platform/foundation FRD, > 10 ACs, a novel integration or a `high` WO | `architect` | `blueprint-author-brief.md`, P2 pack + `_global.md`, its `frd.md` in full, its `fdd.md` + `mocks/`, architecture sections by line, templates | its `docs/frds/<frd>/{blueprint.md,blueprints/,work-orders/}`; its ledger file `.pandacorp/run/architecture/cross-issues/frd-NN.md` | 60 min · ≤ 0.25 M STANDARD, ≤ 0.35 M JUDGE each | — |
| G3 | Copy for new strings (only when the map's §6 lists missing keys) | STANDARD·medium | `copywriter` | the listed keys, `voice-and-tone.md` | `docs/design/microcopy*.json` entries only (a design-owned string the oracle must draw goes back to design, DR-130) | ∥ authors · 0.05 M | — |
| G4 | Reconciler (stage 5) | STANDARD·high | `architect` | the concatenated ledger, the script outputs, P2 packs | the files the ledger items name; a platform-decision item goes back to the G1 architect via `SendMessage` (JUDGE, it still holds the context) | 30 min · 0.3 M | before: `cat cross-issues/*.md > cross-issues.md`, `git rm` tombstones, `waves`/`ac-matrix`/`plan-consistency`/`check-fdd-coverage --plan`; after: the same + commit |
| G5 | Readiness gate (9) | lead + STANDARD·medium | `reviewer` (fresh) | the §0 script outputs (they ARE the mechanical half), the packs, the Build Plans, `docs/product/data-model.json` + the architecture.md Data model section (by line) for the DATA-7 comparison | `docs/reviews/architecture-readiness-gate.md` | 20 min · 0.15 M | `gates.md` §0, attached to the prompt |
| G5 | Grounding gate (9b) | JUDGE·medium | `reviewer` (fresh, has Bash) | `_global.md`, the installed scaffold, version-matched docs, the plan files | `docs/reviews/architecture-grounding-gate.md` | 30 min · 0.25 M | — |
| G5 | Consistency gate (9b-consistency) | JUDGE·medium | `reviewer` (fresh) | `_global.md`, the packs, `prd.md`, every `frd.md`, `architecture.md`, blueprints, WOs | `docs/reviews/architecture-consistency-gate.md` | 30 min · 0.25 M | — |
| G5 | Spanish digest (9c) | STANDARD·low | `architect` | `_global.md`, architecture outline sections, each WO README table | `.pandacorp/comms/arquitectura-resumen.md` (main checkout) | ∥ gates · 0.05 M | — |
| G6 | One fix pass (9) | STANDARD·high; JUDGE·high only if that fix failed once | the file's author, resumed by `SendMessage` | the blocker lines + its own files | the blocker's files | 20 min · 0.3 M | every §0 check + one `grep` per blocker; resolution addendum; milestone 3 |
| G6 | Mechanical WO wording/renames | MECH·low, or the lead's `sed`/node script | `mech` | the exact edit list | the listed lines | 5 min · ~0 | preferred: lead script |
| G7 | Flip + land (9b2, 10) | lead | — | gate reports | stamps, ACTIVE flip, merge | 15 min · 0 | `flip-active.mjs --dry-run` then real; commit; `merge-queue.sh`; push; milestone 4 |

**G1 shared files (no two writers):** before G1 the lead pre-assigns ADR numbers (the architect's range for the
locked decisions and platform ADRs, the next number to `devops`); agents never append to `docs/decision-log.md`,
they report the entry text and the lead writes the lines by script; the installer writes only the stack's own vars
into `.env.example` and the lead reconciles it with `architecture.md`'s env table once G1 is done.

The table sums to about **≤ 5 h wall clock** (owner answer time aside, lead checks between groups included) and
**≤ 6 M subagent tokens for 6 to 8 FRDs averaging ~12 ACs** (most authors then JUDGE·high); smaller FRDs land lower.
State both to the owner at the start with the plan, scaled to this project's FRD and AC count.

## 4. Speed rules

- **Stop rule.** The lead logs each dispatch as one line in `.pandacorp/run/architecture/dispatch-log.md` (group,
  stage, agent id, `TIER·effort`, start, end, reported tokens) and checks it on EVERY completion notice (that agent
  against its row) and after each group (the running total against the whole envelope). A stage past **2× its wall
  or token budget**, or a running total past 2× the envelope's share so far, stops:
  tell the owner in Spanish what overran, why, and the cheaper option (accept as is with advisories, cut the scope of
  the stage, re-dispatch narrower), and let them pick. Never grind.
- **Small lead context.** The lead reads agent reports, script outputs and the packs, never the docs themselves.
  Every check is a script; every edit the lead makes is small and scripted (`sed`, a node one-liner, pasting a
  script's table). When the lead wants to "just look at" an FRD, it opens the pack.
- **Never serialize independent work**, never wait on an agent to start a group that does not need its output (the
  installer does not wait for the architect; the digest does not wait for the gates).
- **Delta, never regenerate.** A change after docs exist (an owner decision reversed, an FRD amended, a design state
  added) touches only what it reaches: `grep -rl` for the changed term/entity/route plus `plan-consistency.mjs` find
  the affected FRDs and WOs; only their authors are resumed (or one STANDARD·high delta author) with the delta; the
  gates run as delta reviews over `git diff <last-gated-commit>` (`gates.md` §5). Never re-run full authors or full
  gates for a scoped change.
- **Rate limits.** An agent cut by a usage limit is resumed with `SendMessage` to the same agent id from the dispatch
  log ("continúa donde quedaste"), never restarted. Each brief is self-contained (paths, pack, owned files, the exact
  output contract), so a re-dispatched agent needs no lead context: when resuming is impossible, re-dispatch the same
  brief plus "already written: <files>; continue, do not redo".

## 5. On Codex and other runtimes

- `AskUserQuestion` → ask in chat with the same decision list: the summary table, each decision with its options,
  the recommended option first, and accept a compact answer ("D1 A, D2 B, el resto como recomiendes").
- Parallel `Agent` dispatches → Codex tier workers per §1, one per row of a group when they exist and the runtime
  allows parallel spawns (≤ `max_threads`, depth 1); inside a product project (no `.codex/agents/` there) and on any
  other runtime, sequential, inline, in the table's order. `SendMessage` resume → the re-dispatch rule above.
  `EnterWorktree` → `git worktree add` by hand.
- Every script (`build-packs`, `waves`, `ac-matrix`, `plan-consistency`, `flip-active`, `resolve-versions`, the
  design checks) runs the same with `node`; `${CLAUDE_PLUGIN_ROOT}` is the plugin's path on that runtime.
- **What a non-Claude runtime may do in this phase (DR-120, PORT-5, AGENTS.md §Runtime portability):** it is
  read/review-only on the project's build state. It may run the preflight and the scripts, draft the decision
  brief in `.pandacorp/comms/` and ask the owner, and review an existing plan (a gate-style report to the owner).
  It does NOT write the blueprints, the work orders, `.pandacorp/status.yaml` or the flip: it stops there and tells
  the owner those steps are left for a Claude Code session.
