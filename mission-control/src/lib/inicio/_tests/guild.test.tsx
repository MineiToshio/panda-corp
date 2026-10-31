import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GuildSection, TurnSection } from "@/app/(dashboard)/_components/HomeSections";
import { inicioGuild } from "../guild";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "inicio-guild-"));
  fs.mkdirSync(path.join(root, "factory"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  vi.stubEnv("PANDACORP_EVENTS_FILE", path.join(root, "events.ndjson"));
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", "");
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(path.join(root, "events.ndjson"), { force: true });
  fs.rmSync(path.join(root, "factory/gamification-ledger.json"), { force: true });
  fs.rmdirSync(path.join(root, "factory"));
  fs.rmdirSync(root);
});
it("REQ-18-004: missing optional sources are empty; a corrupt guild ledger is never presented as zero", () => {
  expect(inicioGuild().level.xp).toBe(0);
  fs.writeFileSync(path.join(root, "factory/gamification-ledger.json"), "{broken");
  expect(() => inicioGuild()).toThrow("Guild ledger is unreadable");
});
it("REQ-18-004: unreadable events degrade the guild card while the owner queue still renders", async () => {
  vi.stubEnv("PANDACORP_EVENTS_FILE", root);
  expect(() => inicioGuild()).toThrow("Event source is not a file");
  render(
    <>
      {await GuildSection()}
      {await TurnSection()}
    </>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Gremio · No se pudo leer");
  expect(screen.getByRole("heading", { name: "Tu turno" })).toBeVisible();
  expect(screen.getByText("Al día")).toBeVisible();
});
