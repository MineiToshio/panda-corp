#!/usr/bin/env bash
# Doc-structure lint (DR-077, greenfield fail-closed subset BL-0009). ADVISORY by DEFAULT: it
# REPORTS drift and exits 0, so it never red-locks an existing or adopted project whose stable-ID
# spine is partial (the DR-074/075 retrofit lesson + the research finding that over-strict gates
# get disabled). It surfaces, during the gate, docs that drift from the template contract:
#   - required frontmatter keys on FRD / work-order docs   [HARD-ELIGIBLE — structural, deterministic]
#   - a PRD without a `type`                                [HARD-ELIGIBLE — structural, deterministic]
#   - a work order citing a REQ-NN-MMM defined in NO FRD    [SOFT — cross-FRD citations are fine,
#     this is a heuristic cross-reference check, noisier and more likely to false-positive]
#   - a UI FRD (ui: true) with NO design oracle             [SOFT — DR-091, depends on judgment calls
#     about what counts as a real mock / visual_source]
#   - retired lifecycle vocabulary — `phase: operation` (or `operation` named as a lifecycle phase)
#     outside a decision log: DR-085 folded the old `operation` phase into `release` (BL-0008); a doc
#     that reintroduces it as a current phase has drifted from the DR-085 lifecycle. [SOFT — always
#     advisory, not eligible for greenfield fail-closed]
#   - status.yaml keys not declared by the canonical template  [SOFT — DR-115 schema drift: a fact
#     with a writer but no schema home, the `last_harvest` class]
# GREENFIELD FAIL-CLOSED (BL-0009): a project born via `/pandacorp:scaffold` (`.pandacorp/status.yaml`
# `created_via: scaffold`) is expected to carry a COMPLETE doc spine from birth, so the HARD-ELIGIBLE
# findings above become fail-closed for it — a missing frontmatter key is a real defect, not drift to
# tolerate. Brownfield/adopted projects (`created_via: adopt`, or the field ABSENT — an older overlay,
# a pre-BL-0009 project) stay fully advisory forever: exit 0 no matter what. SOFT findings NEVER gate,
# on any project — they stay advisory-only, exactly as before this change.
# A project with no docs/ is a vacuous pass. Run from the project root; verify.sh invokes it.
# By default it prints a one-line summary; run `.pandacorp/doc-lint.sh -v` for the per-finding list.
# Managed by Pandacorp — re-synced by /pandacorp:upgrade. Don't hand-edit.
set -uo pipefail

# GREENFIELD DETECTION: read `created_via` from status.yaml the same hand-rolled way the stack
# template reads target_platforms/deploy_target (e2e/_target.ts) — no YAML dependency, one line.
# ANY ambiguity (file missing, key missing, unrecognized value) resolves to advisory — a doc-lint
# reader must never GUESS its way into fail-closed (mirrors DR-074's back-fill: absence => the safe
# default, never the strict one).
GREENFIELD=0
if [ -f .pandacorp/status.yaml ]; then
  created_via=$(grep -E '^created_via:' .pandacorp/status.yaml 2>/dev/null | head -1 | sed -E 's/^created_via:[[:space:]]*"?([a-z]*)"?.*/\1/' || true)
  if [ "$created_via" = "scaffold" ]; then GREENFIELD=1; fi
fi

# EXIT CONTRACT GUARD: brownfield/no-provenance NEVER gates (always exit 0, whatever happens below).
# A reader that closes a pipe early (`grep -q`, `head -1`) can SIGPIPE its writer; under `pipefail`
# that could otherwise kill the script before its intended exit. The trap makes the brownfield
# always-0 contract robust no matter how the script terminates; on greenfield it defers to the exit
# code already set by the final `exit` call (see bottom).
if [ "$GREENFIELD" != 1 ]; then trap 'exit 0' EXIT; fi

VERBOSE=0
if [ "${1:-}" = "-v" ] || [ "${1:-}" = "--verbose" ]; then VERBOSE=1; fi

[ -d docs ] || exit 0

count=0
hard_count=0
findings=""
warn() {
  count=$((count + 1))
  findings="${findings}  • $1"$'\n'
  if [ "$VERBOSE" = 1 ]; then echo "⚠ doc-lint: $1"; fi
}
# A HARD-ELIGIBLE finding — structural/deterministic (missing frontmatter key, PRD without `type`).
# Counted separately so only THESE can flip the exit code, and only on a greenfield project.
warn_hard() {
  hard_count=$((hard_count + 1))
  warn "$1"
}

