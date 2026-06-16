# Feature-centric documentation structure — the FRD as a self-contained module

> Drafted 2026-06-16 from a comparative evaluation of three real working systems:
> our current factory structure, the **JobLeap "context repo"** (`0-jobleap-company-context`,
> a mature 17-FRD / 3-repo product line), and **PandaTrack** (a Pandacorp project that already
> nests deeper than the standard). The owner asked which file/folder model should become the
> factory-wide standard, optimizing for: separation of concerns, easy navigation, fast lookup,
> and **scaling from small MVP to large corporate product without restructuring**.
>
> **ADOPTED 2026-06-16 as DR-049.** The owner approved the full package (**structure + stable-ID
> traceability**). The canonical standard is now `factory/standards/structure.md` ("Documentation
> structure") + `factory/standards/documentation.md`; the policy is **DR-049**
> (`factory/decisions/registry.yaml`); the history is in `factory/decision-log.md` (2026-06-16). This
> document is kept as the rationale/design record. Implementation: MAJOR plugin bump (skills +
> party agents + templates rewritten to the feature-centric paths) + Mission Control docs migrated.

## Central thesis

Our current docs model groups artifacts **by type** (all FRDs together, one global `blueprint.md`,
one flat `work-orders/`). That is comfortable for a 3–8 FRD MVP and has a hard ceiling: a single
global blueprint becomes a monolith every feature must edit, and a flat work-order pool loses the
"which feature does this belong to" grouping. Growth forces a painful migration from flat to nested
*mid-project*.

The fix is to group **by feature**: each FRD becomes a **self-contained module folder** carrying its
own design, blueprint, work orders and mocks — plus a thin, stable **product layer** (PRD + global
architecture + design system) above it. The same folder *shape* serves a 3-FRD MVP and a 40-FRD
platform; what scales is **how much of the shape you fill** (progressive disclosure), not the shape
itself. Paired with **stable IDs** for end-to-end traceability, this is the structure that survives
a product growing from weekend-MVP to corporate platform without ever being restructured.

This is a direct application of a principle the factory already holds: **locality of change**
(`structure.md`: "code by feature", the promotion rule). We enforce it in `src/`; we should enforce
it in `docs/` too.

## 1. The three models compared (as they exist on disk today)

### A) Pandacorp today — organized *by type* (flat)
```
docs/
├── prd.md                      # 1 global
├── frds/frd-NN-*.md            # N loose files
├── design/ (design-tokens.json, mockups/, references.md) + DESIGN.md (root)   # 1 global system
├── blueprint.md                # 1 GLOBAL — the whole architecture in one file
├── adr/adr-*.md
├── analytics/events.md
├── work-orders/wo-NN-*.md      # N GLOBAL — many-to-many with FRDs
└── decision-log.md
```
**Model:** one global blueprint, one global work-order pool, many-to-many WO↔FRD. Single MVP-centric
PRD. Fine for small/medium; no growth path that doesn't require restructuring.

### B) JobLeap — organized *by feature*, FRD-as-module (the reference we liked)
```
docs/products/<product>/
├── overview.md · glossary.md · context-pack.md · architecture.md   # PRODUCT layer
├── prds/prd-NNN-*.md           # PRD = vision + a living "feature landscape" table of FRDs
└── frds/
    └── frd-NNN-<slug>/         # each FRD is a self-contained module
        ├── frd.md
        ├── fdd.md              # design companion for THIS feature (conditional: only if it has UI)
        ├── blueprint.md        # implementation design for THIS feature (splits into a blueprints/ folder when large)
        ├── references/         # dev-plan.md, prototype.html, mockups/*.jpg  (per-feature)
        └── work-orders/WO-XX-NNN-*.md   # per-feature; each WO targets exactly ONE repo
```
Verified key facts:
- **`prds/` and `frds/` are SIBLINGS, not nested.** An FRD links to its PRD by id + a *feature
  landscape* table the PRD keeps alive. This loose coupling lets one feature serve multiple
  PRDs/versions without moving folders.
- They **separate two layers of architecture**: `architecture.md` at the product level (stack, data
  model, service boundaries, deploy — stable, one per product) **vs** `blueprint.md` per FRD (how
  *this* feature is built). We conflate both into one file.
- **Stable-ID traceability:** `REQ-XX-001 → AC-XX-001.1 → CMP-XX-Y / IF-XX-Z → WO-XX-001 → tests`,
  cited downstream without silent renaming, under a declared source-of-truth hierarchy
  `FRD > FDD > Figma > blueprint > work order`. Changes flow back upstream in that order
  (behavior→FRD, visual/copy→FDD, architecture→blueprint, scope→WO).
- Mocks (HTML prototype + JPG screenshots) live in `references/` **inside the FRD folder**;
  the design *system* stays at product level.

### C) PandaTrack — nests deeper (rejected as the model)
```
docs/product/
└── prd-NN-<slug>/
    ├── prd-NN-<slug>.md
    └── frd-NN-<slug>/                 # FRDs nested INSIDE the PRD
        └── bp-NN-<slug>/             # blueprint as a FOLDER per "pillar"
            └── work-orders/
```
FRDs nested under the PRD, and blueprint-as-folder. More moving parts, false 1:1 PRD↔FRD ownership,
folders must be moved when scope shifts. The owner finds it messier — correctly.

## 2. The diagnosis: there are *two* layers of architecture

The real axis is not "flat vs nested". It is **by-type vs by-feature**, and one fact almost nobody
separates:

| Layer | What it covers | Volatility | Cardinality |
|---|---|---|---|
| **Platform architecture** | stack, data model, deploy, cross-cutting concerns, service boundaries | stable | ONE per project |
| **Feature architecture** | how *this* screen/flow/endpoint is implemented | volatile | ONE per FRD |

Our single `blueprint.md` **fuses both**. JobLeap splits them (`architecture.md` global +
`blueprint.md` per FRD). **That split is exactly why their system scales and ours doesn't.** With 5
features a single blueprint is fine; at 30 it is a monolith every feature must edit (merge
contention, unbounded growth, stable mixed with volatile). The by-feature model gives **locality of
change**: adding a feature = adding one folder, and *nothing else moves*.

## 3. Proposed standard

### 3.1 The folder shape (the standard for every Pandacorp project)
```
docs/
├── product/
│   ├── prd.md                  # vision, users, metrics, scope — + a LIVING "feature landscape" table
│   ├── architecture.md         # PLATFORM architecture: stack, data model, deploy, cross-cutting
│   ├── context-pack.md         # cross-feature shared semantics (state machines, conventions) — on demand
│   ├── glossary.md             # canonical terminology — on demand
│   └── research.md             # product research (market, competitors, viability)
├── design/                     # the GLOBAL design system (our PDD equivalent) — ONE per project
│   ├── design-tokens.json      # palette, type, spacing, radii (the frozen contract)
│   ├── references.md · voice-and-tone.md · a11y-report.md
│   └── (DESIGN.md stays at repo root — the frozen design contract)
├── frds/
│   └── frd-NN-<slug>/          # each FRD = a self-contained MODULE
│       ├── frd.md              # REQ-NN-NNN / AC-NN-NNN.N  (NN = the FRD folder number; the user contract)
│       ├── fdd.md              # CONDITIONAL: only when the feature has UI
│       ├── blueprint.md        # feature implementation design — references product/architecture.md
│       │                       #   (when it grows: promote to a blueprints/ FOLDER split by coherent
│       │                       #    concern, e.g. blueprints/{data-model,api,sync}.md — NOT "pillars")
│       ├── mocks/              # CONDITIONAL: HTML prototypes + screenshots for THIS feature
│       └── work-orders/
│           ├── README.md       # this feature's WO list + order + parallelism
│           └── wo-NN-<slug>.md # each WO copies in its AC and cites its REQ IDs
├── adr/adr-*.md                # platform-level technical decisions (cross-feature)
├── analytics/events.md         # event plan — stays global (metrics → events)
└── decision-log.md             # history (the two-layer rule is unchanged)
```

### 3.2 Decisions that resolve the owner's three questions
1. **`prds`/PRD and `frds/` are siblings — FRDs are NOT nested inside the PRD.** (JobLeap, not
   PandaTrack.) The PRD owns a *feature landscape* table that lists its FRDs; the FRD names its
   parent PRD in frontmatter. Loose coupling, no folder moves when scope shifts. *(For single-PRD
   MVPs `product/prd.md` is one file; multi-PRD products promote to `product/prds/prd-NN-*.md`
   — same shape, more filled.)*
2. **Design: two layers — and there is NO separate PDD file.** The PDD (product design document)
   *is* the **`docs/design/` folder**: `design-tokens.json` + root `DESIGN.md` + `references.md` /
   `voice-and-tone.md` play exactly the role JobLeap's PDD plays — the product-level design system,
   ONE per project, never duplicated per feature. Below it, a **per-FRD `fdd.md`, conditional** — only
   when the feature has UI. Backend-only FRDs carry no FDD. So: `design/` = product design system
   (the PDD); `frd-NN/fdd.md` = that feature's design.
3. **Mocks live inside the FRD** (`frds/frd-NN/mocks/`). The HTML prototypes for a feature travel
   with the feature; the design *system* stays at product level.

### 3.3 Stable-ID traceability (the part that actually makes it scale)
Adopt JobLeap's ID chain and source-of-truth hierarchy. This is more valuable than the folder tree:
without it you get folders without the traceability payoff.

- **IDs (DECIDED 2026-06-16 — numeric, folder-derived):** `REQ-NN-NNN` (requirement) →
  `AC-NN-NNN.N` (acceptance criterion) → `CMP-NN-<slug>` / `IF-NN-<slug>` (blueprint component /
  interface) → `WO-NN-NNN` → test ids. **`NN` is the FRD folder number** (`frd-05-order-payment` →
  `REQ-05-001`), so the ID is auto-derivable with no separate prefix registry to maintain; the
  human-readable name lives in the folder slug, not the ID. (Rejected the JobLeap 2-letter feature
  code e.g. `OP`=order-payment — too cryptic, needs a mapping.) IDs are **stable references**: the
  folder number never changes once assigned, cited downstream, never silently renamed.
- **Source-of-truth hierarchy (declared in every blueprint and WO):**
  `FRD > FDD > design-tokens > blueprint > work order`.
- **Upstream propagation:** behavior change → FRD; visual/copy → FDD; architecture → blueprint;
  scope/paths → WO. This *is* our existing two-layer documentation rule, made structural.
- **Each WO targets exactly one deploy unit/repo** and copies in its AC (the implementer should not
  have to go look for them — already our `work-orders` rule).

### 3.4 Progressive disclosure (the part that makes it work for *small* too)
The folder **shape is constant; depth scales with the project.** Folders are created on demand, never
pre-stubbed.

| Project size | What gets filled |
|---|---|
| **Weekend MVP (3 FRDs)** | each FRD: `frd.md` + `blueprint.md` + `work-orders/`. Global design system. No FDD, no context-pack, no glossary. `blueprint.md` may be thin and lean on `product/architecture.md`. |
| **Medium product (8–15 FRDs)** | add `fdd.md` + `mocks/` to UI features; `context-pack.md` appears once shared semantics emerge. |
| **Large/corporate (30+ FRDs, multi-repo)** | every FRD fully populated; a heavy `blueprint.md` promotes to a `blueprints/` folder split by coherent concern; `product/prds/` promoted to multiple PRDs; `architecture.md` carries the platform; WOs tagged by repo. |

You **never restructure** as a project grows — you fill more of the same shape. That is precisely
what the current flat model cannot do.

### 3.5 The standard is a base skeleton, not a cage
The named parts are a **contract** so the skills and Mission Control can rely on them
(`docs/frds/frd-NN/`, `product/`, `design/`, the ID convention, the source-of-truth hierarchy). Beyond
that contract a project **may add its own folders** when a real need shows up (e.g. `docs/runbooks/`,
`docs/db/`, `docs/security/`, a feature's `references/`). The rule is additive: extend the skeleton,
don't fight it — don't rename or relocate the contract parts. New folders that recur across projects
are candidates to graduate into the standard later (via `learn`).

## 4. Migration plan (on approval)

1. **Rewrite `factory/standards/structure.md`** with the new `docs/` model + the ID convention; add
   the source-of-truth hierarchy to `factory/standards/documentation.md`.
2. **Record a decision rule** in `factory/decision-log.md` and, for the ID/hierarchy policy, a
   default in `factory/decisions/registry.yaml`.
3. **Adapt the skills** (MAJOR plugin bump): `spec` (writes `product/prd.md` + per-FRD folders),
   `design` (global system + per-FRD `fdd.md`/`mocks/`), `blueprint` (splits `product/architecture.md`
   from per-FRD `blueprint.md`), `work-orders` (per-FRD `work-orders/`), `implement` (walk
   `docs/frds/*/work-orders/*.md` + cross-FRD ordering, instead of the flat `docs/work-orders/` glob),
   `iterate` (a new feature = a new FRD module).
4. **Mission Control:** update doc-reading (where it finds blueprint/work-orders/phase) and the
   Manual (DR-046) so the Reference reflects the new structure.
5. **`upgrade` skill** migrates existing projects: `cotizapdf`, `pandatrack` (flatten its
   blueprint-as-folder into the standard FRD module), and Mission Control's own `docs/`.
6. **Pilot first:** validate the standard on **one** real project before mass migration.

## 5. Costs and risks (honest)

- **Not a tweak — a MAJOR plugin change** touching 6 skills, Mission Control, templates, and a
  migration story for live projects.
- **`implement` is the riskiest change:** today it globs a flat `docs/work-orders/`; per-FRD WOs
  require it to walk per-feature folders and resolve **cross-FRD ordering**. Real work, doable.
- **Over-structure risk for tiny work:** mitigated by progressive disclosure (on-demand folders,
  thin files allowed) — but it must be enforced, or a 3-FRD MVP drowns in empty folders.
- **The ID discipline is the expensive habit:** folders are cheap; keeping IDs stable and propagating
  changes upstream is the discipline that pays off only if `reviewer`/CI enforce it (it extends the
  existing two-layer-doc check, so the enforcement point already exists).

## 6. Recommendation

**Adopt the JobLeap arrangement** (FRD-as-module, siblings not nested, global `architecture.md`
separate from per-FRD `blueprint.md`, global design system + conditional FDD, per-FRD mocks)
**plus stable-ID traceability**, governed by **progressive disclosure**. Reject PandaTrack's deeper
nesting. Roll out via: rewrite the standard → pilot on one project → migrate the rest with `upgrade`.

The owner's scaling intuition is correct and worth acting on: the flat model is comfortable but
capped; this model lets the factory birth something small that can become large **without ever being
restructured** — the right default for a factory whose products are meant to grow.

## Resolved by the owner (2026-06-16)

- **ID scheme → numeric, folder-derived** (`frd-05` → `REQ-05-001`). See §3.3. The JobLeap 2-letter
  code was rejected as too cryptic.
- **Pilot target → deferred.** Mission Control is built first regardless; the owner will pick which
  project *launches* on the new structure later. For now: document the standard fully, don't force a
  pilot. *(The model is "one structure, two fill levels" — small and large are not two structures;
  a project grows by addition, never by restructure — see §3.4 + the small→large transition.)*

## Still-open questions

1. **`analytics/events.md`:** keep global (recommended — metrics are product-level), or also split
   per-FRD?
2. **`product/prd.md` single-file vs `product/prds/` folder:** start single and promote on demand
   (recommended), or always a folder?
