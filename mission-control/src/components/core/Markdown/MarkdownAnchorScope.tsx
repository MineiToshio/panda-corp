"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

/** Restore a heading after asynchronous markdown arrives, scoped to this document reader. */
export function MarkdownAnchorScope({
  children,
  style,
  testId,
  className = "pc-markdown",
}: {
  children: ReactNode;
  style: CSSProperties;
  testId?: string;
  className?: string;
}): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!children) return;
    function restoreAnchor() {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!id) return;
      const panel = root.current?.closest<HTMLElement>('[role="tabpanel"]');
      if (panel?.style.clip && panel.style.clip !== "auto") return;
      const heading = [...(root.current?.querySelectorAll<HTMLElement>("[id]") ?? [])].find(
        (element) => element.id === id,
      );
      heading?.scrollIntoView?.({ block: "start" });
    }
    restoreAnchor();
    window.addEventListener("hashchange", restoreAnchor);
    window.addEventListener("popstate", restoreAnchor);
    return () => {
      window.removeEventListener("hashchange", restoreAnchor);
      window.removeEventListener("popstate", restoreAnchor);
    };
  }, [children]);
  return (
    <div ref={root} className={className} style={style} data-testid={testId}>
      {children}
    </div>
  );
}
