---
description: API design — RFC 9457 error contract, REST conventions, boundary validation.
applies_when: nextjs
also_applies_when: [hono, fastapi, api]
globs: ["src/app/api/**", "src/routes/**", "app/api/**"]
source: Pandacorp standard — api-design
---

# API design

## Error contract (RFC 9457) — MUST
- Every 4xx/5xx returns **`application/problem+json`** with `type` (default `about:blank`), `title`, `status`, `detail`, `instance` — via the shared **`problem()` helper** (`src/lib/problem.ts`), never an ad-hoc `{ error: "..." }` body. The gate REDs a route with error statuses and no `problem`.
- Validation errors add an `errors[]` extension of `{detail, pointer}` (JSON Pointer, RFC 6901).

```ts
// BAD — ad-hoc error body, wrong content type
return Response.json({ error: "not found" }, { status: 404 });
// GOOD — the shared contract
return problem(404, "Order not found", { detail: `No order ${id}` });
```

## REST conventions
- Nouns for resources, `/v1` prefix, standard HTTP codes (201 create, 204 delete, 409 conflict).
- Paginate every collection endpoint (cursor or offset — pick one per project and stick to it); return the page info in the body, not headers.
- **Validate at the boundary before any logic** (Zod/pydantic schemas, centralized) — the schema's failure is what produces the 400 problem body.
- Mutations that a client may retry (payments, webhooks) accept an **idempotency key**.
