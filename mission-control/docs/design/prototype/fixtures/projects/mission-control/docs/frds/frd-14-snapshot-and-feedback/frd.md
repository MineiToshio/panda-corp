---
id: "FRD-14"
title: "Snapshot and feedback"
status: "APPROVED"
ui: true
---
# FRD-14 — Snapshot and feedback

## Overview

Snapshot and feedback covers snapshot and feedback. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-14-001 — Snapshot export

- AC-14-001.1 — WHEN the owner opens the screen, the system SHALL show snapshot export.
- AC-14-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-14-002 — Feedback channel links

- AC-14-002.1 — WHEN the owner opens the screen, the system SHALL show feedback channel links.
- AC-14-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-14-003 — Copy command buttons

- AC-14-003.1 — WHEN the owner opens the screen, the system SHALL show copy command buttons.
- AC-14-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
