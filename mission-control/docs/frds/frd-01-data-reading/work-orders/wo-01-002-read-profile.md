---
id: WO-01-002
type: work-order
slug: read-profile
title: WO-01-002 — `readProfile` (presence + parse)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000]
last_updated: '2026-06-16'
---
# WO-01-002 — `readProfile` (presence + parse)

**Module:** `lib/profile.ts`
**IDs touched:** `CMP-01-profile`, `IF-01-readProfile`; REQ-01-001 (absence signal), REQ-01-002
**Dependencies:** WO-01-000 (fixtures)

## EARS criteria (from FRD-01)

- AC-01-001.1 — WHEN Pandacorp loads and does NOT find `factory/profile.md`, the system SHALL show
  an onboarding gate before any other view. *(This WO supplies the absence signal; the gate UI is
  WO-01-008.)*
- AC-01-002.1 — WHEN `factory/profile.md` exists, the system SHALL read it (name, goals, interests,
  assets, project types) to personalize greetings and views.
- (Edge) — `factory/profile.md` absent → absence is signaled, never assumed/invented.

## Contract

```ts
type Profile = {
  name?: string; goals?: string; interests?: string[]; assets?: string[];
  projectsPath?: string; body: string;
};
type ProfileResult = { present: false } | { present: true; profile: Profile };

export function readProfile(profilePath?: string): ProfileResult;  // defaults to config.PROFILE
```

- Absent file → `{ present: false }` (drives the gate). Never fabricate fields.
- Present → parse frontmatter (gray-matter) and/or markdown body; map snake_case keys
  (`projects_path` → `projectsPath`). Missing fields stay `undefined`; `body` always present.

## Definition of done

- `lib/profile.test.ts` (RED first):
  - `factory-fresh` tree → `{ present: false }`.
  - `factory-full` tree → `{ present: true }` with name + at least one of goals/interests/assets +
    `projectsPath` mapped.
- Fail-soft per blueprint §3; no write; no throw on malformed frontmatter (falls back to
  `{ present: true, profile: { body } }`).
- `.pandacorp/verify.sh` green.

## Status

- [x] **DONE** — 2026-06-16

**Evidence:**
- `bash .pandacorp/verify.sh` → `✅ all gates green (biome + tsc + vitest)` — 236 tests passed (9 test files), 0 type errors, 0 lint errors.
- `lib/profile.test.ts` — 23 tests, all GREEN.
- Implementation: `lib/profile.ts` (gray-matter, fail-soft, snake_case→camelCase, call-time path resolution).
- Key implementation note: `PANDACORP_FACTORY_ROOT` is read at call-time via `resolveFactoryRoot()`, not at module import time — required for `withFactoryRoot` test isolation to work.
- `docs/api.md` updated with WO-01-002 section.
