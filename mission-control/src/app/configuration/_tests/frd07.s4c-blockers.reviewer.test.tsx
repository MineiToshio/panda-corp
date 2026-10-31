/**
 * FRD-07 reviewer gate on WO-07-006: RED until the listed FRD clauses hold. Where the FDD or the
 * mock disagrees with the FRD, the FRD is the oracle (FRD > FDD).
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

  it("AC-07-013.2 REQ-07-004 every skill row offers copy, internal ones included", () => {
    renderAt("/configuration/skills");
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:engine" })).toBeInTheDocument();
  });

  it("REQ-07-011 each agent card shows its model chip", () => {
    renderAt("/configuration/agents");
    const card = screen.getByRole("button", { name: /Reviewer/ });
    expect(within(card).getByText("Opus")).toBeInTheDocument();
  });

  it("REQ-07-011 AC-07-013.3 each agent carries an effort chip, also without a declared effort", () => {
    renderAt("/configuration/agents");
    const card = screen.getByRole("button", { name: /Plain/ });
    expect(within(card).getByText(/esfuerzo/i)).toBeInTheDocument();
  });

  it("REQ-07-002 a standard row carries a real description", () => {
    renderAt("/configuration/standards");
    expect(screen.getByText(/Every change ships with evidence/)).toBeInTheDocument();
  });
});
