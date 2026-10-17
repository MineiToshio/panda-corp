import { useEffect, useState } from "react";
import type { DocNode } from "@/lib/docs/tree";

/** Load the allowlisted URL document and ignore responses from a superseded location. */
export function useCardDocument(
  selectedDocKey: string,
  docNodes: readonly DocNode[] | undefined,
  project: string | undefined,
  readDocAction: ((project: string, relPath: string) => Promise<string | null>) | undefined,
): { docContent: string | null; docLoading: boolean } {
  const [loadedDoc, setLoadedDoc] = useState<{
    project: string;
    key: string;
    content: string | null;
  } | null>(null);
  const validDoc = (docNodes ?? []).some((node) => node.relPath === selectedDocKey);
  const loaded = loadedDoc?.key === selectedDocKey && loadedDoc?.project === project;
  const docContent = loaded ? loadedDoc.content : null;
  const docLoading = validDoc && readDocAction != null && project != null && !loaded;
  useEffect(() => {
    if (!validDoc || !readDocAction || !project) return;
    let current = true;
    readDocAction(project, selectedDocKey).then(
      (content) => {
        if (current) setLoadedDoc({ project, key: selectedDocKey, content });
      },
      () => {
        if (current) setLoadedDoc({ project, key: selectedDocKey, content: null });
      },
    );
    return () => {
      current = false;
    };
  }, [selectedDocKey, validDoc, project, readDocAction]);
  return { docContent, docLoading };
}
