import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./ListRow.module.css";

export interface ListRowProps {
  readonly title: string;
  /** Small muted line under the title. */
  readonly meta?: string;
  readonly icon?: IconName;
  readonly tone?: Tone;
  /** Non-interactive chips or commands; on phones they move under the title. */
  readonly extra?: React.ReactNode;
  /** A link row (`<a>`) or a button row (`onClick`); neither renders a static row. Never both: no nested controls. */
  readonly href?: string;
  readonly onClick?: () => void;
}

/** One list row: icon tile, title, muted line, chips, chevron when actionable. Min 56 px. */
export function ListRow({
  title,
  meta,
  icon,
  tone,
  extra,
  href,
  onClick,
}: ListRowProps): React.JSX.Element {
  const body = (
    <>
      {icon ? <BadgeIcon icon={icon} tone={tone} size="sm" /> : null}
      <span className={`grow ${styles.grow}`}>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {extra ? <span className={styles.extra}>{extra}</span> : null}
      {href || onClick ? <Icon name="chevR" /> : null}
    </>
  );
  const className = `lrow ${styles.row}`;
  if (href)
    return (
      <a className={className} href={href}>
        {body}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  return <div className={className}>{body}</div>;
}

export interface DividedListProps {
  readonly items: readonly { readonly id: string; readonly row: React.ReactNode }[];
}

/** Divided list: hairlines between rows. */
export function DividedList({ items }: DividedListProps): React.JSX.Element {
  return (
    <ul className={`divided ${styles.divided}`}>
      {items.map((item) => (
        <li key={item.id}>{item.row}</li>
      ))}
    </ul>
  );
}
