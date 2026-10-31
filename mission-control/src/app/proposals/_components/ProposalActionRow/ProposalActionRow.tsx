import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import { t } from "@/lib/copy/copy";
import type { OwnerAction, OwnerActionKind } from "@/lib/proposals/ownerActions";
import styles from "../ProposalsSummary/Proposals.module.css";
import { ProposalsTabLink } from "../ProposalsTabs/ProposalsTabs";

const META = {
  urgent: { tone: "coral", icon: "alert" },
  decide: { tone: "teal", icon: "bulb" },
  important: { tone: "amber", icon: "settings" },
  ideas: { tone: "blue", icon: "search" },
  memoryStale: { tone: "teal", icon: "clock" },
} as const satisfies Record<OwnerActionKind, { tone: string; icon: IconName }>;
/** Ordered owner action with reason, command, execution location and detail link. */
export function ProposalActionRow({
  action,
  index,
}: {
  readonly action: OwnerAction;
  readonly index: number;
}): React.JSX.Element {
  const meta = META[action.kind];
  const why =
    action.kind === "urgent"
      ? t(
          action.count === 1
            ? "propuestas.actions.urgent.whyOne"
            : "propuestas.actions.urgent.whyMany",
          { title: action.firstTitle ?? "" },
        )
      : t(`propuestas.actions.${action.kind}.why`);
  return (
    <li className={`pa-row ${styles.action}`} data-tone={meta.tone}>
      <span className={`pa-n ${styles.number}`}>{index + 1}</span>
      <div className={styles.actionBody}>
        <span className={styles.kind}>
          <Icon name={meta.icon} />
          {t(`propuestas.actions.${action.kind}.kind`)}
        </span>
        <h3>{t(`propuestas.actions.${action.kind}.title`, { count: action.count })}</h3>
        <p>{why}</p>
        <div className="pa-cmd">
          <CmdRow command={action.command} variant="box" />
        </div>
        <p>
          {t("propuestas.summary.runIt", { where: t(`propuestas.actions.${action.kind}.where`) })}
        </p>
        <ProposalsTabLink href={action.href} className={styles.link}>
          {t(`propuestas.actions.${action.kind}.link`)}
          <Icon name="arrow" />
        </ProposalsTabLink>
      </div>
    </li>
  );
}
