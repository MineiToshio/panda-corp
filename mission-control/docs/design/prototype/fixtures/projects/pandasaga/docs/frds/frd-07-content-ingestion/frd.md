---
id: "FRD-07"
title: "Content ingestion"
status: "APPROVED"
ui: false
---
# FRD-07 — Content ingestion

## Overview

Content ingestion covers content ingestion. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-07-001 — Ingestion source registry

- AC-07-001.1 — WHEN the owner opens the screen, the system SHALL show ingestion source registry.
- AC-07-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-07-002 — Ingestion skill entry point

- AC-07-002.1 — WHEN the owner opens the screen, the system SHALL show ingestion skill entry point.
- AC-07-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-07-003 — Draft bundle from a source

- AC-07-003.1 — WHEN the owner opens the screen, the system SHALL show draft bundle from a source.
- AC-07-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
