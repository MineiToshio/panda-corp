---
id: WO-NN-MMM            # the owning backend work order's id — the file is docs/api/<wo-id>.md
type: api-contract
title: Replace with the endpoint/capability
last_updated: YYYY-MM-DD
---

# API contract — WO-NN-MMM

> Written by the **backend work order BEFORE deep implementation** (DR-060) so the frontend WO that
> depends on it can build against a stable shape. **ONE file per backend WO** (`docs/api/<wo-id>.md`),
> never a shared `docs/api.md` (N parallel agents raced on that). Listed in this WO's `artifacts`.
> Notify the consuming WO by message when it's ready.

## Endpoints / actions

Each route or Server Action: method + path (or action name) + a one-line purpose.

## Request

Per endpoint: the input shape (params / body), validation rules, and the schema (Zod) name that
owns them.

## Response

The success shape(s) + status codes — the exact types the consumer receives.

## Types

The shared types / enums the consumer imports (names + shapes).

## Errors

The error cases and how they surface (status code + error shape).

## Consumed by

The frontend / other work order(s) that depend on this contract, by id.
