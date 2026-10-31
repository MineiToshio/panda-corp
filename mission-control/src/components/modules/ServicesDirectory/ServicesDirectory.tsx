"use client";
import type { ServicesDirectoryData } from "@/lib/services/types";
import { AccountsDirectory } from "./AccountsDirectory";
import { ProjectAccounts } from "./ProjectAccounts";
/** Transitional entry point for the two workspace and portfolio consumers. */
export function ServicesDirectory({
  data,
  projectId,
}: {
  data: ServicesDirectoryData;
  projectId?: string;
}): React.JSX.Element {
  return projectId ? (
    <ProjectAccounts data={data} projectId={projectId} />
  ) : (
    <AccountsDirectory data={data} />
  );
}
