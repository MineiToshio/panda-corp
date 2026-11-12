// preflight/phase.mjs: the launched-project pre-push hook check (group `phase`). It only CHECKS; `start --run` installs.
import { installPrePush as realInstallPrePush } from "../../../scripts/install-pre-push.mjs";
import { ask, clip, mk } from "./common.mjs";

export async function phaseChecks({ project, launched, deps, unevaluated }) {
  const launchedCheck = mk("phase", "phase.launched", "pass", launched ? "Proyecto lanzado: `main` es producción." : "Proyecto no lanzado.");
  if (!launched) {
    return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "El candado de push no aplica: el proyecto no está lanzado.")], prepush: { status: "not_needed", code: null, verified: true, will_install: false } };
  }
  const install = deps.installPrePush ?? realInstallPrePush;
  let installed;
  try {
    installed = await install({ project, check: true });
  } catch (error) {
    unevaluated.push("phase.prepush_missing");
    return {
      checks: [launchedCheck, mk("phase", "phase.prepush_missing", "fail", `No pude comprobar el candado de push (${clip(error?.message ?? error, 100)}).`)],
      prepush: { status: "error", code: null, verified: false, will_install: false },
    };
  }
  // R2: the preflight only CHECKS; `start --run` installs. Exit 1 (missing or stale) is installable at start.
  const verified = installed.code === 0;
  const willInstall = installed.code === 1;
  const prepush = { status: installed.status, code: installed.code, verified, will_install: willInstall };
  if (verified) return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "Candado de push instalado y al día.")], prepush };
  if (willInstall) return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "El candado de push se instala al arrancar el build.")], prepush };
  if (installed.code === 3) {
    return {
      checks: [launchedCheck, mk("phase", "phase.prepush_missing", "ask", "No puedo instalar el candado de push: el proyecto versiona sus hooks de git.", ask(
        "phase.prepush_missing",
        "El proyecto versiona sus hooks de git (core.hooksPath dentro del repo) y no puedo instalar el candado de push sin tocar archivos versionados. En un proyecto lanzado no construyo sin ese candado.",
        "no arranco el build en este proyecto", "do_not_build", { all: true }, true))],
      prepush,
    };
  }
  return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "fail", `El candado de push no quedó verificado (${clip(installed.message, 100)}).`)], prepush };
}
