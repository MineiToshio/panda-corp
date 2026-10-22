---
id: "FRD-05"
title: "Connection map"
status: "APPROVED"
ui: true
---
# FRD-05 — Connection map

## Overview

Connection map covers connection map. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-05-001 — Connection graph data

- AC-05-001.1 — WHEN the owner opens the screen, the system SHALL show connection graph data.
- AC-05-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-002 — Interactive connection map

- AC-05-002.1 — WHEN the owner opens the screen, the system SHALL show interactive connection map.
- AC-05-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
