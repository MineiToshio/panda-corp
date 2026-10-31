import { Notice } from "@/components/core/Notice/Notice";
import { t, tRich } from "@/lib/copy/copy";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";
import { navigationHref } from "@/lib/navigation/urls";
/** Expanded drift explanation with its exact ids and a link to the change queue. */
export function DriftNote({
  frdId,
  state,
  drift,
  href,
}: {
  frdId: string;
  state: string;
  drift?: FrdDriftResult;
  href: string;
}): React.JSX.Element | null {
  if (
    !drift ||
    (!drift.ok && drift.reason === "missing") ||
    (drift.ok && (state !== "done" || !drift.ids.length))
  )
    return null;
  return (
    <div className="drift-note">
      <Notice icon="alert" tone="amber" kind={drift.ok ? "info" : "error"}>
        {drift.ok
          ? t("workspace.observabilidad.drift.note", {
              count: drift.ids.length,
              ids: drift.ids.join(", "),
            })
          : tRich("workspace.observabilidad.drift.unreadableNote", { code: frdId })}
        {drift.ok && (
          <a
            href={navigationHref(href, {
              tab: "changes",
              view: null,
              frd: null,
              state: null,
              dag: null,
              focus: null,
            })}
          >
            {t("workspace.observabilidad.drift.seeInChanges")}
          </a>
        )}
      </Notice>
    </div>
  );
}
