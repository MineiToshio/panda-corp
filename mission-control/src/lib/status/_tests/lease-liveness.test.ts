import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSignal } from "@/lib/fragua/build-signal";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { isLive } from "../liveness";
import { readStatus } from "../status";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true }); });
it("fresh lease keeps a worker live across stale status stamps, and expires at its own TTL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-lease-")); dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".pandacorp/run/build.lease"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".pandacorp/status.yaml"), 'running: true\nsupervisor_heartbeat: "2000-01-01T00:00:00Z"\nlast_green_sha: abc123\n');
  const renewedAt = "2026-10-31T12:00:00Z", nowMs = Date.parse(renewedAt);
  fs.writeFileSync(path.join(dir, ".pandacorp/run/build.lease/lease.json"), JSON.stringify({ renewed_at: renewedAt, ttl_seconds: 30 }));
  const result = readStatus(dir);
  expect(result.present && !result.malformed).toBe(true);
  if (!result.present) throw new Error("status absent");
  const status = result.status;
  expect(status.leaseRenewedAt).toBe(renewedAt);
  expect(isLive(status, nowMs)).toBe(true);
  expect(buildSignal({ ...status, nowMs })).toMatchObject({ kind: "live", lastSignalAt: renewedAt });
  expect(buildSnapshot("fixture", status, nowMs)).toMatchObject({ buildingNow: "building now" });
  expect(isLive(status, nowMs + 30_000)).toBe(false);
  expect(buildSignal({ ...status, nowMs: nowMs + 30_000 }).kind).toBe("no-signal");
  expect(buildSnapshot("fixture", status, nowMs + 30_000)).toMatchObject({ noSignal: true });
});
it("malformed lease is explicit rather than silently treated as absent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-lease-")); dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".pandacorp/run/build.lease"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".pandacorp/status.yaml"), "running: true\n");
  fs.writeFileSync(path.join(dir, ".pandacorp/run/build.lease/lease.json"), "{}");
  expect(readStatus(dir)).toMatchObject({ present: true, malformed: true });
});

it("lease TTL above ten minutes remains authoritative until its own expiry", () => {
  const renewedAt = "2026-10-31T12:00:00Z";
  const input = { running: true, leaseRenewedAt: renewedAt, leaseTtlSeconds: 1200 };
  const nowMs = Date.parse(renewedAt) + 700_000;
  expect(isLive(input, nowMs)).toBe(true);
  expect(buildSignal({ ...input, nowMs }).kind).toBe("live");
  expect(buildSignal({ ...input, nowMs: Date.parse(renewedAt) + 1200_000 }).kind).toBe("no-signal");
});
