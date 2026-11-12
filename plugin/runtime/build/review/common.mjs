// review-record shared constants and tiny helpers: imported by every sibling in `review/`.

/** Unit kinds whose report is filed with `review-record` (A8). */
export const REVIEW_RECORD_KINDS = Object.freeze(["review", "deferred-review", "audit"]);

export const RECORDABLE_STATES = ["admitted", "running"];
export const REVIEWED_FROM = ["integrated", "reviewing", "verified"];
export const BLOCKING_SEVERITIES = ["critical", "high"];
export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
export const frdKey = (value) => (value ?? "").toLowerCase();
export const unique = (items) => [...new Set(items)];
