#!/bin/bash
# Canary for merge-queue.sh's launched-project gate (DR-138 / INFRA-8): once a project is launched
# externally, GitHub main is production, so the queue must hand back (exit 21) instead of landing,
# and land + push only with PANDACORP_OWNER_RELEASE_OK=1. Pre-launch and internal projects land as
# before, without pushing. Run from the factory repo root: bash plugin/scripts/test-merge-queue-release-gate.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
MQ="$HERE/plugin/templates/shared/.pandacorp/merge-queue.sh"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); }

# $1 = status.yaml body → echoes the fixture root (origin.git + app checkout + wt worktree)
fixture() {
  local root; root=$(mktemp -d)
  git init -q --bare -b main "$root/origin.git"
  git clone -q "$root/origin.git" "$root/app" 2>/dev/null
  mkdir -p "$root/app/.pandacorp"
  printf '%b' "$1" > "$root/app/.pandacorp/status.yaml"
  cp "$MQ" "$root/app/.pandacorp/merge-queue.sh"
  ( cd "$root/app" && git add -A && git commit -q -m init && git push -q origin main 2>/dev/null \
    && git worktree add -q "$root/wt" -b feature-x && cd "$root/wt" && echo x > feature.txt \
    && git add feature.txt && git commit -q -m "feat: x" )
  echo "$root"
}
run_mq() { ( cd "$1/wt" && env ${2:+$2} bash .pandacorp/merge-queue.sh >/dev/null 2>&1 ); echo $?; }
origin_has_feature() { git -C "$1/origin.git" cat-file -e main:feature.txt 2>/dev/null; }
main_has_feature()   { git -C "$1/app" cat-file -e main:feature.txt 2>/dev/null; }

echo "== launched (external): hand back without the owner's order =="
fx=$(fixture 'project: demo\nphase: release\ndeploy_target: external\n')
rc=$(run_mq "$fx")
[ "$rc" = 21 ] && ok "exit 21 without PANDACORP_OWNER_RELEASE_OK" || bad "expected 21, got $rc"
main_has_feature "$fx" && bad "main moved without the owner's order" || ok "local main untouched"
origin_has_feature "$fx" && bad "origin main moved without the owner's order" || ok "origin main untouched"
echo "== launched (external): land + push with the owner's order =="
rc=$(run_mq "$fx" PANDACORP_OWNER_RELEASE_OK=1)
[ "$rc" = 0 ] && ok "exit 0 with the release token" || bad "expected 0, got $rc"
main_has_feature "$fx" && ok "local main has the change" || bad "local main missing the change"
origin_has_feature "$fx" && ok "origin main pushed (production deploy trigger)" || bad "origin main not pushed"
rm -rf "$fx"

echo "== launched with no deploy_target: treated as external (fail-safe) =="
fx=$(fixture 'project: demo\nphase: release\n')
rc=$(run_mq "$fx")
[ "$rc" = 21 ] && ok "exit 21" || bad "expected 21, got $rc"
rm -rf "$fx"

echo "== pre-launch project: lands as before, no push =="
fx=$(fixture 'project: demo\nphase: implementation\n')
rc=$(run_mq "$fx")
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc"
main_has_feature "$fx" && ok "local main has the change" || bad "local main missing the change"
origin_has_feature "$fx" && bad "pre-launch landing pushed to origin" || ok "origin untouched"
rm -rf "$fx"

echo "== internal tool in release: lands as before, no push =="
fx=$(fixture 'project: demo\nphase: release\ndeploy_target: internal  # local\n')
rc=$(run_mq "$fx")
[ "$rc" = 0 ] && ok "exit 0" || bad "expected 0, got $rc"
origin_has_feature "$fx" && bad "internal landing pushed to origin" || ok "origin untouched"
rm -rf "$fx"

