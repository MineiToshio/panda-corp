---
id: "FRD-04"
title: "Project workspace"
status: "APPROVED"
ui: true
---
# FRD-04 — Project workspace

## Overview

Project workspace covers project workspace. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-04-001 — Workspace route by slug

- AC-04-001.1 — WHEN the owner opens the screen, the system SHALL show workspace route by slug.
- AC-04-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-04-002 — Summary tab

- AC-04-002.1 — WHEN the owner opens the screen, the system SHALL show summary tab.
- AC-04-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-04-003 — Documents tab with index

- AC-04-003.1 — WHEN the owner opens the screen, the system SHALL show documents tab with index.
- AC-04-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
