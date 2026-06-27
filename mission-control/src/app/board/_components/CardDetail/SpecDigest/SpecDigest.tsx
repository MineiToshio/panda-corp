"use client";

/**
 * SpecDigest (CMP-02-spec-digest) — the native "Spec" tab: a high-level, visual Spanish
 * summary of the project's PRD, research and FRDs. Same visual language as IdeaPitch
 * (full-bleed tinted blocks, label|content rows), driven by `parseSpec(body)` over the
 * `.pandacorp/comms/spec-resumen.md` digest. The underlying docs stay English (Documentos
 * tab); this is the owner-facing Spanish overview.
 *
 * Traceability: CMP-02-spec-digest → REQ-02-009 (the spec overview, between Propuesta and
 * Documentos; visible only when the project has a spec digest).
 */

import { useState } from "react";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { Modal } from "@/components/core/Modal/Modal";
import { projectMetaChips } from "@/components/modules/IdeaCard/IdeaCard";
import {
  parseSpec,
  type SpecBlock,
  type SpecFrd,
  type SpecItem,
  type SpecSection,
} from "@/lib/spec/spec";
import {
  BLABEL_FRD_STYLE,
  BLABEL_PRD_STYLE,
  BLABEL_RESEARCH_STYLE,
  BLOCK_FRD_STYLE,
  BLOCK_PRD_STYLE,
  BLOCK_RESEARCH_STYLE,
  BULLET_DOT_STYLE,
  BULLET_ITEM_STYLE,
  BULLET_LIST_STYLE,
  BULLET_STRONG_STYLE,
  CARDS_GRID_STYLE,
  CHIP_MUTED_STYLE,
  CHIP_STYLE,
  CHIPS_ROW_STYLE,
  CONTAINER_STYLE,
  DECISION_DESC_STYLE,
  DECISION_ITEM_STYLE,
  DECISION_MARK_STYLE,
  DECISION_TITLE_STYLE,
  DECISIONS_BOX_STYLE,
  EYEBROW_STYLE,
  FRD_CARD_STYLE,
  FRD_GRID_STYLE,
  FRD_HEAD_STYLE,
  FRD_ID_STYLE,
  FRD_MODAL_DOT_STYLE,
  FRD_MODAL_ITEM_STYLE,
  FRD_MODAL_LEAD_STYLE,
  FRD_MODAL_LI_TEXT_STYLE,
  FRD_MODAL_LIST_STYLE,
  FRD_MODAL_PROSE_STYLE,
  FRD_MODAL_SECTION_STYLE,
  FRD_MORE_STYLE,
  FRD_SUMMARY_TEXT_STYLE,
  FRD_TITLE_STYLE,
  frdTagStyle,
  HERO_CHIPS_ROW_STYLE,
  HERO_STYLE,
  HIGHLIGHT_STYLE,
  INNER_STYLE,
  INTRO_STYLE,
  META_CHIP_STYLE,
  META_ICON_STYLE,
  MODAL_ACCENT,
  MODAL_INFO,
  MODAL_OK,
  MODAL_SCOPE,
  MODAL_WARN,
  modalLabelStyle,
  modalLabelTick,
  PHASE_CHIP_STYLE,
  REF_CARD_STYLE,
  REF_DESC_STYLE,
  REF_TITLE_STYLE,
  ROLE_CARD_STYLE,
  ROLE_DESC_STYLE,
  ROLE_TITLE_STYLE,
  ROW_KEY_STYLE,
  ROW_STYLE,
  SCOPE_CHECK_STYLE,
  SCOPE_ITEM_STYLE,
  SCOPE_LIST_STYLE,
  SCOPE_STRONG_STYLE,
  STAT_CARD_STYLE,
  STAT_DESC_STYLE,
  STAT_TITLE_STYLE,
  STATS_GRID_STYLE,
  TITLE_STYLE,
} from "./SpecDigest.styles";

export interface SpecDigestProps {
  /** The `.pandacorp/comms/spec-resumen.md` digest markdown. */
  body: string;
  /** Card title (fallback when the digest has no `proyecto`). */
  title: string;
  /** App type (web / mobile / api …) — a "qué es" chip next to the phase chip. */
  projectType?: string;
  /** Web target platform (desktop / mobile / responsive) — a "qué es" chip. */
  targetPlatforms?: string;
  resolveLink?: LinkResolver;
}

