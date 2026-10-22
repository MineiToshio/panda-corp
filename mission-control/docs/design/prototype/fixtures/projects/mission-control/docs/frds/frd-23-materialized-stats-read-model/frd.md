---
id: "FRD-23"
title: "Materialized stats read model"
status: "APPROVED"
ui: true
---
# FRD-23 — Materialized stats read model

## Overview

Materialized stats read model covers materialized stats read model. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-23-001 — Stats schema

- AC-23-001.1 — WHEN the owner opens the screen, the system SHALL show stats schema.
- AC-23-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-23-002 — Per-project portada writer

- AC-23-002.1 — WHEN the owner opens the screen, the system SHALL show per-project portada writer.
- AC-23-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-23-003 — Freshness seal

- AC-23-003.1 — WHEN the owner opens the screen, the system SHALL show freshness seal.
- AC-23-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
