---
description: Handoff + fase de producto de Pandacorp. Crea el proyecto de una idea (carpeta/repo) y genera investigación + PRD + FRDs del MVP. Se ejecuta DESDE la fábrica con el nombre de la idea. Es el paso descubierta → documentada.
---

# /pandacorp:spec

Toma la idea indicada en `$ARGUMENTS`, **crea su proyecto** (handoff) y documenta el MVP. Se ejecuta DESDE la fábrica (panda-corp) porque aún no existe la carpeta del proyecto — por eso lleva el nombre de la idea.

## Paso 0 — Handoff (crear el proyecto)

1. Lee la ficha `fabrica/ideas/<idea>.md`. Debe existir y NO estar `descartada`. **Si el proyecto YA existe** (la ficha tiene `proyecto:` con ruta): el handoff ya se hizo — **salta todo el Paso 0** (no re-scaffoldees) y ve directo al Paso 1 a **iterar** los documentos de producto.
2. Ejecuta el scaffold del proyecto (mismos pasos del skill `scaffold`): crea `<slug>/` **hermana de la raíz de la fábrica** (nunca dentro; usa `ruta_proyectos` de `fabrica/perfil.md` si está definida, por defecto el directorio padre de la fábrica), copia el overlay desde `${CLAUDE_PLUGIN_ROOT}/templates/shared/`, procesa los `.tpl`, crea la estructura `docs/` (frds, diseno/mockups, adr, work-orders, reviews, iteracion.md), copia la ficha a `docs/idea-origen.md`, inicializa git, crea repo privado con `gh` si está disponible (DR-010), y escribe los enlaces bidireccionales (ficha → `estado: documentada` + `proyecto:` con la ruta; fila en `fabrica/portfolio.md`).

> A partir de aquí trabajas DENTRO de la carpeta del proyecto. Los demás skills (`design`, `blueprint`, `implement`, `release`) se corren ahí y NO necesitan el nombre.

## Paso 1 — Producto (en el proyecto)

3. **Investigación profunda** (agentes `researcher` en paralelo): competidores y sus quejas, usuarios, funcionalidades table-stakes vs diferenciadoras, viabilidad (APIs/datos, costos, términos). Consolida en `docs/investigacion-producto.md` con fuentes. Esta es la investigación de PRODUCTO (a nivel de FRD): cuanto más completa, menos decisiones quedan para resolver en construcción.
4. **PRD** (agente `product-manager`): `docs/prd.md` — visión, problema, usuarios, hipótesis de valor, monetización, métricas, scope v1 mínimo + backlog.
5. **FRDs** (mismo agente): `docs/frds/frd-NN-<nombre>.md`, uno por funcionalidad de v1, criterios de aceptación EARS testeables.
6. Auto-revisión: cada FRD trazable al PRD; v1 realmente mínima (DR-012); criterios verificables por máquina.
7. **Iterar / reanudar (DR-032)**: si ya había PRD/FRDs, esto es una **iteración** — lee `docs/iteracion.md` (fase `producto`) y los docs existentes, refina con el feedback del dueño (**no** regeneres desde cero ni repitas lo ya descartado) y **apenda** una entrada por ronda (qué se probó, qué rechazó y por qué, qué queda abierto). Presenta al dueño: hipótesis de valor, FRDs de v1, qué quedó fuera.
8. **Gate de avance (DR-032)**: deja `avance_pendiente: true` en `docs/estado.yaml` y **espera el "ok, avanza"** del dueño — re-correr `spec` mientras tanto = seguir puliendo. **NO escribas `fase: diseno` antes.** Solo cuando apruebe: `docs/estado.yaml` → `fase: diseno` + `avance_pendiente: false`, y cierra el hilo `producto` en `docs/iteracion.md`. Siguiente paso: abrir Claude Code en la carpeta del proyecto y correr `/pandacorp:design`.

## Reglas
- Si la investigación contradice la idea (dolor inexistente, competencia imbatible), DILO y recomienda matar/pivotar antes de escribir el PRD.
- Documentos en español; identificadores en inglés.
