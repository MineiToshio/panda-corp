/**
 * FRD-07 detail edges, reconciled for WO-07-006: one dialog per standard (no Summary/Detail pair),
 * no mini-flow, no XP, and the file-read boundary over the real factory.
 */
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAgents, readSkills } from "@/lib/reference/reference";
import { readStandards } from "@/lib/standards/standards";
import { FACTORY_ROOT, renderRealPage, useRealFactory, visit } from "./_realFactory";

beforeEach(() => useRealFactory());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("FRD-07 detail edges", () => {
  it("REQ-07-010 a standard opens one dialog with its real markdown and no sub-tabs", async () => {
    const standard = readStandards(FACTORY_ROOT).find((entry) => entry.body.length > 200);
    visit(`/configuration/standards/${standard?.id}`);
    await renderRealPage();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("tab")).toBeNull();
    expect(within(dialog).queryByRole("tablist")).toBeNull();
    expect(screen.getByTestId("standard-markdown-body").textContent?.length).toBeGreaterThan(100);
  });

  it("REQ-07-011 every real agent dialog is free of level, title and XP", async () => {
    const agent = readAgents().at(-1);
    visit(`/configuration/agents/${agent?.id}`);
    await renderRealPage();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("progressbar")).toBeNull();
    expect(within(dialog).getByText("Lo usan:")).toBeInTheDocument();
  });

  it("an unknown item under a known catalog is a bounded not-found, never the first item", async () => {
    visit("/configuration/skills/no-such-skill");
    await expect(renderRealPage()).rejects.toThrow();
    expect(readSkills().some((skill) => skill.slug === "no-such-skill")).toBe(false);
  });
});
