---
name: implement
description: Deliver the requested Pandacorp change against its agreed behavior and design. Choose a plan for the case, preserve independent verification and resumability, and land through the project queue.
---

# /pandacorp:implement

## Goal

Deliver everything in the agreed scope, working with no known bugs or errors in the
delivered behavior. Meet the acceptance criteria and match the agreed design within
a reasonable tolerance for the case. Follow the project's FRD, blueprint, and rules.

If implementation exposes a defect or gap that must be fixed to deliver the scope,
fix it and then align the owning FRD, blueprint, and `docs/decision-log.md`. Update the
canonical `data-model.json` for a schema change. Keep unrelated work out of scope.

Leave regular commits and a result certified by the project merge queue. An authorized
landing integrates the work. A launched project can remain certified on its branch
while it waits for the owner's order. Clean up your own merged, clean worktrees and
disposable temporary files. Preserve and report dirty, unmerged, or order-pending work.

## How

Read the case, decide what to read, and write your own implementation plan for this
case. Choose the cheapest route that reliably reaches the goal. Decide what to batch,
what can run in parallel, who owns each part, and when and how to test. Draw on the
relevant FRDs, WOs, blueprints, design references, and `docs/rules/` as the case warrants.
A tiny change may need only a brief plan. A multi-FRD build often benefits from
separate landings for independently verifiable FRDs or small coupled groups.

Use parallel subagents where they save time on disjoint work. Give each parallel
writer its own Git worktree (DR-096). Prefer Codex for implementation when an authorized
worker is available. Match the model and effort to each subtask, using the nearest
supported choice. Use these tiers as guidance. Never auto-select Fable-class.

| Subtask | Claude family / effort | Codex family / effort |
|---|---|---|
| Mechanical lookup or exact edit | haiku / low | luna / low |
| Spec-precise work with an objective check | sonnet / low | luna / medium |
| Normal implementation | sonnet / low | sol / low |
| Delicate work such as migrations or concurrency | sonnet / medium | sol / medium |
| Independent review against fixed criteria | sonnet / medium | sol / low |
| Judgment under ambiguity or serious risk | opus / high | astra / high |

In Claude Code, a long run may use `/goal` or `/loop` if available. Keep a clear
handoff at a safe point if another session will continue.

## Invariants

- **Independent verification.** Before declaring done, an agent who did not write
  the code checks the integrated result against the acceptance criteria and checks
  correctness and security. Match the effort to the case. If the work is still
  stuck after two repair attempts, stop and report the blocker and evidence to the
  owner in Spanish. Keep review bounded.
- **Observed evidence.** A bug fix has a test that fails before the fix and passes
  afterward. Check changed UI in the browser preview. Only report done when
  `bash .pandacorp/merge-queue.sh --status` reports `certified-awaiting-order` or
  `landed` for the delivered scope. State explicitly which result was observed.
- **Commits and resumption.** Commit regularly in English with scoped Conventional
  Commits. The coordinator alone performs Git writes, including worktree operations.
  Keep WO frontmatter `implementation_status` truthful in those commits. Use
  `VERIFIED` only when independent review and feature checks support it. Keep a
  gitignored `.pandacorp/run/implement-plan.md` in the stable project checkout.
  Choose its format so a fresh session can resume from the evidence and committed
  progress. Claim ownership atomically and record the owning session ID. If another
  live session owns the run, stop and ask the owner in Spanish. Release ownership
  at a safe point before handing off.
- **Write ownership.** One writer per file. Leave another session's work untouched.
- **Landing.** Use `bash .pandacorp/merge-queue.sh` for every landing. Launched projects
  require the owner's explicit order for each landing (DR-138). Never set bypass or
  override flags or run `authorize-exclusion.mjs`. Add the `Change: <slug>` trailer
  when a landing answers a card. Set `source_change` on WOs created for that card.
  If the card spans multiple landings, time its linkage so reconciliation only
  archives the card when the scope is fulfilled (DR-147).
- **Human gates.** Stop for the owner before production actions, spending money,
  deleting data, changing access, or communicating externally.
- **Scope.** If the plan looks much bigger than the request warrants, stop before
  building and propose a smaller scope to the owner in Spanish.
- **Lessons.** Capture lessons in `.pandacorp/run/lessons.md` as they happen.

## Intake notes

- Take scope from the owner's request, a selected card, a bug report, or the
  relevant FRDs and WOs. For capture only, validate a draft against the
  [change-request template](../../templates/docs/change-request-template.md).
- Build faithfully from an agreed or existing design. For UI without a design,
  use lightweight design first for a scoped change (DR-163). First designs and
  major redesigns keep their project design gate.
- Honor an explicit “do it directly” or “hazlo directo” request and keep the
  applicable verification and human gates.
- The legacy CLI serves only as a manual fallback to resume a run it started.
  See [legacy engine resumption](references/legacy-engine/engine-v2.md).
