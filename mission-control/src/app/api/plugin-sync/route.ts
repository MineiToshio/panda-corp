/**
 * CMP-15-route — GET /api/plugin-sync
 *
 * Exposes `getPluginSyncState()` (IF-15-sync) as a JSON endpoint so the
 * client banner can poll it. The git probe needs Node.js `child_process`
 * which is unavailable inside a Server Component render, hence the route
 * handler (architecture §3, §8).
 *
 * Read-only invariant (architecture §7, REQ-15-005):
 *   This handler ONLY calls the read-only `getPluginSyncState()`.
 *   It never writes to disk, never executes `claude plugin update`, and
 *   never calls Claude.
 *
 * Traceability:
 *   CMP-15-route → AC-15-003.1, AC-15-003.2, AC-15-003.3, AC-15-003.4
 *   IF-15-sync   → lib/plugin-sync.ts :: getPluginSyncState()
 *   WO-15-003    → FRD-15
 */

import { getPluginSyncState } from "@/lib/plugin-sync/plugin-sync";

/**
 * Use the Node.js runtime so `child_process` (used by `execFileSync` inside
 * `lib/plugin-sync.ts`) is available. The Edge runtime does not support it.
 *
 * AC-15-003.3 / architecture §3: git probes need Node outside a Server
 * Component render.
 */
export const runtime = "nodejs";

/**
 * Never cache: drift is live state (an out-of-sync plugin is a real-time
 * condition — a cached response would hide the warning or show stale sync).
 *
 * AC-15-003.3: the response is uncacheable.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/plugin-sync
 *
 * Returns the current `PluginSyncState` verdict as JSON.
 *
 * - Status 200 always (AC-15-003.1, AC-15-003.4): even when `reason === "unknown"`
 *   the route returns 200 — the banner decides not to show. A degraded probe is
 *   not a server error.
 * - Read-only (AC-15-003.2): only calls `getPluginSyncState()`, no writes.
 * - Uncacheable (AC-15-003.3): `force-dynamic` + no-store header.
 */
export function GET(_request: Request): Response {
  const state = getPluginSyncState();
  return Response.json(state, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
