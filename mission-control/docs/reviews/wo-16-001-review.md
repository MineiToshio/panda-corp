# WO-16-001 — Review: `lib/orphans` scan (projects path + bounded folder listing)

**Verdict: APPROVED**

Reviewer: Opus (DR-015 cross-model). Work order: WO-16-001 (FRD-16, IF-16-scan).
Commit reviewed: `dd3be3b`. Files: `lib/orphans.ts`, `lib/orphans.test.ts`, `docs/api.md`.

## Evidence (re-run from clean, not trusting the self-report)

| Check | Command | Result |
|---|---|---|
| Tests (WO files) | `vitest run lib/orphans.test.ts` | **33/33 pass** |
| Lint | `biome check lib/orphans.ts lib/orphans.test.ts` | clean |
| Typecheck | `tsc --noEmit` (no orphans errors) | clean for WO scope |
| Adversarial (added) | `vitest run lib/orphans.adversarial.test.ts` | **16/16 pass** |
| Mutation: kill MC exclusion | manual | **2 tests fail** (not decorative) |
| Mutation: kill `.git` check | manual | **3 tests fail** (not decorative) |

The self-report flagged global RED in `verify.sh` from `docs.wo04001.test.ts`, `memory.test.ts`,
`timeline.review2.test.ts`. Verified independently: the only tsc error (`lib/memory.test.ts:685`) is in
an **untracked** WIP file from another WO — pre-existing, outside this scope. No orphans involvement.

## Lenses

**Correctness** — All 6 ACs met and verified by non-decorative tests: profile path returned verbatim
(.1), parent-dir fallback on absent/empty/whitespace/numeric/malformed profile (.2), bounded depth-1
scan (.3, mutation-confirmed), `.git` file-or-dir acceptance (.4), factory + mission-control exclusion
(.5, mutation-confirmed), unreadable path → `[]` no-throw (.6). Adversarial coverage added confirms
robustness the implementer did not test: trailing-slash / `..`-segment factory roots (normalized via
`path.resolve`), exact-name MC exclusion (substring projects like `mission-control-client` correctly
NOT hidden), dangling vs valid `.git` symlinks, symlinked children, YAML boolean/list/null
`projects_path`, `profile.md`-as-directory, determinism, and one-level depth guarantee.

**Security** — Read-only invariant (REQ-16-005) holds: `fs.accessSync`/`statSync`/`readdirSync` only,
no `git` subprocess, no writes, no network, no Claude. Tests assert the `.git` dir is byte-identical
before/after and no side-effect dirs/files are created. No injection surface (no shell, no string→exec).
No secrets. No new dependencies.

**Quality** — Scope is clean: diff touches only `orphans.ts`, `orphans.test.ts`, `docs/api.md`. No
production code outside the WO. No duplication — reuses `lib/profile.ts`. Strict typing, no `any`/
`@ts-ignore`. The MC dir name is a single named constant. Fail-soft is consistent.

## Findings

None blocking. None important.

**Minor (non-blocking, informational for downstream WOs):**
- `resolveProjectsPath` returns the profile path verbatim (trailing slashes preserved). This is the
  documented contract and the factory-root exclusion in `listProjectFolders` is normalization-proof
  (verified), so it is safe here. Downstream `classifyCandidate`/`getOrphans` (WO-16-002) should keep
  using `path.resolve` for any path equality against portfolio entries to avoid `/a` vs `/a/` mismatches.
- Symlinked children and `.git`-as-valid-symlink are currently treated as repos (statSync/accessSync
  follow links). Acceptable for a brownfield detector; documented in the new adversarial suite so the
  behavior is locked and intentional rather than incidental.

## Added by reviewer

`lib/orphans.adversarial.test.ts` (16 tests) — edge cases the implementer's suite did not exercise.
