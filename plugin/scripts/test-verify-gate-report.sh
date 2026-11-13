#!/bin/bash
# Self-test for WP-05: verify.sh's `--report-all` flag + the ALWAYS-written
# .pandacorp/run/gate-report.json (plugin/templates/stack-a-nextjs/verify.sh).
#
# RED (before WP-05): a red cheap sub-gate aborted the whole script at the FIRST failure (no way to
# see two broken gates in one pass) and nothing ever wrote a machine-readable verdict — only human
# stdout, which Mission Control (or any other reader) would have to scrape.
# GREEN (proven here): `--report-all` makes the cheap sub-gates accumulate every failure before
# aborting once; without the flag, behavior stays fail-fast (only the first offender runs); every
# run — green or red, flagged or not — writes gate-report.json; a stale report from a prior run
# never survives into the next one's verdict (LESSON-0155).
#
# Runs entirely against SYNTHETIC fixtures: a throwaway project directory with a stubbed `pnpm` on
# PATH (so no real biome/tsc/vitest/playwright toolchain is needed) plus real files for the
# gates that don't go through pnpm (the structure guard). Run from the factory repo root:
#   bash plugin/scripts/test-verify-gate-report.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
VERIFY="$HERE/plugin/templates/stack-a-nextjs/verify.sh"
pass=0; fail=0

ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); if [ -n "${2:-}" ]; then echo "$2" | sed 's/^/      /'; fi }

# --- Fixture project scaffolding ---------------------------------------------------------------
# One throwaway project per scenario (fresh, never reused — a stray report or stray fixture file
# from a previous scenario must never leak into the next one's verdict).
new_fixture() {
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/.pandacorp" "$dir/src/_tests" "$dir/bin"
  echo '{"name":"wp05-fixture"}' > "$dir/package.json"

  # Stubbed `pnpm` — responds to the exact subcommands verify.sh invokes. Each tool's pass/fail is
  # controlled by an env var the calling test sets before invoking verify.sh, so one binary covers
  # every scenario without per-scenario PATH juggling.
  cat > "$dir/bin/pnpm" <<'STUB'
#!/bin/bash
# WP-08: when WP08_ARGV_LOG is set, record the FULL argv of every invocation (one line each) so a
# scenario can assert HOW a tool was called (biome scoped to files, vitest switched to `related`),
# not just whether it ran. Unset in every pre-WP-08 scenario -> byte-identical behavior there.
if [ -n "${WP08_ARGV_LOG:-}" ]; then printf 'pnpm %s\n' "$*" >> "$WP08_ARGV_LOG"; fi
case "$1" in
  biome)
    if [ "${WP05_FAIL_BIOME:-0}" = "1" ]; then
      echo "src/broken.ts:3:5 lint/suspicious/noExplicitAny ── FIXTURE forced biome failure"
      exit 1
    fi
    exit 0
    ;;
  tsc)
    if [ "${WP05_FAIL_TSC:-0}" = "1" ]; then
      echo "src/broken.ts(3,5): error TS2322: FIXTURE forced tsc failure"
      exit 1
    fi
    exit 0
    ;;
  knip)
    if [ "${WP05_FAIL_KNIP:-0}" = "1" ]; then
      echo "Unused files (1)"
      echo "src/orphan.ts"
      exit 1
    fi
    exit 0
    ;;
  madge)
    if [ "${WP05_FAIL_MADGE:-0}" = "1" ]; then
      echo "✖ Found 1 circular dependency!"
      echo ""
      echo "1) src/a.ts > src/b.ts > src/a.ts"
      exit 1
    fi
    exit 0
    ;;
  vitest)
    if [ "${WP05_FAIL_VITEST:-0}" = "1" ]; then
      echo " FAIL  src/foo/_tests/bar.test.ts > suite > FIXTURE forced vitest failure"
      exit 1
    fi
    exit 0
    ;;
  exec)
    if [ "$2" = "playwright" ]; then
      if [ -n "${WP08_ARGV_LOG:-}" ]; then printf 'tier=%s\nserver=%s\n' "${PANDACORP_E2E_TIER:-none}" "${PANDACORP_E2E_SERVER:-dev}" >> "$WP08_ARGV_LOG"; fi
      if [ "${WP05_FAIL_TIER:-}" = "${PANDACORP_E2E_TIER:-none}" ]; then exit 1; fi
      if [ "${WP05_FAIL_PLAYWRIGHT:-0}" = "1" ]; then
        echo "1) e2e/smoke.spec.ts:10:5 › smoke › FIXTURE forced playwright failure"
        exit 1
      fi
      exit 0
    fi
    exit 0
    ;;
  *) exit 0 ;;
esac
STUB
  chmod +x "$dir/bin/pnpm"
  printf '%s\n' "$dir"
}

# Makes the playwright presence-check pass (so a "green" scenario doesn't red on a missing spec
# file — verify.sh's own gate, not what this test is proving).
add_playwright_fixtures() {
  local dir="$1"
  mkdir -p "$dir/e2e"
  : > "$dir/playwright.config.ts"
  for f in smoke visual responsive shell headers; do : > "$dir/e2e/$f.spec.ts"; done
}

# Runs verify.sh inside the fixture dir with the stub `pnpm` first on PATH. Captures combined
# output + exit code; the JSON report (if any) is read by the caller from "$dir/.pandacorp/run/gate-report.json".
run_verify() {
  local dir="$1"; shift
  ( cd "$dir" && PATH="$dir/bin:$PATH" bash "$VERIFY" "$@" )
}

report_path() { echo "$1/.pandacorp/run/gate-report.json"; }

json_get() { # $1 report file, $2 python expression on `d`
  python3 -c "
import json, sys
with open(sys.argv[1]) as fh:
    d = json.load(fh)
print($2)
" "$1"
}

echo "== verify.sh WP-05: --report-all + gate-report.json self-test =="

# --- Scenario (a): --report-all accumulates TWO red cheap sub-gates, both appear, script exits red
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"   # breaks structure-guard (outside _tests/)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_BIOME=1 run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  names=$(json_get "$rf" "[s['name'] for s in d['subgates'] if s['exit'] != 0]")
  green=$(json_get "$rf" "d['green']")
  if echo "$names" | grep -q "structure-guard" && echo "$names" | grep -q "biome" && [ "$green" = "False" ]; then
    ok "(a) --report-all: both structure-guard AND biome appear failed, green:false, script exit=$rc"
  else
    bad "(a) --report-all: expected BOTH structure-guard+biome failed (got: $names, green=$green)" "$out"
  fi
