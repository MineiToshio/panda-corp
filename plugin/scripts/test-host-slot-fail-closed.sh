#!/bin/bash
# Unusable host directories RED before any tool; inherited tokens consume/release no extra slot.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FX=$(mktemp -d "${TMPDIR:-/tmp}/host-slot.XXXXXX")
trap 'rm -rf "$FX"' EXIT
python3 - "$ROOT" "$FX" <<'PY'
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
root, fx = map(Path, sys.argv[1:])
(fx / '.pandacorp').mkdir()
(fx / 'bin').mkdir()
(fx / 'e2e').mkdir()
(fx / 'package.json').write_text('{}')
(fx / 'playwright.config.ts').touch()
for name in ['smoke', 'shell', 'visual', 'responsive', 'headers']:
    (fx / ('e2e/' + name + '.spec.ts')).touch()
shutil.copy(root / 'plugin/templates/stack-a-nextjs/verify.sh', fx / '.pandacorp/verify.sh')
pnpm = fx / 'bin/pnpm'
pnpm.write_text('''#!/bin/bash
printf 'gate\\n' >> calls
python3 - <<'SLOTS'
import json, os
from pathlib import Path
slots = list((Path(os.environ['PANDACORP_HOST_DIR']) / 'h-slots').glob('slot-*'))
expected = int(os.environ.get('TEST_EXPECT_SLOTS', '1'))
assert len(slots) == expected, slots
name, token = os.environ['PANDACORP_HOST_SLOT_TOKEN'].rsplit('|', 1)
owner = json.loads((Path(name) / 'owner.json').read_text())
assert owner['token'] == token and type(owner['pid']) is int and owner['kind'] in ('verify', 'merge-queue')
assert set(owner) == {'pid', 'kind', 'project', 'at', 'token'}
SLOTS
''')
pnpm.chmod(0o755)
host = fx / 'host'
env = dict(os.environ, PATH=str(fx / 'bin') + ':' + os.environ['PATH'],
           PANDACORP_HOST_DIR=str(host), PANDACORP_HOST_SLOT_WAIT_S='0')
def run(**extra):
    return subprocess.run(['bash', '.pandacorp/verify.sh'], cwd=fx, env=dict(env, **extra),
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=20)
host.write_text('unusable')
result = run()
assert result.returncode == 16 and 'environment not ready: host slot' in result.stdout, result.stdout
assert not (fx / 'calls').exists()
host.unlink()
slots = host / 'h-slots'
slots.mkdir(parents=True)
maximum = max(1, min(2, (os.cpu_count() or 1) // 4))
for index in range(maximum):
    slot = slots / ('slot-' + str(index))
    slot.mkdir()
    (slot / 'owner.json').write_text(json.dumps(dict(pid=os.getpid(), kind='merge-queue', project=str(fx), at='now', token='owner-token-' + str(index))))
slot = slots / 'slot-0'
result = run(PANDACORP_HOST_SLOT_TOKEN=str(slot) + '|owner-token-0', TEST_EXPECT_SLOTS=str(maximum))
assert result.returncode == 0, result.stdout
assert len(list(slots.glob('slot-*'))) == maximum, 'inherited slot released'
(fx / 'calls').unlink()
# Inheritance must wait through mutex contention using the full admission budget,
# rather than fail after the mutex's default one-second acquisition attempt.
guard = slots / '.admission.lock'
guard.mkdir()
guard_owner = guard / ('owner-' + str(os.getpid()) + '-contention.json')
guard_owner.write_text('{}')
def release_guard():
    guard_owner.unlink()
    guard.rmdir()
timer = threading.Timer(2, release_guard)
timer.start()
try:
    result = run(PANDACORP_HOST_SLOT_TOKEN=str(slot) + '|owner-token-0',
                 PANDACORP_HOST_SLOT_WAIT_S='600', TEST_EXPECT_SLOTS=str(maximum))
finally:
    timer.join()
assert result.returncode == 0, 'inherited admission failed before its deadline: ' + result.stdout
assert (slot / 'owner.json').exists(), 'inherited slot released after contention'
(fx / 'calls').unlink()
guard.mkdir()
guard_owner.write_text('{}')
try:
    started = time.monotonic()
    result = run(PANDACORP_HOST_SLOT_TOKEN=str(slot) + '|owner-token-0', PANDACORP_HOST_SLOT_WAIT_S='.05')
    assert result.returncode == 16 and 'environment not ready: host slot' in result.stdout, result.stdout
    assert time.monotonic() - started < 1, 'mutex wait exceeded the admission deadline'
    assert not (fx / 'calls').exists(), 'gate ran after admission expired'
finally:
    release_guard()
result = run(PANDACORP_HOST_SLOT_TOKEN=str(slot) + '|wrong-token')
assert result.returncode == 16 and 'position ' in result.stdout, result.stdout
assert not (fx / 'calls').exists()
# A token for another root must not bypass this host's shared admission mutex.
foreign = fx / 'foreign/h-slots/slot-0'
foreign.mkdir(parents=True)
(foreign / 'owner.json').write_text(json.dumps(dict(pid=os.getpid(), kind='g2', project=str(fx), at='now', token='foreign')))
result = run(PANDACORP_HOST_SLOT_TOKEN=str(foreign) + '|foreign')
assert result.returncode == 16 and 'root mismatch' in result.stdout, result.stdout
assert not (fx / 'calls').exists()
assert (foreign / 'owner.json').exists()
# Ownerless recent slots must not be reclaimed; dead owners and old ownerless slots must be.
for file in slots.glob('slot-*/owner.json'):
    file.unlink()
result = run()
assert result.returncode == 16, result.stdout
for slot in slots.glob('slot-*'):
    os.utime(slot, (time.time() - 120, time.time() - 120))
# Keep other slots live so the tool oracle sees exactly the cap's slots.
for index in range(1, maximum):
    (slots / ('slot-' + str(index)) / 'owner.json').write_text(json.dumps(dict(pid=os.getpid(), kind='merge-queue', project=str(fx), at='now', token='live')))
result = run(TEST_EXPECT_SLOTS=str(maximum))
assert result.returncode == 0, result.stdout
assert not (slots / 'slot-0').exists(), 'owned slot leaked'
print('RESULT: 8 passed, 0 failed')
PY
node --input-type=module - "$ROOT" "$FX" <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { acquireHostSlot } = await import(pathToFileURL(path.join(process.argv[2], 'plugin/runtime/build/admission/hostSlots.mjs')));
const host = path.join(process.argv[3], 'node-host');
fs.writeFileSync(host, 'unusable');
assert.throws(() => acquireHostSlot({ host, max: 1, kind: 'g2', project: '/fixture' }));
console.log('RESULT: Node fail-closed passed');
JS
