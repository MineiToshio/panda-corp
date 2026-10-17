#!/bin/bash
# Runtime-neutral lifecycle entry point; writes only on the explicit --apply flag.
set -eu
FACTORY_ROOT="${PANDACORP_FACTORY_ROOT:-$(cd "$(dirname "$0")/../.." && pwd -P)}"
ARGS=("$@")
for ((i=0; i<${#ARGS[@]}; i++)); do
  if [ "${ARGS[$i]}" = "--factory-root" ]; then
    FACTORY_ROOT="${ARGS[$((i+1))]:?--factory-root requires a path}"
  fi
done
FACTORY_ROOT="$(cd "$FACTORY_ROOT" && pwd -P)"
export PANDACORP_FACTORY_ROOT="$FACTORY_ROOT"
cd "$FACTORY_ROOT/mission-control"
exec node --loader ./scripts/read-model/ts-loader.mjs ./scripts/navigation/identities.mjs "${ARGS[@]}"
