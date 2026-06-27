#!/bin/bash
# Pandacorp PreToolUse (Write|Edit) NON-BLOCKING reminder: the write-gate (DR-044).
# In a Pandacorp project, changes to product/canonical files should flow through
# a /pandacorp:* skill, not ad-hoc free-chat edits. This hook NEVER blocks (always exits 0);
# it only nudges the model when it edits a product file outside a skill.
#
# Suppressed when: not a Pandacorp project; a skill is driving the change
# (.pandacorp/run/skill-active present); or the file is in the exempt set (the whole
# .pandacorp/ integration layer, git, dependencies, build output, lockfiles, env, dotfiles).

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
file=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')

allow() { exit 0; }

# Scope: only Pandacorp projects (marker: .pandacorp/status.yaml)
[ -f "$cwd/.pandacorp/status.yaml" ] || allow

# Record this session's touched files (DR-099 attribution): the Stop gate compares the failing set
# against THIS session's edits to tell a FOREIGN red (another session's WIP in the shared checkout)
# from your own — so it can stay SILENT on a foreign-only red instead of nagging you. Recorded for
# EVERY edit (before the exempt/skill early-exits below), keyed by session_id; gitignored runtime.
sid=$(echo "$input" | jq -r '.session_id // ""')
if [ -n "$sid" ] && [ -n "$file" ]; then
  tdir="$cwd/.pandacorp/run/sessions"
  mkdir -p "$tdir" 2>/dev/null && printf '%s\n' "$file" >> "$tdir/$sid.touched" 2>/dev/null
fi

# A skill is actively driving the change → no nudge (skills may touch this marker)
[ -f "$cwd/.pandacorp/run/skill-active" ] && allow

# Nothing to judge
[ -n "$file" ] || allow

# Exempt paths: the whole .pandacorp/ integration layer (factory-managed), git, deps, build output, configs
case "$file" in
  */.pandacorp/*|*/.git/*|*/node_modules/*|*/.next/*|*/dist/*|*/build/*|*/.venv/*) allow ;;
  *.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock|*/.env*|*/.gitignore) allow ;;
esac

msg="Write-gate reminder (DR-044): you are editing a product file directly. If this change touches app behavior, a canonical doc (PRD/FRD/blueprint/ADR/DESIGN) or state, route it through the right /pandacorp:* skill (iterate / bug / decide / new-version) instead of an ad-hoc edit, so the two-layer docs, status.yaml, work-orders, TDD and review stay in sync. Exempt and fine to do directly: typos, comments, local config, throwaway experiments."

# Isolation reminder (DR-096/098, producer side): editing product CODE directly in the SHARED main
# checkout (not a worktree) outside an active build is exactly what leaves uncommitted WIP that REDs
# OTHER parallel sessions' gates. The build engine legitimately edits main in-place (DR-060), so suppress
# during an active build. A linked worktree's git-dir contains "/worktrees/"; the main checkout's does not.
git_dir=$(cd "$cwd" 2>/dev/null && git rev-parse --git-dir 2>/dev/null || echo "")
lock="$cwd/.pandacorp/run/build.lock"
build_active=$([ -f "$lock" ] && [ -n "$(find "$lock" -mmin -10 2>/dev/null)" ] && echo 1 || echo 0)
case "$git_dir" in
  */worktrees/*) : ;;                         # already isolated in a worktree → no reminder
  "") : ;;                                     # not a git repo → skip
  *)
    if [ "$build_active" = "0" ]; then
      msg="$msg

Isolation reminder (DR-096): you are editing product code in the SHARED main checkout (not a worktree), outside a build. For a NON-TRIVIAL change, isolate FIRST — call EnterWorktree, edit there, run \`bash .pandacorp/worktree-bootstrap.sh\`, and land it with \`bash .pandacorp/merge-queue.sh\` when green. Uncommitted WIP left in the shared checkout REDs other parallel sessions' gates (you saw this happen). Micro-edits (typo/comment/local config) may stay in-tree."
    fi
    ;;
esac

# Non-blocking nudge to the model (does NOT block the edit; exit 0)
jq -n --arg c "$msg" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":$c}}'
exit 0