/** Chip row for "Alcance v1" (solid) / "Fuera del v1" (dashed, struck-through). */
function Chips({ items, muted }: { items: SpecItem[]; muted: boolean }): React.JSX.Element {
  return (
    <div style={CHIPS_ROW_STYLE}>
      {items.map((it) => (
        <span key={it.title} style={muted ? CHIP_MUTED_STYLE : CHIP_STYLE} data-testid="spec-chip">
          {it.title}
        </span>
      ))}
    </div>
  );
}

/** Highlighted callout for "Hipótesis de valor" — one short, scannable statement. */
function Highlight({ markdown }: { markdown: string }): React.JSX.Element {
  const text = markdown.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return (
    <p style={HIGHLIGHT_STYLE} data-testid="spec-highlight">
      {text}
    </p>
  );
}

/** A `{title, desc}` item rendered as `**title** — desc`, or just the title when there's no desc. */
function ItemText({
  item,
  strongStyle,
}: {
  item: SpecItem;
  strongStyle: React.CSSProperties;
}): React.JSX.Element {
  if (item.desc === "") return <>{item.title}</>;
  return (
    <span>
      <span style={strongStyle}>{item.title}</span> — {item.desc}
    </span>
  );
}

/** Bullet list for "El problema" — a scannable list, not a paragraph wall. */
function BulletList({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <ul style={BULLET_LIST_STYLE}>
      {items.map((it) => (
        <li key={it.title} style={BULLET_ITEM_STYLE} data-testid="spec-bullet">
          <span style={BULLET_DOT_STYLE} aria-hidden="true" />
          <ItemText item={it} strongStyle={BULLET_STRONG_STYLE} />
        </li>
      ))}
    </ul>
  );
}

/** Roomy vertical checklist for "Alcance v1" — NOT cramped pills. */
function ScopeList({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <div style={SCOPE_LIST_STYLE}>
      {items.map((it) => (
        <div key={it.title} style={SCOPE_ITEM_STYLE} data-testid="spec-scope-item">
          <span style={SCOPE_CHECK_STYLE} aria-hidden="true">
            ✓
          </span>
          <ItemText item={it} strongStyle={SCOPE_STRONG_STYLE} />
        </div>
      ))}
    </div>
  );
}

/** Role cards for "Usuarios". */
function RoleCards({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <div style={CARDS_GRID_STYLE}>
      {items.map((it) => (
        <div key={it.title} style={ROLE_CARD_STYLE} data-testid="spec-role">
          <span style={ROLE_TITLE_STYLE}>{it.title}</span>
          <p style={ROLE_DESC_STYLE}>{it.desc}</p>
        </div>
      ))}
    </div>
  );
}

/** Stat cards for "Métricas de éxito". */
function StatCards({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <div style={STATS_GRID_STYLE}>
      {items.map((it) => (
        <div key={it.title} style={STAT_CARD_STYLE} data-testid="spec-stat">
          <span style={STAT_TITLE_STYLE}>{it.title}</span>
          {it.desc !== "" && <p style={STAT_DESC_STYLE}>{it.desc}</p>}
        </div>
      ))}
    </div>
  );
}

/** Reference cards for "Referentes". */
function RefCards({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <div style={CARDS_GRID_STYLE}>
      {items.map((it) => (
        <div key={it.title} style={REF_CARD_STYLE} data-testid="spec-ref">
          <span style={REF_TITLE_STYLE}>{it.title}</span>
          {it.desc !== "" && <p style={REF_DESC_STYLE}>{it.desc}</p>}
        </div>
      ))}
    </div>
  );
}

