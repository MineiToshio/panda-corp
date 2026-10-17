---
id: BL-0240
type: bug
area: templates
title: "stack-a-nextjs template ships files that violate its own biome.json + a stale schema version"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): 'stack-a template ships e2e/tokens.spec.ts (cognitive complexity 31 > 15) and e2e/screenshot-prototype.mjs (unformatted) that its own canonical biome.json rejects, and biome.json's $schema is 2.5.1 while the cooldown-latest CLI is 2.5.15 (info line); fix upstream in plugin/templates/stack-a-nextjs'"
closes:
links: []
---

## Problem

The `stack-a-nextjs` template (`plugin/templates/stack-a-nextjs/`) ships its own `biome.json` AND two
files that, as scaffolded verbatim, fail that same `biome.json`'s rules: `e2e/tokens.spec.ts` (a function
whose cognitive complexity is 31, over the template's own configured ceiling of 15) and
`e2e/screenshot-prototype.mjs` (not run through the formatter before being committed to the template).
Separately, `biome.json`'s `$schema` pins `2.5.1` while the CLI resolved by the template's declared
dependency range is `2.5.15`, which biome reports as an informational drift line on every run. A project
scaffolded from this template inherits a RED (or noisy) lint/format gate on day one, before any project
code is written — on pandasaga this surfaced during the architecture phase's own verification.

## Root cause

The template's fixture files (`tokens.spec.ts`, `screenshot-prototype.mjs`) were authored/edited without
re-running `biome check`/`biome format` against the template's own `biome.json` afterward, so drift
between the two went unnoticed until a freshly scaffolded project's first gate run hit it. The `$schema`
value is a separate, simpler staleness: it was pinned once and never bumped alongside the biome CLI
version the template's `package.json` resolves to.

## Fix plan

1. In `plugin/templates/stack-a-nextjs/e2e/tokens.spec.ts`, refactor the over-complexity function (split
   into smaller named helpers) until `biome check` passes against the template's own `biome.json`.
2. Run `biome format --write` on `plugin/templates/stack-a-nextjs/e2e/screenshot-prototype.mjs` and commit
   the formatted version.
3. Bump `plugin/templates/stack-a-nextjs/biome.json`'s `$schema` to match the biome CLI version the
   template's `package.json` resolves to (currently `2.5.15` or whatever is current at fix time).
4. Scaffold a throwaway project from the template and run its gate/`biome check` to confirm a clean,
   zero-violation, zero-info-line result before committing.

## Tests (prove the fix — TDD, RED → GREEN)

- RED: run `biome check` (and `biome ci`/project gate) against the UNPATCHED template's own
  `e2e/tokens.spec.ts` and `e2e/screenshot-prototype.mjs` — both fail (complexity violation; unformatted
  diff).
- GREEN: after the fix, the same command against the patched files passes clean, and the `$schema` info
  line is gone.

## Done when

- `biome check` on `plugin/templates/stack-a-nextjs` reports zero violations and zero schema-drift info
  lines.
- A freshly scaffolded project from the template passes its first-run lint/format gate with no
  pre-existing violations.
- Plugin version bumped (PATCH — template fixture fix, no capability change) + decision-log entry added.

## Out of scope

- Does not change `stack-a-nextjs`'s biome RULES (ceiling of 15, etc.) — only brings the shipped fixtures
  into compliance with the existing configured rules.
