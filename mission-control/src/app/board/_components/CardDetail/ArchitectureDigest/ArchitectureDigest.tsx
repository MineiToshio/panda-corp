"use client";

/**
 * ArchitectureDigest (CMP-02-architecture-digest) — the native "Arquitectura" tab: a high-level,
 * visual Spanish summary of the project's platform architecture, mirroring SpecDigest's visual
 * language (full-bleed tinted bands, label|content rows, FRD cards + modal). It is fed by:
 *   - the digest `.pandacorp/comms/arquitectura-resumen.md` (parsed by `parseArchitecture`) for the
 *     NARRATIVE (stack table, data model, services, per-FRD cards), and
 *   - LIVE artifacts for the machine-truth blocks: the implementation-plan DAG (work-order
 *     frontmatter, via the reused WoDag), the ADRs (`docs/adr/*`) and the env vars (`.env.example`).
 *
 * One scannable screen, top→bottom: hero → stack table → data model (conditional) → services + env
 * → ADRs → the implementation-plan DAG (the centerpiece) → per-FRD cards. Heavy detail lives behind
 * a Modal (an ADR's body, an FRD's work orders).
 *
 * Traceability: CMP-02-architecture-digest → REQ-02-009 (the architecture overview, after Spec;
 * visible only when the project has an architecture digest).
 */

import { useState } from "react";
import { WoDag } from "@/app/projects/[slug]/_observability/WoDag/WoDag";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { projectMetaChips } from "@/components/modules/IdeaCard/IdeaCard";
import type { Adr } from "@/lib/architecture/adr";
import { type ArchFrd, type ArchItem, parseArchitecture } from "@/lib/architecture/architecture";
import type { EnvVar } from "@/lib/architecture/env";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import {
  BLABEL_FRD_STYLE,
  BLOCK_FRD_STYLE,
  BULLET_DOT_STYLE,
  BULLET_ITEM_STYLE,
  BULLET_LIST_STYLE,
  BULLET_STRONG_STYLE,
  CONTAINER_STYLE,
  EYEBROW_STYLE,
  FRD_CARD_STYLE,
  FRD_GRID_STYLE,
  FRD_HEAD_STYLE,
  FRD_ID_STYLE,
  FRD_MORE_STYLE,
  FRD_SUMMARY_TEXT_STYLE,
  FRD_TITLE_STYLE,
  HERO_CHIPS_ROW_STYLE,
  HERO_STYLE,
  INNER_STYLE,
  INTRO_STYLE,
  META_CHIP_STYLE,
  META_ICON_STYLE,
  PHASE_CHIP_STYLE,
  TITLE_STYLE,
} from "../SpecDigest/SpecDigest.styles";
import {
  ADR_DECISION_STYLE,
  ADR_ID_STYLE,
  ADR_LIST_STYLE,
  ADR_ROW_STYLE,
  ADR_TEXT_WRAP_STYLE,
  ADR_TITLE_STYLE,
  BLOCK_DATA_STYLE,
  BLOCK_STACK_STYLE,
  blockLabel,
  DATA_NOTE_STYLE,
  EMPTY_NOTE_STYLE,
  ENTITY_CARD_STYLE,
  ENTITY_DESC_STYLE,
  ENTITY_GRID_STYLE,
  ENTITY_NAME_STYLE,
  ENV_COMMENT_STYLE,
  ENV_ITEM_STYLE,
  ENV_LIST_STYLE,
  ENV_NAME_STYLE,
  FRD_MODAL_BP_STYLE,
  FRD_MODAL_WO_LABEL_STYLE,
  NODB_CALLOUT_STYLE,
  NODB_ICON_STYLE,
  PLAN_BLOCK_STYLE,
  PLAN_HEAD_STYLE,
  PLAN_SUB_STYLE,
  PLAN_TITLE_STYLE,
  STACK_CAPA_STYLE,
  STACK_PICK_STYLE,
  STACK_TABLE_STYLE,
  STACK_TD_STYLE,
  STACK_TH_STYLE,
  SUBHEAD_STYLE,
  TWO_UP_STYLE,
  WO_COUNT_STYLE,
  WO_DESC_STYLE,
  WO_ID_STYLE,
  WO_ROW_STYLE,
} from "./ArchitectureDigest.styles";

