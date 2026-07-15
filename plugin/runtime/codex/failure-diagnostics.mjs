import { homedir } from "node:os";
import { lstat, open, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

const MAX_META_BYTES = 64 * 1024;
const MAX_ROLLOUT_BYTES = 16 * 1024 * 1024;
const MAX_RESET_WINDOW_SECONDS = 31 * 24 * 60 * 60;

function eventTime(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeResetAt(value, startedAtMs) {
  const parsed = Number(value);
  const startSeconds = Math.floor(startedAtMs / 1000);
  return Number.isSafeInteger(parsed) && parsed >= startSeconds && parsed <= startSeconds + MAX_RESET_WINDOW_SECONDS ? parsed : null;
}

async function rolloutFiles(root, depth = 0) {
  if (depth > 4) return [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await rolloutFiles(absolute, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(absolute);
  }
  return files;
}

async function firstLine(file) {
  const handle = await open(file, "r").catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(MAX_META_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    const newline = prefix.indexOf("\n");
    if (newline < 0 && bytesRead === MAX_META_BYTES) return null;
    return prefix.slice(0, newline < 0 ? prefix.length : newline);
  } finally { await handle.close(); }
}

async function preflightMeta(file, { projectReal, startedAtMs, sessionsReal }) {
  const [entry, actual, metadata] = await Promise.all([lstat(file), realpath(file), stat(file)]).catch(() => []);
  if (!entry?.isFile() || entry.isSymbolicLink() || !actual || (actual !== sessionsReal && !actual.startsWith(`${sessionsReal}${path.sep}`))) return null;
  if (metadata.mtimeMs < startedAtMs || metadata.size > MAX_ROLLOUT_BYTES) return null;
  let meta; try { meta = JSON.parse(await firstLine(actual)); } catch { return null; }
  if (meta?.type !== "session_meta" || eventTime(meta.timestamp) < startedAtMs || meta.payload?.source !== "exec") return null;
  const cwd = meta.payload?.cwd;
  if (typeof cwd !== "string" || await realpath(cwd).catch(() => "") !== projectReal) return null;
  return actual;
}

function promptEventTime(event, prompt, startedAtMs) {
  const at = eventTime(event?.timestamp);
  if (at === null || at < startedAtMs) return null;
  const payload = event?.type === "response_item" ? event.payload : null;
  if (payload?.type !== "message" || payload.role !== "user" || !Array.isArray(payload.content)) return null;
  return payload.content.some((item) => item?.type === "input_text" && item.text === prompt) ? at : null;
}

function failedTerminalEvidence(events, promptAt, startedAtMs) {
  const hasAgentMessage = events.some((event) => {
    if (eventTime(event?.timestamp) < startedAtMs) return false;
    return (event.type === "event_msg" && event.payload?.type === "agent_message") || (event.type === "response_item" && event.payload?.type === "message" && event.payload.role === "assistant");
  });
  if (hasAgentMessage) return null;
  const completions = events.filter((event) => event?.type === "event_msg" && event.payload?.type === "task_complete" && eventTime(event.timestamp) >= promptAt);
  if (completions.length !== 1) return null;
  const payload = completions[0].payload;
  return !Object.hasOwn(payload, "last_agent_message") || payload.last_agent_message === null ? eventTime(completions[0].timestamp) : null;
}

function latestRateLimit(events, promptAt, terminalAt) {
  let latest = null;
  for (const event of events) {
    const at = eventTime(event?.timestamp);
    const payload = event?.type === "event_msg" ? event.payload : null;
    if (at === null || at < promptAt || at > terminalAt || payload?.type !== "token_count" || !payload.rate_limits) continue;
    if (!latest || at >= latest.at) latest = { at, rateLimits: payload.rate_limits };
  }
  return latest?.rateLimits || null;
}

async function inspectRollout(file, context) {
  const actual = await preflightMeta(file, context);
  if (!actual) return null;
  const body = await context.readBody(actual, "utf8").catch(() => "");
  const events = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { return null; }
  }
  const promptTimes = events.map((event) => promptEventTime(event, context.prompt, context.startedAtMs)).filter((at) => at !== null);
  if (promptTimes.length !== 1) return null;
  const terminalAt = failedTerminalEvidence(events, promptTimes[0], context.startedAtMs);
  if (terminalAt === null) return null;
  const rateLimits = latestRateLimit(events, promptTimes[0], terminalAt);
  const usedPercent = Number(rateLimits?.primary?.used_percent);
  const reachedType = rateLimits?.rate_limit_reached_type;
  const reached = typeof reachedType === "string" && reachedType.trim() !== "";
  if (!reached && (!Number.isFinite(usedPercent) || usedPercent < 100)) return { usageLimit: false, resetAt: null };
  return { usageLimit: true, resetAt: safeResetAt(rateLimits?.primary?.resets_at ?? rateLimits?.primary?.reset_at, context.startedAtMs) };
}

export async function diagnoseUsageLimitFromRollouts({ codexHome = process.env.CODEX_HOME || path.join(homedir(), ".codex"), projectReal, prompt, startedAtMs, dispatchFailed = false, readBody = readFile }) {
  if (!dispatchFailed || !Number.isFinite(startedAtMs) || typeof prompt !== "string" || !prompt || typeof projectReal !== "string" || typeof readBody !== "function") return null;
  const sessions = path.join(codexHome, "sessions");
  const sessionsEntry = await lstat(sessions).catch(() => null);
  if (!sessionsEntry?.isDirectory() || sessionsEntry.isSymbolicLink()) return null;
  const sessionsReal = await realpath(sessions).catch(() => "");
  if (!sessionsReal) return null;
  const matches = [];
  for (const file of await rolloutFiles(sessionsReal)) {
    const match = await inspectRollout(file, { projectReal, prompt, startedAtMs, sessionsReal, readBody });
    if (match) matches.push(match);
  }
  if (matches.length !== 1 || !matches[0].usageLimit) return null;
  return { errorClass: "usage_limit", resetAt: matches[0].resetAt };
}
