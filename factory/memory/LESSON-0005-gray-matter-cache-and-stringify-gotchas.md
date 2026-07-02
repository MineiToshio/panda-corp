---
id: LESSON-0005
type: gotcha
domain: nodejs
tags: [gray-matter, yaml, frontmatter, cache, parsing, node]
context: reading/writing markdown frontmatter with gray-matter@4 in a build engine or a Mission-Control-style reader
trigger: use this when parsing or writing markdown frontmatter with gray-matter@4 in Node
source: factory/memory/_inbox.md (2026-06-16, factory validate-memory.sh authoring); mission-control lessons.md (2026-06-16, lib/memory.ts status parsing + lib/reference.ts; WO-05-001 frontmatter extension) — corroborated across 2 projects, 4+ independent hits
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 0
links: []
---

**Situation:** Multiple readers (the factory's `validate-memory.sh`, Mission Control's `lib/memory.ts`,
`lib/reference.ts`, and the WO-05-001 work-order-status parser) hit the same two `gray-matter@4` traps
independently, across two different projects, over two weeks.

**Lesson:**
1. **`gray-matter@4` keeps an internal LRU cache keyed by the raw file-content string.** Calling
   `matter(content)` twice with the *same* content string in the same Node process returns the cached
   result on the 2nd call — and if the 1st call threw (malformed YAML) while still populating the cache,
   the 2nd call silently returns `{ data: {} }` without throwing. This is a correctness bug waiting to
   happen in any code path that re-parses a file it just parsed (e.g. a status check followed by a real
   read). **Fix:** pass any options object — `{ excerpt: false }` is a no-op flag that bypasses the
   cache. (The `cache` option itself is undocumented in the TS types; use a typed no-op option instead.)
2. **`matter.stringify()` always appends a trailing `\n`** to the body, even if the original
   `parsed.content` had none. Re-parsing a written file and diffing `parsed.content` against the
   pre-write value will show a spurious mismatch. **Fix:** after `stringify`, if the original content had
   no trailing newline and the output does, strip it before writing.
3. Treat non-string YAML frontmatter values (`number`, `null`, `boolean`) for a field expected to be a
   string enum as **absent**, falling back to any legacy marker — a raw YAML type mismatch should not
   crash the reader (DR-078 fail-loud-but-typed).

**Apply next time:** Any new markdown-frontmatter reader/writer in the plugin or a project — always call
`matter(content, { excerpt: false })`, never bare `matter(content)`; when re-parsing written output for a
round-trip check, normalize trailing newlines first. This pattern is now the de-facto standard for every
plugin/memory file reader in Mission Control (`lib/memory.ts`, `lib/reference.ts`) — worth promoting to a
`factory/standards/` note if a third independent project hits it (candidate for `promotion: proposed`).
