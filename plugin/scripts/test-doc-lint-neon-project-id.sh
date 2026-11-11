#!/bin/bash
# Self-test (canary) for doc-lint.sh's Neon project ID advisory (EXT-8, DR-149).
#
# Contract under test: a project that uses Neon (a neon provider in .pandacorp/accounts/services.yaml
# or a neon.tech URL in .env.example) and whose .env.example does not declare NEON_PROJECT_ID gets an
# advisory finding; the exit code is unchanged (never red). A Neon project that declares it, and a
# project that does not use Neon, print nothing. Run from anywhere:
#   bash plugin/scripts/test-doc-lint-neon-project-id.sh

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
LINT="$HERE/../templates/shared/.pandacorp/doc-lint.sh"
OUT=$(mktemp)
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); sed 's/^/      /' "$OUT"; }
[ -f "$LINT" ] || { echo "FATAL: doc-lint.sh not found at $LINT"; exit 1; }

fixture() { # $1 services provider ("" = none) ; stdin -> .env.example ; prints dir
  local d; d=$(mktemp -d)
  mkdir -p "$d/.pandacorp"
  printf 'project: "fixture"\ncreated_via: "scaffold"\n' > "$d/.pandacorp/status.yaml"
  if [ -n "$1" ]; then
    mkdir -p "$d/.pandacorp/accounts"
    printf 'schema_version: 1\nservices:\n  db:\n    provider_id: %s\n' "$1" > "$d/.pandacorp/accounts/services.yaml"
  fi
  cat > "$d/.env.example"
  echo "$d"
}
run_lint() { ( cd "$1" && bash "$LINT" ) > "$OUT" 2>&1; rc=$?; }

D=$(fixture neon <<'X'
# Pooled Neon connection string for runtime queries.
DATABASE_URL=
X
)
run_lint "$D"
if [ "$rc" = 0 ] && grep -q "EXT-8" "$OUT"; then ok "Neon via services.yaml without NEON_PROJECT_ID warns, rc=0"; else bad "expected advisory + rc=0, got rc=$rc"; fi

D=$(fixture "" <<'X'
# Pooled connection string. Example: postgresql://user:pass@ep-x.us-east-1.aws.neon.tech/neondb
DATABASE_URL=
X
)
run_lint "$D"
if [ "$rc" = 0 ] && grep -q "EXT-8" "$OUT"; then ok "Neon via neon.tech URL without NEON_PROJECT_ID warns, rc=0"; else bad "expected advisory + rc=0, got rc=$rc"; fi

D=$(fixture neon <<'X'
# Pooled Neon connection string for runtime queries.
DATABASE_URL=
# Neon project ID passed to neonctl --project-id so it never asks for an organization.
NEON_PROJECT_ID=
X
)
run_lint "$D"
if [ "$rc" = 0 ] && ! grep -q "EXT-8" "$OUT"; then ok "Neon project declaring NEON_PROJECT_ID is quiet"; else bad "expected no advisory, got rc=$rc"; fi

D=$(fixture supabase <<'X'
# Pooled connection string for runtime queries.
DATABASE_URL=
X
)
run_lint "$D"
if [ "$rc" = 0 ] && ! grep -q "EXT-8" "$OUT"; then ok "non-Neon project is quiet"; else bad "expected no advisory, got rc=$rc"; fi

rm -f "$OUT"
echo "doc-lint neon-project-id canary: $pass passed, $fail failed"
[ "$fail" = 0 ]
