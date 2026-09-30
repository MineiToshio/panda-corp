/**
 * LastSyncChip — the relative "last sync" chip of a portfolio rail row (REQ-03-007, AC-03-007.3).
 *
 * Built on the one shared `Chip` pill. The text carries the meaning ("sync: hace 2 días" or
 * "sync: fecha inválida"), never color alone; an unparseable date is shown explicitly, never hidden
 * (DR-078). The wrapper exposes the raw date as a tooltip.
 */

import { Chip } from "@/components/core/Chip/Chip";
import { formatLastSync } from "@/lib/portfolio/formatLastSync";

const CHIP_LINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  marginTop: "4px",
  marginLeft: "22px",
};

/** Renders the chip for a raw `lastSync` cell, formatted against the current time. */
export function LastSyncChip({ lastSync }: { lastSync: string }): React.JSX.Element {
  const result = formatLastSync(lastSync);

  return (
    <span data-testid="portfolio-row-last-sync" title={lastSync} style={CHIP_LINE_STYLE}>
      <Chip tone={result.ok ? "secondary" : "warn"}>
        {result.ok ? `sync: ${result.label}` : "sync: fecha inválida"}
      </Chip>
    </span>
  );
}
