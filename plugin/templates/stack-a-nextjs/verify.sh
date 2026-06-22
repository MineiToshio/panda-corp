#!/usr/bin/env bash
# Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.
# Installed VERBATIM into projects by /pandacorp:blueprint; re-synced + conformance-checked
# (drift => regenerate/fail) by /pandacorp:upgrade. Do NOT hand-edit per project — drift is RED.
# Every gate is fail-closed: a missing harness (smoke/visual) is RED, never a skip (DR-019/055/056).
# This script is ALWAYS strict — it never softens itself. The build engine drives it (`--since`
# per FRD, full at close-out). The PHASE-AWARENESS lives in the Stop hook (verify-before-stop.sh,
# DR-063): that wrapper skips THIS gate while a build is active so it doesn't block every turn;
# the engine keeps running this strictly. So: hook = phase-aware; verify.sh = always strict.
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

# --- Doc-structure lint (DR-077) — frontmatter + stable-ID spine; vacuous if no docs ----
# Validates generated docs (FRD/PRD/work-orders) carry required frontmatter and that REQ->WO IDs
# resolve. ADVISORY — it reports drift and NEVER fails the gate (so it can't red-lock an adopted /
# partial-spine project); a project with no docs/ passes. The harness is new, so a missing script is
# a no-op (older overlays); /pandacorp:upgrade installs it. Drift is surfaced here, NOT tracked by a
# per-doc version stamp (DR-077).
if [ -f .pandacorp/doc-lint.sh ]; then
  bash .pandacorp/doc-lint.sh
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

# --- Responsive Gate (DR-074) — FAIL-CLOSED -----------------------------------
# Smart per-scroll-root overflow / silent-clip / tap-target / fixed-occlusion checks at the mobile
# width — but ONLY when the project's `target_platforms` (.pandacorp/status.yaml) includes mobile;
# for a desktop-only / API / scraper project the spec is a vacuous pass. The harness itself is
# mandatory: a missing test:responsive script is RED, never a skip.
if grep -q '"test:responsive"' package.json; then
  pnpm test:responsive
else
  echo "✗ Responsive Gate missing: a web project must assert mobile-width responsiveness (DR-074). Add e2e/responsive.spec.ts + e2e/_responsive-helper.ts + e2e/_target.ts + the test:responsive script."; exit 1
fi

# --- Shell-Presence Gate (DR-075) — FAIL-CLOSED -------------------------------
# Asserts the app against the PROTOTYPE's nav contract (e2e/shell.ts), not its own baseline — the fix
# for "a whole nav menu went missing and passed green" (the visual gate proves consistency, not
# fidelity). On every declared route (minus author-declared SHELL_EXEMPT) the persistent shell must be
# present + every top-level destination reachable. For an app with NO persistent shell (empty
# NAV_DESTINATIONS) it is a vacuous pass; the harness itself is mandatory — a missing test:shell is RED.
if grep -q '"test:shell"' package.json; then
  pnpm test:shell
else
  echo "✗ Shell-Presence Gate missing: a web project must assert its app shell / global nav against the prototype contract (DR-075). Add e2e/shell.spec.ts + e2e/shell.ts + the test:shell script."; exit 1
fi
