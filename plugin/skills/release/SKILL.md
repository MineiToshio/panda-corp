---
description: Prepara y ejecuta el release de un proyecto Pandacorp - auditoría de seguridad, checklist pre-release, deploy a staging y gate humano para producción. Usar dentro del proyecto cuando la implementación de una versión está completa.
---

# /pandacorp:release

Release de versión. Se ejecuta EN el proyecto (requiere `fase: release` en `docs/estado.yaml`).

## Pasos

1. **Auditoría de seguridad** (agente `security-auditor`): hallazgos críticos/altos bloquean el release — se arreglan (via work orders rápidos + review) antes de seguir.
2. **Checklist pre-release** (todo verificado por comandos, no por memoria):
   - Suite completa + e2e verdes; lint y typecheck limpios
   - Variables de entorno documentadas en `.env.example`; secretos SOLO en el entorno de deploy
   - Migraciones de BD probadas (up y down) en entorno limpio
   - README con qué es, cómo correr local y cómo deployar
   - Errores monitoreados (Sentry o equivalente del blueprint)
3. **Deploy a STAGING** (DR-003: auto-aprobado con CI verde) según la estrategia del blueprint. Smoke test sobre staging: los flujos críticos e2e contra la URL real.
4. **GATE HUMANO — PRODUCCIÓN (DR-004)**: presenta a Sergio el resumen (URL de staging para que pruebe, resultado de auditoría, costos al activar producción si los hay — DR-005). **Espera su aprobación explícita. Sin excepciones.**
5. **Deploy a producción** tras aprobación + verificación post-deploy (smoke test en prod).
6. **Cierra**: tag de versión (semver), changelog desde conventional commits, `docs/estado.yaml` → `fase: operacion`, ficha de la idea en la fábrica → `estado: lanzada`, fila del portfolio actualizada.
7. Reporta: URL de producción, versión, y recordatorio de que las mejoras siguen con `/pandacorp:new-version`.

## Reglas
- Nada de "deploy y después auditamos": la auditoría es previa.
- Si Sergio no aprueba, documenta sus razones en `docs/estado.yaml` y genera los work orders de ajuste.
