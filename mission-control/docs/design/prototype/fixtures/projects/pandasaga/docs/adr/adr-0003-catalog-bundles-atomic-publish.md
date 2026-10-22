---
id: "ADR-0003"
title: "Catalog as versioned bundles with atomic publish"
status: "accepted"
date: "2026-10-15"
---
# ADR-0003 — Catalog as versioned bundles with atomic publish

## Context

Half-published works would leak or hide content inconsistently.

## Decision

A bundle is validated and published in one transaction; previous versions are kept 30 days.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
