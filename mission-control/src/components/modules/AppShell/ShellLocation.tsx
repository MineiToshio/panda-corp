"use client";
import { usePathname } from "next/navigation";
import { navActive } from "@/components/modules/Nav/navActive";
import { NAV_DESTINATIONS } from "@/lib/constants";
import { type CopyKey, t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import { projectDisplayName } from "@/lib/portfolio/displayName";

const TAB_LABELS: Readonly<Record<string, CopyKey>> = {
  summary: "common.workspaceTabs.resumen",
  party: "common.workspaceTabs.resumen",
  "work-orders": "common.workspaceTabs.observabilidad",
  spec: "common.workspaceTabs.spec",
  observability: "common.workspaceTabs.observabilidad",
  architecture: "common.workspaceTabs.arquitectura",
  accounts: "common.workspaceTabs.cuentas",
  changes: "common.workspaceTabs.cambios",
  documents: "common.workspaceTabs.documentos",
  commands: "common.workspaceTabs.comandos",
};
/** Phone location follows the canonical URL and the same project names as the sidebar. */
export function ShellLocation({
  projects,
}: {
  readonly projects: readonly { readonly id: string; readonly name: string }[] | null;
}): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const [projectId] = useUrlState("project", "");
  const [tab] = useUrlState("tab", "summary");
  const project = projects?.find((item) => item.id === projectId);
  const destination = NAV_DESTINATIONS.find((item) => item.id === navActive(pathname));
  const title =
    (project ? projectDisplayName(project.name) : null) ??
    (destination ? t(destination.labelKey) : t("shell.brand.name"));
  const subtitle = project
    ? TAB_LABELS[tab]
      ? t(TAB_LABELS[tab])
      : t("portafolio.notFoundSection.title")
    : t("shell.brand.product");
  return (
    <>
      <span title={title}>{title}</span>
      <small>{subtitle}</small>
    </>
  );
}
