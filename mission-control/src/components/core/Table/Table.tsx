import styles from "./Table.module.css";

export interface TableColumn {
  readonly id: string;
  readonly label: string;
}

export interface TableRow {
  readonly id: string;
  /** Cell content by column id. */
  readonly cells: Readonly<Record<string, React.ReactNode>>;
}

export interface TableProps {
  /** Accessible name of the table. */
  readonly caption: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
}

/**
 * Data table. Below 1024 px every row becomes a card from the SAME markup (CSS only): each cell carries
 * its column label in `data-label`, so the header association survives.
 */
export function Table({ caption, columns, rows }: TableProps): React.JSX.Element {
  return (
    <div className={`table-wrap ${styles.wrap}`}>
      <table className={`t ${styles.t}`}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.id} data-label={column.label}>
                  {row.cells[column.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
