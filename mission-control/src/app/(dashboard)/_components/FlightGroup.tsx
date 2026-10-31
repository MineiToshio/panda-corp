import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { FlightGroupData } from "@/lib/inicio/flight";
import styles from "./Home.module.css";
import { TurnRow } from "./TurnRow";
/** Native disclosure, closed until the operator asks to see its rows. */
export function FlightGroup({ group }: { readonly group: FlightGroupData }): React.JSX.Element {
  return (
    <details className={`flight-group ${styles.flightGroup}`}>
      <summary>
        <span>
          <b>{t(`inicio.inFlight.${group.kind}.title`)}</b>
          <small>{t(`inicio.inFlight.${group.kind}.hint`)}</small>
        </span>
        <Chip tone="slate" variant="plain">
          {group.rows.length}
        </Chip>
        <Icon name="chevD" size="sm" />
      </summary>
      <div className={styles.turnList}>
        {group.rows.map((row) => (
          <TurnRow key={row.id} row={row} kind={group.kind} />
        ))}
      </div>
    </details>
  );
}
