/**
 * FRD-07 reviewer gate on WO-07-006: RED until the listed clauses hold. The approved prototype
 * (`docs/design/prototype/prototype.js:2214,2221,2231`) outranks the FRD for catalog layout, per
 * the owner's close-out rule.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { ConfigurationShell } from "../ConfigurationShell";
import { visit } from "./_realFactory";

let root: string;
function write(file: string, body: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "config-gate-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  write(
    "plugin/skills/spec/SKILL.md",
    "---\ndescription: Spec\n---\nUses reviewer.\n\n## Body\nDef.",
  );
  write(
    "plugin/skills/engine/SKILL.md",
    "---\ndescription: Engine\nuser-invocable: false\n---\nEngine.",
  );
  write(
    "plugin/agents/reviewer.md",
    "---\nname: Reviewer\nmodel: opus\neffort: high\ntools: Read\n---\nReviews.",
  );
  write("plugin/agents/plain.md", "---\nname: Plain\nmodel: sonnet\n---\nNo declared effort.");
  write("factory/decisions/registry.yaml", "decisiones: []\n");
  write(
    "factory/standards/quality.md",
    "---\ndomain: Quality\nseverity: MUST\nenforcement: CI\n---\n# Quality\n\nEvery change ships with evidence.",
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});
function renderAt(href: string): void {
  visit(href);
  render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
}

describe("FRD-07 clauses", () => {
  it("REQ-07-007 the full definition sits BEHIND a closed «Definición completa» disclosure", () => {
    renderAt("/configuration/skills/spec");
    const summary = within(screen.getByRole("dialog")).getByText("Definición completa");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("REQ-07-007 the agent's full definition sits behind the same disclosure", () => {
    renderAt("/configuration/agents/reviewer");
    const summary = within(screen.getByRole("dialog")).getByText("Definición completa");
    expect(summary.tagName).toBe("SUMMARY");
  });

  it("AC-07-013.2 REQ-07-004 owner rows offer copy; internal rows show their chip instead", () => {
    renderAt("/configuration/skills");
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec" })).toBeInTheDocument();
    expect(screen.getByText("Motor interno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar /pandacorp:engine" })).toBeNull();
  });

  it("REQ-07-011 the tier heading names the model and the card repeats no chip for it", () => {
    renderAt("/configuration/agents");
    const heading = screen.getByRole("heading", { name: /^Opus/ });
    const tier = heading.closest("section");
    expect(tier).not.toBeNull();
    const card = within(tier as HTMLElement).getByRole("button", { name: /Reviewer/ });
    expect(within(card).queryByText("Opus")).toBeNull();
  });

  it("REQ-07-011 the agent dialog keeps its model chip", () => {
    renderAt("/configuration/agents/reviewer");
    expect(within(screen.getByRole("dialog")).getByText("Opus")).toBeInTheDocument();
  });

  it("REQ-07-011 AC-07-013.3 a card shows declared effort and never infers a missing one", () => {
    renderAt("/configuration/agents");
    const declared = screen.getByRole("button", { name: /Reviewer/ });
    expect(within(declared).getByText("esfuerzo alto")).toBeInTheDocument();
    const plain = screen.getByRole("button", { name: /Plain/ });
    expect(within(plain).queryByText(/esfuerzo/i)).toBeNull();
  });

  it("REQ-07-002 a standard row shows file and enforcement; the dialog keeps the description", () => {
    renderAt("/configuration/standards");
    expect(screen.getByText("quality.md · CI")).toBeInTheDocument();
    expect(screen.queryByText(/Every change ships with evidence/)).toBeNull();
    cleanup();
    renderAt("/configuration/standards/quality.md");
    expect(
      within(screen.getByRole("dialog")).getByText(/Every change ships with evidence/),
    ).toBeInTheDocument();
  });
});
