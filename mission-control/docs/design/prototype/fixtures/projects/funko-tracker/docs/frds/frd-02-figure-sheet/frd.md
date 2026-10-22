---
id: "FRD-02"
title: "Figure detail sheet"
status: "APPROVED"
ui: true
---
# FRD-02 — Figure detail sheet

## Overview

Figure detail sheet covers figure detail sheet. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-02-001 — Figure detail route

- AC-02-001.1 — WHEN the owner opens the screen, the system SHALL show figure detail route.
- AC-02-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-002 — Variant switcher on the sheet

- AC-02-002.1 — WHEN the owner opens the screen, the system SHALL show variant switcher on the sheet.
- AC-02-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-003 — Release history table

- AC-02-003.1 — WHEN the owner opens the screen, the system SHALL show release history table.
- AC-02-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
