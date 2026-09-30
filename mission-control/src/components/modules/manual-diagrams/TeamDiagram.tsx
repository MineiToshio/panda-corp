/**
 * manual-diagrams/TeamDiagram.tsx — FRD-08 ("El equipo de agentes")
 *
 * The agent roster grouped by phase: each group is a label + a wrap of role
 * cards (Avatar + role id + role title), followed by one bio card per agent.
 * Both views read the SAME `GROUPS` array, so the diagram and the bios cannot
 * disagree (DR-115). A guard test compares the roster against `plugin/agents/`.
 *
 * Faithful recreation of the prototype `teamDiagram()` (index.html L1063-1065).
 * In the prototype the cards are click-to-navigate to the agent detail; the
 * Manual surfaces that detail via the Referencia → Agentes catalog, so here the
 * diagram cards are presentational (the diagram's APPEARANCE is what we re-anchor).
 *
 * Tokens only · light+dark first-class · Avatar reused (no fork).
 *
 * Traceability: CMP-08-diagrams (team).
 */

import type React from "react";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";

// ---------------------------------------------------------------------------
// Roster data — mirrors the prototype `groups` array (label + role ids), plus
// the Spanish bio the owner reads. The role title is the Manual's static label
// (the prototype reads CONFIG.agents `.rol`; the Manual keeps the same human
// role names here).
// ---------------------------------------------------------------------------

/**
 * Canonical roles have a pixel sprite; plugin agents outside `AGENT_ROLES` (no dedicated
 * art yet) get an icon tile instead, so `Avatar` never mislabels them with another role.
 */
type Visual =
  | { readonly kind: "sprite"; readonly role: AgentRole }
  | { readonly kind: "icon"; readonly icon: string };

type Member = {
  readonly id: string;
  readonly role: string;
  readonly bio: string;
  readonly visual: Visual;
};
type Group = { readonly label: string; readonly members: readonly Member[] };

