#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture diagnosis
cp "$QUEUE_FACTORY/plugin/templates/stack-a-nextjs/verify.sh" "$WT/.pandacorp/verify.sh"
cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/test-gate-policy.mjs" "$WT/.pandacorp/"
mkdir -p "$WT/src/_tests" "$WT/e2e"
echo '{"name":"diagnosis"}' > "$WT/package.json"
touch "$WT/playwright.config.ts"
for name in smoke visual responsive shell headers; do touch "$WT/e2e/$name.spec.ts"; done
cat > "$WT/bin/pnpm" <<'PNPM'
#!/bin/bash
printf '%s|no-bail=%s\n' "$*" "${PANDACORP_VERIFY_NO_BAIL:-unset}" >> .pandacorp/run/commands
case "$1" in biome|tsc) echo "static $1 failed"; exit 1 ;; esac
if [ "$1" = vitest ]; then
  for arg in "$@"; do case "$arg" in --outputFile=*) out=${arg#--outputFile=};; esac; done
  echo 'FAIL src/_tests/a.test.ts > first failure'
  echo 'FAIL src/_tests/a.test.ts > second failure'
  printf '%s' '{"testResults":[{"name":"src/_tests/a.test.ts","assertionResults":[{"fullName":"first failure\nparameter","status":"failed"},{"fullName":"second failure","status":"failed"}]}]}' > "$out"
  exit 1
fi
exit 0
PNPM
chmod +x "$WT/bin/pnpm"
git -C "$WT" add .; git -C "$WT" commit -qm 'diagnosis fixture'
rc=0
(cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/verify.sh --diagnose-unit) > "$FX/diagnosis" 2>&1 || rc=$?
test "$rc" != 0
grep -q 'first failure' "$FX/diagnosis"; grep -q 'second failure' "$FX/diagnosis"
grep -q -- '--bail=0.*no-bail=0' "$WT/.pandacorp/run/commands"
! grep -q playwright "$WT/.pandacorp/run/commands"
test ! -f "$WT/.pandacorp/run/green-stamp"
python3 - "$WT" "$APP" <<'PY'
import json,pathlib,sys
wt,main=map(pathlib.Path,sys.argv[1:]);r=json.loads((wt/'.pandacorp/run/gate-report.json').read_text())
assert r['scope']=='partial' and not r['green']
assert {'biome','tsc','vitest'} <= {g['name'] for g in r['subgates'] if g['exit']}
rows=list(map(json.loads,(main/'.pandacorp/run/test-outcomes.jsonl').read_text().splitlines()))
assert rows[0]['test_id']=='src/_tests/a.test.ts > first failure\\nparameter' and rows[0].get('id_encoding')=='json-string-v1'
assert len(rows)==2 and all(r['status']=='failed' and r['worker'] is None and r['attempt'] for r in rows)
assert not (wt/'.pandacorp/run/test-outcomes.jsonl').exists()
PY
test "$(find "$PANDACORP_HOST_DIR/h-slots" -name 'slot-*' | wc -l | tr -d ' ')" = 0
# Dirty diagnosis snapshots must not reuse HEAD's identity after a deterministic repair.
echo fixed > "$WT/value.txt"
rc=0
(cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/verify.sh --diagnose-unit) > "$FX/diagnosis-dirty" 2>&1 || rc=$?
test "$rc" != 0
python3 - "$APP" <<'PY_DIRTY'
import json,pathlib,sys
rows=list(map(json.loads,(pathlib.Path(sys.argv[1])/'.pandacorp/run/test-outcomes.jsonl').read_text().splitlines()))
assert len(rows)==4 and rows[0]['tree'] != rows[2]['tree'] and len(rows[2]['tree'])==64
PY_DIRTY
echo 'RESULT: 7 passed, 0 failed (static/unit failures, browser unchanged, no stamp, ledger, slot, dirty-tree identity)'
