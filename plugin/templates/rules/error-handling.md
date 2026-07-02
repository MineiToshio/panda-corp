---
description: Error handling — expected vs unexpected taxonomy, typed results, never swallow, honest failure.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
source: Pandacorp standard — error-handling
---

# Error handling

- **Expected/domain failures** (validation, not-found, conflict, unauthorized) are control flow: handle in-flow with **typed results/states** rendered as designed UI states. **Unexpected errors** (bugs, broken invariants, infra) propagate to the boundary and reach Sentry — don't pre-catch them.
- **Never swallow an error.** No empty `catch`, no catch-log-and-continue that turns failure into silence. A reader that can't parse its source fails loud — never returns `[]` (see quality-and-testing).
- **Server Actions return typed results** for expected failures (`{ ok: true, data } | { ok: false, error }`) — don't `throw` them (production masks messages, the client loses the type). Route handlers use the `problem()` contract (see api-design).
- Every surface designs its **error state** showing the domain message/action — never a raw exception string. The global error net (`global-error`/`error`/`not-found`) must exist (see nextjs rules).
- **Retries live at the outermost caller only**, idempotent operations only (see resilience) — never nested.

```ts
// BAD — swallowed; failure becomes silence
try { await syncOrders() } catch {}
// GOOD — typed result the caller must handle
const res = await syncOrders();
if (!res.ok) return { ok: false as const, error: res.error };
```
