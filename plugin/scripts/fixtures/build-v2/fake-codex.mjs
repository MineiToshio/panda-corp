#!/usr/bin/env node
// fake-codex.mjs — stand-in for the `codex` binary (PANDACORP_CODEX_BIN). Offline, deterministic.
//   login status            -> "Logged in using ChatGPT" exit 0 (PANDACORP_FAKE_CODEX_LOGIN=out -> exit 1)
//   debug models            -> {"models":[{"slug":...}]} (the four catalog slugs; PANDACORP_FAKE_CODEX_MODELS=a,b overrides)
//   exec ... -o <file> -    -> reads the prompt on stdin, prints JSONL events, writes the final message to <file>
//                              and a rollout tail under $CODEX_HOME/sessions/YYYY/MM/DD/ (token_count at
//                              PANDACORP_FAKE_CODEX_PCT, default 36). Final message = the file PANDACORP_FAKE_CODEX_REPORT
//                              when set, else a minimal {"status":"done"} JSON.
// PANDACORP_FAKE_CODEX_MODE: ok (default) | limit (stderr "usage limit reached", exit 1) | rate (429, exit 1) |
//   fail (exit 2) | hang (sleeps until killed). PANDACORP_FAKE_CODEX_LOG: append one JSON line {argv, stdin} per call.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const env = process.env;
const argv = process.argv.slice(2);
const mode = env.PANDACORP_FAKE_CODEX_MODE || "ok";
const now = new Date(env.PANDACORP_NOW || "2026-11-11T12:00:00.000Z");
const stdin = () => { try { return readFileSync(0, "utf8"); } catch { return ""; } };
const log = (extra) => { if (env.PANDACORP_FAKE_CODEX_LOG) appendFileSync(env.PANDACORP_FAKE_CODEX_LOG, `${JSON.stringify({ argv, ...extra })}\n`); };

if (argv[0] === "login" && argv[1] === "status") {
  log({});
  if (env.PANDACORP_FAKE_CODEX_LOGIN === "out") { process.stderr.write("Not logged in\n"); process.exit(1); }
  process.stdout.write("Logged in using ChatGPT\n"); process.exit(0);
} else if (argv[0] === "debug" && argv[1] === "models") {
  log({});
  const slugs = (env.PANDACORP_FAKE_CODEX_MODELS || "gpt-6-luna,gpt-6.1-terra,gpt-6.1-sol,gpt-6-astra").split(",");
  process.stdout.write(`${JSON.stringify({ models: slugs.map((slug) => ({ slug })) })}\n`); process.exit(0);
} else if (argv[0] === "exec") {
  const input = stdin();
  log({ stdin: input.slice(0, 2000) });
  if (mode === "hang") setInterval(() => {}, 1 << 30);
  else {
    const out = argv[argv.indexOf("-o") + 1];
    const pct = Number(env.PANDACORP_FAKE_CODEX_PCT || 36);
    const home = env.CODEX_HOME || path.join(os.tmpdir(), "fake-codex-home");
    const dir = path.join(home, "sessions", String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), String(now.getUTCDate()).padStart(2, "0"));
    mkdirSync(dir, { recursive: true });
    const ts = now.toISOString();
    const rl = { primary: { used_percent: pct, window_minutes: 300, resets_at: Math.floor(now.getTime() / 1000) + 7200 }, secondary: { used_percent: 12, window_minutes: 10080, resets_at: Math.floor(now.getTime() / 1000) + 5 * 86400 }, credits: null, plan_type: "plus" };
    appendFileSync(path.join(dir, "rollout-fake-codex.jsonl"), `${JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "token_count", info: null, rate_limits: rl } })}\n`);
    process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "fake" })}\n${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10, output_tokens: 5 } })}\n`);
    if (mode === "limit" || mode === "rate") { process.stderr.write(mode === "limit" ? "ERROR: You've hit your usage limit. Try again at 3:00 PM.\n" : "ERROR: 429 Too Many Requests (rate limit)\n"); process.exit(1); }
    if (mode === "fail") { process.stderr.write("ERROR: fake codex failure\n"); process.exit(2); }
    const report = env.PANDACORP_FAKE_CODEX_REPORT && existsSync(env.PANDACORP_FAKE_CODEX_REPORT) ? readFileSync(env.PANDACORP_FAKE_CODEX_REPORT, "utf8") : JSON.stringify({ status: "done", summary: "fake codex" });
    if (out) writeFileSync(out, report);
    process.exit(0);
  }
} else { process.stderr.write(`fake-codex: unsupported argv ${argv.join(" ")}\n`); process.exit(64); }
