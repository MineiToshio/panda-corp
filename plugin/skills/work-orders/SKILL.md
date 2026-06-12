---
description: Genera las órdenes de trabajo (work orders) de un proyecto Pandacorp desde los FRDs y el blueprint - tareas implementables, verificables y ordenadas por dependencias. Usar dentro del proyecto después de /pandacorp:blueprint.
---

# /pandacorp:work-orders

Descomposición en work orders. Se ejecuta EN el proyecto (requiere FRDs y blueprint).

## Pasos

1. Lee todos los FRDs de v1 y el blueprint. Construye el grafo de dependencias (¿qué necesita el modelo de datos? ¿qué necesita auth? ¿qué es independiente?).
2. **Genera** `docs/work-orders/wo-NN-<nombre>.md`, cada uno con:
   - FRD(s) que implementa y criterios de aceptación copiados (el implementador no debe ir a buscarlos)
   - Alcance exacto: qué archivos/módulos toca; qué NO incluye
   - Dependencias (wo previos) y definición de terminado: tests de los criterios verdes + typecheck + lint + review aprobada
   - Estado: `pendiente | en-progreso | en-review | terminado` (checkbox + evidencia)
3. **Tamaño correcto**: cada work order completable en una sesión de agente (ni "construir el backend" ni "renombrar una variable"). Típico: 5-15 work orders para una v1.
4. **Orden de ejecución**: lista maestra en `docs/work-orders/README.md` con el orden y qué se puede paralelizar (sin archivos compartidos entre paralelos).
5. **Actualiza** `docs/estado.yaml` → `fase: implementacion` y commit. Resumen a Sergio: cuántos work orders, orden, estimación gruesa. Siguiente paso: `/pandacorp:implement`.

## Reglas
- El primer work order siempre es la base: esquema de datos + seeds + smoke test del entorno.
- Cada criterio de aceptación de cada FRD debe estar cubierto por exactamente un work order (sin huecos ni duplicados).
