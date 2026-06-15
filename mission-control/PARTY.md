# Party — Agent RPG map

Documents the visualization system for the build subagents in Mission Control
(`mission-control/prototype/index.html`, the `missionBody` function and the `mc*` engine). The
goal is to answer at a glance **which agent is working and which is stalled**,
keeping the RPG aesthetic: the agents are pixel-art characters that walk
through the guild's room between workstations.

## 1. State model

Each agent is always in one of these states. The state is reflected in the
sprite's CSS class (`.mcag.s-<state>`) and in an optional emote above the head.

| State | Class | What you see | Means |
|---|---|---|---|
| Working | `s-work` | At its desk, pulsing **halo** in the role's color + a **progress bar** filling up. Alternates the « … » emote (thinking) and no emote (typing). | Producing right now |
| Walking | `s-walk` | Crosses the map carrying a **package** (`.pkt`) and showing a **speech bubble** (`.say`) with the message it delivers. Faster bounce (bob). | Handoff: pipeline stage transition (e.g. contract ready → frontend) |
| Waiting | `s-idle` | **Dimmed** sprite (opacity 0.45 + slight gray) + « z » emote. | Idle, waiting on someone else |
| Blocked | `s-blocked` | Still + bouncing red **« ! »** emote (RPG quest marker) + red halo. | Needs a decision from the owner |
| Reviewing | `s-review` | Still + amber **« ? »** emote + amber halo. | The reviewer is waiting on/evaluating a deliverable |

Universal color convention (matches the rest of the tools in the
market): **amber = working**, **blue = in transit**, **gray/dimmed =
idle**, **red = needs human attention**.

## 2. Indicator vocabulary

Six indicators, combinable. Defined in the CSS block `Party —
RPG map` and controlled by the engine.

- **Halo** (`.mcag .halo`): pulsing ellipse under the feet. Only on `work`,
  `review`, `blocked`. It's the indicator that communicates "busy" best from afar.
- **Progress bar** (`.mcag .prog`): floating bar above the head that
  fills from 0→100% during the work turn. Only on `work`.
- **Emotes** (`.mcag .emote`): bubble above the head. `…` thinking (blue),
  `?` pending review (amber), `!` blocked (red), `z` waiting (gray).
- **Speech bubble** (`.mcag .say`, via `mcSay()`): during a handoff the
  agent shows above its head the message it delivers (e.g. «contract in
  docs/api.md»), in addition to the line in the log. It temporarily replaces the
  emote while walking.
- **Workstation** (`.mcstation`): each agent has a **fixed station** with a
  **pixel-art background** (the zone image in `IMG[ZONEBG[role]]`), a border in the
  role's color and a **fixed label** (icon + name). The label lives in the station, not
  in the agent, so the area **stays identified when the agent leaves** for
  a handoff. The background **dims** (`.dim`: gray + opacity) when the owner
  is NOT working there, and shows **vivid + halo** (`.hot`) when working —
  this is what communicates "who's working" best from afar. Of the build roles,
  the only one without a pixel-art room is `implementer` (uses a fallback tint via
  `color-mix`); the rest already have their zone, including `reviewer` (QA room) and
  `analytics` (data observatory). They all additionally have their own sprite —
  `mcSprite()` would only fall back to the `implementer` sprite if some role arrived without
  an image.
- **Particles** (`.mcpt`): a burst of dots in the role's color when a
  handoff is delivered. Purely cosmetic.

Live counters (`#mc-cnt`): pills `N working / N walking / N waiting
/ N blocked`, recomputed every ~260 ms from the sprites' real state.

## 3. Map and modes

