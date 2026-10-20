# ADR-0011 — Separate public service recipes from private account identities

- Date: 2026-10-20
- Status: Accepted by owner
- Runtime: Codex, native attended implementation

## Decision

Keep reusable service policy in a committed factory catalog, identity/plan/dated quota observations in the private vault, and integration/resource links in each project's private `.pandacorp/accounts/services.yaml`. Join through stable provider/account/project IDs at read time. Mission Control provides global and scoped directory views and public Manual recipes; it never creates accounts, issues keys, calls cloud services or mutates registries on render.

## Why and trade-offs

A shared account can serve several applications without duplicated identity records. Public policy remains shareable while personal emails stay outside public Manual content. Missing files and unverified observations are visible, so a dependency is never represented as a verified deployment. Local files need intentional reconciliation through architecture rather than cloud polling; the display explicitly dates that evidence.

The global selection uses a query parameter rather than `/portfolio/accounts`, preserving the existing dynamic project slug namespace. Stable HTTPS dashboards may include a non-secret project selector; credential-bearing URLs fail closed. Environment isolation follows provider policy; shared Google OAuth clients do not imply shared application data.
