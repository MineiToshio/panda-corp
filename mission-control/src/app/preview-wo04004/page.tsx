/**
 * WO-04-004 preview route — visual fidelity check (DR-056).
 *
 * Renders the workspace shell components (WorkspaceHeader, ObjectivesBar, TabBar)
 * with synthetic data so the implementer can compare against the prototype's
 * compactProjectHeader() + progressBar() + subtabs (.stab) patterns.
 *
 * Fidelity target: docs/design/prototype/index.html → projectPane() function.
 *
 * This file exists ONLY for the in-loop fidelity check — not shipping code.
 */

"use client";

import { useState } from "react";
import { ObjectivesBar } from "@/app/projects/[slug]/_components/objectives-bar";
import { WorkspaceHeader } from "@/app/projects/[slug]/_components/workspace-header";
import { SubTabs } from "@/components/core/Tabs/Tabs";

export default function PreviewPage() {
  const [activeTab, setActiveTab] = useState("resumen");

  const WORKSPACE_TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "workorders", label: "Work orders" },
    { id: "party", label: "Party" },
    { id: "observabilidad", label: "Observabilidad" },
    { id: "docs", label: "Documentos" },
    { id: "comandos", label: "Comandos" },
  ];

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "24px",
          color: "var(--color-text2)",
        }}
      >
        WO-04-004 — Workspace Shell Preview (vs prototype projectPane())
      </h2>

      {/* Section 1: Header without running pip, no progress */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          Header (not running, no progress):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <WorkspaceHeader title="Pandacorp" stage="implementation" version="v1" />
        </div>
      </div>

      {/* Section 2: Header with running pip and progress */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          Header (running=true, progress line):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <WorkspaceHeader
            title="Pandacorp"
            stage="implementation"
            version="v1"
            running={true}
            progress="Implementando el Panel Portfolio"
          />
        </div>
      </div>

      {/* Section 3: Objectives bar */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          ObjectivesBar (4/9 done):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <ObjectivesBar done={4} total={9} />
        </div>
      </div>

      {/* Section 4: Objectives bar at 100% */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          ObjectivesBar (9/9, complete — should turn ok/green):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <ObjectivesBar done={9} total={9} />
        </div>
      </div>

      {/* Section 5: Tab bar (the .stab pills) */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          Workspace subtabs (6 tabs, active={activeTab}):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "10px 14px",
          }}
        >
          <SubTabs
            tabs={WORKSPACE_TABS}
            active={activeTab}
            onChange={setActiveTab}
            ariaLabel="Preview workspace tabs"
          />
        </div>
      </div>

      {/* Section 6: Full workspace shell composed */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "var(--color-text2)", marginBottom: "8px" }}>
          Full shell composed (header + objectives + tabs):
        </p>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <WorkspaceHeader
            title="budget-buddy"
            stage="implementation"
            version="v1"
            running={true}
            progress="Construyendo «Registrar gasto»"
          />
          <ObjectivesBar done={2} total={7} />
          <div style={{ padding: "8px 14px 4px" }}>
            <SubTabs
              tabs={WORKSPACE_TABS}
              active={activeTab}
              onChange={setActiveTab}
              ariaLabel="Preview workspace tabs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
