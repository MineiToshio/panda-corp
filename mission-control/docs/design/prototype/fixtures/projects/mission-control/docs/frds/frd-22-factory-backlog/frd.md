---
id: "FRD-22"
title: "Factory backlog"
status: "APPROVED"
ui: true
---
# FRD-22 — Factory backlog

## Overview

Factory backlog covers factory backlog. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-22-001 — Factory backlog

- AC-22-001.1 — WHEN the owner opens the screen, the system SHALL show factory backlog.
- AC-22-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
