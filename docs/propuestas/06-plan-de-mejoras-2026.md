# Plan de mejoras de la fábrica — 2026

> Generado 2026-06-13 a partir de dos investigaciones web profundas con verificación adversarial
> (orquestación/calidad/SDK/docs + UI/UX/gamificación). 5 dimensiones, ~50 fuentes,
> claims verificados por voto 3-0 salvo donde se indica. Cada hallazgo se conecta con qué
> cambiar en Pandacorp (pipeline, hooks, agentes o cockpit).

## Tesis central

La calidad y la velocidad de una fábrica de software autónoma **no salen de "mejores prompts"**, sino de
**hacer determinista todo lo verificable y adversarial todo lo opinable**. Pandacorp ya está bien posicionada
(hooks deterministas, reviewer que re-verifica, gate `Stop`/`verify.sh`, equipos con contexto aislado, memoria
en archivos). Las mejoras son **incrementales y de alto ROI**, no un rediseño.

El hallazgo más accionable y mejor evidenciado: **un verificador construido solo con tests generados por IA
falla sistemáticamente** (20–40% de soluciones "verdes" en realidad erróneas) porque los errores de los LLM
se agrupan (sesgo sistemático compartido) mientras los humanos fallan de forma diversa. Hay que **reforzar la
verificación independiente del agente**, no confiar en que el agente "no haga trampa".

---

## Dimensión 1 — Orquestación de agentes y pipeline

| # | Hallazgo (evidencia) | Aplicación a Pandacorp |
|---|---|---|
| 1.1 | **Spec-driven development**: la spec como "fuente de verdad ejecutable" descompuesta en *chunks pequeños testeables en aislamiento* reduce errores en cascada. Spec Kit lo estructura en Specify/Plan/Tasks/Implement; las tasks son "small reviewable chunks… you can implement and test in isolation". [1][2] | El pipeline `spec→design→blueprint→work-orders→implement` **ya es SDD**; los criterios EARS son la spec ejecutable. **Mejora:** que el `reviewer` **rechace work orders demasiado grandes** y exija que cada WO sea testeable en aislamiento (regla nueva en `blueprint`/`work-orders`). |
| 1.2 | **Línea de ensamblaje con SOPs codificados** (PM→Architect→Engineer→Reviewer): que cada rol *verifique resultados intermedios* mitiga las "alucinaciones en cascada" del encadenamiento ingenuo de LLMs. MetaGPT (ICLR 2024 Oral). [3][4] | Ya existen los 10 roles. **Mejora:** mover los checklists de verificación intermedia **a cada `agents/*.md`** (un SOP de "antes de pasar el trabajo, verifico X/Y/Z"), no concentrarlos solo en el skill `implement`. |
| 1.3 | **Taxonomía MAST de fallos multi-agente**: 14 modos de fallo en 3 categorías (diseño de sistema, desalineación inter-agente, **verificación/terminación de tarea**), derivados de 1600+ trazas reales en 7 frameworks (NeurIPS 2025, κ=0.88). [5][6] | Usar MAST como **checklist de diseño** de los hooks y de `implement`. La categoría *task verification* (terminación prematura, verificación incompleta/incorrecta) es exactamente lo que `Stop`/`verify.sh` debe prevenir. **Documentar en la constitución qué failure mode previene cada hook.** |

---

## Dimensión 2 — Calidad y verificación automática sin revisión humana

