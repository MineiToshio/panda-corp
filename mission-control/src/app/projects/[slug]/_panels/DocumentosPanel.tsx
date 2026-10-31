import { notFound } from "next/navigation";
import { listProjectDocs, readDoc } from "@/lib/docs/tree";
import { TabDocuments } from "../_components/tab-documents/tab-documents";
import type { PanelProps } from "./types";

export default function DocumentosPanel({ project, route }: PanelProps): React.JSX.Element {
  const nodes = listProjectDocs(project.projectPath);
  const selected =
    route.docParam === undefined ? nodes[0] : nodes.find((node) => node.id === route.docParam);
  if (route.docParam !== undefined && !selected) notFound();
  return (
    <TabDocuments
      nodes={nodes}
      selectedId={selected?.id ?? null}
      content={selected ? readDoc(project.projectPath, selected.relPath) : null}
      project={project.slug}
      navigationBaseHref={route.navigationBaseHref}
    />
  );
}
