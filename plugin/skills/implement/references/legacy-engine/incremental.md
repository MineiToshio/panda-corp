# Incremental change: design source and specialist docs

The conversation agent chooses actions from `.pandacorp/guide.md`, preserving the owner's intent, including "hazlo directo sin Pandacorp". Skills do not call one another. Implement owns construction and its specialist preparation units; reading a specialist contract is not an invocation of its phase skill.

## Three cases

| Change | Conversation routing | Implement behavior |
|---|---|---|
| UI design already agreed in this conversation, or existing FDD/mocks/prototype | Implement, with source citations/files on the scope card | Implement and document that source faithfully; no new design pass or visual-choice gate |
| Owner delegates the whole change and no design exists | Lightweight design, then implement; no wait for owner visual approval | Consume the resulting delta. If routing left design pending, schedule a designer docs unit in this same run before affected UI construction; independent units continue |
| No UI | Implement directly | PM/architect prepare only necessary documentation; no designer unit |

A tiny change to existing UI still identifies its source. "Already agreed" means evidence in the actual conversation, not a guess from a summary. Record the agreed layout, components, states or copy and its owner quote in the canonical FDD/WOs without inventing a new direction. `existing` names actual files/states. Merely finding an unrelated FDD is not a source for new UI.

## Scope-card fields

The frontmatter is flat YAML (the CLI's card parser contract):

```yaml
ui: true
design_source: agreed # agreed | existing | pending | not-applicable
design_refs: ["owner: <actual quote>", "docs/frds/frd-01-example/fdd.md"]
design_decision_by: owner # owner | agent
```

`agreed` and `existing` carry non-empty `design_refs`; refs can be actual conversation citations or paths plus state/section references. `pending` explicitly marks missing visual design and requires the lightweight step before coding. `not-applicable` is for `ui: false`, with `design_refs: []`. Never mark an unmade agent choice as owner-approved. A conversation-created lightweight delta is `existing` with its FDD/mock refs and `design_decision_by: agent` only after the conversation records the scoped documentation commit in the source checkout before the run. `start` requires every referenced file to be nonempty and identical to the committed source revision, and creates integration from that revision. Design never commits; during a live run every design delta uses the assigned docs/report protocol. Use explicit `owner:` or `conversation:` prefixes for chat citations; file paths (optionally with anchors/line numbers) must resolve in the consuming checkout. The source card preserves provenance within a running build; designer reports add the produced references to the run's hand-off.

## Specialist docs, one writer at a time

The CLI's preparation chain uses `kind: docs` units distinguished by `role`, dispatched as that specialist rather than a generic implementer:

1. **`product-manager`** owns new/amended FRD behavior and EARS ACs, cited scope/exclusions and supersession propagation. It identifies UI scope and its design evidence.
2. **`architect`** plans before visual prerequisites so independent backend WOs can proceed. It owns only necessary blueprint/ADR/platform/logical-model changes and the final WO plan. Classify each WO independently: explicit WO `ui` wins over FRD `ui`, then artifact inference; the card never turns all WOs into UI. Preserve explicit WO design evidence; a pending card invalidates only inferred legacy design, not another WO’s agreed source. Stamp missing UI design `pending`.
3. **`designer`**, scheduled dynamically only for UI WOs without an available agreed/existing source after the architect plan integrates, owns the lightweight FDD/mock delta. Follow `../../../design/references/incremental.md` as a bounded procedure, not the full design phase. Reuse `DESIGN.md`, tokens and existing components, record the reversible choice as agent-decided and return verified references. No global visual gate, freeze or phase change.
The architect applies `../../../work-orders/SKILL.md`'s decomposition contract: coarse slices, requirements and ACs inline, Summary/Status Note, artifacts, dependencies, complexity, source_change and existing visual references. Do not invoke the work-orders or architecture phase skills. Keep readiness, grounding and consistency evidence proportional to the changed plan.

The planner and worker brief share one resolver: completed scoped designer references, explicit WO source, scoped card source, then eligible legacy FDD. File references must be nonempty in the consuming checkout; resolved references are included verbatim in the brief and its context pack. A UI build cannot dispatch with a missing source. A designer prerequisite covers only the UI WOs without evidence, while independent backend work continues.

Each role operates only in its assigned integration worktree/artifacts and returns the CLI report. The CLI commits and refreshes the selected plan. Existing initial-build WOs with valid design/planning evidence do not need a fresh docs/design pass merely because implement was invoked. README, decision log and logical data model change only when their facts change. No docs worker edits project phase or launches a nested run.

## Reopening an existing work order

A card-scoped architect docs report may reopen/amend its existing WO: set `implementation_status: PLANNED`, append the selected card slug to `source_change` while preserving earlier links, amend planning fields/ACs and explain the reopened scope in Summary/Status Note. Preserve the WO identity and activation; the CLI validates the permitted frontmatter delta against its base before accepting the report. Other workers may not change this frontmatter. This is the incremental planning transaction, not an unrestricted manual state edit. New WOs still follow the work-orders readiness/activation contract. Never reopen another live run's work or widen scope outside the selected card.
