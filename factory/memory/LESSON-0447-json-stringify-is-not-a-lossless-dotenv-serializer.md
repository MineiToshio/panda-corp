---
id: LESSON-0447
type: gotcha
domain: env-config
tags: [dotenv, serialization, json-stringify, env-handoff, data-loss]
context: writing/rebuilding a `.env*` file programmatically from an in-memory key/value map
trigger: use this when any script or helper needs to WRITE a dotenv-formatted file (an env handoff, a migration, a backup/restore round-trip) rather than just read one
source: "factory/memory/_inbox.md 2026-10-20 (agent-inferred) — funko-tracker env-handoff preparation, caught by a fixture-based review before shipping"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a helper used `JSON.stringify` (or an equivalent generic string-escaping call) to serialize
values back into dotenv `KEY=value` lines when rebuilding an env handoff file. A fixture-based review that
round-tripped real values through the writer and then the project's REAL dotenv loader (not just the
writer in isolation) reproduced corrupted quotes/backslashes and silently dropped entries the writer didn't
recognize, before this shipped anywhere.

**Lesson:** `JSON.stringify` escapes for JSON string literals, not for dotenv's own quoting/escaping rules
(which differ across loaders — bare values, single vs double quotes, `\n` handling, unknown-key handling
all vary). Treating it as a generic "safe string serializer" silently corrupts round-tripped values and can
drop keys the writer doesn't expect, with no error — the failure only shows up later, in the consuming
app, as a wrong or missing secret.

**Apply next time:** never reuse a generic serializer (JSON, YAML, etc.) to write dotenv-formatted output.
Preserve bytes for values that already came from a dotenv file (treat them as opaque strings, don't
re-escape them), and prove any new dotenv writer against the PROJECT'S OWN loader with a round-trip fixture
(write → reload → compare) before trusting it — a writer that only "looks right" to the eye is not
verified.
