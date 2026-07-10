#!/usr/bin/env bash
# Pandacorp DR-045 preflight drift gate (BL-0042; canonicalizes the near-copy preflight
# blocks that PROMPT-7/audit-20 flagged as sweep-decay — divergent copies mean a future
# change to the preflight lands in some carriers but not others).
#
# WHAT THIS GUARDS
# The DR-045 preflight callout in the change-family skills carries two SAFETY-CRITICAL
# invariant spans that MUST stay byte-identical across every carrier. This script is the
# canonical HOME of those spans (the single source of truth) AND the RED-on-drift check.
#
#   A1 — marker check + adopt/spec routing (the fail-closed "is this a factory project?"
#        gate). Byte-identical in: change, bug, iterate, new-version, release.
#        `sync` is the ONE documented variance: it prepends a *modo fábrica* branch
#        (route hand-edits under plugin/ or factory/ to /pandacorp:learn), so its
#        marker-routing text legitimately differs — A1 is NOT asserted for sync (BL-0042
#        "sync's variant adds a justified modo-fábrica branch").
#
#   A2 — upgrade-if-behind + the active-build guard (never regenerate the engine/gates
#        under a live build; DR-048/DR-066). Byte-identical in ALL carriers: change, bug,
#        iterate, new-version, sync, release. C8 (this batch) added the guard to
#        new-version, sync and release so it is now universal, not just the capture family.
#
# The per-skill VARIANCE — the "what this skill writes/mutates" lead-in and the
# capture-proceeds-anyway vs mutate-routes-to-/change follow-on — is intentionally NOT
# checked here (that is the documented variance BL-0042 allows).
#
# CARRIERS NOT IN THIS SET: architecture and implement also carry a DR-045 marker check,
# but they are out of THIS canonicalization's scope (architecture is a pre-build phase
# skill; implement IS the build engine — its preflight is co-owned by preflight-implement.sh
# and cannot "route around" a build it is itself launching). They are deliberately excluded;
# adopt is NOT a carrier (it uses its own human-gate idempotence flow, no DR-045 callout).
#
# EXIT: 0 = every asserted invariant present byte-identical in every carrier.
#       1 = drift (a carrier is missing an invariant span, verbatim) OR a carrier file is
#           missing/unreadable (FAIL-CLOSED — a missing carrier is never a silent pass).
#
# Usage: bash plugin/scripts/check-preflight-drift.sh [repo-root]

set -u

ROOT="${1:-$PWD}"
ROOT=$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT")
SKILLS="$ROOT/plugin/skills"

# ---- Canonical invariant spans ----
# Single-quoted heredoc delimiter → the body (backticks, $, apostrophes) is 100% literal.
# `read -r -d ''` (not command substitution) sidesteps the heredoc-in-$() parsing quirk.
# Each body is one line; strip the trailing newline the heredoc adds so grep -F matches.
IFS= read -r -d '' A1 <<'EOF'
so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one.
EOF
A1="${A1%$'\n'}"

IFS= read -r -d '' A2 <<'EOF'
Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) — **but if a build is running (`running: true` + fresh `supervisor_heartbeat`) do NOT run `/pandacorp:upgrade` mid-build: it must never regenerate the engine/gates under a live build (its own active-build guard also refuses).**
EOF
A2="${A2%$'\n'}"

# Carriers per anchor.
A1_CARRIERS="change bug iterate new-version release"
A2_CARRIERS="change bug iterate new-version sync release"

drift=0

assert_anchor() {
  local skill="$1" name="$2" anchor="$3"
  local file="$SKILLS/$skill/SKILL.md"
  if [ ! -r "$file" ]; then
    echo "DRIFT: $skill/SKILL.md missing or unreadable (FAIL-CLOSED)" >&2
    drift=1
    return
  fi
  if ! grep -Fq -- "$anchor" "$file"; then
    echo "DRIFT: $skill/SKILL.md does not carry the byte-identical $name preflight span" >&2
    drift=1
  fi
}

for s in $A1_CARRIERS; do assert_anchor "$s" "A1(marker-routing)" "$A1"; done
for s in $A2_CARRIERS; do assert_anchor "$s" "A2(upgrade+active-build-guard)" "$A2"; done

if [ "$drift" -ne 0 ]; then
  echo "" >&2
  echo "Preflight drift detected. The canonical spans live in this script (A1/A2)." >&2
  echo "Re-sync the drifted carrier(s) to the byte-identical span, or update the canonical" >&2
  echo "span here AND every carrier in the same change (BL-0042)." >&2
  exit 1
fi

echo "preflight-drift: OK — A1 byte-identical across [$A1_CARRIERS]; A2 across [$A2_CARRIERS]"
exit 0
