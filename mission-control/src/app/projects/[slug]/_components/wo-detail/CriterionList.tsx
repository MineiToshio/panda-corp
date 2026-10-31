import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { Markdown } from "@/components/core/Markdown/Markdown";
import type { Criterion } from "@/lib/work-orders/sections";
import styles from "./detail.module.css";

const KEYWORDS = /\b(SHALL NOT|WHEN|WHILE|WHERE|IF|THEN|SHALL|AND)\b/g;
/** One card per source criterion, preserving EARS words as semantic marks. */
export function CriterionList({ criteria }: { criteria: readonly Criterion[] }): React.JSX.Element {
  return (
    <div className={styles.criteria}>
      {criteria.map((criterion) => (
        <div className={`crit ${styles.criterion}`} key={criterion.id ?? criterion.text}>
          {criterion.id && <code className="crit-id">{criterion.id}</code>}
          <Markdown compact components={{ p: CriterionParagraph }}>
            {criterion.text}
          </Markdown>
        </div>
      ))}
    </div>
  );
}

function CriterionParagraph({ children }: { children?: ReactNode }): React.JSX.Element {
  return <p className="crit-t">{markedChildren(children)}</p>;
}

function markedChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return markedText(child);
    if (
      !isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(child) ||
      child.props.node?.tagName === "code"
    )
      return child;
    return cloneElement(child, { children: markedChildren(child.props.children) });
  });
}

function markedText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(KEYWORDS)) {
    nodes.push(text.slice(offset, match.index));
    nodes.push(
      <mark className="ears" key={`${match.index}-${match[0]}`}>
        {match[0]}
      </mark>,
    );
    offset = match.index + match[0].length;
  }
  nodes.push(text.slice(offset));
  return nodes;
}
