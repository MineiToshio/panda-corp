// --wait: early return on a report/review/answer file, a job or worker exit, a journal append, handoff.json.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { isLive } from "./context.mjs";

export function watchList(run, state) {
  const { paths } = run;
  const list = [paths.journalFile, paths.handoffFile];
  for (const u of state.units.filter(isLive)) {
    list.push(paths.reportFile(u.id), paths.reviewFile(u.id), paths.unitAnswerFile(u.id), paths.unitDoubtFile(u.id));
  }
  for (const j of state.jobs.filter((x) => x.state === "running")) {
    list.push(j.kind === "worker" && j.worker_id ? path.join(paths.codexWorkerDir(j.worker_id), "exit") : paths.jobExitFile(j.id));
  }
  return list;
}

async function signature(list, fs) {
  const out = [];
  for (const file of list) {
    try { const st = await fs.stat(file); out.push(`${st.mtimeMs}:${st.size}`); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      out.push("-");
    }
  }
  return out.join("|");
}

export async function waitForChange(run, list, deadline) {
  const { d } = run;
  const fs = d.fs ?? fsp;
  const before = await signature(list, fs);
  while (d.monotonic() < deadline) {
    await d.sleep(Math.max(1, Math.min(d.pollMs, deadline - d.monotonic())));
    if (await signature(list, fs) !== before) return true;
  }
  return false;
}
