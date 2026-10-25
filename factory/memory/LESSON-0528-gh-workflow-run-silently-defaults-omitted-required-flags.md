---
id: LESSON-0528
type: gotcha
domain: ci-cd
tags: [github-actions, gh-cli, workflow-dispatch, silent-default]
context: dispatching a GitHub Actions workflow via `gh workflow run <name> -f key=value ...` that declares `workflow_dispatch` inputs
trigger: use this when handing an owner (or running yourself) a `gh workflow run` command for a workflow that has `workflow_dispatch` inputs — verify every declared input is passed, not just the ones that seem necessary
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — two separate incidents: a `gh workflow run modal-deploy.yml` command handed to the owner omitted the required `-f sha=<deployed sha>` input; and `gh workflow run \"Independent maintenance\"` run without `-f environment=production` silently ran against the `development` environment instead and failed on missing config there"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** two separate `gh workflow run` dispatch commands each omitted one of the workflow's
declared `workflow_dispatch` inputs. Neither `gh` nor the workflow itself refused to run — GitHub Actions
silently fell back to each input's declared default (an empty/placeholder SHA in one case, the
`development` environment in the other) rather than erroring that a required-looking input was missing.
One run deployed against the wrong commit reference; the other ran against the wrong environment and
failed later on missing environment-specific configuration, rather than failing immediately and clearly.

**Lesson:** `workflow_dispatch` inputs in GitHub Actions are not enforced as "required" by `gh workflow
run` at dispatch time the way a CLI argument parser would — a workflow happily starts with its declared
default for any input you don't pass, even when that default is wrong or a placeholder for the exact use
case you're running it for. The failure this produces (wrong commit deployed, wrong environment targeted)
surfaces later and looks like a config/environment bug, not a dispatch-command mistake.

**Apply next time:** before handing over or running a `gh workflow run` command, open the workflow file
and check every `workflow_dispatch` input's declared default — if a default is a placeholder, or wrong
for the specific run being requested (a deploy's commit SHA, a maintenance job's target environment),
pass that input explicitly with `-f`, never rely on "the workflow will complain if something's missing."
It will not; it will run with the default.
