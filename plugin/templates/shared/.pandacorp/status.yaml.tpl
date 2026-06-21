# Machine-readable project status for {{PROJECT_NAME}} — read by the Pandacorp factory and Mission Control (live).
# Human-readable Spanish narrative (summary, pending items) lives in .pandacorp/comms/summary.md (gitignored, owner-facing).
project: "{{PROJECT_NAME}}"
phase: product   # product | design | architecture | implementation | release | operation
version: v1
target_platforms: responsive  # desktop | mobile | responsive — the gate asserts mobile widths only when this includes mobile (DR-074)
overlay_version: "{{OVERLAY_VERSION}}"  # Pandacorp overlay version this project carries; /pandacorp:upgrade bumps it
created_with: "{{OVERLAY_VERSION}}"     # overlay version the project was born/adopted with (immutable)
running: false    # true while /pandacorp:implement is actively building. OBSERVABILITY FIDELITY (DR-066): NEVER read `running` alone as proof of life — a consumer (Mission Control / any monitor) must cross it with heartbeat recency: live ⇔ running AND (now − supervisor_heartbeat) < ~3·tick; show "datos de hace X" past that and "sin señal" at ≥10 min. A frozen `running:true` is NOT live.
run_started_at: ""        # ISO timestamp set once when the build launches (concurrent-run guard, DR-050 §9)
supervisor_heartbeat: ""  # ISO timestamp advanced every ~2 min by the supervisor — liveness of the WATCHER (DR-066/DR-050 §9). Stale ≥10 min ⇒ supervisor dead.
last_event_at: ""         # ISO timestamp advanced by the PRODUCER (build engine) at every safe point (FRD gate, sync, close-out) — liveness of the BUILD ITSELF (DR-066)
repo: ""          # GitHub repo URL once it exists
dev_port_base: 0  # base of this project's 10-wide dev-port block, reserved from the factory ledger (factory/ports.yaml) by /scaffold; 0 = not yet allocated. app=base+0 (.claude/launch.json), review app=+1, Postgres +2/+3, Redis +4/+5. See factory/standards/infra.md
updated_at: "{{DATE}}"
work_orders_total: 0
work_orders_done: 0
pending_decisions: 0   # number of open entries in .pandacorp/inbox/decisions.md (Mission Control highlights them)
pending_bugs: 0        # number of bugs in the .pandacorp/inbox/bugs/ inbox awaiting processing
rethink_pending: false # true if /iterate asked to pause the build for a major change
advance_pending: false # true when the current phase produced output and awaits your "ok, advance" (meanwhile, re-running the phase = iterate in place, DR-032)
last_green_sha: ""     # commit of the last work order closed green (written by the gate, not the agent)
safe_to_test: false    # true only when HEAD == last_green_sha (nothing uncommitted) → "testable point"
