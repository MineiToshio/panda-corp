import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { dataModelFixture } from "@/test/dataModelFixture";
import { readArchitectureArtifacts } from "../read-artifacts";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "architecture-boundaries-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function write(relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

it("preserves absent architecture as missing, with no fabricated artifact collections", () => {
  expect(readArchitectureArtifacts(root)).toEqual({
    architectureContent: undefined,
    dataModel: { kind: "missing" },
    workOrders: undefined,
    envVars: undefined,
    adrs: undefined,
    frds: [],
    sourceErrors: {
      workOrderFiles: [],
      workOrders: undefined,
      env: undefined,
      adrs: undefined,
      frds: undefined,
    },
  });
});

it("keeps directory failures visible and returns empty fallbacks for failed architecture bands", () => {
  write(
    "docs/product/data-model.json",
    JSON.stringify({ schemaVersion: 1, persistence: "none", entities: [], relationships: [] }),
  );
  write("docs/frds", "not a directory");
  fs.mkdirSync(path.join(root, ".env.example"));
  fs.mkdirSync(path.join(root, "docs/adr/adr-0001.md"), { recursive: true });
  const result = readArchitectureArtifacts(root);
  expect(result.workOrders).toEqual([]);
  expect(result.envVars).toEqual([]);
  expect(result.adrs).toEqual([]);
  expect(result.frds).toEqual([]);
  expect(result.sourceErrors.workOrderFiles).toEqual([]);
  expect(result.sourceErrors.workOrders).toContain("directory could not be listed");
  expect(result.sourceErrors.env).toBeTruthy();
  expect(result.sourceErrors.adrs).toBeTruthy();
  expect(result.sourceErrors.frds).toContain("ENOTDIR");
});

it("uses a legacy no-database digest only when no structured model exists", () => {
  write(".pandacorp/comms/arquitectura-resumen.md", "## Modelo de datos\n\nSin base de datos.\n");
  expect(readArchitectureArtifacts(root).dataModel).toEqual({ kind: "none" });
  const model = dataModelFixture();
  write("docs/product/data-model.json", JSON.stringify(model));
  expect(readArchitectureArtifacts(root).dataModel).toEqual({
    kind: "ready",
    source: "docs/product/data-model.json",
    model,
  });
});