else
  bad "(a) --report-all: expected non-zero exit + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (b): WITHOUT the flag, only the FIRST offender (structure-guard) runs — fail-fast,
# unchanged from pre-WP-05 behavior — even though a LATER gate (biome) is ALSO broken.
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_BIOME=1 run_verify "$FX"); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  count=$(json_get "$rf" "len(d['subgates'])")
  names=$(json_get "$rf" "[s['name'] for s in d['subgates']]")
  green=$(json_get "$rf" "d['green']")
  if [ "$count" = "1" ] && echo "$names" | grep -q "structure-guard" && [ "$green" = "False" ]; then
    ok "(b) no flag: only structure-guard ran (fail-fast unchanged), green:false, script exit=$rc"
  else
    bad "(b) no flag: expected exactly 1 subgate (structure-guard) — got count=$count names=$names green=$green" "$out"
  fi
else
  bad "(b) no flag: expected non-zero exit + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# Gate inventory is configuration, not curated data: derive it from the registered contract.
expected_count=$(python3 - "$VERIFY" <<'PYCOUNT'
import re, sys
source=open(sys.argv[1]).read()
print(len(re.search(r'^KNOWN_GATES="([^"]+)"', source, re.M).group(1).split()))
PYCOUNT
)
# --- Scenario (c): everything green -> green:true, duration_ms numeric on every subgate.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  green=$(json_get "$rf" "d['green']")
  count=$(json_get "$rf" "len(d['subgates'])")
  numeric=$(json_get "$rf" "all(isinstance(s['duration_ms'], int) and s['duration_ms'] >= 0 for s in d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  if [ "$green" = "True" ] && [ "$numeric" = "True" ] && [ "$count" = "$expected_count" ] && [ "$scope" = "full" ]; then
    ok "(c) all-green: green:true, $count subgates, every duration_ms numeric, scope=full"
  else
    bad "(c) all-green: expected green=True numeric=True count=$expected_count scope=full — got green=$green numeric=$numeric count=$count scope=$scope" "$out"
  fi
else
  bad "(c) all-green: expected exit 0 + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (d): a stale report from a PRIOR run must never survive into this run's verdict.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
mkdir -p "$FX/.pandacorp/run"
echo '{"at":"1999-01-01T00:00:00Z","scope":"full","green":true,"subgates":[{"name":"stale-marker","exit":0,"duration_ms":1,"failures":[]}]}' > "$(report_path "$FX")"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ -f "$rf" ]; then
  has_stale=$(json_get "$rf" "any(s['name'] == 'stale-marker' for s in d['subgates'])")
  at=$(json_get "$rf" "d['at']")
  if [ "$has_stale" = "False" ] && [ "$at" != "1999-01-01T00:00:00Z" ]; then
    ok "(d) stale prior-run report is gone; this run's own verdict is written (at=$at)"
  else
    bad "(d) stale prior-run report leaked into this run's verdict (has_stale=$has_stale at=$at)" "$out"
  fi
else
  bad "(d) expected a report to exist after the run (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Bonus: `--since <sha>` still composes with `--report-all` (scope reflects it; both flags honored)
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --since deadbeef --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  scope=$(json_get "$rf" "d['scope']")
  if [ "$scope" = "since" ]; then
    ok "(bonus) --since + --report-all compose: scope=since, still green"
  else
    bad "(bonus) --since + --report-all: expected scope=since, got scope=$scope" "$out"
  fi
else
  bad "(bonus) --since + --report-all: expected exit 0 + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# ---- BL-0179 ----
# A close-out reuse check can only treat a `scope:"since"` report as
# equivalent to a full one when it can PROVE the `--since` base matches the current last_green_sha —
# which requires the report to carry that base at all. Before this fix, `write_gate_report` never
# read $SINCE, so a `since`-scoped report had no way to say what it was scoped FROM.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --since deadbeefcafe --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  since=$(json_get "$rf" "d.get('since', '')")
  if [ "$since" = "deadbeefcafe" ]; then
    ok "(BL-0179) --since base is stamped into the report as 'since'"
  else
    bad "(BL-0179) expected since=deadbeefcafe, got since=$since" "$out"
  fi
else
  bad "(BL-0179) --since: expected exit 0 + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

echo "Case (BL-0179 control) -- a full (unscoped) run stamps no 'since' field at all"
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  has_since=$(json_get "$rf" "'since' in d")
  if [ "$has_since" = "False" ]; then
    ok "(BL-0179) a full run carries no 'since' field (nothing to anchor)"
  else
    bad "(BL-0179) a full run should not carry 'since', got: $(json_get "$rf" "d.get('since')")" "$out"
  fi
else
  bad "(BL-0179 control) full run: expected exit 0 + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Bonus: `--canary` is untouched — with no .pandacorp/canary.sh installed it stays the DR-079
# vacuous pass, and (because it execs away / returns before the report scaffolding) it must NOT
# write a gate-report.json of its own.
FX=$(new_fixture)
out=$(run_verify "$FX" --canary); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && echo "$out" | grep -q "vacuous pass" && [ ! -f "$rf" ]; then
  ok "(bonus) --canary: still a vacuous pass, and writes no gate-report.json of its own"
else
  bad "(bonus) --canary: expected rc=0 + vacuous-pass message + no report file (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# REV-* — ADVERSARIAL REVIEW SCENARIOS (speed sprint A/B, DR-015 independent reviewer).
# Written by the reviewer, not by WP-05's implementers.
# ═══════════════════════════════════════════════════════════════════════════════════════════════

# --- REV-A: the LAST of the cheap gates (madge) is the ONLY red one, everything before it green.
# The aggregate abort at the bottom of the cheap block must still exit non-zero (LESSON-0078: the
# PIPESTATUS capture, not `$?` after the tee pipe) and must NOT let vitest/playwright run.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_MADGE=1 run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  green=$(json_get "$rf" "d['green']")
  count=$(json_get "$rf" "len(d['subgates'])")
  failed_names=$(json_get "$rf" "sorted(s['name'] for s in d['subgates'] if s['exit'] != 0)")
  ran_expensive=$(json_get "$rf" "any(s['name'] in ('vitest','playwright') for s in d['subgates'])")
  if [ "$green" = "False" ] && [ "$count" = "$((expected_count - 2))" ] && [ "$failed_names" = "['madge']" ] && [ "$ran_expensive" = "False" ]; then
    ok "(REV-A) --report-all with only the last cheap gate red: exit=$rc, green:false, all cheap gates reported, madge the only failure, no expensive layer run"
  else
    bad "(REV-A) expected green=False count=$((expected_count - 2)) failed=['madge'] expensive=False — got green=$green count=$count failed=$failed_names expensive=$ran_expensive" "$out"
  fi