| # | Hallazgo (evidencia) | Aplicación a Pandacorp |
|---|---|---|
| 2.1 ⭐ | **Tests generados por IA tienen puntos ciegos persistentes**: soluciones que pasaron tests privados fueron erróneas en 20% (medium) / 40% (hard); "LLM errors cluster tightly… while human errors are widely distributed". Benchmarks populares tienen tests débiles (HumanEval 7.7 tests/problema; 84% de verificadores defectuosos en un set). [7] | **El `test-writer` y el `implementer` comparten sesgo** → los tests "verdes" tienen huecos. **Mejora P0:** el `reviewer` (modelo distinto, opus) escribe **tests adversariales que el implementer NO vio**; añadir **mutation testing** a `verify.sh` para detectar tests decorativos. |
| 2.2 | **Generación de tests humano-LLM (SAGA)**: derivar restricciones de soluciones correctas y modos de fallo de las incorrectas mejora el verificador (+15.86% sobre TCG existentes). [7] *(voto 2-1: matiz en cifras, no en el principio)* | Anclar los tests en la **"parte humana"**: criterios EARS de los FRDs y **bugs reales documentados en `docs/progreso.md`**, no en lo que el LLM imagina. Reforzar la regla existente del `test-writer`. |
| 2.3 ⭐ | **Endurecer el ENTORNO de evaluación recorta el "hacer trampa" 87.7%** (exploits 6.5%→0.8%) **sin perder éxito de tarea**: outputs intermedios aleatorizados, verificación explícita de pasos, parsing *fail-closed*, menos metadata visible al agente. [8] *(preprint 2026, 1 autor — direccional fuerte, sin réplica)* | `verify.sh` debe correr en **entorno limpio/aislado**, **parsear fail-closed** (cualquier ambigüedad = fallo), **no exponer al agente los nombres exactos de los tests** a pasar, y ocultar/aleatorizar fixtures. Valida la arquitectura de hooks deterministas que ya tienes. |
| 2.4 | **OWASP Top 10 for Agentic Applications** (9-dic-2025, ASI01–ASI10): de "prevenir malas salidas" a "prevenir fallos en cascada" en agentes que planifican/persisten/delegan. Riesgos: Tool Misuse, Identity & Privilege Abuse, Memory Poisoning, Cascading Failures. [9] | Adoptar como **checklist explícito** en `agents/security-auditor.md` y en el skill `release`. Relevantes directos: Tool Misuse (agentes con Bash/rm), Memory Poisoning (envenenar `progreso.md`/memoria entre work orders). |
| 2.5 | **El régimen de entrenamiento del obrero determina su propensión a gamear**: RL-from-base aluciná/explota 12–16% vs 0.4–0.8% en SFT-focused. [8] *(voto 2-1)* | **No asumir que los obreros sonnet/haiku son honestos**: justifica que el `reviewer` **re-verifique TODA evidencia** y que los checks sean siempre de scripts/CI (regla 4 de la constitución, ya correcta). |

---

## Dimensión 3 — Capacidades avanzadas de Claude Code / Agent SDK

| # | Hallazgo (evidencia) | Aplicación a Pandacorp |
|---|---|---|
| 3.1 | **Loop de 4 pasos** "gather context → take action → **verify work** → repeat" para que el agente "catch mistakes before they compound". El **feedback más fuerte es basado en reglas** ("which rules failed and why"); el linting es el ejemplo; **LLM-as-judge "generally not robust"**. [10][11] | Valida exactamente `verify.sh` (tsc/mypy + lint). **Mejora:** que los mensajes de error de `verify.sh` digan **qué regla falló y por qué** (feedback accionable), no solo "FAILED". Y que el `reviewer` **re-corra** tests/lint/typecheck (ya lo hace) en vez de solo opinar. |
| 3.2 | **Subagentes para 2 cosas**: paralelización (terminan en el tiempo del más lento, no la suma) y manejo de contexto (conversación fresca aislada; solo el mensaje final vuelve al líder). Ej.: style-checker + security-scanner + test-coverage en paralelo. [12][10] | En modos **potente/profundo**, correr los 3 lentes del review **en paralelo** como subagentes. El `researcher` "a demanda" es correcto (explora sin contaminar el contexto del líder). **Caveat:** concurrencia capada (~16) y puede topar rate limits en planes bajos. |
| 3.3 | **Checkpoints automáticos** (estado antes de cada cambio, `/rewind`) + **background tasks** + hooks permiten delegar tareas amplias. **Caveat documentado:** los checkpoints **NO rastrean cambios de Bash** (rm/mv) ni reemplazan Git. [13][14] | Usar **background tasks** para dev servers/procesos largos sin bloquear. Los checkpoints son red de seguridad de sesión, **pero mantener commit por work order** (ya es regla). Confirma "escribir contexto crítico a archivos" porque Agent Teams no tiene resume. |

---

## Dimensión 4 — Documentación viva y enforcement de estándares

| # | Hallazgo | Aplicación a Pandacorp |
|---|---|---|
| 4.1 | El **enforcement de estándares por reglas deterministas** (linter/formatter/type-check estricto en CI) es la forma de calidad que mejor funciona con código IA; *gates independientes del agente* > confianza en el agente. [15][16] | Ya está en `calidad.md` + `verify.sh`. **Mejora:** elevar a CI por PR (typecheck+lint+tests en paralelo, e2e hacia main) como gate de merge — coherente con la constitución §11. |
| 4.2 | **Documentación viva**: auto-generar ADRs y docs de arquitectura desde el código/commits (LLM en CI), para que no se queden obsoletas. [17][18] | Añadir un paso en `release`/CI que **auto-genere changelog** (desde conventional commits) y **proponga ADRs** cuando detecta cambios arquitectónicos. Mantiene `docs/` sincronizado sin esfuerzo humano. |

---

## Dimensión 5 — UI/UX del cockpit y gamificación honesta

> Hilo conductor: **el ojo debe enlazar sprite ↔ evento ↔ tarjeta sin leer texto**, el **fallo debe ser tan
> visible como el logro**, y la **restricción** (pocos colores, pocas métricas, pocas variables de tema) es la
> herramienta que protege a un operador débil en diseño.

