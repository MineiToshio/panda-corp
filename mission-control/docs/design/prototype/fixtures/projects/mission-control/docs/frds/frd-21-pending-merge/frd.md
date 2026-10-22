---
id: "FRD-21"
title: "Pending merge"
status: "APPROVED"
ui: true
---
# FRD-21 — Pending merge

## Overview

Pending merge covers pending merge. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-21-001 — Unmerged branch reader

- AC-21-001.1 — WHEN the owner opens the screen, the system SHALL show unmerged branch reader.
- AC-21-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-21-002 — Pending work indicator

- AC-21-002.1 — WHEN the owner opens the screen, the system SHALL show pending work indicator.
- AC-21-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
