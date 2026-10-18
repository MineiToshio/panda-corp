---
id: WO-01-001
type: work-order
slug: app-shell
title: App shell
status: DRAFT
parent: FRD-01
foundation: true          # Wave-0 foundation
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts:
  - src/app/layout.tsx
  - src/components/core/**
source_requirements: [REQ-01-001]
dependsOn: []
last_updated: 2026-10-01
---

# WO-01-001 App shell

## Summary

The persistent shell and the core primitives.

## Requirements & Acceptance Criteria

- **AC-01-001.1:** WHEN a visitor opens any page THE SYSTEM SHALL show the top bar with the menu.

Related: AC-01-001.2 is WO-01-002's (a mention, not ownership).
