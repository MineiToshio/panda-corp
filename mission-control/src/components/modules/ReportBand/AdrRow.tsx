import type { Adr } from "@/lib/architecture/adr";
import styles from "./reportBand.module.css";

/** The entire ADR row opens its document dialog. */
export function AdrRow({
  adr,
  onOpen,
}: {
  readonly adr: Adr;
  readonly onOpen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className={`adr-row ${styles.adr}`} onClick={onOpen}>
      <code className={styles.adrId}>{adr.id}</code>
      <span className={styles.adrSummary}>
        <b>{adr.title}</b>
        <span title={adr.decision}>{adr.decision}</span>
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}
