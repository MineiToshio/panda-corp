---
id: "FRD-06"
title: "Party"
status: "APPROVED"
ui: true
---
# FRD-06 — Party

## Overview

Party covers party. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-06-001 — Party scene layout

- AC-06-001.1 — WHEN the owner opens the screen, the system SHALL show party scene layout.
- AC-06-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-002 — Agent tokens by station

- AC-06-002.1 — WHEN the owner opens the screen, the system SHALL show agent tokens by station.
- AC-06-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-003 — Live event mapping

- AC-06-003.1 — WHEN the owner opens the screen, the system SHALL show live event mapping.
- AC-06-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
