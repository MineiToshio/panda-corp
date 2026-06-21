/**
 * WO-11-002 preview route — visual fidelity check (DR-056).
 *
 * Renders TabCommands (= ModeSelector + CommandsBox) with the implementation
 * phase so the implementer can compare against the prototype's projComandos()
 * = buildModePanel(i) + commandsBox(i) patterns.
 *
 * Fidelity target: docs/design/prototype/index.html → buildModePanel() ~L916
 * + commandsBox() ~L808 + projComandos() ~L922.
 *
 * This file exists ONLY for the in-loop fidelity check — not shipping code.
 */

import { TabCommands } from "@/app/projects/[slug]/_components/tab-commands/tab-commands";

export default function PreviewWo11002Page() {
  return (
    <div
      style={{
        maxWidth: "660px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "4px",
          color: "var(--color-text2)",
        }}
      >
        WO-11-002 — TabCommands Preview (projComandos fidelity check)
      </h2>
      <p
        style={{
          fontSize: "12px",
          color: "var(--color-text3, var(--color-text2))",
          marginBottom: "24px",
        }}
      >
        Fidelity target:{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          docs/design/prototype/index.html → buildModePanel() + commandsBox()
        </code>
      </p>

      {/* Phase: implementation — the primary fidelity case (3 command rows) */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          1. COMANDOS TAB — phase: implementation (3 rows: implement, release, iterate)
        </p>
        <TabCommands phase="implementation" slug="preview-project" />
      </div>

      {/* Phase: operation — shipped state (2 rows: iterate, new-version) */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          2. COMANDOS TAB — phase: operation (2 rows: iterate, new-version)
        </p>
        <TabCommands phase="operation" slug="preview-project-2" />
      </div>

      {/* Phase: product — early phase (1 row: design) */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          3. COMANDOS TAB — phase: product (1 row: design)
        </p>
        <TabCommands phase="product" slug="preview-project-3" />
      </div>
    </div>
  );
}
