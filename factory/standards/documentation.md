# Living documentation — canonical doc + decision log

How a Pandacorp project is documented so that the documentation **never lies** and **the why is never lost**. Applies to EVERY project, in every phase (building and shipped).

## Rule

Every relevant change —app behavior, scope, architecture, design— is documented in **two layers, always**:

1. **Canonical doc (the current truth) — `MUST`.** The document that *owns* the fact is updated so that it describes the reality of now, as if it had always been that way:

   | Change | Owner doc |
   |---|---|
   | App behavior/feature (what it does, EARS criteria) | the corresponding **FRD** `docs/frds/frd-NN-<slug>/frd.md`; new feature → new FRD module |
   | Product scope/objective, success metrics | the **PRD** (`docs/product/prd.md`) |
   | Platform architecture, stack, data model, cross-cutting | **`docs/product/architecture.md`** + an **ADR** in `docs/adr/` |
   | Feature implementation design (how THIS feature is built) | that feature's **`docs/frds/frd-NN-<slug>/blueprint.md`** (large → `blueprints/` folder) |
   | Visual design — global tokens, components, voice | **`DESIGN.md`** (root) / `docs/design/design-tokens.json` (the product design system = the PDD) |
   | Feature UI design (screens, interaction of a UI feature) | that feature's **`docs/frds/frd-NN-<slug>/fdd.md`** |
   | Progress state (what is done) | `.pandacorp/status.yaml` — written by skills/CI, **not by hand** |

   Structure (feature-centric, the FRD as a self-contained module) and the stable-ID convention (`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN-<slug> → WO-NN-MMM`) are defined in [structure.md](structure.md) (DR-049).

2. **Decision log (the history) — `MUST`.** An entry is added to `docs/decision-log.md`: date, *what*, *why*, and a link to the canonical doc that was touched (*Impact* field). Most recent on top.

The canonical doc answers *"what is true now?"*; the decision log, *"how did we get here and why?"*. The doc alone loses the why; the decision log alone leaves the doc outdated. That is why **both** go together.

**Do not log** trivial changes already evident in the commit (renaming a variable, formatting). **Do log** every decision or change of behavior, scope, technical, or design.

### Source-of-truth hierarchy (which doc wins on conflict)
When two docs disagree, the higher one wins and the lower one is corrected: **`FRD > FDD > design-tokens > blueprint > work order`**. Discoveries during build propagate **upstream** in that order — a behavior change updates the FRD, a visual/copy change the FDD, an architecture change the blueprint, a scope/paths change the WO — never only the lower doc. Every `blueprint.md` and work order restates this hierarchy in its header so the implementer never has to guess.

### Decision log vs. other docs (don't confuse them)
- **`docs/decision-log.md`** = durable history of decisions/changes across the WHOLE cycle (including post-launch). The why behind the current state.
- **`.pandacorp/comms/iteration.md`** = working memory of the iteration of a manual PHASE —what was tried, what the owner rejected— to resume mid-phase (DR-032). Transient; it closes when advancing a phase. A decision that comes out of the iteration and becomes firm is recorded in the decision log.
- **`factory/decisions/registry.yaml`** (in the factory) = policy (recurring rules with a default). It is not history.

## How it is verified
- **Checklist (review) — `MUST`:** the `reviewer` rejects a work order/PR that changes behavior without updating the corresponding FRD **nor** adding an entry in `docs/decision-log.md`.
- **Phase gate:** when closing a manual phase or an `iterate`, the skill confirms that the canonical doc and the decision log are up to date.
- **Automatable (future):** a check that fails if an FRD was modified without a decision-log entry of the same date.

## Why
Without this, the why behind decisions dilutes into commits and lost conversations, and the FRDs/blueprint age until they lie. The double layer keeps **the truth** (canonical doc) and **the memory** (decision log) separate and both up to date — cheap to write, very expensive to reconstruct if missing.
