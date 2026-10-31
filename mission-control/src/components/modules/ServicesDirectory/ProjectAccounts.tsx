import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { t } from "@/lib/copy/copy";
import type { ServicesDirectoryData } from "@/lib/services/types";
import { projectServiceRows } from "@/lib/services/views";
import { AccountsTable } from "./AccountsTable";
import { ServiceIssues } from "./ServiceIssues";
/** Project-scoped declarations, with honest empty and partial-source states. */
export function ProjectAccounts({
  data,
  projectId,
}: {
  data: ServicesDirectoryData;
  projectId: string;
}): React.JSX.Element {
  return (
    <div>
      <p>{t("workspace.cuentas.intro")}</p>
      <ServiceIssues issues={data.issues} />
      {projectServiceRows(data, projectId).length ? (
        <AccountsTable variant="project" services={data} projectId={projectId} />
      ) : (
        <EmptyState icon="cube">{t("workspace.cuentas.empty")}</EmptyState>
      )}
    </div>
  );
}
