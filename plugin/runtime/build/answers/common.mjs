// Small pure helpers shared by the answer modules: error factory, JSON equality, plain-object test, unit replacement.
export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
};
/** Deep equality of two JSON values (key order ignored). */
export const sameValue = (a, b) => canonical(a) === canonical(b);

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const es = (text) => String(text ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

export const replace = (state, changed) => ({ ...state, units: state.units.map((u) => changed.get(u.id) ?? u) });
