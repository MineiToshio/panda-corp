---
id: WO-09-003
type: work-order
slug: avatar
title: WO-09-003 — `CMP-09-avatar` pixel-art agent avatar
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-09-003 — `CMP-09-avatar` pixel-art agent avatar

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-avatar`](../blueprint.md#3-components--interfaces).

## Goal
Build the reusable pixel-art (Final-Fantasy-style) agent avatar component. Static sprite assets keyed
by agent id; graceful fallback when a sprite is missing. Reused by FRD-07 (agents section) and FRD-10
(party in the Hall hero).

## Acceptance criteria (EARS, from FRD-07/09/13)
- **AC-09-003.1** — `CMP-09-avatar` SHALL render a pixel-art avatar for a given agent id, FF-style, at a tokenized size/radius (FRD-13 elevation/radius tokens).
- **AC-09-003.2** — WHEN the sprite for an id is missing, the component SHALL degrade gracefully (placeholder or removal) and SHALL NOT break the layout (architecture §7).
- **AC-09-003.3** — The avatar SHALL carry an `alt`/`aria-label` in Spanish (FRD-13 a11y).
- **AC-09-003.4** — The component SHALL use only FRD-13 tokens for any chrome (border/background), no hardcoded colors.

## Dependencies
- FRD-13 tokens. Cross-feature.
- Sprite assets (static, in the app). No `lib/` reader.

## TDD plan
1. RED: tests for render-by-id, missing-sprite fallback, Spanish `alt`, token usage.
2. GREEN: implement the component + sprite map.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; Spanish a11y. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-09-avatar` — reusable pixel-art (FF-style) agent avatar component.

**Files delivered:**
- `components/rpg/Avatar.tsx` — the component + `SPRITE_MAP` + `AvatarSize` type + `AvatarProps`.
- `components/rpg/Avatar.test.tsx` — 31 TDD tests covering all 4 AC (RED → GREEN → refactor).

**Interfaces / contracts exposed:**
```ts
// Sprite asset map — canonical AgentRole → /prototype/assets/agents/*.png path
export const SPRITE_MAP: Record<AgentRole, string>

// Tokenized size variants (CSS var references, never hardcoded px)
export type AvatarSize = "sm" | "md" | "lg"

export interface AvatarProps {
  agentId: AgentRole;       // canonical role id; unknown → graceful fallback
  size?: AvatarSize;        // default "sm"
  "data-testid-suffix"?: string;
}

export function Avatar(props: AvatarProps): React.JSX.Element
```

**data-testid contract:**
- `agent-avatar` — wrapper `<div role="img">` (always rendered)
- `agent-avatar-img` — sprite `<img>` (always rendered, uses fallback for unknown ids)
- `data-role={agentId}` — on wrapper for multi-avatar disambiguation

**AC coverage:**
- AC-09-003.1: pixelated rendering, tokenized size/radius (`var(--avatar-size-{sm|md|lg})`, `var(--radius)`), `SPRITE_MAP` for all 10 canonical roles.
- AC-09-003.2: unknown agent id → falls back to `backend-dev` sprite; layout never breaks; no throw.
- AC-09-003.3: Spanish `aria-label` on wrapper (`"Avatar de agente {role}"`), Spanish `alt` on img (`"Sprite de {role}"`).
- AC-09-003.4: zero hardcoded colors — border/background/shadow all via `var(--*)` tokens only.

**Integration seams:**
- Consumed by FRD-07 (agents section) and FRD-10 (party Hall hero): `import { Avatar } from "@/components/rpg/Avatar"`.
- `AgentRole` type imported from `@/app/_design/tokens` (IF-13-agent-colors, WO-13-001).
- Sprite assets already present at `/prototype/assets/agents/` (no new assets needed).

**Test files:** `components/rpg/Avatar.test.tsx` (31 tests, all green).

**Gate:** biome clean (no errors, 1 pre-existing warning in WO-09-002 stub), tsc clean on Avatar files (9 pre-existing errors in WO-09-001/002 stubs — `lib/gamification.guild.test.ts` and `lib/gamification.test.ts` — not introduced by this WO). 31/31 Avatar tests GREEN; 2 pre-existing failures in `PartyTab.integration.reviewer.test.tsx` (WO-06 scope, unrelated).
</content>
