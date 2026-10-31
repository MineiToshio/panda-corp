import { Chip } from "@/components/core/Chip/Chip";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import styles from "@/components/modules/ReportBand/reportBand.module.css";
import type { SpecBlock } from "@/lib/spec/spec";

/** Label-classified blocks preserve the digest language while making each content shape scannable. */
export function BlockContent({
  block,
  resolveLink,
}: {
  readonly block: SpecBlock;
  readonly resolveLink?: LinkResolver;
}): React.JSX.Element {
  const items = block.items;
  if (block.kind === "prose")
    return <Markdown resolveLink={resolveLink}>{block.markdown}</Markdown>;
  if (block.kind === "highlight")
    return (
      <blockquote className={`pquote ${styles.quote}`} data-testid="spec-highlight">
        {block.markdown.replace(/\*\*/g, "")}
      </blockquote>
    );
  if (block.kind === "chips-muted")
    return (
      <div className={styles.chips}>
        {items.map((item) => (
          <Chip key={item.title} tone="slate" variant="plain">
            {item.title}
          </Chip>
        ))}
      </div>
    );
  if (block.kind === "bullets")
    return (
      <ul>
        {items.map((item) => (
          <li key={item.title} data-testid="spec-bullet">
            <b>{item.title}</b>
            {item.desc && `: ${item.desc}`}
          </li>
        ))}
      </ul>
    );
  if (block.kind === "chips")
    return (
      <div className={`checks ${styles.checks}`}>
        {items.map((item) => (
          <div className={styles.check} key={item.title} data-testid="spec-scope-item">
            <span aria-hidden="true">✓</span>
            <span>
              <b>{item.title}</b>
              {item.desc && `: ${item.desc}`}
            </span>
          </div>
        ))}
      </div>
    );
  if (block.kind === "decisions")
    return (
      <div className={`pbox ${styles.decisions}`} data-testid="spec-decisions">
        {items.map((item) => (
          <div key={item.title} className="spec-decision">
            <b>{item.title}</b>
            {item.desc && <p>{item.desc}</p>}
          </div>
        ))}
      </div>
    );
  const testId =
    block.kind === "roles" ? "spec-role" : block.kind === "metrics" ? "spec-stat" : "spec-ref";
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.title} className={`feat ${styles.feature}`} data-testid={testId}>
          <b>{item.title}</b>
          {item.desc && <p>{item.desc}</p>}
        </div>
      ))}
    </div>
  );
}
