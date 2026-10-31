/**
 * FRD-08 reviewer (opus, DR-015): adversarial integration through the real page.tsx with real
 * readers over an on-disk fixture factory, so an orphaned component cannot hide behind props.
 * Reconciled for WO-08-003/004: the factory catalogs moved to Configuración (their derivation is
 * pinned by `configuration/_tests/page.integration.reviewer.test.tsx`); here the contract is that
 * the page reads authored pages only and that a catalog fact never leaks into it.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ManualPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

let factoryRoot: string;
let priorEnv: string | undefined;

function writeFile(relative: string, contents: string): void {
  const absolute = path.join(factoryRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents, "utf-8");
}

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

beforeEach(() => {
  factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frd08-review-"));
  priorEnv = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
  visit("/manual");
});

afterEach(() => {
  cleanup();
  if (priorEnv === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = priorEnv;
  fs.rmSync(factoryRoot, { recursive: true, force: true });
});

describe("FRD-08 reviewer: the page wired end to end", () => {
  it("REQ-08-020 the home derives its counts from the real authored index", () => {
    render(ManualPage());
    expect(screen.getByTestId("manual-page")).toBeInTheDocument();
    const home = screen.getByTestId("docs-home");
    expect(within(home).getByText("2 páginas")).toBeInTheDocument();
    expect(within(home).getByText("22 páginas")).toBeInTheDocument();
    expect(within(home).getByText("3 páginas")).toBeInTheDocument();
  });

  it("AC-08-020.1 every curated home link resolves to a real page, none silently dropped", () => {
    render(ManualPage());
    const home = screen.getByTestId("docs-home");
    expect(within(home).getByRole("link", { name: "El pipeline" })).toBeInTheDocument();
    expect(within(home).getByRole("link", { name: "Los gates humanos" })).toBeInTheDocument();
    expect(within(home).getByRole("link", { name: "Elegir modo de construcción" })).toHaveAttribute(
      "href",
      "/manual/guides/g-modo",
    );
    expect(within(home).getByRole("link", { name: /Build parcial/ })).toBeInTheDocument();
  });

  it("REQ-08-006 a catalog fact defined in the factory never reaches this surface", () => {
    writeFile(
      "plugin/skills/ghost-skill-zz9/SKILL.md",
      "---\ndescription: Solo en la fabrica.\n---\n# /pandacorp:ghost-skill-zz9\n",
    );
    writeFile(
      "plugin/agents/ghost-agent.md",
      "---\nname: Ghost Agent\nmodel: opus\ndescription: Fantasma.\n---\n# Ghost\n",
    );
    writeFile(
      "factory/decisions/registry.yaml",
      "decisiones:\n  - id: DR-GHOST\n    patron: p\n    default: d\n    requiere_humano: false\n",
    );
    visit("/manual/concepts/el-pipeline");
    render(ManualPage());
    expect(screen.getByTestId("doc-reader-authored")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ghost-skill-zz9|Ghost Agent|DR-GHOST/);
  });

  it("REQ-08-018 an authored address reaches its bespoke renderer, not the stub", () => {
    visit("/manual/concepts/el-pipeline");
    render(ManualPage());
    const reader = screen.getByTestId("doc-reader-authored");
    expect(within(reader).getByRole("heading", { level: 2, name: /El pipeline/ })).toBeVisible();
    expect(reader).not.toHaveTextContent("manualPages.tsx");
  });

  it("empty factory: no catalogs and no service catalog still renders, never throws", () => {
    expect(() => render(ManualPage())).not.toThrow();
    expect(screen.getByRole("heading", { level: 1, name: "Documentación" })).toBeInTheDocument();
  });
});
