---
id: LESSON-0542
type: gotcha
domain: database
tags: [postgres, sequence, setval, last_value, is_called, privileges, load-test, restore]
context: restoring a Postgres sequence's state (`last_value`/`is_called`) after a load test, a data restore, or a rollback
trigger: use this when restoring or resetting a Postgres sequence's `last_value`/`is_called` after a load test, snapshot restore, or rollback — before normalizing it to `max(id)+1` for convenience, and before assuming the acting role can call `setval`
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-27 (agent-inferred) — in load-test trials, normalizing a restored sequence to max(id) masked a real catalog_change_pkey collision that the actual captured last_value/is_called would have exposed; separately, the Ops role lacked UPDATE privilege on the sequence needed for setval to succeed"
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** while restoring database state after a load test, a Postgres sequence's `last_value`/
`is_called` were normalized to `max(id)` instead of being restored to their real captured values. This
normalization silently hid a genuine primary-key collision (`catalog_change_pkey`) that the real
sequence state would have surfaced immediately. Separately, the role performing the restore (`Ops`)
turned out not to have `UPDATE` privilege on the sequence object, which `setval` requires — an
operation that can fail or silently no-op depending on how errors are handled upstream.

**Lesson:** "normalize the sequence to the next free id" and "restore the sequence to what it actually
was" are different operations with different failure-detection properties — the normalized version is
convenient but actively destroys the evidence a collision would have left behind. Likewise, `setval`
is a privileged write against the sequence object specifically (not the table), and a role scoped for
ordinary row-level Ops work may lack it even when it can read/write the table itself — an assumption
worth checking explicitly rather than discovering via a silent failure mid-restore.

**Apply next time:** when restoring a Postgres sequence after a load test/snapshot/rollback, restore
the EXACT captured `last_value`/`is_called` pair rather than normalizing to `max(id)+1` — a collision
that the real values would expose is a real bug to fix, not noise to normalize away. Before calling
`setval`, verify the acting role's effective privileges on that specific sequence object (not just the
table), and grant/escalate explicitly if it lacks `UPDATE` rather than assuming table-level access is
sufficient.
