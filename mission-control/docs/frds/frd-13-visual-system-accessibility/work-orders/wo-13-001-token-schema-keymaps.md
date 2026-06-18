---
id: WO-13-001
type: work-order
slug: token-schema-keymaps
title: WO-13-001 — Token schema validation + agent-color/state-vocab key maps
status: ACTIVE
parent: FRD-13
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-18'
---
# WO-13-001 — Token schema validation + agent-color/state-vocab key maps

**Components/Interfaces:** `IF-13-tokens`, `IF-13-agent-colors`, `IF-13-state-vocab` · **Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007

## Realignment (2026-06-18 — Party redesign, reopened → PLANNED)
Align `AGENT_ROLES` + `AGENT_COLOR` to the real engine/pipeline roles (narrow scope — keep everything else verified):
- **ADD** `implementer` (the real build role — currently missing), `copywriter`, `analytics`, `devops`.
- **REMOVE** the fictitious `guild` aggregate.
- Keep: `researcher`, `backend-dev`, `frontend-dev`, `test-writer`, `reviewer`, `security-auditor`, `architect`, `product-manager`, `designer`.
- Each new role gets an `AGENT_COLOR` entry (`--color-agent-<role>`); the matching `@theme` tokens are added by WO-13-002. Update any exhaustive switch/tests over `AgentRole`. Source: `prototype/party-redesign-spec.md` §2.
**Deploy unit:** design layer (pure logic + contract) · **Location:** `app/_design/tokens.ts` (+ `.test.ts`), validates `docs/design/design-tokens.json`

## Acceptance criteria (verbatim EARS)
- AC-13-001.1: The theme SHALL be derived from **few tokens in perceptual space** (OKLCH: base, accent, contrast) ... a **high-contrast mode** can be enabled without a redesign.
- AC-13-004.1: Elevation SHALL have **3 levels** ... radius 8px, base 16px, hairline 1px, spacing in multiples of 0.25rem.
- AC-13-005.1: Animation ... duration **<300ms** ... 2–3 easing tokens.
- AC-13-007.1: NO state SHALL depend on color alone: each state paired with an **icon or shape + label**.

## Scope
- Zod (or equivalent) schema validating `design-tokens.json`: `oklch.{base,accent,contrast}`, `themes.{light,dark,highContrast}`, `agents.<role>` (~10 roles), `elevation` (3 levels), `radius/spacing/hairline`, `motion.duration.*` (assert all <300ms), `motion.easing.*` (2–3).
- `AGENT_COLOR: Record<Role, tokenKey>` — canonical role→color-token-**key** map (single source for FRD-06 sprite/feed/cards + FRD-12 DAG).
- `STATE_BADGE: Record<State, {icon, label}>` — icon+label per state (working/idle/failed/completed/blocked/reviewing), Spanish labels.

## Dependencies
- `docs/design/design-tokens.json` *shape* (frozen by the design phase for full values; schema buildable against the agreed shape now — blueprint §7).

## TDD / Definition of done
- Tests: a valid tokens fixture passes; a missing theme / a motion duration ≥300ms / <2 or >3 easings / a missing agent / not-3 elevations → validation fails with an actionable message. `AGENT_COLOR` covers all ~10 roles; `STATE_BADGE` covers all 6 states with non-empty icon+label.
- Pure. Gate green.

## Status — DONE (2026-06-16)

**[x] DONE — all gates green (3rd cycle, fixes applied)**

Commit: `fe21195` — fix(mission-control): close WO-13-001 motion fail-open guards (B1'/I2/I3)

Gate results:
- `vitest run app/_design/tokens.test.ts` — 68 passed (0 failed)
- `vitest run` (full suite) — 1105 passed
- `tsc --noEmit` — clean (exit 0)
- `biome check .` — exit 0
- `.pandacorp/verify.sh` — green (exit 0)

Fixes applied:
- **B1'**: `Number.isFinite(value)` guard added in `motion.duration` loop — NaN/±Infinity no longer bypass the <300ms gate.
- **I2**: `motion.duration` must be a non-array plain object with ≥1 entry — empty `{}` and array `[]` both rejected.
- **I3**: `typeof easingRaw !== "object" || Array.isArray(easingRaw)` guard added before the 2–3 count check — positional arrays rejected.
