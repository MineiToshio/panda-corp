"use client";

import { Markdown } from "@/components/core/Markdown/Markdown";
import { DocIndex, type DocIndexGroup } from "@/components/modules/DocumentReader/DocIndex";
import styles from "@/components/modules/DocumentReader/DocumentReader.module.css";
import { Paper } from "@/components/modules/DocumentReader/Paper";
import { t } from "@/lib/copy/copy";
import type { DocNode } from "@/lib/docs/tree";
import { navigationHref } from "@/lib/navigation/urls";
import { useUrlSearch, useUrlState } from "@/lib/navigation/useUrlState";
import { makeLinkResolver, docHref as workspaceDocHref } from "../document-links";

export interface TabDocumentsProps {
  nodes: DocNode[];
  selectedId: string | null;
  content: string | null;
  project: string;
  navigationBaseHref?: string;
}
const PURPOSES = [
  "product",
  "global",
  "feature",
  "design",
  "analytics",
  "reviews",
  "workOrders",
] as const;
function purpose(node: DocNode): NonNullable<DocNode["purpose"]> {
  return (
    node.purpose ??
    (node.group.startsWith("Feature:")
      ? "feature"
      : node.group === "Product"
        ? "product"
        : "global")
  );
}
function groupLabel(node: DocNode): string {
  if (purpose(node) === "feature") {
    if (node.purposeLabel) return node.purposeLabel;
    const folder = node.group.replace(/^Feature: /, "");
    const match = /^frd-(\d+)-?(.*)/i.exec(folder);
    return match ? `FRD-${match[1]} ${match[2]?.replaceAll("-", " ")}`.trim() : folder;
  }
  const key = purpose(node);
  return key === "feature" ? node.group : t(`workspace.documentos.groups.${key}`);
}
/** Shared paper and purpose index with URL-owned filters; search replaces history. */
export function TabDocuments({
  nodes,
  selectedId,
  content,
  project,
  navigationBaseHref,
}: TabDocumentsProps): React.JSX.Element {
  const [query, setQuery] = useUrlSearch("doc-q");
  const [type, setType] = useUrlState("doc-type", "");
  // URL-owned: the canonical selection redirect remounts this tab and would reset local state.
  const [opened, setOpened] = useUrlState("opened", "");
  if (!nodes.length)
    return (
      <p role="status" data-testid="documents-empty">
        {t("workspace.documentos.empty")}
      </p>
    );
  const selected = nodes.find((node) => node.id === selectedId);
  const types = [...new Set(nodes.map((node) => node.type ?? "Documento"))];
  const activeType = types.includes(type) ? type : "";
  const readerBaseHref = navigationHref(navigationBaseHref ?? "/portfolio", {
    project,
    tab: "documents",
    "doc-type": activeType || null,
    "doc-q": query || null,
  });
  const groups = documentGroups({ nodes, selectedId, project, readerBaseHref, activeType });
  const typeFilters = ["", ...types].map((value) => ({
    id: value || "all",
    label: value || t("workspace.documentos.all"),
    count: value ? nodes.filter((node) => node.type === value).length : nodes.length,
    selected: value === activeType,
    onSelect: () => setType(value),
  }));
  return (
    <section aria-label={t("workspace.documentos.indexAria")} className={styles.reader}>
      <Paper type={selected?.type ?? "Documento"} path={selected?.relPath ?? ""}>
        {content === null ? (
          <p role="alert">{t("workspace.documentos.notFound.title")}</p>
        ) : content.trim() ? (
          <div data-testid="documents-body">
            <Markdown
              resolveLink={
                selected
                  ? makeLinkResolver(selected.relPath, nodes, project, readerBaseHref)
                  : undefined
              }
            >
              {content}
            </Markdown>
          </div>
        ) : (
          <p>{t("workspace.documentos.emptyDocument")}</p>
        )}
      </Paper>
      <DocIndex
        groups={groups}
        searchPlaceholder={t("workspace.documentos.searchPlaceholder")}
        query={query}
        onQuery={setQuery}
        open={opened === "1"}
        onOpenChange={(open) => setOpened(open ? "1" : "")}
        toggleLabel={t("workspace.documentos.pick", { count: nodes.length })}
        typeFilters={typeFilters}
      />
    </section>
  );
}

interface IndexOptions {
  nodes: DocNode[];
  selectedId: string | null;
  project: string;
  readerBaseHref: string;
  activeType: string;
}
function documentGroups({
  nodes,
  selectedId,
  project,
  readerBaseHref,
  activeType,
}: IndexOptions): DocIndexGroup[] {
  const ordered = [...nodes].sort(
    (a, b) => PURPOSES.indexOf(purpose(a)) - PURPOSES.indexOf(purpose(b)),
  );
  const grouped = new Map<string, DocIndexGroup>();
  for (const node of ordered) {
    const label = groupLabel(node);
    const group = grouped.get(label) ?? { id: label, label, count: 0, items: [] };
    grouped.set(label, {
      ...group,
      count: group.count + 1,
      items:
        activeType && (node.type ?? "Documento") !== activeType
          ? group.items
          : [
              ...group.items,
              {
                id: node.id,
                label: node.label,
                path: node.relPath,
                href: workspaceDocHref(project, node.id, readerBaseHref),
                current: node.id === selectedId,
              },
            ],
    });
  }
  return [...grouped.values()].filter((group) => group.items.length > 0);
}
