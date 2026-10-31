import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFraguaScene } from "../scene-data";

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fragua-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".pandacorp"));
  fs.mkdirSync(path.join(root, "docs/frds/frd-06-party/work-orders"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs/frds/frd-06-party/work-orders/wo-06-001.md"),
    "---\nid: WO-06-001\nimplementation_status: BLOCKED\n---\n# A blocked order\n",
  );
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  return root;
}
describe("real scene sources", () => {
  it("AC-06-011.1 AC-06-011.2 AC-06-011.3: project events before cap, FRD-level and malformed noise cannot create tokens", () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, ".pandacorp/status.yaml"),
      "project: demo\nphase: implementation\nrunning: true\n",
    );
    const file = path.join(root, "events.ndjson");
    const own = {
      event: "AgentWorking",
      at: "2026-10-30T11:59:00Z",
      project: path.basename(root),
      data: { wo: "frd-06-party", frd: "", role: "frontend-dev" },
    };
    fs.writeFileSync(
      file,
      [
        JSON.stringify(own),
        "bad JSON",
        ...Array.from({ length: 250 }, () =>
          JSON.stringify({ ...own, project: "foreign", at: "2026-10-30T12:00:00Z" }),
        ),
      ].join("\n"),
    );
    vi.stubEnv("PANDACORP_EVENTS_FILE", file);
    vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", path.join(root, "no-codex"));
    const data = loadFraguaScene({ slug: "demo", name: "Demo", path: root });
    expect(data.orders).toHaveLength(1);
    expect(data.stations.map((station) => station.count)).toEqual([0, 1, 0, 0]);
    expect(data.signal.kind).toBe("live");
    expect(data.signal.ageMinutes).toBe(1);
  });
  it("AC-06-013.1 AC-06-013.4: malformed status yields idle even with recent events", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, ".pandacorp/status.yaml"), "running: [bad");
    const data = loadFraguaScene({ slug: "demo", name: "Demo", path: root });
    expect(data.signal.kind).toBe("idle");
  });
});
