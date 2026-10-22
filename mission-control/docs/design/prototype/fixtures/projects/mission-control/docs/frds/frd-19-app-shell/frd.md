---
id: "FRD-19"
title: "App shell"
status: "APPROVED"
ui: true
---
# FRD-19 — App shell

## Overview

App shell covers app shell. It is specified as its own feature so it can be built, reviewed and released independently.

## Requirements

### REQ-19-001 — Global shell with sidebar

- AC-19-001.1 — WHEN the owner opens the screen, the system SHALL show global shell with sidebar.
- AC-19-001.2 — IF the source is missing, THEN the system SHALL show the designed empty state.

## Out of scope

- Anything that writes to the factory or calls an external service.
