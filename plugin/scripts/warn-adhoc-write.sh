#!/bin/bash
# Pandacorp PreToolUse (Write|Edit) NON-BLOCKING reminder: the write-gate (DR-044) +
# isolation nudge (DR-096/099).
#
# Two separate concerns with different scopes:
#   1. Write-gate reminder (DR-044) — route canonical doc changes through a /pandacorp:* skill.
#      Scope: Pandacorp PROJECTS only (marker: .pandacorp/status.yaml).
#   2. Isolation reminder (DR-096) + session attribution (DR-099) — don't leave WIP in the
#      shared main checkout; isolate first with EnterWorktree.
#      Scope: ANY Pandacorp-managed repo (projects AND the factory itself). The factory is
#      identified by factory/constitution.md; projects by .pandacorp/status.yaml.
#
# This hook NEVER blocks (always exits 0); it only nudges the model.
# Suppressed when: a skill is driving the change (.pandacorp/run/skill-active present);
# or the file is in the exempt set (the whole .pandacorp/ integration layer, git,
# dependencies, build output, lockfiles, env, dotfiles).

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
file=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')

allow() { exit 0; }

# Resolve the repo root from the git toplevel so a session parked in a SUBDIR (mission-control/,
# plugin/) is still recognized as its Pandacorp repo — a non-blocking guard that never fires from a
# subdir trains nobody (WS-A F11; the blocking gates got the same cwd-vs-toplevel fix). All repo
# markers + the runtime-state paths below anchor to $root, never the raw cwd.
root=$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || echo "$cwd")

# Detect scope: project, factory, or neither
is_project=0
is_factory=0
[ -f "$root/.pandacorp/status.yaml" ] && is_project=1
[ -f "$root/factory/constitution.md" ] && is_factory=1

# Not a Pandacorp-managed repo at all → nothing to do
[ "$is_project" = "1" ] || [ "$is_factory" = "1" ] || allow

# Record this session's touched files (DR-099 attribution): the Stop gate compares the failing set
# against THIS session's edits to tell a FOREIGN red (another session's WIP in the shared checkout)
# from your own — so it can stay SILENT on a foreign-only red instead of nagging you. Recorded for
# EVERY edit (before the exempt/skill early-exits below), keyed by session_id; gitignored runtime.
sid=$(echo "$input" | jq -r '.session_id // ""')
if [ -n "$sid" ] && [ -n "$file" ]; then
  tdir="$root/.pandacorp/run/sessions"
  mkdir -p "$tdir" 2>/dev/null && printf '%s\n' "$file" >> "$tdir/$sid.touched" 2>/dev/null
fi

# A skill is actively driving the change → no nudge (skills may touch this marker)
[ -f "$root/.pandacorp/run/skill-active" ] && allow

# Nothing to judge
[ -n "$file" ] || allow

# Exempt paths: the whole .pandacorp/ integration layer (factory-managed), git, deps, build output, configs
case "$file" in
  */.pandacorp/*|*/.git/*|*/node_modules/*|*/.next/*|*/dist/*|*/build/*|*/.venv/*) allow ;;
  *.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock|*/.env*|*/.gitignore) allow ;;
esac

msg=""

# Write-gate reminder (DR-044) — only in Pandacorp PROJECTS (not the factory itself)
if [ "$is_project" = "1" ]; then
  msg="Write-gate reminder (DR-044): you are editing a product file directly. If this change touches app behavior, a canonical doc (PRD/FRD/blueprint/ADR/DESIGN) or state, route it through the right /pandacorp:* skill (iterate / bug / decide / new-version) instead of an ad-hoc edit, so the two-layer docs, status.yaml, work-orders, TDD and review stay in sync. Exempt and fine to do directly: typos, comments, local config, throwaway experiments."
fi

# Isolation reminder (DR-096/099, producer side): editing code directly in the SHARED main checkout
# (not a worktree) leaves uncommitted WIP that REDs OTHER parallel sessions' gates.
# Applies to projects AND the factory's GATED surfaces — but NOT to factory-only prose (BL-0033):
# the factory repo runs no whole-program gate over factory/ or plugin/**/*.md prose, so a doc/
# standard/skill-text edit there carries no cross-session-red risk and the nudge would only train
# the operator to rationalize past it. Factory paths that DO ship to projects or execute (scripts,
# hooks, templates, the build engine, mission-control/) still warrant the nudge.
# The build engine legitimately edits main in-place (DR-060), so suppress during an active build.
# A linked worktree's git-dir contains "/worktrees/"; the main checkout's does not.
skip_isolation=0
if [ "$is_factory" = "1" ] && [ "$is_project" = "0" ]; then
  case "$file" in
    */plugin/scripts/*|*/plugin/hooks/*|*/plugin/templates/*|*/mission-control/*) : ;; # gated/shipped → keep nudge
    */factory/*|*/docs/*|*/plugin/*|*/.claude/*|*.md|*.base|*/ideas.base) skip_isolation=1 ;;    # factory prose/config → no nudge
  esac
fi
git_dir=$(cd "$root" 2>/dev/null && git rev-parse --git-dir 2>/dev/null || echo "")
lock="$root/.pandacorp/run/build.lock"
build_active=$([ -f "$lock" ] && [ -n "$(find "$lock" -mmin -10 2>/dev/null)" ] && echo 1 || echo 0)
# Landing instruction differs by repo: projects land via the merge queue; the factory has NO
# merge queue (direct-to-main is the protocol, constitution §11) — merge the worktree branch back.
land_hint="land it with \`bash .pandacorp/merge-queue.sh\` when green"
[ "$is_project" = "0" ] && land_hint="merge the worktree branch back to main when green (the factory has no merge queue; direct-to-main, constitution §11)"
case "$git_dir" in
  */worktrees/*) : ;;   # already isolated in a worktree → no reminder
  "") : ;;              # not a git repo → skip
  *)
    if [ "$build_active" = "0" ] && [ "$skip_isolation" = "0" ]; then
      isolation_msg="Isolation reminder (DR-096): you are editing in the SHARED main checkout (not a worktree), outside a build. For a NON-TRIVIAL change, isolate FIRST — call EnterWorktree, edit there, and $land_hint. Uncommitted WIP left in the shared checkout REDs other parallel sessions' gates (this is exactly the failure that blocked a merge in a sibling session). Micro-edits (typo/comment/local config) may stay in-tree."
      if [ -n "$msg" ]; then
        msg="$msg

$isolation_msg"
      else
        msg="$isolation_msg"
      fi
    fi
    ;;
esac

# Non-blocking nudge to the model (does NOT block the edit; exit 0)
[ -n "$msg" ] && jq -n --arg c "$msg" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":$c}}'
exit 0
