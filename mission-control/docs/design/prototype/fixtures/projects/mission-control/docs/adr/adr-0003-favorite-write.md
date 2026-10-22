---
id: "ADR-0003"
title: "Favourite flag as a bounded write"
status: "accepted"
date: "2026-06-20"
---
# ADR-0003 — Favourite flag as a bounded write

## Context

The owner wants to pin ideas on the board.

## Decision

Write a boolean `favorite` on the idea card only, from one explicit action.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
