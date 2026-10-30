import styles from "./Dialog.module.css";

export interface SheetRow {
  readonly id: string;
  readonly label: string;
  readonly content: React.ReactNode;
}

export interface DialogSheetProps {
  readonly rows: readonly SheetRow[];
}

/** Label | content rows for detail dialogs (128 px label column), placed inside a `Modal`. */
export function DialogSheet({ rows }: DialogSheetProps): React.JSX.Element {
  return (
    <dl className={`dsheet ${styles.sheet}`}>
      {rows.map((row) => (
        <div key={row.id} className={styles.row}>
          <dt>{row.label}</dt>
          <dd>{row.content}</dd>
        </div>
      ))}
    </dl>
  );
}
