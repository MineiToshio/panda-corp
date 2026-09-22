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

# ── 0. Project dir resolution — Mission Control lives NESTED inside the factory's own repo (shares
# its .git; panda-corp/ itself is not an npm package), so its package.json is at
# $WORKTREE/mission-control, never at $WORKTREE's own root; every other product project's own repo
# root IS $WORKTREE. Resolve it ONCE here (steps 1 and 3 both need "the real project dir inside this
# worktree") via $WORKTREE-relative paths only, so the result never depends on the CWD this script
# happened to be invoked from.
APP_DIR=""
for candidate in "$WORKTREE/mission-control" "$WORKTREE"; do
  if [ -f "$candidate/package.json" ]; then APP_DIR="$candidate"; break; fi
done

# ── 1. Dependencies — hardlink from the shared store (never symlink node_modules; .next stays local) ─
# Idempotent (BL-0149): a re-run of this script (e.g. the gate worktree re-bootstraps on every reuse,
# ensureGateWorktree) must not pay a full reinstall when node_modules is already present and
# pnpm-lock.yaml hasn't moved since the last bootstrap in THIS worktree — skip via a lockfile-hash
# marker stored INSIDE node_modules (so a deleted node_modules always re-triggers a real install).
#
# BL-0155: this used to check bare `package.json` (CWD-relative) — correct only when the project IS
# the worktree root. For a nested project (Mission Control, the real production topology) that file
# never exists at the worktree root, so this step silently installed NOTHING (canary B2's confirmed
# root cause of `gate-worktree-not-bootstrapped`: the evidence collector correctly refused to fabricate
# a report against a worktree with no node_modules, and the gate had to bootstrap by hand, burning the
# exact cost `gateEvidence: digested` exists to avoid). Use the $APP_DIR resolved above instead.
if [ -n "$APP_DIR" ] && command -v pnpm >/dev/null 2>&1; then
  LOCK_MARKER="$APP_DIR/node_modules/.pandacorp-lock-sha"
  LOCK_SHA=""
  [ -f "$APP_DIR/pnpm-lock.yaml" ] && LOCK_SHA="$(shasum -a 256 "$APP_DIR/pnpm-lock.yaml" 2>/dev/null | awk '{print $1}')"
  if [ -d "$APP_DIR/node_modules" ] && [ -n "$LOCK_SHA" ] && [ -f "$LOCK_MARKER" ] && [ "$(cat "$LOCK_MARKER" 2>/dev/null)" = "$LOCK_SHA" ]; then
    echo "  • pnpm install skipped ($APP_DIR/node_modules present, pnpm-lock.yaml unchanged)"
  else
    echo "  • pnpm install ($APP_DIR, hardlinks from the global store)"
    ( cd "$APP_DIR" && pnpm install --prefer-offline >/dev/null 2>&1 || pnpm install )
    [ -n "$LOCK_SHA" ] && mkdir -p "$APP_DIR/node_modules" && echo "$LOCK_SHA" > "$LOCK_MARKER"
  fi
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
# Mission Control (stateless): config.ts::resolveFactoryRoot() falls back to cwd/.. when
#   PANDACORP_FACTORY_ROOT is unset, which in a fresh worktree resolves to this worktree's own
#   near-empty factory/ (gitignored files like profile.md/portfolio.md aren't checked out) and trips
#   the onboarding gate. Write a worktree-local .env.local pointing at the main checkout instead.
# BL-0155: reuses the SAME $APP_DIR resolved in step 0 (was its own duplicate search loop) — one
# resolution, two consumers.
if [ -n "$APP_DIR" ] && { grep -q '"name": *"pandacorp"' "$WORKTREE/package.json" 2>/dev/null \
   || [ -d "$WORKTREE/../factory" ] || [ -d "$WORKTREE/factory" ]; }; then
  echo "  • PANDACORP_FACTORY_ROOT → $MAIN_WT ($APP_DIR/.env.local, gitignored)"
  echo "PANDACORP_FACTORY_ROOT=$MAIN_WT" > "$APP_DIR/.env.local"
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
