---
name: implement
description: Starts and runs the build. Codex and Claude Code have full
  read/write access; use runtime-local tools, attended sequential fallback and
  the same verification gates. Use inside the project after
  /pandacorp:architecture.
---

# /pandacorp:implement

**This is the command that starts (and resumes) the build. The active runtime selects its own executor; runtimes never call one another.** Under Claude Code it launches the **dynamic workflow** `pandacorp-build`, a native Claude Code JS script that runs in the background and builds in **GLOBAL WAVES** (DR-050 + BL-0021). **Codex is equally authorized and uses native attended execution or its supported targeted launcher (DR-133).** The executor reads each blueprint's Build Plan and the work-order frontmatter **`implementation_status`** as canonical state, and requires an independent review/test gate before an FRD becomes `VERIFIED`.

Runs inside the project.

## Team

- architect
- implementer
- reviewer
- researcher
- analytics
- security-auditor
- librarian
