# Freeze and fidelity hand-off (Steps 7 to 9) — the parallel freeze plan

The goal: the build gets everything it needs to reproduce the approved design, plus the numbers to measure the difference, in **60 to 100 minutes, hard limit 2 hours** (DR-129, `factory/standards/design.md` §5d–§5f; it extends DR-128). The freeze is a work-order-like DAG of short stages with disjoint outputs, run by tier-sized subagents, checkpointed so a usage-limit cut resumes at the last done stage. funko-tracker's freeze without this plan took almost a day: 7 audit passes, tools improvised per pass, 3 cuts.

## Entry conditions (else fix them as a normal round, before the clock starts)

- The owner approved the prototype at the visual gate (Step 6).
- The last round's preflight (`docs/design/freeze/preflight.json`) is clean: the prototype contract of `references/iteration-loop.md` holds.
- Web fonts and logo were chosen (Steps 2, 2b); the prototype is already at `docs/design/prototype/<name>.html`.
- `docs/design/freeze/fidelity.config.json` exists and is current: started from `${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/fidelity/fidelity.config.example.json` when the prototype first landed in `docs/design/prototype/`, then accumulated by the `designer` every round (`references/iteration-loop.md` items 9 and 10): `prototype`, `widths`, `themes`, `components` (+ `floating`), the `css` families/rules/overrides, every state under `states.<frd folder>`, `exports`/`exportPaths`, demo markup marked `data-demo-only` (the default `shard.strip` removes it). S1.1 needs it; S0.3 only checks and completes it. One file, one schema (`scripts/fidelity/config.schema.json`) for the toolkit, the preflight (`preflight`) and the gate.
- **No accumulated config** (an older project, or the rounds skipped item 10): the config is authored before the clock starts, as its own task (STANDARD·medium, `designer`), from the example and the fidelity README ("Who writes the config, and when"): `components` from the components inventory and the prototype's markup, `css.families` from the prototype's CSS section comments in order, `states` from the FRDs' ACs. Budget it in hours, not minutes (an estimate: 1 to 2 h for a prototype of funko-tracker's size, 119 components and 49 CSS sections), and record it in the tracker outside the 2 h box. There is no `bootstrap` generator yet (factory backlog BL-0238).
- `.pandacorp/status.yaml` `phase` is `design` (if it still says `product`, confirm with the owner and fix it).

## Contracts the freeze leaves (unchanged by this plan)

- **DR-056** prototype home `docs/design/prototype/` on every path; complete extraction (base components + app-wide skin + every embedded sub-view and its assets); a shard per UI FRD with only that FRD's screens, every layer and every state its ACs name; FRD frontmatter `ui: true` + `visual_source`.
- **DR-128** tokens regenerated from the final CSS (history in `design-tokens-history.json`), web fonts recorded in `design-tokens.json` `fonts`, logo and icon SVG exports, measured computed styles, the component catalogue, `fidelity-checklist.md`, and build requirements in `technical-assumptions.md` (self-host the fonts, exported SVGs only, the automated computed-style check, copy loaded verbatim).
- **DR-057** `docs/design/components.md` (template `components-inventory-template.md`; name · purpose · path · key props/variants). Legacy canvas: one row per `_ds_manifest.json` entry.
- **DR-075** the `AppShell`/`Nav` foundation row plus its nav contract **read from the prototype**, never from `routes.ts`: shell landmark (e.g. `[data-app-shell]`), top-level `{label, path}` pairs, routes rendered without the shell, mobile drawer if any. `architecture` turns it into `e2e/shell.ts`. No persistent chrome → state "no persistent shell".
- **DR-062** framing patterns (page-title block with H1 = nav label, section header, tabs, chip, panel, empty state) as components.md entries. **DR-061** demo-only controls stay marked, never promoted to requirements.
- **DR-064** the bidirectional functional reconciliation, recorded in `design-decisions.md` § `Functional reconciliation (DR-064)`.
- **DR-080** the live prototype is the independent oracle; the build's own screenshots never are; the implementer never edits the prototype, references, fixtures or tolerances.
- **DR-054** `check-design-gate.mjs` decides READY; a self-assessed "done" does not. Final strings keep their i18n keys (`copywriter`). `DESIGN.md` gets FROZEN + date; `design-decisions.md` a freeze entry.

## Fidelity target (DR-129 §5d)

