# Investigación: Gamificación para Pandacorp (2026-06)

> Para que el panel se sienta un RPG sin volverse gimmicky. Fuentes enlazadas al final.

## Principio rector
La gamificación que sobrevive en herramientas profesionales del día a día es **"trabajo real con ropa más interesante"** — representa progreso REAL, no inventa progreso falso ni impone ansiedad de juego sobre trabajo que ya tiene sus propias apuestas. En Pandacorp encaja natural: la fábrica **es** una campaña; los agentes completando work orders **son** un party completando una quest.

## Qué implementar (Tier 1, alto valor / baja fatiga)
1. **Quest log**: proyectos como misiones con objetivos (work orders) y fase en vocabulario de misión.
2. **Agentes pixel-art con 3 estados** (idle/trabajando/celebrando) en su "zona"; su presencia + animación responde "quién hace qué" sin tooltips.
3. **Barra de XP del operador** (nivel + título), con "+XP" flotante y un momento de subir de nivel.
4. **XP/niveles por agente** + títulos (Aprendiz → Ingeniero → Senior → Arquitecto) y marcas visuales al subir.
5. **Un logro temprano** (primera idea, primer work order) — el desbloqueo en la primera sesión es la palanca de retención #1.
6. **Gráfico de actividad** estilo GitHub por agente (ambiental, honesto).

## Tier 2
Salón de logros (trofeos), racha **semanal** (no diaria), transiciones de fase como "cutscene", multiplicador de XP por racha.

## Qué DESCARTAR
- **Leaderboards** (no hay con quién competir).
- **Vidas/muerte** (la ansiedad de Habitica, su queja #1).
- **Rachas diarias** (castigan horarios irregulares; el 25% de rachas se rompen el viernes). Usar semanales con "freeze".
- **Urgencia falsa / timers** (dark pattern; el trabajo ya tiene deadlines reales).
- XP por logins/abrir la app (premia presencia, no resultado).
- Diálogo RPG completo de los agentes (lindo 2 días, molesto después).

## Reglas de diseño
- **XP por resultado, no por volumen**: dividir un work order en 10 no da más XP (evita gaming de métrica proxy).
- **Curva S de la gamificación**: hay un punto óptimo; pasado ~3-4 features densas, MÁS features reduce engagement. Parar antes de que la interfaz necesite explicación.
- **Escalar la celebración**: toast chico (work order) → animación media (fase) → celebración completa (release) → momento full-screen (subir de nivel). Frecuencia plana = se entumece.
- **Logros**: desbloqueo temprano + dificultad progresiva (los difíciles retienen más); mostrar bloqueados como silueta con su condición.
- La gamificación **complementa** buena UX, no la compensa (lección de Linear).

## Aplicado a Mission Control (v1, 2026-06-13)
Implementado en el prototipo: Salón de logros (tab Logros, desbloqueados + bloqueados por categoría), nivel/XP del gremio en la barra superior, niveles+títulos por agente en Configuración, progreso reskineado como "Objetivos de la misión", y Party como mapa con zonas pixel-art donde los personajes deambulan por su sala y se juntan al comunicarse, con logro al cerrar work order.

Fuentes: [Habitica](https://trophy.so/blog/habitica-gamification-case-study) · [Duolingo](https://trophy.so/blog/duolingo-gamification-case-study) · [Todoist Karma](https://trophy.so/blog/todoist-gamification-case-study) · [GitHub](https://trophy.so/blog/github-gamification-case-study) · [Logros/retención](https://trophy.so/blog/achievements-feature-gamification-examples) · [Sistema de XP](https://trophy.so/blog/when-your-app-needs-xp-system) · [Curva S (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12554716/) · [Dark patterns](https://medium.com/@neil_62402/gamification-dark-patterns-light-patterns-and-psychology-9442d49f8b56) · [NPCs/colonos (RimWorld)](https://blog.rubenwardy.com/2022/07/17/game-ai-for-colonists/) · [Animación pixel art](https://www.sandromaglione.com/articles/pixel-art-character-animations-guide)
