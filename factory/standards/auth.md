# Authentication & authorization

> Domain: Security · Severity: **MUST** · Enforcement: blueprint review (STACK-3 human gate) + `reviewer`/adversarial tests (PAT-2) + `security-auditor` hardening checklist. Operative form: `rules/auth.md` (DR-051).

## Rule — never homemade
- **Never hand-roll auth** — no custom password hashing, session stores or token schemes (constitution §12, STACK-3). **Better Auth is the golden path**; a different provider is a blueprint decision with an ADR.

## Rule — roles & permissions (RBAC by default)
- Roles/permissions are **declared in the blueprint's data model**: a `role` enum on the user (or on the membership for multi-tenant apps). Permissions **derive from the role**; no ad-hoc `isAdmin` booleans sprinkled per feature.
- The blueprint states **who can do what per resource** — the authz matrix is a design artifact, not something discovered at implementation time.

## Rule — authorize at the resource, in the code that acts
- **Resource-level authz checks live in the data layer or the action** — check ownership/membership before reading or mutating. **Hiding a button is not authorization**; UI-only gating is a vulnerability, not a control.
- Every Server Action and route handler **authenticates AND authorizes inside itself** — canonical in [patterns.md](patterns.md) (PAT-2); this standard adds the resource-level half: after "who are you?", always "may you touch THIS row?".

## Rule — sessions & OAuth
- **Cookie sessions with Better Auth defaults** (httpOnly, secure, sameSite) — never tokens in localStorage, never a custom session TTL scheme without an ADR.
- **OAuth scopes minimal**: request only the scopes the feature actually uses; widening scopes later is a deliberate change, not a default.

## Rule — account deletion
- Account deletion triggers the **full erasure path** — export/delete are FRD acceptance criteria, canonical in [privacy.md](privacy.md) (PRIV-2).

## How it is verified
- **No homemade auth / provider choice**: blueprint review (STACK-3, owner-approved ADR — human gate).
- **RBAC declared in the data model**: the blueprint readiness gate (DR-100 fresh-reviewer check: the authz matrix and role enum exist, no TBD) — named manual step.
- **Resource-level authz in actions/data layer**: `reviewer` correctness lens + the adversarial tests (DR-015) that call actions as the wrong user — the top finding class (PAT-2).
- **Session config, minimal scopes**: `security-auditor` hardening checklist (named manual step).
- **Erasure path**: FRD gate on the export/delete ACs (PRIV-2).

## Why
Unauthorized Server Actions and UI-only gating are the most common real vulnerability class in AI-built apps. Declaring RBAC in the schema and checking at the resource makes authorization structural — verifiable at the gate — instead of a per-feature memory test.
