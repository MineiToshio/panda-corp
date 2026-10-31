import { t } from "@/lib/copy/copy";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
export interface PulseTile {
  readonly label: string;
  readonly value: number | null;
}
const PULSE_MAX_SIGNALS = 5;
/** Three factory totals from the very same card projection Inicio renders. */
export function pulseTiles(cards: readonly ProjectOverviewItem[]): readonly PulseTile[] {
  function total(key: "frds" | "ordersVerified" | "ordersTotal"): number | null {
    if (cards.some((card) => card.counts[key] === null)) return null;
    return cards.reduce((sum, card) => sum + (card.counts[key] ?? 0), 0);
  }
  const ordersTotal = total("ordersTotal");
  return [
    { label: t("inicio.pulse.projects"), value: cards.length },
    { label: t("inicio.pulse.frds"), value: total("frds") },
    {
      label: t("inicio.pulse.orders", { total: ordersTotal ?? "?" }),
      value: total("ordersVerified"),
    },
  ].slice(0, PULSE_MAX_SIGNALS);
}
