---
description: Resolves the pending decision points of a Pandacorp project. When an agent hits something only the owner can decide (product scope, spending money, something irreversible), it leaves it as pending in .pandacorp/inbox/decisions.md and Mission Control highlights it; this skill is how the owner gives their answer. Runs INSIDE the project.
---

# /pandacorp:decide

The mechanism for **the owner to answer the decision points** the AI left pending. Runs IN the project folder. It is the counterpart to the decision points that appear in Mission Control: Mission Control **shows** them (read-only); this skill **resolves** them.

`$ARGUMENTS` optional: an id to target ONE decision (`/pandacorp:decide 2026-06-21-1`), optionally followed by your direct answer (`/pandacorp:decide 2026-06-21-1 "yes, show the costs"`); or just your direct answer with no id (`/pandacorp:decide "yes, show the costs"`) — applied to the pending decision if there is exactly one, otherwise you'll be asked which. Without arguments: it shows you every pending one, one by one, and asks you.

## Steps

1. **Read `.pandacorp/inbox/decisions.md`** (its format: `${CLAUDE_PLUGIN_ROOT}/templates/docs/decisions-inbox-template.md` — agents append decision points to it following that shape). For each `##` heading block, compute its **stable id** the same way Mission Control does (`src/lib/docs/activity.ts`, `DecisionPoint.id`) — read the file top to bottom and derive, never invent:
   - A date-prefixed heading (`## YYYY-MM-DD (status) — <title>` or `## YYYY-MM-DD — <title>`) → id `<date>-<n>`, where `n` is the 1-based count of headings sharing that EXACT date string, counting BOTH pending and resolved blocks (an id never shifts when a sibling's status changes).
   - A legacy heading (`## OPEN: <title>` / `## CLOSED: <title>` / `## RESOLVED: <title>`, no date) → id `legacy-<n>`, its own separate 1-based counter.
   List the decisions with status `pending`, each labeled with its id. For each one show: the id, the question, the options that were researched, and **the AI's recommendation** (with its rationale).
2. **Ask for the owner's answer**:
   - **`$ARGUMENTS`'s first token is an id** (matches `<date>-<n>` or `legacy-<n>`): scope directly to that ONE decision — don't list or ask about any other pending one. If text follows the id, treat it as the owner's direct answer for that decision and apply it. If nothing follows, present just that decision (question + recommendation) and ask what they decide.
   - **No id token, with answer text**: apply the answer to the pending decision if there is exactly one; if there are several, ask which one they mean (give the ids as the choices).
   - **No arguments at all**: present every pending decision (with its id) and its recommendation, and ask what they decide for each. The owner can say "your recommendation" to accept the suggested one.
   - Never decide yourself: if the owner doesn't answer something, it stays pending.
3. **Record the answer** in `.pandacorp/inbox/decisions.md`: `status: resolved`, the owner's verbatim decision, the rationale if they gave one, and the date. Traceability: a resolved decision is never deleted, it is marked resolved.
4. **If it is architectural**, also create/update the ADR in `docs/adr/` (what was decided and the trade-off).
5. **Unblock**: if the decision was unblocking a work order or a front, say so and update `.pandacorp/status.yaml` (`pending_decisions`). If `/pandacorp:implement` is running, it picks it up on its own at its next safe point (it checks `.pandacorp/inbox/decisions.md`); if there is no active build, offer to continue with `/pandacorp:implement`.

## Rules

- **Don't decide for the owner.** Only record what they say. If an answer involves spending money, production, deleting data or external communications, keep applying the decision registry (it may require explicit confirmation with an amount, etc.).
- Each answer is left **on file** (`.pandacorp/inbox/decisions.md`), not just in the chat: that way progress survives even if the conversation is closed.
- If there are no pending decisions, say so and do nothing.

## How it looks for the owner

In Mission Control, each project shows a **chip with the number of pending decisions**. When entering the project (Summary tab) they see, per decision, its id + the question + the recommendation + the **`/pandacorp:decide <id>`** command ready to copy — already scoped to that one decision, never the bare un-scoped form. They paste the command in Claude Code (in the project folder), answer, and Mission Control reflects that there is no longer anything pending.
