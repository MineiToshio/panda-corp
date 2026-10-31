import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listProjectFrds } from "../frd-index";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frd-index-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".pandacorp/comms"), { recursive: true });
  for (const slug of ["frd-01-one", "frd-02-two", "frd-03-three", "frd-04-no-document"])
    fs.mkdirSync(path.join(root, "docs/frds", slug), { recursive: true });
  return root;
}
describe("project FRD index", () => {
  it("AC-12-004.1 AC-12-006.1: Spec > Architecture > H1 without code > humanized slug", () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, ".pandacorp/comms/spec-resumen.md"),
      "## 🧩 FRDs\n\n### FRD-01 · Spec wins · UI\nSummary\n",
    );
    fs.writeFileSync(
      path.join(root, ".pandacorp/comms/arquitectura-resumen.md"),
      "## 🧩 Por FRD\n\n### FRD-01 · Architecture loses\n**Blueprint:** plan\n\n### FRD-02 · Architecture wins\n**Blueprint:** plan\n",
    );
    for (const slug of ["frd-01-one", "frd-02-two", "frd-03-three"])
      fs.writeFileSync(
        path.join(root, "docs/frds", slug, "frd.md"),
        "---\ntitle: Metadata\n---\n# FRD-03 — Heading wins\n",
      );
    expect(listProjectFrds(root).map((frd) => frd.title)).toEqual([
      "Spec wins",
      "Architecture wins",
      "Heading wins",
      "No document",
    ]);
  });
  it("AC-12-006.1: unreadable folder listing fails loud; missing frd.md remains indexed", () => {
    const root = fixture();
    expect(listProjectFrds(root)).toHaveLength(4);
    const read = vi.spyOn(fs, "readdirSync").mockImplementation(() => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    });
    expect(() => listProjectFrds(root)).toThrow("denied");
    read.mockRestore();
  });
});
