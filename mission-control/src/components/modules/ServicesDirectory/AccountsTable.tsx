"use client";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { Table } from "@/components/core/Table/Table";
import { t } from "@/lib/copy/copy";
import type { ServicesDirectoryData } from "@/lib/services/types";
import { type DirectoryAccountRow, projectServiceRows } from "@/lib/services/views";
import {
  AccountAccess,
  AccountLogin,
  AccountState,
  Environments,
  ProviderLink,
} from "./accountPresentation";
import styles from "./ServicesDirectory.module.css";

type Props =
  | { variant: "project"; services: ServicesDirectoryData; projectId: string }
  | { variant: "directory"; rows: DirectoryAccountRow[]; onOpenDetail: (key: string) => void };
/** Shared table with one responsive DOM for both account views. */
export function AccountsTable(props: Props): React.JSX.Element {
  const directory = props.variant === "directory";
  const prefix = directory ? "portafolio.accounts" : "workspace.cuentas";
  const columns = [
    { id: "service", label: t(`${prefix}.columns.service`) },
    { id: "type", label: t("portafolio.accounts.columns.type") },
    { id: "organization", label: t("portafolio.accounts.columns.organization") },
    { id: "access", label: t("dialogs.account.identity") },
    { id: "purpose", label: t(`${prefix}.columns.purpose`) },
    { id: "user", label: t(`${prefix}.columns.user`) },
    directory
      ? { id: "projects", label: t("portafolio.accounts.columns.projects") }
      : { id: "environments", label: t("workspace.cuentas.columns.environments") },
    { id: "state", label: t(`${prefix}.columns.state`) },
  ];
  if (directory) columns.push({ id: "detail", label: t("portafolio.accounts.columns.detail") });
  const rows =
    props.variant === "project"
      ? projectServiceRows(props.services, props.projectId).map((row) => ({
          id: row.key,
          cells: {
            service: (
              <ProviderLink
                provider={row.provider}
                href={row.account?.dashboardUrl ?? row.provider.dashboardUrl}
              />
            ),
            type: row.provider.type,
            organization: row.account?.displayName ?? t("portafolio.accounts.toVerify"),
            access: row.account ? (
              <AccountAccess account={row.account} />
            ) : (
              t("portafolio.accounts.toVerify")
            ),
            purpose: row.provider.purpose,
            user: row.account ? (
              <AccountLogin login={row.account.loginEmail} />
            ) : (
              <span className={styles.faint}>
                <span aria-hidden="true">−</span>
                <span className="sr-only">{t("common.none")}</span>
              </span>
            ),
            environments: <Environments resources={row.allocation.resources} />,
            state: <AccountState state={row.allocation.status} />,
          },
        }))
      : props.rows.map((row) => ({
          id: row.key,
          cells: {
            service: (
              <ProviderLink
                provider={row.provider}
                href={row.account?.dashboardUrl ?? row.provider.dashboardUrl}
              />
            ),
            type: row.provider.type,
            organization: row.account?.displayName ?? t("portafolio.accounts.toVerify"),
            access: row.account ? (
              <AccountAccess account={row.account} />
            ) : (
              t("portafolio.accounts.toVerify")
            ),
            purpose: row.provider.purpose,
            user: <AccountLogin login={row.account?.loginEmail ?? null} />,
            projects: (
              <span className={styles.environments}>
                {[...new Set(row.allocations.map((link) => link.projectName))].map((name) => (
                  <Chip key={name} tone="slate" variant="plain">
                    {name}
                  </Chip>
                ))}
                {!row.allocations.length && t("common.none")}
              </span>
            ),
            state: <AccountState state={row.state} directory />,
            detail: (
              <Button
                size="sm"
                variant="ghost"
                ariaLabel={t("portafolio.accounts.detailAria", {
                  name: row.account?.displayName ?? row.provider.name,
                })}
                onClick={() => props.onOpenDetail(row.key)}
              >
                {t("portafolio.accounts.details")}
              </Button>
            ),
          },
        }));
  return (
    <section className={`acc-table ${styles.table}`} aria-label={t(`${prefix}.tableAria`)}>
      <Table caption={t(`${prefix}.tableAria`)} columns={columns} rows={rows} />
    </section>
  );
}
