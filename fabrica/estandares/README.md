# Estándares de Pandacorp

Estándares de ingeniería que la fábrica inyecta en cada proyecto (vía el `AGENTS.md`/`CLAUDE.md` del scaffold y los agentes del plugin). Derivados de cómo trabaja Sergio (proyecto de referencia: PandaTrack).

## Dos niveles (importante)

1. **Convenciones duraderas — OBLIGATORIAS e iguales en todos los proyectos**: estructura, naming, calidad, patrones, testing. Viven aquí y no se negocian por proyecto.
2. **Stack tecnológico — SUGERENCIA por defecto**: hay un stack recomendado ([stack.md](stack.md)), siempre en **últimas versiones estables**. NO es obligatorio: el agente `architect` lo **propone en el blueprint**, puede sugerir tecnologías mejores si encajan en el proyecto, y **Sergio lo aprueba** ahí (gate humano ligero, registrado como ADR).

## Índice

- [convenciones.md](convenciones.md) — idioma, naming, tipado, constantes, validación, imports, commits
- [estructura.md](estructura.md) — estructura de carpetas y capas (data layer, features)
- [patrones.md](patrones.md) — Server Components/Actions, UI optimista, HTML semántico, a11y, tema, design tokens
- [calidad.md](calidad.md) — gates de calidad, estrategia de testing, CI
- [stack.md](stack.md) — stack recomendado por defecto (sugerencia, se elige en el blueprint)
- [infra.md](infra.md) — operación local: Docker en dev, convención de puertos, worktrees, estado para el cockpit, gates como reglas duras

Las convenciones de estructura/patrones están escritas para el stack web por defecto (TypeScript/Next.js). Para otros stacks (p. ej. Python/scraping) se aplica el **espíritu** (capas separadas, data layer aislado, tests colocados, tipado estricto), adaptado al lenguaje.
