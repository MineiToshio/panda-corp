/**
 * Legacy contract probe retained for the frozen reviewer suite.
 * AppShell renders unconditionally; production code does not consult this probe.
 */
export function isShellExempt(_pathname: string): boolean {
  return false;
}
