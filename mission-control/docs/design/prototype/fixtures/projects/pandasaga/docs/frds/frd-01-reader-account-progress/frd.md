---
id: "FRD-01"
title: "Reader account and progress"
status: "APPROVED"
ui: true
---
# FRD-01 — Reader account and progress

## Overview

Reader account and progress covers reader account and progress. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-01-001 — Guest context on first visit

- AC-01-001.1 — WHEN the owner opens the screen, the system SHALL show guest context on first visit.
- AC-01-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-002 — Email account with magic link

- AC-01-002.1 — WHEN the owner opens the screen, the system SHALL show email account with magic link.
- AC-01-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-003 — Merge guest progress into an account

- AC-01-003.1 — WHEN the owner opens the screen, the system SHALL show merge guest progress into an account.
- AC-01-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
