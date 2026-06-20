/**
 * WO-13-008 preview route — visual fidelity check (DR-056).
 * Renders Shield, TierBadge, ItemSlot, KanbanColumn on a real page
 * so the implementer can compare against the prototype mock.
 *
 * This file is NOT shipping code — it exists only for the in-loop
 * fidelity check and can be removed after IN_REVIEW.
 */

import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { KanbanColumn } from "@/components/core/KanbanColumn/KanbanColumn";
import { Shield } from "@/components/core/Shield/Shield";
import { TierBadge } from "@/components/core/TierBadge/TierBadge";

const TIER_EXAMPLES = [
  { tier: 1, name: "Bronce" },
  { tier: 2, name: "Plata" },
  { tier: 3, name: "Oro" },
  { tier: 4, name: "Platino" },
  { tier: 5, name: "Leyenda" },
] as const;

const WO_CARDS = [
  { id: "WO-01-001", title: "Token schema y key maps", frd: "FRD-13" },
  { id: "WO-01-002", title: "globals.css wiring", frd: "FRD-13" },
  { id: "WO-01-003", title: "tabular-nums + a11y primitivas", frd: "FRD-13" },
];

export default function PreviewWo13008Page(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "960px",
        margin: "0 auto",
        color: "var(--color-text)",
        fontFamily: "var(--font-body)",
      }}
    >
      <h2
        style={{
          color: "var(--color-text3)",
          fontSize: "11px",
          fontFamily: "var(--font-pixel)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "24px",
        }}
      >
        WO-13-008 — Vista previa visual (DR-056)
      </h2>

      {/* ── Shield ─────────────────────────────────────────────────────────── */}
      <section
        aria-label="Shield component preview"
        style={{ marginBottom: "40px" }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text2)",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Shield — crest medallion
        </h3>
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <Shield level={1} size="sm" />
            <div style={{ fontSize: "11px", color: "var(--color-text3)", marginTop: "6px" }}>sm · Nv 1</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Shield level={7} size="md" />
            <div style={{ fontSize: "11px", color: "var(--color-text3)", marginTop: "6px" }}>md · Nv 7 (default)</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Shield level={42} size="lg" />
            <div style={{ fontSize: "11px", color: "var(--color-text3)", marginTop: "6px" }}>lg · Nv 42</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Shield level={7} size="md" glow={false} />
            <div style={{ fontSize: "11px", color: "var(--color-text3)", marginTop: "6px" }}>glow=false</div>
          </div>
        </div>
      </section>

      {/* ── TierBadge ─────────────────────────────────────────────────────── */}
      <section
        aria-label="TierBadge component preview"
        style={{ marginBottom: "40px" }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text2)",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          TierBadge — rarity medal
        </h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {TIER_EXAMPLES.map(({ tier, name }) => (
            <TierBadge key={tier} tier={tier} name={name} />
          ))}
        </div>
      </section>

      {/* ── ItemSlot ──────────────────────────────────────────────────────── */}
      <section
        aria-label="ItemSlot component preview"
        style={{ marginBottom: "40px" }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text2)",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ItemSlot — pixel-art icon slot
        </h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* accent tone, various sizes */}
          <div style={{ textAlign: "center" }}>
            <ItemSlot
              icon={<span style={{ fontSize: "18px", lineHeight: 1 }}>★</span>}
              size={34}
              tone="accent"
              aria-label="Ranura de logro (acento)"
            />
            <div style={{ fontSize: "10px", color: "var(--color-text3)", marginTop: "4px" }}>34 accent</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <ItemSlot
              icon={<span style={{ fontSize: "21px", lineHeight: 1 }}>⚠</span>}
              size={40}
              tone="warn"
              aria-label="Ranura de advertencia"
            />
            <div style={{ fontSize: "10px", color: "var(--color-text3)", marginTop: "4px" }}>40 warn</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <ItemSlot
              icon={<span style={{ fontSize: "22px", lineHeight: 1 }}>✓</span>}
              size={42}
              tone="ok"
              aria-label="Ranura completada"
            />
            <div style={{ fontSize: "10px", color: "var(--color-text3)", marginTop: "4px" }}>42 ok</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <ItemSlot
              icon={<span style={{ fontSize: "31px", lineHeight: 1 }}>🏆</span>}
              size={58}
              tone="danger"
              aria-label="Ranura de peligro"
            />
            <div style={{ fontSize: "10px", color: "var(--color-text3)", marginTop: "4px" }}>58 danger</div>
          </div>
          {/* locked + reveal */}
          <div style={{ textAlign: "center" }}>
            <ItemSlot
              icon={<span style={{ fontSize: "20px", lineHeight: 1 }}>?</span>}
              size={40}
              lock={true}
              reveal={
                <span style={{ fontSize: "11px", color: "var(--color-accent-text)", lineHeight: 1.3 }}>
                  Completa 3 proyectos
                </span>
              }
              aria-label="Ranura bloqueada — pasa el cursor para ver cómo desbloquear"
            />
            <div style={{ fontSize: "10px", color: "var(--color-text3)", marginTop: "4px" }}>locked+reveal</div>
          </div>
        </div>
      </section>

      {/* ── KanbanColumn ──────────────────────────────────────────────────── */}
      <section
        aria-label="KanbanColumn component preview"
        style={{ marginBottom: "40px" }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text2)",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          KanbanColumn — 224px fixed WO column
        </h3>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
          <KanbanColumn label="Pendiente" count={WO_CARDS.length}>
            {WO_CARDS.map((wo) => (
              <div
                key={wo.id}
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "9px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text)",
                }}
              >
                {wo.title}
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "6px",
                    fontSize: "11px",
                    padding: "1px 8px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-accent-bg)",
                    color: "var(--color-accent-text)",
                    border: "1px solid transparent",
                  }}
                >
                  {wo.frd}
                </span>
              </div>
            ))}
          </KanbanColumn>

          <KanbanColumn label="En progreso" count={1}>
            <div
              style={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "9px",
                padding: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text)",
              }}
            >
              ThemeToggle (luz/oscuro)
            </div>
          </KanbanColumn>

          <KanbanColumn label="Revisión" count={0} />

          <KanbanColumn label="Hecho" count={2}>
            {["Token schema", "globals.css"].map((title) => (
              <div
                key={title}
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "9px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text2)",
                  opacity: 0.8,
                }}
              >
                {title}
              </div>
            ))}
          </KanbanColumn>
        </div>
      </section>
    </div>
  );
}
