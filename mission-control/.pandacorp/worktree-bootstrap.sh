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
if [ -f "$MAIN_WT/.claude/launch.json" ] && command -v jq >/dev/null 2>&1; then
  echo "  • launch.json → autoPort (name suffix -$SLUG)"
  mkdir -p "$WORKTREE/.claude"
  jq --arg s "$SLUG" '
    # drop a "--port"/"-p" flag AND the value token right after it
    def strip_port:
      . as $a
      | [ range(0; length) as $i
          | select(($a[$i] != "--port") and ($a[$i] != "-p")
                   and (($i == 0) or (($a[$i-1] != "--port") and ($a[$i-1] != "-p"))))
          | $a[$i] ];
    .configurations |= map(
      .name = "\(.name)-\($s)"
      | .autoPort = true                                   # OS assigns a free $PORT
      | del(.port)                                         # no fixed port field
      | if .runtimeArgs then .runtimeArgs |= strip_port else . end
    )' "$MAIN_WT/.claude/launch.json" > "$WORKTREE/.claude/launch.json" 2>/dev/null \
    || cp "$MAIN_WT/.claude/launch.json" "$WORKTREE/.claude/launch.json"
fi

# ── 3. Secrets & data are REFERENCED, not copied ────────────────────────────────────────────────────
# Secrets: SOPS+age lives outside any repo (~/.config/pandacorp/) — the worktree runs the same
#   `sops exec-env ...` as the main checkout; nothing to bootstrap here.
# Mission Control (stateless): point at the real factory so reads hit live data, not the empty cwd/..
if grep -q '"name": *"pandacorp"' "$WORKTREE/package.json" 2>/dev/null \
   || [ -d "$WORKTREE/../factory" ] || [ -d "$WORKTREE/factory" ]; then
  : # MC/factory worktree — the runner exports PANDACORP_FACTORY_ROOT; see the project overlay.
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
