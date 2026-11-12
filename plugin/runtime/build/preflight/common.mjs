// preflight/common.mjs: check and question builders, bounded runners and small readers shared by the preflight modules.
import { execFile } from "node:child_process";
import net from "node:net";

export const CODEX_LOGIN_TIMEOUT_MS = 15_000;
export const CODEX_PROBE_TIMEOUT_MS = 40_000;
export const TOOL_TIMEOUT_MS = 5_000;
const CHECK_TIMEOUT_MS = 25_000;

export const fail = (code, message) => Object.assign(new Error(message), { code });
export const asArray = (value) => (Array.isArray(value) ? value : []);
export const clip = (text, max = 90) => {
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 3).trimEnd()}...` : one;
};
export const unique = (list) => [...new Set(list)];

/** A check entry (`checks[]` of the output). */
export const mk = (group, id, status, detail_es, question) => ({ group, id, status, detail_es, ...(question ? { question } : {}) });
/** A question (D19): `{id, text_es, default_es, default_action, affects, reversible}` with `id = q-<check id>`. */
export const ask = (checkId, text_es, default_es, default_action, affects, reversible) => ({
  id: `q-${checkId}`, text_es, default_es, default_action, affects, reversible,
});
export const affectsFrds = (frds) => (frds.length > 0 ? { frds } : { all: true });

/** Default `exec`: no shell, never rejects, and the child sees the injected `env` (the test hooks reach fake binaries). */
export function execIn(env) {
  return (file, args, opts = {}) => new Promise((resolve) => {
    execFile(file, args, { encoding: "utf8", cwd: opts.cwd, timeout: opts.timeout, env, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === "number" ? error.code : null) : 0,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? String(error.message || error).split("\n")[0] : "",
      });
    });
  });
}

export function makeRunner(exec) {
  return async (file, args, { cwd, timeout = TOOL_TIMEOUT_MS } = {}) => {
    try {
      const r = (await exec(file, args, { cwd, timeout, timeoutMs: timeout })) ?? {};
      const code = r.code ?? r.status;
      return { code: typeof code === "number" ? code : null, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""), error: r.error ? String(r.error) : "" };
    } catch (error) {
      return { code: null, stdout: "", stderr: "", error: String(error?.message ?? error) };
    }
  };
}

/** Runs one async check with a time cap; a throw or a timeout becomes a conservative `fail` entry. */
export async function guarded(group, id, unevaluated, work, timeoutMs = CHECK_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("tiempo agotado")), timeoutMs); }),
    ]);
  } catch (error) {
    unevaluated.push(id);
    return { check: mk(group, id, "fail", `No pude evaluarlo (${clip(error?.message ?? error, 120)}). Sigo por el camino conservador.`) };
  } finally {
    clearTimeout(timer);
  }
}

export async function readText(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (error) { if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null; throw error; }
}

export function parseDotenv(text) {
  const out = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

export function connectsTo(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
