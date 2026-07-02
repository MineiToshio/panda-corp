# Project structure

> Domain: Architecture/Structure · Severity: **MUST** (src/, isolated data layer, `_tests/` placement, docs skeleton) / **SHOULD** (promotion timing) · Enforcement: lint (structure guard in `verify.sh`, knip) + doc-lint (advisory) + `reviewer`. Operative form: `rules/project-structure.md` (DR-051). See DR-049/DR-077.

Reference structure for the default web stack (Next.js App Router). Other stacks apply the spirit: separated layers, isolated data layer, code by domain, tests grouped in `_tests/` folders (never loose beside implementation files). **All application code lives under `src/` (mandatory whenever the stack supports it)** — config/tooling and non-code assets (`public/`, `content/`, `docs/`) stay at the repo root; the `@/*` alias points at `src/`.

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
├── test/                     # SHARED test infra only (render helpers, fixtures, factories, mocks)
└── i18n/                     # routing, request and locales/<locale>/*.json
e2e/                          # end-to-end tests (Playwright), split by domain (auth.spec.ts, dashboard.spec.ts…)
docs/                         # product documentation — feature-centric (see "Documentation structure" below)
.pandacorp/                   # Pandacorp factory-integration layer (state, guide, comms, inbox) — see .pandacorp/README.md
```

## Structure rules
- **Isolated data layer**: all DB access lives in `queries/` (or an equivalent layer). Components/actions call `queries/`, never the ORM directly.
- **Code by feature**: what is specific to a route goes in its `_components/`, `_actions/`, `_schemas/`, `_hooks/`. Promotion rule: if only one route uses it, it stays local; if several use it, it moves up to `components/`, `lib/`, etc.
- **Reuse before creating**: check in order `components/core` → `components/modules` → the parent's `_components` → the route itself. Only create if it doesn't exist.
- For frontend-less backends (API, scraping): layers Routes → Services → Repositories; isolated data layer the same.

## Component folder convention (single-file vs multi-file)
Applies everywhere — `core/`, `modules/` and route-local `_components/`.
- **Single-file component**: put the file directly in the parent folder (`core/Button.tsx`). **Don't** create a folder that would hold just one file (no `Button/Button.tsx` with no siblings).
- **Multi-file component**: use a folder named after the component; the main file has the **same name as the folder** (`Button/Button.tsx`, **never** `index.tsx`). Component-scoped siblings live inside it: `types.ts`, `utils.ts`, `*.styles.ts`, `use*.ts`, subcomponents used only here, and **`_tests/`**.
- A component "becomes multi-file" as soon as it has any scoped sibling — **including a test**. So a component that gets a test is promoted to its own folder with the test under `_tests/`. If a folder ends up with only the one file, flatten it back.

## Test organization (definitive — no loose test siblings)
- **Unit/component tests live in a `_tests/` folder inside the component/feature folder** — `Button/_tests/Button.test.tsx`. **Never** leave `*.test.ts(x)` files loose at the same level as implementation files (it's visual noise and makes the tree hard to scan).
- **Shared test infra** (render helpers, fixtures, factories, mocks) → `src/test/`.
- **E2E** (Playwright) → top-level `e2e/`, split by domain/workflow (`auth.spec.ts`, `dashboard.spec.ts`); don't dump unrelated domains in one spec.

## Page-level folders (siblings of `_components`)
For a route/segment, page-scoped code lives in siblings under that route: `_components/`, `_utils/`, `_hooks/`, `_actions/`, `_types/`, `_schemas/`. The `_` prefix keeps them out of the URL. **Scope by segment first**: files used only by a child segment go in that child's folders, not the parent — prefer the smallest valid scope.

## `src/lib/` organization
Group utilities by **purpose**: one file per library/service (`mapbox.ts`, `prisma.ts`) or per classification (`formatting.ts`, `cookies.ts`). When a second file of a clear concern appears, **promote it to a domain subfolder in the same change** (`lib/auth/`, `lib/analytics/`) and move both files — don't leave one at the root and one nested.

## Promotion rule: move code up only when reuse appears
Used in one place → keep it there. Used by another component on the same page → move to **page level** (`_utils/`, `_hooks/`, …). Used by another page / app-wide → move to **app level** (`lib/`, `hooks/`, `types/`, `components/core|modules/`). Always the **smallest scope that fits current usage** (component → page → app); don't pre-promote on speculation.
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
│           └── wo-NN-MMM-<slug>.md  # a COARSE slice (one view/capability); copies in its AC; cites REQ/CMP/IF IDs; implementation_status in frontmatter
├── adr/adr-NNN-<slug>.md         # platform-level technical decisions (cross-feature)
├── analytics/events.md           # event/telemetry plan — stays GLOBAL (metrics → events)
├── reviews/                      # GLOBAL verification evidence — ON DEMAND (reviewer: per-FRD gate notes; security-auditor: security-audit-vN.md)
└── decision-log.md               # history (two-layer rule, see documentation.md)
```

