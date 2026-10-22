---
id: "FRD-12"
title: "Observability and dataviz"
status: "APPROVED"
ui: true
---
# FRD-12 — Observability and dataviz

## Overview

Observability and dataviz covers observability and dataviz. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-12-001 — Build timeline reader

- AC-12-001.1 — WHEN the owner opens the screen, the system SHALL show build timeline reader.
- AC-12-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-12-002 — Timeline bars

- AC-12-002.1 — WHEN the owner opens the screen, the system SHALL show timeline bars.
- AC-12-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-12-003 — Dependency graph layout

- AC-12-003.1 — WHEN the owner opens the screen, the system SHALL show dependency graph layout.
- AC-12-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
