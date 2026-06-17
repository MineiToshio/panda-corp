# Build orchestration standard (DR-050)

How the factory plans, tracks and runs a build. The orchestration is **driven by the documents** —
state and plans live in structured data the build engine reads, not in the engine's runtime
inference, not in git, not in body prose. Recovered and systematized from PandaTrack; see
`docs/proposals/11-build-orchestration-v2.md`.

## 1. State lives in the frontmatter (two axes)

Every FRD, blueprint and work order carries two state fields in its YAML frontmatter. The PRD carries
only `status`.

- **`status`** — document lifecycle: `DRAFT → ACTIVE → BLOCKED → SUPERSEDED`. Answers "is this doc the
  current approved source of truth?" A shipped feature can still be `ACTIVE`.
- **`implementation_status`** — the build Kanban, and **the build engine's single source of truth**:

| Value | Meaning | Engine behavior |
|---|---|---|
| `PLANNED` | not built yet | available to build |
| `IN_PROGRESS` | build started | resume it, don't restart |
| `IN_REVIEW` | built, its own tests green, awaiting the FRD review/test gate | not rebuilt; waiting on its FRD |
| `VERIFIED` | FRD review + suite green | **never rebuilt** |
| `BLOCKED` | stuck after a repair pass failed; carries a `blocked_reason` | skipped; surfaced to the owner with the reason |

**Rules:** the engine builds only `PLANNED`/`IN_PROGRESS` and never rebuilds `VERIFIED`. Never
hand-set `VERIFIED` without the FRD gate passing. Changing this field **is** the instruction to the
build — `iterate`/`new-version` reopen a work order by setting it back to `PLANNED`. An FRD's/blueprint's
`implementation_status` **rolls up** from its work orders (the worst non-`VERIFIED` state; `VERIFIED`
only when all are). `.pandacorp/status.yaml` replicates the per-status counts for Mission Control.

## 2. Coarse work orders

