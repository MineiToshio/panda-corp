# Readable full-window logical model correction

Date: 2026-10-16. Owner-authorized bounded manual product implementation on main; no build executor, project phase or work-order machine-state transition.

## Delivered contract

Ampliar modelo presents only one graph canvas at 100vw × 100dvh. Floating close/search/zoom/pan controls remain accessible; Architecture chrome, source band, tabs, visible help/legend and all lower relationship details/buttons are absent from the dialog. The lower inspector is removed from the inline viewer too. SVG links still convey cardinalities and are individually keyboard-selectable. Closing restores body scrolling and trigger focus, including expansion from Esquema.

Entity width derives from complete text columns and the heading, with no ellipsis. Exact-pinned elkjs 0.12.0 supplies layered orthogonal routing through fixed field-row ports. The native DOM/SVG renderer remains shared by board, Portfolio and direct project workspaces. Distinct composite/self/parallel routes, all model identities and source bytes are preserved. The initial camera centers a complete connected table at a readable scale; Ajustar provides the whole-model overview and Restablecer returns to readable framing. There is no claim that 39 tables can all remain readable simultaneously on a phone.

A cancellable native algorithm worker keeps layout off the browser UI thread. Explicit loading/error states, a 20-second bound, model-identity guards and abort cleanup protect project switching and unmount. Real browser testing exposed the ELK bundled adapter's unsuitable environment detection inside a custom worker; the delivered browser path uses the thin API directly with ELK's algorithm worker. Node/test hosts use the bundled adapter without native-worker disposal. A separate type-only geometry contract avoids a layout/router import cycle found by the canonical structural gate.

## Documentation and oracle authority

Updated PRD, platform architecture, FRD-02 requirements/FDD/blueprint/WO-02-007, FRD-04 FDD/blueprint/WO-04-004, API, component inventory, current proposal and decision log. [ADR-0007](../../adr/ADR-0007-readable-full-window-model-layout.md) amends ADR-0006. The owner's explicit correction supersedes the round-2 prototype's fixed widths, first-node camera, inset whole-viewer expansion and lower inspector. Old delivery reports and work-order machine status remain historical, not current qualification.

Independent reviewer-authored tests first failed against the old implementation. They cover full-text geometry, graph-only expansion, selectable cardinalities, focus traps/restoration, active-dialog search feedback, mapped orthogonal ports, obstacle-aware duplicate-route separation and stale asynchronous success/error/cancellation isolation. Existing tests were adapted only for asynchronous geometry and expressly superseded UI contracts; artifact/identity/hostile-ID/mapping oracles remain intact.

## Qualification

Evidence files in this directory record the candidate's actual source hashes, canonical gate, production E2E and bounded independent verdict. Runtime screenshots and real-project browser probes contain owner project data and are retained privately in `.pandacorp/comms/readable-fullscreen-model/`.

Actual PandaSaga geometry contains 39 entities, 395 attributes and 95 relationships. Independent checks retain 95 distinct routes, zero diagonal segments, zero overlapping cards, zero connectors crossing card interiors, correct mapped endpoints and all route points within returned bounds. Layout is 7352×3801px with 292–428px cards, compared with 2840×7431px and 248px cards before correction. This is an aspect/readability improvement, not a claim of globally minimum crossings or density.

Six actual-model browser cases at 1440×1000 and 390×844, under dark/light/high-contrast tokens, verify no clipped cells or page errors, exact full-window canvas/dialog bounds, one canvas, an initially complete table, pointer/keyboard pan, search feedback, whole-model fit, Escape/focus and scroll restoration. Themes are explicitly applied through the existing root theme attribute on the standalone page; this probe does not claim to test the shell's theme-toggle persistence.

Canonical and production results are appended only after their commands complete. Private deployment evidence records the later internal port 1987 update and live check; this report never substitutes historical state for those checks.

The actual staged-diff classifier remains **critical** ([output](rigor.json)): dependency manifest, existing UI/test-oracle amendments and overall size. The owner's explicit direct correction authorizes this scoped manual continuation; no automatic change-engine/build launch or rigor downgrade is claimed. The independent reviewer passed 93 tests and TypeScript after the final neutral layout-type extraction; see [review](independent-review.md), [GREEN regression](independent-tests.log) and [initial RED](independent-red.log). [Candidate source hashes](candidate-source-sha256.json) were compared byte-for-byte with the isolated verification worktree, including deleted-file absence.

Canonical `bash .pandacorp/verify.sh --since ca949642ee49dfda8a50979e71f4b7ab14c97fa9 --report-all` exited 0 in the detached worktree: **all 11 subgates green**, **486 files / 7,950 unit/integration tests**, and **42 desktop/mobile smoke/shell browser cases**. See [report](canonical-gate-report.json) and [log](canonical-gate.log). The report SHA is the detached base of the uncommitted candidate, bound to its changed bytes by the source hashes. This since-scoped run is not presented as an unscoped visual-baseline gate. Existing 13 machine-state/schema doc-lint advisories, Biome schema-version info and tool configuration hints remain outside this scoped product correction; no checker or baseline was softened.

Production `PANDACORP_PROD_SMOKE=1 pnpm exec playwright test e2e/logical-data-model.spec.ts` exited 0: a fresh Next production build and real production server passed **4/4 desktop/mobile feature cases** ([log](production-e2e.log)). These assert shared Portfolio/board loading, native-worker browser rendering, actual drag, full-text cells, schema representation, graph-only exact full-window expansion even from schema, expanded search feedback and Escape/trigger focus. The build retains its existing filesystem-tracing warning from unrelated server readers; this feature did not change those readers or weaken build configuration.

Stored console logs normalize trailing whitespace only; command outcomes and diagnostic text are preserved. Final documentation lint exited 0 with the same 13 existing machine-field advisories ([log](doc-lint.log)).
