// preflight/machine.mjs: disk, memory and power checks of this Mac (groups `access` and `mac`).
import { readSignals as realReadSignals } from "../admission.mjs";
import { clip, mk, TOOL_TIMEOUT_MS } from "./common.mjs";

const DISK_WARN_BYTES = 5 * 1024 ** 3;
const DISK_FAIL_BYTES = 1024 ** 3;

export async function diskCheck({ project, ctx, deps }) {
  const statfs = deps.statfs ?? ((dir) => ctx.fs.statfs(dir));
  const s = await statfs(project);
  const free = Number(s.bavail) * Number(s.bsize);
  const gib = (free / 1024 ** 3).toFixed(1);
  if (free < DISK_FAIL_BYTES) return { check: mk("access", "access.disk", "fail", `Quedan ${gib} GiB libres: el build puede fallar. Libera espacio.`) };
  if (free < DISK_WARN_BYTES) return { check: mk("access", "access.disk", "warn", `Quedan ${gib} GiB libres: libera espacio si puedes.`) };
  return { check: mk("access", "access.disk", "pass", `Hay ${gib} GiB libres en el disco.`) };
}

export async function ramCheck({ ctx, deps, run }) {
  const readSignals = deps.readSignals ?? realReadSignals;
  const signalsFile = ctx.env.PANDACORP_SIGNALS_FILE || null;
  const exec = async (file, args) => {
    const r = await run(file, args, { timeout: TOOL_TIMEOUT_MS });
    if (r.code !== 0) throw new Error(r.error || `${file} salió con ${r.code}`);
    return r.stdout;
  };
  let s;
  try {
    s = await readSignals({ exec, signalsFile });
  } catch (error) {
    return { check: mk("access", "access.ram", "fail", `No pude leer la memoria (${clip(error?.message ?? error, 80)}): arranco en modo seguro, una pieza a la vez.`), unreadable: true };
  }
  if (s.L >= 4) return { check: mk("access", "access.ram", "warn", "Presión de memoria crítica: el build esperará a que baje.") };
  return { check: mk("access", "access.ram", "pass", `Memoria libre ${Number(s.A_gib).toFixed(1)} GiB, presión ${s.L}.`) };
}

// --------------------------------------------------------------------------------------------------- mac checks

export async function powerCheck({ project, deps, run }) {
  if ((deps.platform ?? process.platform) !== "darwin") return { check: mk("mac", "mac.power", "pass", "La alimentación no se comprueba fuera de macOS.") };
  const r = await run("pmset", ["-g", "batt"], { cwd: project, timeout: TOOL_TIMEOUT_MS });
  if (r.code !== 0) throw new Error(r.error || "pmset falló");
  if (/Battery Power/i.test(r.stdout)) return { check: mk("mac", "mac.power", "warn", "El Mac va con batería: enchúfalo para que el build no se corte.") };
  return { check: mk("mac", "mac.power", "pass", "El Mac está enchufado.") };
}
