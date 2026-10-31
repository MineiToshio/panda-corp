import type { IconName } from "@/components/core/Icon/iconData";
/**
 * manual-diagrams/HooksDiagram.tsx — FRD-08 ("Hooks, gates y seguridad")
 *
 * The three hook panels (PreToolUse / Stop / Eventos): each a Panel row with a
 * leading status icon, a mono hook name, and a one-line description.
 *
 * Faithful recreation of the prototype `docPage(10)` hooks block (index.html
 * L1087-1088). The page's intro/footer prose is composed in the page component.
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (hooks).
 */

import type React from "react";
import { Card } from "@/components/core/Card/Card";
import { IconRow } from "./atoms";

type Hook = {
  readonly icon: IconName;
  readonly color: string;
  readonly name: string;
  readonly body: string;
};

const HOOKS: readonly Hook[] = [
  {
    icon: "shield",
    color: "var(--coral)",
    name: "PreToolUse · block-dangerous.sh",
    body: "Bloquea comandos peligrosos antes de ejecutarlos: rm -rf, push a main, force-push, borrar repos.",
  },
  {
    icon: "check",
    color: "var(--green)",
    name: "Stop · verify-before-stop.sh",
    body: "Corre .pandacorp/verify.sh (tests + typecheck + lint). Fail-closed: un agente no puede declarar «terminado» si falla.",
  },
  {
    icon: "activity",
    color: "var(--blue)",
    name: "Eventos · emit-event.sh",
    body: "Los subagentes del workflow + el hook SubagentStop escriben a ~/.claude/dashboard-events.ndjson, que La Fragua lee en vivo.",
  },
] as const;

export function HooksDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-hooks">
      {HOOKS.map((hook) => (
        <div key={hook.name} style={{ marginBottom: "8px" }}>
          <Card>
            <IconRow
              icon={hook.icon}
              iconColor={hook.color}
              title={<span style={{ fontFamily: "var(--font-mono, monospace)" }}>{hook.name}</span>}
            >
              {hook.body}
            </IconRow>
          </Card>
        </div>
      ))}
    </div>
  );
}
