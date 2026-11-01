"use client";
import Link from "next/link";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { Segmented } from "@/components/core/Segmented/Segmented";
import { Table } from "@/components/core/Table/Table";
import { FirstProjectCard } from "@/components/modules/ProjectCard/FirstProjectCard";
import { ProjectCard } from "@/components/modules/ProjectCard/ProjectCard";
import { AccountsDirectory } from "@/components/modules/ServicesDirectory/AccountsDirectory";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import type { ServicesDirectoryData } from "@/lib/services/types";
import styles from "./PortfolioOverview.module.css";

const COLUMN_IDS = [
  "project",
  "phase",
  "workOrders",
  "frds",
  "docs",
  "adrs",
  "openChanges",
  "decisions",
] as const;

function Comparison({ projects }: { readonly projects: ProjectOverviewItem[] }): React.JSX.Element {
  const columns = COLUMN_IDS.map((id) => ({
    id,
    label: t(`portafolio.compare.columns.${id}`),
    mobileSpan:
      id === "project"
        ? ("main" as const)
        : id === "phase"
          ? ("end" as const)
          : id === "workOrders"
            ? ("full" as const)
            : undefined,
    mobileLabel:
      id === "project" || id === "phase"
        ? undefined
        : t(`portafolio.compare.mobileLabels.${id === "openChanges" ? "changes" : id}`),
  }));
  const rows = projects.map((project) => {
    const { tone, labelKey } = phasePresentation(project.phase);
    const c = project.counts;
    return {
      id: project.id,
      cells: {
        project: (
          <Link
            className={styles.project}
            href={`/portfolio/${encodeURIComponent(project.id)}/summary`}
          >
            <Avatar name={project.name} tone={tone} size="sm" />
            {project.name}
          </Link>
        ),
        phase: (
          <Chip tone={tone} icon="dot">
            {t(labelKey)}
          </Chip>
        ),
        workOrders:
          c.ordersTotal !== null && c.ordersVerified !== null ? (
            <div className={styles.orders}>
              <ProgressBar
                done={c.ordersVerified}
                total={c.ordersTotal}
                tone={tone}
                ariaLabel={t("inicio.projectCard.ringTip", {
                  done: c.ordersVerified,
                  total: c.ordersTotal,
                })}
              />
              <span>
                {c.ordersVerified}/{c.ordersTotal}
              </span>
            </div>
          ) : project.orderErrors?.length ? (
            <Link
              className={styles.readFailure}
              href={`/portfolio/${encodeURIComponent(project.id)}/observability`}
            >
              {t("readerFailures.unreadFiles", { count: project.orderErrors.length })}
            </Link>
          ) : (
            "—"
          ),
        frds: c.frds ?? "—",
        docs: c.docs ?? "—",
        adrs: c.adrs ?? "—",
        openChanges:
          c.openChanges ??
          (project.pathMissing ? (
            "—"
          ) : (
            <Link
              className={styles.readFailure}
              href={`/portfolio/${encodeURIComponent(project.id)}/changes`}
            >
              {t("inicio.worktrees.unreadable")}
            </Link>
          )),
        decisions: c.pendingDecisions ?? "—",
      },
    };
  });
  return (
    <Card variant="flush">
      <div className={styles.tableHead}>
        <CardHeader title={t("portafolio.compare.title")} />
      </div>
      <Table caption={t("portafolio.compare.aria")} columns={columns} rows={rows} />
    </Card>
  );
}

/** URL is the only view state, including Back/Forward and reload. */
export function PortfolioOverview({
  projects,
  directory,
  resolvedView = "tarjetas",
}: {
  readonly projects: ProjectOverviewItem[];
  readonly directory: ServicesDirectoryData;
  readonly resolvedView?: string;
}): React.JSX.Element {
  const [urlView, setView] = useUrlState("view", "");
  const [legacyView] = useUrlState("portfolioView", "");
  const view = urlView || (legacyView === "accounts" ? resolvedView : "tarjetas");
  return (
    <div className={styles.overview}>
      <div className={styles.toolbar}>
        <Segmented
          label={t("portafolio.views.aria")}
          value={view}
          onChange={setView}
          options={[
            { value: "tarjetas", icon: "grid", label: t("portafolio.views.cards") },
            { value: "lista", icon: "list", label: t("portafolio.views.list") },
            { value: "cuentas", icon: "users", label: t("portafolio.views.accounts") },
          ]}
        />
        <span className={styles.hint}>
          {t(view === "cuentas" ? "portafolio.views.hintAccounts" : "portafolio.views.hintSorted")}
        </span>
      </div>
      {view === "cuentas" ? (
        <AccountsDirectory data={directory} />
      ) : projects.length === 0 ? (
        <FirstProjectCard />
      ) : view === "lista" ? (
        <Comparison projects={projects} />
      ) : (
        <div className={`proj-cards ${styles.cards}`}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
