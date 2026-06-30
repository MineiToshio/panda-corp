#!/usr/bin/env bash
# Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.
# Installed VERBATIM into projects by /pandacorp:architecture; re-synced + conformance-checked
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

# --- Canary mode (DR-079): prove each fail-closed gate STILL goes RED on a broken input ---------
# `verify.sh --canary` runs the project's deliberately-broken fixtures through the gates and asserts
# each gate REJECTS its fixture — a gate that stays GREEN on a broken input has rotted (a renamed
# selector, a disabled rule, a swallowed exit code) and THAT is a RED. Invoked by /pandacorp:upgrade,
# never on a normal build. Vacuous until the fixtures + runner are installed (like doc-lint, DR-077),
# so it can never red-lock a normal run.
if [ "${1:-}" = "--canary" ]; then
  if [ -f .pandacorp/canary.sh ]; then exec bash .pandacorp/canary.sh; fi
  echo "✓ canary: no .pandacorp/canary.sh installed yet (DR-079 — vacuous pass)"; exit 0
fi

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

# --- Browser gates (DR-055/056/074/075) — FAIL-CLOSED: a missing harness is RED ---
# ONE playwright invocation = ONE webServer boot for the whole e2e layer (smoke + visual + responsive
# + shell). The old four-`pnpm test:X` split bought nothing and quadrupled server boots. Each spec is
# self-contained (its own page.route abort for the live transport, DR-071), so determinism is
# unchanged; `workers:1` + `fullyParallel:false` (playwright.config) already serialize everything.
# Fail-closed gates on the SPEC FILE + config the combined run actually discovers (testDir:"./e2e"),
# NOT the npm scripts — a run finds specs by filesystem, so a deleted spec must RED here (a present
# script with an absent spec would otherwise pass as "no matching tests"). The `test:*` npm scripts
# stay for manual/blessing use, but they are no longer the gate's contract.
# NOTE: this does NOT fix the `.next`/process-contention ERR_CONNECTION_REFUSED a co-located dev /
# always-on server causes (it dies mid-invocation; DR-075 lessons) — that fix is worktree isolation,
# tracked separately. This only removes the inter-invocation churn (DR-076).
[ -f playwright.config.ts ] || { echo "✗ Browser gates missing: no playwright.config.ts (DR-055)."; exit 1; }
[ -f e2e/smoke.spec.ts ]      || { echo "✗ Preview Smoke Gate missing (DR-055): add e2e/smoke.spec.ts — every route must render clean in a browser."; exit 1; }
[ -f e2e/visual.spec.ts ]     || { echo "✗ Visual-Fidelity Gate missing (DR-056): add e2e/visual.spec.ts — diff each route against its blessed baseline."; exit 1; }
[ -f e2e/responsive.spec.ts ] || { echo "✗ Responsive Gate missing (DR-074): add e2e/responsive.spec.ts + e2e/_responsive-helper.ts + e2e/_target.ts."; exit 1; }
[ -f e2e/shell.spec.ts ]      || { echo "✗ Shell-Presence Gate missing (DR-075): add e2e/shell.spec.ts + e2e/shell.ts — assert the app shell / global nav vs the prototype."; exit 1; }
pnpm exec playwright test e2e/

# --- Bless-provenance advisory (DR-080) — non-blocking -------------------------
# A blessed visual baseline with no recorded ORACLE (the prototype path/shard + sign-off + a
# `prototype_blessed_at` SHA in the FRD's fdd.md) is a self-reference — the trap that let a menu-less
# baseline ship green (E6). ADVISORY: it warns, never fails (so it can't red-lock baselines blessed
# before this rule). The deterministic block is the reviewer's bless step (DR-080) + the gate canary.
if ls e2e/visual.spec.ts-snapshots/*.png >/dev/null 2>&1 && ! grep -rqs "prototype_blessed_at" docs/frds 2>/dev/null; then
  echo "⚠ DR-080: blessed visual baselines exist but no fdd.md records a 'prototype_blessed_at' provenance line — the baseline's independent oracle is unrecorded (advisory)."
fi
