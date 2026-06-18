---
description: Prisma data layer — queries isolated by model, naming, dependency injection, transactions.
applies_when: prisma
globs: ["src/queries/**", "prisma/**", "**/*.ts"]
source: Pandacorp stack — Prisma
---

# Prisma (data layer)

- **All Prisma queries live in the data layer** (`queries/`, one file per model) — never call Prisma from components, pages, layouts, Server Actions or route handlers.
- **Naming**: `getXByY` for lookups (`getJobBySlug`), `createX`, `updateX`, `deleteX`.
- **Use Prisma-generated types** for inputs and return values; don't redefine schema shapes by hand.
- **Dependency injection**: accept the Prisma client as the **first argument** so queries are unit-testable.
- **Transactions**: multi-step writes that must all succeed or all fail go through `prisma.$transaction`.
- Handle expected failures gracefully (e.g. return `null`/`[]` on a not-found lookup) rather than letting the whole render crash.
