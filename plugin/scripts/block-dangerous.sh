#!/bin/bash
# Pandacorp PreToolUse gate: blocks dangerous bash commands in Pandacorp projects.
# Exit 2 = block (stderr shown to the model). Exit 0 = allow.

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')

# Scope: act in Pandacorp folders — a project (.pandacorp/status.yaml, incl. adopted ones) OR the factory (Pandacorp in CLAUDE.md)
if [ ! -f "$cwd/.pandacorp/status.yaml" ] && ! grep -qs "Pandacorp" "$cwd/CLAUDE.md" 2>/dev/null; then
  exit 0
fi

block() {
  echo "BLOCKED by Pandacorp policy: $1" >&2
  exit 2
}

case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf .."*) block "broad recursive delete" ;;
esac

echo "$cmd" | grep -Eq 'git push.*(--force|-f)([^-]|$)' && block "force push (constitution §11)"
echo "$cmd" | grep -Eq 'git (branch|push).*(-D|--delete).*(main|master)' && block "deleting main branch"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])gh repo delete' && block "repo deletion requires the owner (DR-007)"
echo "$cmd" | grep -Eq 'git reset --hard' && block "hard reset discards work — justify and ask"

exit 0
