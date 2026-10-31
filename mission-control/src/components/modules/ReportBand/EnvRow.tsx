import type { EnvVar } from "@/lib/architecture/env";
import { t, tRich } from "@/lib/copy/copy";
import styles from "./reportBand.module.css";

/** One variable's name and purpose, never its value. */
function EnvRow({ entry }: { readonly entry: EnvVar }): React.JSX.Element {
  return (
    <div className={`envrow ${styles.envrow}`} data-testid="arch-env">
      <code>{entry.name}</code>
      <span>{entry.comment || tRich("workspace.arquitectura.env.noDescription")}</span>
    </div>
  );
}
/** Long source sections are folded; section headings never masquerade as variable descriptions. */
export function EnvFold({
  group,
  entries,
}: {
  readonly group: string;
  readonly entries: readonly EnvVar[];
}): React.JSX.Element {
  const content = entries.map((entry) => <EnvRow key={entry.name} entry={entry} />);
  if (entries.length > 12)
    return (
      <details className="env-fold">
        <summary>
          {group} · {entries.length}
        </summary>
        {content}
      </details>
    );
  return (
    <section aria-label={group}>
      <h4>{group || t("workspace.arquitectura.env.generalGroup")}</h4>
      {content}
    </section>
  );
}
