# Mission Control — Pandacorp project guide

> Maintained by the Pandacorp factory — `/pandacorp:upgrade` regenerates this file. Don't hand-edit it; put your own notes in `CLAUDE.md` (below its line). This file is imported by `CLAUDE.md`.

A **Pandacorp** factory project. The whole lifecycle is managed with the `/pandacorp:*` skills.

## Origin — Pandacorp

- Factory: `/Users/Shared/Proyectos/panda-corp` (know-how, idea base, portfolio)
- Original idea card: `.pandacorp/idea-origin.md` (frozen copy in `.pandacorp/idea-origin.md`)
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
| "add this feature" / "change this behavior" / "I found this bug" | **`/pandacorp:change`** — the single front door (DR-069): it classifies feature-vs-bug, assigns the class of service, derives the change's **rigor** with a deterministic script and, by default, captures it in the queue `.pandacorp/inbox/changes/` and stops there. With explicit **`--now`**, and only for a **micro/normal** change with **no build running**, it also implements and closes it in the same turn instead (a delegated subagent in its own worktree, the level's `verify.sh` gate, an independent reviewer on L1, and a batch close-out via `/pandacorp:sync --close-out`) — falling back to **capture-only** whenever the change is `critical` or touches the floor (auth, money, PII, persistence, irreversible, secrets/CI, the oracles, the factory's machinery), or whenever a build is active (the engine is the sole writer while it runs). Either way the build drains the queue at its next safe point. `iterate`/`bug` are its internal engines — never route the owner to them directly (a direct `iterate` edits FRDs/WOs immediately, the exact concurrent-doc-edit hazard the queue removes) |
| "I decide X" (on a pending point) | `/pandacorp:decide` |
| big package / redesign | `/pandacorp:new-version` |

Auto-invoking covers **entering** the skill only. The skill's internal human-gates stay intact: deploying to production, spending money, deleting data or external communications still stop and ask for the owner's OK.

**Parallel sessions — self-isolate in a worktree (DR-096).** The owner often runs **several conversations at once**, by hand, to advance things in parallel. Because the gate is whole-program (`tsc`/`knip`/visual read the entire tree), one session's in-flight WIP would RED another's gate. So a session **about to make a non-trivial code change** (the same frontier as the write-gate above — micro-edits stay in-tree) **works in its own git worktree**: it calls `EnterWorktree` itself the moment it goes from planning to executing (isolate *first*, then edit), runs `bash .pandacorp/worktree-bootstrap.sh` to reconstitute deps/launch.json/secrets, and when its work is green lands it with `bash .pandacorp/merge-queue.sh` (serialized rebase → integration gate → ff-merge; the worktree is KEPT — deleting the directory the session stands in dangles its cwd), **then calls `ExitWorktree(action: remove)`** to clean it AND restore the session cwd (outside `git worktree remove` as fallback if the tool no-ops). The owner just sees "done and merged"; no worktree to manage by hand. **Never fix or mask another session's work:** if a gate RED is in files this session did not change (a parallel session's WIP — check `git status`), report it and stop — do NOT edit it or run `--update-snapshots` to force green. Canonical: `factory/standards/build-orchestration.md` ("Parallel manual sessions", DR-096).

**Direct changes keep the work-order state honest (DR-097).** When you implement a change yourself — a fix or feature you build directly, in OR out of `/implement` — YOU own moving its work order's `implementation_status` to match reality. The board derives the Kanban column from that field, so a stale state shows finished work in the wrong column. While building → `IN_PROGRESS`; the moment the **green gate** (`.pandacorp/verify.sh` — the objective scripts/CI, NOT your own eyeballing) passes clean → `VERIFIED` (the board shows it as **Done**). **Never leave finished, gate-green work stranded at `IN_REVIEW`:** `IN_REVIEW` means *built, awaiting a gate that hasn't run yet* — once the gate is green there is nothing left to wait for. This is consistent with "an agent never checks off its own work" — the GATE is the check; you record its verdict, you don't self-assess. Canonical: `factory/decisions/registry.yaml` (DR-097).

**Keep each conversation isolated (DR-099).** A gate RED in files this session did NOT change is another session's WIP — recognise it (`git status`), **never touch or mask it**, and **don't narrate to the owner what other sessions are doing**: cross-session status is PULL (the owner looks at Mission Control's "⎇ pendientes" indicator), never noise pushed into a conversation. Never report work as "done" until it is actually in `main`. **But if your OWN merge can't land** — `merge-queue.sh` hands back (rebase conflict, red gate, busy main) — **TELL THE OWNER IN CHAT immediately**: what's blocked, *why* (the real reason), that **the work is preserved** on its branch (nothing lost), and what's needed (their decision, or the retry condition). That's *your* finished deliverable stuck outside `main`, **not** cross-session noise — never go silent or off doing workarounds (deploying elsewhere, sitting on it, retrying forever) without first telling the owner, or the work can be **lost** when the conversation ends. And when you edit product code in the shared main checkout, the write hook reminds you to **isolate first** (DR-096) — heed it for non-trivial changes; that in-the-loop reminder is the enforcement so "the tree looks quiet" can't strand your WIP for another session to hit. And the Stop gate now does the silencing FOR you: it attributes a red against the files THIS session edited (recorded as you work) and, when the red is **only** in files you didn't touch, **allows the stop silently** (logs it for PULL, no message) — fail-closed, so your OWN reds still block loudly. Net: you're interrupted only by your own session's reds, never another's. **And at commit time:** if `git status` shows files you didn't touch (another session's WIP), `git add` **only your own files** (never `git add -A`) and commit — don't ask whether to commit, don't mention the other session's files. Committing only your files leaves theirs untouched and needs no permission; pausing to narrate it is the noise. Canonical: `factory/decisions/registry.yaml` (DR-099).

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
| **Owner↔skills inbox** (Spanish, gitignored) | `.pandacorp/inbox/` (`changes/` — the unified queue, DR-069 — and `decisions.md`) |
| **Self-learning capture** (provisional lesson notes, gitignored) | `.pandacorp/run/lessons.md` |

