---
title: "Batch integration"
group: guides
order: 14
---

Several finished branches already verified on their own land as one batch (DR-141).
One session records each source SHA, owning change and green evidence, creates one integration
worktree/branch from current main, bootstraps it and merges each source with
`git merge --squash <sha>`, committing with the source SHA and change ID. Resolve conflicts
there and run `bash .pandacorp/merge-queue.sh` once after the whole batch is assembled.
Never run the full integration gate between source merges.

On red, identify the owning change, fix only that defect, commit and re-run once on the combined
result. Unknown attribution or exhausted repair budget is handed back immediately, with the work
preserved. Keep source branches and their mapping: squash does not make their tips ancestors of main.
A single finished change still lands alone; unfinished work stays out.

Production approval remains the owner's explicit order covering the selected batch;
`PANDACORP_OWNER_RELEASE_OK=1` is set only for that authorized landing. Grouping work grants
no release authorization. Branch verification, per-FRD review and the factory backlog engine's
lightweight catalog validator are unchanged.

The landing checklist checks source evidence and queue logs: one full combined pass before repairs,
each later pass linked to an observed red/scoped fix or the existing queue’s safety recheck
after exit 21 or an advanced main. Since DR-146 that recheck is satisfied without a new run when
the rebased tree is byte-identical to one a full `verify.sh` already certified green in that
checkout (logged `[certified-tree]`); any other tree runs the full gate (`[full-gate]`). Commit,
run `verify.sh`, then the queue, and an unchanged main costs no second full run. The standards and decision-rule
Reference catalogs expose the canonical BUILD-4 / DR-141 contract automatically.
Existing projects receive the guide and always-applicable quality rule through `/pandacorp:upgrade`
(overlay 8.114.0); no sibling project is modified by this factory change.


## Close the session resources (DR-145)

The creating coordinator records each new worktree in its session cleanup receipt before
workers start. After merge, stop owned writers, restore the actual session cwd without
removing the directory, then run `.pandacorp/session-cleanup.sh finish --session <root>`.
Wait for the final JSON and exit; a tool yield is not completion. Eligible own merged, clean
worktrees disappear permanently, including generated dependencies/build caches and owned
temporary artifacts, without another owner prompt. Squashed source branches still fail the
ancestor check and remain listed; private/unknown ignored files, locks, deployments, owner
state, active processes and other sessions are preserved. Never force-remove or erase locks.

For a shell-driven implementation the helper's `run --repo <repo> -- <command>` uses finally;
for tool-driven workflows use the explicit create/register/finish protocol in the worktrees
skill. Sandbox workers return changes; a coordinator with actual shared-git/filesystem write
access commits, merges and cleans. A permission denial is reported as a capability blocker,
not resolved by another cleanup authorization. Only the exact cleanup helper is preauthorized;
raw destructive commands retain their deny rules. Historical unregistered tmp files are left.

Plugin 9.150.0 / overlay 8.118.0 delivers the helper and bootstrap registration on normal
safe-point upgrades. This source change does not update other live project checkouts or the
installed plugin. The executable verifier is the real-Git session cleanup regression and
independent adversarial suites, included in the factory engine corpus.
