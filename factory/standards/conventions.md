# Convenciones de código

## Idioma — regla: committed = inglés / gitignored = español

**El estado en git decide el idioma del texto.** Así cualquiera que clone el repo lo ve todo en inglés, y el dueño opera Pandacorp en español. Cada artefacto nace ya en su idioma correcto: no hay capa de traducción al vuelo.

- **Código 100% en inglés**: variables, funciones, tipos, comentarios, logs, mensajes de commit.
- **Nombres de archivo y carpeta SIEMPRE en inglés**, sin importar el idioma del contenido.
- **Documentos de producto/técnicos → inglés y committeados**: PRD, FRDs, blueprint, ADRs, README, contrato de API, tests, y la `docs/bitacora.md` del proyecto (historia real del producto).
- **Comunicación con Pandacorp → español y gitignored** (capa local, regenerable, no viaja con el repo): resumen del proyecto, puntos de decisión (`docs/decisiones.md`), logs, actividad, feed de Mission Control, y `docs/iteracion.md`.
- **`docs/estado.yaml` → committeado, solo estado de máquina en inglés** (claves, enums, contadores, SHAs); la prosa legible (avance, pendientes) vive en la capa española gitignored. Mission Control mapea los valores a etiquetas en español.
- **Contenido visible al usuario** (UI): nunca hardcodeado — va en i18n (`src/i18n/locales/<locale>/*.json`), español por defecto. Emails incluidos.

> **Retomar en otra máquina:** lo committeado (FRD/PRD/work orders/`estado.yaml`) es la verdad para retomar; la capa española es una vista local que se regenera. Por eso, cierra/avanza una fase antes de saltar de máquina: el feedback en vuelo de `docs/iteracion.md` es local y, al avanzar, sus conclusiones aterrizan en el doc inglés committeado.

## Naming
| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos y carpetas | camelCase | `userProfile.tsx`, `lib/auth/` |
| Variables y funciones | camelCase | `fetchOrders()`, `isLoading` |
| Tipos / interfaces | PascalCase | `User`, `OrderStatus` |
| Componentes | PascalCase | `Button`, `UserCard` |
| Constantes | UPPER_SNAKE_CASE | `APP_NAME`, `ROUTES` |
| Event handlers | `handle*` | `handleSubmit()` |
| Hooks | `use*` | `useUser()` |
| Booleans | `is/has/can*` | `isOpen`, `hasError` |

## Tipado
- Tipado estricto SIEMPRE (`tsconfig` con `strict: true`; en Python `mypy --strict`).
- Preferir `unknown` sobre `any`. `any` y `@ts-ignore` prohibidos.
- Tipos de retorno explícitos en funciones públicas. Non-null assertion (`!`) como último recurso.

## Constantes y sin magic values
- Nada de strings/números mágicos repetidos inline. Extraer a `src/lib/constants.ts` (`ROUTES`, `APP_NAME`, eventos de analytics, etc.).

## Validación en fronteras
- Validar todo input externo (Server Actions, route handlers, APIs) con esquemas (Zod o equivalente). Centralizar los esquemas, no inline.

## Imports
- Alias absoluto `@/*` → `./src/*`. Evitar imports relativos de más de un nivel (`../../..`).

## Handlers
- Nada de lógica inline en JSX: usar handlers nombrados (`const handleClick = () => {...}`).

## Comentarios y commits
- Comentarios explican **por qué/qué**, no referencias a tickets/issues/épicas en el código.
- **Conventional Commits** con scope, en inglés: `feat(orders): add table selection`, `fix(api): handle null response`.
