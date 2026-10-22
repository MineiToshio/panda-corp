---
id: "FRD-11"
title: "Build modes"
status: "APPROVED"
ui: true
---
# FRD-11 — Build modes

## Overview

Build modes covers build modes. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-11-001 — Build mode catalogue

- AC-11-001.1 — WHEN the owner opens the screen, the system SHALL show build mode catalogue.
- AC-11-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-11-002 — Mode switch with memory

- AC-11-002.1 — WHEN the owner opens the screen, the system SHALL show mode switch with memory.
- AC-11-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
