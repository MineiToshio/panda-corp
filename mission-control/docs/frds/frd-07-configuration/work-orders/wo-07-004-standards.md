---
id: WO-07-004
type: work-order
slug: standards
title: 'WO-07-004 — `lib/standards.ts`: read standards (+ derivation fallback)'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-07-004 — `lib/standards.ts`: read standards (+ derivation fallback)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-07-standards`](../blueprint.md#3-components--interfaces) and the
[derivation gap §6](../blueprint.md#6-derivation-gap-flagged-for-the-owner).

## Goal
Implement `readStandards()` in `lib/standards.ts`: derive the standards catalog from
`factory/standards/*.md` with `domain`, `severity` (MUST/SHOULD/MAY), `enforcement`
(lint/CI/checklist/human gate), a `summary` (key points) and the full body. Prefer **frontmatter**
when present (option A); fall back to a small **derivation map** (option B) so the section is never
empty. **No fully hand-copied catalog** (DR-046 spirit).

## Acceptance criteria (EARS, from FRD-07 + DR-046)
- **AC-07-004.1** — WHEN `readStandards()` runs, it SHALL return one entry per `factory/standards/*.md` (excluding `README.md`) with `id` (filename), `title` (H1), `body`, `domain`, `severity`, `enforcement` and `summary: string[]`.
- **AC-07-004.2** — WHEN a standard file declares `domain/severity/enforcement` (and optional `summary`) in frontmatter, the reader SHALL use those values verbatim (option A).
- **AC-07-004.3** — WHEN frontmatter is absent, the reader SHALL fall back to the static derivation map keyed by filename (option B) so no standard is missing its metadata; an unmapped file SHALL get `domain: "Other"`, `severity: "SHOULD"`, `enforcement: "checklist"` and a typed warning (never crash).
- **AC-07-004.4** — `summary` SHALL default to the body's first bullet list (or lead paragraph) when not provided.
- **AC-07-004.5** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01) for fixture testing, and SHALL reflect added/renamed standards automatically (no static catalog of *content*).

## Dependencies
- FRD-01 `lib/config.ts`. Cross-feature.
- Libraries: `gray-matter`, `yaml`/markdown parse, Node `fs`.
- **Owner flag:** option A requires adding `domain/severity/enforcement` frontmatter to
  `factory/standards/*.md` — a **factory-repo change outside Mission Control's write scope**. This
  WO ships option B as the safety net and surfaces the flag; the owner decides whether to add the
  frontmatter (cleanest DR-046 fit). The prototype `CONFIG.estandares` array is the known schema.

## TDD plan
1. Fixtures: one standard WITH frontmatter, one WITHOUT (mapped), one WITHOUT (unmapped → defaults).
2. RED: tests for frontmatter-first, map fallback, default-on-unmapped, summary derivation.
3. GREEN: implement `readStandards()` + the derivation map.
4. Refactor.

## Definition of done
- `pnpm vitest run lib/standards.test.ts` green; tsc + biome clean; no `any`/`@ts-ignore`.
- Owner flag recorded in the blueprint §6 and surfaced. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `lib/standards.ts` — `readStandards()` function implementing `IF-07-standards`.

**Interfaces/contracts exposed:**

```ts
// lib/standards.ts
export type StandardSeverity = "MUST" | "SHOULD" | "MAY";
export type StandardEnforcement = "lint" | "CI" | "checklist" | "human gate" | string;
export type StandardDomain = "Programming" | "Architecture" | "Design" | "Technology" |
  "Quality" | "Security" | "Operation" | "Data/Privacy" | "Product/Docs" | "Other" | string;

export interface Standard {
  id: string;          // filename, e.g. "quality.md"
  title: string;       // H1 heading
  body: string;        // full markdown body (frontmatter stripped)
  domain: StandardDomain;
  severity: StandardSeverity;
  enforcement: StandardEnforcement;
  summary: string[];   // from frontmatter or derived from body
}

export function readStandards(factoryRoot?: string): Standard[];
```

**Strategy implemented:**
- Option A (frontmatter): when `domain/severity/enforcement` present in YAML frontmatter → used verbatim.
- Option B (derivation map): when no frontmatter → `DERIVATION_MAP` keyed by filename covers all 15 real `factory/standards/*.md` files.
- Default: unmapped files without frontmatter → `{domain:"Other", severity:"SHOULD", enforcement:"checklist"}` + `console.warn` with filename (never crash).
- `summary`: from frontmatter array when present; else first contiguous bullet block; else first non-heading lead paragraph.

**Integration seams:**
- Consumer: `app/configuration/` (CMP-07-standards-list, CMP-07-standard-detail) — import `readStandards` from `@/lib/standards`.
- Also consumed by FRD-08 Manual (same `IF-07-standards`).
- `DERIVATION_MAP` uses `enforcement: "lint/CI"` for `api-design.md` — a string, not a union member; `StandardEnforcement` is open (`| string`) to accommodate this.

**Owner flag (blueprint §6, DR-046):** the cleanest fit is adding `domain/severity/enforcement/summary` frontmatter to each `factory/standards/*.md`. That is a factory-repo change outside MC's write scope. Option B (the derivation map) is the active safety net until the owner adds the frontmatter.

**Test file:** `lib/standards.test.ts` — 37 tests covering AC-07-004.1 through AC-07-004.5, edge cases (empty dir, malformed YAML, no heading, non-.md files, dynamic file reflection).

**Gate:** 37/37 tests GREEN; 163/163 total test files GREEN (4385 tests); tsc clean; biome clean; verify.sh PASS.
</content>
