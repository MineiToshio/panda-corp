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
set -uo pipefail

STAMP=".pandacorp/run/green-stamp"
MAX_AGE_S=43200
VERSION=3

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
# One parser owns both cleanup and hashing: an invalid declaration can never silently weaken proof.
input_groups() {
  python3 - "${1:-hash}" <<'INPUTPY'
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

manifest = Path('e2e/.run-outputs')
outputs = []
if manifest.is_symlink():
    raise ValueError('invalid e2e/.run-outputs: symlink')
if manifest.exists():
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0'))
    if str(manifest) not in tracked or subprocess.call(
            ['git', 'diff', '--quiet', 'HEAD', '--', str(manifest)]) != 0:
        raise ValueError('e2e/.run-outputs must be committed and unchanged')
    for line in manifest.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        directory = line.endswith('/')
        name = line[:-1] if directory else line
        parts = name.split('/')
        if (not name.startswith('e2e/') or len(parts) < 2
                or any(x in ('', '.', '..') for x in parts)
                or re.search(r'[\x00-\x1f\x7f*?\[\]{}\\]', name)
                or name == str(manifest)):
            raise ValueError('invalid e2e/.run-outputs path')
        path = Path(name)
        if any(x.is_symlink() for x in (path, *path.parents)):
            raise ValueError('invalid e2e/.run-outputs: symlink path')
        if any(x == name or x.startswith(name + '/') for x in tracked):
            raise ValueError('invalid e2e/.run-outputs: tracked input')
        if path.exists() and path.is_dir() != directory:
            raise ValueError('invalid e2e/.run-outputs: wrong path type')
        outputs.append((name, directory))

def excluded(path):
    name = str(path)
    return any(name == item or (directory and name.startswith(item + '/'))
               for item, directory in outputs)

if sys.argv[1] == 'clean':
    for name, directory in outputs:
        path = Path(name)
        if directory and path.exists():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()
    fixtures = Path('e2e/fixtures')
    if fixtures.exists() and not fixtures.is_symlink():
        for base, dirs, files in os.walk(fixtures, topdown=False, followlinks=False):
            path = Path(base)
            if not path.is_symlink() and not any(path.iterdir()):
                path.rmdir()
    sys.exit(0)

# Empty fixture directories are normalized at both ends: tests can recreate them after cleanup.
# Keep every nonempty directory label, symlink and unlisted file in the fingerprint.
def add(h, path):
    if excluded(path):
        return False
    if path.is_dir() and not path.is_symlink():
        children = hashlib.sha256()
        present = [add(children, child) for child in sorted(path.iterdir())]
        if (str(path) == 'e2e/fixtures' or str(path).startswith('e2e/fixtures/')) and not any(present):
            return False
        h.update(str(path).encode() + b'\0dir:' + children.digest() + b'\0')
        return True
    h.update(str(path).encode() + b'\0')
    if path.is_symlink():
        h.update(b'link:' + os.readlink(path).encode())
        target = path.resolve(strict=True)
        # Preserve physical ignored symlink inputs without recursing through a cycle.
        if target.is_dir():
            add(h, target)
        else:
            h.update(target.read_bytes())
    elif path.is_file():
        h.update(path.read_bytes())
    elif not path.exists():
        h.update(b'missing')
    else:
        raise ValueError('unhashable input')
    h.update(b'\0')
    return True

groups = {}
def group(name, paths):
    h = hashlib.sha256()
    for path in sorted(set(map(Path, paths))):
        add(h, path)
    groups[name] = h.hexdigest()
group('verify', ['.pandacorp/verify.sh', '.pandacorp/green-stamp.sh', '.pandacorp/vitest-policy.ts'])
group('dependencies', ['node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml',
                       'node_modules/.package-lock.json', 'package.json', *Path('.').glob('*lock*')])
group('e2e', ['e2e', 'playwright.config.ts', '.pandacorp/run/lane.env', *Path('.').glob('.env*')])
groups['node'] = hashlib.sha256(subprocess.check_output(['node', '--version'])).hexdigest()
controls = {
    'PANDACORP_VERIFY_OWNER_PID', 'PANDACORP_STAMP_CHECK_PID', 'PANDACORP_VITEST_SEED',
    'PANDACORP_VERIFY_NO_BAIL', 'PANDACORP_E2E_SERVER', 'PANDACORP_E2E_TIER',
    'PANDACORP_E2E_WORKERS', 'PANDACORP_E2E_CERTIFICATION', 'PANDACORP_STOP_GATE',
    'PANDACORP_EVENTS_LOG', 'PANDACORP_OWNER_RELEASE_OK',
    'TMPDIR', 'npm_config_cache', 'PANDACORP_CLEANUP_SESSION', 'PANDACORP_SESSION_TEMP_BASE',
    'PANDACORP_HOST_SLOT_TOKEN', 'PANDACORP_STAMP_BASE', 'PANDACORP_E2E_SNAPSHOTS',
    '_', 'SHLVL', 'PWD', 'OLDPWD', 'PS1', 'PS2', 'TERM', 'COLUMNS', 'LINES',
}
for key, value in sorted(os.environ.items()):
    if key not in controls:
        # Names are public diagnostics; values never leave this process except as SHA-256.
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            raise ValueError('unsupported environment variable name')
        groups['env_' + key] = hashlib.sha256(value.encode()).hexdigest()
body = ''.join(f'{key}={value}\n' for key, value in sorted(groups.items()))
print('inputs_sha256=' + hashlib.sha256(body.encode()).hexdigest())
print(body, end='')
INPUTPY
}
inputs_sha256() { input_groups | sed -n 's/^inputs_sha256=//p'; }

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
    groups=$(input_groups) || doubt "cannot fingerprint inputs"
    inputs=$(printf '%s\n' "$groups" | sed -n 's/^inputs_sha256=//p')
    [ "$inputs" = "$start_inputs" ] || doubt "inputs changed during the run — nothing certified"
    vsum=$(verify_sha256) || doubt "cannot hash .pandacorp/verify.sh — nothing certified"
    mkdir -p "$(dirname "$STAMP")" || doubt "cannot create $(dirname "$STAMP")"
    tmp=$(mktemp "$STAMP.XXXXXX") || doubt "cannot write $STAMP"
    base="${PANDACORP_STAMP_BASE:-}"
    case "$base" in *[!0-9a-f]*) doubt "invalid stamp base" ;; esac
    { printf 'version=%s\ntree=%s\nverify_sha256=%s\nbase=%s\nat_epoch=%s\n' "$VERSION" "$tree" "$vsum" "$base" "$(date +%s)"; printf '%s\n' "$groups"; } > "$tmp" \
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
    groups=$(input_groups) || doubt "cannot fingerprint inputs"
    inputs=$(printf '%s\n' "$groups" | sed -n 's/^inputs_sha256=//p')
    if [ "$inputs" != "$(stamp_field inputs_sha256)" ]; then
      if [ "${2:-}" = "--explain" ]; then
        python3 - "$STAMP" "$groups" <<'EXPLAINPY'
from pathlib import Path
import sys
def parse(text):
    return dict(line.split('=', 1) for line in text.splitlines() if '=' in line)
before, after = parse(Path(sys.argv[1]).read_text()), parse(sys.argv[2])
keys = set(after) | {key for key in before if key.startswith('env_')}
for key in sorted(keys - {'inputs_sha256'}):
    if before.get(key) != after.get(key):
        label = 'environment variable ' + key[4:] if key.startswith('env_') else key + ' group'
        print('green-stamp: differs: ' + label, file=sys.stderr)
EXPLAINPY
      fi
      doubt "environment/dependencies/e2e fixtures changed"
    fi
    age=$(( $(date +%s) - s_at ))
    [ "$age" -ge 0 ] && [ "$age" -le "$MAX_AGE_S" ] || doubt "stamp is ${age}s old (max ${MAX_AGE_S}s)"
    echo "certified tree $s_tree, ${age}s old"
    ;;
  clean-outputs)
    input_groups clean || doubt "cannot clean declared run outputs"
    ;;
  invalidate)
    rm -f "$STAMP"
    ;;
  *)
    echo "usage: green-stamp.sh start | record <tree:inputs_sha256> | check [--explain] | clean-outputs | invalidate" >&2
    exit 2
    ;;
esac
