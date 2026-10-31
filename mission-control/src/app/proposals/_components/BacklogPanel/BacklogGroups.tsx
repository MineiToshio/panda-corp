"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
import styles from "./BacklogPanel.module.css";
import { BacklogRow } from "./BacklogRow";
import { PRIORITIES, PRIORITY_TONE, priorityLabel } from "./backlogPresentation";
/** Reveals loaded backlog rows through the shared paging control. */
export function BacklogList({
  items,
  pageSize,
  onSelect,
}: {
  readonly items: readonly BacklogItem[];
  readonly pageSize: number;
  readonly onSelect: (item: BacklogItem) => void;
}): React.JSX.Element {
  const [pressed, setPressed] = useState(0);
  const page = pagedReveal(items.length, pressed, pageSize);
  return (
    <>
      {items.slice(0, page.visible).map((item) => (
        <BacklogRow key={item.id} item={item} onSelect={onSelect} />
      ))}
      {page.remaining > 0 && (
        <MoreBar
          label={t("propuestas.showMore", { count: page.next, remaining: page.remaining })}
          onClick={() => setPressed(pressed + 1)}
        />
      )}
    </>
  );
}
/** Active backlog sections in doing-first, priority-grouped order. */
export function BacklogGroups({
  items,
  onSelect,
}: {
  readonly items: readonly BacklogItem[];
  readonly onSelect: (item: BacklogItem) => void;
}): React.JSX.Element {
  const doing = items.filter((x) => x.status === "doing");
  const open = items.filter((x) => x.status === "open");
  return (
    <>
      {doing.length > 0 && (
        <Card tone="violet">
          <CardHeader title={t("propuestas.backlog.doing")} count={doing.length} icon="loader" />
          <BacklogList items={doing} pageSize={20} onSelect={onSelect} />
        </Card>
      )}
      <Card tone="blue">
        <CardHeader title={t("propuestas.backlog.open")} count={open.length} icon="circle" />
        {open.length === 0 && <p>{t("propuestas.backlog.openEmpty")}</p>}
        {[...PRIORITIES, null].map((priority) => {
          const group = open.filter((x) => x.severity === priority);
          return (
            group.length > 0 && (
              <div key={priority ?? "none"}>
                <h3
                  className={`band-sub ${styles.band}`}
                  data-tone={priority ? PRIORITY_TONE[priority] : "slate"}
                >
                  {priority ? priorityLabel(priority) : t("propuestas.backlog.noPriority")} ·{" "}
                  {group.length}
                </h3>
                <BacklogList
                  items={group}
                  pageSize={priority === "p0" || priority === "p1" ? 20 : 10}
                  onSelect={onSelect}
                />
              </div>
            )
          );
        })}
      </Card>
    </>
  );
}
