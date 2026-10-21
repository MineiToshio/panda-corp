import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readNavigationCatalog } from "@/lib/navigation/identityCatalog";
import { isCheckoutFactoryRoot } from "../ownerPrivateState";

const CHECKOUT_FACTORY_ROOT = path.resolve(import.meta.dirname, "../../../..");
const VALID_CATALOG = {
  schemaVersion: 1,
  resources: [
    {
      kind: "project",
      id: "project_00000000-0000-4000-8000-000000000001",
      slug: "fixture-project",
      aliases: [],
      legacyNames: ["Fixture Project"],
      locator: "fixture-project",
    },
  ],
};

const tmpRoots: string[] = [];
function makeTmpRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "owner-private-state-test-"));
  tmpRoots.push(root);
  return root;
}
afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    const file = path.join(root, "factory/navigation-identities.json");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

describe("owner-private state never decides a test outcome", () => {
  it("recognises the checkout's own factory root, however it is spelled", () => {
    expect(isCheckoutFactoryRoot(CHECKOUT_FACTORY_ROOT, CHECKOUT_FACTORY_ROOT)).toBe(true);
    const unnormalized = `${CHECKOUT_FACTORY_ROOT}${path.sep}mission-control${path.sep}..${path.sep}`;
    expect(isCheckoutFactoryRoot(unnormalized, CHECKOUT_FACTORY_ROOT)).toBe(true);
    expect(isCheckoutFactoryRoot(os.tmpdir(), CHECKOUT_FACTORY_ROOT)).toBe(false);
  });

  it("reads no catalog for the checkout's own root, as in a clean clone", () => {
    expect(readNavigationCatalog(CHECKOUT_FACTORY_ROOT)).toBeUndefined();
  });

  it("still reads a real catalog from any other root", () => {
    const root = makeTmpRoot();
    fs.mkdirSync(path.join(root, "factory"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "factory/navigation-identities.json"),
      JSON.stringify(VALID_CATALOG),
    );
    expect(readNavigationCatalog(root)).toEqual(VALID_CATALOG);
  });
});
