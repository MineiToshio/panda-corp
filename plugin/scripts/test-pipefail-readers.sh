#!/bin/bash
# Regression (DR-146 addendum, SIGPIPE class): canary.sh's Playwright spec-DISCOVERY check must find
# every spec even when `playwright test --list` prints more than a pipe buffer (64 KB). Under
# `set -o pipefail`, `printf "$big" | grep -q x` reports failure when grep exits on an early match and
# printf dies of SIGPIPE — a nondeterministic "spec NOT discovered" rot verdict. Runs the REAL
# template canary.sh in a throwaway project whose `pnpm` stub fails every gate (so each canary check
# goes RED as designed) and prints a >64 KB listing with the specs near the top.
# Also covers the sibling found by the audit: doc-lint.sh `has_key` (frontmatter | grep -q) on a work
# order whose frontmatter has no closing fence and a >64 KB body must still see its keys.
# Run from the factory repo root:  bash plugin/scripts/test-pipefail-readers.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
CANARY="${CANARY_UNDER_TEST:-$HERE/plugin/templates/stack-a-nextjs/canary.sh}"
DOCLINT="${DOCLINT_UNDER_TEST:-$HERE/plugin/templates/shared/.pandacorp/doc-lint.sh}"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

fx=$(cd "$(mktemp -d)" && pwd -P)
mkdir -p "$fx/.pandacorp" "$fx/src" "$fx/docs" "$fx/e2e" "$fx/bin"
: > "$fx/playwright.config.ts"
echo '{"name":"canary-fixture"}' > "$fx/package.json"
cat > "$fx/bin/pnpm" <<'STUB'
#!/bin/bash
if [ "$1 $2 $3" = "exec playwright test" ]; then
  for s in smoke visual responsive shell headers; do echo "  [desktop] › $s.spec.ts:1:1 › $s"; done
  # Pad far beyond the 64 KB pipe buffer so an early-exiting reader would SIGPIPE the writer.
  for i in $(seq 1 4000); do echo "  [mobile] › padding/route-$i.spec.ts:1:1 › a long enough test title $i"; done
  exit 0
fi
exit 1   # every other gate "rejects" its broken fixture, as a healthy project's would
STUB
chmod +x "$fx/bin/pnpm"

size=$(cd "$fx" && PATH="$fx/bin:$PATH" pnpm exec playwright test e2e/ --list | wc -c | tr -d ' ')
[ "$size" -gt 65536 ] && ok "fixture listing is ${size} bytes (> 64 KB pipe buffer)" || bad "fixture listing only ${size} bytes"

for run in 1 2 3 4 5; do
  out=$(cd "$fx" && PATH="$fx/bin:$PATH" bash "$CANARY" 2>&1)
  if echo "$out" | grep -q "gate 'playwright (spec discovery: smoke/visual/responsive/shell/headers)' correctly REJECTED" \
     && ! echo "$out" | grep -q 'specs NOT discovered' && ! echo "$out" | grep -q 'Broken pipe'; then
    ok "run $run: every spec discovered in a >64 KB listing, no broken pipe"
  else
    bad "run $run: discovery misreported: $(echo "$out" | grep -E 'playwright|Broken pipe' | head -3)"
  fi
done

# doc-lint has_key on an unterminated >64 KB frontmatter: the WO carries every key on its first lines.
wo_dir="$fx/docs/frds/frd-01-x/work-orders"
mkdir -p "$fx/.pandacorp" "$wo_dir"
printf 'created_via: scaffold\n' > "$fx/.pandacorp/status.yaml"
printf -- '---\nid: FRD-01\ntype: frd\nstatus: DRAFT\nimplementation_status: PLANNED\n---\nREQ-01-001\n' > "$fx/docs/frds/frd-01-x/frd.md"
{ printf -- '---\nid: WO-01-001\ntype: work-order\nimplementation_status: PLANNED\nparent: FRD-01\n'
  for i in $(seq 1 3000); do echo "body line $i of a work order whose frontmatter fence was never closed"; done; } > "$wo_dir/wo-01-001-x.md"
for run in 1 2 3 4 5; do
  dl=$(cd "$fx" && bash "$DOCLINT" 2>&1)
  if ! echo "$dl" | grep -q 'wo-01-001-x.md missing frontmatter key' && ! echo "$dl" | grep -q 'Broken pipe'; then
    ok "run $run: doc-lint sees the keys of a >64 KB unterminated frontmatter"
  else
    bad "run $run: doc-lint misreported keys: $(echo "$dl" | grep -E 'wo-01-001|Broken pipe' | head -3)"
  fi
done
rm -f "$wo_dir/wo-01-001-x.md" "$fx/docs/frds/frd-01-x/frd.md" "$fx/.pandacorp/status.yaml"
rmdir "$wo_dir" "$fx/docs/frds/frd-01-x" "$fx/docs/frds" 2>/dev/null || true

rm -f "$fx/bin/pnpm" "$fx/playwright.config.ts" "$fx/package.json"
rmdir "$fx/bin" "$fx/e2e" "$fx/docs" "$fx/src" "$fx/.pandacorp" "$fx" 2>/dev/null || true
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = 0 ]
