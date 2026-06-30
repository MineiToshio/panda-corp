---
id: LESSON-0004
type: anti-pattern
domain: factory-engineering
tags: [upgrade, conformance, dr-059, dr-076, biome, gate-config, schema-version, red-lock, verification]
context: the /pandacorp:upgrade conformance check overwrote a project's canonical gate file (biome.json) that was NEWER and more correct than the stale plugin template, reverting a legitimate tool-version adaptation and red-locking the whole-project baseline gate on the next build resume
source: project personal-page-v2 — overlay upgrade 8.47.0→8.51.0 overwrote biome.json (project had schema 2.5.1 + preset:recommended for biome 2.5.1) with the template's stale schema 2.5.0 + deprecated recommended:true; biome 2.5.1 errors on that under --error-on-warnings, so the pass-2 baseline self-heal went RED and blocked the build (builtFrds:[], blockedReasons:{baseline:error})
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: proposed
confidence: high
times_applied: 0
links: [DR-076, DR-059, DR-048, LESSON-0002]
---

**Situation:** /pandacorp:upgrade ran as the implement preflight (8.47.0→8.51.0). Its DR-059 conformance
step overwrites canonical gate files (biome.json, knip.json, verify.sh, e2e specs) verbatim from the
plugin template, on the doctrine that the template is the single source of truth and is never behind a
project (DR-076). But here the project's biome.json was NEWER than the template: it carried
`"$schema": .../2.5.1/...` + `"preset": "recommended"` (the form biome 2.5.1 requires), while the template
was stale at schema 2.5.0 + the now-deprecated `"recommended": true`. The conformance overwrite reverted
the project to the stale form. The agent (me) DID notice the divergence at upgrade time and tested it, but
the test was insufficient: it checked biome's RULE enforcement (`biome lint` caught a `==` violation under
both forms → "functionally identical") and NOT `biome check --error-on-warnings` on the config file
itself. Under the full gate, biome 2.5.1 ERRORS on the 2.5.0 schema + the deprecated `recommended` field;
with `--error-on-warnings` that red-locks the whole-project baseline. It did not surface in pass-1 because
the per-FRD gates run `verify.sh --since` (biome lints only changed files, not the untouched biome.json);
the pass-2 baseline self-heal runs the FULL verify.sh → caught it → blocked the build.

**Lesson:** DR-076's "the template is never behind a project" is an ASSUMPTION, not an invariant — a
project can legitimately run ahead when a pinned tool (here biome) ships a config-format change before the
template catches up. When that happens, blind conformance overwrite (DR-059's unconditional guarantee)
REVERTS a real fix and can red-lock the gate it is meant to protect. Two compounding failures: (1) the
upgrade reverted a newer-than-template config; (2) the at-upgrade "functionally identical" check tested
rule behavior, not the config file passing its own gate (`--error-on-warnings`). A conformance overwrite
must not be trusted as safe just because the two files lint the same code the same way.

**Apply next time (concrete, owner-directed 2026-06-30 — document well to fix well later):**

1. **Upgrade must run the gate AFTER re-syncing conformance files, on the project (DR-079 canary is not
   enough).** After the DR-059 overwrite, /pandacorp:upgrade should run `verify.sh` (or at least
   `biome check --error-on-warnings` + `knip` + `tsc`) on the project and FAIL LOUD if the freshly-synced
   config red-locks the gate — instead of leaving a broken baseline for the next build to discover. The
   canary proves gates still bite on a broken fixture; it does NOT prove the project itself still passes
   after the overwrite. Implement in `plugin/skills/upgrade/SKILL.md` (a post-conformance project gate
   run) + note in `factory/standards/build-orchestration.md`.

2. **Detect "project config newer than template" before overwriting (DR-076 amendment).** When a canonical
   gate file diverges, the loud back-port detector should compare tool/schema versions (e.g. biome
   `$schema` URL vs the installed tool version in package.json): if the PROJECT's is newer/correct for the
   installed tool, the resolution is to back-port the project's version to the template FIRST, then
   overwrite (no-op) — never silently downgrade the project to a stale template. Strengthen the back-port
   detector in `plugin/skills/upgrade/SKILL.md`.

3. **When an agent claims two config forms are "functionally identical", the proof must include the FULL
   gate, not a hand sample.** Run `verify.sh` (or the exact gate command incl. `--error-on-warnings`) on
   BOTH forms before overwriting — never conclude equivalence from a partial check.

4. **Back-port already applied this session:** `plugin/templates/stack-a-nextjs/biome.json` → schema 2.5.1
   + preset; `OVERLAY_VERSION` 8.51.0→8.52.0; plugin 9.36.0→9.36.1. The project was unblocked in-tree
   (committed `34934fc`, `last_green_sha` updated). Activation for other projects: `claude plugin update
   pandacorp@panda-corp` + their next `/upgrade`.

**Why it matters:** the upgrade is supposed to make the gate runnable, not break it. A conformance step
that can silently downgrade a correct config and red-lock the baseline undermines the whole fail-closed
guarantee — and it cost a full build resume (baseline-blocked, manual repair) to discover. Sibling of
LESSON-0002 (both: a fidelity gap where an automated safeguard discarded correct work).
