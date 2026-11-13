---
id: BL-0313
type: bug
area: build-engine
title: "Make the unit report directory writable for sandboxed Codex workers"
status: done
severity: p1
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-01"
closes: "plugin 10.3.0 — codex-worker --writable-dir (codex --add-dir) for the unit report dir"
links: [DR-152, DR-153]
---

## Problem
The Codex relay (`plugin/scripts/codex-worker.mjs` direct mode, argv from `plugin/runtime/build/workers.mjs`
`buildWorkerArgv`) runs `codex exec -s workspace-write -C <unit worktree>`. The brief's `report_path` is
`.pandacorp/run/build/units/<unit>/report.json`, outside the worktree, so the sandbox denies the write
("Escritura del report_path también denegada por el sandbox" in funko-tracker run `br-2026-11-13-01`).

## Root cause
Only the `-C` workspace is writable under `workspace-write`; the report directory was never added as a writable root.

## Fix plan
`codex-worker.mjs` accepts a repeatable `--writable-dir <abs dir>` and forwards each as `--add-dir <dir>` under the
sandbox access (never under full access; never the project root, a `.git` dir or a missing/relative path).
`buildWorkerArgv` passes the unit's own `build/units/<unit>/` directory. `.git` stays read-only.

## Tests (prove the fix — TDD, RED → GREEN)
`test-build-v2-workers.mjs`: argv carries `--writable-dir <unitDir>`. `test-codex-worker-direct.mjs`: codex exec gets
`--add-dir <dir>`; a relative, missing or project-root dir is refused; full access adds none.

## Done when
Both suites green; CLI reference notes the writable dir; plugin bumped.
