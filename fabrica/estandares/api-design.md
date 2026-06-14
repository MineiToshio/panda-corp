# Diseño de APIs

> Dominio: Programación · Severidad: **MUST** en proyectos tipo API/servicio (stacks B/C/D; también route handlers del stack A). Enforcement: lint/CI. Ver DR-028.

## Regla — contrato de error (RFC 9457)
- Los errores HTTP devuelven **`application/problem+json`** (RFC 9457, que obsoleta a 7807) con los 5 miembros: `type` (default `about:blank`), `title` (estable salvo i18n), `status`, `detail`, `instance`.
- Errores de validación con una **extensión propia** `errors[]` de `{detail, pointer}` (RFC 9457 permite extensiones; esto NO es normativo). `pointer` = JSON Pointer (RFC 6901).
- Helper compartido `problem()` en el golden path (Next Route Handlers + APIs Python).

## Regla — REST
- Recursos bien nombrados, versionado `/v1`, paginación, **códigos HTTP estándar**.
- **Validación en el borde antes de la lógica** (Zod / pydantic), que genera estos cuerpos de error de forma consistente. (Reusa la convención de validación en fronteras de `convenciones.md`, definiéndole su salida.)

## Cómo se verifica
- `verify.sh` / lint asevera el content-type `application/problem+json` y la presencia de los miembros requeridos en las respuestas de error.

## Por qué
Un contrato de error estándar y máquina-legible hace que los clientes (y otros agentes) manejen errores de forma uniforme, en vez de strings ad-hoc por endpoint.

Fuentes: rfc-editor.org/rfc/rfc9457
