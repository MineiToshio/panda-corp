// Opening the doubt of a `reported` unit (a Codex worker has no shell to run `doubt open` itself: B2). ../failure.mjs is the public entry.
import * as fsp from "node:fs/promises";
import { SYNTHESIZED_OPTION_IDS } from "../doubts.mjs";
import { atomicWriteJson } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase } from "../state.mjs";
import { oneLine } from "./common.mjs";
import { handBack } from "./handback.mjs";

/**
 * Synthesize the doubt object (`report.schema.json#/properties/doubt`) of a worker diagnosis that the policy turned into a
 * `doubt` (spec-ambiguous) or a `dispute` (test-defective) action. Two neutral, reversible options; the worker's detail is the evidence.
 * @param {{cause: string, detail?: string}|null} diagnosis
 * @returns {{question: string, options: {id: string, text: string}[], preferred: string, why: string}|null} null when the diagnosis has no detail to build from
 */
export function doubtFromDiagnosis(diagnosis) {
  const detail = oneLine(diagnosis?.detail ?? "", 1500);
  if (!detail) return null;
  if (diagnosis.cause === "test-defective") {
    return {
      question: `El trabajador discute una prueba de la unidad: ${detail}. ¿Se corrige la prueba o se mantiene y se rehace el código?`,
      options: [{ id: SYNTHESIZED_OPTION_IDS.dispute[0], text: "Corregir la prueba discutida y mantener el código" }, { id: SYNTHESIZED_OPTION_IDS.dispute[1], text: "Mantener la prueba y rehacer el código" }],
      preferred: SYNTHESIZED_OPTION_IDS.dispute[0], why: "la prueba discutida se corrige sin tocar el código ya hecho",
    };
  }
  return {
    question: `El trabajador no puede seguir porque la especificación es ambigua: ${detail}. ¿Qué lectura se toma?`,
    options: [{ id: SYNTHESIZED_OPTION_IDS.ambiguity[0], text: "Tomar la lectura más conservadora y reversible y seguir" }, { id: SYNTHESIZED_OPTION_IDS.ambiguity[1], text: "Parar y pedir al owner que aclare la especificación" }],
    preferred: SYNTHESIZED_OPTION_IDS.ambiguity[0], why: "la lectura conservadora es reversible y no bloquea al resto de la obra",
  };
}

/**
 * Turn a `reported` unit's doubt into an OPENED doubt through `doubts.openDoubt` (fenced; call it OUTSIDE any mutex section).
 * Writes the doubt object to `units/<unit>/doubt.json`, then opens it: under drive or the Codex app the sources step is skipped
 * and the first consult unit is queued; a vetoed doubt parks at once. If the doubt cannot be built or the ladder refuses it
 * (`INVALID_INPUT` / `INVALID_STATE`), the unit is HANDED BACK instead of being left `reported` for good (reason `worker_blocked`).
 * Idempotent: a unit whose doubt is already open returns it with `applied: false`. A unit that raises again a doubt the
 * ladder already decided for it is parked to the owner (`parked.reasons: ["repeat_doubt"]`), never decided twice (NB1).
 * @param {{project: string, epoch: number, unit: string, doubt?: object|null, diagnosis?: object|null, actor?: string}} input
 *   `doubt` is the worker's doubt object; when absent it is built from `diagnosis` ({@link doubtFromDiagnosis})
 * @param {object} [deps] as `doubts.openDoubt`, plus `doubts` (module override)
 * @returns {Promise<{opened: true, applied: boolean, doubt_id: string, step: string, consult?: object, parked?: object, notice_es?: string, warnings?: string[]}
 *   | {opened: false, handback: {path: string, blocked: string[], stop_run: boolean, notice_es: string, reason_code: string}}>}
 */
export async function openUnitDoubt(input, deps = {}) {
  const { project, epoch, unit, diagnosis = null } = input;
  const doubt = input.doubt ?? doubtFromDiagnosis(diagnosis);
  const refused = async (why) => {
    const res = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
      const back = await handBack(ctx, { unitId: unit, cause: diagnosis?.cause ?? "owner", reasonCode: "worker_blocked", reason: `la duda de ${unit} no se pudo abrir: ${why}`, diagnosis }, deps);
      return { path: back.path, blocked: back.blocked.map((b) => b.unit), stop_run: back.stop_run, notice_es: back.notice_es, reason_code: "worker_blocked" };
    });
    return { opened: false, handback: res };
  };
  if (!doubt) return refused("el trabajador no aportó una duda ni un diagnóstico con detalle");
  const fs = deps.fs ?? fsp;
  const file = buildPaths(project, deps).unitDoubtFile(unit);
  await atomicWriteJson(file, doubt, { fs });
  const doubts = deps.doubts ?? await import("../doubts.mjs");
  for (let tries = 0; ; tries += 1) {
    try {
      const res = await doubts.openDoubt({ project, epoch, unit, file }, { ...deps, actor: input.actor ?? deps.actor });
      return {
        opened: true, applied: res.applied !== false, doubt_id: res.doubt_id, step: res.step,
        ...(res.consult ? { consult: res.consult } : {}), ...(res.parked ? { parked: res.parked } : {}),
        ...(res.notice_es ? { notice_es: res.notice_es } : {}), ...(res.warnings ? { warnings: res.warnings } : {}),
      };
    } catch (error) {
      if (error.code !== "INVALID_INPUT" && error.code !== "INVALID_STATE") throw error;
      // The unit moved between the assessment and the mutation (a harvest settling it): one retry, never a hand-back for a race (NB7).
      if (tries === 0 && error.code === "INVALID_STATE" && UNIT_RACE_RE.test(error.message)) continue;
      return refused(oneLine(error.message, 200));
    }
  }
}

/** The transient `INVALID_STATE` of `doubts.openDoubt` when its unit changed while the veto was assessed. */
const UNIT_RACE_RE = /changed while its doubt was assessed/;
