---
id: BL-0022
type: bug
area: build-engine
title: "Engine derives project identity from cwd (basename $PWD) — a root-launched session mislabels events and strays track.jsonl"
status: open
severity: p1
opened: 2026-07-02
closed:
source: "owner/conversation 2026-07-02 — live incident during the first global-wave build of mission-control"
closes:
links: [BL-0021, BL-0020, DR-066, DR-086]
---

## Problem

The build engine (`plugin/templates/shared/.claude/workflows/pandacorp-build.js`) identifies the
project **implicitly from the working directory**: the `EMIT`/`GATE_EVENT`/`ACHIEVEMENT`/
`WO_COMMIT_EVENT` printf templates stamp `"project":"$(basename \"$PWD\")"`, and `TRACK` appends to
the **relative** path `.pandacorp/track.jsonl`. Workflow subagents inherit the SESSION's working
directory — not the directory the launching conversation happens to `cd` into for its own commands.

**Live incident (2026-07-02, mission-control build):** the owner launched `/pandacorp:implement`
from a conversation opened at the FACTORY root (`panda-corp/`), where mission-control lives as a
subfolder. The interactive skill steps landed correctly (the conversation agent cd's:
`mission-control/.pandacorp/run/build.lock`, status.yaml, SupervisorTicks tagged
`mission-control`), and the build agents found the right files (paths hunted successfully — the
gate reviewed `frd-02-ideas-board`). But the ENGINE subagents ran with cwd = factory root:
- 18+ engine events (`AgentWorking`, `gate`, …) tagged `"project":"panda-corp"` — Mission
  Control's Party filters per-project, so the LIVE build was invisible to its own dashboard.
- A **stray `panda-corp/.pandacorp/track.jsonl`** at the factory root collected the run's durable
  timing lines while `mission-control/.pandacorp/track.jsonl` stayed frozen — the DR-086 timeline
  (and any DR-100-style calibration over it) silently reads an empty run.
The run had to be stopped and relaunched from the project folder.

## Root cause

Project identity is an ambient property (cwd) instead of an explicit parameter. Nothing pins the
Workflow's subagents to the project directory: the engine assumes "session cwd == project root",
which only holds when the conversation is opened in the project folder.

## Plan

Make the project identity and root EXPLICIT, end to end:

1. **`args.projectDir`** (absolute path) and **`args.project`** (the event key — the folder
   basename): the implement skill resolves both at launch (it already knows the project root —
   where it found `.pandacorp/status.yaml`) and passes them to
   `Workflow({ name: 'pandacorp-build', args })`.
2. Engine derivations: `const PROJECT_DIR = args.projectDir || '.'`, `const PROJECT = args.project
   || '$(basename "$PWD")'` (back-compat fallback). Then:
   - `EMIT`/`GATE_EVENT`/`ACHIEVEMENT`/`WO_COMMIT_EVENT` stamp `"project":"${PROJECT}"` (a literal,
     no shell substitution when provided).
   - `TRACK` appends to `${PROJECT_DIR}/.pandacorp/track.jsonl`.
   - Every agent prompt gets a one-line preamble: `Work from the project root ${PROJECT_DIR} — cd
     there FIRST; every relative path below is relative to it.` (one string constant prepended in
     `agent()` call sites via a small helper, not N hand edits).
3. **Fail-loud guard**: the engine's first step asserts `${PROJECT_DIR}/.pandacorp/status.yaml`
   exists; if not, stop immediately with a clear message (never plan against the wrong tree).
4. The implement skill docs note the fix: launching from any cwd is now safe.

## Proof

- Simulation harness (scratchpad `engine-sim/harness.mjs` pattern): assert the EMIT/TRACK strings
  contain the explicit project + absolute track path when `args.projectDir`/`args.project` are set,
  and the legacy `$PWD` form when absent.
- Real validation: relaunch a build from a factory-root conversation on purpose — events must come
  tagged with the project folder name and track.jsonl lines must land in the project.
