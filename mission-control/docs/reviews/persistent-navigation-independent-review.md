# FRD-25 independent adversarial review

Date: 2026-10-17. Review identity: independent Codex reviewer; production ownership remains with the coordinating agent and implementation workers. This review edits only reviewer test files and this evidence note. Build state, historical work-order statuses and owner identity data are outside the review's write scope.

## Observed evidence

- `pnpm exec vitest run src/lib/navigation/_tests/persistent-navigation.adversarial.reviewer.test.ts src/lib/navigation/_tests/identity-cli.adversarial.reviewer.test.ts --reporter=dot`: 27 tests passed (2 suites), including the escaped-delimiter regression and encoded traversal/backslash/NUL cases added after the browser finding.
- `pnpm exec tsc --noEmit`: passed after reviewer test additions.
- The route-boundary probes exercise actual `NextRequest` inputs and the actual proxy: duplicate query keys, excessive key/value/URL sizes, unsupported workspace tabs/tails, traversal/control characters, path precedence, encoded document keys, anchors and both workspace presentation contexts.
- The lifecycle probes execute the real identity CLI in isolated temporary factories: multiple renames retain every old slug, attempted alias reassignment fails without changing catalog bytes, removed projects retain their reserved address, later same-name projects receive a separate identity, folder moves retain identity through the dedicated reference, read resolution leaves source bytes unchanged, and repeated apply produces no writes.
- Historical reviewer-suite adaptation was inspected: explicit unknown project/document inputs now assert the FRD-25 rejection contract; correct project/document/tab identity, stale-selection removal and unknown-link neutralization assertions remain present.

## Finding addressed during review

The root page handlers did not themselves enforce repeated/oversized query bounds. The coordinator introduced the shared navigation proxy for all root and descendant page families. The independent proxy probes now pass. HTTP enforcement remains subject to the production browser run below.

## Review outcome

No remaining blocking FRD-25 correctness/security finding in the independently exercised scope. The two product findings (root input bounds and escaped document route hydration), the unknown memory collection boundary, and authored Manual heading IDs were addressed and verified. The coordinator's final canonical gate remains the release authority; this note does not modify build machine state or historical work-order verification.

## Production browser evidence

First production run: `PANDACORP_PROD_SMOKE=1 pnpm exec playwright test e2e/persistent-navigation.spec.ts` produced **26 passed, 4 failed** across desktop and mobile. Two distinct failure classes occurred:

- **Product defect:** a valid legacy workspace document query normalized to `/portfolio/mission-control/documents/docs%2Fproduct%2Fprd#vision`, then returned 404. Direct HTTP GET of that encoded canonical document URL also returned 404 while its legacy query form returned 200. An independent regression probe demonstrates the server route seed retaining `%2F` after double encoding. Production ownership has the finding.
- **Reviewer selector defect:** the runtime second-project case reached and passed non-first WO Summary/Full/reload/history/return, then a generic `tab-changes` selector matched both the tab button and content container. The reviewer corrected it to scope through `tabbar`; the behavior oracle is unchanged.

An additional source review found that bespoke authored Manual headings lacked fragment IDs. The coordinator added shared stable heading IDs; the reviewer strengthened the Manual browser case to require its actual addressed heading. These changes require a fresh production build before acceptance.

The second fresh production run produced **28 passed, 2 failed**. All navigation assertions passed, including the encoded workspace document, actual authored Manual heading anchor, and the runtime second project's full embedded/standalone WO and document flows. The remaining two failures came from an overbroad reviewer assertion: the existing GuildBar materializes `factory/gamification-ledger.json` and a transient lock while rendering. FRD-25 prohibits navigation identity allocation and action/build replay; it does not prohibit that pre-existing derived read model.

The reviewer narrowed the byte/fileset assertion to exempt exactly the known derived ledger, its transient lock owner and atomic temporary files. The catalog, all idea cards, identity references, build status, work-order files and every other authored fixture source remain checked byte-for-byte. Teardown now closes the page and polls for the ledger writer lock to disappear before individually restoring files. The targeted fresh production rerun, `PANDACORP_PROD_SMOKE=1 pnpm exec playwright test e2e/persistent-navigation.spec.ts -g 'post-build registration'`, passed **2/2** (desktop and mobile; 24.3 seconds including its fresh build). Together, the second full run's 28 unaffected passes and the targeted run's two corrected-oracle passes verify all 30 acceptance cases against that production build. This is intentionally recorded as **28 + 2 separate passes**, not a single 30-pass run.

The fixture portfolio/cards/status/docs have no git diff after teardown; its temporary navigation catalog is absent again. The runtime project case verifies post-build discovery and repeated CLI registration, correct non-first rail selection, WO Summary/Full/reload/Back/Forward/return, Party/Changes/Documents context and protected-source byte invariance in both workspace families. `e2e/persistent-navigation.spec.ts` is reviewer-owned and covers direct navigation, refresh, fresh-context paste and history across the page families; legacy query compatibility; document/model/reference details; expanded-model restoration without native fullscreen; bounded invalid routes; destination highlighting; and a new project registered after the server build.

The dynamic-project case mutates only deterministic fixture files under `e2e/fixtures/factory-root`, saves original bytes, registers through the real CLI, repeats registration to prove idempotency, exercises a non-first project's WO Summary/Full/back and nested tabs in embedded and standalone contexts, and restores files individually in `finally`. It never removes a protected directory or changes real owner/build state. The measured browser results above are acceptance evidence; the coordinator's final canonical gate remains authoritative.


## Final bounded follow-up

After the production browser runs, the coordinator changed `projectRailHref` to build the newly selected project's summary from a clean `/portfolio` or `/projects` family base. Independent inspection confirms the link retains the destination project's catalog slug and original presentation family while dropping all prior-project model, expanded-dialog, FRD/ADR and document/WO state. No persistent state write was introduced. The independent rerun of `src/components/modules/ProjectRail/_tests/ProjectRail.selectable.test.tsx` passed **29/29**, including the new regression that begins with another project's `entity`, `expanded`, `adr` and `specFrd` queries. This follow-up has no blocking finding.

The proxy's final change translates its two bounded-error messages to Spanish; direct source inspection confirms unchanged 400/414 statuses, input limits and page-family matcher. The final canonical gate and the coordinator's live rail verification cover this bounded follow-up; the earlier browser runs are not represented as having exercised code changed afterwards.
