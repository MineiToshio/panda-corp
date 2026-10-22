---
id: "FRD-06"
title: "SEO and structured data"
status: "APPROVED"
ui: false
---
# FRD-06 — SEO and structured data

## Overview

SEO and structured data covers sEO and structured data. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-06-001 — Metadata and canonical URLs

- AC-06-001.1 — WHEN the owner opens the screen, the system SHALL show metadata and canonical URLs.
- AC-06-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-002 — Open Graph images at build time

- AC-06-002.1 — WHEN the owner opens the screen, the system SHALL show open Graph images at build time.
- AC-06-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-06-003 — Structured data for articles

- AC-06-003.1 — WHEN the owner opens the screen, the system SHALL show structured data for articles.
- AC-06-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
