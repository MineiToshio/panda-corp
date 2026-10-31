import { Card, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import styles from "./ProgressList.module.css";
import type { ProgressItem } from "./progressItems";

/** Recent structured progress; raw engine prose belongs only in the collapsed log. */
export function ProgressList({
  items,
  error,
}: {
  readonly items: readonly ProgressItem[];
  readonly error?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card tone="teal">
      <CardHeader title={t("workspace.resumen.progress.title")} icon="activity" />
      {error ??
        (items.length ? (
          <ul className={`progress-list ${styles.list}`}>
            {items.map((item) => {
              const body = (
                <>
                  <span className={`pg-ico ${styles.icon}`} data-tone={item.tone}>
                    <Icon name={item.tone === "green" ? "check" : "branch"} size="sm" />
                  </span>
                  <span className={`pg-main ${styles.main}`}>
                    <span className={styles.verb} data-tone={item.tone}>
                      {item.label}
                    </span>
                    <span className={styles.subject}>{item.subject}</span>
                  </span>
                  <time className={styles.date} dateTime={item.date}>
                    {formatDate(item.date)}
                  </time>
                  {item.href ? <Icon name="chevR" size="sm" /> : null}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <a className={`pg-row ${styles.row}`} href={item.href}>
                      {body}
                    </a>
                  ) : (
                    <div className={`pg-row ${styles.row}`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>{t("workspace.resumen.progress.empty")}</p>
        ))}
    </Card>
  );
}
