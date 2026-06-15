# Proposal — Pandacorp's Interface / Mission Control

> Generated 2026-06-13. Research in `docs/research/` (landscape of interfaces on top of Claude Code). The operator wants to see status, read documents, and trigger actions without depending on the bare terminal.

## The problem in one sentence

Skills are good for **executing**, but not for **seeing, reading, and organizing**. The visual layer is missing. "Interface" is actually two separable capabilities: (1) see/read/organize and (2) trigger actions from buttons.

## The 5 alternatives

| # | Alternative | See status | Read docs | Trigger pipeline | Effort | Internet? |
|---|---|---|---|---|---|---|
| 1 | **Claude Code desktop app** (redesigned Apr 2026) | Partial (sessions) | Yes (preview pane) | Chat only | None | Yes |
| 2 | **Obsidian** + Bases + Shell Commands | Yes (kanban) | Yes (markdown render) | "Best-effort" buttons | Low (hours) | No |
| 3 | **Custom local web dashboard** (built by the factory) | Yes (complete) | Yes | Yes + live streaming | Medium (1-2 days) | No (optional API key) |
| 4 | **Third-party GUIs** (Nimbalyst, Opcode, claude-code-cli-ui…) | Session level only | No | Session only | None | Partial |
| 5 | **GitHub Projects + Actions** (kanban in the cloud) | Yes (issues) | Raw markdown | Yes (on moving a card) | Medium | Yes |

### How they're used, at a high level

1. **Desktop app**: you open the app, you see a sidebar with your sessions per project, a pane that renders HTML/PDF/markdown, a diff viewer. It removes the "black terminal" feeling, but the skills are still written in the chat — there are no buttons. You already have it with your plan.

2. **Obsidian**: you open the folder as a vault. A live kanban board groups your ideas by `status` (you drag cards → the file changes). You click a card and read it formatted. A couple of buttons on the note trigger short skills (`/pandacorp:recommend`, `:sync-portfolio`). Limit: you don't see the output live and it only reads from one folder (the projects go in via symlink).

3. **Local web dashboard**: you open `localhost:3000`. Three panes — kanban of ideas, portfolio table (reads each project's `status.yaml`), and a console. You click "advance to spec" on an idea and a pane opens that **streams live** what Claude is doing while it runs the skill; when it finishes, the card refreshes itself. It is the only option that understands your own data model AND triggers with live feedback. The factory builds it for itself (one work order + `/pandacorp:implement`).

4. **Third-party GUIs**: you install and you're done, but they all look at Claude Code's session layer (`~/.claude/`), not your idea base or your portfolio. They serve as a session monitor, not as the factory's Mission Control.

5. **GitHub Projects**: you push the repo to GitHub, the ideas are issues with status labels, you move a card on the web/mobile board and a GitHub Action triggers the skill and opens a PR. Good for mobile and durability, but it creates **two sources of truth** (issues vs. frontmatter) and runs in the cloud, not on your machine.

## Recommendation

**Two-layer approach, in phases:**

### Now (today, zero code): Obsidian as a read-only Mission Control
It solves 80% of your immediate annoyance — seeing the kanban, reading the cards and rendered documents, dragging cards — without building anything. It's your always-open "second screen". Setup: install the Bases Kanban plugin + open the vault.

### The local web dashboard IS the factory's first pilot product
Instead of debuting the factory with the Funko tracker, we debut it by building **your own Mission Control**. Reasons:
1. It gives you exactly what you asked for: see + read + **trigger with live output**, aware of your data model (ideas, portfolio, project status).
2. **Dogfooding**: we validate the complete pipeline (spec → design → blueprint → work orders → implement) by building something you'll use every day. If the process fails, you discover it with an internal tool, not with a commercial product.
3. It stays 100% under your control and without depending on the internet.
4. It's a bounded project with low UX demands (three panes, no elaborate design) — a good first case.

**What I'm ruling out for now**: GitHub Projects (a second source of truth), third-party GUIs (blind to your data model), and the desktop app as Mission Control (it doesn't show your data, although it helps avoid seeing the bare terminal — use it freely in parallel).

### Technical detail to remember
The dashboard would trigger Claude via `claude -p` / Agent SDK, which since 2026-06-15 consumes a credit pool separate from the subscription. Mitigation: configure `ANTHROPIC_API_KEY` in the subprocess environment to bill at the API rate instead of depleting the fixed pool.

## Decision for the owner
Does the **local web dashboard** become the factory's first project (displacing the Funko tracker as the pilot), while we set up Obsidian today for immediate reading?
