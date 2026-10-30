import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { CountPill } from "@/components/core/Chip/CountPill";
import type { Tone } from "@/components/core/Chip/vocabulary";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./Card.module.css";

export interface CardProps {
  /** Hue of the card's header tile, count pill and tinted gradient. */
  readonly tone?: Tone;
  /** `flush` has no padding (a divided list inside); `tinted` adds the hue's top gradient. */
  readonly variant?: "default" | "flush" | "tinted";
  readonly children: React.ReactNode;
}

/** The one surface container: hairline border, 16 px radius, tokens only. */
export function Card({ tone, variant = "default", children }: CardProps): React.JSX.Element {
  const extra = variant === "default" ? "" : ` ${styles[variant]}`;
  return (
    <section className={`card ${styles.card}${extra}`} data-tone={tone}>
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  readonly title: string;
  /** Heading level of the title; the visual size is the same at every level. */
  readonly level?: 2 | 3 | 4;
  readonly icon?: IconName;
  readonly count?: number;
  /** Optional action (button or link) at the right. */
  readonly action?: React.ReactNode;
}

/** Card header: tinted icon tile, ONE title size, count pill in the same hue, optional action. */
export function CardHeader({
  title,
  level = 2,
  icon,
  count,
  action,
}: CardHeaderProps): React.JSX.Element {
  const Heading = `h${level}` as const;
  return (
    <div className={`card-head ${styles.head}`}>
      <Heading className={`card-title ${styles.title}`}>
        {icon ? <BadgeIcon icon={icon} size="sm" /> : null}
        {title}
        {count === undefined ? null : <CountPill count={count} />}
      </Heading>
      {action}
    </div>
  );
}

/** Card footer: top hairline, actions on a wrapping row. */
export function CardFoot({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <div className={`card-foot ${styles.foot}`}>{children}</div>;
}
