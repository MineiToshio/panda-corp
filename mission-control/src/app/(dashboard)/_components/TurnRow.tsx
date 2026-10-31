import Link from "next/link";
import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { t } from "@/lib/copy/copy";
import type { FlightKind, FlightRow } from "@/lib/inicio/flight";
import styles from "./Home.module.css";
/** Navigation to work already owned by the factory. */
export function TurnRow({
  row,
  kind,
}: {
  readonly row: FlightRow;
  readonly kind: FlightKind;
}): React.JSX.Element {
  return (
    <div
      className={`turn ${styles.turn}`}
      data-tone={kind === "review" ? "amber" : kind === "building" ? "violet" : "slate"}
    >
      <BadgeIcon icon={kind === "review" ? "eye" : kind === "building" ? "bolt" : "file"} />
      <div>
        <span className={styles.kind}>{t(`inicio.attention.${kind}.kind`)}</span>
        <strong>{row.title}</strong>
        <small>{t(`inicio.attention.${kind}.sub`, { project: row.project })}</small>
      </div>
      <Link href={row.href}>{t(`inicio.attention.${kind}.verb`)}</Link>
    </div>
  );
}
