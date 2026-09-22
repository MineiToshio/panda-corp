#!/usr/bin/env bash
# Canonical MAXIMUM fail-closed gate (DR-059) for the Next.js stack.
# Installed VERBATIM into projects by /pandacorp:architecture; re-synced + conformance-checked
# (drift => regenerate/fail) by /pandacorp:upgrade. Do NOT hand-edit per project — drift is RED.
# Every gate is fail-closed: a missing harness (smoke/visual) is RED, never a skip (DR-019/055/056).
# This script is ALWAYS strict — it never softens itself. The build engine drives it (`--since`
# per FRD, full at close-out). The PHASE-AWARENESS lives in the Stop hook (verify-before-stop.sh,
# DR-063): that wrapper skips THIS gate while a build is active so it doesn't block every turn;
# the engine keeps running this strictly. So: hook = phase-aware; verify.sh = always strict.
#
# WP-05 additions — SCOPE and DATA only, nothing here ever softens what counts as red:
#   `--report-all`: the 9 cheap sub-gates below (structure guard through madge) accumulate ALL
#   their failures before aborting, instead of stopping at the very first one. vitest and
#   Playwright are unaffected — they still cut at their own first failure, same as always.
#   Without the flag, the cheap gates keep today's exact fail-fast behavior.
#   ALWAYS (every run, every mode, green or red, with or without `--report-all`) writes
#   `.pandacorp/run/gate-report.json` — a machine-readable verdict for Mission Control or any other
#   reader, so nobody has to scrape this script's human stdout. LESSON-0155: a stale report from a
#   previous run must never be read as this run's verdict, so it is deleted before anything runs.
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true  # bash 4.4+; no-op on macOS' bash 3.2 (avoids "invalid shell option")

# --- Optional scope: `verify.sh --since <sha>` (the fast per-FRD gate) ----------
# Runs only the vitest tests CHANGED since <sha>; biome/tsc/knip/madge stay global
# (fast enough, and they scale). ALSO scopes the browser layer (DR-106): in --since mode
# only smoke + shell run (correctness + gross structure — exactly what the DR-072 gate may
# block on); visual + responsive belong to the FULL unscoped suite at close-out + the
# end-of-build Visual QA pass (fidelity is ADVISORY at the per-FRD gate, never a block).
# Before DR-106 every FRD gate ran the WHOLE serialized e2e suite (workers:1) — the single
# biggest wall-clock cost of a build (11 gates x full Playwright in the personal-page-v2 run).
SINCE=""
if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then SINCE="$2"; fi

# --- Gate-report scaffolding (WP-05) — the stale-report DELETE runs before ANY branch below,
# including --canary (REV-C/LESSON-0155): a report left by a PREVIOUS verify run must never survive
# to be misread as a canary/current run's verdict. Only the mkdir/rm belong here — the rest of the
# report machinery (timestamps, fragments dir, the trap) stays below, after the --canary early exit,
# since --canary never generates a gate-report.json of its own (see that block's comment).
REPORT_DIR=".pandacorp/run"
REPORT_FILE="$REPORT_DIR/gate-report.json"
mkdir -p "$REPORT_DIR"
rm -f "$REPORT_FILE"

# --- Canary mode (DR-079): prove each fail-closed gate STILL goes RED on a broken input ---------
# `verify.sh --canary` runs the project's deliberately-broken fixtures through the gates and asserts
# each gate REJECTS its fixture — a gate that stays GREEN on a broken input has rotted (a renamed
# selector, a disabled rule, a swallowed exit code) and THAT is a RED. Invoked by /pandacorp:upgrade,
# never on a normal build. Vacuous until the fixtures + runner are installed (like doc-lint, DR-077),
# so it can never red-lock a normal run. UNTOUCHED by WP-05: canary.sh is its own standalone runner
# (it mirrors these checks directly against generated fixtures) — this script hands off to it before
# any of the report-all/gate-report GENERATION machinery below even runs, so `--canary` never produces
# a gate-report.json from THIS script (the "canary" value in the report's `scope` enum is reserved for
# canary.sh's own future use, not emitted here) — but the stale-report DELETE above already ran, so a
# canary run never leaves a PRIOR run's report readable as if it were canary's own verdict.
if [ "${1:-}" = "--canary" ]; then
  if [ -f .pandacorp/canary.sh ]; then exec bash .pandacorp/canary.sh; fi
  echo "✓ canary: no .pandacorp/canary.sh installed yet (DR-079 — vacuous pass)"; exit 0
