---
id: "ADR-0001"
title: "Platform stack on the golden path"
status: "accepted"
date: "2026-10-15"
---
# ADR-0001 — Platform stack on the golden path

## Context

The product is a read-heavy web app with a small write surface.

## Decision

Next.js App Router with Drizzle on serverless PostgreSQL; previews per branch.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
