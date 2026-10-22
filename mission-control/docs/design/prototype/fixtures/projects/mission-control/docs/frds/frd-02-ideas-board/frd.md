---
id: "FRD-02"
title: "Ideas board"
status: "APPROVED"
ui: true
---
# FRD-02 — Ideas board

## Overview

Ideas board covers ideas board. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-02-001 — Column derivation from status

- AC-02-001.1 — WHEN the owner opens the screen, the system SHALL show column derivation from status.
- AC-02-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-002 — Next-step hint per column

- AC-02-002.1 — WHEN the owner opens the screen, the system SHALL show next-step hint per column.
- AC-02-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-003 — Discard with confirmation

- AC-02-003.1 — WHEN the owner opens the screen, the system SHALL show discard with confirmation.
- AC-02-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
