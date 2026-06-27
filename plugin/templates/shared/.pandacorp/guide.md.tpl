# {{PROJECT_NAME}} — Pandacorp project guide

> Maintained by the Pandacorp factory — `/pandacorp:upgrade` regenerates this file. Don't hand-edit it; put your own notes in `CLAUDE.md` (below its line). This file is imported by `CLAUDE.md`.

A **Pandacorp** factory project. The whole lifecycle is managed with the `/pandacorp:*` skills.

## Origin — Pandacorp

- Factory: `{{FACTORY_PATH}}` (know-how, idea base, portfolio)
- Original idea card: `{{IDEA_FILE}}` (frozen copy in `.pandacorp/idea-origin.md`)
- Standards and process: they come from the **pandacorp plugin** — do NOT look for them in the factory
- The product's documentation lives in `docs/`; the factory-integration layer (state, machinery, owner comms) lives in `.pandacorp/`
- Project status: `.pandacorp/status.yaml` (the factory reads it for its portfolio; keep it current)

## How changes are made — work through the skills

Changes to this project go through the `/pandacorp:*` skills, not ad-hoc free-chat edits. A skill keeps the process honest: two-layer documentation (canonical doc + `docs/decision-log.md`), `.pandacorp/status.yaml`, FRDs/work-orders, TDD and review. A free-chat edit skips all of that and the docs/state drift out of sync.

**Pragmatic frontier — what needs a skill and what doesn't:**

| Do directly (no skill) | Go through a skill |
|---|---|
| Read, explain, debug, answer questions | Change app **behavior** (a feature, a fix that alters what the app does) |
| Micro non-product edits: a typo in a comment, local config, a throwaway experiment | Touch a **canonical doc**: PRD, FRD, blueprint, ADR, `DESIGN.md`/tokens |
| | Change **state**: `.pandacorp/status.yaml`, work-orders |

**The agent routes automatically.** When the owner asks for a change, classify it and **invoke the right skill, telling them which one** — do not ask permission to enter the skill:

| What the owner asks | Skill |
|---|---|
| "add this feature" / "change this behavior" | `/pandacorp:iterate` |
| "I found this bug while testing" | `/pandacorp:bug` |
| "I decide X" (on a pending point) | `/pandacorp:decide` |
| big package / redesign | `/pandacorp:new-version` |

Auto-invoking covers **entering** the skill only. The skill's internal human-gates stay intact: deploying to production, spending money, deleting data or external communications still stop and ask for the owner's OK.

**Parallel sessions — self-isolate in a worktree (DR-096).** The owner often runs **several conversations at once**, by hand, to advance things in parallel. Because the gate is whole-program (`tsc`/`knip`/visual read the entire tree), one session's in-flight WIP would RED another's gate. So a session **about to make a non-trivial code change** (the same frontier as the write-gate above — micro-edits stay in-tree) **works in its own git worktree**: it calls `EnterWorktree` itself the moment it goes from planning to executing (isolate *first*, then edit), runs `bash .pandacorp/worktree-bootstrap.sh` to reconstitute deps/launch.json/secrets, and when its work is green lands it with `bash .pandacorp/merge-queue.sh` (serialized rebase → integration gate → ff-merge → auto-removes the worktree). The owner just sees "done and merged"; no worktree to manage by hand. **Never fix or mask another session's work:** if a gate RED is in files this session did not change (a parallel session's WIP — check `git status`), report it and stop — do NOT edit it or run `--update-snapshots` to force green. Canonical: `factory/standards/build-orchestration.md` ("Parallel manual sessions", DR-096).

