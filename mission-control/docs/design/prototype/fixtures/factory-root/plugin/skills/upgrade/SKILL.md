---
name: upgrade
description: Upgrades a Pandacorp project's overlay (the .pandacorp/ integration
  layer, CLAUDE.md/AGENTS.md imports and the build machinery) to the factory's
  current version. Runs INSIDE a project. Detects the version gap, migrates the
  structure if needed, regenerates the managed layer non-destructively, bumps
  overlay_version and commits on its own. Compatible bumps apply silently; a
  breaking (MAJOR) jump is announced first. Usually triggered automatically by a
  skill's preflight (DR-048).
---

# /pandacorp:upgrade

Brings this project's Pandacorp overlay up to the factory's current version. The `/pandacorp:*` skills always run against the **latest** plugin, so a project born on an older overlay can drift; this closes the gap. Runs IN the project. It touches only the overlay/integration layer — never product code or `docs/`.

Runs inside the project.

## Team

- architect
- analytics
