#!/bin/bash
# Exit 0 if <dir> (arg 1, default cwd) is a Pandacorp project.
# Marker: the .pandacorp/ integration folder with its status.yaml is present.
# Excludes the factory itself and non-Pandacorp folders (they have no .pandacorp/status.yaml).
# Shared by the write-gate hook (warn-adhoc-write.sh) and the skills' preflight (DR-044/DR-045).
dir="${1:-.}"
[ -f "$dir/.pandacorp/status.yaml" ]
