#!/bin/zsh
# Generates ONE image with Codex's built-in image tool, with retries (logos, demo art, covers).
# Usage (parallel): cat jobs.txt | xargs -P 5 -I{} zsh codex-image.sh <workdir> "{}"
#   jobs.txt lines: "<name>|<ref1.png> <ref2.png>"  (refs optional, relative to <workdir>)
#   <workdir>/<name>.prompt holds the prompt; it must ask to save ./<name>.png and touch nothing else.
# Model: CODEX_IMAGE_MODEL (default gpt-5.6-sol). Output: <workdir>/<name>.png, logs <name>-log.txt.
# Gotcha: Codex may return a transparent PNG; composite it onto the intended ground before converting to JPEG.
A="$1"; line="$2"; name="${line%%|*}"; refs="${line#*|}"; [ "$refs" = "$line" ] && refs=""
cd "$A" || exit 1
args=(); for r in ${=refs}; do [ -n "$r" ] && args+=(-i "$A/$r"); done
for attempt in 1 2 3 4; do
  [ -f "$A/$name.png" ] && break
  timeout 900 codex exec -m "${CODEX_IMAGE_MODEL:-gpt-5.6-sol}" --skip-git-repo-check -C "$A" -s workspace-write -o "$A/$name-last.txt" "${args[@]}" - < "$A/$name.prompt" > "$A/$name-log.txt" 2>&1
  [ -f "$A/$name.png" ] && break
  sleep $((30*attempt))
done
[ -f "$A/$name.png" ] && echo "OK $name" || echo "FAIL $name"
