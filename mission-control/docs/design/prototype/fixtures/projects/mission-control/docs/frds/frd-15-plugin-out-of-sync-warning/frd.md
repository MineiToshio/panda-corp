---
id: "FRD-15"
title: "Plugin out-of-sync warning"
status: "APPROVED"
ui: true
drift: "REQ-15-001"
---
# FRD-15 — Plugin out-of-sync warning

## Overview

Plugin out-of-sync warning covers plugin out-of-sync warning. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-15-001 — Installed version reader

- AC-15-001.1 — WHEN the owner opens the screen, the system SHALL show installed version reader.
- AC-15-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-15-002 — Source version reader

- AC-15-002.1 — WHEN the owner opens the screen, the system SHALL show source version reader.
- AC-15-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-15-003 — Drift banner

- AC-15-003.1 — WHEN the owner opens the screen, the system SHALL show drift banner.
- AC-15-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
