"use client";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { SearchField } from "@/components/core/Field/Field";
import { t } from "@/lib/copy/copy";
import { useUrlSearch, useUrlState } from "@/lib/navigation/useUrlState";
import type { ServicesDirectoryData } from "@/lib/services/types";
import { directoryAccountRows } from "@/lib/services/views";
import { AccountDetail } from "./AccountDetail";
import { AccountsTable } from "./AccountsTable";
import { ServiceIssues } from "./ServiceIssues";
import styles from "./ServicesDirectory.module.css";

const FILTERS = ["all", "active", "pending", "candidates", "reference"] as const;
/** Global directory: URL-owned search, state and details, independent of a selected project. */
export function AccountsDirectory({ data }: { data: ServicesDirectoryData }): React.JSX.Element {
  const [search, setSearch] = useUrlSearch("accountsQuery");
  const [filter, setFilter] = useUrlState("accountsState", "all");
  const [account, setAccount] = useUrlState("account", "");
  const all = directoryAccountRows(data);
  const query = search.trim().toLocaleLowerCase("es");
  const state = filter === "candidates" ? "candidate" : filter;
  const rows = all.filter(
    (row) =>
      (filter === "all" || !FILTERS.some((value) => value === filter) || row.state === state) &&
      (!query ||
        [
          row.provider.name,
          row.provider.type,
          row.account?.loginEmail,
          row.account?.displayName,
          ...row.allocations.map((link) => link.projectName),
        ].some((value) => value?.toLocaleLowerCase("es").includes(query))),
  );
  const detail = all.find((row) => row.key === account);
  function handleClose(): void {
    setAccount("");
  }
  return (
    <div className={styles.directory}>
      <p>{t("portafolio.accounts.intro")}</p>
      <ServiceIssues issues={data.issues} />
      <div className={styles.toolbar}>
        <SearchField
          label={t("portafolio.accounts.searchAria")}
          placeholder={t("portafolio.accounts.searchPlaceholder")}
          value={search}
          onChange={setSearch}
        />
        <fieldset aria-label={t("portafolio.accounts.filtersAria")} className={styles.filters}>
          {FILTERS.map((value) => (
            <FilterChip key={value} pressed={filter === value} onClick={() => setFilter(value)}>
              {t(`portafolio.accounts.filters.${value}`)}{" "}
              {value === "all"
                ? all.length
                : all.filter((row) => row.state === (value === "candidates" ? "candidate" : value))
                    .length}
            </FilterChip>
          ))}
        </fieldset>
      </div>
      <p>{t("portafolio.accounts.count", { count: rows.length })}</p>
      {rows.length ? (
        <AccountsTable variant="directory" rows={rows} onOpenDetail={setAccount} />
      ) : (
        <p role="status">{t("portafolio.accounts.noMatches")}</p>
      )}
      {detail && <AccountDetail row={detail} onClose={handleClose} />}
    </div>
  );
}
