#!/usr/bin/env bash
# Gate canary (DR-079) — prove each fail-closed gate STILL goes RED on a deliberately-broken input.
# A gate that stays GREEN on broken input has ROTTED (a disabled lint rule, a swallowed exit code, a
# renamed check) and THAT is the failure this catches — the anti-cheat companion to the constitution's
# "every gate is periodically proven to still go RED on a deliberately broken input" (principle 24).
#
# Invoked ONLY by `verify.sh --canary` (which /pandacorp:upgrade runs), NEVER on a normal build — so
# the broken inputs it generates can never red-lock a real run. It keeps NO broken files in the repo
# (no import/scan risk): each check GENERATES its broken input under a `__canary__/` sandbox, feeds it
# to the gate, asserts the gate REJECTS it, then deletes it. canary.sh's exit code IS the verdict:
#   0 = every canaried gate correctly went RED on its broken fixture;
#   1 = at least one gate stayed GREEN on broken input → it has rotted and no longer protects the build.
#
# Managed by Pandacorp — installed VERBATIM to `.pandacorp/canary.sh` and conformance-checked by
# /pandacorp:upgrade. Don't hand-edit (drift fails conformance). The bash logic of the structure guard
# and the DR-100 gate is MIRRORED from verify.sh — keep the two in sync (they ship as the same template
# set, so they stay aligned across projects).
#
# v1 SCOPE: the cheap, deterministic, config-rot-prone gates — biome (the real `biome check …
# --error-on-warnings`, which is where a silently-disabled rule or swallowed exit code hides), the
# test-placement structure guard, and the DR-100 readiness gate. The heavier gates (tsc, vitest, knip,
# the Playwright smoke/visual/responsive/shell layer) need a whole-project compile or a running app
# and are the documented next additions — until then they are simply not canaried (never falsely RED).
set -uo pipefail   # NOT `-e`: these gates are SUPPOSED to fail here; we check their exit codes ourselves.

CANARY_SRC="src/__canary__"
CANARY_DOCS="docs/__canary__"
checks=0
rotted=0

cleanup() { rm -rf "$CANARY_SRC" "$CANARY_DOCS"; }
trap cleanup EXIT
cleanup   # start clean (in case a previous run was interrupted)

pass() { echo "✓ canary: gate '$1' correctly REJECTED its broken fixture."; checks=$((checks + 1)); }
rot() {
  echo "✗ CANARY: gate '$1' stayed GREEN on a deliberately-broken input — it has ROTTED (it can no longer fail). Fix the GATE, not this canary."
  checks=$((checks + 1)); rotted=$((rotted + 1))
}

# --- 1) biome (lint + format) — the real command verify.sh runs ------------------------------------
# Mirrors verify.sh's `biome check . --error-on-warnings`, scoped to a file with a forbidden `any`
# (noExplicitAny) AND bad formatting. If a rule was disabled, format turned off, or the exit code is
# swallowed, biome stays green → rotted.
mkdir -p "$CANARY_SRC"
printf 'export function canaryRot(value:any){return value}\n' > "$CANARY_SRC/lint_violation.ts"
if pnpm biome check "$CANARY_SRC/lint_violation.ts" --error-on-warnings >/dev/null 2>&1; then
  rot "biome (lint+format)"
else
  pass "biome (lint+format)"
fi

# --- 2) test-placement structure guard (mirrors verify.sh) -----------------------------------------
# verify.sh REDs a *.test.ts(x) sitting outside a `_tests/` folder. Plant one and run the same find.
printf 'export const canary = 1;\n' > "$CANARY_SRC/stray.test.ts"
stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)
if [ -n "$stray" ]; then
  pass "structure-guard (stray test outside _tests/)"
else
  rot "structure-guard (stray test outside _tests/)"
fi

# --- 3) DR-100 residual-ambiguity gate (mirrors verify.sh) -----------------------------------------
# verify.sh REDs a [NEEDS CLARIFICATION] marker in a `status: ACTIVE` doc. Plant one and run the check.
mkdir -p "$CANARY_DOCS"
cat > "$CANARY_DOCS/active-with-marker.md" <<'MD'
---
status: ACTIVE
---
[NEEDS CLARIFICATION: canary fixture — an ACTIVE doc with this marker MUST be rejected]
MD
flagged=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if head -n 25 "$f" | grep -Eq '^status:[[:space:]]*ACTIVE'; then flagged="$flagged $f"; fi
done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)
if [ -n "$flagged" ]; then
  pass "DR-100 readiness (marker in an ACTIVE doc)"
else
  rot "DR-100 readiness (marker in an ACTIVE doc)"
fi

# --- Verdict ---------------------------------------------------------------------------------------
echo "── canary: $((checks - rotted))/$checks gate(s) proven still-RED on broken input (DR-079) ──"
if [ "$rotted" -gt 0 ]; then
  echo "✗ CANARY FAILED: $rotted gate(s) did not reject broken input — they have rotted and no longer protect the build."
  exit 1
fi
echo "✓ canary passed: every canaried gate still goes RED on a broken input."
exit 0
