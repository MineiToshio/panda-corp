#!/usr/bin/env bash
# Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.
# Installed VERBATIM into projects by /pandacorp:blueprint; re-synced + conformance-checked
# (drift => regenerate/fail) by /pandacorp:upgrade. Do NOT hand-edit per project — drift is RED.
# Every gate is fail-closed: a missing harness (smoke/visual) is RED, never a skip (DR-019/055/056).
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true  # bash 4.4+; no-op on macOS' bash 3.2 (avoids "invalid shell option")

# --- Optional scope: `verify.sh --since <sha>` (the fast per-FRD gate) ----------
# Runs only the vitest tests CHANGED since <sha>; biome/tsc/knip/madge stay global
# (fast enough, and they scale). The FULL unscoped suite runs at close-out (no --since).
SINCE=""
if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then SINCE="$2"; fi

# --- Structure guard (file placement isn't lintable; DR-059) -------------------
# Fail if any unit/component test sits loose outside a _tests/ folder.
stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)
if [ -n "$stray" ]; then
  echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; exit 1
fi

# --- Lint + format (every warn is a hard gate; --error-on-warnings) ------------
pnpm biome check . --error-on-warnings

# --- Typing -------------------------------------------------------------------
pnpm tsc --noEmit

# --- Dead code (fail-closed) --------------------------------------------------
pnpm knip

# --- Circular dependencies (fail-closed) --------------------------------------
pnpm madge --circular --extensions ts,tsx src

# --- Behavior -----------------------------------------------------------------
# shellcheck disable=SC2086
pnpm vitest run --reporter=dot ${SINCE:+--changed "$SINCE"}

# --- Preview Smoke Gate (DR-055) — FAIL-CLOSED: a missing harness is RED -------
if grep -q '"test:smoke"' package.json; then
  pnpm test:smoke
else
  echo "✗ Preview Smoke Gate missing: a web project must render its routes in a browser (DR-055). Add e2e/smoke.spec.ts + playwright.config.ts + the test:smoke script."; exit 1
fi

# --- Visual-Fidelity Gate Layer A (DR-056) — FAIL-CLOSED ----------------------
# (Layer B, the VLM mock-judge, is the reviewer's runtime/visual lens, not a script.)
if grep -q '"test:visual"' package.json; then
  pnpm test:visual
else
  echo "✗ Visual-Fidelity Gate missing: a UI project must diff its routes against blessed baselines (DR-056). Add e2e/visual.spec.ts + the test:visual script."; exit 1
fi