else
  bad "(REV-A) a red last cheap gate must still exit non-zero with a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- REV-B: a cheap gate that fails with NO output at all must never record an EMPTY failures[]
# (DR-078 fail-loud: "source is empty" and "could not interpret it" must not collapse into silence).
FX=$(new_fixture)
add_playwright_fixtures "$FX"
cat > "$FX/bin/pnpm" <<'SILENT'
#!/bin/bash
case "$1" in
  knip) exit 1 ;;   # red, and deliberately prints NOTHING
  *) exit 0 ;;
esac
SILENT
chmod +x "$FX/bin/pnpm"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  nonempty=$(json_get "$rf" "all(len(s['failures']) > 0 for s in d['subgates'] if s['exit'] != 0)")
  if [ "$nonempty" = "True" ]; then
    ok "(REV-B) a silent red gate still records a non-empty failures[] (never a quiet empty array)"
  else
    bad "(REV-B) a red gate recorded an EMPTY failures[] — a reader cannot tell 'no findings' from 'unparsed'" "$out"
  fi
else
  bad "(REV-B) expected a non-zero exit + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- REV-C: LESSON-0155 across the `--canary` branch. verify.sh deletes the stale report at :63,
# but the `--canary` early `exec`/exit at :44-47 runs BEFORE that, so a report left by a PREVIOUS
# verify run survives a canary run and a machine reader takes it as the current verdict.
# Minimal fix: move the REPORT_DIR/REPORT_FILE/`mkdir -p`/`rm -f` block (:60-63) ABOVE the --canary branch.
FX=$(new_fixture)
mkdir -p "$FX/.pandacorp/run"
echo '{"at":"1999-01-01T00:00:00Z","scope":"full","green":true,"subgates":[{"name":"stale-marker","exit":0,"duration_ms":1,"failures":[]}]}' > "$(report_path "$FX")"
out=$(run_verify "$FX" --canary); rc=$?
rf=$(report_path "$FX")
if [ ! -f "$rf" ]; then
  ok "(REV-C) a --canary run does not leave a stale prior-run gate-report.json behind"
else
  stale_at=$(json_get "$rf" "d['at']")
  bad "(REV-C) a stale prior-run gate-report.json SURVIVED a --canary run (at=$stale_at) — LESSON-0155 says it must never be readable as this run's verdict" "$out"
fi
rm -rf "$FX"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# WP-08 — `--only=<subgate,...>` and `--files=<file,...>` (the SCOPED repair gate)
#
# RED (before WP-08): there was no way to re-run a single sub-gate. The build engine's in-place patch
# loop re-ran knip + `biome .` + tsc WHOLE-PROJECT on every one of its internal self-repair cycles,
# and a caller that wanted "just tsc, just these two files" had to run the entire 11-gate suite.
# GREEN (proven here): `--only` runs exactly the named sub-gates; `--files` scopes biome to those
# files and switches vitest to `vitest related <files>`; EITHER flag stamps the gate report
# `scope:"partial"` so no later reader can mistake a scoped run for a full green; an unknown `--only`
# name is a fail-closed non-zero exit BEFORE any gate runs (never a silent full-suite fallback).
# ═══════════════════════════════════════════════════════════════════════════════════════════════

# --- Scenario (e): --only=tsc,biome runs ONLY those two sub-gates and marks the report partial.
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"   # structure-guard WOULD fail — it must not even run
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --only=tsc,biome); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  names=$(json_get "$rf" "sorted(s['name'] for s in d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  green=$(json_get "$rf" "d['green']")
  if [ "$names" = "['biome', 'tsc']" ] && [ "$scope" = "partial" ] && [ "$green" = "True" ]; then
    ok "(e) --only=tsc,biome: exactly those two sub-gates ran (structure-guard/vitest/playwright skipped), scope=partial"
  else
    bad "(e) --only=tsc,biome: expected names=['biome', 'tsc'] scope=partial green=True — got names=$names scope=$scope green=$green" "$out"
  fi
else
  bad "(e) --only=tsc,biome: expected exit 0 + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (f): --files scopes biome to exactly those files and vitest to `vitest related <files>`;
# tsc/knip/madge stay GLOBAL (unscoped, by design); the report is partial.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
: > "$FX/src/a.ts"; : > "$FX/src/b.ts"
ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --files=src/a.ts,src/b.ts); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ] && [ -f "$ARGV" ]; then
  scope=$(json_get "$rf" "d['scope']")
  biome_line=$(grep '^pnpm biome' "$ARGV" || true)
  vitest_line=$(grep '^pnpm vitest' "$ARGV" || true)
  tsc_line=$(grep '^pnpm tsc' "$ARGV" || true)
  okf=1
  echo "$biome_line" | grep -q 'src/a.ts src/b.ts' || okf=0
  echo "$biome_line" | grep -q 'biome check \.' && okf=0
  echo "$vitest_line" | grep -q 'vitest related src/a.ts src/b.ts' || okf=0
  echo "$tsc_line" | grep -q 'tsc --noEmit' || okf=0          # tsc stays global (no file list)
  echo "$tsc_line" | grep -q 'src/a.ts' && okf=0
  if [ "$okf" = "1" ] && [ "$scope" = "partial" ]; then
    ok "(f) --files: biome scoped to the files, vitest switched to \`related\`, tsc still global, scope=partial"
  else
    bad "(f) --files: expected scoped biome + \`vitest related\` + global tsc + scope=partial (scope=$scope) — biome:[$biome_line] vitest:[$vitest_line] tsc:[$tsc_line]" "$out"
  fi
else
  bad "(f) --files: expected exit 0 + a report + an argv log (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Scenario (g): an UNKNOWN --only name is fail-closed — non-zero exit, and NO sub-gate runs
