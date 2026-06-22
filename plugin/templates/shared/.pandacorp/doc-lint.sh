#!/usr/bin/env bash
# Doc-structure lint (DR-077) — stack-agnostic. ADVISORY by design: it REPORTS drift and ALWAYS
# exits 0, so it never red-locks an existing or adopted project whose stable-ID spine is partial
# (the DR-074/075 retrofit lesson + the research finding that over-strict gates get disabled). It
# surfaces, during the gate, docs that drift from the template contract:
#   - required frontmatter keys on FRD / work-order docs,
#   - a PRD without a `type`,
#   - a work order citing a REQ-NN-MMM defined in NO FRD (cross-FRD citations are fine).
# A project with no docs/ is a vacuous pass. Run from the project root; verify.sh invokes it.
# By default it prints a one-line summary; run `.pandacorp/doc-lint.sh -v` for the per-finding list.
# Promotion to a fail-closed gate is a future per-project opt-in (once the spine is conformant),
# mirroring how target_platforms goes desktop->responsive.
# Managed by Pandacorp — re-synced by /pandacorp:upgrade. Don't hand-edit.
set -euo pipefail

VERBOSE=0
if [ "${1:-}" = "-v" ] || [ "${1:-}" = "--verbose" ]; then VERBOSE=1; fi

[ -d docs ] || exit 0

count=0
warn() {
  count=$((count + 1))
  if [ "$VERBOSE" = 1 ]; then echo "⚠ doc-lint: $1"; fi
}

# Print the YAML frontmatter block (between the first two `---` lines).
frontmatter() { awk '/^---[[:space:]]*$/{c++; next} c==1{print} c>=2{exit}' "$1"; }
has_key() { frontmatter "$1" | grep -qE "^$2:"; }

# PRD — should carry a type.
if [ -f docs/product/prd.md ]; then
  has_key docs/product/prd.md type || warn "docs/product/prd.md missing frontmatter key 'type'"
fi

# FRDs — required frontmatter keys.
for frd in docs/frds/frd-*/frd.md; do
  [ -f "$frd" ] || continue
  for k in id type status implementation_status; do
    has_key "$frd" "$k" || warn "$frd missing frontmatter key '$k'"
  done
done

# Work orders — required frontmatter + every cited REQ must be defined in SOME FRD (cross-FRD OK).
all_reqs=$(grep -rhoE 'REQ-[0-9]{2}-[0-9]{3}' docs/frds/*/frd.md 2>/dev/null | sort -u || true)
for wo in docs/frds/frd-*/work-orders/wo-*.md; do
  [ -f "$wo" ] || continue
  for k in id type implementation_status parent; do
    has_key "$wo" "$k" || warn "$wo missing frontmatter key '$k'"
  done
  reqs=$(frontmatter "$wo" | grep -oE 'REQ-[0-9]{2}-[0-9]{3}' | sort -u || true)
  for req in $reqs; do
    printf '%s\n' "$all_reqs" | grep -qx "$req" || warn "$wo cites $req, defined in no FRD"
  done
done

if [ "$count" -gt 0 ] && [ "$VERBOSE" != 1 ]; then
  echo "⚠ doc-lint: $count advisory finding(s) — frontmatter / REQ-ID-spine drift (run .pandacorp/doc-lint.sh -v for detail). Advisory only; not a gate."
fi
exit 0
