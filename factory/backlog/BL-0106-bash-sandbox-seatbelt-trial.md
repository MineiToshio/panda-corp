---
id: BL-0106
type: change
area: hooks
title: "Trial the OS-enforced Bash sandbox as a layer orthogonal to block-dangerous.sh"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-26"
closes:
links: [BL-0035]
---

## Problem
`.claude/settings.json:3-8` guards the Claude side with four `permissions.deny` rules (`rm -rf`,
`git push --force`, `git push -f`, `gh repo delete`) and no sandbox configuration. The OS-enforced Bash
sandbox (Seatbelt on macOS) is GA and unused. A command-pattern denylist catches the shapes someone thought
of; an OS sandbox catches the ones nobody did — relevant because BL-0035's root cause is still **UNKNOWN**.

## Fix plan
Enable `/sandbox` in a throwaway session and run one full `/pandacorp:implement` on a **disposable** project,
confirming nothing legitimate is blocked (the engine's file and network access, worktree creation, the gate
worktree, `npm`/`pnpm`). Only if that is clean, propose the settings change. This is an **orthogonal layer,
not a replacement** for `block-dangerous.sh` (which is fail-closed by design and stays).

## Tests (prove the fix — TDD, RED → GREEN)
The disposable-project build completes under the sandbox with no legitimate operation blocked; a seeded
out-of-tree write attempt is blocked by the sandbox.

## Done when
Either the sandbox is enabled with the verification above recorded, or the trial's blocking findings are
recorded and the item is closed as "not adoptable yet" with the specific blockers named.

## Out of scope
Removing or weakening `block-dangerous.sh` or the four `deny` rules (§9 items 2 and 3).

## Note (annotated 2026-10-28) — a sandboxed run reported `.git` read-only (git worktree add fails) and `claude plugin validate` rejected by runtime policy

A `factory/memory/_inbox.md` note (2026-10-27, agent-inferred) reported that in its execution
environment, the root directory allowed file edits but `.git` itself was read-only: `git worktree add`
failed while creating refs, so the session could not promise a commit; separately, the runtime's own
policy rejected running `claude plugin validate`. **Not independently re-verified in this harvest pass**
(CONV-13: this is recorded as unverified secondhand evidence, not confirmed fact) — it is not clear from
the note alone whether this was a deliberate run of this item's own OS-sandbox trial, a different
headless/scheduled-task permission posture (BL-0103's `dontAsk` allowlist), or some other constrained
execution context. Flagging it here because it lands squarely in this item's own "Done when" criterion
("the trial's blocking findings are recorded... with the specific blockers named") if it does turn out to
be a sandbox-trial run: `git worktree add` (worktree creation) and a `claude plugin` subcommand are
exactly the kind of "legitimate operation" this item's Fix plan says must NOT be blocked before the
sandbox can be proposed for adoption. Whoever picks up this item next should first confirm which
mechanism actually produced the read-only `.git` + rejected-validate behavior before treating it as a
sandbox finding — if confirmed, it is a genuine blocker to record under this item's own acceptance
criteria; if it turns out to be an unrelated permission posture, it belongs instead wherever that posture
is tracked (e.g. BL-0103), not here. No new backlog item filed — recorded as a note on this item pending
that confirmation. Source: factory/memory/_inbox.md agent-inferred note (2026-10-27, harvested
2026-10-28).
