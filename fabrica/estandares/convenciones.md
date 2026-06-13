# Convenciones de código

## Idioma
- **Código 100% en inglés**: variables, funciones, tipos, comentarios, logs, mensajes de commit.
- **Documentos de proyecto en español** (PRD, FRDs, etc.).
- **Contenido visible al usuario**: nunca hardcodeado — va en i18n (`src/i18n/locales/<locale>/*.json`), español por defecto. Emails incluidos.

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
