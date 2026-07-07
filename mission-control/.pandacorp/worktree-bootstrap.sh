#!/bin/bash
# Pandacorp worktree bootstrap (DR-096) — reconstitute everything a fresh git worktree does NOT carry
# (git checks out tracked files only: no node_modules, no gitignored .claude/launch.json, no secrets).
# Run it ONCE right after entering a fresh worktree, before editing.
#
# It is cheap by design: pnpm hardlinks from the shared store (sub-second), secrets are referenced not
# copied (SOPS lives outside the repo), data is referenced not copied (PANDACORP_FACTORY_ROOT). A project
# with its own state (a DB) adds the heavy bit in the per-project hook `.pandacorp/worktree-setup.sh`.
set -euo pipefail

WORKTREE="$(git rev-parse --show-toplevel)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
MAIN_WT="$(dirname "$COMMON_DIR")"                       # the .git's parent = the main checkout
SLUG="$(echo "$BRANCH" | tr '/' '-' | tr -cd '[:alnum:]-')"

echo "▸ bootstrapping worktree $BRANCH"

# ── 1. Dependencies — hardlink from the shared store (never symlink node_modules; .next stays local) ─
if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
  echo "  • pnpm install (hardlinks from the global store)"
  pnpm install --prefer-offline >/dev/null 2>&1 || pnpm install
fi

# ── 2. launch.json on autoPort — gitignored, so copy the main one and flip ephemeral ports ──────────
# Every app server in the worktree runs on an OS-assigned port (autoPort), named *-<slug>, so N parallel
# worktrees never collide on a fixed port. The main checkout keeps its reserved ports untouched.
# CRUCIAL: also RETARGET the absolute paths in runtimeArgs (the value after `-C`/`--directory`) that point
# into the MAIN checkout ($MAIN_WT/...) so servers serve the WORKTREE's own copy — otherwise `next dev` /
# `http.server` silently serve the main repo's code/content, missing whatever this session is editing.
# Out-of-repo paths (a /tmp scratchpad, etc.) are NOT under $MAIN_WT and are left untouched.
if [ -f "$MAIN_WT/.claude/launch.json" ] && command -v jq >/dev/null 2>&1; then
  echo "  • launch.json → autoPort (name suffix -$SLUG) + retarget paths to worktree"
  mkdir -p "$WORKTREE/.claude"
  jq --arg s "$SLUG" --arg m "$MAIN_WT" --arg w "$WORKTREE" '
    # drop a "--port"/"-p" flag AND the value token right after it
    def strip_port:
      . as $a
      | [ range(0; length) as $i
          | select(($a[$i] != "--port") and ($a[$i] != "-p")
                   and (($i == 0) or (($a[$i-1] != "--port") and ($a[$i-1] != "-p"))))
          | $a[$i] ];
    # rewrite a path token that lives under the MAIN checkout to the same path under this worktree
    def retarget:
      if (type == "string") and startswith($m + "/") then $w + .[($m|length):] else . end;
    .configurations |= map(
      .name = "\(.name)-\($s)"
      | .autoPort = true                                   # OS assigns a free $PORT
      | del(.port)                                         # no fixed port field
      | if .runtimeArgs then .runtimeArgs |= (map(retarget) | strip_port) else . end
    )' "$MAIN_WT/.claude/launch.json" > "$WORKTREE/.claude/launch.json" 2>/dev/null \
    || cp "$MAIN_WT/.claude/launch.json" "$WORKTREE/.claude/launch.json"
fi

# ── 3. Secrets & data are REFERENCED, not copied ────────────────────────────────────────────────────
# Secrets: SOPS+age lives outside any repo (~/.config/pandacorp/) — the worktree runs the same
#   `sops exec-env ...` as the main checkout; nothing to bootstrap here.
# Mission Control (stateless): config.ts::resolveFactoryRoot() falls back to cwd/.. when
#   PANDACORP_FACTORY_ROOT is unset, which in a fresh worktree resolves to this worktree's own
#   near-empty factory/ (gitignored files like profile.md/portfolio.md aren't checked out) and trips
#   the onboarding gate. Write a worktree-local .env.local pointing at the main checkout instead.
if grep -q '"name": *"pandacorp"' "$WORKTREE/package.json" 2>/dev/null \
   || [ -d "$WORKTREE/../factory" ] || [ -d "$WORKTREE/factory" ]; then
  for APP_DIR in "$WORKTREE/mission-control" "$WORKTREE"; do
    if [ -f "$APP_DIR/package.json" ]; then
      echo "  • PANDACORP_FACTORY_ROOT → $MAIN_WT ($APP_DIR/.env.local, gitignored)"
      echo "PANDACORP_FACTORY_ROOT=$MAIN_WT" > "$APP_DIR/.env.local"
      break
    fi
  done
fi

# ── 4. Per-project hook — stateful projects clone their DB here (CREATE DATABASE ... TEMPLATE, §4) ───
if [ -x "$WORKTREE/.pandacorp/worktree-setup.sh" ]; then
  echo "  • project hook .pandacorp/worktree-setup.sh"
  PANDACORP_WORKTREE_SLUG="$SLUG" bash "$WORKTREE/.pandacorp/worktree-setup.sh"
fi

# ── 5. Manifest entry (DR-096 §7) — written to the MAIN checkout so every session + MC can read it ──
MANIFEST_DIR="$MAIN_WT/.pandacorp/run/worktrees"
mkdir -p "$MANIFEST_DIR"
cat > "$MANIFEST_DIR/$SLUG.json" <<EOF
{
  "branch": "$BRANCH",
  "path": "$WORKTREE",
  "slug": "$SLUG",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "task": "${PANDACORP_WORKTREE_TASK:-}"
}
EOF

echo "▸ worktree ready. Other active worktrees:"
ls "$MANIFEST_DIR" 2>/dev/null | sed 's/\.json$//' | sed 's/^/    - /' || true
