---
description: Reports a bug found while testing a Pandacorp project. You describe the bug in plain language and the skill documents it in the project's docs/bugs/ inbox; the build in progress (/pandacorp:implement) picks it up at its next safe point. It fixes nothing — it only documents. Runs INSIDE the project.
---

# /pandacorp:bug

The channel to **report a bug** without stopping the build or setting anything up in Mission Control. You run it in the project folder, tell it the bug in plain language, and the skill leaves it noted in the **inbox** `docs/bugs/`. The `/pandacorp:implement` that is running picks it up at its next safe point (end of work order) and fixes it with a regression test.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill writes to the project's `docs/`, so first confirm the Pandacorp marker: `docs/status.yaml` exists **and** `CLAUDE.md` contains `Origin — Pandacorp`. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Don't proceed or invent docs over a missing structure.

`$ARGUMENTS` (or the conversation): the description of the bug (e.g.: `/pandacorp:bug "the save button does nothing when you press enter"`).

## Steps

1. **Capture** the description. If something key for reproducing it is missing, ask the MINIMUM (steps, what you expected vs. what happened, on which screen/flow). Don't investigate in depth or try to fix it — this is just documenting.
2. **Write** `docs/bugs/<slug>.md` (short slug in English derived from the title), with:
   - `title`, `date`, estimated `severity` (`critical` blocks a flow / `normal` / `minor`)
   - **steps to reproduce**, **expected result**, **actual result**
   - which FRD/screen it falls in, if known
   - `status: pending`
3. **Increment** `pending_bugs` in `docs/status.yaml` (Mission Control shows it as a per-project chip).
4. **Confirm** to the owner: "noted in the inbox; `/implement` will take it at its next safe point." If there is NO build running and they want to fix it now, tell them to run `/pandacorp:implement` (which empties the inbox).

## Rules

- It **does not fix** the bug or touch code. It only documents. (The one who fixes is the `implement` loop, which creates the regression test first — DR-015.)
- A bug in the inbox is never deleted by hand: when it is closed, `implement` marks it `resolved` with the commit of the fix.
- If what the owner describes is NOT a bug but a change/feature ("I also want it to do X"), redirect them to `/pandacorp:iterate`. If it is answering something the AI asked, to `/pandacorp:decide`.
