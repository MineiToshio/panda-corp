#!/bin/bash
# Pandacorp ideas scanner: detects estado changes in fabrica/ideas/*.md frontmatter
# by comparing against a cached snapshot. Prints changes; updates the snapshot.
# Usage: scan-ideas.sh /path/to/panda-corp

FACTORY="${1:-/Users/Shared/Proyectos/panda-corp}"
IDEAS_DIR="$FACTORY/fabrica/ideas"
CACHE_DIR="$FACTORY/.pandacorp-cache"
SNAPSHOT="$CACHE_DIR/ideas-snapshot.txt"

mkdir -p "$CACHE_DIR"
[ -d "$IDEAS_DIR" ] || { echo "No ideas dir at $IDEAS_DIR"; exit 1; }

current=$(mktemp)
for f in "$IDEAS_DIR"/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  [ "$base" = "_plantilla-ficha.md" ] && continue
  estado=$(awk '/^---$/{n++; next} n==1 && /^estado:/{sub(/^estado:[[:space:]]*/,""); print; exit}' "$f")
  echo "$base|$estado"
done | sort > "$current"

if [ -f "$SNAPSHOT" ]; then
  changes=0
  while IFS='|' read -r file estado; do
    old=$(grep -F "$file|" "$SNAPSHOT" | cut -d'|' -f2)
    if [ -z "$old" ]; then
      echo "NEW: $file (estado: $estado)"
      changes=1
    elif [ "$old" != "$estado" ]; then
      echo "CHANGED: $file ($old -> $estado)"
      changes=1
    fi
  done < "$current"
  # Deleted files
  while IFS='|' read -r file estado; do
    grep -qF "$file|" "$current" || { echo "REMOVED: $file (was: $estado)"; changes=1; }
  done < "$SNAPSHOT"
  [ "$changes" -eq 0 ] && echo "No changes."
else
  echo "First run — snapshot created, no changes to report."
fi

mv "$current" "$SNAPSHOT"
exit 0
