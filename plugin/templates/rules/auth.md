---
description: Authentication & authorization — RBAC from the data model, resource-level checks, cookie sessions, minimal scopes, erasure.
applies_when: better-auth
also_applies_when: [auth, public-web]
globs: ["src/lib/auth/**", "src/app/**", "src/queries/**"]
source: Pandacorp standard — auth
---

# Auth

- **Never hand-roll auth** — no custom password hashing, session stores or token schemes. Better Auth (or the blueprint-approved provider) owns it.
- Roles/permissions come from the **data model declared in the blueprint** (a `role` enum on user/membership); permissions **derive from the role** — no ad-hoc `isAdmin` booleans per feature.
- **Authorize at the resource, in the data layer or action**: after "who are you?", always "may you touch THIS row?" (ownership/membership check). **Hiding a button is not authorization.**
- Every Server Action and route handler **authenticates AND authorizes inside itself** (see nextjs rules) — never assume the calling UI checked.
- Sessions: **cookie sessions with Better Auth defaults** (httpOnly, secure, sameSite) — never tokens in localStorage.
- **OAuth scopes minimal** — request only what the feature actually uses.
- Account deletion triggers the **full erasure path** (export/delete are FRD acceptance criteria — see privacy).

```ts
// BAD — trusts the UI, no resource check
export async function deleteOrder(id: string) { return db.order.delete({ where: { id } }); }
// GOOD — authn + resource-level authz inside
export async function deleteOrder(id: string) {
  const user = await requireUser();
  return deleteOrderOwnedBy(prisma, id, user.id); // queries layer enforces ownership
}
```