# (never a silent degrade to the full suite, which would read as a full green).
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=tsc,typecheck); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ ! -f "$ARGV" ]; then
  if [ -f "$rf" ]; then
    green=$(json_get "$rf" "d['green']")
    scope=$(json_get "$rf" "d['scope']")
  else
    green="(no report)"; scope="(no report)"
  fi
  if echo "$out" | grep -q "typecheck" && [ "$green" != "True" ]; then
    ok "(g) --only with an unknown sub-gate: fail-closed exit=$rc, no gate ran, verdict never green (scope=$scope)"
  else
    bad "(g) --only unknown: expected the offending name in the message and a non-green verdict (green=$green)" "$out"
  fi
else
  bad "(g) --only unknown: expected a non-zero exit BEFORE any gate ran (rc=$rc, any tool invoked=$([ -f "$ARGV" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (h): WITHOUT the new flags nothing changes — all all registered sub-gates, scope=full, and the
# biome/vitest command lines are the pre-WP-08 ones (vitest only gains DR-146's seeded shuffle).
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"
out=$(PANDACORP_VITEST_SEED=4242 WP08_ARGV_LOG="$ARGV" run_verify "$FX"); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ] && [ -f "$ARGV" ]; then
  count=$(json_get "$rf" "len(d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  biome_line=$(grep '^pnpm biome' "$ARGV" || true)
  vitest_line=$(grep '^pnpm vitest' "$ARGV" || true)
  if [ "$count" = "$expected_count" ] && [ "$scope" = "full" ] \
     && [ "$biome_line" = "pnpm biome check . --error-on-warnings" ] \
     && [ "$vitest_line" = "pnpm vitest run --reporter=dot --bail=1 --sequence.shuffle --sequence.seed=4242" ]; then
    ok "(h) no new flags: all registered sub-gates, scope=full, biome as before WP-08, vitest + seeded shuffle only"
  else
    bad "(h) no new flags: expected count=$expected_count scope=full and the legacy command lines — got count=$count scope=$scope biome:[$biome_line] vitest:[$vitest_line]" "$out"
  fi
else
  bad "(h) no new flags: expected exit 0 + a report + an argv log (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Scenario (i): a scoped run that REDs still reds, and its report is partial — a partial report is
# never confusable with a full verdict in either direction.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_TSC=1 run_verify "$FX" --only=tsc --files=src/broken.ts); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  scope=$(json_get "$rf" "d['scope']")
  green=$(json_get "$rf" "d['green']")
  files=$(json_get "$rf" "[f.get('file') for s in d['subgates'] for f in s['failures']]")
  if [ "$scope" = "partial" ] && [ "$green" = "False" ] && echo "$files" | grep -q "src/broken.ts"; then
    ok "(i) scoped red: green:false, scope=partial, the tsc parser still anchors the failure to its file"
  else
    bad "(i) scoped red: expected scope=partial green=False with a parsed file — got scope=$scope green=$green files=$files" "$out"
  fi
else
  bad "(i) scoped red: expected a non-zero exit + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# ═══════════════════════════════════════════════════════════════════════════════════════════
# REV2 — INDEPENDENT REVIEW (DR-015) of WP-08's scoped-run surface.
# ═══════════════════════════════════════════════════════════════════════════════════════════

# REV2-F · an unknown --only name must exit non-zero BEFORE any sub-gate runs (fail-closed, never a
# silent degrade to "run everything"). Proven by the argv log being empty: no tool was invoked at all.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=tsk 2>&1); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 2 ] && [ ! -s "$ARGV" ] && [ -f "$rf" ] && [ "$(json_get "$rf" "d['green']")" = "False" ]; then
  ok "(REV2-F) unknown --only name: exit 2, ZERO tools invoked, report green:false"
else
  bad "(REV2-F) unknown --only name: expected rc=2 with an empty argv log and a red report — got rc=$rc argv=[$(cat "$ARGV" 2>/dev/null)]" "$out"
fi
rm -rf "$FX"

# REV2-G · --files is NOT validated the way --only is. A value that looks like a FLAG is forwarded
# verbatim into the biome command line, so a gate-report `failures[].file` value the engine copies
# out of a model's verdict can turn the read-only check into a project-wide autofix
# (`biome check --write`). The scoped path is fail-closed on gate NAMES and wide open on gate INPUTS.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=biome --files=--write 2>&1); rc=$?
if grep -q -- '--write' "$ARGV" 2>/dev/null; then
  bad "(REV2-G) --files forwards a flag-shaped value straight into biome: [$(grep biome "$ARGV" | head -1)] — --only validates its names, --files validates nothing" "$out"
else
  ok "(REV2-G) --files rejects or neutralises a flag-shaped path"
fi
rm -rf "$FX"

# REV2-H · the `partial` label must survive EVERY combination — including the one where a caller
# spells --since AFTER a scope flag. (--since is parsed positionally from $1/$2 only, so this
# invocation silently loses the since-ref; the report must still be honest about being partial.)
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=biome --since deadbeef 2>&1); rc=$?
rf=$(report_path "$FX")
if [ -f "$rf" ] && [ "$(json_get "$rf" "d['scope']")" = "partial" ]; then
  ok "(REV2-H) scope stays partial when --since trails a scope flag (--since itself is silently dropped by the positional parse)"
else
  bad "(REV2-H) expected scope=partial, got $(json_get "$rf" "d['scope']" 2>/dev/null)" "$out"
fi
rm -rf "$FX"

# DR-143 · parallel-safe.json splits only the FULL run, parallel tier first; a red tier stops the gate.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
WP08_ARGV_LOG="$ARGV" run_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 0 ] && [ "$(grep -c '^tier=' "$ARGV")" = "1" ] && grep -q '^tier=none$' "$ARGV"; then
  ok "(DR-143) no parallel-safe.json: one Playwright run, no tier"
else
  bad "(DR-143) expected a single untiered run (rc=$rc)" "$(cat "$ARGV")"
fi
echo '["smoke.spec.ts"]' > "$FX/e2e/parallel-safe.json"
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" run_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 0 ] && [ "$(grep '^tier=' "$ARGV" | tr '\n' ' ')" = "tier=combined " ]; then
  ok "(DR-143) parallel-safe.json: one combined invocation, ordered projects"
else
  bad "(DR-143) expected combined projects (rc=$rc)" "$(cat "$ARGV")"
fi
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" WP05_FAIL_TIER=combined run_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ] && ! grep -q '^tier=serial$' "$ARGV"; then
  ok "(DR-143) a red parallel tier reds the gate and skips the serial tier"
