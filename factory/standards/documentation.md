# Documentación viva — doc canónico + bitácora

Cómo se documenta un proyecto Pandacorp para que la documentación **nunca mienta** y **nunca se pierda el porqué**. Aplica a TODO proyecto, en toda fase (en construcción y lanzado).

## Regla

Todo cambio relevante —comportamiento de la app, alcance, arquitectura, diseño— se documenta en **dos capas, siempre**:

1. **Doc canónico (la verdad actual) — `MUST`.** Se actualiza el documento *dueño* del hecho para que describa la realidad de ahora, como si siempre hubiera sido así:

   | Cambio | Doc dueño |
   |---|---|
   | Comportamiento/feature de la app (qué hace, criterios EARS) | el **FRD** correspondiente en `docs/frds/`; feature nueva → FRD nuevo |
   | Alcance/objetivo de producto, métricas de éxito | el **PRD** (`docs/prd.md`) |
   | Arquitectura, stack, modelo de datos, decisión técnica | el **blueprint** (`docs/blueprint.md`) + un **ADR** en `docs/adr/` |
   | Diseño visual, tokens, componentes | **`DESIGN.md`** / `docs/diseno/design-tokens.json` |
   | Estado de avance (qué está hecho) | `docs/estado.yaml` — lo escriben skills/CI, **no a mano** |

2. **Bitácora (la historia) — `MUST`.** Se añade una entrada en `docs/bitacora.md`: fecha, *qué*, *por qué*, y un enlace al doc canónico que se tocó (campo *Impacto*). Lo más reciente arriba.

El doc canónico responde *"¿qué es verdad ahora?"*; la bitácora, *"¿cómo llegamos aquí y por qué?"*. Solo el doc pierde el porqué; solo la bitácora deja el doc desactualizado. Por eso van **los dos**.

**No anotar** cambios triviales ya evidentes en el commit (renombrar variable, formato). **Sí anotar** toda decisión o cambio de comportamiento, alcance, técnico o de diseño.

### Bitácora vs. otros docs (no confundir)
- **`docs/bitacora.md`** = historia durable de decisiones/cambios de TODO el ciclo (incluido post-lanzamiento). El porqué detrás del estado actual.
- **`docs/iteracion.md`** = memoria de trabajo de la iteración de una FASE manual —qué se probó, qué rechazó el dueño— para retomar a mitad de fase (DR-032). Transitoria; se cierra al avanzar de fase. Una decisión que sale de la iteración y queda firme se registra en la bitácora.
- **`fabrica/decisiones/registro.yaml`** (en la fábrica) = política (reglas recurrentes con default). No es historia.

## Cómo se verifica
- **Checklist (review) — `MUST`:** el `reviewer` rechaza un work order/PR que cambia comportamiento sin actualizar el FRD correspondiente **ni** añadir entrada en `docs/bitacora.md`.
- **Gate de fase:** al cerrar una fase manual o un `iterate`, el skill confirma que el doc canónico y la bitácora quedaron al día.
- **Automatizable (futuro):** check que falle si un FRD se modificó sin una entrada de bitácora de la misma fecha.

## Por qué
Sin esto, el porqué de las decisiones se diluye en commits y conversaciones perdidas, y los FRD/blueprint envejecen hasta mentir. La doble capa mantiene **la verdad** (doc canónico) y **la memoria** (bitácora) separadas y ambas al día — barato de escribir, carísimo de reconstruir si falta.
