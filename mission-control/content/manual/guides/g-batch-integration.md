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
after exit 21 or an advanced main. The standards and decision-rule
Reference catalogs expose the canonical BUILD-4 / DR-141 contract automatically.
Existing projects receive the guide and always-applicable quality rule through `/pandacorp:upgrade`
(overlay 8.114.0); no sibling project is modified by this factory change.
