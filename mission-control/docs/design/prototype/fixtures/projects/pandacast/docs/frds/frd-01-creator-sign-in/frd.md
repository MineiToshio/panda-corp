---
id: "FRD-01"
title: "Creator sign-in"
status: "APPROVED"
ui: true
---
# FRD-01 — Creator sign-in

## Overview

Creator sign-in covers creator sign-in. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-01-001 — Sign-in with a single email link

- AC-01-001.1 — WHEN the owner opens the screen, the system SHALL show sign-in with a single email link.
- AC-01-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-002 — The list of connected platforms after sign-in

- AC-01-002.1 — WHEN the owner opens the screen, the system SHALL show the list of connected platforms after sign-in.
- AC-01-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