A work order is **one cohesive view / page / capability** (e.g. "order detail view + payments panel +
action menu"), NOT one atomic component. Enough context for an agent to build the slice end-to-end;
small enough to review on its own. Typically a handful per FRD — not dozens of tiny ones. Atomic
work orders multiply the per-slice overhead and were a primary cause of slow, expensive builds.

**Disjoint artifacts within a wave.** Work orders that build in parallel must NOT write the same
file/module — parallel implementers collide (a real failure mode, not theoretical: e.g. four WOs all
creating one `lib/x.ts`). Merge such siblings into one coarse work order (preferred), or serialize them
with an explicit dependency. This rule by itself nudges granularity coarser, the right way.

## 3. The Build Plan lives in the blueprint (per FRD)

Each per-FRD `blueprint.md` MUST include a **Build Plan**: the DAG of that FRD's work orders — order,
dependencies (intra- and cross-FRD), what runs in parallel, and the integration order. Written once,
at architecture time. **The engine reads it; it does not re-infer dependencies at runtime.** This is
what makes the build fast (no repeated planning agent) and the integration correct (a consumer is
never built before its provider).

## 4. Hand-off (`## Status Note`)

When a work order closes it writes a hand-off in its `## Status Note`: what it built, the
interfaces/contracts it exposes (names + signatures), the integration seams, and which tests cover
it. The next agent reads the hand-off instead of re-reading all the prior code.

## 5. Test per FRD, not per work order

The build engine reviews and tests **per FRD**, not per work order:

- Building a work order runs only **its own fast self-test** (its tests + tsc) → marks it `IN_REVIEW`.
- When all of an FRD's work orders are `IN_REVIEW`, run **one review + test pass over the whole FRD**,
  which also exercises the work orders **together** (real integration). The gate's tests are **focused**:
  `verify.sh --since <last_green>` runs biome + tsc globally but only the vitest tests **affected since the
  last green** (fast, and scales as the suite grows — it does NOT re-run the whole suite every gate). The
  **full** suite runs once at **close-out**. On pass → every work order + the FRD become `VERIFIED`.
- **Three test layers** at the FRD gate: (1) unit/component (per WO during build); (2) integration +
  adversarial review across the feature; (3) **functional/browser** (start the app and drive the real
  flows with the harness `preview_*` tools) — designed in, **opt-in per project** (default off; on for critical web
  flows). This moves review cost from O(work orders) to O(FRDs).

## 6. How a run stops — health & budget, never a feature count

The build **runs to completion** by default (owner decision 2026-06-16). It does NOT stop after N
features: one feature can cost 10x another, so a count protects neither tokens nor progress. A run
stops only when:

- **Nothing is left** — every FRD is `VERIFIED` → `phase: release`.
- **Budget ceiling** — `maxSpend` (an absolute output-token ceiling via `budget.spent()`, works without a
  `+Nk` directive) or a `+Nk` turn directive is nearly spent → stop at the last safe point (a commit).
  For overnight runs, `maxSpend` is the real token guardrail.
- **Health breaker** — too many features `BLOCKED` in a row (default 3, excluding `external`) → stop;
  something is systemically wrong.
- **Needs the owner** — what remains is `BLOCKED: needs-owner`.

`maxFrds` bounds a deliberate, **supervised test run** and counts features **processed** (built + blocked +
**reopened** — a reopen counts, so chained reopens can't slip past the cap; a bug the 2026-06-16 overnight
test caught). It is never the overnight guardrail; `maxSpend` is.

**Repair before block (the owner's rule).** When a work order or the FRD gate fails, the engine first
runs a **repair pass** (a strong-model agent diagnoses and tries to fix, re-verifying with
`verify.sh`). Only when the fix is genuinely out of reach does the feature go `BLOCKED`, and the block
carries a **`blocked_reason`**:

| `blocked_reason` | Meaning | What happens |
|---|---|---|
| `needs-owner` | a human must act: env var/secret, external account, product decision | logged to `.pandacorp/inbox/decisions.md`; owner notified; build continues with independent FRDs |
| `external` | transient outside failure (no internet, upstream 5xx) | retried on a later run; does NOT trip the health breaker |
| `error` | an unresolved technical fault | surfaced; build continues with independent FRDs |

A blocked FRD never halts the whole build unless it's a dependency of everything left, or the health
breaker trips. Notifications are macOS-desktop (`osascript`) from the engine plus a phone
`PushNotification` from the supervising agent when Remote Control is on (no third-party push app).

## 7. The build supervisor (unattended runs)

Launching a build is **never** just firing the workflow — it is always paired with a **live supervisor**
(the agent that runs `implement`), so an unattended/overnight run can't stall silently or run away on
tokens. The supervisor:

- **Watches live** with `Monitor` — a ~2-min bash poll (costs **no tokens**; only an emitted event wakes
  it) over `.pandacorp/status.yaml`, the run's journal mtime + active agents (frozen?), and the agent
  count (a spend proxy). It emits on: an FRD verified, **frozen** (~15 min no activity), a new block,
  pace below target, or run end. It covers the failure signatures, not just success — "silence is not success".
- **Heartbeats** ~every 15 min so the owner isn't left guessing.
- **Reacts**: a stall → unstick it; a block → the engine already attempted a repair; if the run is wedged
  or over budget → **stop it and notify**. Notifications: the engine fires a macOS desktop notification
  (`osascript`); the supervisor also sends a phone `PushNotification` (when Remote Control is on). No
  third-party push app.
- **Feeds the self-learning loop (DR-047)**: when it unsticks something it classifies it — uncontrollable
  (internet, upstream 5xx) → nothing to learn; **avoidable** (a recurring pattern, an engine bug, a config)
  → capture the lesson to `factory/memory/_inbox.md` and, if fixable factory-wide, fix it on the spot.
- **Holds a session budget ceiling**: it tracks cumulative agents/runs (a spend proxy) and stops + notifies
  at the owner's ceiling (it can't read exact plan usage, so the ceiling is conservative).

The operable detail lives in the `implement` skill ("Unattended operation — the build supervisor"); this
section is the canonical statement that the supervisor is **mandatory**, not optional.

## 8. Templates

The standard is embodied in `${CLAUDE_PLUGIN_ROOT}/templates/docs/`: `prd-template.md`,
`frd-template.md`, `blueprint-template.md` (with the Build Plan), `work-order-template.md` (with the
Status Note). The product-phase skills (`spec`/`blueprint`/`work-orders`) generate from these; the
build engine (`implement`) consumes them; `iterate`/`new-version` reopen work orders through them.

## 9. Concurrent-run guard (heartbeat-based lock)

Only ONE build may run on a project at a time. A second `/pandacorp:implement` on the same project
while one is already active would cause race conditions on the frontmatter (double-pickup of the same
work order), `status.yaml` corruption, and conflicting git commits.

**The mechanism: TTL lock via supervisor heartbeat.**

`status.yaml` carries three fields written at launch and cleared on close:

```yaml
running: true
run_started_at: "2026-06-17T10:00:00Z"   # set once at launch
supervisor_heartbeat: "2026-06-17T10:08:30Z"  # updated every ~2 min by the supervisor
```

The **supervisor** (the agent that runs `implement`) writes `supervisor_heartbeat` to `status.yaml`
on every Monitor tick (~2 min). This is the liveness signal — as long as the supervisor is alive, the
heartbeat stays fresh.

The **`implement` preflight** checks, after confirming `status.yaml` exists:

| `running` | `supervisor_heartbeat` age | Action |
|---|---|---|
| `false` (or absent) | — | proceed normally |
| `true` | < 10 min | **ABORT**: tell the owner (in Spanish) there is already an active build; include `run_started_at` so they know when it started. Don't launch. |
| `true` | ≥ 10 min (or field missing) | **Stale lock**: supervisor died (internet cut, crash, etc.). Warn the owner, reset `running: false` + clear `supervisor_heartbeat`, then proceed. |

**Why 10 minutes?** The supervisor heartbeats every ~2 min. Five missed heartbeats (10 min of
silence) is a conservative signal that it is genuinely dead, not just slow. This avoids false
positives while still auto-recovering quickly after a crash.

**Zombie recovery is automatic.** The owner never needs to hand-edit `status.yaml` to clear a stale
lock — the next `implement` detects the stale heartbeat and resets it. If a run was interrupted
mid-build, the frontmatter state (`implementation_status`) is still valid and the resumable engine
picks up from where it left off without rebuilding `VERIFIED` work orders.
