# Propuesta B — Pipeline programático con Agent SDK + CI/CD

## Idea central

La fábrica es **software**: un orquestador propio (TypeScript o Python sobre el Claude Agent SDK) que ejecuta el pipeline idea→producto como código determinista, con cada etapa corriendo `claude` en headless con salidas estructuradas (JSON Schema validado), y GitHub Actions como columna vertebral de ejecución y gates.

El modelo propone; **el orquestador (código) decide y ejecuta**. Es la materialización más estricta del principio "el LLM nunca controla la progresión del workflow".

## Arquitectura

```
panda-corp/
├── orchestrator/                     # el corazón: código TS sobre @anthropic-ai/claude-agent-sdk
│   ├── pipeline.ts                   # máquina de estados: intake→research→spec→plan→build→review→release
│   ├── stages/*.ts                   # cada etapa: prompt + json-schema + validador + retry acotado
│   ├── policies/                     # registro de decisiones como código (auto-defaults, escalado)
│   └── audit/                        # log inmutable de cada decisión de agente
├── factory/ (constitucion, plantillas, portfolio)   # igual que en A
└── .github/workflows/               # CI de la propia fábrica

proyecto-x/  (repo GitHub propio, creado por el orquestador)
├── .github/workflows/quality.yml    # los 5 gates: lint+tipos / cobertura+mutation / SAST+secretos / review / e2e
├── docs/ (idea, investigacion, spec, plan, adr)
└── src/
```

**Flujo:**

1. `pnpm factory new "tracker de Funkos"` (o un issue de GitHub con label `idea`) dispara el pipeline.
2. Cada etapa corre `query()` del SDK con schema de salida; si la validación falla, reintenta con el error inyectado (máx. 3) y luego escala.
3. Go/No-Go: el orquestador calcula el scoring; si supera umbral y no implica gasto, sigue solo; si no, abre un issue de aprobación y espera (gate H1 asíncrono).
4. El orquestador crea el repo del proyecto vía API de GitHub desde la plantilla del stack, configura branch protection y secrets.
5. Implementación: jobs de GitHub Actions (o runners propios en Docker con `bypassPermissions` + sandbox) ejecutan sesiones headless por tarea; cada tarea = 1 PR; el CI es el gate, no el agente.
6. Release a producción: environment de GitHub con required reviewer = tú (gate H2 nativo de GitHub).

## Ventajas

- **Máximo determinismo y auditabilidad**: cada transición de fase es código testeable; el audit trail es completo por construcción.
- **Verdadera operación desatendida**: corre en CI/cloud sin tu máquina; los triggers son issues, webhooks, crons.
- Model-agnostic real: cambiar de modelo es cambiar un parámetro; los schemas y validadores no cambian.
- Los gates humanos usan mecanismos nativos de GitHub (environments, required reviewers) — imposibles de saltar por el agente.

## Desventajas / riesgos

- **Esfuerzo inicial alto**: estás construyendo un producto (el orquestador) antes de construir productos. Semanas, no días.
- Mantenimiento: el orquestador es código tuyo que envejece; el SDK evoluciona rápido.
- Costo: headless/SDK se factura como API (pool separado de la suscripción desde 2026-06-15) — el desarrollo iterativo del orquestador mismo consume crédito.
- Riesgo de sobre-ingeniería para un portfolio que aún no existe: optimiza un pipeline que todavía no has visto fallar.

## Cuándo elegirla

Cuando el volumen lo justifique: muchos productos en paralelo, necesidad de operación 24/7 sin intervención, o cuando la Propuesta A se quede corta en determinismo. **Camino natural: empezar con A y migrar a B las etapas que se vuelvan repetitivas y estables** (la A genera los prompts, checklists y plantillas que B luego congela en código).

## Esfuerzo estimado de arranque

| Fase | Trabajo | Tiempo aprox. |
|---|---|---|
| 1 | Máquina de estados + 3 etapas (intake/research/spec) con schemas | 1-2 semanas |
| 2 | Creación de repos + plantillas + CI de 5 gates | 1 semana |
| 3 | Loop de implementación con runners sandboxed | 1-2 semanas |
| 4 | Piloto + endurecimiento | 2+ semanas |
