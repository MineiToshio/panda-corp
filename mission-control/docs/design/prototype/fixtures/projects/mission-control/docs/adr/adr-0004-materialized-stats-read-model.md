---
id: "ADR-0004"
title: "Materialized stats read model"
status: "accepted"
date: "2026-07-06"
---
# ADR-0004 — Materialized stats read model

## Context

The Informe recomputed git history on every render.

## Decision

Write a per-project portada and a factory-wide store, each sealed and re-derived when stale.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
