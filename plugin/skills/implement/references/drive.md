> **DR-162 (phase 2a) supersedes quota routing below:** drive uses the same shared account allocator as
> the session, can execute an allocated Claude cell through the worker launcher, and only parks capacity
> when neither qualified tool fits, with resumeAt persisted. There is no 90/95 veto or capacity-triggered
> mandatory company switch, Astra escalation, same-model degradation or Claude-only audit deferral.
> Explicit handoff, lease fencing, ownership, human gates and safe-point behavior remain in force.
> Automatic resumption is phase 3; authenticated real-provider fallback is not certified by fixtures.

# `drive`: the Codex relay, from the session's side

Policy is BUILD-14 (`factory/standards/build-engine.md`); the command, its files and its exit codes are in
`plugin/docs/build-engine-cli.md`; `pb <cmd>` as in `engine-v2.md` §1. This file says what the coordinating
session does before, at and after a handover.

## 1. What drive is

`pb drive` is a Node process of the same CLI with **no LLM of its own and no Claude at all** (`claude -p` fails with
an expired OAuth from a subprocess, LESSON-0501). `start --run` arms it in standby; when it takes over it continues
the same run with Codex only: `next` → Codex workers → reports, reviews, landing → `next`, renewing the lease in its
own loop. It keeps the Mac awake with `caffeinate -i -w <pid>` and logs to `.pandacorp/run/build/drive/drive.log`.

Takeover is a **transfer of the same run**: epoch + 1, a new lease-token file, no owner confirmation, no quiesce,
running Codex workers and jobs keep going and are adopted. The session's next fenced call gets exit 3 and the session
becomes an observer (`engine-v2.md` §9). The lease is never released by a handover.

## 2. Arming (the session never spawns drive)

1. `pb start --run` arms drive itself (and `pb start --resume` re-arms it) whenever `codex login status` is OK and,
   in a launched project, the pre-push hook is verified. **Codex quota is not checked at arming**: drive re-reads it
   when a trigger fires.
2. The session only reads `drive{armed, reason}` and writes the "Relevo a Codex" line of the first message:
   - armed: "Relevo a Codex: armado.";
   - armed with Codex at or above 90 %: "Relevo a Codex: armado (Codex al <N> %, solo actuará si se renueva antes).";
   - not armed: "Relevo a Codex: no armado: <reason en llano>." (expired Codex login, or a launched project without
     the hook). Then the build runs without a relay: at Claude ≥95 % it pauses at a safe point instead.
3. **Owner option `--drive`** ("construye con Codex y no uses esta sesión"): `start --run` with `--label codex`;
   if `drive.armed` is true, `pb handoff --epoch <E> --reason manual`, tell the owner "El build lo lleva el relevo
   de Codex desde ya. Puedes irte.", and become an observer. If drive is not armed, say why and coordinate normally.

## 3. Triggers and what the session does

Drive's standby checks every 30 s:

| Trigger | Who causes it | Session action |
|---|---|---|
| (a) `build/handoff.json` | the session, when `next` returns `action: "handoff"` (Claude ≥95 % with this session coordinating) or when one of its agents hit Claude's usage limit | below |
| (b) Claude's usage-limit text in a unit report or Codex worker output of the run | a limit the session could not act on | none (it may already be out of turns) |
| (c) lease expired (no renew for 30 min) with work pending, independently of quota | a silent coordinator | none |

At `action: "handoff"`, or when a background agent of yours returns Claude's usage-limit error while you still have a
turn:

1. Do not dispatch anything new. File any report already returned (`engine-v2.md` §7), then at once
   `pb handoff --epoch <E> --reason quota95` (or `--reason limit` for a usage-limit error). Do not wait for agents
   still running: a handover never waits; their results come back after the transfer, are rejected with exit 3 and
   the work is re-run by drive.
2. Never `finish`, `stop` or release anything because of a Claude limit: the run stays alive for drive.
3. Notify. Claude Code: `PushNotification` "Claude se queda sin cupo. El relevo de Codex sigue el build; no tienes
   que hacer nada." Same line in the chat.
4. Observer from now on: no fenced call, no dispatch. You may run `pb status` once to confirm `coordinator: drive`,
   then end the turn.

At takeover drive reads the shared account state. It parks only if neither tool fits and nothing runs, persisting resumeAt; otherwise it continues.

**Forced handoff (test only: the first real use with a forced relay).** When the owner asks for it "tras N
tareas": count `report` results with `outcome: committed`; after the N-th, `pb handoff --epoch <E> --reason test`
and continue from step 3 above. Never in a normal build.

## 4. Coming back while drive coordinates

Drive reads the shared Claude snapshot and can dispatch Claude work without changing lease ownership. When the owner reopens a session and
writes `/pandacorp:implement --resume`:

1. `pb start --detect --args=--resume …` → row 2.
2. `pb start --resume --coordinator claude --session-model <m>` → the lease is transferred to this session immediately (epoch + 1) (no `--owner-confirmed`: a run held by drive, even a dead one, is transferred back directly); drive gets exit 3 at its
   next step and exits. Keep the new `epoch` and continue the loop of `engine-v2.md` §7.
3. Tell the owner "Retomo el build desde el relevo de Codex." Never stop or kill drive by hand.

If drive already finished or paused, `pb summary` gives the data: write the final report of `engine-v2.md` step 6.

## 5. What drive does alone (so the report can explain it)

- **Reviews and audits** use shared capacity by risk, in fresh contexts, including the same model as the author.
- **Doubts** use design capacity by risk, without an origin/attempt-based Astra escalation.
- **Quota** switches each new execution to the other qualified tool. Only neither fitting parks capacity with
  durable resumeAt after current work reaches a safe point; no quota question goes to the owner.
- **Human gates**: `waiting_gate` plus a macOS notification; it never sets `PANDACORP_OWNER_RELEASE_OK`.
- **Death** (expired Codex session, Mac asleep with the lid closed on battery): the work stays at the last safe
  point; `/pandacorp:implement --resume` continues it.
- At the end it runs `finish`; the report is in Mission Control and at the path `summary` names.

## 6. Never

Spawn, kill or signal the drive process; edit `build/drive/*`, `handoff.json`, the lease or the token file; start
`drive` by hand (the `--drive` option uses `handoff --reason manual`); release the lease because Claude hit a limit;
add Claude to anything drive runs; promise the owner that drive returns to Claude by itself.
