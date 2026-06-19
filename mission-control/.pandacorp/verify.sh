#!/usr/bin/env bash
# Mission Control verification gate (DR-019: fail-closed, actionable).
# Run from the project root: `bash .pandacorp/verify.sh` (full suite)
#   or `bash .pandacorp/verify.sh --since <ref>` (biome+tsc global + only the vitest tests affected since <ref>).
# Every gate must pass; the first failure aborts with a non-zero exit code.
set -euo pipefail

cd "$(dirname "$0")/.."

# Focused-gate mode (DR-050 §5): `--since <ref>` runs biome+tsc globally but only the vitest
# tests affected since <ref> (fast per-FRD gate); the no-arg call runs the full suite (close-out).
SINCE=""
if [ "${1:-}" = "--since" ] && [ -n "${2:-}" ]; then
  SINCE="$2"
fi

fail() {
  echo ""
  echo "❌ verify.sh: $1"
  echo "   Fix the issue above and re-run \`bash .pandacorp/verify.sh\`."
  exit 1
}

command -v pnpm >/dev/null 2>&1 || fail "pnpm not found. Install it: \`npm i -g pnpm\` (or \`corepack enable\`)."

if [ ! -d node_modules ]; then
  fail "node_modules missing. Run \`pnpm install\` first."
fi

echo "▶ Structure guard (no loose tests outside _tests/)…"
# project-structure.md / quality-and-testing.md: unit/component tests live in a
# _tests/ folder beside the implementation — never loose at the same level.
LOOSE_TESTS="$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -not -path '*/_tests/*' 2>/dev/null || true)"
if [ -n "$LOOSE_TESTS" ]; then
  echo "$LOOSE_TESTS" | sed 's/^/   /'
  fail "Loose test file(s) outside a _tests/ folder (see project-structure.md). Move them into the component/feature's _tests/."
fi

echo "▶ Max-lines guard (no source file > 500 lines)…"
# clean-code.md: a file an agent can load whole is a file it can change safely.
# Known exemption (logged, not silent): PartyScene.tsx is split by the in-flight
# FRD-06 Party build — remove this exemption once that lands.
MAXLINES_EXEMPT="src/app/projects/[slug]/_party/PartyScene/PartyScene.tsx"
OVERSIZED=""
while IFS= read -r srcfile; do
  [ -z "$srcfile" ] && continue
  lines="$(wc -l < "$srcfile" | tr -d ' ')"
  if [ "$lines" -gt 500 ]; then
    if [ "$srcfile" = "$MAXLINES_EXEMPT" ]; then
      echo "   (exempt) $srcfile — $lines lines — split tracked by FRD-06 Party build"
    else
      OVERSIZED="$OVERSIZED   $srcfile ($lines lines)\n"
    fi
  fi
done <<EOF
$(find src -type f \( -name '*.ts' -o -name '*.tsx' \) -not -name '*.test.ts' -not -name '*.test.tsx' -not -path '*/_tests/*' 2>/dev/null)
EOF
if [ -n "$OVERSIZED" ]; then
  printf "%b" "$OVERSIZED"
  fail "Source file(s) over 500 lines (clean-code.md). Split into cohesive sibling modules."
fi

echo "▶ Circular-dependency guard (madge)…"
# clean-code.md: no circular dependencies; deps point one way. Biome can't detect
# cycles, so madge owns this check (resolves the @/ alias via tsconfig).
pnpm exec madge --circular --extensions ts,tsx --ts-config tsconfig.json src \
  || fail "Circular dependency detected (clean-code.md). Break the cycle (e.g. extract the shared type to its own module)."

echo "▶ Lint + format (biome)…"
pnpm biome check . || fail "Biome found lint/format errors. Try \`pnpm biome check --write .\` for autofixable ones."

echo "▶ Type-check (tsc --noEmit)…"
pnpm tsc --noEmit || fail "TypeScript reported type errors."

if [ -n "$SINCE" ]; then
  echo "▶ Tests (vitest --changed $SINCE — only affected since last green)…"
  pnpm vitest run --changed "$SINCE" --reporter=dot || fail "Tests failed."
else
  echo "▶ Tests (vitest, full suite)…"
  pnpm vitest run --reporter=dot || fail "Tests failed."
fi

echo ""
echo "✅ verify.sh: all gates green (biome + tsc + vitest)."
