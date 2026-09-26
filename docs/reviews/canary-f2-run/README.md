# Canary F2 — archived runtime artifacts

- **Branch:** `canary-f2` (archived as tag `archive/canary-f2`)
- **Final SHA:** `3ef9446f` (`chore(canary): archive F2 runtime artifacts (usage summary)`), on top of the run's own last commit `b4e5fc34` (`chore: quiesce Claude build lease`)
- **Workflow id:** `wf_8bab7752-702`
- **Duration / cost:** 76.3 min / $30.63 (measured; matches `track.jsonl`'s trailing `usage_summary` line, `cost_usd_total: 30.625194`, `calls_total: 960`)
- **Report:** `docs/reviews/canary-f2-report.md`

## Contents

| Path | What it is |
|---|---|
| `track.jsonl` | Full build track log (`mission-control/.pandacorp/track.jsonl`) including the appended `usage_summary` |
| `build-journal.jsonl` | Build engine journal (`mission-control/.pandacorp/build-journal.jsonl`) |
| `gate-report.json` | Top-level gate report (`mission-control/.pandacorp/run/gate-report.json`) |
| `lessons.md` | Provisional self-learning capture from this run (`mission-control/.pandacorp/run/lessons.md`) |
| `comms/progress.md`, `comms/visual-punch-list.md` | Owner-facing narrative artifacts from the run |
| `gate-evidence/**` | Per-FRD gate evidence (gate reports, drift probes, reviewer-authored test files) |

## Omitted

- `mission-control/.pandacorp/run/drift-proof/` was empty (0 B) — nothing to copy.
- No standalone `drift-probes/` directory existed for this run (unlike F1); all its drift probes live under `gate-evidence/**/drift/`.
- No `usage-rollup*`/`*.rollup.json` file exists in this worktree (the rollup script exists at `plugin/scripts/usage-rollup.mjs` but produced no output file here).
- Nothing was omitted for size — the largest file copied is well under 1 MB. `node_modules`, `.next` build caches and the nested `gate-worktree-*` git worktrees under `mission-control/.pandacorp/run/` were never copied (reconstructible build artifacts, not runtime evidence).
