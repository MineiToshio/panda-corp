# Work orders — FRD-24 Shared decision-id emitter

> The authoritative order + parallelism is the **Build Plan** in `../blueprint.md` (the build engine
> reads that, not this). This file is the readable summary. Each WO is a **coarse slice** (one
> cohesive view/capability), carries its own `implementation_status` frontmatter, and copies in its
> acceptance criteria.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-24-001 | shared-emitter | PLANNED | — | Extract `parseDecisionBlocks` (pure) from `readDecisions` + a `decision-id-cli.mjs` entry point + `pnpm decisions:ids` script. |
| WO-24-002 | golden-vectors | PLANNED | WO-24-001 | Committed golden-vector fixture + test proving the library function and the CLI subprocess agree, and match a committed expected-ids list. |

> **Depends on** mirrors each WO's **`dependsOn`** frontmatter (DR-087). WO-24-002 depends on
> WO-24-001 because it exercises both the pure function AND the CLI WO-24-001 creates.

## Build order

One wave, sequential (both WOs write disjoint files, but WO-24-002's tests need WO-24-001's exports
and CLI to exist): **WO-24-001 → WO-24-002**. No cross-FRD dependency — `activity.ts`'s existing
consumers (`TabSummary`, `countPendingDecisions`, FRD-04) are unaffected (same public
`readDecisions`/`countPendingDecisions` signatures).

## Out of this FRD's build

`plugin/skills/decide/SKILL.md` (factory repo) referencing this emitter instead of restating the rule
in prose — a separate, factory-side change (see `frd.md` Non-goals), not a work order here.
