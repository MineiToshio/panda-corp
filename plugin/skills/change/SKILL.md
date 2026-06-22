---
description: The SINGLE front door to ask a Pandacorp project for ANY change — a new feature, an adjustment, or a bug. You describe it in plain language; the skill classifies it (feature/change vs bug) and gives it a class of service (urgent vs normal), then files it in the project's change queue (.pandacorp/inbox/changes/) for the build to pick up at its next safe point. It only captures + classifies — it NEVER edits the project's docs or code, and it does NOT need to know whether a build is running. Runs INSIDE the project.
---

# /pandacorp:change

**The one command for "I want something changed or fixed."** You don't have to remember whether it's a feature or a bug — describe it, and `change` classifies it, gives it an **urgency class**, and drops it in the **change queue** `.pandacorp/inbox/changes/`. A running build **drains the queue at its next safe point**; if no build is running, `/pandacorp:implement` empties it when you run it.

**Why this is safe (DR-069):** `change` only **captures + classifies + writes one file** to the queue. **It never edits the project's docs/work-orders/code, and it has NO build-detection logic** — so it cannot mis-detect a running build and corrupt it. The queue is a durable folder; your change waits there safely until the build pulls it **at a safe point** (between features, never mid-feature) and integrates it through the same review/test gate as planned work.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill writes to `.pandacorp/inbox/`, so first confirm the marker `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing one in, `/pandacorp:spec` creates a new one. If `overlay_version` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048).

`$ARGUMENTS` (or the conversation): what you want — e.g. `/pandacorp:change "the save button does nothing on Enter"` or `/pandacorp:change "add a CSV export to the orders table"`.

## Steps

1. **Capture + classify the TYPE.** From the description decide:
   - **bug** (something is broken vs. what's expected) → capture the `bug`-flavored fields (steps · expected · actual · which screen/FRD).
   - **feature / change** (a new capability or an adjustment) → capture the `iterate`-flavored description (desired behavior + context; flag if it needs new design/visual).
   - **an answer to a question the build asked** → this is NOT a change → redirect to `/pandacorp:decide`.
   Ask the **minimum** to make it actionable; do NOT investigate, design, or fix here.
2. **Assign the CLASS of service** (urgency — Kanban classes of service, DR-069):
   - **expedite** — urgent / it breaks something / blocks testing → the build jumps it to the front at the next safe point.
   - **standard** (default) — normal work, taken FIFO when the build reaches it.
   - (`intangible`/`fixed-date` exist for completeness but are rarely needed — default to `standard` unless the owner signals urgency.)
   Propose the class; confirm with the owner only if it's ambiguous or `expedite`.
3. **Flag the cost.** If the change clearly **rebuilds already-`VERIFIED` work** (e.g. "redo screen X completely"), say so in the body so the owner knows — and a big/structural/fundamental change is captured but marked so the build **stops and guides the owner** before doing it (it never silently rebuilds half the app).
4. **Write the change-request** to `.pandacorp/inbox/changes/<slug>.md` (slug in English; **body in Spanish** — this is the gitignored owner layer):
   - frontmatter (machine, English-stable): `type: bug|feature|change`, `class: expedite|standard`, **`status: draft | ready`** (DR-069), `date`, `frd` (affected feature/screen if known), `rebuilds_verified: true|false`, `depends_on` (optional).
   - **`status` — READY vs DRAFT (the build gate, DR-069):** **`ready`** = the description is complete enough to action → the build (`implement`) **drains and builds it**. **`draft`** = captured for visibility but the owner is **still working out the details / it depends on something not done yet** → the build **SKIPS it** until the owner flips it to `ready`. Default to `ready` for a clear, actionable request; use `draft` if the owner says "just note it, it's not ready," if key info is missing, if it needs a design pass first, or if it's **infra/deployment** (not code the build implements — that's a manual/`release` task). The build marks a built item `done`.
   - body (**español**): para un bug — *pasos · esperado · actual*; para feature/cambio — *qué se quiere · contexto · (si toca diseño) "necesita pase de `/design`"*.
   - Append a row to the queue index `.pandacorp/inbox/changes/README.md` (title · type · class · status).
   - Increment `pending_changes` in `.pandacorp/status.yaml` (Mission Control surfaces it).
5. **Confirm** to the owner (Spanish): "Anotado en la cola como **[tipo · clase]**. El build lo toma en su próximo safe point. Si no hay build corriendo, corre `/pandacorp:implement` y lo recoge."

## Rules

- **It does NOT integrate docs or build.** Capture + classify + queue, nothing else. The build (`implement`) drains the queue **at a safe point** and runs the integration — delegating to the **`iterate`** logic (a feature/change → FRD/work-orders/blueprint, calling `work-orders`/`design` as needed) or the **`bug`** logic (a bug → regression test then fix) — and then the **FRD review/test gate**. So a queued change passes the **same quality gate** as planned work and is never edited into the build's docs concurrently (DR-067/069).
- **One door for the owner; `bug` and `iterate` are the internal engines.** You classify internally so the owner only remembers `/change`. `/pandacorp:bug` and `/pandacorp:iterate` still exist (as the engines `change` and the build invoke, and as direct aliases for anyone who prefers them).
- **Only `ready` items are built (DR-069).** The build drains `status: ready` (expedite first, then standard FIFO) and **skips `status: draft`**, leaving it untouched. A `draft` lets the owner **park a half-formed idea in the queue for visibility** — Mission Control shows it — without the build acting on it. The owner promotes it by flipping `draft → ready` (re-run `/change` on it, or edit the file's frontmatter) once it's complete enough to build.
- A queued change is **never hand-deleted**: the build marks it `done` with the fix/feature commit when it lands.
- Keep scope bounded to what was asked (DR-012). Conventional commits in English; the change-request body in Spanish.
