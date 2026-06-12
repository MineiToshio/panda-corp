# Elementos comunes a todas las propuestas

Estos elementos aplican sin importar qué propuesta (A, B o C) se elija. Son el "sistema operativo" de Pandacorp.

## 1. El pipeline: de idea a producto

La entrada puede ser una **funcionalidad** ("app para pedir desde la mesa de un restaurante") o un **problema** ("no sé qué Funkos de One Piece existen ni cuándo se anuncian"). El pipeline las normaliza igual:

```
1. INTAKE        /nueva-idea     → ficha de idea (problema, usuarios, hipótesis de valor)
2. INVESTIGACIÓN /investigar     → informe: mercado, competidores, fuentes de datos,
                                   APIs disponibles, viabilidad técnica y legal, con citas
3. GO/NO-GO      automático      → scoring con rúbrica; humano SOLO si el score es
                                   ambiguo o implica gastar dinero          ← GATE H1
4. SPEC          /spec           → PRD con criterios de aceptación EARS
5. ARQUITECTURA  /plan           → elección de golden path, ADRs, descomposición en tareas
6. SCAFFOLD      /scaffold       → crear el repo del proyecto desde plantilla determinista
7. IMPLEMENTACIÓN                → TDD (tests primero), agentes coder + reviewer en paralelo
8. VERIFICACIÓN                  → tests, e2e, SAST, revisión adversarial multi-lente
9. RELEASE                       → deploy a staging automático; producción     ← GATE H2
10. OPERACIÓN                    → routines: monitoreo, mejoras, backlog grooming
```

Cada fase produce un **artefacto versionado en el repo del proyecto** (no chat): `docs/idea.md`, `docs/investigacion.md`, `docs/spec.md`, `docs/plan.md`, `docs/adr/*.md`. La fase siguiente no arranca si el artefacto anterior no pasa su gate (validación automática por checklist/schema; humano solo en H1 y H2).

## 2. Decisiones humanas (mínimas, explícitas)

Solo dos gates humanos síncronos en el flujo normal:

- **H1 — Go/No-Go de la idea**: aprobar alcance y presupuesto. (Es decisión de producto: la IA no conoce tus prioridades.)
- **H2 — Deploy a producción / acciones externas**: producción, enviar comunicaciones a terceros, gastar dinero, borrar datos, cambiar accesos.

Todo lo demás se gobierna con el **registro de decisiones** (`fabrica/decisiones/registro.yaml`): tipos de decisión recurrentes con defaults pre-aprobados (ej: "agregar dependencia sin CVEs y mantenida → auto-aprobar"). Decisión fuera del registro → se escala una vez al humano y la respuesta se codifica como regla nueva, de modo que **cada intervención humana reduce las futuras**. Timeout vencido → escalar, nunca auto-aprobar.

## 3. Roles de agentes y modelos asignados

| Agente | Rol | Modelo | Esfuerzo |
|---|---|---|---|
| `coordinador` | Orquesta el pipeline, delega, nunca implementa | opus/fable | high |
| `investigador` | Búsqueda web, mercado, fuentes de datos, APIs | sonnet | medium |
| `product-manager` | Ficha de idea, PRD con criterios EARS | opus | high |
| `arquitecto` | Plan técnico, elección de stack, ADRs | opus/fable | high |
| `implementador` | Código con TDD; checklist de done explícito | sonnet | medium |
| `test-writer` | Tests desde criterios de aceptación (fase RED) | sonnet | medium |
| `revisor` | Revisión multi-lente (bugs/seguridad/perf) | opus (familia ≠ generador si es posible) | high |
| `auditor-seguridad` | SAST, secretos, dependencias, OWASP agentic | sonnet | medium |
| `documentador` | README, changelogs, docs de usuario | haiku/sonnet | low |
| `explorador` | Búsquedas read-only en codebases | haiku | low |

Regla de oro: las tareas de **juicio** (arquitectura, revisión, specs) usan el modelo más capaz; las tareas **mecánicas y verificables** (formato, docs, búsqueda) usan el más barato. Los prompts de cada agente incluyen checklist explícito de terminado para que funcionen igual con modelos más débiles.

## 4. Safeguards (no negociables)

- **Hooks**: `PreToolUse` bloquea `rm -rf`, force-push, push a main, lectura de `.env`; `Stop` impide declarar "terminado" sin tests verdes y lint limpio; `PostToolUse` autoformatea.
- **Permisos**: deny-list en `settings.json`; sandbox activado; autonomía total solo dentro de contenedor.
- **Git**: ramas protegidas, agentes solo en feature branches, CI verde obligatorio para merge, conventional commits con commitlint.
- **Verificación determinista**: el CI ejecuta el checklist, no el modelo. El modelo nunca marca sus propios checkboxes. Reintentos acotados (máx. 3 por subtarea) con escalado.
- **Trazabilidad**: ADRs + AgDRs (qué agente, qué modelo, qué trade-off) en `docs/adr/`; log de auditoría por proyecto.
- **Secretos**: jamás en el contexto del agente; inyección por entorno; Gitleaks en pre-commit y CI.
- **Dependencias**: lockfiles, sin instalar de registries no aprobados, escaneo de CVEs y typosquatting (los LLMs alucinan paquetes).

## 5. Stacks estándar (golden paths)

Definidos en detalle en [investigación 04](../investigacion/04-stacks-recomendados.md):

- **Stack A** · Web full-stack: Next.js + Drizzle + Postgres + Tailwind/shadcn + Better Auth → Vercel
- **Stack B** · API TypeScript: Hono + Drizzle + Zod → Railway/Fly
- **Stack C** · API Python: FastAPI + Pydantic + SQLAlchemy → Railway/Fly
- **Stack D** · Scraping/datos/notificaciones: Python + Playwright + ARQ/Redis + Postgres → Docker

El `arquitecto` elige entre estos 4 (combinables: el caso Funkos = D para recolectar + A para mostrar). Salirse del golden path requiere un ADR con justificación y es decisión escalable a humano la primera vez.

## 6. Separación fábrica / proyectos

```
/Users/Shared/Proyectos/
├── panda-corp/                  ← LA FÁBRICA (este repo): know-how, nunca código de producto
│   ├── CLAUDE.md                ← constitución de la empresa
│   ├── .claude/ (agents, skills, hooks, rules)
│   ├── fabrica/
│   │   ├── constitucion.md      ← principios y estándares innegociables
│   │   ├── decisiones/registro.yaml
│   │   ├── plantillas/          ← scaffolds por golden path + AGENTS.md template
│   │   └── portfolio.md         ← índice de productos y su estado en el pipeline
│   └── docs/ (investigacion, propuestas, adr)
│
├── funko-tracker/               ← PROYECTO (repo git propio)
│   ├── CLAUDE.md                ← generado por /scaffold desde plantillas de la fábrica
│   ├── docs/ (idea, investigacion, spec, plan, adr/)
│   └── src/ …
└── mesa-facil/                  ← otro proyecto
```

La fábrica es la fuente de verdad del **cómo** (proceso, estándares, plantillas) y mantiene el índice del **qué** (portfolio). Cada proyecto es autónomo y lleva su propia documentación de producto. El traspaso de know-how fábrica→proyecto varía según la propuesta elegida (plugin, scaffold con copia, o subcarpetas).