else
  bad "(DR-143) red parallel tier not honoured (rc=$rc)" "$(cat "$ARGV")"
fi
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" WP05_FAIL_TIER=combined run_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ]; then ok "(DR-143) a red serial tier reds the gate"; else bad "(DR-143) red serial tier passed" "$(cat "$ARGV")"; fi
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" run_verify "$FX" --since deadbeef >/dev/null 2>&1; rc=$?
if grep -q '^tier=none$' "$ARGV" && ! grep -q '^tier=parallel$' "$ARGV"; then
  ok "(DR-143) --since keeps its scoped untiered run"
else
  bad "(DR-143) --since must not tier (rc=$rc)" "$(cat "$ARGV")"
fi
echo 'console.log("build:" + process.argv[2]); process.exit(Number(process.env.WP05_FAIL_BUILD || 0))' > "$FX/e2e/prod-server.mjs"
: > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" 2>&1); rc=$?
if [ "$rc" -eq 0 ] && echo "$out" | grep -q 'build:build' && [ "$(grep -c '^server=prod$' "$ARGV")" = "1" ]; then
  ok "(DR-143) prod-server.mjs: one build serves both tiers"
else
  bad "(DR-143) expected one build and one prod invocation (rc=$rc)" "$(cat "$ARGV")"
fi
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" WP05_FAIL_BUILD=3 run_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -ne 0 ] && ! grep -q '^tier=' "$ARGV"; then
  ok "(DR-143) a red build reds the gate before any browser run"
else
  bad "(DR-143) red build not honoured (rc=$rc)" "$(cat "$ARGV")"
fi
: > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --since deadbeef 2>&1)
if ! echo "$out" | grep -q 'build:build' && ! grep -q '^server=prod$' "$ARGV"; then
  ok "(DR-143) --since stays on next dev"
else
  bad "(DR-143) --since must not build" "$(cat "$ARGV")"
fi
rm -rf "$FX"

echo ""
echo "== DR-146: --light, --tests, seeded vitest order, certified-tree stamp =="

# --light: every cheap gate, NO vitest, NO Playwright, scope=partial.
FX=$(new_fixture); add_playwright_fixtures "$FX"; ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --light 2>&1); rc=$?
rf=$(report_path "$FX")
names=$(json_get "$rf" "','.join(s['name'] for s in d['subgates'])" 2>/dev/null)
if [ "$rc" -eq 0 ] && [ "$(json_get "$rf" "d['scope']")" = "partial" ] \
   && ! grep -q '^pnpm vitest' "$ARGV" && ! grep -q '^pnpm exec playwright' "$ARGV" \
   && echo "$names" | grep -q 'madge' && echo "$names" | grep -q 'biome' && echo "$names" | grep -q 'structure-guard'; then
  ok "(DR-146) --light: cheap gates only (no vitest, no Playwright), scope=partial"
else
  bad "(DR-146) --light expected cheap gates only + partial (rc=$rc names=$names)" "$(cat "$ARGV" 2>/dev/null; echo "$out")"
fi
rm -rf "$FX"

# --light --tests: vitest runs EXACTLY the named files with the seeded shuffle; still no Playwright.
FX=$(new_fixture); add_playwright_fixtures "$FX"; ARGV="$FX/argv.log"
out=$(PANDACORP_VITEST_SEED=77 WP08_ARGV_LOG="$ARGV" run_verify "$FX" --light --tests=src/_tests/a.test.ts,src/_tests/b.test.ts 2>&1); rc=$?
rf=$(report_path "$FX")
vitest_line=$(grep '^pnpm vitest' "$ARGV" || true)
if [ "$rc" -eq 0 ] && [ "$vitest_line" = "pnpm vitest run src/_tests/a.test.ts src/_tests/b.test.ts --reporter=dot --passWithNoTests --bail=1 --sequence.shuffle --sequence.seed=77" ] \
   && ! grep -q '^pnpm exec playwright' "$ARGV" && [ "$(json_get "$rf" "d['vitest_seed']")" = "77" ] \
   && echo "$out" | grep -q 'PANDACORP_VITEST_SEED=77 bash .pandacorp/verify.sh --light --tests='; then
  ok "(DR-146) --light --tests: exactly the named test files, seeded, seed printed + recorded, no Playwright"
else
  bad "(DR-146) --light --tests wrong (rc=$rc vitest:[$vitest_line])" "$(cat "$ARGV" 2>/dev/null; echo "$out")"
fi
rm -rf "$FX"

# Fail-closed invocations: --light with --only, a malformed replay seed, a flag-shaped --tests path.
for bad_case in "--light --only=tsc" "SEED" "--tests=--watch"; do
  FX=$(new_fixture); add_playwright_fixtures "$FX"; ARGV="$FX/argv.log"
  if [ "$bad_case" = "SEED" ]; then
    out=$(PANDACORP_VITEST_SEED=abc WP08_ARGV_LOG="$ARGV" run_verify "$FX" 2>&1); rc=$?
  else
    # shellcheck disable=SC2086
    out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" $bad_case 2>&1); rc=$?
  fi
  if [ "$rc" -eq 2 ] && [ ! -s "$ARGV" ] && [ "$(json_get "$(report_path "$FX")" "d['green']")" = "False" ]; then
    ok "(DR-146) invalid invocation [$bad_case]: exit 2, no tool ran, verdict not green"
  else
    bad "(DR-146) invalid invocation [$bad_case] not refused (rc=$rc)" "$(cat "$ARGV" 2>/dev/null; echo "$out")"
  fi
  rm -rf "$FX"
done

# Two runs with the same replay seed pass vitest the same order arguments; an unset seed is random.
FX=$(new_fixture); add_playwright_fixtures "$FX"; ARGV="$FX/argv.log"
PANDACORP_VITEST_SEED=9 WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=vitest >/dev/null 2>&1
PANDACORP_VITEST_SEED=9 WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=vitest >/dev/null 2>&1
WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=vitest >/dev/null 2>&1
seeds=$(grep '^pnpm vitest' "$ARGV" | sed -E 's/.*--sequence.seed=([0-9]+).*/\1/' | tr '\n' ' ')
if [ "$(grep -c -- '--sequence.seed=9$' "$ARGV")" = "2" ] && [ "$(grep -c -- '--sequence.shuffle' "$ARGV")" = "3" ]; then
  ok "(DR-146) PANDACORP_VITEST_SEED replays the same order; every vitest run is shuffled (seeds: $seeds)"