const GROUPS: readonly Group[] = [
  {
    label: "Producto",
    members: [
      {
        id: "researcher",
        role: "Investigación",
        visual: { kind: "sprite", role: "researcher" },
        bio: "Investiga el mercado, la competencia y las tendencias tecnológicas para informar el PRD con datos reales. Busca demanda verificable antes de construir.",
      },
      {
        id: "product-manager",
        role: "Product Manager",
        visual: { kind: "sprite", role: "product-manager" },
        bio: "Documenta el PRD y los FRDs. Convierte la visión del propietario en criterios de aceptación EARS accionables para los implementers.",
      },
    ],
  },
  {
    label: "Diseño y contenido",
    members: [
      {
        id: "designer",
        role: "Diseño UX/UI",
        visual: { kind: "sprite", role: "designer" },
        bio: "Crea mockups navegables con identidad visual propia y genera el sistema de diseño (tokens, paleta, tipografía) que el frontend usa como única fuente de verdad visual.",
      },
      {
        id: "copywriter",
        role: "Copy / UX writing",
        visual: { kind: "sprite", role: "copywriter" },
        bio: "Escribe el copy de la interfaz, los textos de marketing y la documentación de usuario, siempre en el idioma correcto (i18n).",
      },
    ],
  },
  {
    label: "Arquitectura e infra",
    members: [
      {
        id: "architect",
        role: "Arquitecto",
        visual: { kind: "sprite", role: "architect" },
        bio: "Diseña la arquitectura técnica de la plataforma y de cada FRD. Genera el blueprint con el stack, el modelo de datos, los componentes y las interfaces, y produce las work orders que dividen la construcción.",
      },
      {
        id: "devops",
        role: "DevOps / Deploy",
        visual: { kind: "sprite", role: "devops" },
        bio: "Configura la infraestructura, el CI/CD, los entornos de despliegue y los secretos. Es gate humano para cualquier cambio de acceso o de gasto.",
      },
    ],
  },
  {
    label: "Construcción y datos",
    members: [
      {
        id: "implementer",
        role: "Implementer",
        visual: { kind: "sprite", role: "implementer" },
        bio: "Rol genérico de construcción: ejecuta work orders con TDD. En la práctica lo usan el backend-dev y el frontend-dev según el tipo de work order.",
      },
      {
        id: "backend-dev",
        role: "Backend",
        visual: { kind: "sprite", role: "backend-dev" },
        bio: "Implementa la lógica de servidor: APIs, acceso a datos, lógica de negocio e integraciones externas. Opera bajo las convenciones de la fábrica (tipado estricto, TDD, sin any).",
      },
      {
        id: "frontend-dev",
        role: "Frontend",
        visual: { kind: "sprite", role: "frontend-dev" },
        bio: "Construye los componentes de interfaz, los layouts y la interactividad del cliente. Usa únicamente design tokens: nunca valores de color o espaciado escritos a mano.",
      },
      {
        id: "test-writer",
        role: "Testing (TDD)",
        visual: { kind: "sprite", role: "test-writer" },
        bio: "Escribe los tests de aceptación (RED) antes de que el implementer escriba código, anclados en los criterios EARS de los FRDs. También escribe tests adversariales y e2e de los flujos críticos.",
      },
      {
        id: "analytics",
        role: "Analítica",
        visual: { kind: "sprite", role: "analytics" },
        bio: "Define el plan de eventos de analítica, instrumenta el tracking y produce el dashboard de métricas para el review de lanzamiento.",
      },
    ],
  },
  {
    label: "Calidad",
    members: [
      {
        id: "reviewer",
        role: "Revisión",
        visual: { kind: "sprite", role: "reviewer" },
        bio: "Valida el trabajo de otros agentes a nivel de FRD. Vuelve a correr toda la evidencia, escribe tests adversariales que el implementer no vio y ejecuta mutation testing. Solo él puede marcar un FRD como VERIFIED.",
      },
      {
        id: "drift-finder",
        role: "Buscador de deriva",
        visual: { kind: "icon", icon: "ti-radar" },
        bio: "Busca deriva en el FRD completo: recorre cada contrato del FRD (requisitos, criterios, componentes e interfaces) contra el código que ya estaba verificado, fuera del diff, para detectar dónde el código se alejó de lo que el FRD promete. Por cada deriva escribe una prueba que la demuestra. Corre junto al gate de cada FRD, pero solo cuando el gate usa evidencia digested, que no es el valor por defecto (el defecto es explore); también puedes encenderlo a mano con --drift-finder on. Solo propone: el reviewer sigue siendo el juez y cada deriva pasa por una prueba diferencial (DR-122) antes de convertirse en tarjeta o en reapertura de una work order. Corre sobre sonnet, con esfuerzo medio y hasta 60 llamadas a herramientas.",
      },
      {
        id: "security-auditor",
        role: "Seguridad",
        visual: { kind: "sprite", role: "security-auditor" },
        bio: "Revisa la superficie de ataque siguiendo el OWASP Top 10 para aplicaciones agénticas e informa al propietario de las vulnerabilidades antes del release.",
      },
    ],
  },
  {
    label: "Memoria y motor",
    members: [
      {
        id: "librarian",
        role: "Memoria",
        visual: { kind: "icon", icon: "ti-books" },
        bio: "Cosecha las lecciones del inbox de memoria (.pandacorp/run/lessons.md) y las refina en entradas duraderas en factory/memory/. Mantiene la memoria transversal de la fábrica.",
      },
      {
        id: "mech",
        role: "Ejecutor mecánico",
        visual: { kind: "icon", icon: "ti-settings" },
        bio: "Ejecutor mecánico de bajo juicio: solo tiene acceso a Bash y Read, nunca a Write ni Edit, así que no puede tocar código de producto. Corre los pasos de plomería del motor de implement que no requieren decidir nada: el commit por work order, el sello de dispatch de cada oleada, el sync de rollups y la notificación de fin de run (más el archivado de changes cuando leanCloseOut está desactivado; por defecto ese paso vive en el cierre del reviewer). No reemplaza al implementer ni al reviewer: ejecuta exactamente el comando que se le indica y nada más. El safe point se queda en el implementer, porque decidir qué hacer con un ítem drenado es juicio, no un script. Corre sobre el modelo MECH (haiku por defecto, configurable con args.mechModel) con esfuerzo bajo.",
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function MemberVisual({ member }: { member: Member }): React.JSX.Element {
  if (member.visual.kind === "sprite") {
    return <Avatar agentId={member.visual.role} size="sm" />;
  }
  return (
    <ItemSlot
      size={32}
      aria-label={`Ícono de ${member.id}`}
      icon={<i className={`ti ${member.visual.icon}`} aria-hidden="true" />}
    />
  );
}

export function TeamDiagram(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-team">
      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-text2)",
              marginBottom: "6px",
            }}
          >
            {group.label}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {group.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md, 12px)",
                  padding: "7px 11px 7px 7px",
                }}
              >
                <MemberVisual member={member} />
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--color-text)",
                    }}
                  >
                    {member.id}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text2)" }}>{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One labelled bio card per agent, grouped like the diagram (same `GROUPS` data). */
export function TeamBios(): React.JSX.Element {
  return (
    <div data-testid="manual-team-bios">
      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-text2)",
              marginBottom: "6px",
            }}
          >
            {group.label}
          </div>
          {group.members.map((member) => (
            <section
              key={member.id}
              aria-labelledby={`team-bio-${member.id}`}
              style={{
                background: "var(--color-panel)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md, 12px)",
                padding: "10px 12px",
                marginBottom: "8px",
              }}
            >
              <h3
                id={`team-bio-${member.id}`}
                style={{
                  margin: "0 0 4px",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--color-text)",
                }}
              >
                {member.id}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "var(--color-text2)",
                }}
              >
                {member.bio}
              </p>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
