import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => vi.fn());
vi.mock("../overview", () => ({ getProjectOverview: read }));
vi.mock("@/lib/config/config", () => ({ resolveFactoryRoot: () => "/fixture" }));

beforeEach(() => {
  vi.resetModules();
  read.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("sidebar overview cache", () => {
  it("defers git-backed reads and shares the pending result across requests until TTL expires", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100);
    const { getSidebarProjects } = await import("../sidebarProjects");
    const rows: never[] = [];
    read.mockReturnValue(rows);
    const first = getSidebarProjects();
    expect(read).not.toHaveBeenCalled();
    expect(getSidebarProjects()).toBe(first);
    expect(await first).toBe(rows);
    clock.mockReturnValue(5099);
    expect(await getSidebarProjects()).toBe(rows);
    expect(read).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(5100);
    await getSidebarProjects();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("a rejected read is evicted so a later request can recover", async () => {
    const { getSidebarProjects } = await import("../sidebarProjects");
    read.mockImplementationOnce(() => {
      throw new Error("unreadable");
    });
    await expect(getSidebarProjects()).rejects.toThrow("unreadable");
    read.mockReturnValue([]);
    await expect(getSidebarProjects()).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
