import { Chip } from "@/components/core/Chip/Chip";
import { CountPill } from "@/components/core/Chip/CountPill";
import { Icon } from "@/components/core/Icon/Icon";
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
  defaultOpen = false,
}: {
  readonly group: string;
  readonly entries: readonly EnvVar[];
  readonly defaultOpen?: boolean;
}): React.JSX.Element {
  const content = entries.map((entry) => <EnvRow key={entry.name} entry={entry} />);
  const missing = entries.filter((entry) => entry.described === false || !entry.comment).length;
  return (
    <details open={defaultOpen} className={`env-fold ${styles.envFold}`}>
      <summary>
        <Icon name="chevR" size="sm" />
        <span>{group || t("workspace.arquitectura.env.generalGroup")}</span>
        <CountPill count={entries.length} />
        {missing > 0 && (
          <Chip tone="amber" icon="alert">
            {t("workspace.arquitectura.env.missingChip", { missing, total: entries.length })}
          </Chip>
        )}
      </summary>
      {content}
    </details>
  );
}
