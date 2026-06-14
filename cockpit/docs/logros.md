# Logros y stats de Pandacorp

Diseño del Salón de logros. Cada logro guarda **fecha** y **proyecto** donde ocurrió. Implementado (seed) en el prototipo; al construir el cockpit real, las stats se calculan leyendo la fábrica y los proyectos.

## Stats (contadores que crecen — "character sheet")
Productos lanzados · Ideas capturadas · Work orders completados · Fases completadas · Iteraciones desplegadas · Lanzamientos impecables (cero rechazos) · Ideas descartadas · PRDs escritos · ADRs registrados · Agentes coordinados · Racha récord (semanas) · Récord idea→launch (días).

## Cadenas acumulativas (suben de tier: Bronce → Plata → Oro → Platino → Leyenda)
Cada una rastrea una stat; al cruzar el umbral se desbloquea el tier (con fecha + proyecto). Umbrales:

| Cadena | Stat | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| Productos lanzados | lanzados | 1 | 5 | 10 | 25 | 50 |
| Ideas capturadas | ideas | 5 | 20 | 50 | 100 | — |
| Work orders | workorders | 10 | 50 | 200 | 500 | 1000 |
| Fases completadas | fases | 5 | 25 | 75 | 200 | — |
| Iteraciones | iteraciones | 1 | 10 | 25 | 50 | — |
| Lanzamientos impecables | impecables | 1 | 3 | 7 | 15 | — |
| Ideas descartadas | descartadas | 5 | 20 | 50 | 100 | — |
| PRDs escritos | prds | 3 | 10 | 25 | 50 | — |
| ADRs registrados | adrs | 3 | 15 | 40 | 100 | — |
| Agentes coordinados | agentes | 3 | 6 | 10 | 15 | — |
| Racha récord (sem) | racha | 2 | 8 | 26 | 52 | — |
| Récord idea→launch (días, menor=mejor) | velocidad | ≤30 | ≤14 | ≤7 | ≤3 | — |

Nombres por tier (escalan en grandiosidad), ej. Productos lanzados: El primer ladrillo → Maestro de obras → El arquitecto → El magnate digital → El oráculo de la fábrica. (Lista completa de nombres en el código del prototipo.)

## Logros únicos (una sola vez, con fecha + proyecto)
- **Descubrimiento**: El día del lanzamiento · El primer spec · El debut del diseñador · El blueprintero · Iteración cero · El gran tour (las 6 fases).
- **Velocidad**: 48 horas de locura · Ship it Friday · La maratón (20+ WO seguidos).
- **Calidad**: Primer intento (cero rechazos en todas las fases) · El perfeccionista práctico (3 seguidos sin rechazo en diseño).
- **Consistencia**: El fundador madrugador (WO antes de 8am) · El último en apagar (WO tras medianoche).
- **Maestría**: La trilogía (3 productos vivos a la vez) · Coleccionista de estados (un producto por todos los estados).
- **Secretos** (ocultos con pista críptica hasta desbloquear): "ves el vacío al otro lado" (base de ideas sin nada activo) · "el código revisó al código" (un agente auto-corrige a otro) · "va más rápido de lo esperado" (pipeline completo en un día).

## UX
Character sheet de stats + sección "Casi ahí" (top 3 cadenas por % al siguiente tier, efecto Zeigarnik) + cadenas con barra al siguiente tier y pips de tier + únicos por categoría. Futuro: meta-logros (Sellos con título), "Nuevo" 7 días tras desbloquear, rareza estimada.

Investigación: [docs/investigacion/08-gamificacion.md](../../docs/investigacion/08-gamificacion.md) y fuentes ahí.
