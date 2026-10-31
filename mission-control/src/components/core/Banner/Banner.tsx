"use client";

import { useState } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import { ICON_NODES, type IconName } from "@/components/core/Icon/iconData";
import { t } from "@/lib/copy/copy";
import styles from "./Banner.module.css";

type BannerTone = "warn" | "info" | "ok" | "danger";
type BannerKind = "drift" | "gate" | "error" | "inline";

interface BannerItem {
  id: string;
  label: string;
}

export interface BannerProps {
  /** Visual tone — sets color scheme (via CSS custom properties only). */
  tone: BannerTone;
  /** Consumer context — identifies what kind of condition this banner represents. */
  kind?: BannerKind;
  /**
   * Optional Tabler icon class (e.g. "ti-alert-triangle") shown left of the heading,
   * matching the prototype's per-banner glyph. Falls back to the tone SVG when omitted.
   */
  icon?: string;
  /** Required heading (primary signal, always visible). */
  heading: string;
  /** Optional secondary detail line. */
  detail?: string;
  /**
   * Optional extra body content rendered between `detail` and `commandRow`.
   * Use for recall/recovery sequences (e.g. FRD-15 drift recall steps).
   * Rendered as-is — consumer is responsible for tokens and testids.
   */
  children?: React.ReactNode;
  /** Optional mono command to display in a command row with a copy button. */
  commandRow?: string;
  /** If true, renders a keyboard-operable dismiss × button. */
  dismissible?: boolean;
  /** Called when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Optional list of items to display below the heading (multi-item mode). */
  items?: BannerItem[];
  /** Collapse items list beyond this count; shows a toggle. */
  collapseAfter?: number;
}

const PRESENTATION = {
  warn: { icon: "alert" },
  info: { icon: "circle" },
  ok: { icon: "check" },
  danger: { icon: "x" },
} as const satisfies Record<BannerTone, { icon: IconName }>;

function isIconName(name: string): name is IconName {
  return Object.hasOwn(ICON_NODES, name);
}

function BannerIcon({ icon, tone }: { icon?: string; tone: BannerTone }): React.JSX.Element {
  if (icon !== undefined && !isIconName(icon)) {
    return <i className={`ti ${icon}`} data-testid="banner-icon" aria-hidden="true" />;
  }
  return (
    <span data-testid="banner-icon" aria-hidden="true">
      <Icon name={icon ?? PRESENTATION[tone].icon} size="lg" />
    </span>
  );
}

/** Shared alert banner and command box. Legacy tone values remain accepted during migration. */
export function Banner({
  tone,
  kind,
  icon,
  heading,
  detail,
  children,
  commandRow,
  dismissible,
  onDismiss,
  items,
  collapseAfter,
}: BannerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const safeItems = Array.isArray(items) ? items : [];
  const limit = collapseAfter === undefined ? safeItems.length : Math.max(0, collapseAfter);
  const shouldCollapse = safeItems.length > limit;
  const shownItems = shouldCollapse && !expanded ? safeItems.slice(0, limit) : safeItems;
  const hiddenCount = safeItems.length - limit;
  function handleToggle(): void {
    setExpanded((previous) => !previous);
  }
  return (
    <div
      className={`alert-banner ${styles.banner}`}
      data-testid="banner"
      data-tone={tone}
      data-kind={kind}
      role="alert"
      aria-label={heading}
      style={{ "--tone": "var(--coral)" } as React.CSSProperties}
    >
      <BannerIcon icon={icon} tone={tone} />
      <div className={styles.body}>
        <h2>{heading}</h2>
        {detail !== undefined ? <p data-testid="banner-detail">{detail}</p> : null}
        {children}
        {shownItems.map((item) => (
          <p key={item.id}>{item.label}</p>
        ))}
        {shouldCollapse ? (
          <button
            className={styles.toggle}
            type="button"
            data-testid="banner-collapse-toggle"
            aria-expanded={expanded}
            onClick={handleToggle}
          >
            {expanded
              ? "Ver menos"
              : `Ver ${hiddenCount} elemento${hiddenCount === 1 ? "" : "s"} más`}
          </button>
        ) : null}
        {commandRow !== undefined ? (
          <div data-testid="banner-cmd-row" className={styles.command}>
            <CmdRow command={commandRow} variant="box" />
          </div>
        ) : null}
      </div>
      {dismissible ? (
        <button
          type="button"
          className={styles.dismiss}
          data-testid="banner-dismiss"
          aria-label={t("dialogs.default.close")}
          onClick={onDismiss}
        >
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}
