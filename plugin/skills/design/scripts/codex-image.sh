#!/bin/zsh
# Generates ONE image with Codex's built-in image tool, with retries (logos, demo art, covers).
# Usage (parallel): cat jobs.txt | xargs -P 5 -I{} zsh codex-image.sh <workdir> "{}"
#   jobs.txt lines: "<name>|<ref1.png> <ref2.png>"  (refs optional, relative to <workdir>)
#   <workdir>/<name>.prompt holds the prompt; it must ask to save ./<name>.png and touch nothing else.
# Model: shared capacity allocator (Codex Sol). Output: <workdir>/<name>.png, logs <name>-log.txt.
# Gotcha: Codex may return a transparent PNG; composite it onto the intended ground before converting to JPEG.
CAPACITY_CLI="${0:A:h}/../../../runtime/capacity-cli.mjs"
A="$1"; line="$2"; name="${line%%|*}"; refs="${line#*|}"; [ "$refs" = "$line" ] && refs=""
cd "$A" || exit 1
[ -f "$A/$name.png" ] && { echo "OK $name"; exit 0; }
task=$(node -e 'process.stdout.write(JSON.stringify({id:process.argv[1],type:"image",risk:"normal"}))' "$name")
decision=$(node "$CAPACITY_CLI" decide --task "$task") || exit $?
action=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).action)' "$decision") || exit $?
if [ "$action" = wait ]; then
  print -r -- "$decision"
  exit 75
fi
model=$(node -e 'const fs=require("fs"); const d=JSON.parse(process.argv[1]); const tiers=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); process.stdout.write(tiers.catalog.codex[d.model]);' "$decision" "${CAPACITY_CLI:h}/model-tiers.json") || exit $?
args=(); for r in ${=refs}; do [ -n "$r" ] && args+=(-i "$A/$r"); done
for attempt in 1 2 3 4; do
  [ -f "$A/$name.png" ] && break
  timeout 900 codex exec -m "$model" --skip-git-repo-check -C "$A" -s workspace-write -o "$A/$name-last.txt" "${args[@]}" - < "$A/$name.prompt" > "$A/$name-log.txt" 2>&1
  [ -f "$A/$name.png" ] && break
  sleep $((30*attempt))
done
[ -f "$A/$name.png" ] && echo "OK $name" || echo "FAIL $name"
