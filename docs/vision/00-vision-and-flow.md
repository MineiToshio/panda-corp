# Pandacorp — Vision and workflow (v0.2)

> The owner's ideas organized and validated with his answers of 2026-06-12.

## Purpose (twofold)

1. **Generate income**: discover and build monetizable applications. The goal isn't just "the big hit": a portfolio of small apps that each generate a little adds up to a regular income.
2. **Make the owner's life easier**: applications that solve his own problems. Monetization is irrelevant; the value is personal.

## Operating context

- **A one-person operation**: The owner directs, the AI does everything. A process inspired by the 89.ia flow (PRD, FRD, blueprint, work orders) but simplified — without the ceremony of a team.
- **Declared weakness in UX/UI**: the factory compensates for it with dedicated effort on design (see UX/UI reinforcement).
- **Claude is the main orchestrator** of the whole system.

## Operating model: factory = operating system, projects = containers ✅ DECIDED

The factory **handles everything** (research, design, architecture, programming, iteration) but **none of the product lives in panda-corp**:

- The know-how (agents, skills, hooks, standards, templates) is packaged as a **Claude Code plugin** available in any folder.
- In `panda-corp/` only the following live: the know-how, the **idea base**, and the **portfolio** (an index of each product's state). Phases 0-1 (discovery and selection) happen here.
- Once an idea is selected, `/pandacorp:scaffold` creates the project's folder/repo, and **all subsequent phases (2-9) are executed inside the project**, in sessions that run there with the factory's agents.
- **Iterations / expanding scope (v2, v3…)**: run `/pandacorp:nueva-version` inside the project → it re-enters the pipeline at phase 2 (product) and generates new FRDs and work orders in the same repo. You always continue in the project; the factory only reflects the state in the portfolio.
- **Synchronization**: each project declares its state in `docs/status.yaml`; the factory's portfolio is updated by a skill on demand or by a daily job.

### Factory ↔ project cross-references ✅ DECIDED

Golden rule: **each piece of data lives in a single place; the other side keeps only a pointer**. The scaffold creates both links automatically during the handoff:

- **Factory → project** (`factory/portfolio.md`): an entry per project with the local `path`, `repo`, `idea-origin` and a summarized `status`. The idea card is "frozen" at handoff (`status: in-pipeline` + a link to the project); it stops being documented there.
- **Project → factory** (a fixed "Origen — Pandacorp" section in the project's `CLAUDE.md`): the factory's path, a link to the original idea card, and the explicit clarification that standards/process come from the plugin and that ALL the product's documentation (PRD, FRDs, design, blueprint, work orders) lives in the project's `docs/`, never in the factory.
- **Independence**: the project never *needs* to read the factory to work (standards via the plugin, artifacts in its `docs/`). The pointer is informational, not a dependency.
- **Pull synchronization**: the factory reads each project's `docs/status.yaml` by following the portfolio's pointers (the `/actualizar-portfolio` skill or a daily job). A broken path (a moved folder) → the job detects it and asks, it never goes silently out of date.

## The two sources of ideas

| Source | How it enters | Who defines |
|---|---|---|
| **1. Own ideas** | The owner arrives with the problem/feature and a guide | The owner directs; the factory formalizes |
| **2. Automatic discovery** | A skill on demand today (`/descubrir`); later a periodic cron/routine | The factory searches the internet, Reddit, forums, social: real pains, easy to build and monetizable, and documents them |

**Discovery scope ✅ DECIDED**: it explores all profiles (global micro-SaaS, the Hispanic market, one-time payment/extensions…); the scoring decides. No initial restriction.

## The idea base ✅ DECIDED: markdown (viewer = Pandacorp)

> Clarification (2026-06-13): the idea base is **markdown files** (the source of truth, in git, read/written by the agents). The **viewer and interaction is Pandacorp**, not Obsidian. Obsidian was discarded as redundant (it was only a provisional viewer). Moving a card to change its status is done in Pandacorp (it writes the .md's frontmatter directly, without calling Claude).

- Each idea/pain is a `.md` card in `factory/ideas/` with frontmatter:
  ```yaml
  ---
  title: One Piece Funko Tracker
  type: personal | monetary | both
  origin: owner | discovery
  status: discovered | documented | recommended | selected | in-pipeline | shipped | discarded
  score: 0-100
  evidence: [links]
  ---
  ```
- **Kanban view**: Pandacorp shows the cards as a Trello-style board grouped by `status`; moving a card rewrites `status:` in the .md. (Obsidian remains a personal option for the owner if he ever wants it, but it isn't part of the system.)
- **Trigger**: a job (daily at startup; later a watcher/routine) detects `status:` changes and fires the corresponding phase — e.g. `selected` → starts scaffold + product phase.
- Selection dynamics: The owner asks ("which ones do you recommend?"), the factory replies with a justified ranking, **the owner decides** (Human gate #1).

## The pipeline

```
   IN PANDA-CORP (factory)         — idea stage: DISCOVERED
0. DISCOVERY / INTAKE   → idea card in the base (/discover, /new-idea)
1. SELECTION            → The owner decides to run the handoff           ← HUMAN GATE
   ─── /pandacorp:spec <idea>  (HANDOFF: the folder/repo is born + documents) ───
   IN THE PROJECT (with the factory's agents)
2. PRODUCT  → research + PRD + MVP FRDs                  → DOCUMENTED stage
3. DESIGN    → visual research + navigable mockups       → DESIGN stage
              → owner's visual review (iterating in the conversation) ← LIGHT GATE
4. ARCHITECTURE → /blueprint: stack, data model, ADRs + work orders → ARCHITECTURE stage
5. BUILD → /implement: a dynamic workflow builds everything, live in → BUILDING stage
                  Party, TDD, testing per FRD/milestone
6. RELEASE v1   → /release: audit + deploy to production            ← HUMAN GATE  → SHIPPED stage
7. ITERATION    → /iterate: add a feature/change at any time
                  (building or shipped). /new-version only for large milestones.
```

Notes: the stages of Pandacorp's board are DISCOVERED → DOCUMENTED → DESIGN → ARCHITECTURE → BUILDING → SHIPPED (+ DISCARDED). Each transition is written by the corresponding skill. The handoff (idea in the factory → project in its own folder) happens in `/pandacorp:spec`; that's why that skill takes the idea's name and the others don't (they run inside the project). "Recommended" was removed; `recommend` is an on-demand advisory action.

Each phase produces versioned artifacts in the project's `docs/`. Testing is done when each FRD/milestone is closed, not at the end.

## UX/UI reinforcement (explicit priority)

- **A dedicated designer agent** + visual research per project: references from similar well-designed apps, proven patterns, usability heuristics.
- **A standard design system** (shadcn/ui + tokens) as a base — don't invent from scratch.
- **Navigable mockups before coding** (static HTML or Claude Design — to be researched), so the owner's gate is just looking and giving an opinion.
- **Automated verification**: screenshots per viewport (Playwright), accessibility and responsive checks in testing.

## Graphical interface ✅ DECIDED: Pandacorp (the factory's panel, the first project)

- A **local, read-only** web dashboard (`mission-control/`, at the factory root, see its `PLAN.md`). It NEVER calls Claude: it reads the repo's files.
- Panels: (1) idea kanban (moving a card rewrites `status:`), (2) portfolio, (3) "next command to copy" based on status/phase, (4) Party (the workflow's subagents live, reading `~/.claude/dashboard-events.ndjson`).
- The owner runs the commands by pasting them into the Claude Code app → it all comes out of his Max subscription (not the headless pool).
- It's built with `/loop` (interactive session = subscription). It replaces Obsidian as the viewer. Detailed proposal: [docs/proposals/05-mission-control-interface.md](../proposals/05-mission-control-interface.md).

## Still-open questions (secondary)

- Artifact language (proposal: docs in Spanish, code/commits in English)
- Maximum monthly infrastructure budget for the portfolio
- Maximum number of parallel projects
- Accounts: GitHub, Vercel/Railway, Stripe, the Pandacorp domain
- Criteria for shutting down apps without traction

## Technical decisions resolved by research (2026-06-12)

- **Mockups ✅**: self-contained HTML generated by Claude Code (3 directions in parallel) on a shadcn/ui design system + `design-tokens.json` (tweakcn); Playwright screenshots + axe-core accessibility check before the visual gate. Claude Design remains an optional manual tool (it has no API). See [research 05](../research/05-mockups-and-design-phase.md).
- **Kanban ✅ (in Pandacorp, NOT Obsidian)**: the board lives in Pandacorp; dragging/moving a card rewrites `status:` in the .md directly. Obsidian discarded as redundant. Research 06 (Obsidian) remains as a historical reference.
- **Plugin ✅**: `panda-corp/plugin/` + symlink to `~/.claude/skills/pandacorp` — auto-loads in any folder, live edits, namespaced skills (`/pandacorp:*`), templates accessible via `${CLAUDE_PLUGIN_ROOT}/templates/`. See [research 07](../research/07-pandacorp-plugin-structure.md).

## Agent teams and Party ✅ DECIDED (to be validated in use)

- **Implementation with Dynamic Workflows**: the implementation phase uses a **dynamic workflow** (a Claude Code native primitive: a JS script that orchestrates subagents in the background), instead of loose sequential agents or a team that messages peer-to-peer. The work-order loop lives in the script code (pipeline/while), which spawns the subagents (backend-dev, frontend-dev, test-writer, reviewer) with dependencies and parallelism **explicit in the script** (frontend starts when the backend contract exists; testing when frontend finishes). It runs inside the interactive session → it uses the Max subscription (not the headless pool).
- **Party in Pandacorp**: a read-only panel that shows live which agent is active, its task, the pipeline's stage transitions and the dependency graph. It is fed by events emitted by the **workflow's subagents** (`emit-event.sh`) and the `SubagentStop` hook into a local file; the dashboard only reads → zero calls to Claude. It observes, it doesn't control (to redirect/pause, you jump to the terminal). Existing reference/shortcut: `claude-view`.
- **Token-burn caveat**: 3-5 agents in parallel consume ~4-5x the quota. Max 20x recommended for consistent use; mitigate with worker agents on sonnet/haiku and the leader on opus. Recommended team size: 3-5.
- **Resumability**: the engine is a dynamic workflow that is **resumable at its core** (state lives in the script's variables + the project's files + commits, not in messages between agents), so an interruption doesn't lose progress. Agent Teams remains **only for one-off adversarial review**, never as the backbone. Even so, write the critical context to files, not just to messages.

## Proposed next stage

**Build phase 1**: the plugin structure + the constitution + the factory's CLAUDE.md + the idea base with `ideas.base` + the first skills (`/descubrir`, `/nueva-idea`, `/recomendar`). Then a **pilot** with a real idea from the owner.
