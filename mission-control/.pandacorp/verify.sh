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
#   Playwright fail fast by default; --no-bail (or PANDACORP_VERIFY_NO_BAIL=1) accumulates failures.
#   Without the flag, the cheap gates keep today's exact fail-fast behavior.
#   ALWAYS (every run, every mode, green or red, with or without `--report-all`) writes
#   `.pandacorp/run/gate-report.json` — a machine-readable verdict for Mission Control or any other
#   reader, so nobody has to scrape this script's human stdout. LESSON-0155: a stale report from a
#   previous run must never be read as this run's verdict, so it is deleted before anything runs.
#
# WP-08 additions — SCOPE only, nothing here ever softens what counts as red:
#   `--only=<subgate>[,<subgate>...]`: run ONLY the named sub-gates (names exactly as they appear in
#   the gate report: structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome
#   tsc knip madge vitest playwright). An unknown name is FAIL-CLOSED — non-zero exit before any gate
#   runs, never a silent fallback to the full suite.
#   `--files=<path>[,<path>...]`: narrow the two file-addressable gates — biome runs on exactly those
#   paths, and vitest switches to `vitest related <paths>` (the tests those files affect). tsc, knip
#   and madge stay WHOLE-PROJECT by design: they are whole-program analyses whose whole value is
#   catching what a scoped run cannot see, and they are the cheap ones anyway (~2.5s/1.6s/3.1s).
#   EITHER flag stamps the report `"scope":"partial"`. That label is load-bearing: the build engine
#   REFUSES to promote a work order to VERIFIED or advance `last_green_sha` on a partial report, so a
#   scoped run can never be mistaken for a full green by a later reader. A scoped run writes nothing
#   but the report (which, being partial, is self-describing), so it leaves no other artifact behind.
#
# DR-146 additions — SCOPE, ORDER and PROVENANCE only, nothing here ever softens what counts as red:
#   `--affected`: iteration only; omit browser ONLY for proven data-only diffs (queries/worker).
#   UI, unknown paths or uncertain Git keep the browser. Always partial, never certification.
#   `--light`: the Stop hook's per-turn gate — every cheap static sub-gate (structure guard through
#   madge, whole project), NEVER Playwright and NEVER the whole vitest suite. Exclusive with `--only`.
#   `--tests=<test-file>[,...]`: vitest runs EXACTLY these test files (`vitest run <files>`), nothing
#   inferred. With `--light` it adds vitest to the light set. Both flags stamp `"scope":"partial"`.
#   Vitest always runs in a shuffled order with an explicit seed, printed before the run and recorded
#   as `vitest_seed` in gate-report.json; `PANDACORP_VITEST_SEED=<n>` replays that exact order.
#   Certified tree: a FULL run (no --since/--only/--files/--light/--tests) that exits 0 on a tree
#   that was clean when it started records that tree via `.pandacorp/green-stamp.sh`; every red exit
#   drops the stamp. merge-queue.sh and the Stop hook trust ONLY that stamp to skip a re-run.
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true  # bash 4.4+; no-op on macOS' bash 3.2 (avoids "invalid shell option")

# DR-158: one verification owner per physical checkout, BEFORE touching reports/stamps/builds.
# The kernel releases this advisory lock after the owner and its children exit, including crashes.
# Keep the inode: unlinking a lock file would let a third owner lock a different inode.
if [ "${PANDACORP_VERIFY_OWNER_PID:-}" != "$$" ]; then
  exec python3 - "$0" "$@" <<'OWNERPY'
import fcntl
import os
from pathlib import Path
import sys

run = Path('.pandacorp/run')
run.mkdir(parents=True, exist_ok=True)
lock = os.open(run / 'verify.lock', os.O_RDWR | os.O_CREAT, 0o600)
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    owner = os.read(lock, 4096).decode(errors='replace').strip() or 'initializing'
    print(f'verify: verification owner busy in {Path.cwd()}: {owner}; wait for it to exit, then retry (exit 75; no project verdict)', file=sys.stderr)
    sys.exit(75)
os.ftruncate(lock, 0)
os.write(lock, f'pid={os.getpid()} checkout={Path.cwd()}'.encode())
os.dup2(lock, 9, inheritable=True)
if lock != 9:
    os.close(lock)
os.environ['PANDACORP_VERIFY_OWNER_PID'] = str(os.getpid())
os.execvp('bash', ['bash', *sys.argv[1:]])
OWNERPY
fi

# --- Optional scope: `verify.sh --since <sha>` (the fast per-FRD gate) ----------
# Runs only the vitest tests CHANGED since <sha>; biome/tsc/knip/madge stay global
# (fast enough, and they scale). ALSO scopes the browser layer (DR-106): in --since mode
# only smoke + shell run (correctness + gross structure — exactly what the DR-072 gate may
# block on); visual + responsive belong to the FULL unscoped suite at close-out + the
# end-of-build Visual QA pass (fidelity is ADVISORY at the per-FRD gate, never a block).
# Before DR-106 every FRD gate ran the WHOLE serialized e2e suite (workers:1) — the single
# biggest wall-clock cost of a build (11 gates x full Playwright in the personal-page-v2 run).
AFFECTED=0
AFFECTED_BASE="origin/main"
for _affected_arg in "$@"; do
  [ "$_affected_arg" != "--affected" ] || AFFECTED=1
done
SINCE=""
if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then SINCE="$2"; fi
# In affected mode --since is the diff base (any argument position); all OTHER gates stay full.
# Without --affected, preserve the legacy positional --since behavior and command lines exactly.
if [ "$AFFECTED" -eq 1 ]; then
  _affected_expect=0
  for _affected_arg in "$@"; do
    if [ "$_affected_expect" -eq 1 ]; then
      AFFECTED_BASE="$_affected_arg"
      _affected_expect=0
    elif [ "$_affected_arg" = "--since" ]; then
      AFFECTED_BASE=""  # Missing/invalid ref makes the classifier retain the full browser layer.
      _affected_expect=1
    fi
  done
  SINCE=""
fi
# D11: --since is ONLY recognised at position $1 (above) — anywhere else it silently no-ops
# (REV2-H characterised this; the engine's own contract already never emits it elsewhere). Warn so a
# caller sees why the run went unscoped instead of just noticing scope isn't "since" later.
if [ "$AFFECTED" -eq 0 ] && [ "${1:-}" != "--since" ]; then
  for _wp11_arg in "$@"; do
    if [ "$_wp11_arg" = "--since" ]; then
      echo "⚠ --since ignored: it must be the first argument"
      echo "⚠ --since ignored: it must be the first argument"
      break
    fi
  done
fi

# --- Gate-report scaffolding (WP-05) — the stale-report DELETE runs before ANY branch below,
# including --canary (REV-C/LESSON-0155): a report left by a PREVIOUS verify run must never survive
# to be misread as a canary/current run's verdict. Only the mkdir/rm belong here — the rest of the
# report machinery (timestamps, fragments dir, the trap) stays below, after the --canary early exit,
# since --canary never generates a gate-report.json of its own (see that block's comment).
REPORT_DIR=".pandacorp/run"
REPORT_FILE="$REPORT_DIR/gate-report.json"
mkdir -p "$REPORT_DIR"
rm -f "$REPORT_FILE" "$REPORT_DIR/stamp-record-result.json"

# DR-159: inventory drift is advisory; selection remains serial + both platforms.
# Opt in independently on each axis by keeping its project-owned inventory.
python3 - <<'INVENTORYPY'
import json
from pathlib import Path
import re

