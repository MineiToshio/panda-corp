#!/bin/bash
# Self-test (canary) for doc-lint.sh's `.env.example` per-variable description guard (CONV-16, DR-136).
#
# Contract under test: every variable line in `.env.example` (an assignment, or a commented-out
# `# NAME=value` optional variable) must have its OWN description comment on the line directly above
# it. A comment shared by a block of variables, a blank line, a section header (`# --- Group ---`,
# `# ====`) or a commented-out assignment above it is NOT a description and must red the gate, on
# EVERY project regardless of `created_via`. A fully described file and a project with no
# `.env.example` stay green. Run from anywhere:
#   bash plugin/scripts/test-doc-lint-env-example.sh

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
LINT="$HERE/../templates/shared/.pandacorp/doc-lint.sh"
OUT=$(mktemp)
pass=0; fail=0

ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); if [ -n "${2:-}" ]; then echo "$2" | sed 's/^/      /'; fi }

[ -f "$LINT" ] || { echo "FATAL: doc-lint.sh not found at $LINT"; exit 1; }

run_lint() { # $1 dir -> sets $rc, output in $OUT
  ( cd "$1" && bash "$LINT" ) > "$OUT" 2>&1
  rc=$?
}

fixture() { # $1 created_via (may be empty) ; stdin -> .env.example ; prints the dir
  local d; d=$(mktemp -d)
  if [ -n "$1" ]; then
    mkdir -p "$d/.pandacorp"
    printf 'project: "fixture"\ncreated_via: "%s"\n' "$1" > "$d/.pandacorp/status.yaml"
  fi
  cat > "$d/.env.example"
  echo "$d"
}

# --- GREEN: every variable described, headers separated, commented optional var described --------
D=$(fixture scaffold <<'EOF'
# App environment guide. Copy to .env.local; never commit values.

# --- Database ---
# Pooled connection string for runtime queries. Neon > Connection details > Pooled.
DATABASE_URL=
# Direct connection for migrations only. Neon > Connection details > Direct.
DATABASE_URL_UNPOOLED=

# ==== Storage ====
# R2 access key id for the private bucket. R2 > Manage API tokens.
# Scoped to read-only for the web runtime.
R2_ACCESS_KEY_ID=
# R2 secret access key paired with R2_ACCESS_KEY_ID.
R2_SECRET_ACCESS_KEY=
# Optional override of the bucket name; defaults to the per-environment bucket.
# R2_BUCKET=funko-dev
EOF
)
run_lint "$D"
if [ "$rc" = 0 ]; then ok "fully described .env.example stays green"; else bad "described file should pass (rc=0), got rc=$rc" "$(cat "$OUT")"; fi

# --- RED: a comment shared by a block of variables only describes the first one ------------------
D=$(fixture scaffold <<'EOF'
# Google OAuth client. Google Cloud Console > Credentials.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
)
run_lint "$D"
if [ "$rc" = 1 ]; then ok "shared block comment reds the gate"; else bad "shared block comment should red (rc=1), got rc=$rc" "$(cat "$OUT")"; fi
grep -q "line 3: GOOGLE_CLIENT_SECRET" "$OUT" && ! grep -q "GOOGLE_CLIENT_ID" "$OUT" \
  && ok "finding names only the undescribed variable and its line" \
  || bad "finding should name GOOGLE_CLIENT_SECRET (line 3) and not GOOGLE_CLIENT_ID" "$(cat "$OUT")"

# --- RED: a section header directly above a variable is not a description -----------------------
D=$(fixture scaffold <<'EOF'
# --- Scheduled jobs ---
CRON_SECRET=
EOF
)
run_lint "$D"
if [ "$rc" = 1 ] && grep -q "CRON_SECRET" "$OUT"; then ok "'# --- Group ---' header is not a description"; else bad "header above a variable should red, got rc=$rc" "$(cat "$OUT")"; fi

D=$(fixture scaffold <<'EOF'
# ============================================================================
OPS_ENV=
EOF
)
run_lint "$D"
if [ "$rc" = 1 ]; then ok "decoration-only '# ====' line is not a description"; else bad "decoration line above a variable should red, got rc=$rc" "$(cat "$OUT")"; fi

# --- RED: a blank line between the comment and the variable breaks the attachment ----------------
D=$(fixture scaffold <<'EOF'
# Public site URL used for canonical links.

NEXT_PUBLIC_SITE_URL=
EOF
)
run_lint "$D"
if [ "$rc" = 1 ]; then ok "a blank line detaches the comment from the variable"; else bad "comment separated by a blank line should red, got rc=$rc" "$(cat "$OUT")"; fi

# --- RED: a commented-out optional variable needs its own description too ------------------------
D=$(fixture scaffold <<'EOF'
# Absolute path to the factory root; optional.
# PANDACORP_FACTORY_ROOT=/absolute/path
# PANDACORP_EVENTS_FILE=/absolute/path/events.ndjson
EOF
)
run_lint "$D"
if [ "$rc" = 1 ] && grep -q "PANDACORP_EVENTS_FILE" "$OUT" && ! grep -q "PANDACORP_FACTORY_ROOT" "$OUT"; then
  ok "commented-out optional variable without its own description reds"
else bad "second commented-out variable should red alone, got rc=$rc" "$(cat "$OUT")"; fi

# --- RED: `export NAME=` and CRLF line endings are still variables ------------------------------
D=$(fixture scaffold <<'EOF'
# Described first variable.
export FIRST=
export SECOND=
EOF
)
run_lint "$D"
if [ "$rc" = 1 ] && grep -q "SECOND" "$OUT"; then ok "'export NAME=' lines are checked"; else bad "undescribed export line should red, got rc=$rc" "$(cat "$OUT")"; fi

D=$(fixture scaffold < /dev/null)
printf '# Described with CRLF endings.\r\nALPHA=\r\n# Also described.\r\nBETA=\r\n' > "$D/.env.example"
run_lint "$D"
if [ "$rc" = 0 ]; then ok "CRLF line endings do not create false findings"; else bad "described CRLF file should pass, got rc=$rc" "$(cat "$OUT")"; fi

# --- FAIL-LOUD REGARDLESS OF PROVENANCE: brownfield and no-status projects red too ---------------
for via in adopt ""; do
  D=$(fixture "$via" <<'EOF'
# Resend API key.
RESEND_API_KEY=
EMAIL_FROM=
EOF
)
  run_lint "$D"
  label=${via:-no status.yaml}
  if [ "$rc" = 1 ]; then ok "reds on a ${label} project (not advisory-only like the doc-spine findings)"; else bad "${label} project should red, got rc=$rc" "$(cat "$OUT")"; fi
done

# --- GREEN: no .env.example at all is a vacuous pass --------------------------------------------
D=$(mktemp -d)
run_lint "$D"
if [ "$rc" = 0 ]; then ok "no .env.example is a vacuous pass"; else bad "missing .env.example should pass, got rc=$rc" "$(cat "$OUT")"; fi

rm -f "$OUT"
echo ""
echo "test-doc-lint-env-example: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
