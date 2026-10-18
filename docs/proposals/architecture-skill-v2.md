# Arquitectura v2: preguntar primero, planificar una vez, revisar una vez

> Estado: **IMPLEMENTADO** en la rama `feat/architecture-decision-round` (plugin 9.130.0, overlay 8.101.0, DR-131).
> Fecha: 2026-10-17. Origen: pedido del owner tras la fase de arquitectura de funko-tracker.

## Qué pediste

"Te demoraste un montón y hubo muchos errores. Antes de generar toda la documentación, hazme una ronda de preguntas
con las decisiones técnicas: contexto, alternativas, la recomendada y por qué. Así decidimos una vez y no tengo que
andar diciendo cambia esto, cambia lo otro." Más: consolidar todo lo aprendido y mejorar el skill directamente.

## Qué salió mal en funko-tracker (con números)

| # | Problema | Costo observado |
|---|---|---|
| 1 | **Dos decisiones tomadas en silencio** dentro de la "aprobación del stack": guardar las imágenes en R2 y una consola web de operador para cargar el catálogo. Las revertiste después de escritos los documentos. | ADR-0012: FRD-06/07 reescritos y 10 work orders regeneradas. ADR-0013: el modelo de medios rehecho, ~20 work orders tocadas y una ronda delta de los 3 gates. Una pregunta cada una lo habría resuelto en minutos (y en OP Character Dex ya enlazábamos imágenes por proxy). |
| 2 | **Hueco de diseño descubierto a mitad de fase**: el chequeo DR-130 encontró 257 hallazgos, 69 estados del FDD sin dibujo en 6 FRDs con UI. | Una mini ronda de diseño de 5 lotes, 130 estados, ~11 h con cortes de API, sin estimación previa. |
| 3 | **Costuras entre FRDs descubiertas tarde**: cada autor de blueprint encontraba cosas que otro FRD debía proveer. | Un registro de "cross-issues" y un reconciliador improvisados (funcionaron, pero sin proceso). |
| 4 | **Los gates encontraron bloqueos reales**: dependencias faltantes, `cacheTag` dentro de `src/queries/` que falla fuera de Next, `pnpm install --prod` del worker ejecutando `prisma generate`, etiquetas de oleada viejas, una contradicción sobre dónde viven los medios exportados, una clave de copy equivocada. | Se cerraron con UNA pasada de arreglos y re-verificación determinista: ese patrón era bueno y ahora es la regla. |
| 5 | **Agentes sin terminal**: `architect`, `product-manager` y `copywriter` no tienen Bash: no podían correr node, validar JSON, doc-lint, ni `git rm`. | Dejaban archivos con "# OBSOLETE" y el lead corría cada chequeo a mano. Dos cortes por límite de API (se retomaron con SendMessage: funcionó). |
| 6 | **Ritmo**: auditorías extra, una revisión visual tuya y lotes en serie sin decir cuánto iban a tardar. | Tu "¿por qué llevan horas?". |
| 7 | **Detalles**: la etiqueta `latest` de npm apuntaba a una RC de Prisma; `@sentry/node` debía seguir el major de `@sentry/nextjs`; `server-only` planificado sin instalador y que rompe en workers/CLI; una regla copiada (`next/image` + `next/font`) chocaba con el contrato de fidelidad congelado; el worktree no se podía crear sin `origin/main`; tras el merge el checkout principal no tenía `node_modules` y el hook de Stop fallaba; `merge-queue.sh` se negó (exit 12) por rutas sin trackear del harness; el resumen en español quedó dentro del worktree; y pediste además subir a GitHub. | Cada uno, una iteración o un paso manual. |

En total: ~90 commits en dos días para 8 FRDs, 42 work orders y 102 criterios de aceptación.

## Qué cambia y qué problema evita