**Direct changes keep the work-order state honest (DR-097).** When you implement a change yourself — a fix or feature you build directly, in OR out of `/implement` — YOU own moving its work order's `implementation_status` to match reality. The board derives the Kanban column from that field, so a stale state shows finished work in the wrong column. While building → `IN_PROGRESS`; the moment the **green gate** (`.pandacorp/verify.sh` — the objective scripts/CI, NOT your own eyeballing) passes clean → `VERIFIED` (the board shows it as **Done**). **Never leave finished, gate-green work stranded at `IN_REVIEW`:** `IN_REVIEW` means *built, awaiting a gate that hasn't run yet* — once the gate is green there is nothing left to wait for. This is consistent with "an agent never checks off its own work" — the GATE is the check; you record its verdict, you don't self-assess. Canonical: `factory/decisions/registry.yaml` (DR-097).

**Keep each conversation isolated (DR-099).** A gate RED in files this session did NOT change is another session's WIP — recognise it (`git status`), **never touch or mask it**, and **don't narrate to the owner what other sessions are doing**: cross-session status is PULL (the owner looks at Mission Control's "⎇ pendientes" indicator), never noise pushed into a conversation. Never report work as "done" until it is actually in `main`. And when you edit product code in the shared main checkout, the write hook reminds you to **isolate first** (DR-096) — heed it for non-trivial changes; that in-the-loop reminder is the enforcement so "the tree looks quiet" can't strand your WIP for another session to hit. And the Stop gate now does the silencing FOR you: it attributes a red against the files THIS session edited (recorded as you work) and, when the red is **only** in files you didn't touch, **allows the stop silently** (logs it for PULL, no message) — fail-closed, so your OWN reds still block loudly. Net: you're interrupted only by your own session's reds, never another's. Canonical: `factory/decisions/registry.yaml` (DR-099).

**Working without the plugin (forks & clones).** The `/pandacorp:*` skills and hooks live in the owner's Claude install (the pandacorp plugin), NOT in this repo. If you cloned or forked only this project and don't have the plugin, the skills simply aren't there — and that's fine: **this repo is fully workable on its own.** Follow `AGENTS.md` by hand — TDD, and when you change behavior update the matching FRD in `docs/frds/` and add an entry to `docs/decision-log.md`. The skills are the *assisted* path, never a lock on contributing.

## Documentation map

Docs are **feature-centric** (DR-049): a thin **product layer** under `docs/product/`, plus one **self-contained module per feature** under `docs/frds/frd-NN-<slug>/`. Two architecture layers — platform (`docs/product/architecture.md`, one per project) vs feature (`frds/frd-NN-<slug>/blueprint.md`, per-FRD); never fuse them. Folders appear **on demand** (progressive disclosure) — a new feature is just a new `frds/frd-NN-<slug>/` folder. IDs form the traceability spine: `REQ-NN-MMM` → `AC-NN-MMM.K` → `CMP-NN-<slug>`/`IF-NN-<slug>` → `WO-NN-MMM`, with source-of-truth hierarchy `FRD > FDD > design-tokens > blueprint > work order`.

| What | Where |
|---|---|
| PRD (vision, metrics, living feature landscape) | `docs/product/prd.md` (multi-PRD → `docs/product/prds/`) |
| Product research | `docs/product/research.md` |
| **Platform architecture** (stack, data model, deploy, cross-cutting) | `docs/product/architecture.md` |
| FRD module (per feature) | `docs/frds/frd-NN-<slug>/` |
| · User contract (REQ + EARS acceptance criteria) | `…/frd-NN-<slug>/frd.md` |
| · Feature design (UI features only) | `…/frd-NN-<slug>/fdd.md` + `…/mocks/` |
| · **Feature blueprint** (implementation design) | `…/frd-NN-<slug>/blueprint.md` (large → `…/blueprints/`) |
| · Feature work orders | `…/frd-NN-<slug>/work-orders/` (`README.md` + `wo-NN-MMM-<slug>.md`) |
| Design system / PDD (references, tokens) + frozen contract | `docs/design/` + `DESIGN.md` |
| ADRs (platform-level, cross-feature) | `docs/adr/` |
| Analytics / event plan (global) | `docs/analytics/events.md` |
| Review / audit evidence (global, on demand) | `docs/reviews/` |
| **Decision log** (decisions + why, history) | `docs/decision-log.md` |
| Machine state (phase, version, overlay_version) | `.pandacorp/status.yaml` |
| **Owner-facing narrative** (Spanish, gitignored) | `.pandacorp/comms/` (`summary.md`, `iteration.md`, `progress.md`) |
| **Owner↔skills inbox** (Spanish, gitignored) | `.pandacorp/inbox/` (`bugs/`, `decisions.md`) |
| **Self-learning capture** (provisional lesson notes, gitignored) | `.pandacorp/run/lessons.md` |

## Project rules

> **Code standards: see `AGENTS.md`** (the factory's durable conventions). The platform stack is in `docs/product/architecture.md`; each feature's implementation design in its `docs/frds/frd-NN-<slug>/blueprint.md`.

1. Language — **git-tracked status decides the language** (committed = English / gitignored = Spanish). Committed → English: code, commits, file/folder names, and product/technical docs (PRD, FRD, blueprint, ADR, README, tests, `docs/decision-log.md`). Gitignored → Spanish: the Pandacorp communication layer (`.pandacorp/comms/`, `.pandacorp/inbox/`) and personal data. User-facing UI copy: i18n, Spanish by default. `.pandacorp/status.yaml` is committed (machine state in English); its readable Spanish narrative lives in `.pandacorp/comms/summary.md`. **The interaction with the owner is always in Spanish** — everything the agent says in chat and inside any skill (questions, explanations, progress, recommendations) is in Spanish, regardless of the artifact's language.
2. Conventional Commits with scope, in English. Direct commits/push to `main` are fine (solo operator; the quality gate is the `implement` reviewer + `.pandacorp/verify.sh`). Never force-push; use a throwaway branch only for big/risky changes.
3. TDD: acceptance-criteria tests BEFORE implementing. Nothing is declared done with red tests — `.pandacorp/verify.sh` must pass.
4. UI only with design tokens from `docs/design/design-tokens.json` — zero hardcoded values. `data-testid` on interactive elements.
5. Forbidden: `any`, `@ts-ignore`, secrets in code, homegrown auth, dependencies that violate the factory's DR-001.
6. Decisions not covered by the documents: consult the factory registry (`factory/decisions/registry.yaml`); if it's not there, escalate to the owner.
7. Document everything (two layers): every relevant change updates its **canonical doc** (behavior → the feature's `frd.md`; technical → the feature's `blueprint.md`, platform-wide → `docs/product/architecture.md` + an ADR; design → DESIGN/tokens; scope → `docs/product/prd.md`) **and** adds an entry to `docs/decision-log.md` with the why, linking the doc. See `AGENTS.md`.
8. **Capture lessons as you work (self-learning).** When you hit something durable and reusable — a fix worth remembering, a library that worked or failed, a gotcha, a recurring pattern — in any skill or in conversation, jot a one-line candidate to `.pandacorp/run/lessons.md` (gitignored scratch; tag `(owner-stated)` if the owner said it, else `(agent-inferred)`). Don't polish it inline. The factory's `librarian` later refines these into reusable lessons that make future projects faster. Capture freely; nothing is promoted without the owner.
9. **Keep the owner's profile alive (personalization, DR-053).** When the owner reveals something durable and personal **about themselves** in conversation — an interest, a hobby, a taste or dislike, a goal, an asset/lever, or how they like to work — capture it into the factory's owner profile at **`{{FACTORY_PATH}}/factory/profile.md`** (personal, gitignored, Spanish). Read it first and add only what's genuinely new or update what changed — never duplicate. This is the **owner profile** (who the owner is, so the factory personalizes ideas, recommendations and conversation), a plane distinct from engineering lessons (rule 8, `.pandacorp/run/lessons.md`) and from product decisions (`docs/decision-log.md`); don't put project facts here. Don't ask permission to note a personal fact — just keep the profile current.

## Current phase

See `.pandacorp/status.yaml`. Pipeline: product → design → architecture → build → release → operation.