`fidelity-checklist.md` carries a `## Fidelity target` section from the template (the gate checks it): **L1** computed typography and colours 100% exact · **L2** box sizes exact, spacing/radius ±1 px, floating-panel anchor offsets ±1 px · **L3** ≤ 0.5% differing pixels per viewport-height slice at YIQ threshold 0.1, anti-aliasing ignored · **L4** 100% of the listed states × widths × themes, axe 0 serious. "Listed" is the toolkit's scope cap: every state at 1280 light, layout states at 375 touch, dark for colours, component images at 375 + 1280 light; wider coverage goes to the backlog unless an FRD needs it. The build's fidelity gate **blocks by default** on a measured L1–L4 mismatch; an infrastructure failure (missing prototype, font, image, browser, reference, touch emulation) is always RED. Owner sentence: *"a simple vista no se distingue del prototipo, con fuentes y colores exactos"*.

## Tools — they ship with the plugin; never improvise one

| Tool | Does |
|---|---|
| `node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/preflight-round.mjs" <prototype.html> --save` | the prototype contract check; `--save` writes `docs/design/freeze/preflight.json` (exit 0 clean, 1 findings, 2 could not run) |
| `node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/fidelity/freeze.mjs" <split\|measure\|shard\|screens\|catalog\|identity\|all> [--only frd-NN] [--all-states]` | the capture toolkit: config `docs/design/freeze/fidelity.config.json`, resumable state `docs/design/freeze/state.json` (a re-run skips what is done), comparator `diff.mjs` |
| `node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/check-design-gate.mjs"` | the quality gate: artifacts, preflight, tracker stages, time record, `## Fidelity target` |

A tool defect is fixed in the factory, not in the project: note it in the tracker, capture a lesson in `.pandacorp/run/lessons.md`, mention it at the next milestone. Never write a project-local replacement.

## Tiers — portable, one source

Each task names a PORT-2 tier and effort. Resolve it at dispatch from `plugin/runtime/model-tiers.json` (the PORT-2 table in `factory/standards/agent-portability.md`); model names here are examples only. `JUDGE·high` reads as *JUDGE (Claude: opus · Codex: tier-judge / gpt-5.5 high)*; `STANDARD·medium` as *STANDARD (Claude: sonnet · Codex: tier-standard / gpt-5.5 medium)*; `MECH·low` as *MECH (Claude: haiku · Codex: tier-mech / gpt-5.6-luna low)*. On Claude the `Agent` `model` parameter overrides the named agent's frontmatter. A MECH task that is one command runs in the lead's own shell; spawning an agent to run a script is waste. Escalate upward only (CONV-12).

## Context packs — read once, write many

S0.3 is the only task that reads everything. It writes one pack per UI FRD (`docs/design/freeze/packs/frd-NN.md`: the verbatim EARS AC lines with ids; the screens and states they name, each with its prototype selector and DEMO recipe; the copy keys those screens use plus the mechanical copy mismatches; the owner decisions from `.pandacorp/comms/iteration.md` that touch the FRD) and one `packs/_global.md` (token families, AppShell, framing patterns, signature details). Every later writer gets its pack, the files it owns and the file paths it cites, and nothing else.

## The plan

Status per row in `docs/design/freeze/tracker.md` (template `${CLAUDE_PLUGIN_ROOT}/templates/docs/design-freeze-tracker-template.md`). Rows with met dependencies run **in parallel, in one dispatch message**; outputs are disjoint, so no two running tasks write the same file. Paths: `freeze/` = `docs/design/freeze/`, `prototype/` = `docs/design/prototype/`, `comms/` = `.pandacorp/comms/`; other bare doc names live in `docs/design/`.

