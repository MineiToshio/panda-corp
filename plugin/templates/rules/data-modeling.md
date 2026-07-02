---
description: Data modeling — naming, timestamps, deletion policy, enums, N+1 discipline, denormalization, seeds.
applies_when: prisma
globs: ["prisma/**", "src/queries/**"]
source: Pandacorp standard — data-modeling
---

# Data modeling

- Models **singular PascalCase** (`User`, `Order` — never `Users`); fields camelCase; junction models named after the relationship (`Membership`).
- **Explicit relation names** whenever two models relate more than once (`@relation("OrderAuthor")`).
- **Every model carries `createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`)** — no exceptions.
- **Closed value sets are enums** (`status: OrderStatus`), never free strings.
- **Hard delete is the default**, paired with the GDPR erasure path (export/delete are FRD ACs). **Soft delete (`deletedAt`) only with a stated reason in the blueprint** — and then EVERY read path filters it; a leaked soft-deleted row is a defect.
- **N+1**: load relations with `include`/`select` in ONE query in the data layer; **never query inside a loop**. `select` only the needed columns on hot paths.
- **Denormalize only with a measured reason + an ADR** naming what keeps the copy consistent; default normalized.
- Schema changes = versioned, reversible migrations, never edited after applied (see quality-and-testing).
- Seed script (`prisma/seed.ts`): deterministic, minimal, **dev-only** — never against production. Tests use their own factories, not the seed.
