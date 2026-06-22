# Proposal 16 — Complete the document-template library + a doc-lint (DR-077)

> Drafted 2026-06-21 from an owner request ("a templates folder so every document we generate shares
> a base format, versioned, with old samples migratable to a new format") and decided by a 10-agent
> research + red-team workflow. **ADOPTED 2026-06-21 as DR-077** (`factory/decisions/registry.yaml`).
> Canonical artifacts: `plugin/templates/docs/` (+ its `README.md`), `plugin/templates/README.md`,
> `plugin/templates/shared/.pandacorp/doc-lint.sh`, `factory/standards/structure.md`. History:
> `factory/decision-log.md` + `plugin/docs/decision-log.md` (2026-06-21). This document is the
> rationale/design record (the why and the discards).

## The question

The factory generates the same documents over and over, across many projects (PRDs, FRDs, work
orders in bulk, blueprints, ADRs…). Only 4 had a base template (`plugin/templates/docs/`:
prd/frd/blueprint/work-order). The owner proposed three things:

- **(a)** fill the missing templates so every recurring doc has one base format;
- **(b)** stamp a `template_version` into each generated doc (which template version produced it);
- **(c)** when a template improves, bump it and **migrate** the already-generated docs to the new format.

## The research (web, 4 angles)

- **Doc/spec templates** (ADR/MADR, Google/Uber/Twitter RFCs, Backstage, cookiecutter/Yeoman): a
  maintained, centralized template library is table-stakes — but the recurring **regret is template
  WEIGHT** (heavyweight forms breed boilerplate). Keep templates thin, sections optional, tiered.
- **Template versioning + migration**: **copier** and **cruft** do exactly (b)+(c) — they stamp the
  producing version (`_commit` / `.cruft.json`) and re-apply template changes via a 3-way merge — but
  they work because a generated project is a **deterministic function of (template, committed
  answers)**, so they can reconstruct the old version and merge without clobbering. Cookiecutter
  (no update path) is the cautionary opposite.
- **The case against**: YAGNI / wrong-abstraction (Metz, Rule of Three), the internal-tool
  maintenance trap (worse for a solo operator), and "templates don't solve drift" (the real rot is
  content-vs-code, fixed by change-time enforcement, not format metadata).
- **AI/LLM-specific**: docs here are LLM-generated. Spec-kit confirms a template file is a productive
  in-band prompt (so (a) is well-founded), but spec-kit/Kiro/Tessl **all chose regenerate-or-flag,
  never auto-migrate**; the spec-maintenance-over-time story is the field's acknowledged unsolved part.

## The red team (4 adversarial lenses) → verdict: **do-reduced** (unanimous reduce, high confidence)

Ground-truthed against the repo, the load-bearing assumptions behind (b)/(c) failed:

- The portfolio is **1 project** (Mission Control); no sibling `.pandacorp/` overlays exist — the
  "fleet that fragments across template versions" does not exist.
- The doc templates' **entire git history is additive** — zero breaking structural bumps. The exact
  event a migration engine handles has occurred **0 times**.
- Provenance already lives at project grain (`.pandacorp/status.yaml` `created_with`/`overlay_version`);
  a per-doc `template_version` is a **third version axis with no bridge** → re-creates the
  state-fracture the pipeline audit flagged as P0, and a birth-stamp lies the moment a doc is edited.
- The migration engine's only justification (preserve irreplaceable human prose) **collides with its
  only safe operation** (touch structure/frontmatter, never prose); and copier's safe 3-way merge is
  **unavailable** for non-deterministic LLM output (no common ancestor → clobber-or-conflict).
- The escape hatch already exists: **regenerate** the doc via its owning skill from the still-true
  upstream (PRD/FRD/code) — the agent that wrote it re-emits it.

## The decision (DR-077)

- **(a) DO** — fill the missing templates, thin, with explicitly-optional sections (an LLM pads every
  mandatory section into noise). Each doc-generating skill/agent **points at** its template (the
  template is the single structural contract).
- **(b) SKIP** the per-document `template_version` stamp — version the template **set** collectively
  under the existing `OVERLAY_VERSION`; provenance is already in `status.yaml`.
- **(c) SKIP** the migration engine — **retrofit by regeneration**; reserve in-place edits for the
  rare doc with irreplaceable hand-edits and prefer flag-for-review over auto-rewrite.
- **Plus the piece the proposal omitted** (and the highest-leverage one per the research): a shipped
  **doc-lint** that surfaces frontmatter / stable-ID-spine drift. It is **ADVISORY** (reports, never
  fails the gate) — verified against Mission Control's partial/adopted spine (56 findings, exit 0): a
  fail-closed version would have red-locked every existing project (the DR-074/075 retrofit lesson +
  the research's "over-strict gates get disabled"). Fail-closed promotion is a future per-project
  opt-in once a spine is conformant.

## What shipped

- **First pass (plugin v8.38.0, OVERLAY 8.36.1→8.37.0):** 8 new templates (FDD, architecture, ADR,
  events, research, design-system, work-orders README, change-request) + `templates/docs/README.md`;
  skill pointers in spec/blueprint/design/work-orders/change/bug; `doc-lint.sh` + the `verify.sh`
  call; DR-077 in the registry + both decision logs + a `structure.md` note.
- **Second pass (plugin v8.39.0):** an audit confirmed all 12 doc templates are referenced by their
  creator; added 4 more for recurring docs that had none — `api-contract` (per-backend-WO
  `docs/api/<wo-id>.md`, the highest-volume untemplated doc), `components-inventory`
  (`docs/design/components.md`), `changes-readme`, `decisions-inbox`. Crucially, **agent-created**
  docs reference the template in the **agent prompt** (`backend-dev`, `designer`), not a skill. Added
  a top-level `plugin/templates/README.md` documenting, by creator class (skill / agent /
  hand-authored-or-tool-generated), **how each template is honored**, plus the **intentionally-freeform**
  docs (no rigid template by design).

## Discards / notes

- `design-tokens.json`: **no rigid template** — generated by Claude Design (DR-058) or the designer's
  extraction; a fixed JSON would fight the tool's export. Shape documented in `DESIGN.md` + the
  `styling-and-ui` rule.
- **DR number:** DR-076 was concurrently taken by the in-flight Proposal 15 (gate-template fidelity);
  this work took **DR-077**, committed in isolation so as not to entangle Proposal 15.
- **Deferred:** the Mission Control Manual narrative (DR-046) — MC is mid-re-anchor; tracked in
  `mission-control/docs/decision-log.md`.

Refines DR-049 (feature-centric structure) + DR-048 (the upgrade mechanism) + DR-059 (verbatim gate
propagation).
