# Propuesta C — Adoptar frameworks existentes (Spec Kit + BMAD híbrido)

## Idea central

No construir ni configurar casi nada propio: adoptar **GitHub Spec Kit** como metodología de fases (Specify → Plan → Tasks → Implement) y tomar de **BMAD-METHOD** los roles de agentes ya escritos y probados por la comunidad (PM, Analista, Arquitecto, Scrum Master, Dev, QA). Pandacorp se limita a una capa fina de personalización: constitución, golden paths y registro de decisiones.

## Arquitectura

```
panda-corp/
├── fabrica/
│   ├── constitucion.md              # se inyecta vía /constitution de Spec Kit
│   ├── golden-paths.md              # los 4 stacks estándar
│   └── portfolio.md
└── docs/

proyecto-x/
├── .specify/                        # estructura de Spec Kit (specs, plans, tasks)
├── memory/constitution.md           # copiada de la fábrica
└── src/
```

**Flujo:** `specify init proyecto-x` → `/constitution` (carga estándares Pandacorp) → `/specify` (spec desde la idea) → `/plan` (stack y arquitectura) → `/tasks` → `/implement`, todo dentro de Claude Code, que es uno de los 30+ agentes soportados por Spec Kit. Los roles BMAD se usan en la fase de planificación (Analista→PM→Arquitecto generan PRD y arquitectura).

## Ventajas

- **Arranque casi inmediato**: instalas y empiezas el mismo día; miles de usuarios ya depuraron estos flujos.
- Mantenimiento delegado: GitHub y la comunidad BMAD evolucionan las plantillas por ti.
- Documentación y tutoriales abundantes; menos decisiones de diseño propias que tomar.
- Agnóstico de herramienta: Spec Kit funciona con Copilot, Gemini CLI, etc., además de Claude Code.

## Desventajas / riesgos

- **No están diseñados para tu objetivo central (autonomía)**: ambos asumen un humano revisando en cada frontera de fase. Reducir esos checkpoints exige pelear contra el grano del framework.
- Crítica documentada (Martin Fowler): Spec Kit genera markdown excesivo (8 archivos por feature mediana) y los agentes "frecuentemente ignoran las instrucciones" de los checklists; Kiro/BMAD tienden a sobre-ingeniería (un fix de 1 línea → 4 user stories).
- BMAD está pensado para equipos enterprise, no para un operador solo: 9 personas agénticas son demasiada ceremonia para un side-project.
- Sin pipeline de portfolio: estos frameworks gestionan **un** proyecto; la orquestación multi-proyecto (intake de ideas, scoring, routines) tendrías que añadirla igual.
- Dependencia de roadmaps ajenos; personalizar a fondo = fork = pierdes las actualizaciones.

## Cuándo elegirla

Si quieres validar la metodología spec-driven con esfuerzo cero antes de invertir en infraestructura propia, o como **fuente de inspiración**: la recomendación práctica es saquear sus plantillas (los prompts de roles de BMAD y las plantillas de spec/plan de Spec Kit son excelentes material de partida) e incorporarlas a la Propuesta A, en lugar de adoptarlos como sistema.

## Esfuerzo estimado de arranque

| Fase | Trabajo | Tiempo aprox. |
|---|---|---|
| 1 | Instalar Spec Kit, escribir constitución | 1 sesión |
| 2 | Adaptar plantillas BMAD de roles | 1-2 sesiones |
| 3 | Piloto con un proyecto | días |
| 4 | (Inevitable) añadir capa propia de portfolio y autonomía | abierto |
