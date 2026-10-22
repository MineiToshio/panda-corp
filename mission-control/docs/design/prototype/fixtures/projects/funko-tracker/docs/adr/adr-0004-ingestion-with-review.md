---
id: "ADR-0004"
title: "Every catalog load goes through a review queue"
status: "accepted"
date: "2026-10-16"
---
# ADR-0004 — Every catalog load goes through a review queue

## Context

Wrong figure data is the main reason collectors abandon a catalog.

## Decision

Ingestion writes to a staging table; nothing reaches the public catalog without a curator's approval.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
