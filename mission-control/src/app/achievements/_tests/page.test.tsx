import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

let root: string | undefined;
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  if (root) fs.rmSync(root, { recursive: true, force: true });
});
it("AC-10-028.1 renders an empty factory honestly and preserves the statistics adapter's report", async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "hall-page-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  vi.stubEnv("PANDACORP_EVENTS_FILE", path.join(root, "claude.ndjson"));
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", path.join(root, "codex.ndjson"));
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  vi.resetModules();
  window.history.replaceState(null, "", "/achievements");
  const { default: HallPage } = await import("../page");
  const page = await HallPage();
  render(page);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Logros" })).toBeInTheDocument();
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
  expect(screen.getByText("Aún no hay trofeos.")).toBeInTheDocument();
  expect(screen.getByText("0 XP · 10 para el nivel 2")).toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  fireEvent.click(screen.getByRole("tab", { name: "Estadísticas" }));
  expect(screen.getByTestId("stats-panel")).toBeInTheDocument();
  expect(screen.getAllByTestId("stat-ledger-column")).toHaveLength(3);
  expect(screen.getAllByTestId("hero-stat")).toHaveLength(6);
});