# Print the YAML frontmatter block (between the first two `---` lines).
frontmatter() { awk '/^---[[:space:]]*$/{c++; next} c==1{print} c>=2{exit}' "$1"; }
has_key() { frontmatter "$1" | grep -qE "^$2:"; }

# PRD — should carry a type. HARD-ELIGIBLE: deterministic key presence.
if [ -f docs/product/prd.md ]; then
  has_key docs/product/prd.md type || warn_hard "docs/product/prd.md missing frontmatter key 'type'"
fi

# Root README (DR-112/DOC-3) — must exist; once the PRD exists, `spec` is expected to have replaced
# the scaffold placeholder with real content. HARD-ELIGIBLE: both checks are deterministic presence/
# marker checks, no judgment involved.
if [ -f README.md ]; then
  if [ -f docs/product/prd.md ] && grep -q 'PANDACORP-README-PLACEHOLDER' README.md 2>/dev/null; then
    warn_hard "README.md still carries the scaffold placeholder (PANDACORP-README-PLACEHOLDER) even though docs/product/prd.md exists — /pandacorp:spec should have populated it (DR-112)"
  fi
else
  warn_hard "README.md is missing at the project root (DR-112 — every project needs a populated root README)"
fi

# FRDs — required frontmatter keys (HARD-ELIGIBLE) + UI-FRD design-oracle completeness (SOFT, DR-091).
for frd in docs/frds/frd-*/frd.md; do
  [ -f "$frd" ] || continue
  for k in id type status implementation_status; do
    has_key "$frd" "$k" || warn_hard "$frd missing frontmatter key '$k'"
  done
  # A UI FRD (ui: true) MUST have a design oracle (DR-056/091) — the thing whose absence let
  # Mission Control ship 17 un-sharded surfaces that the per-route fidelity check then silently
  # skipped. Require: an fdd.md (the feature design doc) AND a real per-FRD mock OR a visual_source.
  if frontmatter "$frd" | grep -qE "^ui:[[:space:]]*true"; then
    dir=$(dirname "$frd")
    [ -f "$dir/fdd.md" ] || warn "$frd is ui:true but has no fdd.md (DR-056 feature design missing)"
    # `… | head -1` makes find SIGPIPE; under `set -o pipefail` that fails the assignment and (with
    # `set -e`) would kill this ADVISORY script before its `exit 0`. Guard with `|| true` so a missing
    # mocks/ dir stays a warning, never a gate-breaking crash (doc-lint must ALWAYS exit 0).
    real_mock=$(find "$dir/mocks" -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o -name '*.html' \) 2>/dev/null | head -1 || true)
    if [ -z "$real_mock" ] && ! has_key "$frd" visual_source; then
      warn "$frd is ui:true but has NO design oracle: empty mocks/ and no visual_source (DR-091 — the per-route fidelity check will no-op; shard the prototype or generate mocks)"
    fi
  fi
done

