---
id: "FRD-03"
title: "Video dashboard"
status: "APPROVED"
ui: true
---
# FRD-03 — Video dashboard

## Overview

Video dashboard covers video dashboard. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-03-001 — The latest source videos

- AC-03-001.1 — WHEN the owner opens the screen, the system SHALL show the latest source videos.
- AC-03-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-03-002 — The publishing state per platform

- AC-03-002.1 — WHEN the owner opens the screen, the system SHALL show the publishing state per platform.
- AC-03-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
