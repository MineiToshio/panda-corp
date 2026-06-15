# Living documentation — canonical doc + decision log

How a Pandacorp project is documented so that the documentation **never lies** and **the why is never lost**. Applies to EVERY project, in every phase (building and shipped).

## Rule

Every relevant change —app behavior, scope, architecture, design— is documented in **two layers, always**:

1. **Canonical doc (the current truth) — `MUST`.** The document that *owns* the fact is updated so that it describes the reality of now, as if it had always been that way:

   | Change | Owner doc |
   |---|---|
   | App behavior/feature (what it does, EARS criteria) | the corresponding **FRD** in `docs/frds/`; new feature → new FRD |
   | Product scope/objective, success metrics | the **PRD** (`docs/prd.md`) |
   | Architecture, stack, data model, technical decision | the **blueprint** (`docs/blueprint.md`) + an **ADR** in `docs/adr/` |
   | Visual design, tokens, components | **`DESIGN.md`** / `docs/design/design-tokens.json` |
   | Progress state (what is done) | `docs/status.yaml` — written by skills/CI, **not by hand** |

2. **Decision log (the history) — `MUST`.** An entry is added to `docs/decision-log.md`: date, *what*, *why*, and a link to the canonical doc that was touched (*Impact* field). Most recent on top.

The canonical doc answers *"what is true now?"*; the decision log, *"how did we get here and why?"*. The doc alone loses the why; the decision log alone leaves the doc outdated. That is why **both** go together.

**Do not log** trivial changes already evident in the commit (renaming a variable, formatting). **Do log** every decision or change of behavior, scope, technical, or design.

### Decision log vs. other docs (don't confuse them)
- **`docs/decision-log.md`** = durable history of decisions/changes across the WHOLE cycle (including post-launch). The why behind the current state.
- **`docs/iteration.md`** = working memory of the iteration of a manual PHASE —what was tried, what the owner rejected— to resume mid-phase (DR-032). Transient; it closes when advancing a phase. A decision that comes out of the iteration and becomes firm is recorded in the decision log.
- **`factory/decisions/registry.yaml`** (in the factory) = policy (recurring rules with a default). It is not history.

## How it is verified
- **Checklist (review) — `MUST`:** the `reviewer` rejects a work order/PR that changes behavior without updating the corresponding FRD **nor** adding an entry in `docs/decision-log.md`.
- **Phase gate:** when closing a manual phase or an `iterate`, the skill confirms that the canonical doc and the decision log are up to date.
- **Automatable (future):** a check that fails if an FRD was modified without a decision-log entry of the same date.

## Why
Without this, the why behind decisions dilutes into commits and lost conversations, and the FRDs/blueprint age until they lie. The double layer keeps **the truth** (canonical doc) and **the memory** (decision log) separate and both up to date — cheap to write, very expensive to reconstruct if missing.
