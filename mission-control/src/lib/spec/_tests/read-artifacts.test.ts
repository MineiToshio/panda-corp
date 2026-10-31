import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readArchitectureArtifacts } from "@/lib/architecture/read-artifacts";
import { readSpecArtifacts } from "../read-artifacts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "s2b-artifacts-"));
  dirs.push(dir);
  mkdirSync(join(dir, "docs/frds/frd-01-reader/work-orders"), { recursive: true });
  mkdirSync(join(dir, ".pandacorp/comms"), { recursive: true });
  writeFileSync(
    join(dir, "docs/frds/frd-01-reader/frd.md"),
    "---\nid: FRD-01\ntitle: Reader\nui: api\n---\n# Reader\n",
  );
  writeFileSync(
    join(dir, "docs/frds/frd-01-reader/work-orders/wo-01-001-read.md"),
    "---\nid: WO-01-001\ntitle: Read\nimplementation_status: IN_REVIEW\n---\n# Read\n",
  );
  writeFileSync(
    join(dir, ".pandacorp/comms/arquitectura-resumen.md"),
    "## Stack\n| Layer | Choice | Why |\n|---|---|---|\n| UI | Next | RSC |\n",
  );
  return dir;
}
it("AC-02-011.1 AC-02-011.4: absent digest is honest absence; live FRDs are independent of stale digest counts", () => {
  const dir = fixture();
  const absent = readSpecArtifacts(dir);
  expect(absent.body).toBe("");
  expect(absent.frdCount).toBe(1);
  writeFileSync(
    join(dir, ".pandacorp/comms/spec-resumen.md"),
    "## FRDs\n### FRD-01 · Reader\nNarrative\n",
  );
  const spec = readSpecArtifacts(dir);
  expect(spec.frds[0]?.ui).toBe("api");
  expect(spec.frds[0]?.workOrders[0]?.state).toBe("review");
  expect(spec.frds[0]?.detail?.summary).toBe("Narrative");
});
it("AC-02-013.3 AC-02-013.4: malformed work orders and unreadable ADR/env sources are explicit per-band errors", () => {
  const dir = fixture();
  mkdirSync(join(dir, ".env.example"));
  mkdirSync(join(dir, "docs/adr/adr-0001.md"), { recursive: true });
  writeFileSync(
    join(dir, "docs/frds/frd-01-reader/work-orders/wo-01-001-read.md"),
    "---\nimplementation_status: [\n---\n",
  );
  const bundle = readArchitectureArtifacts(dir);
  expect(bundle.sourceErrors.env).toBeTruthy();
  expect(bundle.sourceErrors.adrs).toBeTruthy();
  expect(bundle.sourceErrors.workOrders).toBeTruthy();
  expect(bundle.architectureContent).toContain("Next");
});
it("AC-02-015.9 AC-02-013.1: the shared architecture reader exposes a structured none state without narrative", () => {
  const dir = mkdtempSync(join(tmpdir(), "s2b-model-"));
  dirs.push(dir);
  mkdirSync(join(dir, "docs/product"), { recursive: true });
  writeFileSync(
    join(dir, "docs/product/data-model.json"),
    JSON.stringify({ schemaVersion: 1, persistence: "none", entities: [], relationships: [] }),
  );
  const bundle = readArchitectureArtifacts(dir);
  expect(bundle.architectureContent).toBeUndefined();
  expect(bundle.dataModel).toEqual({ kind: "none" });
});
