---
id: "FRD-01"
title: "Browse the catalog"
status: "APPROVED"
ui: true
---
# FRD-01 — Browse the catalog

## Overview

Browse the catalog covers browse the catalog. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-01-001 — Catalog read model and seed loader

- AC-01-001.1 — WHEN the owner opens the screen, the system SHALL show catalog read model and seed loader.
- AC-01-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-002 — Franchise index page

- AC-01-002.1 — WHEN the owner opens the screen, the system SHALL show franchise index page.
- AC-01-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-01-003 — Series grid with lazy images

- AC-01-003.1 — WHEN the owner opens the screen, the system SHALL show series grid with lazy images.
- AC-01-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
