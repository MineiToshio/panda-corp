# Independent Spec tab review

Verdict: PASS for the requested behavior, subject to the lead's isolated canonical verification and browser pass. No blocking correctness/security findings in this scoped change.

Reviewed against the owner-authorized order: Resumen, Spec, Work orders, Arquitectura, Cambios, Party, Observabilidad, Documentos, Comandos. The Spec tab is shared by Portfolio and standalone project pages, resolves `tab=spec`, preserves selected-project context, and leaves Summary as default.

## Independent evidence

- Added `mission-control/src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx` (7 tests).
- Reviewer and tab-order suite went RED before implementation: 9 failures, 25 passes. Failure signals included missing Spec tab and routing to Summary.
- Final focused rerun: **5 files / 48 tests PASS**. Command: `pnpm exec vitest run 'src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx' 'src/app/projects/[slug]/_components/_tests/workspace-shell.test.tsx' 'src/app/projects/[slug]/_components/_tests/architecture-tab.test.tsx' 'src/app/projects/[slug]/_components/_tests/spec-tab.test.tsx' src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx --reporter=dot`. Log: `/tmp/pandacorp-spec-review-tests.log`.
- Broader affected regression: **10 files / 149 tests PASS**. Command: `pnpm exec vitest run src/app/board/_components/CardDetail/_tests src/app/board/_utils/_tests/readCardProject.test.ts src/app/board/_utils/_tests/readCardProject.reviewer.test.ts 'src/app/projects/[slug]/_tests' src/app/portfolio/_tests/frd-03-page-assembly.reviewer.test.tsx --reporter=dot`. Log: `/tmp/pandacorp-spec-review-regression.log`.
- Biome check passes for all four reviewer-owned files. ESLint passes for independent suite. `git diff --check` passes.

Independent cases prove:

1. Selected second project, rather than first portfolio row, supplies PRD, research and FRD narrative.
2. Real document tree has three FRD folders with six documents, while digest contains one narrative FRD: rendered count is three. Board `readCardProject` and workspace call the same `readSpecDigest` boundary with the same resolved path and derive the same real count.
3. Shared SpecDigest FRD modal opens; switching project resets the modal and never leaves previous project narrative.
4. Standalone slug and Portfolio both accept `tab=spec`.
5. Missing digest stays in selected project's Spec tab with a nonempty explanation and no fabricated SpecDigest or other project's content.
6. Navigation preserves `project`, sets `tab=spec`, and clears stale `doc`, `wo`, `wotab` sub-selection.
7. Summary remains default, with no eager Spec read.

## Source review

`ProjectWorkspace.tsx` imports the existing SpecDigest and canonical readSpecDigest. The branch uses resolved projectPath, keys the component with that path, and delegates FRD count to countFrdFolders(listProjectDocs(...)), matching the board. No duplicate parser or data writer was introduced. Existing Architecture remains immediately after Work orders.

Bounded parity follow-up reviewed: ProjectWorkspace now resolves projectType from the same idea-card project-path match used by Summary, with targetPlatforms from status. The new client TabSpec wrapper passes the existing SpecDigest a shared document link resolver. docHref/makeLinkResolver were extracted from TabDocuments with unchanged logic; the compatibility docHref export delegates to the shared helper. No parser or URL semantics duplication was introduced. Keying TabSpec by projectPath resets the nested SpecDigest modal on project switches.

The independent suite now has **7 tests** and also checks an allowed Spec link's exact selected project/tab/doc, unknown-relative-link neutralization, same-tab internal navigation, external new-tab behavior, and hash anchors. Link assertions exercise a generic prose subsection, because the existing shared SpecDigest intentionally renders structured bullet/role/ref sections as parsed cards, without Markdown links.

Final follow-up evidence: `pnpm exec tsc --noEmit` PASS (log `/tmp/pandacorp-spec-review-tsc.log`); independent suite ESLint/Biome PASS; `git diff --check` PASS. Final combined Spec/workspace/TabDocuments/links/component rerun: **8 files / 84 tests PASS**, independently rerun after the lead moved the fixture link into a generic prose subsection. Log: `/tmp/pandacorp-spec-review-followup.log`.

Final command: `pnpm exec vitest run 'src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx' 'src/app/projects/[slug]/_components/_tests/spec-tab.test.tsx' 'src/app/projects/[slug]/_components/_tests/workspace-shell.test.tsx' 'src/app/projects/[slug]/_components/_tests/architecture-tab.test.tsx' 'src/app/projects/[slug]/_components/tab-documents/_tests' src/lib/docs/_tests/links.test.ts src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx --reporter=dot`.

Bounded follow-up verdict: **PASS**, with no blocking findings. The earlier fixture mismatch is resolved; no production change was needed for it.

## Scope and limitations

Only assigned superseded order/count expectations were updated in workspace-shell.test.tsx, architecture-tab.test.tsx and e2e/logical-data-model.spec.ts. No product files, docs, staging, commits, work-order/status files or runtime state were changed by this reviewer. No dev server, browser gate or canonical verify was launched on main; lead owns isolated verification.

The independent suite mocks the canonical digest reader to isolate project path selection and uses the real SpecDigest/parser plus actual document folders. Existing readCardProject regression tests separately exercise real filesystem digests. Existing unrelated test stderr includes Node localStorage experimental warnings, fixture directories lacking Git, and CardDetail act warnings; all cited test commands finish green.

## Modal focus restoration follow-up

The lead's browser pass exposed an existing shared Modal accessibility defect: closing a Spec FRD dialog with Escape did not return focus to its opener. Independent reviewer test added at `src/components/core/Modal/_tests/Modal.focus.reviewer.test.tsx` before the production fix.

RED evidence: **3 FAIL / 1 PASS**, `/tmp/pandacorp-modal-focus-red.log`. Escape/reopen, close-button and open-modal unmount all failed to restore focus; the removed-opener/project-change case passed.

Source review of the bounded Modal fix: the focus-on-open effect captures `document.activeElement` before focusing the panel, then restores the captured HTMLElement in cleanup only while `isConnected`. Cleanup runs on close and unmount. The effect stays keyed only by `open`, so parent rerenders/new onClose callbacks do not shift focus while the dialog stays open. A removed opener cannot steal focus from the next project's control. No competing focus-restoration path or change to Escape/focus-trap behavior was introduced.

GREEN independent rerun: **11 files / 144 tests PASS**, covering core Modal (new reviewer cases + existing tests), workspace Spec, original board SpecDigest, IntakeModal, DiscardedModal, TabDocuments, and link classification. Command: `pnpm exec vitest run src/components/core/Modal/_tests 'src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx' 'src/app/projects/[slug]/_components/_tests/spec-tab.test.tsx' src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx src/app/board/_components/IntakeModal/_tests src/app/board/_components/DiscardedModal/_tests 'src/app/projects/[slug]/_components/tab-documents/_tests' src/lib/docs/_tests/links.test.ts --reporter=dot`. Evidence: `/tmp/pandacorp-modal-focus-green.log`.

`pnpm exec tsc --noEmit` PASS (`/tmp/pandacorp-modal-focus-tsc.log`); reviewer focus suite ESLint/Biome PASS; `git diff --check` PASS. Existing IntakeModal tests emit act warnings but finish green. The lead owns the canonical and browser reruns.

Modal follow-up verdict: **PASS**, no blocking findings. Reviewer changed only the newly assigned Modal focus test and this report; no production/docs/build-state edits.
