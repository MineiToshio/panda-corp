---
id: "ADR-0001"
title: "Stack: Next.js on managed PostgreSQL with a separate worker"
status: "accepted"
date: "2026-10-16"
---
# ADR-0001 — Stack: Next.js on managed PostgreSQL with a separate worker

## Context

The catalog must load fast on phones and the checklist images take seconds to render.

## Decision

Use the golden path (Next.js App Router, Drizzle, managed PostgreSQL) and move image rendering to a small worker that polls a queue stored in the database.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
