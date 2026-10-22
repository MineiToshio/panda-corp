---
id: "FRD-05"
title: "Shareable checklist"
status: "APPROVED"
ui: true
---
# FRD-05 — Shareable checklist

## Overview

Shareable checklist covers shareable checklist. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-05-001 — Checklist export model

- AC-05-001.1 — WHEN the owner opens the screen, the system SHALL show checklist export model.
- AC-05-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-002 — Image renderer worker

- AC-05-002.1 — WHEN the owner opens the screen, the system SHALL show image renderer worker.
- AC-05-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-003 — Export modes for all, owned and missing

- AC-05-003.1 — WHEN the owner opens the screen, the system SHALL show export modes for all, owned and missing.
- AC-05-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
