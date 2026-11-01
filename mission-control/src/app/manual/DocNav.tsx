"use client";

import { useState } from "react";
import { DocIndex, type DocIndexGroup } from "@/components/modules/DocumentReader/DocIndex";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import { DOC_GROUPS, groupPages, pageHref } from "./_components/DocsHome/model";
import type { DocReaderProps } from "./types";

/** Build the page index and the fixed links to the canonical configuration catalogs. */
export function DocNav({ pages, page }: DocReaderProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useUrlState("index", "");
  const groups: DocIndexGroup[] = DOC_GROUPS.map((group) => {
    const entries = groupPages(pages, group.id);
    return {
      id: group.id,
      label: t(group.key),
      tone: group.tone,
      count: entries.length,
      items: entries.map((entry) => ({
        id: entry.slug,
        label: entry.title,
        href: pageHref(entry),
        icon:
          group.id === "tutorial"
            ? "sparkles"
            : group.id === "guides"
              ? "flag"
              : group.id === "concepts"
                ? "book"
                : "bolt",
        current: entry.group === page.group && entry.slug === page.slug,
      })),
    };
  });
  groups.push({
    id: "reference",
    label: t("documentacion.explore.reference.label"),
    tone: "slate",
    count: 4,
    items: (["commands", "agents", "rules", "standards"] as const).map((catalog) => ({
      icon: "list",
      id: catalog,
      label: t(`documentacion.referencePages.${catalog}`),
      href: `/configuration/${catalog === "commands" ? "skills" : catalog}`,
    })),
  });
  return (
    <DocIndex
      groups={groups}
      query={query}
      onQuery={setQuery}
      toggleLabel={t("documentacion.reader.indexToggle", { title: page.title })}
      open={opened === "1"}
      onOpenChange={(open) => setOpened(open ? "1" : "")}
    />
  );
}
