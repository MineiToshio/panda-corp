#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Install a genuinely isolated toolchain: npm exec can reuse local TypeScript without
# making it resolvable to Stryker's temporary ESM package.
export npm_config_cache="${npm_config_cache:-$PWD/.mutation-cache/npm}"
export TMPDIR="$PWD/.mutation-cache/tmp"
mkdir -p "$TMPDIR"
npm install --prefix .mutation-cache/toolchain --no-package-lock --ignore-scripts \
  --no-audit --no-fund --save-exact \
  @stryker-mutator/core@10.1.1 @stryker-mutator/vitest-runner@10.1.1 \
  vitest@4.1.9 typescript@5.9.3
node scripts/mutation/run-modules.mjs .mutation-cache/toolchain/node_modules/.bin/stryker "${1:-}"
