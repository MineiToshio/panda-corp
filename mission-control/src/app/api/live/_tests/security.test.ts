import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { __resetLiveEventStoresForTest, GET } from "../route";

const connections: AbortController[] = [];
let file: string | undefined;
afterEach(() => {
  for (const controller of connections.splice(0)) controller.abort();
  __resetLiveEventStoresForTest();
  if (file) fs.unlinkSync(file);
  vi.unstubAllEnvs();
});
function connect(): Response {
  const controller = new AbortController();
  connections.push(controller);
  return GET(new Request("http://localhost/api/live", { signal: controller.signal }));
}
it("limits simultaneous streams, returns problem+json and releases slots on abort/cancel", async () => {
  for (let i = 0; i < 20; i++) expect(connect().status).toBe(200);
  const rejected = connect();
  expect(rejected.status).toBe(429);
  expect(rejected.headers.get("content-type")).toContain("application/problem+json");
  expect(await rejected.json()).toMatchObject({ status: 429, instance: "/api/live" });
  connections[0]?.abort();
  const accepted = connect();
  expect(accepted.status).toBe(200);
  await accepted.body?.cancel();
  expect(connect().status).toBe(200);
});
it("does not send unused private session and agent identifiers in the real NDJSON frame", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sse-security-"));
  file = path.join(root, "events.ndjson");
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      event: "AgentWorking",
      at: "2026-10-31T12:00:00Z",
      session: "private-session",
      agent: "private-agent",
      session_id: "raw-session",
      agent_id: "raw-agent",
    })}\n`,
  );
  vi.stubEnv("PANDACORP_EVENTS_FILE", file);
  const response = connect();
  const chunk = await response.body?.getReader().read();
  const text = new TextDecoder().decode(chunk?.value);
  expect(text).toContain("AgentWorking");
  expect(text).not.toMatch(/private-session|private-agent|raw-session|raw-agent/);
});
