---
id: "FRD-03"
title: "Recap before resuming"
status: "APPROVED"
ui: true
---
# FRD-03 — Recap before resuming

## Overview

Recap before resuming covers recap before resuming. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-03-001 — Recap generator up to a chapter

- AC-03-001.1 — WHEN the owner opens the screen, the system SHALL show recap generator up to a chapter.
- AC-03-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-002 — Recap screen with sections

- AC-03-002.1 — WHEN the owner opens the screen, the system SHALL show recap screen with sections.
- AC-03-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-003 — Chapter summaries in the timeline

- AC-03-003.1 — WHEN the owner opens the screen, the system SHALL show chapter summaries in the timeline.
- AC-03-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
