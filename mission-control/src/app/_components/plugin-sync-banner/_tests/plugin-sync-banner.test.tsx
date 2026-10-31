import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";
import { PluginSyncBanner } from "../plugin-sync-banner";

const behind: PluginSyncState = {
  installedVersion: "9.1.0",
  sourceVersion: "9.2.0",
  drift: true,
  reason: "behind",
  detail: "",
};
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function poll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}
it("AC-15-002.1 AC-15-004.1: behind shows both versions, two steps and the exact copyable command", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => behind }));
  render(<PluginSyncBanner />);
  await poll();
  expect(screen.getByRole("alert")).toHaveTextContent("9.1.0");
  expect(screen.getByRole("alert")).toHaveTextContent("9.2.0");
  expect(
    screen.getByText("1) Corre el comando · 2) Reinicia la sesión de Claude Code."),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Copiar claude plugin update pandacorp@panda-corp" }),
  ).toBeVisible();
});
it.each([
  "in-sync",
  "unknown",
] as const)("AC-15-002.2 AC-15-002.3: %s renders nothing and clears a prior warning", async (reason) => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => behind })
    .mockResolvedValue({ ok: true, json: async () => ({ ...behind, drift: false, reason }) });
  vi.stubGlobal("fetch", fetcher);
  render(<PluginSyncBanner />);
  await poll();
  expect(screen.getByRole("alert")).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("AC-15-002.1: a transport failure preserves the last confirmed warning; requests have a bounded lifetime", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => behind })
    .mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetcher);
  render(<PluginSyncBanner />);
  await poll();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(screen.getByRole("alert")).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/plugin-sync",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
