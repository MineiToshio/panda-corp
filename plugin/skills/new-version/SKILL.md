---
description: Inicia una nueva versión (v2, v3…) de un proyecto Pandacorp ya lanzado - re-entra al pipeline en fase de producto para ampliar scope o iterar. Usar dentro del proyecto cuando Sergio quiera agregar funcionalidades o mejorar una app existente.
---

# /pandacorp:new-version

Nueva iteración de un proyecto existente. Se ejecuta EN el proyecto. `$ARGUMENTS`: qué quiere lograr Sergio con esta versión (o pregúntale).

## Pasos

1. **Contexto**: lee `docs/estado.yaml`, `docs/prd.md` (backlog de futuras versiones), feedback/operación acumulada y los FRDs existentes.
2. **Define la versión**: con el agente `product-manager`, convierte el objetivo en scope concreto — qué FRDs nuevos, qué FRDs existentes cambian, qué se deja fuera (DR-012). Incrementa `version:` en `docs/estado.yaml`.
3. **Re-entra al pipeline, solo lo que cambia**:
   - FRDs nuevos/modificados → `docs/frds/` (numeración continúa)
   - ¿Pantallas nuevas o cambios visuales? → mini fase de diseño (mockup de lo nuevo, mismos tokens congelados; gate visual solo si cambia el lenguaje visual)
   - ¿Impacto arquitectónico? → actualizar blueprint + ADR; si no, saltar
   - Work orders nuevos → `docs/work-orders/` (numeración continúa)
4. **Implementación**: mismo loop de `/pandacorp:implement`. Regresión completa: los tests de versiones anteriores deben seguir verdes.
5. **Release**: `/pandacorp:release` (mismos gates).
6. Sincroniza el portfolio de la fábrica al cerrar (o corre `/pandacorp:sync-portfolio` desde panda-corp).

## Reglas
- La numeración de FRDs/work orders nunca se reinicia — la historia del proyecto es continua.
- No tocar los contratos congelados (design tokens, esquemas públicos) sin ADR que lo justifique.
