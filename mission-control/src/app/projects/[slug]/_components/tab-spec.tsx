"use client";
import {
  SpecDigest,
  type SpecDigestProps,
} from "@/app/board/_components/CardDetail/SpecDigest/SpecDigest";
import { ButtonLink } from "@/components/core/Button/ButtonLink";
import { Icon } from "@/components/core/Icon/Icon";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import type { DocNode } from "@/lib/docs/tree";
import { parseSpec } from "@/lib/spec/spec";
import { docHref, makeLinkResolver } from "./document-links";
import styles from "./tab-spec.module.css";

type TabSpecProps = Omit<SpecDigestProps, "resolveLink"> & { project: string; nodes: DocNode[] };
export function TabSpec({
  project,
  nodes,
  navigationBaseHref,
  ...digest
}: TabSpecProps): React.JSX.Element {
  const unpublished = !parseSpec(digest.body).hasContent;
  const prd = nodes.find((node) => node.relPath === "docs/product/prd.md");
  const research = nodes.find((node) => node.relPath === "docs/product/research.md");
  return (
    <div className={styles.root}>
      {unpublished && (
        <Notice icon="layers">
          <strong>{t("workspace.spec.notPublished.title")}</strong>
          <p>{t("workspace.spec.notPublished.body")}</p>
          <div className={styles.actions}>
            {prd && (
              <ButtonLink
                look="button"
                size="sm"
                tone="blue"
                href={docHref(project, prd.id, navigationBaseHref)}
              >
                <Icon name="flag" size="sm" />
                {t("workspace.spec.buttons.prdFull")}
              </ButtonLink>
            )}
            {research && (
              <ButtonLink
                look="button"
                size="sm"
                tone="blue"
                href={docHref(project, research.id, navigationBaseHref)}
              >
                <Icon name="search" size="sm" />
                {t("workspace.spec.buttons.research")}
              </ButtonLink>
            )}
          </div>
        </Notice>
      )}
      <SpecDigest
        {...digest}
        showUnpublishedNotice={false}
        showEyebrow={false}
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
    </div>
  );
}
