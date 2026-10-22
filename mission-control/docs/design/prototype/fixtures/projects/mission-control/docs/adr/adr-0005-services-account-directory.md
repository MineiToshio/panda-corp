---
id: "ADR-0005"
title: "Services and accounts directory"
status: "accepted"
date: "2026-10-12"
---
# ADR-0005 — Services and accounts directory

## Context

Projects need to show which service and account each part runs on.

## Decision

Join a public provider catalog, a private accounts file and per-project allocations; never read credentials.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
