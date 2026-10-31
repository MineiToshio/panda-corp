import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { DependencyMap } from "../DependencyMap";

it("AC-12-004.1: the self-loading map renders real work orders and seeds route selection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dependency-map-mount-"));
  try {
    const folder = path.join(root, "docs/frds/frd-01-feature/work-orders");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(
      path.join(folder, "wo-01-001.md"),
      "---\nid: WO-01-001\nimplementation_status: PLANNED\ndependsOn: []\n---\n# First\n",
    );
    render(
      <DependencyMap
        project={{ slug: "demo", path: root }}
        route={{ dag: "wo", focus: "WO-01-001" }}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Grafo de dependencias, desplazable" }),
    ).toBeInTheDocument();
    const detail = screen.getByRole("region", { name: "Work order en foco" });
    expect(within(detail).getByText("WO-01-001")).toBeInTheDocument();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
