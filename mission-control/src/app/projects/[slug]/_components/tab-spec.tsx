"use client";
import {
  SpecDigest,
  type SpecDigestProps,
} from "@/app/board/_components/CardDetail/SpecDigest/SpecDigest";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import type { DocNode } from "@/lib/docs/tree";
import { parseSpec } from "@/lib/spec/spec";
import { docHref, makeLinkResolver } from "./document-links";

type TabSpecProps = Omit<SpecDigestProps, "resolveLink"> & { project: string; nodes: DocNode[] };
export function TabSpec({
  project,
  nodes,
  navigationBaseHref,
  ...digest
}: TabSpecProps): React.JSX.Element {
  const unpublished = !parseSpec(digest.body).hasContent;
  const prd = nodes.find((node) => node.relPath === "docs/product/prd.md");
  return (
    <>
      {unpublished && (
        <Notice icon="book">
          <strong>{t("workspace.spec.notPublished.title")}</strong>
          <p>{t("workspace.spec.notPublished.body")}</p>
          {prd && (
            <a href={docHref(project, prd.id, navigationBaseHref)}>
              {t("workspace.spec.buttons.prdFull")}
            </a>
          )}
        </Notice>
      )}
      <SpecDigest
        {...digest}
        showUnpublishedNotice={false}
        project={project}
        navigationBaseHref={
          navigationBaseHref
            ? new URL(navigationBaseHref, "http://localhost").pathname
                .split("/")
                .slice(0, 3)
                .join("/")
            : undefined
        }
        resolveLink={makeLinkResolver("", nodes, project, navigationBaseHref)}
      />
    </>
  );
}