fi

# --- Report-all mode (WP-05) ----------------------------------------------------------------
# Detected ANYWHERE in argv (order-independent), so it composes with `--since` in either order —
# `--since`'s own detection above is untouched, and this scan never changes what it resolves to.
REPORT_ALL=0
for _wp05_arg in "$@"; do
  if [ "$_wp05_arg" = "--report-all" ]; then REPORT_ALL=1; fi
done

# --- Gate-report scaffolding (WP-05) — ALWAYS-written `.pandacorp/run/gate-report.json` -------
# `.pandacorp/run/` is the existing gitignored runtime-scratch convention (see .pandacorp/run/
# lessons.md) — never committed, never conformance-checked, purely machine state for this run.
# REPORT_DIR/REPORT_FILE + the stale-report delete moved ABOVE the --canary branch (REV-C); only the
# timestamp/scope/fragments-dir setup for actually WRITING a fresh report lives here.
GATE_RUN_AT=$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
GATE_SCOPE="full"
[ -n "$SINCE" ] && GATE_SCOPE="since"

GATE_FRAGMENTS_DIR=$(mktemp -d)
: > "$GATE_FRAGMENTS_DIR/fragments.jsonl"
cleanup_gate_report() { rm -rf "$GATE_FRAGMENTS_DIR"; }
trap cleanup_gate_report EXIT

# Portable millisecond clock. GNU `date +%s%N` gives nanoseconds; BSD `date` on older macOS does
# NOT expand `%N` (it prints a literal "N"), so detect that and fall back to python3, then perl,
# then whole-second precision as a last resort. (Verified: this machine's BSD `date` DOES expand
# %N — but the fleet includes older macOS where it doesn't, so the fallback chain stays.)
now_ms() {
  local raw
  raw=$(date +%s%N 2>/dev/null || true)
  case "$raw" in
    ''|*[!0-9]*) raw="" ;;
  esac
  if [ -n "$raw" ] && [ "${#raw}" -ge 19 ]; then
    echo $(( raw / 1000000 ))
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import time; print(int(time.time() * 1000))'
    return
  fi
  if command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'printf("%d\n", time() * 1000)'
    return
  fi
  echo $(( $(date +%s) * 1000 ))
}

