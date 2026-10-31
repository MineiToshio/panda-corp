import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventSourceHealth } from "../eventSourceHealth";

/** Reviewer-authored (DR-080): the usage probe against real transport files. */
let home: string;
const claude = () => path.join(home, ".claude/dashboard-events.ndjson");
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "mc-usage-gate-"));
  fs.mkdirSync(path.join(home, ".claude"));
  fs.writeFileSync(claude(), '{"event":"BuildComplete","at":"2026-10-20T00:00:00Z"}\n');
  vi.stubEnv("HOME", home);
  vi.stubEnv("PANDACORP_EVENTS_FILE", "");
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

it("AC-10-022.3: an absent optional Codex transport beside a readable Claude stream is healthy", () => {
  expect(eventSourceHealth()).toEqual({ ok: true });
});

it("AC-10-022.3: the Claude stream itself being absent still fails loud", () => {
  fs.rmSync(claude());
  expect(eventSourceHealth()).toMatchObject({ ok: false, kind: "missing", source: claude() });
});

it.each([
  ["a primitive", "42"],
  ["an array", "[1]"],
  ["an object without event and at", '{"unknown":"shape"}'],
])("FRD-10 honesty: %s parses as JSON but is an unrecognised shape and fails loud", (_name, line) => {
  fs.appendFileSync(claude(), `${line}\n`);
  expect(eventSourceHealth()).toMatchObject({ ok: false, source: claude(), line: 2 });
});
