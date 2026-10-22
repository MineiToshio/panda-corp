---
id: "ADR-0008"
title: "One environment file per environment"
status: "accepted"
date: "2026-10-20"
---
# ADR-0008 — One environment file per environment

## Context

Three overlapping files caused two wrong deploys during the build.

## Decision

Keep one documented `.env.example` and one file per environment, generated from the services directory.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
