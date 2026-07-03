# Living documentation — canonical doc + decision log

> Domain: Product/Documentation · Severity: **MUST** · Enforcement: checklist (`reviewer` FRD gate + phase gates) + doc-lint (advisory, DR-077). Operative form: `rules/documentation-and-decisions.md` (DR-051). See DR-018/DR-049.

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
   | External-facing overview (what the app does, how to run it) | root **`README.md`** — see *Root README* below (DR-112) |

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

## Root README — the project's front door (DOC-3, DR-112)

> Domain: Product/Documentation · Severity: **SHOULD** · Enforcement: doc-lint (hard-eligible on greenfield) + `release` pre-release checklist.

**Rule.** Every project MUST reach a human (GitHub, a brownfield adopt) with a populated root `README.md` — never the raw scaffold placeholder. It's the repo's front door: what the app does, and how to run it. It stays **thin and never duplicates** the PRD/blueprint — it points to `docs/` for depth. Minimum sections: a one-line description, what it does, tech stack, getting started (prerequisites, install, env vars via `.env.example`, dev command, tests), a pointer to `docs/` for the rest. Template: `${CLAUDE_PLUGIN_ROOT}/templates/docs/readme-template.md`.

**Populated progressively, by whoever first knows each part — never invented:**
- `scaffold` / `spec` Step 0 seeds a placeholder (`README.md.tpl` — project name only, a `PANDACORP-README-PLACEHOLDER` marker) since the product doesn't exist yet.
- `spec`, once the PRD/FRDs exist, fills **what it does** + doc links and removes the placeholder marker.
- `architecture`, once the stack is installed and `.env.example`/`.claude/launch.json` exist, fills **getting started** with the REAL install/dev/test commands — read from what was just installed, never guessed.
- `implement`'s hardening close-out re-checks (advisory) that the commands still match `package.json` scripts / `.env.example` — work orders can add env vars mid-build.
- `release`'s pre-release checklist (already required this) is the final human-facing gate: the README must cover what it is, how to run it locally and (external) how to deploy.

**How it is verified:** `.pandacorp/doc-lint.sh` — root `README.md` must exist; once `docs/product/prd.md` exists, the placeholder marker must be gone (HARD-ELIGIBLE, greenfield only — mirrors the BL-0009 pattern). Quality of content beyond that is the `release` checklist (manual).

**Why:** the two-layer discipline above guarantees the PRD/decision-log carries the *why*, but nothing surfaced a lightweight entry point — a repo with no README is illegible to a human or an adopting agent without re-deriving intent from code. Started `SHOULD` (not `MUST`) since in-flight/older projects predate this and shouldn't retroactively fail a gate.
