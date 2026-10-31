"use client";

import { useId, useRef } from "react";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { SearchField } from "@/components/core/Field/Field";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import styles from "./DocumentReader.module.css";

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

/** One navigable document. */
interface DocItemData {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly path?: string;
  readonly current?: boolean;
}
/** An index section with its unfiltered count. */
export interface DocIndexGroup {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly tone?: Tone;
  readonly items: readonly DocItemData[];
}
/** Shared index contract for documentation and project documents. */
export interface DocIndexProps {
  readonly groups: readonly DocIndexGroup[];
  readonly searchPlaceholder?: string;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly toggleLabel: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly typeFilters?: readonly {
    id: string;
    label: string;
    count: number;
    selected: boolean;
    onSelect: () => void;
  }[];
}

/** A real link supporting paste, history and current-page semantics. */
function DocItem({ item }: { readonly item: DocItemData }): React.JSX.Element {
  return (
    <a
      className={`ditem ${styles.item}`}
      href={item.href}
      aria-current={item.current ? "page" : undefined}
    >
      <span>{item.label}</span>
    </a>
  );
}

/** Searchable index, right-hand on desktop and disclosed above the paper on small screens. */
export function DocIndex({
  groups,
  query,
  onQuery,
  toggleLabel,
  open,
  onOpenChange,
  typeFilters,
  searchPlaceholder,
}: DocIndexProps): React.JSX.Element {
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  function close(): void {
    onOpenChange(false);
    trigger.current?.focus();
  }
  const search = foldAccents(query.trim());
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        foldAccents(`${item.label} ${item.path ?? ""}`).includes(search),
      ),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <div className={styles.indexWrap}>
      <button
        ref={trigger}
        type="button"
        className={`index-toggle ${styles.toggle}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : onOpenChange(true))}
      >
        {toggleLabel}
        <Icon name="chevD" size="sm" />
      </button>
      <nav
        id={id}
        className={`doc-index ${styles.index}`}
        data-open={open}
        aria-label={t("documentacion.reader.indexAria")}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close();
          }
        }}
      >
        <SearchField
          label={t("documentacion.search.pageAria")}
          placeholder={searchPlaceholder ?? t("documentacion.search.pagePlaceholder")}
          value={query}
          onChange={onQuery}
        />
        {typeFilters ? (
          <div className={styles.filters}>
            {typeFilters.map((filter) => (
              <FilterChip key={filter.id} pressed={filter.selected} onClick={filter.onSelect}>
                {filter.label} · {filter.count}
              </FilterChip>
            ))}
          </div>
        ) : null}
        {visibleGroups.map((group) => (
          <details key={group.id} open className={`dgroup ${styles.group}`} data-tone={group.tone}>
            <summary>
              {group.label}
              <span className={styles.count}>{group.count}</span>
            </summary>
            {group.items.map((item) => (
              <DocItem key={item.id} item={item} />
            ))}
          </details>
        ))}
      </nav>
    </div>
  );
}
