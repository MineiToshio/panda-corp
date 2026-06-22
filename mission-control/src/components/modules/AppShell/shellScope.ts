/**
 * Shell scope (FRD-19, AC-19-004) — which routes render WITHOUT the global topbar.
 *
 * SINGLE SOURCE the app mirrors with the Shell-Presence Gate seed `e2e/shell.ts` (SHELL_EXEMPT).
 * Drill-in surfaces that navigate via their own in-context header + back control — the project
 * workspace (`/projects/**`) and Configuration (`/configuration`) — are NOT top-level nav, so the
 * shell does not render on them. Keep this in sync with `e2e/shell.ts` SHELL_EXEMPT.
 */

/** Exact paths that render without the shell. */
const SHELL_EXEMPT_EXACT: readonly string[] = ["/configuration"] as const;

/** Prefixes whose whole subtree renders without the shell (mirrors `/projects/**`). */
const SHELL_EXEMPT_PREFIXES: readonly string[] = ["/projects/"] as const;

/** True when `pathname` is a drill-in that renders without the global topbar. */
export function isShellExempt(pathname: string): boolean {
  if (SHELL_EXEMPT_EXACT.includes(pathname)) return true;
  return SHELL_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
