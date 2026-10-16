# DATA-7 independent review

Verdict: APPROVE within the reviewed rule/contract scope. No blocking finding.

## Evidence reviewed

- `factory/standards/data-modeling.md:28-37` and `plugin/templates/rules/logical-data-model.md:12-19`: all-stack application; schema-authoring agent owns the artifact in the same work order/change/commit; approved design before implementation and checked-in definitions afterward; independent source-to-projection comparison. Explicit provenance and no live-database/automatic-sync claim.
- `plugin/skills/architecture/SKILL.md:23`: model publication, declared WO ownership and serial shared-model writers. `iterate:26`, `sync:35,52`, and `plugin/agents/reviewer.md:46` carry closure obligations through changes and reconciliation. Generated `.codex/agents/reviewer.toml` contains the same DATA-7 clause.
- `scaffold:26,47`, `adopt:38`, `upgrade:64` inject every `applies_when: always` rule; new rule has that frontmatter; catalog and Mission Control rule README include it. `OVERLAY_VERSION` is 8.99.1.
- `plugin/templates/docs/architecture-{template,digest-template}.md`: one structured source, narrative kept separate. Manual `ArquitecturaDetail.tsx` explains creation, maintenance ownership and legacy pending behavior. Factory/plugin decision logs document the addition.
- Inspected real Mission Control `model.ts`, `types.ts`, `validation.ts`, `parse-entities.ts`, `parse-relationships.ts`: both published examples fit version 1. The User endpoint 1..1 and Profile endpoint 0..1 correctly express required unique profile.userId and optional profile per user. No-database is an explicit empty none state; missing legacy models are not fabricated.

## Independently rerun checks

- `bash factory/standards/check-standards.sh`: exit 0; 162 catalog rules, 31 files checked.
- `pnpm exec vitest run src/lib/architecture/data-model/_tests/injected-rule-contract.test.ts --reporter=dot` in Mission Control: exit 0; 1 file / 2 tests passed, including both examples through the actual validator and exact project-rule copy.

## Limits

This approves the standard and its producer/viewer contract, not semantic freshness of every existing project. Semantic correspondence is explicitly a manual independent correctness gate unless a project has its own exporter. Delivery to existing projects occurs on safe overlay upgrade; unchanged legacy projects may remain pending. No bulk project backfill, Next server, production/schema connection, build-state mutation, broad app suite, or commit/staging operation was performed. The parent agent remains responsible for final combined checks and narrow commit membership amid unrelated concurrent changes.

Non-blocking clarity improvement: the short publishing contract omits validator text-length limits (IDs/types 120, names 200, descriptions 4000) and could state mapping attributes must be supplied on both ends or neither. Existing examples and reviewed obligations are valid without this edit.