export interface ArchitectureDigestProps {
  /** The `.pandacorp/comms/arquitectura-resumen.md` digest markdown. */
  body: string;
  /** Card title (fallback when the digest has no `proyecto`). */
  title: string;
  /** App type (web / mobile / api …) — a "qué es" chip next to the phase chip. */
  projectType?: string;
  /** Web target platform (desktop / mobile / responsive) — a "qué es" chip. */
  targetPlatforms?: string;
  /** Live work orders (from listWorkOrders) — the implementation-plan DAG. */
  workOrders?: WorkOrder[];
  /** Live env vars (from `.env.example`). */
  envVars?: EnvVar[];
  /** Live ADRs (from `docs/adr/*`). */
  adrs?: Adr[];
  /** Portfolio path of the linked project — scopes the DAG's live snapshot. */
  project?: string;
  resolveLink?: LinkResolver;
}

// --- Stack matrix -----------------------------------------------------------

function StackTable({ rows }: { rows: ReturnType<typeof parseArchitecture>["stackRows"] }) {
  return (
    <table style={STACK_TABLE_STYLE} data-testid="arch-stack-table">
      <thead>
        <tr>
          <th style={STACK_TH_STYLE}>Capa</th>
          <th style={STACK_TH_STYLE}>Elección</th>
          <th style={STACK_TH_STYLE}>Por qué</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.capa} data-testid="arch-stack-row">
            <td style={STACK_CAPA_STYLE}>{row.capa}</td>
            <td style={STACK_PICK_STYLE}>{row.eleccion}</td>
            <td style={STACK_TD_STYLE}>{row.porque}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Data model (conditional) ----------------------------------------------

function DataModel({
  model,
}: {
  model: NonNullable<ReturnType<typeof parseArchitecture>["dataModel"]>;
}) {
  return (
    <section className="arch-block" style={BLOCK_DATA_STYLE} data-testid="arch-data-model">
      <div style={INNER_STYLE}>
        <p style={blockLabel("var(--color-ok)")}>🗄️ Modelo de datos</p>
        {model.isNone ? (
          <p style={NODB_CALLOUT_STYLE} data-testid="arch-nodb">
            <i className="ti ti-database-off" aria-hidden="true" style={NODB_ICON_STYLE} />
            <span>
              {model.note !== "" ? model.note : "Sin base de datos — contenido como código."}
            </span>
          </p>
        ) : (
          model.note !== "" && <p style={DATA_NOTE_STYLE}>{model.note}</p>
        )}
        {model.entities.length > 0 && (
          <div style={ENTITY_GRID_STYLE}>
            {model.entities.map((e) => (
              <div key={e.title} style={ENTITY_CARD_STYLE} data-testid="arch-entity">
                <span style={ENTITY_NAME_STYLE}>{e.title}</span>
                {e.desc !== "" && <p style={ENTITY_DESC_STYLE}>{e.desc}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- Services + env (two-up) ------------------------------------------------

function ServiceBullets({ items }: { items: ArchItem[] }) {
  return (
    <ul style={BULLET_LIST_STYLE}>
      {items.map((it) => (
        <li key={it.title} style={BULLET_ITEM_STYLE} data-testid="arch-service">
          <span style={BULLET_DOT_STYLE} aria-hidden="true" />
          <span>
            {it.desc === "" ? (
              it.title
            ) : (
              <>
                <span style={BULLET_STRONG_STYLE}>{it.title}</span> — {it.desc}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EnvVars({ vars }: { vars: EnvVar[] }) {
  if (vars.length === 0) {
    return <p style={EMPTY_NOTE_STYLE}>Sin variables de entorno declaradas.</p>;
  }
  return (
    <div style={ENV_LIST_STYLE}>
      {vars.map((v) => (
        <div key={v.name} style={ENV_ITEM_STYLE} data-testid="arch-env">
          <code style={ENV_NAME_STYLE}>{v.name}</code>
          {v.comment !== "" && <span style={ENV_COMMENT_STYLE}>{v.comment}</span>}
        </div>
      ))}
    </div>
  );
}

// --- ADRs -------------------------------------------------------------------

function AdrRow({ adr, onOpen }: { adr: Adr; onOpen: (adr: Adr) => void }) {
  return (
    <button
      type="button"
      style={ADR_ROW_STYLE}
      className="arch-adr-row"
      data-testid="arch-adr"
      onClick={() => onOpen(adr)}
      aria-label={`Ver ${adr.id} ${adr.title}`}
    >
      <span style={ADR_ID_STYLE}>{adr.id}</span>
      <span style={ADR_TEXT_WRAP_STYLE}>
        <p style={ADR_TITLE_STYLE}>{adr.title}</p>
        {adr.decision !== "" && <p style={ADR_DECISION_STYLE}>{adr.decision}</p>}
      </span>
    </button>
  );
}

function AdrModal({
  adr,
  onClose,
  resolveLink,
}: {
  adr: Adr;
  onClose: () => void;
  resolveLink?: LinkResolver;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`${adr.id} · ${adr.title}`}
      testIdBase="arch-adr"
      width={640}
    >
      <Markdown resolveLink={resolveLink}>{adr.body}</Markdown>
    </Modal>
  );
}

// --- Per-FRD cards + modal --------------------------------------------------

function FrdCard({ frd, onOpen }: { frd: ArchFrd; onOpen: (frd: ArchFrd) => void }) {
  return (
    <button
      type="button"
      style={FRD_CARD_STYLE}
      className="spec-frd-card"
      data-testid="arch-frd"
      onClick={() => onOpen(frd)}
      aria-label={`Ver detalle de ${frd.id} ${frd.title}`}
    >
      <div style={FRD_HEAD_STYLE}>
        <span style={FRD_ID_STYLE}>{frd.id}</span>
        {frd.workOrders.length > 0 && (
          <span style={WO_COUNT_STYLE}>
            {frd.workOrders.length} WO{frd.workOrders.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p style={FRD_TITLE_STYLE}>{frd.title}</p>
      {frd.blueprint !== "" && <p style={FRD_SUMMARY_TEXT_STYLE}>{frd.blueprint}</p>}
      <span style={FRD_MORE_STYLE}>Ver detalle →</span>
    </button>
  );
}

function FrdModal({ frd, onClose }: { frd: ArchFrd; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`${frd.id} · ${frd.title}`}
      testIdBase="arch-frd"
      width={620}
    >
      {frd.blueprint !== "" && <p style={FRD_MODAL_BP_STYLE}>{frd.blueprint}</p>}
      {frd.workOrders.length > 0 && (
        <>
          <p style={FRD_MODAL_WO_LABEL_STYLE}>Work orders ({frd.workOrders.length})</p>
          <div>
            {frd.workOrders.map((wo) => (
              <div key={wo.id} style={WO_ROW_STYLE} data-testid="arch-frd-wo">
                <span style={WO_ID_STYLE}>{wo.id}</span>
                <span style={WO_DESC_STYLE}>{wo.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// --- Hero -------------------------------------------------------------------

type MetaChip = ReturnType<typeof projectMetaChips>[number];

function Hero({
  arch,
  title,
  metaChips,
}: {
  arch: ReturnType<typeof parseArchitecture>;
  title: string;
  metaChips: MetaChip[];
}) {
  return (
    <header style={HERO_STYLE}>
      <div style={INNER_STYLE}>
        <p style={EYEBROW_STYLE}>Arquitectura</p>
        <h3 style={TITLE_STYLE}>{arch.proyecto ?? title}</h3>
        {arch.stack != null && <p style={INTRO_STYLE}>{arch.stack}</p>}
        {arch.intro != null && arch.intro !== arch.stack && (
          <p style={{ ...INTRO_STYLE, fontSize: "14px", marginTop: "8px" }}>{arch.intro}</p>
        )}
        <div style={HERO_CHIPS_ROW_STYLE}>
          {arch.host != null && (
            <span style={META_CHIP_STYLE} data-testid="arch-chip-host">
              <i className="ti ti-server" aria-hidden="true" style={META_ICON_STYLE} />
              {arch.host}
            </span>
          )}
          {arch.coste != null && (
            <span style={META_CHIP_STYLE} data-testid="arch-chip-coste">
              <i className="ti ti-coin" aria-hidden="true" style={META_ICON_STYLE} />
              {arch.coste}
            </span>
          )}
          {arch.fase != null && <span style={PHASE_CHIP_STYLE}>fase · {arch.fase}</span>}
          {metaChips.map((chip) => (
            <span key={chip.label} style={META_CHIP_STYLE} data-testid="arch-meta-chip">
              {chip.icon != null && (
                <i className={`ti ${chip.icon}`} aria-hidden="true" style={META_ICON_STYLE} />
              )}
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

// --- Services + env band ----------------------------------------------------

function ServicesEnvBand({ services, env }: { services: ArchItem[]; env: EnvVar[] }) {
  return (
    <section style={INNER_STYLE}>
      <div style={TWO_UP_STYLE}>
        {services.length > 0 && (
          <div data-testid="arch-services">
            <p style={SUBHEAD_STYLE}>🔌 Comunicación & servicios</p>
            <ServiceBullets items={services} />
          </div>
        )}
        <div data-testid="arch-env-block">
          <p style={SUBHEAD_STYLE}>🔑 Variables de entorno</p>
          <EnvVars vars={env} />
        </div>
      </div>
    </section>
  );
}

// --- ADR band ---------------------------------------------------------------

function AdrBand({ adrs, onOpen }: { adrs: Adr[]; onOpen: (adr: Adr) => void }) {
  return (
    <section style={INNER_STYLE}>
      <div style={ADR_LIST_STYLE} data-testid="arch-adrs">
        <p style={SUBHEAD_STYLE}>🧭 Decisiones (ADRs)</p>
        {adrs.map((adr) => (
          <AdrRow key={adr.id} adr={adr} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

// --- Implementation-plan band (the centerpiece) -----------------------------

function PlanBand({ workOrders, project }: { workOrders: WorkOrder[]; project?: string }) {
  return (
    <section style={INNER_STYLE}>
      <div style={PLAN_BLOCK_STYLE} data-testid="arch-plan">
        <div style={PLAN_HEAD_STYLE}>
          <h4 style={PLAN_TITLE_STYLE}>🗺️ Plan de implementación</h4>
        </div>
        <p style={PLAN_SUB_STYLE}>
          El grafo de work orders: cada nodo es una orden de trabajo agrupada por FRD, las flechas
          son dependencias y el color es su estado. Muestra qué corre en paralelo y la ruta crítica.
          Toca un nodo para resaltar su cadena.
        </p>
        <WoDag workOrders={workOrders} project={project} />
      </div>
    </section>
  );
}

// --- Root -------------------------------------------------------------------

export function ArchitectureDigest({
  body,
  title,
  projectType,
  targetPlatforms,
  workOrders,
  envVars,
  adrs,
  project,
  resolveLink,
}: ArchitectureDigestProps): React.JSX.Element {
  const arch = parseArchitecture(body);
  const metaChips = projectMetaChips(projectType, targetPlatforms);
  const [openAdr, setOpenAdr] = useState<Adr | null>(null);
  const [openFrd, setOpenFrd] = useState<ArchFrd | null>(null);

  const wos = workOrders ?? [];
  const adrList = adrs ?? [];
  const env = envVars ?? [];
  const hasServicesEnv = arch.services.length > 0 || env.length > 0;

  return (
    <article
      data-testid="card-detail-architecture"
      style={CONTAINER_STYLE}
      aria-label="Resumen de la arquitectura"
    >
      <Hero arch={arch} title={title} metaChips={metaChips} />

      {arch.stackRows.length > 0 && (
        <section className="arch-block" style={BLOCK_STACK_STYLE} data-testid="arch-stack">
          <div style={INNER_STYLE}>
            <p style={blockLabel("var(--color-accent-text)")}>🧱 Stack & tecnologías</p>
            <StackTable rows={arch.stackRows} />
          </div>
        </section>
      )}

      {arch.dataModel != null && <DataModel model={arch.dataModel} />}

      {hasServicesEnv && <ServicesEnvBand services={arch.services} env={env} />}

      {adrList.length > 0 && <AdrBand adrs={adrList} onOpen={setOpenAdr} />}

      <PlanBand workOrders={wos} project={project} />

      {arch.frds.length > 0 && (
        <section className="arch-block" style={BLOCK_FRD_STYLE}>
          <div style={INNER_STYLE}>
            <p style={BLABEL_FRD_STYLE}>🧩 Por FRD ({arch.frds.length})</p>
            <div style={FRD_GRID_STYLE}>
              {arch.frds.map((frd) => (
                <FrdCard key={frd.id} frd={frd} onOpen={setOpenFrd} />
              ))}
            </div>
          </div>
        </section>
      )}

      {openAdr != null && (
        <AdrModal adr={openAdr} onClose={() => setOpenAdr(null)} resolveLink={resolveLink} />
      )}
      {openFrd != null && <FrdModal frd={openFrd} onClose={() => setOpenFrd(null)} />}
    </article>
  );
}
