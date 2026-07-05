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

# Protected state paths (BL-0035, incident 2026-07-04: mission-control/.pandacorp wiped, the
# gitignored inbox lost for good — no git history by design). A recursive delete or an
# ignored-files clean aimed at the owner/state layer is NEVER routine: these paths are
# append-only/managed (archive to done/, never rm). If genuinely needed, the OWNER runs it.
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+)+[^;&|]*(\.pandacorp|factory/(ideas|memory|profile|portfolio))'; then
  block "recursive delete on a protected Pandacorp state path (.pandacorp/, factory/{ideas,memory,profile,portfolio}) — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
fi
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+clean[[:space:]][^;&|]*-[a-zA-Z]*x'; then
  block "git clean -x removes gitignored files — the .pandacorp state layer (inbox/comms) would be lost with no git history; use plain 'git clean -fd' (keeps ignored) or ask the owner (BL-0035)"
fi

echo "$cmd" | grep -Eq 'git push.*(--force|-f)([^-]|$)' && block "force push (constitution §11)"
echo "$cmd" | grep -Eq 'git (branch|push).*(-D|--delete).*(main|master)' && block "deleting main branch"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])gh repo delete' && block "repo deletion requires the owner (DR-007)"

# Hard reset: allow ONLY the engine's sanctioned recovery form — an explicit hex SHA target
# (`git reset --hard <sha>`, the DR-065/DR-067 restore-to-last_green_sha path, which the engine
# precedes with a merge-base ancestry check). Everything else (bare, HEAD~N, a branch/remote ref)
# stays blocked: those are the destructive human-mistake forms. (audit-20 owner decision 1 — the old
# blanket block made the engine's own overnight recovery un-executable.)
if echo "$cmd" | grep -Eq 'git reset --hard'; then
  echo "$cmd" | grep -Eq 'git reset --hard[[:space:]]+[0-9a-f]{7,40}([[:space:]]|$)' \
    || block "hard reset discards work — only 'git reset --hard <explicit-sha>' (the last_green_sha recovery, DR-067) is allowed; anything else: justify and ask"
fi

# Production deploys are behind the DR-004 HUMAN GATE — mechanically, not just in prose (audit-20 P1-5;
# infra.md says human gates ship as hard rules, this is that rule). The agent presents the summary and
# the OWNER approves; only after explicit approval in the conversation does the deploy run (re-running
# the exact command after the owner's OK is the approved path — the block message says so).
echo "$cmd" | grep -Eq '(^|[[:space:];&|])vercel( .*)? (--prod|deploy .*--prod)' && block "production deploy = human gate (DR-004): present staging + costs, get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])(flyctl|fly) deploy' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])railway (up|deploy)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])wrangler (deploy|publish)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"

exit 0
