#!/usr/bin/env bash
# Certified-tree stamp (DR-146) — the ONE writer and the ONE reader of "this exact tree already
# passed the FULL gate". Run from the project directory (where .pandacorp/verify.sh lives).
#
#   green-stamp.sh start          prints the current tree + input fingerprint iff it is clean (verify.sh, at its start).
#   green-stamp.sh record <tree:inputs_sha256>  called ONLY by verify.sh, after a FULL (unscoped) run exits 0,
#                                 with the tree it saw clean at its start. Writes nothing unless the
#                                 tree is still that tree and still clean now.
#   green-stamp.sh check          exit 0 only when the current tree is provably the certified one;
#                                 exit 1 (reason on stderr) on ANY doubt.
#   green-stamp.sh invalidate     drop the stamp (verify.sh calls it on every red exit).
#
# "Clean" = `git status --porcelain` empty (tracked AND untracked non-ignored files) AND no
# skip-worktree/assume-unchanged index entries (both hide local edits from status — e.g. a
# worktree-bootstrap port override — so a tree carrying them never certifies and never matches).
# The stamp binds: the tree hash, the sha256 of .pandacorp/verify.sh (a gate edit invalidates it,
# even for an untracked/ignored verify.sh) and its age (12 h max, so a toolchain/env drift cannot
# ride a stamp forever). It lives in gitignored runtime state; a missing, corrupt or foreign-format
# stamp is simply "not certified" — the caller then runs the full gate.
set -u

STAMP=".pandacorp/run/green-stamp"
MAX_AGE_S=43200
VERSION=2

doubt() { echo "green-stamp: $1" >&2; exit 1; }

verify_sha256() {
  [ -f .pandacorp/verify.sh ] || return 1
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 .pandacorp/verify.sh | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum .pandacorp/verify.sh | awk '{print $1}'
  else
    return 1
  fi
}

# Ignored inputs are outside HEAD's tree. Hash values privately, never print env/fixture contents.
# Dependency installation metadata binds the installed graph (not arbitrary node_modules edits).
inputs_sha256() {
  python3 - <<'INPUTPY'
import hashlib
import os
from pathlib import Path
import subprocess

h = hashlib.sha256()
def add(path):
    label = str(path)
    h.update(label.encode() + b'\0')
    if path.is_symlink():
        h.update(b'link:' + os.readlink(path).encode())
        path = path.resolve(strict=True)
    if path.is_dir():
        for child in sorted(path.iterdir()):
            add(child)
    elif path.is_file():
        h.update(path.read_bytes())
    elif not path.exists():
        h.update(b'missing')
    else:
        raise ValueError('unhashable input')
    h.update(b'\0')
for path in sorted(set([Path('.pandacorp/verify.sh'), Path('.pandacorp/green-stamp.sh'),
                       Path('.pandacorp/run/lane.env'),
                       Path('node_modules/.modules.yaml'), Path('node_modules/.pnpm/lock.yaml'),
                       Path('node_modules/.package-lock.json'), Path('e2e'),
                       Path('playwright.config.ts'), Path('package.json'),
                       *Path('.').glob('*lock*'), *Path('.').glob('.env*')])):
    add(path)
h.update(subprocess.check_output(['node', '--version']))
# User-provided environment can alter builds and fixtures too. Exclude per-invocation runtime
# controls and shell bookkeeping, whose values legitimately change between gate and consumer.
controls = {
    'PANDACORP_VERIFY_OWNER_PID', 'PANDACORP_STAMP_CHECK_PID', 'PANDACORP_VITEST_SEED',
    'PANDACORP_VERIFY_NO_BAIL', 'PANDACORP_E2E_SERVER', 'PANDACORP_E2E_TIER',
    'PANDACORP_E2E_WORKERS', 'PANDACORP_E2E_CERTIFICATION', 'PANDACORP_STOP_GATE',
    'PANDACORP_EVENTS_LOG', 'PANDACORP_OWNER_RELEASE_OK',
    # Shell bookkeeping/terminal presentation, never product/test configuration.
    '_', 'SHLVL', 'PWD', 'OLDPWD', 'PS1', 'PS2', 'TERM', 'COLUMNS', 'LINES',
}
for key, value in sorted(os.environ.items()):
    # Hash ALL ambient inputs, including unknown future product variables. A name-prefix
    # allowlist cannot know MC_CLOCK / MC_GIT_FIXTURE / NAVIGATION_TEST_FACTORY_ROOT.
    if key not in controls:
        h.update(key.encode() + b'=' + value.encode() + b'\0')
print(h.hexdigest())
INPUTPY
}

current_tree() { git rev-parse --verify -q 'HEAD^{tree}' 2>/dev/null; }

# Prints nothing and returns 0 only when the working tree is clean in the strict sense above.
tree_is_clean() {
  local status hidden
  status=$(git status --porcelain --untracked-files=normal 2>/dev/null) || return 1
  [ -z "$status" ] || return 1
  hidden=$(git -C "$(git rev-parse --show-toplevel)" ls-files -v 2>/dev/null | grep -E '^(S|[a-z]) ' | head -1) || true
  [ -z "$hidden" ]
}

