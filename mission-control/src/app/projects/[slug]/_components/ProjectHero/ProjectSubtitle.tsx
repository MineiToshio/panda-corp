"use client";
import { useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { t } from "@/lib/copy/copy";
import styles from "./ProjectHero.module.css";

export function ProjectSubtitle({ text }: { text: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.subtitle}>
      <p className={expanded ? undefined : styles.clamped}>{text}</p>
      {text.length > 180 && (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? "workspace.hero.subtitle.less" : "workspace.hero.subtitle.more")}
        </Button>
      )}
    </div>
  );
}
