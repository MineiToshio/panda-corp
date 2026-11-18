---
id: LESSON-0686
type: gotcha
domain: nextjs
tags: [glob, path-matching, dynamic-routes, nextjs, validation]
context: writing or validating an approved-file/glob-pattern list against real project file paths in a Next.js (App Router) project
trigger: use this when building or debugging a glob/approval-pattern matcher that must accept paths containing literal square brackets, such as Next.js dynamic-route folders (e.g. app/piece/[id]/page.tsx)
source: "funko-tracker br-2026-11-16-01, u-build-wo-12-004 — the build engine's scope-repair approvalFiles check rejected `[id]` as if it were a glob wildcard, even though artifact matching and Git both treat it as a literal path segment; fixed in BL-0329 by accepting literal brackets while still rejecting * and ? wildcards."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0329]
---

**Situation:** a scope-repair command needed to approve a specific file path for a worker, but the path
included a Next.js dynamic-route segment, `src/app/(catalog)/piece/[id]/...`. The approval validator
rejected the request outright, treating the `[` `]` characters as glob-wildcard syntax (as `[abc]`
character-class wildcards normally are in shell/minimatch-style globs) rather than as the literal
directory name Git, the filesystem, and Next.js's own router all treat them as.

**Lesson:** square brackets are overloaded — most glob libraries interpret them as a character class,
but a framework convention (Next.js dynamic routes, and similarly bracket-named folders in other
frameworks) uses them as literal, meaningful path segments. A validator that blanket-rejects or
mis-interprets brackets as wildcards will break on any project using that convention, even though the
underlying file-matching/Git layer already treats the path as literal.

**Apply next time:** when writing or auditing a glob/approval-pattern matcher that will run against
real project paths, explicitly decide what each special character means and test it against a bracket-
named path before shipping: accept literal `[` `]` as ordinary characters (matching what the filesystem/
Git/artifact matcher already does), and reserve wildcard behavior for the characters that are actually
meant to be wildcards (`*`, `?`) — never let "contains brackets" alone trigger wildcard rejection.
