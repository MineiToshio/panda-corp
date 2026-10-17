---
id: LESSON-0368
type: gotcha
domain: deploy
tags: [bash, set-e, pipefail, lsof, polling-loop, deploy-script]
context: a bash deploy script running under `set -e`/`set -o pipefail` that polls `lsof` in a loop to confirm a service bound to its port
trigger: use this when a bash deploy/restart script under `set -e`/`pipefail` polls `lsof` to detect whether a service is listening on a port
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: a local deploy finished its build/restart but exited 1 before the final receipt, even though the new service was already listening on 1987/HTTP 200 — lsof returning no listener on an early poll aborted the whole script under set -e/pipefail"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a deploy script correctly rebuilt and restarted a service, which was genuinely listening and
responding `HTTP 200` by the time the script would have reported success. Instead, the script exited with
code 1 before reaching that final confirmation — because an early iteration of its polling loop ran `lsof`
before the service had bound to the port yet, `lsof` exited non-zero (no listener found), and `set -e`/
`pipefail` treated that single poll's failure as the whole script's failure instead of "not ready yet, try
again."

**Lesson:** `set -e` (and `pipefail`) terminates on ANY non-zero exit, including one that is an EXPECTED,
intermediate state inside a polling loop (lsof reporting "nothing listening yet" is the normal, awaited
condition on early iterations, not an error). A script that doesn't explicitly tolerate that exit code
within the loop will abort before the condition it's polling for ever has a chance to become true.

**Apply next time:** inside any `lsof`-based (or similarly must-eventually-succeed) polling loop running
under `set -e`/`pipefail`, explicitly tolerate the poll's own non-zero result (e.g. `lsof ... || true`,
checked via an explicit conditional rather than relying on the script's global error trap) and keep a
SEPARATE, final bind/health check after the loop exits to confirm the service is actually up — don't let the
loop's own transient failures abort the script before that final check runs.