# Parses one gate's captured output into `failures[]` with a minimal, tolerant parser matched to
# the tool's own output shape; NEVER emits an empty array on a red exit (falls back to the last 20
# captured lines as a single {"msg": ...} entry). Reads the log FILE (not argv) so failure text
# with quotes/backticks/`$`/newlines can never break shell quoting.
record_gate_result() {
  local name="$1" parser="$2" rc="$3" dur_ms="$4" log="$5"
  python3 - "$name" "$parser" "$rc" "$dur_ms" "$log" <<'PY' >> "$GATE_FRAGMENTS_DIR/fragments.jsonl"
import json
import re
import sys

name, parser, rc, dur_ms, log_path = sys.argv[1:6]
rc = int(rc)
dur_ms = int(dur_ms)

try:
    with open(log_path, "r", errors="replace") as fh:
        text = fh.read()
except OSError:
    text = ""

lines = text.splitlines()


def tail_fallback():
    tail = lines[-20:] if lines else []
    msg = "\n".join(tail).strip() or "(no output captured)"
    return [{"msg": msg}]


failures = []
if rc != 0:
    if parser == "tsc":
        # src/foo.ts(12,5): error TS2322: Type '"x"' is not assignable to type 'number'.
        pat = re.compile(r"^(?P<file>[^\s(][^():]*)\((?P<line>\d+),\d+\): error (?P<code>TS\d+): (?P<msg>.*)$")
        for ln in lines:
            m = pat.match(ln.strip())
            if m:
                failures.append({
                    "file": m.group("file"),
                    "line": int(m.group("line")),
                    "code": m.group("code"),
                    "msg": m.group("msg"),
                })
    elif parser == "biome":
        # src/foo.ts:12:3 lint/suspicious/noExplicitAny  ────  Unexpected any. Specify a different type.
        pat = re.compile(r"^(?P<file>[\w./-]+):(?P<line>\d+):(?P<col>\d+)\s+(?P<msg>.*)$")
        for ln in lines:
            m = pat.match(ln.strip())
            if m:
                failures.append({"file": m.group("file"), "line": int(m.group("line")), "msg": m.group("msg")})
    elif parser == "vitest":
        # " FAIL  src/foo/_tests/bar.test.ts > suite > test name" (also matches the "✗"/"×" markers)
        pat = re.compile(r"^\s*(?:FAIL|✗|×)\s+(?P<file>\S+\.test\.(?:ts|tsx|js|jsx))\b\s*(?P<msg>.*)$")
        for ln in lines:
            m = pat.match(ln)
            if m:
                failures.append({"file": m.group("file"), "msg": (m.group("msg") or "").strip() or "failed"})
    elif parser == "pathlist":
        # knip/madge/the internal (structure/data-layer/API/doc-lint/residual-ambiguity) gates: each
        # relevant line carries a source/doc path, possibly alongside other text (e.g. madge's
        # "1) src/a.ts > src/b.ts > src/a.ts" cycle chains) — extract the first path per line.
        path_re = re.compile(r"[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md)")
        for ln in lines:
            s = ln.strip()
            if not s:
                continue
            m = path_re.search(s)
            if m:
                failures.append({"file": m.group(0), "msg": s})
    # `playwright` (and anything that matched nothing above) falls through to the generic fallback.
    if not failures:
        failures = tail_fallback()

entry = {
    "name": name,
    "exit": rc,
    "duration_ms": dur_ms,
    "failures": failures,
}
print(json.dumps(entry))
PY
}

# Runs one gate: `run_gate <name> <parser> <command...>`. Times it, streams its output live (the
# operator loses nothing) while also capturing it for parsing, and records one report fragment.
# Captures the COMMAND's own exit code via PIPESTATUS[0] (LESSON-0078: `$?` after a pipe reads
# `tee`'s exit, not the command's) — `set +e` around the pipeline so `set -e` can't abort before
# that capture happens.
run_gate() {
  local name="$1" parser="$2"; shift 2
  local log start_ms end_ms dur_ms rc
  log="$GATE_FRAGMENTS_DIR/log-$name.txt"
  start_ms=$(now_ms)
  set +e
  "$@" 2>&1 | tee "$log"
  rc="${PIPESTATUS[0]}"
  set -e
  end_ms=$(now_ms)
  dur_ms=$((end_ms - start_ms))
  record_gate_result "$name" "$parser" "$rc" "$dur_ms" "$log"
  return "$rc"
}

# Assembles the final report from every fragment recorded so far and writes it — called at EVERY
# exit point (success or any abort) so the file always reflects this run, never a stale one.
write_gate_report() {
  local green_exit="$1" green="false"
  [ "$green_exit" -eq 0 ] && green="true"
  python3 - "$GATE_RUN_AT" "$GATE_SCOPE" "$green" "$GATE_FRAGMENTS_DIR/fragments.jsonl" "$REPORT_FILE" <<'PY'
import json
import sys

at, scope, green_str, frag_path, out_path = sys.argv[1:6]
subgates = []
with open(frag_path, "r") as fh:
    for line in fh:
        line = line.strip()
        if line:
            subgates.append(json.loads(line))

report = {"at": at, "scope": scope, "green": green_str == "true", "subgates": subgates}
with open(out_path, "w") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY
}

