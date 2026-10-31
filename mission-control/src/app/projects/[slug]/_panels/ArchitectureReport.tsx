"use client";
import {
  ArchitectureDigest,
  type ArchitectureDigestProps,
} from "@/app/board/_components/CardDetail/ArchitectureDigest/ArchitectureDigest";
import type { DocNode } from "@/lib/docs/tree";
import { makeLinkResolver } from "../_components/document-links";

/** Build link functions at the client boundary so server props stay serializable. */
export function ArchitectureReport({
  nodes,
  project,
  navigationBaseHref,
  ...digest
}: ArchitectureDigestProps & { nodes: DocNode[]; project: string }): React.JSX.Element {
  return (
    <ArchitectureDigest
      {...digest}
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
  );
}
