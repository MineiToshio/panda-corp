---
id: "ADR-0003"
title: "Job queue inside PostgreSQL"
status: "accepted"
date: "2026-10-16"
---
# ADR-0003 — Job queue inside PostgreSQL

## Context

A hosted queue would add a paid service for a handful of jobs per hour.

## Decision

Keep jobs in a table with row locking; revisit if the volume passes a thousand jobs a day.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
