# Plan de implementación — Pandacorp Cockpit (dashboard local, solo-lectura)

> Plan autocontenido para ejecutar con `/loop`. El dashboard es el primer proyecto de la fábrica Pandacorp: una herramienta LOCAL para que Sergio **vea** el estado de ideas y proyectos, **lea** los documentos, y **sepa qué comando ejecutar a continuación** — copiándolo con un botón y pegándolo en la app de Claude Code.
>
> **Principio rector:** el dashboard NUNCA llama a Claude. Solo lee archivos del repo y genera texto de comandos para copiar. Toda ejecución la hace Sergio pegando el comando en la app de Claude Code → usa su suscripción Claude Max. Sergio es débil en UX → la UI debe ser mínima y limpia.

## Objetivo (qué es "terminado")

Una app web local en `http://127.0.0.1:3000` con tres paneles sobre datos reales de la fábrica, y `.pandacorp/verify.sh` en verde. Criterios de aceptación globales:

- [ ] `bash .pandacorp/verify.sh` pasa (biome + tsc --noEmit + vitest run), sin errores ni warnings nuevos.
- [ ] Panel **Ideas**: kanban de las fichas de `fabrica/ideas/*.md` agrupadas por `estado`; cada tarjeta muestra título, score y tipo. **El tablero es de solo-lectura: las tarjetas NO se mueven a mano** — su columna refleja el `estado:` que escriben los skills al ejecutarse (new-idea→documentada, recommend→recomendada, scaffold→en-pipeline, release→lanzada). El cockpit reemplaza a Obsidian como visor.
- [ ] **Vista de detalle a página completa** (clic en una tarjeta): cabecera (título, tipo, score, estado), **resumen con puntos clave**, **navegador de los documentos** del proyecto (idea-origen.md, investigación, PRD, blueprint…) renderizados, y el comando del siguiente paso con botón Copiar.
- [ ] **Botón Descartar** en el detalle: única escritura manual del cockpit — reescribe `estado: descartada` en el .md (es una decisión humana, no un paso de construcción). Test de que no corrompe el YAML ni el cuerpo.
- [ ] Panel **Portfolio**: tabla de proyectos leída de `fabrica/portfolio.md` + el `docs/estado.yaml` de cada proyecto (fase, versión, resumen, fecha).
- [ ] **Siguiente paso + copiar**: cada idea y cada proyecto muestra el comando sugerido según su `estado`/`fase`, con botón "Copiar" y la indicación de en qué carpeta abrir la sesión de Claude Code.
- [ ] La app **no hace ninguna llamada a Claude** (no `claude -p`, no Agent SDK, no API key). Solo lee/escribe archivos locales.
- [ ] Se refresca sola (re-lee los archivos cada pocos segundos) para reflejar cambios tras ejecutar un comando.
- [ ] README con cómo correrlo. La app escucha SOLO en `127.0.0.1`. Sin auth, sin deploy.

## Stack (golden path A, recortado)

- Next.js 16 (App Router, Server Components leen el filesystem) + TypeScript `strict` + `noUncheckedIndexedAccess`
- Tailwind CSS + componentes propios mínimos (sin sistema de diseño elaborado)
- Biome (lint+format), Vitest (tests)
- Libs: `gray-matter` (frontmatter de ideas), `yaml` (estado.yaml), `react-markdown` (render de fichas)
- Sin base de datos (el repo de la fábrica ES la base de datos), sin auth, **sin SDK ni subprocesos de Claude**

## Configuración de rutas (constantes en `lib/config.ts`)

```
FACTORY_ROOT = "/Users/Shared/Proyectos/panda-corp"
IDEAS_DIR    = FACTORY_ROOT + "/fabrica/ideas"      (ignorar _plantilla-ficha.md)
PORTFOLIO    = FACTORY_ROOT + "/fabrica/portfolio.md"
PROJECTS     = filas del portfolio → cada ruta → docs/estado.yaml
```

## Lógica de "siguiente comando" (en `lib/next-step.ts`, con tests)

Mapea estado/fase → comando sugerido + carpeta donde abrir Claude Code:

| Etapa | Comando a copiar | Abrir Claude Code en |
|---|---|---|
| `descubierta` | `/pandacorp:spec <slug>` (handoff: crea el proyecto + documenta MVP) | la fábrica (panda-corp) |
| `documentada` | `/pandacorp:design` | la carpeta del proyecto |
| `diseño` | `/pandacorp:blueprint` (crea blueprint + work orders) | la carpeta del proyecto |
| `arquitectura` | `/pandacorp:implement` (arranca construcción, Agent Teams + Mission Control) | la carpeta del proyecto |
| `en-construcción` | `/pandacorp:release` | la carpeta del proyecto |
| `lanzada` | `/pandacorp:iterate` (agregar funcionalidad/cambio) | la carpeta del proyecto |

Etapas adicionales: `descartada` (decisión humana desde el cockpit) y, para cambios en cualquier momento, el botón **Iterar** (`/pandacorp:iterate`). `recommend` es una acción de consejo a demanda, no una etapa.

La UI muestra, junto al comando, la ruta de la carpeta (con su propio botón de copiar) para que Sergio sepa exactamente dónde pegarlo.

## Fases y tareas (el loop avanza la primera pendiente en cada iteración)