root = Path('e2e')
specs = sorted(p.relative_to(root).as_posix() for p in root.rglob('*')
               if p.is_file() and re.search(r'\.(spec|test)\.[cm]?[jt]sx?$', p.name))
def load(name):
    return json.loads((root / name).read_text())
def warn(message):
    print('WARN DR-159: ' + message)
if any((root / name).exists() for name in ['parallel-safe.json', 'isolated-specs.json', 'serial-specs.json']):
    try:
        safe = load('parallel-safe.json') if (root / 'parallel-safe.json').exists() else []
        serial = load('serial-specs.json') if (root / 'serial-specs.json').exists() else {}
        isolated = load('isolated-specs.json') if (root / 'isolated-specs.json').exists() else {}
        if (not isinstance(safe, list) or any(not isinstance(x, str) for x in safe)
                or not isinstance(serial, dict) or not isinstance(isolated, dict)
                or any(not isinstance(v, str) or not v.strip() for v in [*serial.values(), *isolated.values()])):
            raise ValueError('expected parallel array and serial/isolated {spec: reason} objects')
        missing = sorted(set(specs) - set(safe) - set(serial) - set(isolated))
        if missing:
            warn('unclassified parallel/serial specs (kept serial):\n  ' + '\n  '.join(missing)
                 + '\n  Review transitive writes; update parallel-safe.json, isolated-specs.json or serial-specs.json with reasons.')
        overlap = sorted((set(safe) & set(serial)) | (set(safe) & set(isolated)) | (set(serial) & set(isolated)))
        if overlap:
            warn('conflicting parallel/serial classifications: ' + ', '.join(overlap))
        stale = sorted((set(safe) | set(serial) | set(isolated)) - set(specs))
        if stale:
            warn('stale parallel/serial entries: ' + ', '.join(stale))
    except (OSError, ValueError, TypeError) as error:
        warn('cannot audit parallel/serial inventory: ' + str(error))
if (root / 'mobile-specs.json').exists():
    try:
        mobile = load('mobile-specs.json')
        included, excluded = mobile['include'], mobile['desktopOnly']
        if (not isinstance(included, list) or not isinstance(excluded, list)
                or any(not isinstance(x, str) for x in included + excluded)):
            raise ValueError('expected include/desktopOnly string arrays')
        missing = sorted(set(specs) - set(included) - set(excluded))
        if missing:
            warn('unclassified mobile specs (kept on both platforms):\n  ' + '\n  '.join(missing)
                 + '\n  Update mobile-specs.json and its review document with viewport evidence.')
    except (OSError, ValueError, TypeError, KeyError) as error:
        warn('cannot audit mobile inventory: ' + str(error))
INVENTORYPY

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
# WP-08 rides the SAME scan for `--only` / `--files` (both the `--only=x,y` and the `--only x,y`
# spelling, so a plausible invocation can never be silently ignored and degrade to a full run).
NO_BAIL="${PANDACORP_VERIFY_NO_BAIL:-0}"
REPORT_ALL=0
DIAGNOSE_UNIT=0
ONLY_GATES=""
SCOPE_FILES=""
LIGHT=0
SCOPE_TESTS=""
_wp08_expect=""
for _wp05_arg in "$@"; do
  if [ -n "$_wp08_expect" ]; then
    case "$_wp08_expect" in
      only)  ONLY_GATES="$_wp05_arg" ;;
      files) SCOPE_FILES="$_wp05_arg" ;;
      tests) SCOPE_TESTS="$_wp05_arg" ;;
    esac
    _wp08_expect=""
    continue
  fi
  case "$_wp05_arg" in
    --report-all) REPORT_ALL=1 ;;
    --diagnose-unit) DIAGNOSE_UNIT=1; REPORT_ALL=1 ;;
    --no-bail) NO_BAIL=1 ;;
    --affected) AFFECTED=1 ;;
    --light)      LIGHT=1 ;;
    --only=*)     ONLY_GATES="${_wp05_arg#--only=}" ;;
    --files=*)    SCOPE_FILES="${_wp05_arg#--files=}" ;;
    --tests=*)    SCOPE_TESTS="${_wp05_arg#--tests=}" ;;
    --only)       _wp08_expect="only" ;;
    --files)      _wp08_expect="files" ;;
    --tests)      _wp08_expect="tests" ;;
  esac
done

# The `--files` list as a real argv array (bash 3.2 compatible). Kept EMPTY when the flag is absent,
# which is what every "unscoped behaves exactly as before" branch below tests against.
SCOPE_FILES_ARR=()
if [ -n "$SCOPE_FILES" ]; then
  _wp08_oldifs="$IFS"
  IFS=','
  for _wp08_f in $SCOPE_FILES; do
    if [ -n "$_wp08_f" ]; then SCOPE_FILES_ARR+=("$_wp08_f"); fi
  done
  IFS="$_wp08_oldifs"
fi
SCOPE_TESTS_ARR=()
if [ -n "$SCOPE_TESTS" ]; then
  _wp08_oldifs="$IFS"
  IFS=','
  for _wp08_f in $SCOPE_TESTS; do
    if [ -n "$_wp08_f" ]; then SCOPE_TESTS_ARR+=("$_wp08_f"); fi
  done
  IFS="$_wp08_oldifs"
fi

# The canonical sub-gate names — the SAME strings the gate report's `name` field carries, so the
# engine can feed a report's failing sub-gate straight back in as `--only=<name>`.
KNOWN_GATES="live-data-asserts structure-guard data-layer api-error-contract doc-lint residual-ambiguity biome tsc knip madge vitest playwright"
# DR-146 `--light`: derived from KNOWN_GATES (one list, never a second hand-kept copy) — every cheap
# gate, vitest only for an explicit `--tests` list, never Playwright. `--only` would make the meaning
# of the run ambiguous, so the combination is refused below (fail-closed), never resolved silently.
# Diagnosis accumulates all static and unit failures, without changing Playwright's
# worker policy through PANDACORP_VERIFY_NO_BAIL. It can never certify a tree.
if [ "$DIAGNOSE_UNIT" -eq 1 ]; then
  [ -z "$ONLY_GATES$SCOPE_FILES$SCOPE_TESTS$SINCE" ] && [ "$LIGHT" -eq 0 ] && [ "$AFFECTED" -eq 0 ] || {
    echo 'verify: --diagnose-unit cannot be narrowed or combined with other scope flags' >&2; exit 2;
  }
  for _diagnose_gate in $KNOWN_GATES; do
    [ "$_diagnose_gate" = playwright ] || ONLY_GATES="$ONLY_GATES,$_diagnose_gate"
  done
  ONLY_GATES="${ONLY_GATES#,}"
fi
LIGHT_CONFLICT=0
if [ "$LIGHT" -eq 1 ]; then
  if [ -n "$ONLY_GATES" ]; then
    LIGHT_CONFLICT=1
  else
    for _dr146_g in $KNOWN_GATES; do
      case "$_dr146_g" in
        playwright) ;;
        vitest) [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ] && ONLY_GATES="$ONLY_GATES,vitest" ;;
        *) ONLY_GATES="$ONLY_GATES,$_dr146_g" ;;
      esac
    done
    ONLY_GATES="${ONLY_GATES#,}"
  fi
fi
gate_selected() {
  if [ -z "$ONLY_GATES" ]; then return 0; fi
  case ",$ONLY_GATES," in
    *",$1,"*) return 0 ;;
  esac
  return 1
}

