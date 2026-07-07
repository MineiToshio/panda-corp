---
id: LESSON-0004
type: anti-pattern
domain: factory-engineering
tags: [upgrade, conformance, dr-059, dr-076, biome, gate-config, schema-version, red-lock, verification]
context: the /pandacorp:upgrade conformance check overwrote a project's canonical gate file (biome.json) that was NEWER and more correct than the stale plugin template, reverting a legitimate tool-version adaptation and red-locking the whole-project baseline gate on the next build resume
trigger: use this when an automated conformance/sync step is about to overwrite a project config from a template or other single-source-of-truth copy
source: "project personal-page-v2 — overlay upgrade 8.47.0→8.51.0 overwrote biome.json (project had schema 2.5.1 + preset:recommended for biome 2.5.1) with the template's stale schema 2.5.0 + deprecated recommended:true; biome 2.5.1 errors on that under --error-on-warnings, so the pass-2 baseline self-heal went RED and blocked the build (builtFrds:[], blockedReasons:{baseline:error}). CORROBORATED WORKING 2026-07-07 — a later /upgrade of the same project (overlay 8.51.0 to 8.69.0) hit a related case: `detect-gate-config-newer.sh` (the DR-076/BL-0003 backstop this lesson led to) returned `unknown` for `knip.json` (its schema is project-shaped — a custom `entry`/`ignores` list, not a simple comparable semver like biome's `$schema`), and the project's knip.json was correctly PRESERVED rather than blindly overwritten, per DR-094 — confirming the backstop's judgment call (preserve on `unknown`, don't force-template) holds in practice, not just in the original incident."
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: approved
confidence: high
times_applied: 0
links: [BL-0003, DR-076, DR-059, DR-048, LESSON-0002]
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

**Apply next time (the durable principle):** "The template is never behind a project" is an ASSUMPTION, not
an invariant — a project can legitimately run ahead when a pinned tool ships a config-format change before
the template catches up. A blind conformance overwrite that trusts that assumption can REVERT a real fix and
red-lock the very gate it protects. Two compounding traps: an automated overwrite must **detect
newer-than-source before clobbering** (compare tool/schema versions, back-port up, never silently
downgrade); and an "these two configs are equivalent" claim must be proven by running the **FULL gate**
(incl. `--error-on-warnings`) on both forms, not a hand sample of rule behavior. General shape: a
"single-source-of-truth sync" must verify the source really is ahead, and re-run the real gate after
syncing — never assume the sync is safe.

> The concrete guard (post-conformance project gate run in `/upgrade`, the newer-than-template detector, the
> DR-076 amendment) is an **actionable defect**, tracked as **BL-0003** in `factory/backlog/`, not part of
> this durable lesson (DR-103). The one-off biome 2.5.1 back-port already shipped (OVERLAY 8.52.0, plugin
> 9.36.1); BL-0003 is the systemic guard so the class can't recur.

**Why it matters:** the upgrade is supposed to make the gate runnable, not break it. A conformance step
that can silently downgrade a correct config and red-lock the baseline undermines the whole fail-closed
guarantee — and it cost a full build resume (baseline-blocked, manual repair) to discover. Sibling of
LESSON-0002 (both: a fidelity gap where an automated safeguard discarded correct work).
