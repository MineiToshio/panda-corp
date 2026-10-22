---
id: "FRD-09"
title: "Gamification"
status: "APPROVED"
ui: true
---
# FRD-09 — Gamification

## Overview

Gamification covers gamification. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-09-001 — Guild level from outcomes

- AC-09-001.1 — WHEN the owner opens the screen, the system SHALL show guild level from outcomes.
- AC-09-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-09-002 — Rank catalogue

- AC-09-002.1 — WHEN the owner opens the screen, the system SHALL show rank catalogue.
- AC-09-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-09-003 — Ledger snapshot

- AC-09-003.1 — WHEN the owner opens the screen, the system SHALL show ledger snapshot.
- AC-09-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
