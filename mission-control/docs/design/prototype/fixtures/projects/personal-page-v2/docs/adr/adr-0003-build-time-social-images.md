---
id: "ADR-0003"
title: "Social images generated at build time"
status: "accepted"
date: "2026-06-29"
---
# ADR-0003 — Social images generated at build time

## Context

A runtime image service adds cost and latency.

## Decision

Render every social image during the build from the post front matter.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