else
  bad "(DR-146) seed replay wrong (seeds: $seeds)" "$(cat "$ARGV")"
fi
rm -rf "$FX"

# Certified-tree stamp — needs a real git checkout with the project's own copy of verify.sh and the
# real green-stamp.sh (the stamp binds the hash of .pandacorp/verify.sh).
STAMP_SH="$HERE/plugin/templates/shared/.pandacorp/green-stamp.sh"
new_git_fixture() {
  local d
  d=$(new_fixture); add_playwright_fixtures "$d"
  cp "$VERIFY" "$d/.pandacorp/verify.sh"; cp "$STAMP_SH" "$d/.pandacorp/green-stamp.sh"
  printf '.pandacorp/run/\nargv.log\n' > "$d/.gitignore"
  ( cd "$d" && git init -q && git add -A && git -c user.email=t@pandacorp.local -c user.name=T -c commit.gpgsign=false commit -qm base )
  printf '%s\n' "$d"
}
run_local_verify() { local d="$1"; shift; ( cd "$d" && PATH="$d/bin:$PATH" bash .pandacorp/verify.sh "$@" ); }
stamp_ok() { ( cd "$1" && bash .pandacorp/green-stamp.sh check >/dev/null 2>&1 ); }

FX=$(new_git_fixture)
run_local_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 0 ] && stamp_ok "$FX" \
   && [ "$(sed -n 's/^tree=//p' "$FX/.pandacorp/run/green-stamp")" = "$(git -C "$FX" rev-parse 'HEAD^{tree}')" ]; then
  ok "(DR-146) a FULL green on a clean tree certifies exactly HEAD^{tree}"
else
  bad "(DR-146) full clean green did not certify the tree (rc=$rc)" "$(cat "$FX/.pandacorp/run/green-stamp" 2>&1)"
fi
before=$(cat "$FX/.pandacorp/run/green-stamp")
run_local_verify "$FX" --light >/dev/null 2>&1
run_local_verify "$FX" --only=tsc >/dev/null 2>&1
if [ "$(cat "$FX/.pandacorp/run/green-stamp")" = "$before" ]; then
  ok "(DR-146) a green partial/--light run neither mints nor rewrites the stamp"
else
  bad "(DR-146) a partial run rewrote the stamp" "$(cat "$FX/.pandacorp/run/green-stamp")"
fi
WP05_FAIL_TSC=1 run_local_verify "$FX" --only=tsc >/dev/null 2>&1
if [ ! -f "$FX/.pandacorp/run/green-stamp" ]; then
  ok "(DR-146) any red run drops the stamp"
else
  bad "(DR-146) a red run left the stamp in place"
fi
echo dirty > "$FX/src/dirty.ts"
run_local_verify "$FX" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 0 ] && [ ! -f "$FX/.pandacorp/run/green-stamp" ]; then
  ok "(DR-146) a full green on a DIRTY tree (untracked file) certifies nothing"
else
  bad "(DR-146) dirty-tree green minted a stamp (rc=$rc)"
fi
rm -f "$FX/src/dirty.ts"
run_local_verify "$FX" --since HEAD >/dev/null 2>&1
if [ ! -f "$FX/.pandacorp/run/green-stamp" ]; then
  ok "(DR-146) a --since green certifies nothing"
else
  bad "(DR-146) a --since green minted a stamp"
fi
rm -rf "$FX"

# DR-158: real Git histories + stubbed tools prove selection, not browser performance.
new_affected_fixture() {
  local dir
  dir=$(new_fixture)
  add_playwright_fixtures "$dir"
  mkdir -p "$dir/src/queries"
  echo 'export const rows = 1;' > "$dir/src/queries/rows.ts"
  printf '.pandacorp/run/\n*.log\n' > "$dir/.gitignore"
  git -C "$dir" init -q
  git -C "$dir" add .
  git -C "$dir" -c user.name=Fixture -c user.email=fixture@example.test commit -qm base
  git -C "$dir" update-ref refs/remotes/origin/main HEAD
  printf '%s\n' "$dir"
}
check_affected() {
  local dir="$1" expected="$2" label="$3"; shift 3
  local output result=0
  : > "$dir/argv.log"
  output=$(WP08_ARGV_LOG="$dir/argv.log" run_verify "$dir" "$@" 2>&1) || result=$?
  if [ "$result" -eq 0 ] && python3 - "$dir" "$expected" "$@" <<'PY'
import json, pathlib, sys
root, expected = pathlib.Path(sys.argv[1]), sys.argv[2]
d = json.loads((root / '.pandacorp/run/gate-report.json').read_text())
argv = (root / 'argv.log').read_text()
assert d['green'] is True
assert 'pnpm vitest run' in argv and 'pnpm tsc --noEmit' in argv
if expected == 'skip':
    assert d['scope'] == 'partial', d
    assert d['scope_reason'] == 'affected-no-ui', d
    assert d['browser']['status'] == 'omitted-by-diff', d
    assert d['browser']['base'], d
    assert 'playwright' not in [s['name'] for s in d['subgates']]
    assert 'pnpm exec playwright' not in argv
else:
    assert d['scope'] == ('partial' if '--affected' in sys.argv else 'full'), d
    assert 'scope_reason' not in d
    assert 'pnpm exec playwright test e2e/\n' in argv, argv
    assert 'playwright' in [s['name'] for s in d['subgates']]
PY
  then ok "(DR-158) $label"; else bad "(DR-158) $label (rc=$result)" "$output"; fi
}
FX=$(new_affected_fixture)
echo '// data only' >> "$FX/src/queries/rows.ts"
check_affected "$FX" skip 'data-only working tree omits browser honestly' --affected
check_affected "$FX" run 'without flag the same data diff runs the original full suite'
git -C "$FX" add src/queries/rows.ts
check_affected "$FX" skip 'staged data diff omits browser' --affected
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm data
check_affected "$FX" skip 'committed data diff uses default origin/main' --affected
check_affected "$FX" skip 'explicit --since base works with --affected' --since HEAD~1 --affected
check_affected "$FX" run 'invalid Git base falls back to full suite' --since missing-ref --affected
# Added files under safe data paths, including whitespace/newlines, must be handled with NUL paths.
printf '// rows\n' > "$FX/src/queries/new rows
file.ts"
check_affected "$FX" skip 'untracked data with newline in path is handled safely' --affected
# UI wins over a safe-directory match. Unknown paths always select the browser.
for changed in src/app/page.tsx src/components/Card.tsx src/hooks/useRows.ts src/styles/theme.css src/tokens/colors.ts src/messages/en.json src/i18n/messages.ts e2e/new.spec.ts playwright.config.ts next.config.mjs public/icon.svg package.json pnpm-lock.yaml docs/design/tokens.json prisma/schema.prisma src/queries/Widget.tsx src/queries/theme.css src/lib/unknown.ts; do
  mkdir -p "$FX/$(dirname "$changed")"
  printf '\n' >> "$FX/$changed"
  check_affected "$FX" run "UI/unknown path selects browser: $changed" --affected
  # Restore only the file this scenario changed, preserving the data diff.
  if git -C "$FX" ls-files --error-unmatch "$changed" >/dev/null 2>&1; then
    git -C "$FX" restore -- "$changed"
  else
    rm -f "$FX/$changed"
  fi
