#!/bin/bash
# Pandacorp — change rigor classifier (entry point).
#
# Derives `rigor ∈ {micro, normal, critical}` for a change from 17 deterministic signals
# (memo docs/proposals/37 §A.2, red-teamed in j1 §3.b/§4.2). The level decides how much EVIDENCE a
# change collects — never whether a red gate blocks. An LLM may ESCALATE the result with a written
# reason; nothing may lower it.
#
# The signal logic lives in the sibling `classify-change.mjs` (the floor is ~40 regexes with
# per-file scoping; bash 3.2 cannot hold that legibly, and an illegible floor is a missing floor).
# This wrapper owns the contract: arguments, the JSON on stdout, and the exit code.
#
# Usage:
#   classify-change.sh --repo <path> (--range <base>..<head> | --staged | --worktree | --files <list>)
#                      [--card <path.md>] [--wo <path.md>] [--attempts <n>]
#
#   --range     classify a committed range
#   --staged    classify the index
#   --worktree  classify every uncommitted change (tracked + untracked) against HEAD
#   --files     classify a comma/newline-separated path list; carries no diff body, so it can
#               never certify `micro` (fail-closed)
#   --card      change card: reads `rebuilds_verified` (S10) and `supersedes` (S11)
#   --wo        work order:  reads `difficulty` and `reopen_count` (S12)
#   --attempts  how many times this change's gate already went red (S16 raises one level)
#
# Output (stdout, one line of JSON):
#   {"rigor":"micro|normal|critical","reasons":[{"signal":"S5","detail":"..."}],
#    "floor_hits":[...],"stats":{"files":n,"added":n,"deleted":n,"new_files":n},"notes":[...]}
#
# Exit 0 when it classified. ANY failure — unreadable repo, git error, empty/illegible diff,
# missing runtime, bad usage — exits non-zero AND prints a `critical` verdict with a FAILCLOSED
# reason: a broken classifier must never be the reason a change ran cheap (j1 §4.2).

set -uo pipefail

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
ENGINE="$HERE/classify-change.mjs"

fail_closed() {
  printf '{"rigor":"critical","reasons":[{"signal":"FAILCLOSED","level":"critical","detail":"%s"}],"floor_hits":[{"signal":"FAILCLOSED","level":"critical","detail":"%s"}],"stats":{"files":0,"added":0,"deleted":0,"new_files":0},"notes":[]}\n' "$1" "$1"
  exit "${2:-9}"
}

command -v node >/dev/null 2>&1 || fail_closed "node is not available — the classifier cannot run" 9
[ -f "$ENGINE" ] || fail_closed "classifier engine missing at ${ENGINE}" 9
command -v git >/dev/null 2>&1 || fail_closed "git is not available — the classifier cannot read a diff" 9

out=$(node "$ENGINE" "$@" 2>/dev/null)
rc=$?

# A verdict is only a verdict if it parsed. Anything else (a node crash, an empty stdout) is
# indistinguishable from "no classification", and that means critical.
case "$out" in
  *'"rigor"'*) printf '%s\n' "$out"; exit "$rc" ;;
  *) fail_closed "classifier produced no parsable verdict (exit ${rc})" 9 ;;
esac
