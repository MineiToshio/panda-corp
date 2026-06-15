# Estructura de proyecto

Estructura de referencia para el stack web por defecto (Next.js App Router). Otros stacks aplican el espíritu: capas separadas, data layer aislado, código por dominio, tests colocados.

```
src/
├── app/                      # rutas (App Router). [locale]/ si hay i18n
│   ├── (grupo)/              # route groups: (landing), (app)…
│   └── .../_components/      # componentes específicos de esa ruta (prefijo _ = no es ruta)
├── components/
│   ├── core/                 # primitivos reutilizables (Button, Input, Modal…)
│   └── modules/              # componentes compuestos reutilizables
├── queries/                  # ÚNICO lugar con acceso a la BD (Prisma/ORM). Nunca desde componentes
├── lib/                      # utilidades agrupadas por dominio: auth/, analytics/, integrations/…
├── hooks/                    # hooks de app
├── types/                    # tipos de app
├── contexts/                 # React Context (p. ej. ThemeContext)
└── i18n/                     # routing, request y locales/<locale>/*.json
e2e/                          # tests end-to-end (Playwright)
docs/                         # documentación del proyecto (ver pipeline Pandacorp)
```

## Reglas de estructura
- **Data layer aislado**: todo acceso a BD vive en `queries/` (o capa equivalente). Los componentes/acciones llaman a `queries/`, nunca al ORM directo.
- **Código por feature**: lo específico de una ruta va en sus `_components/`, `_actions/`, `_schemas/`, `_hooks/`. Regla de promoción: si lo usa una sola ruta, se queda local; si lo usan varias, sube a `components/`, `lib/`, etc.
- **Reuso antes de crear**: revisar en orden `components/core` → `components/modules` → `_components` del padre → la misma ruta. Solo crear si no existe.
- **Tests colocados**: junto al código (`*.test.ts`) o en `_tests/` dentro del folder del componente/feature. E2E en `e2e/`.
- Para backends sin frontend (API, scraping): capas Routes → Services → Repositories; data layer aislado igual.
- **Documentación viva**: todo proyecto lleva `docs/bitacora.md` (historia de decisiones, con el porqué) además de PRD/FRDs/blueprint. Cada cambio relevante actualiza su doc canónico **y** la bitácora — regla de dos capas en [documentacion.md](documentacion.md).
