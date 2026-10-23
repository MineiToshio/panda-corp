---
id: LESSON-0514
type: gotcha
domain: nextjs
tags: [typecheck, nextjs, next-types, route-rename, false-red, verify.sh]
context: verify.sh's typecheck step fails citing generated .next/types after an App Router route segment was renamed, while a dev/build server from before the rename still holds the .next directory open
trigger: use this when verify.sh typecheck fails on stale .next/types right after renaming a route folder, before assuming the rename itself broke typechecking
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** after renaming App Router route segments (old routes renamed), `verify.sh`'s typecheck step
failed against generated type declarations in `.next/types` that still referenced the OLD route shape.
The failure pre-existed the change under investigation — it was not caused by the rename itself. Deleting
`.next` while a dev/start server still held it open was identified as unsafe.

**Lesson:** `.next/types` is gitignored, generated, incrementally-updated content — it does not atomically
regenerate the instant source routes change, and a typecheck step that includes it can fail-red on STALE
generated types unrelated to the actual source diff being verified. This looks exactly like "the rename
broke typechecking" when the real cause is a generation-vs-source lag.

**Apply next time:** when typecheck reds immediately after a route rename, check whether the cited errors
reference `.next/types` specifically (stale generated declarations) before assuming the renamed route
itself is wrong; resolve by a clean build/dev restart so types regenerate, rather than editing source to
satisfy stale types. Never delete `.next` directly while any dev/start server process still has it open —
stop the server first, since a server holding the directory open can recreate a half-deleted state or
throw unrelated errors mid-deletion.
