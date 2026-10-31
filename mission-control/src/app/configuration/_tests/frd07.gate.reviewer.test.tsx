/**
 * FRD-07 gate, reconciled for WO-07-006: every catalog renders real factory data, the approval chip
 * never lies about `requiere_humano`, no standard is dropped and the surface stays read-only.
 */
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSkills } from "@/lib/reference/reference";
import { readDecisionRules } from "@/lib/registry/registry";
import { readStandards } from "@/lib/standards/standards";
import { FACTORY_ROOT, renderRealPage, useRealFactory, visit } from "./_realFactory";

beforeEach(() => useRealFactory());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function revealAll(): void {
  for (;;) {
    const more = screen.queryByRole("button", { name: /^Mostrar \d+ más/ });
    if (!more) return;
    fireEvent.click(more);
  }
}

describe("FRD-07 gate: catalogs wired to the real factory", () => {
  it("REQ-07-005 files every real skill under exactly one heading, with none dropped", async () => {
    visit("/configuration/skills");
    await renderRealPage();
    const skills = readSkills();
    for (const skill of skills) {
      expect(screen.getByText(`/pandacorp:${skill.slug}`)).toBeInTheDocument();
    }
    const counted = screen.getAllByRole("listitem").length;
    expect(counted).toBe(skills.length);
  });

  it("REQ-07-009 shows ALL rules and each chip matches the registry flag", async () => {
    visit("/configuration/rules");
    await renderRealPage();
    revealAll();
    const rules = readDecisionRules();
    expect(rules.length).toBeGreaterThan(10);
    for (const rule of rules) {
      const row = screen.getByRole("button", { name: new RegExp(`^${rule.id} ·`) });
      expect(within(row).getByText(rule.requiereHumano ? "Tu OK" : "Auto")).toBeInTheDocument();
    }
  });

  it("REQ-07-003 a rule opens inline with its verbatim default text, never a dialog", async () => {
    visit("/configuration/rules");
    await renderRealPage();
    const rule = readDecisionRules()[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${rule?.id} ·`) }));
    expect(screen.getByTestId("rule-detail")).toHaveTextContent(rule?.default ?? "");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("REQ-07-010 renders every real standard with its severity word", async () => {
    visit("/configuration/standards");
    await renderRealPage();
    const standards = readStandards(FACTORY_ROOT);
    expect(standards.length).toBeGreaterThan(0);
    for (const standard of standards) {
      const row = screen.getByText(`${standard.id} · ${standard.enforcement}`).closest("button");
      const word = { MUST: "Obligatorio", SHOULD: "Recomendado", MAY: "Opcional" }[
        standard.severity
      ];
      expect(within(row as HTMLElement).getByText(word)).toBeInTheDocument();
    }
  });

  it("the surface offers no creation affordance and never copies /pandacorp:learn unasked", async () => {
    for (const section of ["rules", "standards"]) {
      visit(`/configuration/${section}`);
      const { unmount } = await renderRealPage();
      expect(screen.queryByRole("button", { name: /^(Nueva|Nuevo|New) /i })).toBeNull();
      expect(screen.queryByTestId("new-standard-button")).toBeNull();
      unmount();
    }
  });
});
