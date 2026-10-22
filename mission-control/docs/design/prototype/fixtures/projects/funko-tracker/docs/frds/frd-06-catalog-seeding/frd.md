---
id: "FRD-06"
title: "Initial catalog load"
status: "APPROVED"
ui: false
---
# FRD-06 — Initial catalog load

## Overview

Initial catalog load covers initial catalog load. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-06-001 — Source registry and licences

- AC-06-001.1 — WHEN the owner opens the screen, the system SHALL show source registry and licences.
- AC-06-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-002 — Ingestion run journal

- AC-06-002.1 — WHEN the owner opens the screen, the system SHALL show ingestion run journal.
- AC-06-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-003 — Franchise backfill command

- AC-06-003.1 — WHEN the owner opens the screen, the system SHALL show franchise backfill command.
- AC-06-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
