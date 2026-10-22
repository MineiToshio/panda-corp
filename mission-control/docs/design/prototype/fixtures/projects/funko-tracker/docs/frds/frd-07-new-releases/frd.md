---
id: "FRD-07"
title: "New releases watch"
status: "APPROVED"
ui: false
---
# FRD-07 — New releases watch

## Overview

New releases watch covers new releases watch. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-07-001 — Hourly delta check

- AC-07-001.1 — WHEN the owner opens the screen, the system SHALL show hourly delta check.
- AC-07-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-07-002 — New release digest

- AC-07-002.1 — WHEN the owner opens the screen, the system SHALL show new release digest.
- AC-07-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
