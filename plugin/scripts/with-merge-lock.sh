#!/bin/bash
# Serialize direct-main writers with the queue (DR-096/DR-165). The queue owns the
# shared protocol; the factory copy resolves it from templates, the overlay locally.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LIB="$HERE/merge-queue.sh"
[ -f "$LIB" ] || LIB="$HERE/../templates/shared/.pandacorp/merge-queue.sh"
source "$LIB" --lock-library
[ "$#" -gt 0 ] || { echo 'usage: with-merge-lock.sh <command...>' >&2; exit 20; }
COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd)
WORKTREE=$(git rev-parse --show-toplevel)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
QUEUE_LOG="$PWD/.pandacorp/run/queue-log.jsonl"
queue_event() { :; }
fail() { echo "with-merge-lock: $1" >&2; exit "$2"; }
cleanup_merge_lock() {
  local rc="$?"
  trap - EXIT
  stop_lock_refresh
  release || true
  exit "$rc"
}
trap cleanup_merge_lock EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP
acquire
start_lock_refresh
"$@"
