---
id: "ADR-0007"
title: "Reader-scoped rendering and caching"
status: "accepted"
date: "2026-10-16"
---
# ADR-0007 — Reader-scoped rendering and caching

## Context

Filtering in the browser would send spoilers over the wire.

## Decision

Filter on the server by chapter; cache responses per work and chapter, never per reader.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
