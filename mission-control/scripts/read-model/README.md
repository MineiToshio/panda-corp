# Read-model CLIs (FRD-23 — materialized stats)

Factory-tooling entry points for the materialized Informe read-model. Mission Control (the app) only
**reads** the read-model; these CLIs are the **writers** (architecture §7, ADR-0004). They run the
project's TypeScript directly through a zero-dependency loader (`ts-loader.mjs` — resolves the `@/`
alias + extensionless `.ts` imports via Node's native type-stripping, no `tsx`/`ts-node`/`jiti`).

All logic lives in `src/lib/achievements/read-model/` (unit-tested); these are thin CLIs over it.

| CLI | npm script | Purpose |
|---|---|---|
| `regen.mjs` | `pnpm stats:regen [<projectPath>]` | Regenerate one project's `.pandacorp/stats.json` (the **universal write point**). |
| `sync-aggregate.mjs` | `pnpm stats:sync-aggregate` | Join every project's portada into the O(1) aggregate index. |
| `backfill.mjs` | `pnpm stats:backfill [<projectPath>…]` | One-shot: generate the initial portada for existing projects. |

## Universal write trigger — regenerate on every commit

The Informe mixes sources from many skills, so the write cannot depend on `/implement` closing.
Every change that affects the Informe ends in a **commit**, so the commit is the correct trigger
(FRD-23 §4). Wire `regen` to fire on commit via **either** mechanism (they are equivalent; use one):

**git `post-commit` hook** — in a project's `.git/hooks/post-commit` (cwd is the repo root):

```sh
#!/bin/sh
# Regenerate the materialized Informe portada after every commit (FRD-23, WO-23-004).
node --loader "<mc>/scripts/read-model/ts-loader.mjs" "<mc>/scripts/read-model/regen.mjs" || true
```

**Claude Code Stop hook** — the same `regen` call as a Stop hook so a session that edited docs/state
but did not commit through git still materializes on session end.

`regen` **degrades honestly** (DR-078): a project whose portada cannot be derived from git prints a
skip note and exits 0 — it never aborts the commit; MC's live-git fallback covers the gap. Only a
genuinely unexpected error propagates.

## Aggregate index — O(1) Informe

`/pandacorp:sync-portfolio` (which already walks every project) runs `sync-aggregate` at the end of
its portfolio refresh to join the N portadas into `<factory-root>/.pandacorp/stats-aggregate.json`.
MC reads that ONE file in O(1) — the Informe's cost stops scaling with the number of projects.
A missing/corrupt portada is reported and skipped (fail-loud), never a silent empty.

## Backfill — projects that predate the read-model

`pnpm stats:backfill` walks git once per existing project and writes its initial portada. Run it once
after shipping FRD-23; from then on the universal commit trigger keeps every portada fresh.

> The generated `.pandacorp/stats.json` (per project) and `.pandacorp/stats-aggregate.json` (factory
> root) are **gitignored runtime caches** — never committed; re-derivable at any time from git.
