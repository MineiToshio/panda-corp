// Owner notifications of the v2 build engine (BUILD-13 human gates, BUILD-14 drive): one macOS notification
// through `osascript`, sent by `drive` (and any other CLI path) when the owner must know something while away:
// a takeover by the Codex relay, a human gate reached, a terminal state of the run, an engine failure.
// A no-op off macOS and when `PANDACORP_NOTIFY=off` (every test sets it). Runs `osascript -e <script>` through an
// injectable `exec`; the text is escaped into AppleScript string literals (quotes, backslashes, newlines) so it can
// never break out of them. Never throws: a notification that cannot be delivered is reported in the result, never fatal to the build.
// Owner-facing strings are Spanish without dashes. Node builtins only; no sibling imports.
import { execFile } from "node:child_process";
import path from "node:path";

const OSASCRIPT = "osascript";
const SPAWN_TIMEOUT_MS = 10_000;
const MAX_TEXT = 240; // macOS truncates long banners; keep the useful part

/**
 * Owner-facing templates, keyed by event. Each returns `{title, message}` (Spanish, no dashes).
 * `data.project` is the project root (its basename is shown); other fields are optional.
 */
export const NOTIFY_TEMPLATES = Object.freeze({
  takeover: (d) => ({ title: "Relevo de Codex", message: `El relevo de Codex sigue el build de ${d.name}. No tienes que hacer nada.` }),
  "waiting-gate": (d) => ({ title: "Build esperando tu OK", message: `El build de ${d.name} llegó a una puerta humana${d.kind ? ` (${d.kind})` : ""}. Revísala en Mission Control.` }),
  "paused-quota": (d) => ({ title: "Build en pausa por cupo", message: `El build de ${d.name} está en pausa: ambas compañías sin cupo.${d.resets ? ` Vuelve a haber cupo hacia ${d.resets}.` : ""} Retómalo con implement v2 --resume.` }),
  "paused-infra": (d) => ({ title: "Build en pausa", message: `El build de ${d.name} está en pausa por presión de memoria del Mac. Retómalo con implement v2 --resume.` }),
  "waiting-owner": (d) => ({ title: "Build esperando tu respuesta", message: `El build de ${d.name} no puede avanzar sin una respuesta tuya. Revisa las preguntas abiertas en Mission Control.` }),
  deadlock: (d) => ({ title: "Build detenido", message: `El build de ${d.name} se detuvo: el plan no puede avanzar. Revisa el informe en Mission Control.` }),
  stop: (d) => ({ title: "Build detenido", message: `El build de ${d.name} se detuvo en un punto seguro. Revisa el informe en Mission Control.` }),
  done: (d) => ({ title: "Build terminado", message: `El build de ${d.name} terminó. El informe está en Mission Control.` }),
  "engine-failure": (d) => ({ title: "Fallo del motor de build", message: `El build de ${d.name} se detuvo por un fallo del motor. El trabajo está a salvo en el último punto seguro.` }),
});

const clip = (text) => {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT - 3)}...` : value;
};

/** AppleScript string literal (backslash and double quote escaped). */
export const appleScriptString = (text) => `"${clip(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * The AppleScript program for one notification.
 * @param {{title: string, message: string}} note
 * @returns {string}
 */
export function notificationScript({ title, message }) {
  return `display notification ${appleScriptString(message)} with title ${appleScriptString(title)}\n`;
}

/**
 * Is delivery enabled? Off when `PANDACORP_NOTIFY=off` (tests) or the platform is not macOS.
 * @param {{env?: object, platform?: string}} [deps]
 * @returns {{enabled: boolean, reason: string|null}}
 */
export function notifyEnabled({ env = process.env, platform = process.platform } = {}) {
  if (String(env.PANDACORP_NOTIFY ?? "").toLowerCase() === "off") return { enabled: false, reason: "disabled" };
  if (platform !== "darwin") return { enabled: false, reason: "not_macos" };
  return { enabled: true, reason: null };
}

// Default runner: `execFile` with a timeout; resolves `{code}` and never rejects.
const defaultExec = (cmd, args, { timeout } = {}) => new Promise((resolve) => {
  execFile(cmd, args, { timeout, encoding: "utf8" }, (error) => {
    resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0 });
  });
});

const exitCodeOf = (result) => {
  if (!result || typeof result !== "object") return 0;
  for (const key of ["code", "status", "exitCode"]) if (typeof result[key] === "number") return result[key];
  return 0;
};

/**
 * Send one notification: `osascript -e <script>`. Never throws.
 * @param {{title: string, message: string}} note owner-facing text
 * @param {{env?: object, platform?: string, exec?: Function, timeoutMs?: number}} [deps] `exec(cmd, args, opts)`
 *   replaces the real runner (it may return a value or a promise; a numeric `code`/`status`/`exitCode` != 0 is a failure)
 * @returns {Promise<{sent: boolean, reason: string|null}>}
 */
export async function notify(note, deps = {}) {
  const gate = notifyEnabled(deps);
  if (!gate.enabled) return { sent: false, reason: gate.reason };
  const exec = typeof deps.exec === "function" ? deps.exec : defaultExec;
  try {
    const result = await exec(OSASCRIPT, ["-e", notificationScript(note ?? {})], { timeout: deps.timeoutMs ?? SPAWN_TIMEOUT_MS });
    const code = exitCodeOf(result);
    return code === 0 ? { sent: true, reason: null } : { sent: false, reason: `osascript_exit_${code}` };
  } catch (error) {
    return { sent: false, reason: `exec_failed: ${error?.message ?? String(error)}` };
  }
}

/**
 * Notify the owner of an engine event with its Spanish template.
 * @param {keyof typeof NOTIFY_TEMPLATES} event `takeover|waiting-gate|paused-quota|paused-infra|waiting-owner|deadlock|stop|done|engine-failure`
 * @param {{project: string, kind?: string, resets?: string}} data
 * @param {object} [deps] as `notify`
 * @returns {Promise<{sent: boolean, reason: string|null, title?: string, message?: string}>}
 */
export async function notifyOwner(event, data = {}, deps = {}) {
  const template = NOTIFY_TEMPLATES[event];
  if (!template) return { sent: false, reason: `unknown_event: ${event}` };
  const note = template({ ...data, name: data.project ? path.basename(String(data.project)) : "el proyecto" });
  const result = await notify(note, deps);
  return { ...result, ...note };
}
