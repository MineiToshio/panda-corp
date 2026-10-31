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
      <div className="pbox" data-tone="blue" data-testid="spec-highlight">
        {block.markdown.replace(/\*\*/g, "")}
      </div>
    );
  if (block.kind === "chips-muted")
    return (
      <div className={styles.chips}>
        {items.map((item) => (
          <span className="muted-pill" key={item.title}>
            {item.title}
          </span>
        ))}
      </div>
    );
  if (block.kind === "bullets")
    return (
      <ul className="sbul">
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
              {item.title}
              {item.desc && `: ${item.desc}`}
            </span>
          </div>
        ))}
      </div>
    );
  if (block.kind === "decisions")
    return (
      <div className={`pbox ${styles.decisions}`} data-tone="amber" data-testid="spec-decisions">
        <ul className="decs">
          {items.map((item) => (
            <li key={item.title}>
              <b>{item.title}</b>
              {item.desc && `: ${item.desc}`}
            </li>
          ))}
        </ul>
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
