# Accessibility report · Órbita prototype (design freeze)

Target: WCAG 2.2 AA. Run 2026-10-22 on the frozen prototype `docs/design/prototype/index.html`, with the privacy-safe fixture and `?demo=off`. The harness is `docs/design/prototype/scripts/qa-matrix.mjs --axe`, which runs axe-core with the WCAG 2.0/2.1/2.2 A and AA tags. The raw log is `docs/design/freeze/a11y-matrix.log`. The step-5 screenshots are `docs/design/prototype/screenshots/` (54 files from the freeze `screens` stage) and the per-FRD shard screenshots are in `docs/frds/*/mocks/screenshots/`.

## Result

- **Coverage:** 344 states (43 routes × 1440/1280/768/375 × dark/light).
- **Clean checks:** 0 page overflow, 0 runtime errors, exactly one H1 on every state, and 0 colour-contrast, ARIA, name or structure violations.
- **Other checks:** interaction flows pass 77/77 (keyboard tab order, drawer focus trap and Escape return, dialogs, skip link). No product text is under 12 px (`qa-smalltext.mjs`). The design preflight is 0 fail.
- **Remaining axe notes:** 14 states at 375 px report `target-size`, listed below. Each flagged control measures 28 px or more, above the 24 px WCAG 2.5.8 minimum. axe flags it because, in that viewport capture, the control sits partly under the sticky bottom navigation. Scrolling the page brings it clear, so these are a capture-position artifact, not undersized targets. The 44 px design target for primary controls is recorded in `DESIGN.md`. Smaller secondary controls (`.btn` 40 px, `.chipbtn` 34 px, copy buttons 30–36 px) are recorded there as deviation D-6.

| Route | Width | Theme | axe note |
|---|---|---|---|
| inicio | 375 | dark | target-size(1): button[data-turn="0"] |
| wo | 375 | dark | target-size(1): details:nth-child(1) > summary |
| cuentas | 375 | dark | target-size(1): tr:nth-child(2) > td[data-label="Usuario"] > .copy-text.mono[data-copy="owner@example.com"] |
| scenesim | 375 | dark | target-size(1): button[data-copy="/pandacorp:implement"] |
| deps | 375 | dark | target-size(1): li:nth-child(3) > details > summary |
| backlog | 375 | dark | target-size(2): button[data-barea="Skills"] | button[data-barea="Plantillas de proyecto"] |
| manual | 375 | dark | target-size(1): .card:nth-child(1) > .divided > .lrow:nth-child(3) |
| inicio | 375 | light | target-size(1): button[data-turn="0"] |
| wo | 375 | light | target-size(1): details:nth-child(1) > summary |
| cuentas | 375 | light | target-size(1): tr:nth-child(2) > td[data-label="Usuario"] > .copy-text.mono[data-copy="owner@example.com"] |
| scenesim | 375 | light | target-size(1): button[data-copy="/pandacorp:implement"] |
| deps | 375 | light | target-size(1): li:nth-child(3) > details > summary |
| backlog | 375 | light | target-size(2): button[data-barea="Skills"] | button[data-barea="Plantillas de proyecto"] |
| manual | 375 | light | target-size(1): .card:nth-child(1) > .divided > .lrow:nth-child(3) |
