---
id: "ADR-0002"
title: "Guest contexts merged into magic-link accounts"
status: "accepted"
date: "2026-10-15"
---
# ADR-0002 — Guest contexts merged into magic-link accounts

## Context

Readers should start without an account.

## Decision

A device-bound guest context stores progress; signing in merges it, keeping the furthest chapter.

## Consequences

The choice is reversible at the next version; the blueprint records the migration path.
