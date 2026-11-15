# Lightweight incremental design

Use for a bounded UI delta on an existing project. The conversation agent owns routing; this procedure never invokes implement, architecture or any other skill. Full design remains for the first visual iteration or a broad redesign.

## Input and authority

Read the selected change/card, its owner citations and `design_source`/`design_refs`, the affected FRD/FDD, root `DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/components.md` and relevant current mocks/prototype. Inspect the existing surface before proposing its delta.

- `design_source: agreed|existing`: preserve that source. Return its references for implementation; do not generate a new visual direction or re-ask an already resolved choice.
- `design_source: pending`: design only the selected piece. When the owner delegated the whole change (for example "encárgate de todo"), the designer makes the reversible visual choice and records `design_decision_by: agent`. No owner visual approval is required for this delegated lightweight delta. A missing source discovered within a build is handled by that run's designer docs unit under the same contract, before the affected UI build.
- `ui: false` with `design_source: not-applicable`: return without visual work.

## Bounded output

1. Reuse the existing tokens, typography, components and layout patterns. Cover only the changed surface and its relevant loading, empty, error, focus and responsive states; preserve unaffected design. A shared-component adjustment names its affected consumers and checks those consumers. A request that changes the global identity/system belongs to full mode and is returned to the conversation for scope routing.
2. Update only the affected portion of `docs/frds/<frd>/fdd.md` and add or amend a bounded mock under that module's `mocks/`. Include AC links, reused components/tokens, exact copy and affected states, with the mock path/state as visual reference. Do not regenerate all FRDs, global prototype, brand, tokens or component inventory. A genuinely new shared component adds its necessary inventory entry, rather than duplicating an existing one.
3. Render the changed mock at the affected desktop and phone widths and verify its interactions, keyboard access and accessibility. Save scoped evidence next to the mock and report actual commands/results. Keep any existing measured oracle for unaffected states unchanged; amend only the affected state's reference when the project uses measured fidelity checks. No global freeze or global design gate is run or re-blessed.
4. Record the source, decision, rationale, decision maker and concrete reversal in `docs/decision-log.md`. An agent decision is explicitly **agent-decided, reversible**, never owner-approved. Preserve the input card's provenance; the hand-off lists the new FDD/mock references, so the run can consume them without rewriting the original owner citation.

## Return contract

Return affected FRDs/surfaces, FDD/mock paths and state references, existing token/component reuse, verification evidence and any reversible agent decision. Before starting implement, the conversation records the standalone FDD/mock delta in a scoped documentation commit in the source checkout, verifies the referenced files are nonempty and identical to that HEAD, and then records `design_source: existing`, `design_refs: [...]`, `design_decision_by: agent`. This is a pre-run hand-off by the conversation, never a commit by design or a write into an active run. Do not mark the source available while its delta is only dirty/untracked. The CLI validates the hand-off and pins integration to that source revision; if a run is already active, return to its assigned docs/report protocol instead. Within a live run, the designer returns these references through its docs report; the CLI keeps the original pending card as provenance and makes construction depend on the completed design step.

This mode writes no project `phase`, `advance_pending`, global blessing or full freeze state. It does not commit, land or start another run. During a build it uses only its assigned worktree/artifacts and the report protocol; standalone work returns its artifact delta to the conversation. The owner can inspect and iterate later; production, spending, data deletion and external communication keep their existing authorization rules.
