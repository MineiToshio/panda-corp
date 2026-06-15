---
description: Resolves the pending decision points of a Pandacorp project. When an agent hits something only the owner can decide (product scope, spending money, something irreversible), it leaves it as pending in docs/decisions.md and Mission Control highlights it; this skill is how the owner gives their answer. Runs INSIDE the project.
---

# /pandacorp:decide

The mechanism for **the owner to answer the decision points** the AI left pending. Runs IN the project folder. It is the counterpart to the decision points that appear in Mission Control: Mission Control **shows** them (read-only); this skill **resolves** them.

`$ARGUMENTS` optional: your direct answer (e.g.: `/pandacorp:decide "yes, show the costs"`). Without arguments: it shows you the pending ones one by one and asks you.

## Steps

1. **Read `docs/decisions.md`** and list the decisions with status `pending`. For each one show: the question, the options that were researched, and **the AI's recommendation** (with its rationale).
2. **Ask for the owner's answer**:
   - Without arguments: present each pending decision with its recommendation and ask what they decide. The owner can say "your recommendation" to accept the suggested one.
   - With arguments: apply the answer to the pending decision (if there are several, ask which one they mean). Never decide yourself: if the owner doesn't answer something, it stays pending.
3. **Record the answer** in `docs/decisions.md`: `status: resolved`, the owner's verbatim decision, the rationale if they gave one, and the date. Traceability: a resolved decision is never deleted, it is marked resolved.
4. **If it is architectural**, also create/update the ADR in `docs/adr/` (what was decided and the trade-off).
5. **Unblock**: if the decision was unblocking a work order or a front, say so and update `docs/status.yaml` (`pending_decisions`). If `/pandacorp:implement` is running, it picks it up on its own at its next safe point (it checks `docs/decisions.md`); if there is no active build, offer to continue with `/pandacorp:implement`.

## Rules

- **Don't decide for the owner.** Only record what they say. If an answer involves spending money, production, deleting data or external communications, keep applying the decision registry (it may require explicit confirmation with an amount, etc.).
- Each answer is left **on file** (`docs/decisions.md`), not just in the chat: that way progress survives even if the conversation is closed.
- If there are no pending decisions, say so and do nothing.

## How it looks for the owner

In Mission Control, each project shows a **chip with the number of pending decisions**. When entering the project (Summary tab) they see the question + the recommendation + the `/pandacorp:decide` command ready to copy. They paste the command in Claude Code (in the project folder), answer, and Mission Control reflects that there is no longer anything pending.
