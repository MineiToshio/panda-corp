---
description: Prepara y ejecuta el release de un proyecto Pandacorp - auditoría de seguridad, checklist pre-release, deploy a staging y gate humano para producción. Usar dentro del proyecto cuando la implementación de una versión está completa.
---

# /pandacorp:release

Release de versión. Se ejecuta EN el proyecto (requiere `fase: release` en `docs/status.yaml`).

## Pasos

1. **Auditoría de seguridad** (agente `security-auditor`): OWASP web esencial + **OWASP Top 10 for Agentic Applications** (ASI01–ASI10, DR-017) si el producto tiene agentes/LLMs con herramientas. Hallazgos críticos/altos bloquean el release — se arreglan (vía work orders rápidos + review) antes de seguir.
2. **Copy de landing + telemetría** (en paralelo a la auditoría):
   - `copywriter`: escribe el copy de la landing del MVP (headline, propuesta de valor, beneficios, CTA, FAQ) con `title`/meta description legibles y orientados a la intención de búsqueda (colabora con `factory/standards/seo-i18n.md`). Ningún claim sin respaldo.
   - `analytics`: verifica que los eventos de `docs/analitica/eventos.md` se disparan de verdad en el flujo crítico (no "deberían" — evidencia) y deja el embudo de la hipótesis de valor documentado.
3. **Checklist pre-release** (todo verificado por comandos, no por memoria):
   - Suite completa + e2e verdes; lint y typecheck limpios
   - Variables de entorno documentadas en `.env.example`; secretos SOLO en el entorno de deploy
   - Migraciones de BD probadas (up y down) en entorno limpio
   - README con qué es, cómo correr local y cómo deployar
   - Errores monitoreados (Sentry o equivalente del blueprint) y health check activos
4. **Deploy a STAGING** (agente `devops`; DR-003: auto-aprobado con CI verde) según la estrategia del blueprint. Smoke test sobre staging: los flujos críticos e2e contra la URL real.
5. **GATE HUMANO — PRODUCCIÓN (DR-004)**: presenta al dueño el resumen (URL de staging para que pruebe, resultado de auditoría, costos al activar producción si los hay — DR-005, **incluido el aviso de Vercel Pro si la versión cobra dinero — DR-035**). Dispara push al dueño (DR-038). **Espera su aprobación explícita. Sin excepciones.**
6. **Deploy a producción** (agente `devops`) tras aprobación + verificación post-deploy (smoke test en prod) + plan de rollback listo.
7. **Cierra** (documentación viva, DR-018): tag de versión (semver), **changelog auto-generado desde Conventional Commits**, ADRs al día (proponer uno si el release incluyó un cambio arquitectónico no registrado), README/docs de usuario actualizados, `docs/status.yaml` → `fase: operacion`, ficha de la idea en la fábrica → `estado: lanzada`, fila del portfolio actualizada.
8. Reporta: URL de producción, versión, y recordatorio de que las mejoras siguen con `/pandacorp:new-version`.

## Reglas
- Nada de "deploy y después auditamos": la auditoría es previa.
- Si el dueño no aprueba, documenta sus razones en `docs/status.yaml` y genera los work orders de ajuste.
