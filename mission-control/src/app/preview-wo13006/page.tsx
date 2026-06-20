/**
 * WO-13-006 preview route — visual fidelity check (DR-056).
 * Renders PageTitle, SectionHead, and Tabs/SubTabs on a real page
 * so the implementer can compare against the prototype mock.
 *
 * This file is NOT shipping code — it exists only for the in-loop
 * fidelity check and can be removed after IN_REVIEW.
 */

"use client";

import { useState } from "react";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { SubTabs, Tabs } from "@/components/core/Tabs/Tabs";

const TOP_TABS = [
  { id: "dashboard", label: "Inicio" },
  { id: "ideas", label: "Tablero" },
  { id: "portfolio", label: "Portfolio" },
  { id: "propuestas", label: "Propuestas", count: 3 },
  { id: "logros", label: "Logros" },
  { id: "manual", label: "Documentación" },
];

const SUB_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "workorders", label: "Work orders" },
  { id: "mission", label: "Party" },
  { id: "observabilidad", label: "Observabilidad" },
  { id: "docs", label: "Documentos" },
  { id: "comandos", label: "Comandos" },
];

export default function PreviewPage() {
  const [topActive, setTopActive] = useState("dashboard");
  const [subActive, setSubActive] = useState("resumen");

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "900px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          color: "var(--color-text3)",
          fontSize: "11px",
          letterSpacing: ".08em",
          marginBottom: "24px",
        }}
      >
        WO-13-006 — VISUAL FIDELITY CHECK
      </h2>

      {/* ── PageTitle examples ─────────────────────────────────────── */}
      <SectionHead label="PageTitle component" icon="ti-layout-dashboard" />

      <div style={{ marginBottom: "24px" }}>
        <PageTitle
          icon="ti-home"
          title="Inicio"
          subtitle="Tu cabina de mando: lo que espera por ti, el pulso de la fábrica y la cartera en obra."
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <PageTitle
          icon="ti-layout-kanban"
          title="Tablero"
          subtitle="El tablero de ideas: cada una recorre las 6 fases del pipeline."
          tail={
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-text3)",
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
              }}
            >
              12 ideas
            </span>
          }
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <PageTitle icon="ti-award" title="Logros" subtitle="El salón del gremio." />
      </div>

      {/* ── SectionHead examples ───────────────────────────────────── */}
      <SectionHead label="SectionHead component" icon="ti-components" />

      <div style={{ marginBottom: "8px" }}>
        <SectionHead label="Tu turno" icon="ti-flag-3" />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <SectionHead label="Pulso de la fábrica" icon="ti-activity-heartbeat" />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <SectionHead label="Construcción y cartera" icon="ti-layout-grid" />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <SectionHead label="En ascenso" icon="ti-flame" count={7} />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <SectionHead
          label="Legendarias"
          icon="ti-crown"
          rightHtml={
            <span
              style={{
                fontSize: "11px",
                background: "var(--color-accent-bg)",
                color: "var(--color-accent-text)",
                padding: "1px 8px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              en vivo
            </span>
          }
        />
      </div>

      {/* ── Tabs (top level) ──────────────────────────────────────── */}
      <SectionHead label="Tabs — top level" icon="ti-layout-navbar" />

      <div style={{ marginBottom: "24px" }}>
        <Tabs
          level="top"
          tabs={TOP_TABS}
          active={topActive}
          onChange={setTopActive}
          ariaLabel="Navegación principal"
        />
        <p style={{ fontSize: "12px", color: "var(--color-text3)", marginTop: "8px" }}>
          Activo: {topActive}
        </p>
      </div>

      {/* ── SubTabs (sub level) ───────────────────────────────────── */}
      <SectionHead label="SubTabs — sub level" icon="ti-layout-navbar-collapse" />

      <div style={{ marginBottom: "24px" }}>
        <SubTabs
          tabs={SUB_TABS}
          active={subActive}
          onChange={setSubActive}
          ariaLabel="Pestañas del proyecto"
        />
        <p style={{ fontSize: "12px", color: "var(--color-text3)", marginTop: "8px" }}>
          Activo: {subActive}
        </p>
      </div>

      {/* ── Tabs with icons ──────────────────────────────────────── */}
      <SectionHead label="SubTabs with icons" icon="ti-icons" />

      <div style={{ marginBottom: "24px" }}>
        <SubTabs
          tabs={[
            { id: "campana", label: "Campaña", icon: "ti-map-2" },
            { id: "docs", label: "Documentos", icon: "ti-files" },
            { id: "comandos", label: "Comandos", icon: "ti-wand" },
          ]}
          active="campana"
          onChange={() => {}}
        />
      </div>
    </div>
  );
}
