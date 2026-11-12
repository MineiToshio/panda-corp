// Shared helpers and constants of the integration modules (leaf: imports nothing from the engine).
export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
export const tail = (text, n = 240) => String(text ?? "").trim().slice(-n);
export const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A unit built on an assumption that the owner has not accepted yet (BUILD-12): it integrates on its assume branch. */
export const isAssumed = (u) => u?.parked === "built_on_assumption";

/** Unit kinds whose branches carry commits that reach the integration branch. */
export const INTEGRABLE_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
/** Kinds whose work orders move to IN_REVIEW when the chain is integrated. */
export const WO_KINDS = new Set(["build", "patch"]);
/** Unit states that mean "already integrated or later" for FRD completeness. */
export const INTEGRATED_OR_LATER = new Set(["integrated", "reviewing", "verified", "landed"]);
