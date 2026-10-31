import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrdDetail } from "@/components/modules/Spec/FrdDetail";
import { parseEnvExample } from "@/lib/architecture/env";
import { listProjectDocs } from "@/lib/docs/tree";
import { validateNavigationQuery } from "@/lib/navigation/keys";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import type { DigestFrd } from "@/lib/spec/read-frds";
import { readDigestFrds } from "@/lib/spec/read-frds";
import { ArchitectureDigest } from "../ArchitectureDigest";

const LIVE: DigestFrd = {
  id: "FRD-02",
  title: "Board",
  slug: "frd-02-ideas-board",
  blueprint: "",
  workOrders: [],
};
const STACK = "## Stack\n\n| Capa | Elección | Por qué |\n|---|---|---|\n| UI | Next | RSC |\n";
const dirs: string[] = [];

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => {
  cleanup();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("WO-02-017 digest bands, independent edge review", () => {
  it("omits a live band with nothing to show instead of an empty header (WO-02-017 completeness)", () => {
    render(<ArchitectureDigest title="X" body={STACK} dataModel={{ kind: "none" }} />);
    expect(screen.queryByTestId("arch-env-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arch-adrs")).not.toBeInTheDocument();
  });

  it("states zero planned orders once construction started but no order exists", () => {
    render(
      <ArchitectureDigest
        title="X"
        body={STACK}
        dataModel={{ kind: "none" }}
        constructionStarted
      />,
    );
    expect(within(screen.getByTestId("arch-plan")).getByText(/work orders/)).toBeVisible();
  });

  it("not-published shows the message without the empty live bands the prototype omits", () => {
    render(<ArchitectureDigest title="X" body="" dataModel={{ kind: "missing" }} />);
    expect(screen.getByText("La arquitectura todavía no está publicada.")).toBeVisible();
    expect(screen.queryByTestId("arch-plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arch-env-block")).not.toBeInTheDocument();
  });

  it("AC-02-011.3: Ver work orders opens a URL the observability surface accepts", () => {
    render(
      <FrdDetail
        frd={LIVE}
        live={LIVE}
        workOrders={[]}
        onClose={() => {}}
        navigationBaseHref="/portfolio/demo"
      />,
    );
    const href = screen.getByRole("link", { name: "Ver work orders" }).getAttribute("href") ?? "";
    const frd = new URL(href, "http://x").searchParams.get("frd") ?? "";
    expect(validateNavigationQuery("observability", { frd })).toEqual({ ok: true });
  });

  it("AC-02-011.3: Contrato opens a document the Documents tab can resolve", () => {
    render(
      <FrdDetail
        frd={LIVE}
        live={LIVE}
        workOrders={[]}
        onClose={() => {}}
        navigationBaseHref="/portfolio/demo"
      />,
    );
    const href = screen.getByRole("link", { name: "Contrato" }).getAttribute("href") ?? "";
    const dir = mkdtempSync(join(tmpdir(), "s2b-docs-"));
    dirs.push(dir);
    mkdirSync(join(dir, "docs/frds/frd-02-ideas-board"), { recursive: true });
    writeFileSync(join(dir, "docs/frds/frd-02-ideas-board/frd.md"), "# Board\n");
    const known = listProjectDocs(dir).map((node) => node.id);
    expect(known).toContain(parseNavigationUrl(href).doc);
  });

  it("opening an unknown selection keeps every band usable", () => {
    window.history.replaceState({}, "", "/?adr=ADR-9999&architectureFrd=FRD-99");
    render(<ArchitectureDigest title="X" body={STACK} dataModel={{ kind: "none" }} />);
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("arch-stack")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
  });
});

describe("WO-02-017 live readers, independent edge review", () => {
  it("AC-02-016.8: keeps the group name of a three-line banner section", () => {
    const vars = parseEnvExample(
      "# ------------\n# Database\n# ------------\n# Connection string\nDATABASE_URL=x\n",
    );
    expect(vars).toEqual([
      { name: "DATABASE_URL", comment: "Connection string", section: "Database", described: true },
    ]);
  });

  it("AC-02-016.8: a boundary of 12 variables stays unfolded in the section grammar", () => {
    const lines = Array.from({ length: 13 }, (_, index) => `V${index}=1`).join("\n");
    const vars = parseEnvExample(`# --- Big ---\n${lines}\n`);
    expect(vars).toHaveLength(13);
    expect(new Set(vars.map((entry) => entry.section))).toEqual(new Set(["Big"]));
    expect(vars.every((entry) => entry.described === false)).toBe(true);
  });

  it("never retains a value, and fails loud on an unparseable line", () => {
    expect(JSON.stringify(parseEnvExample("# k\nSECRET=hunter2\n"))).not.toContain("hunter2");
    expect(() => parseEnvExample("garbage line\n")).toThrow(/\.env\.example:1/);
  });

  it("AC-02-013.5: the blueprint one-liner never comes from YAML frontmatter", () => {
    const dir = mkdtempSync(join(tmpdir(), "s2b-frds-"));
    dirs.push(dir);
    mkdirSync(join(dir, "docs/frds/frd-01-a"), { recursive: true });
    writeFileSync(join(dir, "docs/frds/frd-01-a/frd.md"), "---\nid: FRD-01\ntitle: A\n---\n");
    writeFileSync(
      join(dir, "docs/frds/frd-01-a/blueprint.md"),
      "---\nid: BP-01\nsource_requirements:\n  - REQ-01-001\n---\n# Title\n\nReal summary.\n",
    );
    expect(readDigestFrds(dir, [])[0]?.blueprint).toBe("Real summary.");
  });
});
