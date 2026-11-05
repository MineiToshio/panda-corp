#!/usr/bin/env bash
# Thin transport to the canonical runtime-neutral engine. Never copy/fork its safety logic.
set -euo pipefail
cleanup_plugin_root="${CLAUDE_PLUGIN_ROOT:-${PANDACORP_PLUGIN_ROOT:-}}"
if [ -z "$cleanup_plugin_root" ] || [ ! -f "$cleanup_plugin_root/scripts/session-cleanup.mjs" ]; then
  echo 'session-cleanup: set PANDACORP_PLUGIN_ROOT to the active Pandacorp plugin root (Claude supplies CLAUDE_PLUGIN_ROOT)' >&2
  exit 3
fi
exec node "$cleanup_plugin_root/scripts/session-cleanup.mjs" "$@"
