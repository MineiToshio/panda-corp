---
id: LESSON-0456
type: pattern
domain: documentation-tooling
tags: [snapshot, export, react, markdown, doc-reader, design-tokens]
context: building an offline snapshot/export tool for a documentation surface that is NOT stored as plain markdown files, but composed/authored directly in a React component
trigger: use this when an export/snapshot script needs to reproduce a documentation page outside the running app, and the page's content doesn't live in a markdown file the exporter can simply re-parse
source: "mission-control .pandacorp/run/lessons.md 2026-10 (agent-inferred) — Mission Control's own Manual pages are composed in src/app/manual/manualPages.tsx (React), not markdown; an export script that only snapshotted the markdown-index showed a placeholder instead of the real guide body. The fix (capturing the rendered DOM via a headless browser, keyed on a stable `data-testid`, then stripping/remapping its inline `--color-*` CSS vars) was already in flight in the same project when this was captured"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an export/snapshot tool assumed every documentation page it needed to reproduce had a
backing markdown file it could re-parse offline. One section of the real app was instead composed
directly in React (a TSX module defining the page's structure/content as JSX, not as markdown read at
render time) — the exporter's markdown-based approach produced nothing for that section, surfacing a
"content unavailable" placeholder instead of the real guide.

**Lesson:** a documentation surface authored as React/JSX has no markdown source for an offline exporter
to re-parse — the content only exists as the DOM the app actually renders. Re-deriving or guessing at
that content from source code is fragile and drifts from the real rendering (different markup, different
inline styles/tokens). The only faithful way to capture it offline is to drive a real (headless) browser
against the running app, wait for a STABLE selector that marks the authored content boundary (e.g. a
dedicated `data-testid`), and snapshot that DOM subtree directly — then sanitize it (strip script/style/
interactive-only nodes, remap inline CSS custom-property references like `--color-*` so the snapshot can
be themed/restyled outside the live app) rather than attempting to reconstruct it from the component's
source.

**Apply next time:** before building (or trusting) an export/snapshot pipeline for a documentation/content
surface, check whether that surface's content lives in a markdown/data file the exporter can read offline,
or is composed directly in a UI component. For the latter, capture via a headless browser against a
stable, dedicated test selector and sanitize the resulting DOM subtree — don't ship (or rely on) a
markdown-only exporter for content that was never markdown.
