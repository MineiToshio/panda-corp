"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { SearchField } from "@/components/core/Field/Field";
import { PageHead } from "@/components/core/PageHead/PageHead";
import styles from "@/components/modules/DocumentReader/DocumentReader.module.css";
import { t } from "@/lib/copy/copy";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { DocsHome } from "./_components/DocsHome/DocsHome";
import { DocsSearch } from "./_components/DocsSearch/DocsSearch";
import { DocReader } from "./DocReader";
import { type ManualNav, ManualNavProvider } from "./ManualNavContext";
import type { ManualShellProps } from "./types";

/** Client shell: the URL is the only owner of the selected document and search term. */
export function ManualShell({ pages }: ManualShellProps): React.JSX.Element {
  const router = useRouter();
  const [group] = useUrlState("manualGroup", "");
  const [slug] = useUrlState("manualPage", "");
  const [query, setQuery] = useUrlState("q", "");
  const page = pages.find((entry) => entry.group === group && entry.slug === slug);
  const nav = useMemo<ManualNav>(
    () => ({
      goToSkill: (skill) => router.push(`/configuration/skills/${encodeURIComponent(skill)}`),
      goToAgent: (agent) => router.push(`/configuration/agents/${encodeURIComponent(agent)}`),
      goToManual: (nextGroup, nextSlug) =>
        updateNavigation({ manualGroup: nextGroup, manualPage: nextSlug, q: null, index: null }),
    }),
    [router],
  );
  const missing = (group || slug) && !page;
  return (
    <ManualNavProvider value={nav}>
      <div data-testid="manual-shell" data-screen="documentacion">
        <PageHead
          title={t("documentacion.title")}
          subtitle={t(page ? "documentacion.subtitlePage" : "documentacion.subtitle")}
        />
        {missing ? (
          <EmptyState icon="book">
            <strong>{t("documentacion.notFound.title")}</strong>
            <br />
            {t("documentacion.notFound.detail", { slug: slug || group })}
            <br />
            <a href="/manual">{t("documentacion.notFound.link")}</a>
          </EmptyState>
        ) : page ? (
          <DocReader page={page} pages={pages} />
        ) : (
          <div className={`stack lg ${styles.stack}`}>
            <SearchField
              label={t("documentacion.search.aria")}
              placeholder={t("documentacion.search.placeholder", { count: pages.length })}
              value={query}
              onChange={(value) => setQuery(value, true)}
            />
            {query.trim() ? <DocsSearch pages={pages} query={query} /> : <DocsHome pages={pages} />}
          </div>
        )}
      </div>
    </ManualNavProvider>
  );
}
