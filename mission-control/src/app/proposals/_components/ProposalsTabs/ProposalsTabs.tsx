"use client";

/**
 * ProposalsTabs — the Memoria | Backlog sub-tab switcher (CMP-22-tabs, FRD-22).
 *
 * Both "proposals to change the factory" live on one page (DR-103): the memory
 * self-learning streams and the actionable factory backlog. This client wrapper
 * uses THE one Tabs primitive (core/Tabs, DR-062 — no bespoke switcher) to toggle
 * between the two panels, which are passed in as slots (rendered by the Server
 * Component page so their data reads stay server-side).
 *
 * Both panels stay mounted (toggled with `hidden`) so the memory streams' local
 * dismiss state survives a tab switch. Panels carry `data-volatile` (DR-088) so
 * the visual baseline masks their live, length-varying factory data.
 *
 * Traceability:
 *   CMP-22-tabs → REQ-22-002 (in-page tab split), AC-22-002.x
 */

import { useState } from "react";
import { Tabs } from "@/components/core/Tabs/Tabs";

type ProposalsTabId = "memoria" | "backlog";

const TAB_ID_PREFIX = "proposals-tab-id-";

const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0",
};

export interface ProposalsTabsProps {
  /** The memory self-learning panel (health + streams + promotions queue). */
  memoryPanel: React.ReactNode;
  /** The factory backlog panel (BL-* items grouped by status). */
  backlogPanel: React.ReactNode;
  /** Count of open backlog items, shown as the Backlog tab badge. */
  backlogOpenCount: number;
}

export function ProposalsTabs({
  memoryPanel,
  backlogPanel,
  backlogOpenCount,
}: ProposalsTabsProps): React.JSX.Element {
  const [active, setActive] = useState<ProposalsTabId>("memoria");

  return (
    <div>
      <Tabs
        level="sub"
        ariaLabel="Memoria o backlog"
        active={active}
        onChange={(id) => setActive(id as ProposalsTabId)}
        testIdPrefix="proposals-tab-"
        tabIdPrefix={TAB_ID_PREFIX}
        tabs={[
          { id: "memoria", label: "Memoria", icon: "ti-bulb" },
          {
            id: "backlog",
            label: "Backlog",
            icon: "ti-checklist",
            count: backlogOpenCount > 0 ? backlogOpenCount : undefined,
          },
        ]}
      />

      <div
        role="tabpanel"
        aria-labelledby={`${TAB_ID_PREFIX}memoria`}
        hidden={active !== "memoria"}
        data-volatile
        style={active === "memoria" ? PANEL_STYLE : undefined}
      >
        {memoryPanel}
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`${TAB_ID_PREFIX}backlog`}
        hidden={active !== "backlog"}
        data-volatile
        style={active === "backlog" ? PANEL_STYLE : undefined}
      >
        {backlogPanel}
      </div>
    </div>
  );
}