### (A) Observabilidad de agentes en vivo
- **A1. Color persistente por agente, reusado en TODA la UI** (sprite + feed + kanban). Doble borde si hay varios proyectos: color-proyecto (izq) + color-agente (2º). [19]
- **A2. Vocabulario icónico fijo y acotado (~12 eventos)** (leer/escribir/editar/test ✅❌/arranque/fin); combinar evento+herramienta. Reduce carga de lectura. [19]
- **A3. Fallo como estado de primera clase** (sprite caído + borde rojo + ❌, distinto de "completado"). Sostiene la honestidad del XP. [19]
- **A4. Feed con follow-tail + botón "fijar" + cap de 100–200 eventos** para no degradar el render en builds largos. [19]

### (B) Visualización de pipeline/DAG y data-viz
- **B1. Misma data, dos vistas: toggle RPG ↔ timeline/árbol** honesto (work-orders→tareas→acciones). Una para "disfrutar el show", otra para "entender qué pasó". [20]
- **B2. DAG con path-focus + follow-mode + go-to-failure**: iluminar solo la cadena de dependencias del nodo, centrar la cámara en el paso activo, atajo a "primer error". [21]
- **B3. Render barato: Dagre (~39KB), evitar ELK.js (~1.4MB)** salvo ruteo ortogonal. Esquema de grafo explícito (nodo=WO, arista=dependencia). [22][23]
- **B4. Live Pulse Chart** (barras por minuto, color por agente) = señal honesta de "fábrica viva o estancada". Header con **≤5 KPIs** + indicador **Live/Stale** con timestamp del último evento. Esquema de eventos **vendor-neutral (OpenTelemetry)** para no atarse. [19][24][25]

### (C) Craft visual "limpio e impactante"
- **C1. Tema desde ~3 tokens OKLCH** (base/acento/contraste) + superficies por elevación. Linear pasó de 98 variables a 3; habilita modo alto-contraste sin rediseñar. [26]
- **C2. Acento como "puntuación", no pintura** (un solo acento racionado) + **`tabular-nums` en TODO número** (XP, conteos, stats, timestamps): credibilidad de ingeniería casi gratis. Geist/Vercel: "restraint as a feature". [27][26][28]
- **C3. Escala de elevación/espaciado tokenizada (shadcn)**: 3 niveles (canvas→panel→tarjeta/popup), radio 0.5rem, base 16px, hairline 1px, espaciado en múltiplos de 0.25rem. [28][26]
- **C4. Motion sobrio y honesto**: solo `transform`/`opacity`, **<300ms**, *frequency test* (lo cotidiano sobrio; reserva lo expresivo para logro/nivel/WO-completada). 2–3 tokens de easing. [29][30]
- **C5. Accesibilidad obligatoria**: `prefers-reduced-motion` envuelve toda animación; **estado por icono/forma además del color** (crítico con paleta cálida); `aria-label` en español, `aria-live="polite"`, foco visible, contraste ≥4.5:1. [29][30][31]

### (D) Gamificación honesta no-tóxica
> Pandacorp ya tomó las decisiones correctas (XP por resultado, sin rachas/leaderboards). Estos hallazgos las **validan** y dan checklist para no recaer.
- **D1. Vivir en el "White Hat" del Octalysis** (Significado Épico, Logro/Progreso, Empoderamiento+Feedback): el mayor activo intrínseco es **ver a los agentes trabajar en vivo** → invertir en legibilidad del estado, dejar el XP como capa secundaria. [32][33]
- **D2. XP por resultado verificable, nunca por actividad** (evita el *overjustification effect*): cada logro mapea a algo verificable por CI — coherente con "los agentes nunca marcan sus propios checks". [33][34]
- **D3. Zeigarnik + endowed progress honestos**: mostrar WO en curso con barra parcial; arrancar cadenas con progreso ya hecho (estudio Nunes & Drèze: 34% vs 19% de canje) — honesto porque corresponde a trabajo real. **Sin notificaciones machaconas.** [34][35]
- **D4. Test ético como criterio de aceptación de cada mecánica nueva** (5 preguntas de UX Magazine). **Los logros "secretos" deben revelar su criterio al desbloquearse** (no loot-box). Patrones a NO replicar: streak anxiety, recompensas variables, urgencia falsa, leaderboards, barra "clavada al 80%". [36][34]

---

## Roadmap priorizado

