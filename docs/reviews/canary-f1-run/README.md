# Canary F1 — archived runtime artifacts

- **Branch:** `canary-f1` (archived as tag `archive/canary-f1`)
- **Final SHA:** `7d40bea8` (`chore(canary): archive F1 runtime artifacts (usage summary)`), on top of the run's own last commit `a24d3a41` (`chore: quiesce Claude build lease`)
- **Workflow id:** `wf_d8545504-d0a`
- **Duration / cost:** 83.5 min / $44.04 (measured; matches `track.jsonl`'s trailing `usage_summary` line, `cost_usd_total: 44.042961`, `calls_total: 948`)
- **Report:** `docs/reviews/canary-f1-report.md`

## Contents

| Path | What it is |
|---|---|
| `track.jsonl` | Full build track log (`mission-control/.pandacorp/track.jsonl`) including the appended `usage_summary` |
| `build-journal.jsonl` | Build engine journal (`mission-control/.pandacorp/build-journal.jsonl`) |
| `gate-report.json` | Top-level gate report (`mission-control/.pandacorp/run/gate-report.json`) |
| `lessons.md` | Provisional self-learning capture from this run (`mission-control/.pandacorp/run/lessons.md`) |
| `comms/progress.md`, `comms/visual-punch-list.md` | Owner-facing narrative artifacts from the run |
| `gate-evidence/**` | Per-FRD gate evidence (gate reports, drift probes, reviewer-authored test files) |
| `drift-probes/**` | Standalone drift probe(s) captured outside the per-FRD evidence folders |

## Omitted

- No `usage-rollup*`/`*.rollup.json` file exists in this worktree (the rollup script exists at `plugin/scripts/usage-rollup.mjs` but produced no output file here).
- Nothing was omitted for size — the largest file copied is well under 1 MB. `node_modules`, `.next` build caches and the nested `gate-worktree-*` git worktrees under `mission-control/.pandacorp/run/` were never copied (reconstructible build artifacts, not runtime evidence).
