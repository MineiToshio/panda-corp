# Error handling

> Domain: Programming · Severity: **MUST** · Enforcement: CI gate (`problem()` grep gate, error-net file presence, DR-078 malformed-fixture tests) + `reviewer` correctness lens. Operative form: `rules/error-handling.md` (DR-051).

## Rule — taxonomy: expected vs unexpected
- **Expected/domain failures** (validation, not-found, conflict, unauthorized, a declined payment) are **control flow**: handled in-flow with typed results/states, rendered as designed UI states. They never go to Sentry — they are not incidents.
- **Unexpected errors** (bugs, broken invariants, infra failures) **propagate** to the error boundary and reach **Sentry** (PII-redacted — see `privacy.md`). Don't pre-catch them just to rethrow or log.
- **Never swallow an error.** No empty `catch`, no catch-log-and-continue that turns failure into silence. A reader that can't parse its source fails loud, never returns `[]` — the fail-loud boundary rule is canonical in [quality.md](quality.md) (DR-078).

## Rule — propagation by layer
- **Server Actions return typed results** for expected failures (`{ ok: true, data } | { ok: false, error }` with an error code the UI can render) — don't `throw` them: production masks thrown messages and the client loses the type.
- **Route handlers** return the RFC 9457 `problem()` contract — canonical in [api-design.md](api-design.md).
- **Data layer**: expected-absent → `null`/typed variant; an unreadable/unparseable source → throw or an explicit `unreadable` error (DR-078), never a silent empty value.

## Rule — UI error states & the error net
- Every surface designs its **error state** and the global error net (`global-error`/`error`/`not-found`) exists — both canonical in [patterns.md](patterns.md) (PAT-7/PAT-8); this standard adds only: the error state renders the domain error's message/action, never a raw exception string.

## Rule — retries & third-party degradation
- **Retries live at the outermost caller only** and only for idempotent operations; a third-party failure degrades gracefully instead of crashing the core flow — both canonical in [resilience.md](resilience.md). Don't re-handle here what resilience owns.

## How it is verified
- **Route-handler contract**: the `problem()` grep gate in `verify.sh` (wired via api-design, API-1).
- **Error net presence**: file-presence check in `verify.sh` (wired via patterns, PAT-8).
- **Fail-loud boundaries**: malformed-fixture + parser property tests (wired via quality, QUAL-9).
- **Taxonomy, typed Server-Action results, no swallowed errors**: `reviewer` correctness lens (review-only) — an empty `catch` or a thrown expected failure is a blocking finding; adversarial tests exercise the failure paths (DR-015).

## Why
AI builders systematically ship the happy path and improvise failure (DR-100's "production 20%"). A fixed taxonomy — expected = typed control flow, unexpected = boundary + Sentry, silence = forbidden — makes every failure either designed or visible, never lost.

## Example
```ts
// BAD — swallowed; failure becomes silence
try { await syncOrders() } catch {}
// GOOD — typed result the caller must handle
const res = await syncOrders();
if (!res.ok) return { ok: false as const, error: res.error };
```
