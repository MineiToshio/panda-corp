import path from "node:path";

/**
 * Owner-private, gitignored state (e.g. `factory/navigation-identities.json`) exists only in the
 * owner's own checkout, never in a clean clone or worktree. A test outcome must not depend on it:
 * a catalog that is present turns every fixture project into a loud "unregistered" failure, while
 * the same suite passes where the file is absent. The harness therefore hides it for the
 * checkout's own factory root (and only that root), so fixtures behave identically everywhere.
 *
 * @param root candidate factory root, in any spelling (relative, trailing separator, `..` segments)
 * @param checkoutRoot the factory root of the checkout running the tests
 * @returns true when both resolve to the same directory
 */
export function isCheckoutFactoryRoot(root: string, checkoutRoot: string): boolean {
  return path.resolve(root) === path.resolve(checkoutRoot);
}
