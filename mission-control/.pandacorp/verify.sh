#!/usr/bin/env bash
# Mission Control verification gate (DR-019: fail-closed, actionable).
# Run from the project root: `bash .pandacorp/verify.sh` (or `pnpm verify`).
# Every gate must pass; the first failure aborts with a non-zero exit code.
set -euo pipefail

cd "$(dirname "$0")/.."

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

echo "▶ Lint + format (biome)…"
pnpm biome check . || fail "Biome found lint/format errors. Try \`pnpm biome check --write .\` for autofixable ones."

echo "▶ Type-check (tsc --noEmit)…"
pnpm tsc --noEmit || fail "TypeScript reported type errors."

echo "▶ Tests (vitest)…"
pnpm vitest run --reporter=dot || fail "Tests failed."

echo ""
echo "✅ verify.sh: all gates green (biome + tsc + vitest)."
