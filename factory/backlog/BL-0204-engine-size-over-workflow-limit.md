---
id: BL-0204
type: bug
area: build-engine
title: "the build engine (567977 bytes at 9.115.0) exceeds the Workflow tool's 524288-byte script limit, so canary F1 could not launch"
status: done
severity: p0
opened: 2026-09-26
closed: 2026-09-26
source: "live: canary F1 launch refused by the Workflow tool (`Workflow script file …/.claude/engines/pandacorp-build.js exceeds 524288 bytes`)"
closes: "plugin/runtime/engine/pandacorp-build.src.js (moved source), plugin/scripts/generate-engine.mjs (new), plugin/templates/shared/.claude/engines/pandacorp-build.js (now generated), check-derived-drift.sh Check 8, test-engine-artifact.mjs (new) — edf6f186 (rename), 3811c6e3 (generator + artifact + gate), release 9.115.1"
links: [BL-0201, BL-0203, DR-113]
---

## Problem
Claude Code's `Workflow` tool refuses a script file over 524288 bytes. The engine grew past it with 9.115.0
(BL-0202 + BL-0203): 567977 bytes, where 9.113.0 (canary E2) was 521878 — already 99.5 % of the limit. Canary F1's
launch failed with `Workflow script file /Users/Shared/Proyectos/panda-corp-canary-f1/mission-control/.claude/engines/pandacorp-build.js exceeds 524288 bytes`
after the lease was taken (released by hand: `pandacorp-build-state.mjs release`, `status` → `lease:null`).

The file was ~36 % comments (203281 bytes) and ~5 % inter-token whitespace; the code and prompts are ~327 KB.

## Fix (as implemented)
- **Source ≠ artifact.** The readable engine moved (`git mv`, history kept) to `plugin/runtime/engine/pandacorp-build.src.js`;
  it is the only file anyone edits. `plugin/scripts/generate-engine.mjs` derives the deployable
  `plugin/templates/shared/.claude/engines/pandacorp-build.js`: comments dropped, inter-token whitespace collapsed (a gap
  that held a line terminator stays a newline so ASI sees the same lines; indentation kept at half width), every token
  copied byte-for-byte — string, template and regex literals are never touched. Zero-dependency tokenizer (the plugin
  ships no node_modules; esbuild is not installed anywhere in the repo). The banner goes right AFTER the `meta` literal,
  because a Workflow script must begin with `export const meta`.
- **Result:** 567977 → **351564 bytes** (−38 %, 172724 bytes under the limit).
- **Derivation gate:** `check-derived-drift.sh` Check 5 now regenerates the prompt fragments into the SOURCE; new Check 8
  runs `generate-engine.mjs --check` (RED on a stale or hand-edited artifact, or one over the limit).
  `plugin/runtime/source-graph.json` registers `build_engine` (source → artifact, generator).
- **Oracles (`test-engine-artifact.mjs`, 18 checks):** size ≤ 450000 bytes (fail-loud with the number); artifact ==
  generate(source); identical acorn ASTs (positions aside) + all 3911 string/template/regex literals byte-identical, with a
  negative control (one space inside a string is caught); tokenizer unit cases (comment markers inside templates, nested
  templates, regexes with slashes, division, ASI through a removed multi-line comment); the FULL `test-pandacorp-build.mjs`
  (317 scenarios) and `test-build-engine.mjs` (3) executed against the ARTIFACT (`PANDACORP_ENGINE_RUN=artifact`); a
  sabotaged artifact goes RED (negative control that the harness runs the file it is pointed at).
- Static source guards and every test that reads engine TEXT (`test-pandacorp-build.mjs`, `test-engine-lease-lifecycle.mjs`,
  `test-runtime-switch.mjs`, `test-whole-frd-gate-contract.mjs`, `check-rollup-writer-boundary.mjs`) read the source.
- Found on the way: the generator's first "am I the entry point?" guard compared `import.meta.url` with `argv[1]`; under a
  macOS `/var` → `/private/var` symlink it silently skipped `main()` (exit 0 = a fail-OPEN drift check). The drift
  self-test caught it (two new RED cases passed GREEN); it now compares real paths.

## Tests (RED → GREEN)
`test-check-derived-drift.sh` 30 → 33 (hand-edited artifact RED, source edited without regenerating RED, restored GREEN);
`test-engine-artifact.mjs` 18 (new); `run-engine-tests.sh` 27 → 28 suites, all green.

## Done when
- [x] The deployable engine is ≤ 400 KB (351564 bytes) with identical AST and behavior.
- [ ] **Not verified live**: the Workflow tool accepting the 351564-byte file (canary F1 relaunch).