| ID | Depends on | Task | Outputs it owns | Tier | Agent |
|---|---|---|---|---|---|
| **S0.1** | — | Preflight the approved prototype: a `fail` goes back to a round; an acceptable `warn` is acknowledged in the tracker (`preflight-ack`) | `freeze/preflight.json` | MECH·low | lead shell |
| **S0.2** | — | Open the tracker: copy the template, fill rows, `started_at`, `time_box: 2h` | `freeze/tracker.md` | MECH·low | lead |
| **S0.3** | S0.2 | Context packs; check the accumulated config and complete the last round's gaps (a state an AC names, a component the preflight or the packs show uncovered). Never authors the config from scratch: that is the entry condition above | `freeze/packs/*`, `freeze/fidelity.config.json` | STANDARD·medium | `designer` |
| **S1.1** | S0.1 | `freeze.mjs split`: CSS split and token extraction (custom properties per theme into `design-tokens.json`, curated keys such as `fonts` kept; a dated entry in the history when the set changed) | `prototype/reference/css/`, `design-tokens.json`, `design-tokens-history.json` | MECH·low | lead shell |
| **S1.2** | S1.1, S0.3 | `freeze.mjs all` **in the background** (measure, shard, screens, catalog, identity; split is skipped via `state.json`) | `prototype/reference/computed-styles.json`, `prototype/components.html`, `prototype/{icons,logo}/`, `frds/*/mocks/` | MECH·low | lead shell |
| **S1.3** | S0.3 | Functional reconciliation (DR-064), both directions, a recommended resolution per item, and the AC id pre-assigned to each Group A item | `freeze/reconciliation.md` | JUDGE·high | `designer` |
| **S1.4-NN** | S0.3 | Copy reconciliation for FRD-NN: judge ONLY the pack's listed mismatches (FRD quote stale · copy wrong · both fine) | `freeze/copy/frd-NN.md` | STANDARD·medium | `copywriter` |
| **M1** | S1.* | Owner status 1 + the A/B list to confirm (below) | `comms/iteration.md` entry | — | lead |
| **S2.1** | M1 | ONE batch of prototype/copy changes (owner-approved Group B builds, copy fixes), rebuild, preflight, `freeze.mjs all --only frd-NN` per touched FRD. Usually empty → mark done | prototype HTML, copy file, touched FRDs' mocks | STANDARD·medium | `designer` |
| **S2.2** | M1 | FRD amendments: Group A as ACs with the pre-assigned ids, stale quotes from S1.4, `ui`/`visual_source` frontmatter | `docs/frds/*/frd.md` | STANDARD·medium | `product-manager` |
| **S2.3-NN** | M1, S1.2 | FDD for FRD-NN (`fdd-template.md`): AC ids per screen, GAP states for flagged Group B items, ends with `## Fidelity references` | `docs/frds/frd-NN-*/fdd.md` | STANDARD·medium | `designer` (one subagent per FRD) |
| **S2.4** | M1, S1.1 | Contract docs: `DESIGN.md` FROZEN with rules that match the CSS, `design-decisions.md` (freeze entry + the resolved DR-064 section), `components.md` (DR-057/062/075) | `DESIGN.md`, `design-decisions.md`, `components.md` | STANDARD·medium | `designer` |
| **S2.5** | S1.1, S1.2 | Fidelity docs: `fidelity-checklist.md` (template, `## Fidelity target`, binding references, signature details with selectors, how to verify), `technical-assumptions.md` build requirements | `fidelity-checklist.md`, `technical-assumptions.md` | STANDARD·medium | `designer` |
| **S2.6** | S1.2, S2.1 | Fixtures, oracle states and build recipes: the prototype side of each oracle state is copied from the config's `states` (route, actions, capture mode) and `computed-styles.json` (`anchor_offset`); the build-side columns (route, profile, seed, doubles) are written | `prototype/reference/{fixtures/,oracle-states.*,*recipes*}` | STANDARD·medium | `designer` |
| **S3** | S2.* | The ONE independent audit (below), time-boxed 15 min | `freeze/audit.md` | JUDGE·high | fresh read-only reviewer, a different model from the authors |
| **M2** | S3 | Owner status 2 | `comms/iteration.md` entry | — | lead |
| **S4.n** | S3 | Fix blocker n only, by the task that owns the file (its tier), max 3 attempts; then `freeze.mjs all --only frd-NN` for what moved | the blocker's files | owner task's tier | owner task's agent |
| **S5.1** | S4.* | Preflight + one incremental regression (`freeze.mjs all`: the stages whose inputs S4 moved re-run; an output that changes outside what S4 touched is a regression) + `check-design-gate.mjs` → READY | `freeze/preflight.json`, gate output | MECH·low | lead shell |
| **S5.2** | S5.1 | Decision-log entry, tracker closed (`finished_at`, `elapsed`, outcome), commit only the freeze's files (`docs(design): freeze the design contract`) | `docs/decision-log.md`, `freeze/tracker.md` | MECH·low | lead |
| **M3** | S5.2 | Owner status 3 + the advance gate | `comms/iteration.md` entry | — | lead |

Tasks that do not depend on the owner's M1 answer (S1.2, S2.5) keep running while the owner reads it. An S2.3-NN whose FRD S2.1 touches waits for S2.1. On the EXPLORE path without a whole-app prototype, S1.2's shard step is replaced by `designer` mocks drawn from the frozen tokens (one task per FRD, STANDARD·medium). A non-UI project skips the plan: only `DESIGN.md` with "no UI — design phase N/A".

