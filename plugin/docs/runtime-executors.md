# Runtime execution

## One product build engine

`/pandacorp:implement` is the single entry for building, resuming and implementing
features or bugs. Both Claude Code and Codex coordinate the same Node CLI:

```bash
node <plugin>/scripts/pandacorp-build.mjs <command>
```

The executable implementation lives in `plugin/runtime/build/`; its interface and
exit codes are documented in [build-engine-cli.md](build-engine-cli.md). Policy is
owned by `factory/standards/build-engine.md`, routing by
`plugin/runtime/model-tiers.json`, and runtime boundaries by
`factory/standards/agent-portability.md`. These sources replace the retired
separate project executors and their certification procedures.

## Ownership and writes

The CLI owns governed transitions using an epoch-fenced lease. Workers receive
unit briefs and isolated worktrees; the coordinator uses the CLI to collect
reports, integrate and land. Every tracked write belongs on
`lane/<run_id>/integration`, never in the project's main checkout.
`.pandacorp/merge-queue.sh` is the only path to main. A launched project's release
gate requires the owner's order; neither workers nor the relay set
`PANDACORP_OWNER_RELEASE_OK`.

Frontmatter is canonical work-order truth; `.pandacorp/run/build/state.json` is
a derived cache. The lease, not a legacy `running` flag, determines liveness.
Never mix plugin versions on one project or upgrade during a live build.

## Dispatch, review and relay

A session dispatches its runtime's agents. Cross-company workers are launched
through the CLI's supported worker vehicle. Exactly one reviewer is selected
per review unit using the canonical routing and quota policy.

`drive` is the deterministic CLI relay armed by start when its prerequisites hold. It
transfers the same run by epoch fencing and executes either allocated CLI provider. Native
continuations retain the original capable lead and automatic wake until their result is consumed. Owner resume
returns coordination to the session. A foreign/dead lease takeover remains
subject to the CLI's owner-confirmation requirements. Fake-worker tests do not
prove real detached-process survival or unattended provider continuity: those
remain unverified until the first real run supplies evidence.

## Scope, resources and close-out

Scope is fixed by detection and the cited card or pending plan. Recording a
request means a draft card plus `card check`; the engine does not drain unrelated
queue cards. Admission follows BUILD-9's adaptive ladder, disk checks and
performance journal rather than fixed machine assumptions. Finished-run worktree
cleanup follows CONV-21, preserving live, dirty, locked and owner-state paths.

Pending owner questions are mirrored in
`.pandacorp/inbox/decisions.pending.md`; answers go through the CLI's `answer`
command. The mirror is a reading surface, not a second state writer.

## Separate factory backlog vehicle

The factory's backlog Workflow remains Claude-local and is documented in
[dynamic-workflows.md](dynamic-workflows.md). It is independent of product builds.
Codex retains native attended backlog authority under DR-133 without a claim of
automated Workflow parity.
