"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { projectDisplayName } from "@/lib/portfolio/displayName";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";

export function ProjectNavItem({
  project,
}: {
  readonly project: ProjectOverviewItem;
}): React.JSX.Element {
  const name = projectDisplayName(project.name);
  const current = parseNavigationUrl(usePathname() ?? "").project === project.id;
  const { tone, labelKey } = phasePresentation(project.phase);
  const phase = t(labelKey);
  const { ordersTotal: total, ordersVerified: done } = project.counts;
  const pct =
    done !== null && total !== null && total > 0
      ? Math.min(100, Math.round((done / total) * 100))
      : null;
  const label = project.orderErrors?.length
    ? `${name}: ${phase} · ${t("readerFailures.unreadFiles", { count: project.orderErrors.length })}`
    : pct !== null
      ? t("shell.projects.itemAriaWithOrders", { name, phase, pct })
      : total === 0
        ? t("shell.projects.itemAriaNoOrders", { name, phase })
        : `${name}: ${phase}`;
  return (
    <Link
      href={`/portfolio/${encodeURIComponent(project.id)}/summary`}
      className="navitem project-nav-item"
      data-tone={tone}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      <Avatar name={project.name} tone={tone} size="sm" />
      <span className="meta">
        <span>{name}</span>
        <small>
          {phase}
          {project.orderErrors?.length
            ? ` · ${t("readerFailures.unreadFiles", { count: project.orderErrors.length })}`
            : pct !== null
              ? ` · ${pct}%`
              : ""}
        </small>
      </span>
    </Link>
  );
}
