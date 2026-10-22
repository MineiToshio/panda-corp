---
id: "FRD-08"
title: "Documentation"
status: "APPROVED"
ui: true
---
# FRD-08 — Documentation

## Overview

Documentation covers documentation. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-08-001 — Manual reader

- AC-08-001.1 — WHEN the owner opens the screen, the system SHALL show manual reader.
- AC-08-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-08-002 — Manual search

- AC-08-002.1 — WHEN the owner opens the screen, the system SHALL show manual search.
- AC-08-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
