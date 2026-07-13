/**
 * Curated flow specs for the two Dynamic Workflow engines — the SOURCE for the Manual's Workflows
 * sub-pages (`WorkflowBuild` / `WorkflowBacklog`), rendered via the same generic `FlowGraph` the
 * skill flows use (lib/manual/skill-flows.ts).
 *
 * Distinct from `skill-flows.ts`: those describe SKILLS (the `/pandacorp:*` commands, model-improvised
 * orchestration); these describe the two native Dynamic Workflow engines themselves — deterministic
 * JS scripts in `.claude/engines/` that a skill launches (`implement` → pandacorp-build,
 * `implement-backlog` → pandacorp-backlog). `SkillFlow` is reused as-is (same shape fits both).
 *
 * Accuracy contract: mirrors the real engine behavior (factory/standards/build-orchestration.md +
 * the engine scripts) — nothing invented. Update here when the engine's steps change.
 */

import type { SkillFlow } from "./skill-flows";

// ---------------------------------------------------------------------------
// pandacorp-build — the construction engine (launched by /pandacorp:implement)
// ---------------------------------------------------------------------------

export const buildFlow: SkillFlow = {
  slug: "pandacorp-build",
  explainer:
    "Construye un proyecto entero, feature por feature, en oleadas globales que paralelizan lo independiente; una compuerta de revisión cierra cada feature. Reanudable por frontmatter; lo vigila un supervisor que te avisa al móvil.",
  runsIn: "project",
  steps: [
    {
      title: "Baseline",
      kind: "safe",
      detail:
        "Auto-diagnóstico: comprueba el último verde y corre verify.sh; si está roja, repara antes de empezar.",
    },
    {
      title: "Plan",
      kind: "action",
      detail:
        "Lee el frontmatter de todas las FRDs y work orders, arma el plan de oleadas y comprueba que la 'foundation' (design system + shell) esté completa.",
    },
    {
      title: "Oleada de construcción",
      kind: "loop",
      detail:
        "Toma los work orders listos de TODAS las features (deps hechas, archivos disjuntos), hasta el ancho de la oleada según el modo. Los workers (implementer/backend/frontend/test) construyen EN PARALELO.",
      parallel: true,
      note: "Cada work order se COMITEA en cuanto pasa su self-test (checkpoint fino).",
      calls: [
        { ref: "implementer", as: "agent" },
        { ref: "backend-dev", as: "agent" },
        { ref: "frontend-dev", as: "agent" },
        { ref: "test-writer", as: "agent" },
      ],
    },
    {
      title: "Gate por feature",
      kind: "gate",
      detail:
        "Al cerrar cada FRD, el juez inventaría el contrato completo — requisitos, AC numerados, invariantes, casos límite, límites, errores y exclusiones— y deja trazabilidad contrato→prueba. Un AC verde nunca perdona una contradicción en otra sección; cada borde o límite aplicable exige una prueba adversarial. En powerful/deep se abre en 4 lentes en paralelo + verificación adversarial + cierre Opus (reviewSplit); en pro/balanced, un revisor en serie. El gate corre en un worktree congelado mientras el build sigue forjando otras features; al aprobar, sella VERIFIED en main de forma serializada.",
      parallel: true,
      calls: [{ ref: "reviewer", as: "agent" }],
    },
    {
      title: "Convergencia",
      kind: "loop",
      detail:
        "Si el gate encuentra fallos, sube una escalera de recuperación: diagnostica primero (puntual · arquitectónico · gate-test-defectuoso · punto muerto), parchea informado (≤2 intentos), y si no converge revierte SOLO la costura tocada y reabre el work order. Cada paso queda en un diario durable (build-journal.jsonl). Solo bloquea (con motivo) si de verdad necesita al owner; nunca trata un fallo repetido como progreso.",
    },
    {
      title: "Hardening",
      kind: "action",
      detail:
        "Último paso de construcción: auditoría de seguridad (auditor read-only) + fix, y verificación de telemetría. Fail-closed antes de marcar release.",
      calls: [{ ref: "security-auditor", as: "agent" }],
    },
    {
      title: "Cierre",
      kind: "safe",
      detail: "verify.sh completo una vez; marca la fase y deja running:false en cualquier salida.",
    },
  ],
  loop: "El supervisor relanza el motor pasada tras pasada hasta que no queda work order pendiente, o topa presupuesto/salud.",
};

// ---------------------------------------------------------------------------
// pandacorp-backlog — the factory backlog-draining engine
// (launched by /pandacorp:implement-backlog with no argument)
// ---------------------------------------------------------------------------

export const backlogFlow: SkillFlow = {
  slug: "pandacorp-backlog",
  explainer:
    "Drena el backlog de la fábrica: mide cada BL, lanza un implementador por ítem en paralelo (worktree propio, tier según dificultad) y los mergea a main de uno en uno con un validador entre cada merge. Reanudable por el status del frontmatter.",
  runsIn: "factory",
  steps: [
    {
      title: "Scan",
      kind: "action",
      detail:
        "Un agente haiku lee el frontmatter de todos los BL-*, mide cada uno a un tier (haiku/sonnet/opus) y filtra los open|doing.",
      note: "Respeta un tope opcional y avisa de lo que deja fuera (nunca corta en silencio).",
    },
    {
      title: "Implement",
      kind: "action",
      detail:
        "Un subagente por ítem EN PARALELO, al tier medido, cada uno aislado en su propio worktree. Implementa el Fix plan del ítem, comitea en su rama, NUNCA mergea.",
      parallel: true,
      calls: [{ ref: "implementer", as: "agent" }],
    },
    {
      title: "Merge",
      kind: "gate",
      detail:
        "Estrictamente de uno en uno, en orden: rebase/ff-only sobre main, resuelve los sitios calientes conocidos, corre validate-backlog.sh, y quita el worktree+rama. Si el validador falla: revierte y marca el ítem bloqueado.",
    },
    {
      title: "Report",
      kind: "io",
      detail:
        "Devuelve {done, blocked}; el skill te pinta la tabla en español. No hace push ni notifica — eso es del skill.",
    },
  ],
  loop: "Relanzar re-escanea el backlog; los ítems ya done no vuelven a entrar (reanudable por frontmatter).",
};
