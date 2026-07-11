import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const vocabulary = JSON.parse(
  await readFile(new URL("./event-vocabulary.json", import.meta.url), "utf8"),
);
const aliases = new Map();
for (const [semanticName, entry] of Object.entries(vocabulary.events)) {
  aliases.set(semanticName, { semanticName, display: entry.display });
  for (const alias of entry.aliases) aliases.set(alias, { semanticName, display: entry.display });
}

export function normalizeRuntimeEvent(name, data = {}) {
  const semanticInput =
    name === "verify_finished" ? (data.code === 0 ? "test.green" : "test.failed") : name;
  return aliases.get(semanticInput) || { semanticName: `legacy.${name}`, display: name };
}

function defaultTransport(runtime) {
  const envOverride =
    runtime === "codex"
      ? process.env.PANDACORP_CODEX_EVENTS_FILE
      : process.env.PANDACORP_EVENTS_FILE;
  if (envOverride) return envOverride;
  const runtimeHome =
    runtime === "codex"
      ? process.env.CODEX_HOME || path.join(os.homedir(), ".codex")
      : path.join(os.homedir(), ".claude");
  return path.join(runtimeHome, "dashboard-events.ndjson");
}

/** Runtime-local NDJSON emitter; telemetry failures never control the build. */
export function createRuntimeEventEmitter({
  runtime,
  runId,
  project,
  journalFile,
  transportFile = defaultTransport(runtime),
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
}) {
  if (!new Set(["claude", "codex"]).has(runtime)) throw new Error("unsupported event runtime");
  return async (name, data = {}) => {
    const normalized = normalizeRuntimeEvent(name, data);
    const subject =
      data.subject ||
      data.dispatch_id ||
      data.wo ||
      data.frd ||
      data.change_file ||
      data.label ||
      path.basename(project);
    const payload = {
      at: now(),
      runtime,
      run_id: runId,
      event_id: idFactory(),
      event: normalized.display,
      semantic_name: normalized.semanticName,
      project: path.basename(project),
      subject,
      data,
    };
    if (journalFile) {
      await mkdir(path.dirname(journalFile), { recursive: true });
      await appendFile(journalFile, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
    }
    await mkdir(path.dirname(transportFile), { recursive: true })
      .then(() => appendFile(transportFile, `${JSON.stringify(payload)}\n`, { mode: 0o600 }))
      .catch(() => {});
    return payload;
  };
}
