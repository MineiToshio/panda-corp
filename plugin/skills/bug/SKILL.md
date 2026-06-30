---
user-invocable: false
description: Reports a bug found while testing a Pandacorp project. You describe the bug in plain language and the skill documents it in the project's unified change queue .pandacorp/inbox/changes/ (as type bug); the build in progress (/pandacorp:implement) picks it up at its next safe point. It fixes nothing — it only documents. Reachable through the single front door /pandacorp:change, which classifies bug vs feature for you. Runs INSIDE the project.
---

# /pandacorp:bug

The channel to **report a bug** without stopping the build or setting anything up in Mission Control. You run it in the project folder, tell it the bug in plain language, and the skill leaves it noted in the **unified change queue** `.pandacorp/inbox/changes/` (as `type: bug`). The `/pandacorp:implement` that is running drains it at its next safe point (end of work order) and fixes it with a regression test.

> **One door (DR-069):** `bug` is now reachable through the single owner front door **`/pandacorp:change`** (which classifies "bug vs feature" for you so you only remember one command). `bug` still works directly as a labelled alias + is the **internal engine** that `change` and the build invoke for the bug case.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill writes to the project's `.pandacorp/inbox/`, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) so this skill runs against the current structure. Don't proceed or invent docs over a missing structure.

`$ARGUMENTS` (or the conversation): the description of the bug (e.g.: `/pandacorp:bug "the save button does nothing when you press enter"`).

## Steps

1. **Capture** the description. If something key for reproducing it is missing, ask the MINIMUM (steps, what you expected vs. what happened, on which screen/flow). Don't investigate in depth or try to fix it — this is just documenting.
2. **Write** `.pandacorp/inbox/changes/<slug>.md` (following `${CLAUDE_PLUGIN_ROOT}/templates/docs/change-request-template.md`; short slug in English derived from the title), with:
   - frontmatter (machine): `type: bug`, `class` (`expedite` if it blocks a flow, else `standard`), `status: pending`, `date`, `frd` (the FRD/screen if known)
   - body (**español**): **pasos para reproducir**, **resultado esperado**, **resultado actual**
   - append a row to the queue index `.pandacorp/inbox/changes/README.md` (following `${CLAUDE_PLUGIN_ROOT}/templates/docs/changes-readme-template.md`)
3. **Increment** `pending_changes` in `.pandacorp/status.yaml` (Mission Control surfaces it).
4. **Confirm** to the owner: "noted in the inbox; `/implement` will take it at its next safe point." If there is NO build running and they want to fix it now, tell them to run `/pandacorp:implement` (which empties the inbox).

## Rules

- It **does not fix** the bug or touch code. It only documents. (The one who fixes is the `implement` loop, which creates the regression test first — DR-015.)
- A bug in the inbox is never deleted by hand: when it is closed, `implement` marks it `resolved` with the commit of the fix.
- If what the owner describes is NOT a bug but a change/feature ("I also want it to do X"), redirect them to `/pandacorp:iterate`. If it is answering something the AI asked, to `/pandacorp:decide`.
