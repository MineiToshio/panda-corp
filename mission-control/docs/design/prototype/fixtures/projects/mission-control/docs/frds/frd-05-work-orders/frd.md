---
id: "FRD-05"
title: "Work orders"
status: "APPROVED"
ui: true
---
# FRD-05 — Work orders

## Overview

Work orders covers work orders. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-05-001 — Work-order discovery

- AC-05-001.1 — WHEN the owner opens the screen, the system SHALL show work-order discovery.
- AC-05-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-002 — Kanban by state

- AC-05-002.1 — WHEN the owner opens the screen, the system SHALL show kanban by state.
- AC-05-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-003 — Work-order detail tabs

- AC-05-003.1 — WHEN the owner opens the screen, the system SHALL show work-order detail tabs.
- AC-05-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