# BL-0288: bootstrap hides tracked local ports with skip-worktree; main can then change those same
# files. The queue must restore HEAD before rebase and gate committed bytes, then re-bootstrap on nonzero exits, including aborts (BL-0288).
echo "== bootstrapped ports survive main changes and a rebase abort =="
for outcome in success conflict nested launched busy red; do
  fx=$(fixture 'project: demo\nphase: implementation\n')
  if [ "$outcome" = launched ]; then
    printf 'project: demo\nphase: release\ndeploy_target: external\n' > "$fx/app/.pandacorp/status.yaml"
  fi
  project_rel=.
  [ "$outcome" = nested ] && project_rel=mission-control
  mkdir -p "$fx/app/$project_rel/e2e" "$fx/app/$project_rel/.pandacorp" "$fx/app/.claude" "$fx/bin"
  cp "$MQ" "$fx/app/$project_rel/.pandacorp/merge-queue.sh"
  printf '#!/bin/bash\nmkdir -p node_modules\n' > "$fx/bin/pnpm"
  chmod +x "$fx/bin/pnpm"
  echo original > "$fx/app/user-local.txt"
  echo '{"name":"queue-fixture"}' > "$fx/app/$project_rel/package.json"
  printf 'node_modules/\n.env.local\n.pandacorp/run/\ngate-port.txt\n' > "$fx/app/.gitignore"
  # BL-0288: probe a free high port; never bind the owner's real application port.
  committed_port=$(python3 - <<'PORT'
import socket
with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    print(probe.getsockname()[1])
PORT
)
  printf '{"PORT":"%s","URL":"http://127.0.0.1:%s"}\n' "$committed_port" "$committed_port" > "$fx/app/$project_rel/e2e/server-env.json"
  echo '{"configurations":[{"name":"app","port":4030}]}' > "$fx/app/.claude/launch.json"
  cp "$HERE/plugin/templates/shared/.pandacorp/worktree-bootstrap.sh" "$fx/app/$project_rel/.pandacorp/"
  chmod +x "$fx/app/$project_rel/.pandacorp/worktree-bootstrap.sh"
  cat > "$fx/app/$project_rel/.pandacorp/verify.sh" <<'GATE'
#!/bin/bash
# BL-0288: record the actual gate input; assert committed bytes, never local derived config.
jq -r '.PORT|tostring' e2e/server-env.json > gate-port.txt
git diff --quiet HEAD -- e2e/server-env.json || exit 1
jq -e --arg port "$BL0288_COMMITTED_PORT" '.MAIN_KEY == "new" and .PORT == $port and .URL == ("http://127.0.0.1:" + $port)' e2e/server-env.json >/dev/null || exit 1
[ "${BL0288_GATE_RED:-}" != 1 ]
GATE
  chmod +x "$fx/app/$project_rel/.pandacorp/verify.sh"
  ( cd "$fx/app" && git add -A && git commit -qm 'test: bootstrap fixture' )
  git -C "$fx/wt" rebase main >/dev/null 2>&1
  ( cd "$fx/wt/$project_rel" && PATH="$fx/bin:$PATH" PANDACORP_E2E_PORT=3964 bash .pandacorp/worktree-bootstrap.sh >/dev/null 2>&1 )
  [ -z "$(git -C "$fx/wt" status --porcelain)" ] && ok "$outcome: bootstrapped worktree passes clean-tree check" || bad "$outcome: bootstrap left dirty files"
  # BL-0288: an unrelated user skip-worktree edit must survive byte-for-byte, including nested CWD.
  git -C "$fx/wt" update-index --skip-worktree user-local.txt
  printf 'user override\nwith local bytes\n' > "$fx/user-expected.txt"
  cp "$fx/user-expected.txt" "$fx/wt/user-local.txt"
  echo dirty > "$fx/wt/uncommitted.txt"
  rc=$(run_mq "$fx")
  [ "$rc" = 20 ] && ok "$outcome: genuine WIP still rejected with exit 20" || bad "$outcome: dirty worktree returned $rc"
  rm "$fx/wt/uncommitted.txt"
  printf '{"PORT":"%s","URL":"http://127.0.0.1:%s","MAIN_KEY":"new"}\n' "$committed_port" "$committed_port" > "$fx/app/$project_rel/e2e/server-env.json"
  echo '{"configurations":[{"name":"app-new","port":4030}]}' > "$fx/app/.claude/launch.json"
  [ "$outcome" = conflict ] && echo main-conflict > "$fx/app/feature.txt"
  ( cd "$fx/app" && git add -A && git commit -qm 'test: main changes tracked local config' )
  # BL-0288: a real TCP listener proves the gate refuses a busy committed port before verify.
  listener_pid=""
  if [ "$outcome" = busy ]; then
    python3 - "$fx/listener-ready" "$committed_port" <<'LISTENER' &
import socket, sys
from pathlib import Path
with socket.socket() as server:
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", int(sys.argv[2])))
    server.listen()
    Path(sys.argv[1]).touch()
    while True:
        client, _ = server.accept()
        client.close()
