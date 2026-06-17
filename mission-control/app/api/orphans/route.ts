/**
 * CMP-16-route — GET /api/orphans
 *
 * Exposes `getOrphans()` (IF-16-scan) as a JSON endpoint so the client banner
 * can poll it. The directory scan needs Node.js `fs` outside a Server Component
 * render (architecture §3, §8), hence the route handler.
 *
 * Read-only invariant (architecture §7, REQ-16-005):
 *   This handler ONLY calls the read-only `getOrphans()`.
 *   It never writes to disk, never runs `adopt` or `git`, and never modifies
 *   the portfolio.
 *
 * Traceability:
 *   CMP-16-route → AC-16-003.1, AC-16-003.2, AC-16-003.3, AC-16-003.4
 *   IF-16-scan   → lib/orphans.ts :: getOrphans()
 *   WO-16-003    → FRD-16
 */

import { FACTORY_ROOT } from "@/lib/config";
import { type Candidate, getOrphans } from "@/lib/orphans";

/**
 * Use the Node.js runtime so `fs.readdirSync` / `fs.accessSync` (used by
 * `lib/orphans.ts`) are available. The Edge runtime does not support Node
 * built-ins.
 *
 * AC-16-003.1 / architecture §3: directory scans need Node outside a Server
 * Component render.
 */
export const runtime = "nodejs";

/**
 * Never cache: orphan candidates are live filesystem state. A cached response
 * would hide a new orphan or keep showing a dismissed one.
 *
 * AC-16-003.1: the response must reflect the current on-disk state.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/orphans
 *
 * Returns an array of `Candidate` objects as JSON.
 *
 * - Status 200 always (AC-16-003.1, AC-16-003.3, AC-16-003.4): even when the
 *   projects folder is unreadable or there are no candidates, the route returns
 *   200 with `[]`. A degraded scan is not a server error — the banner simply
 *   stays hidden.
 * - Read-only (AC-16-003.2, REQ-16-005): only calls `getOrphans()`, no writes.
 * - Uncacheable: `force-dynamic` + no-store header.
 */
export function GET(_request: Request): Response {
  let candidates: Candidate[];
  try {
    candidates = getOrphans(FACTORY_ROOT);
  } catch {
    // Belt-and-suspenders: getOrphans is already defensive and never throws,
    // but if it ever does we must return 200 with [] rather than 500
    // (AC-16-003.4: degraded scan returns 200 with [], not 500).
    candidates = [];
  }

  return Response.json(candidates, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
