"use client";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { Icon } from "@/components/core/Icon/Icon";
import { ProjectNavItem } from "@/components/modules/Nav/ProjectNavItem";
import { t } from "@/lib/copy/copy";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";

export function SidebarProjects({
  projects,
}: {
  readonly projects: readonly ProjectOverviewItem[] | null;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    try {
      setOpen(localStorage.getItem("orbita-projects-open") !== "false");
    } catch {
      /* Keep the default when browser storage is blocked. */
    }
    setReady(true);
  }, []);
  function handleToggle(): void {
    setOpen(!open);
    try {
      localStorage.setItem("orbita-projects-open", String(!open));
    } catch {
      /* The view still remembers its choice. */
    }
  }
  return (
    <div className="projnav" data-folded={!open} data-ready={ready}>
      <button
        type="button"
        className="navlabel"
        data-action="toggle-projects"
        title={t("shell.projects.toggleTitle")}
        aria-expanded={open}
        aria-controls="projlist"
        aria-label={`${t("shell.projects.label")}${projects ? ` (${projects.length})` : ""}`}
        onClick={handleToggle}
      >
        <span>{t("shell.projects.label")}</span>
        <span className="faint">
          {projects ? projects.length : null}
          <Icon name={open ? "chevD" : "chevR"} size="sm" />
        </span>
      </button>
      <div id="projlist" hidden={!open}>
        {projects?.slice(0, 5).map((project) => (
          <ProjectNavItem key={project.id} project={project} />
        ))}
        {projects && projects.length > 5 ? (
          <Link href="/portfolio" className="navitem see-all">
            <span className="lbl">{t("shell.projects.seeAll", { count: projects.length })}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