done
# Project additions only widen browser selection; the file itself is never managed by upgrade.
printf '{"ui":["src/queries/**"]}\n' > "$FX/.pandacorp/verify-affected.json"
git -C "$FX" add .pandacorp/verify-affected.json
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm config
git -C "$FX" update-ref refs/remotes/origin/main HEAD
printf '// local ui dependency\n' >> "$FX/src/queries/rows.ts"
check_affected "$FX" run 'local UI additions override data allowlist' --affected
printf '{"skip":["**"]}\n' > "$FX/.pandacorp/verify-affected.json"
check_affected "$FX" run 'invalid extension config falls back to full suite' --affected
rm -f "$FX/.pandacorp/verify-affected.json"
git -C "$FX" restore -- .pandacorp/verify-affected.json
# Deleting or renaming UI into a safe directory must include the old path in selection.
git -C "$FX" mv playwright.config.ts src/queries/old-config.ts
out=$(run_verify "$FX" --affected 2>&1); rc=$?
if [ "$rc" -ne 0 ] && [ "$(json_get "$(report_path "$FX")" "d['green']")" = False ]; then
  ok '(DR-158) UI rename/deletion runs browser presence gate and stays RED'
else bad '(DR-158) UI rename/deletion must not omit missing harness' "$out"; fi
rm -rf "$FX"
FX=$(new_fixture)
add_playwright_fixtures "$FX"
check_affected "$FX" run 'Git command failure outside a repository runs full suite' --affected
rm -rf "$FX"

# Independent adversarial regression: a staged UI edit cannot disappear from classification
# merely because an unstaged edit restores the old bytes (the index still contains UI work).
FX=$(new_affected_fixture)
printf '// staged UI change\n' >> "$FX/playwright.config.ts"
git -C "$FX" add playwright.config.ts
git -C "$FX" show HEAD:playwright.config.ts > "$FX/playwright.config.ts"
check_affected "$FX" run 'staged UI change survives an unstaged reverse edit' --affected
rm -rf "$FX"

# Index flags can hide local UI edits from every diff/status layer. Even a clean
# flagged path makes classification uncertain, so keep the full suite for ANY flag.
for flag in assume-unchanged skip-worktree; do
  FX=$(new_affected_fixture)
  git -C "$FX" update-index "--$flag" src/queries/rows.ts
  check_affected "$FX" run "clean data path with $flag retains browser" --affected
  git -C "$FX" update-index "--no-$flag" src/queries/rows.ts
  mkdir -p "$FX/src/app"
  printf 'export default function Page() { return null; }\n' > "$FX/src/app/page.tsx"
  git -C "$FX" add src/app/page.tsx
  git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm page
  git -C "$FX" update-ref refs/remotes/origin/main HEAD
  git -C "$FX" update-index "--$flag" src/app/page.tsx
  printf 'export default function Page() { throw Error("broken"); }\n' > "$FX/src/app/page.tsx"
  printf '// visible data diff\n' >> "$FX/src/queries/rows.ts"
  check_affected "$FX" run "hidden UI edit with $flag retains browser" --affected
  rm -rf "$FX"
done

# A tracked symlink can expose apparently data-only paths as UI. Keep selection
# conservative for all tracked symlinks, in the index AND both diff endpoint trees.
FX=$(new_affected_fixture)
ln -s queries "$FX/src/app"
git -C "$FX" add src/app
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm alias
git -C "$FX" update-ref refs/remotes/origin/main HEAD
mkdir -p "$FX/src/queries/new"
printf 'export default function Page() { throw Error("broken"); }\n' > "$FX/src/queries/new/page.ts"
check_affected "$FX" run 'UI directory alias exposes a new data-path route' --affected
rm -rf "$FX"

FX=$(new_affected_fixture)
mkdir -p "$FX/src/app"
ln -s ../queries/rows.ts "$FX/src/app/page.tsx"
git -C "$FX" add src/app/page.tsx
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm alias
git -C "$FX" update-ref refs/remotes/origin/main HEAD
printf '// changed UI target\n' >> "$FX/src/queries/rows.ts"
check_affected "$FX" run 'UI file alias exposes a modified data target' --affected
rm -rf "$FX"

for layer in staged unstaged committed deleted-unstaged deleted-staged deleted-committed; do
  FX=$(new_affected_fixture)
  # A dangling alias is still a symlink; a removed alias is no longer visible to islink().
  ln -s ../app/page.tsx "$FX/src/queries/link.ts"
  git -C "$FX" add src/queries/link.ts
  if [ "$layer" = unstaged ]; then
    git -C "$FX" reset -q HEAD -- src/queries/link.ts
  elif [ "$layer" != staged ]; then
    git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm alias
    if [ "$layer" != committed ]; then
      git -C "$FX" update-ref refs/remotes/origin/main HEAD
      rm -f "$FX/src/queries/link.ts"
      if [ "$layer" != deleted-unstaged ]; then git -C "$FX" add src/queries/link.ts; fi
      if [ "$layer" = deleted-committed ]; then
        git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm deletion
      fi
    fi
  fi
  check_affected "$FX" run "$layer symlink retains browser (including deleted alias)" --affected
  rm -rf "$FX"
done