stamp_field() { grep -E "^$1=" "$STAMP" 2>/dev/null | head -1 | cut -d= -f2-; }

case "${1:-}" in
  start)
    # verify.sh asks this BEFORE its first gate: the tree it is about to judge, or nothing.
    tree_is_clean || doubt "working tree not clean — this run cannot certify a tree"
    tree=$(current_tree) || doubt "not a git checkout"
    inputs=$(inputs_sha256) || doubt "cannot fingerprint inputs"
    printf '%s:%s\n' "$tree" "$inputs"
    ;;
  record)
    token="${2:-}"
    tree="${token%%:*}"
    start_inputs="${token#*:}"
    [ "$start_inputs" != "$token" ] || doubt "record needs the start input fingerprint"
    [ -n "$tree" ] || doubt "record needs the tree verify.sh saw at its start"
    now_tree=$(current_tree) || doubt "not a git checkout"
    [ "$now_tree" = "$tree" ] || doubt "tree changed during the run — nothing certified"
    tree_is_clean || doubt "working tree not clean — nothing certified"
    inputs=$(inputs_sha256) || doubt "cannot fingerprint inputs"
    [ "$inputs" = "$start_inputs" ] || doubt "inputs changed during the run — nothing certified"
    vsum=$(verify_sha256) || doubt "cannot hash .pandacorp/verify.sh — nothing certified"
    mkdir -p "$(dirname "$STAMP")" || doubt "cannot create $(dirname "$STAMP")"
    tmp=$(mktemp "$STAMP.XXXXXX") || doubt "cannot write $STAMP"
    printf 'version=%s\ntree=%s\nverify_sha256=%s\ninputs_sha256=%s\nat_epoch=%s\n' "$VERSION" "$tree" "$vsum" "$inputs" "$(date +%s)" > "$tmp" \
      && mv "$tmp" "$STAMP" || { rm -f "$tmp"; doubt "cannot write $STAMP"; }
    echo "green-stamp: certified tree $tree (full verify.sh green on a clean tree)"
    ;;
  check)
    [ -f "$STAMP" ] || doubt "no certified-tree stamp"
    # Readers may reuse evidence only while no writer is changing its report/build/fixtures.
    # Hold a shared kernel lock through all comparisons, then release on exit.
    if [ "${PANDACORP_STAMP_CHECK_PID:-}" != "$$" ]; then
      exec python3 - "$0" "$@" <<'CHECKPY'
import fcntl
import os
import sys

lock = os.open('.pandacorp/run/verify.lock', os.O_RDWR | os.O_CREAT, 0o600)
try:
    fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
except BlockingIOError:
    print('green-stamp: verification owner active; no certificate reuse', file=sys.stderr)
    sys.exit(1)
os.dup2(lock, 8, inheritable=True)
if lock != 8:
    os.close(lock)
os.environ['PANDACORP_STAMP_CHECK_PID'] = str(os.getpid())
os.execvp('bash', ['bash', *sys.argv[1:]])
CHECKPY
    fi
    [ "$(stamp_field version)" = "$VERSION" ] || doubt "stamp format unknown or corrupt"
    s_tree=$(stamp_field tree); s_vsum=$(stamp_field verify_sha256); s_at=$(stamp_field at_epoch)
    case "$s_tree" in ''|*[!0-9a-f]*) doubt "stamp tree missing or corrupt" ;; esac
    case "$s_vsum" in ''|*[!0-9a-f]*) doubt "stamp verify.sh hash missing or corrupt" ;; esac
    case "$s_at" in ''|*[!0-9]*) doubt "stamp time missing or corrupt" ;; esac
    now_tree=$(current_tree) || doubt "not a git checkout"
    [ "$now_tree" = "$s_tree" ] || doubt "tree $now_tree is not the certified tree $s_tree"
    tree_is_clean || doubt "working tree not clean"
    vsum=$(verify_sha256) || doubt "cannot hash .pandacorp/verify.sh"
    [ "$vsum" = "$s_vsum" ] || doubt ".pandacorp/verify.sh changed since the certifying run"
    inputs=$(inputs_sha256) || doubt "cannot fingerprint inputs"
    [ "$inputs" = "$(stamp_field inputs_sha256)" ] || doubt "environment/dependencies/e2e fixtures changed"
    age=$(( $(date +%s) - s_at ))
    [ "$age" -ge 0 ] && [ "$age" -le "$MAX_AGE_S" ] || doubt "stamp is ${age}s old (max ${MAX_AGE_S}s)"
    echo "certified tree $s_tree, ${age}s old"
    ;;
  invalidate)
    rm -f "$STAMP"
    ;;
  *)
    echo "usage: green-stamp.sh start | record <tree:inputs_sha256> | check | invalidate" >&2
    exit 2
    ;;
esac
