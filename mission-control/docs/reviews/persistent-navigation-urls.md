# Persistent navigation URLs — delivery evidence

Owner approved implementation/main push/internal deployment on 2026-10-17, from research baseline `f911bb0c`. Code is integrated in an isolated checkout; no executor build-state or historical WO status edits are part of this change.

## Verification scope

The required matrix is FRD-25 AC-001..012: all page families, nested selection, direct/reload/history, legacy context, stable identity, newly registered resources, invalid routes, model expansion and mobile shell. Current command/browser results and independent review are recorded below when executed. This note does not substitute for live verification.

## Measured results

- Final canonical command: `bash .pandacorp/verify.sh --since f911bb0cace6901d93b32620fbfce382ed4e71d9 --report-all`. All eleven subgates passed; 500 Vitest files / **8,047 tests**, plus **42 browser smoke/shell checks** across desktop/mobile. This is the canonical `since` scope, not a claim that all frozen visual baselines were rerun. The headless routing contract reuses existing approved UI.
- Independent adversarial review: **27 route/CLI probes**, plus a **29-test** independently rerun rail suite. [Detailed review](persistent-navigation-independent-review.md) records findings, fixes and oracle boundaries.
- Fresh production browser suite: all 30 acceptance cases covered as **28 passes from the second full run + 2 targeted passes from the third build**, honestly separate runs. Direct URL, refresh, fresh paste, Back/Forward, aliases/legacy query normalization, case-sensitive documents/anchors, model schema/search/expanded dialog and mobile navigation were exercised. A project registered after the production build resolved immediately; its non-first-project WO Summary/Full/back, Party/Changes/Documents and standalone context remained correct.
- The first production run caught a real Next16 escaped-document seam: catch-all params retained `%2F`, and route reconstruction encoded it twice. The server adapter now normalizes one layer before bounding/serializing; document allowlists remain unchanged. A separate authored-Manual heading gap now uses shared stable fragment IDs. Reviewer selector and derived-ledger-oracle repairs are explicitly distinguished from product fixes.
- Factory backup/precious-file suite: **12 passed, 0 failed**. Shell syntax, generated plugin manifests and derived-drift checks passed. Plugin producer integration ships as **9.129.0**; the overlay/build executor was not changed.
- Owner-data migration was previewed, backed up, applied non-destructively and repeated with **0 additions / 0 changed files**. The catalog has **27 distinct idea/project registrations**. Short public aliases were reserved while older slugs remain valid. The catalog and in-factory MC identity are private; sibling metadata has an additive backup. No personal catalog/cards are committed to the framework.

## Documentation and release boundary

PRD, platform architecture, ADR-0010, FRD-25/blueprint/manual work-order scope, owning FRDs/FDDs/blueprints/work-order indexes, API/component contracts, factory producer standard, lifecycle skills, backup contract, Manual and area decision logs are aligned. Existing executor status/WO fields are untouched; FRD-25 intentionally records manual evidence here rather than writing build `implementation_status` frontmatter. Doc-lint remains advisory for that omission and the pre-existing status-template mismatch.

Release target is the owner's existing internal launchd deployment on port1987. Deployment and actual-owner browser receipts are kept in the private `.pandacorp/comms/persistent-navigation-urls/` evidence folder; the coordinator verifies main/origin/deployment commit equality, LAN listener and HTTP/browser behavior after deployment. No external publication or Claude build execution is part of this delivery. The runtime separation gate prevents Codex from invoking the Claude plugin-update command; installed Claude sessions use the normal owner-run plugin update to consume the new producer skills.
