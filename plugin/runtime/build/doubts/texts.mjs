// Owner-facing texts (Spanish, no dashes) and the decision-log entry (English, committed) of the doubt ladder.
import { cellText, es, oneLine, optionText } from "./common.mjs";

const PARK_REASON_ES = Object.freeze({
  irreversible: "es irreversible (lo decide el motor, no un modelo)",
  scope: "toca el alcance acordado (Dentro o Fuera)",
  money: "implica dinero o datos personales",
  human_gate: "toca una puerta humana (producción, borrado o comunicación externa)",
  requires_owner_dr: "una regla de decisión exige tu respuesta",
  floor_signal: "toca una zona crítica del proyecto",
  failclosed: "el clasificador de riesgo no pudo evaluarla y se aplica el camino prudente",
  cap_per_build: "ya se consultaron 8 dudas en este build (el máximo)",
  cap_per_doubt: "se agotaron las 3 consultas de esta duda",
  no_consultant: "no hay consultor disponible de la otra compañía",
  no_consensus: "las consultas no coincidieron con confianza suficiente",
  consult_irreversible: "un consultor la marcó como irreversible",
  owner_requested: "se concluyó que la especificación hay que aclararla contigo",
  repeat_doubt: "la misma duda volvió a aparecer en esa unidad después de decidirse sin ti",
});


export const parkReasonEs = (reasons) => reasons.map((r) => PARK_REASON_ES[r] ?? r).join("; ");

function optionsLine(record) {
  return record.options.map((o) => `${o.id}) ${es(o.text)}`).join(" · ");
}

export function advisorsEs(record) {
  const lines = record.consults.filter((c) => c.answer).map((c) => {
    const a = c.answer;
    return `${cellText(c)}: ${a.decision === null ? "sin respuesta" : `opción ${a.decision}`} (confianza ${a.confidence}${a.reversible ? "" : ", no reversible"})`;
  });
  return lines.length ? lines.join("; ") : "ninguna";
}

export function inboxEntry({ record, unit, runId, date, status, blocks, effect }) {
  const wos = unit.wos?.length ? unit.wos.join(", ") : unit.frd ?? "sin work order";
  return [
    `## ${date} - Duda ${record.id}: ${oneLine(es(record.question), 110)}`,
    `- **Id:** \`${record.id}\` (unidad \`${unit.id}\`, build \`${runId}\`)`,
    `- **Qué decidir:** ${es(record.question)}`,
    `- **Contexto / por qué:** El build la encontró al trabajar en la unidad \`${unit.id}\` (${wos}). Quien la planteó explica: ${es(record.why)}. ${effect}`,
    `- **Opciones:** ${optionsLine(record)}`,
    `- **Detalle de alternativas:** ${record.options.map((o) => `${o.id}) ${es(o.text)}${o.id === record.preferred ? " (la preferida por quien la planteó)" : ""}`).join("; ")}. Consultas hechas: ${advisorsEs(record)}.`,
    `- **Recomendación (del agente):** opción ${record.preferred}, la preferida por quien la planteó: ${es(record.why)}. Cambiaría de opinión si tu intención para esta tarea es otra.`,
    `- **Bloquea:** ${blocks.length ? blocks.map((b) => `\`${b}\``).join(", ") : "nada"}`,
    `- **Estado:** ${status}`,
    `- **Cómo responder:** dile tu opción a la sesión del build; la registra con \`answer --question ${record.id} --value '"<opción>"'\`.`,
    "",
  ].join("\n");
}

export function decisionLogEntry({ record, unit, runId, branch, card, date, advisors }) {
  const chosen = record.decision.value;
  const by = record.decision.decided_by === "sources"
    ? `sources (${record.decision.why})`
    : `${record.decision.decided_by} (${advisors.map((c) => `${cellText(c)}, confidence ${c.answer.confidence}`).join("; ")})`;
  return [
    `## ${date} · Decidido sin el owner: ${oneLine(record.question, 120)}`,
    "",
    `**Doubt:** \`${record.id}\` · unit \`${unit.id}\` · run \`${runId}\` · card ${card ? `\`${card}\`` : "none"}`,
    "",
    `**Question:** ${oneLine(record.question, 600)}`,
    "",
    `**Options:** ${record.options.map((o) => `\`${o.id}\` ${oneLine(o.text, 200)}`).join("; ")}`,
    "",
    `**Chosen:** \`${chosen}\` (${oneLine(optionText(record, chosen), 200)}); the author preferred \`${record.preferred}\`.`,
    "",
    `**Decided by:** ${by}. All advisors: ${record.consults.filter((c) => c.answer).map((c) => `${cellText(c)} -> ${c.answer.decision ?? "no answer"} (${c.answer.confidence})`).join("; ") || "none"}.`,
    "",
    `**Commit:** this entry on \`${branch}\`; the implementation lands with unit \`${unit.id}\`${unit.wos?.length ? ` (${unit.wos.join(", ")})` : ""}.`,
    "",
    `**How to revert:** the owner says "Revierte la decisión ${record.id}"; it becomes a new change card (never a hand revert of this run).`,
    "",
  ].join("\n");
}
