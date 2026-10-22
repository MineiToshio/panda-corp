---
id: "FRD-05"
title: "Blog in MDX"
status: "APPROVED"
ui: true
---
# FRD-05 — Blog in MDX

## Overview

Blog in MDX covers blog in MDX. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-05-001 — Content collection for posts

- AC-05-001.1 — WHEN the owner opens the screen, the system SHALL show content collection for posts.
- AC-05-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-002 — Post page with reading time

- AC-05-002.1 — WHEN the owner opens the screen, the system SHALL show post page with reading time.
- AC-05-002.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

### REQ-05-003 — Tag pages and RSS feed

- AC-05-003.1 — WHEN the owner opens the screen, the system SHALL show tag pages and RSS feed.
- AC-05-003.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
