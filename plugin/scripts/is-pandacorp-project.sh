#!/bin/bash
# Exit 0 if <dir> (arg 1, default cwd) is a Pandacorp PRODUCT project.
# Marker: docs/status.yaml present AND CLAUDE.md mentions Pandacorp.
# Excludes the factory itself (it has no docs/status.yaml) and non-Pandacorp folders.
# Shared by the write-gate hook (warn-adhoc-write.sh) and the skills' preflight (DR-044/DR-045).
dir="${1:-.}"
[ -f "$dir/docs/status.yaml" ] && grep -qs "Pandacorp" "$dir/CLAUDE.md"
