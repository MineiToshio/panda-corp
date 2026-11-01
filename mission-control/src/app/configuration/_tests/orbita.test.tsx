import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import { ConfigurationShell } from "../ConfigurationShell";

let root: string;
function write(file: string, body: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
}
function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "config-view-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  write(
    "plugin/skills/spec/SKILL.md",
    "---\ndescription: Document inside the project\n---\nUses reviewer. Evidence shared.",
  );
  write(
    "plugin/skills/engine/SKILL.md",
    "---\ndescription: Internal engine\nuser-invocable: false\n---\nEngine.",
  );
  write(
    "plugin/agents/reviewer.md",
    "---\nname: Reviewer\nmodel: opus\neffort: high\ntools: Read, Bash\n---\nReviews shared evidence.",
  );
  write("plugin/agents/other.md", "---\nname: Other\n---\nOther agent.");
  write(
    "factory/decisions/registry.yaml",
    `decisiones:\n${Array.from({ length: 48 }, (_, i) => `  - id: DR-${i}\n    patron: Rule ${i}\n    default: shared evidence\n    requiere_humano: ${i < 13}\n`).join("")}`,
  );
  write(
    "factory/standards/optional.md",
    "---\ndomain: Design\nseverity: MAY\nenforcement: checklist\n---\n# Optional\nOptional body.",
  );
  write(
    "factory/standards/quality.md",
    "---\ndomain: Quality\nseverity: MUST\nenforcement: CI\n---\n# Quality\nShared evidence.",
  );
  visit("/configuration");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("configuration Orbita", () => {
  it("AC-07-013.1 opens the hub, copies owner commands and searches all catalogs", async () => {
    const user = userEvent.setup();
    render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
    expect(screen.getByRole("tab", { name: "Resumen", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar /pandacorp:spec" }));
    expect(await navigator.clipboard.readText()).toBe("/pandacorp:spec");
    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en toda la configuración" }),
      "shared",
    );
    expect(window.location.search).toBe("?q=shared");
    expect(screen.getByRole("heading", { name: /Resultados/ })).toBeInTheDocument();
    for (const label of ["Habilidad", "Agente", "Regla", "Estándar"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
  it("AC-07-013.2 filters skills and cross-navigates native dialogs in both directions", () => {
    render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Habilidades/ }));
    fireEvent.click(screen.getByRole("button", { name: /Motores internos/ }));
    expect(
      screen.queryByRole("button", { name: /pandacorp:spec Document/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Otras")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Comandos tuyos/ }));
    fireEvent.click(screen.getByRole("button", { name: /pandacorp:spec Document/ }));
    const skill = screen.getByRole("dialog", { name: "/pandacorp:spec" });
    expect(skill.tagName).toBe("DIALOG");
    fireEvent.click(within(skill).getByRole("button", { name: "reviewer" }));
    const agent = screen.getByRole("dialog", { name: "Reviewer" });
    expect(within(agent).getByText("Bash")).toBeInTheDocument();
    fireEvent.click(within(agent).getByRole("button", { name: "/pandacorp:spec" }));
    expect(screen.getByRole("dialog", { name: "/pandacorp:spec" })).toBeInTheDocument();
  });
  it("AC-07-013.3 groups models with explanation, explicit effort and inherited fallback", () => {
    visit("/configuration/agents");
    render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
    expect(screen.getByRole("heading", { name: /Opus/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Modelo heredado/ })).toBeInTheDocument();
    expect(screen.getByText("esfuerzo alto")).toBeInTheDocument();
    expect(screen.getByText(/Juicio y diseño/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "none" } });
    expect(screen.getByText("Ningún agente coincide.")).toBeInTheDocument();
  });
  it("AC-07-013.4 shows 30 rules, reveals the remaining 18 and filters 13 requiring approval", () => {
    visit("/configuration/rules");
    render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
    expect(screen.getAllByRole("button", { name: /^DR-/ })).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 18 más · quedan 18" }));
    expect(screen.getAllByRole("button", { name: /^DR-/ })).toHaveLength(48);
    fireEvent.click(screen.getByRole("button", { name: /Requieren tu OK/ }));
    expect(screen.getAllByRole("button", { name: /^DR-/ })).toHaveLength(13);
    fireEvent.click(screen.getByRole("button", { name: /DR-0 · Rule 0/ }));
    expect(screen.getByRole("region", { name: "DR-0" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/configuration/rules/DR-0");
  });
  it("AC-07-013.5 combines domain and severity, orders MUST first and shows enforcement", () => {
    visit("/configuration/standards");
    render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
    expect(screen.getAllByRole("button", { name: /quality.md|optional.md/ })[0]).toHaveTextContent(
      "Quality",
    );
    expect(screen.getByText("quality.md · CI")).toBeInTheDocument();
    expect(screen.getByText("Opcional")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Obligatorios/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por dominio" }), {
      target: { value: "Design" },
    });
    expect(screen.getByText("Ningún estándar coincide.")).toBeInTheDocument();
  });
  it("DR-078 names the failing source and keeps independent catalogs available", () => {
    const catalogs = loadConfigurationCatalogs();
    catalogs.skills = { ok: false, source: "plugin/skills", reason: "Unreadable source" };
    render(<ConfigurationShell catalogs={catalogs} />);
    expect(screen.getByRole("alert")).toHaveTextContent("plugin/skills");
    fireEvent.click(screen.getByRole("tab", { name: /Agentes/ }));
    expect(screen.getByRole("button", { name: /Reviewer/ })).toBeInTheDocument();
  });
});

it.each([
  "skills",
  "agents",
  "rules",
  "standards",
] as const)("DR-078 %s source errors have their own alert and preserve the other catalogs", (section) => {
  const catalogs = loadConfigurationCatalogs();
  catalogs[section] = { ok: false, source: `${section}/source`, reason: "Unreadable source" };
  render(<ConfigurationShell catalogs={catalogs} />);
  expect(screen.getByRole("alert")).toHaveTextContent(`${section}/source`);
  expect(screen.getAllByRole("tab")).toHaveLength(5);
});
it("unknown item URLs are bounded instead of silently selecting the first item", () => {
  visit("/configuration/skills/absent");
  expect(() => render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />)).toThrow();
});

it("keeps the rule search focused while typing and resets pagination without remounting", async () => {
  const user = userEvent.setup();
  visit("/configuration/rules");
  render(<ConfigurationShell catalogs={loadConfigurationCatalogs()} />);
  await user.click(screen.getByRole("button", { name: "Mostrar 18 más · quedan 18" }));
  const search = screen.getByRole("searchbox");
  await user.click(search);
  await user.keyboard("shared");
  expect(search).toHaveFocus();
  expect(search).toHaveValue("shared");
  expect(screen.getByRole("searchbox")).toBe(search);
  expect(screen.getAllByRole("button", { name: /^DR-/ })).toHaveLength(30);
  await user.type(search, " evidence", { skipClick: true });
  expect(search).toHaveFocus();
  expect(search).toHaveValue("shared evidence");
});
