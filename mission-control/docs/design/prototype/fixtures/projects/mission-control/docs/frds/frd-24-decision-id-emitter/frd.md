---
id: "FRD-24"
title: "Decision id emitter"
status: "APPROVED"
ui: true
---
# FRD-24 — Decision id emitter

## Overview

Decision id emitter covers decision id emitter. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-24-001 — Stable decision ids

- AC-24-001.1 — WHEN the owner opens the screen, the system SHALL show stable decision ids.
- AC-24-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-24-002 — Decide command with ids

- AC-24-002.1 — WHEN the owner opens the screen, the system SHALL show decide command with ids.
- AC-24-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
