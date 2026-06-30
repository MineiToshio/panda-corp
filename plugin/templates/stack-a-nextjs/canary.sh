#!/usr/bin/env bash
# Gate canary (DR-079) — prove each fail-closed gate STILL goes RED on a deliberately-broken input.
# A gate that stays GREEN on broken input has ROTTED (a disabled lint rule, a swallowed exit code, a
# renamed/undiscovered spec) and THAT is the failure this catches — the anti-cheat companion to the
# constitution's principle 24 ("every gate is periodically proven to still go RED on a broken input").
#
# Invoked ONLY by `verify.sh --canary` (which /pandacorp:upgrade runs), NEVER on a normal build — so
# the broken inputs it generates can never red-lock a real run. It keeps NO broken files in the repo:
# each check GENERATES its fixture under a `__canary__/` sandbox, feeds it to the gate, asserts the
# gate REJECTS it, then deletes it (a trap cleans up even on interrupt). `canary.sh`'s exit code IS the
# verdict: 0 = every canaried gate correctly went RED; 1 = at least one gate rotted.
#
# Managed by Pandacorp — installed VERBATIM to `.pandacorp/canary.sh` and conformance-checked by
# /pandacorp:upgrade. Don't hand-edit (drift fails conformance). The bash logic of the structure guard
# and the DR-100 gate is MIRRORED from verify.sh — keep the two in sync (they ship as the same template
# set, so they stay aligned across projects).
#
# COVERAGE — every fail-closed gate verify.sh runs:
#   biome (lint+format) · test-placement structure guard · DR-100 readiness · tsc (types) ·
#   madge (circular deps) · vitest (tests) · knip (dead code) · Playwright spec DISCOVERY
#   (smoke/visual/responsive/shell — proves the config still finds the specs so the e2e layer can't
#   pass vacuously, the DR-075 rot; a full browser run is intentionally NOT canaried — too slow/flaky
#   for an on-demand check, and the discovery + presence + conformance checks cover the rot modes).
# `doc-lint.sh` is NOT canaried — it is ADVISORY (always exits 0 by design), so "still goes RED" does
# not apply to it.
set -uo pipefail   # NOT `-e`: these gates are SUPPOSED to fail here; we check their exit codes ourselves.

SBX_SRC="src/__canary__"
SBX_DOCS="docs/__canary__"
TSCONFIG=".pandacorp/.canary-tsconfig.json"
checks=0
rotted=0

cleanup() { rm -rf "$SBX_SRC" "$SBX_DOCS" "$TSCONFIG"; }
trap cleanup EXIT
cleanup   # start clean (in case a previous run was interrupted)

pass() { echo "✓ canary: gate '$1' correctly REJECTED its broken fixture."; checks=$((checks + 1)); }
rot() {
  echo "✗ CANARY: gate '$1' stayed GREEN on a deliberately-broken input — it has ROTTED (it can no longer fail). Fix the GATE, not this canary."
  checks=$((checks + 1)); rotted=$((rotted + 1))
}
# True when the command FAILS (non-zero) — i.e. the gate correctly rejected the broken input.
reddened() { ! "$@" >/dev/null 2>&1; }

# --- 1) biome (lint + format) — the real `biome check … --error-on-warnings` -----------------------
# A forbidden `any` (noExplicitAny) + bad formatting. If a rule was disabled, format turned off, or the
# exit code is swallowed, biome stays green → rotted.
mkdir -p "$SBX_SRC"
printf 'export function canaryRot(value:any){return value}\n' > "$SBX_SRC/lint_violation.ts"
if reddened pnpm biome check "$SBX_SRC/lint_violation.ts" --error-on-warnings; then pass "biome (lint+format)"; else rot "biome (lint+format)"; fi
rm -f "$SBX_SRC/lint_violation.ts"

# --- 2) test-placement structure guard (mirrors verify.sh) -----------------------------------------
# verify.sh REDs a *.test.ts(x) outside a `_tests/` folder. Plant one and run the same find.
printf 'export const canary = 1;\n' > "$SBX_SRC/stray.test.ts"
stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)
if [ -n "$stray" ]; then pass "structure-guard (stray test outside _tests/)"; else rot "structure-guard (stray test outside _tests/)"; fi
rm -f "$SBX_SRC/stray.test.ts"

# --- 3) DR-100 residual-ambiguity gate (mirrors verify.sh) -----------------------------------------
# verify.sh REDs a [NEEDS CLARIFICATION] marker in a `status: ACTIVE` doc. Plant one and run the check.
mkdir -p "$SBX_DOCS"
cat > "$SBX_DOCS/active-with-marker.md" <<'MD'
---
status: ACTIVE
---
[NEEDS CLARIFICATION: canary fixture — an ACTIVE doc with this marker MUST be rejected]
MD
dr100=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if head -n 25 "$f" | grep -Eq '^status:[[:space:]]*ACTIVE'; then dr100="found"; fi
done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)
if [ -n "$dr100" ]; then pass "DR-100 readiness (marker in an ACTIVE doc)"; else rot "DR-100 readiness (marker in an ACTIVE doc)"; fi
rm -rf "$SBX_DOCS"

