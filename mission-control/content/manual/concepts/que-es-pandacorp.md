---
title: "Qué es Pandacorp"
group: concepts
order: 1
---

# Qué es Pandacorp

Pandacorp es una **fábrica de software 100 % IA**: un sistema que convierte ideas en productos de software funcionales sin intervención humana en la construcción. El propietario aporta la visión, las decisiones clave y el criterio de negocio; los agentes de IA hacen el resto.

## La misión

Construir un portfolio de soluciones tecnológicas —apps web/móvil, herramientas CLI, automaciones, sistemas de prompts— que generen retorno económico u oportunidad, con el mínimo esfuerzo humano repetitivo.

## El modelo mental

```
Idea → Spec → Diseño → Blueprint → Construcción → Release
```

Cada fase produce artefactos versionados en el repositorio del proyecto. Las decisiones viven en ficheros, no en conversaciones. El propietario aprueba cada fase antes de avanzar.

## Qué hace la fábrica por ti

- **Explora** ideas contigo en conversación hasta que sean accionables.
- **Documenta** el PRD, los FRDs y los criterios de aceptación en EARS.
- **Diseña** la interfaz con un sistema de diseño coherente y tokens propios.
- **Planifica** la arquitectura técnica y la divide en work orders.
- **Construye** el código con TDD, revisión adversarial y CI verde.
- **Publica** con un plan de lanzamiento informado por métricas.
- **Aprende** de cada proyecto: lecciones reutilizables en `factory/memory/`.

## Qué hace el propietario

Solo interviene en las **puertas humanas**:

1. Elegir qué idea construir.
2. Aprobar el diseño visual.
3. Autorizar el release a producción.
4. Gastar dinero o conectar servicios externos.
5. Eliminar datos.
6. Comunicaciones externas.

Todo lo demás está automatizado o codificado en el registro de decisiones (`factory/decisions/registry.yaml`).

## Dónde vive la fábrica

La fábrica es el repositorio `panda-corp/`. Los proyectos viven en carpetas hermanas con su propio repo. Mission Control (este panel) es la interfaz de control de la fábrica, y vive dentro de `panda-corp/mission-control/`.

## Por qué "fábrica"

El nombre refleja la intención: un sistema **repeatable** que produce software de calidad consistente, igual que una fábrica produce bienes físicos con estándares de calidad. El know-how está en los procesos (estándares, decisiones, memoria), no en la cabeza de una persona.
