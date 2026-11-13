// Shared setup is DOM-free; browser setup belongs to vitest.dom.setup.ts.
import path from "node:path";
import { vi } from "vitest";
import { isCheckoutFactoryRoot } from "@/test/ownerPrivateState";

/**
 * Keep the suite hermetic from owner-private state: `getProjectNavigation` reads the identity
 * catalog from `resolveFactoryRoot()`, which is `cwd/..` (this checkout's factory) unless a test
 * stubs `PANDACORP_FACTORY_ROOT`. In the owner's checkout that folder holds the private, gitignored
 * `factory/navigation-identities.json`, so every render test with a fixture project would throw
 * "unregistered project" while a clean clone (no catalog) passes. For THIS checkout's own factory
 * root the catalog reads as absent (the designed legacy-fixture boundary); every other root, such
 * as a tmp fixture root, goes to the real reader untouched.
 */
const CHECKOUT_FACTORY_ROOT = path.resolve(import.meta.dirname, "..");
vi.mock("@/lib/navigation/identityCatalog", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/navigation/identityCatalog")>();
  return {
    ...actual,
    readNavigationCatalog: (root: string) =>
      isCheckoutFactoryRoot(root, CHECKOUT_FACTORY_ROOT)
        ? undefined
        : actual.readNavigationCatalog(root),
  };
});
