"use client";

import {
  SpecDigest,
  type SpecDigestProps,
} from "@/app/board/_components/CardDetail/SpecDigest/SpecDigest";
import type { DocNode } from "@/lib/docs/tree";
import { makeLinkResolver } from "./document-links";

type TabSpecProps = Omit<SpecDigestProps, "resolveLink"> & {
  project: string;
  nodes: DocNode[];
};

/** Mount the shared Spec with links scoped to the same project's document reader. */
export function TabSpec({ project, nodes, ...digest }: TabSpecProps): React.JSX.Element {
  return <SpecDigest {...digest} resolveLink={makeLinkResolver("", nodes, project)} />;
}
