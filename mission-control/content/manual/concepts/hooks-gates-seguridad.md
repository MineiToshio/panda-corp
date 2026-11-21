---
title: "Hooks, gates y seguridad"
group: concepts
order: 8
---

# Hooks, gates y seguridad

Los gates deterministas y la revisión independiente verifican el trabajo. Los cambios versionados se escriben en integración y pasan por merge-queue para llegar a main; producción requiere la orden del propietario.

> El cuerpo de esta página se compone en React (`src/app/manual/manualPages.tsx`). Este markdown solo respalda el índice del Manual (título, grupo y orden): no edites su prosa aquí.

## Queue completion (proposal 43 phase 1)

Commit → `bash .pandacorp/merge-queue.sh`; plain `verify.sh` is diagnosis.
`--status` reads the current branch without taking the queue lock or writing files:
`implemented-uncertified`, `certified-awaiting-order`, `certified-stale`, or `landed`.
Only current certification awaiting an order, or an observed landing, supports completion.
Ask for the explicit per-landing production order at the start; deferred orders retain exit 21.
A direct launched-main commit needs the queue or a logged owner bypass; main-checkout stamps are diagnosis only.
A green gate whose stamp record was refused cannot ff (exit 11). Diagnosis uses
`verify.sh --diagnose-unit`: all static checks and Vitest without bail, under the host slot, no stamp or browser policy change.
Before re-queueing a repair, run static checks plus all Vitest; for a browser red, the failing spec plus static checks.
Queue and diagnosis test outcomes are shared in main's `test-outcomes.jsonl`; same-tree pass/fail is a flaky suspect, never an automatic exclusion or rerun.

## Attended publication after certification

Obtain the explicit per-landing order at work start. Every detached job removes the release
variable; its queue stops at exit 21 and preserves the committed certified inputs. The attended
coordinator runs the returned foreground `publish_command`, then `land` adopts the exact receipt.
Active pre-push proof requires the original process's kernel lock plus the queue attempt/token;
a reused PID is insufficient. Upgrade checks executable mode before canaries, even for equal content.
