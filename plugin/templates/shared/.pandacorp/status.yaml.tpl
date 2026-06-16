# Machine-readable project status for {{PROJECT_NAME}} — read by the Pandacorp factory and Mission Control (live).
# Human-readable Spanish narrative (summary, pending items) lives in .pandacorp/comms/summary.md (gitignored, owner-facing).
project: "{{PROJECT_NAME}}"
phase: product   # product | design | architecture | implementation | release | operation
version: v1
overlay_version: "{{OVERLAY_VERSION}}"  # Pandacorp overlay version this project carries; /pandacorp:upgrade bumps it
created_with: "{{OVERLAY_VERSION}}"     # overlay version the project was born/adopted with (immutable)
running: false    # true while /pandacorp:implement is actively building
repo: ""          # GitHub repo URL once it exists
updated_at: "{{DATE}}"
work_orders_total: 0
work_orders_done: 0
pending_decisions: 0   # number of open entries in .pandacorp/inbox/decisions.md (Mission Control highlights them)
pending_bugs: 0        # number of bugs in the .pandacorp/inbox/bugs/ inbox awaiting processing
rethink_pending: false # true if /iterate asked to pause the build for a major change
advance_pending: false # true when the current phase produced output and awaits your "ok, advance" (meanwhile, re-running the phase = iterate in place, DR-032)
last_green_sha: ""     # commit of the last work order closed green (written by the gate, not the agent)
safe_to_test: false    # true only when HEAD == last_green_sha (nothing uncommitted) → "testable point"
