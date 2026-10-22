---
id: "FRD-25"
title: "Persistent navigation"
status: "APPROVED"
ui: true
---
# FRD-25 — Persistent navigation

## Overview

Persistent navigation covers persistent navigation. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-25-001 — Persistent navigation

- AC-25-001.1 — WHEN the owner opens the screen, the system SHALL show persistent navigation.
- AC-25-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
