/**
 * FrdDriftBadge (FRD-12 AC-12-003.3): "Verificado · N derivas" beside a verified FRD whose `drift:`
 * frontmatter lists pre-existing drift the build gate proved but did not block on (DR-122).
 *
 * Pure presentational: it derives everything from the FRD's drift result (the one reader,
 * `lib/frds/frd-drift.ts`, DR-115) and stores no copy. It claims VERIFIED only on a FRD that is
 * verified; an unreadable drift value is shown as an error chip on any FRD (DR-078).
 */

import Link from "next/link";
import { Chip } from "@/components/core/Chip/Chip";
import type { TLState } from "@/lib/build-track/build-track";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";

export interface FrdDriftBadgeProps {
  /** FRD folder slug (test id + identity). */
  frdId: string;
  /** The FRD's rolled-up state; the badge claims VERIFIED only for `done`. */
  state: TLState;
  /** The FRD's drift result from `readFrdDrift`; absent on a timeline that never resolved it. */
  drift: FrdDriftResult | undefined;
  /** Project slug: the link keeps the embedding context (`/portfolio?project=` and `/projects/<slug>`). */
  project: string;
}

/**
 * The drift badge, or nothing when there is nothing honest to claim.
 *
 * @param props - See {@link FrdDriftBadgeProps}.
 */
export function FrdDriftBadge({
  frdId,
  state,
  drift,
  project,
}: FrdDriftBadgeProps): React.JSX.Element | null {
  if (drift === undefined || (!drift.ok && drift.reason === "missing")) return null;

  if (!drift.ok) {
    return (
      <span
        data-testid={`frd-drift-badge-${frdId}`}
        title={`No se pudo leer el campo drift del FRD: ${drift.detail}`}
      >
        <Chip tone="danger">
          <i className="ti ti-alert-octagon" aria-hidden="true" style={{ marginRight: "4px" }} />
          Deriva ilegible
        </Chip>
      </span>
    );
  }

  if (state !== "done" || drift.ids.length === 0) return null;

  const count = drift.ids.length;
  return (
    <Link
      href={`?project=${encodeURIComponent(project)}&tab=changes`}
      data-testid={`frd-drift-badge-${frdId}`}
      title={`Deriva preexistente demostrada por el gate, no bloqueante: ${drift.ids.join(", ")}. Las cards están en Cambios.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "24px",
        textDecoration: "none",
      }}
    >
      <Chip tone="warn">
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ marginRight: "4px" }} />
        Verificado · {count} {count === 1 ? "deriva" : "derivas"}
      </Chip>
    </Link>
  );
}