# Runs one of the 9 CHEAP sub-gates. Without `--report-all`: aborts immediately on the first
# failure (byte-identical to the pre-WP-05 fail-fast behavior, just now also writing the report).
# With `--report-all`: keeps going so every cheap gate gets a chance to report its own failures;
# the caller aborts once, after all 9 have run, if any of them failed.
CHEAP_GATES_FAILED=0
LAST_CHEAP_RC=0
run_cheap_gate() {
  local rc=0
  run_gate "$@" || rc=$?
  if [ "$rc" -ne 0 ]; then
    CHEAP_GATES_FAILED=1
    LAST_CHEAP_RC="$rc"
    if [ "$REPORT_ALL" -ne 1 ]; then
      write_gate_report "$rc"
      exit "$rc"
    fi
  fi
}

# --- Structure guard (file placement isn't lintable; DR-059) -------------------
# Fail if any unit/component test sits loose outside a _tests/ folder.
gate_structure_guard() {
  local stray
  stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' 2>/dev/null | grep -v '/_tests/' || true)
  if [ -n "$stray" ]; then
    echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; return 1
  fi
  return 0
}
run_cheap_gate structure-guard pathlist gate_structure_guard

# --- Data-layer isolation (structure.md STRUCT-2) — DB access only in src/queries/ -------
# The ORM client is created once (src/lib/prisma.ts) and consumed ONLY by the data layer.
# Type-only imports of @prisma/client are fine anywhere. Vacuous without Prisma.
gate_data_layer() {
  if [ -d src ] && grep -q '"@prisma/client"' package.json 2>/dev/null; then
    local leak leak2
    leak=$(grep -rEl "new PrismaClient\(|from ['\"]@/lib/prisma['\"]" src --include='*.ts' --include='*.tsx' 2>/dev/null \
      | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)
    # value-imports of @prisma/client (not `import type`) outside the sanctioned locations
    leak2=$(grep -rE "^import \{[^}]*\} from ['\"]@prisma/client['\"]" src --include='*.ts' --include='*.tsx' -l 2>/dev/null \
      | grep -v '^src/queries/' | grep -v '^src/lib/prisma\.ts$' || true)
    if [ -n "$leak$leak2" ]; then
      echo "✗ Data-layer isolation (STRUCT-2): DB access outside src/queries/ (components/actions call queries/, never the ORM):"
      printf '%s\n%s\n' "$leak" "$leak2" | sort -u | sed '/^$/d'; return 1
    fi
  fi
  return 0
}
run_cheap_gate data-layer pathlist gate_data_layer

# --- API error contract (api-design.md API-1, RFC 9457) ----------------------------------
# A route handler that returns 4xx/5xx must use the shared problem() helper
# (application/problem+json), never an ad-hoc error body. Vacuous without API routes.
gate_api_error_contract() {
  if [ -d src/app/api ]; then
    local bad=""
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      if grep -Eq 'status: *(4|5)[0-9][0-9]' "$f" && ! grep -q 'problem' "$f"; then bad="$bad  $f"$'\n'; fi
    done < <(find src/app/api -name 'route.ts' 2>/dev/null)
    if [ -n "$bad" ]; then
      echo "✗ API error contract (RFC 9457): route handlers return 4xx/5xx without the shared problem() helper (see STACK.md — API error contract):"
      printf '%s' "$bad"; return 1
    fi
  fi
  return 0
}
run_cheap_gate api-error-contract pathlist gate_api_error_contract

