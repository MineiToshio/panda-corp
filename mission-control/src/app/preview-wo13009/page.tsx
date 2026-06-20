/**
 * WO-13-009 preview route — visual fidelity check (DR-056).
 * Renders all 11 shared Party canvas primitives in a La Fragua-style
 * composition so the implementer can compare against the prototype mock
 * (docs/frds/frd-06-party/mocks/la-fragua.html).
 *
 * This file is NOT shipping code — it exists only for the in-loop
 * fidelity check and can be removed after IN_REVIEW.
 */

import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { DemoControls } from "@/components/modules/party/DemoControls/DemoControls";
import type { FlowBeat } from "@/components/modules/party/FlowStrip/FlowStrip";
import { FlowStrip } from "@/components/modules/party/FlowStrip/FlowStrip";
import { JudgeSprite } from "@/components/modules/party/JudgeSprite/JudgeSprite";
import { MissionBar } from "@/components/modules/party/MissionBar/MissionBar";
import { Parchment } from "@/components/modules/party/Parchment/Parchment";
import { PowerOffOverlay } from "@/components/modules/party/PowerOffOverlay/PowerOffOverlay";
import { Room } from "@/components/modules/party/Room/Room";
import { SpeechBubble } from "@/components/modules/party/SpeechBubble/SpeechBubble";
import { StoneBridge } from "@/components/modules/party/StoneBridge/StoneBridge";
import { Tooltip } from "@/components/modules/party/Tooltip/Tooltip";

const EIGHT_BEATS: readonly FlowBeat[] = [
  { key: "product", icon: "📋", label: "Producto", sub: "spec" },
  { key: "design", icon: "🎨", label: "Diseño", sub: "tokens" },
  { key: "architecture", icon: "📐", label: "Arquitectura", sub: "blueprint" },
  { key: "foundation", icon: "🧱", label: "Fundación", sub: "FND" },
  { key: "build", icon: "⚒️", label: "Construcción", sub: "FRD×N" },
  { key: "review", icon: "⚖️", label: "Revisión", sub: "gate" },
  { key: "integration", icon: "🔗", label: "Integración", sub: "cross" },
  { key: "release", icon: "🚀", label: "Release", sub: "deploy" },
];

const FRD_PIPS = [
  { id: "FRD-02", state: "done" as const },
  { id: "FRD-06", state: "current" as const },
  { id: "FRD-13", state: "current" as const },
  { id: "FRD-15", state: "pending" as const },
];

