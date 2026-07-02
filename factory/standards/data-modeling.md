# Data modeling

> Domain: Data · Severity: **MUST** (naming, timestamps, deletion policy, N+1) / **SHOULD** (denormalization, seeds) · Enforcement: blueprint readiness gate (DR-100) + `reviewer` correctness lens + the migration gates in `quality.md`. Operative form: `rules/data-modeling.md` (DR-051).

## Rule — entities & naming
- Models **singular PascalCase** (`User`, `Order` — never `Users`); fields camelCase; join/junction models named after the relationship (`Membership`, not `UserOrganization` unless that IS the domain word).
- **Explicit relation names** whenever two models relate more than once (`@relation("OrderAuthor")`) — never rely on inferred disambiguation.
- **Every model carries `createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`).** No exceptions — they cost nothing and every incident/debug session wants them.
- **Closed value sets are enums** (`status: OrderStatus`), never free strings — a magic-string state is unqueryable and untypeable. Free string only when the set is genuinely open/user-defined.

## Rule — deletion policy
- **Hard delete is the default**, paired with the GDPR erasure path ([privacy.md](privacy.md) — export/delete are FRD ACs).
- **Soft delete (`deletedAt`) only with a stated reason in the blueprint** (audit trail, restore window, referential displays) — and then **every read path filters it** (a soft-deleted row leaking into a list is a defect). Never both patterns ad-hoc in one model.

## Rule — query discipline (N+1)
- Relations load via **`include`/`select` in one query** inside the data layer (`queries/` — isolation is canonical in [structure.md](structure.md), STRUCT-2); **never query inside a loop**.
- `select` only the needed columns on hot paths; don't drag whole rows into list views.

## Rule — denormalization & evolution
- **Default normalized. Denormalize only with a measured reason** (a real, observed query cost) **recorded as an ADR** naming what keeps the copy consistent.
- Schema evolution = versioned, reversible migrations — canonical in [quality.md](quality.md) (Data migrations, QUAL-11); don't restate here.

## Rule — seed data
- The repo carries a **deterministic, minimal seed script** (`prisma/seed.ts`) for dev bootstrap; it never runs against production. Tests don't use the seed — they use their own factories/fixtures (`src/test/`, [structure.md](structure.md)).

## How it is verified
- **Data model shape (naming, timestamps, enums, deletion policy declared)**: the blueprint readiness gate (DR-100 — a fresh reviewer checks the data model has no TBD) + the `architect`'s data-model section; deviations at build time → `reviewer` correctness lens (review-only).
- **N+1 / query discipline**: `reviewer` correctness lens over `queries/` diffs (review-only); the isolation substrate is the wired STRUCT-2 grep gate.
- **Denormalization ADR**: `reviewer` checks the ADR exists when a derived copy appears (review-only).
- **Migrations**: the wired/manual gates in quality.md (QUAL-11).

## Why
The schema is the one artifact every feature builds on and the most expensive to fix later. Fixed conventions (singular, timestamps, enums) make every project's model instantly legible to any agent; an explicit deletion policy and one-query relation loading prevent the two classic silent failures — leaked "deleted" rows and N+1 collapse under real data.
