---
id: LESSON-0701
type: gotcha
domain: deployment
tags: [vercel, account-blocked, deploy, git-integration, diagnosis, recovery]
context: a deploy pipeline looks stuck or production looks stale (serving an old commit) while GitHub shows main advancing normally, and the instinct is to blame app-level revalidation/caching logic
trigger: use this when production appears frozen on an old commit while main keeps advancing, especially right after changing a caching/revalidation protocol and seeing unexpected 400s from what looks like the live server
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11-20 (agent-inferred): Vercel 'Account is blocked' left production on the last good deploy while main advanced; diagnosed via gh api commits/<sha>/statuses; recovered via an empty commit to main (owner-ordered) after the block was lifted — commit a376f17f 'chore(deploy): redeploy main after Vercel account unblock'"
provenance: agent-inferred
created: 2026-11-20
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0639, LESSON-0693]
---

**Situation:** Vercel silently put an account into an "Account is blocked" state. Production kept serving
the last deployment that had succeeded before the block, while GitHub's `main` branch kept advancing
normally (commits, CI, everything green on the GitHub side). A newly shipped signed-cache protocol change
then started getting HTTP 400 from what looked like the live server, which read at first like an app-level
revalidation bug — it was actually the OLD pre-change deployment still running, rejecting requests shaped
for the new protocol it had never seen.

**Lesson:** Vercel's Git integration only produces a new deployment when the platform actually accepts the
push; an account-level block (billing, abuse flag, etc.) can silently stop that without failing the GitHub
side at all, so "main advanced and CI is green" is NOT proof that production is running that commit (this
sharpens LESSON-0639's "deploy success is a pipeline signal, not proof of live state" to a specific root
cause: the pipeline's own dashboard may show nothing wrong because the block happens upstream of it).
A 400 that looks like a logic bug in brand-new code is often actually version skew — the server answering
is older than the client/caller assumes.

**Apply next time:** when production looks frozen on an old commit or a freshly-deployed feature produces
unexplained errors, check the actual deployed commit's status BEFORE debugging app logic: `gh api
repos/<owner>/<repo>/commits/<sha>/statuses` (or the Vercel dashboard's own deployment list) to confirm
whether a deployment was ever created for the suspect commit, and check the Vercel account/billing status
for a block. Once the block is lifted, do not assume deploys resume automatically: Vercel's Git
integration does not retroactively deploy commits it missed while blocked, so nothing redeploys on its own
— push an empty commit to `main` (`git commit --allow-empty`, only with the owner's order per DR-138) to
force a fresh deployment of the current `main` tip.
