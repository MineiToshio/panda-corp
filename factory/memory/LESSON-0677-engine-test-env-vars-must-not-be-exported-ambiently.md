---
id: LESSON-0677
type: gotcha
domain: factory-engineering
tags: [build-engine, test-suite, env-vars, pandacorp-test-tmp, pandacorp-skip-ledger-output-check, test-check-derived-drift]
context: a build-engine test-internal env var exported into the ambient shell (rather than set inline per invocation) silently breaks unrelated test suites
trigger: use this when running or debugging plugin/scripts/test-build-v2-*.mjs or plugin/scripts/test-check-derived-drift.sh and a suite fails with no obvious code-level cause
source: "mission-control .pandacorp/run/lessons.md 2026-11-11 (agent-inferred): exporting PANDACORP_TEST_TMP pointing at a nonexistent folder red-locked almost every test-build-v2-* suite; a global PANDACORP_SKIP_LEDGER_OUTPUT_CHECK=1 (rather than the value check-derived-drift.sh sets internally for its own invocation) made test-check-derived-drift.sh fail"
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** two build-engine env vars that are meant to be set INLINE for one specific invocation —
`PANDACORP_TEST_TMP` (the scratch root `test-build-v2-cli.mjs` and siblings use instead of `os.tmpdir()`)
and `PANDACORP_SKIP_LEDGER_OUTPUT_CHECK` (a toggle `check-derived-drift.sh` itself exports internally,
`=1`, for its own narrower purpose) — were instead exported into the ambient shell session. `PANDACORP_TEST_TMP`
pointing at a directory that didn't exist red-locked nearly every `test-build-v2-*` suite that reads it;
a global `PANDACORP_SKIP_LEDGER_OUTPUT_CHECK=1` left set outside `check-derived-drift.sh`'s own control
broke `test-check-derived-drift.sh`.

**Lesson:** these are test-internal fixture/control env vars, not ambient configuration. A test suite that
reads `process.env.PANDACORP_TEST_TMP || os.tmpdir()` (or an equivalent fallback) will use whatever is
exported in the CURRENT shell for every later invocation in that session, not just the one that needed it
— a stale or invalid value silently poisons unrelated runs. Likewise, a script that manages its own toggle
internally (`check-derived-drift.sh` sets `PANDACORP_SKIP_LEDGER_OUTPUT_CHECK=1` itself at the point it
needs it) assumes it controls that variable; pre-setting it globally breaks that assumption.

**Apply next time:** set a build-engine test-fixture env var INLINE for the single command that needs it
(`PANDACORP_TEST_TMP=/some/real/dir node plugin/scripts/test-build-v2-cli.mjs`), never `export` it into the
shell session; and never manually pre-set a toggle a script is documented to manage internally
(`PANDACORP_SKIP_LEDGER_OUTPUT_CHECK`) — let the owning script set/unset it. If a suite fails for no
apparent code reason, check `env | grep PANDACORP_` for a leftover export from an earlier command in the
same session before suspecting the code.
