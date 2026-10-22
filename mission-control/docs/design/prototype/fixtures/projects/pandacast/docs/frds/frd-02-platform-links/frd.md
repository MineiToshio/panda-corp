---
id: "FRD-02"
title: "Platform connections"
status: "APPROVED"
ui: true
---
# FRD-02 — Platform connections

## Overview

Platform connections covers platform connections. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-02-001 — Connecting a platform account

- AC-02-001.1 — WHEN the owner opens the screen, the system SHALL show connecting a platform account.
- AC-02-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-002 — The health of each connection

- AC-02-002.1 — WHEN the owner opens the screen, the system SHALL show the health of each connection.
- AC-02-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
