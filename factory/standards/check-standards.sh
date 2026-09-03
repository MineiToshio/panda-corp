#!/usr/bin/env bash
# check-standards.sh — validates the executable-standard template (factory/standards/README.md)
# FAIL (exit 1): missing preamble, missing "How it is verified" (non-internal), file absent from the registry.
# WARN (exit 0): aspirational MUST rules in rule-registry.md (the burn-down list — visible, not blocking).
# Run by (BL-0055 — a checker with no trigger rots): the weekly `pandacorp-consistency-sweep` routine
# (plugin/docs/routines.md, step 0) and /pandacorp:learn's closing step whenever the change touched
# factory/standards/. Both report the exit code; it is also runnable by hand from anywhere.
set -euo pipefail

cd "$(dirname "$0")"
REGISTRY="rule-registry.md"
fail=0

for f in *.md; do
  case "$f" in README.md|"$REGISTRY") continue ;; esac

  preamble=$(head -5 "$f" | grep -m1 '^> Domain:' || true)
  if [[ -z "$preamble" ]] || ! grep -q 'Severity' <<<"$preamble" || ! grep -q 'Enforcement' <<<"$preamble"; then
    echo "FAIL $f: missing/incomplete preamble (> Domain: … · Severity: … · Enforcement: …)"
    fail=1
  fi

  if ! grep -qi 'factory-internal' <<<"$preamble"; then
    if ! grep -q '^## How it is verified' "$f"; then
      echo "FAIL $f: missing '## How it is verified' section (name the check or tag review-only)"
      fail=1
    fi
  fi

  if ! grep -q "$f" "$REGISTRY"; then
    echo "FAIL $f: not represented in $REGISTRY (every standard needs registry rows)"
    fail=1
  fi
done

# --- Standards ↔ rules conformance (DR-051 auditor) ------------------------------------
# (a) every operative form a preamble names exists in the rule library;
# (b) every rule file's `source:` maps back to a standard that exists (advisory).
RULES_DIR="../../plugin/templates/rules"
if [[ -d "$RULES_DIR" ]]; then
  for f in *.md; do
    case "$f" in README.md|"$REGISTRY") continue ;; esac
    while IFS= read -r op; do
      [[ -n "$op" ]] || continue
      base="${op#rules/}"
      if [[ ! -f "$RULES_DIR/$base" ]]; then
        echo "FAIL $f: names operative form '$op' but $RULES_DIR/$base does not exist (DR-051 contract broken)"
        fail=1
      fi
    done < <(head -5 "$f" | grep -o 'rules/[a-z0-9-]*\.md' | sort -u)
  done
  for r in "$RULES_DIR"/*.md; do
    rb=$(basename "$r")
    [[ "$rb" == "README.md" ]] && continue
    src=$(grep -m1 '^source: Pandacorp standard' "$r" | sed 's/.*— *//' | awk '{print $1}' || true)
    if [[ -n "$src" && ! -f "$src.md" ]]; then
      echo "WARN rules/$rb: source names standard '$src' but factory/standards/$src.md does not exist (stale source or missing canonical backing)"
    fi
  done
fi

# Burn-down visibility: aspirational MUSTs are defects (promise-without-mechanism)
asp_must=$(grep -c '| MUST.*| aspirational |' "$REGISTRY" || true)
if [[ "$asp_must" -gt 0 ]]; then
  echo "WARN: $asp_must aspirational MUST rule(s) in $REGISTRY — wire or demote:"
  grep '| MUST.*| aspirational |' "$REGISTRY" | sed 's/^/  /'
fi

# --- Rule-registry recount assertion (BL-0091) ----------------------------------------
# Derived count: excludes header row, separator, and non-rule structural rows.
# Alert if the table structure changes without updating the prose narrative.
counts=$(awk -F'|' '
  /^## Burn-down: aspirational rules/ { found_table = 0 }
  /^\| ID \| Rule \|/ { found_table = 1; next }
  found_table && NF >= 6 {
    id = $2
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", id)
    if (id == "Rule" || id ~ /^-+$/ || id == "" || id == "ID") next
    status = $(NF-1)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", status)
    if (status ~ /^-+$/ || status == "") next
    total++
    if (status == "wired") wired++
    else if (status == "manual") manual++
    else if (status == "aspirational") aspirational++
  }
  END { print total, wired, manual, aspirational }
' "$REGISTRY")
read -r total wired manual aspirational <<< "$counts"
echo "registry-count: $total rules → $wired wired · $manual manual · $aspirational aspirational"

# Assertion: every counted row must land in exactly one recognized enforcement-status bucket
# (wired/manual/aspirational). If the three buckets don't sum to the total, some row carries a
# malformed/unrecognized status value — a real registry defect, not a display nit.
sum=$((wired + manual + aspirational))
if [[ "$sum" -ne "$total" ]]; then
  echo "FAIL $REGISTRY: registry-count mismatch — $total rows counted but $sum landed in a recognized status (wired/manual/aspirational); $((total - sum)) row(s) carry an unrecognized enforcement-status value"
  fail=1
fi

if [[ "$fail" -eq 0 ]]; then
  echo "OK: all standards conform to the template ($(ls *.md | grep -cv -e README -e rule-registry) files checked)"
fi
exit "$fail"
