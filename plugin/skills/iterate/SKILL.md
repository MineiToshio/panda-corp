---
name: iterate
user-invocable: false
description: Internal incremental documentation contract for the selected implement scope. Specialists prepare minimum FRD, design-source, blueprint and work-order deltas on the integration branch; never an owner command, phase transition or queue drain.
---

# /pandacorp:iterate

Internal planning contract for the run's specialist docs units. The conversation agent selects skills using `.pandacorp/guide.md`; this contract never invokes another skill or launches a nested build. Implement is the single Pandacorp construction entry. An explicit owner request to work directly without Pandacorp is handled by the conversation outside this engine.

## Ownership and preflight

Require `.pandacorp/status.yaml` and existing product structure. Missing prerequisites or overlay drift are returned to the conversation for routing, never repaired by calling another skill here. Never regenerate an overlay or change a plan under another live lease. Run only for the CLI-selected scope in its assigned docs worktree on `lane/<run_id>/integration`.

A new request during a live build becomes a separate `status: draft` card validated with `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" card check .pandacorp/inbox/changes/<slug>.md`; it never expands that run. "Anótalo" captures and validates the draft, then returns without construction. The queue is a file format, never an automatic drain.

## Specialist preparation

The CLI serializes `kind: docs` units by role: **product-manager → architect**, followed by dynamically scheduled designer prerequisites only for UI WOs without a source. Each specialist owns its output; a generic implementer does not author the whole plan. Use `../implement/references/incremental.md` for the flat card schema and report contract.

1. **PM: understand the selected change.** Read the actual owner citations, PRD, affected FRDs and current state. Amend behavior and EARS ACs, scope/non-goals and relevant edge states only where necessary. New modules get a new numbered FRD module; do not regenerate unrelated FRDs. Research only material gaps within the selected scope.
2. **Classify visual evidence, including small changes to existing UI.**
   - **Agreed/existing design:** card `ui: true`, `design_source: agreed|existing`, non-empty `design_refs` (owner citations or actual FDD/mock/prototype references). Document and implement that source faithfully, without a new visual direction or design pass.
   - **UI with no design, delegated to the agent:** the conversation normally chooses lightweight design before implement and records that standalone documentation delta in the source checkout before starting the run; design itself never commits. If the card reaches this run with `design_source: pending`, the architect first creates the plan and classifies each WO independently (explicit WO `ui` > FRD `ui` > artifacts). The CLI then assigns a **designer docs unit** only for UI WOs missing an available source, before their construction; `card.ui` never converts backend into UI. It follows `../design/references/incremental.md` as a bounded contract: reuse tokens/`DESIGN.md`, FDD/mock delta, scoped verification, agent-decided reversible choice. No owner visual approval wait, global gate, full freeze or phase transition. Independent work continues.
   - **No UI:** `ui: false`, `design_source: not-applicable`, no designer unit; proceed to the technical delta.
3. **Architect: classify impact and complete the selected plan.**
   - **Small adjustment / fix:** update the owning FRD's ACs and widen an existing cohesive WO when appropriate; otherwise add one new coarse WO. Keep Summary, In-Scope, inline ACs and Status Note current.
   - **New feature / module:** write that FRD's blueprint referencing `docs/product/architecture.md`, with an ADR only for a platform decision. Apply the decomposition contract in `../work-orders/SKILL.md`: coarse WOs, explicit artifacts, requirement/AC links, real dependencies, complexity and design references. Reading that contract is not invoking another skill.
   - **Fundamental change:** before the run, the conversation must establish the requested impact radius and any required owner decisions. Prepare only that accepted ADR/platform/model/blueprint delta. A new PRD or several epics is version-scale planning returned to the conversation, never an ordinary run silently expanded.

## Reopen or extend a WO: report-compatible transaction

Only the **card-scoped architect docs unit** may amend an existing selected WO's planning frontmatter in its assigned worktree. Set `implementation_status: PLANNED`, append the card slug to `source_change` without losing existing links, and update permitted AC/artifact/dependency/complexity planning fields as needed. Preserve WO identity and activation. Name the new scope and reopening reason in Summary/Status Note. The CLI validates this delta against the base when accepting the report; this is not permission for builders or the session to edit state/frontmatter.

New WOs use the work-orders contract and its readiness/activation checks; nothing is born ACTIVE by assertion. Never reopen work owned by another live run. `source_change: [<slug>]` links every created/reopened WO to the selected card (DR-147), so reconciliation can close it once those WOs verify.

## Supersession and regression

- **Document completeness (DR-116):** when replacing a rule/claim/AC/model fact, derive its owning documents and cross-references, `rg` the old claim across `docs/` and `.pandacorp/`, and close surviving current assertions in this same change. Preserve append-only dated decision-log history (DR-093). Update canonical truth plus the decision-log reason; new documentation is pending construction, not proof of implementation.
- **Blessed-test supersession (BL-0051 / DR-080):** never make a re-bless WO depend on the WO that derogates its old contract. Keep derogation and reviewer-authored re-bless in one cohesive WO or independent WOs judged together. Name the affected blessed test in Summary/Status Note. Implementers never edit blessed tests.
- **Logical model (DATA-7):** include `docs/product/data-model.json` in the schema-owning WO's declared scope and same change when its logical shape changes; otherwise record evidence for no change. Independent review compares actual schema and published model.
- **Bug:** record the real reproduction in `.pandacorp/comms/progress.md`; the tests-first regression is anchored in it (DR-015). Preserve existing green tests.

## Return

Each specialist returns its docs report through the owning CLI protocol. The architect's final plan names affected WOs and design references; the CLI commits, validates and refreshes only the selected work. README, ADRs and model are amended when their facts change. Never edit `.pandacorp/status.yaml`, advance phase, commit on main, force-push or launch construction recursively. Day-to-day iteration is versionless; production landing and protected operations retain their owner gates.
