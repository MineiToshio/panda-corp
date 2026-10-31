"use client";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { t, tRich } from "@/lib/copy/copy";
import type { OwnerTurnItem } from "@/lib/inicio/turn";
import styles from "./TuTurno.module.css";
/** Read-only decision/change explanation, with the native dialog's focus lifecycle. */
export function TurnDetailDialog({
  item,
  open,
  onClose,
}: {
  readonly item: OwnerTurnItem;
  readonly open: boolean;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  const decision = item.kind === "decision";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item.title}
      testIdBase="turn-detail"
      tone={decision ? "amber" : "pink"}
      kicker={t(decision ? "dialogs.turnDecision.kicker" : "dialogs.turnChange.kicker", {
        project: item.project,
      })}
    >
      <div className={styles.detail}>
        <p>
          {tRich(decision ? "dialogs.turnDecision.intro" : "dialogs.turnChange.intro", {
            project: item.project,
          })}
        </p>
        <div>
          <Chip tone="slate" variant="plain">
            {item.ageLabel}
          </Chip>{" "}
          <Chip tone={decision ? "amber" : "pink"} variant="plain">
            {item.id}
          </Chip>
        </div>
        {decision ? (
          <>
            <section>
              <h3>{t("dialogs.turnDecision.ask")}</h3>
              <Markdown>{item.ask ?? t("common.noContent")}</Markdown>
            </section>
            <section>
              <h3>{t("dialogs.turnDecision.recommendation")}</h3>
              <Markdown>{item.recommendation ?? t("common.noContent")}</Markdown>
            </section>
            <details>
              <summary>{t("dialogs.turnDecision.context")}</summary>
              <Markdown>{item.context ?? t("common.noContent")}</Markdown>
            </details>
            {item.ageDays !== null && item.ageDays >= 7 ? (
              <p>{t("dialogs.turnDecision.runStale", { project: item.project })}</p>
            ) : null}
          </>
        ) : (
          <>
            <Markdown>{item.body ?? t("common.noContent")}</Markdown>
            <p>{t("dialogs.turnChange.run", { project: item.project })}</p>
          </>
        )}
        <CmdRow variant="box" command={item.command} tone={decision ? "amber" : "pink"} />
      </div>
    </Modal>
  );
}
