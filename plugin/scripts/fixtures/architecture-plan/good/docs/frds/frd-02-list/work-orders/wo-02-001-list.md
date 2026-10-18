---
id: WO-02-001
type: work-order
slug: list
title: List and detail
status: DRAFT
parent: FRD-02
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts: [src/app/{list,detail}/**, "src/app/pieza/[id]/**", docs/api/WO-02-001.md]
source_requirements: [REQ-02-001]
dependsOn: [WO-01-001]
last_updated: 2026-10-01
---

# WO-02-001 List and detail

## Summary

The list and detail pages.

## Requirements & Acceptance Criteria

- **AC-02-001.1** [T]: WHEN a member opens the list THE SYSTEM SHALL show "Guardar" (drawn in FRD-01's shell) on every row.