# Work orders — required frontmatter (HARD-ELIGIBLE) + every cited REQ defined in SOME FRD (SOFT,
# cross-FRD citations are fine — this is a heuristic cross-reference, not a structural presence check).
all_reqs=$(grep -rhoE 'REQ-[0-9]{2}-[0-9]{3}' docs/frds/*/frd.md 2>/dev/null | sort -u || true)
for wo in docs/frds/frd-*/work-orders/wo-*.md; do
  [ -f "$wo" ] || continue
  for k in id type implementation_status parent; do
    has_key "$wo" "$k" || warn_hard "$wo missing frontmatter key '$k'"
  done
  reqs=$(frontmatter "$wo" | grep -oE 'REQ-[0-9]{2}-[0-9]{3}' | sort -u || true)
  for req in $reqs; do
    printf '%s\n' "$all_reqs" | grep -qx "$req" || warn "$wo cites $req, defined in no FRD"
  done
done

# Retired lifecycle vocabulary (DR-085/BL-0008) — `operation` reintroduced as a CURRENT phase value,
# outside a decision log / review (decision logs and reviews legitimately narrate the RETIRED phase or
# discuss old code/mutants as history — e.g. "the old `operation` phase is folded into `release`" or a
# mutation-test review quoting a stale `stage === "operation"` — so both are excluded, not scanned as
# drift). Two concrete drift shapes: (1) `phase: operation` as a literal frontmatter/YAML value, and
# (2) `operation` still listed as a value in the product|design|architecture|implementation|release
# pipeline enum. Scoped to docs/ (this lint's whole domain); decision-log.md and docs/reviews/ are skipped.
# SOFT — always advisory, not eligible for greenfield fail-closed (BL-0009): a reintroduced vocabulary
# drift is not the same class of defect as a missing frontmatter key.
while IFS= read -r -d '' f; do
  case "$f" in */decision-log.md|*/reviews/*) continue ;; esac
  if grep -qE '^[[:space:]]*phase:[[:space:]]*"?operation"?([[:space:]]|$)' "$f" \
    || grep -qE '(product|design|architecture|implementation|release)([[:space:]]*\|[[:space:]]*(product|design|architecture|implementation|release|operation)){1,}[[:space:]]*\|[[:space:]]*operation\b' "$f" \
    || grep -qE '\boperation[[:space:]]*\|[[:space:]]*(product|design|architecture|implementation|release)\b' "$f"; then
    warn "$f reintroduces retired lifecycle vocabulary: \`operation\` as a phase (DR-085 folded it into \`release\`; BL-0008)"
  fi
done < <(find docs -type f -name '*.md' -print0 2>/dev/null)

# status.yaml schema drift (DR-115 single-source-of-truth, SOFT — always advisory). A key written to
# status.yaml that the canonical template doesn't declare is a fact with a writer but no schema home
# (the `last_harvest` class of drift): skills write/read it while the contract pretends it doesn't
# exist. KNOWN_KEYS is an HONEST CACHE of plugin/templates/shared/.pandacorp/status.yaml.tpl (plus the
# optional launch-time keys `deploy_target`/`deploy_url` that /pandacorp:release adds, DR-085): both
# files ship from the same template dir and are re-synced TOGETHER by /pandacorp:upgrade — update the
# list when the template changes.
KNOWN_KEYS="project phase version target_platforms overlay_version created_with created_via running run_started_at supervisor_heartbeat last_event_at repo dev_port_base updated_at work_orders_total work_orders_done pending_decisions rethink_pending advance_pending last_green_sha safe_to_test last_harvest deploy_target deploy_url"
if [ -f .pandacorp/status.yaml ]; then
  status_keys=$(grep -oE '^[a-z_]+:' .pandacorp/status.yaml 2>/dev/null | sed 's/:$//' | sort -u || true)
  for sk in $status_keys; do
    case " $KNOWN_KEYS " in
      *" $sk "*) ;;
      *) warn ".pandacorp/status.yaml carries key '$sk' not declared by the canonical template — a fact with a writer but no schema home; declare it in status.yaml.tpl (+ this list) or stop writing it (DR-115 schema drift)" ;;
    esac
  done
fi

# Loud, ACTIONABLE report (owner directive 2026-06-30): findings are surfaced PROMINENTLY and the
# agent is told to FIX them proactively in this same pass — not merely note them. On brownfield/
# no-provenance this NEVER blocks (exit 0, guaranteed by the EXIT trap above). On a GREENFIELD project
# (created_via: scaffold) a HARD-ELIGIBLE finding (missing frontmatter key / PRD without `type`) now
# FAILS the gate (BL-0009) — a greenfield project is expected to be born with a complete spine, so
# this is a real defect, not tolerated drift; SOFT findings (REQ cross-reference, UI design-oracle,
# retired-vocabulary reintroduction) stay advisory even on greenfield.
if [ "$count" -gt 0 ]; then
  if [ "$VERBOSE" != 1 ]; then printf '%s' "$findings"; fi   # in -v mode each line was already printed
  echo "════════════════════════════════════════════════════════════════════════"
  if [ "$GREENFIELD" = 1 ] && [ "$hard_count" -gt 0 ]; then
    echo "✗ DOC-LINT: $count finding(s) ($hard_count FAIL-CLOSED — greenfield doc spine incomplete)."
    echo "    This project was born via /pandacorp:scaffold (created_via: scaffold), so structural"
    echo "    findings (missing frontmatter keys, a PRD without 'type') BLOCK the gate. FIX them now"
    echo "    — correct the missing frontmatter keys — then re-run. Other findings stay advisory."
  else
    echo "⚠️  DOC-LINT: $count advisory finding(s) — frontmatter / REQ-ID-spine drift."
    echo "    ADVISORY (this does NOT block the gate), but BE PROACTIVE: if you are"
    echo "    touching docs, FIX these now in the same pass — correct the missing"
    echo "    frontmatter keys / broken REQ→WO links. Don't just report them; doc"
    echo "    drift is a defect (owner directive 2026-06-30)."
  fi
  echo "════════════════════════════════════════════════════════════════════════"
fi

if [ "$GREENFIELD" = 1 ] && [ "$hard_count" -gt 0 ]; then
  exit 1
fi
exit 0
