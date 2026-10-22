---
id: "ADR-0005"
title: "Store a licence and a source for every image"
status: "accepted"
date: "2026-10-16"
---
# ADR-0005 — Store a licence and a source for every image

## Context

Official images are not ours to redistribute freely.

## Decision

Each image row carries its source URL, licence and review date; unlicensed images render as a placeholder.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
