---
id: WO-01-003
type: work-order
slug: read-ideas
title: WO-01-003 — `readIdeas` (cards + frontmatter)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000]
last_updated: '2026-06-16'
---
# WO-01-003 — `readIdeas` (cards + frontmatter)

**Module:** `lib/ideas.ts`
**IDs touched:** `CMP-01-ideas`, `IF-01-readIdeas`; REQ-01-003
**Dependencies:** WO-01-000 (fixtures)

## EARS criteria (from FRD-01)

- AC-01-003.1 — WHEN Pandacorp loads, the system SHALL read all the cards in `factory/ideas/*.md`
  (ignoring `_idea-template.md` and `decision-log.md`) with their frontmatter (title, status,
  `project_type`, `return_type`, score).
- (Edge) — Empty ideas folder → empty result handled gracefully.

## Contract

```ts
type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";
type IdeaCard = {
  slug: string; title: string; status: IdeaStatus;
  projectType?: string; returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number; project?: string; body: string;
};

export function readIdeas(ideasDir?: string): IdeaCard[];  // defaults to config.IDEAS_DIR
```

- Read every `*.md` in `IDEAS_DIR`, skipping `NON_IDEA_FILES` (`config.NON_IDEA_FILES`).
- Parse with gray-matter; map `project_type`→`projectType`, `return_type`→`returnType`.
- `slug` = filename without `.md`.
- A card with unparseable frontmatter is **skipped** (not fatal). Missing folder → `[]`.

## Definition of done

- [x] `lib/ideas.test.ts` (RED first):
  - `factory-full` → returns the 5 valid cards; `_idea-template.md` and `decision-log.md` excluded;
    `idea-malformed.md` excluded without throwing.
  - Each returned card exposes `title`, `status`, `projectType`, `returnType`, `score`, `body`.
  - `factory-fresh` (empty ideas dir) → `[]`.
- [x] No write; fail-soft per blueprint §3.
- [x] `.pandacorp/verify.sh` green.

## Status: DONE

**Evidence:** `bash .pandacorp/verify.sh` — 340 tests passed (15 test files), biome+tsc clean (2026-06-16).
Implementer commits: `7e79bf0` (readIdeas lib), `8a122dd` (IdeaCard UI). Reviewer verdict: APPROVED (`docs/reviews/wo-01-003-review.md`).
Adversarial suite (14 tests): `lib/ideas.adversarial.test.ts` — all green. Mutation check passed (4/4 mutants caught).