### The model
- **Two architecture layers — never fuse them.** `product/architecture.md` = platform (stable, ONE per project). `frds/frd-NN/blueprint.md` = how THIS feature is built (per-FRD). A single global `blueprint.md` is an anti-pattern: it becomes a monolith every feature must edit.
- **PRD ↔ FRD = siblings, loosely coupled.** The PRD keeps a living *feature landscape* table; each FRD names its parent PRD in frontmatter. FRDs are **NOT** nested inside the PRD.
- **Work orders live under their FRD.** Each WO implements part of its FRD's acceptance criteria, is a **coarse slice** (one cohesive view/page/capability), and copies its AC inline (the implementer should not have to go look). Order + parallelism live in the per-FRD **Build Plan** in `blueprint.md` (the build engine reads it, DR-050); the `work-orders/README.md` is a human-readable summary of it.
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

## How it is verified
- **Test placement (`_tests/` only)**: structure guard in `verify.sh` (fail-closed).
- **Dead/orphan files**: `knip` in `verify.sh`.
- **Data-layer isolation (`queries/` only)**: fail-closed grep gate in `verify.sh` (stack A) — `new PrismaClient(`/the prisma singleton imported outside `src/queries/` (or `src/lib/prisma.ts`) is RED; type-only imports stay free. Canaried (DR-079).
- **Docs skeleton + stable IDs**: `.pandacorp/doc-lint.sh` (advisory, DR-077) + `reviewer`.
- **Folder conventions, promotion rule**: `reviewer` quality lens (review-only).

## Why
Predictability is the multiplier: agents (and the owner) navigate every project the same way, reuse lands where the next feature will look for it, and the isolated data layer is what keeps business logic testable and migrations tractable. The docs skeleton is the same idea applied to knowledge — feature-centric, additive growth, no restructures.

### Document templates (the base format) — DR-077
Every recurring doc above is generated from a **thin base template** in `plugin/templates/docs/` (PRD, FRD, FDD, architecture, blueprint, ADR, work-order + its README, events, research, design-system, change-request — indexed by that folder's `README.md`). The template is the **single structural contract**: the generating skill follows it and does not re-derive sections. Templates stay thin with explicitly-optional sections (an LLM fills every mandatory section into noise). The template *set* is versioned collectively under `OVERLAY_VERSION` — there is **no per-document version stamp** (provenance lives in `.pandacorp/status.yaml` `created_with`/`overlay_version`). To bring an old doc onto an improved template, **regenerate** it via its owning skill from the still-true upstream — there is **no migration engine**; reserve in-place edits for the rare doc carrying irreplaceable hand-edits. Drift is surfaced by `.pandacorp/doc-lint.sh` (run from `verify.sh`) — **advisory** (it reports missing frontmatter keys + unresolved `REQ→AC→WO` IDs, never blocks, so it can't red-lock an adopted/partial-spine project; fail-closed promotion is a future per-project opt-in).
