---
id: LESSON-0534
type: gotcha
domain: factory-engineering
tags: [yaml, frontmatter, validate-memory, backlog, escaping]
context: writing a LESSON-*/BL-* frontmatter field (e.g. `source:`) that quotes a regex or any text containing a literal backslash, inside a YAML double-quoted scalar
trigger: use this when generating or editing frontmatter for factory/memory/LESSON-*.md or factory/backlog/BL-*.md whose `source:` (or any field) cites a regex/pattern with escaped metacharacters (`\$`, `\.`, `\(`, etc.)
source: 'factory/memory/_inbox.md note, 2026-10-25 (agent-inferred) — validate-memory.sh flagged BL-0282 as INVALID because its source: field cited a regex fragment containing \$ twice inside a YAML double-quoted scalar; \$ is not a valid YAML escape (only \\, \", \n, etc. are), which broke the parse. Fixed by hand by doubling the backslash (\\$); landed in commit b8187466.'
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0282]
---

**Situation:** `factory/backlog/BL-0282-*.md`'s `source:` field quoted a `block-dangerous.sh` regex
literally, including two occurrences of `\$` (an escaped end-of-string anchor) inside a YAML
double-quoted (`"..."`) scalar. YAML double-quoted scalars only support a fixed escape set (`\\`, `\"`,
`\n`, `\t`, `\uXXXX`, …) — `\$` is not one of them, so the parser broke, and `validate-memory.sh`
(run against the sibling `factory/memory/` store, but the same YAML-frontmatter risk applies to
`factory/backlog/`) surfaced it as schema-invalid. A human fixed it by doubling the backslash (`\\$`).

**Lesson:** Any frontmatter field written as a YAML double-quoted scalar that needs to contain a literal
backslash (quoting a regex, a shell escape, a Windows path, etc.) silently breaks parsing unless every
`\` is doubled to `\\` first — and this is easy to get wrong when an agent copy-pastes a pattern straight
from a script or a grep command into a `source:`/`context:` field without thinking about the destination
format's escaping rules.

**Apply next time:** When writing a `LESSON-*`/`BL-*` frontmatter field that must quote text containing a
literal backslash: either (a) switch that field to a YAML **single-quoted** scalar (`'...'`), which does
not interpret backslash escapes at all (only `''` escapes a literal single quote) — the simpler, safer
default for this exact shape — or (b) if a double-quoted scalar is kept, escape every literal `\` as
`\\` before writing. Either way, run `bash plugin/scripts/validate-memory.sh factory/memory` (or the
backlog equivalent) right after writing any frontmatter that quotes a pattern, rather than assuming it
parsed — this class of error is silent until that validator runs.
