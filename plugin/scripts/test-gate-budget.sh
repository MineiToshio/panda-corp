#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture budget
cp "$QUEUE_FACTORY/plugin/templates/stack-a-nextjs/verify.sh" "$WT/.pandacorp/verify.sh"
cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/test-gate-policy.mjs" "$WT/.pandacorp/"
mkdir -p "$WT/src/_tests" "$WT/e2e"
echo '{"name":"budget"}' > "$WT/package.json"
touch "$WT/playwright.config.ts"
for name in smoke visual responsive shell headers; do touch "$WT/e2e/$name.spec.ts"; done
cat > "$WT/bin/pnpm" <<'PNPM'
#!/bin/bash
if [ "$1" = vitest ]; then
 for arg in "$@"; do case "$arg" in --outputFile=*) out=${arg#--outputFile=};; esac; done
 printf '{"testResults":[{"name":"src/_tests/a.test.ts","assertionResults":[{"fullName":"old","status":"passed","duration":5000},{"fullName":"new","status":"passed","duration":%s}]}]}' "${NEW_MS:-10}" > "$out"
 [ "${UNIT_RED:-0}" != 1 ] || { sed 's/"fullName":"new","status":"passed"/"fullName":"new","status":"failed"/' "$out" > "$out.tmp"; mv "$out.tmp" "$out"; exit 1; }
elif [ "$1 $2" = 'exec playwright' ]; then
 touch .pandacorp/run/browser-ran
 printf '{"suites":[{"title":"smoke.spec.ts","specs":[{"file":"smoke.spec.ts","title":"browser","tests":[{"projectName":"desktop","results":[{"status":"passed","duration":%s}]}]}]}]}' "${BROWSER_MS:-1}" > "$PLAYWRIGHT_JSON_OUTPUT_FILE"
fi
exit 0
PNPM
chmod +x "$WT/bin/pnpm"
echo '{"schemaVersion":1,"addedTestTimeBudgetMs":{"vitest":30,"playwright":30},"baseline":{"src/_tests/a.test.ts > old":1}}' > "$WT/.pandacorp/gate-budget.json"
git -C "$WT" add .; git -C "$WT" commit -qm budget
run() { RC=0; (cd "$WT" && PATH="$WT/bin:$PATH" NEW_MS="$1" BROWSER_MS="${2:-1}" bash .pandacorp/verify.sh) > "$FX/result" 2>&1 || RC=$?; }
run 40
test "$RC" -ne 0; grep -q 'added tests 40 ms exceed 30 ms' "$FX/result"
python3 - "$WT" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]+'/.pandacorp/run/gate-report.json'))['green'] is False
PY
run 10
test "$RC" = 0; grep -q 'WARN DR-159: slower existing test' "$FX/result"
run 10 40
test "$RC" -ne 0; grep -q 'playwright: added tests 40 ms exceed 30 ms' "$FX/result"
run 10 10
test "$RC" = 0
node "$QUEUE_FACTORY/plugin/scripts/gate-budget-baseline.mjs" "$WT" --from "$WT/.pandacorp/run/gate-report.json"
node - "$WT" <<'JS'
const assert=require('assert/strict'),b=require(process.argv[2]+'/.pandacorp/gate-budget.json');
assert.equal(b.baseline['src/_tests/a.test.ts > new'],10);assert.equal(b.addedTestTimeBudgetMs.vitest,30);
JS
rm "$WT/.pandacorp/gate-budget.json" # only this test-owned synthetic file
run 100
test "$RC" = 0; grep -q 'WARN DR-159: missing' "$FX/result"
# A partial report cannot authorize a baseline refresh.
echo '{"scope":"partial","green":true,"test_timings":[]}' > "$FX/partial.json"
if node "$QUEUE_FACTORY/plugin/scripts/gate-budget-baseline.mjs" "$WT" --from "$FX/partial.json" > "$FX/partial" 2>&1; then exit 1; fi
# A real template nightly must still observe browser tests after a unit failure.
rm -f "$WT/.pandacorp/run/browser-ran"
RC=0
(cd "$WT" && PATH="$WT/bin:$PATH" UNIT_RED=1 PANDACORP_DISABLE_TEST_EXCLUSIONS=1 bash .pandacorp/verify.sh) > "$FX/nightly" 2>&1 || RC=$?
test "$RC" -ne 0; test -f "$WT/.pandacorp/run/browser-ran"
test ! -f "$WT/.pandacorp/run/green-stamp"
python3 - "$WT" "$APP" <<'PY_NIGHTLY'
import json,pathlib,sys
wt,main=map(pathlib.Path,sys.argv[1:]);r=json.loads((wt/'.pandacorp/run/gate-report.json').read_text())
assert not r['green'] and r['scope']=='full'
rows=list(map(json.loads,(main/'.pandacorp/run/test-outcomes.jsonl').read_text().splitlines()))
assert {r['runner'] for r in rows}=={'vitest','playwright'}
assert any(r['status']=='failed' for r in rows)
PY_NIGHTLY
echo 'RESULT: gate budget cases passed, 0 failed' 
