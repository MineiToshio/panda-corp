#!/bin/bash
# Review regressions for certified waiting inputs and legacy-main telemetry.
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
passed=0; failed=0
expect() { if "$@"; then passed=$((passed+1)); else echo "FAIL: $*"; failed=$((failed+1)); [ ! -f "$FX/output" ] || tail -12 "$FX/output"; fi; }
fixture waiting-bootstrap
printf 'phase: release\ndeploy_target: external\n' > "$APP/.pandacorp/status.yaml"
git -C "$APP" add .; git -C "$APP" commit -qm launched
mkdir -p "$WT/e2e"
printf '{"PORT":0}\n' > "$WT/e2e/server-env.json"
cat > "$WT/.pandacorp/worktree-bootstrap.sh" <<'BOOT'
#!/bin/bash
printf '{"PORT":61999}\n' > e2e/server-env.json
git update-index --skip-worktree e2e/server-env.json
BOOT
chmod +x "$WT/.pandacorp/worktree-bootstrap.sh"
git -C "$WT" add .; git -C "$WT" commit -qm 'bootstrap restoration fixture'
run_queue
expect test "$RC" = 21
state=$(cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/merge-queue.sh --status)
expect test "${state%%$'\n'*}" = certified-awaiting-order
# The immediate attended retry must reuse the exact certificate, without bootstrap.
run_queue
expect test "$RC" = 21
expect grep -q 'SKIPPED.*certified-tree' "$FX/output"
expect git -C "$WT" diff --quiet HEAD -- e2e/server-env.json
expect bash -c '! git -C "$1" ls-files -v -- e2e/server-env.json | grep "^S "' _ "$WT"
# Arbitrary tracked content must never be accepted as a certified bootstrap exception.
git -C "$WT" update-index --no-skip-worktree e2e/server-env.json
printf '{"PORT":62000}\n' > "$WT/e2e/server-env.json"
state=$(cd "$WT" && PATH="$WT/bin:$PATH" bash .pandacorp/merge-queue.sh --status)
expect test "${state%%$'\n'*}" = implemented-uncertified

fixture legacy-main
# Keep ignored run outputs in the invoking checkout only. Main deliberately has no runtime ignores.
printf '' > "$APP/.gitignore"
git -C "$APP" add .; git -C "$APP" commit -qm 'legacy main without runtime ignores'
git -C "$APP" config extensions.worktreeConfig true
printf '.pandacorp/run/\n' > "$FX/wt-excludes"
git -C "$WT" config --worktree core.excludesFile "$FX/wt-excludes"
run_queue
expect test "$RC" = 0
expect test -f "$APP/.pandacorp/run/gate-reports/$(python3 - "$QLOG" <<'PY'
import json,sys
print(next(r['attempt'] for r in map(json.loads,open(sys.argv[1])) if r['event']=='gate_end'))
PY
).json"
# Similar file names are owner WIP, not queue telemetry exemptions.
fixture telemetry-lookalike
printf '' > "$APP/.gitignore"
git -C "$APP" add .; git -C "$APP" commit -qm 'legacy main without runtime ignores'
mkdir -p "$APP/.pandacorp/run"
echo owner > "$APP/.pandacorp/run/test-outcomes.jsonl.owner"
run_queue
expect test "$RC" = 12
printf 'RESULT: %s passed, %s failed\n' "$passed" "$failed"
test "$failed" = 0
