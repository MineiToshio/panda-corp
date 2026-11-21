#!/bin/bash
# Public stamp API: invocation controls are stable; product inputs remain private and binding.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FX=$(mktemp -d "${TMPDIR:-/tmp}/stamp-controls.XXXXXX")
trap 'rm -rf "$FX"' EXIT
mkdir -p "$FX/.pandacorp"
cp "$ROOT/plugin/templates/shared/.pandacorp/green-stamp.sh" "$FX/.pandacorp/"
printf '#!/bin/bash\nexit 0\n' > "$FX/.pandacorp/verify.sh"
printf '.pandacorp/run/\nnode_modules/\n' > "$FX/.gitignore"
git -C "$FX" init -q
git -C "$FX" add .
git -C "$FX" -c user.name=Fixture -c user.email=fixture@example.test commit -qm fixture
cd "$FX"
export PANDACORP_STAMP_BASE=$(git rev-parse HEAD)
token=$(bash .pandacorp/green-stamp.sh start)
bash .pandacorp/green-stamp.sh record "$token" >/dev/null
grep -q "^base=$PANDACORP_STAMP_BASE$" .pandacorp/run/green-stamp
for key in TMPDIR npm_config_cache PANDACORP_CLEANUP_SESSION PANDACORP_SESSION_TEMP_BASE PANDACORP_HOST_SLOT_TOKEN PANDACORP_STAMP_BASE PANDACORP_E2E_SNAPSHOTS; do
  (export "$key=invocation-change"; [ "$(bash .pandacorp/green-stamp.sh start)" = "$token" ]; bash .pandacorp/green-stamp.sh check >/dev/null)
done
if PATH="/private-secret-path:$PATH" bash .pandacorp/green-stamp.sh check --explain > "$FX/.pandacorp/run/out" 2> "$FX/.pandacorp/run/err"; then echo 'FAIL changed PATH'; exit 1; fi
# Keep logs outside Git's view for the rest of the API checks.
rm "$FX/.pandacorp/run/out"
grep -q 'environment variable PATH' "$FX/.pandacorp/run/err"
! grep -q 'private-secret-path' "$FX/.pandacorp/run/err"
rm "$FX/.pandacorp/run/err"
if HOME="/private-secret-home" bash .pandacorp/green-stamp.sh check --explain > .pandacorp/run/out 2> .pandacorp/run/err; then echo 'FAIL changed HOME'; exit 1; fi
grep -q 'environment variable HOME' .pandacorp/run/err
! grep -q 'private-secret-home' .pandacorp/run/err
mkdir -p node_modules
printf 'graph drift\n' > node_modules/.modules.yaml
if bash .pandacorp/green-stamp.sh check --explain 2> .pandacorp/run/explain; then echo 'FAIL dependency drift'; exit 1; fi
grep -q 'dependencies group' .pandacorp/run/explain
sed 's/^version=3$/version=2/' .pandacorp/run/green-stamp > .pandacorp/run/old
mv .pandacorp/run/old .pandacorp/run/green-stamp
if bash .pandacorp/green-stamp.sh check --explain 2> .pandacorp/run/explain; then echo 'FAIL old format'; exit 1; fi
grep -q 'format unknown' .pandacorp/run/explain
echo 'RESULT: 12 passed, 0 failed'