# --- Gate-report scaffolding (WP-05) — ALWAYS-written `.pandacorp/run/gate-report.json` -------
# `.pandacorp/run/` is the existing gitignored runtime-scratch convention (see .pandacorp/run/
# lessons.md) — never committed, never conformance-checked, purely machine state for this run.
# REPORT_DIR/REPORT_FILE + the stale-report delete moved ABOVE the --canary branch (REV-C); only the
# timestamp/scope/fragments-dir setup for actually WRITING a fresh report lives here.
GATE_RUN_AT=$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
GATE_SCOPE="full"
[ -n "$SINCE" ] && GATE_SCOPE="since"
# WP-08: `partial` outranks `since`. It is the WEAKEST claim this script can make about a run, and the
# engine's certification cage keys on exactly this value — so when both apply, report the weaker one.
[ -n "$ONLY_GATES$SCOPE_FILES$SCOPE_TESTS" ] && GATE_SCOPE="partial"
[ "$LIGHT" -eq 1 ] && GATE_SCOPE="partial"
[ "$AFFECTED" -eq 1 ] && GATE_SCOPE="partial"
# DR-158: the ONLY canonical path policy. fnmatchcase globs are repository-relative;
# '*' includes '/'. UI patterns win; everything outside DATA_ONLY is unknown => browser runs.
# A project may ADD UI globs in .pandacorp/verify-affected.json (never overwrite on upgrade).
# Git failures, invalid config and unusual paths all retain the browser gate.
# Nested projects normalize repo paths; a change outside the project is unknown, never ignored.
AFFECTED_SKIP=0
if [ "$AFFECTED" -eq 1 ]; then
  if python3 - "$AFFECTED_BASE" <<'PY'
import fnmatch
import json
import os
from pathlib import Path
import subprocess
import sys

UI = (
    'src/app/*', 'src/components/*', 'src/hooks/*', 'src/styles/*', 'src/tokens/*',
    'src/i18n/*', 'src/messages/*', 'messages/*', 'styles/*', 'tokens/*',
    'e2e/*', 'playwright.config.*', 'next.config.*', 'public/*',
    'package.json', '*lock*', 'docs/design/*', 'prisma/*',
    '*.tsx', '*.jsx', '*.css', '*.scss', '*.sass', '*.less', '*.svg',
)
DATA_ONLY = ('src/queries/*.ts', 'src/worker/*.ts')

def git(*args, input=None):
    return subprocess.check_output(['git', *args], input=input, stderr=subprocess.DEVNULL)

def matches(path, patterns):
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)

