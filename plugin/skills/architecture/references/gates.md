# The three plan gates, the fix pass and the flip (architecture steps 9, 9b, 9b-consistency, 9b2)

Three independent fresh-agent gates run **IN PARALLEL**, each in its own context (constitution §24), each
**JUDGE-tier** (opus, DR-111): self-certification risk, external-fidelity checking and contradiction-spotting are
the genuine-judgment work that tier exists for, never down-tiered. None of them is the author (constitution rule 4:
an author grading its own plan is self-certification, audit-20 P1-2). Each writes its report to
`docs/reviews/architecture-<gate>-gate.md` with a verdict line (`Verdict: PASS` or `Verdict: FAIL (<n> blockers)`),
blockers (each with the file, the fact and the fix) and advisories (never blocking).

## 0. Mechanical pre-checks: the lead runs them first

Before spawning the gates, the lead runs and attaches the outputs to the readiness gate's prompt, so the judges
spend their judgment on what a script cannot see (the scripts live in `${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/`):

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts"
node "$S/waves.mjs"              # waves from dependsOn: unknown ids, cycles, same-wave artifact overlap (brace-aware)
node "$S/ac-matrix.mjs"          # every live AC in exactly one WO, copied verbatim; README AC tables agree
node "$S/plan-consistency.mjs"   # frontmatter == Build Plan row == README row (dependsOn, artifacts, foundation, wave)
node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/check-fdd-coverage.mjs" --plan   # DR-130, UI projects
node -e 'JSON.parse(require("fs").readFileSync("docs/product/data-model.json","utf8"))'
bash .pandacorp/doc-lint.sh
bash .pandacorp/verify.sh --only=residual-ambiguity   # DR-100 markers, where the installed verify.sh offers it
grep -rl '^# OBSOLETE:' docs/ || true                  # tombstones the lead must git rm first
```

A red script is fixed BEFORE the gates run (it is cheaper than a gate finding it). Exit codes: 0 clean, 1 findings,
2 unreadable input (a read error is never a pass).

## 1. Readiness gate (step 9, DR-100)

Asserts fail-closed: every `REQ` maps to a component; **every `AC` is covered by exactly one WO** (the `ac-matrix`
output is its evidence); the data model has no `TBD`; `dependsOn` is acyclic and complete (`waves` output, plus the
judgment that every real coupling is an edge, DR-087a); wave artifacts are disjoint by design and complete (an
omitted artifact collides across FRDs in the global waves); the foundation is complete (DR-057/DR-075);
**no `[NEEDS CLARIFICATION]` survives**; **each backend WO's API contract has an owner**: a WO whose build step
materializes `docs/api/<wo-id>.md` BEFORE its consumer runs (the gate checks the plan assigns it, not that the file
exists, DR-060); the BL-0051 test-side supersession rule holds; and **every UI FRD plans only UI its frozen oracle
captures (DR-130)**: `check-fdd-coverage.mjs --plan` exits 0 (every FDD screen/state row cites a captured state with
its `oracle-states.json` entry, every control/string the FDD names is drawn in that FRD's captured states, and no
`blueprint.md` or work order names copy those states do not draw). A red caused by the FDD or the prototype is a
DESIGN defect: stop and route it back to `/pandacorp:design` (draw the missing state, or the owner takes the UI out
of the FRD); never plan around it, never edit the prototype or the oracle from here. Step 0b exists so this almost
never happens mid-phase.

## 2. Repo-grounding gate (step 9b, DR-102)

The readiness gate proves internal cohesion; this proves **external fidelity to the real repo**, the most effective
error-reducer for AI-built apps (it front-loads "context blindness": specs that are coherent yet cite framework APIs,
paths or versions the model only remembers). For EVERY concrete claim in `architecture.md`, the blueprints and the
work orders, check it against the scaffold installed in step 6: (a) every cited file/dir path (artifacts, `proxy.ts`
vs `middleware.ts`, route files, config) exists or is creatable as written under the installed framework's
conventions; (b) every cited framework API / convention / config key is current for the INSTALLED major (the
version-matched docs the project `AGENTS.md` points at, not training memory); (c) every dependency version named in
`architecture.md` is installed or carried as an exact `pnpm add <pkg>@<version>` in a WO (no version only in
prose), and none is a prerelease; (d) rendering/SSG and other hard guarantees are achievable as specified (verify
with a real `pnpm build` where it matters); (e) a module meant to run outside the framework (worker, CLI, scripts)
imports nothing framework-only (`server-only`, `next/cache` tags, request APIs). Altitude (DR-100): this validates
that the plan is grounded and current, not voluminous.

## 3. Contradiction gate (step 9b-consistency, DR-116)

Over `architecture.md`, the blueprints and the work orders: **no hard contradiction survives**: a WO contradicting
its FRD or blueprint, a blueprint asserting a stack/data-model fact `architecture.md` or the PRD denies, two
blueprints giving one artifact incompatible shapes, a value/term/entity meaning two things across the set, a
document contradicting a locked decision ADR. A freshly generated set has no supersession intent, so it must come
out coherent. Canonical: `factory/standards/document-consistency.md`.

## 4. One fix pass, deterministic re-verification, resolution addendum

- Collect the blockers of all three reports into one list; dispatch fixes per owner (authors for their FRDs, the
  reconciler for cross-FRD items, the PM for an FRD amendment). One pass.
- The lead re-runs every §0 check plus one targeted `grep` per blocker proving it is gone.
- The lead appends to each report that was FAIL:

  ```markdown
  ## Resolution addendum (YYYY-MM-DD)

  Every blocker above was fixed in one pass (commit <sha>) and re-verified by the lead: <the §0 commands, each
  clean>, and a targeted grep for each blocker (<one line each>). Verdict after resolution: PASS.
  ```

- A **second full gate run** happens only when a fix changed scope (an FRD's ACs, the data model, the WO set or a
  locked decision). Otherwise the addendum is the evidence. Tell the owner "gates passed" (milestone 3).

## 5. Delta review (a later iteration, or a mid-phase owner change)

When the plan already passed and something changes (an owner decision reversed, an FRD amended, a design state
added), do not regenerate and do not run three full gates: re-plan only what changed, then run each gate as a
**delta review scoped to `git diff <last-gated-commit>`** (the same three judges' questions, over the changed files
and whatever they reference), appended to the same report as `## Delta review YYYY-MM-DD (<topic>)` with its own
verdict, then the same fix pass + addendum. The stamps keep their meaning: the docs passed all three gates, now
including the delta.

## 6. The DRAFT → ACTIVE flip (step 9b2)

Owned HERE, with the evidence stamp (audit-20 P1-3/P1-1):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/flip-active.mjs" --dry-run   # what would change
node "${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/flip-active.mjs"             # flip + stamp
```

It refuses unless the three reports' LAST verdict is PASS (a pass, or a FAIL followed by the addendum's "Verdict
after resolution: PASS") AND `waves` / `ac-matrix` / `plan-consistency` are green. It then sets each blueprint's
`status: ACTIVE` with `readiness_gate` / `grounding_gate` / `consistency_gate: passed YYYY-MM-DD` in the same
frontmatter, and flips every DRAFT work order to `ACTIVE`. The stamp is what makes the gates checkable downstream:
`/pandacorp:implement`'s preflight refuses an ACTIVE blueprint without the three fields, and `verify.sh`'s DR-100
scan covers the rest. Never flip on a partial pass, never flip to silence a gate. (The PRD/FRDs' own ACTIVE flip
belongs to `spec`.)
