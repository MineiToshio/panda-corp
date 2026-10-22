# Work orders — FRD-24 Shared decision-id emitter

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this). Each work order carries its own `implementation_status` and copies its
> acceptance criteria verbatim from the FRD.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-24-001](./wo-24-001-shared-emitter.md) | shared-emitter | VERIFIED | — | Kept live: pure `parseDecisionBlocks` extracted from `readDecisions` + the `decision-id-cli.mjs` entry point + `pnpm --silent decisions:ids`. |
| [WO-24-002](./wo-24-002-golden-vectors.md) | golden-vectors | VERIFIED | WO-24-001 | Kept live: committed golden fixture + test proving the library and the CLI agree with the expected ids. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter (DR-087).

## AC coverage

| AC | Work order |
|---|---|
| AC-24-001.1 | WO-24-001 |
| AC-24-001.2 | WO-24-001 |
| AC-24-002.1 | WO-24-002 |
| AC-24-002.2 | WO-24-002 |

## Build order

W0: WO-24-001 → W1: WO-24-002 (both VERIFIED, not rebuilt in v2). FRD-04's WO-04-013 (W3) edits
`src/lib/docs/activity.ts` afterwards and must keep every id and these suites green unmodified.

## Out of this FRD's build

`plugin/skills/decide/SKILL.md` (factory repo) referencing this emitter instead of restating the rule in prose:
a separate, factory-side change (see `frd.md` Non-goals), not a work order here.

## Superseded (v1 history)

None.
