---
name: decide
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
2. **Check staleness before asking (owner request, 2026-06-30).** For each pending decision about to be presented (whether listing all or scoped to one id), compute its age: today minus the heading's date (skip this check for a legacy heading — no date). **7 days or older** → flag it explicitly BEFORE asking for the answer: tell the owner how old it is, and actively judge whether it's likely still relevant — read the work order/file it references (the "Bloquea" field, or whatever the question is about) and check if the codebase already moved past it (resolved another way, the referenced code no longer exists, the blocking WO already finished). State your read plainly ("esto bloqueaba WO-03-002, que ya está VERIFIED — probablemente ya no aplica" / "no encuentro nada que sugiera que cambió, sigue pareciendo vigente") and ask the owner to confirm before proceeding:
   - Owner says it's **still relevant** → proceed to ask for the real answer (step 3) normally.
   - Owner says it's **obsolete / no longer applies** → skip asking for an answer; go straight to recording it as OBSOLETO (step 4 below).
3. **Ask for the owner's answer** (only for a decision confirmed still relevant):
   - **`$ARGUMENTS`'s first token is an id** (matches `<date>-<n>` or `legacy-<n>`): scope directly to that ONE decision — don't list or ask about any other pending one. If text follows the id, treat it as the owner's direct answer for that decision and apply it. If nothing follows, present just that decision (question + recommendation) and ask what they decide.
   - **No id token, with answer text**: apply the answer to the pending decision if there is exactly one; if there are several, ask which one they mean (give the ids as the choices).
   - **No arguments at all**: present every pending decision (with its id) and its recommendation, and ask what they decide for each. The owner can say "your recommendation" to accept the suggested one.
   - The owner can also say a decision is obsolete at this step (not just at step 2) — treat it the same as step 2's obsolete path.
   - Never decide yourself: if the owner doesn't answer something, it stays pending.
4. **Record the outcome** in `.pandacorp/inbox/decisions.md` — never delete a block, only mark it. "Mark it" means **edit that decision's OWN block in place** (its heading's status word + a `- **Estado:**` line) — never just append a new sibling entry narrating the resolution while leaving the original heading untouched (that's exactly how a decision ends up mechanically "pending" forever even after it's clearly been answered — a real incident, 2026-06-30). A new entry with more context is welcome IN ADDITION, never INSTEAD:
   - **Answered**: `- **Estado:** RESUELTO: <the owner's verbatim decision> (YYYY-MM-DD)`, plus the rationale if they gave one.
   - **Obsolete** (owner confirmed it no longer applies, no answer was given): `- **Estado:** OBSOLETO: <brief reason — what changed> (YYYY-MM-DD)`. This is a DIFFERENT terminal state from RESUELTO — it means the question was dropped, not answered; never use RESUELTO for this.
   - If you find a decision that a NEWER sibling entry already resolved (someone answered it in conversation or a repair pass, but never went back to mark the original) — don't ask the owner again: close the original with the SAME outcome the sibling entry documents, referencing it.
5. **If it was answered (not marked obsolete) and it is architectural**, also create/update the ADR in `docs/adr/` (what was decided and the trade-off).
6. **Unblock — MECHANICALLY, not just narratively.** If the decision (answered OR marked obsolete) was blocking work, do THREE things:
   - **Flip the blocked work order(s)**: find every WO the decision names (the "Bloquea" field / the referenced `wo-NN-MMM`) whose frontmatter is `implementation_status: BLOCKED` + `blocked_reason: needs-owner`, and set it back to `implementation_status: PLANNED` (clearing `blocked_reason`). Changing the frontmatter state IS the instruction to the engine (DR-050) — an answered decision that leaves its WO `BLOCKED` stays stranded forever (the engine's planner skips BLOCKED; audit-20 P1-4).
   - Update `.pandacorp/status.yaml` (`pending_decisions` count).
   - Say what you unblocked. If a build is running, the engine's safe-point check ALSO does this sweep at each FRD boundary (belt and suspenders); if there is no active build, offer to continue with `/pandacorp:implement`.

## Rules

- **Don't decide for the owner.** Only record what they say. If an answer involves spending money, production, deleting data or external communications, keep applying the decision registry (it may require explicit confirmation with an amount, etc.).
- **Don't mark a decision obsolete on your own judgment** — the staleness check (step 2) only flags and recommends; the owner confirms. The same "never decide for them" rule applies to OBSOLETO as to RESUELTO.
- Each answer is left **on file** (`.pandacorp/inbox/decisions.md`), not just in the chat: that way progress survives even if the conversation is closed.
- If there are no pending decisions, say so and do nothing.

## How it looks for the owner

In Mission Control, each project shows a **chip with the number of pending decisions**. When entering the project (Summary tab) they see, per decision, its id + an "hace N días" age hint + the question + the recommendation (shown as context only, no one-click approve) + the **`/pandacorp:decide <id>`** command ready to copy — already scoped to that one decision, never the bare un-scoped form. They paste the command in Claude Code (in the project folder); if the decision is old, the skill flags it and asks whether it still applies before asking for an answer. Once resolved or marked obsolete, Mission Control reflects that there is no longer anything pending — an obsolete one shows with a distinct "Obsoleta" tag, not the same as one actually answered.