## Project rules

> **Code standards: see `AGENTS.md`** (the factory's durable conventions). The platform stack is in `docs/product/architecture.md`; each feature's implementation design in its `docs/frds/frd-NN-<slug>/blueprint.md`.

1. **Language (DR-009)** — see `AGENTS.md` § Language & interaction for the full rule (committed = English, gitignored = Spanish, the owner interaction is always Spanish); the Documentation map above already covers the one committed exception (`.pandacorp/status.yaml`, machine state) and its Spanish narrative (`.pandacorp/comms/summary.md`). `.pandacorp/status.yaml` is committed (machine state, English).
2. Conventional Commits with scope, in English. Direct commits/push to `main` are fine (solo operator; the quality gate is the `implement` reviewer + `.pandacorp/verify.sh`). Never force-push; use a throwaway branch only for big/risky changes.
3. TDD: acceptance-criteria tests BEFORE implementing. Nothing is declared done with red tests — `.pandacorp/verify.sh` must pass.
4. UI only with design tokens from `docs/design/design-tokens.json` — zero hardcoded values. `data-testid` on interactive elements.
5. Forbidden: `any`, `@ts-ignore`, secrets in code, homegrown auth, dependencies that violate the factory's DR-001.
6. Decisions not covered by the documents: consult the factory registry (`factory/decisions/registry.yaml`); if it's not there, escalate to the owner.
7. Document everything (two layers): every relevant change updates its **canonical doc** (behavior → the feature's `frd.md`; technical → the feature's `blueprint.md`, platform-wide → `docs/product/architecture.md` + an ADR; design → DESIGN/tokens; scope → `docs/product/prd.md`) **and** adds an entry to `docs/decision-log.md` with the why, linking the doc. See `AGENTS.md`.
8. **Capture lessons as you work (self-learning) — IN THE SAME TURN, not at the end.** The moment a capture event happens — the owner corrects you, a fix lands after a failure, a library proves itself or fails, you hit a non-obvious gotcha — jot a one-line candidate to `.pandacorp/run/lessons.md` **in that same turn** (gitignored scratch; tag `(owner-stated)` if the owner said it, else `(agent-inferred)`). Don't polish it inline; never defer capture to the session's end (sessions span hours — deferred capture is lost capture; the Stop-hook backstop only re-scans what slipped). The factory's `librarian` later refines these into reusable lessons that make future projects faster. Capture freely; nothing is promoted without the owner.
   **And retrieve before you build (loop v2):** before non-trivial work, read **`/Users/Shared/Proyectos/panda-corp/factory/memory/INDEX.md`** — one line per active lesson with its "use when" trigger — and open the full `LESSON-NNNN` files whose trigger matches your task. When a lesson materially informs your work, **cite its `LESSON-NNNN` in the durable artifact you write** (blueprint, ADR, review, WO Status Note, progress log); the build close-out counts those citations deterministically (`count-lesson-citations.sh`) — never edit a lesson's `times_applied`/`applied_in` by hand.
9. **Keep the owner's profile alive (personalization, DR-053).** When the owner reveals something durable and personal **about themselves** in conversation — an interest, a hobby, a taste or dislike, a goal, an asset/lever, or how they like to work — capture it into the factory's owner profile at **`/Users/Shared/Proyectos/panda-corp/factory/profile.md`** (personal, gitignored, Spanish). Read it first and add only what's genuinely new or update what changed — never duplicate. This is the **owner profile** (who the owner is, so the factory personalizes ideas, recommendations and conversation), a plane distinct from engineering lessons (rule 8, `.pandacorp/run/lessons.md`) and from product decisions (`docs/decision-log.md`); don't put project facts here. Don't ask permission to note a personal fact — just keep the profile current.
10. **Interaction style with the owner (DR-110)** — see `AGENTS.md` § Language & interaction for the full rule (mark where the real answer begins, default concise/scannable, red-team judgment calls). Full rule: `factory/standards/conventions.md` (CONV-11).
11. **Subagent model selection (DR-111)** — see `AGENTS.md` § Language & interaction for the full rule (tier the subtask, not the parent conversation; haiku/sonnet/opus by complexity; Fable never automatic). Full rule: `factory/standards/conventions.md` (CONV-12).

## Current phase

See `.pandacorp/status.yaml`. Pipeline: product → design → architecture → implementation → release (launched/terminal; DR-085 folded the old `operation` phase into `release`).
