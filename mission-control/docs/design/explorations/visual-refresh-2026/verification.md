# Design study verification — 2026-10-17

This report concerns the **illustrative standalone study**, not the production application or a completed design freeze. The served application was read/captured, not modified or tested with destructive actions.

## Running-app baseline

- Endpoint: `http://127.0.0.1:1987`.
- Seven base destinations × 1440/768/390 CSS px = 21 observations.
- Direct project and nested workspace/proposal/achievement/configuration selections = 52 observations (including repeated defaults). The final captures wait for the selected tab's `aria-selected=true`, preventing a screenshot of the preceding server-rendered tab.
- PandaSaga Spec/Architecture adds a substantial real-content comparison to Mission Control's workspace.
- Four additional dark-mode captures: Inicio, Tablero, Documentación, Logros.
- Live JSON/captures remain in locally ignored `evidence/`; they contain personal factory data.

Measured outer widths at 390 px: Tablero **499 px**; project Documentos **668 px**; Logros → Estadísticas **598 px**. Manual has no outer-width failure in this capture but its 236 px fixed index leaves a visibly clipped reader; passing a width assertion alone would miss the defect.

A source inspection and rendered visual inspection informed the design recommendations. No complete existing-product WCAG audit, performance profile or every-state regression result is asserted.

## Standalone study: base matrix

`qa.json` records **64 checks**:

- Eight rendered study destinations: Inicio, Tablero, Portfolio, Propuestas, Logros, Documentación, Configuración, idea detail.
- Four viewport widths: **320, 390, 768, 1440 CSS px**.
- Both **dark and light** themes.
- Each check reads outer document width, H1 count and axe results using WCAG 2 A/AA, 2.1 AA and 2.2 AA tags.

Result: **zero page overflow, exactly one H1 per view, zero axe violations in the audited base states, zero captured JavaScript page errors**. Automated a11y testing is partial coverage, not a full accessibility certification.

## Nested study sections and interactions

`interaction-qa.json` records **25 additional checks**:

- All nine workspace sections at 390 px/dark.
- All five Logros sections at 390 px/light.
- All four Configuración sections at 768 px/dark.
- Both Propuestas sections at 390 px/light.
- All five idea-detail sections at 1440 px/dark.

Result: **zero page overflow and zero axe violations** in those states. The Party's scroll region initially failed keyboard accessibility; it was labelled and made focusable, and that exact failing state was rerun with axe to verify the fix. The record identifies the recheck.

Seven explicit interaction checks also pass:

1. Mobile navigation opens, Escape closes it and restores opener focus.
2. Idea search filters and clears the sample cards.
3. Capture dialog has an accessible name, passes the audited axe rules while open, and returns focus on Escape.
4. Phone document index opens, selection uses the full reader and returns focus.
5. Schema entity details start collapsed.
6. The demo mode picker changes the displayed command without execution.
7. Theme and typography preview controls update appearance.

The interaction run found a stale accessible menu label on Escape; open/close/route paths were corrected and the interaction was rerun. Dialog keyboard trapping uses native `showModal`; screen-reader and real-device behavior require the subsequent design/implementation verification.

## Visual inspection and artifacts

Inspected rendered desktop and phone compositions for the running baseline, and the proposal's desktop/light/phone dashboard, phone reader and combined presentation image. Captures are ordinary browser renders of the HTML study, not generated images.

- `presentation.png`: desktop Inicio plus phone Documentación for review.
- `preview-*.png`: selected individual view captures, including tablet and light theme.
- `presentation.html`: static review composition.
- `index.html`: one stable navigable study file. `?demo=off` hides the labelled preview toolbar only; hash routes select the study views.
- Fonts and existing brand/sprites are local, so the study makes no runtime API/data calls.

## Scope and pending qualification

The prototype uses sample data and abbreviated examples. Its dialogs, charts, mode flags, graph expansion and selectors are demonstrations, not a production behavioral oracle. The preservation matrix, actual implementation and FRDs must be reconciled during the later full design pass; all real states need drawing before a freeze.

No application source/data reader/action/route/canonical token was changed. `DESIGN.md` only links to the unapproved exploration; the decision log records why it exists. Project phase, work orders, status and build ownership were not written. The existing production test suite and `verify.sh` were not run, because no production implementation is delivered; **no production gate or release pass is claimed**.

Still required before implementation acceptance: actual-device phone/tablet/Safari, touch and keyboard graph controls, every loading/empty/error/stale state, all existing write confirmations/failures, live updates under real data, URL/back/refresh regression, real performance traces and the full approved-design fidelity/accessibility matrix.

## Reproduce locally

From this directory:

```sh
python3 -m http.server 1988 --bind 127.0.0.1
```

Open `http://127.0.0.1:1988/index.html`. The preview server is separate from the actual app at port 1987. It is local to this computer; the file/assets can also be opened directly. A future shareable publication is a separate owner request.

## Navigable review follow-up

The owner asked for a simple HTML mockup they could explore directly. `preview.html` adds review-only viewport and theme controls around the same `index.html`, with a screen selector synchronized to navigation inside the frame. Work orders now draws all four states; Changes has populated ready/draft/history examples; Statistics draws example metrics, weekly bars and a funnel. Idea cards preserve the clicked sample title. These are illustrative data and presentation, not app implementation.

`preview-qa.json` records nine focused axe/outer-overflow checks: the three enriched sections at phone, tablet and desktop framing, all clear, with no captured page errors. The preview’s actual iframe navigation, width changes, theme propagation, phone index and screen-picker synchronization were exercised. Historical checks above apply to their original round, not a new whole-app qualification.
