/**
 * WO-13-007 preview route — visual fidelity check (DR-056).
 * Renders Banner, Chip, CountBadge, Panel, CmdRow, Button, Toast,
 * ProgressBar and DocHeading so the implementer can compare against
 * the prototype's shared component patterns.
 *
 * This file exists only for the in-loop fidelity check.
 */

"use client";

import { useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { DocHeading } from "@/components/core/DocHeading/DocHeading";
import { Panel } from "@/components/core/Panel/Panel";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { Toast } from "@/components/core/Toast/Toast";

export default function PreviewPage() {
  const [toastVisible, setToastVisible] = useState(false);
  const [warnDismissed, setWarnDismissed] = useState(false);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "860px",
        margin: "0 auto",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <h2
        style={{
          color: "var(--color-text3)",
          fontSize: "11px",
          letterSpacing: ".08em",
          marginBottom: "24px",
          textTransform: "uppercase",
        }}
      >
        WO-13-007 — Visual Fidelity Check
      </h2>

      {/* ── Banner ──────────────────────────────────────────────── */}
      <SectionHead label="Banner — shared warn/info/ok/danger strip" />

      <div style={{ marginBottom: "8px" }}>
        {!warnDismissed && (
          <Banner
            tone="warn"
            kind="drift"
            heading="Plugin desincronizado · v8.21.0 → v8.24.1"
            detail="Editaste el plugin pero la versión instalada no está al día. Hasta actualizar, los skills nuevos o editados no toman efecto."
            commandRow="claude plugin update pandacorp@panda-corp"
            dismissible
            onDismiss={() => {
              setWarnDismissed(true);
            }}
          />
        )}
      </div>

      <div style={{ marginBottom: "8px" }}>
        <Banner
          tone="info"
          heading="2 proyectos no reconocidos"
          detail="Están en el portfolio pero el directorio no existe en la ruta esperada."
          items={[
            { id: "1", label: "panda-corp/tienda-virtual — ruta no encontrada" },
            { id: "2", label: "panda-corp/dashboard-analytics — sin .pandacorp/" },
            { id: "3", label: "panda-corp/legado-app — sin .pandacorp/" },
          ]}
          collapseAfter={2}
          dismissible
        />
      </div>

      <div style={{ marginBottom: "8px" }}>
        <Banner
          tone="ok"
          heading="Gate aprobado — FRD-07 Configuración"
          detail="Todos los criterios de aceptación verificados."
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <Banner
          tone="danger"
          heading="Error al leer el portafolio"
          detail="factory/portfolio.md no pudo ser parseado. Revisa el formato YAML del frontmatter."
        />
      </div>

      {/* ── Chip ──────────────────────────────────────────────────── */}
      <SectionHead label="Chip — the one pill primitive" />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        <Chip tone="ok">en vivo</Chip>
        <Chip tone="warn">sin señal</Chip>
        <Chip tone="danger">falló</Chip>
        <Chip tone="info">FRD-13</Chip>
        <Chip tone="accent">accent</Chip>
        <Chip tone="secondary">secondary</Chip>
      </div>

      {/* ── CountBadge ────────────────────────────────────────────── */}
      <SectionHead label="CountBadge — numeric pill" />

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "20px" }}>
        <CountBadge count={3} tone="warn" />
        <CountBadge count={12} tone="danger" />
        <CountBadge count={0} tone="accent" />
        <span style={{ fontSize: "12px", color: "var(--color-text3)" }}>
          decisions · bugs · proposals
        </span>
      </div>

      {/* ── Panel ─────────────────────────────────────────────────── */}
      <SectionHead label="Panel / RpgPanel — app-wide surface" />

      <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
        <Panel variant="panel">
          <p style={{ margin: 0, fontSize: "13px" }}>
            Panel (base) — RPG embossed pressed-pixel-tile signature
          </p>
        </Panel>

        <Panel variant="rpgpanel" grid>
          <p style={{ margin: 0, fontSize: "13px" }}>
            RpgPanel + grid overlay — the living-map background
          </p>
        </Panel>

        <Panel variant="secondary" glow="warn">
          <p style={{ margin: 0, fontSize: "13px" }}>Secondary (resting tile) + warn glow</p>
        </Panel>

        <Panel variant="panel" glow="accent" elevation={1}>
          <p style={{ margin: 0, fontSize: "13px" }}>Panel + accent glow + elevation 1</p>
        </Panel>
      </div>

      {/* ── CmdRow ────────────────────────────────────────────────── */}
      <SectionHead label="CmdRow — mono command row" />

      <div style={{ marginBottom: "20px" }}>
        <CmdRow command="claude plugin update pandacorp@panda-corp" />
        <CmdRow command="/pandacorp:implement --mode powerful" />
        <CmdRow command="git worktree add .worktrees/frd-07 frd-07" copy={false} />
      </div>

      {/* ── Button ────────────────────────────────────────────────── */}
      <SectionHead label="Button — primary / secondary / ghost" />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <Button variant="primary">Aprobar</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="ghost">Ver más</Button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <Button variant="primary" size="sm">
          sm primary
        </Button>
        <Button variant="secondary" size="sm">
          sm secondary
        </Button>
        <Button variant="ghost" size="sm">
          sm ghost
        </Button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <Button variant="primary" size="lg">
          lg primary
        </Button>
        <Button variant="secondary" size="lg">
          lg secondary
        </Button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        <Button variant="primary" disabled>
          disabled primary
        </Button>
        <Button variant="secondary" disabled>
          disabled secondary
        </Button>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      <SectionHead label="Toast — transient bottom confirmation" />

      <div style={{ marginBottom: "20px" }}>
        <Button
          variant="secondary"
          onClick={() => {
            setToastVisible(true);
          }}
        >
          Mostrar Toast
        </Button>
        <Toast
          message="¡Copiado! claude plugin update pandacorp@panda-corp"
          visible={toastVisible}
          onDismiss={() => {
            setToastVisible(false);
          }}
        />
      </div>

      {/* ── ProgressBar ───────────────────────────────────────────── */}
      <SectionHead label="ProgressBar — mission objectives" />

      <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
        <ProgressBar done={3} total={8} ariaLabel="Misión objetivos" />
        <ProgressBar done={5} total={5} ariaLabel="Completado" />
        <ProgressBar done={0} total={6} ariaLabel="Sin inicio" />
        <ProgressBar done={1} total={10} ariaLabel="En progreso bajo" />
      </div>

      {/* ── DocHeading ────────────────────────────────────────────── */}
      <SectionHead label="DocHeading — reading heading with accent ledge" />

      <div style={{ marginBottom: "20px" }}>
        <Panel variant="panel">
          <DocHeading title="Introducción al sistema" level={2} />
          <p style={{ fontSize: "13px", color: "var(--color-text2)", margin: "8px 0 16px" }}>
            Este panel contiene documentación con headings tipográficos.
          </p>
          <DocHeading title="Sección de referencia" level={3} />
          <p style={{ fontSize: "13px", color: "var(--color-text2)", margin: "8px 0" }}>
            Cada heading lleva un ledge de acento a la izquierda.
          </p>
        </Panel>
      </div>

      {/* ── Composite example ─────────────────────────────────────── */}
      <SectionHead label="Composite — Banner inside Panel" />

      <div style={{ marginBottom: "20px" }}>
        <Panel variant="panel">
          <div style={{ marginBottom: "12px" }}>
            <Banner
              tone="warn"
              kind="inline"
              heading="Decisión pendiente desde hace 3 días"
              detail="Responde para que el agente pueda continuar."
              commandRow="/pandacorp:decide"
            />
          </div>
          <ProgressBar done={7} total={9} ariaLabel="WO progress" />
        </Panel>
      </div>
    </div>
  );
}
