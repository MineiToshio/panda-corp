import { notFound } from "next/navigation";
import { useState } from "react";
import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { Seal, Secret, Unique } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import { CATEGORIES, categoryLabel } from "../../_utils/presentation";
import { nearestTrophies, RARITY_INDEX } from "../../_utils/viewRules";
import { SealTile } from "./SealTile";
import { SecretTile } from "./SecretTile";
import { TrophyCard } from "./TrophyCard";
import styles from "./trophies.module.css";

/** Category-selected conquered/nearest/locked grids and concealed secret hints. */
export function TrophiesTab({
  uniques,
  secrets,
  seals,
  onOpen,
}: {
  uniques: readonly Unique[];
  secrets: readonly Secret[];
  seals: readonly Seal[];
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const [category, setCategory] = useUrlState("category", "all");
  if (category !== "all" && !CATEGORIES.some((entry) => entry === category)) return notFound();
  const filtered = uniques.filter((item) => category === "all" || item.category === category);
  const won = filtered.filter((item) => item.unlocked);
  const nearest = nearestTrophies(filtered, category === "all" ? undefined : category);
  const todo = filtered
    .filter((item) => !item.unlocked && !nearest.includes(item))
    .sort((a, b) => RARITY_INDEX[a.rarity] - RARITY_INDEX[b.rarity]);
  const wonCount = uniques.filter((item) => item.unlocked).length;
  return (
    <div className={styles.stack}>
      <div className={styles.conquered}>
        <div className={styles.progressHead}>
          <b>
            <span className={styles.summaryBadge}>
              <BadgeIcon icon="trophy" tone="gold" size="sm" />
            </span>{" "}
            {t("logros.trophies.progress", { won: wonCount, total: uniques.length })}
          </b>
          <span>{uniques.length ? Math.round((wonCount / uniques.length) * 100) : 0}%</span>
        </div>
        <ProgressBar
          tone="gold"
          done={wonCount}
          total={uniques.length}
          ariaLabel={t("logros.trophies.won")}
        />
      </div>
      <section>
        <SectionHead
          icon="shield"
          label={t("logros.trophies.seals")}
          note={t("logros.trophies.sealsCount", {
            done: seals.filter((seal) => seal.unlocked).length,
            total: seals.length,
          })}
        />
        <div className={styles.seals}>
          {seals.map((seal) => (
            <SealTile key={seal.axis} seal={seal} />
          ))}
        </div>
      </section>
      <fieldset className={styles.filters} aria-label={t("logros.trophies.categoryAria")}>
        <FilterChip pressed={category === "all"} onClick={() => setCategory("all")}>
          {t("logros.trophies.all")} {uniques.length}
        </FilterChip>
        {CATEGORIES.map((entry) => (
          <FilterChip key={entry} pressed={category === entry} onClick={() => setCategory(entry)}>
            {categoryLabel(entry)} {uniques.filter((item) => item.category === entry).length}
          </FilterChip>
        ))}
      </fieldset>
      <TrophyGrid
        variant="won"
        title={t("logros.trophies.won")}
        items={won}
        secrets={category === "all" ? secrets.filter((secret) => secret.unlocked) : []}
        empty={t("logros.trophies.wonEmpty")}
        onOpen={onOpen}
      />
      <section>
        <SectionHead
          icon="target"
          label={t("logros.trophies.near")}
          tone="green"
          note={t("logros.trophies.nearCount", {
            shown: nearest.length,
            total: filtered.length - won.length,
          })}
        />
        <p className={styles.muted}>
          {t(
            category === "all" ? "logros.trophies.nearNotePerCategory" : "logros.trophies.nearNote",
          )}
        </p>
        <div className={styles.grid}>
          {nearest.map((trophy) => (
            <TrophyCard key={trophy.name} trophy={trophy} variant="near" onOpen={onOpen} />
          ))}
        </div>
      </section>
      <LockedGrid key={category} items={todo} onOpen={onOpen} />
      {category === "all" ? (
        <section>
          <SectionHead
            icon="sparkles"
            label={t("logros.trophies.secrets")}
            tone="violet"
            note={t("logros.trophies.secretsCount", {
              done: secrets.filter((secret) => secret.unlocked).length,
              total: secrets.length,
            })}
          />
          <div className={styles.secrets}>
            {secrets
              .filter((secret) => !secret.unlocked)
              .map((secret) => (
                <SecretTile key={secret.hint} secret={secret} onOpen={onOpen} />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
function TrophyGrid({
  variant,
  title,
  items,
  secrets = [],
  total = items.length + secrets.length,
  empty,
  onOpen,
}: {
  variant: "won" | "locked";
  title: string;
  items: readonly Unique[];
  secrets?: readonly Secret[];
  total?: number;
  empty: string;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  return (
    <section aria-label={title}>
      <SectionHead icon={variant === "won" ? "trophy" : "lock"} label={title} count={total} />
      {items.length || secrets.length ? (
        <div className={variant === "won" ? styles.grid : styles.lockedGrid}>
          {items.map((trophy) => (
            <TrophyCard key={trophy.name} trophy={trophy} onOpen={onOpen} />
          ))}
          {secrets.map((secret) => (
            <SecretTile key={secret.hint} secret={secret} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}
function LockedGrid({
  items,
  onOpen,
}: {
  items: readonly Unique[];
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const [pressed, setPressed] = useState(0);
  const reveal = pagedReveal(items.length, pressed, 12, 24);
  return (
    <section>
      <TrophyGrid
        variant="locked"
        title={t("logros.trophies.todo")}
        items={items.slice(0, reveal.visible)}
        total={items.length}
        empty={t("logros.trophies.todoEmpty")}
        onOpen={onOpen}
      />
      {reveal.remaining ? (
        <MoreBar
          label={t("propuestas.showMore", { count: reveal.next, remaining: reveal.remaining })}
          onClick={() => setPressed(pressed + 1)}
        />
      ) : null}
    </section>
  );
}