LISTENER
    listener_pid=$!
    for attempt in {1..100}; do
      [ -f "$fx/listener-ready" ] && break
      kill -0 "$listener_pid" 2>/dev/null || break
      sleep 0.05
    done
    [ -f "$fx/listener-ready" ] && ok "busy: listener ready" || bad "busy: listener did not bind"
  fi
  # BL-0288: seed explicitly so successful cleanup proves the manifest is not resurrected.
  mkdir -p "$fx/app/.pandacorp/run/worktrees"
  echo '{}' > "$fx/app/.pandacorp/run/worktrees/feature-x.json"
  gate_red=0
  [ "$outcome" = red ] && gate_red=1
  ( cd "$fx/wt/$project_rel" && PATH="$fx/bin:$PATH" BL0288_GATE_RED="$gate_red" BL0288_COMMITTED_PORT="$committed_port" PANDACORP_E2E_PORT=3964 bash .pandacorp/merge-queue.sh >"$fx/queue.log" 2>&1 )
  rc=$?
  if [ -n "$listener_pid" ]; then
    kill "$listener_pid" 2>/dev/null || true
    wait "$listener_pid" 2>/dev/null || true
  fi
  if [ "$outcome" != conflict ]; then
    expected=0
    case "$outcome" in launched) expected=21 ;; busy) expected=14 ;; red) expected=11 ;; esac
    [ "$rc" = "$expected" ] && ok "$outcome: exit $expected" || bad "$outcome: expected $expected, got $rc: $(cat "$fx/queue.log")"
    if [ "$outcome" = busy ]; then
      [ ! -f "$fx/wt/$project_rel/gate-port.txt" ] && ok "busy: verify never ran" || bad "busy: verify ran"
      grep -q "stop the dev server / other gate on :$committed_port, then re-run" "$fx/queue.log" && ok "busy: actionable port message" || bad "busy: missing port message"
    else
      [ "$(cat "$fx/wt/$project_rel/gate-port.txt" 2>/dev/null)" = "$committed_port" ] && ok "$outcome: verify sees committed PORT" || bad "$outcome: verify saw local PORT or did not run"
    fi
    expected_port=3964
    [ "$rc" = 0 ] && expected_port=$committed_port
    jq -e --arg port "$expected_port" '.MAIN_KEY == "new" and .PORT == $port' "$fx/wt/$project_rel/e2e/server-env.json" >/dev/null && ok "rebased file retains main's new key and derived port" || bad "main key or derived port missing"
  else
    [ "$rc" = 10 ] && ok "real conflict preserves exit 10" || bad "expected conflict exit 10, got $rc"
    jq -e --arg port "$committed_port" '.PORT == "3964" and .URL == ("http://127.0.0.1:" + $port)' "$fx/wt/$project_rel/e2e/server-env.json" >/dev/null && ok "aborted rebase restores usable per-worktree ports" || bad "abort left committed ports"
    [ ! -d "$(git -C "$fx/wt" rev-parse --absolute-git-dir)/rebase-merge" ] && ok "conflicting rebase was aborted" || bad "rebase still active"
  fi
  if [ "$rc" = 0 ]; then
    [ ! -f "$fx/app/.pandacorp/run/worktrees/feature-x.json" ] && ok "$outcome: manifest stays deleted" || bad "$outcome: manifest resurrected"
    git -C "$fx/wt" diff --quiet HEAD -- .claude/launch.json && ok "$outcome: no bootstrap after success" || bad "$outcome: success re-bootstrapped"
  else
    [ "$(jq -r '.configurations[0].autoPort' "$fx/wt/.claude/launch.json")" = true ] && ok "$outcome: tracked launch config bootstrapped again" || bad "$outcome: launch config not bootstrapped"
  fi
  [ ! -d "$fx/app/.git/pandacorp-merge.lock" ] && ok "$outcome: lock released" || bad "$outcome: lock left behind"
  cmp -s "$fx/user-expected.txt" "$fx/wt/user-local.txt" && ok "$outcome: user override byte-identical" || bad "$outcome: user override lost"
  [ "$(git -C "$fx/wt" ls-files -v -- user-local.txt)" = 'S user-local.txt' ] && ok "$outcome: user skip-worktree preserved" || bad "$outcome: user skip-worktree cleared"
  [ -z "$(git -C "$fx/wt" status --porcelain)" ] && ok "$outcome: worktree stays clean after queue" || bad "$outcome: dirty worktree after queue"
  rm -rf "$fx"
done

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