## S3 — the one audit, and the stop rule

The auditor gets the gate's current output, `preflight.json`, `packs/_global.md` and the hand-off files, and classifies every finding:

- **BLOCKER** (fixed in S4): a doc contradicts the prototype's CSS/JS; an AC-named state with neither a prototype state nor a recorded GAP; an invalid capture (demo leak, host mode on, undecoded image, a missing listed state × width × theme); a missing reference the build needs (font files, SVGs, tokens, fixtures); an unresolved DR-064 item; any gate item NOT READY.
- **BACKLOG** (everything else: wording, wider coverage, tooling ideas, finer tolerances): one line each in `.pandacorp/comms/visual-punch-list.md`, the file the end-of-build Visual QA merges and works, in its format `- [ ] <frd|global> · <screen/state> · <gap> · <reference file>`, tagged `(design freeze)`.

The auditor checks each recommendation against the owner's recorded decisions before listing it (an audit once proposed 2 columns on phones against an owner rule of 1).

**Stop rule:** exactly one audit. S4 fixes blockers only and adds no scope. No re-audit; S5's mechanical gate is the only re-check. The one exception: a blocker fix that touched shared CSS or tokens re-runs the affected measurements (`freeze.mjs`), never the audit. A blocker still failing after 3 attempts becomes `deferred(owner)`: tell the owner and let them decide. More polishing wanted by the owner is a new round, not a second audit.

## Time box

`tracker.md` records `started_at` (S0.2), each task's start and finish, and `elapsed` = wall-clock minus time idle on an owner reply. The lead updates `elapsed` at every stage boundary. Budget: S0 ≤ 10 min with a config accumulated during the rounds (without one, its authoring is the separate pre-clock task above, budgeted in hours), S1 ≤ 20, S2 ≤ 30, S3 ≤ 15, S4 ≤ 15, S5 ≤ 10. **When `elapsed` reaches 2 h:** start no optional work; finish only what the gate requires; run S3 if it has not run (it alone defines the blockers); fix the blockers; go to S5; write every unfinished non-blocker to the punch list; record the outcome `shipped with backlog`; say so in M3 in one line.

## Resumability

The checkpoint is the files: `tracker.md` (stages and tasks) plus the toolkit's `state.json` (capture steps). On (re)entry after a cut, read both: `done` rows are never redone; `in-progress` rows are re-run from scratch (their outputs are theirs alone, so a re-run is safe); `freeze.mjs` skips its completed steps itself. A row turns `done` only after the lead has seen its outputs on disk. Never stash or reset the tree mid-freeze. Keep the lead's context small (dispatch, verify, tick): the lead's context is what a usage limit cuts.

## Owner messages — three, in Spanish, never a silent multi-hour loop

Each one goes in chat and as an entry in `.pandacorp/comms/iteration.md`; no per-fix narration.

- **M1 (after S1):** "Congelación en marcha (plan de N tareas, ~X min hasta ahora). Capturas y tokens listos o en curso. Prototipo frente a FRDs: A cosas que el prototipo tiene y los FRDs no, B al revés. Te propongo: <lista corta con la recomendación por punto>. ¿Lo confirmas o cambias algo?"
- **M2 (after S3):** "Auditoría independiente hecha: X bloqueantes (los arreglo ahora, ~Y min) y Z mejoras que van a la lista de QA visual del final de la construcción."
- **M3 (after S5):** "Diseño congelado: el chequeo dice READY (tiempo total ~T min). Bloqueantes arreglados: X/X. Pendientes para el QA visual: Z. ¿Avanzo a arquitectura?"

Only the owner's approval writes `phase: architecture` + `advance_pending: false` (DR-032).

## Runtime portability (PORT-1..3)

Same stages, same order, same outputs on every runtime. **Claude Code:** the lead dispatches each wave's tasks as concurrent `Agent` calls with the tier's `model`; S1.2 runs as a background shell. **Codex:** subagents spawn only on explicit request and at depth 1, so when the owner asked for delegation the lead uses the `tier-mech` / `tier-standard` / `tier-judge` workers per row; otherwise it runs every task inline, sequentially, in DAG order (the time box then leans on S1.2 running while the lead writes). Human gates, the Spanish owner messages, the stop rule, the time box and PORT-5's limits on what a non-Claude runtime may write never degrade.
