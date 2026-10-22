---
id: "FRD-01"
title: "Site shell, languages and themes"
status: "APPROVED"
ui: true
---
# FRD-01 — Site shell, languages and themes

## Overview

Site shell, languages and themes covers site shell, languages and themes. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-01-001 — Layout shell with skip link

- AC-01-001.1 — WHEN the owner opens the screen, the system SHALL show layout shell with skip link.
- AC-01-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-002 — Two-language routing

- AC-01-002.1 — WHEN the owner opens the screen, the system SHALL show two-language routing.
- AC-01-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-003 — Light and dark themes without flash

- AC-01-003.1 — WHEN the owner opens the screen, the system SHALL show light and dark themes without flash.
- AC-01-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
