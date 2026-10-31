"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { DividedList, ListRow } from "@/components/core/ListRow/ListRow";
import { t } from "@/lib/copy/copy";
import type { ManualPage } from "@/lib/manual/manual";
import { DOC_GROUPS, groupTone, pageHref } from "../DocsHome/model";
import { loadSearchIndex } from "./extract";
import { type SearchEntry, searchPages } from "./search";

/** Full-text results from a lazy, memoised renderer index. */
export function DocsSearch({
  pages,
  query,
}: {
  readonly pages: readonly ManualPage[];
  readonly query: string;
}): React.JSX.Element {
  const [index, setIndex] = useState<readonly SearchEntry[] | null>(null);
  useEffect(() => {
    let active = true;
    void loadSearchIndex(pages).then((result) => {
      if (active) setIndex(result);
    });
    return () => {
      active = false;
    };
  }, [pages]);
  const hits = searchPages(index ?? [], query);
  return (
    <Card tone="violet">
      <CardHeader title={t("documentacion.results.title")} count={hits.length} icon="search" />
      <div data-testid="docs-results" aria-busy={index === null}>
        {index !== null && hits.length === 0 ? <p>{t("documentacion.results.empty")}</p> : null}
        <DividedList
          items={hits.map((hit) => ({
            id: `${hit.group}/${hit.page.slug}`,
            row: (
              <ListRow
                title={hit.page.title}
                meta={hit.snippet}
                icon="book"
                tone={groupTone(hit.group)}
                href={pageHref(hit.page)}
                extra={
                  <Chip tone={groupTone(hit.group)}>
                    {t(
                      DOC_GROUPS.find((group) => group.id === hit.group)?.key ??
                        "documentacion.title",
                    )}
                  </Chip>
                }
              />
            ),
          }))}
        />
      </div>
    </Card>
  );
}
