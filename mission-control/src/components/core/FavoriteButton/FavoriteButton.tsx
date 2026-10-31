"use client";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import styles from "./FavoriteButton.module.css";
export interface FavoriteButtonProps {
  slug: string;
  title?: string;
  favorite: boolean;
  favoriteAction: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}
/** Optimistic favourite toggle; a rejected action automatically restores server truth. */
export function FavoriteButton({
  slug,
  title = slug,
  favorite,
  favoriteAction,
}: FavoriteButtonProps): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(favorite, (_previous, next: boolean) => next);
  function handleToggle(): void {
    if (pending) return;
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      await favoriteAction(slug, next);
    });
  }
  const label = t("tablero.card.favoriteAria", {
    action: t(optimistic ? "tablero.card.unfavorite" : "tablero.card.favorite"),
    title,
  });
  return (
    <button
      type="button"
      className={`iconbtn star star-toggle ${styles.star}`}
      data-testid="favorite-button"
      aria-pressed={optimistic}
      aria-label={label}
      title={label}
      aria-busy={pending}
      aria-disabled={pending}
      onClick={handleToggle}
    >
      <Icon name="star" />
    </button>
  );
}
