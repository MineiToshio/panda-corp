#!/usr/bin/env bash
# Diagnostic only: use main's committed policy and code, never edit the live checkout.
# Bash 3.2/BSD: mktemp + trap rather than GNU timeout/date or associative arrays.
set -euo pipefail
project=$(cd "${1:?usage: nightly-excluded-run.sh <project>}" && pwd -P)
repo=$(git -C "$project" rev-parse --show-toplevel)
prefix=$(git -C "$project" rev-parse --show-prefix)
if ! git -C "$project" cat-file -e "main:${prefix}.pandacorp/test-exclusions.json" 2>/dev/null; then
  echo 'nightly: no committed exclusions on main'; exit 0
fi
scratch=$(mktemp -d "${TMPDIR:-/tmp}/excluded-nightly.XXXXXX")
checkout="$scratch/checkout"
cleanup() {
  # Only our disposable worktree, no branch, no deletion of protected live owner state.
  # verify generates ignored run/build files; remove normally, then force ONLY this named
  # disposable checkout if generated files prevent normal removal (owner-authorized job).
  git -C "$repo" worktree remove "$checkout" 2>/dev/null || git -C "$repo" worktree remove --force "$checkout"
  rmdir "$scratch"
}
# A failed creation owns no registered worktree; remove only its empty temp directory.
if ! git -C "$repo" worktree add --detach "$checkout" main; then rmdir "$scratch"; exit 1; fi
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd "$checkout/$prefix"
unset PANDACORP_QUEUE_ATTEMPT PANDACORP_CLEANUP_SESSION PANDACORP_OWNER_RELEASE_OK PANDACORP_QUEUE_PROCESS_PROOF PANDACORP_QUEUE_PROCESS_PID PANDACORP_QUEUE_PROCESS_IDENTITY PANDACORP_HOST_SLOT_TOKEN PANDACORP_VERIFY_OWNER_PID PANDACORP_STAMP_CHECK_PID
export PANDACORP_DISABLE_TEST_EXCLUSIONS=1
export PANDACORP_VERIFY_NO_BAIL=1
# Keep setup project-native: dependency-only preparation, never a re-bless or a queue landing.
if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; fi
bash .pandacorp/verify.sh
