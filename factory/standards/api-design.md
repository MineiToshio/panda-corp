# API design

> Domain: Programming · Severity: **MUST** in API/service-type projects (stacks B/C/D; also route handlers of stack A). Enforcement: lint/CI. See DR-028.

## Rule — error contract (RFC 9457)
- HTTP errors return **`application/problem+json`** (RFC 9457, which obsoletes 7807) with the 5 members: `type` (default `about:blank`), `title` (stable except for i18n), `status`, `detail`, `instance`.
- Validation errors with a **custom extension** `errors[]` of `{detail, pointer}` (RFC 9457 allows extensions; this is NOT normative). `pointer` = JSON Pointer (RFC 6901).
- Shared `problem()` helper in the golden path (Next Route Handlers + Python APIs).

## Rule — REST
- Well-named resources, `/v1` versioning, pagination, **standard HTTP codes**.
- **Validation at the boundary before the logic** (Zod / pydantic), which generates these error bodies consistently. (Reuses the boundary-validation convention from `conventions.md`, defining its output.)

## How it is verified
- `verify.sh` / lint asserts the `application/problem+json` content type and the presence of the required members in error responses.

## Why
A standard, machine-readable error contract makes clients (and other agents) handle errors uniformly, instead of ad-hoc strings per endpoint.

Sources: rfc-editor.org/rfc/rfc9457
