<!--
  INDEX.md — retrieval index over factory/memory/. One line per ACTIVE lesson
  (candidates and deprecated are excluded). Maintained by the librarian with
  DELTA edits ONLY — add/update/remove single lines, never regenerate the file
  wholesale (ACE context-collapse: a wholesale rewrite by a model erodes the
  accumulated detail). Hard cap: 150 lines.
  Format: - LESSON-NNNN · use when <trigger> · <one-line insight>
-->

- LESSON-0001 · use when designing or running the lesson harvester and deciding whether a reflection-style insight qualifies as a storable lesson · anchor every lesson to concrete falsifiable evidence; reflections-on-reflections hallucinate and poison the memory
- LESSON-0002 · use when an FRD gate fails after a patch and you must decide between rebuilding the work order or suspecting the reviewer's own gate test is defective · distinguish wrong-production-code from defective-gate-test; a rebuild discards correct work and cannot fix a bad test
- LESSON-0003 · use when a board/rollup derives live state from worker-written frontmatter during a parallel build wave and shows less in-flight work than exists on disk · the orchestrator must write IN_PROGRESS at dispatch; never rely on workers to self-report their own start
- LESSON-0004 · use when an automated conformance/sync step is about to overwrite a project config from a template or other single-source-of-truth copy · verify the source is truly ahead and re-run the FULL gate after syncing; blind overwrite can revert a fix
- LESSON-0005 · use when parsing or writing markdown frontmatter with gray-matter@4 in Node · pass a no-op options object to bypass gray-matter's content-keyed cache; stringify appends a trailing newline
- LESSON-0006 · use when returning a constant catalog/array of objects to callers or building a plain-object dictionary keyed by user-supplied strings in JS/TS · spread and Object.freeze are shallow; use per-entry copies and Object.create(null) dictionaries, verified by adversarial tests
- LESSON-0007 · use when adding ARIA roles or labels to non-semantic elements in a React project linted by Biome's a11y rules · no aria-label on bare spans, no role=group on divs, interactive roles need tabIndex, nav is not a tablist
- LESSON-0008 · use when writing a regex/marker parser (status fields, delimited lists) over markdown or freeform text · parse markers line-anchored to structural positions, never first-substring-anywhere; strip nested content before splitting on delimiters
- LESSON-0009 · use when selecting the most-recent ISO 8601 timestamp among strings that may come from more than one producer or offset · lexicographic comparison is only safe when every producer stamps the same offset; otherwise compare via Date.parse
- LESSON-0021 · use when a whole-project gate that asserts over all routes/units goes red because one unit is legitimately BLOCKED on an owner action · a shared gate over N units must quarantine a needs-owner-blocked node instead of red-locking unrelated work
- LESSON-0022 · use when an engine or orchestrator is about to set a done/release phase transition whose definition of done includes distinct mandated stages · gate the advance on evidence that EACH mandated stage ran; per-unit passes are not the whole-program audit
- LESSON-0027 · use when about to assert a project/feature's current state by citing a prior audit or proposal finding rather than checking the current code · an audit finding is a snapshot, not a durable fact; re-verify against the live artifact before asserting a state to the owner
- LESSON-0040 · use when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine · rule out BOTH a foreign process reusing the shared port AND an orphaned same-project next-dev lock (process-level, fires even on a free port) before trusting it as a real regression
