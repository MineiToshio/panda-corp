# Decision registry — how to navigate 100+ DRs

`registry.yaml` is the factory's **policy** store: recurring decisions with a pre-approved default
(`patron` → `default`, `requiere_humano`, optional `nota` with the why/history). It answers *"what do we
do when X?"* — the decision **logs** answer *"how did we get here?"* (history), and the canonical docs
answer *"what is true now?"*. One entry per rule, ids monotonic (`DR-NNN`), never reuse an id (a lost id
gets a tombstone — see DR-082..084).

**How to consult it:** grep by keyword (`grep -n "worktree" registry.yaml`), or by id. Mission Control's
Manual derives a browsable catalog from this file automatically (DR-046) — this index is the in-repo map.

## Category map (by id range and theme)

| Theme | Key DRs |
|---|---|
| Funnel & ideas (score, discard, cards) | DR-011, DR-039, DR-042 (return_type), DR-053 (profile) |
| Language & conventions | DR-009 (committed=English), DR-012 (scope), DR-040 (git direct-main) |
| Human gates | DR-002 (stack), DR-004 (production), DR-005 (money), DR-007 (delete), DR-008 (external comms), DR-038 (push), **DR-104 (mechanical enforcement)** |
| Governance & meta | DR-024..030, DR-046 (Manual sync), DR-103 (three planes / backlog) |
| Spec & product docs | DR-035 (payments), DR-041 (launch market), DR-049 (feature-centric docs), DR-095 (clarification gate), DR-100 (readiness gate) |
| Design | DR-054..058, DR-061/062, DR-064, DR-074 (platforms), DR-075 (shell), DR-098 (no house style), DR-101 |
| Architecture | DR-102 (repo grounding), DR-087 (dependsOn), DR-022 (ports) |
| Build engine & orchestration | DR-013/014, DR-050 (coarse WOs/Build Plan), DR-060 (disjoint artifacts), DR-063, DR-065..073 (repair/patch/budgets/queue), DR-069 (change queue), DR-085 (lifecycle), DR-086 (commit-per-WO), DR-097 |
| Gates & verification | DR-015..019, DR-055/056, DR-072 (split gate), DR-076 (back-port), DR-077 (doc-lint), DR-078 (fail-loud data), DR-079 (canary), DR-080 |
| Parallelism & sessions | DR-090 (review worktrees), DR-093, DR-096, DR-099 |
| Post-launch & learning | DR-043 (review-launch), DR-047 (memory), DR-048/051 (overlay/rules propagation), DR-052 (toolchain), DR-059 (canonical configs) |
| Stacks | DR-021 (DB), DR-052, **DR-105 (B/C/D provisional)** |

(Ranges are indicative — always grep; a DR can touch several themes. Spanish keys `patron`/`nota`/
`requiere_humano` are a pending migration noted in DR-009.)

## Adding a rule

Escalate to the owner ONCE, codify the answer as a new DR (next free id — check the tail AND grep the id
repo-wide before taking it), record the story in `factory/decision-log.md`, and update the canonical doc
the rule governs. A rule that changes an existing DR **amends it in place** (note the amendment + date in
`nota`) — don't fork a near-duplicate DR.
