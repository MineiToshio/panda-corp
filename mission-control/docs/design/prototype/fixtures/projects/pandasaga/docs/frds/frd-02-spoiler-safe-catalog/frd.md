---
id: "FRD-02"
title: "Spoiler-safe catalog"
status: "APPROVED"
ui: false
---
# FRD-02 — Spoiler-safe catalog

## Overview

Spoiler-safe catalog covers spoiler-safe catalog. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-02-001 — Catalog bundle format

- AC-02-001.1 — WHEN the owner opens the screen, the system SHALL show catalog bundle format.
- AC-02-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-002 — Atomic publish of a bundle

- AC-02-002.1 — WHEN the owner opens the screen, the system SHALL show atomic publish of a bundle.
- AC-02-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-02-003 — Chapter-bounded visibility filter

- AC-02-003.1 — WHEN the owner opens the screen, the system SHALL show chapter-bounded visibility filter.
- AC-02-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
