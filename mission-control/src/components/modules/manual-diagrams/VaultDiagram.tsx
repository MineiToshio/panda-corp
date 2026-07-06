/**
 * manual-diagrams/VaultDiagram.tsx — Concept "El vault · tu estado personal"
 *
 * The mental model of the vault: ONE folder on disk (`panda-corp/`), TWO git
 * repos that track DISJOINT sets of files. The central box holds three stacked
 * bands (code+framework / personal data / ephemeral); on the left two git stores
 * point each at the band it tracks; on the right the two remotes each pull from
 * their store. No file lives in both repos → zero duplication, no second source
 * of truth.
 *
 * Design rules (FRD-13 / AGENTS.md): ZERO hardcoded colors — CSS custom
 * properties (tokens) only; light + dark first-class; decorative glyphs
 * aria-hidden; meaning never by color alone (each band/store is also labelled).
 * Responsive: viewBox + width 100%, scrolls inside its Panel on narrow screens.
 *
 * Traceability: CMP-08-diagrams (vault).
 */

import type React from "react";

// A labelled colour legend so the two encoded colours never carry meaning alone.
const LEGEND: readonly { readonly color: string; readonly label: string }[] = [
  { color: "var(--color-accent)", label: "código y framework · repo compartido" },
  { color: "var(--color-warn)", label: "tus datos personales · repo privado" },
  { color: "var(--color-text3)", label: "efímero · se regenera, nadie lo trackea" },
] as const;

