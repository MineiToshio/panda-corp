import { homedir } from "node:os";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

const MAX_ROLLOUT_BYTES = 16 * 1024 * 1024;
const MAX_DIAGNOSTIC_CHARS = 1200;

function eventTime(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeResetAt(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
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

function userPromptMatches(event, prompt, startedAtMs) {
  if (eventTime(event?.timestamp) < startedAtMs) return false;
  const payload = event?.type === "response_item" ? event.payload : null;
  if (payload?.type !== "message" || payload.role !== "user" || !Array.isArray(payload.content)) return false;
  return payload.content.some((item) => item?.type === "input_text" && item.text === prompt);
}

function latestRateLimit(events, startedAtMs) {
  let latest = null;
  for (const event of events) {
    const at = eventTime(event?.timestamp);
    const payload = event?.type === "event_msg" ? event.payload : null;
    if (at === null || at < startedAtMs || payload?.type !== "token_count" || !payload.rate_limits) continue;
    if (!latest || at >= latest.at) latest = { at, rateLimits: payload.rate_limits };
  }
  return latest?.rateLimits || null;
}

async function inspectRollout(file, { projectReal, prompt, startedAtMs, sessionsReal }) {
  const [entry, actual, metadata] = await Promise.all([lstat(file), realpath(file), stat(file)]).catch(() => []);
  if (!entry?.isFile() || entry.isSymbolicLink() || !actual || (actual !== sessionsReal && !actual.startsWith(`${sessionsReal}${path.sep}`))) return null;
  if (metadata.mtimeMs < startedAtMs || metadata.size > MAX_ROLLOUT_BYTES) return null;
  const body = await readFile(actual, "utf8").catch(() => "");
  const events = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { return null; }
  }
  const metas = events.filter((event) => event?.type === "session_meta");
  if (metas.length !== 1 || eventTime(metas[0].timestamp) < startedAtMs || metas[0].payload?.source !== "exec") return null;
  const cwd = metas[0].payload?.cwd;
  if (typeof cwd !== "string" || await realpath(cwd).catch(() => "") !== projectReal) return null;
  if (!events.some((event) => userPromptMatches(event, prompt, startedAtMs))) return null;
  const rateLimits = latestRateLimit(events, startedAtMs);
  const usedPercent = Number(rateLimits?.primary?.used_percent);
  const reachedType = rateLimits?.rate_limit_reached_type;
  const reached = typeof reachedType === "string" && reachedType.trim() !== "";
  if (!reached && (!Number.isFinite(usedPercent) || usedPercent < 100)) return { usageLimit: false, resetAt: null };
  return { usageLimit: true, resetAt: safeResetAt(rateLimits?.primary?.resets_at ?? rateLimits?.primary?.reset_at) };
}

export async function diagnoseUsageLimitFromRollouts({ codexHome = process.env.CODEX_HOME || path.join(homedir(), ".codex"), projectReal, prompt, startedAtMs }) {
  if (!Number.isFinite(startedAtMs) || typeof prompt !== "string" || !prompt || typeof projectReal !== "string") return null;
  const sessions = path.join(codexHome, "sessions");
  const sessionsEntry = await lstat(sessions).catch(() => null);
  if (!sessionsEntry?.isDirectory() || sessionsEntry.isSymbolicLink()) return null;
  const sessionsReal = await realpath(sessions).catch(() => "");
  if (!sessionsReal) return null;
  const matches = [];
  for (const file of await rolloutFiles(sessionsReal)) {
    const match = await inspectRollout(file, { projectReal, prompt, startedAtMs, sessionsReal });
    if (match) matches.push(match);
  }
  if (matches.length !== 1 || !matches[0].usageLimit) return null;
  return { errorClass: "usage_limit", resetAt: matches[0].resetAt };
}

export function sanitizedDiagnosticTail({ out = "", err = "", prompt = "" }) {
  let value = `${out}\n${err}`.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  if (prompt) value = value.split(prompt).join("[REDACTED_PROMPT]");
  value = value
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+)\b/g, "[REDACTED]")
    .replace(/\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)[A-Z0-9_]*\s*[=:]\s*([^\s,;]+)/g, "[REDACTED_SECRET]")
    .trim();
  return value ? value.slice(-MAX_DIAGNOSTIC_CHARS) : null;
}