try:
    prefix = os.fsdecode(git('rev-parse', '--show-prefix')).strip()
    repo = os.fsdecode(git('rev-parse', '--show-toplevel')).strip()
    # Presence is enough: fsmonitor and clean filters can hide physical UI edits.
    # Exit 1 means absent; any other config error keeps the full suite.
    for pattern in (r'^core\.fsmonitor$', r'^filter\..*\.clean$'):
        result = subprocess.run(['git', 'config', '--get-regexp', pattern],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 1:
            raise ValueError('configured monitor/filter or config query failure')
    # Ask Git to resolve attributes (including nested .gitattributes and info/attributes)
    # for every tracked/non-ignored untracked file, regardless of its apparent diff.
    files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
    attrs = git('check-attr', '--all', '-z', '--stdin', input=files).split(b'\0')
    if attrs[-1] != b'' or (len(attrs) - 1) % 3:
        raise ValueError('invalid attribute response')
    if b'filter' in attrs[1::3]:
        raise ValueError('filter attribute makes working-tree changes uncertain')
    # Diff/status honor these index flags and can silently hide local UI edits.
    # -v lowercases assume-unchanged entries; S/s marks skip-worktree. Any such
    # entry invalidates path selection, even if its apparent path is data-only.
    for entry in git('-C', repo, 'ls-files', '-v', '-z').split(b'\0'):
        if entry and (entry[:1].islower() or entry[:1] == b'S'):
            raise ValueError('index flags can hide working-tree changes')
    ui = list(UI)
    config = Path('.pandacorp/verify-affected.json')
    if config.is_symlink():
        raise ValueError('symlinked config')
    if config.exists():
        extra = json.loads(config.read_text())
        if (not isinstance(extra, dict) or set(extra) != {'ui'}
                or not isinstance(extra['ui'], list)
                or any(not isinstance(p, str) or not p or p.startswith(('/', '-'))
                       or '..' in p.split('/') for p in extra['ui'])):
            raise ValueError('expected {"ui": ["repo-relative glob", ...]}')
        ui.extend(extra['ui'])
    base = git('rev-parse', '--verify', '--end-of-options', sys.argv[1] + '^{commit}').strip().decode('ascii')
    anchor = git('merge-base', base, 'HEAD').strip().decode('ascii')
    # A UI symlink can expose ANY data path (including newly added routes). Avoid
    # dependency/alias resolution entirely: any tracked symlink keeps the full suite.
    # Inspect BOTH trees plus the index so deleted, staged and dangling links count.
    # Gitlinks (submodules) can also hide arbitrary nested UI under a data-only path.
    entries = git('ls-tree', '-r', '-z', '--full-tree', anchor)
    entries += git('ls-tree', '-r', '-z', '--full-tree', 'HEAD')
    entries = b'\0'.join(entry for entry in entries.split(b'\0')
                         if b'\t' in entry and os.fsdecode(entry.split(b'\t', 1)[1]).startswith(prefix))
    entries += b'\0' + git('ls-files', '--stage', '-z')
    if any(entry.startswith((b'120000 ', b'160000 ')) for entry in entries.split(b'\0')):
        raise ValueError('tracked symlink/gitlink makes UI reachability uncertain')
    # --no-renames includes BOTH sides of renames. Union each Git layer separately:
    # a staged UI change restored only in the working tree must not cancel out of the diff.
    diff_options = ('--no-ext-diff', '--no-renames', '--ignore-submodules=none', '--name-only', '-z')
    paths = git('diff', *diff_options, anchor, 'HEAD', '--')
    paths += git('diff', *diff_options, '--cached', 'HEAD', '--')
    paths += git('diff', *diff_options, '--')
    paths += git('-C', repo, 'ls-files', '--others', '--exclude-standard', '-z')
    for raw in paths.split(b'\0'):
        if not raw:
            continue
        path = os.fsdecode(raw)
        if not path.startswith(prefix):
            raise ValueError('changed path outside nested project')
        path = path[len(prefix):]
        if (any(p.is_symlink() for p in (Path(path), *Path(path).parents))
                or matches(path, ui) or not matches(path, DATA_ONLY)
                or any(part in ('.', '..') for part in path.split('/'))):
            raise ValueError('UI or unknown path')
except (OSError, ValueError, subprocess.SubprocessError):
    sys.exit(1)  # No successful classification => run the original full browser layer.
sys.exit(0)
PY
  then
    AFFECTED_SKIP=1
    GATE_SCOPE="partial"  # Reuse the engine's unconditional no-VERIFIED/no-last_green cage.
    echo "↷ Playwright omitted by diff against $AFFECTED_BASE (scope: partial; not certification)"
  else
    echo "→ --affected: UI/unknown path or classification unavailable; retaining full browser gate"
  fi
fi

# BL-0147: stamp the commit this run verified so a LATER reader (the build engine's close-out/
# notify-end) can prove a report was produced for the EXACT commit it is about to re-verify, instead
# of trusting scope+green alone (which say nothing about WHICH commit). Best-effort — a fixture/non-
# git checkout (or a detached/rebasing tree mid-op) leaves it empty, never fails the gate over it.
GATE_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
# DR-146: the tree a FULL run is about to judge, captured BEFORE any gate and only when it is clean
# (green-stamp.sh owns what "clean" means). Empty = this run can never certify a tree.
STAMP_START_TREE=""

# DR-146: vitest order is always shuffled with an explicit seed so a red caused by test order can be
# replayed exactly. A malformed replay seed is an invocation error, never silently replaced.
VITEST_SEED="${PANDACORP_VITEST_SEED:-}"
VITEST_SEED_USED=""
if [ -z "$VITEST_SEED" ]; then
  VITEST_SEED=$(( ((RANDOM << 15) | RANDOM) + 1 ))
fi

GATE_FRAGMENTS_DIR=$(mktemp -d)
: > "$GATE_FRAGMENTS_DIR/fragments.jsonl"
HOST_SLOT_OWNED=""
# A full ad-hoc gate participates in the same host cap as the queue and the Node engine.
# Only an exact inherited token bypasses admission; a child never releases its caller's slot.
host_slot() {
  python3 - "$1" "$$" "$HOST_SLOT_OWNED" <<'SLOTPY'
import datetime
import json
import os
from pathlib import Path
import shutil
import sys
import time
import uuid

action, pid, owned = sys.argv[1:]
pid = int(pid)
def owner(slot):
    try:
        value = json.loads((slot / 'owner.json').read_text())
        return value if type(value.get('pid')) is int and value['pid'] > 0 else None
    except (OSError, ValueError, AttributeError):
        return None

def stale(slot):
    value = owner(slot)
    if value:
        try:
            os.kill(value['pid'], 0)
            return False
        except ProcessLookupError:
            return True
        except PermissionError:
            return False
    return time.time() - slot.stat().st_mtime > 60

def detach(slot, identity, allowed):
    tomb = slot.with_name(slot.name + '.tomb-' + str(uuid.uuid4()))
    try:
        current = slot.stat()
        if (current.st_dev, current.st_ino) != identity:
            return False
        slot.rename(tomb)
    except FileNotFoundError:
        return False
    current = tomb.stat()
    if (current.st_dev, current.st_ino) != identity or not allowed(tomb):
        # A re-taken/initializing directory is never ours to delete.
        if not slot.exists():
            tomb.rename(slot)
        return False
    shutil.rmtree(tomb)
    return True

# Same initialized-directory/unique-owner protocol as hostSlotMutex.mjs.
import contextlib
@contextlib.contextmanager
def admission_mutex(root, deadline=None):
    root = str(root)
    os.makedirs(root, exist_ok=True)
    token = uuid.uuid4().hex
    name = 'owner-%s-%s.json' % (os.getpid(), token)
    lock = os.path.join(root, '.admission.lock')
    staging = os.path.join(root, '.admission.new-%s-%s' % (os.getpid(), token))
    timeout = float(os.environ.get('PANDACORP_HOST_MUTEX_WAIT_S', '1'))
    if not 0 <= timeout <= 60: raise ValueError('invalid host mutex wait limit')
    if deadline is not None:
        timeout = min(timeout, max(0, deadline - time.monotonic()))
    started = time.monotonic()
    held = False
    def clear(directory):
        try: os.unlink(os.path.join(directory, name))
        except FileNotFoundError: pass
        try: os.rmdir(directory)
        except OSError as error:
            if error.errno not in (2, 17, 39, 66): raise
    try:
        os.mkdir(staging)
        with open(os.path.join(staging, name), 'x') as f:
            json.dump(dict(pid=os.getpid(), token=token), f)
        while True:
            try:
                os.rename(staging, lock)
                held = True
                break
            except OSError as error:
                if error.errno not in (17, 21, 39, 66): raise
            try: entries = os.listdir(lock)
            except FileNotFoundError: continue
            for entry in entries:
                parts = entry.split('-', 2)
                if len(parts) != 3 or parts[0] != 'owner' or not parts[1].isdigit() or not entry.endswith('.json'): continue
                try: os.kill(int(parts[1]), 0)
                except ProcessLookupError:
                    try: os.unlink(os.path.join(lock, entry))
                    except FileNotFoundError: pass
                except PermissionError: pass
            try: os.rmdir(lock)
            except OSError as error:
                if error.errno not in (2, 17, 39, 66): raise
            if time.monotonic() - started >= timeout: raise TimeoutError('host admission mutex busy')
            time.sleep(.01)
        yield
    finally:
        clear(lock if held else staging)

try:
    root = Path(os.environ.get('PANDACORP_HOST_DIR', str(Path.home() / '.pandacorp/host'))) / 'h-slots'
    if action == 'release':
        guard_root = Path(owned.rsplit('|', 1)[0]).parent if owned else root
        with admission_mutex(guard_root):
            if owned:
                name, token = owned.rsplit('|', 1)
                slot = Path(name)
                current = slot.stat()
                detach(slot, (current.st_dev, current.st_ino),
                       lambda target: (owner(target) or {}).get('token') == token)
            sys.exit(0)
    root.mkdir(parents=True, exist_ok=True)  # Any failure is RED, never optional admission.
    maximum = max(1, min(2, (os.cpu_count() or 1) // 4))
    timeout = float(os.environ.get('PANDACORP_HOST_SLOT_WAIT_S', '600'))
    if not 0 <= timeout < float('inf'):
        raise ValueError('invalid host slot wait limit')
    deadline = time.monotonic() + timeout
    while True:
        try:
            with admission_mutex(root, deadline):
                # Inherited validation competes for the same mutex as admission;
                # a busy mutex consumes the slot wait budget, not a gate verdict.
                inherited = os.environ.get('PANDACORP_HOST_SLOT_TOKEN', '')
                if '|' in inherited:
                    name, token = inherited.rsplit('|', 1)
                    if Path(name).parent.resolve() != root.resolve():
                        raise ValueError('inherited host slot root mismatch')
                    if token and Path(name).is_dir() and (owner(Path(name)) or {}).get('token') == token and not stale(Path(name)):
                        sys.exit(0)
                held = 0
                for index in range(maximum):
                    slot = root / ('slot-' + str(index))
                    for attempt in range(3):
                        try:
                            slot.mkdir()
                        except FileExistsError:
                            identity = slot.stat()
                            if not stale(slot):
                                held += 1
                                break
                            detach(slot, (identity.st_dev, identity.st_ino), stale)
                            continue
                        token = str(uuid.uuid4())
                        value = dict(pid=pid, kind='verify', project=str(Path.cwd()),
                                     at=datetime.datetime.now(datetime.timezone.utc).isoformat(), token=token)
                        # A publishing error leaves our newly created directory ownerless for the 60s grace.
                        temporary = slot / 'owner.json.tmp'
                        temporary.write_text(json.dumps(value) + '\n')
                        temporary.replace(slot / 'owner.json')
                        print(str(slot) + '|' + token)
                        sys.exit(0)
        except TimeoutError:
            held = maximum
        print(f'verify: waiting for host heavy-job slot; position {held + 1} ({held}/{maximum} held)', file=sys.stderr)
        if time.monotonic() >= deadline:
            raise TimeoutError('bounded host-slot wait expired')
        time.sleep(min(1, max(0, deadline - time.monotonic())))
except Exception as error:
    print('verify: environment not ready: host slot: ' + str(error), file=sys.stderr)
    sys.exit(16)
SLOTPY
}
cleanup_gate_report() {
  [ -z "$HOST_SLOT_OWNED" ] || host_slot release || true
  rm -rf "$GATE_FRAGMENTS_DIR"
}
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
  # BL-0179: stamp the `--since` base sha (the anchor this scoped run certified FROM) as `since` —
  # provenance for a reader of the report. The engine's close-out reuse no longer accepts a since-scoped
  # report (canary E2 finding 7: last_green_sha is itself published from since-scoped runs, so a since
  # report never adds up to a full one). Empty (never written) on a `full`/`partial` run.
  python3 - "$GATE_RUN_AT" "$GATE_SCOPE" "$green" "$GATE_SHA" "$SINCE" "$GATE_FRAGMENTS_DIR/fragments.jsonl" "$REPORT_FILE" "$VITEST_SEED_USED" "$AFFECTED_SKIP" "$AFFECTED_BASE" <<'PY'
import json
import sys

at, scope, green_str, sha, since, frag_path, out_path, vitest_seed = sys.argv[1:9]
subgates = []
with open(frag_path, "r") as fh:
    for line in fh:
        line = line.strip()
        if line:
            subgates.append(json.loads(line))

report = {"at": at, "scope": scope, "green": green_str == "true", "sha": sha, "subgates": subgates}
if sys.argv[9] == "1":
    report["scope_reason"] = "affected-no-ui"
    report["browser"] = {"status": "omitted-by-diff", "base": sys.argv[10]}
if since:
    report["since"] = since
if vitest_seed:
    report["vitest_seed"] = int(vitest_seed)
# Recorded baseline is project-owned, reviewed and never auto-raised by a slow run.
# Only full runs are comparable; a partial command can have a different workload.
from pathlib import Path
import math
budget_path = Path('.pandacorp/gate-budget.json')
if scope == 'full' and budget_path.exists():
    warnings = []
    try:
        budget = json.loads(budget_path.read_text())
        margin = budget.get('margin', 0.25)
        minimum = budget.get('min_delta_ms', 1000)
        stages = budget['stages']
        def number(value):
            return type(value) in (int, float) and math.isfinite(value)
        if (not number(margin) or margin < 0 or not number(minimum) or minimum < 0
                or not isinstance(stages, dict)
                or any(not number(v) or v <= 0 for v in stages.values())):
            raise ValueError('expected positive stage milliseconds and non-negative margin/min_delta_ms')
        for gate in subgates:
            baseline = stages.get(gate['name'])
            actual = gate['duration_ms']
            if baseline and actual > baseline * (1 + margin) and actual - baseline >= minimum:
                warnings.append(f"{gate['name']}: {actual} ms > baseline {baseline} ms + {margin:.0%}")
    except (OSError, ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:
        warnings.append('invalid gate-budget.json: ' + str(error))
    report['budget_warnings'] = warnings
    for warning in warnings:
        print('WARN DR-159 gate budget: ' + warning)
with open(out_path, "w") as fh:
    json.dump(report, fh, indent=2)
    fh.write("\n")
PY
  # DR-146 certified tree: only a FULL green that started on a clean tree may certify it (and
  # green-stamp.sh re-checks the tree is unchanged and still clean); ANY red drops the stamp so a
  # tree that just failed can never be skipped on the strength of an older green.
  # Record receipts preserve the ordinary gate verdict; the queue requires successful record.
  if [ -f .pandacorp/green-stamp.sh ]; then
    if [ "$green_exit" -ne 0 ]; then
      bash .pandacorp/green-stamp.sh invalidate || true
    elif [ "$GATE_SCOPE" = "full" ] && [ -n "$STAMP_START_TREE" ]; then
      record_rc=0
      record_reason=$(bash .pandacorp/green-stamp.sh record "$STAMP_START_TREE" 2>&1) || record_rc=$?
      python3 - "$record_rc" "$record_reason" <<'RECORDPY'
import json, sys
with open('.pandacorp/run/stamp-record-result.json', 'w') as f:
    json.dump(dict(ok=sys.argv[1] == '0', reason=sys.argv[2]), f)
RECORDPY
      printf '%s\n' "$record_reason"
    elif [ "$GATE_SCOPE" = full ]; then
      printf '%s\n' '{"ok":false,"reason":"start fingerprint unavailable (dirty tree or invalid inputs)"}' > .pandacorp/run/stamp-record-result.json
    fi
  fi
}

# --- WP-08 `--only` validation — FAIL-CLOSED, before a single gate runs ------------------------
# A typo'd sub-gate name must never degrade into "run everything" (which a reader would then see as a
# full green) nor into "run nothing" (a vacuous green). It is a hard non-zero exit, and the report it
# leaves behind says green:false with the offending invocation recorded as its own sub-gate entry.
if [ -n "$ONLY_GATES" ]; then
  _wp08_bad=""
  _wp08_oldifs="$IFS"
  IFS=','
  for _wp08_g in $ONLY_GATES; do
    if [ -n "$_wp08_g" ]; then
      case " $KNOWN_GATES " in
        *" $_wp08_g "*) ;;
        *) _wp08_bad="$_wp08_bad $_wp08_g" ;;
      esac
    fi
  done
  IFS="$_wp08_oldifs"
  if [ -n "$_wp08_bad" ]; then
    _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"
    {
      echo "✗ --only: unknown sub-gate name(s):$_wp08_bad"
      echo "   known sub-gates: $KNOWN_GATES"
    } | tee "$_wp08_log"
    record_gate_result invocation playwright 2 0 "$_wp08_log"
    write_gate_report 2
    exit 2
  fi
fi

# --- DR-146 `--light` / seed validation — FAIL-CLOSED, before a single gate runs ----------------
dr146_invocation_error() {
  local log="$GATE_FRAGMENTS_DIR/log-invocation.txt"
  echo "✗ $1" | tee "$log"
  record_gate_result invocation playwright 2 0 "$log"
  write_gate_report 2
  exit 2
}
case "$NO_BAIL" in 0|1) ;; *) dr146_invocation_error "PANDACORP_VERIFY_NO_BAIL must be 0 or 1" ;; esac
export PANDACORP_E2E_CERTIFICATION=1
export PANDACORP_VERIFY_NO_BAIL="$NO_BAIL"
if [ "$LIGHT_CONFLICT" -eq 1 ]; then
  dr146_invocation_error "--light and --only are exclusive (--light already names its sub-gates)"
