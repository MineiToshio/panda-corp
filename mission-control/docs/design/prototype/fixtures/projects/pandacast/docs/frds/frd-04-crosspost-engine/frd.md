---
id: "FRD-04"
title: "Cross-posting engine"
status: "APPROVED"
ui: false
---
# FRD-04 — Cross-posting engine

## Overview

Cross-posting engine covers cross-posting engine. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-04-001 — Detecting a new source video

- AC-04-001.1 — WHEN the owner opens the screen, the system SHALL show detecting a new source video.
- AC-04-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-04-002 — Retrying a failed publication

- AC-04-002.1 — WHEN the owner opens the screen, the system SHALL show retrying a failed publication.
- AC-04-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
