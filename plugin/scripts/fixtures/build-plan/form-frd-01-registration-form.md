---
id: BP-01
---
# Blueprint (bench-form frd-01-registration-form, Build Plan section verbatim)

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-01-001 | none | `next.config.ts`, `messages/es.json`, `src/i18n/**`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/cn.ts`, `src/lib/_tests/**`, `src/components/core/**`, `src/test/setup.ts`, `docs/design/components.md` | true | WO-01-002 |
| WO-01-002 | none | `src/lib/registration/**` | false | WO-01-001 |
| WO-01-003 | WO-01-001, WO-01-002 | `src/app/page.tsx`, `src/app/_components/**`, `e2e/registration.spec.ts`, `e2e/routes.ts` | false | none |

- **Order & parallelism:** WO-01-001 (foundation) and WO-01-002 (pure logic) run in parallel in wave 1; their artifacts are disjoint. WO-01-003 runs in wave 2 after both are done.
- **Integration order:** foundation tokens, i18n and primitives; validation module; then the form and page that consume both. The page is the only consumer of the primitives and of the validation module.
- **Cross-FRD dependencies:** none (single FRD).
- **No API contracts:** there is no backend work order, so no `docs/api/` file is owed.
- **Visual spec:** WO-01-001 and WO-01-003 reproduce `docs/frds/frd-01-registration-form/mocks/registration.html`, `registration-errors.html` and `registration-success.html` (with `fdd.md`) on the tokens in `docs/design/design-tokens.json`. No external assets are needed (no images or icons); the font is the one already loaded in the layout.
- **Gate note:** the dead-code gate can only pass once WO-01-003 consumes the primitives, `cn()` and the validation module; the gate runs per FRD after all three work orders, so this is expected.
- **Dependency versions:** every library is already installed at an exact version (see `architecture.md`); no work order adds a package.

## Work Orders
