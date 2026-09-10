---
id: LESSON-0034
type: gotcha
domain: preview-tooling
tags: [preview, worktree, launch-json, dev-server, dr-096]
context: verifying a running dev server's UI while working inside a git worktree (DR-096 isolation)
trigger: use this when you launched or are about to verify a dev server from inside a git worktree and need the preview tools to reflect that worktree's code
source: "panda-corp Mission Control 2026-07-02 — worktree preview verification, .pandacorp/run/lessons.md. Corroborated 2026-09-05 (personal-page-v2, harvested 2026-09-07): `preview_start` resolves `.claude/launch.json` from the ORIGINAL session's directory, not the worktree — inside a worktree this collided with the main checkout's dev-server port, and editing the worktree's local `launch.json` did not redirect it. A working alternative was found: use the Playwright harness itself (`PORT=<free-port> pnpm exec playwright test`), which boots its OWN webServer independent of `launch.json`/preview tooling.
Corroborated again 2026-09-09 (personal-page-v2, `.pandacorp/run/lessons.md`) with a working manual
workaround (own `next dev` on a free port + curl-verify + PORT-scoped gate scripts). Eval-gate note
(librarian, 2026-09-10): cross-project evidence already spans mission-control (origin) and
personal-page-v2 (two separate corroborations) — activating `status: active`."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-096, LESSON-0102]
---

**Situation:** while working inside a git worktree (DR-096 isolation), the preview tools (screenshot/DOM
verification) resolved `.claude/launch.json` from the **main checkout**, not from the worktree. A dev
server launched from the worktree therefore appeared to serve stale code — actually it was the preview
tool inspecting the main checkout's server/config, not the worktree's.

**Lesson:** preview tooling's `.claude/launch.json` resolution is anchored to the primary checkout, not
the cwd of whichever worktree launched a server. A worktree session that expects "what I just changed"
to show up in a preview may instead be looking at main's old code, with no error — silent staleness, not
a crash.

**Apply next time:** when verifying UI from a worktree, either (a) merge the worktree's work into main
first and verify AFTER the merge (DR-096's normal landing flow already does this), or (b) if an in-flight
worktree preview is genuinely needed, point the preview/dev server explicitly at the worktree's path
rather than assuming the tool will pick it up automatically. (c) For automated/e2e verification
specifically, prefer letting the test harness boot its own webServer (`PORT=<free-port> pnpm exec
playwright test`) over relying on `preview_start`/`launch.json` from inside a worktree at all — it
sidesteps this class of resolution mismatch entirely.

**Corroborated (2026-09-09, personal-page-v2):** `preview_start` still read the main checkout's
launch.json from a worktree session even after the worktree's own launch.json was rewritten with an
absolute cwd and a distinct name — confirming this is a property of the preview tool's resolution, not
something a bootstrap fix to the config file alone can route around (see LESSON-0102 for a further
mechanism, `${workspaceFolder}` resolving to main, that produces the identical symptom). Working
workaround for this occurrence: start `pnpm exec next dev --port <free-port>` in the background from the
worktree directly, open `preview_start({url: "http://127.0.0.1:<port>/..."})`, and curl-verify a
distinctive new string on that port before showing it to the owner; run `PORT=<port> bash
.pandacorp/verify.sh` / `PORT=<port> bash .pandacorp/merge-queue.sh` so the gate reuses that SAME
worktree-local server rather than the main tree's.
