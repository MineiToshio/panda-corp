# Project structure

Reference structure for the default web stack (Next.js App Router). Other stacks apply the spirit: separated layers, isolated data layer, code by domain, colocated tests.

```
src/
├── app/                      # routes (App Router). [locale]/ if there is i18n
│   ├── (group)/              # route groups: (landing), (app)…
│   └── .../_components/      # components specific to that route (_ prefix = not a route)
├── components/
│   ├── core/                 # reusable primitives (Button, Input, Modal…)
│   └── modules/              # reusable composed components
├── queries/                  # THE ONLY place with DB access (Prisma/ORM). Never from components
├── lib/                      # utilities grouped by domain: auth/, analytics/, integrations/…
├── hooks/                    # app hooks
├── types/                    # app types
├── contexts/                 # React Context (e.g. ThemeContext)
└── i18n/                     # routing, request and locales/<locale>/*.json
e2e/                          # end-to-end tests (Playwright)
docs/                         # product documentation — feature-centric (see "Documentation structure" below)
.pandacorp/                   # Pandacorp factory-integration layer (state, guide, comms, inbox) — see .pandacorp/README.md
```

## Structure rules
- **Isolated data layer**: all DB access lives in `queries/` (or an equivalent layer). Components/actions call `queries/`, never the ORM directly.
- **Code by feature**: what is specific to a route goes in its `_components/`, `_actions/`, `_schemas/`, `_hooks/`. Promotion rule: if only one route uses it, it stays local; if several use it, it moves up to `components/`, `lib/`, etc.
- **Reuse before creating**: check in order `components/core` → `components/modules` → the parent's `_components` → the route itself. Only create if it doesn't exist.
- **Colocated tests**: next to the code (`*.test.ts`) or in `_tests/` inside the component/feature folder. E2E in `e2e/`.
- For frontend-less backends (API, scraping): layers Routes → Services → Repositories; isolated data layer the same.
- **Living documentation**: every project carries `docs/decision-log.md` (history of decisions, with the why) in addition to the PRD/FRDs/blueprint. Each relevant change updates its canonical doc **and** the decision log — two-layer rule in [documentation.md](documentation.md).

## Documentation structure (`docs/`) — feature-centric

Group documentation **by feature, not by type** (DR-049). Each FRD is a **self-contained module** under a thin, shared **product layer**. The folder *shape* is the same for every project; how much you fill scales with size (**progressive disclosure**). This is the docs analogue of "code by feature" above.

```
docs/
├── product/                      # product layer (stable, shared across features)
│   ├── prd.md                    # vision, users, metrics, scope + a LIVING "feature landscape" table of FRDs
│   │                             #   multi-PRD product → promote to product/prds/prd-NN-<slug>.md (same shape)
│   ├── architecture.md           # PLATFORM architecture: stack, data model, deploy, cross-cutting, service boundaries
│   ├── research.md               # product research (market, competitors, viability) → research/ folder when large
│   ├── context-pack.md           # cross-feature shared semantics (state machines, conventions) — ON DEMAND
│   └── glossary.md               # canonical terminology — ON DEMAND
├── design/                       # the GLOBAL design system = the PDD (ONE per project, never per-feature)
│   ├── design-tokens.json        # palette, type, spacing, radii — the frozen contract
│   ├── references.md · voice-and-tone.md · a11y-report.md
│   └── (DESIGN.md lives at the repo ROOT — the frozen design contract)
├── frds/
│   └── frd-NN-<slug>/            # each FRD = a self-contained MODULE
│       ├── frd.md                # the user contract: REQ-NN-MMM + AC-NN-MMM.K (EARS, testable)
│       ├── fdd.md                # feature design — CONDITIONAL: only when the feature has UI
│       ├── blueprint.md          # feature implementation design — references product/architecture.md
│       │                         #   large → promote to a blueprints/ FOLDER split by coherent concern (NOT "pillars")
│       ├── mocks/                # CONDITIONAL: HTML prototypes + screenshots for THIS feature
│       └── work-orders/
│           ├── README.md         # this feature's WO list + intra-feature order + parallelism
│           └── wo-NN-MMM-<slug>.md  # copies in its AC; cites REQ/CMP/IF IDs; targets exactly ONE deploy unit
├── adr/adr-NNN-<slug>.md         # platform-level technical decisions (cross-feature)
├── analytics/events.md           # event/telemetry plan — stays GLOBAL (metrics → events)
├── reviews/                      # GLOBAL verification evidence — ON DEMAND (reviewer: wo-NN-review.md; security-auditor: security-audit-vN.md)
└── decision-log.md               # history (two-layer rule, see documentation.md)
```

### The model
- **Two architecture layers — never fuse them.** `product/architecture.md` = platform (stable, ONE per project). `frds/frd-NN/blueprint.md` = how THIS feature is built (per-FRD). A single global `blueprint.md` is an anti-pattern: it becomes a monolith every feature must edit.
- **PRD ↔ FRD = siblings, loosely coupled.** The PRD keeps a living *feature landscape* table; each FRD names its parent PRD in frontmatter. FRDs are **NOT** nested inside the PRD.
- **Work orders live under their FRD.** Each WO implements its FRD's acceptance criteria, **targets exactly one deploy unit/repo**, and copies its AC inline (the implementer should not have to go look). Intra-feature order in the per-FRD `work-orders/README.md`; cross-feature order from each WO's `Dependencies` (the build walks every FRD's `work-orders/`).
- **Design = two layers.** `design/` is the product-level design system (the PDD — there is no separate PDD file). `frd-NN/fdd.md` is the feature's design (UI features only). The system is never duplicated per feature.

### Stable IDs (the traceability spine) — numeric, folder-derived
`NN` is the FRD folder number; it never changes once assigned (the human-readable name lives in the folder slug, not the ID).
- `REQ-NN-MMM` — requirement (in `frd.md`)
- `AC-NN-MMM.K` — acceptance criterion (EARS, testable)
- `CMP-NN-<slug>` / `IF-NN-<slug>` — component / interface (in `blueprint.md`)
- `WO-NN-MMM` — work order; its tests map back to `AC-NN-MMM.K`
- **Source-of-truth hierarchy** (declared in every blueprint + WO): `FRD > FDD > design-tokens > blueprint > work order`. Changes propagate upstream in that order (behavior→FRD, visual/copy→FDD, architecture→blueprint, scope→WO) — this *is* the two-layer documentation rule made structural.

### Progressive disclosure (works for small AND large)
Same shape always; create folders **on demand**, never pre-stub. Weekend MVP (3 FRDs): per FRD just `frd.md` + a thin `blueprint.md` + `work-orders/`; global design system; no FDD/context-pack/glossary; `prd.md` a single file. Large/corporate (30+ FRDs, multi-repo): every FRD fully populated; `blueprint.md`→`blueprints/`; `prd.md`→`product/prds/`; `context-pack.md`+`glossary.md` appear; WOs tagged by repo. **Growth is additive — a new feature is a new `frds/frd-NN/` folder and nothing else moves; the only rename in the whole lifecycle is `product/prd.md` → `product/prds/`.** You never restructure.

### Extensible base skeleton (a skeleton, not a cage)
The named parts are a **contract** the skills and Mission Control rely on (`product/`, `design/`, `frds/frd-NN/`, the ID convention, the source-of-truth hierarchy). A project **may add its own folders** on a real need (`runbooks/`, `db/`, `security/`, a feature's `references/`). The rule is additive: **extend the skeleton, don't rename or relocate the contract parts.** Folders that recur across projects are candidates to graduate into this standard via `/pandacorp:learn`.
