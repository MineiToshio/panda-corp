"use client";
import { Chip } from "@/components/core/Chip/Chip";
import type { TLState } from "@/lib/build-track/build-track";
import { t } from "@/lib/copy/copy";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";
import { navigationHref } from "@/lib/navigation/urls";
import { useWorkspaceNavigation } from "../../_components/WorkspaceNavigation";
export interface FrdDriftBadgeProps {
  frdId: string;
  state: TLState;
  drift: FrdDriftResult | undefined;
  project: string;
  navigationBaseHref?: string;
}
/** The single drift reader's result, loud on errors and conditional on verified state for ids. */
export function FrdDriftBadge({
  frdId,
  state,
  drift,
  project,
  navigationBaseHref,
}: FrdDriftBadgeProps): React.JSX.Element | null {
  const context = useWorkspaceNavigation();
  if (!drift || (!drift.ok && drift.reason === "missing")) return null;
  if (!drift.ok)
    return (
      <span className="drift-chip" data-testid={`frd-drift-badge-${frdId}`}>
        <Chip tone="coral" icon="alert">
          {t("workspace.observabilidad.drift.unreadable")}
        </Chip>
      </span>
    );
  if (state !== "done" || !drift.ids.length) return null;
  return (
    <a
      className="drift-chip"
      data-testid={`frd-drift-badge-${frdId}`}
      href={navigationHref(
        navigationBaseHref ?? context ?? `/portfolio/${encodeURIComponent(project)}/observability`,
        {
          tab: "changes",
          wo: null,
          woview: null,
          view: null,
          frd: null,
          state: null,
          dag: null,
          focus: null,
        },
      )}
    >
      <Chip tone="amber" icon="alert">
        {t("workspace.observabilidad.drift.badge", { count: drift.ids.length })}
      </Chip>
    </a>
  );
}
