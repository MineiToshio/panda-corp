---
id: LESSON-0420
type: gotcha
domain: tooling
tags: [boolean-flag, helper-semantics, misdiagnosis, cli-args]
context: a boolean-arg reader helper whose third parameter reads like a "default when absent" but actually encodes the comparison target ("is the arg equal to this value")
trigger: use this when diagnosing a flag's effective default by reading a call site of a boolean-arg helper (e.g. `argBool(args, key, true)`), or when naming/designing such a helper's own parameters
source: "panda-corp build engine — BL-0252/DR-132 (2026-10-18): a diagnosis from another session claimed `STRICT_BASELINE = argBool(args, 'strictBaseline', true)` makes the flag default to true; verified live that `argBool(a, key, expect)` is `a[key] === expect`, so the flag is OFF unless the caller explicitly passes it — the diagnosis read the helper backwards and blamed the wrong mechanism for an unrelated clean-tree escalation bug"
provenance: agent-inferred
created: 2026-10-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0252, DR-132]
---

**Situation:** a cross-session diagnosis asserted that `argBool(args, 'strictBaseline', true)` defaults the
`strictBaseline` flag to active. Reading the helper's actual implementation showed `argBool(a, key, expect)`
returns `a[key] === expect` — the third positional argument is the value being TESTED FOR, not a default
returned when the key is absent. Since the launcher never passes `strictBaseline`, the flag is in fact OFF
by default; the real bug being investigated was a separate clean-tree escalation path, unrelated to this flag.

**Lesson:** a boolean-arg helper's third parameter can be read two completely different ways depending on
naming/convention — "the value to default to when missing" vs. "the value to compare the actual arg
against" — and the two readings produce OPPOSITE conclusions about whether a flag is on or off by default.
A plausible-sounding diagnosis built on the wrong reading sends investigation down the wrong path entirely.

**Apply next time:** before citing a flag's default as the cause of a bug (or clearing it as a cause), open
the helper's actual source and confirm which semantic its signature implements — never infer it from the
call site's shape alone, since `argBool(args, key, true)` is genuinely ambiguous between "default true" and
"true if it equals true" without reading the body.
