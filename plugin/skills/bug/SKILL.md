---
name: bug
user-invocable: false
description: Internal bug-case engine reached through /pandacorp:implement. Prepares reproduction evidence and a tests-first regression case for the explicitly selected scope. Capture-only requests become validated draft cards; there is no automatic queue drain.
---

# /pandacorp:bug

Internal bug-case engine. Runs INSIDE the project and is hidden from the owner's slash menu. `/pandacorp:implement` is the single owner entry for a bug, feature, change or resumed build. It selects the conversed scope, an explicit card, or the pending plan; this engine never selects other cards.

> **Preflight (DR-045) — is this a Pandacorp project?** This internal engine prepares a bug case within the scope selected by `/pandacorp:implement`, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) — **but if a build is running (`bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-build-liveness.sh" .pandacorp/status.yaml` returns `RUNNING`, including a fresh fenced lease; malformed leases fail closed) do NOT run `/pandacorp:upgrade` mid-build: it must never regenerate the engine/gates under a live build (its own active-build guard also refuses).** Never upgrade or mutate a live run's plan concurrently; a new mid-run request is captured as a draft for a later explicit build.

`$ARGUMENTS` (or the selected card): the bug description, reproduction steps and expected versus actual behavior.

## Steps

1. **Bound the case.** Read the selected scope and affected FRD/work orders. Capture the minimum reproduction steps, expected behavior and actual behavior. Never expand the request to unrelated bugs.
2. **Capture only when requested.** For "anótalo", write `.pandacorp/inbox/changes/<slug>.md` with `type: bug`, `status: draft`, `engine: v2`, `origin: conversation`, date, class and affected FRDs. Use the card schema and session protocol in `../implement/references/engine-v2.md`: Spanish body with **Dentro** (points citing the owner's words), **Fuera**, **Dudas**, and reproduction evidence. Validate with `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" card check .pandacorp/inbox/changes/<slug>.md`. Correct validation errors before reporting the slug; stop without starting a build. A new bug reported during a live run follows this same draft path and is never injected into that run.
3. **Prepare an ordered fix.** For "impleméntalo", return the case to the `implement` session protocol: a cited scope card is validated before detection/preflight. The CLI's docs unit updates the affected FRD/work orders on `lane/<run_id>/integration`; a regression test must fail on the reported bug before the fix. Record the evidence in `.pandacorp/comms/progress.md`. Only the selected scope is built, with independent review and the normal gates.
4. **Report actual evidence.** A saved draft is "anotado", not fixed or scheduled. A built fix is reported from the CLI summary with its test result and landing state; production landing still needs the owner's order.

## Rules

- Never drain the queue, promise automatic pickup or mark a bug ready merely because it was described. A later `/pandacorp:implement <slug>` explicitly selects a saved card.
- Never edit build state, work-order frontmatter or tracked files in the main checkout during a run. The CLI owns commits, transitions and verify-then-archive closure; cards are moved to `done/`, never deleted.
- A feature request uses the same `/pandacorp:implement` entry and its internal `iterate` planning. Answers to a pending owner decision go through `/pandacorp:decide`.
