---
id: "ADR-0005"
title: "Deployment and CI"
status: "accepted"
date: "2026-10-16"
---
# ADR-0005 — Deployment and CI

## Context

Bundles must be checked before they reach readers.

## Decision

CI validates bundle schema and spoiler boundaries; the free hosting tier deploys previews per branch.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
