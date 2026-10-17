# Relationship line-only highlighting

Date: 2026-10-17. Owner-authorized scoped presentation correction, based on `3e1eb8cf540fe50f52490edf813adb0cb1c2890d`. No project/build machine-state transition.

The generic viewer tabindex focus rule applied a rectangular 2px outline to SVG relationship groups, whose bounds span distant endpoints. A four-line scoped CSS addition suppresses that outline on focused relationship groups only. Existing selected/focus-visible accent and 2.5px line/endpoint strokes remain. Button/search/canvas focus indicators, connector semantics, cardinalities, selection toggle, model source and layout are unchanged. FRD-02 AC-02-015.5, its FDD and the decision log record the correction; no new product scope or architecture decision is introduced.

Independent browser RED on the previous port 1987 version observed an SVG group with a solid 2px outline after keyboard focus and Enter selection, alongside the accent 2.5px line. The reviewer checks the corrected inline/fullscreen paths and unaffected controls in a fresh isolated browser. Real-project screenshots and computed-style receipts remain private under `.pandacorp/comms/relation-line-only-highlight/`.

Verification results are recorded below after completion. This is a CSS-only reversible fix, with browser-level style evidence rather than a new implementation-mirroring unit test.

Independent review PASS: four real-browser cases (light/dark × inline/native fullscreen) show `:focus-visible` on the connector with `outline:none` and the retained accent 2.5px line. Enter selects and Space deselects without a rectangle; search retains a solid 2px focus outline.

Canonical isolated `verify.sh --since 3e1eb8cf540fe50f52490edf813adb0cb1c2890d --report-all` exited 0: all 11 subgates green, 27 files / 311 unit/integration tests, 42 desktop/mobile smoke/shell cases. This is since-scoped correctness qualification, not an unscoped visual-baseline certification. Existing 13 frozen machine-state/schema doc-lint advisories and Biome schema-version info remain outside this CSS-only correction. Root/isolated tested CSS SHA256: `3d7ae57fbabdfc65e7a17a9b06ba029df560b6d39fd7b4e5a8b18f42b53021a9`. Commit-specific production/live receipts are recorded privately after deployment.
