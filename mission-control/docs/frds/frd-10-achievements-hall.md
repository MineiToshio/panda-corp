# FRD-10 — Salón de logros

Página de logros que también son **stats que crecen**, con fecha y proyecto en cada uno. (Hoy con datos de ejemplo en el prototipo; al construir Mission Control real, las stats se calculan leyendo la fábrica y los proyectos.)

## Criterios de aceptación (EARS)
- DEBERÁ mostrar un **panel de estadísticas** (contadores que solo crecen): productos lanzados, ideas capturadas, work orders, fases completadas, iteraciones, lanzamientos impecables, ideas descartadas, PRDs, ADRs, agentes coordinados, racha récord, récord idea→launch.
- DEBERÁ mostrar **cadenas acumulativas** que suben de tier (**Bronce → Plata → Oro → Platino → Leyenda**) cuando la stat asociada cruza cada umbral, con una **barra de progreso al siguiente tier** y el nombre del próximo tier.
- CADA tier desbloqueado DEBERÁ guardar y mostrar **fecha** y **proyecto** donde ocurrió.
- DEBERÁ mostrar una sección **"Casi ahí"** con las cadenas más cercanas a su siguiente tier (efecto Zeigarnik).
- DEBERÁ mostrar **logros únicos** (una sola vez) agrupados por categoría (**Descubrimiento, Velocidad, Calidad, Consistencia, Maestría**), con fecha + proyecto cuando estén desbloqueados, y la condición cuando estén bloqueados.
- DEBERÁ incluir **logros secretos** mostrados como silueta + **pista críptica** hasta desbloquearse; AL desbloquearse, DEBERÁ **revelar su criterio** (qué lo activó), nunca quedar como mecánica oscura tipo loot-box.
- LAS cadenas y barras de progreso DEBERÁN aplicar **endowed progress honesto**: arrancar mostrando el avance **ya logrado** (no en cero) — acelera la finalización (efecto Zeigarnik) y es honesto porque corresponde a trabajo real. Sin notificaciones ni recordatorios machacones.
- LOS nombres DEBERÁN ser divertidos y escalar en grandiosidad por tier (p. ej. Productos lanzados: El primer ladrillo → Maestro de obras → El arquitecto → El magnate digital → El oráculo de la fábrica).

## Detalle
Lista completa de stats, umbrales, nombres por tier y logros únicos en [mission-control/docs/logros.md](../logros.md).

## Futuro
Meta-logros (Sellos con título displayable), badge "Nuevo" 7 días tras desbloquear, rareza estimada (Común→Legendario).
