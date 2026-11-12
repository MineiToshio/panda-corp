// Small helpers shared by every doubt module: error factory, owner-text normalisation, safe telemetry and the origin of consults.

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Owner strings carry no em or en dash (CONV-11): a worker's text is normalised before it reaches the inbox. */
export const es = (text) => String(text ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
export const oneLine = (text, max = 200) => {
  const v = String(text ?? "").replace(/\s+/g, " ").trim();
  return v.length > max ? `${v.slice(0, max - 3)}...` : v;
};
export const cellText = (c) => `${c.runtime} ${c.model} ${c.effort}`;
export const optionText = (record, id) => record.options.find((o) => o.id === id)?.text ?? id;

export async function emitSafely(deps, name, data) {
  if (!deps.emit) return null;
  try { await deps.emit({ name, data }); return null; } catch (error) { return `telemetry ${name}: ${oneLine(error.message, 120)}`; }
}

export async function notifySafely(deps, note) {
  if (!deps.notify) return;
  try { await deps.notify(note); } catch { /* a notification never fails a build command */ }
}

/**
 * Who the consults come from (CLI doc table 2.4): a drive coordinator or the Codex app always consult as such; a Claude
 * session consults from the doubted unit's author company (its dispatch cell).
 * @param {{coordinator: string}} state
 * @param {object|null} unit the doubted unit
 * @returns {"claude"|"codex"|"drive"|"codex_app"}
 */
export function consultOrigin(state, unit) {
  if (state.coordinator === "drive") return "drive";
  if (state.coordinator === "codex-session") return "codex_app";
  return unit?.worker?.runtime === "codex" ? "codex" : "claude";
}

/** Under drive or the Codex app (R-B) the sources step is skipped (D20). */
export const sourcesSkipped = (state) => state.coordinator === "drive" || state.coordinator === "codex-session";
