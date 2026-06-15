# Propuesta — Interfaz / Mission Control de Pandacorp

> Generado 2026-06-13. Investigación en `docs/research/` (panorama de interfaces sobre Claude Code). El operador quiere ver estado, leer documentos y disparar acciones sin depender de la terminal pura.

## El problema en una frase

Los skills son buenos para **ejecutar**, pero no para **ver, leer y organizar**. Falta la capa visual. "Interfaz" son en realidad dos capacidades separables: (1) ver/leer/organizar y (2) disparar acciones desde botones.

## Las 5 alternativas

| # | Alternativa | Ver estado | Leer docs | Disparar pipeline | Esfuerzo | ¿Internet? |
|---|---|---|---|---|---|---|
| 1 | **App de escritorio de Claude Code** (rediseñada abr-2026) | Parcial (sesiones) | Sí (panel preview) | Solo por chat | Nulo | Sí |
| 2 | **Obsidian** + Bases + Shell Commands | Sí (kanban) | Sí (markdown render) | Botones "best-effort" | Bajo (horas) | No |
| 3 | **Dashboard web local propio** (lo construye la fábrica) | Sí (completo) | Sí | Sí + streaming en vivo | Medio (1-2 días) | No (opcional API key) |
| 4 | **GUIs de terceros** (Nimbalyst, Opcode, claude-code-cli-ui…) | Solo nivel sesión | No | Solo sesión | Nulo | Parcial |
| 5 | **GitHub Projects + Actions** (kanban en la nube) | Sí (issues) | Markdown crudo | Sí (al mover tarjeta) | Medio | Sí |

### Modo de uso, a alto nivel

1. **App de escritorio**: abres la app, ves una barra lateral con tus sesiones por proyecto, panel que renderiza HTML/PDF/markdown, visor de diffs. Quita la sensación de "terminal negra", pero los skills siguen escribiéndose en el chat — no hay botones. Ya la tienes con tu plan.

2. **Obsidian**: abres la carpeta como vault. Un tablero kanban vivo agrupa tus ideas por `estado` (arrastras tarjetas → cambia el archivo). Clicas una ficha y la lees formateada. Un par de botones en la nota disparan skills cortos (`/pandacorp:recommend`, `:sync-portfolio`). Límite: no ves el output en vivo y solo lee de una carpeta (los proyectos van por symlink).

3. **Dashboard web local**: abres `localhost:3000`. Tres paneles — kanban de ideas, tabla de portfolio (lee el `status.yaml` de cada proyecto), y una consola. Clicas "avanzar a spec" en una idea y se abre un panel que **transmite en vivo** lo que hace Claude mientras corre el skill; al terminar, la tarjeta se refresca sola. Es la única opción que entiende tu modelo de datos propio Y dispara con feedback en vivo. La fábrica se lo construye a sí misma (un work order + `/pandacorp:implement`).

4. **GUIs de terceros**: instalas y listo, pero todas miran la capa de sesiones de Claude Code (`~/.claude/`), no tu base de ideas ni tu portfolio. Sirven como monitor de sesiones, no como Mission Control de la fábrica.

5. **GitHub Projects**: subes el repo a GitHub, las ideas son issues con labels por estado, mueves una tarjeta en el tablero web/móvil y un GitHub Action dispara el skill y abre un PR. Bueno para móvil y durabilidad, pero crea **dos fuentes de verdad** (issues vs. frontmatter) y corre en la nube, no en tu máquina.

## Recomendación

**Enfoque en dos capas, por fases:**

### Ahora (hoy, cero código): Obsidian como Mission Control de lectura
Resuelve el 80% de tu molestia inmediata — ver el kanban, leer las fichas y documentos renderizados, arrastrar tarjetas — sin construir nada. Es tu "segunda pantalla" siempre abierta. Setup: instalar plugin Bases Kanban + abrir el vault.

### El dashboard web local ES el primer producto piloto de la fábrica
En vez de estrenar la fábrica con el Funko tracker, la estrenamos construyendo **tu propio Mission Control**. Razones:
1. Te da exactamente lo que pediste: ver + leer + **disparar con output en vivo**, consciente de tu modelo de datos (ideas, portfolio, estado de proyectos).
2. **Dogfooding**: validamos el pipeline completo (spec → diseño → blueprint → work orders → implement) construyendo algo que usarás todos los días. Si el proceso falla, lo descubres con una herramienta interna, no con un producto comercial.
3. Queda 100% bajo tu control y sin depender de internet.
4. Es un proyecto acotado y de baja exigencia de UX (tres paneles, sin diseño elaborado) — buen primer caso.

**Lo que descarto por ahora**: GitHub Projects (segunda fuente de verdad), GUIs de terceros (ciegas a tu modelo de datos), y la app de escritorio como Mission Control (no muestra tus datos, aunque ayuda a no ver terminal pura — úsala libremente en paralelo).

### Detalle técnico a recordar
El dashboard dispararía Claude vía `claude -p` / Agent SDK, que desde 2026-06-15 consume un pool de créditos separado de la suscripción. Mitigación: configurar `ANTHROPIC_API_KEY` en el entorno del subproceso para facturar a tarifa API en vez de agotar el pool fijo.

## Decisión para el dueño
¿El **dashboard web local** se vuelve el primer proyecto de la fábrica (desplazando al Funko tracker como piloto), mientras montamos Obsidian hoy como lectura inmediata?
