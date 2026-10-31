/**
 * FRD-04 gate (reviewer-authored, DR-015), reconciled for WO-04-011: the Resumen as mounted from real
 * project files. Covers its reading failures against production-shaped sources and the
 * client-boundary rule the unit environment cannot see on its own.
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import ResumenPanel from "../../../_panels/ResumenPanel";
import { readSummary } from "../readSummary";
import { summaryFixture } from "./summaryFixture";

const state = vi.hoisted(() => ({ items: [] as ProjectListItem[] }));
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => state.items,
  readPortfolio: () => state.items,
}));
class FakeEventSource {
  close() {}
}
let fixture: ReturnType<typeof summaryFixture>;
beforeEach(() => {
  fixture = summaryFixture();
  state.items = [fixture.item];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  fixture.cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function panel(): HTMLElement {
  render(<ResumenPanel project={fixture.project()} route={fixture.route} />);
  return screen.getByTestId("tab-summary");
}

const ENGINE_SHAPED = `# Decisiones

## RESUELTO (2026-09-25) — FRD-02 — Contradicciones

- **Estado:** RESUELTO

## FRD-25 — Código rechazado que no se pudo descartar (necesita propietario)

Detalle escrito por el motor.

### (1) Un subapartado
`;

describe("FRD-04 gate — Resumen sources", () => {
  it("AC-04-014.5 DR-078: a real engine-written heading never hides the decisions that did parse", () => {
    fixture.write(".pandacorp/inbox/decisions.md", ENGINE_SHAPED);
    expect(readSummary(fixture.item.path).decisions.value.length).toBeGreaterThan(0);
  });

  it("AC-04-014.6: without a pending item Tu turno states its empty sentence, not a read failure", () => {
    const summary = panel();
    const heading = within(summary).getByRole("heading", { name: /^Tu turno/ });
    const card = heading.closest("section") ?? heading.parentElement?.parentElement;
    expect(card).not.toHaveTextContent("no se pudo leer");
  });

  it("AC-04-014.6: Tu turno lists this project's pending decision with its scoped command", () => {
    fixture.write(
      ".pandacorp/inbox/decisions.md",
      "# Decisiones\n\n## 2026-10-20 · ¿Qué proveedor?\n\n- **Estado:** PENDIENTE\n",
    );
    const summary = panel();
    const heading = within(summary).getByRole("heading", { name: /^Tu turno/ });
    const card = heading.closest("section") ?? heading.parentElement?.parentElement;
    expect(card).toHaveTextContent("/pandacorp:decide 2026-10-20-1");
  });
});

function clientFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "_tests" ? [] : clientFiles(file);
    return /\.tsx$/.test(entry.name) && fs.readFileSync(file, "utf8").startsWith('"use client"')
      ? [file]
      : [];
  });
}

describe("FRD-04 gate — client boundary", () => {
  it("preview smoke: no client component of the panel loads a module that needs node:fs", () => {
    const root = path.resolve("src/app/projects/[slug]/_components");
    const offenders = ["tab-summary", "ProgressList", "version-freshness", "Fragua"]
      .flatMap((folder) => clientFiles(path.join(root, folder)))
      .flatMap((file) =>
        [...fs.readFileSync(file, "utf8").matchAll(/^import (?!type )[^;]*from "@\/([^"]+)";/gm)]
          .map((match) => path.resolve("src", `${match[1]}.ts`))
          .filter((target) => fs.existsSync(target))
          .filter((target) => /from "node:/.test(fs.readFileSync(target, "utf8")))
          .map((target) => `${path.basename(file)} -> ${path.relative("src", target)}`),
      );
    expect(offenders).toEqual([]);
  });
});
