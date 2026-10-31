import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventSourceHealth } from "../eventSourceHealth";
import { readEvents } from "../events";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-source-health-"));
  vi.stubEnv("PANDACORP_EVENTS_FILE", path.join(root, "claude.ndjson"));
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", path.join(root, "codex.ndjson"));
  fs.writeFileSync(path.join(root, "claude.ndjson"), "");
  fs.writeFileSync(path.join(root, "codex.ndjson"), "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

it("AC-10-022.1 AC-10-022.2: readable empty transports are honest empty usage", () => {
  expect(eventSourceHealth()).toEqual({ ok: true });
});
it.each([
  "claude",
  "codex",
])("AC-10-022.3: %s malformed source is explicit, while the events reader still skips it", (source) => {
  const file = path.join(root, `${source}.ndjson`);
  fs.writeFileSync(
    file,
    '{"event":"BuildComplete","at":"2026-10-20T00:00:00Z"}\n\nsecret bad line\n',
  );
  expect(eventSourceHealth()).toEqual({ ok: false, kind: "invalid-json", source: file, line: 3 });
  expect(readEvents({ path: file }).events).toHaveLength(1);
});
it("AC-10-022.3: an unreadable primary source is distinct from a readable empty file", () => {
  const file = path.join(root, "claude.ndjson");
  fs.unlinkSync(file);
  expect(eventSourceHealth()).toEqual({ ok: false, kind: "missing", source: file });
});
it("AC-10-022.3: health scans exactly the bounded tail, excluding the partial first line", () => {
  const file = path.join(root, "codex.ndjson");
  fs.writeFileSync(
    file,
    `invalid before window\n${" ".repeat(2 * 1024 * 1024)}\n{"event":"BuildComplete","at":"2026-10-20T00:00:00Z"}\n`,
  );
  expect(eventSourceHealth()).toEqual({ ok: true });
});

it("AC-10-022.3: the optional transport can be absent beside a readable primary", () => {
  fs.unlinkSync(path.join(root, "codex.ndjson"));
  expect(eventSourceHealth()).toEqual({ ok: true });
});
it("AC-10-022.3: no readable transport fails loud", () => {
  fs.unlinkSync(path.join(root, "claude.ndjson"));
  fs.unlinkSync(path.join(root, "codex.ndjson"));
  expect(eventSourceHealth()).toMatchObject({ ok: false, kind: "missing" });
});
it.each([
  "42",
  "[1]",
  '{"unknown":"shape"}',
])("AC-10-022.3: unrecognised JSON shape %s fails loud", (line) => {
  const file = path.join(root, "claude.ndjson");
  fs.writeFileSync(file, line);
  expect(eventSourceHealth()).toEqual({ ok: false, kind: "invalid-shape", source: file, line: 1 });
});
