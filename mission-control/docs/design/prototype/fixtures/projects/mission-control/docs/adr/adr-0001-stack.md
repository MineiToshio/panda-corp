---
id: "ADR-0001"
title: "Stack: Next.js reading local files"
status: "accepted"
date: "2026-06-15"
---
# ADR-0001 — Stack: Next.js reading local files

## Context

The dashboard only reads files that the factory and its projects already write.

## Decision

A local Next.js app with Server Components reading the factory root; no database, no network calls.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
