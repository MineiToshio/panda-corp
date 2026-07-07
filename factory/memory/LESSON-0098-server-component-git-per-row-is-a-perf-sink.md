---
id: LESSON-0098
type: pattern
domain: performance
tags: [server-components, nextjs, git, performance, react-cache]
context: a dynamic Next.js Server Component reader that shells out to git ONCE PER ROW (one `git show`/`git log -G` invocation per commit or per file) to build a page of history/activity data
trigger: use this when a Server Component page that derives data from git history feels slow, or before writing a new one that would invoke git per list item
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (FRD-23/achievements build) — agent-inferred; measured ~2.5s to ~0.45s (/achievements), weeklyFlow 1943ms to 151ms"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Server Component reader shelled out to git PER ROW — one `git show` (or `git log -G`) per
commit or per file — to assemble a page's data. Because the page is dynamic, this re-runs on EVERY request;
`React.cache()` only dedupes calls within a single render, it does not amortize the N-per-row cost. The
result was a silent, easy-to-miss perf sink: correct output, just slow (measured ~2.5s → ~0.45s and
1943ms → 151ms after the fix on the same real repo).

**Lesson:** when a data source is naturally a single ordered stream (git history over a pathspec), reading
it row-by-row with N separate subprocess invocations is O(N) subprocess overhead for data that a single
pass could produce. Collapsing to ONE `git log --reverse -p` pass over the pathspec — parsing NUL-marked
dates and `+…` added-diff lines out of the single stream — produces output-identical results 15-40× faster.

**Apply next time:** before shipping (or when profiling) a Server Component reader that loops over N
items and shells out to git (or any external process) per iteration, check whether a single streaming
invocation over the whole range can produce the same data by parsing its output, and verify output
equivalence old-vs-new against the real repo before switching — this is a mechanical collapse, not a
behavior change, so a byte-for-byte comparison on real data is the right proof.
