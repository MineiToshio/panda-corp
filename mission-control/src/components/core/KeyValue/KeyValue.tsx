import styles from "./KeyValue.module.css";

export interface KeyValueProps {
  /** Label and value pairs, rendered as a description list in order. */
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: React.ReactNode;
  }[];
}

/** Two-column description list: muted term, wrapping value. */
export function KeyValue({ items }: KeyValueProps): React.JSX.Element {
  return (
    <dl className={`kv ${styles.kv}`}>
      {items.map((item) => (
        <div key={item.id} className="contents">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
