# Investigación: Calidad y safeguards para desarrollo autónomo (2025-2026)

> Informe de referencia. Generado 2026-06-12.

## 1. Los 5 gates de calidad (todo PR de IA debe pasarlos)

1. **Análisis estático** (cada commit, tolerancia cero): lint (ESLint/Biome, Ruff), formato (Prettier/Black), tipos (TypeScript strict, mypy --strict). El 94% de los errores de compilación de código LLM son fallos de tipos — el sistema de tipos es la primera capa de detección.
2. **Cobertura + mutation testing** (por PR): ≥80% en líneas cambiadas (no promedio del repo). Mutation testing (Stryker para TS, MutPy para Python) en rutas críticas — la única señal fiable de que los asserts detectan defectos reales. Property-based testing (Hypothesis, fast-check) para lógica core.
3. **Escaneo de seguridad** (cero hallazgos high): SAST (Semgrep, CodeQL, SonarQube), dependencias (Snyk, Socket.dev, Dependabot), secretos (Gitleaks, TruffleHog — pre-commit Y CI, porque los agentes a veces saltan pre-commit).
4. **Revisión de código**: agentes revisores como primera pasada (panel multi-lente), humano para PRs de impacto arquitectónico. Mitigar sesgo LLM-as-judge: rúbricas predefinidas + combinar con señales deterministas (tests, mutation score).
5. **Integración post-merge**: suite de integración en staging antes de producción; monitoreo sintético; gate de regresión de performance.

## 2. TDD como gobernanza (patrón clave)

- **RED**: el agente genera tests que fallan, alineados con los criterios de aceptación del spec.
- **GREEN**: implementación mínima; máximo 3 intentos de reparación por subtarea antes de escalar.
- **REFACTOR**: solo cuando todo pasa.
- **Regla de orquestación**: el orquestador/CI (no el LLM) tiene autoridad exclusiva sobre la progresión del workflow. El modelo propone; el sistema valida y decide. El modelo no puede marcar sus propios checkboxes.

## 3. Specs verificables por máquina: notación EARS

| Patrón | Plantilla |
|---|---|
| Ubicuo | EL sistema DEBERÁ [comportamiento] |
| Por evento | CUANDO [trigger] EL sistema DEBERÁ [respuesta] |
| Por estado | MIENTRAS [estado] EL sistema DEBERÁ [comportamiento] |
| Comportamiento no deseado | SI [condición] ENTONCES EL sistema DEBERÁ [respuesta] |
| Feature opcional | DONDE [feature activa] EL sistema DEBERÁ [comportamiento] |

Cada enunciado EARS se convierte en un test ejecutable (BDD: Given/When/Then, Playwright). Regla de lint: un cambio de spec sin cambio de test correspondiente falla el CI.

## 4. Clasificación de decisiones (minimizar al humano)

| Tier | Tipo de acción | ¿Humano? |
|---|---|---|
| 1 | Solo lectura / análisis | No (solo log) |
| 2 | Cambios internos reversibles | No (log + revisión async) |
| 3 | Integraciones externas | Sí, asíncrono (cola de aprobación) |
| 4 | Irreversible / alto riesgo | Sí, síncrono (bloquea) |

**Las 5 categorías que SIEMPRE requieren humano síncrono**: (1) deploy a producción, (2) comunicaciones externas (emails, webhooks públicos), (3) transacciones financieras, (4) borrado de datos, (5) cambios de privilegios/accesos.

**Principio de enforcement**: la lógica de aprobación se aplica en la capa de ejecución (hooks, CI, branch protection), no se negocia con el modelo en runtime.

**Registro de decisiones (decision register)**: documento versionado que enumera tipos de decisión recurrentes con defaults pre-aprobados, p. ej.:

```yaml
- id: DR-001
  patron: "agregar dependencia npm/pip"
  default: "auto-aprobar si sin CVEs conocidos, mantenida en últimos 12 meses, licencia permisiva"
  requiere_humano: false
- id: DR-002
  patron: "migración de esquema de BD en producción"
  default: "bloquear; validar en staging + aprobación humana"
  requiere_humano: true
  timeout_horas: 24
```

Timeout vencido → escalar a kill-switch o segundo aprobador, **nunca auto-aprobar**.

## 5. Safeguards técnicos

- **Ramas protegidas**: los agentes solo comitean a feature branches; merge requiere CI verde. Restricción técnica, no guideline.
- **Conventional Commits** (commitlint) → changelog y versionado automáticos (semantic-release / release-please).
- **ADRs** en `docs/adr/` + **AgDRs** (Agent Decision Records: qué agente, qué modelo, qué trigger, Y-statement del trade-off) para trazabilidad de decisiones de agentes. [AgDR](https://github.com/me2resh/agent-decision-record)
- **Auditoría**: log inmutable por acción relevante (agente, modelo, prompt, herramientas, racional, timestamp).
- **Secretos**: nunca pasarlos al agente; inyección efímera por entorno; detección en pre-commit y CI; rotación al cerrar sesión.
- **Supply chain**: dependencias fijadas con lockfiles; bloquear instalación desde registries no aprobados; cuidado con paquetes alucinados por LLMs; fijar y versionar definiciones de MCP servers (defensa rug-pull).
- **OWASP Top 10 Agentic (ASI, dic 2025)**: goal hijack, tool misuse, abuso de identidad, supply chain agéntico, ejecución inesperada, envenenamiento de memoria, comunicación inter-agente insegura, fallos en cascada, explotación de confianza, agentes rogue. [OWASP](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/)

## 6. Robustez independiente del modelo

> "Un modelo débil con buena orquestación suele superar a un modelo fuerte con mala orquestación."

1. **Contratos de salida estructurada**: JSON/YAML validado con schema (Zod/Pydantic) antes de actuar; fallo de schema = retry.
2. **Descomposición atómica**: tareas verificables independientemente; una tarea pasa por sus criterios, no por auto-reporte.
3. **Loops de verificación incondicionales**: propone → verificador determinista → pasa/reintenta con contexto del fallo (máx. N) → escala.
4. **Reintentos acotados con firmas de fallo**: fallo idéntico repetido = terminar y escalar, no loopear.
5. **Checklists ejecutados por CI**, no por el modelo.
6. **Test de consistencia cross-modelo** (para rutas críticas): mismo spec por 2 modelos; divergencia de comportamiento = spec ambiguo, endurecer EARS.

## Stack mínimo de gobernanza

Spec EARS + constitución versionada → TDD-first con orquestador dueño de la progresión → lint+tipos+SAST+secretos por commit → cobertura y mutation por PR → identidad y credenciales efímeras por agente → audit trail → tiers de decisión con 5 categorías bloqueantes → conventional commits + ADR/AgDR → verificación determinista, nunca auto-afirmada.

Fuentes principales: [Quality gates](https://www.motomtech.com/blog-post/ai-generated-code-quality-gates/) · [TDD governance](https://arxiv.org/html/2604.26615v1) · [PBT con Claude](https://red.anthropic.com/2026/property-based-testing/) · [HITL escalation](https://www.digitalapplied.com/blog/human-in-the-loop-escalation-design-ai-agents-2026) · [Seguridad agentes](https://lushbinary.com/blog/ai-agent-security-autonomous-coding-production-guide/) · [LLM-as-judge](https://labelyourdata.com/articles/llm-as-a-judge) · [SAST 2026](https://www.ox.security/blog/static-application-security-sast-tools/)
