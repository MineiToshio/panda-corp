---
id: "FRD-17"
title: "Proposals inbox"
status: "APPROVED"
ui: true
---
# FRD-17 — Proposals inbox

## Overview

Proposals inbox covers proposals inbox. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-17-001 — Lesson reader

- AC-17-001.1 — WHEN the owner opens the screen, the system SHALL show lesson reader.
- AC-17-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-17-002 — Promotion queue

- AC-17-002.1 — WHEN the owner opens the screen, the system SHALL show promotion queue.
- AC-17-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-17-003 — Prune list

- AC-17-003.1 — WHEN the owner opens the screen, the system SHALL show prune list.
- AC-17-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
