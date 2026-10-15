# The design round loop (Steps 4 to 6, every round)

Owner-driven design runs for many rounds (PandaSaga took 17). These habits kept seventeen rounds coherent and verifiable.

## Build the prototype from a template and a keyed copy file

- One single-file prototype built from a template plus a keyed copy JSON per round (`docs/design/round-N-copy.<lang>.json`). Every visible string comes from the copy file, so the build later reuses it verbatim; a build script fails on missing keys and on banned characters (for example em dashes in product copy).
- Each round: archive the previous HTML, notes and tokens (`mockups/<name>-round-N.*`), copy the copy file forward, patch the template, rebuild. Never edit the built HTML by hand.
- Demo-only controls live in a dashed DEMO panel (DR-061): states (loading, error, empty, partial, offline, expired), domain cases, progress, network speed, reduced motion. Every state the FRDs name must be reachable from it.

## Verify every round (before the owner sees it)

Keep one script set per round (`docs/design/verification/roundN-*`), and extend it instead of starting over:

| Check | What it proves |
|---|---|
| Flows (Playwright) | every owner request and every earlier guarantee still works; add regression checks for each fix |
| Screen matrix with axe-core | every route × 320/375/768/1280 × light/dark × states: 0 violations, 0 horizontal overflow, 0 runtime errors, controls ≥ 44 px, one H1 |
| State scenarios with axe-core | dialogs, forms and edge states |
| Content sweep | domain safety (PandaSaga: no spoiler term before its chapter) |
| Contrast | text on images and gradients, which axe cannot measure |

Plus, before freezing, a **phone pass**: full-page screenshots of every screen at 375 and 320 px on contact sheets, and an automatic scan for clipped text, text under 12 px and overflow. Review the sheets yourself; the matrix does not see "too cramped".

Motion: define tokens (`--ease-*`, `--dur-*` 120 to 320 ms), honour reduced motion (device setting and the DEMO switch), and animate only transforms or decorative layers. Animating text opacity makes axe measure text mid-fade.

## Review and publish

- An **independent reviewer** subagent (a different context, read-only) audits each substantial round against the FRDs and the owner's request; fix its findings and add regression checks before showing.
- Publish each round as a private Artifact; copy every referenced asset with a script that reports missing files after copying (a shell `while read` over a file without a final newline silently skipped the last image once).
- Append the round to `.pandacorp/comms/iteration.md` (Spanish): request, what was done, verification numbers, artifact URL, what stays open. Commit the round.

## Answering the owner

Lead with what changed, in their words. Red-team before agreeing (one full-width cover per row on a phone would be 500 px tall; offer the list layout instead). For a choice that changes approved visuals (fonts, logo), show a side-by-side image and ask with options and a recommendation.
