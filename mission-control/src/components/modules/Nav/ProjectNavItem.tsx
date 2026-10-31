import Link from "next/link";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";

export function ProjectNavItem({
  project,
}: {
  readonly project: ProjectOverviewItem;
}): React.JSX.Element {
  const { tone, labelKey } = phasePresentation(project.phase);
  const phase = t(labelKey);
  const { ordersTotal: total, ordersVerified: done } = project.counts;
  const pct =
    done !== null && total !== null && total > 0
      ? Math.min(100, Math.round((done / total) * 100))
      : null;
  const label =
    pct !== null
      ? t("shell.projects.itemAriaWithOrders", { name: project.name, phase, pct })
      : total === 0
        ? t("shell.projects.itemAriaNoOrders", { name: project.name, phase })
        : `${project.name}: ${phase}`;
  return (
    <Link
      href={`/portfolio/${encodeURIComponent(project.id)}/summary`}
      className="navitem project-nav-item"
      data-tone={tone}
      aria-label={label}
    >
      <Avatar name={project.name} tone={tone} />
      <span className="meta">
        <span>{project.name}</span>
        <small>
          {phase}
          {pct !== null ? ` · ${pct}%` : ""}
        </small>
      </span>
    </Link>
  );
}
