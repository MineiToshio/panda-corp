import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page, Response } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";
import { refreshFromProjectChange } from "../../../../e2e/_live-refresh";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "live-harness-"));
  roots.push(root);
  const file = path.join(root, "order.md");
  fs.writeFileSync(file, "---\nstatus: PLANNED\n---\n");
  return file;
}
it("waits for an SSE baseline and arms the RSC listener before changing the real fixture", async () => {
  const file = fixture();
  const original = fs.statSync(file).mtime.getTime();
  let baselineReady: () => void = () => {};
  let respond: (r: Response) => void = () => {};
  let accepts: ((r: Response) => boolean) | undefined;
  const waitForResponse = vi.fn((predicate: (r: Response) => boolean) => {
    expect(fs.statSync(file).mtime.getTime()).toBe(original);
    accepts = predicate;
    return new Promise<Response>((resolve) => {
      respond = resolve;
    });
  });
  const page = {
    url: () => "http://localhost/portfolio/mission-control/observability?dag=wo&focus=WO-01-003",
    waitForFunction: () =>
      new Promise<void>((resolve) => {
        baselineReady = resolve;
      }),
    waitForResponse,
    evaluate: async () => [],
  } as unknown as Page;
  const run = refreshFromProjectChange(page, file, "mission-control");
  expect(fs.statSync(file).mtime.getTime()).toBe(original);
  expect(waitForResponse).not.toHaveBeenCalled();
  baselineReady();
  await vi.waitFor(() => expect(waitForResponse).toHaveBeenCalledOnce());
  expect(fs.statSync(file).mtime.getTime()).toBeGreaterThan(original);
  const response = (headers: Record<string, string>, startTime = Date.now()) =>
    ({
      url: page.url,
      ok: () => true,
      request: () => ({ headers: () => headers, timing: () => ({ startTime }) }),
    }) as unknown as Response;
  expect(accepts?.(response({ rsc: "1" }, 0))).toBe(false);
  expect(accepts?.(response({ rsc: "1", "next-router-prefetch": "1" }))).toBe(false);
  const refreshed = response({ rsc: "1" });
  expect(accepts?.(refreshed)).toBe(true);
  respond(refreshed);
  await run;
  expect(fs.statSync(file).mtime.getTime()).toBe(original);
});
it("restores the fixture and rejects a missing refresh without an orphan rejection", async () => {
  const file = fixture();
  const original = fs.statSync(file).mtime.getTime();
  const page = {
    url: () => "http://localhost/observability",
    waitForFunction: async () => {},
    evaluate: async () => [],
    waitForResponse: () => Promise.reject(new Error("missing production RSC refresh")),
  } as unknown as Page;
  await expect(refreshFromProjectChange(page, file, "mission-control")).rejects.toThrow(
    "missing production RSC refresh",
  );
  expect(fs.statSync(file).mtime.getTime()).toBe(original);
});
