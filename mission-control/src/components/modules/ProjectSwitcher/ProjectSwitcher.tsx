"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { SearchField } from "@/components/core/Field/Field";
import { Icon } from "@/components/core/Icon/Icon";
import { DividedList, ListRow } from "@/components/core/ListRow/ListRow";
import { Modal } from "@/components/core/Modal/Modal";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { t } from "@/lib/copy/copy";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import styles from "./ProjectSwitcher.module.css";

export function ProjectSwitcher({
  projects,
  currentId,
}: {
  readonly projects: ProjectOverviewItem[];
  readonly currentId: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) search.current?.querySelector("input")?.focus();
  }, [open]);
  function handleOpen(): void {
    setQuery("");
    setOpen(true);
  }
  function handleClose(): void {
    setOpen(false);
  }
  const filtered = projects.filter((project) =>
    project.name.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")),
  );
  return (
    <>
      <Button
        variant="default"
        icon="folder"
        className="switcher"
        ariaLabel={t("workspace.hero.switcher.label")}
        onClick={handleOpen}
      >
        <span>
          <b>{t("workspace.hero.switcher.label")}</b>
          <small>{t("workspace.hero.switcher.count", { count: projects.length })}</small>
        </span>
        <Icon name="chevD" size="sm" />
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        title={t("dialogs.projectPicker.title")}
        kicker={t("dialogs.projectPicker.kicker")}
        testIdBase="project-picker"
      >
        <div className={styles.body}>
          <div ref={search}>
            <SearchField
              label={t("dialogs.projectPicker.searchAria")}
              placeholder={t("dialogs.projectPicker.searchPlaceholder")}
              value={query}
              onChange={setQuery}
            />
          </div>
          <DividedList
            items={filtered.map((project) => {
              const { tone, labelKey } = phasePresentation(project.phase);
              const c = project.counts;
              const orders = orderLabel(project);
              return {
                id: project.id,
                row: (
                  <div className={styles.row}>
                    <ListRow
                      title={project.name}
                      meta={t("dialogs.projectPicker.meta", {
                        phase: t(labelKey),
                        frds: c.frds ?? "—",
                        docs: c.docs ?? "—",
                        orders,
                      })}
                      href={`/portfolio/${encodeURIComponent(project.id)}/summary`}
                      extra={
                        <>
                          <span className={styles.avatar}>
                            <Avatar name={project.name} tone={tone} />
                          </span>
                          {c.ordersVerified !== null &&
                          c.ordersTotal !== null &&
                          c.ordersTotal > 0 ? (
                            <span className={styles.progress}>
                              <ProgressBar
                                done={c.ordersVerified}
                                total={c.ordersTotal}
                                tone={tone}
                                ariaLabel={t("inicio.projectCard.ringTip", {
                                  done: c.ordersVerified,
                                  total: c.ordersTotal,
                                })}
                              />
                            </span>
                          ) : null}
                          {project.id === currentId ? (
                            <span className={styles.current}>
                              <Chip tone="slate" variant="plain">
                                {t("dialogs.projectPicker.current")}
                              </Chip>
                            </span>
                          ) : null}
                        </>
                      }
                    />
                  </div>
                ),
              };
            })}
          />
        </div>
      </Modal>
    </>
  );
}

function orderLabel(project: ProjectOverviewItem): string {
  const c = project.counts;
  return c.ordersTotal === 0
    ? t("dialogs.projectPicker.noOrders")
    : c.ordersVerified !== null && c.ordersTotal !== null
      ? t("dialogs.projectPicker.ordersProgress", {
          done: c.ordersVerified,
          total: c.ordersTotal,
        })
      : project.orderErrors?.length
        ? t("readerFailures.unreadFiles", { count: project.orderErrors.length })
        : t("common.relativeTime.noRecord");
}
