#!/bin/bash
# Pandacorp — gate-config "project newer than template" detector (BL-0003 / DR-076 amendment).
#
# The DR-059 conformance overwrite is unconditional: /pandacorp:upgrade copies the plugin template's
# canonical gate config over the project's copy. DR-076 assumes "the template is never behind a
# project" — but that is an ASSUMPTION, not an invariant. A project can legitimately race AHEAD when a
# pinned tool ships a config-format change before the template catches up (personal-page-v2: biome
# 2.5.1 required schema 2.5.1 + `preset: recommended`; the template was stale at 2.5.0 + the deprecated
# `recommended: true`, and the blind overwrite silently DOWNGRADED the project and red-locked the
# baseline under `biome check --error-on-warnings`). LESSON-0004.
#
# This detector runs BEFORE the overwrite and answers ONE question per gate-config file:
#   is the PROJECT's config newer/correct for the INSTALLED tool, while the TEMPLATE is behind?
# If so, the caller MUST back-port the project's version to the template FIRST (so the overwrite is a
# no-op) — never silently downgrade. If the project is at/behind the template, the normal overwrite
# proceeds. It never edits anything; it only classifies (project-newer | template-current | unknown).
#
# Currently implemented for biome.json (the file that actually bit us): its `$schema` URL carries a
# full semver (…/schemas/X.Y.Z/schema.json) that is directly comparable to the installed
# @biomejs/biome version in package.json. knip's schema URL is major-only (knip@6) so a semver compare
# is not meaningful there; it is reported `unknown` (fall back to the DR-094 loud diff report).
#
# Usage:  detect-gate-config-newer.sh <project_dir> <template_dir>
# Emits one line per canonical file:  <file>\t<verdict>\t<detail>
#   verdict ∈ { project-newer | template-current | unknown }
# Exit code: 0 if NO file is project-newer (safe to overwrite); 1 if ANY file is project-newer
# (the caller must back-port first — a blind overwrite would DOWNGRADE the project).

set -euo pipefail

PROJECT_DIR="${1:?usage: detect-gate-config-newer.sh <project_dir> <template_dir>}"
TEMPLATE_DIR="${2:?usage: detect-gate-config-newer.sh <project_dir> <template_dir>}"

# Extract the biome schema semver (X.Y.Z) from a biome.json's $schema URL, or empty if absent.
biome_schema_version() {
  local file="$1"
  [ -f "$file" ] || return 0
  # …/schemas/2.5.1/schema.json  →  2.5.1
  grep -oE '/schemas/[0-9]+\.[0-9]+\.[0-9]+/' "$file" 2>/dev/null \
    | head -1 | tr -d '/' | sed 's|schemas||'
}

# Resolve the INSTALLED @biomejs/biome version from the project's package.json (strip range prefixes
# ^ ~ >= etc.), or empty if not pinned there.
installed_biome_version() {
  local pkg="$PROJECT_DIR/package.json"
  [ -f "$pkg" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -r '(.devDependencies["@biomejs/biome"] // .dependencies["@biomejs/biome"] // "")' "$pkg" 2>/dev/null \
      | sed -E 's/^[^0-9]*//'
  else
    grep -oE '"@biomejs/biome"[[:space:]]*:[[:space:]]*"[^"]+"' "$pkg" 2>/dev/null \
      | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
  fi
}

# semver compare: prints -1 (a<b), 0 (a==b), 1 (a>b). Missing operand → prints "?" (unknown to caller).
semver_cmp() {
  local a="$1" b="$2"
  [ -n "$a" ] && [ -n "$b" ] || { echo "?"; return 0; }
  if [ "$a" = "$b" ]; then echo 0; return 0; fi
  # highest of the two, by version sort; if it equals a → a>b, else a<b.
  local hi
  hi=$(printf '%s\n%s\n' "$a" "$b" | sort -V | tail -1)
  [ "$hi" = "$a" ] && echo 1 || echo -1
}

overall=0

# --- biome.json ---------------------------------------------------------------
proj_biome="$PROJECT_DIR/biome.json"
tmpl_biome="$TEMPLATE_DIR/biome.json"
if [ -f "$proj_biome" ] || [ -f "$tmpl_biome" ]; then
  ps=$(biome_schema_version "$proj_biome")
  ts=$(biome_schema_version "$tmpl_biome")
  iv=$(installed_biome_version)
  # Project is "newer/correct" iff: its schema is AHEAD of the template's, AND its schema matches (<=)
  # the installed tool (i.e. it was adapted to the pinned tool the template hasn't caught up to). If we
  # can't read the installed version, we still flag project-ahead-of-template as project-newer (safe:
  # back-porting an ahead config is never a downgrade).
  cmp_pt=$(semver_cmp "$ps" "$ts")           # project vs template schema
  if [ "$cmp_pt" = "1" ]; then
    detail="project schema $ps > template schema $ts"
    if [ -n "$iv" ]; then
      cmp_pi=$(semver_cmp "$ps" "$iv")        # project schema vs installed tool
      if [ "$cmp_pi" = "1" ]; then
        # project schema is even ahead of the installed tool — suspicious, not a clean "adapted" case.
        printf '%s\t%s\t%s\n' "biome.json" "unknown" "$detail but > installed biome $iv"
      else
        printf '%s\t%s\t%s\n' "biome.json" "project-newer" "$detail; matches installed biome $iv — BACK-PORT before overwrite"
        overall=1
      fi
    else
      printf '%s\t%s\t%s\n' "biome.json" "project-newer" "$detail (installed biome version unknown) — BACK-PORT before overwrite"
      overall=1
    fi
  elif [ "$cmp_pt" = "?" ]; then
    printf '%s\t%s\t%s\n' "biome.json" "unknown" "could not read one/both schema versions (proj='$ps' tmpl='$ts')"
  else
    printf '%s\t%s\t%s\n' "biome.json" "template-current" "project schema '${ps:-none}' <= template schema '${ts:-none}'"
  fi
fi

# --- knip.json (major-only schema tag → not semver-comparable) ----------------
if [ -f "$PROJECT_DIR/knip.json" ] || [ -f "$TEMPLATE_DIR/knip.json" ]; then
  printf '%s\t%s\t%s\n' "knip.json" "unknown" "schema URL is major-only (knip@N) — fall back to DR-094 loud diff report"
fi

exit "$overall"