# Review R2: a gitlink can look like a data-only .ts path while hiding nested UI.
FX=$(new_affected_fixture)
git -C "$FX" update-index --add --cacheinfo "160000,$(git -C "$FX" rev-parse HEAD),src/queries/widget.ts"
check_affected "$FX" run 'gitlink under data allowlist retains browser' --affected
rm -rf "$FX"

# Presence alone invalidates selection, even when the monitor is disabled.
FX=$(new_affected_fixture)
git -C "$FX" config core.fsmonitor false
check_affected "$FX" run 'configured fsmonitor retains browser' --affected
rm -rf "$FX"

# Attributes are baseline state: they must not need to appear in the current diff.
for source in tracked info clean-config; do
  FX=$(new_affected_fixture)
  if [ "$source" = tracked ]; then
    printf 'src/queries/*.ts filter=hide\n' > "$FX/.gitattributes"
    git -C "$FX" add .gitattributes
    git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm attributes
    git -C "$FX" update-ref refs/remotes/origin/main HEAD
  elif [ "$source" = info ]; then
    printf 'src/queries/*.ts filter=hide\n' > "$FX/.git/info/attributes"
  else
    git -C "$FX" config filter.hide.clean cat
  fi
  check_affected "$FX" run "$source filter retains browser" --affected
  rm -rf "$FX"
done


# DR-158: fail fast without changing replayable ordering; diagnostics collect all failures.
FX=$(new_fixture); add_playwright_fixtures "$FX"; ARGV="$FX/argv.log"
WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=vitest >/dev/null 2>&1
if grep -q -- '--bail=1' "$ARGV"; then ok '(DR-158) Vitest bails by default'; else bad '(DR-158) missing bail'; fi
: > "$ARGV"
WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=vitest --no-bail >/dev/null 2>&1
if grep -q -- '--bail=0' "$ARGV"; then ok '(DR-158) diagnostic Vitest accumulates'; else bad '(DR-158) missing diagnostic bail'; fi
rm -rf "$FX"

# Real inherited advisory lock: second gate must not run tools or overwrite owner report.
FX=$(new_fixture); add_playwright_fixtures "$FX"
python3 - "$FX" <<'LOCKPY' &
import fcntl, pathlib, sys, time
root=pathlib.Path(sys.argv[1]); run=root/'.pandacorp/run'; run.mkdir(exist_ok=True)
with (run/'verify.lock').open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    lock.write('fixture-owner'); lock.flush()
    (run/'gate-report.json').write_text('owner-report')
    (run/'ready').touch()
    while not (run/'release').exists(): time.sleep(.02)
LOCKPY
owner=$!
for i in $(seq 1 150); do [ -f "$FX/.pandacorp/run/ready" ] && break; sleep .02; done
out=$(run_verify "$FX" 2>&1); rc=$?
if [ "$rc" = 75 ] && echo "$out" | grep -q 'verification owner' && [ "$(cat "$FX/.pandacorp/run/gate-report.json")" = owner-report ]; then
  ok '(DR-158) concurrent owner refused before report/tool writes (exit 75)'
else bad '(DR-158) concurrent gate was not isolated' "$out"; fi
touch "$FX/.pandacorp/run/release"; wait "$owner"
run_verify "$FX" --only=tsc >/dev/null 2>&1
if [ "$?" = 0 ]; then ok '(DR-158) released lock accepts next gate'; else bad '(DR-158) stale lock file blocked gate'; fi
rm -rf "$FX"

# Ignored inputs must invalidate reuse; a mutation DURING certification must prevent recording.
FX=$(new_git_fixture)
printf '\n.env.local\nnode_modules/\ne2e/fixtures/\n' >> "$FX/.gitignore"
mkdir -p "$FX/node_modules/.pnpm" "$FX/e2e/fixtures"
printf 'lock\n' > "$FX/pnpm-lock.yaml"
printf 'deps\n' > "$FX/node_modules/.pnpm/lock.yaml"
printf 'fixture\n' > "$FX/e2e/fixtures/data.json"
( cd "$FX" && git add .gitignore pnpm-lock.yaml && git -c user.email=t@pandacorp.local -c user.name=T commit -qm inputs )
for input in .env.local node_modules/.pnpm/lock.yaml e2e/fixtures/data.json pnpm-lock.yaml; do
  run_local_verify "$FX" >/dev/null 2>&1
  printf 'changed\n' >> "$FX/$input"
  if ! stamp_ok "$FX"; then ok "(DR-158) changed $input invalidates stamp"; else bad "(DR-158) stale stamp accepted $input"; fi
  if [ "$input" = pnpm-lock.yaml ]; then git -C "$FX" restore -- pnpm-lock.yaml; fi
done
start=$(cd "$FX" && bash .pandacorp/green-stamp.sh start)
printf 'changed-again\n' >> "$FX/e2e/fixtures/data.json"
if (cd "$FX" && bash .pandacorp/green-stamp.sh record "$start" >/dev/null 2>&1); then bad '(DR-158) changed inputs during run certified'; else ok '(DR-158) changed inputs during run cannot certify'; fi
rm -rf "$FX"

FX=$(new_git_fixture)
for input in PANDACORP_GATE_SKIP_ROUTES PANDACORP_CODEX_EVENTS_FILE; do
  ( export "$input=/omitted"; run_local_verify "$FX" >/dev/null 2>&1 )
  if stamp_ok "$FX"; then bad "(DR-158) omitted $input reused broader certificate"; else ok "(DR-158) changed $input invalidates certificate reuse"; fi
done
rm -rf "$FX"

# Nested Mission Control-style project: do not drop outside changes from the impact union.
FX=$(new_affected_fixture)
mkdir "$FX/app"
for entry in .gitignore package.json bin src e2e playwright.config.ts .pandacorp; do mv "$FX/$entry" "$FX/app/$entry"; done
( cd "$FX" && git add -A && git -c user.name=Fixture -c user.email=fixture@example.test commit -qm nested && git update-ref refs/remotes/origin/main HEAD )
printf '// nested query\n' >> "$FX/app/src/queries/rows.ts"
check_affected "$FX/app" skip 'nested data-only project can omit browser' --affected
printf '// unknown outside project\n' > "$FX/outside.ts"
check_affected "$FX/app" run 'untracked outside project retains browser' --affected
( cd "$FX" && git add outside.ts )
check_affected "$FX/app" run 'staged outside project retains browser' --affected
rm -rf "$FX"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