/** Highlighted box for "Decisiones abiertas" (what the owner still must decide). */
function DecisionsBox({ items }: { items: SpecItem[] }): React.JSX.Element {
  return (
    <div style={DECISIONS_BOX_STYLE} data-testid="spec-decisions">
      {items.map((it) => (
        <div key={it.title} style={DECISION_ITEM_STYLE} className="spec-decision">
          <span style={DECISION_MARK_STYLE} aria-hidden="true">
            ◆
          </span>
          <span>
            <span style={DECISION_TITLE_STYLE}>{it.title}</span>
            {it.desc !== "" && <span style={DECISION_DESC_STYLE}> — {it.desc}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A PRD/Research subsection rendered by its kind (label on the left, rich content on the right). */
function BlockRow({
  block,
  resolveLink,
}: {
  block: SpecBlock;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  let content: React.JSX.Element;
  switch (block.kind) {
    case "highlight":
      content = <Highlight markdown={block.markdown} />;
      break;
    case "bullets":
      content = <BulletList items={block.items} />;
      break;
    case "roles":
      content = <RoleCards items={block.items} />;
      break;
    case "metrics":
      content = <StatCards items={block.items} />;
      break;
    case "chips":
      content = <ScopeList items={block.items} />;
      break;
    case "chips-muted":
      content = <Chips items={block.items} muted={true} />;
      break;
    case "decisions":
      content = <DecisionsBox items={block.items} />;
      break;
    case "refs":
      content = <RefCards items={block.items} />;
      break;
    default:
      content = <Markdown resolveLink={resolveLink}>{block.markdown}</Markdown>;
  }
  return (
    <div style={ROW_STYLE} className="spec-row" data-testid="spec-block-row">
      <div style={ROW_KEY_STYLE}>{block.label}</div>
      <div className="pitch-rowbody">{content}</div>
    </div>
  );
}

/** One section (PRD or Research) as a full-bleed tinted block. */
function SectionBlock({
  section,
  blockStyle,
  labelStyle,
  label,
  resolveLink,
}: {
  section: SpecSection;
  blockStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  label: string;
  resolveLink?: LinkResolver;
}): React.JSX.Element {
  return (
    <section className="spec-block" style={blockStyle}>
      <div style={INNER_STYLE}>
        <p style={labelStyle}>{label}</p>
        {section.blocks.map((block) => (
          <BlockRow key={block.label} block={block} resolveLink={resolveLink} />
        ))}
      </div>
    </section>
  );
}

/** One FRD as a compact, clickable card — opens the detail modal (owner rule: detail in a modal). */
function FrdCard({
  frd,
  onOpen,
}: {
  frd: SpecFrd;
  onOpen: (frd: SpecFrd) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      style={FRD_CARD_STYLE}
      className="spec-frd-card"
      data-testid="spec-frd"
      onClick={() => onOpen(frd)}
      aria-label={`Ver detalle de ${frd.id} ${frd.title}`}
    >
      <div style={FRD_HEAD_STYLE}>
        <span style={FRD_ID_STYLE}>{frd.id}</span>
        {frd.tag != null && <span style={frdTagStyle(frd.tag)}>{frd.tag}</span>}
      </div>
      <p style={FRD_TITLE_STYLE}>{frd.title}</p>
      {frd.summary !== "" && <p style={FRD_SUMMARY_TEXT_STYLE}>{frd.summary}</p>}
      <span style={FRD_MORE_STYLE}>Ver detalle →</span>
    </button>
  );
}

/** A labelled section inside the FRD modal (a coloured tick + label, then content). */
function ModalSection({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={FRD_MODAL_SECTION_STYLE}>
      <p style={modalLabelStyle(color)}>
        <span style={modalLabelTick(color)} aria-hidden="true" />
        {label}
      </p>
      {children}
    </div>
  );
}

/** A bullet list that draws its own NEUTRAL dot (the global `ul` reset hides native markers). */
function ModalList({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul style={FRD_MODAL_LIST_STYLE}>
      {items.map((it) => (
        <li key={it} style={FRD_MODAL_ITEM_STYLE}>
          <span style={FRD_MODAL_DOT_STYLE} aria-hidden="true" />
          <span style={FRD_MODAL_LI_TEXT_STYLE}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** The FRD detail modal — reuses the core Modal; colour-coded like the Spec page. */
function FrdModal({ frd, onClose }: { frd: SpecFrd; onClose: () => void }): React.JSX.Element {
  const tagBadge =
    frd.tag != null ? (
      <span style={{ ...frdTagStyle(frd.tag), marginLeft: 0 }}>{frd.tag}</span>
    ) : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      title={`${frd.id} · ${frd.title}`}
      testIdBase="spec-frd"
      width={620}
      badge={tagBadge}
    >
      {frd.summary !== "" && <p style={FRD_MODAL_LEAD_STYLE}>{frd.summary}</p>}
      {frd.overview !== "" && (
        <ModalSection label="Overview" color={MODAL_INFO}>
          <p style={FRD_MODAL_PROSE_STYLE}>{frd.overview}</p>
        </ModalSection>
      )}
      {frd.userStories.length > 0 && (
        <ModalSection label="User stories" color={MODAL_ACCENT}>
          <ModalList items={frd.userStories} />
        </ModalSection>
      )}
      {frd.businessRules.length > 0 && (
        <ModalSection label="Reglas de negocio" color={MODAL_OK}>
          <ModalList items={frd.businessRules} />
        </ModalSection>
      )}
      {frd.outOfScope.length > 0 && (
        <ModalSection label="Fuera de alcance" color={MODAL_SCOPE}>
          <ModalList items={frd.outOfScope} />
        </ModalSection>
      )}
      {frd.openQuestions.length > 0 && (
        <ModalSection label="Open questions" color={MODAL_WARN}>
          <ModalList items={frd.openQuestions} />
        </ModalSection>
      )}
    </Modal>
  );
}

export function SpecDigest({
  body,
  title,
  projectType,
  targetPlatforms,
  resolveLink,
}: SpecDigestProps): React.JSX.Element {
  const spec = parseSpec(body);
  const metaChips = projectMetaChips(projectType, targetPlatforms);
  const [openFrd, setOpenFrd] = useState<SpecFrd | null>(null);

  return (
    <article data-testid="card-detail-spec" style={CONTAINER_STYLE} aria-label="Resumen del spec">
      <header style={HERO_STYLE}>
        <div style={INNER_STYLE}>
          <p style={EYEBROW_STYLE}>Resumen del spec</p>
          <h3 style={TITLE_STYLE}>{spec.proyecto ?? title}</h3>
          {spec.intro != null && <p style={INTRO_STYLE}>{spec.intro}</p>}
          {(spec.fase != null || metaChips.length > 0) && (
            <div style={HERO_CHIPS_ROW_STYLE}>
              {spec.fase != null && <span style={PHASE_CHIP_STYLE}>fase · {spec.fase}</span>}
              {metaChips.map((chip) => (
                <span key={chip.label} style={META_CHIP_STYLE} data-testid="spec-meta-chip">
                  {chip.icon != null && (
                    <i className={`ti ${chip.icon}`} aria-hidden="true" style={META_ICON_STYLE} />
                  )}
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {spec.prd != null && spec.prd.blocks.length > 0 && (
        <SectionBlock
          section={spec.prd}
          blockStyle={BLOCK_PRD_STYLE}
          labelStyle={BLABEL_PRD_STYLE}
          label="📋 PRD · qué y por qué"
          resolveLink={resolveLink}
        />
      )}

      {spec.research != null && spec.research.blocks.length > 0 && (
        <SectionBlock
          section={spec.research}
          blockStyle={BLOCK_RESEARCH_STYLE}
          labelStyle={BLABEL_RESEARCH_STYLE}
          label="🔬 Research · la evidencia"
          resolveLink={resolveLink}
        />
      )}

      {spec.frds.length > 0 && (
        <section className="spec-block" style={BLOCK_FRD_STYLE}>
          <div style={INNER_STYLE}>
            <p style={BLABEL_FRD_STYLE}>🧩 FRDs · las piezas del v1 ({spec.frds.length})</p>
            <div style={FRD_GRID_STYLE}>
              {spec.frds.map((frd) => (
                <FrdCard key={frd.id} frd={frd} onOpen={setOpenFrd} />
              ))}
            </div>
          </div>
        </section>
      )}

      {openFrd != null && <FrdModal frd={openFrd} onClose={() => setOpenFrd(null)} />}
    </article>
  );
}
