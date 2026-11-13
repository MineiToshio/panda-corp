# Vitest platform inventory — Mission Control

DR-159 migration, 2026-11-13. All 536 source test files retained: 427 DOM, 109 Node.

Reviewed via TypeScript module resolution over local static/dynamic imports (cycles propagated to a fixed point). TSX, React/DOM libraries, browser identifiers, explicit DOM directives, and unresolved local imports conservatively retain DOM. Common private-state mocking stays in shared setup; browser mocks/polyfills and jest-dom stay DOM-only. No pool, worker cap, isolation, timeout, assertion or gate shuffle/seed change. New files default Node; add DOM files here with a reason, including transitive browser dependencies.

| Spec | Environment | Reason |
|---|---|---|
| `src/_tests/board-not-found.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/_tests/security-boundaries.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/(dashboard)/_tests/frd-18-integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/OnboardingGate/_tests/OnboardingGate.clipboard.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/OnboardingGate/_tests/OnboardingGate.contract.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/OnboardingGate/_tests/OnboardingGate.gaps.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/OnboardingGate/_tests/OnboardingGate.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_design/tokens/_tests/assets.bytes.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_design/tokens/_tests/tokens.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/client-directive.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/error-net.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/frd13.source-contracts.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/globals.css.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/globals.css.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/_tests/layout.guard.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/layout.shell.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/layout.sidebar.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/layout.sidebar.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/layout.theme.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/page.dashboard.test.tsx` | DOM | TSX component/render coverage |
| `src/app/_tests/wo-09-006-snapshotLedger.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/achievements/Informe/_tests/Informe.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/Informe/_tests/clientBoundary.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/achievements/Informe/_tests/informeData.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/achievements/RankLadder/_tests/RankLadder.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_components/charts/_tests/seriesLabels.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/closure-d.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/frd-10-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/frd-10-gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/frd-10-integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/frd-10-reuse.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/frd-10-stats-gate.reviewer.test.tsx` | DOM | Explicit DOM environment |
| `src/app/achievements/_tests/frd-10.s4c-blockers.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/page.ledger-hermeticity.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/page.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/wo-10-005-hall-surfaces.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx` | DOM | TSX component/render coverage |
| `src/app/achievements/_utils/_tests/attributes.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/achievements/_utils/_tests/viewRules.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/api/live/_tests/route.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/api/live/_tests/route.eventstore.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/api/live/_tests/route.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/api/live/_tests/route.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/api/live/_tests/security.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/api/plugin-sync/_tests/route.integration.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/api/plugin-sync/_tests/route.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/board/IdeaBoardView/_tests/IdeaBoardView.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/IdeaBoardView/_tests/IdeaBoardView.wo02005.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/IdeaBoardView/_tests/IdeaBoardView.wo02014.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/[...segments]/_tests/ideaPage.integration.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/ArchitectureDigest.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/s2b.adversarial.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/usability.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/IdeaPitch/_tests/IdeaPitch.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.cohesion.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.navigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/CardDetail/_tests/CardDetail.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/DiscardedModal/_tests/DiscardedModal.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/IntakeModal/_tests/IntakeModal.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_components/IntakeModal/_tests/IntakeModal.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/board-orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/board-search.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/discard-write.integration.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/board/_tests/frd-02.idea-route.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/frd-02.integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/frd-02.s2a-board.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/frd-02.stage-default-tab.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_tests/wo-02-005-board-surface.test.tsx` | DOM | TSX component/render coverage |
| `src/app/board/_utils/_tests/readCardProject.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/board/_utils/_tests/readCardProject.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/board/actions/_tests/actions.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/app/board/actions/_tests/read-doc.security.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/app/configuration/_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/frd07.detail-edges.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/frd07.gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/frd07.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/frd07.s4c-blockers.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/page.integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/persistentNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/configuration/_tests/visualClosure.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/conceptEquipo.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/day1-engine.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/docs-search.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/frd-08-content.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/frd-08-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/frd-08-reuse.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manual-content-v2.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manual.reviewer.integration.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualPages.builder.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualPages.dr133.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualPages.fastLane.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualPages.lanes.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualPages.multi-runtime.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/manualSingleSource.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/manual/_tests/page.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/persistentNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/manual/_tests/visual-reanchor.test.tsx` | DOM | TSX component/render coverage |
| `src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/portfolio/_tests/overview.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_actions/_tests/discard-change.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_components/Fragua/_tests/FraguaLive.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/Fragua/_tests/FraguaScene.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/Fragua/_tests/FraguaToken.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/ProgressList/_tests/ProgressList.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/ProgressList/_tests/progressItems.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_components/_tests/architecture-tab.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/frd-05-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/spec-tab.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/workspace-navigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/_tests/workspace-shell.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/deps/_tests/DependencyCanvas.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/deps/_tests/DependencyCanvas.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/deps/_tests/DependencyMap.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/deps/_tests/data.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_components/snapshot-panel/_tests/frd-14-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/snapshot-panel/_tests/frd-14-rebuild.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.relativeDate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-changes/_tests/changes.v2.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/ComandosPanel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/frd-11-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/frd-11-gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.fidelity.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-commands/_tests/targets.v2.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.wo04005.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/build-v2.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_components/tab-summary/_tests/frd-04-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/readSummary.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.snapshot-liveness.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.wo04005.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/version-freshness/_tests/version-freshness.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-board/_tests/wo-board.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-empty/_tests/wo-empty.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-frd-filter/_tests/wo-frd-filter.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-state-filter/_tests/wo-state-filter.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-views/_tests/frd-05-gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-views/_tests/nativeNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-views/_tests/panel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_components/wo-views/_tests/views.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_observability/FrdDriftBadge/_tests/FrdDriftBadge.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_observability/WoLiveRefresh/_tests/wo-live-refresh.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_tests/page.reviewer.integration.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_tests/page.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_tests/workspace-frame.adversarial.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_tests/workspace-frame.integration.test.tsx` | DOM | TSX component/render coverage |
| `src/app/projects/[slug]/_tests/workspace-route.empty.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/projects/[slug]/_tests/workspace-route.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/proposals/_actions/_tests/discard-backlog.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/proposals/_components/BacklogPanel/_tests/BacklogPanel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_components/BacklogPanel/_tests/frd-22-gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_components/BacklogPanel/_tests/persistentNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_components/PromotionsQueuePanel/_tests/PromotionsQueuePanel.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_components/ProposalsTabs/_tests/ProposalsTabs.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/frd-17-gate-opus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/frd-17-gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/frd-17-lesson-detail.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/frd-17-resolver.gate.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/app/proposals/_tests/frd-17-reuse.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/persistentNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/proposals-composition.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/proposals-integration.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/proposals-page.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/proposals-wiring.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/wo-17-004-req17001.test.tsx` | DOM | TSX component/render coverage |
| `src/app/proposals/_tests/wo-17-005-lesson-detail-v2.test.tsx` | DOM | TSX component/render coverage |
| `src/components/a11y/_tests/a11y-primitives.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/components/a11y/_tests/a11y-primitives.test.tsx` | DOM | TSX component/render coverage |
| `src/components/a11y/_tests/wo-13-003.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Avatar/_tests/Avatar.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Banner/_tests/Banner.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Button/_tests/Button.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Button/_tests/ButtonLink.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Button/_tests/IconButton.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Card/_tests/Card.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Chip/_tests/Chip.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Chip/_tests/stackOrder.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/core/Chip/_tests/state-shapes.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Chip/_tests/vocabulary.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CmdRow/_tests/CmdRow.s1a.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CmdRow/_tests/CmdRow.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CopyButton/_tests/CopyButton.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CopyButton/_tests/CopyButton.contract.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CopyButton/_tests/CopyButton.orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CopyButton/_tests/CopyButton.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/CopyButton/_tests/CopyButton.tokens.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/DiscardButton/_tests/DiscardButton.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/FavoriteButton/_tests/FavoriteButton.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Field/_tests/Field.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Icon/_tests/Icon.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Markdown/_tests/Markdown.orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Markdown/_tests/Markdown.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Markdown/_tests/anchors.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Markdown/_tests/security.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Modal/_tests/Modal.focus.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Modal/_tests/Modal.orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Modal/_tests/Modal.s1a.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Modal/_tests/Modal.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/PhaseStepper/_tests/PhaseStepper.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/ProgressBar/_tests/ProgressBar.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/RestoreButton/_tests/RestoreButton.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Ring/_tests/Ring.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/SectionHead/_tests/SectionHead.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Table/_tests/Table.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Tabs/_tests/Tabs.orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Tabs/_tests/Tabs.s1a.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Tabs/_tests/Tabs.test.tsx` | DOM | TSX component/render coverage |
| `src/components/core/Toast/_tests/Toast.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/Cartera/_tests/cartera.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/DashboardLiveWatcher/_tests/DashboardLiveWatcher.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/GamificationLedgerSync/_tests/GamificationLedgerSync.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/Progreso/_tests/Progreso.test.tsx` | DOM | TSX component/render coverage |
| `src/components/dashboard/TuTurno/_tests/TuTurno.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AchievementToast/_tests/AchievementToast.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/AppShell.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/ShellLocation.hydration.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/collapse.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/pills.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/shellPolish.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/sidebar.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/AppShell/_tests/theme-toggle.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/BuildModePicker/_tests/BuildModePicker.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/BuildModePicker/_tests/BuildModePicker.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/BuildRunPanel/_tests/BuildRunPanel.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.ac010-8.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.orbita.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.s2a.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.wo-02-013.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/DataModelViewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/async.ux.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/asyncLayout.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/frame.consistency.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/fullscreen.consistency.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/fullscreen.ux.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/hostile-ids.reviewer.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/components/modules/DataModelViewer/_tests/layout.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/modules/DataModelViewer/_tests/layout.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/modules/DataModelViewer/_tests/layout.ux.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/modules/DataModelViewer/_tests/modelContent.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/modelIdentity.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/navigation.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/restoration.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/routing.ux.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/modules/DataModelViewer/_tests/s2b.adversarial.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/usability.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/viewer.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/viewport.mutation.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DataModelViewer/_tests/viewport.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DocumentReader/_tests/DocumentReader.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/DocumentReader/_tests/copyDocument.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/FreshnessBadge/_tests/FreshnessBadge.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/GuildBar/_tests/GuildCard.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/GuildHero/_tests/GuildHero.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/IdeaCard/_tests/IdeaCard.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/IdeaCard/_tests/IdeaCard.wo02008.adversarial.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/IdeaCard/_tests/IdeaCard.wo02008.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Nav/_tests/Nav.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Nav/_tests/nav-counts.gate.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Nav/_tests/nav-counts.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Nav/_tests/navActive.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/components/modules/Nav/_tests/persistentNavigation.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Nav/_tests/project-nav-item.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/ProjectCard/_tests/ProjectCard.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/ProjectSwitcher/_tests/ProjectSwitcher.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/PromotionsQueue/_tests/PromotionsQueue.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Pulso/_tests/pulso.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/ReportBand/_tests/EnvFold.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/ReportBand/_tests/reportBand.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/SectionedMarkdown/_tests/SectionedMarkdown.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/ServicesDirectory/_tests/Accounts.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Spec/_tests/FrdCard.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Spec/_tests/integration-patches.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Worktrees/_tests/Worktrees.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/Worktrees/_tests/Worktrees.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/manual-diagrams/_tests/ModificationGuide.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/manual-diagrams/_tests/MultiRuntimeDiagram.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/manual-diagrams/_tests/RuntimeComparison.test.tsx` | DOM | TSX component/render coverage |
| `src/components/modules/manual-diagrams/_tests/SourceOfTruthMap.test.tsx` | DOM | TSX component/render coverage |
| `src/hooks/_tests/useFullscreen.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/hooks/_tests/useLiveSnapshot.adversarial.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/hooks/_tests/useLiveSnapshot.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/_tests/active-projects.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/_tests/active-projects.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/_tests/build-modes.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/_tests/build-modes.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/_tests/command-modes.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/_tests/slug.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/_tests/achievements.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/_tests/catalogue.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/_tests/chains-sagas.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/_tests/metric-level.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/_tests/seals-rarity.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/_tests/signals.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/aggregate.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/aggregateChain.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/aggregateConsumer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/aggregateWiring.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/read-model/_tests/backfill.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/composedReader.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/factorySchema.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/read-model/_tests/factorySeal.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/factoryStoreReader.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/factoryStoreWriter.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/informeResolver.sealCoverage.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/informeResolver.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/regen.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/seal.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/statsReader.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/read-model/_tests/statsSchema.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/read-model/_tests/statsWriter.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/flowSeries.halves.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/flowSeries.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/frd-10-stats-honesty.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/funnel.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/gitFailure.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/lessons.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/report/_tests/phaseTransitions.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/report.integration.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/scalars.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/seamAdoption.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/achievements/report/_tests/statProvenance.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/report/_tests/usage.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/achievements/report/_tests/verdict.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/architecture/_tests/adr.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/architecture/_tests/architecture.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/architecture/_tests/artifact-boundaries.mutation.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/architecture/_tests/env.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/architecture/_tests/read-architecture.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/architecture/_tests/read-artifacts.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/architecture/data-model/_tests/injected-rule-contract.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/architecture/data-model/_tests/model.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/architecture/data-model/_tests/model.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/architecture/data-model/_tests/read-data-model.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/backlog/_tests/areas.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/backlog/_tests/areas.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/backlog/_tests/backlog.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/backlog/_tests/backlog.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/backlog/_tests/discard-backlog.reviewer.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/backlog/_tests/discard-backlog.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/board/_tests/board.adversarial.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/board/_tests/board.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-run/_tests/build-run.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-run/_tests/decisions-and-events.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-run/_tests/display.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/build-run/_tests/performance-isolation.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-run/_tests/schema-source.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/build-track/_tests/build-track.drift.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-track/_tests/build-track.engineV2.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/build-track/_tests/build-track.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/campaign/_tests/campaign.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/changes/_tests/changes.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/changes/_tests/discard-change.gate.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/changes/_tests/discard-change.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/changes/_tests/openChanges.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/changes/_tests/openChanges.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/clock/_tests/clock.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/clock/_tests/clock.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/config/_tests/config.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/config/_tests/env.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/config/_tests/oracleEnv.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/config/_tests/oracleEnv.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/copy/_tests/copy.test.ts` | DOM | DOM/React/Next client dependency |
| `src/lib/deps-layout/_tests/layout.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/deps-layout/_tests/parity.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/deps-layout/_tests/prototype-golden.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/discard/_tests/discard.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/discard/_tests/discard.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/discard/_tests/restore.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/activity.resolved-in-file.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/activity.resolved-in-file.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/activity.spanish-resolved.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/activity.turn-detail.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/decision-id-golden.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/docs.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/docs/_tests/docs.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/docs/_tests/docs.wo04001.reviewer.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/docs/_tests/docs.wo04001.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/docs/_tests/docs.wo04002.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/docs.wo04002.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/docs.wo24001.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/docs/_tests/documentBody.adversarial.reviewer.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/docs/_tests/documentBody.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/docs/_tests/links.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/docs/_tests/tree.v2.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/event-time.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/events/_tests/eventSourceHealth.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/eventSourceHealth.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/events/_tests/events.achievements.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.multi-runtime.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.newvocab.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/events/_tests/events.projectFilter.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.uipassskipped.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/events/_tests/events.wo06012.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/favorite/_tests/favorite.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/fragua/_tests/boundaries.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/fragua/_tests/fragua.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/fragua/_tests/scene-data.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/fragua/_tests/signal-age.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/frds/_tests/frd-drift.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/frds/_tests/frd-index.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/fs-utils/_tests/frontmatter-import-boundary.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/fs-utils/_tests/fs-utils.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/fs-utils/_tests/fs-utils.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/fs-utils/_tests/security.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/gamification/_tests/gamification.guild-survivors.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/gamification/_tests/gamification.guild.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/gamification/_tests/guildState.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/gamification/_tests/ledger-v2-security.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/gamification/_tests/ledger.adversarial.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/gamification/_tests/ledger.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/git/_tests/fixtureGit.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/git/_tests/fixtureGit.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/git/_tests/fixtureSeams.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/git/_tests/git.async.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/git/_tests/git.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/git/_tests/gitBoundary.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/ideas/_tests/ideaCounts.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/ideas/_tests/ideas.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/ideas/_tests/ideas.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/inicio/_tests/guild.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/inicio/_tests/oracleCounts.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/inicio/_tests/resolvers.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/inicio/_tests/streaming.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/manual/_tests/manual.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/memory/_tests/memory-health.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/memory/_tests/memory-loop-v2.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/memory/_tests/memory.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/memory/_tests/memory.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/NavigationLink.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/aliases.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/canonicalHistory.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/destinations.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/history.mutation.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/identities.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/navigation/_tests/identity-cli.adversarial.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/keys.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/live-frame-refresh-harness.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/navigation/_tests/live-refresh-harness.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/navigation/_tests/navigationTransition.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/parallel-safety-harness.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/navigation/_tests/parallel-safety-lifecycle.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/navigation/_tests/persistent-navigation.adversarial.reviewer.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/navigation/_tests/routeState.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/navigation/_tests/urls.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/navigation/_tests/useUrlState.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/v2-acceptance.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/v2-boundaries.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/navigation/_tests/v2-survivors.reviewer.test.tsx` | DOM | TSX component/render coverage |
| `src/lib/next-step/_tests/next-step.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/next-step/_tests/next-step.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/next-step/_tests/next-step.wo04003.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/next-step/_tests/next-step.wo04003.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/overlay-freshness/_tests/overlay-freshness.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/pendingMerge/_tests/engine-branches.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/pendingMerge/_tests/worktreesByRepo.async.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/pendingMerge/_tests/worktreesByRepo.malformed.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/pendingMerge/_tests/worktreesByRepo.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/pitch/_tests/pitch.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/pitch/_tests/proposalSummary.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/plugin-sync/_tests/plugin-sync.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/portfolio/_tests/displayName.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/portfolio/_tests/frd-03-overview.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/lastCommit.fixture.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/overview-resolver.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/overview.integration.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/overview.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/portfolio.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/portfolio.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/portfolio/_tests/sidebarProjects.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/profile/_tests/profile.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/profile/_tests/profile.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/proposals/_tests/ownerActions.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/proposals/_tests/routeSelection.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/reference/_tests/configurationCatalogs.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/reference/_tests/reference.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/registry/_tests/registry.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/self-suggest/_tests/self-suggest.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/services/_tests/reader-boundaries.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/services/_tests/services.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/services/_tests/views.reviewer.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/services/_tests/views.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/snapshot/_tests/gap.gate.reviewer.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/snapshot/_tests/gap.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/snapshot/_tests/snapshot.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/spec/_tests/read-artifacts.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/spec/_tests/read-frds.mutation.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/spec/_tests/read-spec.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/spec/_tests/spec.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/standards/_tests/standards.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/status/_tests/lease-liveness.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/status/_tests/liveness.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/status/_tests/state-version-moved.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/status/_tests/state-version.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/status/_tests/status.adversarial.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/status/_tests/status.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/tasks/_tests/tasks.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/lib/theme/_tests/theme.test.ts` | DOM | Browser API or DOM microtask helper in import closure |
| `src/lib/work-orders/_tests/detail.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/published.mutation.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/real-source-boundaries.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/sections.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/work-orders.adversarial.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/work-orders.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/lib/work-orders/_tests/work-orders.wo05002.test.ts` | DOM | Transitive DOM dependency (conservative retention) |
| `src/test/_tests/ownerPrivateState.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/tests/fixtures/_tests/index.adversarial.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |
| `src/tests/fixtures/_tests/index.test.ts` | Node | Resolved import closure has no detected browser/React dependencies; validated by full suite. |

The four non-src content/script suites remain Node and are included by the original
root glob; the full expected corpus is 540 files, 5,538 passed tests and 2 todo.
Configuration uses explicit inline projects, not extends:true: inherited include
and globalSetup arrays concatenate in Vitest 4.1.9, duplicating suites/setup.
The managed recipe regression checks real discovery, default excludes and exactly
one root global setup with the installed runner.

## Sandbox measurement and remaining certification

Same seed `158159`: baseline 540 files / 5,538 passed + 2 todo in 51.68 s;
final adoption 540 files / 5,538 passed + 2 todo in 48.70 s (5.8% lower).
Single samples on a shared host, not a guaranteed saving. An intermediate run
concurrent with machinery took 68.08 s, illustrating contention noise. The baseline
also exposed a pre-existing same-millisecond mtime assertion; the owned fixture now
starts at a fixed older timestamp, preserving the real mutation-order check.

Static gates and the full Vitest corpus passed. Full browser/G3 execution belongs
to the orchestrator outside this restricted sandbox. Record the first reviewed
full-green stage budget there; do not invent a full baseline from these Vitest-only
commands. Codex mirror generation is blocked by read-only `.codex/agents` here.