# --- 4) tsc (strict types) — isolated via a temp tsconfig that compiles ONLY the broken file -------
# A self-contained type error (no imports → no alias/project coupling). The temp tsconfig runs tsc in
# strict mode on just that file, so a pre-existing project error can never mis-attribute this check.
mkdir -p "$SBX_SRC"
printf 'export const canaryType: number = "not a number";\n' > "$SBX_SRC/type_error.ts"
cat > "$TSCONFIG" <<'JSON'
{
  "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true, "types": [], "module": "esnext", "target": "esnext", "moduleResolution": "bundler", "isolatedModules": true },
  "include": ["../src/__canary__/type_error.ts"]
}
JSON
if reddened pnpm tsc --noEmit -p "$TSCONFIG"; then pass "tsc (strict types)"; else rot "tsc (strict types)"; fi
rm -f "$SBX_SRC/type_error.ts" "$TSCONFIG"

# --- 5) madge (circular dependencies) — scoped to the sandbox --------------------------------------
# Two files that import each other. madge --circular exits non-zero when it finds a cycle. Scoped to
# the sandbox so a pre-existing project cycle (there shouldn't be one — verify.sh forbids it) can't
# mis-attribute.
printf 'import "./cycle_b";\nexport const a = 1;\n' > "$SBX_SRC/cycle_a.ts"
printf 'import "./cycle_a";\nexport const b = 1;\n' > "$SBX_SRC/cycle_b.ts"
if reddened pnpm madge --circular --extensions ts,tsx "$SBX_SRC"; then pass "madge (circular deps)"; else rot "madge (circular deps)"; fi
rm -f "$SBX_SRC/cycle_a.ts" "$SBX_SRC/cycle_b.ts"

# --- 6) vitest (tests) — a deliberately-failing test, scoped to the sandbox ------------------------
mkdir -p "$SBX_SRC/_tests"
cat > "$SBX_SRC/_tests/fail.test.ts" <<'TS'
import { expect, test } from "vitest";

test("canary — a deliberately failing assertion (the test gate MUST report this red)", () => {
  expect(1).toBe(2);
});
TS
if reddened pnpm vitest run "$SBX_SRC"; then pass "vitest (failing test)"; else rot "vitest (failing test)"; fi
rm -rf "$SBX_SRC/_tests"

# --- 7) knip (dead code) — an orphan file no entry imports -----------------------------------------
# knip reports unused files; an unreferenced file under src is dead → non-zero. Runs project-wide (the
# way verify.sh does); a green project has a clean knip, so the orphan is the only finding.
printf 'export const canaryOrphan = 42;\n' > "$SBX_SRC/orphan.ts"
if reddened pnpm knip; then pass "knip (dead code)"; else rot "knip (dead code)"; fi
rm -f "$SBX_SRC/orphan.ts"

# --- 8) Playwright spec DISCOVERY (smoke/visual/responsive/shell) ----------------------------------
# Not a browser run (too slow/flaky on demand) — instead prove the config still DISCOVERS every e2e
# spec, so the gate can't pass vacuously when a spec is renamed/moved or testDir drifts (the DR-075
# "112/112 green with no shell" failure mode lived right next to this). `--list` is fast and boots no
# webServer. Skips gracefully when there is no playwright config (a non-UI project).
if [ -f playwright.config.ts ]; then
  listing=$(pnpm exec playwright test e2e/ --list 2>/dev/null || true)
  missing=""
  for spec in smoke visual responsive shell; do
    printf '%s' "$listing" | grep -q "${spec}.spec.ts" || missing="$missing $spec"
  done
  if [ -z "$missing" ]; then
    pass "playwright (spec discovery: smoke/visual/responsive/shell)"
  else
    rot "playwright (specs NOT discovered:$missing — config testDir/glob rotted → the e2e gate would pass vacuously)"
  fi
else
  echo "• canary: gate 'playwright (spec discovery)' skipped — no playwright.config.ts (non-UI project)."
fi

# --- Verdict ---------------------------------------------------------------------------------------
echo "── canary: $((checks - rotted))/$checks gate(s) proven still-RED on broken input (DR-079) ──"
if [ "$rotted" -gt 0 ]; then
  echo "✗ CANARY FAILED: $rotted gate(s) did not reject broken input — they have rotted and no longer protect the build."
  exit 1
fi
echo "✓ canary passed: every canaried gate still goes RED on a broken input."
exit 0
