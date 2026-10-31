import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
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

const STAGE_TONES = {
  discovered: "teal",
  documented: "blue",
  design: "pink",
  architecture: "amber",
  building: "violet",
  shipped: "green",
  discarded: "slate",
} as const satisfies Record<keyof typeof STAGES, Tone>;

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
  const tone = card.status === "discarded" ? "slate" : STAGE_TONES[column];
  return (
    <>
      <header className={`idea-head ${styles.header}`} data-tone={tone}>
        <div className={`idea-title ${styles.title}`}>
          <BadgeIcon icon="bulb" tone={tone} />
          <h1>{card.title}</h1>
          <div className={`row ${styles.meta}`}>
            {card.projectType && (
              <Chip tone="slate" variant="plain">
                {CATEGORY_LABELS[card.projectType]?.[0] ?? card.projectType}
              </Chip>
            )}
            {card.returnType && (
              <Chip tone={RETURN_LABELS[card.returnType]?.[1] ?? "slate"}>
                {RETURN_LABELS[card.returnType]?.[0] ?? card.returnType}
              </Chip>
            )}
            <span>
              {card.score
                ? t("idea.header.scoreOf", { score: card.score })
                : t("tablero.card.noScore")}
            </span>
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
            <span aria-hidden="true" className={styles.longLabel}>
              {t("idea.header.backLong")}
            </span>
            <span aria-hidden="true" className={styles.shortLabel}>
              {t("idea.header.backShort")}
            </span>
            <span className="sr-only">{t("idea.header.backLong")}</span>
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
                <span aria-hidden="true" className={styles.longLabel}>
                  {t("idea.header.openInPortfolioLong")}
                </span>
                <span aria-hidden="true" className={styles.shortLabel}>
                  {t("idea.header.openInPortfolioShort")}
                </span>
                <span className="sr-only">{t("idea.header.openInPortfolioLong")}</span>
                <Icon name="arrow" size="sm" />
              </ButtonLink>
            )}
            {card.status === "discarded" ? (
              <RestoreButton slug={card.slug} title={card.title} restoreAction={restoreAction} />
            ) : (
              card.status !== "shipped" && (
                <DiscardButton
                  slug={card.slug}
                  title={card.title}
                  discardAction={discardAction}
                  compactOnPhone
                />
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
