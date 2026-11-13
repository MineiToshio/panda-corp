#!/usr/bin/env bash
# Environment changes must invalidate public stamp API, including product-specific names (RVB B1).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FX=$(mktemp -d)
trap 'rm -rf "$FX"' EXIT
mkdir -p "$FX/.pandacorp" "$FX/e2e"
cp "$ROOT/plugin/templates/shared/.pandacorp/green-stamp.sh" "$FX/.pandacorp/"
printf '#!/bin/bash\nexit 0\n' > "$FX/.pandacorp/verify.sh"
printf '.pandacorp/run/\ne2e/server-env.json\n' > "$FX/.gitignore"
git -C "$FX" init -q
git -C "$FX" add -A
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm inputs
pass=0; fail=0
certify() { (cd "$FX" && bash .pandacorp/green-stamp.sh record "$(bash .pandacorp/green-stamp.sh start)" >/dev/null); }
check() { (cd "$FX" && bash .pandacorp/green-stamp.sh check >/dev/null 2>&1); }
certify
if check; then pass=$((pass+1)); else echo 'FAIL unchanged environment'; fail=$((fail+1)); fi
for key in MC_CLOCK MC_GIT_FIXTURE NAVIGATION_TEST_FACTORY_ROOT APP_PRIVATE_CONFIGURATION; do
  if (export "$key=invalid"; check); then echo "FAIL changed $key reused stamp"; fail=$((fail+1)); else pass=$((pass+1)); fi
done
# Actual product oracle: the same invalid clock rejected above must make the real clock fail.
if MC_CLOCK=invalid node --input-type=module - "$ROOT/mission-control/src/lib/clock/clock.ts" <<'JS'
import { pathToFileURL } from 'node:url';
const { now, ClockConfigError } = await import(pathToFileURL(process.argv[2]));
try { now(); } catch (error) {
  if (error instanceof ClockConfigError) process.exit(7);
  throw error;
}
JS
then echo 'FAIL invalid clock accepted by real product'; fail=$((fail+1)); else
  code=$?
  if [ "$code" = 7 ]; then pass=$((pass+1)); else echo "FAIL unexpected clock oracle exit $code"; fail=$((fail+1)); fi
fi
printf '{"MC_CLOCK":"invalid"}\n' > "$FX/e2e/server-env.json"
if check; then echo 'FAIL changed server environment reused stamp'; fail=$((fail+1)); else pass=$((pass+1)); fi
certify
printf 'PORT=3999\n' > "$FX/.pandacorp/run/lane.env"
if check; then echo 'FAIL changed lane environment reused stamp'; fail=$((fail+1)); else pass=$((pass+1)); fi
printf 'RESULT: %s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
