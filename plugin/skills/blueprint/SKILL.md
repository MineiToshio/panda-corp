---
description: Fase de arquitectura de un proyecto Pandacorp - blueprint técnico, elección de golden path, modelo de datos, ADRs e instalación del stack. Usar dentro del proyecto después de /pandacorp:design.
---

# /pandacorp:blueprint

Fase de arquitectura. Se ejecuta EN el proyecto (requiere PRD, FRDs y diseño congelado).

## Pasos

1. **Blueprint** (agente `architect`): `docs/blueprint.md` con stack elegido (golden path A/B/C/D + racional según DR-002), arquitectura, modelo de datos completo, contratos de API, integraciones externas (límites y costos), estrategia de testing y deploy. ADRs en `docs/adr/` por cada decisión no obvia.
2. **Validación cruzada**: cada FRD debe mapear a componentes del blueprint. Si algo no cierra, vuelve al `architect` antes de continuar.
3. **Instala el stack**: sigue la guía `${CLAUDE_PLUGIN_ROOT}/templates/stack-<elegido>/STACK.md` (scaffolder oficial + configuración estándar Pandacorp: strict, Biome/Ruff, Vitest/pytest, estructura de carpetas). Verifica que lint + typecheck + test corren en limpio.
4. **Crea `.pandacorp/verify.sh`** en el proyecto (lo usa el hook de Stop): script que corre lint + typecheck + tests rápido y sale ≠0 si algo falla. La guía del stack trae el contenido exacto.
5. **CI**: GitHub Actions con lint + typecheck + tests en PR (plantilla en la guía del stack). Branch protection en main si el repo GitHub existe.
6. **Actualiza** `docs/estado.yaml` → `fase: work-orders` y commit. Presenta a Sergio: stack elegido y por qué, costo mensual estimado, y riesgos técnicos si los hay. Siguiente paso: `/pandacorp:work-orders`.

## Reglas
- Lo MÍNIMO que cumple los FRDs: sin microservicios, sin features de infraestructura especulativas, costo ~$0 al lanzar.
- Si una integración externa requiere pagar (API de pago, plan), aplica DR-005: escalar a Sergio con el monto.
