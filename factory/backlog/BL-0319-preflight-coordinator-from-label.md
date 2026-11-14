---
id: BL-0319
type: bug
area: build-engine
title: "Preflight must not infer the Codex app from --label codex (wrong degraded reviewer announced)"
status: done
severity: p2
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-14-01 (preflight announced 'Codex Astra (high) (degradada: unreachable)')"
closes: "plugin 10.4.5 — start --preflight takes --coordinator (default claude); engine-v2 passes it"
links: [DR-152, BUILD-10]
---

## Problem
In funko-tracker every preflight announced the reviewers as "Codex Astra (high) (degradada: unreachable)", while the run
itself dispatched FRD reviews to Claude opus xhigh. The owner read this as the engine failing to reach Codex Astra,
although `codex exec -m gpt-6-astra` works on the machine.

## Root cause
`runPreflight` (`plugin/runtime/build/preflight.mjs`) derived the coordinator from the builder label:
`input.coordinator ?? (label === "codex" ? "codex" : "claude")`, and `start --preflight` had no `--coordinator` flag. A
Claude Code session that builds with Codex workers (`--label codex`) was therefore treated as the Codex app (shape R-B),
which makes Claude "unreachable" for routing, so the preview reviewer became the Astra analog on unreachable. The real
run (coordinator `claude-session`, shape R-C) routes a Codex-authored unit's review to the other company, Claude, as
BUILD-10/DR-152 require. Codex reachability itself was never wrong; the preview was.

## Fix plan
`start --preflight` accepts `--coordinator claude|codex` (same meaning as `start --run`); when absent the coordinator is
`claude`, never the label. `detect` gets the session runtime the same way. `plugin/skills/implement/references/engine-v2.md`
passes `--coordinator`. CLI reference 3.0/3.2 updated.

## Tests (prove the fix — TDD, RED → GREEN)
`test-build-v2-preflight.mjs` BL-0319: label codex with no coordinator announces a Claude reviewer (fails on previous
main), an explicit `--coordinator claude` matches it, and an explicit `--coordinator codex` (the Codex app) still
announces the degraded Astra analog.

## Out of scope
Routing a Codex-authored review to Codex Astra while Claude is reachable and in quota: that would be a same-company
review, which DR-152 (owner decisions N2/N6/N7) allows only on Claude quota exhaustion or unreachability. Changing it is a
policy decision for the owner, not an engine fix.
