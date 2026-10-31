import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ComandosPanel from "../../../_panels/ComandosPanel";
import type { PanelProps } from "../../../_panels/types";

let root: string | undefined;
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});
it("AC-11-005.2: real readers load FRDs, pending orders and ready/draft/building changes only", async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "s5c-commands-"));
  function write(file: string, body: string): void {
    const dest = path.join(root ?? "", file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
  }
  write("docs/frds/frd-01-test/frd.md", "# FRD-01 · Test feature");
  for (const [id, status] of [
    ["WO-01-001", "PLANNED"],
    ["WO-01-002", "VERIFIED"],
    ["WO-01-003", "IN_REVIEW"],
  ])
    write(
      `docs/frds/frd-01-test/work-orders/${id?.toLowerCase()}.md`,
      `---\nid: ${id}\ntitle: ${id}\nimplementation_status: ${status}\n---\n# Work`,
    );
  for (const status of ["ready", "draft", "building", "closing", "done", "discarded"])
    write(
      `.pandacorp/inbox/changes/${status}.md`,
      `---\ntype: change\nstatus: ${status}\n---\n# ${status}`,
    );
  write(".pandacorp/inbox/changes/broken.md", "broken");
  const project = {
    projectPath: root,
    slug: "project",
    phase: "product",
    nextStep: { command: "/pandacorp:design", sentence: "Next" },
  } as unknown as PanelProps["project"];
  render(await ComandosPanel({ project } as PanelProps));
  const options = screen.getAllByRole("option").map((option) => option.getAttribute("value"));
  expect(options).toEqual([
    "",
    "FRD-01",
    "WO-01-001",
    "WO-01-003",
    "change:building",
    "change:draft",
    "change:ready",
  ]);
  expect(screen.getByRole("option", { name: "FRD-01 · Test feature" })).toBeInTheDocument();
});
it("AC-11-005.2: no documents or queue gives only a target placeholder and no phase command", async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "s5c-commands-empty-"));
  const project = {
    projectPath: root,
    slug: "empty",
    phase: undefined,
    nextStep: { command: null, sentence: null },
  } as unknown as PanelProps["project"];
  render(await ComandosPanel({ project } as PanelProps));
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(screen.getByText("No hay comandos de fase para este proyecto.")).toBeInTheDocument();
});
