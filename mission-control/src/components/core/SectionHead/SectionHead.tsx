import type React from "react";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import { ICON_NODES, type IconName } from "@/components/core/Icon/iconData";
import styles from "./SectionHead.module.css";

export interface SectionHeadProps {
  /** Section label text (e.g. "Tu turno", "Pulso de la fábrica"). */
  label: string;
  tone?: Tone;
  note?: string;
  link?: { href: string; label: string };
  /** Optional numeric count displayed after the trailing rule. */
  count?: number;
  /** Optional Tabler icon class (e.g. "ti-flame"). Rendered at 15px accent-text. */
  icon?: string;
  /** Optional arbitrary content placed after the trailing rule (overrides count). */
  rightHtml?: React.ReactNode;
}

function isIconName(name: string): name is IconName {
  return Object.hasOwn(ICON_NODES, name);
}

/** Neutral section heading, hue icon, hairline and optional note or trailing action. */
export function SectionHead({
  label,
  count,
  icon,
  rightHtml,
  tone = "slate",
  note,
  link,
}: SectionHeadProps): React.JSX.Element {
  return (
    <div className={`saga-head ${styles.head}`} data-testid="section-head" data-tone={tone}>
      {icon ? (
        isIconName(icon) ? (
          <Icon name={icon} size="sm" />
        ) : (
          <i className={`ti ${icon}`} aria-hidden="true" />
        )
      ) : null}
      <span>{label}</span>
      {note ? <span className={styles.note}>{note}</span> : null}
      <span
        className={`saga-line ${styles.line}`}
        data-testid="section-head-rule"
        aria-hidden="true"
      />
      {rightHtml != null ? (
        <span data-testid="section-head-right">{rightHtml}</span>
      ) : count != null ? (
        <span className={`num ${styles.note}`} data-testid="section-head-count">
          {count}
        </span>
      ) : null}
      {link ? (
        <a className={styles.link} href={link.href}>
          {link.label}
        </a>
      ) : null}
    </div>
  );
}
