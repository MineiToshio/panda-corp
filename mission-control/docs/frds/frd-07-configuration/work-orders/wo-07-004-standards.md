---
id: WO-07-004
type: work-order
slug: standards
title: 'WO-07-004 — `lib/standards.ts`: read standards (+ derivation fallback)'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
</content>
