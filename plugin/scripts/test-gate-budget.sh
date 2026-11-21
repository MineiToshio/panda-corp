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
 printf '{"numTotalTests":2,"numPassedTests":2,"numFailedTests":0,"numPendingTests":0,"numTodoTests":0,"testResults":[{"name":"src/_tests/a.test.ts","assertionResults":[{"fullName":"old","status":"passed","duration":5000},{"fullName":"new","status":"passed","duration":%s}]}]}' "${NEW_MS:-10}" > "$out"
 node - "$out" "$PANDACORP_VITEST_ERRORS_FILE" "${UNIT_RED:-0}" <<'PROOF'
const fs=require('fs'),[file,out,red]=process.argv.slice(2),r=JSON.parse(fs.readFileSync(file));
if(red==='1'){r.numPassedTests=1;r.numFailedTests=1;r.testResults[0].assertionResults[1].status='failed';fs.writeFileSync(file,JSON.stringify(r));}
fs.writeFileSync(out,JSON.stringify({reason:red==='1'?'failed':'passed',unhandledErrors:[],plannedModules:1,completedModules:1,tests:r.testResults[0].assertionResults.map(t=>({id:'src/_tests/a.test.ts > '+t.fullName,status:t.status,declaredSkip:false}))}));
PROOF
 [ "${UNIT_RED:-0}" != 1 ] || { sed 's/"fullName":"new","status":"passed"/"fullName":"new","status":"failed"/' "$out" > "$out.tmp"; mv "$out.tmp" "$out"; exit 1; }
elif [ "$1 $2" = 'exec playwright' ]; then
 touch .pandacorp/run/browser-ran
 printf '{"errors":[],"stats":{"expected":1,"unexpected":0,"skipped":0,"flaky":0},"suites":[{"title":"smoke.spec.ts","specs":[{"file":"smoke.spec.ts","title":"browser","tests":[{"projectName":"desktop","expectedStatus":"passed","status":"expected","results":[{"status":"passed","duration":%s}]}]}]}]}' "${BROWSER_MS:-1}" > "$PLAYWRIGHT_JSON_OUTPUT_FILE"
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
# A preserved legacy budget allows one reviewed migration from real full-green timings.
echo '{"stages":{"vitest":55000,"playwright":432000},"margin":0.25}' > "$WT/.pandacorp/gate-budget.json"
run 10 10
test "$RC" = 0; grep -q 'legacy budget timing-capture transition' "$FX/result"
node "$QUEUE_FACTORY/plugin/scripts/gate-budget-baseline.mjs" "$WT" --from "$WT/.pandacorp/run/gate-report.json"
node --input-type=module - "$WT" <<'MIGRATE'
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {checkBudget} from './plugin/templates/shared/.pandacorp/test-gate-policy.mjs';
const wt=process.argv[2],b=JSON.parse(readFileSync(wt+'/.pandacorp/gate-budget.json'));
assert.equal(b.schemaVersion,1);assert.equal(b.baseline['src/_tests/a.test.ts > new'],10);
assert.throws(()=>checkBudget(wt,[{id:'truly-new',runner:'vitest',duration_ms:30001}]),/exceed/);
MIGRATE
echo 'RESULT: gate budget cases passed, 0 failed'