### P0 — Alto impacto, evidencia fuerte, bajo esfuerzo
1. **Romper el sesgo compartido test-writer↔implementer**: el `reviewer` (opus) escribe tests adversariales que el implementer no vio; anclar edge cases en EARS + bugs de `progreso.md`. *(2.1, 2.2)*
2. **`verify.sh` como gate anti-trampa**: añadir mutation testing (Stryker para TS / mutmut para Python), correr en entorno limpio, parsing fail-closed, no exponer nombres de tests. *(2.1, 2.3)*
3. **Cockpit — quick wins de craft**: color persistente por agente + fallo como estado de primera clase + `tabular-nums` + un acento racionado. *(A1, A3, C2)*

### P1 — Alto impacto, esfuerzo medio
4. **OWASP Top 10 Agentic (dic-2025)** como checklist en `security-auditor` + `release`. *(2.4)*
5. **SOPs de verificación intermedia por agente** (en `agents/*.md`) usando MAST; documentar en la constitución qué failure mode previene cada hook. *(1.2, 1.3)*
6. **Mensajes de `verify.sh` accionables** ("qué regla falló y por qué"). *(3.1)*
7. **Cockpit — sistema visual**: tema 3 tokens OKLCH + 3 elevaciones; `prefers-reduced-motion` + estados con icono/forma + aria en español; motion <300ms con frequency test; feed follow-tail+pin+cap. *(C1, C3, C4, C5, A4)*

### P2 — Estructural / experimental
8. **Paralelismo desatendido**: subagentes concurrentes para los 3 lentes del review + background tasks en modos potente/profundo; commit por work order siempre. *(3.2, 3.3)*
9. **Cockpit — observabilidad**: Live Pulse Chart + toggle RPG↔timeline + header ≤5 KPIs + indicador Live/Stale + DAG con path-focus (Dagre). *(B1–B4)*
10. **Eval harness propio** (estilo SWE-bench sobre los propios proyectos) para medir regresiones de calidad del pipeline entre versiones. *(open question)*
11. **Documentación viva**: auto-changelog desde conventional commits + ADRs propuestos por CI. *(4.2)*

---

## Limitaciones y sensibilidad temporal
- Los dos hallazgos más operativos sobre "trampas de agentes" (2.3 endurecimiento de entorno, 2.5 reward hacking) vienen de **un preprint de 2026 de un solo autor, no peer-reviewed** — direccionalmente fuertes pero sin réplica. 2.2 (SAGA) y 2.5 tuvieron voto 2-1.
- Agent Teams y checkpoints son **recientes/experimentales** y evolucionan rápido (Agent Teams sin resume; checkpoints no rastrean Bash ni reemplazan Git).
- La evidencia fuerte es mayormente de **fuentes primarias** (papers, docs/blog de Anthropic, OWASP), robusta pero sesgada hacia "lo que los frameworks afirman diseñar" más que outcomes medidos en producción.

## Referencias
[1] github.blog — Spec-driven development toolkit · [2] github.com/github/spec-kit · [3] arXiv 2308.00352 (MetaGPT) · [4] openreview VtmBAGCN7o · [5] github MAST · [6] arXiv 2503.13657 · [7] arXiv 2507.06920 · [8] arXiv 2605.02964 · [9] genai.owasp.org (Top 10 Agentic, 2025-12-09) · [10] anthropic.com/engineering/building-agents-with-the-claude-agent-sdk · [11] claude.com/blog/building-agents-with-the-claude-agent-sdk · [12] code.claude.com/docs/agent-sdk/subagents · [13] anthropic.com/news/enabling-claude-code-to-work-more-autonomously · [14] code.claude.com/docs/checkpointing · [15] blog.codacy.com/why-coding-agents-need-independent-quality-gates · [16] blog.reccehq.com/before-you-let-agents-touch-your-codebase-build-these-gates · [17] medium @iraj.hedayati (ADRs automáticos) · [18] kinde.com (living architecture docs) · [19] github.com/disler/claude-code-hooks-multi-agent-observability · [20] docs.agentops.ai/v2/concepts/core-concepts · [21] buildkite.com/resources/blog/visualize-your-ci-cd-pipeline-on-a-canvas · [22] reactflow.dev/learn/layouting · [23] cambridge-intelligence.com/blog/react-graph-visualization-library · [24] docs.langchain.com/langsmith/dashboards · [25] opentelemetry.io/blog/2025/ai-agent-observability · [26] linear.app/now/how-we-redesigned-the-linear-ui · [27] designsystems.one/design-systems/vercel-geist · [28] interfaces.rauno.me · [29] github vercel-labs/open-agents web-animation-design · [30] animations.dev · [31] smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards · [32] yukaichou.com white-hat-black-hat-octalysis · [33] yukaichou.com left-brain-right-brain-core-drives · [34] uxmag.com gamification-or-manipulation · [35] learningloop.io endowed-progress-effect · [36] learningloop.io zeigarnik-effect
