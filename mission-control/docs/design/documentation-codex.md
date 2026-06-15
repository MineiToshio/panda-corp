# Códice del gremio — IA de la documentación de Mission Control

**Decisión de diseño · 2026-06-15.** Fusión de las pestañas *Documentación* + *Configuración* en una sola: **Manual** (hero "Códice del gremio"). Basada en investigación (deep-research) con verificación adversarial.

## Por qué

1. **"Configuración" no configura nada.** Mission Control es solo-lectura por diseño; sus catálogos (Comandos, Agentes, Reglas, Estándares) no son ajustes, son **referencia de cómo funciona y qué se puede hacer** — misma naturaleza que Documentación. La etiqueta prometía algo falso.
2. **Tener dos pestañas para "leer sobre el sistema"** + un sidebar plano que mezclaba narrativa y catálogos = confuso. Un developer entraba y no entendía qué es, para qué sirve, ni cómo usarlo.

## El marco: Diátaxis (estándar de la industria)

Toda buena doc (Next.js, Stripe, Django…) separa **4 tipos, una página = un trabajo**. Mezclar tipos es el anti-patrón #1 ([diataxis.fr](https://diataxis.fr/), [NN/g – Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), verificado 3-0).

| Tipo Diátaxis | Grupo en el Manual | Contenido |
|---|---|---|
| Tutorial | **Empezar aquí** | Landing de valor (default) + "Tu primera misión" (tour guiado) |
| How-to | **Guías** | 7 tareas, una meta cada una (capturar, handoff, modo, feedback, probar, traspaso, plugin) |
| Reference | **Referencia** | Los catálogos de la ex-Configuración: Comandos, Agentes, Reglas, Estándares (con fichas) |
| Explanation | **Conceptos** | El porqué y la profundidad técnica (modelo, pipeline, construcción, estado, hooks, Mission Control, stacks, plugin) |

Orden del nav: **Empezar aquí → Guías → Referencia → Conceptos** (aprender haciendo primero; el porqué al final).

## Principios aplicados (con respaldo)

- **Acción antes que explicación**: el default es la landing de valor; la 2ª página ya pone a correr algo (no abre con "cómo funciona"). El error de ingeniero es lo contrario.
- **Progressive disclosure, NO separar por audiencia.** El research **refutó** (0-3) partir por rol (producto vs dev); en su lugar, cada página arranca simple y revela profundidad técnica abajo/enlazada. Sirve al PM y al dev en la misma página.
- **Diagramas que acompañan la prosa, nunca la reemplazan** (verificado 3-0). Se conservan pipeline/equipo/arquitectura con texto al lado.
- **DRY**: el dato vive en UN lugar. "El equipo" (narrativa) se fundió en *Agentes* (Referencia); "Estándares y reglas" en sus catálogos.
- **Landing de problema/valor, no lista de features.**

## Adaptación clave (caso solo-lectura)

Los ejemplos top (Stripe/Firebase) son productos interactivos. Pandacorp es **solo-lectura** — no "integras", *operas pegando comandos en Claude Code*. Por eso "Tu primera misión" es un **tour guiado/observación** (pegas 2-3 comandos reales) cuya *primera victoria* es **ver al party trabajando en Mission Control**, no una "primera API call".

## Implementación (prototipo)

`mission-control/prototype/index.html`: `MANUALNAV` (4 grupos) → `manualView()` / `manualContent()`; las páginas de contenido nuevas (`manualLanding`, `manualQuickstart`, `manualGuide`); la Referencia reusa `refSection()` (extraído de `configView`) + las fichas existentes (`configDetail`); los Conceptos reusan `docPage()`. Top-nav: 5 → 4 tabs. Cross-links (`gotoagent`/`gotoskill`) re-ruteados a `manual`.

**Pendiente / futuro**: si algún día hay ajustes reales (ej. toggle claro/oscuro), eso es un **icono ⚙️ en el topbar**, no una pestaña — "ajustar la app" ≠ "leer cómo funciona". Las guías escritas aquí deberían migrar al FRD-08 cuando se formalice.

**Fuentes núcleo**: [Diátaxis](https://diataxis.fr/) · [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) · [GitBook docs structure](https://gitbook.com/docs/guides/docs-best-practices/documentation-structure-tips). Caveat: la parte de landing/onboarding se apoya en fuentes de práctica (sin datos A/B).
