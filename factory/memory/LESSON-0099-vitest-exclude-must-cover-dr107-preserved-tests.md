---
id: LESSON-0099
type: gotcha
domain: build-orchestration
tags: [vitest, dr-107, preserved-tests, exclude, gate]
context: a project's `vitest.config.ts` `exclude` list, on a project that uses DR-107's preserved-test archives (the gate-reject mechanism that keeps a reviewer-authored test file instead of discarding it)
trigger: use this when scaffolding or auditing a project's vitest config and the project's build can revert/reopen a work order (DR-107 is standard on any Pandacorp-built project)
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (rebuilding WO-23-004) — agent-inferred; fix already present in mission-control/vitest.config.ts. CORROBORATED on a second, distinct project — personal-page-v2 .pandacorp/run/lessons.md 2026-09-08/09 (agent-inferred): the same gap under a DIFFERENT `.pandacorp/run/` subpath — the build engine's own `gate-worktree` (created to re-gate a patch) was left on disk after the gate closed, and `vitest run --changed` globbed its test files, running them against the main checkout with a SECOND copy of React resolved from the gate-worktree's own node_modules; symptom was 70-179 tests red with `Cannot read properties of null (reading 'useEffect'/'useRef')`, none of them real regressions. Adding `--exclude '.pandacorp/**'` (superset of `.pandacorp/run/**`) made the suite pass 305/305."
provenance: agent-inferred
created: 2026-07-07
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-107, LESSON-0124, LESSON-0125]
---

**Situation:** DR-107's preserved-test archives live in gitignored `.pandacorp/run/preserved-tests/<WO>/` —
kept there so a revert doesn't discard a reviewer-authored/Status-Note-referenced test. vitest's default
`include` glob (`**/*.{test,spec}.{ts,tsx}`) collects test files from ANYWHERE matching that pattern,
including that archive location. But a preserved test's relative repo-root resolution (e.g.
`path.resolve(HERE, "../../../../..")`) assumes it runs from ITS staged location under `src/**/_tests/`,
not from the archive path several directories removed — run from the archive, it resolves the wrong root
and fails spuriously, looking like a real regression.

**Lesson:** a vitest config on any project using DR-107 preserved-test archives must EXCLUDE
`.pandacorp/run/**` explicitly — preserved tests are meant to be re-staged into `src/**/_tests/` by the
FRD gate machinery when they're needed again, never collected directly from their archive resting place.

**Apply next time:** when scaffolding a new project's `vitest.config.ts`, or auditing an existing one,
confirm the `exclude` array includes `.pandacorp/run/**` (or its superset `.pandacorp/**`) alongside the
usual `node_modules`/`e2e` exclusions — this is now already fixed in mission-control's own
`vitest.config.ts` (with an inline comment explaining why); apply the same exclude when standing up vitest
for a new project or template. Corroborated on a second project (personal-page-v2) via a different
subdirectory of the same gitignored root (the build engine's own `gate-worktree`, not DR-107's
preserved-tests archive) — this is the SAME structural gap LESSON-0124/LESSON-0125 track (a whole-tree
glob has no innate reason to skip a gitignored, code-bearing subdirectory the project doesn't expect to be
"someone else's tree"), so treat `.pandacorp/**` as a standing exclude requirement for any vitest config on
a Pandacorp-built project, not a one-off fix for a single known subpath.
