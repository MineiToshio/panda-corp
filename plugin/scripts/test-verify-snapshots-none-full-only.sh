#!/bin/bash
# Full verification freezes baselines; feature gates can create them. Typegen precedes static tools.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FX=$(mktemp -d "${TMPDIR:-/tmp}/verify-snapshots.XXXXXX")
trap 'rm -rf "$FX"' EXIT
python3 - "$ROOT" "$FX" <<'PY'
import os
from pathlib import Path
import shutil
import subprocess
import sys
root, fx = map(Path, sys.argv[1:])
(fx / '.pandacorp').mkdir()
(fx / 'bin').mkdir()
(fx / 'e2e').mkdir()
(fx / 'src').mkdir()
(fx / 'node_modules/.bin').mkdir(parents=True)
(fx / 'package.json').write_text('{}')
for name in ['smoke', 'shell', 'visual', 'responsive', 'headers']:
    (fx / ('e2e/' + name + '.spec.ts')).touch()
(fx / 'playwright.config.ts').touch()
shutil.copy(root / 'plugin/templates/stack-a-nextjs/verify.sh', fx / '.pandacorp/verify.sh')
pnpm = fx / 'bin/pnpm'
pnpm.write_text('''#!/bin/bash
printf '%s:%s\\n' "$1" "$PANDACORP_E2E_SNAPSHOTS" >> calls
if [ "$1 $2" = "exec playwright" ] && [ "${TEST_MISSING_BASELINE:-0}" = 1 ]; then
  echo "Error: A snapshot doesn't exist at baseline.png."
  exit 1
fi
exit 0
''')
pnpm.chmod(0o755)
next = fx / 'node_modules/.bin/next'
next.write_text('''#!/bin/bash
[ "$1" = typegen ] || exit 9
printf 'typegen\\n' >> calls
[ "${TEST_TYPEGEN_FAIL:-0}" != 1 ] || exit 8
mkdir -p .next/types
''')
next.chmod(0o755)
env = dict(os.environ, PATH=str(fx / 'bin') + ':' + os.environ['PATH'],
           PANDACORP_HOST_DIR=str(fx / 'host'), PANDACORP_E2E_SNAPSHOTS='none')
def run(args, **extra):
    return subprocess.run(['bash', '.pandacorp/verify.sh', *args], cwd=fx, env=dict(env, **extra),
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
for args, expected in [([], 'none'), (['--light'], 'missing'), (['--since', 'HEAD'], 'missing')]:
    shutil.rmtree(fx / '.next', ignore_errors=True)
    (fx / 'calls').unlink(missing_ok=True)
    result = run(args)
    assert result.returncode == 0, result.stdout
    lines = (fx / 'calls').read_text().splitlines()
    assert lines[0] == 'typegen', lines
    assert all(line.endswith(':' + expected) for line in lines[1:]), lines
    assert not list((fx / 'host/h-slots').glob('slot-*')), 'ad-hoc full slot leaked'
shutil.rmtree(fx / '.next')
(fx / 'calls').unlink()
result = run(['--only=vitest'])
assert result.returncode == 0 and 'typegen' not in (fx / 'calls').read_text(), result.stdout
result = run([], TEST_MISSING_BASELINE='1')
assert result.returncode != 0 and 'baseline not blessed — bless it at the feature gate (DR-080), commit it, re-queue' in result.stdout, result.stdout
shutil.rmtree(fx / '.next')
(fx / 'calls').unlink()
result = run(['--light'], TEST_TYPEGEN_FAIL='1')
assert result.returncode == 8, result.stdout
assert (fx / 'calls').read_text() == 'typegen\n', 'static gate ran after typegen red'
config = (root / 'plugin/templates/stack-a-nextjs/e2e/playwright.config.ts').read_text()
assert 'updateSnapshots: process.env.PANDACORP_E2E_SNAPSHOTS === "none" ? "none" : "missing"' in config
print('RESULT: 7 passed, 0 failed')
PY
