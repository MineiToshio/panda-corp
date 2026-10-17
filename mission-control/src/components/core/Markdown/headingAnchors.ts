/** Convert visible heading text into a stable, case-insensitive Unicode fragment ID. */
export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
      .replace(/\s/g, "-") || "section"
  );
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hProperties?: Record<string, unknown> };
}
function textOf(node: MarkdownNode): string {
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}
/** Assign stable, Unicode-preserving heading fragments with duplicate suffixes per document. */
export function remarkHeadingAnchors(): (tree: MarkdownNode) => void {
  return (tree) => {
    const used = new Set<string>();
    function visit(node: MarkdownNode) {
      if (node.type === "heading") {
        const base = headingId(textOf(node));
        let id = base;
        let suffix = 0;
        while (used.has(id)) id = `${base}-${++suffix}`;
        used.add(id);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