# --- Doc-structure lint (DR-077, greenfield fail-closed subset BL-0009) — frontmatter + stable-ID
# spine; vacuous if no docs ----
# Validates generated docs (FRD/PRD/work-orders) carry required frontmatter and that REQ->WO IDs
# resolve. ADVISORY on brownfield/adopted (created_via: adopt, or no provenance recorded) — reports
# drift and NEVER fails the gate, so it can't red-lock an adopted/partial-spine project. FAIL-CLOSED
# on greenfield (created_via: scaffold, set by /pandacorp:scaffold) for the structural subset only
# (missing frontmatter keys, a PRD without `type`) — a project born via scaffold is expected to carry
# a complete spine, so doc-lint.sh itself now exits non-zero and this call legitimately fails the
# gate. A project with no docs/ passes. The harness is new, so a missing script is a no-op (older
# overlays); /pandacorp:upgrade installs it. Drift is surfaced here, NOT tracked by a per-doc
# version stamp (DR-077).
gate_doc_lint() {
  if [ -f .pandacorp/doc-lint.sh ]; then
    bash .pandacorp/doc-lint.sh
    return $?
  fi
  return 0
}
run_cheap_gate doc-lint pathlist gate_doc_lint

# --- Residual-ambiguity gate (DR-100) — a [NEEDS CLARIFICATION] marker must never reach an ACTIVE doc ---
# Spec/blueprint authors mark an unresolved, build-changing question inline with `[NEEDS CLARIFICATION: …]`
# (distinct from a resolved `[ASSUMPTION: …]`). The readiness gate forbids it surviving into a live doc:
# if any file under docs/ carries the marker AND its frontmatter is `status: ACTIVE`, a question shipped
# into the build → RED. A DRAFT doc may still carry it (spec is still resolving it); no docs/ ⇒ vacuous pass.
gate_residual_ambiguity() {
  if [ -d docs ]; then
    local flagged=""
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      if head -n 25 "$f" | grep -Eq '^status:[[:space:]]*ACTIVE'; then flagged="$flagged  $f"$'\n'; fi
    done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)
    if [ -n "$flagged" ]; then
      echo "✗ DR-100 readiness: unresolved [NEEDS CLARIFICATION] in ACTIVE docs (resolve → AC / business rule / [ASSUMPTION], or escalate):"
      printf '%s' "$flagged"; return 1
    fi
  fi
  return 0
}
run_cheap_gate residual-ambiguity pathlist gate_residual_ambiguity

# --- Lint + format (every warn is a hard gate; --error-on-warnings) ------------
run_cheap_gate biome biome pnpm biome check . --error-on-warnings

# --- Typing -------------------------------------------------------------------
run_cheap_gate tsc tsc pnpm tsc --noEmit

# --- Dead code (fail-closed) --------------------------------------------------
run_cheap_gate knip pathlist pnpm knip

# --- Circular dependencies (fail-closed) --------------------------------------
run_cheap_gate madge pathlist pnpm madge --circular --extensions ts,tsx src

# `--report-all`: all 9 cheap gates above have now run and reported independently — abort ONCE,
# here, with the aggregate verdict, instead of at the first one (vitest/Playwright never run on a
# cheap-gate red; there is nothing more the expensive layers would add to an already-red verdict).
if [ "$REPORT_ALL" -eq 1 ] && [ "$CHEAP_GATES_FAILED" -eq 1 ]; then
  write_gate_report "$LAST_CHEAP_RC"
  exit "$LAST_CHEAP_RC"
fi

# --- Behavior -----------------------------------------------------------------
# shellcheck disable=SC2086
# `|| VITEST_RC=$?` (not a bare call + `$?` on the next line): under `set -e` a plain non-zero
# command exits the script IMMEDIATELY, before a following `VITEST_RC=$?` would ever run — that
# would skip write_gate_report entirely on a vitest failure. The `||` keeps this on the safe side
# of errexit (same reasoning as run_gate's own PIPESTATUS capture just above).
VITEST_RC=0
run_gate vitest vitest pnpm vitest run --reporter=dot ${SINCE:+--changed "$SINCE"} || VITEST_RC=$?
if [ "$VITEST_RC" -ne 0 ]; then
  write_gate_report "$VITEST_RC"
  exit "$VITEST_RC"