export function VaultDiagram(): React.JSX.Element {
  return (
    <figure data-testid="manual-diagram-vault" style={{ margin: 0 }}>
      <svg
        viewBox="0 0 760 470"
        width="100%"
        role="img"
        aria-label="Una sola carpeta en disco con tres bandas de archivos, dos repos git que trackean bandas distintas, y dos remotos"
        style={{ display: "block", height: "auto", fontFamily: "var(--font-sans, sans-serif)" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* arrowhead marker (neutral) */}
        <defs>
          <marker
            id="vault-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M1,1 L7,4 L1,7" fill="none" stroke="var(--color-text3)" strokeWidth="1.4" />
          </marker>
        </defs>

        {/* ---- central box: one folder on disk ---- */}
        <rect
          x="250"
          y="70"
          width="260"
          height="330"
          rx="12"
          fill="var(--color-card)"
          stroke="var(--color-border-strong)"
          strokeWidth="1.5"
        />
        <text
          x="380"
          y="54"
          textAnchor="middle"
          fontSize="13"
          fontWeight={600}
          fill="var(--color-text)"
        >
          una sola carpeta en disco
        </text>
        <text
          x="380"
          y="94"
          textAnchor="middle"
          fontSize="12"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--color-text2)"
        >
          panda-corp/
        </text>

        {/* band 1 — code & framework (accent) */}
        <g>
          <rect
            x="266"
            y="108"
            width="228"
            height="82"
            rx="8"
            fill="var(--color-accent-bg)"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <text x="282" y="130" fontSize="12" fontWeight={600} fill="var(--color-accent-text)">
            código y framework
          </text>
          <text
            x="282"
            y="150"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            CLAUDE.md · plugin/
          </text>
          <text
            x="282"
            y="167"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            mission-control/src
          </text>
        </g>

        {/* band 2 — personal data (warn) */}
        <g>
          <rect
            x="266"
            y="200"
            width="228"
            height="98"
            rx="8"
            fill="var(--color-warn-bg)"
            stroke="var(--color-warn)"
            strokeWidth="1.5"
          />
          <text x="282" y="222" fontSize="12" fontWeight={600} fill="var(--color-text)">
            tus datos personales
          </text>
          <text
            x="282"
            y="242"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            factory/profile.md
          </text>
          <text
            x="282"
            y="259"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            ideas/ · portfolio
          </text>
          <text
            x="282"
            y="276"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            ports · ledger · memoria
          </text>
        </g>

        {/* band 3 — ephemeral (neutral) */}
        <g>
          <rect
            x="266"
            y="308"
            width="228"
            height="76"
            rx="8"
            fill="var(--color-base)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text x="282" y="330" fontSize="12" fontWeight={600} fill="var(--color-text3)">
            efímero
          </text>
          <text
            x="282"
            y="350"
            fontSize="10.5"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text3)"
          >
            node_modules · .next · logs
          </text>
          <text x="282" y="367" fontSize="10.5" fill="var(--color-text3)">
            se regeneran — nadie los trackea
          </text>
        </g>

        {/* ---- left: two git stores ---- */}
        {/* repo 1 → accent band */}
        <g>
          <rect
            x="16"
            y="118"
            width="176"
            height="52"
            rx="9"
            fill="var(--color-card)"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <text x="30" y="139" fontSize="11.5" fontWeight={600} fill="var(--color-text)">
            repo 1
          </text>
          <text
            x="30"
            y="157"
            fontSize="10"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            panda-corp/.git (dentro)
          </text>
          <path
            d="M192,144 C222,144 236,149 264,149"
            fill="none"
            stroke="var(--color-text3)"
            strokeWidth="1.6"
            markerEnd="url(#vault-arrow)"
          />
        </g>

        {/* repo 2 → personal band */}
        <g>
          <rect
            x="16"
            y="238"
            width="176"
            height="58"
            rx="9"
            fill="var(--color-card)"
            stroke="var(--color-warn)"
            strokeWidth="1.5"
          />
          <text x="30" y="259" fontSize="11.5" fontWeight={600} fill="var(--color-text)">
            repo 2 · el overlay
          </text>
          <text
            x="30"
            y="277"
            fontSize="10"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            pandacorp-vault/
          </text>
          <text
            x="30"
            y="290"
            fontSize="10"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--color-text2)"
          >
            personal.git (hermano, fuera)
          </text>
          <path
            d="M192,266 C224,266 236,258 264,252"
            fill="none"
            stroke="var(--color-text3)"
            strokeWidth="1.6"
            markerEnd="url(#vault-arrow)"
          />
        </g>

        {/* ---- right: two remotes ---- */}
        {/* remote 1 ← repo 1 (shared) */}
        <g>
          <path
            d="M496,149 C528,149 540,120 566,120"
            fill="none"
            stroke="var(--color-text3)"
            strokeWidth="1.6"
            markerEnd="url(#vault-arrow)"
          />
          <rect
            x="568"
            y="96"
            width="176"
            height="52"
            rx="9"
            fill="var(--color-card)"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          <text x="582" y="117" fontSize="11.5" fontWeight={600} fill="var(--color-text)">
            GitHub compartido
          </text>
          <text x="582" y="135" fontSize="10" fill="var(--color-text2)">
            el equipo ve el código
          </text>
        </g>

        {/* remote 2 ← repo 2 (private) */}
        <g>
          <path
            d="M496,252 C530,252 540,276 566,276"
            fill="none"
            stroke="var(--color-text3)"
            strokeWidth="1.6"
            markerEnd="url(#vault-arrow)"
          />
          <rect
            x="568"
            y="252"
            width="176"
            height="58"
            rx="9"
            fill="var(--color-card)"
            stroke="var(--color-warn)"
            strokeWidth="1.5"
          />
          <text x="582" y="273" fontSize="11.5" fontWeight={600} fill="var(--color-text)">
            GitHub privado
          </text>
          <text x="582" y="291" fontSize="10" fill="var(--color-text2)">
            solo tú · offsite
          </text>
          <text x="582" y="304" fontSize="10" fill="var(--color-text2)">
            sobrevive al portátil
          </text>
        </g>

        {/* caption */}
        <text x="380" y="428" textAnchor="middle" fontSize="11.5" fill="var(--color-text2)">
          una carpeta · dos repos que trackean archivos distintos
        </text>
        <text
          x="380"
          y="448"
          textAnchor="middle"
          fontSize="11.5"
          fontWeight={600}
          fill="var(--color-text)"
        >
          ninguno está en los dos → cero copia, cero doble verdad
        </text>
      </svg>

      <figcaption style={{ marginTop: "10px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px" }}>
          {LEGEND.map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--color-text2)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: item.color,
                  flex: "0 0 auto",
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
