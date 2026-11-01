"use client";

import { FilterChip } from "@/components/core/Chip/FilterChip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { DocIndex, type DocIndexGroup } from "@/components/modules/DocumentReader/DocIndex";
import styles from "@/components/modules/DocumentReader/DocumentReader.module.css";
import {
  documentPresentation,
  documentTypeLabel,
} from "@/components/modules/DocumentReader/documentPresentation";
import { Paper } from "@/components/modules/DocumentReader/Paper";
import { t } from "@/lib/copy/copy";
import type { DocumentBodyResult } from "@/lib/docs/documentBody";
import type { DocNode } from "@/lib/docs/tree";
import { navigationHref } from "@/lib/navigation/urls";
import { useUrlSearch, useUrlState } from "@/lib/navigation/useUrlState";
import { makeLinkResolver, docHref as workspaceDocHref } from "../document-links";

export interface TabDocumentsProps {
  nodes: DocNode[];
  selectedId: string | null;
  content: string | null;
  parsedBody?: DocumentBodyResult;
  project: string;
  navigationBaseHref?: string;
}
const GROUP_TONES: Record<NonNullable<DocNode["purpose"]>, Tone> = {
  product: "blue",
  global: "amber",
  feature: "violet",
  design: "pink",
  analytics: "teal",
  reviews: "slate",
  workOrders: "violet",
};
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
  parsedBody,
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
  const selectedType = selected?.type ?? "Documento";
  const selectedPath = selected?.relPath ?? "";
  const types = [
    ...new Map(
      nodes.map((node) => [documentTypeLabel(node.type ?? "Documento"), node.type ?? "Documento"]),
    ).values(),
  ];
  const activeType = nodes.some((node) => node.type === type) ? type : "";
  const readerBaseHref = navigationHref(navigationBaseHref ?? "/portfolio", {
    project,
    tab: "documents",
    "doc-type": activeType || null,
    "doc-q": query || null,
  });
  const groups = documentGroups({ nodes, selectedId, project, readerBaseHref, activeType });
  const typeFilters = ["", ...types].map((value) => ({
    id: value || "all",
    tone: value ? documentPresentation(value).tone : undefined,
    label: value ? documentTypeLabel(value) : t("workspace.documentos.all"),
    count: value
      ? nodes.filter(
          (node) => documentTypeLabel(node.type ?? "Documento") === documentTypeLabel(value),
        ).length
      : nodes.length,
    selected:
      value === activeType ||
      (!!value && !!activeType && documentTypeLabel(value) === documentTypeLabel(activeType)),
    onSelect: () => setType(value),
  }));
  return (
    <section aria-label={t("workspace.documentos.indexAria")} className={styles.stack}>
      <fieldset
        className={styles.typeFilters}
        aria-label={t("workspace.documentos.typeFilterAria")}
      >
        {typeFilters.map((filter) => (
          <FilterChip key={filter.id} pressed={filter.selected} onClick={filter.onSelect}>
            {filter.tone ? (
              <span aria-hidden="true" className={styles.filterDot} data-tone={filter.tone} />
            ) : null}
            {filter.label} · <span className={styles.filterCount}>{filter.count}</span>
          </FilterChip>
        ))}
      </fieldset>
      <div className={styles.reader}>
        <Paper
          type={documentTypeLabel(selectedType)}
          icon={documentPresentation(selectedType).icon}
          tone={documentPresentation(selectedType).tone}
          path={selectedPath}
          copyValue={content ?? undefined}
        >
          <DocumentContent
            content={content}
            parsedBody={parsedBody}
            resolveLink={
              selected
                ? makeLinkResolver(selected.relPath, nodes, project, readerBaseHref)
                : undefined
            }
          />
        </Paper>
        <DocIndex
          toggleIcon="file"
          groups={groups}
          searchPlaceholder={t("workspace.documentos.searchPlaceholder")}
          query={query}
          onQuery={setQuery}
          open={opened === "1"}
          onOpenChange={(open) => setOpened(open ? "1" : "")}
          toggleLabel={t("workspace.documentos.pick", { count: nodes.length })}
        />
      </div>
    </section>
  );
}

function DocumentContent({
  content,
  parsedBody,
  resolveLink,
}: {
  content: string | null;
  parsedBody?: DocumentBodyResult;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  if (content === null) return <p role="alert">{t("workspace.documentos.notFound.title")}</p>;
  if (parsedBody?.ok === false)
    return (
      <div className={styles.readFailure}>
        <p role="alert">
          {t("workspace.documentos.metadataError")} {parsedBody.reason}
        </p>
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    );
  if (!content.trim()) return <p>{t("workspace.documentos.emptyDocument")}</p>;
  return (
    <div data-testid="documents-body">
      <Markdown resolveLink={resolveLink}>{parsedBody?.ok ? parsedBody.body : content}</Markdown>
    </div>
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
    const group = grouped.get(label) ?? {
      id: label,
      label,
      count: 0,
      items: [],
      tone: GROUP_TONES[purpose(node)],
      defaultOpen: purpose(node) === "product" || !!activeType,
    };
    grouped.set(label, {
      ...group,
      count: group.count + 1,
      defaultOpen: group.defaultOpen || node.id === selectedId,
      items:
        activeType && documentTypeLabel(node.type ?? "Documento") !== documentTypeLabel(activeType)
          ? group.items
          : [
              ...group.items,
              {
                id: node.id,
                label: node.label,
                ...documentPresentation(node.type ?? "Documento"),
                path: node.relPath,
                href: workspaceDocHref(project, node.id, readerBaseHref),
                current: node.id === selectedId,
              },
            ],
    });
  }
  return [...grouped.values()].filter((group) => group.items.length > 0);
}
