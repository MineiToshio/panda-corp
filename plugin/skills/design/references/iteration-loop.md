# The design round loop (Steps 4 to 6, every round)

Owner-driven design runs for many rounds (PandaSaga took 17, funko-tracker 29). These habits keep them coherent and verifiable, and make the freeze an extraction instead of a repair.

## Prototype contract — from round 1 (DR-129, `factory/standards/design.md` §5e)

funko-tracker met this contract only at the freeze and paid almost a day for it: 1059 CSS literals to tokenise, a demo strip baked into the sticky offsets, 11 px text in 41 places, a host mode that switched itself on during captures. Every round, from the first, the prototype is:

1. **Tokens-only CSS.** Every colour, type, space, radius, shadow, z-layer, opacity, motion and layout value is a `var(--token)`; literals appear only inside the token definitions, so `design-tokens.json` stays regenerable mechanically.
2. **Demo-only marks.** Every demo affordance (DR-061: the dashed DEMO panel, the demo strip, demo-only screens, sample figures) carries `data-demo-only`; `?demo=off` renders the page without any of them, `?theme=light|dark` pins the theme. If the prototype auto-detects an embedding host (any layout that changes inside a tall frame, such as the Artifact viewer), `?host=page` turns the detection off.
3. **Product text ≥ 12 px**, tab-bar labels and captions included. Smaller text only in demo chrome.
4. **Motion: only transforms animate** (`transform`, or the individual `translate`/`scale`/`rotate`). Text never fades: opacity animates only on decorative layers and on controls revealed on hover devices. Entrances animate `translate`, not `transform` (with `animation-fill-mode: both` a `transform` entrance pins the property and silently cancels `:hover { transform }`). Tokens `--ease-*`/`--dur-*` (120 to 320 ms); reduced motion (device setting and the DEMO switch) removes all animation.
5. **Hover only inside `@media (hover: hover)`**; the default styles are the touch branch, so a phone never shows a stuck hover. Touch gets its own pressed/active feedback.
6. **Web fonts, self-hosted when the licence allows** (`docs/design/prototype/assets/fonts/` with the licence files and the exact `@font-face` rules). These are the files the build ships. Load the variable axis (`wght@400..900`) when the CSS uses intermediate weights; a static weight list silently snaps 550 to 500.
7. **Sticky offsets from one product token** (`--sticky-top` = the header height). The demo strip adds its height only in a prototype-only rule that `?demo=off` disables; it never enters a product token.
8. **One stable artifact.** Once a direction is chosen (or at ADOPT-VISUAL), the prototype lives at `docs/design/prototype/<name>.html` and every round rebuilds THAT file (earlier rounds archived in `mockups/`), published to ONE Artifact URL.
9. **Every FRD-named state is reachable.** Each state an acceptance criterion names (loading, empty, error, partial, dialogs, confirmations) is reachable from the DEMO panel, and its screen/state is listed in `docs/design/freeze/fidelity.config.json` (under `states.<frd folder>`, with its route and actions; schema `scripts/fidelity/config.schema.json`) in the round that first shows it. The freeze then captures from a complete list instead of authoring it, and the DR-064 Group B list arrives near-empty.
10. **The fidelity config grows with the prototype, every round.** `docs/design/freeze/fidelity.config.json` is accumulated during the rounds, never authored at the freeze (funko-tracker authored it at the freeze: 119 components, 312 states, 49 CSS families and 55 overrides in one go). The `designer` owns it; in the round that adds or changes it, a change to the prototype also updates its entry: a new or changed **component** → its `components` row (`route`, `root`, `children`, the `states` it shows, with `widths` when it exists only at some widths) and its `floating` panel if it opens one; a new **CSS block** → its `css.families` entry, in the prototype's order, plus the `css.rules`/`css.overrides` that claim its rules; a new **icon** → covered by `exports` (icon symbols only, presentation attributes carried) inside `exportPaths`; new **demo markup** → `data-demo-only`. A few lines per round; the round preflight warns when a CSS rule has no family (`configCoverage`) or demo-looking markup lacks the attribute (`demoMarkup`). Component coverage is not checked automatically: the reviewer of the round looks for a new component without a row.

## Build the prototype from a template and a keyed copy file

- One single-file prototype built from a template plus a keyed copy JSON (`docs/design/round-N-copy.<lang>.json`). Every visible string comes from the copy file, so the build reuses it verbatim; the build script fails on missing keys and on banned characters (em dashes in product copy).
- Each round: archive the previous HTML, notes and tokens (`mockups/<name>-round-N.*`), copy the copy file forward, patch the template, rebuild. Never edit the built HTML by hand.

## Verify every round (before the owner sees it)

1. **Preflight first, every round:**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/preflight-round.mjs" docs/design/prototype/<name>.html --save
   ```
   It checks the contract above: text under 12 px, demo leaks under `?demo=off` and demo markup without `data-demo-only`, literals outside tokens, unguarded hover, text fades, overflow, web fonts, tokens and CSS rules the fidelity config does not claim. Exit 0 is clean, 1 has findings, 2 could not run (never a pass). **Every finding is fixed in this round, before publishing**; none is carried to the freeze or the audit. A `fail` is always fixed. A `warn` you judge acceptable is noted in the round entry with the reason; at the freeze it is acknowledged in the tracker (`preflight-ack: <check ids>`). A suspected false positive is raised as a factory backlog item; never edit the check or work around it.
2. **The round's own suite** (`docs/design/verification/roundN-*`, extended, never restarted):

| Check | What it proves |
|---|---|
| Flows (Playwright, real clicks) | every owner request and earlier guarantee still works, including the primary action of each screen (load-time checks cannot see a broken click handler); a regression check per fix |
| Screen matrix with axe-core | every route × 320/375/768/1280 × light/dark × states: 0 violations, 0 horizontal overflow, 0 runtime errors, controls ≥ 44 px, one H1 |
| State scenarios with axe-core | dialogs, forms and edge states |
| Content sweep | domain safety (PandaSaga: no spoiler term before its chapter) |
| Contrast | text on images and gradients, which axe cannot measure |

3. **Phone pass**, at the latest on the round the owner approves: full-page screenshots of every screen at 375 and 320 px on contact sheets. Review the sheets yourself; the matrix does not see "too cramped".

## Review and publish

- An **independent reviewer** subagent (fresh context, read-only, STANDARD tier or higher) audits each substantial round against the FRDs and the owner's request; fix its findings and add regression checks before showing. Check every recommendation against the owner's recorded decisions in `.pandacorp/comms/iteration.md` before applying it.
- Publish by UPDATING the prototype's one artifact (same URL, version `label` "Ronda N"); never a new artifact per round. The URL lives at the top of `.pandacorp/comms/iteration.md`; a new conversation reads it with `Artifact` `read`, then publishes with `url`. Copy every referenced asset with a script that reports missing files after copying. Until the publish lands, tell the owner the new round is "pendiente de verificación, aún no publicada", so a stale page is not read as "nothing changed".
- Append the round to `.pandacorp/comms/iteration.md` (Spanish): request, what was done, verification numbers (preflight included), what stays open. Commit the round.

## Answering the owner

Lead with what changed, in their words. Red-team before agreeing (one full-width cover per row on a phone would be 500 px tall; offer the list layout instead). For a choice that changes approved visuals (fonts, logo), show a side-by-side image and ask with options and a recommendation.