- **Layout per mode, empty center** (`mcPositions`): each mode places the stations
  in a fixed, orderly shape according to how many there are — **2 in a column** (economical),
  **4 in the corners / square** (balanced), **3 on top + 2 on the bottom** (powerful)
  and **3 + 3** (deep, spaced wider into 6 so the enlarged Review station
  doesn't overlap). `mcRing` (uniform ellipse) remains only as a **fallback**
  for unforeseen sizes. The center always stays empty and the handoffs
  **route through it** (`MCCENTER`): the initiator walks `station → center → next to the
  destination` (`mcApproach`), delivers, and returns `→ center → its station`. Since everything
  crosses only the empty center, **no path passes over another agent's
  work area**. There is no visible central table — the center is just a routing
  point.

- **The roster is the REAL subagents of `implement`** (see the skill
  `plugin/skills/implement/SKILL.md`), not all the factory's agents. PM,
  designer, architect, **copywriter** and **devops** belong to earlier phases or
  to release (spec / design / blueprint / release) and **do not build**, which is why
  they don't appear on the build map. The only "support" agent that does
  enter the build is **analytics** (it instruments telemetry on the fly).
- **Build mode → team effort** (`MCROSTER`, read from
  `ST.modes[slug]`; the 4 modes match the skill):
  - `pro` (economical): implementer (full-stack) + reviewer (2) — no parallelism,
    splitting doesn't help; a single worker does everything and the reviewer reviews at the close.
  - `balanced` (default): backend-dev, frontend-dev, test-writer, reviewer (4).
  - `powerful`: + researcher + analytics (6) — research and telemetry come in on demand.
  - `deep`: + researcher + analytics (6) — maximum quality; Review runs
    in 3 concurrent lenses (the reviewer is enlarged and the rest wait).

  The **effort selector** lives in the Party tab itself (the
  `data-act="bmode"` row); it changes `ST.modes[slug]` (it is **per project**) and re-mounts
  the map with the new party.

## 4. Decoupled animation queue (key)

The **visual** state is decoupled from the **real** state. The engine queues
movement instructions and consumes them at its own pace:

- When an agent starts a handoff, the log (`mcFeed`) writes
  **`✓ done` immediately** (real state), but the character still takes ~2.5 s
  to walk and deliver. The walk is **cosmetic**.
- If the real task finishes earlier, the character still completes the trip and returns to
  its desk. The information may appear out of sync by a few seconds; this is
  intentional and acceptable.

This means that when this is connected to real data, Mission Control does **not**
need perfectly real-time events: a *stream* of events
(`started_task`, `handoff(from,to)`, `blocked`, `completed`, `needs_input`) is enough for
the engine to translate into animations. Temporal fidelity is secondary to
legibility.

### Integration contract (prototype → real data)

The engine (`MC`, `mcBoot`, `mcLoop`, `mcSetState`, `mcStartHandoff`) currently runs with
a *director* that generates plausible events. To connect it to the real
build, replace that director with the consumption of the events that the build
already emits to `~/.claude/dashboard-events.ndjson`: with **Dynamic Workflows** they are
emitted by the workflow subagents (`emit-event.sh` when they start/finish their
stage) and the `SubagentStop` hook — **not** the Agent Teams hooks
(`TeammateIdle`/`TaskCreated`/`TaskCompleted`, which don't fire in workflows). The
emission is fire-and-forget (append to file): it doesn't block the workflow, so the
RPG map costs no performance. The event → animation mapping:

| Real agent event | Visual action |
|---|---|
| starts a work order | `mcSetState(agent,'work')` |
| publishes contract / hands work to X | `mcStartHandoff(agent)` with `target=X` |
| finishes, with nothing pending | `mcSetState(agent,'idle')` |
| hits a decision point | `mcSetState(agent,'blocked')` |
| reviewer receives a deliverable | `mcSetState(reviewer,'review')` |

## 5. Lifecycle in Mission Control

- `render()` calls `mcBoot()` at the end. `mcBoot` looks for `#rpg-scene`; if it exists,
  it rebuilds `MC.agents` from the DOM and starts a `requestAnimationFrame`.
- Each `render()` increments `MC.runId`; the old loop stops on its own
  (`if(myId!==MC.runId)return`). This way loops don't pile up on re-render.
- **Pause/Reset** (`rpgpause`/`rpgreset`) act without re-render so as not to
  restart the scene.
- If the tab isn't visible, the browser pauses `requestAnimationFrame`
  (the animation freezes until you come back). This is normal browser
  behavior, not a bug.

## 6. Images

The **agent sprites** (`IMG[<role>]`, 96×96 RGBA) exist for all 13 agents,
including the 3 new ones (`copywriter`, `analytics`, `devops`) — they were cut from
`assets/agents/grid-v2.png` and embedded as base64. The **station backgrounds**
(`IMG[ZONEBG[role]]`, 320×320 RGBA, from `assets/zones/`) exist for:

- `researcher` → `research` ✓
- `test-writer` → `testing` ✓
- `backend-dev` → `backend` ✓
- `frontend-dev` → `frontend` ✓
- `reviewer` → `review` ✓ (quality control room — cut from `zones-grid-v2.png`)
- `analytics` → `analytics` ✓ (observatory / data chamber)

**Minor pending item:** the `security-auditor` room (`security`) is cut in
`assets/zones/security.png` but **not embedded** yet, because `security-auditor`
is not in the build roster (`MCROSTER`); it is embedded and mapped in `ZONEBG` only
if it ever enters the build map. `copywriter` and `devops` don't need a
room (they don't appear on the build map).

Style to respect so they fit together: **top-down 16-bit pixel-art (SNES JRPG style)**,
a room seen from above, central rug with a compass, props on the walls,
warm palette, 320×320 px, no characters, no text. Pipeline to regenerate:
generate the sheet (sprites 1024×1024 transparent 2×2 · zones 1254×1254 opaque 2×2),
cut by quadrant with PIL, rescale (96 / 320), base64 → `IMG`, map `ZONEBG`.
