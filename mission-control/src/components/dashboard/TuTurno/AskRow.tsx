"use client";
import { useState } from "react";
import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { Button } from "@/components/core/Button/Button";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { t } from "@/lib/copy/copy";
import type { OwnerTurnItem } from "@/lib/inicio/turn";
import { TurnDetailDialog } from "./TurnDetailDialog";
import styles from "./TuTurno.module.css";
/** Shared owner-action row, also mounted by the project's Resumen. */
export function AskRow({
  item,
  position,
}: {
  readonly item: OwnerTurnItem;
  readonly position?: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  function handleOpen(): void {
    setOpen(true);
  }
  function handleClose(): void {
    setOpen(false);
  }
  const decision = item.kind === "decision";
  return (
    <li className={`ask-row ${styles.row}`} data-tone={decision ? "amber" : "pink"}>
      <BadgeIcon icon={decision ? "flag" : "branch"} size="sm" />
      <div className={styles.content}>
        <strong>{item.title}</strong>
        <small>
          {item.project} · {t(decision ? "inicio.turn.kindDecision" : "inicio.turn.kindChange")} ·{" "}
          {decision ? `${item.id}${item.date ? " · " : ""}` : ""}
          {item.date ? item.ageLabel : null}
        </small>
        <div className={styles.command}>
          <CmdRow command={item.command} />
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleOpen}
        ariaLabel={t("inicio.turn.detailsAria", { title: item.title })}
        data-testid={`turn-${item.projectId}-${item.id}`}
      >
        <span data-turn={position ?? item.id}>{t("inicio.turn.details")}</span>
      </Button>
      <TurnDetailDialog item={item} open={open} onClose={handleClose} />
    </li>
  );
}
