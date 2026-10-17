---
id: BL-0238
type: change
area: plugin-skill
title: "Add a freeze.mjs bootstrap that proposes a starting fidelity.config.json for a project that did not accumulate one"
status: open
severity: p2
opened: 2026-10-16
closed:
source: "funko-tracker timed design-freeze e2e validation (2026-10-16), finding 6"
closes:
links: [DR-129]
---

## Problem
The design freeze (`plugin/skills/design/references/freeze-and-fidelity.md`) assumes the fidelity config
`docs/design/freeze/fidelity.config.json` was accumulated during the design rounds (`references/iteration-loop.md`
item 10, added in plugin 9.127.1). A project that reaches the freeze without it must author `components`, `states`,
`floating`, `css.families`/`rules`/`overrides` and `exports` by hand before the clock starts. For funko-tracker that
was 119 components, 312 states, 49 CSS families and 55 overrides: the biggest owner-time cost of the validated freeze.

## Fix plan
1. `plugin/skills/design/scripts/fidelity/bootstrap.mjs` + a `bootstrap` subcommand in `freeze.mjs` that WRITES A
   PROPOSAL (`docs/design/freeze/fidelity.config.proposed.json`, never over an existing config):
   - `css.families` + `css.rules` from the prototype's top-level CSS section comments, in order (each comment opens a
     family; a rule regex from the key-selector stems inside the section);
   - `states.<frd>` from the `[data-screen]` sections, one default state per screen, mapped to FRDs only when an FRD's
     `visual_source` names the screen;
   - `components` from `docs/design/components.md` rows that cite a selector, one `default` state each;
   - `exports` from the example expression when the sprite has `i-`-prefixed symbols.
2. Print what it could not infer (components with no selector, CSS outside any section comment) as a to-do list.
3. Document it in `scripts/fidelity/README.md` ("Who writes the config, and when") and in the
   `freeze-and-fidelity.md` entry condition for a project without an accumulated config.
Only if it stays robust and small (about 150 lines); else keep the documented manual path and close this as won't-do.

## Tests (prove the fix — TDD, RED → GREEN)
In `plugin/scripts/test-design-fidelity.mjs`, on the `fixtures/design-mini` prototype with its config removed:
the proposal validates against `config.schema.json`, its families follow the CSS section order, `freeze.mjs split`
on it reports 0 heuristic rules for the sectioned CSS, and the command refuses to overwrite an existing config.

## Done when
- The tests above pass; `freeze.mjs bootstrap` is listed in the README and the freeze doc.
- Plugin version bumped (PATCH or MINOR per DR-034) with a plugin decision-log entry.

## Out of scope
Inferring component states beyond `default`, or floating panels: those stay design judgment.
