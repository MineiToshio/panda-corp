"use client";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import type {
  ServiceAccount,
  ServiceAllocation,
  ServiceProvider,
  ServicesDirectoryData,
} from "@/lib/services/types";
import { servicesCopy as c, serviceStateLabel } from "./copy";

interface DirectoryRow {
  provider: ServiceProvider;
  account: ServiceAccount | null;
  allocations: ServiceAllocation[];
}
/** Derive display rows without fabricating account identities for candidate providers. */
export function directoryRows(data: ServicesDirectoryData, projectId?: string): DirectoryRow[] {
  return data.providers.flatMap((provider) => {
    const allocations = data.allocations.filter(
      (row) => row.providerId === provider.id && (!projectId || row.projectId === projectId),
    );
    if (projectId && !allocations.length) return [];
    const accounts = data.accounts.filter(
      (account) =>
        account.providerId === provider.id &&
        (!projectId || allocations.some((row) => row.accountRef === account.id)),
    );
    const rows: DirectoryRow[] = accounts.map((account) => ({
      provider,
      account,
      allocations: allocations.filter((row) => row.accountRef === account.id),
    }));
    if (!accounts.length || allocations.some((row) => row.accountRef === null))
      rows.push({
        provider,
        account: null,
        allocations: allocations.filter((row) => row.accountRef === null),
      });
    return rows;
  });
}
function matches(row: DirectoryRow, query: string, filter: string): boolean {
  const { provider, account, allocations } = row;
  if (
    query &&
    ![
      provider.name,
      provider.type,
      account?.loginEmail,
      account?.displayName,
      ...allocations.map((row) => row.projectName),
    ].some((value) => value?.toLocaleLowerCase().includes(query))
  )
    return false;
  if (filter === "reference") return provider.adoption === "reference";
  if (filter === "candidates") return !account;
  if (filter === "active")
    return (
      !!account &&
      account.acceptingNewProjects &&
      account.accessStatus === "historical_identity_verified"
    );
  if (filter === "pending")
    return (
      account?.accessStatus !== "historical_identity_verified" ||
      account?.automationStatus === "pending"
    );
  return true;
}
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}
function AllocationList({ allocations }: { allocations: ServiceAllocation[] }): React.JSX.Element {
  return (
    <>
      <h4>{c.projects}</h4>
      {allocations.length ? (
        <ul>
          {allocations.map((row) => (
            <li key={`${row.projectId}-${row.integrationId}`}>
              {row.projectHref ? (
                <Link href={row.projectHref}>{row.projectName}</Link>
              ) : (
                row.projectName
              )}{" "}
              · {serviceStateLabel(row.status)}
              {row.resources.length > 0 && (
                <ul aria-label={c.resources}>
                  {row.resources.map((resource) => (
                    <li key={resource.environment}>
                      <strong>{resource.environment}</strong>: {resource.resourceName ?? c.unknown}
                      {resource.nativeResourceId && ` (${resource.nativeResourceId})`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{c.noProjects}</p>
      )}
    </>
  );
}
function AccountFacts({
  account,
  provider,
}: {
  account: ServiceAccount | null;
  provider: ServiceProvider;
}): React.JSX.Element {
  return (
    <>
      <dl className="services-facts">
        <dt>{c.email}</dt>
        <dd>{account?.loginEmail ?? c.unknown}</dd>
        <dt>{c.organization}</dt>
        <dd>{account?.displayName ?? c.unknown}</dd>
        <dt>{c.observation}</dt>
        <dd>{account?.observedAt ?? c.unknown}</dd>
        <dt>{c.plan}</dt>
        <dd>{account?.plan ?? c.unknown}</dd>
        <dt>{c.automation}</dt>
        <dd>
          {serviceStateLabel(account?.automationStatus ?? "pending")} ·{" "}
          {provider.automation.methods.join(" / ")}
        </dd>
        <dt>{c.accepting}</dt>
        <dd>{account?.acceptingNewProjects ? c.yes : c.no}</dd>
        <dt>{c.next}</dt>
        <dd>{account?.nextStep ?? c.unknown}</dd>
      </dl>
      {account?.notes && <p>{account.notes}</p>}
      {account?.quotaSnapshot && (
        <p>
          {account.quotaSnapshot.metric} ({account.quotaSnapshot.unit}) · {c.limit}:{" "}
          {account.quotaSnapshot.limit ?? c.unknown} · {c.usage}:{" "}
          {account.quotaSnapshot.usage ?? c.unknown} · {c.remaining}:{" "}
          {account.quotaSnapshot.remaining ?? c.unknown} · {c.period}:{" "}
          {account.quotaSnapshot.period ?? c.unknown} · {c.observation}:{" "}
          {account.quotaSnapshot.observedAt ?? c.unknown}
        </p>
      )}
    </>
  );
}
function AccountCard({ row }: { row: DirectoryRow }): React.JSX.Element {
  const { provider, account, allocations } = row;
  return (
    <details className="services-card">
      <summary>
        <strong>{provider.name}</strong>
        <span>
          {provider.type} · {account?.displayName ?? c.noAccount}
        </span>
        <span>{provider.purpose}</span>
        <span>{account?.loginEmail ?? c.unknown}</span>
        <span>
          <ExternalLink href={account?.dashboardUrl ?? provider.dashboardUrl}>
            {c.dashboard}
          </ExternalLink>
        </span>
        <span>{serviceStateLabel(account?.accessStatus ?? "unverified")}</span>
      </summary>
      <p>{provider.purpose}</p>
      <p>
        <ExternalLink href={account?.dashboardUrl ?? provider.dashboardUrl}>
          {c.dashboard}
        </ExternalLink>{" "}
        · <Link href={`/manual/guides/service-${provider.id}`}>{c.recipe}</Link>
      </p>
      <AccountFacts account={account} provider={provider} />
      <AllocationList allocations={allocations} />
      <h4>{c.reuse}</h4>
      <p>{provider.reusePolicy}</p>
      <h4>{c.environments}</h4>
      <p>{provider.environmentPolicy}</p>
      <h4>{c.quota}</h4>
      <p>{provider.quotaNotes}</p>
    </details>
  );
}
/** Searchable, read-only private directory reused globally and within project workspaces. */
export function ServicesDirectory({
  data,
  projectId,
}: {
  data: ServicesDirectoryData;
  projectId?: string;
}): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const rows = directoryRows(data, projectId).filter((row) => matches(row, query, filter));
  return (
    <section className="services-directory" aria-label={c.title}>
      <p>{c.subtitle}</p>
      {data.issues.length > 0 && (
        <div role="alert" className="services-issues">
          <strong>{c.issues}</strong>
          <ul>
            {data.issues.map((issue) => (
              <li key={`${issue.source}-${issue.code}`}>
                {issue.source}: {issue.code === "missing" ? c.missing : c.invalid}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="services-controls">
        <label>
          {c.search}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          {c.filter}
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {(["all", "active", "pending", "candidates", "reference"] as const).map((key) => (
              <option key={key} value={key}>
                {c[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="services-cards">
        {rows.map((row) => (
          <AccountCard key={`${row.provider.id}-${row.account?.id ?? "candidate"}`} row={row} />
        ))}
      </div>
      {!rows.length && (
        <p role="status">{projectId && !search && filter === "all" ? c.empty : c.noResults}</p>
      )}
    </section>
  );
}
