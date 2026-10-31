import type {
  ServiceAccount,
  ServiceAllocation,
  ServiceProvider,
  ServicesDirectoryData,
} from "./types";

/** One directory identity (or an explicitly unidentified provider), with its own consumers. */
export interface DirectoryAccountRow {
  readonly key: string;
  readonly provider: ServiceProvider;
  readonly account: ServiceAccount | null;
  readonly allocations: ServiceAllocation[];
  readonly state: "active" | "pending" | "candidate" | "reference";
}
/** One declared integration, even when another integration shares its provider. */
export interface ProjectServiceRow {
  readonly key: string;
  readonly provider: ServiceProvider;
  readonly account: ServiceAccount | null;
  readonly allocation: ServiceAllocation;
}
const STATUS_RANK: Readonly<Record<string, number>> = { configured: 0, proposed: 1, inactive: 2 };
function directoryState(
  provider: ServiceProvider,
  account: ServiceAccount | null,
): DirectoryAccountRow["state"] {
  if (provider.adoption === "reference") return "reference";
  if (!account) return "candidate";
  if (
    account.accessStatus !== "historical_identity_verified" ||
    !account.acceptingNewProjects ||
    account.automationStatus === "pending"
  )
    return "pending";
  return "active";
}
/** Derive private directory rows once; states are exclusive and identities never coalesce. */
export function directoryAccountRows(data: ServicesDirectoryData): DirectoryAccountRow[] {
  return data.providers
    .flatMap((provider) => {
      const accounts = data.accounts.filter((account) => account.providerId === provider.id);
      const identities: (ServiceAccount | null)[] = [...accounts];
      if (
        !accounts.length ||
        data.allocations.some((row) => row.providerId === provider.id && row.accountRef === null)
      )
        identities.push(null);
      return identities.map((account) => ({
        key: `${provider.id}:${account?.id ?? "candidate"}`,
        provider,
        account,
        allocations: data.allocations.filter(
          (row) => row.providerId === provider.id && row.accountRef === (account?.id ?? null),
        ),
        state: directoryState(provider, account),
      }));
    })
    .sort(
      (a, b) => a.provider.name.localeCompare(b.provider.name, "es") || a.key.localeCompare(b.key),
    );
}
/** Project rows derive solely from declarations, ordered by status then provider name. */
export function projectServiceRows(
  data: ServicesDirectoryData,
  projectId: string,
): ProjectServiceRow[] {
  return data.allocations
    .filter((row) => row.projectId === projectId)
    .flatMap((allocation) => {
      const provider = data.providers.find((provider) => provider.id === allocation.providerId);
      if (!provider) return [];
      return [
        {
          key: `${projectId}:${allocation.integrationId}`,
          provider,
          allocation,
          account: data.accounts.find((account) => account.id === allocation.accountRef) ?? null,
        },
      ];
    })
    .sort(
      (a, b) =>
        (STATUS_RANK[a.allocation.status] ?? 3) - (STATUS_RANK[b.allocation.status] ?? 3) ||
        a.provider.name.localeCompare(b.provider.name, "es") ||
        a.key.localeCompare(b.key),
    );
}
