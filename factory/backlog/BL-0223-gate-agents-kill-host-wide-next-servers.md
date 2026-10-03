---
id: BL-0223
type: bug
area: plugin-agent
title: "FRD-gate agents stop their ad-hoc server with host-wide `pkill -f \"next start\"` / `pkill -f next-server`, killing every other Next.js server on the machine"
status: done
severity: p1
opened: 2026-10-03
source: "owner/conversation — proposal 41 bench run FM-10 (wf_21c442d1-f54), reviewer agent a1342c1ca98236397 at 2026-10-03T18:44:33Z"
closes:
links: [DR-118, DR-125]
---

## Problem
During the medium-bench run FM-10 (plugin feat/builder-speed, lanes K=2), the opus FRD-gate reviewer for
`frd-01-projects` smoke-tested its gate worktree with an ad-hoc shell sequence:
`pnpm start` (fixed port 3000) → curl checks → `pkill -f "next start" ; pkill -f "next-server"`.
`pkill -f` matches by command line across the WHOLE host, not the process the agent started. At the same
second an unrelated `next start -p 4517` (the hidden benchmark oracle, in a scratch directory outside the
project) died with exit 143 (SIGTERM; its server log stops at 18:44:35Z), turning 20 passing oracle tests
into `ECONNREFUSED`. A re-run with no concurrent gate passed 289/289, which isolates the cause.

Impact: any Next.js server on the owner's machine is a casualty — Mission Control itself (launchd
`com.pandacorp.mission-control`, `next start` on 127.0.0.1:1987; it survives only because launchd
KeepAlive restarts it), a parallel session's preview, the production-build smoke (proposal 40 §2) or a
concurrent lane's verify running `next start`. With lanes (DR-125) and concurrent gates (DR-118) the same
build can kill its own sibling's server, producing a false red that costs a repair or a bisect. Using a
fixed port 3000 additionally collides between two concurrent gates or projects.

## Root cause
Neither `plugin/agents/reviewer.md` nor the engine's gate prompt in
`plugin/runtime/engine/pandacorp-build.src.js` tells the agent how to own a server's lifecycle, so the
model falls back to the common idiom `pkill -f <pattern>` and a hard-coded default port. Nothing scopes
the kill to the PID the agent itself started.

## Fix plan
1. Add a server-lifecycle clause to the reviewer agent (and every build agent that may start a server:
   implementer fast-lane section, frontend-dev, test-writer): start on a free ephemeral port
   (e.g. `PORT=$(node -e 'const s=require("net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')`),
   record `$!`, and stop ONLY that process group (`kill -- -$PGID` / `kill $PID` plus its children via
   `pkill -P $PID`). Explicitly forbid `pkill -f`, `killall` and `lsof -ti :<port> | xargs kill` on a port the
   agent did not bind.
2. Better by construction: ship a tiny helper in the overlay (`.pandacorp/serve-once.sh <dir> -- <cmd>`) that
   picks a free port, starts the server in its own process group, prints the URL, and kills exactly that
   group on exit/trap; point the agents at it instead of free-form shell.
3. Extend the dangerous-command PreToolUse hook (`plugin/hooks/hooks.json`) to refuse `pkill -f` /
   `killall` patterns that match `next`, `node`, `vite` or `playwright` inside build agents, with a message
   pointing at the helper.
4. Regenerate the Codex agent mirrors; bump plugin (PATCH) and OVERLAY_VERSION if the helper ships.

## Tests (prove the fix — TDD, RED → GREEN)
- Hook unit test: `pkill -f "next start"` and `pkill -f next-server` are refused (RED today: allowed);
  `kill $PID` and `pkill -P $PID` stay allowed.
- Helper test: start two `serve-once.sh` instances concurrently, stop one, assert the other still answers
  HTTP 200 (the exact failure mode of FM-10).
- Prompt-fragment test: the generated reviewer/implementer directives contain the ban and the helper name.

## Done when
- [x] Hook refuses host-wide kills of dev/prod servers; the two-server test is green in `run-engine-tests`.
- [x] `reviewer.md` (+ implementer, frontend-dev, backend-dev, test-writer) carry the lifecycle clause; Codex mirrors regenerated.
- [ ] Plugin version bumped; decision log entry written. **Deferred to release** (the version bump, `OVERLAY_VERSION`
      for the new `.pandacorp/serve-once.sh` overlay file, and the decision-log entry land with the release commit).
- [ ] A medium-bench run with an oracle running concurrently shows no `ECONNREFUSED` caused by build agents.
      **Pending**: needs a live bench run, not done here.

## Resolution
- `plugin/scripts/block-dangerous.sh`: command-position scan refuses `pkill`/`killall` by a next/node/vite/playwright/
  pnpm/npm/npx/tsx pattern, a pid list found by `lsof`/`pgrep`/`ps|grep` fed to `kill` (`$(...)` or `xargs kill`) and
  `fuser -k`; `kill <PID>`, `kill -- -<PGID>` and `pkill -P <PID>` stay allowed. The refusal names the helper.
  Tests: `plugin/scripts/test-block-dangerous.sh` (BL-0223 section, RED before / GREEN after).
- `plugin/templates/shared/.pandacorp/serve-once.sh` (overlay helper): free ephemeral port, own process group, HTTP
  readiness wait, `--run` for a self-cleaning smoke, kills exactly its group. Test: `plugin/scripts/test-serve-once.sh`
  (two concurrent instances independent), registered in `run-engine-tests.sh`.
- Agents: SERVER_LIFECYCLE block in `reviewer.md` generated into the engine as `SERVER_LIFECYCLE_DIRECTIVE`
  (both gate prompts); a plain clause in the other four agents. Test: scenario BL0223-a in `test-pandacorp-build.mjs`.
  Engine artifact regenerated (475 558 bytes, under the 480 000 budget).

## Out of scope
Changing which agent runs the production-build smoke, or the gate's evidence model.
