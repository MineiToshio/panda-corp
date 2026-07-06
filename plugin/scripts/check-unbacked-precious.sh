#!/bin/bash
# Pandacorp "no precious file is only-gitignored" check (BL-0035 / BL-0045 line, DR-089 era).
#
# The rule the 2026-07-04 losses proved (mission-control/.pandacorp swept; then the deploy
# machinery run/*.sh swept): a gitignored path must be EITHER disposable (cheaply regenerable —
# node_modules, caches, logs) OR covered by the out-of-repo backup manifest. Nothing precious may
# live ONLY as a gitignored file. This is the enforceable, declarative form of that invariant:
#
#   flag = { gitignored entries } \ ( { disposable allowlist } ∪ { backup-manifest coverage } )
#
# Advisory by design: it NEVER fails the caller (exit 0). It prints a one-line-per-hit warning so a
# new precious-but-unbacked file is visible the moment it appears, instead of surfacing only when a
# sweep destroys it. Run standalone (bash check-unbacked-precious.sh [repo-root]) or from the backup
# script's tail. Kept in sync with backup-pandacorp-state.sh: the BACKED_UP globs below MUST mirror
# what that script actually rsyncs — a divergence is itself the bug this guards against.
set -u

ARG_ROOT="${1:-$(pwd -P)}"
COMMON_DIR="$(git -C "$ARG_ROOT" rev-parse --git-common-dir 2>/dev/null)" || exit 0
[ -n "$COMMON_DIR" ] || exit 0
case "$COMMON_DIR" in /*) : ;; *) COMMON_DIR="$ARG_ROOT/$COMMON_DIR" ;; esac
COMMON_DIR="$(cd "$COMMON_DIR" 2>/dev/null && pwd -P)" || exit 0
ROOT="$(dirname "$COMMON_DIR")"
[ -d "$ROOT" ] || exit 0

# Disposable: cheaply regenerable from tracked source, or genuine runtime noise. Losing these costs
# nothing. (Secrets live in SOPS+age out of repo; launch.json is rebuilt by worktree-bootstrap.sh.)
is_disposable() {
  case "$1" in
    */node_modules/*|node_modules/*|*/.next/*|*/dist/*|*/build/*|*/.venv/*|*/__pycache__/*) return 0 ;;
    */coverage/*|*/playwright-report/*|*/test-results/*|*/.pytest_cache/*|*/.ruff_cache/*) return 0 ;;
    .pandacorp-cache/|.pandacorp-cache/*|*/.pandacorp-cache/*) return 0 ;;      # derived idea snapshot cache
    .pandacorp/|.pandacorp/*) return 0 ;;                              # factory-ROOT runtime only (sessions/worktrees); a PROJECT overlay is */.pandacorp/* and is_backed_up covers it
    *.log|*.lock|*.tsbuildinfo|*/.DS_Store|.DS_Store|*/next-env.d.ts|*/.turbo/*) return 0 ;;
    *.env|*.env.*|*/.env|*/.env.*) return 0 ;;                         # secrets → SOPS+age, not this backstop
    .claude/*|*/.claude/*) return 0 ;;                                 # machine-local, regenerable (launch.json, worktrees, local settings)
    *.obsidian/*|.obsidian/*|*/.trash/*) return 0 ;;
    */e2e/fixtures/*) return 0 ;;                                      # test fixture runtime (e.g. the fixture factory-root ledger)
    *.html) return 0 ;;                                                # owner-facing rendered pitches (regenerable)
    *) return 1 ;;
  esac
}

# Backed up: covered by backup-pandacorp-state.sh's rsync manifest (KEEP IN SYNC with that script).
# Inside .pandacorp/run/ ONLY what the backup script actually rsyncs is covered — run/*.sh
# (backup-pandacorp-state.sh:79-80) and run/lessons.md (backup-pandacorp-state.sh:74). Everything
# else in run/ (*.log, build.lock) is disposable and falls through to is_disposable; a FUTURE
# precious non-.sh file dropped in run/ is NEITHER, so it is correctly flagged UNBACKED (the BL-0045
# failure mode: blessing all of run/ would have hidden it). Do NOT re-broaden to */.pandacorp/run/*.
is_backed_up() {
  case "$1" in
    */.pandacorp/inbox/*|*/.pandacorp/comms/*) return 0 ;;
    */.pandacorp/run/*.sh|*/.pandacorp/run/lessons.md) return 0 ;;
    */.pandacorp/status.yaml) return 0 ;;                              # backup-pandacorp-state.sh:82
    factory/profile.md|factory/portfolio.md|factory/ports.yaml|factory/gamification-ledger.json) return 0 ;;
    factory/memory/_inbox.md|factory/memory/_last-sweep|factory/ideas/*) return 0 ;;
    *) return 1 ;;
  esac
}

hits=0
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  is_disposable "$entry" && continue
  is_backed_up "$entry" && continue
  echo "  ⚠ precious & only-gitignored (not in backup manifest): $entry" >&2
  hits=$((hits+1))
# NO --directory: it collapses a wholly-ignored tree (a project's whole .pandacorp/ overlay, run/)
# to a single trailing-slash entry, which (a) matches none of the per-file rules above and (b) hides
# any precious non-.sh file nested inside run/ — the BK2/BK3 masking. Listing every file makes each
# classified on its own merits.
done < <(git -C "$ROOT" ls-files --others --ignored --exclude-standard 2>/dev/null)

if [ "$hits" -gt 0 ]; then
  echo "Pandacorp precious-file check: $hits gitignored path(s) are neither disposable nor backed up." >&2
  echo "  → add them to backup-pandacorp-state.sh's manifest, or mark them disposable if truly regenerable." >&2
fi
exit 0