### Fase 0 — Scaffold
- [ ] `pnpm create next-app@latest .` (App Router, TS, Tailwind; ESLint NO — usaremos Biome).
- [ ] Instalar Biome, Vitest, gray-matter, yaml, react-markdown. tsconfig strict + noUncheckedIndexedAccess; `biome.json`.
- [ ] Crear `.pandacorp/verify.sh` (chmod +x):
  ```bash
  #!/bin/bash
  set -e
  pnpm biome check .
  pnpm tsc --noEmit
  pnpm vitest run --reporter=dot
  ```
- [ ] `CLAUDE.md` mínimo que incluya la palabra "Pandacorp" (activa los hooks de la fábrica) y describa el proyecto. `git init -b main`, commit inicial.

### Fase 1 — Capa de lectura (con tests primero)
- [ ] `lib/ideas.ts`: lee y parsea las fichas (título, estado, score, tipo, slug, cuerpo). Test con fixtures.
- [ ] `lib/portfolio.ts`: parsea la tabla del portfolio y lee el `estado.yaml` de cada proyecto; tolera rutas rotas (marca el proyecto, no rompe). Test.
- [ ] `lib/next-step.ts`: la tabla de arriba como función pura. Test de cada caso.

### Fase 2 — Panel Ideas (tablero solo-lectura) + detalle a página completa
- [ ] Kanban por `estado` (columnas en orden del pipeline + columna `descartada` al final, atenuada). Tarjeta = título + chip de tipo + score. SIN flechas ni drag: solo-lectura.
- [ ] Clic en tarjeta → **vista a página completa** (no drawer): cabecera + resumen con puntos clave + navegador de documentos (Resumen | idea-origen.md | investigación | PRD | …) que renderiza el .md elegido + bloque "Siguiente paso" (comando + carpeta con botón Copiar) + botón "Descartar idea" + "Volver al tablero".
- [ ] Leyenda breve: qué significan los tipos (monetizable/personal/ambas) y el score.
- [ ] Estados vacío / cargando / error.
- Nota: el prototipo navegable de referencia está en `prototype/index.html`.

### Fase 3 — Panel Portfolio
- [ ] Tabla: proyecto, fase, versión, resumen, última actualización; fila marcada si la ruta no existe.
- [ ] Por fila, bloque "Siguiente paso" (comando + carpeta, con botones Copiar).

### Fase 4 — Componente Copiar + auto-refresh
- [ ] Componente `CopyButton` reutilizable (usa la clipboard API; feedback "¡Copiado!").
- [ ] Auto-refresh: la página re-lee los datos cada ~5 s (o botón "Actualizar") para reflejar cambios tras ejecutar comandos.

### Fase 5 — Pulido y cierre
- [ ] README: requisitos, `pnpm dev`, que escucha en 127.0.0.1, y el flujo de uso (ver → copiar comando → pegar en la app de Claude Code).
- [ ] Pasada final: `.pandacorp/verify.sh` verde; arrancar `pnpm dev` y verificar los tres paneles con datos reales.

### Fase 6 — Mission Control (vista en vivo de agentes, solo-lectura)
> Parte del alcance inicial (se construye tras las fases 0-5, en la misma corrida del loop). Visualiza los Agent Teams mientras trabajan, sin llamar a Claude.
- [ ] El emisor de eventos YA viene en el plugin de la fábrica (`scripts/emit-event.sh` + hooks `TaskCreated/TaskCompleted/TeammateIdle/SubagentStop` → `~/.claude/dashboard-events.ndjson`). El cockpit solo CONSUME ese archivo, no lo crea.
- [ ] `lib/agents.ts`: lee `~/.claude/dashboard-events.ndjson` (eventos) y `~/.claude/tasks/<team>/` (estado de tareas); tolera ausencia de ambos (caso "no hay equipo activo"). Test.
- [ ] Panel **Mission Control**: lista de agentes activos con su estado y tarea actual, feed de mensajes/eventos entre ellos, y grafo simple de dependencias de tareas. Auto-refresh (tail) cada ~2 s.
- [ ] Solo observación: NO intenta enviar mensajes ni pausar agentes (eso se hace en la terminal). Dejar nota en la UI: "para redirigir un agente, usa la app de Claude Code".

### Stretch (solo si lo anterior está verde)
- [ ] Búsqueda/filtro de ideas por texto, tipo o score.

## Restricciones (guardrails para el loop)

1. **El dashboard NUNCA llama a Claude**: nada de `claude -p`, Agent SDK, ni API key. Solo lee/escribe archivos locales. Toda ejecución la hace Sergio pegando comandos en la app de Claude Code (su suscripción Max).
2. **Local only**: escucha en `127.0.0.1`. NUNCA deployar ni exponer a la red.
3. **No tocar datos de la fábrica** salvo el frontmatter `estado:` del stretch. Lectura, no escritura (excepto ese caso).
4. **TDD** en `lib/` (lectura y next-step).
5. **Conventional commits** en inglés, feature branches; no push a main (el hook lo bloquea).
6. **UI mínima**: tres paneles, sin animaciones ni features especulativas. Tailwind plano.
7. **Terminar cuando** todos los criterios de aceptación globales estén marcados. No seguir agregando features.

## Notas
- Si una decisión no está cubierta aquí, aplicar el registro de decisiones de la fábrica (`../panda-corp/fabrica/decisiones/registro.yaml`); si tampoco, parar y preguntar a Sergio.
- El `estado.yaml` de proyectos puede no existir aún (por ahora solo está la fábrica + este cockpit): manejar el caso vacío con gracia.
