---
title: "Estándares y reglas"
group: concepts
order: 4
---

# Estándares y reglas

La fábrica opera con dos capas de normas que se complementan: los **estándares** de ingeniería (el cómo técnico) y el **registro de decisiones** (las reglas de negocio recurrentes).

## Estándares de ingeniería

Los estándares viven en `factory/standards/` y son obligatorios en todos los proyectos. Cubren:

- **Convenciones** (`conventions.md`) — nomenclatura, idioma de los artefactos, commits.
- **Estructura** (`structure.md`) — organización de carpetas, capas de datos, co-localización de tests.
- **Patrones** (`patterns.md`) — Server Components por defecto, Server Actions, optimistic UI.
- **Calidad** (`quality.md`) — strict typing, linter, formatter, cero `any` ni `@ts-ignore`.
- **Stack** (`stack.md`) — tecnologías por defecto aprobadas por el propietario.
- **Seguridad** (`web-security.md`) — OWASP Top 10, sin auth casera, secretos en env.
- **Orquestación del build** (`build-orchestration.md`) — estados de WO, gate por FRD, freeze-on-red.
- **Documentación** (`documentation.md`) — dos capas (doc canónica + decision log), feature-centric.

Los estándares son versionados con la fábrica. Cambian solo por decisión explícita del propietario.

## Trabajar varias cosas a la vez (DR-096)

Cuando abres **varias conversaciones en paralelo** para avanzar cosas distintas al mismo tiempo (a mano, fuera de `/implement`), cada sesión **se aísla sola** en su propio árbol de trabajo de git (un *worktree*). El motivo: el gate de calidad es de programa completo —`tsc`, `knip` y las pruebas visuales leen *todo* el árbol—, así que el trabajo a medias de una sesión haría fallar el gate de otra. Aislando, el gate de cada sesión solo ve su propio trabajo.

Es transparente: tú hablas normal y dices "ejecuta"; el agente crea el worktree, trabaja, y cuando todo está verde lo **fusiona solo a la rama principal** a través de una cola serializada (un merge a la vez). Solo te enteras si hay un conflicto que no se puede resolver automáticamente. Un fallo del gate en ficheros que tu sesión no tocó es de **otra sesión**: se reporta, nunca se arregla ni se enmascara. Esto es distinto de `/implement`, que ya evita colisiones por construcción y no usa worktrees. El detalle vive en `build-orchestration.md` ("Parallel manual sessions").

## El registro de decisiones

`factory/decisions/registry.yaml` contiene reglas con un **valor por defecto** para decisiones recurrentes. Ejemplos:

- `DR-001` — Añadir una dependencia → solo librerías aprobadas.
- `DR-009` — Idioma de artefactos → committed = inglés, gitignoreado = español.
- `DR-032` — Avance entre fases → siempre explícito, nunca automático.
- `DR-046` — Catalogs de Referencia → derivados de la fuente canónica, nunca copiados a mano.
- `DR-047` — Memoria transversal → cosecha, corrobora antes de confiar, gate humano.
- `DR-049` — Estructura de docs → feature-centric por FRD, no por tipo.
- `DR-050` — Gate de revisión → por FRD completo, no por WO individual.

Cuando un agente encuentra una situación no cubierta por el registro, escala al propietario **una sola vez** y codifica la respuesta como nueva regla.

## Cómo se aplican

Los agentes consultan el registro antes de tomar decisiones recurrentes. Mission Control muestra los estándares y las reglas en la sección **Referencia** del Manual y en la pestaña **Configuración** del proyecto.

## Promover una lección a estándar o regla

El flujo de autoaprendizaje (DR-047) captura lecciones candidatas en el inbox. Solo el propietario puede promover una lección a:

1. Un nuevo estándar en `factory/standards/`.
2. Una nueva regla en `factory/decisions/registry.yaml`.
3. Una nueva habilidad en el plugin.

La habilidad `/pandacorp:learn` (skill `learn`) facilita la promoción con el propietario como gate final.
