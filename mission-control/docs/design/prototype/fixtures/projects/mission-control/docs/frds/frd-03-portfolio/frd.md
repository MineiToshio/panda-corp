---
id: "FRD-03"
title: "Portfolio"
status: "APPROVED"
ui: true
drift:
  - "REQ-03-002"
  - "AC-03-001.2"
---
# FRD-03 — Portfolio

## Overview

Portfolio covers portfolio. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-03-001 — Portfolio rail with phases

- AC-03-001.1 — WHEN the owner opens the screen, the system SHALL show portfolio rail with phases.
- AC-03-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-002 — Release snapshot columns

- AC-03-002.1 — WHEN the owner opens the screen, the system SHALL show release snapshot columns.
- AC-03-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-003 — Last sync formatting

- AC-03-003.1 — WHEN the owner opens the screen, the system SHALL show last sync formatting.
- AC-03-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
