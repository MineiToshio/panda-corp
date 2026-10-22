---
id: "FRD-01"
title: "Data reading"
status: "APPROVED"
ui: true
---
# FRD-01 — Data reading

## Overview

Data reading covers data reading. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-01-001 — Factory root resolution

- AC-01-001.1 — WHEN the owner opens the screen, the system SHALL show factory root resolution.
- AC-01-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-002 — Idea card reader

- AC-01-002.1 — WHEN the owner opens the screen, the system SHALL show idea card reader.
- AC-01-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-003 — Portfolio table parser

- AC-01-003.1 — WHEN the owner opens the screen, the system SHALL show portfolio table parser.
- AC-01-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
