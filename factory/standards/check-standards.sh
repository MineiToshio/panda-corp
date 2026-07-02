#!/usr/bin/env bash
# check-standards.sh — validates the executable-standard template (factory/standards/README.md)
# FAIL (exit 1): missing preamble, missing "How it is verified" (non-internal), file absent from the registry.
# WARN (exit 0): aspirational MUST rules in rule-registry.md (the burn-down list — visible, not blocking).
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

if [[ "$fail" -eq 0 ]]; then
  echo "OK: all standards conform to the template ($(ls *.md | grep -cv -e README -e rule-registry) files checked)"
fi
exit "$fail"