fi
case "$VITEST_SEED" in
  ''|*[!0-9]*) dr146_invocation_error "PANDACORP_VITEST_SEED must be a positive integer, got '$VITEST_SEED'" ;;
esac

# --- D5 `--files` validation — FAIL-CLOSED, before a single gate runs --------------------------
# REV2-G: unlike --only, --files was forwarded VERBATIM into biome's/vitest's argv with no
# validation at all — a value shaped like a flag (`--files=--write`) turns a read-only biome CHECK
# into a project-wide `biome check --write` autofix. And a `..`-bearing path could escape the repo
# entirely. Reject BOTH before any gate runs, the same fail-closed shape as --only above.
# DR-146: `--tests` paths reach vitest's argv the same way, so they get the same two checks.
_dr146_paths=()
[ ${#SCOPE_FILES_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_FILES_ARR[@]}")
[ ${#SCOPE_TESTS_ARR[@]} -gt 0 ] && _dr146_paths+=("${SCOPE_TESTS_ARR[@]}")
if [ ${#_dr146_paths[@]} -gt 0 ]; then
  _wp08_root=$(pwd -P)
  for _wp08_f in "${_dr146_paths[@]}"; do
    case "$_wp08_f" in
      -*)
        _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"
        echo "✗ --files: path may not start with '-'" | tee "$_wp08_log"
        record_gate_result invocation playwright 2 0 "$_wp08_log"
        write_gate_report 2
        exit 2
        ;;
    esac
    case "$_wp08_f" in
      *..*)
        # A `..` segment is only a problem if it actually resolves OUTSIDE the repo root — a path
        # can legitimately contain `..` and still stay inside (e.g. `src/../src/lib/x.ts`).
        # Lexical resolution only (no filesystem I/O): the path need not exist yet.
        _wp08_resolved=$(python3 - "$_wp08_f" "$_wp08_root" <<'PY' 2>/dev/null
import os, sys
p, root = sys.argv[1:3]
ap = p if os.path.isabs(p) else os.path.join(root, p)
print(os.path.normpath(ap))
PY
) || _wp08_resolved=""
        case "$_wp08_resolved" in
          "$_wp08_root"|"$_wp08_root"/*) ;;
          *)
            _wp08_log="$GATE_FRAGMENTS_DIR/log-invocation.txt"
            echo "✗ --files: path escapes the repo: $_wp08_f" | tee "$_wp08_log"
            record_gate_result invocation playwright 2 0 "$_wp08_log"
            write_gate_report 2
            exit 2
            ;;
        esac
        ;;
    esac
  done
fi

# Runs one of the 9 CHEAP sub-gates. Without `--report-all`: aborts immediately on the first
# failure (byte-identical to the pre-WP-05 fail-fast behavior, just now also writing the report).
# With `--report-all`: keeps going so every cheap gate gets a chance to report its own failures;
# the caller aborts once, after all 9 have run, if any of them failed.
# WP-08: a gate `--only` did not name is skipped entirely — it contributes no fragment, so the report
# shows exactly what ran and nothing implies a gate passed when it never executed.
CHEAP_GATES_FAILED=0
LAST_CHEAP_RC=0
run_cheap_gate() {
  if ! gate_selected "$1"; then return 0; fi
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

# Admission and output normalization precede the start fingerprint and every gate.
if [ "$GATE_SCOPE" = "full" ] || [ "$DIAGNOSE_UNIT" -eq 1 ]; then
  _slot_rc=0
  HOST_SLOT_OWNED=$(host_slot acquire) || _slot_rc=$?
  if [ "$_slot_rc" -ne 0 ]; then write_gate_report "$_slot_rc"; exit "$_slot_rc"; fi
  [ -z "$HOST_SLOT_OWNED" ] || export PANDACORP_HOST_SLOT_TOKEN="$HOST_SLOT_OWNED"
  export PANDACORP_E2E_SNAPSHOTS=none
else
  export PANDACORP_E2E_SNAPSHOTS=missing
fi
if [ -f .pandacorp/green-stamp.sh ]; then
  _outputs_rc=0
  bash .pandacorp/green-stamp.sh clean-outputs || _outputs_rc=$?
  if [ "$_outputs_rc" -ne 0 ]; then write_gate_report "$_outputs_rc"; exit "$_outputs_rc"; fi
elif [ -e e2e/.run-outputs ] || [ -L e2e/.run-outputs ]; then
  dr146_invocation_error "e2e/.run-outputs requires green-stamp.sh for validated cleanup"
elif [ -d e2e/fixtures ]; then
  # Legacy overlays without the stamp helper still normalize empty fixture directories.
  find e2e/fixtures -depth -type d -empty -delete
fi
if [ "$GATE_SCOPE" = "full" ] && [ -f .pandacorp/green-stamp.sh ]; then
  STAMP_START_TREE=$(bash .pandacorp/green-stamp.sh start 2>/dev/null || true)
fi

# Type definitions are generated after cleanup/rebase, before any static checks (full or light).
gate_next_typegen() {
  if [ -x node_modules/.bin/next ] && [ ! -d .next/types ]; then
    node_modules/.bin/next typegen
  fi
}
_static_selected=0
for _static_gate in $KNOWN_GATES; do
  case "$_static_gate" in vitest|playwright) continue ;; esac
  if gate_selected "$_static_gate"; then _static_selected=1; break; fi
done
if [ "$_static_selected" -eq 1 ] && [ -x node_modules/.bin/next ] && [ ! -d .next/types ]; then
  _typegen_rc=0
  run_gate next-typegen plain gate_next_typegen || _typegen_rc=$?
  if [ "$_typegen_rc" -ne 0 ]; then
    if [ "$DIAGNOSE_UNIT" -eq 1 ]; then CHEAP_GATES_FAILED=1; LAST_CHEAP_RC="$_typegen_rc";
    else write_gate_report "$_typegen_rc"; exit "$_typegen_rc"; fi
  fi
fi

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

# --- Behavior-test hygiene (DR-144): heuristic warning, semantic review blocks ---
gate_live_data_asserts() {
  # Keep failures local to this advisory scanner; other gates remain fail-closed.
  if ! python3 - <<'PY'
import fnmatch, os, re
from pathlib import Path
patterns = os.environ.get('PANDACORP_CURATED_DATA_GLOBS', 'docs/**/*.json,content/**,prisma/seed*,**/*frozen*.json,**/*snapshot*.json').split(',')
excluded = {'node_modules', '.git', '.next', 'dist', 'coverage', '.pandacorp', '.claude'}
def incomplete(error):
    print(f'WARNING live-data-asserts: analysis incomplete: {error}')

for root, dirs, files in os.walk('.', onerror=incomplete):
    dirs[:] = [d for d in dirs if d not in excluded]
    for name in files:
        if not re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', name):
            continue
        path = Path(root) / name
        if 'src/test/' in path.as_posix():
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError) as error:
            incomplete(f'{path}: {error}')
            continue
        # Direct imports, require and readFile literals only; no claim of data-flow analysis.
        reads = re.findall(r'''(?:\bfrom\s*|\bimport\s*|\b(?:require|readFileSync|readFile)\s*\(\s*)['"]([^'"\n]+)['"]''', text)
        def curated(value):
            value = re.sub(r'^(?:\.\.?/)+', '', value)
            if value.startswith('src/test/'):
                return False
            return any(fnmatch.fnmatch(value, p.strip()) or fnmatch.fnmatch(value, p.strip().replace('**/', '')) for p in patterns if p.strip())
        if not any(curated(value) for value in reads):
            continue
        for assertion in re.finditer(r'\bexpect\s*\([\s\S]*?;', text):
            tail = text[assertion.end():].split('\n', 1)[0]
            lines = assertion.group().splitlines()
            if any(re.search(r'//\s*live-data-ok:\s*\S', line) for line in [*lines, tail]):
                continue
            # Ignore quoted strings/comments; numeric strings are not volume literals.
            code = re.sub(r'''(['"`])(?:\\.|(?!\1)[\s\S])*?\1|//[^\n]*|/\*[\s\S]*?\*/''', '', assertion.group())
            if any(int(n.replace('_', '')) >= 10 for n in re.findall(r'(?<![\w.])\d[\d_]*(?![\w.])', code)):
                line = text.count('\n', 0, assertion.start()) + 1
                print(f'{path}:{line}: WARNING live-data-asserts (DR-144): curated read + numeric assertion; use fixture/structural contracts or same-line // live-data-ok: <reason>')
PY
  then
    echo 'WARNING live-data-asserts: analysis incomplete: internal scanner failure; semantic review required'
  fi
  return 0
}
run_cheap_gate live-data-asserts pathlist gate_live_data_asserts


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
      if grep -Eq '^status:[[:space:]]*ACTIVE' <<<"$(head -n 25 "$f")"; then flagged="$flagged  $f"$'\n'; fi
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
# WP-08: `--files` narrows biome to exactly those paths (it is path-addressable and is the gate a
# mechanical repair agent re-runs most). Unscoped, the command line is byte-for-byte the old one.
if [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then
  run_cheap_gate biome biome pnpm biome check "${SCOPE_FILES_ARR[@]}" --error-on-warnings
else
  run_cheap_gate biome biome pnpm biome check . --error-on-warnings
fi

# --- Typing -------------------------------------------------------------------
run_cheap_gate tsc tsc pnpm tsc --noEmit

# --- Dead code (fail-closed) --------------------------------------------------
run_cheap_gate knip pathlist pnpm knip

# --- Circular dependencies (fail-closed) --------------------------------------
run_cheap_gate madge pathlist pnpm madge --circular --extensions ts,tsx src

# `--report-all`: all 9 cheap gates above have now run and reported independently — abort ONCE,
# here, with the aggregate verdict, instead of at the first one (vitest/Playwright never run on a
# cheap-gate red; there is nothing more the expensive layers would add to an already-red verdict).
if [ "$REPORT_ALL" -eq 1 ] && [ "$CHEAP_GATES_FAILED" -eq 1 ] && [ "$DIAGNOSE_UNIT" -ne 1 ]; then
  write_gate_report "$LAST_CHEAP_RC"
  exit "$LAST_CHEAP_RC"
fi

# Outcomes are observations, never retries or exclusions. JSON reporters are enabled only
# for queue gates and diagnosis; ordinary scoped command lines retain their existing shape.
LEDGER=0
[ "$DIAGNOSE_UNIT" -ne 1 ] && [ -z "${PANDACORP_QUEUE_ATTEMPT:-}" ] || LEDGER=1
VITEST_REPORTERS=(--reporter=dot)
PLAYWRIGHT_REPORTERS=()
if [ "$LEDGER" -eq 1 ]; then
  VITEST_REPORTERS+=(--reporter=json "--outputFile=$GATE_FRAGMENTS_DIR/vitest.json")
  PLAYWRIGHT_REPORTERS=(--reporter=line,json)
  export PLAYWRIGHT_JSON_OUTPUT_FILE="$GATE_FRAGMENTS_DIR/playwright.json"
fi
# A diagnosis often precedes its repair commit. Never attribute different physical
# source content to HEAD's tree and manufacture a flaky suspect from a deterministic fix.
OUTCOMES_TREE=""
if [ "$LEDGER" -eq 1 ]; then
OUTCOMES_TREE=$(python3 - <<'TREEPY'
import hashlib, os, pathlib, stat, subprocess
root = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
def git(*args): return subprocess.check_output(['git', '-C', str(root), *args])
head = git('rev-parse', 'HEAD^{tree}').strip().decode()
hidden = any(line[:1] == b'S' or line[:1].islower() for line in git('ls-files', '-v').splitlines())
if not git('status', '--porcelain') and not hidden:
    print(head)
else:
    digest = hashlib.sha256()
    names = sorted(set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0')) - {b''})
    for name in names:
        path = root / os.fsdecode(name)
        digest.update(name + b'\0')
        try:
            mode = path.lstat().st_mode
            digest.update(str(stat.S_IFMT(mode) | (mode & 0o111)).encode() + b'\0')
            if path.is_symlink(): digest.update(os.fsencode(os.readlink(path)))
            elif path.is_file():
                with path.open('rb') as f:
                    for chunk in iter(lambda: f.read(1024 * 1024), b''): digest.update(chunk)
            elif path.is_dir(): digest.update(git('ls-tree', 'HEAD', '--', os.fsdecode(name)))
        except FileNotFoundError: digest.update(b'deleted')
        digest.update(b'\0')
    print(digest.hexdigest())
TREEPY
) || { echo 'verify: cannot fingerprint diagnosis tree' >&2; exit 2; }
fi
append_test_outcomes() {
  [ "$LEDGER" -eq 1 ] || return 0
  python3 - "$1" "$GATE_FRAGMENTS_DIR/$1.json" "$OUTCOMES_TREE" "$VITEST_SEED" <<'OUTCOMESPY' || echo 'verify: WARNING test-outcomes ledger incomplete (reporter/append error)' >&2
import datetime, json, os, pathlib, subprocess, sys, uuid
runner, filename, tree, seed = sys.argv[1:]
def git(*args): return subprocess.check_output(['git', *args], text=True).strip()
prefix = git('rev-parse', '--show-prefix')
default = subprocess.run(['git', 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], capture_output=True, text=True).stdout.strip().removeprefix('origin/') or 'main'
lines = git('worktree', 'list', '--porcelain').splitlines()
main = None
for line in lines:
    if line.startswith('worktree '): checkout = line[9:]
    elif line == 'branch refs/heads/' + default: main = checkout
if main is None: raise ValueError('test outcomes require the main checkout')
project = str((pathlib.Path(main) / prefix).resolve())
report = json.loads(pathlib.Path(filename).read_text())
attempt = os.environ.get('PANDACORP_QUEUE_ATTEMPT') or str(uuid.uuid4())
rows = []
def add(test, status, worker, retry=0):
    if status not in ('passed', 'failed', 'skipped', 'pending', 'todo', 'disabled', 'timedOut', 'interrupted'): raise ValueError('unknown test status: ' + str(status))
    status = {'timedOut': 'failed', 'interrupted': 'failed', 'pending': 'skipped', 'todo': 'skipped', 'disabled': 'skipped'}.get(status, status)
    rows.append(dict(v=1, ts=datetime.datetime.now(datetime.timezone.utc).isoformat(), test_id=test, status=status,
                     tree=tree, seed=int(seed), worker=worker, project=project, attempt=attempt, runner=runner, retry=retry))
if runner == 'vitest':
    for suite in report['testResults']:
        file = suite['name']
        try: file = pathlib.Path(file).relative_to(pathlib.Path.cwd()).as_posix()
        except ValueError: pass
        for test in suite['assertionResults']:
            add(file + ' > ' + test['fullName'], test['status'], test.get('workerId'))
else:
    def visit(suite, parents):
        names = parents + ([suite['title']] if suite.get('title') else [])
        for spec in suite.get('specs', []):
            for test in spec['tests']:
                ident = spec['file'] + ' > ' + ' > '.join(names + [spec['title']]) + ' [' + test.get('projectName', '') + ']'
                for result in test['results']:
                    add(ident, result['status'], result.get('workerIndex'), result.get('retry', 0))
        for child in suite.get('suites', []): visit(child, names)
    for suite in report['suites']: visit(suite, [])
target = pathlib.Path(project) / '.pandacorp/run/test-outcomes.jsonl'
target.parent.mkdir(parents=True, exist_ok=True)
fd = os.open(target, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
try:
    for row in rows:
        data = (json.dumps(row, ensure_ascii=True, separators=(',', ':')) + '\n').encode()
        if os.write(fd, data) != len(data): raise OSError('short ledger append')
finally: os.close(fd)
OUTCOMESPY
}

# --- Behavior -----------------------------------------------------------------
# shellcheck disable=SC2086
# `|| VITEST_RC=$?` (not a bare call + `$?` on the next line): under `set -e` a plain non-zero
# command exits the script IMMEDIATELY, before a following `VITEST_RC=$?` would ever run — that
# would skip write_gate_report entirely on a vitest failure. The `||` keeps this on the safe side
# of errexit (same reasoning as run_gate's own PIPESTATUS capture just above).
#
# WP-08 `--files`: switch to `vitest related <paths>` — the tests those source files actually affect.
# VERIFIED against mission-control's installed vitest 4.1.9: `vitest run --related <files>` is NOT a
# valid option there (CACError: Unknown option `--related`); the supported spelling is the `related`
# SUBCOMMAND, which narrowed 435 discovered test files to the 4 that import src/lib/slug.ts.
# `--passWithNoTests` is deliberate: a file with no related test must not red a SCOPED run (it is not
# a failure signal, and the scoped run's `partial` report can never certify anything on its own — the
# whole-project re-gate remains the only oracle that certifies).
#
# DR-146 `--tests`: exactly the named test files (`vitest run <files>`), never a module-graph guess
# (`related` transforms the whole graph and widens to every spec when a config/package.json is
# named). The shuffled order + explicit seed apply to every vitest mode.
if gate_selected vitest; then
VITEST_RC=0
VITEST_SEED_USED="$VITEST_SEED"
VITEST_ORDER=("--bail=$(( (1 - NO_BAIL) * (1 - DIAGNOSE_UNIT) ))" --sequence.shuffle "--sequence.seed=$VITEST_SEED")
echo "vitest order: shuffled with seed $VITEST_SEED — replay this exact order: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh $* (vitest alone: PANDACORP_VITEST_SEED=$VITEST_SEED bash .pandacorp/verify.sh --only=vitest)"
if [ "${#SCOPE_TESTS_ARR[@]}" -gt 0 ]; then
  run_gate vitest vitest pnpm vitest run "${SCOPE_TESTS_ARR[@]}" "${VITEST_REPORTERS[@]}" --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?
elif [ "${#SCOPE_FILES_ARR[@]}" -gt 0 ]; then
  run_gate vitest vitest pnpm vitest related "${SCOPE_FILES_ARR[@]}" --run "${VITEST_REPORTERS[@]}" --passWithNoTests "${VITEST_ORDER[@]}" || VITEST_RC=$?
else
  run_gate vitest vitest pnpm vitest run "${VITEST_REPORTERS[@]}" ${SINCE:+--changed "$SINCE"} "${VITEST_ORDER[@]}" || VITEST_RC=$?
fi
append_test_outcomes vitest
if [ "$VITEST_RC" -ne 0 ]; then
  write_gate_report "$VITEST_RC"
  exit "$VITEST_RC"
fi
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
  # DR-143: a project's e2e/parallel-safe.json splits one FULL invocation into ordered projects (one server boot):
  # the listed specs on several workers, then desktop and mobile serially. No file, same single run.
  # A project's e2e/prod-server.mjs serves the FULL run from one production build instead of next dev.
  if [ -z "$SINCE" ] && [ -f e2e/prod-server.mjs ]; then
    node e2e/prod-server.mjs build || return $?
    export PANDACORP_E2E_SERVER=prod
    # Ephemeral slot ports avoid adjacent worktree/lane ports. Hold all probes until selected;
    # actual servers still fail closed if another process wins the interval after release.
    if [ -f e2e/isolated-specs.json ]; then
      PANDACORP_E2E_SLOT_PORTS="$(node --input-type=module <<'SLOTPORTS'
import fs from 'node:fs';
import net from 'node:net';
const inventory = JSON.parse(fs.readFileSync('e2e/isolated-specs.json', 'utf8'));
if (Object.keys(inventory).length) {
  const count = process.env.PANDACORP_VERIFY_NO_BAIL === '1' ? 1 : Number(process.env.PANDACORP_E2E_WORKERS || 3);
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid slot worker count');
  const reserved = new Set([Number(process.env.PORT)]);
  if (fs.existsSync('e2e/server-env.json')) reserved.add(Number(JSON.parse(fs.readFileSync('e2e/server-env.json', 'utf8')).PORT));
  if (fs.existsSync('.pandacorp/run/e2e-port')) reserved.add(Number(fs.readFileSync('.pandacorp/run/e2e-port', 'utf8').trim()));
  if (fs.existsSync('.pandacorp/run/lane.env')) {
    const lane = fs.readFileSync('.pandacorp/run/lane.env', 'utf8').match(/^(?:export\s+)?PORT=(\d+)$/m);
    if (lane) reserved.add(Number(lane[1]));
  }
  const servers = [], ports = [];
  try {
    while (ports.length < count) {
      const server = net.createServer();
      servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const port = server.address().port;
      if (!reserved.has(port)) ports.push(port);
    }
    console.log(ports.join(','));
  } finally { await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))); }
}
SLOTPORTS
)" || return $?
      export PANDACORP_E2E_SLOT_PORTS
    fi
  fi
  if [ -n "$SINCE" ]; then
    pnpm exec playwright test ${PLAYWRIGHT_REPORTERS[@]+"${PLAYWRIGHT_REPORTERS[@]}"} e2e/smoke.spec.ts e2e/shell.spec.ts
  elif [ -f e2e/parallel-safe.json ] || [ -f e2e/isolated-specs.json ]; then
    PANDACORP_E2E_TIER=combined pnpm exec playwright test ${PLAYWRIGHT_REPORTERS[@]+"${PLAYWRIGHT_REPORTERS[@]}"} e2e/
  else
    pnpm exec playwright test ${PLAYWRIGHT_REPORTERS[@]+"${PLAYWRIGHT_REPORTERS[@]}"} e2e/
  fi
}
# Same `set -e` hazard as vitest above: `|| PLAYWRIGHT_RC=$?`, not a bare call.
# WP-08: the browser layer is NOT file-scopable (`--files` does not touch it) — it is only ever
# skipped wholesale by an `--only` that does not name it.
if gate_selected playwright && [ "$AFFECTED_SKIP" -eq 0 ]; then
PLAYWRIGHT_RC=0
run_gate playwright playwright gate_playwright || PLAYWRIGHT_RC=$?
append_test_outcomes playwright
if [ "$PLAYWRIGHT_RC" -ne 0 ]; then
  if [ "$GATE_SCOPE" = "full" ] && grep -Eiq "(snapshot.*(doesn't exist|does not exist|missing)|missing.*snapshot|no snapshot)" "$GATE_FRAGMENTS_DIR/log-playwright.txt"; then
    echo "baseline not blessed — bless it at the feature gate (DR-080), commit it, re-queue"
  fi
  write_gate_report "$PLAYWRIGHT_RC"
  exit "$PLAYWRIGHT_RC"
fi
fi

# --- Bless-provenance advisory (DR-080) — non-blocking -------------------------
# A blessed visual baseline with no recorded ORACLE (the prototype path/shard + sign-off + a
# `prototype_blessed_at` SHA in the FRD's fdd.md) is a self-reference — the trap that let a menu-less
# baseline ship green (E6). ADVISORY: it warns, never fails (so it can't red-lock baselines blessed
# before this rule). The deterministic block is the reviewer's bless step (DR-080) + the gate canary.
if ls e2e/visual.spec.ts-snapshots/*.png >/dev/null 2>&1 && ! grep -rqs "prototype_blessed_at" docs/frds 2>/dev/null; then
  echo "⚠ DR-080: blessed visual baselines exist but no fdd.md records a 'prototype_blessed_at' provenance line — the baseline's independent oracle is unrecorded (advisory)."
fi

# DR-140: opt-in DB postcondition after selected test suites; DB-free projects need no script.
if { gate_selected vitest || gate_selected playwright; } &&
   node -e 'const script = require("./package.json").scripts?.["db:test:check-clean"]; process.exit(typeof script === "string" && script.trim() ? 0 : 1)'; then
  DB_CLEAN_RC=0
  run_gate database-clean plain pnpm db:test:check-clean || DB_CLEAN_RC=$?
  if [ "$DB_CLEAN_RC" -ne 0 ]; then
    write_gate_report "$DB_CLEAN_RC"
    exit "$DB_CLEAN_RC"
  fi
fi

if [ "$DIAGNOSE_UNIT" -eq 1 ] && [ "$CHEAP_GATES_FAILED" -eq 1 ]; then
  write_gate_report "$LAST_CHEAP_RC"
  exit "$LAST_CHEAP_RC"
fi
write_gate_report 0
exit 0
