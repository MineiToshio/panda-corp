---
id: ADR-0010
status: ACCEPTED
last_updated: 2026-10-22
---

# ADR-0010 — Persistent resource identity and shared URL routing

Date: 2026-10-17. Status: Accepted by owner. v2 note (2026-10-22): the codec and identity decisions stand; URL restoration of an expanded model now restores the inline viewer, since v2 removes the expanded dialog (FRD-25 v2). Agent: Codex (GPT-6 family), with runtime-local delegated implementation and independent verification.

## Decision and reason

Use one pure route codec plus dynamic Next route adapters and URL-owned semantic selection. Persist separate idea/project IDs and readable public slugs in one owner-private factory catalog. Keep aliases reserved; retain the standalone vs Portfolio presentation distinction. Factory lifecycle registration is the only identity writer, never page GET or build status.

Names and folder paths change; deriving every href from the current name breaks bookmarks, and a bare nested query can select a different Portfolio project. Opaque IDs alone avoid collisions but hurt readable links. A persisted slug backed by an immutable ID provides both. No per-project generated route files, routing dependency or browser-global state store is required.

## Trade-offs and boundaries

A moved resource must retain its dedicated reference and be reconciled; unknown locations cannot be inferred from an ID alone. Alias conflicts are explicit errors. Existing data requires previewed non-destructive bootstrap, and its private catalog must be backed up in the vault. A missing catalog supports legacy fixtures/bootstrap; corruption in an existing catalog is not treated as an empty factory. Native fullscreen restoration requires a user gesture; URL restoration uses the existing expanded dialog. Path parsers are bounded and scoped document allowlists remain authoritative.

Canonical contracts: [FRD-25](../frds/frd-25-persistent-navigation/frd.md), [blueprint](../frds/frd-25-persistent-navigation/blueprint.md), [platform architecture](../product/architecture.md).
