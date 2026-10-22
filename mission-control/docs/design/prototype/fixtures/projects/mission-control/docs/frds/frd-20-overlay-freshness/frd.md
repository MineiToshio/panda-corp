---
id: "FRD-20"
title: "Overlay freshness"
status: "APPROVED"
ui: true
---
# FRD-20 — Overlay freshness

## Overview

Overlay freshness covers overlay freshness. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-20-001 — Factory overlay version reader

- AC-20-001.1 — WHEN the owner opens the screen, the system SHALL show factory overlay version reader.
- AC-20-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-20-002 — Upgrade notice on the summary

- AC-20-002.1 — WHEN the owner opens the screen, the system SHALL show upgrade notice on the summary.
- AC-20-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