| Mejora | Evita |
|---|---|
| **Paso 0b, preflight de insumos**: corre `check-design-gate.mjs` y `check-fdd-coverage.mjs` antes de nada. Si el diseño no está listo, PARA, te dice cuántos estados faltan y cuánto tardaría (~5 min por estado más recaptura), con la alternativa barata (sacar esa UI del FRD). | #2: descubrir el hueco de diseño a mitad de fase. |
| **Paso 1, ronda de decisiones (DR-131)**: antes de escribir cualquier documento, un brief en español (`.pandacorp/comms/arquitectura-decisiones.md`) con cada decisión que te afecta: contexto, 2-3 alternativas con costo/mes, riesgo (incluido legal), esfuerzo y lo que operas tú, la recomendada y por qué, hechos verificados en vivo y precedentes de otros proyectos. Disparadores obligatorios: stack, hosting y costo, **imágenes de terceros (guardar, enlazar o proxy)**, **cómo entra y se cura el catálogo y si hace falta una web de administración**, fuentes externas y legal, cómputo de fondo e IA, auth y borrado, email, analytics, backups, precedentes. Una sola ronda de botones (máximo 4 por llamada, la recomendada primero); cada respuesta queda como ADR. | #1: decisiones silenciosas y reescrituras posteriores. |
| **Pipeline de planificación formal**: plataforma con las decisiones fijas → UN mapa cruzado de work orders → autores en paralelo con un brief común → UN registro de pedidos entre FRDs → UN reconciliador → 3 gates en paralelo → UNA pasada de arreglos → re-verificación determinista + adenda → sellos y flip. Revisiones delta sobre `git diff` para cambios posteriores. Plantillas del mapa y del brief incluidas en el skill. | #3 y #4: costuras tardías, rondas de gates sin fin. |
| **Scripts deterministas** (`skills/architecture/scripts/`): `waves.mjs` (oleadas, ciclos, ids desconocidos, solapamiento de artifacts con expansión de llaves), `ac-matrix.mjs` (cada AC vivo en exactamente una WO, copiado literal), `plan-consistency.mjs` (frontmatter = Build Plan = README, incluidas las etiquetas de oleada), `flip-active.mjs` (sella y pasa a ACTIVE solo con los 3 gates en PASS y los chequeos verdes; tiene `--dry-run`), `resolve-versions.mjs` (solo versiones estables, 7 días de cuarentena, peers y familias alineadas). Con test y fixtures (63 aserciones). | #4 y #7: el gate de readiness pasa a ser casi mecánico; nada de RCs ni majors desalineados. |
| **Realidad de los agentes** escrita en el skill: el lead corre todo chequeo y todo `git rm`; protocolo de lápidas `# OBSOLETE`; tras un corte se retoma con `SendMessage`, nunca se reinicia. | #5. |
| **Instalación**: el resolvedor de versiones, la tabla "Pinned versions" en `architecture.md`, el choque regla vs contrato de diseño se registra como excepción en un ADR, la advertencia de `server-only`. | #7. |
| **Worktree y cierre**: worktree desde HEAD local si no hay `origin`; el resumen se escribe en el checkout PRINCIPAL; `pnpm install --frozen-lockfile` en main tras el merge; push de main a GitHub si hay remoto; `.claude/worktrees/` en el `.gitignore` de los proyectos (y `upgrade` lo agrega a los existentes). | #7. |
| **Ritmo (Pareto)**: plan y duración al inicio, solo cuatro mensajes de hito (decisiones, plan listo, gates pasados, merge), estimación y alternativa barata antes de cualquier paso no anunciado de más de 30 min, nada de auditorías extra, tu revisión visual nunca bloquea, una sola pasada de arreglos. | #6. |
| **Plantilla de arquitectura**: secciones nuevas "Owner decisions", "Pinned versions", "Media & third-party content" y "Operations & admin tooling". | #1: esas decisiones ya no se pueden saltar. |
| **Manual de Mission Control** actualizado (página del pipeline y el flujo del skill). | Que el manual mienta sobre cómo corre la fase. |

**Prueba en el proyecto real (solo lectura):** los scripts sobre funko-tracker reproducen su plan (42 work orders,
oleadas W0 a W9, sin ciclos ni solapamientos, 102 ACs cada uno en una sola WO) y encuentran **tres restos que los
gates no vieron**: falta la fila de WO-06-004 en el README de FRD-06, la fila de WO-06-005 quedó fuera de la tabla
por una línea en blanco, y WO-05-005 dice W7 cuando sus dependencias la ponen en W8. Son arreglos de documentación
de funko-tracker; no los toqué (corresponde a ese proyecto, vía `/pandacorp:change`).

## Qué NO cambié y por qué

- **Herramientas de los agentes** (dar Bash a `architect`): es un cambio de capacidad que decides tú. Quedó como
  BL-0250; mientras tanto el protocolo del lead lo cubre.
- **`merge-queue.sh` y `worktree-bootstrap.sh`**: sus arreglos necesitan tests propios del overlay. Quedaron como
  BL-0248 (rutas sin trackear del harness cuentan como "ocupado"; decidir si `navigation-identity.json` se versiona o
  se ignora) y BL-0249 (lista worktrees ya borrados como activos). El `.gitignore` ya evita el caso de
  `.claude/worktrees/`.
- **`check-fdd-coverage.mjs` no lee `aria-roledescription`**: BL-0247 (un falso "no dibujado").
- **Ni el motor de build ni el skill de diseño**: el motor sigue leyendo el Build Plan y los mismos sellos; la mini
  ronda de diseño ya existe (camino DR-130), solo se invoca antes.
- **Ningún estándar nuevo**: la regla vive en el skill y en DR-131; no hay nada que inyectar en el código de los
  proyectos.
- **Benchmark de skill-creator**: no se corrió. Es un skill de proceso de varias horas con agentes y gates tuyos; un
  benchmark baseline-vs-skill no lo puede ejercitar. Las partes deterministas están probadas por los tests y por la
  corrida sobre funko-tracker.
- BL-0243 (`preflight-round.mjs`) ya existía: no lo dupliqué. BL-0244 (separar construcción de la app y producción
  de contenido) y BL-0245 (presupuesto de rondas de gates) quedan cerrados por este cambio.
