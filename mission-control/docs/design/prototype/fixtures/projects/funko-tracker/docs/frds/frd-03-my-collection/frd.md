---
id: "FRD-03"
title: "Account and private collection"
status: "APPROVED"
ui: true
---
# FRD-03 — Account and private collection

## Overview

Account and private collection covers account and private collection. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-03-001 — Email sign-in with magic links

- AC-03-001.1 — WHEN the owner opens the screen, the system SHALL show email sign-in with magic links.
- AC-03-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-002 — Collection item model and migrations

- AC-03-002.1 — WHEN the owner opens the screen, the system SHALL show collection item model and migrations.
- AC-03-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-003 — Mark as owned from any card

- AC-03-003.1 — WHEN the owner opens the screen, the system SHALL show mark as owned from any card.
- AC-03-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
