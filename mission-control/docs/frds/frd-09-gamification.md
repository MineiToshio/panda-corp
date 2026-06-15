# FRD-09 — Gamificación (tema RPG)

La capa de juego que envuelve el trabajo real, de forma **honesta** y sin fatiga. Principio rector: representar trabajo real con ropa más interesante; la fábrica **es** una campaña y los agentes **son** un party.

## Vocabulario: Gremio (guild) vs Party — no confundir

Dos capas RPG **distintas y deliberadas**; cada término nombra una sola cosa:

- **Gremio (guild)** — la capa **meta**: el operador (el dueño) + la fábrica entera. Nivel/XP del gremio en la barra superior ("Maestro del gremio"), Salón del gremio (trofeos y stats), Códice/Manual del gremio, Comandos del gremio, Atributos del gremio. Es **persistente y transversal** a toda la app.
- **Party** — el **grupo de agentes construyendo un proyecto concreto** (el panel RPG en vivo, [FRD-06](frd-06-party.md)). Hay **una party por proyecto** en construcción.

Analogía: perteneces a un **gremio** (la organización) y sales en **party** (el grupo activo de cada misión); un gremio tiene muchas parties. **Regla:** no usar "gremio" para nombrar el panel de agentes, ni "party" para la capa del operador.

## Criterios de aceptación (EARS)
- LA barra superior DEBERÁ mostrar el **nivel y XP del gremio** (operador), con título y barra al siguiente nivel.
- EL vocabulario y los acentos visuales DEBERÁN tener sabor RPG con **mesura** (misiones, objetivos, party, gremio; toques pixel), **sin sacrificar la legibilidad** de los datos.
- LA gamificación DEBERÁ representar **trabajo real**: el XP se gana por **resultado** (work order/fase/release cerrados), **no** por volumen de tareas triviales ni por abrir la app.
- LA celebración DEBERÁ **escalar**: toast pequeño (work order) → animación media (fase) → celebración (release) → momento de **subir de nivel**. Nunca celebración plana en cada acción.
- EL sistema NO DEBERÁ incluir: **leaderboards**, **vidas/muerte**, **rachas diarias con reset**, ni **urgencia falsa/timers**. Las rachas DEBERÁN ser **semanales** (con "freeze").
- LA gamificación DEBERÁ complementar buena UX, no compensar mala UX (los datos claros van primero).

## Principios validados por investigación (2026, ver `docs/propuestas/06-plan-de-mejoras-2026.md`)
- DEBERÁ vivir en el **"White Hat" del Octalysis** (Significado Épico, Logro/Progreso, Empoderamiento + Feedback): el mayor activo intrínseco es **ver a los agentes trabajar en vivo**; el XP es capa secundaria de confirmación, no el gancho principal.
- EL XP por actividad (no por resultado) está **prohibido** para no disparar el *overjustification effect* (la recompensa extrínseca puede destruir la motivación intrínseca). Todo logro mapea a un resultado **verificable** (work order/fase/release cerrados, tests verdes).
- TODA mecánica nueva DEBERÁ pasar el **test ético** antes de añadirse: ¿el usuario controla su participación? ¿construye o socava la motivación intrínseca? ¿la recompensa es significativa o un loop adictivo? ¿es honesta sobre su efecto psicológico? Patrones prohibidos: streak anxiety, recompensas variables tipo tragaperras, urgencia falsa, leaderboards, barra "clavada al 80%".

## Componentes (ver también)
- Nivel/XP del gremio (esta FRD) · Niveles de agentes ([FRD-07](frd-07-configuracion.md)) · Salón de logros y stats ([FRD-10](frd-10-salon-de-logros.md)) · Party RPG ([FRD-06](frd-06-party.md)).

## Futuro
Momento full-screen al subir de nivel; transiciones de fase como "cutscene"; meta-logros (Sellos con título displayable); multiplicador de XP por racha semanal.
