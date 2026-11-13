// Owner-facing Spanish text of a hand-back: the pending decisions entry, the `handback/<unit>.md` file and the notice.
// Spanish, no em/en dashes (the one exception is the decisions inbox heading, see decisionHeading).
import { POLICY, lastLines, oneLine } from "./common.mjs";

const CAUSE_ES = Object.freeze({
  code: "fallo de código", "test-defective": "prueba defectuosa", "spec-ambiguous": "especificación ambigua", "env-infra": "entorno o infraestructura",
  dependency: "dependencia externa (secreto, cuenta o servicio)", gate: "puerta humana", owner: "decisión del owner",
});
const REASON_ES = Object.freeze({
  budget_exhausted: "se agotaron las 3 ejecuciones de la unidad", evidence_identical: "el tercer intento no aportaba evidencia nueva respecto al segundo",
  no_diagnosis: "el segundo intento falló sin diagnóstico, no hay base para un tercero", test_defective_disputed: "la prueba sigue en disputa tras la réplica del revisor",
  dependency_missing: "falta un secreto, una cuenta o un servicio que solo tú puedes aportar", human_gate: "la unidad necesita una puerta humana",
  owner_refused_gate: "el owner rechazó la puerta humana", manual: "devuelta a mano por la sesión",
  worker_blocked: "el trabajador se declaró bloqueado y no puede seguir sin ti", worker_failed: "el trabajador falló sin informe válido en sus intentos",
  answer_rework_budget: "tu respuesta pedía rehacer una unidad que ya agotó sus 3 ejecuciones",
  review_blocked: "la revisión independiente bloqueó la unidad (toca algo fuera del alcance o no puede aprobarse)",
  g3_red_not_from_batch: "la puerta G3 salió roja dos veces en un lote solo de documentos; el fallo viene de main o de la máquina, no de la unidad",
});
const causeEs = (cause) => CAUSE_ES[cause] ?? String(cause);
const reasonEs = (code) => REASON_ES[code] ?? String(code);

const OPTIONS_ES = Object.freeze({
  dependency: ["Aportar el secreto, la cuenta o el servicio que falta y reanudar (recomendada: es lo único que bloquea).", "Cambiar el work order para que no dependa de ello."],
  "test-defective": ["Corregir la prueba discutida con /pandacorp:implement y reanudar (recomendada: el código no se toca).", "Mantener la prueba y reescribir el work order."],
  // BL-0312: the resume is a real command (failure/unblock.mjs), named with the unit so the coordinator can run it.
  "env-infra": (info) => [
    `Arreglar el entorno (red, disco, herramienta) y reanudar la unidad en el mismo intento, sin gastar presupuesto ni perder su trabajo: \`unblock --epoch <E> --unit ${info.unit} --reason "<qué se arregló>"\`, o \`start --resume --coordinator <C> --unblock ${info.unit} --reason "<qué se arregló>"\` si la obra ya terminó (recomendada).`,
    "Dejar la unidad bloqueada y seguir con lo que no depende de ella.",
  ],
  gate: ["Reformular el work order sin la acción protegida (recomendada).", "Aprobar la puerta con /pandacorp:decide si de verdad quieres esa acción."],
  default: ["Revisar el diagnóstico y ajustar el work order o la especificación con /pandacorp:implement, luego reanudar (recomendada).", "Revertir a mano los commits de la unidad (solo tú decides un revert)."],
});

const optionsOf = (info) => { const o = OPTIONS_ES[info.cause] ?? OPTIONS_ES.default; return typeof o === "function" ? o(info) : o; };

function decisionHeading(date, text) {
  // The decisions inbox format (decisions-inbox-template.md, parseDecisionBlocks) requires "## YYYY-MM-DD — <title>".
  return `## ${date} — ${text}`;
}

export function handbackDecisionEntry(info) {
  const options = optionsOf(info);
  return [
    decisionHeading(info.date, `${info.wos.join(", ") || info.unit}: unidad devuelta al owner`),
    `- **Qué decidir:** cómo seguir con la unidad ${info.unit}, que el motor no ha podido terminar.`,
    `- **Contexto / por qué:** el motor construye cada unidad con un máximo de 3 ejecuciones y no insiste más allá. Causa: ${causeEs(info.cause)}. Motivo: ${reasonEs(info.reasonCode)}${info.reason ? ` (${oneLine(info.reason, 200)})` : ""}. Su trabajo anterior está a salvo (commits y ramas conservados). Si no decides, esa unidad y las que dependen de ella se quedan sin construir; el resto de la obra continúa. Detalle completo en ${info.path}.`,
    `- **Opciones:** ${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o.replace(/ \(recomendada.*$/, "").replace(/\.$/, "")}`).join(" · ")}`,
    `- **Detalle de alternativas:** ${options.map((o, i) => `${i + 1}) ${o}`).join(" ")}`,
    `- **Recomendación (del agente):** la opción A. Cambiaría de opinión si el diagnóstico del archivo de detalle apunta a un fallo de la especificación y no de la unidad.`,
    `- **Bloquea:** ${info.blockedUnits.join(", ")}`,
    "- **Estado:** PENDIENTE",
    "",
  ].join("\n");
}

export function handbackMarkdown(info) {
  const options = optionsOf(info);
  const attempts = info.attempts.length ? info.attempts.map((a, i) => `  ${i + 1}) ${a}`).join("\n") : "  (sin detalle de intentos disponible)";
  return [
    `# Unidad devuelta: ${info.unit}`,
    "",
    `unidad: ${info.unit} / ${info.wos.join(", ") || "sin WO"}   estado: BLOCKED (needs-owner)   intento: ${info.attempt}/${POLICY.MAX_EXECUTIONS}   causa: ${causeEs(info.cause)}`,
    `motivo: ${reasonEs(info.reasonCode)}${info.reason ? ` (${oneLine(info.reason, 400)})` : ""}`,
    `falla: ${info.failure?.command ?? "sin comando registrado"}`,
    info.failure?.tail ? ["```", lastLines(info.failure.tail), "```"].join("\n") : "(sin salida registrada)",
    "intentos:",
    attempts,
    `diagnóstico: ${info.diagnosis?.detail ? oneLine(info.diagnosis.detail, 1500) : "sin diagnóstico del trabajador"}`,
    `preservado: ${info.preserved.length ? info.preserved.join("; ") : "sin ramas de intento registradas"}; commits de unidad, tests RED y probes, journal y worktrees registrados; las WOs ya aterrizadas siguen intactas`,
    `unidades bloqueadas: ${info.blockedUnits.join(", ")}`,
    info.skippedWos.length ? `work orders sin tocar: ${info.skippedWos.join("; ")}` : null,
    "opciones:",
    ...options.map((o, i) => `  (${i + 1}) ${o}`),
    "Decidir con /pandacorp:decide.",
    "",
  ].filter((line) => line !== null).join("\n");
}

export const handbackNotice = (info) => `Unidad devuelta: ${info.unit} (${info.wos.join(", ") || "sin WO"}). Causa: ${causeEs(info.cause)}. Su trabajo anterior está a salvo y el resto de la obra sigue. Detalle en ${info.path}; decide con /pandacorp:decide.`;
