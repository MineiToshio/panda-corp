# `drive`: the relay from the session's side

Policy: BUILD-14 in `factory/standards/build-engine.md`; interface and exit codes:
`plugin/docs/build-engine-cli.md`; `pb <cmd>` as in `engine-v2.md` §1.

## 1. Arming and authority

`start --run` and `start --resume` arm the deterministic Node relay when Codex login is valid and,
for a launched project, the pre-push guard is verified. The session never spawns/signals it by hand.
Read `drive{armed,reason}` and report whether it is armed. Quota is not an arming condition.
If unavailable, keep coordinating with the shared allocator; no quota threshold stops the run.
The relay keeps the Mac awake with `caffeinate` and logs to `build/drive/drive.log`.

## 2. Explicit handover and recovery

Standby polls every 30 seconds for an explicit current-epoch handoff or a silent lease (1800 seconds)
with pending work. Provider quota is never a handoff trigger. For the owner's `--drive` instruction,
if armed call `pb handoff --epoch E --reason manual`, then observe. The test-only `--handoff-after N`
uses an explicit handoff too. Transfer preserves run id, increases epoch, writes the private lease token,
and fences the former coordinator; it never quiesces/releases the lease or resets current executions.
Live and suspended workers retain their cell, session, token, attempt, branch and dirty worktree.
After transfer, no fenced calls or dispatch from the old session; `pb status` may confirm the coordinator.

## 3. Capacity and suspension

Both session and relay use `decide` for each real task: try the other qualified tool when one has no
capacity; wait only when no eligible cell fits. Claude CLI cells use the authenticated shared launcher;
missing authentication is an infrastructure error, never quota. Never ask the owner about quota.
A running execution never changes tool. Submit a native-agent limit through `pb suspend --epoch E
--unit U --file RECEIPT` with the exact Agent resume id; CLI workers retain their saved provider session.
Healthy siblings continue. A prelaunch refusal returns queued without spending an attempt or recording
false usage-limit telemetry. Reviews, consultants and audits keep their role/risk floor and fresh context.

When all work waits, persist minimum `resumeAt` and keep the lease. Drive sleeps in lease-renewing chunks
to reset+60 seconds, rereads both sources and uses the fenced wake generation. The open Claude lead uses
ScheduleWakeup, re-ingests get_usage and calls `pb start --resume --coordinator claude --wake-generation N`.
No timer available means attended execution. Unknown/stale data never confirms a renewed subscription.
Real authentication, native timers and actual resets need live qualification, separate from fake suites.

## 4. Returning and gates

`pb start --resume --coordinator claude|codex --session-model M` transfers authority from drive back to
the caller and fences the old loop. Preserve live work; a still-active relay must yield before healing
or resetting anything (`CONTENDED` means retry, never reset underneath it). Capacity wake races use
BUILD-11's conditional transition and never steal the winner. Drive may already dispatch Claude without
changing coordinator ownership.

The relay uses normal reports, reviews, security audits and landing. It never skips an audit for quota,
sets `PANDACORP_OWNER_RELEASE_OK`, bypasses a gate or starts a second live landing. Irreversible choices
keep human gates. Technical reversible assumptions record rationale and reversal and follow normal gates.
At completion `finish`/`summary` supply the report. Never edit drive state, handoff files, leases or tokens
by hand, or promise live-provider behavior that only fake transports have verified.