export default function PreviewWo13009Page(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-base)",
        color: "var(--color-text)",
        fontFamily: "var(--font-sans)",
        padding: "24px",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "20px",
          color: "var(--color-accent)",
          marginBottom: "8px",
        }}
      >
        WO-13-009 — Party Canvas Primitives Preview
      </h1>
      <p style={{ fontSize: "12px", color: "var(--color-text2)", marginBottom: "32px" }}>
        Compare against{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>
          docs/frds/frd-06-party/mocks/la-fragua.html
        </code>
      </p>

      {/* ── MissionBar ────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          MissionBar
        </h2>
        <MissionBar frdPips={FRD_PIPS} done={52} total={109} effort="potente" />
      </section>

      {/* ── FlowStrip ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          FlowStrip
        </h2>
        <FlowStrip beats={EIGHT_BEATS} activeKeys={["foundation", "build"]} />
      </section>

      {/* ── La Fragua Stage (920×560) ─────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          Stage — Rooms + Bridges + Sprites (La Fragua layout)
        </h2>
        <div
          style={{
            position: "relative",
            width: "920px",
            height: "560px",
            background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          {/* Forge room (La Fragua) */}
          <Room
            zone="forge"
            label="La Fragua"
            state="hot"
            count={3}
            style={{ left: 40, top: 60, width: 280, height: 200 }}
          >
            <AgentSprite
              agentRole="implementer"
              state="work"
              woId="WO-06-001"
              progress={0.65}
              style={{ left: 60, top: 80 }}
            />
            <AgentSprite
              agentRole="implementer"
              state="carry"
              woId="WO-06-002"
              style={{ left: 130, top: 80 }}
            />
            <SpeechBubble text="RED → GREEN" />
          </Room>

          {/* Horizontal bridge */}
          <StoneBridge
            orientation="h"
            flow={true}
            style={{ left: 326, top: 120, width: 140, height: 60 }}
          />

          {/* Tribunal room */}
          <Room
            zone="tribunal"
            label="Tribunal del Juez"
            state="hot"
            style={{ left: 470, top: 60, width: 240, height: 200 }}
          >
            <JudgeSprite active={true} judgingTarget="WO-06-003" style={{ left: 90, top: 80 }} />
            <Tooltip
              content={<span>WO-06-003 · revisando</span>}
              anchor={{ bottom: "210px", left: "540px" }}
            />
          </Room>

          {/* Vertical bridge */}
          <StoneBridge
            orientation="v"
            flow={false}
            style={{ left: 554, top: 266, width: 60, height: 100 }}
          />

          {/* Vault room */}
          <Room
            zone="vault"
            label="La Bóveda"
            state="done"
            count={7}
            style={{ left: 470, top: 370, width: 240, height: 160 }}
          >
            <AgentSprite
              agentRole="implementer"
              state="vault"
              woId="WO-06-004"
              style={{ left: 90, top: 60 }}
            />
          </Room>

          {/* Parchment overlay */}
          <Parchment
            from="WO-06-001"
            to="WO-06-003"
            style={{ left: 340, top: 220, width: 120, height: 80 }}
          />

          {/* PowerOffOverlay (off state — should be invisible) */}
          <PowerOffOverlay off={false} />
        </div>
      </section>

      {/* ── Individual component samples ──────────────────────────────────── */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>
        {/* SpeechBubble standalone */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text2)",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            SpeechBubble
          </p>
          <div style={{ position: "relative", width: "160px", height: "60px" }}>
            <SpeechBubble text="RED → GREEN · tests pass" />
          </div>
          <div style={{ position: "relative", width: "160px", height: "60px", marginTop: "8px" }}>
            <SpeechBubble text="Refactorizar ahora" raised={true} />
          </div>
        </div>

        {/* Tooltip standalone */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text2)",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            Tooltip
          </p>
          <div style={{ position: "relative", width: "200px", height: "80px" }}>
            <Tooltip
              content={
                <span>
                  <b>WO-06-001</b> · build party primitives
                  <br />
                  Estado: work · Progreso: 65%
                </span>
              }
              anchor={{ top: "10px", left: "10px" }}
            />
          </div>
        </div>

        {/* AgentSprite — all states */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text2)",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            AgentSprite states
          </p>
          <div style={{ display: "flex", gap: "12px", position: "relative", height: "80px" }}>
            {(["work", "carry", "vault", "idle"] as const).map((s) => (
              <AgentSprite
                key={s}
                agentRole="implementer"
                state={s}
                woId={`WO-0${s.length}`}
                progress={s === "work" ? 0.4 : 0}
                style={{ position: "static", display: "inline-block" }}
              />
            ))}
          </div>
        </div>

        {/* JudgeSprite — active / inactive */}
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text2)",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}
          >
            JudgeSprite
          </p>
          <div style={{ display: "flex", gap: "16px", position: "relative", height: "80px" }}>
            <JudgeSprite active={true} style={{ position: "static", display: "inline-block" }} />
            <JudgeSprite active={false} style={{ position: "static", display: "inline-block" }} />
          </div>
        </div>
      </div>

      {/* ── DemoControls wrapper ──────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          DemoControls
        </h2>
        <DemoControls note="Los controles de escena son solo demo — DR-061">
          <p style={{ fontSize: "12px", color: "var(--color-text2)" }}>
            Demo children: sliders, toggles, scene controls
          </p>
        </DemoControls>
      </section>

      {/* ── PowerOffOverlay (on=true) ─────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-text2)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          PowerOffOverlay (off=true)
        </h2>
        <div style={{ position: "relative", width: "400px", height: "200px", overflow: "hidden" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "var(--color-panel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "var(--color-text2)",
            }}
          >
            Content beneath the overlay
          </div>
          <PowerOffOverlay off={true} />
        </div>
      </section>
    </div>
  );
}
