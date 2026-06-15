# Project structure

Reference structure for the default web stack (Next.js App Router). Other stacks apply the spirit: separated layers, isolated data layer, code by domain, colocated tests.

```
src/
├── app/                      # routes (App Router). [locale]/ if there is i18n
│   ├── (group)/              # route groups: (landing), (app)…
│   └── .../_components/      # components specific to that route (_ prefix = not a route)
├── components/
│   ├── core/                 # reusable primitives (Button, Input, Modal…)
│   └── modules/              # reusable composed components
├── queries/                  # THE ONLY place with DB access (Prisma/ORM). Never from components
├── lib/                      # utilities grouped by domain: auth/, analytics/, integrations/…
├── hooks/                    # app hooks
├── types/                    # app types
├── contexts/                 # React Context (e.g. ThemeContext)
└── i18n/                     # routing, request and locales/<locale>/*.json
e2e/                          # end-to-end tests (Playwright)
docs/                         # project documentation (see Pandacorp pipeline)
```

## Structure rules
- **Isolated data layer**: all DB access lives in `queries/` (or an equivalent layer). Components/actions call `queries/`, never the ORM directly.
- **Code by feature**: what is specific to a route goes in its `_components/`, `_actions/`, `_schemas/`, `_hooks/`. Promotion rule: if only one route uses it, it stays local; if several use it, it moves up to `components/`, `lib/`, etc.
- **Reuse before creating**: check in order `components/core` → `components/modules` → the parent's `_components` → the route itself. Only create if it doesn't exist.
- **Colocated tests**: next to the code (`*.test.ts`) or in `_tests/` inside the component/feature folder. E2E in `e2e/`.
- For frontend-less backends (API, scraping): layers Routes → Services → Repositories; isolated data layer the same.
- **Living documentation**: every project carries `docs/decision-log.md` (history of decisions, with the why) in addition to the PRD/FRDs/blueprint. Each relevant change updates its canonical doc **and** the decision log — two-layer rule in [documentation.md](documentation.md).
