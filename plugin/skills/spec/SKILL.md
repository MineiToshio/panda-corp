---
description: Fase de producto de un proyecto Pandacorp - investigación profunda + PRD + FRDs con criterios de aceptación. Usar dentro de la carpeta de un proyecto, después del scaffold. Es la fase 2 del pipeline.
---

# /pandacorp:spec

Fase de producto. Se ejecuta EN la carpeta del proyecto (verifica que exista `docs/idea-origen.md`; si no, estás en el lugar equivocado — dile a Sergio).

## Pasos

1. **Investigación profunda** (agentes `researcher` en paralelo):
   - Competidores/alternativas: qué hacen bien, qué les reclaman los usuarios (reviews)
   - Usuarios objetivo: cómo resuelven el problema hoy, vocabulario que usan
   - Funcionalidades: qué es table-stakes, qué sería diferenciador
   - Viabilidad: APIs/fuentes de datos necesarias, costos, términos de uso
   Consolida en `docs/investigacion-producto.md` (con fuentes).
2. **PRD** (delega al agente `product-manager`): `docs/prd.md` — visión, problema, usuarios, hipótesis de valor, monetización, métricas de éxito, scope v1 mínimo + backlog futuro.
3. **FRDs** (mismo agente): `docs/frds/frd-NN-<nombre>.md`, uno por funcionalidad de v1, con criterios de aceptación EARS testeables y casos límite.
4. **Auto-revisión cruzada**: ¿cada FRD trazable al PRD? ¿v1 realmente mínima (DR-012)? ¿algún criterio no verificable por máquina? Corrige antes de presentar.
5. **Actualiza** `docs/estado.yaml` → `fase: diseno` y presenta a Sergio el resumen: hipótesis de valor, lista de FRDs de v1 (1 línea c/u) y qué quedó fuera. Siguiente paso: `/pandacorp:design`.

## Reglas
- Si la investigación contradice la idea original (dolor inexistente, competencia imbatible), DILO y recomienda matar o pivotar — no escribas un PRD de compromiso.
- Documentos en español, identificadores en inglés.
