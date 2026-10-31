import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Chip } from "@/components/core/Chip/Chip";
import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import { FavoriteButton } from "@/components/core/FavoriteButton/FavoriteButton";
import { Icon } from "@/components/core/Icon/Icon";
import { Notice } from "@/components/core/Notice/Notice";
import { RestoreButton } from "@/components/core/RestoreButton/RestoreButton";
import { CATEGORY_LABELS, RETURN_LABELS } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn } from "@/lib/board/board";
import { t } from "@/lib/copy/copy";
import type { DiscardResult } from "@/lib/discard/discard";
import type { RestoreResult } from "@/lib/discard/restore";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import type { IdeaCard } from "@/lib/ideas/ideas";
import styles from "./IdeaHeader.module.css";

const STAGES = {
  discovered: "common.phases.discovered",
  documented: "common.phases.product",
  design: "common.phases.design",
  architecture: "common.phases.architecture",
  building: "common.phases.implementation",
  shipped: "common.phases.release",
  discarded: "idea.header.stageDiscarded",
} as const;

/** Drill-in header with the idea's title, stage and reversible actions. */
export function IdeaHeader({
  card,
  column,
  forgeHref,
  discardAction,
  restoreAction,
  favoriteAction,
}: {
  readonly card: IdeaCard;
  readonly column: BoardColumn;
  readonly forgeHref?: string;
  readonly discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
  readonly restoreAction: (slug: string) => Promise<RestoreResult>;
  readonly favoriteAction: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}): React.JSX.Element {
  return (
    <>
      <header className={`idea-head ${styles.header}`} data-tone="amber">
        <div className={`idea-title ${styles.title}`}>
          <BadgeIcon icon="bulb" tone="amber" />
          <h1>{card.title}</h1>
          <div className={styles.meta}>
            {card.projectType && (
              <Chip tone="slate">{CATEGORY_LABELS[card.projectType]?.[0] ?? card.projectType}</Chip>
            )}
            {card.returnType && (
              <Chip tone="slate">{RETURN_LABELS[card.returnType]?.[0] ?? card.returnType}</Chip>
            )}
            {card.score !== undefined && (
              <span>{t("idea.header.scoreOf", { score: card.score })}</span>
            )}
          </div>
        </div>
        <p className={`idea-stage ${styles.stage}`}>
          {card.status === "discarded"
            ? t("idea.header.stageDiscarded")
            : t("idea.header.stage", {
                phase: t(STAGES[column]),
              })}
        </p>
        <div className={`idea-actions ${styles.actions}`}>
          <ButtonLink look="button" size="sm" href="/board">
            <Icon name="back" size="sm" />
            {t("idea.header.backLong")}
          </ButtonLink>
          <span className={styles.buttons}>
            <FavoriteButton
              slug={card.slug}
              title={card.title}
              favorite={card.favorite === true}
              favoriteAction={favoriteAction}
            />
            {forgeHref && (
              <ButtonLink look="button" size="sm" href={forgeHref}>
                {t("idea.header.openInPortfolioLong")}
              </ButtonLink>
            )}
            {card.status === "discarded" ? (
              <RestoreButton slug={card.slug} title={card.title} restoreAction={restoreAction} />
            ) : (
              card.status !== "shipped" && (
                <DiscardButton slug={card.slug} title={card.title} discardAction={discardAction} />
              )
            )}
          </span>
        </div>
      </header>
      {card.status === "discarded" && (
        <Notice icon="archive">
          <strong>{t("idea.discarded.title")}</strong>
          <p>
            {card.discardReason
              ? t("idea.discarded.reason", { reason: card.discardReason })
              : t("idea.discarded.noReason")}
          </p>
          <p>{t("idea.discarded.restoreHint")}</p>
        </Notice>
      )}
    </>
  );
}
