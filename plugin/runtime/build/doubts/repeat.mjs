// Detection of a doubt that repeats one the ladder already decided for the same unit.
import { SYNTHESIZED_OPTION_IDS } from "./constants.mjs";

const normalizeQuestion = (text) => String(text ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const optionKey = (options) => options.map((o) => o.id).sort().join("|");
const SYNTHESIZED_KEYS = new Set(Object.values(SYNTHESIZED_OPTION_IDS).map((ids) => [...ids].sort().join("|")));

/**
 * Is a newly raised doubt the same one a unit already had DECIDED? Such a repeat is never given to the ladder again (it
 * parks to the owner): deciding it again would re-queue the unit at the same attempt and loop for ever (review R1b NB1).
 * The same question (case, accents, punctuation and spacing ignored) is always a repeat. For a worker-authored doubt the
 * same option ids with the same preferred option is a repeat too; for an engine-synthesized doubt (its option ids are one
 * of {@link SYNTHESIZED_OPTION_IDS}, shared by every such doubt) only the question counts, so a DISTINCT second ambiguity
 * goes up the ladder (DR1c-N1). A reworded repeat of a synthesized doubt is bounded by the per-build consult cap.
 * @param {object|null} previous the unit's previous doubt record (`unit.doubt_id`)
 * @param {{question: string, options: {id: string}[], preferred: string}} doubt the doubt being opened
 * @returns {boolean}
 */
const identities = doubt => {
  const text = [doubt.question, doubt.why, ...(doubt.options ?? []).map(o => o.text)].join(" ");
  return new Set(text.match(/(?:[\w@.-]+\/)+[\w.\[\]@-]+|\b(?:AC|REQ|DR)-[\w.-]+\b|\b(?:generateStaticParams|cacheComponents)\b/g) ?? []);
};

export function isRepeatDoubt(previous, doubt, basis = null) {
  if (!previous || previous.step !== "decided") return false;
  if (basis && previous.basis && basis !== previous.basis) {
    // A different wording may select different files. Only replacement of a COMMON predecessor is causal.
    try {
      const current = new Map(JSON.parse(basis));
      if (JSON.parse(previous.basis).some(([file, hash]) => current.has(file) && current.get(file) !== hash)) return false;
    } catch { /* Legacy/unreadable fingerprint is not proof of a repair. */ }
  }
  const priorKeys = identities(previous);
  if ([...identities(doubt)].some(key => priorKeys.has(key))) return true;
  if (normalizeQuestion(previous.question) === normalizeQuestion(doubt.question)) return true;
  const key = optionKey(doubt.options);
  if (SYNTHESIZED_KEYS.has(key)) return false;
  return previous.preferred === doubt.preferred && optionKey(previous.options) === key;
}
