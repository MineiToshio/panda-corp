---
id: LESSON-0292
type: gotcha
domain: infra
tags: [git, gh-cli, ssh, credential-helper, scaffold]
context: pushing a newly scaffolded project's repository for the first time, right after confirming `gh` is authenticated
trigger: use this when a freshly scaffolded project's first `git push` fails right after `gh auth status` reported authenticated
source: "panda-corp 2026-10-12, two independent occurrences the same day across two different new project scaffolds — Funko Tracker and PandaSaga: both had `gh` authenticated but the first push failed with a `publickey` error; fixed by switching the new repository's `origin` remote to HTTPS and invoking `gh`'s credential helper per-command, without changing any global git/auth config"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `gh auth status` reporting "authenticated" only confirms `gh`'s OWN HTTPS-token-based
session with GitHub's API — it says nothing about whether the machine's SSH key setup (what a plain
`git push` over an `ssh://`/`git@` remote actually uses) is configured or working. Two freshly scaffolded
projects, same session, both hit this: `gh` authenticated, first `git push` failed `publickey`.

**Lesson:** `gh` authentication and git-over-SSH authentication are two SEPARATE credential paths that
can be in different states on the same machine — one being green gives no evidence about the other. The
fix that worked both times did not require touching any global git/SSH config: point the new repo's
`origin` remote at the HTTPS URL and let `gh`'s own credential helper handle auth per push.

**Apply next time:** when a freshly scaffolded project's first push fails with a `publickey`/SSH auth
error despite `gh auth status` showing authenticated, do not assume a broader SSH-key problem needing a
global fix — first try switching that repo's `origin` to HTTPS and pushing via `gh`'s credential helper
(`git remote set-url origin https://github.com/<org>/<repo>.git`), which is scoped to the one repo and
doesn't touch the owner's global git/auth settings.
