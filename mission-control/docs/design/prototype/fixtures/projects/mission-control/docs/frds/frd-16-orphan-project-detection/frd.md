---
id: "FRD-16"
title: "Orphan project detection"
status: "APPROVED"
ui: true
---
# FRD-16 — Orphan project detection

## Overview

Orphan project detection covers orphan project detection. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-16-001 — Sibling folder scan

- AC-16-001.1 — WHEN the owner opens the screen, the system SHALL show sibling folder scan.
- AC-16-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-16-002 — Orphan classification

- AC-16-002.1 — WHEN the owner opens the screen, the system SHALL show orphan classification.
- AC-16-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-16-003 — Orphan list view

- AC-16-003.1 — WHEN the owner opens the screen, the system SHALL show orphan list view.
- AC-16-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
