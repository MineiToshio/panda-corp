---
name: worktrees
description: Cleans up a repository's git worktrees and leftover branches — the
  parallel sessions (claude/*, codex/*), review folders, temp checkouts and
  build-engine lanes/gates that pile up over weeks. It removes on its own ONLY
  what is provably safe (already merged into the default branch, no uncommitted
  changes, idle, not in use), never touches a locked/deployed worktree, a live
  build's lanes and gates, or the checkout the session stands in, and walks the
  owner through everything else one item at a time in plain Spanish (what it
  contains, where it came from, how old, commits ahead, uncommitted files) with
  a recommendation to integrate or discard. Use it inside a Pandacorp project
  folder or in the factory whenever the owner says "limpia los worktrees",
  "depura las ramas", "tengo muchos worktrees", "qué ramas quedan sin mergear",
  "ordena el repo", or Mission Control's Inicio says a project needs
  `/pandacorp:worktrees`.
---

# /pandacorp:worktrees

Depurates the git worktrees and un-merged branches of the repository you are standing in (a product project or the factory itself). After months away, a raw `git worktree list` is unreadable; this skill turns it into three piles: **removed** (it was safe), **kept** (it must never be touched), and **your call** (each one explained, with a recommendation). Runs in the project folder or the factory; one repository per run.
