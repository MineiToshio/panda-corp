"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { t } from "@/lib/copy/copy";
import styles from "./Markdown.module.css";

/** Make wide document content keyboard-scrollable, with a hint only when it overflows. */
export function Scrollable({
  children,
  kind,
}: {
  children: ReactNode;
  kind: "table" | "code";
}): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !children) return;
    function measure(): void {
      if (element) setOverflow(element.scrollWidth > element.clientWidth);
    }
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    const content = element.firstElementChild;
    if (content) observer?.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);
  return (
    <>
      <section
        ref={ref}
        className={styles.scroll}
        aria-label={t(
          kind === "table" ? "states.scrollable.tableAria" : "states.scrollable.codeAria",
        )}
        aria-describedby={overflow ? hintId : undefined}
        tabIndex={overflow ? 0 : undefined}
      >
        {children}
      </section>
      {overflow ? (
        <p className={styles.hint} id={hintId}>
          {t(kind === "table" ? "states.scrollable.tableHint" : "states.scrollable.codeHint")}
        </p>
      ) : null}
    </>
  );
}
