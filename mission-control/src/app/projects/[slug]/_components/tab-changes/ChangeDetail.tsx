import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { SectionedMarkdown } from "@/components/modules/SectionedMarkdown/SectionedMarkdown";
import { buildCommand } from "@/lib/build-mode-store";
import { isSuspectedChange } from "@/lib/changes/change-state";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { BUILD_ENTRY_COPY } from "@/lib/constants";
import { t, tRich } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import { itemStatusLabel, STATUS_TONES } from "./changePresentation";
import styles from "./changes.module.css";

function changeCommand(item: ChangeQueueItem): string | null {
  return item.status === "building"
    ? buildCommand("resume")
    : ["ready", "draft"].includes(item.status) && !isSuspectedChange(item)
      ? buildCommand("target", `change:${item.id}`)
      : null;
}

/** Change metadata and scoped command; the parent dialog owns confirmation. */
export function ChangeDetail({ item }: { item: ChangeQueueItem }): React.JSX.Element {
  const command = changeCommand(item);
  return (
    <div data-testid="change-detail" className={styles.detail}>
      <div className={styles.chips}>
        <Chip tone={STATUS_TONES[item.status]}>{itemStatusLabel(item.status)}</Chip>
        <Chip tone={item.type === "bug" ? "coral" : "pink"}>
          {t(item.type === "bug" ? "workspace.cambios.typeBug" : "workspace.cambios.typeChange")}
        </Chip>
        {item.cls === "expedite" ? (
          <Chip tone="amber" icon="bolt">
            {t("dialogs.change.urgent")}
          </Chip>
        ) : null}
        <Chip tone="slate">{item.id}</Chip>
        {item.frd ? <Chip tone="slate">{item.frd}</Chip> : null}
      </div>
      {item.date ? <p title={item.date}>{formatDate(item.date)}</p> : null}
      {item.dependsOn ? (
        <p>
          {t("dialogs.change.dependsOn")} {item.dependsOn}
        </p>
      ) : null}
      {item.rebuildsVerified ? (
        <Notice icon="alert" tone="amber">
          <strong>{t("dialogs.change.rebuildsTitle")}</strong>
          <p>
            {item.frd
              ? tRich("dialogs.change.rebuildsBodyFrd", { frd: item.frd })
              : t("dialogs.change.rebuildsBody")}
          </p>
        </Notice>
      ) : null}
      {item.staleSuspect || item.staleHint ? (
        <Notice icon="alert" tone="amber">
          <strong>{t("workspace.cambios.suspect.evidence")}</strong>
          <p>{item.staleSuspect || item.staleHint}</p>
          <p>{t("workspace.cambios.suspect.resolve")}</p>
          <CmdRow
            variant="box"
            command={`node .pandacorp/change-reconcile.mjs --confirm-done ${item.id} --evidence "<commit o motivo>"`}
          />
          <CmdRow
            variant="box"
            command={`node .pandacorp/change-reconcile.mjs --supersede ${item.id} --reason "<decisión>"`}
          />
          <CmdRow
            variant="box"
            command={`node .pandacorp/change-reconcile.mjs --dismiss ${item.id}`}
          />
        </Notice>
      ) : null}
      <SectionedMarkdown body={item.body} />
      {item.status === "draft" && <p>{BUILD_ENTRY_COPY.draft}</p>}
      {command && <CmdRow variant="box" command={command} />}
    </div>
  );
}
