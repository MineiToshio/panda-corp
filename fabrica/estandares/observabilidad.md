# Observabilidad (operación / producción)

> Dominio: Operación · Severidad: **MUST** el baseline; el resto escalonado. Enforcement: checklist + CI. Complementa `infra.md` (que cubre solo dev local).

## Regla
- **Baseline obligatorio (todo proyecto), barato:**
  - **Logs estructurados JSON** (Pino o equivalente) con `service.name` = nombre del proyecto en el portfolio, nivel y timestamp; `trace_id`/`span_id` cuando haya request context.
  - **Error-tracking** integrado (Sentry, del stack) desde el día 1 (DR-026).
  - **Nunca loguear PII ni secretos** (ver `privacidad.md`).
- **Escalonado (cuando el proyecto lo necesita):** instrumentación portable con **OpenTelemetry** (vendor-neutral): auto-instrumentación de librerías, atributos de resource del entorno, `instrumentation.ts` (hook nativo de Next) en el golden path web.

## Cómo se verifica
- Checklist en `/pandacorp:release`: ¿logs estructurados? ¿Sentry conectado? ¿`service.name` correcto?
- Los datos van a **Sentry** (errores/trazas) y **PostHog** (analytics), ya presentes — OTel es la capa de instrumentación, **no un pipeline paralelo**.

## Por qué
Sin observabilidad no se opera un portfolio: un fallo en producción debe ser visible y atribuible. Traces/Metrics OTel son estables; **Logs vía OTel son experimentales** (adoptar con cautela). No imponer traces+metrics+logs desde el MVP (choca con DR-012 corte mínimo).

Fuentes: opentelemetry.io/docs/languages/js
