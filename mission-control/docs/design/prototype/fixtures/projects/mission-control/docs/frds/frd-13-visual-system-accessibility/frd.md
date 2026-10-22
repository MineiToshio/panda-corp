---
id: "FRD-13"
title: "Visual system and accessibility"
status: "APPROVED"
ui: true
---
# FRD-13 — Visual system and accessibility

## Overview

Visual system and accessibility covers visual system and accessibility. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-13-001 — Design token registry

- AC-13-001.1 — WHEN the owner opens the screen, the system SHALL show design token registry.
- AC-13-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-13-002 — Light and dark themes

- AC-13-002.1 — WHEN the owner opens the screen, the system SHALL show light and dark themes.
- AC-13-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-13-003 — Focus ring and skip link

- AC-13-003.1 — WHEN the owner opens the screen, the system SHALL show focus ring and skip link.
- AC-13-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
