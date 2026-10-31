# Lane A: live reader investigation

Date: 2026-10-31. Factory root: `/Users/Shared/Proyectos/panda-corp`.
No factory or sibling-project data was edited. All malformed inputs remain visible errors (DR-078).

## Findings and disposition

| Item | Cause | Disposition |
| --- | --- | --- |
| 1. PersonalPage Observability | `docs/frds/frd-03-projects-case-studies/work-orders/wo-03-002-remove-decision-artifact-links.md`, frontmatter line 5: the plain YAML title contains `"See: …"`. Quotes inside a plain scalar do not protect its colon-space. The strict shared reader now returns a named per-file error. | Name the file and YAML reason beside the other 24 valid work orders. The sibling project must quote the entire title scalar. |
| 2. PersonalPage Summary | The invalid work order and archived change previously replaced both progress cards with read errors. | Data repair remains with the sibling project. Retain valid FRD progress and recent changes beside named errors; global totals remain unknown. |
| 3. PersonalPage Changes | `.pandacorp/inbox/changes/done/blog-cover-alt-field.md`, line 10: `supersedes: FRD-05 schema: ...` has an unquoted colon-space. | Keep the explicit filename error and valid queue items; the sibling project must quote the entire supersedes scalar. |
| 4. Proposals/Memory/Backlog | `factory/backlog/BL-0220-workflow-agents-get-launcher-claude-md.md` declares `severity: p3`. Initial inventory: p0 17, p1 96, p2 175, p3 1. The producer template and approved FRD-22 priority tiles support only p0/p1/p2. | Keep the strict reader. Recommend factory-owned correction from p3 to p2 (lowest supported severity); no metadata change was made here. |
| 5. Unknown open changes | `countOpenChanges` already correctly returns `{ ok: false, count: null, errors }` for the archived malformed file. The comparison view erased that distinction into a dash. | Existing-project unknown totals now link "No se pudo leer" to the project's Cambios tab. Missing-project placeholders remain unchanged. |

## Regression evidence

The RED-first fixture test reproduced the whole-source throw on the real invalid title. It now
asserts that a valid sibling survives, the invalid file retains its path and YAML reason on repeated
reads, and invalid status/empty files remain errors. A non-directory discovery root still throws.
Summary tests render valid FRD progress and dated changes alongside the two real malformed fixtures.
Overview tests prove partial plans expose errors and withhold exact verified/total counts.

Targeted verification: 15 Vitest files, 88 tests passed, including the unchanged Changes reviewer
suite. The sidebar accessibility follow-up passed both targeted tests (one new regression). TypeScript completed with
exit 0. Biome checked the changed source files with no remaining fixes or diagnostics.

## Browser evidence

Playwright connected to `ws://127.0.0.1:4950/pw`, with the lane server on port 4901 and the real
factory root. Eight combinations passed: Observability, Summary, Changes and Lista at 1280 and 375.
`lanes/a/partial-browser-results.json` records each pass; `partial-<view>-<width>.png` and matching
`.txt` files preserve captures and extracted content. `verify-partial.mjs` is the executable probe.

Observed: 24 readable work orders, the exact invalid work-order path and localized YAML reason,
valid FRD rows and recent-change links, the malformed archived change's path/reason, an unread-file
count instead of 19/25 or 76%, underlined error links in Lista, and no horizontal page overflow.
The title location is frontmatter line 5 (corrected from the earlier report).

Earlier attempts on the supplied old server (1987) timed out. Earlier whole-tab captures named
`after-*` are superseded by `partial-*`. Browser inspection blocks automatic POST requests to keep
factory data read-only. The earlier sandbox-rejected ledger lock write was outside this reader patch.

## Integration notes

`readPublishedWorkOrders` now returns `{ items, errors }`, not an array. Digest readers alias the
same cached source. Portfolio, workspace headers, sidebar, picker, La Fragua and dependency/detail
views consume it. Individual failed sources remain explicit while valid siblings render. Global
progress is unknown until the source is complete; a whole discovery-directory failure still throws.

No factory/sibling data, global numeric rules, reviewer tests, baselines, work orders, build state,
decision log or main-checkout files were modified. BL-0220 metadata remains integration-owned.
FRDs 03/04/05/12, their blueprints/FDDs, microcopy and component inventory document the contract.

Candidate lesson: (agent-inferred) A colon-space inside a plain YAML scalar remains syntax even
when part of the text contains quotes; quote the entire title or supersedes value at its producer.
Candidate lesson: (agent-inferred) Fail loudly per file without hiding valid siblings; incomplete
project plans must carry their unread-file count through every shared progress surface.

## Commit handoff blocker

The final implementation is verified but uncommitted: both ordinary `git add` attempts failed with
`Operation not permitted` creating `.git/worktrees/fin-lane-a/index.lock`. The active filesystem
profile makes that worktree metadata read-only. No hook was skipped and no index/ref workaround was
used. The prior commit remains `2fab592a955c9770c937f80806cd083595529f12`.
`lanes/a/lane-a-followup.patch` includes all tracked changes and both new component files;
`partial-files.txt` lists the 44 owned paths, and `commit-message.txt` contains the intended message.
The worktree remains dirty solely with this follow-up. The lane development server was stopped.