fi

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
gate_playwright() {
  [ -f playwright.config.ts ] || { echo "✗ Browser gates missing: no playwright.config.ts (DR-055)."; return 1; }
  [ -f e2e/smoke.spec.ts ]      || { echo "✗ Preview Smoke Gate missing (DR-055): add e2e/smoke.spec.ts — every route must render clean in a browser."; return 1; }
  [ -f e2e/visual.spec.ts ]     || { echo "✗ Visual-Fidelity Gate missing (DR-056): add e2e/visual.spec.ts — diff each route against its blessed baseline."; return 1; }
  [ -f e2e/responsive.spec.ts ] || { echo "✗ Responsive Gate missing (DR-074): add e2e/responsive.spec.ts + e2e/_responsive-helper.ts + e2e/_target.ts."; return 1; }
  [ -f e2e/shell.spec.ts ]      || { echo "✗ Shell-Presence Gate missing (DR-075): add e2e/shell.spec.ts + e2e/shell.ts — assert the app shell / global nav vs the prototype."; return 1; }
  [ -f e2e/headers.spec.ts ]    || { echo "✗ Header-Scan Gate missing (web-security.md): add e2e/headers.spec.ts — security headers, tiered by deploy_target."; return 1; }
  # ADVISORY token-fidelity check (F4): e2e/tokens.spec.ts is auto-discovered by the FULL run below
  # (NOT by the --since gate). It flags hardcoded colors that never came from a design token and reds
  # ONLY on a GROSS violation (>20 distinct hardcoded colors on a route) — a punch-list, not a fidelity
  # block. It is deliberately NOT in the fail-closed presence list above: a missing tokens.spec.ts is a
  # skipped advisory, never a RED (unlike the gates that CAN block). It runs at close-out, not per-FRD.
  # DR-106 scope: the per-FRD gate (--since) runs smoke + shell only — the browser layer of the
  # DR-072 BLOCKING lenses (routes render clean + the app shell is present). Visual + responsive
  # stay in the FULL run (close-out / Visual QA): fine fidelity is advisory at the gate and may
  # never block, so paying the whole serialized suite per FRD bought nothing but wall-clock.
  if [ -n "$SINCE" ]; then
    pnpm exec playwright test e2e/smoke.spec.ts e2e/shell.spec.ts
  else
    pnpm exec playwright test e2e/
  fi
}
# Same `set -e` hazard as vitest above: `|| PLAYWRIGHT_RC=$?`, not a bare call.
PLAYWRIGHT_RC=0
run_gate playwright playwright gate_playwright || PLAYWRIGHT_RC=$?
if [ "$PLAYWRIGHT_RC" -ne 0 ]; then
  write_gate_report "$PLAYWRIGHT_RC"
  exit "$PLAYWRIGHT_RC"
fi

# --- Bless-provenance advisory (DR-080) — non-blocking -------------------------
# A blessed visual baseline with no recorded ORACLE (the prototype path/shard + sign-off + a
# `prototype_blessed_at` SHA in the FRD's fdd.md) is a self-reference — the trap that let a menu-less
# baseline ship green (E6). ADVISORY: it warns, never fails (so it can't red-lock baselines blessed
# before this rule). The deterministic block is the reviewer's bless step (DR-080) + the gate canary.
if ls e2e/visual.spec.ts-snapshots/*.png >/dev/null 2>&1 && ! grep -rqs "prototype_blessed_at" docs/frds 2>/dev/null; then
  echo "⚠ DR-080: blessed visual baselines exist but no fdd.md records a 'prototype_blessed_at' provenance line — the baseline's independent oracle is unrecorded (advisory)."
fi

write_gate_report 0
exit 0
