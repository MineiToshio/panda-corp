---
id: "FRD-07"
title: "Configuration"
status: "APPROVED"
ui: true
---
# FRD-07 — Configuration

## Overview

Configuration covers configuration. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-07-001 — Skills catalog

- AC-07-001.1 — WHEN the owner opens the screen, the system SHALL show skills catalog.
- AC-07-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-07-002 — Agents catalog

- AC-07-002.1 — WHEN the owner opens the screen, the system SHALL show agents catalog.
- AC-07-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-07-003 — Decision rules list

- AC-07-003.1 — WHEN the owner opens the screen, the system SHALL show decision rules list.
- AC-07-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
